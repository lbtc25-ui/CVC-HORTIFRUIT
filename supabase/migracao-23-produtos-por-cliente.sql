-- ============================================================================
--  Migração 23 — quais produtos aparecem no link de pedido de cada cliente
--
--  Nem todo cliente compra tudo: a PETROX, por exemplo, não recebe oferta de
--  abóbora. No cadastro da REDE escolhe-se os produtos que aparecem no link
--  de pedido de todas as lojas dela; uma LOJA pode ter a própria lista, que
--  então vale no lugar da da rede.
--
--    redes.produtos_pedido   null = todos os produtos
--    lojas.produtos_pedido   null = os mesmos da rede
--
--  As duas funções do link (migracao-21) passam a respeitar a lista: o
--  produto fora dela não aparece na página e é recusado se vier no pedido.
--  O "Repetir o último pedido" também só traz o que está liberado.
--
--  Só o link do cliente muda — o lançamento de venda pela equipe continua
--  oferecendo todos os produtos.
--
--  Rode ANTES de publicar a versão do app que traz a escolha: sem as colunas,
--  as gravações de rede e loja ficam presas na fila de Sincronização. Depois
--  da migracao-21.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

alter table public.redes add column if not exists produtos_pedido uuid[];
alter table public.lojas add column if not exists produtos_pedido uuid[];

-- ─── Abrir o link ───────────────────────────────────────────────────────────

create or replace function public.pedido_cliente_abrir(token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l record;
  produtos jsonb;
  ultimo jsonb;
begin
  select lj.id, lj.nome, r.nome as rede, r.id as rede_id,
         coalesce(lj.produtos_pedido, r.produtos_pedido) as permitidos
    into l
    from public.lojas lj
    join public.redes r on r.id = lj.rede_id
   where lj.token_pedido = pedido_cliente_abrir.token
     and lj.status = 'ativo';

  if not found then
    raise exception 'Link de pedido inválido ou desativado.' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id,
           'nome', p.nome,
           'fruta', p.fruta,
           'unidadeVenda', p.unidade_venda,
           'kgPorUnidade', p.kg_por_unidade
         ) order by p.fruta, p.nome), '[]'::jsonb)
    into produtos
    from public.produtos p
   where l.permitidos is null or p.id = any (l.permitidos);

  -- O último pedido da loja (só as quantidades), para o botão "Repetir".
  select jsonb_build_object(
           'data', v.data,
           'itens', coalesce((
             select jsonb_agg(jsonb_build_object('produtoId', i ->> 'produtoId', 'qty', (i ->> 'qty')::numeric))
               from jsonb_array_elements(v.itens) i
              where coalesce(i ->> 'natureza', 'venda') = 'venda'
                and coalesce(i ->> 'unidade', '') <> 'un'
                and (l.permitidos is null or (i ->> 'produtoId') = any (l.permitidos::text[]))
           ), '[]'::jsonb))
    into ultimo
    from public.vendas v
   where v.loja_id = l.id and v.status <> 'cancelado'
   order by v.data desc, v.criado_em desc
   limit 1;

  return jsonb_build_object(
    'loja', l.nome,
    'rede', l.rede,
    'produtos', produtos,
    'ultimoPedido', ultimo
  );
end;
$$;

-- ─── Enviar o pedido ────────────────────────────────────────────────────────
--
-- `itens` chega como [{ "produtoId": "…", "qty": 10 }, …]. Tudo o mais — kg,
-- preço, prazo, número do pedido — é calculado aqui, nunca confiado ao
-- navegador do cliente.

create or replace function public.pedido_cliente_enviar(token text, itens jsonb, observacao text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l record;
  item jsonb;
  p record;
  qty numeric;
  preco numeric;
  lista jsonb := '[]'::jsonb;
  total numeric := 0;
  kg_total numeric := 0;
  prazo integer;
  proximo integer;
  hoje date := (now() at time zone 'America/Maceio')::date;
  nova uuid := gen_random_uuid();
begin
  select lj.id, lj.rede_id, coalesce(lj.produtos_pedido, r.produtos_pedido) as permitidos
    into l
    from public.lojas lj
    join public.redes r on r.id = lj.rede_id
   where lj.token_pedido = pedido_cliente_enviar.token
     and lj.status = 'ativo';

  if not found then
    raise exception 'Link de pedido inválido ou desativado.' using errcode = 'P0002';
  end if;

  if jsonb_typeof(itens) is distinct from 'array' or jsonb_array_length(itens) = 0 then
    raise exception 'O pedido está vazio.';
  end if;
  if jsonb_array_length(itens) > 50 then
    raise exception 'Itens demais num pedido só.';
  end if;

  if (select count(*) from public.vendas v
       where v.loja_id = l.id and v.origem = 'cliente'
         and v.criado_em > now() - interval '1 hour') >= 10 then
    raise exception 'Muitos pedidos em pouco tempo. Aguarde um pouco ou fale com a distribuidora.';
  end if;

  for item in select * from jsonb_array_elements(itens) loop
    begin
      qty := round((item ->> 'qty')::numeric, 2);
    exception when others then
      raise exception 'Quantidade inválida.';
    end;
    if qty is null or qty <= 0 then
      continue;
    end if;
    if qty > 100000 then
      raise exception 'Quantidade grande demais.';
    end if;

    select pr.id, pr.unidade_venda, pr.kg_por_unidade
      into p
      from public.produtos pr
     where pr.id::text = item ->> 'produtoId'
       and (l.permitidos is null or pr.id = any (l.permitidos));
    if not found then
      raise exception 'Produto não encontrado — recarregue a página.';
    end if;
    if lista @> jsonb_build_array(jsonb_build_object('produtoId', p.id)) then
      raise exception 'Produto repetido no pedido.';
    end if;

    -- Preço da última venda deste produto para a loja; senão, para a rede.
    select (i ->> 'precoUnitario')::numeric
      into preco
      from public.vendas v
      join public.lojas lj on lj.id = v.loja_id
      cross join lateral jsonb_array_elements(v.itens) i
     where lj.rede_id = l.rede_id
       and v.status <> 'cancelado'
       and i ->> 'produtoId' = p.id::text
       and coalesce(i ->> 'natureza', 'venda') = 'venda'
       and coalesce(i ->> 'unidade', '') <> 'un'
       and (i ->> 'precoUnitario')::numeric > 0
     order by (v.loja_id = l.id) desc, v.data desc, v.criado_em desc
     limit 1;
    preco := coalesce(preco, 0);

    lista := lista || jsonb_build_array(jsonb_build_object(
      'produtoId', p.id,
      'qty', qty,
      'precoUnitario', preco,
      'kgPorUnidade', p.kg_por_unidade,
      'kgTotal', round(qty * p.kg_por_unidade, 3),
      'natureza', 'venda'
    ));
    total := total + round(qty * preco, 2);
    kg_total := kg_total + round(qty * p.kg_por_unidade, 3);
  end loop;

  if jsonb_array_length(lista) = 0 then
    raise exception 'O pedido está vazio.';
  end if;

  -- O prazo de sempre desta loja; loja nova começa com 30 dias, como no app.
  select v.prazo_dias into prazo
    from public.vendas v
   where v.loja_id = l.id and v.status <> 'cancelado'
   order by v.data desc, v.criado_em desc
   limit 1;
  prazo := coalesce(prazo, 30);

  -- Dois clientes enviando no mesmo instante não pegam o mesmo número.
  perform pg_advisory_xact_lock(hashtext('vendas.numero'));
  select coalesce(max(v.numero), 0) + 1 into proximo from public.vendas v;

  insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status,
                             origem, observacao, aguardando_conferencia)
  values (nova, proximo, l.id, hoje, prazo, lista, total, kg_total, 'pendente',
          'cliente', nullif(left(trim(coalesce(observacao, '')), 500), ''), true);

  return jsonb_build_object('id', nova, 'numero', proximo);
end;
$$;

commit;

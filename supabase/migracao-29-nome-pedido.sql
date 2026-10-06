-- ============================================================================
--  Migração 29 — nome de quem faz o pedido pelo link
--
--  A página do link de pedido (da loja, migração 21, e da rede, migração 26)
--  passa a EXIGIR o nome da pessoa que está pedindo — o gerente, o
--  encarregado… Ele fica guardado na venda (`vendas.pedido_por`) e aparece na
--  aba Vendas, ao lado de "Pedido do cliente", e na hora de conferir.
--
--  O nome é conferido aqui, no banco: sem ele (ou com menos de 2 letras) o
--  pedido não grava, mesmo que alguém chame a função direto, sem a página.
--  Espaços sobrando são tirados e o nome é cortado em 80 letras.
--
--  Troca a assinatura de três funções (por isso os `drop function`):
--    pedido_cliente_gravar(loja, itens, observacao, nome)   — interna
--    pedido_cliente_enviar(token, itens, observacao, nome)  — link da loja
--    pedido_rede_enviar(token, pedidos, nome)               — link da rede
--  O resto — produtos liberados, preço, prazo, número, freio contra abuso —
--  continua exatamente como na 26.
--
--  Rode ANTES de publicar a versão do app que traz o campo: a página nova
--  manda o nome, e a função antiga não o conhece ("o pedido pelo link ainda
--  não está ativo"). Depois de rodar, a página antiga (celular com a versão
--  velha em cache) recebe "Informe o seu nome" — é só recarregar.
--
--  Depois da migracao-26. Idempotente. Nada é apagado.
-- ============================================================================

begin;

alter table public.vendas add column if not exists pedido_por text;

drop function if exists public.pedido_cliente_enviar(text, jsonb, text);
drop function if exists public.pedido_rede_enviar(text, jsonb);
drop function if exists public.pedido_cliente_gravar(uuid, jsonb, text);

-- Grava o pedido de UMA loja (já conferida pelo chamador), agora com o nome
-- de quem pediu.
create or replace function public.pedido_cliente_gravar(loja uuid, itens jsonb, observacao text, nome text)
returns jsonb
language plpgsql
volatile
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
  permitidos uuid[] := public.pedido_cliente_permitidos(pedido_cliente_gravar.loja);
  quem text := left(regexp_replace(trim(coalesce(pedido_cliente_gravar.nome, '')), '\s+', ' ', 'g'), 80);
begin
  if char_length(quem) < 2 then
    raise exception 'Informe o seu nome para enviar o pedido.';
  end if;

  select lj.id, lj.rede_id, lj.nome into l
    from public.lojas lj
   where lj.id = pedido_cliente_gravar.loja;

  if jsonb_typeof(itens) is distinct from 'array' or jsonb_array_length(itens) = 0 then
    raise exception 'O pedido da loja % está vazio.', l.nome;
  end if;
  if jsonb_array_length(itens) > 50 then
    raise exception 'Itens demais num pedido só.';
  end if;

  if (select count(*) from public.vendas v
       where v.loja_id = l.id and v.origem = 'cliente'
         and v.criado_em > now() - interval '1 hour') >= 10 then
    raise exception 'Muitos pedidos em pouco tempo para a loja %. Aguarde um pouco ou fale com a distribuidora.', l.nome;
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
       and (permitidos is null or pr.id = any (permitidos));
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
    raise exception 'O pedido da loja % está vazio.', l.nome;
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
                             origem, observacao, aguardando_conferencia, pedido_por)
  values (nova, proximo, l.id, hoje, prazo, lista, total, kg_total, 'pendente',
          'cliente', nullif(left(trim(coalesce(observacao, '')), 500), ''), true, quem);

  return jsonb_build_object('id', nova, 'numero', proximo, 'lojaId', l.id, 'loja', l.nome);
end;
$$;

create or replace function public.pedido_cliente_enviar(token text, itens jsonb, observacao text default null, nome text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  loja_id uuid;
begin
  select lj.id into loja_id
    from public.lojas lj
   where lj.token_pedido = pedido_cliente_enviar.token
     and lj.status = 'ativo';

  if not found then
    raise exception 'Link de pedido inválido ou desativado.' using errcode = 'P0002';
  end if;

  return public.pedido_cliente_gravar(loja_id, itens, observacao, pedido_cliente_enviar.nome);
end;
$$;

-- `pedidos` chega como [{ "lojaId": "…", "itens": [...], "observacao": "…" }, …]
-- e `nome` é de quem está pedindo (vale para todas as lojas do envio).
create or replace function public.pedido_rede_enviar(token text, pedidos jsonb, nome text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r record;
  ped jsonb;
  loja_id uuid;
  vistos uuid[] := '{}';
  feitos jsonb := '[]'::jsonb;
begin
  select rd.id into r
    from public.redes rd
   where rd.token_pedido = pedido_rede_enviar.token
     and rd.status = 'ativo';

  if not found then
    raise exception 'Link de pedido inválido ou desativado.' using errcode = 'P0002';
  end if;

  if jsonb_typeof(pedidos) is distinct from 'array' or jsonb_array_length(pedidos) = 0 then
    raise exception 'Nenhuma loja com pedido.';
  end if;
  if jsonb_array_length(pedidos) > 60 then
    raise exception 'Lojas demais num envio só.';
  end if;

  if (select count(*) from public.vendas v
        join public.lojas lj on lj.id = v.loja_id
       where lj.rede_id = r.id and v.origem = 'cliente'
         and v.criado_em > now() - interval '1 hour') + jsonb_array_length(pedidos) > 60 then
    raise exception 'Muitos pedidos em pouco tempo. Aguarde um pouco ou fale com a distribuidora.';
  end if;

  for ped in select * from jsonb_array_elements(pedidos) loop
    select lj.id into loja_id
      from public.lojas lj
     where lj.id::text = ped ->> 'lojaId'
       and lj.rede_id = r.id
       and lj.status = 'ativo';
    if not found then
      raise exception 'Loja não encontrada nesta rede — recarregue a página.';
    end if;
    if loja_id = any(vistos) then
      raise exception 'Loja repetida no envio.';
    end if;
    vistos := vistos || loja_id;

    feitos := feitos || jsonb_build_array(
      public.pedido_cliente_gravar(loja_id, ped -> 'itens', ped ->> 'observacao', pedido_rede_enviar.nome));
  end loop;

  return feitos;
end;
$$;

revoke all on function public.pedido_cliente_gravar(uuid, jsonb, text, text)  from public, anon, authenticated;
revoke all on function public.pedido_cliente_enviar(text, jsonb, text, text)  from public;
revoke all on function public.pedido_rede_enviar(text, jsonb, text)           from public;
grant execute on function public.pedido_cliente_enviar(text, jsonb, text, text) to anon, authenticated;
grant execute on function public.pedido_rede_enviar(text, jsonb, text)          to anon, authenticated;

commit;

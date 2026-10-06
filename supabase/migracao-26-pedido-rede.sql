-- ============================================================================
--  Migração 26 — link de pedido da REDE (várias lojas no mesmo link)
--
--  Além do link de cada loja (migração 21), cada rede ganha um link próprio,
--  para mandar no grupo de WhatsApp com os gerentes das lojas:
--
--      https://seu-app.vercel.app/pedido/rede/7b2e0c…
--
--  Quem abre vê todas as lojas ativas da rede, põe as quantidades de uma ou
--  de várias (Petrox Praia, Petrox Aruana…) e envia tudo de uma vez. Na aba
--  Vendas, cada loja vira um pedido SEPARADO, com número próprio — igual a
--  um pedido feito pelo link da loja: "Pedido do cliente", aguardando
--  conferência, com o preço da última venda e o prazo de sempre.
--
--  Segurança: o mesmo modelo da 21 — nenhuma tabela aberta, só duas funções
--  SECURITY DEFINER que exigem o token da rede, e só gravam para lojas ATIVAS
--  daquela rede. O link da rede é independente do link de cada loja: gerar um
--  novo para a rede não derruba o das lojas, e vice-versa.
--
--  Freio contra abuso: os 10 pedidos por loja por hora da 21 valem aqui
--  também, e o link da rede aceita no máximo 60 pedidos por hora no total.
--
--  Produtos: cada loja vê e pode pedir só o que a migração 23 libera para ela
--  (a lista da loja, ou a da rede, ou todos) — no link da rede também.
--
--  O envio é tudo ou nada: se o pedido de uma loja tiver erro, nenhum grava —
--  o cliente corrige e envia de novo, sem pedido pela metade.
--
--  Depois da migracao-21 e da migracao-23. Idempotente. Nada é apagado.
-- ============================================================================

begin;

-- ─── Token da rede ──────────────────────────────────────────────────────────

alter table public.redes add column if not exists token_pedido text;
update public.redes set token_pedido = public.novo_token_pedido() where token_pedido is null;
alter table public.redes alter column token_pedido set default public.novo_token_pedido();
alter table public.redes alter column token_pedido set not null;
create unique index if not exists redes_token_pedido_idx on public.redes (token_pedido);

-- ─── Peças comuns aos dois links ────────────────────────────────────────────
--
-- Internas: não são liberadas para ninguém. Rodam dentro das funções públicas
-- (SECURITY DEFINER), que já conferiram o token.

-- Os produtos liberados para a loja no link (migração 23): a lista da loja,
-- senão a da rede; null = todos.
create or replace function public.pedido_cliente_permitidos(loja uuid)
returns uuid[]
language sql
stable
set search_path = public
as $$
  select coalesce(lj.produtos_pedido, r.produtos_pedido)
    from public.lojas lj
    join public.redes r on r.id = lj.rede_id
   where lj.id = pedido_cliente_permitidos.loja;
$$;

-- O último pedido da loja (só as quantidades, só o liberado), para o "Repetir".
create or replace function public.pedido_cliente_ultimo(loja uuid, permitidos uuid[])
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
           'data', v.data,
           'itens', coalesce((
             select jsonb_agg(jsonb_build_object('produtoId', i ->> 'produtoId', 'qty', (i ->> 'qty')::numeric))
               from jsonb_array_elements(v.itens) i
              where coalesce(i ->> 'natureza', 'venda') = 'venda'
                and coalesce(i ->> 'unidade', '') <> 'un'
                and (permitidos is null or (i ->> 'produtoId') = any (permitidos::text[]))
           ), '[]'::jsonb))
    from public.vendas v
   where v.loja_id = pedido_cliente_ultimo.loja and v.status <> 'cancelado'
   order by v.data desc, v.criado_em desc
   limit 1;
$$;

-- Os produtos que o cliente pode pedir (null = todos).
create or replace function public.pedido_cliente_produtos(permitidos uuid[])
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id,
           'nome', p.nome,
           'fruta', p.fruta,
           'unidadeVenda', p.unidade_venda,
           'kgPorUnidade', p.kg_por_unidade
         ) order by p.fruta, p.nome), '[]'::jsonb)
    from public.produtos p
   where permitidos is null or p.id = any (permitidos);
$$;

-- Grava o pedido de UMA loja (já conferida pelo chamador). `itens` chega como
-- [{ "produtoId": "…", "qty": 10 }, …]; kg, preço, prazo e número são
-- calculados aqui, nunca confiados ao navegador do cliente.
create or replace function public.pedido_cliente_gravar(loja uuid, itens jsonb, observacao text)
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
begin
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
                             origem, observacao, aguardando_conferencia)
  values (nova, proximo, l.id, hoje, prazo, lista, total, kg_total, 'pendente',
          'cliente', nullif(left(trim(coalesce(observacao, '')), 500), ''), true);

  return jsonb_build_object('id', nova, 'numero', proximo, 'lojaId', l.id, 'loja', l.nome);
end;
$$;

-- ─── Link da loja: agora usa as peças comuns (mesmo comportamento da 21) ────

create or replace function public.pedido_cliente_abrir(token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l record;
  permitidos uuid[];
begin
  select lj.id, lj.nome, r.nome as rede
    into l
    from public.lojas lj
    join public.redes r on r.id = lj.rede_id
   where lj.token_pedido = pedido_cliente_abrir.token
     and lj.status = 'ativo';

  if not found then
    raise exception 'Link de pedido inválido ou desativado.' using errcode = 'P0002';
  end if;

  permitidos := public.pedido_cliente_permitidos(l.id);
  return jsonb_build_object(
    'loja', l.nome,
    'rede', l.rede,
    'produtos', public.pedido_cliente_produtos(permitidos),
    'ultimoPedido', public.pedido_cliente_ultimo(l.id, permitidos)
  );
end;
$$;

create or replace function public.pedido_cliente_enviar(token text, itens jsonb, observacao text default null)
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

  return public.pedido_cliente_gravar(loja_id, itens, observacao);
end;
$$;

-- ─── Link da rede ───────────────────────────────────────────────────────────

create or replace function public.pedido_rede_abrir(token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r record;
  lojas jsonb;
  todos_ids uuid[];
begin
  select rd.id, rd.nome into r
    from public.redes rd
   where rd.token_pedido = pedido_rede_abrir.token
     and rd.status = 'ativo';

  if not found then
    raise exception 'Link de pedido inválido ou desativado.' using errcode = 'P0002';
  end if;

  -- Cada loja com os produtos dela (`produtoIds`, null = todos).
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id,
           'nome', x.nome,
           'produtoIds', to_jsonb(x.permitidos),
           'ultimoPedido', public.pedido_cliente_ultimo(x.id, x.permitidos)
         ) order by x.nome), '[]'::jsonb)
    into lojas
    from (select lj.id, lj.nome, public.pedido_cliente_permitidos(lj.id) as permitidos
            from public.lojas lj
           where lj.rede_id = r.id and lj.status = 'ativo') x;

  -- `produtos` traz uma vez só todo produto que alguma loja pode pedir.
  with x as (select public.pedido_cliente_permitidos(lj.id) as p
               from public.lojas lj
              where lj.rede_id = r.id and lj.status = 'ativo')
  select case when exists (select 1 from x where x.p is null) then null
              else (select array_agg(distinct e) from x, unnest(x.p) e) end
    into todos_ids;

  return jsonb_build_object(
    'rede', r.nome,
    'lojas', lojas,
    'produtos', public.pedido_cliente_produtos(todos_ids)
  );
end;
$$;

-- `pedidos` chega como [{ "lojaId": "…", "itens": [...], "observacao": "…" }, …]
-- e devolve [{ "lojaId", "loja", "numero", "id" }, …] — um por loja.
create or replace function public.pedido_rede_enviar(token text, pedidos jsonb)
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
      public.pedido_cliente_gravar(loja_id, ped -> 'itens', ped ->> 'observacao'));
  end loop;

  return feitos;
end;
$$;

-- ─── Gerar novo link da rede (equipe) ───────────────────────────────────────

create or replace function public.renovar_link_pedido_rede(rede uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  novo text := public.novo_token_pedido();
begin
  if not public.e_gestor() then
    raise exception 'Só sócio master ou assistente geram link novo.';
  end if;
  update public.redes set token_pedido = novo where id = rede;
  if not found then
    raise exception 'Rede não encontrada.';
  end if;
  return novo;
end;
$$;

-- As peças internas ninguém chama direto — só as funções abaixo, como dono.
revoke all on function public.pedido_cliente_permitidos(uuid)           from public, anon, authenticated;
revoke all on function public.pedido_cliente_ultimo(uuid, uuid[])       from public, anon, authenticated;
revoke all on function public.pedido_cliente_produtos(uuid[])           from public, anon, authenticated;
revoke all on function public.pedido_cliente_gravar(uuid, jsonb, text)  from public, anon, authenticated;

revoke all on function public.pedido_cliente_abrir(text)                from public;
revoke all on function public.pedido_cliente_enviar(text, jsonb, text)  from public;
revoke all on function public.pedido_rede_abrir(text)                   from public;
revoke all on function public.pedido_rede_enviar(text, jsonb)           from public;
revoke all on function public.renovar_link_pedido_rede(uuid)            from public, anon;
grant execute on function public.pedido_cliente_abrir(text)               to anon, authenticated;
grant execute on function public.pedido_cliente_enviar(text, jsonb, text) to anon, authenticated;
grant execute on function public.pedido_rede_abrir(text)                  to anon, authenticated;
grant execute on function public.pedido_rede_enviar(text, jsonb)          to anon, authenticated;
grant execute on function public.renovar_link_pedido_rede(uuid)           to authenticated;

commit;

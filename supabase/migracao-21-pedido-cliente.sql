-- ============================================================================
--  Migração 21 — link de pedido para o cliente
--
--  Cada loja ganha um link próprio, que a distribuidora manda pelo WhatsApp:
--
--      https://seu-app.vercel.app/pedido/3f9c1a…
--
--  O cliente abre no celular, SEM login, vê os produtos, põe as quantidades e
--  envia. O pedido cai direto na tabela `vendas` — aparece na aba Vendas do
--  app, marcado como "Pedido do cliente", aguardando conferência.
--
--  Preço: o cliente NÃO vê nem digita preço (cada rede negocia o seu). O
--  pedido já entra com o preço da última venda daquele produto para a mesma
--  loja — ou, na falta, para outra loja da mesma rede. Sem histórico, entra
--  com preço zero. Em qualquer caso, quem confere na aba Vendas ajusta e
--  confirma; só então o pedido deixa de estar "aguardando conferência".
--
--  Segurança: o cliente não ganha acesso a nenhuma tabela. Ele fala só com
--  duas funções SECURITY DEFINER, e só com o token da própria loja:
--
--    pedido_cliente_abrir(token)                   loja, produtos e o último pedido
--    pedido_cliente_enviar(token, itens, obs)      grava o pedido
--
--  O token é longo e aleatório — quem não tem o link não adivinha. Se um link
--  vazar, "Gerar novo link" na ficha da loja (função renovar_link_pedido)
--  troca o token, e o link antigo para de funcionar na hora.
--
--  Loja inativa não recebe pedido pelo link. E há um freio contra abuso: no
--  máximo 10 pedidos pelo link por loja por hora.
--
--  Se a migração 20 (aviso no ntfy) estiver ligada, o pedido do cliente
--  também avisa no celular — rode o migracao-20 de novo depois deste arquivo
--  para o aviso dizer que o pedido veio do cliente.
--
--  Rode ANTES de publicar a versão do app que traz o link: sem as colunas
--  novas em `vendas`, as gravações de venda ficam presas na fila de
--  Sincronização. Depois do auth.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

-- ─── Token da loja ──────────────────────────────────────────────────────────
--
-- 24 caracteres hexadecimais tirados de um uuid aleatório (gen_random_uuid é
-- nativo do Postgres 13+, não depende do pgcrypto).

create or replace function public.novo_token_pedido()
returns text
language sql
volatile
as $$
  select left(replace(gen_random_uuid()::text, '-', ''), 12)
      || left(replace(gen_random_uuid()::text, '-', ''), 12);
$$;

alter table public.lojas add column if not exists token_pedido text;
update public.lojas set token_pedido = public.novo_token_pedido() where token_pedido is null;
alter table public.lojas alter column token_pedido set default public.novo_token_pedido();
alter table public.lojas alter column token_pedido set not null;
create unique index if not exists lojas_token_pedido_idx on public.lojas (token_pedido);

-- ─── Vendas: de onde veio o pedido ──────────────────────────────────────────
--
--   origem                  'app' (lançado pela equipe) ou 'cliente' (pelo link)
--   observacao              o recado que o cliente escreveu junto do pedido
--   aguardando_conferencia  pedido do link que ninguém conferiu ainda

alter table public.vendas add column if not exists origem text not null default 'app';
alter table public.vendas add column if not exists observacao text;
alter table public.vendas add column if not exists aguardando_conferencia boolean not null default false;

alter table public.vendas drop constraint if exists vendas_origem_check;
alter table public.vendas add constraint vendas_origem_check check (origem in ('app', 'cliente'));

create index if not exists vendas_aguardando_conferencia_idx
  on public.vendas (criado_em) where aguardando_conferencia;

-- Produtos que aparecem no link de cada cliente (migracao-23). Criadas aqui
-- também para as funções abaixo valerem rodando a 21 sozinha ou de novo.
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

-- ─── Gerar novo link (equipe) ───────────────────────────────────────────────

create or replace function public.renovar_link_pedido(loja uuid)
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
  update public.lojas set token_pedido = novo where id = loja;
  if not found then
    raise exception 'Loja não encontrada.';
  end if;
  return novo;
end;
$$;

revoke all on function public.pedido_cliente_abrir(text)                from public;
revoke all on function public.pedido_cliente_enviar(text, jsonb, text)  from public;
revoke all on function public.renovar_link_pedido(uuid)                 from public, anon;
grant execute on function public.pedido_cliente_abrir(text)               to anon, authenticated;
grant execute on function public.pedido_cliente_enviar(text, jsonb, text) to anon, authenticated;
grant execute on function public.renovar_link_pedido(uuid)                to authenticated;

commit;

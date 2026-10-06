-- ============================================================================
--  Migração 01 — de «clientes» para «rede → loja»
--
--  Leva o banco do modelo antigo (cliente plano, produto de unidade única,
--  venda sem prazo) para o modelo da planilha de gestão. NADA é apagado:
--  cada cliente existente vira uma loja, dentro de uma rede de mesmo nome.
--
--  Como aplicar, SEMPRE NESTA ORDEM — mesmo em projeto novo, sem tabela
--  `clientes`:
--    1. schema.sql              cria redes, lojas, fornecedores, produtos, vendas
--    2. migracao-01 (este)      move os dados, acrescenta as colunas novas e
--                                cria as views de relatório (vw_venda_itens,
--                                vw_contas_receber)
--
--  As views ficam aqui, e não no schema.sql: elas leem loja_id/prazo_dias/
--  vencimento em vendas, colunas que só existem depois do passo 3 abaixo.
--  Criá-las no schema.sql quebraria a atualização de um banco com o modelo
--  antigo, que ainda não tem essas colunas na hora em que aquele script roda.
--
--  Idempotente: rodar de novo não duplica nada.
--  Faça um backup antes (Supabase → Database → Backups) — é rápido e evita dor.
-- ============================================================================

begin;

-- ─── 1. Clientes viram lojas ────────────────────────────────────────────────
--
--  O modelo antigo não tinha rede. Cada cliente vira uma rede de um nome só,
--  com uma loja MATRIZ dentro. Depois, na tela de Clientes do app, você agrupa
--  as lojas que na verdade pertencem à mesma rede.

do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'clientes') then

    -- Uma rede por cliente, reaproveitando o id para a ligação ficar óbvia.
    insert into public.redes (id, nome, telefone, status, criado_em)
    select c.id, c.nome, c.telefone, c.status, c.criado_em
    from public.clientes c
    on conflict (id) do nothing;

    -- A loja MATRIZ de cada uma, com o endereço antigo virando cidade.
    insert into public.lojas (rede_id, nome, cidade, telefone, status, criado_em)
    select c.id, 'MATRIZ', c.endereco, c.telefone, c.status, c.criado_em
    from public.clientes c
    on conflict (rede_id, lower(nome)) do nothing;

  end if;
end;
$$;

-- ─── 2. Produtos ganham unidade de venda e fator de conversão ───────────────

alter table public.produtos add column if not exists fruta          text;
alter table public.produtos add column if not exists unidade_venda  text;
alter table public.produtos add column if not exists kg_por_unidade numeric(10,3);

-- Tudo que existia era vendido por unidade simples: vira agranel, fator 1.
update public.produtos
   set unidade_venda  = coalesce(unidade_venda, 'kg'),
       kg_por_unidade = coalesce(kg_por_unidade, 1),
       fruta          = coalesce(fruta, 'Laranja Pera')
 where unidade_venda is null or kg_por_unidade is null or fruta is null;

alter table public.produtos alter column fruta          set default 'Laranja Pera';
alter table public.produtos alter column unidade_venda  set default 'kg';
alter table public.produtos alter column kg_por_unidade set default 1;
alter table public.produtos alter column fruta          set not null;
alter table public.produtos alter column unidade_venda  set not null;
alter table public.produtos alter column kg_por_unidade set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'produtos_agranel_fator_um') then
    alter table public.produtos add constraint produtos_agranel_fator_um
      check (unidade_venda <> 'kg' or kg_por_unidade = 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'produtos_unidade_venda_check') then
    alter table public.produtos add constraint produtos_unidade_venda_check
      check (unidade_venda in ('kg', 'saco'));
  end if;
end;
$$;

create index if not exists produtos_fruta_idx on public.produtos (fruta);

-- `categoria` e `unidade` do modelo antigo não são mais usadas. Ficam onde
-- estão, sem atrapalhar — apague só quando tiver certeza:
--   alter table public.produtos drop column if exists categoria;
--   alter table public.produtos drop column if exists unidade;

-- ─── 3. Vendas ganham loja, prazo, vencimento e quilos ──────────────────────

alter table public.vendas add column if not exists loja_id    uuid references public.lojas (id) on delete set null;
alter table public.vendas add column if not exists prazo_dias integer not null default 0;
alter table public.vendas add column if not exists kg_total   numeric(12,3) not null default 0;

-- Aponta cada venda para a loja MATRIZ da rede que veio do cliente antigo.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'vendas'
               and column_name = 'cliente_id') then
    update public.vendas v
       set loja_id = l.id
      from public.lojas l
     where l.rede_id = v.cliente_id
       and lower(l.nome) = 'matriz'
       and v.loja_id is null;
  end if;
end;
$$;

-- vencimento = data + prazo. Coluna gerada: derivada, nunca digitada.
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'vendas'
                   and column_name = 'vencimento') then
    alter table public.vendas
      add column vencimento date generated always as (data + prazo_dias) stored;
  end if;
end;
$$;

-- ─── 4. Itens de venda ganham conversão e natureza ──────────────────────────
--
--  Antes:  { produtoId, qty, preco }
--  Agora:  { produtoId, qty, precoUnitario, kgPorUnidade, kgTotal, natureza }

update public.vendas v
   set itens = (
     select jsonb_agg(
       jsonb_build_object(
         'produtoId',     item ->> 'produtoId',
         'qty',           coalesce((item ->> 'qty')::numeric, 0),
         'precoUnitario', coalesce((item ->> 'precoUnitario')::numeric,
                                   (item ->> 'preco')::numeric, 0),
         'kgPorUnidade',  coalesce((item ->> 'kgPorUnidade')::numeric,
                                   p.kg_por_unidade, 1),
         'kgTotal',       coalesce((item ->> 'kgTotal')::numeric,
                                   (item ->> 'qty')::numeric * coalesce(p.kg_por_unidade, 1), 0),
         'natureza',      coalesce(item ->> 'natureza', 'venda')
       )
     )
     from jsonb_array_elements(v.itens) as item
     left join public.produtos p on p.id = (item ->> 'produtoId')::uuid
   )
 where jsonb_array_length(v.itens) > 0
   and not (v.itens -> 0 ? 'natureza');   -- só o que ainda está no formato antigo

-- Recalcula o total em quilos a partir dos itens já convertidos.
update public.vendas v
   set kg_total = coalesce((
     select sum((item ->> 'kgTotal')::numeric)
     from jsonb_array_elements(v.itens) as item
   ), 0)
 where kg_total = 0;

-- ─── 5. Índices novos ───────────────────────────────────────────────────────

create index if not exists vendas_loja_idx       on public.vendas (loja_id);
create index if not exists vendas_vencimento_idx on public.vendas (vencimento);
create index if not exists vendas_vencidas_idx
  on public.vendas (vencimento) where status = 'pendente';

-- ─── 6. Views de relatório ───────────────────────────────────────────────────
--
--  Só podem ser criadas agora: dependem de loja_id, prazo_dias e vencimento,
--  que acabaram de ser acrescentadas a vendas no passo 3.
--
--  `drop view` antes do `create`: a ordem das colunas mudou bastante em
--  relação à vw_venda_itens antiga (que já existia, do modelo de clientes),
--  e o Postgres não deixa um `create or replace view` renomear ou reordenar
--  colunas existentes — só apagando e recriando.

drop view if exists public.vw_venda_itens;

create or replace view public.vw_venda_itens as
select
  v.id                                  as venda_id,
  v.numero,
  v.data,
  v.vencimento,
  v.status,
  v.loja_id,
  l.rede_id,
  (item ->> 'produtoId')::uuid          as produto_id,
  coalesce(item ->> 'natureza', 'venda') as natureza,
  (item ->> 'qty')::numeric             as quantidade,
  (item ->> 'kgTotal')::numeric         as kg,
  (item ->> 'precoUnitario')::numeric   as preco_unitario,
  (item ->> 'qty')::numeric * (item ->> 'precoUnitario')::numeric as subtotal
from public.vendas v
left join public.lojas l on l.id = v.loja_id
cross join lateral jsonb_array_elements(v.itens) as item;

alter view public.vw_venda_itens set (security_invoker = on);

-- O que a planilha nunca teve: a pendência com data de vencimento e os dias
-- de atraso calculados.
create or replace view public.vw_contas_receber as
select
  v.id                                as venda_id,
  v.numero,
  v.data,
  v.prazo_dias,
  v.vencimento,
  v.total,
  l.nome                              as loja,
  r.nome                              as rede,
  r.id                                as rede_id,
  (current_date - v.vencimento)       as dias_atraso,
  current_date > v.vencimento         as vencida
from public.vendas v
left join public.lojas l on l.id = v.loja_id
left join public.redes r on r.id = l.rede_id
where v.status = 'pendente';

alter view public.vw_contas_receber set (security_invoker = on);

grant select on public.vw_venda_itens, public.vw_contas_receber to anon, authenticated;

-- Exemplo de uso: faturamento por rede no mês, sem contar bonificação
--   select rede_id, sum(subtotal) as receita, sum(kg) as quilos
--   from public.vw_venda_itens
--   where status <> 'cancelado' and natureza = 'venda'
--     and data >= date_trunc('month', current_date)
--   group by rede_id order by receita desc;

commit;

-- ─── 7. Só depois de conferir tudo no app ───────────────────────────────────
--
--  Confira na tela de Clientes que as redes e lojas apareceram, e em Vendas
--  que os pedidos antigos continuam ligados ao cliente certo. Aí sim:
--
--    alter table public.vendas drop column if exists cliente_id;
--    drop table if exists public.clientes;

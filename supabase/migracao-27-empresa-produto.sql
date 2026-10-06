-- ============================================================================
--  Migração 27 — empresa do produto e frutas novas
--
--  Dois ajustes para vender frutas de revenda sem misturá-las com a produção
--  própria:
--
--  1. `produtos.empresa` — por qual empresa o produto é vendido:
--
--        carvalho_cruz   Carvalho Cruz (o padrão; todos os produtos atuais)
--        cvc             CVC
--
--     A receita de cada item de venda conta para a empresa do produto, e a
--     compra de cada fruta para a empresa dos produtos dela. O app separa o
--     DRE por empresa no Painel e no Financeiro; a view vw_receita_empresa_mes
--     faz a mesma conta aqui no banco.
--
--  2. Frutas livres — até aqui `fruta` só aceitava Laranja Pera, Laranja Lima
--     e Abóbora (check em produtos, compras, perdas e acertos). A fruta nova
--     nasce no cadastro de produto do app; este arquivo tira a trava e refaz
--     a vw_estoque_fruta para listar toda fruta que aparece no banco.
--
--  Rode ANTES de publicar a versão do app que traz o campo Empresa: sem a
--  coluna, as gravações de produto ficam presas na fila de Sincronização.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

-- ─── 1. Empresa do produto ──────────────────────────────────────────────────

alter table public.produtos
  add column if not exists empresa text not null default 'carvalho_cruz';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.produtos'::regclass and conname = 'produtos_empresa_check'
  ) then
    alter table public.produtos
      add constraint produtos_empresa_check check (empresa in ('carvalho_cruz', 'cvc'));
  end if;
end $$;

create index if not exists produtos_empresa_idx on public.produtos (empresa);

-- ─── 2. Frutas livres ───────────────────────────────────────────────────────
--
--  Os checks nasceram sem nome no schema.sql (o Postgres chama de
--  <tabela>_fruta_check), mas um banco antigo pode ter outro nome. Por isso
--  a busca é pela definição: todo check dessas tabelas que fala de `fruta`.
--  A fruta continua obrigatória (not null) — só deixa de ser uma lista fixa.

do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass as tabela, c.conname
      from pg_constraint c
     where c.contype = 'c'
       and c.conrelid in ('public.produtos'::regclass, 'public.compras'::regclass,
                          'public.perdas'::regclass,   'public.acertos'::regclass)
       and pg_get_constraintdef(c.oid) ilike '%fruta%'
       and c.conname not like '%_fruta_preenchida'
  loop
    execute format('alter table %s drop constraint %I', r.tabela, r.conname);
  end loop;
end $$;

-- Fruta em branco não é fruta.
do $$
declare
  t text;
begin
  foreach t in array array['produtos', 'compras', 'perdas', 'acertos'] loop
    if not exists (
      select 1 from pg_constraint
       where conrelid = format('public.%I', t)::regclass and conname = t || '_fruta_preenchida'
    ) then
      execute format('alter table public.%I add constraint %I check (btrim(fruta) <> '''')',
                     t, t || '_fruta_preenchida');
    end if;
  end loop;
end $$;

-- ─── Estoque por fruta ──────────────────────────────────────────────────────
--
--  A mesma conta da migração 05 (compras − vendas − perdas + acertos). Só a
--  lista de frutas mudou: as três de sempre, mais toda fruta que aparece em
--  produtos, compras, perdas ou acertos. Mesmas colunas, na mesma ordem.

create or replace view public.vw_estoque_fruta as
with frutas as (
  select unnest(array['Laranja Pera', 'Laranja Lima', 'Abóbora']) as fruta
  union select fruta from public.produtos
  union select fruta from public.compras
  union select fruta from public.perdas
  union select fruta from public.acertos
),
entradas as (
  select fruta, sum(peso_kg) as kg
  from public.compras
  group by fruta
),
saidas as (
  select
    p.fruta,
    sum((item ->> 'kgTotal')::numeric) as kg,
    sum((item ->> 'kgTotal')::numeric)
      filter (where coalesce(item ->> 'natureza', 'venda') = 'bonificacao') as kg_bonificado
  from public.vendas v
  cross join lateral jsonb_array_elements(v.itens) as item
  join public.produtos p on p.id = (item ->> 'produtoId')::uuid
  where v.status <> 'cancelado'
  group by p.fruta
),
perdido as (
  select fruta, sum(kg) as kg
  from public.perdas
  group by fruta
),
acertado as (
  select fruta, sum(ajuste) as kg
  from public.acertos
  group by fruta
)
select
  f.fruta,
  coalesce(e.kg, 0)            as entradas_kg,
  coalesce(s.kg, 0)            as vendas_kg,
  coalesce(s.kg_bonificado, 0) as bonificado_kg,
  coalesce(pd.kg, 0)           as perdas_kg,
  coalesce(ac.kg, 0)           as acertos_kg,
  coalesce(e.kg, 0) - coalesce(s.kg, 0) - coalesce(pd.kg, 0) + coalesce(ac.kg, 0) as estoque_kg,
  coalesce(e.kg, 0) - coalesce(s.kg, 0) - coalesce(pd.kg, 0) + coalesce(ac.kg, 0) < 0 as negativo
from frutas f
left join entradas e  on e.fruta  = f.fruta
left join saidas   s  on s.fruta  = f.fruta
left join perdido  pd on pd.fruta = f.fruta
left join acertado ac on ac.fruta = f.fruta;

alter view public.vw_estoque_fruta set (security_invoker = on);

-- ─── Receita e mercadoria por empresa, mês a mês ────────────────────────────
--
--  A mesma separação do app: a receita pela empresa do produto (sem
--  bonificação, sem venda cancelada), a mercadoria pela empresa da fruta.
--  Uma fruta pertence a uma empresa só — o app não deixa uma fruta ganhar
--  produto das duas; se acontecer por fora do app, vale a Carvalho Cruz.
--  Despesas, combustível e folha são da operação inteira e não entram aqui.

create or replace view public.vw_receita_empresa_mes as
with receita as (
  select
    date_trunc('month', v.data)::date as mes,
    p.empresa,
    sum((item ->> 'qty')::numeric * coalesce(item ->> 'precoUnitario', item ->> 'preco')::numeric) as receita,
    sum((item ->> 'kgTotal')::numeric) as kg_vendido
  from public.vendas v
  cross join lateral jsonb_array_elements(v.itens) as item
  join public.produtos p on p.id = (item ->> 'produtoId')::uuid
  where v.status <> 'cancelado'
    and coalesce(item ->> 'natureza', 'venda') <> 'bonificacao'
  group by 1, 2
),
empresa_da_fruta as (
  select fruta, case when bool_and(empresa = 'cvc') then 'cvc' else 'carvalho_cruz' end as empresa
  from public.produtos
  group by fruta
),
mercadoria as (
  select
    date_trunc('month', c.data)::date as mes,
    coalesce(ef.empresa, 'carvalho_cruz') as empresa,
    sum(c.total)   as mercadoria,
    sum(c.peso_kg) as kg_comprado
  from public.compras c
  left join empresa_da_fruta ef on ef.fruta = c.fruta
  group by 1, 2
)
select
  coalesce(r.mes, m.mes)           as mes,
  coalesce(r.empresa, m.empresa)   as empresa,
  coalesce(r.receita, 0)           as receita,
  coalesce(m.mercadoria, 0)        as mercadoria,
  coalesce(r.receita, 0) - coalesce(m.mercadoria, 0) as margem_bruta,
  coalesce(r.kg_vendido, 0)        as kg_vendido,
  coalesce(m.kg_comprado, 0)       as kg_comprado
from receita r
full join mercadoria m on m.mes = r.mes and m.empresa = r.empresa;

alter view public.vw_receita_empresa_mes set (security_invoker = on);

grant select on public.vw_estoque_fruta, public.vw_receita_empresa_mes to anon, authenticated;

commit;

-- Confira:
--   select empresa, count(*) from public.produtos group by empresa;
--   select * from public.vw_receita_empresa_mes order by mes, empresa;
--   select * from public.vw_estoque_fruta order by fruta;

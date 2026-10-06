-- ============================================================================
--  Migração 07 — folha de diaristas e funcionários por nome
--
--  As tabelas `funcionarios` e `pagamentos` já vêm do schema.sql. Este
--  arquivo cria as views que fecham o mês e a pessoa:
--
--    vw_pagamentos_pessoa   total pago e lançamentos, por pessoa
--    vw_folha_mes           total pago, por mês e por tipo (Diarista/Funcionário)
--    vw_dre_mes             passa a somar a folha junto de despesas
--
--  Como aplicar, NESTA ORDEM:
--    1. schema.sql
--    2. migracao-01-redes-lojas.sql
--    3. migracao-02-compras.sql
--    4. migracao-03-perdas-estoque.sql
--    5. migracao-04-despesas-dre.sql
--    5b. migracao-05-acertos.sql
--    5c. migracao-06-combustivel.sql
--    6. migracao-07-folha-pagamento.sql (este)
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

-- ─── Pagamentos por pessoa ──────────────────────────────────────────────────

create or replace view public.vw_pagamentos_pessoa as
select
  f.id             as funcionario_id,
  f.nome,
  f.tipo,
  f.status,
  count(p.id)      as lancamentos,
  coalesce(sum(p.valor), 0) as total,
  max(p.data)      as ultimo_pagamento
from public.funcionarios f
left join public.pagamentos p on p.funcionario_id = f.id
group by f.id, f.nome, f.tipo, f.status;

alter view public.vw_pagamentos_pessoa set (security_invoker = on);

-- ─── Folha por mês e tipo ───────────────────────────────────────────────────

create or replace view public.vw_folha_mes as
select
  date_trunc('month', p.data)::date as mes,
  f.tipo,
  count(*)         as lancamentos,
  sum(p.valor)     as total
from public.pagamentos p
join public.funcionarios f on f.id = p.funcionario_id
group by 1, 2;

alter view public.vw_folha_mes set (security_invoker = on);

-- ─── DRE por mês, agora com a folha ─────────────────────────────────────────
--
--  Diarista e funcionário são despesa — só que por nome em vez de descrição
--  livre, por isso vivem em tabela própria. Refaz a mesma conta da migração
--  06, só acrescentando `pagamentos` à CTE `despesa`.

create or replace view public.vw_dre_mes as
with receita as (
  select date_trunc('month', data)::date as mes, sum(subtotal) as valor
  from public.vw_venda_itens
  where status <> 'cancelado' and natureza = 'venda'
  group by 1
),
quilos as (
  select date_trunc('month', data)::date as mes, sum(kg) as kg
  from public.vw_venda_itens
  where status <> 'cancelado' and natureza = 'venda'
  group by 1
),
despesa as (
  select mes, sum(valor) as valor from (
    select date_trunc('month', data)::date as mes, valor from public.despesas
    union all
    select date_trunc('month', data)::date as mes, valor from public.abastecimentos
    union all
    select date_trunc('month', data)::date as mes, valor from public.pagamentos
  ) t
  group by 1
),
mercadoria as (
  select date_trunc('month', data)::date as mes, sum(total) as valor, sum(peso_kg) as kg
  from public.compras
  group by 1
),
meses as (
  select mes from receita
  union select mes from despesa
  union select mes from mercadoria
)
select
  m.mes,
  coalesce(r.valor, 0)                                              as receita,
  coalesce(d.valor, 0)                                              as despesas,
  coalesce(c.valor, 0)                                              as mercadoria,
  coalesce(r.valor, 0) - coalesce(d.valor, 0) - coalesce(c.valor, 0) as resultado,
  case when coalesce(r.valor, 0) > 0
       then (coalesce(r.valor, 0) - coalesce(d.valor, 0) - coalesce(c.valor, 0))
            / r.valor * 100
       else 0 end                                                   as margem_pct,
  coalesce(q.kg, 0)                                                 as kg_vendidos,
  case when coalesce(q.kg, 0) > 0 then r.valor / q.kg else 0 end     as preco_medio_kg,
  case when coalesce(c.kg, 0) > 0 then c.valor / c.kg else 0 end     as custo_medio_kg
from meses m
left join receita    r on r.mes = m.mes
left join quilos     q on q.mes = m.mes
left join despesa    d on d.mes = m.mes
left join mercadoria c on c.mes = m.mes
order by m.mes;

alter view public.vw_dre_mes set (security_invoker = on);

grant select
  on public.vw_pagamentos_pessoa, public.vw_folha_mes, public.vw_dre_mes
  to anon, authenticated;

commit;

-- Confira:  select * from public.vw_pagamentos_pessoa order by total desc;

-- ============================================================================
--  Migração 04 — despesas e o DRE
--
--  A tabela `despesas` já vem do schema.sql. Este arquivo cria as views que
--  fecham o mês:
--
--    vw_despesas_mes   quanto saiu de cada categoria, mês a mês
--    vw_dre_mes        receita − despesas − mercadoria = resultado
--
--  Como aplicar, NESTA ORDEM:
--    1. schema.sql
--    2. migracao-01-redes-lojas.sql
--    3. migracao-02-compras.sql
--    4. migracao-03-perdas-estoque.sql
--    5. migracao-04-despesas-dre.sql (este)
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

-- ─── Despesas por mês e categoria ───────────────────────────────────────────

create or replace view public.vw_despesas_mes as
select
  date_trunc('month', data)::date as mes,
  categoria,
  count(*)                        as lancamentos,
  sum(valor)                      as total
from public.despesas
group by 1, 2;

alter view public.vw_despesas_mes set (security_invoker = on);

-- ─── DRE por mês ────────────────────────────────────────────────────────────
--
--  A mesma conta da aba DRE da planilha:
--
--      resultado = receita − despesas − mercadoria
--
--  Três escolhas que copiam o método da planilha, de propósito:
--
--  1. RECEITA não conta bonificação. Mercadoria entregue sem cobrar não é
--     faturamento — e é por isso que `natureza = 'venda'` está no filtro.
--
--  2. MERCADORIA é o que foi COMPRADO no mês, não o custo do que foi vendido.
--     Não é CMV contábil: é caixa. Um mês em que se compra a safra inteira
--     fecha no vermelho mesmo vendendo bem, e foi exatamente o que aconteceu
--     em agosto. Trocar isso por CMV mudaria os números que você conhece.
--
--  3. PERDA não entra. A fruta perdida já foi paga quando entrou, e está
--     dentro de MERCADORIA — somá-la de novo contaria o prejuízo duas vezes.
--     Ela aparece à parte, em vw_perdas_fruta e na tela de Estoque.
--
--  Venda cancelada não entra em nada.

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
  select date_trunc('month', data)::date as mes, sum(valor) as valor
  from public.despesas
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

grant select on public.vw_despesas_mes, public.vw_dre_mes to anon, authenticated;

commit;

-- Confira:  select * from public.vw_dre_mes;
--
-- Com o histórico importado, agosto tem de fechar em −R$ 41.301,72 e setembro
-- em R$ 19.248,67 — só depois que as vendas de junho a setembro entrarem. Até
-- lá a receita está vazia e o resultado aparece negativo pelo valor das
-- compras, que é o correto: a mercadoria entrou, a venda ainda não foi lançada.

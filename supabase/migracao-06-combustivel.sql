-- ============================================================================
--  Migração 06 — combustível e veículos
--
--  As tabelas `veiculos` e `abastecimentos` já vêm do schema.sql. Este arquivo
--  cria as views que fecham o quilômetro e o mês:
--
--    vw_abastecimentos     cada abastecimento com km rodado, km/l e custo/km
--    vw_combustivel_mes    litros e valor gasto, mês a mês
--    vw_dre_mes            passa a somar combustível junto de despesas
--
--  Como aplicar, NESTA ORDEM:
--    1. schema.sql
--    2. migracao-01-redes-lojas.sql
--    3. migracao-02-compras.sql
--    4. migracao-03-perdas-estoque.sql
--    5. migracao-04-despesas-dre.sql
--    5b. migracao-05-acertos.sql
--    6. migracao-06-combustivel.sql (este)
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

-- ─── Abastecimentos, com quilometragem ──────────────────────────────────────
--
--  Km rodado NÃO é a dupla KM INICIAL / KM FINAL da planilha — é a diferença
--  para o km atual do abastecimento ANTERIOR do mesmo veículo, na ordem em que
--  os abastecimentos aconteceram. `lag()` faz exatamente essa "olhada para
--  trás" por veículo. O primeiro abastecimento de cada veículo, ou um km atual
--  menor ou igual ao anterior (erro de digitação), fica sem quilometragem —
--  mesma regra do app offline, em abastecimentosComKm().

create or replace view public.vw_abastecimentos as
select
  a.id,
  a.data,
  a.veiculo_id,
  v.nome as veiculo,
  a.motorista,
  a.tipo_combustivel,
  a.km_atual,
  a.litros,
  a.preco_litro,
  a.valor,
  case
    when a.km_atual > lag(a.km_atual) over (partition by a.veiculo_id order by a.data, a.criado_em)
      then a.km_atual - lag(a.km_atual) over (partition by a.veiculo_id order by a.data, a.criado_em)
    else null
  end as km_rodado,
  a.criado_em
from public.abastecimentos a
left join public.veiculos v on v.id = a.veiculo_id;

alter view public.vw_abastecimentos set (security_invoker = on);

-- km/l e custo/km são funções do km_rodado acima — ficam numa segunda view em
-- vez de repetir o `case` duas vezes na primeira.

create or replace view public.vw_abastecimentos_km as
select
  *,
  case when km_rodado > 0 and litros > 0 then km_rodado / litros else null end as km_por_litro,
  case when km_rodado > 0 then valor / km_rodado else null end as custo_por_km
from public.vw_abastecimentos;

alter view public.vw_abastecimentos_km set (security_invoker = on);

-- ─── Combustível por mês ────────────────────────────────────────────────────

create or replace view public.vw_combustivel_mes as
select
  date_trunc('month', data)::date as mes,
  count(*)                        as abastecimentos,
  sum(litros)                     as litros,
  sum(valor)                      as valor
from public.abastecimentos
group by 1;

alter view public.vw_combustivel_mes set (security_invoker = on);

-- ─── DRE por mês, agora com combustível ─────────────────────────────────────
--
--  Combustível é despesa — só que com quilometragem em vez de descrição
--  livre, por isso vive em tabela própria. Refaz a mesma conta da migração
--  04, só trocando a CTE `despesa` para somar as duas fontes.

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
  on public.vw_abastecimentos, public.vw_abastecimentos_km, public.vw_combustivel_mes, public.vw_dre_mes
  to anon, authenticated;

commit;

-- Confira:  select * from public.vw_abastecimentos_km order by veiculo, data;
--
-- Km/l e custo/km ficam em branco no primeiro abastecimento de cada veículo —
-- só existe "km rodado" a partir do segundo, quando há um km anterior para
-- comparar.

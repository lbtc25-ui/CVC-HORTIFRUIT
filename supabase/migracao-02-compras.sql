-- ============================================================================
--  Migração 02 — compras de mercadoria e estoque por fruta
--
--  A tabela `compras` já vem do schema.sql. Este arquivo cria as duas views
--  que dependem de colunas que a migração 01 acrescenta (produtos.fruta):
--
--    vw_compras_fruta   quanto entrou de cada fruta e a que custo por quilo
--    vw_estoque_fruta   entradas − saídas, o estoque de verdade
--
--  Como aplicar, NESTA ORDEM:
--    1. schema.sql
--    2. migracao-01-redes-lojas.sql
--    3. migracao-02-compras.sql (este)
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

-- ─── Custo de compra por fruta ──────────────────────────────────────────────
--
--  O custo médio é a divisão, não a média das médias: soma o que foi pago e
--  divide pelo que foi comprado. Uma compra de 329 t a R$ 0,60 pesa muito mais
--  na conta do que uma de 18 t a R$ 0,78, e é assim que tem de pesar.

create or replace view public.vw_compras_fruta as
select
  fruta,
  count(*)                                          as compras,
  sum(peso_kg)                                      as kg_comprado,
  sum(total)                                        as valor_total,
  case when sum(peso_kg) > 0
       then sum(total) / sum(peso_kg)
       else 0 end                                   as custo_medio_kg,
  min(data)                                         as primeira_compra,
  max(data)                                         as ultima_compra
from public.compras
group by fruta;

alter view public.vw_compras_fruta set (security_invoker = on);

-- ─── Estoque por fruta ──────────────────────────────────────────────────────
--
--  O estoque deixa de ser um número digitado e vira uma conta.
--
--  Entra: o que foi comprado.
--  Sai:   tudo que foi entregue — inclusive a bonificação, que não gera
--         receita mas esvazia o caminhão igual.
--
--  Compra-se fruta e vende-se produto: os sacos de 2,5 kg e o agranel saem do
--  mesmo estoque de laranja pera. Por isso a saída passa por produtos.fruta.
--
--  Venda cancelada não movimenta nada.

create or replace view public.vw_estoque_fruta as
with frutas as (
  select unnest(array['Laranja Pera', 'Laranja Lima', 'Abóbora']) as fruta
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
)
select
  f.fruta,
  coalesce(e.kg, 0)                          as entradas_kg,
  coalesce(s.kg, 0)                          as saidas_kg,
  coalesce(s.kg_bonificado, 0)               as bonificado_kg,
  coalesce(e.kg, 0) - coalesce(s.kg, 0)      as estoque_kg,
  coalesce(e.kg, 0) - coalesce(s.kg, 0) < 0  as negativo
from frutas f
left join entradas e on e.fruta = f.fruta
left join saidas   s on s.fruta = f.fruta;

alter view public.vw_estoque_fruta set (security_invoker = on);

grant select on public.vw_compras_fruta, public.vw_estoque_fruta to anon, authenticated;

commit;

-- Exemplo: margem por fruta, comparando o que se vendeu com o que se comprou
--   select c.fruta, c.custo_medio_kg,
--          sum(i.subtotal) / nullif(sum(i.kg), 0) as preco_medio_kg
--   from public.vw_compras_fruta c
--   join public.produtos p on p.fruta = c.fruta
--   join public.vw_venda_itens i on i.produto_id = p.id
--   where i.status <> 'cancelado' and i.natureza = 'venda'
--   group by c.fruta, c.custo_medio_kg;

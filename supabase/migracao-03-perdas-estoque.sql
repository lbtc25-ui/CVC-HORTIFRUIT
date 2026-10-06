-- ============================================================================
--  Migração 03 — perdas e o estoque como conta
--
--  A tabela `perdas` já vem do schema.sql. Este arquivo refaz a view de
--  estoque para descontar a perda, e cria a view de perdas por fruta.
--
--  É aqui que o estoque deixa de ser um número digitado:
--
--      estoque = compras − vendas − perdas
--
--  Quando o saldo estiver errado, o erro está num lançamento — e dá para achar
--  qual. Era exatamente o que faltava para explicar a abóbora com −50,40 kg na
--  planilha: vendeu-se mais do que entrou, e não havia onde procurar.
--
--  Como aplicar, NESTA ORDEM:
--    1. schema.sql
--    2. migracao-01-redes-lojas.sql
--    3. migracao-02-compras.sql
--    4. migracao-03-perdas-estoque.sql (este)
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

-- ─── Perdas por fruta ───────────────────────────────────────────────────────

create or replace view public.vw_perdas_fruta as
select
  fruta,
  count(*)        as ocorrencias,
  sum(kg)         as kg_perdido,
  sum(valor)      as valor_perdido
from public.perdas
group by fruta;

alter view public.vw_perdas_fruta set (security_invoker = on);

-- ─── Estoque por fruta ──────────────────────────────────────────────────────
--
--  Entra: o que foi comprado.
--  Sai:   o que foi entregue — inclusive a bonificação, que não gera receita
--         mas esvazia o caminhão igual — e o que se perdeu.
--
--  Compra-se fruta e vende-se produto: os sacos de 2,5 kg e o agranel saem do
--  mesmo estoque de laranja pera. Por isso a saída passa por produtos.fruta.
--
--  Venda cancelada não movimenta nada.
--
--  `drop` antes de recriar: a view ganhou colunas no meio, e o Postgres não
--  deixa reordenar colunas de uma view existente com `create or replace`.

drop view if exists public.vw_estoque_fruta;

create view public.vw_estoque_fruta as
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
),
perdido as (
  select fruta, sum(kg) as kg
  from public.perdas
  group by fruta
)
select
  f.fruta,
  coalesce(e.kg, 0)                      as entradas_kg,
  coalesce(s.kg, 0)                      as vendas_kg,
  coalesce(s.kg_bonificado, 0)           as bonificado_kg,
  coalesce(pd.kg, 0)                     as perdas_kg,
  coalesce(e.kg, 0) - coalesce(s.kg, 0) - coalesce(pd.kg, 0) as estoque_kg,
  coalesce(e.kg, 0) - coalesce(s.kg, 0) - coalesce(pd.kg, 0) < 0 as negativo
from frutas f
left join entradas e  on e.fruta  = f.fruta
left join saidas   s  on s.fruta  = f.fruta
left join perdido  pd on pd.fruta = f.fruta;

alter view public.vw_estoque_fruta set (security_invoker = on);

grant select on public.vw_perdas_fruta, public.vw_estoque_fruta to anon, authenticated;

commit;

-- Confira:  select * from public.vw_estoque_fruta order by fruta;
--
-- Estoque negativo quer dizer que saiu mais do que entrou. Ou falta registrar
-- uma compra, ou sobra uma venda. O app marca a fruta em vermelho.

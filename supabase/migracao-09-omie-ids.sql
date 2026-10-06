-- ============================================================================
--  Migração 09 — códigos internos do Omie
--
--  A API do Omie não aceita CNPJ ou nome do produto na hora de montar um
--  pedido: ela quer o `codigo_cliente` e o `codigo_produto` internos dela.
--  Essas colunas guardam esse código depois de resolvido uma vez (por CNPJ,
--  no caso do cliente), para não repetir a busca a cada venda.
--
--  `cfop_padrao` existe porque o CFOP depende de mercadoria própria vs.
--  revenda de terceiros — um exemplo real de nota emitida pela distribuidora
--  mostrou os dois casos (laranja com 5.101, as demais frutas com 5.102).
--  Sem essa coluna, o código assume 5.102 (revenda) por padrão — ajuste aqui
--  o produto que for produção própria.
--
--  Como aplicar, NESTA ORDEM:
--    1. schema.sql
--    2. migracao-01-redes-lojas.sql
--    3. migracao-02-compras.sql
--    4. migracao-03-perdas-estoque.sql
--    5. migracao-04-despesas-dre.sql
--    6. migracao-05-acertos.sql
--    7. migracao-06-combustivel.sql
--    8. migracao-07-folha-pagamento.sql
--    9. migracao-08-nfe.sql
--   10. migracao-09-omie-ids.sql (este)
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

alter table public.lojas    add column if not exists omie_codigo_cliente bigint;
alter table public.produtos add column if not exists omie_codigo_produto bigint;
alter table public.produtos add column if not exists cfop_padrao         text;
-- A unidade que o Omie já tem cadastrada para esse produto (ex.: "KG", "BAG") —
-- não é sempre igual ao unidade_venda do app (kg/saco), então fica separada
-- em vez de tentar converter uma na outra.
alter table public.produtos add column if not exists unidade_omie        text;
alter table public.vendas   add column if not exists omie_codigo_pedido  bigint;

commit;

-- ============================================================================
--  Migração 10 — cancelamento de NF-e
--
--  Faltava guardar o id que a Spedy dá pra nota (spedy_id): sem ele, depois
--  de recarregar a página não tinha como pedir o cancelamento, porque esse
--  id só vivia no estado do React (perdido no reload). O motivo do
--  cancelamento também fica salvo — a SEFAZ exige justificativa, vale ter
--  registrado o porquê.
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
--   10. migracao-09-omie-ids.sql
--   11. migracao-10-cancelamento-nfe.sql (este)
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

alter table public.vendas add column if not exists nfe_spedy_id             text;
alter table public.vendas add column if not exists nfe_motivo_cancelamento  text;

commit;

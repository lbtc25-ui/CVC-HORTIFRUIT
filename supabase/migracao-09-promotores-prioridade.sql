-- ============================================================================
--  Migração 09 — prioridade nas paradas do promotor
--
--  Acrescenta a `paradas_rota` (criada em migracao-08-promotores.sql) a
--  marcação de quais lojas da rota são prioridade — o gestor sinaliza ao
--  montar a rota, e ela aparece destacada tanto no painel de acompanhamento
--  quanto (quando chegar a vez) na tela do promotor.
--
--  Como aplicar, NESTA ORDEM:
--    ... (schema.sql até auth.sql, como no README)
--    6b. migracao-08-promotores.sql
--    6c. migracao-09-promotores-prioridade.sql (este)
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

alter table public.paradas_rota
  add column if not exists prioridade boolean not null default false;

commit;

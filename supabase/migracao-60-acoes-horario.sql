-- ============================================================================
--  Migração 60 — horário nas ações dos promotores
--
--  A degustação (e outras ações) passa a ter um horário combinado com a loja e uma duração (minutos).
--  O app do promotor avisa 30 minutos antes e na hora marcada.
--
--  Como aplicar: depois da migracao-58-acoes-promotor.sql.
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

alter table public.acoes_promotor add column if not exists hora time;
alter table public.acoes_promotor add column if not exists duracao_min integer check (duracao_min is null or duracao_min > 0);

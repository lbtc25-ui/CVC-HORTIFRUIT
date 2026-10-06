-- ============================================================================
--  Migração 47 — Metas separadas por empresa (Carvalho Cruz e CVC)
--
--  A aba Metas passa a ter metas próprias para cada empresa: as da Carvalho
--  Cruz contam só as vendas dos produtos da Carvalho Cruz, e as da CVC, só as
--  dos produtos da CVC. Metas já gravadas (antes desta migração) ficam na
--  Carvalho Cruz.
--
--  Como aplicar: depois da migracao-44-metas.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

alter table public.metas
  add column if not exists empresa text not null default 'carvalho_cruz';

alter table public.metas drop constraint if exists metas_empresa_check;
alter table public.metas
  add constraint metas_empresa_check check (empresa in ('carvalho_cruz', 'cvc'));

drop index if exists public.metas_periodo_idx;
create index if not exists metas_empresa_periodo_idx on public.metas (empresa, periodo, indicador);

commit;

-- Confira:  select empresa, periodo, indicador, coalesce(fruta, 'GERAL'), valor from public.metas order by 1, 2, 4, 3;

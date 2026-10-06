-- ============================================================================
--  Migração 51 — carta de correção (CC-e) nas notas de devolução
--
--  Mesmo problema da migracao-50: as notas de devolução emitidas pelo app até
--  29/09/2026 saíram com o id interno do produto no código (cProd). A nota
--  guarda quando a CC-e foi enviada e o texto (Notas Fiscais → Devoluções).
--
--  Rode ANTES de publicar a versão do app com a carta de correção nas
--  devoluções — sem as colunas, as gravações de notas de entrada ficam presas
--  na fila de Sincronização.
--
--  Idempotente.
-- ============================================================================

begin;

alter table public.notas_entrada add column if not exists nfe_cce_em    timestamptz;
alter table public.notas_entrada add column if not exists nfe_cce_texto text;

commit;

-- ============================================================================
--  Migração 50 — carta de correção (CC-e) na venda
--
--  As NF-e emitidas pela Spedy até 29/09/2026 saíram com o id interno do
--  produto no código (cProd) e o sistema de clientes como a Rede Mais
--  recusa. A correção é por CC-e (Notas Fiscais → Emitidas), e a venda
--  guarda quando foi enviada e o texto, para não mandar duas vezes.
--
--  Rode ANTES de publicar a versão do app com a carta de correção — sem as
--  colunas, as gravações de venda ficam presas na fila de Sincronização.
--
--  Idempotente.
-- ============================================================================

begin;

alter table public.vendas add column if not exists nfe_cce_em    timestamptz;
alter table public.vendas add column if not exists nfe_cce_texto text;

commit;

-- ============================================================================
--  Migração 43 — Observação da NF-e no pedido
--
--  Campo livre preenchido na Nova Venda ("Observação (sai na NF-e)") que vai
--  para as "Informações complementares" da nota, antes do texto de isenção.
--  É diferente de `observacao` (migracao-21), que é o recado do cliente no
--  link e não sai na nota.
--
--  Como aplicar: depois de migracao-41-emitir-nf.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

alter table public.vendas add column if not exists observacao_nf text;

commit;

-- Confira:  select numero, observacao_nf from public.vendas where observacao_nf is not null;

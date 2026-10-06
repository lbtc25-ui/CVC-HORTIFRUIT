-- ============================================================================
--  Migração 41 — Cliente que não quer NF, só recibo
--
--  Alguns clientes pedem para não emitir nota fiscal (preferem receber por
--  fora) mas continuam querendo um recibo de cada entrega, para conferência.
--  Até aqui só quem entrava na "nota semanal" (migracao-31-nota-semanal-rede)
--  ou num pedido todo bonificado tinha a opção de recibo sem NF-e — os demais
--  só emitiam NF-e, sem alternativa.
--
--  `emitir_nf` fica marcado em cada pedido (a pessoa decide na hora de
--  registrar a venda, não é um cadastro fixo da loja): true emite NF-e como
--  sempre, false esconde os botões de NF-e e libera o recibo, do mesmo jeito
--  que já acontecia com bonificação e nota semanal.
--
--  Como aplicar: depois de migracao-08-nfe.sql (usa nfe_status).
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

alter table public.vendas add column if not exists emitir_nf boolean not null default true;

commit;

-- Confira:  select emitir_nf, count(*) from public.vendas group by emitir_nf;

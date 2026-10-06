-- ============================================================================
--  Migração 63 — caixas IFCO no pedido
--
--  Quantas caixas IFCO foram no pedido (nem toda fruta usa IFCO). Com a taxa
--  "R$ por caixa" do cliente (migracao-62), o app multiplica o valor da taxa
--  por esta quantidade e desconta do resultado do pedido.
--
--    vendas.caixas_ifco   integer, 0 = o pedido não usou IFCO
--
--  Rode ANTES de publicar a versão do app que traz o campo — sem a coluna,
--  as gravações de venda ficam presas na fila de Sincronização.
--  Depois da migracao-62. Idempotente. Nada é apagado.
-- ============================================================================

begin;

alter table public.vendas add column if not exists caixas_ifco integer not null default 0;

commit;

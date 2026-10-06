-- ============================================================================
--  Migração 64 — peso de uma caixa por fruta
--
--  Quantos quilos tem uma caixa da fruta (ex.: laranja pera, caixa de 25 kg).
--  Fica em cada produto, mas o app grava o mesmo valor em todos os produtos
--  da mesma fruta. Vazio = peso da caixa não cadastrado.
--
--    produtos.kg_por_caixa   numeric, null = não cadastrado
--
--  Rode ANTES de publicar a versão do app que traz o campo — sem a coluna,
--  as gravações de produto ficam presas na fila de Sincronização.
--  Idempotente. Nada é apagado.
-- ============================================================================

begin;

alter table public.produtos add column if not exists kg_por_caixa numeric;

commit;

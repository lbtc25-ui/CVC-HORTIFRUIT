-- ============================================================================
--  Migração 48 — arquivar rota de promotor concluída
--
--  Na aba Promotores, as rotas concluídas ficavam empilhadas junto com as do
--  dia (principalmente com "Todas as datas"). Esta migração acrescenta
--  `rotas_promotor.arquivada`: marcada pelo botão "Arquivar" (só aparece em
--  rota concluída), tira o card da lista principal sem apagar nada — paradas,
--  fotos e horários continuam guardados, e dá pra desarquivar pelo botão
--  "Rotas arquivadas" logo abaixo da lista.
--
--  Como aplicar: depois da migracao-08-promotores.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

alter table public.rotas_promotor add column if not exists arquivada boolean not null default false;

commit;

-- ============================================================================
--  Migração 42 — arquivar rota concluída
--
--  Na aba Romaneio, uma rota com tudo entregue não tinha como sair da tela —
--  ficava empilhando cards de rotas velhas junto com as de hoje. Esta
--  migração acrescenta `rota_arquivada`: marcado pelo botão "Arquivar rota"
--  (só aparece quando toda a viagem já está "entregue"), tira o card da tela
--  principal sem apagar nada — os pedidos continuam com seu histórico normal,
--  e dá pra desarquivar pelo card "Rotas arquivadas" que aparece embaixo.
--
--  Como aplicar, NESTA ORDEM: depois de migracao-41-emitir-nf.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

alter table public.vendas add column if not exists rota_arquivada boolean not null default false;

commit;

-- ============================================================================
--  Migração 12 — conferência de cobrança
--
--  A aba Cobrança lista, todo dia, as vendas a prazo que venceram na véspera
--  para alguém confirmar se o cliente pagou. "Pagou" já cabia no status da
--  venda; "não pagou" não cabia — a venda continua pendente, e sem registro
--  a tela não saberia que aquela conta já foi conferida e virou cobrança.
--
--    cobranca_conferida_em   dia em que alguém conferiu o pagamento da venda
--                            vencida (pago ou não). Vazio = ninguém olhou.
--
--  ⚠️  Rode ANTES de usar a versão do app que traz a aba Cobrança. O app
--      passa a enviar essa coluna em toda gravação de venda; sem ela, o
--      Supabase recusa o envio e a alteração fica presa na fila de
--      Sincronização até a migração ser aplicada (aí ela sobe sozinha).
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

alter table public.vendas add column if not exists cobranca_conferida_em date;

commit;

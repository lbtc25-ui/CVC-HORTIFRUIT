-- ============================================================================
--  Migração 34 — motorista "Outro" no Romaneio
--
--  Até aqui, `vendas.motorista_id` só aceitava um funcionário com a função
--  Motorista (migracao-14-romaneio). Mas às vezes quem dirige não está na
--  folha (ajuda avulsa, terceiro) — a tela de Romaneio ganhou uma opção
--  "Outro..." no lugar do funcionário, que guarda o nome digitado aqui.
--
--  `motorista_id` continua null nesse caso — ele é quem liga a rota à conta
--  de login do motorista (migracao-19-motorista); alguém sem conta no
--  sistema não teria como aparecer em "Minhas Entregas" de qualquer jeito.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

alter table public.vendas add column if not exists motorista_nome text;

commit;

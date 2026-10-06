-- ============================================================================
--  Migração 57 — comprovante também em compra, combustível e folha
--
--  A migração 54 deu comprovante à despesa. Agora o mesmo comprovante pode
--  virar uma compra de mercadoria, um abastecimento ou um pagamento da folha
--  (a tela de Despesas escolhe o destino pela categoria), então essas três
--  tabelas ganham as mesmas duas colunas:
--
--    comprovante_path   caminho do arquivo no bucket "despesas-comprovantes"
--    comprovante_nome   nome original, para mostrar na tela
--
--  Pagamento do posto: o combustível é lançado a cada abastecimento e o posto é
--  pago de 15 em 15 dias. O comprovante desse pagamento não cria despesa (o
--  custo já entrou no abastecimento); ele QUITA os abastecimentos da quinzena:
--
--    abastecimentos.pago_em   dia em que o posto foi pago — vazio = em aberto
--
--  e usa o comprovante_path da própria linha como o comprovante do pagamento.
--  Os abastecimentos que já existem ficam "em aberto"; para dar baixa no
--  histórico que já foi pago, rode à parte, trocando a data de corte:
--
--    update public.abastecimentos set pago_em = data
--     where pago_em is null and data < '2026-09-15';
--
--  Rode DEPOIS da 54 e ANTES de publicar a versão do app que usa esta coluna.
--  Idempotente.
-- ============================================================================

alter table public.compras       add column if not exists comprovante_path text;
alter table public.compras       add column if not exists comprovante_nome text;
alter table public.abastecimentos add column if not exists comprovante_path text;
alter table public.abastecimentos add column if not exists comprovante_nome text;
alter table public.pagamentos    add column if not exists comprovante_path text;
alter table public.pagamentos    add column if not exists comprovante_nome text;

alter table public.abastecimentos add column if not exists pago_em date;

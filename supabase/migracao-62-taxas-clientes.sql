-- ============================================================================
--  Migração 62 — taxas e custos por cliente (redes grandes)
--
--  Algumas redes (ex.: Atakarejo) cobram da distribuidora caixas IFCO, taxa
--  de CD e taxa de antecipação. No cadastro da REDE se lista as taxas que
--  valem para todas as lojas dela; uma LOJA pode ter as próprias, que valem
--  no lugar da da rede para o mesmo tipo de taxa.
--
--    redes.taxas / lojas.taxas   jsonb  [{ tipo, nome?, modo, valor }]
--      tipo   ifco | cd | antecipacao | outra
--      modo   percentual (% da venda do pedido) | por_pedido (R$ por pedido)
--
--  O app desconta as taxas do resultado (Painel e Financeiro), no pedido
--  a que se referem. Rode ANTES de publicar a versão do app que traz o
--  cadastro das taxas — sem as colunas, as gravações de rede e loja ficam
--  presas na fila de Sincronização.
--
--  Idempotente. Nada é apagado.
-- ============================================================================

begin;

alter table public.redes add column if not exists taxas jsonb;
alter table public.lojas add column if not exists taxas jsonb;

commit;

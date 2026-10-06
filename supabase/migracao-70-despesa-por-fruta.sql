-- ============================================================================
--  Migração 70 — despesa da fruta
--
--  A planilha da CVC guarda, em cada aba de fruta, as "DESPESAS COM A FRUTA"
--  (IFCO, frete...). A tela Frutas do app mostra e edita essas despesas por
--  fruta, então a despesa passa a poder dizer de que fruta é:
--
--    despesas.fruta   text, null = despesa geral (não é de uma fruta só)
--
--  Idempotente. Nada é apagado.
-- ============================================================================

begin;

alter table public.despesas add column if not exists fruta text;
create index if not exists despesas_fruta_idx on public.despesas (fruta) where fruta is not null;

commit;

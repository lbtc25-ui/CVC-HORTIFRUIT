-- ============================================================================
--  Migração 31 — nota fiscal semanal por rede (hoje só a REDE PRIMAVERA)
--
--  Combinado com a Primavera: cada entrega da semana sai só com um recibo
--  (documento sem valor fiscal, gerado pelo app), e a NF-e de verdade é
--  emitida uma vez só, no último pedido da semana, juntando os itens de
--  todos os pedidos daquela loja feitos desde a última nota.
--
--  Não muda o modelo de venda: continua uma linha por pedido, com o total e
--  o vencimento próprios dele (para a Cobrança). Só a emissão de NF-e passa a
--  poder juntar vários pedidos: o pedido que fecha a semana ("âncora") leva
--  os campos nfe_* de sempre, e cada pedido que entrou junto na nota fica
--  apontando para ele em `consolidada_em`, com nfe_status = 'consolidada' —
--  não tem nota própria, mas também não pode ganhar uma depois por engano.
--
--  Depois da migracao-08-nfe (colunas nfe_*). Idempotente. Nada é apagado.
-- ============================================================================

begin;

alter table public.vendas
  add column if not exists consolidada_em uuid references public.vendas (id);

create index if not exists vendas_consolidada_em_idx on public.vendas (consolidada_em);

alter table public.vendas drop constraint if exists vendas_nfe_status_check;
alter table public.vendas add constraint vendas_nfe_status_check
  check (nfe_status in ('nao_emitida', 'processando', 'autorizada', 'rejeitada', 'cancelada', 'consolidada'));

commit;

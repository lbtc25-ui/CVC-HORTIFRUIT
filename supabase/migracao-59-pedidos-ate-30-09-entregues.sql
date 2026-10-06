-- ============================================================================
--  Migração 59 — pedidos até 30/09/2026 marcados como entregues
--
--  Pedidos antigos que nunca passaram pelo Romaneio (sem rota, entrega
--  «pendente») ficavam eternamente na aba «Pendente entrega» de Vendas.
--  Aqui eles viram «entregue» (dia do pedido), saem da aba e passam a baixar
--  o estoque como saída já realizada. Cancelados e pedidos já em rota/entregues
--  não são tocados.
--
--  Idempotente: rodar de novo não muda nada (só pega status_entrega pendente).
-- ============================================================================

begin;

update public.vendas
   set status_entrega = 'entregue',
       saida_cd_em    = coalesce(saida_cd_em, data::timestamptz),
       entregue_em    = coalesce(entregue_em, data::timestamptz)
 where data <= date '2026-09-30'
   and status <> 'cancelado'
   and status_entrega = 'pendente'
   and veiculo_id is null;

commit;

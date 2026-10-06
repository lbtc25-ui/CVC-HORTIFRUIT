-- ============================================================================
--  Migração 14 — romaneio: rastreio da entrega do CD até a loja
--
--  A tabela `vendas` já vem do schema.sql. Este arquivo acrescenta o que falta
--  para acompanhar cada entrega: o veículo e o motorista escalados, o status
--  da entrega e os dois horários que o motorista registra escaneando o QR da
--  nota — uma vez ao sair do centro de distribuição, outra ao entregar na
--  loja. Não existe tabela nova: a venda já É a nota, e o QR carrega o mesmo
--  id que identifica o pedido em tudo mais.
--
--    status_entrega   pendente → em_rota → entregue, andando sozinho a cada
--                      escaneio (não é a mesma coisa que `status`, que é sobre
--                      o pagamento)
--    ordem_rota        posição da parada na rota daquele veículo naquele dia,
--                      editável na tela para o roteiro poder ser reordenado
--
--  Como aplicar, NESTA ORDEM:
--    1. schema.sql
--    2. migracao-01-redes-lojas.sql
--    3. migracao-02-compras.sql
--    4. migracao-03-perdas-estoque.sql
--    5. migracao-04-despesas-dre.sql
--    5b. migracao-05-acertos.sql
--    5c. migracao-06-combustivel.sql
--    5d. migracao-07-folha-pagamento.sql
--    5e. migracao-08-promotores.sql
--    5f. migracao-08-nfe.sql
--    5g. migracao-09-omie-ids.sql
--    5h. migracao-10-cancelamento-nfe.sql
--    5i. migracao-11-cadastro-clientes.sql
--    5j. migracao-12-cobranca.sql
--    5k. migracao-13-salario-funcionarios.sql
--    6. migracao-14-romaneio.sql (este)
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

alter table public.vendas add column if not exists veiculo_id    uuid references public.veiculos (id) on delete set null;
alter table public.vendas add column if not exists motorista_id  uuid references public.funcionarios (id) on delete set null;
alter table public.vendas add column if not exists status_entrega text;
alter table public.vendas add column if not exists saida_cd_em   timestamptz;
alter table public.vendas add column if not exists entregue_em   timestamptz;
alter table public.vendas add column if not exists ordem_rota    integer;

update public.vendas set status_entrega = 'pendente' where status_entrega is null;

alter table public.vendas alter column status_entrega set default 'pendente';
alter table public.vendas alter column status_entrega set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'vendas_status_entrega_check') then
    alter table public.vendas add constraint vendas_status_entrega_check
      check (status_entrega in ('pendente', 'em_rota', 'entregue'));
  end if;
end;
$$;

create index if not exists vendas_veiculo_idx         on public.vendas (veiculo_id);
create index if not exists vendas_status_entrega_idx   on public.vendas (data, veiculo_id, status_entrega);

commit;

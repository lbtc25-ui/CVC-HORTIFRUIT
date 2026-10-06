-- ============================================================================
--  Migração 18 — romaneio: prioridade, retirada no CD e rota por dia de viagem
--
--  Três ajustes na aba Romaneio, pedidos depois de rodar em produção:
--
--    prioridade   marcado na tela ao montar a rota; pedido prioritário vai
--                 sempre pro topo da lista daquele veículo (posição fixa —
--                 as setas ▲▼ só reordenam dentro do mesmo grupo).
--    rota_data    o dia da VIAGEM, separado do dia do PEDIDO (`vendas.data`).
--                 Sem isso, um pedido de ontem que só saiu hoje não tinha
--                 como entrar na rota de hoje — a tela filtrava tudo pela
--                 data exata do pedido.
--    status_entrega ganha um 4º valor, 'retirado_cd': cliente que busca a
--                 mercadoria direto no centro de distribuição, sem precisar
--                 de veículo, motorista nem escaneio.
--
--  Como aplicar, NESTA ORDEM: depois de migracao-17-acesso-usuarios.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

alter table public.vendas add column if not exists prioridade boolean not null default false;
alter table public.vendas add column if not exists rota_data  date;

-- Pedidos já em rota (ou entregues) antes desta migração: a viagem deles é o
-- próprio dia do pedido, já que era a única data que a tela conhecia.
update public.vendas set rota_data = data where rota_data is null and veiculo_id is not null;

alter table public.vendas drop constraint if exists vendas_status_entrega_check;
alter table public.vendas add constraint vendas_status_entrega_check
  check (status_entrega in ('pendente', 'em_rota', 'entregue', 'retirado_cd'));

create index if not exists vendas_rota_data_idx on public.vendas (rota_data, veiculo_id);

commit;

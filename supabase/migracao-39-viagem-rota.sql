-- ============================================================================
--  Migração 39 — 2ª viagem do mesmo veículo no mesmo dia
--
--  Até aqui, uma rota era identificada só por (veiculo_id, rota_data) — um
--  veículo só podia ter UMA rota aberta por dia. Isso trava o caso comum de
--  o mesmo caminhão sair de novo no mesmo dia (2ª carga, depois de
--  descarregar e voltar ao CD): a tela juntava a viagem nova com a antiga,
--  como se fossem uma coisa só.
--
--  `viagem_rota` (1, 2, 3...) desempata isso: cada viagem do mesmo veículo
--  no mesmo dia vira um card e um romaneio impresso separados, com o MESMO
--  motorista se for o caso — sem precisar trocar de veículo pra escalar
--  uma 2ª saída.
--
--  Como aplicar, NESTA ORDEM: depois de migracao-19-motorista.sql e da
--  migracao-38-desfazer-carregando.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

alter table public.vendas add column if not exists viagem_rota integer not null default 1;

create index if not exists vendas_rota_data_veiculo_viagem_idx
  on public.vendas (rota_data, veiculo_id, viagem_rota);

-- `minhas_entregas` ganha viagem_rota (pra "Minhas Entregas" não misturar a
-- 2ª viagem do dia com a 1ª) e veiculo_id (o app precisa do id, não só do
-- nome, pra saber PARA QUAL viagem chamar `iniciar_rota` — migracao-40). O
-- retorno mudou: o Postgres só troca as colunas de uma função recriando-a.
drop function if exists public.minhas_entregas(date);

create or replace function public.minhas_entregas(dia date)
returns table (
  id              uuid,
  prioridade      boolean,
  numero          integer,
  ordem_rota      integer,
  viagem_rota     integer,
  status_entrega  text,
  saida_cd_em     timestamptz,
  entregue_em     timestamptz,
  loja            text,
  rede            text,
  logradouro      text,
  numero_endereco text,
  complemento     text,
  bairro          text,
  cidade          text,
  uf              text,
  cep             text,
  veiculo         text,
  veiculo_id      uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, coalesce(v.prioridade, false), v.numero, v.ordem_rota, coalesce(v.viagem_rota, 1),
         v.status_entrega, v.saida_cd_em, v.entregue_em,
         l.nome, r.nome,
         l.logradouro, l.numero, l.complemento, l.bairro, l.cidade, l.uf, l.cep,
         ve.nome, v.veiculo_id
    from public.vendas v
    join public.funcionarios f on f.id = v.motorista_id
    left join public.lojas l     on l.id = v.loja_id
    left join public.redes r     on r.id = l.rede_id
    left join public.veiculos ve on ve.id = v.veiculo_id
   where f.usuario_id = auth.uid()
     and public.papel_atual() = 'motorista'
     and coalesce(v.rota_data, v.data) = dia
     and v.status <> 'cancelado'
   order by coalesce(v.prioridade, false) desc, coalesce(v.viagem_rota, 1), v.ordem_rota nulls last, v.numero;
$$;

revoke all on function public.minhas_entregas(date) from public, anon;
grant execute on function public.minhas_entregas(date) to authenticated;

commit;

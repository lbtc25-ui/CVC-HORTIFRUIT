-- ============================================================================
--  Migração 40 — "Iniciar rota" por veículo + viagem, não pelo dia inteiro
--
--  A migracao-37-iniciar-rota.sql criou `iniciar_rota(dia)`: só libera (e só
--  dispara) quando NENHUM pedido do motorista naquele dia ainda está
--  'pendente', e aí passa TODO pedido 'carregando' daquele dia para
--  'em_rota' de uma vez.
--
--  Isso quebra com a migracao-39-viagem-rota.sql (2ª viagem do mesmo
--  veículo no mesmo dia): se o motorista tem duas viagens abertas — mesmo
--  veículo (2ª carga) ou dois veículos —, carregar a viagem 1 inteira não
--  liberava "Iniciar rota" enquanto a viagem 2 tivesse algo pendente, e
--  apertar o botão iniciava as duas de uma vez, mesmo a que ainda não
--  tinha acabado de carregar.
--
--  Esta migração redefine `iniciar_rota` para receber também o veículo e a
--  viagem: `iniciar_rota(dia, veiculo, viagem)`. A checagem de pendentes e
--  a atualização em bloco passam a olhar só essa viagem específica — outras
--  viagens do mesmo motorista, no mesmo dia, ficam de fora.
--
--  A assinatura mudou (não é só o retorno): o Postgres não sobrescreve uma
--  função com parâmetros diferentes, então a antiga precisa ser apagada.
--
--  Como aplicar, NESTA ORDEM: depois de migracao-37-iniciar-rota.sql e
--  migracao-39-viagem-rota.sql. Rode junto com a versão do app que chama
--  `iniciar_rota` com os 3 argumentos — a versão antiga do app chama só com
--  `dia`, e vai parar de achar a função depois desta migração.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

drop function if exists public.iniciar_rota(date);

create or replace function public.iniciar_rota(dia date, veiculo uuid, viagem integer default 1)
returns table (iniciadas integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  pendentes integer;
  n integer;
begin
  if public.papel_atual() is distinct from 'motorista' then
    raise exception 'Só o motorista inicia a rota por aqui.';
  end if;

  select count(*) into pendentes
    from public.vendas vd
    join public.funcionarios f on f.id = vd.motorista_id
   where f.usuario_id = auth.uid()
     and coalesce(vd.rota_data, vd.data) = dia
     and vd.veiculo_id = veiculo
     and coalesce(vd.viagem_rota, 1) = viagem
     and vd.status <> 'cancelado'
     and vd.status_entrega = 'pendente';

  if pendentes > 0 then
    raise exception 'Ainda faltam % pedido(s) para carregar no caminhão.', pendentes;
  end if;

  update public.vendas vd
     set status_entrega = 'em_rota', saida_cd_em = now()
    from public.funcionarios f
   where f.id = vd.motorista_id
     and f.usuario_id = auth.uid()
     and coalesce(vd.rota_data, vd.data) = dia
     and vd.veiculo_id = veiculo
     and coalesce(vd.viagem_rota, 1) = viagem
     and vd.status <> 'cancelado'
     and vd.status_entrega = 'carregando';
  get diagnostics n = row_count;

  if n = 0 then
    raise exception 'Nenhum pedido carregado para iniciar a rota.';
  end if;

  return query select n;
end;
$$;

revoke all on function public.iniciar_rota(date, uuid, integer) from public, anon;
grant execute on function public.iniciar_rota(date, uuid, integer) to authenticated;

commit;

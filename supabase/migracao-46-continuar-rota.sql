-- ============================================================================
--  Migração 46 — continuar no dia seguinte uma rota que não terminou
--
--  Se o motorista não consegue entregar tudo no dia (loja fechada, tempo,
--  problema no caminhão), as paradas que sobraram ficavam presas no dia de
--  ontem: "Minhas Entregas" só mostra o dia escolhido, e o Romaneio de hoje
--  não enxergava nada. Esta migração cria duas funções para o motorista:
--
--    rotas_nao_concluidas(hoje)
--        as viagens dos 7 dias ANTERIORES a `hoje` com pedido ainda não entregue
--        (pendente, carregando ou em rota): dia, veículo, viagem, quantas
--        faltam e quantas tinha.
--
--    continuar_rota(dia, veiculo, viagem, hoje)
--        passa os pedidos NÃO entregues daquela viagem para `hoje` — numa
--        viagem nova do mesmo veículo (a próxima livre no dia, para não
--        misturar com o que já foi montado para hoje). Os entregues ficam no
--        dia original, como histórico. O status de cada pedido não muda: o
--        que já estava "em rota" continua em rota (é só ler o QR na loja); o
--        que estava pendente/carregando segue o fluxo normal de carregar e
--        "Iniciar rota".
--
--  `hoje` vem do app (a data no fuso do aparelho), não de current_date, que
--  no Supabase é UTC e vira o dia às 21h no Brasil.
--
--  O escritório faz o mesmo pelo Romaneio (botão "Continuar hoje"), que
--  grava direto em `vendas` como o resto da tela — não precisa desta função.
--
--  Como aplicar, NESTA ORDEM: depois de migracao-42-arquivar-rota.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

create or replace function public.rotas_nao_concluidas(hoje date)
returns table (
  dia        date,
  veiculo_id uuid,
  veiculo    text,
  viagem     integer,
  faltam     integer,
  total      integer
)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(v.rota_data, v.data), v.veiculo_id, ve.nome, coalesce(v.viagem_rota, 1),
         count(*) filter (where coalesce(v.status_entrega, 'pendente') not in ('entregue', 'retirado_cd'))::integer,
         count(*)::integer
    from public.vendas v
    join public.funcionarios f on f.id = v.motorista_id
    left join public.veiculos ve on ve.id = v.veiculo_id
   where f.usuario_id = auth.uid()
     and public.papel_atual() = 'motorista'
     and coalesce(v.rota_data, v.data) < hoje
     and coalesce(v.rota_data, v.data) >= hoje - 7
     and v.veiculo_id is not null
     and v.status <> 'cancelado'
   group by 1, 2, 3, 4
  having count(*) filter (where coalesce(v.status_entrega, 'pendente') not in ('entregue', 'retirado_cd')) > 0
   order by 1 desc, 4;
$$;

revoke all on function public.rotas_nao_concluidas(date) from public, anon;
grant execute on function public.rotas_nao_concluidas(date) to authenticated;

create or replace function public.continuar_rota(dia date, veiculo uuid, viagem integer, hoje date)
returns table (movidas integer, nova_viagem integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  proxima integer;
  n integer;
begin
  if public.papel_atual() is distinct from 'motorista' then
    raise exception 'Só o motorista continua a rota por aqui.';
  end if;
  if dia >= hoje then
    raise exception 'Só dá para continuar hoje uma rota de um dia anterior.';
  end if;

  -- Próxima viagem livre do veículo no dia de hoje (de qualquer motorista):
  -- o que sobrou vira uma viagem separada, sem se misturar com a que o
  -- escritório já montou para hoje.
  select coalesce(max(coalesce(vd.viagem_rota, 1)), 0) + 1 into proxima
    from public.vendas vd
   where vd.rota_data = hoje
     and vd.veiculo_id = veiculo
     and vd.status <> 'cancelado';

  update public.vendas vd
     set rota_data = hoje, viagem_rota = proxima, rota_arquivada = false
    from public.funcionarios f
   where f.id = vd.motorista_id
     and f.usuario_id = auth.uid()
     and coalesce(vd.rota_data, vd.data) = dia
     and vd.veiculo_id = veiculo
     and coalesce(vd.viagem_rota, 1) = viagem
     and vd.status <> 'cancelado'
     and coalesce(vd.status_entrega, 'pendente') not in ('entregue', 'retirado_cd');
  get diagnostics n = row_count;

  if n = 0 then
    raise exception 'Não sobrou nenhuma entrega nessa rota.';
  end if;

  return query select n, proxima;
end;
$$;

revoke all on function public.continuar_rota(date, uuid, integer, date) from public, anon;
grant execute on function public.continuar_rota(date, uuid, integer, date) to authenticated;

commit;

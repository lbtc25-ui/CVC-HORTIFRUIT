-- ============================================================================
--  Migração 37 — "Iniciar rota": carregar não é sair do CD
--
--  A migração 36 bloqueava a 2ª leitura (entrega) enquanto sobrava pedido
--  pendente na mesma viagem, mas a 1ª leitura (carregamento) ainda virava
--  'em_rota' na hora — e é esse status que o Painel TV lê como "saiu do CD".
--  Resultado: carregar só o 1º pedido da rota já fazia a TV mostrar o
--  motorista "em deslocamento", com o caminhão ainda sendo carregado no CD.
--
--  Agora o fluxo ganha um passo a mais, sem QR:
--
--    pendente   → carregando   1ª leitura do QR: pedido no caminhão.
--    carregando → em_rota      botão "Iniciar rota" na tela do motorista —
--                               só libera com a viagem inteira carregada
--                               (nenhum pedido ainda 'pendente'). É só aqui
--                               que grava `saida_cd_em`.
--    em_rota    → entregue     2ª leitura do QR, na loja.
--
--  Ler de novo um pedido que já está 'carregando' (antes de iniciar a rota)
--  agora dá erro — igual já dava pra ler um pedido 'em_rota' antes de
--  carregar todo o resto (migracao-36), só que um passo mais cedo.
--
--  Precisa rodar DEPOIS da migracao-19-motorista.sql e da
--  migracao-36-carregamento-completo.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

alter table public.vendas drop constraint if exists vendas_status_entrega_check;
alter table public.vendas add constraint vendas_status_entrega_check
  check (status_entrega in ('pendente', 'carregando', 'em_rota', 'entregue', 'retirado_cd'));

create or replace function public.registrar_escaneio(venda uuid)
returns table (status_entrega text, numero integer, loja text, momento timestamptz, mudou boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v record;
begin
  if public.papel_atual() is distinct from 'motorista' then
    raise exception 'Só o motorista registra escaneio por aqui.';
  end if;

  select vd.id, vd.numero, vd.status_entrega, vd.saida_cd_em, vd.entregue_em, l.nome as loja
    into v
    from public.vendas vd
    join public.funcionarios f on f.id = vd.motorista_id
    left join public.lojas l on l.id = vd.loja_id
   where vd.id = venda and f.usuario_id = auth.uid() and vd.status <> 'cancelado';

  if not found then
    raise exception 'Esta nota não está nas suas entregas.';
  end if;

  if v.status_entrega = 'pendente' then
    update public.vendas set status_entrega = 'carregando' where id = v.id;
    return query select 'carregando'::text, v.numero, v.loja, now(), true;
  elsif v.status_entrega = 'carregando' then
    raise exception 'Este pedido já foi carregado. Aperte "Iniciar rota" antes de registrar entregas.';
  elsif v.status_entrega = 'em_rota' then
    update public.vendas set status_entrega = 'entregue', entregue_em = now() where id = v.id;
    return query select 'entregue'::text, v.numero, v.loja, now(), true;
  else
    return query select v.status_entrega, v.numero, v.loja, v.entregue_em, false;
  end if;
end;
$$;

-- ─── Iniciar rota ───────────────────────────────────────────────────────────

create or replace function public.iniciar_rota(dia date)
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
     and vd.status <> 'cancelado'
     and vd.status_entrega = 'carregando';
  get diagnostics n = row_count;

  if n = 0 then
    raise exception 'Nenhum pedido carregado para iniciar a rota.';
  end if;

  return query select n;
end;
$$;

revoke all on function public.iniciar_rota(date) from public, anon;
grant execute on function public.iniciar_rota(date) to authenticated;

commit;

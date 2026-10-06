-- ============================================================================
--  Migração 39 — mesclar paradas do mesmo cliente no Romaneio
--
--  Dois (ou mais) pedidos pendentes, do mesmo veículo e da mesma loja, podem
--  ser mesclados numa única parada da rota: a tela do Romaneio, o romaneio
--  impresso e o app do motorista passam a mostrar UMA linha só, com os itens
--  e valores somados. Os pedidos continuam sendo vendas separadas — NF-e,
--  financeiro e histórico do cliente não mudam nada — é só o jeito de andar
--  a rota que muda. Reversível a qualquer momento ("Desmesclar").
--
--  `grupo_entrega_id` é só um uuid compartilhado por quem foi mesclado junto
--  (não referencia nada) — vendas com o mesmo valor aqui, no mesmo veículo,
--  são a mesma parada. Sem grupo (null), cada venda é sua própria parada,
--  como sempre foi.
--
--  Escanear o QR de QUALQUER pedido do grupo (cada nota impressa continua
--  com o seu próprio QR) avança o grupo inteiro junto — é assim que o
--  motorista não precisa ler as duas notas separadamente na entrega.
--  `registrar_escaneio` e `desfazer_escaneio` (migracao-19/36/37/38) ganham
--  esse espelhamento.
--
--  Precisa rodar DEPOIS da migracao-38-desfazer-carregando.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

alter table public.vendas add column if not exists grupo_entrega_id uuid;

create index if not exists vendas_grupo_entrega_idx on public.vendas (grupo_entrega_id) where grupo_entrega_id is not null;

create or replace function public.registrar_escaneio(venda uuid)
returns table (status_entrega text, numero integer, loja text, momento timestamptz, mudou boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v record;
  faltam integer;
begin
  if public.papel_atual() is distinct from 'motorista' then
    raise exception 'Só o motorista registra escaneio por aqui.';
  end if;

  select vd.id, vd.numero, vd.status_entrega, vd.saida_cd_em, vd.entregue_em, vd.motorista_id, vd.grupo_entrega_id,
         coalesce(vd.rota_data, vd.data) as rota_dia, l.nome as loja
    into v
    from public.vendas vd
    join public.funcionarios f on f.id = vd.motorista_id
    left join public.lojas l on l.id = vd.loja_id
   where vd.id = venda and f.usuario_id = auth.uid() and vd.status <> 'cancelado';

  if not found then
    raise exception 'Esta nota não está nas suas entregas.';
  end if;

  if v.status_entrega = 'pendente' then
    update public.vendas
       set status_entrega = 'carregando'
     where (id = v.id or (v.grupo_entrega_id is not null and grupo_entrega_id = v.grupo_entrega_id))
       and status_entrega = 'pendente';
    return query select 'carregando'::text, v.numero, v.loja, now(), true;
  elsif v.status_entrega = 'carregando' then
    raise exception 'Este pedido já foi carregado. Aperte "Iniciar rota" antes de registrar entregas.';
  elsif v.status_entrega = 'em_rota' then
    select count(*) into faltam
      from public.vendas vd
     where vd.motorista_id = v.motorista_id
       and coalesce(vd.rota_data, vd.data) = v.rota_dia
       and vd.status <> 'cancelado'
       and vd.status_entrega = 'pendente';

    if faltam > 0 then
      raise exception 'Ainda faltam % pedido(s) para carregar no caminhão antes de sair para entrega.', faltam;
    end if;

    update public.vendas
       set status_entrega = 'entregue', entregue_em = now()
     where (id = v.id or (v.grupo_entrega_id is not null and grupo_entrega_id = v.grupo_entrega_id))
       and status_entrega = 'em_rota';
    return query select 'entregue'::text, v.numero, v.loja, now(), true;
  else
    return query select v.status_entrega, v.numero, v.loja, v.entregue_em, false;
  end if;
end;
$$;

create or replace function public.desfazer_escaneio(venda uuid)
returns table (status_entrega text, numero integer, loja text, mudou boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v record;
begin
  if public.papel_atual() is distinct from 'motorista' then
    raise exception 'Só o motorista desfaz escaneio por aqui.';
  end if;

  select vd.id, vd.numero, vd.status_entrega, vd.grupo_entrega_id, l.nome as loja
    into v
    from public.vendas vd
    join public.funcionarios f on f.id = vd.motorista_id
    left join public.lojas l on l.id = vd.loja_id
   where vd.id = venda and f.usuario_id = auth.uid() and vd.status <> 'cancelado';

  if not found then
    raise exception 'Esta nota não está nas suas entregas.';
  end if;

  if v.status_entrega = 'entregue' then
    update public.vendas
       set status_entrega = 'em_rota', entregue_em = null
     where (id = v.id or (v.grupo_entrega_id is not null and grupo_entrega_id = v.grupo_entrega_id))
       and status_entrega = 'entregue';
    return query select 'em_rota'::text, v.numero, v.loja, true;
  elsif v.status_entrega = 'carregando' then
    update public.vendas
       set status_entrega = 'pendente'
     where (id = v.id or (v.grupo_entrega_id is not null and grupo_entrega_id = v.grupo_entrega_id))
       and status_entrega = 'carregando';
    return query select 'pendente'::text, v.numero, v.loja, true;
  else
    return query select v.status_entrega, v.numero, v.loja, false;
  end if;
end;
$$;

commit;

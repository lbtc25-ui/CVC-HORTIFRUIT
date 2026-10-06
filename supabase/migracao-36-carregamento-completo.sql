-- ============================================================================
--  Migração 36 — carregamento completo antes de entregar
--
--  O motorista lê o QR de cada nota duas vezes: a 1ª leitura marca o
--  carregamento no caminhão (pendente → em_rota); a 2ª, a entrega na loja
--  (em_rota → entregue). Até aqui nada impedia ele de ler de novo um pedido
--  já carregado achando que era outro (ou apressado) e "entregar" antes de
--  carregar o resto da viagem — pedido esquecido no CD sem ninguém notar.
--
--  Agora a 2ª leitura só é aceita depois que TODAS as paradas da mesma
--  viagem (mesmo motorista, mesma rota_data) já passaram pela 1ª — ou seja,
--  nenhuma ainda 'pendente'. Enquanto sobrar pedido não carregado, tentar
--  registrar entrega de outro (mesmo já em rota) dá erro.
--
--  Precisa rodar DEPOIS da migracao-19-motorista.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

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

  select vd.id, vd.numero, vd.status_entrega, vd.saida_cd_em, vd.entregue_em, vd.motorista_id,
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
    update public.vendas set status_entrega = 'em_rota', saida_cd_em = now() where id = v.id;
    return query select 'em_rota'::text, v.numero, v.loja, now(), true;
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

    update public.vendas set status_entrega = 'entregue', entregue_em = now() where id = v.id;
    return query select 'entregue'::text, v.numero, v.loja, now(), true;
  else
    return query select v.status_entrega, v.numero, v.loja, v.entregue_em, false;
  end if;
end;
$$;

commit;

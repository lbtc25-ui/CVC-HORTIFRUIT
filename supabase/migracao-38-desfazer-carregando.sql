-- ============================================================================
--  Migração 38 — "Desfazer leitura" ajustado ao status "carregando"
--
--  A migração 36 (migracao-36-desfazer-escaneio.sql) criou `desfazer_escaneio`
--  para o modelo de 3 status: pendente → em_rota → entregue — desfazer voltava
--  entregue → em_rota ou em_rota → pendente.
--
--  A migração 37 (migracao-37-iniciar-rota.sql) mudou o modelo pra 4 status:
--  pendente → carregando (1ª leitura do QR) → em_rota (botão "Iniciar rota")
--  → entregue (2ª leitura do QR). "Em rota" deixou de vir de escaneio — não
--  tem mais o que desfazer ali. Quem virou o "1ª leitura errada" é o status
--  "carregando".
--
--  Esta migração só redefine `desfazer_escaneio`:
--    entregue   → em_rota    (sem mudança)
--    carregando → pendente   (era em_rota → pendente)
--
--  Precisa rodar DEPOIS da migracao-36-desfazer-escaneio.sql e da
--  migracao-37-iniciar-rota.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

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

  select vd.id, vd.numero, vd.status_entrega, l.nome as loja
    into v
    from public.vendas vd
    join public.funcionarios f on f.id = vd.motorista_id
    left join public.lojas l on l.id = vd.loja_id
   where vd.id = venda and f.usuario_id = auth.uid() and vd.status <> 'cancelado';

  if not found then
    raise exception 'Esta nota não está nas suas entregas.';
  end if;

  if v.status_entrega = 'entregue' then
    update public.vendas set status_entrega = 'em_rota', entregue_em = null where id = v.id;
    return query select 'em_rota'::text, v.numero, v.loja, true;
  elsif v.status_entrega = 'carregando' then
    update public.vendas set status_entrega = 'pendente' where id = v.id;
    return query select 'pendente'::text, v.numero, v.loja, true;
  else
    return query select v.status_entrega, v.numero, v.loja, false;
  end if;
end;
$$;

commit;

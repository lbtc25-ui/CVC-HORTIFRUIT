-- ============================================================================
--  Migração 36 — motorista desfaz um escaneio
--
--  Em "Minhas Entregas" (migracao-19-motorista), o QR da nota avança o
--  status em dois passos: pendente → em_rota (saída do CD) → entregue. Se o
--  motorista ler o QR errado (ex.: a nota de outra loja) e confirmar, não
--  havia como voltar atrás — a entrega errada ficava marcada.
--
--  `desfazer_escaneio(venda)` é o passo inverso de `registrar_escaneio`:
--  entregue → em_rota, em_rota → pendente, limpando o horário do passo
--  desfeito. Só mexe nas entregas escaladas para o motorista logado, igual
--  às outras funções da migracao-19. Não desfaz `retirado_cd`, que não vem
--  de escaneio do motorista (é ação do escritório no Romaneio).
--
--  Precisa rodar DEPOIS da migracao-19-motorista.
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
  elsif v.status_entrega = 'em_rota' then
    update public.vendas set status_entrega = 'pendente', saida_cd_em = null where id = v.id;
    return query select 'pendente'::text, v.numero, v.loja, true;
  else
    return query select v.status_entrega, v.numero, v.loja, false;
  end if;
end;
$$;

revoke all on function public.desfazer_escaneio(uuid) from public, anon;
grant execute on function public.desfazer_escaneio(uuid) to authenticated;

commit;

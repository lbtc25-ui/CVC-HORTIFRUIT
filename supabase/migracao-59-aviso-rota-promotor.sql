-- ============================================================================
--  Migração 59 — aviso no celular (ntfy) quando um promotor inicia a rota
--
--  Manda "<Promotor> iniciou a rota às HH:MM" quando uma rota passa de
--  pendente para em_andamento (o botão "Iniciar rota" da tela Minha Rota).
--  Usa a mesma configuração dos outros avisos (Sincronização → Avisos no
--  celular); sem tópico gravado, não sai nada. Toque no aviso abre a aba
--  Promotores. A hora é a de Aracaju (UTC-3 o ano todo).
--
--  Pode rodar de novo sem problema. Pré-requisito: migracao-55.
-- ============================================================================

begin;

create or replace function privado.avisar_rota_promotor_iniciada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  promotor text;
  hora     text;
begin
  -- Só o que vem pela API do app (tem JWT), como nos outros avisos.
  if coalesce(current_setting('request.jwt.claims', true), '') = '' then
    return null;
  end if;

  select coalesce(nullif(trim(nome), ''), 'Um promotor') into promotor
    from public.perfis where id = new.promotor_id;
  hora := to_char(coalesce(new.iniciada_em, now()) at time zone 'America/Maceio', 'HH24:MI');

  perform privado.enviar_ntfy(
    'Rota iniciada',
    coalesce(promotor, 'Um promotor') || ' iniciou a rota às ' || hora || E'\n' || new.nome,
    privado.link_do_app('promotores')
  );
  return null;
end;
$$;

revoke all on function privado.avisar_rota_promotor_iniciada() from public, anon, authenticated;

drop trigger if exists rotas_promotor_avisar_inicio on public.rotas_promotor;
create trigger rotas_promotor_avisar_inicio
  after update on public.rotas_promotor
  for each row
  when (old.status = 'pendente' and new.status = 'em_andamento')
  execute function privado.avisar_rota_promotor_iniciada();

commit;

-- Migrações 60 + 61 juntas (horário/duração da ação + aviso no celular). Cole inteiro no SQL Editor do Supabase e rode. Pode rodar mais de uma vez.

alter table public.acoes_promotor add column if not exists hora time;
alter table public.acoes_promotor add column if not exists duracao_min integer check (duracao_min is null or duracao_min > 0);

-- ============================================================================
--  Migração 61 — aviso da ação no celular do promotor (funciona com o app fechado)
--
--  O alerta dentro do app (migração 60) só toca com o app aberto. Este manda o
--  aviso pelo ntfy — o mesmo canal dos avisos do gestor —, direto do banco:
--  um agendamento no pg_cron roda a cada minuto e avisa
--    • 30 minutos antes do horário da ação, e
--    • na hora marcada.
--  Só ações pendentes, de hoje (Aracaju, UTC-3), com horário. Cada aviso sai
--  uma vez só por ação (as colunas aviso_antes_em / aviso_hora_em controlam).
--
--  Cada promotor tem o próprio tópico, secreto e gerado pelo banco. Na tela
--  Minha Rota o promotor vê o tópico e instala o app gratuito "ntfy" no
--  celular (Android ou iPhone), tocando em + e digitando o tópico.
--
--  Pré-requisitos: migrações 55 (ntfy + pg_net), 58 e 60. O pg_cron precisa
--  estar ligado (o painel Sincronização → Avisos no celular mostra isso).
--  O aviso só sai se o ntfy estiver ativo ali (Sincronização → Avisos no celular).
--
--  Para testar sem esperar:  select privado.avisar_acoes_horario();
--
--  Idempotente: pode rodar de novo sem duplicar nada.
-- ============================================================================

begin;

alter table public.acoes_promotor add column if not exists aviso_antes_em timestamptz;
alter table public.acoes_promotor add column if not exists aviso_hora_em  timestamptz;

-- ─── Tópico de cada promotor ────────────────────────────────────────────────

create table if not exists public.promotor_topicos (
  promotor_id uuid primary key references public.perfis (id) on delete cascade,
  topico      text not null unique
              default ('cc-promotor-' || replace(gen_random_uuid()::text, '-', ''))
);

alter table public.promotor_topicos enable row level security;

drop policy if exists promotor_topicos_leitura on public.promotor_topicos;
create policy promotor_topicos_leitura on public.promotor_topicos
  for select to authenticated
  using (promotor_id = auth.uid() or public.e_gestor());

revoke all on public.promotor_topicos from anon;
revoke insert, update, delete on public.promotor_topicos from authenticated;
grant select on public.promotor_topicos to authenticated;

-- O próprio usuário pede o tópico (criado na primeira vez). Devolve também o
-- servidor do ntfy, para a tela mostrar onde se inscrever.
create or replace function public.meu_topico_aviso()
returns table (topico text, servidor text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Sessão expirada. Entre novamente.';
  end if;

  insert into public.promotor_topicos (promotor_id) values (uid)
    on conflict (promotor_id) do nothing;

  return query
    select t.topico,
           coalesce(nullif(trim(n.servidor), ''), 'https://ntfy.sh')
      from public.promotor_topicos t
      left join privado.notificacao_pedidos n on n.id = 1
     where t.promotor_id = uid;
end;
$$;

revoke all on function public.meu_topico_aviso() from public, anon;
grant execute on function public.meu_topico_aviso() to authenticated;

-- ─── Envio para um tópico qualquer ──────────────────────────────────────────

create or replace function privado.enviar_ntfy_para(p_topico text, titulo text, mensagem text, clique text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg   privado.notificacao_pedidos;
  corpo jsonb;
begin
  select * into cfg from privado.notificacao_pedidos where id = 1;
  if cfg is null or not cfg.ativo or coalesce(trim(p_topico), '') = '' then
    return;
  end if;

  corpo := jsonb_build_object(
    'topic',    trim(p_topico),
    'title',    titulo,
    'message',  mensagem,
    'tags',     jsonb_build_array('alarm_clock'),
    'priority', 4
  );
  if coalesce(clique, cfg.url_app) is not null then
    corpo := corpo || jsonb_build_object('click', coalesce(clique, cfg.url_app));
  end if;

  perform net.http_post(
    url     := rtrim(coalesce(nullif(trim(cfg.servidor), ''), 'https://ntfy.sh'), '/') || '/',
    body    := corpo,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
end;
$$;

revoke all on function privado.enviar_ntfy_para(text, text, text, text) from public, anon, authenticated;

-- ─── Varredura por minuto ───────────────────────────────────────────────────

create or replace function privado.avisar_acoes_horario()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  a        record;
  faltam   numeric;
  hora_txt text;
  enviados integer := 0;
begin
  for a in
    select ac.id, ac.titulo, ac.estabelecimento, ac.hora, ac.duracao_min,
           ac.aviso_antes_em, ac.aviso_hora_em, t.topico,
           ((ac.data + ac.hora)::timestamp at time zone 'America/Maceio') as inicio
      from public.acoes_promotor ac
      join public.promotor_topicos t on t.promotor_id = ac.promotor_id
     where ac.hora is not null
       and ac.status = 'pendente'
       and not ac.arquivada
       and ac.data = privado.hoje_aracaju()
  loop
    faltam   := extract(epoch from (a.inicio - now())) / 60;
    hora_txt := to_char(a.hora, 'HH24:MI');

    if faltam > 0 and faltam <= 30 and a.aviso_antes_em is null then
      perform privado.enviar_ntfy_para(
        a.topico,
        'Ação em ' || ceil(faltam)::int || ' minutos',
        a.titulo || ' — ' || a.estabelecimento || E'\nHorário: ' || hora_txt,
        privado.link_do_app('minharota')
      );
      update public.acoes_promotor set aviso_antes_em = now() where id = a.id;
      enviados := enviados + 1;

    elsif faltam <= 0 and faltam > -30 and a.aviso_hora_em is null then
      perform privado.enviar_ntfy_para(
        a.topico,
        'Está na hora da ação',
        a.titulo || ' — ' || a.estabelecimento || E'\nHorário: ' || hora_txt,
        privado.link_do_app('minharota')
      );
      -- Se o aviso de 30 min nunca saiu (ação criada em cima da hora), não sai depois.
      update public.acoes_promotor
         set aviso_hora_em = now(), aviso_antes_em = coalesce(aviso_antes_em, now())
       where id = a.id;
      enviados := enviados + 1;
    end if;
  end loop;

  return enviados;
end;
$$;

revoke all on function privado.avisar_acoes_horario() from public, anon, authenticated;

-- Mudou o dia ou a hora da ação? Os avisos valem de novo.
create or replace function privado.zerar_avisos_acao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.data is distinct from old.data or new.hora is distinct from old.hora then
    new.aviso_antes_em := null;
    new.aviso_hora_em  := null;
  end if;
  return new;
end;
$$;

drop trigger if exists acoes_promotor_zerar_avisos on public.acoes_promotor;
create trigger acoes_promotor_zerar_avisos
  before update on public.acoes_promotor
  for each row execute function privado.zerar_avisos_acao();

-- ─── Agenda: todo minuto ────────────────────────────────────────────────────

do $$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'pg_cron indisponível (%): ligue-o em Database → Extensions e rode esta migração de novo.', sqlerrm;
  end;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'avisar-acoes-promotor';
    perform cron.schedule('avisar-acoes-promotor', '* * * * *', 'select privado.avisar_acoes_horario();');
  end if;
end;
$$;

commit;

-- Confira:  select jobname, schedule from cron.job where jobname = 'avisar-acoes-promotor';

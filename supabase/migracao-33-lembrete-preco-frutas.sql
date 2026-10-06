-- ============================================================================
--  Migração 33 — conferência semanal de preços (frutas)
--
--  Tabela `precos_frutas`: a conferência de toda segunda-feira — confirma o
--  preço de cada fruta (o mesmo de novo) ou ajusta. NÃO é o preço da venda,
--  que continua digitado em cada uma e varia por cliente; é a referência que
--  orienta quem vende. O preço vigente de uma fruta é sempre o registro mais
--  recente (precoAtualPorFruta, em distribuidora-carvalho-cruz.jsx).
--
--  Aviso semanal (opcional), mesmo princípio da migracao-31/32: se a
--  migracao-20 (privado.enviar_ntfy) já está aplicada, este arquivo tenta
--  agendar, pelo pg_cron, um aviso toda SEGUNDA às 7h (horário de Aracaju,
--  UTC-3 o ano todo) pelo mesmo tópico ntfy já configurado. Se o pg_cron não
--  estiver disponível, as tabelas são criadas do mesmo jeito — só o
--  agendamento automático fica de fora.
--
--  Para testar sem esperar a segunda-feira:
--       select privado.lembrar_preco_frutas();
--
--  Rode antes de publicar a versão do app que traz a conferência de preços —
--  sem a tabela, os registros ficam presos na fila de Sincronização.
--
--  Idempotente: pode rodar de novo sem duplicar nada.
-- ============================================================================

begin;

create table if not exists public.precos_frutas (
  id         uuid primary key default gen_random_uuid(),
  fruta      text not null,
  preco      numeric(12,4) not null default 0 check (preco >= 0),
  data       date not null default current_date,
  criado_em  timestamptz not null default now()
);

create index if not exists precos_frutas_data_idx  on public.precos_frutas (data desc);
create index if not exists precos_frutas_fruta_idx on public.precos_frutas (fruta);

-- ─── Acesso ─────────────────────────────────────────────────────────────────
--
-- Mesma regra da aba Estoque: gestor lê e grava; exclusão por
-- pode_excluir_registros(). Antes do auth.sql, fica aberta como as demais.

alter table public.precos_frutas enable row level security;

drop policy if exists acesso_app                  on public.precos_frutas;
drop policy if exists precos_frutas_leitura       on public.precos_frutas;
drop policy if exists precos_frutas_insercao      on public.precos_frutas;
drop policy if exists precos_frutas_atualizacao   on public.precos_frutas;
drop policy if exists precos_frutas_exclusao      on public.precos_frutas;

do $$
begin
  if to_regprocedure('public.e_gestor()') is not null then
    create policy precos_frutas_leitura on public.precos_frutas
      for select to authenticated using (public.e_gestor());
    create policy precos_frutas_insercao on public.precos_frutas
      for insert to authenticated with check (public.e_gestor());
    create policy precos_frutas_atualizacao on public.precos_frutas
      for update to authenticated using (public.e_gestor()) with check (public.e_gestor());

    if to_regprocedure('public.pode_excluir_registros()') is not null then
      create policy precos_frutas_exclusao on public.precos_frutas
        for delete to authenticated using (public.pode_excluir_registros());
    else
      create policy precos_frutas_exclusao on public.precos_frutas
        for delete to authenticated using (public.e_socio());
    end if;

    revoke all on public.precos_frutas from anon;
    grant select, insert, update, delete on public.precos_frutas to authenticated;
  else
    -- Antes do auth.sql: aberta, como as outras tabelas nessa fase.
    create policy acesso_app on public.precos_frutas
      for all to anon, authenticated using (true) with check (true);
    grant select, insert, update, delete on public.precos_frutas to anon, authenticated;
  end if;
end;
$$;

commit;

-- ============================================================================
--  Aviso semanal — melhor esforço, fora da transação acima: se o pg_cron não
--  estiver disponível ou o aviso de pedidos (migracao-20) ainda não tiver
--  sido ligado, a tabela de preços continua criada do mesmo jeito.
-- ============================================================================

do $$
begin
  if to_regprocedure('privado.enviar_ntfy(text,text,text)') is null then
    raise notice 'privado.enviar_ntfy não existe — rode a migracao-20-notificacao-pedidos.sql primeiro para ligar o aviso semanal de preços (opcional).';
    return;
  end if;

  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'Não deu para criar a extensão pg_cron (%). Ative-a pelo painel do Supabase em Database → Extensions → pg_cron e rode este arquivo de novo para agendar o aviso semanal.', sqlerrm;
    return;
  end;

  create or replace function privado.lembrar_preco_frutas()
  returns void
  language plpgsql
  security definer
  set search_path = ''
  as $f$
  begin
    perform privado.enviar_ntfy(
      'Conferência de preços — frutas',
      'Confirme ou ajuste o preço de cada fruta desta semana, em Estoque.'
    );
  exception when others then
    raise warning 'lembrete de preço de frutas falhou: %', sqlerrm;
  end;
  $f$;

  revoke all on function privado.lembrar_preco_frutas() from public, anon, authenticated;

  if exists (select 1 from cron.job where jobname = 'lembrete-preco-frutas') then
    perform cron.unschedule('lembrete-preco-frutas');
  end if;

  -- '0 10 * * 1' em UTC = segunda-feira 7h em Aracaju (UTC-3, sem horário de
  -- verão). pg_cron roda em UTC por padrão no Supabase.
  perform cron.schedule(
    'lembrete-preco-frutas',
    '0 10 * * 1',
    $job$select privado.lembrar_preco_frutas();$job$
  );

  raise notice 'Aviso semanal de conferência de preços agendado: toda segunda às 7h (Aracaju), pelo mesmo tópico ntfy da migracao-20.';
end;
$$;

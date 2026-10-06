-- ============================================================================
--  Migração 32 — aviso diário de contagem de estoque (frutas)
--
--  Mesma ideia da migracao-31 (aviso semanal de insumos), só que TODO DIA às
--  16h30 (horário de Aracaju, UTC-3 o ano todo): lembrete pelo ntfy — mesmo
--  tópico já usado para pedidos novos (migracao-20) e para a contagem de
--  insumos — para contar o depósito e registrar o acerto de inventário de
--  cada fruta em Estoque.
--
--  Best-effort, como a 31: se a migracao-20 (privado.enviar_ntfy) ainda não
--  foi aplicada, ou o projeto não tiver o pg_cron disponível, este arquivo
--  não quebra nada — só o agendamento fica de fora, com um aviso explicando
--  o que falta.
--
--  Para testar sem esperar as 16h30:
--       select privado.lembrar_contagem_frutas();
--
--  Para desligar: select cron.unschedule('lembrete-contagem-frutas');
--
--  Idempotente: pode rodar de novo sem duplicar o agendamento.
-- ============================================================================

do $$
begin
  if to_regprocedure('privado.enviar_ntfy(text,text,text)') is null then
    raise notice 'privado.enviar_ntfy não existe — rode a migracao-20-notificacao-pedidos.sql primeiro para ligar o aviso diário de contagem (opcional).';
    return;
  end if;

  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'Não deu para criar a extensão pg_cron (%). Ative-a pelo painel do Supabase em Database → Extensions → pg_cron e rode este arquivo de novo para agendar o aviso diário.', sqlerrm;
    return;
  end;

  create or replace function privado.lembrar_contagem_frutas()
  returns void
  language plpgsql
  security definer
  set search_path = ''
  as $f$
  begin
    perform privado.enviar_ntfy(
      'Contagem de estoque — frutas',
      'Confira o depósito e registre o acerto de inventário de cada fruta em Estoque.'
    );
  exception when others then
    raise warning 'lembrete de contagem de frutas falhou: %', sqlerrm;
  end;
  $f$;

  revoke all on function privado.lembrar_contagem_frutas() from public, anon, authenticated;

  if exists (select 1 from cron.job where jobname = 'lembrete-contagem-frutas') then
    perform cron.unschedule('lembrete-contagem-frutas');
  end if;

  -- '30 19 * * *' em UTC = todo dia 16h30 em Aracaju (UTC-3, sem horário de
  -- verão). pg_cron roda em UTC por padrão no Supabase.
  perform cron.schedule(
    'lembrete-contagem-frutas',
    '30 19 * * *',
    $job$select privado.lembrar_contagem_frutas();$job$
  );

  raise notice 'Aviso diário de contagem de frutas agendado: todo dia às 16h30 (Aracaju), pelo mesmo tópico ntfy da migracao-20.';
end;
$$;

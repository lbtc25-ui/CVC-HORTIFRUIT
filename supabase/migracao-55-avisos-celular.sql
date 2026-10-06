-- ============================================================================
--  Migração 55 — avisos no celular (ntfy): conserto, painel e falta de pedido
--
--  POR QUE OS AVISOS PARARAM: no banco novo (instalar.sql), a configuração do
--  ntfy (privado.notificacao_pedidos) nasce SEM tópico — o tópico antigo
--  ficou no banco velho. Sem tópico, privado.enviar_ntfy sai calada, então
--  nenhum aviso sai: pedido novo, entrega, contagens e preços. E se o
--  pg_cron não estava ligado na hora da instalação, os lembretes agendados
--  ficaram sem agenda, também sem erro visível.
--
--  O que esta migração faz:
--    1. Refaz a base do aviso (pg_net, tabela de configuração, envio) sem
--       apagar um tópico já gravado.
--    2. Painel no app (Sincronização → Avisos no celular, só sócio master):
--       ver se está tudo ligado, gravar o tópico, mandar um teste e religar
--       os agendamentos — sem precisar do SQL Editor.
--    3. Aviso diário de FALTA DE PEDIDO (7h45, Aracaju): os clientes que
--       passaram do dia de sempre sem pedir e os esperados hoje. Mesma conta
--       da aba Previsão de Pedidos (src/lib/previsaoPedidos.js) — mudou lá,
--       mude aqui.
--    4. Lembretes que só tocam quando falta mesmo: a contagem de frutas não
--       avisa se já houve acerto hoje; a de insumos, se já houve contagem na
--       semana.
--    5. (Re)agenda todos os lembretes no pg_cron.
--    6. Avisos das rotas de entrega agrupados: um aviso por "Iniciar rota" e
--       por parada entregue (antes era um por pedido), e sem o "Saiu para
--       entrega" falso ao desfazer uma entrega.
--    7. Garante o tempo real da aba Promotores no banco novo.
--
--  Depois de rodar, no app: Sincronização → Avisos no celular → grave o
--  tópico → Enviar teste. Ou no SQL Editor:
--
--       select public.avisos_celular_configurar('carvalhocruz-pedidos-x7k2q9', 'https://seu-app.vercel.app/', true);
--       select privado.enviar_ntfy('Teste', 'Se chegou, está funcionando.');
--
--  Para testar o aviso de falta de pedido sem esperar as 7h45:
--       select privado.avisar_falta_pedidos();
--       select * from privado.previsao_pedidos();
--
--  Depois da migracao-20 (ou do instalar.sql) e do auth.sql.
--  Idempotente: pode rodar de novo sem duplicar nada nem apagar o tópico.
-- ============================================================================

begin;

create extension if not exists pg_net;

create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;

create table if not exists privado.notificacao_pedidos (
  id        integer primary key default 1 check (id = 1),
  ativo     boolean not null default true,
  servidor  text    not null default 'https://ntfy.sh',
  topico    text,
  url_app   text
);

insert into privado.notificacao_pedidos (id) values (1) on conflict (id) do nothing;

alter table privado.notificacao_pedidos enable row level security;
revoke all on privado.notificacao_pedidos from public, anon, authenticated;

-- Igual à da migracao-20 (mesma assinatura — gatilhos e lembretes chamam esta).
create or replace function privado.enviar_ntfy(titulo text, mensagem text, clique text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg privado.notificacao_pedidos;
  corpo jsonb;
begin
  select * into cfg from privado.notificacao_pedidos where id = 1;
  if cfg is null or not cfg.ativo or coalesce(trim(cfg.topico), '') = '' then
    return;
  end if;

  corpo := jsonb_build_object(
    'topic',   trim(cfg.topico),
    'title',   titulo,
    'message', mensagem,
    'tags',    jsonb_build_array('package')
  );
  if coalesce(clique, cfg.url_app) is not null then
    corpo := corpo || jsonb_build_object('click', coalesce(clique, cfg.url_app));
  end if;

  perform net.http_post(
    url     := rtrim(cfg.servidor, '/') || '/',
    body    := corpo,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
end;
$$;

revoke all on function privado.enviar_ntfy(text, text, text) from public, anon, authenticated;

-- Endereço do app com uma aba aberta (?aba=previsao), para o toque no aviso.
create or replace function privado.link_do_app(aba text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when coalesce(trim(url_app), '') = '' then null
    when url_app like '%?%' then url_app || '&aba=' || aba
    else url_app || '?aba=' || aba
  end
  from privado.notificacao_pedidos where id = 1;
$$;

revoke all on function privado.link_do_app(text) from public, anon, authenticated;

-- Hoje em Aracaju (UTC-3 o ano todo): o banco roda em UTC, e às 22h de
-- Aracaju o UTC já está no dia seguinte.
create or replace function privado.hoje_aracaju()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'America/Maceio')::date; $$;

-- ─── Previsão de pedidos ────────────────────────────────────────────────────
--
-- Espelho de src/lib/previsaoPedidos.js. Por loja ativa: os dias com pedido
-- (não cancelado) dos últimos 120 dias, somados por dia; dos 10 mais
-- recentes sai o intervalo típico (mediana) e os dias fixos da semana (os
-- que se repetem 2+ vezes e cobrem 75% dos pedidos, até 3 dias, ciclo de
-- até 16 dias). O próximo esperado parte do ÚLTIMO pedido — por isso pedido
-- antecipado (ou já lançado para frente) não gera alerta.

create or replace function privado.previsao_pedidos(p_hoje date default null)
returns table (
  loja_id      uuid,
  cliente      text,
  padrao       text,
  ultimo       date,
  esperado     date,
  atraso       integer,
  situacao     text,
  valor_tipico numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  hoje      date := coalesce(p_hoje, privado.hoje_aracaju());
  dias_nome text[] := array['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
  dias_abrev text[] := array['dom','seg','ter','qua','qui','sex','sáb'];
  l         record;
  datas     date[];
  totais    numeric[];
  n         integer;
  cad       numeric;
  contagem  integer[];
  fixos     integer[];
  cobertos  integer;
  d         date;
  folga     integer;
  sem       integer;
  i         integer;
begin
  for l in
    select lo.id, r.nome || ' · ' || lo.nome as nome
      from public.lojas lo
      join public.redes r on r.id = lo.rede_id
     where coalesce(lo.status, 'ativo') <> 'inativo'
       and coalesce(r.status, 'ativo') <> 'inativo'
  loop
    select array_agg(x.data order by x.data), array_agg(x.total order by x.data)
      into datas, totais
      from (
        select v.data, sum(coalesce(v.total, 0)) as total
          from public.vendas v
         where v.loja_id = l.id
           and v.status <> 'cancelado'
           and v.data >= hoje - 120
         group by v.data
         order by v.data desc
         limit 10
      ) x;

    n := coalesce(array_length(datas, 1), 0);
    continue when n < 3;

    select percentile_cont(0.5) within group (order by g)
      into cad
      from (select datas[k + 1] - datas[k] as g from generate_series(1, n - 1) k) s;
    continue when cad is null or cad <= 0;

    -- Dias fixos da semana.
    fixos := '{}';
    if cad <= 16 then
      contagem := array[0,0,0,0,0,0,0];
      for i in 1..n loop
        contagem[extract(dow from datas[i])::int + 1] := contagem[extract(dow from datas[i])::int + 1] + 1;
      end loop;
      cobertos := 0;
      for i in 0..6 loop
        if contagem[i + 1] >= 2 then
          fixos := fixos || i;
          cobertos := cobertos + contagem[i + 1];
        end if;
      end loop;
      if cardinality(fixos) > 3 or cobertos::numeric / n < 0.75 then
        fixos := '{}';
      end if;
    end if;

    ultimo := datas[n];
    if cardinality(fixos) = 0 then
      esperado := ultimo + greatest(1, round(cad))::int;
      folga := greatest(0, round(cad * 0.25)::int - 1);
    else
      d := ultimo + greatest(1, ceil(cad * 0.6))::int;
      for i in 1..7 loop
        exit when extract(dow from d)::int = any (fixos);
        d := d + 1;
      end loop;
      esperado := d;
      folga := 0;
    end if;

    atraso := hoje - esperado;
    sem := greatest(0, hoje - ultimo);
    situacao := case
      when ultimo > hoje then 'lancado'
      when sem > greatest(45, cad * 4) then 'parado'
      when atraso > folga then 'atrasado'
      when atraso >= 0 then 'hoje'
      else 'em_dia'
    end;

    padrao := case
      when cardinality(fixos) = 1 and cad >= 12 then 'a cada 2 semanas, ' || dias_nome[fixos[1] + 1]
      when cardinality(fixos) = 1 then case when fixos[1] in (0, 6) then 'todo ' else 'toda ' end || dias_nome[fixos[1] + 1]
      when cardinality(fixos) > 1 then (select string_agg(dias_abrev[f + 1], ' e ' order by f) from unnest(fixos) f)
      when round(cad) <= 1 then 'todo dia'
      else 'a cada ~' || round(cad)::int || ' dias'
    end;

    select percentile_cont(0.5) within group (order by t)
      into valor_tipico
      from unnest(totais[greatest(1, n - 4):n]) t;

    loja_id := l.id;
    cliente := l.nome;
    return next;
  end loop;
end;
$$;

revoke all on function privado.previsao_pedidos(date) from public, anon, authenticated;

-- ─── Aviso diário de falta de pedido ────────────────────────────────────────

create or replace function privado.avisar_falta_pedidos()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  abrev    text[] := array['dom','seg','ter','qua','qui','sex','sáb'];
  atrasados text;
  hoje_txt  text;
  n_atr    integer;
  n_hoje   integer;
  texto    text;
  brl      text := 'FM999G999G990';
begin
  with p as (select * from privado.previsao_pedidos())
  select
    (select count(*) from p where situacao = 'atrasado'),
    (select count(*) from p where situacao = 'hoje'),
    (select string_agg(
        '• ' || cliente || ' — ' || padrao || ', esperado ' || abrev[extract(dow from esperado)::int + 1]
        || ' ' || to_char(esperado, 'DD/MM') || ' (' || atraso || case when atraso = 1 then ' dia' else ' dias' end
        || ') · R$ ' || translate(to_char(valor_tipico, brl), ',', '.'),
        E'\n' order by valor_tipico desc)
       from (select * from p where situacao = 'atrasado' order by valor_tipico desc limit 15) a),
    (select string_agg(
        '• ' || cliente || ' — ' || padrao || ' · R$ ' || translate(to_char(valor_tipico, brl), ',', '.'),
        E'\n' order by valor_tipico desc)
       from (select * from p where situacao = 'hoje' order by valor_tipico desc limit 15) h)
  into n_atr, n_hoje, atrasados, hoje_txt;

  if n_atr = 0 and n_hoje = 0 then
    return;
  end if;

  texto := concat_ws(E'\n\n',
    case when n_atr > 0 then 'Não pediram no dia de sempre:' || E'\n' || atrasados
      || case when n_atr > 15 then E'\n… e mais ' || (n_atr - 15) else '' end end,
    case when n_hoje > 0 then 'Esperados hoje, ainda sem pedido:' || E'\n' || hoje_txt
      || case when n_hoje > 15 then E'\n… e mais ' || (n_hoje - 15) else '' end end
  );

  perform privado.enviar_ntfy(
    'Falta de pedido — ' || case
      when n_atr > 0 then n_atr || case when n_atr = 1 then ' cliente não pediu' else ' clientes não pediram' end
      else n_hoje || case when n_hoje = 1 then ' esperado hoje' else ' esperados hoje' end
    end,
    texto,
    privado.link_do_app('previsao')
  );
exception when others then
  raise warning 'aviso de falta de pedido falhou: %', sqlerrm;
end;
$$;

revoke all on function privado.avisar_falta_pedidos() from public, anon, authenticated;

-- ─── Lembretes que só tocam quando falta ────────────────────────────────────

create or replace function privado.lembrar_contagem_frutas()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Já contou hoje (acerto registrado): nada a lembrar.
  if exists (select 1 from public.acertos where data = privado.hoje_aracaju()) then
    return;
  end if;
  perform privado.enviar_ntfy(
    'Contagem de estoque — frutas',
    'Confira o depósito e registre o acerto de inventário de cada fruta em Estoque.',
    privado.link_do_app('estoque')
  );
exception when others then
  raise warning 'lembrete de contagem de frutas falhou: %', sqlerrm;
end;
$$;

revoke all on function privado.lembrar_contagem_frutas() from public, anon, authenticated;

create or replace function privado.lembrar_contagem_insumos()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  segunda date := date_trunc('week', privado.hoje_aracaju())::date;
begin
  -- Já contou nesta semana (desde segunda): nada a lembrar.
  if to_regclass('public.contagens_insumos') is not null
     and exists (select 1 from public.contagens_insumos where data >= segunda) then
    return;
  end if;
  perform privado.enviar_ntfy(
    'Contagem de insumos',
    'Hora de contar redinha, grampo e etiquetas — registre em Estoque.',
    privado.link_do_app('estoque')
  );
exception when others then
  raise warning 'lembrete de contagem de insumos falhou: %', sqlerrm;
end;
$$;

revoke all on function privado.lembrar_contagem_insumos() from public, anon, authenticated;

create or replace function privado.lembrar_preco_frutas()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform privado.enviar_ntfy(
    'Conferência de preços — frutas e sacos',
    'Confirme ou ajuste o preço de cada fruta e de cada saco desta semana, em Estoque.',
    privado.link_do_app('estoque')
  );
exception when others then
  raise warning 'lembrete de preço de frutas falhou: %', sqlerrm;
end;
$$;

revoke all on function privado.lembrar_preco_frutas() from public, anon, authenticated;

-- ─── Agendamentos ───────────────────────────────────────────────────────────
--
-- Horários em UTC (pg_cron do Supabase roda em UTC; Aracaju é UTC-3 o ano
-- todo, sem horário de verão). Devolve o que ficou agendado — ou o motivo de
-- não ter dado.

create or replace function privado.agendar_avisos()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  j record;
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    return 'pg_cron indisponível (' || sqlerrm || '). Ligue em Database → Extensions → pg_cron no painel do Supabase e tente de novo.';
  end;

  for j in
    select * from (values
      ('lembrete-contagem-insumos', '0 19 * * 1',   'select privado.lembrar_contagem_insumos();'),  -- seg 16h
      ('lembrete-contagem-frutas',  '30 19 * * *',  'select privado.lembrar_contagem_frutas();'),   -- todo dia 16h30
      ('lembrete-preco-frutas',     '0 10 * * 1',   'select privado.lembrar_preco_frutas();'),      -- seg 7h
      ('aviso-falta-pedidos',       '45 10 * * *',  'select privado.avisar_falta_pedidos();')       -- todo dia 7h45
    ) as t(nome, agenda, comando)
  loop
    execute 'select cron.unschedule(jobid) from cron.job where jobname = $1' using j.nome;
    execute 'select cron.schedule($1, $2, $3)' using j.nome, j.agenda, j.comando;
  end loop;

  return 'ok';
end;
$$;

revoke all on function privado.agendar_avisos() from public, anon, authenticated;

commit;

-- ─── Avisos das rotas de entrega, agrupados ─────────────────────────────────
--
-- Substitui o gatilho por linha da migracao-41, que tinha dois defeitos:
--   - "Desfazer escaneio" de uma entrega (entregue → em_rota, migracao-38)
--     mandava um "Saiu para entrega" falso;
--   - "Iniciar rota" manda o caminhão inteiro para em_rota num UPDATE só, e
--     saía UMA notificação por pedido (15 pedidos = 15 avisos de uma vez, o
--     que também estoura o limite do ntfy.sh e faz avisos seguintes sumirem).
-- Agora o gatilho é por comando: cada "Iniciar rota" vira um aviso só, com
-- as lojas da viagem; cada parada entregue (com os pedidos mesclados dela,
-- migracao-39) também. Só avisa a ida pendente/carregando → em_rota e
-- em_rota → entregue — voltar um passo não avisa nada.

begin;

create or replace function privado.avisar_entrega_motorista_lote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  g        record;
  titulo   text;
  corpo    text;
begin
  -- Só o que vem pela API do app (tem JWT), como na migracao-20.
  if coalesce(current_setting('request.jwt.claims', true), '') = '' then
    return null;
  end if;

  for g in
    select n.status_entrega as st,
           n.motorista_id,
           n.veiculo_id,
           coalesce(n.viagem_rota, 1) as viagem,
           count(*) as qtd,
           string_agg(coalesce(r.nome || ' — ' || l.nome, 'Loja não informada')
                      || coalesce(' (nº ' || n.numero || ')', ''), E'\n• ' order by r.nome, l.nome) as lojas,
           string_agg(n.numero::text, ', ' order by n.numero) as numeros
      from novos n
      join antigos o on o.id = n.id
      left join public.lojas l on l.id = n.loja_id
      left join public.redes r on r.id = l.rede_id
     where (n.status_entrega = 'em_rota' and coalesce(o.status_entrega, 'pendente') in ('pendente', 'carregando'))
        or (n.status_entrega = 'entregue' and o.status_entrega = 'em_rota')
     group by 1, 2, 3, 4
  loop
    begin
      corpo := concat_ws(E'\n',
        (select 'Motorista: ' || f.nome from public.funcionarios f where f.id = g.motorista_id),
        (select 'Veículo: ' || v.nome || case when g.viagem > 1 then ' (' || g.viagem || 'ª viagem)' else '' end
           from public.veiculos v where v.id = g.veiculo_id)
      );
      if g.st = 'em_rota' then
        titulo := 'Saiu para entrega — ' || g.qtd || case when g.qtd = 1 then ' pedido' else ' pedidos' end;
        corpo := concat_ws(E'\n', nullif(corpo, ''), '• ' || g.lojas);
      else
        titulo := 'Entrega realizada' || coalesce(' — pedido nº ' || g.numeros, '');
        corpo := concat_ws(E'\n', replace(g.lojas, E'\n• ', E'\n'), nullif(corpo, ''));
      end if;
      perform privado.enviar_ntfy(titulo, corpo, privado.link_do_app('romaneio'));
    exception when others then
      raise warning 'aviso de entrega falhou: %', sqlerrm;
    end;
  end loop;

  return null;
end;
$$;

revoke all on function privado.avisar_entrega_motorista_lote() from public, anon, authenticated;

-- Tira o gatilho por linha (qualquer nome que tenha) e põe o por comando.
do $$
declare r record;
begin
  for r in
    select t.tgname
      from pg_trigger t
      join pg_proc p on p.oid = t.tgfoid
     where t.tgrelid = 'public.vendas'::regclass
       and p.proname in ('avisar_entrega_motorista', 'avisar_entrega_motorista_lote')
  loop
    execute format('drop trigger %I on public.vendas', r.tgname);
  end loop;
end;
$$;

create trigger vendas_avisar_entrega_motorista
  after update on public.vendas
  referencing old table as antigos new table as novos
  for each statement execute function privado.avisar_entrega_motorista_lote();

commit;

-- ─── Promotores: tela do gestor em tempo real ───────────────────────────────
--
-- A aba Promotores anda sozinha pelo Realtime do Supabase. No banco novo,
-- garante que as duas tabelas estão na publicação (a migracao-08 só põe se
-- a publicação já existir na hora).

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Publicação supabase_realtime não existe — a aba Promotores não vai atualizar sozinha.';
    return;
  end if;
  if to_regclass('public.rotas_promotor') is not null and not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rotas_promotor'
  ) then
    alter publication supabase_realtime add table public.rotas_promotor;
  end if;
  if to_regclass('public.paradas_rota') is not null and not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'paradas_rota'
  ) then
    alter publication supabase_realtime add table public.paradas_rota;
  end if;
end;
$$;

-- ─── Painel no app (só sócio master) ────────────────────────────────────────

create or replace function public.avisos_celular_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg      privado.notificacao_pedidos;
  resposta jsonb;
  jobs     jsonb := '[]'::jsonb;
  envios   jsonb := '[]'::jsonb;
  tem_cron boolean := exists (select 1 from pg_extension where extname = 'pg_cron');
  tem_bucket boolean := false;
begin
  if not public.e_socio() then
    raise exception 'Só o sócio master mexe nos avisos do celular.';
  end if;

  select * into cfg from privado.notificacao_pedidos where id = 1;

  if tem_cron then
    begin
      execute $q$
        select coalesce(jsonb_agg(jsonb_build_object(
                 'nome', j.jobname, 'agenda', j.schedule, 'ativo', j.active,
                 'ultima', r.start_time, 'status', r.status, 'erro', r.return_message
               ) order by j.jobname), '[]'::jsonb)
          from cron.job j
          left join lateral (
            select d.start_time, d.status, d.return_message
              from cron.job_run_details d
             where d.jobid = j.jobid
             order by d.start_time desc
             limit 1
          ) r on true
         where j.jobname in ('lembrete-contagem-insumos', 'lembrete-contagem-frutas',
                             'lembrete-preco-frutas', 'aviso-falta-pedidos')
      $q$ into jobs;
    exception when others then
      jobs := '[]'::jsonb;
    end;
  end if;

  -- Últimas respostas do ntfy (o pg_net guarda por algumas horas).
  begin
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object(
               'quando', x.created, 'codigo', x.status_code, 'erro', x.error_msg
             ) order by x.created desc), '[]'::jsonb)
        from (select created, status_code, error_msg from net._http_response order by created desc limit 5) x
    $q$ into envios;
  exception when others then
    envios := '[]'::jsonb;
  end;

  begin
    execute $q$select exists (select 1 from storage.buckets where id = 'promotores-fotos')$q$ into tem_bucket;
  exception when others then
    tem_bucket := false;
  end;

  resposta := jsonb_build_object(
    'gatilho_pedido', exists (select 1 from pg_trigger where tgrelid = 'public.vendas'::regclass and tgname = 'vendas_avisar_pedido_novo' and tgenabled <> 'D'),
    'gatilho_entrega', exists (select 1 from pg_trigger where tgrelid = 'public.vendas'::regclass and tgname = 'vendas_avisar_entrega_motorista' and tgenabled <> 'D'),
    'tempo_real_promotores', (select count(*) = 2 from pg_publication_tables
                               where pubname = 'supabase_realtime' and schemaname = 'public'
                                 and tablename in ('rotas_promotor', 'paradas_rota')),
    'fotos_promotores', tem_bucket,
    'ativo',    coalesce(cfg.ativo, false),
    'servidor', cfg.servidor,
    'topico',   cfg.topico,
    'url_app',  cfg.url_app,
    'pg_net',   exists (select 1 from pg_extension where extname = 'pg_net'),
    'pg_cron',  tem_cron,
    'jobs',     jobs,
    'envios',   envios
  );
  return resposta;
end;
$$;

create or replace function public.avisos_celular_configurar(p_topico text, p_url_app text default null, p_ativo boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_topico text := nullif(trim(p_topico), '');
begin
  if not public.e_socio() then
    raise exception 'Só o sócio master mexe nos avisos do celular.';
  end if;
  if v_topico is not null and v_topico !~ '^[A-Za-z0-9_-]{1,64}$' then
    raise exception 'Tópico inválido: use só letras, números, - e _ (sem espaço nem acento).';
  end if;

  update privado.notificacao_pedidos
     set topico  = v_topico,
         url_app = nullif(trim(p_url_app), ''),
         ativo   = coalesce(p_ativo, true)
   where id = 1;

  return public.avisos_celular_status();
end;
$$;

create or replace function public.avisos_celular_testar()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.e_socio() then
    raise exception 'Só o sócio master mexe nos avisos do celular.';
  end if;
  perform privado.enviar_ntfy('Teste — Carvalho Cruz', 'Se chegou, os avisos no celular estão funcionando.');
end;
$$;

create or replace function public.avisos_celular_testar_falta_pedidos()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.e_socio() then
    raise exception 'Só o sócio master mexe nos avisos do celular.';
  end if;
  perform privado.avisar_falta_pedidos();
end;
$$;

create or replace function public.avisos_celular_agendar()
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.e_socio() then
    raise exception 'Só o sócio master mexe nos avisos do celular.';
  end if;
  return privado.agendar_avisos();
end;
$$;

revoke all on function public.avisos_celular_status() from public, anon;
revoke all on function public.avisos_celular_configurar(text, text, boolean) from public, anon;
revoke all on function public.avisos_celular_testar() from public, anon;
revoke all on function public.avisos_celular_testar_falta_pedidos() from public, anon;
revoke all on function public.avisos_celular_agendar() from public, anon;
grant execute on function public.avisos_celular_status() to authenticated;
grant execute on function public.avisos_celular_configurar(text, text, boolean) to authenticated;
grant execute on function public.avisos_celular_testar() to authenticated;
grant execute on function public.avisos_celular_testar_falta_pedidos() to authenticated;
grant execute on function public.avisos_celular_agendar() to authenticated;

-- ─── Liga os agendamentos agora ─────────────────────────────────────────────

do $$
declare r text;
begin
  r := privado.agendar_avisos();
  if r = 'ok' then
    raise notice 'Avisos agendados: falta de pedido (todo dia 7h45), contagem de frutas (todo dia 16h30), insumos (seg 16h) e preços (seg 7h), horário de Aracaju.';
  else
    raise notice '%', r;
  end if;
  if not exists (select 1 from privado.notificacao_pedidos where id = 1 and coalesce(trim(topico), '') <> '') then
    raise notice 'ATENÇÃO: nenhum tópico do ntfy gravado — nenhum aviso sai até gravar. No app: Sincronização → Avisos no celular.';
  end if;
end;
$$;

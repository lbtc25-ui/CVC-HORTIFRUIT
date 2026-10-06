-- ============================================================================
--  Migração 31 — estoque de insumos de produção (redinha, grampo, etiquetas)
--
--  O que embala o sanquinho de laranja: redinha, grampo e etiqueta (uma por
--  peso — 2,5 kg, 3 kg, 5 kg e 10 kg). Diferente da fruta, não tem compra
--  lançada linha a linha pelo app para virar conta — hoje isso é uma
--  despesa solta em Despesas (GRAMPOS, ETIQUETAS). O que controla aqui é a
--  CONTAGEM física: toda semana alguém conta o que tem no depósito e
--  registra; o saldo de cada item é sempre a última contagem dele.
--
--  Duas tabelas:
--
--    insumos_itens      cadastro fixo — nome, unidade e o estoque mínimo que
--                        dispara o alerta de "abaixo do mínimo". Semeada com
--                        os 6 itens de hoje; dá para desativar ou ajustar o
--                        mínimo pela tela, sem SQL.
--    contagens_insumos  uma linha por item contado, com data e quantidade —
--                        o histórico. Sem venda/perda: o que sobra de uma
--                        contagem pra outra é assunto do depósito, não do
--                        app.
--
--  Alerta semanal (opcional): se a migracao-20-notificacao-pedidos.sql já
--  está aplicada (o aviso de pedido novo pelo ntfy), este arquivo tenta
--  agendar, pelo pg_cron, um aviso toda SEGUNDA às 16h (horário de Aracaju,
--  UTC-3 o ano todo — Brasil não tem mais horário de verão) lembrando de
--  contar os insumos. Usa o MESMO tópico do ntfy já configurado — não é
--  preciso outro. Se o projeto não tiver o pg_cron disponível, o resto da
--  migração roda igual; só o agendamento fica de fora (veja o aviso que a
--  consulta imprime) — nesse caso, ligue a extensão pg_cron pelo painel do
--  Supabase (Database → Extensions) e rode este arquivo de novo.
--
--  Para testar o aviso sem esperar a segunda-feira:
--       select privado.lembrar_contagem_insumos();
--
--  Rode antes de publicar a versão do app que traz a aba de insumos — sem
--  as tabelas, as contagens ficam presas na fila de Sincronização.
--
--  Idempotente: pode rodar de novo sem duplicar itens nem o agendamento.
-- ============================================================================

begin;

create table if not exists public.insumos_itens (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null unique,
  unidade        text not null default 'unidade',
  estoque_minimo numeric(12,2) not null default 0 check (estoque_minimo >= 0),
  ordem          integer not null default 0,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create table if not exists public.contagens_insumos (
  id             uuid primary key default gen_random_uuid(),
  data           date not null default current_date,
  item           text not null,
  quantidade     numeric(12,2) not null default 0 check (quantidade >= 0),
  observacao     text,
  criado_em      timestamptz not null default now()
);

create index if not exists contagens_insumos_data_idx on public.contagens_insumos (data desc);
create index if not exists contagens_insumos_item_idx on public.contagens_insumos (item);

drop trigger if exists insumos_itens_atualizado_em on public.insumos_itens;
create trigger insumos_itens_atualizado_em before update on public.insumos_itens
  for each row execute function public.tocar_atualizado_em();

-- Os 6 itens de hoje. `on conflict do nothing` porque o nome é único: rodar
-- de novo não duplica, e um item renomeado ou removido pela tela fica assim.
insert into public.insumos_itens (id, nome, unidade, estoque_minimo, ordem) values
  ('11100000-0000-4000-8000-000000000001', 'Redinha',          'unidade', 0, 1),
  ('11100000-0000-4000-8000-000000000002', 'Grampo',           'unidade', 0, 2),
  ('11100000-0000-4000-8000-000000000003', 'Etiqueta 2,5 kg',  'unidade', 0, 3),
  ('11100000-0000-4000-8000-000000000004', 'Etiqueta 3 kg',    'unidade', 0, 4),
  ('11100000-0000-4000-8000-000000000005', 'Etiqueta 5 kg',    'unidade', 0, 5),
  ('11100000-0000-4000-8000-000000000006', 'Etiqueta 10 kg',   'unidade', 0, 6)
on conflict (nome) do nothing;

-- ─── Acesso ─────────────────────────────────────────────────────────────────
--
-- Mesma regra da aba Estoque: gestor (sócio master e assistente) lê e grava;
-- exclusão passa por pode_excluir_registros(). Antes do auth.sql, fica
-- aberta como as demais tabelas nessa fase.

alter table public.insumos_itens     enable row level security;
alter table public.contagens_insumos enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['insumos_itens', 'contagens_insumos'] loop
    execute format('drop policy if exists acesso_app        on public.%I', t);
    execute format('drop policy if exists %I_leitura        on public.%I', t, t);
    execute format('drop policy if exists %I_insercao       on public.%I', t, t);
    execute format('drop policy if exists %I_atualizacao    on public.%I', t, t);
    execute format('drop policy if exists %I_exclusao       on public.%I', t, t);

    if to_regprocedure('public.e_gestor()') is not null then
      execute format(
        'create policy %I_leitura on public.%I for select to authenticated using (public.e_gestor())',
        t, t);
      execute format(
        'create policy %I_insercao on public.%I for insert to authenticated with check (public.e_gestor())',
        t, t);
      execute format(
        'create policy %I_atualizacao on public.%I for update to authenticated using (public.e_gestor()) with check (public.e_gestor())',
        t, t);

      if to_regprocedure('public.pode_excluir_registros()') is not null then
        execute format(
          'create policy %I_exclusao on public.%I for delete to authenticated using (public.pode_excluir_registros())',
          t, t);
      else
        execute format(
          'create policy %I_exclusao on public.%I for delete to authenticated using (public.e_socio())',
          t, t);
      end if;

      execute format('revoke all on public.%I from anon', t);
      execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    else
      -- Antes do auth.sql: aberta, como as outras tabelas nessa fase.
      execute format(
        'create policy acesso_app on public.%I for all to anon, authenticated using (true) with check (true)',
        t);
      execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
    end if;
  end loop;
end;
$$;

commit;

-- ============================================================================
--  Aviso semanal — melhor esforço, fora da transação acima: se o pg_cron não
--  estiver disponível ou o aviso de pedidos (migracao-20) ainda não tiver
--  sido ligado, as duas tabelas de insumos continuam criadas do mesmo jeito.
-- ============================================================================

do $$
begin
  if to_regprocedure('privado.enviar_ntfy(text,text,text)') is null then
    raise notice 'privado.enviar_ntfy não existe — rode a migracao-20-notificacao-pedidos.sql primeiro para ligar o aviso semanal de contagem (opcional).';
    return;
  end if;

  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'Não deu para criar a extensão pg_cron (%). Ative-a pelo painel do Supabase em Database → Extensions → pg_cron e rode este arquivo de novo para agendar o aviso semanal.', sqlerrm;
    return;
  end;

  create or replace function privado.lembrar_contagem_insumos()
  returns void
  language plpgsql
  security definer
  set search_path = ''
  as $f$
  begin
    perform privado.enviar_ntfy(
      'Contagem de estoque — insumos',
      E'Confira o depósito e registre no app quanto tem de:\nRedinha, Grampo, Etiqueta 2,5kg, 3kg, 5kg e 10kg.'
    );
  exception when others then
    raise warning 'lembrete de contagem de insumos falhou: %', sqlerrm;
  end;
  $f$;

  revoke all on function privado.lembrar_contagem_insumos() from public, anon, authenticated;

  if exists (select 1 from cron.job where jobname = 'lembrete-contagem-insumos') then
    perform cron.unschedule('lembrete-contagem-insumos');
  end if;

  -- '0 19 * * 1' em UTC = segunda-feira 16h em Aracaju (UTC-3, sem horário
  -- de verão). pg_cron roda em UTC por padrão no Supabase.
  perform cron.schedule(
    'lembrete-contagem-insumos',
    '0 19 * * 1',
    $job$select privado.lembrar_contagem_insumos();$job$
  );

  raise notice 'Aviso semanal de contagem de insumos agendado: toda segunda às 16h (Aracaju), pelo mesmo tópico ntfy da migracao-20.';
end;
$$;

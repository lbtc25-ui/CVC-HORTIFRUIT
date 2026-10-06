-- ============================================================================
--  Migração 20 — aviso no celular a cada pedido novo (ntfy)
--
--  Toda venda que entra na tabela `vendas` pelo app dispara uma notificação
--  no celular, pelo app gratuito ntfy (https://ntfy.sh — Android e iPhone):
--
--      Novo pedido nº 1234
--      PETROX — BARRA
--      R$ 1.234,56 · 120 kg
--      Lançado por Fulano
--
--  Por que no banco, e não no app: o pedido pode ser criado offline e só
--  subir horas depois pela fila de Sincronização. O banco é o único lugar
--  que vê TODO pedido novo, venha do aparelho que vier.
--
--  Como funciona: um gatilho AFTER INSERT em `vendas` chama o ntfy pela
--  extensão pg_net. A chamada é assíncrona — não atrasa a gravação da venda —
--  e qualquer erro nela é engolido: o aviso nunca impede um pedido de entrar.
--
--  Só avisa o que chega pela API do app (quem usa a chave do Supabase). O
--  que é rodado no SQL Editor — importacao-planilha.sql, seed, históricos —
--  NÃO avisa: senão reimportar a planilha mandaria centenas de notificações.
--  Venda editada também não avisa: a sincronização grava com upsert, e o
--  gatilho é só de INSERT, então alterar um pedido que já existe fica quieto.
--
--  ─── Como ligar ────────────────────────────────────────────────────────────
--
--  1. Instale o app "ntfy" no celular.
--  2. Invente um nome de tópico difícil de adivinhar — é ele que protege os
--     avisos: quem souber o nome também recebe. Ex.: carvalhocruz-pedidos-x7k2q9
--  3. No app ntfy toque em "+" (Inscrever-se), digite o tópico e confirme.
--     Pode inscrever quantos celulares quiser no mesmo tópico.
--  4. Rode este arquivo no SQL Editor do Supabase.
--  5. Grave o tópico (e, se quiser, o endereço do app — tocar no aviso abre
--     o app nas Vendas):
--
--       update privado.notificacao_pedidos
--          set topico  = 'carvalhocruz-pedidos-x7k2q9',
--              url_app = 'https://seu-app.vercel.app/'
--        where id = 1;
--
--  Para testar sem lançar pedido, rode no SQL Editor:
--
--       select privado.enviar_ntfy('Teste', 'Se chegou, está funcionando.');
--
--  Para desligar: update privado.notificacao_pedidos set ativo = false where id = 1;
--
--  O tópico fica no schema `privado`, que a API do Supabase não expõe: nem a
--  chave anon nem usuário logado conseguem lê-lo — só o SQL Editor.
--
--  Idempotente: pode rodar de novo sem quebrar nada nem apagar o tópico.
-- ============================================================================

begin;

create extension if not exists pg_net;

create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;

-- ─── Configuração (uma linha só) ────────────────────────────────────────────

create table if not exists privado.notificacao_pedidos (
  id        integer primary key default 1 check (id = 1),
  ativo     boolean not null default true,
  servidor  text    not null default 'https://ntfy.sh',
  topico    text,
  url_app   text
);

insert into privado.notificacao_pedidos (id) values (1) on conflict (id) do nothing;

-- RLS ligado e sem política: ninguém pela API lê a linha. As funções abaixo
-- são SECURITY DEFINER do dono da tabela, que passa por cima do RLS.
alter table privado.notificacao_pedidos enable row level security;
revoke all on privado.notificacao_pedidos from public, anon, authenticated;

-- ─── Envio ──────────────────────────────────────────────────────────────────
--
-- Publica pelo formato JSON do ntfy (POST na raiz do servidor, com o tópico
-- no corpo) — assim título e texto com acento vão sem mexer em cabeçalho.

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

-- ─── Gatilho em vendas ──────────────────────────────────────────────────────

create or replace function privado.avisar_pedido_novo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cliente  text;
  quem     text;
  valor    text;
  texto    text;
  -- Pedido feito pelo próprio cliente no link (migracao-21). Lido via jsonb
  -- para este gatilho funcionar mesmo antes de a coluna `origem` existir.
  do_link  boolean := (to_jsonb(new) ->> 'origem') = 'cliente';
  -- Quem pediu no link (migracao-29); vazio antes de a coluna existir.
  pediu    text := nullif(trim(to_jsonb(new) ->> 'pedido_por'), '');
begin
  -- Só o que vem pela API do app: no SQL Editor não há JWT da requisição.
  if coalesce(current_setting('request.jwt.claims', true), '') = '' then
    return new;
  end if;

  begin
    select r.nome || ' — ' || l.nome
      into cliente
      from public.lojas l
      join public.redes r on r.id = l.rede_id
     where l.id = new.loja_id;

    -- perfis só existe depois do auth.sql; sem login, fica sem o "lançado por".
    if auth.uid() is not null and to_regclass('public.perfis') is not null then
      execute 'select nullif(trim(nome), '''') from public.perfis where id = $1'
         into quem using auth.uid();
    end if;

    -- 1234.5 → "1.234,50" (sem depender do locale do servidor)
    valor := translate(to_char(coalesce(new.total, 0), 'FM999,999,990.00'), ',.', '.,');

    texto := coalesce(cliente, 'Cliente não informado')
          || E'\nR$ ' || valor
          || case when coalesce(new.kg_total, 0) > 0
                  then ' · ' || translate(rtrim(to_char(new.kg_total, 'FM999,999,990.999'), '.'), ',.', '.,') || ' kg'
                  else '' end
          || case when new.status = 'cancelado' then E'\n(lançado como cancelado)' else '' end
          || case when do_link then E'\nFeito pelo cliente no link' || coalesce(' por ' || pediu, '') || ' — conferir preço'
                  when quem is not null then E'\nLançado por ' || quem else '' end;

    perform privado.enviar_ntfy(
      case when do_link then 'Pedido do cliente' else 'Novo pedido' end || coalesce(' nº ' || new.numero, ''),
      texto
    );
  exception when others then
    -- O aviso nunca pode impedir o pedido de ser gravado.
    raise warning 'aviso de pedido novo falhou: %', sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function privado.avisar_pedido_novo() from public, anon, authenticated;

drop trigger if exists vendas_avisar_pedido_novo on public.vendas;
create trigger vendas_avisar_pedido_novo
  after insert on public.vendas
  for each row execute function privado.avisar_pedido_novo();

commit;

-- ============================================================================
--  Migração 56 — sinalizações nos alertas da Previsão de Pedidos
--
--  Quem cuida dos clientes marca o alerta de falta de pedido:
--
--    lembrar → "me lembre em DD/MM": o alerta some até o dia e volta nele
--              como lembrete, com o motivo;
--    ciente  → "já sei": some até o próximo pedido do cliente;
--    parou   → "parou de pedir", com o motivo: sai do alerta diário e vai
--              para a lista de Reconquistar; com data, vira alerta de
--              reconquista nesse dia.
--
--  Vale a sinalização mais recente da loja enquanto não for encerrada
--  (encerrada_em) e o cliente não pedir de novo — pedido com data depois de
--  `ultimo_pedido` (o último que ele tinha quando foi sinalizado) encerra
--  sozinho. Nada é apagado: fica o histórico de cada cliente.
--
--  O aviso diário no celular (migracao-55) passa a respeitar isso: não
--  repete quem foi sinalizado e traz os lembretes e reconquistas do dia.
--  Mesma regra de src/lib/previsaoPedidos.js (painelDePedidos) — mudou lá,
--  mude aqui.
--
--  Rode antes de publicar a versão do app que traz as sinalizações — sem a
--  tabela, elas ficam presas na fila de Sincronização. Depois do auth.sql e
--  da migracao-55. Idempotente.
-- ============================================================================

begin;

create table if not exists public.sinalizacoes_clientes (
  id             uuid primary key default gen_random_uuid(),
  loja_id        uuid not null references public.lojas (id) on delete cascade,
  tipo           text not null check (tipo in ('lembrar', 'ciente', 'parou')),
  data           date,
  motivo         text,
  ultimo_pedido  date,
  autor          text,
  encerrada_em   timestamptz,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists sinalizacoes_clientes_loja_idx on public.sinalizacoes_clientes (loja_id, criado_em desc);

alter table public.sinalizacoes_clientes enable row level security;

drop policy if exists acesso_app                     on public.sinalizacoes_clientes;
drop policy if exists sinalizacoes_leitura           on public.sinalizacoes_clientes;
drop policy if exists sinalizacoes_insercao          on public.sinalizacoes_clientes;
drop policy if exists sinalizacoes_atualizacao       on public.sinalizacoes_clientes;
drop policy if exists sinalizacoes_exclusao          on public.sinalizacoes_clientes;

do $$
begin
  if to_regprocedure('public.e_gestor()') is not null then
    create policy sinalizacoes_leitura on public.sinalizacoes_clientes
      for select to authenticated using (public.e_gestor());
    create policy sinalizacoes_insercao on public.sinalizacoes_clientes
      for insert to authenticated with check (public.e_gestor());
    create policy sinalizacoes_atualizacao on public.sinalizacoes_clientes
      for update to authenticated using (public.e_gestor()) with check (public.e_gestor());
    if to_regprocedure('public.pode_excluir_registros()') is not null then
      create policy sinalizacoes_exclusao on public.sinalizacoes_clientes
        for delete to authenticated using (public.pode_excluir_registros());
    else
      create policy sinalizacoes_exclusao on public.sinalizacoes_clientes
        for delete to authenticated using (public.e_socio());
    end if;

    revoke all on public.sinalizacoes_clientes from anon;
    grant select, insert, update, delete on public.sinalizacoes_clientes to authenticated;
  else
    create policy acesso_app on public.sinalizacoes_clientes
      for all to anon, authenticated using (true) with check (true);
    grant select, insert, update, delete on public.sinalizacoes_clientes to anon, authenticated;
  end if;
end;
$$;

commit;

-- ─── Aviso diário no celular, respeitando as sinalizações ──────────────────

do $outer$
begin
  if to_regprocedure('privado.previsao_pedidos(date)') is null then
    raise notice 'privado.previsao_pedidos não existe — rode a migracao-55-avisos-celular.sql e depois esta de novo para o aviso no celular respeitar as sinalizações.';
    return;
  end if;

  -- As sinalizações em vigor hoje.
  create or replace function privado.sinalizacoes_ativas()
  returns table (loja_id uuid, tipo text, data date, motivo text, cliente text)
  language sql
  stable
  security definer
  set search_path = ''
  as $f$
    with recente as (
      select distinct on (s.loja_id) s.*
        from public.sinalizacoes_clientes s
       order by s.loja_id, s.criado_em desc
    ),
    ultimo as (
      select v.loja_id, max(v.data) as data
        from public.vendas v
       where v.status <> 'cancelado' and v.loja_id is not null
       group by v.loja_id
    )
    select r.loja_id, r.tipo, r.data, r.motivo,
           coalesce(rd.nome || ' · ' || l.nome, l.nome, 'Cliente')
      from recente r
      left join ultimo u on u.loja_id = r.loja_id
      left join public.lojas l on l.id = r.loja_id
      left join public.redes rd on rd.id = l.rede_id
     where r.encerrada_em is null
       and not (u.data is not null and (r.ultimo_pedido is null or u.data > r.ultimo_pedido));
  $f$;

  revoke all on function privado.sinalizacoes_ativas() from public, anon, authenticated;

  create or replace function privado.avisar_falta_pedidos()
  returns void
  language plpgsql
  security definer
  set search_path = ''
  as $f$
  declare
    abrev      text[] := array['dom','seg','ter','qua','qui','sex','sáb'];
    hoje       date := privado.hoje_aracaju();
    brl        text := 'FM999G999G990';
    n_rec      integer;
    n_lem      integer;
    n_atr      integer;
    n_hoje     integer;
    t_rec      text;
    t_lem      text;
    t_atr      text;
    t_hoje     text;
    titulo     text;
  begin
    create temp table if not exists _sinais on commit drop as select * from privado.sinalizacoes_ativas();
    create temp table if not exists _prev on commit drop as
      select p.* from privado.previsao_pedidos() p
       where not exists (select 1 from _sinais s where s.loja_id = p.loja_id);

    select count(*), string_agg('• ' || cliente || coalesce(' — ' || nullif(trim(motivo), ''), ''), E'\n' order by cliente)
      into n_rec, t_rec
      from _sinais where tipo = 'parou' and data <= hoje;

    select count(*), string_agg('• ' || cliente || coalesce(' — ' || nullif(trim(motivo), ''), ''), E'\n' order by cliente)
      into n_lem, t_lem
      from _sinais where tipo = 'lembrar' and data <= hoje;

    select count(*) into n_atr from _prev where situacao = 'atrasado';
    select count(*) into n_hoje from _prev where situacao = 'hoje';

    select string_agg(
             '• ' || cliente || ' — ' || padrao || ', esperado ' || abrev[extract(dow from esperado)::int + 1]
             || ' ' || to_char(esperado, 'DD/MM') || ' (' || atraso || case when atraso = 1 then ' dia' else ' dias' end
             || ') · R$ ' || translate(to_char(valor_tipico, brl), ',', '.'),
             E'\n' order by valor_tipico desc)
      into t_atr
      from (select * from _prev where situacao = 'atrasado' order by valor_tipico desc limit 15) a;

    select string_agg('• ' || cliente || ' — ' || padrao || ' · R$ ' || translate(to_char(valor_tipico, brl), ',', '.'),
             E'\n' order by valor_tipico desc)
      into t_hoje
      from (select * from _prev where situacao = 'hoje' order by valor_tipico desc limit 15) h;

    drop table if exists _sinais;
    drop table if exists _prev;

    if n_rec + n_lem + n_atr + n_hoje = 0 then
      return;
    end if;

    titulo := concat_ws(' · ',
      case when n_rec > 0 then n_rec || ' para reconquistar' end,
      case when n_lem > 0 then n_lem || case when n_lem = 1 then ' lembrete' else ' lembretes' end end,
      case when n_atr > 0 then n_atr || case when n_atr = 1 then ' não pediu' else ' não pediram' end end,
      case when n_hoje > 0 then n_hoje || case when n_hoje = 1 then ' esperado hoje' else ' esperados hoje' end end
    );

    perform privado.enviar_ntfy(
      'Clientes — ' || titulo,
      concat_ws(E'\n\n',
        case when n_rec > 0 then 'Reconquistar hoje:' || E'\n' || t_rec end,
        case when n_lem > 0 then 'Lembretes de hoje:' || E'\n' || t_lem end,
        case when n_atr > 0 then 'Não pediram no dia de sempre:' || E'\n' || t_atr
          || case when n_atr > 15 then E'\n… e mais ' || (n_atr - 15) else '' end end,
        case when n_hoje > 0 then 'Esperados hoje, ainda sem pedido:' || E'\n' || t_hoje
          || case when n_hoje > 15 then E'\n… e mais ' || (n_hoje - 15) else '' end end
      ),
      privado.link_do_app('previsao')
    );
  exception when others then
    raise warning 'aviso de falta de pedido falhou: %', sqlerrm;
  end;
  $f$;

  revoke all on function privado.avisar_falta_pedidos() from public, anon, authenticated;

  raise notice 'Aviso diário de falta de pedido agora respeita as sinalizações (lembrar, ciente, parou).';
end;
$outer$;

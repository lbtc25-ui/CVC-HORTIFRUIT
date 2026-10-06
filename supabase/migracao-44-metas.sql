-- ============================================================================
--  Migração 44 — Metas (aba Metas, só do sócio master)
--
--  O sócio master define as metas da distribuidora por período — diária,
--  semanal, mensal e anual — para cada indicador:
--
--    faturamento  → R$ vendidos (sem bonificação, sem pedido cancelado)
--    kg_total     → quilos vendidos
--    kg_agranel   → quilos vendidos de produto agranel (por kg ou unidade)
--    kg_saco      → quilos vendidos em sacos
--    qtd_sacos    → quantidade de sacos vendidos
--
--  `fruta` vazia é a meta geral da distribuidora; preenchida, é a meta
--  daquela fruta. O realizado não é gravado: o app calcula em cima das
--  vendas, do mesmo jeito que o DRE.
--
--  Não há índice único em (periodo, indicador, fruta): dois aparelhos
--  offline podem gravar a mesma meta, e um conflito de chave travaria a fila
--  de sincronização. O app usa sempre a mais recente (atualizado_em).
--
--  Acesso: só o sócio master lê e grava — é quem define as metas.
--
--  Como aplicar: depois do auth.sql. Idempotente: pode rodar de novo.
-- ============================================================================

begin;

create table if not exists public.metas (
  id            uuid primary key default gen_random_uuid(),
  periodo       text not null check (periodo in ('diaria', 'semanal', 'mensal', 'anual')),
  indicador     text not null check (indicador in ('faturamento', 'kg_total', 'kg_agranel', 'kg_saco', 'qtd_sacos')),
  fruta         text,
  valor         numeric(14,2) not null default 0 check (valor >= 0),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists metas_periodo_idx on public.metas (periodo, indicador);

alter table public.metas enable row level security;

drop policy if exists acesso_app          on public.metas;
drop policy if exists metas_leitura       on public.metas;
drop policy if exists metas_insercao      on public.metas;
drop policy if exists metas_atualizacao   on public.metas;
drop policy if exists metas_exclusao      on public.metas;

do $$
begin
  if to_regprocedure('public.e_socio()') is not null then
    create policy metas_leitura on public.metas
      for select to authenticated using (public.e_socio());
    create policy metas_insercao on public.metas
      for insert to authenticated with check (public.e_socio());
    create policy metas_atualizacao on public.metas
      for update to authenticated using (public.e_socio()) with check (public.e_socio());
    create policy metas_exclusao on public.metas
      for delete to authenticated using (public.e_socio());

    revoke all on public.metas from anon;
    grant select, insert, update, delete on public.metas to authenticated;
  else
    -- Antes do auth.sql: aberta, como as outras tabelas nessa fase.
    create policy acesso_app on public.metas
      for all to anon, authenticated using (true) with check (true);
    grant select, insert, update, delete on public.metas to anon, authenticated;
  end if;
end;
$$;

commit;

-- Confira:  select periodo, indicador, coalesce(fruta, 'GERAL'), valor from public.metas order by 1, 3, 2;

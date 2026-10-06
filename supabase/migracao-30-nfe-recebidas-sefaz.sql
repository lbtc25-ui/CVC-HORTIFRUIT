-- ============================================================================
--  Migração 30 — NF-e recebidas direto da SEFAZ (sem a Spedy)
--
--  A busca das notas emitidas contra o CNPJ da empresa passa a ser feita pelo
--  próprio app, no serviço de Distribuição DF-e da SEFAZ, com o certificado
--  A1 (api/sefaz.js). Duas tabelas:
--
--    nfe_recebidas     uma linha por nota: primeiro o resumo (emitente, valor,
--                      chave); depois da manifestação, o XML completo. Guarda
--                      também cancelamento e manifestação.
--    sefaz_dfe_estado  uma linha só: o último NSU lido e a partir de quando a
--                      SEFAZ deixa consultar de novo (ela bloqueia por uma
--                      hora quem consulta sem ter nada novo).
--
--  Quem grava é só a função do servidor (com a service role, que passa por
--  cima do RLS). O app só lê: gestor (sócio master ou assistente
--  administrativo) quando o auth.sql já está ligado; qualquer um antes dele,
--  como as outras tabelas nessa fase.
--
--  `notas_entrada` (migração 25) continua sendo onde fica a entrada dada na
--  nota — a ligação é pela chave de acesso.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

create table if not exists public.nfe_recebidas (
  chave                   text primary key check (chave ~ '^\d{44}$'),
  ambiente                text not null default 'producao',
  nsu                     bigint,
  emitente_cnpj           text,
  emitente_nome           text,
  emitente_fantasia       text,
  emitente_ie             text,
  emitida_em              timestamptz,
  tipo_nf                 text,                 -- 'saida' (venda para nós) / 'entrada' (ex.: devolução emitida pelo cliente como entrada)
  numero                  bigint,
  serie                   text,
  valor                   numeric(14,2) not null default 0,
  protocolo               text,
  situacao                text not null default 'authorized' check (situacao in ('authorized', 'canceled', 'denied')),
  cancelada_em            timestamptz,
  completo                boolean not null default false,
  xml                     text,                 -- nfeProc completo, quando a SEFAZ libera
  manifestacao            text not null default 'none'
                            check (manifestacao in ('none', 'acknowledged', 'confirmed', 'unknown', 'notPerformed')),
  manifestada_em          timestamptz,
  manifestacao_protocolo  text,
  justificativa           text,
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now()
);

create index if not exists nfe_recebidas_emitida_idx on public.nfe_recebidas (emitida_em desc);

drop trigger if exists nfe_recebidas_atualizado_em on public.nfe_recebidas;
create trigger nfe_recebidas_atualizado_em before update on public.nfe_recebidas
  for each row execute function public.tocar_atualizado_em();

create table if not exists public.sefaz_dfe_estado (
  id                   int primary key default 1 check (id = 1),
  cnpj                 text,
  ambiente             text,
  ult_nsu              bigint not null default 0,
  max_nsu              bigint not null default 0,
  ultima_consulta_em   timestamptz,
  proxima_consulta_em  timestamptz,
  ultimo_cstat         text,
  ultima_mensagem      text,
  em_andamento_ate     timestamptz,           -- trava contra duas buscas ao mesmo tempo
  cert_titular         text,
  cert_valido_ate      timestamptz,
  atualizado_em        timestamptz not null default now()
);

insert into public.sefaz_dfe_estado (id) values (1) on conflict (id) do nothing;

-- ─── Acesso: só leitura para o app ──────────────────────────────────────────

alter table public.nfe_recebidas enable row level security;
alter table public.sefaz_dfe_estado enable row level security;

drop policy if exists nfe_recebidas_leitura on public.nfe_recebidas;
drop policy if exists sefaz_dfe_estado_leitura on public.sefaz_dfe_estado;

revoke all on public.nfe_recebidas from anon, authenticated;
revoke all on public.sefaz_dfe_estado from anon, authenticated;

do $$
begin
  if to_regprocedure('public.e_gestor()') is not null then
    create policy nfe_recebidas_leitura on public.nfe_recebidas
      for select to authenticated using (public.e_gestor());
    create policy sefaz_dfe_estado_leitura on public.sefaz_dfe_estado
      for select to authenticated using (public.e_gestor());
    grant select on public.nfe_recebidas, public.sefaz_dfe_estado to authenticated;
  else
    create policy nfe_recebidas_leitura on public.nfe_recebidas
      for select to anon, authenticated using (true);
    create policy sefaz_dfe_estado_leitura on public.sefaz_dfe_estado
      for select to anon, authenticated using (true);
    grant select on public.nfe_recebidas, public.sefaz_dfe_estado to anon, authenticated;
  end if;
end;
$$;

grant all on public.nfe_recebidas, public.sefaz_dfe_estado to service_role;

commit;

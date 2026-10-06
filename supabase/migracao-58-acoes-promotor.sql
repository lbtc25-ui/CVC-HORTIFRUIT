-- ============================================================================
--  Migração 58 — "ações" dos promotores
--
--  Além das rotas de arrumação de expositor, o gestor passa a lançar "ações"
--  para o promotor realizar: um evento em loja para divulgação, degustação,
--  ativação de marca etc. Cada ação tem promotor, loja (cadastrada ou texto
--  livre), data, título e descrição. O promotor vê em "Minha Rota" e, ao
--  realizar, envia a foto do evento e uma observação — a ação vira "concluída".
--
--  Como aplicar: depois da migracao-08-promotores.sql (usa o bucket de fotos
--  e a função e_gestor()).
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

create table if not exists public.acoes_promotor (
  id               uuid primary key default gen_random_uuid(),
  promotor_id      uuid not null references public.perfis (id) on delete cascade,
  titulo           text not null,
  descricao        text,
  data             date not null default current_date,
  loja_id          uuid references public.lojas (id) on delete set null,
  estabelecimento  text not null,
  endereco         text,
  status           text not null default 'pendente'
                   check (status in ('pendente', 'concluida', 'cancelada')),
  foto_url         text,
  observacao       text,
  concluida_em     timestamptz,
  arquivada        boolean not null default false,
  criado_por       uuid references public.perfis (id) on delete set null,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

alter table public.acoes_promotor drop constraint if exists acoes_promotor_conclusao_exige_foto;
alter table public.acoes_promotor
  add constraint acoes_promotor_conclusao_exige_foto
  check (status <> 'concluida' or foto_url is not null);

create index if not exists acoes_promotor_promotor_idx on public.acoes_promotor (promotor_id);
create index if not exists acoes_promotor_data_idx     on public.acoes_promotor (data desc);

drop trigger if exists acoes_promotor_atualizado_em on public.acoes_promotor;
create trigger acoes_promotor_atualizado_em
  before update on public.acoes_promotor
  for each row execute function public.tocar_atualizado_em();

alter table public.acoes_promotor enable row level security;

drop policy if exists acoes_promotor_leitura     on public.acoes_promotor;
drop policy if exists acoes_promotor_insercao    on public.acoes_promotor;
drop policy if exists acoes_promotor_atualizacao on public.acoes_promotor;
drop policy if exists acoes_promotor_exclusao    on public.acoes_promotor;

create policy acoes_promotor_leitura on public.acoes_promotor
  for select to authenticated
  using (promotor_id = auth.uid() or public.e_gestor());

create policy acoes_promotor_insercao on public.acoes_promotor
  for insert to authenticated
  with check (public.e_gestor());

-- O promotor registra a realização na própria ação; o gestor edita qualquer uma.
create policy acoes_promotor_atualizacao on public.acoes_promotor
  for update to authenticated
  using (promotor_id = auth.uid() or public.e_gestor())
  with check (promotor_id = auth.uid() or public.e_gestor());

create policy acoes_promotor_exclusao on public.acoes_promotor
  for delete to authenticated
  using (public.e_gestor());

revoke all on public.acoes_promotor from anon;
grant select, insert, update, delete on public.acoes_promotor to authenticated;

-- Tempo real — o painel do gestor e a tela do promotor andam sozinhos.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'acoes_promotor'
    ) then
      alter publication supabase_realtime add table public.acoes_promotor;
    end if;
  end if;
end;
$$;

commit;

-- Confira:  select titulo, estabelecimento, data, status from public.acoes_promotor order by criado_em desc;

-- ============================================================================
--  Migração 08 — promotores em campo
--
--  A Carvalho Cruz tem promotores que passam de loja em loja organizando o
--  expositor de laranja. Este arquivo cria o que a aba "Promotores" (gestor)
--  e "Minha Rota" (promotor) precisam:
--
--    rotas_promotor   uma rota, com data e o promotor responsável
--    paradas_rota      cada estabelecimento da rota, em ordem, com o rastro
--                       de quando chegou e as 3 fotos (chegada / antes / depois)
--
--  Mais o bucket de fotos (privado) e a publicação em tempo real, para o
--  painel do gestor atualizar sozinho conforme o promotor sobe cada foto.
--
--  ⚠️  Rode DEPOIS de supabase/auth.sql — usa o papel "promotor" e a função
--      e_gestor() que ele define.
--
--  Como aplicar, NESTA ORDEM:
--    1. schema.sql
--    2. migracao-01-redes-lojas.sql
--    3. migracao-02-compras.sql
--    4. migracao-03-perdas-estoque.sql
--    5. migracao-04-despesas-dre.sql
--    5b. migracao-05-acertos.sql
--    5c. migracao-06-combustivel.sql
--    5d. migracao-07-folha-pagamento.sql
--    6. auth.sql
--    6b. migracao-08-promotores.sql (este)
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

-- ─── Rotas ──────────────────────────────────────────────────────────────────
--
--  Uma rota por promotor por dia (normalmente). "pendente" até ele apertar
--  "Iniciar rota" no aparelho; "concluida" sozinha quando a última parada
--  fecha as 3 fotos — ver o gatilho concluir_rota_se_completa mais abaixo.

create table if not exists public.rotas_promotor (
  id             uuid primary key default gen_random_uuid(),
  promotor_id    uuid not null references public.perfis (id) on delete cascade,
  nome           text not null,
  data           date not null default current_date,
  status         text not null default 'pendente'
                 check (status in ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  iniciada_em    timestamptz,
  concluida_em   timestamptz,
  criado_por     uuid references public.perfis (id) on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists rotas_promotor_promotor_idx on public.rotas_promotor (promotor_id);
create index if not exists rotas_promotor_data_idx     on public.rotas_promotor (data desc);

drop trigger if exists rotas_promotor_atualizado_em on public.rotas_promotor;
create trigger rotas_promotor_atualizado_em
  before update on public.rotas_promotor
  for each row execute function public.tocar_atualizado_em();

-- ─── Paradas ────────────────────────────────────────────────────────────────
--
--  `loja_id` é opcional — a parada pode apontar para uma loja já cadastrada
--  (aparece na busca ao montar a rota) ou ser só texto livre, para um ponto
--  de venda que ainda não está no cadastro. O nome e o endereço ficam
--  copiados nas colunas próprias porque o promotor não tem acesso de leitura
--  a `lojas`/`redes` — só ao que está aqui, já pronto para mostrar na tela.
--
--  A trava de negócio pedida — só libera o próximo destino com as 3 fotos —
--  vira constraint: não dá para marcar "concluida" sem elas.

create table if not exists public.paradas_rota (
  id                uuid primary key default gen_random_uuid(),
  rota_id           uuid not null references public.rotas_promotor (id) on delete cascade,
  ordem             integer not null check (ordem > 0),
  loja_id           uuid references public.lojas (id) on delete set null,
  estabelecimento   text not null,
  endereco          text,
  status            text not null default 'pendente'
                    check (status in ('pendente', 'em_andamento', 'concluida')),
  chegada_em        timestamptz,
  chegada_lat       double precision,
  chegada_lng       double precision,
  foto_chegada_url  text,
  foto_antes_url    text,
  foto_depois_url   text,
  concluida_em      timestamptz,
  observacao        text,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

alter table public.paradas_rota drop constraint if exists paradas_rota_conclusao_exige_fotos;
alter table public.paradas_rota
  add constraint paradas_rota_conclusao_exige_fotos
  check (
    status <> 'concluida'
    or (foto_chegada_url is not null and foto_antes_url is not null and foto_depois_url is not null)
  );

create unique index if not exists paradas_rota_ordem_unico_idx on public.paradas_rota (rota_id, ordem);
create index if not exists paradas_rota_rota_idx    on public.paradas_rota (rota_id);
create index if not exists paradas_rota_status_idx  on public.paradas_rota (status);

drop trigger if exists paradas_rota_atualizado_em on public.paradas_rota;
create trigger paradas_rota_atualizado_em
  before update on public.paradas_rota
  for each row execute function public.tocar_atualizado_em();

-- ─── Fecha a rota sozinha quando a última parada conclui ───────────────────

create or replace function public.concluir_rota_se_completa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  restantes integer;
begin
  if new.status = 'concluida' and old.status is distinct from 'concluida' then
    select count(*) into restantes
      from public.paradas_rota
      where rota_id = new.rota_id and status <> 'concluida';

    if restantes = 0 then
      update public.rotas_promotor
         set status = 'concluida', concluida_em = now()
       where id = new.rota_id and status <> 'concluida';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists paradas_rota_conclui_rota on public.paradas_rota;
create trigger paradas_rota_conclui_rota
  after update on public.paradas_rota
  for each row execute function public.concluir_rota_se_completa();

-- ============================================================================
--  RLS — promotor só enxerga a própria rota; gestor enxerga e monta todas
-- ============================================================================

alter table public.rotas_promotor enable row level security;
alter table public.paradas_rota   enable row level security;

drop policy if exists rotas_promotor_leitura     on public.rotas_promotor;
drop policy if exists rotas_promotor_insercao    on public.rotas_promotor;
drop policy if exists rotas_promotor_atualizacao on public.rotas_promotor;
drop policy if exists rotas_promotor_exclusao    on public.rotas_promotor;

create policy rotas_promotor_leitura on public.rotas_promotor
  for select to authenticated
  using (promotor_id = auth.uid() or public.e_gestor());

-- Só o gestor cria rota (é ele quem monta o roteiro); o promotor não insere.
create policy rotas_promotor_insercao on public.rotas_promotor
  for insert to authenticated
  with check (public.e_gestor());

-- O próprio promotor grava "Iniciar rota" (status/iniciada_em) na própria
-- linha; o gestor edita e apaga qualquer uma.
create policy rotas_promotor_atualizacao on public.rotas_promotor
  for update to authenticated
  using (promotor_id = auth.uid() or public.e_gestor())
  with check (promotor_id = auth.uid() or public.e_gestor());

create policy rotas_promotor_exclusao on public.rotas_promotor
  for delete to authenticated
  using (public.e_gestor());

drop policy if exists paradas_rota_leitura     on public.paradas_rota;
drop policy if exists paradas_rota_insercao    on public.paradas_rota;
drop policy if exists paradas_rota_atualizacao on public.paradas_rota;
drop policy if exists paradas_rota_exclusao    on public.paradas_rota;

create policy paradas_rota_leitura on public.paradas_rota
  for select to authenticated
  using (exists (
    select 1 from public.rotas_promotor r
     where r.id = paradas_rota.rota_id
       and (r.promotor_id = auth.uid() or public.e_gestor())
  ));

create policy paradas_rota_insercao on public.paradas_rota
  for insert to authenticated
  with check (public.e_gestor());

-- O promotor atualiza as próprias paradas (chegada, fotos, conclusão); o
-- gestor edita e apaga qualquer uma.
create policy paradas_rota_atualizacao on public.paradas_rota
  for update to authenticated
  using (exists (
    select 1 from public.rotas_promotor r
     where r.id = paradas_rota.rota_id
       and (r.promotor_id = auth.uid() or public.e_gestor())
  ))
  with check (exists (
    select 1 from public.rotas_promotor r
     where r.id = paradas_rota.rota_id
       and (r.promotor_id = auth.uid() or public.e_gestor())
  ));

create policy paradas_rota_exclusao on public.paradas_rota
  for delete to authenticated
  using (public.e_gestor());

revoke all on public.rotas_promotor, public.paradas_rota from anon;
grant select, insert, update, delete
  on public.rotas_promotor, public.paradas_rota
  to authenticated;

-- ============================================================================
--  Fotos — bucket privado, uma pasta por promotor
--
--  Caminho do arquivo: "<uid do promotor>/<id da parada>/<chegada|antes|depois>-<hora>.jpg"
--  storage.foldername(name)[1] é o primeiro pedaço desse caminho — o uid —,
--  então cada promotor só grava dentro da própria pasta, e só o gestor lê a
--  de todo mundo. Sem policy de update/delete: uma foto enviada fica; para
--  corrigir, sobe outra (o nome leva a hora, nunca colide).
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('promotores-fotos', 'promotores-fotos', false)
on conflict (id) do nothing;

drop policy if exists promotores_fotos_leitura  on storage.objects;
drop policy if exists promotores_fotos_insercao on storage.objects;

create policy promotores_fotos_leitura on storage.objects
  for select to authenticated
  using (
    bucket_id = 'promotores-fotos'
    and (public.e_gestor() or (storage.foldername(name))[1] = auth.uid()::text)
  );

create policy promotores_fotos_insercao on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'promotores-fotos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
--  Tempo real — o painel do gestor assina estas duas tabelas
-- ============================================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rotas_promotor'
    ) then
      alter publication supabase_realtime add table public.rotas_promotor;
    end if;

    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'paradas_rota'
    ) then
      alter publication supabase_realtime add table public.paradas_rota;
    end if;
  end if;
end;
$$;

commit;

-- Confira:  select nome, status, iniciada_em from public.rotas_promotor order by criado_em desc;

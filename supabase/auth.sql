-- ============================================================================
--  App Carvalho Cruz — acesso por login e senha
--
--  Rode ESTE arquivo DEPOIS de schema.sql:
--    Supabase → seu projeto → SQL Editor → New query → cole tudo → Run.
--  É idempotente: pode rodar de novo sem quebrar nada.
--
--  O que ele faz:
--    1. cria a tabela `perfis` (nome, papel e liberação de cada conta do Auth)
--    2. cria o perfil automaticamente quando alguém é cadastrado no Auth
--    3. troca o acesso liberado da chave anon por regras baseadas no papel
--
--  ⚠️  Depois de rodar, o app PÁRA de funcionar sem login — é esse o objetivo.
--      Siga o passo a passo do fim do arquivo para criar o primeiro
--      sócio master antes de avisar a equipe.
-- ============================================================================

-- ─── Perfis ─────────────────────────────────────────────────────────────────
--
--  Uma linha por usuário do Supabase Auth. A senha NÃO fica aqui: ela vive em
--  auth.users, cifrada pelo próprio Supabase, e nunca chega ao navegador.
--
--  Contas nascem `ativo = false` e como `assistente_administrativo`. Assim,
--  mesmo com o cadastro público ligado (o app precisa dele para criar
--  funcionários sem a service_role), quem se cadastrar sozinho não enxerga
--  nada até um sócio master liberar.

create table if not exists public.perfis (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          text not null,
  nome           text not null default '',
  telefone       text,
  papel          text not null default 'assistente_administrativo',
  ativo          boolean not null default false,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- Coluna nova em bancos que já tinham `perfis` antes dela existir.
alter table public.perfis add column if not exists telefone text;

-- Migra quem já tinha os papéis antigos (admin / gerente / vendedor) para o
-- modelo atual de dois papéis. Sem efeito em instalação nova (tabela vazia).
-- As triggers de proteção ficam desligadas só durante esta troca pontual:
-- numa instalação já existente elas ainda têm a lógica antiga (checam
-- 'admin') e bloqueariam a própria migração.
alter table public.perfis disable trigger user;
alter table public.perfis drop constraint if exists perfis_papel_check;

update public.perfis set papel = 'socio_master' where papel = 'admin';
update public.perfis set papel = 'assistente_administrativo' where papel in ('gerente', 'vendedor');

alter table public.perfis
  add constraint perfis_papel_check
  check (papel in ('socio_master', 'assistente_administrativo', 'promotor', 'motorista'));
alter table public.perfis enable trigger user;

create index if not exists perfis_papel_idx on public.perfis (papel) where ativo;
create unique index if not exists perfis_email_idx on public.perfis (lower(email));

drop trigger if exists perfis_atualizado_em on public.perfis;
create trigger perfis_atualizado_em
  before update on public.perfis
  for each row execute function public.tocar_atualizado_em();

-- ─── Contas master ───────────────────────────────────────────────────────────
--
--  Mesma lista de src/lib/permissoes.js (EMAILS_MASTER). Mudou lá, mude aqui.
--  São os donos do sistema: sempre sócio master, sempre ativos, e nenhum
--  outro sócio consegue rebaixá-los, desativá-los ou removê-los — nem por
--  fora do app.

create or replace function public.e_email_master(email text)
returns boolean
language sql
immutable
as $$
  select lower(email) = any (array['l.btc25@gmail.com', 'carlos_cruz_neto@hotmail.com']);
$$;

-- ─── Perfil criado junto com o usuário ──────────────────────────────────────
--
--  `papel` e `ativo` vêm dos defaults da tabela de propósito: se saíssem do
--  metadata do cadastro, qualquer um poderia se inscrever como sócio master.
--  A única exceção é a própria conta master, que já nasce sócio e liberada —
--  senão ela consegue logar (o cliente já trata `eMaster` como socio_master)
--  mas o RLS barra tudo até alguém promovê-la manualmente.

create or replace function public.criar_perfil_do_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, email, nome, papel, ativo)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    case when public.e_email_master(new.email) then 'socio_master' else 'assistente_administrativo' end,
    public.e_email_master(new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_do_usuario();

-- Mantém o e-mail do perfil em dia quando a pessoa troca o login.
create or replace function public.sincronizar_email_do_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.perfis set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists ao_trocar_email on auth.users;
create trigger ao_trocar_email
  after update of email on auth.users
  for each row execute function public.sincronizar_email_do_perfil();

-- ─── Quem é quem (usado por todas as políticas) ─────────────────────────────
--
--  SECURITY DEFINER para poder ler `perfis` sem cair na própria RLS da tabela
--  — sem isso a política de perfis chamaria a si mesma em loop.

create or replace function public.papel_atual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select papel from public.perfis where id = auth.uid() and ativo;
$$;

/* Sócio master: acesso total, inclusive o cadastro de usuários e a exclusão
   de registros. É o único papel que faz compra e venda em nome da casa. */
create or replace function public.e_socio()
returns boolean language sql stable as $$ select public.papel_atual() = 'socio_master'; $$;

/* Qualquer conta liberada — inclusive assistente administrativo e promotor. */
create or replace function public.e_liberado()
returns boolean language sql stable as $$ select public.papel_atual() is not null; $$;

/* Sócio master ou assistente administrativo: quem enxerga e edita os dados do
   negócio (vendas, financeiro, cadastros...). O promotor de campo fica de
   fora — ele só acessa as próprias rotas, em migracao-08-promotores.sql. */
create or replace function public.e_gestor()
returns boolean language sql stable as $$
  select public.papel_atual() in ('socio_master', 'assistente_administrativo');
$$;

-- ─── Trava contra ficar sem sócio master ────────────────────────────────────

create or replace function public.proteger_ultimo_socio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  restantes integer;
begin
  if tg_op = 'UPDATE' and old.papel = 'socio_master' and old.ativo
     and (new.papel <> 'socio_master' or not new.ativo) then
    select count(*) into restantes
      from public.perfis where papel = 'socio_master' and ativo and id <> old.id;
    if restantes = 0 then
      raise exception 'É preciso manter pelo menos um sócio master ativo.';
    end if;
  end if;

  if tg_op = 'DELETE' and old.papel = 'socio_master' and old.ativo then
    select count(*) into restantes
      from public.perfis where papel = 'socio_master' and ativo and id <> old.id;
    if restantes = 0 then
      raise exception 'É preciso manter pelo menos um sócio master ativo.';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists perfis_ultimo_admin on public.perfis;
drop trigger if exists perfis_ultimo_socio on public.perfis;
create trigger perfis_ultimo_socio
  before update or delete on public.perfis
  for each row execute function public.proteger_ultimo_socio();

-- Função órfã do rename acima — nada mais a chama.
drop function if exists public.proteger_ultimo_admin();

-- ─── Trava das contas master ────────────────────────────────────────────────
--
--  A tela de Usuários já impede isto (protegerMaster, em src/lib/auth.js),
--  mas quem editar `perfis` direto pelo SQL Editor ou por fora do app não
--  passa por ali — esta trigger é o mesmo limite, aplicado no banco.

create or replace function public.proteger_admins()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.e_email_master(old.email) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Conta master não pode ser removida.';
  end if;
  if new.papel <> 'socio_master' then
    raise exception 'Conta master é sempre sócio master — o papel não pode ser trocado.';
  end if;
  if not new.ativo then
    raise exception 'Conta master não pode ser desativada.';
  end if;

  return new;
end;
$$;

drop trigger if exists perfis_proteger_admins on public.perfis;
create trigger perfis_proteger_admins
  before update or delete on public.perfis
  for each row execute function public.proteger_admins();

-- ─── RLS dos perfis ─────────────────────────────────────────────────────────

alter table public.perfis enable row level security;

drop policy if exists perfis_leitura     on public.perfis;
drop policy if exists perfis_insercao    on public.perfis;
drop policy if exists perfis_atualizacao on public.perfis;
drop policy if exists perfis_exclusao    on public.perfis;

-- Cada um vê o próprio perfil; sócio master e assistente administrativo veem
-- todos — é o que permite a aba Promotores listar quem está cadastrado como
-- promotor para montar uma rota, sem dar a eles o poder de editar contas
-- (isso continua em perfis_atualizacao, restrito a e_socio()).
create policy perfis_leitura on public.perfis
  for select to authenticated
  using (id = auth.uid() or public.e_gestor());

create policy perfis_insercao on public.perfis
  for insert to authenticated
  with check (public.e_socio());

-- Só sócio master muda nome, papel e liberação — inclusive os próprios. Sem
-- isto, um assistente poderia se promover com um update na própria linha.
create policy perfis_atualizacao on public.perfis
  for update to authenticated
  using (public.e_socio())
  with check (public.e_socio());

create policy perfis_exclusao on public.perfis
  for delete to authenticated
  using (public.e_socio() and id <> auth.uid());

-- ============================================================================
--  Acesso às tabelas do negócio
--
--    leitura, inserção e edição → sócio master e assistente administrativo
--    exclusão                   → só sócio master
--
--  O promotor de campo não entra aqui: ele não vê venda, cliente, estoque
--  nem financeiro, só as próprias rotas (migracao-08-promotores.sql).
--
--  São as mesmas regras de src/lib/permissoes.js. Mudou aqui, mude lá.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array['fornecedores', 'redes', 'lojas', 'produtos',
                            'compras', 'perdas', 'despesas', 'acertos', 'vendas',
                            'veiculos', 'abastecimentos', 'funcionarios', 'pagamentos'] loop
    -- Política antiga, que liberava tudo para a chave pública.
    execute format('drop policy if exists %I on public.%I', 'acesso_app', t);

    execute format('drop policy if exists %I on public.%I', t || '_leitura', t);
    execute format('drop policy if exists %I on public.%I', t || '_insercao', t);
    execute format('drop policy if exists %I on public.%I', t || '_atualizacao', t);
    execute format('drop policy if exists %I on public.%I', t || '_exclusao', t);

    execute format(
      'create policy %I on public.%I for select to authenticated
         using (public.e_gestor())', t || '_leitura', t);

    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (public.e_gestor())', t || '_insercao', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (public.e_gestor()) with check (public.e_gestor())',
      t || '_atualizacao', t);

    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (public.e_socio())', t || '_exclusao', t);

    -- Fecha a porta da chave pública: sem sessão, nada é lido nem gravado.
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;

revoke all on public.vw_venda_itens from anon;

grant select, insert, update, delete
  on public.fornecedores, public.redes, public.lojas, public.produtos,
     public.compras, public.perdas, public.despesas, public.acertos, public.vendas,
     public.veiculos, public.abastecimentos, public.funcionarios, public.pagamentos
  to authenticated;
grant select on public.vw_venda_itens to authenticated;
grant select, insert, update, delete on public.perfis to authenticated;

-- Função do papel antigo "admin" — nada mais a chama a essa altura do
-- script, já que as políticas acima foram recriadas com e_socio(). Já
-- `e_gestor()` voltou a existir (definida mais acima), agora com sentido
-- diferente: sócio master + assistente administrativo, para excluir o
-- promotor das tabelas de negócio.
drop function if exists public.e_admin();

-- ============================================================================
--  PASSO A PASSO — primeiro sócio master
-- ============================================================================
--
--  1. Authentication → Providers → Email: DESLIGUE "Confirm email".
--     Assim o acesso criado pelo app já entra na hora, sem caixa de entrada.
--
--  2. Authentication → Sign In / Providers: mantenha "Allow new users to sign
--     up" LIGADO. É por aí que a tela de Usuários cria as contas da equipe —
--     sem isso só a service_role criaria usuários, e ela não pode ficar no
--     navegador. Quem se cadastrar por fora nasce inativo e não vê nada.
--
--  3. Authentication → Users → Add user: crie o seu e-mail e senha, marcando
--     "Auto Confirm User". Se o e-mail estiver na lista de contas master
--     (src/lib/permissoes.js), pule o passo 4 — o perfil já nasce
--     sócio master e liberado.
--
--  4. Volte ao SQL Editor e promova essa conta (troque o e-mail):
--
--       update public.perfis
--          set papel = 'socio_master', ativo = true
--        where lower(email) = lower('voce@carvalhocruz.com.br');
--
--  5. Entre no app com esse e-mail e senha. A partir daí, cadastre a equipe
--     pela aba "Usuários".
--
--  Conferir quem tem acesso hoje:
--       select nome, email, papel, ativo, criado_em from public.perfis
--        order by criado_em;

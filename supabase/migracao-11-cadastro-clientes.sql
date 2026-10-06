-- ============================================================================
--  Migração 11 — ficha cadastral completa do cliente
--
--  Redes e lojas ganham os dados que faltavam para faturar e entregar:
--  razão social, CNPJ/CPF, inscrição estadual, contato, e-mail, endereço
--  completo (CEP, logradouro, número, complemento, bairro, cidade, UF) e
--  observações.
--
--    rede   quem se cobra — razão social e CNPJ da matriz
--    loja   quem recebe — cada filial tem o próprio CNPJ, IE e endereço
--
--  CNPJ e IE usam as MESMAS colunas da migração da NF-e (cnpj_cpf, ie), onde
--  já estão os dados importados do Omie (importacao-fiscal-lojas.sql). Tudo
--  aqui é `add column if not exists`: funciona com ou sem aquela migração
--  aplicada, e não mexe em nada que já esteja preenchido.
--
--  ⚠️  Rode ANTES de usar a versão do app que traz a ficha. O app passa a
--      enviar essas colunas em toda gravação de rede e loja; sem elas, o
--      Supabase recusa o envio e a alteração fica presa na fila de
--      Sincronização até a migração ser aplicada (aí ela sobe sozinha).
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

-- ─── Redes ──────────────────────────────────────────────────────────────────

alter table public.redes add column if not exists razao_social  text;
alter table public.redes add column if not exists cnpj_cpf      text;
alter table public.redes add column if not exists ie            text;
alter table public.redes add column if not exists contato       text;
alter table public.redes add column if not exists email         text;
alter table public.redes add column if not exists cep           text;
alter table public.redes add column if not exists logradouro    text;
alter table public.redes add column if not exists numero        text;
alter table public.redes add column if not exists complemento   text;
alter table public.redes add column if not exists bairro        text;
alter table public.redes add column if not exists cidade        text;
alter table public.redes add column if not exists uf            text;
alter table public.redes add column if not exists observacoes   text;

-- ─── Lojas ──────────────────────────────────────────────────────────────────
--
--  cnpj_cpf, ie, logradouro, numero, bairro, cep e uf já existem se a
--  migração da NF-e rodou; `cidade` existe desde o schema.sql.

alter table public.lojas add column if not exists razao_social  text;
alter table public.lojas add column if not exists cnpj_cpf      text;
alter table public.lojas add column if not exists ie            text;
alter table public.lojas add column if not exists contato       text;
alter table public.lojas add column if not exists email         text;
alter table public.lojas add column if not exists cep           text;
alter table public.lojas add column if not exists logradouro    text;
alter table public.lojas add column if not exists numero        text;
alter table public.lojas add column if not exists complemento   text;
alter table public.lojas add column if not exists bairro        text;
alter table public.lojas add column if not exists cidade        text;
alter table public.lojas add column if not exists uf            text;
alter table public.lojas add column if not exists observacoes   text;

-- ─── Primeira versão desta migração ─────────────────────────────────────────
--
--  Ela criava `cnpj` e `inscricao_estadual` em vez de usar cnpj_cpf/ie. Se
--  foi aplicada, o que tiver sido digitado lá passa para as colunas certas
--  (só onde elas estão vazias). As colunas antigas ficam, sem uso.

do $$
declare
  t text;
begin
  foreach t in array array['redes', 'lojas'] loop
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = t and column_name = 'cnpj') then
      execute format('update public.%I set cnpj_cpf = cnpj where cnpj_cpf is null and cnpj is not null', t);
    end if;
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = t and column_name = 'inscricao_estadual') then
      execute format('update public.%I set ie = inscricao_estadual where ie is null and inscricao_estadual is not null', t);
    end if;
  end loop;
end;
$$;

-- ─── Busca por CNPJ ─────────────────────────────────────────────────────────
--
--  Sem unicidade: o CNPJ da rede costuma ser o mesmo da loja MATRIZ dela.
--  O app avisa quando um CNPJ digitado já está cadastrado em outro cliente.

create index if not exists redes_cnpj_cpf_idx on public.redes (cnpj_cpf) where cnpj_cpf is not null;
create index if not exists lojas_cnpj_cpf_idx on public.lojas (cnpj_cpf) where cnpj_cpf is not null;

commit;

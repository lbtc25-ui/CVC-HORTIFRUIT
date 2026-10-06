-- ============================================================================
--  Migração 17 — acesso de cada usuário, ajustado pela aba Usuários
--
--  1. Ajuste fino por pessoa (só para assistente administrativo):
--       perfis.abas          as abas que a pessoa vê. null = o padrão do papel.
--       perfis.pode_excluir  se a pessoa apaga registros. null/false = não.
--     O sócio master vê e apaga tudo sempre; o promotor só a própria rota.
--
--  2. Exclusão de registros no banco segue o mesmo ajuste: além do sócio
--     master, apaga quem é assistente com pode_excluir ligado. A regra está
--     em `pode_excluir_registros()` e vale para as tabelas do negócio.
--
--  3. excluir_usuario(alvo): apaga a conta do Supabase Auth pela aba
--     Usuários. Apagar do Auth exige a chave service_role, que não pode ir
--     para o navegador — esta função faz isso do lado do banco, como dona
--     (SECURITY DEFINER), depois de conferir que quem chamou é sócio master.
--     Apagar de `auth.users` apaga o perfil em cascata e dispara os gatilhos
--     que já existem: conta master não sai e o último sócio master ativo
--     também não. Ninguém apaga a própria conta por aqui. A pessoa da folha
--     ligada à conta continua na folha, só sem o vínculo.
--
--  As abas escondidas saem da tela; a leitura dos dados continua liberada
--  para o assistente no banco (o RLS é por papel, não por aba).
--
--  Precisa rodar DEPOIS do auth.sql. Rode no SQL Editor do Supabase.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

-- ─── 1. Colunas ─────────────────────────────────────────────────────────────

alter table public.perfis add column if not exists abas         text[];
alter table public.perfis add column if not exists pode_excluir boolean;

-- ─── 2. Quem apaga registros ────────────────────────────────────────────────

create or replace function public.pode_excluir_registros()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfis
     where id = auth.uid() and ativo
       and (papel = 'socio_master'
            or (papel = 'assistente_administrativo' and coalesce(pode_excluir, false)))
  );
$$;

do $$
declare
  t text;
begin
  foreach t in array array['clientes', 'fornecedores', 'redes', 'lojas', 'produtos',
                            'compras', 'perdas', 'despesas', 'acertos', 'vendas',
                            'veiculos', 'abastecimentos', 'funcionarios', 'pagamentos'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop policy if exists %I on public.%I', t || '_exclusao', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (public.pode_excluir_registros())', t || '_exclusao', t);
  end loop;
end;
$$;

-- ─── 3. Excluir usuário ─────────────────────────────────────────────────────

create or replace function public.excluir_usuario(alvo uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.e_socio() then
    raise exception 'Só o sócio master pode excluir usuários.';
  end if;
  if alvo = auth.uid() then
    raise exception 'Você não pode excluir a sua própria conta.';
  end if;

  delete from auth.users where id = alvo;
  if not found then
    raise exception 'Usuário não encontrado.';
  end if;
end;
$$;

revoke all on function public.excluir_usuario(uuid) from public, anon;
grant execute on function public.excluir_usuario(uuid) to authenticated;

commit;

-- ============================================================================
--  Migração 24 — sócio master define a senha de outra conta pela aba Usuários
--
--  definir_senha_usuario(alvo, nova_senha): grava uma senha nova direto na
--  conta do Supabase Auth, sem depender de e-mail — serve para contas de
--  login que não têm caixa de entrada de verdade (ex.: carvalhocruz.adm).
--  Trocar a senha de outra pessoa no Auth exige a chave service_role, que
--  não pode ir para o navegador — esta função faz isso do lado do banco,
--  como dona (SECURITY DEFINER), depois de conferir que quem chamou é sócio
--  master. A própria senha continua sendo trocada pelo menu do topo, em
--  "Alterar minha senha", que pede a senha atual.
--
--  O hash é bcrypt (pgcrypto), o mesmo formato que o Supabase Auth usa.
--
--  Precisa rodar DEPOIS do auth.sql. Rode no SQL Editor do Supabase.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

create extension if not exists pgcrypto with schema extensions;

create or replace function public.definir_senha_usuario(alvo uuid, nova_senha text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if not public.e_socio() then
    raise exception 'Só o sócio master pode definir a senha de outra conta.';
  end if;
  if alvo = auth.uid() then
    raise exception 'Para a sua própria senha use "Alterar minha senha", no menu do topo.';
  end if;
  if length(coalesce(nova_senha, '')) < 8 then
    raise exception 'A senha precisa ter pelo menos 8 caracteres.';
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(nova_senha, extensions.gen_salt('bf')),
         updated_at = now()
   where id = alvo;
  if not found then
    raise exception 'Usuário não encontrado.';
  end if;
end;
$$;

revoke all on function public.definir_senha_usuario(uuid, text) from public, anon;
grant execute on function public.definir_senha_usuario(uuid, text) to authenticated;

commit;

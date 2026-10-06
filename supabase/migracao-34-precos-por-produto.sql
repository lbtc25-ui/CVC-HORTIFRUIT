-- ============================================================================
--  Migração 34 — conferência de preços vira por PRODUTO, não só por fruta
--
--  A migracao-33 criou `precos_frutas` com um preço por fruta. Mas cada
--  forma de vender uma fruta — o agranel e cada saco (2,5 kg, 3 kg, 5 kg,
--  10 kg) — tem preço próprio: um saco de 2,5 kg não custa o mesmo por
--  quilo que o agranel. Esta migração:
--
--    1. Se `precos_frutas` já existe (rodou a 33), RENOMEIA a tabela para
--       `precos_produtos` e a coluna `fruta` para `produto` — sem perder
--       nenhuma linha já gravada (o valor guardado passa a valer para o
--       produto de mesmo nome).
--    2. Se `precos_frutas` nunca existiu (instalação nova, direto na 34),
--       cria `precos_produtos` do zero.
--
--  Em ambos os casos, o resultado final é a mesma tabela `precos_produtos`,
--  com a mesma política de acesso de sempre (gestor lê e grava).
--
--  O aviso semanal (pg_cron), se já estava agendado pela migracao-33,
--  continua funcionando sem precisar reagendar — só o texto da mensagem é
--  atualizado para mencionar também os sacos.
--
--  Idempotente: pode rodar de novo sem duplicar nem perder nada.
-- ============================================================================

begin;

-- ─── Renomeia a tabela antiga, se existir ──────────────────────────────────

do $$
begin
  if to_regclass('public.precos_frutas') is not null and to_regclass('public.precos_produtos') is null then
    alter table public.precos_frutas rename to precos_produtos;
    alter table public.precos_produtos rename column fruta to produto;

    if to_regclass('public.precos_frutas_data_idx') is not null then
      alter index public.precos_frutas_data_idx rename to precos_produtos_data_idx;
    end if;
    if to_regclass('public.precos_frutas_fruta_idx') is not null then
      alter index public.precos_frutas_fruta_idx rename to precos_produtos_produto_idx;
    end if;
    if to_regclass('public.precos_frutas_pkey') is not null then
      alter table public.precos_produtos rename constraint precos_frutas_pkey to precos_produtos_pkey;
    end if;
  end if;
end;
$$;

-- ─── Cria do zero, se a 33 nunca rodou ─────────────────────────────────────

create table if not exists public.precos_produtos (
  id         uuid primary key default gen_random_uuid(),
  produto    text not null,
  preco      numeric(12,4) not null default 0 check (preco >= 0),
  data       date not null default current_date,
  criado_em  timestamptz not null default now()
);

create index if not exists precos_produtos_data_idx    on public.precos_produtos (data desc);
create index if not exists precos_produtos_produto_idx on public.precos_produtos (produto);

-- ─── Acesso ─────────────────────────────────────────────────────────────────
--
-- Mesma regra de sempre: gestor lê e grava; exclusão por
-- pode_excluir_registros(). Antes do auth.sql, fica aberta como as demais.
-- Refeita aqui do zero (não depende da 33 já ter rodado).

alter table public.precos_produtos enable row level security;

drop policy if exists acesso_app                   on public.precos_produtos;
drop policy if exists precos_frutas_leitura        on public.precos_produtos;
drop policy if exists precos_frutas_insercao       on public.precos_produtos;
drop policy if exists precos_frutas_atualizacao    on public.precos_produtos;
drop policy if exists precos_frutas_exclusao       on public.precos_produtos;
drop policy if exists precos_produtos_leitura      on public.precos_produtos;
drop policy if exists precos_produtos_insercao     on public.precos_produtos;
drop policy if exists precos_produtos_atualizacao  on public.precos_produtos;
drop policy if exists precos_produtos_exclusao     on public.precos_produtos;

do $$
begin
  if to_regprocedure('public.e_gestor()') is not null then
    create policy precos_produtos_leitura on public.precos_produtos
      for select to authenticated using (public.e_gestor());
    create policy precos_produtos_insercao on public.precos_produtos
      for insert to authenticated with check (public.e_gestor());
    create policy precos_produtos_atualizacao on public.precos_produtos
      for update to authenticated using (public.e_gestor()) with check (public.e_gestor());

    if to_regprocedure('public.pode_excluir_registros()') is not null then
      create policy precos_produtos_exclusao on public.precos_produtos
        for delete to authenticated using (public.pode_excluir_registros());
    else
      create policy precos_produtos_exclusao on public.precos_produtos
        for delete to authenticated using (public.e_socio());
    end if;

    revoke all on public.precos_produtos from anon;
    grant select, insert, update, delete on public.precos_produtos to authenticated;
  else
    -- Antes do auth.sql: aberta, como as outras tabelas nessa fase.
    create policy acesso_app on public.precos_produtos
      for all to anon, authenticated using (true) with check (true);
    grant select, insert, update, delete on public.precos_produtos to anon, authenticated;
  end if;
end;
$$;

commit;

-- ============================================================================
--  Atualiza o texto do aviso semanal (se a migracao-20 e o agendamento da 33
--  já existirem) para mencionar também os sacos. Não precisa reagendar: o
--  cron.job já criado continua chamando a mesma função por nome.
-- ============================================================================

do $$
begin
  if to_regprocedure('privado.enviar_ntfy(text,text,text)') is null then
    return;
  end if;

  create or replace function privado.lembrar_preco_frutas()
  returns void
  language plpgsql
  security definer
  set search_path = ''
  as $f$
  begin
    perform privado.enviar_ntfy(
      'Conferência de preços — frutas e sacos',
      'Confirme ou ajuste o preço de cada fruta e saco desta semana, em Estoque.'
    );
  exception when others then
    raise warning 'lembrete de preço de produtos falhou: %', sqlerrm;
  end;
  $f$;

  revoke all on function privado.lembrar_preco_frutas() from public, anon, authenticated;
end;
$$;

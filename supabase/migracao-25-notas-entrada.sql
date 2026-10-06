-- ============================================================================
--  Migração 25 — notas de entrada (NF-e recebidas e devoluções)
--
--  Uma tabela para o que ENTRA com nota fiscal, nas duas origens:
--
--    origem = 'sefaz'  NF-e que um terceiro emitiu contra o CNPJ da
--                      distribuidora (compra de fornecedor, devolução de
--                      cliente, remessa). A Spedy busca na SEFAZ sozinha; a
--                      linha aqui nasce quando alguém "dá entrada" na nota
--                      pela aba Notas Fiscais → Recebidas.
--    origem = 'app'    nota de devolução que a própria distribuidora emitiu
--                      (NF-e de entrada, finalidade devolução), quando o
--                      cliente devolve mercadoria e não emite a nota dele.
--
--  `tipo` é o que a nota é para o negócio: 'compra', 'devolucao' (ligada à
--  venda em venda_id) ou 'outra'. `compra_id` aponta a compra lançada a
--  partir da nota, quando houver.
--
--  Rode antes de publicar a versão do app que traz as notas recebidas — sem
--  a tabela, as entradas ficam presas na fila de Sincronização.
--
--  Funciona com ou sem o auth.sql: se o login por papel já está ligado, a
--  tabela segue as mesmas regras das outras tabelas do negócio (gestor lê e
--  grava, exclusão por pode_excluir_registros()); senão, fica aberta como as
--  demais antes do auth.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

create table if not exists public.notas_entrada (
  id             uuid primary key default gen_random_uuid(),
  origem         text not null default 'sefaz' check (origem in ('sefaz', 'app')),
  tipo           text not null default 'outra' check (tipo in ('compra', 'devolucao', 'outra')),
  spedy_id       text,                   -- id da nota na Spedy (recebida ou emitida)
  chave          text,                   -- chave de acesso (44 dígitos)
  numero         bigint,
  serie          text,
  emitente_nome  text,
  emitente_cnpj  text,
  emitida_em     timestamptz,
  valor          numeric(14,2) not null default 0,
  venda_id       uuid references public.vendas (id) on delete set null,
  loja_id        uuid references public.lojas (id) on delete set null,
  fornecedor_id  uuid references public.fornecedores (id) on delete set null,
  compra_id      uuid references public.compras (id) on delete set null,
  itens          jsonb not null default '[]'::jsonb,
  nfe_status     text,                   -- origem 'app': autorizada / rejeitada / cancelada
  nfe_erro       text,
  motivo         text,                   -- motivo da devolução
  observacao     text,
  lancada_em     timestamptz,            -- quando se deu entrada
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- A mesma nota da SEFAZ não entra duas vezes.
create unique index if not exists notas_entrada_chave_uidx
  on public.notas_entrada (chave) where chave is not null and chave <> '';
create index if not exists notas_entrada_venda_idx on public.notas_entrada (venda_id);
create index if not exists notas_entrada_emitida_idx on public.notas_entrada (emitida_em desc);

drop trigger if exists notas_entrada_atualizado_em on public.notas_entrada;
create trigger notas_entrada_atualizado_em before update on public.notas_entrada
  for each row execute function public.tocar_atualizado_em();

-- ─── Acesso ─────────────────────────────────────────────────────────────────

alter table public.notas_entrada enable row level security;

drop policy if exists acesso_app                on public.notas_entrada;
drop policy if exists notas_entrada_leitura     on public.notas_entrada;
drop policy if exists notas_entrada_insercao    on public.notas_entrada;
drop policy if exists notas_entrada_atualizacao on public.notas_entrada;
drop policy if exists notas_entrada_exclusao    on public.notas_entrada;

do $$
begin
  if to_regprocedure('public.e_gestor()') is not null then
    create policy notas_entrada_leitura on public.notas_entrada
      for select to authenticated using (public.e_gestor());
    create policy notas_entrada_insercao on public.notas_entrada
      for insert to authenticated with check (public.e_gestor());
    create policy notas_entrada_atualizacao on public.notas_entrada
      for update to authenticated using (public.e_gestor()) with check (public.e_gestor());

    if to_regprocedure('public.pode_excluir_registros()') is not null then
      create policy notas_entrada_exclusao on public.notas_entrada
        for delete to authenticated using (public.pode_excluir_registros());
    else
      create policy notas_entrada_exclusao on public.notas_entrada
        for delete to authenticated using (public.e_socio());
    end if;

    revoke all on public.notas_entrada from anon;
    grant select, insert, update, delete on public.notas_entrada to authenticated;
  else
    -- Antes do auth.sql: aberta, como as outras tabelas nessa fase.
    create policy acesso_app on public.notas_entrada
      for all to anon, authenticated using (true) with check (true);
    grant select, insert, update, delete on public.notas_entrada to anon, authenticated;
  end if;
end;
$$;

commit;

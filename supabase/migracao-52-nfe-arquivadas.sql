-- ============================================================================
--  Migração 52 — NF-e canceladas de pedidos apagados (arquivo fiscal)
--
--  Apagar um pedido com NF-e cancelada tirava a nota junto da aba Notas
--  Fiscais (a nota vivia nas colunas nfe_* da própria venda). O pedido
--  precisa sumir — senão vira venda falsa —, mas a nota cancelada continua
--  valendo para o SPED Fiscal e o contador pede o XML dela.
--
--  Agora, ao apagar o pedido, o app copia a nota para esta tabela antes. A
--  aba Notas Fiscais → Emitidas lê daqui também: a nota aparece com número,
--  chave, motivo, DANFE e XML, marcada "pedido apagado". Nada daqui entra em
--  venda, estoque, cobrança ou DRE.
--
--  As que já tinham sido apagadas antes disso voltam pelo botão "Recuperar
--  canceladas da Spedy" (mesma aba): o app lista as notas da Spedy e grava
--  aqui as canceladas que não conhece, com origem = 'spedy'.
--
--  `loja_id` sem chave estrangeira de propósito: o cliente pode ser apagado
--  depois, e a nota não pode sumir por isso — o nome e o CNPJ ficam gravados.
--
--  Rode ANTES de publicar a versão do app com o arquivo — sem a tabela, a
--  exclusão de pedido com nota cancelada fica presa na fila de Sincronização.
--
--  Idempotente.
-- ============================================================================

begin;

create table if not exists public.nfe_arquivadas (
  id                      uuid primary key,          -- o id da venda apagada
  numero_pedido           bigint,
  loja_id                 uuid,
  cliente_nome            text,
  cliente_cnpj            text,
  data                    date,
  total                   numeric(14,2) not null default 0,
  nfe_status              text not null default 'cancelada',
  nfe_numero              integer,
  nfe_serie               integer,
  nfe_chave               text,
  nfe_spedy_id            text,
  nfe_emitida_em          timestamptz,
  nfe_motivo_cancelamento text,
  nfe_cce_em              timestamptz,
  nfe_cce_texto           text,
  pedido_apagado_em       timestamptz not null default now(),
  criado_em               timestamptz not null default now()
);

-- De onde veio: 'pedido_apagado' (cópia feita ao apagar) ou 'spedy'
-- (recuperada da Spedy depois). Coluna à parte do create para quem já rodou
-- a primeira versão desta migração.
alter table public.nfe_arquivadas add column if not exists origem text not null default 'pedido_apagado';

-- Sem índice único no id da Spedy: dois aparelhos recuperando a mesma nota
-- offline travariam a fila de sincronização. O app ignora a repetida.
create index if not exists nfe_arquivadas_spedy_idx on public.nfe_arquivadas (nfe_spedy_id);
create index if not exists nfe_arquivadas_emitida_idx on public.nfe_arquivadas (nfe_emitida_em desc);

-- ─── Acesso ─────────────────────────────────────────────────────────────────
-- Lê e grava quem mexe em vendas; só o sócio apaga (é arquivo fiscal).

alter table public.nfe_arquivadas enable row level security;

drop policy if exists acesso_app                 on public.nfe_arquivadas;
drop policy if exists nfe_arquivadas_leitura     on public.nfe_arquivadas;
drop policy if exists nfe_arquivadas_insercao    on public.nfe_arquivadas;
drop policy if exists nfe_arquivadas_atualizacao on public.nfe_arquivadas;
drop policy if exists nfe_arquivadas_exclusao    on public.nfe_arquivadas;

do $$
begin
  if to_regprocedure('public.e_gestor()') is not null then
    create policy nfe_arquivadas_leitura on public.nfe_arquivadas
      for select to authenticated using (public.e_gestor());
    create policy nfe_arquivadas_insercao on public.nfe_arquivadas
      for insert to authenticated with check (public.e_gestor());
    create policy nfe_arquivadas_atualizacao on public.nfe_arquivadas
      for update to authenticated using (public.e_gestor()) with check (public.e_gestor());
    create policy nfe_arquivadas_exclusao on public.nfe_arquivadas
      for delete to authenticated using (public.e_socio());

    revoke all on public.nfe_arquivadas from anon;
    grant select, insert, update, delete on public.nfe_arquivadas to authenticated;
  else
    -- Antes do auth.sql: aberta, como as outras tabelas nessa fase.
    create policy acesso_app on public.nfe_arquivadas
      for all to anon, authenticated using (true) with check (true);
    grant select, insert, update, delete on public.nfe_arquivadas to anon, authenticated;
  end if;
end;
$$;

commit;

-- Confira:  select nfe_numero, cliente_nome, nfe_motivo_cancelamento, pedido_apagado_em from public.nfe_arquivadas order by nfe_numero;

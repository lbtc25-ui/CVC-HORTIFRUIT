-- ============================================================================
--  Migração 08 — dados fiscais para emissão de NF-e
--
--  Acrescenta o que faltava no cadastro para gerar uma NF-e de verdade:
--    lojas      CNPJ/CPF, inscrição estadual e endereço completo do
--                destinatário — a nota vai no nome de quem recebe a
--                mercadoria, não da rede.
--    produtos   NCM — classificação fiscal da fruta, obrigatória na nota.
--    vendas     status da emissão, número/série/chave da NF-e e o link do
--                DANFe, para acompanhar pela tela de Vendas.
--
--  Como aplicar, NESTA ORDEM:
--    1. schema.sql
--    2. migracao-01-redes-lojas.sql
--    3. migracao-02-compras.sql
--    4. migracao-03-perdas-estoque.sql
--    5. migracao-04-despesas-dre.sql
--    6. migracao-05-acertos.sql
--    7. migracao-06-combustivel.sql
--    8. migracao-07-folha-pagamento.sql
--    9. migracao-08-nfe.sql (este)
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

-- ─── Destinatário: CNPJ/CPF e endereço da loja ──────────────────────────────
--
--  Cada filial tem o próprio CNPJ no Brasil — a nota vai para o CNPJ de quem
--  recebeu a mercadoria, não para o CNPJ da rede. `logradouro`/`numero` ficam
--  separados (e não dentro de `endereco`) porque é assim que o emissor de
--  NF-e pede o endereço do destinatário.

alter table public.lojas add column if not exists cnpj_cpf    text;
alter table public.lojas add column if not exists ie          text;
alter table public.lojas add column if not exists logradouro  text;
alter table public.lojas add column if not exists numero      text;
alter table public.lojas add column if not exists bairro      text;
alter table public.lojas add column if not exists cep         text;
alter table public.lojas add column if not exists uf          text;

-- ─── Produtos: classificação fiscal ─────────────────────────────────────────
--
--  NCM (Nomenclatura Comum do Mercosul) é obrigatório em toda NF-e de
--  mercadoria. Sem ele a nota é rejeitada pela SEFAZ — por isso fica como
--  cadastro do produto, preenchido uma vez, e não repetido venda a venda.

alter table public.produtos add column if not exists ncm text;

-- ─── Vendas: acompanhamento da emissão ──────────────────────────────────────
--
--  A emissão é assíncrona no emissor (aceita o pedido, processa depois), por
--  isso existe o status 'processando' — a tela de Vendas consulta de novo até
--  virar 'autorizada' ou 'rejeitada'. `nfe_erro` guarda o motivo da rejeição,
--  para corrigir e reemitir sem precisar adivinhar o que faltou.

alter table public.vendas add column if not exists nfe_status      text
  not null default 'nao_emitida'
  check (nfe_status in ('nao_emitida', 'processando', 'autorizada', 'rejeitada', 'cancelada'));
alter table public.vendas add column if not exists nfe_numero      integer;
alter table public.vendas add column if not exists nfe_serie       integer;
alter table public.vendas add column if not exists nfe_chave       text;
alter table public.vendas add column if not exists nfe_danfe_url   text;
alter table public.vendas add column if not exists nfe_erro        text;
alter table public.vendas add column if not exists nfe_emitida_em  timestamptz;

create index if not exists vendas_nfe_status_idx on public.vendas (nfe_status);

commit;

-- Confira:  select nfe_status, count(*) from public.vendas group by nfe_status;

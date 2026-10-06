
-- >>>>>>>> migracao-62-taxas-clientes.sql
-- ============================================================================
--  Migração 62 — taxas e custos por cliente (redes grandes)
--
--  Algumas redes (ex.: Atakarejo) cobram da distribuidora caixas IFCO, taxa
--  de CD e taxa de antecipação. No cadastro da REDE se lista as taxas que
--  valem para todas as lojas dela; uma LOJA pode ter as próprias, que valem
--  no lugar da da rede para o mesmo tipo de taxa.
--
--    redes.taxas / lojas.taxas   jsonb  [{ tipo, nome?, modo, valor }]
--      tipo   ifco | cd | antecipacao | outra
--      modo   percentual (% da venda do pedido) | por_pedido (R$ por pedido)
--
--  O app desconta as taxas do resultado (Painel e Financeiro), no pedido
--  a que se referem. Rode ANTES de publicar a versão do app que traz o
--  cadastro das taxas — sem as colunas, as gravações de rede e loja ficam
--  presas na fila de Sincronização.
--
--  Idempotente. Nada é apagado.
-- ============================================================================

begin;

alter table public.redes add column if not exists taxas jsonb;
alter table public.lojas add column if not exists taxas jsonb;

commit;

-- >>>>>>>> migracao-63-caixas-ifco-pedido.sql
-- ============================================================================
--  Migração 63 — caixas IFCO no pedido
--
--  Quantas caixas IFCO foram no pedido (nem toda fruta usa IFCO). Com a taxa
--  "R$ por caixa" do cliente (migracao-62), o app multiplica o valor da taxa
--  por esta quantidade e desconta do resultado do pedido.
--
--    vendas.caixas_ifco   integer, 0 = o pedido não usou IFCO
--
--  Rode ANTES de publicar a versão do app que traz o campo — sem a coluna,
--  as gravações de venda ficam presas na fila de Sincronização.
--  Depois da migracao-62. Idempotente. Nada é apagado.
-- ============================================================================

begin;

alter table public.vendas add column if not exists caixas_ifco integer not null default 0;

commit;

-- >>>>>>>> migracao-64-kg-por-caixa.sql
-- ============================================================================
--  Migração 64 — peso de uma caixa por fruta
--
--  Quantos quilos tem uma caixa da fruta (ex.: laranja pera, caixa de 25 kg).
--  Fica em cada produto, mas o app grava o mesmo valor em todos os produtos
--  da mesma fruta. Vazio = peso da caixa não cadastrado.
--
--    produtos.kg_por_caixa   numeric, null = não cadastrado
--
--  Rode ANTES de publicar a versão do app que traz o campo — sem a coluna,
--  as gravações de produto ficam presas na fila de Sincronização.
--  Idempotente. Nada é apagado.
-- ============================================================================

begin;

alter table public.produtos add column if not exists kg_por_caixa numeric;

commit;

-- >>>>>>>> migracao-65-kg-por-caixa-frutas.sql
-- ============================================================================
--  Migração 65 — peso da caixa das frutas (carga inicial)
--
--  Preenche produtos.kg_por_caixa (migracao-64) pelo nome da fruta. Só mexe
--  em quem ainda está sem peso: o que já foi digitado no app não é trocado.
--  Abóbora e melancia ficam de fora (5 kg e 6 kg são o peso médio da
--  unidade, não de caixa) — cadastre no app se quiser.
--
--  Depois de rodar, confira quais frutas ficaram sem peso:
--    select distinct fruta from public.produtos where kg_por_caixa is null;
--
--  Rode DEPOIS da migracao-64. Idempotente. Nada é apagado.
-- ============================================================================

begin;

update public.produtos p
   set kg_por_caixa = v.kg
  from (values
    ('%hava%',        23),  -- Mamão Havaí
    ('%formosa%',     20),  -- Mamão Formosa
    ('%goiaba%',      25),
    ('%pokan%',       23),  -- Tangerina Pokan
    ('%ponkan%',      23),  -- Tangerina Ponkan
    ('%murc%',        25),  -- Murcote
    ('%murk%',        25),
    ('%maracuj%',     15),
    ('%pitaya%',      20),
    ('%lim_o%',       24),  -- Limão (não pega Laranja Lima)
    ('%abacate%',     20),
    ('%laranja%',     25),  -- Pera e Lima
    ('%ole%',         23),  -- Tangerina Ôle
    ('%abacaxi%',     25)
  ) as v(padrao, kg)
 where p.kg_por_caixa is null
   and lower(p.fruta) like v.padrao;

commit;

-- >>>>>>>> migracao-66-peso-medio-unidade.sql
-- ============================================================================
--  Migração 66 — peso médio por unidade (abóbora, melancia…)
--
--  Frutas vendidas ora no quilo, ora por unidade: o peso médio de uma unidade
--  é o ponto de partida do pedido por unidade (o app converte em kg). A última
--  venda por unidade do produto continua valendo antes dele.
--
--    produtos.peso_medio_unidade   numeric, null = não cadastrado
--
--  Já preenche abóbora (5 kg) e melancia (6 kg), só onde estiver vazio.
--  Rode ANTES de publicar a versão do app. Idempotente. Nada é apagado.
-- ============================================================================

begin;

alter table public.produtos add column if not exists peso_medio_unidade numeric;

update public.produtos set peso_medio_unidade = 5
 where peso_medio_unidade is null and lower(fruta) like '%ab_bora%';

update public.produtos set peso_medio_unidade = 6
 where peso_medio_unidade is null and lower(fruta) like '%melancia%';

commit;

-- >>>>>>>> migracao-67-kg-por-caixa-mamao-tangerina.sql
-- ============================================================================
--  Migração 67 — peso da caixa: "MAMAO" e "Tangerina" (complemento da 65)
--
--  Os produtos com esses nomes exatos ficaram sem peso na migração 65:
--    MAMAO      → Mamão Havaí, 23 kg
--    Tangerina  → Tangerina Ôle, 23 kg
--  Só mexe em quem ainda está sem peso. Rode depois da migracao-64.
--  Idempotente. Nada é apagado.
-- ============================================================================

begin;

update public.produtos set kg_por_caixa = 23
 where kg_por_caixa is null and lower(trim(fruta)) in ('mamao', 'mamão', 'tangerina');

commit;

-- >>>>>>>> migracao-68-cvc-empresa-padrao.sql
-- ============================================================================
--  Migração 68 — a CVC como empresa padrão (só para o banco da CVC)
--
--  O sistema nasceu na Carvalho Cruz, onde `empresa` = 'carvalho_cruz' era o
--  padrão. Na CVC é o contrário: o padrão é 'cvc', e 'carvalho_cruz' passa a
--  ser a empresa que ainda EMITE a nota de parte dos produtos (o app usa a
--  conta Spedy dela para esses produtos).
--
--  1. O padrão de produtos.empresa e metas.empresa vira 'cvc'.
--  2. Os produtos e metas que já existem (vindos da instalação) ficam com
--     'carvalho_cruz', porque hoje as notas ainda saem pela Carvalho. Quando
--     a conta Spedy da CVC estiver pronta, troque produto a produto em
--     Estoque → lápis → "Empresa que emite a nota", ou rode:
--
--         update public.produtos set empresa = 'cvc';
--
--  Idempotente quanto ao padrão; o passo 2 só mexe no que ainda é do padrão
--  antigo de uma instalação nova. NÃO rode de novo depois de trocar produtos
--  para 'cvc' — ele os devolveria para 'carvalho_cruz'.
-- ============================================================================

begin;

update public.produtos set empresa = 'carvalho_cruz';
update public.metas    set empresa = 'carvalho_cruz';

alter table public.produtos alter column empresa set default 'cvc';
alter table public.metas    alter column empresa set default 'cvc';

commit;

-- Confira:  select empresa, count(*) from public.produtos group by 1;

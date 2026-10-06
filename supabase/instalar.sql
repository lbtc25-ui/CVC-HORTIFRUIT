-- ============================================================================
--  Instalação completa do banco — gerado por scripts/gerar-instalar-sql.sh
--  NÃO edite à mão. Cole tudo no SQL Editor do Supabase e rode uma vez.
-- ============================================================================

-- Trava: este arquivo é para banco NOVO. Rodar de novo num banco já
-- instalado reabriria as tabelas para a chave pública no meio do caminho.
do $$
begin
  if to_regclass('public.perfis') is not null then
    raise exception 'Este banco já foi instalado — não rode o instalar.sql de novo. Para uma mudança, rode só a migração dela.';
  end if;
end;
$$;

-- >>>>>>>>>>>>>>>>>>>>>>>> schema.sql
-- ============================================================================
--  App Carvalho Cruz — distribuidora de laranja (Aracaju/SE)
--  Schema do Supabase / PostgreSQL
--
--  Como aplicar:
--    Supabase → seu projeto → SQL Editor → New query → cole tudo → Run.
--  O script é idempotente: pode ser executado de novo sem quebrar nada.
--
--  ⚠️  Rode este arquivo primeiro e SEMPRE em seguida o
--      migracao-01-redes-lojas.sql — mesmo em projeto novo. Este schema só
--      cria o que falta; é a migração que acrescenta as colunas que faltam
--      em produtos/vendas, move os clientes existentes (se houver) para
--      `lojas` sem perder nada, e cria as views de relatório.
--
--  O modelo espelha a planilha de gestão:
--    rede → loja          uma venda é feita para a LOJA, cobrada da REDE
--    produto              vendido em saco ou a granel, sempre controlado em kg
--    venda                carrega o PRAZO em dias, que define o vencimento
--    compra               entra por FRUTA, e é dela que sai o custo por quilo
--    perda                sai por FRUTA, sem receita
--    estoque              não é digitado: é compras − vendas − perdas + acertos
--    despesa              as 8 categorias da aba NÃO MEXER
--    resultado            receita − despesas − mercadoria, como no seu DRE
-- ============================================================================

create extension if not exists "pgcrypto";

-- ─── Função de carimbo de atualização ───────────────────────────────────────

create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

-- ─── Redes ──────────────────────────────────────────────────────────────────
--
--  O primeiro nível do cliente: PETROX, MIX MATEUS, ATAKAREJO, REDE ALPHA…
--  É com a rede que se negocia preço e prazo, e é dela que se cobra.

create table if not exists public.redes (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  telefone       text,
  status         text not null default 'ativo' check (status in ('ativo', 'inativo')),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists redes_status_idx on public.redes (status);
create unique index if not exists redes_nome_unico_idx on public.redes (lower(nome));

-- ─── Lojas ──────────────────────────────────────────────────────────────────
--
--  O segundo nível: a unidade que recebe a mercadoria. ARUANA, P.CAJU, BARRA…
--  Nomes de loja se repetem entre redes (existe BARRA na PETROX, na REDE MAIS
--  e na HIPER CARNES), por isso a unicidade é por (rede, nome) e não só nome.

create table if not exists public.lojas (
  id             uuid primary key default gen_random_uuid(),
  rede_id        uuid not null references public.redes (id) on delete cascade,
  nome           text not null,
  cidade         text,
  telefone       text,
  status         text not null default 'ativo' check (status in ('ativo', 'inativo')),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists lojas_rede_idx   on public.lojas (rede_id);
create index if not exists lojas_status_idx on public.lojas (status);
create unique index if not exists lojas_rede_nome_unico_idx
  on public.lojas (rede_id, lower(nome));

-- ─── Fornecedores ───────────────────────────────────────────────────────────

create table if not exists public.fornecedores (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  telefone       text,
  produto        text,
  cidade         text,
  status         text not null default 'ativo' check (status in ('ativo', 'inativo')),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists fornecedores_status_idx on public.fornecedores (status);

-- ─── Produtos ───────────────────────────────────────────────────────────────
--
--  A planilha vende em duas modalidades e controla tudo em quilo:
--
--    agranel          unidade_venda = 'kg',   kg_por_unidade = 1
--    saco 2,5 kg      unidade_venda = 'saco', kg_por_unidade = 2.5
--
--  `kg_por_unidade` é a coluna BAGS da planilha: o fator que converte a
--  quantidade vendida em quilos. 60 sacos × 2,5 = 150 kg.
--  O preço é SEMPRE por unidade de venda (por saco, ou por quilo no agranel).

create table if not exists public.produtos (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  fruta          text not null default 'Laranja Pera'
                   check (fruta in ('Laranja Pera', 'Laranja Lima', 'Abóbora')),
  unidade_venda  text not null default 'kg' check (unidade_venda in ('kg', 'saco')),
  kg_por_unidade numeric(10,3) not null default 1 check (kg_por_unidade > 0),
  preco          numeric(12,2) not null default 0 check (preco >= 0),
  estoque        numeric(12,3) not null default 0,
  estoque_min    numeric(12,3) not null default 0 check (estoque_min >= 0),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),

  -- No agranel a unidade de venda JÁ é o quilo, então o fator tem de ser 1.
  constraint produtos_agranel_fator_um
    check (unidade_venda <> 'kg' or kg_por_unidade = 1)
);

-- produtos_fruta_idx fica no migracao-01: em um banco com o modelo antigo a
-- coluna `fruta` só existe depois que a migração a acrescenta.

create index if not exists produtos_estoque_baixo_idx
  on public.produtos (id) where estoque <= estoque_min;

-- ─── Vendas ─────────────────────────────────────────────────────────────────
--
--  Os itens ficam em jsonb na própria linha da venda. Isso mantém a
--  sincronização offline atômica: uma venda criada na rua é UMA operação na
--  fila, sem risco de subir o pedido sem os itens. Para relatórios, a view
--  vw_venda_itens logo abaixo devolve os mesmos dados em formato relacional.
--
--  Cada item carrega:
--    produtoId       qty          quantidade na unidade de venda (sacos ou kg)
--    precoUnitario   kgPorUnidade kgTotal
--    natureza        'venda' ou 'bonificacao'
--
--  A bonificação é mercadoria entregue sem cobrar. Na planilha ela era escrita
--  na coluna UNIDADE com preço zero, o que misturava duas informações na mesma
--  célula. Aqui é um campo próprio: sai do estoque, não entra na receita.
--
--  `prazo_dias` é a coluna PRAZO da planilha (0, 7, 14, 15, 21, 28, 30) e
--  `vencimento` é derivado dela — coluna gerada, nunca digitada.
--
--  `numero` é o número do pedido mostrado na tela. É gerado no aparelho, então
--  não é único por construção: dois vendedores offline podem chegar ao mesmo
--  número. O identificador real é o `id` (uuid).

create table if not exists public.vendas (
  id             uuid primary key default gen_random_uuid(),
  numero         integer,
  loja_id        uuid references public.lojas (id) on delete set null,
  data           date not null default current_date,
  prazo_dias     integer not null default 0 check (prazo_dias >= 0),
  vencimento     date generated always as (data + prazo_dias) stored,
  itens          jsonb not null default '[]'::jsonb,
  total          numeric(12,2) not null default 0,
  kg_total       numeric(12,3) not null default 0,
  status         text not null default 'pendente'
                   check (status in ('pago', 'pendente', 'cancelado')),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),

  constraint vendas_itens_e_lista check (jsonb_typeof(itens) = 'array')
);

create index if not exists vendas_data_idx       on public.vendas (data desc);
create index if not exists vendas_status_idx     on public.vendas (status);
create index if not exists vendas_itens_idx      on public.vendas using gin (itens);

-- vendas_loja_idx, vendas_vencimento_idx e vendas_vencidas_idx ficam no
-- migracao-01: em um banco com o modelo antigo, loja_id e vencimento só
-- existem depois que a migração acrescenta essas colunas a vendas.

-- ─── Compras ────────────────────────────────────────────────────────────────
--
--  A aba COMPRA DE MERCADORIAS da planilha: DATA, FORNECEDOR, PESO, $/KG, TOTAL.
--
--  Compra-se FRUTA, não produto. Os 329 toneladas de laranja pera que entram
--  do Carvalho Cruz viram tanto agranel quanto saco de 2,5 kg — é um estoque
--  só, que se reparte na hora de vender. Por isso a compra aponta para a
--  fruta, e não para uma das formas de vendê-la.
--
--  `total` é gerado: peso × preço do quilo, nunca digitado. Era uma coluna de
--  fórmula na planilha e continua sendo uma conta aqui.

create table if not exists public.compras (
  id             uuid primary key default gen_random_uuid(),
  data           date not null default current_date,
  fornecedor_id  uuid references public.fornecedores (id) on delete set null,
  fruta          text not null default 'Laranja Pera'
                   check (fruta in ('Laranja Pera', 'Laranja Lima', 'Abóbora')),
  peso_kg        numeric(12,3) not null default 0 check (peso_kg  >= 0),
  valor_kg       numeric(12,4) not null default 0 check (valor_kg >= 0),
  total          numeric(14,2) generated always as (round(peso_kg * valor_kg, 2)) stored,
  observacao     text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists compras_data_idx       on public.compras (data desc);
create index if not exists compras_fruta_idx      on public.compras (fruta);
create index if not exists compras_fornecedor_idx on public.compras (fornecedor_id);

-- ─── Perdas ─────────────────────────────────────────────────────────────────
--
--  A PERCA da planilha: fruta que estragou, quebrou no transporte ou voltou do
--  cliente. Sai do estoque sem virar receita — é o único movimento que só tem
--  prejuízo.
--
--  `custo_kg` é uma fotografia: o custo médio de compra no dia em que a perda
--  foi registrada. Guardado, e não recalculado, porque uma compra nova mais
--  cara não pode reescrever quanto custou o que se perdeu mês passado.

create table if not exists public.perdas (
  id             uuid primary key default gen_random_uuid(),
  data           date not null default current_date,
  fruta          text not null default 'Laranja Pera'
                   check (fruta in ('Laranja Pera', 'Laranja Lima', 'Abóbora')),
  kg             numeric(12,3) not null default 0 check (kg       >= 0),
  custo_kg       numeric(12,4) not null default 0 check (custo_kg >= 0),
  valor          numeric(14,2) generated always as (round(kg * custo_kg, 2)) stored,
  motivo         text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists perdas_data_idx  on public.perdas (data desc);
create index if not exists perdas_fruta_idx on public.perdas (fruta);

-- ─── Despesas ───────────────────────────────────────────────────────────────
--
--  As oito categorias da aba NÃO MEXER, cada uma com seus lançamentos de
--  data, descrição e valor. É o que faltava para o app calcular resultado, e
--  não só faturamento.
--
--  A categoria é `text` com check, e não enum: acrescentar uma categoria nova
--  é trocar a lista aqui, sem migração de tipo.

create table if not exists public.despesas (
  id             uuid primary key default gen_random_uuid(),
  data           date not null default current_date,
  categoria      text not null
                   check (categoria in ('Combustíveis', 'Diaristas', 'Funcionários',
                                        'Fretes', 'Manutenção', 'Investimentos',
                                        'Outros', 'Impostos')),
  descricao      text,
  valor          numeric(14,2) not null default 0 check (valor >= 0),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists despesas_data_idx      on public.despesas (data desc);
create index if not exists despesas_categoria_idx on public.despesas (categoria);

-- ─── Acertos de inventário ──────────────────────────────────────────────────
--
--  Quando o estoque calculado discorda da realidade, alguém foi lá e contou.
--  O acerto guarda a CONTAGEM, não um número para tapar buraco:
--
--    kg_contado   o que existe de fato, contado no depósito
--    kg_sistema   o que a conta dizia naquele momento — fotografia, para
--                 auditoria: dá para explicar o acerto depois
--    ajuste       a diferença, aplicada ao saldo. Gerada, nunca digitada.
--
--  Registrar um acerto é assumir que faltou lançamento em algum lugar. Não
--  substitui achar a nota: se a compra que faltava aparecer depois, lance a
--  compra E revise este acerto, senão a correção entra duas vezes.

create table if not exists public.acertos (
  id             uuid primary key default gen_random_uuid(),
  data           date not null default current_date,
  fruta          text not null default 'Laranja Pera'
                   check (fruta in ('Laranja Pera', 'Laranja Lima', 'Abóbora')),
  kg_contado     numeric(12,3) not null default 0 check (kg_contado >= 0),
  kg_sistema     numeric(12,3) not null default 0,
  ajuste         numeric(12,3) generated always as (kg_contado - kg_sistema) stored,
  motivo         text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists acertos_data_idx  on public.acertos (data desc);
create index if not exists acertos_fruta_idx on public.acertos (fruta);

-- ─── Veículos ───────────────────────────────────────────────────────────────
--
--  A frota que abastece: SPRINTER, STRADA, HR na planilha. Cadastro simples —
--  é só o que a tela de Combustível precisa para vincular o abastecimento.

create table if not exists public.veiculos (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  placa          text,
  modelo         text,
  status         text not null default 'ativo' check (status in ('ativo', 'inativo')),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists veiculos_status_idx on public.veiculos (status);
create unique index if not exists veiculos_nome_unico_idx on public.veiculos (lower(nome));

-- ─── Abastecimentos ─────────────────────────────────────────────────────────
--
--  A aba DESPESAS → COMBUSTIVEIS da planilha: motorista, veículo, km e tipo de
--  combustível, litros e preço do litro.
--
--  Km rodado, km/l e custo por km NÃO são colunas: são conta a partir do
--  abastecimento anterior do MESMO veículo (view vw_abastecimentos, na
--  migração 06) — não se digita a dupla KM INICIAL / KM FINAL da planilha,
--  só o km atual do painel a cada vez que se abastece.
--
--  `valor` é gerado: litros × preço do litro, nunca digitado.

create table if not exists public.abastecimentos (
  id                uuid primary key default gen_random_uuid(),
  data              date not null default current_date,
  veiculo_id        uuid references public.veiculos (id) on delete set null,
  motorista         text,
  tipo_combustivel  text not null default 'Diesel'
                      check (tipo_combustivel in ('Diesel', 'Gasolina', 'Etanol')),
  km_atual          numeric(10,1) not null default 0 check (km_atual >= 0),
  litros            numeric(10,3) not null default 0 check (litros > 0),
  preco_litro       numeric(10,4) not null default 0 check (preco_litro >= 0),
  valor             numeric(14,2) generated always as (round(litros * preco_litro, 2)) stored,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

create index if not exists abastecimentos_data_idx    on public.abastecimentos (data desc);
create index if not exists abastecimentos_veiculo_idx on public.abastecimentos (veiculo_id);

-- ─── Funcionários e diaristas ───────────────────────────────────────────────
--
--  As abas DIARISTAS e FUNCIONARIOS FIXOS da planilha, por nome. `tipo`
--  distingue diarista (pago por dia/serviço) de funcionário (registrado ou
--  fixo) sem precisar de duas tabelas iguais.

create table if not exists public.funcionarios (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  tipo           text not null default 'Funcionário' check (tipo in ('Diarista', 'Funcionário')),
  status         text not null default 'ativo' check (status in ('ativo', 'inativo')),
  salario        numeric(14,2) check (salario is null or salario >= 0),
  funcao         text,                  -- Gerente, Administrativo, Serviços Gerais, Motorista
  usuario_id     uuid,                  -- conta de acesso (perfis.id); a FK vem no auth.sql / migração 16
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists funcionarios_status_idx on public.funcionarios (status);
create index if not exists funcionarios_tipo_idx   on public.funcionarios (tipo);

-- ─── Pagamentos ─────────────────────────────────────────────────────────────
--
--  Uma linha por pagamento: data, quem recebeu, descrição livre (o serviço —
--  "Descarrego 1620" — ou vazio, quando é só o salário do mês) e valor.

create table if not exists public.pagamentos (
  id             uuid primary key default gen_random_uuid(),
  data           date not null default current_date,
  funcionario_id uuid references public.funcionarios (id) on delete set null,
  funcionario_nome text,                 -- cópia de quem recebeu: o histórico sobrevive à remoção
  funcionario_tipo text,
  descricao      text,
  valor          numeric(14,2) not null default 0 check (valor >= 0),  -- total: salário + extras
  extras         numeric(14,2) not null default 0 check (extras >= 0),  -- parte das horas extras
  horas_extras   numeric(8,2)  not null default 0 check (horas_extras >= 0),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists pagamentos_data_idx        on public.pagamentos (data desc);
create index if not exists pagamentos_funcionario_idx on public.pagamentos (funcionario_id);

-- ─── Gatilhos de atualizado_em ──────────────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array['redes', 'lojas', 'fornecedores', 'produtos', 'vendas',
                           'compras', 'perdas', 'despesas', 'acertos',
                           'veiculos', 'abastecimentos', 'funcionarios', 'pagamentos'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_atualizado_em', t);
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function public.tocar_atualizado_em()',
      t || '_atualizado_em', t
    );
  end loop;
end;
$$;

-- As views de relatório (vw_venda_itens, vw_contas_receber) dependem de
-- colunas que só existem depois do migracao-01-redes-lojas.sql (loja_id,
-- prazo_dias, vencimento em vendas). São criadas lá, não aqui — criá-las
-- neste arquivo quebraria a atualização de um banco com o modelo antigo,
-- que ainda não tem essas colunas na hora em que este schema roda.

-- ============================================================================
--  SEGURANÇA (RLS)
-- ============================================================================
--
--  ⚠️  ATENÇÃO — leia antes de colocar dados reais aqui.
--
--  A chave `anon` fica embutida no JavaScript que roda no navegador: qualquer
--  pessoa com o link do app consegue lê-la. As políticas abaixo liberam leitura
--  e escrita para essa chave, o que faz o app funcionar HOJE, sem tela de
--  login — mas significa que quem tiver a chave acessa todos os dados da
--  distribuidora.
--
--  Isso é aceitável para testes e para colocar o app no ar rapidamente.
--  Antes de operar com dados reais de clientes e faturamento, rode
--  supabase/auth.sql: ele cria a tabela `perfis`, liga o login por e-mail e
--  senha e substitui as políticas abaixo por regras baseadas no papel de cada
--  usuário, tirando o acesso da chave pública.

alter table public.redes        enable row level security;
alter table public.lojas        enable row level security;
alter table public.fornecedores enable row level security;
alter table public.produtos     enable row level security;
alter table public.compras      enable row level security;
alter table public.perdas       enable row level security;
alter table public.despesas     enable row level security;
alter table public.acertos      enable row level security;
alter table public.veiculos     enable row level security;
alter table public.abastecimentos enable row level security;
alter table public.funcionarios enable row level security;
alter table public.pagamentos   enable row level security;
alter table public.vendas       enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['redes', 'lojas', 'fornecedores', 'produtos', 'vendas',
                           'compras', 'perdas', 'despesas', 'acertos',
                           'veiculos', 'abastecimentos', 'funcionarios', 'pagamentos'] loop
    execute format('drop policy if exists %I on public.%I', 'acesso_app', t);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated
         using (true) with check (true)',
      'acesso_app', t
    );
  end loop;
end;
$$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete
  on public.redes, public.lojas, public.fornecedores, public.produtos,
     public.vendas, public.compras, public.perdas, public.despesas,
     public.acertos, public.veiculos, public.abastecimentos,
     public.funcionarios, public.pagamentos
  to anon, authenticated;
-- O grant das views (vw_venda_itens, vw_contas_receber) fica no
-- migracao-01-redes-lojas.sql, junto com a criação delas.


-- ─── Releitura das views de relatório ───────────────────────────────────────
--
--  Um `drop view` + `create view` numa migração ZERA os grants daquela view:
--  a permissão pertence ao objeto, e o objeto é outro. Como as views usam
--  `security_invoker = on`, uma view sem grant derruba também quem lê dela —
--  vw_dre_mes lê de vw_venda_itens, por exemplo.
--
--  Este bloco repõe a leitura em todas as views que existirem neste banco,
--  sem precisar saber quais são. Rodar schema.sql de novo conserta o estrago.

do $$
declare
  v record;
begin
  for v in
    select viewname from pg_views
    where schemaname = 'public' and viewname like 'vw\_%'
  loop
    execute format('grant select on public.%I to anon, authenticated', v.viewname);
  end loop;
end;
$$;

-- ─── PRODUÇÃO: só usuários autenticados ─────────────────────────────────────
--
--  O passo seguinte é o arquivo supabase/auth.sql, neste mesmo diretório.
--  Rode-o no SQL Editor depois deste. Ele:
--
--    • cria a tabela `perfis` (nome, papel e liberação de cada conta)
--    • gera o perfil automaticamente para quem for cadastrado no Auth
--    • troca as políticas acima por regras de papel (sócio master / assistente
--      administrativo), cobrindo as 9 tabelas de negócio, não só as 4 originais
--    • revoga o acesso da chave `anon`
--
--  O passo a passo para criar o primeiro sócio master está no fim daquele
--  arquivo. Depois de rodá-lo, o app passa a exigir login — é o esperado.

-- ─── Tempo real (opcional) ──────────────────────────────────────────────────
--
--  Faz o Postgres publicar as alterações para clientes conectados. O app
--  atualmente sincroniza por polling; ative isto quando for ligar o Realtime.
--
--  alter publication supabase_realtime add table public.redes;
--  alter publication supabase_realtime add table public.lojas;
--  alter publication supabase_realtime add table public.fornecedores;
--  alter publication supabase_realtime add table public.produtos;
--  alter publication supabase_realtime add table public.vendas;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-01-redes-lojas.sql
-- ============================================================================
--  Migração 01 — de «clientes» para «rede → loja»
--
--  Leva o banco do modelo antigo (cliente plano, produto de unidade única,
--  venda sem prazo) para o modelo da planilha de gestão. NADA é apagado:
--  cada cliente existente vira uma loja, dentro de uma rede de mesmo nome.
--
--  Como aplicar, SEMPRE NESTA ORDEM — mesmo em projeto novo, sem tabela
--  `clientes`:
--    1. schema.sql              cria redes, lojas, fornecedores, produtos, vendas
--    2. migracao-01 (este)      move os dados, acrescenta as colunas novas e
--                                cria as views de relatório (vw_venda_itens,
--                                vw_contas_receber)
--
--  As views ficam aqui, e não no schema.sql: elas leem loja_id/prazo_dias/
--  vencimento em vendas, colunas que só existem depois do passo 3 abaixo.
--  Criá-las no schema.sql quebraria a atualização de um banco com o modelo
--  antigo, que ainda não tem essas colunas na hora em que aquele script roda.
--
--  Idempotente: rodar de novo não duplica nada.
--  Faça um backup antes (Supabase → Database → Backups) — é rápido e evita dor.
-- ============================================================================

begin;

-- ─── 1. Clientes viram lojas ────────────────────────────────────────────────
--
--  O modelo antigo não tinha rede. Cada cliente vira uma rede de um nome só,
--  com uma loja MATRIZ dentro. Depois, na tela de Clientes do app, você agrupa
--  as lojas que na verdade pertencem à mesma rede.

do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'clientes') then

    -- Uma rede por cliente, reaproveitando o id para a ligação ficar óbvia.
    insert into public.redes (id, nome, telefone, status, criado_em)
    select c.id, c.nome, c.telefone, c.status, c.criado_em
    from public.clientes c
    on conflict (id) do nothing;

    -- A loja MATRIZ de cada uma, com o endereço antigo virando cidade.
    insert into public.lojas (rede_id, nome, cidade, telefone, status, criado_em)
    select c.id, 'MATRIZ', c.endereco, c.telefone, c.status, c.criado_em
    from public.clientes c
    on conflict (rede_id, lower(nome)) do nothing;

  end if;
end;
$$;

-- ─── 2. Produtos ganham unidade de venda e fator de conversão ───────────────

alter table public.produtos add column if not exists fruta          text;
alter table public.produtos add column if not exists unidade_venda  text;
alter table public.produtos add column if not exists kg_por_unidade numeric(10,3);

-- Tudo que existia era vendido por unidade simples: vira agranel, fator 1.
update public.produtos
   set unidade_venda  = coalesce(unidade_venda, 'kg'),
       kg_por_unidade = coalesce(kg_por_unidade, 1),
       fruta          = coalesce(fruta, 'Laranja Pera')
 where unidade_venda is null or kg_por_unidade is null or fruta is null;

alter table public.produtos alter column fruta          set default 'Laranja Pera';
alter table public.produtos alter column unidade_venda  set default 'kg';
alter table public.produtos alter column kg_por_unidade set default 1;
alter table public.produtos alter column fruta          set not null;
alter table public.produtos alter column unidade_venda  set not null;
alter table public.produtos alter column kg_por_unidade set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'produtos_agranel_fator_um') then
    alter table public.produtos add constraint produtos_agranel_fator_um
      check (unidade_venda <> 'kg' or kg_por_unidade = 1);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'produtos_unidade_venda_check') then
    alter table public.produtos add constraint produtos_unidade_venda_check
      check (unidade_venda in ('kg', 'saco'));
  end if;
end;
$$;

create index if not exists produtos_fruta_idx on public.produtos (fruta);

-- `categoria` e `unidade` do modelo antigo não são mais usadas. Ficam onde
-- estão, sem atrapalhar — apague só quando tiver certeza:
--   alter table public.produtos drop column if exists categoria;
--   alter table public.produtos drop column if exists unidade;

-- ─── 3. Vendas ganham loja, prazo, vencimento e quilos ──────────────────────

alter table public.vendas add column if not exists loja_id    uuid references public.lojas (id) on delete set null;
alter table public.vendas add column if not exists prazo_dias integer not null default 0;
alter table public.vendas add column if not exists kg_total   numeric(12,3) not null default 0;

-- Aponta cada venda para a loja MATRIZ da rede que veio do cliente antigo.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'vendas'
               and column_name = 'cliente_id') then
    update public.vendas v
       set loja_id = l.id
      from public.lojas l
     where l.rede_id = v.cliente_id
       and lower(l.nome) = 'matriz'
       and v.loja_id is null;
  end if;
end;
$$;

-- vencimento = data + prazo. Coluna gerada: derivada, nunca digitada.
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'vendas'
                   and column_name = 'vencimento') then
    alter table public.vendas
      add column vencimento date generated always as (data + prazo_dias) stored;
  end if;
end;
$$;

-- ─── 4. Itens de venda ganham conversão e natureza ──────────────────────────
--
--  Antes:  { produtoId, qty, preco }
--  Agora:  { produtoId, qty, precoUnitario, kgPorUnidade, kgTotal, natureza }

update public.vendas v
   set itens = (
     select jsonb_agg(
       jsonb_build_object(
         'produtoId',     item ->> 'produtoId',
         'qty',           coalesce((item ->> 'qty')::numeric, 0),
         'precoUnitario', coalesce((item ->> 'precoUnitario')::numeric,
                                   (item ->> 'preco')::numeric, 0),
         'kgPorUnidade',  coalesce((item ->> 'kgPorUnidade')::numeric,
                                   p.kg_por_unidade, 1),
         'kgTotal',       coalesce((item ->> 'kgTotal')::numeric,
                                   (item ->> 'qty')::numeric * coalesce(p.kg_por_unidade, 1), 0),
         'natureza',      coalesce(item ->> 'natureza', 'venda')
       )
     )
     from jsonb_array_elements(v.itens) as item
     left join public.produtos p on p.id = (item ->> 'produtoId')::uuid
   )
 where jsonb_array_length(v.itens) > 0
   and not (v.itens -> 0 ? 'natureza');   -- só o que ainda está no formato antigo

-- Recalcula o total em quilos a partir dos itens já convertidos.
update public.vendas v
   set kg_total = coalesce((
     select sum((item ->> 'kgTotal')::numeric)
     from jsonb_array_elements(v.itens) as item
   ), 0)
 where kg_total = 0;

-- ─── 5. Índices novos ───────────────────────────────────────────────────────

create index if not exists vendas_loja_idx       on public.vendas (loja_id);
create index if not exists vendas_vencimento_idx on public.vendas (vencimento);
create index if not exists vendas_vencidas_idx
  on public.vendas (vencimento) where status = 'pendente';

-- ─── 6. Views de relatório ───────────────────────────────────────────────────
--
--  Só podem ser criadas agora: dependem de loja_id, prazo_dias e vencimento,
--  que acabaram de ser acrescentadas a vendas no passo 3.
--
--  `drop view` antes do `create`: a ordem das colunas mudou bastante em
--  relação à vw_venda_itens antiga (que já existia, do modelo de clientes),
--  e o Postgres não deixa um `create or replace view` renomear ou reordenar
--  colunas existentes — só apagando e recriando.

drop view if exists public.vw_venda_itens;

create or replace view public.vw_venda_itens as
select
  v.id                                  as venda_id,
  v.numero,
  v.data,
  v.vencimento,
  v.status,
  v.loja_id,
  l.rede_id,
  (item ->> 'produtoId')::uuid          as produto_id,
  coalesce(item ->> 'natureza', 'venda') as natureza,
  (item ->> 'qty')::numeric             as quantidade,
  (item ->> 'kgTotal')::numeric         as kg,
  (item ->> 'precoUnitario')::numeric   as preco_unitario,
  (item ->> 'qty')::numeric * (item ->> 'precoUnitario')::numeric as subtotal
from public.vendas v
left join public.lojas l on l.id = v.loja_id
cross join lateral jsonb_array_elements(v.itens) as item;

alter view public.vw_venda_itens set (security_invoker = on);

-- O que a planilha nunca teve: a pendência com data de vencimento e os dias
-- de atraso calculados.
create or replace view public.vw_contas_receber as
select
  v.id                                as venda_id,
  v.numero,
  v.data,
  v.prazo_dias,
  v.vencimento,
  v.total,
  l.nome                              as loja,
  r.nome                              as rede,
  r.id                                as rede_id,
  (current_date - v.vencimento)       as dias_atraso,
  current_date > v.vencimento         as vencida
from public.vendas v
left join public.lojas l on l.id = v.loja_id
left join public.redes r on r.id = l.rede_id
where v.status = 'pendente';

alter view public.vw_contas_receber set (security_invoker = on);

grant select on public.vw_venda_itens, public.vw_contas_receber to anon, authenticated;

-- Exemplo de uso: faturamento por rede no mês, sem contar bonificação
--   select rede_id, sum(subtotal) as receita, sum(kg) as quilos
--   from public.vw_venda_itens
--   where status <> 'cancelado' and natureza = 'venda'
--     and data >= date_trunc('month', current_date)
--   group by rede_id order by receita desc;

commit;

-- ─── 7. Só depois de conferir tudo no app ───────────────────────────────────
--
--  Confira na tela de Clientes que as redes e lojas apareceram, e em Vendas
--  que os pedidos antigos continuam ligados ao cliente certo. Aí sim:
--
--    alter table public.vendas drop column if exists cliente_id;
--    drop table if exists public.clientes;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-02-compras.sql
-- ============================================================================
--  Migração 02 — compras de mercadoria e estoque por fruta
--
--  A tabela `compras` já vem do schema.sql. Este arquivo cria as duas views
--  que dependem de colunas que a migração 01 acrescenta (produtos.fruta):
--
--    vw_compras_fruta   quanto entrou de cada fruta e a que custo por quilo
--    vw_estoque_fruta   entradas − saídas, o estoque de verdade
--
--  Como aplicar, NESTA ORDEM:
--    1. schema.sql
--    2. migracao-01-redes-lojas.sql
--    3. migracao-02-compras.sql (este)
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

-- ─── Custo de compra por fruta ──────────────────────────────────────────────
--
--  O custo médio é a divisão, não a média das médias: soma o que foi pago e
--  divide pelo que foi comprado. Uma compra de 329 t a R$ 0,60 pesa muito mais
--  na conta do que uma de 18 t a R$ 0,78, e é assim que tem de pesar.

create or replace view public.vw_compras_fruta as
select
  fruta,
  count(*)                                          as compras,
  sum(peso_kg)                                      as kg_comprado,
  sum(total)                                        as valor_total,
  case when sum(peso_kg) > 0
       then sum(total) / sum(peso_kg)
       else 0 end                                   as custo_medio_kg,
  min(data)                                         as primeira_compra,
  max(data)                                         as ultima_compra
from public.compras
group by fruta;

alter view public.vw_compras_fruta set (security_invoker = on);

-- ─── Estoque por fruta ──────────────────────────────────────────────────────
--
--  O estoque deixa de ser um número digitado e vira uma conta.
--
--  Entra: o que foi comprado.
--  Sai:   tudo que foi entregue — inclusive a bonificação, que não gera
--         receita mas esvazia o caminhão igual.
--
--  Compra-se fruta e vende-se produto: os sacos de 2,5 kg e o agranel saem do
--  mesmo estoque de laranja pera. Por isso a saída passa por produtos.fruta.
--
--  Venda cancelada não movimenta nada.

create or replace view public.vw_estoque_fruta as
with frutas as (
  select unnest(array['Laranja Pera', 'Laranja Lima', 'Abóbora']) as fruta
),
entradas as (
  select fruta, sum(peso_kg) as kg
  from public.compras
  group by fruta
),
saidas as (
  select
    p.fruta,
    sum((item ->> 'kgTotal')::numeric) as kg,
    sum((item ->> 'kgTotal')::numeric)
      filter (where coalesce(item ->> 'natureza', 'venda') = 'bonificacao') as kg_bonificado
  from public.vendas v
  cross join lateral jsonb_array_elements(v.itens) as item
  join public.produtos p on p.id = (item ->> 'produtoId')::uuid
  where v.status <> 'cancelado'
  group by p.fruta
)
select
  f.fruta,
  coalesce(e.kg, 0)                          as entradas_kg,
  coalesce(s.kg, 0)                          as saidas_kg,
  coalesce(s.kg_bonificado, 0)               as bonificado_kg,
  coalesce(e.kg, 0) - coalesce(s.kg, 0)      as estoque_kg,
  coalesce(e.kg, 0) - coalesce(s.kg, 0) < 0  as negativo
from frutas f
left join entradas e on e.fruta = f.fruta
left join saidas   s on s.fruta = f.fruta;

alter view public.vw_estoque_fruta set (security_invoker = on);

grant select on public.vw_compras_fruta, public.vw_estoque_fruta to anon, authenticated;

commit;

-- Exemplo: margem por fruta, comparando o que se vendeu com o que se comprou
--   select c.fruta, c.custo_medio_kg,
--          sum(i.subtotal) / nullif(sum(i.kg), 0) as preco_medio_kg
--   from public.vw_compras_fruta c
--   join public.produtos p on p.fruta = c.fruta
--   join public.vw_venda_itens i on i.produto_id = p.id
--   where i.status <> 'cancelado' and i.natureza = 'venda'
--   group by c.fruta, c.custo_medio_kg;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-03-perdas-estoque.sql
-- ============================================================================
--  Migração 03 — perdas e o estoque como conta
--
--  A tabela `perdas` já vem do schema.sql. Este arquivo refaz a view de
--  estoque para descontar a perda, e cria a view de perdas por fruta.
--
--  É aqui que o estoque deixa de ser um número digitado:
--
--      estoque = compras − vendas − perdas
--
--  Quando o saldo estiver errado, o erro está num lançamento — e dá para achar
--  qual. Era exatamente o que faltava para explicar a abóbora com −50,40 kg na
--  planilha: vendeu-se mais do que entrou, e não havia onde procurar.
--
--  Como aplicar, NESTA ORDEM:
--    1. schema.sql
--    2. migracao-01-redes-lojas.sql
--    3. migracao-02-compras.sql
--    4. migracao-03-perdas-estoque.sql (este)
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

-- ─── Perdas por fruta ───────────────────────────────────────────────────────

create or replace view public.vw_perdas_fruta as
select
  fruta,
  count(*)        as ocorrencias,
  sum(kg)         as kg_perdido,
  sum(valor)      as valor_perdido
from public.perdas
group by fruta;

alter view public.vw_perdas_fruta set (security_invoker = on);

-- ─── Estoque por fruta ──────────────────────────────────────────────────────
--
--  Entra: o que foi comprado.
--  Sai:   o que foi entregue — inclusive a bonificação, que não gera receita
--         mas esvazia o caminhão igual — e o que se perdeu.
--
--  Compra-se fruta e vende-se produto: os sacos de 2,5 kg e o agranel saem do
--  mesmo estoque de laranja pera. Por isso a saída passa por produtos.fruta.
--
--  Venda cancelada não movimenta nada.
--
--  `drop` antes de recriar: a view ganhou colunas no meio, e o Postgres não
--  deixa reordenar colunas de uma view existente com `create or replace`.

drop view if exists public.vw_estoque_fruta;

create view public.vw_estoque_fruta as
with frutas as (
  select unnest(array['Laranja Pera', 'Laranja Lima', 'Abóbora']) as fruta
),
entradas as (
  select fruta, sum(peso_kg) as kg
  from public.compras
  group by fruta
),
saidas as (
  select
    p.fruta,
    sum((item ->> 'kgTotal')::numeric) as kg,
    sum((item ->> 'kgTotal')::numeric)
      filter (where coalesce(item ->> 'natureza', 'venda') = 'bonificacao') as kg_bonificado
  from public.vendas v
  cross join lateral jsonb_array_elements(v.itens) as item
  join public.produtos p on p.id = (item ->> 'produtoId')::uuid
  where v.status <> 'cancelado'
  group by p.fruta
),
perdido as (
  select fruta, sum(kg) as kg
  from public.perdas
  group by fruta
)
select
  f.fruta,
  coalesce(e.kg, 0)                      as entradas_kg,
  coalesce(s.kg, 0)                      as vendas_kg,
  coalesce(s.kg_bonificado, 0)           as bonificado_kg,
  coalesce(pd.kg, 0)                     as perdas_kg,
  coalesce(e.kg, 0) - coalesce(s.kg, 0) - coalesce(pd.kg, 0) as estoque_kg,
  coalesce(e.kg, 0) - coalesce(s.kg, 0) - coalesce(pd.kg, 0) < 0 as negativo
from frutas f
left join entradas e  on e.fruta  = f.fruta
left join saidas   s  on s.fruta  = f.fruta
left join perdido  pd on pd.fruta = f.fruta;

alter view public.vw_estoque_fruta set (security_invoker = on);

grant select on public.vw_perdas_fruta, public.vw_estoque_fruta to anon, authenticated;

commit;

-- Confira:  select * from public.vw_estoque_fruta order by fruta;
--
-- Estoque negativo quer dizer que saiu mais do que entrou. Ou falta registrar
-- uma compra, ou sobra uma venda. O app marca a fruta em vermelho.


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-04-despesas-dre.sql
-- ============================================================================
--  Migração 04 — despesas e o DRE
--
--  A tabela `despesas` já vem do schema.sql. Este arquivo cria as views que
--  fecham o mês:
--
--    vw_despesas_mes   quanto saiu de cada categoria, mês a mês
--    vw_dre_mes        receita − despesas − mercadoria = resultado
--
--  Como aplicar, NESTA ORDEM:
--    1. schema.sql
--    2. migracao-01-redes-lojas.sql
--    3. migracao-02-compras.sql
--    4. migracao-03-perdas-estoque.sql
--    5. migracao-04-despesas-dre.sql (este)
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

-- ─── Despesas por mês e categoria ───────────────────────────────────────────

create or replace view public.vw_despesas_mes as
select
  date_trunc('month', data)::date as mes,
  categoria,
  count(*)                        as lancamentos,
  sum(valor)                      as total
from public.despesas
group by 1, 2;

alter view public.vw_despesas_mes set (security_invoker = on);

-- ─── DRE por mês ────────────────────────────────────────────────────────────
--
--  A mesma conta da aba DRE da planilha:
--
--      resultado = receita − despesas − mercadoria
--
--  Três escolhas que copiam o método da planilha, de propósito:
--
--  1. RECEITA não conta bonificação. Mercadoria entregue sem cobrar não é
--     faturamento — e é por isso que `natureza = 'venda'` está no filtro.
--
--  2. MERCADORIA é o que foi COMPRADO no mês, não o custo do que foi vendido.
--     Não é CMV contábil: é caixa. Um mês em que se compra a safra inteira
--     fecha no vermelho mesmo vendendo bem, e foi exatamente o que aconteceu
--     em agosto. Trocar isso por CMV mudaria os números que você conhece.
--
--  3. PERDA não entra. A fruta perdida já foi paga quando entrou, e está
--     dentro de MERCADORIA — somá-la de novo contaria o prejuízo duas vezes.
--     Ela aparece à parte, em vw_perdas_fruta e na tela de Estoque.
--
--  Venda cancelada não entra em nada.

create or replace view public.vw_dre_mes as
with receita as (
  select date_trunc('month', data)::date as mes, sum(subtotal) as valor
  from public.vw_venda_itens
  where status <> 'cancelado' and natureza = 'venda'
  group by 1
),
quilos as (
  select date_trunc('month', data)::date as mes, sum(kg) as kg
  from public.vw_venda_itens
  where status <> 'cancelado' and natureza = 'venda'
  group by 1
),
despesa as (
  select date_trunc('month', data)::date as mes, sum(valor) as valor
  from public.despesas
  group by 1
),
mercadoria as (
  select date_trunc('month', data)::date as mes, sum(total) as valor, sum(peso_kg) as kg
  from public.compras
  group by 1
),
meses as (
  select mes from receita
  union select mes from despesa
  union select mes from mercadoria
)
select
  m.mes,
  coalesce(r.valor, 0)                                              as receita,
  coalesce(d.valor, 0)                                              as despesas,
  coalesce(c.valor, 0)                                              as mercadoria,
  coalesce(r.valor, 0) - coalesce(d.valor, 0) - coalesce(c.valor, 0) as resultado,
  case when coalesce(r.valor, 0) > 0
       then (coalesce(r.valor, 0) - coalesce(d.valor, 0) - coalesce(c.valor, 0))
            / r.valor * 100
       else 0 end                                                   as margem_pct,
  coalesce(q.kg, 0)                                                 as kg_vendidos,
  case when coalesce(q.kg, 0) > 0 then r.valor / q.kg else 0 end     as preco_medio_kg,
  case when coalesce(c.kg, 0) > 0 then c.valor / c.kg else 0 end     as custo_medio_kg
from meses m
left join receita    r on r.mes = m.mes
left join quilos     q on q.mes = m.mes
left join despesa    d on d.mes = m.mes
left join mercadoria c on c.mes = m.mes
order by m.mes;

alter view public.vw_dre_mes set (security_invoker = on);

grant select on public.vw_despesas_mes, public.vw_dre_mes to anon, authenticated;

commit;

-- Confira:  select * from public.vw_dre_mes;
--
-- Com o histórico importado, agosto tem de fechar em −R$ 41.301,72 e setembro
-- em R$ 19.248,67 — só depois que as vendas de junho a setembro entrarem. Até
-- lá a receita está vazia e o resultado aparece negativo pelo valor das
-- compras, que é o correto: a mercadoria entrou, a venda ainda não foi lançada.


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-05-acertos.sql
-- ============================================================================
--  Migração 05 — acertos de inventário no saldo de estoque
--
--  A tabela `acertos` já vem do schema.sql. Este arquivo refaz a view de
--  estoque para somar o ajuste:
--
--      estoque = compras − vendas − perdas + acertos
--
--  Como aplicar, NESTA ORDEM:
--    1. schema.sql
--    2. migracao-01-redes-lojas.sql
--    3. migracao-02-compras.sql
--    4. migracao-03-perdas-estoque.sql
--    5. migracao-04-despesas-dre.sql
--    6. migracao-05-acertos.sql (este)
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

-- ─── Estoque por fruta ──────────────────────────────────────────────────────
--
--  Entra: o que foi comprado.
--  Sai:   o que foi entregue — inclusive a bonificação, que não gera receita
--         mas esvazia o caminhão igual — e o que se perdeu.
--  Acerta: a diferença entre o que a conta dizia e o que foi contado.
--
--  Compra-se fruta e vende-se produto: os sacos de 2,5 kg e o agranel saem do
--  mesmo estoque de laranja pera. Por isso a saída passa por produtos.fruta.
--
--  Venda cancelada não movimenta nada.
--
--  `drop` antes de recriar: a view ganhou colunas no meio, e o Postgres não
--  deixa reordenar colunas de uma view existente com `create or replace`.

drop view if exists public.vw_estoque_fruta;

create view public.vw_estoque_fruta as
with frutas as (
  select unnest(array['Laranja Pera', 'Laranja Lima', 'Abóbora']) as fruta
),
entradas as (
  select fruta, sum(peso_kg) as kg
  from public.compras
  group by fruta
),
saidas as (
  select
    p.fruta,
    sum((item ->> 'kgTotal')::numeric) as kg,
    sum((item ->> 'kgTotal')::numeric)
      filter (where coalesce(item ->> 'natureza', 'venda') = 'bonificacao') as kg_bonificado
  from public.vendas v
  cross join lateral jsonb_array_elements(v.itens) as item
  join public.produtos p on p.id = (item ->> 'produtoId')::uuid
  where v.status <> 'cancelado'
  group by p.fruta
),
perdido as (
  select fruta, sum(kg) as kg
  from public.perdas
  group by fruta
),
acertado as (
  select fruta, sum(ajuste) as kg
  from public.acertos
  group by fruta
)
select
  f.fruta,
  coalesce(e.kg, 0)            as entradas_kg,
  coalesce(s.kg, 0)            as vendas_kg,
  coalesce(s.kg_bonificado, 0) as bonificado_kg,
  coalesce(pd.kg, 0)           as perdas_kg,
  coalesce(ac.kg, 0)           as acertos_kg,
  coalesce(e.kg, 0) - coalesce(s.kg, 0) - coalesce(pd.kg, 0) + coalesce(ac.kg, 0) as estoque_kg,
  coalesce(e.kg, 0) - coalesce(s.kg, 0) - coalesce(pd.kg, 0) + coalesce(ac.kg, 0) < 0 as negativo
from frutas f
left join entradas e  on e.fruta  = f.fruta
left join saidas   s  on s.fruta  = f.fruta
left join perdido  pd on pd.fruta = f.fruta
left join acertado ac on ac.fruta = f.fruta;

alter view public.vw_estoque_fruta set (security_invoker = on);

-- ─── Acertos por fruta ──────────────────────────────────────────────────────

create or replace view public.vw_acertos_fruta as
select
  fruta,
  count(*)       as acertos,
  sum(ajuste)    as ajuste_kg,
  max(data)      as ultima_contagem
from public.acertos
group by fruta;

alter view public.vw_acertos_fruta set (security_invoker = on);

grant select on public.vw_estoque_fruta, public.vw_acertos_fruta to anon, authenticated;

commit;

-- Confira:  select * from public.vw_estoque_fruta order by fruta;
--
-- Um acerto não apaga o histórico: as compras, vendas e perdas continuam lá.
-- Ele registra que na data X existiam Y quilos, e a diferença fica visível.


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-06-combustivel.sql
-- ============================================================================
--  Migração 06 — combustível e veículos
--
--  As tabelas `veiculos` e `abastecimentos` já vêm do schema.sql. Este arquivo
--  cria as views que fecham o quilômetro e o mês:
--
--    vw_abastecimentos     cada abastecimento com km rodado, km/l e custo/km
--    vw_combustivel_mes    litros e valor gasto, mês a mês
--    vw_dre_mes            passa a somar combustível junto de despesas
--
--  Como aplicar, NESTA ORDEM:
--    1. schema.sql
--    2. migracao-01-redes-lojas.sql
--    3. migracao-02-compras.sql
--    4. migracao-03-perdas-estoque.sql
--    5. migracao-04-despesas-dre.sql
--    5b. migracao-05-acertos.sql
--    6. migracao-06-combustivel.sql (este)
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

-- ─── Abastecimentos, com quilometragem ──────────────────────────────────────
--
--  Km rodado NÃO é a dupla KM INICIAL / KM FINAL da planilha — é a diferença
--  para o km atual do abastecimento ANTERIOR do mesmo veículo, na ordem em que
--  os abastecimentos aconteceram. `lag()` faz exatamente essa "olhada para
--  trás" por veículo. O primeiro abastecimento de cada veículo, ou um km atual
--  menor ou igual ao anterior (erro de digitação), fica sem quilometragem —
--  mesma regra do app offline, em abastecimentosComKm().

create or replace view public.vw_abastecimentos as
select
  a.id,
  a.data,
  a.veiculo_id,
  v.nome as veiculo,
  a.motorista,
  a.tipo_combustivel,
  a.km_atual,
  a.litros,
  a.preco_litro,
  a.valor,
  case
    when a.km_atual > lag(a.km_atual) over (partition by a.veiculo_id order by a.data, a.criado_em)
      then a.km_atual - lag(a.km_atual) over (partition by a.veiculo_id order by a.data, a.criado_em)
    else null
  end as km_rodado,
  a.criado_em
from public.abastecimentos a
left join public.veiculos v on v.id = a.veiculo_id;

alter view public.vw_abastecimentos set (security_invoker = on);

-- km/l e custo/km são funções do km_rodado acima — ficam numa segunda view em
-- vez de repetir o `case` duas vezes na primeira.

create or replace view public.vw_abastecimentos_km as
select
  *,
  case when km_rodado > 0 and litros > 0 then km_rodado / litros else null end as km_por_litro,
  case when km_rodado > 0 then valor / km_rodado else null end as custo_por_km
from public.vw_abastecimentos;

alter view public.vw_abastecimentos_km set (security_invoker = on);

-- ─── Combustível por mês ────────────────────────────────────────────────────

create or replace view public.vw_combustivel_mes as
select
  date_trunc('month', data)::date as mes,
  count(*)                        as abastecimentos,
  sum(litros)                     as litros,
  sum(valor)                      as valor
from public.abastecimentos
group by 1;

alter view public.vw_combustivel_mes set (security_invoker = on);

-- ─── DRE por mês, agora com combustível ─────────────────────────────────────
--
--  Combustível é despesa — só que com quilometragem em vez de descrição
--  livre, por isso vive em tabela própria. Refaz a mesma conta da migração
--  04, só trocando a CTE `despesa` para somar as duas fontes.

create or replace view public.vw_dre_mes as
with receita as (
  select date_trunc('month', data)::date as mes, sum(subtotal) as valor
  from public.vw_venda_itens
  where status <> 'cancelado' and natureza = 'venda'
  group by 1
),
quilos as (
  select date_trunc('month', data)::date as mes, sum(kg) as kg
  from public.vw_venda_itens
  where status <> 'cancelado' and natureza = 'venda'
  group by 1
),
despesa as (
  select mes, sum(valor) as valor from (
    select date_trunc('month', data)::date as mes, valor from public.despesas
    union all
    select date_trunc('month', data)::date as mes, valor from public.abastecimentos
  ) t
  group by 1
),
mercadoria as (
  select date_trunc('month', data)::date as mes, sum(total) as valor, sum(peso_kg) as kg
  from public.compras
  group by 1
),
meses as (
  select mes from receita
  union select mes from despesa
  union select mes from mercadoria
)
select
  m.mes,
  coalesce(r.valor, 0)                                              as receita,
  coalesce(d.valor, 0)                                              as despesas,
  coalesce(c.valor, 0)                                              as mercadoria,
  coalesce(r.valor, 0) - coalesce(d.valor, 0) - coalesce(c.valor, 0) as resultado,
  case when coalesce(r.valor, 0) > 0
       then (coalesce(r.valor, 0) - coalesce(d.valor, 0) - coalesce(c.valor, 0))
            / r.valor * 100
       else 0 end                                                   as margem_pct,
  coalesce(q.kg, 0)                                                 as kg_vendidos,
  case when coalesce(q.kg, 0) > 0 then r.valor / q.kg else 0 end     as preco_medio_kg,
  case when coalesce(c.kg, 0) > 0 then c.valor / c.kg else 0 end     as custo_medio_kg
from meses m
left join receita    r on r.mes = m.mes
left join quilos     q on q.mes = m.mes
left join despesa    d on d.mes = m.mes
left join mercadoria c on c.mes = m.mes
order by m.mes;

alter view public.vw_dre_mes set (security_invoker = on);

grant select
  on public.vw_abastecimentos, public.vw_abastecimentos_km, public.vw_combustivel_mes, public.vw_dre_mes
  to anon, authenticated;

commit;

-- Confira:  select * from public.vw_abastecimentos_km order by veiculo, data;
--
-- Km/l e custo/km ficam em branco no primeiro abastecimento de cada veículo —
-- só existe "km rodado" a partir do segundo, quando há um km anterior para
-- comparar.


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-07-folha-pagamento.sql
-- ============================================================================
--  Migração 07 — folha de diaristas e funcionários por nome
--
--  As tabelas `funcionarios` e `pagamentos` já vêm do schema.sql. Este
--  arquivo cria as views que fecham o mês e a pessoa:
--
--    vw_pagamentos_pessoa   total pago e lançamentos, por pessoa
--    vw_folha_mes           total pago, por mês e por tipo (Diarista/Funcionário)
--    vw_dre_mes             passa a somar a folha junto de despesas
--
--  Como aplicar, NESTA ORDEM:
--    1. schema.sql
--    2. migracao-01-redes-lojas.sql
--    3. migracao-02-compras.sql
--    4. migracao-03-perdas-estoque.sql
--    5. migracao-04-despesas-dre.sql
--    5b. migracao-05-acertos.sql
--    5c. migracao-06-combustivel.sql
--    6. migracao-07-folha-pagamento.sql (este)
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

-- ─── Pagamentos por pessoa ──────────────────────────────────────────────────

create or replace view public.vw_pagamentos_pessoa as
select
  f.id             as funcionario_id,
  f.nome,
  f.tipo,
  f.status,
  count(p.id)      as lancamentos,
  coalesce(sum(p.valor), 0) as total,
  max(p.data)      as ultimo_pagamento
from public.funcionarios f
left join public.pagamentos p on p.funcionario_id = f.id
group by f.id, f.nome, f.tipo, f.status;

alter view public.vw_pagamentos_pessoa set (security_invoker = on);

-- ─── Folha por mês e tipo ───────────────────────────────────────────────────

create or replace view public.vw_folha_mes as
select
  date_trunc('month', p.data)::date as mes,
  f.tipo,
  count(*)         as lancamentos,
  sum(p.valor)     as total
from public.pagamentos p
join public.funcionarios f on f.id = p.funcionario_id
group by 1, 2;

alter view public.vw_folha_mes set (security_invoker = on);

-- ─── DRE por mês, agora com a folha ─────────────────────────────────────────
--
--  Diarista e funcionário são despesa — só que por nome em vez de descrição
--  livre, por isso vivem em tabela própria. Refaz a mesma conta da migração
--  06, só acrescentando `pagamentos` à CTE `despesa`.

create or replace view public.vw_dre_mes as
with receita as (
  select date_trunc('month', data)::date as mes, sum(subtotal) as valor
  from public.vw_venda_itens
  where status <> 'cancelado' and natureza = 'venda'
  group by 1
),
quilos as (
  select date_trunc('month', data)::date as mes, sum(kg) as kg
  from public.vw_venda_itens
  where status <> 'cancelado' and natureza = 'venda'
  group by 1
),
despesa as (
  select mes, sum(valor) as valor from (
    select date_trunc('month', data)::date as mes, valor from public.despesas
    union all
    select date_trunc('month', data)::date as mes, valor from public.abastecimentos
    union all
    select date_trunc('month', data)::date as mes, valor from public.pagamentos
  ) t
  group by 1
),
mercadoria as (
  select date_trunc('month', data)::date as mes, sum(total) as valor, sum(peso_kg) as kg
  from public.compras
  group by 1
),
meses as (
  select mes from receita
  union select mes from despesa
  union select mes from mercadoria
)
select
  m.mes,
  coalesce(r.valor, 0)                                              as receita,
  coalesce(d.valor, 0)                                              as despesas,
  coalesce(c.valor, 0)                                              as mercadoria,
  coalesce(r.valor, 0) - coalesce(d.valor, 0) - coalesce(c.valor, 0) as resultado,
  case when coalesce(r.valor, 0) > 0
       then (coalesce(r.valor, 0) - coalesce(d.valor, 0) - coalesce(c.valor, 0))
            / r.valor * 100
       else 0 end                                                   as margem_pct,
  coalesce(q.kg, 0)                                                 as kg_vendidos,
  case when coalesce(q.kg, 0) > 0 then r.valor / q.kg else 0 end     as preco_medio_kg,
  case when coalesce(c.kg, 0) > 0 then c.valor / c.kg else 0 end     as custo_medio_kg
from meses m
left join receita    r on r.mes = m.mes
left join quilos     q on q.mes = m.mes
left join despesa    d on d.mes = m.mes
left join mercadoria c on c.mes = m.mes
order by m.mes;

alter view public.vw_dre_mes set (security_invoker = on);

grant select
  on public.vw_pagamentos_pessoa, public.vw_folha_mes, public.vw_dre_mes
  to anon, authenticated;

commit;

-- Confira:  select * from public.vw_pagamentos_pessoa order by total desc;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-08-nfe.sql
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


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-09-omie-ids.sql
-- ============================================================================
--  Migração 09 — códigos internos do Omie
--
--  A API do Omie não aceita CNPJ ou nome do produto na hora de montar um
--  pedido: ela quer o `codigo_cliente` e o `codigo_produto` internos dela.
--  Essas colunas guardam esse código depois de resolvido uma vez (por CNPJ,
--  no caso do cliente), para não repetir a busca a cada venda.
--
--  `cfop_padrao` existe porque o CFOP depende de mercadoria própria vs.
--  revenda de terceiros — um exemplo real de nota emitida pela distribuidora
--  mostrou os dois casos (laranja com 5.101, as demais frutas com 5.102).
--  Sem essa coluna, o código assume 5.102 (revenda) por padrão — ajuste aqui
--  o produto que for produção própria.
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
--    9. migracao-08-nfe.sql
--   10. migracao-09-omie-ids.sql (este)
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

alter table public.lojas    add column if not exists omie_codigo_cliente bigint;
alter table public.produtos add column if not exists omie_codigo_produto bigint;
alter table public.produtos add column if not exists cfop_padrao         text;
-- A unidade que o Omie já tem cadastrada para esse produto (ex.: "KG", "BAG") —
-- não é sempre igual ao unidade_venda do app (kg/saco), então fica separada
-- em vez de tentar converter uma na outra.
alter table public.produtos add column if not exists unidade_omie        text;
alter table public.vendas   add column if not exists omie_codigo_pedido  bigint;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-10-cancelamento-nfe.sql
-- ============================================================================
--  Migração 10 — cancelamento de NF-e
--
--  Faltava guardar o id que a Spedy dá pra nota (spedy_id): sem ele, depois
--  de recarregar a página não tinha como pedir o cancelamento, porque esse
--  id só vivia no estado do React (perdido no reload). O motivo do
--  cancelamento também fica salvo — a SEFAZ exige justificativa, vale ter
--  registrado o porquê.
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
--    9. migracao-08-nfe.sql
--   10. migracao-09-omie-ids.sql
--   11. migracao-10-cancelamento-nfe.sql (este)
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

alter table public.vendas add column if not exists nfe_spedy_id             text;
alter table public.vendas add column if not exists nfe_motivo_cancelamento  text;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> auth.sql
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


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-08-promotores.sql
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


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-11-cadastro-clientes.sql
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


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-12-cobranca.sql
-- ============================================================================
--  Migração 12 — conferência de cobrança
--
--  A aba Cobrança lista, todo dia, as vendas a prazo que venceram na véspera
--  para alguém confirmar se o cliente pagou. "Pagou" já cabia no status da
--  venda; "não pagou" não cabia — a venda continua pendente, e sem registro
--  a tela não saberia que aquela conta já foi conferida e virou cobrança.
--
--    cobranca_conferida_em   dia em que alguém conferiu o pagamento da venda
--                            vencida (pago ou não). Vazio = ninguém olhou.
--
--  ⚠️  Rode ANTES de usar a versão do app que traz a aba Cobrança. O app
--      passa a enviar essa coluna em toda gravação de venda; sem ela, o
--      Supabase recusa o envio e a alteração fica presa na fila de
--      Sincronização até a migração ser aplicada (aí ela sobe sozinha).
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

alter table public.vendas add column if not exists cobranca_conferida_em date;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-14-romaneio.sql
-- ============================================================================
--  Migração 14 — romaneio: rastreio da entrega do CD até a loja
--
--  A tabela `vendas` já vem do schema.sql. Este arquivo acrescenta o que falta
--  para acompanhar cada entrega: o veículo e o motorista escalados, o status
--  da entrega e os dois horários que o motorista registra escaneando o QR da
--  nota — uma vez ao sair do centro de distribuição, outra ao entregar na
--  loja. Não existe tabela nova: a venda já É a nota, e o QR carrega o mesmo
--  id que identifica o pedido em tudo mais.
--
--    status_entrega   pendente → em_rota → entregue, andando sozinho a cada
--                      escaneio (não é a mesma coisa que `status`, que é sobre
--                      o pagamento)
--    ordem_rota        posição da parada na rota daquele veículo naquele dia,
--                      editável na tela para o roteiro poder ser reordenado
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
--    5e. migracao-08-promotores.sql
--    5f. migracao-08-nfe.sql
--    5g. migracao-09-omie-ids.sql
--    5h. migracao-10-cancelamento-nfe.sql
--    5i. migracao-11-cadastro-clientes.sql
--    5j. migracao-12-cobranca.sql
--    5k. migracao-13-salario-funcionarios.sql
--    6. migracao-14-romaneio.sql (este)
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

alter table public.vendas add column if not exists veiculo_id    uuid references public.veiculos (id) on delete set null;
alter table public.vendas add column if not exists motorista_id  uuid references public.funcionarios (id) on delete set null;
alter table public.vendas add column if not exists status_entrega text;
alter table public.vendas add column if not exists saida_cd_em   timestamptz;
alter table public.vendas add column if not exists entregue_em   timestamptz;
alter table public.vendas add column if not exists ordem_rota    integer;

update public.vendas set status_entrega = 'pendente' where status_entrega is null;

alter table public.vendas alter column status_entrega set default 'pendente';
alter table public.vendas alter column status_entrega set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'vendas_status_entrega_check') then
    alter table public.vendas add constraint vendas_status_entrega_check
      check (status_entrega in ('pendente', 'em_rota', 'entregue'));
  end if;
end;
$$;

create index if not exists vendas_veiculo_idx         on public.vendas (veiculo_id);
create index if not exists vendas_status_entrega_idx   on public.vendas (data, veiculo_id, status_entrega);

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-13-salario-funcionarios.sql
-- ============================================================================
--  Migração 13 — salário no cadastro de diaristas e funcionários
--
--  `funcionarios.salario` guarda o combinado com cada pessoa: o salário do
--  mês para funcionário, o valor da diária para diarista. Vazio quando não
--  foi informado. O app usa o número para já preencher o valor ao registrar
--  um pagamento — quem lança ainda pode mudar antes de salvar.
--
--  ⚠️  Rode ANTES de usar a versão do app que traz o campo. O app passa a
--      enviar a coluna em toda gravação de funcionário; sem ela, o Supabase
--      recusa o envio e a alteração fica presa na fila de Sincronização até
--      a migração ser aplicada (aí ela sobe sozinha).
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

alter table public.funcionarios add column if not exists salario numeric(14,2);

alter table public.funcionarios drop constraint if exists funcionarios_salario_check;
alter table public.funcionarios add constraint funcionarios_salario_check check (salario is null or salario >= 0);

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-15-historico-folha.sql
-- ============================================================================
--  Migração 15 — histórico da folha e horas extras
--
--  1. Cada pagamento guarda uma cópia de quem recebeu (`funcionario_nome`,
--     `funcionario_tipo`). Ao remover uma pessoa do cadastro, o vínculo
--     `funcionario_id` vira null, mas o histórico por mês continua mostrando
--     o nome e quanto ela recebeu.
--  2. `extras` é a parte do pagamento que foi hora extra, e `horas_extras`
--     quantas horas foram. `valor` continua sendo o total pago (o que entra
--     no DRE); o salário é `valor - extras`.
--
--  Os pagamentos que já existem recebem o nome e o tipo do cadastro atual.
--  Os que já tinham perdido o vínculo antes desta migração não têm de onde
--  tirar o nome e ficam como "Pessoa removida".
--
--  ⚠️  Rode ANTES de usar a versão do app que traz o histórico. O app passa
--      a enviar essas colunas em todo pagamento; sem elas, o Supabase recusa
--      o envio e o lançamento fica preso na fila de Sincronização até a
--      migração ser aplicada (aí ele sobe sozinho).
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

alter table public.pagamentos add column if not exists funcionario_nome text;
alter table public.pagamentos add column if not exists funcionario_tipo text;
alter table public.pagamentos add column if not exists extras       numeric(14,2) not null default 0;
alter table public.pagamentos add column if not exists horas_extras numeric(8,2)  not null default 0;

alter table public.pagamentos drop constraint if exists pagamentos_extras_check;
alter table public.pagamentos add constraint pagamentos_extras_check check (extras >= 0 and extras <= valor);
alter table public.pagamentos drop constraint if exists pagamentos_horas_extras_check;
alter table public.pagamentos add constraint pagamentos_horas_extras_check check (horas_extras >= 0);

update public.pagamentos p
   set funcionario_nome = f.nome,
       funcionario_tipo = f.tipo
  from public.funcionarios f
 where f.id = p.funcionario_id
   and p.funcionario_nome is null;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-16-funcoes-usuarios.sql
-- ============================================================================
--  Migração 16 — função de cada pessoa da folha e o usuário dela
--
--    funcao       o que a pessoa faz: Gerente, Administrativo, Serviços
--                 Gerais ou Motorista. O romaneio oferece para a rota só
--                 quem é Motorista.
--    usuario_id   a conta de acesso ao sistema dessa pessoa (perfis.id),
--                 quando ela tem uma. Uma conta liga a uma pessoa só.
--                 Se a conta for apagada, o vínculo some e a pessoa fica.
--
--  Precisa rodar DEPOIS do auth.sql, que cria a tabela `perfis`.
--
--  ⚠️  Rode ANTES de usar a versão do app que traz os campos. O app passa a
--      enviar essas colunas em toda gravação de funcionário; sem elas, o
--      Supabase recusa o envio e a alteração fica presa na fila de
--      Sincronização até a migração ser aplicada (aí ela sobe sozinha).
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

alter table public.funcionarios add column if not exists funcao     text;
alter table public.funcionarios add column if not exists usuario_id uuid;

alter table public.funcionarios drop constraint if exists funcionarios_usuario_id_fkey;
alter table public.funcionarios add constraint funcionarios_usuario_id_fkey
  foreign key (usuario_id) references public.perfis (id) on delete set null;

create unique index if not exists funcionarios_usuario_unico
  on public.funcionarios (usuario_id) where usuario_id is not null;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-17-acesso-usuarios.sql
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


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-18-romaneio-prioridade.sql
-- ============================================================================
--  Migração 18 — romaneio: prioridade, retirada no CD e rota por dia de viagem
--
--  Três ajustes na aba Romaneio, pedidos depois de rodar em produção:
--
--    prioridade   marcado na tela ao montar a rota; pedido prioritário vai
--                 sempre pro topo da lista daquele veículo (posição fixa —
--                 as setas ▲▼ só reordenam dentro do mesmo grupo).
--    rota_data    o dia da VIAGEM, separado do dia do PEDIDO (`vendas.data`).
--                 Sem isso, um pedido de ontem que só saiu hoje não tinha
--                 como entrar na rota de hoje — a tela filtrava tudo pela
--                 data exata do pedido.
--    status_entrega ganha um 4º valor, 'retirado_cd': cliente que busca a
--                 mercadoria direto no centro de distribuição, sem precisar
--                 de veículo, motorista nem escaneio.
--
--  Como aplicar, NESTA ORDEM: depois de migracao-17-acesso-usuarios.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

alter table public.vendas add column if not exists prioridade boolean not null default false;
alter table public.vendas add column if not exists rota_data  date;

-- Pedidos já em rota (ou entregues) antes desta migração: a viagem deles é o
-- próprio dia do pedido, já que era a única data que a tela conhecia.
update public.vendas set rota_data = data where rota_data is null and veiculo_id is not null;

alter table public.vendas drop constraint if exists vendas_status_entrega_check;
alter table public.vendas add constraint vendas_status_entrega_check
  check (status_entrega in ('pendente', 'em_rota', 'entregue', 'retirado_cd'));

create index if not exists vendas_rota_data_idx on public.vendas (rota_data, veiculo_id);

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-09-promotores-prioridade.sql
-- ============================================================================
--  Migração 09 — prioridade nas paradas do promotor
--
--  Acrescenta a `paradas_rota` (criada em migracao-08-promotores.sql) a
--  marcação de quais lojas da rota são prioridade — o gestor sinaliza ao
--  montar a rota, e ela aparece destacada tanto no painel de acompanhamento
--  quanto (quando chegar a vez) na tela do promotor.
--
--  Como aplicar, NESTA ORDEM:
--    ... (schema.sql até auth.sql, como no README)
--    6b. migracao-08-promotores.sql
--    6c. migracao-09-promotores-prioridade.sql (este)
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

alter table public.paradas_rota
  add column if not exists prioridade boolean not null default false;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-19-motorista.sql
-- ============================================================================
--  Migração 19 — papel Motorista: as próprias entregas, e nada mais
--
--  O motorista entra no app e vê só a aba "Minhas Entregas": as paradas do
--  romaneio em que ele foi escalado, na ordem da rota, com o endereço da loja
--  (para abrir no Maps) e a câmera para ler o QR da nota.
--
--  Quem é o motorista: a conta dele (perfis) está ligada a uma pessoa da
--  folha (funcionarios.usuario_id, migracao-16), e o romaneio escala essa
--  pessoa em vendas.motorista_id.
--
--  Ele NÃO ganha leitura das tabelas do negócio — nem vendas, nem lojas. Tudo
--  passa por duas funções SECURITY DEFINER, que só devolvem e só mexem nas
--  entregas escaladas para ele:
--
--    minhas_entregas(dia)       paradas do dia: loja, endereço, ordem, status
--    registrar_escaneio(venda)  o mesmo escaneio do Romaneio —
--                               pendente → em_rota (saída do CD)
--                               em_rota  → entregue (entrega na loja)
--
--  O dia é o da VIAGEM (`rota_data`, da migracao-18-romaneio-prioridade),
--  não o do pedido; pedido prioritário vem primeiro, como no Romaneio.
--
--  Precisa rodar DEPOIS do auth.sql, da migracao-14, da migracao-16 e da
--  migracao-18-romaneio-prioridade.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

-- ─── Papel novo ─────────────────────────────────────────────────────────────

alter table public.perfis disable trigger user;
alter table public.perfis drop constraint if exists perfis_papel_check;
alter table public.perfis
  add constraint perfis_papel_check
  check (papel in ('socio_master', 'assistente_administrativo', 'promotor', 'motorista'));
alter table public.perfis enable trigger user;

-- ─── Paradas do motorista ───────────────────────────────────────────────────

-- O retorno mudou (entrou `prioridade`): o Postgres só troca as colunas de
-- uma função recriando-a.
drop function if exists public.minhas_entregas(date);

create or replace function public.minhas_entregas(dia date)
returns table (
  id              uuid,
  prioridade      boolean,
  numero          integer,
  ordem_rota      integer,
  status_entrega  text,
  saida_cd_em     timestamptz,
  entregue_em     timestamptz,
  loja            text,
  rede            text,
  logradouro      text,
  numero_endereco text,
  complemento     text,
  bairro          text,
  cidade          text,
  uf              text,
  cep             text,
  veiculo         text
)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, coalesce(v.prioridade, false), v.numero, v.ordem_rota, v.status_entrega, v.saida_cd_em, v.entregue_em,
         l.nome, r.nome,
         l.logradouro, l.numero, l.complemento, l.bairro, l.cidade, l.uf, l.cep,
         ve.nome
    from public.vendas v
    join public.funcionarios f on f.id = v.motorista_id
    left join public.lojas l     on l.id = v.loja_id
    left join public.redes r     on r.id = l.rede_id
    left join public.veiculos ve on ve.id = v.veiculo_id
   where f.usuario_id = auth.uid()
     and public.papel_atual() = 'motorista'
     and coalesce(v.rota_data, v.data) = dia
     and v.status <> 'cancelado'
   order by coalesce(v.prioridade, false) desc, v.ordem_rota nulls last, v.numero;
$$;

-- ─── Escaneio do QR ─────────────────────────────────────────────────────────

create or replace function public.registrar_escaneio(venda uuid)
returns table (status_entrega text, numero integer, loja text, momento timestamptz, mudou boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v record;
begin
  if public.papel_atual() is distinct from 'motorista' then
    raise exception 'Só o motorista registra escaneio por aqui.';
  end if;

  select vd.id, vd.numero, vd.status_entrega, vd.saida_cd_em, vd.entregue_em, l.nome as loja
    into v
    from public.vendas vd
    join public.funcionarios f on f.id = vd.motorista_id
    left join public.lojas l on l.id = vd.loja_id
   where vd.id = venda and f.usuario_id = auth.uid() and vd.status <> 'cancelado';

  if not found then
    raise exception 'Esta nota não está nas suas entregas.';
  end if;

  if v.status_entrega = 'pendente' then
    update public.vendas set status_entrega = 'em_rota', saida_cd_em = now() where id = v.id;
    return query select 'em_rota'::text, v.numero, v.loja, now(), true;
  elsif v.status_entrega = 'em_rota' then
    update public.vendas set status_entrega = 'entregue', entregue_em = now() where id = v.id;
    return query select 'entregue'::text, v.numero, v.loja, now(), true;
  else
    return query select v.status_entrega, v.numero, v.loja, v.entregue_em, false;
  end if;
end;
$$;

revoke all on function public.minhas_entregas(date)     from public, anon;
revoke all on function public.registrar_escaneio(uuid)  from public, anon;
grant execute on function public.minhas_entregas(date)    to authenticated;
grant execute on function public.registrar_escaneio(uuid) to authenticated;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-20-notificacao-pedidos.sql
-- ============================================================================
--  Migração 20 — aviso no celular a cada pedido novo (ntfy)
--
--  Toda venda que entra na tabela `vendas` pelo app dispara uma notificação
--  no celular, pelo app gratuito ntfy (https://ntfy.sh — Android e iPhone):
--
--      Novo pedido nº 1234
--      PETROX — BARRA
--      R$ 1.234,56 · 120 kg
--      Lançado por Fulano
--
--  Por que no banco, e não no app: o pedido pode ser criado offline e só
--  subir horas depois pela fila de Sincronização. O banco é o único lugar
--  que vê TODO pedido novo, venha do aparelho que vier.
--
--  Como funciona: um gatilho AFTER INSERT em `vendas` chama o ntfy pela
--  extensão pg_net. A chamada é assíncrona — não atrasa a gravação da venda —
--  e qualquer erro nela é engolido: o aviso nunca impede um pedido de entrar.
--
--  Só avisa o que chega pela API do app (quem usa a chave do Supabase). O
--  que é rodado no SQL Editor — importacao-planilha.sql, seed, históricos —
--  NÃO avisa: senão reimportar a planilha mandaria centenas de notificações.
--  Venda editada também não avisa: a sincronização grava com upsert, e o
--  gatilho é só de INSERT, então alterar um pedido que já existe fica quieto.
--
--  ─── Como ligar ────────────────────────────────────────────────────────────
--
--  1. Instale o app "ntfy" no celular.
--  2. Invente um nome de tópico difícil de adivinhar — é ele que protege os
--     avisos: quem souber o nome também recebe. Ex.: carvalhocruz-pedidos-x7k2q9
--  3. No app ntfy toque em "+" (Inscrever-se), digite o tópico e confirme.
--     Pode inscrever quantos celulares quiser no mesmo tópico.
--  4. Rode este arquivo no SQL Editor do Supabase.
--  5. Grave o tópico (e, se quiser, o endereço do app — tocar no aviso abre
--     o app nas Vendas):
--
--       update privado.notificacao_pedidos
--          set topico  = 'carvalhocruz-pedidos-x7k2q9',
--              url_app = 'https://seu-app.vercel.app/'
--        where id = 1;
--
--  Para testar sem lançar pedido, rode no SQL Editor:
--
--       select privado.enviar_ntfy('Teste', 'Se chegou, está funcionando.');
--
--  Para desligar: update privado.notificacao_pedidos set ativo = false where id = 1;
--
--  O tópico fica no schema `privado`, que a API do Supabase não expõe: nem a
--  chave anon nem usuário logado conseguem lê-lo — só o SQL Editor.
--
--  Idempotente: pode rodar de novo sem quebrar nada nem apagar o tópico.
-- ============================================================================

begin;

create extension if not exists pg_net;

create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;

-- ─── Configuração (uma linha só) ────────────────────────────────────────────

create table if not exists privado.notificacao_pedidos (
  id        integer primary key default 1 check (id = 1),
  ativo     boolean not null default true,
  servidor  text    not null default 'https://ntfy.sh',
  topico    text,
  url_app   text
);

insert into privado.notificacao_pedidos (id) values (1) on conflict (id) do nothing;

-- RLS ligado e sem política: ninguém pela API lê a linha. As funções abaixo
-- são SECURITY DEFINER do dono da tabela, que passa por cima do RLS.
alter table privado.notificacao_pedidos enable row level security;
revoke all on privado.notificacao_pedidos from public, anon, authenticated;

-- ─── Envio ──────────────────────────────────────────────────────────────────
--
-- Publica pelo formato JSON do ntfy (POST na raiz do servidor, com o tópico
-- no corpo) — assim título e texto com acento vão sem mexer em cabeçalho.

create or replace function privado.enviar_ntfy(titulo text, mensagem text, clique text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg privado.notificacao_pedidos;
  corpo jsonb;
begin
  select * into cfg from privado.notificacao_pedidos where id = 1;
  if cfg is null or not cfg.ativo or coalesce(trim(cfg.topico), '') = '' then
    return;
  end if;

  corpo := jsonb_build_object(
    'topic',   trim(cfg.topico),
    'title',   titulo,
    'message', mensagem,
    'tags',    jsonb_build_array('package')
  );
  if coalesce(clique, cfg.url_app) is not null then
    corpo := corpo || jsonb_build_object('click', coalesce(clique, cfg.url_app));
  end if;

  perform net.http_post(
    url     := rtrim(cfg.servidor, '/') || '/',
    body    := corpo,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
end;
$$;

revoke all on function privado.enviar_ntfy(text, text, text) from public, anon, authenticated;

-- ─── Gatilho em vendas ──────────────────────────────────────────────────────

create or replace function privado.avisar_pedido_novo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cliente  text;
  quem     text;
  valor    text;
  texto    text;
  -- Pedido feito pelo próprio cliente no link (migracao-21). Lido via jsonb
  -- para este gatilho funcionar mesmo antes de a coluna `origem` existir.
  do_link  boolean := (to_jsonb(new) ->> 'origem') = 'cliente';
  -- Quem pediu no link (migracao-29); vazio antes de a coluna existir.
  pediu    text := nullif(trim(to_jsonb(new) ->> 'pedido_por'), '');
begin
  -- Só o que vem pela API do app: no SQL Editor não há JWT da requisição.
  if coalesce(current_setting('request.jwt.claims', true), '') = '' then
    return new;
  end if;

  begin
    select r.nome || ' — ' || l.nome
      into cliente
      from public.lojas l
      join public.redes r on r.id = l.rede_id
     where l.id = new.loja_id;

    -- perfis só existe depois do auth.sql; sem login, fica sem o "lançado por".
    if auth.uid() is not null and to_regclass('public.perfis') is not null then
      execute 'select nullif(trim(nome), '''') from public.perfis where id = $1'
         into quem using auth.uid();
    end if;

    -- 1234.5 → "1.234,50" (sem depender do locale do servidor)
    valor := translate(to_char(coalesce(new.total, 0), 'FM999,999,990.00'), ',.', '.,');

    texto := coalesce(cliente, 'Cliente não informado')
          || E'\nR$ ' || valor
          || case when coalesce(new.kg_total, 0) > 0
                  then ' · ' || translate(rtrim(to_char(new.kg_total, 'FM999,999,990.999'), '.'), ',.', '.,') || ' kg'
                  else '' end
          || case when new.status = 'cancelado' then E'\n(lançado como cancelado)' else '' end
          || case when do_link then E'\nFeito pelo cliente no link' || coalesce(' por ' || pediu, '') || ' — conferir preço'
                  when quem is not null then E'\nLançado por ' || quem else '' end;

    perform privado.enviar_ntfy(
      case when do_link then 'Pedido do cliente' else 'Novo pedido' end || coalesce(' nº ' || new.numero, ''),
      texto
    );
  exception when others then
    -- O aviso nunca pode impedir o pedido de ser gravado.
    raise warning 'aviso de pedido novo falhou: %', sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function privado.avisar_pedido_novo() from public, anon, authenticated;

drop trigger if exists vendas_avisar_pedido_novo on public.vendas;
create trigger vendas_avisar_pedido_novo
  after insert on public.vendas
  for each row execute function privado.avisar_pedido_novo();

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-21-pedido-cliente.sql
-- ============================================================================
--  Migração 21 — link de pedido para o cliente
--
--  Cada loja ganha um link próprio, que a distribuidora manda pelo WhatsApp:
--
--      https://seu-app.vercel.app/pedido/3f9c1a…
--
--  O cliente abre no celular, SEM login, vê os produtos, põe as quantidades e
--  envia. O pedido cai direto na tabela `vendas` — aparece na aba Vendas do
--  app, marcado como "Pedido do cliente", aguardando conferência.
--
--  Preço: o cliente NÃO vê nem digita preço (cada rede negocia o seu). O
--  pedido já entra com o preço da última venda daquele produto para a mesma
--  loja — ou, na falta, para outra loja da mesma rede. Sem histórico, entra
--  com preço zero. Em qualquer caso, quem confere na aba Vendas ajusta e
--  confirma; só então o pedido deixa de estar "aguardando conferência".
--
--  Segurança: o cliente não ganha acesso a nenhuma tabela. Ele fala só com
--  duas funções SECURITY DEFINER, e só com o token da própria loja:
--
--    pedido_cliente_abrir(token)                   loja, produtos e o último pedido
--    pedido_cliente_enviar(token, itens, obs)      grava o pedido
--
--  O token é longo e aleatório — quem não tem o link não adivinha. Se um link
--  vazar, "Gerar novo link" na ficha da loja (função renovar_link_pedido)
--  troca o token, e o link antigo para de funcionar na hora.
--
--  Loja inativa não recebe pedido pelo link. E há um freio contra abuso: no
--  máximo 10 pedidos pelo link por loja por hora.
--
--  Se a migração 20 (aviso no ntfy) estiver ligada, o pedido do cliente
--  também avisa no celular — rode o migracao-20 de novo depois deste arquivo
--  para o aviso dizer que o pedido veio do cliente.
--
--  Rode ANTES de publicar a versão do app que traz o link: sem as colunas
--  novas em `vendas`, as gravações de venda ficam presas na fila de
--  Sincronização. Depois do auth.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

-- ─── Token da loja ──────────────────────────────────────────────────────────
--
-- 24 caracteres hexadecimais tirados de um uuid aleatório (gen_random_uuid é
-- nativo do Postgres 13+, não depende do pgcrypto).

create or replace function public.novo_token_pedido()
returns text
language sql
volatile
as $$
  select left(replace(gen_random_uuid()::text, '-', ''), 12)
      || left(replace(gen_random_uuid()::text, '-', ''), 12);
$$;

alter table public.lojas add column if not exists token_pedido text;
update public.lojas set token_pedido = public.novo_token_pedido() where token_pedido is null;
alter table public.lojas alter column token_pedido set default public.novo_token_pedido();
alter table public.lojas alter column token_pedido set not null;
create unique index if not exists lojas_token_pedido_idx on public.lojas (token_pedido);

-- ─── Vendas: de onde veio o pedido ──────────────────────────────────────────
--
--   origem                  'app' (lançado pela equipe) ou 'cliente' (pelo link)
--   observacao              o recado que o cliente escreveu junto do pedido
--   aguardando_conferencia  pedido do link que ninguém conferiu ainda

alter table public.vendas add column if not exists origem text not null default 'app';
alter table public.vendas add column if not exists observacao text;
alter table public.vendas add column if not exists aguardando_conferencia boolean not null default false;

alter table public.vendas drop constraint if exists vendas_origem_check;
alter table public.vendas add constraint vendas_origem_check check (origem in ('app', 'cliente'));

create index if not exists vendas_aguardando_conferencia_idx
  on public.vendas (criado_em) where aguardando_conferencia;

-- Produtos que aparecem no link de cada cliente (migracao-23). Criadas aqui
-- também para as funções abaixo valerem rodando a 21 sozinha ou de novo.
alter table public.redes add column if not exists produtos_pedido uuid[];
alter table public.lojas add column if not exists produtos_pedido uuid[];

-- ─── Abrir o link ───────────────────────────────────────────────────────────

create or replace function public.pedido_cliente_abrir(token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l record;
  produtos jsonb;
  ultimo jsonb;
begin
  select lj.id, lj.nome, r.nome as rede, r.id as rede_id,
         coalesce(lj.produtos_pedido, r.produtos_pedido) as permitidos
    into l
    from public.lojas lj
    join public.redes r on r.id = lj.rede_id
   where lj.token_pedido = pedido_cliente_abrir.token
     and lj.status = 'ativo';

  if not found then
    raise exception 'Link de pedido inválido ou desativado.' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id,
           'nome', p.nome,
           'fruta', p.fruta,
           'unidadeVenda', p.unidade_venda,
           'kgPorUnidade', p.kg_por_unidade
         ) order by p.fruta, p.nome), '[]'::jsonb)
    into produtos
    from public.produtos p
   where l.permitidos is null or p.id = any (l.permitidos);

  -- O último pedido da loja (só as quantidades), para o botão "Repetir".
  select jsonb_build_object(
           'data', v.data,
           'itens', coalesce((
             select jsonb_agg(jsonb_build_object('produtoId', i ->> 'produtoId', 'qty', (i ->> 'qty')::numeric))
               from jsonb_array_elements(v.itens) i
              where coalesce(i ->> 'natureza', 'venda') = 'venda'
                and coalesce(i ->> 'unidade', '') <> 'un'
                and (l.permitidos is null or (i ->> 'produtoId') = any (l.permitidos::text[]))
           ), '[]'::jsonb))
    into ultimo
    from public.vendas v
   where v.loja_id = l.id and v.status <> 'cancelado'
   order by v.data desc, v.criado_em desc
   limit 1;

  return jsonb_build_object(
    'loja', l.nome,
    'rede', l.rede,
    'produtos', produtos,
    'ultimoPedido', ultimo
  );
end;
$$;

-- ─── Enviar o pedido ────────────────────────────────────────────────────────
--
-- `itens` chega como [{ "produtoId": "…", "qty": 10 }, …]. Tudo o mais — kg,
-- preço, prazo, número do pedido — é calculado aqui, nunca confiado ao
-- navegador do cliente.

create or replace function public.pedido_cliente_enviar(token text, itens jsonb, observacao text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l record;
  item jsonb;
  p record;
  qty numeric;
  preco numeric;
  lista jsonb := '[]'::jsonb;
  total numeric := 0;
  kg_total numeric := 0;
  prazo integer;
  proximo integer;
  hoje date := (now() at time zone 'America/Maceio')::date;
  nova uuid := gen_random_uuid();
begin
  select lj.id, lj.rede_id, coalesce(lj.produtos_pedido, r.produtos_pedido) as permitidos
    into l
    from public.lojas lj
    join public.redes r on r.id = lj.rede_id
   where lj.token_pedido = pedido_cliente_enviar.token
     and lj.status = 'ativo';

  if not found then
    raise exception 'Link de pedido inválido ou desativado.' using errcode = 'P0002';
  end if;

  if jsonb_typeof(itens) is distinct from 'array' or jsonb_array_length(itens) = 0 then
    raise exception 'O pedido está vazio.';
  end if;
  if jsonb_array_length(itens) > 50 then
    raise exception 'Itens demais num pedido só.';
  end if;

  if (select count(*) from public.vendas v
       where v.loja_id = l.id and v.origem = 'cliente'
         and v.criado_em > now() - interval '1 hour') >= 10 then
    raise exception 'Muitos pedidos em pouco tempo. Aguarde um pouco ou fale com a distribuidora.';
  end if;

  for item in select * from jsonb_array_elements(itens) loop
    begin
      qty := round((item ->> 'qty')::numeric, 2);
    exception when others then
      raise exception 'Quantidade inválida.';
    end;
    if qty is null or qty <= 0 then
      continue;
    end if;
    if qty > 100000 then
      raise exception 'Quantidade grande demais.';
    end if;

    select pr.id, pr.unidade_venda, pr.kg_por_unidade
      into p
      from public.produtos pr
     where pr.id::text = item ->> 'produtoId'
       and (l.permitidos is null or pr.id = any (l.permitidos));
    if not found then
      raise exception 'Produto não encontrado — recarregue a página.';
    end if;
    if lista @> jsonb_build_array(jsonb_build_object('produtoId', p.id)) then
      raise exception 'Produto repetido no pedido.';
    end if;

    -- Preço da última venda deste produto para a loja; senão, para a rede.
    select (i ->> 'precoUnitario')::numeric
      into preco
      from public.vendas v
      join public.lojas lj on lj.id = v.loja_id
      cross join lateral jsonb_array_elements(v.itens) i
     where lj.rede_id = l.rede_id
       and v.status <> 'cancelado'
       and i ->> 'produtoId' = p.id::text
       and coalesce(i ->> 'natureza', 'venda') = 'venda'
       and coalesce(i ->> 'unidade', '') <> 'un'
       and (i ->> 'precoUnitario')::numeric > 0
     order by (v.loja_id = l.id) desc, v.data desc, v.criado_em desc
     limit 1;
    preco := coalesce(preco, 0);

    lista := lista || jsonb_build_array(jsonb_build_object(
      'produtoId', p.id,
      'qty', qty,
      'precoUnitario', preco,
      'kgPorUnidade', p.kg_por_unidade,
      'kgTotal', round(qty * p.kg_por_unidade, 3),
      'natureza', 'venda'
    ));
    total := total + round(qty * preco, 2);
    kg_total := kg_total + round(qty * p.kg_por_unidade, 3);
  end loop;

  if jsonb_array_length(lista) = 0 then
    raise exception 'O pedido está vazio.';
  end if;

  -- O prazo de sempre desta loja; loja nova começa com 30 dias, como no app.
  select v.prazo_dias into prazo
    from public.vendas v
   where v.loja_id = l.id and v.status <> 'cancelado'
   order by v.data desc, v.criado_em desc
   limit 1;
  prazo := coalesce(prazo, 30);

  -- Dois clientes enviando no mesmo instante não pegam o mesmo número.
  perform pg_advisory_xact_lock(hashtext('vendas.numero'));
  select coalesce(max(v.numero), 0) + 1 into proximo from public.vendas v;

  insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status,
                             origem, observacao, aguardando_conferencia)
  values (nova, proximo, l.id, hoje, prazo, lista, total, kg_total, 'pendente',
          'cliente', nullif(left(trim(coalesce(observacao, '')), 500), ''), true);

  return jsonb_build_object('id', nova, 'numero', proximo);
end;
$$;

-- ─── Gerar novo link (equipe) ───────────────────────────────────────────────

create or replace function public.renovar_link_pedido(loja uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  novo text := public.novo_token_pedido();
begin
  if not public.e_gestor() then
    raise exception 'Só sócio master ou assistente geram link novo.';
  end if;
  update public.lojas set token_pedido = novo where id = loja;
  if not found then
    raise exception 'Loja não encontrada.';
  end if;
  return novo;
end;
$$;

revoke all on function public.pedido_cliente_abrir(text)                from public;
revoke all on function public.pedido_cliente_enviar(text, jsonb, text)  from public;
revoke all on function public.renovar_link_pedido(uuid)                 from public, anon;
grant execute on function public.pedido_cliente_abrir(text)               to anon, authenticated;
grant execute on function public.pedido_cliente_enviar(text, jsonb, text) to anon, authenticated;
grant execute on function public.renovar_link_pedido(uuid)                to authenticated;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-22-geolocalizacao-lojas.sql
-- ============================================================================
--  Migração 22 — geolocalização da loja: latitude e longitude
--
--  O romaneio ordena as paradas pela distância em linha reta até o CD, e
--  desenha um mapa da rota — pra isso precisa saber onde cada loja fica.
--  A coordenada é geocodificada uma vez a partir do endereço (Nominatim,
--  OpenStreetMap — gratuito) e guardada aqui pra não pedir de novo toda hora.
--
--  Como aplicar, NESTA ORDEM: depois de migracao-21-pedido-cliente.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

alter table public.lojas add column if not exists lat double precision;
alter table public.lojas add column if not exists lng double precision;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-23-produtos-por-cliente.sql
-- ============================================================================
--  Migração 23 — quais produtos aparecem no link de pedido de cada cliente
--
--  Nem todo cliente compra tudo: a PETROX, por exemplo, não recebe oferta de
--  abóbora. No cadastro da REDE escolhe-se os produtos que aparecem no link
--  de pedido de todas as lojas dela; uma LOJA pode ter a própria lista, que
--  então vale no lugar da da rede.
--
--    redes.produtos_pedido   null = todos os produtos
--    lojas.produtos_pedido   null = os mesmos da rede
--
--  As duas funções do link (migracao-21) passam a respeitar a lista: o
--  produto fora dela não aparece na página e é recusado se vier no pedido.
--  O "Repetir o último pedido" também só traz o que está liberado.
--
--  Só o link do cliente muda — o lançamento de venda pela equipe continua
--  oferecendo todos os produtos.
--
--  Rode ANTES de publicar a versão do app que traz a escolha: sem as colunas,
--  as gravações de rede e loja ficam presas na fila de Sincronização. Depois
--  da migracao-21.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

alter table public.redes add column if not exists produtos_pedido uuid[];
alter table public.lojas add column if not exists produtos_pedido uuid[];

-- ─── Abrir o link ───────────────────────────────────────────────────────────

create or replace function public.pedido_cliente_abrir(token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l record;
  produtos jsonb;
  ultimo jsonb;
begin
  select lj.id, lj.nome, r.nome as rede, r.id as rede_id,
         coalesce(lj.produtos_pedido, r.produtos_pedido) as permitidos
    into l
    from public.lojas lj
    join public.redes r on r.id = lj.rede_id
   where lj.token_pedido = pedido_cliente_abrir.token
     and lj.status = 'ativo';

  if not found then
    raise exception 'Link de pedido inválido ou desativado.' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id,
           'nome', p.nome,
           'fruta', p.fruta,
           'unidadeVenda', p.unidade_venda,
           'kgPorUnidade', p.kg_por_unidade
         ) order by p.fruta, p.nome), '[]'::jsonb)
    into produtos
    from public.produtos p
   where l.permitidos is null or p.id = any (l.permitidos);

  -- O último pedido da loja (só as quantidades), para o botão "Repetir".
  select jsonb_build_object(
           'data', v.data,
           'itens', coalesce((
             select jsonb_agg(jsonb_build_object('produtoId', i ->> 'produtoId', 'qty', (i ->> 'qty')::numeric))
               from jsonb_array_elements(v.itens) i
              where coalesce(i ->> 'natureza', 'venda') = 'venda'
                and coalesce(i ->> 'unidade', '') <> 'un'
                and (l.permitidos is null or (i ->> 'produtoId') = any (l.permitidos::text[]))
           ), '[]'::jsonb))
    into ultimo
    from public.vendas v
   where v.loja_id = l.id and v.status <> 'cancelado'
   order by v.data desc, v.criado_em desc
   limit 1;

  return jsonb_build_object(
    'loja', l.nome,
    'rede', l.rede,
    'produtos', produtos,
    'ultimoPedido', ultimo
  );
end;
$$;

-- ─── Enviar o pedido ────────────────────────────────────────────────────────
--
-- `itens` chega como [{ "produtoId": "…", "qty": 10 }, …]. Tudo o mais — kg,
-- preço, prazo, número do pedido — é calculado aqui, nunca confiado ao
-- navegador do cliente.

create or replace function public.pedido_cliente_enviar(token text, itens jsonb, observacao text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  l record;
  item jsonb;
  p record;
  qty numeric;
  preco numeric;
  lista jsonb := '[]'::jsonb;
  total numeric := 0;
  kg_total numeric := 0;
  prazo integer;
  proximo integer;
  hoje date := (now() at time zone 'America/Maceio')::date;
  nova uuid := gen_random_uuid();
begin
  select lj.id, lj.rede_id, coalesce(lj.produtos_pedido, r.produtos_pedido) as permitidos
    into l
    from public.lojas lj
    join public.redes r on r.id = lj.rede_id
   where lj.token_pedido = pedido_cliente_enviar.token
     and lj.status = 'ativo';

  if not found then
    raise exception 'Link de pedido inválido ou desativado.' using errcode = 'P0002';
  end if;

  if jsonb_typeof(itens) is distinct from 'array' or jsonb_array_length(itens) = 0 then
    raise exception 'O pedido está vazio.';
  end if;
  if jsonb_array_length(itens) > 50 then
    raise exception 'Itens demais num pedido só.';
  end if;

  if (select count(*) from public.vendas v
       where v.loja_id = l.id and v.origem = 'cliente'
         and v.criado_em > now() - interval '1 hour') >= 10 then
    raise exception 'Muitos pedidos em pouco tempo. Aguarde um pouco ou fale com a distribuidora.';
  end if;

  for item in select * from jsonb_array_elements(itens) loop
    begin
      qty := round((item ->> 'qty')::numeric, 2);
    exception when others then
      raise exception 'Quantidade inválida.';
    end;
    if qty is null or qty <= 0 then
      continue;
    end if;
    if qty > 100000 then
      raise exception 'Quantidade grande demais.';
    end if;

    select pr.id, pr.unidade_venda, pr.kg_por_unidade
      into p
      from public.produtos pr
     where pr.id::text = item ->> 'produtoId'
       and (l.permitidos is null or pr.id = any (l.permitidos));
    if not found then
      raise exception 'Produto não encontrado — recarregue a página.';
    end if;
    if lista @> jsonb_build_array(jsonb_build_object('produtoId', p.id)) then
      raise exception 'Produto repetido no pedido.';
    end if;

    -- Preço da última venda deste produto para a loja; senão, para a rede.
    select (i ->> 'precoUnitario')::numeric
      into preco
      from public.vendas v
      join public.lojas lj on lj.id = v.loja_id
      cross join lateral jsonb_array_elements(v.itens) i
     where lj.rede_id = l.rede_id
       and v.status <> 'cancelado'
       and i ->> 'produtoId' = p.id::text
       and coalesce(i ->> 'natureza', 'venda') = 'venda'
       and coalesce(i ->> 'unidade', '') <> 'un'
       and (i ->> 'precoUnitario')::numeric > 0
     order by (v.loja_id = l.id) desc, v.data desc, v.criado_em desc
     limit 1;
    preco := coalesce(preco, 0);

    lista := lista || jsonb_build_array(jsonb_build_object(
      'produtoId', p.id,
      'qty', qty,
      'precoUnitario', preco,
      'kgPorUnidade', p.kg_por_unidade,
      'kgTotal', round(qty * p.kg_por_unidade, 3),
      'natureza', 'venda'
    ));
    total := total + round(qty * preco, 2);
    kg_total := kg_total + round(qty * p.kg_por_unidade, 3);
  end loop;

  if jsonb_array_length(lista) = 0 then
    raise exception 'O pedido está vazio.';
  end if;

  -- O prazo de sempre desta loja; loja nova começa com 30 dias, como no app.
  select v.prazo_dias into prazo
    from public.vendas v
   where v.loja_id = l.id and v.status <> 'cancelado'
   order by v.data desc, v.criado_em desc
   limit 1;
  prazo := coalesce(prazo, 30);

  -- Dois clientes enviando no mesmo instante não pegam o mesmo número.
  perform pg_advisory_xact_lock(hashtext('vendas.numero'));
  select coalesce(max(v.numero), 0) + 1 into proximo from public.vendas v;

  insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status,
                             origem, observacao, aguardando_conferencia)
  values (nova, proximo, l.id, hoje, prazo, lista, total, kg_total, 'pendente',
          'cliente', nullif(left(trim(coalesce(observacao, '')), 500), ''), true);

  return jsonb_build_object('id', nova, 'numero', proximo);
end;
$$;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-24-senha-usuarios.sql
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


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-25-notas-entrada.sql
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


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-26-pedido-rede.sql
-- ============================================================================
--  Migração 26 — link de pedido da REDE (várias lojas no mesmo link)
--
--  Além do link de cada loja (migração 21), cada rede ganha um link próprio,
--  para mandar no grupo de WhatsApp com os gerentes das lojas:
--
--      https://seu-app.vercel.app/pedido/rede/7b2e0c…
--
--  Quem abre vê todas as lojas ativas da rede, põe as quantidades de uma ou
--  de várias (Petrox Praia, Petrox Aruana…) e envia tudo de uma vez. Na aba
--  Vendas, cada loja vira um pedido SEPARADO, com número próprio — igual a
--  um pedido feito pelo link da loja: "Pedido do cliente", aguardando
--  conferência, com o preço da última venda e o prazo de sempre.
--
--  Segurança: o mesmo modelo da 21 — nenhuma tabela aberta, só duas funções
--  SECURITY DEFINER que exigem o token da rede, e só gravam para lojas ATIVAS
--  daquela rede. O link da rede é independente do link de cada loja: gerar um
--  novo para a rede não derruba o das lojas, e vice-versa.
--
--  Freio contra abuso: os 10 pedidos por loja por hora da 21 valem aqui
--  também, e o link da rede aceita no máximo 60 pedidos por hora no total.
--
--  Produtos: cada loja vê e pode pedir só o que a migração 23 libera para ela
--  (a lista da loja, ou a da rede, ou todos) — no link da rede também.
--
--  O envio é tudo ou nada: se o pedido de uma loja tiver erro, nenhum grava —
--  o cliente corrige e envia de novo, sem pedido pela metade.
--
--  Depois da migracao-21 e da migracao-23. Idempotente. Nada é apagado.
-- ============================================================================

begin;

-- ─── Token da rede ──────────────────────────────────────────────────────────

alter table public.redes add column if not exists token_pedido text;
update public.redes set token_pedido = public.novo_token_pedido() where token_pedido is null;
alter table public.redes alter column token_pedido set default public.novo_token_pedido();
alter table public.redes alter column token_pedido set not null;
create unique index if not exists redes_token_pedido_idx on public.redes (token_pedido);

-- ─── Peças comuns aos dois links ────────────────────────────────────────────
--
-- Internas: não são liberadas para ninguém. Rodam dentro das funções públicas
-- (SECURITY DEFINER), que já conferiram o token.

-- Os produtos liberados para a loja no link (migração 23): a lista da loja,
-- senão a da rede; null = todos.
create or replace function public.pedido_cliente_permitidos(loja uuid)
returns uuid[]
language sql
stable
set search_path = public
as $$
  select coalesce(lj.produtos_pedido, r.produtos_pedido)
    from public.lojas lj
    join public.redes r on r.id = lj.rede_id
   where lj.id = pedido_cliente_permitidos.loja;
$$;

-- O último pedido da loja (só as quantidades, só o liberado), para o "Repetir".
create or replace function public.pedido_cliente_ultimo(loja uuid, permitidos uuid[])
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
           'data', v.data,
           'itens', coalesce((
             select jsonb_agg(jsonb_build_object('produtoId', i ->> 'produtoId', 'qty', (i ->> 'qty')::numeric))
               from jsonb_array_elements(v.itens) i
              where coalesce(i ->> 'natureza', 'venda') = 'venda'
                and coalesce(i ->> 'unidade', '') <> 'un'
                and (permitidos is null or (i ->> 'produtoId') = any (permitidos::text[]))
           ), '[]'::jsonb))
    from public.vendas v
   where v.loja_id = pedido_cliente_ultimo.loja and v.status <> 'cancelado'
   order by v.data desc, v.criado_em desc
   limit 1;
$$;

-- Os produtos que o cliente pode pedir (null = todos).
create or replace function public.pedido_cliente_produtos(permitidos uuid[])
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id,
           'nome', p.nome,
           'fruta', p.fruta,
           'unidadeVenda', p.unidade_venda,
           'kgPorUnidade', p.kg_por_unidade
         ) order by p.fruta, p.nome), '[]'::jsonb)
    from public.produtos p
   where permitidos is null or p.id = any (permitidos);
$$;

-- Grava o pedido de UMA loja (já conferida pelo chamador). `itens` chega como
-- [{ "produtoId": "…", "qty": 10 }, …]; kg, preço, prazo e número são
-- calculados aqui, nunca confiados ao navegador do cliente.
create or replace function public.pedido_cliente_gravar(loja uuid, itens jsonb, observacao text)
returns jsonb
language plpgsql
volatile
set search_path = public
as $$
declare
  l record;
  item jsonb;
  p record;
  qty numeric;
  preco numeric;
  lista jsonb := '[]'::jsonb;
  total numeric := 0;
  kg_total numeric := 0;
  prazo integer;
  proximo integer;
  hoje date := (now() at time zone 'America/Maceio')::date;
  nova uuid := gen_random_uuid();
  permitidos uuid[] := public.pedido_cliente_permitidos(pedido_cliente_gravar.loja);
begin
  select lj.id, lj.rede_id, lj.nome into l
    from public.lojas lj
   where lj.id = pedido_cliente_gravar.loja;

  if jsonb_typeof(itens) is distinct from 'array' or jsonb_array_length(itens) = 0 then
    raise exception 'O pedido da loja % está vazio.', l.nome;
  end if;
  if jsonb_array_length(itens) > 50 then
    raise exception 'Itens demais num pedido só.';
  end if;

  if (select count(*) from public.vendas v
       where v.loja_id = l.id and v.origem = 'cliente'
         and v.criado_em > now() - interval '1 hour') >= 10 then
    raise exception 'Muitos pedidos em pouco tempo para a loja %. Aguarde um pouco ou fale com a distribuidora.', l.nome;
  end if;

  for item in select * from jsonb_array_elements(itens) loop
    begin
      qty := round((item ->> 'qty')::numeric, 2);
    exception when others then
      raise exception 'Quantidade inválida.';
    end;
    if qty is null or qty <= 0 then
      continue;
    end if;
    if qty > 100000 then
      raise exception 'Quantidade grande demais.';
    end if;

    select pr.id, pr.unidade_venda, pr.kg_por_unidade
      into p
      from public.produtos pr
     where pr.id::text = item ->> 'produtoId'
       and (permitidos is null or pr.id = any (permitidos));
    if not found then
      raise exception 'Produto não encontrado — recarregue a página.';
    end if;
    if lista @> jsonb_build_array(jsonb_build_object('produtoId', p.id)) then
      raise exception 'Produto repetido no pedido.';
    end if;

    -- Preço da última venda deste produto para a loja; senão, para a rede.
    select (i ->> 'precoUnitario')::numeric
      into preco
      from public.vendas v
      join public.lojas lj on lj.id = v.loja_id
      cross join lateral jsonb_array_elements(v.itens) i
     where lj.rede_id = l.rede_id
       and v.status <> 'cancelado'
       and i ->> 'produtoId' = p.id::text
       and coalesce(i ->> 'natureza', 'venda') = 'venda'
       and coalesce(i ->> 'unidade', '') <> 'un'
       and (i ->> 'precoUnitario')::numeric > 0
     order by (v.loja_id = l.id) desc, v.data desc, v.criado_em desc
     limit 1;
    preco := coalesce(preco, 0);

    lista := lista || jsonb_build_array(jsonb_build_object(
      'produtoId', p.id,
      'qty', qty,
      'precoUnitario', preco,
      'kgPorUnidade', p.kg_por_unidade,
      'kgTotal', round(qty * p.kg_por_unidade, 3),
      'natureza', 'venda'
    ));
    total := total + round(qty * preco, 2);
    kg_total := kg_total + round(qty * p.kg_por_unidade, 3);
  end loop;

  if jsonb_array_length(lista) = 0 then
    raise exception 'O pedido da loja % está vazio.', l.nome;
  end if;

  -- O prazo de sempre desta loja; loja nova começa com 30 dias, como no app.
  select v.prazo_dias into prazo
    from public.vendas v
   where v.loja_id = l.id and v.status <> 'cancelado'
   order by v.data desc, v.criado_em desc
   limit 1;
  prazo := coalesce(prazo, 30);

  -- Dois clientes enviando no mesmo instante não pegam o mesmo número.
  perform pg_advisory_xact_lock(hashtext('vendas.numero'));
  select coalesce(max(v.numero), 0) + 1 into proximo from public.vendas v;

  insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status,
                             origem, observacao, aguardando_conferencia)
  values (nova, proximo, l.id, hoje, prazo, lista, total, kg_total, 'pendente',
          'cliente', nullif(left(trim(coalesce(observacao, '')), 500), ''), true);

  return jsonb_build_object('id', nova, 'numero', proximo, 'lojaId', l.id, 'loja', l.nome);
end;
$$;

-- ─── Link da loja: agora usa as peças comuns (mesmo comportamento da 21) ────

create or replace function public.pedido_cliente_abrir(token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  l record;
  permitidos uuid[];
begin
  select lj.id, lj.nome, r.nome as rede
    into l
    from public.lojas lj
    join public.redes r on r.id = lj.rede_id
   where lj.token_pedido = pedido_cliente_abrir.token
     and lj.status = 'ativo';

  if not found then
    raise exception 'Link de pedido inválido ou desativado.' using errcode = 'P0002';
  end if;

  permitidos := public.pedido_cliente_permitidos(l.id);
  return jsonb_build_object(
    'loja', l.nome,
    'rede', l.rede,
    'produtos', public.pedido_cliente_produtos(permitidos),
    'ultimoPedido', public.pedido_cliente_ultimo(l.id, permitidos)
  );
end;
$$;

create or replace function public.pedido_cliente_enviar(token text, itens jsonb, observacao text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  loja_id uuid;
begin
  select lj.id into loja_id
    from public.lojas lj
   where lj.token_pedido = pedido_cliente_enviar.token
     and lj.status = 'ativo';

  if not found then
    raise exception 'Link de pedido inválido ou desativado.' using errcode = 'P0002';
  end if;

  return public.pedido_cliente_gravar(loja_id, itens, observacao);
end;
$$;

-- ─── Link da rede ───────────────────────────────────────────────────────────

create or replace function public.pedido_rede_abrir(token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r record;
  lojas jsonb;
  todos_ids uuid[];
begin
  select rd.id, rd.nome into r
    from public.redes rd
   where rd.token_pedido = pedido_rede_abrir.token
     and rd.status = 'ativo';

  if not found then
    raise exception 'Link de pedido inválido ou desativado.' using errcode = 'P0002';
  end if;

  -- Cada loja com os produtos dela (`produtoIds`, null = todos).
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id,
           'nome', x.nome,
           'produtoIds', to_jsonb(x.permitidos),
           'ultimoPedido', public.pedido_cliente_ultimo(x.id, x.permitidos)
         ) order by x.nome), '[]'::jsonb)
    into lojas
    from (select lj.id, lj.nome, public.pedido_cliente_permitidos(lj.id) as permitidos
            from public.lojas lj
           where lj.rede_id = r.id and lj.status = 'ativo') x;

  -- `produtos` traz uma vez só todo produto que alguma loja pode pedir.
  with x as (select public.pedido_cliente_permitidos(lj.id) as p
               from public.lojas lj
              where lj.rede_id = r.id and lj.status = 'ativo')
  select case when exists (select 1 from x where x.p is null) then null
              else (select array_agg(distinct e) from x, unnest(x.p) e) end
    into todos_ids;

  return jsonb_build_object(
    'rede', r.nome,
    'lojas', lojas,
    'produtos', public.pedido_cliente_produtos(todos_ids)
  );
end;
$$;

-- `pedidos` chega como [{ "lojaId": "…", "itens": [...], "observacao": "…" }, …]
-- e devolve [{ "lojaId", "loja", "numero", "id" }, …] — um por loja.
create or replace function public.pedido_rede_enviar(token text, pedidos jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r record;
  ped jsonb;
  loja_id uuid;
  vistos uuid[] := '{}';
  feitos jsonb := '[]'::jsonb;
begin
  select rd.id into r
    from public.redes rd
   where rd.token_pedido = pedido_rede_enviar.token
     and rd.status = 'ativo';

  if not found then
    raise exception 'Link de pedido inválido ou desativado.' using errcode = 'P0002';
  end if;

  if jsonb_typeof(pedidos) is distinct from 'array' or jsonb_array_length(pedidos) = 0 then
    raise exception 'Nenhuma loja com pedido.';
  end if;
  if jsonb_array_length(pedidos) > 60 then
    raise exception 'Lojas demais num envio só.';
  end if;

  if (select count(*) from public.vendas v
        join public.lojas lj on lj.id = v.loja_id
       where lj.rede_id = r.id and v.origem = 'cliente'
         and v.criado_em > now() - interval '1 hour') + jsonb_array_length(pedidos) > 60 then
    raise exception 'Muitos pedidos em pouco tempo. Aguarde um pouco ou fale com a distribuidora.';
  end if;

  for ped in select * from jsonb_array_elements(pedidos) loop
    select lj.id into loja_id
      from public.lojas lj
     where lj.id::text = ped ->> 'lojaId'
       and lj.rede_id = r.id
       and lj.status = 'ativo';
    if not found then
      raise exception 'Loja não encontrada nesta rede — recarregue a página.';
    end if;
    if loja_id = any(vistos) then
      raise exception 'Loja repetida no envio.';
    end if;
    vistos := vistos || loja_id;

    feitos := feitos || jsonb_build_array(
      public.pedido_cliente_gravar(loja_id, ped -> 'itens', ped ->> 'observacao'));
  end loop;

  return feitos;
end;
$$;

-- ─── Gerar novo link da rede (equipe) ───────────────────────────────────────

create or replace function public.renovar_link_pedido_rede(rede uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  novo text := public.novo_token_pedido();
begin
  if not public.e_gestor() then
    raise exception 'Só sócio master ou assistente geram link novo.';
  end if;
  update public.redes set token_pedido = novo where id = rede;
  if not found then
    raise exception 'Rede não encontrada.';
  end if;
  return novo;
end;
$$;

-- As peças internas ninguém chama direto — só as funções abaixo, como dono.
revoke all on function public.pedido_cliente_permitidos(uuid)           from public, anon, authenticated;
revoke all on function public.pedido_cliente_ultimo(uuid, uuid[])       from public, anon, authenticated;
revoke all on function public.pedido_cliente_produtos(uuid[])           from public, anon, authenticated;
revoke all on function public.pedido_cliente_gravar(uuid, jsonb, text)  from public, anon, authenticated;

revoke all on function public.pedido_cliente_abrir(text)                from public;
revoke all on function public.pedido_cliente_enviar(text, jsonb, text)  from public;
revoke all on function public.pedido_rede_abrir(text)                   from public;
revoke all on function public.pedido_rede_enviar(text, jsonb)           from public;
revoke all on function public.renovar_link_pedido_rede(uuid)            from public, anon;
grant execute on function public.pedido_cliente_abrir(text)               to anon, authenticated;
grant execute on function public.pedido_cliente_enviar(text, jsonb, text) to anon, authenticated;
grant execute on function public.pedido_rede_abrir(text)                  to anon, authenticated;
grant execute on function public.pedido_rede_enviar(text, jsonb)          to anon, authenticated;
grant execute on function public.renovar_link_pedido_rede(uuid)           to authenticated;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-27-empresa-produto.sql
-- ============================================================================
--  Migração 27 — empresa do produto e frutas novas
--
--  Dois ajustes para vender frutas de revenda sem misturá-las com a produção
--  própria:
--
--  1. `produtos.empresa` — por qual empresa o produto é vendido:
--
--        carvalho_cruz   Carvalho Cruz (o padrão; todos os produtos atuais)
--        cvc             CVC
--
--     A receita de cada item de venda conta para a empresa do produto, e a
--     compra de cada fruta para a empresa dos produtos dela. O app separa o
--     DRE por empresa no Painel e no Financeiro; a view vw_receita_empresa_mes
--     faz a mesma conta aqui no banco.
--
--  2. Frutas livres — até aqui `fruta` só aceitava Laranja Pera, Laranja Lima
--     e Abóbora (check em produtos, compras, perdas e acertos). A fruta nova
--     nasce no cadastro de produto do app; este arquivo tira a trava e refaz
--     a vw_estoque_fruta para listar toda fruta que aparece no banco.
--
--  Rode ANTES de publicar a versão do app que traz o campo Empresa: sem a
--  coluna, as gravações de produto ficam presas na fila de Sincronização.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

-- ─── 1. Empresa do produto ──────────────────────────────────────────────────

alter table public.produtos
  add column if not exists empresa text not null default 'carvalho_cruz';

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.produtos'::regclass and conname = 'produtos_empresa_check'
  ) then
    alter table public.produtos
      add constraint produtos_empresa_check check (empresa in ('carvalho_cruz', 'cvc'));
  end if;
end $$;

create index if not exists produtos_empresa_idx on public.produtos (empresa);

-- ─── 2. Frutas livres ───────────────────────────────────────────────────────
--
--  Os checks nasceram sem nome no schema.sql (o Postgres chama de
--  <tabela>_fruta_check), mas um banco antigo pode ter outro nome. Por isso
--  a busca é pela definição: todo check dessas tabelas que fala de `fruta`.
--  A fruta continua obrigatória (not null) — só deixa de ser uma lista fixa.

do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass as tabela, c.conname
      from pg_constraint c
     where c.contype = 'c'
       and c.conrelid in ('public.produtos'::regclass, 'public.compras'::regclass,
                          'public.perdas'::regclass,   'public.acertos'::regclass)
       and pg_get_constraintdef(c.oid) ilike '%fruta%'
       and c.conname not like '%_fruta_preenchida'
  loop
    execute format('alter table %s drop constraint %I', r.tabela, r.conname);
  end loop;
end $$;

-- Fruta em branco não é fruta.
do $$
declare
  t text;
begin
  foreach t in array array['produtos', 'compras', 'perdas', 'acertos'] loop
    if not exists (
      select 1 from pg_constraint
       where conrelid = format('public.%I', t)::regclass and conname = t || '_fruta_preenchida'
    ) then
      execute format('alter table public.%I add constraint %I check (btrim(fruta) <> '''')',
                     t, t || '_fruta_preenchida');
    end if;
  end loop;
end $$;

-- ─── Estoque por fruta ──────────────────────────────────────────────────────
--
--  A mesma conta da migração 05 (compras − vendas − perdas + acertos). Só a
--  lista de frutas mudou: as três de sempre, mais toda fruta que aparece em
--  produtos, compras, perdas ou acertos. Mesmas colunas, na mesma ordem.

create or replace view public.vw_estoque_fruta as
with frutas as (
  select unnest(array['Laranja Pera', 'Laranja Lima', 'Abóbora']) as fruta
  union select fruta from public.produtos
  union select fruta from public.compras
  union select fruta from public.perdas
  union select fruta from public.acertos
),
entradas as (
  select fruta, sum(peso_kg) as kg
  from public.compras
  group by fruta
),
saidas as (
  select
    p.fruta,
    sum((item ->> 'kgTotal')::numeric) as kg,
    sum((item ->> 'kgTotal')::numeric)
      filter (where coalesce(item ->> 'natureza', 'venda') = 'bonificacao') as kg_bonificado
  from public.vendas v
  cross join lateral jsonb_array_elements(v.itens) as item
  join public.produtos p on p.id = (item ->> 'produtoId')::uuid
  where v.status <> 'cancelado'
  group by p.fruta
),
perdido as (
  select fruta, sum(kg) as kg
  from public.perdas
  group by fruta
),
acertado as (
  select fruta, sum(ajuste) as kg
  from public.acertos
  group by fruta
)
select
  f.fruta,
  coalesce(e.kg, 0)            as entradas_kg,
  coalesce(s.kg, 0)            as vendas_kg,
  coalesce(s.kg_bonificado, 0) as bonificado_kg,
  coalesce(pd.kg, 0)           as perdas_kg,
  coalesce(ac.kg, 0)           as acertos_kg,
  coalesce(e.kg, 0) - coalesce(s.kg, 0) - coalesce(pd.kg, 0) + coalesce(ac.kg, 0) as estoque_kg,
  coalesce(e.kg, 0) - coalesce(s.kg, 0) - coalesce(pd.kg, 0) + coalesce(ac.kg, 0) < 0 as negativo
from frutas f
left join entradas e  on e.fruta  = f.fruta
left join saidas   s  on s.fruta  = f.fruta
left join perdido  pd on pd.fruta = f.fruta
left join acertado ac on ac.fruta = f.fruta;

alter view public.vw_estoque_fruta set (security_invoker = on);

-- ─── Receita e mercadoria por empresa, mês a mês ────────────────────────────
--
--  A mesma separação do app: a receita pela empresa do produto (sem
--  bonificação, sem venda cancelada), a mercadoria pela empresa da fruta.
--  Uma fruta pertence a uma empresa só — o app não deixa uma fruta ganhar
--  produto das duas; se acontecer por fora do app, vale a Carvalho Cruz.
--  Despesas, combustível e folha são da operação inteira e não entram aqui.

create or replace view public.vw_receita_empresa_mes as
with receita as (
  select
    date_trunc('month', v.data)::date as mes,
    p.empresa,
    sum((item ->> 'qty')::numeric * coalesce(item ->> 'precoUnitario', item ->> 'preco')::numeric) as receita,
    sum((item ->> 'kgTotal')::numeric) as kg_vendido
  from public.vendas v
  cross join lateral jsonb_array_elements(v.itens) as item
  join public.produtos p on p.id = (item ->> 'produtoId')::uuid
  where v.status <> 'cancelado'
    and coalesce(item ->> 'natureza', 'venda') <> 'bonificacao'
  group by 1, 2
),
empresa_da_fruta as (
  select fruta, case when bool_and(empresa = 'cvc') then 'cvc' else 'carvalho_cruz' end as empresa
  from public.produtos
  group by fruta
),
mercadoria as (
  select
    date_trunc('month', c.data)::date as mes,
    coalesce(ef.empresa, 'carvalho_cruz') as empresa,
    sum(c.total)   as mercadoria,
    sum(c.peso_kg) as kg_comprado
  from public.compras c
  left join empresa_da_fruta ef on ef.fruta = c.fruta
  group by 1, 2
)
select
  coalesce(r.mes, m.mes)           as mes,
  coalesce(r.empresa, m.empresa)   as empresa,
  coalesce(r.receita, 0)           as receita,
  coalesce(m.mercadoria, 0)        as mercadoria,
  coalesce(r.receita, 0) - coalesce(m.mercadoria, 0) as margem_bruta,
  coalesce(r.kg_vendido, 0)        as kg_vendido,
  coalesce(m.kg_comprado, 0)       as kg_comprado
from receita r
full join mercadoria m on m.mes = r.mes and m.empresa = r.empresa;

alter view public.vw_receita_empresa_mes set (security_invoker = on);

grant select on public.vw_estoque_fruta, public.vw_receita_empresa_mes to anon, authenticated;

commit;

-- Confira:
--   select empresa, count(*) from public.produtos group by empresa;
--   select * from public.vw_receita_empresa_mes order by mes, empresa;
--   select * from public.vw_estoque_fruta order by fruta;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-28-produtos-cvc-fiscal.sql
-- ============================================================================
--  Migração 28 — tributação por produto e as frutas da CVC
--
--  1. Tributação por produto — até aqui a nota saía com a mesma tributação
--     para tudo, fixa no código (ICMS CST 40, PIS/COFINS CST 07), que é a da
--     produção própria. As frutas da CVC são REVENDA e precisam da delas:
--
--        origem           origem da mercadoria (0 nacional, 2 estrangeira
--                         adquirida no mercado interno…)
--        icms_cst         CST do ICMS (ex.: 40 isenta)
--        icms_aliquota    alíquota do ICMS, quando tributado
--        pis_cst          CST do PIS    (ex.: 06 alíquota zero, 07 isenta)
--        cofins_cst       CST da COFINS
--        cest, ean        quando houver
--        codigo           o código do produto no Omie (PRD00016…)
--
--     Os produtos que já existem ganham exatamente a tributação de hoje
--     (origem 0, CST 40 / 07 / 07) — as notas deles não mudam em nada.
--
--  2. As frutas do cadastro do Omie que ainda não estão no app, como CVC e
--     CFOP 5.102 (revenda). Caixas, etiquetas, grampos e máquina NÃO entram:
--     são cadastrados direto no Spedy. A TRIBUTAÇÃO (CSTs) NÃO VEIO NA
--     PLANILHA do Omie e fica vazia: o app não deixa emitir nota de produto
--     da CVC sem tributação. Preencha pela aba Estoque → lápis do produto,
--     depois de confirmar com o contador.
--
--  Rode ANTES de publicar a versão do app com os dados fiscais — sem as
--  colunas, as gravações de produto ficam presas na fila de Sincronização.
--  Depois da migracao-27.
--
--  Idempotente: pode rodar de novo sem quebrar nada e sem duplicar produto.
--  Nada é apagado.
-- ============================================================================

begin;

-- ─── 1. Tributação por produto ──────────────────────────────────────────────

alter table public.produtos add column if not exists codigo        text;
alter table public.produtos add column if not exists origem        smallint;
alter table public.produtos add column if not exists icms_cst      text;
alter table public.produtos add column if not exists icms_aliquota numeric(5,2);
alter table public.produtos add column if not exists pis_cst       text;
alter table public.produtos add column if not exists cofins_cst    text;
alter table public.produtos add column if not exists cest          text;
alter table public.produtos add column if not exists ean           text;

-- Os produtos de hoje (produção própria, Carvalho Cruz) ficam com a
-- tributação que o app sempre usou. Só preenche o que está vazio.
update public.produtos
   set origem     = coalesce(origem, 0),
       icms_cst   = coalesce(icms_cst, '40'),
       pis_cst    = coalesce(pis_cst, '07'),
       cofins_cst = coalesce(cofins_cst, '07')
 where empresa = 'carvalho_cruz';

-- ─── 2. Frutas do Omie (CVC) ────────────────────────────────────────────────
--
--  Fora da lista, de propósito: laranja pera, laranja lima, os sacos de
--  laranja e abóbora (já cadastrados, produção própria); o "MILHO VERDE" com
--  NCM de milho em grão (duplicado do MILHO VERDE IN NATURA); e tudo que não
--  é fruta (vai direto no Spedy).
--
--  Cada fruta da CVC é a sua própria fruta no estoque. Entra só o que ainda
--  não existe com o mesmo nome.

insert into public.produtos
  (nome, fruta, empresa, unidade_venda, kg_por_unidade, preco,
   ncm, cfop_padrao, unidade_omie, codigo, origem)
select v.nome, v.fruta, 'cvc', 'kg', 1, 0,
       v.ncm, '5.102', v.unidade_omie, v.codigo, 0
  from (values
    -- nome                              fruta                      NCM            un.   código Omie
    ('Abacate',                          'Abacate',                   '0804.40.00', 'KG', 'PRD00016'),
    ('Ameixa Fresca Importada',          'Ameixa Fresca Importada',   '0809.40.00', 'KG', 'PRD00017'),
    ('Coco Seco',                        'Coco Seco',                 '0801.11.00', 'KG', 'PRD00024'),
    ('Goiaba',                           'Goiaba',                    '0804.50.10', 'KG', 'PRD00018'),
    ('Kiwi Importado',                   'Kiwi Importado',            '0810.50.00', 'KG', 'PRD00022'),
    ('Laranja Nacional',                 'Laranja Nacional',          '0805.10.00', 'KG', '3321'),
    ('Laranja Navelina',                 'Laranja Navelina',          '0805.10.00', 'KG', 'PRD00010'),
    ('Lima da Pérsia',                   'Lima da Pérsia',            '0805.50.00', 'KG', 'PRD00011'),
    ('Limão',                            'Limão',                     '0805.50.00', 'KG', 'PRD00015'),
    ('Limão Siciliano',                  'Limão Siciliano',           '0805.50.00', 'KG', 'PRD00032'),
    ('Maçã Verde',                       'Maçã Verde',                '0808.10.00', 'KG', 'PRD00012'),
    ('Mamão Havaí',                      'Mamão Havaí',               '0807.20.00', 'KG', 'PRD00033'),
    ('Manga Espada',                     'Manga Espada',              '0804.50.20', 'KG', 'PRD00034'),
    ('Manga Tommy Atkins',               'Manga Tommy Atkins',        '0804.50.20', 'KG', 'PRD00025'),
    ('Maracujá',                         'Maracujá',                  '0810.90.15', 'KG', 'PRD00019'),
    ('Melancia',                         'Melancia',                  '0807.11.00', 'UN', 'PRD00029'),
    ('Melão Orange',                     'Melão Orange',              '0807.19.00', 'KG', 'PRD00020'),
    ('Milho Verde',                      'Milho Verde',               '0709.99.19', 'UN', 'PRD00006'),
    ('Pera D''Anjou',                    'Pera D''Anjou',             '0808.30.00', 'KG', 'PRD00021'),
    ('Pera Importada USA',               'Pera Importada USA',        '0808.30.00', 'KG', 'PRD00014'),
    ('Pera Portuguesa',                  'Pera Portuguesa',           '0808.30.00', 'KG', 'PRD00023'),
    ('Pinha',                            'Pinha',                     '0810.90.12', 'KG', 'PRD00030'),
    ('Tangerina',                        'Tangerina',                 '0805.21.00', 'UN', 'PRD00028'),
    ('Tangerina Murcote',                'Tangerina Murcote',         '0805.21.00', 'KG', 'PRD00031'),
    ('Tangerina Piemonte',               'Tangerina Piemonte',        '0805.21.00', 'KG', 'PRD00013'),
    ('Tangerina Ponkan',                 'Tangerina Ponkan',          '0805.21.00', 'KG', 'PRD00009')
  ) as v(nome, fruta, ncm, unidade_omie, codigo)
 where not exists (select 1 from public.produtos p where lower(p.nome) = lower(v.nome));

commit;

-- Confira:
--   select empresa, count(*), count(icms_cst) as com_tributacao from public.produtos group by 1;
--   select nome, ncm, cfop_padrao, icms_cst from public.produtos where empresa = 'cvc' order by nome;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-29-nome-pedido.sql
-- ============================================================================
--  Migração 29 — nome de quem faz o pedido pelo link
--
--  A página do link de pedido (da loja, migração 21, e da rede, migração 26)
--  passa a EXIGIR o nome da pessoa que está pedindo — o gerente, o
--  encarregado… Ele fica guardado na venda (`vendas.pedido_por`) e aparece na
--  aba Vendas, ao lado de "Pedido do cliente", e na hora de conferir.
--
--  O nome é conferido aqui, no banco: sem ele (ou com menos de 2 letras) o
--  pedido não grava, mesmo que alguém chame a função direto, sem a página.
--  Espaços sobrando são tirados e o nome é cortado em 80 letras.
--
--  Troca a assinatura de três funções (por isso os `drop function`):
--    pedido_cliente_gravar(loja, itens, observacao, nome)   — interna
--    pedido_cliente_enviar(token, itens, observacao, nome)  — link da loja
--    pedido_rede_enviar(token, pedidos, nome)               — link da rede
--  O resto — produtos liberados, preço, prazo, número, freio contra abuso —
--  continua exatamente como na 26.
--
--  Rode ANTES de publicar a versão do app que traz o campo: a página nova
--  manda o nome, e a função antiga não o conhece ("o pedido pelo link ainda
--  não está ativo"). Depois de rodar, a página antiga (celular com a versão
--  velha em cache) recebe "Informe o seu nome" — é só recarregar.
--
--  Depois da migracao-26. Idempotente. Nada é apagado.
-- ============================================================================

begin;

alter table public.vendas add column if not exists pedido_por text;

drop function if exists public.pedido_cliente_enviar(text, jsonb, text);
drop function if exists public.pedido_rede_enviar(text, jsonb);
drop function if exists public.pedido_cliente_gravar(uuid, jsonb, text);

-- Grava o pedido de UMA loja (já conferida pelo chamador), agora com o nome
-- de quem pediu.
create or replace function public.pedido_cliente_gravar(loja uuid, itens jsonb, observacao text, nome text)
returns jsonb
language plpgsql
volatile
set search_path = public
as $$
declare
  l record;
  item jsonb;
  p record;
  qty numeric;
  preco numeric;
  lista jsonb := '[]'::jsonb;
  total numeric := 0;
  kg_total numeric := 0;
  prazo integer;
  proximo integer;
  hoje date := (now() at time zone 'America/Maceio')::date;
  nova uuid := gen_random_uuid();
  permitidos uuid[] := public.pedido_cliente_permitidos(pedido_cliente_gravar.loja);
  quem text := left(regexp_replace(trim(coalesce(pedido_cliente_gravar.nome, '')), '\s+', ' ', 'g'), 80);
begin
  if char_length(quem) < 2 then
    raise exception 'Informe o seu nome para enviar o pedido.';
  end if;

  select lj.id, lj.rede_id, lj.nome into l
    from public.lojas lj
   where lj.id = pedido_cliente_gravar.loja;

  if jsonb_typeof(itens) is distinct from 'array' or jsonb_array_length(itens) = 0 then
    raise exception 'O pedido da loja % está vazio.', l.nome;
  end if;
  if jsonb_array_length(itens) > 50 then
    raise exception 'Itens demais num pedido só.';
  end if;

  if (select count(*) from public.vendas v
       where v.loja_id = l.id and v.origem = 'cliente'
         and v.criado_em > now() - interval '1 hour') >= 10 then
    raise exception 'Muitos pedidos em pouco tempo para a loja %. Aguarde um pouco ou fale com a distribuidora.', l.nome;
  end if;

  for item in select * from jsonb_array_elements(itens) loop
    begin
      qty := round((item ->> 'qty')::numeric, 2);
    exception when others then
      raise exception 'Quantidade inválida.';
    end;
    if qty is null or qty <= 0 then
      continue;
    end if;
    if qty > 100000 then
      raise exception 'Quantidade grande demais.';
    end if;

    select pr.id, pr.unidade_venda, pr.kg_por_unidade
      into p
      from public.produtos pr
     where pr.id::text = item ->> 'produtoId'
       and (permitidos is null or pr.id = any (permitidos));
    if not found then
      raise exception 'Produto não encontrado — recarregue a página.';
    end if;
    if lista @> jsonb_build_array(jsonb_build_object('produtoId', p.id)) then
      raise exception 'Produto repetido no pedido.';
    end if;

    -- Preço da última venda deste produto para a loja; senão, para a rede.
    select (i ->> 'precoUnitario')::numeric
      into preco
      from public.vendas v
      join public.lojas lj on lj.id = v.loja_id
      cross join lateral jsonb_array_elements(v.itens) i
     where lj.rede_id = l.rede_id
       and v.status <> 'cancelado'
       and i ->> 'produtoId' = p.id::text
       and coalesce(i ->> 'natureza', 'venda') = 'venda'
       and coalesce(i ->> 'unidade', '') <> 'un'
       and (i ->> 'precoUnitario')::numeric > 0
     order by (v.loja_id = l.id) desc, v.data desc, v.criado_em desc
     limit 1;
    preco := coalesce(preco, 0);

    lista := lista || jsonb_build_array(jsonb_build_object(
      'produtoId', p.id,
      'qty', qty,
      'precoUnitario', preco,
      'kgPorUnidade', p.kg_por_unidade,
      'kgTotal', round(qty * p.kg_por_unidade, 3),
      'natureza', 'venda'
    ));
    total := total + round(qty * preco, 2);
    kg_total := kg_total + round(qty * p.kg_por_unidade, 3);
  end loop;

  if jsonb_array_length(lista) = 0 then
    raise exception 'O pedido da loja % está vazio.', l.nome;
  end if;

  -- O prazo de sempre desta loja; loja nova começa com 30 dias, como no app.
  select v.prazo_dias into prazo
    from public.vendas v
   where v.loja_id = l.id and v.status <> 'cancelado'
   order by v.data desc, v.criado_em desc
   limit 1;
  prazo := coalesce(prazo, 30);

  -- Dois clientes enviando no mesmo instante não pegam o mesmo número.
  perform pg_advisory_xact_lock(hashtext('vendas.numero'));
  select coalesce(max(v.numero), 0) + 1 into proximo from public.vendas v;

  insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status,
                             origem, observacao, aguardando_conferencia, pedido_por)
  values (nova, proximo, l.id, hoje, prazo, lista, total, kg_total, 'pendente',
          'cliente', nullif(left(trim(coalesce(observacao, '')), 500), ''), true, quem);

  return jsonb_build_object('id', nova, 'numero', proximo, 'lojaId', l.id, 'loja', l.nome);
end;
$$;

create or replace function public.pedido_cliente_enviar(token text, itens jsonb, observacao text default null, nome text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  loja_id uuid;
begin
  select lj.id into loja_id
    from public.lojas lj
   where lj.token_pedido = pedido_cliente_enviar.token
     and lj.status = 'ativo';

  if not found then
    raise exception 'Link de pedido inválido ou desativado.' using errcode = 'P0002';
  end if;

  return public.pedido_cliente_gravar(loja_id, itens, observacao, pedido_cliente_enviar.nome);
end;
$$;

-- `pedidos` chega como [{ "lojaId": "…", "itens": [...], "observacao": "…" }, …]
-- e `nome` é de quem está pedindo (vale para todas as lojas do envio).
create or replace function public.pedido_rede_enviar(token text, pedidos jsonb, nome text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  r record;
  ped jsonb;
  loja_id uuid;
  vistos uuid[] := '{}';
  feitos jsonb := '[]'::jsonb;
begin
  select rd.id into r
    from public.redes rd
   where rd.token_pedido = pedido_rede_enviar.token
     and rd.status = 'ativo';

  if not found then
    raise exception 'Link de pedido inválido ou desativado.' using errcode = 'P0002';
  end if;

  if jsonb_typeof(pedidos) is distinct from 'array' or jsonb_array_length(pedidos) = 0 then
    raise exception 'Nenhuma loja com pedido.';
  end if;
  if jsonb_array_length(pedidos) > 60 then
    raise exception 'Lojas demais num envio só.';
  end if;

  if (select count(*) from public.vendas v
        join public.lojas lj on lj.id = v.loja_id
       where lj.rede_id = r.id and v.origem = 'cliente'
         and v.criado_em > now() - interval '1 hour') + jsonb_array_length(pedidos) > 60 then
    raise exception 'Muitos pedidos em pouco tempo. Aguarde um pouco ou fale com a distribuidora.';
  end if;

  for ped in select * from jsonb_array_elements(pedidos) loop
    select lj.id into loja_id
      from public.lojas lj
     where lj.id::text = ped ->> 'lojaId'
       and lj.rede_id = r.id
       and lj.status = 'ativo';
    if not found then
      raise exception 'Loja não encontrada nesta rede — recarregue a página.';
    end if;
    if loja_id = any(vistos) then
      raise exception 'Loja repetida no envio.';
    end if;
    vistos := vistos || loja_id;

    feitos := feitos || jsonb_build_array(
      public.pedido_cliente_gravar(loja_id, ped -> 'itens', ped ->> 'observacao', pedido_rede_enviar.nome));
  end loop;

  return feitos;
end;
$$;

revoke all on function public.pedido_cliente_gravar(uuid, jsonb, text, text)  from public, anon, authenticated;
revoke all on function public.pedido_cliente_enviar(text, jsonb, text, text)  from public;
revoke all on function public.pedido_rede_enviar(text, jsonb, text)           from public;
grant execute on function public.pedido_cliente_enviar(text, jsonb, text, text) to anon, authenticated;
grant execute on function public.pedido_rede_enviar(text, jsonb, text)          to anon, authenticated;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-30-nfe-recebidas-sefaz.sql
-- ============================================================================
--  Migração 30 — NF-e recebidas direto da SEFAZ (sem a Spedy)
--
--  A busca das notas emitidas contra o CNPJ da empresa passa a ser feita pelo
--  próprio app, no serviço de Distribuição DF-e da SEFAZ, com o certificado
--  A1 (api/sefaz.js). Duas tabelas:
--
--    nfe_recebidas     uma linha por nota: primeiro o resumo (emitente, valor,
--                      chave); depois da manifestação, o XML completo. Guarda
--                      também cancelamento e manifestação.
--    sefaz_dfe_estado  uma linha só: o último NSU lido e a partir de quando a
--                      SEFAZ deixa consultar de novo (ela bloqueia por uma
--                      hora quem consulta sem ter nada novo).
--
--  Quem grava é só a função do servidor (com a service role, que passa por
--  cima do RLS). O app só lê: gestor (sócio master ou assistente
--  administrativo) quando o auth.sql já está ligado; qualquer um antes dele,
--  como as outras tabelas nessa fase.
--
--  `notas_entrada` (migração 25) continua sendo onde fica a entrada dada na
--  nota — a ligação é pela chave de acesso.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

create table if not exists public.nfe_recebidas (
  chave                   text primary key check (chave ~ '^\d{44}$'),
  ambiente                text not null default 'producao',
  nsu                     bigint,
  emitente_cnpj           text,
  emitente_nome           text,
  emitente_fantasia       text,
  emitente_ie             text,
  emitida_em              timestamptz,
  tipo_nf                 text,                 -- 'saida' (venda para nós) / 'entrada' (ex.: devolução emitida pelo cliente como entrada)
  numero                  bigint,
  serie                   text,
  valor                   numeric(14,2) not null default 0,
  protocolo               text,
  situacao                text not null default 'authorized' check (situacao in ('authorized', 'canceled', 'denied')),
  cancelada_em            timestamptz,
  completo                boolean not null default false,
  xml                     text,                 -- nfeProc completo, quando a SEFAZ libera
  manifestacao            text not null default 'none'
                            check (manifestacao in ('none', 'acknowledged', 'confirmed', 'unknown', 'notPerformed')),
  manifestada_em          timestamptz,
  manifestacao_protocolo  text,
  justificativa           text,
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now()
);

create index if not exists nfe_recebidas_emitida_idx on public.nfe_recebidas (emitida_em desc);

drop trigger if exists nfe_recebidas_atualizado_em on public.nfe_recebidas;
create trigger nfe_recebidas_atualizado_em before update on public.nfe_recebidas
  for each row execute function public.tocar_atualizado_em();

create table if not exists public.sefaz_dfe_estado (
  id                   int primary key default 1 check (id = 1),
  cnpj                 text,
  ambiente             text,
  ult_nsu              bigint not null default 0,
  max_nsu              bigint not null default 0,
  ultima_consulta_em   timestamptz,
  proxima_consulta_em  timestamptz,
  ultimo_cstat         text,
  ultima_mensagem      text,
  em_andamento_ate     timestamptz,           -- trava contra duas buscas ao mesmo tempo
  cert_titular         text,
  cert_valido_ate      timestamptz,
  atualizado_em        timestamptz not null default now()
);

insert into public.sefaz_dfe_estado (id) values (1) on conflict (id) do nothing;

-- ─── Acesso: só leitura para o app ──────────────────────────────────────────

alter table public.nfe_recebidas enable row level security;
alter table public.sefaz_dfe_estado enable row level security;

drop policy if exists nfe_recebidas_leitura on public.nfe_recebidas;
drop policy if exists sefaz_dfe_estado_leitura on public.sefaz_dfe_estado;

revoke all on public.nfe_recebidas from anon, authenticated;
revoke all on public.sefaz_dfe_estado from anon, authenticated;

do $$
begin
  if to_regprocedure('public.e_gestor()') is not null then
    create policy nfe_recebidas_leitura on public.nfe_recebidas
      for select to authenticated using (public.e_gestor());
    create policy sefaz_dfe_estado_leitura on public.sefaz_dfe_estado
      for select to authenticated using (public.e_gestor());
    grant select on public.nfe_recebidas, public.sefaz_dfe_estado to authenticated;
  else
    create policy nfe_recebidas_leitura on public.nfe_recebidas
      for select to anon, authenticated using (true);
    create policy sefaz_dfe_estado_leitura on public.sefaz_dfe_estado
      for select to anon, authenticated using (true);
    grant select on public.nfe_recebidas, public.sefaz_dfe_estado to anon, authenticated;
  end if;
end;
$$;

grant all on public.nfe_recebidas, public.sefaz_dfe_estado to service_role;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-31-insumos-producao.sql
-- ============================================================================
--  Migração 31 — estoque de insumos de produção (redinha, grampo, etiquetas)
--
--  O que embala o sanquinho de laranja: redinha, grampo e etiqueta (uma por
--  peso — 2,5 kg, 3 kg, 5 kg e 10 kg). Diferente da fruta, não tem compra
--  lançada linha a linha pelo app para virar conta — hoje isso é uma
--  despesa solta em Despesas (GRAMPOS, ETIQUETAS). O que controla aqui é a
--  CONTAGEM física: toda semana alguém conta o que tem no depósito e
--  registra; o saldo de cada item é sempre a última contagem dele.
--
--  Duas tabelas:
--
--    insumos_itens      cadastro fixo — nome, unidade e o estoque mínimo que
--                        dispara o alerta de "abaixo do mínimo". Semeada com
--                        os 6 itens de hoje; dá para desativar ou ajustar o
--                        mínimo pela tela, sem SQL.
--    contagens_insumos  uma linha por item contado, com data e quantidade —
--                        o histórico. Sem venda/perda: o que sobra de uma
--                        contagem pra outra é assunto do depósito, não do
--                        app.
--
--  Alerta semanal (opcional): se a migracao-20-notificacao-pedidos.sql já
--  está aplicada (o aviso de pedido novo pelo ntfy), este arquivo tenta
--  agendar, pelo pg_cron, um aviso toda SEGUNDA às 16h (horário de Aracaju,
--  UTC-3 o ano todo — Brasil não tem mais horário de verão) lembrando de
--  contar os insumos. Usa o MESMO tópico do ntfy já configurado — não é
--  preciso outro. Se o projeto não tiver o pg_cron disponível, o resto da
--  migração roda igual; só o agendamento fica de fora (veja o aviso que a
--  consulta imprime) — nesse caso, ligue a extensão pg_cron pelo painel do
--  Supabase (Database → Extensions) e rode este arquivo de novo.
--
--  Para testar o aviso sem esperar a segunda-feira:
--       select privado.lembrar_contagem_insumos();
--
--  Rode antes de publicar a versão do app que traz a aba de insumos — sem
--  as tabelas, as contagens ficam presas na fila de Sincronização.
--
--  Idempotente: pode rodar de novo sem duplicar itens nem o agendamento.
-- ============================================================================

begin;

create table if not exists public.insumos_itens (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null unique,
  unidade        text not null default 'unidade',
  estoque_minimo numeric(12,2) not null default 0 check (estoque_minimo >= 0),
  ordem          integer not null default 0,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create table if not exists public.contagens_insumos (
  id             uuid primary key default gen_random_uuid(),
  data           date not null default current_date,
  item           text not null,
  quantidade     numeric(12,2) not null default 0 check (quantidade >= 0),
  observacao     text,
  criado_em      timestamptz not null default now()
);

create index if not exists contagens_insumos_data_idx on public.contagens_insumos (data desc);
create index if not exists contagens_insumos_item_idx on public.contagens_insumos (item);

drop trigger if exists insumos_itens_atualizado_em on public.insumos_itens;
create trigger insumos_itens_atualizado_em before update on public.insumos_itens
  for each row execute function public.tocar_atualizado_em();

-- Os 6 itens de hoje. `on conflict do nothing` porque o nome é único: rodar
-- de novo não duplica, e um item renomeado ou removido pela tela fica assim.
insert into public.insumos_itens (id, nome, unidade, estoque_minimo, ordem) values
  ('11100000-0000-4000-8000-000000000001', 'Redinha',          'unidade', 0, 1),
  ('11100000-0000-4000-8000-000000000002', 'Grampo',           'unidade', 0, 2),
  ('11100000-0000-4000-8000-000000000003', 'Etiqueta 2,5 kg',  'unidade', 0, 3),
  ('11100000-0000-4000-8000-000000000004', 'Etiqueta 3 kg',    'unidade', 0, 4),
  ('11100000-0000-4000-8000-000000000005', 'Etiqueta 5 kg',    'unidade', 0, 5),
  ('11100000-0000-4000-8000-000000000006', 'Etiqueta 10 kg',   'unidade', 0, 6)
on conflict (nome) do nothing;

-- ─── Acesso ─────────────────────────────────────────────────────────────────
--
-- Mesma regra da aba Estoque: gestor (sócio master e assistente) lê e grava;
-- exclusão passa por pode_excluir_registros(). Antes do auth.sql, fica
-- aberta como as demais tabelas nessa fase.

alter table public.insumos_itens     enable row level security;
alter table public.contagens_insumos enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['insumos_itens', 'contagens_insumos'] loop
    execute format('drop policy if exists acesso_app        on public.%I', t);
    execute format('drop policy if exists %I_leitura        on public.%I', t, t);
    execute format('drop policy if exists %I_insercao       on public.%I', t, t);
    execute format('drop policy if exists %I_atualizacao    on public.%I', t, t);
    execute format('drop policy if exists %I_exclusao       on public.%I', t, t);

    if to_regprocedure('public.e_gestor()') is not null then
      execute format(
        'create policy %I_leitura on public.%I for select to authenticated using (public.e_gestor())',
        t, t);
      execute format(
        'create policy %I_insercao on public.%I for insert to authenticated with check (public.e_gestor())',
        t, t);
      execute format(
        'create policy %I_atualizacao on public.%I for update to authenticated using (public.e_gestor()) with check (public.e_gestor())',
        t, t);

      if to_regprocedure('public.pode_excluir_registros()') is not null then
        execute format(
          'create policy %I_exclusao on public.%I for delete to authenticated using (public.pode_excluir_registros())',
          t, t);
      else
        execute format(
          'create policy %I_exclusao on public.%I for delete to authenticated using (public.e_socio())',
          t, t);
      end if;

      execute format('revoke all on public.%I from anon', t);
      execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    else
      -- Antes do auth.sql: aberta, como as outras tabelas nessa fase.
      execute format(
        'create policy acesso_app on public.%I for all to anon, authenticated using (true) with check (true)',
        t);
      execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
    end if;
  end loop;
end;
$$;

commit;

-- ============================================================================
--  Aviso semanal — melhor esforço, fora da transação acima: se o pg_cron não
--  estiver disponível ou o aviso de pedidos (migracao-20) ainda não tiver
--  sido ligado, as duas tabelas de insumos continuam criadas do mesmo jeito.
-- ============================================================================

do $$
begin
  if to_regprocedure('privado.enviar_ntfy(text,text,text)') is null then
    raise notice 'privado.enviar_ntfy não existe — rode a migracao-20-notificacao-pedidos.sql primeiro para ligar o aviso semanal de contagem (opcional).';
    return;
  end if;

  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'Não deu para criar a extensão pg_cron (%). Ative-a pelo painel do Supabase em Database → Extensions → pg_cron e rode este arquivo de novo para agendar o aviso semanal.', sqlerrm;
    return;
  end;

  create or replace function privado.lembrar_contagem_insumos()
  returns void
  language plpgsql
  security definer
  set search_path = ''
  as $f$
  begin
    perform privado.enviar_ntfy(
      'Contagem de estoque — insumos',
      E'Confira o depósito e registre no app quanto tem de:\nRedinha, Grampo, Etiqueta 2,5kg, 3kg, 5kg e 10kg.'
    );
  exception when others then
    raise warning 'lembrete de contagem de insumos falhou: %', sqlerrm;
  end;
  $f$;

  revoke all on function privado.lembrar_contagem_insumos() from public, anon, authenticated;

  if exists (select 1 from cron.job where jobname = 'lembrete-contagem-insumos') then
    perform cron.unschedule('lembrete-contagem-insumos');
  end if;

  -- '0 19 * * 1' em UTC = segunda-feira 16h em Aracaju (UTC-3, sem horário
  -- de verão). pg_cron roda em UTC por padrão no Supabase.
  perform cron.schedule(
    'lembrete-contagem-insumos',
    '0 19 * * 1',
    $job$select privado.lembrar_contagem_insumos();$job$
  );

  raise notice 'Aviso semanal de contagem de insumos agendado: toda segunda às 16h (Aracaju), pelo mesmo tópico ntfy da migracao-20.';
end;
$$;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-31-nota-semanal-rede.sql
-- ============================================================================
--  Migração 31 — nota fiscal semanal por rede (hoje só a REDE PRIMAVERA)
--
--  Combinado com a Primavera: cada entrega da semana sai só com um recibo
--  (documento sem valor fiscal, gerado pelo app), e a NF-e de verdade é
--  emitida uma vez só, no último pedido da semana, juntando os itens de
--  todos os pedidos daquela loja feitos desde a última nota.
--
--  Não muda o modelo de venda: continua uma linha por pedido, com o total e
--  o vencimento próprios dele (para a Cobrança). Só a emissão de NF-e passa a
--  poder juntar vários pedidos: o pedido que fecha a semana ("âncora") leva
--  os campos nfe_* de sempre, e cada pedido que entrou junto na nota fica
--  apontando para ele em `consolidada_em`, com nfe_status = 'consolidada' —
--  não tem nota própria, mas também não pode ganhar uma depois por engano.
--
--  Depois da migracao-08-nfe (colunas nfe_*). Idempotente. Nada é apagado.
-- ============================================================================

begin;

alter table public.vendas
  add column if not exists consolidada_em uuid references public.vendas (id);

create index if not exists vendas_consolidada_em_idx on public.vendas (consolidada_em);

alter table public.vendas drop constraint if exists vendas_nfe_status_check;
alter table public.vendas add constraint vendas_nfe_status_check
  check (nfe_status in ('nao_emitida', 'processando', 'autorizada', 'rejeitada', 'cancelada', 'consolidada'));

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-32-lembrete-contagem-frutas.sql
-- ============================================================================
--  Migração 32 — aviso diário de contagem de estoque (frutas)
--
--  Mesma ideia da migracao-31 (aviso semanal de insumos), só que TODO DIA às
--  16h30 (horário de Aracaju, UTC-3 o ano todo): lembrete pelo ntfy — mesmo
--  tópico já usado para pedidos novos (migracao-20) e para a contagem de
--  insumos — para contar o depósito e registrar o acerto de inventário de
--  cada fruta em Estoque.
--
--  Best-effort, como a 31: se a migracao-20 (privado.enviar_ntfy) ainda não
--  foi aplicada, ou o projeto não tiver o pg_cron disponível, este arquivo
--  não quebra nada — só o agendamento fica de fora, com um aviso explicando
--  o que falta.
--
--  Para testar sem esperar as 16h30:
--       select privado.lembrar_contagem_frutas();
--
--  Para desligar: select cron.unschedule('lembrete-contagem-frutas');
--
--  Idempotente: pode rodar de novo sem duplicar o agendamento.
-- ============================================================================

do $$
begin
  if to_regprocedure('privado.enviar_ntfy(text,text,text)') is null then
    raise notice 'privado.enviar_ntfy não existe — rode a migracao-20-notificacao-pedidos.sql primeiro para ligar o aviso diário de contagem (opcional).';
    return;
  end if;

  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'Não deu para criar a extensão pg_cron (%). Ative-a pelo painel do Supabase em Database → Extensions → pg_cron e rode este arquivo de novo para agendar o aviso diário.', sqlerrm;
    return;
  end;

  create or replace function privado.lembrar_contagem_frutas()
  returns void
  language plpgsql
  security definer
  set search_path = ''
  as $f$
  begin
    perform privado.enviar_ntfy(
      'Contagem de estoque — frutas',
      'Confira o depósito e registre o acerto de inventário de cada fruta em Estoque.'
    );
  exception when others then
    raise warning 'lembrete de contagem de frutas falhou: %', sqlerrm;
  end;
  $f$;

  revoke all on function privado.lembrar_contagem_frutas() from public, anon, authenticated;

  if exists (select 1 from cron.job where jobname = 'lembrete-contagem-frutas') then
    perform cron.unschedule('lembrete-contagem-frutas');
  end if;

  -- '30 19 * * *' em UTC = todo dia 16h30 em Aracaju (UTC-3, sem horário de
  -- verão). pg_cron roda em UTC por padrão no Supabase.
  perform cron.schedule(
    'lembrete-contagem-frutas',
    '30 19 * * *',
    $job$select privado.lembrar_contagem_frutas();$job$
  );

  raise notice 'Aviso diário de contagem de frutas agendado: todo dia às 16h30 (Aracaju), pelo mesmo tópico ntfy da migracao-20.';
end;
$$;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-33-lembrete-preco-frutas.sql
-- ============================================================================
--  Migração 33 — conferência semanal de preços (frutas)
--
--  Tabela `precos_frutas`: a conferência de toda segunda-feira — confirma o
--  preço de cada fruta (o mesmo de novo) ou ajusta. NÃO é o preço da venda,
--  que continua digitado em cada uma e varia por cliente; é a referência que
--  orienta quem vende. O preço vigente de uma fruta é sempre o registro mais
--  recente (precoAtualPorFruta, em distribuidora-carvalho-cruz.jsx).
--
--  Aviso semanal (opcional), mesmo princípio da migracao-31/32: se a
--  migracao-20 (privado.enviar_ntfy) já está aplicada, este arquivo tenta
--  agendar, pelo pg_cron, um aviso toda SEGUNDA às 7h (horário de Aracaju,
--  UTC-3 o ano todo) pelo mesmo tópico ntfy já configurado. Se o pg_cron não
--  estiver disponível, as tabelas são criadas do mesmo jeito — só o
--  agendamento automático fica de fora.
--
--  Para testar sem esperar a segunda-feira:
--       select privado.lembrar_preco_frutas();
--
--  Rode antes de publicar a versão do app que traz a conferência de preços —
--  sem a tabela, os registros ficam presos na fila de Sincronização.
--
--  Idempotente: pode rodar de novo sem duplicar nada.
-- ============================================================================

begin;

create table if not exists public.precos_frutas (
  id         uuid primary key default gen_random_uuid(),
  fruta      text not null,
  preco      numeric(12,4) not null default 0 check (preco >= 0),
  data       date not null default current_date,
  criado_em  timestamptz not null default now()
);

create index if not exists precos_frutas_data_idx  on public.precos_frutas (data desc);
create index if not exists precos_frutas_fruta_idx on public.precos_frutas (fruta);

-- ─── Acesso ─────────────────────────────────────────────────────────────────
--
-- Mesma regra da aba Estoque: gestor lê e grava; exclusão por
-- pode_excluir_registros(). Antes do auth.sql, fica aberta como as demais.

alter table public.precos_frutas enable row level security;

drop policy if exists acesso_app                  on public.precos_frutas;
drop policy if exists precos_frutas_leitura       on public.precos_frutas;
drop policy if exists precos_frutas_insercao      on public.precos_frutas;
drop policy if exists precos_frutas_atualizacao   on public.precos_frutas;
drop policy if exists precos_frutas_exclusao      on public.precos_frutas;

do $$
begin
  if to_regprocedure('public.e_gestor()') is not null then
    create policy precos_frutas_leitura on public.precos_frutas
      for select to authenticated using (public.e_gestor());
    create policy precos_frutas_insercao on public.precos_frutas
      for insert to authenticated with check (public.e_gestor());
    create policy precos_frutas_atualizacao on public.precos_frutas
      for update to authenticated using (public.e_gestor()) with check (public.e_gestor());

    if to_regprocedure('public.pode_excluir_registros()') is not null then
      create policy precos_frutas_exclusao on public.precos_frutas
        for delete to authenticated using (public.pode_excluir_registros());
    else
      create policy precos_frutas_exclusao on public.precos_frutas
        for delete to authenticated using (public.e_socio());
    end if;

    revoke all on public.precos_frutas from anon;
    grant select, insert, update, delete on public.precos_frutas to authenticated;
  else
    -- Antes do auth.sql: aberta, como as outras tabelas nessa fase.
    create policy acesso_app on public.precos_frutas
      for all to anon, authenticated using (true) with check (true);
    grant select, insert, update, delete on public.precos_frutas to anon, authenticated;
  end if;
end;
$$;

commit;

-- ============================================================================
--  Aviso semanal — melhor esforço, fora da transação acima: se o pg_cron não
--  estiver disponível ou o aviso de pedidos (migracao-20) ainda não tiver
--  sido ligado, a tabela de preços continua criada do mesmo jeito.
-- ============================================================================

do $$
begin
  if to_regprocedure('privado.enviar_ntfy(text,text,text)') is null then
    raise notice 'privado.enviar_ntfy não existe — rode a migracao-20-notificacao-pedidos.sql primeiro para ligar o aviso semanal de preços (opcional).';
    return;
  end if;

  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'Não deu para criar a extensão pg_cron (%). Ative-a pelo painel do Supabase em Database → Extensions → pg_cron e rode este arquivo de novo para agendar o aviso semanal.', sqlerrm;
    return;
  end;

  create or replace function privado.lembrar_preco_frutas()
  returns void
  language plpgsql
  security definer
  set search_path = ''
  as $f$
  begin
    perform privado.enviar_ntfy(
      'Conferência de preços — frutas',
      'Confirme ou ajuste o preço de cada fruta desta semana, em Estoque.'
    );
  exception when others then
    raise warning 'lembrete de preço de frutas falhou: %', sqlerrm;
  end;
  $f$;

  revoke all on function privado.lembrar_preco_frutas() from public, anon, authenticated;

  if exists (select 1 from cron.job where jobname = 'lembrete-preco-frutas') then
    perform cron.unschedule('lembrete-preco-frutas');
  end if;

  -- '0 10 * * 1' em UTC = segunda-feira 7h em Aracaju (UTC-3, sem horário de
  -- verão). pg_cron roda em UTC por padrão no Supabase.
  perform cron.schedule(
    'lembrete-preco-frutas',
    '0 10 * * 1',
    $job$select privado.lembrar_preco_frutas();$job$
  );

  raise notice 'Aviso semanal de conferência de preços agendado: toda segunda às 7h (Aracaju), pelo mesmo tópico ntfy da migracao-20.';
end;
$$;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-34-precos-por-produto.sql
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


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-34-motorista-outro.sql
-- ============================================================================
--  Migração 34 — motorista "Outro" no Romaneio
--
--  Até aqui, `vendas.motorista_id` só aceitava um funcionário com a função
--  Motorista (migracao-14-romaneio). Mas às vezes quem dirige não está na
--  folha (ajuda avulsa, terceiro) — a tela de Romaneio ganhou uma opção
--  "Outro..." no lugar do funcionário, que guarda o nome digitado aqui.
--
--  `motorista_id` continua null nesse caso — ele é quem liga a rota à conta
--  de login do motorista (migracao-19-motorista); alguém sem conta no
--  sistema não teria como aparecer em "Minhas Entregas" de qualquer jeito.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

alter table public.vendas add column if not exists motorista_nome text;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-35-pedido-geral.sql
-- ============================================================================
--  Migração 35 — link de pedido GERAL (todas as redes e lojas no mesmo link)
--
--  Além do link de cada loja (migração 21) e do link de cada rede (migração
--  26), um único link reúne TODAS as redes e lojas ativas — para a própria
--  equipe (vendedor externo, por exemplo) lançar o pedido de qualquer
--  cliente sem abrir o app e sem login:
--
--      https://seu-app.vercel.app/pedido/geral/7b2e0c…
--
--  Quem abre busca a rede ou a loja, escolhe uma ou várias — de redes
--  diferentes, se precisar — põe as quantidades e envia tudo de uma vez.
--  Cada loja vira um pedido SEPARADO em Vendas, igual ao link da rede.
--
--  Só existe UM link geral (não é por rede nem por loja): a tabela
--  `pedido_geral_config` guarda uma linha só, com o token. *Gerar novo link*
--  troca esse token e não mexe nos links de cada rede ou loja, e vice-versa.
--
--  Atenção: este link expõe o nome de TODAS as redes e lojas cadastradas —
--  mais do que o link de uma rede só. Repasse apenas para a equipe interna,
--  não para o cliente.
--
--  Segurança: mesmo modelo da 21/26 — a tabela não é lida nem gravada
--  direto (RLS fecha tudo para `anon`; só sócio master e assistente leem o
--  token, pela aba Clientes), só duas funções SECURITY DEFINER que exigem o
--  token e só gravam para lojas ATIVAS de redes ATIVAS. Freio contra abuso:
--  os 10 pedidos por loja por hora da 21 valem aqui também, e o link geral
--  aceita no máximo 200 pedidos por hora no total (o da rede aceita 60).
--
--  Depois da migracao-29 (usa pedido_cliente_gravar com o nome de quem
--  pediu) e da migracao-23 (produtos liberados por rede/loja). Idempotente.
--  Nada é apagado.
-- ============================================================================

begin;

-- ─── Token único do link geral ──────────────────────────────────────────────

create table if not exists public.pedido_geral_config (
  id boolean primary key default true check (id),
  token_pedido text not null default public.novo_token_pedido()
);
insert into public.pedido_geral_config (id)
  values (true)
  on conflict (id) do nothing;

alter table public.pedido_geral_config enable row level security;

drop policy if exists pedido_geral_config_leitura on public.pedido_geral_config;
create policy pedido_geral_config_leitura on public.pedido_geral_config
  for select to authenticated
  using (public.e_gestor());

revoke all on public.pedido_geral_config from public, anon;
grant select on public.pedido_geral_config to authenticated;

-- ─── Abrir: todas as redes ativas com lojas ativas, cada uma com seus produtos liberados ──

create or replace function public.pedido_geral_abrir(token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  redes jsonb;
begin
  if not exists (select 1 from public.pedido_geral_config c where c.token_pedido = pedido_geral_abrir.token) then
    raise exception 'Link de pedido inválido ou desativado.' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id,
           'nome', r.nome,
           'lojas', x.lojas
         ) order by r.nome), '[]'::jsonb)
    into redes
    from public.redes r
    join lateral (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', lj.id,
               'nome', lj.nome,
               'produtoIds', to_jsonb(public.pedido_cliente_permitidos(lj.id)),
               'ultimoPedido', public.pedido_cliente_ultimo(lj.id, public.pedido_cliente_permitidos(lj.id))
             ) order by lj.nome), '[]'::jsonb) as lojas
        from public.lojas lj
       where lj.rede_id = r.id and lj.status = 'ativo'
    ) x on true
   where r.status = 'ativo' and jsonb_array_length(x.lojas) > 0;

  return jsonb_build_object('redes', redes, 'produtos', public.pedido_cliente_produtos(null));
end;
$$;

-- `pedidos` chega como [{ "lojaId": "…", "itens": [...], "observacao": "…" }, …],
-- vindas de lojas de qualquer rede ativa. `nome` vale para todo o envio.
create or replace function public.pedido_geral_enviar(token text, pedidos jsonb, nome text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  ped jsonb;
  loja_id uuid;
  vistos uuid[] := '{}';
  feitos jsonb := '[]'::jsonb;
begin
  if not exists (select 1 from public.pedido_geral_config c where c.token_pedido = pedido_geral_enviar.token) then
    raise exception 'Link de pedido inválido ou desativado.' using errcode = 'P0002';
  end if;

  if jsonb_typeof(pedidos) is distinct from 'array' or jsonb_array_length(pedidos) = 0 then
    raise exception 'Nenhuma loja com pedido.';
  end if;
  if jsonb_array_length(pedidos) > 60 then
    raise exception 'Lojas demais num envio só.';
  end if;

  if (select count(*) from public.vendas v
       where v.origem = 'cliente'
         and v.criado_em > now() - interval '1 hour') + jsonb_array_length(pedidos) > 200 then
    raise exception 'Muitos pedidos em pouco tempo. Aguarde um pouco ou fale com a distribuidora.';
  end if;

  for ped in select * from jsonb_array_elements(pedidos) loop
    select lj.id into loja_id
      from public.lojas lj
      join public.redes r on r.id = lj.rede_id
     where lj.id::text = ped ->> 'lojaId'
       and lj.status = 'ativo'
       and r.status = 'ativo';
    if not found then
      raise exception 'Loja não encontrada — recarregue a página.';
    end if;
    if loja_id = any(vistos) then
      raise exception 'Loja repetida no envio.';
    end if;
    vistos := vistos || loja_id;

    feitos := feitos || jsonb_build_array(
      public.pedido_cliente_gravar(loja_id, ped -> 'itens', ped ->> 'observacao', pedido_geral_enviar.nome));
  end loop;

  return feitos;
end;
$$;

-- ─── Gerar novo link geral (equipe) ─────────────────────────────────────────

create or replace function public.renovar_link_pedido_geral()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  novo text := public.novo_token_pedido();
begin
  if not public.e_gestor() then
    raise exception 'Só sócio master ou assistente geram link novo.';
  end if;
  update public.pedido_geral_config set token_pedido = novo where id;
  return novo;
end;
$$;

revoke all on function public.pedido_geral_abrir(text)                from public;
revoke all on function public.pedido_geral_enviar(text, jsonb, text)  from public;
revoke all on function public.renovar_link_pedido_geral()             from public, anon;
grant execute on function public.pedido_geral_abrir(text)               to anon, authenticated;
grant execute on function public.pedido_geral_enviar(text, jsonb, text) to anon, authenticated;
grant execute on function public.renovar_link_pedido_geral()            to authenticated;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-36-desfazer-escaneio.sql
-- ============================================================================
--  Migração 36 — motorista desfaz um escaneio
--
--  Em "Minhas Entregas" (migracao-19-motorista), o QR da nota avança o
--  status em dois passos: pendente → em_rota (saída do CD) → entregue. Se o
--  motorista ler o QR errado (ex.: a nota de outra loja) e confirmar, não
--  havia como voltar atrás — a entrega errada ficava marcada.
--
--  `desfazer_escaneio(venda)` é o passo inverso de `registrar_escaneio`:
--  entregue → em_rota, em_rota → pendente, limpando o horário do passo
--  desfeito. Só mexe nas entregas escaladas para o motorista logado, igual
--  às outras funções da migracao-19. Não desfaz `retirado_cd`, que não vem
--  de escaneio do motorista (é ação do escritório no Romaneio).
--
--  Precisa rodar DEPOIS da migracao-19-motorista.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

create or replace function public.desfazer_escaneio(venda uuid)
returns table (status_entrega text, numero integer, loja text, mudou boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v record;
begin
  if public.papel_atual() is distinct from 'motorista' then
    raise exception 'Só o motorista desfaz escaneio por aqui.';
  end if;

  select vd.id, vd.numero, vd.status_entrega, l.nome as loja
    into v
    from public.vendas vd
    join public.funcionarios f on f.id = vd.motorista_id
    left join public.lojas l on l.id = vd.loja_id
   where vd.id = venda and f.usuario_id = auth.uid() and vd.status <> 'cancelado';

  if not found then
    raise exception 'Esta nota não está nas suas entregas.';
  end if;

  if v.status_entrega = 'entregue' then
    update public.vendas set status_entrega = 'em_rota', entregue_em = null where id = v.id;
    return query select 'em_rota'::text, v.numero, v.loja, true;
  elsif v.status_entrega = 'em_rota' then
    update public.vendas set status_entrega = 'pendente', saida_cd_em = null where id = v.id;
    return query select 'pendente'::text, v.numero, v.loja, true;
  else
    return query select v.status_entrega, v.numero, v.loja, false;
  end if;
end;
$$;

revoke all on function public.desfazer_escaneio(uuid) from public, anon;
grant execute on function public.desfazer_escaneio(uuid) to authenticated;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-36-carregamento-completo.sql
-- ============================================================================
--  Migração 36 — carregamento completo antes de entregar
--
--  O motorista lê o QR de cada nota duas vezes: a 1ª leitura marca o
--  carregamento no caminhão (pendente → em_rota); a 2ª, a entrega na loja
--  (em_rota → entregue). Até aqui nada impedia ele de ler de novo um pedido
--  já carregado achando que era outro (ou apressado) e "entregar" antes de
--  carregar o resto da viagem — pedido esquecido no CD sem ninguém notar.
--
--  Agora a 2ª leitura só é aceita depois que TODAS as paradas da mesma
--  viagem (mesmo motorista, mesma rota_data) já passaram pela 1ª — ou seja,
--  nenhuma ainda 'pendente'. Enquanto sobrar pedido não carregado, tentar
--  registrar entrega de outro (mesmo já em rota) dá erro.
--
--  Precisa rodar DEPOIS da migracao-19-motorista.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

create or replace function public.registrar_escaneio(venda uuid)
returns table (status_entrega text, numero integer, loja text, momento timestamptz, mudou boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v record;
  faltam integer;
begin
  if public.papel_atual() is distinct from 'motorista' then
    raise exception 'Só o motorista registra escaneio por aqui.';
  end if;

  select vd.id, vd.numero, vd.status_entrega, vd.saida_cd_em, vd.entregue_em, vd.motorista_id,
         coalesce(vd.rota_data, vd.data) as rota_dia, l.nome as loja
    into v
    from public.vendas vd
    join public.funcionarios f on f.id = vd.motorista_id
    left join public.lojas l on l.id = vd.loja_id
   where vd.id = venda and f.usuario_id = auth.uid() and vd.status <> 'cancelado';

  if not found then
    raise exception 'Esta nota não está nas suas entregas.';
  end if;

  if v.status_entrega = 'pendente' then
    update public.vendas set status_entrega = 'em_rota', saida_cd_em = now() where id = v.id;
    return query select 'em_rota'::text, v.numero, v.loja, now(), true;
  elsif v.status_entrega = 'em_rota' then
    select count(*) into faltam
      from public.vendas vd
     where vd.motorista_id = v.motorista_id
       and coalesce(vd.rota_data, vd.data) = v.rota_dia
       and vd.status <> 'cancelado'
       and vd.status_entrega = 'pendente';

    if faltam > 0 then
      raise exception 'Ainda faltam % pedido(s) para carregar no caminhão antes de sair para entrega.', faltam;
    end if;

    update public.vendas set status_entrega = 'entregue', entregue_em = now() where id = v.id;
    return query select 'entregue'::text, v.numero, v.loja, now(), true;
  else
    return query select v.status_entrega, v.numero, v.loja, v.entregue_em, false;
  end if;
end;
$$;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-37-iniciar-rota.sql
-- ============================================================================
--  Migração 37 — "Iniciar rota": carregar não é sair do CD
--
--  A migração 36 bloqueava a 2ª leitura (entrega) enquanto sobrava pedido
--  pendente na mesma viagem, mas a 1ª leitura (carregamento) ainda virava
--  'em_rota' na hora — e é esse status que o Painel TV lê como "saiu do CD".
--  Resultado: carregar só o 1º pedido da rota já fazia a TV mostrar o
--  motorista "em deslocamento", com o caminhão ainda sendo carregado no CD.
--
--  Agora o fluxo ganha um passo a mais, sem QR:
--
--    pendente   → carregando   1ª leitura do QR: pedido no caminhão.
--    carregando → em_rota      botão "Iniciar rota" na tela do motorista —
--                               só libera com a viagem inteira carregada
--                               (nenhum pedido ainda 'pendente'). É só aqui
--                               que grava `saida_cd_em`.
--    em_rota    → entregue     2ª leitura do QR, na loja.
--
--  Ler de novo um pedido que já está 'carregando' (antes de iniciar a rota)
--  agora dá erro — igual já dava pra ler um pedido 'em_rota' antes de
--  carregar todo o resto (migracao-36), só que um passo mais cedo.
--
--  Precisa rodar DEPOIS da migracao-19-motorista.sql e da
--  migracao-36-carregamento-completo.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

alter table public.vendas drop constraint if exists vendas_status_entrega_check;
alter table public.vendas add constraint vendas_status_entrega_check
  check (status_entrega in ('pendente', 'carregando', 'em_rota', 'entregue', 'retirado_cd'));

create or replace function public.registrar_escaneio(venda uuid)
returns table (status_entrega text, numero integer, loja text, momento timestamptz, mudou boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v record;
begin
  if public.papel_atual() is distinct from 'motorista' then
    raise exception 'Só o motorista registra escaneio por aqui.';
  end if;

  select vd.id, vd.numero, vd.status_entrega, vd.saida_cd_em, vd.entregue_em, l.nome as loja
    into v
    from public.vendas vd
    join public.funcionarios f on f.id = vd.motorista_id
    left join public.lojas l on l.id = vd.loja_id
   where vd.id = venda and f.usuario_id = auth.uid() and vd.status <> 'cancelado';

  if not found then
    raise exception 'Esta nota não está nas suas entregas.';
  end if;

  if v.status_entrega = 'pendente' then
    update public.vendas set status_entrega = 'carregando' where id = v.id;
    return query select 'carregando'::text, v.numero, v.loja, now(), true;
  elsif v.status_entrega = 'carregando' then
    raise exception 'Este pedido já foi carregado. Aperte "Iniciar rota" antes de registrar entregas.';
  elsif v.status_entrega = 'em_rota' then
    update public.vendas set status_entrega = 'entregue', entregue_em = now() where id = v.id;
    return query select 'entregue'::text, v.numero, v.loja, now(), true;
  else
    return query select v.status_entrega, v.numero, v.loja, v.entregue_em, false;
  end if;
end;
$$;

-- ─── Iniciar rota ───────────────────────────────────────────────────────────

create or replace function public.iniciar_rota(dia date)
returns table (iniciadas integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  pendentes integer;
  n integer;
begin
  if public.papel_atual() is distinct from 'motorista' then
    raise exception 'Só o motorista inicia a rota por aqui.';
  end if;

  select count(*) into pendentes
    from public.vendas vd
    join public.funcionarios f on f.id = vd.motorista_id
   where f.usuario_id = auth.uid()
     and coalesce(vd.rota_data, vd.data) = dia
     and vd.status <> 'cancelado'
     and vd.status_entrega = 'pendente';

  if pendentes > 0 then
    raise exception 'Ainda faltam % pedido(s) para carregar no caminhão.', pendentes;
  end if;

  update public.vendas vd
     set status_entrega = 'em_rota', saida_cd_em = now()
    from public.funcionarios f
   where f.id = vd.motorista_id
     and f.usuario_id = auth.uid()
     and coalesce(vd.rota_data, vd.data) = dia
     and vd.status <> 'cancelado'
     and vd.status_entrega = 'carregando';
  get diagnostics n = row_count;

  if n = 0 then
    raise exception 'Nenhum pedido carregado para iniciar a rota.';
  end if;

  return query select n;
end;
$$;

revoke all on function public.iniciar_rota(date) from public, anon;
grant execute on function public.iniciar_rota(date) to authenticated;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-38-desfazer-carregando.sql
-- ============================================================================
--  Migração 38 — "Desfazer leitura" ajustado ao status "carregando"
--
--  A migração 36 (migracao-36-desfazer-escaneio.sql) criou `desfazer_escaneio`
--  para o modelo de 3 status: pendente → em_rota → entregue — desfazer voltava
--  entregue → em_rota ou em_rota → pendente.
--
--  A migração 37 (migracao-37-iniciar-rota.sql) mudou o modelo pra 4 status:
--  pendente → carregando (1ª leitura do QR) → em_rota (botão "Iniciar rota")
--  → entregue (2ª leitura do QR). "Em rota" deixou de vir de escaneio — não
--  tem mais o que desfazer ali. Quem virou o "1ª leitura errada" é o status
--  "carregando".
--
--  Esta migração só redefine `desfazer_escaneio`:
--    entregue   → em_rota    (sem mudança)
--    carregando → pendente   (era em_rota → pendente)
--
--  Precisa rodar DEPOIS da migracao-36-desfazer-escaneio.sql e da
--  migracao-37-iniciar-rota.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

create or replace function public.desfazer_escaneio(venda uuid)
returns table (status_entrega text, numero integer, loja text, mudou boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v record;
begin
  if public.papel_atual() is distinct from 'motorista' then
    raise exception 'Só o motorista desfaz escaneio por aqui.';
  end if;

  select vd.id, vd.numero, vd.status_entrega, l.nome as loja
    into v
    from public.vendas vd
    join public.funcionarios f on f.id = vd.motorista_id
    left join public.lojas l on l.id = vd.loja_id
   where vd.id = venda and f.usuario_id = auth.uid() and vd.status <> 'cancelado';

  if not found then
    raise exception 'Esta nota não está nas suas entregas.';
  end if;

  if v.status_entrega = 'entregue' then
    update public.vendas set status_entrega = 'em_rota', entregue_em = null where id = v.id;
    return query select 'em_rota'::text, v.numero, v.loja, true;
  elsif v.status_entrega = 'carregando' then
    update public.vendas set status_entrega = 'pendente' where id = v.id;
    return query select 'pendente'::text, v.numero, v.loja, true;
  else
    return query select v.status_entrega, v.numero, v.loja, false;
  end if;
end;
$$;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-39-mesclar-paradas.sql
-- ============================================================================
--  Migração 39 — mesclar paradas do mesmo cliente no Romaneio
--
--  Dois (ou mais) pedidos pendentes, do mesmo veículo e da mesma loja, podem
--  ser mesclados numa única parada da rota: a tela do Romaneio, o romaneio
--  impresso e o app do motorista passam a mostrar UMA linha só, com os itens
--  e valores somados. Os pedidos continuam sendo vendas separadas — NF-e,
--  financeiro e histórico do cliente não mudam nada — é só o jeito de andar
--  a rota que muda. Reversível a qualquer momento ("Desmesclar").
--
--  `grupo_entrega_id` é só um uuid compartilhado por quem foi mesclado junto
--  (não referencia nada) — vendas com o mesmo valor aqui, no mesmo veículo,
--  são a mesma parada. Sem grupo (null), cada venda é sua própria parada,
--  como sempre foi.
--
--  Escanear o QR de QUALQUER pedido do grupo (cada nota impressa continua
--  com o seu próprio QR) avança o grupo inteiro junto — é assim que o
--  motorista não precisa ler as duas notas separadamente na entrega.
--  `registrar_escaneio` e `desfazer_escaneio` (migracao-19/36/37/38) ganham
--  esse espelhamento.
--
--  Precisa rodar DEPOIS da migracao-38-desfazer-carregando.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

alter table public.vendas add column if not exists grupo_entrega_id uuid;

create index if not exists vendas_grupo_entrega_idx on public.vendas (grupo_entrega_id) where grupo_entrega_id is not null;

create or replace function public.registrar_escaneio(venda uuid)
returns table (status_entrega text, numero integer, loja text, momento timestamptz, mudou boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v record;
  faltam integer;
begin
  if public.papel_atual() is distinct from 'motorista' then
    raise exception 'Só o motorista registra escaneio por aqui.';
  end if;

  select vd.id, vd.numero, vd.status_entrega, vd.saida_cd_em, vd.entregue_em, vd.motorista_id, vd.grupo_entrega_id,
         coalesce(vd.rota_data, vd.data) as rota_dia, l.nome as loja
    into v
    from public.vendas vd
    join public.funcionarios f on f.id = vd.motorista_id
    left join public.lojas l on l.id = vd.loja_id
   where vd.id = venda and f.usuario_id = auth.uid() and vd.status <> 'cancelado';

  if not found then
    raise exception 'Esta nota não está nas suas entregas.';
  end if;

  if v.status_entrega = 'pendente' then
    update public.vendas
       set status_entrega = 'carregando'
     where (id = v.id or (v.grupo_entrega_id is not null and grupo_entrega_id = v.grupo_entrega_id))
       and status_entrega = 'pendente';
    return query select 'carregando'::text, v.numero, v.loja, now(), true;
  elsif v.status_entrega = 'carregando' then
    raise exception 'Este pedido já foi carregado. Aperte "Iniciar rota" antes de registrar entregas.';
  elsif v.status_entrega = 'em_rota' then
    select count(*) into faltam
      from public.vendas vd
     where vd.motorista_id = v.motorista_id
       and coalesce(vd.rota_data, vd.data) = v.rota_dia
       and vd.status <> 'cancelado'
       and vd.status_entrega = 'pendente';

    if faltam > 0 then
      raise exception 'Ainda faltam % pedido(s) para carregar no caminhão antes de sair para entrega.', faltam;
    end if;

    update public.vendas
       set status_entrega = 'entregue', entregue_em = now()
     where (id = v.id or (v.grupo_entrega_id is not null and grupo_entrega_id = v.grupo_entrega_id))
       and status_entrega = 'em_rota';
    return query select 'entregue'::text, v.numero, v.loja, now(), true;
  else
    return query select v.status_entrega, v.numero, v.loja, v.entregue_em, false;
  end if;
end;
$$;

create or replace function public.desfazer_escaneio(venda uuid)
returns table (status_entrega text, numero integer, loja text, mudou boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v record;
begin
  if public.papel_atual() is distinct from 'motorista' then
    raise exception 'Só o motorista desfaz escaneio por aqui.';
  end if;

  select vd.id, vd.numero, vd.status_entrega, vd.grupo_entrega_id, l.nome as loja
    into v
    from public.vendas vd
    join public.funcionarios f on f.id = vd.motorista_id
    left join public.lojas l on l.id = vd.loja_id
   where vd.id = venda and f.usuario_id = auth.uid() and vd.status <> 'cancelado';

  if not found then
    raise exception 'Esta nota não está nas suas entregas.';
  end if;

  if v.status_entrega = 'entregue' then
    update public.vendas
       set status_entrega = 'em_rota', entregue_em = null
     where (id = v.id or (v.grupo_entrega_id is not null and grupo_entrega_id = v.grupo_entrega_id))
       and status_entrega = 'entregue';
    return query select 'em_rota'::text, v.numero, v.loja, true;
  elsif v.status_entrega = 'carregando' then
    update public.vendas
       set status_entrega = 'pendente'
     where (id = v.id or (v.grupo_entrega_id is not null and grupo_entrega_id = v.grupo_entrega_id))
       and status_entrega = 'carregando';
    return query select 'pendente'::text, v.numero, v.loja, true;
  else
    return query select v.status_entrega, v.numero, v.loja, false;
  end if;
end;
$$;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-39-viagem-rota.sql
-- ============================================================================
--  Migração 39 — 2ª viagem do mesmo veículo no mesmo dia
--
--  Até aqui, uma rota era identificada só por (veiculo_id, rota_data) — um
--  veículo só podia ter UMA rota aberta por dia. Isso trava o caso comum de
--  o mesmo caminhão sair de novo no mesmo dia (2ª carga, depois de
--  descarregar e voltar ao CD): a tela juntava a viagem nova com a antiga,
--  como se fossem uma coisa só.
--
--  `viagem_rota` (1, 2, 3...) desempata isso: cada viagem do mesmo veículo
--  no mesmo dia vira um card e um romaneio impresso separados, com o MESMO
--  motorista se for o caso — sem precisar trocar de veículo pra escalar
--  uma 2ª saída.
--
--  Como aplicar, NESTA ORDEM: depois de migracao-19-motorista.sql e da
--  migracao-38-desfazer-carregando.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

alter table public.vendas add column if not exists viagem_rota integer not null default 1;

create index if not exists vendas_rota_data_veiculo_viagem_idx
  on public.vendas (rota_data, veiculo_id, viagem_rota);

-- `minhas_entregas` ganha viagem_rota (pra "Minhas Entregas" não misturar a
-- 2ª viagem do dia com a 1ª) e veiculo_id (o app precisa do id, não só do
-- nome, pra saber PARA QUAL viagem chamar `iniciar_rota` — migracao-40). O
-- retorno mudou: o Postgres só troca as colunas de uma função recriando-a.
drop function if exists public.minhas_entregas(date);

create or replace function public.minhas_entregas(dia date)
returns table (
  id              uuid,
  prioridade      boolean,
  numero          integer,
  ordem_rota      integer,
  viagem_rota     integer,
  status_entrega  text,
  saida_cd_em     timestamptz,
  entregue_em     timestamptz,
  loja            text,
  rede            text,
  logradouro      text,
  numero_endereco text,
  complemento     text,
  bairro          text,
  cidade          text,
  uf              text,
  cep             text,
  veiculo         text,
  veiculo_id      uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, coalesce(v.prioridade, false), v.numero, v.ordem_rota, coalesce(v.viagem_rota, 1),
         v.status_entrega, v.saida_cd_em, v.entregue_em,
         l.nome, r.nome,
         l.logradouro, l.numero, l.complemento, l.bairro, l.cidade, l.uf, l.cep,
         ve.nome, v.veiculo_id
    from public.vendas v
    join public.funcionarios f on f.id = v.motorista_id
    left join public.lojas l     on l.id = v.loja_id
    left join public.redes r     on r.id = l.rede_id
    left join public.veiculos ve on ve.id = v.veiculo_id
   where f.usuario_id = auth.uid()
     and public.papel_atual() = 'motorista'
     and coalesce(v.rota_data, v.data) = dia
     and v.status <> 'cancelado'
   order by coalesce(v.prioridade, false) desc, coalesce(v.viagem_rota, 1), v.ordem_rota nulls last, v.numero;
$$;

revoke all on function public.minhas_entregas(date) from public, anon;
grant execute on function public.minhas_entregas(date) to authenticated;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-40-iniciar-rota-por-viagem.sql
-- ============================================================================
--  Migração 40 — "Iniciar rota" por veículo + viagem, não pelo dia inteiro
--
--  A migracao-37-iniciar-rota.sql criou `iniciar_rota(dia)`: só libera (e só
--  dispara) quando NENHUM pedido do motorista naquele dia ainda está
--  'pendente', e aí passa TODO pedido 'carregando' daquele dia para
--  'em_rota' de uma vez.
--
--  Isso quebra com a migracao-39-viagem-rota.sql (2ª viagem do mesmo
--  veículo no mesmo dia): se o motorista tem duas viagens abertas — mesmo
--  veículo (2ª carga) ou dois veículos —, carregar a viagem 1 inteira não
--  liberava "Iniciar rota" enquanto a viagem 2 tivesse algo pendente, e
--  apertar o botão iniciava as duas de uma vez, mesmo a que ainda não
--  tinha acabado de carregar.
--
--  Esta migração redefine `iniciar_rota` para receber também o veículo e a
--  viagem: `iniciar_rota(dia, veiculo, viagem)`. A checagem de pendentes e
--  a atualização em bloco passam a olhar só essa viagem específica — outras
--  viagens do mesmo motorista, no mesmo dia, ficam de fora.
--
--  A assinatura mudou (não é só o retorno): o Postgres não sobrescreve uma
--  função com parâmetros diferentes, então a antiga precisa ser apagada.
--
--  Como aplicar, NESTA ORDEM: depois de migracao-37-iniciar-rota.sql e
--  migracao-39-viagem-rota.sql. Rode junto com a versão do app que chama
--  `iniciar_rota` com os 3 argumentos — a versão antiga do app chama só com
--  `dia`, e vai parar de achar a função depois desta migração.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

drop function if exists public.iniciar_rota(date);

create or replace function public.iniciar_rota(dia date, veiculo uuid, viagem integer default 1)
returns table (iniciadas integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  pendentes integer;
  n integer;
begin
  if public.papel_atual() is distinct from 'motorista' then
    raise exception 'Só o motorista inicia a rota por aqui.';
  end if;

  select count(*) into pendentes
    from public.vendas vd
    join public.funcionarios f on f.id = vd.motorista_id
   where f.usuario_id = auth.uid()
     and coalesce(vd.rota_data, vd.data) = dia
     and vd.veiculo_id = veiculo
     and coalesce(vd.viagem_rota, 1) = viagem
     and vd.status <> 'cancelado'
     and vd.status_entrega = 'pendente';

  if pendentes > 0 then
    raise exception 'Ainda faltam % pedido(s) para carregar no caminhão.', pendentes;
  end if;

  update public.vendas vd
     set status_entrega = 'em_rota', saida_cd_em = now()
    from public.funcionarios f
   where f.id = vd.motorista_id
     and f.usuario_id = auth.uid()
     and coalesce(vd.rota_data, vd.data) = dia
     and vd.veiculo_id = veiculo
     and coalesce(vd.viagem_rota, 1) = viagem
     and vd.status <> 'cancelado'
     and vd.status_entrega = 'carregando';
  get diagnostics n = row_count;

  if n = 0 then
    raise exception 'Nenhum pedido carregado para iniciar a rota.';
  end if;

  return query select n;
end;
$$;

revoke all on function public.iniciar_rota(date, uuid, integer) from public, anon;
grant execute on function public.iniciar_rota(date, uuid, integer) to authenticated;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-41-notificacao-entrega.sql
-- ============================================================================
--  Migração 41 — aviso no celular a cada escaneio do romaneio (ntfy)
--
--  Mesma ideia da migracao-20 (pedido novo), agora para o escaneio do QR da
--  nota em "Minhas Entregas" (migracao-19) e para o botão "Iniciar rota"
--  (migracao-37):
--
--      Saiu para entrega — pedido nº 1234
--      PETROX — BARRA
--      Motorista: Fulano
--
--      Entrega realizada — pedido nº 1234
--      PETROX — BARRA
--      Motorista: Fulano
--
--  Esta função e este gatilho já estavam rodando direto no banco (criados
--  pelo SQL Editor, fora de qualquer migração) — este arquivo só traz o que
--  já existia para dentro do controle de versão, com o mesmo nome, para
--  `create or replace` não mudar nada de quem já rodou.
--
--  Com o fluxo em 4 passos da migracao-37 (pendente → carregando →
--  [Iniciar rota] → em_rota → entregue), esta função continua correta sem
--  precisar mudar nada: ela só olha o VALOR final de status_entrega —
--  "Saiu para entrega" quando vira `em_rota` (agora só pelo botão "Iniciar
--  rota", com a viagem inteira carregada) e "Entrega realizada" quando vira
--  `entregue`. O status intermediário `carregando` não avisa nada, o que
--  está certo: o caminhão ainda está no CD.
--
--  O bug de "entrega realizada" aparecendo ao escanear só o carregamento
--  (antes da migracao-37 existir) não estava aqui: a função sempre rotulou
--  certo, dado que o status mudava um passo de cada vez. O bug real era uma
--  corrida em src/pages/MinhasEntregas.jsx: ao tocar "Confirmar", a câmera
--  destravava e os botões liberavam ANTES da resposta do servidor chegar —
--  se o mesmo QR (ainda no quadro) fosse lido de novo nesse intervalo, o
--  servidor já podia estar num status mais adiantado. Hoje o próprio
--  `registrar_escaneio` (migracao-37) barra a releitura de um pedido já
--  "carregando" com um erro, e esta migração trava também a câmera e os
--  botões até a chamada ao servidor terminar — cinto e suspensório.
--
--  Só avisa o que chega pela API do app (tem JWT), igual à migracao-20: nada
--  do SQL Editor — reimportar planilha ou rodar correção não deve mandar
--  centenas de notificações.
--
--  Precisa da migracao-19-motorista (status_entrega, motorista_id) e da
--  migracao-20 (privado.enviar_ntfy) já aplicadas.
--
--  Idempotente: pode rodar de novo sem quebrar nada, mesmo em quem já tinha
--  a função e o gatilho criados manualmente — só padroniza o nome do gatilho.
-- ============================================================================

begin;

do $$
begin
  if to_regprocedure('privado.enviar_ntfy(text,text,text)') is null then
    raise exception 'Falta rodar supabase/migracao-20-notificacao-pedidos.sql antes desta.';
  end if;
end;
$$;

create or replace function privado.avisar_entrega_motorista()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  quem  text;
  loja  text;
begin
  if coalesce(current_setting('request.jwt.claims', true), '') = '' then
    return new;
  end if;
  if new.status_entrega = old.status_entrega then
    return new;
  end if;
  if new.status_entrega not in ('em_rota', 'entregue') then
    return new;
  end if;

  begin
    select f.nome into quem from public.funcionarios f where f.id = new.motorista_id;
    select r.nome || ' — ' || l.nome
      into loja
      from public.lojas l
      join public.redes r on r.id = l.rede_id
     where l.id = new.loja_id;

    perform privado.enviar_ntfy(
      case when new.status_entrega = 'em_rota' then 'Saiu para entrega' else 'Entrega realizada' end
        || coalesce(' — pedido nº ' || new.numero, ''),
      coalesce(loja, 'Loja não informada')
        || case when quem is not null then E'\nMotorista: ' || quem else '' end
    );
  exception when others then
    raise warning 'aviso de entrega do motorista falhou: %', sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function privado.avisar_entrega_motorista() from public, anon, authenticated;

-- Padroniza o nome do gatilho, qualquer que tenha sido o nome usado quando foi
-- criado à mão (procura pela função, não pelo nome do gatilho).
do $$
declare r record;
begin
  for r in
    select t.tgname
      from pg_trigger t
      join pg_proc p on p.oid = t.tgfoid
     where t.tgrelid = 'public.vendas'::regclass and p.proname = 'avisar_entrega_motorista'
  loop
    execute format('drop trigger %I on public.vendas', r.tgname);
  end loop;
end;
$$;

create trigger vendas_avisar_entrega_motorista
  after update on public.vendas
  for each row execute function privado.avisar_entrega_motorista();

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-41-emitir-nf.sql
-- ============================================================================
--  Migração 41 — Cliente que não quer NF, só recibo
--
--  Alguns clientes pedem para não emitir nota fiscal (preferem receber por
--  fora) mas continuam querendo um recibo de cada entrega, para conferência.
--  Até aqui só quem entrava na "nota semanal" (migracao-31-nota-semanal-rede)
--  ou num pedido todo bonificado tinha a opção de recibo sem NF-e — os demais
--  só emitiam NF-e, sem alternativa.
--
--  `emitir_nf` fica marcado em cada pedido (a pessoa decide na hora de
--  registrar a venda, não é um cadastro fixo da loja): true emite NF-e como
--  sempre, false esconde os botões de NF-e e libera o recibo, do mesmo jeito
--  que já acontecia com bonificação e nota semanal.
--
--  Como aplicar: depois de migracao-08-nfe.sql (usa nfe_status).
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

alter table public.vendas add column if not exists emitir_nf boolean not null default true;

commit;

-- Confira:  select emitir_nf, count(*) from public.vendas group by emitir_nf;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-42-arquivar-rota.sql
-- ============================================================================
--  Migração 42 — arquivar rota concluída
--
--  Na aba Romaneio, uma rota com tudo entregue não tinha como sair da tela —
--  ficava empilhando cards de rotas velhas junto com as de hoje. Esta
--  migração acrescenta `rota_arquivada`: marcado pelo botão "Arquivar rota"
--  (só aparece quando toda a viagem já está "entregue"), tira o card da tela
--  principal sem apagar nada — os pedidos continuam com seu histórico normal,
--  e dá pra desarquivar pelo card "Rotas arquivadas" que aparece embaixo.
--
--  Como aplicar, NESTA ORDEM: depois de migracao-41-emitir-nf.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

alter table public.vendas add column if not exists rota_arquivada boolean not null default false;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-43-observacao-nf.sql
-- ============================================================================
--  Migração 43 — Observação da NF-e no pedido
--
--  Campo livre preenchido na Nova Venda ("Observação (sai na NF-e)") que vai
--  para as "Informações complementares" da nota, antes do texto de isenção.
--  É diferente de `observacao` (migracao-21), que é o recado do cliente no
--  link e não sai na nota.
--
--  Como aplicar: depois de migracao-41-emitir-nf.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

alter table public.vendas add column if not exists observacao_nf text;

commit;

-- Confira:  select numero, observacao_nf from public.vendas where observacao_nf is not null;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-44-metas.sql
-- ============================================================================
--  Migração 44 — Metas (aba Metas, só do sócio master)
--
--  O sócio master define as metas da distribuidora por período — diária,
--  semanal, mensal e anual — para cada indicador:
--
--    faturamento  → R$ vendidos (sem bonificação, sem pedido cancelado)
--    kg_total     → quilos vendidos
--    kg_agranel   → quilos vendidos de produto agranel (por kg ou unidade)
--    kg_saco      → quilos vendidos em sacos
--    qtd_sacos    → quantidade de sacos vendidos
--
--  `fruta` vazia é a meta geral da distribuidora; preenchida, é a meta
--  daquela fruta. O realizado não é gravado: o app calcula em cima das
--  vendas, do mesmo jeito que o DRE.
--
--  Não há índice único em (periodo, indicador, fruta): dois aparelhos
--  offline podem gravar a mesma meta, e um conflito de chave travaria a fila
--  de sincronização. O app usa sempre a mais recente (atualizado_em).
--
--  Acesso: só o sócio master lê e grava — é quem define as metas.
--
--  Como aplicar: depois do auth.sql. Idempotente: pode rodar de novo.
-- ============================================================================

begin;

create table if not exists public.metas (
  id            uuid primary key default gen_random_uuid(),
  periodo       text not null check (periodo in ('diaria', 'semanal', 'mensal', 'anual')),
  indicador     text not null check (indicador in ('faturamento', 'kg_total', 'kg_agranel', 'kg_saco', 'qtd_sacos')),
  fruta         text,
  valor         numeric(14,2) not null default 0 check (valor >= 0),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists metas_periodo_idx on public.metas (periodo, indicador);

alter table public.metas enable row level security;

drop policy if exists acesso_app          on public.metas;
drop policy if exists metas_leitura       on public.metas;
drop policy if exists metas_insercao      on public.metas;
drop policy if exists metas_atualizacao   on public.metas;
drop policy if exists metas_exclusao      on public.metas;

do $$
begin
  if to_regprocedure('public.e_socio()') is not null then
    create policy metas_leitura on public.metas
      for select to authenticated using (public.e_socio());
    create policy metas_insercao on public.metas
      for insert to authenticated with check (public.e_socio());
    create policy metas_atualizacao on public.metas
      for update to authenticated using (public.e_socio()) with check (public.e_socio());
    create policy metas_exclusao on public.metas
      for delete to authenticated using (public.e_socio());

    revoke all on public.metas from anon;
    grant select, insert, update, delete on public.metas to authenticated;
  else
    -- Antes do auth.sql: aberta, como as outras tabelas nessa fase.
    create policy acesso_app on public.metas
      for all to anon, authenticated using (true) with check (true);
    grant select, insert, update, delete on public.metas to anon, authenticated;
  end if;
end;
$$;

commit;

-- Confira:  select periodo, indicador, coalesce(fruta, 'GERAL'), valor from public.metas order by 1, 3, 2;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-45-unidades-insumos.sql
-- ============================================================================
--  Migração 45 — unidades de compra dos insumos de produção
--
--  A migracao-31 cadastrou os insumos todos em "unidade". Não é assim que se
--  compra nem que se conta no depósito:
--
--    Redinha (os sacos)   rolo de 1.000 metros — 1 metro faz 3 sacos de
--                          2,5 kg, então 1 rolo ≈ 3.000 sacos de 2,5 kg
--    Grampo               milheiro (1.000 grampos)
--    Etiquetas            milheiro (1.000 etiquetas)
--
--  A contagem passa a ser registrada nessas unidades (aceita fração: meio
--  rolo = 0,5; 1.500 etiquetas = 1,5 milheiro). O app mostra ao lado quanto
--  isso rende em sacos / unidades.
--
--  Atenção: contagens já registradas antes desta migração continuam com o
--  número que foi digitado — se alguém lançou, por exemplo, 5000 grampos,
--  agora aparece como 5000 milheiros. Confira o histórico em Estoque →
--  Insumos de Produção e registre uma contagem nova nas unidades certas.
--
--  Só mexe nos itens que ainda estão em "unidade" — se a unidade já foi
--  trocada à mão, fica como está. Idempotente.
-- ============================================================================

begin;

update public.insumos_itens set unidade = 'rolo (1.000 m)'
 where nome = 'Redinha' and unidade = 'unidade';

update public.insumos_itens set unidade = 'milheiro'
 where (nome = 'Grampo' or nome like 'Etiqueta%') and unidade = 'unidade';

commit;

-- Confira:  select nome, unidade, estoque_minimo from public.insumos_itens order by ordem;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-46-continuar-rota.sql
-- ============================================================================
--  Migração 46 — continuar no dia seguinte uma rota que não terminou
--
--  Se o motorista não consegue entregar tudo no dia (loja fechada, tempo,
--  problema no caminhão), as paradas que sobraram ficavam presas no dia de
--  ontem: "Minhas Entregas" só mostra o dia escolhido, e o Romaneio de hoje
--  não enxergava nada. Esta migração cria duas funções para o motorista:
--
--    rotas_nao_concluidas(hoje)
--        as viagens dos 7 dias ANTERIORES a `hoje` com pedido ainda não entregue
--        (pendente, carregando ou em rota): dia, veículo, viagem, quantas
--        faltam e quantas tinha.
--
--    continuar_rota(dia, veiculo, viagem, hoje)
--        passa os pedidos NÃO entregues daquela viagem para `hoje` — numa
--        viagem nova do mesmo veículo (a próxima livre no dia, para não
--        misturar com o que já foi montado para hoje). Os entregues ficam no
--        dia original, como histórico. O status de cada pedido não muda: o
--        que já estava "em rota" continua em rota (é só ler o QR na loja); o
--        que estava pendente/carregando segue o fluxo normal de carregar e
--        "Iniciar rota".
--
--  `hoje` vem do app (a data no fuso do aparelho), não de current_date, que
--  no Supabase é UTC e vira o dia às 21h no Brasil.
--
--  O escritório faz o mesmo pelo Romaneio (botão "Continuar hoje"), que
--  grava direto em `vendas` como o resto da tela — não precisa desta função.
--
--  Como aplicar, NESTA ORDEM: depois de migracao-42-arquivar-rota.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

create or replace function public.rotas_nao_concluidas(hoje date)
returns table (
  dia        date,
  veiculo_id uuid,
  veiculo    text,
  viagem     integer,
  faltam     integer,
  total      integer
)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(v.rota_data, v.data), v.veiculo_id, ve.nome, coalesce(v.viagem_rota, 1),
         count(*) filter (where coalesce(v.status_entrega, 'pendente') not in ('entregue', 'retirado_cd'))::integer,
         count(*)::integer
    from public.vendas v
    join public.funcionarios f on f.id = v.motorista_id
    left join public.veiculos ve on ve.id = v.veiculo_id
   where f.usuario_id = auth.uid()
     and public.papel_atual() = 'motorista'
     and coalesce(v.rota_data, v.data) < hoje
     and coalesce(v.rota_data, v.data) >= hoje - 7
     and v.veiculo_id is not null
     and v.status <> 'cancelado'
   group by 1, 2, 3, 4
  having count(*) filter (where coalesce(v.status_entrega, 'pendente') not in ('entregue', 'retirado_cd')) > 0
   order by 1 desc, 4;
$$;

revoke all on function public.rotas_nao_concluidas(date) from public, anon;
grant execute on function public.rotas_nao_concluidas(date) to authenticated;

create or replace function public.continuar_rota(dia date, veiculo uuid, viagem integer, hoje date)
returns table (movidas integer, nova_viagem integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  proxima integer;
  n integer;
begin
  if public.papel_atual() is distinct from 'motorista' then
    raise exception 'Só o motorista continua a rota por aqui.';
  end if;
  if dia >= hoje then
    raise exception 'Só dá para continuar hoje uma rota de um dia anterior.';
  end if;

  -- Próxima viagem livre do veículo no dia de hoje (de qualquer motorista):
  -- o que sobrou vira uma viagem separada, sem se misturar com a que o
  -- escritório já montou para hoje.
  select coalesce(max(coalesce(vd.viagem_rota, 1)), 0) + 1 into proxima
    from public.vendas vd
   where vd.rota_data = hoje
     and vd.veiculo_id = veiculo
     and vd.status <> 'cancelado';

  update public.vendas vd
     set rota_data = hoje, viagem_rota = proxima, rota_arquivada = false
    from public.funcionarios f
   where f.id = vd.motorista_id
     and f.usuario_id = auth.uid()
     and coalesce(vd.rota_data, vd.data) = dia
     and vd.veiculo_id = veiculo
     and coalesce(vd.viagem_rota, 1) = viagem
     and vd.status <> 'cancelado'
     and coalesce(vd.status_entrega, 'pendente') not in ('entregue', 'retirado_cd');
  get diagnostics n = row_count;

  if n = 0 then
    raise exception 'Não sobrou nenhuma entrega nessa rota.';
  end if;

  return query select n, proxima;
end;
$$;

revoke all on function public.continuar_rota(date, uuid, integer, date) from public, anon;
grant execute on function public.continuar_rota(date, uuid, integer, date) to authenticated;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-47-metas-por-empresa.sql
-- ============================================================================
--  Migração 47 — Metas separadas por empresa (Carvalho Cruz e CVC)
--
--  A aba Metas passa a ter metas próprias para cada empresa: as da Carvalho
--  Cruz contam só as vendas dos produtos da Carvalho Cruz, e as da CVC, só as
--  dos produtos da CVC. Metas já gravadas (antes desta migração) ficam na
--  Carvalho Cruz.
--
--  Como aplicar: depois da migracao-44-metas.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

alter table public.metas
  add column if not exists empresa text not null default 'carvalho_cruz';

alter table public.metas drop constraint if exists metas_empresa_check;
alter table public.metas
  add constraint metas_empresa_check check (empresa in ('carvalho_cruz', 'cvc'));

drop index if exists public.metas_periodo_idx;
create index if not exists metas_empresa_periodo_idx on public.metas (empresa, periodo, indicador);

commit;

-- Confira:  select empresa, periodo, indicador, coalesce(fruta, 'GERAL'), valor from public.metas order by 1, 2, 4, 3;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-48-arquivar-rota-promotor.sql
-- ============================================================================
--  Migração 48 — arquivar rota de promotor concluída
--
--  Na aba Promotores, as rotas concluídas ficavam empilhadas junto com as do
--  dia (principalmente com "Todas as datas"). Esta migração acrescenta
--  `rotas_promotor.arquivada`: marcada pelo botão "Arquivar" (só aparece em
--  rota concluída), tira o card da lista principal sem apagar nada — paradas,
--  fotos e horários continuam guardados, e dá pra desarquivar pelo botão
--  "Rotas arquivadas" logo abaixo da lista.
--
--  Como aplicar: depois da migracao-08-promotores.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

alter table public.rotas_promotor add column if not exists arquivada boolean not null default false;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-49-codigo-produtos-proprios.sql
-- ============================================================================
--  Código (cProd) dos produtos de produção própria na NF-e
--
--  A NF-e 12 (Rede Mais, 25/09/2026) saiu com o id interno do produto como
--  código ("d1000000-0000-4000-8000-000000000001") e o sistema da Rede Mais
--  recusou por causa dos hífens. A emissão agora usa o `codigo` do cadastro;
--  estes 7 produtos ainda não tinham, então recebem o mesmo SKU que usavam
--  nas notas emitidas pelo Omie (scripts/gerar-cadastro-fiscal-produtos.py),
--  que o ERP dos clientes já conhece.
--
--  Idempotente: só preenche quem está sem código.
-- ============================================================================

begin;

update public.produtos p
   set codigo = v.codigo
  from (values
    ('d1000000-0000-4000-8000-000000000001'::uuid, 'PRD00001'),  -- Laranja Agranel
    ('d1000000-0000-4000-8000-000000000002'::uuid, 'PRD00005'),  -- Saco 2,5 kg
    ('d1000000-0000-4000-8000-000000000003'::uuid, 'PRD00004'),  -- Saco 3 kg
    ('d1000000-0000-4000-8000-000000000004'::uuid, 'PRD00002'),  -- Saco 5 kg
    ('d1000000-0000-4000-8000-000000000005'::uuid, 'PRD00007'),  -- Saco 10 kg
    ('d1000000-0000-4000-8000-000000000006'::uuid, 'PRD00003'),  -- Laranja Lima
    ('d1000000-0000-4000-8000-000000000007'::uuid, 'PRD00008')   -- Abóbora
  ) as v(id, codigo)
 where p.id = v.id
   and (p.codigo is null or trim(p.codigo) = '');

commit;

-- Confira:
--   select nome, codigo from public.produtos where empresa is distinct from 'cvc' order by nome;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-50-carta-correcao.sql
-- ============================================================================
--  Migração 50 — carta de correção (CC-e) na venda
--
--  As NF-e emitidas pela Spedy até 29/09/2026 saíram com o id interno do
--  produto no código (cProd) e o sistema de clientes como a Rede Mais
--  recusa. A correção é por CC-e (Notas Fiscais → Emitidas), e a venda
--  guarda quando foi enviada e o texto, para não mandar duas vezes.
--
--  Rode ANTES de publicar a versão do app com a carta de correção — sem as
--  colunas, as gravações de venda ficam presas na fila de Sincronização.
--
--  Idempotente.
-- ============================================================================

begin;

alter table public.vendas add column if not exists nfe_cce_em    timestamptz;
alter table public.vendas add column if not exists nfe_cce_texto text;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-51-carta-correcao-devolucao.sql
-- ============================================================================
--  Migração 51 — carta de correção (CC-e) nas notas de devolução
--
--  Mesmo problema da migracao-50: as notas de devolução emitidas pelo app até
--  29/09/2026 saíram com o id interno do produto no código (cProd). A nota
--  guarda quando a CC-e foi enviada e o texto (Notas Fiscais → Devoluções).
--
--  Rode ANTES de publicar a versão do app com a carta de correção nas
--  devoluções — sem as colunas, as gravações de notas de entrada ficam presas
--  na fila de Sincronização.
--
--  Idempotente.
-- ============================================================================

begin;

alter table public.notas_entrada add column if not exists nfe_cce_em    timestamptz;
alter table public.notas_entrada add column if not exists nfe_cce_texto text;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-52-nfe-arquivadas.sql
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


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-53-pedido-geral-todos-produtos.sql
-- ============================================================================
--  Migração 53 — link de pedido GERAL libera TODOS os produtos para TODAS as lojas
--
--  Até aqui o link geral respeitava a lista de produtos liberados de cada
--  rede/loja (migração 23). Para a equipe, que lança pedido de qualquer
--  cliente, isso atrapalhava: faltava fruta. Agora o link geral aceita
--  qualquer produto em qualquer loja. Os produtos que a loja já costuma pedir
--  (a lista liberada) continuam chegando em `produtoIds` — a página os mostra
--  primeiro, e os demais logo abaixo, com busca.
--
--  Os links da loja e da rede NÃO mudam: continuam só com o liberado.
--
--  Como: `pedido_cliente_permitidos` passa a devolver null (= todos) quando a
--  chamada vem de `pedido_geral_enviar`, que liga a marca `app.pedido_geral`
--  só dentro da transação. O resto da gravação (preço, kg, prazo, número)
--  segue igual. Idempotente. Nada é apagado.
-- ============================================================================

begin;

create or replace function public.pedido_cliente_permitidos(loja uuid)
returns uuid[]
language sql
stable
set search_path = public
as $$
  select case when coalesce(current_setting('app.pedido_geral', true), '') = 'on' then null
              else coalesce(lj.produtos_pedido, r.produtos_pedido) end
    from public.lojas lj
    join public.redes r on r.id = lj.rede_id
   where lj.id = pedido_cliente_permitidos.loja;
$$;

-- Abrir: `produtoIds` = os prioritários da loja; o último pedido vem completo.
create or replace function public.pedido_geral_abrir(token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  redes jsonb;
begin
  if not exists (select 1 from public.pedido_geral_config c where c.token_pedido = pedido_geral_abrir.token) then
    raise exception 'Link de pedido inválido ou desativado.' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id,
           'nome', r.nome,
           'lojas', x.lojas
         ) order by r.nome), '[]'::jsonb)
    into redes
    from public.redes r
    join lateral (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', lj.id,
               'nome', lj.nome,
               'produtoIds', to_jsonb(public.pedido_cliente_permitidos(lj.id)),
               'ultimoPedido', public.pedido_cliente_ultimo(lj.id, null)
             ) order by lj.nome), '[]'::jsonb) as lojas
        from public.lojas lj
       where lj.rede_id = r.id and lj.status = 'ativo'
    ) x on true
   where r.status = 'ativo' and jsonb_array_length(x.lojas) > 0;

  return jsonb_build_object('redes', redes, 'produtos', public.pedido_cliente_produtos(null));
end;
$$;

create or replace function public.pedido_geral_enviar(token text, pedidos jsonb, nome text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  ped jsonb;
  loja_id uuid;
  vistos uuid[] := '{}';
  feitos jsonb := '[]'::jsonb;
begin
  if not exists (select 1 from public.pedido_geral_config c where c.token_pedido = pedido_geral_enviar.token) then
    raise exception 'Link de pedido inválido ou desativado.' using errcode = 'P0002';
  end if;

  if jsonb_typeof(pedidos) is distinct from 'array' or jsonb_array_length(pedidos) = 0 then
    raise exception 'Nenhuma loja com pedido.';
  end if;
  if jsonb_array_length(pedidos) > 60 then
    raise exception 'Lojas demais num envio só.';
  end if;

  if (select count(*) from public.vendas v
       where v.origem = 'cliente'
         and v.criado_em > now() - interval '1 hour') + jsonb_array_length(pedidos) > 200 then
    raise exception 'Muitos pedidos em pouco tempo. Aguarde um pouco ou fale com a distribuidora.';
  end if;

  -- Só nesta transação: o link geral pode pedir qualquer produto.
  perform set_config('app.pedido_geral', 'on', true);

  for ped in select * from jsonb_array_elements(pedidos) loop
    select lj.id into loja_id
      from public.lojas lj
      join public.redes r on r.id = lj.rede_id
     where lj.id::text = ped ->> 'lojaId'
       and lj.status = 'ativo'
       and r.status = 'ativo';
    if not found then
      raise exception 'Loja não encontrada — recarregue a página.';
    end if;
    if loja_id = any(vistos) then
      raise exception 'Loja repetida no envio.';
    end if;
    vistos := vistos || loja_id;

    feitos := feitos || jsonb_build_array(
      public.pedido_cliente_gravar(loja_id, ped -> 'itens', ped ->> 'observacao', pedido_geral_enviar.nome));
  end loop;

  perform set_config('app.pedido_geral', 'off', true);
  return feitos;
end;
$$;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-54-comprovante-despesa.sql
-- ============================================================================
--  Migração 54 — comprovante de pagamento na despesa
--
--  Cada despesa pode levar o comprovante que o banco gerou (PDF ou foto):
--
--    despesas.comprovante_path   caminho do arquivo no bucket
--    despesas.comprovante_nome   nome original, para mostrar na lista
--
--  O arquivo vai para um bucket PRIVADO, "despesas-comprovantes". Só sócio
--  master e assistente administrativo (e_gestor) leem e gravam; a tela pede
--  um link temporário a cada abertura. Sem policy de update: o nome do arquivo
--  leva a hora, então corrigir é anexar outro. Apagar só vale para a pasta
--  caixa/ — os comprovantes que chegam pelo Atalho do iPhone (api/comprovante.js)
--  e ainda não viraram despesa (a tela só oferece descartar os que não estão em nenhuma).
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

alter table public.despesas add column if not exists comprovante_path text;
alter table public.despesas add column if not exists comprovante_nome text;

insert into storage.buckets (id, name, public)
values ('despesas-comprovantes', 'despesas-comprovantes', false)
on conflict (id) do nothing;

drop policy if exists despesas_comprovantes_leitura  on storage.objects;
drop policy if exists despesas_comprovantes_insercao on storage.objects;
drop policy if exists despesas_comprovantes_descarte  on storage.objects;

create policy despesas_comprovantes_leitura on storage.objects
  for select to authenticated
  using (bucket_id = 'despesas-comprovantes' and public.e_gestor());

create policy despesas_comprovantes_insercao on storage.objects
  for insert to authenticated
  with check (bucket_id = 'despesas-comprovantes' and public.e_gestor());

create policy despesas_comprovantes_descarte on storage.objects
  for delete to authenticated
  using (bucket_id = 'despesas-comprovantes' and (storage.foldername(name))[1] = 'caixa' and public.e_gestor());


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-55-avisos-celular.sql
-- ============================================================================
--  Migração 55 — avisos no celular (ntfy): conserto, painel e falta de pedido
--
--  POR QUE OS AVISOS PARARAM: no banco novo (instalar.sql), a configuração do
--  ntfy (privado.notificacao_pedidos) nasce SEM tópico — o tópico antigo
--  ficou no banco velho. Sem tópico, privado.enviar_ntfy sai calada, então
--  nenhum aviso sai: pedido novo, entrega, contagens e preços. E se o
--  pg_cron não estava ligado na hora da instalação, os lembretes agendados
--  ficaram sem agenda, também sem erro visível.
--
--  O que esta migração faz:
--    1. Refaz a base do aviso (pg_net, tabela de configuração, envio) sem
--       apagar um tópico já gravado.
--    2. Painel no app (Sincronização → Avisos no celular, só sócio master):
--       ver se está tudo ligado, gravar o tópico, mandar um teste e religar
--       os agendamentos — sem precisar do SQL Editor.
--    3. Aviso diário de FALTA DE PEDIDO (7h45, Aracaju): os clientes que
--       passaram do dia de sempre sem pedir e os esperados hoje. Mesma conta
--       da aba Previsão de Pedidos (src/lib/previsaoPedidos.js) — mudou lá,
--       mude aqui.
--    4. Lembretes que só tocam quando falta mesmo: a contagem de frutas não
--       avisa se já houve acerto hoje; a de insumos, se já houve contagem na
--       semana.
--    5. (Re)agenda todos os lembretes no pg_cron.
--    6. Avisos das rotas de entrega agrupados: um aviso por "Iniciar rota" e
--       por parada entregue (antes era um por pedido), e sem o "Saiu para
--       entrega" falso ao desfazer uma entrega.
--    7. Garante o tempo real da aba Promotores no banco novo.
--
--  Depois de rodar, no app: Sincronização → Avisos no celular → grave o
--  tópico → Enviar teste. Ou no SQL Editor:
--
--       select public.avisos_celular_configurar('carvalhocruz-pedidos-x7k2q9', 'https://seu-app.vercel.app/', true);
--       select privado.enviar_ntfy('Teste', 'Se chegou, está funcionando.');
--
--  Para testar o aviso de falta de pedido sem esperar as 7h45:
--       select privado.avisar_falta_pedidos();
--       select * from privado.previsao_pedidos();
--
--  Depois da migracao-20 (ou do instalar.sql) e do auth.sql.
--  Idempotente: pode rodar de novo sem duplicar nada nem apagar o tópico.
-- ============================================================================

begin;

create extension if not exists pg_net;

create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;

create table if not exists privado.notificacao_pedidos (
  id        integer primary key default 1 check (id = 1),
  ativo     boolean not null default true,
  servidor  text    not null default 'https://ntfy.sh',
  topico    text,
  url_app   text
);

insert into privado.notificacao_pedidos (id) values (1) on conflict (id) do nothing;

alter table privado.notificacao_pedidos enable row level security;
revoke all on privado.notificacao_pedidos from public, anon, authenticated;

-- Igual à da migracao-20 (mesma assinatura — gatilhos e lembretes chamam esta).
create or replace function privado.enviar_ntfy(titulo text, mensagem text, clique text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg privado.notificacao_pedidos;
  corpo jsonb;
begin
  select * into cfg from privado.notificacao_pedidos where id = 1;
  if cfg is null or not cfg.ativo or coalesce(trim(cfg.topico), '') = '' then
    return;
  end if;

  corpo := jsonb_build_object(
    'topic',   trim(cfg.topico),
    'title',   titulo,
    'message', mensagem,
    'tags',    jsonb_build_array('package')
  );
  if coalesce(clique, cfg.url_app) is not null then
    corpo := corpo || jsonb_build_object('click', coalesce(clique, cfg.url_app));
  end if;

  perform net.http_post(
    url     := rtrim(cfg.servidor, '/') || '/',
    body    := corpo,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
end;
$$;

revoke all on function privado.enviar_ntfy(text, text, text) from public, anon, authenticated;

-- Endereço do app com uma aba aberta (?aba=previsao), para o toque no aviso.
create or replace function privado.link_do_app(aba text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when coalesce(trim(url_app), '') = '' then null
    when url_app like '%?%' then url_app || '&aba=' || aba
    else url_app || '?aba=' || aba
  end
  from privado.notificacao_pedidos where id = 1;
$$;

revoke all on function privado.link_do_app(text) from public, anon, authenticated;

-- Hoje em Aracaju (UTC-3 o ano todo): o banco roda em UTC, e às 22h de
-- Aracaju o UTC já está no dia seguinte.
create or replace function privado.hoje_aracaju()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'America/Maceio')::date; $$;

-- ─── Previsão de pedidos ────────────────────────────────────────────────────
--
-- Espelho de src/lib/previsaoPedidos.js. Por loja ativa: os dias com pedido
-- (não cancelado) dos últimos 120 dias, somados por dia; dos 10 mais
-- recentes sai o intervalo típico (mediana) e os dias fixos da semana (os
-- que se repetem 2+ vezes e cobrem 75% dos pedidos, até 3 dias, ciclo de
-- até 16 dias). O próximo esperado parte do ÚLTIMO pedido — por isso pedido
-- antecipado (ou já lançado para frente) não gera alerta.

create or replace function privado.previsao_pedidos(p_hoje date default null)
returns table (
  loja_id      uuid,
  cliente      text,
  padrao       text,
  ultimo       date,
  esperado     date,
  atraso       integer,
  situacao     text,
  valor_tipico numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  hoje      date := coalesce(p_hoje, privado.hoje_aracaju());
  dias_nome text[] := array['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
  dias_abrev text[] := array['dom','seg','ter','qua','qui','sex','sáb'];
  l         record;
  datas     date[];
  totais    numeric[];
  n         integer;
  cad       numeric;
  contagem  integer[];
  fixos     integer[];
  cobertos  integer;
  d         date;
  folga     integer;
  sem       integer;
  i         integer;
begin
  for l in
    select lo.id, r.nome || ' · ' || lo.nome as nome
      from public.lojas lo
      join public.redes r on r.id = lo.rede_id
     where coalesce(lo.status, 'ativo') <> 'inativo'
       and coalesce(r.status, 'ativo') <> 'inativo'
  loop
    select array_agg(x.data order by x.data), array_agg(x.total order by x.data)
      into datas, totais
      from (
        select v.data, sum(coalesce(v.total, 0)) as total
          from public.vendas v
         where v.loja_id = l.id
           and v.status <> 'cancelado'
           and v.data >= hoje - 120
         group by v.data
         order by v.data desc
         limit 10
      ) x;

    n := coalesce(array_length(datas, 1), 0);
    continue when n < 3;

    select percentile_cont(0.5) within group (order by g)
      into cad
      from (select datas[k + 1] - datas[k] as g from generate_series(1, n - 1) k) s;
    continue when cad is null or cad <= 0;

    -- Dias fixos da semana.
    fixos := '{}';
    if cad <= 16 then
      contagem := array[0,0,0,0,0,0,0];
      for i in 1..n loop
        contagem[extract(dow from datas[i])::int + 1] := contagem[extract(dow from datas[i])::int + 1] + 1;
      end loop;
      cobertos := 0;
      for i in 0..6 loop
        if contagem[i + 1] >= 2 then
          fixos := fixos || i;
          cobertos := cobertos + contagem[i + 1];
        end if;
      end loop;
      if cardinality(fixos) > 3 or cobertos::numeric / n < 0.75 then
        fixos := '{}';
      end if;
    end if;

    ultimo := datas[n];
    if cardinality(fixos) = 0 then
      esperado := ultimo + greatest(1, round(cad))::int;
      folga := greatest(0, round(cad * 0.25)::int - 1);
    else
      d := ultimo + greatest(1, ceil(cad * 0.6))::int;
      for i in 1..7 loop
        exit when extract(dow from d)::int = any (fixos);
        d := d + 1;
      end loop;
      esperado := d;
      folga := 0;
    end if;

    atraso := hoje - esperado;
    sem := greatest(0, hoje - ultimo);
    situacao := case
      when ultimo > hoje then 'lancado'
      when sem > greatest(45, cad * 4) then 'parado'
      when atraso > folga then 'atrasado'
      when atraso >= 0 then 'hoje'
      else 'em_dia'
    end;

    padrao := case
      when cardinality(fixos) = 1 and cad >= 12 then 'a cada 2 semanas, ' || dias_nome[fixos[1] + 1]
      when cardinality(fixos) = 1 then case when fixos[1] in (0, 6) then 'todo ' else 'toda ' end || dias_nome[fixos[1] + 1]
      when cardinality(fixos) > 1 then (select string_agg(dias_abrev[f + 1], ' e ' order by f) from unnest(fixos) f)
      when round(cad) <= 1 then 'todo dia'
      else 'a cada ~' || round(cad)::int || ' dias'
    end;

    select percentile_cont(0.5) within group (order by t)
      into valor_tipico
      from unnest(totais[greatest(1, n - 4):n]) t;

    loja_id := l.id;
    cliente := l.nome;
    return next;
  end loop;
end;
$$;

revoke all on function privado.previsao_pedidos(date) from public, anon, authenticated;

-- ─── Aviso diário de falta de pedido ────────────────────────────────────────

create or replace function privado.avisar_falta_pedidos()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  abrev    text[] := array['dom','seg','ter','qua','qui','sex','sáb'];
  atrasados text;
  hoje_txt  text;
  n_atr    integer;
  n_hoje   integer;
  texto    text;
  brl      text := 'FM999G999G990';
begin
  with p as (select * from privado.previsao_pedidos())
  select
    (select count(*) from p where situacao = 'atrasado'),
    (select count(*) from p where situacao = 'hoje'),
    (select string_agg(
        '• ' || cliente || ' — ' || padrao || ', esperado ' || abrev[extract(dow from esperado)::int + 1]
        || ' ' || to_char(esperado, 'DD/MM') || ' (' || atraso || case when atraso = 1 then ' dia' else ' dias' end
        || ') · R$ ' || translate(to_char(valor_tipico, brl), ',', '.'),
        E'\n' order by valor_tipico desc)
       from (select * from p where situacao = 'atrasado' order by valor_tipico desc limit 15) a),
    (select string_agg(
        '• ' || cliente || ' — ' || padrao || ' · R$ ' || translate(to_char(valor_tipico, brl), ',', '.'),
        E'\n' order by valor_tipico desc)
       from (select * from p where situacao = 'hoje' order by valor_tipico desc limit 15) h)
  into n_atr, n_hoje, atrasados, hoje_txt;

  if n_atr = 0 and n_hoje = 0 then
    return;
  end if;

  texto := concat_ws(E'\n\n',
    case when n_atr > 0 then 'Não pediram no dia de sempre:' || E'\n' || atrasados
      || case when n_atr > 15 then E'\n… e mais ' || (n_atr - 15) else '' end end,
    case when n_hoje > 0 then 'Esperados hoje, ainda sem pedido:' || E'\n' || hoje_txt
      || case when n_hoje > 15 then E'\n… e mais ' || (n_hoje - 15) else '' end end
  );

  perform privado.enviar_ntfy(
    'Falta de pedido — ' || case
      when n_atr > 0 then n_atr || case when n_atr = 1 then ' cliente não pediu' else ' clientes não pediram' end
      else n_hoje || case when n_hoje = 1 then ' esperado hoje' else ' esperados hoje' end
    end,
    texto,
    privado.link_do_app('previsao')
  );
exception when others then
  raise warning 'aviso de falta de pedido falhou: %', sqlerrm;
end;
$$;

revoke all on function privado.avisar_falta_pedidos() from public, anon, authenticated;

-- ─── Lembretes que só tocam quando falta ────────────────────────────────────

create or replace function privado.lembrar_contagem_frutas()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Já contou hoje (acerto registrado): nada a lembrar.
  if exists (select 1 from public.acertos where data = privado.hoje_aracaju()) then
    return;
  end if;
  perform privado.enviar_ntfy(
    'Contagem de estoque — frutas',
    'Confira o depósito e registre o acerto de inventário de cada fruta em Estoque.',
    privado.link_do_app('estoque')
  );
exception when others then
  raise warning 'lembrete de contagem de frutas falhou: %', sqlerrm;
end;
$$;

revoke all on function privado.lembrar_contagem_frutas() from public, anon, authenticated;

create or replace function privado.lembrar_contagem_insumos()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  segunda date := date_trunc('week', privado.hoje_aracaju())::date;
begin
  -- Já contou nesta semana (desde segunda): nada a lembrar.
  if to_regclass('public.contagens_insumos') is not null
     and exists (select 1 from public.contagens_insumos where data >= segunda) then
    return;
  end if;
  perform privado.enviar_ntfy(
    'Contagem de insumos',
    'Hora de contar redinha, grampo e etiquetas — registre em Estoque.',
    privado.link_do_app('estoque')
  );
exception when others then
  raise warning 'lembrete de contagem de insumos falhou: %', sqlerrm;
end;
$$;

revoke all on function privado.lembrar_contagem_insumos() from public, anon, authenticated;

create or replace function privado.lembrar_preco_frutas()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform privado.enviar_ntfy(
    'Conferência de preços — frutas e sacos',
    'Confirme ou ajuste o preço de cada fruta e de cada saco desta semana, em Estoque.',
    privado.link_do_app('estoque')
  );
exception when others then
  raise warning 'lembrete de preço de frutas falhou: %', sqlerrm;
end;
$$;

revoke all on function privado.lembrar_preco_frutas() from public, anon, authenticated;

-- ─── Agendamentos ───────────────────────────────────────────────────────────
--
-- Horários em UTC (pg_cron do Supabase roda em UTC; Aracaju é UTC-3 o ano
-- todo, sem horário de verão). Devolve o que ficou agendado — ou o motivo de
-- não ter dado.

create or replace function privado.agendar_avisos()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  j record;
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    return 'pg_cron indisponível (' || sqlerrm || '). Ligue em Database → Extensions → pg_cron no painel do Supabase e tente de novo.';
  end;

  for j in
    select * from (values
      ('lembrete-contagem-insumos', '0 19 * * 1',   'select privado.lembrar_contagem_insumos();'),  -- seg 16h
      ('lembrete-contagem-frutas',  '30 19 * * *',  'select privado.lembrar_contagem_frutas();'),   -- todo dia 16h30
      ('lembrete-preco-frutas',     '0 10 * * 1',   'select privado.lembrar_preco_frutas();'),      -- seg 7h
      ('aviso-falta-pedidos',       '45 10 * * *',  'select privado.avisar_falta_pedidos();')       -- todo dia 7h45
    ) as t(nome, agenda, comando)
  loop
    execute 'select cron.unschedule(jobid) from cron.job where jobname = $1' using j.nome;
    execute 'select cron.schedule($1, $2, $3)' using j.nome, j.agenda, j.comando;
  end loop;

  return 'ok';
end;
$$;

revoke all on function privado.agendar_avisos() from public, anon, authenticated;

commit;

-- ─── Avisos das rotas de entrega, agrupados ─────────────────────────────────
--
-- Substitui o gatilho por linha da migracao-41, que tinha dois defeitos:
--   - "Desfazer escaneio" de uma entrega (entregue → em_rota, migracao-38)
--     mandava um "Saiu para entrega" falso;
--   - "Iniciar rota" manda o caminhão inteiro para em_rota num UPDATE só, e
--     saía UMA notificação por pedido (15 pedidos = 15 avisos de uma vez, o
--     que também estoura o limite do ntfy.sh e faz avisos seguintes sumirem).
-- Agora o gatilho é por comando: cada "Iniciar rota" vira um aviso só, com
-- as lojas da viagem; cada parada entregue (com os pedidos mesclados dela,
-- migracao-39) também. Só avisa a ida pendente/carregando → em_rota e
-- em_rota → entregue — voltar um passo não avisa nada.

begin;

create or replace function privado.avisar_entrega_motorista_lote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  g        record;
  titulo   text;
  corpo    text;
begin
  -- Só o que vem pela API do app (tem JWT), como na migracao-20.
  if coalesce(current_setting('request.jwt.claims', true), '') = '' then
    return null;
  end if;

  for g in
    select n.status_entrega as st,
           n.motorista_id,
           n.veiculo_id,
           coalesce(n.viagem_rota, 1) as viagem,
           count(*) as qtd,
           string_agg(coalesce(r.nome || ' — ' || l.nome, 'Loja não informada')
                      || coalesce(' (nº ' || n.numero || ')', ''), E'\n• ' order by r.nome, l.nome) as lojas,
           string_agg(n.numero::text, ', ' order by n.numero) as numeros
      from novos n
      join antigos o on o.id = n.id
      left join public.lojas l on l.id = n.loja_id
      left join public.redes r on r.id = l.rede_id
     where (n.status_entrega = 'em_rota' and coalesce(o.status_entrega, 'pendente') in ('pendente', 'carregando'))
        or (n.status_entrega = 'entregue' and o.status_entrega = 'em_rota')
     group by 1, 2, 3, 4
  loop
    begin
      corpo := concat_ws(E'\n',
        (select 'Motorista: ' || f.nome from public.funcionarios f where f.id = g.motorista_id),
        (select 'Veículo: ' || v.nome || case when g.viagem > 1 then ' (' || g.viagem || 'ª viagem)' else '' end
           from public.veiculos v where v.id = g.veiculo_id)
      );
      if g.st = 'em_rota' then
        titulo := 'Saiu para entrega — ' || g.qtd || case when g.qtd = 1 then ' pedido' else ' pedidos' end;
        corpo := concat_ws(E'\n', nullif(corpo, ''), '• ' || g.lojas);
      else
        titulo := 'Entrega realizada' || coalesce(' — pedido nº ' || g.numeros, '');
        corpo := concat_ws(E'\n', replace(g.lojas, E'\n• ', E'\n'), nullif(corpo, ''));
      end if;
      perform privado.enviar_ntfy(titulo, corpo, privado.link_do_app('romaneio'));
    exception when others then
      raise warning 'aviso de entrega falhou: %', sqlerrm;
    end;
  end loop;

  return null;
end;
$$;

revoke all on function privado.avisar_entrega_motorista_lote() from public, anon, authenticated;

-- Tira o gatilho por linha (qualquer nome que tenha) e põe o por comando.
do $$
declare r record;
begin
  for r in
    select t.tgname
      from pg_trigger t
      join pg_proc p on p.oid = t.tgfoid
     where t.tgrelid = 'public.vendas'::regclass
       and p.proname in ('avisar_entrega_motorista', 'avisar_entrega_motorista_lote')
  loop
    execute format('drop trigger %I on public.vendas', r.tgname);
  end loop;
end;
$$;

create trigger vendas_avisar_entrega_motorista
  after update on public.vendas
  referencing old table as antigos new table as novos
  for each statement execute function privado.avisar_entrega_motorista_lote();

commit;

-- ─── Promotores: tela do gestor em tempo real ───────────────────────────────
--
-- A aba Promotores anda sozinha pelo Realtime do Supabase. No banco novo,
-- garante que as duas tabelas estão na publicação (a migracao-08 só põe se
-- a publicação já existir na hora).

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Publicação supabase_realtime não existe — a aba Promotores não vai atualizar sozinha.';
    return;
  end if;
  if to_regclass('public.rotas_promotor') is not null and not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rotas_promotor'
  ) then
    alter publication supabase_realtime add table public.rotas_promotor;
  end if;
  if to_regclass('public.paradas_rota') is not null and not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'paradas_rota'
  ) then
    alter publication supabase_realtime add table public.paradas_rota;
  end if;
end;
$$;

-- ─── Painel no app (só sócio master) ────────────────────────────────────────

create or replace function public.avisos_celular_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg      privado.notificacao_pedidos;
  resposta jsonb;
  jobs     jsonb := '[]'::jsonb;
  envios   jsonb := '[]'::jsonb;
  tem_cron boolean := exists (select 1 from pg_extension where extname = 'pg_cron');
  tem_bucket boolean := false;
begin
  if not public.e_socio() then
    raise exception 'Só o sócio master mexe nos avisos do celular.';
  end if;

  select * into cfg from privado.notificacao_pedidos where id = 1;

  if tem_cron then
    begin
      execute $q$
        select coalesce(jsonb_agg(jsonb_build_object(
                 'nome', j.jobname, 'agenda', j.schedule, 'ativo', j.active,
                 'ultima', r.start_time, 'status', r.status, 'erro', r.return_message
               ) order by j.jobname), '[]'::jsonb)
          from cron.job j
          left join lateral (
            select d.start_time, d.status, d.return_message
              from cron.job_run_details d
             where d.jobid = j.jobid
             order by d.start_time desc
             limit 1
          ) r on true
         where j.jobname in ('lembrete-contagem-insumos', 'lembrete-contagem-frutas',
                             'lembrete-preco-frutas', 'aviso-falta-pedidos')
      $q$ into jobs;
    exception when others then
      jobs := '[]'::jsonb;
    end;
  end if;

  -- Últimas respostas do ntfy (o pg_net guarda por algumas horas).
  begin
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object(
               'quando', x.created, 'codigo', x.status_code, 'erro', x.error_msg
             ) order by x.created desc), '[]'::jsonb)
        from (select created, status_code, error_msg from net._http_response order by created desc limit 5) x
    $q$ into envios;
  exception when others then
    envios := '[]'::jsonb;
  end;

  begin
    execute $q$select exists (select 1 from storage.buckets where id = 'promotores-fotos')$q$ into tem_bucket;
  exception when others then
    tem_bucket := false;
  end;

  resposta := jsonb_build_object(
    'gatilho_pedido', exists (select 1 from pg_trigger where tgrelid = 'public.vendas'::regclass and tgname = 'vendas_avisar_pedido_novo' and tgenabled <> 'D'),
    'gatilho_entrega', exists (select 1 from pg_trigger where tgrelid = 'public.vendas'::regclass and tgname = 'vendas_avisar_entrega_motorista' and tgenabled <> 'D'),
    'tempo_real_promotores', (select count(*) = 2 from pg_publication_tables
                               where pubname = 'supabase_realtime' and schemaname = 'public'
                                 and tablename in ('rotas_promotor', 'paradas_rota')),
    'fotos_promotores', tem_bucket,
    'ativo',    coalesce(cfg.ativo, false),
    'servidor', cfg.servidor,
    'topico',   cfg.topico,
    'url_app',  cfg.url_app,
    'pg_net',   exists (select 1 from pg_extension where extname = 'pg_net'),
    'pg_cron',  tem_cron,
    'jobs',     jobs,
    'envios',   envios
  );
  return resposta;
end;
$$;

create or replace function public.avisos_celular_configurar(p_topico text, p_url_app text default null, p_ativo boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_topico text := nullif(trim(p_topico), '');
begin
  if not public.e_socio() then
    raise exception 'Só o sócio master mexe nos avisos do celular.';
  end if;
  if v_topico is not null and v_topico !~ '^[A-Za-z0-9_-]{1,64}$' then
    raise exception 'Tópico inválido: use só letras, números, - e _ (sem espaço nem acento).';
  end if;

  update privado.notificacao_pedidos
     set topico  = v_topico,
         url_app = nullif(trim(p_url_app), ''),
         ativo   = coalesce(p_ativo, true)
   where id = 1;

  return public.avisos_celular_status();
end;
$$;

create or replace function public.avisos_celular_testar()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.e_socio() then
    raise exception 'Só o sócio master mexe nos avisos do celular.';
  end if;
  perform privado.enviar_ntfy('Teste — Carvalho Cruz', 'Se chegou, os avisos no celular estão funcionando.');
end;
$$;

create or replace function public.avisos_celular_testar_falta_pedidos()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.e_socio() then
    raise exception 'Só o sócio master mexe nos avisos do celular.';
  end if;
  perform privado.avisar_falta_pedidos();
end;
$$;

create or replace function public.avisos_celular_agendar()
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.e_socio() then
    raise exception 'Só o sócio master mexe nos avisos do celular.';
  end if;
  return privado.agendar_avisos();
end;
$$;

revoke all on function public.avisos_celular_status() from public, anon;
revoke all on function public.avisos_celular_configurar(text, text, boolean) from public, anon;
revoke all on function public.avisos_celular_testar() from public, anon;
revoke all on function public.avisos_celular_testar_falta_pedidos() from public, anon;
revoke all on function public.avisos_celular_agendar() from public, anon;
grant execute on function public.avisos_celular_status() to authenticated;
grant execute on function public.avisos_celular_configurar(text, text, boolean) to authenticated;
grant execute on function public.avisos_celular_testar() to authenticated;
grant execute on function public.avisos_celular_testar_falta_pedidos() to authenticated;
grant execute on function public.avisos_celular_agendar() to authenticated;

-- ─── Liga os agendamentos agora ─────────────────────────────────────────────

do $$
declare r text;
begin
  r := privado.agendar_avisos();
  if r = 'ok' then
    raise notice 'Avisos agendados: falta de pedido (todo dia 7h45), contagem de frutas (todo dia 16h30), insumos (seg 16h) e preços (seg 7h), horário de Aracaju.';
  else
    raise notice '%', r;
  end if;
  if not exists (select 1 from privado.notificacao_pedidos where id = 1 and coalesce(trim(topico), '') <> '') then
    raise notice 'ATENÇÃO: nenhum tópico do ntfy gravado — nenhum aviso sai até gravar. No app: Sincronização → Avisos no celular.';
  end if;
end;
$$;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-56-sinalizacoes-clientes.sql
-- ============================================================================
--  Migração 56 — sinalizações nos alertas da Previsão de Pedidos
--
--  Quem cuida dos clientes marca o alerta de falta de pedido:
--
--    lembrar → "me lembre em DD/MM": o alerta some até o dia e volta nele
--              como lembrete, com o motivo;
--    ciente  → "já sei": some até o próximo pedido do cliente;
--    parou   → "parou de pedir", com o motivo: sai do alerta diário e vai
--              para a lista de Reconquistar; com data, vira alerta de
--              reconquista nesse dia.
--
--  Vale a sinalização mais recente da loja enquanto não for encerrada
--  (encerrada_em) e o cliente não pedir de novo — pedido com data depois de
--  `ultimo_pedido` (o último que ele tinha quando foi sinalizado) encerra
--  sozinho. Nada é apagado: fica o histórico de cada cliente.
--
--  O aviso diário no celular (migracao-55) passa a respeitar isso: não
--  repete quem foi sinalizado e traz os lembretes e reconquistas do dia.
--  Mesma regra de src/lib/previsaoPedidos.js (painelDePedidos) — mudou lá,
--  mude aqui.
--
--  Rode antes de publicar a versão do app que traz as sinalizações — sem a
--  tabela, elas ficam presas na fila de Sincronização. Depois do auth.sql e
--  da migracao-55. Idempotente.
-- ============================================================================

begin;

create table if not exists public.sinalizacoes_clientes (
  id             uuid primary key default gen_random_uuid(),
  loja_id        uuid not null references public.lojas (id) on delete cascade,
  tipo           text not null check (tipo in ('lembrar', 'ciente', 'parou')),
  data           date,
  motivo         text,
  ultimo_pedido  date,
  autor          text,
  encerrada_em   timestamptz,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists sinalizacoes_clientes_loja_idx on public.sinalizacoes_clientes (loja_id, criado_em desc);

alter table public.sinalizacoes_clientes enable row level security;

drop policy if exists acesso_app                     on public.sinalizacoes_clientes;
drop policy if exists sinalizacoes_leitura           on public.sinalizacoes_clientes;
drop policy if exists sinalizacoes_insercao          on public.sinalizacoes_clientes;
drop policy if exists sinalizacoes_atualizacao       on public.sinalizacoes_clientes;
drop policy if exists sinalizacoes_exclusao          on public.sinalizacoes_clientes;

do $$
begin
  if to_regprocedure('public.e_gestor()') is not null then
    create policy sinalizacoes_leitura on public.sinalizacoes_clientes
      for select to authenticated using (public.e_gestor());
    create policy sinalizacoes_insercao on public.sinalizacoes_clientes
      for insert to authenticated with check (public.e_gestor());
    create policy sinalizacoes_atualizacao on public.sinalizacoes_clientes
      for update to authenticated using (public.e_gestor()) with check (public.e_gestor());
    if to_regprocedure('public.pode_excluir_registros()') is not null then
      create policy sinalizacoes_exclusao on public.sinalizacoes_clientes
        for delete to authenticated using (public.pode_excluir_registros());
    else
      create policy sinalizacoes_exclusao on public.sinalizacoes_clientes
        for delete to authenticated using (public.e_socio());
    end if;

    revoke all on public.sinalizacoes_clientes from anon;
    grant select, insert, update, delete on public.sinalizacoes_clientes to authenticated;
  else
    create policy acesso_app on public.sinalizacoes_clientes
      for all to anon, authenticated using (true) with check (true);
    grant select, insert, update, delete on public.sinalizacoes_clientes to anon, authenticated;
  end if;
end;
$$;

commit;

-- ─── Aviso diário no celular, respeitando as sinalizações ──────────────────

do $outer$
begin
  if to_regprocedure('privado.previsao_pedidos(date)') is null then
    raise notice 'privado.previsao_pedidos não existe — rode a migracao-55-avisos-celular.sql e depois esta de novo para o aviso no celular respeitar as sinalizações.';
    return;
  end if;

  -- As sinalizações em vigor hoje.
  create or replace function privado.sinalizacoes_ativas()
  returns table (loja_id uuid, tipo text, data date, motivo text, cliente text)
  language sql
  stable
  security definer
  set search_path = ''
  as $f$
    with recente as (
      select distinct on (s.loja_id) s.*
        from public.sinalizacoes_clientes s
       order by s.loja_id, s.criado_em desc
    ),
    ultimo as (
      select v.loja_id, max(v.data) as data
        from public.vendas v
       where v.status <> 'cancelado' and v.loja_id is not null
       group by v.loja_id
    )
    select r.loja_id, r.tipo, r.data, r.motivo,
           coalesce(rd.nome || ' · ' || l.nome, l.nome, 'Cliente')
      from recente r
      left join ultimo u on u.loja_id = r.loja_id
      left join public.lojas l on l.id = r.loja_id
      left join public.redes rd on rd.id = l.rede_id
     where r.encerrada_em is null
       and not (u.data is not null and (r.ultimo_pedido is null or u.data > r.ultimo_pedido));
  $f$;

  revoke all on function privado.sinalizacoes_ativas() from public, anon, authenticated;

  create or replace function privado.avisar_falta_pedidos()
  returns void
  language plpgsql
  security definer
  set search_path = ''
  as $f$
  declare
    abrev      text[] := array['dom','seg','ter','qua','qui','sex','sáb'];
    hoje       date := privado.hoje_aracaju();
    brl        text := 'FM999G999G990';
    n_rec      integer;
    n_lem      integer;
    n_atr      integer;
    n_hoje     integer;
    t_rec      text;
    t_lem      text;
    t_atr      text;
    t_hoje     text;
    titulo     text;
  begin
    create temp table if not exists _sinais on commit drop as select * from privado.sinalizacoes_ativas();
    create temp table if not exists _prev on commit drop as
      select p.* from privado.previsao_pedidos() p
       where not exists (select 1 from _sinais s where s.loja_id = p.loja_id);

    select count(*), string_agg('• ' || cliente || coalesce(' — ' || nullif(trim(motivo), ''), ''), E'\n' order by cliente)
      into n_rec, t_rec
      from _sinais where tipo = 'parou' and data <= hoje;

    select count(*), string_agg('• ' || cliente || coalesce(' — ' || nullif(trim(motivo), ''), ''), E'\n' order by cliente)
      into n_lem, t_lem
      from _sinais where tipo = 'lembrar' and data <= hoje;

    select count(*) into n_atr from _prev where situacao = 'atrasado';
    select count(*) into n_hoje from _prev where situacao = 'hoje';

    select string_agg(
             '• ' || cliente || ' — ' || padrao || ', esperado ' || abrev[extract(dow from esperado)::int + 1]
             || ' ' || to_char(esperado, 'DD/MM') || ' (' || atraso || case when atraso = 1 then ' dia' else ' dias' end
             || ') · R$ ' || translate(to_char(valor_tipico, brl), ',', '.'),
             E'\n' order by valor_tipico desc)
      into t_atr
      from (select * from _prev where situacao = 'atrasado' order by valor_tipico desc limit 15) a;

    select string_agg('• ' || cliente || ' — ' || padrao || ' · R$ ' || translate(to_char(valor_tipico, brl), ',', '.'),
             E'\n' order by valor_tipico desc)
      into t_hoje
      from (select * from _prev where situacao = 'hoje' order by valor_tipico desc limit 15) h;

    drop table if exists _sinais;
    drop table if exists _prev;

    if n_rec + n_lem + n_atr + n_hoje = 0 then
      return;
    end if;

    titulo := concat_ws(' · ',
      case when n_rec > 0 then n_rec || ' para reconquistar' end,
      case when n_lem > 0 then n_lem || case when n_lem = 1 then ' lembrete' else ' lembretes' end end,
      case when n_atr > 0 then n_atr || case when n_atr = 1 then ' não pediu' else ' não pediram' end end,
      case when n_hoje > 0 then n_hoje || case when n_hoje = 1 then ' esperado hoje' else ' esperados hoje' end end
    );

    perform privado.enviar_ntfy(
      'Clientes — ' || titulo,
      concat_ws(E'\n\n',
        case when n_rec > 0 then 'Reconquistar hoje:' || E'\n' || t_rec end,
        case when n_lem > 0 then 'Lembretes de hoje:' || E'\n' || t_lem end,
        case when n_atr > 0 then 'Não pediram no dia de sempre:' || E'\n' || t_atr
          || case when n_atr > 15 then E'\n… e mais ' || (n_atr - 15) else '' end end,
        case when n_hoje > 0 then 'Esperados hoje, ainda sem pedido:' || E'\n' || t_hoje
          || case when n_hoje > 15 then E'\n… e mais ' || (n_hoje - 15) else '' end end
      ),
      privado.link_do_app('previsao')
    );
  exception when others then
    raise warning 'aviso de falta de pedido falhou: %', sqlerrm;
  end;
  $f$;

  revoke all on function privado.avisar_falta_pedidos() from public, anon, authenticated;

  raise notice 'Aviso diário de falta de pedido agora respeita as sinalizações (lembrar, ciente, parou).';
end;
$outer$;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-57-comprovante-outros-lancamentos.sql
-- ============================================================================
--  Migração 57 — comprovante também em compra, combustível e folha
--
--  A migração 54 deu comprovante à despesa. Agora o mesmo comprovante pode
--  virar uma compra de mercadoria, um abastecimento ou um pagamento da folha
--  (a tela de Despesas escolhe o destino pela categoria), então essas três
--  tabelas ganham as mesmas duas colunas:
--
--    comprovante_path   caminho do arquivo no bucket "despesas-comprovantes"
--    comprovante_nome   nome original, para mostrar na tela
--
--  Pagamento do posto: o combustível é lançado a cada abastecimento e o posto é
--  pago de 15 em 15 dias. O comprovante desse pagamento não cria despesa (o
--  custo já entrou no abastecimento); ele QUITA os abastecimentos da quinzena:
--
--    abastecimentos.pago_em   dia em que o posto foi pago — vazio = em aberto
--
--  e usa o comprovante_path da própria linha como o comprovante do pagamento.
--  Os abastecimentos que já existem ficam "em aberto"; para dar baixa no
--  histórico que já foi pago, rode à parte, trocando a data de corte:
--
--    update public.abastecimentos set pago_em = data
--     where pago_em is null and data < '2026-09-15';
--
--  Rode DEPOIS da 54 e ANTES de publicar a versão do app que usa esta coluna.
--  Idempotente.
-- ============================================================================

alter table public.compras       add column if not exists comprovante_path text;
alter table public.compras       add column if not exists comprovante_nome text;
alter table public.abastecimentos add column if not exists comprovante_path text;
alter table public.abastecimentos add column if not exists comprovante_nome text;
alter table public.pagamentos    add column if not exists comprovante_path text;
alter table public.pagamentos    add column if not exists comprovante_nome text;

alter table public.abastecimentos add column if not exists pago_em date;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-58-acoes-promotor.sql
-- ============================================================================
--  Migração 58 — "ações" dos promotores
--
--  Além das rotas de arrumação de expositor, o gestor passa a lançar "ações"
--  para o promotor realizar: um evento em loja para divulgação, degustação,
--  ativação de marca etc. Cada ação tem promotor, loja (cadastrada ou texto
--  livre), data, título e descrição. O promotor vê em "Minha Rota" e, ao
--  realizar, envia a foto do evento e uma observação — a ação vira "concluída".
--
--  Como aplicar: depois da migracao-08-promotores.sql (usa o bucket de fotos
--  e a função e_gestor()).
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

create table if not exists public.acoes_promotor (
  id               uuid primary key default gen_random_uuid(),
  promotor_id      uuid not null references public.perfis (id) on delete cascade,
  titulo           text not null,
  descricao        text,
  data             date not null default current_date,
  loja_id          uuid references public.lojas (id) on delete set null,
  estabelecimento  text not null,
  endereco         text,
  status           text not null default 'pendente'
                   check (status in ('pendente', 'concluida', 'cancelada')),
  foto_url         text,
  observacao       text,
  concluida_em     timestamptz,
  arquivada        boolean not null default false,
  criado_por       uuid references public.perfis (id) on delete set null,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

alter table public.acoes_promotor drop constraint if exists acoes_promotor_conclusao_exige_foto;
alter table public.acoes_promotor
  add constraint acoes_promotor_conclusao_exige_foto
  check (status <> 'concluida' or foto_url is not null);

create index if not exists acoes_promotor_promotor_idx on public.acoes_promotor (promotor_id);
create index if not exists acoes_promotor_data_idx     on public.acoes_promotor (data desc);

drop trigger if exists acoes_promotor_atualizado_em on public.acoes_promotor;
create trigger acoes_promotor_atualizado_em
  before update on public.acoes_promotor
  for each row execute function public.tocar_atualizado_em();

alter table public.acoes_promotor enable row level security;

drop policy if exists acoes_promotor_leitura     on public.acoes_promotor;
drop policy if exists acoes_promotor_insercao    on public.acoes_promotor;
drop policy if exists acoes_promotor_atualizacao on public.acoes_promotor;
drop policy if exists acoes_promotor_exclusao    on public.acoes_promotor;

create policy acoes_promotor_leitura on public.acoes_promotor
  for select to authenticated
  using (promotor_id = auth.uid() or public.e_gestor());

create policy acoes_promotor_insercao on public.acoes_promotor
  for insert to authenticated
  with check (public.e_gestor());

-- O promotor registra a realização na própria ação; o gestor edita qualquer uma.
create policy acoes_promotor_atualizacao on public.acoes_promotor
  for update to authenticated
  using (promotor_id = auth.uid() or public.e_gestor())
  with check (promotor_id = auth.uid() or public.e_gestor());

create policy acoes_promotor_exclusao on public.acoes_promotor
  for delete to authenticated
  using (public.e_gestor());

revoke all on public.acoes_promotor from anon;
grant select, insert, update, delete on public.acoes_promotor to authenticated;

-- Tempo real — o painel do gestor e a tela do promotor andam sozinhos.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'acoes_promotor'
    ) then
      alter publication supabase_realtime add table public.acoes_promotor;
    end if;
  end if;
end;
$$;

commit;

-- Confira:  select titulo, estabelecimento, data, status from public.acoes_promotor order by criado_em desc;


-- >>>>>>>>>>>>>>>>>>>>>>>> banco-novo-antes-do-resgate.sql
-- ============================================================================
--  Banco novo — deixa os produtos prontos para o resgate
--
--  A migracao-28 cadastra as frutas da CVC com ids novos. Num banco que vai
--  receber o resgate dos aparelhos (/resgate), essas mesmas frutas voltam
--  com os ids de sempre — e ficariam em dobro. Este passo tira as da 28.
--
--  Só age em banco NOVO: se já houver venda ou compra lançada, não faz nada.
--  Entra no fim do instalar.sql; rodar de novo é seguro.
-- ============================================================================

do $$
begin
  if not exists (select 1 from public.vendas)
     and not exists (select 1 from public.compras) then
    delete from public.produtos;
  end if;
end;
$$;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-69-recebedor-repasses.sql
-- ============================================================================
--  Migração 69 — quem recebeu a venda e o repasse para a CVC
--
--  A CVC vende pela própria conta, pela Carvalho Cruz (CC) ou pela AVF. Quando
--  o vendedor é a CC ou a AVF, o dinheiro cai na conta DELAS e elas precisam
--  repassar à CVC. Isto guarda quem recebeu e o que já foi repassado:
--
--    vendas.recebedor   'cvc' (padrão) | 'carvalho_cruz' | 'avf'
--    repasses           dinheiro que andou entre a conta e a CVC
--    vw_repasse_conta   por conta: recebido, a receber, repassado e saldo
--
--  repasses.sentido:  'para_cvc'    a conta repassou à CVC
--                     'da_cvc'      a CVC mandou dinheiro à conta (reembolso)
--                     'a_confirmar' lançado do comprovante, ainda sem sentido
--                                   definido — fica fora do saldo
--
--  Saldo (a_repassar) = vendas pagas recebidas pela conta
--                       − repasses 'para_cvc' + repasses 'da_cvc'
--  Positivo = a conta ainda deve repassar à CVC.
--
--  Idempotente. Nada é apagado; vendas existentes ficam como 'cvc'.
-- ============================================================================

begin;

alter table public.vendas add column if not exists recebedor text not null default 'cvc';
alter table public.vendas drop constraint if exists vendas_recebedor_check;
alter table public.vendas add constraint vendas_recebedor_check
  check (recebedor in ('cvc', 'carvalho_cruz', 'avf'));

create table if not exists public.repasses (
  id             uuid primary key default gen_random_uuid(),
  data           date not null default current_date,
  conta          text not null check (conta in ('carvalho_cruz', 'avf')),
  sentido        text not null default 'a_confirmar'
                   check (sentido in ('para_cvc', 'da_cvc', 'a_confirmar')),
  valor          numeric(14,2) not null check (valor >= 0),
  descricao      text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists repasses_conta_idx on public.repasses (conta, data desc);

alter table public.repasses enable row level security;

drop policy if exists acesso_app          on public.repasses;
drop policy if exists repasses_leitura    on public.repasses;
drop policy if exists repasses_insercao   on public.repasses;
drop policy if exists repasses_atualizacao on public.repasses;
drop policy if exists repasses_exclusao   on public.repasses;

do $$
begin
  if to_regprocedure('public.e_socio()') is not null then
    create policy repasses_leitura on public.repasses
      for select to authenticated using (public.e_socio());
    create policy repasses_insercao on public.repasses
      for insert to authenticated with check (public.e_socio());
    create policy repasses_atualizacao on public.repasses
      for update to authenticated using (public.e_socio()) with check (public.e_socio());
    create policy repasses_exclusao on public.repasses
      for delete to authenticated using (public.e_socio());

    revoke all on public.repasses from anon;
    grant select, insert, update, delete on public.repasses to authenticated;
  else
    create policy acesso_app on public.repasses
      for all to anon, authenticated using (true) with check (true);
    grant select, insert, update, delete on public.repasses to anon, authenticated;
  end if;
end;
$$;

create or replace view public.vw_repasse_conta as
with contas as (
  select unnest(array['carvalho_cruz', 'avf']) as conta
),
vendido as (
  select recebedor as conta,
         coalesce(sum(total) filter (where status = 'pago'), 0)     as recebido,
         coalesce(sum(total) filter (where status = 'pendente'), 0) as a_receber
  from public.vendas
  where recebedor <> 'cvc'
  group by recebedor
),
movido as (
  select conta,
         coalesce(sum(valor) filter (where sentido = 'para_cvc'), 0)    as repassado,
         coalesce(sum(valor) filter (where sentido = 'da_cvc'), 0)      as recebido_da_cvc,
         coalesce(sum(valor) filter (where sentido = 'a_confirmar'), 0) as a_confirmar
  from public.repasses
  group by conta
)
select c.conta,
       coalesce(v.recebido, 0)        as recebido,
       coalesce(v.a_receber, 0)       as a_receber,
       coalesce(m.repassado, 0)       as repassado,
       coalesce(m.recebido_da_cvc, 0) as recebido_da_cvc,
       coalesce(m.a_confirmar, 0)     as a_confirmar,
       coalesce(v.recebido, 0) - coalesce(m.repassado, 0) + coalesce(m.recebido_da_cvc, 0) as a_repassar
from contas c
left join vendido v on v.conta = c.conta
left join movido  m on m.conta = c.conta;

alter view public.vw_repasse_conta set (security_invoker = on);
grant select on public.vw_repasse_conta to authenticated;

commit;


-- >>>>>>>>>>>>>>>>>>>>>>>> migracao-70-despesa-por-fruta.sql
-- ============================================================================
--  Migração 70 — despesa da fruta
--
--  A planilha da CVC guarda, em cada aba de fruta, as "DESPESAS COM A FRUTA"
--  (IFCO, frete...). A tela Frutas do app mostra e edita essas despesas por
--  fruta, então a despesa passa a poder dizer de que fruta é:
--
--    despesas.fruta   text, null = despesa geral (não é de uma fruta só)
--
--  Idempotente. Nada é apagado.
-- ============================================================================

begin;

alter table public.despesas add column if not exists fruta text;
create index if not exists despesas_fruta_idx on public.despesas (fruta) where fruta is not null;

commit;


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

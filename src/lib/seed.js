/**
 * Carteira inicial — extraída da TABELA COMPRADORES da planilha de gestão.
 *
 * Não é dado de demonstração: são as redes, lojas e produtos com que a
 * distribuidora realmente trabalha. O app já abre sabendo para quem vende.
 *
 * Vendas e compras começam vazias, de propósito: movimento não é cadastro.
 *
 * Carrega sozinho quando o Supabase NÃO está configurado e o banco local está
 * vazio. Com VITE_SUPABASE_URL definido, a carteira vem da nuvem — para
 * plantá-la lá, rode `npm run seed:sql` e execute supabase/seed.sql uma vez.
 *
 * Os ids são UUIDs válidos e fixos, derivados da posição, para que rodar a
 * semente de novo não duplique nada.
 */

const uuid = (prefixo, n) =>
  `${prefixo}1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const idRede = (n) => uuid("a", n);
const idLoja = (n) => uuid("b", n);
const idProduto = (n) => uuid("d", n);
const idFornecedor = (n) => uuid("f", n);
const idVeiculo = (n) => uuid("e", n);
const idFuncionario = (n) => uuid("c", n);
const idInsumo = (n) => uuid("g", n);

const CRIADO_EM = "2026-09-15T09:00:00.000Z";

// ─── A carteira, como está na planilha ──────────────────────────────────────
//
// Nomes de loja se repetem entre redes — existe BARRA na PETROX, na REDE MAIS
// e na HIPER CARNES. São lojas diferentes, de donos diferentes.

const CARTEIRA = {
  "PETROX": ["ARUANA", "ORLA P.D SOL", "BARRA", "P.CAJU", "PRAIA", "GAZOL",
             "AEROPORTO", "ATALAIA", "FAROL", "BR", "F.PORTO", "MELICIO",
             "SANTA LUCIA", "TANCREDO", "URQUIZA LEAL", "TREZE"],
  "REDE MAIS": ["BARRA", "DISTRITO", "ECO POSTO", "FAROLANDIA", "F.PORTO",
                "MEGA", "TANCREDO"],
  "BOMBOM": ["ARACAJU", "ESTANCIA"],
  "ATACAREJO MCR": ["FILIAL", "JOAO ALVES"],
  "FASOUTO": ["INDUSTRIAL", "SOCORRO"],
  "HIPER CARNES": ["ARUANA", "BARRA", "JABOTIANA"],
  "J.PEIXOTO": ["ARUANA", "PIABETA", "SAO BRAS"],
  "MIX MATEUS": ["ASWALDO", "INDUSTRIAL", "GLORIA", "FEIRA"],
  "REDE ALPHA": ["ATALAIA", "COROA", "DETRAN", "F.PORTO", "FEIRA"],
  "NUNES PEIXOTO": ["GLORIA", "ITABAIANA"],
  "BRAUNA": ["MATRIZ"],
  "ATAKAREJO": ["CD", "SALVADOR"],
  "TABAJARA": ["SOLEDADE", "JAPAOZINHO"],
  "SOUZA": ["MATRIZ"],
  "PANDELLI": ["MATRIZ"],
  "HOTEL AQUARIUS": ["MATRIZ"],
  "HOTEL SAO MANUEL": ["MATRIZ"],
  "SILVA SUPERMERCADO": ["MATRIZ"],
  "SUPERMERCADO DA PRAIA": ["MATRIZ"],
  "VINICIUS": ["CHURRASCARIA PRAIA", "NORDESTAO", "MERCADO TRABALHADOR", "ASTRO"],
  "SERRANO": ["ADELIA FRANCO", "SILVIO TEIXEIRA"],
};

const redes = [];
const lojas = [];

Object.entries(CARTEIRA).forEach(([nomeRede, nomesLojas], i) => {
  const rede = {
    id: idRede(i + 1),
    nome: nomeRede,
    telefone: "",
    status: "ativo",
    criadoEm: CRIADO_EM,
  };
  redes.push(rede);

  for (const nomeLoja of nomesLojas) {
    lojas.push({
      id: idLoja(lojas.length + 1),
      redeId: rede.id,
      nome: nomeLoja,
      cidade: "",
      telefone: "",
      status: "ativo",
      criadoEm: CRIADO_EM,
    });
  }
});

// ─── Produtos ───────────────────────────────────────────────────────────────
//
// Os preços são os praticados em setembro/2026 na planilha. São o padrão
// sugerido ao lançar a venda — dá para mudar em cada pedido.
//
// `kgPorUnidade` é a coluna BAGS: 60 sacos de 2,5 kg = 150 kg.

const produtos = [
  { nome: "Laranja Agranel",  fruta: "Laranja Pera", unidadeVenda: "kg",   kgPorUnidade: 1,    preco: 1.20 },
  { nome: "Saco 2,5 kg",      fruta: "Laranja Pera", unidadeVenda: "saco", kgPorUnidade: 2.5,  preco: 3.00 },
  { nome: "Saco 3 kg",        fruta: "Laranja Pera", unidadeVenda: "saco", kgPorUnidade: 3,    preco: 3.45 },
  { nome: "Saco 5 kg",        fruta: "Laranja Pera", unidadeVenda: "saco", kgPorUnidade: 5,    preco: 6.00 },
  { nome: "Saco 10 kg",       fruta: "Laranja Pera", unidadeVenda: "saco", kgPorUnidade: 10,   preco: 12.00 },
  { nome: "Laranja Lima",     fruta: "Laranja Lima", unidadeVenda: "kg",   kgPorUnidade: 1,    preco: 2.00 },
  { nome: "Abóbora",          fruta: "Abóbora",      unidadeVenda: "kg",   kgPorUnidade: 1,    preco: 1.80 },
].map((p, i) => ({
  ...p,
  id: idProduto(i + 1),
  criadoEm: CRIADO_EM,
}));

// ─── Fornecedores ───────────────────────────────────────────────────────────

const fornecedores = [
  { nome: "FB",            produto: "Laranja lima",           cidade: "Aracaju-SE" },
].map((f, i) => ({
  ...f,
  id: idFornecedor(i + 2), // FB manteve o id 2 do seed.sql
  telefone: "",
  status: "ativo",
  criadoEm: CRIADO_EM,
}));

// ─── Veículos ───────────────────────────────────────────────────────────────
//
// A frota da aba DESPESAS → COMBUSTÍVEIS. Abastecimento começa vazio, de
// propósito, como compras e vendas: movimento não é cadastro.

const veiculos = [
  { nome: "Sprinter" },
  { nome: "Strada" },
  { nome: "HR" },
].map((v, i) => ({
  ...v,
  id: idVeiculo(i + 1),
  placa: "",
  modelo: "",
  status: "ativo",
  criadoEm: CRIADO_EM,
}));

// ─── Insumos de produção ─────────────────────────────────────────────────────
//
// Redinha, grampo e etiqueta — o que embala o sanquinho de laranja. Sem
// compra/venda lançada como a fruta: o saldo é a contagem física mais
// recente (contagens_insumos, ainda vazia aqui — contagem é movimento).
// Estoque mínimo começa em 0 (sem alerta) até quem usa decidir o número.

// Unidade é a de compra: redinha em rolo de 1.000 m (1 m faz 3 sacos de
// 2,5 kg), grampo e etiqueta em milheiro.
const insumosItens = [
  { nome: "Redinha", unidade: "rolo (1.000 m)" },
  { nome: "Grampo", unidade: "milheiro" },
  { nome: "Etiqueta 2,5 kg", unidade: "milheiro" },
  { nome: "Etiqueta 3 kg", unidade: "milheiro" },
  { nome: "Etiqueta 5 kg", unidade: "milheiro" },
  { nome: "Etiqueta 10 kg", unidade: "milheiro" },
].map((it, i) => ({
  ...it,
  id: idInsumo(i + 1),
  estoqueMinimo: 0,
  ordem: i + 1,
  ativo: true,
  criadoEm: CRIADO_EM,
}));

// ─── Folha de diaristas e funcionários ──────────────────────────────────────
//
// O elenco das abas DIARISTAS e FUNCIONARIOS FIXOS da planilha, por nome.
// Pagamento começa vazio, de propósito, como abastecimento e compra: nome é
// cadastro, quanto se pagou é movimento.

const funcionarios = [
  ...["Guilherme", "Junior", "Marcos", "Aux Motorista 1", "Aux Motorista 2", "Alison"]
    .map((nome) => ({ nome, tipo: "Diarista" })),
  ...["Rafaela", "Alexandre", "Lucas", "Helisson", "Kaue", "Cleo", "Cleverton",
      "Wesley", "Priscila", "Denisson", "Nilson"]
    .map((nome) => ({ nome, tipo: "Funcionário" })),
].map((f, i) => ({
  ...f,
  id: idFuncionario(i + 1),
  status: "ativo",
  criadoEm: CRIADO_EM,
}));

export const dadosIniciais = {
  redes, lojas, fornecedores, produtos, veiculos, funcionarios, insumos_itens: insumosItens,
  vendas: [], compras: [], perdas: [], despesas: [], acertos: [], abastecimentos: [],
  pagamentos: [], notas_entrada: [], contagens_insumos: [], precos_produtos: [], metas: [], nfe_arquivadas: [], sinalizacoes_clientes: [],
};

export const dadosVazios = {
  redes: [], lojas: [], fornecedores: [], produtos: [], veiculos: [], funcionarios: [],
  vendas: [], compras: [], perdas: [], despesas: [], acertos: [], abastecimentos: [],
  pagamentos: [], notas_entrada: [], insumos_itens: [], contagens_insumos: [], precos_produtos: [], metas: [], nfe_arquivadas: [], sinalizacoes_clientes: [],
};

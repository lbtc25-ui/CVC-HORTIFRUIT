/**
 * Tradução entre o formato usado na tela (camelCase) e as colunas do
 * Postgres/Supabase (snake_case). Manter isso num só lugar evita que um
 * rename de coluna se espalhe pelo app inteiro.
 */

export const TABELAS = {
  redes: "redes",
  lojas: "lojas",
  fornecedores: "fornecedores",
  produtos: "produtos",
  vendas: "vendas",
  compras: "compras",
  perdas: "perdas",
  despesas: "despesas",
  acertos: "acertos",
  veiculos: "veiculos",
  abastecimentos: "abastecimentos",
  funcionarios: "funcionarios",
  pagamentos: "pagamentos",
  notas_entrada: "notas_entrada",
  insumos_itens: "insumos_itens",
  contagens_insumos: "contagens_insumos",
  precos_produtos: "precos_produtos",
  metas: "metas",
  nfe_arquivadas: "nfe_arquivadas",
  sinalizacoes_clientes: "sinalizacoes_clientes",
};

export function novoId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  // Fallback para navegadores antigos / contexto não seguro
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const num = (v, padrao = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : padrao;
};

// ─── ficha cadastral (redes e lojas) ────────────────────────────────────────
//
// Razão social, CNPJ, IE, contato e endereço completo. Os mesmos campos nos
// dois níveis do cliente — ver src/lib/cadastro.js.

const CAMPOS_FICHA = [
  ["razaoSocial", "razao_social"],
  // cnpj_cpf e ie já existiam nas lojas (migração da NF-e, dados importados
  // do Omie) — os nomes são os mesmos para a ficha ler o que já está lá.
  ["cnpjCpf", "cnpj_cpf"],
  ["ie", "ie"],
  ["contato", "contato"],
  ["email", "email"],
  ["cep", "cep"],
  ["logradouro", "logradouro"],
  ["numero", "numero"],
  ["complemento", "complemento"],
  ["bairro", "bairro"],
  ["cidade", "cidade"],
  ["uf", "uf"],
  ["observacoes", "observacoes"],
];

const fichaParaDB = (x) =>
  Object.fromEntries(CAMPOS_FICHA.map(([tela, db]) => [db, x[tela] ? x[tela] : null]));

const fichaDoDB = (r) =>
  Object.fromEntries(CAMPOS_FICHA.map(([tela, db]) => [tela, r[db] ?? ""]));

// Produtos que aparecem no link de pedido (migracao-23). Lista vazia na tela
// é null no banco: na rede, todos os produtos; na loja, os mesmos da rede.
const produtosPedidoParaDB = (x) =>
  Array.isArray(x.produtosPedido) && x.produtosPedido.length ? x.produtosPedido : null;
const produtosPedidoDoDB = (r) => (Array.isArray(r.produtos_pedido) ? r.produtos_pedido : []);

// Taxas do cliente (IFCO, CD, antecipação) — jsonb, ver migracao-62.
const taxasParaDB = (x) => (Array.isArray(x.taxas) && x.taxas.length ? x.taxas : null);
const taxasDoDB = (r) => (Array.isArray(r.taxas) ? r.taxas : []);

// ─── redes ──────────────────────────────────────────────────────────────────

const redeParaDB = (r) => ({
  id: r.id,
  nome: r.nome,
  telefone: r.telefone || null,
  ...fichaParaDB(r),
  produtos_pedido: produtosPedidoParaDB(r),
  taxas: taxasParaDB(r),
  status: r.status ?? "ativo",
  // token_pedido NÃO sobe, como na loja (migracao-26).
  criado_em: r.criadoEm ?? new Date().toISOString(),
});

const redeDoDB = (r) => ({
  id: r.id,
  nome: r.nome,
  telefone: r.telefone ?? "",
  ...fichaDoDB(r),
  produtosPedido: produtosPedidoDoDB(r),
  taxas: taxasDoDB(r),
  status: r.status ?? "ativo",
  tokenPedido: r.token_pedido ?? "",
  criadoEm: r.criado_em,
});

// ─── lojas ──────────────────────────────────────────────────────────────────

const lojaParaDB = (l) => ({
  id: l.id,
  rede_id: l.redeId,
  nome: l.nome,
  telefone: l.telefone || null,
  ...fichaParaDB(l),
  produtos_pedido: produtosPedidoParaDB(l),
  taxas: taxasParaDB(l),
  status: l.status ?? "ativo",
  omie_codigo_cliente: l.omieCodigoCliente ?? null,
  // Geocodificado uma vez (romaneio) e guardado pra não pedir de novo toda hora.
  lat: l.lat ?? null,
  lng: l.lng ?? null,
  // token_pedido NÃO sobe: é o banco que gera (e o renovar_link_pedido que
  // troca). Fora do upsert, gravar a loja não mexe no link.
  criado_em: l.criadoEm ?? new Date().toISOString(),
});

const lojaDoDB = (r) => ({
  id: r.id,
  redeId: r.rede_id,
  nome: r.nome,
  telefone: r.telefone ?? "",
  ...fichaDoDB(r),
  status: r.status ?? "ativo",
  omieCodigoCliente: r.omie_codigo_cliente ?? null,
  produtosPedido: produtosPedidoDoDB(r),
  taxas: taxasDoDB(r),
  lat: r.lat ?? null,
  lng: r.lng ?? null,
  tokenPedido: r.token_pedido ?? "",
  criadoEm: r.criado_em,
});

// ─── fornecedores ───────────────────────────────────────────────────────────

const fornecedorParaDB = (f) => ({
  id: f.id,
  nome: f.nome,
  telefone: f.telefone ?? null,
  produto: f.produto ?? null,
  cidade: f.cidade ?? null,
  status: f.status ?? "ativo",
  criado_em: f.criadoEm ?? new Date().toISOString(),
});

const fornecedorDoDB = (r) => ({
  id: r.id,
  nome: r.nome,
  telefone: r.telefone ?? "",
  produto: r.produto ?? "",
  cidade: r.cidade ?? "",
  status: r.status ?? "ativo",
  criadoEm: r.criado_em,
});

// ─── produtos ───────────────────────────────────────────────────────────────
//
// `kgPorUnidade` é a coluna BAGS da planilha: quantos quilos tem cada unidade
// vendida. No agranel a unidade já é o quilo, então o fator é 1.
//
// O produto não carrega mais estoque. Estoque é da FRUTA e é conta, não campo:
// compras − vendas − perdas, na view vw_estoque_fruta. As colunas `estoque` e
// `estoque_min` continuam no Postgres, sem uso — o upsert não as menciona, e
// por isso não as apaga.

const textoOuNull = (v) => (v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim());
const numOuNull = (v) => (v === undefined || v === null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

const produtoParaDB = (p) => {
  return {
    id: p.id,
    nome: p.nome,
    fruta: p.fruta ?? "Laranja Pera",
    // Por qual empresa o produto é vendido: produção própria e revenda não se
    // misturam no DRE. Ver migracao-27-empresa-produto.sql.
    empresa: p.empresa === "carvalho_cruz" ? "carvalho_cruz" : "cvc",
    unidade_venda: p.unidadeVenda ?? "kg",
    kg_por_unidade: p.unidadeVenda === "saco" ? num(p.kgPorUnidade, 1) : 1,
    // Peso de uma caixa da fruta (migracao-64); vazio = não cadastrado.
    kg_por_caixa: Number(p.kgPorCaixa) > 0 ? Number(p.kgPorCaixa) : null,
    // Peso médio de uma unidade, para pedido por unidade (migracao-66).
    peso_medio_unidade: Number(p.pesoMedioUnidade) > 0 ? Number(p.pesoMedioUnidade) : null,
    preco: num(p.preco),
    // Dados da NF-e (migracao-28): a tributação é do produto, não do app.
    ncm: textoOuNull(p.ncm),
    cfop_padrao: textoOuNull(p.cfopPadrao),
    unidade_omie: textoOuNull(p.unidadeOmie),
    omie_codigo_produto: p.omieCodigoProduto ?? null,
    codigo: textoOuNull(p.codigo),
    origem: numOuNull(p.origem),
    icms_cst: textoOuNull(p.icmsCst),
    icms_aliquota: numOuNull(p.icmsAliquota),
    pis_cst: textoOuNull(p.pisCst),
    cofins_cst: textoOuNull(p.cofinsCst),
    cest: textoOuNull(p.cest),
    ean: textoOuNull(p.ean),
    criado_em: p.criadoEm ?? new Date().toISOString(),
  };
};

const produtoDoDB = (r) => {
  return {
    id: r.id,
    nome: r.nome,
    fruta: r.fruta ?? "Laranja Pera",
    empresa: r.empresa === "carvalho_cruz" ? "carvalho_cruz" : "cvc",
    unidadeVenda: r.unidade_venda ?? "kg",
    kgPorUnidade: num(r.kg_por_unidade, 1),
    kgPorCaixa: Number(r.kg_por_caixa) > 0 ? Number(r.kg_por_caixa) : null,
    pesoMedioUnidade: Number(r.peso_medio_unidade) > 0 ? Number(r.peso_medio_unidade) : null,
    preco: num(r.preco),
    ncm: r.ncm ?? "",
    cfopPadrao: r.cfop_padrao ?? "",
    unidadeOmie: r.unidade_omie ?? "",
    omieCodigoProduto: r.omie_codigo_produto ?? null,
    codigo: r.codigo ?? "",
    origem: r.origem ?? null,
    icmsCst: r.icms_cst ?? "",
    icmsAliquota: r.icms_aliquota ?? null,
    pisCst: r.pis_cst ?? "",
    cofinsCst: r.cofins_cst ?? "",
    cest: r.cest ?? "",
    ean: r.ean ?? "",
    criadoEm: r.criado_em,
  };
};

// ─── vendas ─────────────────────────────────────────────────────────────────
// Os itens vão como jsonb na própria linha da venda: a sincronização offline
// fica atômica (uma venda = uma operação) e a view vw_venda_itens no Postgres
// expõe os mesmos dados de forma relacional para relatórios.
//
// `vencimento` NÃO é enviado: no Postgres é coluna gerada (data + prazo_dias).
// O app calcula o mesmo valor localmente para funcionar offline.

const itemParaDB = (i) => ({
  produtoId: i.produtoId,
  qty: num(i.qty),
  precoUnitario: num(i.precoUnitario),
  kgPorUnidade: num(i.kgPorUnidade, 1),
  kgTotal: num(i.kgTotal),
  natureza: i.natureza === "bonificacao" ? "bonificacao" : "venda",
  // Só o agranel vendido por unidade grava o campo; sem ele, vale a unidade
  // de venda do produto (kg ou saco).
  ...(i.unidade === "un" && { unidade: "un" }),
});

const itemDoDB = (i) => {
  const qty = num(i.qty);
  const kgPorUnidade = num(i.kgPorUnidade, 1);
  return {
    produtoId: i.produtoId ?? i.produto_id,
    qty,
    // `preco` é o nome antigo da coluna, de antes da migração.
    precoUnitario: num(i.precoUnitario ?? i.preco),
    kgPorUnidade,
    kgTotal: num(i.kgTotal, qty * kgPorUnidade),
    natureza: i.natureza === "bonificacao" ? "bonificacao" : "venda",
    ...(i.unidade === "un" && { unidade: "un" }),
  };
};

const vendaParaDB = (v) => ({
  id: v.id,
  numero: v.numero ?? null,
  loja_id: v.lojaId || null,
  data: v.data,
  prazo_dias: num(v.prazoDias),
  itens: (v.itens ?? []).map(itemParaDB),
  total: num(v.total),
  kg_total: num(v.kgTotal),
  status: v.status ?? "pendente",
  veiculo_id: v.veiculoId || null,
  motorista_id: v.motoristaId || null,
  motorista_nome: v.motoristaNome || null,
  status_entrega: v.statusEntrega ?? "pendente",
  saida_cd_em: v.saidaCdEm || null,
  entregue_em: v.entregueEm || null,
  ordem_rota: v.ordemRota ?? null,
  prioridade: v.prioridade ?? false,
  rota_data: v.rotaData || null,
  // Rota com tudo entregue e tirada da tela do Romaneio (migracao-42) — os
  // pedidos continuam intactos, só o card some da lista principal.
  rota_arquivada: v.rotaArquivada ?? false,
  // Pedidos mesclados numa única parada da rota (migracao-39): mesmo valor
  // aqui, no mesmo veículo, é a mesma parada. Não muda nada do financeiro.
  grupo_entrega_id: v.grupoEntregaId || null,
  // 2ª, 3ª... viagem do MESMO veículo no MESMO dia (romaneio avulso, entrega
  // de retorno) — sem isso, duas viagens iam se misturar como se fossem uma
  // rota só na tela e no romaneio impresso.
  viagem_rota: v.viagemRota ?? 1,
  nfe_status: v.nfeStatus ?? "nao_emitida",
  nfe_numero: v.nfeNumero ?? null,
  nfe_serie: v.nfeSerie ?? null,
  nfe_chave: v.nfeChave ?? null,
  nfe_danfe_url: v.nfeDanfeUrl ?? null,
  nfe_erro: v.nfeErro ?? null,
  nfe_emitida_em: v.nfeEmitidaEm ?? null,
  nfe_spedy_id: v.spedyId ?? null,
  nfe_motivo_cancelamento: v.nfeMotivoCancelamento ?? null,
  // Carta de correção dos códigos de produto (migracao-50).
  nfe_cce_em: v.nfeCceEm ?? null,
  nfe_cce_texto: v.nfeCceTexto || null,
  consolidada_em: v.consolidadaEm ?? null,
  omie_codigo_pedido: v.omieCodigoPedido ?? null,
  cobranca_conferida_em: v.cobrancaConferidaEm || null,
  origem: v.origem === "cliente" ? "cliente" : "app",
  observacao: v.observacao || null,
  aguardando_conferencia: v.aguardandoConferencia ?? false,
  // Cliente que não quer NF, só recibo (migracao-41) — decidido pedido a
  // pedido, não é fixo da loja.
  emitir_nf: v.emitirNf ?? true,
  // Texto livre que sai nas "Informações complementares" da NF-e (migracao-43).
  observacao_nf: v.observacaoNf?.trim() || null,
  // Quem recebeu o dinheiro: 'cvc', 'carvalho_cruz' ou 'avf' (migracao-69). Só
  // vai quando preenchido — um banco sem a coluna segue aceitando as vendas.
  ...(v.recebedor ? { recebedor: v.recebedor } : {}),
  // Caixas IFCO que foram no pedido (migracao-63) — base da taxa "R$ por caixa".
  caixas_ifco: Math.max(0, Math.round(num(v.caixasIfco))),
  // pedido_por NÃO sobe: só o link grava (migracao-29), e o upsert mantém o que está no banco.
  criado_em: v.criadoEm ?? new Date().toISOString(),
});

const vendaDoDB = (r) => {
  const itens = Array.isArray(r.itens) ? r.itens.map(itemDoDB) : [];
  return {
    id: r.id,
    numero: r.numero,
    lojaId: r.loja_id ?? "",
    data: r.data,
    prazoDias: num(r.prazo_dias),
    itens,
    total: num(r.total),
    kgTotal: num(r.kg_total, itens.reduce((s, i) => s + i.kgTotal, 0)),
    status: r.status ?? "pendente",
    veiculoId: r.veiculo_id ?? "",
    motoristaId: r.motorista_id ?? "",
    motoristaNome: r.motorista_nome ?? "",
    statusEntrega: r.status_entrega ?? "pendente",
    saidaCdEm: r.saida_cd_em ?? null,
    entregueEm: r.entregue_em ?? null,
    ordemRota: r.ordem_rota ?? null,
    prioridade: r.prioridade ?? false,
    rotaData: r.rota_data ?? null,
    rotaArquivada: r.rota_arquivada ?? false,
    grupoEntregaId: r.grupo_entrega_id ?? null,
    viagemRota: r.viagem_rota ?? 1,
    nfeStatus: r.nfe_status ?? "nao_emitida",
    nfeNumero: r.nfe_numero ?? null,
    nfeSerie: r.nfe_serie ?? null,
    nfeChave: r.nfe_chave ?? "",
    nfeDanfeUrl: r.nfe_danfe_url ?? "",
    nfeErro: r.nfe_erro ?? "",
    nfeEmitidaEm: r.nfe_emitida_em ?? null,
    spedyId: r.nfe_spedy_id ?? "",
    nfeMotivoCancelamento: r.nfe_motivo_cancelamento ?? "",
    nfeCceEm: r.nfe_cce_em ?? null,
    nfeCceTexto: r.nfe_cce_texto ?? "",
    consolidadaEm: r.consolidada_em ?? null,
    omieCodigoPedido: r.omie_codigo_pedido ?? null,
    cobrancaConferidaEm: r.cobranca_conferida_em ?? null,
    // Pedido feito pelo cliente no link (migracao-21), até alguém conferir.
    origem: r.origem ?? "app",
    observacao: r.observacao ?? "",
    aguardandoConferencia: r.aguardando_conferencia ?? false,
    emitirNf: r.emitir_nf ?? true,
    observacaoNf: r.observacao_nf ?? "",
    recebedor: r.recebedor ?? "",
    caixasIfco: num(r.caixas_ifco),
    pedidoPor: r.pedido_por ?? "",
    criadoEm: r.criado_em,
  };
};


// ─── compras ────────────────────────────────────────────────────────────────
//
// Compra-se fruta, não produto: a laranja pera que entra vira tanto agranel
// quanto saco de 2,5 kg. `total` NÃO é enviado — no Postgres é coluna gerada
// (peso × valor do quilo). O app calcula o mesmo valor para funcionar offline.

const compraParaDB = (c) => ({
  id: c.id,
  data: c.data,
  fornecedor_id: c.fornecedorId || null,
  fruta: c.fruta ?? "Laranja Pera",
  peso_kg: num(c.pesoKg),
  valor_kg: num(c.valorKg),
  observacao: c.observacao || null,
  ...comprovanteParaDB(c),
  criado_em: c.criadoEm ?? new Date().toISOString(),
});

const compraDoDB = (r) => {
  const pesoKg = num(r.peso_kg);
  const valorKg = num(r.valor_kg);
  return {
    id: r.id,
    data: r.data,
    fornecedorId: r.fornecedor_id ?? "",
    fruta: r.fruta ?? "Laranja Pera",
    pesoKg,
    valorKg,
    total: num(r.total, pesoKg * valorKg),
    observacao: r.observacao ?? "",
    ...comprovanteDoDB(r),
    criadoEm: r.criado_em,
  };
};


// ─── perdas ─────────────────────────────────────────────────────────────────
//
// A PERCA da planilha. `custoKg` é uma fotografia do custo médio de compra no
// dia do registro — guardado, e não recalculado, porque uma compra nova mais
// cara não pode reescrever quanto custou o que se perdeu mês passado.
// `valor` NÃO é enviado: no Postgres é coluna gerada (kg × custo do quilo).

const perdaParaDB = (p) => ({
  id: p.id,
  data: p.data,
  fruta: p.fruta ?? "Laranja Pera",
  kg: num(p.kg),
  custo_kg: num(p.custoKg),
  motivo: p.motivo || null,
  criado_em: p.criadoEm ?? new Date().toISOString(),
});

const perdaDoDB = (r) => {
  const quilos = num(r.kg);
  const custoKg = num(r.custo_kg);
  return {
    id: r.id,
    data: r.data,
    fruta: r.fruta ?? "Laranja Pera",
    kg: quilos,
    custoKg,
    valor: num(r.valor, quilos * custoKg),
    motivo: r.motivo ?? "",
    criadoEm: r.criado_em,
  };
};


/** Colunas do comprovante de pagamento — só entram quando há comprovante (ver migração 54/57). */
const comprovanteParaDB = (x) =>
  x.comprovantePath ? { comprovante_path: x.comprovantePath, comprovante_nome: x.comprovanteNome || null } : {};
const comprovanteDoDB = (r) => ({ comprovantePath: r.comprovante_path ?? "", comprovanteNome: r.comprovante_nome ?? "" });

// ─── despesas ───────────────────────────────────────────────────────────────
//
// As oito categorias da aba NÃO MEXER. Lançamento simples de propósito: data,
// categoria, descrição e valor. É o que o DRE precisa.

const despesaParaDB = (d) => ({
  id: d.id,
  data: d.data,
  categoria: d.categoria,
  descricao: d.descricao || null,
  valor: num(d.valor),
  // Despesa de uma fruta (migracao-70). Só vai quando preenchida, para o banco
  // sem a coluna continuar aceitando as despesas gerais.
  ...(d.fruta ? { fruta: d.fruta } : {}),
  // Só vão quando há comprovante: antes de rodar a migração-54 o banco não tem
  // essas colunas, e mandá-las (mesmo nulas) travaria toda despesa na fila.
  ...comprovanteParaDB(d),
  criado_em: d.criadoEm ?? new Date().toISOString(),
});

const despesaDoDB = (r) => ({
  id: r.id,
  data: r.data,
  categoria: r.categoria,
  descricao: r.descricao ?? "",
  valor: num(r.valor),
  fruta: r.fruta ?? "",
  ...comprovanteDoDB(r),
  criadoEm: r.criado_em,
});


// ─── acertos de inventário ──────────────────────────────────────────────────
//
// Guarda a CONTAGEM, não um número para tapar buraco: `kgContado` é o que
// existe de fato e `kgSistema` é o que a conta dizia naquele momento — uma
// fotografia, para o acerto poder ser explicado depois. `ajuste` NÃO é
// enviado: no Postgres é coluna gerada (contado − sistema).

const acertoParaDB = (a) => ({
  id: a.id,
  data: a.data,
  fruta: a.fruta ?? "Laranja Pera",
  kg_contado: num(a.kgContado),
  kg_sistema: num(a.kgSistema),
  motivo: a.motivo || null,
  criado_em: a.criadoEm ?? new Date().toISOString(),
});

const acertoDoDB = (r) => {
  const kgContado = num(r.kg_contado);
  const kgSistema = num(r.kg_sistema);
  return {
    id: r.id,
    data: r.data,
    fruta: r.fruta ?? "Laranja Pera",
    kgContado,
    kgSistema,
    ajuste: num(r.ajuste, kgContado - kgSistema),
    motivo: r.motivo ?? "",
    criadoEm: r.criado_em,
  };
};

// ─── veículos ───────────────────────────────────────────────────────────────

const veiculoParaDB = (v) => ({
  id: v.id,
  nome: v.nome,
  placa: v.placa || null,
  modelo: v.modelo || null,
  status: v.status ?? "ativo",
  criado_em: v.criadoEm ?? new Date().toISOString(),
});

const veiculoDoDB = (r) => ({
  id: r.id,
  nome: r.nome,
  placa: r.placa ?? "",
  modelo: r.modelo ?? "",
  status: r.status ?? "ativo",
  criadoEm: r.criado_em,
});

// ─── abastecimentos ─────────────────────────────────────────────────────────
//
// A aba COMBUSTÍVEIS da planilha: data, motorista, veículo, km e tipo de
// combustível, litros e preço do litro. `valor` NÃO é enviado: no Postgres é
// coluna gerada (litros × preço do litro). O km rodado, km/l e custo por km
// não são campos — são conta, feita a partir do abastecimento anterior do
// mesmo veículo (dreMensal/abastecimentosComKm em distribuidora-carvalho-cruz.jsx
// e vw_abastecimentos no Postgres).

const abastecimentoParaDB = (a) => ({
  id: a.id,
  data: a.data,
  veiculo_id: a.veiculoId || null,
  motorista: a.motorista || null,
  tipo_combustivel: a.tipoCombustivel || "Diesel",
  km_atual: num(a.kmAtual),
  litros: num(a.litros),
  preco_litro: num(a.precoLitro),
  // Pagamento do posto (migração 57). `pagoEm` indefinido = o banco ainda não
  // tem a coluna: não manda nada. Definido (data ou vazio) = manda, inclusive
  // para desfazer o pagamento, e leva o comprovante junto.
  ...(a.pagoEm === undefined
    ? comprovanteParaDB(a)
    : { pago_em: a.pagoEm || null, comprovante_path: a.comprovantePath || null, comprovante_nome: a.comprovanteNome || null }),
  criado_em: a.criadoEm ?? new Date().toISOString(),
});

const abastecimentoDoDB = (r) => {
  const litros = num(r.litros);
  const precoLitro = num(r.preco_litro);
  return {
    id: r.id,
    data: r.data,
    veiculoId: r.veiculo_id ?? "",
    motorista: r.motorista ?? "",
    tipoCombustivel: r.tipo_combustivel ?? "Diesel",
    kmAtual: num(r.km_atual),
    litros,
    precoLitro,
    valor: num(r.valor, litros * precoLitro),
    ...comprovanteDoDB(r),
    // undefined quando a coluna não existe (banco sem a migração 57).
    pagoEm: r.pago_em === undefined ? undefined : r.pago_em ?? "",
    criadoEm: r.criado_em,
  };
};

// ─── funcionários e diaristas ───────────────────────────────────────────────
//
// A folha por nome das abas DIARISTAS e FUNCIONARIOS FIXOS: quem recebe, e o
// `tipo` distingue diarista (paga por dia/serviço) de funcionário (registrado
// ou fixo, geralmente salário) sem precisar de duas tabelas iguais. `salario`
// é o combinado: o salário do mês ou o valor da diária — vazio se não houver.
// `funcao` é o que a pessoa faz (Gerente, Motorista…) e `usuarioId`, a conta
// de acesso ao sistema dela, quando tem uma.

const funcionarioParaDB = (f) => ({
  id: f.id,
  nome: f.nome,
  tipo: f.tipo === "Diarista" ? "Diarista" : "Funcionário",
  funcao: f.funcao || null,
  usuario_id: f.usuarioId || null,
  status: f.status ?? "ativo",
  salario: f.salario === "" || f.salario == null ? null : num(f.salario),
  criado_em: f.criadoEm ?? new Date().toISOString(),
});

const funcionarioDoDB = (r) => ({
  id: r.id,
  nome: r.nome,
  tipo: r.tipo === "Diarista" ? "Diarista" : "Funcionário",
  funcao: r.funcao ?? "",
  usuarioId: r.usuario_id ?? "",
  status: r.status ?? "ativo",
  salario: r.salario == null ? "" : num(r.salario),
  criadoEm: r.criado_em,
});

// ─── pagamentos ─────────────────────────────────────────────────────────────
//
// Uma linha por pagamento: data, quem recebeu, descrição livre (o serviço —
// "Descarrego 1620" — ou vazio, quando é só o salário do mês) e valor. Entra
// no DRE como despesa, junto de "Despesas" e "Combustível".
// `funcionarioNome`/`funcionarioTipo` são uma cópia de quem recebeu, para o
// histórico não perder o nome quando a pessoa é removida do cadastro.
// `valor` é o total pago; `extras` é a parte das horas extras dentro dele
// (e `horasExtras`, quantas horas foram) — o salário é valor − extras.

const pagamentoParaDB = (p) => ({
  id: p.id,
  data: p.data,
  funcionario_id: p.funcionarioId || null,
  funcionario_nome: p.funcionarioNome || null,
  funcionario_tipo: p.funcionarioTipo || null,
  descricao: p.descricao || null,
  valor: num(p.valor),
  extras: num(p.extras),
  horas_extras: num(p.horasExtras),
  ...comprovanteParaDB(p),
  criado_em: p.criadoEm ?? new Date().toISOString(),
});

const pagamentoDoDB = (r) => ({
  id: r.id,
  data: r.data,
  funcionarioId: r.funcionario_id ?? "",
  funcionarioNome: r.funcionario_nome ?? "",
  funcionarioTipo: r.funcionario_tipo ?? "",
  descricao: r.descricao ?? "",
  valor: num(r.valor),
  extras: num(r.extras),
  horasExtras: num(r.horas_extras),
  ...comprovanteDoDB(r),
  criadoEm: r.criado_em,
});

// ─── notas de entrada ───────────────────────────────────────────────────────
//
// Duas origens na mesma tabela:
//   - "sefaz": NF-e que um terceiro emitiu contra o CNPJ da distribuidora e
//     que o app trouxe da SEFAZ (nfe_recebidas). A linha só existe depois
//     que alguém "deu entrada"; a ligação com a nota é pela `chave`.
//   - "app": nota de devolução que a própria distribuidora emitiu (NF-e de
//     entrada, finalidade devolução). `spedyId` é o id da nota emitida.
// `tipo` diz o que a nota é para o negócio: compra de fornecedor, devolução
// de cliente (ligada à venda em `vendaId`) ou outra. `itens` guarda as
// quantidades devolvidas (origem "app") ou os itens lidos do XML.

const notaEntradaParaDB = (n) => ({
  id: n.id,
  origem: n.origem === "app" ? "app" : "sefaz",
  tipo: n.tipo || "outra",
  spedy_id: n.spedyId || null,
  chave: n.chave || null,
  numero: n.numero ?? null,
  serie: n.serie ?? null,
  emitente_nome: n.emitenteNome || null,
  emitente_cnpj: n.emitenteCnpj || null,
  emitida_em: n.emitidaEm || null,
  valor: num(n.valor),
  venda_id: n.vendaId || null,
  loja_id: n.lojaId || null,
  fornecedor_id: n.fornecedorId || null,
  compra_id: n.compraId || null,
  itens: n.itens ?? [],
  nfe_status: n.nfeStatus || null,
  nfe_erro: n.nfeErro || null,
  // Carta de correção dos códigos de produto (migracao-51).
  nfe_cce_em: n.nfeCceEm ?? null,
  nfe_cce_texto: n.nfeCceTexto || null,
  motivo: n.motivo || null,
  observacao: n.observacao || null,
  lancada_em: n.lancadaEm || null,
  criado_em: n.criadoEm ?? new Date().toISOString(),
});

const notaEntradaDoDB = (r) => ({
  id: r.id,
  origem: r.origem ?? "sefaz",
  tipo: r.tipo ?? "outra",
  spedyId: r.spedy_id ?? "",
  chave: r.chave ?? "",
  numero: r.numero ?? null,
  serie: r.serie ?? null,
  emitenteNome: r.emitente_nome ?? "",
  emitenteCnpj: r.emitente_cnpj ?? "",
  emitidaEm: r.emitida_em ?? null,
  valor: num(r.valor),
  vendaId: r.venda_id ?? "",
  lojaId: r.loja_id ?? "",
  fornecedorId: r.fornecedor_id ?? "",
  compraId: r.compra_id ?? "",
  itens: Array.isArray(r.itens) ? r.itens : [],
  nfeStatus: r.nfe_status ?? "",
  nfeErro: r.nfe_erro ?? "",
  nfeCceEm: r.nfe_cce_em ?? null,
  nfeCceTexto: r.nfe_cce_texto ?? "",
  motivo: r.motivo ?? "",
  observacao: r.observacao ?? "",
  lancadaEm: r.lancada_em ?? null,
  criadoEm: r.criado_em,
});

// ─── insumos de produção (redinha, grampo, etiquetas) ──────────────────────
//
// Não tem compra/venda para virar conta como a fruta: o que existe é a
// CONTAGEM física, feita no depósito toda semana. `insumos_itens` é o
// cadastro fixo (nome, unidade e o estoque mínimo que dispara o alerta) e
// `contagens_insumos` é o histórico de contagens — o saldo de cada item é
// sempre a contagem mais recente dele (saldoDosInsumos, em
// distribuidora-carvalho-cruz.jsx).

const insumoItemParaDB = (i) => ({
  id: i.id,
  nome: i.nome,
  unidade: i.unidade || "unidade",
  estoque_minimo: num(i.estoqueMinimo),
  ordem: Number.isFinite(Number(i.ordem)) ? Number(i.ordem) : 0,
  ativo: i.ativo !== false,
  criado_em: i.criadoEm ?? new Date().toISOString(),
});

const insumoItemDoDB = (r) => ({
  id: r.id,
  nome: r.nome,
  unidade: r.unidade ?? "unidade",
  estoqueMinimo: num(r.estoque_minimo),
  ordem: num(r.ordem),
  ativo: r.ativo !== false,
  criadoEm: r.criado_em,
});

const contagemInsumoParaDB = (c) => ({
  id: c.id,
  data: c.data,
  item: c.item,
  quantidade: num(c.quantidade),
  observacao: c.observacao || null,
  criado_em: c.criadoEm ?? new Date().toISOString(),
});

const contagemInsumoDoDB = (r) => ({
  id: r.id,
  data: r.data,
  item: r.item,
  quantidade: num(r.quantidade),
  observacao: r.observacao ?? "",
  criadoEm: r.criado_em,
});

// ─── preços semanais dos produtos ───────────────────────────────────────────
//
// A conferência de toda segunda-feira: confirma o preço de cada produto —
// o agranel e cada saco — ou ajusta. Não é o preço da venda (esse é digitado
// em cada uma, varia por cliente) — é a referência que orienta quem vende.
// O preço vigente é sempre o registro mais recente (precoAtualPorProduto, em
// distribuidora-carvalho-cruz.jsx).

const precoProdutoParaDB = (p) => ({
  id: p.id,
  produto: p.produto,
  preco: num(p.preco),
  data: p.data,
  criado_em: p.criadoEm ?? new Date().toISOString(),
});

const precoProdutoDoDB = (r) => ({
  id: r.id,
  produto: r.produto,
  preco: num(r.preco),
  data: r.data,
  criadoEm: r.criado_em,
});

// ─── metas ──────────────────────────────────────────────────────────────────
//
// A meta de um período (diária, semanal, mensal, anual) para um indicador,
// no geral (`fruta` vazia) ou de uma fruta. Só o valor alvo é gravado: o
// realizado é conta em cima das vendas (realizadoDasMetas, em
// distribuidora-carvalho-cruz.jsx).

const metaParaDB = (m) => ({
  id: m.id,
  // Carvalho Cruz e CVC têm metas separadas (migracao-47).
  empresa: m.empresa === "carvalho_cruz" ? "carvalho_cruz" : "cvc",
  periodo: m.periodo,
  indicador: m.indicador,
  fruta: m.fruta || null,
  valor: num(m.valor),
  criado_em: m.criadoEm ?? new Date().toISOString(),
  atualizado_em: m.atualizadoEm ?? new Date().toISOString(),
});

const metaDoDB = (r) => ({
  id: r.id,
  empresa: r.empresa === "carvalho_cruz" ? "carvalho_cruz" : "cvc",
  periodo: r.periodo,
  indicador: r.indicador,
  fruta: r.fruta ?? "",
  valor: num(r.valor),
  criadoEm: r.criado_em,
  atualizadoEm: r.atualizado_em,
});

// ─── nfe_arquivadas ─────────────────────────────────────────────────────────
//
// A NF-e cancelada de um pedido que foi apagado (migracao-52). O pedido some
// — senão vira venda falsa —, mas a nota fica: SPED Fiscal e XML do contador.
// Mesmos nomes de campo da venda, para a aba Notas Fiscais tratar igual.

const nfeArquivadaParaDB = (n) => ({
  id: n.id,
  numero_pedido: n.numero ?? null,
  loja_id: n.lojaId || null,
  cliente_nome: n.clienteNome || null,
  cliente_cnpj: n.clienteCnpj || null,
  data: n.data || null,
  total: num(n.total),
  nfe_status: n.nfeStatus || "cancelada",
  nfe_numero: n.nfeNumero ?? null,
  nfe_serie: n.nfeSerie ?? null,
  nfe_chave: n.nfeChave || null,
  nfe_spedy_id: n.spedyId || null,
  nfe_emitida_em: n.nfeEmitidaEm ?? null,
  nfe_motivo_cancelamento: n.nfeMotivoCancelamento || null,
  nfe_cce_em: n.nfeCceEm ?? null,
  nfe_cce_texto: n.nfeCceTexto || null,
  pedido_apagado_em: n.pedidoApagadoEm ?? new Date().toISOString(),
  origem: n.origem === "spedy" ? "spedy" : "pedido_apagado",
});

const nfeArquivadaDoDB = (r) => ({
  id: r.id,
  numero: r.numero_pedido ?? null,
  lojaId: r.loja_id ?? "",
  clienteNome: r.cliente_nome ?? "",
  clienteCnpj: r.cliente_cnpj ?? "",
  data: r.data ?? "",
  total: num(r.total),
  nfeStatus: r.nfe_status ?? "cancelada",
  nfeNumero: r.nfe_numero ?? null,
  nfeSerie: r.nfe_serie ?? null,
  nfeChave: r.nfe_chave ?? "",
  spedyId: r.nfe_spedy_id ?? "",
  nfeEmitidaEm: r.nfe_emitida_em ?? null,
  nfeMotivoCancelamento: r.nfe_motivo_cancelamento ?? "",
  nfeCceEm: r.nfe_cce_em ?? null,
  nfeCceTexto: r.nfe_cce_texto ?? "",
  pedidoApagadoEm: r.pedido_apagado_em ?? null,
  origem: r.origem === "spedy" ? "spedy" : "pedido_apagado",
});

// ─── sinalizacoes_clientes ──────────────────────────────────────────────────
//
// O que quem cuida dos clientes marcou num alerta da Previsão de Pedidos
// (migracao-56): "me lembre em", "ciente" ou "parou de pedir", com o motivo.
// Encerrar é gravar `encerrada_em` — nada é apagado, fica o histórico.

const TIPOS_SINAL = ["lembrar", "ciente", "parou"];

const sinalizacaoParaDB = (s) => ({
  id: s.id,
  loja_id: s.lojaId,
  tipo: TIPOS_SINAL.includes(s.tipo) ? s.tipo : "ciente",
  data: s.data || null,
  motivo: s.motivo || null,
  ultimo_pedido: s.ultimoPedido || null,
  autor: s.autor || null,
  encerrada_em: s.encerradaEm ?? null,
  criado_em: s.criadoEm ?? new Date().toISOString(),
  atualizado_em: s.atualizadoEm ?? new Date().toISOString(),
});

const sinalizacaoDoDB = (r) => ({
  id: r.id,
  lojaId: r.loja_id ?? "",
  tipo: TIPOS_SINAL.includes(r.tipo) ? r.tipo : "ciente",
  data: r.data ?? "",
  motivo: r.motivo ?? "",
  ultimoPedido: r.ultimo_pedido ?? "",
  autor: r.autor ?? "",
  encerradaEm: r.encerrada_em ?? null,
  criadoEm: r.criado_em,
  atualizadoEm: r.atualizado_em,
});

export const MAPEADORES = {
  redes: { paraDB: redeParaDB, doDB: redeDoDB },
  lojas: { paraDB: lojaParaDB, doDB: lojaDoDB },
  fornecedores: { paraDB: fornecedorParaDB, doDB: fornecedorDoDB },
  produtos: { paraDB: produtoParaDB, doDB: produtoDoDB },
  vendas: { paraDB: vendaParaDB, doDB: vendaDoDB },
  compras: { paraDB: compraParaDB, doDB: compraDoDB },
  perdas: { paraDB: perdaParaDB, doDB: perdaDoDB },
  despesas: { paraDB: despesaParaDB, doDB: despesaDoDB },
  acertos: { paraDB: acertoParaDB, doDB: acertoDoDB },
  veiculos: { paraDB: veiculoParaDB, doDB: veiculoDoDB },
  abastecimentos: { paraDB: abastecimentoParaDB, doDB: abastecimentoDoDB },
  funcionarios: { paraDB: funcionarioParaDB, doDB: funcionarioDoDB },
  pagamentos: { paraDB: pagamentoParaDB, doDB: pagamentoDoDB },
  notas_entrada: { paraDB: notaEntradaParaDB, doDB: notaEntradaDoDB },
  insumos_itens: { paraDB: insumoItemParaDB, doDB: insumoItemDoDB },
  contagens_insumos: { paraDB: contagemInsumoParaDB, doDB: contagemInsumoDoDB },
  precos_produtos: { paraDB: precoProdutoParaDB, doDB: precoProdutoDoDB },
  metas: { paraDB: metaParaDB, doDB: metaDoDB },
  nfe_arquivadas: { paraDB: nfeArquivadaParaDB, doDB: nfeArquivadaDoDB },
  sinalizacoes_clientes: { paraDB: sinalizacaoParaDB, doDB: sinalizacaoDoDB },
};

export const paraDB = (colecao, item) => MAPEADORES[colecao].paraDB(item);
export const doDB = (colecao, linha) => MAPEADORES[colecao].doDB(linha);

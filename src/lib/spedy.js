/**
 * Emissão de NF-e via Spedy.
 *
 * Migração da integração que antes usava o Omie (src/lib/omie.js, mantido
 * no repo por enquanto só como referência histórica — ver README). Troca
 * decidida pela Carvalho Cruz: mais barato, chave de API fixa (sem OAuth
 * pra manter vivo) e sandbox de testes de verdade, além de não precisar de
 * uma etapa de "resolver código interno" de cliente/produto como o Omie
 * pedia — o CNPJ e os dados do produto vão direto no corpo do pedido de
 * emissão.
 *
 * Diferente do Omie (uma chamada síncrona que já fatura), a emissão pela
 * Spedy é sempre assíncrona: o POST só enfileira a nota (status:
 * "enqueued"); a autorização de verdade vem depois, via consulta ou
 * webhook. `emitirNfeParaVenda` faz o polling por enquanto (mais simples
 * que configurar webhook agora); dá pra trocar por webhook depois sem
 * mudar a tela de Vendas, já que ela só espera o resultado final.
 *
 * Regime tributário: Lucro Presumido (confirmado com a Carvalho Cruz) — os
 * itens usam `cst`, não `csosn` (que é só pra quem é Simples Nacional).
 * O CST 40 (isenta) e a observação fiscal abaixo vêm de uma NF-e real já
 * emitida pela empresa (produtos de produção própria — laranja, abóbora —
 * são isentos de ICMS em Sergipe: RICMS/SE, Anexo I, Tabela I, item 23,
 * inciso I, alínea "e"). Item comprado de terceiro pra revenda usaria CST
 * 00 (tributado) — não é o caso dos 7 produtos cadastrados hoje, que são
 * todos produção própria (CFOP 5.101).
 *
 * O que ainda não foi confirmado contra a API de verdade (só contra a
 * documentação e uma nota já emitida por outro emissor) e pode precisar de
 * ajuste ao testar no sandbox:
 *   - CST de PIS/COFINS para item isento de ICMS (usando "07" — "Operação
 *     isenta da contribuição" — como palpite).
 *   - Nomes dos campos da nota já autorizada (`number`, `series`,
 *     `accessKey` são palpites com base no padrão camelCase da API).
 */

import { pendenciasNfe, separarNumero } from "./cadastro";
import { hojeISO, vencimentoDe } from "./datas";
import { pedidoCompraDaVenda } from "./pedidoPdf";

const ENDPOINT = "/api/spedy";

// Versão das regras da nota (código e descrição dos produtos). Vai em toda
// chamada ao api/spedy.js, que só deixa emitir NF-e com a versão mínima de
// lá — aparelho com o app antigo aberto (a atualização do PWA espera a
// pessoa aceitar o aviso) não emite nota com as regras velhas. Ao mudar o
// que vai no item da nota, suba aqui E em VERSAO_NFE_MINIMA no api/spedy.js.
const VERSAO_NFE = 3;

// Regra observada numa NF-e real da empresa: frete "(9) Sem Frete", sem
// transportadora nem veículo preenchidos.
const FREIGHT_MODALITY_SEM_FRETE = 9;

// Mesma isenção citada na nota real (RICMS/SE) — repetida aqui pra não
// depender de digitar de novo toda vez que for confirmar/ajustar.
const OBSERVACAO_ISENCAO =
  'MERCADORIA ISENTA CONFORME ANEXO I TABELA I ITEM 23 INCISO I. ' +
  'Base Legal da Isenção: Item 23, Inciso I, alínea "e", da Tabela I, do Anexo I do RICMS/SE.';

function soDigitos(v) {
  return String(v || "").replace(/\D/g, "");
}

/**
 * Tira do corpo de erro da Spedy o motivo legível. Ela não responde sempre
 * no mesmo formato — `message` (texto ou lista), `errors` (lista, ou objeto
 * campo → mensagens, no padrão "problem+json"), `title`/`detail` — e o erro
 * 400 genérico, sem o motivo, não diz o que corrigir.
 */
function motivoDoErro(dados, texto) {
  const partes = [];
  const add = (v) => {
    if (!v) return;
    if (Array.isArray(v)) v.forEach(add);
    else if (typeof v === "object") partes.push(v.message || v.description || v.detail || JSON.stringify(v));
    else partes.push(String(v));
  };
  if (dados && typeof dados === "object") {
    add(dados.message);
    if (dados.errors && typeof dados.errors === "object" && !Array.isArray(dados.errors)) {
      for (const [campo, msgs] of Object.entries(dados.errors)) {
        partes.push(`${campo}: ${[].concat(msgs).join(", ")}`);
      }
    } else {
      add(dados.errors);
    }
    add(dados.detail);
    add(dados.erro);
    if (!partes.length) add(dados.title);
  }
  if (!partes.length && texto) partes.push(texto.slice(0, 500));
  return partes.join("\n");
}

const corta = (v, max) => {
  const t = String(v ?? "").trim();
  return t ? t.slice(0, max) : undefined;
};


async function chamarSpedy(method, path, body, emitente) {
  const resposta = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, method, body, versaoNfe: VERSAO_NFE, emitente }),
  });
  const texto = await resposta.text().catch(() => "");
  let dados;
  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    dados = null;
  }

  if (!resposta.ok) {
    const motivo = motivoDoErro(dados, texto);
    const erro = new Error(
      motivo
        ? `Spedy recusou (HTTP ${resposta.status}):\n${motivo}`
        : `Spedy recusou ${method} ${path} (HTTP ${resposta.status})`
    );
    // Quem chama às vezes precisa distinguir o motivo, não só mostrar o texto.
    erro.status = resposta.status;
    erro.dados = dados;
    throw erro;
  }
  return dados;
}

/**
 * Unidade do item na nota. Agranel vendido por unidade sai como UN; vendido
 * por quilo sai como KG mesmo que o cadastro do Omie diga UN (melancia,
 * tangerina): a quantidade digitada é em quilos. Saco usa a unidade do
 * cadastro (BAG).
 */
export function unidadeDaNota(produto, item) {
  if (item.unidade === "un") return "UN";
  if (produto.unidadeVenda === "kg") return "KG";
  return produto.unidadeOmie || "UN";
}

/** CFOP da venda do produto, em número (5101). */
const cfopDeVenda = (produto) => Number(String(produto.cfopPadrao || "5101").replace(".", ""));

// CSTs que o app emite. ICMS: 40 isenta, 41 não tributada, 50 suspensão,
// 60 ST já recolhida — sem base nem alíquota — e 00, tributada integralmente,
// com a alíquota do cadastro do produto (maçã, pera, kiwi, ameixa e coco a
// 19%, como o Omie emitia). PIS/COFINS: 04 monofásica, 05 ST, 06 alíquota
// zero, 07 isenta, 08 sem incidência, 09 suspensão. PIS/COFINS com alíquota
// (01) nenhum produto usa, e segue recusado.
const CST_ICMS_SEM_ALIQUOTA = ["40", "41", "50", "60"];
const CST_ICMS_TRIBUTADO = ["00"];
const CST_PIS_COFINS_SEM_ALIQUOTA = ["04", "05", "06", "07", "08", "09"];

/**
 * A tributação do item, tirada do cadastro do produto (migracao-28). Os
 * produtos de produção própria da Carvalho Cruz sem nada cadastrado ficam com
 * a de sempre (CST 40 / 07 / 07); revenda (CVC) precisa da dela.
 */
export function tributacaoDoProduto(produto) {
  const legado = produto.empresa !== "cvc";
  const icms = String(produto.icmsCst || (legado ? "40" : "")).trim();
  const pis = String(produto.pisCst || (legado ? "07" : "")).trim();
  const cofins = String(produto.cofinsCst || (legado ? "07" : "")).trim();
  const origem = Number.isInteger(Number(produto.origem)) && produto.origem !== null && produto.origem !== "" ? Number(produto.origem) : 0;

  if (!icms || !pis || !cofins) {
    throw new Error(
      `O produto "${produto.nome}" ainda não tem a tributação cadastrada (CST de ICMS, PIS e COFINS).\n\n` +
      "Confirme com o contador e preencha em Estoque → lápis do produto → Dados da nota fiscal."
    );
  }
  const tributado = CST_ICMS_TRIBUTADO.includes(icms);
  if ((!tributado && !CST_ICMS_SEM_ALIQUOTA.includes(icms)) ||
      !CST_PIS_COFINS_SEM_ALIQUOTA.includes(pis) || !CST_PIS_COFINS_SEM_ALIQUOTA.includes(cofins)) {
    throw new Error(
      `O produto "${produto.nome}" tem uma tributação que o app não emite (ICMS CST ${icms}, PIS ${pis}, COFINS ${cofins}). ` +
      "Emita esta nota direto no painel do Spedy."
    );
  }
  const aliquota = Number(produto.icmsAliquota);
  if (tributado && !(aliquota > 0 && aliquota < 100)) {
    throw new Error(
      `O produto "${produto.nome}" é tributado (ICMS CST ${icms}) mas está sem a alíquota do ICMS.\n\n` +
      "Preencha em Estoque → lápis do produto → Dados da nota fiscal."
    );
  }
  return {
    icms: { origin: origem, cst: icms },
    pis: { cst: pis },
    cofins: { cst: cofins },
    // Só no CST 00: a base e o valor dependem do item, calculados na nota.
    ...(tributado && { aliquotaIcms: aliquota }),
  };
}

/**
 * ICMS destacado do item (CST 00), no formato da Spedy: base de cálculo pelo
 * valor da operação (modBC 3), igual às notas que o Omie emitia —
 * vBC = valor do item, vICMS = vBC × alíquota. O ICMS é "por dentro": não
 * soma no total da nota.
 */
function icmsDestacado(totalItem, aliquota) {
  return {
    baseTaxModality: 3,
    baseTax: totalItem,
    rate: aliquota,
    amount: Number(((totalItem * aliquota) / 100).toFixed(2)),
  };
}

/**
 * Código do produto que vai na NF-e (cProd). É o `codigo` do cadastro (o SKU
 * PRD000… que as notas do Omie já usavam, e que o ERP dos clientes já
 * conhece). Nunca o id interno: UUID com hífens e 36 caracteres é recusado
 * pelo sistema de entrada de nota de clientes como a Rede Mais — por isso
 * o código é obrigatório e só aceita letras e números.
 */
export function codigoDaNota(produto) {
  const codigo = String(produto.codigo || "").trim();
  if (!codigo) {
    throw new Error(
      `O produto "${produto.nome}" ainda não tem código cadastrado.\n\n` +
      "Preencha em Estoque → lápis do produto → Código do produto (ex.: PRD00016)."
    );
  }
  if (!/^[0-9A-Za-z]+$/.test(codigo)) {
    throw new Error(
      `O código "${codigo}" do produto "${produto.nome}" tem espaço, hífen ou outro símbolo — ` +
      "o sistema de alguns clientes recusa a nota. Use só letras e números (ex.: PRD00016)."
    );
  }
  return codigo;
}

/**
 * Descrição do produto na NF-e (xProd). Saco sai com a fruta e o peso —
 * "Saco Laranja Pera In Natura 10 kg" —, não só "Saco 10 kg" (pedido dos
 * clientes: o nome curto não diz o que é). O resto sai com o nome do
 * cadastro.
 */
export function descricaoDaNota(produto) {
  if (produto.unidadeVenda === "saco" && produto.fruta && Number(produto.kgPorUnidade) > 0) {
    const kg = Number(produto.kgPorUnidade).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
    return `Saco ${produto.fruta} In Natura ${kg} kg`;
  }
  return produto.nome;
}

/**
 * Um item da NF-e no formato da Spedy — o mesmo na venda e na devolução
 * (muda só o CFOP e a quantidade). Lança erro claro quando o produto não
 * tem NCM, em vez de deixar a SEFAZ rejeitar.
 */
function itemDaNota({ produto, item, cfop }) {
  if (!produto.ncm) throw new Error(`O produto "${produto.nome}" ainda não tem NCM cadastrado.`);

  const totalItem = Number((item.qty * item.precoUnitario).toFixed(2));
  const unidade = unidadeDaNota(produto, item);
  const { aliquotaIcms, ...tributos } = tributacaoDoProduto(produto);
  if (aliquotaIcms) tributos.icms = { ...tributos.icms, ...icmsDestacado(totalItem, aliquotaIcms) };

  return {
    code: codigoDaNota(produto),
    description: descricaoDaNota(produto),
    ncm: soDigitos(produto.ncm),
    cfop,
    unit: unidade,
    quantity: item.qty,
    unitAmount: item.precoUnitario,
    totalAmount: totalItem,
    // Campos de tributação (unitTax/quantityTax/unitTaxAmount) são
    // separados dos comerciais no schema da Spedy — sem eles a base
    // tributável fica zerada e a SEFAZ rejeita o item (vProd ≠
    // quantityTax × unitTaxAmount). Não há conversão de unidade aqui,
    // então espelham os valores comerciais.
    unitTax: unidade,
    quantityTax: item.qty,
    unitTaxAmount: item.precoUnitario,
    taxes: {
      ...tributos,
      // IBS/CBS (Reforma Tributária, LC 214/2025) propositalmente NÃO
      // preenchido: a SEFAZ-SE em produção ainda não exige (confirmado
      // com o suporte da Spedy e numa NF-e real emitida hoje por outro
      // emissor sem esses campos) — só o Homologação deles valida (e
      // rejeita por engano tanto lá quanto em produção quando o campo
      // vem preenchido errado, então mais seguro nem mandar por
      // enquanto). Enquadramento já confirmado com o contador pra
      // quando for preciso: CST 200, cClassTrib 200014 (Anexo XV),
      // redução de 100% — falta só descobrir o formato exato aceito
      // pela Spedy (rate/amount não bateram em duas tentativas).
    },
  };
}

/**
 * Destinatário da nota a partir da ficha da loja. Na nota de devolução
 * (entrada) é a mesma loja: em NF-e de entrada o grupo "destinatário"
 * guarda quem está mandando a mercadoria de volta.
 */
function destinatarioDaLoja(loja) {
  const endereco = separarNumero(loja.numero, loja.complemento);
  return {
    // A nota sai no nome registrado na Receita; o nome curto da loja
    // ("CD", "FILIAL") só entra quando a ficha ainda não tem razão social.
    // xNome da NF-e aceita até 60 caracteres.
    name: corta(loja.razaoSocial || loja.nome, 60),
    federalTaxNumber: soDigitos(loja.cnpjCpf),
    stateTaxNumber: soDigitos(loja.ie) || undefined,
    address: {
      // Limites da NF-e: logradouro, complemento e bairro até 60.
      street: corta(loja.logradouro, 60),
      number: endereco.numero,
      additionalInformation: corta(endereco.complemento, 60),
      district: corta(loja.bairro, 60),
      postalCode: soDigitos(loja.cep),
      city: { name: loja.cidade, state: loja.uf },
    },
  };
}

/**
 * Monta o corpo de POST /product-invoices a partir de uma venda do app.
 *
 * Lança erro com mensagem clara (não deixa a Spedy rejeitar com um erro
 * genérico) quando falta cadastro: loja sem CNPJ, ou produto sem NCM.
 */
export function montarNotaSpedy({ venda, loja, produtosPorId }) {
  if (!loja) throw new Error("Essa venda não está ligada a nenhuma loja.");
  // O que a SEFAZ confere no destinatário (CNPJ, IE, endereço): melhor
  // dizer aqui o que corrigir do que receber um 400 da Spedy.
  const pendencias = pendenciasNfe(loja);
  if (pendencias.length) {
    throw new Error(
      `O cadastro da loja "${loja.nome}" não está pronto para NF-e:\n• ${pendencias.join("\n• ")}\n\n` +
      "Corrija em Clientes → abrir a loja → Editar, e emita de novo."
    );
  }

  const itensFaturaveis = (venda.itens ?? []).filter((i) => i.natureza !== "bonificacao");
  if (!itensFaturaveis.length) {
    throw new Error("Essa venda só tem itens de bonificação — não há o que faturar.");
  }

  const items = itensFaturaveis.map((item) => {
    const produto = produtosPorId[item.produtoId];
    if (!produto) throw new Error(`Produto ${item.produtoId} não encontrado.`);
    return itemDaNota({ produto, item, cfop: cfopDeVenda(produto) });
  });

  const total = Number(items.reduce((soma, i) => soma + i.totalAmount, 0).toFixed(2));
  // `venda.vencimento` nunca vem preenchido no objeto do app (é coluna
  // gerada só no Postgres — o mapper não a lê de volta), então precisa
  // recalcular aqui. É isso que a SEFAZ checa na regra Y09-40 (NT
  // 2025.001): duplicata única com vencimento == emissão é tratada como
  // à vista e rejeitada (853) se houver dados de cobrança.
  //
  // A nota é datada no momento em que é emitida, não na data da venda: uma
  // venda lançada dias antes saía com emissão no passado (NF 6: emissão
  // 18/09, autorização 24/09), e com mais de 30 dias a SEFAZ recusa.
  // Emitida depois do vencimento combinado, a duplicata não pode ficar
  // vencida nem no dia da emissão (853 acima): vai para o dia seguinte.
  const hoje = hojeISO();
  const vencimentoCombinado = vencimentoDe(venda.data, venda.prazoDias);
  const vencimento = vencimentoCombinado > hoje ? vencimentoCombinado : vencimentoDe(hoje, 1);
  const aPrazo = Number(venda.prazoDias) > 0;

  return {
    integrationId: venda.id,
    effectiveDate: new Date().toISOString(),
    operationNature: "Venda de Mercadoria Adquirida/Recebida de Terceiros",
    isFinalCustomer: false,
    receiver: destinatarioDaLoja(loja),
    transport: { freightModality: FREIGHT_MODALITY_SEM_FRETE },
    // "Depósito bancário" é um meio de pagamento à vista pra SEFAZ —
    // pareado com duplicata de vencimento futuro, ela rejeita (853) por
    // contradição. Venda a prazo usa "duplicata mercantil", que é o meio
    // de pagamento que corresponde ao grupo Fatura/duplicates abaixo.
    payments: [{ method: aPrazo ? "commercialDuplicate" : "bankDeposit", amount: total }],
    // O grupo "Fatura" (billing + duplicates, campos irmãos no payload —
    // duplicates NÃO fica dentro de billing) só pode ir em venda a prazo:
    // a SEFAZ rejeita (853, regra Y09-40 da NT 2025.001) uma duplicata
    // única cujo vencimento seja igual à emissão, tratando como à vista.
    ...(aPrazo
      ? {
          billing: { number: "001", originalAmount: total, discountAmount: 0, netAmount: total },
          duplicates: [{ number: "001", dueDate: vencimento, amount: total }],
        }
      : {}),
    // Pedido importado de PDF: clientes como o Atakarejo exigem o número do
    // pedido de compra deles na nota ("NUMERO DO PEDIDO DEVE CONSTAR NA NOTA").
    // Depois, a observação digitada no pedido (campo "Observação" da Nova
    // Venda); a isenção sai sempre, por último.
    additionalInformation: [
      pedidoCompraDaVenda(venda) && `Pedido de compra nº ${pedidoCompraDaVenda(venda)}.`,
      venda.observacaoNf?.trim(),
      OBSERVACAO_ISENCAO,
    ].filter(Boolean).join(" "),
    items,
  };
}

/** Cria a nota na Spedy. Devolve o objeto criado (com `id` e `status: "enqueued"`). */
export async function criarNotaSpedy(payload, emitente) {
  return chamarSpedy("POST", "/product-invoices", payload, emitente);
}

/** Consulta uma nota pelo id (pra saber se já foi autorizada/rejeitada). */
export async function consultarNotaSpedy(id, emitente) {
  return chamarSpedy("GET", `/product-invoices/${id}`, undefined, emitente);
}

/** Link direto (clicável) pro PDF do DANFe, via o proxy autenticado. */
export function danfeUrlSpedy(id) {
  return `${ENDPOINT}?path=${encodeURIComponent(`/product-invoices/${id}/pdf`)}`;
}

/** XML autorizado da nota (o arquivo que o contador pede e que se guarda por 5 anos). */
export function xmlUrlSpedy(id) {
  return `${ENDPOINT}?path=${encodeURIComponent(`/product-invoices/${id}/xml`)}`;
}

/**
 * Dados do cancelamento (protocolo, data, justificativa) como a Spedy devolve
 * na consulta da nota. A API NÃO tem download do XML do evento de
 * cancelamento (procEventoNFe) — esse só sai pelo portal da Spedy ou da SEFAZ.
 */
export async function obterDadosCancelamentoSpedy(id) {
  const nota = await consultarNotaSpedy(id);
  const c = nota?.cancellation;
  if (!c) return null;
  return { protocolo: c.protocol ?? "", data: c.date ?? "", justificativa: c.justification ?? "" };
}

/**
 * A nota autorizada que já está na Spedy com este integrationId, se houver.
 * Filtra de novo aqui porque a listagem pode ignorar o parâmetro e devolver
 * outras notas.
 */
async function buscarNotaAutorizada(integrationId, emitente) {
  const qs = new URLSearchParams({ integrationId });
  const dados = await chamarSpedy("GET", `/product-invoices?${qs}`, undefined, emitente);
  const lista = Array.isArray(dados) ? dados : dados?.items ?? dados?.data ?? [];
  const achada = lista.find((n) => n?.integrationId === integrationId && n?.status === "authorized");
  // A listagem pode vir resumida: consulta pelo id para ter número, série e chave.
  return achada ? consultarNotaSpedy(achada.id, emitente) : null;
}

const aguardar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A emissão é assíncrona (a Spedy enfileira e manda pra SEFAZ depois), por
 * isso consulta de novo algumas vezes com um intervalo curto antes de
 * desistir — mesma lógica usada com o Omie, só que aqui dá pra trocar por
 * webhook mais pra frente sem mexer em quem chama esta função.
 */
export async function aguardarAutorizacao(id, emitente) {
  const tentativas = 8;

  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const nota = await consultarNotaSpedy(id, emitente);

    if (nota?.status === "authorized") return nota;
    if (nota?.status === "rejected") {
      const motivo = nota.processingDetail?.message || nota.processingDetail?.code || "motivo não informado pela Spedy";
      throw new Error(`Nota rejeitada pela SEFAZ: ${motivo}`);
    }

    if (tentativa < tentativas) await aguardar(2000);
  }

  throw new Error(
    "Nota enfileirada, mas ainda não foi autorizada — confira de novo em alguns segundos."
  );
}

/**
 * Orquestra o fluxo inteiro: monta a nota, cria (enfileira) e espera a
 * autorização da SEFAZ. É essa função que o botão "Emitir NF-e" na tela de
 * Vendas chama (no lugar de emitirNfeParaVenda do src/lib/omie.js).
 */
/**
 * Quem emite a nota: a CVC (padrão) ou a Carvalho Cruz, conforme a empresa
 * dos produtos. Uma nota sai por um CNPJ só — venda com produtos dos dois
 * emitentes precisa ser dividida em duas.
 */
export function emitenteDaVenda(venda, produtosPorId) {
  const emitentes = new Set(
    (venda.itens ?? [])
      .filter((i) => i.natureza !== "bonificacao")
      .map((i) => (produtosPorId[i.produtoId]?.empresa === "carvalho_cruz" ? "carvalho_cruz" : "cvc"))
  );
  if (emitentes.size > 1) {
    throw new Error(
      "Esta venda mistura produtos faturados pela CVC e pela Carvalho Cruz. " +
      "Divida em dois pedidos (um por emitente) para emitir as notas."
    );
  }
  return [...emitentes][0] ?? "cvc";
}

export async function emitirNfeParaVenda({ venda, loja, produtosPorId }) {
  const emitente = emitenteDaVenda(venda, produtosPorId);
  const payload = montarNotaSpedy({ venda, loja, produtosPorId });
  let nota;
  try {
    const criada = await criarNotaSpedy(payload, emitente);
    nota = await aguardarAutorizacao(criada.id, emitente);
  } catch (erro) {
    // A nota vai com integrationId = id da venda, então a Spedy não cria
    // uma segunda: se a primeira já foi autorizada (ex.: ficou presa num
    // fechamento de mês e a Spedy reprocessou depois de reabrir), o POST
    // volta 400 "Nota fiscal está autorizada". A nota existe e vale — só
    // falta o app saber dela.
    if (erro.status !== 400 || !/autorizada/i.test(erro.message)) throw erro;
    nota = await buscarNotaAutorizada(venda.id, emitente);
    if (!nota) {
      throw new Error(
        "A Spedy diz que a nota desta venda já está autorizada, mas não deu para encontrá-la " +
        "pela API. Confira no painel da Spedy (a nota sai com o id da venda como código de " +
        "integração) antes de tentar emitir de novo.",
        { cause: erro }
      );
    }
  }

  return {
    spedyId: nota.id,
    nfeStatus: "autorizada",
    nfeNumero: nota.number ?? null,
    nfeSerie: nota.series ?? null,
    nfeChave: nota.accessKey ?? null,
    nfeDanfeUrl: danfeUrlSpedy(nota.id),
    nfeEmitidaEm: new Date().toISOString(),
  };
}

/** Pede o cancelamento de uma nota autorizada, com a justificativa exigida pela SEFAZ. */
export async function cancelarNotaSpedy(id, motivo) {
  return chamarSpedy("DELETE", `/product-invoices/${id}`, { reason: motivo });
}

/**
 * O cancelamento também é assíncrono — mesma lógica de espera da emissão,
 * só que aguardando o status virar "canceled" em vez de "authorized". Na
 * prática demora mais que autorizar (visto num teste real: passou dos 16s
 * que bastavam pra emissão), por isso mais tentativas aqui.
 */
export async function aguardarCancelamento(id) {
  const tentativas = 15;

  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const nota = await consultarNotaSpedy(id);

    if (nota?.status === "canceled") return nota;
    if (tentativa < tentativas) await aguardar(2000);
  }

  throw new Error(
    "Cancelamento enviado, mas a SEFAZ ainda não confirmou. Aguarde um minuto e clique em " +
    "Cancelar de novo: o app confere a situação e só atualiza, sem pedir outra vez."
  );
}

/**
 * Orquestra o cancelamento: pede, espera confirmar e devolve os campos que
 * a tela de Vendas usa pra atualizar o status da venda.
 */
export async function cancelarNfeDaVenda({ spedyId, motivo }) {
  const pronto = { nfeStatus: "cancelada", nfeMotivoCancelamento: motivo };

  // Consulta antes de pedir: se um clique anterior já cancelou (a
  // confirmação demora e a espera pode estourar antes), a Spedy recusa um
  // segundo pedido com "A nota fiscal não pode ser cancelada". Aqui isso vira
  // só a atualização do status no app.
  const antes = await consultarNotaSpedy(spedyId);
  if (antes?.status === "canceled") return pronto;
  if (antes?.status && antes.status !== "authorized") {
    // Já tem um cancelamento andando: só espera terminar.
    if (/cancel/i.test(antes.status)) {
      await aguardarCancelamento(spedyId);
      return pronto;
    }
    throw new Error(
      `A Spedy informa a nota como "${antes.status}"${detalhe(antes)} — só dá para cancelar nota autorizada.`
    );
  }

  try {
    await cancelarNotaSpedy(spedyId, motivo);
  } catch (erro) {
    // Recusou: confere de novo — pode ter cancelado entre a consulta e o pedido.
    const depois = await consultarNotaSpedy(spedyId).catch(() => null);
    if (depois?.status === "canceled") return pronto;
    if (depois?.status && /cancel/i.test(depois.status)) {
      await aguardarCancelamento(spedyId);
      return pronto;
    }
    throw new Error(
      `${erro.message}\n\nSituação da nota na Spedy: "${depois?.status ?? "não consultada"}"${detalhe(depois)}. ` +
      "A SEFAZ só aceita cancelar em até 24 horas depois da autorização.",
      { cause: erro }
    );
  }
  await aguardarCancelamento(spedyId);
  return pronto;
}

/*
 * ─── Carta de correção (CC-e) do código e da descrição dos produtos ────────
 *
 * As notas emitidas pela Spedy até 29/09/2026 saíram com o id interno do
 * produto (UUID com hífens) no cProd, e o sistema de entrada de nota de
 * clientes como a Rede Mais recusa. O código do produto não mexe em valor,
 * quantidade, imposto nem destinatário, então dá para corrigir por CC-e sem
 * cancelar a nota.
 *
 * Em 01/10 entrou também a descrição: saco saía só "Saco 10 kg" (ver
 * descricaoDaNota).
 *
 * O texto sai do XML autorizado da própria nota (não da venda, que pode ter
 * mudado depois): cada item com cProd de UUID ou descrição diferente da do
 * cadastro vira "item N: onde se le X, leia-se Y". A SEFAZ vale a última
 * CC-e da nota, então o texto sempre traz todas as correções do item.
 *
 * O endereço da CC-e na API da Spedy NÃO foi conferido na documentação
 * (bloqueada no ambiente em que isto foi escrito), e o primeiro palpite
 * (POST …/correction-letter) voltou 404 em produção. Por isso tenta os
 * endereços prováveis em ordem: 404/405 quer dizer que aquele endereço não
 * existe — nada chegou à SEFAZ — e passa para o próximo. Qualquer outra
 * resposta (sucesso ou recusa de verdade) para ali. O corpo leva o texto nos
 * nomes de campo mais prováveis; a API ignora os que não conhece.
 */

/**
 * Notas emitidas antes disto podem ter código ou descrição errados: a NF 43
 * saiu com UUID (provavelmente aparelho com a versão antiga do app aberta).
 * Desde 01/10 o api/spedy.js recusa nota com código de UUID.
 */
export const CODIGO_ERRADO_ATE = "2026-10-02";
/** CC-e enviada antes disto só corrigiu o código — confere de novo a descrição. */
export const CCE_SO_CODIGO_ATE = "2026-10-01T12:00:00Z";

/** A nota entra na correção: autorizada, da época do erro e sem CC-e completa. */
export function precisaConferirCce({ status, spedyId, emitidaEm, cceEm }) {
  return status === "autorizada" && !!spedyId && String(emitidaEm || "") < CODIGO_ERRADO_ATE
    && (!cceEm || String(cceEm) < CCE_SO_CODIGO_ATE);
}

const CAMINHOS_CCE = [
  ["POST", (id) => `/product-invoices/${id}/correction-letters`],
  ["POST", (id) => `/product-invoices/${id}/correction`],
  ["POST", (id) => `/product-invoices/${id}/corrections`],
  ["PUT", (id) => `/product-invoices/${id}/correction-letter`],
  ["POST", (id) => `/product-invoices/${id}/events/correction-letter`],
  ["POST", (id) => `/product-invoices/${id}/cce`],
];

async function enviarCartaCorrecao(spedyId, texto) {
  // `letter` é o campo que a Spedy pede ("The Letter field is required",
  // HTTP 400 em produção); os outros ficam por garantia e são ignorados.
  const corpo = { letter: texto, correction: texto, text: texto, correctionText: texto, description: texto, reason: texto };
  const tentativas = [];
  for (const [metodo, caminho] of CAMINHOS_CCE) {
    try {
      return await chamarSpedy(metodo, caminho(spedyId), corpo);
    } catch (erro) {
      if (erro.status !== 404 && erro.status !== 405) throw erro;
      tentativas.push(`${metodo} ${caminho("{id}")} → HTTP ${erro.status}`);
    }
  }
  throw new Error(
    "A Spedy não aceitou a carta de correção em nenhum dos endereços testados (nada foi enviado à SEFAZ):\n• " +
    tentativas.join("\n• ")
  );
}
// A SEFAZ aceita de 15 a 1000 caracteres em xCorrecao.
const CCE_MIN = 15;
const CCE_MAX = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Itens do XML com código (cProd de UUID) ou descrição diferentes do
 * cadastro: { item, codigo: { errado, certo } | null, descricao: { errada, certa } | null }.
 */
export function itensACorrigir(xml, produtosPorId) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const tag = (raiz, nome) => raiz?.getElementsByTagNameNS("*", nome)?.[0]?.textContent?.trim() ?? "";
  const porCodigo = Object.fromEntries(
    Object.values(produtosPorId).filter((p) => p.codigo).map((p) => [String(p.codigo).trim(), p])
  );
  return [...doc.getElementsByTagNameNS("*", "det")]
    .map((det, i) => {
      const prod = det.getElementsByTagNameNS("*", "prod")[0];
      const item = Number(det.getAttribute("nItem")) || i + 1;
      const cProd = tag(prod, "cProd");
      const xProd = tag(prod, "xProd");
      const uuid = UUID.test(cProd);
      const produto = uuid ? (produtosPorId[cProd.toLowerCase()] ?? produtosPorId[cProd]) : porCodigo[cProd];
      if (!produto) {
        if (uuid) throw new Error(`O item ${item} (${xProd}) tem o código ${cProd}, que não é de nenhum produto do cadastro.`);
        return null; // código que não é UUID nem do cadastro: não mexe
      }
      const certo = codigoDaNota(produto);
      const certa = descricaoDaNota(produto);
      return {
        item,
        codigo: uuid ? { errado: cProd, certo } : null,
        descricao: xProd !== certa ? { errada: xProd, certa } : null,
      };
    })
    .filter((i) => i && (i.codigo || i.descricao));
}

/** Texto da CC-e; encurta (tira o que estava escrito antes) se passar de 1000 caracteres. */
export function textoCartaCorrecao(itens) {
  const inicio = "Correcao do codigo e/ou da descricao do produto, sem alteracao de valores, quantidades ou tributos. ";
  const partes = (i, completo) => [
    i.codigo && (completo ? `onde se le codigo ${i.codigo.errado}, leia-se ${i.codigo.certo}` : `codigo ${i.codigo.certo}`),
    i.descricao && (completo ? `onde se le descricao "${i.descricao.errada}", leia-se "${i.descricao.certa}"` : `descricao ${i.descricao.certa}`),
  ].filter(Boolean).join("; ");
  const formatos = [
    (i) => `Item ${i.item}: ${partes(i, true)}.`,
    (i) => `Item ${i.item}: ${partes(i, false)}.`,
  ];
  for (const f of formatos) {
    const texto = inicio + itens.map(f).join(" ");
    if (texto.length <= CCE_MAX) return texto;
  }
  throw new Error(`A nota tem ${itens.length} itens a corrigir — não cabem numa carta de correção (máx. ${CCE_MAX} caracteres).`);
}

/**
 * CC-e com o texto e o motivo escolhidos na tela: "Motivo: detalhe". Sem
 * acentos, como a automática. Devolve { texto }.
 */
export async function enviarCartaCorrecaoLivre({ spedyId, motivo, detalhe }) {
  const texto = `${motivo}: ${String(detalhe || "").trim()}`
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  if (texto.length < CCE_MIN) throw new Error(`Descreva melhor a correção (mínimo ${CCE_MIN} caracteres).`);
  if (texto.length > CCE_MAX) throw new Error(`O texto tem ${texto.length} caracteres; a SEFAZ aceita até ${CCE_MAX}.`);
  await enviarCartaCorrecao(spedyId, texto);
  return { texto };
}

/**
 * Corrige código e descrição de uma nota por CC-e. Devolve { texto } quando
 * enviou, ou { semErro: true } quando não há o que corrigir — inclusive
 * quando a nota já teve CC-e do código (`jaCorrigiuCodigo`) e a descrição
 * está certa.
 */
export async function corrigirCodigosDaNota({ spedyId, produtosPorId, jaCorrigiuCodigo = false }) {
  const resp = await fetch(xmlUrlSpedy(spedyId));
  if (!resp.ok) throw new Error(`Não consegui baixar o XML da nota (HTTP ${resp.status}).`);
  const itens = itensACorrigir(await resp.text(), produtosPorId);
  if (!itens.length || (jaCorrigiuCodigo && !itens.some((i) => i.descricao))) return { semErro: true };
  const texto = textoCartaCorrecao(itens);
  await enviarCartaCorrecao(spedyId, texto);
  return { texto };
}

/*
 * ─── Venda no painel da Spedy (POST /v1/orders) ─────────────────────────────
 *
 * A NF-e continua saindo por /product-invoices (montarNotaSpedy acima): é lá
 * que vão CST, isenção, duplicata e o resto que já foi acertado com a SEFAZ.
 * A "venda" da Spedy é só o registro comercial, pra operação aparecer na aba
 * Vendas do painel, concluída quando a nota é autorizada e cancelada quando a
 * nota é cancelada.
 *
 * `autoIssueMode: "disabled"` é o que importa aqui: sem ele a Spedy emitiria
 * uma SEGUNDA nota a partir da venda, com a tributação do backoffice.
 *
 * `transactionId` é o id da venda no app — a Spedy não duplica a venda se
 * vier de novo, e é por ele que a venda é achada na hora de cancelar (não
 * precisa guardar mais um id no banco).
 */

function montarVendaSpedy({ venda, loja, produtosPorId }) {
  const itens = (venda.itens ?? []).filter((i) => i.natureza !== "bonificacao");
  const items = itens.map((item) => {
    const produto = produtosPorId[item.produtoId];
    const nome = produto ? descricaoDaNota(produto) : item.produtoId;
    return {
      description: nome,
      quantity: item.qty,
      price: item.precoUnitario,
      amount: Number((item.qty * item.precoUnitario).toFixed(2)),
      product: { code: produto?.codigo?.trim() || item.produtoId, name: nome, price: item.precoUnitario, invoiceModel: "productInvoice" },
    };
  });
  const amount = Number(items.reduce((soma, i) => soma + i.amount, 0).toFixed(2));
  const endereco = separarNumero(loja.numero, loja.complemento);

  return {
    transactionId: venda.id,
    // Meio-dia de Aracaju: a data da venda não escorrega de dia no fuso.
    date: `${venda.data}T12:00:00-03:00`,
    amount,
    discountAmount: 0,
    status: "completed",
    autoIssueMode: "disabled",
    sendEmailToCustomer: false,
    paymentMethod: Number(venda.prazoDias) > 0 ? "other" : "bankTransfer",
    customer: {
      name: corta(loja.nome || loja.razaoSocial, 60),
      // A Spedy exige razão social na venda (400 "Razão social é
      // obrigatório"); sem ela na ficha, vai o nome — igual ao da NF-e.
      legalName: corta(loja.razaoSocial || loja.nome, 60),
      federalTaxNumber: soDigitos(loja.cnpjCpf) || undefined,
      stateTaxNumber: soDigitos(loja.ie) || undefined,
      address: {
        street: corta(loja.logradouro, 60),
        number: endereco.numero,
        additionalInformation: corta(endereco.complemento, 60),
        district: corta(loja.bairro, 60),
        postalCode: soDigitos(loja.cep) || undefined,
        city: { name: loja.cidade, state: String(loja.uf || "").toLowerCase() || undefined },
      },
    },
    items,
  };
}

const diaDeslocado = (dataISO, dias) => {
  const d = new Date(`${dataISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};

/**
 * A venda que já está na Spedy com este transactionId, se houver. A listagem
 * exige período (initialDate/endDate); a venda é gravada com a data da venda
 * ao meio-dia, então um dia de folga para cada lado basta.
 */
async function buscarVendaSpedy({ id: transactionId, data }) {
  const qs = new URLSearchParams({
    initialDate: `${diaDeslocado(data, -1)}T00:00:00-03:00`,
    endDate: `${diaDeslocado(data, 1)}T23:59:59-03:00`,
    transactionId,
  });
  const dados = await chamarSpedy("GET", `/orders?${qs}`);
  const lista = Array.isArray(dados) ? dados : dados?.items ?? [];
  return lista.find((o) => o?.transactionId === transactionId) ?? null;
}

/** Garante que a venda existe na Spedy (cria se ainda não existir) e devolve ela. */
export async function registrarVendaSpedy({ venda, loja, produtosPorId }) {
  if (!loja) throw new Error("Essa venda não está ligada a nenhuma loja.");
  const existente = await buscarVendaSpedy(venda);
  if (existente) return existente;
  return chamarSpedy("POST", "/orders", montarVendaSpedy({ venda, loja, produtosPorId }));
}

/**
 * Marca a venda como cancelada na Spedy. Uma venda cuja nota foi emitida
 * antes desta integração ainda não existe lá: é criada e cancelada em
 * seguida, pra nota cancelada aparecer do mesmo jeito no painel.
 */
export async function cancelarVendaSpedy({ venda, loja, produtosPorId, motivo }) {
  const pedido = await registrarVendaSpedy({ venda, loja, produtosPorId });
  if (pedido?.status === "canceled") return pedido;
  return chamarSpedy("DELETE", `/orders/${pedido.id}/cancel`, { reason: motivo });
}

/** Motivo que a Spedy anexa ao status da nota, quando há. */
function detalhe(nota) {
  const d = nota?.processingDetail;
  const texto = d?.message || d?.description || d?.code;
  return texto ? ` (${texto})` : "";
}

/*
 * ─── Nota de devolução (NF-e de entrada emitida pela distribuidora) ─────────
 *
 * Quando o cliente devolve mercadoria, quem emite a nota de devolução é, em
 * regra, o próprio cliente (se tem IE) — essa nota chega pelas notas
 * recebidas, que vêm direto da SEFAZ (lib/sefaz.js). Quando ele não emite (sem IE, produtor, pessoa
 * física, ou por orientação do contador), a distribuidora emite uma NF-e de
 * ENTRADA com finalidade "devolução", referenciando a chave da NF-e de venda.
 *
 * Diferenças para a nota de venda (montarNotaSpedy):
 *   - operationType "incoming" (tpNF 0) e purposeType "devolution" (finNFe 4);
 *   - referencedDocuments com a chave da nota original (NFref), obrigatório
 *     em nota de devolução;
 *   - CFOP de entrada correspondente (5.101 → 1.201, 5.102 → 1.202, e os
 *     equivalentes 6.xxx → 2.xxx em operação interestadual);
 *   - sem cobrança: pagamento "noPayment" (tPag 90), valor zero.
 * A tributação do item (CST 40, isenção do RICMS/SE) é a mesma da venda —
 * a devolução desfaz a operação nas mesmas condições.
 */

const CFOP_DEVOLUCAO = { 101: 201, 102: 202 };

/** CFOP de entrada da devolução a partir do CFOP da venda (5101 → 1201). */
export function cfopDevolucao(cfopVenda) {
  const c = Number(String(cfopVenda).replace(".", ""));
  const grupo = Math.floor(c / 1000);
  const final = CFOP_DEVOLUCAO[c % 1000];
  if (!final || (grupo !== 5 && grupo !== 6)) {
    throw new Error(
      `Não sei o CFOP de devolução para a venda com CFOP ${cfopVenda}. Confirme com o contador antes de emitir.`
    );
  }
  return (grupo === 5 ? 1000 : 2000) + final;
}

/**
 * Corpo de POST /product-invoices da nota de devolução. `itens` são os
 * itens da venda com a quantidade devolvida em `qty` (preço igual ao da
 * venda). `id` é o id do registro no app, usado como integrationId.
 */
export function montarNotaDevolucao({ id, venda, loja, produtosPorId, itens, motivo }) {
  if (!loja) throw new Error("Essa venda não está ligada a nenhuma loja.");
  if (!venda.nfeChave) throw new Error("A venda não tem a chave da NF-e — sem ela não dá para referenciar a devolução.");
  const pendencias = pendenciasNfe(loja);
  if (pendencias.length) {
    throw new Error(
      `O cadastro da loja "${loja.nome}" não está pronto para NF-e:\n• ${pendencias.join("\n• ")}`
    );
  }
  const devolvidos = itens.filter((i) => Number(i.qty) > 0);
  if (!devolvidos.length) throw new Error("Informe a quantidade devolvida de pelo menos um item.");

  const items = devolvidos.map((item) => {
    const produto = produtosPorId[item.produtoId];
    if (!produto) throw new Error(`Produto ${item.produtoId} não encontrado.`);
    return itemDaNota({ produto, item, cfop: cfopDevolucao(cfopDeVenda(produto)) });
  });

  const referencia = `Devolução referente à NF-e nº ${venda.nfeNumero ?? "?"}` +
    `${venda.nfeSerie != null ? `, série ${venda.nfeSerie}` : ""}, chave ${venda.nfeChave}.`;

  return {
    integrationId: id,
    effectiveDate: new Date().toISOString(),
    operationType: "incoming",
    purposeType: "devolution",
    operationNature: "Devolução de venda",
    referencedDocuments: [{ accessKey: soDigitos(venda.nfeChave) }],
    isFinalCustomer: false,
    receiver: destinatarioDaLoja(loja),
    transport: { freightModality: FREIGHT_MODALITY_SEM_FRETE },
    payments: [{ method: "noPayment", amount: 0 }],
    additionalInformation: [referencia, motivo ? `Motivo: ${motivo}.` : "", OBSERVACAO_ISENCAO]
      .filter(Boolean).join(" "),
    items,
  };
}

/** Campos do registro no app a partir da nota autorizada na Spedy. */
export const camposDaNotaAutorizada = (nota) => ({
  spedyId: nota.id,
  nfeStatus: "autorizada",
  nfeErro: "",
  numero: nota.number ?? null,
  serie: nota.series ?? null,
  chave: nota.accessKey ?? "",
  emitidaEm: new Date().toISOString(),
});

/**
 * Emite a nota de devolução e espera a SEFAZ autorizar (mesmo fluxo da
 * venda). `aoCriar(spedyId)` é chamado assim que a Spedy aceita a nota,
 * antes da espera: se a espera estourar, o app já sabe qual nota conferir
 * depois e não emite uma segunda.
 */
export async function emitirNotaDevolucao({ aoCriar, ...args }) {
  const payload = montarNotaDevolucao(args);
  // A devolução sai pelo mesmo CNPJ que emitiu a venda.
  const emitente = emitenteDaVenda(args.venda, args.produtosPorId);
  const criada = await criarNotaSpedy(payload, emitente);
  await aoCriar?.(criada.id);
  return camposDaNotaAutorizada(await aguardarAutorizacao(criada.id, emitente));
}

/*
 * ─── Recuperar NF-e canceladas de pedidos já apagados ───────────────────────
 *
 * Antes da migracao-52, apagar um pedido com NF-e cancelada levava a nota
 * junto. A Spedy continua com todas: lista as notas de lá, fica com as
 * canceladas que o app não conhece (nenhuma venda, arquivo ou devolução com
 * aquele id da Spedy) e monta o registro de nfe_arquivadas a partir do XML —
 * a fonte oficial de número, série, chave, emissão, destinatário e valor.
 */

const PAGINA_SPEDY = 100;

/** Todas as notas de produto da conta, página por página. */
async function listarNotasSpedy() {
  const vistas = new Map();
  for (let page = 1; page <= 200; page++) {
    const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGINA_SPEDY) });
    const dados = await chamarSpedy("GET", `/product-invoices?${qs}`);
    const lista = Array.isArray(dados) ? dados : dados?.items ?? dados?.data ?? [];
    // A API pode ignorar a paginação e devolver sempre a mesma página.
    const novas = lista.filter((n) => n?.id && !vistas.has(n.id));
    for (const n of novas) vistas.set(n.id, n);
    const total = Number(dados?.totalCount ?? dados?.total);
    if (!novas.length || lista.length < PAGINA_SPEDY || dados?.hasNext === false
      || (Number.isFinite(total) && vistas.size >= total)) break;
  }
  return [...vistas.values()];
}

/** Os dados que importam do XML da NF-e (procNFe ou NFe). */
export function dadosDoXmlNfe(xml) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const tag = (raiz, nome) => raiz?.getElementsByTagNameNS("*", nome)?.[0]?.textContent?.trim() ?? "";
  const ide = doc.getElementsByTagNameNS("*", "ide")[0];
  const dest = doc.getElementsByTagNameNS("*", "dest")[0];
  const infNFe = doc.getElementsByTagNameNS("*", "infNFe")[0];
  const chave = tag(doc, "chNFe") || String(infNFe?.getAttribute("Id") ?? "").replace(/^NFe/, "");
  return {
    numero: Number(tag(ide, "nNF")) || null,
    serie: tag(ide, "serie") === "" ? null : Number(tag(ide, "serie")),
    emitidaEm: tag(ide, "dhEmi") || null,
    tipo: tag(ide, "tpNF"), // 1 = saída, 0 = entrada
    finalidade: tag(ide, "finNFe"), // 4 = devolução
    chave,
    clienteNome: tag(dest, "xNome"),
    clienteCnpj: tag(dest, "CNPJ") || tag(dest, "CPF"),
    total: Number(tag(doc.getElementsByTagNameNS("*", "ICMSTot")[0], "vNF")) || 0,
  };
}

const motivoCancelamentoSpedy = (nota) =>
  nota?.cancellation?.reason || nota?.cancellationReason || nota?.cancelReason || nota?.reason || "";

/**
 * Canceladas na Spedy que o app não tem. `conhecidos` é o conjunto de ids da
 * Spedy já registrados (vendas, nfe_arquivadas, notas_entrada). `vendasPorId`
 * liga a nota ao pedido pelo integrationId (= id da venda), quando o pedido
 * ainda existe (nota cancelada e reemitida no mesmo pedido).
 *
 * Devolve { recuperadas, falhas }: `recuperadas` já no formato de nfe_arquivadas.
 */
export async function recuperarCanceladasSpedy({ conhecidos, vendasPorId, aoProgredir }) {
  const todas = await listarNotasSpedy();
  const candidatas = todas.filter((n) => !conhecidos.has(n.id) && (!n.status || /cancel/i.test(n.status)));
  const recuperadas = [];
  const falhas = [];
  for (let i = 0; i < candidatas.length; i++) {
    aoProgredir?.(i, candidatas.length);
    const resumo = candidatas[i];
    try {
      const nota = await consultarNotaSpedy(resumo.id);
      if (nota?.status !== "canceled") continue;
      let xml = {};
      try {
        const resp = await fetch(xmlUrlSpedy(nota.id));
        if (resp.ok) xml = dadosDoXmlNfe(await resp.text());
      } catch {
        // Sem XML, fica com o que a Spedy devolveu na consulta.
      }
      // Nota de entrada/devolução é da aba Devoluções, não desta relação.
      if (xml.tipo === "0" || xml.finalidade === "4") continue;
      const venda = vendasPorId.get(nota.integrationId);
      recuperadas.push({
        spedyId: nota.id,
        numero: venda?.numero ?? null,
        lojaId: venda?.lojaId ?? "",
        data: String(xml.emitidaEm || nota.effectiveDate || "").slice(0, 10) || null,
        total: xml.total || Number(nota.total?.invoiceAmount ?? nota.totalAmount ?? nota.amount) || 0,
        clienteNome: xml.clienteNome || nota.receiver?.name || "",
        clienteCnpj: xml.clienteCnpj || nota.receiver?.federalTaxNumber || "",
        nfeStatus: "cancelada",
        nfeNumero: xml.numero ?? nota.number ?? null,
        nfeSerie: xml.serie ?? nota.series ?? null,
        nfeChave: xml.chave || nota.accessKey || "",
        nfeEmitidaEm: xml.emitidaEm || nota.effectiveDate || null,
        nfeMotivoCancelamento: motivoCancelamentoSpedy(nota),
        origem: "spedy",
      });
    } catch (e) {
      falhas.push(`${resumo.number ? `NF ${resumo.number}` : resumo.id}: ${e.message}`);
    }
  }
  return { recuperadas, falhas, total: todas.length };
}

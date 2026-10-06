/**
 * Importar pedido em PDF — o pedido de compra que o cliente manda por e-mail
 * (Atakarejo, e qualquer outro) vira um rascunho de venda para a equipe
 * conferir. Nada é gravado sozinho: o resultado só preenche o formulário de
 * "Nova Venda", e quem registra é sempre a pessoa.
 *
 * Não depende do layout de um cliente específico. Cada sistema (TOTVS, SAP,
 * planilha exportada...) põe as colunas num lugar diferente, então a leitura
 * se apoia no que todo pedido tem:
 *   - linha de item é a que traz três números com quantidade × preço = total;
 *   - o cliente é o CNPJ do documento que bate com uma loja cadastrada;
 *   - número do pedido e datas vêm pelos rótulos ("Pedido", "Entrega"...).
 * O que não der para reconhecer aparece na tela para a pessoa escolher.
 */

import { normalizar } from "./pedidoVoz";

const soDigitos = (s) => String(s ?? "").replace(/\D/g, "");

// ─── Ler o texto do PDF (pdf.js, carregado só quando alguém importa) ──────

/**
 * Devolve as linhas de texto do PDF, página por página, cada uma com as
 * palavras e a posição horizontal delas: `[{ pagina, y, palavras: [{ x, s }] }]`.
 * O pdf.js entrega pedaços soltos de texto; aqui eles são agrupados pela
 * altura (mesma linha visual) e ordenados da esquerda para a direita.
 */
export async function lerLinhasPdf(arquivo) {
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const dados = new Uint8Array(await arquivo.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: dados }).promise;
  const linhas = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const { items } = await pagina.getTextContent();
    linhas.push(...agruparEmLinhas(items, n));
  }
  if (!linhas.length) {
    throw new Error("Não há texto neste PDF — parece ser uma imagem escaneada. Lance o pedido à mão.");
  }
  return linhas;
}

/** Junta os pedaços de texto do pdf.js em linhas visuais (tolerância de 2pt na altura). */
export function agruparEmLinhas(items, pagina = 1) {
  const linhas = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    let linha = linhas.find((l) => Math.abs(l.y - y) <= 2);
    if (!linha) {
      linha = { pagina, y, pedacos: [] };
      linhas.push(linha);
    }
    linha.pedacos.push({ x, s: it.str, largura: it.width ?? 0 });
  }
  return linhas
    .sort((a, b) => b.y - a.y)
    .map((l) => ({ pagina: l.pagina, y: l.y, palavras: quebrarEmPalavras(l.pedacos) }));
}

/** Um pedaço do pdf.js pode ter várias palavras ("KG 1"): separa, estimando o x de cada uma. */
function quebrarEmPalavras(pedacos) {
  const palavras = [];
  for (const p of pedacos.sort((a, b) => a.x - b.x)) {
    const larguraLetra = p.s.length ? (p.largura || p.s.length * 4) / p.s.length : 4;
    let pos = 0;
    for (const parte of p.s.split(/(\s+)/)) {
      if (parte.trim()) palavras.push({ x: p.x + pos * larguraLetra, s: parte });
      pos += parte.length;
    }
  }
  return palavras;
}

// ─── Números e unidades ─────────────────────────────────────────────────────

/** "1.560,00" → 1560 · "20,0000" → 20 · "1560.00" → 1560 · "1.560" → 1560. null se não é número. */
export function paraNumero(s) {
  const t = String(s).trim();
  if (!/^\d[\d.,]*$/.test(t)) return null;
  if (t.includes(",")) return Number(t.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ""));
  return Number(t);
}

const UNIDADES = {
  kg: "kg", kgs: "kg", quilo: "kg", quilos: "kg",
  un: "un", und: "un", unid: "un", unidade: "un", unidades: "un", pc: "un", pca: "un", "1un": "un",
  sc: "saco", saco: "saco", sacos: "saco",
  cx: "cx", caixa: "cx", cxs: "cx",
};
const unidadeDe = (s) => UNIDADES[normalizar(s).replace(/[^a-z0-9]/g, "")] ?? null;

// ─── Linhas de item ─────────────────────────────────────────────────────────

const quase = (a, b) => Math.abs(a - b) <= Math.max(0.02, Math.abs(b) * 0.005);

/**
 * Acha na linha a quantidade e o preço: dois números cujo produto é um
 * terceiro número à direita deles (o total do item). Entre várias
 * combinações, fica a que não tem "1" como fator (a embalagem "KG 1" do
 * TOTVS vezes o total dá o próprio total, por acaso) e a mais à esquerda.
 */
function acharQtdPreco(numeros) {
  let melhor = null;
  for (let i = 0; i < numeros.length; i++) {
    for (let j = i + 1; j < numeros.length; j++) {
      const a = numeros[i].v;
      const b = numeros[j].v;
      if (!(a > 0 && b > 0)) continue;
      const total = numeros.slice(j + 1).find((n) => n.v > 0 && quase(a * b, n.v));
      if (!total) continue;
      const trivial = a === 1 || b === 1;
      const candidato = { a: numeros[i], b: numeros[j], total: total.v, trivial };
      if (!melhor || (melhor.trivial && !trivial)) melhor = candidato;
    }
  }
  return melhor;
}

const RE_RODAPE = /^(total|totais|subtotal|valor total|soma)/;

/**
 * Cabeçalho da tabela: se "Qtd" estiver à direita de "Preço/Unit", a ordem
 * das colunas é a inversa da usual. Sem cabeçalho reconhecível, vale a ordem
 * mais comum nos pedidos: quantidade, depois preço unitário.
 */
function precoAntesDaQtd(linhas) {
  for (const l of linhas) {
    const qtd = l.palavras.find((p) => /^(qtd|qtde|quant|quantidade)/.test(normalizar(p.s)));
    const preco = l.palavras.find((p) => /^(unit|unitario|preco|pr\.?unit|vl\.?unit|valor unit)/.test(normalizar(p.s)));
    if (qtd && preco) return preco.x < qtd.x;
  }
  return false;
}

/**
 * Os itens do pedido: `[{ descricao, qty, preco, total, unidade }]`. A
 * descrição é o texto à esquerda dos números, mais as linhas só de texto logo
 * abaixo (o TOTVS quebra "AMEIXA FRESCA" / "IMPORTADA KG" em duas).
 */
export function extrairItens(linhas) {
  const inverter = precoAntesDaQtd(linhas);
  const itens = [];
  let ultimo = null;
  for (const l of linhas) {
    const numeros = l.palavras.map((p) => ({ x: p.x, v: paraNumero(p.s) })).filter((n) => n.v !== null);
    const par = acharQtdPreco(numeros);
    const textoLinha = normalizar(l.palavras.map((p) => p.s).join(" "));
    if (par && !RE_RODAPE.test(textoLinha)) {
      const xPrimeiro = par.a.x;
      const antes = l.palavras.filter((p) => p.x < xPrimeiro);
      const unidade = l.palavras.map((p) => unidadeDe(p.s)).find(Boolean) ?? null;
      const texto = antes.filter((p) => paraNumero(p.s) === null && !unidadeDe(p.s)).map((p) => p.s);
      const [qtd, preco] = inverter ? [par.b, par.a] : [par.a, par.b];
      ultimo = {
        descricao: texto.join(" "),
        qty: qtd.v,
        preco: preco.v,
        total: par.total,
        unidade,
        xTexto: antes.find((p) => paraNumero(p.s) === null)?.x ?? 0,
        xNumeros: xPrimeiro,
        pagina: l.pagina,
      };
      itens.push(ultimo);
      continue;
    }
    // Continuação da descrição: só texto, na coluna do produto, logo abaixo.
    const soTexto = l.palavras.every((p) => paraNumero(p.s) === null || /^\d+$/.test(p.s));
    if (ultimo && soTexto && l.pagina === ultimo.pagina && !RE_RODAPE.test(textoLinha)
      && l.palavras[0].x >= ultimo.xTexto - 15 && l.palavras.at(-1).x < ultimo.xNumeros) {
      const extra = l.palavras.filter((p) => !unidadeDe(p.s) && !/^(ref:?|-|\d+)$/i.test(p.s)).map((p) => p.s);
      if (!ultimo.unidade) ultimo.unidade = l.palavras.map((p) => unidadeDe(p.s)).find(Boolean) ?? null;
      ultimo.descricao = [ultimo.descricao, ...extra].join(" ").trim();
    } else if (numeros.length || l.palavras.length > 6) {
      // Outra coisa no meio (rodapé, observações): a descrição não continua mais.
      ultimo = null;
    }
  }
  return itens.map(({ descricao, qty, preco, total, unidade }) => ({
    descricao: descricao.replace(/\s+-\s*$/, "").replace(/\s+/g, " ").trim(),
    qty, preco, total, unidade,
  }));
}

// ─── Cabeçalho: cliente, número do pedido, datas ───────────────────────────

/**
 * Raiz (8 primeiros dígitos) do CNPJ da própria distribuidora: todo pedido
 * traz o nosso CNPJ como fornecedor, e ele não pode ser confundido com o do
 * cliente. A raiz cobre matriz e filiais.
 */
const RAIZES_PROPRIAS = ["48995197"];

const RE_CNPJ = /\d{2}\.?\d{3}\.?\d{3}\s*\/\s*\d{4}\s*-?\s*\d{2}/g;
const RE_DATA = /(\d{2})\/(\d{2})\/(\d{4})/;
const dataISO = (m) => (m ? `${m[3]}-${m[2]}-${m[1]}` : null);

export function extrairCabecalho(linhas) {
  const textos = linhas.map((l) => l.palavras.map((p) => p.s).join(" "));
  const tudo = textos.join("\n");

  const cnpjs = [...new Set([...tudo.matchAll(RE_CNPJ)].map((m) => soDigitos(m[0])))]
    .filter((d) => d.length === 14 && !RAIZES_PROPRIAS.includes(d.slice(0, 8)));

  let pedidoCompra = null;
  for (const t of textos) {
    const m = /pedido(?:\s+de\s+compras?)?\s*(?:n[º°o]?\.?|nro\.?|numero|número|#)?\s*:?\s*(\d{4,})/i.exec(t);
    if (m && !/fornecedor/i.test(t.slice(0, m.index + 20))) {
      pedidoCompra = m[1];
      break;
    }
  }

  const dataPorRotulo = (re) => {
    for (const t of textos) {
      const i = t.search(re);
      if (i >= 0) {
        const m = RE_DATA.exec(t.slice(i));
        if (m) return dataISO(m);
      }
    }
    return null;
  };
  const dataEntrega = dataPorRotulo(/previs[aã]o\s+de\s+entrega|data\s+(?:de|p\/?|para)\s+entrega|entregar\s+em|data\s+limite/i);
  const dataEmissao = dataPorRotulo(/emiss[aã]o|data\s+do\s+pedido/i);

  let totalPdf = null;
  for (const t of textos) {
    const m = /valor\s+total(?:\s+do\s+pedido)?\s*:?\s*(?:R\$\s*)?([\d.,]+)/i.exec(t);
    if (m) {
      totalPdf = paraNumero(m[1]);
      break;
    }
  }

  return { cnpjs, pedidoCompra, dataEntrega, dataEmissao, totalPdf, texto: normalizar(tudo) };
}

// ─── Casar com o cadastro ───────────────────────────────────────────────────

const CHAVE_MEMORIA = "cc-pedido-pdf-produtos";

/** Descrição → produto que a equipe já escolheu antes, neste aparelho. */
export function lerMemoriaProdutos() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_MEMORIA) || "{}") ?? {};
  } catch {
    return {};
  }
}

export function lembrarProduto(descricao, produtoId) {
  try {
    const memoria = lerMemoriaProdutos();
    memoria[chaveDescricao(descricao)] = produtoId;
    localStorage.setItem(CHAVE_MEMORIA, JSON.stringify(memoria));
  } catch {
    // sem storage, só não lembra da próxima vez
  }
}

const IGNORAR = new Set(["kg", "un", "und", "unid", "ref", "tipo", "cx", "sc", "com", "sem", "para", "atak", "1un"]);
const palavrasDe = (s) => normalizar(s).split(/[\s.,/-]+/).filter((w) => w.length >= 3 && !IGNORAR.has(w) && !/\d/.test(w));
export const chaveDescricao = (s) => palavrasDe(s).join(" ");

/** Diferença de até uma letra ("murgote" x "murcote"), para palavras de 5+ letras. */
function parecidas(a, b) {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5) return false;
  if (a.startsWith(b) || b.startsWith(a)) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i) || a.slice(i) === b.slice(i + 1);
}

/**
 * O produto cadastrado que corresponde à descrição do cliente: primeiro o
 * que a equipe já escolheu antes para essa descrição; senão, o que tem mais
 * palavras em comum (nome e fruta do cadastro). A primeira palavra — a fruta,
 * quase sempre — precisa bater. Saco só casa com item que fale em saco/kg do
 * tamanho do saco; granel nunca vira saco por acaso.
 */
export function acharProduto(descricao, unidade, produtos, memoria = {}) {
  const lembrado = memoria[chaveDescricao(descricao)];
  if (lembrado && produtos.some((p) => p.id === lembrado)) return lembrado;

  const alvo = palavrasDe(descricao);
  if (!alvo.length) return null;
  const falaSaco = unidade === "saco" || /\bsa?c(o|os)?\b/.test(normalizar(descricao));
  const tamanho = /(\d+(?:[.,]\d+)?)\s*kg/.exec(normalizar(descricao));

  let melhor = null;
  for (const p of produtos) {
    if (p.unidadeVenda === "saco") {
      if (!falaSaco || !tamanho || Math.abs(Number(tamanho[1].replace(",", ".")) - Number(p.kgPorUnidade)) > 0.05) continue;
    }
    const doCadastro = [...palavrasDe(p.nome), ...palavrasDe(p.fruta ?? "")];
    if (!doCadastro.some((w) => parecidas(w, alvo[0]))) continue;
    const acertos = alvo.filter((a) => doCadastro.some((b) => parecidas(a, b))).length;
    const nomeProprio = palavrasDe(p.nome);
    const cobertura = nomeProprio.filter((b) => alvo.some((a) => parecidas(a, b))).length / (nomeProprio.length || 1);
    // Saco do tamanho certo, quando o cliente fala em saco, ganha do granel da mesma fruta.
    const nota = acertos / alvo.length + cobertura * 0.5 + (p.unidadeVenda === "saco" ? 1 : 0);
    if (!melhor || nota > melhor.nota) melhor = { id: p.id, nota, acertos };
  }
  // Só a fruta batendo não basta quando o cliente fala mais ("TANGERINA
  // POKAN" x "Tangerina Murcote"): nesse caso fica para a pessoa escolher.
  if (!melhor) return null;
  if (alvo.length > 1 && melhor.acertos < 2) return null;
  return melhor.id;
}

/** A loja do pedido: pelo CNPJ (loja primeiro, depois rede) e, sem CNPJ, pelo nome da rede no texto. */
export function acharCliente(cabecalho, lojas, redes) {
  for (const cnpj of cabecalho.cnpjs) {
    const loja = lojas.find((l) => soDigitos(l.cnpjCpf) === cnpj);
    if (loja) return { lojaId: loja.id, redeId: loja.redeId, cnpj };
  }
  for (const cnpj of cabecalho.cnpjs) {
    const rede = redes.find((r) => soDigitos(r.cnpjCpf) === cnpj);
    if (rede) {
      const daRede = lojas.filter((l) => l.redeId === rede.id && l.status === "ativo");
      return { lojaId: daRede.length === 1 ? daRede[0].id : "", redeId: rede.id, cnpj };
    }
  }
  // Filial nova de uma rede conhecida: mesma raiz de CNPJ de uma loja dela.
  for (const cnpj of cabecalho.cnpjs) {
    const irma = lojas.find((l) => soDigitos(l.cnpjCpf).slice(0, 8) === cnpj.slice(0, 8));
    if (irma) return { lojaId: "", redeId: irma.redeId, cnpj };
  }
  const rede = [...redes]
    .filter((r) => normalizar(r.nome).length >= 4)
    .sort((a, b) => b.nome.length - a.nome.length)
    .find((r) => ` ${cabecalho.texto} `.includes(` ${normalizar(r.nome)} `));
  return { lojaId: "", redeId: rede?.id ?? "", cnpj: cabecalho.cnpjs[0] ?? null };
}

/**
 * Tudo junto: das linhas do PDF ao rascunho do pedido.
 * `{ cabecalho, cliente, itens: [{ descricao, qty, preco, total, unidade, produtoId }] }`
 */
export function interpretarPedidoPdf(linhas, { lojas, redes, produtos }) {
  const cabecalho = extrairCabecalho(linhas);
  const memoria = lerMemoriaProdutos();
  const itens = extrairItens(linhas).map((i) => ({ ...i, produtoId: acharProduto(i.descricao, i.unidade, produtos, memoria) }));
  return { cabecalho, cliente: acharCliente(cabecalho, lojas, redes), itens };
}

/** O número do pedido de compra do cliente, gravado na observação da venda na importação. */
export const pedidoCompraDaVenda = (venda) =>
  /pedido de compra n[º°o]?\.?\s*(\d+)/i.exec(venda?.observacao ?? "")?.[1] ?? null;

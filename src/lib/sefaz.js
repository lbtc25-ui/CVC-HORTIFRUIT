/**
 * Notas recebidas — NF-e que terceiros emitiram contra o CNPJ da empresa,
 * trazidas direto da SEFAZ (Distribuição DF-e) com o certificado A1.
 *
 * Quem fala com a SEFAZ é o servidor (api/sefaz.js), porque o certificado não
 * pode ir para o navegador; ele grava as notas em `nfe_recebidas`. Daqui o
 * app lê essa tabela direto do Supabase e só chama o servidor para buscar
 * notas novas, pegar o XML de uma nota e manifestar.
 *
 * A nota chega primeiro como RESUMO (emitente, valor, chave). O XML completo
 * (itens, finalidade, nota referenciada) só é liberado pela SEFAZ depois da
 * manifestação do destinatário — a Ciência basta, e não é definitiva.
 *
 * As notas saem daqui no mesmo formato que a tela usava com a Spedy
 * ({ id, accessKey, issuer, amount, issuedOn, status, isComplete,
 * manifestation }), com `id` = chave de acesso.
 */

import { soDigitos } from "./notas";
import { supabase } from "./supabase";

const ENDPOINT = "/api/sefaz";

export const MANIFESTACOES = {
  none: "Sem manifestação",
  acknowledged: "Ciência",
  confirmed: "Confirmada",
  unknown: "Desconhecida",
  notPerformed: "Operação não realizada",
};

function exigirBanco() {
  if (!supabase) throw new Error("As notas recebidas precisam do Supabase configurado (não funcionam no modo demonstração).");
  return supabase;
}

/** Chama uma ação do api/sefaz.js com o login de quem está usando o app. */
async function chamarServidor(acao, dados = {}) {
  const { data } = await exigirBanco().auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Sessão expirada — entre no app de novo.");
  const resposta = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ acao, ...dados }),
  });
  const texto = await resposta.text().catch(() => "");
  let corpo = null;
  try { corpo = texto ? JSON.parse(texto) : null; } catch { /* resposta não-JSON */ }
  if (!resposta.ok) {
    const erro = new Error(corpo?.erro || `O servidor respondeu HTTP ${resposta.status}.`);
    erro.status = resposta.status;
    throw erro;
  }
  return corpo;
}

const COLUNAS_LISTA =
  "chave, emitente_cnpj, emitente_nome, emitente_fantasia, emitida_em, tipo_nf, numero, serie, valor, situacao, completo, manifestacao, manifestada_em, justificativa";

/** Linha de `nfe_recebidas` → o formato que a tela usa. */
const paraNota = (n) => ({
  id: n.chave,
  accessKey: n.chave,
  issuer: { name: n.emitente_fantasia || n.emitente_nome, legalName: n.emitente_nome, federalTaxNumber: n.emitente_cnpj },
  amount: Number(n.valor) || 0,
  issuedOn: n.emitida_em,
  status: n.situacao,
  isComplete: n.completo,
  manifestation: { status: n.manifestacao, date: n.manifestada_em, justification: n.justificativa },
});

/**
 * As notas do período, do banco. `initialDate`/`endDate` no formato
 * AAAA-MM-DD, dias inteiros de Aracaju.
 */
export async function listarNotasRecebidas({ initialDate, endDate }) {
  const { data, error } = await exigirBanco()
    .from("nfe_recebidas")
    .select(COLUNAS_LISTA)
    .gte("emitida_em", `${initialDate}T00:00:00-03:00`)
    .lte("emitida_em", `${endDate}T23:59:59-03:00`)
    .order("emitida_em", { ascending: false })
    .limit(2000);
  if (error) {
    const erro = new Error(/nfe_recebidas/.test(error.message)
      ? "A tabela nfe_recebidas não existe — rode supabase/migracao-30-nfe-recebidas-sefaz.sql."
      : error.message);
    erro.status = 500;
    throw erro;
  }
  return data.map(paraNota);
}

/**
 * Situação da busca: última consulta, a partir de quando a SEFAZ deixa
 * consultar de novo, e o certificado (titular, validade).
 */
export async function statusBuscaRecebidas() {
  const { data, error } = await exigirBanco().from("sefaz_dfe_estado").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    lastSyncAt: data.ultima_consulta_em,
    nextAllowedSyncAt: data.proxima_consulta_em,
    lastAttemptMessage: data.ultima_mensagem ? `${data.ultimo_cstat ?? ""} ${data.ultima_mensagem}`.trim() : "",
    ultimoCstat: data.ultimo_cstat,
    certificadoTitular: data.cert_titular,
    certificadoValidoAte: data.cert_valido_ate,
    ultNsu: data.ult_nsu,
    maxNsu: data.max_nsu,
  };
}

/**
 * Pede à SEFAZ as notas novas. Ela bloqueia por uma hora o CNPJ que consulta
 * sem ter nada novo, e o servidor respeita isso: dentro da espera volta
 * `{ pedida: false, liberaEm }`, que a tela mostra como aviso, não erro.
 *
 * @returns {Promise<{ pedida: boolean, liberaEm: string|null, novas: number, emAndamento?: boolean }>}
 */
export async function buscarNotasRecebidasAgora() {
  return chamarServidor("sincronizar");
}

/** Pede a nota pela chave — é assim que o XML completo chega logo depois da manifestação. */
export async function buscarXmlCompleto(chave) {
  return chamarServidor("consultar-chave", { chave });
}

/**
 * Registra a manifestação na SEFAZ, assinada com o certificado. A resposta é
 * síncrona: se a SEFAZ recusar, lança o motivo e nada é gravado.
 * Desconhecimento e Operação não realizada exigem justificativa de 15 a 255
 * caracteres — e, como a Confirmação, são definitivas.
 */
export async function manifestarNotaRecebida(chave, manifestacao, justificativa) {
  return chamarServidor("manifestar", { chave, manifestacao, justificativa: justificativa || null });
}

/** O XML completo guardado (null enquanto só há o resumo). */
export async function obterXmlRecebida(chave) {
  const { data, error } = await exigirBanco().from("nfe_recebidas").select("xml").eq("chave", chave).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.xml ?? null;
}

/** Baixa o XML da nota como arquivo. */
export async function baixarXmlRecebida(chave, nomeArquivo) {
  const xml = await obterXmlRecebida(chave);
  if (!xml) throw new Error("O XML completo desta nota ainda não chegou — manifeste e toque em Buscar XML.");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
  link.download = nomeArquivo;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}

// ─── Ler o XML ──────────────────────────────────────────────────────────────

/** Texto do primeiro elemento com esse nome, ignorando o namespace da NF-e. */
const tag = (raiz, nome) => raiz?.getElementsByTagNameNS("*", nome)?.[0]?.textContent?.trim() ?? "";

const FINALIDADES = { 1: "normal", 2: "complementar", 3: "ajuste", 4: "devolucao" };

/** O XML da nota lido: cabeçalho, emitente, destinatário, itens e totais. */
function lerXml(texto) {
  const doc = new DOMParser().parseFromString(texto, "application/xml");
  const ide = doc.getElementsByTagNameNS("*", "ide")[0];
  if (!ide) return null;
  const emit = doc.getElementsByTagNameNS("*", "emit")[0];
  const dest = doc.getElementsByTagNameNS("*", "dest")[0];
  const total = doc.getElementsByTagNameNS("*", "ICMSTot")[0];
  const prot = doc.getElementsByTagNameNS("*", "infProt")[0];
  const endereco = (el) => {
    if (!el) return "";
    const partes = [tag(el, "xLgr"), tag(el, "nro"), tag(el, "xBairro"), `${tag(el, "xMun")}/${tag(el, "UF")}`];
    return partes.filter((p) => p && p !== "/").join(", ");
  };
  return {
    completo: true,
    chave: tag(prot, "chNFe"),
    protocolo: tag(prot, "nProt"),
    autorizadaEm: tag(prot, "dhRecbto"),
    finalidade: FINALIDADES[tag(ide, "finNFe")] ?? "",
    natureza: tag(ide, "natOp"),
    numero: tag(ide, "nNF"),
    serie: tag(ide, "serie"),
    emitidaEm: tag(ide, "dhEmi") || tag(ide, "dEmi"),
    emitente: { nome: tag(emit, "xNome"), cnpj: tag(emit, "CNPJ") || tag(emit, "CPF"), ie: tag(emit, "IE"),
      endereco: endereco(emit?.getElementsByTagNameNS("*", "enderEmit")[0]) },
    destinatario: { nome: tag(dest, "xNome"), cnpj: tag(dest, "CNPJ") || tag(dest, "CPF"),
      endereco: endereco(dest?.getElementsByTagNameNS("*", "enderDest")[0]) },
    referenciadas: [...doc.getElementsByTagNameNS("*", "refNFe")].map((e) => e.textContent.trim()),
    itens: [...doc.getElementsByTagNameNS("*", "det")].map((det) => {
      const prod = det.getElementsByTagNameNS("*", "prod")[0];
      return {
        codigo: tag(prod, "cProd"),
        descricao: tag(prod, "xProd"),
        ncm: tag(prod, "NCM"),
        cfop: tag(prod, "CFOP"),
        unidade: tag(prod, "uCom"),
        quantidade: Number(tag(prod, "qCom")) || 0,
        valorUnitario: Number(tag(prod, "vUnCom")) || 0,
        total: Number(tag(prod, "vProd")) || 0,
      };
    }),
    totais: {
      produtos: Number(tag(total, "vProd")) || 0,
      frete: Number(tag(total, "vFrete")) || 0,
      desconto: Number(tag(total, "vDesc")) || 0,
      icms: Number(tag(total, "vICMS")) || 0,
      nota: Number(tag(total, "vNF")) || 0,
    },
    infAdic: tag(doc, "infCpl"),
  };
}

/**
 * Lê do XML completo o que o resumo não traz: finalidade (é devolução?),
 * notas referenciadas (qual venda está sendo devolvida), natureza da
 * operação e itens. Com a nota ainda em resumo, devolve `completo: false`.
 */
export async function lerXmlRecebida(chave) {
  const xml = await obterXmlRecebida(chave);
  const lido = xml ? lerXml(xml) : null;
  return lido ?? { completo: false, finalidade: "", referenciadas: [], natureza: "", itens: [] };
}

/**
 * Espelho da nota em PDF, gerado a partir do XML. Não é o DANFE oficial
 * (sem código de barras nem o leiaute do manual) — serve para conferir e
 * arquivar; o documento fiscal que vale é o XML.
 */
export async function abrirEspelhoRecebida(chave) {
  const xml = await obterXmlRecebida(chave);
  const n = xml && lerXml(xml);
  if (!n) throw new Error("O XML completo desta nota ainda não chegou — manifeste e toque em Buscar XML.");
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const doc = new jsPDF();
  const x = 14;
  let y = 16;
  const linha = (texto, tamanho = 9.5, cor = 40) => {
    doc.setFontSize(tamanho);
    doc.setTextColor(cor);
    for (const parte of doc.splitTextToSize(texto, 182)) {
      doc.text(parte, x, y);
      y += tamanho * 0.5;
    }
  };
  linha(`NF-e ${n.numero} · série ${n.serie}`, 15, 20);
  linha("Espelho da nota recebida — não substitui o DANFE; o documento fiscal é o XML.", 8.5, 120);
  y += 2;
  linha(`Chave: ${n.chave.replace(/(\d{4})(?=\d)/g, "$1 ")}`, 9);
  linha(`Protocolo: ${n.protocolo || "—"} · emitida em ${n.emitidaEm ? new Date(n.emitidaEm).toLocaleString("pt-BR") : "—"}`, 9);
  linha(`Natureza da operação: ${n.natureza}${n.finalidade === "devolucao" ? " (devolução)" : ""}`, 9);
  y += 3;
  linha("Emitente", 11, 20);
  linha(`${n.emitente.nome} · CNPJ/CPF ${n.emitente.cnpj} · IE ${n.emitente.ie || "—"}`);
  if (n.emitente.endereco) linha(n.emitente.endereco, 9, 90);
  y += 2;
  linha("Destinatário", 11, 20);
  linha(`${n.destinatario.nome} · CNPJ/CPF ${n.destinatario.cnpj}`);
  if (n.destinatario.endereco) linha(n.destinatario.endereco, 9, 90);
  autoTable(doc, {
    startY: y + 3,
    head: [["Código", "Descrição", "NCM", "CFOP", "Un", "Qtd", "Unitário", "Total"]],
    body: n.itens.map((i) => [i.codigo, i.descricao, i.ncm, i.cfop, i.unidade,
      i.quantidade.toLocaleString("pt-BR"), brl(i.valorUnitario), brl(i.total)]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [45, 106, 79] },
    margin: { left: x, right: x },
  });
  y = doc.lastAutoTable.finalY + 8;
  linha(`Produtos ${brl(n.totais.produtos)} · Frete ${brl(n.totais.frete)} · Desconto ${brl(n.totais.desconto)} · ICMS ${brl(n.totais.icms)}`, 9);
  linha(`Total da nota: ${brl(n.totais.nota)}`, 12, 20);
  if (n.infAdic) {
    y += 2;
    linha(`Informações complementares: ${n.infAdic}`, 8.5, 90);
  }
  // Baixa em vez de abrir numa aba: depois dos awaits o navegador trataria
  // a aba nova como pop-up e bloquearia.
  doc.save(`Espelho-NFe-${soDigitos(n.emitente.cnpj)}-${n.numero}.pdf`);
}

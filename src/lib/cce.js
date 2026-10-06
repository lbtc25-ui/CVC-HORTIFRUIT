/**
 * PDF da carta de correção (CC-e) para mandar ao cliente.
 *
 * A Spedy guarda o PDF oficial do evento, mas por um id do evento que o app
 * não guardou quando enviou a CC-e. Por isso este PDF é montado aqui: os
 * dados da nota vêm do XML autorizado (baixado pela Spedy) e o texto da
 * correção é o que foi enviado (salvo na venda/nota). O cliente confere a
 * CC-e pela chave de acesso no portal da NF-e.
 */

import { xmlUrlSpedy } from "./spedy";

const CONDICAO_DE_USO =
  "A Carta de Correção é disciplinada pelo § 1º-A do art. 7º do Convênio S/N, de 15 de dezembro de 1970, e pode " +
  "ser utilizada para regularização de erro ocorrido na emissão de documento fiscal, desde que o erro não esteja " +
  "relacionado com: I - as variáveis que determinam o valor do imposto tais como: base de cálculo, alíquota, " +
  "diferença de preço, quantidade, valor da operação ou da prestação; II - a correção de dados cadastrais que " +
  "implique mudança do remetente ou do destinatário; III - a data de emissão ou de saída.";

// Notas que o app já conferiu e não têm o que corrigir — guardado no
// aparelho para o botão não voltar a cada vez que se abre a tela.
const CHAVE_CONFERIDAS = "cce-conferidas";

export function lerConferidas() {
  try {
    return new Set(JSON.parse(localStorage.getItem(CHAVE_CONFERIDAS) || "[]"));
  } catch {
    return new Set();
  }
}

export function marcarConferida(id) {
  const conferidas = lerConferidas();
  conferidas.add(id);
  try {
    localStorage.setItem(CHAVE_CONFERIDAS, JSON.stringify([...conferidas]));
  } catch {
    // sem armazenamento (aba anônima): vale só até fechar a tela
  }
  return conferidas;
}

/**
 * Motivos que a CC-e pode corrigir. A SEFAZ não aceita carta para valores,
 * impostos, quantidades, troca de destinatário nem datas de emissão/saída.
 * O primeiro motivo é a correção automática de código/descrição (compara a
 * nota com o cadastro); os outros pedem o texto da correção.
 */
export const MOTIVO_AUTOMATICO = "codigo";
export const MOTIVOS_CCE = [
  { value: MOTIVO_AUTOMATICO, label: "Código e descrição dos produtos (como no cadastro)" },
  { value: "Correcao dos dados do transporte", label: "Dados do transporte (transportadora, placa, volumes)" },
  { value: "Correcao do endereco do destinatario", label: "Endereço do destinatário (sem trocar o destinatário)" },
  { value: "Correcao das informacoes adicionais", label: "Informações adicionais / observações" },
  { value: "Correcao da unidade de medida ou do codigo de barras", label: "Unidade de medida / código de barras" },
  { value: "Correcao", label: "Outro motivo" },
];

const soDigitos = (v) => String(v || "").replace(/\D/g, "");

function lerNota(xml) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const primeiro = (nome, raiz = doc) => raiz?.getElementsByTagNameNS("*", nome)?.[0];
  const tag = (raiz, nome) => primeiro(nome, raiz)?.textContent?.trim() ?? "";
  const ide = primeiro("ide");
  const emit = primeiro("emit");
  const dest = primeiro("dest");
  return {
    chave: tag(primeiro("infProt"), "chNFe") || (primeiro("infNFe")?.getAttribute("Id") ?? "").replace(/^NFe/, ""),
    numero: tag(ide, "nNF"),
    serie: tag(ide, "serie"),
    emitidaEm: tag(ide, "dhEmi"),
    emitente: { nome: tag(emit, "xNome"), cnpj: tag(emit, "CNPJ") || tag(emit, "CPF"), ie: tag(emit, "IE") },
    destinatario: { nome: tag(dest, "xNome"), cnpj: tag(dest, "CNPJ") || tag(dest, "CPF") },
  };
}

/**
 * Nome do arquivo com rede, loja e número da nota, para achar fácil na hora
 * de mandar para o cliente: "CCe - REDE MAIS - MEGA - NF 12.pdf". `cliente`
 * vem de nomeDoCliente ("REDE MAIS · MEGA").
 */
function nomeDoArquivo(cliente, numero) {
  const partes = String(cliente || "").split("·").map((p) => p.trim()).filter((p) => p && p !== "—");
  const limpo = (p) => p.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return ["CCe", ...partes.map(limpo), `NF ${numero}`].join(" - ") + ".pdf";
}

/** Baixa o PDF da CC-e da nota `spedyId`, enviada em `enviadaEm` com `texto`, para o `cliente`. */
export async function baixarPdfCartaCorrecao({ spedyId, texto, enviadaEm, cliente }) {
  const resp = await fetch(xmlUrlSpedy(spedyId));
  if (!resp.ok) throw new Error(`Não consegui baixar o XML da nota (HTTP ${resp.status}).`);
  const n = lerNota(await resp.text());
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const x = 14;
  let y = 18;
  const linha = (conteudo, tamanho = 10, cor = 40, espaco = 0.5) => {
    doc.setFontSize(tamanho);
    doc.setTextColor(cor);
    for (const parte of doc.splitTextToSize(conteudo, 182)) {
      doc.text(parte, x, y);
      y += tamanho * espaco;
    }
  };
  const bloco = (titulo) => {
    y += 3;
    doc.setDrawColor(200);
    doc.line(x, y - 4, 196, y - 4);
    linha(titulo, 11, 20);
    y += 1;
  };
  const cnpj = (v) => {
    const d = soDigitos(v);
    return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5") : v;
  };

  linha("CARTA DE CORREÇÃO ELETRÔNICA — CC-e", 15, 20);
  linha("Documento auxiliar do evento de carta de correção da NF-e", 9, 110);

  bloco("Emitente");
  linha(`${n.emitente.nome} · CNPJ ${cnpj(n.emitente.cnpj)} · IE ${n.emitente.ie || "—"}`);

  bloco("Destinatário");
  linha(`${n.destinatario.nome} · CNPJ/CPF ${cnpj(n.destinatario.cnpj)}`);

  bloco("NF-e corrigida");
  linha(`NF-e nº ${n.numero} · série ${n.serie} · emitida em ${n.emitidaEm ? new Date(n.emitidaEm).toLocaleString("pt-BR") : "—"}`);
  linha(`Chave de acesso: ${n.chave.replace(/(\d{4})(?=\d)/g, "$1 ")}`);
  linha(`Carta de correção enviada em ${enviadaEm ? new Date(enviadaEm).toLocaleString("pt-BR") : "—"}`);

  bloco("Correção");
  linha(texto, 10.5, 20, 0.55);

  bloco("Condições de uso");
  linha(CONDICAO_DE_USO, 8, 90);

  y += 4;
  linha(
    "Consulte a nota e seus eventos pela chave de acesso em www.nfe.fazenda.gov.br/portal (Consulta completa).",
    8.5, 110
  );

  doc.save(nomeDoArquivo(cliente || n.destinatario.nome, n.numero));
}

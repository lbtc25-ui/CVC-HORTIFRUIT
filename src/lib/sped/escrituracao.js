/**
 * Modelo comum da escrituração: transforma as NF-e (XML) do mês nos
 * "documentos" que os três arquivos — SPED Fiscal, SPED Contribuições e
 * Sintegra — escrituram do mesmo jeito.
 *
 * Uma nota entra com { xml, situacao, chave, numero, serie, emissao }:
 *   situacao  "autorizada" | "cancelada" | "denegada";
 *   xml       o XML autorizado (opcional para nota cancelada: sem ele a nota
 *             entra só como cancelada, com chave, série e número).
 *
 * Quem é a "empresa" (CNPJ do declarante) decide se a nota é saída (emitida
 * por nós) ou entrada (emitida por terceiro contra nós, ou nota de entrada
 * emitida por nós, como a devolução de venda).
 */

import { arred } from "./formato.js";
import { lerNfe } from "./nfe.js";

const soDigitos = (v) => String(v ?? "").replace(/\D/g, "");

/** Na entrada, o CFOP do documento do fornecedor (5/6/7) vira o de entrada (1/2/3). */
const CFOP_ENTRADA = { 5: "1", 6: "2", 7: "3" };
export const cfopDeEntrada = (cfop) => {
  const c = soDigitos(cfop);
  return CFOP_ENTRADA[c[0]] ? `${CFOP_ENTRADA[c[0]]}${c.slice(1)}` : c;
};

/** Valor da operação de um item: produto + frete + seguro + outras − desconto + ICMS ST + IPI. */
export const valorOperacao = (i) =>
  arred(i.valorProduto + i.frete + i.seguro + i.outras - i.desconto + i.icms.valorSt + i.ipi.valor);

const SITUACAO = { autorizada: "00", cancelada: "02", denegada: "04" };

/** Código do participante: o CNPJ/CPF (ou o id de estrangeiro), único por pessoa. */
export const codigoParticipante = (p) => p.cnpj || p.cpf || p.idEstrangeiro || "";

/**
 * @param {{ cnpjEmpresa: string, notas: Array }} entrada
 * @returns {{ documentos: Array, avisos: string[] }}
 */
export function montarDocumentos({ cnpjEmpresa, notas }) {
  const empresa = soDigitos(cnpjEmpresa);
  const avisos = [];
  const documentos = [];
  const vistas = new Set();

  for (const nota of notas) {
    const chave = soDigitos(nota.chave);
    if (chave && vistas.has(chave)) continue;
    if (chave) vistas.add(chave);

    const situacao = SITUACAO[nota.situacao] ?? "00";
    let nfe = null;
    if (nota.xml) {
      try {
        nfe = lerNfe(nota.xml);
      } catch (e) {
        avisos.push(`NF ${nota.numero ?? chave}: ${e.message}`);
      }
    }
    if (!nfe && situacao === "00") {
      avisos.push(`NF ${nota.numero ?? chave}: sem XML, ficou de fora.`);
      continue;
    }

    const proprio = nfe ? nfe.emitente.cnpj === empresa : nota.emitidaPorNos ?? true;
    const operacao = nfe ? (proprio ? (nfe.tipo === "0" ? "0" : "1") : "0") : proprio ? "1" : "0";
    const documento = {
      chave: nfe?.chave || chave,
      modelo: nfe?.modelo ?? "55",
      serie: nfe?.serie ?? String(nota.serie ?? 0),
      numero: nfe?.numero ?? String(nota.numero ?? ""),
      emissao: nfe?.emissao || nota.emissao || "",
      situacao,
      operacao, // 0 entrada, 1 saída
      emitenteProprio: proprio,
      devolucao: nfe?.finalidade === "4",
      contraparte: null,
      itens: [],
    };
    documento.dataEntradaSaida = nfe?.saidaEntrada || documento.emissao;

    if (nfe && situacao === "00") {
      documento.contraparte = proprio ? nfe.destinatario : nfe.emitente;
      documento.totais = nfe.totais;
      documento.frete = nfe.frete;
      documento.pagamentoIndicador = nfe.pagamentoIndicador;
      documento.natureza = nfe.natureza;
      // Entrada com nota de terceiro: o CFOP do fornecedor vira o de entrada, e o
      // código do item ganha o CNPJ dele (cProd de dois fornecedores se repete).
      const converter = !proprio;
      documento.itens = nfe.itens.map((i) => ({
        ...i,
        cfop: converter ? cfopDeEntrada(i.cfop) : i.cfop,
        codigo: converter ? `${nfe.emitente.cnpj || nfe.emitente.cpf}_${i.codigo}` : i.codigo,
      }));
    }
    documentos.push(documento);
  }

  documentos.sort((a, b) => a.emissao.localeCompare(b.emissao) || Number(a.numero) - Number(b.numero));
  return { documentos, avisos };
}

/**
 * Os dados da empresa (declarante) lidos do primeiro XML que os traz: do
 * emitente, nas notas que ela emitiu; do destinatário, nas que recebeu.
 */
export function empresaDosXmls(xmls, papel) {
  for (const xml of xmls) {
    try {
      const parte = lerNfe(xml)[papel];
      if (parte?.cnpj) return { ...parte };
    } catch {
      // XML ilegível: tenta o próximo.
    }
  }
  return null;
}

/** Itens distintos e unidades usados, para os cadastros (0200/0190 do SPED, 75 do Sintegra). */
export function cadastros(documentos) {
  const itens = new Map();
  const unidades = new Set();
  const participantes = new Map();
  for (const d of documentos) {
    if (d.contraparte) {
      const cod = codigoParticipante(d.contraparte);
      if (cod && !participantes.has(cod)) participantes.set(cod, d.contraparte);
    }
    for (const i of d.itens) {
      if (i.unidade) unidades.add(i.unidade.toUpperCase());
      if (!itens.has(i.codigo)) itens.set(i.codigo, i);
    }
  }
  return { itens, unidades, participantes };
}

/**
 * SPED Contribuições (EFD PIS/COFINS) — arquivo auxiliar.
 *
 * Leva o bloco 0 (abertura, estabelecimento, participantes, unidades e
 * produtos), o bloco C (C100 nota, C170 itens com PIS e COFINS) e o bloco 9.
 * O regime da empresa (0110), os dados do contador (0100), os créditos e a
 * apuração (blocos M) ficam com o programa do contador, que importa este
 * arquivo.
 *
 * Entram as saídas e as devoluções de venda. Compra de fornecedor só entra
 * quando pedido (`incluirCompras`): no regime cumulativo ela não gera crédito
 * de PIS/COFINS. Na entrada, o CST do fornecedor não vale para nós, então vai
 * "98 — outras operações de entrada" (a devolução de venda leva a base e os
 * valores da nota, para o contador abater da receita).
 */

import { cadastros } from "./escrituracao.js";
import { dataSped } from "./formato.js";
import { bloco, bloco9, blocosVazios, c100, c170, linha, reg0150, reg0190, reg0200, textoDoArquivo } from "./sped.js";

/** Leiaute do arquivo: 006 é o vigente nos últimos anos. A conferir. */
export const VERSAO_LEIAUTE_CONTRIBUICOES = "006";

const ZERADO = { base: 0, aliquota: 0, valor: 0, quantidadeBase: 0, aliquotaQuantidade: 0 };

/** O PIS ou COFINS do item como vai no C170, conforme a operação. */
function tributo(d, grupo) {
  const cst = String(grupo.cst ?? "");
  if (d.operacao === "1") return { ...grupo, cst: cst || "49" };
  const credito = Number(cst) >= 50;
  return { ...(d.devolucao || credito ? grupo : ZERADO), cst: credito ? cst : "98" };
}

export const entraNasContribuicoes = (d, incluirCompras) => d.operacao === "1" || d.devolucao || incluirCompras;

export function gerarSpedContribuicoes({ empresa, periodo, documentos, incluirCompras = false }) {
  const doPeriodo = documentos.filter((d) => entraNasContribuicoes(d, incluirCompras));
  const { itens, unidades, participantes } = cadastros(doPeriodo);

  const zero = [
    linha("0000", VERSAO_LEIAUTE_CONTRIBUICOES, "0", "", "", dataSped(periodo.inicio), dataSped(periodo.fim),
      empresa.nome, empresa.cnpj, empresa.uf, empresa.codMunicipio, "", "00", "2"),
  ];
  const cadastro0 = [
    linha("0140", empresa.cnpj, empresa.nome, empresa.cnpj, empresa.uf, empresa.ie, empresa.codMunicipio, "", ""),
    ...[...participantes.values()].map(reg0150),
    ...[...unidades].map(reg0190),
    ...[...itens.values()].map((i) => reg0200(i, { cest: false })),
  ];

  const docs = [linha("C010", empresa.cnpj, "2")];
  for (const d of doPeriodo) {
    docs.push(c100(d, periodo));
    if (d.situacao !== "00") continue;
    for (const i of d.itens) {
      docs.push(c170(i, { pis: tributo(d, i.pis), cofins: tributo(d, i.cofins), abatimento: false }));
    }
  }

  // Ordem do leiaute: 0, A, C, D, F, I, M, P, 1, 9 — os sem movimento vão vazios.
  const linhas = [
    ...bloco("0", cadastro0, zero),
    ...blocosVazios(["A"]),
    ...bloco("C", docs.length > 1 ? docs : []),
    ...blocosVazios(["D", "F", "I", "M", "P", "1"]),
  ];
  const todas = [...linhas, ...bloco9(linhas)];
  return { linhas: textoDoArquivo(todas), registros: todas.length, notas: doPeriodo.length };
}

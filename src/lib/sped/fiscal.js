/**
 * SPED Fiscal (EFD ICMS/IPI) — arquivo auxiliar.
 *
 * Leva o bloco 0 (abertura, participantes, unidades e produtos), o bloco C
 * (C100 nota, C170 itens, C190 resumo por CST/CFOP/alíquota) e o bloco 9; os
 * demais blocos vão vazios (sem movimento). O programa do contador importa e
 * completa com a apuração do ICMS (bloco E), inventário (H) e os dados dele (0100).
 */

import { cadastros } from "./escrituracao.js";
import { dataSped } from "./formato.js";
import { bloco, bloco9, blocosVazios, c100, c170, c190s, linha, reg0150, reg0190, reg0200, textoDoArquivo } from "./sped.js";

/** Leiaute do arquivo no ano: 013 em 2020, 014 em 2021... A conferir a cada virada de ano. */
export const versaoLeiauteFiscal = (ano) => String(Math.max(Number(ano) - 2007, 1)).padStart(3, "0");

/**
 * @param {object} p
 * @param {object} p.empresa    emitente do XML (cnpj, nome, ie, uf, codMunicipio, cep, logradouro...)
 * @param {{inicio:string, fim:string}} p.periodo
 * @param {Array} p.documentos  de montarDocumentos
 */
export function gerarSpedFiscal({ empresa, periodo, documentos }) {
  const { itens, unidades, participantes } = cadastros(documentos);

  const zero = [
    linha("0000", versaoLeiauteFiscal(periodo.inicio.slice(0, 4)), "0", dataSped(periodo.inicio), dataSped(periodo.fim),
      empresa.nome, empresa.cnpj, "", empresa.uf, empresa.ie, empresa.codMunicipio, "", "", "A", "1"),
  ];
  const cadastro0 = [
    linha("0005", empresa.fantasia || empresa.nome, empresa.cep, empresa.logradouro, empresa.numero, empresa.complemento,
      empresa.bairro, empresa.fone, "", ""),
    ...[...participantes.values()].map(reg0150),
    ...[...unidades].map(reg0190),
    ...[...itens.values()].map((i) => reg0200(i, { cest: true })),
  ];

  const docs = [];
  for (const d of documentos) {
    docs.push(c100(d, periodo));
    if (d.situacao !== "00") continue;
    for (const i of d.itens) {
      docs.push(c170(i, {
        pis: { cst: i.pis.cst, base: i.pis.base, aliquota: i.pis.aliquota, valor: i.pis.valor, quantidadeBase: i.pis.quantidadeBase, aliquotaQuantidade: i.pis.aliquotaQuantidade },
        cofins: { cst: i.cofins.cst, base: i.cofins.base, aliquota: i.cofins.aliquota, valor: i.cofins.valor, quantidadeBase: i.cofins.quantidadeBase, aliquotaQuantidade: i.cofins.aliquotaQuantidade },
        abatimento: true,
      }));
    }
    docs.push(...c190s(d));
  }

  // Ordem do leiaute: 0, B, C, D, E, G, H, K, 1, 9 — os sem movimento vão vazios.
  const linhas = [
    ...bloco("0", cadastro0, zero),
    ...blocosVazios(["B"]),
    ...bloco("C", docs),
    ...blocosVazios(["D", "E", "G", "H", "K", "1"]),
  ];
  const todas = [...linhas, ...bloco9(linhas)];
  return { linhas: textoDoArquivo(todas), registros: todas.length };
}

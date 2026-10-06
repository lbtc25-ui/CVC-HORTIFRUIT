/**
 * Peças comuns ao SPED Fiscal (EFD ICMS/IPI) e ao SPED Contribuições
 * (EFD PIS/COFINS): o formato de linha, a abertura e o fechamento de bloco, o
 * bloco 9, os cadastros do bloco 0 (0150, 0190, 0200) e os registros de
 * documento C100/C170 — que nos dois arquivos têm quase o mesmo layout.
 *
 * Os dois arquivos gerados aqui são "auxiliares": levam o bloco 0 (cadastros)
 * e o bloco C (notas), que é o trabalho braçal. A apuração (blocos E e M),
 * o inventário (H), os dados do contador (0100) e a assinatura ficam por conta
 * do programa do contador, que importa este arquivo.
 */

import { arred, dataSped, dec, limpar } from "./formato.js";
import { codigoParticipante } from "./escrituracao.js";

/** Uma linha de registro: |REG|campo|campo|. */
export const linha = (reg, ...campos) => ({ reg, texto: `|${[reg, ...campos.map((c) => (c === undefined || c === null ? "" : limpar(c)))].join("|")}|` });

/**
 * Um bloco: abertura (X001), registros e encerramento (X990). `antes` são os
 * registros que vêm antes da abertura (o 0000, no bloco 0). QTD_LIN conta
 * todas as linhas do bloco, abertura e encerramento incluídas.
 */
export function bloco(letra, registros, antes = []) {
  const todos = [
    ...antes,
    linha(`${letra}001`, registros.length ? "0" : "1"),
    ...registros,
  ];
  todos.push(linha(`${letra}990`, String(todos.length + 1)));
  return todos;
}

/**
 * Blocos sem movimento neste arquivo auxiliar (só abertura com IND_MOV 1 e
 * encerramento). O validador exige todos, na ordem do leiaute; quem preenche
 * a apuração, o inventário etc. é o programa do contador.
 */
export const blocosVazios = (letras) => letras.flatMap((letra) => bloco(letra, []));

/** Bloco 9: a contagem de cada tipo de registro do arquivo, e o total de linhas. */
export function bloco9(linhas) {
  const contagem = new Map();
  for (const l of linhas) contagem.set(l.reg, (contagem.get(l.reg) ?? 0) + 1);
  const tipos = [...contagem.keys(), "9001", "9900", "9990", "9999"];
  const nove = [linha("9001", "0")];
  for (const t of tipos) {
    const qtd = t === "9900" ? tipos.length : t === "9001" || t === "9990" || t === "9999" ? 1 : contagem.get(t);
    nove.push(linha("9900", t, String(qtd)));
  }
  const qtd9 = nove.length + 2; // + 9990 e 9999
  nove.push(linha("9990", String(qtd9)));
  nove.push(linha("9999", String(linhas.length + qtd9)));
  return nove;
}

export const textoDoArquivo = (linhas) => linhas.map((l) => l.texto);

// ─── Bloco 0 ────────────────────────────────────────────────────────────────

const DESCRICAO_UNIDADE = {
  KG: "Quilograma", UN: "Unidade", UND: "Unidade", CX: "Caixa", SC: "Saco", SACO: "Saco",
  PC: "Peca", PCT: "Pacote", DZ: "Duzia", L: "Litro", LT: "Litro", MC: "Maco", BD: "Bandeja", G: "Grama", T: "Tonelada",
};

export const reg0190 = (unidade) => linha("0190", unidade, DESCRICAO_UNIDADE[unidade] ?? unidade);

export function reg0150(p) {
  const cod = codigoParticipante(p);
  return linha("0150", cod, p.nome, "01058", p.cnpj, p.cnpj ? "" : p.cpf, p.ie, p.codMunicipio,
    "", p.logradouro, p.numero, p.complemento, p.bairro);
}

const TIPO_ITEM_REVENDA = "00";
const TIPO_ITEM_PRODUTO_ACABADO = "04";

/** 0200 — com CEST no Fiscal (o das Contribuições termina em ALIQ_ICMS). */
export function reg0200(i, { cest }) {
  const campos = [
    i.codigo, i.descricao, "", "", i.unidade.toUpperCase(),
    /^[56]101$/.test(i.cfop) ? TIPO_ITEM_PRODUTO_ACABADO : TIPO_ITEM_REVENDA,
    i.ncm, "", i.ncm.slice(0, 2), "", i.icms.aliquota ? dec(i.icms.aliquota) : "",
  ];
  if (cest) campos.push(i.cest);
  return linha("0200", ...campos);
}

// ─── Bloco C ────────────────────────────────────────────────────────────────

/** IND_PGTO: 0 à vista, 1 a prazo, 2 outros. */
const indicadorPagamento = (v) => (v === "0" || v === "1" ? v : "2");

const dentroDoPeriodo = (data, periodo) => (data && data >= periodo.inicio && data <= periodo.fim ? data : "");

export function c100(d, periodo) {
  const cabecalho = [d.operacao, d.emitenteProprio ? "0" : "1"];
  if (d.situacao !== "00") {
    // Cancelada, denegada: só a identificação; o resto vai vazio.
    return linha("C100", ...cabecalho, "", d.modelo, d.situacao, d.serie, d.numero, d.chave, ...Array(20).fill(""));
  }
  const t = d.totais;
  const entradaSaida = dentroDoPeriodo(d.dataEntradaSaida, periodo) || d.emissao;
  return linha("C100", ...cabecalho, codigoParticipante(d.contraparte), d.modelo, d.situacao, d.serie, d.numero, d.chave,
    dataSped(d.emissao), dataSped(entradaSaida), dec(t.nota), indicadorPagamento(d.pagamentoIndicador),
    dec(t.desconto), "0,00", dec(t.produtos), d.frete, dec(t.frete), dec(t.seguro), dec(t.outras),
    dec(t.base), dec(t.icms), dec(t.baseSt), dec(t.st), dec(t.ipi), dec(t.pis), dec(t.cofins), "0,00", "0,00");
}

/** Origem + CST do ICMS (3 dígitos). CSOSN de fornecedor do Simples vira CST: 500 → 60, os demais → 90. */
export function cstIcms(i) {
  if (i.icms.simples) return `${i.icms.origem}${i.icms.cst === "500" ? "60" : "90"}`;
  return `${i.icms.origem}${String(i.icms.cst).padStart(2, "0")}`;
}

/**
 * C170. `pc` são os dados de PIS e COFINS já decididos pelo gerador (cada
 * arquivo trata a entrada de um jeito). `abatimento`: o Fiscal tem a coluna
 * VL_ABAT_NT no fim; as Contribuições não.
 */
export function c170(i, { pis, cofins, abatimento }) {
  const campos = [
    String(i.numero), i.codigo, "", dec(i.quantidade, 5), i.unidade.toUpperCase(), dec(i.valorProduto), dec(i.desconto), "0",
    cstIcms(i), i.cfop, "",
    dec(i.icms.base), dec(i.icms.aliquota), dec(i.icms.valor),
    dec(i.icms.baseSt), dec(i.icms.aliquotaSt), dec(i.icms.valorSt), i.ipi.cst ? "0" : "",
    i.ipi.cst, i.ipi.cst ? i.ipi.enquadramento || "999" : "", i.ipi.cst ? dec(i.ipi.base) : "", i.ipi.cst ? dec(i.ipi.aliquota) : "", i.ipi.cst ? dec(i.ipi.valor) : "",
    pis.cst, dec(pis.base), dec(pis.aliquota, 4), pis.quantidadeBase ? dec(pis.quantidadeBase, 3) : "", pis.aliquotaQuantidade ? dec(pis.aliquotaQuantidade, 4) : "", dec(pis.valor),
    cofins.cst, dec(cofins.base), dec(cofins.aliquota, 4), cofins.quantidadeBase ? dec(cofins.quantidadeBase, 3) : "", cofins.aliquotaQuantidade ? dec(cofins.aliquotaQuantidade, 4) : "", dec(cofins.valor),
    "",
  ];
  if (abatimento) campos.push("0,00");
  return linha("C170", ...campos);
}

/** C190: o ICMS do documento resumido por CST + CFOP + alíquota. */
export function c190s(d) {
  const grupos = new Map();
  for (const i of d.itens) {
    const cst = cstIcms(i);
    const chave = `${cst}|${i.cfop}|${i.icms.aliquota}`;
    const g = grupos.get(chave) ?? { cst, cfop: i.cfop, aliquota: i.icms.aliquota, opr: 0, base: 0, icms: 0, baseSt: 0, st: 0, reducao: 0, ipi: 0 };
    g.opr += i.valorProduto + i.frete + i.seguro + i.outras - i.desconto + i.icms.valorSt + i.ipi.valor;
    g.base += i.icms.base;
    g.icms += i.icms.valor;
    g.baseSt += i.icms.baseSt;
    g.st += i.icms.valorSt;
    g.ipi += i.ipi.valor;
    if (i.icms.reducaoBase > 0) g.reducao += Math.max(0, i.valorProduto - i.icms.base);
    grupos.set(chave, g);
  }
  return [...grupos.values()].map((g) =>
    linha("C190", g.cst, g.cfop, dec(g.aliquota), dec(arred(g.opr)), dec(arred(g.base)), dec(arred(g.icms)),
      dec(arred(g.baseSt)), dec(arred(g.st)), dec(arred(g.reducao)), dec(arred(g.ipi)), ""));
}

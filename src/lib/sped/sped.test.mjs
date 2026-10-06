// Rode com: node --test src/lib/sped/
import assert from "node:assert/strict";
import test from "node:test";

import { gerarSpedContribuicoes } from "./contribuicoes.js";
import { montarDocumentos } from "./escrituracao.js";
import { gerarSpedFiscal } from "./fiscal.js";
import { periodoDoMes } from "./formato.js";
import { lerNfe } from "./nfe.js";
import { gerarSintegra } from "./sintegra.js";
import { parseXml } from "./xml.js";

const NOSSO = "11222333000181";
const FORNECEDOR = "99888777000166";
const CLIENTE = "44555666000199";

const parte = (tag, cnpj, nome, ie, uf = "SE") =>
  `<${tag}><CNPJ>${cnpj}</CNPJ><xNome>${nome}</xNome><ender${tag === "emit" ? "Emit" : "Dest"}><xLgr>RUA A</xLgr><nro>10</nro><xBairro>CENTRO</xBairro><cMun>2800308</cMun><xMun>ARACAJU</xMun><UF>${uf}</UF><CEP>49000000</CEP><fone>7933334444</fone></ender${tag === "emit" ? "Emit" : "Dest"}><IE>${ie}</IE></${tag}>`;

const item = (n, cod, desc, cfop, vProd, icms, pis) =>
  `<det nItem="${n}"><prod><cProd>${cod}</cProd><xProd>${desc}</xProd><NCM>08051000</NCM><CFOP>${cfop}</CFOP><uCom>KG</uCom><qCom>100.0000</qCom><vProd>${vProd}</vProd></prod>` +
  `<imposto><ICMS>${icms}</ICMS><PIS>${pis}</PIS><COFINS><COFINSAliq><CST>01</CST><vBC>${vProd}</vBC><pCOFINS>3.0000</pCOFINS><vCOFINS>${(vProd * 0.03).toFixed(2)}</vCOFINS></COFINSAliq></COFINS></imposto></det>`;

const ICMS40 = "<ICMS40><orig>0</orig><CST>40</CST></ICMS40>";
const ICMS00 = "<ICMS00><orig>0</orig><CST>00</CST><modBC>3</modBC><vBC>1000.00</vBC><pICMS>19.00</pICMS><vICMS>190.00</vICMS></ICMS00>";
const PIS = (v) => `<PISAliq><CST>01</CST><vBC>${v}</vBC><pPIS>0.6500</pPIS><vPIS>${(v * 0.0065).toFixed(2)}</vPIS></PISAliq>`;

const nfe = ({ chave, num, emit, dest, tipo = "1", fin = "1", itens, vNF, vBC = "0.00", vICMS = "0.00" }) =>
  `<?xml version="1.0"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe${chave}">` +
  `<ide><mod>55</mod><serie>1</serie><nNF>${num}</nNF><dhEmi>2026-09-18T10:20:30-03:00</dhEmi><tpNF>${tipo}</tpNF><finNFe>${fin}</finNFe></ide>` +
  `${emit}${dest}${itens}<total><ICMSTot><vBC>${vBC}</vBC><vICMS>${vICMS}</vICMS><vBCST>0.00</vBCST><vST>0.00</vST><vProd>${vNF}</vProd><vFrete>0.00</vFrete><vSeg>0.00</vSeg><vDesc>0.00</vDesc><vIPI>0.00</vIPI><vPIS>0.00</vPIS><vCOFINS>0.00</vCOFINS><vOutro>0.00</vOutro><vNF>${vNF}</vNF></ICMSTot></total>` +
  `<transp><modFrete>9</modFrete></transp><pag><detPag><indPag>1</indPag><tPag>15</tPag><vPag>${vNF}</vPag></detPag></pag></infNFe></NFe>` +
  `<protNFe><infProt><chNFe>${chave}</chNFe><cStat>100</cStat></infProt></protNFe></nfeProc>`;

const chave = (n) => `28260911222333000181550010000${String(n).padStart(5, "0")}1123456780`;

const venda = nfe({
  chave: chave(1), num: "1", emit: parte("emit", NOSSO, "CARVALHO CRUZ LTDA", "270000001"), dest: parte("dest", CLIENTE, "MERCADO BOM PRECO", "270000002"),
  itens: item(1, "PRD001", "LARANJA PERA", "5101", 1000, ICMS40, PIS(1000)) + item(2, "PRD002", "ABOBORA", "5101", 500, ICMS40, PIS(500)), vNF: "1500.00",
});
const compra = nfe({
  chave: `28260999888777000166550010000000021123456780`, num: "2", emit: parte("emit", FORNECEDOR, "FORNECEDOR DE MACA SA", "270000003"), dest: parte("dest", NOSSO, "CARVALHO CRUZ LTDA", "270000001"),
  itens: item(1, "PRD001", "MACA FUJI", "5102", 1000, ICMS00, PIS(1000)), vNF: "1000.00", vBC: "1000.00", vICMS: "190.00",
});
const devolucao = nfe({
  chave: chave(3), num: "3", tipo: "0", fin: "4", emit: parte("emit", NOSSO, "CARVALHO CRUZ LTDA", "270000001"), dest: parte("dest", CLIENTE, "MERCADO BOM PRECO", "270000002"),
  itens: item(1, "PRD001", "LARANJA PERA", "1201", 200, ICMS40, PIS(200)), vNF: "200.00",
});

const notas = [
  { xml: venda, situacao: "autorizada" },
  { xml: compra, situacao: "autorizada" },
  { xml: devolucao, situacao: "autorizada" },
  { situacao: "cancelada", chave: chave(4), numero: 4, serie: 1, emissao: "2026-09-20" },
];
const { documentos, avisos } = montarDocumentos({ cnpjEmpresa: NOSSO, notas });
const periodo = periodoDoMes("2026-09");
const empresa = lerNfe(venda).emitente;

test("o XML é lido sem namespace e com acento/entidades", () => {
  const raiz = parseXml('<a xmlns="x"><b>Tom &amp; Jerry &#233;</b><c/></a>');
  assert.equal(raiz.filhos[0].filhos[0].texto, "Tom & Jerry é");
  const n = lerNfe(venda);
  assert.equal(n.numero, "1");
  assert.equal(n.itens.length, 2);
  assert.equal(n.itens[0].icms.cst, "40");
  assert.equal(n.emitente.cnpj, NOSSO);
});

test("classifica entrada, saída, devolução e cancelada", () => {
  assert.equal(avisos.length, 0);
  assert.equal(documentos.length, 4);
  const [d1, d2, d3, d4] = documentos;
  assert.deepEqual([d1.operacao, d1.emitenteProprio], ["1", true]);
  assert.deepEqual([d2.operacao, d2.emitenteProprio], ["0", false]);
  assert.equal(d2.itens[0].cfop, "1102"); // 5.102 do fornecedor vira 1.102 na entrada
  assert.equal(d3.devolucao, true);
  assert.equal(d4.situacao, "02");
});

const campos = (linha) => linha.split("|").length - 2;

test("SPED Fiscal: tamanho dos registros e bloco 9 batem", () => {
  const { linhas } = gerarSpedFiscal({ empresa, periodo, documentos });
  assert.ok(linhas[0].startsWith("|0000|019|0|01092026|30092026|CARVALHO CRUZ LTDA|11222333000181||SE|270000001|2800308"));
  assert.equal(campos(linhas[0]), 15);
  assert.ok(linhas.at(-1).startsWith("|9999|"));
  const por = (reg) => linhas.filter((l) => l.startsWith(`|${reg}|`));
  assert.ok(por("C100").every((l) => campos(l) === 29));
  assert.ok(por("C170").every((l) => campos(l) === 38));
  assert.ok(por("C190").every((l) => campos(l) === 12));
  assert.ok(por("0200").every((l) => campos(l) === 13));
  assert.ok(por("0150").every((l) => campos(l) === 13));
  assert.equal(por("C100").length, 4);
  assert.equal(por("C170").length, 4);
  // 9999 = total de linhas; 9900 de cada registro = quantidade real.
  assert.equal(Number(por("9999")[0].split("|")[2]), linhas.length);
  for (const l of por("9900")) {
    const [, , reg, qtd] = l.split("|");
    if (reg !== "9900") assert.equal(linhas.filter((x) => x.startsWith(`|${reg}|`)).length, Number(qtd), reg);
  }
  assert.equal(Number(por("0990")[0].split("|")[2]), linhas.findIndex((l) => l.startsWith("|0990|")) + 1);
  const cancelada = por("C100").find((l) => l.includes("|02|"));
  assert.ok(cancelada.startsWith(`|C100|1|0||55|02|1|4|${chave(4)}|`));
});

const ordemDosBlocos = (linhas) => {
  const blocos = [];
  for (const l of linhas) {
    const b = l.split("|")[1][0];
    if (blocos.at(-1) !== b) blocos.push(b);
  }
  return blocos.join("");
};

test("os blocos vêm completos e na ordem do leiaute", () => {
  const fiscal = gerarSpedFiscal({ empresa, periodo, documentos }).linhas;
  assert.equal(ordemDosBlocos(fiscal), "0BCDEGHK19");
  const contrib = gerarSpedContribuicoes({ empresa, periodo, documentos }).linhas;
  assert.equal(ordemDosBlocos(contrib), "0ACDFIMP19");
  for (const b of ["B", "D", "E", "G", "H", "K", "1"]) {
    assert.ok(fiscal.includes(`|${b}001|1|`) && fiscal.includes(`|${b}990|2|`), b);
  }
});

test("SPED Contribuições: compras ficam de fora por padrão", () => {
  const sem = gerarSpedContribuicoes({ empresa, periodo, documentos });
  const com = gerarSpedContribuicoes({ empresa, periodo, documentos, incluirCompras: true });
  const c100 = (r) => r.linhas.filter((l) => l.startsWith("|C100|")).length;
  assert.equal(c100(sem), 3);
  assert.equal(c100(com), 4);
  assert.ok(sem.linhas.filter((l) => l.startsWith("|C170|")).every((l) => campos(l) === 37));
  assert.equal(campos(sem.linhas[0]), 14);
  // Devolução: CST 98 mas com base e valor da nota.
  const dev = sem.linhas.find((l) => l.startsWith("|C170|1|PRD001") && l.includes("|1201|"));
  assert.ok(dev.includes("|98|200,00|0,6500||"), dev);
  assert.equal(Number(sem.linhas.find((l) => l.startsWith("|9999|")).split("|")[2]), sem.linhas.length);
});

test("Sintegra: todas as linhas têm 126 posições e o 90 fecha a conta", () => {
  const { linhas } = gerarSintegra({ empresa, periodo, documentos });
  assert.ok(linhas.every((l) => l.length === 126), linhas.filter((l) => l.length !== 126).join("\n"));
  const tipo = (t) => linhas.filter((l) => l.startsWith(t));
  assert.equal(tipo("10").length, 1);
  assert.equal(tipo("11").length, 1);
  assert.equal(tipo("54").length, 4);
  assert.equal(tipo("75").length, 3); // PRD001, PRD002 e o da compra (código do fornecedor)
  const r90 = linhas.at(-1);
  assert.ok(r90.includes(`99${String(linhas.length).padStart(8, "0")}`));
  const r50 = tipo("50").find((l) => l.includes("000001") && l.includes("5101"));
  assert.ok(r50.includes("00000150000N") || r50.includes("0000000000000000000150000"), r50);
});

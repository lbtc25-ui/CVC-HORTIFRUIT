/**
 * Sintegra (Convênio ICMS 57/95) — registros 10, 11, 50, 54, 75 e 90.
 *
 * Linhas de 126 posições, texto em maiúsculas sem acento, números alinhados à
 * direita com zeros e texto à esquerda com espaços. O 50 é a nota (uma linha
 * por CFOP e alíquota), o 54 são os itens, o 75 é o cadastro de produtos e o
 * 90 é o totalizador.
 */

import { cadastros } from "./escrituracao.js";
import { arred, dataSintegra } from "./formato.js";
import { cstIcms } from "./sped.js";

const ascii = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^\x20-\x7E]/g, " ");
const txt = (s, n) => ascii(s).slice(0, n).padEnd(n, " ");
const dig = (s, n) => String(s ?? "").replace(/\D/g, "").slice(-n).padStart(n, "0");
/** Número sem vírgula, com `casas` decimais embutidas, `inteiros + casas` posições. */
const num = (v, inteiros, casas) =>
  String(Math.round(Math.abs(Number(v) || 0) * 10 ** casas)).slice(-(inteiros + casas)).padStart(inteiros + casas, "0");

const ST_ISENTA = new Set(["30", "40", "41", "50"]);

/** Código do produto em 14 posições: o próprio, se couber e for de nota nossa; senão um sequencial. */
function mapaDeCodigos(itens) {
  const usados = new Set();
  const mapa = new Map();
  for (const codigo of itens.keys()) {
    if (/^[A-Za-z0-9]{1,14}$/.test(codigo)) {
      mapa.set(codigo, codigo.toUpperCase());
      usados.add(codigo.toUpperCase());
    }
  }
  let seq = 1;
  for (const codigo of itens.keys()) {
    if (mapa.has(codigo)) continue;
    let novo;
    do novo = String(seq++).padStart(14, "0"); while (usados.has(novo));
    usados.add(novo);
    mapa.set(codigo, novo);
  }
  return mapa;
}

const cnpjDoDoc = (p) => dig(p?.cnpj || p?.cpf, 14);
const ieDoDoc = (p) => (p?.ie ? txt(p.ie, 14) : txt("ISENTO", 14));

export function gerarSintegra({ empresa, periodo, documentos }) {
  const { itens } = cadastros(documentos);
  const codigos = mapaDeCodigos(itens);
  const cnpj = dig(empresa.cnpj, 14);
  const ie = txt(empresa.ie, 14);
  const dataIni = dataSintegra(periodo.inicio);
  const dataFim = dataSintegra(periodo.fim);

  const linhas = [];
  linhas.push(`10${cnpj}${ie}${txt(empresa.nome, 35)}${txt(empresa.municipio, 30)}${txt(empresa.uf, 2)}${dig("", 10)}${dataIni}${dataFim}331`);
  linhas.push(`11${txt(empresa.logradouro, 34)}${txt(empresa.numero, 5)}${txt(empresa.complemento, 22)}${txt(empresa.bairro, 15)}${dig(empresa.cep, 8)}${txt(empresa.fantasia || empresa.nome, 28)}${dig(empresa.fone, 12)}`);

  let n50 = 0;
  let n54 = 0;
  for (const d of documentos) {
    const proprio = d.emitenteProprio ? "P" : "T";
    const serie = txt(d.serie, 3);
    const numero = dig(d.numero, 6);
    if (d.situacao !== "00") {
      linhas.push(`50${dig("", 14)}${txt("", 14)}${dataSintegra(d.emissao)}${txt(empresa.uf, 2)}${dig(d.modelo, 2)}${serie}${numero}0000${proprio}${num(0, 11, 2)}${num(0, 11, 2)}${num(0, 11, 2)}${num(0, 11, 2)}${num(0, 11, 2)}${num(0, 2, 2)}S`);
      n50++;
      continue;
    }
    const entradaSaida = d.operacao === "1" ? d.emissao
      : (d.dataEntradaSaida >= periodo.inicio && d.dataEntradaSaida <= periodo.fim ? d.dataEntradaSaida : d.emissao);
    const parte = d.contraparte;
    const cabecalho = `${cnpjDoDoc(parte)}${ieDoDoc(parte)}${dataSintegra(entradaSaida)}${txt(parte?.uf || "EX", 2)}${dig(d.modelo, 2)}${serie}${numero}`;

    const grupos = new Map();
    for (const i of d.itens) {
      const chave = `${i.cfop}|${i.icms.aliquota}`;
      const g = grupos.get(chave) ?? { cfop: i.cfop, aliquota: i.icms.aliquota, valor: 0, base: 0, icms: 0, isenta: 0 };
      const opr = i.valorProduto + i.frete + i.seguro + i.outras - i.desconto + i.icms.valorSt + i.ipi.valor;
      g.valor += opr;
      g.base += i.icms.base;
      g.icms += i.icms.valor;
      if (ST_ISENTA.has(cstIcms(i).slice(1))) g.isenta += opr;
      grupos.set(chave, g);
    }
    for (const g of grupos.values()) {
      const valor = arred(g.valor);
      const outras = Math.max(0, arred(valor - g.base - g.isenta));
      linhas.push(`50${cabecalho}${dig(g.cfop, 4)}${proprio}${num(valor, 11, 2)}${num(g.base, 11, 2)}${num(g.icms, 11, 2)}${num(g.isenta, 11, 2)}${num(outras, 11, 2)}${num(g.aliquota, 2, 2)}N`);
      n50++;
    }
    for (const i of d.itens) {
      linhas.push(`54${cnpjDoDoc(parte)}${dig(d.modelo, 2)}${serie}${numero}${dig(i.cfop, 4)}${cstIcms(i)}${dig(i.numero, 3)}${txt(codigos.get(i.codigo), 14)}${num(i.quantidade, 8, 3)}${num(i.valorProduto, 10, 2)}${num(i.desconto, 10, 2)}${num(i.icms.base, 10, 2)}${num(i.icms.baseSt, 10, 2)}${num(i.ipi.valor, 10, 2)}${num(i.icms.aliquota, 2, 2)}`);
      n54++;
    }
  }

  let n75 = 0;
  for (const [codigo, i] of itens) {
    linhas.push(`75${dataIni}${dataFim}${txt(codigos.get(codigo), 14)}${txt(i.ncm, 8)}${txt(i.descricao, 53)}${txt(i.unidade, 6)}${num(i.ipi.aliquota, 3, 2)}${num(i.icms.aliquota, 2, 2)}${num(i.icms.reducaoBase, 3, 2)}${num(i.icms.baseSt, 11, 2)}`);
    n75++;
  }

  // 90: contagem por tipo; "99" é o total de linhas do arquivo, o próprio 90 incluído.
  const pares = [["50", n50], ["54", n54], ["75", n75]].filter(([, q]) => q > 0);
  const total = linhas.length + 1;
  pares.push(["99", total]);
  linhas.push(`90${cnpj}${ie}${pares.map(([t, q]) => `${t}${String(q).padStart(8, "0")}`).join("").padEnd(90, " ")}     1`);

  return { linhas, registros: linhas.length };
}

/**
 * Lê o XML de uma NF-e (nfeProc ou NFe) e devolve o que a escrituração
 * (SPED Fiscal, SPED Contribuições e Sintegra) precisa: cabeçalho, emitente,
 * destinatário, totais e itens com os impostos de cada um.
 *
 * Valores numéricos viram Number; texto fica texto. Campo ausente vira 0 ou "".
 */

import { achar, caminho, filho, lista, parseXml, texto } from "./xml.js";

const num = (s) => {
  const n = Number(s);
  return s === "" || !Number.isFinite(n) ? 0 : n;
};

const soDigitos = (v) => String(v ?? "").replace(/\D/g, "");

function parte(no, nomeEnder) {
  if (!no) return null;
  const e = filho(no, nomeEnder);
  return {
    cnpj: soDigitos(texto(no, "CNPJ")),
    cpf: soDigitos(texto(no, "CPF")),
    idEstrangeiro: texto(no, "idEstrangeiro"),
    nome: texto(no, "xNome"),
    fantasia: texto(no, "xFant"),
    ie: soDigitos(texto(no, "IE")),
    indIE: texto(no, "indIEDest"),
    logradouro: texto(e, "xLgr"),
    numero: texto(e, "nro"),
    complemento: texto(e, "xCpl"),
    bairro: texto(e, "xBairro"),
    codMunicipio: soDigitos(texto(e, "cMun")),
    municipio: texto(e, "xMun"),
    uf: texto(e, "UF"),
    cep: soDigitos(texto(e, "CEP")),
    fone: soDigitos(texto(e, "fone")),
  };
}

/** O primeiro filho de um grupo de imposto (ICMS00, ICMSSN102, PISAliq...). */
const primeiroFilho = (no) => no?.filhos[0];

function lerItem(det) {
  const prod = filho(det, "prod");
  const imposto = filho(det, "imposto");
  const icmsNo = primeiroFilho(filho(imposto, "ICMS"));
  const ipiNo = primeiroFilho(filho(imposto, "IPI")?.filhos.find((f) => f.nome === "IPITrib" || f.nome === "IPINT"));
  const pisNo = primeiroFilho(filho(imposto, "PIS"));
  const cofinsNo = primeiroFilho(filho(imposto, "COFINS"));
  const g = (no, nome) => num(texto(no, nome));
  return {
    numero: Number(det.attrs.nItem) || 0,
    codigo: texto(prod, "cProd"),
    descricao: texto(prod, "xProd"),
    ncm: soDigitos(texto(prod, "NCM")),
    cest: soDigitos(texto(prod, "CEST")),
    cfop: soDigitos(texto(prod, "CFOP")),
    unidade: texto(prod, "uCom"),
    quantidade: g(prod, "qCom"),
    valorProduto: g(prod, "vProd"),
    frete: g(prod, "vFrete"),
    seguro: g(prod, "vSeg"),
    desconto: g(prod, "vDesc"),
    outras: g(prod, "vOutro"),
    icms: {
      origem: texto(icmsNo, "orig") || "0",
      cst: texto(icmsNo, "CST") || texto(icmsNo, "CSOSN"),
      simples: !!texto(icmsNo, "CSOSN"),
      base: g(icmsNo, "vBC"),
      aliquota: g(icmsNo, "pICMS"),
      valor: g(icmsNo, "vICMS"),
      reducaoBase: g(icmsNo, "pRedBC"),
      baseSt: g(icmsNo, "vBCST"),
      aliquotaSt: g(icmsNo, "pICMSST"),
      valorSt: g(icmsNo, "vICMSST"),
    },
    ipi: {
      cst: texto(ipiNo, "CST"),
      enquadramento: texto(filho(imposto, "IPI"), "cEnq"),
      base: g(ipiNo, "vBC"),
      aliquota: g(ipiNo, "pIPI"),
      valor: g(ipiNo, "vIPI"),
    },
    pis: {
      cst: texto(pisNo, "CST"),
      base: g(pisNo, "vBC"),
      aliquota: g(pisNo, "pPIS"),
      valor: g(pisNo, "vPIS"),
      quantidadeBase: g(pisNo, "qBCProd"),
      aliquotaQuantidade: g(pisNo, "vAliqProd"),
    },
    cofins: {
      cst: texto(cofinsNo, "CST"),
      base: g(cofinsNo, "vBC"),
      aliquota: g(cofinsNo, "pCOFINS"),
      valor: g(cofinsNo, "vCOFINS"),
      quantidadeBase: g(cofinsNo, "qBCProd"),
      aliquotaQuantidade: g(cofinsNo, "vAliqProd"),
    },
  };
}

/** "2026-09-18T10:20:30-03:00" → "2026-09-18" (o dia como está escrito na nota, sem mudar de fuso). */
export const diaDaNota = (dh) => String(dh ?? "").slice(0, 10);

export function lerNfe(xml) {
  const raiz = parseXml(xml);
  const inf = achar(raiz, "infNFe");
  if (!inf) throw new Error("O arquivo não é uma NF-e (sem infNFe).");
  const ide = filho(inf, "ide");
  const tot = caminho(inf, "total", "ICMSTot");
  const prot = achar(raiz, "infProt");
  const pagamento = caminho(inf, "pag", "detPag");
  const t = (nome) => num(texto(tot, nome));
  return {
    chave: texto(prot, "chNFe") || soDigitos(inf.attrs.Id),
    protocoloStatus: texto(prot, "cStat"),
    modelo: texto(ide, "mod") || "55",
    serie: texto(ide, "serie") || "0",
    numero: texto(ide, "nNF"),
    emissao: diaDaNota(texto(ide, "dhEmi") || texto(ide, "dEmi")),
    saidaEntrada: diaDaNota(texto(ide, "dhSaiEnt") || texto(ide, "dSaiEnt")),
    tipo: texto(ide, "tpNF"), // 1 = saída, 0 = entrada
    finalidade: texto(ide, "finNFe"), // 4 = devolução
    natureza: texto(ide, "natOp"),
    emitente: parte(filho(inf, "emit"), "enderEmit"),
    destinatario: parte(filho(inf, "dest"), "enderDest"),
    frete: texto(caminho(inf, "transp"), "modFrete") || "9",
    pagamentoIndicador: texto(pagamento, "indPag"),
    totais: {
      base: t("vBC"), icms: t("vICMS"), baseSt: t("vBCST"), st: t("vST"),
      produtos: t("vProd"), frete: t("vFrete"), seguro: t("vSeg"), desconto: t("vDesc"),
      ipi: t("vIPI"), pis: t("vPIS"), cofins: t("vCOFINS"), outras: t("vOutro"), nota: t("vNF"),
    },
    itens: lista(inf, "det").map(lerItem),
  };
}

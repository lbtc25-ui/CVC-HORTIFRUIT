// Peças puras da conversa com a SEFAZ — sem rede e sem banco, para dar para
// testar isoladas. Quem chama a SEFAZ e grava no Supabase é o api/sefaz.js
// (a pasta começa com "_" para a Vercel não publicar isto como rota).
//
// Três serviços do Ambiente Nacional:
//   - NFeDistribuicaoDFe, distNSU: "o que chegou para o CNPJ depois do NSU X".
//     Cada documento vem compactado (gzip + base64) num <docZip>, com um NSU
//     sequencial. Guardar o último NSU lido é o que evita baixar tudo de novo.
//   - NFeDistribuicaoDFe, consChNFe: uma nota específica, pela chave — serve
//     para pegar o XML completo logo depois da manifestação.
//   - NFeRecepcaoEvento4: a manifestação do destinatário (ciência,
//     confirmação, desconhecimento, operação não realizada), assinada com o
//     certificado A1 da empresa.

import crypto from "node:crypto";
import zlib from "node:zlib";

import forge from "node-forge";

const NS_NFE = "http://www.portalfiscal.inf.br/nfe";
const NS_DSIG = "http://www.w3.org/2000/09/xmldsig#";
const C14N = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";

export const URLS = {
  producao: {
    distribuicao: "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx",
    evento: "https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx",
  },
  homologacao: {
    distribuicao: "https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx",
    evento: "https://hom1.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx",
  },
};

export const ACAO_DISTRIBUICAO = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse";
export const ACAO_EVENTO = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento";

/**
 * Manifestações do destinatário. A chave é o nome que o app usa (o mesmo
 * que a tela já usava com a Spedy); `descEvento` tem que ser exatamente
 * este texto, sem acento — a SEFAZ confere.
 */
export const MANIFESTACOES = {
  confirmed: { tpEvento: "210200", descEvento: "Confirmacao da Operacao", justificativa: false },
  acknowledged: { tpEvento: "210210", descEvento: "Ciencia da Operacao", justificativa: false },
  unknown: { tpEvento: "210220", descEvento: "Desconhecimento da Operacao", justificativa: true },
  notPerformed: { tpEvento: "210240", descEvento: "Operacao nao Realizada", justificativa: true },
};
const MANIFESTACAO_POR_EVENTO = Object.fromEntries(Object.entries(MANIFESTACOES).map(([k, v]) => [v.tpEvento, k]));

/** Ciência é provisória; as outras três são definitivas e não voltam atrás. */
export function manifestacaoMaisForte(atual, nova) {
  const peso = (m) => (!m || m === "none" ? 0 : m === "acknowledged" ? 1 : 2);
  return peso(nova) >= peso(atual) ? nova : atual;
}

// ─── Certificado ────────────────────────────────────────────────────────────

/**
 * Abre o .pfx (A1) e devolve o que a conexão e a assinatura precisam, em PEM.
 * node-forge em vez do OpenSSL do Node porque muito .pfx de AC brasileira
 * ainda usa criptografia antiga (RC2/3DES) que o OpenSSL 3 recusa.
 */
export function abrirCertificado(pfxBase64, senha) {
  let p12;
  try {
    const der = forge.util.decode64(String(pfxBase64).replace(/\s+/g, ""));
    p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), false, senha ?? "");
  } catch (e) {
    throw new Error(`Não deu para abrir o certificado (.pfx) — confira o arquivo e a senha. (${e.message})`, { cause: e });
  }
  const bags = (tipo) => p12.getBags({ bagType: tipo })[tipo] ?? [];
  const chaves = [...bags(forge.pki.oids.pkcs8ShroudedKeyBag), ...bags(forge.pki.oids.keyBag)].map((b) => b.key).filter(Boolean);
  const certs = bags(forge.pki.oids.certBag).map((b) => b.cert).filter(Boolean);
  const chave = chaves[0];
  if (!chave) throw new Error("O .pfx não tem chave privada.");
  // O certificado da empresa é o que casa com a chave; os outros são a cadeia da AC.
  const titular = certs.find((c) => c.publicKey.n?.equals(chave.n));
  if (!titular) throw new Error("O .pfx não tem o certificado da chave privada.");
  const cadeia = certs.filter((c) => c !== titular);

  const cn = titular.subject.getField("CN")?.value ?? "";
  const cnpj = (cn.match(/:(\d{14})$/) ?? [])[1] ?? null;
  const derTitular = forge.asn1.toDer(forge.pki.certificateToAsn1(titular)).getBytes();

  return {
    keyPem: forge.pki.privateKeyToPem(chave),
    // O certificado seguido da cadeia, para a SEFAZ conseguir validar o cliente.
    certPem: [titular, ...cadeia].map((c) => forge.pki.certificateToPem(c)).join(""),
    certBase64: forge.util.encode64(derTitular),
    titular: cn,
    cnpj,
    validoAte: titular.validity.notAfter.toISOString(),
  };
}

// ─── XML: montar ────────────────────────────────────────────────────────────

// Texto de elemento como a C14N o escreve (aspas ficam como estão) — senão o
// digest calculado aqui não bate com o que a SEFAZ recalcula.
const escapar = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const envelope = (corpo) =>
  `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body>${corpo}</soap12:Body></soap12:Envelope>`;

/** Pedido de distribuição: `{ ultNSU }` (o que chegou depois) ou `{ chave }` (uma nota). */
export function montarDistribuicao({ tpAmb, cUFAutor, cnpj, ultNSU, chave }) {
  const consulta = chave
    ? `<consChNFe><chNFe>${chave}</chNFe></consChNFe>`
    : `<distNSU><ultNSU>${String(ultNSU ?? 0).padStart(15, "0")}</ultNSU></distNSU>`;
  const dist = `<distDFeInt xmlns="${NS_NFE}" versao="1.01"><tpAmb>${tpAmb}</tpAmb><cUFAutor>${cUFAutor}</cUFAutor><CNPJ>${cnpj}</CNPJ>${consulta}</distDFeInt>`;
  return envelope(`<nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDadosMsg>${dist}</nfeDadosMsg></nfeDistDFeInteresse>`);
}

/** "2026-09-26T14:03:09-03:00" — hora de Brasília, que é o fuso de Sergipe. */
export function dataHoraBrasilia(instante = new Date()) {
  const d = new Date(instante.getTime() - 3 * 3600 * 1000);
  return `${d.toISOString().slice(0, 19)}-03:00`;
}

/** Justificativa aceita pela SEFAZ: uma linha, sem espaço sobrando. */
export const limparJustificativa = (s) => [...String(s ?? "")].map((c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? " " : c)).join("").replace(/\s+/g, " ").trim();

/**
 * Evento de manifestação assinado, já no envelope SOAP.
 *
 * A assinatura (XMLDSig enveloped, RSA-SHA1, C14N inclusiva — o que o
 * manual da NF-e exige) é montada à mão: como o XML é gerado aqui, sem
 * espaços nem quebras, a forma canônica de <infEvento> é ele mesmo com o
 * namespace herdado de <evento> declarado — não precisa de biblioteca de
 * canonicalização.
 */
export function montarManifestacao({ tpAmb, cnpj, chave, manifestacao, justificativa, dhEvento, cert, idLote }) {
  const tipo = MANIFESTACOES[manifestacao];
  if (!tipo) throw new Error(`Manifestação desconhecida: ${manifestacao}`);
  const nSeq = 1; // cada tipo de manifestação só acontece uma vez por nota
  const id = `ID${tipo.tpEvento}${chave}${String(nSeq).padStart(2, "0")}`;
  const xJust = tipo.justificativa ? `<xJust>${escapar(limparJustificativa(justificativa))}</xJust>` : "";

  const interno =
    `<cOrgao>91</cOrgao><tpAmb>${tpAmb}</tpAmb><CNPJ>${cnpj}</CNPJ><chNFe>${chave}</chNFe>` +
    `<dhEvento>${dhEvento}</dhEvento><tpEvento>${tipo.tpEvento}</tpEvento><nSeqEvento>${nSeq}</nSeqEvento>` +
    `<verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>${tipo.descEvento}</descEvento>${xJust}</detEvento>`;

  const canonico = `<infEvento xmlns="${NS_NFE}" Id="${id}">${interno}</infEvento>`;
  const digest = crypto.createHash("sha1").update(canonico, "utf8").digest("base64");
  const signedInfo =
    `<SignedInfo xmlns="${NS_DSIG}"><CanonicalizationMethod Algorithm="${C14N}"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="${NS_DSIG}rsa-sha1"></SignatureMethod><Reference URI="#${id}"><Transforms>` +
    `<Transform Algorithm="${NS_DSIG}enveloped-signature"></Transform><Transform Algorithm="${C14N}"></Transform>` +
    `</Transforms><DigestMethod Algorithm="${NS_DSIG}sha1"></DigestMethod><DigestValue>${digest}</DigestValue></Reference></SignedInfo>`;
  const valor = crypto.createSign("RSA-SHA1").update(signedInfo, "utf8").sign(cert.keyPem, "base64");
  const assinatura =
    `<Signature xmlns="${NS_DSIG}">${signedInfo}<SignatureValue>${valor}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${cert.certBase64}</X509Certificate></X509Data></KeyInfo></Signature>`;

  const envEvento =
    `<envEvento xmlns="${NS_NFE}" versao="1.00"><idLote>${idLote}</idLote>` +
    `<evento versao="1.00"><infEvento Id="${id}">${interno}</infEvento>${assinatura}</evento></envEvento>`;
  return envelope(`<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">${envEvento}</nfeDadosMsg>`);
}

// ─── XML: ler ───────────────────────────────────────────────────────────────

const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const desescapar = (s) =>
  String(s).replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
    e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENTIDADES[e] ?? m);

/** Texto do primeiro <nome> (com ou sem prefixo de namespace). */
export function tag(xml, nome) {
  const m = String(xml ?? "").match(new RegExp(`<(?:[\\w-]+:)?${nome}(?:\\s[^>]*)?>([^<]*)</(?:[\\w-]+:)?${nome}>`));
  return m ? desescapar(m[1].trim()) : "";
}

/** O trecho <nome>…</nome> inteiro, para ler campos de dentro dele. */
export function bloco(xml, nome) {
  const m = String(xml ?? "").match(new RegExp(`<(?:[\\w-]+:)?${nome}(?:\\s[^>]*)?>[\\s\\S]*?</(?:[\\w-]+:)?${nome}>`));
  return m ? m[0] : "";
}

/** Resposta da distribuição: situação, NSUs e os documentos já descompactados. */
export function lerDistribuicao(resposta) {
  const ret = bloco(resposta, "retDistDFeInt");
  if (!ret) throw new Error(`Resposta inesperada da SEFAZ: ${String(resposta).slice(0, 300)}`);
  const docs = [...ret.matchAll(/<(?:[\w-]+:)?docZip\s([^>]*)>([^<]+)</g)].map(([, attrs, b64]) => {
    const attr = (n) => (attrs.match(new RegExp(`${n}="([^"]*)"`)) ?? [])[1] ?? "";
    return { nsu: attr("NSU"), schema: attr("schema"), xml: zlib.gunzipSync(Buffer.from(b64, "base64")).toString("utf8") };
  });
  return {
    cStat: tag(ret, "cStat"),
    xMotivo: tag(ret, "xMotivo"),
    ultNSU: tag(ret, "ultNSU"),
    maxNSU: tag(ret, "maxNSU"),
    docs,
  };
}

/** Resposta do evento: o resultado do lote e o do evento em si. */
export function lerRetornoEvento(resposta) {
  const ret = bloco(resposta, "retEnvEvento");
  if (!ret) throw new Error(`Resposta inesperada da SEFAZ: ${String(resposta).slice(0, 300)}`);
  const evento = bloco(ret, "retEvento");
  return {
    cStatLote: tag(ret, "cStat"),
    xMotivoLote: tag(ret, "xMotivo"),
    cStat: evento ? tag(evento, "cStat") : "",
    xMotivo: evento ? tag(evento, "xMotivo") : "",
    nProt: evento ? tag(evento, "nProt") : "",
    dhRegEvento: evento ? tag(evento, "dhRegEvento") : "",
    xml: evento,
  };
}

const SITUACAO_RESUMO = { 1: "authorized", 2: "denied", 3: "canceled" };

/**
 * Um documento da distribuição, traduzido para o que se grava em
 * `nfe_recebidas`. Devolve:
 *   { tipo: "nota", nota: {...} }        resumo (resNFe) ou nota completa (procNFe)
 *   { tipo: "evento", evento: {...} }    cancelamento / manifestação de uma nota
 *   null                                 documento que não interessa
 */
export function lerDocumento({ nsu, schema, xml }) {
  if (schema.startsWith("resNFe")) {
    return {
      tipo: "nota",
      nota: {
        chave: tag(xml, "chNFe"),
        nsu: Number(nsu),
        emitente_cnpj: tag(xml, "CNPJ") || tag(xml, "CPF"),
        emitente_nome: tag(xml, "xNome"),
        emitente_ie: tag(xml, "IE"),
        emitida_em: tag(xml, "dhEmi") || null,
        tipo_nf: tag(xml, "tpNF") === "0" ? "entrada" : "saida",
        valor: Number(tag(xml, "vNF")) || 0,
        protocolo: tag(xml, "nProt") || null,
        situacao: SITUACAO_RESUMO[tag(xml, "cSitNFe")] ?? "authorized",
        completo: false,
      },
    };
  }
  if (schema.startsWith("procNFe")) {
    const ide = bloco(xml, "ide");
    const emit = bloco(xml, "emit");
    const prot = bloco(xml, "infProt");
    const chave = tag(prot, "chNFe") || ((xml.match(/Id="NFe(\d{44})"/) ?? [])[1] ?? "");
    const cStat = tag(prot, "cStat");
    return {
      tipo: "nota",
      nota: {
        chave,
        nsu: Number(nsu) || null,
        emitente_cnpj: tag(emit, "CNPJ") || tag(emit, "CPF"),
        emitente_nome: tag(emit, "xNome"),
        emitente_fantasia: tag(emit, "xFant") || null,
        emitente_ie: tag(emit, "IE"),
        emitida_em: tag(ide, "dhEmi") || (tag(ide, "dEmi") ? `${tag(ide, "dEmi")}T00:00:00-03:00` : null),
        tipo_nf: tag(ide, "tpNF") === "0" ? "entrada" : "saida",
        numero: Number(tag(ide, "nNF")) || null,
        serie: tag(ide, "serie") || null,
        valor: Number(tag(bloco(xml, "ICMSTot"), "vNF")) || 0,
        protocolo: tag(prot, "nProt") || null,
        situacao: ["110", "301", "302", "303"].includes(cStat) ? "denied" : "authorized",
        completo: true,
        xml,
      },
    };
  }
  if (schema.startsWith("resEvento") || schema.startsWith("procEventoNFe")) {
    const inf = bloco(xml, "infEvento") || xml;
    return {
      tipo: "evento",
      evento: {
        chave: tag(inf, "chNFe"),
        tpEvento: tag(inf, "tpEvento"),
        dhEvento: tag(inf, "dhEvento") || null,
        autorCnpj: tag(inf, "CNPJ"),
        protocolo: tag(xml, "nProt") || null,
      },
    };
  }
  return null;
}

/**
 * Junta o que já estava gravado com o que a SEFAZ acabou de mandar. Regras:
 * a nota completa nunca volta a resumo; cancelada nunca volta a autorizada;
 * manifestação só avança (ciência → definitiva).
 */
export function juntarNota(atual, nova) {
  if (!atual) return { manifestacao: "none", ...nova };
  const junto = { ...atual };
  for (const [k, v] of Object.entries(nova)) {
    if (v === null || v === undefined || v === "") continue;
    if (atual.completo && !nova.completo && ["completo", "xml", "emitente_nome", "valor", "emitida_em"].includes(k)) continue;
    junto[k] = v;
  }
  if (atual.situacao === "canceled") junto.situacao = "canceled";
  junto.completo = Boolean(atual.completo || nova.completo);
  return junto;
}

/** Aplica um evento (cancelamento ou manifestação) à nota já gravada. */
export function aplicarEvento(nota, evento, nossoCnpj) {
  if (!nota) return null;
  if (evento.tpEvento === "110111" || evento.tpEvento === "110112") {
    return { ...nota, situacao: "canceled", cancelada_em: evento.dhEvento };
  }
  const man = MANIFESTACAO_POR_EVENTO[evento.tpEvento];
  if (man && (!nossoCnpj || evento.autorCnpj.slice(0, 8) === nossoCnpj.slice(0, 8))) {
    const final = manifestacaoMaisForte(nota.manifestacao, man);
    if (final === nota.manifestacao) return null;
    return { ...nota, manifestacao: final, manifestada_em: evento.dhEvento };
  }
  return null;
}

// Vercel Function — notas recebidas direto da SEFAZ, com o certificado A1.
//
// Substitui o recurso "notas recebidas" da Spedy (que não estava no plano).
// O certificado dá poder de manifestar em nome da empresa, então ele e a
// senha ficam só em variável de ambiente do servidor, nunca no navegador:
//
//   SEFAZ_CERT_PFX_BASE64   o arquivo .pfx em base64
//   SEFAZ_CERT_SENHA        a senha do .pfx
//   SEFAZ_AMBIENTE          "producao" (padrão) ou "homologacao"
//   SEFAZ_CNPJ              CNPJ que recebe as notas — por padrão, o do
//                           certificado; para a filial com o certificado da
//                           matriz, o CNPJ da filial (mesma raiz)
//   SEFAZ_UF_AUTOR          opcional — código IBGE da UF (padrão 28, Sergipe)
//   SEFAZ_CA_PEM            opcional — cadeia ICP-Brasil em PEM (ver agente())
//   SUPABASE_SERVICE_ROLE_KEY  para gravar as notas (a tabela é só leitura
//                              para o app — quem escreve é esta função)
//   CRON_SECRET             opcional — a Vercel manda no cron diário
//
// Ações (POST com o token de login do Supabase em Authorization):
//   { acao: "sincronizar" }                 busca o que chegou desde o último NSU
//   { acao: "consultar-chave", chave }      pega uma nota pela chave (XML completo)
//   { acao: "manifestar", chave, manifestacao, justificativa? }
//   { acao: "status" }                      o certificado abre? até quando vale?
// GET ?acao=sincronizar é o cron diário da Vercel (vercel.json).
//
// A SEFAZ bloqueia por uma hora o CNPJ que consulta a distribuição sem ter
// nada novo (cStat 656, "consumo indevido"). Por isso o estado da busca fica
// no banco (sefaz_dfe_estado): último NSU, e a partir de quando pode buscar de
// novo — a mesma regra vale para quem estiver com o app aberto e para o cron.

import crypto from "node:crypto";
import https from "node:https";
import tls from "node:tls";

import { createClient } from "@supabase/supabase-js";

import {
  ACAO_DISTRIBUICAO,
  ACAO_EVENTO,
  MANIFESTACOES,
  URLS,
  abrirCertificado,
  aplicarEvento,
  dataHoraBrasilia,
  juntarNota,
  lerDistribuicao,
  lerDocumento,
  lerRetornoEvento,
  limparJustificativa,
  manifestacaoMaisForte,
  montarDistribuicao,
  montarManifestacao,
} from "./_lib/dfe.js";

const UMA_HORA = 3600 * 1000;
// Colunas de nfe_recebidas menos o xml, que é pesado e só vai quando muda.
const COLUNAS = [
  "chave", "ambiente", "nsu", "emitente_cnpj", "emitente_nome", "emitente_fantasia", "emitente_ie",
  "emitida_em", "tipo_nf", "numero", "serie", "valor", "protocolo", "situacao", "cancelada_em",
  "completo", "manifestacao", "manifestada_em", "manifestacao_protocolo", "justificativa",
];

class ErroHttp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

// ─── Configuração ───────────────────────────────────────────────────────────

let certCache = null;
function certificado() {
  const pfx = process.env.SEFAZ_CERT_PFX_BASE64;
  if (!pfx) throw new ErroHttp(500, "Certificado A1 não configurado no servidor (SEFAZ_CERT_PFX_BASE64 e SEFAZ_CERT_SENHA na Vercel).");
  if (!certCache) certCache = abrirCertificado(pfx, process.env.SEFAZ_CERT_SENHA);
  return certCache;
}

function config() {
  const cert = certificado();
  const ambiente = process.env.SEFAZ_AMBIENTE === "homologacao" ? "homologacao" : "producao";
  const cnpj = String(process.env.SEFAZ_CNPJ || cert.cnpj || "").replace(/\D/g, "");
  if (cnpj.length !== 14) throw new ErroHttp(500, "Não deu para ler o CNPJ do certificado — defina SEFAZ_CNPJ na Vercel.");
  // A SEFAZ aceita o certificado da matriz para consultar e manifestar por
  // uma filial, desde que a raiz (8 primeiros dígitos) seja a mesma.
  if (cert.cnpj && cnpj.slice(0, 8) !== cert.cnpj.slice(0, 8)) {
    throw new ErroHttp(500, `SEFAZ_CNPJ (${cnpj}) não é da mesma empresa do certificado (${cert.cnpj}): a raiz do CNPJ precisa ser igual. Use o certificado A1 desse CNPJ.`);
  }
  return {
    cert,
    ambiente,
    tpAmb: ambiente === "producao" ? 1 : 2,
    cnpj,
    cUFAutor: process.env.SEFAZ_UF_AUTOR || "28",
    urls: URLS[ambiente],
  };
}

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) throw new ErroHttp(500, "SUPABASE_SERVICE_ROLE_KEY (e a URL do Supabase) não configurados no servidor.");
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Mesmo critério do e_gestor() do banco: sócio master ou assistente administrativo, com a conta liberada. */
async function autorizar(req, admin) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const segredo = process.env.CRON_SECRET;
  if (segredo && token.length === segredo.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(segredo))) {
    return { cron: true };
  }
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  const { data: perfil } = await admin.from("perfis").select("papel, ativo").eq("id", data.user.id).maybeSingle();
  if (!perfil?.ativo || !["socio_master", "assistente_administrativo"].includes(perfil.papel)) return null;
  return { usuario: data.user.id };
}

// ─── Conversa com a SEFAZ ───────────────────────────────────────────────────

/**
 * Conexão com o certificado da empresa (TLS mútuo). Os servidores da SEFAZ
 * usam certificado da cadeia ICP-Brasil, que não vem na lista de
 * autoridades do Node. Com SEFAZ_CA_PEM (as raízes/intermediárias ICP-Brasil
 * em PEM) o servidor é conferido de verdade; sem ela, a conexão segue sem
 * conferir o servidor — como fazem as bibliotecas de NF-e em geral. O risco
 * que sobra é alguém no meio do caminho forjar respostas; ele não consegue se
 * passar pela empresa junto à SEFAZ, porque não tem a chave do certificado.
 */
function agente(cert) {
  const ca = process.env.SEFAZ_CA_PEM;
  return new https.Agent({
    key: cert.keyPem,
    cert: cert.certPem,
    ...(ca ? { ca: [...tls.rootCertificates, ca], rejectUnauthorized: true } : { rejectUnauthorized: false }),
    keepAlive: true,
  });
}

let agenteCache = null;
function postarSoap(url, xml, acao, cert) {
  agenteCache ??= agente(cert);
  return new Promise((ok, falha) => {
    const req = https.request(url, {
      method: "POST",
      agent: agenteCache,
      timeout: 25000,
      headers: {
        "Content-Type": `application/soap+xml; charset=utf-8; action="${acao}"`,
        "Content-Length": Buffer.byteLength(xml, "utf8"),
      },
    }, (res) => {
      const partes = [];
      res.on("data", (p) => partes.push(p));
      res.on("end", () => {
        const corpo = Buffer.concat(partes).toString("utf8");
        if (res.statusCode >= 400 && !corpo.includes("<")) {
          falha(new ErroHttp(502, `A SEFAZ respondeu HTTP ${res.statusCode}: ${corpo.slice(0, 300)}`));
        } else {
          ok(corpo);
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("a SEFAZ não respondeu em 25 segundos")));
    req.on("error", (e) => falha(new ErroHttp(502, `Falha ao falar com a SEFAZ: ${e.message}`)));
    req.end(xml);
  });
}

async function distribuicao(cfg, consulta) {
  const xml = montarDistribuicao({ tpAmb: cfg.tpAmb, cUFAutor: cfg.cUFAutor, cnpj: cfg.cnpj, ...consulta });
  const resposta = await postarSoap(cfg.urls.distribuicao, xml, ACAO_DISTRIBUICAO, cfg.cert);
  try {
    return lerDistribuicao(resposta);
  } catch (e) {
    throw new ErroHttp(502, e.message);
  }
}

// ─── Banco ──────────────────────────────────────────────────────────────────

async function lerEstado(admin) {
  const { data, error } = await admin.from("sefaz_dfe_estado").select("*").eq("id", 1).maybeSingle();
  if (error) throw new ErroHttp(500, `Não deu para ler sefaz_dfe_estado — rodou a migração 30? (${error.message})`);
  return data;
}

async function gravarEstado(admin, campos) {
  const { error } = await admin.from("sefaz_dfe_estado").update({ ...campos, atualizado_em: new Date().toISOString() }).eq("id", 1);
  if (error) throw new ErroHttp(500, `Não deu para gravar sefaz_dfe_estado: ${error.message}`);
}

/**
 * Grava os documentos de um lote. Lê o que já existe dessas chaves, aplica
 * os documentos na ordem do NSU (resumo → nota completa → eventos) e grava
 * de uma vez. Evento de nota que nunca chegou é ignorado.
 */
async function gravarDocumentos(admin, cfg, docs) {
  const lidos = docs.map(lerDocumento).filter(Boolean);
  const chaves = [...new Set(lidos.map((l) => (l.nota ?? l.evento).chave).filter((c) => /^\d{44}$/.test(c)))];
  if (!chaves.length) return 0;

  const { data: existentes, error } = await admin.from("nfe_recebidas").select(COLUNAS.join(",")).in("chave", chaves);
  if (error) throw new ErroHttp(500, `Não deu para ler nfe_recebidas: ${error.message}`);
  const porChave = new Map(existentes.map((n) => [n.chave, n]));
  const mudadas = new Map();
  const xmls = new Map();

  for (const l of lidos) {
    if (l.tipo === "nota") {
      if (!/^\d{44}$/.test(l.nota.chave)) continue;
      const { xml, ...campos } = l.nota;
      const junta = juntarNota(porChave.get(l.nota.chave), { ...campos, ambiente: cfg.ambiente });
      porChave.set(junta.chave, junta);
      mudadas.set(junta.chave, junta);
      if (xml) xmls.set(junta.chave, xml);
    } else {
      const nova = aplicarEvento(porChave.get(l.evento.chave), l.evento, cfg.cnpj);
      if (nova) {
        porChave.set(nova.chave, nova);
        mudadas.set(nova.chave, nova);
      }
    }
  }

  const linha = (n) => Object.fromEntries(COLUNAS.map((c) => [c, n[c] ?? null]));
  const comXml = [...mudadas.values()].filter((n) => xmls.has(n.chave)).map((n) => ({ ...linha(n), xml: xmls.get(n.chave) }));
  const semXml = [...mudadas.values()].filter((n) => !xmls.has(n.chave)).map(linha);
  // Dois lotes porque o upsert grava todas as colunas enviadas: mandar
  // `xml: null` numa nota já completa apagaria o XML dela.
  for (const lote of [comXml, semXml]) {
    if (!lote.length) continue;
    const { error: erroGravar } = await admin.from("nfe_recebidas").upsert(lote, { onConflict: "chave" });
    if (erroGravar) throw new ErroHttp(500, `Não deu para gravar nfe_recebidas: ${erroGravar.message}`);
  }
  return mudadas.size;
}

// ─── Ações ──────────────────────────────────────────────────────────────────

async function sincronizar(admin, cfg) {
  const inicio = Date.now();
  let estado = await lerEstado(admin);
  if (!estado) throw new ErroHttp(500, "sefaz_dfe_estado está vazia — rode a migração 30 de novo.");

  // Trocou de CNPJ ou de ambiente: a numeração de NSU é outra, começa do zero.
  if (estado.cnpj !== cfg.cnpj || estado.ambiente !== cfg.ambiente) {
    await gravarEstado(admin, { cnpj: cfg.cnpj, ambiente: cfg.ambiente, ult_nsu: 0, max_nsu: 0, proxima_consulta_em: null });
    estado = await lerEstado(admin);
  }
  if (estado.proxima_consulta_em && new Date(estado.proxima_consulta_em) > new Date()) {
    return { pedida: false, liberaEm: estado.proxima_consulta_em, novas: 0 };
  }

  // Trava contra duas buscas ao mesmo tempo (dois aparelhos + o cron), que
  // pediriam o mesmo NSU duas vezes e cairiam no bloqueio da SEFAZ.
  const agora = new Date();
  const { data: pegou } = await admin.from("sefaz_dfe_estado")
    .update({ em_andamento_ate: new Date(agora.getTime() + 90 * 1000).toISOString() })
    .eq("id", 1)
    .or(`em_andamento_ate.is.null,em_andamento_ate.lt."${agora.toISOString()}"`)
    .select("id");
  if (!pegou?.length) return { pedida: false, emAndamento: true, novas: 0 };

  let ultNSU = Number(estado.ult_nsu) || 0;
  let novas = 0;
  const fim = { em_andamento_ate: null, cert_titular: cfg.cert.titular, cert_valido_ate: cfg.cert.validoAte };
  try {
    // Até 10 lotes de 50 por chamada, dentro do tempo da função; o resto
    // vem na próxima busca, a partir do NSU gravado.
    for (let lote = 0; lote < 10 && Date.now() - inicio < 40000; lote++) {
      const r = await distribuicao(cfg, { ultNSU });
      const quando = new Date().toISOString();
      if (r.cStat === "138") {
        novas += await gravarDocumentos(admin, cfg, r.docs);
        ultNSU = Number(r.ultNSU) || ultNSU;
        const acabou = ultNSU >= Number(r.maxNSU);
        await gravarEstado(admin, {
          ult_nsu: ultNSU, max_nsu: Number(r.maxNSU) || 0, ultima_consulta_em: quando,
          ultimo_cstat: r.cStat, ultima_mensagem: r.xMotivo,
          ...(acabou ? { proxima_consulta_em: new Date(Date.now() + UMA_HORA).toISOString() } : {}),
        });
        if (acabou) break;
      } else if (r.cStat === "137" || r.cStat === "656") {
        // 137: nada novo. 656: consultou cedo demais. Nos dois casos a SEFAZ
        // pede uma hora de espera, e às vezes devolve o NSU certo para seguir.
        await gravarEstado(admin, {
          ...(r.ultNSU ? { ult_nsu: Number(r.ultNSU) } : {}),
          ...(r.maxNSU ? { max_nsu: Number(r.maxNSU) } : {}),
          ultima_consulta_em: quando, ultimo_cstat: r.cStat, ultima_mensagem: r.xMotivo,
          proxima_consulta_em: new Date(Date.now() + UMA_HORA).toISOString(),
        });
        break;
      } else {
        await gravarEstado(admin, { ultima_consulta_em: quando, ultimo_cstat: r.cStat, ultima_mensagem: r.xMotivo });
        throw new ErroHttp(502, `A SEFAZ recusou a consulta (${r.cStat}): ${r.xMotivo}`);
      }
    }
  } finally {
    await gravarEstado(admin, fim).catch(() => {});
  }
  const depois = await lerEstado(admin);
  return { pedida: true, novas, liberaEm: depois?.proxima_consulta_em ?? null };
}

async function consultarChave(admin, cfg, chave) {
  const r = await distribuicao(cfg, { chave });
  if (r.cStat === "656") {
    await gravarEstado(admin, { proxima_consulta_em: new Date(Date.now() + UMA_HORA).toISOString(), ultimo_cstat: r.cStat, ultima_mensagem: r.xMotivo });
  }
  if (r.cStat !== "138") return { encontrada: false, cStat: r.cStat, motivo: r.xMotivo };
  await gravarDocumentos(admin, cfg, r.docs);
  const completa = r.docs.some((d) => d.schema.startsWith("procNFe"));
  return { encontrada: true, completa, cStat: r.cStat, motivo: r.xMotivo };
}

async function manifestar(admin, cfg, { chave, manifestacao, justificativa }) {
  const tipo = MANIFESTACOES[manifestacao];
  if (!tipo) throw new ErroHttp(400, `Manifestação desconhecida: ${manifestacao}`);
  const just = limparJustificativa(justificativa);
  if (tipo.justificativa && (just.length < 15 || just.length > 255)) {
    throw new ErroHttp(400, "A justificativa precisa ter de 15 a 255 caracteres.");
  }

  const { data: nota, error } = await admin.from("nfe_recebidas").select("chave, manifestacao").eq("chave", chave).maybeSingle();
  if (error) throw new ErroHttp(500, error.message);
  if (!nota) throw new ErroHttp(404, "Nota não encontrada — atualize a lista.");

  const xml = montarManifestacao({
    tpAmb: cfg.tpAmb, cnpj: cfg.cnpj, chave, manifestacao, justificativa: just, cert: cfg.cert,
    // Uns segundos para trás: a SEFAZ recusa evento com hora no futuro, e o
    // relógio dela pode estar um pouco atrás do nosso.
    dhEvento: dataHoraBrasilia(new Date(Date.now() - 30 * 1000)),
    idLote: String(Date.now()).slice(-15),
  });
  let ret;
  try {
    ret = lerRetornoEvento(await postarSoap(cfg.urls.evento, xml, ACAO_EVENTO, cfg.cert));
  } catch (e) {
    throw e instanceof ErroHttp ? e : new ErroHttp(502, e.message);
  }
  if (ret.cStatLote !== "128") throw new ErroHttp(422, `A SEFAZ recusou o envio (${ret.cStatLote}): ${ret.xMotivoLote}`);
  // 135/136: registrado. 573: essa manifestação já tinha sido feita.
  if (!["135", "136", "573"].includes(ret.cStat)) throw new ErroHttp(422, `A SEFAZ recusou (${ret.cStat}): ${ret.xMotivo}`);

  const final = manifestacaoMaisForte(nota.manifestacao, manifestacao);
  const agora = new Date().toISOString();
  const { error: erroGravar } = await admin.from("nfe_recebidas").update({
    manifestacao: final,
    manifestada_em: ret.dhRegEvento || agora,
    ...(ret.nProt ? { manifestacao_protocolo: ret.nProt } : {}),
    ...(tipo.justificativa ? { justificativa: just } : {}),
  }).eq("chave", chave);
  if (erroGravar) throw new ErroHttp(500, `Manifestado na SEFAZ, mas não deu para gravar: ${erroGravar.message}`);
  return { manifestacao: final, protocolo: ret.nProt, cStat: ret.cStat, motivo: ret.xMotivo, data: ret.dhRegEvento || agora };
}

// Exportadas só para os testes; a rota é o handler abaixo.
export { config as configSefaz, consultarChave, manifestar, sincronizar };

// ─── Handler ────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  try {
    const acao = req.method === "GET" ? req.query?.acao : req.body?.acao;
    if (!["GET", "POST"].includes(req.method) || (req.method === "GET" && acao !== "sincronizar")) {
      throw new ErroHttp(405, "Método não permitido");
    }
    const admin = supabaseAdmin();
    const quem = await autorizar(req, admin);
    if (!quem || (req.method === "GET" && !quem.cron)) throw new ErroHttp(401, "Entre no app com uma conta de gestão.");

    if (acao === "status") {
      const cfg = config();
      res.status(200).json({
        ambiente: cfg.ambiente, cnpj: cfg.cnpj, titular: cfg.cert.titular, validoAte: cfg.cert.validoAte,
      });
      return;
    }

    const cfg = config();
    if (acao === "sincronizar") {
      res.status(200).json(await sincronizar(admin, cfg));
    } else if (acao === "consultar-chave" || acao === "manifestar") {
      const chave = String(req.body?.chave ?? "");
      if (!/^\d{44}$/.test(chave)) throw new ErroHttp(400, "Chave de acesso inválida.");
      res.status(200).json(acao === "manifestar"
        ? await manifestar(admin, cfg, { ...req.body, chave })
        : await consultarChave(admin, cfg, chave));
    } else {
      throw new ErroHttp(400, `Ação desconhecida: ${acao}`);
    }
  } catch (erro) {
    res.status(erro.status || 500).json({ erro: erro.message });
  }
}

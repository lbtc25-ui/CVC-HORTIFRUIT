/**
 * Reúne as NF-e de um mês para a escrituração: as emitidas pelo app (XML da
 * Spedy), as notas de entrada que o app emitiu (devolução de venda) e as
 * recebidas de terceiros (XML guardado em nfe_recebidas, vindo da SEFAZ).
 * Devolve os documentos prontos para os geradores, e os avisos do que ficou
 * de fora (nota sem XML, nota que não deu para ler).
 */

import { vencimentoDe } from "../datas.js";
import { numeroDaChave } from "../notas.js";
import { listarNotasRecebidas, obterXmlRecebida } from "../sefaz.js";
import { xmlUrlSpedy } from "../spedy.js";
import { empresaDosXmls, montarDocumentos } from "./escrituracao.js";
import { periodoDoMes } from "./formato.js";

const SEM_NOTAS = [];

/**
 * Toda venda que chegou a ter nota (ou tentativa de nota) — menos as só
 * "consolidadas" na nota de outro pedido —, mais as notas de pedidos
 * apagados (nfe_arquivadas). A mesma nota recuperada por dois aparelhos
 * conta uma vez. Mais recentes primeiro. É a relação da aba Emitidas.
 */
export function notasEmitidasDoApp(dados) {
  const idsVendas = new Set(dados.vendas.map((v) => v.id));
  const spedyDasVendas = new Set(dados.vendas.map((v) => v.spedyId).filter(Boolean));
  const vistas = new Set();
  const arquivadas = (dados.nfe_arquivadas ?? SEM_NOTAS)
    .filter((n) => !idsVendas.has(n.id) && !(n.spedyId && spedyDasVendas.has(n.spedyId)))
    .filter((n) => !n.spedyId || (!vistas.has(n.spedyId) && vistas.add(n.spedyId)))
    .map((n) => ({ ...n, pedidoApagado: true }));
  return [...dados.vendas, ...arquivadas]
    .filter((v) => v.nfeStatus && v.nfeStatus !== "nao_emitida" && v.nfeStatus !== "consolidada")
    .sort((a, b) => String(b.nfeEmitidaEm || b.data).localeCompare(String(a.nfeEmitidaEm || a.data))
      || (b.nfeNumero ?? 0) - (a.nfeNumero ?? 0));
}

/** O dia de Aracaju (UTC−3, sem horário de verão) de um instante ISO; data pura passa direto. */
export const diaLocal = (iso) => {
  const s = String(iso ?? "");
  if (s.length <= 10) return s;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t - 3 * 3600_000).toISOString().slice(0, 10) : s.slice(0, 10);
};

/** Roda `fn` sobre a lista, `lote` por vez. */
async function emLotes(lista, lote, fn) {
  for (let i = 0; i < lista.length; i += lote) {
    await Promise.all(lista.slice(i, i + lote).map(fn));
  }
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// XMLs já baixados nesta sessão: gerar os três arquivos, ou tentar de novo
// depois de uma falha, só baixa o que ainda falta.
const xmlsBaixados = new Map();

/**
 * O XML da nota na Spedy. Ela limita as requisições (HTTP 429): nesse caso
 * espera — o tempo do Retry-After, ou 2, 4, 8... segundos — e tenta de novo.
 */
async function xmlDaSpedy(spedyId) {
  if (xmlsBaixados.has(spedyId)) return xmlsBaixados.get(spedyId);
  for (let tentativa = 1; ; tentativa++) {
    const resp = await fetch(xmlUrlSpedy(spedyId));
    if (resp.ok) {
      const xml = await resp.text();
      xmlsBaixados.set(spedyId, xml);
      return xml;
    }
    if (resp.status !== 429 || tentativa >= 6) throw new Error(`HTTP ${resp.status}`);
    const aviso = Number(resp.headers.get("retry-after"));
    await esperar((Number.isFinite(aviso) && aviso > 0 ? Math.min(aviso, 30) : 2 ** tentativa) * 1000);
  }
}

const STATUS_SPEDY = { autorizada: "autorizada", cancelada: "cancelada" };

/**
 * @param {{ dados: object, mes: string, aoProgredir?: (p: {feito:number,total:number}) => void }} p
 * @returns {Promise<{ documentos: Array, empresa: object, avisos: string[], periodo: object }>}
 */
export async function coletarDocumentosDoMes({ dados, mes, aoProgredir }) {
  const periodo = periodoDoMes(mes);
  const de = vencimentoDe(periodo.inicio, -1);
  const ate = vencimentoDe(periodo.fim, 1);
  const naJanela = (dia) => dia >= de && dia <= ate;
  const avisos = [];

  // Fila de tudo que precisa de XML: { rotulo, situacao, baixar, stub }.
  const fila = [];
  const adicionar = (item) => fila.push(item);

  for (const v of notasEmitidasDoApp(dados)) {
    const situacao = STATUS_SPEDY[v.nfeStatus];
    const dia = diaLocal(v.nfeEmitidaEm || v.data);
    if (!situacao || !naJanela(dia)) continue;
    adicionar({
      rotulo: `NF ${v.nfeNumero ?? "?"}`, situacao, origem: "emitida",
      baixar: v.spedyId ? () => xmlDaSpedy(v.spedyId) : null,
      stub: { situacao, chave: v.nfeChave, numero: v.nfeNumero, serie: v.nfeSerie, emissao: dia, emitidaPorNos: true },
    });
  }

  for (const n of dados.notas_entrada ?? SEM_NOTAS) {
    const situacao = STATUS_SPEDY[n.nfeStatus];
    const dia = diaLocal(n.emitidaEm);
    if (n.origem !== "app" || !situacao || !naJanela(dia)) continue;
    adicionar({
      rotulo: `NF de entrada ${n.numero ?? "?"}`, situacao, origem: "entrada",
      baixar: n.spedyId ? () => xmlDaSpedy(n.spedyId) : null,
      stub: { situacao, chave: n.chave, numero: n.numero, serie: n.serie, emissao: dia, emitidaPorNos: true },
    });
  }

  const recebidas = await listarNotasRecebidas({ initialDate: periodo.inicio, endDate: periodo.fim });
  for (const n of recebidas) {
    const m = n.manifestation?.status;
    if (m === "unknown" || m === "notPerformed") continue; // não reconhecida: não se escritura
    const { numero, serie } = numeroDaChave(n.accessKey);
    const situacao = n.status === "canceled" ? "cancelada" : n.status === "denied" ? "denegada" : "autorizada";
    adicionar({
      rotulo: `NF recebida ${numero ?? n.accessKey}`, situacao, origem: "recebida",
      baixar: n.isComplete && situacao === "autorizada" ? () => obterXmlRecebida(n.accessKey) : null,
      stub: { situacao, chave: n.accessKey, numero, serie, emissao: diaLocal(n.issuedOn), emitidaPorNos: false },
    });
  }

  const notas = [];
  let feito = 0;
  aoProgredir?.({ feito, total: fila.length });
  // Um por vez: a Spedy recusa (429) quando se pede vários ao mesmo tempo.
  await emLotes(fila, 1, async (item) => {
    let xml = null;
    if (item.baixar) {
      try {
        xml = await item.baixar();
        if (!xml) throw new Error("vazio");
      } catch (e) {
        avisos.push(`${item.rotulo}: não consegui baixar o XML (${e.message}).`);
      }
    } else if (item.situacao === "autorizada") {
      avisos.push(`${item.rotulo}: sem XML completo${item.origem === "recebida" ? " — manifeste a nota na aba Recebidas e busque o XML" : ""}; ficou de fora.`);
    }
    // Cancelada sem XML entra só como cancelada; autorizada sem XML não entra.
    if (xml || item.situacao !== "autorizada") notas.push({ ...item.stub, xml });
    aoProgredir?.({ feito: ++feito, total: fila.length });
  });

  const xmls = notas.map((n) => n.xml).filter(Boolean);
  const empresa =
    empresaDosXmls(notas.filter((n) => n.emitidaPorNos && n.xml).map((n) => n.xml), "emitente")
    ?? empresaDosXmls(xmls, "destinatario");
  if (!empresa) throw new Error("Não achei nenhuma nota com XML neste mês para identificar a empresa.");

  const { documentos, avisos: avisosLeitura } = montarDocumentos({ cnpjEmpresa: empresa.cnpj, notas });
  const doMes = documentos.filter((d) => d.emissao >= periodo.inicio && d.emissao <= periodo.fim);
  return { documentos: doMes, empresa, avisos: [...avisos, ...avisosLeitura], periodo };
}

/**
 * Arquivo morto trimestral — Etapa 1: GERAR o arquivo, sem apagar nada.
 *
 * A cada trimestre o sócio master salva numa pasta (do Drive local) os
 * arquivos pesados do período: comprovantes, fotos dos promotores e XMLs das
 * notas fiscais, mais as planilhas de horário de promotores e motoristas. Os
 * números (vendas, compras, despesas, horários) ficam no banco; isto aqui só
 * LÊ — nenhuma linha e nenhum arquivo é alterado ou removido.
 *
 *   Primeiro Trimestre 2026/
 *     Comprovantes/<Tipo>/<AAAA-MM>/…
 *     Fotos-Promotores/<promotor>/<AAAA-MM-DD>/<loja>/…
 *     Notas-Fiscais/Emitidas|Recebidas/<AAAA-MM>/…
 *     Horarios/horarios-promotores.csv, horarios-motoristas.csv
 *     indice.csv (cada arquivo, tamanho e SHA-256)   LEIA-ME.txt
 *
 * Duas formas de entregar: direto numa pasta (File System Access, Chrome/Edge
 * no computador) ou em ZIPs de ~150 MB (qualquer navegador).
 */

import {
  caminhoUnico, extensaoDe, horaLocal, noPeriodo, nomeSeguro, paraCsv,
} from "./arquivoMortoBase";

export { gerarArquivo } from "./arquivoMortoBase";
import { supabase } from "./supabase";
import { xmlUrlSpedy } from "./spedy";

const BUCKET_COMPROVANTES = "despesas-comprovantes";
const BUCKET_FOTOS = "promotores-fotos";
const PAGINA = 1000;

/** Tamanho máximo de cada ZIP no modo de download (cabe na memória do navegador). */
const TAMANHO_PARTE = 150 * 1024 * 1024;

// ─── Leitura no banco ───────────────────────────────────────────────────────

/** Lê uma consulta em páginas (o servidor corta cada resposta em «Max rows»). */
async function lerPaginado(montar) {
  const linhas = [];
  for (;;) {
    const { data, error, count } = await montar().range(linhas.length, linhas.length + PAGINA - 1);
    if (error) throw error;
    linhas.push(...data);
    if (data.length === 0 || linhas.length >= count) return linhas;
  }
}

async function listarPasta(bucket, pasta) {
  const arquivos = [];
  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(pasta, {
      limit: PAGINA, offset: arquivos.length, sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    arquivos.push(...data.filter((f) => f.name && !f.name.startsWith(".") && f.id));
    if (data.length < PAGINA) return arquivos;
  }
}

async function baixarDoBucket(bucket, caminho) {
  const { data, error } = await supabase.storage.from(bucket).download(caminho);
  if (error) throw error;
  return data;
}

// ─── Plano: o que entra no arquivo ──────────────────────────────────────────

const TIPOS_COMPROVANTE = [
  { chave: "despesas", pasta: "Despesas", descricao: (r) => r.descricao || r.categoria },
  { chave: "compras", pasta: "Compras", descricao: (r) => r.fruta || r.observacao },
  { chave: "abastecimentos", pasta: "Combustivel", descricao: (r) => r.tipoCombustivel || r.motorista },
  { chave: "pagamentos", pasta: "Folha", descricao: (r) => r.funcionarioNome || r.descricao },
];

/**
 * Monta a lista de tudo que entra no arquivo do trimestre. Só lê.
 * `dados` é o estado local do app (despesas, compras, vendas, lojas…).
 *
 * Cada item de arquivo: `{ caminho, grupo, origem, obter: () => Promise<Blob|string> }`.
 * Devolve também as planilhas (já prontas, pequenas) e avisos do que não deu para listar.
 */
export async function planejar({ dados, tri, aoProgredir }) {
  const usados = new Set();
  const arquivos = [];
  const avisos = [];
  const novo = (caminho, grupo, origem, obter) => {
    arquivos.push({ caminho: caminhoUnico(caminho, usados), grupo, origem, obter });
  };
  const etapa = (texto) => aoProgredir?.(texto);

  // Comprovantes ligados a lançamentos.
  etapa("Comprovantes dos lançamentos…");
  const comprovantesUsados = new Set();
  for (const tipo of TIPOS_COMPROVANTE) {
    for (const r of dados[tipo.chave] ?? []) {
      if (!r.comprovantePath || !noPeriodo(r.data, tri)) continue;
      comprovantesUsados.add(r.comprovantePath);
      const nome = `${r.data}_${nomeSeguro(tipo.descricao(r), 40)}_${String(r.id).slice(0, 8)}.${extensaoDe(r.comprovantePath, "pdf")}`;
      novo(`Comprovantes/${tipo.pasta}/${r.data.slice(0, 7)}/${nome}`, "Comprovantes",
        { tabela: tipo.chave, id: r.id, data: r.data, bucket: BUCKET_COMPROVANTES, caminhoNoBanco: r.comprovantePath },
        () => baixarDoBucket(BUCKET_COMPROVANTES, r.comprovantePath));
    }
  }

  // Caixa de entrada do Atalho do iPhone: o que chegou no trimestre e não virou lançamento.
  try {
    for (const f of await listarPasta(BUCKET_COMPROVANTES, "caixa")) {
      const caminho = `caixa/${f.name}`;
      if (comprovantesUsados.has(caminho) || !noPeriodo(f.created_at, tri)) continue;
      novo(`Comprovantes/Caixa-sem-lancamento/${String(f.created_at).slice(0, 7)}/${nomeSeguro(f.name, 80)}`, "Comprovantes",
        { tabela: "caixa", id: f.name, data: String(f.created_at).slice(0, 10), bucket: BUCKET_COMPROVANTES, caminhoNoBanco: caminho },
        () => baixarDoBucket(BUCKET_COMPROVANTES, caminho));
    }
  } catch (e) {
    avisos.push(`Caixa de comprovantes não foi listada: ${e.message ?? e}`);
  }

  // Rotas dos promotores: fotos e planilha de horários.
  etapa("Rotas e fotos dos promotores…");
  const linhasPromotores = [];
  try {
    const [rotas, perfis] = await Promise.all([
      lerPaginado(() => supabase.from("rotas_promotor").select("*, paradas_rota(*)", { count: "exact" })
        .gte("data", tri.inicio).lte("data", tri.fim).order("data").order("id")),
      lerPaginado(() => supabase.from("perfis").select("id, nome", { count: "exact" }).order("id")),
    ]);
    const nomePromotor = new Map(perfis.map((p) => [p.id, p.nome]));
    for (const rota of rotas) {
      const promotor = nomePromotor.get(rota.promotor_id) || rota.nome || "Promotor";
      const paradas = [...(rota.paradas_rota ?? [])].sort((a, b) => a.ordem - b.ordem);
      for (const p of paradas) {
        linhasPromotores.push([
          rota.data, promotor, rota.nome, rota.status, horaLocal(rota.iniciada_em), horaLocal(rota.concluida_em),
          p.ordem, p.estabelecimento, p.endereco ?? "", p.status, horaLocal(p.chegada_em), horaLocal(p.concluida_em),
          p.chegada_lat ?? "", p.chegada_lng ?? "", p.observacao ?? "",
          [p.foto_chegada_url, p.foto_antes_url, p.foto_depois_url].filter(Boolean).length,
        ]);
        for (const [tipo, caminho] of [["chegada", p.foto_chegada_url], ["antes", p.foto_antes_url], ["depois", p.foto_depois_url]]) {
          if (!caminho) continue;
          const pasta = `Fotos-Promotores/${nomeSeguro(promotor)}/${rota.data}/${String(p.ordem).padStart(2, "0")}-${nomeSeguro(p.estabelecimento, 40)}`;
          novo(`${pasta}/${tipo}.${extensaoDe(caminho, "jpg")}`, "Fotos dos promotores",
            { tabela: "paradas_rota", id: p.id, data: rota.data, bucket: BUCKET_FOTOS, caminhoNoBanco: caminho },
            () => baixarDoBucket(BUCKET_FOTOS, caminho));
        }
      }
    }
  } catch (e) {
    avisos.push(`Rotas dos promotores não foram lidas: ${e.message ?? e}`);
  }

  // Entregas dos motoristas: só planilha (os horários estão nos pedidos).
  etapa("Horários dos motoristas…");
  const lojas = new Map((dados.lojas ?? []).map((l) => [l.id, l.nome]));
  const veiculos = new Map((dados.veiculos ?? []).map((v) => [v.id, `${v.nome}${v.placa ? ` (${v.placa})` : ""}`]));
  const linhasMotoristas = (dados.vendas ?? [])
    .filter((v) => (v.saidaCdEm || v.entregueEm) && noPeriodo(v.rotaData || v.data, tri))
    .sort((a, b) => String(a.rotaData || a.data).localeCompare(String(b.rotaData || b.data)) || (a.ordemRota ?? 0) - (b.ordemRota ?? 0))
    .map((v) => [
      v.rotaData || v.data, v.motoristaNome || "", veiculos.get(v.veiculoId) || "", v.viagemRota ?? 1, v.ordemRota ?? "",
      v.numero, lojas.get(v.lojaId) || "", v.statusEntrega, horaLocal(v.saidaCdEm), horaLocal(v.entregueEm),
    ]);

  // NF-e emitidas (XML guardado na Spedy; aqui só baixa a cópia).
  etapa("Notas fiscais emitidas…");
  const emitidas = [...(dados.vendas ?? []), ...(dados.nfe_arquivadas ?? [])]
    .filter((v) => v.spedyId && ["autorizada", "cancelada"].includes(v.nfeStatus) && noPeriodo(v.nfeEmitidaEm || v.data, tri));
  for (const v of emitidas) {
    const mes = String(v.nfeEmitidaEm || v.data).slice(0, 7);
    novo(`Notas-Fiscais/Emitidas/${mes}/NF-${String(v.nfeNumero ?? "s-n").padStart(6, "0")}${v.nfeStatus === "cancelada" ? "-CANCELADA" : ""}-${v.nfeChave || String(v.spedyId).slice(0, 8)}.xml`,
      "Notas fiscais", { tabela: "vendas", id: v.id, data: String(v.nfeEmitidaEm || v.data).slice(0, 10), spedyId: v.spedyId },
      async () => {
        const resp = await fetch(xmlUrlSpedy(v.spedyId));
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return resp.text();
      });
  }

  // NF-e recebidas da SEFAZ (XML no banco).
  etapa("Notas fiscais recebidas…");
  try {
    const recebidas = await lerPaginado(() => supabase.from("nfe_recebidas")
      .select("chave, numero, emitente_nome, emitida_em", { count: "exact" })
      .not("xml", "is", null)
      .gte("emitida_em", `${tri.inicio}T00:00:00-03:00`).lte("emitida_em", `${tri.fim}T23:59:59-03:00`).order("chave"));
    for (const n of recebidas) {
      novo(`Notas-Fiscais/Recebidas/${String(n.emitida_em).slice(0, 7)}/${nomeSeguro(n.emitente_nome, 30)}-NF-${n.numero ?? "s-n"}-${n.chave}.xml`,
        "Notas fiscais", { tabela: "nfe_recebidas", id: n.chave, data: String(n.emitida_em).slice(0, 10) },
        async () => {
          const { data, error } = await supabase.from("nfe_recebidas").select("xml").eq("chave", n.chave).maybeSingle();
          if (error) throw error;
          if (!data?.xml) throw new Error("XML vazio");
          return data.xml;
        });
    }
  } catch (e) {
    avisos.push(`Notas recebidas da SEFAZ não foram lidas: ${e.message ?? e}`);
  }

  const planilhas = [
    {
      caminho: "Horarios/horarios-promotores.csv", grupo: "Planilhas",
      conteudo: paraCsv(["Data da rota", "Promotor", "Rota", "Status da rota", "Início da rota", "Fim da rota", "Ordem", "Loja", "Endereço",
        "Status da parada", "Chegada", "Conclusão", "Latitude", "Longitude", "Observação", "Fotos"], linhasPromotores),
      linhas: linhasPromotores.length,
    },
    {
      caminho: "Horarios/horarios-motoristas.csv", grupo: "Planilhas",
      conteudo: paraCsv(["Data da rota", "Motorista", "Veículo", "Viagem", "Ordem", "Pedido", "Loja", "Status", "Saída do CD", "Entregue em"], linhasMotoristas),
      linhas: linhasMotoristas.length,
    },
  ];

  return { arquivos, planilhas, avisos };
}

/** Contagem por grupo, para a tela mostrar antes de baixar. */
export function resumirPlano({ arquivos, planilhas }) {
  const porGrupo = {};
  for (const a of arquivos) porGrupo[a.grupo] = (porGrupo[a.grupo] ?? 0) + 1;
  return { porGrupo, planilhas: planilhas.map((p) => ({ caminho: p.caminho, linhas: p.linhas })), total: arquivos.length };
}

// ─── Destinos ───────────────────────────────────────────────────────────────

export const podeGravarEmPasta = () => typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";

/** Pede ao usuário a pasta (a do Drive) e devolve um destino que grava direto nela. */
export async function destinoPasta() {
  const raiz = await window.showDirectoryPicker({ mode: "readwrite" });
  const cacheDirs = new Map();
  const pasta = async (partes) => {
    let atual = raiz;
    let chave = "";
    for (const parte of partes) {
      chave += `/${parte}`;
      if (!cacheDirs.has(chave)) cacheDirs.set(chave, await atual.getDirectoryHandle(parte, { create: true }));
      atual = cacheDirs.get(chave);
    }
    return atual;
  };
  return {
    nomePasta: raiz.name,
    async gravar(caminho, blob, tamanho) {
      const partes = caminho.split("/");
      const nome = partes.pop();
      const dir = await pasta(partes);
      const handle = await dir.getFileHandle(nome, { create: true });
      const escrita = await handle.createWritable();
      await escrita.write(blob);
      await escrita.close();
      // Confere no disco: o arquivo gravado tem que ter o tamanho que baixou.
      const gravado = await handle.getFile();
      if (gravado.size !== tamanho) throw new Error(`gravou ${gravado.size} bytes de ${tamanho}`);
    },
    async fechar() {},
  };
}

/** Destino em ZIPs: junta arquivos até ~150 MB, baixa o ZIP e segue para o próximo. */
export function destinoZip({ nomeBase, aoFecharParte }) {
  let zip = null;
  let tamanhoAtual = 0;
  let parte = 0;
  let JSZip = null;

  const baixar = async () => {
    if (!zip || tamanhoAtual === 0) return;
    parte += 1;
    const blob = await zip.generateAsync({ type: "blob", compression: "STORE" }); // fotos e PDFs já são comprimidos
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${nomeBase} - parte ${String(parte).padStart(2, "0")}.zip`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
    aoFecharParte?.(parte);
    zip = null;
    tamanhoAtual = 0;
    // Dá tempo ao navegador de iniciar o download antes de liberar a memória da próxima parte.
    await new Promise((ok) => setTimeout(ok, 1500));
  };

  return {
    nomePasta: null,
    async gravar(caminho, blob, tamanho) {
      if (!JSZip) JSZip = (await import("jszip")).default;
      if (zip && tamanhoAtual + tamanho > TAMANHO_PARTE) await baixar();
      if (!zip) zip = new JSZip();
      zip.file(caminho, blob);
      tamanhoAtual += tamanho;
    },
    async fechar() {
      await baixar();
    },
  };
}

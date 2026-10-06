/**
 * Parte do arquivo morto que não depende de banco nem de tela (trimestres,
 * nomes de arquivo, CSV e a geração com conferência) — testável no Node.
 */

// ─── Trimestres ─────────────────────────────────────────────────────────────

const ORDINAIS = ["Primeiro", "Segundo", "Terceiro", "Quarto"];

/** `{ ano, n }` (n de 1 a 4) → período e nome da pasta: «Primeiro Trimestre 2026». */
export function trimestre(ano, n) {
  const mesIni = (n - 1) * 3 + 1;
  const mesFim = mesIni + 2;
  const pad = (x) => String(x).padStart(2, "0");
  const ultimoDia = new Date(Date.UTC(ano, mesFim, 0)).getUTCDate();
  return {
    ano,
    n,
    inicio: `${ano}-${pad(mesIni)}-01`,
    fim: `${ano}-${pad(mesFim)}-${pad(ultimoDia)}`,
    nome: `${ORDINAIS[n - 1]} Trimestre ${ano}`,
  };
}

/** O trimestre que contém a data `AAAA-MM-DD`. */
export const trimestreDe = (dataISO) => {
  const [ano, mes] = String(dataISO).split("-").map(Number);
  return trimestre(ano, Math.ceil(mes / 3));
};

/**
 * Trimestres para escolher: os já encerrados (do mais novo ao mais antigo,
 * até 8) e, por último, o em andamento — que a tela avisa estar incompleto.
 */
export function trimestresDisponiveis(hojeISO, quantos = 8) {
  const atual = trimestreDe(hojeISO);
  const lista = [];
  let { ano, n } = atual;
  for (let i = 0; i < quantos; i++) {
    n -= 1;
    if (n === 0) { n = 4; ano -= 1; }
    lista.push({ ...trimestre(ano, n), encerrado: true });
  }
  return [...lista, { ...atual, encerrado: false }];
}

export const noPeriodo = (dataISO, tri) => {
  const dia = String(dataISO ?? "").slice(0, 10);
  return dia >= tri.inicio && dia <= tri.fim;
};

// ─── Nomes de arquivo e CSV ─────────────────────────────────────────────────

/** Nome seguro em qualquer sistema de arquivos (Windows, Drive), sem acento. */
export function nomeSeguro(texto, max = 60) {
  const limpo = String(texto ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\- ]+/g, " ")
    .replace(/\.{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\./, "")
    .slice(0, max)
    .replace(/[. ]+$/, ""); // o Windows não aceita nome terminado em ponto ou espaço
  return limpo || "sem-nome";
}

export const extensaoDe = (caminho, padrao = "bin") => (String(caminho).match(/\.([A-Za-z0-9]{1,5})$/)?.[1] ?? padrao).toLowerCase();

/** Escapa um campo CSV (separador `;`, como o Excel brasileiro espera). */
const campoCsv = (v) => {
  const t = v == null ? "" : String(v);
  return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** Linhas → texto CSV com BOM (o Excel abre os acentos certos). */
export const paraCsv = (cabecalho, linhas) =>
  "\uFEFF" + [cabecalho, ...linhas].map((l) => l.map(campoCsv).join(";")).join("\r\n") + "\r\n";

/** Hora de Aracaju de um instante ISO: «31/03/2026 14:05:09». */
export const horaLocal = (iso) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Maceio", hour12: false }).replace(",", "") : "";

/** Evita dois arquivos no mesmo caminho: o segundo ganha um sufixo. */
export function caminhoUnico(caminho, usados) {
  if (!usados.has(caminho)) { usados.add(caminho); return caminho; }
  const ponto = caminho.lastIndexOf(".");
  const base = ponto > caminho.lastIndexOf("/") ? caminho.slice(0, ponto) : caminho;
  const ext = ponto > caminho.lastIndexOf("/") ? caminho.slice(ponto) : "";
  for (let i = 2; ; i++) {
    const candidato = `${base} (${i})${ext}`;
    if (!usados.has(candidato)) { usados.add(candidato); return candidato; }
  }
}

// ─── Execução: baixar cada arquivo, conferir e entregar ─────────────────────

async function sha256(blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Baixa um item (2 tentativas). Devolve `{ blob, tamanho, sha256 }`. */
async function buscar(item) {
  let ultimoErro;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const bruto = await item.obter();
      const blob = bruto instanceof Blob ? bruto : new Blob([bruto], { type: "application/xml" });
      if (blob.size === 0) throw new Error("arquivo vazio");
      return { blob, tamanho: blob.size, sha256: await sha256(blob) };
    } catch (e) {
      ultimoErro = e;
      await new Promise((ok) => setTimeout(ok, 800));
    }
  }
  throw ultimoErro;
}

const LEIA_ME = (tri, resumo) => `ARQUIVO MORTO — ${tri.nome}
Período: ${tri.inicio} a ${tri.fim}
Gerado em: ${horaLocal(new Date().toISOString())}

Esta pasta guarda os arquivos pesados do trimestre (comprovantes, fotos dos
promotores e XMLs das notas fiscais) e as planilhas de horário de promotores e
motoristas. Os valores (vendas, compras, despesas, folha) continuam no sistema.

  Comprovantes/        PDFs e fotos de pagamento, por tipo e mês
  Fotos-Promotores/    chegada, antes e depois de cada visita
  Notas-Fiscais/       XML das notas emitidas e das recebidas da SEFAZ
  Horarios/            horários de promotores e de motoristas (abre no Excel)
  indice.csv           cada arquivo, com tamanho e código SHA-256 de conferência

Guarde esta pasta em DOIS lugares. O XML fiscal precisa ser guardado por 5 anos.
${resumo}
`;

/**
 * Gera o arquivo do trimestre. `destino` recebe cada arquivo pronto:
 *   destino.gravar(caminho, blob)   chamado na ordem, um por vez
 *   destino.fechar()                chamado no fim
 * Devolve `{ gravados, falhas, indice }` — `falhas` é a lista do que não veio:
 * um arquivo incompleto NÃO deve ser usado para apagar nada do sistema.
 */
export async function gerarArquivo({ plano, tri, destino, aoProgredir, cancelado }) {
  const indice = [];
  const falhas = [];
  const total = plano.arquivos.length;
  let feitos = 0;

  for (const item of plano.arquivos) {
    if (cancelado?.()) break;
    aoProgredir?.({ feitos, total, atual: item.caminho });
    try {
      const { blob, tamanho, sha256: hash } = await buscar(item);
      await destino.gravar(`${tri.nome}/${item.caminho}`, blob, tamanho);
      indice.push([item.caminho, tamanho, hash, item.origem.tabela, item.origem.id, item.origem.data ?? ""]);
    } catch (e) {
      falhas.push(`${item.caminho} — ${e?.message ?? e}`);
    }
    feitos++;
  }
  aoProgredir?.({ feitos, total, atual: "" });

  for (const p of plano.planilhas) {
    const blob = new Blob([p.conteudo], { type: "text/csv;charset=utf-8" });
    await destino.gravar(`${tri.nome}/${p.caminho}`, blob, blob.size);
  }

  const completo = !cancelado?.() && falhas.length === 0;
  const resumo = completo ? `Arquivo COMPLETO: ${indice.length} arquivos.`
    : `ATENÇÃO — arquivo INCOMPLETO: ${falhas.length} arquivo(s) não vieram:\n${falhas.map((f) => `  - ${f}`).join("\n")}`;
  const csv = new Blob([paraCsv(["Caminho", "Tamanho (bytes)", "SHA-256", "Tabela de origem", "ID de origem", "Data"], indice)], { type: "text/csv;charset=utf-8" });
  await destino.gravar(`${tri.nome}/indice.csv`, csv, csv.size);
  const leia = new Blob([LEIA_ME(tri, resumo)], { type: "text/plain;charset=utf-8" });
  await destino.gravar(`${tri.nome}/LEIA-ME.txt`, leia, leia.size);
  await destino.fechar();

  return { gravados: indice.length, falhas, indice, completo };
}

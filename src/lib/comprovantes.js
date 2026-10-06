/**
 * Comprovante de pagamento da despesa — o PDF ou a foto que o banco gera.
 *
 * O arquivo vai para o bucket privado "despesas-comprovantes" (ver
 * supabase/migracao-54-comprovante-despesa.sql) e a despesa guarda só o
 * caminho. Precisa de internet e do Supabase: o resto do lançamento continua
 * funcionando offline, só o anexo não.
 */

import { interpretarComprovante } from "./comprovanteTexto";
import { lerLinhasPdf } from "./pedidoPdf";
import { supabase } from "./supabase";

const BUCKET = "despesas-comprovantes";

/** Lado maior da foto gravada — legível para conferir valor e favorecido, leve no 4G. */
const LADO_MAX = 1800;

export const TIPOS_COMPROVANTE = "application/pdf,image/*";

const ehPdf = (arquivo) => arquivo.type === "application/pdf" || /\.pdf$/i.test(arquivo.name ?? "");

/** Reduz foto grande (câmera de celular) para JPEG; PDF e imagens já pequenas passam direto. */
async function prepararArquivo(arquivo) {
  if (ehPdf(arquivo) || !arquivo.type.startsWith("image/")) return arquivo;
  try {
    const bitmap = await createImageBitmap(arquivo);
    const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
    if (escala === 1 && arquivo.size < 1_500_000) return arquivo;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
    return blob ? new File([blob], arquivo.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : arquivo;
  } catch {
    return arquivo; // formato que o navegador não decodifica: sobe como veio
  }
}

/** Sobe o comprovante e devolve `{ caminho, nome }` para gravar na despesa. */
export async function enviarComprovante(arquivo, despesaId) {
  if (!supabase) throw new Error("Anexar comprovante precisa do Supabase configurado.");
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error("Sem internet agora. Salve a despesa e anexe o comprovante quando voltar o sinal.");
  }
  const pronto = await prepararArquivo(arquivo);
  const extensao = ehPdf(pronto) ? "pdf" : pronto.type === "image/png" ? "png" : "jpg";
  const caminho = `${despesaId}/${Date.now()}.${extensao}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, pronto, { contentType: ehPdf(pronto) ? "application/pdf" : pronto.type || "image/jpeg", upsert: false });
  if (error) throw error;
  return { caminho, nome: arquivo.name || `comprovante.${extensao}` };
}

/** Link temporário (1h) para abrir o comprovante do bucket privado. */
export async function urlDoComprovante(caminho) {
  if (!supabase || !caminho) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 3600);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

// ─── Caixa de entrada (comprovantes que chegam pelo Atalho do iPhone) ───────

/**
 * Arquivos que o Atalho mandou (api/comprovante.js) e a pasta caixa/ guarda.
 * Devolve `[{ caminho, nome, criadoEm, tamanho }]`, o mais novo primeiro. Quem
 * chama tira os que já estão numa despesa (o arquivo continua na pasta).
 */
export async function listarCaixa() {
  if (!supabase) return [];
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list("caixa", { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  if (error) throw error;
  return (data ?? [])
    .filter((f) => f.name && !f.name.startsWith("."))
    .map((f) => ({ caminho: `caixa/${f.name}`, nome: f.name, criadoEm: f.created_at, tamanho: f.metadata?.size ?? 0 }));
}

/** Baixa um comprovante do bucket como File, para o app poder ler o PDF. */
export async function baixarComprovante(caminho, nome) {
  const url = await urlDoComprovante(caminho);
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error("Não foi possível baixar o comprovante.");
  const blob = await resposta.blob();
  return new File([blob], nome, { type: blob.type || (/\.pdf$/i.test(nome) ? "application/pdf" : "image/jpeg") });
}

/** Tira da caixa um comprovante que não vai virar despesa. */
export async function descartarComprovante(caminho) {
  const { error } = await supabase.storage.from(BUCKET).remove([caminho]);
  if (error) throw error;
}

// ─── Leitura do comprovante (PDF com texto, PDF escaneado e foto/print) ─────

export { interpretarComprovante } from "./comprovanteTexto";

/** Endereço completo — o leitor roda num worker e não resolve caminho relativo. */
const aqui = (caminho) => new URL(caminho, window.location.origin).href;

/**
 * Lê o texto de imagens com o tesseract.js (OCR em português). Os arquivos do
 * leitor ficam em /ocr, copiados no build (scripts/copiar-ocr.mjs); são ~5 MB,
 * baixados só na primeira vez que alguém anexa uma imagem, e o navegador guarda.
 */
async function textoDeImagens(imagens) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("por", 1, {
    workerPath: aqui("/ocr/worker.min.js"),
    corePath: aqui("/ocr/tesseract-core-lstm.wasm.js"),
    langPath: aqui("/ocr"),
    gzip: true,
  });
  try {
    const partes = [];
    for (const imagem of imagens) {
      const { data } = await worker.recognize(imagem);
      partes.push(data.text);
    }
    return partes.join("\n");
  } finally {
    await worker.terminate();
  }
}

/** PDF sem camada de texto (escaneado, ou "imprimido como imagem"): desenha as primeiras páginas como imagem. */
async function paginasDoPdfComoImagem(arquivo, maximo = 2) {
  const [pdfjs, { default: workerUrl }] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise;
  const imagens = [];
  for (let n = 1; n <= Math.min(doc.numPages, maximo); n++) {
    const pagina = await doc.getPage(n);
    const viewport = pagina.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await pagina.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
    const blob = await new Promise((ok) => canvas.toBlob(ok, "image/png"));
    if (blob) imagens.push(blob);
  }
  return imagens;
}

/** Texto do PDF pela camada de texto; vazio se não houver. */
async function textoDoPdf(arquivo) {
  try {
    const linhas = await lerLinhasPdf(arquivo);
    return linhas.map((l) => l.palavras?.map((p) => p.s).join(" ") ?? l.texto ?? "").join(" ");
  } catch {
    return "";
  }
}

/**
 * Lê o comprovante e devolve `{ valor, data, favorecido, texto }` — o que deu
 * para entender, mais o texto lido (a tela mostra, para conferir o que o app
 * enxergou). PDF com texto é direto; PDF sem texto e foto/print passam por OCR.
 * Nunca lança: se não leu, o lançamento é à mão como sempre.
 */
export async function lerComprovante(arquivo) {
  const vazio = { valor: null, data: null, favorecido: null, texto: "" };
  try {
    let texto = "";
    if (ehPdf(arquivo)) {
      texto = await textoDoPdf(arquivo);
      if (!texto.trim()) texto = await textoDeImagens(await paginasDoPdfComoImagem(arquivo));
    } else if (arquivo.type.startsWith("image/")) {
      texto = await textoDeImagens([arquivo]);
    }
    return { ...interpretarComprovante(texto), texto };
  } catch {
    return vazio;
  }
}

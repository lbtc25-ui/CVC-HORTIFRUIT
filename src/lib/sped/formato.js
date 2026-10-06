/**
 * Formatação comum dos arquivos fiscais: números, datas e a gravação em
 * ISO-8859-1 (o que o PVA da Receita e o Sintegra esperam).
 */

/** Tira "|" e quebras de linha — num SPED o "|" separa campos. */
export const limpar = (s) => String(s ?? "").replace(/[|\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim();

/** Número no SPED: vírgula decimal, sem milhar. Vazio (null/undefined/"") fica vazio. */
export const dec = (v, casas = 2) =>
  v === null || v === undefined || v === "" || !Number.isFinite(Number(v))
    ? ""
    : (Math.round((Number(v) + Number.EPSILON) * 10 ** casas) / 10 ** casas).toFixed(casas).replace(".", ",");

/** "2026-09-18" → "18092026" */
export const dataSped = (iso) => {
  const [a, m, d] = String(iso ?? "").split("-");
  return a && m && d ? `${d}${m}${a}` : "";
};

/** "2026-09-18" → "20260918" */
export const dataSintegra = (iso) => String(iso ?? "").replace(/-/g, "");

/** "2026-09" → { inicio: "2026-09-01", fim: "2026-09-30" } */
export function periodoDoMes(mes) {
  const [a, m] = String(mes).split("-").map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { inicio: `${a}-${mm}-01`, fim: `${a}-${mm}-${String(ultimo).padStart(2, "0")}` };
}

/** Round-half-up em centavos: evita 0,1 + 0,2 = 0,30000000000000004 nas somas. */
export const arred = (v, casas = 2) => Math.round((Number(v) + Number.EPSILON) * 10 ** casas) / 10 ** casas;

/**
 * O texto do arquivo como bytes ISO-8859-1, com CRLF no fim de cada linha.
 * Caractere fora do Latin-1 vira "?".
 */
export function paraLatin1(linhas) {
  const texto = `${linhas.join("\r\n")}\r\n`;
  const bytes = new Uint8Array(texto.length);
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    bytes[i] = c < 256 ? c : 63;
  }
  return bytes;
}

/** Baixa os bytes como arquivo de texto no navegador. */
export function baixarArquivo(nome, bytes) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([bytes], { type: "text/plain;charset=iso-8859-1" }));
  link.download = nome;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}

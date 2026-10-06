// Copia para public/ocr os arquivos do leitor de texto em imagem (tesseract.js):
// o programa que roda no navegador, o motor (WebAssembly) e o idioma português.
// Assim o app serve tudo do próprio domínio — sem CDN de terceiros e sem
// guardar 5 MB de binários no Git. Roda sozinho antes do `dev` e do `build`.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const destino = join(raiz, "public", "ocr");

const arquivos = [
  ["node_modules/tesseract.js/dist/worker.min.js", "worker.min.js"],
  ["node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js", "tesseract-core-lstm.wasm.js"],
  ["node_modules/@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz", "por.traineddata.gz"],
];

mkdirSync(destino, { recursive: true });
for (const [origem, nome] of arquivos) {
  const de = join(raiz, origem);
  if (!existsSync(de)) {
    console.error(`copiar-ocr: não achei ${origem} — rode "npm install" antes.`);
    process.exit(1);
  }
  copyFileSync(de, join(destino, nome));
}
console.log(`copiar-ocr: ${arquivos.length} arquivos em public/ocr`);

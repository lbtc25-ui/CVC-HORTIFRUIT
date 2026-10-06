// Gera os ícones do PWA a partir da logo da Carvalho Cruz, sem dependências
// externas — só `node:zlib` e PNG cru, lido e escrito à mão.
//
//   entrada: brand/logo-simbolo.png   (a laranja "C" com as folhas, em alta,
//                                      fundo transparente — vem do JPEG mestre
//                                      por scripts/extrair-logo.py)
//   saída:   public/pwa-192x192.png
//            public/pwa-512x512.png
//            public/pwa-maskable-512x512.png
//            public/apple-touch-icon.png
//            public/favicon.svg        (o símbolo embutido, para a aba)
//
// O símbolo é desenhado em laranja e verde-escuro sobre branco. Por isso o
// ícone mantém o fundo claro da marca: sobre verde as folhas sumiriam.
//
// Rode com: npm run icones
import { deflateSync, inflateSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";

const ORIGEM = "brand/logo-simbolo.png";

// Fundo do ícone: o creme da marca, o mesmo `background_color` do manifesto.
const FUNDO = [0xfa, 0xfa, 0xf7];
// Fio dourado da logo, usado como borda fina para o ícone não se perder
// quando o sistema o desenha sobre um fundo branco.
const DOURADO = [0xc2, 0xa3, 0x6b];

// Altura do símbolo dentro do ícone. O maskable é menor porque o Android
// recorta o ícone em círculo/squircle e só garante os 80% centrais.
const ALTURA_SIMBOLO = 0.7;
const ALTURA_SIMBOLO_MASKABLE = 0.54;

// ─── PNG: escrita ───────────────────────────────────────────────────────────
const TABELA_CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = TABELA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function chunk(tipo, dados) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, "ascii"), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([len, corpo, crc]);
}

const ASSINATURA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function png(largura, altura, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  const linhas = Buffer.alloc(altura * (1 + largura * 4));
  for (let y = 0; y < altura; y++) {
    const destino = y * (1 + largura * 4);
    linhas[destino] = 0; // filtro "none"
    rgba.copy(linhas, destino + 1, y * largura * 4, (y + 1) * largura * 4);
  }
  return Buffer.concat([
    ASSINATURA,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(linhas, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ─── PNG: leitura ───────────────────────────────────────────────────────────
//
// Decodificador mínimo: 8 bits por canal, RGB ou RGBA, sem entrelace — que é
// exatamente o que `extrair-logo.py` grava. Qualquer outra coisa é erro.

function lerPng(caminho) {
  const buf = readFileSync(caminho);
  if (!buf.subarray(0, 8).equals(ASSINATURA)) throw new Error(`${caminho}: não é um PNG`);

  let largura = 0;
  let altura = 0;
  let canais = 0;
  const partes = [];

  for (let pos = 8; pos < buf.length; ) {
    const len = buf.readUInt32BE(pos);
    const tipo = buf.toString("ascii", pos + 4, pos + 8);
    const dados = buf.subarray(pos + 8, pos + 8 + len);

    if (tipo === "IHDR") {
      largura = dados.readUInt32BE(0);
      altura = dados.readUInt32BE(4);
      const bits = dados[8];
      const cor = dados[9];
      const entrelace = dados[12];
      if (bits !== 8 || entrelace !== 0 || (cor !== 2 && cor !== 6)) {
        throw new Error(`${caminho}: só leio PNG de 8 bits RGB/RGBA sem entrelace`);
      }
      canais = cor === 6 ? 4 : 3;
    } else if (tipo === "IDAT") {
      partes.push(dados);
    } else if (tipo === "IEND") {
      break;
    }
    pos += 12 + len;
  }

  const bruto = inflateSync(Buffer.concat(partes));
  const passo = largura * canais;
  const rgba = Buffer.alloc(largura * altura * 4);
  const linha = Buffer.alloc(passo);
  const anterior = Buffer.alloc(passo);

  for (let y = 0; y < altura; y++) {
    const inicio = y * (passo + 1);
    const filtro = bruto[inicio];
    bruto.copy(linha, 0, inicio + 1, inicio + 1 + passo);

    // Desfaz o filtro da linha (§9 da especificação do PNG).
    for (let i = 0; i < passo; i++) {
      const a = i >= canais ? linha[i - canais] : 0; // pixel à esquerda
      const b = anterior[i]; // pixel acima
      const c = i >= canais ? anterior[i - canais] : 0; // acima à esquerda
      let x = linha[i];
      if (filtro === 1) x += a;
      else if (filtro === 2) x += b;
      else if (filtro === 3) x += (a + b) >> 1;
      else if (filtro === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        x += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      linha[i] = x & 0xff;
    }

    for (let x = 0; x < largura; x++) {
      const d = (y * largura + x) * 4;
      rgba[d] = linha[x * canais];
      rgba[d + 1] = linha[x * canais + 1];
      rgba[d + 2] = linha[x * canais + 2];
      rgba[d + 3] = canais === 4 ? linha[x * canais + 3] : 255;
    }
    linha.copy(anterior);
  }

  return { largura, altura, rgba };
}

// ─── Redução ────────────────────────────────────────────────────────────────
//
// Média por área (box filter). Só reduzimos, nunca ampliamos, então isso já
// entrega borda limpa. A cor é ponderada pelo alfa — sem isso o branco dos
// pixels transparentes escorre para dentro do contorno e a logo desbota.

function reduzir(origem, larguraFinal, alturaFinal) {
  const { largura, altura, rgba } = origem;
  const saida = Buffer.alloc(larguraFinal * alturaFinal * 4);
  const escalaX = largura / larguraFinal;
  const escalaY = altura / alturaFinal;

  for (let y = 0; y < alturaFinal; y++) {
    const y0 = Math.floor(y * escalaY);
    const y1 = Math.max(y0 + 1, Math.ceil((y + 1) * escalaY));
    for (let x = 0; x < larguraFinal; x++) {
      const x0 = Math.floor(x * escalaX);
      const x1 = Math.max(x0 + 1, Math.ceil((x + 1) * escalaX));

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let sy = y0; sy < y1 && sy < altura; sy++) {
        for (let sx = x0; sx < x1 && sx < largura; sx++) {
          const i = (sy * largura + sx) * 4;
          const alfa = rgba[i + 3] / 255;
          r += rgba[i] * alfa;
          g += rgba[i + 1] * alfa;
          b += rgba[i + 2] * alfa;
          a += alfa;
          n++;
        }
      }

      const d = (y * larguraFinal + x) * 4;
      if (a > 0) {
        saida[d] = Math.round(r / a);
        saida[d + 1] = Math.round(g / a);
        saida[d + 2] = Math.round(b / a);
      }
      saida[d + 3] = Math.round((a / n) * 255);
    }
  }

  return { largura: larguraFinal, altura: alturaFinal, rgba: saida };
}

// ─── Composição do ícone ────────────────────────────────────────────────────

/** Cobertura do quadrado arredondado neste pixel, com amostragem 4×4. */
function coberturaDoFundo(x, y, lado, raio) {
  if (raio === 0) return 1;
  const amostras = 4;
  let dentro = 0;
  for (let sy = 0; sy < amostras; sy++) {
    for (let sx = 0; sx < amostras; sx++) {
      const px = x + (sx + 0.5) / amostras;
      const py = y + (sy + 0.5) / amostras;
      const cx = Math.min(Math.max(px, raio), lado - raio);
      const cy = Math.min(Math.max(py, raio), lado - raio);
      if ((px - cx) ** 2 + (py - cy) ** 2 <= raio * raio) dentro++;
    }
  }
  return dentro / (amostras * amostras);
}

function gerar(simbolo, tamanho, { maskable = false } = {}) {
  const buf = Buffer.alloc(tamanho * tamanho * 4);
  const raio = maskable ? 0 : tamanho * 0.22;
  const fracao = maskable ? ALTURA_SIMBOLO_MASKABLE : ALTURA_SIMBOLO;

  const alturaMarca = Math.round(tamanho * fracao);
  const larguraMarca = Math.round((simbolo.largura * alturaMarca) / simbolo.altura);
  const marca = reduzir(simbolo, larguraMarca, alturaMarca);
  const margemX = Math.round((tamanho - larguraMarca) / 2);
  const margemY = Math.round((tamanho - alturaMarca) / 2);

  // Espessura do fio dourado na borda (só no ícone de cantos arredondados).
  const fio = maskable ? 0 : Math.max(1, tamanho * 0.014);

  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      const cobertura = coberturaDoFundo(x, y, tamanho, raio);
      if (cobertura === 0) continue;

      let cor = FUNDO;

      if (fio > 0) {
        // A borda é a diferença entre o quadrado cheio e o encolhido em `fio`.
        const interno = coberturaDoFundo(x - fio, y - fio, tamanho - 2 * fio, Math.max(0, raio - fio));
        const naBorda = cobertura - interno;
        if (naBorda > 0.01) cor = cor.map((c, k) => Math.round(c * (1 - naBorda) + DOURADO[k] * naBorda));
      }

      const mx = x - margemX;
      const my = y - margemY;
      if (mx >= 0 && mx < larguraMarca && my >= 0 && my < alturaMarca) {
        const i = (my * larguraMarca + mx) * 4;
        const alfa = marca.rgba[i + 3] / 255;
        if (alfa > 0) {
          cor = cor.map((c, k) => Math.round(c * (1 - alfa) + marca.rgba[i + k] * alfa));
        }
      }

      const d = (y * tamanho + x) * 4;
      buf[d] = cor[0];
      buf[d + 1] = cor[1];
      buf[d + 2] = cor[2];
      buf[d + 3] = Math.round(cobertura * 255);
    }
  }

  return png(tamanho, tamanho, buf);
}

/**
 * Favicon: um SVG que carrega dentro de si um PNG pequeno do ícone. Assim a
 * aba mostra a logo de verdade (um traço fino como o da laranja não sobrevive
 * a um redesenho vetorial à mão) e continua sendo um arquivo só, do tamanho
 * de um favicon.
 */
function faviconSvg(simbolo) {
  const embutido = gerar(simbolo, 128).toString("base64");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="Carvalho Cruz">
  <image href="data:image/png;base64,${embutido}" width="128" height="128"/>
</svg>
`;
}

// ─── Saída ──────────────────────────────────────────────────────────────────
const simbolo = lerPng(ORIGEM);
console.log(`origem: ${ORIGEM} (${simbolo.largura}×${simbolo.altura})\n`);

const saidas = [
  ["public/pwa-192x192.png", gerar(simbolo, 192)],
  ["public/pwa-512x512.png", gerar(simbolo, 512)],
  ["public/pwa-maskable-512x512.png", gerar(simbolo, 512, { maskable: true })],
  ["public/apple-touch-icon.png", gerar(simbolo, 180, { maskable: true })],
  ["public/favicon.svg", faviconSvg(simbolo)],
];

for (const [caminho, dados] of saidas) {
  writeFileSync(caminho, dados);
  console.log(caminho, (Buffer.byteLength(dados) / 1024).toFixed(1) + " KB");
}

import assert from "node:assert/strict";
import test from "node:test";

import {
  caminhoUnico, horaLocal, noPeriodo, nomeSeguro, paraCsv, trimestre, trimestreDe, trimestresDisponiveis,
} from "./arquivoMortoBase.js";

test("trimestre: nome da pasta e limites do período", () => {
  assert.deepEqual(trimestre(2026, 1), { ano: 2026, n: 1, inicio: "2026-01-01", fim: "2026-03-31", nome: "Primeiro Trimestre 2026" });
  assert.equal(trimestre(2026, 2).fim, "2026-06-30");
  assert.equal(trimestre(2026, 3).nome, "Terceiro Trimestre 2026");
  assert.equal(trimestre(2026, 4).fim, "2026-12-31");
});

test("trimestreDe: acha o trimestre pela data", () => {
  assert.equal(trimestreDe("2026-03-31").n, 1);
  assert.equal(trimestreDe("2026-04-01").n, 2);
  assert.equal(trimestreDe("2026-10-02").nome, "Quarto Trimestre 2026");
});

test("trimestresDisponiveis: encerrados do mais novo ao mais antigo, o atual por último", () => {
  const lista = trimestresDisponiveis("2026-10-02", 5);
  assert.deepEqual(lista.map((t) => t.nome), [
    "Terceiro Trimestre 2026", "Segundo Trimestre 2026", "Primeiro Trimestre 2026",
    "Quarto Trimestre 2025", "Terceiro Trimestre 2025", "Quarto Trimestre 2026",
  ]);
  assert.equal(lista.at(-1).encerrado, false);
  assert.ok(lista.slice(0, -1).every((t) => t.encerrado));
});

test("noPeriodo: inclui os dois extremos e aceita data com hora", () => {
  const tri = trimestre(2026, 1);
  assert.ok(noPeriodo("2026-01-01", tri));
  assert.ok(noPeriodo("2026-03-31T23:59:59-03:00", tri));
  assert.ok(!noPeriodo("2025-12-31", tri));
  assert.ok(!noPeriodo("2026-04-01", tri));
  assert.ok(!noPeriodo(null, tri));
});

test("nomeSeguro: sem acento, sem caracteres proibidos no Windows", () => {
  assert.equal(nomeSeguro("Mercadão São João / Filial: 2?"), "Mercadao Sao Joao Filial 2");
  assert.equal(nomeSeguro("../../etc"), "etc");
  assert.equal(nomeSeguro(""), "sem-nome");
  assert.equal(nomeSeguro("a".repeat(100)).length, 60);
});

test("caminhoUnico: dois arquivos no mesmo caminho não se sobrescrevem", () => {
  const usados = new Set();
  assert.equal(caminhoUnico("A/foto.jpg", usados), "A/foto.jpg");
  assert.equal(caminhoUnico("A/foto.jpg", usados), "A/foto (2).jpg");
  assert.equal(caminhoUnico("A/foto.jpg", usados), "A/foto (3).jpg");
  assert.equal(caminhoUnico("B.d/arquivo", usados), "B.d/arquivo");
  assert.equal(caminhoUnico("B.d/arquivo", usados), "B.d/arquivo (2)");
});

test("paraCsv: separador ;, aspas e quebra de linha escapadas, BOM para o Excel", () => {
  const csv = paraCsv(["A", "B"], [["x;y", 'diz "oi"'], ["linha\nnova", null]]);
  assert.ok(csv.startsWith("﻿A;B\r\n"));
  assert.ok(csv.includes('"x;y";"diz ""oi"""'));
  assert.ok(csv.includes('"linha\nnova";'));
});

test("horaLocal: horário de Aracaju (UTC-3), vazio sem data", () => {
  assert.equal(horaLocal("2026-03-31T17:05:09Z"), "31/03/2026 14:05:09");
  assert.equal(horaLocal(null), "");
});

// ─── gerarArquivo ───────────────────────────────────────────────────────────

import { gerarArquivo } from "./arquivoMortoBase.js";

const destinoFalso = () => {
  const arquivos = new Map();
  return { arquivos, fechado: false, async gravar(caminho, blob) { arquivos.set(caminho, await blob.text()); }, async fechar() { this.fechado = true; } };
};
const item = (caminho, obter) => ({ caminho, grupo: "Comprovantes", origem: { tabela: "despesas", id: "1", data: "2026-01-05" }, obter });
const planoCom = (arquivos) => ({ arquivos, planilhas: [{ caminho: "Horarios/h.csv", conteudo: "a;b\r\n" }] });
const tri1 = trimestre(2026, 1);

test("gerarArquivo: grava tudo sob a pasta do trimestre, com índice e hash", async () => {
  const destino = destinoFalso();
  const r = await gerarArquivo({ plano: planoCom([item("Comprovantes/a.pdf", async () => new Blob(["conteudo"]))]), tri: tri1, destino });
  assert.ok(r.completo);
  assert.equal(r.gravados, 1);
  assert.ok(destino.fechado);
  assert.deepEqual([...destino.arquivos.keys()].sort(), [
    "Primeiro Trimestre 2026/Comprovantes/a.pdf", "Primeiro Trimestre 2026/Horarios/h.csv",
    "Primeiro Trimestre 2026/LEIA-ME.txt", "Primeiro Trimestre 2026/indice.csv",
  ]);
  // SHA-256 de "conteudo"
  assert.ok(destino.arquivos.get("Primeiro Trimestre 2026/indice.csv").includes("Comprovantes/a.pdf;8;"));
  assert.ok(destino.arquivos.get("Primeiro Trimestre 2026/LEIA-ME.txt").includes("COMPLETO"));
});

test("gerarArquivo: um arquivo que falha deixa o arquivo INCOMPLETO e os outros seguem", async () => {
  const destino = destinoFalso();
  const r = await gerarArquivo({
    plano: planoCom([
      item("Comprovantes/ruim.pdf", async () => { throw new Error("HTTP 500"); }),
      item("Comprovantes/boa.pdf", async () => new Blob(["ok"])),
    ]),
    tri: tri1, destino,
  });
  assert.equal(r.completo, false);
  assert.equal(r.gravados, 1);
  assert.equal(r.falhas.length, 1);
  assert.ok(r.falhas[0].includes("ruim.pdf") && r.falhas[0].includes("HTTP 500"));
  assert.ok(destino.arquivos.get("Primeiro Trimestre 2026/LEIA-ME.txt").includes("INCOMPLETO"));
  assert.ok(!destino.arquivos.get("Primeiro Trimestre 2026/indice.csv").includes("ruim.pdf"));
});

test("gerarArquivo: arquivo vazio conta como falha (nunca arquiva um arquivo em branco)", async () => {
  const r = await gerarArquivo({ plano: planoCom([item("Comprovantes/vazio.pdf", async () => new Blob([]))]), tri: tri1, destino: destinoFalso() });
  assert.equal(r.completo, false);
  assert.equal(r.falhas.length, 1);
});

test("gerarArquivo: cancelar no meio deixa INCOMPLETO", async () => {
  let n = 0;
  const r = await gerarArquivo({
    plano: planoCom([item("a", async () => new Blob(["1"])), item("b", async () => new Blob(["2"]))]),
    tri: tri1, destino: destinoFalso(), cancelado: () => n++ > 0,
  });
  assert.equal(r.completo, false);
  assert.equal(r.gravados, 1);
});

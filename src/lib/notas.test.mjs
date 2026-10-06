import test from "node:test";
import assert from "node:assert/strict";
import { efeitosDasDevolucoes } from "./notas.js";

const dados = (nota) => ({
  produtos: [{ id: "p1", nome: "Laranja Pera 2,5kg" }],
  vendas: [{ id: "v1", data: "2026-10-01", lojaId: "l1", itens: [{ produtoId: "p1", qty: 60, kgPorUnidade: 2.5, kgTotal: 150, precoUnitario: 10 }] }],
  notas_entrada: [nota],
});

test("devolução emitida por nós abate receita e kg, e volta ao estoque", () => {
  const [l] = efeitosDasDevolucoes(dados({ id: "n", tipo: "devolucao", origem: "app", nfeStatus: "autorizada", vendaId: "v1", valor: 100, itens: [{ produtoId: "p1", qty: 10 }] }));
  assert.equal(l.receita, 100);
  assert.equal(l.kg, 25);
  assert.equal(l.kgVolta, 25);
});

test("avariada não volta ao estoque; nota não autorizada não conta", () => {
  const [l] = efeitosDasDevolucoes(dados({ id: "n", tipo: "devolucao", origem: "app", nfeStatus: "autorizada", vendaId: "v1", valor: 100, itens: [{ produtoId: "p1", qty: 10, avariada: true }] }));
  assert.equal(l.kgVolta, 0);
  assert.equal(efeitosDasDevolucoes(dados({ id: "n", tipo: "devolucao", origem: "app", nfeStatus: "rejeitada", vendaId: "v1", valor: 100, itens: [{ produtoId: "p1", qty: 10 }] })).length, 0);
});

test("nota do cliente (XML) casa pelo nome; o resto do valor abate sem kg", () => {
  const ls = efeitosDasDevolucoes(dados({ id: "n", tipo: "devolucao", origem: "sefaz", vendaId: "v1", valor: 120, itens: [{ descricao: "LARANJA PERA 2,5KG", quantidade: 10, unidade: "SC", total: 100 }] }));
  assert.equal(ls.length, 2);
  assert.equal(ls[0].kg, 25);
  assert.equal(ls[1].receita, 20);
  assert.equal(ls[1].kg, 0);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  linhasDeVenda, mudarCompra, mudarItem, mudarVenda, removerItem, resumoDaFruta, vendaTravada,
} from "./planilhaFrutas.js";

const dados = () => ({
  produtos: [{ id: "p1", nome: "Limão", fruta: "Limão" }, { id: "p2", nome: "Goiaba", fruta: "Goiaba" }],
  vendas: [
    { id: "v1", data: "2026-08-21", prazoDias: 0, status: "pago", total: 1110, kgTotal: 250, nfeStatus: "nao_emitida",
      itens: [{ produtoId: "p1", qty: 200, precoUnitario: 4.4, kgPorUnidade: 1, kgTotal: 200, natureza: "venda" },
        { produtoId: "p1", qty: 50, precoUnitario: 4.6, kgPorUnidade: 1, kgTotal: 50, natureza: "venda" }] },
    { id: "v2", data: "2026-09-01", prazoDias: 0, status: "pendente", total: 100, kgTotal: 50, nfeStatus: "autorizada",
      itens: [{ produtoId: "p1", qty: 50, precoUnitario: 2, kgPorUnidade: 1, kgTotal: 50, natureza: "venda" }] },
    { id: "v3", data: "2026-09-02", prazoDias: 0, status: "pago", total: 10, kgTotal: 5, nfeStatus: "nao_emitida",
      itens: [{ produtoId: "p2", qty: 5, precoUnitario: 2, kgPorUnidade: 1, kgTotal: 5, natureza: "venda" }] },
  ],
  compras: [{ id: "c1", fruta: "Limão", data: "2026-08-11", pesoKg: 4100, valorKg: 3.2, total: 13120 }],
  perdas: [{ id: "x1", fruta: "Limão", data: "2026-08-20", kg: 100, custoKg: 3, valor: 300 }],
  despesas: [{ id: "d1", fruta: "Limão", data: "2026-08-11", valor: 800 }, { id: "d2", fruta: "", valor: 50 }],
  acertos: [],
});

test("linhas de venda só da fruta, uma por item", () => {
  assert.equal(linhasDeVenda(dados(), "Limão").length, 3);
  assert.equal(linhasDeVenda(dados(), "Goiaba").length, 1);
});

test("resumo da fruta: receita, compra, despesa, resultado e estoque", () => {
  const r = resumoDaFruta(dados(), "Limão");
  assert.equal(r.venda, 1210);
  assert.equal(r.recebido, 1110);
  assert.equal(r.aReceber, 100);
  assert.equal(r.compra, 13120);
  assert.equal(r.despesa, 800);
  assert.equal(r.resultado, 1210 - 13120 - 800);
  assert.equal(r.estoque, 4100 - 300 - 100);
});

test("editar o total do item vira preço e refaz o total do pedido", () => {
  const d = mudarItem(dados(), "v1", 0, { total: 1000 });
  const v = d.vendas.find((x) => x.id === "v1");
  assert.equal(v.itens[0].precoUnitario, 5);
  assert.equal(v.total, 1230);
});

test("editar a quantidade refaz os quilos", () => {
  const d = mudarItem(dados(), "v1", 1, { qty: 100 });
  const v = d.vendas.find((x) => x.id === "v1");
  assert.equal(v.itens[1].kgTotal, 100);
  assert.equal(v.kgTotal, 300);
});

test("pedido com nota autorizada não muda", () => {
  assert.equal(vendaTravada(dados().vendas[1]), true);
  const d = dados();
  assert.equal(mudarItem(d, "v2", 0, { qty: 1 }), d);
  assert.equal(mudarVenda(d, "v2", { status: "pago" }), d);
  assert.equal(removerItem(d, "v2", 0), d);
});

test("remover o único item remove o pedido; com dois itens, só o item", () => {
  assert.equal(removerItem(dados(), "v3", 0).vendas.some((v) => v.id === "v3"), false);
  const d = removerItem(dados(), "v1", 0);
  assert.equal(d.vendas.find((v) => v.id === "v1").itens.length, 1);
  assert.equal(d.vendas.find((v) => v.id === "v1").total, 230);
});

test("compra: total digitado vira R$/kg", () => {
  const c = mudarCompra(dados(), "c1", { total: 12300 }).compras[0];
  assert.equal(c.valorKg, 3);
  assert.equal(c.total, 12300);
});

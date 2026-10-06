import test from "node:test";
import assert from "node:assert/strict";
import { limparTaxas, taxasDaLoja } from "./taxas.js";

test("taxa da loja vale no lugar da da rede para o mesmo tipo; valor 0 desliga", () => {
  const rede = { taxas: [{ tipo: "cd", modo: "percentual", valor: 3 }, { tipo: "ifco", modo: "por_pedido", valor: 50 }] };
  const loja = { taxas: [{ tipo: "cd", modo: "percentual", valor: 5 }, { tipo: "ifco", modo: "por_pedido", valor: 0 }] };
  const t = taxasDaLoja(rede, loja);
  assert.deepEqual(t.map((x) => [x.tipo, x.valor]), [["cd", 5]]);
});

test("limparTaxas descarta valor inválido e aceita vírgula", () => {
  assert.deepEqual(limparTaxas([{ tipo: "cd", modo: "percentual", valor: "2,5" }, { tipo: "cd", valor: "" }, { tipo: "cd", valor: -1 }]).map((x) => x.valor), [2.5]);
});

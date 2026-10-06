import assert from "node:assert/strict";
import { test } from "node:test";

import { interpretarComprovante as ler } from "./comprovanteTexto.js";

test("PDF de transferência com rótulos", () => {
  const r = ler("Comprovante de Transferência Data da transferência: 15/09/2026 Valor: R$ 1.234,56 Favorecido: JOSE DA SILVA CPF 123 Tarifa: R$ 0,00");
  assert.deepEqual(r, { valor: 1234.56, data: "2026-09-15", favorecido: "JOSE DA SILVA" });
});

test("valor total pago vence o valor genérico e ignora tarifa", () => {
  const r = ler("Valor nominal R$ 1.000,00 Tarifa R$ 5,00 Valor total pago R$ 1.005,00 Data de pagamento 02/10/2026");
  assert.equal(r.valor, 1005);
  assert.equal(r.data, "2026-10-02");
});

test("OCR troca o cifrão por S ou 5", () => {
  assert.equal(ler("Valor RS 923,00").valor, 923);
  assert.equal(ler("Valor pago R5 2.450,10").valor, 2450.1);
});

test("sem rótulo: um único valor em reais serve", () => {
  assert.equal(ler("Pix enviado R$ 350,00 para POSTO SANTA LUZIA").valor, 350);
});

test("sem rótulo e com vários valores: não chuta", () => {
  assert.equal(ler("Pix R$ 350,00 saldo R$ 8.000,00").valor, null);
});

test("data por extenso e data única sem rótulo", () => {
  assert.equal(ler("Pagamento realizado em 30 de setembro de 2026").data, "2026-09-30");
  assert.equal(ler("Pix enviado 30/09/2026 às 21:45").data, "2026-09-30");
});

test("várias datas sem rótulo: não chuta", () => {
  assert.equal(ler("Emissão 01/09/2026 Vencimento 30/09/2026").data, null);
});

test("data inválida é ignorada", () => {
  assert.equal(ler("Data: 45/13/2026").data, null);
});

test("texto sem nada útil", () => {
  assert.deepEqual(ler("obrigado por usar nosso app"), { valor: null, data: null, favorecido: null });
});

test("favorecido termina antes do próximo rótulo (Tarifa:)", () => {
  assert.equal(ler("Favorecido: FRUTAS DO VALE ME Tarifa: R$ 4,50 Valor pago: R$ 100,00").favorecido, "FRUTAS DO VALE ME");
});

test("Pix: nome em maiúsculas depois de 'Para'", () => {
  assert.equal(ler("Pix enviado R$ 1.450,75 30/09/2026 Para POSTO BR AREIA BRANCA Instituição Banco Safra").favorecido, "POSTO BR AREIA BRANCA");
});

test("'para' no meio de uma frase não vira favorecido", () => {
  assert.equal(ler("Guarde este comprovante para consultas futuras").favorecido, null);
});

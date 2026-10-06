/**
 * Contas da tela Frutas — a aba de cada fruta da planilha, dentro do app.
 *
 * Cada fruta mostra o que a planilha mostrava: VENDA (uma linha por item
 * vendido), COMPRA, DESPESAS COM A FRUTA e o RESUMO FINANCEIRO. Tudo sai das
 * coleções de sempre (vendas, compras, despesas, perdas) — não há tabela
 * nova: editar uma linha aqui é editar o registro de verdade.
 *
 * Funções puras, sem React, para dar para testar com `node --test`.
 */

import { vencimentoDe } from "./datas.js";

export const RECEBEDORES = [
  { valor: "cvc", rotulo: "CVC" },
  { valor: "carvalho_cruz", rotulo: "CC (Carvalho Cruz)" },
  { valor: "avf", rotulo: "AVF" },
];

export const rotuloRecebedor = (valor) => RECEBEDORES.find((r) => r.valor === (valor || "cvc"))?.rotulo ?? valor;

const n = (v) => Number(v) || 0;
const centavos = (v) => Math.round((n(v) + Number.EPSILON) * 100) / 100;

/** Nota autorizada ou em andamento: o valor do pedido não pode mais mudar aqui. */
export const vendaTravada = (venda) => ["autorizada", "processando", "consolidada"].includes(venda.nfeStatus);

/** Receita de um item: bonificação não é faturamento. */
export const receitaDoItem = (item) => (item.natureza === "bonificacao" ? 0 : n(item.qty) * n(item.precoUnitario));

/** Refaz total e quilos do pedido depois que um item mudou. */
export function recalcularVenda(venda) {
  const itens = venda.itens ?? [];
  return {
    ...venda,
    total: centavos(itens.reduce((s, i) => s + receitaDoItem(i), 0)),
    kgTotal: itens.reduce((s, i) => s + n(i.kgTotal), 0),
  };
}

/** Todas as frutas que têm produto, compra, perda ou despesa própria. */
export function frutasDaPlanilha(dados) {
  const nomes = new Set();
  for (const lista of [dados.produtos, dados.compras, dados.perdas, dados.acertos, dados.despesas]) {
    for (const x of lista ?? []) if (x.fruta) nomes.add(x.fruta);
  }
  return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Uma linha por item vendido da fruta, na ordem da planilha (data, depois criação). */
export function linhasDeVenda(dados, fruta) {
  const produtos = new Map((dados.produtos ?? []).map((p) => [p.id, p]));
  const linhas = [];
  for (const venda of dados.vendas ?? []) {
    if (venda.status === "cancelado") continue;
    (venda.itens ?? []).forEach((item, indice) => {
      const produto = produtos.get(item.produtoId);
      if (produto?.fruta === fruta) linhas.push({ chave: `${venda.id}:${indice}`, venda, indice, item, produto });
    });
  }
  return linhas.sort((a, b) =>
    String(a.venda.data).localeCompare(String(b.venda.data)) ||
    String(a.venda.criadoEm ?? "").localeCompare(String(b.venda.criadoEm ?? "")) || a.indice - b.indice);
}

const porData = (a, b) =>
  String(a.data).localeCompare(String(b.data)) || String(a.criadoEm ?? "").localeCompare(String(b.criadoEm ?? ""));

export const comprasDaFruta = (dados, fruta) => (dados.compras ?? []).filter((c) => c.fruta === fruta).sort(porData);
export const perdasDaFruta = (dados, fruta) => (dados.perdas ?? []).filter((p) => p.fruta === fruta).sort(porData);
export const despesasDaFruta = (dados, fruta) => (dados.despesas ?? []).filter((d) => d.fruta === fruta).sort(porData);

/** O "RESUMO FINANCEIRO" e o "ESTOQUE" do canto da aba. */
export function resumoDaFruta(dados, fruta) {
  const vendas = linhasDeVenda(dados, fruta);
  const compras = comprasDaFruta(dados, fruta);
  const perdas = perdasDaFruta(dados, fruta);
  const despesas = despesasDaFruta(dados, fruta);
  const acertos = (dados.acertos ?? []).filter((a) => a.fruta === fruta);

  const venda = vendas.reduce((s, l) => s + receitaDoItem(l.item), 0);
  const recebido = vendas.filter((l) => l.venda.status === "pago").reduce((s, l) => s + receitaDoItem(l.item), 0);
  const kgVendido = vendas.reduce((s, l) => s + n(l.item.kgTotal), 0);
  const compra = compras.reduce((s, c) => s + n(c.total), 0);
  const kgComprado = compras.reduce((s, c) => s + n(c.pesoKg), 0);
  const despesa = despesas.reduce((s, d) => s + n(d.valor), 0);
  const kgPerdido = perdas.reduce((s, p) => s + n(p.kg), 0);
  const ajuste = acertos.reduce((s, a) => s + n(a.ajuste), 0);

  return {
    venda: centavos(venda),
    recebido: centavos(recebido),
    aReceber: centavos(venda - recebido),
    compra: centavos(compra),
    despesa: centavos(despesa),
    resultado: centavos(venda - compra - despesa),
    kgVendido, kgComprado, kgPerdido,
    estoque: kgComprado - kgVendido - kgPerdido + ajuste,
    custoMedio: kgComprado > 0 ? compra / kgComprado : 0,
    precoMedio: kgVendido > 0 ? venda / kgVendido : 0,
  };
}

// ─── Edições: devolvem o novo `dados`, sem mexer no que não é da linha ──────

const trocarVenda = (dados, nova) => ({ ...dados, vendas: dados.vendas.map((v) => (v.id === nova.id ? nova : v)) });

/** Muda campos do PEDIDO (data, cliente, status, quem recebeu). */
export function mudarVenda(dados, vendaId, campos) {
  const venda = dados.vendas.find((v) => v.id === vendaId);
  if (!venda || vendaTravada(venda)) return dados;
  const nova = { ...venda, ...campos };
  if (campos.data) nova.vencimento = vencimentoDe(campos.data, venda.prazoDias);
  return trocarVenda(dados, nova);
}

/**
 * Muda um ITEM. `qty` refaz os quilos (qty × kg por unidade); `total` não é
 * campo do item — vira preço (total ÷ quantidade), que é como a planilha
 * pensa: o número digitado é o total da linha.
 */
export function mudarItem(dados, vendaId, indice, campos) {
  const venda = dados.vendas.find((v) => v.id === vendaId);
  if (!venda || vendaTravada(venda)) return dados;
  const itens = venda.itens.map((item, i) => {
    if (i !== indice) return item;
    const novo = { ...item };
    if ("produtoId" in campos) novo.produtoId = campos.produtoId;
    if ("qty" in campos) {
      novo.qty = n(campos.qty);
      novo.kgTotal = novo.qty * (n(item.kgPorUnidade) || 1);
    }
    if ("precoUnitario" in campos) novo.precoUnitario = n(campos.precoUnitario);
    if ("total" in campos) novo.precoUnitario = n(novo.qty) > 0 ? n(campos.total) / n(novo.qty) : 0;
    return novo;
  });
  return trocarVenda(dados, recalcularVenda({ ...venda, itens }));
}

/** Tira um item; se era o único, o pedido inteiro sai. Pedido com nota emitida não sai. */
export function removerItem(dados, vendaId, indice) {
  const venda = dados.vendas.find((v) => v.id === vendaId);
  if (!venda || vendaTravada(venda)) return dados;
  if ((venda.itens ?? []).length <= 1) return { ...dados, vendas: dados.vendas.filter((v) => v.id !== vendaId) };
  const itens = venda.itens.filter((_, i) => i !== indice);
  return trocarVenda(dados, recalcularVenda({ ...venda, itens }));
}

/** Linha nova de venda: um pedido de um item só, para preencher na própria tabela. */
export function novaVenda({ id, numero, data, lojaId, produto, recebedor = "carvalho_cruz", agora }) {
  const kgPorUnidade = n(produto?.kgPorUnidade) || 1;
  return {
    id, numero, lojaId, data, prazoDias: 0, vencimento: data, status: "pendente", recebedor,
    itens: [{ produtoId: produto?.id, qty: 0, precoUnitario: 0, kgPorUnidade, kgTotal: 0, natureza: "venda" }],
    total: 0, kgTotal: 0, criadoEm: agora,
  };
}

/** Compra: o total digitado vira R$/kg (total ÷ kg). */
export function mudarCompra(dados, id, campos) {
  return {
    ...dados,
    compras: dados.compras.map((c) => {
      if (c.id !== id) return c;
      const nova = { ...c, ...campos };
      if ("total" in campos) {
        nova.valorKg = n(nova.pesoKg) > 0 ? n(campos.total) / n(nova.pesoKg) : 0;
        delete nova.total;
      }
      if ("pesoKg" in campos) nova.pesoKg = n(campos.pesoKg);
      if ("valorKg" in campos) nova.valorKg = n(campos.valorKg);
      nova.total = centavos(n(nova.pesoKg) * n(nova.valorKg));
      return nova;
    }),
  };
}

export function mudarPerda(dados, id, campos) {
  return {
    ...dados,
    perdas: dados.perdas.map((p) => {
      if (p.id !== id) return p;
      const nova = { ...p, ...campos };
      if ("kg" in campos) nova.kg = n(campos.kg);
      if ("custoKg" in campos) nova.custoKg = n(campos.custoKg);
      nova.valor = centavos(n(nova.kg) * n(nova.custoKg));
      return nova;
    }),
  };
}

export function mudarDespesa(dados, id, campos) {
  return {
    ...dados,
    despesas: dados.despesas.map((d) => (d.id === id ? { ...d, ...campos, ...("valor" in campos && { valor: n(campos.valor) }) } : d)),
  };
}

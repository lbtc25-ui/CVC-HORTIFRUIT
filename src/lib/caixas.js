/**
 * Caixas: o peso de uma caixa é cadastrado por fruta (produto.kgPorCaixa).
 * Itens de fruta sem peso cadastrado não entram na conta de caixas — só nos quilos.
 */

/** Caixas de um item de venda (kgTotal ÷ kg da caixa); 0 se a fruta não tem peso cadastrado. */
export const caixasDoItem = (item, produto) => {
  const porCaixa = Number(produto?.kgPorCaixa) || 0;
  return porCaixa > 0 ? (Number(item?.kgTotal) || 0) / porCaixa : 0;
};

/** Quilos e caixas de um conjunto de vendas (bonificação sai do depósito igual, então entra). */
export const totaisDasVendas = (vendas, produtos) => {
  const porId = new Map(produtos.map((p) => [p.id, p]));
  let kgTotal = 0;
  let caixas = 0;
  for (const v of vendas) {
    for (const item of v.itens ?? []) {
      kgTotal += Number(item.kgTotal) || 0;
      caixas += caixasDoItem(item, porId.get(item.produtoId));
    }
  }
  return { kgTotal, caixas };
};

/** "12 cx" / "12,5 cx"; vazio quando não há caixas (fruta sem peso cadastrado). */
export const rotuloCaixas = (n) => {
  const v = Math.round((Number(n) || 0) * 10) / 10;
  if (v <= 0) return "";
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} cx`;
};

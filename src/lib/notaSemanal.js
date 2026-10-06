/**
 * Nota fiscal semanal por rede — hoje só a Rede Primavera: cada pedido da
 * semana sai só com um recibo (lib/recibo.js), sem NF-e própria, e a NF-e de
 * verdade é emitida uma vez só — no último pedido da semana — juntando os
 * itens de todos os pedidos daquela loja que ainda não têm nota.
 *
 * Regra fixa pelo nome da rede por enquanto: se amanhã outra rede pedir o
 * mesmo, isto vira um campo na ficha da rede em vez de mexer em código.
 */
import { formatarData, vencimentoDe } from "./datas";

const REDES_NOTA_SEMANAL = ["PRIMAVERA"];

/** Se os pedidos desta loja seguem "recibo na entrega, nota só no fim da semana". */
export function ehNotaSemanal(dados, lojaId) {
  const loja = dados.lojas.find((l) => l.id === lojaId);
  const rede = loja && dados.redes.find((r) => r.id === loja.redeId);
  return !!rede && REDES_NOTA_SEMANAL.includes(String(rede.nome).trim().toUpperCase());
}

/**
 * Pedidos da mesma loja ainda sem NF-e própria nem consolidados em outro,
 * elegíveis para entrar na nota que fecha a semana — sempre inclui `venda`.
 * Quem decide o que realmente entra é a pessoa, marcando/desmarcando no
 * modal — aqui só se lista quem pode.
 */
export function pedidosParaFecharSemana(dados, venda) {
  return dados.vendas
    // Pedido marcado como "sem NF" (emitirNf === false) nunca entra na nota
    // semanal de outro pedido — quem não quer nota não quer nem consolidada.
    .filter((v) => v.lojaId === venda.lojaId && v.status !== "cancelado" && !v.aguardandoConferencia
      && v.emitirNf !== false
      && (v.id === venda.id || v.nfeStatus === "nao_emitida" || v.nfeStatus === "rejeitada"))
    .sort((a, b) => a.data.localeCompare(b.data) || (a.numero ?? 0) - (b.numero ?? 0));
}

/** Itens de todos os pedidos escolhidos, um atrás do outro — a nota traz cada
 * linha como foi pedida, sem somar produto repetido nem misturar preços. */
export const mesclarItensPedidos = (pedidos) => pedidos.flatMap((p) => p.itens ?? []);

/** O pedido "âncora" (quem carrega a NF-e de verdade) e os que foram consolidados nele. */
export function pedidosDaNotaConsolidada(dados, vendaAncora) {
  const outros = dados.vendas.filter((v) => v.consolidadaEm === vendaAncora.id);
  return [vendaAncora, ...outros];
}

/** Valor total da nota: o pedido âncora somado aos que foram consolidados nele. */
export const valorConsolidadoDaNota = (dados, vendaAncora) =>
  pedidosDaNotaConsolidada(dados, vendaAncora).reduce((s, v) => s + (Number(v.total) || 0), 0);

/** Quilos totais da nota, pela mesma soma. */
export const kgConsolidadoDaNota = (dados, vendaAncora) =>
  pedidosDaNotaConsolidada(dados, vendaAncora).reduce((s, v) => s + (Number(v.kgTotal) || 0), 0);

/**
 * O vencimento "de verdade" de um pedido, para cobrança e alertas de atraso.
 *
 * Pedido normal: a data e o prazo dele mesmo, como sempre. Pedido de uma rede
 * de nota semanal (Rede Primavera) que ainda não fechou a semana não é nem à
 * vista nem a prazo — o prazo combinado só começa a contar quando a NF-e sai,
 * então ainda não tem vencimento (como uma venda cancelada, entra como null).
 * Uma vez fechada a semana, tanto o pedido âncora quanto os que entraram com
 * ele vencem juntos, na data do âncora — é o prazo dele que vale pra nota
 * inteira.
 */
export function vencimentoDoPedido(dados, venda) {
  if (venda.status === "cancelado") return null;
  if (venda.nfeStatus === "consolidada") {
    const ancora = dados.vendas.find((v) => v.id === venda.consolidadaEm);
    return ancora ? vencimentoDoPedido(dados, ancora) : null;
  }
  // Pedido sem NF (emitirNf === false) nunca vai fechar semana — o vencimento
  // dele conta normal, mesmo numa rede de nota semanal.
  if (venda.emitirNf !== false && ehNotaSemanal(dados, venda.lojaId) && venda.nfeStatus !== "autorizada") return null;
  return Number(venda.prazoDias) > 0 ? vencimentoDe(venda.data, venda.prazoDias) : null;
}

/**
 * Vencimento para mostrar na tela: a data, se já houver; senão um aviso —
 * "após fechar a semana" para quem ainda não tem vencimento por causa da nota
 * semanal, "—" para os demais casos sem vencimento (à vista, cancelada).
 */
export function rotuloVencimento(dados, venda) {
  const venc = vencimentoDoPedido(dados, venda);
  if (venc) return formatarData(venc);
  const aguardandoFechamento = venda.status !== "cancelado" && venda.emitirNf !== false && ehNotaSemanal(dados, venda.lojaId)
    && venda.nfeStatus !== "autorizada" && venda.nfeStatus !== "consolidada";
  return aguardandoFechamento ? "após fechar a semana" : "—";
}

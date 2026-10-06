/**
 * Previsão de pedidos e alerta de falta de pedido, por loja.
 *
 * Nada de tabela nova: é conta em cima de dados.vendas, como o histórico da
 * loja. Para cada cliente o app lê os dias em que ele pediu (a data do
 * pedido é o dia da entrega) e tira dali o ritmo dele:
 *
 *   - de quantos em quantos dias pede (a mediana dos intervalos recentes —
 *     um pedido fora de hora não estraga a conta);
 *   - se pede em dia fixo da semana ("toda quarta", "seg e qui").
 *
 * Com o ritmo, a previsão do próximo pedido parte SEMPRE do último pedido
 * feito. É isso que trata o pedido antecipado: quem pede toda quarta e nesta
 * semana pediu na segunda já cobriu a quarta — o próximo esperado é a quarta
 * da semana que vem, e não há alerta. Do mesmo jeito, um pedido já lançado
 * para amanhã conta como feito.
 *
 * O alerta nasce quando o dia esperado chega (ou passa) sem pedido nenhum
 * desde o último.
 */

import { hojeISO } from "./datas";

const DIA_MS = 86_400_000;
const paraMs = (iso) => {
  const [a, m, d] = String(iso).split("-").map(Number);
  return Date.UTC(a, m - 1, d);
};
const deMs = (ms) => new Date(ms).toISOString().slice(0, 10);
export const somarDias = (iso, dias) => deMs(paraMs(iso) + dias * DIA_MS);
export const diasEntre = (de, ate) => Math.round((paraMs(ate) - paraMs(de)) / DIA_MS);
export const diaDaSemana = (iso) => new Date(paraMs(iso)).getUTCDay(); // 0 = domingo

/** Quanto do histórico olha para achar o ritmo: o de agora, não o do ano passado. */
export const JANELA_DIAS = 120;
/** Dias de pedido (distintos) necessários para dizer que há um padrão. */
export const MIN_PEDIDOS = 3;
/** Quantos pedidos recentes entram na conta do ritmo e do valor típico. */
const PEDIDOS_RECENTES = 10;
/** Parou de comprar: sem pedido há mais que isso (e mais que 4 ciclos). */
const DIAS_PARADO = 45;

const NOMES_DIA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const ABREV_DIA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const nomeDoDia = (iso) => NOMES_DIA[diaDaSemana(iso)];
export const abrevDoDia = (iso) => ABREV_DIA[diaDaSemana(iso)];

const mediana = (valores) => {
  if (!valores.length) return 0;
  const v = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
};

/**
 * Dias fixos da semana, se houver: os dias que se repetem (2+ vezes) e juntos
 * cobrem pelo menos 75% dos pedidos recentes. No máximo três dias — mais que
 * isso é pedido espalhado, e aí vale o intervalo.
 */
function diasFixos(dias, cadencia) {
  if (dias.length < MIN_PEDIDOS || cadencia > 16) return [];
  const contagem = new Array(7).fill(0);
  for (const d of dias) contagem[diaDaSemana(d)] += 1;
  const fixos = contagem.map((n, dia) => ({ dia, n })).filter((x) => x.n >= 2);
  const cobertos = fixos.reduce((s, x) => s + x.n, 0);
  if (!fixos.length || fixos.length > 3 || cobertos / dias.length < 0.75) return [];
  return fixos.map((x) => x.dia).sort((a, b) => a - b);
}

/**
 * O próximo pedido esperado depois de `ultimo`. Com dia fixo: o primeiro dia
 * fixo depois de ~60% do ciclo (pedir na segunda em vez da quarta cobre a
 * quarta desta semana; a próxima esperada é a da semana que vem). Sem dia
 * fixo: último + intervalo típico.
 */
function proximoEsperado(ultimo, cadencia, fixos) {
  if (!fixos.length) return somarDias(ultimo, Math.max(1, Math.round(cadencia)));
  let d = somarDias(ultimo, Math.max(1, Math.ceil(cadencia * 0.6)));
  for (let i = 0; i < 7 && !fixos.includes(diaDaSemana(d)); i++) d = somarDias(d, 1);
  return d;
}

/** "Toda quarta", "Seg e qui", "A cada ~10 dias". */
function descreverPadrao(cadencia, fixos) {
  if (fixos.length) {
    const nomes = fixos.map((d) => ABREV_DIA[d]);
    const lista = nomes.length === 1 ? NOMES_DIA[fixos[0]]
      : `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`;
    if (fixos.length === 1 && cadencia >= 12) return `A cada 2 semanas, ${lista}`;
    if (fixos.length === 1) return `Toda ${lista}`.replace("Toda sábado", "Todo sábado").replace("Toda domingo", "Todo domingo");
    return lista.charAt(0).toUpperCase() + lista.slice(1);
  }
  const c = Math.round(cadencia);
  if (c <= 1) return "Todo dia";
  if (c === 7) return "Uma vez por semana";
  if (c === 14) return "A cada 2 semanas";
  return `A cada ~${c} dias`;
}

/** Quão certo é o ritmo: pela variação dos intervalos em torno da média. */
function regularidade(intervalos) {
  if (intervalos.length < 2) return "baixa";
  const media = intervalos.reduce((s, x) => s + x, 0) / intervalos.length;
  const desvio = Math.sqrt(intervalos.reduce((s, x) => s + (x - media) ** 2, 0) / intervalos.length);
  const cv = media > 0 ? desvio / media : 1;
  return cv <= 0.25 ? "alta" : cv <= 0.5 ? "media" : "baixa";
}

/**
 * Pedidos válidos de cada loja, somados por dia: dois pedidos no mesmo dia
 * são uma compra só para o ritmo. Venda cancelada não conta.
 */
function diasDePedidoPorLoja(vendas, desde) {
  const porLoja = new Map();
  for (const v of vendas) {
    if (!v.lojaId || !v.data || v.status === "cancelado" || v.data < desde) continue;
    const dias = porLoja.get(v.lojaId) ?? new Map();
    const dia = dias.get(v.data) ?? { data: v.data, total: 0, kg: 0 };
    dia.total += Number(v.total) || 0;
    dia.kg += Number(v.kgTotal) || 0;
    dias.set(v.data, dia);
    porLoja.set(v.lojaId, dias);
  }
  return porLoja;
}

/**
 * O padrão de uma loja a partir dos dias em que pediu (ordenados). Devolve
 * null se ainda não há pedidos suficientes para enxergar um ritmo.
 */
export function padraoDaLoja(diasPedido, hoje = hojeISO()) {
  if (diasPedido.length < MIN_PEDIDOS) return null;
  const recentes = diasPedido.slice(-PEDIDOS_RECENTES);
  const datas = recentes.map((d) => d.data);
  const intervalos = datas.slice(1).map((d, i) => diasEntre(datas[i], d));
  const cadencia = mediana(intervalos);
  if (cadencia <= 0) return null;
  const fixos = diasFixos(datas, cadencia);

  const ultimo = datas.at(-1);
  const esperado = proximoEsperado(ultimo, cadencia, fixos);
  const atraso = diasEntre(esperado, hoje); // > 0: passou do dia sem pedido
  const semPedidoHa = Math.max(0, diasEntre(ultimo, hoje));

  // Folga depois do dia esperado. Dia fixo: o alerta sai no dia seguinte.
  // Ritmo por intervalo: um quarto do ciclo, pelo menos um dia.
  const folga = fixos.length ? 0 : Math.max(0, Math.round(cadencia * 0.25) - 1);
  const ciclosPerdidos = atraso > folga ? Math.floor((atraso - 1) / cadencia) + 1 : 0;

  let situacao;
  if (ultimo > hoje) situacao = "lancado"; // já tem pedido lançado para frente
  else if (semPedidoHa > Math.max(DIAS_PARADO, cadencia * 4)) situacao = "parado";
  else if (atraso > folga) situacao = "atrasado";
  else if (atraso >= 0) situacao = "hoje";
  else situacao = "em_dia";

  // Antecipou: o último pedido veio antes do dia que o ritmo anterior previa
  // (ex.: pede toda quarta, pediu na segunda). Mostra-se para o alerta calado
  // não parecer esquecimento.
  let antecipou = 0;
  if (datas.length >= MIN_PEDIDOS + 1) {
    const antes = datas.slice(0, -1);
    const intAntes = antes.slice(1).map((d, i) => diasEntre(antes[i], d));
    const cadAntes = mediana(intAntes);
    if (cadAntes > 0) {
      const fixosAntes = diasFixos(antes, cadAntes);
      const previsto = proximoEsperado(antes.at(-1), cadAntes, fixosAntes);
      const diff = diasEntre(ultimo, previsto);
      // Sem dia fixo, um dia de diferença é o balanço normal do ritmo.
      const minimo = fixosAntes.length ? 1 : Math.max(2, Math.round(cadAntes * 0.3));
      if (diff >= minimo && diff < cadAntes) antecipou = diff;
    }
  }

  const ultimosValores = recentes.slice(-5);
  return {
    pedidos: diasPedido.length,
    cadencia,
    diasFixos: fixos,
    padrao: descreverPadrao(cadencia, fixos),
    regularidade: regularidade(intervalos),
    ultimo,
    esperado,
    atraso,
    semPedidoHa,
    ciclosPerdidos,
    situacao,
    antecipou,
    valorTipico: mediana(ultimosValores.map((d) => d.total)),
    kgTipico: mediana(ultimosValores.map((d) => d.kg)),
  };
}

/**
 * O padrão de todas as lojas ativas. Cada item traz a loja, o nome da rede e
 * o padrão (ou `padrao: null` para quem ainda tem poucos pedidos).
 */
export function previsaoDosClientes(dados, hoje = hojeISO()) {
  const desde = somarDias(hoje, -JANELA_DIAS);
  const porLoja = diasDePedidoPorLoja(dados.vendas ?? [], desde);
  const redes = new Map((dados.redes ?? []).map((r) => [r.id, r]));
  const lista = [];
  for (const loja of dados.lojas ?? []) {
    if (loja.status === "inativo") continue;
    const rede = redes.get(loja.redeId);
    if (rede?.status === "inativo") continue;
    const dias = [...(porLoja.get(loja.id)?.values() ?? [])].sort((a, b) => a.data.localeCompare(b.data));
    if (!dias.length) continue;
    lista.push({
      lojaId: loja.id,
      loja,
      rede,
      nome: rede ? `${rede.nome} · ${loja.nome}` : loja.nome,
      ...(padraoDaLoja(dias, hoje) ?? { padrao: null, pedidos: dias.length, ultimo: dias.at(-1).data }),
    });
  }
  return lista;
}

// ─── Sinalizações ───────────────────────────────────────────────────────────
//
// Quem cuida dos clientes marca o alerta (coleção `sinalizacoes_clientes`):
//
//   lembrar → "me lembre em DD/MM": o alerta some até o dia e volta nele
//             como lembrete, com o motivo;
//   ciente  → "já sei, já falei com ele": some até o próximo pedido;
//   parou   → "parou de pedir", com o motivo: sai do alerta diário e entra
//             na lista de Reconquistar; com data, vira alerta de
//             reconquista nesse dia.
//
// Vale a sinalização mais recente da loja, enquanto não for encerrada à mão
// e o cliente não pedir de novo (pedido com data depois do último pedido
// que ele tinha quando foi sinalizado). Pediu de novo: encerra sozinha.

/** Último pedido (não cancelado) de cada loja, de todo o histórico. */
function ultimoPedidoPorLoja(vendas) {
  const mapa = new Map();
  for (const v of vendas ?? []) {
    if (!v.lojaId || !v.data || v.status === "cancelado") continue;
    if (!mapa.has(v.lojaId) || v.data > mapa.get(v.lojaId)) mapa.set(v.lojaId, v.data);
  }
  return mapa;
}

/** A sinalização em vigor de cada loja (Map lojaId → sinalização). */
export function sinalizacoesAtivas(sinalizacoes, ultimoPorLoja) {
  const maisRecente = new Map();
  for (const s of sinalizacoes ?? []) {
    if (!s.lojaId) continue;
    const atual = maisRecente.get(s.lojaId);
    if (!atual || String(s.criadoEm) > String(atual.criadoEm)) maisRecente.set(s.lojaId, s);
  }
  const ativas = new Map();
  for (const [lojaId, s] of maisRecente) {
    if (s.encerradaEm) continue;
    const ultimo = ultimoPorLoja.get(lojaId);
    if (ultimo && (!s.ultimoPedido || ultimo > s.ultimoPedido)) continue; // pediu de novo
    ativas.set(lojaId, s);
  }
  return ativas;
}

/** Histórico de sinalizações de uma loja, mais recentes primeiro. */
export const historicoDeSinalizacoes = (sinalizacoes, lojaId) =>
  (sinalizacoes ?? []).filter((s) => s.lojaId === lojaId)
    .sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm)));

const PESO_ALERTA = { reconquistar: 0, lembrete: 1, atrasado: 2, hoje: 3 };

/**
 * Tudo o que a aba e o Painel precisam: a previsão de cada cliente com a
 * sinalização em vigor (`sinal`) e o alerta que ela gera (`alerta`):
 *
 *   atrasado / hoje  → o ritmo do cliente, sem sinalização;
 *   lembrete         → "me lembre" que chegou no dia;
 *   reconquistar     → "parou de pedir" que chegou no dia de reconquistar.
 *
 * Também devolve os sinalizados que ainda não chegaram no dia e a lista de
 * Reconquistar (os marcados como parou e os que pararam sozinhos, sem
 * sinalização).
 */
export function painelDePedidos(dados, hoje = hojeISO()) {
  const previsao = previsaoDosClientes(dados, hoje);
  const ultimoPorLoja = ultimoPedidoPorLoja(dados.vendas);
  const sinais = sinalizacoesAtivas(dados.sinalizacoes_clientes, ultimoPorLoja);

  // Sinalizado sem pedido nos últimos 120 dias também precisa aparecer.
  const porLoja = new Map(previsao.map((c) => [c.lojaId, c]));
  const redes = new Map((dados.redes ?? []).map((r) => [r.id, r]));
  for (const lojaId of sinais.keys()) {
    if (porLoja.has(lojaId)) continue;
    const loja = (dados.lojas ?? []).find((l) => l.id === lojaId);
    if (!loja) continue;
    const rede = redes.get(loja.redeId);
    const c = { lojaId, loja, rede, nome: rede ? `${rede.nome} · ${loja.nome}` : loja.nome, padrao: null, pedidos: 0, ultimo: ultimoPorLoja.get(lojaId) ?? null };
    porLoja.set(lojaId, c);
    previsao.push(c);
  }

  const clientes = previsao.map((c) => {
    const sinal = sinais.get(c.lojaId) ?? null;
    let alerta = null;
    if (sinal?.tipo === "lembrar") alerta = sinal.data && sinal.data <= hoje ? "lembrete" : null;
    else if (sinal?.tipo === "parou") alerta = sinal.data && sinal.data <= hoje ? "reconquistar" : null;
    else if (!sinal && c.padrao && (c.situacao === "atrasado" || c.situacao === "hoje")) alerta = c.situacao;
    return { ...c, sinal, alerta, valorTipico: c.valorTipico ?? 0, kgTipico: c.kgTipico ?? 0 };
  });

  const alertas = clientes.filter((c) => c.alerta)
    .sort((a, b) => PESO_ALERTA[a.alerta] - PESO_ALERTA[b.alerta] || b.valorTipico - a.valorTipico);
  const sinalizados = clientes.filter((c) => c.sinal && !c.alerta && c.sinal.tipo !== "parou")
    .sort((a, b) => String(a.sinal.data || "9").localeCompare(String(b.sinal.data || "9")));
  const reconquistar = clientes
    .filter((c) => c.sinal?.tipo === "parou" || (!c.sinal && c.padrao && c.situacao === "parado"))
    .sort((a, b) => b.valorTipico - a.valorTipico);

  return { clientes, alertas, sinalizados, reconquistar };
}

/** Alertas que pedem ação já (o número da barra lateral): sem os "esperados hoje". */
export const alertasUrgentes = (alertas) => alertas.filter((c) => c.alerta !== "hoje");

/**
 * Agenda prevista dos próximos `dias` dias (hoje incluído): em cada dia, as
 * lojas que devem pedir e quanto isso soma. Atrasados não entram — estão
 * nos alertas; quem já tem pedido lançado para frente segue o ritmo a partir
 * dele.
 */
export function agendaPrevista(previsao, dias = 7, hoje = hojeISO()) {
  const fim = somarDias(hoje, dias - 1);
  const agenda = new Map();
  for (let i = 0; i < dias; i++) agenda.set(somarDias(hoje, i), []);
  for (const c of previsao) {
    if (!c.padrao || c.situacao === "atrasado" || c.situacao === "parado" || c.sinal?.tipo === "parou") continue;
    let data = c.esperado;
    for (let n = 0; n < 14 && data <= fim; n++) {
      if (data >= hoje) agenda.get(data)?.push(c);
      data = proximoEsperado(data, c.cadencia, c.diasFixos);
    }
  }
  return [...agenda.entries()].map(([data, clientes]) => ({
    data,
    clientes: clientes.sort((a, b) => b.valorTipico - a.valorTipico),
    valor: clientes.reduce((s, c) => s + c.valorTipico, 0),
    kg: clientes.reduce((s, c) => s + c.kgTipico, 0),
  }));
}

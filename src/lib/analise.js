/**
 * Análise gerencial — as contas por trás dos filtros de Painel, Financeiro,
 * Despesas e Compras. Tudo é recorte de dados já carregados: período (dia a
 * dia, semana, mês, ano ou datas livres), empresa, rede, cliente, fruta,
 * produto, fornecedor e categoria. Nenhuma tabela nova, nenhuma ida ao
 * servidor — funciona offline como o resto do app.
 *
 * As regras de dinheiro são as mesmas do DRE mensal (dreMensal):
 *   - receita não conta bonificação nem venda cancelada, e sai líquida das
 *     devoluções (a nota de devolução abate o pedido que ela devolve);
 *   - mercadoria é o que foi COMPRADO no período (caixa, não CMV);
 *   - despesas, combustível e folha são sempre da Carvalho Cruz.
 */

import { hojeISO, nomeDoMes } from "./datas";
import { efeitosDasDevolucoes } from "./notas";
import { taxasDaLoja } from "./taxas";

// A CVC é a empresa do sistema: carrega despesas, combustível e folha. A
// "Carvalho Cruz" é a empresa que ainda emite a nota de parte dos produtos.
export const EMPRESA_PADRAO = "cvc";

/**
 * A empresa de cada fruta, tirada dos produtos dela. Fruta sem produto fica
 * na CVC, e a fruta só é da Carvalho Cruz se todos os produtos dela forem.
 */
export function empresaDasFrutas(produtos) {
  const mapa = new Map();
  for (const p of produtos) {
    const empresa = p.empresa ?? EMPRESA_PADRAO;
    mapa.set(p.fruta, mapa.get(p.fruta) === EMPRESA_PADRAO ? EMPRESA_PADRAO : empresa);
  }
  return mapa;
}

// ─── Datas ───────────────────────────────────────────────────────────────────

const DIA_MS = 86_400_000;
const paraMs = (iso) => {
  const [a, m, d] = String(iso).split("-").map(Number);
  return Date.UTC(a, m - 1, d);
};
const deMs = (ms) => new Date(ms).toISOString().slice(0, 10);
const somarDias = (iso, dias) => deMs(paraMs(iso) + dias * DIA_MS);

/** Segunda-feira da semana de uma data — a semana do negócio começa na segunda. */
export function inicioDaSemana(iso) {
  const diaSemana = new Date(paraMs(iso)).getUTCDay(); // 0 = domingo
  return somarDias(iso, -((diaSemana + 6) % 7));
}

/** Último dia do mês "YYYY-MM". */
const fimDoMes = (mes) => {
  const [a, m] = mes.split("-").map(Number);
  return deMs(Date.UTC(a, m, 0));
};

/** Os atalhos de período do filtro. `mes:YYYY-MM` entra à parte, um por mês com movimento. */
export const PERIODOS = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "semana", label: "Esta semana" },
  { value: "semanaPassada", label: "Semana passada" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "mes", label: "Este mês" },
  { value: "mesPassado", label: "Mês passado" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "trimestre", label: "Este trimestre" },
  { value: "ano", label: "Este ano" },
  { value: "anoPassado", label: "Ano passado" },
  { value: "tudo", label: "Todo o período" },
  { value: "personalizado", label: "Datas personalizadas…" },
];

/**
 * O intervalo {de, ate} (inclusivo, YYYY-MM-DD) de um período. `null` numa
 * ponta é "sem limite" — "Todo o período" não tem nenhuma.
 */
export function intervaloDoPeriodo(periodo, de = "", ate = "", hoje = hojeISO()) {
  const mesHoje = hoje.slice(0, 7);
  const ano = Number(hoje.slice(0, 4));
  if (periodo?.startsWith("mes:")) {
    const mes = periodo.slice(4);
    return { de: `${mes}-01`, ate: fimDoMes(mes) };
  }
  switch (periodo) {
    case "hoje": return { de: hoje, ate: hoje };
    case "ontem": { const d = somarDias(hoje, -1); return { de: d, ate: d }; }
    case "semana": return { de: inicioDaSemana(hoje), ate: hoje };
    case "semanaPassada": {
      const seg = somarDias(inicioDaSemana(hoje), -7);
      return { de: seg, ate: somarDias(seg, 6) };
    }
    case "7d": return { de: somarDias(hoje, -6), ate: hoje };
    case "mes": return { de: `${mesHoje}-01`, ate: hoje };
    case "mesPassado": {
      const ultimo = somarDias(`${mesHoje}-01`, -1);
      return { de: `${ultimo.slice(0, 7)}-01`, ate: ultimo };
    }
    case "30d": return { de: somarDias(hoje, -29), ate: hoje };
    case "90d": return { de: somarDias(hoje, -89), ate: hoje };
    case "trimestre": {
      const mesIni = Math.floor((Number(hoje.slice(5, 7)) - 1) / 3) * 3 + 1;
      return { de: `${ano}-${String(mesIni).padStart(2, "0")}-01`, ate: hoje };
    }
    case "ano": return { de: `${ano}-01-01`, ate: hoje };
    case "anoPassado": return { de: `${ano - 1}-01-01`, ate: `${ano - 1}-12-31` };
    case "personalizado": return { de: de || null, ate: ate || null };
    default: return { de: null, ate: null };
  }
}

/**
 * O período imediatamente anterior, do mesmo tamanho — para o "▲ 12% vs
 * período anterior". Sem uma das pontas não há com o que comparar.
 */
export function intervaloAnterior({ de, ate }) {
  if (!de || !ate) return null;
  const dias = Math.round((paraMs(ate) - paraMs(de)) / DIA_MS) + 1;
  return { de: somarDias(de, -dias), ate: somarDias(de, -1) };
}

export const noIntervalo = (data, { de, ate }) =>
  !!data && (!de || data >= de) && (!ate || data <= ate);

/** "01/09/2026 a 28/09/2026", "desde 01/09/2026", "todo o período". */
export function rotuloIntervalo({ de, ate }) {
  const br = (iso) => iso.split("-").reverse().join("/");
  if (de && ate) return de === ate ? br(de) : `${br(de)} a ${br(ate)}`;
  if (de) return `desde ${br(de)}`;
  if (ate) return `até ${br(ate)}`;
  return "todo o período";
}

export const AGRUPAMENTOS = [
  { value: "dia", label: "Por dia" },
  { value: "semana", label: "Por semana" },
  { value: "mes", label: "Por mês" },
  { value: "ano", label: "Por ano" },
];

/** A chave de agrupamento de uma data — ordena como texto. */
export function chaveGrupo(data, agrupar) {
  const iso = String(data || "").slice(0, 10);
  if (agrupar === "dia") return iso;
  if (agrupar === "semana") return inicioDaSemana(iso);
  if (agrupar === "ano") return iso.slice(0, 4);
  return iso.slice(0, 7);
}

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Rótulo curto, para o eixo do gráfico: "28/09", "sem 22/09", "set/2026", "2026". */
export function rotuloGrupo(chave, agrupar, longo = false) {
  if (agrupar === "dia") {
    const [a, m, d] = chave.split("-");
    if (!longo) return `${d}/${m}`;
    return `${DIAS_SEMANA[new Date(paraMs(chave)).getUTCDay()]}, ${d}/${m}/${a}`;
  }
  if (agrupar === "semana") {
    const [, m, d] = chave.split("-");
    if (!longo) return `${d}/${m}`;
    const fim = somarDias(chave, 6).split("-");
    return `Semana de ${d}/${m} a ${fim[2]}/${fim[1]}/${fim[0]}`;
  }
  if (agrupar === "ano") return chave;
  return nomeDoMes(chave);
}

/**
 * Todas as chaves entre a primeira e a última, sem buraco: um dia sem venda
 * aparece no gráfico como zero, não some — senão a curva mente sobre o ritmo.
 * Até 400 pontos; acima disso fica só o que tem movimento.
 */
export function chavesContinuas(chaves, agrupar) {
  if (chaves.length === 0) return [];
  const ordenadas = [...new Set(chaves)].sort();
  const primeira = ordenadas[0];
  const ultima = ordenadas[ordenadas.length - 1];
  const todas = [];
  let atual = primeira;
  const proxima = (k) => {
    if (agrupar === "dia") return somarDias(k, 1);
    if (agrupar === "semana") return somarDias(k, 7);
    if (agrupar === "ano") return String(Number(k) + 1);
    const [a, m] = k.split("-").map(Number);
    return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
  };
  while (atual <= ultima && todas.length <= 400) {
    todas.push(atual);
    atual = proxima(atual);
  }
  return todas.length > 400 ? ordenadas : todas;
}

// ─── Vendas item a item ──────────────────────────────────────────────────────

/**
 * Cada item vendido vira uma linha com tudo o que o filtro precisa: cliente,
 * rede, fruta, produto e empresa. Um pedido com laranja e abóbora conta a
 * laranja para a laranja e a abóbora para a abóbora — filtrar por fruta não
 * leva o pedido inteiro junto.
 */
export function itensVendidos(dados) {
  const produtoPorId = new Map(dados.produtos.map((p) => [p.id, p]));
  const redeDaLoja = new Map(dados.lojas.map((l) => [l.id, l.redeId]));
  const linhas = [];
  for (const v of dados.vendas) {
    if (v.status === "cancelado") continue;
    for (const item of v.itens ?? []) {
      const produto = produtoPorId.get(item.produtoId);
      const bonificacao = item.natureza === "bonificacao";
      linhas.push({
        vendaId: v.id,
        data: v.data,
        status: v.status,
        lojaId: v.lojaId,
        redeId: redeDaLoja.get(v.lojaId) ?? "",
        produtoId: item.produtoId,
        fruta: produto?.fruta ?? "—",
        empresa: produto?.empresa ?? EMPRESA_PADRAO,
        bonificacao,
        receita: bonificacao ? 0 : (Number(item.qty) || 0) * (Number(item.precoUnitario) || 0),
        kg: bonificacao ? 0 : Number(item.kgTotal) || 0,
        kgBonificado: bonificacao ? Number(item.kgTotal) || 0 : 0,
      });
    }
  }

  // Devolução de cliente: linha negativa na data e no cliente do pedido devolvido.
  const vendaPorId = new Map(dados.vendas.map((v) => [v.id, v]));
  for (const d of efeitosDasDevolucoes(dados)) {
    const v = vendaPorId.get(d.vendaId);
    if (!v || v.status === "cancelado") continue;
    const produto = produtoPorId.get(d.produtoId);
    linhas.push({
      vendaId: d.vendaId,
      data: d.data,
      status: v.status,
      lojaId: d.lojaId,
      redeId: redeDaLoja.get(d.lojaId) ?? "",
      produtoId: d.produtoId,
      fruta: produto?.fruta ?? "—",
      empresa: produto?.empresa ?? EMPRESA_PADRAO,
      bonificacao: false,
      devolucao: true,
      receita: -d.receita,
      kg: -d.kg,
      kgBonificado: 0,
    });
  }
  return linhas;
}

/**
 * As taxas das redes grandes (IFCO, CD, antecipação) pedido a pedido: cada
 * pedido paga as taxas do cliente — percentual sobre a receita líquida de
 * devolução, ou valor fixo por pedido. Sai como linhas com a data, o cliente
 * e a empresa do item, para o mesmo filtro dos itens vendidos valer aqui.
 */
export function taxasDosPedidos(dados, itens) {
  const lojaPorId = new Map(dados.lojas.map((l) => [l.id, l]));
  const redePorId = new Map(dados.redes.map((r) => [r.id, r]));
  const caixasPorVenda = new Map(dados.vendas.map((v) => [v.id, Number(v.caixasIfco) || 0]));
  const itensPorVenda = new Map();
  for (const i of itens) {
    if (!itensPorVenda.has(i.vendaId)) itensPorVenda.set(i.vendaId, []);
    itensPorVenda.get(i.vendaId).push(i);
  }
  const linhas = [];
  for (const [vendaId, lista] of itensPorVenda) {
    const loja = lojaPorId.get(lista[0].lojaId);
    const taxas = taxasDaLoja(redePorId.get(loja?.redeId), loja);
    if (!taxas.length) continue;
    const principal = lista.find((i) => !i.bonificacao && !i.devolucao) ?? lista[0];
    for (const t of taxas) {
      const base = { vendaId, tipo: t.tipo === "outra" ? `outra:${t.nome || "Outra"}` : t.tipo };
      if (t.modo === "por_pedido" || t.modo === "por_caixa") {
        // Por caixa: valor × caixas IFCO do pedido (pedido sem caixa não paga).
        const valor = t.modo === "por_caixa" ? t.valor * (caixasPorVenda.get(vendaId) ?? 0) : t.valor;
        if (valor > 0) linhas.push({ ...base, data: principal.data, lojaId: principal.lojaId, redeId: principal.redeId, empresa: principal.empresa, valor });
      } else {
        for (const i of lista) {
          if (i.receita) linhas.push({ ...base, data: i.data, lojaId: i.lojaId, redeId: i.redeId, empresa: i.empresa, valor: (i.receita * t.valor) / 100 });
        }
      }
    }
  }
  return linhas;
}

/** Filtra os itens vendidos pelo recorte: período, empresa, rede, cliente, fruta e produto. */
export function filtrarItens(itens, f, intervalo) {
  return itens.filter((i) =>
    noIntervalo(i.data, intervalo) &&
    (!f.empresa || i.empresa === f.empresa) &&
    (!f.rede || i.redeId === f.rede) &&
    (!f.cliente || i.lojaId === f.cliente) &&
    (!f.fruta || i.fruta === f.fruta) &&
    (!f.produto || i.produtoId === f.produto)
  );
}

/** Custo médio de compra por fruta, ponderado pelo peso — todo o histórico. */
export function custoPorFruta(compras) {
  const acc = new Map();
  for (const c of compras) {
    const l = acc.get(c.fruta) ?? { kg: 0, valor: 0 };
    l.kg += Number(c.pesoKg) || 0;
    l.valor += Number(c.total) || 0;
    acc.set(c.fruta, l);
  }
  return new Map([...acc].filter(([, l]) => l.kg > 0).map(([f, l]) => [f, l.valor / l.kg]));
}

/**
 * Soma um conjunto de itens: receita, quilos, pedidos, clientes e — quando a
 * fruta tem compra registrada — o custo estimado do que saiu (kg × custo
 * médio de compra). É a margem bruta por cliente, rede ou produto, que o DRE
 * de caixa não dá. `custoParcial` avisa quando alguma fruta não tem custo.
 */
export function somarItens(itens, custos) {
  const pedidos = new Set();
  const clientes = new Set();
  let receita = 0, kg = 0, kgBonificado = 0, kgOperacao = 0, custo = 0, custoParcial = false;
  for (const i of itens) {
    receita += i.receita;
    kg += i.kg;
    // Só o quilo da CVC carrega despesa: despesas, combustível e folha
    // são dela, não do que sai pela nota da Carvalho Cruz.
    if (i.empresa === EMPRESA_PADRAO) kgOperacao += i.kg;
    kgBonificado += i.kgBonificado;
    if (!i.bonificacao) {
      pedidos.add(i.vendaId);
      clientes.add(i.lojaId);
    }
    const c = custos.get(i.fruta);
    if (c == null) { if (i.kg > 0) custoParcial = true; }
    else custo += c * (i.kg + i.kgBonificado); // a fruta dada também custou
  }
  const margemBruta = receita - custo;
  return {
    receita, kg, kgBonificado, kgOperacao, custo, custoParcial, margemBruta,
    margemPct: receita > 0 ? (margemBruta / receita) * 100 : 0,
    pedidos: pedidos.size,
    clientes: clientes.size,
    ticketMedio: pedidos.size > 0 ? receita / pedidos.size : 0,
    precoMedio: kg > 0 ? receita / kg : 0,
  };
}

/** Agrupa itens por uma chave e soma cada grupo; ordena pela receita. */
export function agruparItens(itens, chaveDe, custos) {
  const grupos = new Map();
  for (const i of itens) {
    const k = chaveDe(i);
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(i);
  }
  return [...grupos].map(([chave, lista]) => ({ chave, ...somarItens(lista, custos) }))
    .sort((a, b) => b.receita - a.receita);
}

// ─── DRE de qualquer recorte ─────────────────────────────────────────────────

/**
 * O DRE (receita − despesas − mercadoria) de um intervalo, agrupado por dia,
 * semana, mês ou ano. É a conta de dreMensal com a régua de tempo solta.
 *
 * Quando o recorte é por cliente, rede ou produto, despesas e mercadoria não
 * têm como ser atribuídas — não entram, e `parcial` fica true para a tela
 * mostrar a margem bruta estimada no lugar do resultado. Por fruta, a
 * mercadoria é a compra daquela fruta; despesas também ficam de fora.
 */
export function dreDoRecorte(dados, f, intervalo, agrupar = "mes") {
  const empresaDaFruta = empresaDasFrutas(dados.produtos);
  const custos = custoPorFruta(dados.compras);
  const itens = filtrarItens(itensVendidos(dados), f, intervalo);
  const semDespesas = !!(f.rede || f.cliente || f.produto || f.fruta);
  const semMercadoria = !!(f.rede || f.cliente || f.produto);
  const acc = new Map();
  const linha = (k) => {
    if (!acc.has(k)) acc.set(k, { chave: k, itens: [], despesas: 0, mercadoria: 0, kgComprado: 0, taxas: 0 });
    return acc.get(k);
  };

  for (const i of itens) linha(chaveGrupo(i.data, agrupar)).itens.push(i);

  // Taxas das redes grandes: por pedido, no recorte de período, empresa, rede
  // e cliente. Com filtro de fruta ou produto ficam de fora (não são por fruta).
  const taxasPorTipo = new Map();
  let taxasDoRecorte = [];
  if (!f.fruta && !f.produto) {
    const doRecorte = taxasDosPedidos(dados, itensVendidos(dados)).filter((t) =>
      noIntervalo(t.data, intervalo) &&
      (!f.empresa || t.empresa === f.empresa) &&
      (!f.rede || t.redeId === f.rede) &&
      (!f.cliente || t.lojaId === f.cliente));
    taxasDoRecorte = doRecorte;
    for (const t of doRecorte) {
      linha(chaveGrupo(t.data, agrupar)).taxas += t.valor;
      taxasPorTipo.set(t.tipo, (taxasPorTipo.get(t.tipo) ?? 0) + t.valor);
    }
  }

  if (!semDespesas && (!f.empresa || f.empresa === EMPRESA_PADRAO)) {
    for (const lista of [dados.despesas, dados.abastecimentos, dados.pagamentos]) {
      for (const d of lista ?? []) {
        if (noIntervalo(d.data, intervalo)) linha(chaveGrupo(d.data, agrupar)).despesas += Number(d.valor) || 0;
      }
    }
  }

  // A fruta comprada no período, por fruta e por empresa: é ela, e não o
  // custo estimado, que sai da receita no resultado de cada fruta.
  const compradoPor = { fruta: new Map(), empresa: new Map() };
  if (!semMercadoria) {
    for (const c of dados.compras) {
      if (!noIntervalo(c.data, intervalo)) continue;
      if (f.fruta && c.fruta !== f.fruta) continue;
      if (f.empresa && (empresaDaFruta.get(c.fruta) ?? EMPRESA_PADRAO) !== f.empresa) continue;
      const l = linha(chaveGrupo(c.data, agrupar));
      l.mercadoria += Number(c.total) || 0;
      l.kgComprado += Number(c.pesoKg) || 0;
      const empresa = empresaDaFruta.get(c.fruta) ?? EMPRESA_PADRAO;
      compradoPor.fruta.set(c.fruta, (compradoPor.fruta.get(c.fruta) ?? 0) + (Number(c.total) || 0));
      compradoPor.empresa.set(empresa, (compradoPor.empresa.get(empresa) ?? 0) + (Number(c.total) || 0));
    }
  }

  // Custo da operação por quilo: as despesas da CVC no período
  // (despesas, combustível e folha) divididas pelos quilos que ela vendeu no
  // período. Não olha rede, cliente, fruta nem produto — é a régua da empresa
  // inteira, e é ela que dilui a despesa por qualquer recorte: cada quilo
  // vendido carrega a mesma parte do custo de rodar a distribuidora.
  let despesasOperacao = 0;
  if (!f.empresa || f.empresa === EMPRESA_PADRAO) {
    for (const lista of [dados.despesas, dados.abastecimentos, dados.pagamentos]) {
      for (const d of lista ?? []) if (noIntervalo(d.data, intervalo)) despesasOperacao += Number(d.valor) || 0;
    }
  }
  const kgOperacao = filtrarItens(itensVendidos(dados), { empresa: EMPRESA_PADRAO }, intervalo)
    .reduce((s, i) => s + i.kg, 0);
  const custoOperacaoKg = kgOperacao > 0 ? despesasOperacao / kgOperacao : 0;

  const fechar = (l) => {
    const s = somarItens(l.itens, custos);
    const resultado = s.receita - l.despesas - l.mercadoria - l.taxas;
    return {
      chave: l.chave,
      ...s,
      despesas: l.despesas,
      mercadoria: l.mercadoria,
      taxas: l.taxas,
      kgComprado: l.kgComprado,
      kgVendido: s.kg,
      resultado,
      margem: s.receita > 0 ? (resultado / s.receita) * 100 : 0,
      custoMedio: l.kgComprado > 0 ? l.mercadoria / l.kgComprado : 0,
      ...rateioOperacao(s, custoOperacaoKg, semMercadoria ? null : l.mercadoria, l.taxas),
    };
  };

  const linhas = [...acc.values()].map(fechar).sort((a, b) => a.chave.localeCompare(b.chave));
  const total = fechar({
    chave: "total",
    itens,
    despesas: linhas.reduce((s, l) => s + l.despesas, 0),
    mercadoria: linhas.reduce((s, l) => s + l.mercadoria, 0),
    kgComprado: linhas.reduce((s, l) => s + l.kgComprado, 0),
    taxas: linhas.reduce((s, l) => s + l.taxas, 0),
  });
  return { linhas, total, itens, custos, taxasPorTipo, taxasDoRecorte, custoOperacaoKg, compradoPor, semDespesas, semMercadoria, parcial: semDespesas || semMercadoria };
}

/**
 * O resultado de um grupo de vendas depois de pagar a fruta e a operação:
 * receita − fruta − kg vendido × custo da operação por kg − taxas dos clientes.
 *
 * A fruta é a COMPRADA no período (`fruta`), como na planilha — somando as
 * frutas, o resultado bate com o do painel. Rede, cliente e produto não têm
 * compra própria; aí `fruta` vem null e entra o custo estimado (kg × custo
 * médio de compra), e `frutaEstimada` avisa.
 */
export function rateioOperacao(s, custoOperacaoKg, fruta = null, taxas = 0) {
  const custoOperacao = (s.kgOperacao ?? s.kg) * custoOperacaoKg;
  const custoFruta = fruta ?? s.custo;
  const resultadoOperacional = s.receita - custoFruta - custoOperacao - taxas;
  return {
    custoOperacaoKg,
    custoOperacao,
    custoFruta,
    frutaEstimada: fruta == null,
    resultadoOperacional,
    resultadoOperacionalKg: s.kg > 0 ? resultadoOperacional / s.kg : 0,
    resultadoOperacionalPct: s.receita > 0 ? (resultadoOperacional / s.receita) * 100 : 0,
  };
}

/** Variação percentual; null quando não há base de comparação. */
export const variacao = (atual, anterior) =>
  anterior ? ((atual - anterior) / Math.abs(anterior)) * 100 : null;

/** Mesmas cores do DRE: receita verde, resultado azul, despesas laranja-avermelhado. */
export const CORES_SERIE = { receita: "#178A54", resultado: "#1E7FB8", despesas: "#E85D3D" };

export const FILTROS_PADRAO = {
  periodo: "mes", de: "", ate: "", agrupar: "dia",
  empresa: "", rede: "", cliente: "", fruta: "", produto: "", fornecedor: "", categoria: "",
};

/** "12,3%" */
export const pct = (v) => `${(Number(v) || 0).toFixed(1).replace(".", ",")}%`;

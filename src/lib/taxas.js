/**
 * Taxas e custos que as redes grandes cobram da distribuidora: caixas IFCO,
 * taxa de CD e taxa de antecipação. Cadastram-se na rede (valem para todas as
 * lojas) e, se preciso, na loja — a da loja vale no lugar da da rede para o
 * mesmo tipo. Cada taxa é um percentual da venda, um valor fixo por pedido ou
 * um valor por caixa IFCO (a quantidade de caixas é digitada no pedido).
 */

export const TIPOS_TAXA = [
  { value: "ifco", rotulo: "Caixas IFCO" },
  { value: "cd", rotulo: "Taxa CD" },
  { value: "antecipacao", rotulo: "Taxa de antecipação" },
  { value: "outra", rotulo: "Outra taxa" },
];

export const MODOS_TAXA = [
  { value: "percentual", rotulo: "% da venda" },
  { value: "por_pedido", rotulo: "R$ por pedido" },
  { value: "por_caixa", rotulo: "R$ por caixa IFCO" },
];

export const rotuloDaTaxa = (t) =>
  t.tipo === "outra" ? t.nome || "Outra taxa" : TIPOS_TAXA.find((x) => x.value === t.tipo)?.rotulo ?? t.tipo;

const chaveDaTaxa = (t) => (t.tipo === "outra" ? `outra:${(t.nome || "").trim().toLowerCase()}` : t.tipo);

/** Só as taxas bem formadas, com valor numérico não negativo. */
export function limparTaxas(lista) {
  return (Array.isArray(lista) ? lista : [])
    .map((t) => ({
      tipo: TIPOS_TAXA.some((x) => x.value === t?.tipo) ? t.tipo : "outra",
      ...(t?.tipo === "outra" && { nome: String(t.nome || "").trim() }),
      modo: ["por_pedido", "por_caixa"].includes(t?.modo) ? t.modo : "percentual",
      valor: String(t?.valor ?? "").trim() === "" ? NaN : Number(String(t.valor).replace(",", ".")),
    }))
    .filter((t) => Number.isFinite(t.valor) && t.valor >= 0);
}

/** As taxas que valem para a loja: as da rede, com as da própria loja por cima (valor 0 desliga). */
export function taxasDaLoja(rede, loja) {
  const mapa = new Map();
  for (const t of [...limparTaxas(rede?.taxas), ...limparTaxas(loja?.taxas)]) mapa.set(chaveDaTaxa(t), t);
  return [...mapa.values()].filter((t) => t.valor > 0);
}

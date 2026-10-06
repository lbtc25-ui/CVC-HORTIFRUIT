/** Data de hoje no fuso do aparelho, no formato YYYY-MM-DD usado pelos inputs. */
export function hojeISO() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** "15 de setembro de 2026" */
export function dataPorExtenso(d = new Date()) {
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
}

/** "15/09/2026" a partir de "2026-09-15" */
export const formatarData = (iso) => String(iso || "").split("-").reverse().join("/");

/**
 * Vencimento de uma venda: data do pedido + prazo em dias.
 *
 * Espelha a coluna gerada `vendas.vencimento` no Postgres, para o app calcular
 * o mesmo valor offline. A conta é feita em UTC de propósito: somar dias num
 * Date local erra por uma hora nas viradas de horário de verão, e o resultado
 * aqui é uma data de calendário, não um instante.
 */
export function vencimentoDe(dataISO, prazoDias = 0) {
  if (!dataISO) return "";
  const [ano, mes, dia] = String(dataISO).split("-").map(Number);
  if (!ano || !mes || !dia) return "";
  const ms = Date.UTC(ano, mes - 1, dia) + (Number(prazoDias) || 0) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** O dia seguinte a uma data: "2026-09-28" → "2026-09-29". Em UTC, como vencimentoDe. */
export const diaSeguinteISO = (dataISO = hojeISO()) => vencimentoDe(dataISO, 1);

/** O dia anterior a uma data: "2026-09-29" → "2026-09-28". */
export const ontemISO = (dataISO = hojeISO()) => vencimentoDe(dataISO, -1);

/** Dias de atraso de uma pendência. Negativo = ainda vai vencer. */
export function diasDeAtraso(vencimentoISO, hoje = hojeISO()) {
  if (!vencimentoISO) return 0;
  const emMs = (iso) => {
    const [a, m, d] = String(iso).split("-").map(Number);
    return Date.UTC(a, m - 1, d);
  };
  return Math.round((emMs(hoje) - emMs(vencimentoISO)) / 86_400_000);
}

/** Prazos que a distribuidora pratica, em dias. */
export const PRAZOS = [0, 7, 14, 15, 21, 28, 30];

export const rotuloPrazo = (dias) =>
  Number(dias) === 0 ? "À vista" : `${dias} dias`;

/** "2026-08" → "ago/2026". O DRE é lido por mês, não por dia. */
export function nomeDoMes(iso) {
  const [ano, mes] = String(iso || "").split("-").map(Number);
  if (!ano || !mes) return String(iso || "");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun",
                 "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[mes - 1]}/${ano}`;
}

/** "2026-09-15" → "2026-09" */
export const mesDe = (iso) => String(iso || "").slice(0, 7);

/** Rótulo do horário de uma ação: "10:00", ou "10:00–14:00 (4h)" quando há duração. */
export function rotuloHorario(hora, duracaoMin) {
  if (!hora) return "";
  if (!duracaoMin) return hora;
  const [h, m] = hora.split(":").map(Number);
  const fim = h * 60 + m + duracaoMin;
  const pad = (n) => String(n).padStart(2, "0");
  const dur = duracaoMin % 60 === 0 ? `${duracaoMin / 60}h` : duracaoMin > 60 ? `${Math.floor(duracaoMin / 60)}h${pad(duracaoMin % 60)}` : `${duracaoMin}min`;
  return `${hora}–${pad(Math.floor(fim / 60) % 24)}:${pad(fim % 60)} (${dur})`;
}

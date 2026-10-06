import { useMemo, useState } from "react";

import { Btn, Card, FiltroPills, Icon, Input, Modal } from "../components/ui";
import { EMPRESA_PADRAO, empresaDasFrutas } from "../lib/analise";
import { formatarData, hojeISO } from "../lib/datas";
import { novoId } from "../lib/mappers";
import { COLORS, brl, kg } from "../lib/tema";

/**
 * Metas da distribuidora — só o sócio master vê e define.
 *
 * Uma meta é um valor alvo para um período (diária, semanal, mensal, anual) e
 * um indicador, no geral ou de uma fruta. O realizado não é gravado: sai das
 * vendas do período, com a mesma regra do DRE — pedido cancelado e
 * bonificação ficam de fora.
 *
 * As metas são da CVC.
 */

const EMPRESAS_META = [
  { valor: "cvc", rotulo: "CVC" },
];
const EMPRESAS_REAIS = EMPRESAS_META.filter((e) => e.valor !== "consolidado").map((e) => e.valor);
const nomeEmpresa = (e) => EMPRESAS_META.find((x) => x.valor === e)?.rotulo ?? "";
const empresaDaMeta = () => EMPRESA_PADRAO;

const PERIODOS = [
  { valor: "diaria", rotulo: "Diária" },
  { valor: "semanal", rotulo: "Semanal" },
  { valor: "mensal", rotulo: "Mensal" },
  { valor: "anual", rotulo: "Anual" },
];

const quantidade = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const sacos = (v) => `${quantidade.format(Number(v) || 0)} ${Math.round(Number(v) || 0) === 1 ? "saco" : "sacos"}`;

const INDICADORES = [
  { valor: "faturamento", rotulo: "Faturamento", curto: "Faturamento", icone: "financeiro", cor: COLORS.verde, formatar: brl, unidade: "R$" },
  { valor: "kg_total", rotulo: "Kg vendidos", curto: "Kg total", icone: "estoque", cor: COLORS.azul, formatar: kg, unidade: "kg" },
  { valor: "kg_agranel", rotulo: "Kg agranel", curto: "Kg agranel", icone: "leaf", cor: COLORS.verdeClaro, formatar: kg, unidade: "kg" },
  { valor: "kg_saco", rotulo: "Kg em sacos", curto: "Kg sacos", icone: "fornecedores", cor: COLORS.laranja, formatar: kg, unidade: "kg" },
  { valor: "qtd_sacos", rotulo: "Quantidade de sacos", curto: "Sacos", icone: "vendas", cor: COLORS.laranjaEscuro, formatar: sacos, unidade: "sacos" },
];

// ─── Datas do período ───────────────────────────────────────────────────────
//
// Tudo em UTC sobre datas de calendário "YYYY-MM-DD", como vencimentoDe():
// somar dias num Date local erra por uma hora na virada do horário de verão.

const paraMs = (iso) => {
  const [a, m, d] = String(iso).split("-").map(Number);
  return Date.UTC(a, m - 1, d);
};
const deMs = (ms) => new Date(ms).toISOString().slice(0, 10);
const somarDias = (iso, dias) => deMs(paraMs(iso) + dias * 86_400_000);
const diasEntre = (ini, fim) => Math.round((paraMs(fim) - paraMs(ini)) / 86_400_000) + 1;

const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Início, fim e nome do período que contém a data de referência. A semana vai de segunda a domingo. */
function intervaloDoPeriodo(periodo, ref) {
  const [ano, mes] = ref.split("-").map(Number);
  if (periodo === "semanal") {
    const diaSemana = new Date(paraMs(ref)).getUTCDay(); // 0 = domingo
    const ini = somarDias(ref, -((diaSemana + 6) % 7));
    const fim = somarDias(ini, 6);
    return { ini, fim, rotulo: `Semana de ${formatarData(ini).slice(0, 5)} a ${formatarData(fim)}` };
  }
  if (periodo === "mensal") {
    const ini = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const fim = deMs(Date.UTC(ano, mes, 0));
    return { ini, fim, rotulo: `${NOMES_MES[mes - 1][0].toUpperCase()}${NOMES_MES[mes - 1].slice(1)} de ${ano}` };
  }
  if (periodo === "anual") {
    return { ini: `${ano}-01-01`, fim: `${ano}-12-31`, rotulo: `Ano de ${ano}` };
  }
  return { ini: ref, fim: ref, rotulo: formatarData(ref) };
}

/** A mesma data de referência, um período para frente (+1) ou para trás (−1). */
function andarPeriodo(periodo, ref, passo) {
  if (periodo === "diaria") return somarDias(ref, passo);
  if (periodo === "semanal") return somarDias(ref, 7 * passo);
  const [ano, mes] = ref.split("-").map(Number);
  // Dia 1 evita pular mês (31/jan + 1 mês não existe).
  if (periodo === "mensal") return deMs(Date.UTC(ano, mes - 1 + passo, 1));
  return `${ano + passo}-01-01`;
}

// ─── Realizado ──────────────────────────────────────────────────────────────

const chaveMeta = (empresa, periodo, indicador, fruta) => `${empresa}|${periodo}|${indicador}|${fruta || ""}`;

const zerado = () => Object.fromEntries(INDICADORES.map((i) => [i.valor, 0]));

/**
 * O que foi vendido no intervalo, no geral e por fruta, só dos produtos da
 * empresa (ou de todas, no consolidado). Item de produto que sumiu do
 * cadastro conta na Carvalho Cruz, como no DRE. Agranel é todo
 * produto que não é vendido em saco — por quilo ou por unidade. Um item cujo
 * produto sumiu do cadastro conta no faturamento e no total de quilos, mas
 * não dá para dizer de que fruta nem se era saco.
 */
function realizadoNoIntervalo(dados, ini, fim, empresa) {
  const produtos = new Map((dados.produtos ?? []).map((p) => [p.id, p]));
  const geral = zerado();
  const porFruta = new Map();

  for (const v of dados.vendas ?? []) {
    if (v.status === "cancelado" || !v.data || v.data < ini || v.data > fim) continue;
    for (const item of v.itens ?? []) {
      if (item.natureza === "bonificacao") continue;
      const produto = produtos.get(item.produtoId);
      if (empresa !== "consolidado" && (produto?.empresa ?? EMPRESA_PADRAO) !== empresa) continue;
      const receita = (Number(item.qty) || 0) * (Number(item.precoUnitario) || 0);
      const quilos = Number(item.kgTotal) || 0;
      const alvos = [geral];
      if (produto?.fruta) {
        if (!porFruta.has(produto.fruta)) porFruta.set(produto.fruta, zerado());
        alvos.push(porFruta.get(produto.fruta));
      }
      for (const a of alvos) {
        a.faturamento += receita;
        a.kg_total += quilos;
        if (!produto) continue;
        if (produto.unidadeVenda === "saco" && item.unidade !== "un") {
          a.kg_saco += quilos;
          a.qtd_sacos += Number(item.qty) || 0;
        } else {
          a.kg_agranel += quilos;
        }
      }
    }
  }
  return { geral, porFruta };
}

/** A meta vigente de cada (empresa, período, indicador, fruta): havendo repetidas, vale a mais recente. */
function metasVigentes(metas) {
  const mapa = new Map();
  for (const m of metas ?? []) {
    const chave = chaveMeta(empresaDaMeta(m), m.periodo, m.indicador, m.fruta);
    const atual = mapa.get(chave);
    if (!atual || String(m.atualizadoEm ?? "").localeCompare(String(atual.atualizadoEm ?? "")) > 0) mapa.set(chave, m);
  }
  return mapa;
}


// ─── Barra de progresso ─────────────────────────────────────────────────────

const porcento = (v) => `${v.toFixed(0)}%`;

function situacao(realizado, meta, esperado) {
  if (!meta) return null;
  if (realizado >= meta) return { texto: "Meta batida", cor: COLORS.verde, fundo: COLORS.verdePale };
  if (esperado != null && realizado >= esperado) return { texto: "No ritmo", cor: COLORS.azul, fundo: "#E3EEF5" };
  if (esperado != null) return { texto: "Abaixo do ritmo", cor: COLORS.laranjaEscuro, fundo: "#FDEBE4" };
  return null;
}

const Barra = ({ pct, cor, marca }) => (
  <div style={{ position: "relative", height: 10, borderRadius: 6, background: COLORS.cinzaClaro, overflow: "hidden" }}>
    <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", borderRadius: 6, background: cor, transition: "width 0.3s" }} />
    {marca != null && marca > 0 && marca < 100 && (
      <div title="Onde deveria estar hoje" style={{ position: "absolute", top: 0, bottom: 0, left: `${marca}%`, width: 2, background: COLORS.cinzaEscuro, opacity: 0.45 }} />
    )}
  </div>
);

const Chip = ({ s }) =>
  s ? (
    <span style={{ background: s.fundo, color: s.cor, padding: "2px 9px", borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
      {s.texto}
    </span>
  ) : null;

/** Cartão grande de um indicador do geral. */
const CartaoMeta = ({ indicador, realizado, meta, fracao }) => {
  const pct = meta > 0 ? (realizado / meta) * 100 : 0;
  const esperado = meta > 0 && fracao != null ? meta * fracao : null;
  const falta = Math.max(0, meta - realizado);
  return (
    <Card style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: indicador.cor + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name={indicador.icone} color={indicador.cor} size={17} />
          </div>
          <span style={{ fontSize: 13, color: COLORS.cinza, fontWeight: 600 }}>{indicador.rotulo}</span>
        </div>
        <Chip s={situacao(realizado, meta, esperado)} />
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.cinzaEscuro, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {indicador.formatar(realizado)}
      </div>
      {meta > 0 ? (
        <>
          <Barra pct={pct} cor={indicador.cor} marca={fracao != null ? fracao * 100 : null} />
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, color: COLORS.cinza, flexWrap: "wrap" }}>
            <span><strong style={{ color: COLORS.cinzaEscuro }}>{porcento(pct)}</strong> de {indicador.formatar(meta)}</span>
            <span>{falta > 0 ? `faltam ${indicador.formatar(falta)}` : `+${indicador.formatar(realizado - meta)}`}</span>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: COLORS.cinza }}>Sem meta definida</div>
      )}
    </Card>
  );
};

/** Linha compacta de um indicador, no cartão de uma fruta. */
const LinhaMeta = ({ indicador, realizado, meta, fracao }) => {
  const pct = meta > 0 ? (realizado / meta) * 100 : 0;
  const esperado = meta > 0 && fracao != null ? meta * fracao : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, alignItems: "baseline", flexWrap: "wrap" }}>
        <span style={{ color: COLORS.cinza }}>{indicador.curto}</span>
        <span style={{ color: COLORS.cinzaEscuro }}>
          <strong>{indicador.formatar(realizado)}</strong>
          {meta > 0 && <span style={{ color: COLORS.cinza }}> / {indicador.formatar(meta)} · {porcento(pct)}</span>}
        </span>
      </div>
      {meta > 0 && <Barra pct={pct} cor={situacao(realizado, meta, esperado)?.cor ?? indicador.cor} marca={fracao != null ? fracao * 100 : null} />}
    </div>
  );
};

// ─── Edição ─────────────────────────────────────────────────────────────────

const paraCampo = (v) => (v > 0 ? String(v).replace(".", ",") : "");
/** "1.500,50", "1500,5", "1500.5" e "1.500" viram número; vazio ou inválido vira 0. */
const doCampo = (s) => {
  let limpo = String(s ?? "").trim().replace(/\s|R\$/g, "");
  if (limpo.includes(",")) limpo = limpo.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) limpo = limpo.replace(/\./g, "");
  const n = Number(limpo);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const EditarMetas = ({ empresa, periodo, frutas, vigentes, setDados, onClose }) => {
  const rotuloPeriodo = PERIODOS.find((p) => p.valor === periodo)?.rotulo ?? "";
  const linhas = ["", ...frutas];

  const [valores, setValores] = useState(() => {
    const inicial = {};
    for (const fruta of linhas) {
      for (const ind of INDICADORES) {
        const chave = chaveMeta(empresa, periodo, ind.valor, fruta);
        inicial[chave] = paraCampo(vigentes.get(chave)?.valor ?? 0);
      }
    }
    return inicial;
  });

  const salvar = () => {
    const agora = new Date().toISOString();
    setDados((d) => {
      const desta = (m) => m.periodo === periodo && empresaDaMeta(m) === empresa;
      const doPeriodo = (d.metas ?? []).filter(desta);
      const outras = (d.metas ?? []).filter((m) => !desta(m));
      const vig = metasVigentes(doPeriodo);
      const novas = [];
      for (const fruta of linhas) {
        for (const ind of INDICADORES) {
          const chave = chaveMeta(empresa, periodo, ind.valor, fruta);
          const valor = doCampo(valores[chave]);
          if (valor <= 0) continue; // campo vazio: a meta deixa de existir
          const atual = vig.get(chave);
          novas.push(
            atual && atual.valor === valor
              ? atual
              : { ...(atual ?? { id: novoId(), criadoEm: agora }), empresa, periodo, indicador: ind.valor, fruta, valor, atualizadoEm: agora },
          );
        }
      }
      // Metas de frutas que não estão mais na lista ficam como estavam.
      const frutasListadas = new Set(linhas);
      const foraDaLista = doPeriodo.filter((m) => !frutasListadas.has(m.fruta || "") && vig.get(chaveMeta(empresa, m.periodo, m.indicador, m.fruta)) === m);
      return { ...d, metas: [...outras, ...foraDaLista, ...novas] };
    });
    onClose();
  };

  return (
    <Modal title={`Metas ${nomeEmpresa(empresa)} — ${rotuloPeriodo}`} onClose={onClose}>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: COLORS.cinza }}>
        Deixe em branco o que não tiver meta. Os valores valem para todo período {rotuloPeriodo.toLowerCase()} até serem alterados.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {linhas.map((fruta) => (
          <div key={fruta || "geral"} style={{ border: `1px solid ${COLORS.cinzaClaro}`, borderRadius: 12, padding: 14, background: fruta ? COLORS.branco : COLORS.creme }}>
            <div style={{ fontWeight: 700, color: fruta ? COLORS.cinzaEscuro : COLORS.verde, marginBottom: 10 }}>
              {fruta || `Geral — ${nomeEmpresa(empresa)}`}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
              {INDICADORES.map((ind) => {
                const chave = chaveMeta(empresa, periodo, ind.valor, fruta);
                return (
                  <Input
                    key={ind.valor}
                    label={`${ind.curto} (${ind.unidade})`}
                    inputMode="decimal"
                    placeholder="—"
                    value={valores[chave] ?? ""}
                    onChange={(e) => setValores((v) => ({ ...v, [chave]: e.target.value }))}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18, position: "sticky", bottom: 0, background: COLORS.branco, paddingTop: 10 }}>
        <Btn variant="secondary" onClick={onClose}>Cancelar</Btn>
        <Btn icon="check" onClick={salvar}>Salvar metas</Btn>
      </div>
    </Modal>
  );
};

// ─── Tela ───────────────────────────────────────────────────────────────────

const Metas = ({ dados, setDados, frutas }) => {
  const empresa = EMPRESA_PADRAO;
  const [periodo, setPeriodo] = useState("mensal");
  const [ref, setRef] = useState(hojeISO());
  const [editando, setEditando] = useState(false);

  const hoje = hojeISO();
  const { ini, fim, rotulo } = intervaloDoPeriodo(periodo, ref);
  const vigentes = useMemo(() => metasVigentes(dados.metas), [dados.metas]);
  const { geral, porFruta } = useMemo(() => realizadoNoIntervalo(dados, ini, fim, empresa), [dados, ini, fim, empresa]);
  const consolidado = empresa === "consolidado";

  // As frutas de cada empresa (a de uma fruta sai dos produtos dela); o
  // consolidado mostra todas.
  const empresaDaFruta = useMemo(() => empresaDasFrutas(dados.produtos ?? []), [dados.produtos]);
  const frutasDaEmpresa = consolidado
    ? frutas
    : frutas.filter((f) => (empresaDaFruta.get(f) ?? EMPRESA_PADRAO) === empresa || porFruta.has(f));

  // Quanto do período já passou (hoje incluído) — a marca de "onde deveria
  // estar" na barra. Só faz sentido no período em andamento e com mais de um dia.
  const emAndamento = hoje >= ini && hoje <= fim;
  const fracao = emAndamento && ini !== fim ? diasEntre(ini, hoje) / diasEntre(ini, fim) : null;

  const empresasVistas = consolidado ? EMPRESAS_REAIS : [empresa];
  const metaDe = (indicador, fruta = "") =>
    empresasVistas.reduce((s, e) => s + (vigentes.get(chaveMeta(e, periodo, indicador, fruta))?.valor ?? 0), 0);
  const temMetaNoPeriodo = [...vigentes.values()].some((m) => m.periodo === periodo && empresasVistas.includes(empresaDaMeta(m)));

  // Frutas que têm meta neste período ou venderam algo nele.
  const frutasVisiveis = frutasDaEmpresa.filter(
    (f) => porFruta.has(f) || INDICADORES.some((i) => metaDe(i.valor, f) > 0),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <FiltroPills
            opcoes={PERIODOS}
            selecionado={periodo}
            aoSelecionar={(p) => { setPeriodo(p); setRef(hoje); }}
          />
          {consolidado ? (
            <span style={{ fontSize: 12, color: COLORS.cinza }}>Soma das duas empresas — escolha uma para definir metas.</span>
          ) : (
            <Btn icon="edit" onClick={() => setEditando(true)}>Definir metas {nomeEmpresa(empresa)}</Btn>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Btn variant="secondary" onClick={() => setRef(andarPeriodo(periodo, ref, -1))} aria-label="Período anterior" style={{ padding: "8px 12px" }}>‹</Btn>
          <div style={{ fontWeight: 700, color: COLORS.cinzaEscuro, fontSize: 16, minWidth: 0 }}>{rotulo}</div>
          <Btn variant="secondary" onClick={() => setRef(andarPeriodo(periodo, ref, 1))} aria-label="Próximo período" style={{ padding: "8px 12px" }}>›</Btn>
          {!emAndamento && <Btn variant="ghost" onClick={() => setRef(hoje)} style={{ padding: "7px 14px" }}>Hoje</Btn>}
          {fracao != null && (
            <span style={{ fontSize: 12, color: COLORS.cinza, marginLeft: "auto" }}>
              {diasEntre(ini, hoje)} de {diasEntre(ini, fim)} dias ({porcento(fracao * 100)} do período)
            </span>
          )}
        </div>
      </Card>

      {!temMetaNoPeriodo && (
        <div style={{ background: "#FFF3CD", border: "1px solid #F4A26155", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#856404" }}>
          <Icon name="alert" color="#856404" size={18} />
          <span>Nenhuma meta {PERIODOS.find((p) => p.valor === periodo)?.rotulo.toLowerCase()} {consolidado ? "em nenhuma das empresas" : `para ${nomeEmpresa(empresa)}`} ainda{!consolidado && <> — toque em <strong>Definir metas</strong></>}. Abaixo, o realizado do período.</span>
        </div>
      )}

      <div>
        <h3 style={{ margin: "0 0 12px", color: COLORS.cinzaEscuro, fontSize: 16 }}>{consolidado ? "Geral — CVC" : `Geral — ${nomeEmpresa(empresa)}`}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
          {INDICADORES.map((ind) => (
            <CartaoMeta key={ind.valor} indicador={ind} realizado={geral[ind.valor]} meta={metaDe(ind.valor)} fracao={fracao} />
          ))}
        </div>
      </div>

      <div>
        <h3 style={{ margin: "0 0 12px", color: COLORS.cinzaEscuro, fontSize: 16 }}>Por fruta</h3>
        {frutasVisiveis.length === 0 ? (
          <Card style={{ padding: 18, color: COLORS.cinza, fontSize: 14 }}>Nenhuma venda nem meta por fruta neste período.</Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {frutasVisiveis.map((fruta) => {
              const real = porFruta.get(fruta) ?? zerado();
              return (
                <Card key={fruta} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ fontWeight: 700, color: COLORS.cinzaEscuro, fontSize: 15 }}>{fruta}</div>
                  {INDICADORES.map((ind) => (
                    <LinhaMeta key={ind.valor} indicador={ind} realizado={real[ind.valor]} meta={metaDe(ind.valor, fruta)} fracao={fracao} />
                  ))}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <p style={{ margin: 0, fontSize: 12, color: COLORS.cinza }}>
        Realizado = vendas do período ({formatarData(ini)}{ini !== fim ? ` a ${formatarData(fim)}` : ""}), sem pedidos cancelados e sem bonificação{consolidado ? "" : `, só dos produtos da ${nomeEmpresa(empresa)}`}.
        Agranel inclui o vendido por quilo e por unidade. A linha cinza na barra marca onde deveria estar hoje.
      </p>

      {editando && !consolidado && (
        <EditarMetas empresa={empresa} periodo={periodo} frutas={frutasDaEmpresa} vigentes={vigentes} setDados={setDados} onClose={() => setEditando(false)} />
      )}
    </div>
  );
};

export default Metas;

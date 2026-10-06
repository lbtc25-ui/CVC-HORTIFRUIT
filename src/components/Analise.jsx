/**
 * Peças da análise gerencial — a barra de filtros, o gráfico por período e a
 * tabela de ranking que Painel, Financeiro, Despesas e Compras compartilham.
 * As contas ficam em src/lib/analise.js; aqui só a tela.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { Btn, Card, Input, Select, TabelaRolavel } from "./ui";
import { AGRUPAMENTOS, PERIODOS, rotuloIntervalo } from "../lib/analise";
import { nomeDoMes } from "../lib/datas";
import { COLORS, brl } from "../lib/tema";

const Rotulo = ({ children }) => (
  <span style={{ fontSize: 11.5, fontWeight: 600, color: COLORS.cinza, textTransform: "uppercase", letterSpacing: 0.4 }}>{children}</span>
);

const Campo = ({ rotulo, children }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
    <Rotulo>{rotulo}</Rotulo>
    {children}
  </label>
);

/**
 * A barra de filtros. `campos` diz quais aparecem nesta aba — Compras não tem
 * cliente, Despesas não tem fruta. Cliente depende da rede e produto depende
 * da fruta: escolher a rede enxuga a lista de clientes.
 */
export function BarraFiltros({
  dados, filtros, setFiltros, limpar, intervalo, campos, meses = [], frutas = [], categorias = [],
}) {
  const tem = (c) => campos.includes(c);
  const mudar = (campo) => (e) => {
    const valor = e.target.value;
    setFiltros((f) => {
      const novo = { ...f, [campo]: valor };
      // Trocar a rede solta um cliente que não é dela; trocar a fruta solta o produto.
      if (campo === "rede" && valor && f.cliente) {
        const loja = dados.lojas.find((l) => l.id === f.cliente);
        if (loja?.redeId !== valor) novo.cliente = "";
      }
      if (campo === "fruta" && valor && f.produto) {
        const p = dados.produtos.find((x) => x.id === f.produto);
        if (p?.fruta !== valor) novo.produto = "";
      }
      if (campo === "periodo" && valor === "personalizado" && !f.de && !f.ate) {
        novo.de = intervalo.de ?? "";
        novo.ate = intervalo.ate ?? "";
      }
      return novo;
    });
  };

  const redes = useMemo(
    () => [...dados.redes].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [dados.redes]
  );
  const clientes = useMemo(() => {
    const nomeRede = new Map(dados.redes.map((r) => [r.id, r.nome]));
    return dados.lojas
      .filter((l) => !filtros.rede || l.redeId === filtros.rede)
      .map((l) => ({ value: l.id, label: nomeRede.get(l.redeId) ? `${nomeRede.get(l.redeId)} · ${l.nome}` : l.nome }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [dados.lojas, dados.redes, filtros.rede]);
  const produtos = useMemo(
    () => dados.produtos
      .filter((p) => (!filtros.fruta || p.fruta === filtros.fruta) && (!filtros.empresa || (p.empresa ?? "cvc") === filtros.empresa))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [dados.produtos, filtros.fruta, filtros.empresa]
  );
  const fornecedores = useMemo(
    () => [...dados.fornecedores].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [dados.fornecedores]
  );

  const ativos = ["empresa", "rede", "cliente", "fruta", "produto", "fornecedor", "categoria"]
    .filter((c) => tem(c) && filtros[c]).length;

  return (
    <Card style={{ padding: "16px 18px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, alignItems: "end" }}>
        <Campo rotulo="Período">
          <Select value={filtros.periodo} onChange={mudar("periodo")} options={[
            ...PERIODOS,
            ...meses.map((m) => ({ value: `mes:${m}`, label: `Mês: ${nomeDoMes(m)}` })),
          ]} />
        </Campo>
        {filtros.periodo === "personalizado" && (
          <>
            <Campo rotulo="De"><Input type="date" value={filtros.de} onChange={mudar("de")} /></Campo>
            <Campo rotulo="Até"><Input type="date" value={filtros.ate} onChange={mudar("ate")} /></Campo>
          </>
        )}
        {tem("agrupar") && (
          <Campo rotulo="Ver">
            <Select value={filtros.agrupar} onChange={mudar("agrupar")} options={AGRUPAMENTOS} />
          </Campo>
        )}
        {tem("rede") && (
          <Campo rotulo="Rede">
            <Select value={filtros.rede} onChange={mudar("rede")}
              options={[{ value: "", label: "Todas as redes" }, ...redes.map((r) => ({ value: r.id, label: r.nome }))]} />
          </Campo>
        )}
        {tem("cliente") && (
          <Campo rotulo="Cliente (loja)">
            <Select value={filtros.cliente} onChange={mudar("cliente")}
              options={[{ value: "", label: filtros.rede ? "Todas as lojas da rede" : "Todos os clientes" }, ...clientes]} />
          </Campo>
        )}
        {tem("fruta") && (
          <Campo rotulo="Fruta">
            <Select value={filtros.fruta} onChange={mudar("fruta")}
              options={[{ value: "", label: "Todas as frutas" }, ...frutas.map((f) => ({ value: f, label: f }))]} />
          </Campo>
        )}
        {tem("produto") && (
          <Campo rotulo="Produto">
            <Select value={filtros.produto} onChange={mudar("produto")}
              options={[{ value: "", label: "Todos os produtos" }, ...produtos.map((p) => ({ value: p.id, label: p.nome }))]} />
          </Campo>
        )}
        {tem("fornecedor") && (
          <Campo rotulo="Fornecedor">
            <Select value={filtros.fornecedor} onChange={mudar("fornecedor")}
              options={[{ value: "", label: "Todos os fornecedores" }, { value: "-", label: "Sem fornecedor" },
                ...fornecedores.map((f) => ({ value: f.id, label: f.nome }))]} />
          </Campo>
        )}
        {tem("categoria") && (
          <Campo rotulo="Categoria">
            <Select value={filtros.categoria} onChange={mudar("categoria")}
              options={[{ value: "", label: "Todas as categorias" }, ...categorias.map((c) => ({ value: c, label: c }))]} />
          </Campo>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, color: COLORS.cinza }}>
          Mostrando <strong style={{ color: COLORS.cinzaEscuro }}>{rotuloIntervalo(intervalo)}</strong>
          {ativos > 0 && <> · {ativos} {ativos === 1 ? "filtro ativo" : "filtros ativos"}</>}
        </span>
        <Btn variant="secondary" onClick={limpar} style={{ padding: "6px 12px", fontSize: 12.5 }}>Limpar filtros</Btn>
      </div>
    </Card>
  );
}

/** "▲ 12,3%" verde ou "▼ 4,0%" vermelho. `inverter` para gasto: subir é ruim. */
export function Variacao({ pct, inverter = false }) {
  if (pct == null || !Number.isFinite(pct)) return <span style={{ color: COLORS.cinza }}>sem base anterior</span>;
  const subiu = pct >= 0;
  const bom = inverter ? !subiu : subiu;
  return (
    <span style={{ color: bom ? COLORS.verde : COLORS.vermelho, fontWeight: 600 }}>
      {subiu ? "▲" : "▼"} {Math.abs(pct).toFixed(1).replace(".", ",")}%
      <span style={{ color: COLORS.cinza, fontWeight: 400 }}> vs período anterior</span>
    </span>
  );
}

/** Indicador do topo: rótulo, número, linha de apoio e a comparação com o período anterior. */
export function Indicador({ rotulo, valor, sub, pct, inverter, cor = COLORS.cinzaEscuro }) {
  return (
    <Card style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <Rotulo>{rotulo}</Rotulo>
      <div style={{ fontSize: String(valor).length > 13 ? 20 : 24, fontWeight: 700, color: cor, whiteSpace: "nowrap" }}>{valor}</div>
      {sub && <div style={{ fontSize: 12, color: COLORS.cinza }}>{sub}</div>}
      {pct !== undefined && <div style={{ fontSize: 11.5 }}><Variacao pct={pct} inverter={inverter} /></div>}
    </Card>
  );
}

function tetoEixo(maximo) {
  if (maximo <= 0) return 10;
  const grandeza = 10 ** Math.floor(Math.log10(maximo));
  const passo = grandeza / 2;
  return Math.ceil(maximo / passo) * passo;
}

/**
 * Colunas por período, uma ou mais séries lado a lado, num eixo só. Com muitos
 * pontos (90 dias, dia a dia) o gráfico rola de lado em vez de espremer as
 * barras até sumirem. Passar o mouse (ou tocar) mostra os valores do ponto.
 *
 * pontos: [{ chave, rotulo, rotuloLongo, valores: { serie: número } }]
 * series: [{ chave, rotulo, cor }]
 */
export function GraficoColunas({ pontos, series, formatar = brl, formatarEixo }) {
  const [hoverI, setHoverI] = useState(null);
  // Desenha na largura real da caixa: o texto do eixo fica do mesmo tamanho
  // num gráfico de meia tela ou de tela inteira, em vez de crescer junto.
  const caixa = useRef(null);
  const [larguraCaixa, setLarguraCaixa] = useState(640);
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return undefined;
    const medir = () => setLarguraCaixa(Math.max(280, Math.floor(el.clientWidth)));
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const fmtEixo = formatarEixo ?? ((v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v))));
  const n = pontos.length;
  const bandaMin = series.length * 10 + 10;
  const largura = Math.max(larguraCaixa, n * bandaMin + 50);
  const altura = 230;
  const margem = { topo: 14, baixo: 28, esq: 46, dir: 8 };
  const areaW = largura - margem.esq - margem.dir;
  const areaH = altura - margem.topo - margem.baixo;
  const bandaW = n > 0 ? areaW / n : areaW;
  const gap = 2;
  const barraW = Math.max(3, Math.min(28, (bandaW * 0.72 - gap * (series.length - 1)) / series.length));

  const valores = pontos.flatMap((p) => series.map((s) => p.valores[s.chave] ?? 0));
  const tetoPos = tetoEixo(Math.max(0, ...valores));
  const menor = Math.min(0, ...valores);
  const tetoNeg = menor < 0 ? -tetoEixo(-menor) : 0;
  const escala = tetoPos - tetoNeg || 1;
  const y = (v) => margem.topo + areaH - ((v - tetoNeg) / escala) * areaH;
  const ticks = tetoNeg < 0 ? [tetoNeg, 0, tetoPos] : [0, tetoPos / 2, tetoPos];
  // Rótulo do eixo X só a cada tanto, para não encavalar.
  const cadaQuantos = Math.max(1, Math.ceil(38 / bandaW));

  if (n === 0) {
    return <div ref={caixa} style={{ color: COLORS.cinza, textAlign: "center", padding: 30, fontSize: 13.5 }}>Nada no período escolhido.</div>;
  }

  const ponto = hoverI !== null ? pontos[hoverI] : null;

  return (
    <div>
      {series.length > 1 && (
        <div style={{ display: "flex", gap: 16, marginBottom: 8, flexWrap: "wrap" }}>
          {series.map((s) => (
            <span key={s.chave} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: COLORS.cinzaEscuro }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: s.cor, display: "inline-block" }} />
              {s.rotulo}
            </span>
          ))}
        </div>
      )}
      <div ref={caixa} style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <svg width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`} style={{ display: "block" }}
          onMouseLeave={() => setHoverI(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={margem.esq} x2={largura - margem.dir} y1={y(t)} y2={y(t)} stroke={COLORS.cinzaClaro} strokeWidth={t === 0 ? 1.5 : 1} />
              <text x={margem.esq - 6} y={y(t) + 3} fontSize={10} fill={COLORS.cinza} textAnchor="end">{fmtEixo(t)}</text>
            </g>
          ))}
          {pontos.map((p, i) => {
            const x0 = margem.esq + i * bandaW + (bandaW - (barraW * series.length + gap * (series.length - 1))) / 2;
            const ativo = hoverI === i;
            return (
              <g key={p.chave} onMouseEnter={() => setHoverI(i)} onClick={() => setHoverI(i)} style={{ cursor: "pointer" }}>
                <rect x={margem.esq + i * bandaW} y={margem.topo} width={bandaW} height={areaH}
                  fill={ativo ? COLORS.cinzaClaro : "transparent"} opacity={0.6} />
                {series.map((s, j) => {
                  const v = p.valores[s.chave] ?? 0;
                  const topo = Math.min(y(v), y(0));
                  const h = Math.max(v === 0 ? 0 : 1, Math.abs(y(v) - y(0)));
                  return (
                    <rect key={s.chave} x={x0 + j * (barraW + gap)} y={topo} width={barraW} height={h}
                      rx={Math.min(4, barraW / 2)} fill={s.cor} opacity={hoverI === null || ativo ? 1 : 0.55} />
                  );
                })}
                {i % cadaQuantos === 0 && (
                  <text x={margem.esq + i * bandaW + bandaW / 2} y={altura - 9} fontSize={10.5} fill={COLORS.cinza} textAnchor="middle">
                    {p.rotulo}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div style={{ marginTop: 8, background: COLORS.creme, borderRadius: 8, padding: "8px 12px", fontSize: 12.5, minHeight: 20 }}>
        {ponto ? (
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
            <strong style={{ color: COLORS.cinzaEscuro }}>{ponto.rotuloLongo ?? ponto.rotulo}</strong>
            {series.map((s) => (
              <span key={s.chave} style={{ display: "flex", alignItems: "center", gap: 5, color: COLORS.cinza }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: s.cor, display: "inline-block" }} />
                {s.rotulo}: <strong style={{ color: COLORS.cinzaEscuro }}>{formatar(ponto.valores[s.chave] ?? 0, s.chave)}</strong>
              </span>
            ))}
          </div>
        ) : (
          <span style={{ color: COLORS.cinza }}>Passe o mouse ou toque numa coluna para ver os valores.</span>
        )}
      </div>
    </div>
  );
}

/**
 * Ranking ordenável: clicar no título da coluna ordena por ela. A primeira
 * coluna numérica marcada com `participacao` ganha a barra de "% do total".
 * Mostra 10 e abre o resto num clique — a reunião vê o topo, quem quiser vê tudo.
 *
 * colunas: [{ chave, rotulo, formatar?, alinhar?, participacao? }]
 */
export function Ranking({ titulo, subtitulo, linhas, colunas, ordemInicial, acoes, vazio = "Nada no período escolhido.", limite = 10 }) {
  const [ordem, setOrdem] = useState(ordemInicial ?? colunas.find((c) => c.participacao)?.chave ?? colunas[1]?.chave);
  const [crescente, setCrescente] = useState(false);
  const [todos, setTodos] = useState(false);
  const colPart = colunas.find((c) => c.participacao);
  const totalPart = colPart ? linhas.reduce((s, l) => s + (Number(l[colPart.chave]) || 0), 0) : 0;

  const ordenadas = [...linhas].sort((a, b) => {
    const va = a[ordem], vb = b[ordem];
    const r = typeof va === "number" && typeof vb === "number"
      ? va - vb
      : String(va ?? "").localeCompare(String(vb ?? ""), "pt-BR");
    return crescente ? r : -r;
  });
  const visiveis = todos ? ordenadas : ordenadas.slice(0, limite);

  const clicar = (chave) => {
    if (ordem === chave) setCrescente((c) => !c);
    else { setOrdem(chave); setCrescente(false); }
  };

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "18px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h4 style={{ margin: 0, color: COLORS.cinzaEscuro, fontSize: 15 }}>{titulo}</h4>
          {subtitulo && <p style={{ margin: "4px 0 0", fontSize: 12.5, color: COLORS.cinza }}>{subtitulo}</p>}
        </div>
        {acoes}
      </div>
      {linhas.length === 0 ? (
        <div style={{ padding: 28, textAlign: "center", color: COLORS.cinza, fontSize: 13.5 }}>{vazio}</div>
      ) : (
        <>
          <TabelaRolavel>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: Math.max(480, colunas.length * 110) }}>
              <thead style={{ background: COLORS.cinzaClaro }}>
                <tr>
                  <th style={{ width: 34, padding: "10px 0 10px 14px", fontSize: 11, color: COLORS.cinza, textAlign: "left" }}>#</th>
                  {colunas.map((c, i) => (
                    <th key={c.chave} onClick={() => clicar(c.chave)} title="Ordenar"
                      style={{ textAlign: c.alinhar ?? (i === 0 ? "left" : "right"), fontSize: 11, color: ordem === c.chave ? COLORS.cinzaEscuro : COLORS.cinza, padding: "10px 12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}>
                      {c.rotulo}{ordem === c.chave ? (crescente ? " ↑" : " ↓") : ""}
                    </th>
                  ))}
                  {colPart && <th style={{ fontSize: 11, color: COLORS.cinza, padding: "10px 14px", textAlign: "left", textTransform: "uppercase", letterSpacing: 0.4, minWidth: 120 }}>% do total</th>}
                </tr>
              </thead>
              <tbody>
                {visiveis.map((l, idx) => {
                  const pct = colPart && totalPart > 0 ? ((Number(l[colPart.chave]) || 0) / totalPart) * 100 : 0;
                  return (
                    <tr key={l.id ?? l[colunas[0].chave]} style={{ borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
                      <td style={{ padding: "10px 0 10px 14px", fontSize: 12, color: COLORS.cinza }}>{idx + 1}</td>
                      {colunas.map((c, i) => (
                        <td key={c.chave} style={{ padding: "10px 12px", fontSize: 13, textAlign: c.alinhar ?? (i === 0 ? "left" : "right"), color: i === 0 ? COLORS.cinzaEscuro : (c.cor?.(l) ?? COLORS.cinzaEscuro), fontWeight: i === 0 || c.destaque ? 600 : 400, whiteSpace: i === 0 ? "normal" : "nowrap" }}>
                          {c.formatar ? c.formatar(l[c.chave], l) : l[c.chave]}
                        </td>
                      ))}
                      {colPart && (
                        <td style={{ padding: "10px 14px", fontSize: 12, color: COLORS.cinza, whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, background: COLORS.cinzaClaro, borderRadius: 99, height: 6, minWidth: 50 }}>
                              <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: COLORS.verdeClaro, height: 6, borderRadius: 99 }} />
                            </div>
                            {pct.toFixed(1).replace(".", ",")}%
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TabelaRolavel>
          {linhas.length > limite && (
            <div style={{ padding: "10px 20px 14px", textAlign: "center" }}>
              <button type="button" onClick={() => setTodos((t) => !t)}
                style={{ background: "none", border: "none", color: COLORS.verde, fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
                {todos ? "Mostrar só os 10 primeiros" : `Ver todos (${linhas.length})`}
              </button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

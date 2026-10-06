import { useMemo, useState } from "react";

import { Btn, Card, FiltroPills, StatCard, TabelaRolavel } from "../components/ui";
import { hojeISO } from "../lib/datas";
import { novoId } from "../lib/mappers";
import {
  RECEBEDORES, comprasDaFruta, despesasDaFruta, frutasDaPlanilha, linhasDeVenda, mudarCompra, mudarDespesa, mudarItem,
  mudarPerda, mudarVenda, novaVenda, perdasDaFruta, receitaDoItem, removerItem, resumoDaFruta, vendaTravada,
} from "../lib/planilhaFrutas";
import { COLORS, brl, kg } from "../lib/tema";

/**
 * Frutas — a aba de cada fruta da planilha, dentro do app.
 *
 * Escolhe-se a fruta e aparecem, como na planilha, as VENDAS (uma linha por
 * item), as COMPRAS, as PERDAS e as DESPESAS COM A FRUTA, com o resumo
 * financeiro em cima. Cada célula é editável: ao sair do campo, o registro de
 * verdade (venda, compra, perda, despesa) é gravado e sincroniza como qualquer
 * outro lançamento. Nada aqui é cópia.
 *
 * Pedido com NF-e emitida fica travado (🔒): o valor da nota não pode mudar.
 */

const CATEGORIAS = ["Fretes", "Outros", "Manutenção", "Diaristas", "Combustíveis", "Impostos", "Investimentos"];

const celula = { padding: "6px 8px", borderBottom: `1px solid ${COLORS.cinzaClaro}`, verticalAlign: "middle" };
const cabecalho = { ...celula, textAlign: "left", fontSize: 12, color: COLORS.cinza, fontWeight: 600, whiteSpace: "nowrap" };
const campo = {
  width: "100%", minWidth: 0, border: `1.5px solid transparent`, borderRadius: 6, padding: "6px 8px",
  fontSize: 14, background: "transparent", color: COLORS.cinzaEscuro,
};

const numero = (texto) => {
  const t = String(texto ?? "").trim().replace(/\./g, (m, i, s) => (s.includes(",") ? "" : m)).replace(",", ".");
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
};

/** Célula editável: grava ao sair do campo (ou Enter), só se o valor mudou. */
const Cel = ({ valor, aoGravar, tipo = "text", largura, alinhar, desabilitado, formatar }) => {
  const mostrado = formatar ? formatar(valor) : valor ?? "";
  const confirmar = (e) => {
    const bruto = e.target.value;
    if (bruto === String(mostrado)) return;
    if (tipo === "number") {
      const v = numero(bruto);
      if (v === null) { e.target.value = mostrado; return; }
      aoGravar(v);
    } else {
      aoGravar(bruto);
    }
  };
  return (
    <input
      key={`${valor}`} defaultValue={mostrado} disabled={desabilitado}
      inputMode={tipo === "number" ? "decimal" : undefined} type={tipo === "date" ? "date" : "text"}
      onBlur={confirmar} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      onFocus={(e) => { e.target.style.borderColor = COLORS.verdeClaro; e.target.style.background = COLORS.branco; }}
      style={{ ...campo, width: largura ?? "100%", textAlign: alinhar ?? (tipo === "number" ? "right" : "left"), opacity: desabilitado ? 0.6 : 1 }}
      onBlurCapture={(e) => { e.target.style.borderColor = "transparent"; e.target.style.background = "transparent"; }}
    />
  );
};

const Escolha = ({ valor, opcoes, aoGravar, desabilitado }) => (
  <select value={valor ?? ""} disabled={desabilitado} onChange={(e) => aoGravar(e.target.value)}
    style={{ ...campo, border: `1.5px solid ${COLORS.cinzaClaro}`, background: COLORS.branco, opacity: desabilitado ? 0.6 : 1 }}>
    {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
  </select>
);

const Lixeira = ({ aoClicar, titulo = "Remover linha", desabilitado }) => (
  <button type="button" onClick={aoClicar} title={titulo} disabled={desabilitado}
    style={{ background: "none", border: "none", cursor: desabilitado ? "not-allowed" : "pointer", color: COLORS.vermelho, fontSize: 16, opacity: desabilitado ? 0.3 : 1 }}>
    ✕
  </button>
);

const Bloco = ({ titulo, subtitulo, aoAdicionar, rotuloAdicionar, children }) => (
  <Card style={{ padding: 18 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 16, color: COLORS.cinzaEscuro }}>{titulo}</div>
        {subtitulo && <div style={{ fontSize: 12, color: COLORS.cinza }}>{subtitulo}</div>}
      </div>
      {aoAdicionar && <Btn variant="ghost" icon="plus" onClick={aoAdicionar}>{rotuloAdicionar}</Btn>}
    </div>
    <TabelaRolavel>{children}</TabelaRolavel>
  </Card>
);

const Vazio = ({ colunas, texto }) => (
  <tr><td colSpan={colunas} style={{ ...celula, color: COLORS.cinza, textAlign: "center", padding: 18 }}>{texto}</td></tr>
);

const PlanilhaFrutas = ({ dados, setDados }) => {
  const frutas = useMemo(() => frutasDaPlanilha(dados), [dados]);
  const [escolhida, setEscolhida] = useState(null);
  const fruta = escolhida && frutas.includes(escolhida) ? escolhida : frutas[0];

  const resumos = useMemo(() => frutas.map((f) => ({ fruta: f, ...resumoDaFruta(dados, f) })), [dados, frutas]);

  if (!fruta) {
    return <Card>Nenhuma fruta cadastrada ainda. Cadastre um produto em Estoque para começar.</Card>;
  }

  const r = resumoDaFruta(dados, fruta);
  const vendas = linhasDeVenda(dados, fruta);
  const compras = comprasDaFruta(dados, fruta);
  const perdas = perdasDaFruta(dados, fruta);
  const despesas = despesasDaFruta(dados, fruta);
  const produtosDaFruta = (dados.produtos ?? []).filter((p) => p.fruta === fruta);

  const lojas = [...(dados.lojas ?? [])].map((l) => {
    const rede = dados.redes?.find((x) => x.id === l.redeId);
    return { valor: l.id, rotulo: rede ? (rede.nome === l.nome ? rede.nome : `${rede.nome} · ${l.nome}`) : l.nome };
  }).sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  const fornecedores = [{ valor: "", rotulo: "—" }, ...(dados.fornecedores ?? []).map((f) => ({ valor: f.id, rotulo: f.nome }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"))];

  const aplicar = (fn) => setDados((d) => fn(d));
  const confirmar = (texto) => typeof window === "undefined" || window.confirm(texto);

  // ── Venda ─────────────────────────────────────────────────────────────────
  const adicionarVenda = () => {
    const proximo = (dados.vendas ?? []).reduce((m, v) => Math.max(m, v.numero || 0), 0) + 1;
    const ultima = vendas[vendas.length - 1];
    const lojaId = ultima?.venda.lojaId ?? lojas[0]?.valor;
    if (!lojaId || !produtosDaFruta[0]) { window.alert("Cadastre um cliente (e um produto desta fruta) antes de lançar a venda."); return; }
    const nova = novaVenda({ id: novoId(), numero: proximo, data: hojeISO(), lojaId, produto: produtosDaFruta[0], recebedor: ultima?.venda.recebedor || "carvalho_cruz", agora: new Date().toISOString() });
    aplicar((d) => ({ ...d, vendas: [...d.vendas, nova] }));
  };
  const removerVenda = (l) => {
    if (!confirmar(`Remover esta venda de ${kg(l.item.kgTotal)}?`)) return;
    aplicar((d) => removerItem(d, l.venda.id, l.indice));
  };

  // ── Compra ────────────────────────────────────────────────────────────────
  const adicionarCompra = () => {
    const ultima = compras[compras.length - 1];
    const nova = { id: novoId(), data: hojeISO(), fornecedorId: ultima?.fornecedorId ?? "", fruta, pesoKg: 0, valorKg: 0, total: 0, observacao: "", criadoEm: new Date().toISOString() };
    aplicar((d) => ({ ...d, compras: [...d.compras, nova] }));
  };
  const removerCompra = (c) => {
    if (confirmar(`Remover a compra de ${kg(c.pesoKg)} (${brl(c.total)})?`)) aplicar((d) => ({ ...d, compras: d.compras.filter((x) => x.id !== c.id) }));
  };

  // ── Perda ─────────────────────────────────────────────────────────────────
  const adicionarPerda = () => {
    const nova = { id: novoId(), data: hojeISO(), fruta, kg: 0, custoKg: r.custoMedio, valor: 0, motivo: "Perda", criadoEm: new Date().toISOString() };
    aplicar((d) => ({ ...d, perdas: [...d.perdas, nova] }));
  };
  const removerPerda = (p) => {
    if (confirmar(`Remover a perda de ${kg(p.kg)}?`)) aplicar((d) => ({ ...d, perdas: d.perdas.filter((x) => x.id !== p.id) }));
  };

  // ── Despesa ───────────────────────────────────────────────────────────────
  const adicionarDespesa = () => {
    const nova = { id: novoId(), data: hojeISO(), categoria: "Outros", descricao: "", valor: 0, fruta, criadoEm: new Date().toISOString() };
    aplicar((d) => ({ ...d, despesas: [...d.despesas, nova] }));
  };
  const removerDespesa = (x) => {
    if (confirmar(`Remover a despesa de ${brl(x.valor)}?`)) aplicar((d) => ({ ...d, despesas: d.despesas.filter((y) => y.id !== x.id) }));
  };

  const th = (texto, extra) => <th style={{ ...cabecalho, ...extra }}>{texto}</th>;
  const estoqueNegativo = r.estoque < -0.001;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, color: COLORS.cinzaEscuro }}>Frutas</h2>
        <div style={{ fontSize: 13, color: COLORS.cinza, marginTop: 2 }}>
          Como a planilha: escolha a fruta e edite direto nas células — grava ao sair do campo.
        </div>
      </div>

      <FiltroPills opcoes={frutas.map((f) => ({ valor: f, rotulo: f }))} selecionado={fruta} aoSelecionar={setEscolhida} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
        <StatCard icon="vendas" label="Venda" value={brl(r.venda)} sub={`${kg(r.kgVendido)} · recebido ${brl(r.recebido)}`} color={COLORS.verde} />
        <StatCard icon="fornecedores" label="Compra" value={brl(r.compra)} sub={`${kg(r.kgComprado)} · custo ${brl(r.custoMedio)}/kg`} color={COLORS.azul} />
        <StatCard icon="financeiro" label="Despesas da fruta" value={brl(r.despesa)} color={COLORS.laranja} />
        <StatCard icon="dashboard" label="Resultado" value={brl(r.resultado)} sub="venda − compra − despesas" color={r.resultado < 0 ? COLORS.vermelho : COLORS.verdeClaro} />
        <StatCard icon="estoque" label="Estoque" value={kg(r.estoque)} sub={estoqueNegativo ? "negativo: falta lançar compra" : `perdas ${kg(r.kgPerdido)}`} color={estoqueNegativo ? COLORS.vermelho : COLORS.verde} />
      </div>

      <Bloco titulo="Venda" subtitulo="Uma linha por item vendido. Digite o total e o preço por kg é calculado."
        aoAdicionar={adicionarVenda} rotuloAdicionar="Linha de venda">
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 940 }}>
          <thead><tr>
            {th("Status")}{th("Recebeu")}{th("Data")}{th("Cliente")}{produtosDaFruta.length > 1 && th("Produto")}
            {th("Quantidade", { textAlign: "right" })}{th("Preço", { textAlign: "right" })}{th("Total", { textAlign: "right" })}{th("kg", { textAlign: "right" })}{th("")}
          </tr></thead>
          <tbody>
            {vendas.length === 0 && <Vazio colunas={10} texto="Nenhuma venda desta fruta." />}
            {vendas.map((l) => {
              const travada = vendaTravada(l.venda);
              const v = l.venda;
              return (
                <tr key={l.chave} title={travada ? "Pedido com NF-e emitida: não dá para mudar aqui" : undefined}>
                  <td style={celula}><Escolha valor={v.status} desabilitado={travada} aoGravar={(x) => aplicar((d) => mudarVenda(d, v.id, { status: x }))}
                    opcoes={[{ valor: "pago", rotulo: "Pago" }, { valor: "pendente", rotulo: "A receber" }]} /></td>
                  <td style={celula}><Escolha valor={v.recebedor || "cvc"} desabilitado={travada} aoGravar={(x) => aplicar((d) => mudarVenda(d, v.id, { recebedor: x }))}
                    opcoes={RECEBEDORES.map((o) => ({ valor: o.valor, rotulo: o.rotulo }))} /></td>
                  <td style={celula}><Cel tipo="date" valor={v.data} desabilitado={travada} aoGravar={(x) => x && aplicar((d) => mudarVenda(d, v.id, { data: x }))} /></td>
                  <td style={celula}><Escolha valor={v.lojaId} desabilitado={travada} opcoes={lojas} aoGravar={(x) => aplicar((d) => mudarVenda(d, v.id, { lojaId: x }))} /></td>
                  {produtosDaFruta.length > 1 && (
                    <td style={celula}><Escolha valor={l.item.produtoId} desabilitado={travada} aoGravar={(x) => aplicar((d) => mudarItem(d, v.id, l.indice, { produtoId: x }))}
                      opcoes={produtosDaFruta.map((p) => ({ valor: p.id, rotulo: p.nome }))} /></td>
                  )}
                  <td style={celula}><Cel tipo="number" valor={l.item.qty} desabilitado={travada} aoGravar={(x) => aplicar((d) => mudarItem(d, v.id, l.indice, { qty: x }))} /></td>
                  <td style={celula}><Cel tipo="number" valor={Number(l.item.precoUnitario.toFixed(4))} desabilitado={travada}
                    aoGravar={(x) => aplicar((d) => mudarItem(d, v.id, l.indice, { precoUnitario: x }))} /></td>
                  <td style={celula}><Cel tipo="number" valor={Number(receitaDoItem(l.item).toFixed(2))} desabilitado={travada}
                    aoGravar={(x) => aplicar((d) => mudarItem(d, v.id, l.indice, { total: x }))} /></td>
                  <td style={{ ...celula, textAlign: "right", color: COLORS.cinza, fontSize: 13 }}>{kg(l.item.kgTotal)}</td>
                  <td style={{ ...celula, textAlign: "center" }}>{travada ? <span title="NF-e emitida">🔒</span> : <Lixeira aoClicar={() => removerVenda(l)} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Bloco>

      <Bloco titulo="Compra" subtitulo="Digite o total pago e o R$/kg é calculado."
        aoAdicionar={adicionarCompra} rotuloAdicionar="Linha de compra">
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
          <thead><tr>
            {th("Data")}{th("Fornecedor")}{th("Quantidade (kg)", { textAlign: "right" })}{th("R$/kg", { textAlign: "right" })}{th("Total", { textAlign: "right" })}{th("Observação")}{th("")}
          </tr></thead>
          <tbody>
            {compras.length === 0 && <Vazio colunas={7} texto="Nenhuma compra desta fruta." />}
            {compras.map((c) => (
              <tr key={c.id}>
                <td style={celula}><Cel tipo="date" valor={c.data} aoGravar={(x) => x && aplicar((d) => mudarCompra(d, c.id, { data: x }))} /></td>
                <td style={celula}><Escolha valor={c.fornecedorId} opcoes={fornecedores} aoGravar={(x) => aplicar((d) => mudarCompra(d, c.id, { fornecedorId: x }))} /></td>
                <td style={celula}><Cel tipo="number" valor={c.pesoKg} aoGravar={(x) => aplicar((d) => mudarCompra(d, c.id, { pesoKg: x }))} /></td>
                <td style={celula}><Cel tipo="number" valor={Number(c.valorKg.toFixed(4))} aoGravar={(x) => aplicar((d) => mudarCompra(d, c.id, { valorKg: x }))} /></td>
                <td style={celula}><Cel tipo="number" valor={Number(c.total.toFixed(2))} aoGravar={(x) => aplicar((d) => mudarCompra(d, c.id, { total: x }))} /></td>
                <td style={celula}><Cel valor={c.observacao} aoGravar={(x) => aplicar((d) => mudarCompra(d, c.id, { observacao: x }))} /></td>
                <td style={{ ...celula, textAlign: "center" }}><Lixeira aoClicar={() => removerCompra(c)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Bloco>

      <Bloco titulo="Despesas com a fruta" subtitulo="IFCO, frete, diária... só desta fruta. As despesas gerais ficam em Despesas."
        aoAdicionar={adicionarDespesa} rotuloAdicionar="Linha de despesa">
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead><tr>{th("Data")}{th("Categoria")}{th("Descrição")}{th("Valor", { textAlign: "right" })}{th("")}</tr></thead>
          <tbody>
            {despesas.length === 0 && <Vazio colunas={5} texto="Nenhuma despesa desta fruta." />}
            {despesas.map((x) => (
              <tr key={x.id}>
                <td style={celula}><Cel tipo="date" valor={x.data} aoGravar={(v) => v && aplicar((d) => mudarDespesa(d, x.id, { data: v }))} /></td>
                <td style={celula}><Escolha valor={x.categoria} opcoes={[...new Set([...CATEGORIAS, x.categoria])].map((c) => ({ valor: c, rotulo: c }))}
                  aoGravar={(v) => aplicar((d) => mudarDespesa(d, x.id, { categoria: v }))} /></td>
                <td style={celula}><Cel valor={x.descricao} aoGravar={(v) => aplicar((d) => mudarDespesa(d, x.id, { descricao: v }))} /></td>
                <td style={celula}><Cel tipo="number" valor={x.valor} aoGravar={(v) => aplicar((d) => mudarDespesa(d, x.id, { valor: v }))} /></td>
                <td style={{ ...celula, textAlign: "center" }}><Lixeira aoClicar={() => removerDespesa(x)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Bloco>

      <Bloco titulo="Perdas" subtitulo="Fruta que saiu sem venda. O custo por kg é o custo médio da compra."
        aoAdicionar={adicionarPerda} rotuloAdicionar="Linha de perda">
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
          <thead><tr>{th("Data")}{th("kg", { textAlign: "right" })}{th("R$/kg", { textAlign: "right" })}{th("Valor", { textAlign: "right" })}{th("Motivo")}{th("")}</tr></thead>
          <tbody>
            {perdas.length === 0 && <Vazio colunas={6} texto="Nenhuma perda desta fruta." />}
            {perdas.map((p) => (
              <tr key={p.id}>
                <td style={celula}><Cel tipo="date" valor={p.data} aoGravar={(x) => x && aplicar((d) => mudarPerda(d, p.id, { data: x }))} /></td>
                <td style={celula}><Cel tipo="number" valor={p.kg} aoGravar={(x) => aplicar((d) => mudarPerda(d, p.id, { kg: x }))} /></td>
                <td style={celula}><Cel tipo="number" valor={Number(p.custoKg.toFixed(4))} aoGravar={(x) => aplicar((d) => mudarPerda(d, p.id, { custoKg: x }))} /></td>
                <td style={{ ...celula, textAlign: "right", fontSize: 14 }}>{brl(p.valor)}</td>
                <td style={celula}><Cel valor={p.motivo} aoGravar={(x) => aplicar((d) => mudarPerda(d, p.id, { motivo: x }))} /></td>
                <td style={{ ...celula, textAlign: "center" }}><Lixeira aoClicar={() => removerPerda(p)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Bloco>

      <Bloco titulo="Resumo por fruta" subtitulo="Toque numa fruta para abrir a aba dela.">
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
          <thead><tr>
            {th("Fruta")}{th("Venda", { textAlign: "right" })}{th("Compra", { textAlign: "right" })}{th("Despesas", { textAlign: "right" })}
            {th("Resultado", { textAlign: "right" })}{th("Estoque", { textAlign: "right" })}
          </tr></thead>
          <tbody>
            {resumos.map((x) => (
              <tr key={x.fruta} onClick={() => { setEscolhida(x.fruta); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                style={{ cursor: "pointer", background: x.fruta === fruta ? COLORS.verdePale : "transparent" }}>
                <td style={{ ...celula, fontWeight: 600 }}>{x.fruta}</td>
                <td style={{ ...celula, textAlign: "right" }}>{brl(x.venda)}</td>
                <td style={{ ...celula, textAlign: "right" }}>{brl(x.compra)}</td>
                <td style={{ ...celula, textAlign: "right" }}>{brl(x.despesa)}</td>
                <td style={{ ...celula, textAlign: "right", color: x.resultado < 0 ? COLORS.vermelho : COLORS.verde, fontWeight: 600 }}>{brl(x.resultado)}</td>
                <td style={{ ...celula, textAlign: "right", color: x.estoque < -0.001 ? COLORS.vermelho : COLORS.cinzaEscuro }}>{kg(x.estoque)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Bloco>
    </div>
  );
};

export default PlanilhaFrutas;

import { useMemo, useState } from "react";

import { Btn, Card, Icon, Select, StatCard, TabelaRolavel } from "../components/ui";
import { formatarData, nomeDoMes } from "../lib/datas";
import { MOTIVO_AUTOMATICO, baixarPdfCartaCorrecao, lerConferidas, marcarConferida } from "../lib/cce";
import { exportarXlsx } from "../lib/exportar";
import { nomeDoCliente, valorDevolvido } from "../lib/notas";
import { pedidosDaNotaConsolidada, valorConsolidadoDaNota } from "../lib/notaSemanal";
import { notasEmitidasDoApp } from "../lib/sped/coletar";
import { novoId } from "../lib/mappers";
import CartaCorrecaoModal from "../components/CartaCorrecaoModal";
import { corrigirCodigosDaNota, enviarCartaCorrecaoLivre, precisaConferirCce, danfeUrlSpedy, recuperarCanceladasSpedy, xmlUrlSpedy, obterDadosCancelamentoSpedy } from "../lib/spedy";
import { COLORS, brl } from "../lib/tema";
import Devolucoes, { EmitirDevolucaoModal } from "./Devolucoes";
import ArquivosFiscais from "./ArquivosFiscais";
import NotasRecebidas from "./NotasRecebidas";

/**
 * Notas Fiscais — três abas:
 *   Emitidas     as NF-e de venda emitidas pelo app (este arquivo);
 *   Recebidas    as NF-e emitidas contra o CNPJ da empresa, trazidas direto
 *                da SEFAZ com o certificado A1, onde se dá entrada nelas
 *                (NotasRecebidas.jsx);
 *   Devoluções   devoluções de cliente, com nota do cliente ou nota de
 *                entrada emitida por nós (Devolucoes.jsx).
 *
 * Emitidas — o registro das NF-e emitidas pelo app.
 *
 * A Spedy não mostra no painel dela as notas emitidas pela API (confirmado
 * pelo suporte), então é aqui que se consulta, baixa o DANFE e o XML, e se
 * junta o mês para o contador. A empresa precisa guardar o XML de cada nota
 * por 5 anos.
 *
 * A fonte é a própria venda: cada venda guarda o número, a série, a chave e
 * o id da nota na Spedy (colunas nfe_* de vendas). Pedido apagado com NF-e
 * cancelada deixa a nota em nfe_arquivadas (mesmos campos): ela continua
 * aqui, para o SPED Fiscal e o XML, sem voltar a contar como venda.
 */

const STATUS = {
  autorizada: { rotulo: "Autorizada", bg: "#D8F3DC", cor: "#2D6A4F" },
  cancelada: { rotulo: "Cancelada", bg: "#ECEFF1", cor: "#546E7A" },
  rejeitada: { rotulo: "Recusada", bg: "#FFEBEE", cor: "#C62828" },
  processando: { rotulo: "Processando", bg: "#FFF3CD", cor: "#856404" },
};

const ChipStatus = ({ status }) => {
  const s = STATUS[status] ?? { rotulo: status, bg: COLORS.cinzaClaro, cor: COLORS.cinzaEscuro };
  return (
    <span style={{ background: s.bg, color: s.cor, padding: "3px 9px", borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
      {s.rotulo}
    </span>
  );
};

/** Mês da nota: o da emissão; nota antiga sem data de emissão usa a da venda. */
const mesDaNota = (v) => String(v.nfeEmitidaEm || v.data || "").slice(0, 7);

const dataDaNota = (v) =>
  v.nfeEmitidaEm ? new Date(v.nfeEmitidaEm).toLocaleDateString("pt-BR") : formatarData(v.data);

const nomeArquivo = (v) => `NFe-${v.nfeSerie ?? 0}-${String(v.nfeNumero ?? "").padStart(6, "0")}${v.nfeStatus === "cancelada" ? "-cancelada" : ""}`;

const SEM_NOTAS = [];

/** Cliente da nota; a de pedido apagado guarda o nome caso a loja também tenha sumido. */
const clienteDaNota = (dados, v) => {
  const nome = nomeDoCliente(dados, v.lojaId);
  return nome === "—" && v.clienteNome ? v.clienteNome : nome;
};

/** Pedido da nota arquivada: o apagado, ou a recuperada da Spedy (às vezes sem número de pedido). */
const rotuloArquivada = (v) => v.origem === "spedy"
  ? `${v.numero ? `pedido #${v.numero} · ` : ""}recuperada da Spedy`
  : `pedido #${v.numero ?? "—"} · apagado`;

// Notas com o id interno do produto no código (cProd) ou saco só como
// "Saco 10 kg" — ver corrigirCodigosDaNota em lib/spedy.js. Nota de pedido
// apagado fica de fora: a CC-e é gravada na venda.
const podeCorrigirCodigo = (v) => !v.pedidoApagado
  && precisaConferirCce({ status: v.nfeStatus, spedyId: v.spedyId, emitidaEm: v.nfeEmitidaEm || v.data, cceEm: v.nfeCceEm });

const Emitidas = ({ dados, setDados }) => {
  const notasEntrada = dados.notas_entrada ?? SEM_NOTAS;
  const [devolvendo, setDevolvendo] = useState(null);
  const [mes, setMes] = useState("");
  const [status, setStatus] = useState("todas");
  const [baixando, setBaixando] = useState(null); // { feito, total } durante o .zip
  const [copiada, setCopiada] = useState(null);
  const [corrigindo, setCorrigindo] = useState(null); // { feito, total } na correção em lote
  const [semErro, setSemErro] = useState(lerConferidas); // conferidas: XML já estava certo
  const produtosPorId = useMemo(() => Object.fromEntries(dados.produtos.map((p) => [p.id, p])), [dados.produtos]);

  /** Toda venda que chegou a ter nota, mais as de pedido apagado (ver notasEmitidasDoApp). */
  const notas = useMemo(() => notasEmitidasDoApp(dados), [dados]);

  const meses = useMemo(() => [...new Set(notas.map(mesDaNota).filter(Boolean))].sort().reverse(), [notas]);
  const mesAtivo = mes || meses[0] || "";

  const doMes = notas.filter((v) => !mesAtivo || mesDaNota(v) === mesAtivo);
  const visiveis = doMes.filter((v) => status === "todas" || v.nfeStatus === status);

  const autorizadas = doMes.filter((v) => v.nfeStatus === "autorizada");
  const canceladas = doMes.filter((v) => v.nfeStatus === "cancelada");
  const recusadas = doMes.filter((v) => v.nfeStatus === "rejeitada");
  const comArquivo = visiveis.filter((v) => v.spedyId && (v.nfeStatus === "autorizada" || v.nfeStatus === "cancelada"));

  const aCorrigir = notas.filter((v) => podeCorrigirCodigo(v) && !semErro.has(v.id));

  /** Envia a CC-e de uma nota e grava na venda. Devolve o texto, ou null se o XML já estava certo. */
  const enviarCce = async (v) => {
    const r = await corrigirCodigosDaNota({ spedyId: v.spedyId, produtosPorId, jaCorrigiuCodigo: !!v.nfeCceEm });
    if (r.semErro) {
      setSemErro(marcarConferida(v.id));
      return null;
    }
    const campos = { nfeCceEm: new Date().toISOString(), nfeCceTexto: r.texto };
    setDados((d) => ({ ...d, vendas: d.vendas.map((x) => (x.id === v.id ? { ...x, ...campos } : x)) }));
    return r.texto;
  };

  const [cceDa, setCceDa] = useState(null); // nota aberta na janela da carta de correção

  /** Envia a CC-e escolhida na janela: automática (código/descrição) ou com o motivo digitado. */
  const enviarCceDaJanela = async ({ motivo, detalhe }) => {
    const v = cceDa;
    let texto;
    if (motivo === MOTIVO_AUTOMATICO) {
      texto = await enviarCce(v);
      if (!texto) {
        setCceDa(null);
        alert("Esta nota já está com código e descrição certos — nada a corrigir.");
        return;
      }
    } else {
      ({ texto } = await enviarCartaCorrecaoLivre({ spedyId: v.spedyId, motivo, detalhe }));
      const campos = { nfeCceEm: new Date().toISOString(), nfeCceTexto: texto };
      setDados((d) => ({ ...d, vendas: d.vendas.map((x) => (x.id === v.id ? { ...x, ...campos } : x)) }));
    }
    setCceDa(null);
    alert(`Carta de correção enviada:\n\n${texto}`);
  };

  const corrigirTodas = async () => {
    const lista = aCorrigir;
    if (!lista.length) return;
    if (!confirm(`Enviar carta de correção do código e da descrição dos produtos para ${lista.length} nota(s) autorizada(s)?\n\nUma por uma; as que já estiverem certas são puladas.`)) return;
    const enviadas = [], certas = [], falhas = [];
    for (let i = 0; i < lista.length; i++) {
      const v = lista[i];
      setCorrigindo({ feito: i, total: lista.length });
      try {
        (await enviarCce(v)) ? enviadas.push(v) : certas.push(v);
      } catch (e) {
        falhas.push(`NF ${v.nfeNumero ?? "?"}: ${e.message}`);
      }
    }
    setCorrigindo(null);
    alert([
      `Cartas de correção enviadas: ${enviadas.length}`,
      certas.length ? `Já estavam certas: ${certas.length}` : "",
      falhas.length ? `Falharam (${falhas.length}):\n• ${falhas.join("\n• ")}` : "",
    ].filter(Boolean).join("\n\n"));
  };

  /**
   * Traz de volta as NF-e canceladas que sumiram com pedidos apagados antes
   * do arquivo (migracao-52): a Spedy ainda tem todas.
   */
  const [recuperando, setRecuperando] = useState(null); // { feito, total }
  const recuperarDaSpedy = async () => {
    if (!confirm("Buscar na Spedy as NF-e canceladas que sumiram daqui (pedidos apagados) e trazê-las de volta para esta relação?\n\nNão cria venda nenhuma — só a nota, para o SPED e o XML.")) return;
    const conhecidos = new Set([
      ...dados.vendas.map((v) => v.spedyId),
      ...(dados.nfe_arquivadas ?? []).map((n) => n.spedyId),
      ...notasEntrada.map((n) => n.spedyId),
    ].filter(Boolean));
    setRecuperando({ feito: 0, total: 0 });
    try {
      const { recuperadas, falhas, total } = await recuperarCanceladasSpedy({
        conhecidos,
        vendasPorId: new Map(dados.vendas.map((v) => [v.id, v])),
        aoProgredir: (feito, t) => setRecuperando({ feito, total: t }),
      });
      if (recuperadas.length) {
        const agora = new Date().toISOString();
        const novas = recuperadas.map((n) => ({ ...n, id: novoId(), pedidoApagadoEm: agora }));
        setDados((d) => ({ ...d, nfe_arquivadas: [...(d.nfe_arquivadas ?? []), ...novas] }));
      }
      alert([
        `Notas na Spedy: ${total}`,
        recuperadas.length
          ? `Canceladas recuperadas: ${recuperadas.length} (NF ${recuperadas.map((n) => n.nfeNumero ?? "?").join(", ")})`
          : "Nenhuma NF-e cancelada faltando aqui.",
        falhas.length ? `Não deu para ler (${falhas.length}):\n• ${falhas.join("\n• ")}` : "",
      ].filter(Boolean).join("\n\n"));
    } catch (e) {
      alert(`Não foi possível consultar a Spedy:\n${e.message}`);
    } finally {
      setRecuperando(null);
    }
  };

  const copiarChave = async (chave) => {
    try {
      await navigator.clipboard.writeText(chave);
      setCopiada(chave);
      setTimeout(() => setCopiada(null), 1500);
    } catch {
      prompt("Copie a chave de acesso:", chave);
    }
  };

  /** "#12" ou, numa nota semanal com mais de um pedido, "#12, #15, #19". */
  const pedidosDaNota = (v) => pedidosDaNotaConsolidada(dados, v).map((p) => `#${p.numero ?? "—"}`).join(", ");

  const linhasPlanilha = visiveis.map((v) => ({
    numero: v.nfeNumero ?? "",
    serie: v.nfeSerie ?? "",
    emissao: dataDaNota(v),
    cliente: clienteDaNota(dados, v),
    cnpj: dados.lojas.find((l) => l.id === v.lojaId)?.cnpjCpf ?? v.clienteCnpj ?? "",
    valor: valorConsolidadoDaNota(dados, v),
    status: STATUS[v.nfeStatus]?.rotulo ?? v.nfeStatus,
    chave: v.nfeChave ?? "",
    pedido: v.pedidoApagado ? rotuloArquivada(v) : pedidosDaNota(v),
    observacao: v.nfeStatus === "cancelada" ? v.nfeMotivoCancelamento : v.nfeStatus === "rejeitada" ? v.nfeErro : "",
  }));

  const exportarPlanilha = () =>
    exportarXlsx(`notas-fiscais-${mesAtivo || "todas"}`, [{
      nome: "Notas fiscais",
      colunas: [
        { chave: "numero", rotulo: "Número" },
        { chave: "serie", rotulo: "Série" },
        { chave: "emissao", rotulo: "Emissão" },
        { chave: "cliente", rotulo: "Cliente" },
        { chave: "cnpj", rotulo: "CNPJ/CPF" },
        { chave: "valor", rotulo: "Valor (R$)" },
        { chave: "status", rotulo: "Situação" },
        { chave: "chave", rotulo: "Chave de acesso" },
        { chave: "pedido", rotulo: "Pedido" },
        { chave: "observacao", rotulo: "Motivo (cancelamento/recusa)" },
      ],
      linhas: linhasPlanilha,
    }]).catch((e) => alert(`Não foi possível gerar a planilha: ${e?.message ?? e}`));

  /**
   * Um .zip com o XML de cada nota do filtro — o que o contador pede todo
   * mês. Baixa um por um pela Spedy (via /api/spedy); se algum falhar, o
   * zip sai com os que vieram e um aviso lista os que faltaram.
   */
  const baixarXmls = async () => {
    if (!comArquivo.length) return;
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    const falhas = [];
    const linhasCancelamento = [];
    for (let i = 0; i < comArquivo.length; i++) {
      const v = comArquivo[i];
      setBaixando({ feito: i, total: comArquivo.length });
      try {
        const resp = await fetch(xmlUrlSpedy(v.spedyId));
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        zip.file(`${nomeArquivo(v)}.xml`, await resp.text());
        if (v.nfeStatus === "cancelada") {
          const c = await obterDadosCancelamentoSpedy(v.spedyId).catch(() => null);
          linhasCancelamento.push(`NF ${v.nfeNumero ?? "?"} | chave ${v.nfeChave || "—"} | protocolo ${c?.protocolo || "—"} | data ${c?.data || "—"} | motivo ${c?.justificativa || v.nfeMotivoCancelamento || "—"}`);
        }
      } catch (e) {
        falhas.push(`NF ${v.nfeNumero ?? "?"} (${e.message})`);
      }
    }
    setBaixando(null);
    if (falhas.length === comArquivo.length) {
      alert(`Não foi possível baixar nenhum XML:\n• ${falhas.join("\n• ")}`);
      return;
    }
    if (linhasCancelamento.length) {
      zip.file("cancelamentos.txt", "Notas canceladas deste ZIP (protocolo de cancelamento informado pela Spedy).\n"
        + "O XML do evento de cancelamento não é fornecido pela API da Spedy: baixe pelo portal da Spedy ou da SEFAZ.\n\n"
        + linhasCancelamento.join("\n") + "\n");
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `xml-nfe-${mesAtivo || "todas"}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    if (falhas.length) alert(`O .zip saiu sem ${falhas.length} XML(s):\n• ${falhas.join("\n• ")}`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 180 }}>
            <Select label="Mês" value={mesAtivo} onChange={(e) => setMes(e.target.value)}
              options={meses.length ? meses.map((m) => ({ value: m, label: nomeDoMes(`${m}-01`) })) : [{ value: "", label: "—" }]} />
          </div>
          <div style={{ minWidth: 160 }}>
            <Select label="Situação" value={status} onChange={(e) => setStatus(e.target.value)}
              options={[
                { value: "todas", label: "Todas" },
                { value: "autorizada", label: "Autorizadas" },
                { value: "cancelada", label: "Canceladas" },
                { value: "rejeitada", label: "Recusadas" },
              ]} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {aCorrigir.length > 0 && (
            <Btn variant="ghost" onClick={corrigirTodas} disabled={!!corrigindo}>
              {corrigindo ? `Corrigindo ${corrigindo.feito + 1} de ${corrigindo.total}...` : `Carta de correção (código/descrição) · ${aCorrigir.length}`}
            </Btn>
          )}
          <Btn variant="ghost" onClick={recuperarDaSpedy} disabled={!!recuperando}
            title="Traz de volta as NF-e canceladas de pedidos que foram apagados">
            {recuperando ? (recuperando.total ? `Recuperando ${recuperando.feito + 1} de ${recuperando.total}...` : "Consultando a Spedy...") : "Recuperar canceladas da Spedy"}
          </Btn>
          <Btn variant="ghost" onClick={exportarPlanilha} disabled={!visiveis.length}>Exportar .xlsx</Btn>
          <Btn onClick={baixarXmls} disabled={!comArquivo.length || !!baixando}>
            {baixando ? `Baixando XML ${baixando.feito + 1} de ${baixando.total}...` : `Baixar XMLs (.zip) · ${comArquivo.length}`}
          </Btn>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <StatCard icon="check" label="Autorizadas" value={autorizadas.length}
          sub={brl(autorizadas.reduce((s, v) => s + valorConsolidadoDaNota(dados, v), 0))} color={COLORS.verde} />
        <StatCard icon="close" label="Canceladas" value={canceladas.length}
          sub={brl(canceladas.reduce((s, v) => s + valorConsolidadoDaNota(dados, v), 0))} color={COLORS.cinza} />
        <StatCard icon="alert" label="Recusadas" value={recusadas.length}
          sub={recusadas.length ? "tente de novo em Vendas" : "nenhuma"} color={recusadas.length ? COLORS.vermelho : COLORS.cinza} />
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {visiveis.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: COLORS.cinza }}>
            {notas.length ? "Nenhuma nota com esse filtro." : "Nenhuma NF-e emitida ainda. As notas aparecem aqui ao emitir pela tela de Vendas."}
          </div>
        ) : (
          <TabelaRolavel>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
              <thead style={{ background: COLORS.cinzaClaro }}>
                <tr>
                  {["NF", "Emissão", "Cliente", "Valor", "Situação", "Chave de acesso", "Arquivos"].map((h) => (
                    <th key={h} style={{ textAlign: "left", fontSize: 12, color: COLORS.cinza, padding: "12px 14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visiveis.map((v) => {
                  const temArquivo = v.spedyId && (v.nfeStatus === "autorizada" || v.nfeStatus === "cancelada");
                  const motivo = v.nfeStatus === "cancelada" ? v.nfeMotivoCancelamento : v.nfeStatus === "rejeitada" ? v.nfeErro : "";
                  return (
                    <tr key={v.id} style={{ borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: COLORS.cinzaEscuro, whiteSpace: "nowrap" }}>
                        {v.nfeNumero ? `${v.nfeNumero}` : "—"}
                        {v.nfeSerie != null && <span style={{ fontWeight: 400, color: COLORS.cinza, fontSize: 12 }}> · série {v.nfeSerie}</span>}
                        <div style={{ fontWeight: 400, color: COLORS.cinza, fontSize: 11 }}>
                          {v.pedidoApagado ? rotuloArquivada(v)
                            : pedidosDaNotaConsolidada(dados, v).length > 1 ? `pedidos ${pedidosDaNota(v)}` : `pedido #${v.numero ?? "—"}`}
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 13, color: COLORS.cinzaEscuro, whiteSpace: "nowrap" }}>{dataDaNota(v)}</td>
                      <td style={{ padding: "12px 14px", fontSize: 13, color: COLORS.cinzaEscuro }}>{clienteDaNota(dados, v)}</td>
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: v.nfeStatus === "autorizada" ? COLORS.verde : COLORS.cinza, whiteSpace: "nowrap" }}>{brl(valorConsolidadoDaNota(dados, v))}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <ChipStatus status={v.nfeStatus} />
                        {v.nfeCceEm && (
                          <div style={{ fontSize: 11, color: COLORS.verde, marginTop: 4 }} title={v.nfeCceTexto}>
                            CC-e enviada {new Date(v.nfeCceEm).toLocaleDateString("pt-BR")}
                          </div>
                        )}
                        {motivo && <div style={{ fontSize: 11, color: COLORS.cinza, marginTop: 4, maxWidth: 220 }} title={motivo}>{motivo.length > 70 ? `${motivo.slice(0, 70)}…` : motivo}</div>}
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 11, color: COLORS.cinza, fontFamily: "monospace" }}>
                        {v.nfeChave ? (
                          <button onClick={() => copiarChave(v.nfeChave)} title="Copiar chave"
                            style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: COLORS.cinza, fontFamily: "monospace", fontSize: 11, textAlign: "left", wordBreak: "break-all", maxWidth: 190 }}>
                            {copiada === v.nfeChave ? "✓ copiada" : v.nfeChave}
                          </button>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        {temArquivo ? (
                          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <a href={danfeUrlSpedy(v.spedyId)} target="_blank" rel="noreferrer" style={{ color: COLORS.verde, fontWeight: 600, fontSize: 13, textDecoration: "none" }}>DANFE</a>
                            <a href={xmlUrlSpedy(v.spedyId)} download={`${nomeArquivo(v)}.xml`} style={{ color: COLORS.verde, fontWeight: 600, fontSize: 13, textDecoration: "none" }}>XML</a>
                            {v.nfeCceEm && v.nfeCceTexto && (
                              <button title="PDF da carta de correção, para mandar ao cliente"
                                onClick={() => baixarPdfCartaCorrecao({ spedyId: v.spedyId, texto: v.nfeCceTexto, enviadaEm: v.nfeCceEm, cliente: clienteDaNota(dados, v) })
                                  .catch((e) => alert(`Não foi possível gerar o PDF da CC-e:\n${e.message}`))}
                                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: COLORS.verde, fontWeight: 600, fontSize: 13 }}>
                                CC-e
                              </button>
                            )}
                            {v.nfeStatus === "autorizada" && (
                              <button onClick={() => setCceDa(v)} disabled={!!corrigindo}
                                title="Enviar carta de correção, escolhendo o motivo"
                                style={{ background: "#E3F2FD", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer", color: "#1565C0", fontSize: 12, fontWeight: 600 }}>
                                Carta de correção
                              </button>
                            )}
                            {v.nfeStatus === "autorizada" && v.nfeChave && (
                              <button onClick={() => setDevolvendo(v)} title="Emitir nota de devolução desta venda"
                                style={{ background: "#FFF3E0", border: "none", borderRadius: 6, padding: "3px 8px", cursor: "pointer", color: COLORS.laranjaEscuro, fontSize: 12, fontWeight: 600 }}>
                                Devolução
                              </button>
                            )}
                          </div>
                        ) : <span style={{ color: COLORS.cinza, fontSize: 12 }}>—</span>}
                        {valorDevolvido(notasEntrada, v.id) > 0 && (
                          <div style={{ fontSize: 11, color: COLORS.laranjaEscuro, marginTop: 4 }}>devolvido {brl(valorDevolvido(notasEntrada, v.id))}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TabelaRolavel>
        )}
      </Card>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: COLORS.cinza, lineHeight: 1.5 }}>
        <Icon name="alert" size={15} color={COLORS.cinza} />
        <span>
          A Spedy não mostra no painel dela as notas emitidas pelo app — o registro oficial é este. Guarde os XMLs
          (a lei pede 5 anos): todo mês, baixe o .zip e envie ao contador junto com a planilha.
        </span>
      </div>

      {cceDa && (
        <CartaCorrecaoModal titulo={`NF ${cceDa.nfeNumero ?? ""}`} jaTemCce={!!cceDa.nfeCceEm}
          onEnviar={enviarCceDaJanela} onClose={() => setCceDa(null)} />
      )}
      {devolvendo && (
        <EmitirDevolucaoModal dados={dados} setDados={setDados} vendaInicial={devolvendo} onClose={() => setDevolvendo(null)} />
      )}
    </div>
  );
};

const ABAS = [
  { id: "emitidas", rotulo: "Emitidas" },
  { id: "recebidas", rotulo: "Recebidas" },
  { id: "devolucoes", rotulo: "Devoluções" },
  { id: "arquivos", rotulo: "Arquivos fiscais" },
];

const NotasFiscais = ({ dados, setDados, frutas, podeApagar }) => {
  const [aba, setAba] = useState("emitidas");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div role="tablist" style={{ display: "flex", gap: 6, background: COLORS.cinzaClaro, padding: 4, borderRadius: 10, alignSelf: "flex-start", flexWrap: "wrap" }}>
        {ABAS.map((a) => (
          <button key={a.id} role="tab" aria-selected={aba === a.id} onClick={() => setAba(a.id)}
            style={{
              background: aba === a.id ? COLORS.branco : "transparent", border: "none", borderRadius: 8,
              padding: "8px 16px", cursor: "pointer", fontSize: 14, fontWeight: 600,
              color: aba === a.id ? COLORS.verde : COLORS.cinzaEscuro,
              boxShadow: aba === a.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}>
            {a.rotulo}
          </button>
        ))}
      </div>
      {aba === "emitidas" && <Emitidas dados={dados} setDados={setDados} />}
      {aba === "recebidas" && <NotasRecebidas dados={dados} setDados={setDados} frutas={frutas} />}
      {aba === "devolucoes" && <Devolucoes dados={dados} setDados={setDados} podeApagar={podeApagar} />}
      {aba === "arquivos" && <ArquivosFiscais dados={dados} />}
    </div>
  );
};

export default NotasFiscais;

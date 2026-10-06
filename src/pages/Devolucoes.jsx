import { useMemo, useState } from "react";

import { Btn, Card, Icon, Input, Modal, Select, StatCard, TabelaRolavel } from "../components/ui";
import { formatarData, nomeDoMes } from "../lib/datas";
import { novoId } from "../lib/mappers";
import { devolvidoPorItem, nomeDoCliente } from "../lib/notas";
import {
  camposDaNotaAutorizada,
  cancelarNfeDaVenda,
  consultarNotaSpedy,
  corrigirCodigosDaNota,
  enviarCartaCorrecaoLivre,
  danfeUrlSpedy,
  emitirNotaDevolucao,
  xmlUrlSpedy,
} from "../lib/spedy";
import CartaCorrecaoModal from "../components/CartaCorrecaoModal";
import { MOTIVO_AUTOMATICO, baixarPdfCartaCorrecao, lerConferidas, marcarConferida } from "../lib/cce";
import { abrirEspelhoRecebida, baixarXmlRecebida } from "../lib/sefaz";
import { COLORS, brl } from "../lib/tema";

/**
 * Devoluções de cliente — as duas formas de uma devolução ter nota:
 *
 *   - O cliente emite a nota de devolução dele contra o nosso CNPJ (o normal
 *     quando ele tem inscrição estadual). Ela chega em Recebidas, e ao "dar
 *     entrada" como devolução fica ligada à venda e aparece aqui.
 *   - A distribuidora emite uma NF-e de entrada de devolução (quando o
 *     cliente não emite — sem IE, produtor, pessoa física — ou por
 *     orientação do contador), referenciando a nota da venda.
 */

const STATUS = {
  autorizada: { rotulo: "Autorizada", bg: "#D8F3DC", cor: "#2D6A4F" },
  processando: { rotulo: "Processando", bg: "#FFF3CD", cor: "#856404" },
  rejeitada: { rotulo: "Recusada", bg: "#FFEBEE", cor: "#C62828" },
  cancelada: { rotulo: "Cancelada", bg: "#ECEFF1", cor: "#546E7A" },
  lancada: { rotulo: "Entrada dada", bg: "#D8F3DC", cor: "#2D6A4F" },
};

const Chip = ({ status }) => {
  const s = STATUS[status] ?? { rotulo: status, bg: COLORS.cinzaClaro, cor: COLORS.cinzaEscuro };
  return (
    <span style={{ background: s.bg, color: s.cor, padding: "3px 9px", borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
      {s.rotulo}
    </span>
  );
};

const SEM_NOTAS = [];

const dataDa = (n) => n.emitidaEm || n.lancadaEm || n.criadoEm || "";
const mesDa = (n) => String(dataDa(n)).slice(0, 7);

const atualizarNota = (setDados, id, campos) =>
  setDados((d) => ({
    ...d,
    notas_entrada: (d.notas_entrada ?? []).map((n) => (n.id === id ? { ...n, ...campos } : n)),
  }));

/**
 * Janela de emissão da nota de devolução. `vendaInicial` já vem escolhida
 * quando se abre pela linha da nota em Emitidas.
 */
export const EmitirDevolucaoModal = ({ dados, setDados, vendaInicial, onClose }) => {
  const notasEntrada = dados.notas_entrada ?? SEM_NOTAS;
  const elegiveis = useMemo(
    () => dados.vendas
      .filter((v) => v.nfeStatus === "autorizada" && v.nfeChave)
      .sort((a, b) => String(b.nfeEmitidaEm || b.data).localeCompare(String(a.nfeEmitidaEm || a.data))),
    [dados.vendas]
  );
  const [vendaId, setVendaId] = useState(vendaInicial?.id ?? elegiveis[0]?.id ?? "");
  const [qtds, setQtds] = useState({});
  const [motivo, setMotivo] = useState("");
  const [avariada, setAvariada] = useState(false);
  const [emitindo, setEmitindo] = useState(false);

  const venda = elegiveis.find((v) => v.id === vendaId);
  const loja = venda && dados.lojas.find((l) => l.id === venda.lojaId);
  const produtosPorId = useMemo(() => Object.fromEntries(dados.produtos.map((p) => [p.id, p])), [dados.produtos]);
  const jaDevolvido = venda ? devolvidoPorItem(notasEntrada, venda.id) : {};
  const itensVenda = (venda?.itens ?? []).filter((i) => i.natureza !== "bonificacao");

  const escolhidos = itensVenda
    .map((i) => ({
      produtoId: i.produtoId,
      nome: produtosPorId[i.produtoId]?.nome ?? i.produtoId,
      qty: Number(String(qtds[i.produtoId] ?? "").replace(",", ".")) || 0,
      precoUnitario: i.precoUnitario,
      unidade: i.unidade,
      max: Math.max(0, i.qty - (jaDevolvido[i.produtoId] ?? 0)),
    }))
    .filter((i) => i.qty > 0);
  const passou = escolhidos.find((i) => i.qty > i.max + 1e-9);
  const valor = Number(escolhidos.reduce((s, i) => s + i.qty * i.precoUnitario, 0).toFixed(2));
  const temIe = !!String(loja?.ie || "").replace(/\D/g, "");

  const emitir = async () => {
    if (!venda || !escolhidos.length || passou) return;
    if (temIe && !confirm(
      `${nomeDoCliente(dados, venda.lojaId)} tem inscrição estadual: normalmente é o cliente quem emite a nota de devolução (ela chega em Recebidas).\n\n` +
      "Emitir mesmo assim a nota de entrada pela distribuidora?"
    )) return;

    const id = novoId();
    const agora = new Date().toISOString();
    const itens = escolhidos.map((i) => ({
      produtoId: i.produtoId, nome: i.nome, qty: i.qty, precoUnitario: i.precoUnitario,
      ...(i.unidade === "un" && { unidade: "un" }),
      total: Number((i.qty * i.precoUnitario).toFixed(2)),
      ...(avariada && { avariada: true }),
    }));
    setDados((d) => ({
      ...d,
      notas_entrada: [...(d.notas_entrada ?? []), {
        id, origem: "app", tipo: "devolucao", vendaId: venda.id, lojaId: venda.lojaId,
        valor, itens, motivo: motivo.trim(), nfeStatus: "processando",
        lancadaEm: agora, criadoEm: agora,
      }],
    }));

    setEmitindo(true);
    let criada = false;
    try {
      const campos = await emitirNotaDevolucao({
        id, venda, loja, produtosPorId, itens, motivo: motivo.trim(),
        aoCriar: (spedyId) => { criada = true; atualizarNota(setDados, id, { spedyId }); },
      });
      atualizarNota(setDados, id, campos);
      onClose();
    } catch (erro) {
      if (!criada) {
        // A Spedy nem aceitou a nota: não houve nada fiscal, some o registro.
        setDados((d) => ({ ...d, notas_entrada: (d.notas_entrada ?? []).filter((n) => n.id !== id) }));
      } else if (/rejeitada/i.test(erro.message)) {
        atualizarNota(setDados, id, { nfeStatus: "rejeitada", nfeErro: erro.message });
      }
      // Criada e ainda sem resposta: continua "processando" — o botão Conferir resolve.
      alert(`Nota de devolução não autorizada:\n${erro.message}`);
    } finally {
      setEmitindo(false);
    }
  };

  return (
    <Modal title="Emitir nota de devolução" onClose={emitindo ? () => {} : onClose}>
      {elegiveis.length === 0 ? (
        <p style={{ color: COLORS.cinza, fontSize: 14 }}>Nenhuma venda com NF-e autorizada para devolver.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Select label="Venda devolvida *" value={vendaId} onChange={(e) => { setVendaId(e.target.value); setQtds({}); }}
            options={elegiveis.map((v) => ({
              value: v.id,
              label: `NF ${v.nfeNumero ?? "?"} · #${v.numero ?? "—"} · ${nomeDoCliente(dados, v.lojaId)} · ${formatarData(v.data)} · ${brl(v.total)}`,
            }))} />

          {venda && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.cinzaEscuro }}>Quanto voltou de cada item</div>
              {itensVenda.map((i) => {
                const max = Math.max(0, i.qty - (jaDevolvido[i.produtoId] ?? 0));
                const un = i.unidade === "un" ? "un" : produtosPorId[i.produtoId]?.unidadeVenda === "saco" ? "saco(s)" : "kg";
                return (
                  <div key={i.produtoId} style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 10, alignItems: "center" }}>
                    <div style={{ fontSize: 13, color: COLORS.cinzaEscuro, minWidth: 0 }}>
                      {produtosPorId[i.produtoId]?.nome ?? i.produtoId}
                      <div style={{ fontSize: 11.5, color: COLORS.cinza }}>
                        vendido {i.qty} {un} a {brl(i.precoUnitario)}{jaDevolvido[i.produtoId] ? ` · já devolvido ${jaDevolvido[i.produtoId]}` : ""}
                      </div>
                    </div>
                    <Input type="number" inputMode="decimal" min="0" max={max} step="any" placeholder={`até ${max}`}
                      value={qtds[i.produtoId] ?? ""} disabled={max <= 0}
                      onChange={(e) => setQtds((q) => ({ ...q, [i.produtoId]: e.target.value }))} />
                  </div>
                );
              })}
              {passou && (
                <div style={{ fontSize: 12.5, color: COLORS.vermelho }}>
                  {passou.nome}: devolução maior que o que ainda resta da venda ({passou.max}).
                </div>
              )}
            </div>
          )}

          <Input label="Motivo" placeholder="Ex.: mercadoria avariada na entrega" value={motivo}
            onChange={(e) => setMotivo(e.target.value)} maxLength={200} />

          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: COLORS.cinzaEscuro, cursor: "pointer", lineHeight: 1.45 }}>
            <input type="checkbox" checked={avariada} onChange={(e) => setAvariada(e.target.checked)} style={{ marginTop: 3 }} />
            <span>
              Mercadoria avariada / sem qualidade — <b>não volta ao estoque</b>
              <div style={{ fontSize: 12, color: COLORS.cinza }}>Desmarcado, os quilos devolvidos entram de novo no estoque. Nos dois casos o valor sai do faturamento do pedido.</div>
            </span>
          </label>

          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: COLORS.cinza, lineHeight: 1.5 }}>
            <Icon name="alert" size={15} color={COLORS.cinza} />
            <span>
              NF-e de entrada com finalidade <b>devolução</b>, referenciando a NF {venda?.nfeNumero ?? "da venda"}.
              {" "}CFOP de entrada (5.101 → 1.201), mesma tributação e preço da venda, sem cobrança.
              {temIe && <><br /><b style={{ color: COLORS.laranjaEscuro }}>Este cliente tem IE — o normal é ele emitir a nota de devolução.</b></>}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <strong style={{ color: COLORS.cinzaEscuro }}>Total devolvido: {brl(valor)}</strong>
            <Btn onClick={emitir} disabled={!escolhidos.length || !!passou || emitindo}>
              {emitindo ? "Emitindo…" : "Emitir nota de devolução"}
            </Btn>
          </div>
        </div>
      )}
    </Modal>
  );
};

const Devolucoes = ({ dados, setDados, podeApagar }) => {
  const notasEntrada = dados.notas_entrada ?? SEM_NOTAS;
  const [modal, setModal] = useState(false);
  const [mes, setMes] = useState("");
  const [ocupado, setOcupado] = useState(null);
  const [, setSemErro] = useState(lerConferidas); // conferidas: XML já estava certo
  const produtosPorId = useMemo(() => Object.fromEntries(dados.produtos.map((p) => [p.id, p])), [dados.produtos]);
  const [cceDa, setCceDa] = useState(null); // devolução aberta na janela da carta de correção

  /** Carta de correção escolhida na janela: automática (código/descrição) ou com o motivo digitado. */
  const enviarCce = async ({ motivo, detalhe }) => {
    const n = cceDa;
    let texto;
    if (motivo === MOTIVO_AUTOMATICO) {
      const r = await corrigirCodigosDaNota({ spedyId: n.spedyId, produtosPorId, jaCorrigiuCodigo: !!n.nfeCceEm });
      if (r.semErro) {
        setSemErro(marcarConferida(n.id));
        setCceDa(null);
        alert("Esta nota já está com código e descrição certos — nada a corrigir.");
        return;
      }
      texto = r.texto;
    } else {
      ({ texto } = await enviarCartaCorrecaoLivre({ spedyId: n.spedyId, motivo, detalhe }));
    }
    atualizarNota(setDados, n.id, { nfeCceEm: new Date().toISOString(), nfeCceTexto: texto });
    setCceDa(null);
    alert(`Carta de correção enviada:\n\n${texto}`);
  };

  const devolucoes = useMemo(
    () => notasEntrada.filter((n) => n.tipo === "devolucao")
      .sort((a, b) => String(dataDa(b)).localeCompare(String(dataDa(a)))),
    [notasEntrada]
  );
  const meses = useMemo(() => [...new Set(devolucoes.map(mesDa).filter(Boolean))].sort().reverse(), [devolucoes]);
  const mesAtivo = mes || meses[0] || "";
  const doMes = devolucoes.filter((n) => !mesAtivo || mesDa(n) === mesAtivo);
  const valendo = doMes.filter((n) => n.origem !== "app" || n.nfeStatus === "autorizada");

  const conferir = async (n) => {
    setOcupado(n.id);
    try {
      const nota = await consultarNotaSpedy(n.spedyId);
      if (nota?.status === "authorized") atualizarNota(setDados, n.id, camposDaNotaAutorizada(nota));
      else if (nota?.status === "rejected") {
        const motivo = nota.processingDetail?.message || nota.processingDetail?.code || "motivo não informado";
        atualizarNota(setDados, n.id, { nfeStatus: "rejeitada", nfeErro: `Nota rejeitada pela SEFAZ: ${motivo}` });
      } else alert(`A Spedy ainda informa a nota como "${nota?.status ?? "?"}". Confira de novo em instantes.`);
    } catch (erro) {
      alert(`Não deu para conferir:\n${erro.message}`);
    } finally {
      setOcupado(null);
    }
  };

  const cancelar = async (n) => {
    const motivo = window.prompt(`Motivo do cancelamento da nota de devolução ${n.numero ?? ""} — mínimo 15 caracteres:`);
    if (!motivo || !motivo.trim()) return;
    if (motivo.trim().length < 15) { alert("O motivo precisa ter pelo menos 15 caracteres (exigência da SEFAZ)."); return; }
    setOcupado(n.id);
    try {
      await cancelarNfeDaVenda({ spedyId: n.spedyId, motivo: motivo.trim() });
      atualizarNota(setDados, n.id, { nfeStatus: "cancelada", nfeErro: "", observacao: `Cancelada: ${motivo.trim()}` });
    } catch (erro) {
      alert(`Não deu para cancelar:\n${erro.message}`);
    } finally {
      setOcupado(null);
    }
  };

  const apagar = (n) => {
    const aviso = n.origem === "sefaz"
      ? "Desfazer a entrada desta nota? Ela volta a aparecer como pendente em Recebidas."
      : "Apagar o registro desta nota recusada? Ela não teve efeito fiscal.";
    if (!confirm(aviso)) return;
    setDados((d) => ({ ...d, notas_entrada: (d.notas_entrada ?? []).filter((x) => x.id !== n.id) }));
  };

  const link = { color: COLORS.verde, fontWeight: 600, fontSize: 13, textDecoration: "none" };
  const botaoLink = { ...link, background: "none", border: "none", padding: 0, cursor: "pointer" };
  const botao = (cor, bg) => ({ background: bg, border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: cor, fontSize: 12, fontWeight: 600 });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div style={{ minWidth: 180 }}>
          <Select label="Mês" value={mesAtivo} onChange={(e) => setMes(e.target.value)}
            options={meses.length ? meses.map((m) => ({ value: m, label: nomeDoMes(`${m}-01`) })) : [{ value: "", label: "—" }]} />
        </div>
        <Btn icon="plus" onClick={() => setModal(true)}>Emitir nota de devolução</Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <StatCard icon="sync" label="Devoluções no mês" value={valendo.length}
          sub={brl(valendo.reduce((s, n) => s + (Number(n.valor) || 0), 0))} color={COLORS.laranjaEscuro} />
        <StatCard icon="folha" label="Nota do cliente" value={valendo.filter((n) => n.origem === "sefaz").length}
          sub="recebidas pela SEFAZ" color={COLORS.azul} />
        <StatCard icon="check" label="Emitidas por nós" value={valendo.filter((n) => n.origem === "app").length}
          sub="NF-e de entrada" color={COLORS.verde} />
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {doMes.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: COLORS.cinza }}>
            Nenhuma devolução {devolucoes.length ? "neste mês" : "registrada ainda"}. A nota que o cliente emite aparece aqui depois de
            dar entrada nela em Recebidas; se ele não emitir, use “Emitir nota de devolução”.
          </div>
        ) : (
          <TabelaRolavel>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead style={{ background: COLORS.cinzaClaro }}>
                <tr>
                  {["Data", "Cliente", "Venda", "Valor", "Nota", "Situação", "Arquivos", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", fontSize: 12, color: COLORS.cinza, padding: "12px 14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {doMes.map((n) => {
                  const venda = dados.vendas.find((v) => v.id === n.vendaId);
                  const nossa = n.origem === "app";
                  const temArquivo = nossa ? n.spedyId && ["autorizada", "cancelada"].includes(n.nfeStatus) : !!n.chave;
                  return (
                    <tr key={n.id} style={{ borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
                      <td style={{ padding: "12px 14px", fontSize: 13, whiteSpace: "nowrap" }}>{dataDa(n) ? new Date(dataDa(n)).toLocaleDateString("pt-BR") : "—"}</td>
                      <td style={{ padding: "12px 14px", fontSize: 13 }}>{n.lojaId ? nomeDoCliente(dados, n.lojaId) : n.emitenteNome || "—"}</td>
                      <td style={{ padding: "12px 14px", fontSize: 13, whiteSpace: "nowrap" }}>
                        {venda ? <>#{venda.numero ?? "—"}<div style={{ fontSize: 11, color: COLORS.cinza }}>NF {venda.nfeNumero ?? "—"}</div></> : "—"}
                      </td>
                      <td style={{ padding: "12px 14px", fontWeight: 700, whiteSpace: "nowrap", color: COLORS.laranjaEscuro }}>{brl(n.valor)}</td>
                      <td style={{ padding: "12px 14px", fontSize: 13 }}>
                        {n.numero ? `NF ${n.numero}` : "—"}
                        <div style={{ fontSize: 11, color: COLORS.cinza }}>{nossa ? "emitida por nós" : "nota do cliente"}</div>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <Chip status={nossa ? n.nfeStatus : "lancada"} />
                        {n.nfeCceEm && (
                          <div style={{ fontSize: 11, color: COLORS.verde, marginTop: 4 }} title={n.nfeCceTexto}>
                            CC-e enviada {new Date(n.nfeCceEm).toLocaleDateString("pt-BR")}
                          </div>
                        )}
                        {(n.nfeErro || n.motivo) && (
                          <div style={{ fontSize: 11, color: COLORS.cinza, marginTop: 4, maxWidth: 220 }} title={n.nfeErro || n.motivo}>
                            {(n.nfeErro || n.motivo).slice(0, 70)}{(n.nfeErro || n.motivo).length > 70 ? "…" : ""}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        {temArquivo && !nossa ? (
                          // Nota do cliente: vem da SEFAZ, o XML está no banco.
                          <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => abrirEspelhoRecebida(n.chave).catch((e) => alert(e.message))} style={botaoLink}>PDF</button>
                            <button onClick={() => baixarXmlRecebida(n.chave, `NFe-devolucao-${n.numero ?? n.id}.xml`).catch((e) => alert(e.message))} style={botaoLink}>XML</button>
                          </div>
                        ) : temArquivo ? (
                          <div style={{ display: "flex", gap: 10 }}>
                            <a href={danfeUrlSpedy(n.spedyId)} target="_blank" rel="noreferrer" style={link}>DANFE</a>
                            <a href={xmlUrlSpedy(n.spedyId)} download={`NFe-devolucao-${n.numero ?? n.id}.xml`} style={link}>XML</a>
                            {n.nfeCceEm && n.nfeCceTexto && (
                              <button title="PDF da carta de correção, para mandar ao cliente" style={botaoLink}
                                onClick={() => baixarPdfCartaCorrecao({ spedyId: n.spedyId, texto: n.nfeCceTexto, enviadaEm: n.nfeCceEm, cliente: n.lojaId ? nomeDoCliente(dados, n.lojaId) : n.emitenteNome })
                                  .catch((e) => alert(`Não foi possível gerar o PDF da CC-e:\n${e.message}`))}>
                                CC-e
                              </button>
                            )}
                          </div>
                        ) : <span style={{ color: COLORS.cinza, fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          {nossa && n.nfeStatus === "processando" && n.spedyId && (
                            <button onClick={() => conferir(n)} disabled={ocupado === n.id} style={botao(COLORS.cinzaEscuro, COLORS.cinzaClaro)}>
                              {ocupado === n.id ? "Conferindo…" : "Conferir"}
                            </button>
                          )}
                          {nossa && n.nfeStatus === "autorizada" && n.spedyId && (
                            <button onClick={() => setCceDa(n)} disabled={ocupado === n.id} style={botao("#1565C0", "#E3F2FD")}
                              title="Enviar carta de correção, escolhendo o motivo">
                              Carta de correção
                            </button>
                          )}
                          {nossa && n.nfeStatus === "autorizada" && (
                            <button onClick={() => cancelar(n)} disabled={ocupado === n.id} style={botao(COLORS.vermelho, "#FFEBEE")}>
                              {ocupado === n.id ? "Cancelando…" : "Cancelar"}
                            </button>
                          )}
                          {((nossa && n.nfeStatus === "rejeitada") || (!nossa && podeApagar)) && (
                            <button onClick={() => apagar(n)} style={botao(COLORS.vermelho, "#FFEBEE")}>
                              {nossa ? "Apagar" : "Desfazer entrada"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TabelaRolavel>
        )}
      </Card>

      {cceDa && (
        <CartaCorrecaoModal titulo={`devolução ${cceDa.numero ?? ""}`} jaTemCce={!!cceDa.nfeCceEm}
          onEnviar={enviarCce} onClose={() => setCceDa(null)} />
      )}
      {modal && <EmitirDevolucaoModal dados={dados} setDados={setDados} onClose={() => setModal(false)} />}
    </div>
  );
};

export default Devolucoes;

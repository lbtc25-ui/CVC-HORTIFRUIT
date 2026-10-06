import { useCallback, useEffect, useRef, useState } from "react";

import { Btn, Card, Icon, Input, Modal, Select, StatCard, TabelaRolavel } from "../components/ui";
import { nomeDoMes } from "../lib/datas";
import { novoId } from "../lib/mappers";
import { baixarZip, formatarCnpj, lojaPorCnpj, nomeDoCliente, numeroDaChave, soDigitos } from "../lib/notas";
import {
  MANIFESTACOES,
  abrirEspelhoRecebida,
  baixarXmlRecebida,
  buscarNotasRecebidasAgora,
  buscarXmlCompleto,
  lerXmlRecebida,
  listarNotasRecebidas,
  manifestarNotaRecebida,
  obterXmlRecebida,
  statusBuscaRecebidas,
} from "../lib/sefaz";
import { COLORS, brl } from "../lib/tema";

/**
 * Notas recebidas — as NF-e que terceiros emitiram contra o CNPJ da
 * distribuidora (compras de fornecedor, devoluções de cliente), trazidas
 * direto da SEFAZ com o certificado A1 da empresa (lib/sefaz.js).
 *
 * A lista vem de `nfe_recebidas`, que o servidor preenche consultando a
 * SEFAZ (ao abrir esta tela, no botão "Buscar na SEFAZ agora" e uma vez por
 * dia pelo cron). Em `notas_entrada` ficam as notas às quais se "deu
 * entrada" — com o que elas são para o negócio (compra, devolução ligada a
 * uma venda, outra) e a compra lançada a partir delas.
 *
 * Dar entrada, aqui, é: manifestar na SEFAZ (Confirmação da operação, por
 * padrão) + registrar no app. A manifestação também é o que libera o XML
 * completo e o DANFE — antes dela a SEFAZ só entrega um resumo.
 */

const SEM_NOTAS = [];

const SITUACAO = {
  authorized: { rotulo: "Autorizada", bg: "#D8F3DC", cor: "#2D6A4F" },
  canceled: { rotulo: "Cancelada pelo emitente", bg: "#ECEFF1", cor: "#546E7A" },
  denied: { rotulo: "Denegada", bg: "#FFEBEE", cor: "#C62828" },
};

const COR_MANIFESTACAO = {
  none: { bg: "#FFF3CD", cor: "#856404" },
  acknowledged: { bg: "#E3F2FD", cor: "#1565C0" },
  confirmed: { bg: "#D8F3DC", cor: "#2D6A4F" },
  unknown: { bg: "#FFEBEE", cor: "#C62828" },
  notPerformed: { bg: "#FFEBEE", cor: "#C62828" },
  rejected: { bg: "#FFEBEE", cor: "#C62828" },
};

const TIPOS = { compra: "Compra", devolucao: "Devolução de cliente", outra: "Outra" };

const Chip = ({ rotulo, bg, cor }) => (
  <span style={{ background: bg, color: cor, padding: "3px 9px", borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{rotulo}</span>
);

const statusManifestacao = (n) => n.manifestation?.status || "none";

/** A SEFAZ guarda ~90 dias na distribuição: o mês atual e os três anteriores. */
function mesesDisponiveis() {
  const hoje = new Date();
  return [0, 1, 2, 3].map((i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

function periodoDoMes(mes) {
  const [a, m] = mes.split("-").map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  return { initialDate: `${mes}-01`, endDate: `${mes}-${String(ultimo).padStart(2, "0")}` };
}

/** "2026-09-18" no fuso do aparelho, a partir de um instante ISO. */
function diaLocal(instante) {
  const d = instante ? new Date(instante) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const dataHora = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

/** A entrada já registrada para esta nota, se houver. */
const entradaDa = (notasEntrada, nota) =>
  notasEntrada.find((e) => e.origem === "sefaz" && e.chave && e.chave === nota.accessKey);

/** Dias até a data (negativo = já passou). */
const diasAte = (iso) => Math.floor((new Date(iso) - new Date()) / 86400000);

// ─── Dar entrada ────────────────────────────────────────────────────────────

const DarEntradaModal = ({ nota, dados, setDados, frutas, onClose, onManifestada }) => {
  const [xml, setXml] = useState(nota.isComplete ? "carregando" : null);
  const emitenteCnpj = soDigitos(nota.issuer?.federalTaxNumber);
  const loja = lojaPorCnpj(dados, emitenteCnpj);
  const { numero, serie } = numeroDaChave(nota.accessKey);
  const atual = statusManifestacao(nota);
  const definitiva = ["confirmed", "unknown", "notPerformed"].includes(atual);

  const vendasComNf = dados.vendas
    .filter((v) => v.nfeChave && ["autorizada", "cancelada"].includes(v.nfeStatus) && (!loja || v.lojaId === loja.id))
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));

  const [form, setForm] = useState({
    tipo: loja ? "devolucao" : "compra",
    vendaId: "",
    fornecedorId: "",
    // As compras já são lançadas à mão em Compras: por padrão a nota só é
    // registrada/manifestada, sem entrar de novo no estoque e no custo.
    lancarCompra: false,
    avariada: false,
    fruta: frutas[0] ?? "Laranja Pera",
    pesoKg: "",
    valorTotal: String(nota.amount ?? ""),
    manifestacao: definitiva ? "" : "confirmed",
    observacao: "",
  });
  const set = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));
  const [salvando, setSalvando] = useState(false);

  // A sincronização troca `dados` a cada minuto: o XML é lido uma vez só,
  // com as vendas de quando a janela abriu.
  const vendasRef = useRef(dados.vendas);

  // XML completo: finalidade (é devolução?), nota referenciada (qual venda) e itens.
  useEffect(() => {
    if (!nota.isComplete) return undefined;
    let cancelado = false;
    lerXmlRecebida(nota.id)
      .then((lido) => {
        if (cancelado) return;
        setXml(lido);
        const ref = lido.referenciadas.map(soDigitos);
        const venda = vendasRef.current.find((v) => v.nfeChave && ref.includes(soDigitos(v.nfeChave)));
        const kg = lido.itens.filter((i) => /^k/i.test(i.unidade)).reduce((s, i) => s + i.quantidade, 0);
        setForm((f) => ({
          ...f,
          ...(lido.finalidade === "devolucao" || venda ? { tipo: "devolucao", lancarCompra: false } : {}),
          ...(venda ? { vendaId: venda.id } : {}),
          ...(kg > 0 ? { pesoKg: String(Number(kg.toFixed(3))) } : {}),
        }));
      })
      .catch((e) => !cancelado && setXml({ erro: e.message }));
    return () => { cancelado = true; };
  }, [nota.id, nota.isComplete]);

  const peso = Number(String(form.pesoKg).replace(",", ".")) || 0;
  const valorTotal = Number(String(form.valorTotal).replace(",", ".")) || 0;
  const faltaCompra = form.tipo === "compra" && form.lancarCompra && (!(peso > 0) || !(valorTotal > 0));

  const salvar = async () => {
    setSalvando(true);
    try {
      if (form.manifestacao && form.manifestacao !== atual) {
        await manifestarNotaRecebida(nota.id, form.manifestacao);
        onManifestada(nota.id, { status: form.manifestacao, date: new Date().toISOString() });
      }
      const agora = new Date().toISOString();
      const venda = form.tipo === "devolucao" ? dados.vendas.find((v) => v.id === form.vendaId) : null;
      const compra = form.tipo === "compra" && form.lancarCompra
        ? {
            id: novoId(),
            data: diaLocal(nota.issuedOn),
            fornecedorId: form.fornecedorId,
            fruta: form.fruta,
            pesoKg: peso,
            valorKg: Number((valorTotal / peso).toFixed(4)),
            total: valorTotal,
            observacao: `NF-e ${numero ?? ""} · ${nota.issuer?.legalName || nota.issuer?.name || formatarCnpj(emitenteCnpj)}`,
            criadoEm: agora,
          }
        : null;
      const entrada = {
        id: novoId(),
        origem: "sefaz",
        tipo: form.tipo,
        chave: nota.accessKey,
        numero: xml?.numero ? Number(xml.numero) : numero,
        serie: xml?.serie || serie,
        emitenteNome: nota.issuer?.legalName || nota.issuer?.name || "",
        emitenteCnpj,
        emitidaEm: nota.issuedOn,
        valor: Number(nota.amount) || 0,
        vendaId: venda?.id ?? "",
        lojaId: venda?.lojaId ?? (form.tipo === "devolucao" ? loja?.id ?? "" : ""),
        fornecedorId: form.tipo === "compra" ? form.fornecedorId : "",
        compraId: compra?.id ?? "",
        itens: (Array.isArray(xml?.itens) ? xml.itens : []).map((i) => (form.tipo === "devolucao" && form.avariada ? { ...i, avariada: true } : i)),
        observacao: form.observacao.trim(),
        lancadaEm: agora,
        criadoEm: agora,
      };
      setDados((d) => ({
        ...d,
        compras: compra ? [...d.compras, compra] : d.compras,
        notas_entrada: [...(d.notas_entrada ?? []), entrada],
      }));
      onClose();
    } catch (erro) {
      alert(`A SEFAZ não aceitou a manifestação — nada foi lançado:\n${erro.message}`);
    } finally {
      setSalvando(false);
    }
  };

  const opcoesManifestacao = [
    ...(atual !== "confirmed" ? [{ value: "confirmed", label: "Confirmar a operação (definitivo)" }] : []),
    ...(atual === "none" ? [{ value: "acknowledged", label: "Só dar ciência (libera o XML, não é definitivo)" }] : []),
    { value: "", label: atual === "none" ? "Não manifestar agora" : `Manter: ${MANIFESTACOES[atual]}` },
  ];

  return (
    <Modal title={`Dar entrada · NF ${numero ?? "—"}`} onClose={salvando ? () => {} : onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: COLORS.cinzaClaro, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: COLORS.cinzaEscuro, lineHeight: 1.6 }}>
          <b>{nota.issuer?.legalName || nota.issuer?.name || "Emitente"}</b> · {formatarCnpj(emitenteCnpj)}
          {loja && <div style={{ color: COLORS.laranjaEscuro, fontWeight: 600 }}>É cliente: {nomeDoCliente(dados, loja.id)}</div>}
          <div>Emitida em {dataHora(nota.issuedOn)} · série {serie ?? "—"} · <b>{brl(nota.amount)}</b></div>
          {xml === "carregando" && <div style={{ color: COLORS.cinza }}>Lendo o XML…</div>}
          {xml?.natureza && <div>Natureza: {xml.natureza}{xml.finalidade === "devolucao" && <b style={{ color: COLORS.laranjaEscuro }}> · nota de devolução</b>}</div>}
          {xml?.itens?.length > 0 && (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {xml.itens.map((i, k) => (
                <li key={k}>{i.descricao} — {i.quantidade} {i.unidade} × {brl(i.valorUnitario)} = {brl(i.total)} <span style={{ color: COLORS.cinza }}>(CFOP {i.cfop})</span></li>
              ))}
            </ul>
          )}
          {!nota.isComplete && (
            <div style={{ color: COLORS.cinza }}>Os itens aparecem depois da manifestação: a SEFAZ só libera o XML completo depois dela.</div>
          )}
          {xml?.erro && <div style={{ color: COLORS.vermelho }}>{xml.erro}</div>}
        </div>

        <Select label="O que é esta nota *" value={form.tipo}
          onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value, lancarCompra: false }))}
          options={Object.entries(TIPOS).map(([value, label]) => ({ value, label }))} />

        {form.tipo === "devolucao" && (
          <Select label="Venda devolvida" value={form.vendaId} onChange={(e) => set("vendaId", e.target.value)}
            options={[
              { value: "", label: vendasComNf.length ? "— escolha a venda —" : "Nenhuma venda com NF-e deste cliente" },
              ...vendasComNf.map((v) => ({
                value: v.id,
                label: `NF ${v.nfeNumero ?? "?"} · #${v.numero ?? "—"} · ${nomeDoCliente(dados, v.lojaId)} · ${brl(v.total)}`,
              })),
            ]} />
        )}

        {form.tipo === "devolucao" && (
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13.5, color: COLORS.cinzaEscuro, cursor: "pointer" }}>
            <input type="checkbox" checked={form.avariada} onChange={(e) => set("avariada", e.target.checked)} style={{ marginTop: 3 }} />
            <span>
              Mercadoria avariada / sem qualidade — não volta ao estoque
              <div style={{ fontSize: 12, color: COLORS.cinza }}>Desmarcado, os quilos entram de novo no estoque. O valor sai do faturamento do pedido nos dois casos.</div>
            </span>
          </label>
        )}

        {form.tipo === "compra" && (
          <>
            <Select label="Fornecedor" value={form.fornecedorId} onChange={(e) => set("fornecedorId", e.target.value)}
              options={[{ value: "", label: "— sem fornecedor cadastrado —" },
                ...dados.fornecedores.filter((f) => f.status !== "inativo").map((f) => ({ value: f.id, label: f.nome }))]} />
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, color: COLORS.cinzaEscuro, cursor: "pointer" }}>
              <input type="checkbox" checked={form.lancarCompra} onChange={(e) => set("lancarCompra", e.target.checked)} />
              Lançar também em Compras (entra no estoque e no custo por quilo)
            </label>
            {form.lancarCompra && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                <Select label="Fruta *" value={form.fruta} onChange={(e) => set("fruta", e.target.value)}
                  options={frutas.map((f) => ({ value: f, label: f }))} />
                <Input label="Peso (kg) *" type="number" inputMode="decimal" step="any" value={form.pesoKg} onChange={(e) => set("pesoKg", e.target.value)} />
                <Input label="Valor total (R$) *" type="number" inputMode="decimal" step="any" value={form.valorTotal} onChange={(e) => set("valorTotal", e.target.value)} />
              </div>
            )}
            {form.lancarCompra && peso > 0 && valorTotal > 0 && (
              <div style={{ fontSize: 12.5, color: COLORS.cinza }}>{brl(valorTotal / peso)} por quilo</div>
            )}
          </>
        )}

        <Select label="Manifestação na SEFAZ" value={form.manifestacao} onChange={(e) => set("manifestacao", e.target.value)}
          options={opcoesManifestacao} />
        <Input label="Observação" value={form.observacao} onChange={(e) => set("observacao", e.target.value)} maxLength={300} />

        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: COLORS.cinza, lineHeight: 1.5 }}>
          <Icon name="alert" size={15} color={COLORS.cinza} />
          <span>
            Confirmar a operação diz à SEFAZ que a mercadoria chegou — não dá para desfazer. Se a nota não é sua ou a
            mercadoria foi recusada, feche e use <b>Recusar</b> na lista.
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Btn onClick={salvar} disabled={salvando || faltaCompra}>{salvando ? "Registrando…" : "Dar entrada"}</Btn>
        </div>
      </div>
    </Modal>
  );
};

// ─── Recusar ────────────────────────────────────────────────────────────────

const RecusarModal = ({ nota, onClose, onManifestada }) => {
  const [status, setStatus] = useState("notPerformed");
  const [justificativa, setJustificativa] = useState("");
  const [enviando, setEnviando] = useState(false);
  const tamanho = justificativa.trim().length;

  const enviar = async () => {
    if (!confirm("A recusa é definitiva na SEFAZ e não pode ser desfeita. Continuar?")) return;
    setEnviando(true);
    try {
      await manifestarNotaRecebida(nota.id, status, justificativa.trim());
      onManifestada(nota.id, { status, date: new Date().toISOString(), justification: justificativa.trim() });
      onClose();
    } catch (erro) {
      alert(`A SEFAZ não aceitou:\n${erro.message}`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal title="Recusar nota recebida" onClose={enviando ? () => {} : onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Select label="Motivo" value={status} onChange={(e) => setStatus(e.target.value)} options={[
          { value: "notPerformed", label: "Operação não realizada (a mercadoria foi recusada / não veio)" },
          { value: "unknown", label: "Desconhecimento da operação (não compramos isso — nota indevida)" },
        ]} />
        <Input label={`Justificativa * (${tamanho}/255, mínimo 15)`} value={justificativa} maxLength={255}
          onChange={(e) => setJustificativa(e.target.value)} placeholder="Ex.: mercadoria devolvida no ato da entrega por avaria" />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Btn variant="danger" onClick={enviar} disabled={enviando || tamanho < 15}>{enviando ? "Enviando…" : "Recusar na SEFAZ"}</Btn>
        </div>
      </div>
    </Modal>
  );
};

// ─── Tela ───────────────────────────────────────────────────────────────────

const NotasRecebidas = ({ dados, setDados, frutas }) => {
  const notasEntrada = dados.notas_entrada ?? SEM_NOTAS;
  const [meses] = useState(mesesDisponiveis);
  const [mes, setMes] = useState(meses[0]);
  const [filtro, setFiltro] = useState("pendentes");
  const [notas, setNotas] = useState([]);
  // Resultado da última consulta, marcado com o mês/recarga a que responde:
  // enquanto não bate com o pedido atual, a tela está carregando.
  const [resultado, setResultado] = useState({ chave: null, erro: null, busca: null });
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [entradaDe, setEntradaDe] = useState(null);
  const [recusarDe, setRecusarDe] = useState(null);
  const [ocupado, setOcupado] = useState(null);
  const [baixando, setBaixando] = useState(null);
  const [recarga, setRecarga] = useState(0);

  const chave = `${mes}#${recarga}`;
  const carregando = resultado.chave !== chave;
  const { erro, busca } = resultado; // busca = sefaz_dfe_estado

  // Ao abrir a tela, busca na SEFAZ sozinha se a espera de uma hora já
  // passou (uma vez só; o resto é no botão ou no cron diário).
  const buscouAoAbrir = useRef(false);
  const buscarAgoraRef = useRef(null);

  useEffect(() => {
    let cancelado = false;
    Promise.all([
      listarNotasRecebidas(periodoDoMes(mes)),
      statusBuscaRecebidas().catch(() => null),
    ])
      .then(([lista, status]) => {
        if (cancelado) return;
        setNotas(lista.sort((a, b) => String(b.issuedOn).localeCompare(String(a.issuedOn))));
        setResultado({ chave: `${mes}#${recarga}`, erro: null, busca: status });
        if (status && !buscouAoAbrir.current) {
          buscouAoAbrir.current = true;
          if (!status.nextAllowedSyncAt || new Date(status.nextAllowedSyncAt) <= new Date()) buscarAgoraRef.current?.(true);
        }
      })
      .catch((e) => !cancelado && setResultado({ chave: `${mes}#${recarga}`, erro: e, busca: null }));
    return () => { cancelado = true; };
  }, [mes, recarga]);

  const recarregar = useCallback(() => setRecarga((n) => n + 1), []);

  /** Atualiza a manifestação na lista sem buscar tudo de novo. */
  const aoManifestar = useCallback((id, manifestation) => {
    setNotas((lista) => lista.map((n) => (n.id === id ? { ...n, manifestation: { ...n.manifestation, ...manifestation } } : n)));
  }, []);

  /** `silenciosa`: a busca automática ao abrir a tela só avisa se trouxe nota nova ou deu erro. */
  const buscarAgora = useCallback(async (silenciosa = false) => {
    setBuscando(true);
    if (!silenciosa) setAviso("");
    try {
      const r = await buscarNotasRecebidasAgora();
      if (r.emAndamento) {
        if (!silenciosa) setAviso("Já tem uma busca em andamento — toque em Atualizar lista daqui a pouco.");
      } else if (r.pedida) {
        if (!silenciosa || r.novas) setAviso(r.novas ? `A SEFAZ mandou ${r.novas} nota(s) nova(s) ou atualizada(s).` : "Nenhuma nota nova na SEFAZ.");
        recarregar();
      } else if (!silenciosa) {
        setAviso(`A SEFAZ só deixa consultar de novo ${r.liberaEm ? `a partir de ${dataHora(r.liberaEm)}` : "daqui a pouco"} (ela bloqueia o CNPJ que consulta demais).`);
      }
    } catch (e) {
      setAviso(`Não deu para buscar na SEFAZ: ${e.message}`);
    } finally {
      setBuscando(false);
    }
  }, [recarregar]);
  useEffect(() => { buscarAgoraRef.current = buscarAgora; }, [buscarAgora]);

  const pegarXml = async (nota) => {
    setOcupado(nota.id);
    try {
      const r = await buscarXmlCompleto(nota.id);
      if (r.completa) {
        setAviso("XML completo recebido.");
        recarregar();
      } else {
        setAviso(`A SEFAZ ainda não liberou o XML completo (${r.cStat} ${r.motivo}). Depois da manifestação isso leva alguns minutos.`);
      }
    } catch (e) {
      alert(`Não deu para buscar o XML:\n${e.message}`);
    } finally {
      setOcupado(null);
    }
  };

  // Nota de antes do NSU em que o app começou: a busca normal não traz mais
  // (outro sistema já baixou), mas a SEFAZ entrega pela chave.
  const [chaveBusca, setChaveBusca] = useState("");
  const [buscandoChave, setBuscandoChave] = useState(false);
  const buscarPelaChave = async () => {
    const chave = soDigitos(chaveBusca);
    if (chave.length !== 44) {
      setAviso("A chave de acesso tem 44 números — está no DANFE, embaixo do código de barras.");
      return;
    }
    setBuscandoChave(true);
    setAviso("");
    try {
      const r = await buscarXmlCompleto(chave);
      if (!r.encontrada) {
        setAviso(`A SEFAZ não entregou essa nota (${r.cStat} ${r.motivo}).`);
        return;
      }
      setChaveBusca("");
      // A chave traz o ano/mês de emissão (posições 3 a 6): abre a lista nesse mês.
      const mesDaNota = `20${chave.slice(2, 4)}-${chave.slice(4, 6)}`;
      if (meses.includes(mesDaNota)) setMes(mesDaNota);
      setAviso(r.completa
        ? "Nota encontrada, já com o XML completo."
        : "Nota encontrada (resumo). Para ver os itens, dê ciência e depois toque em Buscar XML nela.");
      recarregar();
    } catch (e) {
      setAviso(`Não deu para buscar a nota: ${e.message}`);
    } finally {
      setBuscandoChave(false);
    }
  };

  const arquivo = (acao) => (nota) => acao(nota).catch((e) => alert(e.message));
  const baixarXml = arquivo((nota) => baixarXmlRecebida(nota.id, `NFe-entrada-${numeroDaChave(nota.accessKey).numero ?? nota.id}.xml`));
  const abrirEspelho = arquivo((nota) => abrirEspelhoRecebida(nota.id));

  const darCiencia = async (nota) => {
    setOcupado(nota.id);
    try {
      await manifestarNotaRecebida(nota.id, "acknowledged");
      aoManifestar(nota.id, { status: "acknowledged", date: new Date().toISOString() });
      setAviso("Ciência registrada. A SEFAZ libera o XML completo em alguns minutos — depois toque em Buscar XML na nota.");
    } catch (e) {
      alert(`A SEFAZ não aceitou:\n${e.message}`);
    } finally {
      setOcupado(null);
    }
  };

  const linhas = notas.map((n) => ({ nota: n, entrada: entradaDa(notasEntrada, n), loja: lojaPorCnpj(dados, n.issuer?.federalTaxNumber) }));
  const recusada = (n) => ["unknown", "notPerformed"].includes(statusManifestacao(n));
  const pendente = (l) => !l.entrada && l.nota.status === "authorized" && !recusada(l.nota);
  const visiveis = linhas.filter((l) =>
    filtro === "todas" ? true
      : filtro === "pendentes" ? pendente(l)
        : filtro === "lancadas" ? !!l.entrada
          : filtro === "clientes" ? !!l.loja
            : true);
  const pendentes = linhas.filter(pendente);
  const canceladasComEntrada = linhas.filter((l) => l.entrada && l.nota.status === "canceled");
  const completas = visiveis.filter((l) => l.nota.isComplete);

  const baixarXmls = () => baixarZip({
    arquivos: completas.map(({ nota }) => {
      const { serie, numero } = numeroDaChave(nota.accessKey);
      return {
        nome: `NFe-entrada-${soDigitos(nota.issuer?.federalTaxNumber)}-${serie ?? 0}-${String(numero ?? "").padStart(6, "0")}.xml`,
        obter: () => obterXmlRecebida(nota.id),
        rotulo: `NF ${numero ?? "?"} de ${nota.issuer?.name ?? "?"}`,
      };
    }),
    nomeZip: `xml-nfe-recebidas-${mes}.zip`,
    aoProgredir: setBaixando,
  });

  const nuncaBuscou = busca && !busca.lastSyncAt;
  const certVence = busca?.certificadoValidoAte ? diasAte(busca.certificadoValidoAte) : null;
  const botao = (cor, bg) => ({ background: bg, border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: cor, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" });
  const link = { color: COLORS.verde, fontWeight: 600, fontSize: 13, textDecoration: "none", background: "none", border: "none", padding: 0, cursor: "pointer" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 170 }}>
            <Select label="Mês" value={mes} onChange={(e) => setMes(e.target.value)}
              options={meses.map((m) => ({ value: m, label: nomeDoMes(`${m}-01`) }))} />
          </div>
          <div style={{ minWidth: 170 }}>
            <Select label="Mostrar" value={filtro} onChange={(e) => setFiltro(e.target.value)} options={[
              { value: "pendentes", label: "Sem entrada" },
              { value: "lancadas", label: "Com entrada" },
              { value: "clientes", label: "De clientes (devoluções)" },
              { value: "todas", label: "Todas" },
            ]} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn variant="secondary" icon="sync" onClick={recarregar} disabled={carregando}>Atualizar lista</Btn>
          <Btn variant="ghost" onClick={() => buscarAgora()} disabled={buscando || !!erro}>{buscando ? "Pedindo…" : "Buscar na SEFAZ agora"}</Btn>
          <Btn onClick={baixarXmls} disabled={!completas.length || !!baixando}>
            {baixando ? `Baixando XML ${baixando.feito + 1} de ${baixando.total}...` : `Baixar XMLs (.zip) · ${completas.length}`}
          </Btn>
        </div>
      </div>

      {!erro && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 320px" }}>
            <Input label="Buscar nota pela chave de acesso (44 números do DANFE)" value={chaveBusca} inputMode="numeric"
              onChange={(e) => setChaveBusca(e.target.value)} placeholder="2826 0912 3456 7800 0190 5500 1000 0012 3410 0001 2345"
              onKeyDown={(e) => e.key === "Enter" && buscarPelaChave()} />
          </div>
          <Btn variant="secondary" onClick={buscarPelaChave} disabled={buscandoChave || !soDigitos(chaveBusca)}>
            {buscandoChave ? "Buscando…" : "Buscar pela chave"}
          </Btn>
        </div>
      )}
      {busca?.ultimoCstat === "656" && (
        <div style={{ background: "#FFF3CD", color: "#856404", borderRadius: 10, padding: "10px 14px", fontSize: 13.5, lineHeight: 1.5 }}>
          A SEFAZ recusou a última busca por <b>consumo indevido</b> ({busca.lastAttemptMessage}). Costuma ser porque outro
          sistema (do contador, um ERP) também baixa as notas deste CNPJ. A busca continua sozinha
          {busca.nextAllowedSyncAt ? ` a partir de ${dataHora(busca.nextAllowedSyncAt)}` : ""}, do ponto que a SEFAZ indicou, e
          as notas novas chegam normalmente. Nota mais antiga que não aparecer aqui: use <b>Buscar pela chave</b>.
        </div>
      )}
      {certVence !== null && certVence <= 30 && (
        <div style={{ background: "#FFEBEE", color: COLORS.vermelho, borderRadius: 10, padding: "10px 14px", fontSize: 13.5 }}>
          {certVence < 0
            ? `O certificado digital A1 venceu em ${dataHora(busca.certificadoValidoAte)} — a SEFAZ não responde mais. Renove e troque o .pfx na Vercel.`
            : `O certificado digital A1 vence em ${certVence} dia(s) (${dataHora(busca.certificadoValidoAte)}). Renove e troque o .pfx na Vercel.`}
        </div>
      )}
      {aviso && (
        <div style={{ background: "#E3F2FD", color: "#1565C0", borderRadius: 10, padding: "10px 14px", fontSize: 13.5 }}>{aviso}</div>
      )}
      {canceladasComEntrada.length > 0 && (
        <div style={{ background: "#FFEBEE", color: COLORS.vermelho, borderRadius: 10, padding: "10px 14px", fontSize: 13.5 }}>
          {canceladasComEntrada.length} nota(s) com entrada dada foram <b>canceladas pelo emitente</b> depois:{" "}
          {canceladasComEntrada.map((l) => `NF ${l.entrada.numero ?? "?"} (${l.entrada.emitenteNome})`).join(", ")}. Confira a compra/devolução lançada.
        </div>
      )}

      {!erro && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
          <StatCard icon="alert" label="Sem entrada" value={pendentes.length}
            sub={brl(pendentes.reduce((s, l) => s + (Number(l.nota.amount) || 0), 0))} color={pendentes.length ? COLORS.laranjaEscuro : COLORS.cinza} />
          <StatCard icon="folha" label="Recebidas no mês" value={notas.length}
            sub={brl(notas.filter((n) => n.status === "authorized").reduce((s, n) => s + (Number(n.amount) || 0), 0))} color={COLORS.azul} />
          <StatCard icon="sync" label="Última busca na SEFAZ" value={busca?.lastSyncAt ? dataHora(busca.lastSyncAt) : "—"}
            sub={buscando ? "buscando agora…" : [
              busca?.lastAttemptMessage,
              busca?.nextAllowedSyncAt && new Date(busca.nextAllowedSyncAt) > new Date() ? `próxima: ${dataHora(busca.nextAllowedSyncAt)}` : "",
            ].filter(Boolean).join(" · ") || "ao abrir a tela e 1× por dia"} color={COLORS.verde} />
        </div>
      )}

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {carregando ? (
          <div style={{ padding: 30, textAlign: "center", color: COLORS.cinza }}>Carregando as notas…</div>
        ) : erro ? (
          <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
            <strong style={{ color: COLORS.vermelho }}>Não deu para ler as notas recebidas.</strong>
            <span style={{ fontSize: 13.5, color: COLORS.cinzaEscuro, whiteSpace: "pre-wrap" }}>{erro.message}</span>
            <Btn variant="secondary" onClick={recarregar}>Tentar de novo</Btn>
          </div>
        ) : visiveis.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: COLORS.cinza, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
            {notas.length ? "Nenhuma nota com esse filtro." : "Nenhuma NF-e emitida contra o CNPJ da empresa neste mês."}
            {nuncaBuscou && (
              <>
                <span style={{ fontSize: 13 }}>O app ainda não buscou nada na SEFAZ. A primeira busca traz as notas dos últimos 90 dias.</span>
                <Btn onClick={() => buscarAgora()} disabled={buscando}>{buscando ? "Buscando…" : "Buscar na SEFAZ agora"}</Btn>
              </>
            )}
          </div>
        ) : (
          <TabelaRolavel>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
              <thead style={{ background: COLORS.cinzaClaro }}>
                <tr>
                  {["NF", "Emissão", "Emitente", "Valor", "Situação", "Manifestação", "Entrada", "Arquivos"].map((h) => (
                    <th key={h} style={{ textAlign: "left", fontSize: 12, color: COLORS.cinza, padding: "12px 14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visiveis.map(({ nota, entrada, loja }) => {
                  const { numero, serie } = numeroDaChave(nota.accessKey);
                  const sit = SITUACAO[nota.status] ?? { rotulo: nota.status, bg: COLORS.cinzaClaro, cor: COLORS.cinzaEscuro };
                  const man = statusManifestacao(nota);
                  const venda = entrada?.vendaId && dados.vendas.find((v) => v.id === entrada.vendaId);
                  return (
                    <tr key={nota.id} style={{ borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
                      <td style={{ padding: "12px 14px", fontWeight: 700, color: COLORS.cinzaEscuro, whiteSpace: "nowrap" }}>
                        {numero ?? "—"}<span style={{ fontWeight: 400, color: COLORS.cinza, fontSize: 12 }}> · série {serie ?? "—"}</span>
                      </td>
                      <td style={{ padding: "12px 14px", fontSize: 13, whiteSpace: "nowrap" }}>{dataHora(nota.issuedOn)}</td>
                      <td style={{ padding: "12px 14px", fontSize: 13, color: COLORS.cinzaEscuro }}>
                        {nota.issuer?.legalName || nota.issuer?.name || "—"}
                        <div style={{ fontSize: 11, color: COLORS.cinza }}>{formatarCnpj(nota.issuer?.federalTaxNumber)}</div>
                        {loja && <div style={{ fontSize: 11, color: COLORS.laranjaEscuro, fontWeight: 600 }}>cliente: {nomeDoCliente(dados, loja.id)}</div>}
                      </td>
                      <td style={{ padding: "12px 14px", fontWeight: 700, whiteSpace: "nowrap", color: COLORS.cinzaEscuro }}>{brl(nota.amount)}</td>
                      <td style={{ padding: "12px 14px" }}><Chip {...sit} /></td>
                      <td style={{ padding: "12px 14px" }}>
                        <Chip rotulo={MANIFESTACOES[man] ?? man} {...(COR_MANIFESTACAO[man] ?? COR_MANIFESTACAO.none)} />
                        {man === "none" && nota.status === "authorized" && !entrada && (
                          <div style={{ marginTop: 6 }}>
                            <button onClick={() => darCiencia(nota)} disabled={ocupado === nota.id} style={botao(COLORS.azul, "#E3F2FD")}>
                              {ocupado === nota.id ? "Enviando…" : "Dar ciência"}
                            </button>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        {entrada ? (
                          <div style={{ fontSize: 13 }}>
                            <Chip rotulo={TIPOS[entrada.tipo] ?? entrada.tipo} bg="#D8F3DC" cor="#2D6A4F" />
                            <div style={{ fontSize: 11, color: COLORS.cinza, marginTop: 4 }}>
                              {venda ? `pedido #${venda.numero ?? "—"} · NF ${venda.nfeNumero ?? "—"}` : entrada.compraId ? "lançada em Compras" : ""}
                            </div>
                          </div>
                        ) : nota.status === "authorized" && !recusada(nota) ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => setEntradaDe(nota)} style={botao(COLORS.branco, COLORS.verde)}>Dar entrada</button>
                            {!["confirmed"].includes(man) && (
                              <button onClick={() => setRecusarDe(nota)} style={botao(COLORS.vermelho, "#FFEBEE")}>Recusar</button>
                            )}
                          </div>
                        ) : <span style={{ color: COLORS.cinza, fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        {nota.isComplete ? (
                          <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => abrirEspelho(nota)} style={link} title="Espelho em PDF, gerado do XML">PDF</button>
                            <button onClick={() => baixarXml(nota)} style={link}>XML</button>
                          </div>
                        ) : man === "none" ? (
                          <span style={{ color: COLORS.cinza, fontSize: 12 }} title="A SEFAZ só libera o XML completo depois da manifestação">após manifestar</span>
                        ) : (
                          <button onClick={() => pegarXml(nota)} disabled={ocupado === nota.id} style={botao(COLORS.verde, "#D8F3DC")}>
                            {ocupado === nota.id ? "Buscando…" : "Buscar XML"}
                          </button>
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
          O app busca na SEFAZ, com o certificado A1 da empresa, toda NF-e emitida contra o CNPJ — ao abrir esta tela e uma vez
          por dia. A SEFAZ só deixa consultar de novo uma hora depois de não ter nada novo. Dar entrada confirma a
          operação na SEFAZ e registra a nota aqui como compra, devolução de cliente (ligada à venda) ou outra. Envie o .zip de
          XMLs ao contador junto com o das notas emitidas.
        </span>
      </div>

      {entradaDe && (
        <DarEntradaModal nota={entradaDe} dados={dados} setDados={setDados} frutas={frutas}
          onClose={() => setEntradaDe(null)} onManifestada={aoManifestar} />
      )}
      {recusarDe && <RecusarModal nota={recusarDe} onClose={() => setRecusarDe(null)} onManifestada={aoManifestar} />}
    </div>
  );
};

export default NotasRecebidas;

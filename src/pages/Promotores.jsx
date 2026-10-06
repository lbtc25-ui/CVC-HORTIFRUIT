import { useCallback, useEffect, useMemo, useState } from "react";

import AcoesPromotor from "../components/AcoesPromotor";
import { Btn, Card, Icon, Input, Modal, ModalImagem, Select } from "../components/ui";
import { modoSupabase } from "../lib/auth";
import { enderecoCompleto } from "../lib/cadastro";
import { diasDeAtraso, formatarData, hojeISO } from "../lib/datas";
import { novoId } from "../lib/mappers";
import {
  assinarTempoReal,
  arquivarRota,
  atualizarRota,
  continuarRotaHoje,
  criarRota,
  definirPrioridade,
  excluirRota,
  listarPromotores,
  listarRotas,
  listarRotasNaoConcluidas,
  urlDaFoto,
} from "../lib/promotores";
import { COLORS } from "../lib/tema";

const STATUS_ROTA = {
  pendente: { label: "Aguardando início", bg: COLORS.cinzaClaro, cor: COLORS.cinza },
  em_andamento: { label: "Em andamento", bg: "#FFF3CD", cor: "#856404" },
  concluida: { label: "Concluída", bg: COLORS.verdePale, cor: COLORS.verde },
  cancelada: { label: "Cancelada", bg: "#FFEBEE", cor: COLORS.vermelho },
};

const STATUS_PARADA = {
  pendente: { label: "Aguardando", cor: COLORS.cinza },
  em_andamento: { label: "Chegou — organizando", cor: "#856404" },
  concluida: { label: "Concluída", cor: COLORS.verde },
};

const horaCurta = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";

const EtiquetaStatus = ({ mapa, status }) => {
  const s = mapa[status] ?? mapa.pendente;
  return (
    <span style={{ background: s.bg ?? "transparent", color: s.cor, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
};

const paradaVazia = () => ({ chave: novoId(), estabelecimento: "", endereco: "", lojaId: null, prioridade: false });
const formVazio = () => ({ promotorId: "", nome: "", data: hojeISO() });
const JANELAS_DIAS = [3, 7, 14, 30];
const PILULA_FOTO = [["chegada", "fachada"], ["antes", "antes"], ["depois", "depois"]];

const rotuloDiasAtras = (dias) => (dias === 0 ? "hoje" : dias === 1 ? "ontem" : `${dias}d atrás`);

/** Minutos entre dois instantes ISO, ou null se algum faltar. */
const minutosEntre = (isoInicio, isoFim) => {
  if (!isoInicio || !isoFim) return null;
  const ms = new Date(isoFim) - new Date(isoInicio);
  return ms > 0 ? Math.round(ms / 60000) : 0;
};

/** "18 min" ou "1h 05min" — duração legível pro gestor acompanhar deslocamento e permanência. */
const formatarDuracao = (min) => {
  if (min == null) return null;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${m ? ` ${m}min` : ""}`;
};

/**
 * Painel do gestor: monta a rota de cada promotor e acompanha, em tempo
 * real, em qual loja ele está e as fotos de cada parada.
 */
export default function Promotores({ dados }) {
  const [filtroData, setFiltroData] = useState(hojeISO());
  const [rotas, setRotas] = useState([]);
  // Rotas de dias anteriores que ficaram pela metade — aparecem sempre, seja
  // qual for o filtro de data, com a opção de continuar hoje.
  const [naoConcluidas, setNaoConcluidas] = useState([]);
  const [promotores, setPromotores] = useState([]);
  const [carregando, setCarregando] = useState(modoSupabase);
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [expandida, setExpandida] = useState(null);
  // Rotas concluídas que o gestor arquivou ficam fora da lista, a não ser
  // que ele abra "Rotas arquivadas".
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false);

  const [fotoAberta, setFotoAberta] = useState(null);

  const [modalNovo, setModalNovo] = useState(false);
  // Id da rota aberta no modal para edição; null = criando uma nova.
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(formVazio);
  const [paradas, setParadas] = useState([paradaVazia()]);
  const [janelaDias, setJanelaDias] = useState(7);

  const recarregar = useCallback(async () => {
    try {
      const [listaRotas, listaPromotores, listaNaoConcluidas] = await Promise.all([
        listarRotas({ data: filtroData || undefined }),
        listarPromotores(),
        listarRotasNaoConcluidas(hojeISO()),
      ]);
      setRotas(listaRotas);
      setPromotores(listaPromotores);
      setNaoConcluidas(listaNaoConcluidas);
    } catch (err) {
      setAviso({ tipo: "erro", texto: String(err?.message ?? err) });
    } finally {
      setCarregando(false);
    }
  }, [filtroData]);

  // A carga inicial é um efeito próprio (em vez de chamar `recarregar`)
  // porque o lint de hooks recusa um setState síncrono dentro do efeito — e
  // `recarregar` chama `setCarregando` antes do primeiro `await` de dentro
  // dele. A assinatura em tempo real, mais abaixo, chama `recarregar` de
  // dentro do próprio callback dela — isso já não conta como síncrono.
  useEffect(() => {
    if (!modoSupabase) return undefined;
    let ativo = true;

    (async () => {
      try {
        const [listaRotas, listaPromotores, listaNaoConcluidas] = await Promise.all([
          listarRotas({ data: filtroData || undefined }),
          listarPromotores(),
          listarRotasNaoConcluidas(hojeISO()),
        ]);
        if (!ativo) return;
        setRotas(listaRotas);
        setPromotores(listaPromotores);
        setNaoConcluidas(listaNaoConcluidas);
      } catch (err) {
        if (ativo) setAviso({ tipo: "erro", texto: String(err?.message ?? err) });
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    const parar = assinarTempoReal(() => recarregar());
    return () => {
      ativo = false;
      parar();
    };
  }, [recarregar, filtroData]);

  const nomeDoPromotor = useMemo(() => {
    const mapa = Object.fromEntries(promotores.map((p) => [p.id, p.nome]));
    return (id) => mapa[id] ?? "—";
  }, [promotores]);

  /** Rede, loja e o rótulo completo de cada loja ativa, por id. */
  const infoLojaPorId = useMemo(() => {
    const redes = Object.fromEntries((dados?.redes ?? []).map((r) => [r.id, r.nome]));
    const mapa = {};
    for (const l of dados?.lojas ?? []) {
      if (l.status === "inativo") continue;
      const redeNome = redes[l.redeId] ?? "?";
      mapa[l.id] = { redeNome, lojaNome: l.nome, label: `${redeNome} — ${l.nome}`, endereco: enderecoCompleto(l) };
    }
    return mapa;
  }, [dados]);

  const lojasParaEscolher = useMemo(
    () => Object.entries(infoLojaPorId)
      .map(([id, info]) => ({ id, label: info.label }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
    [infoLojaPorId]
  );

  const rotuloLojaPorId = useMemo(
    () => Object.fromEntries(Object.entries(infoLojaPorId).map(([id, info]) => [id, info.label])),
    [infoLojaPorId]
  );

  /** Lojas com venda nos últimos `janelaDias` dias — sugestão pra montar a rota sem digitar. */
  const lojasComVendaRecente = useMemo(() => {
    const porLoja = new Map();
    for (const v of dados?.vendas ?? []) {
      if (v.status === "cancelado" || !v.lojaId || !infoLojaPorId[v.lojaId]) continue;
      const dias = diasDeAtraso(v.data);
      if (dias < 0 || dias > janelaDias) continue;
      const atual = porLoja.get(v.lojaId);
      if (!atual || dias < atual.diasAtras) porLoja.set(v.lojaId, { lojaId: v.lojaId, diasAtras: dias });
    }
    return [...porLoja.values()].map((r) => ({ ...r, ...infoLojaPorId[r.lojaId] }));
  }, [dados, janelaDias, infoLojaPorId]);

  /** A mesma lista, separada por rede — cada uma ordenada por quem comprou mais recente. */
  const gruposVendaRecente = useMemo(() => {
    const porRede = new Map();
    for (const item of lojasComVendaRecente) {
      const lista = porRede.get(item.redeNome) ?? [];
      lista.push(item);
      porRede.set(item.redeNome, lista);
    }
    return [...porRede.entries()]
      .map(([rede, itens]) => ({
        rede,
        itens: itens.sort((a, b) => a.diasAtras - b.diasAtras || a.lojaNome.localeCompare(b.lojaNome, "pt-BR")),
      }))
      .sort((a, b) => a.rede.localeCompare(b.rede, "pt-BR"));
  }, [lojasComVendaRecente]);

  /**
   * As rotas dos motoristas no romaneio do dia da rota — mesmo filtro e mesma
   * ordem da aba Romaneio (prioridade primeiro, depois a ordem da parada),
   * uma por veículo. Cada loja entra uma vez só, na primeira posição em que
   * aparece, mesmo que tenha mais de uma nota no caminhão.
   */
  const rotasDoRomaneio = useMemo(() => {
    const nomeVeiculo = Object.fromEntries((dados?.veiculos ?? []).map((v) => [v.id, v.nome]));
    const nomeMotorista = Object.fromEntries((dados?.funcionarios ?? []).map((f) => [f.id, f.nome]));
    const doDia = (dados?.vendas ?? [])
      .filter((v) => v.rotaData === form.data && v.veiculoId && v.status !== "cancelado" && v.statusEntrega !== "retirado_cd")
      .sort((a, b) => Number(Boolean(b.prioridade)) - Number(Boolean(a.prioridade)) || (a.ordemRota ?? 0) - (b.ordemRota ?? 0));

    const porVeiculo = new Map();
    for (const v of doDia) {
      const rota = porVeiculo.get(v.veiculoId) ?? { veiculoId: v.veiculoId, motoristaId: v.motoristaId, motoristaNome: v.motoristaNome, lojas: [] };
      if (!rota.motoristaId && v.motoristaId) rota.motoristaId = v.motoristaId;
      if (!rota.motoristaNome && v.motoristaNome) rota.motoristaNome = v.motoristaNome;
      if (v.lojaId && infoLojaPorId[v.lojaId]) {
        const existente = rota.lojas.find((l) => l.lojaId === v.lojaId);
        if (existente) existente.prioridade ||= Boolean(v.prioridade);
        else rota.lojas.push({ lojaId: v.lojaId, prioridade: Boolean(v.prioridade) });
      }
      porVeiculo.set(v.veiculoId, rota);
    }
    return [...porVeiculo.values()]
      .filter((r) => r.lojas.length)
      .map((r) => ({
        ...r,
        veiculo: nomeVeiculo[r.veiculoId] ?? "Veículo",
        motorista: r.motoristaId ? nomeMotorista[r.motoristaId] ?? "" : r.motoristaNome || "",
      }))
      .sort((a, b) => a.veiculo.localeCompare(b.veiculo, "pt-BR"));
  }, [dados, form.data, infoLojaPorId]);

  /** Troca as paradas pela rota do motorista, na mesma ordem do romaneio. */
  const usarRotaDoRomaneio = (rota) => {
    const temParadas = paradas.some((p) => p.estabelecimento.trim() || p.lojaId);
    if (temParadas && !confirm("Substituir os estabelecimentos já adicionados pela rota do motorista?")) return;
    // Na edição, o que o promotor já visitou fica (com fotos e horários) na frente.
    const visitadas = paradas.filter((p) => p.status && p.status !== "pendente");
    const jaVisitadas = new Set(visitadas.map((p) => p.lojaId).filter(Boolean));
    setParadas([...visitadas, ...rota.lojas.filter((l) => !jaVisitadas.has(l.lojaId)).map((l) => ({
      chave: novoId(),
      lojaId: l.lojaId,
      estabelecimento: infoLojaPorId[l.lojaId].label,
      endereco: infoLojaPorId[l.lojaId].endereco ?? "",
      prioridade: l.prioridade,
    }))]);
    setForm((f) => (f.nome.trim() ? f : { ...f, nome: `Rota ${rota.motorista || rota.veiculo}` }));
  };

  const executar = async (acao, mensagem) => {
    setOcupado(true);
    setAviso(null);
    try {
      await acao();
      await recarregar();
      if (mensagem) setAviso({ tipo: "ok", texto: mensagem });
      return true;
    } catch (err) {
      setAviso({ tipo: "erro", texto: String(err?.message ?? err) });
      return false;
    } finally {
      setOcupado(false);
    }
  };

  const abrirNovaRota = () => {
    setEditando(null);
    setForm(formVazio());
    setParadas([paradaVazia()]);
    setAviso(null);
    setModalNovo(true);
  };

  /** Abre o mesmo modal já preenchido com a rota, para ajustar o que for preciso. */
  const abrirEdicao = (rota) => {
    setEditando(rota.id);
    setForm({ promotorId: rota.promotorId, nome: rota.nome, data: rota.data });
    setParadas(rota.paradas.map((p) => ({
      chave: p.id,
      id: p.id,
      status: p.status,
      estabelecimento: p.estabelecimento,
      endereco: p.endereco,
      lojaId: p.lojaId ?? null,
      prioridade: p.prioridade,
    })));
    setAviso(null);
    setModalNovo(true);
  };

  const atualizarParada = (chave, patch) =>
    setParadas((atual) => atual.map((p) => (p.chave === chave ? { ...p, ...patch } : p)));

  const escolherLoja = (chave, lojaId) => {
    const loja = lojasParaEscolher.find((l) => l.id === lojaId);
    atualizarParada(chave, { lojaId: loja?.id ?? null, estabelecimento: loja?.label ?? "" });
  };

  /** Sugestão de "comprou recente" — some com a linha vazia inicial em vez de deixar as duas. */
  const adicionarParadaDeLoja = (lojaId) => {
    const label = rotuloLojaPorId[lojaId];
    if (!label) return;
    setParadas((atual) => {
      if (atual.some((p) => p.lojaId === lojaId)) return atual;
      const primeiraVazia = atual.length === 1 && !atual[0].estabelecimento.trim() && !atual[0].lojaId;
      if (primeiraVazia) return [{ ...atual[0], lojaId, estabelecimento: label }];
      return [...atual, { chave: novoId(), estabelecimento: label, endereco: "", lojaId, prioridade: false }];
    });
  };

  const moverParada = (indice, direcao) =>
    setParadas((atual) => {
      const novo = [...atual];
      const alvo = indice + direcao;
      if (alvo < 0 || alvo >= novo.length) return atual;
      [novo[indice], novo[alvo]] = [novo[alvo], novo[indice]];
      return novo;
    });

  const salvarNovaRota = async () => {
    const validas = paradas
      .map((p) => ({ ...p, estabelecimento: p.estabelecimento.trim() }))
      .filter((p) => p.estabelecimento);
    if (!validas.length) {
      setAviso({ tipo: "erro", texto: "Adicione ao menos um estabelecimento na rota." });
      return;
    }
    const campos = {
      promotorId: form.promotorId,
      nome: form.nome.trim() || `Rota ${formatarData(form.data)}`,
      data: form.data,
      paradas: validas,
    };
    const ok = await executar(
      () => (editando ? atualizarRota({ id: editando, ...campos }) : criarRota(campos)),
      editando ? "Rota atualizada." : "Rota criada."
    );
    if (ok) setModalNovo(false);
  };

  const apagar = (rota) => {
    if (!confirm(`Apagar a rota "${rota.nome}"? Esta ação não pode ser desfeita.`)) return;
    return executar(() => excluirRota(rota.id), "Rota apagada.");
  };

  const arquivar = (rota, arquivada) =>
    executar(
      () => arquivarRota(rota.id, arquivada),
      arquivada ? `Rota "${rota.nome}" arquivada.` : `Rota "${rota.nome}" voltou para a lista.`
    );

  // Passa uma rota que não terminou no dia dela para hoje — o promotor segue
  // de onde parou, sem perder as paradas já feitas.
  const continuarHoje = (rota) =>
    executar(() => continuarRotaHoje(rota.id, hojeISO()), `Rota "${rota.nome}" passou para hoje.`);

  const alternarPrioridade = async (parada) => {
    try {
      await definirPrioridade(parada.id, !parada.prioridade);
      await recarregar();
    } catch (err) {
      setAviso({ tipo: "erro", texto: String(err?.message ?? err) });
    }
  };

  const verFoto = async (caminho) => {
    try {
      const url = await urlDaFoto(caminho);
      if (url) setFotoAberta(url);
    } catch (err) {
      setAviso({ tipo: "erro", texto: String(err?.message ?? err) });
    }
  };

  const rotasAtivas = rotas.filter((r) => !r.arquivada);
  const rotasArquivadas = rotas.filter((r) => r.arquivada);
  const rotasNaTela = mostrarArquivadas ? [...rotasAtivas, ...rotasArquivadas] : rotasAtivas;

  if (!modoSupabase) {
    return (
      <Card>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Icon name="alert" color={COLORS.laranjaEscuro} size={20} />
          <div style={{ fontSize: 14, color: COLORS.cinzaEscuro, lineHeight: 1.6 }}>
            <strong>Rotas de promotor precisam do Supabase configurado.</strong> É ele que guarda
            as fotos e avisa esta tela em tempo real conforme o promotor visita cada loja. Configure
            <code> VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> (veja o README) e
            rode <code>supabase/migracao-08-promotores.sql</code>.
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Input type="date" value={filtroData} onChange={(e) => setFiltroData(e.target.value)} style={{ width: 160 }} />
          <Btn variant="secondary" onClick={() => setFiltroData("")} disabled={!filtroData}>Todas as datas</Btn>
        </div>
        <Btn icon="plus" onClick={abrirNovaRota}>Nova Rota</Btn>
      </div>

      {aviso && (
        <div style={{
          background: aviso.tipo === "erro" ? "#FFEBEE" : COLORS.verdePale,
          border: `1px solid ${aviso.tipo === "erro" ? "#F5C2C7" : "#A7D8BB"}`,
          color: aviso.tipo === "erro" ? "#B02A37" : COLORS.verde,
          borderRadius: 10, padding: "11px 14px", fontSize: 13, display: "flex", gap: 9, alignItems: "flex-start",
        }}>
          <Icon name={aviso.tipo === "erro" ? "alert" : "check"} size={16} color={aviso.tipo === "erro" ? "#B02A37" : COLORS.verde} />
          <span style={{ lineHeight: 1.45 }}>{aviso.texto}</span>
        </div>
      )}

      {naoConcluidas.length > 0 && (
        <Card style={{ borderLeft: `4px solid ${COLORS.laranja}` }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.cinzaEscuro, marginBottom: 4 }}>
            Rotas de dias anteriores não concluídas
          </div>
          <div style={{ fontSize: 12.5, color: COLORS.cinza, marginBottom: 10 }}>
            "Continuar hoje" passa a rota para hoje: o promotor segue de onde parou, e as paradas já feitas continuam registradas.
          </div>
          {naoConcluidas.map((rota) => {
            const feitas = rota.paradas.filter((p) => p.status === "concluida").length;
            return (
              <div key={rota.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 0", borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
                <div style={{ fontSize: 13, color: COLORS.cinzaEscuro, minWidth: 0 }}>
                  <strong>{rota.nome}</strong> · {nomeDoPromotor(rota.promotorId)} · {formatarData(rota.data)} · {feitas}/{rota.paradas.length} paradas
                </div>
                <Btn icon="rota" disabled={ocupado} style={{ padding: "5px 11px", fontSize: 12 }} onClick={() => continuarHoje(rota)}>
                  Continuar hoje
                </Btn>
              </div>
            );
          })}
        </Card>
      )}

      {carregando ? (
        <Card><div style={{ color: COLORS.cinza, textAlign: "center", padding: 20 }}>Carregando rotas…</div></Card>
      ) : rotasNaTela.length === 0 && rotasArquivadas.length === 0 ? (
        <Card><div style={{ color: COLORS.cinza, textAlign: "center", padding: 20 }}>Nenhuma rota {filtroData ? "nesta data" : "cadastrada"}.</div></Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rotasNaTela.length === 0 && (
            <Card><div style={{ color: COLORS.cinza, textAlign: "center", padding: 20 }}>Todas as rotas {filtroData ? "desta data " : ""}estão arquivadas.</div></Card>
          )}
          {rotasNaTela.map((rota) => {
            const concluidas = rota.paradas.filter((p) => p.status === "concluida").length;
            const aberta = expandida === rota.id;
            return (
              <Card key={rota.id} style={{ padding: 0, opacity: rota.arquivada ? 0.75 : 1 }}>
                <div
                  onClick={() => setExpandida(aberta ? null : rota.id)}
                  style={{ padding: 18, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                      <strong style={{ color: COLORS.cinzaEscuro, fontSize: 15 }}>{rota.nome}</strong>
                      <EtiquetaStatus mapa={STATUS_ROTA} status={rota.status} />
                      {rota.arquivada && (
                        <span style={{ background: COLORS.cinzaClaro, color: COLORS.cinza, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                          Arquivada
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: COLORS.cinza, marginTop: 4 }}>
                      {nomeDoPromotor(rota.promotorId)} · {formatarData(rota.data)} · {concluidas}/{rota.paradas.length} paradas
                      {rota.iniciadaEm && <> · iniciada às {horaCurta(rota.iniciadaEm)}</>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {(rota.status === "concluida" || rota.arquivada) && (
                      <Btn variant="ghost" disabled={ocupado}
                        style={{ padding: "5px 11px", fontSize: 12 }}
                        title={rota.arquivada ? "Volta a rota para a lista" : "Rota concluída — tira ela da lista sem apagar paradas nem fotos"}
                        onClick={(e) => { e.stopPropagation(); arquivar(rota, !rota.arquivada); }}>
                        {rota.arquivada ? "Desarquivar" : "Arquivar"}
                      </Btn>
                    )}
                    <Btn variant="secondary" icon="edit" disabled={ocupado}
                      style={{ padding: "5px 11px", fontSize: 12 }}
                      onClick={(e) => { e.stopPropagation(); abrirEdicao(rota); }}>
                      Editar
                    </Btn>
                    <Btn variant="danger" icon="trash" disabled={ocupado}
                      style={{ padding: "5px 11px", fontSize: 12 }}
                      onClick={(e) => { e.stopPropagation(); apagar(rota); }}>
                      Apagar
                    </Btn>
                    <Icon name={aberta ? "close" : "search"} size={16} color={COLORS.cinza} />
                  </div>
                </div>

                {aberta && (
                  <div style={{ borderTop: `1px solid ${COLORS.cinzaClaro}`, padding: "6px 18px 18px" }}>
                    {rota.paradas.map((parada, i) => {
                      const deslocamento = i > 0
                        ? formatarDuracao(minutosEntre(rota.paradas[i - 1].concluidaEm, parada.chegadaEm))
                        : null;
                      const permanencia = formatarDuracao(minutosEntre(parada.chegadaEm, parada.concluidaEm));
                      const fotos = { chegada: parada.fotoChegada, antes: parada.fotoAntes, depois: parada.fotoDepois };
                      return (
                        <div key={parada.id} style={{ display: "flex", gap: 12, padding: "12px 0", borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
                          <div style={{ width: 26, height: 26, borderRadius: "50%", background: COLORS.cinzaClaro, color: COLORS.cinzaEscuro, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                            {parada.ordem}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {deslocamento && (
                              <div style={{ fontSize: 11.5, color: COLORS.azul, marginBottom: 4 }}>
                                🚗 {deslocamento} de deslocamento até aqui
                              </div>
                            )}
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: COLORS.cinzaEscuro, fontSize: 14 }}>
                                <button type="button" onClick={() => alternarPrioridade(parada)}
                                  title={parada.prioridade ? "Tirar prioridade" : "Marcar como prioridade"}
                                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                                  <Icon name="estrela" size={16} color={parada.prioridade ? COLORS.dourado : COLORS.cinzaClaro} />
                                </button>
                                {parada.estabelecimento}
                              </div>
                              <EtiquetaStatus mapa={STATUS_PARADA} status={parada.status} />
                            </div>
                            {parada.endereco && <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: 2 }}>{parada.endereco}</div>}
                            <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: 4 }}>
                              {parada.chegadaEm && <>chegou às {horaCurta(parada.chegadaEm)}</>}
                              {parada.concluidaEm && <> · saiu às {horaCurta(parada.concluidaEm)}</>}
                              {permanencia && <> · ficou {permanencia} no local</>}
                            </div>
                            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                              {PILULA_FOTO.map(([tipo, rotulo]) => (
                                <Btn key={tipo} variant="secondary" icon="camera" disabled={!fotos[tipo]}
                                  style={{ padding: "4px 10px", fontSize: 11 }}
                                  onClick={() => verFoto(fotos[tipo])}>
                                  {rotulo}{fotos[tipo] ? "" : " (aguardando)"}
                                </Btn>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
          {rotasArquivadas.length > 0 && (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Btn variant="secondary" style={{ padding: "5px 11px", fontSize: 12 }}
                onClick={() => setMostrarArquivadas((v) => !v)}>
                {mostrarArquivadas ? "Esconder rotas arquivadas" : `Rotas arquivadas (${rotasArquivadas.length})`}
              </Btn>
            </div>
          )}
        </div>
      )}

      <AcoesPromotor dados={dados} promotores={promotores} filtroData={filtroData} />

      {modalNovo && (
        <Modal title={editando ? "Editar Rota" : "Nova Rota"} onClose={() => setModalNovo(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Select label="Promotor *" value={form.promotorId}
              options={[{ value: "", label: promotores.length ? "Escolha…" : "Nenhum promotor cadastrado" }, ...promotores.map((p) => ({ value: p.id, label: p.nome }))]}
              onChange={(e) => setForm((f) => ({ ...f, promotorId: e.target.value }))} />
            {promotores.length === 0 && (
              <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: -6, lineHeight: 1.5 }}>
                Cadastre um promotor primeiro, na aba Usuários (papel "Promotor").
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <Input label="Nome da rota" placeholder={`Rota ${formatarData(form.data)}`} value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} style={{ flex: 1 }} />
              <Input label="Data *" type="date" value={form.data}
                onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.cinzaEscuro }}>
                Seguir a rota de um motorista (romaneio de {formatarData(form.data)})
              </label>
              {rotasDoRomaneio.length === 0 ? (
                <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: 6, lineHeight: 1.5 }}>
                  Nenhuma rota montada no Romaneio para esta data.
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {rotasDoRomaneio.map((r) => (
                    <button key={r.veiculoId} type="button" onClick={() => usarRotaDoRomaneio(r)}
                      title="Preenche os estabelecimentos na mesma ordem das entregas"
                      style={{
                        display: "flex", alignItems: "center", gap: 6, borderRadius: 20, padding: "5px 12px",
                        fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                        border: `1.5px solid ${COLORS.cinzaClaro}`, background: COLORS.branco, color: COLORS.cinzaEscuro,
                      }}>
                      🚚 {r.motorista || r.veiculo}
                      <span style={{ fontWeight: 400, color: COLORS.cinza }}>
                        {r.motorista ? `· ${r.veiculo} ` : ""}· {r.lojas.length} {r.lojas.length === 1 ? "loja" : "lojas"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {gruposVendaRecente.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.cinzaEscuro }}>
                    Compraram recentemente — clique para adicionar
                  </label>
                  <Select value={String(janelaDias)}
                    options={JANELAS_DIAS.map((d) => ({ value: String(d), label: `Últimos ${d} dias` }))}
                    onChange={(e) => setJanelaDias(Number(e.target.value))}
                    style={{ padding: "4px 8px", fontSize: 12 }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                  {gruposVendaRecente.map((grupo) => (
                    <div key={grupo.rede}>
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: COLORS.cinza, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 5 }}>
                        {grupo.rede}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {grupo.itens.map((r) => {
                          const jaAdicionada = paradas.some((p) => p.lojaId === r.lojaId);
                          return (
                            <button key={r.lojaId} type="button" disabled={jaAdicionada}
                              onClick={() => adicionarParadaDeLoja(r.lojaId)}
                              style={{
                                display: "flex", alignItems: "center", gap: 6, borderRadius: 20, padding: "5px 12px",
                                fontSize: 12.5, fontWeight: 600, cursor: jaAdicionada ? "default" : "pointer",
                                border: `1.5px solid ${jaAdicionada ? COLORS.verde : COLORS.cinzaClaro}`,
                                background: jaAdicionada ? COLORS.verdePale : COLORS.branco,
                                color: jaAdicionada ? COLORS.verde : COLORS.cinzaEscuro,
                              }}>
                              {jaAdicionada ? "✓" : "+"} {r.lojaNome}
                              <span style={{ fontWeight: 400, color: COLORS.cinza }}>· {rotuloDiasAtras(r.diasAtras)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.cinzaEscuro }}>Estabelecimentos, na ordem da visita</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                {paradas.map((p, i) => {
                  // Parada já visitada: fica na rota (tem fotos e horários) e
                  // não troca de estabelecimento — só dá para mudar a ordem.
                  const visitada = Boolean(p.status && p.status !== "pendente");
                  return (
                  <div key={p.chave} style={{ border: `1px solid ${COLORS.cinzaClaro}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, color: COLORS.cinza, fontWeight: 700 }}>
                        #{i + 1}
                        {visitada && <span style={{ fontWeight: 600, marginLeft: 8, color: STATUS_PARADA[p.status]?.cor }}>{STATUS_PARADA[p.status]?.label}</span>}
                      </span>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <button type="button"
                          onClick={() => atualizarParada(p.chave, { prioridade: !p.prioridade })}
                          title={p.prioridade ? "Tirar prioridade" : "Marcar como prioridade"}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
                          <Icon name="estrela" size={15} color={p.prioridade ? COLORS.dourado : COLORS.cinzaClaro} />
                        </button>
                        <button type="button" onClick={() => moverParada(i, -1)} disabled={i === 0}
                          style={{ background: "none", border: "none", cursor: i === 0 ? "not-allowed" : "pointer", opacity: i === 0 ? 0.35 : 1, padding: 4 }}>▲</button>
                        <button type="button" onClick={() => moverParada(i, 1)} disabled={i === paradas.length - 1}
                          style={{ background: "none", border: "none", cursor: i === paradas.length - 1 ? "not-allowed" : "pointer", opacity: i === paradas.length - 1 ? 0.35 : 1, padding: 4 }}>▼</button>
                        <button type="button" onClick={() => setParadas((atual) => atual.filter((x) => x.chave !== p.chave))}
                          disabled={visitada} title={visitada ? "Parada já visitada — não pode sair da rota" : "Tirar da rota"}
                          style={{ background: "none", border: "none", cursor: visitada ? "not-allowed" : "pointer", opacity: visitada ? 0.35 : 1, padding: 4 }}>
                          <Icon name="trash" size={15} color={COLORS.vermelho} />
                        </button>
                      </div>
                    </div>
                    {lojasParaEscolher.length > 0 && !visitada && (
                      <Select value={p.lojaId ?? ""} options={[{ value: "", label: "— loja cadastrada (opcional) —" }, ...lojasParaEscolher.map((l) => ({ value: l.id, label: l.label }))]}
                        onChange={(e) => escolherLoja(p.chave, e.target.value)} />
                    )}
                    <Input placeholder="Estabelecimento *" value={p.estabelecimento} disabled={visitada}
                      onChange={(e) => atualizarParada(p.chave, { estabelecimento: e.target.value, lojaId: null })} />
                    <Input placeholder="Endereço (opcional)" value={p.endereco}
                      onChange={(e) => atualizarParada(p.chave, { endereco: e.target.value })} />
                  </div>
                  );
                })}
              </div>
              <Btn variant="ghost" icon="plus" style={{ marginTop: 10 }}
                onClick={() => setParadas((atual) => [...atual, paradaVazia()])}>
                Adicionar estabelecimento
              </Btn>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
              <Btn variant="secondary" onClick={() => setModalNovo(false)}>Cancelar</Btn>
              <Btn onClick={salvarNovaRota} disabled={ocupado || !form.promotorId || !form.data}>
                {ocupado ? "Salvando…" : editando ? "Salvar alterações" : "Criar rota"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {fotoAberta && <ModalImagem src={fotoAberta} alt="Foto da parada" onClose={() => setFotoAberta(null)} />}
    </div>
  );
}

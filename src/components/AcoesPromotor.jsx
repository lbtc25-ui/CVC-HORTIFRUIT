import { useCallback, useEffect, useMemo, useState } from "react";

import { Btn, Card, Icon, Input, Modal, ModalImagem, Select } from "./ui";
import { enderecoCompleto } from "../lib/cadastro";
import { formatarData, hojeISO, rotuloHorario } from "../lib/datas";
import {
  arquivarAcao,
  assinarTempoReal,
  excluirAcao,
  listarAcoes,
  salvarAcao,
  urlDaFoto,
} from "../lib/promotores";
import { COLORS } from "../lib/tema";

const STATUS_ACAO = {
  pendente: { label: "A realizar", bg: "#FFF3CD", cor: "#856404" },
  concluida: { label: "Realizada", bg: COLORS.verdePale, cor: COLORS.verde },
  cancelada: { label: "Cancelada", bg: "#FFEBEE", cor: COLORS.vermelho },
};

const DURACOES = [30, 60, 90, 120, 180, 240, 300, 360, 480].map((min) => ({
  value: String(min),
  label: min < 60 ? `${min} min` : min % 60 ? `${Math.floor(min / 60)}h30` : `${min / 60}h`,
}));

const formVazio = (data) => ({ promotorId: "", titulo: "", descricao: "", data, hora: "", duracaoMin: "", lojaId: "", estabelecimento: "", endereco: "" });

const horaCurta = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";

/**
 * Ações dos promotores no painel do gestor: eventos em loja, divulgação etc.
 * O gestor lança a ação (promotor, loja, data, o que fazer); o promotor
 * conclui em "Minha Rota" com a foto do evento, que aparece aqui.
 */
export default function AcoesPromotor({ dados, promotores, filtroData }) {
  const [acoes, setAcoes] = useState([]);
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(() => formVazio(hojeISO()));
  const [fotoAberta, setFotoAberta] = useState(null);
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      setAcoes(await listarAcoes({ data: filtroData || undefined }));
    } catch (err) {
      setAviso({ tipo: "erro", texto: String(err?.message ?? err) });
    }
  }, [filtroData]);

  useEffect(() => {
    let ativo = true;
    listarAcoes({ data: filtroData || undefined })
      .then((lista) => ativo && setAcoes(lista))
      .catch((err) => ativo && setAviso({ tipo: "erro", texto: String(err?.message ?? err) }));
    const parar = assinarTempoReal(() => recarregar());
    return () => {
      ativo = false;
      parar();
    };
  }, [filtroData, recarregar]);

  const nomeDoPromotor = useMemo(() => {
    const mapa = Object.fromEntries(promotores.map((p) => [p.id, p.nome]));
    return (id) => mapa[id] ?? "—";
  }, [promotores]);

  const lojas = useMemo(() => {
    const redes = Object.fromEntries((dados?.redes ?? []).map((r) => [r.id, r.nome]));
    return (dados?.lojas ?? [])
      .filter((l) => l.status !== "inativo")
      .map((l) => ({ id: l.id, label: `${redes[l.redeId] ?? "?"} — ${l.nome}`, endereco: enderecoCompleto(l) }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [dados]);

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

  const abrirNova = () => {
    setEditando(null);
    setForm(formVazio(filtroData || hojeISO()));
    setAviso(null);
    setModal(true);
  };

  const abrirEdicao = (a) => {
    setEditando(a.id);
    setForm({
      promotorId: a.promotorId, titulo: a.titulo, descricao: a.descricao, data: a.data, hora: a.hora ?? "", duracaoMin: a.duracaoMin ?? "",
      lojaId: a.lojaId ?? "", estabelecimento: a.estabelecimento, endereco: a.endereco,
    });
    setAviso(null);
    setModal(true);
  };

  const escolherLoja = (lojaId) => {
    const loja = lojas.find((l) => l.id === lojaId);
    setForm((f) => ({
      ...f,
      lojaId,
      estabelecimento: loja?.label ?? f.estabelecimento,
      endereco: loja ? loja.endereco ?? "" : f.endereco,
    }));
  };

  const salvar = async () => {
    const ok = await executar(
      () => salvarAcao({ id: editando ?? undefined, ...form, lojaId: form.lojaId || null }),
      editando ? "Ação atualizada." : "Ação lançada para o promotor."
    );
    if (ok) setModal(false);
  };

  const apagar = (a) => {
    if (!confirm(`Apagar a ação "${a.titulo}"? Esta ação não pode ser desfeita.`)) return;
    return executar(() => excluirAcao(a.id), "Ação apagada.");
  };

  const verFoto = async (caminho) => {
    try {
      const url = await urlDaFoto(caminho);
      if (url) setFotoAberta(url);
    } catch (err) {
      setAviso({ tipo: "erro", texto: String(err?.message ?? err) });
    }
  };

  const ativas = acoes.filter((a) => !a.arquivada);
  const arquivadas = acoes.filter((a) => a.arquivada);
  const naTela = mostrarArquivadas ? [...ativas, ...arquivadas] : ativas;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.cinzaEscuro }}>Ações dos promotores</div>
          <div style={{ fontSize: 12.5, color: COLORS.cinza }}>
            Evento em loja, divulgação e outras ações além da arrumação do expositor.
          </div>
        </div>
        <Btn icon="plus" onClick={abrirNova}>Nova Ação</Btn>
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

      {naTela.length === 0 ? (
        <Card><div style={{ color: COLORS.cinza, textAlign: "center", padding: 20 }}>Nenhuma ação {filtroData ? "nesta data" : "lançada"}.</div></Card>
      ) : naTela.map((a) => {
        const s = STATUS_ACAO[a.status] ?? STATUS_ACAO.pendente;
        return (
          <Card key={a.id} style={{ opacity: a.arquivada ? 0.75 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                  <strong style={{ color: COLORS.cinzaEscuro, fontSize: 15 }}>{a.titulo}</strong>
                  <span style={{ background: s.bg, color: s.cor, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{s.label}</span>
                  {a.arquivada && (
                    <span style={{ background: COLORS.cinzaClaro, color: COLORS.cinza, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Arquivada</span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: COLORS.cinza, marginTop: 4 }}>
                  {nomeDoPromotor(a.promotorId)} · {formatarData(a.data)}{a.hora && <> às {rotuloHorario(a.hora, a.duracaoMin)}</>} · {a.estabelecimento}
                  {a.concluidaEm && <> · realizada às {horaCurta(a.concluidaEm)}</>}
                </div>
                {a.descricao && <div style={{ fontSize: 13, color: COLORS.cinzaEscuro, marginTop: 6, lineHeight: 1.45 }}>{a.descricao}</div>}
                {a.observacao && (
                  <div style={{ fontSize: 12.5, color: COLORS.cinza, marginTop: 6, lineHeight: 1.45 }}>
                    <strong>Retorno do promotor:</strong> {a.observacao}
                  </div>
                )}
                {a.foto && (
                  <Btn variant="secondary" icon="camera" style={{ padding: "4px 10px", fontSize: 11, marginTop: 8 }}
                    onClick={() => verFoto(a.foto)}>
                    foto do evento
                  </Btn>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {(a.status === "concluida" || a.arquivada) && (
                  <Btn variant="ghost" disabled={ocupado} style={{ padding: "5px 11px", fontSize: 12 }}
                    onClick={() => executar(() => arquivarAcao(a.id, !a.arquivada))}>
                    {a.arquivada ? "Desarquivar" : "Arquivar"}
                  </Btn>
                )}
                <Btn variant="secondary" icon="edit" disabled={ocupado} style={{ padding: "5px 11px", fontSize: 12 }}
                  onClick={() => abrirEdicao(a)}>
                  Editar
                </Btn>
                <Btn variant="danger" icon="trash" disabled={ocupado} style={{ padding: "5px 11px", fontSize: 12 }}
                  onClick={() => apagar(a)}>
                  Apagar
                </Btn>
              </div>
            </div>
          </Card>
        );
      })}

      {arquivadas.length > 0 && (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Btn variant="secondary" style={{ padding: "5px 11px", fontSize: 12 }} onClick={() => setMostrarArquivadas((v) => !v)}>
            {mostrarArquivadas ? "Esconder ações arquivadas" : `Ações arquivadas (${arquivadas.length})`}
          </Btn>
        </div>
      )}

      {modal && (
        <Modal title={editando ? "Editar Ação" : "Nova Ação"} onClose={() => setModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Select label="Promotor *" value={form.promotorId}
              options={[{ value: "", label: promotores.length ? "Escolha…" : "Nenhum promotor cadastrado" }, ...promotores.map((p) => ({ value: p.id, label: p.nome }))]}
              onChange={(e) => setForm((f) => ({ ...f, promotorId: e.target.value }))} />
            <div style={{ display: "flex", gap: 10 }}>
              <Input label="Título *" placeholder="Ex.: Evento de divulgação — laranja" value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} style={{ flex: 1 }} />
              <Input label="Data *" type="date" value={form.data}
                onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
              <Input label="Horário" type="time" value={form.hora}
                onChange={(e) => setForm((f) => ({ ...f, hora: e.target.value }))} />
              <Select label="Duração" value={form.duracaoMin}
                options={[{ value: "", label: "—" }, ...DURACOES]}
                onChange={(e) => setForm((f) => ({ ...f, duracaoMin: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.cinzaEscuro }}>O que fazer</label>
              <textarea value={form.descricao} rows={3}
                placeholder="Detalhes da ação: o que montar, o que divulgar, horário combinado com a loja…"
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                style={{ width: "100%", boxSizing: "border-box", marginTop: 6, padding: 10, borderRadius: 8, border: `1px solid ${COLORS.cinzaClaro}`, fontSize: 14, fontFamily: "inherit", resize: "vertical" }} />
            </div>
            {lojas.length > 0 && (
              <Select label="Loja cadastrada" value={form.lojaId}
                options={[{ value: "", label: "— escolha ou digite abaixo —" }, ...lojas.map((l) => ({ value: l.id, label: l.label }))]}
                onChange={(e) => escolherLoja(e.target.value)} />
            )}
            <Input label="Estabelecimento *" value={form.estabelecimento}
              onChange={(e) => setForm((f) => ({ ...f, estabelecimento: e.target.value, lojaId: "" }))} />
            <Input label="Endereço" placeholder="Opcional" value={form.endereco}
              onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Btn variant="secondary" onClick={() => setModal(false)}>Cancelar</Btn>
              <Btn onClick={salvar} disabled={ocupado || !form.promotorId || !form.data || !form.titulo.trim() || !form.estabelecimento.trim()}>
                {ocupado ? "Salvando…" : editando ? "Salvar alterações" : "Lançar ação"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {fotoAberta && <ModalImagem src={fotoAberta} alt="Foto do evento" onClose={() => setFotoAberta(null)} />}
    </div>
  );
}

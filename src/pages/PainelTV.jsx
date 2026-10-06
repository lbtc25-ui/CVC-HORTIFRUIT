import { useEffect, useMemo, useState } from "react";

import { Icon } from "../components/ui";
import { modoSupabase } from "../lib/auth";
import { dataPorExtenso, diasDeAtraso, hojeISO } from "../lib/datas";
import { vendaAindaNoDeposito } from "../lib/entregas";
import { assinarTempoReal, listarPromotores, listarRotas } from "../lib/promotores";
import { observarSync } from "../lib/sync";

// Paleta própria para a TV: fundo escuro, letra grande, dá pra ler de longe
// — os tons de painel/interface (COLORS) foram pensados para tela de perto.
const TV = {
  fundo: "#0F1A14",
  cartao: "rgba(255,255,255,0.055)",
  borda: "rgba(255,255,255,0.09)",
  texto: "#F4F4EF",
  textoFraco: "rgba(244,244,239,0.55)",
  verde: "#52B788",
  laranja: "#F4A261",
  amarelo: "#FFD166",
  vermelho: "#F28482",
};

const horaCurta = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;

// A TV fica ligada o dia todo sem ninguém clicar em nada: ela mesma puxa os
// dados de novo neste intervalo, sem esperar a sincronização de 1 min do app
// (que o navegador pode atrasar quando a janela não está em foco).
const INTERVALO_ATUALIZAR_TV = 20_000;

const rotuloDiasAtras = (dias) => (dias <= 0 ? "hoje" : dias === 1 ? "há 1 dia" : `há ${dias} dias`);

/** "Saindo de X → Destino: Y" a partir de uma lista de paradas em ordem, já com `concluida(p)`. */
function statusDaRota(paradas, concluida, origemPadrao) {
  const faltam = paradas.filter((p) => !concluida(p));
  if (paradas.length === 0) return { situacao: "sem_parada" };
  if (faltam.length === 0) return { situacao: "concluida" };
  const atual = faltam[0];
  const indice = paradas.indexOf(atual);
  const anterior = indice > 0 ? paradas[indice - 1] : null;
  return {
    situacao: "em_curso",
    atual,
    // A próxima parada depois da atual, pra mostrar "próximo destino" quando
    // já chegou na atual e está só organizando — só faz sentido nesse caso.
    proximo: faltam[1] ?? null,
    origem: anterior ? anterior._nome : origemPadrao,
    concluidas: paradas.length - faltam.length,
    total: paradas.length,
  };
}

/** Um card de rota (veículo ou promotor) — mesmo layout para os dois lados. */
function CartaoRota({ titulo, subtitulo, icone, cor, resumo, onVerParadas }) {
  const { situacao } = resumo;
  const [emFoco, setEmFoco] = useState(false);
  const clicavel = resumo.total > 0 && typeof onVerParadas === "function";
  return (
    <div
      onClick={clicavel ? onVerParadas : undefined}
      onMouseEnter={() => clicavel && setEmFoco(true)}
      onMouseLeave={() => setEmFoco(false)}
      role={clicavel ? "button" : undefined}
      tabIndex={clicavel ? 0 : undefined}
      onKeyDown={clicavel ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onVerParadas(); } } : undefined}
      style={{
        background: TV.cartao, border: `1px solid ${emFoco ? cor : TV.borda}`, borderRadius: 16,
        padding: "18px 22px", display: "flex", flexDirection: "column", gap: 8,
        cursor: clicavel ? "pointer" : "default", transition: "border-color 0.15s",
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: `${cor}26`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Icon name={icone} size={24} color={cor} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 21, fontWeight: 800, color: TV.texto, lineHeight: 1.2 }}>{titulo}</div>
          {subtitulo && <div style={{ fontSize: 14, color: TV.textoFraco, marginTop: 1 }}>{subtitulo}</div>}
        </div>
        {resumo.total > 0 && (
          <div style={{ marginLeft: "auto", textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: TV.texto }}>{resumo.concluidas}/{resumo.total}</div>
            <div style={{ fontSize: 11.5, color: clicavel ? cor : TV.textoFraco }}>paradas</div>
          </div>
        )}
      </div>

      {situacao === "sem_parada" && (
        <div style={{ fontSize: 16, color: TV.textoFraco, marginTop: 4 }}>Sem paradas hoje.</div>
      )}
      {situacao === "concluida" && (
        <div style={{ fontSize: 18, color: TV.verde, fontWeight: 700, marginTop: 4 }}>✓ Tudo entregue</div>
      )}
      {situacao === "nao_iniciada" && (
        <div style={{ fontSize: 18, color: TV.textoFraco, fontWeight: 600, marginTop: 4 }}>Ainda não saiu</div>
      )}
      {situacao === "em_curso" && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 13, color: TV.textoFraco, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>
            {resumo.rotulo}
          </div>
          {resumo.chegou ? (
            <>
              <div style={{ fontSize: 19, color: TV.texto, fontWeight: 700, marginTop: 3, lineHeight: 1.35 }}>
                Parado em <span style={{ color: cor }}>{resumo.atual._nome}</span>
              </div>
              {resumo.proximo && (
                <div style={{ fontSize: 19, color: TV.texto, fontWeight: 700, lineHeight: 1.35 }}>
                  Próximo destino: <span style={{ color: cor }}>{resumo.proximo._nome}</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ fontSize: 19, color: TV.texto, fontWeight: 700, marginTop: 3, lineHeight: 1.35 }}>
                Saindo de <span style={{ color: cor }}>{resumo.origem}</span>
              </div>
              <div style={{ fontSize: 19, color: TV.texto, fontWeight: 700, lineHeight: 1.35 }}>
                Destino: <span style={{ color: cor }}>{resumo.atual._nome}</span>
              </div>
            </>
          )}
          {resumo.horaAtual && (
            <div style={{ fontSize: 13, color: TV.textoFraco, marginTop: 5 }}>desde {resumo.horaAtual}</div>
          )}
        </div>
      )}
    </div>
  );
}

/** Modal com a lista completa de paradas de uma rota, em ordem. */
function ModalParadas({ titulo, cor, paradas, onClose }) {
  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onClose]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24,
    }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" style={{
        background: "#152018", border: `1px solid ${TV.borda}`, borderRadius: 18,
        width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto", padding: "20px 22px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: TV.texto }}>{titulo}</div>
          <button type="button" onClick={onClose} aria-label="Fechar" style={{
            background: "rgba(255,255,255,0.08)", border: `1px solid ${TV.borda}`, borderRadius: 8,
            width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0,
          }}>
            <Icon name="close" size={15} color={TV.textoFraco} />
          </button>
        </div>
        {paradas.length === 0 ? (
          <div style={{ fontSize: 15, color: TV.textoFraco }}>Sem paradas.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {paradas.map((p, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 4px",
                borderBottom: i < paradas.length - 1 ? `1px solid ${TV.borda}` : "none",
                opacity: p.estado === "pendente" ? 0.65 : 1,
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: p.estado === "concluida" ? `${TV.verde}26` : p.estado === "atual" ? `${cor}26` : "rgba(255,255,255,0.06)",
                  border: `1px solid ${p.estado === "concluida" ? TV.verde : p.estado === "atual" ? cor : TV.borda}`,
                }}>
                  {p.estado === "concluida" && <Icon name="check" size={13} color={TV.verde} />}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: TV.texto, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {i + 1}. {p.nome}
                  </div>
                </div>
                {p.estado === "atual" && (
                  <span style={{ fontSize: 11, fontWeight: 800, color: cor, textTransform: "uppercase", flexShrink: 0 }}>atual</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Uma linha da lista de pedidos pendentes — mais compacta que o card de rota. */
function LinhaPedido({ pedido }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "12px 4px",
      borderBottom: `1px solid ${TV.borda}`,
    }}>
      {pedido.prioridade && <Icon name="estrela" size={15} color={TV.amarelo} />}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: TV.texto, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          #{pedido.numero ?? "—"} · {pedido._nome}
        </div>
      </div>
      <div style={{ fontSize: 13, color: TV.textoFraco, flexShrink: 0, whiteSpace: "nowrap" }}>
        {rotuloDiasAtras(diasDeAtraso(pedido.data))}
      </div>
    </div>
  );
}

/**
 * Painel para TV: entregas (motoristas) e promotores lado a lado, letra
 * grande, sem menu — pensado para ficar espelhado numa tela o dia todo.
 * Sai do modo TV com o botão no topo; entra pela aba "Painel TV" (só quem
 * gerencia vê essa aba).
 */
export default function PainelTV({ dados, onSair, sincronizarAgora }) {
  const hoje = hojeISO();

  const nomeLoja = useMemo(() => (lojaId) => {
    const loja = dados?.lojas?.find((l) => l.id === lojaId);
    if (!loja) return "Loja não identificada";
    const rede = dados?.redes?.find((r) => r.id === loja.redeId);
    return rede ? `${rede.nome} · ${loja.nome}` : loja.nome;
  }, [dados]);

  // ─── Entregas e pedidos: vêm de `dados`. A TV força uma sincronização a
  // cada INTERVALO_ATUALIZAR_TV, além da automática do app.
  useEffect(() => {
    if (typeof sincronizarAgora !== "function") return undefined;
    sincronizarAgora().catch(() => {});
    const t = setInterval(() => sincronizarAgora().catch(() => {}), INTERVALO_ATUALIZAR_TV);
    return () => clearInterval(t);
  }, [sincronizarAgora]);

  // Hora da última atualização que deu certo, e o erro se a última falhou —
  // aparece no topo pra quem olha a TV saber se ela está em dia.
  const [sync, setSync] = useState(null);
  useEffect(() => observarSync(setSync), []);

  const rotasEntrega = useMemo(() => {
    const comRota = (dados?.vendas ?? [])
      .filter((v) => v.status !== "cancelado" && v.rotaData === hoje && v.veiculoId && !v.rotaArquivada)
      .map((v) => ({ ...v, _nome: nomeLoja(v.lojaId) }))
      .sort((a, b) => (b.prioridade ? 1 : 0) - (a.prioridade ? 1 : 0) ||
        ((a.viagemRota ?? 1) - (b.viagemRota ?? 1)) || (a.ordemRota ?? 0) - (b.ordemRota ?? 0));

    const concluida = (p) => p.statusEntrega === "entregue" || p.statusEntrega === "retirado_cd";
    // Um card por veículo + viagem: o mesmo caminhão saindo 2x no dia (2ª
    // carga) vira dois cards, não um só com as duas viagens misturadas.
    const chavesGrupo = [...new Set(comRota.map((v) => `${v.veiculoId}::${v.viagemRota ?? 1}`))];

    return chavesGrupo.map((chave) => {
      const [veiculoId, viagemTxt] = chave.split("::");
      const viagem = Number(viagemTxt);
      const paradas = comRota.filter((v) => v.veiculoId === veiculoId && (v.viagemRota ?? 1) === viagem);
      const resumo = statusDaRota(paradas, concluida, "CD CVC");
      if (resumo.situacao === "em_curso") {
        resumo.rotulo = resumo.atual.statusEntrega === "em_rota" ? "Em deslocamento" : "Aguardando saída do CD";
        resumo.horaAtual = resumo.atual.statusEntrega === "em_rota" ? horaCurta(resumo.atual.saidaCdEm) : null;
      }
      const nomeVeiculo = dados?.veiculos?.find((v) => v.id === veiculoId)?.nome ?? "Veículo";
      return {
        id: chave,
        titulo: viagem > 1 ? `${nomeVeiculo} · ${viagem}ª viagem` : nomeVeiculo,
        subtitulo: paradas[0]?.motoristaId
          ? dados?.funcionarios?.find((f) => f.id === paradas[0].motoristaId)?.nome ?? null
          : paradas[0]?.motoristaNome || null,
        resumo,
        paradas: paradas.map((p) => ({
          nome: p._nome,
          estado: concluida(p) ? "concluida" : resumo.situacao === "em_curso" && p === resumo.atual ? "atual" : "pendente",
        })),
      };
    });
  }, [dados, hoje, nomeLoja]);

  // ─── Pedidos pendentes: ainda não entraram numa rota (aba Romaneio) e
  // ainda estão no depósito — cruza o «sem rota» do Romaneio com a mesma
  // regra do Estoque: pedido «pendente» de antes de ontem já saiu (foi
  // entregue sem escanear) e não aparece aqui como atrasado.
  const pedidosPendentes = useMemo(() => {
    return (dados?.vendas ?? [])
      .filter((v) => !v.veiculoId && v.data <= hoje && vendaAindaNoDeposito(v))
      .map((v) => ({ ...v, _nome: nomeLoja(v.lojaId) }))
      .sort((a, b) =>
        (b.prioridade ? 1 : 0) - (a.prioridade ? 1 : 0) ||
        (a.data !== b.data ? (a.data < b.data ? -1 : 1) : 0));
  }, [dados, hoje, nomeLoja]);

  // ─── Promotores: tempo real direto do Supabase, igual à aba Promotores.
  const [rotasPromotor, setRotasPromotor] = useState([]);
  const [promotores, setPromotores] = useState([]);
  useEffect(() => {
    if (!modoSupabase) return undefined;
    let ativo = true;
    const carregar = () => {
      Promise.all([listarRotas({ data: hoje }), listarPromotores()])
        .then(([r, p]) => { if (ativo) { setRotasPromotor(r); setPromotores(p); } })
        .catch(() => {});
    };
    carregar();
    const parar = assinarTempoReal(carregar);
    // O tempo real pode cair sem avisar (Wi-Fi da TV oscila); a releitura
    // periódica garante que o painel volta a ficar em dia sozinho.
    const t = setInterval(carregar, INTERVALO_ATUALIZAR_TV);
    return () => { ativo = false; parar(); clearInterval(t); };
  }, [hoje]);

  const cartoesPromotor = useMemo(() => {
    const nomePromotor = (id) => promotores.find((p) => p.id === id)?.nome ?? "Promotor";
    return rotasPromotor.filter((r) => r.status !== "cancelada").map((rota) => {
      const paradas = rota.paradas.map((p) => ({ ...p, _nome: p.estabelecimento }));
      const concluida = (p) => p.status === "concluida";
      const resumo = rota.status === "pendente"
        ? { situacao: "nao_iniciada" }
        : statusDaRota(paradas, concluida, "ponto de partida");
      if (resumo.situacao === "em_curso") {
        const chegou = resumo.atual.status === "em_andamento";
        resumo.chegou = chegou;
        resumo.rotulo = chegou ? "Chegou — organizando" : "A caminho";
        resumo.horaAtual = chegou ? horaCurta(resumo.atual.chegadaEm) : null;
      }
      return {
        id: rota.id,
        titulo: nomePromotor(rota.promotorId),
        subtitulo: rota.nome,
        resumo,
        paradas: paradas.map((p) => ({
          nome: p._nome,
          estado: concluida(p) ? "concluida" : resumo.situacao === "em_curso" && p === resumo.atual ? "atual" : "pendente",
        })),
      };
    });
  }, [rotasPromotor, promotores]);

  const [agora, setAgora] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const [paradasAbertas, setParadasAbertas] = useState(null);

  return (
    <div style={{
      minHeight: "100dvh", background: TV.fundo, color: TV.texto,
      fontFamily: "'Inter', system-ui, sans-serif", display: "flex", flexDirection: "column",
    }}>
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        padding: "20px clamp(18px, 3vw, 40px)", borderBottom: `1px solid ${TV.borda}`,
      }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>Acompanhamento — CVC Hortifruit</div>
          <div style={{ fontSize: 14, color: TV.textoFraco, marginTop: 2, textTransform: "capitalize" }}>{dataPorExtenso()}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 34, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              {agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </div>
            {modoSupabase && sync && (
              <div style={{ fontSize: 12, color: sync.erro || !sync.online ? TV.vermelho : TV.textoFraco }}>
                {!sync.online ? "Sem internet" : sync.erro ? "Falha ao atualizar" : sync.ultimaSync ? `Atualizado às ${horaCurta(sync.ultimaSync)}` : "Atualizando…"}
              </div>
            )}
          </div>
          <button type="button" onClick={onSair}
            style={{
              display: "flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.08)",
              border: `1px solid ${TV.borda}`, borderRadius: 10, padding: "9px 14px",
              color: TV.textoFraco, fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>
            <Icon name="close" size={15} color={TV.textoFraco} />
            Sair do modo TV
          </button>
        </div>
      </header>

      <div style={{
        flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1,
        background: TV.borda, minHeight: 0,
      }}>
        <section style={{ background: TV.fundo, padding: "22px clamp(16px, 2.5vw, 32px)", overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Icon name="caminhao" size={22} color={TV.laranja} />
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.3 }}>ENTREGAS</span>
          </div>
          {rotasEntrega.length === 0 ? (
            <div style={{ fontSize: 16, color: TV.textoFraco, padding: "20px 0" }}>Nenhuma rota de entrega hoje.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {rotasEntrega.map((r) => (
                <CartaoRota key={r.id} titulo={r.titulo} subtitulo={r.subtitulo} icone="caminhao" cor={TV.laranja} resumo={r.resumo}
                  onVerParadas={() => setParadasAbertas({ titulo: r.titulo, cor: TV.laranja, paradas: r.paradas })} />
              ))}
            </div>
          )}
        </section>

        <section style={{ background: TV.fundo, padding: "22px clamp(16px, 2.5vw, 32px)", overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Icon name="rota" size={22} color={TV.verde} />
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.3 }}>PROMOTORES</span>
          </div>
          {!modoSupabase ? (
            <div style={{ fontSize: 16, color: TV.textoFraco, padding: "20px 0" }}>
              Acompanhamento de promotores precisa do Supabase configurado.
            </div>
          ) : cartoesPromotor.length === 0 ? (
            <div style={{ fontSize: 16, color: TV.textoFraco, padding: "20px 0" }}>Nenhuma rota de promotor hoje.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {cartoesPromotor.map((r) => (
                <CartaoRota key={r.id} titulo={r.titulo} subtitulo={r.subtitulo} icone="rota" cor={TV.verde} resumo={r.resumo}
                  onVerParadas={() => setParadasAbertas({ titulo: r.titulo, cor: TV.verde, paradas: r.paradas })} />
              ))}
            </div>
          )}
        </section>

        <section style={{ background: TV.fundo, padding: "22px clamp(16px, 2.5vw, 32px)", overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Icon name="vendas" size={22} color={TV.amarelo} />
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.3 }}>PEDIDOS PENDENTES</span>
            {pedidosPendentes.length > 0 && (
              <span style={{
                marginLeft: "auto", background: `${TV.amarelo}26`, color: TV.amarelo,
                borderRadius: 20, padding: "3px 11px", fontSize: 14, fontWeight: 800,
              }}>
                {pedidosPendentes.length}
              </span>
            )}
          </div>
          {pedidosPendentes.length === 0 ? (
            <div style={{ fontSize: 16, color: TV.textoFraco, padding: "20px 0" }}>Nenhum pedido esperando rota.</div>
          ) : (
            <div>
              {pedidosPendentes.map((p) => <LinhaPedido key={p.id} pedido={p} />)}
            </div>
          )}
        </section>
      </div>

      {paradasAbertas && (
        <ModalParadas
          titulo={paradasAbertas.titulo}
          cor={paradasAbertas.cor}
          paradas={paradasAbertas.paradas}
          onClose={() => setParadasAbertas(null)}
        />
      )}
    </div>
  );
}

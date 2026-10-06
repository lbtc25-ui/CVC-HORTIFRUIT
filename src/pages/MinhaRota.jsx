import { useCallback, useEffect, useState } from "react";

import AvisoAcaoCelular from "../components/AvisoAcaoCelular";
import CameraFoto from "../components/CameraFoto";
import { Btn, Card, Icon } from "../components/ui";
import { useAuth } from "../contexts/auth-context";
import { modoSupabase } from "../lib/auth";
import { formatarData, hojeISO, rotuloHorario } from "../lib/datas";
import {
  assinarTempoReal,
  concluirAcao,
  concluirParada,
  continuarRotaHoje,
  enviarFotoParada,
  iniciarRota,
  minhasAcoes,
  minhasRotas,
} from "../lib/promotores";
import { COLORS } from "../lib/tema";

const PASSOS_FOTO = [
  { tipo: "chegada", titulo: "Foto da fachada", ajuda: "Mostra que você chegou ao estabelecimento — é o que libera o início do trabalho aqui." },
  { tipo: "antes", titulo: "Foto de antes", ajuda: "Como o expositor está antes da arrumação." },
  { tipo: "depois", titulo: "Foto de depois", ajuda: "Como ficou depois de organizado — libera o próximo destino." },
];

const CAMPO_URL = { chegada: "fotoChegada", antes: "fotoAntes", depois: "fotoDepois" };

const horaCurta = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";

const ALERTAS_ACAO_KEY = "cc-alertas-acao";

const lerAlertasDisparados = () => {
  try { return JSON.parse(localStorage.getItem(ALERTAS_ACAO_KEY) ?? "[]"); } catch { return []; }
};

const registrarAlerta = (chave) => {
  try {
    localStorage.setItem(ALERTAS_ACAO_KEY, JSON.stringify([...lerAlertasDisparados(), chave].slice(-200)));
  } catch { /* sem storage: o alerta pode repetir, sem prejuízo */ }
};

/** Notificação do sistema (se permitida) + vibração. O banner na tela é sempre mostrado. */
const notificarAcao = (titulo, corpo) => {
  try { navigator.vibrate?.([300, 150, 300, 150, 300]); } catch { /* ignore */ }
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(titulo, { body: corpo, icon: "/pwa-192x192.png", tag: titulo + corpo });
    }
  } catch { /* alguns navegadores móveis exigem service worker */ }
};

/** Próxima foto que falta nesta parada, ou null se as 3 já foram enviadas. */
const proximoPasso = (parada) => PASSOS_FOTO.find((passo) => !parada[CAMPO_URL[passo.tipo]]);

/**
 * Tela do promotor: inicia a rota do dia e, em cada parada, exige a
 * sequência foto de chegada → antes → depois antes de liberar a próxima loja.
 */
export default function MinhaRota() {
  const { usuario } = useAuth();
  const [rotas, setRotas] = useState([]);
  const [acoes, setAcoes] = useState([]);
  // Ação aguardando a foto do evento (câmera aberta) e as observações digitadas.
  const [cameraAcao, setCameraAcao] = useState(null);
  const [obsAcoes, setObsAcoes] = useState({});
  const [alertasAcao, setAlertasAcao] = useState([]);
  const [carregando, setCarregando] = useState(modoSupabase);
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  // Parada/tipo com a câmera aberta. A foto só vem da câmera do app — nada
  // de <input type="file">, que deixaria escolher imagem da galeria.
  const [camera, setCamera] = useState(null);
  const [enviando, setEnviando] = useState(null);

  const recarregar = useCallback(async () => {
    try {
      const lista = await minhasRotas(usuario.id);
      setRotas(lista);
      setAcoes(await minhasAcoes(usuario.id).catch(() => []));
    } catch (err) {
      setAviso({ tipo: "erro", texto: String(err?.message ?? err) });
    } finally {
      setCarregando(false);
    }
  }, [usuario.id]);

  // Carga inicial em efeito próprio — ver o comentário equivalente em
  // Promotores.jsx sobre por que não chama `recarregar` direto aqui.
  useEffect(() => {
    if (!modoSupabase) return undefined;
    let ativo = true;

    (async () => {
      try {
        const lista = await minhasRotas(usuario.id);
        const listaAcoes = await minhasAcoes(usuario.id).catch(() => []);
        if (ativo) {
          setRotas(lista);
          setAcoes(listaAcoes);
        }
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
  }, [recarregar, usuario.id]);

  // Alerta 30 min antes e na hora marcada das ações de hoje (com o app aberto).
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    const verificar = () => {
      const agora = new Date();
      const hoje = hojeISO();
      const disparados = lerAlertasDisparados();
      const novos = [];
      for (const a of acoes) {
        if (!a.hora || a.data !== hoje || a.status !== "pendente" || a.arquivada) continue;
        const [h, m] = a.hora.split(":").map(Number);
        const alvo = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), h, m);
        const faltam = (alvo - agora) / 60000;
        const estagios = [];
        if (faltam <= 30 && faltam > 0) estagios.push(["antes", `Em ${Math.ceil(faltam)} min (${a.hora}): ${a.titulo}`]);
        if (faltam <= 0 && faltam > -30) estagios.push(["hora", `Está na hora (${a.hora}): ${a.titulo}`]);
        for (const [estagio, texto] of estagios) {
          const chave = `${a.id}|${a.data}|${a.hora}|${estagio}`;
          if (disparados.includes(chave)) continue;
          registrarAlerta(chave);
          novos.push({ chave, texto: `${texto} — ${a.estabelecimento}` });
          notificarAcao(estagio === "antes" ? "Ação em 30 minutos" : "Hora da ação", `${texto} — ${a.estabelecimento}`);
        }
      }
      if (novos.length) setAlertasAcao((l) => [...l, ...novos]);
    };
    verificar();
    const timer = setInterval(verificar, 20000);
    return () => clearInterval(timer);
  }, [acoes]);

  const iniciar = async (rotaId) => {
    setOcupado(true);
    setAviso(null);
    try {
      await iniciarRota(rotaId);
      await recarregar();
    } catch (err) {
      setAviso({ tipo: "erro", texto: String(err?.message ?? err) });
    } finally {
      setOcupado(false);
    }
  };

  const concluir = async (paradaId) => {
    setOcupado(true);
    setAviso(null);
    try {
      await concluirParada(paradaId);
      await recarregar();
    } catch (err) {
      setAviso({ tipo: "erro", texto: String(err?.message ?? err) });
    } finally {
      setOcupado(false);
    }
  };

  // Rota de um dia anterior que ficou pela metade: passa para hoje e segue
  // de onde parou (as paradas já concluídas continuam concluídas).
  const continuarHoje = async (rota) => {
    setOcupado(true);
    setAviso(null);
    try {
      await continuarRotaHoje(rota.id, hojeISO());
      await recarregar();
      setAviso({ tipo: "ok", texto: `Rota "${rota.nome}" passou para hoje — continue de onde parou.` });
    } catch (err) {
      setAviso({ tipo: "erro", texto: String(err?.message ?? err) });
    } finally {
      setOcupado(false);
    }
  };

  const escolherFoto = (paradaId, tipo) => setCamera({ paradaId, tipo });

  const aoCapturar = async (arquivo) => {
    const alvo = camera;
    setCamera(null);
    if (!arquivo || !alvo) return;

    setEnviando(alvo);
    setAviso(null);
    try {
      await enviarFotoParada(alvo.paradaId, arquivo, alvo.tipo);
      await recarregar();
    } catch (err) {
      setAviso({ tipo: "erro", texto: String(err?.message ?? err) });
    } finally {
      setEnviando(null);
    }
  };

  const aoCapturarAcao = async (arquivo) => {
    const alvo = cameraAcao;
    setCameraAcao(null);
    if (!arquivo || !alvo) return;
    setEnviando({ acaoId: alvo });
    setAviso(null);
    try {
      await concluirAcao(alvo, arquivo, obsAcoes[alvo]);
      await recarregar();
      setAviso({ tipo: "ok", texto: "Ação concluída — o gestor já pode ver a foto." });
    } catch (err) {
      setAviso({ tipo: "erro", texto: String(err?.message ?? err) });
    } finally {
      setEnviando(null);
    }
  };

  if (!modoSupabase) {
    return (
      <Card>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Icon name="alert" color={COLORS.laranjaEscuro} size={20} />
          <div style={{ fontSize: 14, color: COLORS.cinzaEscuro, lineHeight: 1.6 }}>
            Sua rota precisa do Supabase configurado neste aparelho para enviar as fotos e avisar
            os gestores. Fale com um sócio master.
          </div>
        </div>
      </Card>
    );
  }

  if (carregando) {
    return <Card><div style={{ color: COLORS.cinza, textAlign: "center", padding: 20 }}>Carregando sua rota…</div></Card>;
  }

  // A rota do dia: em andamento tem prioridade, senão a próxima pendente.
  const rota =
    rotas.find((r) => r.status === "em_andamento") ??
    rotas.find((r) => r.status === "pendente") ??
    rotas.find((r) => r.status === "concluida");

  // Rotas de dias anteriores que não foram terminadas — cada uma ganha a
  // opção de continuar hoje, do ponto em que parou.
  const hoje = hojeISO();
  const atrasadas = rotas.filter((r) => r.data < hoje && (r.status === "pendente" || r.status === "em_andamento"));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
      {camera && (
        <CameraFoto
          titulo={PASSOS_FOTO.find((p) => p.tipo === camera.tipo)?.titulo ?? "Foto"}
          aoCapturar={aoCapturar}
          aoFechar={() => setCamera(null)} />
      )}

      {cameraAcao && (
        <CameraFoto titulo="Foto do evento" aoCapturar={aoCapturarAcao} aoFechar={() => setCameraAcao(null)} />
      )}

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

      {alertasAcao.map((al) => (
        <div key={al.chave} style={{
          background: "#FFF3CD", border: "1px solid #FFE08A", color: "#856404",
          borderRadius: 10, padding: "11px 14px", fontSize: 14, fontWeight: 600,
          display: "flex", gap: 9, alignItems: "flex-start", justifyContent: "space-between",
        }}>
          <span style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
            <Icon name="alert" size={16} color="#856404" />
            <span style={{ lineHeight: 1.45 }}>{al.texto}</span>
          </span>
          <button type="button" onClick={() => setAlertasAcao((l) => l.filter((x) => x.chave !== al.chave))}
            style={{ background: "none", border: "none", color: "#856404", cursor: "pointer", fontSize: 16 }}
            aria-label="Dispensar">×</button>
        </div>
      ))}

      {acoes.some((a) => a.hora && !a.arquivada && a.status === "pendente") && <AvisoAcaoCelular />}

      {acoes.filter((a) => !a.arquivada).length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.cinzaEscuro }}>Ações para realizar</div>
          {acoes.filter((a) => !a.arquivada).map((a) => {
            const feita = a.status === "concluida";
            return (
              <Card key={a.id} style={{ borderLeft: `4px solid ${feita ? COLORS.verde : COLORS.laranja}` }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.cinzaEscuro }}>{a.titulo}</div>
                <div style={{ fontSize: 13, color: COLORS.cinza, marginTop: 2 }}>
                  {formatarData(a.data)}{a.hora && <> às {rotuloHorario(a.hora, a.duracaoMin)}</>} · {a.estabelecimento}
                </div>
                {a.endereco && (
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.endereco)}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 12.5, color: COLORS.azul, textDecoration: "none" }}>
                    {a.endereco} ↗
                  </a>
                )}
                {a.descricao && <div style={{ fontSize: 13.5, color: COLORS.cinzaEscuro, marginTop: 8, lineHeight: 1.45 }}>{a.descricao}</div>}
                {feita ? (
                  <div style={{ fontSize: 12.5, color: COLORS.verde, marginTop: 8, fontWeight: 600 }}>
                    ✓ Realizada às {horaCurta(a.concluidaEm)}
                  </div>
                ) : (
                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                    <textarea rows={2} placeholder="Observação (opcional): como foi, quem atendeu…"
                      value={obsAcoes[a.id] ?? ""}
                      onChange={(e) => setObsAcoes((o) => ({ ...o, [a.id]: e.target.value }))}
                      style={{ width: "100%", boxSizing: "border-box", padding: 10, borderRadius: 8, border: `1px solid ${COLORS.cinzaClaro}`, fontSize: 14, fontFamily: "inherit", resize: "vertical" }} />
                    <Btn icon="camera" disabled={enviando?.acaoId === a.id} onClick={() => setCameraAcao(a.id)}>
                      {enviando?.acaoId === a.id ? "Enviando…" : "Tirar foto do evento e concluir"}
                    </Btn>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {atrasadas.map((r) => {
        const feitas = r.paradas.filter((p) => p.status === "concluida").length;
        const faltam = r.paradas.length - feitas;
        return (
          <Card key={r.id} style={{ borderLeft: `4px solid ${COLORS.laranja}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.cinzaEscuro }}>
                  Rota de {formatarData(r.data)} não foi concluída
                </div>
                <div style={{ fontSize: 13, color: COLORS.cinza, marginTop: 2 }}>
                  {r.nome} · faltam {faltam} de {r.paradas.length} parada{r.paradas.length === 1 ? "" : "s"}. Continue hoje de onde parou.
                </div>
              </div>
              <Btn icon="rota" onClick={() => continuarHoje(r)} disabled={ocupado}>
                {ocupado ? "Aguarde…" : "Continuar hoje"}
              </Btn>
            </div>
          </Card>
        );
      })}

      {!rota ? (
        <Card><div style={{ color: COLORS.cinza, textAlign: "center", padding: 20 }}>Nenhuma rota atribuída a você no momento.</div></Card>
      ) : (
        <>
          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17, color: COLORS.cinzaEscuro }}>{rota.nome}</div>
                <div style={{ fontSize: 13, color: COLORS.cinza, marginTop: 2 }}>{formatarData(rota.data)} · {rota.paradas.length} paradas</div>
              </div>
              {rota.status === "pendente" && (
                <Btn icon="rota" onClick={() => iniciar(rota.id)} disabled={ocupado}>{ocupado ? "Iniciando…" : "Iniciar rota"}</Btn>
              )}
              {rota.status === "concluida" && (
                <span style={{ background: COLORS.verdePale, color: COLORS.verde, padding: "5px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700 }}>
                  ✓ Rota concluída
                </span>
              )}
            </div>
          </Card>

          {rota.status !== "pendente" &&
            rota.paradas.map((parada, i) => {
              const concluida = parada.status === "concluida";
              const passo = proximoPasso(parada);
              // Só a primeira parada ainda não concluída fica liberada — as
              // seguintes ficam travadas, com o destino escondido, até chegar
              // a vez delas (só se sabe pra onde ir depois de concluir a atual).
              const primeiraAberta = rota.paradas.findIndex((p) => p.status !== "concluida") === i;
              const travada = !concluida && !primeiraAberta;

              if (travada) {
                return (
                  <Card key={parada.id} style={{ opacity: 0.55 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 13, fontWeight: 700, color: COLORS.branco, background: COLORS.cinza,
                      }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, color: COLORS.cinza, fontSize: 15 }}>
                          <Icon name="cadeado" size={14} color={COLORS.cinza} />
                          Parada {i + 1} de {rota.paradas.length}
                        </div>
                        <div style={{ fontSize: 12.5, color: COLORS.cinza, marginTop: 4 }}>
                          Revelada ao concluir a parada atual
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              }

              return (
                <Card key={parada.id}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700, color: COLORS.branco,
                      background: concluida ? COLORS.verde : COLORS.laranja,
                    }}>
                      {concluida ? "✓" : i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {parada.prioridade && <Icon name="estrela" size={15} color={COLORS.dourado} />}
                        <div style={{ fontWeight: 700, color: COLORS.cinzaEscuro, fontSize: 15 }}>{parada.estabelecimento}</div>
                      </div>
                      {parada.endereco && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parada.endereco)}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 12.5, color: COLORS.azul, textDecoration: "none" }}
                        >
                          {parada.endereco} ↗
                        </a>
                      )}

                      {concluida && (
                        <div style={{ fontSize: 12.5, color: COLORS.verde, marginTop: 6, fontWeight: 600 }}>
                          Concluída às {horaCurta(parada.concluidaEm)}
                        </div>
                      )}

                      {!concluida && (
                        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                          {parada.chegadaEm && (
                            <div style={{ fontSize: 12.5, color: COLORS.cinza }}>Chegou às {horaCurta(parada.chegadaEm)}</div>
                          )}

                          {passo ? (
                            <div>
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.cinzaEscuro }}>{passo.titulo}</div>
                              <div style={{ fontSize: 12, color: COLORS.cinza, marginBottom: 8 }}>{passo.ajuda}</div>
                              <Btn icon="camera" disabled={enviando?.paradaId === parada.id}
                                onClick={() => escolherFoto(parada.id, passo.tipo)}>
                                {enviando?.paradaId === parada.id ? "Enviando…" : `Tirar foto — ${passo.titulo.toLowerCase()}`}
                              </Btn>
                            </div>
                          ) : (
                            <Btn onClick={() => concluir(parada.id)} disabled={ocupado}>
                              {ocupado ? "Concluindo…" : "Concluir parada e seguir"}
                            </Btn>
                          )}

                          <div style={{ display: "flex", gap: 8 }}>
                            {PASSOS_FOTO.map(({ tipo, titulo }) => {
                              const enviada = Boolean(parada[CAMPO_URL[tipo]]);
                              return (
                                <span key={tipo} title={titulo} style={{
                                  fontSize: 11, fontWeight: 600, borderRadius: 20, padding: "2px 9px",
                                  background: enviada ? COLORS.verdePale : COLORS.cinzaClaro,
                                  color: enviada ? COLORS.verde : COLORS.cinza,
                                }}>
                                  {enviada ? "✓ " : ""}{titulo}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
        </>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";

import LeitorQR from "../components/LeitorQR";
import { Btn, Card, Icon, Input, Modal } from "../components/ui";
import { useAuth } from "../contexts/auth-context";
import { formatarData, hojeISO } from "../lib/datas";
import {
  continuarRota, desfazerEscaneio, iniciarRota, linkMaps, linkRotaMaps, minhasEntregas, registrarEscaneio, rotasNaoConcluidas,
} from "../lib/entregas";
import { pareceCodigoDeNota } from "../lib/qr";
import { COLORS } from "../lib/tema";

const ROTULO_STATUS = { pendente: "Pendente", carregando: "Carregando", em_rota: "Em rota", entregue: "Entregue", retirado_cd: "Retirado no CD" };
const COR_STATUS = {
  pendente: { bg: COLORS.cinzaClaro, cor: COLORS.cinza },
  carregando: { bg: "#DCEEFB", cor: COLORS.azul },
  em_rota: { bg: "#FFF3CD", cor: "#856404" },
  entregue: { bg: COLORS.verdePale, cor: COLORS.verde },
  retirado_cd: { bg: COLORS.verdePale, cor: COLORS.verde },
};
const concluida = (p) => p.status === "entregue" || p.status === "retirado_cd";

const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "");

/**
 * A tela do motorista: as entregas em que ele foi escalado no romaneio, na
 * ordem da rota, com o endereço de cada loja para abrir no Maps e a câmera
 * para ler o QR da nota. O 1º escaneio marca o carregamento (pedido no
 * caminhão, status "Carregando"); ler de novo o mesmo pedido antes disso vira
 * erro. Só depois que a VIAGEM inteira estiver carregada (veículo + número
 * da viagem — não o dia inteiro do motorista) o botão "Iniciar rota" dela
 * libera — e é só aí que o Painel TV mostra aquela viagem saindo do CD. Se
 * ele tiver duas viagens abertas ao mesmo tempo (2ª carga do mesmo
 * caminhão, ou dois veículos), cada uma libera e inicia por conta própria.
 * O 2º escaneio, já em rota, marca a entrega na loja. A regra roda tanto
 * aqui quanto no banco (migracao-37-iniciar-rota.sql e
 * migracao-40-iniciar-rota-por-viagem.sql). Se o motorista ler o QR errado,
 * "Desfazer leitura" volta um passo (migracao-36-desfazer-escaneio.sql).
 * Não mostra valor, cliente de outra rota nem nada do resto do sistema.
 */
export default function MinhasEntregas() {
  const { usuario } = useAuth();
  const usuarioId = usuario?.id;
  const [dia, setDia] = useState(hojeISO());
  const [paradas, setParadas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [lendo, setLendo] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  // Viagens de dias anteriores que ficaram com entrega sobrando — só olhadas
  // quando a tela está no dia de hoje, que é pra onde "Continuar hoje" leva.
  const [sobras, setSobras] = useState([]);
  const hoje = hojeISO();
  // Se a migracao-46 ainda não rodou, a lista só não aparece: não vale travar
  // a tela de entregas do motorista por causa disso.
  const lerSobras = () => (dia === hoje ? rotasNaoConcluidas(usuarioId, hoje).catch(() => []) : Promise.resolve([]));

  /** Relê as paradas depois de um escaneio. */
  const carregar = async () => {
    try {
      const [lista, restos] = await Promise.all([minhasEntregas(usuarioId, dia), lerSobras()]);
      setParadas(lista);
      setSobras(restos);
      setErro(null);
    } catch (e) {
      setErro(String(e?.message ?? e));
    }
  };

  useEffect(() => {
    let vivo = true;
    minhasEntregas(usuarioId, dia)
      .then((lista) => { if (vivo) { setParadas(lista); setErro(null); } })
      .catch((e) => vivo && setErro(String(e?.message ?? e)))
      .finally(() => vivo && setCarregando(false));
    (dia === hoje ? rotasNaoConcluidas(usuarioId, hoje).catch(() => []) : Promise.resolve([]))
      .then((restos) => vivo && setSobras(restos));
    return () => { vivo = false; };
  }, [usuarioId, dia, hoje]);

  // "Continuar hoje": traz para hoje o que sobrou de uma viagem de outro dia
  // (numa viagem nova do mesmo veículo), sem mexer no que já foi entregue.
  const [continuando, setContinuando] = useState(null);
  const aoContinuar = async (sobra) => {
    const chave = `${sobra.dia}::${sobra.veiculoId}::${sobra.viagem}`;
    setContinuando(chave);
    try {
      const r = await continuarRota(usuarioId, sobra.dia, sobra.veiculoId, sobra.viagem, hoje);
      setMensagem({ tipo: "ok", texto: `Rota de ${formatarData(sobra.dia)} continuada hoje — ${r.movidas} entrega${r.movidas === 1 ? "" : "s"} na ${r.novaViagem}ª viagem.` });
      carregar();
    } catch (e) {
      setMensagem({ tipo: "erro", texto: String(e?.message ?? e) });
    } finally {
      setContinuando(null);
    }
  };

  // A leitura não grava nada sozinha: abre a confirmação com a loja e o
  // pedido, e só o "Confirmar" chama o registro (saída do CD ou entrega).
  const [pendente, setPendente] = useState(null);
  const aoLer = (codigo) => {
    if (pendente) return;
    const parada = paradas.find((p) => p.id === codigo);
    if (!parada) {
      setMensagem({ tipo: "erro", texto: "Esta nota não está nas suas entregas deste dia." });
      return;
    }
    if (concluida(parada)) {
      const pedido = `Pedido #${parada.numero ?? "—"}${parada.loja ? ` · ${parada.loja}` : ""}`;
      setMensagem({ tipo: "aviso", texto: parada.status === "retirado_cd"
        ? `${pedido} foi retirado no CD.`
        : `${pedido} já foi entregue${parada.entregueEm ? ` às ${hora(parada.entregueEm)}` : ""}.` });
      return;
    }
    // Ler de novo um pedido já carregado, antes de apertar "Iniciar rota", é
    // erro — a 2ª leitura só vale depois que a viagem sai do CD.
    if (parada.status === "carregando") {
      const pedido = `Pedido #${parada.numero ?? "—"}${parada.loja ? ` · ${parada.loja}` : ""}`;
      setMensagem({ tipo: "aviso", texto: `${pedido} já está carregado. Aperte "Iniciar rota" quando carregar tudo, antes de registrar entregas.` });
      return;
    }
    setMensagem(null);
    setPendente({ ...parada, acao: parada.status === "pendente" ? "carregamento" : "entrega" });
  };

  // Uma viagem (veículo + `viagem`) libera "Iniciar rota" quando ELA já foi
  // carregada por inteiro (1ª leitura de todos os pedidos DELA) e ainda não
  // foi iniciada — nunca olhando as outras viagens do dia: duas viagens
  // abertas ao mesmo tempo (2ª carga do mesmo caminhão, ou dois veículos)
  // são cargas independentes, uma não trava nem dispara a outra.
  const gruposProntos = useMemo(() => {
    const chaves = [...new Set(paradas
      .filter((p) => p.status === "carregando")
      .map((p) => `${p.veiculoId}::${p.viagem ?? 1}`))];
    return chaves
      .map((chave) => {
        const [veiculoId, viagemTxt] = chave.split("::");
        const viagem = Number(viagemTxt);
        const doGrupo = paradas.filter((p) => p.veiculoId === veiculoId && (p.viagem ?? 1) === viagem);
        return { chave, veiculoId, viagem, veiculoNome: doGrupo[0]?.veiculo || "veículo", pronto: !doGrupo.some((p) => p.status === "pendente") };
      })
      .filter((g) => g.pronto);
  }, [paradas]);
  const [iniciando, setIniciando] = useState(null);
  const aoIniciarRota = async (grupo) => {
    setIniciando(grupo.chave);
    try {
      const r = await iniciarRota(usuarioId, dia, grupo.veiculoId, grupo.viagem);
      setMensagem({ tipo: "ok", texto: `Rota iniciada — ${r.iniciadas} pedido${r.iniciadas === 1 ? "" : "s"} a caminho.` });
      carregar();
    } catch (e) {
      setMensagem({ tipo: "erro", texto: String(e?.message ?? e) });
    } finally {
      setIniciando(null);
    }
  };

  const [confirmando, setConfirmando] = useState(false);
  const confirmar = async () => {
    if (!pendente || confirmando) return;
    // A câmera só destrava (pausado={Boolean(pendente)}) quando `pendente` some — o
    // que só pode acontecer DEPOIS da resposta do servidor. Limpar `pendente` cedo
    // demais deixava o mesmo QR, ainda no quadro, ser lido de novo enquanto o
    // primeiro escaneio ainda estava em voo: a 2ª leitura usava a lista velha
    // (achava "pendente" de novo) e reabria "Confirmar carregamento" sobre um
    // pedido que o servidor já sabia estar "carregando".
    setConfirmando(true);
    const alvo = pendente;
    try {
      const r = await registrarEscaneio(usuarioId, alvo.id);
      const pedido = `Pedido #${r.numero ?? "—"}${r.loja ? ` · ${r.loja}` : ""}`;
      setMensagem(
        !r.mudou
          ? { tipo: "aviso", texto: r.status === "retirado_cd"
            ? `${pedido} foi retirado no CD.`
            : `${pedido} já foi entregue${r.momento ? ` às ${hora(r.momento)}` : ""}.` }
          : r.status === "carregando"
            ? { tipo: "ok", texto: `Carregamento confirmado — ${pedido}` }
            : { tipo: "ok", texto: `Entrega confirmada — ${pedido}` }
      );
      carregar();
    } catch (e) {
      setMensagem({ tipo: "erro", texto: String(e?.message ?? e) });
    } finally {
      setConfirmando(false);
      setPendente(null);
    }
  };

  // Para quando o motorista leu o QR errado e confirmou: volta um passo
  // (entregue → em rota, carregando → pendente). "Em rota" não vem de
  // escaneio (vem do botão "Iniciar rota"), por isso não tem desfazer;
  // também não desfaz "retirado no CD".
  const [desfazendo, setDesfazendo] = useState(null);
  const desfazer = async (parada) => {
    const pedido = `Pedido #${parada.numero ?? "—"}${parada.loja ? ` · ${parada.loja}` : ""}`;
    if (!confirm(`Desfazer a leitura de ${pedido}?\n\n${parada.status === "entregue" ? "Volta para \"Em rota\"." : "Volta para \"Pendente\"."}`)) return;
    setDesfazendo(parada.id);
    try {
      await desfazerEscaneio(usuarioId, parada.id);
      setMensagem({ tipo: "aviso", texto: `Leitura desfeita — ${pedido}` });
      carregar();
    } catch (e) {
      setMensagem({ tipo: "erro", texto: String(e?.message ?? e) });
    } finally {
      setDesfazendo(null);
    }
  };

  const fecharLeitor = () => { setPendente(null); setLendo(false); };

  const faltam = paradas.filter((p) => !concluida(p));
  const rotaMaps = linkRotaMaps(faltam.map((p) => p.endereco));
  const entregues = paradas.length - faltam.length;
  const proxima = faltam[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ width: 170 }}>
          <Input label="Dia" type="date" value={dia} onChange={(e) => { setCarregando(true); setDia(e.target.value); }} />
        </div>
        <div style={{ flex: 1, fontSize: 13, color: COLORS.cinza, paddingBottom: 10 }}>
          {carregando ? "Carregando…" : `${paradas.length} ${paradas.length === 1 ? "parada" : "paradas"} · ${entregues} entregue(s)`}
          {paradas[0]?.veiculo ? ` · ${paradas[0].veiculo}` : ""}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Btn icon="camera" onClick={() => { setMensagem(null); setLendo(true); }} disabled={paradas.length === 0}>
          Ler QR da nota
        </Btn>
        {rotaMaps && (
          <a href={rotaMaps} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            <Btn variant="ghost" icon="rota">Rota no Maps ({faltam.length})</Btn>
          </a>
        )}
      </div>

      {mensagem && !lendo && <Aviso mensagem={mensagem} />}
      {erro && <Aviso mensagem={{ tipo: "erro", texto: erro }} />}

      {sobras.map((r) => {
        const chave = `${r.dia}::${r.veiculoId}::${r.viagem}`;
        return (
          <Card key={chave} style={{ borderLeft: `4px solid ${COLORS.laranja}`, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.cinzaEscuro }}>
                Rota de {formatarData(r.dia)} não foi concluída
              </div>
              <div style={{ fontSize: 13, color: COLORS.cinza, marginTop: 2 }}>
                {r.veiculo || "Veículo"}{r.viagem > 1 ? ` · ${r.viagem}ª viagem` : ""} · faltam {r.faltam} de {r.total} entrega{r.total === 1 ? "" : "s"}.
                {" "}Traga para hoje e continue de onde parou — o que já foi entregue fica no dia original.
              </div>
            </div>
            <Btn icon="caminhao" onClick={() => aoContinuar(r)} disabled={continuando === chave}>
              {continuando === chave ? "Trazendo…" : "Continuar hoje"}
            </Btn>
          </Card>
        );
      })}

      {gruposProntos.map((g) => (
        <Card key={g.chave} style={{ borderLeft: `4px solid ${COLORS.azul}`, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.cinzaEscuro }}>
              {g.veiculoNome} carregado{g.viagem > 1 ? ` · ${g.viagem}ª viagem` : ""}
            </div>
            <div style={{ fontSize: 13, color: COLORS.cinza, marginTop: 2 }}>
              Todos os pedidos desta viagem foram lidos. Aperte para sair do CD — só a partir daqui o Painel TV mostra a rota em andamento.
            </div>
          </div>
          <Btn icon="caminhao" onClick={() => aoIniciarRota(g)} disabled={iniciando === g.chave}>
            {iniciando === g.chave ? "Iniciando…" : "Iniciar rota"}
          </Btn>
        </Card>
      ))}

      {proxima && (
        <Card style={{ borderLeft: `4px solid ${COLORS.laranja}` }}>
          <div style={{ fontSize: 12, color: COLORS.cinza, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Próxima entrega</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.cinzaEscuro, marginTop: 4 }}>{proxima.loja || "Loja sem nome"}</div>
          <div style={{ fontSize: 13, color: COLORS.cinza, marginTop: 2 }}>{proxima.endereco || "Endereço não cadastrado"}</div>
          {proxima.endereco && (
            <a href={linkMaps(proxima.endereco)} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 10, textDecoration: "none" }}>
              <Btn icon="rota">Abrir no Maps</Btn>
            </a>
          )}
        </Card>
      )}

      {paradas.map((p, i) => {
        const cor = COR_STATUS[p.status] ?? COR_STATUS.pendente;
        // Só aparece quando o motorista tem mais de uma viagem escalada hoje
        // (mesmo caminhão, 2ª carga) — senão toda entrega é "1ª viagem" e o
        // aviso não ajudaria em nada.
        const mudaViagem = i === 0 ? (p.viagem ?? 1) > 1 : (p.viagem ?? 1) !== (paradas[i - 1].viagem ?? 1);
        return (
          <div key={p.id}>
            {mudaViagem && (
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.cinza, textTransform: "uppercase", letterSpacing: 0.5, margin: "4px 2px" }}>
                {p.viagem}ª viagem
              </div>
            )}
          <Card style={{ padding: "14px 16px", opacity: concluida(p) ? 0.7 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: COLORS.cinzaEscuro, fontSize: 14.5 }}>
                  {i + 1}. {p.loja || "Loja sem nome"}
                  {p.prioridade && <span style={{ marginLeft: 6, fontSize: 11, color: COLORS.laranjaEscuro, fontWeight: 700 }}>PRIORIDADE</span>}
                  <span style={{ fontWeight: 400, fontSize: 12, color: COLORS.cinza }}> · Pedido #{p.numero ?? "—"}</span>
                </div>
                {p.rede && <div style={{ fontSize: 12, color: COLORS.cinza }}>{p.rede}</div>}
                <div style={{ fontSize: 13, color: COLORS.cinza, marginTop: 4 }}>{p.endereco || "Endereço não cadastrado"}</div>
                <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: 4 }}>
                  {p.saidaCdEm && `Saiu do CD ${hora(p.saidaCdEm)}`}
                  {p.entregueEm && ` · Entregue ${hora(p.entregueEm)}`}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                <span style={{ background: cor.bg, color: cor.cor, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                  {ROTULO_STATUS[p.status] ?? p.status}
                </span>
                {p.endereco && (
                  <a href={linkMaps(p.endereco)} target="_blank" rel="noreferrer"
                    style={{ fontSize: 12.5, color: COLORS.verde, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
                    Maps ↗
                  </a>
                )}
                {(p.status === "carregando" || p.status === "entregue") && (
                  <button
                    type="button"
                    onClick={() => desfazer(p)}
                    disabled={desfazendo === p.id}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12.5, color: COLORS.cinza, textDecoration: "underline" }}
                  >
                    {desfazendo === p.id ? "Desfazendo…" : "Desfazer leitura"}
                  </button>
                )}
              </div>
            </div>
          </Card>
          </div>
        );
      })}

      {!carregando && !erro && paradas.length === 0 && (
        <Card style={{ textAlign: "center", color: COLORS.cinza, padding: 36 }}>
          Nenhuma entrega escalada para você neste dia.
          <div style={{ fontSize: 12, marginTop: 6 }}>
            Se devia ter, confira com o escritório se a sua conta está ligada ao seu nome na Folha e se a rota foi montada.
          </div>
        </Card>
      )}

      {lendo && (
        <Modal title="Ler QR da nota" onClose={fecharLeitor}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <LeitorQR ativo={lendo} aoLer={aoLer} pausado={Boolean(pendente)} validar={pareceCodigoDeNota} />
            {!pendente && (
              <div style={{ fontSize: 12.5, color: COLORS.cinza }}>
                Aponte para o QR da nota, dentro do quadro verde. O 1º escaneio confirma o carregamento no caminhão; o 2º, já em rota, a entrega na loja.
                Carregue todos os pedidos da viagem e aperte "Iniciar rota" antes de entregar.
              </div>
            )}
            {pendente && (
              <div role="alertdialog" aria-label="Confirmar leitura" style={{ border: `2px solid ${COLORS.laranja}`, borderRadius: 12, padding: 14, background: "#FFF8EC", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.cinzaEscuro }}>
                  {pendente.acao === "carregamento" ? "Confirmar carregamento" : "Confirmar entrega"} para{" "}
                  <span style={{ color: COLORS.verde }}>{pendente.loja || "Loja sem nome"}</span>?
                </div>
                <div style={{ fontSize: 12.5, color: COLORS.cinza }}>
                  Pedido #{pendente.numero ?? "—"}{pendente.rede ? ` · ${pendente.rede}` : ""}
                  {pendente.endereco ? ` · ${pendente.endereco}` : ""}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <Btn variant="secondary" disabled={confirmando} onClick={() => { setPendente(null); setMensagem({ tipo: "aviso", texto: "Leitura cancelada. Nada foi registrado." }); }} style={{ flex: 1, justifyContent: "center" }}>Cancelar</Btn>
                  <Btn icon="check" disabled={confirmando} onClick={confirmar} style={{ flex: 1, justifyContent: "center" }}>{confirmando ? "Confirmando…" : "Confirmar"}</Btn>
                </div>
              </div>
            )}
            {mensagem && <Aviso mensagem={mensagem} />}
            <Btn variant="secondary" onClick={fecharLeitor}>Fechar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

const Aviso = ({ mensagem }) => {
  const erro = mensagem.tipo === "erro";
  const aviso = mensagem.tipo === "aviso";
  return (
    <div style={{
      background: erro ? "#FFEBEE" : aviso ? "#FFF3CD" : COLORS.verdePale,
      color: erro ? "#B02A37" : aviso ? "#856404" : COLORS.verde,
      borderRadius: 10, padding: "10px 13px", fontSize: 13, display: "flex", gap: 8, alignItems: "flex-start",
    }}>
      <Icon name={erro ? "alert" : "check"} size={15} color={erro ? "#B02A37" : aviso ? "#856404" : COLORS.verde} />
      <span>{mensagem.texto}</span>
    </div>
  );
};

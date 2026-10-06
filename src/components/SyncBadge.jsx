import { COLORS } from "../lib/tema";
import { useSyncStatus } from "../hooks/useSyncStatus";

function descrever(status) {
  if (!status.configurado) return { cor: COLORS.cinza, texto: "Modo local", titulo: "Supabase não configurado — dados só neste aparelho" };
  if (!status.online) return { cor: COLORS.laranjaEscuro, texto: "Offline", titulo: "Sem conexão. As alterações ficam na fila." };
  if (status.sincronizando) return { cor: COLORS.azul, texto: "Sincronizando…", titulo: "Enviando e recebendo dados" };
  if (status.falhas > 0) return { cor: COLORS.vermelho, texto: `${status.falhas} com erro`, titulo: status.erro || "Operações que não puderam ser enviadas" };
  if (status.pendentes > 0) return { cor: COLORS.laranja, texto: `${status.pendentes} na fila`, titulo: "Aguardando envio para a nuvem" };
  if (status.erro) return { cor: COLORS.vermelho, texto: "Erro", titulo: status.erro };
  return { cor: COLORS.verdeClaro, texto: "Sincronizado", titulo: status.ultimaSync ? `Última sincronização: ${new Date(status.ultimaSync).toLocaleString("pt-BR")}` : "Tudo em dia" };
}

/** Indicador compacto de conexão/sincronização para o cabeçalho. */
export default function SyncBadge({ onClick }) {
  const status = useSyncStatus();
  const { cor, texto, titulo } = descrever(status);

  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      style={{
        display: "flex", alignItems: "center", gap: 7, padding: "6px 12px",
        borderRadius: 20, border: `1px solid ${COLORS.cinzaClaro}`,
        background: COLORS.branco, cursor: onClick ? "pointer" : "default",
        fontSize: 12, fontWeight: 600, color: COLORS.cinzaEscuro, whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 8, height: 8, borderRadius: "50%", background: cor, flexShrink: 0,
          animation: status.sincronizando ? "cc-pulsar 1s ease-in-out infinite" : "none",
        }}
      />
      {texto}
    </button>
  );
}

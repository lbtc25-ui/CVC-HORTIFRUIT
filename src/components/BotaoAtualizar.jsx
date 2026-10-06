import { COLORS } from "../lib/tema";
import { Icon } from "./ui";
import { useSyncStatus } from "../hooks/useSyncStatus";

/**
 * Botão compacto ao lado do indicador de sincronização, para forçar uma
 * atualização sem precisar entrar na tela de Sincronização.
 */
export default function BotaoAtualizar({ onAtualizar }) {
  const status = useSyncStatus();
  const desabilitado = status.sincronizando || !status.configurado || !status.online;

  return (
    <button
      type="button"
      onClick={onAtualizar}
      disabled={desabilitado}
      title={status.sincronizando ? "Sincronizando…" : "Atualizar agora"}
      aria-label="Forçar atualização"
      style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 34, height: 34, flexShrink: 0,
        borderRadius: "50%", border: `1px solid ${COLORS.cinzaClaro}`,
        background: COLORS.branco, cursor: desabilitado ? "default" : "pointer",
        opacity: desabilitado && !status.sincronizando ? 0.45 : 1,
      }}
    >
      <span
        style={{
          display: "flex",
          animation: status.sincronizando ? "cc-girar 0.8s linear infinite" : "none",
        }}
      >
        <Icon name="sync" size={16} color={COLORS.cinzaEscuro} />
      </span>
    </button>
  );
}

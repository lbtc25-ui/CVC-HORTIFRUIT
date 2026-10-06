import { useRegisterSW } from "virtual:pwa-register/react";
import Logo from "./Logo";
import { COLORS, FONTE } from "../lib/tema";

/**
 * Avisa quando uma nova versão do app foi baixada e quando ele passa a
 * funcionar offline. O service worker é registrado aqui.
 */
export default function AtualizacaoPWA() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(url) {
      console.info("Service worker pronto:", url);
    },
    onRegisterError(err) {
      console.error("Falha ao registrar o service worker:", err);
    },
  });

  if (!offlineReady && !needRefresh) return null;

  const fechar = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <div
      role="status"
      style={{
        position: "fixed", bottom: 18, left: 18, right: 18, zIndex: 9999,
        maxWidth: 380, margin: "0 auto", fontFamily: FONTE,
        background: COLORS.branco, borderRadius: 12, padding: "14px 16px",
        boxShadow: "0 8px 28px rgba(0,0,0,0.18)", border: `1px solid ${COLORS.cinzaClaro}`,
        display: "flex", alignItems: "center", gap: 12,
      }}
    >
      <Logo altura={26} decorativa />

      <div style={{ flex: 1, fontSize: 13, color: COLORS.cinzaEscuro, lineHeight: 1.45 }}>
        {needRefresh
          ? "Nova versão disponível."
          : "App pronto para funcionar sem internet."}
      </div>

      {needRefresh && (
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          style={{ background: COLORS.verde, color: COLORS.branco, border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >
          Atualizar
        </button>
      )}

      <button
        type="button"
        onClick={fechar}
        aria-label="Fechar aviso"
        style={{ background: "transparent", border: "none", color: COLORS.cinza, fontSize: 18, cursor: "pointer", lineHeight: 1, padding: 4 }}
      >
        ×
      </button>
    </div>
  );
}

import { useEffect, useRef } from "react";

import { Icon } from "./ui";
import { COLORS } from "../lib/tema";

/**
 * Comprovante de pagamento aberto dentro do próprio app, em tela cheia: foto
 * ou PDF. Fica acima das janelas de formulário (zIndex 1100), então dá para
 * conferir o comprovante no meio do lançamento e voltar sem perder o que foi
 * digitado. `pdf` diz se `url` é um PDF; `aoFechar()` fecha.
 */
export default function VisorComprovante({ url, pdf, nome, aoFechar }) {
  const fechar = useRef(aoFechar);
  useEffect(() => { fechar.current = aoFechar; });

  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === "Escape") fechar.current?.(); };
    const rolagemAnterior = document.body.style.overflow;
    window.addEventListener("keydown", aoTeclar);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = rolagemAnterior;
    };
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-label="Comprovante"
      style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.88)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", paddingTop: "max(12px, env(safe-area-inset-top))", color: "#fff" }}>
        <strong style={{ fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {nome || "Comprovante"}
        </strong>
        <button type="button" onClick={aoFechar} aria-label="Fechar comprovante"
          style={{ background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", width: 40, height: 40, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 }}>
          <Icon name="close" color={COLORS.branco} size={22} />
        </button>
      </div>

      <div onClick={aoFechar} style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 12px 12px", overflow: "auto" }}>
        {pdf ? (
          <iframe src={url} title={nome || "Comprovante"} onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", height: "100%", border: "none", borderRadius: 8, background: "#fff" }} />
        ) : (
          <img src={url} alt={nome || "Comprovante"} onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8, boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }} />
        )}
      </div>
    </div>
  );
}

import { useLeitorQR } from "../hooks/useLeitorQR";
import { COLORS } from "../lib/tema";
import { Icon } from "./ui";

/**
 * Câmera para o escaneio do QR da nota, na tela de Romaneio. Um quadro verde
 * marca a área de leitura; o vídeo cobre o quadrado inteiro. Com `pausado`
 * (leitura aguardando confirmação) o quadro fica laranja e nada é lido.
 */
export default function LeitorQR({ ativo, aoLer, pausado = false, validar }) {
  const { videoRef, erro } = useLeitorQR(ativo, aoLer, { pausado, validar });

  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "1", background: "#111", borderRadius: 12, overflow: "hidden" }}>
      <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      {!erro && (
        <div
          aria-hidden="true"
          style={{ position: "absolute", inset: "12%", border: `3px solid ${pausado ? COLORS.laranja : COLORS.verdeClaro}`, borderRadius: 16, boxShadow: "0 0 0 999px rgba(0,0,0,0.35)" }}
        />
      )}
      {erro && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, textAlign: "center", background: "rgba(0,0,0,0.8)" }}>
          <div>
            <Icon name="alert" color={COLORS.laranja} size={28} />
            <div style={{ marginTop: 8, color: COLORS.branco, fontSize: 13 }}>{erro}</div>
          </div>
        </div>
      )}
    </div>
  );
}

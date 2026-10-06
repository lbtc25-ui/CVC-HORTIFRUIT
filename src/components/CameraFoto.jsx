import { useEffect, useRef, useState } from "react";

import { Btn, Icon } from "./ui";
import { COLORS } from "../lib/tema";

/** Lado maior da foto gerada — suficiente pro gestor ver o expositor, leve pra subir no 4G. */
const LADO_MAX = 1600;

/**
 * Câmera dentro do app, em tela cheia: mostra o vídeo ao vivo e só devolve
 * uma foto tirada agora, com o botão daqui. Não usa <input type="file"> —
 * por ali o celular sempre deixa escolher uma imagem da galeria, e a foto
 * do promotor precisa ser da hora, no local.
 *
 * `aoCapturar(arquivo)` recebe um File JPEG; `aoFechar()` cancela.
 */
export default function CameraFoto({ titulo, aoCapturar, aoFechar }) {
  const videoRef = useRef(null);
  const [erro, setErro] = useState(null);
  const [pronta, setPronta] = useState(false);

  useEffect(() => {
    let cancelado = false;
    let stream = null;

    if (!navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() => setErro("Este navegador não permite acesso à câmera. Abra o app pelo Chrome ou Safari do celular."));
      return () => {};
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      // Alguns aparelhos recusam as restrições de resolução: tenta o básico.
      .catch(() => navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }))
      .then((s) => {
        if (cancelado) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelado) setErro("Não foi possível abrir a câmera. Libere o acesso à câmera nas configurações do navegador e tente de novo.");
      });

    return () => {
      cancelado = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capturar = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const escala = Math.min(1, LADO_MAX / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * escala);
    canvas.height = Math.round(video.videoHeight * escala);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) { setErro("Falha ao gerar a foto. Tente de novo."); return; }
      aoCapturar(new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.85);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", color: "#fff" }}>
        <strong style={{ fontSize: 15 }}>{titulo}</strong>
        <button type="button" onClick={aoFechar} aria-label="Fechar câmera"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}>
          <Icon name="close" size={22} color="#fff" />
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {erro ? (
          <div style={{ color: "#fff", textAlign: "center", padding: 24, fontSize: 14, lineHeight: 1.6, maxWidth: 420 }}>{erro}</div>
        ) : (
          <video ref={videoRef} playsInline muted onLoadedMetadata={() => setPronta(true)}
            style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "center", padding: "18px 16px 28px" }}>
        {erro ? (
          <Btn variant="secondary" onClick={aoFechar}>Voltar</Btn>
        ) : (
          <button type="button" onClick={capturar} disabled={!pronta} aria-label="Tirar foto"
            style={{
              width: 72, height: 72, borderRadius: "50%", border: `4px solid ${COLORS.branco}`,
              background: pronta ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.1)",
              cursor: pronta ? "pointer" : "wait",
            }} />
        )}
      </div>
    </div>
  );
}

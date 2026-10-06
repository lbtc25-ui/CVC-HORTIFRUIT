import { useEffect, useRef, useState } from "react";

// Tempo mínimo antes do mesmo código poder disparar `aoLer` de novo. Sem isto
// o mesmo QR, ainda visível no quadro, chamaria a função a cada frame.
const RECARENCIA_MS = 2500;

// Quantos quadros precisam decodificar o MESMO texto (sem outro texto no
// meio) para a leitura valer. Evita disparar com uma leitura parcial/errada de um QR tremido.
const LEITURAS_CONFIRMACAO = 2;

// Intervalo entre tentativas de decodificação. Decodificar todo frame (60/s)
// esquenta o celular sem ganhar precisão; ~12 tentativas/s já é instantâneo.
const INTERVALO_MS = 80;

// Lado máximo, em pixels, do recorte enviado ao decodificador. Imagens muito
// grandes deixam o jsQR lento; muito pequenas perdem os módulos do QR.
const LADO_MAX = 720;

/**
 * Liga a câmera do aparelho e decodifica QR code em tempo real, quadro a
 * quadro, num canvas invisível — sem subir nada para servidor.
 *
 * `ativo` liga/desliga a câmera (só gasta bateria com a tela de escaneio
 * aberta). `pausado` mantém a câmera ligada mas para de ler — usado enquanto
 * a tela pede confirmação da leitura anterior. `aoLer` não precisa ser
 * memoizado: fica numa ref, então trocá-lo entre renders não reabre a câmera.
 * `validar` (opcional) descarta textos que não são códigos do app.
 *
 * Precisão: pede câmera em alta resolução com foco contínuo, lê só a área do
 * quadro verde (recorte central), usa o `BarcodeDetector` nativo quando o
 * navegador tem (mais rápido e tolerante) e cai para o `jsqr` — que entra por
 * import dinâmico, como as bibliotecas de exportação em lib/exportar.js.
 */
export function useLeitorQR(ativo, aoLer, { pausado = false, validar } = {}) {
  const videoRef = useRef(null);
  const aoLerRef = useRef(aoLer);
  const validarRef = useRef(validar);
  const pausadoRef = useRef(pausado);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    aoLerRef.current = aoLer;
    validarRef.current = validar;
    pausadoRef.current = pausado;
  }, [aoLer, validar, pausado]);

  useEffect(() => {
    if (!ativo) return undefined;

    let cancelado = false;
    let quadro = null;
    let stream = null;
    let ocupado = false;
    let ultimaTentativa = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const ultimaLeitura = { codigo: null, quando: 0 };
    const candidato = { codigo: null, vezes: 0 };

    if (!navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() => setErro("Este navegador não permite acesso à câmera."));
      return () => {};
    }

    const abrirCamera = () =>
      navigator.mediaDevices
        .getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            focusMode: { ideal: "continuous" },
          },
        })
        // Alguns aparelhos recusam as restrições de resolução: tenta o básico.
        .catch(() => navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }));

    const criarDetectorNativo = async () => {
      try {
        if (!("BarcodeDetector" in window)) return null;
        const formatos = await window.BarcodeDetector.getSupportedFormats?.();
        if (formatos && !formatos.includes("qr_code")) return null;
        return new window.BarcodeDetector({ formats: ["qr_code"] });
      } catch {
        return null;
      }
    };

    Promise.all([import("jsqr").then((m) => m.default), criarDetectorNativo(), abrirCamera()])
      .then(([jsQR, detectorNativo, s]) => {
        if (cancelado) { s.getTracks().forEach((t) => t.stop()); return; }
        setErro(null);
        stream = s;

        // Foco contínuo onde a API permite (Chrome/Android); ignorado nos demais.
        const trilha = s.getVideoTracks()[0];
        const capacidades = trilha?.getCapabilities?.() ?? {};
        if (capacidades.focusMode?.includes?.("continuous")) {
          trilha.applyConstraints({ advanced: [{ focusMode: "continuous" }] }).catch(() => {});
        }

        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }

        // Recorta o quadrado central do vídeo (a área do quadro verde, com
        // folga) e reduz para no máximo LADO_MAX px.
        const desenharRecorte = (video) => {
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          const lado = Math.min(vw, vh) * 0.9;
          const sx = (vw - lado) / 2;
          const sy = (vh - lado) / 2;
          const destino = Math.round(Math.min(lado, LADO_MAX));
          canvas.width = destino;
          canvas.height = destino;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(video, sx, sy, lado, lado, 0, 0, destino, destino);
        };

        const decodificar = async (video) => {
          desenharRecorte(video);
          if (detectorNativo) {
            try {
              const achados = await detectorNativo.detect(canvas);
              if (achados[0]?.rawValue) return achados[0].rawValue;
            } catch {
              // cai para o jsQR abaixo
            }
          }
          const imagem = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const r = jsQR(imagem.data, imagem.width, imagem.height, { inversionAttempts: "attemptBoth" });
          return r?.data || null;
        };

        const aceitar = (texto) => {
          const codigo = texto.trim();
          if (validarRef.current && !validarRef.current(codigo)) {
            candidato.codigo = null;
            candidato.vezes = 0;
            return;
          }
          if (codigo === candidato.codigo) candidato.vezes += 1;
          else { candidato.codigo = codigo; candidato.vezes = 1; }
          if (candidato.vezes < LEITURAS_CONFIRMACAO) return;

          const agora = Date.now();
          if (codigo !== ultimaLeitura.codigo || agora - ultimaLeitura.quando > RECARENCIA_MS) {
            ultimaLeitura.codigo = codigo;
            ultimaLeitura.quando = agora;
            candidato.codigo = null;
            candidato.vezes = 0;
            navigator.vibrate?.(80);
            aoLerRef.current(codigo);
          }
        };

        const ler = (tempo) => {
          quadro = requestAnimationFrame(ler);
          const video = videoRef.current;
          if (ocupado || pausadoRef.current || tempo - ultimaTentativa < INTERVALO_MS) return;
          if (!video || video.readyState < video.HAVE_ENOUGH_DATA || !video.videoWidth) return;
          ultimaTentativa = tempo;
          ocupado = true;
          decodificar(video)
            .then((texto) => {
              if (cancelado || pausadoRef.current) return;
              // Frame sem QR (tremido, reflexo) não zera o candidato: só um
              // texto DIFERENTE zera, então leituras intercaladas ainda contam.
              if (texto) aceitar(texto);
            })
            .catch(() => {})
            .finally(() => { ocupado = false; });
        };
        quadro = requestAnimationFrame(ler);
      })
      .catch((e) => setErro(e?.message || "Não foi possível abrir a câmera. Confira a permissão no navegador."));

    return () => {
      cancelado = true;
      if (quadro) cancelAnimationFrame(quadro);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [ativo]);

  return { videoRef, erro };
}

export default useLeitorQR;

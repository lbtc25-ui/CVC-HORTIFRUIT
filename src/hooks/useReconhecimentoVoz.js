import { useCallback, useEffect, useRef, useState } from "react";

const Reconhecedor = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

/** `true` só quando o navegador sabe transcrever voz (Chrome/Android; não no Safari/iOS). */
export const vozSuportada = !!Reconhecedor;

/**
 * Um "ouvir e transcrever" simples em pt-BR. `transcricao` vai atualizando
 * enquanto a pessoa fala (resultado parcial) e fecha quando ela para.
 */
export function useReconhecimentoVoz() {
  const [ouvindo, setOuvindo] = useState(false);
  const [transcricao, setTranscricao] = useState("");
  const [erro, setErro] = useState(null);
  const [final, setFinal] = useState(null); // texto definitivo, uma vez por fala
  const reconhecedor = useRef(null);

  useEffect(() => {
    if (!Reconhecedor) return undefined;
    const r = new Reconhecedor();
    r.lang = "pt-BR";
    r.continuous = false;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onresult = (e) => {
      const texto = [...e.results].map((res) => res[0].transcript).join(" ");
      setTranscricao(texto);
      if (e.results[e.results.length - 1].isFinal) setFinal(texto);
    };
    r.onerror = (e) => {
      const msgs = {
        "not-allowed": "Permita o uso do microfone para pedir por voz.",
        "no-speech": "Não ouvi nada. Toque no microfone e fale de novo.",
        "audio-capture": "Nenhum microfone encontrado neste aparelho.",
      };
      setErro(msgs[e.error] || "Não deu para ouvir agora. Tente de novo.");
      setOuvindo(false);
    };
    r.onend = () => setOuvindo(false);

    reconhecedor.current = r;
    return () => r.abort();
  }, []);

  const iniciar = useCallback(() => {
    if (!reconhecedor.current || ouvindo) return;
    setErro(null);
    setTranscricao("");
    setFinal(null);
    try {
      reconhecedor.current.start();
      setOuvindo(true);
    } catch {
      // start() em cima de start() joga — ignora, já está ouvindo.
    }
  }, [ouvindo]);

  const parar = useCallback(() => {
    reconhecedor.current?.stop();
  }, []);

  return { suportado: vozSuportada, ouvindo, transcricao, final, erro, iniciar, parar };
}

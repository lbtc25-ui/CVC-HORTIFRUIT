import { useEffect, useRef, useState } from "react";
import { COLORS } from "../lib/tema";
import { Icon } from "./ui";

// Quanto puxar (já com a resistência aplicada) para soltar e atualizar.
const LIMIAR = 68;
// Não deixa o indicador crescer além disto, mesmo que o dedo suba mais.
const ALTURA_MAXIMA = 100;
// Puxar 1px de dedo move o indicador menos que 1px — sensação de "elástico".
const RESISTENCIA = 2.4;

/**
 * Gesto de "puxar para atualizar" no celular.
 *
 * O app instalado roda em tela cheia, sem a barra do navegador — não existe o
 * gesto nativo de puxar para atualizar como numa aba comum. Isto refaz o
 * gesto à mão, escutando o toque na janela inteira (a página é quem rola,
 * não um `div` interno) e chamando `aoAtualizar` quando solta além do limiar.
 */
export default function PuxarParaAtualizar({ ativo, aoAtualizar, children }) {
  const [distancia, setDistancia] = useState(0);
  const [atualizando, setAtualizando] = useState(false);
  // Só para decidir, na renderização, se a altura do indicador anima (solto)
  // ou segue o dedo direto (arrastando) — refs não podem ser lidos ao renderizar.
  const [arrastando, setArrastando] = useState(false);
  const origemY = useRef(null);
  const puxando = useRef(false);

  useEffect(() => {
    if (!ativo) return undefined;

    const dentroDeDialogo = (alvo) =>
      typeof alvo?.closest === "function" && alvo.closest('[role="dialog"], #barra-navegacao');

    const aoTocar = (e) => {
      if (window.scrollY > 0 || atualizando || dentroDeDialogo(e.target)) return;
      origemY.current = e.touches[0].clientY;
      puxando.current = true;
      setArrastando(true);
    };

    const aoMover = (e) => {
      if (!puxando.current || origemY.current === null) return;
      const delta = e.touches[0].clientY - origemY.current;
      if (delta <= 0 || window.scrollY > 0) {
        puxando.current = false;
        setArrastando(false);
        setDistancia(0);
        return;
      }
      setDistancia(Math.min(delta / RESISTENCIA, ALTURA_MAXIMA));
    };

    const soltar = () => {
      if (!puxando.current) return;
      puxando.current = false;
      origemY.current = null;
      setArrastando(false);
      setDistancia((atual) => {
        if (atual >= LIMIAR) {
          setAtualizando(true);
          Promise.resolve(aoAtualizar?.())
            .catch(() => {})
            .finally(() => setAtualizando(false));
        }
        return 0;
      });
    };

    window.addEventListener("touchstart", aoTocar, { passive: true });
    window.addEventListener("touchmove", aoMover, { passive: true });
    window.addEventListener("touchend", soltar, { passive: true });
    window.addEventListener("touchcancel", soltar, { passive: true });
    return () => {
      window.removeEventListener("touchstart", aoTocar);
      window.removeEventListener("touchmove", aoMover);
      window.removeEventListener("touchend", soltar);
      window.removeEventListener("touchcancel", soltar);
    };
  }, [ativo, aoAtualizar, atualizando]);

  if (!ativo) return children;

  const progresso = Math.min(distancia / LIMIAR, 1);
  const altura = atualizando ? 44 : distancia;

  return (
    <>
      <div
        aria-hidden="true"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          height: altura, overflow: "hidden",
          transition: arrastando ? "none" : "height 0.2s ease",
        }}
      >
        <span
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 30, height: 30, borderRadius: "50%",
            background: COLORS.branco, boxShadow: "0 2px 8px rgba(0,0,0,0.14)",
            transform: atualizando ? "none" : `rotate(${progresso * 180}deg)`,
            animation: atualizando ? "cc-girar 0.7s linear infinite" : "none",
          }}
        >
          <Icon name="sync" size={15} color={progresso >= 1 || atualizando ? COLORS.verde : COLORS.cinza} />
        </span>
      </div>
      {children}
    </>
  );
}

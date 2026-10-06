import { useEffect, useState } from "react";
import { COLORS } from "../lib/tema";

/**
 * Botão "Instalar" que aparece quando o navegador oferece a instalação do PWA.
 * No iOS não existe esse evento — o usuário instala por Compartilhar →
 * "Adicionar à Tela de Início".
 */
export default function InstalarApp() {
  const [evento, setEvento] = useState(null);

  useEffect(() => {
    const capturar = (e) => {
      e.preventDefault();
      setEvento(e);
    };
    const instalado = () => setEvento(null);

    window.addEventListener("beforeinstallprompt", capturar);
    window.addEventListener("appinstalled", instalado);
    return () => {
      window.removeEventListener("beforeinstallprompt", capturar);
      window.removeEventListener("appinstalled", instalado);
    };
  }, []);

  if (!evento) return null;

  const instalar = async () => {
    evento.prompt();
    await evento.userChoice;
    setEvento(null);
  };

  return (
    <button
      type="button"
      onClick={instalar}
      style={{
        display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
        borderRadius: 20, border: `1px solid ${COLORS.verdePale}`,
        background: COLORS.verdePale, color: COLORS.verde,
        fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
      }}
    >
      ⬇ Instalar
    </button>
  );
}

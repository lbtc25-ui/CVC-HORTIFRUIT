import { useState } from "react";

import { Btn, Card } from "./ui";
import { meuTopicoAviso } from "../lib/promotores";
import { COLORS } from "../lib/tema";

/**
 * Cartão da tela Minha Rota: liga o aviso das ações no celular com o app
 * fechado (30 min antes e na hora). O aviso sai do banco pelo ntfy; o
 * promotor só precisa instalar o app gratuito e se inscrever no tópico dele.
 */
export default function AvisoAcaoCelular() {
  const [info, setInfo] = useState(null);
  const [erro, setErro] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const mostrar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      setInfo(await meuTopicoAviso());
    } catch (err) {
      setErro(String(err?.message ?? err));
    } finally {
      setCarregando(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(info.topico);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <Card style={{ borderLeft: `4px solid ${COLORS.azul}` }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.cinzaEscuro }}>Avisos no celular com o app fechado</div>
      <div style={{ fontSize: 13, color: COLORS.cinza, marginTop: 4, lineHeight: 1.45 }}>
        Receba um aviso 30 minutos antes e na hora de cada ação, mesmo com o app fechado.
      </div>
      {!info ? (
        <div style={{ marginTop: 10 }}>
          <Btn variant="secondary" onClick={mostrar} disabled={carregando}>{carregando ? "Aguarde…" : "Configurar avisos"}</Btn>
        </div>
      ) : (
        <ol style={{ fontSize: 13.5, color: COLORS.cinzaEscuro, lineHeight: 1.6, paddingLeft: 20, margin: "10px 0 0" }}>
          <li>Instale o app gratuito <strong>ntfy</strong> (Play Store ou App Store).</li>
          <li>No ntfy, toque em <strong>+</strong> e digite este tópico{info.servidor !== "https://ntfy.sh" ? <> (servidor <strong>{info.servidor}</strong>)</> : null}:
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "6px 0" }}>
              <code style={{ background: COLORS.cinzaClaro, padding: "4px 8px", borderRadius: 6, fontSize: 12.5, wordBreak: "break-all" }}>{info.topico}</code>
              <Btn variant="secondary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={copiar}>{copiado ? "Copiado ✓" : "Copiar"}</Btn>
            </div>
          </li>
          <li>Permita as notificações. Pronto.</li>
        </ol>
      )}
      {erro && <div style={{ fontSize: 12.5, color: "#B02A37", marginTop: 8 }}>{erro}</div>}
    </Card>
  );
}

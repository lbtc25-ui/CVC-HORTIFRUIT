import { useState } from "react";

import VisorComprovante from "./VisorComprovante";
import { urlDoComprovante } from "../lib/comprovantes";
import { COLORS } from "../lib/tema";

/**
 * "Ver" do comprovante de um lançamento: abre o arquivo no visor do app.
 * Sem comprovante, mostra um traço. `caminho` e `nome` vêm do lançamento
 * (comprovantePath / comprovanteNome).
 */
export default function LinkComprovante({ caminho, nome }) {
  const [visor, setVisor] = useState(null);
  if (!caminho) return <span style={{ color: COLORS.cinza }}>—</span>;

  const abrir = async () => {
    try {
      const url = await urlDoComprovante(caminho);
      if (url) setVisor({ url, pdf: /\.pdf$/i.test(caminho) });
    } catch (err) {
      alert(`Não foi possível abrir o comprovante: ${err.message ?? err}`);
    }
  };

  return (
    <>
      <button type="button" onClick={abrir} title={nome || "Abrir comprovante"}
        style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.verde, fontWeight: 600, padding: 0, fontSize: 12.5, textDecoration: "underline" }}>
        Ver
      </button>
      {visor && <VisorComprovante url={visor.url} pdf={visor.pdf} nome={nome} aoFechar={() => setVisor(null)} />}
    </>
  );
}

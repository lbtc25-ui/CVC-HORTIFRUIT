import { useState } from "react";

import { Btn, Modal, Select } from "./ui";
import { MOTIVO_AUTOMATICO, MOTIVOS_CCE } from "../lib/cce";
import { COLORS } from "../lib/tema";

/**
 * Janela da carta de correção: escolhe o motivo e, se não for a automática,
 * descreve o que corrigir. `onEnviar({ motivo, detalhe })` faz o envio e
 * lança erro se falhar.
 */
export default function CartaCorrecaoModal({ titulo, jaTemCce, onEnviar, onClose }) {
  const [motivo, setMotivo] = useState(MOTIVO_AUTOMATICO);
  const [detalhe, setDetalhe] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const automatico = motivo === MOTIVO_AUTOMATICO;

  const enviar = async () => {
    setErro("");
    setEnviando(true);
    try {
      await onEnviar({ motivo, detalhe });
    } catch (e) {
      setErro(e.message);
      setEnviando(false);
    }
  };

  return (
    <Modal title={`Carta de correção — ${titulo}`} onClose={enviando ? () => {} : onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Select label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} options={MOTIVOS_CCE} />
        {automatico ? (
          <div style={{ fontSize: 13, color: COLORS.cinza, lineHeight: 1.5 }}>
            O app compara o código e a descrição de cada item da nota com o cadastro e envia só o que estiver diferente.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label htmlFor="cce-detalhe" style={{ fontSize: 13, fontWeight: 600, color: COLORS.cinzaEscuro }}>
              O que deve ser corrigido
            </label>
            <textarea id="cce-detalhe" value={detalhe} onChange={(e) => setDetalhe(e.target.value)} rows={4} maxLength={900}
              placeholder='Ex.: onde se lê "Placa ABC1D23", leia-se "Placa XYZ9K88"'
              style={{ width: "100%", border: `1.5px solid ${COLORS.cinzaClaro}`, borderRadius: 8, padding: "9px 13px", fontSize: 14, fontFamily: "inherit", color: COLORS.cinzaEscuro, resize: "vertical" }} />
          </div>
        )}
        <div style={{ fontSize: 12, color: COLORS.cinza, lineHeight: 1.5 }}>
          A carta não pode mudar valores, impostos, quantidades, destinatário nem datas.
          {jaTemCce && " Esta nota já tem CC-e: a SEFAZ vale a última, então repita o que ainda precisa continuar corrigido."}
        </div>
        {erro && <div style={{ fontSize: 13, color: COLORS.vermelho, whiteSpace: "pre-wrap" }}>{erro}</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="secondary" onClick={onClose} disabled={enviando}>Cancelar</Btn>
          <Btn onClick={enviar} disabled={enviando || (!automatico && detalhe.trim().length < 5)}>
            {enviando ? "Enviando..." : "Enviar carta de correção"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}

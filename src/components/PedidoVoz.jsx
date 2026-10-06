import { useEffect } from "react";

import { Aviso, Caixa } from "./PedidoPartes";
import { Icon } from "./ui";
import { useReconhecimentoVoz } from "../hooks/useReconhecimentoVoz";
import { interpretarPedidoVoz } from "../lib/pedidoVoz";
import { COLORS } from "../lib/tema";

/** Lê um resumo em voz alta — não empilha se a pessoa pedir de novo antes de terminar. */
function falar(texto) {
  try {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = "pt-BR";
    window.speechSynthesis.speak(u);
  } catch { /* sem voz de saída: só não lê, o resumo continua na tela */ }
}

/**
 * Botão de microfone para quem está sem mão livre para digitar (dirigindo,
 * por exemplo): ouve o pedido falado, casa com a rede, a loja e os produtos
 * já cadastrados, e preenche as quantidades na tela — mas quem confirma e
 * manda de verdade continua sendo a pessoa, no "Enviar pedido" de sempre.
 * Não aparece se o navegador não sabe transcrever voz (fora do Chrome/Android).
 */
export default function PedidoVoz({ redes, produtos, aoEntender }) {
  const { suportado, ouvindo, transcricao, final, erro, iniciar, parar } = useReconhecimentoVoz();
  // Derivado de `final` — nada de guardar numa segunda state que teria de ser
  // sincronizada com ela; só o "avisar e falar" abaixo é efeito colateral de verdade.
  const resultado = final ? interpretarPedidoVoz(final, redes, produtos) : null;

  useEffect(() => {
    if (!resultado) return;
    if (resultado.rede && resultado.loja && resultado.entendeuAlgumItem) {
      aoEntender(resultado);
      falar(`Entendi ${resultado.rede.nome}, ${resultado.loja.nome}, ${resultado.itens.length === 1 ? "1 item" : `${resultado.itens.length} itens`}. Confira e toque em enviar pedido.`);
    } else if (!resultado.rede) {
      falar("Não entendi o nome da rede. Pode repetir?");
    } else if (!resultado.loja) {
      falar(`Entendi ${resultado.rede.nome}, mas não a loja. Pode repetir com o nome da loja?`);
    } else {
      falar("Entendi a loja, mas não os produtos. Pode repetir a quantidade e o tamanho?");
    }
    // Só quando uma fala termina — `aoEntender` novo a cada render não deve reabrir o efeito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [final]);

  if (!suportado) return null;

  return (
    <Caixa>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button type="button" onClick={ouvindo ? parar : iniciar}
          aria-label={ouvindo ? "Parar de ouvir" : "Pedir por voz"}
          className={ouvindo ? "cc-pulsar" : undefined}
          style={{
            width: 56, height: 56, borderRadius: "50%", border: "none", cursor: "pointer", flexShrink: 0,
            background: ouvindo ? COLORS.laranja : COLORS.verdePale, color: ouvindo ? COLORS.branco : COLORS.verde,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          <Icon name="microfone" size={26} color="currentColor" />
        </button>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.cinzaEscuro }}>
            {ouvindo ? "Ouvindo…" : "Pedido por voz"}
          </div>
          <div style={{ fontSize: 13, color: COLORS.cinza, lineHeight: 1.4 }}>
            {ouvindo
              ? (transcricao || 'Fale, por exemplo: "pedido petrox aruana, 20 sacos de 2,5 quilos"')
              : "Toque no microfone e fale o pedido — rede, loja e produtos."}
          </div>
        </div>
      </div>

      {erro && <div style={{ marginTop: 12 }}><Aviso>{erro}</Aviso></div>}

      {resultado && !ouvindo && (
        <div style={{ marginTop: 12 }}>
          {resultado.rede && resultado.loja && resultado.entendeuAlgumItem ? (
            <Aviso tipo="ok">
              Entendi <strong>{resultado.rede.nome} · {resultado.loja.nome}</strong>:{" "}
              {resultado.itens.map((i) => `${i.qty.toLocaleString("pt-BR")} ${i.produtoNome}`).join(", ")}.
              {" "}Já preenchi abaixo — confira e toque em <strong>Enviar pedido</strong>.
            </Aviso>
          ) : (
            <Aviso>
              {!resultado.rede && "Não reconheci a rede. "}
              {resultado.rede && !resultado.loja && `Reconheci "${resultado.rede.nome}", mas não a loja. `}
              {resultado.rede && resultado.loja && !resultado.entendeuAlgumItem && `Reconheci "${resultado.rede.nome} · ${resultado.loja.nome}", mas não os produtos. `}
              Ouvi: "{final}". Toque no microfone e tente de novo.
            </Aviso>
          )}
        </div>
      )}
    </Caixa>
  );
}

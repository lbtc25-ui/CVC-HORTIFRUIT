/**
 * QR que viaja na nota impressa. Guarda só o id da venda — o mesmo uuid que já
 * identifica o pedido em tudo mais no app — para o escaneio na tela de
 * Romaneio encontrar a venda certa sem precisar de um código à parte.
 *
 * Import dinâmico, como em lib/exportar.js: só quem abre a tela de Romaneio
 * paga o peso da biblioteca.
 */
export async function gerarQrDataUrl(id, opcoes = {}) {
  const { default: QRCode } = await import("qrcode");
  return QRCode.toDataURL(id, {
    margin: 1,
    width: 260,
    color: { dark: "#1D4530", light: "#FFFFFF" },
    ...opcoes,
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * O QR da nota só carrega o uuid da venda: qualquer outro texto (QR de PIX,
 * de embalagem, leitura parcial) é descartado pelo leitor antes de contar.
 */
export const pareceCodigoDeNota = (texto) => UUID.test(String(texto ?? "").trim());

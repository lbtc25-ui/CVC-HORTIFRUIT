/**
 * Recibo de pedido — documento SEM valor fiscal, para as redes que recebem um
 * recibo a cada entrega da semana e uma única NF-e no fim, juntando tudo (ver
 * lib/notaSemanal.js). Feito com o mesmo jsPDF já usado no romaneio e nas
 * exportações da tela de Vendas — import dinâmico, só paga o peso quem clica.
 */
import { brl, kg } from "./tema";
import { EMPRESA } from "./empresa";

let logoDataUrlPromise;

/**
 * O PNG da logo mora em `public/` (mesmo arquivo do componente Logo) — o
 * jsPDF não desenha a partir de uma URL comum, só de um data URL, por isso
 * baixa e converte aqui. Sem logo (offline, arquivo movido) o recibo sai
 * sem a imagem em vez de travar a emissão.
 */
function carregarLogoDataUrl() {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = fetch(`${import.meta.env.BASE_URL}logo-cvc.png`)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("logo indisponível"))))
      .then((blob) => new Promise((resolve, reject) => {
        const leitor = new FileReader();
        leitor.onload = () => resolve(leitor.result);
        leitor.onerror = () => reject(leitor.error);
        leitor.readAsDataURL(blob);
      }))
      .catch(() => null);
  }
  return logoDataUrlPromise;
}

const unidadeDoItem = (item, produto) =>
  item.unidade === "un" ? "un" : produto?.unidadeVenda === "saco" ? "saco" : "kg";

/**
 * @param {{ venda: object, loja: object, rede?: object, produtosPorId: Record<string, object> }} args
 */
export async function gerarReciboPdf({ venda, loja, rede, produtosPorId }) {
  const [{ default: jsPDF }, { default: autoTable }, logo] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    carregarLogoDataUrl(),
  ]);

  const doc = new jsPDF();
  const margemEsq = 14;
  const margemDir = 196;

  // Mesma proporção do PNG usada no componente Logo (src/components/Logo.jsx).
  const logoAltura = 22;
  const logoLargura = logo ? logoAltura * (437 / 384) : 0;
  const inicioTexto = logo ? margemEsq + logoLargura + 8 : margemEsq;
  if (logo) doc.addImage(logo, "PNG", margemEsq, 10, logoLargura, logoAltura);

  doc.setFontSize(15);
  doc.setTextColor(30);
  doc.text(EMPRESA.razaoSocial, inicioTexto, 18);
  doc.setFontSize(11.5);
  doc.setTextColor(90);
  doc.text("Recibo de pedido — não é documento fiscal", inicioTexto, 25);
  doc.setFontSize(8.5);
  doc.setTextColor(120);
  doc.text(`CNPJ ${EMPRESA.cnpj} · IE ${EMPRESA.inscricaoEstadual} · ${EMPRESA.telefone}`, inicioTexto, 30);

  let y = Math.max(10 + logoAltura, 32) + 6;
  doc.setDrawColor(220);
  doc.line(margemEsq, y, margemDir, y);
  y += 8;

  doc.setFontSize(11);
  doc.setTextColor(40);
  const dataFormatada = new Date(`${venda.data}T00:00:00`).toLocaleDateString("pt-BR");
  doc.text(`Pedido #${venda.numero ?? "—"}  ·  ${dataFormatada}`, margemEsq, y);
  y += 7;
  doc.setFontSize(10.5);
  doc.text(`Cliente: ${rede ? `${rede.nome} · ${loja?.nome ?? ""}` : loja?.nome ?? "—"}`, margemEsq, y);
  y += 8;

  const itens = venda.itens ?? [];
  autoTable(doc, {
    startY: y,
    head: [["Produto", "Qtd", "Un", "Preço", "Total"]],
    body: itens.map((i) => {
      const produto = produtosPorId[i.produtoId];
      const bonificado = i.natureza === "bonificacao";
      return [
        produto?.nome ?? i.produtoId,
        Number(i.qty).toLocaleString("pt-BR"),
        unidadeDoItem(i, produto),
        bonificado ? "bonificado" : brl(i.precoUnitario),
        bonificado ? "—" : brl(i.qty * i.precoUnitario),
      ];
    }),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [45, 106, 79] },
    margin: { left: margemEsq, right: margemEsq },
  });
  y = doc.lastAutoTable.finalY + 10;

  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text(`Total do pedido: ${brl(venda.total)}`, margemEsq, y);
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(kg(venda.kgTotal), margemEsq, y);
  y += 12;

  const todoBonificado = itens.length > 0 && itens.every((i) => i.natureza === "bonificacao");

  doc.setFontSize(8.5);
  doc.setTextColor(130);
  const aviso = doc.splitTextToSize(
    todoBonificado
      ? "Este pedido é só bonificação — não é venda, não gera nota fiscal. Este recibo confirma a entrega."
      : "Este recibo confirma esta entrega. A nota fiscal referente a esta e às demais entregas da semana " +
        "é emitida em conjunto, no último pedido da semana.",
    margemDir - margemEsq
  );
  doc.text(aviso, margemEsq, y);
  y += aviso.length * 4 + 14;

  if (y > 250) {
    doc.addPage();
    y = 30;
  }

  // Campo em branco para o motorista/loja anotar a caneta — não é algo que o
  // sistema calcula, é contado na hora da entrega/devolução.
  doc.setFontSize(10.5);
  doc.setTextColor(40);
  doc.text("Quantidade de caixas plásticas: ______________________", margemEsq, y);
  y += 18;

  if (y > 255) {
    doc.addPage();
    y = 30;
  }

  const largura = (margemDir - margemEsq - 20) / 2;
  const xEsq = margemEsq;
  const xDir = margemEsq + largura + 20;
  doc.setDrawColor(90);
  doc.line(xEsq, y, xEsq + largura, y);
  doc.line(xDir, y, xDir + largura, y);
  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text(EMPRESA.razaoSocial, xEsq, y);
  doc.text("Responsável pelo estabelecimento", xDir, y);

  doc.save(`recibo-pedido-${venda.numero ?? venda.id}.pdf`);
}

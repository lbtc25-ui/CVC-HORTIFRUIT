/**
 * Exportação de relatórios — .xlsx e PDF, montados no navegador a partir dos
 * dados já carregados no app. Nada sai para um servidor: o arquivo nasce e
 * baixa no próprio aparelho.
 *
 * As bibliotecas entram por import dinâmico — só quem clica em "Exportar"
 * paga o peso delas no download; o resto do app nem carrega.
 *
 * Sobre o pacote `xlsx` (SheetJS): o npm mostra um aviso de segurança alto
 * (ReDoS e "prototype pollution") sem correção publicada. Os dois problemas
 * vivem no caminho de LEITURA de um arquivo (`XLSX.read`/`readFile`), que
 * este módulo nunca chama — aqui só se GERA planilha a partir de dados que
 * já são do próprio app (`json_to_sheet` + `writeFile`), nunca se abre um
 * .xlsx de fora. Decisão registrada, revisitar se o pacote publicar correção.
 */
import { EMPRESA } from "./empresa";

/**
 * @param {string} nomeArquivo sem extensão
 * @param {{ nome: string, colunas: {chave: string, rotulo: string}[], linhas: object[] }[]} planilhas
 *   uma aba por entrada; `colunas` diz a ordem e o rótulo de cada campo de `linhas`
 */
export async function exportarXlsx(nomeArquivo, planilhas) {
  const XLSX = await import("xlsx");
  const livro = XLSX.utils.book_new();
  for (const { nome, colunas, linhas } of planilhas) {
    const objetos = linhas.map((linha) =>
      Object.fromEntries(colunas.map((c) => [c.rotulo, linha[c.chave]]))
    );
    const aba = XLSX.utils.json_to_sheet(objetos);
    // Nome de aba no Excel é limitado a 31 caracteres.
    XLSX.utils.book_append_sheet(livro, aba, nome.slice(0, 31));
  }
  XLSX.writeFile(livro, `${nomeArquivo}.xlsx`);
}

/**
 * @param {string} nomeArquivo sem extensão
 * @param {string} titulo cabeçalho do PDF
 * @param {{ titulo?: string, colunas: {chave: string, rotulo: string}[], linhas: object[] }[]} tabelas
 *   uma tabela por entrada, cada uma com seu subtítulo opcional
 */
export async function exportarPdf(nomeArquivo, titulo, tabelas) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(titulo, 14, 16);
  doc.setFontSize(9.5);
  doc.setTextColor(130);
  doc.text(`${EMPRESA.razaoSocial} · CNPJ ${EMPRESA.cnpj} · gerado em ${new Date().toLocaleDateString("pt-BR")}`, 14, 22);

  let y = 30;
  for (const { titulo: subtitulo, colunas, linhas } of tabelas) {
    if (subtitulo) {
      doc.setFontSize(11);
      doc.setTextColor(40);
      doc.text(subtitulo, 14, y);
      y += 5;
    }
    autoTable(doc, {
      startY: y,
      head: [colunas.map((c) => c.rotulo)],
      body: linhas.map((linha) => colunas.map((c) => String(linha[c.chave] ?? ""))),
      styles: { fontSize: 8.5 },
      headStyles: { fillColor: [45, 106, 79] },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  doc.save(`${nomeArquivo}.pdf`);
}

/**
 * Romaneio impresso: uma linha por nota, largura da página inteira, com o QR
 * alternando de lado a cada linha — esquerda, direita, esquerda, direita —
 * em vez de ficar sempre grudado na mesma borda (layout pedido à mão pelo
 * usuário). A altura de cada linha não é fixa: cada página distribui suas
 * linhas pelo espaço vertical inteiro disponível, até um teto razoável —
 * assim um romaneio de poucas paradas usa a folha toda em vez de ficar
 * espremido no topo com o resto da página em branco.
 *
 * Duas notas do mesmo estabelecimento viram UMA parada no papel (mesma
 * loja, mesma parada física) — por isso `paradas` já chega agrupado por
 * `cliente`, com uma ou mais `notas` dentro. Quando há mais de uma, o
 * cabeçalho da parada aparece uma vez só e cada nota entra logo abaixo, com
 * seu próprio QR — o motorista ainda escaneia cada uma separadamente.
 *
 * `viagem` > 1 identifica qual das viagens desse veículo no dia é esta —
 * quando o mesmo caminhão sai duas vezes no mesmo dia (2ª carga), cada
 * viagem tem seu próprio romaneio, marcado no cabeçalho e no nome do arquivo.
 *
 * @param {{ veiculo: string, motorista: string, data: string, viagem?: number,
 *   paradas: { cliente: string, notas: { numero: number|string, itens: string, kg: string, total: string, qr: string }[] }[] }} romaneio
 */
export async function exportarRomaneioPdf({ veiculo, motorista, data, paradas, viagem = 1, atualizado = null, carga = null }) {
  const { default: jsPDF } = await import("jspdf");
  const doc = new jsPDF();

  const margemEsq = 14;
  const margemDir = 196;
  const inicioDaPagina = 40;
  const finalDaPagina = 285;
  const alturaDisponivel = finalDaPagina - inicioDaPagina;

  const alturaMinima = 20;
  const alturaMaxima = 40;
  const larguraQrBase = 16;
  const alturaCabecalhoGrupoBase = 6;

  const desenharCabecalho = () => {
    doc.setFontSize(15);
    doc.setTextColor(30);
    doc.text(EMPRESA.nomeNoApp, margemEsq, 16);
    doc.setFontSize(10);
    doc.setTextColor(90);
    // `atualizado` = hora em que a rota mexida gerou este papel de novo, pra o
    // motorista não confundir com o romaneio anterior.
    doc.text(`Romaneio · ${data}${atualizado ? `  ·  ATUALIZADO às ${atualizado}` : ""}`, margemEsq, 23);
    doc.text(`Veículo: ${veiculo}${viagem > 1 ? `  ·  ${viagem}ª viagem` : ""}${motorista ? `  ·  Motorista: ${motorista}` : ""}${carga ? `  ·  Carga: ${carga}` : ""}`, margemEsq, 29);
    doc.setDrawColor(220);
    doc.line(margemEsq, 34, margemDir, 34);
  };

  // Achata `paradas` (já agrupada por loja) numa lista de linhas pro papel:
  // um cabeçalho (só quando a parada tem mais de uma nota) seguido de uma
  // linha por nota, cada uma com seu próprio QR.
  const linhas = [];
  paradas.forEach((p, indiceParada) => {
    const mescladas = p.notas.length > 1;
    if (mescladas) linhas.push({ tipo: "cabecalho", cliente: p.cliente, indiceParada, totalNotas: p.notas.length });
    p.notas.forEach((nota) => linhas.push({ tipo: "nota", nota, cliente: p.cliente, indiceParada, mescladas }));
  });

  // Divide em páginas usando a altura mínima como referência (o cabeçalho de
  // um grupo mesclado pesa menos que uma linha de nota) — cada página, uma
  // vez fechada, estica suas linhas para ocupar o espaço vertical sobrando.
  const pesoLinha = (l) => (l.tipo === "cabecalho" ? 0.4 : 1);
  const capacidadePorPagina = alturaDisponivel / alturaMinima;
  const paginas = [];
  let paginaAtual = [];
  let pesoAtual = 0;
  linhas.forEach((l) => {
    if (pesoAtual + pesoLinha(l) > capacidadePorPagina && paginaAtual.length > 0) {
      paginas.push(paginaAtual);
      paginaAtual = [];
      pesoAtual = 0;
    }
    paginaAtual.push(l);
    pesoAtual += pesoLinha(l);
  });
  paginas.push(paginaAtual);

  paginas.forEach((itensDaPagina, indicePagina) => {
    if (indicePagina > 0) doc.addPage();
    desenharCabecalho();

    const pesoTotal = itensDaPagina.reduce((s, l) => s + pesoLinha(l), 0) || 1;
    const alturaLinha = Math.min(alturaMaxima, alturaDisponivel / pesoTotal);
    const escala = alturaLinha / alturaMinima;
    const larguraQr = Math.min(28, larguraQrBase * escala);
    const alturaCabecalhoGrupo = alturaCabecalhoGrupoBase * escala;

    let y = inicioDaPagina;
    // Conta só linhas de nota (não o cabeçalho de grupo) pra alternar o QR.
    let numeroLinhaImpressa = 0;
    itensDaPagina.forEach((l) => {
      if (l.tipo === "cabecalho") {
        doc.setFontSize(Math.min(15, 10.5 * escala));
        doc.setTextColor(30);
        doc.text(`${l.indiceParada + 1}. ${l.cliente} — ${l.totalNotas} notas nesta parada`, margemEsq, y + 4 * escala);
        y += alturaCabecalhoGrupo;
        return;
      }

      const { nota, cliente, indiceParada, mescladas } = l;
      const qrNaDireita = numeroLinhaImpressa % 2 === 1;
      numeroLinhaImpressa += 1;
      const xQr = qrNaDireita ? margemDir - larguraQr : margemEsq;
      const textoX = qrNaDireita ? margemEsq : margemEsq + larguraQr + 6;
      const larguraTexto = qrNaDireita ? margemDir - larguraQr - 6 - margemEsq : margemDir - textoX;
      const rotulo = mescladas ? `Pedido #${nota.numero}` : `${indiceParada + 1}. Pedido #${nota.numero} — ${cliente}`;

      doc.addImage(nota.qr, "PNG", xQr, y, larguraQr, larguraQr);

      doc.setFontSize(Math.min(15, 10.5 * escala));
      doc.setTextColor(30);
      doc.text(rotulo, textoX, y + 5 * escala);

      doc.setFontSize(Math.min(12, 8.5 * escala));
      doc.setTextColor(90);
      const itensLinhas = doc.splitTextToSize(nota.itens || "—", larguraTexto).slice(0, 2);
      doc.text(itensLinhas, textoX, y + 10.5 * escala);

      doc.setFontSize(Math.min(11, 8 * escala));
      doc.setTextColor(130);
      doc.text(`${nota.kg} · ${nota.total}`, textoX, y + alturaLinha - 2.5 * escala);

      doc.setDrawColor(235);
      doc.line(margemEsq, y + alturaLinha, margemDir, y + alturaLinha);

      y += alturaLinha;
    });
  });

  doc.save(`romaneio-${data}${viagem > 1 ? `-viagem${viagem}` : ""}${atualizado ? `-atualizado-${atualizado.replace(":", "h")}` : ""}.pdf`);
}


/**
 * Utilidades das telas de Notas Fiscais (emitidas, recebidas e devoluções).
 */

export const soDigitos = (v) => String(v || "").replace(/\D/g, "");

/** "PETROX · P.CAJU" */
export function nomeDoCliente(dados, lojaId) {
  const loja = dados.lojas.find((l) => l.id === lojaId);
  if (!loja) return "—";
  const rede = dados.redes.find((r) => r.id === loja.redeId);
  return rede ? `${rede.nome} · ${loja.nome}` : loja.nome;
}

/** A loja com esse CNPJ, se for cliente — é assim que uma nota recebida vira "devolução do cliente X". */
export function lojaPorCnpj(dados, cnpj) {
  const alvo = soDigitos(cnpj);
  if (alvo.length < 11) return null;
  return dados.lojas.find((l) => soDigitos(l.cnpjCpf) === alvo) ?? null;
}

/**
 * Série e número de dentro da chave de acesso — a listagem de notas
 * recebidas da Spedy não traz esses campos, mas a chave sempre traz:
 * cUF(2) AAMM(4) CNPJ(14) modelo(2) série(3) número(9) tpEmis(1) cNF(8) DV(1).
 */
export function numeroDaChave(chave) {
  const c = soDigitos(chave);
  if (c.length !== 44) return { serie: null, numero: null };
  return { serie: String(Number(c.slice(22, 25))), numero: Number(c.slice(25, 34)) };
}

/** "12.345.678/0001-90" (ou CPF), só para leitura. */
export function formatarCnpj(v) {
  const d = soDigitos(v);
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return v || "";
}

/** Quanto de cada item da venda já foi devolvido, somando as devoluções registradas. */
export function devolvidoPorItem(notasEntrada, vendaId) {
  const soma = {};
  for (const n of notasEntrada) {
    if (n.vendaId !== vendaId || n.tipo !== "devolucao") continue;
    if (n.origem === "app" && n.nfeStatus !== "autorizada" && n.nfeStatus !== "processando") continue;
    for (const i of n.itens ?? []) {
      if (!i.produtoId) continue;
      soma[i.produtoId] = (soma[i.produtoId] ?? 0) + (Number(i.qty) || 0);
    }
  }
  return soma;
}

/** Valor já devolvido de uma venda (notas do cliente + notas emitidas por nós). */
export function valorDevolvido(notasEntrada, vendaId) {
  return notasEntrada
    .filter((n) => n.vendaId === vendaId && n.tipo === "devolucao"
      && (n.origem !== "app" || n.nfeStatus === "autorizada"))
    .reduce((s, n) => s + (Number(n.valor) || 0), 0);
}

const semAcento = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** A devolução vale? Nota do cliente sempre; a nossa só depois de autorizada pela SEFAZ. */
const devolucaoValendo = (n) =>
  n.tipo === "devolucao" && n.vendaId && (n.origem !== "app" || n.nfeStatus === "autorizada");

/**
 * O que cada devolução tira da venda a que pertence: dinheiro e quilos, item
 * a item. É a conta única por trás do faturamento (a receita do pedido fica
 * líquida do que voltou) e do estoque (o que voltou aproveitável entra de
 * novo). `kgVolta` é o que volta ao estoque — zero quando a mercadoria veio
 * avariada (`avariada` no item), que continua fora do depósito.
 *
 * A nota que o app emite traz `produtoId` e a quantidade na unidade da
 * venda; a do cliente vem do XML (descrição, quantidade, valor) e é casada
 * com os itens da venda pelo nome do produto. O que não casar abate a
 * receita do primeiro item da venda, sem mexer em quilos.
 */
export function efeitosDasDevolucoes(dados) {
  const vendaPorId = new Map(dados.vendas.map((v) => [v.id, v]));
  const produtoPorId = new Map(dados.produtos.map((p) => [p.id, p]));
  const linhas = [];

  for (const n of dados.notas_entrada ?? []) {
    if (!devolucaoValendo(n)) continue;
    const venda = vendaPorId.get(n.vendaId);
    if (!venda) continue;
    const itensVenda = (venda.itens ?? []).filter((i) => i.natureza !== "bonificacao");
    let abatido = 0;

    for (const i of n.itens ?? []) {
      const itemVenda = i.produtoId
        ? itensVenda.find((x) => x.produtoId === i.produtoId)
        : itensVenda.find((x) => {
            const nome = semAcento(produtoPorId.get(x.produtoId)?.nome);
            const desc = semAcento(i.descricao);
            return nome && desc && (desc.includes(nome) || nome.includes(desc));
          });
      if (!itemVenda) continue;
      const kgPorUnidade = Number(itemVenda.kgPorUnidade) || 1;
      const qtyVenda = Number(itemVenda.qty) || 0;
      // Quantidade na unidade da venda; o XML do cliente pode vir em kg para um produto vendido em saco.
      const emKg = !i.produtoId && /^kg/i.test(String(i.unidade || "")) && kgPorUnidade !== 1;
      const qty = i.produtoId ? Number(i.qty) || 0 : (Number(i.quantidade) || 0) / (emKg ? kgPorUnidade : 1);
      if (!(qty > 0) || !(qtyVenda > 0)) continue;
      const kg = qty * (Number(itemVenda.kgTotal) / qtyVenda || kgPorUnidade);
      const receita = i.produtoId ? qty * (Number(itemVenda.precoUnitario) || 0) : Number(i.total) || qty * (Number(itemVenda.precoUnitario) || 0);
      abatido += receita;
      linhas.push({
        notaId: n.id, vendaId: venda.id, data: venda.data, lojaId: venda.lojaId,
        produtoId: itemVenda.produtoId, receita, kg, kgVolta: i.avariada ? 0 : kg,
      });
    }

    const resto = Number((Number(n.valor) - abatido).toFixed(2));
    if (resto > 0.01 && itensVenda[0]) {
      linhas.push({
        notaId: n.id, vendaId: venda.id, data: venda.data, lojaId: venda.lojaId,
        produtoId: itensVenda[0].produtoId, receita: resto, kg: 0, kgVolta: 0,
      });
    }
  }
  return linhas;
}

/**
 * Baixa uma lista de arquivos e entrega um .zip. `arquivos` é
 * [{ nome, url, rotulo }] — ou `obter` no lugar de `url`, uma função que
 * devolve o conteúdo; os que falharem saem num aviso no fim.
 */
export async function baixarZip({ arquivos, nomeZip, aoProgredir }) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const falhas = [];
  for (let i = 0; i < arquivos.length; i++) {
    const a = arquivos[i];
    aoProgredir?.({ feito: i, total: arquivos.length });
    try {
      if (a.obter) {
        const conteudo = await a.obter();
        if (!conteudo) throw new Error("sem conteúdo");
        zip.file(a.nome, conteudo);
      } else {
        const resp = await fetch(a.url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        zip.file(a.nome, await resp.text());
      }
    } catch (e) {
      falhas.push(`${a.rotulo} (${e.message})`);
    }
  }
  aoProgredir?.(null);
  if (falhas.length === arquivos.length) {
    alert(`Não foi possível baixar nenhum XML:\n• ${falhas.join("\n• ")}`);
    return;
  }
  const blob = await zip.generateAsync({ type: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = nomeZip;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
  if (falhas.length) alert(`O .zip saiu sem ${falhas.length} XML(s):\n• ${falhas.join("\n• ")}`);
}

/**
 * Pedido por voz — interpreta a transcrição do reconhecimento de voz do
 * navegador ("pedido petrox aruana, 20 sacos de 2,5 quilos") e casa com a
 * rede, a loja e os produtos já cadastrados. Nunca envia nada sozinho: só
 * devolve um rascunho para a tela preencher, e quem confirma e toca em
 * "Enviar pedido" é sempre a pessoa — importante para quem faz o pedido
 * dirigindo, sem tempo de digitar.
 */

const semAcento = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "");

export const normalizar = (s) =>
  semAcento(String(s ?? "").toLowerCase())
    .replace(/[^a-z0-9,.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// ─── Números por extenso (0–99, "e" e decimais com "vírgula" ou "e meio") ──

const UNIDADES = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5,
  seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13,
  catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19,
};
const DEZENAS = {
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60,
  setenta: 70, oitenta: 80, noventa: 90,
};
const PALAVRA_NUMERO = new Set([...Object.keys(UNIDADES), ...Object.keys(DEZENAS), "cem", "cento"]);

/** Converte um grupo de palavras tipo "vinte e cinco" ou "cem" num número. */
function grupoParaNumero(palavras) {
  let n = 0;
  for (const p of palavras) {
    if (p === "cem" || p === "cento") n += 100;
    else if (DEZENAS[p] !== undefined) n += DEZENAS[p];
    else if (UNIDADES[p] !== undefined) n += UNIDADES[p];
  }
  return n;
}

/**
 * Troca números por extenso pelo dígito equivalente no texto normalizado —
 * o reconhecimento de voz do Chrome já converte a maioria, mas nem sempre
 * ("vinte sacos" às vezes fica por extenso mesmo em pt-BR).
 */
export function numerosPorExtenso(texto) {
  const palavras = texto.split(" ");
  const saida = [];
  let i = 0;
  while (i < palavras.length) {
    if (PALAVRA_NUMERO.has(palavras[i])) {
      const grupo = [palavras[i]];
      let j = i + 1;
      while (j < palavras.length && (PALAVRA_NUMERO.has(palavras[j]) || (palavras[j] === "e" && PALAVRA_NUMERO.has(palavras[j + 1])))) {
        if (palavras[j] !== "e") grupo.push(palavras[j]);
        j++;
      }
      let numero = grupoParaNumero(grupo);
      // "dois vírgula cinco" (kg fracionado) e "dois e meio" (o mesmo que 2,5).
      if (palavras[j] === "virgula" && PALAVRA_NUMERO.has(palavras[j + 1])) {
        numero = `${numero},${grupoParaNumero([palavras[j + 1]])}`;
        j += 2;
      } else if (palavras[j] === "meio" || palavras[j] === "meia") {
        numero = numero + 0.5;
        j++;
      } else if (palavras[j] === "e" && (palavras[j + 1] === "meio" || palavras[j + 1] === "meia")) {
        numero = numero + 0.5;
        j += 2;
      }
      saida.push(String(numero));
      i = j;
    } else {
      saida.push(palavras[i]);
      i++;
    }
  }
  // "dois quilos e meio" — o "e meio" só foi pego acima quando vinha colado no
  // número ("dois e meio"); aqui pega quando vem depois da unidade também.
  return saida.join(" ").replace(
    /(\d+(?:[.,]\d+)?)\s+(kg|quil[oa]s?)\s+e\s+(meio|meia)\b/g,
    (_, num) => `${Number(String(num).replace(",", ".")) + 0.5} kg`,
  );
}

// ─── Casar rede e loja pelo nome ────────────────────────────────────────────

const escaparRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const bateNoTexto = (palavra, texto) => new RegExp(`(?:^|\\s)${escaparRegex(palavra)}(?:\\s|$)`).test(` ${texto} `);

/**
 * A palavra do cadastro aparece no texto, igual ou como raiz de uma palavra
 * falada mais comprida ("caju" em "cajueiros"). Só nessa direção — cadastro
 * como prefixo do que foi falado — senão uma preposição curta ("por", de
 * "por do sol") vira prefixo de "porto" por acaso e cria ambiguidade à toa.
 */
function bateParecido(palavraCadastro, texto) {
  return texto.split(" ").some((p) => p.length >= 3 && (p === palavraCadastro || p.startsWith(palavraCadastro)));
}

/**
 * A rede/loja cujo nome aparece no texto — a de nome mais longo, se mais de
 * uma bater. Se nenhum nome bater igual, tenta pelas palavras "cheias" (3+
 * letras) do cadastro: nomes como "ORLA P.D SOL" (Orla Pôr do Sol), "F.PORTO"
 * (Francisco Porto) ou "P.CAJU" (Parque dos Cajueiros) têm inicial abreviada
 * com ponto, mas quem fala diz por extenso — só entram nessa segunda tentativa
 * lojas cujo nome tem ponto (abreviação de verdade); senão "porto" batia
 * também dentro de "AEROPORTO" por acaso, e vira ambiguidade em vez de acerto.
 * Só aceita se apontar para uma loja só, sem ambiguidade com outra da lista.
 */
function acharPorNome(texto, lista) {
  let melhor = null;
  for (const item of lista) {
    const nome = normalizar(item.nome);
    if (nome && bateNoTexto(nome, texto) && (!melhor || nome.length > normalizar(melhor.nome).length)) melhor = item;
  }
  if (melhor) return melhor;

  const candidatos = lista.filter((item) => {
    if (!item.nome.includes(".")) return false;
    const palavras = normalizar(item.nome).split(/[.\s]+/).filter((w) => w.length >= 3);
    return palavras.length > 0 && palavras.every((w) => bateParecido(w, texto));
  });
  return candidatos.length === 1 ? candidatos[0] : null;
}

// ─── Achar "20 sacos de 2,5 kg" e "5 kg de abóbora" no texto ───────────────

// O "de laranja" em "sacos de laranja de 2,5 kg" é opcional — a fruta é
// citada ou não, e não muda o produto (o catálogo tem só uma fruta em saco).
const RE_SACO = /(\d+(?:[.,]\d+)?)\s*sacos?\s*(?:de\s+[a-z]+(?:\s+[a-z]+)?\s+)?(?:de\s*)?(\d+(?:[.,]\d+)?)\s*(?:kg|quil[oa]s?)/g;
const RE_GRANEL = /(\d+(?:[.,]\d+)?)\s*(?:kg|quil[oa]s?)\s*(?:de\s*)?([a-z]+(?:\s[a-z]+)?)/g;

const paraNumero = (s) => Number(String(s).replace(",", "."));

/** Produtos vendidos por saco, e a que caberia "de 2,5 kg" pelo tamanho do saco. */
function acharSaco(produtos, tamanhoKg) {
  return produtos.find((p) => p.unidadeVenda === "saco" && Math.abs(Number(p.kgPorUnidade) - tamanhoKg) < 0.05);
}

/**
 * Produtos vendidos a granel (kg), pela fruta/nome citado depois do "kg de
 * …". Só considera palavras com 3+ letras — sem isto, "5 quilos e 10 sacos"
 * (o "e" solto entre dois itens) já batia com o "e" de "laranja" por engano.
 */
function acharGranel(produtos, textoFruta) {
  const palavrasAlvo = normalizar(textoFruta).split(" ").filter((w) => w.length >= 3);
  if (palavrasAlvo.length === 0) return null;
  return produtos.find((p) => {
    if (p.unidadeVenda === "saco") return false;
    const palavrasProduto = [...normalizar(p.fruta).split(" "), ...normalizar(p.nome).split(" ")].filter((w) => w.length >= 3);
    return palavrasAlvo.some((a) => palavrasProduto.some((b) => a === b || a.includes(b) || b.includes(a)));
  });
}

/**
 * `redes`: [{ id, nome, lojas: [{ id, nome, produtoIds }] }] — o que
 * `pedido_geral_abrir` devolve. `produtosGlobais`: a lista completa, para
 * saber que produtos cada loja libera (produtoIds null = todos).
 *
 * Devolve `{ rede, loja, itens: [{ produtoId, produtoNome, qty }], entendeuAlgumItem }`.
 * `rede`/`loja` vêm `null` quando o nome não bateu com nada cadastrado.
 */
export function interpretarPedidoVoz(textoFalado, redes, produtosGlobais) {
  const texto = numerosPorExtenso(normalizar(textoFalado));

  const rede = acharPorNome(texto, redes);
  const loja = rede ? acharPorNome(texto, rede.lojas) : null;

  const produtosDaLoja = loja
    ? (Array.isArray(loja.produtoIds) ? produtosGlobais.filter((p) => loja.produtoIds.includes(p.id)) : produtosGlobais)
    : produtosGlobais;

  const porProduto = new Map();
  const somar = (produto, qty) => {
    if (!produto || !(qty > 0)) return;
    porProduto.set(produto.id, { produtoId: produto.id, produtoNome: produto.nome, qty: (porProduto.get(produto.id)?.qty ?? 0) + qty });
  };

  for (const m of texto.matchAll(RE_SACO)) somar(acharSaco(produtosDaLoja, paraNumero(m[2])), paraNumero(m[1]));
  for (const m of texto.matchAll(RE_GRANEL)) somar(acharGranel(produtosDaLoja, m[2]), paraNumero(m[1]));

  return {
    rede: rede ?? null,
    loja: loja ?? null,
    itens: [...porProduto.values()],
    entendeuAlgumItem: porProduto.size > 0,
  };
}

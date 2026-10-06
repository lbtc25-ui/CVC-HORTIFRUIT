/**
 * Leitor de XML mínimo, sem DOMParser — roda no navegador e no Node (os
 * testes), e ignora o prefixo de namespace (`<ns:det>` e `<det>` são o mesmo).
 *
 * Só serve para o XML da NF-e: elementos, atributos e texto. Não valida.
 * Cada nó é { nome, attrs, filhos, texto }.
 */

const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

const decodificar = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const cod = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cod) ? String.fromCodePoint(cod) : m;
    }
    return ENTIDADES[e.toLowerCase()] ?? m;
  });

const semPrefixo = (nome) => nome.replace(/^.*:/, "");

const ATRIBUTO = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

const TOKEN =
  /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s/>!?]+)((?:\s+[^\s=>/]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;

export function parseXml(texto) {
  const raiz = { nome: "#raiz", attrs: {}, filhos: [], texto: "" };
  const pilha = [raiz];
  for (const m of String(texto).replace(/^\uFEFF/, "").matchAll(TOKEN)) {
    const atual = pilha[pilha.length - 1];
    if (m[1] !== undefined) atual.texto += m[1];
    else if (m[2] !== undefined) {
      if (pilha.length > 1) pilha.pop();
    } else if (m[3] !== undefined) {
      const attrs = {};
      for (const a of (m[4] ?? "").matchAll(ATRIBUTO)) attrs[semPrefixo(a[1])] = decodificar(a[2] ?? a[3] ?? "");
      const no = { nome: semPrefixo(m[3]), attrs, filhos: [], texto: "" };
      atual.filhos.push(no);
      if (m[5] !== "/") pilha.push(no);
    } else if (m[6] !== undefined) {
      atual.texto += decodificar(m[6]);
    }
  }
  return raiz;
}

/** O filho direto com esse nome. */
export const filho = (no, nome) => no?.filhos.find((f) => f.nome === nome);

/** Segue uma sequência de filhos: caminho(no, "total", "ICMSTot"). */
export const caminho = (no, ...nomes) => nomes.reduce((n, nome) => filho(n, nome), no);

/** Texto (sem espaços nas pontas) do elemento no fim do caminho; "" se não existe. */
export const texto = (no, ...nomes) => (caminho(no, ...nomes)?.texto ?? "").trim();

/** Todos os filhos diretos com esse nome. */
export const lista = (no, nome) => (no ? no.filhos.filter((f) => f.nome === nome) : []);

/** O primeiro descendente com esse nome, em qualquer profundidade. */
export function achar(no, nome) {
  if (!no) return undefined;
  for (const f of no.filhos) {
    if (f.nome === nome) return f;
    const dentro = achar(f, nome);
    if (dentro) return dentro;
  }
  return undefined;
}

/**
 * Derivação e verificação de senha para o modo local (sem Supabase).
 *
 * Usa PBKDF2-SHA512 da Web Crypto API, com sal aleatório por usuário e o
 * número de iterações recomendado pelo OWASP. O formato guardado é:
 *
 *   pbkdf2$sha512$<iteracoes>$<sal em base64>$<hash em base64>
 *
 * ⚠️  Isto protege a senha guardada no aparelho — não é controle de acesso de
 * verdade: no modo local tudo roda no navegador e um usuário determinado
 * consegue abrir o IndexedDB pelo DevTools. Segurança real vem do Supabase
 * Auth + RLS (veja supabase/auth.sql).
 */

const ITERACOES = 210_000;
const TAM_SAL = 16;
const TAM_CHAVE = 32;

const cripto = () => {
  const c = globalThis.crypto;
  if (!c?.subtle) {
    throw new Error(
      "Este navegador não expõe a Web Crypto API. Abra o app por HTTPS ou localhost."
    );
  }
  return c;
};

const paraBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));

const deBase64 = (texto) =>
  Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));

async function derivar(senha, sal, iteracoes = ITERACOES) {
  const c = cripto();
  const chave = await c.subtle.importKey(
    "raw",
    new TextEncoder().encode(senha),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await c.subtle.deriveBits(
    { name: "PBKDF2", salt: sal, iterations: iteracoes, hash: "SHA-512" },
    chave,
    TAM_CHAVE * 8
  );
  return new Uint8Array(bits);
}

/** Devolve a string pronta para gravar no banco local. */
export async function gerarHash(senha) {
  const sal = cripto().getRandomValues(new Uint8Array(TAM_SAL));
  const hash = await derivar(senha, sal);
  return `pbkdf2$sha512$${ITERACOES}$${paraBase64(sal)}$${paraBase64(hash)}`;
}

/** Comparação em tempo constante — não vaza o tamanho do prefixo correto. */
function iguais(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function conferirHash(senha, guardado) {
  if (typeof guardado !== "string") return false;

  const [algoritmo, digest, iteracoes, sal, hash] = guardado.split("$");
  if (algoritmo !== "pbkdf2" || digest !== "sha512" || !sal || !hash) return false;

  try {
    const calculado = await derivar(senha, deBase64(sal), Number(iteracoes));
    return iguais(calculado, deBase64(hash));
  } catch {
    return false;
  }
}

/**
 * Regras mínimas de senha. Devolve `null` quando está tudo certo ou a
 * mensagem a exibir no formulário.
 */
export function validarSenha(senha) {
  if (!senha || senha.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  if (!/[a-zA-Z]/.test(senha)) return "A senha precisa ter pelo menos uma letra.";
  if (!/[0-9]/.test(senha)) return "A senha precisa ter pelo menos um número.";
  return null;
}

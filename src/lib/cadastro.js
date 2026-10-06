/**
 * Ficha cadastral de cliente — a mesma para rede e loja.
 *
 * A rede é quem se cobra (razão social e CNPJ da matriz); a loja é quem
 * recebe a mercadoria (cada filial tem o próprio CNPJ, IE e endereço de
 * entrega). Os campos são os mesmos nos dois níveis, então vivem aqui, num
 * lugar só: a lista de campos, as máscaras, a validação e as consultas de
 * CNPJ e CEP que preenchem a ficha sozinhas.
 */

/** Campos da ficha, todos texto, todos opcionais. */
export const CAMPOS_CADASTRO = [
  "razaoSocial", "cnpjCpf", "ie", "contato", "telefone", "email",
  "cep", "logradouro", "numero", "complemento", "bairro", "cidade", "uf",
  "observacoes",
];

export const cadastroVazio = () =>
  Object.fromEntries(CAMPOS_CADASTRO.map((c) => [c, ""]));

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export const soDigitos = (v) => String(v ?? "").replace(/\D/g, "");

// ─── Máscaras ───────────────────────────────────────────────────────────────

export function mascaraCnpj(v) {
  const d = soDigitos(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

/** CPF (11 dígitos) enquanto couber, CNPJ a partir do 12º dígito. */
export function mascaraCnpjCpf(v) {
  const d = soDigitos(v).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }
  return mascaraCnpj(d);
}

export function mascaraCep(v) {
  const d = soDigitos(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export function mascaraTelefone(v) {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// ─── Validação ──────────────────────────────────────────────────────────────

/** Confere os dois dígitos verificadores do CNPJ. */
export function cnpjValido(v) {
  const d = soDigitos(v);
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const digito = (base) => {
    let soma = 0;
    let peso = base.length - 7;
    for (const n of base) {
      soma += Number(n) * peso--;
      if (peso < 2) peso = 9;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = digito(d.slice(0, 12));
  const d2 = digito(d.slice(0, 12) + d1);
  return d.endsWith(`${d1}${d2}`);
}

/** Confere os dois dígitos verificadores do CPF. */
export function cpfValido(v) {
  const d = soDigitos(v);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const digito = (n) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

export const ehCnpj = (v) => soDigitos(v).length === 14;

export const emailValido = (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim());

/**
 * Inscrição estadual: "ISENTO", ou só números. Em Sergipe são 9 dígitos com
 * dígito verificador (pesos 9…2, módulo 11) — conferido contra as 62 IEs de
 * SE já cadastradas. Outras UFs têm regras próprias; ali só o tamanho.
 */
export function ieValida(ie, uf) {
  const t = String(ie ?? "").trim();
  if (/^isent[oa]$/i.test(t)) return true;
  if (/[^\d.\-/\s]/.test(t)) return false;
  const d = soDigitos(t);
  if (String(uf ?? "").toUpperCase() !== "SE") return d.length >= 2 && d.length <= 14;
  if (d.length !== 9) return false;
  let soma = 0;
  for (let i = 0; i < 8; i++) soma += Number(d[i]) * (9 - i);
  const dv = 11 - (soma % 11);
  return (dv >= 10 ? 0 : dv) === Number(d[8]);
}

/**
 * A NF-e aceita no máximo 10 caracteres no número do endereço, mas o
 * cadastro vindo do Omie tem lojas com o complemento dentro do número
 * ("1020 - LOJA 01", "S/N - ANEXO I"). Separa: o número fica só com o
 * número (ou S/N) e o resto vai para o complemento.
 */
export function separarNumero(numero, complemento) {
  const bruto = String(numero ?? "").trim();
  const m = bruto.match(/^(\d+[A-Za-z]?|s\/?n)\b\s*[-–,/]?\s*(.*)$/i);
  let num = bruto;
  let resto = "";
  if (m && bruto.length > 10) {
    num = m[1].toUpperCase().replace(/^SN$/, "S/N");
    resto = m[2];
  } else if (bruto.length > 10) {
    num = bruto.slice(0, 10);
    resto = bruto.slice(10);
  }
  if (/^s\/?n$/i.test(num)) num = "S/N";
  const compl = [String(complemento ?? "").trim(), resto.trim()].filter(Boolean).join(" - ");
  return { numero: num, complemento: compl };
}

// ─── Regras da NF-e (layout da SEFAZ, o que a Spedy repassa) ───────────────
//
// Tamanhos máximos dos campos do destinatário no XML da NF-e. Passar disso
// é recusa na certa (foi o que aconteceu com o número "760 - ACESSO PELA
// AV. J 781").

export const LIMITES = {
  razaoSocial: 60, logradouro: 60, numero: 10, complemento: 60, bairro: 60,
  cidade: 60, email: 60, contato: 60, ie: 14,
};

/** Obrigatórios para a loja poder receber NF-e. */
const OBRIGATORIOS_NFE = {
  cnpjCpf: "Informe o CNPJ ou CPF.",
  razaoSocial: "Informe a razão social (nome na Receita).",
  logradouro: "Informe o logradouro.",
  numero: "Informe o número (use S/N se não tiver).",
  bairro: "Informe o bairro.",
  cidade: "Informe a cidade.",
  uf: "Escolha a UF.",
  cep: "Informe o CEP.",
};

/**
 * Mensagens de erro da ficha, por campo. Vazio = pode salvar.
 *
 * Formato é sempre conferido (CNPJ com dígito certo, CEP com 8 dígitos,
 * tamanhos da NF-e…). Com `nfe: true` — a loja, que é quem recebe a nota —
 * também passam a ser obrigatórios os dados que a SEFAZ exige do
 * destinatário. A rede não recebe nota: só o formato conta.
 */
export function errosCadastro(f, { nfe = false } = {}) {
  const erros = {};
  const txt = (c) => String(f[c] ?? "").trim();

  if (nfe) {
    for (const [c, msg] of Object.entries(OBRIGATORIOS_NFE)) if (!txt(c)) erros[c] = msg;
  }

  const doc = soDigitos(f.cnpjCpf);
  if (doc && !(doc.length === 14 ? cnpjValido(doc) : doc.length === 11 ? cpfValido(doc) : false)) {
    erros.cnpjCpf = "CNPJ/CPF inválido — confira os números.";
  }

  const ie = txt("ie");
  if (ie && !ieValida(ie, f.uf)) {
    erros.ie = String(f.uf).toUpperCase() === "SE"
      ? "IE de Sergipe inválida: são 9 dígitos, e o último é verificador. Confira, ou escreva ISENTO."
      : "IE inválida: só números (ou ISENTO).";
  } else if (nfe && doc.length === 14 && !ie) {
    erros.ie = "Empresa (CNPJ) precisa de inscrição estadual — ou escreva ISENTO.";
  }

  if (txt("cep") && soDigitos(f.cep).length !== 8) erros.cep = "CEP tem 8 dígitos.";
  if (txt("uf") && !UFS.includes(txt("uf").toUpperCase())) erros.uf = "UF inválida.";
  if (!emailValido(f.email)) erros.email = "E-mail inválido.";
  const tel = soDigitos(f.telefone);
  if (tel && (tel.length < 10 || tel.length > 11)) erros.telefone = "Telefone com DDD: 10 ou 11 dígitos.";

  const num = txt("numero");
  if (num.length > 10) {
    erros.numero = "Só o número (até 10 caracteres). O resto vai em Complemento.";
  }

  for (const [c, max] of Object.entries(LIMITES)) {
    if (!erros[c] && txt(c).length > max) erros[c] = `No máximo ${max} caracteres (limite da NF-e).`;
  }
  return erros;
}

/** Ficha pronta para gravar: aparada, espaços normalizados, máscaras. */
export function normalizarCadastro(f) {
  const out = {};
  for (const c of CAMPOS_CADASTRO) {
    const v = String(f[c] ?? "");
    // Observações pode ter várias linhas; o resto é linha única no XML.
    out[c] = c === "observacoes" ? v.trim() : v.replace(/\s+/g, " ").trim();
  }
  out.cnpjCpf = out.cnpjCpf ? mascaraCnpjCpf(out.cnpjCpf) : "";
  out.cep = out.cep ? mascaraCep(out.cep) : "";
  out.telefone = out.telefone ? mascaraTelefone(out.telefone) : "";
  out.uf = out.uf.toUpperCase();
  out.email = out.email.toLowerCase();
  out.ie = /^isent[oa]$/i.test(out.ie) ? "ISENTO" : soDigitos(out.ie);
  Object.assign(out, separarNumero(out.numero, out.complemento));
  return out;
}

// ─── Pronto para NF-e? ──────────────────────────────────────────────────────
//
// As MESMAS regras do formulário da loja: se salvou, emite. Usado antes de
// emitir (bloqueia com a lista do que corrigir) e na tela de Clientes (marca
// a loja que ainda não passou pelo formulário novo — dados antigos).
//
// Duas tolerâncias só para os dados antigos, que a emissão já resolve
// sozinha: número com o complemento junto (separarNumero) e razão social
// vazia (a nota sai com o nome da loja).

/** Lista do que falta ou está errado para emitir NF-e. Vazia = pronto. */
export function pendenciasNfe(loja) {
  const l = { ...loja, ...separarNumero(loja.numero, loja.complemento) };
  const erros = errosCadastro(l, { nfe: true });
  delete erros.razaoSocial;
  return Object.values(erros);
}

// ─── Exibição ───────────────────────────────────────────────────────────────

/** "Av. Hermes Fontes, 1500, Sala 2 — Luzia, Aracaju/SE — CEP 49048-010" */
export function enderecoCompleto(f) {
  const rua = [f.logradouro, f.numero, f.complemento].filter(Boolean).join(", ");
  const local = [f.bairro, [f.cidade, f.uf].filter(Boolean).join("/")].filter(Boolean).join(", ");
  return [rua, local, f.cep ? `CEP ${f.cep}` : ""].filter(Boolean).join(" — ");
}

/** Texto em que a busca da tela de Clientes procura. */
export const textoBuscavel = (f) =>
  [f.nome, f.razaoSocial, f.cnpjCpf, soDigitos(f.cnpjCpf), f.cidade, f.bairro, f.contato]
    .filter(Boolean).join(" ").toLowerCase();

// ─── Consultas online ───────────────────────────────────────────────────────
//
// As duas são públicas, gratuitas e aceitam chamada do navegador (CORS).
// Só preenchem o formulário — se estiver offline, digita-se à mão.

async function buscarJson(url) {
  const resp = await fetch(url, { headers: { Accept: "application/json" } });
  if (!resp.ok) {
    const erro = new Error(resp.status === 404 ? "não encontrado" : `erro ${resp.status}`);
    erro.status = resp.status;
    throw erro;
  }
  return resp.json();
}

const titulo = (s) =>
  String(s ?? "").toLowerCase().replace(/(^|\s)\S/g, (l) => l.toUpperCase()).trim();

/** Dados da Receita pelo CNPJ (BrasilAPI). Devolve só os campos da ficha. */
//
// BrasilAPI primeiro; se ela falhar (fora do ar, limite de consultas), tenta a
// Minha Receita, que devolve os mesmos campos. CNPJ inexistente (404) não
// adianta repetir em outro lugar.
export async function consultarCnpj(cnpj) {
  const d = soDigitos(cnpj);
  let r;
  try {
    r = await buscarJson(`https://brasilapi.com.br/api/cnpj/v1/${d}`);
  } catch (e) {
    if (e.status === 404) throw e;
    r = await buscarJson(`https://minhareceita.org/${d}`);
  }
  const logradouro = [r.descricao_tipo_de_logradouro, r.logradouro].filter(Boolean).join(" ");
  const ddd = r.ddd_telefone_1 ? mascaraTelefone(r.ddd_telefone_1) : "";
  return {
    razaoSocial: r.razao_social ?? "",
    nomeFantasia: r.nome_fantasia ?? "",
    situacao: r.descricao_situacao_cadastral ?? "",
    telefone: ddd,
    email: (r.email ?? "").toLowerCase(),
    cep: r.cep ? mascaraCep(r.cep) : "",
    logradouro: titulo(logradouro),
    numero: r.numero ?? "",
    complemento: titulo(r.complemento),
    bairro: titulo(r.bairro),
    cidade: titulo(r.municipio),
    uf: (r.uf ?? "").toUpperCase(),
  };
}

/** Endereço pelo CEP (ViaCEP). */
export async function consultarCep(cep) {
  const r = await buscarJson(`https://viacep.com.br/ws/${soDigitos(cep)}/json/`);
  if (r.erro) throw new Error("não encontrado");
  return {
    logradouro: r.logradouro ?? "",
    bairro: r.bairro ?? "",
    cidade: r.localidade ?? "",
    uf: r.uf ?? "",
  };
}

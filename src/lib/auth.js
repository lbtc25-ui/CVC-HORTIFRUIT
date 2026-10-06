/**
 * Controle de acesso do app — uma API só para os dois cenários possíveis:
 *
 *   modo "supabase" → Supabase Auth (e-mail + senha) e a tabela `perfis`,
 *                     com RLS no Postgres barrando de verdade quem não entrou.
 *                     É o modo de produção. Veja supabase/auth.sql.
 *
 *   modo "local"    → sem backend: as contas ficam no IndexedDB com a senha
 *                     derivada por PBKDF2. Serve para rodar a demonstração e
 *                     para trancar o aparelho compartilhado do balcão, mas NÃO
 *                     é segurança de verdade — tudo roda no navegador.
 *
 * As telas (Login, Usuarios) só falam com este arquivo; qual dos dois modos
 * está ativo é detalhe de implementação para elas.
 */

import { createClient } from "@supabase/supabase-js";

import {
  apagarUsuario,
  contarUsuarios,
  gravarUsuario,
  lerUsuarioPorEmail,
  lerUsuarios,
} from "./db";
import { novoId } from "./mappers";
import { eMaster } from "./permissoes";
import { conferirHash, gerarHash } from "./senha";
import { anonKey, supabase, supabaseConfigurado, url } from "./supabase";

export const MODO = supabaseConfigurado ? "supabase" : "local";
export const modoSupabase = MODO === "supabase";

const CHAVE_SESSAO_LOCAL = "cvc-hortifruit.sessao";
const CHAVE_PERFIL = "cvc-hortifruit.perfil";
const DIAS_SESSAO_LOCAL = 30;

const PAPEL_PADRAO = "assistente_administrativo";

const normalizarEmail = (email) => String(email ?? "").trim().toLowerCase();

/** Formato único de conta devolvido por todas as funções daqui. */
const conta = ({ id, email, nome, telefone, papel, ativo, criadoEm, abas, podeExcluir }) => {
  const endereco = normalizarEmail(email);
  return {
    id,
    email: endereco,
    nome: nome || endereco.split("@")[0],
    telefone: telefone ?? "",
    // Conta master é sócio master por definição, não por configuração.
    papel: eMaster(endereco) ? "socio_master" : (papel ?? PAPEL_PADRAO),
    ativo: eMaster(endereco) ? true : ativo !== false,
    master: eMaster(endereco),
    criadoEm: criadoEm ?? null,
    // Ajuste fino do acesso, por pessoa (migracao-17). null = o padrão do papel.
    abas: Array.isArray(abas) ? abas : null,
    podeExcluir: typeof podeExcluir === "boolean" ? podeExcluir : null,
  };
};

/** Barra qualquer tentativa de tirar o acesso de uma conta master. */
function protegerMaster(email, patch) {
  if (!eMaster(email)) return;
  if (patch.papel !== undefined && patch.papel !== "socio_master") {
    throw new Error("Conta master é sempre sócio master — o papel não pode ser trocado.");
  }
  if (patch.ativo === false) {
    throw new Error("Conta master não pode ser desativada.");
  }
}

// ─── localStorage tolerante (modo anônimo / storage bloqueado) ──────────────

function lerJSON(chave) {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

function gravarJSON(chave, valor) {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    /* sessão só desta aba — aceitável */
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  Modo Supabase
// ════════════════════════════════════════════════════════════════════════════

/**
 * Cliente separado, sem persistir sessão, usado só para `signUp`. Sem ele, o
 * cadastro de um novo funcionário trocaria a sessão do sócio master que está
 * na tela pela do usuário recém-criado.
 */
let clienteCadastro = null;
function clienteIsolado() {
  clienteCadastro ??= createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return clienteCadastro;
}

const MENSAGENS = {
  "Invalid login credentials": "E-mail ou senha incorretos.",
  "Email not confirmed": "E-mail ainda não confirmado. Verifique a caixa de entrada.",
  "User already registered": "Já existe uma conta com este e-mail.",
  "Password should be at least 6 characters": "A senha é curta demais.",
  // Com "Confirm email" ligado, cada conta nova manda um e-mail, e o servidor
  // de e-mail gratuito do Supabase só manda uns 2 por hora.
  "Email rate limit exceeded":
    "O Supabase travou o envio de e-mails de confirmação. Desligue Authentication → Sign In / Providers → Email → Confirm email e tente de novo.",
  "Signups not allowed for this instance":
    "O cadastro está desativado no Supabase. Ative Authentication → Sign In / Providers → Allow new users to sign up.",
};

function traduzir(erro) {
  const texto = String(erro?.message ?? erro);
  for (const [chave, valor] of Object.entries(MENSAGENS)) {
    // Sem diferenciar maiúscula: o Supabase já mandou "email rate limit
    // exceeded" em minúsculas, e a mensagem saía em inglês.
    if (texto.toLowerCase().includes(chave.toLowerCase())) return new Error(valor);
  }
  if (/relation .*perfis.* does not exist|Could not find the table/i.test(texto)) {
    return new Error(
      "A tabela `perfis` não existe no Supabase. Rode supabase/auth.sql no SQL Editor."
    );
  }
  if (/Failed to fetch|NetworkError/i.test(texto)) {
    return new Error("Sem conexão com o servidor. Verifique a internet.");
  }
  return new Error(texto);
}

const perfilParaConta = (linha, email) =>
  conta({
    id: linha.id,
    email: linha.email ?? email,
    nome: linha.nome,
    telefone: linha.telefone,
    papel: linha.papel,
    ativo: linha.ativo,
    criadoEm: linha.criado_em,
    abas: linha.abas,
    podeExcluir: linha.pode_excluir,
  });

/**
 * `abas` e `pode_excluir` vêm da migracao-17. Enquanto ela não roda, o
 * Supabase recusa a consulta com essas colunas — aí a mesma consulta é refeita
 * sem elas, para ninguém ficar sem conseguir entrar por causa de um ajuste
 * opcional.
 */
const CAMPOS_PERFIL_BASE = "id, email, nome, telefone, papel, ativo, criado_em";
let CAMPOS_PERFIL = `${CAMPOS_PERFIL_BASE}, abas, pode_excluir`;

const faltaColuna = (erro) => erro?.code === "42703" || /column .*(abas|pode_excluir)/i.test(erro?.message ?? "");

/** Roda a consulta; se faltarem as colunas novas, desliga-as e tenta de novo. */
async function comCamposPerfil(consulta) {
  const resposta = await consulta();
  if (resposta.error && faltaColuna(resposta.error) && CAMPOS_PERFIL !== CAMPOS_PERFIL_BASE) {
    CAMPOS_PERFIL = CAMPOS_PERFIL_BASE;
    return consulta();
  }
  return resposta;
}

async function buscarPerfil(usuario) {
  const { data, error } = await comCamposPerfil(() => supabase
    .from("perfis")
    .select(CAMPOS_PERFIL)
    .eq("id", usuario.id)
    .maybeSingle());

  if (error) throw traduzir(error);
  if (!data) {
    throw new Error(
      "Sua conta existe, mas ainda não tem perfil liberado. Peça a um sócio master para ativá-la."
    );
  }
  return perfilParaConta(data, usuario.email);
}

// ════════════════════════════════════════════════════════════════════════════
//  Modo local
// ════════════════════════════════════════════════════════════════════════════

const localParaConta = (u) =>
  conta({
    id: u.id, email: u.email, nome: u.nome, telefone: u.telefone,
    papel: u.papel, ativo: u.ativo, criadoEm: u.criadoEm,
    abas: u.abas, podeExcluir: u.podeExcluir,
  });

function sessaoLocalValida() {
  const sessao = lerJSON(CHAVE_SESSAO_LOCAL);
  if (!sessao?.usuarioId || !sessao?.expiraEm) return null;
  if (Date.parse(sessao.expiraEm) < Date.now()) {
    gravarJSON(CHAVE_SESSAO_LOCAL, null);
    return null;
  }
  return sessao;
}

function abrirSessaoLocal(usuarioId) {
  const expiraEm = new Date(Date.now() + DIAS_SESSAO_LOCAL * 86_400_000).toISOString();
  gravarJSON(CHAVE_SESSAO_LOCAL, { usuarioId, expiraEm });
}

// ════════════════════════════════════════════════════════════════════════════
//  API pública
// ════════════════════════════════════════════════════════════════════════════

/** Modo local recém-instalado: ninguém cadastrado, precisa criar o 1º acesso. */
export async function precisaPrimeiroAcesso() {
  if (modoSupabase) return false;
  return (await contarUsuarios()) === 0;
}

export async function criarPrimeiroAdmin({ nome, email, telefone, senha }) {
  if (modoSupabase) {
    throw new Error("Com o Supabase ligado, crie o primeiro sócio master pelo painel do Supabase.");
  }
  if ((await contarUsuarios()) > 0) {
    throw new Error("Já existe usuário cadastrado neste aparelho.");
  }
  return criarContaLocal({ nome, email, telefone, senha, papel: "socio_master", ativo: true });
}

export async function entrar({ email, senha }) {
  const endereco = normalizarEmail(email);
  if (!endereco || !senha) throw new Error("Informe e-mail e senha.");

  if (modoSupabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: endereco,
      password: senha,
    });
    if (error) throw traduzir(error);

    let perfil;
    try {
      perfil = await buscarPerfil(data.user);
    } catch (err) {
      await supabase.auth.signOut();
      throw err;
    }

    if (!perfil.ativo) {
      await supabase.auth.signOut();
      throw new Error("Este acesso está desativado. Fale com um sócio master.");
    }

    gravarJSON(CHAVE_PERFIL, perfil);
    return perfil;
  }

  const usuario = await lerUsuarioPorEmail(endereco);
  const confere = usuario ? await conferirHash(senha, usuario.senhaHash) : false;
  // Mensagem única para e-mail inexistente e senha errada: não confirma quem
  // tem conta no sistema.
  if (!usuario || !confere) throw new Error("E-mail ou senha incorretos.");
  if (usuario.ativo === false) {
    throw new Error("Este acesso está desativado. Fale com um sócio master.");
  }

  abrirSessaoLocal(usuario.id);
  return localParaConta(usuario);
}

export async function sair() {
  gravarJSON(CHAVE_PERFIL, null);
  gravarJSON(CHAVE_SESSAO_LOCAL, null);
  if (modoSupabase) await supabase.auth.signOut();
}

/**
 * Conta de quem está logado, ou null. Offline, no modo Supabase, cai no perfil
 * guardado no último login — a sessão em si o próprio SDK lê do localStorage.
 */
export async function sessaoAtual() {
  if (modoSupabase) {
    const { data } = await supabase.auth.getSession();
    const usuario = data?.session?.user;
    if (!usuario) return null;

    try {
      const perfil = await buscarPerfil(usuario);
      if (!perfil.ativo) {
        await sair();
        return null;
      }
      gravarJSON(CHAVE_PERFIL, perfil);
      return perfil;
    } catch {
      const cache = lerJSON(CHAVE_PERFIL);
      return cache?.id === usuario.id ? conta(cache) : null;
    }
  }

  const sessao = sessaoLocalValida();
  if (!sessao) return null;

  const usuarios = await lerUsuarios();
  const usuario = usuarios.find((u) => u.id === sessao.usuarioId);
  if (!usuario || usuario.ativo === false) {
    gravarJSON(CHAVE_SESSAO_LOCAL, null);
    return null;
  }
  return localParaConta(usuario);
}

/** Reage a logout em outra aba e à renovação do token. */
export function observarAuth(aoMudar) {
  if (!modoSupabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((evento) => {
    if (evento === "SIGNED_OUT") aoMudar(null);
  });
  return () => data?.subscription?.unsubscribe();
}

// ─── Gestão de contas ───────────────────────────────────────────────────────

export async function listarContas() {
  if (modoSupabase) {
    const { data, error } = await comCamposPerfil(() => supabase
      .from("perfis")
      .select(CAMPOS_PERFIL)
      .order("criado_em", { ascending: true }));
    if (error) throw traduzir(error);
    return (data ?? []).map((linha) => perfilParaConta(linha));
  }

  const usuarios = await lerUsuarios();
  return usuarios
    .map(localParaConta)
    .sort((a, b) => String(a.criadoEm).localeCompare(String(b.criadoEm)));
}

async function criarContaLocal({ nome, email, telefone, senha, papel, ativo = true }) {
  const endereco = normalizarEmail(email);
  if (await lerUsuarioPorEmail(endereco)) {
    throw new Error("Já existe uma conta com este e-mail.");
  }
  const usuario = {
    id: novoId(),
    email: endereco,
    nome: nome?.trim() || endereco.split("@")[0],
    telefone: telefone?.trim() ?? "",
    papel: eMaster(endereco) ? "socio_master" : papel,
    ativo: eMaster(endereco) ? true : ativo,
    senhaHash: await gerarHash(senha),
    criadoEm: new Date().toISOString(),
  };
  await gravarUsuario(usuario);
  return localParaConta(usuario);
}

export async function criarConta({ nome, email, telefone, senha, papel = PAPEL_PADRAO }) {
  const endereco = normalizarEmail(email);
  if (!endereco.includes("@")) throw new Error("Informe um e-mail válido.");

  // Master entra sempre como sócio master, independente do que o formulário
  // mandou.
  const papelFinal = eMaster(endereco) ? "socio_master" : papel;

  if (!modoSupabase) {
    return criarContaLocal({ nome, email: endereco, telefone, senha, papel: papelFinal });
  }

  // O cliente isolado cria o usuário no Auth sem derrubar a sessão do admin.
  const { data, error } = await clienteIsolado().auth.signUp({
    email: endereco,
    password: senha,
    options: { data: { nome: nome?.trim() || endereco.split("@")[0] } },
  });
  if (error) throw traduzir(error);

  const id = data?.user?.id;
  if (!id) {
    throw new Error(
      "O Supabase não devolveu o novo usuário. Confira se o cadastro de novos usuários está liberado."
    );
  }

  // O gatilho do banco cria o perfil já desativado e como vendedor — quem
  // decide papel e liberação é este update, que só um admin consegue fazer.
  const { data: perfil, error: erroPerfil } = await comCamposPerfil(() => supabase
    .from("perfis")
    .update({
      nome: nome?.trim() || endereco.split("@")[0],
      telefone: telefone?.trim() || null,
      papel: papelFinal,
      ativo: true,
    })
    .eq("id", id)
    .select(CAMPOS_PERFIL)
    .maybeSingle());

  if (erroPerfil) throw traduzir(erroPerfil);
  if (!perfil) {
    throw new Error(
      "Usuário criado no Auth, mas o perfil não foi encontrado. Rode supabase/auth.sql e ative a conta na lista."
    );
  }
  return perfilParaConta(perfil, endereco);
}

export async function atualizarConta(id, patch) {
  const campos = {};
  if (patch.nome !== undefined) campos.nome = patch.nome.trim();
  if (patch.telefone !== undefined) campos.telefone = patch.telefone.trim() || null;
  if (patch.papel !== undefined) campos.papel = patch.papel;
  if (patch.ativo !== undefined) campos.ativo = patch.ativo;
  if (patch.abas !== undefined) campos.abas = patch.abas;
  if (patch.podeExcluir !== undefined) campos.pode_excluir = patch.podeExcluir;

  if (patch.email !== undefined) protegerMaster(patch.email, patch);

  if (modoSupabase) {
    if (campos.papel !== undefined || campos.ativo !== undefined) {
      const { data: antes } = await supabase
        .from("perfis").select("email").eq("id", id).maybeSingle();
      if (antes) protegerMaster(antes.email, patch);
    }

    const { data, error } = await supabase
      .from("perfis")
      .update(campos)
      .eq("id", id)
      .select(CAMPOS_PERFIL)
      .maybeSingle();
    if (error && faltaColuna(error)) {
      throw new Error("Falta rodar supabase/migracao-17-acesso-usuarios.sql no Supabase para ajustar abas e exclusão por usuário.");
    }
    if (error) throw traduzir(error);
    if (!data) throw new Error("Perfil não encontrado.");
    return perfilParaConta(data);
  }

  const usuarios = await lerUsuarios();
  const usuario = usuarios.find((u) => u.id === id);
  if (!usuario) throw new Error("Usuário não encontrado.");
  protegerMaster(usuario.email, patch);

  const { pode_excluir, ...resto } = campos;
  const atualizado = { ...usuario, ...resto, ...(pode_excluir !== undefined ? { podeExcluir: pode_excluir } : {}) };
  await gravarUsuario(atualizado);
  return localParaConta(atualizado);
}

/**
 * No modo Supabase apagar do Auth exige a service_role, que não pode ficar
 * no navegador — quem apaga é a função `excluir_usuario` do banco
 * (supabase/migracao-17-acesso-usuarios.sql), que confere se quem chamou é
 * sócio master. As travas de conta master e de último sócio valem lá também.
 */
export const podeExcluirConta = true;

export async function removerConta(id) {
  if (modoSupabase) {
    const { error } = await supabase.rpc("excluir_usuario", { alvo: id });
    if (error) {
      if (/excluir_usuario/.test(error.message ?? "") && /function|função/i.test(error.message ?? "")) {
        throw new Error("Falta rodar supabase/migracao-17-acesso-usuarios.sql no Supabase para excluir usuários por aqui.");
      }
      throw traduzir(error);
    }
    return;
  }
  const usuarios = await lerUsuarios();
  const usuario = usuarios.find((u) => u.id === id);
  if (usuario && eMaster(usuario.email)) {
    throw new Error("Conta master não pode ser removida.");
  }
  await apagarUsuario(id);
}

// ─── Senhas ─────────────────────────────────────────────────────────────────

export async function alterarMinhaSenha({ senhaAtual, novaSenha }) {
  if (modoSupabase) {
    const { data } = await supabase.auth.getUser();
    const email = data?.user?.email;
    if (!email) throw new Error("Sessão expirada. Entre novamente.");

    // Reautentica antes de trocar: sessão aberta em aparelho esquecido não
    // pode virar troca de senha.
    const { error: erroSenha } = await supabase.auth.signInWithPassword({
      email,
      password: senhaAtual,
    });
    if (erroSenha) throw new Error("Senha atual incorreta.");

    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) throw traduzir(error);
    return;
  }

  const sessao = sessaoLocalValida();
  if (!sessao) throw new Error("Sessão expirada. Entre novamente.");

  const usuarios = await lerUsuarios();
  const usuario = usuarios.find((u) => u.id === sessao.usuarioId);
  if (!usuario || !(await conferirHash(senhaAtual, usuario.senhaHash))) {
    throw new Error("Senha atual incorreta.");
  }
  await gravarUsuario({ ...usuario, senhaHash: await gerarHash(novaSenha) });
}

/**
 * Sócio master definindo a senha de outra pessoa. No modo Supabase quem grava
 * é a função `definir_senha_usuario` do banco
 * (supabase/migracao-24-senha-usuarios.sql), que confere se quem chamou é
 * sócio master — a service_role não pode ficar no navegador.
 */
export async function definirSenhaDe(id, novaSenha) {
  if (modoSupabase) {
    const { error } = await supabase.rpc("definir_senha_usuario", { alvo: id, nova_senha: novaSenha });
    if (error) {
      if (/definir_senha_usuario/.test(error.message ?? "") && /function|função/i.test(error.message ?? "")) {
        throw new Error("Falta rodar supabase/migracao-24-senha-usuarios.sql no Supabase para definir senhas por aqui.");
      }
      throw traduzir(error);
    }
    return;
  }
  const usuarios = await lerUsuarios();
  const usuario = usuarios.find((u) => u.id === id);
  if (!usuario) throw new Error("Usuário não encontrado.");
  await gravarUsuario({ ...usuario, senhaHash: await gerarHash(novaSenha) });
}

/** Manda o e-mail de "esqueci minha senha" (só no modo Supabase). */
export async function enviarLinkRedefinicao(email) {
  if (!modoSupabase) {
    throw new Error("Sem servidor de e-mail no modo local. Peça a um sócio master para definir uma nova senha.");
  }
  const { error } = await supabase.auth.resetPasswordForEmail(normalizarEmail(email), {
    redirectTo: `${window.location.origin}${import.meta.env.BASE_URL ?? "/"}`,
  });
  if (error) throw traduzir(error);
}

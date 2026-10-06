/**
 * Link de pedido do cliente — ver supabase/migracao-21-pedido-cliente.sql.
 *
 * O cliente não tem login nem acesso às tabelas: a página pública fala só
 * com duas funções do banco, levando o token da loja que veio no link.
 */
import { exigirSupabase } from "./supabase";

/**
 * "/pedido/<token>" (loja), "/pedido/rede/<token>" (rede) e
 * "/pedido/geral/<token>" (todas as redes e lojas) — os caminhos que a
 * página pública atende.
 */
export const PREFIXO_LINK_PEDIDO = "/pedido/";
export const PREFIXO_LINK_PEDIDO_REDE = "/pedido/rede/";
export const PREFIXO_LINK_PEDIDO_GERAL = "/pedido/geral/";

/** `{ tipo: "loja" | "rede" | "geral", token }`, ou `null` se o caminho não é de link de pedido. */
export function linkDoCaminho(caminho) {
  const c = String(caminho ?? "");
  const geral = c.match(/^\/pedido\/geral\/([A-Za-z0-9]+)\/?$/);
  if (geral) return { tipo: "geral", token: geral[1] };
  const rede = c.match(/^\/pedido\/rede\/([A-Za-z0-9]+)\/?$/);
  if (rede) return { tipo: "rede", token: rede[1] };
  const loja = c.match(/^\/pedido\/([A-Za-z0-9]+)\/?$/);
  return loja ? { tipo: "loja", token: loja[1] } : null;
}

export function linkDePedido(token) {
  if (!token) return "";
  return `${window.location.origin}${PREFIXO_LINK_PEDIDO}${token}`;
}

export function linkDePedidoRede(token) {
  if (!token) return "";
  return `${window.location.origin}${PREFIXO_LINK_PEDIDO_REDE}${token}`;
}

export function linkDePedidoGeral(token) {
  if (!token) return "";
  return `${window.location.origin}${PREFIXO_LINK_PEDIDO_GERAL}${token}`;
}

// O Postgres manda a mensagem do `raise exception`; o resto (rede caiu,
// função não existe) vira uma frase que o cliente entende.
function mensagemDeErro(error) {
  const msg = String(error?.message ?? "");
  if (/failed to fetch|network|load failed/i.test(msg)) return "Sem conexão com a internet. Tente de novo.";
  if (/could not find the function|does not exist/i.test(msg)) return "O pedido pelo link ainda não está ativo. Fale com a distribuidora.";
  return msg || "Algo deu errado. Tente de novo.";
}

export async function abrirPedido(token) {
  const { data, error } = await exigirSupabase().rpc("pedido_cliente_abrir", { token });
  if (error) throw new Error(mensagemDeErro(error));
  return data;
}

export async function enviarPedido(token, itens, observacao, nome) {
  const { data, error } = await exigirSupabase().rpc("pedido_cliente_enviar", { token, itens, observacao, nome });
  if (error) throw new Error(mensagemDeErro(error));
  return data;
}

export async function abrirPedidoRede(token) {
  const { data, error } = await exigirSupabase().rpc("pedido_rede_abrir", { token });
  if (error) throw new Error(mensagemDeErro(error));
  return data;
}

/** `pedidos`: [{ lojaId, itens, observacao }] — cada loja vira uma venda separada. `nome`: quem pediu. */
export async function enviarPedidoRede(token, pedidos, nome) {
  const { data, error } = await exigirSupabase().rpc("pedido_rede_enviar", { token, pedidos, nome });
  if (error) throw new Error(mensagemDeErro(error));
  return data ?? [];
}

/**
 * O token da loja direto da nuvem — a cópia local pode ser de antes da
 * migração 21, e só se atualiza na próxima sincronização. `null` quando a
 * loja ainda não subiu para a nuvem.
 */
export async function buscarTokenPedido(lojaId) {
  const { data, error } = await exigirSupabase()
    .from("lojas").select("token_pedido").eq("id", lojaId).maybeSingle();
  if (error) {
    if (/token_pedido/.test(error.message ?? "")) {
      throw new Error("Falta rodar a migracao-21-pedido-cliente.sql no Supabase (SQL Editor) para o link funcionar.");
    }
    throw new Error(mensagemDeErro(error));
  }
  return data?.token_pedido ?? null;
}

/** Troca o token da loja: o link antigo para de funcionar. */
export async function renovarLinkPedido(lojaId) {
  const { data, error } = await exigirSupabase().rpc("renovar_link_pedido", { loja: lojaId });
  if (error) throw new Error(mensagemDeErro(error));
  return data;
}

/** O token da rede direto da nuvem — `null` quando a rede ainda não subiu. */
export async function buscarTokenPedidoRede(redeId) {
  const { data, error } = await exigirSupabase()
    .from("redes").select("token_pedido").eq("id", redeId).maybeSingle();
  if (error) {
    if (/token_pedido/.test(error.message ?? "")) {
      throw new Error("Falta rodar a migracao-26-pedido-rede.sql no Supabase (SQL Editor) para o link da rede funcionar.");
    }
    throw new Error(mensagemDeErro(error));
  }
  return data?.token_pedido ?? null;
}

/** Troca o token da rede: o link antigo da rede para de funcionar (os das lojas seguem valendo). */
export async function renovarLinkPedidoRede(redeId) {
  const { data, error } = await exigirSupabase().rpc("renovar_link_pedido_rede", { rede: redeId });
  if (error) throw new Error(mensagemDeErro(error));
  return data;
}

export async function abrirPedidoGeral(token) {
  const { data, error } = await exigirSupabase().rpc("pedido_geral_abrir", { token });
  if (error) throw new Error(mensagemDeErro(error));
  return data;
}

/** `pedidos`: [{ lojaId, itens, observacao }], de lojas de qualquer rede. `nome`: quem pediu. */
export async function enviarPedidoGeral(token, pedidos, nome) {
  const { data, error } = await exigirSupabase().rpc("pedido_geral_enviar", { token, pedidos, nome });
  if (error) throw new Error(mensagemDeErro(error));
  return data ?? [];
}

/** O token do link geral (único, não é por rede nem por loja) direto da nuvem. `null` sem link ainda gerado. */
export async function buscarTokenPedidoGeral() {
  const { data, error } = await exigirSupabase()
    .from("pedido_geral_config").select("token_pedido").maybeSingle();
  if (error) {
    if (/pedido_geral_config/.test(error.message ?? "")) {
      throw new Error("Falta rodar a migracao-35-pedido-geral.sql no Supabase (SQL Editor) para o link geral funcionar.");
    }
    throw new Error(mensagemDeErro(error));
  }
  return data?.token_pedido ?? null;
}

/** Troca o token do link geral: o link antigo para de funcionar (os de cada rede e loja seguem valendo). */
export async function renovarLinkPedidoGeral() {
  const { data, error } = await exigirSupabase().rpc("renovar_link_pedido_geral");
  if (error) throw new Error(mensagemDeErro(error));
  return data;
}

// ─── Nome de quem pede ──────────────────────────────────────────────────────

const CHAVE_NOME = "pedido.nome";

/** O nome sai sem espaço sobrando; menos de 2 letras não vale (o banco confere igual — migracao-29). */
export const limparNome = (nome) => String(nome ?? "").trim().replace(/\s+/g, " ");
export const nomeValido = (nome) => limparNome(nome).length >= 2;

/** O aparelho lembra o último nome usado, para não digitar a cada pedido. */
export function nomeLembrado() {
  try { return localStorage.getItem(CHAVE_NOME) ?? ""; } catch { return ""; }
}

export function lembrarNome(nome) {
  try { localStorage.setItem(CHAVE_NOME, limparNome(nome)); } catch { /* sem armazenamento: só não lembra */ }
}

// ─── Contas da página pública ───────────────────────────────────────────────

export const unidadeDe = (p, qty = 2) => (p.unidadeVenda === "saco" ? (qty === 1 ? "saco" : "sacos") : "kg");

/** `{ produtoId: "10" }` → só o que tem quantidade, com o produto junto. */
export function itensEscolhidos(produtos, qtds = {}) {
  return produtos
    .map((p) => ({ p, qty: Number(qtds[p.id]) || 0 }))
    .filter((x) => x.qty > 0);
}

export const kgDosItens = (itens) => itens.reduce((s, x) => s + x.qty * Number(x.p.kgPorUnidade || 1), 0);

/** O último pedido com o produto junto — só o que ainda está à venda. */
export function itensDoUltimo(ultimo, produtos) {
  const todos = ultimo?.itens ?? [];
  const itens = todos
    .map((i) => ({ ...i, qty: Number(i.qty), p: produtos.find((p) => p.id === i.produtoId) }))
    .filter((i) => i.p && i.qty > 0);
  return { itens, faltaram: todos.length - itens.length };
}

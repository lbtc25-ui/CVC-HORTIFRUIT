/**
 * Motor de sincronização entre IndexedDB (local) e Supabase (nuvem).
 *
 * Fluxo de uma sincronização:
 *   1. ENVIA a fila local, em ordem de criação (FIFO). A ordem importa:
 *      um cliente criado offline precisa chegar antes da venda que o referencia.
 *   2. PUXA o estado completo das tabelas e substitui a cópia local.
 *
 * Como o envio acontece antes da leitura, a alteração feita no celular do
 * vendedor vence em caso de conflito (last-write-wins do lado local).
 */

import { supabase, supabaseConfigurado, url as urlSupabase } from "./supabase";
import { COLECOES, MAX_TENTATIVAS, apagarOp, contarTudo, atualizarOp, gravarMeta, gravarTodasColecoes, lerFila, lerMeta, lerTodasColecoes } from "./db";
import { doDB } from "./mappers";
import { montarResgate } from "./resgate";

const INTERVALO_AUTO_SYNC = 60_000;

let estado = {
  configurado: supabaseConfigurado,
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  sincronizando: false,
  pendentes: 0,
  falhas: 0,
  ultimaSync: null,
  erro: null,
};

const ouvintes = new Set();

export function estadoSync() {
  return estado;
}

export function observarSync(fn) {
  ouvintes.add(fn);
  fn(estado);
  return () => ouvintes.delete(fn);
}

function definirEstado(patch) {
  estado = { ...estado, ...patch };
  for (const fn of ouvintes) fn(estado);
}

export async function atualizarContadores() {
  const fila = await lerFila();
  definirEstado({
    pendentes: fila.filter((op) => op.tentativas < MAX_TENTATIVAS).length,
    falhas: fila.filter((op) => op.tentativas >= MAX_TENTATIVAS).length,
  });
  return fila;
}

// ─── Envio ──────────────────────────────────────────────────────────────────

async function executarOp(op) {
  if (op.acao === "delete") {
    const { error } = await supabase.from(op.tabela).delete().eq("id", op.payload.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from(op.tabela).upsert(op.payload, { onConflict: "id" });
  if (error) throw error;
}

/**
 * Processa a fila. Para no primeiro erro para não furar a ordem — exceto nas
 * operações que já estouraram MAX_TENTATIVAS, que ficam guardadas para
 * inspeção manual na tela de Sincronização e deixam a fila seguir.
 */
export async function enviarFila() {
  const fila = await lerFila();
  let enviadas = 0;

  for (const op of fila) {
    if (op.tentativas >= MAX_TENTATIVAS) continue; // falha permanente: não bloqueia

    try {
      await executarOp(op);
      await apagarOp(op.id);
      enviadas++;
    } catch (err) {
      const tentativas = op.tentativas + 1;
      await atualizarOp({ ...op, tentativas, erro: String(err?.message ?? err) });
      await atualizarContadores();
      // Interrompe esta rodada: a próxima operação pode depender desta.
      throw err;
    }
  }

  await atualizarContadores();
  return enviadas;
}

// ─── Leitura ────────────────────────────────────────────────────────────────

/**
 * Lê as tabelas da nuvem, uma a uma, sem gravar nada no aparelho.
 *
 * @returns {Promise<{ buscados: Record<string, object[]>, falhas: string[] }>}
 */
export async function buscarNuvem() {
  const buscados = {};
  const falhas = [];

  for (const colecao of COLECOES) {
    try {
      buscados[colecao] = (await lerTabelaInteira(colecao)).map((linha) => doDB(colecao, linha));
    } catch (err) {
      falhas.push(`${colecao}: ${err?.message ?? err}`);
    }
  }
  return { buscados, falhas };
}

/** Linhas pedidas por requisição. O Supabase pode devolver menos («Max rows»). */
const TAMANHO_PAGINA = 1000;

/**
 * Lê a tabela toda em páginas. O Supabase corta cada resposta em «Max rows»
 * linhas (1000 por padrão) sem avisar; sem paginar, uma tabela maior chegaria
 * truncada e a cópia do aparelho, que é substituída por ela, perderia o resto.
 *
 * Para quando já leu o total informado pelo servidor (`count`), não quando a
 * página vem curta — o limite do servidor pode ser menor que o pedido. Ordena
 * por `id` para a paginação não repetir nem pular linhas. Se qualquer página
 * falha, a tabela inteira falha — nunca devolve só uma parte.
 */
async function lerTabelaInteira(tabela) {
  const linhas = [];
  for (;;) {
    const { data, error, count } = await supabase
      .from(tabela)
      .select("*", { count: "exact" })
      .order("id", { ascending: true })
      .range(linhas.length, linhas.length + TAMANHO_PAGINA - 1);
    if (error) throw error;
    linhas.push(...data);
    if (data.length === 0 || linhas.length >= count) return linhas;
  }
}

/**
 * A nuvem respondeu, e respondeu tudo vazio: é banco novo (ou perdido), não
 * uma distribuidora sem nenhum cadastro. Aceitar isso como verdade apagaria
 * a cópia do aparelho — que, num banco perdido, é justamente o que sobrou.
 */
export function nuvemVazia(buscados) {
  const listas = Object.values(buscados);
  return listas.length > 0 && listas.every((lista) => lista.length === 0);
}

/**
 * De qual banco veio a cópia deste aparelho. Gravado a cada leitura que
 * substitui a cópia; quando o app passa a apontar para outro banco (o
 * antigo se perdeu e entrou um novo), o aparelho não envia a fila nem troca
 * a cópia até alguém confirmar em /resgate — depois de salvar o arquivo.
 */
const CHAVE_BANCO = "bancoDaCopia";

export async function bancoDaCopia() {
  return (await lerMeta(CHAVE_BANCO)) ?? null;
}

/** A cópia deste aparelho veio de outro banco (ou de antes deste controle)? */
export async function copiaDeOutroBanco() {
  return (await bancoDaCopia()) !== urlSupabase && (await contarTudo()) > 0;
}

/** Confirmação dada em /resgate: a partir daqui, este aparelho segue o banco atual. */
export async function adotarBancoAtual() {
  await gravarMeta(CHAVE_BANCO, urlSupabase);
}

/**
 * O banco novo já recebeu o resgate (tem vendas)? Então este aparelho segue
 * sozinho para ele — sem ninguém precisar abrir /resgate em cada aparelho.
 * Antes, a cópia antiga fica guardada aqui mesmo (meta «copiaAntiga»), e
 * /resgate continua podendo baixá-la; a fila sobe na sincronização normal.
 * Banco novo ainda vazio: segue parado, esperando o resgate.
 */
async function adotarSeRestaurado() {
  const { count, error } = await supabase.from("vendas").select("id", { count: "exact", head: true });
  if (error || !count) return false;
  if (!(await lerMeta("copiaAntiga"))) await gravarMeta("copiaAntiga", await montarResgate());
  await adotarBancoAtual();
  return true;
}

export const AVISO_OUTRO_BANCO =
  "O sistema passou a usar um banco novo. A cópia deste aparelho foi guardada e nada foi enviado: abra /resgate, salve a cópia e toque em «Usar o banco novo».";

export const AVISO_NUVEM_VAZIA =
  "o banco da nuvem está vazio — a cópia deste aparelho foi mantida. Salve-a em /resgate";

/**
 * Lê as tabelas da nuvem e devolve o estado local resultante.
 *
 * Uma coleção que falha NÃO derruba as outras e, principalmente, não é
 * sobrescrita com vazio: se a tabela ainda não existe na nuvem — o intervalo
 * entre publicar uma versão nova e rodar o SQL — ou se a leitura falhou por
 * outro motivo, o que está no aparelho continua lá. Apagar a cópia local por
 * causa de uma leitura que não aconteceu seria perder dado de verdade.
 *
 * Pelo mesmo motivo, uma nuvem inteira vazia não apaga um aparelho com dados
 * (veja `nuvemVazia`).
 *
 * @returns {Promise<{ dados: object, falhas: string[] }>}
 */
export async function puxar() {
  const { buscados, falhas } = await buscarNuvem();

  if (nuvemVazia(buscados) && (await contarTudo()) > 0) {
    return { dados: await lerTodasColecoes(), falhas: [...falhas, AVISO_NUVEM_VAZIA] };
  }

  // Grava só o que realmente veio.
  await gravarTodasColecoes(buscados);
  await gravarMeta(CHAVE_BANCO, urlSupabase);

  // O estado devolvido é o banco local depois da gravação: o que chegou da
  // nuvem, mais o que já estava aqui nas coleções que falharam.
  return { dados: await lerTodasColecoes(), falhas };
}

// ─── Sincronização completa ─────────────────────────────────────────────────

let emAndamento = null;

export async function sincronizar() {
  if (!supabaseConfigurado) {
    definirEstado({ erro: null });
    return null;
  }
  if (!estado.online) {
    definirEstado({ erro: "Sem conexão" });
    return null;
  }
  if (emAndamento) return emAndamento;

  definirEstado({ sincronizando: true, erro: null });

  emAndamento = (async () => {
    try {
      if ((await copiaDeOutroBanco()) && !(await adotarSeRestaurado())) {
        definirEstado({ erro: AVISO_OUTRO_BANCO });
        return null;
      }
      await enviarFila();
      const { dados, falhas } = await puxar();
      // Só conta como sincronizado se alguma tabela foi de fato lida — com a
      // nuvem fora do ar, todas falham e a data antiga continua valendo.
      const leuAlguma = falhas.filter((f) => f !== AVISO_NUVEM_VAZIA).length < COLECOES.length;
      const agora = leuAlguma ? new Date().toISOString() : estado.ultimaSync;
      if (leuAlguma) await gravarMeta("ultimaSync", agora);
      definirEstado({
        ultimaSync: agora,
        // O que deu certo foi gravado; o que falhou continua sendo mostrado,
        // com o nome da tabela, na tela de Sincronização.
        erro: falhas.length ? `Não foi possível ler ${falhas.join(" · ")}` : null,
      });
      return dados;
    } catch (err) {
      definirEstado({ erro: String(err?.message ?? err) });
      await atualizarContadores();
      return null;
    } finally {
      definirEstado({ sincronizando: false });
      emAndamento = null;
    }
  })();

  return emAndamento;
}

// ─── Auto-sync ──────────────────────────────────────────────────────────────

let timer = null;

export function iniciarAutoSync(aoReceberDados) {
  if (typeof window === "undefined") return () => {};

  const rodar = async () => {
    const dados = await sincronizar();
    if (dados && aoReceberDados) aoReceberDados(dados);
  };

  const ficouOnline = () => {
    definirEstado({ online: true });
    rodar();
  };
  const ficouOffline = () => definirEstado({ online: false, erro: null });
  const voltouAoFoco = () => {
    if (document.visibilityState === "visible") rodar();
  };

  window.addEventListener("online", ficouOnline);
  window.addEventListener("offline", ficouOffline);
  document.addEventListener("visibilitychange", voltouAoFoco);
  timer = setInterval(rodar, INTERVALO_AUTO_SYNC);

  lerMeta("ultimaSync").then((v) => v && definirEstado({ ultimaSync: v }));

  return () => {
    window.removeEventListener("online", ficouOnline);
    window.removeEventListener("offline", ficouOffline);
    document.removeEventListener("visibilitychange", voltouAoFoco);
    clearInterval(timer);
  };
}

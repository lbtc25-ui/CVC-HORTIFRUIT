/**
 * Resgate dos dados guardados nos aparelhos.
 *
 * Cada aparelho que usa o sistema guarda no IndexedDB uma cópia completa das
 * coleções (o que baixou na última sincronização) mais a fila do que ainda
 * não subiu. Se o banco da nuvem se perde, é dessas cópias que o sistema
 * volta:
 *
 *   1. BAIXAR — em cada aparelho, `/resgate` gera um arquivo .json com tudo o
 *      que está guardado ali. Não precisa de login nem de internet.
 *   2. JUNTAR — os arquivos de todos os aparelhos viram uma versão só: vale a
 *      cópia do aparelho que sincronizou por último e, por cima, o que estava
 *      na fila de cada um (lançado e ainda não enviado).
 *   3. ENVIAR — com o banco novo instalado e o sócio master logado, as linhas
 *      sobem por upsert: reenviar o mesmo arquivo não duplica nada.
 */

import { COLECOES, lerFila, lerMeta, lerTodasColecoes } from "./db";
import { paraDB } from "./mappers";
import { url as urlSupabase } from "./supabase";

const TIPO_ARQUIVO = "resgate-carvalho-cruz";
const TAMANHO_LOTE = 200;

/**
 * Ordem de envio: quem é apontado antes de quem aponta (a venda aponta para
 * loja, veículo e motorista; o pagamento, para o funcionário…). A ordem de
 * COLECOES é a da tela, não serve aqui — veículos depois de vendas travaria
 * todas as vendas.
 */
export const ORDEM_ENVIO = [
  "redes", "lojas", "fornecedores", "produtos", "veiculos", "funcionarios",
  "vendas", "nfe_arquivadas", "compras", "perdas", "despesas", "acertos",
  "abastecimentos", "pagamentos", "notas_entrada",
  "insumos_itens", "contagens_insumos", "precos_produtos", "metas", "sinalizacoes_clientes",
];

// ─── 1. Baixar ──────────────────────────────────────────────────────────────

/** Tudo o que este aparelho guarda, pronto para virar arquivo. */
export async function montarResgate() {
  const [colecoes, fila, ultimaSync] = await Promise.all([
    lerTodasColecoes(),
    lerFila(),
    lerMeta("ultimaSync"),
  ]);
  return {
    tipo: TIPO_ARQUIVO,
    versao: 1,
    geradoEm: new Date().toISOString(),
    ultimaSync: ultimaSync ?? null,
    bancoOrigem: urlSupabase ?? null,
    aparelho: typeof navigator === "undefined" ? "" : navigator.userAgent,
    colecoes,
    fila,
  };
}

export function contarResgate(resgate) {
  const porColecao = Object.fromEntries(
    COLECOES.map((c) => [c, (resgate.colecoes?.[c] ?? []).length])
  );
  const total = Object.values(porColecao).reduce((s, n) => s + n, 0);
  return { porColecao, total, fila: (resgate.fila ?? []).length };
}

export function baixarResgate(resgate) {
  const carimbo = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const blob = new Blob([JSON.stringify(resgate)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `resgate-distribuidora-${carimbo}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
}

// ─── 2. Juntar ──────────────────────────────────────────────────────────────

export async function lerArquivoResgate(arquivo) {
  let conteudo;
  try {
    conteudo = JSON.parse(await arquivo.text());
  } catch {
    throw new Error(`${arquivo.name}: não é um arquivo de resgate válido.`);
  }
  if (conteudo?.tipo !== TIPO_ARQUIVO || !conteudo.colecoes) {
    throw new Error(`${arquivo.name}: não é um arquivo de resgate da distribuidora.`);
  }
  return { ...conteudo, nomeArquivo: arquivo.name };
}

/**
 * Até quando vão os dados de uma cópia: o registro criado mais recentemente.
 *
 * Não dá para usar a "última sincronização": ela é regravada a cada rodada,
 * mesmo quando a nuvem já não responde — um aparelho aberto depois de o
 * banco cair diria "sincronizado agora" com dados de horas antes.
 */
export function dadosAte(resgate) {
  let maior = 0;
  for (const lista of Object.values(resgate.colecoes ?? {})) {
    for (const item of lista ?? []) {
      const t = Date.parse(item?.criadoEm ?? "");
      if (t > maior) maior = t;
    }
  }
  return maior ? new Date(maior).toISOString() : null;
}

/**
 * Junta os resgates numa versão só, já no formato do banco (snake_case).
 *
 * A base é a cópia mais recente (`dadosAte`): ela reflete a nuvem mais perto
 * de quando o banco se perdeu. Das cópias mais antigas entra só o que foi
 * criado DEPOIS da base — um registro mais antigo que ela e que não está nela
 * foi apagado nesse meio-tempo, e não deve voltar. Por cima de tudo entram as
 * filas de todos, em ordem de criação: lançamentos que nunca chegaram à nuvem.
 *
 * @returns {{ linhas: Record<string, object[]>, ignoradas: number }}
 */
export function juntarResgates(resgates) {
  // Empate no registro mais novo (dois aparelhos com os mesmos cadastros)
  // não quer dizer cópias iguais: uma alteração — escalar um pedido na rota,
  // marcar entregue — não cria registro. Desempata a sincronização mais
  // recente, que viu mais dessas alterações.
  const ordenados = [...resgates].sort(
    (a, b) =>
      String(dadosAte(a) ?? "").localeCompare(String(dadosAte(b) ?? "")) ||
      String(a.ultimaSync ?? "").localeCompare(String(b.ultimaSync ?? ""))
  );
  const base = ordenados[ordenados.length - 1];
  const limiteBase = Date.parse(dadosAte(base) ?? "") || 0;

  const mapas = Object.fromEntries(COLECOES.map((c) => [c, new Map()]));

  const paraLinha = (colecao, item) => {
    const linha = paraDB(colecao, item);
    // O link de pedido do cliente não sobe na sincronização normal (o banco
    // gera), mas no resgate precisa voltar igual: é o endereço que as lojas
    // já têm salvo.
    if ((colecao === "redes" || colecao === "lojas") && item.tokenPedido) {
      linha.token_pedido = item.tokenPedido;
    }
    return linha;
  };

  for (const colecao of COLECOES) {
    for (const item of base?.colecoes[colecao] ?? []) {
      if (item?.id) mapas[colecao].set(item.id, paraLinha(colecao, item));
    }
  }

  for (const resgate of ordenados.slice(0, -1)) {
    for (const colecao of COLECOES) {
      for (const item of resgate.colecoes[colecao] ?? []) {
        if (!item?.id || mapas[colecao].has(item.id)) continue;
        if ((Date.parse(item.criadoEm ?? "") || 0) > limiteBase) {
          mapas[colecao].set(item.id, paraLinha(colecao, item));
        }
      }
    }
  }

  const filas = ordenados
    .flatMap((r) => r.fila ?? [])
    .sort((a, b) => String(a.criadoEm ?? "").localeCompare(String(b.criadoEm ?? "")));

  let ignoradas = 0;
  for (const op of filas) {
    const mapa = mapas[op.tabela];
    const id = op.payload?.id;
    if (!mapa || !id) {
      ignoradas++;
      continue;
    }
    if (op.acao === "delete") mapa.delete(id);
    else mapa.set(id, { ...(mapa.get(id) ?? {}), ...op.payload });
  }

  // As contas de acesso do banco perdido não existem no novo: o vínculo da
  // pessoa da folha com a conta é refeito depois, na aba Usuários.
  for (const linha of mapas.funcionarios.values()) linha.usuario_id = null;

  const linhas = Object.fromEntries(COLECOES.map((c) => [c, [...mapas[c].values()]]));
  // Venda consolidada aponta para a venda que a reuniu: as que não apontam
  // para ninguém sobem primeiro, para a referência já existir no lote seguinte.
  linhas.vendas.sort((a, b) => Number(Boolean(a.consolidada_em)) - Number(Boolean(b.consolidada_em)));
  return { linhas, ignoradas };
}

// ─── 3. Enviar ──────────────────────────────────────────────────────────────

/**
 * Sobe as linhas por upsert, tabela a tabela, na ORDEM_ENVIO. Uma tabela que falha não impede
 * as outras; o erro volta no resultado para aparecer na tela.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} cliente
 * @param {Record<string, object[]>} linhas
 * @param {(p: { colecao: string, enviadas: number, total: number }) => void} [aoProgredir]
 */
export async function enviarResgate(cliente, linhas, aoProgredir) {
  const resultado = [];
  for (const colecao of ORDEM_ENVIO) {
    const todas = linhas[colecao] ?? [];
    let enviadas = 0;
    let erro = null;
    for (let i = 0; i < todas.length; i += TAMANHO_LOTE) {
      const lote = todas.slice(i, i + TAMANHO_LOTE);
      // defaultToNull: false — num lote, a coluna que falta numa linha e
      // existe em outra fica com o padrão do banco, não com null (o
      // token_pedido é obrigatório, e o banco gera quando não vem).
      const { error } = await cliente
        .from(colecao)
        .upsert(lote, { onConflict: "id", defaultToNull: false });
      if (error) {
        erro = error.message ?? String(error);
        break;
      }
      enviadas += lote.length;
      aoProgredir?.({ colecao, enviadas, total: todas.length });
    }
    resultado.push({ colecao, total: todas.length, enviadas, erro });
  }
  return resultado;
}

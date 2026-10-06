/**
 * Camada IndexedDB — banco local que permite o app funcionar sem internet.
 *
 * Stores:
 *   redes / lojas / fornecedores / produtos / vendas / compras / perdas /
 *   despesas / acertos / notas_entrada …        → cópia local dos dados
 *   fila                                         → operações pendentes de envio
 *   meta                                         → chaves de controle (última sync, etc.)
 *   usuarios                                     → contas de acesso do modo local
 *
 * Implementação em IndexedDB puro, sem dependências extras.
 */

const DB_NOME = "cvc-hortifruit";
// v2: «usuarios» — contas de acesso do modo local (login sem Supabase).
// v3: «clientes» virou «redes» + «lojas», acompanhando a planilha de gestão.
// v4: entra «compras» — a mercadoria que entra, de onde sai o custo por quilo.
// v5: entra «perdas» — e o estoque vira conta: compras − vendas − perdas.
// v6: entra «despesas» — e o painel passa a mostrar resultado, não faturamento.
// v7: entra «acertos» — a contagem física que reconcilia o estoque calculado.
// v8: entram «veiculos» e «abastecimentos» — o controle de combustível da
//     aba DESPESAS, com quilometragem e consumo por veículo.
// v9: entram «funcionarios» e «pagamentos» — a folha de diaristas e
//     funcionários por nome, das abas DIARISTAS e FUNCIONARIOS FIXOS.
// v10: entra «notas_entrada» — NF-e recebidas às quais se deu entrada e as
//      notas de devolução emitidas pela distribuidora.
// v11: entram «insumos_itens» e «contagens_insumos» — o controle de estoque
//      de redinha, grampo e etiquetas da produção dos sanquinhos, por
//      contagem física semanal (sem compra/venda para virar conta).
// v12: entra «precos_frutas» — a conferência semanal do preço de cada fruta
//      (confirmar ou ajustar), feita toda segunda-feira.
// v13: «precos_frutas» vira «precos_produtos» — a conferência passa a ser
//      por produto (agranel e cada saco), não só por fruta.
// v14: entra «metas» — as metas diária, semanal, mensal e anual do sócio
//      master (faturamento, quilos e sacos, no geral e por fruta).
// v15: entra «nfe_arquivadas» — a NF-e cancelada de um pedido apagado, que
//      continua na aba Notas Fiscais (SPED Fiscal e XML para o contador).
// v16: entra «sinalizacoes_clientes» — "me lembre", "ciente" e "parou de
//      pedir" marcados nos alertas da aba Previsão de Pedidos.
const DB_VERSAO = 16;

export const COLECOES = [
  "redes", "lojas", "fornecedores", "produtos",
  // Antes de «vendas»: ao apagar um pedido com NF-e cancelada, a cópia da
  // nota entra na fila antes da exclusão do pedido.
  "nfe_arquivadas",
  "vendas", "compras", "perdas", "despesas", "acertos",
  "veiculos", "abastecimentos", "funcionarios", "pagamentos",
  "notas_entrada", "insumos_itens", "contagens_insumos", "precos_produtos",
  "metas", "sinalizacoes_clientes",
];

// Stores de versões anteriores que não existem mais. São removidas no upgrade
// para o banco local não guardar dados órfãos indefinidamente.
const STORES_OBSOLETAS = ["clientes", "precos_frutas"];
const STORES = [...COLECOES, "fila", "meta", "usuarios"];

/**
 * O banco local é apagado inteiro em "recarregar da nuvem" — menos as contas
 * de acesso, que não vêm do Supabase no modo local e deixariam o app trancado.
 */
const STORES_PRESERVADAS = ["usuarios"];

let promessaDB = null;

export function abrirDB() {
  if (promessaDB) return promessaDB;

  promessaDB = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponível neste navegador"));
      return;
    }

    const req = indexedDB.open(DB_NOME, DB_VERSAO);

    req.onupgradeneeded = () => {
      const db = req.result;
      for (const nome of COLECOES) {
        if (!db.objectStoreNames.contains(nome)) {
          db.createObjectStore(nome, { keyPath: "id" });
        }
      }
      if (!db.objectStoreNames.contains("fila")) {
        // autoIncrement garante o processamento em ordem cronológica (FIFO)
        db.createObjectStore("fila", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta");
      }
      if (!db.objectStoreNames.contains("usuarios")) {
        const usuarios = db.createObjectStore("usuarios", { keyPath: "id" });
        usuarios.createIndex("email", "email", { unique: true });
      }
      for (const nome of STORES_OBSOLETAS) {
        if (db.objectStoreNames.contains(nome)) db.deleteObjectStore(nome);
      }
    };

    req.onsuccess = () => {
      // Outra aba pediu uma versão mais nova: fecha esta conexão para não
      // travar a atualização dela.
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);

    // Acontece quando o app está aberto em outra aba numa versão anterior do
    // banco: sem isto, a promessa nunca resolve e a tela fica em "carregando".
    req.onblocked = () =>
      reject(
        new Error(
          "O app está aberto em outra aba com uma versão antiga. Feche as demais abas e recarregue."
        )
      );
  });

  return promessaDB;
}

function transacao(db, stores, modo) {
  const tx = db.transaction(stores, modo);
  const concluida = new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return { tx, concluida };
}

function pedido(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Coleções ───────────────────────────────────────────────────────────────

export async function lerColecao(store) {
  const db = await abrirDB();
  const { tx } = transacao(db, [store], "readonly");
  return pedido(tx.objectStore(store).getAll());
}

export async function lerTodasColecoes() {
  const entradas = await Promise.all(
    COLECOES.map(async (nome) => [nome, await lerColecao(nome)])
  );
  return Object.fromEntries(entradas);
}

/** Substitui todo o conteúdo de uma store (usado depois de puxar da nuvem). */
export async function gravarColecao(store, itens) {
  const db = await abrirDB();
  const { tx, concluida } = transacao(db, [store], "readwrite");
  const os = tx.objectStore(store);
  os.clear();
  for (const item of itens) os.put(item);
  await concluida;
}

export async function gravarTodasColecoes(dados) {
  for (const nome of COLECOES) {
    if (Array.isArray(dados[nome])) await gravarColecao(nome, dados[nome]);
  }
}

export async function contarTudo() {
  const db = await abrirDB();
  const { tx } = transacao(db, COLECOES, "readonly");
  const totais = await Promise.all(
    COLECOES.map((nome) => pedido(tx.objectStore(nome).count()))
  );
  return totais.reduce((soma, n) => soma + n, 0);
}

// ─── Fila de sincronização ──────────────────────────────────────────────────

export const MAX_TENTATIVAS = 5;

/**
 * @param {{ tabela: string, acao: "upsert"|"delete", payload: object }} op
 */
export async function enfileirar(op) {
  const db = await abrirDB();
  const { tx, concluida } = transacao(db, ["fila"], "readwrite");
  tx.objectStore("fila").add({
    ...op,
    tentativas: 0,
    erro: null,
    criadoEm: new Date().toISOString(),
  });
  await concluida;
}

export async function enfileirarVarias(ops) {
  if (!ops.length) return;
  const db = await abrirDB();
  const { tx, concluida } = transacao(db, ["fila"], "readwrite");
  const os = tx.objectStore("fila");
  const agora = new Date().toISOString();
  for (const op of ops) {
    os.add({ ...op, tentativas: 0, erro: null, criadoEm: agora });
  }
  await concluida;
}

/** Fila completa, em ordem de criação. */
export async function lerFila() {
  const db = await abrirDB();
  const { tx } = transacao(db, ["fila"], "readonly");
  const itens = await pedido(tx.objectStore("fila").getAll());
  return itens.sort((a, b) => a.id - b.id);
}

export async function atualizarOp(op) {
  const db = await abrirDB();
  const { tx, concluida } = transacao(db, ["fila"], "readwrite");
  tx.objectStore("fila").put(op);
  await concluida;
}

export async function apagarOp(id) {
  const db = await abrirDB();
  const { tx, concluida } = transacao(db, ["fila"], "readwrite");
  tx.objectStore("fila").delete(id);
  await concluida;
}

/** Zera o contador de tentativas das operações que falharam definitivamente. */
export async function reativarFalhas() {
  const fila = await lerFila();
  const falhas = fila.filter((op) => op.tentativas >= MAX_TENTATIVAS);
  for (const op of falhas) {
    await atualizarOp({ ...op, tentativas: 0, erro: null });
  }
  return falhas.length;
}

// ─── Meta ───────────────────────────────────────────────────────────────────

export async function lerMeta(chave) {
  const db = await abrirDB();
  const { tx } = transacao(db, ["meta"], "readonly");
  return pedido(tx.objectStore("meta").get(chave));
}

export async function gravarMeta(chave, valor) {
  const db = await abrirDB();
  const { tx, concluida } = transacao(db, ["meta"], "readwrite");
  tx.objectStore("meta").put(valor, chave);
  await concluida;
}

// ─── Usuários (modo local) ──────────────────────────────────────────────────

export async function lerUsuarios() {
  const db = await abrirDB();
  const { tx } = transacao(db, ["usuarios"], "readonly");
  return pedido(tx.objectStore("usuarios").getAll());
}

export async function lerUsuarioPorEmail(email) {
  const db = await abrirDB();
  const { tx } = transacao(db, ["usuarios"], "readonly");
  return pedido(tx.objectStore("usuarios").index("email").get(String(email).toLowerCase()));
}

export async function gravarUsuario(usuario) {
  const db = await abrirDB();
  const { tx, concluida } = transacao(db, ["usuarios"], "readwrite");
  tx.objectStore("usuarios").put(usuario);
  await concluida;
  return usuario;
}

export async function apagarUsuario(id) {
  const db = await abrirDB();
  const { tx, concluida } = transacao(db, ["usuarios"], "readwrite");
  tx.objectStore("usuarios").delete(id);
  await concluida;
}

export async function contarUsuarios() {
  const db = await abrirDB();
  const { tx } = transacao(db, ["usuarios"], "readonly");
  return pedido(tx.objectStore("usuarios").count());
}

/**
 * Apaga os dados locais (usado em "recarregar da nuvem"). As contas de acesso
 * do modo local ficam de fora — elas não existem na nuvem.
 */
export async function limparLocal() {
  const db = await abrirDB();
  const alvos = STORES.filter((nome) => !STORES_PRESERVADAS.includes(nome));
  const { tx, concluida } = transacao(db, alvos, "readwrite");
  for (const nome of alvos) tx.objectStore(nome).clear();
  await concluida;
}

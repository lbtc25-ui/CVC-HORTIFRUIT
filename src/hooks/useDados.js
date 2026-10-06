import { useCallback, useEffect, useRef, useState } from "react";
import {
  COLECOES,
  contarTudo,
  enfileirarVarias,
  gravarColecao,
  gravarTodasColecoes,
  lerTodasColecoes,
  limparLocal,
} from "../lib/db";
import { paraDB } from "../lib/mappers";
import { supabaseConfigurado } from "../lib/supabase";
import { dadosIniciais, dadosVazios } from "../lib/seed";
import { atualizarContadores, buscarNuvem, iniciarAutoSync, nuvemVazia, puxar, sincronizar } from "../lib/sync";

/**
 * Compara duas versões de uma coleção e devolve as operações que precisam
 * subir para a nuvem. É isso que permite que os módulos de tela continuem
 * chamando `setDados(d => ...)` sem saber que existe sincronização.
 */
function diferenciar(colecao, antes, depois) {
  const ops = [];
  const mapaAntes = new Map(antes.map((i) => [i.id, i]));
  const mapaDepois = new Map(depois.map((i) => [i.id, i]));

  for (const [id, item] of mapaDepois) {
    const anterior = mapaAntes.get(id);
    if (!anterior || JSON.stringify(anterior) !== JSON.stringify(item)) {
      ops.push({ tabela: colecao, acao: "upsert", payload: paraDB(colecao, item) });
    }
  }
  for (const id of mapaAntes.keys()) {
    if (!mapaDepois.has(id)) {
      ops.push({ tabela: colecao, acao: "delete", payload: { id } });
    }
  }
  return ops;
}

const LIMITE_DESFAZER = 30;

const ROTULOS = {
  vendas: "venda", clientes: "cliente", compras: "compra", despesas: "despesa",
  abastecimentos: "abastecimento", pagamentos: "pagamento", funcionarios: "pessoa",
  produtos: "produto", lojas: "loja", redes: "rede", perdas: "perda",
};

/**
 * Registro de uma alteração que apagou algo, no formato "por id":
 * { colecao, antes, depois } — `antes`/`depois` indefinidos = não existia.
 * Só entram aqui as colunas que mudaram, para que desfazer não atropele o
 * que outra pessoa alterou em outros registros enquanto isso.
 */
function registrarApagado(antes, depois) {
  const mudancas = [];
  let apagados = 0;
  let rotulo = "registro";
  for (const colecao of COLECOES) {
    const a = antes[colecao] ?? [];
    const d = depois[colecao] ?? [];
    if (a === d) continue;
    const mapaA = new Map(a.map((i) => [i.id, i]));
    const mapaD = new Map(d.map((i) => [i.id, i]));
    for (const [id, item] of mapaA) {
      if (!mapaD.has(id)) {
        apagados += 1;
        rotulo = ROTULOS[colecao] ?? "registro";
        mudancas.push({ colecao, id, antes: item, depois: undefined });
      } else if (JSON.stringify(item) !== JSON.stringify(mapaD.get(id))) {
        mudancas.push({ colecao, id, antes: item, depois: mapaD.get(id) });
      }
    }
    for (const [id, item] of mapaD) {
      if (!mapaA.has(id)) mudancas.push({ colecao, id, antes: undefined, depois: item });
    }
  }
  if (!apagados) return null;
  return { mudancas, rotulo: apagados > 1 ? "registros" : rotulo, apagados };
}

/** Aplica o registro nos dados atuais: `desfazer` volta ao `antes`, senão ao `depois`. */
function aplicarRegistro(dados, registro, desfazer) {
  const novo = { ...dados };
  for (const m of registro.mudancas) {
    const alvo = desfazer ? m.antes : m.depois;
    const lista = (novo[m.colecao] ?? []).filter((i) => i.id !== m.id);
    novo[m.colecao] = alvo ? [...lista, alvo] : lista;
  }
  return novo;
}

/**
 * Fonte única dos dados do app.
 *
 * - Lê do IndexedDB na abertura (funciona sem internet, inclusive offline total)
 * - Persiste toda alteração localmente e enfileira o envio para o Supabase
 * - Sincroniza em background quando há conexão
 *
 * `ativo: false` desliga tudo isto (usado pelo papel promotor, que não tem
 * acesso — nem por RLS — a nenhuma destas coleções). Sem isto, a sincronização
 * puxaria da nuvem uma resposta vazia para cada tabela por causa do RLS e
 * sobrescreveria, num aparelho compartilhado, o que o sócio master ou o
 * assistente deixaram em cache localmente.
 */
export function useDados({ ativo = true } = {}) {
  const [dados, setDadosState] = useState(dadosVazios);
  const [pronto, setPronto] = useState(!ativo);
  const [erroCarga, setErroCarga] = useState(null);

  // Última versão já gravada no IndexedDB — base de comparação do diff.
  const persistido = useRef(null);
  // Marca que o próximo estado veio da nuvem e não deve ser re-enfileirado.
  const vindoDaNuvem = useRef(false);
  // Pilhas de desfazer/refazer (só alterações que apagaram algo) e a marca
  // de que o próximo estado veio delas, para não se registrarem de novo.
  const pilhaDesfazer = useRef([]);
  const pilhaRefazer = useRef([]);
  const vindoDoDesfazer = useRef(false);
  const [ultimoApagado, setUltimoApagado] = useState(null);

  const aplicarDaNuvem = useCallback((novos) => {
    if (!novos) return;
    vindoDaNuvem.current = true;
    setDadosState(novos);
  }, []);

  // ─── Carga inicial ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ativo) return undefined;
    let cancelado = false;

    (async () => {
      try {
        let locais = await lerTodasColecoes();
        const vazio = COLECOES.every((c) => (locais[c] ?? []).length === 0);

        // Sem backend e sem nada local: carrega a demonstração.
        if (vazio && !supabaseConfigurado) {
          await gravarTodasColecoes(dadosIniciais);
          locais = dadosIniciais;
        }

        if (cancelado) return;
        vindoDaNuvem.current = true;
        setDadosState(locais);
        setPronto(true);
        await atualizarContadores();

        // Já tendo a tela utilizável, busca a versão da nuvem.
        if (supabaseConfigurado) {
          const remotos = await sincronizar();
          if (!cancelado && remotos) aplicarDaNuvem(remotos);
        }
      } catch (err) {
        if (!cancelado) {
          setErroCarga(String(err?.message ?? err));
          setPronto(true);
        }
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [ativo, aplicarDaNuvem]);

  // ─── Auto-sync em background ──────────────────────────────────────────────
  useEffect(() => {
    if (!ativo || !pronto) return undefined;
    return iniciarAutoSync(aplicarDaNuvem);
  }, [ativo, pronto, aplicarDaNuvem]);

  // ─── Persistência local + fila ────────────────────────────────────────────
  useEffect(() => {
    if (!ativo || !pronto) return;

    const anterior = persistido.current;
    if (anterior === dados) return;
    persistido.current = dados;

    // Primeira carga ou dados recém-puxados: IndexedDB já está em dia.
    if (anterior === null || vindoDaNuvem.current) {
      vindoDaNuvem.current = false;
      return;
    }

    if (vindoDoDesfazer.current) {
      vindoDoDesfazer.current = false;
    } else {
      const registro = registrarApagado(anterior, dados);
      if (registro) {
        pilhaDesfazer.current = [...pilhaDesfazer.current, registro].slice(-LIMITE_DESFAZER);
        pilhaRefazer.current = [];
        setUltimoApagado({ ...registro, chave: Date.now() });
      }
    }

    (async () => {
      const ops = [];
      for (const colecao of COLECOES) {
        const antes = anterior[colecao] ?? [];
        const depois = dados[colecao] ?? [];
        if (antes === depois) continue;
        await gravarColecao(colecao, depois);
        ops.push(...diferenciar(colecao, antes, depois));
      }

      if (ops.length && supabaseConfigurado) {
        await enfileirarVarias(ops);
        await atualizarContadores();
        sincronizar().then((remotos) => remotos && aplicarDaNuvem(remotos));
      }
    })();
  }, [ativo, dados, pronto, aplicarDaNuvem]);

  // Mesma assinatura do useState original, para os módulos não mudarem.
  const setDados = useCallback((atualizador) => {
    setDadosState((prev) =>
      typeof atualizador === "function" ? atualizador(prev) : atualizador
    );
  }, []);

  const desfazer = useCallback(() => {
    const registro = pilhaDesfazer.current.at(-1);
    if (!registro) return null;
    pilhaDesfazer.current = pilhaDesfazer.current.slice(0, -1);
    pilhaRefazer.current = [...pilhaRefazer.current, registro];
    vindoDoDesfazer.current = true;
    setDadosState((prev) => aplicarRegistro(prev, registro, true));
    setUltimoApagado(null);
    return registro;
  }, []);

  const refazer = useCallback(() => {
    const registro = pilhaRefazer.current.at(-1);
    if (!registro) return null;
    pilhaRefazer.current = pilhaRefazer.current.slice(0, -1);
    pilhaDesfazer.current = [...pilhaDesfazer.current, registro];
    vindoDoDesfazer.current = true;
    setDadosState((prev) => aplicarRegistro(prev, registro, false));
    setUltimoApagado(null);
    return registro;
  }, []);

  const sincronizarAgora = useCallback(async () => {
    const remotos = await sincronizar();
    if (remotos) aplicarDaNuvem(remotos);
    return remotos;
  }, [aplicarDaNuvem]);

  /**
   * Descarta a cópia local e baixa tudo de novo da nuvem.
   *
   * Uma coleção que a nuvem não devolver fica vazia aqui — e é o esperado:
   * o local acabou de ser apagado de propósito, não há o que preservar.
   *
   * A nuvem é lida ANTES de apagar: se ela vier inteira vazia (banco novo ou
   * perdido), nada é apagado — a cópia deste aparelho pode ser a única.
   */
  const recarregarDaNuvem = useCallback(async () => {
    if (!supabaseConfigurado) return null;
    const { buscados } = await buscarNuvem();
    if (nuvemVazia(buscados)) {
      throw new Error("O banco da nuvem está vazio. Nada foi apagado deste aparelho — salve a cópia em /resgate.");
    }
    await limparLocal();
    const { dados: remotos } = await puxar();
    aplicarDaNuvem(remotos);
    await atualizarContadores();
    return remotos;
  }, [aplicarDaNuvem]);

  const totalLocal = useCallback(() => contarTudo(), []);

  return { dados, setDados, pronto, erroCarga, desfazer, refazer, ultimoApagado, sincronizarAgora, recarregarDaNuvem, totalLocal };
}

export default useDados;

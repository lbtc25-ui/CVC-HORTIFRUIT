/**
 * Emissão de NF-e via Omie.
 *
 * O fluxo completo (confirmado testando a API de verdade, com pedidos já
 * faturados da própria conta — não é suposição de documentação):
 *
 *   1. IncluirPedido (produtos/pedido) — cria o pedido com cliente e itens.
 *   2. FaturarPedidoVenda (produtos/pedidovendafat) — fatura o pedido; é
 *      isso que emite a NF-e. Não existe um "emitir NF-e" isolado do
 *      pedido.
 *   3. ListarNF (produtos/nfconsultar) — filtrando por data de emissão e
 *      `nIdCliente`, devolve a lista de notas daquele cliente naquele dia;
 *      cada nota traz `compl.nIdPedido`, que é o elo que faltava para
 *      saber QUAL nota corresponde a QUAL pedido. Dali saem `cChaveNFe`
 *      (chave de acesso) e `nIdNF` (o código interno que os métodos de
 *      link abaixo pedem).
 *   4. GetUrlDanfe (produtos/notafiscalutil) com `nCodNF = nIdNF` — devolve
 *      o link do PDF do DANFe.
 *
 * `buscarClienteOmiePorCnpj` usa `ListarClientes`, que é o método mais
 * usado em integrações Omie (cadastro mais antigo/estável da API deles) —
 * mas essa chamada específica não foi testada ao vivo nesta integração,
 * diferente das outras deste arquivo. Se der erro, o Omie devolve
 * `{ code, description }` explicando o quê — não é um erro silencioso.
 */

const ENDPOINT = "/api/omie";

// Configuração do emitente — não é segredo (não é credencial), por isso pode
// vir de variável VITE_ mesmo. Só o app_key/app_secret ficam no servidor
// (veja api/omie.js).
const EMITENTE_UF = import.meta.env.VITE_EMITENTE_UF || "SE";
const CODIGO_CATEGORIA = import.meta.env.VITE_OMIE_CODIGO_CATEGORIA || "";
const CODIGO_CONTA_CORRENTE = import.meta.env.VITE_OMIE_CODIGO_CONTA_CORRENTE || "";

/** "2026-09-16" → "16/09/2026" (Omie só aceita data nesse formato). */
function dataBR(iso) {
  const [ano, mes, dia] = String(iso || "").split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : "";
}

async function chamarOmie(modulo, recurso, call, param) {
  const resposta = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modulo, recurso, call, param: [param] }),
  });
  const dados = await resposta.json().catch(() => null);

  // omie_fail: { code, description, referer, fatal } — erro autodescritivo,
  // documentado pela própria Omie, não uma suposição nossa.
  if (dados && typeof dados.code !== "undefined" && dados.description) {
    throw new Error(`Omie (${call}): ${dados.description}`);
  }
  if (!resposta.ok) {
    throw new Error(dados?.erro || `Omie recusou a chamada ${call} (HTTP ${resposta.status})`);
  }
  return dados;
}

/**
 * Busca o codigo_cliente do Omie a partir do CNPJ/CPF da loja.
 * Retorna null se não encontrar (cliente ainda não cadastrado lá).
 */
export async function buscarClienteOmiePorCnpj(cnpjCpf) {
  const digitos = String(cnpjCpf || "").replace(/\D/g, "");
  if (!digitos) return null;

  const resposta = await chamarOmie("geral", "clientes", "ListarClientes", {
    pagina: 1,
    registros_por_pagina: 5,
    apenas_importado_api: "N",
    clientesFiltro: { cnpj_cpf: digitos },
  });

  const lista = resposta?.clientes_cadastro ?? [];
  const achado = lista.find((c) => String(c.cnpj_cpf || "").replace(/\D/g, "") === digitos);
  return achado?.codigo_cliente_omie ?? null;
}

/**
 * Monta o param de IncluirPedido a partir de uma venda do app.
 *
 * Lança erro com mensagem clara (não deixa a Omie rejeitar com um código
 * genérico) quando falta cadastro: loja sem CNPJ resolvido no Omie, ou
 * produto sem NCM/código Omie — a nota não sai sem isso de qualquer jeito,
 * então é melhor travar aqui com uma mensagem que diz o que corrigir.
 */
export function montarPedidoOmie({ venda, loja, produtosPorId }) {
  if (!loja?.omieCodigoCliente) {
    throw new Error(
      `A loja "${loja?.nome}" ainda não tem o código de cliente do Omie resolvido. ` +
      `Cadastre o CNPJ dela e rode a busca por CNPJ antes de emitir.`
    );
  }

  const itensFaturaveis = (venda.itens ?? []).filter((i) => i.natureza !== "bonificacao");
  if (!itensFaturaveis.length) {
    throw new Error("Essa venda só tem itens de bonificação — não há o que faturar.");
  }

  const det = itensFaturaveis.map((item) => {
    const produto = produtosPorId[item.produtoId];
    if (!produto) throw new Error(`Produto ${item.produtoId} não encontrado.`);
    if (!produto.omieCodigoProduto) {
      throw new Error(`O produto "${produto.nome}" ainda não tem o código do Omie cadastrado.`);
    }
    if (!produto.ncm) {
      throw new Error(`O produto "${produto.nome}" ainda não tem NCM cadastrado.`);
    }

    const cfop = produto.cfopPadrao || (loja.uf === EMITENTE_UF ? "5.102" : "6.102");

    return {
      ide: { codigo_item_integracao: item.produtoId },
      produto: {
        cfop,
        codigo_produto: produto.omieCodigoProduto,
        descricao: produto.nome,
        ncm: produto.ncm,
        quantidade: item.qty,
        tipo_desconto: "V",
        unidade: item.unidade === "un" ? "UN" : produto.unidadeOmie || "UN",
        valor_desconto: 0,
        valor_unitario: item.precoUnitario,
      },
    };
  });

  return {
    cabecalho: {
      codigo_cliente: loja.omieCodigoCliente,
      codigo_pedido_integracao: venda.id,
      data_previsao: dataBR(venda.data),
      etapa: "10",
      numero_pedido: venda.numero ? String(venda.numero) : undefined,
      codigo_parcela: "999",
      quantidade_itens: det.length,
    },
    det,
    frete: { modalidade: "9" }, // 9 = sem frete / não aplicável
    informacoes_adicionais: {
      codigo_categoria: CODIGO_CATEGORIA || undefined,
      codigo_conta_corrente: CODIGO_CONTA_CORRENTE || undefined,
      consumidor_final: "N",
      enviar_email: "N",
    },
    lista_parcelas: {
      parcela: [{
        data_vencimento: dataBR(venda.vencimento || venda.data),
        numero_parcela: 1,
        percentual: 100,
        valor: venda.total,
      }],
    },
  };
}

/** Cria o pedido no Omie. Devolve o `codigo_pedido` interno deles. */
export async function incluirPedidoOmie(pedido) {
  const resposta = await chamarOmie("produtos", "pedido", "IncluirPedido", pedido);
  return resposta; // inclui codigo_pedido, codigo_status, etc.
}

/**
 * Fatura o pedido — é essa chamada que emite a NF-e de verdade.
 * Usa o código de integração (o id da venda no nosso banco) em vez do
 * código interno do Omie, então não precisa ter guardado o retorno do
 * IncluirPedido para chamar esta função.
 */
export async function faturarPedidoOmie(codigoPedidoIntegracao) {
  return chamarOmie("produtos", "pedidovendafat", "FaturarPedidoVenda", {
    cCodIntPed: codigoPedidoIntegracao,
    nCodPed: 0,
  });
}

const aguardar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Acha, na lista de notas do dia daquele cliente, a que corresponde ao
 * pedido — casando por `nIdPedido`, não adivinhando pela posição na lista.
 *
 * A emissão é assíncrona no Omie (fatura → SEFAZ autoriza depois), por isso
 * tenta de novo algumas vezes com um intervalo curto antes de desistir.
 */
export async function obterDadosNotaFiscal({ omieCodigoPedido, omieCodigoCliente, dataEmissao }) {
  const dia = dataBR(dataEmissao);
  const tentativas = 5;

  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    const resposta = await chamarOmie("produtos", "nfconsultar", "ListarNF", {
      pagina: 1,
      registros_por_pagina: 50,
      ordenar_por: "CODIGO",
      ordem_decrescente: "S",
      dEmiInicial: dia,
      dEmiFinal: dia,
      nIdCliente: omieCodigoCliente,
    });

    const nota = (resposta?.nfCadastro ?? []).find(
      (n) => n.compl?.nIdPedido === omieCodigoPedido
    );
    if (nota) {
      const danfe = await buscarUrlDanfe(nota.compl.nIdNF);
      return {
        chave: nota.compl.cChaveNFe,
        numero: Number(nota.ide.nNF),
        serie: Number(nota.ide.serie),
        idNota: nota.compl.nIdNF,
        danfeUrl: danfe,
      };
    }

    if (tentativa < tentativas) await aguardar(2000);
  }

  throw new Error(
    "Pedido faturado, mas a nota ainda não apareceu na consulta do Omie — " +
    "tente de novo em alguns segundos."
  );
}

/** Link do PDF do DANFe a partir do código interno da nota (nIdNF). */
export async function buscarUrlDanfe(nIdNF) {
  const resposta = await chamarOmie("produtos", "notafiscalutil", "GetUrlDanfe", {
    nCodNF: nIdNF,
    cCodNFInt: "",
  });
  return resposta?.cUrlDanfe ?? "";
}

/**
 * Orquestra o fluxo inteiro: monta o pedido, inclui, fatura, busca a chave/
 * número/DANFe da nota gerada. É essa função que o botão "Emitir NF-e" na
 * tela de Vendas chama.
 */
export async function emitirNfeParaVenda({ venda, loja, produtosPorId }) {
  const pedido = montarPedidoOmie({ venda, loja, produtosPorId });
  const incluido = await incluirPedidoOmie(pedido);
  const omieCodigoPedido = incluido?.codigo_pedido ?? null;

  const faturado = await faturarPedidoOmie(venda.id);
  if (faturado?.cCodStatus && faturado.cCodStatus !== "0") {
    throw new Error(`Omie recusou o faturamento: ${faturado.cDesStatus || faturado.cCodStatus}`);
  }

  const nota = await obterDadosNotaFiscal({
    omieCodigoPedido,
    omieCodigoCliente: loja.omieCodigoCliente,
    dataEmissao: venda.data,
  });

  return {
    omieCodigoPedido,
    nfeStatus: "autorizada",
    nfeNumero: nota.numero,
    nfeSerie: nota.serie,
    nfeChave: nota.chave,
    nfeDanfeUrl: nota.danfeUrl,
    nfeEmitidaEm: new Date().toISOString(),
  };
}

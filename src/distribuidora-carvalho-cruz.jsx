import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge, Btn, Card, FiltroPills, Icon, Input, Modal, Select, StatCard, TabelaRolavel } from "./components/ui";
import { BarraFiltros, GraficoColunas, Indicador, Ranking } from "./components/Analise";
import AvisoRotaIniciada from "./components/AvisoRotaIniciada";
import BotaoAtualizar from "./components/BotaoAtualizar";
import Carregando from "./components/Carregando";
import LinkComprovante from "./components/LinkComprovante";
import VisorComprovante from "./components/VisorComprovante";
import { CamposCadastro, FichaCadastral } from "./components/FichaCliente";
import InstalarApp from "./components/InstalarApp";
import LeitorQR from "./components/LeitorQR";
import Logo, { LogoSelo } from "./components/Logo";
import MapaRota from "./components/MapaRota";
import MenuUsuario from "./components/MenuUsuario";
import PuxarParaAtualizar from "./components/PuxarParaAtualizar";
import SyncBadge from "./components/SyncBadge";
import { useAuth } from "./contexts/auth-context";
import { useDados } from "./hooks/useDados";
import { useFiltros } from "./hooks/useFiltros";
import { useModoTela } from "./hooks/useEhCelular";
import {
  PRAZOS, dataPorExtenso, diaSeguinteISO, diasDeAtraso, formatarData, hojeISO, mesDe, nomeDoMes, ontemISO,
  rotuloPrazo, vencimentoDe,
} from "./lib/datas";
import { TIPOS_COMPROVANTE, baixarComprovante, descartarComprovante, enviarComprovante, lerComprovante, listarCaixa, urlDoComprovante } from "./lib/comprovantes";
import { vendaAindaNoDeposito } from "./lib/entregas";
import {
  CAMPOS_CADASTRO, cadastroVazio, pendenciasNfe, separarNumero, consultarCnpj, ehCnpj, errosCadastro, normalizarCadastro, soDigitos,
  textoBuscavel,
} from "./lib/cadastro";
import {
  AGRUPAMENTOS, CORES_SERIE, EMPRESA_PADRAO, agruparItens, chaveGrupo, chavesContinuas, dreDoRecorte, empresaDasFrutas,
  intervaloAnterior, noIntervalo, pct, rateioOperacao, somarItens, rotuloGrupo, rotuloIntervalo, variacao,
} from "./lib/analise";
import { efeitosDasDevolucoes } from "./lib/notas";
import { MODOS_TAXA, TIPOS_TAXA, limparTaxas, rotuloDaTaxa, taxasDaLoja } from "./lib/taxas";
import { exportarPdf, exportarRomaneioPdf, exportarXlsx } from "./lib/exportar";
import { caixasDoItem, rotuloCaixas, totaisDasVendas } from "./lib/caixas";
import { listarContas } from "./lib/auth";
import { FUNCOES_FUNCIONARIO, TIPOS_FUNCIONARIO } from "./lib/folha";
import { aguardar, distanciaKm, geocodificarEndereco } from "./lib/geo";
import { novoId } from "./lib/mappers";
import {
  ehNotaSemanal, mesclarItensPedidos, pedidosParaFecharSemana, rotuloVencimento, vencimentoDoPedido,
} from "./lib/notaSemanal";
import { lembrarProduto, pedidoCompraDaVenda } from "./lib/pedidoPdf";
import { alertasUrgentes, painelDePedidos } from "./lib/previsaoPedidos";
import { gerarReciboPdf } from "./lib/recibo";
import { emitirNfeParaVenda, cancelarNfeDaVenda, registrarVendaSpedy, cancelarVendaSpedy, tributacaoDoProduto, codigoDaNota } from "./lib/spedy";
import { contaExclui, contaVeAba, ehCampo, podeGerenciarCadastros, rotuloPapel } from "./lib/permissoes";
import {
  buscarTokenPedido, buscarTokenPedidoGeral, buscarTokenPedidoRede, linkDePedido, linkDePedidoGeral, linkDePedidoRede,
  renovarLinkPedido, renovarLinkPedidoGeral, renovarLinkPedidoRede,
} from "./lib/pedidoCliente";
import { gerarQrDataUrl, pareceCodigoDeNota } from "./lib/qr";
import { supabaseConfigurado } from "./lib/supabase";
import { COLORS, brl, kg } from "./lib/tema";
import Metas from "./pages/Metas";
import MinhaRota from "./pages/MinhaRota";
import MinhasEntregas from "./pages/MinhasEntregas";
import NotasFiscais from "./pages/NotasFiscais";
import PainelTV from "./pages/PainelTV";
import PrevisaoPedidos from "./pages/PrevisaoPedidos";
import Promotores from "./pages/Promotores";
import ArquivoMorto from "./pages/ArquivoMorto";
import Sincronizacao from "./pages/Sincronizacao";
import Usuarios from "./pages/Usuarios";

/**
 * Mais recentes primeiro. Os ids passaram a ser UUID (para poderem ser criados
 * offline em qualquer aparelho), então a ordem vem da data de criação.
 */
const ordenarPorCriacao = (a, b) =>
  String(b.criadoEm ?? b.data ?? "").localeCompare(String(a.criadoEm ?? a.data ?? ""));

// ─── Vocabulário do negócio ──────────────────────────────────────────────────

/** Quantos quilos representa uma quantidade vendida. É a coluna BAGS da planilha. */
const kgDoItem = (qty, kgPorUnidade) => (Number(qty) || 0) * (Number(kgPorUnidade) || 1);

/**
 * "sacos", "unid." ou "kg" — como a quantidade é contada na hora de vender.
 * `unidade` é a do item: um produto de agranel pode sair contado por unidade
 * para alguns clientes (laranja por unidade em vez de por quilo).
 */
const rotuloUnidade = (produto, qty = 2, unidade) => {
  if (unidade === "un") return "unid.";
  return produto?.unidadeVenda === "saco" ? (qty === 1 ? "saco" : "sacos") : "kg";
};

/** Peso médio de uma laranja, só para o primeiro pedido por unidade. */
const PESO_UNIDADE_PADRAO = 0.2;

/** As frutas de sempre. Compra-se fruta; vende-se produto feito dela. */
const FRUTAS_PADRAO = ["Laranja Pera", "Laranja Lima", "Abóbora"];

/**
 * Todas as frutas do negócio: as de sempre e as que entraram depois pelo
 * cadastro de produto. Não há tabela de frutas — uma fruta nova passa a
 * existir quando o primeiro produto dela é cadastrado. Compras, perdas e
 * acertos também entram, para uma fruta sem produto não sumir do estoque.
 */
function frutasDe(dados) {
  const novas = new Set();
  for (const lista of [dados.produtos, dados.compras, dados.perdas, dados.acertos]) {
    for (const x of lista ?? []) if (x.fruta && !FRUTAS_PADRAO.includes(x.fruta)) novas.add(x.fruta);
  }
  return [...FRUTAS_PADRAO, ...[...novas].sort((a, b) => a.localeCompare(b, "pt-BR"))];
}

/** Na CVC toda fruta tem estoque, venha a nota pela CVC ou pela Carvalho Cruz. */
function frutasComEstoque(dados) {
  return frutasDe(dados);
}

/**
 * Por qual empresa cada produto é vendido. Produção própria e revenda não se
 * misturam: a receita de um produto conta para a empresa dele no DRE.
 */
const EMPRESAS = [
  { value: "cvc", label: "CVC" },
  { value: "carvalho_cruz", label: "Carvalho Cruz" },
];
const nomeDaEmpresa = (empresa) => EMPRESAS.find((e) => e.value === empresa)?.label ?? "CVC";

/** "PETROX · P.CAJU" — como o cliente é identificado em toda tela. */
function nomeDoCliente(dados, lojaId) {
  const loja = dados.lojas.find((l) => l.id === lojaId);
  if (!loja) return "—";
  const rede = dados.redes.find((r) => r.id === loja.redeId);
  return rede ? `${rede.nome} · ${loja.nome}` : loja.nome;
}

/** Receita de uma venda ignora bonificação: mercadoria dada não é faturamento. */
const receitaDaVenda = (v) =>
  (v.itens ?? []).reduce(
    (s, i) => s + (i.natureza === "bonificacao" ? 0 : i.qty * i.precoUnitario),
    0
  );

/**
 * Histórico de uma loja: total comprado, quilos, pedidos, quebra por produto
 * e o que ainda está para receber. Não existe tabela própria — é conta em
 * cima de dados.vendas, fatiada por cliente, como a "TABELA COMPRADORES" da
 * planilha por trás.
 */
function historicoDaLoja(dados, lojaId) {
  const nomeProduto = new Map(dados.produtos.map((p) => [p.id, p.nome]));
  const vendas = [...dados.vendas]
    .filter((v) => v.lojaId === lojaId)
    .sort(ordenarPorCriacao);

  const validas = vendas.filter((v) => v.status !== "cancelado");
  const devolvidas = efeitosDasDevolucoes(dados).filter((d) => d.lojaId === lojaId && validas.some((v) => v.id === d.vendaId));
  const totalComprado = validas.reduce((s, v) => s + receitaDaVenda(v), 0) - devolvidas.reduce((s, d) => s + d.receita, 0);
  const kgTotal = validas.reduce((s, v) => s + v.kgTotal, 0) - devolvidas.reduce((s, d) => s + d.kg, 0);

  const pendentes = vendas.filter((v) => v.status === "pendente");
  const aReceber = pendentes.reduce((s, v) => s + v.total, 0);
  const vencido = pendentes
    .filter((v) => diasDeAtraso(vencimentoDoPedido(dados, v)) > 0)
    .reduce((s, v) => s + v.total, 0);

  const porProdutoMapa = new Map();
  for (const v of validas) {
    for (const item of v.itens) {
      if (item.natureza === "bonificacao") continue;
      const nome = nomeProduto.get(item.produtoId) ?? "—";
      const linha = porProdutoMapa.get(nome) ?? { produto: nome, kg: 0, valor: 0 };
      linha.kg += item.kgTotal;
      linha.valor += item.qty * item.precoUnitario;
      porProdutoMapa.set(nome, linha);
    }
  }

  for (const d of devolvidas) {
    const linha = porProdutoMapa.get(nomeProduto.get(d.produtoId) ?? "—");
    if (!linha) continue;
    linha.kg -= d.kg;
    linha.valor -= d.receita;
  }

  return {
    vendas,
    totalComprado,
    kgTotal,
    pedidos: validas.length,
    ticketMedio: validas.length > 0 ? totalComprado / validas.length : 0,
    aReceber,
    vencido,
    porProduto: [...porProdutoMapa.values()].sort((a, b) => b.valor - a.valor),
  };
}

const ChipBonificado = () => (
  <span style={{ background: "#FFF3CD", color: "#856404", padding: "1px 7px", borderRadius: 5, fontSize: 11, fontWeight: 700, marginLeft: 6 }}>
    BONIFICADO
  </span>
);

/** Pedido que o próprio cliente fez pelo link — laranja enquanto ninguém conferiu. */
/** De qual empresa é o produto (ou a fruta): produção própria e revenda não se misturam. */
const ChipEmpresa = ({ empresa }) => {
  const cvc = empresa !== "carvalho_cruz";
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, whiteSpace: "nowrap",
      background: cvc ? "#E8F1FB" : `${COLORS.verde}1A`, color: cvc ? COLORS.azul : COLORS.verde }}>
      {nomeDaEmpresa(empresa)}
    </span>
  );
};

const ChipPedidoCliente = ({ conferir }) => (
  <span style={{
    display: "inline-block", marginLeft: 6, padding: "1px 7px", borderRadius: 10, fontSize: 10.5, fontWeight: 700,
    verticalAlign: "middle", whiteSpace: "nowrap",
    background: conferir ? "#FFE0CC" : COLORS.cinzaClaro, color: conferir ? COLORS.laranjaEscuro : COLORS.cinza,
  }}>
    {conferir ? "Pedido do cliente · conferir" : "Pedido do cliente"}
  </span>
);

/** Pedido que já entrou numa rota do Romaneio (tem veículo escalado) — o
 * lançamento em si é automático, isso aqui é só o "já foi" visível na
 * lista de Vendas, sem precisar abrir a aba Romaneio pra saber. */
const ChipRomaneio = ({ veiculo }) => (
  <span title={veiculo ? `No romaneio · ${veiculo}` : "No romaneio"} style={{
    display: "inline-flex", alignItems: "center", gap: 3, marginLeft: 6, padding: "1px 7px", borderRadius: 10,
    fontSize: 10.5, fontWeight: 700, verticalAlign: "middle", whiteSpace: "nowrap",
    background: COLORS.verdePale, color: COLORS.verde,
  }}>
    ✓ Romaneio
  </span>
);

/**
 * Par de botões "Exportar .xlsx" / "Exportar PDF". As bibliotecas de geração
 * só entram no bundle quando alguém clica — import dinâmico dentro de
 * src/lib/exportar.js.
 */
const BotoesExportar = ({ aoExportarXlsx, aoExportarPdf }) => {
  const [ocupado, setOcupado] = useState(false);
  const rodar = async (fn) => {
    setOcupado(true);
    try {
      await fn();
    } catch (erro) {
      alert(`Não foi possível gerar o arquivo: ${erro?.message ?? erro}`);
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <Btn variant="ghost" onClick={() => rodar(aoExportarXlsx)} disabled={ocupado}>
        {ocupado ? "Gerando…" : "Exportar .xlsx"}
      </Btn>
      <Btn variant="ghost" onClick={() => rodar(aoExportarPdf)} disabled={ocupado}>
        {ocupado ? "Gerando…" : "Exportar PDF"}
      </Btn>
    </div>
  );
};

const ehPdfArquivo = (nome = "", tipo = "") => tipo === "application/pdf" || /\.pdf$/i.test(nome);

/**
 * As categorias da aba NÃO MEXER. Combustíveis, Diaristas e Funcionários
 * ficaram de fora porque têm aba própria (Combustível e Folha) — lançar lá e
 * aqui contaria o gasto duas vezes no DRE.
 */
const CATEGORIAS_DESPESA = [
  "Fretes", "Manutenção", "Investimentos", "Outros", "Impostos",
];

/** Os combustíveis da frota, como na coluna TIPO COMBUSTIVEL da planilha. */
const TIPOS_COMBUSTIVEL = ["Diesel", "Gasolina", "Etanol"];

/**
 * Tudo que um comprovante de pagamento pode ser. As cinco primeiras viram
 * despesa comum; as três "com aba própria" gravam na tabela delas (abastecimento,
 * pagamento da folha, compra de fruta) — uma vez só, para o DRE não contar em dobro.
 */
// O diesel é lançado a cada abastecimento (aba Combustível) e o posto é pago
// de 15 em 15 dias: o comprovante desse pagamento QUITA abastecimentos que já
// existem, não cria outro — senão o gasto entraria duas vezes no resultado.
const CAT_COMBUSTIVEL = "Pagamento do posto (combustível)";
const CAT_FOLHA = "Salários e diárias";
const CAT_COMPRA = "Compra de mercadoria";
const CATEGORIAS_LANCAMENTO = [
  "Fretes", "Manutenção", CAT_COMBUSTIVEL, CAT_FOLHA, CAT_COMPRA, "Investimentos", "Impostos", "Outros",
];

/** Formulário de lançamento em branco: os campos de despesa e os extras de cada destino. */
const formDespesaVazio = () => ({
  data: hojeISO(), categoria: CATEGORIAS_DESPESA[0], descricao: "", valor: "",
  abastecimentosIds: [], selecaoManual: false, verAntigos: false,
  funcionarioId: "",
  fornecedorId: "", fruta: "", pesoKg: "", valorKg: "", valorKgManual: false,
});

/**
 * Qual quinzena de abastecimentos em aberto soma exatamente o valor pago ao
 * posto. Procura sequências seguidas (por data) e, havendo mais de uma, fica
 * com a mais recente. `lista` já vem em ordem de data; devolve os ids.
 */
function acharQuinzena(lista, alvo) {
  if (!(alvo > 0)) return [];
  let melhor = null;
  for (let i = 0; i < lista.length; i++) {
    let soma = 0;
    for (let j = i; j < lista.length; j++) {
      soma += lista[j].valor;
      if (Math.abs(soma - alvo) <= 0.011) {
        if (!melhor || j > melhor.j || (j === melhor.j && j - i < melhor.j - melhor.i)) melhor = { i, j };
        break;
      }
      if (soma > alvo + 0.011) break;
    }
  }
  return melhor ? lista.slice(melhor.i, melhor.j + 1).map((a) => a.id) : [];
}

/** Caminhos de comprovante já ligados a algum lançamento (despesa, compra, combustível ou folha). */
const caminhosDeComprovante = (dados) =>
  new Set([dados.despesas, dados.compras, dados.abastecimentos, dados.pagamentos]
    .flatMap((lista) => lista ?? []).map((x) => x.comprovantePath).filter(Boolean));

/** Custo médio de compra por fruta, ponderado pelo peso. Map fruta → número. */
function custoMedioPorFruta(compras) {
  const acc = new Map();
  for (const c of compras) {
    if (!acc.has(c.fruta)) acc.set(c.fruta, { kg: 0, valor: 0 });
    const linha = acc.get(c.fruta);
    linha.kg += c.pesoKg;
    linha.valor += c.total;
  }
  return new Map([...acc].map(([f, l]) => [f, l.kg > 0 ? l.valor / l.kg : 0]));
}

/**
 * O estoque, como conta: compras − vendas − perdas + acertos, por fruta.
 *
 * É a mesma conta da view vw_estoque_fruta no Postgres, refeita aqui para o
 * app continuar somando offline. Compra-se fruta e vende-se produto — os sacos
 * de 2,5 kg e o agranel saem do mesmo estoque de laranja pera —, por isso a
 * saída passa pelo produto para descobrir de que fruta ela é.
 *
 * Devolução de cliente com nota (Notas Fiscais → Devoluções) devolve ao
 * estoque os quilos que voltaram aproveitáveis; a avariada não volta.
 *
 * A bonificação conta como saída: não gera receita, mas esvazia o caminhão
 * igual. Venda cancelada não movimenta nada.
 *
 * A venda só sai do estoque quando a mercadoria sai do depósito, não quando o
 * pedido é lançado: pedido lançado hoje para carregar amanhã continua no
 * depósito, e a contagem das 16h30 não pode achar que ele sumiu. Por isso o
 * pedido ainda «pendente» no Romaneio (nem escaneado no caminhão, nem retirado
 * no CD) fica separado em `aSair` — está no depósito, só que já vendido.
 * Assim que o QR é lido no carregamento (ou o pedido é marcado como retirado
 * no CD), ele baixa do estoque.
 *
 * Pendente só vale como «a sair» se o dia do pedido (o da viagem, se já tem
 * rota) for de ontem em diante — ver `vendaAindaNoDeposito` em lib/entregas,
 * a mesma regra que o Painel TV usa na lista de pedidos pendentes.
 */

/** Data local (YYYY-MM-DD) de um instante ISO gravado pelo servidor. */
function diaLocalDe(instanteISO) {
  const d = new Date(instanteISO);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * O dia em que o pedido saiu do depósito, pela confirmação do Romaneio — ou
 * null se ainda não saiu (pendente). Retirado no CD vale o dia da retirada;
 * em rota/entregue, o dia do «Iniciar rota»; carregando (QR lido, rota ainda
 * não iniciada), o dia da viagem.
 */
function diaDeSaida(venda) {
  const status = venda.statusEntrega ?? "pendente";
  if (status === "pendente") return null;
  const dia = venda.rotaData || venda.data || null;
  if (status === "retirado_cd") return (venda.entregueEm && diaLocalDe(venda.entregueEm)) || dia;
  if (status === "carregando") return dia;
  return (venda.saidaCdEm && diaLocalDe(venda.saidaCdEm)) || dia;
}

function estoquePorFruta(dados) {
  const frutaDoProduto = new Map(dados.produtos.map((p) => [p.id, p.fruta]));
  const acc = new Map(
    frutasComEstoque(dados).map((f) => [f, { fruta: f, entradas: 0, vendas: 0, bonificado: 0, aSair: 0, pedidosASair: 0, devolvido: 0, perdas: 0, acertos: 0 }])
  );
  const ontem = ontemISO();
  const vendasPorId = new Map(dados.vendas.map((v) => [v.id, v]));

  for (const c of dados.compras) {
    const linha = acc.get(c.fruta);
    if (linha) linha.entradas += c.pesoKg;
  }

  for (const v of dados.vendas) {
    if (v.status === "cancelado") continue;
    const noDeposito = vendaAindaNoDeposito(v, ontem);
    const frutasDoPedido = new Set();
    for (const item of v.itens) {
      const linha = acc.get(frutaDoProduto.get(item.produtoId));
      if (!linha) continue;
      if (noDeposito) {
        linha.aSair += item.kgTotal;
        frutasDoPedido.add(linha);
        continue;
      }
      linha.vendas += item.kgTotal;
      if (item.natureza === "bonificacao") linha.bonificado += item.kgTotal;
    }
    for (const linha of frutasDoPedido) linha.pedidosASair += 1;
  }

  // Devolução de cliente: o que voltou aproveitável entra de novo no depósito
  // (a avariada fica fora — a venda já tinha tirado, e continua tirada).
  for (const d of efeitosDasDevolucoes(dados)) {
    const venda = vendasPorId.get(d.vendaId);
    if (!venda || venda.status === "cancelado") continue;
    const linha = acc.get(frutaDoProduto.get(d.produtoId));
    if (linha) linha.devolvido += d.kgVolta;
  }

  for (const perda of dados.perdas) {
    const linha = acc.get(perda.fruta);
    if (linha) linha.perdas += perda.kg;
  }

  for (const acerto of dados.acertos) {
    const linha = acc.get(acerto.fruta);
    if (linha) linha.acertos += acerto.ajuste;
  }

  return [...acc.values()].map((l) => ({
    ...l,
    estoque: l.entradas - l.vendas + l.devolvido - l.perdas + l.acertos,
    // O que sobra no depósito depois que os pedidos pendentes forem carregados.
    livre: l.entradas - l.vendas - l.aSair + l.devolvido - l.perdas + l.acertos,
  }));
}

/**
 * Quanto já está pedido para um dia (a data da venda é o dia da entrega):
 * quilos por fruta e por produto, das vendas não canceladas. Bonificação
 * entra — sai do depósito igual. Serve para ver, na véspera, se o estoque
 * dá conta do que já foi lançado.
 */
function pedidosDoDia(dados, dia) {
  const produtoPorId = new Map(dados.produtos.map((p) => [p.id, p]));
  const porFruta = new Map();
  const porProduto = new Map();
  const vendas = dados.vendas.filter((v) => v.data === dia && v.status !== "cancelado");
  let totalKg = 0;
  let totalCaixas = 0;
  const caixasPorFruta = new Map();
  for (const v of vendas) {
    for (const item of v.itens ?? []) {
      const produto = produtoPorId.get(item.produtoId);
      const quilos = Number(item.kgTotal) || 0;
      totalKg += quilos;
      const fruta = produto?.fruta ?? "Sem fruta";
      const caixas = caixasDoItem(item, produto);
      totalCaixas += caixas;
      caixasPorFruta.set(fruta, (caixasPorFruta.get(fruta) ?? 0) + caixas);
      porFruta.set(fruta, (porFruta.get(fruta) ?? 0) + quilos);
      // Um produto de agranel pode sair por kg e por unidade: linhas separadas.
      const chave = `${item.produtoId ?? "?"}|${item.unidade ?? ""}`;
      const linha = porProduto.get(chave) ?? {
        id: chave, nome: produto?.nome ?? "Produto removido", fruta, produto, unidade: item.unidade, qty: 0, kg: 0,
      };
      linha.qty += Number(item.qty) || 0;
      linha.kg += quilos;
      porProduto.set(chave, linha);
    }
  }
  return {
    pedidos: vendas.length,
    clientes: new Set(vendas.map((v) => v.lojaId)).size,
    totalKg,
    totalCaixas,
    caixasPorFruta,
    porFruta,
    porProduto: [...porProduto.values()].sort((a, b) => b.kg - a.kg),
  };
}

/**
 * Insumos se contam na unidade de compra: a redinha (os sacos) vem em rolo
 * de 1.000 metros e cada metro faz 3 sacos de 2,5 kg; grampo e etiqueta vêm
 * em milheiro. Item ainda gravado como "unidade" (antes da migracao-45)
 * cai na unidade certa pelo nome.
 */
const METROS_POR_ROLO = 1000;
const SACOS_2_5KG_POR_METRO = 3;
const GRAMPOS_POR_SACO = 2;

function unidadeDoInsumo(item) {
  if (item.unidade && item.unidade !== "unidade") return item.unidade;
  if (item.nome === "Redinha") return "rolo (1.000 m)";
  if (item.nome === "Grampo" || item.nome.startsWith("Etiqueta")) return "milheiro";
  return item.unidade || "unidade";
}

/** Quanto a quantidade contada rende: rolos → sacos de 2,5 kg, milheiros → unidades. */
function rendimentoDoInsumo(unidade, quantidade, nome) {
  if (quantidade === null || quantidade === undefined || quantidade === "" || !Number.isFinite(Number(quantidade))) return null;
  const q = Number(quantidade);
  if (nome === "Grampo" && unidade === "milheiro") {
    const grampos = Math.round(q * 1000);
    return `= ${grampos.toLocaleString("pt-BR")} grampos ≈ ${Math.floor(grampos / GRAMPOS_POR_SACO).toLocaleString("pt-BR")} sacos`;
  }
  if (unidade.startsWith("rolo")) {
    return `≈ ${Math.round(q * METROS_POR_ROLO * SACOS_2_5KG_POR_METRO).toLocaleString("pt-BR")} sacos de 2,5 kg`;
  }
  if (unidade === "milheiro") return `= ${Math.round(q * 1000).toLocaleString("pt-BR")} unidades`;
  return null;
}

/**
 * O estoque de redinha, grampo e etiqueta não é conta de compra/venda — é a
 * ÚLTIMA CONTAGEM física de cada item, feita no depósito toda semana. Item
 * nunca contado fica sem saldo (null), não em zero: zero é "contou e não
 * tem nenhum", diferente de "ninguém foi lá ver ainda".
 */
function saldoDosInsumos(dados) {
  const itens = [...(dados.insumos_itens ?? [])]
    .filter((i) => i.ativo !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome, "pt-BR"));

  const ultimaPorItem = new Map();
  for (const c of dados.contagens_insumos ?? []) {
    const atual = ultimaPorItem.get(c.item);
    if (!atual || c.data > atual.data || (c.data === atual.data && c.criadoEm > atual.criadoEm)) {
      ultimaPorItem.set(c.item, c);
    }
  }

  return itens.map((item) => {
    const ultima = ultimaPorItem.get(item.nome) ?? null;
    return {
      ...item,
      unidade: unidadeDoInsumo(item),
      quantidade: ultima?.quantidade ?? null,
      dataContagem: ultima?.data ?? null,
      abaixoDoMinimo: ultima !== null && item.estoqueMinimo > 0 && ultima.quantidade < item.estoqueMinimo,
    };
  });
}

/**
 * Segunda-feira "vigente" para uma rotina semanal que só vira a partir de um
 * horário de corte — 16h para a contagem de insumos, 7h para a conferência
 * de preços: antes do corte na própria segunda (ou no fim de semana), ainda
 * vale a segunda anterior. É contra essa data que se decide se a rotina
 * desta semana está atrasada.
 */
function segundaVigente(horaCorte, minutoCorte = 0, agora = new Date()) {
  const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const diaSemana = d.getDay(); // 0 domingo … 6 sábado
  const antesDoCorte = agora.getHours() < horaCorte || (agora.getHours() === horaCorte && agora.getMinutes() < minutoCorte);
  const voltar = diaSemana === 0 ? 6 : diaSemana === 1 ? (antesDoCorte ? 7 : 0) : diaSemana - 1;
  d.setDate(d.getDate() - voltar);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Nenhum item ativo foi contado desde a segunda-feira da contagem desta semana. */
function contagemInsumosAtrasada(saldos) {
  if (saldos.length === 0) return false;
  const segunda = segundaVigente(16, 0);
  return !saldos.some((s) => s.dataContagem && s.dataContagem >= segunda);
}

/**
 * Nenhum acerto (contagem física) de fruta registrado HOJE, depois de um
 * horário de corte — 16h30 para o lembrete de quem faz (contagemFrutasAtrasada),
 * 18h para o alerta do sócio master (contagemFrutasAtrasadaMaster), uma folga
 * de 1h30 antes de avisar que o assistente não fez.
 */
function contagemFrutasAtrasada(dados, agora = new Date(), horaCorte = 16, minutoCorte = 30) {
  const depoisDoCorte = agora.getHours() > horaCorte || (agora.getHours() === horaCorte && agora.getMinutes() >= minutoCorte);
  if (!depoisDoCorte) return false;
  const hoje = hojeISO();
  return !dados.acertos.some((a) => a.data === hoje);
}

/** Segunda-feira já passou inteira — não é mais ela hoje (terça a domingo). */
const passouDaSegunda = (agora = new Date()) => agora.getDay() !== 1;

/**
 * Os produtos que entram na conferência de preço: toda forma de vender uma
 * fruta da Carvalho Cruz — o agranel e cada saco (2,5 kg, 3 kg, 5 kg, 10 kg)
 * são preços diferentes, não um preço só por fruta. CVC (revenda) fica de
 * fora, como o resto do Estoque.
 */
function produtosParaPrecificar(dados) {
  const frutas = new Set(frutasComEstoque(dados));
  return dados.produtos
    .filter((p) => frutas.has(p.fruta))
    .sort((a, b) =>
      a.fruta.localeCompare(b.fruta, "pt-BR")
      || (a.unidadeVenda === b.unidadeVenda ? (a.kgPorUnidade ?? 0) - (b.kgPorUnidade ?? 0) : a.unidadeVenda === "kg" ? -1 : 1)
    );
}

/**
 * Preço vigente de cada produto: o registro mais recente da conferência
 * semanal (precos_produtos) — não o preço da venda, que é digitado em cada
 * uma e varia por cliente.
 */
function precoAtualPorProduto(dados) {
  const mapa = new Map();
  for (const p of dados.precos_produtos ?? []) {
    const atual = mapa.get(p.produto);
    if (!atual || p.data > atual.data || (p.data === atual.data && p.criadoEm > atual.criadoEm)) {
      mapa.set(p.produto, p);
    }
  }
  return mapa;
}

/**
 * Nenhum produto vendável (fruta + sacos) teve o preço confirmado ou
 * ajustado desde a segunda-feira da conferência desta semana (a partir
 * das 7h).
 */
function precosProdutosAtrasados(dados) {
  const produtos = produtosParaPrecificar(dados);
  if (produtos.length === 0) return false;
  const segunda = segundaVigente(7, 0);
  const precos = precoAtualPorProduto(dados);
  return produtos.some((p) => !precos.get(p.nome) || precos.get(p.nome).data < segunda);
}

/**
 * Motivo do acerto que, em vez de virar acerto, vira PERDA: a fruta que falta
 * na contagem estragou ou quebrou, e o prejuízo tem de aparecer em Perdas.
 */
const MOTIVO_ACERTO_PERDA = "Perdas";

/** Por que a contagem não bateu com a conta. */
const MOTIVOS_ACERTO = [
  MOTIVO_ACERTO_PERDA,
  "Compra sem nota lançada",
  "Venda lançada a mais",
  "Erro de digitação em kg",
  "Contagem de inventário",
  "Outro",
];

/** Motivos de perda que a distribuidora vê no dia a dia. */
const MOTIVOS_PERDA = [
  "Estragou",
  "Quebra no transporte",
  "Devolução de cliente",
  "Sobra de feira",
  "Outro",
];

/**
 * Km rodado, km/l e custo por km de cada abastecimento — não são campos, são
 * conta a partir do abastecimento anterior do MESMO veículo, como KM INICIAL
 * e KM FINAL da aba COMBUSTIVEIS da planilha. Só que aqui não se digita a
 * dupla: cada abastecimento leva o km atual do painel, e a distância vem da
 * diferença para o abastecimento anterior — sem depender de o motorista
 * lembrar o km com que saiu da última vez.
 *
 * O primeiro abastecimento de um veículo — ou um km atual menor ou igual ao
 * anterior, sinal de erro de digitação — fica sem quilometragem.
 */
function abastecimentosComKm(abastecimentos) {
  const porVeiculo = new Map();
  for (const a of abastecimentos) {
    if (!porVeiculo.has(a.veiculoId)) porVeiculo.set(a.veiculoId, []);
    porVeiculo.get(a.veiculoId).push(a);
  }

  const comKm = new Map();
  for (const lista of porVeiculo.values()) {
    const ordenada = [...lista].sort(
      (x, y) => String(x.data).localeCompare(String(y.data)) || String(x.criadoEm ?? "").localeCompare(String(y.criadoEm ?? ""))
    );
    let anterior = null;
    for (const a of ordenada) {
      const kmRodado = anterior && a.kmAtual > anterior.kmAtual ? a.kmAtual - anterior.kmAtual : null;
      comKm.set(a.id, {
        ...a,
        kmRodado,
        kmPorLitro: kmRodado && a.litros > 0 ? kmRodado / a.litros : null,
        custoPorKm: kmRodado > 0 ? a.valor / kmRodado : null,
      });
      anterior = a;
    }
  }

  return abastecimentos.map((a) => comKm.get(a.id));
}

// ─── Análise de vendas: rankings compartilhados por Painel e Financeiro ─────

const DIAS_DA_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Por onde se pode abrir a venda: cada uma vira um ranking no Painel. */
const DIMENSOES_VENDA = [
  { valor: "rede", rotulo: "Rede" },
  { valor: "cliente", rotulo: "Cliente" },
  { valor: "fruta", rotulo: "Fruta" },
  { valor: "produto", rotulo: "Produto" },
  { valor: "empresa", rotulo: "Empresa" },
  { valor: "diaSemana", rotulo: "Dia da semana" },
];

/** Valor do painel com um balão que mostra a base de cálculo ao passar o mouse (ou tocar). */
function ValorComBase({ rotulo, valor, cor, base }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setAberto(true)}
      onMouseLeave={() => setAberto(false)}
      onClick={() => setAberto((a) => !a)}
    >
      <div style={{ fontSize: 11.5, color: COLORS.cinza, textTransform: "uppercase", letterSpacing: 0.4 }}>{rotulo}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: cor, marginTop: 3 }}>{valor}</div>
      {aberto && base && (
        <div role="tooltip" style={{
          position: "absolute", top: "100%", left: 0, marginTop: 6, zIndex: 20, width: 240,
          background: COLORS.cinzaEscuro, color: "#fff", fontSize: 12, lineHeight: 1.4, fontWeight: 400,
          textTransform: "none", letterSpacing: 0, padding: "8px 10px", borderRadius: 8,
          boxShadow: "0 4px 14px rgba(0,0,0,0.25)", pointerEvents: "none",
        }}>
          <strong style={{ display: "block", marginBottom: 2 }}>Base de cálculo</strong>
          {base}
        </div>
      )}
    </div>
  );
}

/**
 * As linhas de um ranking de vendas — receita, quilos, pedidos, margem — por
 * uma dimensão do recorte. A despesa é diluída pelos quilos de cada linha; por
 * fruta e por empresa, sai da receita a fruta comprada no período (e quem foi
 * comprado sem venda também aparece), nas demais, o custo estimado.
 */
function rankingDeVendas(dados, recorte, dimensao) {
  const { itens, custos, custoOperacaoKg } = recorte;
  const nomeRede = new Map(dados.redes.map((r) => [r.id, r.nome]));
  const nomeProduto = new Map(dados.produtos.map((p) => [p.id, p.nome]));
  const chaveDe = {
    rede: (i) => i.redeId,
    cliente: (i) => i.lojaId,
    fruta: (i) => i.fruta,
    produto: (i) => i.produtoId,
    empresa: (i) => i.empresa,
    diaSemana: (i) => String(new Date(`${i.data}T12:00:00`).getDay()),
  }[dimensao];
  const nomeDe = {
    rede: (k) => nomeRede.get(k) ?? "Sem rede",
    cliente: (k) => nomeDoCliente(dados, k),
    fruta: (k) => k,
    produto: (k) => nomeProduto.get(k) ?? "—",
    empresa: (k) => nomeDaEmpresa(k),
    diaSemana: (k) => DIAS_DA_SEMANA[Number(k)],
  }[dimensao];
  const comprado = recorte.semMercadoria ? null : recorte.compradoPor?.[dimensao];
  const grupos = agruparItens(itens, chaveDe, custos);
  if (comprado) {
    const vistos = new Set(grupos.map((g) => g.chave));
    for (const k of comprado.keys()) if (!vistos.has(k)) grupos.push({ chave: k, ...somarItens([], custos) });
  }
  const taxasDoGrupo = new Map();
  for (const t of recorte.taxasDoRecorte ?? []) {
    const k = chaveDe(t);
    if (k !== undefined) taxasDoGrupo.set(k, (taxasDoGrupo.get(k) ?? 0) + t.valor);
  }
  return grupos.map((l) => ({
    ...l,
    taxas: taxasDoGrupo.get(l.chave) ?? 0,
    ...rateioOperacao(l, custoOperacaoKg, comprado ? comprado.get(l.chave) ?? 0 : null, taxasDoGrupo.get(l.chave) ?? 0),
    id: l.chave,
    nome: nomeDe(l.chave),
  }));
}

/** As colunas dos rankings de venda — as mesmas na tela e no arquivo exportado. */
const colunasRankingVendas = (rotulo, comClientes) => [
  { chave: "nome", rotulo },
  { chave: "receita", rotulo: "Receita", formatar: brl, destaque: true, participacao: true },
  { chave: "kg", rotulo: "Kg", formatar: kg },
  { chave: "pedidos", rotulo: "Pedidos" },
  ...(comClientes ? [{ chave: "clientes", rotulo: "Clientes" }] : []),
  { chave: "ticketMedio", rotulo: "Ticket médio", formatar: brl },
  { chave: "precoMedio", rotulo: "R$ / kg", formatar: brl },
  { chave: "margemBruta", rotulo: "Margem bruta", formatar: (v, l) => `${brl(v)}${l.custoParcial ? "*" : ""}`,
    cor: (l) => (l.margemBruta >= 0 ? COLORS.verde : COLORS.vermelho) },
  { chave: "margemPct", rotulo: "Margem %", formatar: pct, cor: (l) => (l.margemPct >= 0 ? COLORS.verde : COLORS.vermelho) },
  { chave: "custoFruta", rotulo: "Fruta", formatar: (v, l) => `${l.frutaEstimada ? "≈ " : ""}${brl(v)}` },
  { chave: "custoOperacao", rotulo: "Custo operação", formatar: brl },
  { chave: "taxas", rotulo: "Taxas (IFCO, CD, antecip.)", formatar: brl },
  { chave: "resultadoOperacional", rotulo: "Resultado", formatar: (v, l) => `${brl(v)}${l.custoParcial ? "*" : ""}`,
    cor: (l) => (l.resultadoOperacional >= 0 ? COLORS.verde : COLORS.vermelho) },
  { chave: "resultadoOperacionalKg", rotulo: "Resultado / kg", formatar: brl,
    cor: (l) => (l.resultadoOperacionalKg >= 0 ? COLORS.verde : COLORS.vermelho) },
];

/** Converte um ranking para o formato de exportação (texto já formatado). */
const tabelaExportavel = (nome, titulo, colunas, linhas) => ({
  nome,
  titulo,
  colunas: colunas.map((c) => ({ chave: c.chave, rotulo: c.rotulo })),
  linhas: linhas.map((l) => Object.fromEntries(colunas.map((c) => [c.chave, c.formatar ? c.formatar(l[c.chave], l) : l[c.chave]]))),
});

/** Meses com qualquer movimento, do mais recente — as opções "Mês: set/2026" do filtro. */
function mesesComMovimento(dados) {
  const meses = new Set();
  for (const lista of [dados.vendas, dados.compras, dados.despesas, dados.abastecimentos, dados.pagamentos]) {
    for (const x of lista ?? []) if (x.data) meses.add(mesDe(x.data));
  }
  return [...meses].sort().reverse();
}

/** Os pontos do gráfico a partir das linhas do DRE do recorte, sem buraco entre elas. */
function pontosDoRecorte(linhas, agrupar, valoresDe) {
  const porChave = new Map(linhas.map((l) => [l.chave, l]));
  return chavesContinuas(linhas.map((l) => l.chave), agrupar).map((k) => ({
    chave: k,
    rotulo: rotuloGrupo(k, agrupar),
    rotuloLongo: rotuloGrupo(k, agrupar, true),
    valores: valoresDe(porChave.get(k)),
  }));
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
const Dashboard = ({ dados, papel, aoVerPrevisao }) => {
  const validas = dados.vendas.filter((v) => v.status !== "cancelado");

  // Pop-ups de pendência: fecham só nesta visita ao Painel — voltar aqui com
  // algo ainda pendente mostra de novo. É para chamar atenção mesmo, não é
  // bug reabrir.
  const [modalPendenciasFechado, setModalPendenciasFechado] = useState(false);
  const [modalMasterFechado, setModalMasterFechado] = useState(false);

  // Tudo o que é número do período obedece aos filtros: datas, empresa,
  // rede, cliente, fruta e produto. Por padrão, o mês corrente dia a dia.
  const { filtros, setFiltros, limpar, intervalo } = useFiltros("painel", { periodo: "mes", agrupar: "dia" });
  const [dimensao, setDimensao] = useState("rede");
  const meses = useMemo(() => mesesComMovimento(dados), [dados]);
  const frutas = useMemo(() => frutasDe(dados), [dados]);

  // O DRE é a fonte dos números do topo: receita, despesa e mercadoria saem da
  // mesma conta que fecha o mês, e não de somas paralelas que acabam divergindo.
  const recorte = useMemo(() => dreDoRecorte(dados, filtros, intervalo, filtros.agrupar), [dados, filtros, intervalo]);
  const anterior = useMemo(() => {
    const ant = intervaloAnterior(intervalo);
    return ant ? dreDoRecorte(dados, filtros, ant, "ano").total : null;
  }, [dados, filtros, intervalo]);
  const acumulado = recorte.total;
  const vs = (campo) => (anterior ? variacao(acumulado[campo], anterior[campo]) : undefined);
  const rotuloPeriodo = rotuloIntervalo(intervalo);

  const ranking = useMemo(
    () => rankingDeVendas(dados, recorte, dimensao),
    [dados, recorte, dimensao]
  );
  const rotuloDimensao = DIMENSOES_VENDA.find((d) => d.valor === dimensao)?.rotulo ?? "";
  const colunasRanking = colunasRankingVendas(rotuloDimensao, dimensao !== "cliente");

  // Pedidos do recorte, mais recentes primeiro.
  const idsDoRecorte = new Set(recorte.itens.map((i) => i.vendaId));
  const ultVendas = [...dados.vendas].filter((v) => idsDoRecorte.has(v.id)).sort(ordenarPorCriacao).slice(0, 8);

  // A receber e hoje olham o cliente/rede escolhido, mas não o período: é o que está em aberto agora.
  const redeDaLoja = new Map(dados.lojas.map((l) => [l.id, l.redeId]));
  const doCliente = (v) => (!filtros.rede || redeDaLoja.get(v.lojaId) === filtros.rede) && (!filtros.cliente || v.lojaId === filtros.cliente);
  // «Vendas hoje» é o que SAIU hoje, pela confirmação do Romaneio (QR lido no
  // carregamento ou retirado no CD) — não o que foi lançado hoje. O que foi
  // lançado e ainda não carregou aparece à parte, como «a carregar».
  const hoje = hojeISO();
  const ontem = ontemISO();
  const vendasHoje = validas.filter((v) => diaDeSaida(v) === hoje && doCliente(v));
  const aCarregar = validas.filter((v) => doCliente(v) && vendaAindaNoDeposito(v, ontem));
  const pendentes = dados.vendas.filter((v) => v.status === "pendente" && doCliente(v));
  const vencidas = pendentes.filter((v) => diasDeAtraso(vencimentoDoPedido(dados, v)) > 0);
  const aReceber = pendentes.reduce((s, v) => s + v.total, 0);

  const saldos = estoquePorFruta(dados);
  const negativas = saldos.filter((s) => s.estoque < 0);

  // Alerta de falta de pedido: quem pede em dia certo e não pediu (Previsão de Pedidos).
  const semPedido = useMemo(
    () => (aoVerPrevisao ? painelDePedidos(dados).alertas : []),
    [dados, aoVerPrevisao]
  );
  const atrasados = semPedido.filter((c) => c.alerta === "atrasado");
  const sinalizadosHoje = semPedido.filter((c) => c.alerta === "lembrete" || c.alerta === "reconquistar");
  const esperadosHoje = semPedido.filter((c) => c.alerta === "hoje").length;

  const saldosInsumos = saldoDosInsumos(dados);
  const insumosBaixos = saldosInsumos.filter((s) => s.abaixoDoMinimo);
  const insumosAtrasados = contagemInsumosAtrasada(saldosInsumos);
  const frutasAtrasadas = contagemFrutasAtrasada(dados);
  const precosPendentes = precosProdutosAtrasados(dados);

  // Pendências do assistente, num pop-up só — precisa fechar (X ou o botão)
  // para sumir, e some sozinho quando a ação é feita.
  const pendenciasAssistente = [
    insumosBaixos.length > 0 && {
      titulo: `${insumosBaixos.map((s) => s.nome).join(", ")} abaixo do mínimo`,
      texto: "Hora de comprar mais — confira em Estoque.",
    },
    insumosBaixos.length === 0 && insumosAtrasados && {
      titulo: "Contagem de insumos da semana pendente",
      texto: "Redinha, grampo e etiquetas — conte e registre em Estoque.",
    },
    frutasAtrasadas && {
      titulo: "Contagem de estoque de frutas pendente hoje",
      texto: "Conte o depósito e registre o acerto, em Estoque.",
    },
    precosPendentes && {
      titulo: "Conferência de preços da semana pendente",
      texto: "Confirme ou ajuste o preço de cada fruta e saco, em Estoque.",
    },
  ].filter(Boolean);

  // Alerta do sócio master: só depois de uma folga (o assistente não fez a
  // tempo), não junto com o lembrete de quem faz. Semanais escalam a partir
  // de terça (a segunda já passou inteira); a diária, com 1h30 de folga.
  const pendenciasParaMaster = [
    insumosAtrasados && passouDaSegunda() && "contagem de insumos",
    contagemFrutasAtrasada(dados, new Date(), 18, 0) && "contagem de estoque de frutas",
    precosPendentes && passouDaSegunda() && "conferência de preços (frutas e sacos)",
  ].filter(Boolean);

  const pontos = pontosDoRecorte(recorte.linhas, filtros.agrupar, (l) => ({
    receita: l?.receita ?? 0,
    margemBruta: l?.margemBruta ?? 0,
  }));

  // Descrição do recorte, para o subtítulo e o cabeçalho do PDF.
  const nomeRede = dados.redes.find((r) => r.id === filtros.rede)?.nome;
  const nomeProduto = dados.produtos.find((p) => p.id === filtros.produto)?.nome;
  const descricaoRecorte = [
    rotuloPeriodo,
    filtros.empresa && nomeDaEmpresa(filtros.empresa),
    nomeRede && `rede ${nomeRede}`,
    filtros.cliente && nomeDoCliente(dados, filtros.cliente),
    filtros.fruta,
    nomeProduto,
  ].filter(Boolean).join(" · ");

  const exportarPainel = (formato) => {
    const resumo = {
      nome: "Resumo",
      titulo: `Resumo — ${descricaoRecorte}`,
      colunas: [{ chave: "item", rotulo: "Indicador" }, { chave: "valor", rotulo: "Valor" }],
      linhas: [
        ["Receita", brl(acumulado.receita)],
        ...(recorte.parcial ? [] : [
          ["Despesas", brl(acumulado.despesas)],
          ["Mercadoria comprada", brl(acumulado.mercadoria)],
          ["Resultado", brl(acumulado.resultado)],
          ["Margem do resultado", pct(acumulado.margem)],
        ]),
        ["Custo estimado da fruta vendida", brl(acumulado.custo)],
        ["Margem bruta estimada", brl(acumulado.margemBruta)],
        ["Margem bruta %", pct(acumulado.margemPct)],
        ["Quilos vendidos", kg(acumulado.kg)],
        ["Quilos bonificados", kg(acumulado.kgBonificado)],
        ["Pedidos", String(acumulado.pedidos)],
        ["Clientes atendidos", String(acumulado.clientes)],
        ["Ticket médio", brl(acumulado.ticketMedio)],
        ["Preço médio / kg", brl(acumulado.precoMedio)],
        ["Custo operação / kg", brl(acumulado.custoOperacaoKg)],
        ["Custo médio total / kg", brl(custoTotalKg)],
        ["Custo operação rateado", brl(acumulado.custoOperacao)],
        ["Resultado após operação", brl(acumulado.resultadoOperacional)],
      ].map(([item, valor]) => ({ item, valor })),
    };
    const evolucao = {
      nome: "Evolução",
      titulo: "Evolução no período",
      colunas: [
        { chave: "periodo", rotulo: "Período" }, { chave: "receita", rotulo: "Receita" }, { chave: "kg", rotulo: "Kg" },
        { chave: "pedidos", rotulo: "Pedidos" }, { chave: "margemBruta", rotulo: "Margem bruta" },
      ],
      linhas: recorte.linhas.map((l) => ({
        periodo: rotuloGrupo(l.chave, filtros.agrupar, true), receita: brl(l.receita), kg: kg(l.kg),
        pedidos: l.pedidos, margemBruta: brl(l.margemBruta),
      })),
    };
    const rankings = DIMENSOES_VENDA.map((d) => {
      const cols = colunasRankingVendas(d.rotulo, d.valor !== "cliente");
      return tabelaExportavel(`Por ${d.rotulo}`, `Por ${d.rotulo.toLowerCase()}`, cols,
        rankingDeVendas(dados, recorte, d.valor));
    });
    const tabelas = [resumo, evolucao, ...rankings];
    return formato === "xlsx"
      ? exportarXlsx("painel-carvalho-cruz", tabelas)
      : exportarPdf("painel-carvalho-cruz", `Painel — ${descricaoRecorte}`, tabelas);
  };

  // Custo total por quilo vendido: fruta + operação, divididos pelos kg vendidos.
  const custoTotalKg = acumulado.kg > 0 ? (acumulado.custoFruta + acumulado.custoOperacao) / acumulado.kg : 0;

  const gerencial = recorte.parcial
    ? [
      ["Receita", brl(acumulado.receita), COLORS.cinzaEscuro, "Soma das vendas do período, com os filtros aplicados."],
      ["Custo estimado", brl(acumulado.custo), COLORS.laranjaEscuro, "Kg vendido × custo médio de compra de cada fruta."],
      ["Margem bruta", brl(acumulado.margemBruta) + (acumulado.custoParcial ? "*" : ""), acumulado.margemBruta >= 0 ? COLORS.verde : COLORS.vermelho, "Receita − custo estimado da fruta vendida."],
      ["Margem bruta %", pct(acumulado.margemPct), acumulado.margemPct >= 0 ? COLORS.verde : COLORS.vermelho, "Margem bruta ÷ receita."],
      ...(recorte.semMercadoria ? [] : [["Fruta comprada", brl(acumulado.mercadoria), COLORS.laranjaEscuro]]),
      ["Quilos vendidos", kg(acumulado.kg), COLORS.cinzaEscuro, "Soma dos kg dos itens vendidos no período."],
      ["Quilos bonificados", kg(acumulado.kgBonificado), COLORS.cinzaEscuro, "Kg dados como bonificação nos pedidos do período."],
      ["Preço médio / kg", brl(acumulado.precoMedio), COLORS.verde, "Receita ÷ quilos vendidos."],
      ["Custo operação / kg", brl(acumulado.custoOperacaoKg), COLORS.laranjaEscuro, "Despesas, combustível e folha da Carvalho Cruz ÷ kg vendidos pela empresa no período."],
      ["Custo médio total / kg", brl(custoTotalKg), COLORS.laranjaEscuro, "(Fruta + custo da operação) ÷ quilos vendidos. Soma o custo médio da fruta com o custo da operação por kg."],
      ["Custo operação rateado", brl(acumulado.custoOperacao), COLORS.laranjaEscuro, "Kg vendidos no recorte × custo operação / kg."],
      ["Taxas dos clientes", brl(acumulado.taxas), COLORS.laranjaEscuro, "Caixas IFCO, taxa de CD, taxa de antecipação e outras, cadastradas na rede ou loja."],
      ["Resultado após operação", brl(acumulado.resultadoOperacional) + (acumulado.frutaEstimada && acumulado.custoParcial ? "*" : ""), acumulado.resultadoOperacional >= 0 ? COLORS.verde : COLORS.vermelho, "Receita − fruta − custo da operação rateado (kg vendido × custo operação / kg) − taxas dos clientes."],
    ]
    : [
      ["Receita", brl(acumulado.receita), COLORS.cinzaEscuro, "Soma das vendas do período, com os filtros aplicados."],
      ["Despesas", brl(acumulado.despesas), COLORS.laranjaEscuro, "Despesas, combustível e folha pagos no período."],
      ["Mercadoria", brl(acumulado.mercadoria), COLORS.laranjaEscuro, "Soma das compras de fruta lançadas no período."],
      ["Taxas dos clientes", brl(acumulado.taxas), COLORS.laranjaEscuro, "Caixas IFCO, taxa de CD, taxa de antecipação e outras, cadastradas na rede ou loja."],
      ["Resultado", brl(acumulado.resultado), acumulado.resultado >= 0 ? COLORS.verde : COLORS.vermelho, "Receita − despesas − mercadoria − taxas dos clientes."],
      ["Margem", pct(acumulado.margem), acumulado.margem >= 0 ? COLORS.verde : COLORS.vermelho, "Resultado ÷ receita."],
      ["Margem bruta est.", brl(acumulado.margemBruta) + (acumulado.custoParcial ? "*" : ""), acumulado.margemBruta >= 0 ? COLORS.verde : COLORS.vermelho],
      ["Quilos vendidos", kg(acumulado.kg), COLORS.cinzaEscuro, "Soma dos kg dos itens vendidos no período."],
      ["Quilos bonificados", kg(acumulado.kgBonificado), COLORS.cinzaEscuro, "Kg dados como bonificação nos pedidos do período."],
      ["Preço médio / kg", brl(acumulado.precoMedio), COLORS.verde, "Receita ÷ quilos vendidos."],
      ["Custo médio / kg", brl(acumulado.custoMedio), COLORS.laranjaEscuro, "Mercadoria comprada ÷ kg comprados no período (média ponderada pelo peso)."],
      ["Custo operação / kg", brl(acumulado.custoOperacaoKg), COLORS.laranjaEscuro, "Despesas, combustível e folha da Carvalho Cruz ÷ kg vendidos pela empresa no período."],
      ["Custo médio total / kg", brl(custoTotalKg), COLORS.laranjaEscuro, "(Fruta + custo da operação) ÷ quilos vendidos. Soma o custo médio da fruta com o custo da operação por kg."],
    ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {vencidas.length > 0 && (
        <div style={{ background: "#FFEBEE", border: `1px solid ${COLORS.vermelho}55`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="alert" color={COLORS.vermelho} size={18} />
          <span style={{ color: COLORS.vermelho, fontSize: 14 }}>
            <strong>{vencidas.length} {vencidas.length === 1 ? "conta vencida" : "contas vencidas"}</strong>
            {" — "}{brl(vencidas.reduce((s, v) => s + v.total, 0))} a cobrar hoje
          </span>
        </div>
      )}

      {semPedido.length > 0 && (
        <button type="button" onClick={aoVerPrevisao} style={{
          background: "#FDEDE8", border: `1px solid ${COLORS.laranjaEscuro}66`, borderRadius: 10, padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left", font: "inherit",
        }}>
          <Icon name="alert" color={COLORS.laranjaEscuro} size={18} />
          <span style={{ color: COLORS.laranjaEscuro, fontSize: 14, flex: 1 }}>
            {atrasados.length > 0 && (
              <>
                <strong>{atrasados.length} {atrasados.length === 1 ? "cliente não fez" : "clientes não fizeram"} o pedido de sempre</strong>
                {" — "}{atrasados.slice(0, 3).map((c) => c.nome).join(", ")}{atrasados.length > 3 ? "…" : ""}
              </>
            )}
            {atrasados.length > 0 && (sinalizadosHoje.length > 0 || esperadosHoje > 0) && " · "}
            {sinalizadosHoje.length > 0 && <><strong>{sinalizadosHoje.length}</strong> {sinalizadosHoje.length === 1 ? "lembrete ou reconquista para hoje" : "lembretes ou reconquistas para hoje"}</>}
            {sinalizadosHoje.length > 0 && esperadosHoje > 0 && " · "}
            {esperadosHoje > 0 && <><strong>{esperadosHoje}</strong> {esperadosHoje === 1 ? "esperado hoje ainda sem pedido" : "esperados hoje ainda sem pedido"}</>}
          </span>
          <span style={{ color: COLORS.laranjaEscuro, fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>Ver previsão →</span>
        </button>
      )}

      {negativas.length > 0 && (
        <div style={{ background: "#FFF3CD", border: "1px solid #FFCC02", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="alert" color="#856404" size={18} />
          <span style={{ color: "#856404", fontSize: 14 }}>
            <strong>{negativas.map((s) => s.fruta).join(", ")}</strong> com estoque negativo —
            saiu mais do que entrou.
          </span>
        </div>
      )}

      {papel === "assistente_administrativo" && !modalPendenciasFechado && pendenciasAssistente.length > 0 && (
        <Modal title="Pendências desta semana" onClose={() => setModalPendenciasFechado(true)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {pendenciasAssistente.map((p) => (
              <div key={p.titulo} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#FFF3CD", border: "1px solid #FFCC02", borderRadius: 8, padding: "10px 12px" }}>
                <Icon name="alert" color="#856404" size={18} />
                <span style={{ fontSize: 13.5, color: "#856404", lineHeight: 1.4 }}>
                  <strong>{p.titulo}</strong><br />{p.texto}
                </span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
              <Btn onClick={() => setModalPendenciasFechado(true)}>Entendi</Btn>
            </div>
          </div>
        </Modal>
      )}

      {papel === "socio_master" && !modalMasterFechado && pendenciasParaMaster.length > 0 && (
        <Modal title="O assistente ainda não fez" onClose={() => setModalMasterFechado(true)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 13.5, color: COLORS.cinza, lineHeight: 1.5 }}>
              Passou do prazo e ainda falta, em Estoque:
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
              {pendenciasParaMaster.map((p) => (
                <li key={p} style={{ fontSize: 14, color: COLORS.vermelho, fontWeight: 600 }}>{p}</li>
              ))}
            </ul>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
              <Btn onClick={() => setModalMasterFechado(true)}>Entendi</Btn>
            </div>
          </div>
        </Modal>
      )}

      <BarraFiltros
        dados={dados} filtros={filtros} setFiltros={setFiltros} limpar={limpar} intervalo={intervalo}
        campos={["agrupar", "empresa", "rede", "cliente", "fruta", "produto"]}
        meses={meses} frutas={frutas} empresas={EMPRESAS}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
        <Indicador rotulo="Receita" valor={brl(acumulado.receita)} sub={`${kg(acumulado.kg)} vendidos`} pct={vs("receita")} cor={COLORS.azul} />
        {recorte.parcial ? (
          <Indicador rotulo="Margem bruta estimada" valor={brl(acumulado.margemBruta)}
            sub={`${pct(acumulado.margemPct)} da receita${acumulado.custoParcial ? " · *custo parcial" : ""}`}
            pct={vs("margemBruta")} cor={acumulado.margemBruta >= 0 ? COLORS.verde : COLORS.vermelho} />
        ) : (
          <Indicador rotulo="Resultado" valor={brl(acumulado.resultado)} sub={`margem de ${pct(acumulado.margem)}`}
            pct={vs("resultado")} cor={acumulado.resultado >= 0 ? COLORS.verde : COLORS.vermelho} />
        )}
        <Indicador rotulo="Pedidos" valor={acumulado.pedidos} sub={`${acumulado.clientes} clientes atendidos`} pct={vs("pedidos")} />
        <Indicador rotulo="Ticket médio" valor={brl(acumulado.ticketMedio)} sub={`${brl(acumulado.precoMedio)} / kg`} pct={vs("ticketMedio")} />
        <Indicador rotulo="Vendas hoje" valor={vendasHoje.length}
          sub={brl(vendasHoje.reduce((s, v) => s + v.total, 0))
            + (aCarregar.length > 0 ? ` · ${aCarregar.length} a carregar (${brl(aCarregar.reduce((s, v) => s + v.total, 0))})` : "")}
          cor={COLORS.laranja} />
        <Indicador rotulo="A receber" valor={brl(aReceber)} sub={vencidas.length ? `${vencidas.length} já vencida(s)` : `${pendentes.length} em dia`}
          cor={vencidas.length ? COLORS.vermelho : COLORS.laranjaEscuro} />
      </div>

      {/* O PAINEL GERENCIAL da planilha, calculado sozinho a cada lançamento */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <h4 style={{ margin: "0 0 4px", color: COLORS.cinzaEscuro, fontSize: 15 }}>Painel Gerencial</h4>
            <p style={{ margin: 0, fontSize: 12.5, color: COLORS.cinza, maxWidth: 720 }}>
              {descricaoRecorte}
              {recorte.parcial
                ? " · despesas e compras não são lançadas por cliente, rede ou produto: aqui a conta é receita − custo estimado da fruta (kg vendido × custo médio de compra). A despesa entra diluída: kg vendido × custo da operação por kg da empresa no período. Filtrando por fruta, o resultado após operação desconta a fruta comprada no período, não o custo estimado."
                : filtros.empresa && filtros.empresa !== EMPRESA_PADRAO
                  ? ` · só ${nomeDaEmpresa(filtros.empresa)}: receita − mercadoria. Despesas, combustível e folha são da CVC.`
                  : " · receita − despesas − mercadoria = resultado. Despesas incluem combustível e folha. Custo operação / kg = despesas ÷ kg vendidos — é ele que dilui a despesa por fruta nas tabelas abaixo."}
            </p>
          </div>
          <BotoesExportar aoExportarXlsx={() => exportarPainel("xlsx")} aoExportarPdf={() => exportarPainel("pdf")} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 18 }}>
          {gerencial.map(([rotulo, valor, cor, base]) => (
            <ValorComBase key={rotulo} rotulo={rotulo} valor={valor} cor={cor} base={base} />
          ))}
        </div>
        {acumulado.custoParcial && (
          <p style={{ margin: "14px 0 0", fontSize: 11.5, color: COLORS.cinza }}>
            * Alguma fruta vendida não tem compra registrada, então o custo dela não entrou na margem bruta.
          </p>
        )}
      </Card>

      <Card>
        <h4 style={{ margin: "0 0 4px", color: COLORS.cinzaEscuro, fontSize: 15 }}>Receita e margem bruta</h4>
        <p style={{ margin: "0 0 12px", fontSize: 12.5, color: COLORS.cinza }}>
          {AGRUPAMENTOS.find((a) => a.value === filtros.agrupar)?.label} · {descricaoRecorte}
        </p>
        <GraficoColunas
          pontos={pontos}
          series={[
            { chave: "receita", rotulo: "Receita", cor: CORES_SERIE.receita },
            { chave: "margemBruta", rotulo: "Margem bruta est.", cor: CORES_SERIE.resultado },
          ]}
        />
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <FiltroPills
          opcoes={DIMENSOES_VENDA.map((d) => ({ valor: d.valor, rotulo: `Por ${d.rotulo.toLowerCase()}` }))}
          selecionado={dimensao}
          aoSelecionar={setDimensao}
        />
        <Ranking
          key={dimensao}
          titulo={`Vendas por ${rotuloDimensao.toLowerCase()}`}
          subtitulo={`${descricaoRecorte} · clique no título de uma coluna para ordenar`}
          linhas={ranking}
          colunas={colunasRanking}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        <Card>
          <h4 style={{ margin: "0 0 16px", color: COLORS.cinzaEscuro, fontSize: 15 }}>Últimos Pedidos do Recorte</h4>
          {ultVendas.length === 0 ? (
            <div style={{ color: COLORS.cinza, textAlign: "center", padding: 24, fontSize: 14 }}>
              Nenhuma venda no período e filtros escolhidos.
            </div>
          ) : (
            <TabelaRolavel>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
                <thead>
                  <tr>
                    {["#", "Cliente", "Data", "Kg", "Total", "Status"].map((h) => (
                      <th key={h} style={{ textAlign: "left", fontSize: 11, color: COLORS.cinza, paddingBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ultVendas.map((v) => (
                    <tr key={v.id} style={{ borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
                      <td style={{ padding: "10px 0", fontSize: 13, color: COLORS.cinza }}>#{v.numero ?? "—"}</td>
                      <td style={{ padding: "10px 4px", fontSize: 13, color: COLORS.cinzaEscuro, maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {nomeDoCliente(dados, v.lojaId)}
                      </td>
                      <td style={{ padding: "10px 4px", fontSize: 12, color: COLORS.cinza }}>{formatarData(v.data)}</td>
                      <td style={{ padding: "10px 4px", fontSize: 12, color: COLORS.cinza }}>{kg(v.kgTotal)}</td>
                      <td style={{ padding: "10px 4px", fontSize: 13, fontWeight: 600, color: COLORS.verde }}>{brl(v.total)}</td>
                      <td style={{ padding: "10px 0" }}><Badge status={v.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabelaRolavel>
          )}
        </Card>

        <Card>
          <h4 style={{ margin: "0 0 16px", color: COLORS.cinzaEscuro, fontSize: 15 }}>Estoque por Fruta</h4>
          {saldos.map((s) => {
            const negativo = s.estoque < 0;
            const cor = negativo ? COLORS.vermelho : s.estoque === 0 ? COLORS.cinza : COLORS.verdeClaro;
            // A barra mostra quanto do que entrou ainda está em estoque.
            const pctEstoque = s.entradas > 0 ? Math.min(100, Math.max(0, (s.estoque / s.entradas) * 100)) : 0;
            return (
              <div key={s.fruta} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: COLORS.cinzaEscuro, fontWeight: 500 }}>{s.fruta}</span>
                  <span style={{ color: negativo ? COLORS.vermelho : COLORS.cinza, fontSize: 12 }}>
                    {kg(s.estoque)} {negativo ? "⚠️" : ""}
                  </span>
                </div>
                <div style={{ background: COLORS.cinzaClaro, borderRadius: 99, height: 6 }}>
                  <div style={{ width: `${negativo ? 100 : pctEstoque}%`, background: cor, height: 6, borderRadius: 99, transition: "width 0.4s" }} />
                </div>
                {s.entradas > 0 && (
                  <div style={{ fontSize: 11, color: COLORS.cinza, marginTop: 3 }}>
                    entrou {kg(s.entradas)} · saiu {kg(s.vendas + s.perdas)}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
};

// ─── Clientes: redes e suas lojas ────────────────────────────────────────────
//
// Rede e loja têm a mesma ficha cadastral (razão social, CNPJ, IE, contato,
// endereço) — ver src/lib/cadastro.js. Clicar numa loja abre a ficha dela com
// o histórico de compras; clicar no nome da rede abre a ficha da rede.

/** Resumo acima do Salvar quando a ficha tem erro: o que falta, sem rolar a tela. */
const AvisoCorrigir = ({ erros, semNome, semRede }) => {
  const itens = [
    ...(semRede ? ["Escolha a rede."] : []),
    ...(semNome ? ["Informe o nome."] : []),
    ...Object.values(erros),
  ];
  return (
    <div style={{ background: "#FFEBEE", border: `1px solid ${COLORS.vermelho}55`, borderRadius: 8, padding: "10px 12px", fontSize: 13, color: COLORS.vermelho }}>
      <strong>Não dá para salvar ainda — {itens.length === 1 ? "1 item" : `${itens.length} itens`} a corrigir:</strong>
      <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
        {itens.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </div>
  );
};

const redeVazia = () => ({ nome: "", status: "ativo", produtosPedido: [], taxas: [], ...cadastroVazio() });
const lojaVazia = (redeId = "") => ({ redeId, nome: "", status: "ativo", produtosPedido: [], taxas: [], ...cadastroVazio() });

const listaProdutos = (v) => (Array.isArray(v) ? v : []);

/**
 * Quais produtos o cliente vê no link de pedido. Lista vazia quer dizer
 * "todos" na rede e "os mesmos da rede" na loja — só se marca produto a
 * produto quando o cliente não pode receber oferta de algum (PETROX não
 * recebe abóbora).
 */
const ProdutosDoLink = ({ produtos, valor, aoMudar, daRede }) => {
  const escolhidos = listaProdutos(valor);
  const herdados = daRede === undefined ? null : listaProdutos(daRede);
  const restrito = escolhidos.length > 0;
  const ordenados = [...produtos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const nomes = (ids) => ordenados.filter((p) => ids.includes(p.id)).map((p) => p.nome).join(", ");
  const rotuloTodos = herdados === null
    ? "Todos os produtos"
    : herdados.length ? `Os mesmos da rede (${nomes(herdados)})` : "Os mesmos da rede (todos os produtos)";

  const restringir = () => aoMudar(herdados?.length ? herdados : ordenados.map((p) => p.id));
  const alternar = (id) => {
    const nova = escolhidos.includes(id) ? escolhidos.filter((x) => x !== id) : [...escolhidos, id];
    if (nova.length) aoMudar(nova); // o último não desmarca: aí seria "todos"
  };

  const opcao = (ativo, rotulo, onClick) => (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: COLORS.cinzaEscuro, cursor: "pointer" }}>
      <input type="radio" checked={ativo} onChange={onClick} style={{ marginTop: 2 }} />
      <span>{rotulo}</span>
    </label>
  );

  return (
    <div style={{ border: `1.5px solid ${COLORS.cinzaClaro}`, borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.cinzaEscuro }}>Produtos no link de pedido</div>
      <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: -4 }}>O que este cliente vê quando faz o pedido sozinho pelo link.</div>
      {opcao(!restrito, rotuloTodos, () => aoMudar([]))}
      {opcao(restrito, "Só estes:", restringir)}
      {restrito && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 6, paddingLeft: 22 }}>
          {ordenados.map((p) => {
            const marcado = escolhidos.includes(p.id);
            const ultimo = marcado && escolhidos.length === 1;
            return (
              <label key={p.id} title={ultimo ? "Pelo menos um produto" : undefined}
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: COLORS.cinzaEscuro, cursor: ultimo ? "not-allowed" : "pointer" }}>
                <input type="checkbox" checked={marcado} disabled={ultimo} onChange={() => alternar(p.id)} />
                {p.nome}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * Taxas que o cliente cobra da distribuidora — caixas IFCO, taxa de CD, taxa
 * de antecipação. Na rede valem para todas as lojas; na loja valem no lugar
 * da da rede para o mesmo tipo (valor 0 desliga a da rede só para essa loja).
 */
const TaxasDoCliente = ({ valor, aoMudar, daRede }) => {
  const lista = Array.isArray(valor) ? valor : [];
  const herdadas = taxasDaLoja({ taxas: daRede }, null);
  const mudar = (i, campos) => aoMudar(lista.map((t, k) => (k === i ? { ...t, ...campos } : t)));
  return (
    <div style={{ border: `1.5px solid ${COLORS.cinzaClaro}`, borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.cinzaEscuro }}>Taxas e custos deste cliente</div>
      <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: -6, lineHeight: 1.45 }}>
        Caixas IFCO, taxa de CD, taxa de antecipação… Saem do resultado de cada pedido (Painel e Financeiro).
        {daRede !== undefined && (herdadas.length
          ? ` Da rede: ${herdadas.map((t) => `${rotuloDaTaxa(t)} ${t.modo === "percentual" ? `${t.valor}%` : brl(t.valor)}`).join(", ")}. O que você lançar aqui vale no lugar, para o mesmo tipo.`
          : " A rede não tem taxas cadastradas.")}
      </div>
      {lista.map((t, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(120px, 1.3fr) minmax(110px, 1fr) 90px 28px", gap: 8, alignItems: "end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Select value={t.tipo} onChange={(e) => mudar(i, { tipo: e.target.value })}
              options={TIPOS_TAXA.map((x) => ({ value: x.value, label: x.rotulo }))} />
            {t.tipo === "outra" && <Input placeholder="Nome da taxa" value={t.nome ?? ""} onChange={(e) => mudar(i, { nome: e.target.value })} />}
          </div>
          <Select value={t.modo} onChange={(e) => mudar(i, { modo: e.target.value })}
            options={MODOS_TAXA.map((x) => ({ value: x.value, label: x.rotulo }))} />
          <Input type="number" inputMode="decimal" min="0" step="any" placeholder={t.modo === "percentual" ? "%" : "R$"}
            value={t.valor ?? ""} onChange={(e) => mudar(i, { valor: e.target.value })} />
          <button type="button" aria-label="Remover taxa" onClick={() => aoMudar(lista.filter((_, k) => k !== i))}
            style={{ background: "none", border: "none", color: COLORS.vermelho, fontSize: 20, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
        </div>
      ))}
      <button type="button" onClick={() => aoMudar([...lista, { tipo: "cd", modo: "percentual", valor: "" }])}
        style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, color: COLORS.verde, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
        + Adicionar taxa
      </button>
    </div>
  );
};

/** Detalhe de um pedido (itens, preços, total, caixas IFCO) — usado em Vendas e no Romaneio. */
const DetalhePedidoModal = ({ venda: d, dados, setDados, aviso, onClose }) => (
  <Modal title={`Pedido #${d.numero ?? "—"}`} onClose={onClose}>
    <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: COLORS.cinzaEscuro }}>
      <div><strong>{nomeDoCliente(dados, d.lojaId)}</strong> · {formatarData(d.data)}</div>
      {aviso && <div style={{ fontSize: 12, color: COLORS.cinza }}>{aviso}</div>}
      {d.itens.map((i) => {
        const p = dados.produtos.find((x) => x.id === i.produtoId);
        const bonif = i.natureza === "bonificacao";
        return (
          <div key={chaveDoItem(i)} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span>
              {p?.nome} × {i.qty} {rotuloUnidade(p, i.qty, i.unidade)} <span style={{ color: COLORS.cinza }}>({kg(i.kgTotal)})</span>
              {!bonif && (
                <span style={{ display: "block", fontSize: 11, color: COLORS.cinza }}>
                  {brl(i.precoUnitario)}/{rotuloUnidade(p, 1, i.unidade)}
                  {Number(i.kgTotal) > 0 && Number(i.qty) > 0 && <> · {brl((i.qty * i.precoUnitario) / i.kgTotal)}/kg</>}
                </span>
              )}
            </span>
            <strong>{bonif ? "—" : brl(i.qty * i.precoUnitario)}</strong>
          </div>
        );
      })}
      <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${COLORS.cinzaClaro}`, paddingTop: 8 }}>
        <span>Total</span><strong style={{ color: COLORS.verde }}>{brl(d.total)}</strong>
      </div>
      <CaixasIfcoDoPedido key={`${d.id}-${d.caixasIfco ?? 0}`} venda={d} setDados={setDados} />
    </div>
  </Modal>
);

/**
 * Caixas IFCO de um pedido que já tem NF-e: os itens e preços ficam travados
 * (são fiscais), mas a quantidade de caixas não está na nota — pode ser
 * lançada ou corrigida a qualquer hora, e refaz a taxa por caixa do pedido.
 */
const CaixasIfcoDoPedido = ({ venda, setDados }) => {
  const [valor, setValor] = useState(venda.caixasIfco ? String(venda.caixasIfco) : "");
  const novo = Math.max(0, Math.round(Number(String(valor).replace(",", ".")) || 0));
  const mudou = novo !== (Number(venda.caixasIfco) || 0);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", borderTop: `1px solid ${COLORS.cinzaClaro}`, paddingTop: 10 }}>
      <div style={{ flex: 1 }}>
        <Input label="Caixas IFCO (não mexe na nota)" type="number" inputMode="numeric" min="0" step="1" placeholder="0 = não usou IFCO"
          value={valor} onChange={(e) => setValor(e.target.value)} />
      </div>
      <Btn disabled={!mudou}
        onClick={() => setDados((d) => ({ ...d, vendas: d.vendas.map((v) => (v.id === venda.id ? { ...v, caixasIfco: novo } : v)) }))}>
        Salvar
      </Btn>
    </div>
  );
};

/**
 * Link único que reúne TODAS as redes e lojas ativas (/pedido/geral/<token>)
 * — para a equipe (ex.: vendedor externo) lançar o pedido de qualquer
 * cliente sem abrir o app. Diferente do link da loja/rede, não é ficha de um
 * registro: o token é buscado direto da nuvem, sem cópia offline em `dados`.
 */
const LinkDePedidoGeral = () => {
  const [mostrar, setMostrar] = useState(false);
  const [estado, setEstado] = useState({ tentado: false, token: null, erro: null });
  const [aviso, setAviso] = useState(null);
  const [renovando, setRenovando] = useState(false);

  useEffect(() => {
    if (!mostrar || !supabaseConfigurado || estado.tentado) return undefined;
    let cancelado = false;
    buscarTokenPedidoGeral()
      .then((t) => { if (!cancelado) setEstado({ tentado: true, token: t, erro: null }); })
      .catch((e) => { if (!cancelado) setEstado({ tentado: true, token: null, erro: e.message }); });
    return () => { cancelado = true; };
  }, [mostrar, estado.tentado]);

  if (!supabaseConfigurado) return null;

  const { token, erro } = estado;
  const link = linkDePedidoGeral(token);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setAviso("Link copiado.");
    } catch {
      window.prompt("Copie o link:", link);
    }
  };

  const renovar = async () => {
    if (!confirm("Gerar um link geral novo?\n\nO link antigo para de funcionar na hora — mande o novo para a equipe.")) return;
    setRenovando(true);
    try {
      const novo = await renovarLinkPedidoGeral();
      setEstado({ tentado: true, token: novo, erro: null });
      setAviso("Link novo gerado. O antigo não funciona mais.");
    } catch (e) {
      alert(`Não deu para gerar o link novo:\n${e.message}`);
    } finally {
      setRenovando(false);
    }
  };

  return (
    <div>
      <Btn variant="ghost" onClick={() => setMostrar((m) => !m)} style={{ padding: "6px 12px", fontSize: 13 }}>
        {mostrar ? "Ocultar link geral de pedidos" : "Link geral de pedidos (todas as redes e lojas)"}
      </Btn>
      {mostrar && (
        <div style={{ background: COLORS.verdePale, borderRadius: 10, padding: "12px 14px", marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.verde }}>Link geral de pedidos</div>
          <div style={{ fontSize: 12, color: COLORS.cinzaEscuro, lineHeight: 1.45 }}>
            Reúne <strong>todas as redes e lojas ativas</strong> num link só — para a equipe, não para o cliente: mostra
            o nome de todo mundo cadastrado. Busca a rede ou a loja e cada uma escolhida vira um pedido separado em <strong>Vendas</strong>.
          </div>
          {erro && <div style={{ fontSize: 12, color: COLORS.vermelho, fontWeight: 600 }}>{erro}</div>}
          {!erro && link && (
            <>
              <code style={{ fontSize: 12, background: COLORS.branco, borderRadius: 6, padding: "6px 8px", wordBreak: "break-all", color: COLORS.cinzaEscuro }}>{link}</code>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Btn variant="secondary" onClick={copiar} style={{ padding: "6px 12px", fontSize: 13 }}>Copiar link</Btn>
                <Btn variant="ghost" onClick={renovar} disabled={renovando} style={{ padding: "5px 12px", fontSize: 13 }}>
                  {renovando ? "Gerando…" : "Gerar novo link"}
                </Btn>
              </div>
              {aviso && <div role="status" style={{ fontSize: 12, color: COLORS.verde, fontWeight: 600 }}>{aviso}</div>}
            </>
          )}
          {!erro && !link && <div style={{ fontSize: 12, color: COLORS.cinzaEscuro }}>Buscando o link…</div>}
        </div>
      )}
    </div>
  );
};

/** Só os campos de formulário de um registro já salvo (sem id de rede etc.). */
const paraFormulario = (item, vazio) =>
  Object.fromEntries(Object.keys(vazio).map((k) => [k, item[k] ?? ""]).concat([["id", item.id]]));

/**
 * O link que a loja usa para fazer pedido sozinha (página /pedido/<token>).
 * O pedido cai na aba Vendas como "Pedido do cliente", para conferir.
 *
 * Com `daRede`, é o link da rede inteira (/pedido/rede/<token>), para o grupo
 * com os gerentes: uma página com todas as lojas, e cada loja vira um pedido.
 */
const DO_LINK = {
  loja: { colecao: "lojas", buscar: buscarTokenPedido, renovar: renovarLinkPedido, link: linkDePedido },
  rede: { colecao: "redes", buscar: buscarTokenPedidoRede, renovar: renovarLinkPedidoRede, link: linkDePedidoRede },
};

const LinkDePedido = ({ loja, rede, produtos, setDados, daRede = false }) => {
  const tipo = daRede ? "rede" : "loja";
  const { colecao, buscar, renovar: renovarToken, link: montarLink } = DO_LINK[tipo];
  const alvo = daRede ? rede : loja;
  const guardarToken = useCallback(
    (token) => setDados((d) => ({ ...d, [colecao]: d[colecao].map((x) => (x.id === alvo.id ? { ...x, tokenPedido: token } : x)) })),
    [setDados, colecao, alvo.id]
  );
  const [aviso, setAviso] = useState(null);
  const [renovando, setRenovando] = useState(false);
  // Sem o token na cópia local, pergunta à nuvem — e diz o que falta, em vez de esperar à toa.
  const [buscado, setBuscado] = useState({ id: null, token: null, erro: null });
  const precisaBuscar = supabaseConfigurado && !alvo.tokenPedido;

  useEffect(() => {
    if (!precisaBuscar) return undefined;
    let cancelado = false;
    buscar(alvo.id)
      .then((token) => {
        if (cancelado) return;
        setBuscado({ id: alvo.id, token, erro: null });
        if (token) guardarToken(token);
      })
      .catch((e) => { if (!cancelado) setBuscado({ id: alvo.id, token: null, erro: e.message }); });
    return () => { cancelado = true; };
  }, [precisaBuscar, alvo.id, buscar, guardarToken]);

  const doBusca = buscado.id === alvo.id ? buscado : { token: null, erro: null };
  const link = montarLink(alvo.tokenPedido || doBusca.token);

  if (!supabaseConfigurado) return null;

  const mensagem = daRede
    ? `Olá! Este é o link para fazer os pedidos das lojas ${rede.nome} com a Carvalho Cruz. Dá para pedir para várias lojas de uma vez:\n${link}`
    : `Olá! Este é o link para fazer os pedidos da ${rede?.nome ?? ""} ${loja.nome} com a Carvalho Cruz:\n${link}`;
  const telefone = soDigitos((daRede ? rede?.telefone : loja.telefone || rede?.telefone) || "");
  const whatsapp = `https://wa.me/${telefone ? (telefone.length <= 11 ? `55${telefone}` : telefone) : ""}?text=${encodeURIComponent(mensagem)}`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setAviso("Link copiado.");
    } catch {
      window.prompt("Copie o link:", link);
    }
  };

  const renovar = async () => {
    if (!confirm(`Gerar um link novo para ${alvo.nome}?\n\nO link antigo para de funcionar na hora — mande o novo para o cliente.`)) return;
    setRenovando(true);
    try {
      const token = await renovarToken(alvo.id);
      guardarToken(token);
      setAviso("Link novo gerado. O antigo não funciona mais.");
    } catch (e) {
      alert(`Não deu para gerar o link novo:\n${e.message}`);
    } finally {
      setRenovando(false);
    }
  };

  return (
    <div style={{ background: COLORS.verdePale, borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.verde }}>{daRede ? "Link de pedido da rede" : "Link de pedido do cliente"}</div>
      {link ? (
        <>
          <div style={{ fontSize: 12, color: COLORS.cinzaEscuro, lineHeight: 1.45 }}>
            {daRede
              ? <>Mande no grupo dos gerentes: o link mostra <strong>todas as lojas</strong> da rede e dá para pedir para várias de uma vez — cada loja entra em <strong>Vendas</strong> como um pedido separado.</>
              : <>Mande para a loja: ela faz o pedido sozinha, sem login, e ele entra em <strong>Vendas</strong> para conferir.</>}
          </div>
          <div style={{ fontSize: 12, color: COLORS.cinzaEscuro }}>
            <strong>Produtos no link:</strong> {(() => {
              const ids = !daRede && listaProdutos(loja.produtosPedido).length ? loja.produtosPedido : listaProdutos(rede?.produtosPedido);
              return ids.length
                ? produtos.filter((p) => ids.includes(p.id)).map((p) => p.nome).sort((a, b) => a.localeCompare(b, "pt-BR")).join(", ")
                : "todos";
            })()}
            {" "}<span style={{ color: COLORS.cinza }}>{daRede ? "(loja com lista própria mostra a dela; muda em Editar)" : "(muda em Editar)"}</span>
          </div>
          <code style={{ fontSize: 12, background: COLORS.branco, borderRadius: 6, padding: "6px 8px", wordBreak: "break-all", color: COLORS.cinzaEscuro }}>{link}</code>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn variant="secondary" onClick={copiar} style={{ padding: "6px 12px", fontSize: 13 }}>Copiar link</Btn>
            <a href={whatsapp} target="_blank" rel="noreferrer"
              style={{ background: "#25D366", color: COLORS.branco, borderRadius: 8, padding: "6px 12px", fontSize: 13, fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center" }}>
              Enviar pelo WhatsApp
            </a>
            <Btn variant="ghost" onClick={renovar} disabled={renovando} style={{ padding: "5px 12px", fontSize: 13 }}>
              {renovando ? "Gerando…" : "Gerar novo link"}
            </Btn>
          </div>
          {aviso && <div role="status" style={{ fontSize: 12, color: COLORS.verde, fontWeight: 600 }}>{aviso}</div>}
        </>
      ) : (
        <div style={{ fontSize: 12, color: doBusca.erro ? COLORS.vermelho : COLORS.cinzaEscuro, fontWeight: doBusca.erro ? 600 : 400 }}>
          {doBusca.erro
            ?? (buscado.id === alvo.id
              ? `Esta ${tipo} ainda não subiu para a nuvem — sincronize (aba Sincronização) e abra de novo.`
              : "Buscando o link…")}
        </div>
      )}
    </div>
  );
};

const Clientes = ({ dados, setDados, podeRemover }) => {
  const [busca, setBusca] = useState("");
  const [modalRede, setModalRede] = useState(false);
  const [modalLoja, setModalLoja] = useState(false);
  const [lojaAberta, setLojaAberta] = useState(null); // id da loja com a ficha aberta
  const [redeAberta, setRedeAberta] = useState(null); // id da rede com a ficha aberta
  const [formRede, setFormRede] = useState(redeVazia);
  const [formLoja, setFormLoja] = useState(lojaVazia);

  const loja = lojaAberta ? dados.lojas.find((l) => l.id === lojaAberta) : null;
  const redeDetalhe = redeAberta ? dados.redes.find((r) => r.id === redeAberta) : null;

  const historico = useMemo(
    () => (lojaAberta ? historicoDaLoja(dados, lojaAberta) : null),
    [dados, lojaAberta]
  );

  const termo = busca.trim().toLowerCase();
  const [soPendentes, setSoPendentes] = useState(false);

  /** Lojas ativas cujo cadastro ainda não permite emitir NF-e → o que falta. */
  const pendenciasPorLoja = useMemo(() => {
    const m = new Map();
    for (const l of dados.lojas) {
      if (l.status === "inativo") continue;
      const p = pendenciasNfe(l);
      if (p.length) m.set(l.id, p);
    }
    return m;
  }, [dados.lojas]);

  const totalPorLoja = useMemo(() => {
    const porLoja = new Map();
    for (const v of dados.vendas) {
      if (v.status === "cancelado" || !v.lojaId) continue;
      porLoja.set(v.lojaId, (porLoja.get(v.lojaId) ?? 0) + receitaDaVenda(v));
    }
    return porLoja;
  }, [dados.vendas]);

  /** Cada rede com as lojas que casam com a busca e o quanto já comprou. */
  const grupos = useMemo(() => {
    // Busca também por CNPJ com ou sem pontuação.
    const termoDigitos = soDigitos(termo);
    const casa = (item) => {
      const texto = textoBuscavel(item);
      return texto.includes(termo) || (termoDigitos.length >= 4 && texto.includes(termoDigitos));
    };

    return dados.redes
      .map((rede) => {
        const todas = dados.lojas.filter((l) => l.redeId === rede.id);
        const redeCasa = casa(rede);
        const lojas = (termo && !redeCasa ? todas.filter(casa) : todas)
          .filter((l) => !soPendentes || pendenciasPorLoja.has(l.id));
        return {
          rede,
          lojas,
          total: todas.reduce((s, l) => s + (totalPorLoja.get(l.id) ?? 0), 0),
          visivel: soPendentes ? lojas.length > 0 : !termo || redeCasa || lojas.length > 0,
        };
      })
      .filter((g) => g.visivel)
      .sort((a, b) => b.total - a.total || a.rede.nome.localeCompare(b.rede.nome));
  }, [dados.redes, dados.lojas, totalPorLoja, termo, soPendentes, pendenciasPorLoja]);

  /** Nome do outro cliente que já usa este CNPJ, ou null. */
  const cnpjEmUso = (idProprio) => (cnpj) => {
    const d = soDigitos(cnpj);
    const rede = dados.redes.find((r) => r.id !== idProprio && soDigitos(r.cnpjCpf) === d);
    if (rede) return `a rede ${rede.nome}`;
    const l = dados.lojas.find((x) => x.id !== idProprio && soDigitos(x.cnpjCpf) === d);
    return l ? `a loja ${nomeDoCliente(dados, l.id)}` : null;
  };

  // Rede e loja salvam sem CNPJ nem endereço: só o formato do que foi
  // digitado é conferido. O que a SEFAZ exige é cobrado na emissão da NF-e
  // (pendenciasNfe) e a loja incompleta aparece marcada na lista.
  const errosRede = errosCadastro(formRede);
  const errosLoja = errosCadastro(formLoja);
  const [tentouRede, setTentouRede] = useState(false);
  const [tentouLoja, setTentouLoja] = useState(false);
  const podeSalvarRede = formRede.nome.trim() && Object.keys(errosRede).length === 0;
  const podeSalvarLoja = formLoja.nome.trim() && formLoja.redeId && Object.keys(errosLoja).length === 0;

  // ─── Rede ────────────────────────────────────────────────────────────────

  const abrirNovaRede = () => {
    setFormRede(redeVazia());
    setTentouRede(false);
    setModalRede(true);
  };

  const editarRede = (rede) => {
    setFormRede(paraFormulario(rede, redeVazia()));
    setTentouRede(false);
    setRedeAberta(null);
    setModalRede(true);
  };

  const salvarRede = () => {
    if (!podeSalvarRede) {
      setTentouRede(true);
      return;
    }
    const nome = formRede.nome.trim();
    // O banco não aceita duas redes com o mesmo nome (redes_nome_unico_idx).
    if (dados.redes.some((r) => r.id !== formRede.id && r.nome.trim().toLowerCase() === nome.toLowerCase())) {
      alert(`Já existe uma rede chamada ${nome}.`);
      return;
    }
    const ficha = { ...normalizarCadastro(formRede), nome, status: formRede.status, produtosPedido: listaProdutos(formRede.produtosPedido), taxas: limparTaxas(formRede.taxas) };
    if (formRede.id) {
      setDados((d) => ({ ...d, redes: d.redes.map((r) => (r.id === formRede.id ? { ...r, ...ficha } : r)) }));
    } else {
      setDados((d) => ({ ...d, redes: [...d.redes, { ...ficha, id: novoId(), criadoEm: new Date().toISOString() }] }));
    }
    setModalRede(false);
  };

  const removerRede = (rede) => {
    const lojas = dados.lojas.filter((l) => l.redeId === rede.id);
    if (lojas.length) {
      alert(`A rede ${rede.nome} ainda tem ${lojas.length} loja(s). Remova as lojas primeiro.`);
      return;
    }
    if (confirm(`Remover a rede ${rede.nome}?`)) {
      setDados((d) => ({ ...d, redes: d.redes.filter((r) => r.id !== rede.id) }));
    }
  };

  // ─── Loja ────────────────────────────────────────────────────────────────

  const abrirNovaLoja = (redeId = "") => {
    setFormLoja(lojaVazia(redeId));
    setTentouLoja(false);
    setRedeAberta(null);
    setModalLoja(true);
  };

  const editarLoja = (l) => {
    // Dado antigo do Omie com o complemento dentro do número ("1020 - LOJA
    // 01") já abre separado, para não travar o salvar.
    setFormLoja({ ...paraFormulario(l, lojaVazia()), redeId: l.redeId, ...separarNumero(l.numero, l.complemento) });
    setTentouLoja(false);
    setLojaAberta(null);
    setModalLoja(true);
  };

  /** Loja única de uma rede costuma ter a mesma ficha dela: copia tudo. */
  const copiarDadosDaRede = () => {
    const rede = dados.redes.find((r) => r.id === formLoja.redeId);
    if (!rede) return;
    setFormLoja((f) => ({ ...f, ...Object.fromEntries(CAMPOS_CADASTRO.map((c) => [c, rede[c] || f[c] || ""])) }));
  };

  const salvarLoja = () => {
    if (!podeSalvarLoja) {
      setTentouLoja(true);
      return;
    }
    const nome = formLoja.nome.trim();
    // O banco não aceita duas lojas com o mesmo nome na mesma rede.
    if (dados.lojas.some((l) => l.id !== formLoja.id && l.redeId === formLoja.redeId && l.nome.trim().toLowerCase() === nome.toLowerCase())) {
      alert(`Já existe uma loja ${nome} nesta rede.`);
      return;
    }
    const ficha = {
      ...normalizarCadastro(formLoja), nome, redeId: formLoja.redeId, status: formLoja.status,
      produtosPedido: listaProdutos(formLoja.produtosPedido),
      taxas: limparTaxas(formLoja.taxas),
    };
    if (formLoja.id) {
      setDados((d) => ({ ...d, lojas: d.lojas.map((l) => (l.id === formLoja.id ? { ...l, ...ficha } : l)) }));
    } else {
      setDados((d) => ({ ...d, lojas: [...d.lojas, { ...ficha, id: novoId(), criadoEm: new Date().toISOString() }] }));
    }
    setModalLoja(false);
  };

  const removerLoja = (l) => {
    const vendas = dados.vendas.filter((v) => v.lojaId === l.id).length;
    const aviso = vendas
      ? `A loja ${l.nome} tem ${vendas} venda(s) registrada(s), que ficarão sem cliente. Remover mesmo assim?`
      : `Remover a loja ${l.nome}?`;
    if (confirm(aviso)) {
      setDados((d) => ({ ...d, lojas: d.lojas.filter((x) => x.id !== l.id) }));
    }
  };

  // ─── Completar pela Receita ──────────────────────────────────────────────
  //
  // Os CNPJs das lojas vieram do Omie sem razão social. Um clique consulta a
  // Receita e preenche SÓ o que está vazio — nada do que já foi conferido é
  // sobrescrito.

  /** O que a Receita trouxe, só nos campos da ficha que ainda estão vazios. */
  const soVazios = (daReceita, item) =>
    Object.fromEntries(
      Object.entries(daReceita).filter(([k, v]) => CAMPOS_CADASTRO.includes(k) && v && !String(item[k] ?? "").trim())
    );

  const [completando, setCompletando] = useState(false);
  const [progressoLote, setProgressoLote] = useState(null); // { feito, total } durante o lote

  /** Consulta a Receita e grava só os campos vazios. Devolve a situação do CNPJ. */
  const aplicarReceita = async (colecao, item) => {
    const { situacao, ...daReceita } = await consultarCnpj(item.cnpjCpf);
    const vazios = soVazios(daReceita, item);
    if (Object.keys(vazios).length) {
      setDados((d) => ({ ...d, [colecao]: d[colecao].map((x) => (x.id === item.id ? { ...x, ...vazios } : x)) }));
    }
    return { situacao, preencheu: Object.keys(vazios).length > 0 };
  };

  const completarPelaReceita = async (colecao, item) => {
    setCompletando(true);
    try {
      const { situacao, preencheu } = await aplicarReceita(colecao, item);
      if (situacao && situacao !== "ATIVA") alert(`Atenção: situação do CNPJ na Receita — ${situacao}.`);
      else if (!preencheu) alert("A Receita não trouxe nada além do que já está cadastrado.");
    } catch (e) {
      alert(e.status === 404 ? "CNPJ não encontrado na Receita." : "Não foi possível consultar a Receita agora (sem internet?).");
    } finally {
      setCompletando(false);
    }
  };
  const botaoReceita = (colecao, item) =>
    ehCnpj(item.cnpjCpf) && !item.razaoSocial ? (
      <Btn variant="ghost" icon="search" disabled={completando || !!progressoLote} onClick={() => completarPelaReceita(colecao, item)}>
        {completando ? "Consultando..." : "Completar pela Receita"}
      </Btn>
    ) : null;

  /** Todo cliente com CNPJ e sem razão social — o que veio do Omie. */
  const semRazaoSocial = [
    ...dados.redes.map((item) => ["redes", item]),
    ...dados.lojas.map((item) => ["lojas", item]),
  ].filter(([, item]) => ehCnpj(item.cnpjCpf) && !item.razaoSocial);

  // Um por vez, com pausa: as APIs públicas limitam consultas por minuto.
  // CNPJ repetido (rede e loja matriz) é consultado uma vez só.
  const completarTodosPelaReceita = async () => {
    const fila = semRazaoSocial;
    if (!confirm(`Buscar na Receita a razão social de ${fila.length} cliente(s)? Só campos vazios são preenchidos. Leva cerca de ${Math.ceil(fila.length * 1.2 / 60)} minuto(s) — deixe esta tela aberta.`)) return;
    const cache = new Map();
    let ok = 0;
    const naoEncontrados = [];
    const falhas = [];
    const inativos = [];
    for (let i = 0; i < fila.length; i++) {
      setProgressoLote({ feito: i, total: fila.length });
      const [colecao, item] = fila[i];
      const nome = colecao === "lojas" ? nomeDoCliente(dados, item.id) : item.nome;
      const chave = soDigitos(item.cnpjCpf);
      try {
        if (!cache.has(chave)) {
          cache.set(chave, consultarCnpj(item.cnpjCpf));
          await new Promise((r) => setTimeout(r, 1000));
        }
        const { situacao, ...daReceita } = await cache.get(chave);
        const vazios = soVazios(daReceita, item);
        setDados((d) => ({ ...d, [colecao]: d[colecao].map((x) => (x.id === item.id ? { ...x, ...vazios } : x)) }));
        ok++;
        if (situacao && situacao !== "ATIVA") inativos.push(`${nome} (${situacao})`);
      } catch (e) {
        (e.status === 404 ? naoEncontrados : falhas).push(nome);
      }
    }
    setProgressoLote(null);
    const linhas = [`${ok} de ${fila.length} cliente(s) completados.`];
    if (inativos.length) linhas.push(`\nCNPJ não ativo na Receita:\n• ${inativos.join("\n• ")}`);
    if (naoEncontrados.length) linhas.push(`\nCNPJ não encontrado:\n• ${naoEncontrados.join("\n• ")}`);
    if (falhas.length) linhas.push(`\nNão foi possível consultar (tente de novo depois):\n• ${falhas.join("\n• ")}`);
    alert(linhas.join("\n"));
  };

  // ─── Exportação do cadastro ──────────────────────────────────────────────

  const colunasCadastro = [
    { chave: "rede", rotulo: "Rede" },
    { chave: "loja", rotulo: "Loja" },
    { chave: "razaoSocial", rotulo: "Razão Social" },
    { chave: "cnpjCpf", rotulo: "CNPJ / CPF" },
    { chave: "ie", rotulo: "Inscrição Estadual" },
    { chave: "contato", rotulo: "Responsável" },
    { chave: "telefone", rotulo: "Telefone" },
    { chave: "email", rotulo: "E-mail" },
    { chave: "cep", rotulo: "CEP" },
    { chave: "logradouro", rotulo: "Logradouro" },
    { chave: "numero", rotulo: "Número" },
    { chave: "complemento", rotulo: "Complemento" },
    { chave: "bairro", rotulo: "Bairro" },
    { chave: "cidade", rotulo: "Cidade" },
    { chave: "uf", rotulo: "UF" },
    { chave: "status", rotulo: "Status" },
    { chave: "observacoes", rotulo: "Observações" },
  ];
  const exportarCadastro = () => {
    const nomeRede = (id) => dados.redes.find((r) => r.id === id)?.nome ?? "";
    const redes = [...dados.redes].sort((a, b) => a.nome.localeCompare(b.nome)).map((r) => ({ ...r, rede: r.nome, loja: "" }));
    const lojas = [...dados.lojas]
      .map((l) => ({ ...l, rede: nomeRede(l.redeId), loja: l.nome }))
      .sort((a, b) => a.rede.localeCompare(b.rede) || a.loja.localeCompare(b.loja));
    return exportarXlsx("clientes-carvalho-cruz", [
      { nome: "Lojas", colunas: colunasCadastro, linhas: lojas },
      { nome: "Redes", colunas: colunasCadastro.filter((c) => c.chave !== "loja"), linhas: redes },
    ]);
  };

  const opcoesStatus = [{ value: "ativo", label: "Ativo" }, { value: "inativo", label: "Inativo" }];
  const lojasDaRedeDetalhe = redeDetalhe ? dados.lojas.filter((l) => l.redeId === redeDetalhe.id) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 340 }}>
          <div style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }}>
            <Icon name="search" color={COLORS.cinza} size={16} />
          </div>
          <input
            placeholder="Buscar rede, loja, CNPJ, cidade..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ paddingLeft: 36, paddingRight: 14, paddingTop: 9, paddingBottom: 9, border: `1.5px solid ${COLORS.cinzaClaro}`, borderRadius: 8, fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {(semRazaoSocial.length > 0 || progressoLote) && (
            <Btn variant="ghost" icon="search" disabled={!!progressoLote || completando} onClick={completarTodosPelaReceita}>
              {progressoLote
                ? `Consultando ${progressoLote.feito + 1} de ${progressoLote.total}...`
                : `Completar razão social (${semRazaoSocial.length})`}
            </Btn>
          )}
          <Btn variant="ghost" onClick={() => exportarCadastro().catch((e) => alert(`Não foi possível gerar o arquivo: ${e?.message ?? e}`))}>
            Exportar .xlsx
          </Btn>
          <Btn variant="ghost" icon="plus" onClick={() => abrirNovaLoja()}>Nova Loja</Btn>
          <Btn icon="plus" onClick={abrirNovaRede}>Nova Rede</Btn>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 13, color: COLORS.cinza }}>
          {dados.redes.length} redes · {dados.lojas.length} lojas · clique numa loja ou no nome da rede para ver a ficha completa
        </div>
        <LinkDePedidoGeral />
      </div>

      {(pendenciasPorLoja.size > 0 || soPendentes) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", background: "#FFF8E1", border: "1px solid #F0C36D", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#7A5A00" }}>
          <span>
            <strong>{pendenciasPorLoja.size} {pendenciasPorLoja.size === 1 ? "loja ativa" : "lojas ativas"}</strong> com cadastro incompleto para NF-e
            (CNPJ, inscrição estadual ou endereço). A nota delas será recusada até corrigir.
          </span>
          <Btn variant="ghost" onClick={() => setSoPendentes((v) => !v)} style={{ padding: "6px 12px", fontSize: 13 }}>
            {soPendentes ? "Mostrar todas" : "Mostrar só essas"}
          </Btn>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(330px, 100%), 1fr))", gap: 16 }}>
        {grupos.map(({ rede, lojas, total }) => (
          <Card key={rede.id} style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 18px", borderBottom: `1px solid ${COLORS.cinzaClaro}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div role="button" tabIndex={0} onClick={() => setRedeAberta(rede.id)}
                onKeyDown={(e) => { if (e.key === "Enter") setRedeAberta(rede.id); }}
                style={{ minWidth: 0, cursor: "pointer" }} title="Ver ficha da rede">
                <div style={{ fontWeight: 800, color: COLORS.cinzaEscuro, fontSize: 15 }}>{rede.nome}</div>
                {(rede.razaoSocial || rede.cnpjCpf) && (
                  <div style={{ fontSize: 11, color: COLORS.cinza, marginTop: 2 }}>
                    {[rede.razaoSocial, rede.cnpjCpf].filter(Boolean).join(" · ")}
                  </div>
                )}
                <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: 2 }}>
                  {lojas.length} {lojas.length === 1 ? "loja" : "lojas"}
                  {total > 0 && <> · <span style={{ color: COLORS.verde, fontWeight: 600 }}>{brl(total)}</span></>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <Badge status={rede.status} />
                <button onClick={() => editarRede(rede)} title="Editar rede"
                  style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.5, padding: 2 }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}>
                  <Icon name="edit" color={COLORS.verde} size={15} />
                </button>
                {podeRemover && (
                  <button onClick={() => removerRede(rede)} title="Remover rede"
                    style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.4, padding: 2 }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}>
                    <Icon name="trash" color={COLORS.vermelho} size={15} />
                  </button>
                )}
              </div>
            </div>

            <div style={{ flex: 1, padding: "8px 0" }}>
              {lojas.length === 0 ? (
                <div style={{ padding: "14px 18px", fontSize: 13, color: COLORS.cinza }}>Nenhuma loja cadastrada.</div>
              ) : lojas.map((l) => {
                const local = [l.bairro, l.cidade].filter(Boolean).join(", ");
                return (
                  <div key={l.id}
                    role="button" tabIndex={0} onClick={() => setLojaAberta(l.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") setLojaAberta(l.id); }}
                    style={{ padding: "8px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.creme)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: COLORS.cinzaEscuro, fontWeight: 500 }}>
                        {l.nome}
                        {l.status === "inativo" && <span style={{ fontSize: 11, color: COLORS.cinza, fontWeight: 400 }}> · inativa</span>}
                        {pendenciasPorLoja.has(l.id) && (
                          <span title={`Falta para NF-e: ${pendenciasPorLoja.get(l.id).join("; ")}`}
                            style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#7A5A00", background: "#FFF3CD", borderRadius: 4, padding: "1px 5px" }}>
                            ⚠ NF-e
                          </span>
                        )}
                      </div>
                      {(l.cnpjCpf || local || l.telefone) && (
                        <div style={{ fontSize: 11, color: COLORS.cinza }}>
                          {[l.cnpjCpf, local, l.telefone].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>
                    {podeRemover && (
                      <button onClick={(e) => { e.stopPropagation(); removerLoja(l); }} title="Remover loja"
                        style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.35, padding: 2, flexShrink: 0 }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.35")}>
                        <Icon name="trash" color={COLORS.vermelho} size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button onClick={() => abrirNovaLoja(rede.id)}
              style={{ padding: "10px 18px", background: COLORS.verdePale, border: "none", borderTop: `1px solid ${COLORS.cinzaClaro}`, cursor: "pointer", color: COLORS.verde, fontWeight: 600, fontSize: 13, textAlign: "left" }}>
              + Loja nesta rede
            </button>
          </Card>
        ))}
      </div>

      {grupos.length === 0 && (
        <Card><div style={{ padding: 30, textAlign: "center", color: COLORS.cinza }}>Nenhuma rede ou loja encontrada.</div></Card>
      )}

      {/* ─── Cadastro / edição de rede ─── */}
      {modalRede && (
        <Modal title={formRede.id ? `Editar Rede — ${formRede.nome}` : "Nova Rede"} onClose={() => setModalRede(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {!formRede.id && (
              <div style={{ fontSize: 13, color: COLORS.cinza, lineHeight: 1.5 }}>
                A rede é o grupo com quem você negocia preço e prazo — PETROX, MIX MATEUS — e de quem se cobra.
                Use o CNPJ da matriz. As lojas dela entram em seguida.
              </div>
            )}
            <Input label="Nome da Rede *" value={formRede.nome} onChange={(e) => setFormRede((f) => ({ ...f, nome: e.target.value }))} placeholder="PETROX" />
            <Select label="Status" value={formRede.status} onChange={(e) => setFormRede((f) => ({ ...f, status: e.target.value }))} options={opcoesStatus} />
            <CamposCadastro form={formRede} setForm={setFormRede} erros={errosRede} cnpjEmUso={cnpjEmUso(formRede.id)} tentou={tentouRede} />
            <ProdutosDoLink produtos={dados.produtos} valor={formRede.produtosPedido}
              aoMudar={(v) => setFormRede((f) => ({ ...f, produtosPedido: v }))} />
            <TaxasDoCliente valor={formRede.taxas} aoMudar={(v) => setFormRede((f) => ({ ...f, taxas: v }))} />
            {tentouRede && !podeSalvarRede && <AvisoCorrigir erros={errosRede} semNome={!formRede.nome.trim()} />}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn variant="secondary" onClick={() => setModalRede(false)}>Cancelar</Btn>
              <Btn onClick={salvarRede}>{formRede.id ? "Salvar Alterações" : "Salvar Rede"}</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Cadastro / edição de loja ─── */}
      {modalLoja && (
        <Modal title={formLoja.id ? `Editar Loja — ${formLoja.nome}` : "Nova Loja"} onClose={() => setModalLoja(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Select label="Rede *" value={formLoja.redeId} onChange={(e) => setFormLoja((f) => ({ ...f, redeId: e.target.value }))}
              options={[{ value: "", label: "Selecione a rede..." }, ...[...dados.redes].sort((a, b) => a.nome.localeCompare(b.nome)).map((r) => ({ value: r.id, label: r.nome }))]} />
            <Input label="Nome da Loja *" value={formLoja.nome} onChange={(e) => setFormLoja((f) => ({ ...f, nome: e.target.value }))} placeholder="P.CAJU" />
            <Select label="Status" value={formLoja.status} onChange={(e) => setFormLoja((f) => ({ ...f, status: e.target.value }))} options={opcoesStatus} />
            {formLoja.redeId && (
              <button type="button" onClick={copiarDadosDaRede}
                style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, color: COLORS.verde, fontWeight: 600, fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>
                Copiar dados cadastrais da rede
              </button>
            )}
            <CamposCadastro form={formLoja} setForm={setFormLoja} erros={errosLoja} cnpjEmUso={cnpjEmUso(formLoja.id)} nfe tentou={tentouLoja} />
            <ProdutosDoLink produtos={dados.produtos} valor={formLoja.produtosPedido}
              daRede={dados.redes.find((r) => r.id === formLoja.redeId)?.produtosPedido ?? []}
              aoMudar={(v) => setFormLoja((f) => ({ ...f, produtosPedido: v }))} />
            <TaxasDoCliente valor={formLoja.taxas} daRede={dados.redes.find((r) => r.id === formLoja.redeId)?.taxas ?? []}
              aoMudar={(v) => setFormLoja((f) => ({ ...f, taxas: v }))} />
            {tentouLoja && !podeSalvarLoja && (
              <AvisoCorrigir erros={errosLoja} semNome={!formLoja.nome.trim()} semRede={!formLoja.redeId} />
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn variant="secondary" onClick={() => setModalLoja(false)}>Cancelar</Btn>
              <Btn onClick={salvarLoja}>{formLoja.id ? "Salvar Alterações" : "Salvar Loja"}</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Ficha da rede ─── */}
      {redeDetalhe && (
        <Modal title={redeDetalhe.nome} onClose={() => setRedeAberta(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <FichaCadastral item={redeDetalhe} extra={
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ fontSize: 11, color: COLORS.cinza, textTransform: "uppercase", letterSpacing: 0.4 }}>Status</div>
                <div><Badge status={redeDetalhe.status} /></div>
              </div>
            } />
            <LinkDePedido rede={redeDetalhe} produtos={dados.produtos} setDados={setDados} daRede />
            <div>
              <h4 style={{ margin: "0 0 10px", color: COLORS.cinzaEscuro, fontSize: 14 }}>
                Lojas ({lojasDaRedeDetalhe.length})
              </h4>
              {lojasDaRedeDetalhe.length === 0 ? (
                <div style={{ fontSize: 13, color: COLORS.cinza }}>Nenhuma loja cadastrada.</div>
              ) : lojasDaRedeDetalhe.map((l) => (
                <div key={l.id} role="button" tabIndex={0}
                  onClick={() => { setRedeAberta(null); setLojaAberta(l.id); }}
                  onKeyDown={(e) => { if (e.key === "Enter") { setRedeAberta(null); setLojaAberta(l.id); } }}
                  style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, padding: "7px 0", borderTop: `1px solid ${COLORS.cinzaClaro}`, cursor: "pointer" }}>
                  <span style={{ color: COLORS.cinzaEscuro, fontWeight: 500 }}>{l.nome}</span>
                  <span style={{ color: COLORS.cinza, textAlign: "right" }}>
                    {[l.cnpjCpf, l.cidade].filter(Boolean).join(" · ") || "sem dados cadastrais"}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              {botaoReceita("redes", redeDetalhe)}
              <Btn variant="ghost" icon="plus" onClick={() => abrirNovaLoja(redeDetalhe.id)}>Nova Loja</Btn>
              <Btn variant="ghost" icon="edit" onClick={() => editarRede(redeDetalhe)}>Editar</Btn>
              <Btn variant="secondary" onClick={() => setRedeAberta(null)}>Fechar</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Ficha da loja + histórico de compras ─── */}
      {loja && historico && (
        <Modal title={nomeDoCliente(dados, loja.id)} onClose={() => setLojaAberta(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <FichaCadastral item={loja} extra={
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ fontSize: 11, color: COLORS.cinza, textTransform: "uppercase", letterSpacing: 0.4 }}>Status</div>
                <div><Badge status={loja.status} /></div>
              </div>
            } />

            {pendenciasPorLoja.has(loja.id) && (
              <div style={{ background: "#FFF8E1", border: "1px solid #F0C36D", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#7A5A00" }}>
                <strong>Não dá para emitir NF-e para esta loja ainda:</strong>
                <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                  {pendenciasPorLoja.get(loja.id).map((p) => <li key={p}>{p}</li>)}
                </ul>
                <div style={{ marginTop: 6 }}>Clique em <strong>Editar</strong> para completar.</div>
              </div>
            )}

            <LinkDePedido loja={loja} rede={dados.redes.find((r) => r.id === loja.redeId)} produtos={dados.produtos} setDados={setDados} />

            <h4 style={{ margin: 0, color: COLORS.cinzaEscuro, fontSize: 15 }}>Histórico de compras</h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
              {[
                ["Comprado", brl(historico.totalComprado), COLORS.verde],
                ["Pedidos", historico.pedidos, COLORS.cinzaEscuro],
                ["Ticket médio", brl(historico.ticketMedio), COLORS.cinzaEscuro],
                ["Quilos", kg(historico.kgTotal), COLORS.cinzaEscuro],
                ["A receber", brl(historico.aReceber), historico.vencido > 0 ? COLORS.vermelho : COLORS.laranjaEscuro],
              ].map(([rotulo, valor, cor]) => (
                <div key={rotulo}>
                  <div style={{ fontSize: 11, color: COLORS.cinza, textTransform: "uppercase", letterSpacing: 0.4 }}>{rotulo}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: cor, marginTop: 3 }}>{valor}</div>
                </div>
              ))}
            </div>

            {historico.vencido > 0 && (
              <div style={{ background: "#FFEBEE", border: `1px solid ${COLORS.vermelho}55`, borderRadius: 8, padding: "9px 12px", fontSize: 13, color: COLORS.vermelho }}>
                <strong>{brl(historico.vencido)}</strong> já vencido(s).
              </div>
            )}

            {historico.porProduto.length > 0 && (
              <div>
                <h4 style={{ margin: "0 0 10px", color: COLORS.cinzaEscuro, fontSize: 14 }}>Por Produto</h4>
                {historico.porProduto.map((p) => (
                  <div key={p.produto} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
                    <span style={{ color: COLORS.cinzaEscuro }}>{p.produto}</span>
                    <span style={{ color: COLORS.cinza }}>{kg(p.kg)} · <strong style={{ color: COLORS.cinzaEscuro }}>{brl(p.valor)}</strong></span>
                  </div>
                ))}
              </div>
            )}

            <div>
              <h4 style={{ margin: "0 0 10px", color: COLORS.cinzaEscuro, fontSize: 14 }}>Pedidos</h4>
              {historico.vendas.length === 0 ? (
                <div style={{ fontSize: 13, color: COLORS.cinza }}>Nenhum pedido registrado ainda.</div>
              ) : (
                <TabelaRolavel>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 420 }}>
                    <thead>
                      <tr>
                        {["#", "Data", "Kg", "Total", "Status"].map((h) => (
                          <th key={h} style={{ textAlign: "left", fontSize: 11, color: COLORS.cinza, padding: "6px 8px 6px 0", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {historico.vendas.map((v) => (
                        <tr key={v.id} style={{ borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
                          <td style={{ padding: "8px 8px 8px 0", fontSize: 13, color: COLORS.cinza }}>#{v.numero ?? "—"}</td>
                          <td style={{ padding: "8px 8px 8px 0", fontSize: 13, color: COLORS.cinza }}>{formatarData(v.data)}</td>
                          <td style={{ padding: "8px 8px 8px 0", fontSize: 13, color: COLORS.cinza }}>{kg(v.kgTotal)}</td>
                          <td style={{ padding: "8px 8px 8px 0", fontSize: 13, fontWeight: 600, color: COLORS.verde }}>{brl(v.total)}</td>
                          <td style={{ padding: "8px 0" }}><Badge status={v.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TabelaRolavel>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              {botaoReceita("lojas", loja)}
              <Btn variant="ghost" icon="edit" onClick={() => editarLoja(loja)}>Editar</Btn>
              <Btn variant="secondary" onClick={() => setLojaAberta(null)}>Fechar</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── Fornecedores ────────────────────────────────────────────────────────────
const Fornecedores = ({ dados, setDados }) => {
  const [busca, setBusca] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nome: "", telefone: "", produto: "", cidade: "", status: "ativo" });

  const filtrados = dados.fornecedores.filter((f) =>
    f.nome.toLowerCase().includes(busca.toLowerCase()) || f.produto.toLowerCase().includes(busca.toLowerCase())
  );

  const salvar = () => {
    if (!form.nome.trim()) return;
    setDados((d) => ({ ...d, fornecedores: [...d.fornecedores, { ...form, id: novoId(), criadoEm: new Date().toISOString() }] }));
    setModal(false);
    setForm({ nome: "", telefone: "", produto: "", cidade: "", status: "ativo" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }}>
            <Icon name="search" color={COLORS.cinza} size={16} />
          </div>
          <input
            placeholder="Buscar fornecedores..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ paddingLeft: 36, paddingRight: 14, paddingTop: 9, paddingBottom: 9, border: `1.5px solid ${COLORS.cinzaClaro}`, borderRadius: 8, fontSize: 14, outline: "none", width: 240 }}
          />
        </div>
        <Btn icon="plus" onClick={() => setModal(true)}>Novo Fornecedor</Btn>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {filtrados.map((f) => (
          <Card key={f.id} style={{ position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: COLORS.verdePale, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="leaf" color={COLORS.verde} size={20} />
              </div>
              <Badge status={f.status} />
            </div>
            <div style={{ fontWeight: 700, color: COLORS.cinzaEscuro, fontSize: 15, marginBottom: 4 }}>{f.nome}</div>
            <div style={{ fontSize: 13, color: COLORS.verde, fontWeight: 500, marginBottom: 8 }}>{f.produto}</div>
            <div style={{ fontSize: 12, color: COLORS.cinza }}>{f.cidade}</div>
            <div style={{ fontSize: 13, color: COLORS.cinza, marginTop: 4 }}>{f.telefone}</div>
          </Card>
        ))}
      </div>

      {modal && (
        <Modal title="Novo Fornecedor" onClose={() => setModal(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Input label="Nome / Razão Social *" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            <Input label="Telefone" value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />
            <Input label="Produto Principal" value={form.produto} onChange={(e) => setForm((f) => ({ ...f, produto: e.target.value }))} />
            <Input label="Cidade / Estado" value={form.cidade} onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))} />
            <Select label="Status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              options={[{ value: "ativo", label: "Ativo" }, { value: "inativo", label: "Inativo" }]} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn variant="secondary" onClick={() => setModal(false)}>Cancelar</Btn>
              <Btn onClick={salvar}>Salvar Fornecedor</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── Estoque ─────────────────────────────────────────────────────────────────
//
// O estoque deixou de ser um número digitado e virou conta:
//
//     estoque = compras − vendas − perdas
//
// Quando o saldo estiver errado, o erro está num lançamento — e dá para achar
// qual. Era o que faltava para explicar a abóbora com −50,40 kg na planilha:
// saiu mais do que entrou, e não havia onde procurar.
//
// Aqui também se registra a PERCA, porque perda é movimento de estoque.

/** Valor do select de fruta que abre o campo para digitar uma fruta nova. */
const NOVA_FRUTA = "__nova__";
const FISCAL_VAZIO = { ncm: "", cfopPadrao: "", unidadeOmie: "", codigo: "", origem: "0", icmsCst: "", icmsAliquota: "", pisCst: "", cofinsCst: "", cest: "", ean: "" };
const PRODUTO_VAZIO = {
  nome: "", fruta: "Laranja Pera", frutaNova: "", empresa: EMPRESA_PADRAO,
  unidadeVenda: "kg", kgPorUnidade: "1", kgPorCaixa: "", pesoMedioUnidade: "", ...FISCAL_VAZIO,
};

// Opções dos dados da NF-e. Só os códigos que o app sabe emitir sem alíquota
// entram no ICMS/PIS/COFINS (ver spedy.js); ICMS 00 pede a alíquota.
const CFOPS = [
  { value: "5.101", label: "5.101 — Venda de produção própria" },
  { value: "5.102", label: "5.102 — Revenda (mercadoria de terceiros)" },
];
const ORIGENS = [
  { value: "0", label: "0 — Nacional" },
  { value: "1", label: "1 — Estrangeira, importação direta" },
  { value: "2", label: "2 — Estrangeira, comprada no mercado interno" },
];
const CSTS_ICMS = [
  { value: "", label: "— não cadastrado —" },
  { value: "40", label: "40 — Isenta" },
  { value: "41", label: "41 — Não tributada" },
  { value: "60", label: "60 — ICMS já cobrado por substituição (ST)" },
  { value: "00", label: "00 — Tributada integralmente (com alíquota)" },
];
const CSTS_PIS_COFINS = [
  { value: "", label: "— não cadastrado —" },
  { value: "06", label: "06 — Alíquota zero" },
  { value: "07", label: "07 — Isenta" },
  { value: "08", label: "08 — Sem incidência" },
  { value: "04", label: "04 — Monofásica (revenda a alíquota zero)" },
  { value: "01", label: "01 — Tributável (emitir no painel do Spedy)" },
];
const UNIDADES_NOTA = ["KG", "UN", "BAG", "CX"];

/** Ordem dos produtos no pedido: CVC primeiro, depois os faturados pela Carvalho Cruz. */
const ordemNaVenda = (p) => (p.empresa === "carvalho_cruz" ? 1 : 0);

/** O que falta no produto para emitir NF-e pelo app. null = pronto. */
function pendenciaFiscal(p) {
  if (!p.ncm) return "sem NCM";
  try {
    tributacaoDoProduto(p);
  } catch (e) {
    if (/ainda não tem a tributação/.test(e.message)) return "sem tributação";
    if (/sem a alíquota/.test(e.message)) return "sem alíquota do ICMS";
    return "emitir no Spedy";
  }
  try {
    codigoDaNota(p);
    return null;
  } catch (e) {
    return /ainda não tem código/.test(e.message) ? "sem código" : "código inválido";
  }
}

const Estoque = ({ dados, setDados, podeGerir }) => {
  const [modalProduto, setModalProduto] = useState(false);
  const [modalPerda, setModalPerda] = useState(false);
  const [modalAcerto, setModalAcerto] = useState(false);
  const [formProduto, setFormProduto] = useState(PRODUTO_VAZIO);
  // id do produto aberto para edição; null é um produto novo.
  const [editandoProduto, setEditandoProduto] = useState(null);
  // Fruta sendo renomeada (só as que não são as de sempre) e o nome novo.
  const [renomear, setRenomear] = useState(null);
  const [formPerda, setFormPerda] = useState({ data: hojeISO(), fruta: "Laranja Pera", kg: "", custoKg: "", motivo: MOTIVOS_PERDA[0] });
  const [formAcerto, setFormAcerto] = useState({ data: hojeISO(), fruta: "Laranja Pera", kgContado: "", motivo: MOTIVOS_ACERTO[0] });
  const [modalContagem, setModalContagem] = useState(false);
  const [formContagem, setFormContagem] = useState({ data: hojeISO(), quantidades: {}, observacao: "" });
  const [modalPrecos, setModalPrecos] = useState(false);
  const [formPrecos, setFormPrecos] = useState({ data: hojeISO(), valores: {} });

  const saldos = useMemo(() => estoquePorFruta(dados), [dados]);
  const custos = useMemo(() => custoMedioPorFruta(dados.compras), [dados.compras]);
  // Todas as frutas, para o cadastro de produto; só as com estoque (Carvalho
  // Cruz) para perdas e contagens.
  const frutas = useMemo(() => frutasDe(dados), [dados]);
  const frutasEstoque = useMemo(() => frutasComEstoque(dados), [dados]);
  const empresaDaFruta = useMemo(() => empresaDasFrutas(dados.produtos), [dados.produtos]);
  const negativas = saldos.filter((s) => s.estoque < 0);

  // ─── Pedidos do dia seguinte ─────────────────────────────────────────────
  //
  // Quantos quilos já estão lançados para amanhã (ou outro dia escolhido),
  // para conferir na véspera se o estoque dá conta. Enquanto não são
  // carregados, esses pedidos continuam no saldo dos cartões (linha «A sair»).
  const [diaPedidos, setDiaPedidos] = useState(() => diaSeguinteISO());
  const pedidosDia = useMemo(() => pedidosDoDia(dados, diaPedidos), [dados, diaPedidos]);
  const ehAmanha = diaPedidos === diaSeguinteISO();
  const rotuloDia = ehAmanha ? "amanhã" : formatarData(diaPedidos);
  const frutasPedidas = [...pedidosDia.porFruta].sort((a, b) => b[1] - a[1]);

  // ─── Insumos de produção (redinha, grampo, etiquetas) ───────────────────
  //
  // Sem compra/venda para virar conta: o saldo é a última contagem física.
  // "Registrar contagem" abre uma linha por item de uma vez, como se faz no
  // depósito — não um item por vez.

  const saldosInsumos = useMemo(() => saldoDosInsumos(dados), [dados]);
  const insumosAtrasados = contagemInsumosAtrasada(saldosInsumos);
  const unidadePorInsumo = new Map(saldosInsumos.map((s) => [s.nome, s.unidade]));
  const contagensRecentes = [...(dados.contagens_insumos ?? [])]
    .sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.criadoEm).localeCompare(String(a.criadoEm)))
    .slice(0, 24);

  const abrirContagem = () => {
    const quantidades = {};
    for (const s of saldosInsumos) quantidades[s.nome] = s.quantidade === null ? "" : String(s.quantidade);
    setFormContagem({ data: hojeISO(), quantidades, observacao: "" });
    setModalContagem(true);
  };

  const podeSalvarContagem =
    !!formContagem.data && Object.values(formContagem.quantidades).some((v) => v !== "" && Number(v) >= 0);

  const salvarContagem = () => {
    if (!podeSalvarContagem) return;
    const criadoEm = new Date().toISOString();
    const novas = saldosInsumos
      .filter((s) => formContagem.quantidades[s.nome] !== "" && formContagem.quantidades[s.nome] !== undefined)
      .map((s) => ({
        id: novoId(),
        data: formContagem.data,
        item: s.nome,
        quantidade: Number(formContagem.quantidades[s.nome]) || 0,
        observacao: formContagem.observacao || "",
        criadoEm,
      }));
    if (novas.length === 0) return;
    setDados((d) => ({ ...d, contagens_insumos: [...(d.contagens_insumos ?? []), ...novas] }));
    setModalContagem(false);
  };

  const removerContagem = (c) => {
    if (confirm(`Remover a contagem de ${c.item} (${c.quantidade}) em ${formatarData(c.data)}?`)) {
      setDados((d) => ({ ...d, contagens_insumos: (d.contagens_insumos ?? []).filter((x) => x.id !== c.id) }));
    }
  };

  const salvarMinimoInsumo = (item, valor) => {
    const estoqueMinimo = Number(valor) || 0;
    setDados((d) => ({
      ...d,
      insumos_itens: (d.insumos_itens ?? []).map((i) => (i.id === item.id ? { ...i, estoqueMinimo } : i)),
    }));
  };

  // ─── Preços da semana (conferência de toda segunda) ─────────────────────
  //
  // Não é o preço da venda (esse é digitado em cada uma): é a referência que
  // se confirma ou ajusta toda semana, POR PRODUTO — o agranel e cada saco
  // (2,5 kg, 3 kg, 5 kg, 10 kg) têm preço próprio, não um preço só por
  // fruta. "Confirmar" e "editar" são a mesma ação — salvar o valor do
  // campo, mudado ou não.

  const produtosPrecificar = useMemo(() => produtosParaPrecificar(dados), [dados]);
  const precosAtuais = useMemo(() => precoAtualPorProduto(dados), [dados]);
  const precosRecentes = [...(dados.precos_produtos ?? [])]
    .sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.criadoEm).localeCompare(String(a.criadoEm)))
    .slice(0, 24);

  const abrirPrecos = () => {
    const valores = {};
    for (const p of produtosPrecificar) {
      const atual = precosAtuais.get(p.nome);
      valores[p.nome] = atual ? String(atual.preco) : "";
    }
    setFormPrecos({ data: hojeISO(), valores });
    setModalPrecos(true);
  };

  const podeSalvarPrecos =
    !!formPrecos.data && Object.values(formPrecos.valores).some((v) => v !== "" && Number(v) >= 0);

  const salvarPrecos = () => {
    if (!podeSalvarPrecos) return;
    const criadoEm = new Date().toISOString();
    const novos = produtosPrecificar
      .filter((p) => formPrecos.valores[p.nome] !== "" && formPrecos.valores[p.nome] !== undefined)
      .map((p) => ({
        id: novoId(),
        produto: p.nome,
        preco: Number(formPrecos.valores[p.nome]) || 0,
        data: formPrecos.data,
        criadoEm,
      }));
    if (novos.length === 0) return;
    setDados((d) => ({ ...d, precos_produtos: [...(d.precos_produtos ?? []), ...novos] }));
    setModalPrecos(false);
  };

  const removerPreco = (p) => {
    if (confirm(`Remover o preço de ${p.produto} (${brl(p.preco)}) registrado em ${formatarData(p.data)}?`)) {
      setDados((d) => ({ ...d, precos_produtos: (d.precos_produtos ?? []).filter((x) => x.id !== p.id) }));
    }
  };

  const perdasRecentes = [...dados.perdas]
    .sort((a, b) => String(b.data).localeCompare(String(a.data)))
    .slice(0, 12);
  const totalPerdido = dados.perdas.reduce((s, p) => s + p.valor, 0);

  const custoPerdaPrevia = (Number(formPerda.kg) || 0) * (Number(formPerda.custoKg) || 0);
  const podeSalvarPerda = Number(formPerda.kg) > 0 && formPerda.data;

  /** O custo médio da fruta entra sozinho, mas continua editável. */
  const escolherFrutaDaPerda = (fruta) =>
    setFormPerda((f) => ({ ...f, fruta, custoKg: (custos.get(fruta) ?? 0).toFixed(4) }));

  const abrirPerda = () => {
    const fruta = "Laranja Pera";
    setFormPerda({ data: hojeISO(), fruta, kg: "", custoKg: (custos.get(fruta) ?? 0).toFixed(4), motivo: MOTIVOS_PERDA[0] });
    setModalPerda(true);
  };

  const salvarPerda = () => {
    if (!podeSalvarPerda) return;
    const quilos = Number(formPerda.kg);
    const custoKg = Number(formPerda.custoKg) || 0;
    const nova = {
      ...formPerda,
      id: novoId(),
      kg: quilos,
      custoKg,
      valor: quilos * custoKg,
      criadoEm: new Date().toISOString(),
    };
    setDados((d) => ({ ...d, perdas: [...d.perdas, nova] }));
    setModalPerda(false);
  };

  const removerPerda = (perda) => {
    if (confirm(`Remover a perda de ${kg(perda.kg)} de ${perda.fruta} em ${formatarData(perda.data)}?`)) {
      setDados((d) => ({ ...d, perdas: d.perdas.filter((x) => x.id !== perda.id) }));
    }
  };

  // ─── Acerto de inventário ────────────────────────────────────────────────
  //
  // Registra a CONTAGEM, não um ajuste solto. O saldo que a conta dava é
  // guardado junto, para o acerto poder ser explicado depois.

  const saldoDa = (fruta) => saldos.find((s) => s.fruta === fruta)?.estoque ?? 0;
  const kgSistemaAcerto = saldoDa(formAcerto.fruta);
  const aSairAcerto = saldos.find((s) => s.fruta === formAcerto.fruta)?.aSair ?? 0;
  const ajustePrevia =
    formAcerto.kgContado === "" ? null : Number(formAcerto.kgContado) - kgSistemaAcerto;
  const acertoViraPerda = formAcerto.motivo === MOTIVO_ACERTO_PERDA;
  // Perda só existe quando a contagem deu MENOS do que a conta.
  const perdaSemFalta = acertoViraPerda && ajustePrevia !== null && ajustePrevia >= 0;
  const podeSalvarAcerto =
    formAcerto.kgContado !== "" && Number(formAcerto.kgContado) >= 0 && formAcerto.data && !perdaSemFalta;

  const abrirAcerto = (fruta = "Laranja Pera") => {
    setFormAcerto({ data: hojeISO(), fruta, kgContado: "", motivo: MOTIVOS_ACERTO[0] });
    setModalAcerto(true);
  };

  const salvarAcerto = () => {
    if (!podeSalvarAcerto) return;
    const kgContado = Number(formAcerto.kgContado);
    const kgSistema = saldoDa(formAcerto.fruta);

    // Motivo «Perdas»: a falta entra como perda, ao custo médio de hoje, e não
    // como acerto — se entrasse nos dois, o estoque desceria duas vezes.
    if (formAcerto.motivo === MOTIVO_ACERTO_PERDA) {
      const quilos = kgSistema - kgContado;
      const custoKg = Number((custos.get(formAcerto.fruta) ?? 0).toFixed(4));
      const nova = {
        id: novoId(),
        data: formAcerto.data,
        fruta: formAcerto.fruta,
        kg: quilos,
        custoKg,
        valor: quilos * custoKg,
        motivo: "Contagem de estoque",
        criadoEm: new Date().toISOString(),
      };
      setDados((d) => ({ ...d, perdas: [...d.perdas, nova] }));
      setModalAcerto(false);
      return;
    }

    const novo = {
      ...formAcerto,
      id: novoId(),
      kgContado,
      kgSistema,
      ajuste: kgContado - kgSistema,
      criadoEm: new Date().toISOString(),
    };
    setDados((d) => ({ ...d, acertos: [...d.acertos, novo] }));
    setModalAcerto(false);
  };

  const removerAcerto = (a) => {
    if (confirm(`Remover o acerto de ${a.fruta} de ${formatarData(a.data)}? O estoque volta a ${kg(a.kgSistema)}.`)) {
      setDados((d) => ({ ...d, acertos: d.acertos.filter((x) => x.id !== a.id) }));
    }
  };

  const acertosRecentes = [...dados.acertos]
    .sort((a, b) => String(b.data).localeCompare(String(a.data)))
    .slice(0, 12);

  // ─── Cadastro de produto ─────────────────────────────────────────────────
  //
  // A fruta pode ser uma das que já existem ou uma nova, digitada na hora. A
  // empresa decide para quem vai a receita do produto; se a fruta já tem
  // produto, a empresa é a dela — o estoque é da fruta e não se divide.

  const frutaEscolhida = formProduto.fruta === NOVA_FRUTA
    ? formProduto.frutaNova.trim().replace(/\s+/g, " ")
    : formProduto.fruta;
  // Digitar "laranja pera" é escolher a Laranja Pera, não criar outra.
  const frutaFinal = frutas.find((f) => f.toLowerCase() === frutaEscolhida.toLowerCase()) ?? frutaEscolhida;
  // Os outros produtos da mesma fruta: no cadastro eles decidem a empresa; na
  // edição, trocar a empresa leva todos eles junto.
  const irmaos = dados.produtos.filter((p) => p.fruta === frutaFinal && p.id !== editandoProduto);
  const empresaTravada = editandoProduto ? null : empresaDaFruta.get(frutaFinal);
  const empresaProduto = empresaTravada ?? formProduto.empresa;
  const levaIrmaos = !!editandoProduto && irmaos.some((p) => (p.empresa ?? EMPRESA_PADRAO) !== empresaProduto);
  // O código sai na NF-e e identifica o produto: não pode se repetir.
  const codigoNormalizado = formProduto.codigo.trim().toUpperCase();
  const produtoComMesmoCodigo = codigoNormalizado
    ? dados.produtos.find((p) => p.id !== editandoProduto && (p.codigo ?? "").trim().toUpperCase() === codigoNormalizado)
    : null;
  const podeSalvarProduto = formProduto.nome.trim() && frutaFinal && !produtoComMesmoCodigo;
  const campoProduto = (campo) => (e) => setFormProduto((f) => ({ ...f, [campo]: e.target.value }));

  // Próximo PRD livre: maior número já cadastrado + 1 (PRD00020 → PRD00021).
  // Produtos criados direto no Spedy não passam por aqui; o app não os enxerga.
  const proximoCodigo = () => {
    const maior = dados.produtos.reduce((m, p) => {
      const n = /^PRD(\d+)$/i.exec((p.codigo ?? "").trim());
      return n ? Math.max(m, Number(n[1])) : m;
    }, 0);
    return `PRD${String(maior + 1).padStart(5, "0")}`;
  };

  const abrirNovoProduto = () => {
    setEditandoProduto(null);
    setFormProduto({ ...PRODUTO_VAZIO, codigo: proximoCodigo() });
    setModalProduto(true);
  };

  const abrirEdicaoProduto = (p) => {
    setEditandoProduto(p.id);
    setFormProduto({
      nome: p.nome,
      fruta: p.fruta ?? "Laranja Pera",
      frutaNova: "",
      empresa: p.empresa ?? EMPRESA_PADRAO,
      unidadeVenda: p.unidadeVenda,
      kgPorUnidade: String(p.kgPorUnidade ?? 1),
      kgPorCaixa: p.kgPorCaixa ? String(p.kgPorCaixa) : "",
      pesoMedioUnidade: p.pesoMedioUnidade ? String(p.pesoMedioUnidade) : "",
      ncm: p.ncm ?? "",
      cfopPadrao: p.cfopPadrao ?? "",
      unidadeOmie: p.unidadeOmie ?? "",
      codigo: p.codigo ?? "",
      origem: p.origem === null || p.origem === undefined ? "0" : String(p.origem),
      icmsCst: p.icmsCst ?? "",
      icmsAliquota: p.icmsAliquota === null || p.icmsAliquota === undefined ? "" : String(p.icmsAliquota),
      pisCst: p.pisCst ?? "",
      cofinsCst: p.cofinsCst ?? "",
      cest: p.cest ?? "",
      ean: p.ean ?? "",
    });
    setModalProduto(true);
  };

  const fecharProduto = () => {
    setModalProduto(false);
    setEditandoProduto(null);
    setFormProduto(PRODUTO_VAZIO);
  };

  // O preço não é do cadastro: varia muito e é digitado a cada venda.
  const salvarProduto = () => {
    if (!podeSalvarProduto) return;
    const emSaco = formProduto.unidadeVenda === "saco";
    // CFOP em branco: produção própria é 5.101; revenda (CVC), 5.102.
    const cfopPadrao = formProduto.cfopPadrao || "5.102";
    const campos = {
      nome: formProduto.nome.trim(),
      fruta: frutaFinal,
      empresa: empresaProduto,
      unidadeVenda: formProduto.unidadeVenda,
      kgPorUnidade: emSaco ? Number(formProduto.kgPorUnidade) || 1 : 1,
      kgPorCaixa: Number(String(formProduto.kgPorCaixa).replace(",", ".")) > 0 ? Number(String(formProduto.kgPorCaixa).replace(",", ".")) : null,
      pesoMedioUnidade: Number(String(formProduto.pesoMedioUnidade).replace(",", ".")) > 0 ? Number(String(formProduto.pesoMedioUnidade).replace(",", ".")) : null,
      ncm: formProduto.ncm.trim(),
      cfopPadrao,
      unidadeOmie: formProduto.unidadeOmie.trim().toUpperCase() || (emSaco ? "BAG" : "KG"),
      codigo: formProduto.codigo.trim(),
      origem: Number(formProduto.origem) || 0,
      icmsCst: formProduto.icmsCst,
      // Alíquota só vale no ICMS tributado; nos outros CSTs fica vazia.
      icmsAliquota: formProduto.icmsCst === "00" && formProduto.icmsAliquota !== "" ? Number(formProduto.icmsAliquota) : null,
      pisCst: formProduto.pisCst,
      cofinsCst: formProduto.cofinsCst,
      cest: formProduto.cest.trim(),
      ean: formProduto.ean.trim(),
    };

    if (!editandoProduto) {
      const novo = { ...campos, id: novoId(), criadoEm: new Date().toISOString(), preco: 0 };
      // O peso da caixa é da fruta: vale para todos os produtos dela.
      setDados((d) => ({
        ...d,
        produtos: [...d.produtos.map((p) => (p.fruta === frutaFinal
          ? { ...p, kgPorCaixa: campos.kgPorCaixa ?? p.kgPorCaixa, pesoMedioUnidade: campos.pesoMedioUnidade ?? p.pesoMedioUnidade }
          : p)), novo],
      }));
      fecharProduto();
      return;
    }

    if (levaIrmaos && !confirm(
      `${frutaFinal} passa a ser da ${nomeDaEmpresa(empresaProduto)} — junto com ${irmaos.map((p) => p.nome).join(", ")}. ` +
      "O estoque é da fruta, então todos os produtos dela mudam de empresa. Continuar?"
    )) return;

    setDados((d) => ({
      ...d,
      produtos: d.produtos.map((p) => {
        if (p.id === editandoProduto) return { ...p, ...campos };
        // Empresa e peso da caixa são da fruta: acompanham todos os produtos dela.
        if (p.fruta === frutaFinal) {
          return { ...p, ...(levaIrmaos ? { empresa: empresaProduto } : {}), kgPorCaixa: campos.kgPorCaixa, pesoMedioUnidade: campos.pesoMedioUnidade };
        }
        return p;
      }),
    }));
    fecharProduto();
  };

  // Excluir só produto que nunca foi vendido: apagar um com vendas deixaria
  // itens de pedido apontando para o nada (e a nota fiscal sem produto).
  const vendasDoProduto = editandoProduto
    ? dados.vendas.filter((v) => (v.itens ?? []).some((i) => i.produtoId === editandoProduto)).length
    : 0;

  const excluirProduto = () => {
    const produto = dados.produtos.find((p) => p.id === editandoProduto);
    if (!produto) return;
    if (vendasDoProduto > 0) {
      alert(
        `"${produto.nome}" já aparece em ${vendasDoProduto} venda(s) e não pode ser excluído — ` +
        "o histórico e as notas fiscais dependem dele. Se o nome está errado, corrija aqui mesmo."
      );
      return;
    }
    if (!confirm(`Excluir o produto "${produto.nome}"? Não dá para desfazer.`)) return;
    setDados((d) => ({ ...d, produtos: d.produtos.filter((p) => p.id !== editandoProduto) }));
    fecharProduto();
  };

  // ─── Renomear fruta ──────────────────────────────────────────────────────
  //
  // Só as frutas cadastradas depois: as três de sempre são fixas no app. O
  // nome muda em tudo que é dela — produtos, compras, perdas e acertos —
  // para o estoque continuar somando junto.

  const nomeNovo = renomear ? renomear.nome.trim().replace(/\s+/g, " ") : "";
  const nomeRepetido = !!renomear && frutas.some((f) => f !== renomear.fruta && f.toLowerCase() === nomeNovo.toLowerCase());
  const podeRenomear = !!renomear && nomeNovo && nomeNovo !== renomear.fruta && !nomeRepetido;

  const salvarRenomear = () => {
    if (!podeRenomear) return;
    const { fruta } = renomear;
    const trocar = (lista) => lista.map((x) => (x.fruta === fruta ? { ...x, fruta: nomeNovo } : x));
    setDados((d) => ({
      ...d,
      produtos: trocar(d.produtos),
      compras: trocar(d.compras),
      perdas: trocar(d.perdas),
      acertos: trocar(d.acertos),
    }));
    setRenomear(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {negativas.length > 0 && (
        <div style={{ background: "#FFEBEE", border: `1px solid ${COLORS.vermelho}55`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="alert" color={COLORS.vermelho} size={18} />
          <span style={{ color: COLORS.vermelho, fontSize: 14 }}>
            <strong>{negativas.map((s) => s.fruta).join(", ")}</strong> com estoque negativo —
            saiu mais do que entrou. Procure a compra que faltou lançar; se não achar,
            conte o que existe no depósito e registre um acerto.
          </span>
        </div>
      )}

      {/* Pedidos já lançados para o dia seguinte, em kg */}
      <Card style={{ borderLeft: `4px solid ${COLORS.laranja}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: COLORS.cinzaEscuro }}>Pedidos para {rotuloDia}</h3>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: COLORS.cinza }}>
              O que já foi lançado em Vendas com a data de {formatarData(diaPedidos)}. Enquanto não são carregados, eles continuam no estoque de cada fruta, na linha «A sair».
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <Input label="Dia" type="date" value={diaPedidos} onChange={(e) => setDiaPedidos(e.target.value || diaSeguinteISO())} />
            {!ehAmanha && <Btn variant="ghost" onClick={() => setDiaPedidos(diaSeguinteISO())}>Amanhã</Btn>}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <span style={{ fontSize: 30, fontWeight: 800, color: pedidosDia.totalKg > 0 ? COLORS.laranjaEscuro : COLORS.cinza, lineHeight: 1.1 }}>
            {pedidosDia.totalKg.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
            <span style={{ fontSize: 15, fontWeight: 400, color: COLORS.cinza }}> kg</span>
          </span>
          <span style={{ fontSize: 13, color: COLORS.cinza }}>
            {pedidosDia.pedidos} pedido(s) · {pedidosDia.clientes} cliente(s)
            {pedidosDia.totalCaixas > 0 && <> · <strong style={{ color: COLORS.cinzaEscuro }}>{rotuloCaixas(pedidosDia.totalCaixas)}</strong></>}
          </span>
        </div>

        {pedidosDia.pedidos === 0 ? (
          <div style={{ fontSize: 13, color: COLORS.cinza, marginTop: 8 }}>Nenhum pedido lançado para {rotuloDia} ainda.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginTop: 14 }}>
            {frutasPedidas.map(([fruta, quilos]) => {
              const saldo = saldos.find((s) => s.fruta === fruta);
              // «livre»: o que sobra depois que todo pedido ainda não carregado sair.
              const falta = saldo && saldo.livre < 0 ? -saldo.livre : 0;
              const produtos = pedidosDia.porProduto.filter((p) => p.fruta === fruta);
              return (
                <div key={fruta} style={{ border: `1px solid ${falta > 0 ? COLORS.vermelho + "88" : COLORS.cinzaClaro}`, borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontWeight: 700, color: COLORS.cinzaEscuro, fontSize: 14 }}>{fruta}</span>
                    <span style={{ fontWeight: 800, color: COLORS.laranjaEscuro, fontSize: 14 }}>
                      {kg(quilos)}
                      {pedidosDia.caixasPorFruta.get(fruta) > 0 && <span style={{ fontWeight: 600, color: COLORS.cinza, fontSize: 12.5 }}> · {rotuloCaixas(pedidosDia.caixasPorFruta.get(fruta))}</span>}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 6 }}>
                    {produtos.map((p) => (
                      <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5 }}>
                        <span style={{ color: COLORS.cinza }}>
                          {p.nome}
                          {(p.produto?.unidadeVenda === "saco" || p.unidade === "un") &&
                            ` · ${p.qty.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${rotuloUnidade(p.produto, p.qty, p.unidade)}`}
                        </span>
                        <span style={{ color: COLORS.cinzaEscuro, fontWeight: 500, whiteSpace: "nowrap" }}>{kg(p.kg)}</span>
                      </div>
                    ))}
                  </div>
                  {saldo && (
                    <div style={{ marginTop: 8, paddingTop: 6, borderTop: `1px dashed ${COLORS.cinzaClaro}`, fontSize: 12.5,
                      display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ color: COLORS.cinza }}>{falta > 0 ? "Falta no estoque" : "Sobra depois dos pedidos"}</span>
                      <span style={{ color: falta > 0 ? COLORS.vermelho : COLORS.verde, fontWeight: 700 }}>
                        {kg(falta > 0 ? falta : saldo.livre)}{falta > 0 ? " ⚠️" : ""}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Saldo por fruta: a conta inteira, aberta */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {saldos.map((s) => {
          const negativo = s.estoque < 0;
          const cor = negativo ? COLORS.vermelho : s.estoque === 0 ? COLORS.cinza : COLORS.verde;
          return (
            <Card key={s.fruta} style={{ borderLeft: `4px solid ${cor}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <span style={{ fontWeight: 700, color: COLORS.cinzaEscuro, fontSize: 15 }}>{s.fruta}</span>
                  {podeGerir && !FRUTAS_PADRAO.includes(s.fruta) && (
                    <button onClick={() => setRenomear({ fruta: s.fruta, nome: s.fruta })} title="Renomear fruta"
                      style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.5, padding: 2, display: "flex" }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}>
                      <Icon name="edit" color={COLORS.verde} size={14} />
                    </button>
                  )}
                </span>
                {empresaDaFruta.get(s.fruta) === "carvalho_cruz" && <ChipEmpresa empresa="carvalho_cruz" />}
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, color: cor, marginTop: 6, lineHeight: 1.1 }}>
                {s.estoque.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                <span style={{ fontSize: 15, fontWeight: 400, color: COLORS.cinza }}> kg</span>
              </div>

              <div style={{ marginTop: 14, borderTop: `1px solid ${COLORS.cinzaClaro}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                {[
                  ["Comprado", s.entradas, COLORS.verde, "+"],
                  ["Vendido", s.vendas, COLORS.cinzaEscuro, "−"],
                  ["Perdido", s.perdas, COLORS.laranjaEscuro, "−"],
                ].map(([rotulo, valor, corLinha, sinal]) => (
                  <div key={rotulo} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                    <span style={{ color: COLORS.cinza }}>{rotulo}</span>
                    <span style={{ color: corLinha, fontWeight: 500 }}>{sinal} {kg(valor)}</span>
                  </div>
                ))}
                {(pedidosDia.porFruta.get(s.fruta) ?? 0) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: COLORS.laranjaEscuro }}>
                    <span>pedidos p/ {rotuloDia}</span>
                    <span style={{ fontWeight: 600 }}>{kg(pedidosDia.porFruta.get(s.fruta))}</span>
                  </div>
                )}
                {s.bonificado > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: COLORS.cinza }}>
                    <span>dos quais bonificados</span>
                    <span>{kg(s.bonificado)}</span>
                  </div>
                )}
                {s.aSair > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginTop: 2, paddingTop: 5, borderTop: `1px dashed ${COLORS.cinzaClaro}` }}
                    title="Pedidos lançados que ainda não foram carregados no caminhão nem retirados no CD. A mercadoria continua no depósito e entra na contagem; baixa do estoque quando o QR for escaneado no carregamento.">
                    <span style={{ color: COLORS.cinza }}>
                      A sair ({s.pedidosASair} pedido{s.pedidosASair === 1 ? "" : "s"} não carregado{s.pedidosASair === 1 ? "" : "s"})
                    </span>
                    <span style={{ color: COLORS.laranjaEscuro, fontWeight: 500 }}>{kg(s.aSair)}</span>
                  </div>
                )}
                {s.aSair > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: COLORS.cinza }}>
                    <span>livre depois do carregamento</span>
                    <span style={{ color: s.livre < 0 ? COLORS.vermelho : COLORS.cinza }}>{kg(s.livre)}</span>
                  </div>
                )}
                {s.acertos !== 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                    <span style={{ color: COLORS.cinza }}>Acertado</span>
                    <span style={{ color: COLORS.azul, fontWeight: 500 }}>
                      {s.acertos > 0 ? "+" : "−"} {kg(Math.abs(s.acertos))}
                    </span>
                  </div>
                )}
                {custos.get(s.fruta) > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginTop: 4, paddingTop: 6, borderTop: `1px dashed ${COLORS.cinzaClaro}` }}>
                    <span style={{ color: COLORS.cinza }}>Custo em estoque</span>
                    <span style={{ color: COLORS.cinzaEscuro, fontWeight: 600 }}>
                      {brl(Math.max(0, s.estoque) * custos.get(s.fruta))}
                    </span>
                  </div>
                )}
              </div>

              {podeGerir && (
                <button onClick={() => abrirAcerto(s.fruta)}
                  style={{ marginTop: 12, width: "100%", padding: "7px 0", borderRadius: 7, cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                    border: negativo ? "none" : `1px solid ${COLORS.cinzaClaro}`,
                    background: negativo ? COLORS.vermelho : COLORS.branco,
                    color: negativo ? COLORS.branco : COLORS.cinza }}>
                  {negativo ? "Acertar estoque" : "Contar estoque"}
                </button>
              )}
            </Card>
          );
        })}
      </div>

      {/* Preços da semana: conferência de toda segunda-feira, por produto (fruta e sacos) */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 22px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: COLORS.cinzaEscuro }}>Preços da Semana</h3>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: COLORS.cinza }}>
              Não é o preço da venda — é a referência de cada produto (agranel e cada saco).
              Toda segunda, confirme (deixe igual) ou ajuste; o que não mudar continua valendo.
            </p>
          </div>
          {podeGerir && <Btn icon="plus" variant="ghost" onClick={abrirPrecos}>Conferir Preços</Btn>}
        </div>

        <div style={{ padding: "0 22px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          {produtosPrecificar.map((p) => {
            const atual = precosAtuais.get(p.nome);
            return (
              <div key={p.id} style={{ border: `1px solid ${COLORS.cinzaClaro}`, borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ fontWeight: 700, color: COLORS.cinzaEscuro, fontSize: 14 }}>{p.nome}</div>
                {p.nome !== p.fruta && <div style={{ fontSize: 11, color: COLORS.cinza }}>{p.fruta}</div>}
                <div style={{ fontSize: 22, fontWeight: 800, color: atual ? COLORS.verde : COLORS.cinza, marginTop: 4, lineHeight: 1.1 }}>
                  {atual ? brl(atual.preco) : "—"}
                </div>
                <div style={{ fontSize: 11.5, color: COLORS.cinza, marginTop: 3 }}>
                  {atual ? `Confirmado em ${formatarData(atual.data)}` : "Nunca conferido"}
                </div>
              </div>
            );
          })}
        </div>

        {precosRecentes.length > 0 && (
          <TabelaRolavel>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
              <thead style={{ background: COLORS.cinzaClaro }}>
                <tr>
                  {["Data", "Produto", "Preço", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", fontSize: 11.5, color: COLORS.cinza, padding: "10px 16px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {precosRecentes.map((p) => (
                  <tr key={p.id} style={{ borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: COLORS.cinza, whiteSpace: "nowrap" }}>{formatarData(p.data)}</td>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: COLORS.cinzaEscuro, whiteSpace: "nowrap" }}>{p.produto}</td>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: COLORS.cinzaEscuro, whiteSpace: "nowrap" }}>{brl(p.preco)}</td>
                    <td style={{ padding: "11px 16px" }}>
                      {podeGerir && (
                        <button onClick={() => removerPreco(p)} title="Remover preço"
                          style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.4, padding: 2 }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}>
                          <Icon name="trash" color={COLORS.vermelho} size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolavel>
        )}
      </Card>

      {modalPrecos && (
        <Modal title="Conferir Preços da Semana" onClose={() => setModalPrecos(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 13, color: COLORS.cinza, lineHeight: 1.55 }}>
              O preço de cada produto já vem preenchido com o da última conferência.
              Deixe como está para confirmar, ou mude para ajustar.
            </div>

            <Input label="Data da conferência *" type="date" value={formPrecos.data}
              onChange={(e) => setFormPrecos((f) => ({ ...f, data: e.target.value }))} />

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {produtosPrecificar.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ fontSize: 13.5, color: COLORS.cinzaEscuro }}>{p.nome}</span>
                  <input type="number" min="0" step="0.01" placeholder="—"
                    value={formPrecos.valores[p.nome] ?? ""}
                    onChange={(e) => setFormPrecos((f) => ({ ...f, valores: { ...f.valores, [p.nome]: e.target.value } }))}
                    style={{ width: 110, padding: "7px 10px", borderRadius: 6, border: `1px solid ${COLORS.cinzaClaro}`, fontSize: 13.5, textAlign: "right" }} />
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn variant="secondary" onClick={() => setModalPrecos(false)}>Cancelar</Btn>
              <Btn onClick={salvarPrecos} style={{ opacity: podeSalvarPrecos ? 1 : 0.5 }}>Confirmar Preços</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Perdas */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 22px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: COLORS.cinzaEscuro }}>Perdas</h3>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: COLORS.cinza }}>
              {dados.perdas.length === 0
                ? "Fruta que estragou, quebrou no transporte ou voltou do cliente."
                : `${dados.perdas.length} registro(s) · ${brl(totalPerdido)} a preço de custo`}
            </p>
          </div>
          {podeGerir && <Btn icon="plus" variant="ghost" onClick={abrirPerda}>Registrar Perda</Btn>}
        </div>

        {perdasRecentes.length > 0 && (
          <TabelaRolavel>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
              <thead style={{ background: COLORS.cinzaClaro }}>
                <tr>
                  {["Data", "Fruta", "Quilos", "Custo / kg", "Valor", "Motivo", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", fontSize: 11.5, color: COLORS.cinza, padding: "10px 16px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {perdasRecentes.map((perda) => (
                  <tr key={perda.id} style={{ borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: COLORS.cinza, whiteSpace: "nowrap" }}>{formatarData(perda.data)}</td>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: COLORS.cinzaEscuro, whiteSpace: "nowrap" }}>{perda.fruta}</td>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: COLORS.cinzaEscuro, whiteSpace: "nowrap" }}>{kg(perda.kg)}</td>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: COLORS.cinza, whiteSpace: "nowrap" }}>{brl(perda.custoKg)}</td>
                    <td style={{ padding: "11px 16px", fontSize: 13, fontWeight: 700, color: COLORS.laranjaEscuro, whiteSpace: "nowrap" }}>{brl(perda.valor)}</td>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: COLORS.cinza }}>{perda.motivo}</td>
                    <td style={{ padding: "11px 16px" }}>
                      <button onClick={() => removerPerda(perda)} title="Remover perda"
                        style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.4, padding: 2 }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}>
                        <Icon name="trash" color={COLORS.vermelho} size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolavel>
        )}
      </Card>

      {/* Acertos de inventário */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 22px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: COLORS.cinzaEscuro }}>Acertos de Inventário</h3>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: COLORS.cinza }}>
              {dados.acertos.length === 0
                ? "Quando a conta discorda do depósito: conte o que existe e registre aqui."
                : `${dados.acertos.length} contagem(ns) registrada(s)`}
            </p>
          </div>
          {podeGerir && <Btn icon="plus" variant="ghost" onClick={() => abrirAcerto()}>Contar Estoque</Btn>}
        </div>

        {acertosRecentes.length > 0 && (
          <TabelaRolavel>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
              <thead style={{ background: COLORS.cinzaClaro }}>
                <tr>
                  {["Data", "Fruta", "A conta dizia", "Foi contado", "Ajuste", "Motivo", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", fontSize: 11.5, color: COLORS.cinza, padding: "10px 16px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {acertosRecentes.map((a) => (
                  <tr key={a.id} style={{ borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: COLORS.cinza, whiteSpace: "nowrap" }}>{formatarData(a.data)}</td>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: COLORS.cinzaEscuro, whiteSpace: "nowrap" }}>{a.fruta}</td>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: a.kgSistema < 0 ? COLORS.vermelho : COLORS.cinza, whiteSpace: "nowrap" }}>{kg(a.kgSistema)}</td>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: COLORS.cinzaEscuro, whiteSpace: "nowrap" }}>{kg(a.kgContado)}</td>
                    <td style={{ padding: "11px 16px", fontSize: 13, fontWeight: 700, color: a.ajuste >= 0 ? COLORS.azul : COLORS.laranjaEscuro, whiteSpace: "nowrap" }}>
                      {a.ajuste > 0 ? "+" : a.ajuste < 0 ? "−" : ""} {kg(Math.abs(a.ajuste))}
                    </td>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: COLORS.cinza }}>{a.motivo}</td>
                    <td style={{ padding: "11px 16px" }}>
                      <button onClick={() => removerAcerto(a)} title="Remover acerto"
                        style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.4, padding: 2 }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}>
                        <Icon name="trash" color={COLORS.vermelho} size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolavel>
        )}
      </Card>

      {/* Insumos de produção: redinha, grampo e etiquetas — saldo pela última contagem */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 22px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: COLORS.cinzaEscuro }}>Insumos de Produção</h3>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: COLORS.cinza }}>
              O que embala o sanquinho de laranja. Sem compra/venda lançada: o saldo é a
              última contagem no depósito — conte toda semana para não deixar faltar.
            </p>
          </div>
          {podeGerir && <Btn icon="plus" variant="ghost" onClick={abrirContagem}>Registrar Contagem</Btn>}
        </div>

        {insumosAtrasados && (
          <div style={{ margin: "0 22px 14px", background: "#E8F1FB", border: `1px solid ${COLORS.azul}55`, borderRadius: 8, padding: "9px 12px", fontSize: 12.5, color: COLORS.azul }}>
            Ainda sem contagem esta semana.
          </div>
        )}

        <div style={{ padding: "0 22px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {saldosInsumos.map((s) => {
            const semContagem = s.quantidade === null;
            const cor = semContagem ? COLORS.cinza : s.abaixoDoMinimo ? COLORS.vermelho : COLORS.verde;
            return (
              <div key={s.id} style={{ border: `1px solid ${COLORS.cinzaClaro}`, borderLeft: `4px solid ${cor}`, borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ fontWeight: 700, color: COLORS.cinzaEscuro, fontSize: 14 }}>{s.nome}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: cor, marginTop: 4, lineHeight: 1.1 }}>
                  {semContagem ? "—" : s.quantidade.toLocaleString("pt-BR")}
                  <span style={{ fontSize: 13, fontWeight: 400, color: COLORS.cinza }}> {s.unidade}</span>
                </div>
                {!semContagem && rendimentoDoInsumo(s.unidade, s.quantidade, s.nome) && (
                  <div style={{ fontSize: 12, color: COLORS.cinzaEscuro, marginTop: 2 }}>{rendimentoDoInsumo(s.unidade, s.quantidade, s.nome)}</div>
                )}
                <div style={{ fontSize: 11.5, color: COLORS.cinza, marginTop: 3 }}>
                  {semContagem ? "Ainda não contado" : `Contado em ${formatarData(s.dataContagem)}`}
                  {s.abaixoDoMinimo && <span style={{ color: COLORS.vermelho, fontWeight: 600 }}> · abaixo do mínimo</span>}
                </div>
                {podeGerir && (
                  <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 11.5, color: COLORS.cinza }}>
                    Estoque mínimo ({s.unidade})
                    <input type="number" min="0" step="any" defaultValue={s.estoqueMinimo || ""}
                      onBlur={(e) => salvarMinimoInsumo(s, e.target.value)}
                      style={{ width: 64, padding: "3px 6px", borderRadius: 5, border: `1px solid ${COLORS.cinzaClaro}`, fontSize: 12 }} />
                  </label>
                )}
              </div>
            );
          })}
        </div>

        {contagensRecentes.length > 0 && (
          <TabelaRolavel>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
              <thead style={{ background: COLORS.cinzaClaro }}>
                <tr>
                  {["Data", "Item", "Quantidade", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", fontSize: 11.5, color: COLORS.cinza, padding: "10px 16px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contagensRecentes.map((c) => (
                  <tr key={c.id} style={{ borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: COLORS.cinza, whiteSpace: "nowrap" }}>{formatarData(c.data)}</td>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: COLORS.cinzaEscuro, whiteSpace: "nowrap" }}>{c.item}</td>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: COLORS.cinzaEscuro, whiteSpace: "nowrap" }}>
                      {Number(c.quantidade).toLocaleString("pt-BR")} {unidadePorInsumo.get(c.item) ?? ""}
                    </td>
                    <td style={{ padding: "11px 16px" }}>
                      {podeGerir && (
                        <button onClick={() => removerContagem(c)} title="Remover contagem"
                          style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.4, padding: 2 }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}>
                          <Icon name="trash" color={COLORS.vermelho} size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolavel>
        )}
      </Card>

      {/* Catálogo de produtos: as formas de vender cada fruta */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 22px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: COLORS.cinzaEscuro }}>Produtos</h3>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: COLORS.cinza }}>
              As formas de vender cada fruta. O estoque é da fruta, não do produto. O preço é digitado em cada venda.
            </p>
          </div>
          {podeGerir && <Btn icon="plus" variant="ghost" onClick={abrirNovoProduto}>Novo Produto</Btn>}
        </div>
        <TabelaRolavel>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 740 }}>
            <thead style={{ background: COLORS.cinzaClaro }}>
              <tr>
                {["Produto", "Fruta", "Empresa", "Vendido em", "Caixa", "NCM", "Nota fiscal", ""].map((h, i) => (
                  <th key={i} style={{ textAlign: "left", fontSize: 11.5, color: COLORS.cinza, padding: "10px 16px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...dados.produtos]
                .sort((a, b) => ordemNaVenda(a) - ordemNaVenda(b) || a.nome.localeCompare(b.nome, "pt-BR"))
                .map((p) => {
                  const emSaco = p.unidadeVenda === "saco";
                  const pendencia = pendenciaFiscal(p);
                  return (
                    <tr key={p.id} style={{ borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
                      <td style={{ padding: "11px 16px", fontSize: 14, fontWeight: 600, color: COLORS.cinzaEscuro }}>{p.nome}</td>
                      <td style={{ padding: "11px 16px", fontSize: 13, color: COLORS.cinza, whiteSpace: "nowrap" }}>{p.fruta}</td>
                      <td style={{ padding: "11px 16px", whiteSpace: "nowrap" }}><ChipEmpresa empresa={p.empresa} /></td>
                      <td style={{ padding: "11px 16px", fontSize: 13, color: COLORS.cinza, whiteSpace: "nowrap" }}>
                        {emSaco ? `Saco de ${kg(p.kgPorUnidade)}` : "Agranel"}
                      </td>
                      <td style={{ padding: "11px 16px", fontSize: 13, color: COLORS.cinza, whiteSpace: "nowrap" }}>{p.kgPorCaixa ? kg(p.kgPorCaixa) : "—"}</td>
                      <td style={{ padding: "11px 16px", fontSize: 12.5, color: COLORS.cinza, whiteSpace: "nowrap" }}>{p.ncm || "—"}</td>
                      <td style={{ padding: "11px 16px", fontSize: 12, whiteSpace: "nowrap" }}>
                        {pendencia
                          ? <span style={{ color: pendencia === "emitir no Spedy" ? "#856404" : COLORS.vermelho, fontWeight: 600 }}>{pendencia}</span>
                          : <span style={{ color: COLORS.verde, fontWeight: 600 }}>✓ {p.cfopPadrao || "5.102"}</span>}
                      </td>
                      <td style={{ padding: "11px 16px", textAlign: "right" }}>
                        {podeGerir && (
                          <button onClick={() => abrirEdicaoProduto(p)} title="Editar produto"
                            style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.55, padding: 2 }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.55")}>
                            <Icon name="edit" color={COLORS.verde} size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </TabelaRolavel>
      </Card>

      {modalContagem && (
        <Modal title="Registrar Contagem de Insumos" onClose={() => setModalContagem(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 13, color: COLORS.cinza, lineHeight: 1.55 }}>
              Vá até o depósito e conte quanto tem de cada item. Sacos (redinha) em rolos de
              1.000 m — 1 m faz 3 sacos de 2,5 kg; grampos e etiquetas em milheiros. Aceita
              fração: meio rolo = 0,5; 1.500 etiquetas = 1,5. Deixe em branco o que não for
              contar agora — só o que tiver quantidade entra no histórico.
            </div>

            <Input label="Data da contagem *" type="date" value={formContagem.data}
              onChange={(e) => setFormContagem((f) => ({ ...f, data: e.target.value }))} />

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {saldosInsumos.map((s) => {
                const rendimento = rendimentoDoInsumo(s.unidade, formContagem.quantidades[s.nome], s.nome);
                return (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13.5, color: COLORS.cinzaEscuro }}>{s.nome}</div>
                      <div style={{ fontSize: 11.5, color: COLORS.cinza }}>
                        em {s.unidade}{rendimento ? ` · ${rendimento}` : ""}
                      </div>
                    </div>
                    <input type="number" min="0" step="any" placeholder="—"
                      value={formContagem.quantidades[s.nome] ?? ""}
                      onChange={(e) => setFormContagem((f) => ({ ...f, quantidades: { ...f.quantidades, [s.nome]: e.target.value } }))}
                      style={{ width: 100, padding: "7px 10px", borderRadius: 6, border: `1px solid ${COLORS.cinzaClaro}`, fontSize: 13.5, textAlign: "right" }} />
                  </div>
                );
              })}
            </div>

            <Input label="Observação" value={formContagem.observacao}
              onChange={(e) => setFormContagem((f) => ({ ...f, observacao: e.target.value }))}
              placeholder="Opcional" />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn variant="secondary" onClick={() => setModalContagem(false)}>Cancelar</Btn>
              <Btn onClick={salvarContagem} style={{ opacity: podeSalvarContagem ? 1 : 0.5 }}>Registrar Contagem</Btn>
            </div>
          </div>
        </Modal>
      )}

      {modalPerda && (
        <Modal title="Registrar Perda" onClose={() => setModalPerda(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Data *" type="date" value={formPerda.data} onChange={(e) => setFormPerda((f) => ({ ...f, data: e.target.value }))} />
              <Select label="Fruta *" value={formPerda.fruta} onChange={(e) => escolherFrutaDaPerda(e.target.value)}
                options={frutasEstoque.map((v) => ({ value: v, label: v }))} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Quilos perdidos *" type="number" min="0" step="0.001" value={formPerda.kg} onChange={(e) => setFormPerda((f) => ({ ...f, kg: e.target.value }))} />
              <Input label="Custo / kg" type="number" min="0" step="0.0001" value={formPerda.custoKg} onChange={(e) => setFormPerda((f) => ({ ...f, custoKg: e.target.value }))} />
            </div>
            <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: -8 }}>
              O custo médio de compra da fruta já vem preenchido. Fica guardado como está
              hoje: uma compra nova mais cara não pode reescrever quanto custou esta perda.
            </div>

            <Select label="Motivo" value={formPerda.motivo} onChange={(e) => setFormPerda((f) => ({ ...f, motivo: e.target.value }))}
              options={MOTIVOS_PERDA.map((v) => ({ value: v, label: v }))} />

            {custoPerdaPrevia > 0 && (
              <div style={{ fontSize: 13, color: COLORS.laranjaEscuro, background: "#FFF3CD", borderRadius: 6, padding: "9px 12px" }}>
                {kg(Number(formPerda.kg))} × {brl(Number(formPerda.custoKg))} = <strong>{brl(custoPerdaPrevia)}</strong> de prejuízo
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn variant="secondary" onClick={() => setModalPerda(false)}>Cancelar</Btn>
              <Btn onClick={salvarPerda} style={{ opacity: podeSalvarPerda ? 1 : 0.5 }}>Registrar Perda</Btn>
            </div>
          </div>
        </Modal>
      )}

      {modalAcerto && (
        <Modal title="Contar Estoque" onClose={() => setModalAcerto(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 13, color: COLORS.cinza, lineHeight: 1.55 }}>
              Vá até o depósito, conte o que existe e escreva aqui. O sistema guarda o
              que a conta dizia e registra a diferença — o acerto fica explicado, em vez
              de o número simplesmente mudar.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Data da contagem *" type="date" value={formAcerto.data}
                onChange={(e) => setFormAcerto((f) => ({ ...f, data: e.target.value }))} />
              <Select label="Fruta *" value={formAcerto.fruta}
                onChange={(e) => setFormAcerto((f) => ({ ...f, fruta: e.target.value }))}
                options={frutasEstoque.map((v) => ({ value: v, label: v }))} />
            </div>

            <div style={{ background: COLORS.creme, borderRadius: 8, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: COLORS.cinza }}>A conta diz que existem</span>
              <strong style={{ fontSize: 15, color: kgSistemaAcerto < 0 ? COLORS.vermelho : COLORS.cinzaEscuro }}>
                {kg(kgSistemaAcerto)}
              </strong>
            </div>
            {aSairAcerto > 0 && (
              <div style={{ fontSize: 12.5, color: "#856404", background: "#FFF3CD", borderRadius: 6, padding: "8px 12px", lineHeight: 1.5 }}>
                Inclui <strong>{kg(aSairAcerto)}</strong> de pedidos já lançados que ainda não foram
                carregados — conte também a mercadoria separada para eles, que ainda está no depósito.
              </div>
            )}

            <Input label="Quilos contados no depósito *" type="number" min="0" step="0.001"
              value={formAcerto.kgContado}
              onChange={(e) => setFormAcerto((f) => ({ ...f, kgContado: e.target.value }))} />

            {ajustePrevia !== null && (
              <div style={{
                fontSize: 13, borderRadius: 6, padding: "9px 12px",
                background: ajustePrevia >= 0 ? "#E8F1FB" : "#FFF3CD",
                color: ajustePrevia >= 0 ? COLORS.azul : "#856404",
              }}>
                Ajuste de <strong>{ajustePrevia > 0 ? "+" : ajustePrevia < 0 ? "−" : ""} {kg(Math.abs(ajustePrevia))}</strong>
                {ajustePrevia > 0
                  ? " — entrou mercadoria que não foi lançada."
                  : ajustePrevia < 0
                    ? " — saiu mercadoria que não foi lançada."
                    : " — a conta já estava certa."}
              </div>
            )}

            <Select label="Motivo" value={formAcerto.motivo}
              onChange={(e) => setFormAcerto((f) => ({ ...f, motivo: e.target.value }))}
              options={MOTIVOS_ACERTO.map((v) => ({ value: v, label: v }))} />

            {acertoViraPerda && (
              <div style={{
                fontSize: 13, borderRadius: 6, padding: "9px 12px",
                background: perdaSemFalta ? "#FDECEA" : "#FFF3CD",
                color: perdaSemFalta ? COLORS.vermelho : "#856404",
              }}>
                {perdaSemFalta
                  ? "A contagem não deu menos do que a conta — não há perda para lançar."
                  : ajustePrevia === null
                    ? "A diferença vai direto para Perdas, ao custo médio da fruta."
                    : <>Vai para Perdas: <strong>{kg(Math.abs(ajustePrevia))}</strong> × {brl(custos.get(formAcerto.fruta) ?? 0)} = <strong>{brl(Math.abs(ajustePrevia) * (custos.get(formAcerto.fruta) ?? 0))}</strong> de prejuízo.</>}
              </div>
            )}

            <div style={{ fontSize: 12, color: COLORS.cinza, lineHeight: 1.5 }}>
              O acerto não apaga nada: compras, vendas e perdas continuam no histórico.
              Se a nota que faltava aparecer depois, lance a compra <strong>e</strong> remova
              este acerto — senão a correção entra duas vezes.
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn variant="secondary" onClick={() => setModalAcerto(false)}>Cancelar</Btn>
              <Btn onClick={salvarAcerto} style={{ opacity: podeSalvarAcerto ? 1 : 0.5 }}>
                {acertoViraPerda ? "Lançar Perda" : "Registrar Contagem"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {modalProduto && (
        <Modal title={editandoProduto ? "Editar Produto" : "Novo Produto"} onClose={fecharProduto}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Input label="Nome do Produto *" value={formProduto.nome} onChange={(e) => setFormProduto((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Saco 2,5 kg" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Select label="Fruta *" value={formProduto.fruta} onChange={(e) => setFormProduto((f) => ({ ...f, fruta: e.target.value }))}
                options={[...frutas.map((v) => ({ value: v, label: v })), { value: NOVA_FRUTA, label: "+ Nova fruta..." }]} />
              <Select label="Vendido em" value={formProduto.unidadeVenda} onChange={(e) => setFormProduto((f) => ({ ...f, unidadeVenda: e.target.value }))}
                options={[{ value: "kg", label: "Quilo (agranel)" }, { value: "saco", label: "Saco / bag" }]} />
            </div>

            {formProduto.fruta === NOVA_FRUTA && (
              <Input label="Nome da nova fruta *" value={formProduto.frutaNova} autoFocus
                onChange={(e) => setFormProduto((f) => ({ ...f, frutaNova: e.target.value }))} placeholder="Tangerina" />
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Select label="Empresa que emite a nota *" value={empresaProduto} disabled={!!empresaTravada}
                onChange={(e) => setFormProduto((f) => ({ ...f, empresa: e.target.value }))}
                options={EMPRESAS} style={empresaTravada ? { background: COLORS.cinzaClaro } : undefined} />
              <div style={{ fontSize: 12, color: COLORS.cinza, lineHeight: 1.5 }}>
                {empresaTravada
                  ? <>{frutaFinal} já é vendida pela <strong>{nomeDaEmpresa(empresaTravada)}</strong> — o estoque é da fruta e não se divide entre empresas. Para vender pela outra, cadastre uma fruta nova (ex.: “{frutaFinal} revenda”).</>
                  : levaIrmaos
                    ? <>Os outros produtos de {frutaFinal} ({irmaos.map((p) => p.nome).join(", ")}) também passam para a <strong>{nomeDaEmpresa(empresaProduto)}</strong> — o estoque é da fruta e não se divide.</>
                    : <>A receita deste produto conta para a empresa escolhida no Painel e no Financeiro, sem se misturar com a outra.</>}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Input label="Peso de uma caixa (kg)" type="number" inputMode="decimal" step="0.1" min="0"
                value={formProduto.kgPorCaixa} onChange={campoProduto("kgPorCaixa")} placeholder="25" />
              <div style={{ fontSize: 12, color: COLORS.cinza }}>
                Opcional. Vale para todos os produtos de {frutaFinal || "a fruta"} — ex.: laranja pera, caixa de 25 kg.
              </div>
              <Input label="Peso médio de uma unidade (kg)" type="number" inputMode="decimal" step="0.1" min="0"
                value={formProduto.pesoMedioUnidade} onChange={campoProduto("pesoMedioUnidade")} placeholder="5" />
              <div style={{ fontSize: 12, color: COLORS.cinza }}>
                Opcional, para fruta vendida também por unidade (abóbora, melancia). Parte daqui o pedido por unidade; o app converte em kg.
              </div>
            </div>

            {formProduto.unidadeVenda === "saco" && (
              <div style={{ background: COLORS.creme, borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <Input label="Quilos por saco *" type="number" step="0.1" min="0.1"
                  value={formProduto.kgPorUnidade} onChange={(e) => setFormProduto((f) => ({ ...f, kgPorUnidade: e.target.value }))} />
                <div style={{ fontSize: 12, color: COLORS.cinza }}>
                  É a coluna <strong>BAGS</strong> da planilha. Vende por saco, controla por quilo:
                  60 sacos de {formProduto.kgPorUnidade || "?"} kg = {kg(60 * (Number(formProduto.kgPorUnidade) || 0))}.
                </div>
              </div>
            )}


            {/* Dados da NF-e: sem eles o app não emite a nota deste produto */}
            <div style={{ border: `1px solid ${COLORS.cinzaClaro}`, borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: COLORS.cinzaEscuro }}>Dados da nota fiscal</div>
                <div style={{ fontSize: 12, color: COLORS.cinza, lineHeight: 1.5, marginTop: 2 }}>
                  Confirme com o contador. Produção própria da Carvalho Cruz: CFOP 5.101. Revenda (CVC): 5.102.
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Input label="NCM *" value={formProduto.ncm} onChange={campoProduto("ncm")} placeholder="0805.10.00" />
                <Select label="CFOP" value={formProduto.cfopPadrao || "5.102"}
                  onChange={campoProduto("cfopPadrao")} options={CFOPS} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Select label="Unidade na nota" value={formProduto.unidadeOmie || (formProduto.unidadeVenda === "saco" ? "BAG" : "KG")}
                  onChange={campoProduto("unidadeOmie")}
                  options={[...new Set([...UNIDADES_NOTA, formProduto.unidadeOmie].filter(Boolean))].map((u) => ({ value: u, label: u }))} />
                <Select label="Origem" value={formProduto.origem} onChange={campoProduto("origem")} options={ORIGENS} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: formProduto.icmsCst === "00" ? "2fr 1fr" : "1fr", gap: 12 }}>
                <Select label="ICMS — CST" value={formProduto.icmsCst} onChange={campoProduto("icmsCst")} options={CSTS_ICMS} />
                {formProduto.icmsCst === "00" && (
                  <Input label="Alíquota ICMS (%) *" type="number" min="0" max="99" step="0.01"
                    value={formProduto.icmsAliquota} onChange={campoProduto("icmsAliquota")} placeholder="19" />
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Select label="PIS — CST" value={formProduto.pisCst} onChange={campoProduto("pisCst")} options={CSTS_PIS_COFINS} />
                <Select label="COFINS — CST" value={formProduto.cofinsCst} onChange={campoProduto("cofinsCst")} options={CSTS_PIS_COFINS} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <Input label="Código do produto (sai na NF-e)" value={formProduto.codigo} onChange={campoProduto("codigo")} placeholder="PRD00016" />
                <Input label="CEST" value={formProduto.cest} onChange={campoProduto("cest")} />
                <Input label="EAN (código de barras)" value={formProduto.ean} onChange={campoProduto("ean")} />
              </div>
              {!editandoProduto && formProduto.codigo.trim() !== proximoCodigo() && (
                <button type="button" onClick={() => setFormProduto((f) => ({ ...f, codigo: proximoCodigo() }))}
                  style={{ background: "none", border: "none", padding: 0, marginTop: 4, fontSize: 12, color: COLORS.verde, cursor: "pointer", textDecoration: "underline" }}>
                  Sugerir {proximoCodigo()}
                </button>
              )}
              {produtoComMesmoCodigo && (
                <div style={{ color: COLORS.vermelho, fontSize: 12 }}>
                  Este código já é de "{produtoComMesmoCodigo.nome}". Use um código diferente.
                </div>
              )}
              {(!formProduto.icmsCst || !formProduto.pisCst || !formProduto.cofinsCst) && (
                <div style={{ fontSize: 12, color: COLORS.vermelho, lineHeight: 1.5 }}>
                  Sem o CST de ICMS, PIS e COFINS o app não emite nota deste produto.
                </div>
              )}
            </div>

            {editandoProduto && frutaFinal !== dados.produtos.find((p) => p.id === editandoProduto)?.fruta && (
              <div style={{ fontSize: 12.5, color: "#856404", background: "#FFF3CD", borderRadius: 6, padding: "9px 12px", lineHeight: 1.5 }}>
                Trocar a fruta leva junto as vendas já feitas deste produto: os quilos saem do estoque de {frutaFinal}, não mais do de {dados.produtos.find((p) => p.id === editandoProduto)?.fruta}.
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
              {editandoProduto && (
                <Btn variant="ghost" icon="trash" onClick={excluirProduto}
                  style={{ marginRight: "auto", color: COLORS.vermelho, borderColor: `${COLORS.vermelho}66` }}
                  title={vendasDoProduto > 0 ? `Já vendido em ${vendasDoProduto} pedido(s)` : "Excluir produto"}>
                  Excluir
                </Btn>
              )}
              <Btn variant="secondary" onClick={fecharProduto}>Cancelar</Btn>
              <Btn onClick={salvarProduto} style={{ opacity: podeSalvarProduto ? 1 : 0.5 }}>Salvar Produto</Btn>
            </div>
          </div>
        </Modal>
      )}

      {renomear && (
        <Modal title="Renomear Fruta" onClose={() => setRenomear(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Input label="Nome da fruta *" value={renomear.nome} autoFocus
              onChange={(e) => setRenomear((r) => ({ ...r, nome: e.target.value }))} />
            <div style={{ fontSize: 12, color: nomeRepetido ? COLORS.vermelho : COLORS.cinza, lineHeight: 1.5 }}>
              {nomeRepetido
                ? "Já existe uma fruta com esse nome."
                : <>O nome muda em tudo que é de {renomear.fruta}: produtos, compras, perdas e acertos. Nada se perde.</>}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn variant="secondary" onClick={() => setRenomear(null)}>Cancelar</Btn>
              <Btn onClick={salvarRenomear} style={{ opacity: podeRenomear ? 1 : 0.5 }}>Renomear</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};


// ─── Vendas ──────────────────────────────────────────────────────────────────
//
// A tela que reproduz a linha da planilha: DATA, REDE, LOJA, PRODUTO, UNIDADE,
// BAGS, QUANTIDADE, KG TOTAIS, VALOR UNITÁRIO, TOTAL, PRAZO.

// `unidade` só existe no agranel: "kg" (o normal) ou "un", quando o cliente
// compra por unidade. Aí `pesoUnidade` é o peso médio de cada uma, que
// converte a venda em quilos para o estoque e os relatórios.
const ITEM_VAZIO = { produtoId: "", qty: "", precoUnitario: "", natureza: "venda", unidade: "kg", pesoUnidade: "" };

/** Chave do item no pedido: o mesmo produto pode entrar vendido, bonificado, por kg e por unidade. */
const chaveDoItem = (i) => `${i.produtoId}-${i.natureza}-${i.unidade === "un" ? "un" : "kg"}`;

/** Assinatura dos itens de um pedido — a ordem não importa, só o conteúdo. */
const assinaturaItens = (itens) =>
  [...(itens ?? [])]
    .map((i) => `${chaveDoItem(i)}:${i.qty}:${i.precoUnitario}`)
    .sort()
    .join("|");

/** Outro pedido da mesma loja, no mesmo dia, com exatamente os mesmos itens. */
const pedidoDuplicado = (vendas, { id, lojaId, data, itens }) => {
  const assinatura = assinaturaItens(itens);
  return vendas.find((v) =>
    v.id !== id && v.lojaId === lojaId && v.data === data && v.status !== "cancelado" &&
    assinaturaItens(v.itens) === assinatura
  );
};

// Como a lista de vendas pode ser ordenada. O desempate é sempre o mais
// recente primeiro, para a ordem não pular entre renderizações.
const ORDENS_VENDAS = [
  { valor: "recentes", rotulo: "Mais recentes", comparar: () => 0 },
  { valor: "numero-desc", rotulo: "Nº do pedido (maior primeiro)", comparar: (a, b) => (b.numero ?? 0) - (a.numero ?? 0) },
  { valor: "numero-asc", rotulo: "Nº do pedido (menor primeiro)", comparar: (a, b) => (a.numero ?? 0) - (b.numero ?? 0) },
  { valor: "data-desc", rotulo: "Data (mais nova primeiro)", comparar: (a, b) => String(b.data).localeCompare(String(a.data)) },
  { valor: "data-asc", rotulo: "Data (mais antiga primeiro)", comparar: (a, b) => String(a.data).localeCompare(String(b.data)) },
  { valor: "venc-asc", rotulo: "Vencimento (mais próximo primeiro)",
    comparar: (a, b, dados) => (vencimentoDoPedido(dados, a) ?? "").localeCompare(vencimentoDoPedido(dados, b) ?? "") },
  { valor: "venc-desc", rotulo: "Vencimento (mais distante primeiro)",
    comparar: (a, b, dados) => (vencimentoDoPedido(dados, b) ?? "").localeCompare(vencimentoDoPedido(dados, a) ?? "") },
  { valor: "cliente", rotulo: "Cliente (A–Z)",
    comparar: (a, b, dados) => nomeDoCliente(dados, a.lojaId).localeCompare(nomeDoCliente(dados, b.lojaId), "pt-BR") },
  { valor: "total-desc", rotulo: "Total (maior primeiro)", comparar: (a, b) => (b.total ?? 0) - (a.total ?? 0) },
];

// A ordem escolhida fica neste aparelho. Storage bloqueado (modo anônimo)
// só faz voltar ao padrão.
const CHAVE_ORDEM_VENDAS = "vendas-ordem";
const lerOrdemVendas = () => {
  try {
    const salva = localStorage.getItem(CHAVE_ORDEM_VENDAS);
    return ORDENS_VENDAS.some((o) => o.valor === salva) ? salva : "recentes";
  } catch {
    return "recentes";
  }
};

/**
 * O que conferir num pedido importado de PDF: de onde veio, o total do PDF
 * contra o do formulário, os avisos de conversão e as linhas que não
 * casaram com um produto (a pessoa escolhe ali mesmo, ou ignora).
 */
const formatarCnpj = (d) => String(d).replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

const ConferenciaPdf = ({ importacao, total, lojaEscolhida, produtos, aoEscolher, aoIgnorar }) => {
  const diferenca = Math.abs(total - importacao.totalPdf) > 0.05;
  const opcoesProduto = [{ value: "", label: "Escolher produto…" },
    ...[...produtos]
      .sort((a, b) => ordemNaVenda(a) - ordemNaVenda(b) || a.nome.localeCompare(b.nome, "pt-BR"))
      .map((p) => ({ value: p.id, label: p.empresa === "carvalho_cruz" ? `${p.nome} · Carvalho` : p.nome }))];
  return (
    <div style={{ background: "#FFF3E0", border: `1px solid ${COLORS.laranja}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: COLORS.cinzaEscuro, lineHeight: 1.5, display: "flex", flexDirection: "column", gap: 8 }}>
      <div>
        <strong>Pedido lido do PDF</strong> <span style={{ color: COLORS.cinza }}>({importacao.arquivo})</span>
        {importacao.pedidoCompra && <> · pedido de compra nº <strong>{importacao.pedidoCompra}</strong></>}
        {importacao.dataEntrega && <> · entrega prevista {formatarData(importacao.dataEntrega)}</>}
        . Confira loja, data, prazo, itens e preços antes de registrar.
      </div>
      {!importacao.lojaAchada && (
        <div style={{ color: COLORS.laranjaEscuro, fontWeight: 600 }}>
          {lojaEscolhida ? "Confira a loja escolhida" : "Escolha a rede e a loja"}
          {importacao.cnpj
            ? ` — nenhuma loja cadastrada tem o CNPJ do PDF (${formatarCnpj(importacao.cnpj)}). Ao registrar, dá para gravá-lo na ficha da loja escolhida.`
            : " — o PDF não trouxe CNPJ."}
        </div>
      )}
      <div style={{ color: diferenca && !importacao.pendentes.length ? COLORS.vermelho : COLORS.cinzaEscuro }}>
        Total do PDF <strong>{brl(importacao.totalPdf)}</strong> · no pedido <strong>{brl(total)}</strong>
        {diferenca && !importacao.pendentes.length && " — valores diferentes, confira os itens."}
      </div>
      {importacao.avisos.map((a) => (
        <div key={a} style={{ fontSize: 12 }}>• {a}</div>
      ))}
      {importacao.pendentes.length > 0 && (
        <div style={{ borderTop: `1px solid ${COLORS.laranja}`, paddingTop: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            {importacao.pendentes.length === 1 ? "1 item não reconhecido" : `${importacao.pendentes.length} itens não reconhecidos`} — escolha o produto (fica lembrado para a próxima vez):
          </div>
          {importacao.pendentes.map((p) => (
            <div key={p.chave} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{p.descricao || "(sem descrição)"}</div>
                <div style={{ fontSize: 11, color: COLORS.cinza }}>
                  {p.qty.toLocaleString("pt-BR")} {p.unidade ?? ""} × {brl(p.preco)} = {brl(p.total)}
                </div>
              </div>
              <div style={{ flex: "1 1 160px" }}>
                <Select aria-label={`Produto para ${p.descricao}`} value="" onChange={(e) => aoEscolher(p, e.target.value)}
                  style={{ padding: "6px 10px", fontSize: 13 }} options={opcoesProduto} />
              </div>
              <button onClick={() => aoIgnorar(p)}
                style={{ background: "none", border: "none", color: COLORS.cinza, fontSize: 12, textDecoration: "underline", cursor: "pointer", padding: 0 }}>
                Ignorar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Vendas = ({ dados, setDados, podeRemover }) => {
  const [modal, setModal] = useState(false);
  // id da venda aberta para edição; null é uma venda nova.
  const [editandoId, setEditandoId] = useState(null);
  // Pedido com NF-e autorizada não edita: toque na linha abre só a leitura.
  const [detalheId, setDetalheId] = useState(null);
  const [redeId, setRedeId] = useState("");
  const [form, setForm] = useState({ lojaId: "", data: hojeISO(), prazoDias: 30, status: "pendente", itens: [], emitirNf: true, observacaoNf: "", caixasIfco: "" });
  const [item, setItem] = useState(ITEM_VAZIO);
  // Pedido que veio de um PDF (Importar PDF): o que se leu do arquivo, para a
  // tela mostrar o que conferir e as linhas que não casaram com um produto.
  const [importacao, setImportacao] = useState(null);
  const [lendoPdf, setLendoPdf] = useState(false);
  const inputPdf = useRef(null);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [ordem, setOrdem] = useState(lerOrdemVendas);
  const escolherOrdem = (valor) => {
    setOrdem(valor);
    try {
      localStorage.setItem(CHAVE_ORDEM_VENDAS, valor);
    } catch {
      // sem storage, a escolha vale só até recarregar
    }
  };

  const filtradas = dados.vendas.filter((v) =>
    filtroStatus === "todos"
    || (filtroStatus === "cliente" ? v.aguardandoConferencia
      : filtroStatus === "entrega" ? v.status !== "cancelado" && !v.veiculoId && (v.statusEntrega ?? "pendente") === "pendente"
        : v.status === filtroStatus));
  // Pedidos que o cliente fez pelo link e ninguém conferiu ainda.
  const aConferirDoCliente = dados.vendas.filter((v) => v.aguardandoConferencia).length;
  const comparar = (ORDENS_VENDAS.find((o) => o.valor === ordem) ?? ORDENS_VENDAS[0]).comparar;
  const ordenadas = [...filtradas].sort((a, b) => comparar(a, b, dados) || ordenarPorCriacao(a, b));

  // Na edição, a loja e a rede do pedido aparecem mesmo que tenham sido inativadas depois.
  const lojasDaRede = dados.lojas
    .filter((l) => l.redeId === redeId && (l.status === "ativo" || l.id === form.lojaId))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  const produtoDoItem = dados.produtos.find((p) => p.id === item.produtoId);

  const agranel = produtoDoItem?.unidadeVenda === "kg";
  const porUnidade = agranel && item.unidade === "un";

  // Prévia da conversão enquanto se digita — 60 × 2,5 = 150 kg.
  const kgPrevia = produtoDoItem
    ? kgDoItem(item.qty, porUnidade ? item.pesoUnidade : produtoDoItem.kgPorUnidade)
    : 0;
  const bonificado = item.natureza === "bonificacao";

  /** Prazo combinado com o cliente: o da última venda a prazo da loja, ou da rede se a loja é nova. */
  const prazoCombinado = (lojaId, redeDaLoja) => {
    const recentes = [...dados.vendas].sort(ordenarPorCriacao).filter((v) => Number(v.prazoDias) > 0 && v.status !== "cancelado");
    const daLoja = recentes.find((v) => v.lojaId === lojaId);
    if (daLoja) return daLoja.prazoDias;
    const lojasIds = new Set(dados.lojas.filter((l) => l.redeId === redeDaLoja).map((l) => l.id));
    return recentes.find((v) => lojasIds.has(v.lojaId))?.prazoDias ?? null;
  };

  /** O último pedido por unidade desse produto: de onde sai o peso médio de partida. */
  const ultimaVendaPorUnidade = (produtoId) => {
    const ultima = [...dados.vendas].sort(ordenarPorCriacao)
      .flatMap((v) => v.itens ?? [])
      .find((i) => i.produtoId === produtoId && i.unidade === "un" && i.natureza !== "bonificacao");
    return ultima ?? null;
  };

  const total = form.itens.reduce((s, i) => s + (i.natureza === "bonificacao" ? 0 : i.qty * i.precoUnitario), 0);
  // Pedido só de bonificação não é venda: não tem prazo nem vencimento.
  const todoBonificado = form.itens.length > 0 && form.itens.every((i) => i.natureza === "bonificacao");
  // Cliente com taxa "R$ por caixa": o pedido pede a quantidade de caixas IFCO.
  const cobraPorCaixa = (() => {
    const loja = dados.lojas.find((l) => l.id === form.lojaId);
    return taxasDaLoja(dados.redes.find((r) => r.id === loja?.redeId), loja).some((t) => t.modo === "por_caixa");
  })();
  const caixasDoForm = Math.max(0, Math.round(Number(String(form.caixasIfco).replace(",", ".")) || 0));
  // Conferindo um pedido que veio do link: o preço de cada item se ajusta
  // ali mesmo na lista, sem tirar e pôr o item de novo.
  const vendaEditada = editandoId ? dados.vendas.find((v) => v.id === editandoId) : null;
  const conferindo = Boolean(vendaEditada?.aguardandoConferencia);
  const semPreco = form.itens.filter((i) => i.natureza !== "bonificacao" && !(Number(i.precoUnitario) > 0));
  const kgTotal = form.itens.reduce((s, i) => s + i.kgTotal, 0);
  const proximoNumero = dados.vendas.reduce((m, v) => Math.max(m, v.numero || 0), 0) + 1;

  const escolherProduto = (produtoId) => {
    setItem((f) => ({
      ...f,
      produtoId,
      // O preço não vem da tabela: cada rede negocia o seu, então é digitado
      // a cada venda. Bonificação é sempre zero.
      precoUnitario: f.natureza === "bonificacao" ? "0" : "",
      unidade: "kg",
      pesoUnidade: "",
    }));
  };

  // O preço é digitado de novo (por quilo e por unidade não se comparam); o
  // peso médio parte do último pedido por unidade desse produto, se houver.
  const mudarUnidade = (unidade) => {
    const ultima = unidade === "un" ? ultimaVendaPorUnidade(item.produtoId) : null;
    setItem((f) => ({
      ...f,
      unidade,
      pesoUnidade: unidade === "un"
        ? String(ultima?.kgPorUnidade ?? dados.produtos.find((p) => p.id === f.produtoId)?.pesoMedioUnidade ?? PESO_UNIDADE_PADRAO)
        : "",
      precoUnitario: f.natureza === "bonificacao" ? "0" : "",
    }));
  };

  const mudarNatureza = (natureza) => {
    setItem((f) => ({
      ...f,
      natureza,
      precoUnitario: natureza === "bonificacao" ? "0" : "",
    }));
  };

  const addItem = () => {
    const p = dados.produtos.find((x) => x.id === item.produtoId);
    const qty = Number(item.qty);
    if (!p || !(qty > 0)) return;
    if (!bonificado && !(Number(item.precoUnitario) > 0)) return;
    const emUnidade = p.unidadeVenda === "kg" && item.unidade === "un";
    const pesoUnidade = Number(item.pesoUnidade);
    if (emUnidade && !(pesoUnidade > 0)) return;
    const fator = emUnidade ? pesoUnidade : p.kgPorUnidade;

    const novo = {
      produtoId: p.id,
      qty,
      precoUnitario: bonificado ? 0 : Number(item.precoUnitario) || 0,
      kgPorUnidade: fator,
      kgTotal: kgDoItem(qty, fator),
      natureza: item.natureza,
      ...(emUnidade && { unidade: "un" }),
    };

    // Mesmo produto pode entrar mais de uma vez: vendido e bonificado, por
    // quilo e por unidade.
    setForm((f) => ({
      ...f,
      itens: [...f.itens.filter((i) => chaveDoItem(i) !== chaveDoItem(novo)), novo],
    }));
    setItem(ITEM_VAZIO);
  };

  const mudarPrecoItem = (chave, valor) =>
    setForm((f) => ({
      ...f,
      itens: f.itens.map((i) => (chaveDoItem(i) === chave ? { ...i, precoUnitario: Number(valor) || 0 } : i)),
    }));

  const removerItem = (chave) =>
    setForm((f) => ({ ...f, itens: f.itens.filter((i) => chaveDoItem(i) !== chave) }));

  const fechar = () => {
    setModal(false);
    setEditandoId(null);
    setRedeId("");
    setForm({ lojaId: "", data: hojeISO(), prazoDias: 30, status: "pendente", itens: [], emitirNf: true, observacaoNf: "", caixasIfco: "" });
    setItem(ITEM_VAZIO);
    setImportacao(null);
  };

  /**
   * Um item do pedido a partir de uma linha do PDF. A unidade do cliente
   * nem sempre é a do cadastro: saco pedido em quilo vira sacos, e granel
   * pedido por unidade usa o peso médio da última venda por unidade.
   */
  const itemDoPdf = (produto, linha) => {
    const emUnidade = produto.unidadeVenda === "kg" && (linha.unidade === "un" || linha.unidade === "cx");
    let qty = linha.qty;
    let preco = linha.preco;
    let aviso = "";
    let fator = produto.kgPorUnidade;
    if (produto.unidadeVenda === "saco" && linha.unidade === "kg") {
      qty = linha.qty / (Number(produto.kgPorUnidade) || 1);
      preco = linha.preco * (Number(produto.kgPorUnidade) || 1);
      aviso = `${produto.nome}: o cliente pediu em kg (${linha.qty} kg), convertido para ${qty.toLocaleString("pt-BR")} sacos.`;
    } else if (emUnidade) {
      fator = ultimaVendaPorUnidade(produto.id)?.kgPorUnidade ?? produto.pesoMedioUnidade ?? PESO_UNIDADE_PADRAO;
      aviso = `${produto.nome}: pedido por unidade — peso médio de ${kg(fator)} por unidade${ultimaVendaPorUnidade(produto.id) ? " (da última venda)" : produto.pesoMedioUnidade ? " (do cadastro)" : " (estimado)"}; confira.`;
    }
    const novo = {
      produtoId: produto.id,
      qty,
      precoUnitario: Math.round(preco * 10000) / 10000,
      kgPorUnidade: fator,
      kgTotal: kgDoItem(qty, fator),
      natureza: "venda",
      ...(emUnidade && { unidade: "un" }),
    };
    return { novo, aviso };
  };

  /** Soma o item aos que já estão no pedido — duas linhas do mesmo produto viram uma. */
  const juntarItem = (itens, novo) => {
    const igual = itens.find((i) => chaveDoItem(i) === chaveDoItem(novo));
    if (!igual) return [...itens, novo];
    const qty = igual.qty + novo.qty;
    const junto = {
      ...igual,
      qty,
      precoUnitario: Math.round(((igual.qty * igual.precoUnitario + novo.qty * novo.precoUnitario) / qty) * 10000) / 10000,
      kgTotal: igual.kgTotal + novo.kgTotal,
    };
    return itens.map((i) => (i === igual ? junto : i));
  };

  const importarPdf = async (arquivo) => {
    if (!arquivo) return;
    setLendoPdf(true);
    try {
      const { lerLinhasPdf, interpretarPedidoPdf } = await import("./lib/pedidoPdf");
      const linhas = await lerLinhasPdf(arquivo);
      const { cabecalho, cliente, itens: linhasPdf } = interpretarPedidoPdf(linhas, dados);
      if (!linhasPdf.length) {
        alert("Não encontrei os itens neste PDF (quantidade × preço = total). Lance este pedido à mão pelo \"Nova Venda\".");
        return;
      }
      if (cabecalho.pedidoCompra) {
        const repetido = dados.vendas.find((v) => pedidoCompraDaVenda(v) === cabecalho.pedidoCompra
          && (!cliente.lojaId || v.lojaId === cliente.lojaId) && v.status !== "cancelado");
        if (repetido && !confirm(`O pedido de compra nº ${cabecalho.pedidoCompra} já foi lançado no pedido #${repetido.numero ?? "—"} (${nomeDoCliente(dados, repetido.lojaId)}).\n\nImportar de novo mesmo assim?`)) return;
      }

      let itens = [];
      const avisos = [];
      const pendentes = [];
      for (const linha of linhasPdf) {
        const produto = linha.produtoId && dados.produtos.find((p) => p.id === linha.produtoId);
        if (!produto) {
          pendentes.push(linha);
          continue;
        }
        const { novo, aviso } = itemDoPdf(produto, linha);
        itens = juntarItem(itens, novo);
        if (aviso) avisos.push(aviso);
      }

      // Prazo: o da última venda para essa loja, que é o combinado com o cliente.
      const prazoDoCliente = cliente.lojaId ? prazoCombinado(cliente.lojaId, cliente.redeId) : null;
      const hoje = hojeISO();
      const data = cabecalho.dataEntrega && cabecalho.dataEntrega > hoje ? cabecalho.dataEntrega : hoje;
      const observacao = [
        cabecalho.pedidoCompra && `Pedido de compra nº ${cabecalho.pedidoCompra}`,
        cabecalho.dataEntrega && `entrega prevista ${formatarData(cabecalho.dataEntrega)}`,
      ].filter(Boolean).join(" · ");

      setEditandoId(null);
      setRedeId(cliente.redeId);
      setForm({
        lojaId: cliente.lojaId, data, prazoDias: prazoDoCliente ?? 30, status: "pendente", itens, emitirNf: true, observacaoNf: "", caixasIfco: "",
        ...(observacao && { observacao }),
      });
      setItem(ITEM_VAZIO);
      setImportacao({
        arquivo: arquivo.name,
        pedidoCompra: cabecalho.pedidoCompra,
        dataEntrega: cabecalho.dataEntrega,
        totalPdf: cabecalho.totalPdf ?? linhasPdf.reduce((s, l) => s + l.total, 0),
        cnpj: cliente.cnpj,
        lojaAchada: Boolean(cliente.lojaId),
        avisos,
        pendentes: pendentes.map((l, i) => ({ ...l, chave: i })),
      });
      setModal(true);
    } catch (erro) {
      alert(`Não deu para ler o PDF:\n${erro?.message ?? erro}`);
    } finally {
      setLendoPdf(false);
      if (inputPdf.current) inputPdf.current.value = "";
    }
  };

  /** Linha do PDF sem produto: a pessoa escolhe, e a escolha fica lembrada para a próxima vez. */
  const resolverPendente = (pendente, produtoId) => {
    const produto = dados.produtos.find((p) => p.id === produtoId);
    if (!produto) return;
    lembrarProduto(pendente.descricao, produto.id);
    const { novo, aviso } = itemDoPdf(produto, pendente);
    setForm((f) => ({ ...f, itens: juntarItem(f.itens, novo) }));
    setImportacao((imp) => ({
      ...imp,
      avisos: aviso ? [...imp.avisos, aviso] : imp.avisos,
      pendentes: imp.pendentes.filter((p) => p.chave !== pendente.chave),
    }));
  };

  const ignorarPendente = (pendente) =>
    setImportacao((imp) => ({ ...imp, pendentes: imp.pendentes.filter((p) => p.chave !== pendente.chave) }));

  const salvar = () => {
    if (!form.lojaId || form.itens.length === 0) return;
    if (importacao?.pendentes.length) {
      const seguir = confirm(
        `${importacao.pendentes.length} ${importacao.pendentes.length === 1 ? "item do PDF ficou" : "itens do PDF ficaram"} sem produto e não ${importacao.pendentes.length === 1 ? "entra" : "entram"} no pedido:\n`
        + importacao.pendentes.map((p) => `• ${p.descricao}`).join("\n") + "\n\nRegistrar mesmo assim?"
      );
      if (!seguir) return;
    }
    if (conferindo && semPreco.length > 0) {
      alert("Coloque o preço de todos os itens antes de confirmar o pedido do cliente.");
      return;
    }
    const duplicado = pedidoDuplicado(dados.vendas, { id: editandoId, lojaId: form.lojaId, data: form.data, itens: form.itens });
    if (duplicado) {
      const seguir = confirm(
        `${nomeDoCliente(dados, form.lojaId)} já tem o pedido #${duplicado.numero ?? "—"} em ${formatarData(form.data)} com exatamente os mesmos itens.\n\nLançar mesmo assim?`
      );
      if (!seguir) return;
    }
    // Bonificação não é venda: não tem prazo, então não vence.
    const prazoDias = todoBonificado ? 0 : form.prazoDias;
    if (editandoId) {
      // Só o que o formulário mostra muda: número, criação, NF-e e romaneio
      // ficam como estavam. Salvar um pedido do link é conferi-lo.
      const { lojaId, data, status, itens, emitirNf } = form;
      const observacaoNf = form.observacaoNf.trim();
      const caixasIfco = caixasDoForm;
      setDados((d) => ({
        ...d,
        vendas: d.vendas.map((v) =>
          v.id === editandoId
            ? { ...v, lojaId, data, prazoDias, status, itens, emitirNf, observacaoNf, caixasIfco, total, kgTotal, aguardandoConferencia: false }
            : v
        ),
      }));
    } else {
      const nova = { ...form, observacaoNf: form.observacaoNf.trim(), caixasIfco: caixasDoForm, prazoDias, id: novoId(), numero: proximoNumero, total, kgTotal, criadoEm: new Date().toISOString() };
      setDados((d) => ({ ...d, vendas: [...d.vendas, nova] }));
    }
    // Loja escolhida à mão num pedido de PDF: guardar o CNPJ do PDF na ficha
    // dela faz a próxima importação achar a loja sozinha (e já serve à NF-e).
    const lojaDoPedido = dados.lojas.find((l) => l.id === form.lojaId);
    if (importacao && !importacao.lojaAchada && importacao.cnpj && lojaDoPedido && !soDigitos(lojaDoPedido.cnpjCpf)) {
      const cnpj = formatarCnpj(importacao.cnpj);
      if (confirm(`Gravar o CNPJ ${cnpj} (do PDF) na ficha da loja ${nomeDoCliente(dados, lojaDoPedido.id)}?\n\nAssim, no próximo PDF deste cliente, a loja já vem escolhida.`)) {
        setDados((d) => ({ ...d, lojas: d.lojas.map((l) => (l.id === lojaDoPedido.id ? { ...l, cnpjCpf: cnpj } : l)) }));
      }
    }
    fechar();
  };

  // Com NF-e autorizada o pedido é o que está na nota: mudar ou apagar aqui
  // deixaria o app diferente do que foi para a SEFAZ. Um pedido consolidado
  // na nota de outro (nota semanal) trava do mesmo jeito — ele não tem NF-e
  // própria, mas seus itens já foram para a nota do pedido âncora.
  const travadaPorNfe = (v) => v.nfeStatus === "autorizada" || v.nfeStatus === "consolidada";

  const motivoTravada = (v) => v.nfeStatus === "consolidada"
    ? `O pedido #${v.numero ?? "—"} já foi para a nota do pedido #${dados.vendas.find((x) => x.id === v.consolidadaEm)?.numero ?? "—"}. Cancele aquela NF-e antes de editar ou apagar.`
    : `O pedido #${v.numero ?? "—"} já tem a NF ${v.nfeNumero} autorizada. Cancele a NF-e antes de editar ou apagar.`;

  const editarVenda = (v) => {
    if (travadaPorNfe(v)) {
      alert(motivoTravada(v));
      return;
    }
    const loja = dados.lojas.find((l) => l.id === v.lojaId);
    setRedeId(loja?.redeId ?? "");
    setForm({ lojaId: v.lojaId, data: v.data, prazoDias: v.prazoDias, status: v.status, itens: v.itens ?? [], emitirNf: v.emitirNf ?? true, observacaoNf: v.observacaoNf ?? "", caixasIfco: v.caixasIfco || "" });
    setItem(ITEM_VAZIO);
    setEditandoId(v.id);
    setModal(true);
  };

  const apagarVenda = (v) => {
    if (travadaPorNfe(v)) {
      alert(motivoTravada(v));
      return;
    }
    // A NF-e cancelada é documento fiscal (SPED, XML do contador): o pedido
    // some, mas a nota vai para nfe_arquivadas e continua em Notas Fiscais.
    const arquivarNf = v.nfeStatus === "cancelada";
    const avisoNf = arquivarNf ? `\nA NF ${v.nfeNumero} (cancelada) continua na aba Notas Fiscais, para o SPED e o XML.` : "";
    if (!confirm(`Apagar o pedido #${v.numero ?? "—"} de ${nomeDoCliente(dados, v.lojaId)} (${brl(v.total)})?${avisoNf}\n\nNão dá para desfazer.`)) return;
    const loja = dados.lojas.find((l) => l.id === v.lojaId);
    const arquivada = arquivarNf && {
      id: v.id, numero: v.numero, lojaId: v.lojaId, data: v.data, total: v.total,
      clienteNome: nomeDoCliente(dados, v.lojaId), clienteCnpj: loja?.cnpjCpf ?? "",
      nfeStatus: v.nfeStatus, nfeNumero: v.nfeNumero, nfeSerie: v.nfeSerie, nfeChave: v.nfeChave,
      spedyId: v.spedyId, nfeEmitidaEm: v.nfeEmitidaEm, nfeMotivoCancelamento: v.nfeMotivoCancelamento,
      nfeCceEm: v.nfeCceEm, nfeCceTexto: v.nfeCceTexto, pedidoApagadoEm: new Date().toISOString(),
    };
    setDados((d) => ({
      ...d,
      vendas: d.vendas.filter((x) => x.id !== v.id),
      ...(arquivada && { nfe_arquivadas: [...(d.nfe_arquivadas ?? []).filter((x) => x.id !== v.id), arquivada] }),
    }));
  };

  const mudarStatus = (id, status) =>
    setDados((d) => ({ ...d, vendas: d.vendas.map((v) => (v.id === id ? { ...v, status } : v)) }));

  const [emitindoId, setEmitindoId] = useState(null);

  const contextoSpedy = (venda) => ({
    venda,
    loja: dados.lojas.find((l) => l.id === venda.lojaId),
    produtosPorId: Object.fromEntries(dados.produtos.map((p) => [p.id, p])),
  });

  // A venda no painel da Spedy é só o registro comercial: se falhar, a NF-e
  // (que é o que vale) já está feita — avisa e segue.
  const espelharVendaSpedy = (acao, promessa) =>
    promessa.catch((erro) =>
      alert(`A NF-e foi ${acao}, mas a venda não foi atualizada no painel da Spedy:\n${erro.message}`)
    );

  const emitirNfe = async (venda) => {
    if (venda.aguardandoConferencia) {
      alert(`O pedido #${venda.numero ?? "—"} veio do link do cliente: confira os preços (botão Conferir) antes de emitir a NF-e.`);
      return;
    }
    const ctx = contextoSpedy(venda);
    setEmitindoId(venda.id);
    try {
      const resultado = await emitirNfeParaVenda(ctx);
      setDados((d) => ({
        ...d,
        vendas: d.vendas.map((v) => (v.id === venda.id ? { ...v, ...resultado, nfeErro: "" } : v)),
      }));
      await espelharVendaSpedy("autorizada", registrarVendaSpedy(ctx));
    } catch (erro) {
      setDados((d) => ({
        ...d,
        vendas: d.vendas.map((v) =>
          v.id === venda.id ? { ...v, nfeStatus: "rejeitada", nfeErro: erro.message } : v
        ),
      }));
      alert(`Não deu para emitir a NF-e:\n${erro.message}`);
    } finally {
      setEmitindoId(null);
    }
  };

  const [cancelandoId, setCancelandoId] = useState(null);

  const cancelarNfe = async (venda) => {
    // Nota semanal: os pedidos que entraram junto ficam "soltos" de novo,
    // livres para entrar numa próxima nota.
    const consolidados = dados.vendas.filter((v) => v.consolidadaEm === venda.id);
    const avisoConsolidados = consolidados.length
      ? `\n\nOs pedidos ${consolidados.map((v) => `#${v.numero}`).join(", ")} que foram para esta nota voltam a ficar sem nota, para entrar numa próxima.`
      : "";
    const motivo = window.prompt(
      `Motivo do cancelamento da NF ${venda.nfeNumero} — a SEFAZ exige no mínimo 15 caracteres:${avisoConsolidados}`
    );
    if (!motivo || !motivo.trim()) return;
    if (motivo.trim().length < 15) {
      alert("O motivo precisa ter pelo menos 15 caracteres (exigência da SEFAZ) — tenta de novo com mais detalhe.");
      return;
    }
    setCancelandoId(venda.id);
    try {
      const resultado = await cancelarNfeDaVenda({ spedyId: venda.spedyId, motivo: motivo.trim() });
      setDados((d) => ({
        ...d,
        vendas: d.vendas.map((v) => {
          if (v.id === venda.id) return { ...v, ...resultado };
          if (v.consolidadaEm === venda.id) return { ...v, nfeStatus: "nao_emitida", consolidadaEm: null };
          return v;
        }),
      }));
      await espelharVendaSpedy("cancelada", cancelarVendaSpedy({ ...contextoSpedy(venda), motivo: motivo.trim() }));
    } catch (erro) {
      alert(`Não deu para cancelar a NF-e:\n${erro.message}`);
    } finally {
      setCancelandoId(null);
    }
  };

  // Nota semanal (Rede Primavera): pedido escolhido para fechar a semana
  // (abre o modal de escolha) e o recibo, que qualquer pedido dela pode
  // reimprimir a qualquer momento.
  const [fechandoSemana, setFechandoSemana] = useState(null);
  const [imprimindoReciboId, setImprimindoReciboId] = useState(null);

  const imprimirRecibo = async (venda) => {
    setImprimindoReciboId(venda.id);
    try {
      const loja = dados.lojas.find((l) => l.id === venda.lojaId);
      const rede = loja && dados.redes.find((r) => r.id === loja.redeId);
      await gerarReciboPdf({ venda, loja, rede, produtosPorId: Object.fromEntries(dados.produtos.map((p) => [p.id, p])) });
    } catch (erro) {
      alert(`Não foi possível gerar o recibo: ${erro?.message ?? erro}`);
    } finally {
      setImprimindoReciboId(null);
    }
  };

  const podeSalvar = form.lojaId && form.itens.length > 0;
  const statusOpts = ["todos", "pago", "pendente", "cancelado", "entrega", ...(aConferirDoCliente > 0 || filtroStatus === "cliente" ? ["cliente"] : [])];

  const colunasVendas = [
    { chave: "pedido", rotulo: "Pedido" },
    { chave: "cliente", rotulo: "Cliente" },
    { chave: "data", rotulo: "Data" },
    { chave: "hora", rotulo: "Hora" },
    { chave: "vencimento", rotulo: "Vencimento" },
    { chave: "itens", rotulo: "Itens" },
    { chave: "kg", rotulo: "Quilos" },
    { chave: "total", rotulo: "Total" },
    { chave: "status", rotulo: "Status" },
  ];
  const linhasVendas = ordenadas.map((v) => ({
    pedido: `#${v.numero ?? "—"}`,
    cliente: nomeDoCliente(dados, v.lojaId),
    data: formatarData(v.data),
    hora: horaDe(v.criadoEm),
    vencimento: rotuloVencimento(dados, v),
    itens: v.itens.length,
    kg: kg(v.kgTotal),
    total: brl(v.total),
    status: v.status,
  }));
  const nomeExportacao = `vendas-carvalho-cruz${filtroStatus === "todos" ? "" : `-${filtroStatus}`}`;
  const exportarVendasXlsx = () =>
    exportarXlsx(nomeExportacao, [{ nome: "Vendas", colunas: colunasVendas, linhas: linhasVendas }]);
  const exportarVendasPdf = () =>
    exportarPdf(nomeExportacao, "Vendas", [{ colunas: colunasVendas, linhas: linhasVendas }]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="cc-filtros" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <FiltroPills
          opcoes={statusOpts.map((s) => ({
            valor: s,
            rotulo: s === "todos" ? "Todas" : s === "cliente" ? `Do cliente (${aConferirDoCliente})` : s === "entrega" ? "Pendente entrega" : s.charAt(0).toUpperCase() + s.slice(1),
          }))}
          selecionado={filtroStatus}
          aoSelecionar={setFiltroStatus}
        />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <Select aria-label="Ordenar por" value={ordem} onChange={(e) => escolherOrdem(e.target.value)}
            style={{ padding: "7px 12px", fontSize: 13 }}
            options={ORDENS_VENDAS.map((o) => ({ value: o.valor, label: `Ordenar: ${o.rotulo}` }))} />
          <BotoesExportar aoExportarXlsx={exportarVendasXlsx} aoExportarPdf={exportarVendasPdf} />
          {/* Pedido de compra que o cliente manda em PDF (Atakarejo e outros): vira uma venda para conferir. */}
          <input ref={inputPdf} type="file" accept="application/pdf,.pdf" style={{ display: "none" }}
            onChange={(e) => importarPdf(e.target.files?.[0])} />
          <Btn variant="secondary" icon="anexo" onClick={() => inputPdf.current?.click()} disabled={lendoPdf}
            title="Lê o pedido de compra em PDF do cliente e já monta a venda para conferir">
            {lendoPdf ? "Lendo PDF…" : "Anexar PDF"}
          </Btn>
          <Btn icon="plus" onClick={() => setModal(true)}>Nova Venda</Btn>
        </div>
      </div>

      {aConferirDoCliente > 0 && filtroStatus !== "cliente" && (
        <div role="status" style={{ background: "#FFF3E0", border: `1px solid ${COLORS.laranja}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: COLORS.cinzaEscuro, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Icon name="alert" size={16} color={COLORS.laranjaEscuro} />
          <span style={{ flex: "1 1 220px" }}>
            <strong>{aConferirDoCliente} {aConferirDoCliente === 1 ? "pedido feito" : "pedidos feitos"} pelo cliente</strong> no link,
            {" "}aguardando conferência de preço.
          </span>
          <button onClick={() => setFiltroStatus("cliente")}
            style={{ background: COLORS.laranjaEscuro, color: COLORS.branco, border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            Ver pedidos
          </button>
        </div>
      )}

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <TabelaRolavel>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead style={{ background: COLORS.cinzaClaro }}>
              <tr>
                {["Pedido", "Cliente", "Data", "Venc.", "Itens", "Quilos", "Total", "Status", "NF-e", "Ações"].map((h) => (
                  <th key={h} style={{ textAlign: "left", fontSize: 12, color: COLORS.cinza, padding: "12px 14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((v) => {
                const venc = vencimentoDoPedido(dados, v);
                const atraso = diasDeAtraso(venc);
                const vencida = v.status === "pendente" && atraso > 0;
                const temBonificado = v.itens.some((i) => i.natureza === "bonificacao");
                const pedidoTodoBonificado = v.itens.length > 0 && v.itens.every((i) => i.natureza === "bonificacao");
                return (
                  <tr key={v.id}
                    onClick={(e) => {
                      // Botões e links da linha (NF, Confirmar, Apagar…) mantêm a ação própria.
                      if (e.target.closest("button, a, input, select")) return;
                      travadaPorNfe(v) ? setDetalheId(v.id) : editarVenda(v);
                    }}
                    style={{ borderTop: `1px solid ${COLORS.cinzaClaro}`, background: v.aguardandoConferencia ? "#FFF8EE" : undefined, cursor: "pointer" }}>
                    <td style={{ padding: "13px 14px", color: COLORS.cinza, fontSize: 13, fontWeight: 600 }}>#{v.numero ?? "—"}</td>
                    <td style={{ padding: "13px 14px", color: COLORS.cinzaEscuro, fontSize: 14 }}>
                      {nomeDoCliente(dados, v.lojaId)}
                      {temBonificado && <ChipBonificado />}
                      {v.origem === "cliente" && <ChipPedidoCliente conferir={v.aguardandoConferencia} />}
                      {v.veiculoId && <ChipRomaneio veiculo={dados.veiculos.find((x) => x.id === v.veiculoId)?.nome} />}
                      {v.pedidoPor && (
                        <div style={{ fontSize: 11, color: COLORS.cinza, marginTop: 2 }}>Pedido por <strong>{v.pedidoPor}</strong></div>
                      )}
                      {v.observacao && (
                        <div style={{ fontSize: 11, color: COLORS.cinza, marginTop: 2, maxWidth: 260 }} title={v.observacao}>
                          “{v.observacao.length > 60 ? `${v.observacao.slice(0, 60)}…` : v.observacao}”
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "13px 14px", color: COLORS.cinza, fontSize: 13, whiteSpace: "nowrap" }}>
                      {formatarData(v.data)}
                      <div style={{ fontSize: 11, color: COLORS.cinza }}>{horaDe(v.criadoEm)}</div>
                    </td>
                    <td style={{ padding: "13px 14px", fontSize: 13, whiteSpace: "nowrap", color: vencida ? COLORS.vermelho : COLORS.cinza, fontWeight: vencida ? 700 : 400 }}>
                      {rotuloVencimento(dados, v)}
                      {vencida && <div style={{ fontSize: 11 }}>{atraso}d atraso</div>}
                    </td>
                    <td style={{ padding: "13px 14px", color: COLORS.cinza, fontSize: 13, whiteSpace: "nowrap" }}>
                      {v.itens.length} {v.itens.length === 1 ? "item" : "itens"}
                    </td>
                    <td style={{ padding: "13px 14px", color: COLORS.cinzaEscuro, fontSize: 13, whiteSpace: "nowrap" }}>{kg(v.kgTotal)}</td>
                    <td style={{ padding: "13px 14px", fontWeight: 700, color: COLORS.verde, whiteSpace: "nowrap" }}>{brl(v.total)}</td>
                    <td style={{ padding: "13px 14px" }}><Badge status={v.status} /></td>
                    <td style={{ padding: "13px 14px", fontSize: 12, whiteSpace: "nowrap" }}>
                      {v.nfeStatus === "autorizada" ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <a href={v.nfeDanfeUrl} target="_blank" rel="noreferrer"
                            style={{ color: COLORS.verde, fontWeight: 600, textDecoration: "none" }}>
                            NF {v.nfeNumero}
                          </a>
                          <button onClick={() => cancelarNfe(v)} disabled={cancelandoId === v.id}
                            style={{
                              background: "none", border: "none", padding: 0,
                              color: COLORS.cinza, fontSize: 11, textDecoration: "underline",
                              cursor: cancelandoId === v.id ? "wait" : "pointer",
                            }}>
                            {cancelandoId === v.id ? "Cancelando…" : "Cancelar"}
                          </button>
                        </div>
                      ) : v.nfeStatus === "cancelada" ? (
                        <span style={{ color: COLORS.cinza }} title={v.nfeMotivoCancelamento}>
                          NF {v.nfeNumero} cancelada
                        </span>
                      ) : v.status === "cancelado" ? (
                        <span style={{ color: COLORS.cinza }}>—</span>
                      ) : v.aguardandoConferencia ? (
                        // Pedido do link: o preço veio da última venda e só vale depois de conferido.
                        <span style={{ color: COLORS.laranjaEscuro, fontWeight: 600 }} title="Confira os preços (botão Conferir) para liberar a NF-e">
                          Conferir preços antes
                        </span>
                      ) : v.nfeStatus === "consolidada" ? (
                        // Nota semanal: este pedido não tem NF-e própria, foi para a do pedido âncora.
                        <span style={{ color: COLORS.cinza }} title="Este pedido não tem NF-e própria: entrou na nota da semana">
                          Nota no #{dados.vendas.find((x) => x.id === v.consolidadaEm)?.numero ?? "—"}
                        </span>
                      ) : pedidoTodoBonificado ? (
                        // Bonificação não é venda: não gera NF-e, só o recibo (botão na coluna Ações).
                        <span style={{ color: COLORS.cinza }} title="Pedido só de bonificação: não gera NF-e">
                          Bonificação, sem NF-e
                        </span>
                      ) : v.emitirNf === false ? (
                        // Cliente que pediu para não emitir NF (checkbox "Emitir NF" desmarcado): só recibo, sempre.
                        <span style={{ color: COLORS.cinza }} title="Este cliente não recebe NF-e: só o recibo do pedido">
                          Sem NF-e, só recibo
                        </span>
                      ) : ehNotaSemanal(dados, v.lojaId) ? (
                        <button onClick={() => setFechandoSemana(v)}
                          title="Esta rede recebe um recibo a cada pedido; a NF-e sai uma vez só, juntando a semana"
                          style={{ background: COLORS.cinzaClaro, border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: COLORS.cinzaEscuro, fontSize: 12, fontWeight: 600 }}>
                          Fechar semana
                        </button>
                      ) : (
                        <button onClick={() => emitirNfe(v)} disabled={emitindoId === v.id}
                          title={v.nfeStatus === "rejeitada" ? v.nfeErro : ""}
                          style={{
                            background: v.nfeStatus === "rejeitada" ? "#FFEBEE" : COLORS.cinzaClaro,
                            border: "none", borderRadius: 6, padding: "4px 10px",
                            cursor: emitindoId === v.id ? "wait" : "pointer",
                            color: v.nfeStatus === "rejeitada" ? COLORS.vermelho : COLORS.cinzaEscuro,
                            fontSize: 12, fontWeight: 600,
                          }}>
                          {emitindoId === v.id
                            ? "Emitindo…"
                            : v.nfeStatus === "rejeitada" ? "Tentar de novo" : "Emitir NF-e"}
                        </button>
                      )}
                    </td>
                    <td style={{ padding: "13px 14px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        {/* Venda a prazo se confirma na aba Cobrança; a à vista não aparece lá, então fica aqui. */}
                        {v.aguardandoConferencia && !travadaPorNfe(v) && (
                          <button onClick={() => editarVenda(v)}
                            style={{ background: COLORS.laranjaEscuro, border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: COLORS.branco, fontSize: 12, fontWeight: 600 }}>
                            Conferir
                          </button>
                        )}
                        {v.status === "pendente" && !(Number(v.prazoDias) > 0) && !v.aguardandoConferencia && (
                          <button onClick={() => mudarStatus(v.id, "pago")}
                            style={{ background: COLORS.verdePale, border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: COLORS.verde, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                            Confirmar
                          </button>
                        )}
                        {!travadaPorNfe(v) && !v.aguardandoConferencia && (
                          <button onClick={() => editarVenda(v)}
                            style={{ background: COLORS.cinzaClaro, border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: COLORS.cinzaEscuro, fontSize: 12, fontWeight: 600 }}>
                            Editar
                          </button>
                        )}
                        {/* Quem não pode excluir registros continua só cancelando o pedido. */}
                        {!travadaPorNfe(v) && podeRemover && (
                          <button onClick={() => apagarVenda(v)}
                            style={{ background: "#FFEBEE", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: COLORS.vermelho, fontSize: 12, fontWeight: 600 }}>
                            Apagar
                          </button>
                        )}
                        {!travadaPorNfe(v) && !podeRemover && v.status === "pendente" && (
                          <button onClick={() => mudarStatus(v.id, "cancelado")}
                            style={{ background: "#FFEBEE", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", color: COLORS.vermelho, fontSize: 12, fontWeight: 600 }}>
                            Cancelar
                          </button>
                        )}
                        {/* Recibo: o documento sem valor fiscal — de cada entrega de quem só ganha NF-e no fim da
                            semana, do pedido inteiro quando ele é só bonificação, ou de quem pediu para nunca
                            emitir NF (checkbox "Emitir NF" desmarcado ao registrar a venda). */}
                        {v.status !== "cancelado" && (ehNotaSemanal(dados, v.lojaId) || pedidoTodoBonificado || v.emitirNf === false) && (
                          <button onClick={() => imprimirRecibo(v)} disabled={imprimindoReciboId === v.id}
                            style={{ background: COLORS.cinzaClaro, border: "none", borderRadius: 6, padding: "4px 10px", cursor: imprimindoReciboId === v.id ? "wait" : "pointer", color: COLORS.cinzaEscuro, fontSize: 12, fontWeight: 600 }}>
                            {imprimindoReciboId === v.id ? "Gerando…" : "Recibo"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TabelaRolavel>
        {ordenadas.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.cinza }}>Nenhuma venda encontrada.</div>
        )}
      </Card>

      {detalheId && (() => {
        const d = dados.vendas.find((x) => x.id === detalheId);
        if (!d) return null;
        return <DetalhePedidoModal venda={d} dados={dados} setDados={setDados} aviso={motivoTravada(d)} onClose={() => setDetalheId(null)} />;
      })()}

      {modal && (
        <Modal title={editandoId ? `Editar Pedido #${dados.vendas.find((v) => v.id === editandoId)?.numero ?? "—"}` : importacao ? "Nova Venda — do PDF" : "Nova Venda"} onClose={fechar}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {importacao && (
              <ConferenciaPdf importacao={importacao} total={total} lojaEscolhida={Boolean(form.lojaId)}
                produtos={dados.produtos} aoEscolher={resolverPendente} aoIgnorar={ignorarPendente} />
            )}
            {conferindo && (
              <div style={{ background: "#FFF3E0", border: `1px solid ${COLORS.laranja}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: COLORS.cinzaEscuro, lineHeight: 1.5 }}>
                <strong>Pedido feito pelo cliente no link{vendaEditada?.pedidoPor ? ` por ${vendaEditada.pedidoPor}` : ""}.</strong> O preço veio da última venda do produto para
                esta loja (ou rede) — confira cada item e o prazo, e salve para confirmar.
              </div>
            )}
            {vendaEditada?.observacao && (
              <div style={{ background: COLORS.creme, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: COLORS.cinzaEscuro }}>
                <div style={{ fontSize: 11, color: COLORS.cinza, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 2 }}>Observação do cliente</div>
                {vendaEditada.observacao}
              </div>
            )}
            {/* Cliente: rede primeiro, loja depois — como na planilha */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Select label="Rede *" value={redeId}
                onChange={(e) => { setRedeId(e.target.value); setForm((f) => ({ ...f, lojaId: "" })); }}
                options={[{ value: "", label: "Selecione..." },
                  ...dados.redes.filter((r) => r.status === "ativo" || r.id === redeId)
                    .sort((a, b) => a.nome.localeCompare(b.nome))
                    .map((r) => ({ value: r.id, label: r.nome }))]} />
              <Select label="Loja *" value={form.lojaId} disabled={!redeId}
                onChange={(e) => {
                  const lojaId = e.target.value;
                  // Pedido novo já vem com o prazo do cliente; dá para trocar no campo ao lado.
                  const prazo = !editandoId && lojaId ? prazoCombinado(lojaId, redeId) : null;
                  setForm((f) => ({ ...f, lojaId, ...(prazo != null && { prazoDias: prazo }) }));
                }}
                style={{ opacity: redeId ? 1 : 0.55 }}
                options={[{ value: "", label: redeId ? "Selecione..." : "Escolha a rede antes" },
                  ...lojasDaRede.map((l) => ({ value: l.id, label: l.nome }))]} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(130px, 100%), 1fr))", gap: 12 }}>
              {/* A data do pedido é o dia da ENTREGA: é por ela que o Painel conta
                  «Vendas hoje», o Romaneio monta a rota e o estoque sabe o que é
                  de amanhã. Pedido lançado hoje para entregar amanhã leva amanhã. */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <Input label="Data de entrega" type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
                <div style={{ display: "flex", gap: 6 }}>
                  {[["Hoje", hojeISO()], ["Amanhã", diaSeguinteISO()]].map(([rotulo, dia]) => (
                    <button key={rotulo} type="button" onClick={() => setForm((f) => ({ ...f, data: dia }))}
                      style={{ flex: 1, padding: "3px 0", borderRadius: 6, fontSize: 11.5, cursor: "pointer",
                        border: `1px solid ${form.data === dia ? COLORS.verde : COLORS.cinzaClaro}`,
                        background: form.data === dia ? COLORS.verde : COLORS.branco,
                        color: form.data === dia ? COLORS.branco : COLORS.cinza }}>
                      {rotulo}
                    </button>
                  ))}
                </div>
              </div>
              {!todoBonificado && (
                <Select label="Prazo" value={String(form.prazoDias)}
                  onChange={(e) => setForm((f) => ({ ...f, prazoDias: Number(e.target.value) }))}
                  options={PRAZOS.map((d) => ({ value: String(d), label: rotuloPrazo(d) }))} />
              )}
              <Select label="Status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                options={["pendente", "pago", ...(form.status === "cancelado" ? ["cancelado"] : [])]
                  .map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }))} />
            </div>

            <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: -6 }}>
              {todoBonificado
                ? "Pedido só de bonificação não é venda: não tem prazo nem vencimento."
                : ehNotaSemanal(dados, form.lojaId) && form.emitirNf
                  ? "Este pedido não tem vencimento próprio: o prazo só começa a contar quando a semana fechar (Vendas → Fechar semana)."
                  : <>Vence em <strong style={{ color: COLORS.cinzaEscuro }}>{formatarData(vencimentoDe(form.data, form.prazoDias))}</strong></>}
            </div>

            {/* Cliente que não quer nota — só recibo de cada entrega. */}
            {!todoBonificado && (
              <div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: COLORS.cinzaEscuro, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.emitirNf}
                    onChange={(e) => setForm((f) => ({ ...f, emitirNf: e.target.checked }))} />
                  Emitir NF
                </label>
                {!form.emitirNf && (
                  <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: 4 }}>
                    Sem NF: este pedido sai só com recibo (sem valor fiscal), com espaço para anotar a
                    quantidade de caixas plásticas na entrega.
                  </div>
                )}
              </div>
            )}

            {/* Vai no campo "Informações complementares" da NF-e, junto da
                observação de isenção. */}
            {!todoBonificado && form.emitirNf && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.cinzaEscuro }}>Observação (sai na NF-e)</label>
                <textarea value={form.observacaoNf} rows={2} maxLength={500}
                  onChange={(e) => setForm((f) => ({ ...f, observacaoNf: e.target.value }))}
                  placeholder="Ex.: número do pedido de compra, troca, instrução de entrega..."
                  style={{ border: `1.5px solid ${COLORS.cinzaClaro}`, borderRadius: 8, padding: "9px 13px", fontSize: 14, outline: "none", color: COLORS.cinzaEscuro, background: COLORS.branco, fontFamily: "inherit", resize: "vertical" }} />
              </div>
            )}

            {/* Só aparece para cliente com taxa "R$ por caixa" — nem toda fruta usa IFCO. */}
            {!todoBonificado && cobraPorCaixa && (
              <Input label="Caixas IFCO neste pedido" type="number" inputMode="numeric" min="0" step="1" placeholder="0 = não usou IFCO"
                value={form.caixasIfco} onChange={(e) => setForm((f) => ({ ...f, caixasIfco: e.target.value }))} />
            )}

            {/* Itens */}
            <div style={{ borderTop: `1px solid ${COLORS.cinzaClaro}`, paddingTop: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: COLORS.cinzaEscuro }}>Itens do Pedido</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <Select label="Produto" value={item.produtoId} onChange={(e) => escolherProduto(e.target.value)}
                  options={[{ value: "", label: "Selecionar..." },
                    // Produção própria primeiro, depois a revenda da CVC, marcada
                    // para não se misturar.
                    ...[...dados.produtos]
                      .sort((a, b) => ordemNaVenda(a) - ordemNaVenda(b) || a.nome.localeCompare(b.nome, "pt-BR"))
                      .map((p) => ({
                        value: p.id,
                        label: p.empresa === "carvalho_cruz" ? `${p.nome} · Carvalho` : p.nome,
                      }))]} />
                <Select label="Natureza" value={item.natureza} onChange={(e) => mudarNatureza(e.target.value)}
                  options={[{ value: "venda", label: "Venda" }, { value: "bonificacao", label: "Bonificação" }]} />
              </div>

              {/* Agranel pode sair por quilo ou, para alguns clientes, por unidade */}
              {agranel && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <Select label="Vender por" value={item.unidade} onChange={(e) => mudarUnidade(e.target.value)}
                    options={[{ value: "kg", label: "Quilo (kg)" }, { value: "un", label: "Unidade (un)" }]} />
                  {porUnidade && (
                    <Input label="Peso médio (kg / unid.)" type="number" min="0" step="0.01"
                      value={item.pesoUnidade} onChange={(e) => setItem((f) => ({ ...f, pesoUnidade: e.target.value }))} />
                  )}
                </div>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-end" }}>
                <div style={{ flex: "1 1 110px" }}>
                  <Input label={`Qtd (${rotuloUnidade(produtoDoItem, 2, porUnidade ? "un" : undefined)})`} type="number" min="0"
                    step={porUnidade ? "1" : "0.01"}
                    value={item.qty} onChange={(e) => setItem((f) => ({ ...f, qty: e.target.value }))} />
                </div>
                <div style={{ flex: "1 1 110px" }}>
                  <Input label={`R$ / ${porUnidade ? "unid." : produtoDoItem ? rotuloUnidade(produtoDoItem, 1) : "kg"}`} type="number" min="0" step="0.01"
                    value={bonificado ? "0" : item.precoUnitario} disabled={bonificado}
                    style={{ opacity: bonificado ? 0.55 : 1 }}
                    onChange={(e) => setItem((f) => ({ ...f, precoUnitario: e.target.value }))} />
                </div>
                <Btn variant="ghost" onClick={addItem} style={{ whiteSpace: "nowrap" }}>Adicionar</Btn>
              </div>

              {/* A conversão saco → quilo, visível antes de confirmar */}
              {produtoDoItem && kgPrevia > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: COLORS.verde, background: COLORS.verdePale, borderRadius: 6, padding: "7px 11px" }}>
                  {produtoDoItem.unidadeVenda === "saco"
                    ? `${item.qty} sacos × ${kg(produtoDoItem.kgPorUnidade)} = ${kg(kgPrevia)}`
                    : porUnidade
                      ? `${item.qty} unid. × ${kg(Number(item.pesoUnidade))} ≈ ${kg(kgPrevia)}`
                      : `${kg(kgPrevia)}`}
                  {!bonificado && item.precoUnitario !== "" && (
                    <> · <strong>{brl(Number(item.qty) * Number(item.precoUnitario))}</strong></>
                  )}
                  {bonificado && <> · <strong>bonificado, sem cobrança</strong></>}
                </div>
              )}

              {form.itens.length > 0 && (
                <div style={{ marginTop: 12, background: COLORS.creme, borderRadius: 8, padding: 12 }}>
                  {form.itens.map((i) => {
                    const p = dados.produtos.find((x) => x.id === i.produtoId);
                    const bonif = i.natureza === "bonificacao";
                    return (
                      <div key={chaveDoItem(i)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, marginBottom: 8, gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: COLORS.cinzaEscuro }}>
                            {p?.nome} × {i.qty} {rotuloUnidade(p, i.qty, i.unidade)}
                            {bonif && <ChipBonificado />}
                          </div>
                          <div style={{ fontSize: 11, color: COLORS.cinza }}>
                            {kg(i.kgTotal)}
                            {!bonif && <> · {brl(i.precoUnitario)}/{rotuloUnidade(p, 1, i.unidade)}</>}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          {conferindo && !bonif && (
                            <input type="number" min="0" step="0.01" aria-label={`Preço de ${p?.nome ?? "item"}`}
                              value={i.precoUnitario || ""} placeholder="R$"
                              onChange={(e) => mudarPrecoItem(chaveDoItem(i), e.target.value)}
                              style={{ width: 82, border: `1.5px solid ${Number(i.precoUnitario) > 0 ? COLORS.cinzaClaro : COLORS.vermelho}`, borderRadius: 6, padding: "4px 7px", fontSize: 13 }} />
                          )}
                          <span style={{ fontWeight: 600, color: bonif ? COLORS.cinza : COLORS.verde }}>
                            {bonif ? "—" : brl(i.qty * i.precoUnitario)}
                          </span>
                          <button onClick={() => removerItem(chaveDoItem(i))}
                            style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.45, padding: 0 }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.45")}>
                            <Icon name="trash" color={COLORS.vermelho} size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ borderTop: `1px solid ${COLORS.cinzaClaro}`, marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                    <span>{kg(kgTotal)}</span>
                    <span style={{ color: COLORS.verde }}>{brl(total)}</span>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn variant="secondary" onClick={fechar}>Cancelar</Btn>
              <Btn onClick={salvar} style={{ opacity: podeSalvar && !(conferindo && semPreco.length) ? 1 : 0.5 }}>
                {conferindo ? "Confirmar pedido" : editandoId ? "Salvar Alterações" : "Registrar Venda"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {fechandoSemana && (
        <FecharSemanaModal dados={dados} setDados={setDados} vendaInicial={fechandoSemana} onClose={() => setFechandoSemana(null)} />
      )}
    </div>
  );
};

/**
 * Nota semanal (Rede Primavera e afins, ver lib/notaSemanal.js): junta os
 * pedidos da loja ainda sem NF-e numa nota só, emitida a partir de `vendaInicial`
 * (o pedido de onde a pessoa clicou "Fechar semana"). Os outros pedidos
 * escolhidos não ganham NF-e própria — ficam marcados como consolidados no
 * pedido âncora, que é quem leva os campos nfe_* de verdade.
 */
const FecharSemanaModal = ({ dados, setDados, vendaInicial, onClose }) => {
  const pendentes = useMemo(() => pedidosParaFecharSemana(dados, vendaInicial), [dados, vendaInicial]);
  const [marcados, setMarcados] = useState(() => new Set(pendentes.map((p) => p.id)));
  const [emitindo, setEmitindo] = useState(false);

  const loja = dados.lojas.find((l) => l.id === vendaInicial.lojaId);
  const rede = loja && dados.redes.find((r) => r.id === loja.redeId);
  const produtosPorId = useMemo(() => Object.fromEntries(dados.produtos.map((p) => [p.id, p])), [dados.produtos]);

  const alternar = (id) => {
    // O pedido de onde se abriu o fechamento sempre entra — não dá para
    // "fechar a semana" sem incluir o próprio pedido clicado.
    if (id === vendaInicial.id) return;
    setMarcados((m) => {
      const novo = new Set(m);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  };

  const selecionados = pendentes.filter((p) => marcados.has(p.id));
  const total = selecionados.reduce((s, p) => s + (Number(p.total) || 0), 0);
  const kgTotal = selecionados.reduce((s, p) => s + (Number(p.kgTotal) || 0), 0);

  const fechar = async () => {
    if (!selecionados.length || !loja) return;
    // As observações de NF de cada pedido da semana vão todas na nota, sem repetir.
    const observacaoNf = [...new Set(selecionados.map((p) => (p.observacaoNf ?? "").trim()).filter(Boolean))].join(" | ");
    const ctx = { venda: { ...vendaInicial, itens: mesclarItensPedidos(selecionados), observacaoNf }, loja, produtosPorId };
    setEmitindo(true);
    try {
      const resultado = await emitirNfeParaVenda(ctx);
      const outrosIds = selecionados.filter((p) => p.id !== vendaInicial.id).map((p) => p.id);
      setDados((d) => ({
        ...d,
        vendas: d.vendas.map((v) => {
          if (v.id === vendaInicial.id) return { ...v, ...resultado, nfeErro: "" };
          if (outrosIds.includes(v.id)) return { ...v, nfeStatus: "consolidada", consolidadaEm: vendaInicial.id, nfeErro: "" };
          return v;
        }),
      }));
      await registrarVendaSpedy(ctx).catch((erro) =>
        alert(`A NF-e foi autorizada, mas a venda não foi atualizada no painel da Spedy:\n${erro.message}`)
      );
      onClose();
    } catch (erro) {
      setDados((d) => ({
        ...d,
        vendas: d.vendas.map((v) => (v.id === vendaInicial.id ? { ...v, nfeStatus: "rejeitada", nfeErro: erro.message } : v)),
      }));
      alert(`Não deu para emitir a nota da semana:\n${erro.message}`);
    } finally {
      setEmitindo(false);
    }
  };

  return (
    <Modal title={`Fechar semana — pedido #${vendaInicial.numero ?? "—"}`} onClose={emitindo ? () => {} : onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 13, color: COLORS.cinzaEscuro, lineHeight: 1.5 }}>
          Uma NF-e só, com os itens de todos os pedidos marcados abaixo, de{" "}
          <strong>{rede ? `${rede.nome} · ${loja?.nome}` : loja?.nome}</strong>. Os pedidos desmarcados continuam sem
          nota, para entrar numa próxima.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {pendentes.map((p) => (
            <label key={p.id} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8,
              background: marcados.has(p.id) ? COLORS.verdePale : COLORS.cinzaClaro, fontSize: 13, cursor: p.id === vendaInicial.id ? "default" : "pointer",
            }}>
              <input type="checkbox" checked={marcados.has(p.id)} disabled={p.id === vendaInicial.id} onChange={() => alternar(p.id)} />
              <span style={{ flex: 1, color: COLORS.cinzaEscuro }}>
                Pedido #{p.numero ?? "—"} · {formatarData(p.data)}
                {p.id === vendaInicial.id && <span style={{ color: COLORS.cinza }}> (este)</span>}
              </span>
              <span style={{ color: COLORS.cinza }}>{kg(p.kgTotal)}</span>
              <strong style={{ color: COLORS.cinzaEscuro, minWidth: 80, textAlign: "right" }}>{brl(p.total)}</strong>
            </label>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: COLORS.cinza, lineHeight: 1.5 }}>
          <Icon name="alert" size={15} color={COLORS.cinza} />
          <span>
            Os pedidos marcados recebem só o recibo (sem valor fiscal); a NF-e sai uma vez, com o vencimento do
            pedido #{vendaInicial.numero ?? "—"} ({rotuloPrazo(vendaInicial.prazoDias)}).
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <strong style={{ color: COLORS.cinzaEscuro }}>{kg(kgTotal)} · {brl(total)}</strong>
            <div style={{ fontSize: 12, color: COLORS.cinza }}>{selecionados.length} {selecionados.length === 1 ? "pedido" : "pedidos"}</div>
          </div>
          <Btn onClick={fechar} disabled={!selecionados.length || emitindo}>
            {emitindo ? "Emitindo…" : "Emitir NF-e da semana"}
          </Btn>
        </div>
      </div>
    </Modal>
  );
};

// ─── Romaneio ────────────────────────────────────────────────────────────────
//
// Rastreio de cada entrega, do centro de distribuição até a loja. A venda já
// É a nota — não existe tabela nova — e o QR impresso nela carrega o mesmo
// uuid que identifica o pedido em tudo mais. O motorista escaneia duas vezes:
//
//     pendente  -[1º escaneio, saindo do CD]->  em_rota
//     em_rota   -[2º escaneio, entregando]->    entregue
//
// Por isso existe um botão só de "Escanear", não dois: quem decide o que
// aquele escaneio significa é o status que a venda já tem.

const STATUS_ENTREGA_LABEL = { pendente: "Pendente", carregando: "Carregando", em_rota: "Em rota", entregue: "Entregue", retirado_cd: "Retirado no CD" };

const BadgeEntrega = ({ status }) => {
  const mapa = {
    pendente: { bg: COLORS.cinzaClaro, cor: COLORS.cinza },
    carregando: { bg: "#DCEEFB", cor: COLORS.azul },
    em_rota: { bg: "#FFF3CD", cor: "#856404" },
    entregue: { bg: COLORS.verdePale, cor: COLORS.verde },
    retirado_cd: { bg: COLORS.douradoClaro, cor: COLORS.dourado },
  };
  const s = mapa[status] ?? mapa.pendente;
  return (
    <span style={{ background: s.bg, color: s.cor, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
      {STATUS_ENTREGA_LABEL[status] ?? status}
    </span>
  );
};

const horaDe = (iso) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—");

/** De onde toda entrega sai — fixo como origem no link do Maps, em vez de
 * depender de onde o celular do motorista estiver no momento de abrir. */
const ENDERECO_CD = "Av. Tiradentes, 659, América, Aracaju-SE, 49082-600";

// Geocodificado uma vez só (é sempre o mesmo endereço) e guardado aqui —
// fora do componente pra sobreviver a re-renders sem pedir de novo ao
// Nominatim a cada vez que alguém reordena ou abre o mapa de uma rota.
let coordenadaCdEmCache = null;
const coordenadaCD = async () => {
  if (coordenadaCdEmCache) return coordenadaCdEmCache;
  coordenadaCdEmCache = await geocodificarEndereco(ENDERECO_CD).catch(() => null);
  return coordenadaCdEmCache;
};

/** Endereço em texto corrido, do jeito que o Google Maps geocodifica melhor. */
const enderecoParaMaps = (loja) => {
  if (!loja) return "";
  // Número com complemento junto (ex: "400 - Loja B") trava a geocodificação —
  // o Maps quer só o número da rua; o complemento não ajuda a achar o lugar.
  const numero = String(loja.numero ?? "").match(/\d+/)?.[0] ?? "";
  const partes = [
    [loja.logradouro, numero].filter(Boolean).join(", "),
    loja.bairro,
    [loja.cidade, loja.uf].filter(Boolean).join("-"),
    loja.cep,
  ].filter(Boolean);
  return partes.join(", ");
};

/** Endereço mais largo (bairro/cidade/UF, sem rua/número/CEP) — tentativa de
 * geocodificação quando o completo não acha nada. Pelo menos localiza o
 * bairro no mapa, o que já é bem melhor que a loja sumir sem explicação. */
const enderecoAproximado = (loja) => {
  if (!loja) return "";
  return [loja.bairro, [loja.cidade, loja.uf].filter(Boolean).join("-")].filter(Boolean).join(", ");
};

// Sentinela do Select de motorista: escolhido quando quem vai dirigir não é
// um funcionário cadastrado (ajuda avulsa, terceiro) — aí o nome digitado
// entra em `motoristaNome`, e `motoristaId` fica vazio.
const MOTORISTA_OUTRO = "__outro__";

// Quantos dias pra trás o Romaneio procura rota que não terminou (ver
// `sobrasRota`) — mesma janela da função `rotas_nao_concluidas` do motorista.
const DIAS_SOBRAS_ROTA = 7;

const Romaneio = ({ dados, setDados }) => {
  const { papel } = useAuth();
  const podeForcarEntrega = papel === "socio_master" || papel === "assistente_administrativo";
  const [data, setData] = useState(hojeISO());
  const [modalRota, setModalRota] = useState(false);
  const [veiculoRota, setVeiculoRota] = useState("");
  const [motoristaRota, setMotoristaRota] = useState("");
  const [motoristaRotaNome, setMotoristaRotaNome] = useState("");
  const [selecionadas, setSelecionadas] = useState([]);
  const [selecionadasParadas, setSelecionadasParadas] = useState([]);
  // Parada sendo arrastada na rota: { veiculoId, id, destino } — "destino" é
  // o índice da linha antes da qual ela vai cair (paradas.length = no fim).
  const [arrasto, setArrasto] = useState(null);
  const [selecionadasRetirada, setSelecionadasRetirada] = useState([]);
  const [modalMoverParadas, setModalMoverParadas] = useState(false);
  const [veiculoDestino, setVeiculoDestino] = useState("");
  const [motoristaDestino, setMotoristaDestino] = useState("");
  const [motoristaDestinoNome, setMotoristaDestinoNome] = useState("");
  const [geocodificando, setGeocodificando] = useState(false);
  const [mapaAberto, setMapaAberto] = useState(null);
  const [scanAberto, setScanAberto] = useState(false);
  const [mensagemScan, setMensagemScan] = useState(null);
  const [leituraPendente, setLeituraPendente] = useState(null);
  const [qrAberto, setQrAberto] = useState(null);
  const [imprimindo, setImprimindo] = useState(null);
  // Romaneio avulso: escala 1 pedido só (sem passar pela seleção em massa do
  // "Montar Rota") e já sai com o QR/romaneio na mão — vira uma rota de
  // verdade (mesma lógica de viagem), só que num clique (ver `confirmarAvulso`).
  const [modalAvulso, setModalAvulso] = useState(false);
  const [detalheId, setDetalheId] = useState(null);
  const [pedidoAvulso, setPedidoAvulso] = useState("");
  const [veiculoAvulso, setVeiculoAvulso] = useState("");
  const [motoristaAvulso, setMotoristaAvulso] = useState("");
  const [motoristaAvulsoNome, setMotoristaAvulsoNome] = useState("");
  const [qrAvulso, setQrAvulso] = useState(null);
  const [gerandoAvulso, setGerandoAvulso] = useState(false);
  // Veículo (e viagem) fixos quando o modal de montar rota foi aberto pelo
  // "Adicionar loja" de uma rota que já existe — aí não se escolhe veículo
  // nem viagem de novo, entra direto naquela parada específica.
  const [veiculoFixo, setVeiculoFixo] = useState(null);
  const [viagemFixa, setViagemFixa] = useState(null);
  // Marcado quando o veículo escolhido já tem uma rota em aberto hoje e a
  // pessoa quer mesmo assim uma 2ª viagem separada, em vez de só somar mais
  // paradas na que já está rodando (ver `ultimaViagemDoVeiculo` e `confirmarRota`).
  const [novaViagem, setNovaViagem] = useState(false);
  const [buscaRota, setBuscaRota] = useState("");
  // Rotas mexidas (loja incluída ou tirada) depois do último romaneio gerado:
  // o papel na mão do motorista ficou velho, e a tela oferece gerar outro.
  // Chave `${data}|${veiculoId}|${viagem}`, pra não misturar dias nem viagens.
  const [rotasAlteradas, setRotasAlteradas] = useState([]);

  const chaveRota = (veiculoId, viagem) => `${data}|${veiculoId}|${viagem}`;
  const marcarAlterada = (...grupos) =>
    setRotasAlteradas((r) => [...new Set([...r, ...grupos.filter((g) => g?.veiculoId).map((g) => chaveRota(g.veiculoId, g.viagem ?? 1))])]);
  const desmarcarAlterada = (veiculoId, viagem) => setRotasAlteradas((r) => r.filter((k) => k !== chaveRota(veiculoId, viagem)));
  const rotaAlterada = (veiculoId, viagem) => rotasAlteradas.includes(chaveRota(veiculoId, viagem));

  const veiculosAtivos = dados.veiculos.filter((v) => v.status === "ativo");
  const funcionariosAtivos = dados.funcionarios.filter((f) => f.status === "ativo");
  // Só quem tem a função Motorista — os demais funcionários não aparecem
  // pra escalar rota, mesmo que estejam ativos. Marque a função na Folha de
  // Pagamento pra a pessoa aparecer aqui.
  const motoristas = funcionariosAtivos.filter((f) => f.funcao === "Motorista");
  const nomeVeiculo = (id) => dados.veiculos.find((v) => v.id === id)?.nome ?? "—";
  const nomeMotorista = (id) => dados.funcionarios.find((f) => f.id === id)?.nome ?? "—";
  // Parada pode ter motoristaId (funcionário) ou, quando foi escalado "Outro"
  // no modal, só motoristaNome (texto livre).
  const nomeMotoristaDaVenda = (venda) => (venda?.motoristaId ? nomeMotorista(venda.motoristaId) : venda?.motoristaNome || "—");

  // "semRota" e "comRota" são sobre a VIAGEM, não o pedido: um pedido de
  // ontem que ainda não saiu entra no backlog de hoje (data <= data
  // selecionada), e uma vez escalado, o que importa é `rotaData` — o dia em
  // que o veículo de fato roda —, não mais o dia em que o pedido foi feito.
  const porPrioridade = (a, b) => (b.prioridade ? 1 : 0) - (a.prioridade ? 1 : 0);

  // A ordem da parada (posição na rota) ainda pode mudar depois do 1º
  // escaneio (carregando) e depois do motorista apertar "Iniciar rota"
  // (em_rota) — só trava quando entrega, que já é história. É por isso que
  // dá pra reordenar (arrastar) um pedido já carregado ou em rota sem o
  // motorista precisar ler o QR de novo: reordenar mexe só em `ordemRota`,
  // nunca em `statusEntrega`.
  const podeReordenar = (v) => ["pendente", "carregando", "em_rota"].includes(v.statusEntrega ?? "pendente");

  // Pedidos mesclados (mesmo grupoEntregaId, dentro do mesmo veículo+viagem)
  // viram uma linha só na rota — a lista continua ordenada como `paradas` já
  // vem (prioridade + ordemRota). `linha.id` é o grupoEntregaId quando
  // mesclada, ou o id da venda quando é parada única — é o que
  // drag-and-drop, checkbox e os botões da linha usam para valer para o
  // grupo inteiro.
  const agruparParadas = (paradas) => {
    const vistos = new Set();
    const linhas = [];
    for (const v of paradas) {
      if (vistos.has(v.id)) continue;
      if (v.grupoEntregaId) {
        const membros = paradas.filter((x) => x.grupoEntregaId === v.grupoEntregaId);
        if (membros.length > 1) {
          membros.forEach((m) => vistos.add(m.id));
          linhas.push({ id: v.grupoEntregaId, mesclada: true, membros });
          continue;
        }
      }
      vistos.add(v.id);
      linhas.push({ id: v.id, mesclada: false, membros: [v] });
    }
    return linhas;
  };

  // Lojas de mesmo nome (ex.: PETROX · BARRA e REDE MAIS · BARRA) ficam juntas
  // na lista — ficam na mesma região, então o escalonamento fica mais fácil.
  const porNomeDaLoja = (a, b) => {
    const nome = (v) => dados.lojas.find((l) => l.id === v.lojaId)?.nome ?? "";
    return nome(a).localeCompare(nome(b), "pt-BR", { sensitivity: "base" });
  };

  const semRota = dados.vendas
    .filter((v) => v.status !== "cancelado" && !v.veiculoId && (v.statusEntrega ?? "pendente") === "pendente" && v.data <= data && (v.statusEntrega ?? "pendente") === "pendente")
    .sort((a, b) => porPrioridade(a, b) || porNomeDaLoja(a, b) || String(a.lojaId).localeCompare(String(b.lojaId)) || (a.data !== b.data ? (a.data < b.data ? -1 : 1) : ordenarPorCriacao(a, b)));
  // Pedidos mesclados saem como uma parada só — contam como 1 nos totais.
  const totalSemRota = semRota.filter((v, i) => !v.grupoEntregaId || semRota.findIndex((x) => x.grupoEntregaId === v.grupoEntregaId) === i).length;
  // Seleção para retirada no CD: só conta o que ainda está na lista sem rota.
  const selecionadasSemRota = selecionadasRetirada.filter((id) => semRota.some((v) => v.id === id));

  // Duas viagens do mesmo veículo no mesmo dia (ver `confirmarRota`) viram
  // duas paradas de card na tela — por isso desempata por `viagemRota` antes
  // de `ordemRota`, que só é único DENTRO de uma viagem, não no dia inteiro.
  const comRota = dados.vendas
    .filter((v) => v.rotaData === data && v.veiculoId && !v.rotaArquivada)
    .sort((a, b) => porPrioridade(a, b) || ((a.viagemRota ?? 1) - (b.viagemRota ?? 1)) || (a.ordemRota ?? 0) - (b.ordemRota ?? 0));

  const retiradosHoje = dados.vendas.filter((v) => v.data === data && v.statusEntrega === "retirado_cd");

  // Card por veículo + viagem, não só por veículo: é o que permite um
  // motorista ter uma 2ª rota aberta no mesmo caminhão no mesmo dia.
  const chaveGrupo = (v) => `${v.veiculoId}::${v.viagemRota ?? 1}`;
  const chavesComRota = [...new Set(comRota.map(chaveGrupo))];
  const porVeiculo = chavesComRota.map((chave) => {
    const [veiculoId, viagemTxt] = chave.split("::");
    const viagem = Number(viagemTxt);
    return { chave, veiculoId, viagem, paradas: comRota.filter((v) => v.veiculoId === veiculoId && (v.viagemRota ?? 1) === viagem) };
  });

  // Rotas com tudo entregue e já arquivadas (ver `arquivarRota`) — somem da
  // tela principal, mas ficam listadas aqui pra poder desarquivar se precisar.
  const arquivadasHoje = dados.vendas.filter((v) => v.rotaData === data && v.veiculoId && v.rotaArquivada);
  const chavesArquivadas = [...new Set(arquivadasHoje.map(chaveGrupo))];
  const porVeiculoArquivado = chavesArquivadas.map((chave) => {
    const [veiculoId, viagemTxt] = chave.split("::");
    const viagem = Number(viagemTxt);
    return { chave, veiculoId, viagem, paradas: arquivadasHoje.filter((v) => v.veiculoId === veiculoId && (v.viagemRota ?? 1) === viagem) };
  });

  // Rotas dos últimos dias que não terminaram (motorista não entregou tudo):
  // os pedidos que sobraram podem continuar no dia selecionado, numa viagem
  // nova do mesmo veículo e com o mesmo motorista (ver `continuarRotaHoje`).
  // Só olha 7 dias pra trás, pra não ressuscitar rota antiga esquecida.
  const inicioSobras = vencimentoDe(data, -DIAS_SOBRAS_ROTA);
  const sobrasRota = dados.vendas.filter((v) => v.rotaData && v.rotaData < data && v.rotaData >= inicioSobras && v.veiculoId
    && v.status !== "cancelado" && !["entregue", "retirado_cd"].includes(v.statusEntrega ?? "pendente"));
  const porViagemSobra = [...new Set(sobrasRota.map((v) => `${v.rotaData}::${chaveGrupo(v)}`))]
    .map((chave) => {
      const [dia, veiculoId, viagemTxt] = chave.split("::");
      const viagem = Number(viagemTxt);
      const paradas = sobrasRota.filter((v) => v.rotaData === dia && v.veiculoId === veiculoId && (v.viagemRota ?? 1) === viagem);
      const total = dados.vendas.filter((v) => v.rotaData === dia && v.veiculoId === veiculoId && (v.viagemRota ?? 1) === viagem && v.status !== "cancelado").length;
      return { chave, dia, veiculoId, viagem, paradas, total };
    })
    .sort((a, b) => (a.dia < b.dia ? 1 : a.dia > b.dia ? -1 : a.viagem - b.viagem));

  // Maior número de viagem já usado hoje por esse veículo (0 = nenhuma
  // ainda). Usado pra decidir se uma nova seleção entra na viagem em aberto
  // ou começa uma viagem nova (ver `confirmarRota`).
  const ultimaViagemDoVeiculo = (veiculoId) => {
    const viagens = comRota.filter((v) => v.veiculoId === veiculoId).map((v) => v.viagemRota ?? 1);
    return viagens.length ? Math.max(...viagens) : 0;
  };

  const emRotaHoje = comRota.filter((v) => v.statusEntrega === "em_rota").length;
  const entreguesHoje = comRota.filter((v) => v.statusEntrega === "entregue").length;

  // Quem já estava marcado na lista "Sem rota" (pro botão Retirada no CD)
  // entra pré-selecionado no modal — não faz sentido pedir pra marcar tudo de
  // novo lá dentro.
  const abrirModalRota = () => {
    setVeiculoFixo(null);
    setViagemFixa(null);
    setNovaViagem(false);
    setVeiculoRota(veiculosAtivos[0]?.id ?? "");
    setMotoristaRota(motoristas[0]?.id ?? "");
    setMotoristaRotaNome("");
    setSelecionadas(selecionadasSemRota);
    setSelecionadasRetirada([]);
    setBuscaRota("");
    setModalRota(true);
  };

  // Acrescenta lojas numa rota já montada: mesmo veículo, mesma viagem, mesmo
  // motorista — entra direto nessa parada, sem passar pela escolha de nova
  // viagem (essa só existe no fluxo geral de "Montar Rota").
  const abrirAdicionarNaRota = (veiculoId, viagem) => {
    const vendaComMotorista = comRota.find((v) => v.veiculoId === veiculoId && (v.viagemRota ?? 1) === viagem);
    const motoristaAtual = vendaComMotorista?.motoristaId ?? "";
    const nomeAtual = vendaComMotorista?.motoristaNome ?? "";
    setVeiculoFixo(veiculoId);
    setViagemFixa(viagem);
    setNovaViagem(false);
    setVeiculoRota(veiculoId);
    setMotoristaRota(motoristaAtual || (nomeAtual ? MOTORISTA_OUTRO : ""));
    setMotoristaRotaNome(nomeAtual);
    setSelecionadas(selecionadasSemRota);
    setSelecionadasRetirada([]);
    setBuscaRota("");
    setModalRota(true);
  };

  const semRotaFiltrado = (() => {
    const termo = buscaRota.trim().toLowerCase();
    if (!termo) return semRota;
    return semRota.filter((v) =>
      String(v.numero ?? "").includes(termo) || nomeDoCliente(dados, v.lojaId).toLowerCase().includes(termo));
  })();

  const alternarSelecao = (id) =>
    setSelecionadas((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  // Fallback sem coordenada (endereço não geocodificou, ou está offline):
  // agrupa por bairro/cidade/CEP, vizinhos ficam juntos.
  const chaveLogistica = (venda) => {
    const loja = dados.lojas.find((l) => l.id === venda?.lojaId);
    return [loja?.cidade, loja?.bairro, loja?.cep].filter(Boolean).join("|").toLowerCase();
  };

  // Geocodifica (Nominatim/OpenStreetMap, gratuito) quem ainda não tem
  // lat/lng salvo, uma loja de cada vez — o serviço pede no máximo 1
  // requisição por segundo. Guarda o resultado na loja pra não pedir de
  // novo depois, e devolve um mapa lojaId → coordenada pra usar na hora,
  // sem depender do próximo render pra enxergar o que acabou de salvar.
  const coordenadasDasLojas = async (lojaIds) => {
    const unicos = [...new Set(lojaIds)];
    const mapa = new Map();
    const semCoordenada = [];
    for (const id of unicos) {
      const loja = dados.lojas.find((l) => l.id === id);
      if (loja?.lat != null && loja?.lng != null) mapa.set(id, { lat: loja.lat, lng: loja.lng });
      else if (loja) semCoordenada.push(loja);
    }
    for (let i = 0; i < semCoordenada.length; i++) {
      const loja = semCoordenada[i];
      // Tenta o endereço completo primeiro; se o Nominatim não achar nada
      // (rua/número não bate), tenta de novo só com bairro/cidade/UF — melhor
      // aparecer no bairro certo do que sumir do mapa.
      const tentativas = [...new Set([enderecoParaMaps(loja), enderecoAproximado(loja)].filter(Boolean))];
      for (let t = 0; t < tentativas.length; t++) {
        try {
          const coord = await geocodificarEndereco(tentativas[t]);
          if (coord) {
            mapa.set(loja.id, coord);
            setDados((d) => ({ ...d, lojas: d.lojas.map((l) => (l.id === loja.id ? { ...l, lat: coord.lat, lng: coord.lng } : l)) }));
            break;
          }
        } catch {
          // Sem coordenada com essa tentativa: segue pra próxima, mais larga.
        }
        if (t < tentativas.length - 1) await aguardar(1100);
      }
      if (i < semCoordenada.length - 1) await aguardar(1100);
    }
    return mapa;
  };

  // Junta quem já estava pendente nesse veículo com os recém-selecionados e
  // reordena o CONJUNTO INTEIRO por prioridade + distância até o CD — senão
  // cada leva só empilha no fim, fora de ordem com o que já tinha sido
  // escalado. Sem internet ou sem geocodificar, cai no agrupamento por bairro.
  const ordenarPorPrioridadeEProximidade = async (ids) => {
    const cd = await coordenadaCD();
    const lojaIds = ids.map((id) => dados.vendas.find((v) => v.id === id)?.lojaId).filter(Boolean);
    const coords = cd ? await coordenadasDasLojas(lojaIds) : new Map();
    return [...ids].sort((a, b) => {
      const va = dados.vendas.find((v) => v.id === a);
      const vb = dados.vendas.find((v) => v.id === b);
      const prio = (vb?.prioridade ? 1 : 0) - (va?.prioridade ? 1 : 0);
      if (prio !== 0) return prio;
      const ca = coords.get(va?.lojaId);
      const cb = coords.get(vb?.lojaId);
      if (ca && cb) return distanciaKm(cd, ca) - distanciaKm(cd, cb);
      return chaveLogistica(va).localeCompare(chaveLogistica(vb));
    });
  };

  const confirmarRota = async () => {
    if (!veiculoRota || selecionadas.length === 0) return;
    const ehOutro = motoristaRota === MOTORISTA_OUTRO;
    const motoristaId = ehOutro ? null : motoristaRota || null;
    const motoristaNome = ehOutro ? motoristaRotaNome.trim() || null : null;

    // Qual viagem recebe a seleção: "Adicionar loja" já vem com a viagem
    // travada; no fluxo geral, se a última viagem desse veículo ainda está
    // em aberto (nem tudo entregue), soma nela — a menos que a pessoa tenha
    // marcado "nova viagem", aí começa a próxima, mesmo motorista e tudo.
    let viagemAlvo;
    if (veiculoFixo && viagemFixa) {
      viagemAlvo = viagemFixa;
    } else {
      const ultima = ultimaViagemDoVeiculo(veiculoRota);
      const paradasUltima = comRota.filter((v) => v.veiculoId === veiculoRota && (v.viagemRota ?? 1) === ultima);
      const ultimaAberta = ultima > 0 && paradasUltima.some((v) => (v.statusEntrega ?? "pendente") !== "entregue");
      viagemAlvo = ultima === 0 ? 1 : (ultimaAberta && !novaViagem ? ultima : ultima + 1);
    }

    const jaPendentesNaViagem = comRota
      .filter((v) => v.veiculoId === veiculoRota && (v.viagemRota ?? 1) === viagemAlvo && (v.statusEntrega ?? "pendente") === "pendente")
      .map((v) => v.id);
    setGeocodificando(true);
    const ordenadas = await ordenarPorPrioridadeEProximidade([...new Set([...jaPendentesNaViagem, ...selecionadas])]);
    setGeocodificando(false);
    setDados((d) => ({
      ...d,
      vendas: d.vendas.map((v) => {
        const posicao = ordenadas.indexOf(v.id);
        if (posicao === -1) return v;
        return { ...v, veiculoId: veiculoRota, motoristaId, motoristaNome, ordemRota: posicao, rotaData: data, viagemRota: viagemAlvo };
      }),
    }));
    // Rota nova ainda não teve romaneio impresso — só avisa quando mexeu
    // numa que já existia.
    if (comRota.some((v) => v.veiculoId === veiculoRota && (v.viagemRota ?? 1) === viagemAlvo)) {
      marcarAlterada({ veiculoId: veiculoRota, viagem: viagemAlvo });
    }
    setModalRota(false);
  };

  // Aceita uma venda só ou o grupo inteiro de uma parada mesclada — tirar da
  // rota desfaz a mesclagem junto (fora da rota não tem mais parada comum).
  // Também vale pra "carregando"/"em rota" (ver `podeReordenar`) — dá pra
  // tirar um pedido já escaneado da rota, por exemplo quando ele precisa ir
  // pra outro veículo depois de um problema. Isso desfaz o escaneio (volta
  // pra "Sem rota", zera saída do CD), então avisa diferente nesse caso.
  const removerDaRota = (vendaOuGrupo) => {
    const grupo = Array.isArray(vendaOuGrupo) ? vendaOuGrupo : [vendaOuGrupo];
    if (!grupo.length) return;
    const jaEscaneado = grupo.some((v) => (v.statusEntrega ?? "pendente") !== "pendente");
    const rotulo = grupo.length === 1 ? `O pedido #${grupo[0].numero}` : `${grupo.length} pedidos mesclados`;
    const aviso = jaEscaneado
      ? `${rotulo} já está "${STATUS_ENTREGA_LABEL[grupo.find((v) => (v.statusEntrega ?? "pendente") !== "pendente")?.statusEntrega] ?? "em andamento"}" nesta rota. Tirar da rota desfaz o escaneio e volta${grupo.length === 1 ? " " : "m "}pra "Sem rota" — daí é só adicionar em outro veículo. Confirma?`
      : `Tirar ${grupo.length === 1 ? `o pedido #${grupo[0].numero}` : `${grupo.length} pedidos mesclados`} da rota?`;
    if (!confirm(aviso)) return;
    const ids = new Set(grupo.map((v) => v.id));
    setDados((d) => ({
      ...d,
      vendas: d.vendas.map((v) => (ids.has(v.id)
        ? { ...v, veiculoId: null, motoristaId: null, motoristaNome: null, ordemRota: null, rotaData: null, viagemRota: null, statusEntrega: "pendente", saidaCdEm: null, entregueEm: null, grupoEntregaId: null }
        : v)),
    }));
    marcarAlterada({ veiculoId: grupo[0].veiculoId, viagem: grupo[0].viagemRota ?? 1 });
  };

  // Some com a rota da tela principal sem apagar nada — os pedidos continuam
  // "entregue", só saem da lista de rotas do dia. Só cabe quando tudo já foi
  // entregue (ver botão "Arquivar rota"); desarquivar traz de volta.
  const arquivarRota = (veiculoId, viagem) => {
    setDados((d) => ({
      ...d,
      vendas: d.vendas.map((v) => (v.rotaData === data && v.veiculoId === veiculoId && (v.viagemRota ?? 1) === viagem
        ? { ...v, rotaArquivada: true }
        : v)),
    }));
    desmarcarAlterada(veiculoId, viagem);
  };

  const desarquivarRota = (veiculoId, viagem) => {
    setDados((d) => ({
      ...d,
      vendas: d.vendas.map((v) => (v.rotaData === data && v.veiculoId === veiculoId && (v.viagemRota ?? 1) === viagem
        ? { ...v, rotaArquivada: false }
        : v)),
    }));
  };

  // Traz para o dia selecionado o que sobrou de uma viagem de outro dia: vira
  // a próxima viagem livre do veículo aqui (pra não misturar com o que já foi
  // montado), mantendo motorista, ordem e status de cada pedido — o que já
  // estava "em rota" continua em rota. Os entregues ficam no dia original.
  // Mesma regra de `continuar_rota` (migracao-46-continuar-rota.sql), que é
  // o caminho do motorista pela tela dele.
  const continuarRotaHoje = ({ dia, veiculoId, viagem, paradas }) => {
    // Conta também as viagens arquivadas do dia — senão a nova poderia pegar
    // o número de uma delas e as duas se misturariam no mesmo card.
    const novaViagem = Math.max(0, ...dados.vendas
      .filter((v) => v.rotaData === data && v.veiculoId === veiculoId && v.status !== "cancelado")
      .map((v) => v.viagemRota ?? 1)) + 1;
    if (!confirm(`Continuar em ${formatarData(data)} a rota de ${formatarData(dia)} (${nomeVeiculo(veiculoId)}${viagem > 1 ? ` · ${viagem}ª viagem` : ""})?\n\n${paradas.length} pedido(s) não entregue(s) passam para ${formatarData(data)}, como ${novaViagem}ª viagem do veículo. O que já foi entregue fica no dia ${formatarData(dia)}.`)) return;
    const ids = new Set(paradas.map((v) => v.id));
    setDados((d) => ({
      ...d,
      vendas: d.vendas.map((v) => (ids.has(v.id) ? { ...v, rotaData: data, viagemRota: novaViagem, rotaArquivada: false } : v)),
    }));
    marcarAlterada({ veiculoId, viagem: novaViagem });
  };

  // Só as pendentes entram na seleção em massa — essa desfaz o escaneio de
  // várias de uma vez, então fica restrita a quem ainda nem foi escaneado
  // (pra tirar uma só, já escaneada, usa o botão de lixeira da linha, que
  // avisa e confirma antes). Já arrastar (reordenar) não desfaz nada, por
  // isso vale também pra "em rota".
  const removerVariasDaRota = () => {
    if (selecionadasParadas.length === 0) return;
    if (!confirm(`Tirar ${selecionadasParadas.length} pedido(s) da rota?`)) return;
    marcarAlterada(...comRota.filter((v) => selecionadasParadas.includes(v.id)).map((v) => ({ veiculoId: v.veiculoId, viagem: v.viagemRota ?? 1 })));
    setDados((d) => ({
      ...d,
      vendas: d.vendas.map((v) => (selecionadasParadas.includes(v.id)
        ? { ...v, veiculoId: null, motoristaId: null, motoristaNome: null, ordemRota: null, rotaData: null, viagemRota: null, statusEntrega: "pendente", saidaCdEm: null, entregueEm: null, grupoEntregaId: null }
        : v)),
    }));
    setSelecionadasParadas([]);
  };

  // Só entra quem: está na mesma parada mesclada, ou é candidato a virar uma
  // — mesmo veículo+viagem, mesma loja, ainda pendente e sem grupo (pra não
  // juntar um pedido que já está noutra mesclagem sem passar por
  // "Desmesclar" antes).
  const candidatosAMesclar = comRota.filter((v) => selecionadasParadas.includes(v.id));
  const podeMesclar = candidatosAMesclar.length >= 2
    && new Set(candidatosAMesclar.map((v) => `${v.veiculoId}::${v.viagemRota ?? 1}`)).size === 1
    && new Set(candidatosAMesclar.map((v) => v.lojaId)).size === 1
    && candidatosAMesclar.every((v) => (v.statusEntrega ?? "pendente") === "pendente" && !v.grupoEntregaId);

  const mesclarSelecionadas = () => {
    if (!podeMesclar) return;
    if (!confirm(`Mesclar ${candidatosAMesclar.length} pedidos da mesma loja numa única parada da rota?\n\nCada pedido continua com sua própria nota — só a rota passa a tratar os dois como uma parada só.`)) return;
    const grupoId = novoId();
    const menorOrdem = Math.min(...candidatosAMesclar.map((v) => v.ordemRota ?? 0));
    const prioridade = candidatosAMesclar.some((v) => v.prioridade);
    const ids = new Set(candidatosAMesclar.map((v) => v.id));
    marcarAlterada({ veiculoId: candidatosAMesclar[0].veiculoId, viagem: candidatosAMesclar[0].viagemRota ?? 1 });
    setDados((d) => ({
      ...d,
      vendas: d.vendas.map((v) => (ids.has(v.id) ? { ...v, grupoEntregaId: grupoId, ordemRota: menorOrdem, prioridade } : v)),
    }));
    setSelecionadasParadas([]);
  };

  // Volta a mesclagem: cada pedido do grupo vira parada separada de novo.
  // Não mexe em status nem em nada do financeiro.
  const desmesclar = (grupo) => {
    if (!grupo.length) return;
    if (!confirm(`Desfazer a mesclagem de ${grupo.length} pedidos? Cada um volta a ser uma parada separada na rota.`)) return;
    const ids = new Set(grupo.map((v) => v.id));
    marcarAlterada({ veiculoId: grupo[0].veiculoId, viagem: grupo[0].viagemRota ?? 1 });
    setDados((d) => ({
      ...d,
      vendas: d.vendas.map((v) => (ids.has(v.id) ? { ...v, grupoEntregaId: null } : v)),
    }));
  };

  const abrirModalMoverParadas = () => {
    if (selecionadasParadas.length === 0) return;
    setVeiculoDestino(veiculosAtivos[0]?.id ?? "");
    setMotoristaDestino(motoristas[0]?.id ?? "");
    setMotoristaDestinoNome("");
    setModalMoverParadas(true);
  };

  const confirmarMoverParadas = async () => {
    if (!veiculoDestino || selecionadasParadas.length === 0) return;
    const ehOutro = motoristaDestino === MOTORISTA_OUTRO;
    const motoristaId = ehOutro ? null : motoristaDestino || null;
    const motoristaNome = ehOutro ? motoristaDestinoNome.trim() || null : null;
    // Entra na última viagem do destino (ou na 1ª, se ele ainda não tem
    // nenhuma rota hoje) — mover não abre uma viagem nova, só troca de veículo.
    const viagemDestino = ultimaViagemDoVeiculo(veiculoDestino) || 1;
    const jaPendentesNoDestino = comRota
      .filter((v) => v.veiculoId === veiculoDestino && (v.viagemRota ?? 1) === viagemDestino && (v.statusEntrega ?? "pendente") === "pendente" && !selecionadasParadas.includes(v.id))
      .map((v) => v.id);
    setGeocodificando(true);
    const ordenadas = await ordenarPorPrioridadeEProximidade([...new Set([...jaPendentesNoDestino, ...selecionadasParadas])]);
    setGeocodificando(false);
    const origens = comRota.filter((v) => selecionadasParadas.includes(v.id)).map((v) => ({ veiculoId: v.veiculoId, viagem: v.viagemRota ?? 1 }));
    const destinoJaExistia = comRota.some((v) => v.veiculoId === veiculoDestino && (v.viagemRota ?? 1) === viagemDestino && !selecionadasParadas.includes(v.id));
    marcarAlterada(...origens, ...(destinoJaExistia ? [{ veiculoId: veiculoDestino, viagem: viagemDestino }] : []));
    setDados((d) => ({
      ...d,
      vendas: d.vendas.map((v) => {
        const posicao = ordenadas.indexOf(v.id);
        if (posicao === -1) return v;
        return { ...v, veiculoId: veiculoDestino, motoristaId, motoristaNome, ordemRota: posicao, viagemRota: viagemDestino };
      }),
    }));
    setSelecionadasParadas([]);
    setModalMoverParadas(false);
  };

  // Reordena as paradas ainda não entregues desse veículo pela proximidade,
  // do zero — útil quando elas foram entrando em levas separadas e ficaram
  // fora de ordem (cada leva só ficava organizada dentro de si mesma). Inclui
  // as já "em rota" (carregadas): mexe só na posição, não no escaneio.
  const reordenarVeiculo = async (veiculoId, viagem) => {
    const reordenaveis = comRota
      .filter((v) => v.veiculoId === veiculoId && (v.viagemRota ?? 1) === viagem && podeReordenar(v))
      .map((v) => v.id);
    if (reordenaveis.length < 2) return;
    setGeocodificando(true);
    const ordenadas = await ordenarPorPrioridadeEProximidade(reordenaveis);
    setGeocodificando(false);
    setDados((d) => ({
      ...d,
      vendas: d.vendas.map((v) => {
        const posicao = ordenadas.indexOf(v.id);
        return posicao === -1 ? v : { ...v, ordemRota: posicao };
      }),
    }));
  };

  // Arrastar só reordena dentro do mesmo grupo — um prioritário nunca troca
  // de lugar com um normal, é assim que a posição no topo fica fixa. Se a
  // parada for solta fora do grupo dela, fica na ponta mais próxima do grupo.
  // Trabalha em cima das LINHAS (paradas já agrupadas) — uma parada mesclada
  // arrasta os dois pedidos juntos, cada um ganhando o mesmo ordemRota.
  const soltarNaRota = (veiculoId, viagem, id, destino) => {
    const linhas = agruparParadas(comRota.filter((v) => v.veiculoId === veiculoId && (v.viagemRota ?? 1) === viagem));
    const idx = linhas.findIndex((l) => l.id === id);
    if (idx === -1) return;
    const movida = linhas[idx];
    const prioridadeMovida = !!movida.membros[0].prioridade;
    const resto = linhas.filter((l) => l.id !== id);
    let alvo = destino > idx ? destino - 1 : destino;
    const inicioGrupo = resto.findIndex((l) => !!l.membros[0].prioridade === prioridadeMovida);
    const tamanhoGrupo = resto.filter((l) => !!l.membros[0].prioridade === prioridadeMovida).length;
    const comeco = inicioGrupo === -1 ? (prioridadeMovida ? 0 : resto.length) : inicioGrupo;
    alvo = Math.min(Math.max(alvo, comeco), comeco + tamanhoGrupo);
    if (alvo === idx) return;
    const novaOrdemLinhas = [...resto.slice(0, alvo), movida, ...resto.slice(alvo)];
    const posicaoPorVendaId = new Map();
    novaOrdemLinhas.forEach((l, posicao) => l.membros.forEach((m) => posicaoPorVendaId.set(m.id, posicao)));
    setDados((d) => ({
      ...d,
      vendas: d.vendas.map((v) => {
        const posicao = posicaoPorVendaId.get(v.id);
        return posicao === undefined ? v : { ...v, ordemRota: posicao };
      }),
    }));
  };

  // Arrasto por pointer events (e não drag-and-drop do HTML) para funcionar
  // igual com mouse e com o dedo no celular/tablet.
  const iniciarArrasto = (e, veiculoId, viagem, id, i) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setArrasto({ veiculoId, viagem, id, destino: i });
  };

  const moverArrasto = (e) => {
    if (!arrasto) return;
    const linhas = [...document.querySelectorAll(`tr[data-rota-veiculo="${arrasto.veiculoId}"][data-rota-viagem="${arrasto.viagem}"]`)];
    let destino = linhas.length;
    for (let k = 0; k < linhas.length; k++) {
      const r = linhas[k].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) { destino = k; break; }
    }
    // Rola a página sozinha quando o dedo/mouse encosta na borda da tela.
    if (e.clientY < 60) window.scrollBy(0, -12);
    else if (e.clientY > window.innerHeight - 60) window.scrollBy(0, 12);
    if (destino !== arrasto.destino) setArrasto((a) => (a ? { ...a, destino } : a));
  };

  const terminarArrasto = () => {
    if (!arrasto) return;
    soltarNaRota(arrasto.veiculoId, arrasto.viagem, arrasto.id, arrasto.destino);
    setArrasto(null);
  };

  // Aceita um id só ou vários (a parada mesclada inteira, pra prioridade
  // valer pros dois — arrastar agrupa por prioridade, então precisam ficar
  // iguais dentro do mesmo grupo).
  const alternarPrioridade = (idOuIds) => {
    const ids = new Set(Array.isArray(idOuIds) ? idOuIds : [idOuIds]);
    setDados((d) => ({ ...d, vendas: d.vendas.map((v) => (ids.has(v.id) ? { ...v, prioridade: !v.prioridade } : v)) }));
  };

  // Cliente que busca no CD: não passa por veículo, motorista nem escaneio.
  const retirarNoCd = (venda) => {
    if (!confirm(`Marcar o pedido #${venda.numero} como retirado no CD pelo cliente?`)) return;
    setDados((d) => ({
      ...d,
      vendas: d.vendas.map((v) => (v.id === venda.id ? { ...v, statusEntrega: "retirado_cd", entregueEm: new Date().toISOString() } : v)),
    }));
  };

  // Várias de uma vez: marca na tabela "sem rota" e confirma tudo junto.
  const alternarSelecaoRetirada = (id) =>
    setSelecionadasRetirada((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  // Pedido que já foi entregue (ou saiu) sem passar pela rota/QR: dá o ok
  // direto, sem exigir veículo nem motorista — igual à migração 59 faz com os antigos.
  const marcarSemRotaEntregue = (ids) => {
    if (ids.length === 0) return;
    if (!confirm(`Marcar ${ids.length} pedido(s) como já entregues, sem rota?`)) return;
    const alvo = new Set(ids);
    const agora = new Date().toISOString();
    setDados((d) => ({
      ...d,
      vendas: d.vendas.map((v) => (alvo.has(v.id) ? { ...v, statusEntrega: "entregue", entregueEm: agora, saidaCdEm: v.saidaCdEm ?? agora } : v)),
    }));
    setSelecionadasRetirada([]);
  };

  const retirarVariasNoCd = () => {
    const ids = selecionadasSemRota;
    if (ids.length === 0) return;
    if (!confirm(`Marcar ${ids.length} pedido(s) como retirados no CD pelo cliente?`)) return;
    const agora = new Date().toISOString();
    setDados((d) => ({
      ...d,
      vendas: d.vendas.map((v) => (ids.includes(v.id) ? { ...v, statusEntrega: "retirado_cd", entregueEm: agora } : v)),
    }));
    setSelecionadasRetirada([]);
  };

  // Mescla ANTES de montar a rota: os pedidos ainda não têm veículo nem
  // viagem, mas já ganham o mesmo grupoEntregaId — quando alguém "Montar
  // rota" com os dois selecionados, eles caem no mesmo veículo (é a mesma
  // seleção) e a tela do Romaneio já mostra como parada mesclada, sem
  // precisar mesclar de novo depois.
  const candidatosAMesclarSemRota = semRota.filter((v) => selecionadasRetirada.includes(v.id));
  const podeMesclarSemRota = candidatosAMesclarSemRota.length >= 2
    && new Set(candidatosAMesclarSemRota.map((v) => v.lojaId)).size === 1
    && candidatosAMesclarSemRota.every((v) => !v.grupoEntregaId);

  const mesclarSemRota = () => {
    if (!podeMesclarSemRota) return;
    if (!confirm(`Mesclar ${candidatosAMesclarSemRota.length} pedidos da mesma loja?\n\nQuando entrarem na rota (mesmo veículo), vão virar uma parada só — cada um continua com sua própria nota.`)) return;
    const grupoId = novoId();
    const prioridade = candidatosAMesclarSemRota.some((v) => v.prioridade);
    const ids = new Set(candidatosAMesclarSemRota.map((v) => v.id));
    setDados((d) => ({
      ...d,
      vendas: d.vendas.map((v) => (ids.has(v.id) ? { ...v, grupoEntregaId: grupoId, prioridade } : v)),
    }));
    setSelecionadasRetirada([]);
  };

  // Master e administrativo corrigem a entrega na mão quando o motorista não
  // leu o QR (ou leu o errado). Vale pra parada mesclada inteira.
  const marcarEntregue = (membros) => {
    if (!confirm(`Marcar ${membros.map((m, k) => (
                        <span key={m.id}>{k > 0 && " + "}<button onClick={() => setDetalheId(m.id)} title="Ver o pedido"
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit", fontWeight: 600, color: "inherit", textDecoration: "underline dotted", textUnderlineOffset: 3 }}>#{m.numero ?? "—"}</button></span>
                      ))} como entregue, sem a leitura do QR pelo motorista?`)) return;
    const ids = new Set(membros.map((m) => m.id));
    const agora = new Date().toISOString();
    setDados((d) => ({
      ...d,
      vendas: d.vendas.map((v) => (ids.has(v.id)
        ? { ...v, statusEntrega: "entregue", entregueEm: agora, saidaCdEm: v.saidaCdEm ?? agora }
        : v)),
    }));
  };

  const desmarcarEntregue = (membros) => {
    if (!confirm(`Desmarcar a entrega de ${membros.map((m) => `#${m.numero ?? "—"}`).join(" + ")}? O pedido volta para "Em rota".`)) return;
    const ids = new Set(membros.map((m) => m.id));
    setDados((d) => ({
      ...d,
      vendas: d.vendas.map((v) => (ids.has(v.id) ? { ...v, statusEntrega: "em_rota", entregueEm: null } : v)),
    }));
  };

  const desfazerRetirada = (venda) => {
    setDados((d) => ({
      ...d,
      vendas: d.vendas.map((v) => (v.id === venda.id ? { ...v, statusEntrega: "pendente", entregueEm: null } : v)),
    }));
  };

  // O link não reescreve a ordem no app — abre o Maps com as paradas na
  // ordem da tela, e é lá dentro que o motorista pode pedir pra otimizar.
  //
  // A origem NÃO é fixada no CD: o Maps só habilita a navegação em tempo real
  // ("Iniciar") quando a origem é a localização atual do celular. Com uma
  // origem fixa, ele mostra só uma prévia entre dois pontos parados — e se o
  // motorista já saiu do CD, a rota sai errada, calculada a partir de um
  // lugar onde ele não está mais. Deixando em branco, o Maps usa o GPS do
  // aparelho — certo tanto saindo do CD quanto no meio da rota.
  const abrirNoMaps = (veiculoId, viagem) => {
    const paradas = comRota.filter((v) => v.veiculoId === veiculoId && (v.viagemRota ?? 1) === viagem && v.statusEntrega !== "entregue");
    // Duas notas da mesma loja são uma parada só no mapa — endereço repetido
    // não ajuda em nada e ainda gasta uma vaga do limite de 9 do Maps.
    const lojasVistas = new Set();
    const paradasUnicas = paradas.filter((v) => {
      if (lojasVistas.has(v.lojaId)) return false;
      lojasVistas.add(v.lojaId);
      return true;
    });
    const comEndereco = paradasUnicas
      .map((v) => ({ v, endereco: enderecoParaMaps(dados.lojas.find((l) => l.id === v.lojaId)) }))
      .filter((x) => x.endereco);
    if (comEndereco.length === 0) {
      alert("Nenhuma parada desta rota tem endereço cadastrado. Complete o cadastro na aba Clientes.");
      return;
    }
    const semEndereco = paradasUnicas.length - comEndereco.length;
    if (semEndereco > 0) {
      alert(`${semEndereco} parada(s) sem endereço cadastrado não vão aparecer no mapa. Complete o cadastro na aba Clientes.`);
    }
    const destino = comEndereco[comEndereco.length - 1].endereco;
    const waypoints = comEndereco.slice(0, -1).map((x) => x.endereco);
    // O Google Maps só aceita até 9 paradas no meio do trajeto (10 no total,
    // já contando o destino); passar disso pode fazer a rota vir errada ou
    // incompleta.
    if (waypoints.length > 9) {
      alert(`Rota com ${comEndereco.length} paradas: o Google Maps só aceita até 9 no meio do trajeto (10 no total). Divida em duas viagens no Maps pra não sair errado.`);
    }
    const params = new URLSearchParams({ api: "1", destination: destino, travelmode: "driving" });
    if (waypoints.length > 0) params.set("waypoints", waypoints.slice(0, 9).join("|"));
    window.open(`https://www.google.com/maps/dir/?${params.toString()}`, "_blank", "noopener");
  };

  // O escaneio decide sozinho a AÇÃO a partir do status que a venda lida já
  // tem (pendente → carregamento/saída do CD; em rota → entrega) — é o que
  // permite um único botão de escanear —, mas não grava nada até a pessoa
  // confirmar, vendo para qual estabelecimento e quais mercadorias.
  const registrarLeitura = (codigo) => {
    if (leituraPendente) return;
    const venda = dados.vendas.find((v) => v.id === codigo);
    if (!venda) {
      setMensagemScan({ tipo: "erro", texto: "Esse código não corresponde a nenhuma venda." });
      return;
    }
    if (venda.status === "cancelado") {
      setMensagemScan({ tipo: "erro", texto: `Pedido #${venda.numero} está cancelado.` });
      return;
    }
    if (!venda.veiculoId) {
      setMensagemScan({ tipo: "erro", texto: `Pedido #${venda.numero} ainda não entrou numa rota.` });
      return;
    }
    const status = venda.statusEntrega ?? "pendente";
    if (status !== "pendente" && status !== "em_rota") {
      setMensagemScan({ tipo: "aviso", texto: status === "retirado_cd"
        ? `Pedido #${venda.numero} foi retirado no CD.`
        : `Pedido #${venda.numero} já foi entregue às ${horaDe(venda.entregueEm)}.` });
      return;
    }
    setMensagemScan(null);
    setLeituraPendente({ vendaId: venda.id, acao: status === "pendente" ? "carregamento" : "entrega" });
  };

  const confirmarLeitura = () => {
    if (!leituraPendente) return;
    const venda = dados.vendas.find((v) => v.id === leituraPendente.vendaId);
    const esperado = leituraPendente.acao === "carregamento" ? "pendente" : "em_rota";
    setLeituraPendente(null);
    // Outra pessoa pode ter escaneado a mesma nota enquanto esta confirmação
    // estava aberta: só grava se o status ainda é o de quando leu.
    if (!venda || (venda.statusEntrega ?? "pendente") !== esperado) {
      setMensagemScan({ tipo: "aviso", texto: "O status deste pedido mudou enquanto a confirmação estava aberta. Escaneie de novo." });
      return;
    }
    const agora = new Date().toISOString();
    const cliente = nomeDoCliente(dados, venda.lojaId);
    // Parada mesclada (migracao-39): ler o QR de qualquer um dos pedidos do
    // grupo confirma os dois juntos — cada um continua com sua própria nota.
    const doGrupo = (v) => v.id === venda.id || (venda.grupoEntregaId && v.grupoEntregaId === venda.grupoEntregaId);
    if (leituraPendente.acao === "carregamento") {
      setDados((d) => ({ ...d, vendas: d.vendas.map((v) => (doGrupo(v) && (v.statusEntrega ?? "pendente") === "pendente" ? { ...v, statusEntrega: "em_rota", saidaCdEm: agora } : v)) }));
      setMensagemScan({ tipo: "ok", texto: `Carregamento confirmado — Pedido #${venda.numero} · ${cliente}` });
    } else {
      setDados((d) => ({ ...d, vendas: d.vendas.map((v) => (doGrupo(v) && v.statusEntrega === "em_rota" ? { ...v, statusEntrega: "entregue", entregueEm: agora } : v)) }));
      setMensagemScan({ tipo: "ok", texto: `Entrega confirmada — Pedido #${venda.numero} · ${cliente}` });
    }
  };

  const cancelarLeitura = () => {
    setLeituraPendente(null);
    setMensagemScan({ tipo: "aviso", texto: "Leitura cancelada. Nada foi registrado." });
  };

  const fecharScan = () => {
    setLeituraPendente(null);
    setScanAberto(false);
  };

  const vendaPendente = leituraPendente && dados.vendas.find((v) => v.id === leituraPendente.vendaId);
  const itensPendentes = (vendaPendente?.itens ?? []).map((i) => {
    const p = dados.produtos.find((x) => x.id === i.produtoId);
    return { chave: `${i.produtoId}-${i.natureza ?? ""}`, nome: p?.nome ?? "Item", qtd: `${i.qty} ${rotuloUnidade(p, i.qty, i.unidade)}`, bonif: i.natureza === "bonificacao" };
  });

  // «150 kg · 6 cx» — as caixas só aparecem se a fruta tem o peso da caixa cadastrado.
  const textoKgCaixas = (v) => {
    const c = totaisDasVendas([v], dados.produtos);
    return `${kg(v.kgTotal)}${c.caixas > 0 ? ` · ${rotuloCaixas(c.caixas)}` : ""}`;
  };

  const imprimirRota = async (veiculoId, viagem) => {
    const chave = `${veiculoId}::${viagem}`;
    const paradas = comRota.filter((v) => v.veiculoId === veiculoId && (v.viagemRota ?? 1) === viagem);
    if (paradas.length === 0) return;
    setImprimindo(chave);
    try {
      // Duas notas da mesma loja viram uma parada só no papel — mesmo
      // endereço, mesmo motorista batendo na porta uma vez só, mesmo que
      // sejam dois pedidos (e dois QRs) separados por trás.
      const grupos = [];
      const indicePorLoja = new Map();
      for (const v of paradas) {
        if (indicePorLoja.has(v.lojaId)) grupos[indicePorLoja.get(v.lojaId)].push(v);
        else { indicePorLoja.set(v.lojaId, grupos.length); grupos.push([v]); }
      }
      const blocos = await Promise.all(grupos.map(async (vendasDaLoja) => ({
        cliente: nomeDoCliente(dados, vendasDaLoja[0].lojaId),
        notas: await Promise.all(vendasDaLoja.map(async (v) => ({
          numero: v.numero ?? "—",
          itens: (v.itens ?? []).map((i) => {
            const p = dados.produtos.find((x) => x.id === i.produtoId);
            const bonif = i.natureza === "bonificacao" ? " (bonif.)" : "";
            return `${p?.nome ?? "Item"} × ${i.qty} ${rotuloUnidade(p, i.qty)}${bonif}`;
          }).join(", "),
          kg: textoKgCaixas(v),
          total: brl(v.total),
          qr: await gerarQrDataUrl(v.id),
        }))),
      })));
      await exportarRomaneioPdf({
        veiculo: nomeVeiculo(veiculoId),
        motorista: nomeMotoristaDaVenda(paradas[0]),
        data: formatarData(data),
        paradas: blocos,
        carga: (() => { const c = totaisDasVendas(paradas, dados.produtos); return `${kg(c.kgTotal)}${c.caixas > 0 ? ` · ${rotuloCaixas(c.caixas)}` : ""}`; })(),
        viagem,
        atualizado: rotaAlterada(veiculoId, viagem)
          ? new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
          : null,
      });
      desmarcarAlterada(veiculoId, viagem);
    } catch (erro) {
      alert(`Não foi possível gerar o romaneio: ${erro?.message ?? erro}`);
    } finally {
      setImprimindo(null);
    }
  };

  const abrirQr = async (venda) => {
    setQrAberto({ venda, url: null });
    const url = await gerarQrDataUrl(venda.id);
    setQrAberto({ venda, url });
  };

  // Escala 1 pedido pré-escolhido, sem abrir o "Montar Rota" e marcar
  // checkbox — pra quando só tem uma loja pra sair agora e não vale montar
  // a seleção em massa. Entra na rota igual a qualquer outra (mesma lógica
  // de viagem do `confirmarRota`), então o QR sai já escaneável de verdade.
  const abrirModalAvulso = () => {
    setPedidoAvulso(semRota[0]?.id ?? "");
    setVeiculoAvulso(veiculosAtivos[0]?.id ?? "");
    setMotoristaAvulso(motoristas[0]?.id ?? "");
    setMotoristaAvulsoNome("");
    setQrAvulso(null);
    setModalAvulso(true);
  };

  const confirmarAvulso = async () => {
    const venda = semRota.find((v) => v.id === pedidoAvulso);
    if (!venda || !veiculoAvulso) return;
    const ehOutro = motoristaAvulso === MOTORISTA_OUTRO;
    const motoristaId = ehOutro ? null : motoristaAvulso || null;
    const motoristaNome = ehOutro ? motoristaAvulsoNome.trim() || null : null;
    if (ehOutro && !motoristaNome) return;

    setGerandoAvulso(true);

    // Mesma regra do "Montar Rota": entra na viagem em aberto desse veículo,
    // ou começa uma nova se a última já foi entregue por completo.
    const ultima = ultimaViagemDoVeiculo(veiculoAvulso);
    const paradasUltima = comRota.filter((v) => v.veiculoId === veiculoAvulso && (v.viagemRota ?? 1) === ultima);
    const ultimaAberta = ultima > 0 && paradasUltima.some((v) => (v.statusEntrega ?? "pendente") !== "entregue");
    const viagemAlvo = ultima === 0 ? 1 : (ultimaAberta ? ultima : ultima + 1);

    const jaPendentesNaViagem = comRota
      .filter((v) => v.veiculoId === veiculoAvulso && (v.viagemRota ?? 1) === viagemAlvo && (v.statusEntrega ?? "pendente") === "pendente")
      .map((v) => v.id);
    const ordenadas = await ordenarPorPrioridadeEProximidade([...new Set([...jaPendentesNaViagem, venda.id])]);

    setDados((d) => ({
      ...d,
      vendas: d.vendas.map((v) => {
        const posicao = ordenadas.indexOf(v.id);
        if (posicao === -1) return v;
        return { ...v, veiculoId: veiculoAvulso, motoristaId, motoristaNome, ordemRota: posicao, rotaData: data, viagemRota: viagemAlvo };
      }),
    }));
    if (comRota.some((v) => v.veiculoId === veiculoAvulso && (v.viagemRota ?? 1) === viagemAlvo)) {
      marcarAlterada({ veiculoId: veiculoAvulso, viagem: viagemAlvo });
    }

    const url = await gerarQrDataUrl(venda.id);
    setQrAvulso({
      veiculo: nomeVeiculo(veiculoAvulso),
      motorista: motoristaId ? nomeMotorista(motoristaId) : motoristaNome,
      numero: venda.numero,
      cliente: nomeDoCliente(dados, venda.lojaId),
      itens: (venda.itens ?? []).map((i) => {
        const p = dados.produtos.find((x) => x.id === i.produtoId);
        const bonif = i.natureza === "bonificacao" ? " (bonif.)" : "";
        return `${p?.nome ?? "Item"} × ${i.qty} ${rotuloUnidade(p, i.qty)}${bonif}`;
      }).join(", "),
      kg: textoKgCaixas(venda),
      total: brl(venda.total),
      url,
    });
    setGerandoAvulso(false);
  };

  const imprimirAvulso = async () => {
    if (!qrAvulso) return;
    await exportarRomaneioPdf({
      veiculo: qrAvulso.veiculo,
      motorista: qrAvulso.motorista,
      data: formatarData(data),
      paradas: [{
        cliente: qrAvulso.cliente,
        notas: [{ numero: qrAvulso.numero, itens: qrAvulso.itens, kg: qrAvulso.kg, total: qrAvulso.total, qr: qrAvulso.url }],
      }],
    });
  };

  // Geocodifica (se ainda não tiver) as paradas pendentes desse veículo e
  // monta os pontos pro mapa — CD + paradas na ordem atual da rota.
  const abrirMapaRota = async (veiculoId, viagem) => {
    const paradas = comRota.filter((v) => v.veiculoId === veiculoId && (v.viagemRota ?? 1) === viagem && v.statusEntrega !== "entregue");
    setMapaAberto({ veiculoId, viagem, carregando: true, cd: null, pontos: [] });
    const cd = await coordenadaCD();
    const coords = await coordenadasDasLojas(paradas.map((v) => v.lojaId));
    const pontos = paradas.map((v) => {
      const c = coords.get(v.lojaId);
      return { lat: c?.lat ?? null, lng: c?.lng ?? null, label: nomeDoCliente(dados, v.lojaId) };
    });
    setMapaAberto({
      veiculoId,
      viagem,
      carregando: false,
      cd: cd ? { ...cd, label: "Centro de Distribuição" } : null,
      pontos,
    });
  };

  // Pro modal de "Montar Rota": se o veículo escolhido já tem uma viagem em
  // aberto hoje (nem tudo entregue), mostra a opção de começar uma 2ª viagem
  // em vez de só empilhar mais paradas na que já está rodando.
  const ultimaViagemVeiculoRota = veiculoFixo ? 0 : ultimaViagemDoVeiculo(veiculoRota);
  const veiculoRotaTemViagemAberta = !veiculoFixo && ultimaViagemVeiculoRota > 0 &&
    comRota.some((v) => v.veiculoId === veiculoRota && (v.viagemRota ?? 1) === ultimaViagemVeiculoRota && (v.statusEntrega ?? "pendente") !== "entregue");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <StatCard icon="vendas" label="Sem rota" value={String(totalSemRota)} sub="aguardando escala, todo atrasado incluso" color={COLORS.cinza} />
        <StatCard icon="caminhao" label="Em rota agora" value={String(emRotaHoje)} sub="fora do CD" color={COLORS.laranjaEscuro} />
        <StatCard icon="check" label="Entregues" value={String(entreguesHoje)} sub={`de ${comRota.length} paradas hoje`} color={COLORS.verde} />
        <StatCard icon="clientes" label="Retirado no CD" value={String(retiradosHoje.length)} sub="cliente buscou direto" color={COLORS.dourado} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <Input label="Data da viagem" type="date" value={data} onChange={(e) => { setData(e.target.value); setSelecionadasParadas([]); setSelecionadasRetirada([]); }} />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Btn icon="camera" variant="ghost" onClick={() => { setMensagemScan(null); setLeituraPendente(null); setScanAberto(true); }}>Escanear</Btn>
          <Btn variant="ghost" onClick={abrirModalAvulso} disabled={veiculosAtivos.length === 0 || semRota.length === 0}
            title="Escala 1 pedido só e já gera o QR/romaneio dele, sem passar pela seleção em massa do Montar Rota">
            Romaneio avulso
          </Btn>
          <Btn icon="plus" onClick={abrirModalRota} disabled={semRota.length === 0}>Montar Rota</Btn>
        </div>
      </div>

      {porViagemSobra.length > 0 && (
        <Card style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 8, borderLeft: `4px solid ${COLORS.laranja}` }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.cinzaEscuro }}>Rotas de dias anteriores não concluídas</div>
          <div style={{ fontSize: 12, color: COLORS.cinza }}>
            Pedidos que o motorista não chegou a entregar. "Continuar em {formatarData(data)}" traz o que sobrou para este dia, com o mesmo veículo e motorista — o motorista também pode fazer isso pela tela Minhas Entregas.
          </div>
          {porViagemSobra.map((g) => (
            <div key={g.chave} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: COLORS.cinzaEscuro, flexWrap: "wrap", gap: 8, paddingTop: 8, borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
              <span>
                <strong>{formatarData(g.dia)}</strong> · {nomeVeiculo(g.veiculoId)}{g.viagem > 1 ? ` · ${g.viagem}ª viagem` : ""} · {nomeMotoristaDaVenda(g.paradas[0])} · faltam {g.paradas.length} de {g.total}
              </span>
              <Btn icon="caminhao" style={{ padding: "5px 11px", fontSize: 12 }} onClick={() => continuarRotaHoje(g)}>
                Continuar em {formatarData(data)}
              </Btn>
            </div>
          ))}
        </Card>
      )}

      {semRota.length > 0 && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${COLORS.cinzaClaro}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontSize: 13, color: COLORS.cinzaEscuro }}>
              <strong>{totalSemRota}</strong> {totalSemRota === 1 ? "pedido" : "pedidos"} aguardando escala até {formatarData(data)}.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {selecionadasSemRota.length > 0 && (
                <>
                  {podeMesclarSemRota && (
                    <Btn icon="sync" variant="ghost" onClick={mesclarSemRota} title="Junta os pedidos — quando entrarem na rota, viram uma parada só, cada um com sua própria nota">
                      Mesclar
                    </Btn>
                  )}
                  <Btn variant="ghost" onClick={retirarVariasNoCd}>Retirada no CD ({selecionadasSemRota.length})</Btn>
                  <Btn variant="ghost" onClick={() => marcarSemRotaEntregue(selecionadasSemRota)}>Já entregue ({selecionadasSemRota.length})</Btn>
                  <Btn variant="secondary" onClick={() => setSelecionadasRetirada([])}>Limpar seleção</Btn>
                </>
              )}
              <Btn variant="ghost" onClick={abrirModalRota}>Montar rota</Btn>
            </div>
          </div>
          <TabelaRolavel>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
              <thead style={{ background: COLORS.cinzaClaro }}>
                <tr>
                  <th style={{ padding: "10px 14px", width: 1 }}>
                    <input type="checkbox"
                      title="Selecionar todos"
                      checked={semRota.every((v) => selecionadasRetirada.includes(v.id))}
                      onChange={(e) => setSelecionadasRetirada(e.target.checked ? semRota.map((v) => v.id) : [])} />
                  </th>
                  {["★", "Pedido", "Cliente", "Data", "Peso", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", fontSize: 12, color: COLORS.cinza, padding: "10px 14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {semRota.map((v) => (
                  <tr key={v.id} style={{ borderTop: `1px solid ${COLORS.cinzaClaro}`, background: selecionadasRetirada.includes(v.id) ? COLORS.verdePale : v.data < data ? "#FFF8E8" : "transparent" }}>
                    <td style={{ padding: "10px 14px" }}>
                      <input type="checkbox" checked={selecionadasRetirada.includes(v.id)} onChange={() => alternarSelecaoRetirada(v.id)} />
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <button onClick={() => alternarPrioridade(v.id)} title={v.prioridade ? "Tirar prioridade" : "Marcar como prioridade"}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 0, color: v.prioridade ? COLORS.dourado : COLORS.cinzaClaro }}>
                        {v.prioridade ? "★" : "☆"}
                      </button>
                    </td>
                    <td style={{ padding: "10px 14px", color: COLORS.cinzaEscuro, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}><button onClick={() => setDetalheId(v.id)} title="Ver o pedido"
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit", fontWeight: 600, color: "inherit", textDecoration: "underline dotted", textUnderlineOffset: 3 }}>#{v.numero ?? "—"}</button></td>
                    <td style={{ padding: "10px 14px", color: COLORS.cinzaEscuro, fontSize: 14 }}>
                      {nomeDoCliente(dados, v.lojaId)}
                      {v.grupoEntregaId && (
                        <span title="Vai virar uma parada só quando entrar na rota"
                          style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: COLORS.verde, background: COLORS.verdePale, borderRadius: 10, padding: "2px 7px", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          MESCLADA
                          <button onClick={() => desmesclar(dados.vendas.filter((x) => x.grupoEntregaId === v.grupoEntregaId))} title="Desfazer mesclagem"
                            style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "inline-flex", color: COLORS.verde }}>
                            <Icon name="close" size={11} color={COLORS.verde} />
                          </button>
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", color: v.data < data ? COLORS.laranjaEscuro : COLORS.cinza, fontSize: 13, fontWeight: v.data < data ? 700 : 400, whiteSpace: "nowrap" }}>
                      {formatarData(v.data)}{v.data < data ? " · atrasado" : ""}
                    </td>
                    <td style={{ padding: "10px 14px", color: COLORS.cinza, fontSize: 13, whiteSpace: "nowrap" }}>{kg(v.kgTotal)}</td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      <button onClick={() => retirarNoCd(v)} title="Cliente retirou no CD, sem entrega"
                        style={{ background: "none", border: `1px solid ${COLORS.cinzaClaro}`, borderRadius: 6, cursor: "pointer", padding: "4px 10px", fontSize: 12, color: COLORS.cinzaEscuro, whiteSpace: "nowrap" }}>
                        Retirada no CD
                      </button>
                      <button onClick={() => marcarSemRotaEntregue([v.id])} title="Já foi entregue, sem passar pela rota"
                        style={{ marginLeft: 6, background: "none", border: `1px solid ${COLORS.cinzaClaro}`, borderRadius: 6, cursor: "pointer", padding: "4px 10px", fontSize: 12, color: COLORS.cinzaEscuro, whiteSpace: "nowrap" }}>
                        Já entregue
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolavel>
        </Card>
      )}

      {retiradosHoje.length > 0 && (
        <Card style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.cinzaEscuro }}>Retirados no CD em {formatarData(data)}</div>
          {retiradosHoje.map((v) => (
            <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: COLORS.cinza, flexWrap: "wrap", gap: 8 }}>
              <span>#{v.numero ?? "—"} · {nomeDoCliente(dados, v.lojaId)} — retirado às {horaDe(v.entregueEm)}</span>
              <button onClick={() => desfazerRetirada(v)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.azul, fontSize: 12, fontWeight: 600, padding: 0 }}>Desfazer</button>
            </div>
          ))}
        </Card>
      )}

      {porVeiculo.length === 0 && semRota.length === 0 && retiradosHoje.length === 0 && (
        <Card style={{ textAlign: "center", color: COLORS.cinza, padding: 40 }}>Nenhuma venda pendente até {formatarData(data)}.</Card>
      )}

      {selecionadasParadas.length > 0 && (
        <Card style={{ padding: "12px 20px", background: COLORS.verdePale, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, position: "sticky", top: 8, zIndex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.cinzaEscuro }}>
            {selecionadasParadas.length} pedido{selecionadasParadas.length === 1 ? "" : "s"} selecionado{selecionadasParadas.length === 1 ? "" : "s"}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {podeMesclar && (
              <Btn icon="sync" onClick={mesclarSelecionadas} title="Junta os pedidos numa única parada da rota — cada um continua com sua própria nota">
                Mesclar em 1 parada
              </Btn>
            )}
            <Btn variant="ghost" onClick={abrirModalMoverParadas}>Mudar de veículo</Btn>
            <Btn variant="danger" onClick={removerVariasDaRota}>Tirar da rota</Btn>
            <Btn variant="secondary" onClick={() => setSelecionadasParadas([])}>Limpar seleção</Btn>
          </div>
        </Card>
      )}

      {porVeiculo.map(({ chave, veiculoId, viagem, paradas }) => {
        // Pedidos mesclados (mesmo grupoEntregaId) viram uma linha só daqui
        // pra baixo — checkbox, arraste, prioridade e "tirar da rota" valem
        // pro grupo inteiro.
        const linhas = agruparParadas(paradas);
        const carga = totaisDasVendas(paradas, dados.produtos);
        return (
        <Card key={chave} style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, borderBottom: `1px solid ${COLORS.cinzaClaro}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Icon name="caminhao" color={COLORS.verde} size={20} />
              <div>
                <div style={{ fontWeight: 700, color: COLORS.cinzaEscuro, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  {nomeVeiculo(veiculoId)}
                  {viagem > 1 && (
                    <span title="Outra viagem já aberta hoje para este mesmo veículo"
                      style={{ fontSize: 11, fontWeight: 600, color: COLORS.dourado, background: COLORS.douradoClaro, padding: "1px 8px", borderRadius: 10, whiteSpace: "nowrap" }}>
                      {viagem}ª viagem
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: COLORS.cinza }}>
                  {nomeMotoristaDaVenda(paradas[0])} · {linhas.length} {linhas.length === 1 ? "parada" : "paradas"}
                  {linhas.length !== paradas.length ? ` · ${paradas.length} pedidos` : ""}
                  {" · "}<strong style={{ color: COLORS.cinzaEscuro }}>{kg(carga.kgTotal)}{carga.caixas > 0 ? ` · ${rotuloCaixas(carga.caixas)}` : ""}</strong>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Btn icon="plus" variant="ghost" onClick={() => abrirAdicionarNaRota(veiculoId, viagem)} disabled={semRota.length === 0}
                title={semRota.length === 0 ? "Nenhum pedido aguardando escala" : "Acrescentar lojas a esta rota"}>
                Adicionar loja
              </Btn>
              {linhas.filter((l) => podeReordenar(l.membros[0])).length > 1 && (
                <Btn variant="ghost" onClick={() => reordenarVeiculo(veiculoId, viagem)} disabled={geocodificando} title="Reordenar por prioridade e proximidade (inclui as já carregadas, ainda não entregues)">
                  {geocodificando ? "Calculando…" : "Reordenar"}
                </Btn>
              )}
              <Btn variant="ghost" onClick={() => abrirMapaRota(veiculoId, viagem)}>Ver mapa da rota</Btn>
              <Btn icon="rota" variant="ghost" onClick={() => abrirNoMaps(veiculoId, viagem)}>Abrir no Maps</Btn>
              <Btn variant="ghost" onClick={() => imprimirRota(veiculoId, viagem)} disabled={imprimindo === chave}>
                {imprimindo === chave ? "Gerando…" : "Imprimir romaneio"}
              </Btn>
              {paradas.every((v) => v.statusEntrega === "entregue") && (
                <Btn variant="ghost" onClick={() => arquivarRota(veiculoId, viagem)} title="Rota concluída — tira ela da tela sem apagar os pedidos">
                  Arquivar rota
                </Btn>
              )}
            </div>
          </div>
          {rotaAlterada(veiculoId, viagem) && (
            <div style={{ padding: "10px 20px", background: "#FFF3CD", color: "#856404", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, borderBottom: `1px solid ${COLORS.cinzaClaro}` }}>
              <span><strong>Rota alterada.</strong> Lojas foram incluídas ou retiradas — o romaneio impresso antes está desatualizado.</span>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn onClick={() => imprimirRota(veiculoId, viagem)} disabled={imprimindo === chave}>
                  {imprimindo === chave ? "Gerando…" : "Gerar romaneio novo"}
                </Btn>
                <Btn variant="secondary" onClick={() => desmarcarAlterada(veiculoId, viagem)}>Agora não</Btn>
              </div>
            </div>
          )}
          <TabelaRolavel>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead style={{ background: COLORS.cinzaClaro }}>
                <tr>
                  <th style={{ padding: "10px 14px", width: 1 }}>
                    {paradas.some((v) => (v.statusEntrega ?? "pendente") === "pendente") && (
                      <input type="checkbox"
                        title="Selecionar todos os pendentes desta rota"
                        checked={paradas.filter((v) => (v.statusEntrega ?? "pendente") === "pendente").every((v) => selecionadasParadas.includes(v.id))}
                        onChange={(e) => {
                          const idsPendentes = paradas.filter((v) => (v.statusEntrega ?? "pendente") === "pendente").map((v) => v.id);
                          setSelecionadasParadas((s) => (e.target.checked
                            ? [...new Set([...s, ...idsPendentes])]
                            : s.filter((id) => !idsPendentes.includes(id))));
                        }} />
                    )}
                  </th>
                  {["#", "Pedido", "Cliente", "Status", "Saída CD", "Entrega", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", fontSize: 12, color: COLORS.cinza, padding: "10px 14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha, i) => {
                  const membros = linha.membros;
                  const representante = membros[0];
                  const idsMembros = membros.map((m) => m.id);
                  const pendenteTodos = membros.every((m) => (m.statusEntrega ?? "pendente") === "pendente");
                  const linhaPodeReordenar = membros.every(podeReordenar);
                  const algumSelecionado = idsMembros.some((id) => selecionadasParadas.includes(id));
                  const todosSelecionados = idsMembros.every((id) => selecionadasParadas.includes(id));
                  const arrastando = arrasto?.id === linha.id;
                  const nesteGrupo = arrasto?.veiculoId === veiculoId && arrasto?.viagem === viagem;
                  const linhaAcima = nesteGrupo && arrasto.destino === i && !arrastando && linhas[i - 1]?.id !== arrasto.id;
                  const linhaAbaixo = nesteGrupo && arrasto.destino === linhas.length && i === linhas.length - 1 && !arrastando;
                  const notasDaLoja = paradas.filter((p) => p.lojaId === representante.lojaId).length;
                  return (
                  <tr key={linha.id} data-rota-veiculo={veiculoId} data-rota-viagem={viagem}
                    style={{
                      borderTop: linhaAcima ? `3px solid ${COLORS.verde}` : `1px solid ${COLORS.cinzaClaro}`,
                      borderBottom: linhaAbaixo ? `3px solid ${COLORS.verde}` : undefined,
                      background: arrastando ? COLORS.cinzaClaro : algumSelecionado ? COLORS.verdePale : "transparent",
                      opacity: arrastando ? 0.6 : 1,
                    }}>
                    <td style={{ padding: "12px 14px" }}>
                      {pendenteTodos && (
                        <input type="checkbox" checked={todosSelecionados}
                          onChange={() => setSelecionadasParadas((s) => (todosSelecionados
                            ? s.filter((id) => !idsMembros.includes(id))
                            : [...new Set([...s, ...idsMembros])]))} />
                      )}
                    </td>
                    <td style={{ padding: "12px 14px", color: COLORS.cinza, fontSize: 13, whiteSpace: "nowrap" }}>
                      {podeReordenar(representante) ? (
                        <span title="Clique e arraste para mudar a posição na rota"
                          onPointerDown={(e) => iniciarArrasto(e, veiculoId, viagem, linha.id, i)}
                          onPointerMove={moverArrasto}
                          onPointerUp={terminarArrasto}
                          onPointerCancel={() => setArrasto(null)}
                          style={{ cursor: arrastando ? "grabbing" : "grab", touchAction: "none", userSelect: "none", display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 6px", margin: "-4px -6px", borderRadius: 6 }}>
                          <span style={{ fontSize: 16, lineHeight: 1, opacity: 0.6 }}>⠿</span>{i + 1}
                        </span>
                      ) : (
                        <span style={{ paddingLeft: 18 }}>{i + 1}</span>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px", color: COLORS.cinzaEscuro, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {representante.prioridade && <span title="Prioridade" style={{ color: COLORS.dourado, marginRight: 4 }}>★</span>}
                      {membros.map((m) => `#${m.numero ?? "—"}`).join(" + ")}
                    </td>
                    <td style={{ padding: "12px 14px", color: COLORS.cinzaEscuro, fontSize: 14 }}>
                      {nomeDoCliente(dados, representante.lojaId)}
                      {linha.mesclada ? (
                        <span title="Parada mesclada: pedidos separados, entregues juntos numa parada só"
                          style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: COLORS.verde, background: COLORS.verdePale, borderRadius: 10, padding: "2px 7px", whiteSpace: "nowrap" }}>
                          MESCLADA
                        </span>
                      ) : notasDaLoja > 1 && (
                        <span title="Outro(s) pedido(s) para esta mesma loja nesta rota — selecione os dois e mescle numa parada só, ou o romaneio impresso já junta as notas"
                          style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: COLORS.dourado, background: COLORS.douradoClaro, padding: "1px 7px", borderRadius: 10, whiteSpace: "nowrap" }}>
                          {notasDaLoja} notas
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 14px" }}><BadgeEntrega status={representante.statusEntrega ?? "pendente"} /></td>
                    <td style={{ padding: "12px 14px", color: COLORS.cinza, fontSize: 13, whiteSpace: "nowrap" }}>{horaDe(representante.saidaCdEm)}</td>
                    <td style={{ padding: "12px 14px", color: COLORS.cinza, fontSize: 13, whiteSpace: "nowrap" }}>{horaDe(representante.entregueEm)}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <button onClick={() => abrirQr(representante)} title={linha.mesclada ? "Ver QR de um dos pedidos — ler qualquer um confirma os dois" : "Ver QR da nota"}
                          style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.55, padding: 4 }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.55")}>
                          <Icon name="search" size={15} color={COLORS.cinzaEscuro} />
                        </button>
                        {podeForcarEntrega && (membros.every((m) => m.statusEntrega === "entregue") ? (
                          <button onClick={() => desmarcarEntregue(membros)} title="Desmarcar entrega (volta para Em rota)"
                            style={{ background: "none", border: `1px solid ${COLORS.cinzaClaro}`, borderRadius: 6, cursor: "pointer", padding: "3px 8px", fontSize: 11.5, color: COLORS.cinzaEscuro, whiteSpace: "nowrap" }}>
                            Desmarcar
                          </button>
                        ) : (
                          <button onClick={() => marcarEntregue(membros.filter((m) => m.statusEntrega !== "entregue"))} title="Marcar como entregue sem a leitura do QR"
                            style={{ background: "none", border: `1px solid ${COLORS.verde}`, borderRadius: 6, cursor: "pointer", padding: "3px 8px", fontSize: 11.5, color: COLORS.verde, whiteSpace: "nowrap" }}>
                            Entregue
                          </button>
                        ))}
                        {pendenteTodos && (
                          <button onClick={() => alternarPrioridade(idsMembros)} title={representante.prioridade ? "Tirar prioridade" : "Marcar como prioridade"}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: 4, color: representante.prioridade ? COLORS.dourado : COLORS.cinza }}>
                            {representante.prioridade ? "★" : "☆"}
                          </button>
                        )}
                        {linha.mesclada && linhaPodeReordenar && (
                          <button onClick={() => desmesclar(membros)} title="Desfazer mesclagem"
                            style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.55, padding: 4 }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.55")}>
                            <Icon name="close" size={13} color={COLORS.cinza} />
                          </button>
                        )}
                        {linhaPodeReordenar && (
                          <button onClick={() => removerDaRota(membros)} title="Tirar da rota"
                            style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.5, padding: 4 }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}>
                            <Icon name="trash" size={14} color={COLORS.vermelho} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </TabelaRolavel>
        </Card>
        );
      })}

      {porVeiculoArquivado.length > 0 && (
        <Card style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: COLORS.cinzaEscuro }}>Rotas arquivadas em {formatarData(data)}</div>
          {porVeiculoArquivado.map(({ chave, veiculoId, viagem, paradas }) => (
            <div key={chave} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: COLORS.cinza, flexWrap: "wrap", gap: 8 }}>
              <span>
                {nomeVeiculo(veiculoId)}{viagem > 1 ? ` · ${viagem}ª viagem` : ""} · {nomeMotoristaDaVenda(paradas[0])} · {paradas.length} {paradas.length === 1 ? "parada" : "paradas"}
              </span>
              <button onClick={() => desarquivarRota(veiculoId, viagem)} style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.azul, fontSize: 12, fontWeight: 600, padding: 0 }}>Desarquivar</button>
            </div>
          ))}
        </Card>
      )}

      {modalRota && (
        <Modal title={veiculoFixo ? `Adicionar loja — ${nomeVeiculo(veiculoFixo)}` : "Montar Rota"} onClose={() => setModalRota(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: COLORS.cinzaEscuro }}>
                1. Marque a prioridade e escolha os pedidos até {formatarData(data)} ({selecionadas.length} selecionado{selecionadas.length === 1 ? "" : "s"})
              </div>
              {semRota.length === 0 && <div style={{ fontSize: 13, color: COLORS.cinza }}>Nenhum pedido sem rota até esta data.</div>}
              {semRota.length > 5 && (
                <div style={{ marginBottom: 8 }}>
                  <Input placeholder="Buscar loja ou nº do pedido…" value={buscaRota} onChange={(e) => setBuscaRota(e.target.value)} />
                </div>
              )}
              {semRota.length > 0 && semRotaFiltrado.length === 0 && <div style={{ fontSize: 13, color: COLORS.cinza }}>Nenhum pedido encontrado.</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
                {semRotaFiltrado.map((v) => (
                  <label key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, background: selecionadas.includes(v.id) ? COLORS.verdePale : COLORS.creme, cursor: "pointer", fontSize: 13 }}>
                    <input type="checkbox" checked={selecionadas.includes(v.id)} onChange={() => alternarSelecao(v.id)} />
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); alternarPrioridade(v.id); }}
                      title={v.prioridade ? "Tirar prioridade" : "Marcar como prioridade"}
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, padding: 0, color: v.prioridade ? COLORS.dourado : COLORS.cinzaClaro }}>
                      {v.prioridade ? "★" : "☆"}
                    </button>
                    <span style={{ fontWeight: 600, color: COLORS.cinzaEscuro }}>#{v.numero ?? "—"}</span>
                    <span style={{ color: COLORS.cinzaEscuro, flex: 1 }}>
                      {nomeDoCliente(dados, v.lojaId)}
                      {v.grupoEntregaId && (
                        <span title="Mesclado com outro pedido — marque os dois pra entrarem juntos nesta rota"
                          style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: COLORS.verde, background: COLORS.verdePale, borderRadius: 10, padding: "1px 6px" }}>
                          MESCLADA
                        </span>
                      )}
                    </span>
                    {v.data < data && <span style={{ color: COLORS.laranjaEscuro, fontWeight: 600, fontSize: 12 }}>{formatarData(v.data)} · atrasado</span>}
                    <span style={{ color: COLORS.cinza }}>{kg(v.kgTotal)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: COLORS.cinzaEscuro }}>2. Escale o veículo e o motorista</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Select label="Veículo *" value={veiculoRota} disabled={!!veiculoFixo}
                  onChange={(e) => { setVeiculoRota(e.target.value); setNovaViagem(false); }}
                  options={[{ value: "", label: "Selecione..." }, ...veiculosAtivos.map((v) => ({ value: v.id, label: v.nome }))]} />
                <Select label="Motorista" value={motoristaRota} onChange={(e) => setMotoristaRota(e.target.value)}
                  options={[
                    { value: "", label: "Selecione..." },
                    ...motoristas.map((f) => ({ value: f.id, label: f.nome })),
                    { value: MOTORISTA_OUTRO, label: "Outro..." },
                  ]} />
              </div>
              {motoristaRota === MOTORISTA_OUTRO && (
                <div style={{ marginTop: 12 }}>
                  <Input label="Nome do motorista" placeholder="Nome de quem vai dirigir" value={motoristaRotaNome}
                    onChange={(e) => setMotoristaRotaNome(e.target.value)} />
                </div>
              )}
              {veiculoRotaTemViagemAberta && (
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 12, padding: "10px 12px", borderRadius: 8, background: COLORS.douradoClaro, cursor: "pointer", fontSize: 13 }}>
                  <input type="checkbox" checked={novaViagem} onChange={(e) => setNovaViagem(e.target.checked)} style={{ marginTop: 2 }} />
                  <span>
                    <strong>{nomeVeiculo(veiculoRota)}</strong> já tem uma {ultimaViagemVeiculoRota}ª viagem em aberto hoje.{" "}
                    Marque aqui pra começar uma <strong>{ultimaViagemVeiculoRota + 1}ª viagem</strong> nova, separada, em vez de somar mais paradas na que já está rodando.
                  </span>
                </label>
              )}
            </div>

            {geocodificando && (
              <div style={{ fontSize: 12.5, color: COLORS.cinza }}>Calculando a melhor ordem das paradas…</div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn variant="secondary" onClick={() => setModalRota(false)} disabled={geocodificando}>Cancelar</Btn>
              <Btn onClick={confirmarRota} disabled={!veiculoRota || selecionadas.length === 0 || geocodificando}>
                {geocodificando ? "Calculando…" : (veiculoRotaTemViagemAberta && novaViagem) ? `Iniciar ${ultimaViagemVeiculoRota + 1}ª viagem` : "Adicionar à Rota"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {modalMoverParadas && (
        <Modal title="Mudar de Veículo" onClose={() => setModalMoverParadas(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 13, color: COLORS.cinzaEscuro }}>
              Move {selecionadasParadas.length} pedido{selecionadasParadas.length === 1 ? "" : "s"} selecionado{selecionadasParadas.length === 1 ? "" : "s"} para outro veículo, mantendo a data da viagem.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Select label="Veículo *" value={veiculoDestino} onChange={(e) => setVeiculoDestino(e.target.value)}
                options={[{ value: "", label: "Selecione..." }, ...veiculosAtivos.map((v) => ({ value: v.id, label: v.nome }))]} />
              <Select label="Motorista" value={motoristaDestino} onChange={(e) => setMotoristaDestino(e.target.value)}
                options={[
                  { value: "", label: "Selecione..." },
                  ...motoristas.map((f) => ({ value: f.id, label: f.nome })),
                  { value: MOTORISTA_OUTRO, label: "Outro..." },
                ]} />
            </div>
            {motoristaDestino === MOTORISTA_OUTRO && (
              <Input label="Nome do motorista" placeholder="Nome de quem vai dirigir" value={motoristaDestinoNome}
                onChange={(e) => setMotoristaDestinoNome(e.target.value)} />
            )}
            {geocodificando && (
              <div style={{ fontSize: 12.5, color: COLORS.cinza }}>Calculando a melhor ordem das paradas…</div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn variant="secondary" onClick={() => setModalMoverParadas(false)} disabled={geocodificando}>Cancelar</Btn>
              <Btn onClick={confirmarMoverParadas} disabled={!veiculoDestino || geocodificando}>
                {geocodificando ? "Calculando…" : "Mover"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {mapaAberto && (
        <Modal title={`Mapa da rota — ${nomeVeiculo(mapaAberto.veiculoId)}${mapaAberto.viagem > 1 ? ` · ${mapaAberto.viagem}ª viagem` : ""}`} onClose={() => setMapaAberto(null)}>
          {mapaAberto.carregando ? (
            <div style={{ fontSize: 13, color: COLORS.cinza, padding: "24px 0", textAlign: "center" }}>Calculando a localização das paradas…</div>
          ) : !mapaAberto.cd ? (
            <div style={{ fontSize: 13, color: COLORS.cinza, padding: "24px 0", textAlign: "center" }}>
              Não foi possível localizar o CD no mapa agora. Verifique a internet e tente de novo.
            </div>
          ) : (
            <MapaRota origem={mapaAberto.cd} paradas={mapaAberto.pontos} />
          )}
        </Modal>
      )}

      {scanAberto && (
        <Modal title="Escanear Nota" onClose={fecharScan}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <LeitorQR ativo={scanAberto} aoLer={registrarLeitura} pausado={Boolean(leituraPendente)} validar={pareceCodigoDeNota} />
            {!leituraPendente && (
              <div style={{ fontSize: 12.5, color: COLORS.cinza, textAlign: "center" }}>
                Aponte para o QR da nota, dentro do quadro verde. O 1º escaneio confirma o carregamento (saída do CD); o 2º, a entrega na loja.
              </div>
            )}
            {leituraPendente && vendaPendente && (
              <div role="alertdialog" aria-label="Confirmar leitura" style={{ border: `2px solid ${COLORS.laranja}`, borderRadius: 12, padding: 14, background: "#FFF8EC", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.cinzaEscuro }}>
                  {leituraPendente.acao === "carregamento" ? "Confirmar carregamento" : "Confirmar entrega"} para{" "}
                  <span style={{ color: COLORS.verde }}>{nomeDoCliente(dados, vendaPendente.lojaId)}</span>
                  {itensPendentes.length > 0 ? " das mercadorias abaixo?" : "?"}
                </div>
                <div style={{ fontSize: 12.5, color: COLORS.cinza }}>
                  Pedido #{vendaPendente.numero ?? "—"} · {nomeVeiculo(vendaPendente.veiculoId)}
                  {vendaPendente.motoristaId || vendaPendente.motoristaNome ? ` · ${nomeMotoristaDaVenda(vendaPendente)}` : ""}
                </div>
                {vendaPendente.grupoEntregaId && (
                  <div style={{ fontSize: 12, color: COLORS.verde, fontWeight: 600 }}>
                    Parada mesclada: confirma junto {dados.vendas
                      .filter((v) => v.grupoEntregaId === vendaPendente.grupoEntregaId && v.id !== vendaPendente.id)
                      .map((v) => `#${v.numero ?? "—"}`).join(", ")}.
                  </div>
                )}
                {itensPendentes.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: COLORS.cinzaEscuro, maxHeight: 180, overflowY: "auto" }}>
                    {itensPendentes.map((i) => (
                      <li key={i.chave}>
                        <strong>{i.qtd}</strong> — {i.nome}{i.bonif ? " (bonif.)" : ""}
                      </li>
                    ))}
                  </ul>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <Btn variant="secondary" onClick={cancelarLeitura} style={{ flex: 1, justifyContent: "center" }}>Cancelar</Btn>
                  <Btn icon="check" onClick={confirmarLeitura} style={{ flex: 1, justifyContent: "center" }}>Confirmar</Btn>
                </div>
              </div>
            )}
            {mensagemScan && (
              <div style={{
                fontSize: 13.5, padding: "10px 14px", borderRadius: 8, fontWeight: 600,
                background: mensagemScan.tipo === "ok" ? COLORS.verdePale : mensagemScan.tipo === "aviso" ? "#FFF3CD" : "#FFEBEE",
                color: mensagemScan.tipo === "ok" ? COLORS.verde : mensagemScan.tipo === "aviso" ? "#856404" : COLORS.vermelho,
              }}>
                {mensagemScan.texto}
              </div>
            )}
            <Btn variant="secondary" onClick={fecharScan}>Fechar</Btn>
          </div>
        </Modal>
      )}

      {qrAberto && (
        <Modal title={`QR — Pedido #${qrAberto.venda.numero ?? "—"}`} onClose={() => setQrAberto(null)}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            {qrAberto.url
              ? <img src={qrAberto.url} alt={`QR do pedido #${qrAberto.venda.numero ?? ""}`} width={220} height={220} />
              : <div style={{ width: 220, height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.cinza }}>Gerando…</div>}
            <div style={{ textAlign: "center", fontSize: 13, color: COLORS.cinzaEscuro }}>{nomeDoCliente(dados, qrAberto.venda.lojaId)}</div>
            <Btn variant="secondary" onClick={() => setQrAberto(null)}>Fechar</Btn>
          </div>
        </Modal>
      )}

      {detalheId && (() => {
        const d = dados.vendas.find((x) => x.id === detalheId);
        return d ? <DetalhePedidoModal venda={d} dados={dados} setDados={setDados} onClose={() => setDetalheId(null)} /> : null;
      })()}

      {modalAvulso && (
        <Modal title="Romaneio avulso" onClose={() => setModalAvulso(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 13, color: COLORS.cinza }}>
              Escala só esse pedido — sem marcar checkbox na lista de "Montar Rota" — e já gera o QR e o romaneio dele na hora.
            </div>
            {semRota.length === 0 ? (
              <div style={{ fontSize: 13, color: COLORS.cinza }}>Nenhum pedido sem rota até {formatarData(data)}.</div>
            ) : (
              <Select label="Pedido *" value={pedidoAvulso} onChange={(e) => { setPedidoAvulso(e.target.value); setQrAvulso(null); }}
                options={[{ value: "", label: "Selecione..." }, ...semRota.map((v) => ({ value: v.id, label: `#${v.numero ?? "—"} — ${nomeDoCliente(dados, v.lojaId)}` }))]} />
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Select label="Veículo *" value={veiculoAvulso} onChange={(e) => { setVeiculoAvulso(e.target.value); setQrAvulso(null); }}
                options={[{ value: "", label: "Selecione..." }, ...veiculosAtivos.map((v) => ({ value: v.id, label: v.nome }))]} />
              <Select label="Motorista *" value={motoristaAvulso} onChange={(e) => { setMotoristaAvulso(e.target.value); setQrAvulso(null); }}
                options={[
                  { value: "", label: "Selecione..." },
                  ...motoristas.map((f) => ({ value: f.id, label: f.nome })),
                  { value: MOTORISTA_OUTRO, label: "Outro..." },
                ]} />
            </div>
            {motoristaAvulso === MOTORISTA_OUTRO && (
              <Input label="Nome do motorista" placeholder="Nome de quem vai dirigir" value={motoristaAvulsoNome}
                onChange={(e) => { setMotoristaAvulsoNome(e.target.value); setQrAvulso(null); }} />
            )}

            {qrAvulso && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingTop: 6 }}>
                <img src={qrAvulso.url} alt={`QR — Pedido #${qrAvulso.numero}`} width={200} height={200} />
                <div style={{ textAlign: "center", fontSize: 13, color: COLORS.cinzaEscuro }}>
                  Pedido #{qrAvulso.numero} · {qrAvulso.cliente}<br />
                  <span style={{ color: COLORS.cinza }}>{qrAvulso.veiculo} · {qrAvulso.motorista}</span>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn variant="secondary" onClick={() => setModalAvulso(false)}>Fechar</Btn>
              {qrAvulso
                ? <Btn onClick={imprimirAvulso}>Baixar PDF</Btn>
                : <Btn onClick={confirmarAvulso} disabled={!pedidoAvulso || !veiculoAvulso || !motoristaAvulso || (motoristaAvulso === MOTORISTA_OUTRO && !motoristaAvulsoNome.trim()) || gerandoAvulso}>
                    {gerandoAvulso ? "Gerando…" : "Escalar e gerar QR"}
                  </Btn>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── Compras ─────────────────────────────────────────────────────────────────
//
// A aba COMPRA DE MERCADORIAS: data, fornecedor, peso, $/kg, total.
//
// Compra-se FRUTA, não produto. A laranja pera que entra do fornecedor vira
// tanto agranel quanto saco de 2,5 kg — é um estoque só, que se reparte na
// hora de vender. É daqui que sai o custo por quilo, e sem ele não há margem.

const Compras = ({ dados, setDados }) => {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ data: hojeISO(), fornecedorId: "", fruta: "Laranja Pera", pesoKg: "", valorKg: "", observacao: "" });
  // Compra-se só o que tem estoque: as frutas da Carvalho Cruz.
  const frutas = useMemo(() => frutasComEstoque(dados), [dados]);
  const meses = useMemo(() => mesesComMovimento(dados), [dados]);
  const { filtros, setFiltros, limpar, intervalo } = useFiltros("compras", { periodo: "mes", agrupar: "dia" });
  const [dimensao, setDimensao] = useState("fornecedor");

  const nomeFornecedor = (id) => dados.fornecedores.find((f) => f.id === id)?.nome ?? "—";

  const doRecorte = (c, intv) =>
    noIntervalo(c.data, intv) &&
    (!filtros.fruta || c.fruta === filtros.fruta) &&
    (!filtros.fornecedor || (filtros.fornecedor === "-" ? !c.fornecedorId : c.fornecedorId === filtros.fornecedor));

  const ordenadas = [...dados.compras].sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const filtradas = ordenadas.filter((c) => doRecorte(c, intervalo));
  const ant = intervaloAnterior(intervalo);
  const anteriores = ant ? dados.compras.filter((c) => doRecorte(c, ant)) : null;

  const somar = (lista) => {
    const kgT = lista.reduce((s, c) => s + c.pesoKg, 0);
    const valor = lista.reduce((s, c) => s + c.total, 0);
    return { kg: kgT, valor, compras: lista.length, custoMedio: kgT > 0 ? valor / kgT : 0 };
  };
  const total = somar(filtradas);
  const totalAnt = anteriores ? somar(anteriores) : null;
  const vs = (campo) => (totalAnt ? variacao(total[campo], totalAnt[campo]) : undefined);
  const qtdFornecedores = new Set(filtradas.map((c) => c.fornecedorId || "-")).size;

  /**
   * Custo médio é divisão, não média das médias: soma o que foi pago e divide
   * pelo que foi comprado. Uma carga de 329 t a R$ 0,60 pesa muito mais na
   * conta do que uma de 18 t a R$ 0,78 — e é assim que tem de pesar.
   */
  const agruparCompras = (chaveDe, nomeDe) => {
    const mapa = new Map();
    for (const c of filtradas) {
      const k = chaveDe(c);
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k).push(c);
    }
    return [...mapa].map(([k, lista]) => {
      const s = somar(lista);
      const precos = lista.map((c) => c.valorKg);
      return { id: k, nome: nomeDe(k), ...s, menorPreco: Math.min(...precos), maiorPreco: Math.max(...precos), ultima: lista.map((c) => c.data).sort().pop() };
    });
  };
  const DIMENSOES_COMPRA = [
    { valor: "fornecedor", rotulo: "Fornecedor", chave: (c) => c.fornecedorId || "-", nome: (k) => (k === "-" ? "Sem fornecedor" : nomeFornecedor(k)) },
    { valor: "fruta", rotulo: "Fruta", chave: (c) => c.fruta, nome: (k) => k },
    { valor: "mes", rotulo: "Mês", chave: (c) => mesDe(c.data), nome: (k) => nomeDoMes(k) },
  ];
  const dim = DIMENSOES_COMPRA.find((d) => d.valor === dimensao);
  const colunasCompra = (rotulo) => [
    { chave: "nome", rotulo },
    { chave: "valor", rotulo: "Valor", formatar: brl, destaque: true, participacao: true },
    { chave: "kg", rotulo: "Peso", formatar: kg },
    { chave: "compras", rotulo: "Compras" },
    { chave: "custoMedio", rotulo: "Custo médio / kg", formatar: brl },
    { chave: "menorPreco", rotulo: "Menor R$/kg", formatar: brl },
    { chave: "maiorPreco", rotulo: "Maior R$/kg", formatar: brl },
    { chave: "ultima", rotulo: "Última", formatar: formatarData },
  ];

  const porFruta = frutas.map((f) => {
    const lista = filtradas.filter((c) => c.fruta === f);
    return { fruta: f, ...somar(lista) };
  }).filter((f) => !filtros.fruta || f.fruta === filtros.fruta);

  // Evolução: valor comprado e custo médio por período — dois gráficos, uma escala cada.
  const porGrupo = new Map();
  for (const c of filtradas) {
    const k = chaveGrupo(c.data, filtros.agrupar);
    const l = porGrupo.get(k) ?? { kg: 0, valor: 0 };
    l.kg += c.pesoKg;
    l.valor += c.total;
    porGrupo.set(k, l);
  }
  const pontos = chavesContinuas([...porGrupo.keys()], filtros.agrupar).map((k) => {
    const l = porGrupo.get(k);
    return {
      chave: k, rotulo: rotuloGrupo(k, filtros.agrupar), rotuloLongo: rotuloGrupo(k, filtros.agrupar, true),
      valores: { valor: l?.valor ?? 0, kg: l?.kg ?? 0, custo: l && l.kg > 0 ? l.valor / l.kg : 0 },
    };
  });

  const descricaoRecorte = [
    rotuloIntervalo(intervalo),
    filtros.fruta,
    filtros.fornecedor && (filtros.fornecedor === "-" ? "sem fornecedor" : nomeFornecedor(filtros.fornecedor)),
  ].filter(Boolean).join(" · ");

  const exportar = (formato) => {
    const tabelas = [
      ...DIMENSOES_COMPRA.map((d) => tabelaExportavel(`Por ${d.rotulo}`, `Compras por ${d.rotulo.toLowerCase()}`,
        colunasCompra(d.rotulo), agruparCompras(d.chave, d.nome).sort((a, b) => b.valor - a.valor))),
      {
        nome: "Lançamentos", titulo: "Lançamentos",
        colunas: [
          { chave: "data", rotulo: "Data" }, { chave: "fornecedor", rotulo: "Fornecedor" }, { chave: "fruta", rotulo: "Fruta" },
          { chave: "peso", rotulo: "Peso" }, { chave: "valorKg", rotulo: "R$ / kg" }, { chave: "total", rotulo: "Total" },
          { chave: "observacao", rotulo: "Observação" },
        ],
        linhas: filtradas.map((c) => ({
          data: formatarData(c.data), fornecedor: nomeFornecedor(c.fornecedorId), fruta: c.fruta, peso: kg(c.pesoKg),
          valorKg: brl(c.valorKg), total: brl(c.total), observacao: c.observacao ?? "",
        })),
      },
    ];
    return formato === "xlsx"
      ? exportarXlsx("compras-carvalho-cruz", tabelas)
      : exportarPdf("compras-carvalho-cruz", `Compras — ${descricaoRecorte}`, tabelas);
  };

  const totalPrevia = (Number(form.pesoKg) || 0) * (Number(form.valorKg) || 0);
  const podeSalvar = Number(form.pesoKg) > 0 && Number(form.valorKg) >= 0 && form.data;

  const fechar = () => {
    setModal(false);
    setForm({ data: hojeISO(), fornecedorId: "", fruta: "Laranja Pera", pesoKg: "", valorKg: "", observacao: "" });
  };

  const salvar = () => {
    if (!podeSalvar) return;
    const pesoKg = Number(form.pesoKg);
    const valorKg = Number(form.valorKg);
    const nova = {
      ...form,
      id: novoId(),
      pesoKg,
      valorKg,
      total: pesoKg * valorKg,
      criadoEm: new Date().toISOString(),
    };
    setDados((d) => ({ ...d, compras: [...d.compras, nova] }));
    fechar();
  };

  const remover = (c) => {
    if (confirm(`Remover a compra de ${kg(c.pesoKg)} de ${c.fruta} em ${formatarData(c.data)}?`)) {
      setDados((d) => ({ ...d, compras: d.compras.filter((x) => x.id !== c.id) }));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <BarraFiltros
        dados={dados} filtros={filtros} setFiltros={setFiltros} limpar={limpar} intervalo={intervalo}
        campos={["agrupar", "fruta", "fornecedor"]} meses={meses} frutas={frutas}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
        <Indicador rotulo="Comprado" valor={kg(total.kg)} sub={`${total.compras} compras`} pct={vs("kg")} cor={COLORS.azul} />
        <Indicador rotulo="Valor total" valor={brl(total.valor)} sub="mercadoria" pct={vs("valor")} inverter cor={COLORS.laranjaEscuro} />
        <Indicador rotulo="Custo médio / kg" valor={brl(total.custoMedio)} sub="ponderado pelo peso" pct={vs("custoMedio")} inverter cor={COLORS.verde} />
        <Indicador rotulo="Fornecedores" valor={qtdFornecedores} sub={descricaoRecorte} />
      </div>

      {/* Custo por fruta — o número que decide se a venda deu lucro */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
        {porFruta.map((f) => (
          <Card key={f.fruta} style={{ borderLeft: `4px solid ${f.kg > 0 ? COLORS.verdeClaro : COLORS.cinzaClaro}` }}>
            <div style={{ fontWeight: 700, color: COLORS.cinzaEscuro, fontSize: 14 }}>{f.fruta}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: f.kg > 0 ? COLORS.verde : COLORS.cinza, marginTop: 6 }}>
              {f.kg > 0 ? brl(f.custoMedio) : "—"}
              {f.kg > 0 && <span style={{ fontSize: 13, fontWeight: 400, color: COLORS.cinza }}> / kg</span>}
            </div>
            <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: 4 }}>
              {f.kg > 0 ? `${kg(f.kg)} · ${brl(f.valor)} · ${f.compras} compra(s)` : "Nenhuma compra no período"}
            </div>
          </Card>
        ))}
      </div>

      {filtradas.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          <Card>
            <h4 style={{ margin: "0 0 4px", color: COLORS.cinzaEscuro, fontSize: 15 }}>Valor comprado</h4>
            <p style={{ margin: "0 0 12px", fontSize: 12.5, color: COLORS.cinza }}>{AGRUPAMENTOS.find((a) => a.value === filtros.agrupar)?.label}, em reais.</p>
            <GraficoColunas pontos={pontos} series={[{ chave: "valor", rotulo: "Valor", cor: CORES_SERIE.despesas }]} />
          </Card>
          <Card>
            <h4 style={{ margin: "0 0 4px", color: COLORS.cinzaEscuro, fontSize: 15 }}>Custo médio por kg</h4>
            <p style={{ margin: "0 0 12px", fontSize: 12.5, color: COLORS.cinza }}>{AGRUPAMENTOS.find((a) => a.value === filtros.agrupar)?.label}, ponderado pelo peso — só onde houve compra.</p>
            <GraficoColunas pontos={pontos.filter((p) => p.valores.kg > 0)} series={[{ chave: "custo", rotulo: "R$ / kg", cor: CORES_SERIE.resultado }]}
              formatarEixo={(v) => `R$ ${v.toFixed(2).replace(".", ",")}`} />
          </Card>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <FiltroPills
          opcoes={DIMENSOES_COMPRA.map((d) => ({ valor: d.valor, rotulo: `Por ${d.rotulo.toLowerCase()}` }))}
          selecionado={dimensao}
          aoSelecionar={setDimensao}
        />
        <Ranking
          key={dimensao}
          titulo={`Compras por ${dim.rotulo.toLowerCase()}`}
          subtitulo={descricaoRecorte}
          linhas={agruparCompras(dim.chave, dim.nome)}
          colunas={colunasCompra(dim.rotulo)}
          ordemInicial={dimensao === "mes" ? "id" : "valor"}
          acoes={<BotoesExportar aoExportarXlsx={() => exportar("xlsx")} aoExportarPdf={() => exportar("pdf")} />}
        />
      </div>

      <div className="cc-filtros" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <span style={{ fontSize: 13, color: COLORS.cinza }}>
          {filtradas.length} lançamento(s) · {descricaoRecorte}
        </span>
        <Btn icon="plus" onClick={() => setModal(true)}>Nova Compra</Btn>
      </div>

      <Card style={{ padding: 0, overflow: "auto" }}>
        <TabelaRolavel>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead style={{ background: COLORS.cinzaClaro }}>
              <tr>
                {["Data", "Fornecedor", "Fruta", "Peso", "R$ / kg", "Total", "Comprovante", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", fontSize: 12, color: COLORS.cinza, padding: "12px 14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((c) => (
                <tr key={c.id} style={{ borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
                  <td style={{ padding: "13px 14px", color: COLORS.cinza, fontSize: 13, whiteSpace: "nowrap" }}>{formatarData(c.data)}</td>
                  <td style={{ padding: "13px 14px", color: COLORS.cinzaEscuro, fontSize: 14 }}>{nomeFornecedor(c.fornecedorId)}</td>
                  <td style={{ padding: "13px 14px", color: COLORS.cinza, fontSize: 13, whiteSpace: "nowrap" }}>{c.fruta}</td>
                  <td style={{ padding: "13px 14px", color: COLORS.cinzaEscuro, fontSize: 13, whiteSpace: "nowrap" }}>{kg(c.pesoKg)}</td>
                  <td style={{ padding: "13px 14px", color: COLORS.cinza, fontSize: 13, whiteSpace: "nowrap" }}>{brl(c.valorKg)}</td>
                  <td style={{ padding: "13px 14px", fontWeight: 700, color: COLORS.laranjaEscuro, whiteSpace: "nowrap" }}>{brl(c.total)}</td>
                  <td style={{ padding: "13px 14px" }}><LinkComprovante caminho={c.comprovantePath} nome={c.comprovanteNome} /></td>
                  <td style={{ padding: "13px 14px" }}>
                    <button onClick={() => remover(c)} title="Remover compra"
                      style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.4, padding: 2 }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}>
                      <Icon name="trash" color={COLORS.vermelho} size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabelaRolavel>
        {filtradas.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.cinza }}>
            Nenhuma compra em {descricaoRecorte}.
          </div>
        )}
      </Card>

      {modal && (
        <Modal title="Nova Compra" onClose={fechar}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Data *" type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
              <Select label="Fornecedor" value={form.fornecedorId} onChange={(e) => setForm((f) => ({ ...f, fornecedorId: e.target.value }))}
                options={[{ value: "", label: "Selecione..." },
                  ...dados.fornecedores.filter((f) => f.status === "ativo").map((f) => ({ value: f.id, label: f.nome }))]} />
            </div>

            <Select label="Fruta *" value={form.fruta} onChange={(e) => setForm((f) => ({ ...f, fruta: e.target.value }))}
              options={frutas.map((v) => ({ value: v, label: v }))} />
            <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: -8 }}>
              A compra entra pela fruta. A laranja pera que chega vira tanto agranel quanto saco.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Peso (kg) *" type="number" min="0" step="0.001" value={form.pesoKg} onChange={(e) => setForm((f) => ({ ...f, pesoKg: e.target.value }))} />
              <Input label="R$ / kg *" type="number" min="0" step="0.0001" value={form.valorKg} onChange={(e) => setForm((f) => ({ ...f, valorKg: e.target.value }))} />
            </div>

            {totalPrevia > 0 && (
              <div style={{ fontSize: 13, color: COLORS.verde, background: COLORS.verdePale, borderRadius: 6, padding: "9px 12px" }}>
                {kg(Number(form.pesoKg))} × {brl(Number(form.valorKg))} = <strong>{brl(totalPrevia)}</strong>
              </div>
            )}

            <Input label="Observação" value={form.observacao} onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))} placeholder="Nota fiscal, romaneio, carga…" />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn variant="secondary" onClick={fechar}>Cancelar</Btn>
              <Btn onClick={salvar} style={{ opacity: podeSalvar ? 1 : 0.5 }}>Registrar Compra</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── Despesas ────────────────────────────────────────────────────────────────
//
// A aba NÃO MEXER da planilha, que guardava oito tabelas soltas de
// data/descrição/valor. Aqui é uma lista só, com a categoria como campo — o
// que permite somar por mês e alimentar o DRE sem fórmula nenhuma.

const Despesas = ({ dados, setDados, caixa, aoMudarCaixa, lancarAgora, aoLancar }) => {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(formDespesaVazio);
  const { filtros, setFiltros, limpar, intervalo } = useFiltros("despesas", { periodo: "mes", agrupar: "dia" });
  const meses = useMemo(() => mesesComMovimento(dados), [dados]);
  const [busca, setBusca] = useState("");
  // Comprovante escolhido no modal (ainda não enviado) e o aviso da leitura dele.
  const [anexo, setAnexo] = useState(null);
  const [lendoAnexo, setLendoAnexo] = useState(false);
  const [avisoAnexo, setAvisoAnexo] = useState("");
  // Texto que o app enxergou no comprovante, para a pessoa conferir quando a leitura falha.
  const [textoLido, setTextoLido] = useState("");
  const [leituraIncompleta, setLeituraIncompleta] = useState(false);
  const [salvando, setSalvando] = useState(false);
  // Comprovante aberto em tela cheia dentro do app, e a prévia dele no formulário.
  const [visor, setVisor] = useState(null);
  const [previa, setPrevia] = useState(null);
  const urlLocal = useRef(null);
  const trocarPrevia = (nova) => {
    if (urlLocal.current) URL.revokeObjectURL(urlLocal.current);
    urlLocal.current = nova?.local ? nova.url : null;
    setPrevia(nova);
  };
  // Comprovantes que chegaram pelo Atalho do iPhone e esperam virar despesa
  // (a lista vem do App, que também mostra o contador no menu).
  const caixaPendente = useMemo(() => {
    const usados = caminhosDeComprovante(dados);
    return caixa.filter((c) => !usados.has(c.caminho));
  }, [caixa, dados]);
  // Combustível e folha têm aba própria, mas são saída de caixa do mesmo jeito:
  // ligados, o total aqui é o mesmo "Despesas" do DRE.
  const [incluirOutros, setIncluirOutros] = useState(() => {
    try { return sessionStorage.getItem("cc-despesas-outros") !== "0"; } catch { return true; }
  });
  const alternarOutros = () => setIncluirOutros((v) => {
    try { sessionStorage.setItem("cc-despesas-outros", v ? "0" : "1"); } catch { /* sem armazenamento */ }
    return !v;
  });

  // Todas as saídas numa lista só, cada uma dizendo de onde veio.
  const saidas = useMemo(() => {
    const nomeVeiculo = new Map((dados.veiculos ?? []).map((v) => [v.id, [v.nome, v.placa].filter(Boolean).join(" ")]));
    const lista = dados.despesas.map((d) => ({ ...d, origem: "despesa" }));
    if (incluirOutros) {
      for (const a of dados.abastecimentos) {
        lista.push({
          id: `comb-${a.id}`, data: a.data, categoria: "Combustível", origem: "combustivel", valor: a.valor,
          comprovantePath: a.comprovantePath, comprovanteNome: a.comprovanteNome,
          descricao: [a.tipoCombustivel, a.litros ? `${String(a.litros).replace(".", ",")} L` : "", nomeVeiculo.get(a.veiculoId), a.motorista].filter(Boolean).join(" · "),
        });
      }
      for (const p of dados.pagamentos) {
        lista.push({
          id: `folha-${p.id}`, data: p.data, origem: "folha", valor: p.valor,
          comprovantePath: p.comprovantePath, comprovanteNome: p.comprovanteNome,
          categoria: p.funcionarioTipo === "Diarista" ? "Diaristas" : "Funcionários",
          descricao: [p.funcionarioNome, p.descricao].filter(Boolean).join(" — "),
        });
      }
    }
    return lista;
  }, [dados.despesas, dados.abastecimentos, dados.pagamentos, dados.veiculos, incluirOutros]);

  const categorias = useMemo(() => {
    const extras = [...new Set(saidas.map((d) => d.categoria))].filter((c) => !CATEGORIAS_DESPESA.includes(c)).sort();
    return [...CATEGORIAS_DESPESA, ...extras];
  }, [saidas]);

  const termo = textoBuscavel(busca.trim());
  const doRecorte = (d, intv) =>
    noIntervalo(d.data, intv) && (!filtros.categoria || d.categoria === filtros.categoria);
  const filtradas = saidas
    .filter((d) => doRecorte(d, intervalo))
    .filter((d) => !termo || textoBuscavel(`${d.categoria} ${d.descricao ?? ""}`).includes(termo))
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));
  // Total de cada categoria no período (e busca), sem o filtro de categoria —
  // é o que os botões de categoria em cima da lista mostram.
  const totaisCategoria = new Map();
  for (const d of saidas) {
    if (!noIntervalo(d.data, intervalo)) continue;
    if (termo && !textoBuscavel(`${d.categoria} ${d.descricao ?? ""}`).includes(termo)) continue;
    const t = totaisCategoria.get(d.categoria) ?? { total: 0, qtd: 0 };
    t.total += d.valor;
    t.qtd += 1;
    totaisCategoria.set(d.categoria, t);
  }
  const chipsCategoria = [...totaisCategoria.entries()].sort((a, b) => b[1].total - a[1].total);
  if (filtros.categoria && !totaisCategoria.has(filtros.categoria)) chipsCategoria.push([filtros.categoria, { total: 0, qtd: 0 }]);
  const totalTodas = chipsCategoria.reduce((s, [, t]) => s + t.total, 0);
  const qtdTodas = chipsCategoria.reduce((s, [, t]) => s + t.qtd, 0);
  const escolherCategoria = (c) => setFiltros({ categoria: filtros.categoria === c ? "" : c });

  const ant = intervaloAnterior(intervalo);
  const totalAnt = ant ? saidas.filter((d) => doRecorte(d, ant)).reduce((s, d) => s + d.valor, 0) : null;

  const total = filtradas.reduce((s, d) => s + d.valor, 0);
  const datas = filtradas.map((d) => d.data).sort();
  const deData = intervalo.de ?? datas[0];
  const ateData = intervalo.ate ?? datas[datas.length - 1];
  const dias = deData && ateData
    ? Math.max(1, Math.round((new Date(`${ateData}T12:00:00`) - new Date(`${deData}T12:00:00`)) / 86_400_000) + 1)
    : 1;
  const maiorLancamento = filtradas.reduce((m, d) => (d.valor > (m?.valor ?? -1) ? d : m), null);

  const porCategoria = (() => {
    const mapa = new Map();
    for (const d of filtradas) {
      const l = mapa.get(d.categoria) ?? { id: d.categoria, nome: d.categoria, total: 0, lancamentos: 0, maior: 0 };
      l.total += d.valor;
      l.lancamentos += 1;
      l.maior = Math.max(l.maior, d.valor);
      mapa.set(d.categoria, l);
    }
    return [...mapa.values()].map((l) => ({ ...l, media: l.total / l.lancamentos, porDia: l.total / dias }))
      .sort((a, b) => b.total - a.total);
  })();
  const colunasCategoria = [
    { chave: "nome", rotulo: "Categoria" },
    { chave: "total", rotulo: "Total", formatar: brl, destaque: true, participacao: true },
    { chave: "lancamentos", rotulo: "Lançamentos" },
    { chave: "media", rotulo: "Média por lançamento", formatar: brl },
    { chave: "porDia", rotulo: "Média por dia", formatar: brl },
    { chave: "maior", rotulo: "Maior", formatar: brl },
  ];

  // Categoria × período — a tabela cruzada que a planilha montava na mão.
  const grupos = chavesContinuas(filtradas.map((d) => chaveGrupo(d.data, filtros.agrupar)), filtros.agrupar);
  const cruzada = new Map();
  for (const d of filtradas) {
    const k = `${d.categoria}|${chaveGrupo(d.data, filtros.agrupar)}`;
    cruzada.set(k, (cruzada.get(k) ?? 0) + d.valor);
  }
  const totalDoGrupo = (g) => porCategoria.reduce((s, c) => s + (cruzada.get(`${c.nome}|${g}`) ?? 0), 0);

  const pontos = grupos.map((g) => ({
    chave: g, rotulo: rotuloGrupo(g, filtros.agrupar), rotuloLongo: rotuloGrupo(g, filtros.agrupar, true),
    valores: { total: totalDoGrupo(g) },
  }));

  const descricaoRecorte = [rotuloIntervalo(intervalo), filtros.categoria].filter(Boolean).join(" · ");

  const exportar = (formato) => {
    const tabelas = [
      tabelaExportavel("Por categoria", `Por categoria — ${descricaoRecorte}`, colunasCategoria, porCategoria),
      {
        nome: "Categoria x período", titulo: "Categoria × período",
        colunas: [{ chave: "categoria", rotulo: "Categoria" }, ...grupos.map((g) => ({ chave: g, rotulo: rotuloGrupo(g, filtros.agrupar) })), { chave: "total", rotulo: "Total" }],
        linhas: [
          ...porCategoria.map((c) => ({
            categoria: c.nome,
            ...Object.fromEntries(grupos.map((g) => [g, brl(cruzada.get(`${c.nome}|${g}`) ?? 0)])),
            total: brl(c.total),
          })),
          { categoria: "Total", ...Object.fromEntries(grupos.map((g) => [g, brl(totalDoGrupo(g))])), total: brl(total) },
        ],
      },
      {
        nome: "Lançamentos", titulo: "Lançamentos",
        colunas: [{ chave: "data", rotulo: "Data" }, { chave: "categoria", rotulo: "Categoria" }, { chave: "descricao", rotulo: "Descrição" }, { chave: "valor", rotulo: "Valor" }],
        linhas: filtradas.map((d) => ({ data: formatarData(d.data), categoria: d.categoria, descricao: d.descricao ?? "", valor: brl(d.valor) })),
      },
    ];
    return formato === "xlsx"
      ? exportarXlsx("despesas-carvalho-cruz", tabelas)
      : exportarPdf("despesas-carvalho-cruz", `Despesas — ${descricaoRecorte}`, tabelas);
  };

  // Despesa com comprovante precisa dizer do que se trata: o comprovante do
  // banco só tem o favorecido, e meses depois ninguém lembra por que pagou.
  // (Pagamento do posto não tem descrição: o que ele quita é a lista de abastecimentos.)
  const exigeDescricao = Boolean(anexo || form.comprovantePath) && form.categoria !== CAT_COMBUSTIVEL;

  // Para onde o lançamento vai, pela categoria. Despesa já gravada só edita como despesa.
  const destino = form.id ? "despesa"
    : form.categoria === CAT_COMBUSTIVEL ? "posto"
      : form.categoria === CAT_FOLHA ? "folha"
        : form.categoria === CAT_COMPRA ? "compra"
          : "despesa";
  const funcionariosAtivos = dados.funcionarios.filter((f) => f.status === "ativo");
  const frutas = useMemo(() => frutasComEstoque(dados), [dados]);

  const valorTotal = Number(form.valor) || 0;
  const pesoKg = Number(form.pesoKg) || 0;
  // Custo por quilo: sai do valor pago ÷ peso, a menos que a pessoa digite o dela.
  const custoKgSugerido = pesoKg > 0 ? Math.round((valorTotal / pesoKg) * 10_000) / 10_000 : 0;
  const custoKg = form.valorKgManual ? Number(form.valorKg) || 0 : custoKgSugerido;
  // O banco guarda o custo com 4 casas e calcula o total sozinho; em carga grande
  // o arredondamento pode deixar o total gravado diferente do que foi pago.
  const totalGravadoCompra = Math.round(pesoKg * custoKg * 100) / 100;
  const difCompra = Math.abs(totalGravadoCompra - valorTotal);

  // Pagamento do posto: os abastecimentos em aberto (sem pago_em), do mais
  // antigo ao mais novo. Só os últimos 60 dias aparecem de saída, para o
  // histórico antigo não atrapalhar; "mostrar mais antigos" abre o resto.
  const abertosPosto = dados.abastecimentos.filter((a) => !a.pagoEm)
    .sort((a, b) => String(a.data).localeCompare(String(b.data)) || String(a.criadoEm ?? "").localeCompare(String(b.criadoEm ?? "")));
  const limiteAntigo = (() => {
    const d = new Date(`${form.data || hojeISO()}T12:00:00`);
    d.setDate(d.getDate() - 60);
    return d.toISOString().slice(0, 10);
  })();
  const visiveisPosto = form.verAntigos ? abertosPosto : abertosPosto.filter((a) => a.data >= limiteAntigo);
  const selecionadosPosto = new Set(form.selecaoManual ? form.abastecimentosIds : acharQuinzena(visiveisPosto, valorTotal));
  const somaPosto = abertosPosto.filter((a) => selecionadosPosto.has(a.id)).reduce((s, a) => s + a.valor, 0);
  const difPosto = Math.round((valorTotal - somaPosto) * 100) / 100;
  const alternarAbastecimento = (id) => setForm((f) => {
    const novo = new Set(selecionadosPosto);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    return { ...f, selecaoManual: true, abastecimentosIds: [...novo] };
  });
  const nomeDoVeiculo = (id) => (dados.veiculos ?? []).find((v) => v.id === id)?.nome ?? "";

  const podeSalvar = valorTotal > 0 && form.data && form.categoria
    && (!exigeDescricao || form.descricao.trim().length > 0)
    && (destino !== "posto" || (selecionadosPosto.size > 0 && Math.abs(difPosto) <= 0.05))
    && (destino !== "folha" || form.funcionarioId)
    && (destino !== "compra" || (form.fruta && pesoKg > 0 && custoKg > 0));

  const fechar = () => {
    setModal(false);
    setAnexo(null);
    trocarPrevia(null);
    setAvisoAnexo("");
    setTextoLido("");
    setLeituraIncompleta(false);
    setForm(formDespesaVazio());
  };

  // Trocar a categoria já deixa pronto o que o destino pede (primeiro veículo, primeira fruta).
  const mudarCategoriaDoForm = (categoria) => setForm((f) => ({
    ...f,
    categoria,
    selecaoManual: false,
    abastecimentosIds: [],
    fruta: f.fruta || (categoria === CAT_COMPRA ? frutas[0] ?? "" : ""),
  }));

  // Escolheu o comprovante: lê o PDF do banco e já preenche valor, data e
  // favorecido — só o que o campo ainda não tem, para não pisar no que foi digitado.
  const lerEPreencher = async (arquivo) => {
    setTextoLido("");
    setLeituraIncompleta(false);
    // PDF com texto é instantâneo; foto e print passam por leitura de imagem (OCR).
    setAvisoAnexo(ehPdfArquivo(arquivo.name, arquivo.type)
      ? ""
      : "Lendo o comprovante… na primeira vez o app baixa o leitor de imagens (cerca de 5 MB) e demora um pouco mais.");
    setLendoAnexo(true);
    const lido = await lerComprovante(arquivo);
    setLendoAnexo(false);
    setForm((f) => ({
      ...f,
      valor: !f.valor && lido.valor ? String(lido.valor) : f.valor,
      data: lido.data && !f.id ? lido.data : f.data,
      descricao: !f.descricao && lido.favorecido && f.categoria !== CAT_COMBUSTIVEL ? lido.favorecido : f.descricao,
    }));
    const achou = [lido.valor && "valor", lido.data && "data", lido.favorecido && "favorecido"].filter(Boolean);
    setTextoLido(lido.texto ?? "");
    setLeituraIncompleta(achou.length < 2);
    setAvisoAnexo(achou.length
      ? `Li o comprovante (${achou.join(", ")}) e preenchi o que encontrei — confira o valor e escolha a categoria.`
      : "Comprovante anexado, mas não consegui ler o valor e a data nele: preencha à mão.");
  };

  const escolherComprovante = (e) => {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setAnexo({ nome: arquivo.name, arquivo, caminho: null });
    trocarPrevia({ url: URL.createObjectURL(arquivo), pdf: ehPdfArquivo(arquivo.name, arquivo.type), local: true });
    lerEPreencher(arquivo);
  };

  // Lançar um comprovante da caixa: abre a despesa já com ele anexado e lido.
  const lancarDaCaixa = async (c) => {
    setAnexo({ nome: c.nome, arquivo: null, caminho: c.caminho });
    setModal(true);
    try {
      const arquivo = await baixarComprovante(c.caminho, c.nome);
      trocarPrevia({ url: URL.createObjectURL(arquivo), pdf: ehPdfArquivo(c.nome, arquivo.type), local: true });
      await lerEPreencher(arquivo);
    } catch {
      setLendoAnexo(false);
      setAvisoAnexo("Comprovante anexado, mas não consegui abri-lo para ler: preencha à mão.");
    }
  };

  // Chegou comprovante novo com o app aberto: o App manda para cá e a tela de
  // lançar já abre, com valor e data lidos do PDF.
  useEffect(() => {
    if (!lancarAgora) return;
    const c = caixaPendente.find((x) => x.caminho === lancarAgora);
    aoLancar();
    if (c) queueMicrotask(() => lancarDaCaixa(c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lancarAgora]);

  const descartarDaCaixa = async (c) => {
    if (!confirm("Descartar este comprovante? Ele some da caixa de entrada.")) return;
    try {
      await descartarComprovante(c.caminho);
      aoMudarCaixa();
    } catch (err) {
      alert(`Não foi possível descartar: ${err.message ?? err}`);
    }
  };

  const abrirComprovante = async (d) => {
    try {
      const url = await urlDoComprovante(d.comprovantePath);
      if (url) setVisor({ url, pdf: ehPdfArquivo(d.comprovantePath), nome: d.comprovanteNome });
    } catch (err) {
      alert(`Não foi possível abrir o comprovante: ${err.message ?? err}`);
    }
  };

  const salvar = async () => {
    if (!podeSalvar || salvando) return;
    const id = form.id ?? novoId();
    let comprovante = {};
    if (anexo?.caminho) {
      comprovante = { comprovantePath: anexo.caminho, comprovanteNome: anexo.nome };
    } else if (anexo) {
      setSalvando(true);
      try {
        const { caminho, nome } = await enviarComprovante(anexo.arquivo, id);
        comprovante = { comprovantePath: caminho, comprovanteNome: nome };
      } catch (err) {
        setSalvando(false);
        alert(`Não foi possível enviar o comprovante: ${err.message ?? err}\n\nA despesa não foi salva.`);
        return;
      }
      setSalvando(false);
    }
    const criadoEm = new Date().toISOString();
    if (destino === "posto") {
      // Quita os abastecimentos marcados. Não cria despesa: o custo deles já
      // está no DRE desde o dia do abastecimento. `!a.pagoEm` impede quitar duas vezes.
      setDados((d) => ({
        ...d,
        abastecimentos: d.abastecimentos.map((a) => (selecionadosPosto.has(a.id) && !a.pagoEm ? { ...a, pagoEm: form.data, ...comprovante } : a)),
      }));
    } else if (destino === "folha") {
      const pessoa = dados.funcionarios.find((f) => f.id === form.funcionarioId);
      const novo = {
        id, data: form.data, funcionarioId: form.funcionarioId, descricao: form.descricao.trim(),
        funcionarioNome: pessoa?.nome ?? "", funcionarioTipo: pessoa?.tipo ?? "",
        valor: valorTotal, extras: 0, horasExtras: 0, criadoEm, ...comprovante,
      };
      setDados((d) => ({ ...d, pagamentos: [...d.pagamentos, novo] }));
    } else if (destino === "compra") {
      const nova = {
        id, data: form.data, fornecedorId: form.fornecedorId, fruta: form.fruta, pesoKg, valorKg: custoKg,
        total: totalGravadoCompra, observacao: form.descricao.trim(), criadoEm, ...comprovante,
      };
      setDados((d) => ({ ...d, compras: [...d.compras, nova] }));
    } else if (form.id) {
      const editada = { ...form, ...comprovante, valor: valorTotal };
      setDados((d) => ({ ...d, despesas: d.despesas.map((x) => (x.id === form.id ? editada : x)) }));
    } else {
      const nova = {
        id, data: form.data, categoria: form.categoria, descricao: form.descricao.trim(),
        valor: valorTotal, criadoEm, ...comprovante,
      };
      setDados((d) => ({ ...d, despesas: [...d.despesas, nova] }));
    }
    fechar();
  };

  const editar = (d) => {
    const despesa = { ...d };
    delete despesa.origem;
    setForm({ ...formDespesaVazio(), ...despesa, descricao: d.descricao ?? "", valor: String(d.valor) });
    setModal(true);
  };

  // Uma despesa antiga numa categoria que saiu da lista continua editável sem
  // perder a categoria.
  // Despesa nova escolhe entre tudo o que um comprovante pode ser; despesa já
  // gravada só troca entre as categorias de despesa.
  const listaCategorias = form.id ? CATEGORIAS_DESPESA : CATEGORIAS_LANCAMENTO;
  const opcoesCategoria = listaCategorias.includes(form.categoria)
    ? listaCategorias
    : [form.categoria, ...listaCategorias];

  const remover = (d) => {
    if (confirm(`Remover a despesa de ${brl(d.valor)} em ${formatarData(d.data)}?`)) {
      setDados((x) => ({ ...x, despesas: x.despesas.filter((y) => y.id !== d.id) }));
    }
  };

  const celula = { padding: "10px 12px", fontSize: 12.5, textAlign: "right", whiteSpace: "nowrap" };

  // Navegador de mês: o atalho para ver as despesas de meses anteriores sem
  // abrir o filtro de período. "Todos" = todo o período.
  const mesCorrente = mesDe(hojeISO());
  const opcoesMes = [...new Set([mesCorrente, ...meses])].sort().reverse();
  const mesSelecionado = filtros.periodo?.startsWith("mes:") ? filtros.periodo.slice(4)
    : filtros.periodo === "mes" ? mesCorrente
      : filtros.periodo === "tudo" ? ""
        : "outro";
  const irParaMes = (m) => setFiltros({ periodo: m ? `mes:${m}` : "tudo" });
  const posMes = opcoesMes.indexOf(mesSelecionado);
  const botaoMes = { padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.cinzaClaro}`, background: COLORS.branco, color: COLORS.cinzaEscuro, cursor: "pointer", fontSize: 14, fontWeight: 700 };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <button type="button" title="Mês anterior" style={{ ...botaoMes, opacity: posMes >= 0 && posMes < opcoesMes.length - 1 ? 1 : 0.4 }}
          disabled={!(posMes >= 0 && posMes < opcoesMes.length - 1)} onClick={() => irParaMes(opcoesMes[posMes + 1])}>◀</button>
        <div style={{ minWidth: 190 }}>
          <Select value={mesSelecionado} onChange={(e) => irParaMes(e.target.value === "outro" ? mesCorrente : e.target.value)} options={[
            { value: "", label: "Todos os meses" },
            ...(mesSelecionado === "outro" ? [{ value: "outro", label: "Outro período (filtro abaixo)" }] : []),
            ...opcoesMes.map((m) => ({ value: m, label: nomeDoMes(m) })),
          ]} />
        </div>
        <button type="button" title="Próximo mês" style={{ ...botaoMes, opacity: posMes > 0 ? 1 : 0.4 }}
          disabled={!(posMes > 0)} onClick={() => irParaMes(opcoesMes[posMes - 1])}>▶</button>
      </div>

      <BarraFiltros
        dados={dados} filtros={filtros} setFiltros={setFiltros} limpar={limpar} intervalo={intervalo}
        campos={["agrupar", "categoria"]} meses={meses} categorias={categorias}
      />

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: COLORS.cinzaEscuro, cursor: "pointer" }}>
        <input type="checkbox" checked={incluirOutros} onChange={alternarOutros} />
        Incluir combustível e folha (diaristas e funcionários) — o total fica igual às despesas do DRE
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
        <Indicador rotulo="Total no período" valor={brl(total)} sub={`${filtradas.length} lançamentos`}
          pct={totalAnt != null ? variacao(total, totalAnt) : undefined} inverter cor={COLORS.laranjaEscuro} />
        <Indicador rotulo="Média por dia" valor={brl(total / dias)} sub={`${dias} dia(s) · ${brl((total / dias) * 30)} / 30 dias`} />
        <Indicador rotulo="Maior categoria" valor={porCategoria[0]?.nome ?? "—"}
          sub={porCategoria[0] ? `${brl(porCategoria[0].total)} · ${pct(total > 0 ? (porCategoria[0].total / total) * 100 : 0)}` : ""} />
        <Indicador rotulo="Maior lançamento" valor={maiorLancamento ? brl(maiorLancamento.valor) : "—"}
          sub={maiorLancamento ? `${formatarData(maiorLancamento.data)} · ${maiorLancamento.categoria}` : ""} />
      </div>

      {filtradas.length > 0 && (
        <Card>
          <h4 style={{ margin: "0 0 4px", color: COLORS.cinzaEscuro, fontSize: 15 }}>Saídas</h4>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: COLORS.cinza }}>
            {AGRUPAMENTOS.find((a) => a.value === filtros.agrupar)?.label} · {descricaoRecorte}
          </p>
          <GraficoColunas pontos={pontos} series={[{ chave: "total", rotulo: "Despesas", cor: CORES_SERIE.despesas }]} />
        </Card>
      )}

      <Ranking
        titulo="Por categoria"
        subtitulo={descricaoRecorte}
        linhas={porCategoria}
        colunas={colunasCategoria}
        acoes={<BotoesExportar aoExportarXlsx={() => exportar("xlsx")} aoExportarPdf={() => exportar("pdf")} />}
      />

      {porCategoria.length > 0 && grupos.length > 0 && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 20px 10px" }}>
            <h4 style={{ margin: 0, color: COLORS.cinzaEscuro, fontSize: 15 }}>Categoria × período</h4>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, color: COLORS.cinza }}>
              {grupos.length > 14
                ? `${grupos.length} colunas — role de lado, ou troque "Ver" para semana ou mês.`
                : "Quanto cada categoria gastou em cada período."}
            </p>
          </div>
          <TabelaRolavel>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 200 + grupos.length * 100 }}>
              <thead style={{ background: COLORS.cinzaClaro }}>
                <tr>
                  <th style={{ textAlign: "left", fontSize: 11, color: COLORS.cinza, padding: "10px 12px", textTransform: "uppercase" }}>Categoria</th>
                  {grupos.map((g) => (
                    <th key={g} style={{ textAlign: "right", fontSize: 11, color: COLORS.cinza, padding: "10px 12px", whiteSpace: "nowrap" }}>{rotuloGrupo(g, filtros.agrupar)}</th>
                  ))}
                  <th style={{ textAlign: "right", fontSize: 11, color: COLORS.cinzaEscuro, padding: "10px 12px", textTransform: "uppercase" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {porCategoria.map((c) => (
                  <tr key={c.nome} style={{ borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
                    <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, color: COLORS.cinzaEscuro, whiteSpace: "nowrap" }}>{c.nome}</td>
                    {grupos.map((g) => {
                      const v = cruzada.get(`${c.nome}|${g}`) ?? 0;
                      return <td key={g} style={{ ...celula, color: v ? COLORS.cinzaEscuro : COLORS.cinza }}>{v ? brl(v) : "—"}</td>;
                    })}
                    <td style={{ ...celula, fontWeight: 700, color: COLORS.laranjaEscuro }}>{brl(c.total)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: `2px solid ${COLORS.cinzaEscuro}22`, background: COLORS.creme }}>
                  <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 800, color: COLORS.cinzaEscuro }}>Total</td>
                  {grupos.map((g) => <td key={g} style={{ ...celula, fontWeight: 700, color: COLORS.cinzaEscuro }}>{totalDoGrupo(g) ? brl(totalDoGrupo(g)) : "—"}</td>)}
                  <td style={{ ...celula, fontWeight: 800, color: COLORS.laranjaEscuro }}>{brl(total)}</td>
                </tr>
              </tbody>
            </table>
          </TabelaRolavel>
        </Card>
      )}

      {caixaPendente.length > 0 && (
        <Card>
          <h4 style={{ margin: "0 0 4px", color: COLORS.cinzaEscuro, fontSize: 15 }}>
            Comprovantes recebidos ({caixaPendente.length})
          </h4>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: COLORS.cinza }}>
            Chegaram pelo Atalho do iPhone. Toque em Lançar, confira o valor e escolha a categoria.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {caixaPendente.map((c) => (
              <div key={c.caminho} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 0", borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
                <span style={{ flex: "1 1 160px", fontSize: 13.5, color: COLORS.cinzaEscuro }}>
                  {/\.pdf$/i.test(c.nome) ? "📄 PDF" : "🖼️ Foto"} · {c.criadoEm ? new Date(c.criadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : c.nome}
                </span>
                <Btn variant="secondary" onClick={() => abrirComprovante({ comprovantePath: c.caminho })}>Ver</Btn>
                <Btn onClick={() => lancarDaCaixa(c)}>Lançar</Btn>
                <button onClick={() => descartarDaCaixa(c)} title="Descartar comprovante"
                  style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.5, padding: 2 }}>
                  <Icon name="trash" color={COLORS.vermelho} size={15} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="cc-filtros" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ flex: "1 1 240px", maxWidth: 360 }}>
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar na descrição…" />
        </div>
        <Btn icon="plus" onClick={() => setModal(true)}>Nova Despesa</Btn>
      </div>

      {chipsCategoria.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: COLORS.cinza, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginRight: 4 }}>Filtrar por categoria:</span>
          {[["", { total: totalTodas, qtd: qtdTodas }], ...chipsCategoria].map(([c, t]) => {
            const ativo = (filtros.categoria || "") === c;
            return (
              <button key={c || "__todas"} onClick={() => (c ? escolherCategoria(c) : setFiltros({ categoria: "" }))}
                title={c ? `Ver só ${c}` : "Ver todas as categorias"}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, cursor: "pointer",
                  fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
                  border: `1px solid ${ativo ? COLORS.verde : COLORS.cinzaClaro}`,
                  background: ativo ? COLORS.verde : COLORS.branco,
                  color: ativo ? COLORS.branco : COLORS.cinzaEscuro,
                }}>
                {c || "Todas"}
                <span style={{ fontWeight: 700, color: ativo ? COLORS.branco : COLORS.laranjaEscuro }}>{brl(t.total)}</span>
                <span style={{ fontSize: 11, opacity: 0.75 }}>({t.qtd})</span>
              </button>
            );
          })}
        </div>
      )}

      <Card style={{ padding: 0, overflow: "auto" }}>
        <TabelaRolavel>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead style={{ background: COLORS.cinzaClaro }}>
              <tr>
                {["Data", "Categoria", "Descrição", "Valor", "Comprovante", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", fontSize: 12, color: COLORS.cinza, padding: "12px 14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((d) => (
                <tr key={d.id} style={{ borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
                  <td style={{ padding: "12px 14px", color: COLORS.cinza, fontSize: 13, whiteSpace: "nowrap" }}>{formatarData(d.data)}</td>
                  <td style={{ padding: "12px 14px", color: COLORS.cinzaEscuro, fontSize: 13, whiteSpace: "nowrap" }}>{d.categoria}</td>
                  <td style={{ padding: "12px 14px", color: COLORS.cinza, fontSize: 13 }}>{d.descricao}</td>
                  <td style={{ padding: "12px 14px", fontWeight: 700, color: COLORS.laranjaEscuro, whiteSpace: "nowrap" }}>{brl(d.valor)}</td>
                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap", fontSize: 12.5 }}>
                    {d.comprovantePath ? (
                      <button onClick={() => abrirComprovante(d)} title={d.comprovanteNome || "Abrir comprovante"}
                        style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.verde, fontWeight: 600, padding: 0, textDecoration: "underline" }}>
                        Ver
                      </button>
                    ) : <span style={{ color: COLORS.cinza }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                    {d.origem !== "despesa" ? (
                      <span style={{ fontSize: 11.5, color: COLORS.cinza }}>{d.origem === "combustivel" ? "aba Combustível" : "aba Folha"}</span>
                    ) : (
                      <>
                        <button onClick={() => editar(d)} title="Editar despesa"
                          style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.4, padding: 2, marginRight: 6 }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}>
                          <Icon name="edit" color={COLORS.verde} size={15} />
                        </button>
                        <button onClick={() => remover(d)} title="Remover despesa"
                          style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.4, padding: 2 }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}>
                          <Icon name="trash" color={COLORS.vermelho} size={15} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabelaRolavel>
        {filtradas.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.cinza }}>
            Nenhuma despesa em {descricaoRecorte}{termo ? ` com "${busca}"` : ""}.
          </div>
        )}
      </Card>

      {visor && <VisorComprovante url={visor.url} pdf={visor.pdf} nome={visor.nome} aoFechar={() => setVisor(null)} />}

      {modal && (
        <Modal title={form.id ? "Editar Despesa" : anexo ? "Lançar comprovante" : "Nova Despesa"} onClose={fechar}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Data *" type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
              <Input label={destino === "despesa" ? "Valor (R$) *" : "Valor total pago (R$) *"} type="number" min="0" step="0.01" value={form.valor} onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))} />
            </div>
            {supabaseConfigurado && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: COLORS.cinzaEscuro }}>Comprovante de pagamento</label>
                <label style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 14px", borderRadius: 8, cursor: "pointer",
                  border: `1.5px dashed ${anexo || form.comprovantePath ? COLORS.verde : COLORS.cinzaClaro}`, color: COLORS.cinzaEscuro, fontSize: 14, fontWeight: 600,
                }}>
                  <input type="file" accept={TIPOS_COMPROVANTE} onChange={escolherComprovante} style={{ display: "none" }} />
                  {lendoAnexo ? "Lendo o comprovante…"
                    : anexo ? `📎 ${anexo.nome} — trocar`
                    : form.comprovantePath ? `📎 ${form.comprovanteNome || "comprovante"} — trocar`
                    : "📎 Anexar PDF ou foto do comprovante"}
                </label>
                {avisoAnexo && <span style={{ fontSize: 12.5, color: COLORS.cinza }}>{avisoAnexo}</span>}
                {leituraIncompleta && textoLido.trim() && (
                  <details style={{ fontSize: 12, color: COLORS.cinza }}>
                    <summary style={{ cursor: "pointer" }}>Ver o texto que o app leu no comprovante</summary>
                    <pre style={{ whiteSpace: "pre-wrap", margin: "6px 0 0", maxHeight: 160, overflow: "auto", background: COLORS.creme, borderRadius: 6, padding: 8 }}>{textoLido.trim()}</pre>
                  </details>
                )}
              </div>
            )}
            {(previa || form.comprovantePath) && (
              <button type="button" onClick={() => (previa ? setVisor({ url: previa.url, pdf: previa.pdf, nome: anexo?.nome }) : abrirComprovante(form))}
                title="Ver o comprovante em tela cheia"
                style={{ display: "flex", alignItems: "center", gap: 12, padding: 8, borderRadius: 10, cursor: "pointer", textAlign: "left",
                  border: `1.5px solid ${COLORS.cinzaClaro}`, background: COLORS.creme, color: COLORS.cinzaEscuro }}>
                {previa && !previa.pdf
                  ? <img src={previa.url} alt="Comprovante" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                  : <span style={{ fontSize: 34, width: 64, textAlign: "center", flexShrink: 0 }}>📄</span>}
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>Ver o comprovante<br />
                  <span style={{ fontWeight: 400, color: COLORS.cinza, fontSize: 12.5 }}>toque para abrir em tela cheia e conferir</span>
                </span>
              </button>
            )}
            <Select label="Categoria *" value={form.categoria} onChange={(e) => mudarCategoriaDoForm(e.target.value)}
              options={opcoesCategoria.map((v) => ({ value: v, label: v }))} />

            {destino === "posto" && (
              <>
                <div style={{ fontSize: 12.5, color: COLORS.cinza, lineHeight: 1.5 }}>
                  O diesel já entra no custo quando o abastecimento é lançado em <strong>Combustível</strong>.
                  Aqui você só marca <strong>quais abastecimentos este pagamento quita</strong> — nada novo é somado às despesas.
                </div>
                {abertosPosto.length === 0 ? (
                  <div style={{ fontSize: 13, color: COLORS.laranjaEscuro, background: "#FFF3E0", borderRadius: 6, padding: "9px 12px" }}>
                    Nenhum abastecimento em aberto. Lance os abastecimentos na aba Combustível antes de registrar o pagamento do posto
                    (ou este comprovante já foi usado).
                  </div>
                ) : (
                  <>
                    <div style={{ maxHeight: 230, overflowY: "auto", border: `1px solid ${COLORS.cinzaClaro}`, borderRadius: 8 }}>
                      {visiveisPosto.length === 0 && (
                        <div style={{ padding: 12, fontSize: 13, color: COLORS.cinza }}>Nenhum abastecimento em aberto nos últimos 60 dias.</div>
                      )}
                      {visiveisPosto.map((a) => (
                        <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", cursor: "pointer", borderTop: `1px solid ${COLORS.cinzaClaro}`, fontSize: 13, color: COLORS.cinzaEscuro }}>
                          <input type="checkbox" checked={selecionadosPosto.has(a.id)} onChange={() => alternarAbastecimento(a.id)} />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            {formatarData(a.data)} · {nomeDoVeiculo(a.veiculoId) || "—"}
                            <span style={{ color: COLORS.cinza }}> · {String(a.litros).replace(".", ",")} L {a.tipoCombustivel}</span>
                          </span>
                          <strong style={{ whiteSpace: "nowrap" }}>{brl(a.valor)}</strong>
                        </label>
                      ))}
                    </div>
                    {!form.verAntigos && abertosPosto.length > visiveisPosto.length && (
                      <button type="button" onClick={() => setForm((f) => ({ ...f, verAntigos: true }))}
                        style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.verde, fontWeight: 600, fontSize: 12.5, textAlign: "left", padding: 0, textDecoration: "underline" }}>
                        Mostrar {abertosPosto.length - visiveisPosto.length} abastecimento(s) mais antigo(s) em aberto
                      </button>
                    )}
                    {valorTotal > 0 && (
                      <div style={{
                        fontSize: 13, borderRadius: 6, padding: "9px 12px",
                        color: Math.abs(difPosto) <= 0.05 && selecionadosPosto.size ? COLORS.verde : COLORS.laranjaEscuro,
                        background: Math.abs(difPosto) <= 0.05 && selecionadosPosto.size ? COLORS.verdePale : "#FFF3E0",
                      }}>
                        {selecionadosPosto.size} abastecimento(s) = <strong>{brl(somaPosto)}</strong> · pago <strong>{brl(valorTotal)}</strong>
                        {Math.abs(difPosto) <= 0.05 && selecionadosPosto.size
                          ? " — fecha certinho."
                          : selecionadosPosto.size
                            ? ` — ${difPosto > 0 ? "faltam" : "sobram"} ${brl(Math.abs(difPosto))}. Marque ou desmarque até fechar (se o preço no posto foi outro, corrija o abastecimento em Combustível).`
                            : " — nenhuma sequência de abastecimentos fecha esse valor; marque os da quinzena à mão."}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {destino === "folha" && (
              <Select label="Funcionário ou diarista *" value={form.funcionarioId} onChange={(e) => setForm((f) => ({ ...f, funcionarioId: e.target.value }))}
                options={[{ value: "", label: "Selecione..." },
                  ...funcionariosAtivos.map((f) => ({ value: f.id, label: `${f.nome} · ${f.tipo}` }))]} />
            )}

            {destino === "compra" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Select label="Fruta *" value={form.fruta} onChange={(e) => setForm((f) => ({ ...f, fruta: e.target.value }))}
                    options={frutas.map((v) => ({ value: v, label: v }))} />
                  <Select label="Fornecedor" value={form.fornecedorId} onChange={(e) => setForm((f) => ({ ...f, fornecedorId: e.target.value }))}
                    options={[{ value: "", label: "Selecione..." },
                      ...dados.fornecedores.filter((f) => f.status === "ativo").map((f) => ({ value: f.id, label: f.nome }))]} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <Input label="Peso (kg) *" type="number" min="0" step="0.001" value={form.pesoKg} onChange={(e) => setForm((f) => ({ ...f, pesoKg: e.target.value }))} />
                  <Input label="Custo por kg (R$) *" type="number" min="0" step="0.0001"
                    value={form.valorKgManual ? form.valorKg : (custoKgSugerido || "")}
                    onChange={(e) => setForm((f) => ({ ...f, valorKg: e.target.value, valorKgManual: true }))} />
                </div>
                {pesoKg > 0 && custoKg > 0 && (
                  <div style={{ fontSize: 13, color: difCompra > 0.05 ? COLORS.laranjaEscuro : COLORS.verde, background: difCompra > 0.05 ? "#FFF3E0" : COLORS.verdePale, borderRadius: 6, padding: "9px 12px" }}>
                    {kg(pesoKg)} × {brl(custoKg)} = <strong>{brl(totalGravadoCompra)}</strong>
                    {difCompra > 0.05 && ` — difere em ${brl(difCompra)} do valor pago (${brl(valorTotal)}); ajuste o custo por kg se quiser fechar o centavo.`}
                  </div>
                )}
              </>
            )}
            {destino !== "posto" && <Input label={exigeDescricao ? "Descrição * (do que é este pagamento?)" : destino === "compra" ? "Observação" : "Descrição"} value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Frete do carro, manutenção, almoço…" />}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn variant="secondary" onClick={fechar}>Cancelar</Btn>
              <Btn onClick={salvar} style={{ opacity: podeSalvar && !salvando && !lendoAnexo ? 1 : 0.5 }}>{salvando ? "Enviando…" : form.id ? "Salvar Alterações" : destino === "despesa" ? "Registrar Despesa" : `Registrar ${form.categoria === CAT_FOLHA ? "pagamento" : form.categoria === CAT_COMPRA ? "compra" : "pagamento do posto"}`}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── Combustível ─────────────────────────────────────────────────────────────
//
// A aba DESPESAS → COMBUSTIVEIS da planilha: motorista, veículo, km e tipo de
// combustível, litros e preço do litro — de onde saem km/l e custo por km.
// Entra no DRE como despesa (dreDoRecorte, em src/lib/analise.js), num lançamento à parte de "Despesas"
// porque carrega quilometragem, não só valor — juntar os dois obrigaria a
// digitar km numa tela pensada para "categoria + descrição + valor".

const Combustivel = ({ dados, setDados, podeGerir }) => {
  const [modalVeiculo, setModalVeiculo] = useState(false);
  const [modalAbastecimento, setModalAbastecimento] = useState(false);
  const [formVeiculo, setFormVeiculo] = useState({ nome: "", placa: "", modelo: "" });
  const [formAbastecimento, setFormAbastecimento] = useState({
    data: hojeISO(), veiculoId: "", motorista: "", tipoCombustivel: TIPOS_COMBUSTIVEL[0],
    kmAtual: "", litros: "", precoLitro: "",
  });
  const [filtroVeiculo, setFiltroVeiculo] = useState("Todos");
  // "" = todos os meses; "YYYY-MM" = só aquele mês (os cards acompanham).
  const [filtroMes, setFiltroMes] = useState("");

  const veiculosAtivos = dados.veiculos.filter((v) => v.status === "ativo");
  const nomeVeiculo = (id) => dados.veiculos.find((v) => v.id === id)?.nome ?? "—";
  // Mesma lista do Romaneio: funcionários ativos com a função Motorista na
  // Folha de Pagamento. O abastecimento guarda o NOME (a planilha antiga já
  // trazia texto), então um nome que não está mais na lista continua aparecendo.
  const motoristas = dados.funcionarios.filter((f) => f.status === "ativo" && f.funcao === "Motorista");
  const opcoesMotorista = [
    { value: "", label: motoristas.length ? "Selecione..." : "Nenhum motorista cadastrado" },
    ...motoristas.map((f) => ({ value: f.nome, label: f.nome })),
    ...(formAbastecimento.motorista && !motoristas.some((f) => f.nome === formAbastecimento.motorista)
      ? [{ value: formAbastecimento.motorista, label: formAbastecimento.motorista }]
      : []),
  ];

  const comKm = useMemo(() => abastecimentosComKm(dados.abastecimentos), [dados.abastecimentos]);
  const ordenados = [...comKm].sort(ordenarPorCriacao);
  const mesesAbastecimento = useMemo(
    () => [...new Set(dados.abastecimentos.filter((a) => a.data).map((a) => mesDe(a.data)))].sort().reverse(),
    [dados.abastecimentos],
  );
  const filtrados = ordenados
    .filter((a) => filtroVeiculo === "Todos" || a.veiculoId === filtroVeiculo)
    .filter((a) => !filtroMes || mesDe(a.data) === filtroMes);
  // Os cards seguem o mês escolhido; o km rodado de cada abastecimento continua
  // vindo da lista completa (precisa do abastecimento anterior).
  const doMes = filtroMes ? dados.abastecimentos.filter((a) => mesDe(a.data) === filtroMes) : dados.abastecimentos;

  const totalGasto = doMes.reduce((s, a) => s + a.valor, 0);
  const totalLitros = doMes.reduce((s, a) => s + a.litros, 0);
  // O que ainda se deve ao posto: abastecimentos lançados e não quitados.
  const emAbertoPosto = dados.abastecimentos.filter((a) => !a.pagoEm);
  const totalEmAberto = emAbertoPosto.reduce((s, a) => s + a.valor, 0);

  // Km/l e custo/km médios só entram com quilometragem válida — o primeiro
  // abastecimento de cada veículo (sem "anterior") não pesa na conta.
  const comKmValido = comKm.filter((a) => a.kmRodado > 0 && (!filtroMes || mesDe(a.data) === filtroMes));
  const kmRodadoTotal = comKmValido.reduce((s, a) => s + a.kmRodado, 0);
  const litrosComKm = comKmValido.reduce((s, a) => s + a.litros, 0);
  const valorComKm = comKmValido.reduce((s, a) => s + a.valor, 0);
  const kmPorLitroMedio = litrosComKm > 0 ? kmRodadoTotal / litrosComKm : 0;
  const custoPorKmMedio = kmRodadoTotal > 0 ? valorComKm / kmRodadoTotal : 0;

  const mesAtual = mesDe(hojeISO());
  const totalMes = dados.abastecimentos
    .filter((a) => mesDe(a.data) === mesAtual)
    .reduce((s, a) => s + a.valor, 0);

  const totalPreviaAbastecimento = (Number(formAbastecimento.litros) || 0) * (Number(formAbastecimento.precoLitro) || 0);
  const podeSalvarAbastecimento =
    formAbastecimento.veiculoId && formAbastecimento.data &&
    Number(formAbastecimento.litros) > 0 && Number(formAbastecimento.precoLitro) >= 0 &&
    formAbastecimento.kmAtual !== "" && Number(formAbastecimento.kmAtual) >= 0;

  const fecharAbastecimento = () => {
    setModalAbastecimento(false);
    setFormAbastecimento({ data: hojeISO(), veiculoId: "", motorista: "", tipoCombustivel: TIPOS_COMBUSTIVEL[0], kmAtual: "", litros: "", precoLitro: "" });
  };

  const abrirAbastecimento = () => {
    setFormAbastecimento({
      data: hojeISO(), veiculoId: veiculosAtivos[0]?.id ?? "", motorista: motoristas.length === 1 ? motoristas[0].nome : "",
      tipoCombustivel: TIPOS_COMBUSTIVEL[0], kmAtual: "", litros: "", precoLitro: "",
    });
    setModalAbastecimento(true);
  };

  const salvarAbastecimento = () => {
    if (!podeSalvarAbastecimento) return;
    const litros = Number(formAbastecimento.litros);
    const precoLitro = Number(formAbastecimento.precoLitro);
    const campos = {
      data: formAbastecimento.data,
      veiculoId: formAbastecimento.veiculoId,
      motorista: formAbastecimento.motorista,
      tipoCombustivel: formAbastecimento.tipoCombustivel,
      kmAtual: Number(formAbastecimento.kmAtual),
      litros,
      precoLitro,
      valor: litros * precoLitro,
    };
    if (formAbastecimento.id) {
      // Edição mantém id e criadoEm — criadoEm desempata a ordem dos
      // abastecimentos do mesmo dia no cálculo do km rodado.
      setDados((d) => ({
        ...d,
        abastecimentos: d.abastecimentos.map((x) => (x.id === formAbastecimento.id ? { ...x, ...campos } : x)),
      }));
    } else {
      const novo = { ...campos, id: novoId(), criadoEm: new Date().toISOString() };
      setDados((d) => ({ ...d, abastecimentos: [...d.abastecimentos, novo] }));
    }
    fecharAbastecimento();
  };

  const editarAbastecimento = (a) => {
    setFormAbastecimento({
      id: a.id, data: a.data, veiculoId: a.veiculoId ?? "", motorista: a.motorista ?? "",
      tipoCombustivel: a.tipoCombustivel || TIPOS_COMBUSTIVEL[0],
      kmAtual: String(a.kmAtual ?? ""), litros: String(a.litros ?? ""), precoLitro: String(a.precoLitro ?? ""),
    });
    setModalAbastecimento(true);
  };

  // O comprovante do posto é um só para a quinzena inteira: desfazer reabre todos
  // os abastecimentos que ele quitou, e o comprovante volta para a caixa de entrada.
  const desfazerPagamentoPosto = (a) => {
    const grupo = dados.abastecimentos.filter((x) => (a.comprovantePath ? x.comprovantePath === a.comprovantePath : x.id === a.id));
    const soma = grupo.reduce((s, x) => s + x.valor, 0);
    if (!confirm(`Desfazer o pagamento do posto? ${grupo.length} abastecimento(s), ${brl(soma)}, voltam para "em aberto".`)) return;
    const ids = new Set(grupo.map((x) => x.id));
    setDados((d) => ({
      ...d,
      abastecimentos: d.abastecimentos.map((x) => (ids.has(x.id) ? { ...x, pagoEm: "", comprovantePath: "", comprovanteNome: "" } : x)),
    }));
  };

  const removerAbastecimento = (a) => {
    if (confirm(`Remover o abastecimento de ${nomeVeiculo(a.veiculoId)} em ${formatarData(a.data)}?`)) {
      setDados((d) => ({ ...d, abastecimentos: d.abastecimentos.filter((x) => x.id !== a.id) }));
    }
  };

  const salvarVeiculo = () => {
    if (!formVeiculo.nome.trim()) return;
    const novo = { ...formVeiculo, id: novoId(), status: "ativo", criadoEm: new Date().toISOString() };
    setDados((d) => ({ ...d, veiculos: [...d.veiculos, novo] }));
    setModalVeiculo(false);
    setFormVeiculo({ nome: "", placa: "", modelo: "" });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <StatCard icon="combustivel" label={filtroMes ? `Gasto em ${nomeDoMes(filtroMes)}` : "Gasto Total"} value={brl(totalGasto)} sub={`${doMes.length} abastecimento(s)`} color={COLORS.laranjaEscuro} />
        <StatCard icon="vendas" label={`Em ${nomeDoMes(mesAtual)}`} value={brl(totalMes)} sub="mês corrente" color={COLORS.laranja} />
        <StatCard icon="financeiro" label="A pagar ao posto" value={brl(totalEmAberto)} sub={`${emAbertoPosto.length} abastecimento(s) em aberto`} color={COLORS.vermelho} />
        <StatCard icon="estoque" label="Litros Abastecidos" value={totalLitros.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} sub={filtroMes ? nomeDoMes(filtroMes) : "no período"} color={COLORS.azul} />
        <StatCard icon="financeiro" label="Km / Litro"
          value={kmPorLitroMedio > 0 ? kmPorLitroMedio.toFixed(2).replace(".", ",") : "—"}
          sub={custoPorKmMedio > 0 ? `${brl(custoPorKmMedio)} / km` : "sem km suficiente"} color={COLORS.verde} />
      </div>

      {/* Veículos da frota */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 22px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: COLORS.cinzaEscuro }}>Veículos</h3>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: COLORS.cinza }}>
              A frota que abastece — cadastre para poder lançar o abastecimento.
            </p>
          </div>
          {podeGerir && <Btn icon="plus" variant="ghost" onClick={() => setModalVeiculo(true)}>Novo Veículo</Btn>}
        </div>
        {dados.veiculos.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, padding: "0 22px 20px" }}>
            {dados.veiculos.map((v) => (
              <div key={v.id} style={{ border: `1px solid ${COLORS.cinzaClaro}`, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ fontWeight: 700, color: COLORS.cinzaEscuro, fontSize: 14 }}>{v.nome}</div>
                  <Badge status={v.status} />
                </div>
                <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: 4 }}>
                  {v.placa || "sem placa"}{v.modelo ? ` · ${v.modelo}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Abastecimentos */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {["Todos", ...dados.veiculos.map((v) => v.id)].map((id) => (
            <button key={id} onClick={() => setFiltroVeiculo(id)}
              style={{ padding: "6px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontWeight: filtroVeiculo === id ? 700 : 400, background: filtroVeiculo === id ? COLORS.verde : COLORS.cinzaClaro, color: filtroVeiculo === id ? COLORS.branco : COLORS.cinzaEscuro, fontSize: 12.5, transition: "all 0.15s" }}>
              {id === "Todos" ? "Todos" : nomeVeiculo(id)}
            </button>
          ))}
        </div>
        <Select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)} options={[
          { value: "", label: "Todos os meses" },
          ...mesesAbastecimento.map((m) => ({ value: m, label: nomeDoMes(m) })),
        ]} />
        {podeGerir && (
          <Btn icon="plus" onClick={abrirAbastecimento} disabled={veiculosAtivos.length === 0}>
            Registrar Abastecimento
          </Btn>
        )}
      </div>

      {podeGerir && veiculosAtivos.length === 0 && (
        <div style={{ fontSize: 12.5, color: COLORS.cinza }}>
          Cadastre um veículo ativo para poder registrar abastecimento.
        </div>
      )}

      <Card style={{ padding: 0, overflow: "auto" }}>
        <TabelaRolavel>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
            <thead style={{ background: COLORS.cinzaClaro }}>
              <tr>
                {["Data", "Veículo", "Motorista", "Combustível", "Km atual", "Km rodado", "Litros", "R$ / L", "Valor", "Km / L", "$ / km", "Posto", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", fontSize: 11.5, color: COLORS.cinza, padding: "10px 14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((a) => (
                <tr key={a.id} style={{ borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
                  <td style={{ padding: "11px 14px", color: COLORS.cinza, fontSize: 13, whiteSpace: "nowrap" }}>{formatarData(a.data)}</td>
                  <td style={{ padding: "11px 14px", color: COLORS.cinzaEscuro, fontSize: 13, whiteSpace: "nowrap" }}>{nomeVeiculo(a.veiculoId)}</td>
                  <td style={{ padding: "11px 14px", color: COLORS.cinza, fontSize: 13, whiteSpace: "nowrap" }}>{a.motorista || "—"}</td>
                  <td style={{ padding: "11px 14px", color: COLORS.cinza, fontSize: 13, whiteSpace: "nowrap" }}>{a.tipoCombustivel}</td>
                  <td style={{ padding: "11px 14px", color: COLORS.cinza, fontSize: 13, whiteSpace: "nowrap" }}>{a.kmAtual.toLocaleString("pt-BR")} km</td>
                  <td style={{ padding: "11px 14px", color: COLORS.cinza, fontSize: 13, whiteSpace: "nowrap" }}>{a.kmRodado ? `${a.kmRodado.toLocaleString("pt-BR")} km` : "—"}</td>
                  <td style={{ padding: "11px 14px", color: COLORS.cinzaEscuro, fontSize: 13, whiteSpace: "nowrap" }}>{a.litros.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L</td>
                  <td style={{ padding: "11px 14px", color: COLORS.cinza, fontSize: 13, whiteSpace: "nowrap" }}>{brl(a.precoLitro)}</td>
                  <td style={{ padding: "11px 14px", fontWeight: 700, color: COLORS.laranjaEscuro, whiteSpace: "nowrap" }}>{brl(a.valor)}</td>
                  <td style={{ padding: "11px 14px", color: COLORS.verde, fontSize: 13, whiteSpace: "nowrap" }}>{a.kmPorLitro ? a.kmPorLitro.toFixed(2).replace(".", ",") : "—"}</td>
                  <td style={{ padding: "11px 14px", color: COLORS.cinza, fontSize: 13, whiteSpace: "nowrap" }}>{a.custoPorKm ? brl(a.custoPorKm) : "—"}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12.5, whiteSpace: "nowrap" }}>
                    {a.pagoEm ? (
                      <span style={{ color: COLORS.verde }}>
                        pago {formatarData(a.pagoEm)}{" "}
                        <LinkComprovante caminho={a.comprovantePath} nome={a.comprovanteNome} />{" "}
                        <button onClick={() => desfazerPagamentoPosto(a)} title="Desfazer o pagamento do posto"
                          style={{ background: "none", border: "none", cursor: "pointer", color: COLORS.cinza, textDecoration: "underline", fontSize: 11.5, padding: 0 }}>
                          desfazer
                        </button>
                      </span>
                    ) : <span style={{ color: COLORS.laranjaEscuro, fontWeight: 600 }}>em aberto</span>}
                  </td>
                  <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                    <button onClick={() => editarAbastecimento(a)} title="Editar abastecimento"
                      style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.4, padding: 2, marginRight: 4 }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}>
                      <Icon name="edit" color={COLORS.verde} size={15} />
                    </button>
                    <button onClick={() => removerAbastecimento(a)} title="Remover abastecimento"
                      style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.4, padding: 2 }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}>
                      <Icon name="trash" color={COLORS.vermelho} size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabelaRolavel>
        {filtrados.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.cinza }}>
            Nenhum abastecimento registrado{filtroVeiculo !== "Todos" ? ` para ${nomeVeiculo(filtroVeiculo)}` : ""}{filtroMes ? ` em ${nomeDoMes(filtroMes)}` : ""}.
          </div>
        )}
      </Card>

      {modalVeiculo && (
        <Modal title="Novo Veículo" onClose={() => setModalVeiculo(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Input label="Nome / Apelido *" value={formVeiculo.nome} onChange={(e) => setFormVeiculo((f) => ({ ...f, nome: e.target.value }))} placeholder="Sprinter, Strada, HR…" />
            <Input label="Placa" value={formVeiculo.placa} onChange={(e) => setFormVeiculo((f) => ({ ...f, placa: e.target.value }))} />
            <Input label="Modelo" value={formVeiculo.modelo} onChange={(e) => setFormVeiculo((f) => ({ ...f, modelo: e.target.value }))} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn variant="secondary" onClick={() => setModalVeiculo(false)}>Cancelar</Btn>
              <Btn onClick={salvarVeiculo}>Salvar Veículo</Btn>
            </div>
          </div>
        </Modal>
      )}

      {modalAbastecimento && (
        <Modal title={formAbastecimento.id ? "Editar Abastecimento" : "Registrar Abastecimento"} onClose={fecharAbastecimento}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Data *" type="date" value={formAbastecimento.data} onChange={(e) => setFormAbastecimento((f) => ({ ...f, data: e.target.value }))} />
              <Select label="Veículo *" value={formAbastecimento.veiculoId} onChange={(e) => setFormAbastecimento((f) => ({ ...f, veiculoId: e.target.value }))}
                options={[{ value: "", label: "Selecione..." }, ...dados.veiculos
                  .filter((v) => v.status === "ativo" || v.id === formAbastecimento.veiculoId)
                  .map((v) => ({ value: v.id, label: v.nome }))]} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Select label="Motorista" value={formAbastecimento.motorista} onChange={(e) => setFormAbastecimento((f) => ({ ...f, motorista: e.target.value }))}
                options={opcoesMotorista} />
              <Select label="Combustível *" value={formAbastecimento.tipoCombustivel} onChange={(e) => setFormAbastecimento((f) => ({ ...f, tipoCombustivel: e.target.value }))}
                options={TIPOS_COMBUSTIVEL.map((v) => ({ value: v, label: v }))} />
            </div>

            <Input label="Km atual (odômetro) *" type="number" min="0" step="1" value={formAbastecimento.kmAtual} onChange={(e) => setFormAbastecimento((f) => ({ ...f, kmAtual: e.target.value }))} />
            <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: -8 }}>
              O km rodado sai sozinho, da diferença para o abastecimento anterior deste veículo.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Litros *" type="number" min="0" step="0.01" value={formAbastecimento.litros} onChange={(e) => setFormAbastecimento((f) => ({ ...f, litros: e.target.value }))} />
              <Input label="R$ / litro *" type="number" min="0" step="0.001" value={formAbastecimento.precoLitro} onChange={(e) => setFormAbastecimento((f) => ({ ...f, precoLitro: e.target.value }))} />
            </div>

            {totalPreviaAbastecimento > 0 && (
              <div style={{ fontSize: 13, color: COLORS.laranjaEscuro, background: "#FFF3CD", borderRadius: 6, padding: "9px 12px" }}>
                {Number(formAbastecimento.litros).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L × {brl(Number(formAbastecimento.precoLitro))} = <strong>{brl(totalPreviaAbastecimento)}</strong>
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn variant="secondary" onClick={fecharAbastecimento}>Cancelar</Btn>
              <Btn onClick={salvarAbastecimento} style={{ opacity: podeSalvarAbastecimento ? 1 : 0.5 }}>{formAbastecimento.id ? "Salvar Alterações" : "Registrar Abastecimento"}</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── Folha de Pagamento ──────────────────────────────────────────────────────
//
// As abas DIARISTAS e FUNCIONARIOS FIXOS da planilha, por nome: quem recebe,
// quando e quanto. Diarista é pago por dia ou serviço (descarrego, ajuda);
// funcionário é registrado ou fixo — o `tipo` distingue os dois sem precisar
// de duas telas iguais. Entra no DRE como despesa (dreDoRecorte, em src/lib/analise.js), junto de
// "Despesas" e "Combustível".

const FolhaPagamento = ({ dados, setDados, podeGerir, podeRemover }) => {
  const [modalFuncionario, setModalFuncionario] = useState(false);
  const [modalPagamento, setModalPagamento] = useState(false);
  const funcionarioVazio = () => ({ id: "", nome: "", tipo: TIPOS_FUNCIONARIO[0], funcao: "", usuarioId: "", status: "ativo", salario: "" });
  const [formFuncionario, setFormFuncionario] = useState(funcionarioVazio);
  const [formPagamento, setFormPagamento] = useState({ data: hojeISO(), funcionarioId: "", descricao: "", valor: "", horasExtras: "", valorExtras: "" });
  const [filtroTipo, setFiltroTipo] = useState("Todos");
  const [mesHistorico, setMesHistorico] = useState(() => mesDe(hojeISO()));

  // As contas de acesso ao sistema, para ligar a pessoa da folha ao usuário
  // dela. Vêm de `perfis` (ou das contas locais), fora de `dados`.
  const [contas, setContas] = useState([]);
  useEffect(() => {
    if (!podeGerir) return;
    let vivo = true;
    listarContas().then((lista) => vivo && setContas(lista)).catch(() => {});
    return () => { vivo = false; };
  }, [podeGerir]);
  const contaDe = (id) => contas.find((c) => c.id === id);

  const funcionariosAtivos = dados.funcionarios.filter((f) => f.status === "ativo");
  /** O combinado da pessoa — salário do mês ou valor da diária — para já vir no pagamento. */
  const salarioDe = (id) => {
    const salario = dados.funcionarios.find((f) => f.id === id)?.salario;
    return salario === "" || salario == null ? "" : String(salario);
  };
  const rotuloSalario = (tipo) => (tipo === "Diarista" ? "Valor da diária" : "Salário mensal");
  /**
   * Quem recebeu o pagamento. Enquanto a pessoa existe, vale o cadastro (e o
   * nome editado aparece em tudo); depois de removida, vale o nome e o tipo
   * que o pagamento guardou — é isso que mantém o histórico de quem saiu.
   */
  const funcionarioDe = (p) => dados.funcionarios.find((f) => f.id === p.funcionarioId);
  const nomeDoPagamento = (p) => funcionarioDe(p)?.nome ?? (p.funcionarioNome || "Pessoa removida");
  const tipoDoPagamento = (p) => funcionarioDe(p)?.tipo ?? (p.funcionarioTipo || "—");
  /** Parte das horas extras dentro do total pago; o resto é salário ou diária. */
  const extrasDe = (p) => Number(p.extras) || 0;

  // A folha toda (cartões, histórico e tabela) segue o mês escolhido no topo.
  const pagamentosDoMes = mesHistorico === "todos"
    ? dados.pagamentos
    : dados.pagamentos.filter((p) => mesDe(p.data) === mesHistorico);
  const pagamentosOrdenados = [...pagamentosDoMes].sort(ordenarPorCriacao);
  const pagamentosFiltrados = filtroTipo === "Todos"
    ? pagamentosOrdenados
    : pagamentosOrdenados.filter((p) => tipoDoPagamento(p) === filtroTipo);

  const totalGeral = pagamentosDoMes.reduce((s, p) => s + p.valor, 0);
  const totalDiaristas = pagamentosDoMes.filter((p) => tipoDoPagamento(p) === "Diarista").reduce((s, p) => s + p.valor, 0);
  const totalFuncionarios = pagamentosDoMes.filter((p) => tipoDoPagamento(p) === "Funcionário").reduce((s, p) => s + p.valor, 0);

  const mesAtual = mesDe(hojeISO());

  /** Meses com algum pagamento, do mais recente para o mais antigo — e o mês corrente sempre. */
  const mesesComPagamento = useMemo(
    () => [...new Set([mesAtual, ...dados.pagamentos.map((p) => mesDe(p.data)).filter(Boolean)])].sort().reverse(),
    [dados.pagamentos, mesAtual]
  );

  /**
   * Quanto cada pessoa recebeu no mês escolhido (ou em todos). Inclui quem já
   * foi removido: a linha é agrupada pelo cadastro enquanto ele existe e, sem
   * ele, pelo nome guardado no pagamento.
   */
  const historico = useMemo(() => {
    const mapa = new Map();
    for (const p of dados.pagamentos) {
      if (mesHistorico !== "todos" && mesDe(p.data) !== mesHistorico) continue;
      const atual = dados.funcionarios.find((f) => f.id === p.funcionarioId);
      const chave = atual ? atual.id : `removido:${p.funcionarioNome || ""}`;
      const linha = mapa.get(chave) ?? {
        chave,
        nome: atual?.nome ?? (p.funcionarioNome || "Pessoa removida"),
        tipo: atual?.tipo ?? (p.funcionarioTipo || "—"),
        removido: !atual,
        total: 0,
        extras: 0,
        horasExtras: 0,
        pagamentos: [],
      };
      linha.total += p.valor;
      linha.extras += extrasDe(p);
      linha.horasExtras += Number(p.horasExtras) || 0;
      linha.pagamentos.push(p);
      mapa.set(chave, linha);
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total);
  }, [dados.funcionarios, dados.pagamentos, mesHistorico]);
  /**
   * Alerta: funcionário (registrado/fixo) ativo sem nenhum pagamento no mês
   * escolhido. Diarista fica de fora — só recebe nos dias em que trabalha.
   */
  const semPagamento = useMemo(() => {
    if (mesHistorico === "todos") return [];
    const pagos = new Set(
      dados.pagamentos.filter((p) => mesDe(p.data) === mesHistorico && p.funcionarioId).map((p) => p.funcionarioId)
    );
    return dados.funcionarios.filter((f) => f.status === "ativo" && f.tipo === "Funcionário" && !pagos.has(f.id));
  }, [dados.funcionarios, dados.pagamentos, mesHistorico]);
  /** Quem já foi removido do cadastro, com tudo o que recebeu (todos os meses), do mais recente para o mais antigo. */
  const exFuncionarios = useMemo(() => {
    const mapa = new Map();
    for (const p of dados.pagamentos) {
      if (dados.funcionarios.some((f) => f.id === p.funcionarioId)) continue;
      const chave = `ex:${p.funcionarioNome || ""}`;
      const linha = mapa.get(chave) ?? {
        chave, nome: p.funcionarioNome || "Pessoa removida", tipo: p.funcionarioTipo || "—", total: 0, ultima: "", pagamentos: [],
      };
      linha.total += p.valor;
      if (String(p.data) > linha.ultima) linha.ultima = String(p.data);
      linha.pagamentos.push(p);
      mapa.set(chave, linha);
    }
    return [...mapa.values()].sort((a, b) => b.ultima.localeCompare(a.ultima));
  }, [dados.funcionarios, dados.pagamentos]);
  const totalHistorico = historico.reduce((s, l) => s + l.total, 0);
  const extrasHistorico = historico.reduce((s, l) => s + l.extras, 0);
  /** "Salário R$ X · Extras R$ Y (Nh)" — só quando houve hora extra. */
  const discriminar = (total, extras, horas) =>
    extras > 0 ? `Salário ${brl(total - extras)} · Extras ${brl(extras)}${horas > 0 ? ` (${horas}h)` : ""}` : "";
  const [pessoaAberta, setPessoaAberta] = useState(null);
  const totalMes = dados.pagamentos
    .filter((p) => mesDe(p.data) === mesAtual)
    .reduce((s, p) => s + p.valor, 0);

  // O pagamento é salário (ou diária) + horas extras; `valor` guarda o total,
  // que é o que entra no DRE, e `extras` a parte das horas extras.
  const baseDoForm = Number(formPagamento.valor) || 0;
  const extrasDoForm = Number(formPagamento.valorExtras) || 0;
  const totalDoForm = baseDoForm + extrasDoForm;
  const podeSalvarPagamento = formPagamento.funcionarioId && formPagamento.data && baseDoForm >= 0 && extrasDoForm >= 0 && totalDoForm > 0;

  const fecharPagamento = () => {
    setModalPagamento(false);
    setFormPagamento({ data: hojeISO(), funcionarioId: "", descricao: "", valor: "", horasExtras: "", valorExtras: "" });
  };

  const abrirPagamento = () => {
    const funcionarioId = funcionariosAtivos[0]?.id ?? "";
    setFormPagamento({ data: hojeISO(), funcionarioId, descricao: "", valor: salarioDe(funcionarioId), horasExtras: "", valorExtras: "" });
    setModalPagamento(true);
  };

  const salvarPagamento = () => {
    if (!podeSalvarPagamento) return;
    const pessoa = dados.funcionarios.find((f) => f.id === formPagamento.funcionarioId);
    const novo = {
      data: formPagamento.data,
      funcionarioId: formPagamento.funcionarioId,
      descricao: formPagamento.descricao,
      id: novoId(),
      funcionarioNome: pessoa?.nome ?? "",
      funcionarioTipo: pessoa?.tipo ?? "",
      valor: totalDoForm,
      extras: extrasDoForm,
      horasExtras: Number(formPagamento.horasExtras) || 0,
      criadoEm: new Date().toISOString(),
    };
    setDados((d) => ({ ...d, pagamentos: [...d.pagamentos, novo] }));
    fecharPagamento();
  };

  const removerPagamento = (p) => {
    if (confirm(`Remover o pagamento de ${brl(p.valor)} a ${nomeDoPagamento(p)} em ${formatarData(p.data)}?`)) {
      setDados((d) => ({ ...d, pagamentos: d.pagamentos.filter((x) => x.id !== p.id) }));
    }
  };

  const abrirNovoFuncionario = () => {
    setFormFuncionario(funcionarioVazio());
    setModalFuncionario(true);
  };

  const editarFuncionario = (f) => {
    setFormFuncionario({
      id: f.id, nome: f.nome, tipo: f.tipo, funcao: f.funcao ?? "", usuarioId: f.usuarioId ?? "", status: f.status,
      salario: f.salario === "" || f.salario == null ? "" : String(f.salario),
    });
    setModalFuncionario(true);
  };

  const fecharFuncionario = () => {
    setModalFuncionario(false);
    setFormFuncionario(funcionarioVazio());
  };

  const salvarFuncionario = () => {
    const nome = formFuncionario.nome.trim();
    if (!nome) return;
    const salario = formFuncionario.salario === "" ? "" : Number(formFuncionario.salario);
    if (salario !== "" && !(salario >= 0)) return;
    const usuarioId = formFuncionario.usuarioId;
    // Um usuário é de uma pessoa só (funcionarios_usuario_unico no banco).
    const outro = usuarioId && dados.funcionarios.find((f) => f.id !== formFuncionario.id && f.usuarioId === usuarioId);
    if (outro) {
      alert(`Esse usuário já está ligado a ${outro.nome}.`);
      return;
    }
    const ficha = { nome, tipo: formFuncionario.tipo, funcao: formFuncionario.funcao, usuarioId, status: formFuncionario.status, salario };
    if (formFuncionario.id) {
      setDados((d) => ({ ...d, funcionarios: d.funcionarios.map((f) => (f.id === formFuncionario.id ? { ...f, ...ficha } : f)) }));
    } else {
      setDados((d) => ({ ...d, funcionarios: [...d.funcionarios, { ...ficha, id: novoId(), criadoEm: new Date().toISOString() }] }));
    }
    fecharFuncionario();
  };

  /**
   * O cadastro sai, os pagamentos ficam: cada um leva o nome e o tipo que a
   * pessoa tinha no momento da remoção, e o histórico continua mostrando
   * quanto ela recebeu. O vínculo (funcionario_id) é zerado junto, igual ao
   * que o banco faria sozinho — assim o envio não aponta para quem não existe.
   */
  const removerFuncionario = (f) => {
    const pagamentos = dados.pagamentos.filter((p) => p.funcionarioId === f.id).length;
    const aviso = pagamentos
      ? `Remover ${f.nome}? Os ${pagamentos} pagamento(s) lançado(s) continuam no histórico, com o nome.`
      : `Remover ${f.nome}?`;
    if (confirm(aviso)) {
      setDados((d) => ({
        ...d,
        funcionarios: d.funcionarios.filter((x) => x.id !== f.id),
        pagamentos: d.pagamentos.map((p) =>
          p.funcionarioId === f.id ? { ...p, funcionarioId: "", funcionarioNome: f.nome, funcionarioTipo: f.tipo } : p
        ),
      }));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, color: COLORS.cinzaEscuro }}>Folha de {mesHistorico === "todos" ? "todos os meses" : nomeDoMes(mesHistorico)}</h3>
          <p style={{ margin: "3px 0 0", fontSize: 12.5, color: COLORS.cinza }}>Escolha o mês para ver os pagamentos e quem ainda não recebeu.</p>
        </div>
        <div style={{ minWidth: 170 }}>
          <Select label="Mês" value={mesHistorico} onChange={(e) => { setMesHistorico(e.target.value); setPessoaAberta(null); }}
            options={[...mesesComPagamento.map((m) => ({ value: m, label: nomeDoMes(m) })), { value: "todos", label: "Todos os meses" }]} />
        </div>
      </div>

      {semPagamento.length > 0 && (
        <div role="alert" style={{ background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: 10, padding: "12px 16px", color: "#92400E", fontSize: 13.5 }}>
          <strong>⚠ {semPagamento.length === 1 ? "1 funcionário sem pagamento" : `${semPagamento.length} funcionários sem pagamento`} em {nomeDoMes(mesHistorico)}:</strong>
          <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {semPagamento.map((f) => (
              <span key={f.id} style={{ background: "#FDE68A", borderRadius: 14, padding: "3px 10px", fontSize: 12.5, fontWeight: 600 }}>{f.nome}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <StatCard icon="folha" label="Folha Total" value={brl(totalGeral)} sub={`${pagamentosDoMes.length} pagamento(s)`} color={COLORS.laranjaEscuro} />
        <StatCard icon="vendas" label={`Em ${nomeDoMes(mesAtual)}`} value={brl(totalMes)} sub="mês corrente" color={COLORS.laranja} />
        <StatCard icon="clientes" label="Diaristas" value={brl(totalDiaristas)} sub="pago por dia/serviço" color={COLORS.azul} />
        <StatCard icon="usuarios" label="Funcionários" value={brl(totalFuncionarios)} sub="registrados/fixos" color={COLORS.verde} />
      </div>

      {/* Elenco: quem recebe */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "18px 22px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, color: COLORS.cinzaEscuro }}>Diaristas e Funcionários</h3>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: COLORS.cinza }}>
              Quem recebe — cadastre para poder lançar o pagamento.
            </p>
          </div>
          {podeGerir && <Btn icon="plus" variant="ghost" onClick={abrirNovoFuncionario}>Nova Pessoa</Btn>}
        </div>
        {dados.funcionarios.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, padding: "0 22px 20px" }}>
            {dados.funcionarios.map((f) => (
              <div key={f.id} style={{ border: `1px solid ${COLORS.cinzaClaro}`, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ fontWeight: 700, color: COLORS.cinzaEscuro, fontSize: 14 }}>{f.nome}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <Badge status={f.status} />
                    {podeGerir && (
                      <button onClick={() => editarFuncionario(f)} title="Editar pessoa"
                        style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.5, padding: 2 }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}>
                        <Icon name="edit" color={COLORS.verde} size={15} />
                      </button>
                    )}
                    {podeRemover && (
                      <button onClick={() => removerFuncionario(f)} title="Remover pessoa"
                        style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.4, padding: 2 }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}>
                        <Icon name="trash" color={COLORS.vermelho} size={15} />
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: f.tipo === "Diarista" ? COLORS.azul : COLORS.verde, marginTop: 4, fontWeight: 500 }}>
                  {f.funcao ? `${f.funcao} · ` : ""}{f.tipo}
                </div>
                {f.usuarioId && (
                  <div style={{ fontSize: 11.5, color: COLORS.cinza, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title="Usuário do sistema ligado a esta pessoa">
                    Acesso: {contaDe(f.usuarioId) ? `${contaDe(f.usuarioId).email} (${rotuloPapel(contaDe(f.usuarioId).papel)})` : "usuário ligado"}
                  </div>
                )}
                {f.salario !== "" && f.salario != null && (
                  <div style={{ fontSize: 12.5, color: COLORS.cinzaEscuro, marginTop: 4 }}>
                    {brl(Number(f.salario))}
                    <span style={{ color: COLORS.cinza }}>{f.tipo === "Diarista" ? " / diária" : " / mês"}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Ex-funcionários: quem já foi removido, a partir dos pagamentos que ficaram */}
      {exFuncionarios.length > 0 && (
        <Card>
          <h4 style={{ margin: 0, color: COLORS.cinzaEscuro, fontSize: 15 }}>Ex-funcionários (removidos)</h4>
          <p style={{ margin: "3px 0 10px", fontSize: 12.5, color: COLORS.cinza }}>
            Pessoas que já saíram do cadastro e o que receberam. Toque no nome para ver os pagamentos.
          </p>
          {exFuncionarios.map((l) => (
            <div key={l.chave} style={{ borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
              <button onClick={() => setPessoaAberta((a) => (a === l.chave ? null : l.chave))}
                style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left", font: "inherit" }}>
                <div>
                  <span style={{ fontSize: 13.5, color: COLORS.cinzaEscuro, fontWeight: 500 }}>{l.nome}</span>
                  <span style={{ fontSize: 11.5, color: l.tipo === "Diarista" ? COLORS.azul : COLORS.verde, marginLeft: 8 }}>{l.tipo}</span>
                  <span style={{ fontSize: 11.5, color: COLORS.cinza, marginLeft: 8 }}>
                    {l.pagamentos.length} {l.pagamentos.length === 1 ? "pagamento" : "pagamentos"} · último em {formatarData(l.ultima)}
                  </span>
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.laranjaEscuro, whiteSpace: "nowrap" }}>{brl(l.total)}</span>
              </button>
              {pessoaAberta === l.chave && (
                <div style={{ padding: "0 0 10px 12px" }}>
                  {[...l.pagamentos].sort((a, b) => String(b.data).localeCompare(String(a.data))).map((p) => (
                    <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, color: COLORS.cinza, padding: "3px 0" }}>
                      <span>{formatarData(p.data)}{p.descricao ? ` — ${p.descricao}` : ""}</span>
                      <span style={{ color: COLORS.cinzaEscuro, whiteSpace: "nowrap" }}>{brl(p.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </Card>
      )}

      {/* Pagamentos */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {["Todos", ...TIPOS_FUNCIONARIO].map((t) => (
            <button key={t} onClick={() => setFiltroTipo(t)}
              style={{ padding: "6px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontWeight: filtroTipo === t ? 700 : 400, background: filtroTipo === t ? COLORS.verde : COLORS.cinzaClaro, color: filtroTipo === t ? COLORS.branco : COLORS.cinzaEscuro, fontSize: 12.5, transition: "all 0.15s" }}>
              {t}
            </button>
          ))}
        </div>
        {podeGerir && (
          <Btn icon="plus" onClick={abrirPagamento} disabled={funcionariosAtivos.length === 0}>
            Registrar Pagamento
          </Btn>
        )}
      </div>

      {podeGerir && funcionariosAtivos.length === 0 && (
        <div style={{ fontSize: 12.5, color: COLORS.cinza }}>
          Cadastre uma pessoa ativa para poder registrar pagamento.
        </div>
      )}

      {/* Histórico: quanto cada pessoa recebeu em cada mês, inclusive quem saiu */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
          <div>
            <h4 style={{ margin: 0, color: COLORS.cinzaEscuro, fontSize: 15 }}>Histórico por Mês</h4>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: COLORS.cinza }}>
              Quanto cada pessoa recebeu — inclusive quem já foi removido. Toque no nome para ver os pagamentos.
            </p>
          </div>
        </div>
        {historico.map((l) => (
          <div key={l.chave} style={{ borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
            <button onClick={() => setPessoaAberta((a) => (a === l.chave ? null : l.chave))}
              style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 0", background: "none", border: "none", cursor: "pointer", textAlign: "left", font: "inherit" }}>
              <div>
                <span style={{ fontSize: 13.5, color: COLORS.cinzaEscuro, fontWeight: 500 }}>{l.nome}</span>
                <span style={{ fontSize: 11.5, color: l.tipo === "Diarista" ? COLORS.azul : COLORS.verde, marginLeft: 8 }}>{l.tipo}</span>
                {l.removido && <span style={{ fontSize: 11, color: COLORS.cinza, marginLeft: 8 }}>· removido</span>}
                <span style={{ fontSize: 11.5, color: COLORS.cinza, marginLeft: 8 }}>
                  {l.pagamentos.length} {l.pagamentos.length === 1 ? "pagamento" : "pagamentos"}
                </span>
              </div>
              <span style={{ textAlign: "right" }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: COLORS.laranjaEscuro, whiteSpace: "nowrap" }}>{brl(l.total)}</span>
                {l.extras > 0 && (
                  <span style={{ display: "block", fontSize: 11.5, color: COLORS.cinza, whiteSpace: "nowrap" }}>{discriminar(l.total, l.extras, l.horasExtras)}</span>
                )}
              </span>
            </button>
            {pessoaAberta === l.chave && (
              <div style={{ padding: "0 0 10px 12px" }}>
                {[...l.pagamentos].sort((a, b) => String(b.data).localeCompare(String(a.data))).map((p) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, color: COLORS.cinza, padding: "3px 0" }}>
                    <span>{formatarData(p.data)}{p.descricao ? ` — ${p.descricao}` : ""}</span>
                    <span style={{ color: COLORS.cinzaEscuro, whiteSpace: "nowrap", textAlign: "right" }}>
                      {brl(p.valor)}
                      {extrasDe(p) > 0 && <span style={{ display: "block", fontSize: 11, color: COLORS.cinza }}>{discriminar(p.valor, extrasDe(p), Number(p.horasExtras) || 0)}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        {historico.length > 0 ? (
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: `2px solid ${COLORS.cinzaClaro}`, paddingTop: 9, fontSize: 13.5, fontWeight: 700, color: COLORS.cinzaEscuro }}>
            <span>Total {mesHistorico === "todos" ? "geral" : `de ${nomeDoMes(mesHistorico)}`}</span>
            <span style={{ textAlign: "right" }}>
              <span style={{ display: "block", color: COLORS.laranjaEscuro }}>{brl(totalHistorico)}</span>
              {extrasHistorico > 0 && (
                <span style={{ display: "block", fontSize: 11.5, fontWeight: 400, color: COLORS.cinza }}>
                  Salário {brl(totalHistorico - extrasHistorico)} · Extras {brl(extrasHistorico)}
                </span>
              )}
            </span>
          </div>
        ) : (
          <div style={{ padding: "16px 0 4px", textAlign: "center", color: COLORS.cinza, fontSize: 13 }}>
            Nenhum pagamento em {mesHistorico === "todos" ? "nenhum mês" : nomeDoMes(mesHistorico)}.
          </div>
        )}
      </Card>

      <Card style={{ padding: 0, overflow: "auto" }}>
        <TabelaRolavel>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
            <thead style={{ background: COLORS.cinzaClaro }}>
              <tr>
                {["Data", "Nome", "Tipo", "Descrição", "Valor", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", fontSize: 11.5, color: COLORS.cinza, padding: "10px 14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagamentosFiltrados.map((p) => (
                <tr key={p.id} style={{ borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
                  <td style={{ padding: "11px 14px", color: COLORS.cinza, fontSize: 13, whiteSpace: "nowrap" }}>{formatarData(p.data)}</td>
                  <td style={{ padding: "11px 14px", color: COLORS.cinzaEscuro, fontSize: 13, whiteSpace: "nowrap" }}>{nomeDoPagamento(p)}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12.5, color: tipoDoPagamento(p) === "Diarista" ? COLORS.azul : COLORS.verde, whiteSpace: "nowrap" }}>
                    {tipoDoPagamento(p)}
                  </td>
                  <td style={{ padding: "11px 14px", color: COLORS.cinza, fontSize: 13 }}>{p.descricao || "—"}</td>
                  <td style={{ padding: "11px 14px", whiteSpace: "nowrap" }}>
                    <div style={{ fontWeight: 700, color: COLORS.laranjaEscuro }}>{brl(p.valor)}</div>
                    {extrasDe(p) > 0 && (
                      <div style={{ fontSize: 11.5, color: COLORS.cinza }}>{discriminar(p.valor, extrasDe(p), Number(p.horasExtras) || 0)}</div>
                    )}
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <button onClick={() => removerPagamento(p)} title="Remover pagamento"
                      style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.4, padding: 2 }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}>
                      <Icon name="trash" color={COLORS.vermelho} size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabelaRolavel>
        {pagamentosFiltrados.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.cinza }}>
            Nenhum pagamento registrado{mesHistorico === "todos" ? "" : ` em ${nomeDoMes(mesHistorico)}`}{filtroTipo !== "Todos" ? ` para ${filtroTipo.toLowerCase()}` : ""}.
          </div>
        )}
      </Card>

      {modalFuncionario && (
        <Modal title={formFuncionario.id ? `Editar — ${formFuncionario.nome}` : "Nova Pessoa"} onClose={fecharFuncionario}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Input label="Nome *" value={formFuncionario.nome} onChange={(e) => setFormFuncionario((f) => ({ ...f, nome: e.target.value }))} placeholder="Como aparece na folha" />
            <Select label="Tipo *" value={formFuncionario.tipo} onChange={(e) => setFormFuncionario((f) => ({ ...f, tipo: e.target.value }))}
              options={TIPOS_FUNCIONARIO.map((v) => ({ value: v, label: v }))} />
            <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: -8 }}>
              Diarista é pago por dia ou serviço (descarrego, ajuda). Funcionário é registrado ou fixo.
            </div>
            <Select label="Função" value={formFuncionario.funcao} onChange={(e) => setFormFuncionario((f) => ({ ...f, funcao: e.target.value }))}
              options={[
                { value: "", label: "Selecione..." },
                ...FUNCOES_FUNCIONARIO.map((v) => ({ value: v, label: v })),
                // Função que saiu da lista continua aparecendo para quem já a tem.
                ...(formFuncionario.funcao && !FUNCOES_FUNCIONARIO.includes(formFuncionario.funcao)
                  ? [{ value: formFuncionario.funcao, label: formFuncionario.funcao }] : []),
              ]} />
            <Select label="Usuário do sistema" value={formFuncionario.usuarioId} onChange={(e) => setFormFuncionario((f) => ({ ...f, usuarioId: e.target.value }))}
              options={[
                { value: "", label: "Sem acesso ao sistema" },
                ...contas
                  .filter((c) => c.id === formFuncionario.usuarioId || !dados.funcionarios.some((f) => f.usuarioId === c.id))
                  .map((c) => ({ value: c.id, label: `${c.nome || c.email} — ${c.email} (${rotuloPapel(c.papel)})${c.ativo ? "" : " · inativo"}` })),
                ...(formFuncionario.usuarioId && !contaDe(formFuncionario.usuarioId)
                  ? [{ value: formFuncionario.usuarioId, label: "Usuário ligado (não encontrado)" }] : []),
              ]} />
            <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: -8 }}>
              A conta que essa pessoa usa para entrar. Cria-se o acesso na aba Usuários.
            </div>
            <Input label={`${rotuloSalario(formFuncionario.tipo)} (R$)`} type="number" min="0" step="0.01" value={formFuncionario.salario}
              onChange={(e) => setFormFuncionario((f) => ({ ...f, salario: e.target.value }))} placeholder="0,00" />
            <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: -8 }}>
              Já vem preenchido ao registrar o pagamento dessa pessoa — dá para mudar na hora.
            </div>
            {formFuncionario.id && (
              <>
                <Select label="Situação" value={formFuncionario.status} onChange={(e) => setFormFuncionario((f) => ({ ...f, status: e.target.value }))}
                  options={[{ value: "ativo", label: "Ativo" }, { value: "inativo", label: "Inativo" }]} />
                <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: -8 }}>
                  Inativo não aparece mais para lançar pagamento, mas o histórico continua.
                </div>
              </>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn variant="secondary" onClick={fecharFuncionario}>Cancelar</Btn>
              <Btn onClick={salvarFuncionario}>Salvar Pessoa</Btn>
            </div>
          </div>
        </Modal>
      )}

      {modalPagamento && (
        <Modal title="Registrar Pagamento" onClose={fecharPagamento}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Data *" type="date" value={formPagamento.data} onChange={(e) => setFormPagamento((f) => ({ ...f, data: e.target.value }))} />
              <Select label="Pessoa *" value={formPagamento.funcionarioId} onChange={(e) => { const funcionarioId = e.target.value; setFormPagamento((f) => ({ ...f, funcionarioId, valor: salarioDe(funcionarioId) })); }}
                options={[{ value: "", label: "Selecione..." }, ...funcionariosAtivos.map((f) => ({ value: f.id, label: `${f.nome} (${f.tipo})` }))]} />
            </div>
            <Input label="Salário / diária (R$) *" type="number" min="0" step="0.01" value={formPagamento.valor} onChange={(e) => setFormPagamento((f) => ({ ...f, valor: e.target.value }))} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input label="Horas extras (qtd)" type="number" min="0" step="0.5" value={formPagamento.horasExtras} onChange={(e) => setFormPagamento((f) => ({ ...f, horasExtras: e.target.value }))} placeholder="0" />
              <Input label="Valor das extras (R$)" type="number" min="0" step="0.01" value={formPagamento.valorExtras} onChange={(e) => setFormPagamento((f) => ({ ...f, valorExtras: e.target.value }))} placeholder="0,00" />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, background: COLORS.cinzaClaro, borderRadius: 8, padding: "9px 12px" }}>
              <span style={{ color: COLORS.cinza }}>
                Total{extrasDoForm > 0 ? ` (salário ${brl(baseDoForm)} + extras ${brl(extrasDoForm)})` : ""}
              </span>
              <strong style={{ color: COLORS.laranjaEscuro }}>{brl(totalDoForm)}</strong>
            </div>
            <Input label="Descrição" value={formPagamento.descricao} onChange={(e) => setFormPagamento((f) => ({ ...f, descricao: e.target.value }))} placeholder="Descarrego 1620, salário do mês…" />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <Btn variant="secondary" onClick={fecharPagamento}>Cancelar</Btn>
              <Btn onClick={salvarPagamento} style={{ opacity: podeSalvarPagamento ? 1 : 0.5 }}>Registrar Pagamento</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── Financeiro ──────────────────────────────────────────────────────────────

/** Faixas de atraso das contas a receber — o "aging" que o sócio pergunta primeiro. */
const FAIXAS_ATRASO = [
  { rotulo: "A vencer", de: -Infinity, ate: 0 },
  { rotulo: "1 a 7 dias", de: 1, ate: 7 },
  { rotulo: "8 a 15 dias", de: 8, ate: 15 },
  { rotulo: "16 a 30 dias", de: 16, ate: 30 },
  { rotulo: "Mais de 30 dias", de: 31, ate: Infinity },
];

const Financeiro = ({ dados }) => {
  // Por padrão o ano, mês a mês — é a leitura do DRE. Dá para descer ao dia.
  const { filtros, setFiltros, limpar, intervalo } = useFiltros("financeiro", { periodo: "ano", agrupar: "mes" });
  const meses = useMemo(() => mesesComMovimento(dados), [dados]);
  const frutas = useMemo(() => frutasDe(dados), [dados]);
  const [dimensao, setDimensao] = useState("cliente");

  const recorte = useMemo(() => dreDoRecorte(dados, filtros, intervalo, filtros.agrupar), [dados, filtros, intervalo]);
  const anterior = useMemo(() => {
    const ant = intervaloAnterior(intervalo);
    return ant ? dreDoRecorte(dados, filtros, ant, "ano").total : null;
  }, [dados, filtros, intervalo]);
  const acumulado = recorte.total;
  const dre = recorte.linhas;
  const parcial = recorte.parcial;
  const vs = (campo) => (anterior ? variacao(acumulado[campo], anterior[campo]) : undefined);

  // Faturado no período, e quanto dele já entrou: item a item, para o filtro
  // de fruta e de produto valer também aqui.
  const recebido = recorte.itens.filter((i) => i.status === "pago").reduce((s, i) => s + i.receita, 0);
  const emAberto = recorte.itens.filter((i) => i.status === "pendente").reduce((s, i) => s + i.receita, 0);
  const pedidosPagos = new Set(recorte.itens.filter((i) => i.status === "pago").map((i) => i.vendaId)).size;

  // Contas a receber: o que está em aberto HOJE, de qualquer data — mas só da
  // rede/cliente escolhidos.
  const redeDaLoja = new Map(dados.lojas.map((l) => [l.id, l.redeId]));
  const doCliente = (v) => (!filtros.rede || redeDaLoja.get(v.lojaId) === filtros.rede) && (!filtros.cliente || v.lojaId === filtros.cliente);
  const aReceber = dados.vendas
    .filter((v) => v.status === "pendente" && doCliente(v))
    .map((v) => {
      const vencimento = vencimentoDoPedido(dados, v);
      return { ...v, vencimento, atraso: diasDeAtraso(vencimento) };
    })
    .sort((a, b) => b.atraso - a.atraso);
  const totalPendente = aReceber.reduce((s, v) => s + v.total, 0);
  const vencidas = aReceber.filter((v) => v.atraso > 0);
  const faixas = FAIXAS_ATRASO.map((f) => {
    const lista = aReceber.filter((v) => v.atraso >= f.de && v.atraso <= f.ate);
    return { ...f, qtd: lista.length, total: lista.reduce((s, v) => s + v.total, 0) };
  });
  const maiorFaixa = Math.max(1, ...faixas.map((f) => f.total));

  // Quem deve: a receber agrupado por cliente.
  const devedores = (() => {
    const mapa = new Map();
    for (const v of aReceber) {
      const l = mapa.get(v.lojaId) ?? { id: v.lojaId, nome: nomeDoCliente(dados, v.lojaId), total: 0, vencido: 0, pedidos: 0, maiorAtraso: 0 };
      l.total += v.total;
      l.pedidos += 1;
      if (v.atraso > 0) l.vencido += v.total;
      l.maiorAtraso = Math.max(l.maiorAtraso, v.atraso);
      mapa.set(v.lojaId, l);
    }
    return [...mapa.values()];
  })();
  const colunasDevedores = [
    { chave: "nome", rotulo: "Cliente" },
    { chave: "total", rotulo: "Em aberto", formatar: brl, destaque: true, participacao: true },
    { chave: "vencido", rotulo: "Vencido", formatar: brl, cor: (l) => (l.vencido > 0 ? COLORS.vermelho : COLORS.cinzaEscuro) },
    { chave: "pedidos", rotulo: "Pedidos" },
    { chave: "maiorAtraso", rotulo: "Maior atraso", formatar: (v) => (v > 0 ? `${v} dias` : "em dia") },
  ];

  const ranking = useMemo(
    () => rankingDeVendas(dados, recorte, dimensao),
    [dados, recorte, dimensao]
  );
  const rotuloDimensao = DIMENSOES_VENDA.find((d) => d.valor === dimensao)?.rotulo ?? "";

  const nomeRede = dados.redes.find((r) => r.id === filtros.rede)?.nome;
  const nomeProduto = dados.produtos.find((p) => p.id === filtros.produto)?.nome;
  const descricaoRecorte = [
    rotuloIntervalo(intervalo),
    filtros.empresa && nomeDaEmpresa(filtros.empresa),
    nomeRede && `rede ${nomeRede}`,
    filtros.cliente && nomeDoCliente(dados, filtros.cliente),
    filtros.fruta,
    nomeProduto,
  ].filter(Boolean).join(" · ");
  const rotuloAgrupar = { dia: "Dia", semana: "Semana", mes: "Mês", ano: "Ano" }[filtros.agrupar];
  const tituloDre = parcial ? `Margem por ${rotuloAgrupar.toLowerCase()}` : `Resultado por ${rotuloAgrupar.toLowerCase()}`;

  // As colunas do DRE mudam com o recorte: por cliente não há despesa nem compra a abater.
  const colunasDre = parcial
    ? [
      { chave: "periodo", rotulo: rotuloAgrupar },
      { chave: "receita", rotulo: "Receita" },
      { chave: "custo", rotulo: "Custo est." },
      { chave: "margemBruta", rotulo: "Margem bruta" },
      { chave: "margemPct", rotulo: "Margem %" },
      { chave: "kg", rotulo: "Kg" },
      { chave: "pedidos", rotulo: "Pedidos" },
      { chave: "precoMedio", rotulo: "R$/kg" },
    ]
    : [
      { chave: "periodo", rotulo: rotuloAgrupar },
      { chave: "receita", rotulo: "Receita" },
      { chave: "despesas", rotulo: "Despesas" },
      { chave: "mercadoria", rotulo: "Mercadoria" },
      { chave: "taxas", rotulo: "Taxas" },
      { chave: "resultado", rotulo: "Resultado" },
      { chave: "margem", rotulo: "Margem" },
      { chave: "margemBruta", rotulo: "Margem bruta est." },
      { chave: "kg", rotulo: "Kg" },
      { chave: "pedidos", rotulo: "Pedidos" },
      { chave: "precoMedio", rotulo: "R$/kg" },
    ];
  const linhaDre = (l) => ({
    periodo: rotuloGrupo(l.chave, filtros.agrupar, true),
    receita: brl(l.receita),
    despesas: brl(l.despesas),
    mercadoria: brl(l.mercadoria),
    taxas: brl(l.taxas),
    resultado: brl(l.resultado),
    margem: pct(l.margem),
    custo: brl(l.custo),
    margemBruta: brl(l.margemBruta) + (l.custoParcial ? "*" : ""),
    margemPct: pct(l.margemPct),
    kg: kg(l.kgVendido),
    pedidos: l.pedidos,
    precoMedio: brl(l.precoMedio),
  });
  const linhasDre = [...dre.map(linhaDre), { ...linhaDre(acumulado), periodo: "Total do período" }];

  const colunasReceber = [
    { chave: "pedido", rotulo: "Pedido" },
    { chave: "cliente", rotulo: "Cliente" },
    { chave: "emissao", rotulo: "Emissão" },
    { chave: "prazo", rotulo: "Prazo" },
    { chave: "vencimento", rotulo: "Vencimento" },
    { chave: "valor", rotulo: "Valor" },
  ];
  const linhasReceber = aReceber.map((v) => ({
    pedido: `#${v.numero ?? "—"}`,
    cliente: nomeDoCliente(dados, v.lojaId),
    emissao: formatarData(v.data),
    prazo: rotuloPrazo(v.prazoDias),
    vencimento: rotuloVencimento(dados, v) + (v.atraso > 0 ? ` (${v.atraso}d atraso)` : ""),
    valor: brl(v.total),
  }));

  const tabelasFinanceiro = () => [
    { nome: tituloDre, titulo: `${tituloDre} — ${descricaoRecorte}`, colunas: colunasDre, linhas: linhasDre },
    ...DIMENSOES_VENDA.map((d) => tabelaExportavel(`Por ${d.rotulo}`, `Vendas por ${d.rotulo.toLowerCase()}`,
      colunasRankingVendas(d.rotulo, d.valor !== "cliente"), rankingDeVendas(dados, recorte, d.valor))),
    {
      nome: "Atraso", titulo: "Contas a receber por faixa de atraso",
      colunas: [{ chave: "faixa", rotulo: "Faixa" }, { chave: "qtd", rotulo: "Pedidos" }, { chave: "total", rotulo: "Valor" }],
      linhas: faixas.map((f) => ({ faixa: f.rotulo, qtd: f.qtd, total: brl(f.total) })),
    },
    tabelaExportavel("A receber por cliente", "A receber por cliente", colunasDevedores, [...devedores].sort((a, b) => b.total - a.total)),
    { nome: "Contas a Receber", titulo: "Contas a Receber", colunas: colunasReceber, linhas: linhasReceber },
  ];
  const arquivoFinanceiro = filtros.empresa ? `financeiro-${filtros.empresa.replace("_", "-")}` : "financeiro-cvc";
  const exportarFinanceiroXlsx = () => exportarXlsx(arquivoFinanceiro, tabelasFinanceiro());
  const exportarFinanceiroPdf = () => exportarPdf(arquivoFinanceiro, `Relatório Financeiro — ${descricaoRecorte}`, tabelasFinanceiro());

  const pontosDinheiro = pontosDoRecorte(dre, filtros.agrupar, (l) => (parcial
    ? { receita: l?.receita ?? 0, custo: l?.custo ?? 0, margemBruta: l?.margemBruta ?? 0 }
    : { receita: l?.receita ?? 0, saidas: (l?.despesas ?? 0) + (l?.mercadoria ?? 0) + (l?.taxas ?? 0), resultado: l?.resultado ?? 0 }));
  const pontosKg = pontosDoRecorte(dre, filtros.agrupar, (l) => ({ kg: l?.kgVendido ?? 0 }));

  const celula = { padding: "11px 12px", fontSize: 13, textAlign: "right", whiteSpace: "nowrap" };
  const cor = (v) => (v >= 0 ? COLORS.verde : COLORS.vermelho);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <BarraFiltros
        dados={dados} filtros={filtros} setFiltros={setFiltros} limpar={limpar} intervalo={intervalo}
        campos={["agrupar", "empresa", "rede", "cliente", "fruta", "produto"]}
        meses={meses} frutas={frutas} empresas={EMPRESAS}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
        <Indicador rotulo="Faturado" valor={brl(acumulado.receita)} sub={`${acumulado.pedidos} pedidos · ${kg(acumulado.kg)}`} pct={vs("receita")} cor={COLORS.azul} />
        <Indicador rotulo="Recebido" valor={brl(recebido)} sub={`${pedidosPagos} pagos · ${brl(emAberto)} em aberto`} cor={COLORS.verde} />
        {parcial ? (
          <Indicador rotulo="Margem bruta est." valor={brl(acumulado.margemBruta)} sub={`${pct(acumulado.margemPct)} da receita`}
            pct={vs("margemBruta")} cor={cor(acumulado.margemBruta)} />
        ) : (
          <Indicador rotulo="Resultado" valor={brl(acumulado.resultado)} sub={`margem de ${pct(acumulado.margem)}`}
            pct={vs("resultado")} cor={cor(acumulado.resultado)} />
        )}
        {!parcial && (
          <Indicador rotulo="Saídas" valor={brl(acumulado.despesas + acumulado.mercadoria + acumulado.taxas)}
            sub={`${brl(acumulado.despesas)} despesas · ${brl(acumulado.mercadoria)} fruta${acumulado.taxas ? ` · ${brl(acumulado.taxas)} taxas` : ""}`} cor={COLORS.laranjaEscuro} />
        )}
        <Indicador rotulo="A receber hoje" valor={brl(totalPendente)} sub={`${aReceber.length} pendências, de qualquer data`} cor={COLORS.laranja} />
        <Indicador rotulo="Vencido" valor={brl(vencidas.reduce((s, v) => s + v.total, 0))} sub={`${vencidas.length} conta(s) em atraso`} cor={COLORS.vermelho} />
      </div>

      {dre.length === 0 ? (
        <Card style={{ textAlign: "center", color: COLORS.cinza, padding: 40 }}>
          Nenhum lançamento em {descricaoRecorte}.
        </Card>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
            <Card>
              <h4 style={{ margin: "0 0 4px", color: COLORS.cinzaEscuro, fontSize: 15 }}>
                {parcial ? "Receita, custo e margem bruta" : "Receita, saídas e resultado"}
              </h4>
              <p style={{ margin: "0 0 12px", fontSize: 12.5, color: COLORS.cinza }}>
                {AGRUPAMENTOS.find((a) => a.value === filtros.agrupar)?.label}, em reais.
                {!parcial && " Saídas = despesas + fruta comprada + taxas dos clientes."}
              </p>
              <GraficoColunas
                pontos={pontosDinheiro}
                series={parcial
                  ? [
                    { chave: "receita", rotulo: "Receita", cor: CORES_SERIE.receita },
                    { chave: "custo", rotulo: "Custo est.", cor: CORES_SERIE.despesas },
                    { chave: "margemBruta", rotulo: "Margem bruta", cor: CORES_SERIE.resultado },
                  ]
                  : [
                    { chave: "receita", rotulo: "Receita", cor: CORES_SERIE.receita },
                    { chave: "saidas", rotulo: "Saídas", cor: CORES_SERIE.despesas },
                    { chave: "resultado", rotulo: "Resultado", cor: CORES_SERIE.resultado },
                  ]}
              />
            </Card>
            <Card>
              <h4 style={{ margin: "0 0 4px", color: COLORS.cinzaEscuro, fontSize: 15 }}>Quilos vendidos</h4>
              <p style={{ margin: "0 0 12px", fontSize: 12.5, color: COLORS.cinza }}>{AGRUPAMENTOS.find((a) => a.value === filtros.agrupar)?.label}.</p>
              <GraficoColunas
                pontos={pontosKg}
                series={[{ chave: "kg", rotulo: "Quilos", cor: CORES_SERIE.resultado }]}
                formatar={kg}
              />
            </Card>
          </div>

          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "20px 24px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h4 style={{ margin: 0, color: COLORS.cinzaEscuro, fontSize: 15 }}>{tituloDre}</h4>
                <p style={{ margin: "4px 0 0", fontSize: 12.5, color: COLORS.cinza, maxWidth: 720 }}>
                  {descricaoRecorte}.{" "}
                  {parcial
                    ? "Despesas e compras não são lançadas por cliente, rede ou produto — a conta aqui é receita − custo estimado da fruta (kg × custo médio de compra)."
                    : filtros.empresa && filtros.empresa !== EMPRESA_PADRAO
                      ? `Só ${nomeDaEmpresa(filtros.empresa)}: receita − mercadoria. Despesas, combustível e folha são da CVC.`
                      : "Receita − despesas − mercadoria − taxas dos clientes (IFCO, CD, antecipação). A mercadoria é a que foi comprada no período, não o custo do que saiu — é o método da sua planilha."}
                </p>
              </div>
              <BotoesExportar aoExportarXlsx={exportarFinanceiroXlsx} aoExportarPdf={exportarFinanceiroPdf} />
            </div>
            <TabelaRolavel>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: parcial ? 760 : 1060 }}>
                <thead style={{ background: COLORS.cinzaClaro }}>
                  <tr>
                    {colunasDre.map((c, i) => (
                      <th key={c.chave} style={{ textAlign: i === 0 ? "left" : "right", fontSize: 11.5, color: COLORS.cinza, padding: "11px 12px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, whiteSpace: "nowrap" }}>{c.rotulo}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...dre, { ...acumulado, chave: "__total" }].map((l) => {
                    const total = l.chave === "__total";
                    const peso = total ? 800 : 600;
                    return (
                      <tr key={l.chave} style={{ borderTop: total ? `2px solid ${COLORS.cinzaEscuro}22` : `1px solid ${COLORS.cinzaClaro}`, background: total ? COLORS.creme : undefined }}>
                        <td style={{ padding: "11px 12px", fontSize: 13, fontWeight: 700, color: COLORS.cinzaEscuro, whiteSpace: "nowrap" }}>
                          {total ? "Total do período" : rotuloGrupo(l.chave, filtros.agrupar, true)}
                        </td>
                        <td style={{ ...celula, color: COLORS.cinzaEscuro, fontWeight: total ? 700 : 400 }}>{brl(l.receita)}</td>
                        {parcial ? (
                          <>
                            <td style={{ ...celula, color: COLORS.laranjaEscuro }}>− {brl(l.custo)}</td>
                            <td style={{ ...celula, fontWeight: peso, color: cor(l.margemBruta) }}>{brl(l.margemBruta)}{l.custoParcial ? "*" : ""}</td>
                            <td style={{ ...celula, fontWeight: 600, color: cor(l.margemPct) }}>{pct(l.margemPct)}</td>
                          </>
                        ) : (
                          <>
                            <td style={{ ...celula, color: COLORS.laranjaEscuro }}>− {brl(l.despesas)}</td>
                            <td style={{ ...celula, color: COLORS.laranjaEscuro }}>− {brl(l.mercadoria)}</td>
                            <td style={{ ...celula, color: COLORS.laranjaEscuro }}>− {brl(l.taxas)}</td>
                            <td style={{ ...celula, fontWeight: peso, color: cor(l.resultado) }}>{brl(l.resultado)}</td>
                            <td style={{ ...celula, fontWeight: 600, color: cor(l.margem) }}>{pct(l.margem)}</td>
                            <td style={{ ...celula, color: cor(l.margemBruta) }}>{brl(l.margemBruta)}{l.custoParcial ? "*" : ""}</td>
                          </>
                        )}
                        <td style={{ ...celula, color: COLORS.cinza }}>{kg(l.kgVendido)}</td>
                        <td style={{ ...celula, color: COLORS.cinza }}>{l.pedidos}</td>
                        <td style={{ ...celula, color: COLORS.cinza }}>{brl(l.precoMedio)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TabelaRolavel>
            {acumulado.custoParcial && (
              <p style={{ margin: 0, padding: "10px 24px 14px", fontSize: 11.5, color: COLORS.cinza }}>
                * Alguma fruta vendida não tem compra registrada, então o custo dela não entrou na margem bruta.
              </p>
            )}
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <FiltroPills
              opcoes={DIMENSOES_VENDA.map((d) => ({ valor: d.valor, rotulo: `Por ${d.rotulo.toLowerCase()}` }))}
              selecionado={dimensao}
              aoSelecionar={setDimensao}
            />
            <Ranking
              key={dimensao}
              titulo={`Faturamento por ${rotuloDimensao.toLowerCase()}`}
              subtitulo={descricaoRecorte}
              linhas={ranking}
              colunas={colunasRankingVendas(rotuloDimensao, dimensao !== "cliente")}
            />
          </div>
        </>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        <Card>
          <h4 style={{ margin: "0 0 4px", color: COLORS.cinzaEscuro, fontSize: 15 }}>A receber por atraso</h4>
          <p style={{ margin: "0 0 16px", fontSize: 12.5, color: COLORS.cinza }}>Tudo em aberto hoje{nomeRede || filtros.cliente ? `, de ${filtros.cliente ? nomeDoCliente(dados, filtros.cliente) : nomeRede}` : ""}.</p>
          {faixas.map((f, i) => (
            <div key={f.rotulo} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                <span style={{ color: COLORS.cinzaEscuro, fontWeight: 500 }}>{f.rotulo}</span>
                <span style={{ color: COLORS.cinzaEscuro, fontWeight: 600 }}>
                  {brl(f.total)}<span style={{ color: COLORS.cinza, fontWeight: 400, fontSize: 12 }}> · {f.qtd} pedido(s)</span>
                </span>
              </div>
              <div style={{ background: COLORS.cinzaClaro, borderRadius: 99, height: 6 }}>
                <div style={{ width: `${(f.total / maiorFaixa) * 100}%`, background: i === 0 ? COLORS.verdeClaro : i < 2 ? COLORS.laranja : COLORS.vermelho, height: 6, borderRadius: 99 }} />
              </div>
            </div>
          ))}
        </Card>
        <Ranking
          titulo="Quem deve"
          subtitulo="Em aberto por cliente"
          linhas={devedores}
          colunas={colunasDevedores}
          vazio="Nenhuma pendência 🎉"
        />
      </div>

      <Card>
        <h4 style={{ margin: "0 0 16px", color: COLORS.cinzaEscuro, fontSize: 15 }}>
          Contas a Receber
          <span style={{ fontWeight: 400, color: COLORS.cinza, fontSize: 13 }}> — o que vence primeiro, primeiro</span>
        </h4>
        {aReceber.length === 0 ? (
          <div style={{ color: COLORS.cinza, textAlign: "center", padding: 24 }}>Nenhuma pendência 🎉</div>
        ) : (
          <TabelaRolavel>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
              <thead>
                <tr>
                  {["Pedido", "Cliente", "Emissão", "Prazo", "Vencimento", "Valor"].map((h) => (
                    <th key={h} style={{ textAlign: "left", fontSize: 12, color: COLORS.cinza, paddingBottom: 10, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aReceber.map((v) => (
                  <tr key={v.id} style={{ borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
                    <td style={{ padding: "11px 0", fontSize: 13, color: COLORS.cinza }}>#{v.numero ?? "—"}</td>
                    <td style={{ padding: "11px 8px", fontSize: 14, color: COLORS.cinzaEscuro }}>{nomeDoCliente(dados, v.lojaId)}</td>
                    <td style={{ padding: "11px 8px", fontSize: 13, color: COLORS.cinza, whiteSpace: "nowrap" }}>{formatarData(v.data)}</td>
                    <td style={{ padding: "11px 8px", fontSize: 13, color: COLORS.cinza, whiteSpace: "nowrap" }}>{rotuloPrazo(v.prazoDias)}</td>
                    <td style={{ padding: "11px 8px", fontSize: 13, whiteSpace: "nowrap", color: v.atraso > 0 ? COLORS.vermelho : COLORS.cinzaEscuro, fontWeight: v.atraso > 0 ? 700 : 400 }}>
                      {rotuloVencimento(dados, v)}
                      {v.atraso > 0 && <span style={{ fontSize: 11 }}> · {v.atraso}d</span>}
                    </td>
                    <td style={{ padding: "11px 0", fontSize: 15, fontWeight: 700, color: v.atraso > 0 ? COLORS.vermelho : COLORS.laranjaEscuro, whiteSpace: "nowrap" }}>{brl(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolavel>
        )}
      </Card>
    </div>
  );
};

// ─── Cobrança ────────────────────────────────────────────────────────────────
//
// Todo dia de manhã: quem comprou a prazo e venceu ontem pagou ou não? A venda
// à vista (prazo 0) fica de fora — ela é recebida na entrega, não se cobra. Um
// pedido de nota semanal (Rede Primavera) que ainda não fechou a semana também
// fica de fora: o prazo dele só começa a contar quando a NF-e sai (ver
// lib/notaSemanal.js), então ainda não tem vencimento nem para um lado nem
// para outro.
//
// "Foi paga" baixa a venda (status pago). "Não foi paga" mantém pendente e
// grava `cobrancaConferidaEm`: é o que separa a conta que ninguém olhou da
// que já foi conferida e virou cobrança.

/** Pendentes vencidas até ontem que ninguém conferiu — o número da barra lateral. */
function cobrancasSemConferir(dados) {
  const ontem = vencimentoDe(hojeISO(), -1);
  return dados.vendas.filter((v) => {
    const venc = vencimentoDoPedido(dados, v);
    return venc && venc <= ontem && v.status === "pendente" && !v.cobrancaConferidaEm;
  });
}

const Cobranca = ({ dados, setDados }) => {
  const hoje = hojeISO();
  const ontem = vencimentoDe(hoje, -1);
  const [dia, setDia] = useState(ontem);
  const [janela, setJanela] = useState(7);

  const conferir = (id, pagou) =>
    setDados((d) => ({
      ...d,
      vendas: d.vendas.map((v) =>
        v.id === id ? { ...v, status: pagou ? "pago" : "pendente", cobrancaConferidaEm: hoje } : v
      ),
    }));

  const desfazer = (id) =>
    setDados((d) => ({
      ...d,
      vendas: d.vendas.map((v) => (v.id === id ? { ...v, status: "pendente", cobrancaConferidaEm: null } : v)),
    }));

  const comVencimento = dados.vendas
    .map((v) => ({ ...v, vencimento: vencimentoDoPedido(dados, v) }))
    .filter((v) => v.vencimento);

  // As do dia escolhido aparecem todas, conferidas ou não: o que já foi
  // respondido continua na tela, com a resposta e o "desfazer".
  const doDia = comVencimento
    .filter((v) => v.vencimento === dia)
    .sort((a, b) => nomeDoCliente(dados, a.lojaId).localeCompare(nomeDoCliente(dados, b.lojaId)));

  // Venceu antes do dia escolhido e ninguém conferiu — o fim de semana, o dia
  // em que ninguém abriu a aba. Mais antigas primeiro.
  const esquecidas = comVencimento
    .filter((v) => v.vencimento < dia && v.status === "pendente" && !v.cobrancaConferidaEm)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));

  // O que vence de hoje até `janela` dias à frente e ainda está pendente —
  // para avisar o cliente antes. Mais próximas primeiro.
  const limite = vencimentoDe(hoje, janela);
  const aVencer = comVencimento
    .filter((v) => v.vencimento >= hoje && v.vencimento <= limite && v.status === "pendente")
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento)
      || nomeDoCliente(dados, a.lojaId).localeCompare(nomeDoCliente(dados, b.lojaId)));

  const faltam = doDia.filter((v) => v.status === "pendente" && !v.cobrancaConferidaEm);
  const pagas = doDia.filter((v) => v.status === "pago");
  const naoPagas = doDia.filter((v) => v.status === "pendente" && v.cobrancaConferidaEm);
  const soma = (lista) => lista.reduce((s, v) => s + v.total, 0);

  const rotuloDia = dia === ontem ? "ontem" : dia === hoje ? "hoje" : `em ${formatarData(dia)}`;

  const botao = (cor, fundo) => ({
    background: fundo, border: "none", borderRadius: 6, padding: "6px 12px", cursor: "pointer",
    color: cor, fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
  });

  const situacao = (v, aVencerModo = false) => {
    if (aVencerModo) {
      return <button onClick={() => conferir(v.id, true)} style={botao(COLORS.verde, COLORS.verdePale)}>✓ Já pagou</button>;
    }
    if (v.status === "pago") {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Badge status="pago" />
          <button onClick={() => desfazer(v.id)} style={{ background: "none", border: "none", padding: 0, color: COLORS.cinza, fontSize: 11, textDecoration: "underline", cursor: "pointer" }}>
            desfazer
          </button>
        </div>
      );
    }
    if (v.cobrancaConferidaEm) {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ background: "#FFEBEE", color: COLORS.vermelho, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
            Não paga · cobrar
          </span>
          <button onClick={() => conferir(v.id, true)} style={botao(COLORS.verde, COLORS.verdePale)}>Pagou agora</button>
          <button onClick={() => desfazer(v.id)} style={{ background: "none", border: "none", padding: 0, color: COLORS.cinza, fontSize: 11, textDecoration: "underline", cursor: "pointer" }}>
            desfazer
          </button>
        </div>
      );
    }
    return (
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => conferir(v.id, true)} style={botao(COLORS.verde, COLORS.verdePale)}>✓ Foi paga</button>
        <button onClick={() => conferir(v.id, false)} style={botao(COLORS.vermelho, "#FFEBEE")}>✕ Não foi paga</button>
      </div>
    );
  };

  const tabela = (vendas, mostrarAtraso = false, aVencerModo = false) => (
    <TabelaRolavel>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
        <thead>
          <tr>
            {["Pedido", "Cliente", "Emissão", "Prazo", "Vencimento", "Valor", "Pagou?"].map((h) => (
              <th key={h} style={{ textAlign: "left", fontSize: 12, color: COLORS.cinza, padding: "0 8px 10px", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vendas.map((v) => {
            const atraso = diasDeAtraso(v.vencimento);
            return (
              <tr key={v.id} style={{ borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
                <td style={{ padding: "11px 8px", fontSize: 13, color: COLORS.cinza }}>#{v.numero ?? "—"}</td>
                <td style={{ padding: "11px 8px", fontSize: 14, color: COLORS.cinzaEscuro }}>{nomeDoCliente(dados, v.lojaId)}</td>
                <td style={{ padding: "11px 8px", fontSize: 13, color: COLORS.cinza, whiteSpace: "nowrap" }}>{formatarData(v.data)}</td>
                <td style={{ padding: "11px 8px", fontSize: 13, color: COLORS.cinza, whiteSpace: "nowrap" }}>{rotuloPrazo(v.prazoDias)}</td>
                <td style={{ padding: "11px 8px", fontSize: 13, color: COLORS.cinzaEscuro, whiteSpace: "nowrap" }}>
                  {formatarData(v.vencimento)}
                  {mostrarAtraso && atraso > 0 && <span style={{ fontSize: 11, color: COLORS.vermelho, fontWeight: 700 }}> · {atraso}d</span>}
                  {aVencerModo && (
                    <span style={{ fontSize: 11, color: atraso === 0 ? COLORS.laranjaEscuro : COLORS.cinza, fontWeight: 700 }}>
                      {" · "}{atraso === 0 ? "hoje" : atraso === -1 ? "amanhã" : `em ${-atraso}d`}
                    </span>
                  )}
                </td>
                <td style={{ padding: "11px 8px", fontSize: 15, fontWeight: 700, color: COLORS.cinzaEscuro, whiteSpace: "nowrap" }}>{brl(v.total)}</td>
                <td style={{ padding: "11px 8px" }}>{situacao(v, aVencerModo)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TabelaRolavel>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <p style={{ margin: 0, fontSize: 14, color: COLORS.cinza, maxWidth: 560 }}>
          Vendas a prazo que venceram {rotuloDia}. Confirme com cada cliente se o pagamento entrou.
        </p>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <Input label="Vencimento em" type="date" value={dia} max={hoje}
            onChange={(e) => setDia(e.target.value || ontem)} />
          {dia !== ontem && <Btn variant="ghost" onClick={() => setDia(ontem)}>Ontem</Btn>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <StatCard icon="alert" label="Falta conferir" value={brl(soma(faltam))} sub={`${faltam.length} venda(s)`} color={COLORS.laranja} />
        <StatCard icon="check" label="Pagas" value={brl(soma(pagas))} sub={`${pagas.length} venda(s)`} color={COLORS.verde} />
        <StatCard icon="close" label="Não pagas · cobrar" value={brl(soma(naoPagas))} sub={`${naoPagas.length} venda(s)`} color={COLORS.vermelho} />
      </div>

      <Card>
        <h4 style={{ margin: "0 0 16px", color: COLORS.cinzaEscuro, fontSize: 15 }}>
          Venceram {rotuloDia}
          <span style={{ fontWeight: 400, color: COLORS.cinza, fontSize: 13 }}> — {formatarData(dia)}</span>
        </h4>
        {doDia.length === 0 ? (
          <div style={{ color: COLORS.cinza, textAlign: "center", padding: 24 }}>
            Nenhuma venda a prazo venceu {rotuloDia}.
          </div>
        ) : (
          tabela(doDia)
        )}
      </Card>

      {esquecidas.length > 0 && (
        <Card>
          <h4 style={{ margin: "0 0 4px", color: COLORS.cinzaEscuro, fontSize: 15 }}>Venceram antes e ninguém conferiu</h4>
          <p style={{ margin: "0 0 16px", fontSize: 12.5, color: COLORS.cinza }}>
            {esquecidas.length} venda(s), {brl(soma(esquecidas))} — as mais antigas primeiro.
          </p>
          {tabela(esquecidas, true)}
        </Card>
      )}

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <h4 style={{ margin: "0 0 4px", color: COLORS.cinzaEscuro, fontSize: 15 }}>A vencer nos próximos dias</h4>
            <p style={{ margin: 0, fontSize: 12.5, color: COLORS.cinza }}>
              {aVencer.length} venda(s), {brl(soma(aVencer))} — de hoje até {formatarData(limite)}.
            </p>
          </div>
          <Select label="Período" value={janela} onChange={(e) => setJanela(Number(e.target.value))}
            options={[3, 7, 15, 30].map((n) => ({ value: n, label: `Próximos ${n} dias` }))} />
        </div>
        {aVencer.length === 0 ? (
          <div style={{ color: COLORS.cinza, textAlign: "center", padding: 24 }}>
            Nenhuma venda a prazo vence nos próximos {janela} dias.
          </div>
        ) : (
          tabela(aVencer, false, true)
        )}
      </Card>
    </div>
  );
};

// ─── App principal ───────────────────────────────────────────────────────────

/** Abas na ordem da barra lateral; quais aparecem depende do papel. */
const TODAS_ABAS = [
  { id: "dashboard", label: "Painel", icon: "dashboard" },
  { id: "vendas", label: "Vendas", icon: "vendas" },
  { id: "romaneio", label: "Romaneio", icon: "caminhao" },
  { id: "notas", label: "Notas Fiscais", icon: "folha" },
  { id: "clientes", label: "Clientes", icon: "clientes" },
  { id: "previsao", label: "Previsão de Pedidos", icon: "alert" },
  { id: "compras", label: "Compras", icon: "fornecedores" },
  { id: "despesas", label: "Despesas", icon: "financeiro" },
  { id: "combustivel", label: "Combustível", icon: "combustivel" },
  { id: "folha", label: "Folha de Pagamento", icon: "folha" },
  { id: "fornecedores", label: "Fornecedores", icon: "fornecedores" },
  { id: "estoque", label: "Estoque", icon: "estoque" },
  { id: "financeiro", label: "Financeiro", icon: "financeiro" },
  { id: "cobranca", label: "Cobrança", icon: "alert" },
  { id: "promotores", label: "Promotores", icon: "rota" },
  { id: "painelTv", label: "Painel TV", icon: "tv" },
  { id: "metas", label: "Metas", icon: "estrela" },
  { id: "minharota", label: "Minha Rota", icon: "rota" },
  { id: "minhaentrega", label: "Minhas Entregas", icon: "caminhao" },
  { id: "arquivo", label: "Arquivo morto", icon: "anexo" },
  { id: "sincronizacao", label: "Sincronização", icon: "sync" },
  { id: "usuarios", label: "Usuários", icon: "usuarios" },
];

/** Abas fixas na barra do rodapé do celular, em ordem de preferência. */
const ABAS_RODAPE = ["dashboard", "vendas", "clientes", "estoque", "minharota", "minhaentrega"];

export default function AppCarvalhoCruz() {
  const { usuario, papel } = useAuth();
  // Promotor e motorista (papéis de campo) não carregam os dados do negócio.
  const campo = ehCampo(papel);
  // ?aba=previsao abre direto numa aba — é o link dos avisos do celular (ntfy).
  const [abaEscolhida, setAba] = useState(() => new URLSearchParams(window.location.search).get("aba") || "dashboard");
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("aba")) return;
    url.searchParams.delete("aba");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }, []);
  const modoTela = useModoTela();
  const ehCelular = modoTela === "celular";
  const trilho = modoTela === "trilho";
  const [menuAberto, setMenuAberto] = useState(false);
  const { dados, setDados, pronto, erroCarga, desfazer, refazer, ultimoApagado, sincronizarAgora, recarregarDaNuvem } = useDados({ ativo: !campo });

  // Ctrl+Z / Ctrl+Y desfazem e refazem exclusões, como no Excel. Dentro de um
  // campo de texto, Ctrl+Z continua sendo o desfazer do próprio campo.
  useEffect(() => {
    const aoTeclar = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const alvo = e.target;
      if (alvo?.closest?.("input, textarea, select, [contenteditable='true']")) return;
      const tecla = e.key.toLowerCase();
      if (tecla === "z" && !e.shiftKey) { e.preventDefault(); desfazer(); }
      else if (tecla === "y" || (tecla === "z" && e.shiftKey)) { e.preventDefault(); refazer(); }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [desfazer, refazer]);

  // Aviso "Desfazer" logo após apagar, que some sozinho.
  const [fechadoAte, setFechadoAte] = useState(0);
  useEffect(() => {
    if (!ultimoApagado) return undefined;
    const t = setTimeout(() => setFechadoAte(ultimoApagado.chave), 12000);
    return () => clearTimeout(t);
  }, [ultimoApagado]);
  const avisoApagado = ultimoApagado && ultimoApagado.chave > fechadoAte ? ultimoApagado : null;

  const navItems = TODAS_ABAS.filter(item => contaVeAba(usuario, item.id));
  // Se o papel mudar enquanto a pessoa está numa aba que ele não alcança
  // (o admin rebaixou o usuário, por exemplo), a tela volta para a primeira
  // aba que o papel atual enxerga — "dashboard" para gestor, "minharota"
  // para promotor, que nem tem "dashboard" na lista.
  const aba = contaVeAba(usuario, abaEscolhida) ? abaEscolhida : (navItems[0]?.id ?? "dashboard");

  const gestor = podeGerenciarCadastros(papel);
  const podeApagar = contaExclui(usuario);

  // Caixa de entrada de comprovantes (api/comprovante.js, Atalho do iPhone).
  // Fica aqui, e não em Despesas, para o contador do menu aparecer em qualquer
  // tela e para um comprovante novo abrir a tela de lançar sozinho.
  const [caixa, setCaixa] = useState([]);
  const [versaoCaixa, setVersaoCaixa] = useState(0);
  const [lancarAgora, setLancarAgora] = useState(null);
  const caminhosUsados = useRef(new Set());
  const caixaVista = useRef(null);
  const veDespesas = contaVeAba(usuario, "despesas");
  useEffect(() => {
    caminhosUsados.current = caminhosDeComprovante(dados);
  }, [dados]);
  const caixaPendente = useMemo(() => {
    const usados = caminhosDeComprovante(dados);
    return caixa.filter((c) => !usados.has(c.caminho));
  }, [caixa, dados]);
  useEffect(() => {
    if (!supabaseConfigurado || !veDespesas || !pronto) return undefined;
    let ativo = true;
    const carregar = () => {
      if (document.visibilityState === "hidden") return;
      listarCaixa().then((lista) => {
        if (!ativo) return;
        setCaixa(lista);
        // Abre sozinho o que chegou desde a última olhada. Na primeira carga
        // (app aberto agora) só vale o que chegou nos últimos 15 minutos — o
        // resto fica no contador do menu, sem pular de tela.
        const primeira = caixaVista.current === null;
        const vistos = caixaVista.current ?? new Set();
        const recente = (c) => c.criadoEm && Date.now() - new Date(c.criadoEm).getTime() < 15 * 60 * 1000;
        const novo = lista.find((c) => !caminhosUsados.current.has(c.caminho) && !vistos.has(c.caminho) && (!primeira || recente(c)));
        caixaVista.current = new Set(lista.map((c) => c.caminho));
        if (novo) {
          setLancarAgora(novo.caminho);
          setAba("despesas");
        }
      }).catch(() => {});
    };
    carregar();
    const intervalo = setInterval(carregar, 20_000);
    document.addEventListener("visibilitychange", carregar);
    return () => {
      ativo = false;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", carregar);
    };
  }, [veDespesas, pronto, versaoCaixa]);

  const paginaTitulo = navItems.find((n) => n.id === aba)?.label;

  // Ao alargar a tela a barra volta a ser fixa; sem zerar isto, a gaveta
  // reapareceria aberta no próximo estreitamento. Ajustar o estado durante o
  // render é o que o React recomenda para "resetar quando algo muda".
  const [eraCelular, setEraCelular] = useState(ehCelular);
  if (eraCelular !== ehCelular) {
    setEraCelular(ehCelular);
    setMenuAberto(false);
  }

  const gavetaAberta = ehCelular && menuAberto;

  // Com a gaveta aberta: Esc fecha e a página atrás não rola junto.
  useEffect(() => {
    if (!gavetaAberta) return undefined;

    const aoTeclar = (evento) => {
      if (evento.key === "Escape") setMenuAberto(false);
    };
    const rolagemAnterior = document.body.style.overflow;

    window.addEventListener("keydown", aoTeclar);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = rolagemAnterior;
    };
  }, [gavetaAberta]);

  if (!pronto) return <Carregando />;

  // O Painel TV toma a tela inteira — sem menu, sem cabeçalho — porque fica
  // espelhado numa TV o dia todo; ninguém deve poder clicar noutra aba nela.
  if (aba === "painelTv") return <PainelTV dados={dados} sincronizarAgora={sincronizarAgora} onSair={() => setAba(navItems[0]?.id ?? "dashboard")} />;

  const negativas = estoquePorFruta(dados).filter((s) => s.estoque < 0).length
    + saldoDosInsumos(dados).filter((s) => s.abaixoDoMinimo).length;
  const emRota = dados.vendas.filter((v) => v.statusEntrega === "em_rota").length;
  const aConferir = cobrancasSemConferir(dados).length;
  const pedidosDoLink = dados.vendas.filter((v) => v.aguardandoConferencia).length;
  // Clientes que passaram do dia de sempre sem pedir (os "esperados hoje"
  // ficam só na tela: ainda dá tempo de o pedido entrar).
  const semPedido = contaVeAba(usuario, "previsao")
    ? alertasUrgentes(painelDePedidos(dados).alertas).length
    : 0;

  const irPara = (id) => {
    setAba(id);
    setMenuAberto(false);
    // Trocar de tela começa do topo — no celular a página rolada da aba
    // anterior deixava a nova aberta no meio.
    window.scrollTo(0, 0);
  };

  const contagemDa = (id) =>
    id === "estoque" ? { n: negativas, cor: COLORS.vermelho }
      : id === "cobranca" ? { n: aConferir, cor: COLORS.vermelho }
        // Comprovantes do Atalho do iPhone esperando virar despesa.
        : id === "despesas" ? { n: caixaPendente.length, cor: COLORS.laranjaEscuro }
        // Só os pedidos novos (feitos pelo link, esperando conferência): o
        // total de vendas a receber já está em Cobrança e Financeiro.
        : id === "vendas" ? { n: pedidosDoLink, cor: COLORS.vermelho }
          : id === "romaneio" ? { n: emRota, cor: COLORS.azul }
            : id === "previsao" ? { n: semPedido, cor: COLORS.laranjaEscuro }
            : { n: 0 };

  // Barra de abas do celular: as telas do dia a dia a um toque; o resto fica
  // no "Menu", que abre a gaveta. Só aparece se o papel enxerga mais de uma.
  const abasRodape = ABAS_RODAPE.filter((id) => navItems.some((n) => n.id === id)).slice(0, 4);
  if (abasRodape.length === 0) abasRodape.push(...navItems.slice(0, 3).map((n) => n.id));
  const mostrarRodape = ehCelular && navItems.length > 1;

  return (
    <div style={{ display: "flex", minHeight: "100dvh", background: COLORS.creme, fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Fundo que escurece a página com a gaveta aberta; tocar nele fecha. */}
      {gavetaAberta && (
        <div
          onClick={() => setMenuAberto(false)}
          aria-hidden="true"
          style={{ position: "fixed", inset: 0, background: "rgba(16,32,24,0.55)", zIndex: 50 }}
        />
      )}

      {/* Sidebar — fixa no desktop, gaveta no celular */}
      <aside
        id="barra-navegacao"
        style={{
          width: trilho ? 76 : 220, background: COLORS.verde, display: "flex", flexDirection: "column",
          flexShrink: 0,
          ...(ehCelular
            ? {
                position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 60,
                paddingTop: "env(safe-area-inset-top)",
                paddingBottom: "env(safe-area-inset-bottom)",
                transform: gavetaAberta ? "none" : "translateX(-100%)",
                // `visibility` tira a gaveta fechada do alcance do teclado e do
                // leitor de tela; ela troca no fim da transição, não no meio.
                visibility: gavetaAberta ? "visible" : "hidden",
                transition: "transform 0.22s ease, visibility 0.22s",
                boxShadow: gavetaAberta ? "0 0 40px rgba(0,0,0,0.4)" : "none",
              }
            // Fixa na altura da tela: rolar uma lista comprida não leva o menu embora.
            : { position: "sticky", top: 0, height: "100dvh" }),
        }}
      >
        {/* Logo */}
        <div style={{ padding: trilho ? "16px 0 14px" : "22px 18px 18px", borderBottom: `1px solid ${COLORS.verdeMarca}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: trilho ? "center" : "flex-start", gap: 11 }}>
            <LogoSelo tamanho={trilho ? 40 : 42} />
            {!trilho && <div>
              <div style={{ color: COLORS.branco, fontWeight: 800, fontSize: 13, lineHeight: 1.2, letterSpacing: 0.3 }}>Carvalho Cruz</div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 10 }}>Hortifruits • Aracaju-SE</div>
            </div>}
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: trilho ? "12px 8px" : "16px 10px" }}>
          {navItems.map((item) => {
            const ativo = aba === item.id;
            const { n, cor } = contagemDa(item.id);
            return (
              <button key={item.id} onClick={() => irPara(item.id)}
                title={trilho ? item.label : undefined}
                aria-label={trilho ? item.label : undefined}
                aria-current={ativo ? "page" : undefined}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 11,
                  justifyContent: trilho ? "center" : "flex-start",
                  padding: trilho ? "12px 0" : ehCelular ? "13px 12px" : "11px 12px",
                  position: "relative",
                  borderRadius: 9, border: "none", cursor: "pointer", marginBottom: 4,
                  background: ativo ? "rgba(255,255,255,0.15)" : "transparent",
                  color: ativo ? COLORS.branco : "rgba(255,255,255,0.65)",
                  fontWeight: ativo ? 700 : 400, fontSize: ehCelular ? 15 : 14, transition: "all 0.15s", textAlign: "left",
                }}
                onMouseEnter={(e) => { if (!ativo) e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
                onMouseLeave={(e) => { if (!ativo) e.currentTarget.style.background = "transparent"; }}>
                <Icon name={item.icon} size={trilho ? 22 : 18} color={ativo ? COLORS.branco : "rgba(255,255,255,0.65)"} />
                {!trilho && item.label}
                {n > 0 && (
                  <span style={{
                    background: cor, color: COLORS.branco, borderRadius: 99, padding: "1px 7px", fontSize: 11, fontWeight: 700,
                    ...(trilho ? { position: "absolute", top: 3, right: 6, padding: "0 5px", fontSize: 10 } : { marginLeft: "auto" }),
                  }}>{n}</span>
                )}
              </button>
            );
          })}
        </nav>

        {!trilho && (
          <div style={{ padding: "14px 18px 16px", borderTop: `1px solid ${COLORS.verdeMarca}` }}>
            <div style={{ color: COLORS.branco, fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {usuario?.nome}
            </div>
            <div style={{ color: COLORS.dourado, fontSize: 10.5, fontWeight: 600, marginTop: 2 }}>
              {rotuloPapel(papel)}
            </div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10.5, marginTop: 6 }}>
              Da nossa fazenda para sua mesa · v1.0
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header */}
        <header style={{ position: "sticky", top: 0, zIndex: 40, paddingTop: "env(safe-area-inset-top)", background: COLORS.branco, borderBottom: `1px solid ${COLORS.cinzaClaro}`, padding: "clamp(11px, 2.5vw, 16px) clamp(13px, 3vw, 28px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
            {ehCelular && (
              <button
                type="button"
                onClick={() => setMenuAberto(true)}
                aria-label="Abrir menu de navegação"
                aria-expanded={gavetaAberta}
                aria-controls="barra-navegacao"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 40, height: 40, flexShrink: 0, marginLeft: -6,
                  background: "none", border: "none", borderRadius: 10, cursor: "pointer",
                }}
              >
                <Icon name="menu" size={22} color={COLORS.cinzaEscuro} />
              </button>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: "clamp(16px, 4vw, 20px)", color: COLORS.cinzaEscuro, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{paginaTitulo}</div>
              <div style={{ fontSize: 12, color: COLORS.cinza, whiteSpace: "nowrap" }}>{dataPorExtenso()}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: ehCelular ? 6 : 10, flexShrink: 0 }}>
            <InstalarApp />
            <SyncBadge onClick={() => irPara("sincronizacao")} />
            <BotaoAtualizar onAtualizar={sincronizarAgora} />
            {/* No celular o espaço é do que se usa: a marca já está na gaveta. */}
            {!ehCelular && <Logo altura={32} />}
            <MenuUsuario />
          </div>
        </header>

        {contaVeAba(usuario, "promotores") && <AvisoRotaIniciada aoVer={() => irPara("promotores")} />}

        {/* Conteúdo */}
        <PuxarParaAtualizar ativo={ehCelular} aoAtualizar={sincronizarAgora}>
          <div style={{
            flex: 1, padding: "clamp(14px, 3vw, 28px)",
            // Espaço para a barra de abas do rodapé não cobrir o fim da página.
            paddingBottom: mostrarRodape ? "calc(84px + env(safe-area-inset-bottom))" : "clamp(14px, 3vw, 28px)",
          }}>
            {aba === "dashboard" && <Dashboard dados={dados} papel={papel} aoVerPrevisao={contaVeAba(usuario, "previsao") ? () => irPara("previsao") : null} />}
            {aba === "vendas" && <Vendas dados={dados} setDados={setDados} podeRemover={podeApagar} />}
            {aba === "romaneio" && <Romaneio dados={dados} setDados={setDados} />}
            {aba === "notas" && <NotasFiscais dados={dados} setDados={setDados} frutas={frutasComEstoque(dados)} podeApagar={podeApagar} />}
            {aba === "clientes" && <Clientes dados={dados} setDados={setDados} podeRemover={podeApagar} />}
            {aba === "previsao" && <PrevisaoPedidos dados={dados} setDados={setDados} />}
            {aba === "compras" && <Compras dados={dados} setDados={setDados} />}
            {aba === "despesas" && <Despesas dados={dados} setDados={setDados} caixa={caixa} aoMudarCaixa={() => setVersaoCaixa((v) => v + 1)} lancarAgora={lancarAgora} aoLancar={() => setLancarAgora(null)} />}
            {aba === "combustivel" && <Combustivel dados={dados} setDados={setDados} podeGerir={gestor} />}
            {aba === "folha" && <FolhaPagamento dados={dados} setDados={setDados} podeGerir={gestor} podeRemover={podeApagar} />}
            {aba === "fornecedores" && <Fornecedores dados={dados} setDados={setDados} />}
            {aba === "estoque" && <Estoque dados={dados} setDados={setDados} podeGerir={gestor} />}
            {aba === "financeiro" && <Financeiro dados={dados} />}
            {aba === "cobranca" && <Cobranca dados={dados} setDados={setDados} />}
            {aba === "promotores" && <Promotores dados={dados} />}
            {aba === "metas" && <Metas dados={dados} setDados={setDados} frutas={frutasDe(dados)} />}
            {aba === "minharota" && <MinhaRota />}
            {aba === "minhaentrega" && <MinhasEntregas />}
            {aba === "usuarios" && <Usuarios dados={dados} setDados={setDados} />}
            {aba === "arquivo" && <ArquivoMorto dados={dados} />}
            {aba === "sincronizacao" && (
              <Sincronizacao
                erroCarga={erroCarga}
                sincronizarAgora={sincronizarAgora}
                recarregarDaNuvem={recarregarDaNuvem}
              />
            )}
          </div>
        </PuxarParaAtualizar>
      </main>

      {avisoApagado && (
        <div role="status" style={{
          position: "fixed", left: "50%", transform: "translateX(-50%)", zIndex: 80,
          bottom: mostrarRodape ? "calc(80px + env(safe-area-inset-bottom))" : 24,
          display: "flex", alignItems: "center", gap: 14, padding: "10px 16px",
          background: COLORS.verde, color: COLORS.branco, borderRadius: 10,
          boxShadow: "0 6px 24px rgba(0,0,0,0.25)", fontSize: 14, maxWidth: "92vw",
        }}>
          <span>{avisoApagado.apagados > 1 ? `${avisoApagado.apagados} registros apagados` : `Apagou: ${avisoApagado.rotulo}`}</span>
          <button type="button" onClick={desfazer}
            style={{ background: COLORS.branco, color: COLORS.verde, border: "none", borderRadius: 6, padding: "5px 12px", fontWeight: 700, cursor: "pointer" }}>
            Desfazer
          </button>
          <button type="button" onClick={() => setFechadoAte(avisoApagado.chave)} aria-label="Fechar"
            style={{ background: "none", border: "none", color: COLORS.branco, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

      {mostrarRodape && (
        <nav aria-label="Atalhos" style={{
          position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 45,
          display: "flex", background: COLORS.branco, borderTop: `1px solid ${COLORS.cinzaClaro}`,
          boxShadow: "0 -2px 12px rgba(0,0,0,0.05)", paddingBottom: "env(safe-area-inset-bottom)",
        }}>
          {[...abasRodape.map((id) => navItems.find((n) => n.id === id)), { id: "__menu", label: "Menu", icon: "menu" }].map((item) => {
            const ehMenu = item.id === "__menu";
            const ativo = ehMenu ? gavetaAberta || !abasRodape.includes(aba) : aba === item.id;
            const { n, cor } = ehMenu ? { n: 0 } : contagemDa(item.id);
            return (
              <button key={item.id} type="button"
                onClick={() => (ehMenu ? setMenuAberto(true) : irPara(item.id))}
                aria-current={!ehMenu && ativo ? "page" : undefined}
                style={{
                  flex: 1, minWidth: 0, minHeight: 58, position: "relative",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3,
                  background: "none", border: "none", cursor: "pointer", padding: "6px 2px",
                  color: ativo ? COLORS.verde : COLORS.cinza, fontSize: 11, fontWeight: ativo ? 700 : 500,
                }}>
                <span style={{
                  display: "flex", padding: "3px 16px", borderRadius: 99,
                  background: ativo ? COLORS.verdePale : "transparent", transition: "background 0.15s",
                }}>
                  <Icon name={item.icon} size={21} color={ativo ? COLORS.verde : COLORS.cinza} />
                </span>
                <span style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ehMenu && !abasRodape.includes(aba) ? paginaTitulo : item.label}
                </span>
                {n > 0 && (
                  <span style={{ position: "absolute", top: 4, left: "calc(50% + 6px)", background: cor, color: COLORS.branco, borderRadius: 99, padding: "0 5px", fontSize: 10, fontWeight: 700 }}>{n}</span>
                )}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}

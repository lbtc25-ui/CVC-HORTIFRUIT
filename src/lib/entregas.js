/**
 * Entregas do motorista — a aba "Minhas Entregas".
 *
 * O motorista não lê as tabelas do negócio. No Supabase, tudo passa por
 * funções do banco (migracao-19-motorista.sql, migracao-36-desfazer-escaneio.sql,
 * migracao-37-iniciar-rota.sql, migracao-39-viagem-rota.sql e
 * migracao-40-iniciar-rota-por-viagem.sql e migracao-46-continuar-rota.sql)
 * que só enxergam as vendas em que
 * ele foi escalado no romaneio. No modo local (sem Supabase) o mesmo é
 * feito sobre o IndexedDB deste aparelho, que é onde os dados moram.
 *
 * Quem é o motorista: a conta dele está ligada a uma pessoa da folha
 * (funcionarios.usuarioId), e o romaneio escala essa pessoa em
 * vendas.motoristaId.
 *
 * O status da entrega anda em 4 passos: pendente → carregando (1ª leitura do
 * QR) → em rota (botão "Iniciar rota") → entregue (2ª leitura do QR). Os 4
 * passos são por VIAGEM (veículo + `viagemRota`), não pelo dia inteiro do
 * motorista: ele pode ter duas viagens abertas ao mesmo tempo (2ª carga do
 * mesmo caminhão, ou dois veículos), e uma não trava nem dispara a outra.
 */

import { modoSupabase } from "./auth";
import { enderecoCompleto } from "./cadastro";
import { ontemISO, vencimentoDe } from "./datas";
import { gravarColecao, lerColecao } from "./db";
import { supabase } from "./supabase";

/**
 * O pedido ainda está no depósito esperando sair? Só se o Romaneio ainda o
 * tem como «pendente» (nem escaneado no caminhão, nem retirado no CD) E o dia
 * dele (o da viagem, se já tem rota) é de ontem em diante.
 *
 * Pedido mais antigo que continua «pendente» é de antes do romaneio existir
 * ou foi entregue sem ninguém ler o QR: a mercadoria já saiu. O Estoque baixa
 * esses pedidos e o Painel TV não os lista como esperando rota — senão a TV
 * mostra «há 27 dias» para um pedido que já foi entregue faz tempo.
 */
export function vendaAindaNoDeposito(venda, ontem = ontemISO()) {
  if (venda.status === "cancelado") return false;
  if ((venda.statusEntrega ?? "pendente") !== "pendente") return false;
  return (venda.rotaData || venda.data || "") >= ontem;
}

const paradaDoDB = (r) => ({
  id: r.id,
  prioridade: r.prioridade === true,
  numero: r.numero,
  ordem: r.ordem_rota,
  viagem: r.viagem_rota ?? 1,
  status: r.status_entrega ?? "pendente",
  saidaCdEm: r.saida_cd_em,
  entregueEm: r.entregue_em,
  loja: r.loja ?? "",
  rede: r.rede ?? "",
  veiculo: r.veiculo ?? "",
  veiculoId: r.veiculo_id ?? "",
  endereco: enderecoCompleto({
    logradouro: r.logradouro, numero: r.numero_endereco, complemento: r.complemento,
    bairro: r.bairro, cidade: r.cidade, uf: r.uf, cep: r.cep,
  }),
});

/** As paradas do motorista no dia, na ordem da rota. */
export async function minhasEntregas(usuarioId, dia) {
  if (modoSupabase) {
    const { data, error } = await supabase.rpc("minhas_entregas", { dia });
    if (error) throw traduzir(error);
    return (data ?? []).map(paradaDoDB);
  }

  const [vendas, lojas, redes, veiculos, funcionarios] = await Promise.all(
    ["vendas", "lojas", "redes", "veiculos", "funcionarios"].map(lerColecao)
  );
  const eu = new Set(funcionarios.filter((f) => f.usuarioId === usuarioId).map((f) => f.id));
  return vendas
    // O dia é o da viagem (rotaData), não o do pedido; prioritário vem primeiro.
    .filter((v) => eu.has(v.motoristaId) && (v.rotaData || v.data) === dia && v.status !== "cancelado")
    .sort((a, b) =>
      Number(Boolean(b.prioridade)) - Number(Boolean(a.prioridade)) ||
      // `ordemRota` só é único DENTRO de uma viagem — sem desempatar por
      // viagem primeiro, a 2ª viagem do dia entraria misturada com a 1ª.
      ((a.viagemRota ?? 1) - (b.viagemRota ?? 1)) ||
      (a.ordemRota ?? 1e9) - (b.ordemRota ?? 1e9) || (a.numero ?? 0) - (b.numero ?? 0))
    .map((v) => {
      const loja = lojas.find((l) => l.id === v.lojaId) ?? {};
      return {
        id: v.id,
        prioridade: Boolean(v.prioridade),
        numero: v.numero,
        ordem: v.ordemRota,
        viagem: v.viagemRota ?? 1,
        status: v.statusEntrega ?? "pendente",
        saidaCdEm: v.saidaCdEm,
        entregueEm: v.entregueEm,
        loja: loja.nome ?? "",
        rede: redes.find((r) => r.id === loja.redeId)?.nome ?? "",
        veiculo: veiculos.find((x) => x.id === v.veiculoId)?.nome ?? "",
        veiculoId: v.veiculoId ?? "",
        endereco: enderecoCompleto(loja),
      };
    });
}

/**
 * O escaneio do QR da nota, igual ao do Romaneio: pendente → carregando (1ª
 * leitura, pedido no caminhão), em rota → entregue (2ª leitura, na loja). A
 * passagem de carregando → em rota não é por QR: é o botão "Iniciar rota"
 * (`iniciarRota`), que só libera com a viagem inteira carregada — ler de
 * novo um pedido ainda carregando é bloqueado como erro.
 * Devolve { status, numero, loja, momento, mudou }.
 */
export async function registrarEscaneio(usuarioId, vendaId) {
  if (modoSupabase) {
    const { data, error } = await supabase.rpc("registrar_escaneio", { venda: vendaId });
    if (error) throw traduzir(error);
    const r = Array.isArray(data) ? data[0] : data;
    return { status: r.status_entrega, numero: r.numero, loja: r.loja, momento: r.momento, mudou: r.mudou };
  }

  const [vendas, lojas, funcionarios] = await Promise.all(["vendas", "lojas", "funcionarios"].map(lerColecao));
  const eu = new Set(funcionarios.filter((f) => f.usuarioId === usuarioId).map((f) => f.id));
  const venda = vendas.find((v) => v.id === vendaId && eu.has(v.motoristaId) && v.status !== "cancelado");
  if (!venda) throw new Error("Esta nota não está nas suas entregas.");

  const loja = lojas.find((l) => l.id === venda.lojaId)?.nome ?? "";
  const agora = new Date().toISOString();
  const status = venda.statusEntrega ?? "pendente";

  if (status === "carregando") {
    throw new Error('Este pedido já foi carregado. Aperte "Iniciar rota" antes de registrar entregas.');
  }

  const proximo = status === "pendente"
    ? { statusEntrega: "carregando" }
    : status === "em_rota" ? { statusEntrega: "entregue", entregueEm: agora } : null;
  if (!proximo) return { status, numero: venda.numero, loja, momento: venda.entregueEm, mudou: false };

  // Pedidos mesclados numa única parada (migracao-39): escanear qualquer um
  // avança o grupo inteiro junto, cada um com sua nota e seu QR.
  const doGrupo = (v) => v.id === venda.id || (venda.grupoEntregaId && v.grupoEntregaId === venda.grupoEntregaId);
  await gravarColecao("vendas", vendas.map((v) => (doGrupo(v) && v.statusEntrega === status ? { ...v, ...proximo } : v)));
  return { status: proximo.statusEntrega, numero: venda.numero, loja, momento: agora, mudou: true };
}

/**
 * O botão "Iniciar rota": pula em bloco carregando → em rota, para uma
 * viagem específica (um veículo + uma viagem daquele dia, não o dia inteiro
 * do motorista — duas viagens abertas ao mesmo tempo, mesmo veículo de novo
 * ou não, são cargas independentes), e só aí grava `saidaCdEm` — é o que o
 * Painel TV usa pra mostrar "Em deslocamento". Só libera com aquela viagem
 * inteira carregada (nenhum pedido dela ainda pendente). Devolve { iniciadas }.
 */
export async function iniciarRota(usuarioId, dia, veiculoId, viagem = 1) {
  if (modoSupabase) {
    const { data, error } = await supabase.rpc("iniciar_rota", { dia, veiculo: veiculoId, viagem });
    if (error) throw traduzir(error);
    const r = Array.isArray(data) ? data[0] : data;
    return { iniciadas: r?.iniciadas ?? 0 };
  }

  const [vendas, funcionarios] = await Promise.all(["vendas", "funcionarios"].map(lerColecao));
  const eu = new Set(funcionarios.filter((f) => f.usuarioId === usuarioId).map((f) => f.id));
  const daViagem = vendas.filter((v) =>
    eu.has(v.motoristaId) && (v.rotaData || v.data) === dia && v.veiculoId === veiculoId
    && (v.viagemRota ?? 1) === viagem && v.status !== "cancelado");
  const pendentes = daViagem.filter((v) => (v.statusEntrega ?? "pendente") === "pendente").length;
  if (pendentes > 0) {
    throw new Error(`Ainda faltam ${pendentes} pedido${pendentes === 1 ? "" : "s"} para carregar no caminhão.`);
  }

  const agora = new Date().toISOString();
  const idsViagem = new Set(daViagem.map((v) => v.id));
  let iniciadas = 0;
  const atualizadas = vendas.map((v) => {
    if (idsViagem.has(v.id) && v.statusEntrega === "carregando") {
      iniciadas += 1;
      return { ...v, statusEntrega: "em_rota", saidaCdEm: agora };
    }
    return v;
  });
  if (iniciadas === 0) throw new Error("Nenhum pedido carregado para iniciar a rota.");

  await gravarColecao("vendas", atualizadas);
  return { iniciadas };
}

/**
 * Desfaz o último escaneio, para quando o motorista leu o QR errado e
 * confirmou: entregue → em_rota, carregando → pendente. Não desfaz `em_rota`
 * (não vem de escaneio: vem do botão "Iniciar rota") nem `retirado_cd` (não
 * vem de escaneio do motorista). Devolve { status, numero, loja, mudou }.
 */
export async function desfazerEscaneio(usuarioId, vendaId) {
  if (modoSupabase) {
    const { data, error } = await supabase.rpc("desfazer_escaneio", { venda: vendaId });
    if (error) throw traduzir(error);
    const r = Array.isArray(data) ? data[0] : data;
    return { status: r.status_entrega, numero: r.numero, loja: r.loja, mudou: r.mudou };
  }

  const [vendas, lojas, funcionarios] = await Promise.all(["vendas", "lojas", "funcionarios"].map(lerColecao));
  const eu = new Set(funcionarios.filter((f) => f.usuarioId === usuarioId).map((f) => f.id));
  const venda = vendas.find((v) => v.id === vendaId && eu.has(v.motoristaId) && v.status !== "cancelado");
  if (!venda) throw new Error("Esta nota não está nas suas entregas.");

  const loja = lojas.find((l) => l.id === venda.lojaId)?.nome ?? "";
  const status = venda.statusEntrega ?? "pendente";
  const anterior = status === "entregue"
    ? { statusEntrega: "em_rota", entregueEm: null }
    : status === "carregando" ? { statusEntrega: "pendente" } : null;
  if (!anterior) return { status, numero: venda.numero, loja, mudou: false };

  const doGrupo = (v) => v.id === venda.id || (venda.grupoEntregaId && v.grupoEntregaId === venda.grupoEntregaId);
  await gravarColecao("vendas", vendas.map((v) => (doGrupo(v) && v.statusEntrega === status ? { ...v, ...anterior } : v)));
  return { status: anterior.statusEntrega, numero: venda.numero, loja, mudou: true };
}

const naoConcluida = (v) => !["entregue", "retirado_cd"].includes(v.statusEntrega ?? "pendente");

/**
 * As viagens dos 7 dias anteriores a `hoje` que o motorista não terminou (algum
 * pedido ainda pendente, carregando ou em rota). Devolve
 * [{ dia, veiculoId, veiculo, viagem, faltam, total }], do dia mais recente
 * para o mais antigo.
 */
export async function rotasNaoConcluidas(usuarioId, hoje) {
  if (modoSupabase) {
    const { data, error } = await supabase.rpc("rotas_nao_concluidas", { hoje });
    if (error) throw traduzir(error);
    return (data ?? []).map((r) => ({
      dia: r.dia, veiculoId: r.veiculo_id ?? "", veiculo: r.veiculo ?? "", viagem: r.viagem ?? 1, faltam: r.faltam, total: r.total,
    }));
  }

  const [vendas, veiculos, funcionarios] = await Promise.all(["vendas", "veiculos", "funcionarios"].map(lerColecao));
  const eu = new Set(funcionarios.filter((f) => f.usuarioId === usuarioId).map((f) => f.id));
  // Mesma janela de 7 dias da função do banco — rota esquecida há mais
  // tempo que isso não volta a aparecer.
  const inicio = vencimentoDe(hoje, -7);
  const grupos = new Map();
  for (const v of vendas) {
    const dia = v.rotaData || v.data;
    if (!eu.has(v.motoristaId) || !v.veiculoId || v.status === "cancelado" || !(dia < hoje) || dia < inicio) continue;
    const chave = `${dia}::${v.veiculoId}::${v.viagemRota ?? 1}`;
    const g = grupos.get(chave) ?? {
      dia, veiculoId: v.veiculoId, veiculo: veiculos.find((x) => x.id === v.veiculoId)?.nome ?? "",
      viagem: v.viagemRota ?? 1, faltam: 0, total: 0,
    };
    g.total += 1;
    if (naoConcluida(v)) g.faltam += 1;
    grupos.set(chave, g);
  }
  return [...grupos.values()]
    .filter((g) => g.faltam > 0)
    .sort((a, b) => (a.dia < b.dia ? 1 : a.dia > b.dia ? -1 : a.viagem - b.viagem));
}

/**
 * "Continuar hoje": passa os pedidos NÃO entregues de uma viagem de um dia
 * anterior para `hoje`, numa viagem nova do mesmo veículo (a próxima livre
 * no dia, pra não misturar com o que o escritório já montou para hoje). Os
 * entregues ficam no dia original. O status de cada pedido não muda — o que
 * já estava em rota segue em rota. Devolve { movidas, novaViagem }.
 */
export async function continuarRota(usuarioId, dia, veiculoId, viagem, hoje) {
  if (modoSupabase) {
    const { data, error } = await supabase.rpc("continuar_rota", { dia, veiculo: veiculoId, viagem, hoje });
    if (error) throw traduzir(error);
    const r = Array.isArray(data) ? data[0] : data;
    return { movidas: r?.movidas ?? 0, novaViagem: r?.nova_viagem ?? 1 };
  }

  if (!(dia < hoje)) throw new Error("Só dá para continuar hoje uma rota de um dia anterior.");
  const [vendas, funcionarios] = await Promise.all(["vendas", "funcionarios"].map(lerColecao));
  const eu = new Set(funcionarios.filter((f) => f.usuarioId === usuarioId).map((f) => f.id));
  const novaViagem = Math.max(0, ...vendas
    .filter((v) => v.rotaData === hoje && v.veiculoId === veiculoId && v.status !== "cancelado")
    .map((v) => v.viagemRota ?? 1)) + 1;
  let movidas = 0;
  const atualizadas = vendas.map((v) => {
    if (eu.has(v.motoristaId) && (v.rotaData || v.data) === dia && v.veiculoId === veiculoId
      && (v.viagemRota ?? 1) === viagem && v.status !== "cancelado" && naoConcluida(v)) {
      movidas += 1;
      return { ...v, rotaData: hoje, viagemRota: novaViagem, rotaArquivada: false };
    }
    return v;
  });
  if (movidas === 0) throw new Error("Não sobrou nenhuma entrega nessa rota.");

  await gravarColecao("vendas", atualizadas);
  return { movidas, novaViagem };
}

/** Link do Google Maps para um endereço. */
export const linkMaps = (endereco) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`;

/**
 * A rota inteira no Google Maps, saindo de onde o motorista está: as paradas
 * que faltam, em ordem. O Maps aceita até 9 pontos intermediários pela URL.
 */
export function linkRotaMaps(enderecos) {
  const pontos = enderecos.filter(Boolean).slice(0, 10);
  if (!pontos.length) return null;
  const destino = pontos[pontos.length - 1];
  const meio = pontos.slice(0, -1);
  return "https://www.google.com/maps/dir/?api=1&travelmode=driving" +
    `&destination=${encodeURIComponent(destino)}` +
    (meio.length ? `&waypoints=${encodeURIComponent(meio.join("|"))}` : "");
}

function traduzir(erro) {
  const texto = String(erro?.message ?? erro);
  if (/minhas_entregas|registrar_escaneio/.test(texto) && /function|função|schema cache/i.test(texto)) {
    return new Error("Falta rodar supabase/migracao-18-motorista.sql no Supabase.");
  }
  if (/desfazer_escaneio/.test(texto) && /function|função|schema cache/i.test(texto)) {
    return new Error("Falta rodar supabase/migracao-36-desfazer-escaneio.sql no Supabase.");
  }
  if (/iniciar_rota/.test(texto) && /function|função|schema cache/i.test(texto)) {
    return new Error("Falta rodar supabase/migracao-37-iniciar-rota.sql e migracao-40-iniciar-rota-por-viagem.sql no Supabase.");
  }
  if (/rotas_nao_concluidas|continuar_rota/.test(texto) && /function|função|schema cache/i.test(texto)) {
    return new Error("Falta rodar supabase/migracao-46-continuar-rota.sql no Supabase.");
  }
  if (/viagem_rota/.test(texto) && /function|função|column|coluna|schema cache/i.test(texto)) {
    return new Error("Falta rodar supabase/migracao-39-viagem-rota.sql no Supabase.");
  }
  if (/Failed to fetch|NetworkError/i.test(texto)) {
    return new Error("Sem conexão com o servidor. Verifique a internet.");
  }
  return new Error(texto);
}

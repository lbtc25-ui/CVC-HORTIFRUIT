/**
 * Rotas de promotor — visitas a estabelecimentos para organizar o expositor,
 * com foto de chegada, antes e depois em cada parada.
 *
 * Ao contrário do resto do app (redes, vendas, estoque...), isto não passa
 * pela fila de sincronização offline: cada envio de foto e cada troca de
 * parada precisa chegar na hora para o gestor acompanhar em tempo real, e
 * fotos não cabem bem no IndexedDB. Por isso fala direto com o Supabase — e
 * só funciona com ele configurado (ver `exigirModoOnline`).
 */

import { modoSupabase } from "./auth";
import { novoId } from "./mappers";
import { supabase } from "./supabase";

const BUCKET = "promotores-fotos";

const CAMPO_FOTO = {
  chegada: "foto_chegada_url",
  antes: "foto_antes_url",
  depois: "foto_depois_url",
};

function exigirModoOnline() {
  if (!modoSupabase) {
    throw new Error(
      "Rotas de promotor precisam do Supabase configurado — é ele que guarda as fotos e avisa os gestores em tempo real."
    );
  }
  return supabase;
}

// ─── Tradução DB → tela ─────────────────────────────────────────────────────

const paradaDoDB = (p) => ({
  id: p.id,
  rotaId: p.rota_id,
  ordem: p.ordem,
  lojaId: p.loja_id,
  estabelecimento: p.estabelecimento,
  endereco: p.endereco ?? "",
  status: p.status,
  chegadaEm: p.chegada_em,
  chegadaLat: p.chegada_lat,
  chegadaLng: p.chegada_lng,
  fotoChegada: p.foto_chegada_url,
  fotoAntes: p.foto_antes_url,
  fotoDepois: p.foto_depois_url,
  concluidaEm: p.concluida_em,
  observacao: p.observacao ?? "",
  prioridade: p.prioridade ?? false,
});

const rotaDoDB = (r) => ({
  id: r.id,
  promotorId: r.promotor_id,
  nome: r.nome,
  data: r.data,
  status: r.status,
  iniciadaEm: r.iniciada_em,
  concluidaEm: r.concluida_em,
  criadoEm: r.criado_em,
  arquivada: r.arquivada ?? false,
  paradas: (r.paradas_rota ?? []).map(paradaDoDB).sort((a, b) => a.ordem - b.ordem),
});

// ─── Leitura ────────────────────────────────────────────────────────────────

/** Contas com papel "promotor" — para montar a rota. Só o gestor enxerga. */
export async function listarPromotores() {
  const client = exigirModoOnline();
  const { data, error } = await client
    .from("perfis")
    .select("id, nome, email, ativo")
    .eq("papel", "promotor")
    .order("nome", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Todas as rotas — painel do gestor. `data` filtra por dia (YYYY-MM-DD). */
export async function listarRotas({ data } = {}) {
  const client = exigirModoOnline();
  let consulta = client
    .from("rotas_promotor")
    .select("*, paradas_rota(*)")
    .order("data", { ascending: false })
    .order("criado_em", { ascending: false });
  if (data) consulta = consulta.eq("data", data);

  const { data: linhas, error } = await consulta;
  if (error) throw error;
  return (linhas ?? []).map(rotaDoDB);
}

/**
 * Rotas de dias anteriores a `hoje` que ficaram pela metade (não iniciadas ou
 * em andamento) — o painel do gestor lista à parte, com a opção de continuar
 * hoje, porque o filtro de data padrão (hoje) as esconderia.
 */
export async function listarRotasNaoConcluidas(hoje) {
  const client = exigirModoOnline();
  const { data, error } = await client
    .from("rotas_promotor")
    .select("*, paradas_rota(*)")
    .in("status", ["pendente", "em_andamento"])
    .lt("data", hoje)
    .order("data", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rotaDoDB);
}

/** Rotas do próprio promotor logado — tela "Minha Rota". */
export async function minhasRotas(promotorId) {
  const client = exigirModoOnline();
  const { data, error } = await client
    .from("rotas_promotor")
    .select("*, paradas_rota(*)")
    .eq("promotor_id", promotorId)
    .neq("status", "cancelada")
    .order("data", { ascending: false })
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rotaDoDB);
}

// ─── Montagem da rota (gestor) ──────────────────────────────────────────────

/**
 * @param {{ promotorId: string, nome: string, data: string,
 *           paradas: { estabelecimento: string, endereco?: string, lojaId?: string, prioridade?: boolean }[] }} campos
 */
export async function criarRota({ promotorId, nome, data, paradas }) {
  const client = exigirModoOnline();
  if (!promotorId) throw new Error("Escolha o promotor.");
  if (!nome?.trim()) throw new Error("Dê um nome para a rota.");
  if (!paradas?.length) throw new Error("Adicione ao menos um estabelecimento.");

  const { data: sessao } = await client.auth.getUser();
  const rotaId = novoId();

  const { error: erroRota } = await client.from("rotas_promotor").insert({
    id: rotaId,
    promotor_id: promotorId,
    nome: nome.trim(),
    data,
    criado_por: sessao?.user?.id ?? null,
  });
  if (erroRota) throw erroRota;

  const linhas = paradas.map((p, i) => ({
    id: novoId(),
    rota_id: rotaId,
    ordem: i + 1,
    loja_id: p.lojaId ?? null,
    estabelecimento: p.estabelecimento.trim(),
    endereco: p.endereco?.trim() || null,
    prioridade: Boolean(p.prioridade),
  }));

  const { error: erroParadas } = await client.from("paradas_rota").insert(linhas);
  if (erroParadas) throw erroParadas;

  return rotaId;
}

/**
 * Edita uma rota já criada: promotor, nome, data e as paradas. Paradas que
 * trazem `id` são as que já existiam (mantêm fotos e horários); sem `id` são
 * novas; as que sumiram da lista são apagadas — só se ainda estiverem
 * pendentes, para não perder o rastro de uma visita já feita.
 *
 * @param {{ id: string, promotorId: string, nome: string, data: string,
 *           paradas: { id?: string, estabelecimento: string, endereco?: string, lojaId?: string, prioridade?: boolean }[] }} campos
 */
export async function atualizarRota({ id, promotorId, nome, data, paradas }) {
  const client = exigirModoOnline();
  if (!promotorId) throw new Error("Escolha o promotor.");
  if (!nome?.trim()) throw new Error("Dê um nome para a rota.");
  if (!paradas?.length) throw new Error("Adicione ao menos um estabelecimento.");

  const { data: rota, error: erroLeitura } = await client
    .from("rotas_promotor")
    .select("status, paradas_rota(id, status)")
    .eq("id", id)
    .single();
  if (erroLeitura) throw erroLeitura;

  const existentes = rota.paradas_rota ?? [];
  const mantidas = new Set(paradas.filter((p) => p.id).map((p) => p.id));
  const removidas = existentes.filter((p) => !mantidas.has(p.id));
  if (removidas.some((p) => p.status !== "pendente")) {
    throw new Error("Não dá para tirar da rota uma parada que o promotor já visitou.");
  }

  if (removidas.length) {
    const { error } = await client.from("paradas_rota").delete().in("id", removidas.map((p) => p.id));
    if (error) throw error;
  }

  // A ordem tem índice único por rota: primeiro afasta as mantidas para
  // posições provisórias, depois grava a ordem final — senão trocar duas de
  // lugar esbarra no índice no meio do caminho.
  const mantidasNaOrdem = paradas.filter((p) => p.id);
  for (const [i, p] of mantidasNaOrdem.entries()) {
    const { error } = await client.from("paradas_rota").update({ ordem: 100000 + i }).eq("id", p.id);
    if (error) throw error;
  }

  const novas = [];
  for (const [i, p] of paradas.entries()) {
    const campos = {
      ordem: i + 1,
      loja_id: p.lojaId ?? null,
      estabelecimento: p.estabelecimento.trim(),
      endereco: p.endereco?.trim() || null,
      prioridade: Boolean(p.prioridade),
    };
    if (p.id) {
      const { error } = await client.from("paradas_rota").update(campos).eq("id", p.id);
      if (error) throw error;
    } else {
      novas.push({ id: novoId(), rota_id: id, ...campos });
    }
  }
  if (novas.length) {
    const { error } = await client.from("paradas_rota").insert(novas);
    if (error) throw error;
  }

  const patch = { promotor_id: promotorId, nome: nome.trim(), data };
  // Rota que já tinha fechado e ganhou parada nova volta a ficar em andamento.
  if (rota.status === "concluida" && novas.length) {
    patch.status = "em_andamento";
    patch.concluida_em = null;
  }
  // E a que estava em andamento e só perdeu as paradas que faltavam, fecha.
  const faltando = existentes.filter((p) => mantidas.has(p.id) && p.status !== "concluida").length + novas.length;
  if (rota.status === "em_andamento" && faltando === 0) {
    patch.status = "concluida";
    patch.concluida_em = new Date().toISOString();
  }
  const { error: erroRota } = await client.from("rotas_promotor").update(patch).eq("id", id);
  if (erroRota) throw erroRota;
}

/** Marca/desmarca uma parada como prioridade — o gestor ajusta mesmo depois de criar a rota. */
export async function definirPrioridade(paradaId, prioridade) {
  const client = exigirModoOnline();
  const { error } = await client.from("paradas_rota").update({ prioridade }).eq("id", paradaId);
  if (error) throw error;
}

/**
 * Arquiva (ou desarquiva) uma rota concluída — some da lista principal do
 * painel sem apagar nada. Precisa da migracao-48-arquivar-rota-promotor.sql.
 */
export async function arquivarRota(id, arquivada = true) {
  const client = exigirModoOnline();
  const { error } = await client.from("rotas_promotor").update({ arquivada }).eq("id", id);
  if (!error) return;
  if (/arquivada/.test(error.message ?? "")) {
    throw new Error("Falta rodar supabase/migracao-48-arquivar-rota-promotor.sql no Supabase para arquivar rotas.");
  }
  throw error;
}

export async function excluirRota(id) {
  const client = exigirModoOnline();
  const { error } = await client.from("rotas_promotor").delete().eq("id", id);
  if (error) throw error;
}

// ─── Execução da rota (promotor) ────────────────────────────────────────────

export async function iniciarRota(id) {
  const client = exigirModoOnline();
  const { error } = await client
    .from("rotas_promotor")
    .update({ status: "em_andamento", iniciada_em: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pendente");
  if (error) throw error;
}

/**
 * Rota que não terminou no dia dela (promotor não visitou todas as paradas):
 * passa para `hoje` e segue de onde parou — as paradas já concluídas ficam
 * como estão, com fotos e horários, e as que faltam continuam na mesma ordem.
 * Tanto o próprio promotor (tela "Minha Rota") quanto o gestor podem fazer
 * isso; a política de update de `rotas_promotor` já cobre os dois.
 */
export async function continuarRotaHoje(id, hoje) {
  const client = exigirModoOnline();
  const { data, error } = await client
    .from("rotas_promotor")
    .update({ data: hoje })
    .eq("id", id)
    .in("status", ["pendente", "em_andamento"])
    .lt("data", hoje)
    .select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Esta rota já foi concluída ou já está no dia de hoje.");
}

/** Localização best-effort — segue sem ela se o navegador negar ou faltar. */
function localizacaoAtual() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

/**
 * Sobe a foto da parada (chegada / antes / depois) e atualiza a linha.
 * A primeira foto ("chegada") também marca a parada como em andamento, grava
 * a hora e, se o navegador liberar, a localização de onde foi tirada.
 */
export async function enviarFotoParada(paradaId, arquivo, tipo) {
  const client = exigirModoOnline();
  if (!CAMPO_FOTO[tipo]) throw new Error(`Tipo de foto inválido: ${tipo}`);

  const { data: sessao } = await client.auth.getUser();
  const uid = sessao?.user?.id;
  if (!uid) throw new Error("Sessão expirada. Entre novamente.");

  const extensao = arquivo.type === "image/png" ? "png" : "jpg";
  const caminho = `${uid}/${paradaId}/${tipo}-${Date.now()}.${extensao}`;

  const { error: erroUpload } = await client.storage
    .from(BUCKET)
    .upload(caminho, arquivo, { contentType: arquivo.type || "image/jpeg", upsert: false });
  if (erroUpload) throw erroUpload;

  const patch = { [CAMPO_FOTO[tipo]]: caminho };
  if (tipo === "chegada") {
    patch.status = "em_andamento";
    patch.chegada_em = new Date().toISOString();
    const geo = await localizacaoAtual();
    if (geo) {
      patch.chegada_lat = geo.lat;
      patch.chegada_lng = geo.lng;
    }
  }

  const { error: erroUpdate } = await client.from("paradas_rota").update(patch).eq("id", paradaId);
  if (erroUpdate) throw erroUpdate;

  return caminho;
}

/** Fecha a parada — o banco recusa (constraint) se faltar alguma das 3 fotos. */
export async function concluirParada(paradaId) {
  const client = exigirModoOnline();
  const { error } = await client
    .from("paradas_rota")
    .update({ status: "concluida", concluida_em: new Date().toISOString() })
    .eq("id", paradaId);
  if (error) throw error;
}

/** URL temporária (1h) para mostrar uma foto do bucket privado. */
export async function urlDaFoto(caminho) {
  if (!caminho) return null;
  const client = exigirModoOnline();
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(caminho, 3600);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

// ─── Ações (evento em loja, divulgação...) ──────────────────────────────────

const acaoDoDB = (a) => ({
  id: a.id,
  promotorId: a.promotor_id,
  titulo: a.titulo,
  descricao: a.descricao ?? "",
  data: a.data,
  hora: a.hora ? String(a.hora).slice(0, 5) : "",
  duracaoMin: a.duracao_min ?? null,
  lojaId: a.loja_id,
  estabelecimento: a.estabelecimento,
  endereco: a.endereco ?? "",
  status: a.status,
  foto: a.foto_url,
  observacao: a.observacao ?? "",
  concluidaEm: a.concluida_em,
  arquivada: a.arquivada ?? false,
});

function erroAcoes(error) {
  if (/acoes_promotor/.test(error?.message ?? "")) {
    return new Error("Falta rodar supabase/migracao-58-acoes-promotor.sql no Supabase para usar as ações.");
  }
  return error;
}

/** Ações lançadas — painel do gestor. `data` filtra por dia (YYYY-MM-DD). */
export async function listarAcoes({ data } = {}) {
  const client = exigirModoOnline();
  let consulta = client
    .from("acoes_promotor")
    .select("*")
    .order("data", { ascending: false })
    .order("criado_em", { ascending: false });
  if (data) consulta = consulta.eq("data", data);
  const { data: linhas, error } = await consulta;
  if (error) throw erroAcoes(error);
  return (linhas ?? []).map(acaoDoDB);
}

/** Ações do próprio promotor — tela "Minha Rota". */
export async function minhasAcoes(promotorId) {
  const client = exigirModoOnline();
  const { data, error } = await client
    .from("acoes_promotor")
    .select("*")
    .eq("promotor_id", promotorId)
    .neq("status", "cancelada")
    .order("data", { ascending: false })
    .order("criado_em", { ascending: false });
  if (error) throw erroAcoes(error);
  return (data ?? []).map(acaoDoDB);
}

/**
 * Cria (sem `id`) ou edita (com `id`) uma ação.
 * @param {{ id?: string, promotorId: string, titulo: string, descricao?: string, data: string,
 *           hora?: string, duracaoMin?: number|null, lojaId?: string|null, estabelecimento: string, endereco?: string }} campos
 */
export async function salvarAcao({ id, promotorId, titulo, descricao, data, hora, duracaoMin, lojaId, estabelecimento, endereco }) {
  const client = exigirModoOnline();
  if (!promotorId) throw new Error("Escolha o promotor.");
  if (!titulo?.trim()) throw new Error("Dê um título para a ação.");
  if (!estabelecimento?.trim()) throw new Error("Informe a loja ou estabelecimento da ação.");

  const campos = {
    promotor_id: promotorId,
    titulo: titulo.trim(),
    descricao: descricao?.trim() || null,
    data,
    hora: hora || null,
    duracao_min: hora && duracaoMin ? Number(duracaoMin) : null,
    loja_id: lojaId ?? null,
    estabelecimento: estabelecimento.trim(),
    endereco: endereco?.trim() || null,
  };

  if (id) {
    const { error } = await client.from("acoes_promotor").update(campos).eq("id", id);
    if (error) throw erroAcoes(error);
    return id;
  }
  const { data: sessao } = await client.auth.getUser();
  const novo = novoId();
  const { error } = await client
    .from("acoes_promotor")
    .insert({ id: novo, ...campos, criado_por: sessao?.user?.id ?? null });
  if (error) throw erroAcoes(error);
  return novo;
}

export async function excluirAcao(id) {
  const client = exigirModoOnline();
  const { error } = await client.from("acoes_promotor").delete().eq("id", id);
  if (error) throw erroAcoes(error);
}

export async function arquivarAcao(id, arquivada = true) {
  const client = exigirModoOnline();
  const { error } = await client.from("acoes_promotor").update({ arquivada }).eq("id", id);
  if (error) throw erroAcoes(error);
}

/** O promotor registra a ação como realizada: foto do evento obrigatória + observação. */
export async function concluirAcao(id, arquivo, observacao) {
  const client = exigirModoOnline();
  const { data: sessao } = await client.auth.getUser();
  const uid = sessao?.user?.id;
  if (!uid) throw new Error("Sessão expirada. Entre novamente.");
  if (!arquivo) throw new Error("Tire a foto do evento para concluir a ação.");

  const extensao = arquivo.type === "image/png" ? "png" : "jpg";
  const caminho = `${uid}/acao-${id}/evento-${Date.now()}.${extensao}`;
  const { error: erroUpload } = await client.storage
    .from(BUCKET)
    .upload(caminho, arquivo, { contentType: arquivo.type || "image/jpeg", upsert: false });
  if (erroUpload) throw erroUpload;

  const { error } = await client
    .from("acoes_promotor")
    .update({
      status: "concluida",
      foto_url: caminho,
      observacao: observacao?.trim() || null,
      concluida_em: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw erroAcoes(error);
}

/** Tópico secreto do ntfy deste usuário (criado na primeira chamada) + servidor onde se inscrever. */
export async function meuTopicoAviso() {
  const client = exigirModoOnline();
  const { data, error } = await client.rpc("meu_topico_aviso");
  if (error) {
    if (/meu_topico_aviso/.test(error.message ?? "")) {
      throw new Error("Falta rodar supabase/migracao-61-aviso-acao-celular.sql no Supabase para os avisos no celular.");
    }
    throw error;
  }
  const linha = Array.isArray(data) ? data[0] : data;
  return { topico: linha?.topico ?? "", servidor: linha?.servidor ?? "https://ntfy.sh" };
}

// ─── Tempo real ─────────────────────────────────────────────────────────────

/**
 * Chama `aoMudar` a cada alteração em rotas ou paradas — é o que faz o painel
 * do gestor andar sozinho conforme o promotor sobe as fotos. Devolve a função
 * que encerra a assinatura.
 */
export function assinarTempoReal(aoMudar) {
  if (!modoSupabase) return () => {};
  const canal = supabase
    // Nome único por assinatura: reutilizar o mesmo canal (remontagem da tela,
    // StrictMode) faz o Supabase recusar novos callbacks `postgres_changes`.
    .channel(`promotores-tempo-real-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "rotas_promotor" }, aoMudar)
    .on("postgres_changes", { event: "*", schema: "public", table: "paradas_rota" }, aoMudar)
    .on("postgres_changes", { event: "*", schema: "public", table: "acoes_promotor" }, aoMudar)
    .subscribe();
  return () => supabase.removeChannel(canal);
}

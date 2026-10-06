// Vercel Function — proxy autenticado para a API do Spedy.
//
// Mesmo motivo do api/omie.js: o app é uma SPA (Vite), então a chave de API
// do Spedy não pode viver em código que vai pro navegador — quem abrisse o
// DevTools teria acesso de emissão de NF-e da conta inteira. Por isso a
// chamada passa por aqui: a chave fica só em variável de ambiente do
// servidor (Vercel → Settings → Environment Variables → SPEDY_API_KEY e
// SPEDY_BASE_URL, sem prefixo VITE_).
//
// Diferente do Omie (uma API "RPC" só, com módulo/recurso/call), o Spedy é
// uma API REST de verdade — path + método HTTP + corpo JSON — então o
// proxy é um repasse mais direto.
//
// Duas formas de chamar:
//   - POST { path, method, body? } — pra chamadas via fetch/JS (criar nota,
//     consultar status). A resposta do Spedy é JSON.
//   - GET ?path=/product-invoices/{id}/pdf — pensado pra virar o `href` de
//     um link clicável (abrir o DANFE numa aba nova sem passar por JS). A
//     resposta do Spedy aqui é o arquivo binário (PDF/XML), não JSON.
//
// SPEDY_BASE_URL troca entre sandbox (https://sandbox-api.spedy.com.br/v1)
// e produção (https://api.spedy.com.br/v1) — mesma lógica de trocar
// OMIE_APP_KEY/SECRET quando for a hora de ir pra produção de verdade.

// PUT: um dos endereços testados para a carta de correção (src/lib/spedy.js).
// Versão mínima das regras da nota que o app precisa mandar para emitir
// NF-e (VERSAO_NFE em src/lib/spedy.js). 3 = código do cadastro (PRD…) e
// saco com fruta e peso na descrição.
const VERSAO_NFE_MINIMA = 3;

const METODOS_PERMITIDOS = new Set(["GET", "POST", "PUT", "DELETE"]);
// Só os recursos que o app realmente usa — não é um proxy genérico pra
// conta inteira do Spedy. "/orders" é o registro da venda no painel da
// Spedy (a nota em si continua saindo por "/product-invoices"). As notas
// recebidas não passam pela Spedy: vêm direto da SEFAZ, pelo api/sefaz.js.
const PREFIXOS_PERMITIDOS = ["/product-invoices", "/orders"];
// ".." ficaria de fora do prefixo depois que a URL fosse normalizada
// ("/orders/../companies" vira "/companies").
const caminhoPermitido = (path) =>
  !path.includes("..") &&
  PREFIXOS_PERMITIDOS.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));

// A CVC emite NF-e por duas contas da Spedy: a dela (SPEDY_API_KEY) e a da
// Carvalho Cruz (SPEDY_API_KEY_CARVALHO), enquanto os produtos ainda são
// faturados pelo CNPJ da Carvalho. O app diz qual conta usar em `emitente`
// ("cvc" | "carvalho_cruz"). Chamadas por id de nota (consultar, DANFE, XML,
// cancelar) vêm sem emitente quando o registro é antigo: nesse caso tenta a
// CVC e, se a Spedy responder 404, a Carvalho.
const CHAVES = {
  cvc: () => process.env.SPEDY_API_KEY,
  carvalho_cruz: () => process.env.SPEDY_API_KEY_CARVALHO,
};

const ordemDeChaves = (emitente) => {
  if (emitente && !CHAVES[emitente]) return null;
  const ordem = emitente ? [emitente] : Object.keys(CHAVES);
  return ordem.filter((e) => CHAVES[e]());
};

export default async function handler(req, res) {
  const baseUrl = process.env.SPEDY_BASE_URL;

  let path, method, body, versaoNfe, emitente;
  if (req.method === "GET") {
    path = req.query?.path;
    emitente = req.query?.emitente;
    method = "GET";
  } else if (req.method === "POST") {
    ({ path, method = "POST", body, versaoNfe, emitente } = req.body ?? {});
  } else {
    res.status(405).json({ erro: "Método não permitido" });
    return;
  }

  const emitentes = ordemDeChaves(emitente);
  if (!baseUrl || !emitentes?.length) {
    res.status(500).json({
      erro: emitentes
        ? "SPEDY_BASE_URL e a chave do emitente (SPEDY_API_KEY / SPEDY_API_KEY_CARVALHO) não estão configurados no servidor"
        : `Emitente "${emitente}" desconhecido`,
    });
    return;
  }

  if (!path || !method) {
    res.status(400).json({ erro: "Informe path (POST também precisa de method)" });
    return;
  }
  if (!METODOS_PERMITIDOS.has(method)) {
    res.status(400).json({ erro: `Método "${method}" não está na lista permitida deste proxy` });
    return;
  }
  if (!caminhoPermitido(path)) {
    res.status(400).json({ erro: `Caminho "${path}" não está na lista permitida deste proxy` });
    return;
  }

  // Trava no servidor para a emissão de NF-e: aparelho com a versão antiga
  // do app aberta (a atualização só entra quando a pessoa aceita o aviso)
  // mandava o id interno do produto como código (a NF 43 saiu com UUID) ou
  // o saco só como "Saco 10 kg". Recusa versão velha e, por garantia, item
  // com código vazio/UUID ou saco sem a fruta na descrição.
  if (method === "POST" && path.split("?")[0] === "/product-invoices") {
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const SACO_GENERICO = /^saco\s*(de\s*)?[\d.,]+\s*kg$/i;
    const itens = Array.isArray(body?.items) ? body.items : [];
    if (!(Number(versaoNfe) >= VERSAO_NFE_MINIMA)) {
      res.status(400).json({
        erro: "Este aparelho está com uma versão antiga do app. Toque em Atualizar no aviso (ou feche e abra o app) e emita a nota de novo.",
      });
      return;
    }
    const ruim = itens.find((i) => !String(i?.code ?? "").trim() || UUID.test(String(i.code))
      || /[^0-9A-Za-z]/.test(String(i.code)) || SACO_GENERICO.test(String(i?.description ?? "").trim()));
    if (ruim) {
      res.status(400).json({
        erro: `Item com código ou descrição fora do padrão ("${ruim.code ?? ""}" — "${ruim.description ?? ""}"). ` +
          "Confira o cadastro do produto (código só com letras e números; saco com a fruta) e emita de novo.",
      });
      return;
    }
  }

  try {
    let resposta;
    for (const e of emitentes) {
      resposta = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          "X-Api-Key": CHAVES[e](),
          ...(method === "GET" ? {} : { "Content-Type": "application/json" }),
        },
        body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
      });
      // Só tenta a próxima conta quando o emitente não foi informado e a
      // nota não existe nesta (404). Qualquer outra resposta é a resposta.
      if (resposta.status !== 404 || emitente) break;
    }

    const contentType = resposta.headers.get("content-type") || "";
    if (contentType.includes("json")) {
      const dados = await resposta.json().catch(() => null);
      res.status(resposta.status).json(dados);
    } else {
      // PDF/XML do DANFE — repassa o arquivo binário como veio, sem tentar
      // interpretar como JSON.
      const buffer = Buffer.from(await resposta.arrayBuffer());
      res.status(resposta.status);
      res.setHeader("Content-Type", contentType || "application/octet-stream");
      res.send(buffer);
    }
  } catch (erro) {
    res.status(502).json({ erro: "Falha ao comunicar com o Spedy", detalhe: String(erro) });
  }
}

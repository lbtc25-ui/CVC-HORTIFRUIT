// Vercel Function — proxy autenticado para a API do Omie.
//
// O app é uma SPA (Vite): tudo que começa com VITE_ vai embutido no
// JavaScript que qualquer visitante baixa. O APP_KEY/APP_SECRET do Omie não
// pode estar lá — quem abrisse o DevTools teria acesso de API à conta do
// Omie inteira (clientes, financeiro, tudo). Por isso a chamada passa por
// aqui: as credenciais ficam só na variável de ambiente do servidor
// (Vercel → Settings → Environment Variables → OMIE_APP_KEY e
// OMIE_APP_SECRET, sem prefixo VITE_), e o front-end manda módulo/recurso/
// call/param — o formato documentado pelo próprio Omie.
//
// Toda API do Omie segue o mesmo envelope, então este proxy serve tanto
// para emitir/consultar NF-e quanto para qualquer outro módulo (clientes,
// contas a receber etc.) — não é preciso um arquivo por chamada.
//
// Formato (igual ao "Omie APIs – Quick Start" oficial):
//   POST https://app.omie.com.br/api/v1/{modulo}/{recurso}/
//   { "call": "...", "app_key": "...", "app_secret": "...", "param": [...] }
//
// O front-end chama esta rota com:
//   { modulo: "produtos", recurso: "nfe", call: "IncluirNFe", param: [...] }

const MODULOS_PERMITIDOS = new Set(["produtos", "geral"]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ erro: "Método não permitido" });
    return;
  }

  const appKey = process.env.OMIE_APP_KEY;
  const appSecret = process.env.OMIE_APP_SECRET;
  if (!appKey || !appSecret) {
    res.status(500).json({ erro: "OMIE_APP_KEY/OMIE_APP_SECRET não configurados no servidor" });
    return;
  }

  const { modulo, recurso, call, param } = req.body ?? {};
  if (!modulo || !recurso || !call || !Array.isArray(param)) {
    res.status(400).json({ erro: "Envie { modulo, recurso, call, param: [...] } no corpo da requisição" });
    return;
  }
  if (!MODULOS_PERMITIDOS.has(modulo)) {
    res.status(400).json({ erro: `Módulo "${modulo}" não está na lista permitida deste proxy` });
    return;
  }

  try {
    const resposta = await fetch(`https://app.omie.com.br/api/v1/${modulo}/${recurso}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ call, app_key: appKey, app_secret: appSecret, param }),
    });
    const dados = await resposta.json();
    res.status(resposta.status).json(dados);
  } catch (erro) {
    res.status(502).json({ erro: "Falha ao comunicar com o Omie", detalhe: String(erro) });
  }
}

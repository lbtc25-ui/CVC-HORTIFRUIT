/**
 * Papéis de acesso e o que cada um enxerga.
 *
 * Isto controla apenas a interface. Quem de fato barra o acesso aos dados é o
 * RLS do Postgres (supabase/auth.sql) — as regras aqui e lá foram escritas
 * para dizer a mesma coisa; se mudar uma, mude a outra.
 */

export const PAPEIS = {
  socio_master: {
    valor: "socio_master",
    label: "Sócio Master",
    descricao: "Acesso total: compra, venda, estoque, financeiro e o cadastro de usuários.",
    cor: "#2D6A4F",
  },
  assistente_administrativo: {
    valor: "assistente_administrativo",
    label: "Assistente Administrativo",
    descricao: "Vendas, clientes, fornecedores, estoque e financeiro. Não exclui registros nem gerencia usuários.",
    cor: "#457B9D",
  },
  promotor: {
    valor: "promotor",
    label: "Promotor",
    descricao: "Só a própria rota de visitas: iniciar, chegar e enviar as fotos de cada loja. Não vê venda, cliente, estoque nem financeiro.",
    cor: "#F4A261",
  },
  motorista: {
    valor: "motorista",
    label: "Motorista",
    descricao: "Só as próprias entregas do romaneio: a ordem das paradas, o endereço no Maps e a câmera para ler o QR das notas. Não vê valores, clientes nem o resto do sistema.",
    cor: "#1E7FB8",
  },
};

export const LISTA_PAPEIS = Object.values(PAPEIS);

/** Papéis que a tela Usuários oferece ao criar acesso — master fica de fora. */
export const PAPEIS_CADASTRAVEIS = [PAPEIS.assistente_administrativo, PAPEIS.promotor, PAPEIS.motorista];

export const rotuloPapel = (papel) => PAPEIS[papel]?.label ?? "Sem papel";

/**
 * Abas da barra lateral liberadas para cada papel.
 *
 * "compras" só para o sócio master — é o custo da mercadoria, o número que
 * decide se a venda deu lucro. As demais abas de lançamento (despesas,
 * combustível) seguem o mesmo alcance de "financeiro": os dois papéis lançam.
 */
const ABAS = {
  socio_master: ["dashboard", "vendas", "romaneio", "notas", "clientes", "previsao", "compras", "frutas", "despesas", "combustivel", "folha", "fornecedores", "estoque", "financeiro", "cobranca", "promotores", "painelTv", "metas", "arquivo", "sincronizacao", "usuarios"],
  assistente_administrativo: ["dashboard", "vendas", "romaneio", "notas", "clientes", "previsao", "despesas", "combustivel", "folha", "fornecedores", "estoque", "financeiro", "cobranca", "promotores", "painelTv", "sincronizacao"],
  // O promotor só enxerga a própria rota — nada de venda, cliente, estoque
  // ou financeiro, nem a fila de sincronização geral do resto do app.
  promotor: ["minharota"],
  // O motorista só enxerga as entregas em que foi escalado no romaneio.
  motorista: ["minhaentrega"],
};

export const podeVerAba = (papel, aba) => (ABAS[papel] ?? []).includes(aba);

export const abasDoPapel = (papel) => ABAS[papel] ?? [];

/** Só o sócio master apaga cadastros; o assistente cria e edita, mas não remove. */
export const podeExcluir = (papel) => papel === "socio_master";

// ─── Ajuste fino por pessoa ─────────────────────────────────────────────────
//
// O papel dá o padrão; o sócio master pode, na aba Usuários, tirar ou pôr
// abas e liberar a exclusão de registros para um assistente específico
// (perfis.abas e perfis.pode_excluir, da migracao-17). Só o assistente é
// ajustável: o sócio master vê tudo sempre e o promotor só a própria rota.
// "usuarios" nunca sai do sócio master — é quem cuida do acesso dos outros.

/** Nome de cada aba, como aparece na barra lateral. */
export const ROTULO_ABA = {
  dashboard: "Painel", vendas: "Vendas", romaneio: "Romaneio", notas: "Notas Fiscais",
  clientes: "Clientes", previsao: "Previsão de Pedidos", compras: "Compras", frutas: "Frutas", despesas: "Despesas", combustivel: "Combustível",
  folha: "Folha de Pagamento", fornecedores: "Fornecedores", estoque: "Estoque",
  financeiro: "Financeiro", cobranca: "Cobrança", promotores: "Promotores", painelTv: "Painel TV", metas: "Metas", arquivo: "Arquivo morto",
  minharota: "Minha Rota", minhaentrega: "Minhas Entregas", sincronizacao: "Sincronização", usuarios: "Usuários",
};

/**
 * Abas que só o sócio master vê, sem ajuste por pessoa: "usuarios" (quem
 * cuida do acesso) e "metas" (quem define as metas — o RLS da migracao-44 só
 * deixa o sócio ler e gravar, então liberar para um assistente daria tela vazia).
 */
const ABAS_SO_DO_SOCIO = ["usuarios", "metas", "arquivo"];

/** Abas que dá para ligar ou desligar para um papel — vazio se ele não é ajustável. */
export const abasAjustaveis = (papel) =>
  papel === "assistente_administrativo"
    ? ABAS.socio_master.filter((a) => !ABAS_SO_DO_SOCIO.includes(a))
    : [];

/** As abas que esta conta vê: as escolhidas para ela ou, sem escolha, as do papel. */
export const abasDaConta = (conta) => {
  const ajustaveis = abasAjustaveis(conta?.papel);
  if (!ajustaveis.length || !Array.isArray(conta?.abas)) return abasDoPapel(conta?.papel);
  return ajustaveis.filter((a) => conta.abas.includes(a));
};

export const contaVeAba = (conta, aba) => abasDaConta(conta).includes(aba);

/** Se esta conta apaga registros (vendas, clientes, pagamentos…). */
export const contaExclui = (conta) =>
  conta?.papel === "socio_master" || (conta?.papel === "assistente_administrativo" && conta?.podeExcluir === true);

/** Os dois papéis cadastram clientes, fornecedores e produtos. */
export const podeGerenciarCadastros = (papel) => papel === "socio_master" || papel === "assistente_administrativo";

export const podeGerenciarUsuarios = (papel) => papel === "socio_master";

export const ehPromotor = (papel) => papel === "promotor";

export const ehMotorista = (papel) => papel === "motorista";

/**
 * Papéis de campo (promotor e motorista) não carregam os dados do negócio: o
 * RLS nem deixaria, e a sincronização acabaria apagando a cópia local de um
 * aparelho compartilhado com o escritório.
 */
export const ehCampo = (papel) => ehPromotor(papel) || ehMotorista(papel);

// ─── Contas master ──────────────────────────────────────────────────────────

/**
 * Os donos do sistema. São sempre sócio master e nenhum outro sócio
 * consegue rebaixá-los, desativá-los ou removê-los — é a garantia de que a
 * distribuidora nunca fica sem quem mande no acesso.
 *
 * A mesma lista existe em supabase/auth.sql, na função `proteger_admins`.
 * Mudou aqui, mude lá.
 */
export const EMAILS_MASTER = [
  "l.btc25@gmail.com",
  "carlos_cruz_neto@hotmail.com",
];

export const eMaster = (email) =>
  EMAILS_MASTER.includes(String(email ?? "").trim().toLowerCase());

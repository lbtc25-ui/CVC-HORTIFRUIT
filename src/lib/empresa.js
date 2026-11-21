/**
 * Dados da CVC — do comprovante de CNPJ (18/09/2026), da Inscrição Municipal
 * (18/09/2026), da Inscrição Estadual (28/09/2026) e do contrato social (21/08/2026).
 */
export const EMPRESA = {
  razaoSocial: "CVC Agronegócios Ltda",
  nomeFantasia: "CVC Frutas",
  nomeNoApp: "CVC Hortifruit",
  cnpj: "69.196.231/0001-19",
  inscricaoEstadual: "272620297",
  inscricaoMunicipal: "2430030",
  endereco: "Av. Tiradentes, 659, América, Aracaju-SE, 49082-600",
  telefone: "(79) 9802-7777",
  naturezaJuridica: "206-2 - Sociedade Empresária Limitada",
  porte: "ME",
  abertura: "2026-09-01",
  inicioAtividades: "2026-08-21",
  capitalSocial: 500000,
  cnaePrincipal: "4633-8/01 - Comércio atacadista de frutas, verduras, raízes, tubérculos, hortaliças e legumes frescos",
  cnaesSecundarios: [
    "1033-3/02 - Fabricação de sucos de frutas, hortaliças e legumes, exceto concentrados",
    "4639-7/01 - Comércio atacadista de produtos alimentícios em geral",
    "4724-5/00 - Comércio varejista de hortifrutigranjeiros",
    "4729-6/99 - Comércio varejista de produtos alimentícios em geral ou especializado em produtos alimentícios não especificados anteriormente",
    "4930-2/01 - Transporte rodoviário de carga, exceto produtos perigosos e mudanças, municipal",
    "4930-2/02 - Transporte rodoviário de carga, exceto produtos perigosos e mudanças, intermunicipal, interestadual e internacional",
    "5211-7/99 - Depósitos de mercadorias para terceiros, exceto armazéns gerais e guarda-móveis",
  ],
  /** Os três administram isolada ou conjuntamente, com 1/3 das quotas cada. */
  socios: ["Alexandre Vieira Seixas Fonseca", "Carlos Rodrigues Porto da Cruz Neto", "Lucas Benjamin Tenório de Carvalho"],
};

const soDigitos = (v) => String(v ?? "").replace(/\D/g, "");

/** Inscrição municipal do declarante, quando ele é a CVC (o XML da NF-e não traz). */
export const inscricaoMunicipalDe = (cnpj) =>
  soDigitos(cnpj) === soDigitos(EMPRESA.cnpj) ? EMPRESA.inscricaoMunicipal : "";

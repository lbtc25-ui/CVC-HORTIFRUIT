/** Paleta da marca — compartilhada entre os módulos e os componentes novos. */
export const COLORS = {
  verde: "#2D6A4F",
  verdeClaro: "#52B788",
  verdePale: "#D8F3DC",
  laranja: "#F4A261",
  laranjaEscuro: "#E76F51",
  creme: "#FAFAF7",
  cinzaClaro: "#F0F0EB",
  cinza: "#9A9A8A",
  cinzaEscuro: "#4A4A40",
  branco: "#FFFFFF",
  vermelho: "#E63946",
  azul: "#457B9D",

  // Tons medidos na logo original (brand/logo.jpeg). Ficam separados dos de
  // cima — que são os da interface — e servem para o que encosta na marca:
  // o fio dourado em volta do símbolo, a assinatura da fazenda no rodapé.
  laranjaMarca: "#E4761A",
  verdeMarca: "#1D4530",
  dourado: "#C2A36B",
  douradoClaro: "#EDE3CE",
};

export const FONTE = "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const brl = (v) => moeda.format(Number(v) || 0);

export default COLORS;

const quilos = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
/** "1.720,5 kg" — o quilo é a unidade de controle de todo o negócio. */
export const kg = (v) => `${quilos.format(Number(v) || 0)} kg`;

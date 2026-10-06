import { useSyncExternalStore } from "react";

/**
 * Largura a partir da qual a barra lateral completa (220px) ainda deixa espaço
 * decente para o conteúdo.
 */
export const LARGURA_MINIMA_BARRA_FIXA = 900;

/**
 * Entre esta largura e a de cima (tablet em pé: iPad 768–834px, Galaxy Tab…)
 * a barra fica fixa, mas só com os ícones — o menu continua a um toque, sem
 * roubar 220px de uma tela que já é estreita. Abaixo disso é celular: gaveta
 * e barra de abas no rodapé.
 */
export const LARGURA_MINIMA_TRILHO = 700;

const CONSULTA_COMPLETA = `(min-width: ${LARGURA_MINIMA_BARRA_FIXA}px)`;
const CONSULTA_TRILHO = `(min-width: ${LARGURA_MINIMA_TRILHO}px)`;

const assinar = (aoMudar) => {
  const consultas = [window.matchMedia(CONSULTA_COMPLETA), window.matchMedia(CONSULTA_TRILHO)];
  consultas.forEach((c) => c.addEventListener("change", aoMudar));
  return () => consultas.forEach((c) => c.removeEventListener("change", aoMudar));
};

const lerDaTela = () => {
  if (window.matchMedia(CONSULTA_COMPLETA).matches) return "completo";
  if (window.matchMedia(CONSULTA_TRILHO).matches) return "trilho";
  return "celular";
};

// O app não roda no servidor, mas o React exige este retorno; "completo" faz o
// primeiro render assumir a barra fixa.
const lerForaDoNavegador = () => "completo";

/**
 * Como a navegação se arranja nesta tela: "completo" (barra lateral com
 * nomes), "trilho" (barra só de ícones, tablet) ou "celular" (gaveta + abas
 * no rodapé).
 *
 * O layout do app é feito com estilo inline — não há classe CSS onde pendurar
 * uma media query —, então a decisão vem do matchMedia. `useSyncExternalStore`
 * lê o valor no próprio render, sem o vaivém de um efeito que chama setState.
 */
export function useModoTela() {
  return useSyncExternalStore(assinar, lerDaTela, lerForaDoNavegador);
}

/** `true` quando a tela é estreita demais para qualquer barra lateral fixa. */
export function useEhCelular() {
  return useModoTela() === "celular";
}

export default useEhCelular;

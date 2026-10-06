import { useState } from "react";

import { FILTROS_PADRAO, intervaloDoPeriodo } from "../lib/analise";

/**
 * Filtros de uma aba, lembrados enquanto o app está aberto: ir em Vendas e
 * voltar ao Painel não perde o recorte montado para a reunião.
 */
export function useFiltros(chave, inicial = {}) {
  const [filtros, setFiltrosState] = useState(() => {
    const base = { ...FILTROS_PADRAO, ...inicial };
    try {
      const salvo = sessionStorage.getItem(`cc-filtros-${chave}`);
      return salvo ? { ...base, ...JSON.parse(salvo) } : base;
    } catch {
      return base;
    }
  });
  const setFiltros = (mudar) => {
    setFiltrosState((f) => {
      const novo = typeof mudar === "function" ? mudar(f) : { ...f, ...mudar };
      try { sessionStorage.setItem(`cc-filtros-${chave}`, JSON.stringify(novo)); } catch { /* sem armazenamento */ }
      return novo;
    });
  };
  const limpar = () => setFiltros({ ...FILTROS_PADRAO, ...inicial });
  const intervalo = intervaloDoPeriodo(filtros.periodo, filtros.de, filtros.ate);
  return { filtros, setFiltros, limpar, intervalo };
}

export default useFiltros;

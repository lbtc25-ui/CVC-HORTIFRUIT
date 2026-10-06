import { createContext, useContext } from "react";

/**
 * Contexto de sessão. Fica separado do provider por causa do Fast Refresh:
 * um arquivo que exporta componente e não-componente ao mesmo tempo perde o
 * hot reload (regra react-refresh/only-export-components).
 */
export const AuthContext = createContext(null);

export function useAuth() {
  const valor = useContext(AuthContext);
  if (!valor) throw new Error("useAuth precisa estar dentro de <AuthProvider>.");
  return valor;
}

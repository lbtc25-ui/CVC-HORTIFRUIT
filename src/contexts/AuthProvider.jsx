import { useCallback, useEffect, useMemo, useState } from "react";

import {
  MODO,
  criarPrimeiroAdmin,
  entrar as entrarNoApp,
  observarAuth,
  precisaPrimeiroAcesso,
  sair as sairDoApp,
  sessaoAtual,
} from "../lib/auth";
import { AuthContext } from "./auth-context";

/**
 * Descobre quem está logado na abertura do app e mantém esse estado.
 * Enquanto `pronto` for false, nada do app é renderizado — evita a piscada da
 * tela de login para quem já tem sessão salva.
 */
export default function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [pronto, setPronto] = useState(false);
  const [primeiroAcesso, setPrimeiroAcesso] = useState(false);

  useEffect(() => {
    let ativo = true;

    (async () => {
      try {
        const sessao = await sessaoAtual();
        if (!ativo) return;
        setUsuario(sessao);
        if (!sessao) setPrimeiroAcesso(await precisaPrimeiroAcesso());
      } catch {
        if (ativo) setUsuario(null);
      } finally {
        if (ativo) setPronto(true);
      }
    })();

    // Logout feito em outra aba derruba esta também.
    const parar = observarAuth((sessao) => {
      if (ativo) setUsuario(sessao);
    });

    return () => {
      ativo = false;
      parar();
    };
  }, []);

  const entrar = useCallback(async (credenciais) => {
    const sessao = await entrarNoApp(credenciais);
    setUsuario(sessao);
    setPrimeiroAcesso(false);
    return sessao;
  }, []);

  const criarAdminInicial = useCallback(async (dados) => {
    await criarPrimeiroAdmin(dados);
    const sessao = await entrarNoApp({ email: dados.email, senha: dados.senha });
    setUsuario(sessao);
    setPrimeiroAcesso(false);
    return sessao;
  }, []);

  const sair = useCallback(async () => {
    await sairDoApp();
    setUsuario(null);
    setPrimeiroAcesso(await precisaPrimeiroAcesso());
  }, []);

  /** Aplica na tela uma mudança de perfil feita pelo próprio usuário. */
  const atualizarUsuario = useCallback((patch) => {
    setUsuario((atual) => (atual ? { ...atual, ...patch } : atual));
  }, []);

  const valor = useMemo(
    () => ({
      usuario,
      papel: usuario?.papel ?? null,
      pronto,
      primeiroAcesso,
      modo: MODO,
      entrar,
      sair,
      criarAdminInicial,
      atualizarUsuario,
    }),
    [usuario, pronto, primeiroAcesso, entrar, sair, criarAdminInicial, atualizarUsuario]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

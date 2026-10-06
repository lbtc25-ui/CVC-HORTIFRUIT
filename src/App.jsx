import AtualizacaoPWA from "./components/AtualizacaoPWA";
import Carregando from "./components/Carregando";
import ErrorBoundary from "./components/ErrorBoundary";
import AuthProvider from "./contexts/AuthProvider";
import { useAuth } from "./contexts/auth-context";
import AppCarvalhoCruz from "./distribuidora-carvalho-cruz.jsx";
import Login from "./pages/Login";
import PedidoCliente from "./pages/PedidoCliente";
import PedidoGeral from "./pages/PedidoGeral";
import PedidoRede from "./pages/PedidoRede";
import Resgate from "./pages/Resgate";
import { linkDoCaminho } from "./lib/pedidoCliente";

/** Sem sessão, ninguém passa da tela de login. */
function Portao() {
  const { usuario, pronto } = useAuth();

  if (!pronto) return <Carregando texto="Verificando acesso…" />;
  return usuario ? <AppCarvalhoCruz /> : <Login />;
}

/**
 * Casca do aplicativo: registro do service worker (PWA), proteção contra erros
 * de render e, dentro, o login e o app de gestão com seus módulos.
 */
export default function App() {
  // O resgate também fica fora do login: serve justamente quando o banco da
  // nuvem está fora do ar e ninguém consegue entrar.
  if (/^\/resgate\/?$/.test(window.location.pathname)) {
    return (
      <ErrorBoundary>
        <Resgate />
      </ErrorBoundary>
    );
  }

  // O link de pedido é público: o cliente não passa pelo login.
  const linkPedido = linkDoCaminho(window.location.pathname);
  if (linkPedido) {
    return (
      <ErrorBoundary>
        {linkPedido.tipo === "geral"
          ? <PedidoGeral token={linkPedido.token} />
          : linkPedido.tipo === "rede"
            ? <PedidoRede token={linkPedido.token} />
            : <PedidoCliente token={linkPedido.token} />}
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Portao />
      </AuthProvider>
      <AtualizacaoPWA />
    </ErrorBoundary>
  );
}

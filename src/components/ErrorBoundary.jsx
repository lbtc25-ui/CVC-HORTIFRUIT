import { Component } from "react";
import Logo from "./Logo";
import { COLORS, FONTE } from "../lib/tema";

/**
 * Impede que um erro de render derrube o app inteiro na rua — o vendedor vê
 * uma tela com o motivo e um botão de recarregar, não uma página em branco.
 */
export default class ErrorBoundary extends Component {
  state = { erro: null };

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    console.error("Erro não tratado:", erro, info);
  }

  render() {
    if (!this.state.erro) return this.props.children;

    return (
      <div style={{ fontFamily: FONTE, minHeight: "100vh", background: COLORS.creme, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: COLORS.branco, borderRadius: 14, padding: 28, maxWidth: 460, boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
          <Logo altura={54} style={{ marginBottom: 14 }} />
          <h1 style={{ fontSize: 19, margin: "0 0 8px", color: COLORS.cinzaEscuro }}>Algo deu errado</h1>
          <p style={{ fontSize: 14, color: COLORS.cinza, margin: "0 0 18px", lineHeight: 1.5 }}>
            Seus dados continuam salvos neste aparelho. Recarregue para voltar ao app.
          </p>
          <pre style={{ fontSize: 11, color: COLORS.vermelho, background: COLORS.cinzaClaro, padding: 12, borderRadius: 8, overflowX: "auto", margin: "0 0 18px" }}>
            {String(this.state.erro?.message ?? this.state.erro)}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ background: COLORS.verde, color: COLORS.branco, border: "none", borderRadius: 9, padding: "11px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }
}

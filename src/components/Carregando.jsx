import Logo from "./Logo";
import { COLORS, FONTE } from "../lib/tema";

export default function Carregando({ texto = "Carregando dados…" }) {
  return (
    <div style={{ fontFamily: FONTE, minHeight: "100vh", background: COLORS.creme, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 24 }}>
      <Logo variante="assinatura" altura={168} />
      <div style={{ fontSize: 13, color: COLORS.cinza }}>{texto}</div>
    </div>
  );
}

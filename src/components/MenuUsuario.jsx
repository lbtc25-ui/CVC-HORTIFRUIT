import { useEffect, useRef, useState } from "react";

import { useAuth } from "../contexts/auth-context";
import { alterarMinhaSenha } from "../lib/auth";
import { rotuloPapel } from "../lib/permissoes";
import { validarSenha } from "../lib/senha";
import { COLORS } from "../lib/tema";
import { Btn, Icon, InputSenha, Modal } from "./ui";

const iniciais = (nome = "") =>
  nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("") || "?";

const ItemMenu = ({ icone, children, onClick, cor = COLORS.cinzaEscuro }) => (
  <button onClick={onClick}
    style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", background: "none", border: "none", padding: "9px 14px", cursor: "pointer", fontSize: 13.5, color: cor, textAlign: "left", fontWeight: 500 }}
    onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.creme)}
    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
    <Icon name={icone} size={16} color={cor} />
    {children}
  </button>
);

/**
 * Avatar do cabeçalho: mostra quem está logado, permite trocar a própria senha
 * e sair. É o único lugar do app onde a pessoa mexe na própria conta.
 */
export default function MenuUsuario() {
  const { usuario, sair } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [modalSenha, setModalSenha] = useState(false);
  const [form, setForm] = useState({ atual: "", nova: "", confirmacao: "" });
  const [estado, setEstado] = useState({ ocupado: false, erro: null, ok: false });
  const caixa = useRef(null);

  // Fecha ao clicar fora ou apertar Esc — comportamento esperado de dropdown.
  useEffect(() => {
    if (!aberto) return undefined;
    const foraDaCaixa = (e) => {
      if (caixa.current && !caixa.current.contains(e.target)) setAberto(false);
    };
    const tecla = (e) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", foraDaCaixa);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", foraDaCaixa);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  if (!usuario) return null;

  const abrirModalSenha = () => {
    setAberto(false);
    setForm({ atual: "", nova: "", confirmacao: "" });
    setEstado({ ocupado: false, erro: null, ok: false });
    setModalSenha(true);
  };

  const salvarSenha = async () => {
    const problema = validarSenha(form.nova);
    if (problema) return setEstado((s) => ({ ...s, erro: problema }));
    if (form.nova !== form.confirmacao) {
      return setEstado((s) => ({ ...s, erro: "As senhas não conferem." }));
    }

    setEstado({ ocupado: true, erro: null, ok: false });
    try {
      await alterarMinhaSenha({ senhaAtual: form.atual, novaSenha: form.nova });
      setEstado({ ocupado: false, erro: null, ok: true });
      setForm({ atual: "", nova: "", confirmacao: "" });
    } catch (err) {
      setEstado({ ocupado: false, erro: String(err?.message ?? err), ok: false });
    }
  };

  return (
    <div ref={caixa} style={{ position: "relative" }}>
      <button onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu" aria-expanded={aberto} title={usuario.email}
        style={{ width: 36, height: 36, borderRadius: 10, background: COLORS.verdePale, border: "none", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: COLORS.verde, fontSize: 13, cursor: "pointer" }}>
        {iniciais(usuario.nome)}
      </button>

      {aberto && (
        <div role="menu"
          style={{ position: "absolute", right: 0, top: 44, minWidth: 226, background: COLORS.branco, borderRadius: 12, boxShadow: "0 6px 28px rgba(0,0,0,0.16)", border: `1px solid ${COLORS.cinzaClaro}`, overflow: "hidden", zIndex: 900 }}>
          <div style={{ padding: "13px 14px", borderBottom: `1px solid ${COLORS.cinzaClaro}` }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: COLORS.cinzaEscuro }}>{usuario.nome}</div>
            <div style={{ fontSize: 12, color: COLORS.cinza, wordBreak: "break-all" }}>{usuario.email}</div>
            <div style={{ fontSize: 11.5, color: COLORS.verde, fontWeight: 600, marginTop: 5 }}>
              {rotuloPapel(usuario.papel)}
            </div>
          </div>
          <div style={{ padding: "5px 0" }}>
            <ItemMenu icone="chave" onClick={abrirModalSenha}>Alterar minha senha</ItemMenu>
            <ItemMenu icone="sair" cor={COLORS.vermelho} onClick={sair}>Sair</ItemMenu>
          </div>
        </div>
      )}

      {modalSenha && (
        <Modal title="Alterar minha senha" onClose={() => setModalSenha(false)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {estado.erro && (
              <div style={{ background: "#FFEBEE", border: "1px solid #F5C2C7", color: "#B02A37", borderRadius: 9, padding: "10px 13px", fontSize: 13 }}>
                {estado.erro}
              </div>
            )}
            {estado.ok && (
              <div style={{ background: COLORS.verdePale, border: "1px solid #A7D8BB", color: COLORS.verde, borderRadius: 9, padding: "10px 13px", fontSize: 13 }}>
                Senha alterada. Use a nova no próximo login.
              </div>
            )}

            <InputSenha label="Senha atual" value={form.atual} autoComplete="current-password"
              onChange={(e) => setForm((f) => ({ ...f, atual: e.target.value }))} />
            <InputSenha label="Nova senha" value={form.nova} placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              onChange={(e) => setForm((f) => ({ ...f, nova: e.target.value }))} />
            <InputSenha label="Repita a nova senha" value={form.confirmacao} autoComplete="new-password"
              onChange={(e) => setForm((f) => ({ ...f, confirmacao: e.target.value }))} />

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
              <Btn variant="secondary" onClick={() => setModalSenha(false)}>Fechar</Btn>
              <Btn onClick={salvarSenha} disabled={estado.ocupado || !form.atual || !form.nova}>
                {estado.ocupado ? "Salvando…" : "Salvar senha"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

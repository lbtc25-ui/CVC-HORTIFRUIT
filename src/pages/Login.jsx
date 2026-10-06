import { useState } from "react";

import Logo from "../components/Logo";
import { Btn, Icon, Input, InputSenha } from "../components/ui";
import { useAuth } from "../contexts/auth-context";
import { enviarLinkRedefinicao, modoSupabase } from "../lib/auth";
import { validarSenha } from "../lib/senha";
import { COLORS, FONTE } from "../lib/tema";

const Aviso = ({ tipo, children }) => {
  const cores = {
    erro: { fundo: "#FFEBEE", borda: "#F5C2C7", texto: "#B02A37", icone: "alert" },
    ok: { fundo: COLORS.verdePale, borda: "#A7D8BB", texto: COLORS.verde, icone: "check" },
    info: { fundo: "#FFF3CD", borda: "#FFCC02", texto: "#856404", icone: "alert" },
  }[tipo];

  return (
    <div role={tipo === "erro" ? "alert" : "status"}
      style={{ background: cores.fundo, border: `1px solid ${cores.borda}`, borderRadius: 9, padding: "10px 13px", display: "flex", gap: 9, alignItems: "flex-start" }}>
      <div style={{ flexShrink: 0, marginTop: 1 }}>
        <Icon name={cores.icone} size={16} color={cores.texto} />
      </div>
      <span style={{ color: cores.texto, fontSize: 13, lineHeight: 1.45 }}>{children}</span>
    </div>
  );
};

/**
 * Porta de entrada do app. Cobre três situações:
 *   - login normal (e-mail + senha)
 *   - primeiro acesso no modo local: ninguém cadastrado ainda, cria o admin
 *   - esqueci a senha: dispara o e-mail de redefinição do Supabase
 */
export default function Login() {
  const { entrar, criarAdminInicial, primeiroAcesso } = useAuth();

  const [tela, setTela] = useState(primeiroAcesso ? "primeiro" : "login");
  const [form, setForm] = useState({ nome: "", email: "", senha: "", confirmacao: "" });
  const [erro, setErro] = useState(null);
  const [sucesso, setSucesso] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const campo = (chave) => (e) => {
    setForm((f) => ({ ...f, [chave]: e.target.value }));
    setErro(null);
  };

  const irPara = (destino) => {
    setTela(destino);
    setErro(null);
    setSucesso(null);
  };

  async function enviar(e) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    if (tela === "primeiro") {
      const problema = validarSenha(form.senha);
      if (problema) return setErro(problema);
      if (form.senha !== form.confirmacao) return setErro("As senhas não conferem.");
    }

    setOcupado(true);
    try {
      if (tela === "login") {
        await entrar({ email: form.email, senha: form.senha });
      } else if (tela === "primeiro") {
        await criarAdminInicial({ nome: form.nome, email: form.email, senha: form.senha });
      } else {
        await enviarLinkRedefinicao(form.email);
        setSucesso("Se existir uma conta com este e-mail, o link de redefinição já está a caminho.");
      }
    } catch (err) {
      setErro(String(err?.message ?? err));
    } finally {
      setOcupado(false);
    }
  }

  const titulos = {
    login: { titulo: "Entrar", sub: "Use o acesso cadastrado pelo sócio master" },
    primeiro: { titulo: "Primeiro acesso", sub: "Crie a conta de sócio master deste aparelho" },
    recuperar: { titulo: "Recuperar senha", sub: "Enviaremos um link para o seu e-mail" },
  }[tela];

  return (
    <div style={{ fontFamily: FONTE, minHeight: "100vh", background: COLORS.creme, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Marca */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 26 }}>
          <Logo variante="assinatura" altura={140} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 12, color: COLORS.cinza }}>Hortifrútis • Aracaju-SE</div>
          </div>
        </div>

        <form onSubmit={enviar}
          style={{ background: COLORS.branco, borderRadius: 16, padding: 26, boxShadow: "0 2px 18px rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", gap: 15 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 19, color: COLORS.cinzaEscuro }}>{titulos.titulo}</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.cinza }}>{titulos.sub}</p>
          </div>

          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          {sucesso && <Aviso tipo="ok">{sucesso}</Aviso>}

          {tela === "primeiro" && (
            <Input label="Seu nome" value={form.nome} onChange={campo("nome")}
              placeholder="Como aparece no sistema" autoComplete="name" required />
          )}

          <Input label="E-mail" type="email" value={form.email} onChange={campo("email")}
            placeholder="voce@empresa.com.br" autoComplete="username" autoCapitalize="none"
            spellCheck={false} required autoFocus />

          {tela !== "recuperar" && (
            <InputSenha label="Senha" value={form.senha} onChange={campo("senha")}
              placeholder="••••••••" required
              autoComplete={tela === "primeiro" ? "new-password" : "current-password"} />
          )}

          {tela === "primeiro" && (
            <>
              <InputSenha label="Repita a senha" value={form.confirmacao} onChange={campo("confirmacao")}
                placeholder="••••••••" autoComplete="new-password" required />
              <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: -6 }}>
                Mínimo de 8 caracteres, com letras e números.
              </div>
            </>
          )}

          <Btn type="submit" disabled={ocupado} style={{ justifyContent: "center", marginTop: 4, padding: "11px 18px" }}>
            {ocupado
              ? "Aguarde…"
              : tela === "login" ? "Entrar"
              : tela === "primeiro" ? "Criar acesso e entrar"
              : "Enviar link"}
          </Btn>

          {tela === "login" && !primeiroAcesso && (
            <button type="button" onClick={() => irPara("recuperar")}
              style={{ background: "none", border: "none", color: COLORS.verde, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}>
              Esqueci minha senha
            </button>
          )}

          {tela === "recuperar" && (
            <button type="button" onClick={() => irPara("login")}
              style={{ background: "none", border: "none", color: COLORS.verde, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}>
              Voltar para o login
            </button>
          )}

          {tela === "recuperar" && !modoSupabase && (
            <Aviso tipo="info">
              Sem servidor de e-mail no modo local: peça a um sócio master para definir uma nova
              senha em <strong>Usuários</strong>.
            </Aviso>
          )}
        </form>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 18, color: COLORS.cinza, fontSize: 11.5 }}>
          <Icon name={modoSupabase ? "cloud" : "cadeado"} size={13} color={COLORS.cinza} />
          {modoSupabase
            ? "Contas verificadas no servidor (Supabase Auth)"
            : "Modo local: contas guardadas só neste aparelho"}
        </div>

        <div style={{ textAlign: "center", marginTop: 10 }}>
          <a href="/resgate" style={{ color: COLORS.cinza, fontSize: 11.5 }}>
            Salvar cópia dos dados deste aparelho
          </a>
        </div>
      </div>
    </div>
  );
}

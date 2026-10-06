import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { COLORS } from "../lib/tema";

// ─── Ícones SVG inline ───────────────────────────────────────────────────────
export const Icon = ({ name, size = 20, color = "currentColor" }) => {
  const icons = {
    dashboard: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
    vendas: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />,
    clientes: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />,
    fornecedores: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 18H5a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v2M8 18a2 2 0 002 2h8a2 2 0 002-2M8 18V9a2 2 0 012-2h4a2 2 0 012 2v9" />,
    estoque: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
    financeiro: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
    plus: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />,
    search: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
    edit: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />,
    trash: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />,
    alert: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />,
    check: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />,
    close: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />,
    leaf: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3s2 0 4 2c3 3 3 7 3 7s-4 0-7-3C3 7 3 5 3 5S4 3 5 3zm7 10s2 6-2 8" />,
    menu: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />,
    sync: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M20 9a8 8 0 00-14.3-3.4L4 9m16 6l-1.7 3.4A8 8 0 014 15" />,
    cloud: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.9-9.9A6 6 0 003 15z" />,
    usuarios: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
    sair: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H9m0-9H6a3 3 0 00-3 3v12a3 3 0 003 3h3" />,
    cadeado: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />,
    chave: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4-1a6 6 0 01-7.7 5.7L12 15H9v3H6v3H3v-3.4l6.3-6.3A6 6 0 1121 8z" />,
    olho: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />,
    olhoFechado: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.9 5.7A9.8 9.8 0 0112 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 01-3.2 4M6.5 7.8A17 17 0 002.5 12S6 18.5 12 18.5c1.2 0 2.3-.2 3.3-.6" />,
    combustivel: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21V8a2 2 0 012-2h6a2 2 0 012 2v13M3 21h10m-8-9h6M18 8l2.6 2.6A2 2 0 0121 12v5.5a1.5 1.5 0 01-3 0V15a1 1 0 00-1-1h-1M6 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />,
    folha: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a2 2 0 012-2h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5zM9 12a2 2 0 100-4 2 2 0 000 4zm-3 6c0-1.657 1.343-3 3-3s3 1.343 3 3M14 9h4m-4 4h4m-4 4h2" />,
    caminhao: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16V6a1 1 0 011-1h9a1 1 0 011 1v10M3 16h11m0 0h4m-4 0V9h3.5l2.5 3v4m-6-7v7m6 0h-2m-4 0a2 2 0 11-4 0 2 2 0 014 0zm10 0a2 2 0 11-4 0 2 2 0 014 0z" />,
    rota: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />,
    anexo: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />,
    camera: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z" />,
    estrela: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.914c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />,
    tv: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM8 21h8M12 17v4" />,
    microfone: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3zm6-3a6 6 0 01-12 0M12 18v3" />,
  };
  return (
    <svg width={size} height={size} fill="none" stroke={color} viewBox="0 0 24 24">
      {icons[name]}
    </svg>
  );
};

// ─── Componentes de UI reutilizáveis ────────────────────────────────────────
export const Badge = ({ status }) => {
  const map = {
    ativo: { bg: "#D8F3DC", color: "#2D6A4F", label: "Ativo" },
    inativo: { bg: "#F0F0EB", color: "#9A9A8A", label: "Inativo" },
    pago: { bg: "#D8F3DC", color: "#2D6A4F", label: "Pago" },
    pendente: { bg: "#FFF3CD", color: "#856404", label: "Pendente" },
    cancelado: { bg: "#FFEBEE", color: "#E63946", label: "Cancelado" },
  };
  const s = map[status] || map.inativo;
  return (
    <span style={{ background: s.bg, color: s.color, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
      {s.label}
    </span>
  );
};

/**
 * Chips de filtro (status, categoria…). No celular a linha anda de lado em
 * vez de quebrar em várias — quando quebrava, a fileira de baixo empurrava o
 * resto do cabeçalho e o dedo não alcançava o alvo certo (ver `.cc-pills` no
 * index.css).
 */
export const FiltroPills = ({ opcoes, selecionado, aoSelecionar }) => (
  <div className="cc-pills" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
    {opcoes.map((o) => (
      <button key={o.valor} type="button" onClick={() => aoSelecionar(o.valor)}
        className="cc-pill"
        style={{ padding: "7px 14px", borderRadius: 20, border: "none", cursor: "pointer", flexShrink: 0, fontWeight: selecionado === o.valor ? 700 : 400, background: selecionado === o.valor ? COLORS.verde : COLORS.cinzaClaro, color: selecionado === o.valor ? COLORS.branco : COLORS.cinzaEscuro, fontSize: 13, transition: "all 0.15s" }}>
        {o.rotulo}
      </button>
    ))}
  </div>
);

/**
 * Copia o título de cada coluna (o <th> do cabeçalho) para o `data-label` das
 * células. No celular o CSS esconde o cabeçalho e mostra cada linha como um
 * cartão — "Cliente: Petrox · Total: R$ 120,00" —, e o rótulo vem daqui.
 * Célula que ocupa várias colunas (o "nenhum registro") fica sem rótulo.
 */
function rotularCelulas(tabela) {
  const titulos = [...tabela.querySelectorAll("thead tr:first-child th")].map((th) => th.textContent.trim());
  tabela.querySelectorAll("tbody tr").forEach((tr) => {
    let coluna = 0;
    [...tr.children].forEach((celula) => {
      const largura = celula.colSpan || 1;
      if (largura === 1 && titulos[coluna] !== undefined) celula.setAttribute("data-label", titulos[coluna]);
      else celula.removeAttribute("data-label");
      coluna += largura;
    });
  });
}

/**
 * Moldura das tabelas. No computador e no tablet, a tabela larga rola de lado
 * dentro desta caixa — sem isto, é a página inteira que anda, e a barra de
 * navegação junto. No celular (até 640px, ver `.cc-tabela` no index.css) cada
 * linha vira um cartão empilhado: nada de rolar de lado para achar o total.
 */
export const TabelaRolavel = ({ children }) => {
  const caixa = useRef(null);

  // Linhas entram e saem (filtro, sincronização): o observador rotula as novas.
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return undefined;
    const rotular = () => el.querySelectorAll("table").forEach(rotularCelulas);
    rotular();
    const observador = new MutationObserver(rotular);
    observador.observe(el, { childList: true, subtree: true, characterData: true });
    return () => observador.disconnect();
  }, []);

  return (
    <div ref={caixa} className="cc-tabela" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", margin: "0 -2px", padding: "0 2px" }}>
      {children}
    </div>
  );
};

export const Card = ({ children, style = {} }) => (
  <div style={{ background: COLORS.branco, borderRadius: 14, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", ...style }}>
    {children}
  </div>
);

export const StatCard = ({ icon, label, value, sub, color }) => (
  <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: COLORS.cinza, fontSize: 13, marginBottom: 4 }}>{label}</div>
        {/* Valores longos — "−R$ 278.213,32" — encolhem em vez de quebrar a linha
            no meio do número, o que fazia o sinal de menos ficar sozinho. */}
        <div style={{
          fontSize: String(value).length > 13 ? 21 : String(value).length > 10 ? 24 : 28,
          fontWeight: 700, color: COLORS.cinzaEscuro, whiteSpace: "nowrap",
        }}>{value}</div>
        {sub && <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: color + "22", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} color={color} size={22} />
      </div>
    </div>
  </Card>
);

export const Input = ({ label, ...props }) => {
  const idGerado = useId();
  const id = props.id ?? idGerado;
  return (
  <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
    {label && <label htmlFor={id} style={{ fontSize: 13, fontWeight: 600, color: COLORS.cinzaEscuro }}>{label}</label>}
    <input
      {...props}
      id={id}
      style={{
        width: "100%", minWidth: 0,
        border: `1.5px solid ${COLORS.cinzaClaro}`, borderRadius: 8, padding: "9px 13px",
        fontSize: 14, outline: "none", color: COLORS.cinzaEscuro, background: COLORS.branco,
        transition: "border 0.15s",
        ...props.style
      }}
      onFocus={e => e.target.style.borderColor = COLORS.verdeClaro}
      onBlur={e => e.target.style.borderColor = COLORS.cinzaClaro}
    />
  </div>
  );
};

export const Select = ({ label, options, ...props }) => {
  const idGerado = useId();
  const id = props.id ?? idGerado;
  return (
  <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
    {label && <label htmlFor={id} style={{ fontSize: 13, fontWeight: 600, color: COLORS.cinzaEscuro }}>{label}</label>}
    <select
      {...props}
      id={id}
      style={{
        width: "100%", minWidth: 0,
        border: `1.5px solid ${COLORS.cinzaClaro}`, borderRadius: 8, padding: "9px 13px",
        fontSize: 14, outline: "none", color: COLORS.cinzaEscuro, background: COLORS.branco,
        ...props.style
      }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
  );
};

export const Btn = ({ children, variant = "primary", onClick, style = {}, icon, disabled = false, ...props }) => {
  const base = { display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: disabled ? "not-allowed" : "pointer", border: "none", transition: "opacity 0.15s", opacity: disabled ? 0.55 : 1 };
  const variants = {
    primary: { background: COLORS.verde, color: COLORS.branco },
    secondary: { background: COLORS.cinzaClaro, color: COLORS.cinzaEscuro },
    danger: { background: COLORS.vermelho, color: COLORS.branco },
    ghost: { background: "transparent", color: COLORS.verde, border: `1.5px solid ${COLORS.verde}` },
  };
  const corIcone = variant === "secondary" ? COLORS.cinzaEscuro : variant === "ghost" ? COLORS.verde : COLORS.branco;
  return (
    <button {...props} className="cc-btn" disabled={disabled} style={{ ...base, ...variants[variant], ...style }} onClick={onClick}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = "0.85"; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.opacity = "1"; }}>
      {icon && <Icon name={icon} size={16} color={corIcone} />}
      {children}
    </button>
  );
};

/**
 * Campo de senha com o olho de mostrar/ocultar. Ver o que se digitou reduz
 * erro de digitação — principalmente no celular, no meio da feira.
 */
export const InputSenha = ({ label, style = {}, ...props }) => {
  const [visivel, setVisivel] = useState(false);
  const idGerado = useId();
  const id = props.id ?? idGerado;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
      {label && <label htmlFor={id} style={{ fontSize: 13, fontWeight: 600, color: COLORS.cinzaEscuro }}>{label}</label>}
      <div style={{ position: "relative", display: "flex" }}>
        <input
          {...props}
          id={id}
          type={visivel ? "text" : "password"}
          style={{
            flex: 1, width: "100%", border: `1.5px solid ${COLORS.cinzaClaro}`, borderRadius: 8,
            padding: "9px 42px 9px 13px", fontSize: 14, outline: "none",
            color: COLORS.cinzaEscuro, background: COLORS.branco, transition: "border 0.15s", ...style
          }}
          onFocus={e => e.target.style.borderColor = COLORS.verdeClaro}
          onBlur={e => e.target.style.borderColor = COLORS.cinzaClaro}
        />
        <button
          type="button"
          onClick={() => setVisivel(v => !v)}
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 6, display: "flex" }}
        >
          <Icon name={visivel ? "olhoFechado" : "olho"} size={17} color={COLORS.cinza} />
        </button>
      </div>
    </div>
  );
};

/**
 * Visualizador de imagem em tela cheia — abre fotos (como as que os
 * promotores enviam da rota) sem sair do sistema, ao contrário de uma nova
 * aba. Fecha no Esc, clicando fora da imagem, ou no X.
 */
export const ModalImagem = ({ src, alt = "Foto", onClose }) => {
  const fechar = useRef(onClose);
  useEffect(() => { fechar.current = onClose; });

  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === "Escape") fechar.current?.(); };
    const rolagemAnterior = document.body.style.overflow;
    window.addEventListener("keydown", aoTeclar);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = rolagemAnterior;
    };
  }, []);

  return (
    <div onClick={onClose} role="dialog" aria-modal="true" aria-label={alt}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <button type="button" onClick={onClose} aria-label="Fechar"
        style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 }}>
        <Icon name="close" color={COLORS.branco} size={22} />
      </button>
      <img src={src} alt={alt} onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8, boxShadow: "0 8px 40px rgba(0,0,0,0.4)" }} />
    </div>
  );
};

/**
 * Janela de formulário. No computador fica centralizada; no celular (ver
 * `.cc-modal` no index.css) sobe do rodapé ocupando a largura toda, como as
 * folhas do iOS/Android — o polegar alcança os botões e o teclado não esconde
 * o cabeçalho, que fica preso no topo enquanto o formulário rola.
 */
export const Modal = ({ title, children, onClose }) => {
  const idTitulo = useId();
  // Quem usa passa uma arrow nova a cada render; o ref evita religar o efeito.
  const fechar = useRef(onClose);
  useEffect(() => { fechar.current = onClose; });

  // Esc fecha e a página de trás não rola junto com o formulário.
  useEffect(() => {
    const aoTeclar = (e) => { if (e.key === "Escape") fechar.current?.(); };
    const rolagemAnterior = document.body.style.overflow;
    window.addEventListener("keydown", aoTeclar);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = rolagemAnterior;
    };
  }, []);

  return (
    <div className="cc-modal-fundo" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
      <div className="cc-modal" role="dialog" aria-modal="true" aria-labelledby={idTitulo}
        style={{ background: COLORS.branco, borderRadius: 16, padding: "0 clamp(18px, 5vw, 28px) clamp(18px, 5vw, 28px)", width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto", overscrollBehavior: "contain", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 1, background: COLORS.branco, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "clamp(14px, 4vw, 24px) 0 14px", marginBottom: 8 }}>
          <h3 id={idTitulo} style={{ margin: 0, color: COLORS.cinzaEscuro, fontSize: 18, minWidth: 0 }}>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Fechar"
            style={{ background: "none", border: "none", cursor: "pointer", width: 40, height: 40, marginRight: -10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10 }}>
            <Icon name="close" color={COLORS.cinza} size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

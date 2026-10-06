/**
 * Peças das páginas públicas de pedido (link da loja e link da rede).
 */
import Logo from "./Logo";
import { Icon } from "./ui";
import { formatarData } from "../lib/datas";
import { unidadeDe } from "../lib/pedidoCliente";
import { COLORS, FONTE, kg } from "../lib/tema";

export const Pagina = ({ children }) => (
  <div style={{ fontFamily: FONTE, minHeight: "100vh", background: COLORS.creme, padding: "20px 16px 40px" }}>
    <div style={{ maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <Logo variante="assinatura" altura={110} />
        <div style={{ fontSize: 12, color: COLORS.cinza }}>Hortifrútis • Aracaju-SE</div>
      </div>
      {children}
    </div>
  </div>
);

export const Caixa = ({ children, style, ...props }) => (
  <div {...props} style={{ background: COLORS.branco, borderRadius: 16, padding: 20, boxShadow: "0 2px 18px rgba(0,0,0,0.07)", ...style }}>
    {children}
  </div>
);

export const Aviso = ({ tipo = "erro", children }) => (
  <div role={tipo === "erro" ? "alert" : "status"}
    style={{
      background: tipo === "erro" ? "#FFEBEE" : COLORS.verdePale,
      color: tipo === "erro" ? "#B02A37" : COLORS.verde,
      borderRadius: 10, padding: "11px 14px", fontSize: 14, lineHeight: 1.45,
      display: "flex", gap: 9, alignItems: "flex-start",
    }}>
    <div style={{ flexShrink: 0, marginTop: 1 }}>
      <Icon name={tipo === "erro" ? "alert" : "check"} size={16} color="currentColor" />
    </div>
    <span>{children}</span>
  </div>
);

/** − [ qtd ] +  — o passo é 1 saco ou 1 kg; dá para digitar qualquer valor. */
const Quantidade = ({ valor, aoMudar, rotulo }) => {
  const n = Number(valor) || 0;
  const botao = {
    width: 40, height: 40, borderRadius: 10, border: "none", cursor: "pointer",
    background: COLORS.cinzaClaro, color: COLORS.cinzaEscuro, fontSize: 22, fontWeight: 700, lineHeight: 1,
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button type="button" aria-label={`Menos ${rotulo}`} style={botao}
        onClick={() => aoMudar(String(Math.max(0, n - 1)))}>−</button>
      <input type="number" inputMode="decimal" min="0" step="1" value={valor} placeholder="0"
        aria-label={rotulo}
        onChange={(e) => aoMudar(e.target.value)}
        style={{
          width: 72, height: 40, textAlign: "center", fontSize: 16, fontWeight: 600,
          border: `1.5px solid ${n > 0 ? COLORS.verdeClaro : COLORS.cinzaClaro}`, borderRadius: 10,
          color: COLORS.cinzaEscuro, background: COLORS.branco, outline: "none",
        }} />
      <button type="button" aria-label={`Mais ${rotulo}`} style={{ ...botao, background: COLORS.verdePale, color: COLORS.verde }}
        onClick={() => aoMudar(String(n + 1))}>+</button>
    </div>
  );
};

/** A lista de produtos com o − [qtd] + de cada um. `rotuloExtra` diferencia lojas no leitor de tela. */
export const ListaProdutos = ({ produtos, qtds, aoMudar, rotuloExtra = "" }) => (
  <>
    {produtos.length === 0 && (
      <div style={{ fontSize: 14, color: COLORS.cinza, padding: "10px 0" }}>Nenhum produto disponível.</div>
    )}
    {produtos.map((p, i) => (
      <div key={p.id}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 0", borderTop: i === 0 ? "none" : `1px solid ${COLORS.cinzaClaro}`, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: "1 1 150px" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.cinzaEscuro }}>{p.nome}</div>
          <div style={{ fontSize: 12, color: COLORS.cinza }}>
            {p.unidadeVenda === "saco" ? `Por saco de ${kg(p.kgPorUnidade)}` : "Por quilo (a granel)"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Quantidade valor={qtds[p.id] ?? ""} rotulo={`${p.nome} (${unidadeDe(p)})${rotuloExtra}`}
            aoMudar={(v) => aoMudar(p.id, v)} />
          <span style={{ fontSize: 13, color: COLORS.cinza, width: 38 }}>{unidadeDe(p)}</span>
        </div>
      </div>
    ))}
  </>
);

/** Produto · quantidade, um por linha, num fundo creme. */
export const ResumoItens = ({ itens }) => (
  <div style={{ width: "100%", boxSizing: "border-box", background: COLORS.creme, borderRadius: 10, padding: "8px 12px", textAlign: "left" }}>
    {itens.map(({ p, qty }) => (
      <div key={p.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 14, padding: "3px 0", color: COLORS.cinzaEscuro }}>
        <span>{p.nome}</span>
        <strong style={{ whiteSpace: "nowrap" }}>{qty.toLocaleString("pt-BR")} {unidadeDe(p, qty)}</strong>
      </div>
    ))}
  </div>
);

/** "Seu último pedido" com os itens e o botão que repete as quantidades. */
export const UltimoPedido = ({ data, itens, faltaram, repetido, aoRepetir }) => (
  <>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.cinzaEscuro }}>Último pedido</div>
      {data && <div style={{ fontSize: 13, color: COLORS.cinza }}>{formatarData(data)}</div>}
    </div>
    <div style={{ marginTop: 10 }}><ResumoItens itens={itens} /></div>
    {faltaram > 0 && (
      <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: 6 }}>
        {faltaram === 1 ? "1 produto" : `${faltaram} produtos`} do último pedido não {faltaram === 1 ? "está mais disponível" : "estão mais disponíveis"}.
      </div>
    )}
    <button type="button" onClick={aoRepetir}
      style={{ marginTop: 12, background: COLORS.verdePale, color: COLORS.verde, border: "none", borderRadius: 10, padding: "12px 14px", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
      <Icon name="check" size={16} color="currentColor" />
      {repetido ? "Quantidades repetidas — confira abaixo" : "Repetir o último pedido"}
    </button>
    {repetido && (
      <div style={{ fontSize: 13, color: COLORS.cinza, marginTop: 8, lineHeight: 1.45 }}>
        Ajuste o que quiser nos produtos e toque em <strong>Enviar</strong>.
      </div>
    )}
  </>
);

/** Quem está fazendo o pedido — obrigatório; a equipe vê o nome em Vendas. */
export const CampoNome = ({ valor, aoMudar, erro }) => (
  <>
    <label htmlFor="nome-pedido" style={{ fontWeight: 700, fontSize: 15, color: COLORS.cinzaEscuro }}>
      Responsável pelo pedido <span style={{ color: "#B02A37" }}>*</span>
    </label>
    <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: 2 }}>Nome de quem está fazendo o pedido.</div>
    <input id="nome-pedido" type="text" autoComplete="name" maxLength={80} value={valor} required
      aria-invalid={erro ? "true" : undefined}
      onChange={(e) => aoMudar(e.target.value)}
      placeholder="Digite seu nome"
      style={{ marginTop: 8, width: "100%", boxSizing: "border-box", border: `1.5px solid ${erro ? "#B02A37" : COLORS.cinzaClaro}`, borderRadius: 10, padding: "10px 12px", fontSize: 16, fontFamily: FONTE, color: COLORS.cinzaEscuro }} />
  </>
);

export const CampoObservacao = ({ id, valor, aoMudar }) => (
  <>
    <label htmlFor={id} style={{ fontWeight: 700, fontSize: 15, color: COLORS.cinzaEscuro }}>Observação</label>
    <textarea id={id} rows={3} maxLength={500} value={valor}
      onChange={(e) => aoMudar(e.target.value)}
      placeholder="Ex.: entregar pela manhã, falar com o João…"
      style={{ marginTop: 8, width: "100%", boxSizing: "border-box", border: `1.5px solid ${COLORS.cinzaClaro}`, borderRadius: 10, padding: "10px 12px", fontSize: 15, fontFamily: FONTE, resize: "vertical", color: COLORS.cinzaEscuro }} />
  </>
);

/** O círculo verde com o ✓ e o título da tela de "enviado". */
export const Enviado = ({ titulo, children }) => (
  <Caixa>
    <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center", textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: COLORS.verdePale, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name="check" size={30} color={COLORS.verde} />
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: COLORS.cinzaEscuro }}>{titulo}</div>
      {children}
    </div>
  </Caixa>
);

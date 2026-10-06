import { useMemo, useState } from "react";

import { Indicador } from "../components/Analise";
import { Btn, Card, FiltroPills, Icon, Input, Modal, TabelaRolavel } from "../components/ui";
import { useAuth } from "../contexts/auth-context";
import { soDigitos } from "../lib/cadastro";
import { diasDeAtraso, formatarData, hojeISO } from "../lib/datas";
import { novoId } from "../lib/mappers";
import {
  JANELA_DIAS, MIN_PEDIDOS, abrevDoDia, agendaPrevista, historicoDeSinalizacoes, nomeDoDia,
  painelDePedidos, somarDias,
} from "../lib/previsaoPedidos";
import { COLORS, brl, kg } from "../lib/tema";

/**
 * Previsão de Pedidos — o ritmo de compra de cada cliente, o alerta de quem
 * não pediu no dia de sempre e as sinalizações de quem cuida dos clientes
 * ("me lembre em", "ciente", "parou de pedir" e a reconquista). Toda a conta
 * está em src/lib/previsaoPedidos.js.
 */

const dataCurta = (iso) => (iso ? `${abrevDoDia(iso)} ${formatarData(iso).slice(0, 5)}` : "—");
/** Busca sem ligar para maiúscula nem acento. */
const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

const ROXO = "#6B4FA0";

const SITUACAO = {
  atrasado: { rotulo: "Não pediu", cor: COLORS.vermelho, fundo: "#FFEBEE" },
  hoje: { rotulo: "Esperado hoje", cor: "#856404", fundo: "#FFF3CD" },
  em_dia: { rotulo: "Em dia", cor: COLORS.verde, fundo: COLORS.verdePale },
  lancado: { rotulo: "Pedido lançado", cor: COLORS.azul, fundo: "#E3F0F7" },
  parado: { rotulo: "Parou de pedir", cor: COLORS.cinzaEscuro, fundo: COLORS.cinzaClaro },
};

/** Cor de cada alerta (o que aparece na lista de cima). */
const ALERTA = {
  ...SITUACAO,
  lembrete: { rotulo: "Lembrete", cor: COLORS.azul, fundo: "#E3F0F7" },
  reconquistar: { rotulo: "Reconquistar", cor: ROXO, fundo: "#EFE9F7" },
};

const SINAL = {
  lembrar: { cor: COLORS.azul, fundo: "#E3F0F7" },
  ciente: { cor: COLORS.verde, fundo: COLORS.verdePale },
  parou: { cor: ROXO, fundo: "#EFE9F7" },
};

const REGULARIDADE = { alta: "Regular", media: "Às vezes varia", baixa: "Irregular" };

const Chip = ({ children, cor, fundo }) => (
  <span style={{
    display: "inline-block", fontSize: 11, fontWeight: 700, color: cor, background: fundo,
    borderRadius: 99, padding: "2px 9px", whiteSpace: "nowrap",
  }}>{children}</span>
);

const ChipSituacao = ({ c }) => {
  const s = SITUACAO[c.situacao] ?? SITUACAO.em_dia;
  return <Chip cor={s.cor} fundo={s.fundo}>{s.rotulo}</Chip>;
};

/** "Me lembre 05/10", "Ciente", "Parou de pedir". */
function rotuloSinal(s) {
  if (s.tipo === "lembrar") return `Me lembre ${dataCurta(s.data)}`;
  if (s.tipo === "parou") return s.data ? `Parou · reconquistar ${dataCurta(s.data)}` : "Parou de pedir";
  return "Ciente";
}

const ChipSinal = ({ s }) => <Chip cor={SINAL[s.tipo].cor} fundo={SINAL[s.tipo].fundo}>{rotuloSinal(s)}</Chip>;

const ChipAntecipou = ({ dias }) => (
  <Chip cor={COLORS.azul} fundo="#E3F0F7">Antecipou {plural(dias, "dia", "dias")}</Chip>
);

const BotaoPequeno = ({ children, onClick, cor = COLORS.cinzaEscuro }) => (
  <button type="button" onClick={onClick} style={{
    background: COLORS.branco, border: `1px solid ${cor}55`, color: cor, borderRadius: 8,
    padding: "7px 11px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
  }}>{children}</button>
);

/** Texto principal do alerta. */
function textoAlerta(c) {
  if (c.alerta === "lembrete") return `Lembrete de hoje${c.sinal.motivo ? `: ${c.sinal.motivo}` : ""}`;
  if (c.alerta === "reconquistar") return `Hora de reconquistar${c.sinal.motivo ? ` — parou: ${c.sinal.motivo}` : ""}`;
  if (c.situacao === "hoje") return c.atraso === 0 ? "Pedido esperado hoje e ainda não entrou" : `Esperado ${dataCurta(c.esperado)} — ainda na folga`;
  const ciclos = c.ciclosPerdidos > 1 ? ` · ${c.ciclosPerdidos} pedidos perdidos` : "";
  return `${plural(c.atraso, "dia", "dias")} de atraso${ciclos}`;
}

function linkWhatsapp(c, reconquista = false) {
  const tel = soDigitos(c.loja?.telefone || c.rede?.telefone || "");
  const texto = reconquista || !c.esperado
    ? `Olá! Aqui é da Carvalho Cruz. Faz tempo que não atendemos a ${c.nome} e sentimos sua falta. Podemos conversar sobre preço e entrega para voltar a fornecer?`
    : `Olá! Aqui é da Carvalho Cruz. Sentimos falta do pedido de ${nomeDoDia(c.esperado)} (${formatarData(c.esperado).slice(0, 5)}) da ${c.nome}. Vai precisar de mercadoria?`;
  return `https://wa.me/${tel ? (tel.length <= 11 ? `55${tel}` : tel) : ""}?text=${encodeURIComponent(texto)}`;
}

const BotaoWhatsapp = ({ c, reconquista }) => (
  <a href={linkWhatsapp(c, reconquista)} target="_blank" rel="noreferrer" style={{
    display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none",
    background: "#25D366", color: COLORS.branco, fontWeight: 700, fontSize: 12.5, borderRadius: 8, padding: "7px 11px",
  }}>WhatsApp</a>
);

/** Linha do resumo: padrão, último pedido, esperado e pedido típico. */
const Resumo = ({ c }) => (
  <div style={{ fontSize: 12.5, color: COLORS.cinzaEscuro, marginTop: 4, lineHeight: 1.5 }}>
    {c.padrao ? `${c.padrao} · ` : ""}último pedido {dataCurta(c.ultimo)}
    {c.ultimo ? ` (${plural(diasDeAtraso(c.ultimo), "dia", "dias")})` : ""}
    {c.padrao && c.situacao !== "parado" && c.sinal?.tipo !== "parou" && c.esperado ? ` · esperado ${dataCurta(c.esperado)}` : ""}
    {c.valorTipico > 0 && <><br />Pedido típico: <strong>{brl(c.valorTipico)}</strong> · {kg(c.kgTipico)}</>}
  </div>
);

const AlertaCliente = ({ c, aoSinalizar, aoEncerrar }) => {
  const s = ALERTA[c.alerta];
  return (
    <div style={{
      display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap",
      border: `1px solid ${s.cor}44`, background: s.fundo, borderRadius: 10, padding: "12px 14px",
    }}>
      <Icon name="alert" color={s.cor} size={18} />
      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ color: COLORS.cinzaEscuro, fontSize: 14 }}>{c.nome}</strong>
          <Chip cor={s.cor} fundo={COLORS.branco}>{s.rotulo}</Chip>
        </div>
        <div style={{ fontSize: 13, color: s.cor, fontWeight: 600, marginTop: 3 }}>{textoAlerta(c)}</div>
        <Resumo c={c} />
        {c.sinal && <AutorSinal s={c.sinal} />}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignSelf: "center" }}>
        <BotaoWhatsapp c={c} reconquista={c.alerta === "reconquistar"} />
        <BotaoPequeno onClick={() => aoSinalizar(c)} cor={COLORS.azul}>Sinalizar</BotaoPequeno>
        {c.sinal && <BotaoPequeno onClick={() => aoEncerrar(c)}>Encerrar</BotaoPequeno>}
      </div>
    </div>
  );
};

const AutorSinal = ({ s }) => (
  <div style={{ fontSize: 11.5, color: COLORS.cinza, marginTop: 3 }}>
    Sinalizado {s.autor ? `por ${s.autor} ` : ""}em {formatarData(String(s.criadoEm).slice(0, 10))}
  </div>
);

// ─── Modal de sinalizar ─────────────────────────────────────────────────────

const OPCOES_TIPO = [
  { valor: "lembrar", rotulo: "Me lembre em…" },
  { valor: "ciente", rotulo: "Ciente" },
  { valor: "parou", rotulo: "Parou de pedir" },
];

const EXPLICACAO = {
  lembrar: "O alerta some e volta no dia escolhido, com o motivo, aqui e no aviso do celular.",
  ciente: "O alerta some até o próximo pedido do cliente.",
  parou: "Sai do alerta diário e vai para Reconquistar. Com data, vira alerta de reconquista nesse dia.",
};

const ATALHOS = {
  lembrar: [["Amanhã", 1], ["+3 dias", 3], ["+1 semana", 7], ["+15 dias", 15]],
  parou: [["+15 dias", 15], ["+30 dias", 30], ["+60 dias", 60], ["+90 dias", 90]],
};

function SinalizarModal({ c, sinalizacoes, aoSalvar, aoFechar }) {
  const hoje = hojeISO();
  const atual = c.sinal;
  const [tipo, setTipo] = useState(atual?.tipo ?? (c.alerta === "reconquistar" || c.situacao === "parado" ? "parou" : "lembrar"));
  const [data, setData] = useState(atual?.data ?? "");
  const [motivo, setMotivo] = useState(atual?.motivo ?? "");
  const [erro, setErro] = useState("");
  const historico = historicoDeSinalizacoes(sinalizacoes, c.lojaId).slice(0, 6);

  const salvar = () => {
    if (tipo === "lembrar" && !data) return setErro("Escolha o dia do lembrete.");
    if (tipo === "lembrar" && data < hoje) return setErro("O lembrete precisa ser hoje ou depois.");
    if (tipo === "parou" && !motivo.trim()) return setErro("Escreva o motivo — é o que ajuda a reconquistar.");
    aoSalvar({ tipo, data: tipo === "ciente" ? "" : data, motivo: motivo.trim() });
  };

  return (
    <Modal title={`Sinalizar — ${c.nome}`} onClose={aoFechar}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <FiltroPills opcoes={OPCOES_TIPO} selecionado={tipo} aoSelecionar={(t) => { setTipo(t); setErro(""); }} />
        <div style={{ fontSize: 12.5, color: COLORS.cinza, lineHeight: 1.5 }}>{EXPLICACAO[tipo]}</div>

        {tipo !== "ciente" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Input type="date" min={hoje} label={tipo === "lembrar" ? "Me lembre no dia" : "Alerta para reconquistar em (opcional)"}
              value={data} onChange={(e) => { setData(e.target.value); setErro(""); }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {ATALHOS[tipo].map(([rotulo, dias]) => (
                <BotaoPequeno key={rotulo} onClick={() => { setData(somarDias(hoje, dias)); setErro(""); }}>{rotulo}</BotaoPequeno>
              ))}
              {tipo === "parou" && data && <BotaoPequeno onClick={() => setData("")}>Sem data</BotaoPequeno>}
            </div>
          </div>
        )}

        <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 600, color: COLORS.cinzaEscuro }}>
          Motivo {tipo === "parou" ? "" : "(opcional)"}
          <textarea value={motivo} onChange={(e) => { setMotivo(e.target.value); setErro(""); }} rows={3}
            placeholder={tipo === "parou" ? "Ex.: fechou com concorrente pelo preço, loja em reforma, reclamou da qualidade…" : "Ex.: liguei, o gerente vai pedir sexta"}
            style={{ font: "inherit", fontWeight: 400, fontSize: 14, padding: "9px 11px", borderRadius: 8, border: `1px solid ${COLORS.cinzaClaro}`, resize: "vertical" }} />
        </label>

        {erro && <div style={{ color: COLORS.vermelho, fontSize: 13, fontWeight: 600 }}>{erro}</div>}

        {historico.length > 0 && (
          <div style={{ borderTop: `1px solid ${COLORS.cinzaClaro}`, paddingTop: 10 }}>
            <div style={{ fontSize: 11.5, color: COLORS.cinza, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Histórico deste cliente</div>
            {historico.map((s) => (
              <div key={s.id} style={{ fontSize: 12.5, color: COLORS.cinzaEscuro, marginBottom: 6, lineHeight: 1.45 }}>
                <ChipSinal s={s} />{" "}
                <span style={{ color: COLORS.cinza }}>{formatarData(String(s.criadoEm).slice(0, 10))}{s.autor ? ` · ${s.autor}` : ""}{s.encerradaEm ? " · encerrada" : ""}</span>
                {s.motivo && <div>{s.motivo}</div>}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Btn variant="secondary" onClick={aoFechar}>Cancelar</Btn>
          <Btn onClick={salvar}>Salvar</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ─── Tabela ─────────────────────────────────────────────────────────────────

const FILTROS_SITUACAO = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "alerta", rotulo: "Com alerta" },
  { valor: "sinalizados", rotulo: "Sinalizados" },
  { valor: "em_dia", rotulo: "Em dia" },
  { valor: "parado", rotulo: "Pararam" },
  { valor: "sem_padrao", rotulo: "Sem padrão ainda" },
];

const noFiltro = (c, filtro) => {
  if (filtro === "todos") return true;
  if (filtro === "alerta") return !!c.alerta;
  if (filtro === "sinalizados") return !!c.sinal;
  if (filtro === "parado") return c.situacao === "parado" || c.sinal?.tipo === "parou";
  if (filtro === "sem_padrao") return !c.padrao;
  if (!c.padrao) return false;
  if (filtro === "em_dia") return c.situacao === "em_dia" || c.situacao === "lancado";
  return c.situacao === filtro;
};

const ORDEM_SITUACAO = { atrasado: 0, hoje: 1, lancado: 2, em_dia: 3, parado: 4 };

export default function PrevisaoPedidos({ dados, setDados }) {
  const { usuario } = useAuth();
  const hoje = hojeISO();
  const painel = useMemo(() => painelDePedidos(dados, hoje), [dados, hoje]);
  const { clientes, alertas, sinalizados, reconquistar } = painel;
  const agenda = useMemo(() => agendaPrevista(clientes, 7, hoje), [clientes, hoje]);
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [sinalizando, setSinalizando] = useState(null);

  const comPadrao = clientes.filter((c) => c.padrao);
  const atrasados = alertas.filter((c) => c.alerta === "atrasado");
  const esperadosHoje = alertas.filter((c) => c.alerta === "hoje");
  const avisosDoDia = alertas.filter((c) => c.alerta === "lembrete" || c.alerta === "reconquistar");
  const antecipados = comPadrao.filter((c) => c.antecipou > 0 && !c.alerta && !c.sinal && c.situacao !== "parado");
  const semana = agenda.reduce((s, d) => ({ valor: s.valor + d.valor, pedidos: s.pedidos + d.clientes.length }), { valor: 0, pedidos: 0 });

  const agora = () => new Date().toISOString();

  const salvarSinal = (c, { tipo, data, motivo }) => {
    const momento = agora();
    setDados((prev) => {
      const lista = (prev.sinalizacoes_clientes ?? []).map((s) =>
        s.lojaId === c.lojaId && !s.encerradaEm ? { ...s, encerradaEm: momento, atualizadoEm: momento } : s);
      lista.push({
        id: novoId(), lojaId: c.lojaId, tipo, data, motivo,
        ultimoPedido: c.ultimo ?? "", autor: usuario?.nome ?? "",
        encerradaEm: null, criadoEm: momento, atualizadoEm: momento,
      });
      return { ...prev, sinalizacoes_clientes: lista };
    });
    setSinalizando(null);
  };

  const encerrarSinal = (c) => {
    if (!confirm(`Encerrar a sinalização de ${c.nome}? O alerta volta a valer pelo ritmo do cliente.`)) return;
    const momento = agora();
    setDados((prev) => ({
      ...prev,
      sinalizacoes_clientes: (prev.sinalizacoes_clientes ?? []).map((s) =>
        s.lojaId === c.lojaId && !s.encerradaEm ? { ...s, encerradaEm: momento, atualizadoEm: momento } : s),
    }));
  };

  const termo = normalizar(busca.trim());
  const tabela = clientes
    .filter((c) => noFiltro(c, filtro) && (!termo || normalizar(c.nome).includes(termo)))
    .sort((a, b) => (a.alerta ? 0 : 1) - (b.alerta ? 0 : 1)
      || (ORDEM_SITUACAO[a.situacao] ?? 9) - (ORDEM_SITUACAO[b.situacao] ?? 9)
      || String(a.esperado ?? "9").localeCompare(String(b.esperado ?? "9"))
      || a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <Indicador rotulo="Não pediram" valor={atrasados.length}
          sub={atrasados.length ? `${brl(atrasados.reduce((s, c) => s + c.valorTipico, 0))} em pedidos típicos` : "Ninguém atrasado"}
          cor={atrasados.length ? COLORS.vermelho : COLORS.verde} />
        <Indicador rotulo="Esperados hoje, sem pedido" valor={esperadosHoje.length}
          sub="Ainda dá tempo de chamar" cor="#856404" />
        <Indicador rotulo="Lembretes e reconquistas" valor={avisosDoDia.length}
          sub={`${plural(sinalizados.length, "sinalizado aguardando", "sinalizados aguardando")}`} cor={ROXO} />
        <Indicador rotulo="Previsão 7 dias" valor={brl(semana.valor)}
          sub={`${plural(semana.pedidos, "pedido previsto", "pedidos previstos")}`} cor={COLORS.azul} />
        <Indicador rotulo="Clientes com padrão" valor={comPadrao.length}
          sub={`de ${plural(clientes.length, "cliente", "clientes")} com pedido nos últimos ${JANELA_DIAS} dias`} />
      </div>

      <Card>
        <h4 style={{ margin: "0 0 4px", color: COLORS.cinzaEscuro, fontSize: 15 }}>Alertas de hoje</h4>
        <p style={{ margin: "0 0 14px", fontSize: 12.5, color: COLORS.cinza, lineHeight: 1.5 }}>
          Quem passou do dia de sempre sem pedir, quem devia pedir hoje, e os lembretes e reconquistas marcados para
          hoje. Quem antecipou ou já tem pedido lançado para frente não entra. Em <strong>Sinalizar</strong>: <em>Me lembre
          em…</em> (volta no dia), <em>Ciente</em> (some até o próximo pedido) ou <em>Parou de pedir</em> (com o motivo,
          vai para Reconquistar).
        </p>
        {alertas.length === 0 ? (
          <div style={{ color: COLORS.verde, textAlign: "center", padding: 20, fontSize: 14, fontWeight: 600 }}>
            Nenhum alerta hoje.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {alertas.map((c) => <AlertaCliente key={c.lojaId} c={c} aoSinalizar={setSinalizando} aoEncerrar={encerrarSinal} />)}
          </div>
        )}
        {antecipados.length > 0 && (
          <div style={{ marginTop: 14, fontSize: 12.5, color: COLORS.cinzaEscuro, lineHeight: 1.6 }}>
            <strong style={{ color: COLORS.azul }}>Anteciparam o pedido (sem alerta):</strong>{" "}
            {antecipados.map((c) => `${c.nome} (${dataCurta(c.ultimo)}, ${plural(c.antecipou, "dia", "dias")} antes)`).join(" · ")}
          </div>
        )}
      </Card>

      {sinalizados.length > 0 && (
        <Card>
          <h4 style={{ margin: "0 0 4px", color: COLORS.cinzaEscuro, fontSize: 15 }}>Sinalizados — aguardando</h4>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: COLORS.cinza }}>
            Fora do alerta até o dia do lembrete ou até o próximo pedido. Pedido novo encerra a sinalização sozinho.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sinalizados.map((c) => (
              <div key={c.lojaId} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", borderTop: `1px solid ${COLORS.cinzaClaro}`, paddingTop: 8 }}>
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 13.5, color: COLORS.cinzaEscuro }}>{c.nome}</strong>
                    <ChipSinal s={c.sinal} />
                  </div>
                  {c.sinal.motivo && <div style={{ fontSize: 12.5, color: COLORS.cinzaEscuro, marginTop: 2 }}>{c.sinal.motivo}</div>}
                  <AutorSinal s={c.sinal} />
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <BotaoPequeno onClick={() => setSinalizando(c)} cor={COLORS.azul}>Alterar</BotaoPequeno>
                  <BotaoPequeno onClick={() => encerrarSinal(c)}>Encerrar</BotaoPequeno>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h4 style={{ margin: "0 0 4px", color: COLORS.cinzaEscuro, fontSize: 15 }}>Reconquistar clientes</h4>
        <p style={{ margin: "0 0 12px", fontSize: 12.5, color: COLORS.cinza, lineHeight: 1.5 }}>
          Os marcados como <em>Parou de pedir</em>, com o motivo, e os que pararam sozinhos (mais de 45 dias ou 4 ciclos
          sem pedir). Defina a data do alerta de reconquista em <strong>Sinalizar</strong> — nesse dia ele volta para os
          alertas e para o aviso do celular.
        </p>
        {reconquistar.length === 0 ? (
          <div style={{ color: COLORS.cinza, textAlign: "center", padding: 16, fontSize: 14 }}>Nenhum cliente parado.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {reconquistar.map((c) => (
              <div key={c.lojaId} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", borderTop: `1px solid ${COLORS.cinzaClaro}`, paddingTop: 8 }}>
                <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 13.5, color: COLORS.cinzaEscuro }}>{c.nome}</strong>
                    {c.sinal ? <ChipSinal s={c.sinal} /> : <Chip cor={COLORS.cinzaEscuro} fundo={COLORS.cinzaClaro}>Parou sozinho · sem motivo</Chip>}
                  </div>
                  {c.sinal?.motivo && <div style={{ fontSize: 12.5, color: ROXO, fontWeight: 600, marginTop: 2 }}>Motivo: {c.sinal.motivo}</div>}
                  <Resumo c={c} />
                  {c.sinal && <AutorSinal s={c.sinal} />}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <BotaoWhatsapp c={c} reconquista />
                  <BotaoPequeno onClick={() => setSinalizando(c)} cor={COLORS.azul}>{c.sinal ? "Alterar" : "Registrar motivo"}</BotaoPequeno>
                  {c.sinal && <BotaoPequeno onClick={() => encerrarSinal(c)}>Encerrar</BotaoPequeno>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h4 style={{ margin: "0 0 4px", color: COLORS.cinzaEscuro, fontSize: 15 }}>Previsão dos próximos 7 dias</h4>
        <p style={{ margin: "0 0 14px", fontSize: 12.5, color: COLORS.cinza }}>
          Quem deve pedir em cada dia, pelo ritmo de cada um, e o valor do pedido típico (mediana dos últimos 5).
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
          {agenda.map((d) => (
            <div key={d.data} style={{ border: `1px solid ${COLORS.cinzaClaro}`, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <strong style={{ fontSize: 13.5, color: d.data === hoje ? COLORS.verde : COLORS.cinzaEscuro, textTransform: "capitalize" }}>
                  {d.data === hoje ? "Hoje" : nomeDoDia(d.data)} {formatarData(d.data).slice(0, 5)}
                </strong>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.azul }}>{brl(d.valor)}</span>
              </div>
              <div style={{ fontSize: 11.5, color: COLORS.cinza, margin: "2px 0 6px" }}>
                {plural(d.clientes.length, "pedido", "pedidos")} · {kg(d.kg)}
              </div>
              {d.clientes.length === 0 ? (
                <div style={{ fontSize: 12, color: COLORS.cinza }}>Nenhum previsto.</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5, color: COLORS.cinzaEscuro, lineHeight: 1.6 }}>
                  {d.clientes.map((c) => (
                    <li key={c.lojaId}>
                      {c.nome} <span style={{ color: COLORS.cinza }}>· {brl(c.valorTipico)}</span>
                      {c.alerta === "hoje" && d.data === hoje && <span style={{ color: "#856404", fontWeight: 700 }}> · sem pedido</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h4 style={{ margin: "0 0 4px", color: COLORS.cinzaEscuro, fontSize: 15 }}>Padrão de cada cliente</h4>
        <p style={{ margin: "0 0 12px", fontSize: 12.5, color: COLORS.cinza }}>
          Tirado dos pedidos dos últimos {JANELA_DIAS} dias. Com menos de {MIN_PEDIDOS} dias de pedido ainda não dá para
          ver um ritmo. Pedido cancelado não conta; dois pedidos no mesmo dia contam como um.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          <FiltroPills opcoes={FILTROS_SITUACAO} selecionado={filtro} aoSelecionar={setFiltro} />
          <Input placeholder="Buscar rede ou loja…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        {tabela.length === 0 ? (
          <div style={{ color: COLORS.cinza, textAlign: "center", padding: 20, fontSize: 14 }}>Nenhum cliente neste filtro.</div>
        ) : (
          <TabelaRolavel>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 820 }}>
              <thead>
                <tr>
                  {["Cliente", "Padrão", "Último", "Próximo", "Pedido típico", "Situação", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", fontSize: 11, color: COLORS.cinza, paddingBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabela.map((c) => (
                  <tr key={c.lojaId} style={{ borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
                    <td style={{ padding: "9px 6px 9px 0", fontSize: 13, color: COLORS.cinzaEscuro, fontWeight: 600 }}>{c.nome}</td>
                    <td style={{ padding: "9px 6px", fontSize: 12.5, color: COLORS.cinzaEscuro }}>
                      {c.padrao ?? <span style={{ color: COLORS.cinza }}>{plural(c.pedidos, "pedido", "pedidos")} — pouco para prever</span>}
                      {c.padrao && <div style={{ fontSize: 11, color: COLORS.cinza }}>{REGULARIDADE[c.regularidade]} · {c.pedidos} pedidos</div>}
                    </td>
                    <td style={{ padding: "9px 6px", fontSize: 12.5, color: COLORS.cinza, whiteSpace: "nowrap" }}>{dataCurta(c.ultimo)}</td>
                    <td style={{ padding: "9px 6px", fontSize: 12.5, color: COLORS.cinzaEscuro, whiteSpace: "nowrap" }}>
                      {c.padrao && c.situacao !== "parado" ? dataCurta(c.esperado) : "—"}
                    </td>
                    <td style={{ padding: "9px 6px", fontSize: 12.5, color: COLORS.verde, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {c.padrao ? brl(c.valorTipico) : "—"}
                    </td>
                    <td style={{ padding: "9px 6px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {c.padrao ? <ChipSituacao c={c} /> : <Chip cor={COLORS.cinza} fundo={COLORS.cinzaClaro}>Sem padrão</Chip>}
                        {c.sinal && <ChipSinal s={c.sinal} />}
                        {c.padrao && c.antecipou > 0 && c.situacao !== "parado" && <ChipAntecipou dias={c.antecipou} />}
                      </div>
                    </td>
                    <td style={{ padding: "9px 0" }}>
                      <BotaoPequeno onClick={() => setSinalizando(c)} cor={COLORS.azul}>Sinalizar</BotaoPequeno>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolavel>
        )}
      </Card>

      {sinalizando && (
        <SinalizarModal
          c={sinalizando}
          sinalizacoes={dados.sinalizacoes_clientes}
          aoSalvar={(valores) => salvarSinal(sinalizando, valores)}
          aoFechar={() => setSinalizando(null)}
        />
      )}
    </div>
  );
}

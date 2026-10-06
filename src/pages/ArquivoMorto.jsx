import { useRef, useState } from "react";

import { Btn, Card, Icon, Select } from "../components/ui";
import { hojeISO } from "../lib/datas";
import { destinoPasta, destinoZip, gerarArquivo, planejar, podeGravarEmPasta, resumirPlano } from "../lib/arquivoMorto";
import { trimestresDisponiveis } from "../lib/arquivoMortoBase";
import { supabaseConfigurado } from "../lib/supabase";
import { COLORS } from "../lib/tema";

/**
 * Arquivo morto trimestral (Etapa 1: só GERA o arquivo — não apaga nada).
 *
 * O sócio master escolhe o trimestre, confere o que entra e salva numa pasta
 * do Drive (Chrome/Edge no computador) ou baixa em ZIPs. Os números do sistema
 * não são tocados. Ver src/lib/arquivoMorto.js.
 */

const NOME_GRUPO_ICONE = { Comprovantes: "anexo", "Fotos dos promotores": "camera", "Notas fiscais": "folha" };

const Aviso = ({ tipo, children }) => {
  const cor = tipo === "erro" ? COLORS.vermelho : tipo === "ok" ? COLORS.verde : COLORS.laranjaEscuro;
  return (
    <div role="status" style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${cor}`, color: cor, fontSize: 13, lineHeight: 1.5, wordBreak: "break-word" }}>
      {children}
    </div>
  );
};

export default function ArquivoMorto({ dados }) {
  const trimestres = trimestresDisponiveis(hojeISO());
  const [escolhido, setEscolhido] = useState(trimestres[0].nome); // o último encerrado
  const [ocupado, setOcupado] = useState(false);
  const [etapa, setEtapa] = useState("");
  const [plano, setPlano] = useState(null);
  const [progresso, setProgresso] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState(null);
  const cancelar = useRef(false);

  const tri = trimestres.find((t) => t.nome === escolhido);
  const online = typeof navigator === "undefined" || navigator.onLine;

  const trocar = (nome) => {
    setEscolhido(nome);
    setPlano(null);
    setResultado(null);
    setErro(null);
  };

  const conferir = async () => {
    setOcupado(true); setErro(null); setResultado(null); setPlano(null);
    try {
      setPlano(await planejar({ dados, tri, aoProgredir: setEtapa }));
    } catch (e) {
      setErro(String(e?.message ?? e));
    } finally {
      setEtapa("");
      setOcupado(false);
    }
  };

  const salvar = async (modo) => {
    setErro(null); setResultado(null);
    cancelar.current = false;
    let destino;
    try {
      destino = modo === "pasta"
        ? await destinoPasta()
        : destinoZip({ nomeBase: tri.nome, aoFecharParte: (n) => setEtapa(`ZIP ${n} baixado.`) });
    } catch (e) {
      if (e?.name !== "AbortError") setErro(String(e?.message ?? e)); // AbortError = fechou a janela de escolher a pasta
      return;
    }
    setOcupado(true);
    try {
      const r = await gerarArquivo({ plano, tri, destino, aoProgredir: setProgresso, cancelado: () => cancelar.current });
      setResultado({ ...r, cancelado: cancelar.current, modo, pasta: destino.nomePasta });
    } catch (e) {
      setErro(String(e?.message ?? e));
    } finally {
      setProgresso(null);
      setEtapa("");
      setOcupado(false);
    }
  };

  if (!supabaseConfigurado) {
    return <Aviso tipo="erro">O arquivo morto precisa do Supabase configurado: é de lá que vêm as fotos e os comprovantes.</Aviso>;
  }

  const resumo = plano ? resumirPlano(plano) : null;
  const pct = progresso?.total ? Math.round((progresso.feitos / progresso.total) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 760 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <Icon name="anexo" color={COLORS.verde} />
          <h3 style={{ margin: 0, fontSize: 16, color: COLORS.cinzaEscuro }}>Arquivo morto por trimestre</h3>
        </div>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: COLORS.cinza, lineHeight: 1.6 }}>
          Salva numa pasta do Drive os comprovantes, as fotos dos promotores e os XMLs das notas do trimestre,
          mais as planilhas de horário de promotores e motoristas. <strong>Nada é apagado do sistema</strong> — esta
          etapa só gera o arquivo para vocês conferirem.
        </p>

        <div style={{ maxWidth: 320 }}>
          <Select label="Trimestre" value={escolhido} onChange={(e) => trocar(e.target.value)}
            options={trimestres.map((t) => ({ value: t.nome, label: t.encerrado ? t.nome : `${t.nome} (em andamento)` }))} />
        </div>
        {tri && !tri.encerrado && (
          <div style={{ marginTop: 12 }}>
            <Aviso tipo="aviso">Este trimestre ainda não acabou: o arquivo sairia incompleto. Prefira um já encerrado.</Aviso>
          </div>
        )}
        {!online && <div style={{ marginTop: 12 }}><Aviso tipo="erro">Sem internet. Precisa de conexão para baixar os arquivos.</Aviso></div>}

        <div style={{ marginTop: 16 }}>
          <Btn icon="search" onClick={conferir} disabled={ocupado || !online} style={{ opacity: ocupado || !online ? 0.6 : 1 }}>
            {etapa && !progresso ? etapa : "1. Conferir o que entra"}
          </Btn>
        </div>
      </Card>

      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {plano && (
        <Card>
          <h3 style={{ margin: "0 0 10px", fontSize: 16, color: COLORS.cinzaEscuro }}>{tri.nome}</h3>
          {resumo.total === 0 && <p style={{ margin: 0, fontSize: 13, color: COLORS.cinza }}>Nenhum arquivo neste trimestre.</p>}
          {Object.entries(resumo.porGrupo).map(([grupo, n]) => (
            <div key={grupo} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderTop: `1px solid ${COLORS.cinzaClaro}`, fontSize: 13 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.cinza }}>
                <Icon name={NOME_GRUPO_ICONE[grupo] ?? "anexo"} size={16} color={COLORS.cinza} /> {grupo}
              </span>
              <strong style={{ color: COLORS.cinzaEscuro }}>{n} arquivo{n === 1 ? "" : "s"}</strong>
            </div>
          ))}
          {resumo.planilhas.map((p) => (
            <div key={p.caminho} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "9px 0", borderTop: `1px solid ${COLORS.cinzaClaro}`, fontSize: 13 }}>
              <span style={{ color: COLORS.cinza }}>{p.caminho.split("/").pop()}</span>
              <strong style={{ color: COLORS.cinzaEscuro }}>{p.linhas} linha{p.linhas === 1 ? "" : "s"}</strong>
            </div>
          ))}

          {plano.avisos.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {plano.avisos.map((a) => <Aviso key={a} tipo="erro">{a}</Aviso>)}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
            {podeGravarEmPasta() && (
              <Btn icon="check" onClick={() => salvar("pasta")} disabled={ocupado || !online || plano.avisos.length > 0}
                style={{ opacity: ocupado || !online || plano.avisos.length > 0 ? 0.6 : 1 }}>
                2. Escolher a pasta do Drive e salvar
              </Btn>
            )}
            <Btn variant="secondary" icon="anexo" onClick={() => salvar("zip")} disabled={ocupado || !online || plano.avisos.length > 0}
              style={{ opacity: ocupado || !online || plano.avisos.length > 0 ? 0.6 : 1 }}>
              {podeGravarEmPasta() ? "Ou baixar em ZIPs" : "2. Baixar em ZIPs"}
            </Btn>
          </div>
          <p style={{ margin: "12px 0 0", fontSize: 12, color: COLORS.cinza, lineHeight: 1.6 }}>
            Use o computador e deixe esta aba aberta até terminar.
            {podeGravarEmPasta()
              ? " Escolhendo a pasta, os arquivos já ficam organizados lá dentro, sem ZIP."
              : " Este navegador não grava direto em pasta (use Chrome ou Edge para isso): os arquivos saem em ZIPs de ~150 MB — libere os downloads múltiplos se o navegador perguntar."}
          </p>
        </Card>
      )}

      {progresso && (
        <Card>
          <div style={{ fontSize: 13, color: COLORS.cinzaEscuro, marginBottom: 8 }}>
            Salvando {progresso.feitos} de {progresso.total} ({pct}%)
          </div>
          <div style={{ height: 8, borderRadius: 99, background: COLORS.cinzaClaro, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: COLORS.verde, transition: "width 0.2s" }} />
          </div>
          <div style={{ fontSize: 11, color: COLORS.cinza, marginTop: 8, wordBreak: "break-all" }}>{progresso.atual}</div>
          {etapa && <div style={{ fontSize: 12, color: COLORS.verde, marginTop: 6 }}>{etapa}</div>}
          <div style={{ marginTop: 12 }}>
            <Btn variant="secondary" onClick={() => { cancelar.current = true; }}>Parar</Btn>
          </div>
        </Card>
      )}

      {resultado && (
        <Card>
          <Aviso tipo={resultado.completo ? "ok" : "erro"}>
            {resultado.completo
              ? `Arquivo completo: ${resultado.gravados} arquivos${resultado.pasta ? ` na pasta «${resultado.pasta}»` : " em ZIPs"}, mais as planilhas, o índice e o LEIA-ME. Nada foi apagado do sistema.`
              : resultado.cancelado
                ? "Interrompido: o arquivo está incompleto. Rode de novo antes de qualquer limpeza."
                : `Arquivo INCOMPLETO: ${resultado.falhas.length} arquivo(s) não vieram. Rode de novo antes de qualquer limpeza.`}
          </Aviso>
          {resultado.falhas.length > 0 && (
            <ul style={{ margin: "12px 0 0", paddingLeft: 18, fontSize: 12, color: COLORS.vermelho, lineHeight: 1.6, wordBreak: "break-all" }}>
              {resultado.falhas.slice(0, 50).map((f) => <li key={f}>{f}</li>)}
              {resultado.falhas.length > 50 && <li>…e mais {resultado.falhas.length - 50} (veja o LEIA-ME.txt)</li>}
            </ul>
          )}
          {resultado.completo && (
            <p style={{ margin: "12px 0 0", fontSize: 12, color: COLORS.cinza, lineHeight: 1.6 }}>
              Confira por amostragem: abra algumas fotos, comprovantes e XMLs. Guarde a pasta em dois lugares.
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";

import { Btn, Card, Icon, Input } from "./ui";
import { supabase, supabaseConfigurado } from "../lib/supabase";
import { COLORS } from "../lib/tema";

/**
 * Avisos no celular (ntfy) — só sócio master. Mostra se o aviso está ligado
 * de verdade (tópico gravado, pg_net, pg_cron e cada agendamento), grava o
 * tópico, manda um teste e religa os agendamentos. Tudo pelas funções da
 * supabase/migracao-55-avisos-celular.sql; sem ela, explica o que rodar.
 */

const LEMBRETES = {
  "aviso-falta-pedidos": "Falta de pedido — todo dia 7h45",
  "lembrete-contagem-frutas": "Contagem de frutas — todo dia 16h30",
  "lembrete-contagem-insumos": "Contagem de insumos — segunda 16h",
  "lembrete-preco-frutas": "Conferência de preços — segunda 7h",
};

const Linha = ({ rotulo, ok, texto }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "9px 0", borderTop: `1px solid ${COLORS.cinzaClaro}`, fontSize: 13 }}>
    <span style={{ color: COLORS.cinzaEscuro }}>{rotulo}</span>
    <span style={{ color: ok ? COLORS.verde : COLORS.vermelho, fontWeight: 600, textAlign: "right" }}>{texto}</span>
  </div>
);

const semMigracao = (erro) => /avisos_celular_status|Could not find the function|does not exist/i.test(String(erro?.message ?? erro));

export default function AvisosCelular() {
  const [status, setStatus] = useState(null);
  const [erro, setErro] = useState(null);
  const [topico, setTopico] = useState("");
  const [urlApp, setUrlApp] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState(null);

  const aplicar = useCallback((s) => {
    setStatus(s);
    setTopico(s?.topico ?? "");
    setUrlApp(s?.url_app ?? "");
  }, []);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.rpc("avisos_celular_status");
    if (error) setErro(error);
    else { setErro(null); aplicar(data); }
  }, [aplicar]);

  useEffect(() => {
    if (!supabaseConfigurado) return;
    let ativo = true;
    supabase.rpc("avisos_celular_status").then(({ data, error }) => {
      if (!ativo) return;
      if (error) setErro(error);
      else aplicar(data);
    });
    return () => { ativo = false; };
  }, [aplicar]);

  if (!supabaseConfigurado) return null;

  const executar = async (fn, mensagem) => {
    setOcupado(true);
    setAviso(null);
    try {
      const { data, error } = await fn();
      if (error) throw error;
      if (typeof data === "string" && data !== "ok") throw new Error(data);
      setAviso({ tipo: "ok", texto: mensagem });
      await carregar();
    } catch (e) {
      setAviso({ tipo: "erro", texto: String(e?.message ?? e) });
    } finally {
      setOcupado(false);
    }
  };

  const salvar = () => executar(
    () => supabase.rpc("avisos_celular_configurar", { p_topico: topico.trim(), p_url_app: urlApp.trim() || window.location.origin + "/", p_ativo: true }),
    "Tópico gravado. Agora toque em Enviar teste."
  );

  const jobs = status?.jobs ?? [];
  const ultimoEnvio = status?.envios?.[0];
  const envioOk = ultimoEnvio && !ultimoEnvio.erro && ultimoEnvio.codigo >= 200 && ultimoEnvio.codigo < 300;
  const tudoCerto = status && status.ativo && status.topico && status.pg_net && status.pg_cron
    && status.gatilho_pedido && status.gatilho_entrega
    && Object.keys(LEMBRETES).every((n) => jobs.some((j) => j.nome === n && j.ativo));

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <Icon name="alert" color={COLORS.verde} />
        <h3 style={{ margin: 0, fontSize: 16, color: COLORS.cinzaEscuro }}>Avisos no celular (ntfy)</h3>
      </div>
      <p style={{ margin: "0 0 10px", fontSize: 12.5, color: COLORS.cinza, lineHeight: 1.5 }}>
        Pedido novo, saída e entrega, falta de pedido dos clientes e os lembretes de contagem e preço chegam no
        app gratuito <strong>ntfy</strong>, inscrito no tópico abaixo. No banco novo o tópico precisa ser gravado
        de novo — sem ele nenhum aviso sai.
      </p>

      {erro ? (
        <div style={{ background: "#FFF3CD", borderRadius: 9, padding: 12, fontSize: 13, color: "#856404", lineHeight: 1.5 }}>
          {semMigracao(erro)
            ? <>Falta rodar <code>supabase/migracao-55-avisos-celular.sql</code> no SQL Editor do Supabase.</>
            : String(erro.message ?? erro)}
        </div>
      ) : !status ? (
        <div style={{ fontSize: 13, color: COLORS.cinza }}>Carregando…</div>
      ) : (
        <>
          <div style={{
            margin: "4px 0 8px", padding: "10px 12px", borderRadius: 9, fontSize: 13.5, fontWeight: 700,
            background: tudoCerto ? COLORS.verdePale : "#FFEBEE", color: tudoCerto ? COLORS.verde : COLORS.vermelho,
          }}>
            {tudoCerto ? "Tudo ligado." : "Tem coisa desligada — veja abaixo."}
          </div>
          <Linha rotulo="Tópico gravado" ok={!!status.topico} texto={status.topico || "Nenhum — nada é enviado"} />
          <Linha rotulo="Avisos ligados" ok={status.ativo} texto={status.ativo ? "Sim" : "Desligados"} />
          <Linha rotulo="Envio (pg_net)" ok={status.pg_net} texto={status.pg_net ? "Instalado" : "Faltando"} />
          <Linha rotulo="Agendamento (pg_cron)" ok={status.pg_cron} texto={status.pg_cron ? "Instalado" : "Ligue em Database → Extensions → pg_cron"} />
          <Linha rotulo="Aviso de pedido novo" ok={status.gatilho_pedido} texto={status.gatilho_pedido ? "Ligado" : "Faltando — rode a migracao-20"} />
          <Linha rotulo="Saiu para entrega / entrega realizada" ok={status.gatilho_entrega} texto={status.gatilho_entrega ? "Ligado (um aviso por rota e por parada)" : "Faltando — rode a migracao-55"} />
          <Linha rotulo="Promotores: tela ao vivo (Realtime)" ok={status.tempo_real_promotores} texto={status.tempo_real_promotores ? "Ligado" : "Desligado — rode a migracao-55 de novo"} />
          <Linha rotulo="Promotores: pasta de fotos" ok={status.fotos_promotores} texto={status.fotos_promotores ? "Criada" : "Faltando — rode a migracao-08-promotores"} />
          {Object.entries(LEMBRETES).map(([nome, rotulo]) => {
            const j = jobs.find((x) => x.nome === nome);
            const falhou = j?.status === "failed";
            return (
              <Linha key={nome} rotulo={rotulo} ok={!!j?.ativo && !falhou}
                texto={!j ? "Não agendado" : falhou ? `Falhou: ${j.erro ?? ""}` : j.ultima ? `Rodou ${new Date(j.ultima).toLocaleString("pt-BR")}` : "Agendado"} />
            );
          })}
          {ultimoEnvio && (
            <Linha rotulo="Último envio ao ntfy" ok={envioOk}
              texto={`${new Date(ultimoEnvio.quando).toLocaleString("pt-BR")} · ${ultimoEnvio.erro || `código ${ultimoEnvio.codigo}`}`} />
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 14 }}>
            <Input label="Tópico do ntfy" placeholder="ex.: carvalhocruz-pedidos-x7k2q9" value={topico}
              onChange={(e) => setTopico(e.target.value.replace(/\s/g, ""))} />
            <Input label="Endereço do app (abre ao tocar no aviso)" placeholder={window.location.origin + "/"} value={urlApp}
              onChange={(e) => setUrlApp(e.target.value)} />
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: COLORS.cinza, lineHeight: 1.5 }}>
            Use o mesmo tópico em que os celulares já estão inscritos no ntfy (ou invente um difícil de adivinhar e
            inscreva os celulares nele: no ntfy, toque em + e digite o tópico).
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
            <Btn onClick={salvar} disabled={ocupado || !topico.trim()}>Gravar tópico</Btn>
            <Btn variant="secondary" disabled={ocupado || !status.topico}
              onClick={() => executar(() => supabase.rpc("avisos_celular_testar"), "Teste enviado — confira o celular.")}>
              Enviar teste
            </Btn>
            <Btn variant="secondary" disabled={ocupado || !status.topico}
              onClick={() => executar(() => supabase.rpc("avisos_celular_testar_falta_pedidos"), "Aviso de falta de pedido enviado (se houver cliente atrasado ou esperado hoje).")}>
              Testar falta de pedido
            </Btn>
            <Btn variant="secondary" disabled={ocupado}
              onClick={() => executar(() => supabase.rpc("avisos_celular_agendar"), "Lembretes agendados.")}>
              Religar agendamentos
            </Btn>
            {status.topico && (
              <Btn variant="secondary" disabled={ocupado}
                onClick={() => executar(() => supabase.rpc("avisos_celular_configurar", { p_topico: status.topico, p_url_app: status.url_app, p_ativo: !status.ativo }),
                  status.ativo ? "Avisos desligados." : "Avisos ligados.")}>
                {status.ativo ? "Desligar avisos" : "Ligar avisos"}
              </Btn>
            )}
          </div>
        </>
      )}

      {aviso && (
        <div style={{ marginTop: 12, fontSize: 13, color: aviso.tipo === "ok" ? COLORS.verde : COLORS.vermelho }}>{aviso.texto}</div>
      )}
    </Card>
  );
}

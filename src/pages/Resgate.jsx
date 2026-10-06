import { useEffect, useState } from "react";

import Logo from "../components/Logo";
import { Btn, Card, Icon } from "../components/ui";
import { COLECOES, lerMeta } from "../lib/db";
import {
  baixarResgate,
  contarResgate,
  dadosAte,
  enviarResgate,
  juntarResgates,
  lerArquivoResgate,
  montarResgate,
} from "../lib/resgate";
import { supabase } from "../lib/supabase";
import { adotarBancoAtual, bancoDaCopia, copiaDeOutroBanco } from "../lib/sync";
import { COLORS, FONTE } from "../lib/tema";

const ROTULOS = {
  redes: "Redes",
  lojas: "Lojas",
  fornecedores: "Fornecedores",
  produtos: "Produtos",
  vendas: "Vendas",
  compras: "Compras",
  perdas: "Perdas",
  despesas: "Despesas",
  acertos: "Acertos de estoque",
  veiculos: "Veículos",
  abastecimentos: "Abastecimentos",
  funcionarios: "Funcionários",
  pagamentos: "Pagamentos da folha",
  notas_entrada: "Notas de entrada",
  insumos_itens: "Insumos",
  contagens_insumos: "Contagens de insumos",
  precos_produtos: "Preços",
  metas: "Metas",
  nfe_arquivadas: "NF-e de pedidos apagados",
};

const dataHora = (iso) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "nunca";

const Aviso = ({ tipo = "info", children }) => {
  const cores = {
    erro: { fundo: "#FFEBEE", borda: "#F5C2C7", texto: "#B02A37" },
    ok: { fundo: COLORS.verdePale, borda: "#A7D8BB", texto: COLORS.verde },
    info: { fundo: "#FFF3CD", borda: "#FFCC02", texto: "#856404" },
  }[tipo];
  return (
    <div role={tipo === "erro" ? "alert" : "status"}
      style={{ background: cores.fundo, border: `1px solid ${cores.borda}`, borderRadius: 9, padding: "10px 13px", color: cores.texto, fontSize: 13, lineHeight: 1.5 }}>
      {children}
    </div>
  );
};

const Contagem = ({ porColecao }) => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "4px 16px" }}>
    {COLECOES.filter((c) => porColecao[c] > 0).map((c) => (
      <div key={c} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0", borderBottom: `1px solid ${COLORS.cinzaClaro}` }}>
        <span style={{ color: COLORS.cinza }}>{ROTULOS[c] ?? c}</span>
        <strong style={{ color: COLORS.cinzaEscuro }}>{porColecao[c]}</strong>
      </div>
    ))}
  </div>
);

const Titulo = ({ numero, children }) => (
  <h2 style={{ margin: "0 0 4px", fontSize: 17, color: COLORS.cinzaEscuro, display: "flex", gap: 8, alignItems: "center" }}>
    <span style={{ background: COLORS.verde, color: COLORS.branco, borderRadius: 99, width: 24, height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{numero}</span>
    {children}
  </h2>
);

/**
 * Página de resgate, fora do login: funciona mesmo com o banco da nuvem fora
 * do ar. Salva a cópia que o aparelho guarda, libera o aparelho para o banco
 * novo e, para o sócio master, envia as cópias juntas para o banco novo.
 */
export default function Resgate() {
  const [local, setLocal] = useState(null);
  const [erroLocal, setErroLocal] = useState(null);
  const [baixado, setBaixado] = useState(false);
  const [outroBanco, setOutroBanco] = useState(false);
  const [origem, setOrigem] = useState(null);
  const [copiaAntiga, setCopiaAntiga] = useState(null);
  const [liberado, setLiberado] = useState(false);

  const [arquivos, setArquivos] = useState([]);
  const [erroArquivos, setErroArquivos] = useState(null);
  const [sessao, setSessao] = useState(null);
  const [progresso, setProgresso] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const resgate = await montarResgate();
        const [deOutro, deOnde, antiga] = await Promise.all([
          copiaDeOutroBanco(), bancoDaCopia(), lerMeta("copiaAntiga"),
        ]);
        if (!ativo) return;
        setCopiaAntiga(antiga ?? null);
        setLocal({ resgate, ...contarResgate(resgate) });
        setOutroBanco(deOutro);
        setOrigem(deOnde);
      } catch (err) {
        if (ativo) setErroLocal(String(err?.message ?? err));
      }
    })();
    supabase?.auth.getSession().then(({ data }) => {
      if (ativo) setSessao(data?.session ?? null);
    });
    return () => {
      ativo = false;
    };
  }, []);

  const baixar = async () => {
    const resgate = await montarResgate();
    baixarResgate(resgate);
    setBaixado(true);
  };

  const liberar = async () => {
    if (!baixado && !confirm("Você já salvou a cópia deste aparelho?\n\nDepois de liberado, o aparelho passa a seguir o banco novo e a cópia antiga é substituída na próxima sincronização.")) return;
    await adotarBancoAtual();
    setLiberado(true);
    setOutroBanco(false);
  };

  const escolherArquivos = async (e) => {
    setErroArquivos(null);
    setResultado(null);
    const lidos = [];
    for (const arquivo of e.target.files ?? []) {
      try {
        lidos.push(await lerArquivoResgate(arquivo));
      } catch (err) {
        setErroArquivos(String(err?.message ?? err));
      }
    }
    setArquivos(lidos);
  };

  const juntado = arquivos.length ? juntarResgates(arquivos) : null;
  const totaisJuntados = juntado
    ? Object.fromEntries(COLECOES.map((c) => [c, juntado.linhas[c].length]))
    : null;
  const totalJuntado = totaisJuntados ? Object.values(totaisJuntados).reduce((s, n) => s + n, 0) : 0;

  const enviar = async () => {
    if (!confirm(`Enviar ${totalJuntado} registros para o banco novo?\n\nPode repetir sem medo: o que já estiver lá é atualizado, não duplicado.`)) return;
    setEnviando(true);
    setResultado(null);
    try {
      setResultado(await enviarResgate(supabase, juntado.linhas, setProgresso));
    } catch (err) {
      setResultado([{ colecao: "envio", total: 0, enviadas: 0, erro: String(err?.message ?? err) }]);
    } finally {
      setProgresso(null);
      setEnviando(false);
    }
  };

  const falhasEnvio = resultado?.filter((r) => r.erro) ?? [];

  return (
    <div style={{ fontFamily: FONTE, minHeight: "100vh", background: COLORS.creme, padding: "24px 16px 48px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <Logo variante="assinatura" altura={90} />
          <h1 style={{ margin: "8px 0 0", fontSize: 21, color: COLORS.cinzaEscuro }}>Resgate de dados</h1>
          <p style={{ margin: 0, fontSize: 13, color: COLORS.cinza, textAlign: "center" }}>
            Funciona sem login e sem internet. Nada aqui apaga dados.
          </p>
        </div>

        {/* 1. Salvar a cópia deste aparelho */}
        <Card>
          <Titulo numero={1}>Salvar a cópia deste aparelho</Titulo>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: COLORS.cinza }}>
            Faça isto em <strong>cada</strong> computador e celular que usava o sistema e mande o arquivo para o sócio master.
          </p>

          {erroLocal && <Aviso tipo="erro">Não foi possível ler os dados deste aparelho: {erroLocal}</Aviso>}
          {!local && !erroLocal && <div style={{ fontSize: 13, color: COLORS.cinza }}>Lendo os dados deste aparelho…</div>}

          {local && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {local.total === 0 && local.fila === 0 ? (
                <Aviso>Este aparelho não tem dados guardados. Não precisa enviar arquivo dele.</Aviso>
              ) : (
                <>
                  <div style={{ fontSize: 14, color: COLORS.cinzaEscuro }}>
                    <strong>{local.total}</strong> registros guardados
                    {local.fila > 0 && <> · <strong>{local.fila}</strong> {local.fila === 1 ? "lançamento que ainda não tinha subido" : "lançamentos que ainda não tinham subido"}</>}
                    <div style={{ fontSize: 12.5, color: COLORS.cinza, marginTop: 2 }}>
                      Dados até: {dataHora(dadosAte(local.resgate))}
                    </div>
                  </div>
                  <Contagem porColecao={local.porColecao} />
                  <Btn icon="check" onClick={baixar} style={{ alignSelf: "flex-start" }}>
                    Baixar cópia deste aparelho
                  </Btn>
                  {baixado && (
                    <Aviso tipo="ok">
                      Arquivo salvo (procure em <strong>Downloads</strong>, com nome começando por
                      “resgate-distribuidora”). Mande pelo WhatsApp ou e-mail para o sócio master.
                    </Aviso>
                  )}
                </>
              )}
            </div>
          )}

          {copiaAntiga && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${COLORS.cinzaClaro}`, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 13, color: COLORS.cinza }}>
                Este aparelho passou sozinho para o banco novo e guardou a cópia que tinha do banco antigo:
                {" "}<strong>{contarResgate(copiaAntiga).total}</strong> registros, dados até {dataHora(dadosAte(copiaAntiga))}.
              </div>
              <Btn variant="ghost" icon="check" onClick={() => baixarResgate(copiaAntiga)} style={{ alignSelf: "flex-start" }}>
                Baixar cópia do banco antigo
              </Btn>
            </div>
          )}
        </Card>

        {/* 2. Liberar este aparelho para o banco novo */}
        {(outroBanco || liberado) && (
          <Card>
            <Titulo numero={2}>Usar o banco novo neste aparelho</Titulo>
            {liberado ? (
              <Aviso tipo="ok">
                Pronto. Volte para o sistema e entre: este aparelho passa a mostrar o que está no banco novo.
              </Aviso>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ margin: 0, fontSize: 13, color: COLORS.cinza, lineHeight: 1.5 }}>
                  O sistema agora usa um banco novo, e este aparelho está parado para não perder nada
                  {origem ? " (a cópia dele veio do banco antigo)" : ""}. <strong>Primeiro salve a cópia no passo 1</strong>
                  {" "}e espere o sócio master avisar que os dados foram restaurados. Depois toque abaixo.
                </p>
                <Btn variant="ghost" icon="sync" onClick={liberar} style={{ alignSelf: "flex-start" }}>
                  Usar o banco novo
                </Btn>
              </div>
            )}
          </Card>
        )}

        {/* 3. Restaurar no banco novo (sócio master) */}
        <Card>
          <Titulo numero={outroBanco || liberado ? 3 : 2}>Restaurar no banco novo (sócio master)</Titulo>
          <p style={{ margin: "0 0 14px", fontSize: 13, color: COLORS.cinza, lineHeight: 1.5 }}>
            Escolha <strong>todos</strong> os arquivos de resgate recebidos de uma vez. O sistema junta tudo: vale a cópia
            mais recente e, das outras, só o que foi criado depois dela e o que ainda não tinha sido enviado — o que foi
            apagado no meio-tempo não volta.
          </p>

          {!sessao ? (
            <Aviso>
              Para enviar, entre primeiro no sistema com a conta de <strong>sócio master</strong> do banco novo e depois
              volte a esta página (endereço do sistema + <strong>/resgate</strong>).
            </Aviso>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 12.5, color: COLORS.cinza }}>
                Conectado como <strong>{sessao.user?.email}</strong>
              </div>

              <input type="file" accept=".json,application/json" multiple onChange={escolherArquivos} disabled={enviando}
                style={{ fontSize: 13 }} />
              {erroArquivos && <Aviso tipo="erro">{erroArquivos}</Aviso>}

              {arquivos.length > 0 && (
                <div style={{ fontSize: 12.5, color: COLORS.cinza, display: "flex", flexDirection: "column", gap: 3 }}>
                  {arquivos.map((a) => (
                    <div key={a.nomeArquivo}>
                      <Icon name="anexo" size={12} color={COLORS.cinza} /> {a.nomeArquivo} — {contarResgate(a).total} registros,
                      dados até {dataHora(dadosAte(a))}
                    </div>
                  ))}
                </div>
              )}

              {juntado && (
                <>
                  <div style={{ fontSize: 14, color: COLORS.cinzaEscuro }}>
                    Juntando tudo: <strong>{totalJuntado}</strong> registros
                  </div>
                  <Contagem porColecao={totaisJuntados} />
                  <Btn icon="cloud" onClick={enviar} disabled={enviando || totalJuntado === 0} style={{ alignSelf: "flex-start" }}>
                    {enviando ? "Enviando…" : "Enviar para o banco novo"}
                  </Btn>
                </>
              )}

              {progresso && (
                <div style={{ fontSize: 13, color: COLORS.cinza }}>
                  Enviando {ROTULOS[progresso.colecao] ?? progresso.colecao}: {progresso.enviadas} de {progresso.total}…
                </div>
              )}

              {resultado && (falhasEnvio.length === 0 ? (
                <Aviso tipo="ok">
                  Tudo enviado. Agora, em cada aparelho, abra esta página e toque em <strong>Usar o banco novo</strong>
                  {" "}(comece por este).
                </Aviso>
              ) : (
                <Aviso tipo="erro">
                  Algumas tabelas não subiram — tire um print e mande para o suporte do sistema:
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    {falhasEnvio.map((r) => (
                      <li key={r.colecao}>
                        {ROTULOS[r.colecao] ?? r.colecao}: {r.enviadas} de {r.total} — {r.erro}
                      </li>
                    ))}
                  </ul>
                </Aviso>
              ))}
            </div>
          )}
        </Card>

        <a href="/" style={{ alignSelf: "center", color: COLORS.verde, fontSize: 13, fontWeight: 600 }}>
          Voltar para o sistema
        </a>
      </div>
    </div>
  );
}

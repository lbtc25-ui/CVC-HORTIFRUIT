import { useCallback, useEffect, useState } from "react";

import AvisosCelular from "../components/AvisosCelular";
import { Btn, Card, Icon, TabelaRolavel } from "../components/ui";
import { useAuth } from "../contexts/auth-context";
import { useSyncStatus } from "../hooks/useSyncStatus";
import { MAX_TENTATIVAS, apagarOp, lerFila, reativarFalhas } from "../lib/db";
import { supabaseConfigurado } from "../lib/supabase";
import { atualizarContadores } from "../lib/sync";
import { COLORS } from "../lib/tema";

const ROTULOS = {
  redes: "Rede",
  lojas: "Loja",
  fornecedores: "Fornecedor",
  produtos: "Produto",
  vendas: "Venda",
  compras: "Compra",
  perdas: "Perda",
  despesas: "Despesa",
  acertos: "Acerto de estoque",
};

const Linha = ({ rotulo, valor, cor }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: `1px solid ${COLORS.cinzaClaro}`, gap: 16 }}>
    <span style={{ fontSize: 13, color: COLORS.cinza }}>{rotulo}</span>
    <span style={{ fontSize: 13, fontWeight: 600, color: cor || COLORS.cinzaEscuro, textAlign: "right", wordBreak: "break-word" }}>{valor}</span>
  </div>
);

/**
 * Painel de diagnóstico da sincronização: o que está esperando para subir,
 * o que falhou e por quê. Sem isso, "salvei mas não chegou" vira um mistério.
 */
export default function Sincronizacao({ erroCarga, sincronizarAgora, recarregarDaNuvem }) {
  const status = useSyncStatus();
  const { papel } = useAuth();
  const [fila, setFila] = useState([]);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState(null);

  const recarregarFila = useCallback(async () => {
    setFila(await lerFila());
  }, []);

  // Relê a fila do IndexedDB sempre que os contadores do motor mudam.
  useEffect(() => {
    let ativo = true;
    lerFila().then((itens) => {
      if (ativo) setFila(itens);
    });
    return () => {
      ativo = false;
    };
  }, [status.pendentes, status.falhas, status.sincronizando]);

  const pendentes = fila.filter((op) => op.tentativas < MAX_TENTATIVAS);
  const falhas = fila.filter((op) => op.tentativas >= MAX_TENTATIVAS);

  /**
   * Joga fora uma operação que falhou de vez.
   *
   * Sem isso, uma operação presa — a que tenta salvar um registro que já foi
   * apagado, por exemplo — só saía com "Recarregar da nuvem", que apaga o
   * banco local inteiro e leva junto o que ainda não subiu.
   *
   * Descartar remove só o envio. O que está na tela continua como está: se o
   * registro ainda existir aqui e não na nuvem, a próxima leitura o remove.
   */
  const descartar = async (op) => {
    const oque = ROTULOS[op.tabela] ?? op.tabela;
    const acao = op.acao === "delete" ? "exclusão" : "gravação";
    if (!confirm(`Descartar a ${acao} de ${oque.toLowerCase()} que falhou ${op.tentativas} vezes?\n\nEla não será enviada para a nuvem.`)) return;
    await apagarOp(op.id);
    await atualizarContadores();
    await recarregarFila();
    setAviso({ tipo: "ok", texto: "Operação descartada." });
  };

  const executar = async (fn, mensagem) => {
    setOcupado(true);
    setAviso(null);
    try {
      await fn();
      setAviso({ tipo: "ok", texto: mensagem });
    } catch (err) {
      setAviso({ tipo: "erro", texto: String(err?.message ?? err) });
    } finally {
      await recarregarFila();
      setOcupado(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 760 }}>
      {/* Situação */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Icon name="cloud" color={COLORS.verde} />
          <h3 style={{ margin: 0, fontSize: 16, color: COLORS.cinzaEscuro }}>Situação</h3>
        </div>

        <Linha
          rotulo="Banco na nuvem"
          valor={supabaseConfigurado ? "Supabase configurado" : "Não configurado (modo local)"}
          cor={supabaseConfigurado ? COLORS.verde : COLORS.laranjaEscuro}
        />
        <Linha
          rotulo="Conexão"
          valor={status.online ? "Online" : "Offline"}
          cor={status.online ? COLORS.verde : COLORS.laranjaEscuro}
        />
        <Linha rotulo="Na fila para enviar" valor={pendentes.length} cor={pendentes.length ? COLORS.laranja : COLORS.cinzaEscuro} />
        <Linha rotulo="Falharam" valor={falhas.length} cor={falhas.length ? COLORS.vermelho : COLORS.cinzaEscuro} />
        <Linha
          rotulo="Última sincronização"
          valor={status.ultimaSync ? new Date(status.ultimaSync).toLocaleString("pt-BR") : "—"}
        />
        {status.erro && <Linha rotulo="Último erro" valor={status.erro} cor={COLORS.vermelho} />}
        {erroCarga && <Linha rotulo="Erro ao abrir o banco local" valor={erroCarga} cor={COLORS.vermelho} />}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
          <Btn
            icon="sync"
            onClick={() => executar(async () => {
              await sincronizarAgora();
              await atualizarContadores();
            }, "Sincronização concluída.")}
            style={{ opacity: ocupado || !supabaseConfigurado ? 0.6 : 1 }}
          >
            {status.sincronizando ? "Sincronizando…" : "Sincronizar agora"}
          </Btn>

          {falhas.length > 0 && (
            <Btn
              variant="secondary"
              onClick={() => executar(async () => {
                const n = await reativarFalhas();
                await atualizarContadores();
                await sincronizarAgora();
                return n;
              }, "Operações reenviadas para a fila.")}
            >
              Tentar novamente
            </Btn>
          )}

          <Btn
            variant="secondary"
            onClick={() => executar(recarregarDaNuvem, "Dados recarregados da nuvem.")}
            style={{ opacity: ocupado || !supabaseConfigurado ? 0.6 : 1 }}
          >
            Recarregar da nuvem
          </Btn>
        </div>

        {aviso && (
          <div style={{ marginTop: 14, fontSize: 13, color: aviso.tipo === "ok" ? COLORS.verde : COLORS.vermelho }}>
            {aviso.texto}
          </div>
        )}

        {!supabaseConfigurado && (
          <div style={{ marginTop: 14, background: COLORS.cinzaClaro, borderRadius: 9, padding: 14, fontSize: 13, color: COLORS.cinzaEscuro, lineHeight: 1.55 }}>
            Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no
            arquivo <code>.env.local</code> (e nas variáveis de ambiente do Vercel) para
            guardar os dados na nuvem. Enquanto isso, tudo fica salvo apenas neste aparelho.
          </div>
        )}
      </Card>

      {papel === "socio_master" && <AvisosCelular />}

      {/* Fila */}
      {(pendentes.length > 0 || falhas.length > 0) && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px 12px" }}>
            <h3 style={{ margin: 0, fontSize: 16, color: COLORS.cinzaEscuro }}>Fila de envio</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: COLORS.cinza }}>
              As operações são enviadas na ordem em que foram feitas.
            </p>
          </div>
          <TabelaRolavel>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: COLORS.cinzaClaro }}>
                <tr>
                  {["Quando", "O quê", "Ação", "Tentativas", "Erro", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", fontSize: 11, color: COLORS.cinza, padding: "10px 16px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...falhas, ...pendentes].map((op) => (
                  <tr key={op.id} style={{ borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
                    <td style={{ padding: "11px 16px", fontSize: 12, color: COLORS.cinza, whiteSpace: "nowrap" }}>
                      {new Date(op.criadoEm).toLocaleString("pt-BR")}
                    </td>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: COLORS.cinzaEscuro }}>
                      {ROTULOS[op.tabela] ?? op.tabela}
                    </td>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: COLORS.cinza }}>
                      {op.acao === "delete" ? "Excluir" : "Salvar"}
                    </td>
                    <td style={{ padding: "11px 16px", fontSize: 13, color: op.tentativas >= MAX_TENTATIVAS ? COLORS.vermelho : COLORS.cinza }}>
                      {op.tentativas}/{MAX_TENTATIVAS}
                    </td>
                    <td style={{ padding: "11px 16px", fontSize: 12, color: COLORS.vermelho, maxWidth: 260 }}>
                      {op.erro || "—"}
                    </td>
                    <td style={{ padding: "11px 16px" }}>
                      {op.tentativas >= MAX_TENTATIVAS && (
                        <button
                          onClick={() => descartar(op)}
                          title="Descartar esta operação"
                          style={{ background: "none", border: `1px solid ${COLORS.cinzaClaro}`, borderRadius: 6, padding: "3px 9px", cursor: "pointer", color: COLORS.cinza, fontSize: 12, whiteSpace: "nowrap" }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = COLORS.vermelho; e.currentTarget.style.borderColor = COLORS.vermelho; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = COLORS.cinza; e.currentTarget.style.borderColor = COLORS.cinzaClaro; }}
                        >
                          Descartar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabelaRolavel>
        </Card>
      )}
    </div>
  );
}

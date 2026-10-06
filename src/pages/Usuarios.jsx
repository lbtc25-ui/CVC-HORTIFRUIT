import { useCallback, useEffect, useState } from "react";

import { Badge, Btn, Card, Icon, Input, InputSenha, Modal, Select, TabelaRolavel } from "../components/ui";
import { useAuth } from "../contexts/auth-context";
import {
  atualizarConta,
  criarConta,
  definirSenhaDe,
  enviarLinkRedefinicao,
  listarContas,
  modoSupabase,
  podeExcluirConta,
  removerConta,
} from "../lib/auth";
import { FUNCOES_FUNCIONARIO } from "../lib/folha";
import { novoId } from "../lib/mappers";
import {
  LISTA_PAPEIS, PAPEIS, PAPEIS_CADASTRAVEIS, ROTULO_ABA, abasAjustaveis, abasDaConta, abasDoPapel, eMaster, rotuloPapel,
} from "../lib/permissoes";
import { validarSenha } from "../lib/senha";
import { COLORS } from "../lib/tema";

/** Valor do seletor "Pessoa na folha" que cadastra a pessoa junto com o acesso. */
const NOVA_PESSOA = "__nova__";

const FORM_VAZIO = {
  nome: "", email: "", telefone: "", papel: "assistente_administrativo", senha: "", confirmacao: "",
  pessoaId: NOVA_PESSOA, funcao: "",
};

/** Troca o papel; motorista já sugere a função Motorista e uma pessoa na folha. */
const comPapel = (f, papel) =>
  papel === "motorista"
    ? { ...f, papel, funcao: f.funcao || "Motorista", pessoaId: f.pessoaId || NOVA_PESSOA }
    : { ...f, papel };

/** O motorista acha as entregas pela pessoa da folha ligada a ele. */
const faltaPessoaDoMotorista = (f) => f.papel === "motorista" && !f.pessoaId;

const EtiquetaPapel = ({ papel }) => {
  const cor = PAPEIS[papel]?.cor ?? COLORS.cinza;
  return (
    <span style={{ background: `${cor}1F`, color: cor, padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
      {rotuloPapel(papel)}
    </span>
  );
};

/** Abas que o assistente vê e se ele apaga registros — ajuste por pessoa. */
const AjusteAbas = ({ editando, setEditando }) => {
  const ajustaveis = abasAjustaveis(editando.papel);
  const alternar = (aba) =>
    setEditando((u) => ({ ...u, abas: u.abas.includes(aba) ? u.abas.filter((a) => a !== aba) : [...u.abas, aba] }));
  return (
    <div style={{ border: `1px solid ${COLORS.cinzaClaro}`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.cinzaEscuro }}>Abas liberadas</span>
        <button type="button" onClick={() => setEditando((u) => ({ ...u, abas: abasDoPapel(u.papel) }))}
          style={{ background: "none", border: "none", color: COLORS.verde, fontSize: 12, cursor: "pointer", padding: 0 }}>
          Voltar ao padrão do papel
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "6px 12px" }}>
        {ajustaveis.map((aba) => (
          <label key={aba} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: COLORS.cinzaEscuro, cursor: "pointer" }}>
            <input type="checkbox" checked={editando.abas.includes(aba)} onChange={() => alternar(aba)} />
            {ROTULO_ABA[aba] ?? aba}
          </label>
        ))}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: COLORS.cinzaEscuro, cursor: "pointer", marginTop: 12, paddingTop: 10, borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
        <input type="checkbox" checked={editando.podeExcluir}
          onChange={(e) => setEditando((u) => ({ ...u, podeExcluir: e.target.checked }))} />
        Pode excluir registros (vendas, clientes, pagamentos…)
      </label>
      <div style={{ fontSize: 11.5, color: COLORS.cinza, marginTop: 8, lineHeight: 1.5 }}>
        Excluir usuários e a aba Usuários ficam sempre só com o sócio master.
      </div>
    </div>
  );
};

/** "Pessoa na folha" e "Função" — os mesmos dois campos no novo e no editar. */
const CamposFolha = ({ valor, opcoes, aoMudar }) => (
  <>
    <Select label="Pessoa na folha" value={valor.pessoaId} options={opcoes}
      onChange={(e) => aoMudar({ pessoaId: e.target.value })} />
    <Select label="Função" value={valor.funcao} disabled={!valor.pessoaId}
      options={[
        { value: "", label: valor.pessoaId ? "Selecione..." : "Escolha a pessoa na folha primeiro" },
        ...FUNCOES_FUNCIONARIO.map((f) => ({ value: f, label: f })),
      ]}
      onChange={(e) => aoMudar({ funcao: e.target.value })} />
    <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: -6, lineHeight: 1.5 }}>
      A função fica gravada na pessoa, na Folha de Pagamento. Motorista aparece para montar rota no Romaneio.
    </div>
  </>
);

/**
 * Cadastro de quem entra no sistema — só o sócio master chega aqui.
 *
 * No modo Supabase a conta é criada no Auth e o perfil (nome, papel, ativo)
 * vive na tabela `perfis`. Excluir de vez passa pela função `excluir_usuario`
 * do banco; desativar corta o acesso sem apagar nada.
 *
 * A função (Gerente, Motorista…) não é da conta, é da pessoa na folha
 * (`funcionarios.funcao`) — a conta aponta para ela por
 * `funcionarios.usuario_id`. Escolher a função aqui grava na pessoa ligada,
 * cadastrando-a na folha se ainda não existir.
 */
export default function Usuarios({ dados, setDados }) {
  const { usuario, atualizarUsuario } = useAuth();

  const [contas, setContas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const [modalNovo, setModalNovo] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [editando, setEditando] = useState(null);
  const [trocandoSenha, setTrocandoSenha] = useState(null);
  const [novaSenha, setNovaSenha] = useState({ senha: "", confirmacao: "" });

  const recarregar = useCallback(async () => {
    try {
      const lista = await listarContas();
      setContas(lista);
    } catch (err) {
      setAviso({ tipo: "erro", texto: String(err?.message ?? err) });
    } finally {
      setCarregando(false);
    }
  }, []);

  // Carga inicial da lista. O estado só muda depois do await, já fora do
  // corpo do efeito, e a primeira pintura sai com `carregando` ligado.
  useEffect(() => {
    let ativo = true;

    (async () => {
      try {
        const lista = await listarContas();
        if (ativo) setContas(lista);
      } catch (err) {
        if (ativo) setAviso({ tipo: "erro", texto: String(err?.message ?? err) });
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, []);

  /** Envolve as ações para não repetir o par try/catch + aviso em cada botão. */
  const executar = async (acao, mensagem) => {
    setOcupado(true);
    setAviso(null);
    try {
      await acao();
      await recarregar();
      if (mensagem) setAviso({ tipo: "ok", texto: mensagem });
      return true;
    } catch (err) {
      setAviso({ tipo: "erro", texto: String(err?.message ?? err) });
      return false;
    } finally {
      setOcupado(false);
    }
  };

  const salvarNovo = async () => {
    if (faltaPessoaDoMotorista(form)) {
      return setAviso({ tipo: "erro", texto: "Motorista precisa estar ligado a uma pessoa na folha — é por ela que o romaneio o escala." });
    }
    const problema = validarSenha(form.senha);
    if (problema) return setAviso({ tipo: "erro", texto: problema });
    if (form.senha !== form.confirmacao) {
      return setAviso({ tipo: "erro", texto: "As senhas não conferem." });
    }

    const ok = await executar(
      async () => {
        const conta = await criarConta({ nome: form.nome, email: form.email, telefone: form.telefone, senha: form.senha, papel: form.papel });
        ligarPessoa(conta.id, form.nome, form.pessoaId, form.funcao);
      },
      `Acesso criado para ${form.email.trim().toLowerCase()}.`
    );
    if (ok) {
      setModalNovo(false);
      setForm(FORM_VAZIO);
    }
  };

  const abrirEdicao = (c) => {
    const pessoa = pessoaDaConta(c.id);
    setEditando({
      id: c.id, nome: c.nome, email: c.email, telefone: c.telefone ?? "", papel: c.papel, ativo: c.ativo,
      pessoaId: pessoa?.id ?? "", funcao: pessoa?.funcao ?? "",
      abas: abasDaConta(c), podeExcluir: c.podeExcluir === true,
    });
    setAviso(null);
  };

  const salvarEdicao = async () => {
    if (faltaPessoaDoMotorista(editando)) {
      return setAviso({ tipo: "erro", texto: "Motorista precisa estar ligado a uma pessoa na folha — é por ela que o romaneio o escala." });
    }
    const travado = editando.id === usuario?.id || eMaster(editando.email);
    const patch = { nome: editando.nome, telefone: editando.telefone };
    // Papel e liberação da própria conta e das contas master não mudam aqui.
    if (!travado) {
      patch.papel = editando.papel;
      patch.ativo = editando.ativo;
      // Só grava o ajuste fino se o papel é ajustável e a escolha foge do
      // padrão dele — assim, quem está no padrão acompanha mudanças futuras.
      const ajustaveis = abasAjustaveis(editando.papel);
      if (ajustaveis.length) {
        const padrao = abasDoPapel(editando.papel);
        const escolhidas = ajustaveis.filter((a) => editando.abas.includes(a));
        const igualPadrao = escolhidas.length === padrao.length && padrao.every((a) => escolhidas.includes(a));
        patch.abas = igualPadrao ? null : escolhidas;
        patch.podeExcluir = editando.podeExcluir;
      } else {
        patch.abas = null;
        patch.podeExcluir = null;
      }
    }
    const ok = await executar(
      async () => {
        await atualizarConta(editando.id, patch);
        ligarPessoa(editando.id, editando.nome, editando.pessoaId, editando.funcao);
      },
      "Alterações salvas."
    );
    if (ok) {
      if (editando.id === usuario.id) atualizarUsuario(patch);
      setEditando(null);
    }
  };

  const salvarNovaSenha = async () => {
    const problema = validarSenha(novaSenha.senha);
    if (problema) return setAviso({ tipo: "erro", texto: problema });
    if (novaSenha.senha !== novaSenha.confirmacao) {
      return setAviso({ tipo: "erro", texto: "As senhas não conferem." });
    }
    const ok = await executar(
      () => definirSenhaDe(trocandoSenha.id, novaSenha.senha),
      `Nova senha definida para ${trocandoSenha.email}.`
    );
    if (ok) {
      setTrocandoSenha(null);
      setNovaSenha({ senha: "", confirmacao: "" });
    }
  };

  const alternarAtivo = (conta) =>
    executar(
      () => atualizarConta(conta.id, { ativo: !conta.ativo }),
      conta.ativo ? `Acesso de ${conta.email} desativado.` : `Acesso de ${conta.email} liberado.`
    );

  const excluir = (conta) => {
    const pessoa = pessoaDaConta(conta.id);
    const aviso = `Excluir a conta de ${conta.email}? A pessoa perde o acesso e a conta é apagada — não dá para desfazer.` +
      (pessoa ? `\n\n${pessoa.nome} continua na Folha de Pagamento, só sem acesso ao sistema.` : "") +
      "\n\nPara só bloquear, use Desativar.";
    if (!confirm(aviso)) return;
    return executar(
      async () => {
        await removerConta(conta.id);
        // O banco já zera o vínculo; aqui é para a cópia local não mandar de
        // volta um usuario_id que não existe mais.
        if (setDados) {
          setDados((d) => ({
            ...d,
            funcionarios: d.funcionarios.map((f) => (f.usuarioId === conta.id ? { ...f, usuarioId: "" } : f)),
          }));
        }
      },
      `Conta de ${conta.email} excluída.`
    );
  };

  const mandarLink = (conta) =>
    executar(
      () => enviarLinkRedefinicao(conta.email),
      `Link de redefinição enviado para ${conta.email}.`
    );

  const ativos = contas.filter((c) => c.ativo).length;

  // ─── Pessoa da folha ligada à conta ──────────────────────────────────────

  const funcionarios = dados?.funcionarios ?? [];
  const pessoaDaConta = (id) => funcionarios.find((f) => f.usuarioId === id);

  /** Pessoas que podem ser ligadas a esta conta: as sem conta e a já ligada. */
  const opcoesPessoa = (contaId) => [
    { value: "", label: "Nenhuma — não aparece na folha" },
    { value: NOVA_PESSOA, label: "+ Cadastrar na folha com este nome" },
    ...funcionarios
      .filter((f) => !f.usuarioId || f.usuarioId === contaId)
      .map((f) => ({ value: f.id, label: `${f.nome} (${f.tipo}${f.funcao ? ` · ${f.funcao}` : ""})` })),
  ];

  /**
   * Liga a conta à pessoa escolhida (ou a cadastra) e grava a função nela.
   * A pessoa que estava ligada antes e deixou de estar perde só o vínculo.
   */
  const ligarPessoa = (contaId, nome, pessoaId, funcao) => {
    if (!setDados) return;
    setDados((d) => {
      let lista = d.funcionarios.map((f) =>
        f.usuarioId === contaId && f.id !== pessoaId ? { ...f, usuarioId: "" } : f
      );
      if (pessoaId === NOVA_PESSOA) {
        lista = [...lista, {
          id: novoId(), nome: nome.trim(), tipo: "Funcionário", funcao, usuarioId: contaId,
          status: "ativo", salario: "", criadoEm: new Date().toISOString(),
        }];
      } else if (pessoaId) {
        lista = lista.map((f) => (f.id === pessoaId ? { ...f, usuarioId: contaId, funcao } : f));
      }
      return { ...d, funcionarios: lista };
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: COLORS.cinza }}>
          {carregando ? "Carregando contas…" : `${contas.length} conta(s) · ${ativos} com acesso liberado`}
        </div>
        <Btn icon="plus" onClick={() => { setModalNovo(true); setAviso(null); }}>Novo Usuário</Btn>
      </div>

      {aviso && (
        <div style={{
          background: aviso.tipo === "erro" ? "#FFEBEE" : COLORS.verdePale,
          border: `1px solid ${aviso.tipo === "erro" ? "#F5C2C7" : "#A7D8BB"}`,
          color: aviso.tipo === "erro" ? "#B02A37" : COLORS.verde,
          borderRadius: 10, padding: "11px 14px", fontSize: 13, display: "flex", gap: 9, alignItems: "flex-start",
        }}>
          <div style={{ flexShrink: 0, marginTop: 1 }}>
            <Icon name={aviso.tipo === "erro" ? "alert" : "check"} size={16} color={aviso.tipo === "erro" ? "#B02A37" : COLORS.verde} />
          </div>
          <span style={{ lineHeight: 1.45 }}>{aviso.texto}</span>
        </div>
      )}

      <Card style={{ padding: 0, overflowX: "auto" }}>
        <TabelaRolavel>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead style={{ background: COLORS.cinzaClaro }}>
              <tr>
                {["Nome", "E-mail", "Papel", "Função", "Status", ""].map((h) => (
                  <th key={h} style={{ textAlign: "left", fontSize: 12, color: COLORS.cinza, padding: "12px 16px", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contas.map((c) => {
                const euMesmo = c.id === usuario?.id;
                return (
                  <tr key={c.id} style={{ borderTop: `1px solid ${COLORS.cinzaClaro}` }}>
                    <td style={{ padding: "13px 16px", fontWeight: 600, color: COLORS.cinzaEscuro, whiteSpace: "nowrap" }}>
                      {c.nome}
                      {euMesmo && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: COLORS.cinza, fontWeight: 500 }}>(você)</span>
                      )}
                      <div style={{ fontSize: 11, color: COLORS.cinza, fontWeight: 400, marginTop: 2 }}>
                        desde {c.criadoEm ? new Date(c.criadoEm).toLocaleDateString("pt-BR") : "—"}
                      </div>
                    </td>
                    <td style={{ padding: "13px 16px", color: COLORS.cinza, fontSize: 13 }}>{c.email}</td>
                    <td style={{ padding: "13px 16px" }}>
                      <EtiquetaPapel papel={c.papel} />
                      {(Array.isArray(c.abas) || c.podeExcluir) && abasAjustaveis(c.papel).length > 0 && (
                        <div style={{ fontSize: 11, color: COLORS.cinza, marginTop: 4 }}
                          title={abasDaConta(c).map((a) => ROTULO_ABA[a] ?? a).join(", ")}>
                          acesso ajustado{c.podeExcluir ? " · exclui" : ""}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "13px 16px", fontSize: 13, color: COLORS.cinzaEscuro, whiteSpace: "nowrap" }}>
                      {pessoaDaConta(c.id)?.funcao || <span style={{ color: COLORS.cinza }}>—</span>}
                    </td>
                    <td style={{ padding: "13px 16px" }}><Badge status={c.ativo ? "ativo" : "inativo"} /></td>
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <Btn variant="secondary" icon="edit" disabled={ocupado}
                          style={{ padding: "5px 11px", fontSize: 12 }}
                          onClick={() => abrirEdicao(c)}>
                          Editar
                        </Btn>

                        {/* A própria senha se troca no menu do topo, que pede a atual. */}
                        {!euMesmo && (
                          <Btn variant="secondary" icon="chave" disabled={ocupado}
                            style={{ padding: "5px 11px", fontSize: 12 }}
                            onClick={() => { setTrocandoSenha(c); setNovaSenha({ senha: "", confirmacao: "" }); setAviso(null); }}>
                            Senha
                          </Btn>
                        )}

                        {modoSupabase && (
                          <Btn variant="secondary" disabled={ocupado}
                            style={{ padding: "5px 11px", fontSize: 12 }}
                            title="Manda por e-mail um link para a pessoa criar a senha"
                            onClick={() => mandarLink(c)}>
                            Link por e-mail
                          </Btn>
                        )}

                        {/* Ninguém se tranca para fora: o próprio admin não se desativa. */}
                        {!euMesmo && (
                          <Btn variant={c.ativo ? "secondary" : "primary"} disabled={ocupado}
                            style={{ padding: "5px 11px", fontSize: 12 }}
                            onClick={() => alternarAtivo(c)}>
                            {c.ativo ? "Desativar" : "Ativar"}
                          </Btn>
                        )}

                        {podeExcluirConta && !euMesmo && !eMaster(c.email) && (
                          <Btn variant="danger" icon="trash" disabled={ocupado}
                            style={{ padding: "5px 11px", fontSize: 12 }}
                            onClick={() => excluir(c)}>
                            Excluir
                          </Btn>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TabelaRolavel>

        {!carregando && contas.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: COLORS.cinza }}>Nenhuma conta cadastrada.</div>
        )}
      </Card>

      {/* Referência rápida do que cada papel enxerga */}
      <Card>
        <h4 style={{ margin: "0 0 14px", color: COLORS.cinzaEscuro, fontSize: 15 }}>O que cada papel pode fazer</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
          {LISTA_PAPEIS.map((p) => (
            <div key={p.valor} style={{ border: `1px solid ${COLORS.cinzaClaro}`, borderRadius: 10, padding: 14 }}>
              <EtiquetaPapel papel={p.valor} />
              <div style={{ fontSize: 13, color: COLORS.cinza, marginTop: 8, lineHeight: 1.5 }}>{p.descricao}</div>
            </div>
          ))}
        </div>
        {modoSupabase && (
          <div style={{ marginTop: 14, fontSize: 12, color: COLORS.cinza, lineHeight: 1.6 }}>
            As mesmas regras valem no banco (RLS): mesmo que alguém contorne a tela, o Postgres
            recusa o que o papel não permite. Excluir apaga a conta de vez; Desativar
            só bloqueia a entrada e dá para liberar de novo.
          </div>
        )}
      </Card>

      {/* ─── Novo usuário ─── */}
      {modalNovo && (
        <Modal title="Novo Usuário" onClose={() => { setModalNovo(false); setForm(FORM_VAZIO); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Input label="Nome *" value={form.nome} placeholder="Nome de quem vai usar"
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            <Input label="E-mail *" type="email" value={form.email} placeholder="pessoa@carvalhocruz.com.br"
              autoCapitalize="none" spellCheck={false}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <Input label="Telefone" value={form.telefone} placeholder="(79) 9 9999-9999"
              onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />
            <Select label="Papel (o que acessa) *" value={form.papel}
              options={PAPEIS_CADASTRAVEIS.map((p) => ({ value: p.valor, label: p.label }))}
              onChange={(e) => setForm((f) => comPapel(f, e.target.value))} />
            <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: -6, lineHeight: 1.5 }}>
              {PAPEIS[form.papel]?.descricao}
            </div>
            <CamposFolha valor={form} opcoes={opcoesPessoa(null)} aoMudar={(patch) => setForm((f) => ({ ...f, ...patch }))} />
            <InputSenha label="Senha provisória *" value={form.senha} placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))} />
            <InputSenha label="Repita a senha *" value={form.confirmacao} placeholder="••••••••"
              autoComplete="new-password"
              onChange={(e) => setForm((f) => ({ ...f, confirmacao: e.target.value }))} />
            <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: -6, lineHeight: 1.5 }}>
              Passe a senha para a pessoa e peça que ela troque no menu do topo, em
              “Alterar minha senha”.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
              <Btn variant="secondary" onClick={() => { setModalNovo(false); setForm(FORM_VAZIO); }}>Cancelar</Btn>
              <Btn onClick={salvarNovo} disabled={ocupado || !form.nome.trim() || !form.email.trim() || !form.senha}>
                {ocupado ? "Criando…" : "Criar acesso"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Editar ─── */}
      {editando && (
        <Modal title="Editar Usuário" onClose={() => setEditando(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 13, color: COLORS.cinza }}>{editando.email}</div>
            <Input label="Nome" value={editando.nome}
              onChange={(e) => setEditando((u) => ({ ...u, nome: e.target.value }))} />
            <Input label="Telefone" value={editando.telefone} placeholder="(79) 9 9999-9999"
              onChange={(e) => setEditando((u) => ({ ...u, telefone: e.target.value }))} />
            {editando.id === usuario?.id || eMaster(editando.email) ? (
              <div style={{ fontSize: 12.5, color: COLORS.cinza, lineHeight: 1.5 }}>
                <EtiquetaPapel papel={editando.papel} />{" "}
                {eMaster(editando.email)
                  ? "Conta master: é sempre sócio master e não pode ser desativada."
                  : "O papel e a liberação da sua própria conta não mudam por aqui."}
              </div>
            ) : (
              <>
                <Select label="Papel (o que acessa)" value={editando.papel}
                  options={LISTA_PAPEIS.map((p) => ({ value: p.valor, label: p.label }))}
                  onChange={(e) => setEditando((u) => comPapel(u, e.target.value))} />
                <div style={{ fontSize: 12, color: COLORS.cinza, marginTop: -6, lineHeight: 1.5 }}>
                  {PAPEIS[editando.papel]?.descricao}
                </div>
                <Select label="Acesso" value={editando.ativo ? "sim" : "nao"}
                  options={[{ value: "sim", label: "Liberado — pode entrar" }, { value: "nao", label: "Bloqueado — não entra" }]}
                  onChange={(e) => setEditando((u) => ({ ...u, ativo: e.target.value === "sim" }))} />
                {abasAjustaveis(editando.papel).length > 0 && (
                  <AjusteAbas editando={editando} setEditando={setEditando} />
                )}
              </>
            )}
            <CamposFolha valor={editando} opcoes={opcoesPessoa(editando.id)} aoMudar={(patch) => setEditando((u) => ({ ...u, ...patch }))} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
              <Btn variant="secondary" onClick={() => setEditando(null)}>Cancelar</Btn>
              <Btn onClick={salvarEdicao} disabled={ocupado || !editando.nome.trim()}>
                {ocupado ? "Salvando…" : "Salvar"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Nova senha definida pelo sócio master ─── */}
      {trocandoSenha && (
        <Modal title="Definir nova senha" onClose={() => setTrocandoSenha(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 13, color: COLORS.cinza }}>{trocandoSenha.email}</div>
            <InputSenha label="Nova senha" value={novaSenha.senha} placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              onChange={(e) => setNovaSenha((s) => ({ ...s, senha: e.target.value }))} />
            <InputSenha label="Repita a senha" value={novaSenha.confirmacao} placeholder="••••••••"
              autoComplete="new-password"
              onChange={(e) => setNovaSenha((s) => ({ ...s, confirmacao: e.target.value }))} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
              <Btn variant="secondary" onClick={() => setTrocandoSenha(null)}>Cancelar</Btn>
              <Btn onClick={salvarNovaSenha} disabled={ocupado || !novaSenha.senha}>
                {ocupado ? "Salvando…" : "Definir senha"}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

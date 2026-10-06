import { useEffect, useMemo, useState } from "react";

import { Aviso, Caixa, CampoNome, CampoObservacao, Enviado, ListaProdutos, Pagina, ResumoItens, UltimoPedido } from "../components/PedidoPartes";
import PedidoVoz from "../components/PedidoVoz";
import { Btn, Icon } from "../components/ui";
import { abrirPedidoGeral, enviarPedidoGeral, itensDoUltimo, itensEscolhidos, kgDosItens, lembrarNome, limparNome, nomeLembrado, nomeValido } from "../lib/pedidoCliente";
import { supabaseConfigurado } from "../lib/supabase";
import { COLORS, kg } from "../lib/tema";

/**
 * Página pública do link de pedido GERAL: /pedido/geral/<token>.
 *
 * Feita para a equipe: todas as redes e lojas ativas num lugar só. Busca a
 * rede ou a loja, toca para abrir, põe as quantidades — de uma ou de várias
 * lojas, de redes diferentes se precisar — e envia tudo de uma vez. Cada
 * loja vira um pedido separado na aba Vendas, com número próprio.
 */
export default function PedidoGeral({ token }) {
  const [info, setInfo] = useState(null);
  const [erroAbrir, setErroAbrir] = useState(supabaseConfigurado ? null : "O pedido pelo link não está disponível neste endereço.");
  const [busca, setBusca] = useState("");
  const [qtds, setQtds] = useState({}); // { lojaId: { produtoId: "10" } }
  const [obs, setObs] = useState({}); // { lojaId: "texto" }
  const [repetidas, setRepetidas] = useState({}); // { lojaId: true }
  const [aberta, setAberta] = useState(null); // a loja com os produtos à mostra
  const [buscaProduto, setBuscaProduto] = useState(""); // filtro de fruta da loja aberta
  const [nome, setNome] = useState(nomeLembrado);
  const [erroNome, setErroNome] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState(null);
  const [enviados, setEnviados] = useState(null);

  useEffect(() => {
    if (!supabaseConfigurado) return undefined;
    let cancelado = false;
    abrirPedidoGeral(token)
      .then((d) => { if (!cancelado) setInfo(d); })
      .catch((e) => { if (!cancelado) setErroAbrir(e.message); });
    return () => { cancelado = true; };
  }, [token]);

  useEffect(() => {
    document.title = "Pedido — CVC Hortifruit";
  }, []);

  const redes = useMemo(() => info?.redes ?? [], [info]);

  // No link geral toda loja pode pedir TODOS os produtos. Os que a loja já
  // costuma ter liberados (produtoIds) vão primeiro; o resto vem logo abaixo.
  const porRede = useMemo(() => {
    const produtos = info?.produtos ?? [];
    return (info?.redes ?? []).map((r) => ({
      rede: r,
      lojas: r.lojas.map((l) => {
        const prioritarios = Array.isArray(l.produtoIds) ? produtos.filter((p) => l.produtoIds.includes(p.id)) : [];
        const outros = Array.isArray(l.produtoIds) ? produtos.filter((p) => !l.produtoIds.includes(p.id)) : produtos;
        const itens = itensEscolhidos(produtos, qtds[l.id]);
        return { loja: l, produtos, prioritarios, outros, itens, kg: kgDosItens(itens) };
      }),
    }));
  }, [info, qtds]);

  // A voz também entende qualquer produto em qualquer loja.
  const redesVoz = useMemo(
    () => redes.map((r) => ({ ...r, lojas: r.lojas.map((l) => ({ ...l, produtoIds: null })) })),
    [redes],
  );

  const termoProduto = buscaProduto.trim().toLowerCase();
  const filtrarProdutos = (lista) => (termoProduto
    ? lista.filter((p) => `${p.nome} ${p.fruta ?? ""}`.toLowerCase().includes(termoProduto))
    : lista);

  const termo = busca.trim().toLowerCase();
  const porRedeFiltrada = porRede
    .map(({ rede, lojas }) => {
      const redeCasa = rede.nome.toLowerCase().includes(termo);
      return { rede, lojas: redeCasa ? lojas : lojas.filter((x) => x.loja.nome.toLowerCase().includes(termo)) };
    })
    .filter((g) => g.lojas.length > 0);

  const comPedido = porRede.flatMap((g) => g.lojas.filter((x) => x.itens.length > 0).map((x) => ({ ...x, rede: g.rede })));
  const kgTotal = comPedido.reduce((s, x) => s + x.kg, 0);
  const totalLojas = redes.reduce((s, r) => s + r.lojas.length, 0);

  const mudarQtd = (lojaId, produtoId, v) => {
    setQtds((q) => ({ ...q, [lojaId]: { ...q[lojaId], [produtoId]: v } }));
    setErroEnvio(null);
  };

  // O microfone entendeu a rede, a loja e os produtos: abre a loja certa, já
  // preenchida, e rola até ela — quem confirma e envia continua sendo a pessoa.
  const aoEntenderPorVoz = (r) => {
    setBusca("");
    setBuscaProduto("");
    setAberta(r.loja.id);
    r.itens.forEach((i) => mudarQtd(r.loja.id, i.produtoId, String(i.qty)));
    requestAnimationFrame(() => {
      document.getElementById(`loja-${r.loja.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const repetir = (loja, itens) => {
    setQtds((q) => ({ ...q, [loja.id]: Object.fromEntries(itens.map((i) => [i.produtoId, String(i.qty)])) }));
    setRepetidas((r) => ({ ...r, [loja.id]: true }));
    setErroEnvio(null);
  };

  const enviar = async () => {
    if (!nomeValido(nome)) {
      setErroNome(true);
      setErroEnvio("Informe o responsável pelo pedido.");
      const campo = document.getElementById("nome-pedido");
      campo?.scrollIntoView({ behavior: "smooth", block: "center" });
      campo?.focus({ preventScroll: true });
      return;
    }
    if (comPedido.length === 0) {
      setErroEnvio("Coloque a quantidade de pelo menos um produto em uma loja.");
      return;
    }
    setEnviando(true);
    setErroEnvio(null);
    try {
      const r = await enviarPedidoGeral(token, comPedido.map((x) => ({
        lojaId: x.loja.id,
        itens: x.itens.map((i) => ({ produtoId: i.p.id, qty: i.qty })),
        observacao: (obs[x.loja.id] ?? "").trim() || null,
      })), limparNome(nome));
      const numeros = new Map(r.map((f) => [f.lojaId, f.numero]));
      setEnviados(comPedido.map((x) => ({ ...x, numero: numeros.get(x.loja.id) })));
      lembrarNome(nome);
      window.scrollTo(0, 0);
    } catch (e) {
      setErroEnvio(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const novoPedido = () => {
    setEnviados(null);
    setQtds({});
    setObs({});
    setRepetidas({});
    setAberta(null);
    setBusca("");
    setBuscaProduto("");
  };

  return (
    <Pagina>
      {erroAbrir && (
        <Caixa>
          <Aviso>{erroAbrir}</Aviso>
        </Caixa>
      )}

      {!erroAbrir && !info && (
        <div style={{ textAlign: "center", color: COLORS.cinza, fontSize: 14, padding: 30 }}>Carregando…</div>
      )}

      {info && enviados && (
        <Enviado titulo={enviados.length === 1 ? "Pedido enviado!" : `${enviados.length} pedidos enviados!`}>
          {enviados.map((x) => (
            <div key={x.loja.id} style={{ width: "100%", textAlign: "left" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 15, marginBottom: 6 }}>
                <div>
                  <strong style={{ color: COLORS.cinzaEscuro }}>{x.loja.nome}</strong>
                  <div style={{ fontSize: 12, color: COLORS.cinza }}>{x.rede.nome}</div>
                </div>
                {x.numero && <span style={{ color: COLORS.cinza, whiteSpace: "nowrap" }}>Pedido nº <strong style={{ color: COLORS.cinzaEscuro }}>{x.numero}</strong></span>}
              </div>
              <ResumoItens itens={x.itens} />
            </div>
          ))}
          <div style={{ fontSize: 13, color: COLORS.cinza, lineHeight: 1.5 }}>
            A CVC já recebeu {enviados.length === 1 ? "o pedido" : "os pedidos"} e vai conferir. Qualquer dúvida, entramos em contato.
          </div>
          <Btn variant="ghost" onClick={novoPedido}>Fazer outro pedido</Btn>
        </Enviado>
      )}

      {info && !enviados && (
        <>
          <Caixa>
            <div style={{ fontSize: 12, color: COLORS.cinza, textTransform: "uppercase", letterSpacing: 0.5 }}>Pedido para</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: COLORS.cinzaEscuro, marginTop: 2 }}>Todas as redes e lojas</div>
            <div style={{ fontSize: 13, color: COLORS.cinza, marginTop: 6, lineHeight: 1.45 }}>
              Busque a rede ou a loja, toque para abrir e coloque as quantidades — todas as frutas estão liberadas para todas as lojas, e dá para buscar a fruta. Dá para pedir para várias lojas — de redes diferentes — de uma vez.
            </div>
          </Caixa>

          <PedidoVoz redes={redesVoz} produtos={info.produtos ?? []} aoEntender={aoEntenderPorVoz} />

          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}>
              <Icon name="search" color={COLORS.cinza} size={16} />
            </div>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar rede ou loja..."
              style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px 12px 40px", border: `1.5px solid ${COLORS.cinzaClaro}`, borderRadius: 12, fontSize: 15, outline: "none", background: COLORS.branco }}
            />
          </div>

          {totalLojas === 0 && (
            <Caixa><div style={{ fontSize: 14, color: COLORS.cinza }}>Nenhuma loja ativa cadastrada.</div></Caixa>
          )}

          {totalLojas > 0 && porRedeFiltrada.length === 0 && (
            <Caixa><div style={{ fontSize: 14, color: COLORS.cinza }}>Nada encontrado para &quot;{busca}&quot;.</div></Caixa>
          )}

          {porRedeFiltrada.map(({ rede, lojas }) => (
            <div key={rede.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.verde, textTransform: "uppercase", letterSpacing: 0.4, padding: "0 4px" }}>
                {rede.nome}
              </div>
              {lojas.map(({ loja, produtos: daLoja, prioritarios, outros, itens, kg: kgLoja }) => {
                const aqui = aberta === loja.id;
                const ultimo = itensDoUltimo(loja.ultimoPedido, daLoja);
                const prioFiltrados = filtrarProdutos(prioritarios);
                const outrosFiltrados = filtrarProdutos(outros);
                return (
                  <Caixa key={loja.id} id={`loja-${loja.id}`} style={{ padding: 0, border: itens.length > 0 ? `2px solid ${COLORS.verdeClaro}` : "2px solid transparent" }}>
                    <button type="button" aria-expanded={aqui} onClick={() => { setAberta(aqui ? null : loja.id); setBuscaProduto(""); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "16px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.cinzaEscuro }}>{loja.nome}</div>
                        <div style={{ fontSize: 13, color: itens.length > 0 ? COLORS.verde : COLORS.cinza, fontWeight: itens.length > 0 ? 600 : 400 }}>
                          {itens.length > 0
                            ? `${itens.length} ${itens.length === 1 ? "item" : "itens"} · ${kg(kgLoja)}`
                            : "Sem pedido"}
                        </div>
                      </div>
                      <span aria-hidden="true" style={{ fontSize: 20, color: COLORS.cinza, transform: aqui ? "rotate(90deg)" : "none", transition: "transform .15s" }}>›</span>
                    </button>

                    {aqui && (
                      <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                        {ultimo.itens.length > 0 && (
                          <div style={{ borderTop: `1px solid ${COLORS.cinzaClaro}`, paddingTop: 14 }}>
                            <UltimoPedido data={loja.ultimoPedido?.data} itens={ultimo.itens} faltaram={ultimo.faltaram}
                              repetido={!!repetidas[loja.id]} aoRepetir={() => repetir(loja, ultimo.itens)} />
                          </div>
                        )}
                        <div style={{ borderTop: `1px solid ${COLORS.cinzaClaro}`, paddingTop: 14 }}>
                          <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.cinzaEscuro, marginBottom: 8 }}>Produtos</div>
                          <input
                            type="search"
                            value={buscaProduto}
                            onChange={(e) => setBuscaProduto(e.target.value)}
                            placeholder="Buscar fruta ou produto..."
                            aria-label={`Buscar produto — ${loja.nome}`}
                            style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", border: `1.5px solid ${COLORS.cinzaClaro}`, borderRadius: 10, fontSize: 15, outline: "none", background: COLORS.branco, marginBottom: 6 }}
                          />
                          {prioFiltrados.length > 0 && (
                            <>
                              {outros.length > 0 && (
                                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.verde, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 8 }}>Da CVC</div>
                              )}
                              <ListaProdutos produtos={prioFiltrados} qtds={qtds[loja.id] ?? {}} rotuloExtra={` — ${loja.nome}`}
                                aoMudar={(id, v) => mudarQtd(loja.id, id, v)} />
                            </>
                          )}
                          {outrosFiltrados.length > 0 && (
                            <>
                              {prioritarios.length > 0 && (
                                <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.cinza, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 14 }}>Outros produtos</div>
                              )}
                              <ListaProdutos produtos={outrosFiltrados} qtds={qtds[loja.id] ?? {}} rotuloExtra={` — ${loja.nome}`}
                                aoMudar={(id, v) => mudarQtd(loja.id, id, v)} />
                            </>
                          )}
                          {prioFiltrados.length === 0 && outrosFiltrados.length === 0 && (
                            <div style={{ fontSize: 14, color: COLORS.cinza, padding: "10px 0" }}>
                              {termoProduto ? `Nenhum produto encontrado para "${buscaProduto}".` : "Nenhum produto disponível."}
                            </div>
                          )}
                        </div>
                        <div>
                          <CampoObservacao id={`obs-${loja.id}`} valor={obs[loja.id] ?? ""}
                            aoMudar={(v) => setObs((o) => ({ ...o, [loja.id]: v }))} />
                        </div>
                      </div>
                    )}
                  </Caixa>
                );
              })}
            </div>
          ))}

          <Caixa style={{ border: `2px solid ${erroNome ? "#B02A37" : COLORS.verdeClaro}` }}>
            <CampoNome valor={nome} erro={erroNome}
              aoMudar={(v) => { setNome(v); setErroNome(false); setErroEnvio(null); }} />
          </Caixa>

          {erroEnvio && <Aviso>{erroEnvio}</Aviso>}

          <div style={{ position: "sticky", bottom: 12 }}>
            <Btn onClick={enviar} disabled={enviando || totalLojas === 0}
              style={{ width: "100%", justifyContent: "center", padding: "14px 18px", fontSize: 16, boxShadow: "0 4px 16px rgba(45,106,79,0.3)" }}>
              {enviando
                ? "Enviando…"
                : comPedido.length === 0
                  ? "Enviar pedido"
                  : comPedido.length === 1
                    ? `Enviar pedido · ${comPedido[0].loja.nome} · ${kg(kgTotal)}`
                    : `Enviar ${comPedido.length} pedidos · ${kg(kgTotal)}`}
            </Btn>
          </div>
        </>
      )}
    </Pagina>
  );
}

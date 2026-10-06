import { useEffect, useState } from "react";

import { Aviso, Caixa, CampoNome, CampoObservacao, Enviado, ListaProdutos, Pagina, ResumoItens, UltimoPedido } from "../components/PedidoPartes";
import { Btn } from "../components/ui";
import { abrirPedidoRede, enviarPedidoRede, itensDoUltimo, itensEscolhidos, kgDosItens, lembrarNome, limparNome, nomeLembrado, nomeValido } from "../lib/pedidoCliente";
import { supabaseConfigurado } from "../lib/supabase";
import { COLORS, kg } from "../lib/tema";

/**
 * Página pública do link de pedido da rede: /pedido/rede/<token>.
 *
 * Feita para o grupo de WhatsApp com os gerentes: todas as lojas ativas da
 * rede numa página só. Dá para pedir para uma ou várias lojas de uma vez —
 * cada loja vira um pedido separado na aba Vendas, com número próprio.
 */
export default function PedidoRede({ token }) {
  const [info, setInfo] = useState(null);
  const [erroAbrir, setErroAbrir] = useState(supabaseConfigurado ? null : "O pedido pelo link não está disponível neste endereço.");
  const [qtds, setQtds] = useState({}); // { lojaId: { produtoId: "10" } }
  const [obs, setObs] = useState({}); // { lojaId: "texto" }
  const [repetidas, setRepetidas] = useState({}); // { lojaId: true }
  const [aberta, setAberta] = useState(null); // a loja com os produtos à mostra
  const [nome, setNome] = useState(nomeLembrado);
  const [erroNome, setErroNome] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState(null);
  const [enviados, setEnviados] = useState(null);

  useEffect(() => {
    if (!supabaseConfigurado) return undefined;
    let cancelado = false;
    abrirPedidoRede(token)
      .then((d) => {
        if (cancelado) return;
        setInfo(d);
        // Rede de uma loja só já abre direto nela.
        if (d?.lojas?.length === 1) setAberta(d.lojas[0].id);
      })
      .catch((e) => { if (!cancelado) setErroAbrir(e.message); });
    return () => { cancelado = true; };
  }, [token]);

  useEffect(() => {
    document.title = info ? `Pedido — ${info.rede}` : "Pedido — CVC Hortifruit";
  }, [info]);

  const produtos = info?.produtos ?? [];
  const lojas = info?.lojas ?? [];
  // Cada loja só vê os produtos liberados para ela (null = todos).
  const porLoja = lojas.map((l) => {
    const daLoja = Array.isArray(l.produtoIds) ? produtos.filter((p) => l.produtoIds.includes(p.id)) : produtos;
    const itens = itensEscolhidos(daLoja, qtds[l.id]);
    return { loja: l, produtos: daLoja, itens, kg: kgDosItens(itens) };
  });
  const comPedido = porLoja.filter((x) => x.itens.length > 0);
  const kgTotal = comPedido.reduce((s, x) => s + x.kg, 0);

  const mudarQtd = (lojaId, produtoId, v) => {
    setQtds((q) => ({ ...q, [lojaId]: { ...q[lojaId], [produtoId]: v } }));
    setErroEnvio(null);
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
      const r = await enviarPedidoRede(token, comPedido.map((x) => ({
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
    setAberta(lojas.length === 1 ? lojas[0].id : null);
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
                <strong style={{ color: COLORS.cinzaEscuro }}>{x.loja.nome}</strong>
                {x.numero && <span style={{ color: COLORS.cinza }}>Pedido nº <strong style={{ color: COLORS.cinzaEscuro }}>{x.numero}</strong></span>}
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
            <div style={{ fontSize: 19, fontWeight: 700, color: COLORS.cinzaEscuro, marginTop: 2 }}>{info.rede}</div>
            <div style={{ fontSize: 13, color: COLORS.cinza, marginTop: 6, lineHeight: 1.45 }}>
              Toque na loja e coloque as quantidades. Dá para pedir para várias lojas de uma vez — cada loja vira um pedido separado.
            </div>
          </Caixa>

          {lojas.length === 0 && (
            <Caixa><div style={{ fontSize: 14, color: COLORS.cinza }}>Nenhuma loja ativa nesta rede.</div></Caixa>
          )}

          {porLoja.map(({ loja, produtos: daLoja, itens, kg: kgLoja }) => {
            const aqui = aberta === loja.id;
            const ultimo = itensDoUltimo(loja.ultimoPedido, daLoja);
            return (
              <Caixa key={loja.id} style={{ padding: 0, border: itens.length > 0 ? `2px solid ${COLORS.verdeClaro}` : "2px solid transparent" }}>
                <button type="button" aria-expanded={aqui} onClick={() => setAberta(aqui ? null : loja.id)}
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
                      <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.cinzaEscuro, marginBottom: 6 }}>Produtos</div>
                      <ListaProdutos produtos={daLoja} qtds={qtds[loja.id] ?? {}} rotuloExtra={` — ${loja.nome}`}
                        aoMudar={(id, v) => mudarQtd(loja.id, id, v)} />
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

          <Caixa style={{ border: `2px solid ${erroNome ? "#B02A37" : COLORS.verdeClaro}` }}>
            <CampoNome valor={nome} erro={erroNome}
              aoMudar={(v) => { setNome(v); setErroNome(false); setErroEnvio(null); }} />
          </Caixa>

          {erroEnvio && <Aviso>{erroEnvio}</Aviso>}

          <div style={{ position: "sticky", bottom: 12 }}>
            <Btn onClick={enviar} disabled={enviando || lojas.length === 0}
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

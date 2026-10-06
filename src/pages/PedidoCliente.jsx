import { useEffect, useState } from "react";

import { Aviso, Caixa, CampoNome, CampoObservacao, Enviado, ListaProdutos, Pagina, ResumoItens, UltimoPedido } from "../components/PedidoPartes";
import { Btn } from "../components/ui";
import { abrirPedido, enviarPedido, itensDoUltimo, itensEscolhidos, kgDosItens, lembrarNome, limparNome, nomeLembrado, nomeValido } from "../lib/pedidoCliente";
import { supabaseConfigurado } from "../lib/supabase";
import { COLORS, kg } from "../lib/tema";

/**
 * Página pública do link de pedido: /pedido/<token>.
 *
 * Sem login. O cliente escolhe as quantidades e envia; o pedido entra na aba
 * Vendas do app como "Pedido do cliente", aguardando conferência. Preço não
 * aparece aqui — cada rede tem o seu, e quem confere é a equipe.
 */
export default function PedidoCliente({ token }) {
  const [info, setInfo] = useState(null);
  const [erroAbrir, setErroAbrir] = useState(supabaseConfigurado ? null : "O pedido pelo link não está disponível neste endereço.");
  const [qtds, setQtds] = useState({});
  const [observacao, setObservacao] = useState("");
  const [nome, setNome] = useState(nomeLembrado);
  const [erroNome, setErroNome] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState(null);
  const [enviado, setEnviado] = useState(null);
  const [repetido, setRepetido] = useState(false);

  useEffect(() => {
    if (!supabaseConfigurado) return undefined;
    let cancelado = false;
    abrirPedido(token)
      .then((d) => { if (!cancelado) setInfo(d); })
      .catch((e) => { if (!cancelado) setErroAbrir(e.message); });
    return () => { cancelado = true; };
  }, [token]);

  useEffect(() => {
    document.title = info ? `Pedido — ${info.rede} ${info.loja}` : "Pedido — CVC Hortifruit";
  }, [info]);

  const produtos = info?.produtos ?? [];
  const escolhidos = itensEscolhidos(produtos, qtds);
  const kgTotal = kgDosItens(escolhidos);
  const ultimo = itensDoUltimo(info?.ultimoPedido, produtos);

  const repetirUltimo = () => {
    setQtds(Object.fromEntries(ultimo.itens.map((i) => [i.produtoId, String(i.qty)])));
    setErroEnvio(null);
    setRepetido(true);
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
    if (escolhidos.length === 0) {
      setErroEnvio("Coloque a quantidade de pelo menos um produto.");
      return;
    }
    setEnviando(true);
    setErroEnvio(null);
    try {
      const r = await enviarPedido(
        token,
        escolhidos.map((x) => ({ produtoId: x.p.id, qty: x.qty })),
        observacao.trim() || null,
        limparNome(nome)
      );
      setEnviado({ numero: r?.numero, itens: escolhidos });
      lembrarNome(nome);
      window.scrollTo(0, 0);
    } catch (e) {
      setErroEnvio(e.message);
    } finally {
      setEnviando(false);
    }
  };

  const novoPedido = () => {
    setEnviado(null);
    setQtds({});
    setObservacao("");
    setRepetido(false);
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

      {info && enviado && (
        <Enviado titulo="Pedido enviado!">
          {enviado.numero && (
            <div style={{ fontSize: 15, color: COLORS.cinza, marginTop: -8 }}>Pedido nº <strong style={{ color: COLORS.cinzaEscuro }}>{enviado.numero}</strong></div>
          )}
          <ResumoItens itens={enviado.itens} />
          <div style={{ fontSize: 13, color: COLORS.cinza, lineHeight: 1.5 }}>
            A CVC já recebeu o seu pedido e vai conferir. Qualquer dúvida, entramos em contato.
          </div>
          <Btn variant="ghost" onClick={novoPedido}>Fazer outro pedido</Btn>
        </Enviado>
      )}

      {info && !enviado && (
        <>
          <Caixa>
            <div style={{ fontSize: 12, color: COLORS.cinza, textTransform: "uppercase", letterSpacing: 0.5 }}>Pedido para</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: COLORS.cinzaEscuro, marginTop: 2 }}>{info.rede}</div>
            <div style={{ fontSize: 15, color: COLORS.cinzaEscuro }}>{info.loja}</div>
          </Caixa>

          {ultimo.itens.length > 0 && (
            <Caixa>
              <UltimoPedido data={info.ultimoPedido?.data} itens={ultimo.itens} faltaram={ultimo.faltaram}
                repetido={repetido} aoRepetir={repetirUltimo} />
            </Caixa>
          )}

          <Caixa>
            <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.cinzaEscuro, marginBottom: 6 }}>Produtos</div>
            <ListaProdutos produtos={produtos} qtds={qtds}
              aoMudar={(id, v) => { setQtds((q) => ({ ...q, [id]: v })); setErroEnvio(null); }} />
          </Caixa>

          <Caixa>
            <CampoObservacao id="obs-pedido" valor={observacao} aoMudar={setObservacao} />
          </Caixa>

          <Caixa style={{ border: `2px solid ${erroNome ? "#B02A37" : COLORS.verdeClaro}` }}>
            <CampoNome valor={nome} erro={erroNome}
              aoMudar={(v) => { setNome(v); setErroNome(false); setErroEnvio(null); }} />
          </Caixa>

          {erroEnvio && <Aviso>{erroEnvio}</Aviso>}

          <div style={{ position: "sticky", bottom: 12 }}>
            <Btn onClick={enviar} disabled={enviando}
              style={{ width: "100%", justifyContent: "center", padding: "14px 18px", fontSize: 16, boxShadow: "0 4px 16px rgba(45,106,79,0.3)" }}>
              {enviando
                ? "Enviando…"
                : escolhidos.length === 0
                  ? "Enviar pedido"
                  : `Enviar pedido · ${escolhidos.length} ${escolhidos.length === 1 ? "item" : "itens"} · ${kg(kgTotal)}`}
            </Btn>
          </div>
        </>
      )}
    </Pagina>
  );
}

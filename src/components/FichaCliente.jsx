import { useState } from "react";

import { Btn, Input, Select } from "./ui";
import {
  LIMITES, UFS, consultarCep, consultarCnpj, ehCnpj, enderecoCompleto, mascaraCep, mascaraCnpjCpf,
  mascaraTelefone, soDigitos,
} from "../lib/cadastro";
import { COLORS } from "../lib/tema";

const Secao = ({ titulo, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.verde, textTransform: "uppercase", letterSpacing: 0.6, borderBottom: `1px solid ${COLORS.cinzaClaro}`, paddingBottom: 5 }}>
      {titulo}
    </div>
    {children}
  </div>
);

const Grade = ({ children, min = 140 }) => (
  <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12 }}>
    {children}
  </div>
);

const Erro = ({ children }) =>
  children ? <div style={{ fontSize: 12, color: COLORS.vermelho, marginTop: -6 }}>{children}</div> : null;

const Aviso = ({ children, cor = COLORS.laranjaEscuro }) =>
  children ? <div style={{ fontSize: 12, color: cor, marginTop: -6 }}>{children}</div> : null;

/** Só sobrescreve com o que a consulta trouxe de fato. */
const mesclar = (form, novos) => {
  const out = { ...form };
  for (const [k, v] of Object.entries(novos)) if (v) out[k] = v;
  return out;
};

/**
 * Campos da ficha cadastral, usados no cadastro e na edição de rede e loja.
 * O nome (da rede ou da loja) fica com a tela que chama; aqui entra o resto.
 *
 * `nfe` marca os campos que a NF-e exige (loja). `tentou` diz se já houve
 * uma tentativa de salvar: antes disso, campo obrigatório vazio não aparece
 * em vermelho — só erro de formato no que já foi digitado.
 *
 * `cnpjEmUso(cnpj)` devolve o nome do outro cliente que já usa esse CNPJ,
 * ou null — é só um aviso, não impede salvar (rede e loja MATRIZ costumam
 * dividir o mesmo CNPJ).
 */
export function CamposCadastro({ form, setForm, erros = {}, cnpjEmUso, nfe = false, tentou = false }) {
  const [consultando, setConsultando] = useState(null); // "cnpj" | "cep" | null
  const [msgCnpj, setMsgCnpj] = useState(null);
  const [msgCep, setMsgCep] = useState(null);

  const campo = (nome, mascara) => (e) => {
    const valor = mascara ? mascara(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [nome]: valor }));
  };

  /** Erro do campo, se já deve aparecer. */
  const erro = (c) => (tentou || String(form[c] ?? "").trim() ? erros[c] : null);
  /** Rótulo com * nos obrigatórios da NF-e. */
  const r = (texto, c) => (nfe && OBRIGATORIOS.has(c) ? `${texto} *` : texto);
  /** Borda vermelha no campo com erro visível. */
  const borda = (c) => (erro(c) ? { borderColor: COLORS.vermelho } : undefined);

  const buscarCnpj = async () => {
    setConsultando("cnpj");
    setMsgCnpj(null);
    try {
      const { nomeFantasia, situacao, ...dados } = await consultarCnpj(form.cnpjCpf);
      setForm((f) => ({ ...mesclar(f, dados), nome: f.nome || nomeFantasia || dados.razaoSocial }));
      setMsgCnpj(situacao && situacao !== "ATIVA"
        ? { cor: COLORS.vermelho, texto: `Atenção: situação na Receita — ${situacao}.` }
        : { cor: COLORS.verde, texto: "Dados preenchidos pela Receita. Confira a inscrição estadual antes de salvar." });
    } catch (e) {
      setMsgCnpj({
        cor: COLORS.vermelho,
        texto: e.status === 404 ? "CNPJ não encontrado na Receita." : "Não foi possível consultar agora (sem internet?). Preencha à mão.",
      });
    } finally {
      setConsultando(null);
    }
  };

  const buscarCep = async () => {
    setConsultando("cep");
    setMsgCep(null);
    try {
      const dados = await consultarCep(form.cep);
      setForm((f) => mesclar(f, dados));
    } catch (e) {
      setMsgCep(e.message === "não encontrado" ? "CEP não encontrado." : "Não foi possível consultar o CEP agora.");
    } finally {
      setConsultando(null);
    }
  };

  const cnpjCompleto = ehCnpj(form.cnpjCpf);
  const docCompleto = [11, 14].includes(soDigitos(form.cnpjCpf).length);
  const donoDoCnpj = docCompleto && !erros.cnpjCpf && cnpjEmUso ? cnpjEmUso(form.cnpjCpf) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {nfe && (
        <div style={{ fontSize: 12, color: COLORS.cinza, lineHeight: 1.5 }}>
          Dá para salvar sem CNPJ nem endereço. Os campos com * só são exigidos na hora de emitir NF-e. Digite o CNPJ e clique em <strong>Buscar</strong> para preencher pela Receita.
        </div>
      )}
      <Secao titulo="Dados fiscais">
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <Input label={r("CNPJ / CPF", "cnpjCpf")} value={form.cnpjCpf} onChange={campo("cnpjCpf", mascaraCnpjCpf)}
              placeholder="00.000.000/0000-00" inputMode="numeric" style={borda("cnpjCpf")} />
          </div>
          <Btn variant="ghost" icon="search" onClick={buscarCnpj}
            disabled={!cnpjCompleto || !!erros.cnpjCpf || consultando === "cnpj"}
            style={{ padding: "9px 12px" }}>
            {consultando === "cnpj" ? "Buscando..." : "Buscar"}
          </Btn>
        </div>
        <Erro>{erro("cnpjCpf")}</Erro>
        {msgCnpj && <Aviso cor={msgCnpj.cor}>{msgCnpj.texto}</Aviso>}
        {donoDoCnpj && <Aviso>Este CNPJ/CPF já está cadastrado em {donoDoCnpj}.</Aviso>}
        <Input label={r("Razão Social", "razaoSocial")} value={form.razaoSocial} onChange={campo("razaoSocial")}
          placeholder="Nome registrado na Receita" maxLength={LIMITES.razaoSocial} style={borda("razaoSocial")} />
        <Erro>{erro("razaoSocial")}</Erro>
        <Input label={nfe && ehCnpj(form.cnpjCpf) ? "Inscrição Estadual *" : "Inscrição Estadual"} value={form.ie}
          onChange={campo("ie")} placeholder="Só números, ou ISENTO" maxLength={20} style={borda("ie")} />
        <Erro>{erro("ie")}</Erro>
      </Secao>

      <Secao titulo="Contato">
        <Input label="Responsável / Comprador" value={form.contato} onChange={campo("contato")}
          placeholder="Com quem falar" maxLength={LIMITES.contato} />
        <Grade>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Input label="Telefone" value={form.telefone} onChange={campo("telefone", mascaraTelefone)}
              placeholder="(79) 99999-9999" inputMode="tel" style={borda("telefone")} />
            <Erro>{erro("telefone")}</Erro>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Input label="E-mail" type="email" value={form.email} onChange={campo("email")}
              placeholder="compras@loja.com.br" maxLength={LIMITES.email} style={borda("email")} />
            <Erro>{erro("email")}</Erro>
          </div>
        </Grade>
      </Secao>

      <Secao titulo="Endereço">
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <Input label={r("CEP", "cep")} value={form.cep} onChange={campo("cep", mascaraCep)}
              placeholder="49000-000" inputMode="numeric" style={borda("cep")} />
          </div>
          <Btn variant="ghost" icon="search" onClick={buscarCep}
            disabled={soDigitos(form.cep).length !== 8 || consultando === "cep"}
            style={{ padding: "9px 12px" }}>
            {consultando === "cep" ? "Buscando..." : "Buscar"}
          </Btn>
        </div>
        <Erro>{erro("cep") || msgCep}</Erro>
        <Input label={r("Logradouro", "logradouro")} value={form.logradouro} onChange={campo("logradouro")}
          placeholder="Rua, avenida..." maxLength={LIMITES.logradouro} style={borda("logradouro")} />
        <Erro>{erro("logradouro")}</Erro>
        <Grade min={110}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Input label={r("Número", "numero")} value={form.numero} onChange={campo("numero")}
              placeholder="123 ou S/N" style={borda("numero")} />
            <Erro>{erro("numero")}</Erro>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Input label="Complemento" value={form.complemento} onChange={campo("complemento")}
              placeholder="Loja 01, galpão..." maxLength={LIMITES.complemento} style={borda("complemento")} />
            <Erro>{erro("complemento")}</Erro>
          </div>
        </Grade>
        <Input label={r("Bairro", "bairro")} value={form.bairro} onChange={campo("bairro")}
          maxLength={LIMITES.bairro} style={borda("bairro")} />
        <Erro>{erro("bairro")}</Erro>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 12 }}>
          <Input label={r("Cidade", "cidade")} value={form.cidade} onChange={campo("cidade")}
            placeholder="Aracaju" maxLength={LIMITES.cidade} style={borda("cidade")} />
          <Select label={r("UF", "uf")} value={form.uf} onChange={campo("uf")} style={borda("uf")}
            options={[{ value: "", label: "—" }, ...UFS.map((u) => ({ value: u, label: u }))]} />
        </div>
        <Erro>{erro("cidade") || erro("uf")}</Erro>
      </Secao>

      <Secao titulo="Observações">
        <textarea value={form.observacoes} onChange={campo("observacoes")} rows={3}
          placeholder="Horário de recebimento, doca, como prefere ser cobrado..."
          style={{ border: `1.5px solid ${COLORS.cinzaClaro}`, borderRadius: 8, padding: "9px 13px", fontSize: 14, outline: "none", color: COLORS.cinzaEscuro, background: COLORS.branco, fontFamily: "inherit", resize: "vertical" }} />
      </Secao>
    </div>
  );
}

const OBRIGATORIOS = new Set(["cnpjCpf", "razaoSocial", "logradouro", "numero", "bairro", "cidade", "uf", "cep"]);

const Linha = ({ rotulo, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
    <div style={{ fontSize: 11, color: COLORS.cinza, textTransform: "uppercase", letterSpacing: 0.4 }}>{rotulo}</div>
    <div style={{ fontSize: 14, color: children ? COLORS.cinzaEscuro : COLORS.cinza, overflowWrap: "anywhere" }}>
      {children || "—"}
    </div>
  </div>
);

/** A ficha só para leitura: tudo o que se sabe do cliente, num relance. */
export function FichaCadastral({ item, extra }) {
  const endereco = enderecoCompleto(item);
  const tel = soDigitos(item.telefone);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, background: COLORS.creme, borderRadius: 10, padding: 14 }}>
      <Grade min={160}>
        <Linha rotulo="Razão Social">{item.razaoSocial}</Linha>
        <Linha rotulo="CNPJ / CPF">{item.cnpjCpf}</Linha>
        <Linha rotulo="Inscrição Estadual">{item.ie}</Linha>
        <Linha rotulo="Responsável">{item.contato}</Linha>
        <Linha rotulo="Telefone">
          {tel ? <a href={`tel:${tel}`} style={{ color: COLORS.verde, textDecoration: "none" }}>{item.telefone}</a> : null}
        </Linha>
        <Linha rotulo="E-mail">
          {item.email ? <a href={`mailto:${item.email}`} style={{ color: COLORS.verde, textDecoration: "none" }}>{item.email}</a> : null}
        </Linha>
        {extra}
      </Grade>
      <Linha rotulo="Endereço">
        {endereco ? (
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`}
            target="_blank" rel="noreferrer" style={{ color: COLORS.cinzaEscuro }}>
            {endereco}
          </a>
        ) : null}
      </Linha>
      {item.observacoes && <Linha rotulo="Observações"><span style={{ whiteSpace: "pre-wrap" }}>{item.observacoes}</span></Linha>}
    </div>
  );
}

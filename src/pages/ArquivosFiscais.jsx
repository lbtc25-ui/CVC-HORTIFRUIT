import { useState } from "react";

import { Btn, Card, Icon, Input } from "../components/ui";
import { gerarSpedContribuicoes } from "../lib/sped/contribuicoes";
import { coletarDocumentosDoMes } from "../lib/sped/coletar";
import { gerarSpedFiscal } from "../lib/sped/fiscal";
import { baixarArquivo, paraLatin1 } from "../lib/sped/formato";
import { gerarSintegra } from "../lib/sped/sintegra";
import { COLORS } from "../lib/tema";

/**
 * Arquivos fiscais — o que o contador pede todo mês, gerado das NF-e do mês
 * (as emitidas pelo app, as devoluções de entrada e as recebidas da SEFAZ):
 *
 *   SPED Fiscal (EFD ICMS/IPI)            arquivo auxiliar: cadastros e notas;
 *   SPED Contribuições (EFD PIS/COFINS)   arquivo auxiliar: cadastros e notas;
 *   Sintegra                              registros 10, 11, 50, 54, 75 e 90.
 *
 * Os dois SPED são "auxiliares": o programa do contador importa e completa com
 * a apuração, o inventário e os dados dele. Os XMLs são baixados uma vez por
 * mês e reaproveitados entre os três botões (e numa nova tentativa).
 */

const mesAnterior = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const ARQUIVOS = {
  fiscal: {
    titulo: "SPED Fiscal (ICMS/IPI)",
    texto: "Arquivo auxiliar da EFD ICMS/IPI: participantes, unidades, produtos e as notas do mês (C100, C170 e C190). A apuração do ICMS e o inventário o contador completa ao importar.",
    nome: (mes) => `SPED-Fiscal-${mes.replace("-", "")}.txt`,
  },
  contribuicoes: {
    titulo: "SPED Contribuições (PIS/COFINS)",
    texto: "Arquivo auxiliar da EFD PIS/COFINS: cadastros e as notas de venda e devolução do mês, com PIS e COFINS por item. O regime, os créditos e a apuração ficam com o contador.",
    nome: (mes) => `SPED-Contribuicoes-${mes.replace("-", "")}.txt`,
  },
  sintegra: {
    titulo: "Sintegra",
    texto: "Registros 10 (empresa), 11 (endereço), 50 (notas por CFOP e alíquota), 54 (itens), 75 (produtos) e 90 (totais), em linhas de 126 posições.",
    nome: (mes) => `Sintegra-${mes.replace("-", "")}.txt`,
  },
};

const resumo = (documentos) => {
  const regulares = documentos.filter((d) => d.situacao === "00");
  return {
    total: documentos.length,
    saidas: regulares.filter((d) => d.operacao === "1").length,
    entradas: regulares.filter((d) => d.operacao === "0").length,
    canceladas: documentos.filter((d) => d.situacao !== "00").length,
  };
};

const ArquivosFiscais = ({ dados }) => {
  const [mes, setMes] = useState(mesAnterior);
  const [incluirCompras, setIncluirCompras] = useState(false);
  const [ocupado, setOcupado] = useState(null); // "fiscal" | "contribuicoes" | "sintegra"
  const [progresso, setProgresso] = useState(null);
  const [erro, setErro] = useState("");
  const [gerado, setGerado] = useState(null); // { tipo, nome, resumo, avisos }

  const gerar = async (tipo) => {
    setOcupado(tipo);
    setErro("");
    setGerado(null);
    try {
      const { documentos, empresa, avisos, periodo } = await coletarDocumentosDoMes({ dados, mes, aoProgredir: setProgresso });
      if (!documentos.length) throw new Error("Nenhuma nota neste mês.");
      const base = { empresa, periodo, documentos };
      let linhas;
      if (tipo === "fiscal") linhas = gerarSpedFiscal(base).linhas;
      else if (tipo === "contribuicoes") linhas = gerarSpedContribuicoes({ ...base, incluirCompras }).linhas;
      else linhas = gerarSintegra(base).linhas;
      const nome = ARQUIVOS[tipo].nome(mes);
      baixarArquivo(nome, paraLatin1(linhas));
      setGerado({ tipo, nome, resumo: resumo(documentos), avisos, linhas: linhas.length });
    } catch (e) {
      setErro(e.message ?? String(e));
    } finally {
      setOcupado(null);
      setProgresso(null);
    }
  };

  const mudarMes = (v) => {
    setMes(v);
    setGerado(null);
    setErro("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ minWidth: 200 }}>
          <Input label="Mês de referência" type="month" value={mes} max={mesAnterior()} onChange={(e) => e.target.value && mudarMes(e.target.value)} />
        </div>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: COLORS.cinzaEscuro, paddingBottom: 10 }}>
          <input type="checkbox" checked={incluirCompras} onChange={(e) => setIncluirCompras(e.target.checked)} />
          Incluir compras de fornecedor no SPED Contribuições
        </label>
      </div>

      {Object.entries(ARQUIVOS).map(([tipo, a]) => (
        <Card key={tipo} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: COLORS.cinzaEscuro, marginBottom: 4 }}>{a.titulo}</div>
            <div style={{ fontSize: 13, color: COLORS.cinza, lineHeight: 1.5 }}>{a.texto}</div>
          </div>
          <Btn onClick={() => gerar(tipo)} disabled={!!ocupado || !mes}>
            {ocupado === tipo
              ? (progresso?.total ? `Lendo notas ${progresso.feito} de ${progresso.total}...` : "Reunindo as notas...")
              : "Gerar e baixar .txt"}
          </Btn>
        </Card>
      ))}

      {erro && (
        <Card style={{ background: "#FFEBEE", color: "#C62828", fontSize: 14 }}>Não foi possível gerar: {erro}</Card>
      )}

      {gerado && (
        <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontWeight: 700, color: COLORS.verde }}>{gerado.nome} baixado</div>
          <div style={{ fontSize: 13, color: COLORS.cinzaEscuro }}>
            {gerado.resumo.total} nota(s) do mês: {gerado.resumo.saidas} de saída, {gerado.resumo.entradas} de entrada
            {gerado.resumo.canceladas > 0 && `, ${gerado.resumo.canceladas} cancelada(s)/denegada(s)`} · {gerado.linhas} linhas.
          </div>
          {gerado.avisos.length > 0 && (
            <div style={{ fontSize: 13, color: "#856404", background: "#FFF3CD", borderRadius: 8, padding: "10px 14px" }}>
              <strong>Atenção — {gerado.avisos.length} aviso(s):</strong>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {gerado.avisos.map((a) => <li key={a}>{a}</li>)}
              </ul>
            </div>
          )}
        </Card>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: COLORS.cinza, lineHeight: 1.5 }}>
        <Icon name="alert" size={15} color={COLORS.cinza} />
        <span>
          Os arquivos saem das NF-e (XML) do mês: as emitidas por aqui, as devoluções de entrada e as recebidas da SEFAZ
          (que precisam ter o XML completo — manifeste na aba Recebidas). Mande ao contador para importar; confira no
          validador da Receita (PVA) antes de transmitir.
        </span>
      </div>
    </div>
  );
};

export default ArquivosFiscais;

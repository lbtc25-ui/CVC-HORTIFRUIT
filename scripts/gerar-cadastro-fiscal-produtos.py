#!/usr/bin/env python3
"""
Preenche NCM/unidade/CFOP dos produtos a partir do cadastro de produtos do
Omie.

    python3 scripts/gerar-cadastro-fiscal-produtos.py <arquivo.csv>

Gera supabase/importacao-fiscal-produtos.sql. Idempotente (usa coalesce).

O `omie_codigo_produto` (bigint) não sai do export manual — a coluna
"Código" de lá é o SKU (ex.: "PRD00001"), mas o `IncluirPedido` da API pede
o `codigo_produto` interno do Omie. Veio de rodar `ListarProdutos` pela API
de verdade (developer.omie.com.br → testador da API), por isso está
hardcoded em OMIE_CODIGO_PRODUTO_POR_SKU abaixo em vez de vir do CSV.

CFOP: confirmado com a Carvalho Cruz que laranja e abóbora são produção
própria da fazenda deles — CFOP 5.101, não o 5.102 (revenda) que é o
padrão do app.
"""
import csv
import re
import sys
from pathlib import Path

# nome do produto no app -> SKU (coluna "Código") no export do Omie.
MAPEAMENTO = {
    "Laranja Agranel": "PRD00001",
    "Saco 2,5 kg": "PRD00005",
    "Saco 3 kg": "PRD00004",
    "Saco 5 kg": "PRD00002",
    "Saco 10 kg": "PRD00007",
    "Laranja Lima": "PRD00003",
    "Abóbora": "PRD00008",
}

CFOP_PRODUCAO_PROPRIA = "5.101"

# SKU (coluna "Código" do Omie) -> codigo_produto interno, obtido via
# ListarProdutos (geral/produtos) na API de verdade.
OMIE_CODIGO_PRODUTO_POR_SKU = {
    "PRD00001": 3488791604,
    "PRD00005": 3499070124,
    "PRD00004": 3498404281,
    "PRD00002": 3495889206,
    "PRD00007": 3501923470,
    "PRD00003": 3497757194,
    "PRD00008": 3514250300,
}


def sql_txt(v):
    return "null" if not v else "'" + str(v).replace("'", "''") + "'"


def unidade_curta(v):
    """"Quilograma (KG)" -> "KG"."""
    m = re.search(r"\(([^)]+)\)", v or "")
    return m.group(1) if m else (v or "").strip() or None


def ler_por_sku(caminho):
    with open(caminho, encoding="utf-8-sig", newline="") as f:
        linhas = list(csv.reader(f, delimiter=";", quotechar='"'))

    por_sku = {}
    for linha in linhas[1:]:
        if not any(c.strip() for c in linha):
            continue
        codigo, ncm, unidade = linha[2], linha[4], linha[9]
        por_sku[codigo] = dict(ncm=ncm.strip() or None, unidade_omie=unidade_curta(unidade))
    return por_sku


def main():
    if len(sys.argv) < 2:
        sys.exit("uso: python3 scripts/gerar-cadastro-fiscal-produtos.py <arquivo.csv>")
    origem = Path(sys.argv[1])
    por_sku = ler_por_sku(origem)

    L = []
    p = L.append
    p("-- ============================================================================")
    p("--  NCM/unidade/CFOP dos produtos — gerado por scripts/gerar-cadastro-fiscal-produtos.py")
    p("--  NÃO edite direto no banco: corrija o dicionário MAPEAMENTO no script e rode")
    p("--  de novo.")
    p("--")
    p(f"--  Origem (NCM/unidade): {origem.name} (export do cadastro de produtos do Omie).")
    p("--  omie_codigo_produto veio da API (ListarProdutos), está hardcoded no script.")
    p("--  CFOP 5.101 porque laranja e abóbora são produção própria da fazenda da")
    p("--  Carvalho Cruz, não revenda (confirmado com eles).")
    p("--")
    p("--  Rode DEPOIS de migracao-08-nfe.sql e migracao-09-omie-ids.sql.")
    p("--  Idempotente: usa coalesce, nunca sobrescreve o que já tiver sido preenchido.")
    p("-- ============================================================================")
    p("")
    p("begin;")
    p("")

    faltando = []
    total = 0
    for produto in sorted(MAPEAMENTO):
        sku = MAPEAMENTO[produto]
        dados = por_sku.get(sku)
        if not dados:
            faltando.append((produto, sku))
            continue
        total += 1
        codigo_produto = OMIE_CODIGO_PRODUTO_POR_SKU.get(sku)
        p("update public.produtos set")
        p(f"    ncm                 = coalesce(ncm, {sql_txt(dados['ncm'])}),")
        p(f"    unidade_omie        = coalesce(unidade_omie, {sql_txt(dados['unidade_omie'])}),")
        p(f"    cfop_padrao         = coalesce(cfop_padrao, {sql_txt(CFOP_PRODUCAO_PROPRIA)}),")
        p(f"    omie_codigo_produto = coalesce(omie_codigo_produto, {codigo_produto or 'null'})")
        p(f"  where lower(nome) = lower({sql_txt(produto)});")
        p("")

    p("commit;")
    p("")
    p("-- Confira:  select nome, ncm, unidade_omie, cfop_padrao, omie_codigo_produto")
    p("--           from public.produtos order by nome;")

    destino = Path("supabase/importacao-fiscal-produtos.sql")
    destino.write_text("\n".join(L))

    print(f"{destino} gerado\n")
    print(f"  produtos atualizados   {total:>8}")
    if faltando:
        print("  SKU não achado no CSV para (confira o MAPEAMENTO ou o arquivo de origem):")
        for produto, sku in faltando:
            print(f"    {produto}: {sku}")


if __name__ == "__main__":
    main()

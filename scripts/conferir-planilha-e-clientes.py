#!/usr/bin/env python3
"""
Gera a conferência "planilha x app" e "Omie x app" para rodar no SQL Editor
do Supabase — só SELECT, não altera nada.

    python3 scripts/conferir-planilha-e-clientes.py "DISTRIBUIDORA CARVALHO CRUZ.xlsx" clientes-omie.csv

Gera supabase/conferencia-planilha-e-clientes.sql com três consultas:

  1. Vendas da planilha que não estão no app. Compara pelo dia + rede + loja
     (somando os pedidos do dia), e não pelo id: uma venda lançada à mão no
     app tem id próprio, diferente do que a importação geraria, e mesmo
     assim conta como lançada.
  2. Rede/loja que aparece na planilha e não existe no app.
  3. Clientes do Omie (tag Cliente) sem loja nem rede com aquele CNPJ/CPF.

Precisa de openpyxl:  pip3 install openpyxl
"""
import csv
import importlib.util
import re
import sys
from collections import defaultdict
from pathlib import Path

AQUI = Path(__file__).resolve().parent

# Reaproveita a leitura da planilha do importador — o que é "uma venda" tem
# de ser a mesma coisa nos dois lugares.
_spec = importlib.util.spec_from_file_location("importar_planilha", AQUI / "importar-planilha.py")
imp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(imp)

TAGS_INTERNAS = {"funcionário", "socio"}
CPF_CNPJ_PLACEHOLDER = "00000000000"


def sql_txt(v):
    return "null" if v in (None, "") else "'" + str(v).replace("'", "''") + "'"


def ler_pedidos(xlsx):
    import openpyxl
    wb = openpyxl.load_workbook(xlsx, data_only=True)
    abas = {n.strip().upper(): n for n in wb.sheetnames}
    avisos, redes, lojas, pedidos = [], set(), set(), {}
    if "DADOS ANTIGOS" in abas:
        pedidos.update(imp.ler_vendas(wb[abas["DADOS ANTIGOS"]], 2026, 8, redes, lojas,
                                      avisos, "DADOS ANTIGOS"))
    for nome, mes in [("SETEMBRO", 9), ("OUTUBRO", 10), ("NOVEMBRO", 11), ("DEZEMBRO", 12)]:
        if nome in abas:
            pedidos.update(imp.ler_vendas(wb[abas[nome]], 2026, mes, redes, lojas, avisos, nome))
    # Soma por dia/rede/loja: no app o mesmo dia pode ter virado um pedido
    # só ou vários (prazo diferente), então a comparação é pelo total do dia.
    dia = defaultdict(lambda: [0.0, 0.0])
    for (data, rede, loja, _prazo), itens in pedidos.items():
        dia[(data, rede, loja)][0] += sum(0 if i["bonificado"] else i["total"] for i in itens)
        dia[(data, rede, loja)][1] += sum(i["kg"] for i in itens)
    return dia, lojas


def ler_clientes(caminho):
    with open(caminho, encoding="utf-8-sig", newline="") as f:
        linhas = list(csv.reader(f, delimiter=";", quotechar='"'))
    saida = []
    for l in linhas[1:]:
        if len(l) < 9:
            continue
        tags = {t.strip().lower() for t in l[1].split(",") if t.strip()}
        doc = re.sub(r"\D", "", l[2])
        if "cliente" not in tags or tags & TAGS_INTERNAS or doc == CPF_CNPJ_PLACEHOLDER:
            continue
        saida.append((doc, l[2], l[3].strip(), (l[4] or l[3]).strip(), l[8].strip(), l[11].strip()))
    return saida


def main():
    if len(sys.argv) < 3:
        sys.exit("uso: python3 scripts/conferir-planilha-e-clientes.py <planilha.xlsx> <clientes-omie.csv>")
    xlsx, csv_omie = Path(sys.argv[1]), Path(sys.argv[2])
    dia, lojas = ler_pedidos(xlsx)
    clientes = ler_clientes(csv_omie)

    L = []
    p = L.append
    p("-- ============================================================================")
    p("--  Conferência planilha x app e Omie x app")
    p("--  gerado por scripts/conferir-planilha-e-clientes.py — NÃO edite à mão.")
    p("--")
    p(f"--  Planilha: {xlsx.name}   Clientes: {csv_omie.name}")
    p("--")
    p("--  Só leitura. Rode cada bloco no SQL Editor do Supabase; o que voltar é")
    p("--  o que falta no app. Resultado vazio = tudo conferido.")
    p("-- ============================================================================")
    p("")

    valores_vendas = ",\n".join(
        f"    (date {sql_txt(d)}, {sql_txt(r)}, {sql_txt(l)}, {t:.2f}, {kg:.3f})"
        for (d, r, l), (t, kg) in sorted(dia.items())
    )
    p("-- ─── 1. Vendas da planilha que faltam (ou divergem) no app ─────────────────")
    p("-- Por dia + rede + loja. Pedido cancelado no app não conta como lançado.")
    p("with planilha (data, rede, loja, total, kg) as (values")
    p(valores_vendas)
    p("), app as (")
    p("  select v.data, lower(r.nome) rede, lower(l.nome) loja,")
    p("         sum(v.total) total, sum(v.kg_total) kg, count(*) pedidos")
    p("  from public.vendas v")
    p("  join public.lojas l on l.id = v.loja_id")
    p("  join public.redes r on r.id = l.rede_id")
    p("  where v.status <> 'cancelado'")
    p("  group by 1, 2, 3")
    p(")")
    p("select p.data, p.rede, p.loja,")
    p("       p.total as total_planilha, a.total as total_app,")
    p("       p.kg as kg_planilha, a.kg as kg_app,")
    p("       case when a.total is null then 'FALTA NO APP' else 'VALOR DIFERENTE' end as situacao")
    p("from planilha p")
    p("left join app a on a.data = p.data and a.rede = lower(p.rede) and a.loja = lower(p.loja)")
    p("where a.total is null or abs(a.total - p.total) > 0.01")
    p("order by p.data, p.rede, p.loja;")
    p("")

    valores_lojas = ",\n".join(f"    ({sql_txt(r)}, {sql_txt(l)})" for r, l in sorted(lojas))
    p("-- ─── 2. Rede/loja da planilha que não existe no app ────────────────────────")
    p("with planilha (rede, loja) as (values")
    p(valores_lojas)
    p(")")
    p("select p.rede, p.loja")
    p("from planilha p")
    p("where not exists (")
    p("  select 1 from public.lojas l join public.redes r on r.id = l.rede_id")
    p("  where lower(r.nome) = lower(p.rede) and lower(l.nome) = lower(p.loja))")
    p("order by 1, 2;")
    p("")

    valores_cli = ",\n".join(
        f"    ({sql_txt(doc)}, {sql_txt(fmt)}, {sql_txt(razao)}, {sql_txt(fant)}, {sql_txt(cid)}, {sql_txt(bai)})"
        for doc, fmt, razao, fant, cid, bai in clientes
    )
    p("-- ─── 3. Clientes do Omie sem cadastro no app ───────────────────────────────")
    p("-- Procura o CNPJ/CPF na loja e na rede. Se voltar aqui, ou o cliente não")
    p("-- existe no app, ou existe sem o CNPJ preenchido (aí é só completar).")
    p("with omie (doc, cnpj_cpf, razao_social, fantasia, cidade, bairro) as (values")
    p(valores_cli)
    p(")")
    p("select o.cnpj_cpf, o.razao_social, o.fantasia, o.cidade,")
    p("       case when mesmo_nome.loja is null then 'NÃO CADASTRADO'")
    p("            else 'SEM CNPJ — já existe ' || mesmo_nome.loja end as situacao")
    p("from omie o")
    p("left join lateral (")
    p("  select r.nome || ' / ' || l.nome as loja")
    p("  from public.lojas l join public.redes r on r.id = l.rede_id")
    p("  where l.cnpj_cpf is null and lower(l.nome) like lower(o.fantasia) || '%'")
    p("  -- filial com o mesmo nome fantasia: prefere a do mesmo bairro")
    p("  order by lower(l.nome) like '%' || lower(coalesce(o.bairro, '')) || '%' desc")
    p("  limit 1) mesmo_nome on true")
    p("where not exists (select 1 from public.lojas l")
    p("                  where regexp_replace(coalesce(l.cnpj_cpf, ''), '\\D', '', 'g') = o.doc)")
    p("  and not exists (select 1 from public.redes r")
    p("                  where regexp_replace(coalesce(r.cnpj_cpf, ''), '\\D', '', 'g') = o.doc)")
    p("order by o.razao_social, o.cnpj_cpf;")
    p("")

    destino = AQUI.parent / "supabase" / "conferencia-planilha-e-clientes.sql"
    destino.write_text("\n".join(L))
    print(f"{destino.relative_to(AQUI.parent)} gerado")
    print(f"  dias/lojas com venda  {len(dia):>5}")
    print(f"  rede/loja             {len(lojas):>5}")
    print(f"  clientes Omie         {len(clientes):>5}")


if __name__ == "__main__":
    main()

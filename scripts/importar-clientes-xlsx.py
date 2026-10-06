#!/usr/bin/env python3
"""
Gera SQL do cadastro de clientes (redes e lojas) a partir do Excel exportado
pelo app (Clientes → Exportar: abas "Redes" e "Lojas").

    python3 scripts/importar-clientes-xlsx.py <clientes.xlsx>

Gera supabase/importacao-clientes-cvc.sql. Reimportar atualiza em vez de
duplicar (rede por nome; loja por rede + nome). Precisa do openpyxl.
"""
import sys
from pathlib import Path
import openpyxl

CAMPOS = [
    ("razao_social", "Razão Social"), ("cnpj_cpf", "CNPJ / CPF"), ("ie", "Inscrição Estadual"),
    ("contato", "Responsável"), ("telefone", "Telefone"), ("email", "E-mail"), ("cep", "CEP"),
    ("logradouro", "Logradouro"), ("numero", "Número"), ("complemento", "Complemento"),
    ("bairro", "Bairro"), ("cidade", "Cidade"), ("uf", "UF"), ("observacoes", "Observações"),
]

def q(v):
    if v is None or str(v).strip() == "":
        return "null"
    return "'" + str(v).strip().replace("'", "''") + "'"

def linhas(ws):
    rows = list(ws.iter_rows(values_only=True))
    cab = [str(c).strip() for c in rows[0]]
    for r in rows[1:]:
        if any(c not in (None, "") for c in r):
            yield dict(zip(cab, r))

def main():
    wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
    cols = [c for c, _ in CAMPOS]
    out = ["-- Gerado por scripts/importar-clientes-xlsx.py — não edite à mão.",
           "-- Rode depois de instalar.sql. Reimportar atualiza, não duplica.", "", "begin;", ""]
    nredes = nlojas = 0
    for r in linhas(wb["Redes"]):
        vals = [q(r.get(rot)) for _, rot in CAMPOS]
        status = "inativo" if str(r.get("Status") or "").lower() == "inativo" else "ativo"
        out.append(
            f"insert into public.redes (nome, status, {', '.join(cols)}) values ({q(r['Rede'])}, '{status}', {', '.join(vals)})\n"
            f"  on conflict (lower(nome)) do update set status = excluded.status, "
            + ", ".join(f"{c} = excluded.{c}" for c in cols) + ";")
        nredes += 1
    out.append("")
    for r in linhas(wb["Lojas"]):
        vals = [q(r.get(rot)) for _, rot in CAMPOS]
        status = "inativo" if str(r.get("Status") or "").lower() == "inativo" else "ativo"
        out.append(
            f"insert into public.lojas (rede_id, nome, status, {', '.join(cols)})\n"
            f"  select id, {q(r['Loja'])}, '{status}', {', '.join(vals)} from public.redes where lower(nome) = lower({q(r['Rede'])})\n"
            f"  on conflict (rede_id, lower(nome)) do update set status = excluded.status, "
            + ", ".join(f"{c} = excluded.{c}" for c in cols) + ";")
        nlojas += 1
    out += ["", "commit;", f"-- {nredes} redes, {nlojas} lojas"]
    dest = Path(__file__).resolve().parent.parent / "supabase" / "importacao-clientes-cvc.sql"
    dest.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"{dest}: {nredes} redes, {nlojas} lojas")

main()

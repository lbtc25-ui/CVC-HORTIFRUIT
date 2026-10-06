#!/usr/bin/env python3
"""
Importa o cadastro de clientes exportado do Omie (Serviços e NFS-e) para SQL
do Supabase.

    python3 scripts/importar-clientes-omie.py <arquivo.csv>

Gera supabase/importacao-clientes-omie.sql. Os ids são derivados do nome da
rede/loja, então reimportar ATUALIZA em vez de duplicar.

O app já tem redes criadas a partir do histórico de vendas (PETROX, REDE
MAIS, ATAKAREJO...), com lojas de nome curto (COROA, BARRA, F.PORTO) que não
batem com o nome fantasia/endereço do Omie. Para não duplicar loja (a mesma
banca cadastrada duas vezes, uma com cada nome), este script só ENRIQUECE
essas redes já conhecidas — completa o telefone se estiver vazio — e não
mexe nas lojas delas. Empresa que ainda não existe no app entra como rede
nova, com uma loja por filial do Omie.

REDE_CONHECIDA faz esse casamento. Foi montada à mão, lendo o arquivo do
Omie linha a linha e cruzando com as lojas que já existem em
supabase/importacao-planilha.sql (ex.: a HIPER CARNES do app já tem lojas
ARUANA e JABOTIANA — batendo com as filiais Aruana/Jabotiana do Omie, ainda
que sejam CNPJs diferentes) e com contato repetido (mesmo e-mail em Pandelli
e Dupane; mesmo e-mail em Astro, Bali, Nordestão e Mercado do Trabalhador,
que já são as lojas da rede VINICIUS). Confira antes de rodar em produção —
é leitura de nome próprio, não uma regra que se prove sozinha.
"""
import csv
import hashlib
import re
import sys
from pathlib import Path

# ─── Ids estáveis ───────────────────────────────────────────────────────────

def uuid_de(*partes):
    h = hashlib.sha1("|".join(str(p) for p in partes).encode()).hexdigest()
    return f"{h[:8]}-{h[8:12]}-4{h[13:16]}-8{h[17:20]}-{h[20:32]}"


def sql_txt(v):
    return "null" if not v else "'" + str(v).replace("'", "''") + "'"


def so_digitos(v):
    return re.sub(r"\D", "", v or "")


def cidade_sem_uf(v):
    # "Aracaju (SE)" -> "Aracaju"
    return re.sub(r"\s*\([A-Z]{2}\)\s*$", "", (v or "").strip()) or None


def limpar(v):
    return (v or "").strip() or None


# ─── Quem já é rede no app (veio do histórico de vendas) ────────────────────
# Nomes exatamente como estão em supabase/importacao-planilha.sql.

REDES_EXISTENTES = {
    "ATAKAREJO", "BOMBOM", "BRAUNA", "DIVERSOS", "FASOUTO", "HIPER CARNES",
    "HOTEL AQUARIUS", "HOTEL SAO MANUEL", "J.PEIXOTO", "MIX MATEUS",
    "NUNES PEIXOTO", "PANDELLI", "PETROX", "PRIMAVERA", "REDE ALPHA",
    "REDE MAIS", "SERRANO", "SILVA SUPERMERCADO", "SOUZA",
    "SUPERMERCADO DA PRAIA", "TABAJARA", "VICTOR", "VINICIUS",
}

# raiz do CNPJ/CPF (8 ou 11 dígitos, sem pontuação) -> nome da rede no app.
# Cobre tanto empresa que já é rede existente (some no INSERT, só enriquece o
# telefone) quanto empresa nova que aparece em mais de uma linha do Omie sob
# nomes diferentes.
REDE_CONHECIDA = {
    "08309233": "SERRANO",                # A.C. COMERCIO DE COMBUSTIVEIS — loja ADELIA FRANCO
    "12431802": "SERRANO",                # COMERCIO DE COMBUSTIVEIS SERRANO — loja AMERICA
    "01984422": "SERRANO",                # JARDINS DELICATESSEN — loja SILVIO TEIXEIRA
    "03894230": "SOUZA",                  # COMERCIAL SOUZA E GOIS — fantasia "MINIMERCADO PRECOBOM"
    "08297710": "REDE ALPHA",             # ALPHA COMERCIAL DE COMBUSTIVEIS
    "73849952": "ATAKAREJO",              # ATAKAREJO DISTRIBUIDOR DE ALIMENTOS
    "08958327": "ATAKAREJO",              # UNIAO DISTRIBUIDORA — fantasia "ATAKAREJO MCR"
    "04136442": "BOMBOM",                 # SUPERMERCADO BOMBOM
    "35438260": "BRAUNA",                 # COMERCIAL DE BEBIDAS E ALIMENTOS BRAUNA
    "15598527": "FASOUTO",                # FASOUTO FARIA SOUTO COMERCIO
    "50747044": "HIPER CARNES",           # SUPERMERCADO ARUANA / JABOTIANA — já são lojas da rede HIPER CARNES
    "44069669": "HIPER CARNES",           # SUPERMERCADO HIPER CARNES BARRA
    "05540989": "HOTEL AQUARIUS",         # MARLIN EMPREENDIMENTOS — e-mail @aquarioshotel.com.br
    "02574828": "HOTEL SAO MANUEL",       # SAN MANUEL PRAIA HOTEL
    "35695317": "J.PEIXOTO",              # J PEIXOTO SUPERMERCADO
    "13152186": "NUNES PEIXOTO",          # SUPERMERCADO SAO LUCAS — fantasia "SUPERMERCADO NUNES PEIXOTO"
    "20671856": "PANDELLI",               # PANDELLI
    "38150088": "PANDELLI",               # DUPANE — mesmo e-mail (financeiro.pandelli@)
    "05297480": "PETROX",                 # PETROX COMERCIAL
    "13356779": "PRIMAVERA",              # REDE PRIMAVERA - HOSPITAL PRIMAVERA
    "54515737": "REDE MAIS",              # REDE MAIS COMERCIO DE ALIMENTOS
    "48252281": "SILVA SUPERMERCADO",     # SILVA SUPERMERCADO
    "04636474": "TABAJARA",               # COMERCIAL DE ALIMENTOS SANTA TEREZINHA — fantasia "TABAJARA SUPERMERCADO"
    "59567932": "VINICIUS",               # ASTRO BAR E RESTAURANTE — já é a loja ASTRO da rede VINICIUS
    "48284967": "VINICIUS",               # BALI RESTAURANTE BAR — mesmo e-mail de contato do Nordestão
    "39493946": "VINICIUS",               # NORDESTAO RESTAURANTE — já é a loja NORDESTAO da rede VINICIUS
    "64989506": "VINICIUS",               # MERCADO DO TRABALHADOR ATACADISTA — já é a loja MERCADO TRABALHADOR
    # Empresa nova, mas que aparece em mais de uma linha do Omie: agrupa sob
    # um nome de rede só, em vez de usar a razão social de cada filial.
    "23511178": "GONZAGA",                # LENILSON LIMA MOTA SUPERMERCADO — Gonzaga Hipermercado/Express
}

# Tags que, mesmo com "Cliente" na lista, marcam pessoa da casa — sócio ou
# funcionário cadastrado como contato, não cliente de fruta.
TAGS_INTERNAS = {"funcionário", "socio"}

CPF_CNPJ_PLACEHOLDER = "00000000000"  # "Cliente Consumidor / Sem Tomador"


def ler_clientes(caminho):
    with open(caminho, encoding="utf-8-sig", newline="") as f:
        linhas = list(csv.reader(f, delimiter=";", quotechar='"'))

    registros = []
    for linha in linhas[1:]:
        if not any(c.strip() for c in linha):
            continue
        situacao, tags = linha[0], linha[1]
        cnpj_cpf, razao, fantasia = linha[2], linha[3], linha[4]
        telefone, contato, email = linha[5], linha[6], linha[7]
        cidade, estado, endereco, bairro = linha[8], linha[9], linha[10], linha[11]

        tagset = {t.strip().lower() for t in tags.split(",") if t.strip()}
        documento = so_digitos(cnpj_cpf)

        if "cliente" not in tagset:
            continue
        if tagset & TAGS_INTERNAS:
            continue
        if documento == CPF_CNPJ_PLACEHOLDER:
            continue

        raiz = documento[:8] if len(documento) == 14 else documento
        registros.append(dict(
            raiz=raiz, razao=limpar(razao), fantasia=limpar(fantasia) or limpar(razao),
            telefone=limpar(telefone), cidade=cidade_sem_uf(cidade), bairro=limpar(bairro),
        ))
    return registros


def nome_rede_nova(registros_do_grupo):
    """Sem correspondência conhecida: usa o nome fantasia mais comum do
    grupo (ou a razão social, se não houver fantasia) como nome da rede."""
    fantasias = [r["fantasia"] for r in registros_do_grupo if r["fantasia"]]
    if not fantasias:
        return registros_do_grupo[0]["razao"]
    return max(set(fantasias), key=fantasias.count)


def nome_loja(registro, repetidos):
    base = registro["fantasia"] or registro["razao"]
    if repetidos.get(base, 0) <= 1:
        return base
    # Nome fantasia repetido dentro da rede (duas filiais com o mesmo nome
    # comercial): desempata pelo bairro, senão pela cidade.
    sufixo = registro["bairro"] or registro["cidade"] or ""
    return f"{base} - {sufixo}".strip(" -") if sufixo else base


def main():
    if len(sys.argv) < 2:
        sys.exit("uso: python3 scripts/importar-clientes-omie.py <arquivo.csv>")
    origem = Path(sys.argv[1])
    registros = ler_clientes(origem)

    grupos = {}
    for r in registros:
        grupos.setdefault(r["raiz"], []).append(r)

    enriquecer = {}   # rede existente -> telefone (primeiro não vazio)
    novas_redes = {}  # nome da rede nova -> lista de registros (uma loja por registro)

    for raiz, regs in grupos.items():
        rede = REDE_CONHECIDA.get(raiz)
        if rede is None:
            rede = nome_rede_nova(regs)
        if rede in REDES_EXISTENTES:
            if rede not in enriquecer:
                tel = next((r["telefone"] for r in regs if r["telefone"]), None)
                enriquecer[rede] = tel
        else:
            novas_redes.setdefault(rede, []).extend(regs)

    # ─── SQL ────────────────────────────────────────────────────────────────
    L = []
    p = L.append
    p("-- ============================================================================")
    p("--  Cadastro de clientes — gerado por scripts/importar-clientes-omie.py")
    p("--  NÃO edite à mão: exporte o cadastro do Omie de novo e rode o script.")
    p("--")
    p(f"--  Origem: {origem.name} (export Omie — Serviços e NFS-e)")
    p("--")
    p("--  Rode DEPOIS de schema.sql, migracao-01-redes-lojas.sql e seed.sql.")
    p("--  Os ids vêm do nome da rede/loja, então reimportar ATUALIZA em vez de")
    p("--  duplicar.")
    p("--")
    p("--  Redes que já existem no app (vieram do histórico de vendas) só têm o")
    p("--  telefone completado, sem tocar nas lojas — o nome comercial da loja no")
    p("--  Omie não bate com o nome curto usado nas vendas. Empresa que ainda não")
    p("--  tinha rede no app entra nova, com uma loja por filial do Omie.")
    p("-- ============================================================================")
    p("")
    p("begin;")
    p("")

    p("-- ─── Enriquecimento das redes já existentes ─────────────────────────────────")
    p("-- Só completa o telefone se ele estiver vazio; nunca sobrescreve o que já tem.")
    p("")
    for rede in sorted(enriquecer):
        tel = enriquecer[rede]
        if not tel:
            continue
        p(f"update public.redes set telefone = coalesce(telefone, {sql_txt(tel)})")
        p(f"  where lower(nome) = lower({sql_txt(rede)});")
    p("")

    p("-- ─── Redes novas, com as lojas do Omie ──────────────────────────────────────")
    p("")
    for rede in sorted(novas_redes):
        regs = novas_redes[rede]
        tel_rede = next((r["telefone"] for r in regs if r["telefone"]), None)
        p(f"insert into public.redes (id, nome, telefone) values")
        p(f"  ({sql_txt(uuid_de('rede', rede))}, {sql_txt(rede)}, {sql_txt(tel_rede)})")
        p("  on conflict (lower(nome)) do nothing;")
    p("")
    total_lojas_novas = 0
    for rede in sorted(novas_redes):
        regs = novas_redes[rede]
        contagem = {}
        for r in regs:
            base = r["fantasia"] or r["razao"]
            contagem[base] = contagem.get(base, 0) + 1
        vistos = set()
        for r in regs:
            nome = nome_loja(r, contagem)
            chave = nome.lower()
            if chave in vistos:
                continue  # mesma filial apareceu 2x no Omie (ex.: matriz + endereço de cobrança)
            vistos.add(chave)
            total_lojas_novas += 1
            p(f"insert into public.lojas (id, rede_id, nome, cidade, telefone)")
            p(f"  select {sql_txt(uuid_de('loja', rede, nome))}, r.id, {sql_txt(nome)}, "
              f"{sql_txt(r['cidade'])}, {sql_txt(r['telefone'])}")
            p(f"  from public.redes r where lower(r.nome) = lower({sql_txt(rede)})")
            p("  on conflict (rede_id, lower(nome)) do nothing;")
    p("")
    p("commit;")
    p("")
    p("-- Confira:  select r.nome as rede, l.nome as loja, l.cidade, l.telefone")
    p("--           from public.lojas l join public.redes r on r.id = l.rede_id")
    p("--           order by r.nome, l.nome;")

    destino = Path("supabase/importacao-clientes-omie.sql")
    destino.write_text("\n".join(L))

    print(f"{destino} gerado\n")
    print(f"  linhas do Omie          {len(registros):>8}  (de {sum(1 for _ in open(origem, encoding='utf-8-sig')) - 1} no arquivo)")
    print(f"  redes existentes        {len(enriquecer):>8}  (telefone completado quando vazio)")
    print(f"  redes novas             {len(novas_redes):>8}")
    print(f"  lojas novas             {total_lojas_novas:>8}")


if __name__ == "__main__":
    main()

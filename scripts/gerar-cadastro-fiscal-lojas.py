#!/usr/bin/env python3
"""
Preenche CNPJ/IE/endereço/omie_codigo_cliente das lojas já existentes no app
(vindas do histórico de vendas, em importacao-planilha.sql) a partir do
export de clientes do Omie e da API ListarClientes.

    python3 scripts/gerar-cadastro-fiscal-lojas.py <arquivo.csv>

Gera supabase/importacao-fiscal-lojas.sql. Idempotente (usa coalesce, nunca
sobrescreve o que já foi preenchido/corrigido à mão).

Por que isso não dá pra automatizar por nome/bairro sozinho: o Omie usa o
nome fantasia ou o bairro do endereço, e as lojas no app têm apelidos curtos
que vêm do histórico de vendas (ex.: "F.PORTO", "GAZOL") — não sempre bate
com o nome fantasia nem com o bairro (ex.: a loja "AEROPORTO" da Petrox fica
no bairro Atalaia; quem sabe qual é qual são as pessoas que entregam lá).
Por isso o mapeamento abaixo foi conferido rede a rede com a Carvalho Cruz
— inclusive corrigindo dois palpites errados (Eco Posto/Mega da Rede Mais
estavam trocados) e usando um comprovante da própria Rede Mais para
confirmar o CNPJ novo dela (trocou em 01/02/2025, de 32.864.795 para
54.515.737). Não é para ser regenerado por heurística — se uma loja mudar
de CNPJ ou um endereço, edite o dicionário abaixo.

Redes com loja(s) ainda sem CNPJ resolvido, de propósito (ficam de fora
deste arquivo até serem confirmadas):
  - REDE ALPHA/FEIRA: sem candidato — o único CNPJ da Rede Alpha que
    sobrava (Ponto Novo) já foi confirmado como sendo o DETRAN.
  - MIX MATEUS, SUPERMERCADO DA PRAIA, VICTOR: não aparecem em nenhum
    export do Omie usado até agora (raiz de CNPJ desconhecida).

Confirmado por comprovante/nota real (não só pelo export):
  - ATAKAREJO/CD: DANFe real emitida em 21/09/2026 (pedido 1201539) pro
    CNPJ 73.849.952/0062-70 (BR-235/Socorro) confirma que é essa a loja CD
    — o outro candidato (Simões Filho-BA) é o ATAKAREJO/SALVADOR.
  - PETROX/ORLA P.D SOL: confirmado como a mesma loja física que
    PETROX/ORLA SOL (mesmo CNPJ, nomes diferentes no cadastro — mesmo
    padrão do FAROL/FAROLANDIA).
  - TABAJARA/JAPAOZINHO: confirmado como a mesma loja física que
    TABAJARA/MATRIZ (mesmo CNPJ, nomes diferentes no cadastro).
"""
import csv
import hashlib
import re
import sys
from pathlib import Path

# rede (como está em public.redes) -> { loja (como está em public.lojas): cnpj_cpf }
MAPEAMENTO = {
    "ATACAREJO MCR": {
        "FILIAL": "08.958.327/0002-63",
        "JOAO ALVES": "08.958.327/0001-82",
    },
    "ATAKAREJO": {
        "ADELIA": "73.849.952/0044-98",
        "CD": "73.849.952/0062-70",
        "GLORIA": "73.849.952/0051-17",
        "ITABAIANA": "73.849.952/0058-93",
        "SALVADOR": "73.849.952/0021-00",
    },
    "BOMBOM": {
        "ARACAJU": "04.136.442/0003-82",
        "ESTANCIA": "04.136.442/0001-10",
    },
    "BRAUNA": {
        "MATRIZ": "35.438.260/0005-51",
    },
    "FASOUTO": {
        "ESTANCIA": "15.598.527/0014-51",
        "INDUSTRIAL": "15.598.527/0013-70",
        "SOCORRO": "15.598.527/0016-13",
    },
    "HIPER CARNES": {
        "ARUANA": "50.747.044/0002-39",
        "BARRA": "44.069.669/0001-05",
        "JABOTIANA": "50.747.044/0001-58",
    },
    "HOTEL AQUARIUS": {
        "MATRIZ": "05.540.989/0001-40",
    },
    "HOTEL SAO MANUEL": {
        "MATRIZ": "02.574.828/0001-89",
    },
    "J.PEIXOTO": {
        "ARUANA": "35.695.317/0003-36",
        "PIABETA": "35.695.317/0001-74",
        "SAO BRAS": "35.695.317/0002-55",
    },
    "NUNES PEIXOTO": {
        "GLORIA": "13.152.186/0002-27",
        "ITABAIANA": "13.152.186/0001-46",
    },
    "PANDELLI": {
        "DUPANE": "38.150.088/0001-09",
        "MATRIZ": "20.671.856/0001-04",
    },
    # Petrox: conferido loja a loja com a distribuidora (planilha interna
    # deles). FAROL e FAROLANDIA são a mesma loja física com nomes
    # diferentes no cadastro — mesmo CNPJ nos dois até unificar.
    "PETROX": {
        "AEROPORTO": "05.297.480/0031-33",
        "ARUANA": "05.297.480/0019-47",
        "ATALAIA": "05.297.480/0041-05",
        "BARRA": "05.297.480/0018-66",
        "BR": "05.297.480/0004-60",
        "CAUEIRA": "05.297.480/0012-70",
        "F.PORTO": "05.297.480/0040-24",
        "FAROL": "05.297.480/0006-22",
        "FAROLANDIA": "05.297.480/0006-22",
        "JATOBA": "05.297.480/0020-80",
        "JOAO ALVES": "05.297.480/0033-03",
        "GAZOL": "05.297.480/0023-23",
        "MELICIO": "05.297.480/0021-61",
        "ORLA P.D SOL": "05.297.480/0035-67",
        "ORLA SOL": "05.297.480/0035-67",
        "P.CAJU": "05.297.480/0002-07",
        "PRAIA": "05.297.480/0027-57",
        "RESTAURANTE": "05.297.480/0038-00",
        "SANTA LUCIA": "05.297.480/0036-48",
        "TANCREDO": "05.297.480/0022-42",
        "TREZE": "05.297.480/0009-75",
        "URQUIZA LEAL": "05.297.480/0001-18",
    },
    "PRIMAVERA": {
        "MATRIZ": "13.356.779/0001-24",
    },
    "REDE ALPHA": {
        "ATALAIA": "08.297.710/0001-37",
        "COROA": "08.297.710/0007-22",
        "DETRAN": "08.297.710/0005-60",
        "F.PORTO": "08.297.710/0008-03",
    },
    "SERRANO": {
        "ADELIA FRANCO": "08.309.233/0002-63",
        "AMERICA": "12.431.802/0001-35",
        "SILVIO TEIXEIRA": "01.984.422/0001-01",
    },
    "SOUZA": {
        "MATRIZ": "03.894.230/0001-30",
    },
    # Rede Mais trocou de CNPJ em 01/02/2025 (32.864.795 -> 54.515.737,
    # confirmado por comprovante da própria rede) — os CNPJs abaixo já são
    # os novos.
    "REDE MAIS": {
        "ARUANA": "54.515.737/0003-38",
        "BARRA": "54.515.737/0006-80",
        "CAPUCHO": "54.515.737/0001-76",
        "DISTRITO": "54.515.737/0007-61",
        "ECO POSTO": "54.515.737/0009-23",
        "F.PORTO": "54.515.737/0004-19",
        "FAROLANDIA": "54.515.737/0008-42",
        "MEGA": "54.515.737/0005-08",
        "TANCREDO": "54.515.737/0002-57",
    },
    "SILVA SUPERMERCADO": {
        "MATRIZ": "48.252.281/0001-04",
    },
    "TABAJARA": {
        "JAPAOZINHO": "04.636.474/0001-85",
        "MATRIZ": "04.636.474/0001-85",
        "SOLEDADE": "04.636.474/0002-66",
    },
    "VINICIUS": {
        "ASTRO": "59.567.932/0001-63",
        "CHURRASCARIA PRAIA": "48.284.967/0001-79",
        "MERCADO TRABALHADOR": "64.989.506/0001-58",
        "NORDESTAO": "39.493.946/0001-72",
    },
    # Redes que entraram pelo importar-clientes-omie.py (uma loja por filial,
    # com o nome fantasia) — lá o CNPJ não era gravado.
    "ARTHUR GOIS BORGES": {"ARTHUR GOIS BORGES": "068.713.165-07"},
    "BEIRA MAR MINIMERCADO": {"BEIRA MAR MINIMERCADO": "53.908.947/0001-61"},
    "CLINICA SENHORA SANTANA": {"CLINICA SENHORA SANTANA": "05.881.306/0001-18"},
    "GONZAGA": {
        "GONZAGA EXPRESS": "23.511.178/0003-64",
        "GONZAGA HIPERMERCADO - LUZIA": "23.511.178/0005-26",
        "GONZAGA HIPERMERCADO - PONTO NOVO": "23.511.178/0001-00",
    },
    "JOSE WILSON GOMES JUNIOR": {"JOSE WILSON GOMES JUNIOR": "62.227.387/0001-70"},
    "MEL DISTRIBUIDORA": {"MEL DISTRIBUIDORA": "50.911.223/0001-89"},
    "PANIFICACAO E MERCEARIA COMPRE BEM": {"PANIFICACAO E MERCEARIA COMPRE BEM": "48.183.302/0001-79"},
    "SUPERMERCADO BEIRA RIO": {"SUPERMERCADO BEIRA RIO": "32.870.891/0001-23"},
    "SUPERMERCADO MAIS ECONOMIA": {"SUPERMERCADO MAIS ECONOMIA": "17.047.483/0001-82"},
}

# Filiais que estão no Omie e ainda não tinham loja no app (nenhuma venda
# importada até então). O script cria a loja antes de preencher o cadastro.
# O id segue a mesma regra do importar-planilha.py, então a venda que chegar
# pela planilha com esse nome cai na mesma loja.
LOJAS_NOVAS = {
    ("ATAKAREJO", "GLORIA"), ("ATAKAREJO", "ITABAIANA"),
    ("FASOUTO", "ESTANCIA"),
    ("PANDELLI", "DUPANE"),
    ("PETROX", "CAUEIRA"), ("PETROX", "JATOBA"), ("PETROX", "JOAO ALVES"),
    ("REDE MAIS", "ARUANA"), ("REDE MAIS", "CAPUCHO"),
    ("SERRANO", "AMERICA"),
}

# cnpj_cpf (como está acima) -> codigo_cliente_omie, obtido via ListarClientes
# na API de verdade (mesmo CNPJ, então não tem ambiguidade — cada CNPJ já é
# um cliente cadastrado no Omie).
OMIE_CODIGO_CLIENTE_POR_CNPJ = {
    "73.849.952/0044-98": 3539012148,
    "04.136.442/0003-82": 3501339828,
    "04.136.442/0001-10": 3491423547,
    "35.438.260/0005-51": 3511714972,
    "15.598.527/0013-70": 3491601320,
    "15.598.527/0016-13": 3491540959,
    "50.747.044/0002-39": 3510699017,
    "50.747.044/0001-58": 3491217944,
    "05.540.989/0001-40": 3501984914,
    "02.574.828/0001-89": 3501922980,
    "35.695.317/0003-36": 3492659404,
    "35.695.317/0001-74": 3492645513,
    "35.695.317/0002-55": 3492646367,
    "13.152.186/0002-27": 3493985909,
    "13.152.186/0001-46": 3492823672,
    "20.671.856/0001-04": 3510941111,
    "05.297.480/0031-33": 3500539070,
    "05.297.480/0019-47": 3500536779,
    "05.297.480/0041-05": 3528583250,
    "05.297.480/0018-66": 3500536992,
    "05.297.480/0004-60": 3500539879,
    "05.297.480/0040-24": 3519891254,
    "05.297.480/0006-22": 3500538528,
    "05.297.480/0023-23": 3500542412,
    "05.297.480/0021-61": 3500542954,
    "05.297.480/0035-67": 3500543573,
    "05.297.480/0002-07": 3500537650,
    "05.297.480/0027-57": 3500538291,
    "05.297.480/0038-00": 3539190913,
    "05.297.480/0036-48": 3500539441,
    "05.297.480/0022-42": 3500540621,
    "05.297.480/0009-75": 3500538764,
    "05.297.480/0001-18": 3500542134,
    "13.356.779/0001-24": 3536160807,
    "08.297.710/0007-22": 3501576484,
    "54.515.737/0006-80": 3499071674,
    "54.515.737/0007-61": 3499071795,
    "54.515.737/0009-23": 3499071885,
    "54.515.737/0004-19": 3499071455,
    "54.515.737/0008-42": 3498172455,
    "54.515.737/0005-08": 3499071526,
    "54.515.737/0002-57": 3499071412,
    "48.252.281/0001-04": 3498831774,
    "04.636.474/0001-85": 3488923526,
    "04.636.474/0002-66": 3490288993,
    "59.567.932/0001-63": 3520865669,
    "64.989.506/0001-58": 3520865542,
    "39.493.946/0001-72": 3520865232,
}


def uuid_de(*partes):
    # Mesma regra de scripts/importar-planilha.py.
    h = hashlib.sha1("|".join(str(p) for p in partes).encode()).hexdigest()
    return f"{h[:8]}-{h[8:12]}-4{h[13:16]}-8{h[17:20]}-{h[20:32]}"


def sql_txt(v):
    return "null" if not v else "'" + str(v).replace("'", "''") + "'"


def so_digitos(v):
    return re.sub(r"\D", "", v or "")


def limpar(v):
    return (v or "").strip() or None


def separar_endereco(endereco):
    """"AVENIDA ADELIA FRANCO, 2350 - LOJA A" -> (logradouro, numero)."""
    endereco = (endereco or "").strip()
    if "," not in endereco:
        return endereco or None, None
    logradouro, resto = endereco.split(",", 1)
    return logradouro.strip() or None, resto.strip() or None


def cidade_sem_uf(cidade):
    """"Aracaju (SE)" -> "Aracaju"."""
    return re.sub(r"\s*\([A-Z]{2}\)\s*$", "", (cidade or "").strip()) or None


def ler_por_cnpj(caminho):
    with open(caminho, encoding="utf-8-sig", newline="") as f:
        linhas = list(csv.reader(f, delimiter=";", quotechar='"'))

    por_cnpj = {}
    for linha in linhas[1:]:
        if not any(c.strip() for c in linha):
            continue
        cnpj_cpf = linha[2]
        cidade, estado, endereco, bairro, cep = linha[8], linha[9], linha[10], linha[11], linha[12]
        ie = linha[16]
        digitos = so_digitos(cnpj_cpf)
        if not digitos:
            continue
        logradouro, numero = separar_endereco(endereco)
        por_cnpj[digitos] = dict(
            cnpj_cpf=limpar(cnpj_cpf), ie=limpar(ie), logradouro=logradouro,
            numero=numero, bairro=limpar(bairro), cep=limpar(cep), uf=limpar(estado),
            cidade=cidade_sem_uf(cidade),
        )
    return por_cnpj


def main():
    if len(sys.argv) < 2:
        sys.exit("uso: python3 scripts/gerar-cadastro-fiscal-lojas.py <arquivo.csv>")
    origem = Path(sys.argv[1])
    por_cnpj = ler_por_cnpj(origem)

    L = []
    p = L.append
    p("-- ============================================================================")
    p("--  CNPJ/IE/endereço/cidade/omie_codigo_cliente das lojas — gerado por")
    p("--  scripts/gerar-cadastro-fiscal-lojas.py")
    p("--  NÃO edite direto no banco: corrija o dicionário MAPEAMENTO no script (a")
    p("--  correspondência loja -> CNPJ foi conferida à mão com a Carvalho Cruz, não dá")
    p("--  pra reconstruir só a partir do CSV) e rode de novo.")
    p("--")
    p(f"--  Origem do CNPJ/IE/endereço: {origem.name} (export Omie). O")
    p("--  omie_codigo_cliente veio da API (ListarClientes) — mesmo CNPJ, sem ambiguidade.")
    p("--")
    p("--  Rode DEPOIS de migracao-08-nfe.sql e migracao-09-omie-ids.sql (criam as")
    p("--  colunas cnpj_cpf/ie/logradouro/numero/bairro/cep/uf/omie_codigo_cliente).")
    p("--")
    p("--  Idempotente: usa coalesce, então rodar de novo nunca sobrescreve um campo")
    p("--  que já tiver sido preenchido (à mão ou por uma rodada anterior corrigida).")
    p("-- ============================================================================")
    p("")
    p("begin;")
    p("")

    p("-- ─── Lojas novas (filiais do Omie ainda sem loja no app) ────────────────────")
    for rede, loja in sorted(LOJAS_NOVAS):
        p("insert into public.lojas (id, rede_id, nome)")
        p(f"  select {sql_txt(uuid_de('loja', rede, loja))}, r.id, {sql_txt(loja)}")
        p(f"  from public.redes r where lower(r.nome) = lower({sql_txt(rede)})")
        p("  on conflict (rede_id, lower(nome)) do nothing;")
    p("")

    faltando = []
    total = 0
    for rede in sorted(MAPEAMENTO):
        p(f"-- ─── {rede} ──────────────────────────────────────────────────────────────")
        for loja in sorted(MAPEAMENTO[rede]):
            cnpj = MAPEAMENTO[rede][loja]
            dados = por_cnpj.get(so_digitos(cnpj))
            if not dados:
                faltando.append((rede, loja, cnpj))
                continue
            total += 1
            codigo_cliente = OMIE_CODIGO_CLIENTE_POR_CNPJ.get(cnpj)
            p("update public.lojas set")
            p(f"    cnpj_cpf            = coalesce(cnpj_cpf, {sql_txt(dados['cnpj_cpf'])}),")
            p(f"    ie                  = coalesce(ie, {sql_txt(dados['ie'])}),")
            p(f"    logradouro          = coalesce(logradouro, {sql_txt(dados['logradouro'])}),")
            p(f"    numero              = coalesce(numero, {sql_txt(dados['numero'])}),")
            p(f"    bairro              = coalesce(bairro, {sql_txt(dados['bairro'])}),")
            p(f"    cep                 = coalesce(cep, {sql_txt(dados['cep'])}),")
            p(f"    uf                  = coalesce(uf, {sql_txt(dados['uf'])}),")
            p(f"    cidade              = coalesce(cidade, {sql_txt(dados['cidade'])}),")
            p(f"    omie_codigo_cliente = coalesce(omie_codigo_cliente, {codigo_cliente or 'null'})")
            p("  where rede_id = (select id from public.redes where lower(nome) = lower("
              f"{sql_txt(rede)}))")
            p(f"    and lower(nome) = lower({sql_txt(loja)});")
        p("")

    p("commit;")
    p("")
    p("-- Confira:  select r.nome as rede, l.nome as loja, l.cnpj_cpf, l.ie, l.bairro")
    p("--           from public.lojas l join public.redes r on r.id = l.rede_id")
    p("--           where l.cnpj_cpf is not null order by r.nome, l.nome;")

    destino = Path("supabase/importacao-fiscal-lojas.sql")
    destino.write_text("\n".join(L))

    print(f"{destino} gerado\n")
    print(f"  lojas atualizadas   {total:>8}")
    if faltando:
        print(f"  CNPJ não achado no CSV para (confira o MAPEAMENTO ou o arquivo de origem):")
        for rede, loja, cnpj in faltando:
            print(f"    {rede} / {loja}: {cnpj}")


if __name__ == "__main__":
    main()

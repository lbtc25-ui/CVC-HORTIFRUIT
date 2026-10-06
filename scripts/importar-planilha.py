#!/usr/bin/env python3
"""
Importa a planilha de gestão (.xlsx) para SQL do Supabase.

    python3 scripts/importar-planilha.py "DISTRIBUIDORA CARVALHO CRUZ.xlsx"

Gera supabase/importacao-planilha.sql com vendas e despesas. Roda de novo
quando a planilha for exportada outra vez: os ids são derivados do conteúdo,
então reimportar atualiza em vez de duplicar.

Precisa de openpyxl:  pip3 install openpyxl
"""
import hashlib
import sys
from decimal import ROUND_HALF_UP, Decimal
import unicodedata
from collections import defaultdict
from pathlib import Path

import openpyxl

# ─── Ids estáveis ───────────────────────────────────────────────────────────
# Derivados do conteúdo: a mesma linha da planilha gera sempre o mesmo uuid,
# então reimportar a planilha atualiza a linha em vez de criar outra.

def uuid_de(*partes):
    h = hashlib.sha1("|".join(str(p) for p in partes).encode()).hexdigest()
    return f"{h[:8]}-{h[8:12]}-4{h[13:16]}-8{h[17:20]}-{h[20:32]}"


def centavos(v):
    """Duas casas, meio para cima. O round() do Python arredonda 1,095 para
    1,09 (metade para o par), e a planilha soma 1,10 — um centavo de
    diferença no total das despesas."""
    return float(Decimal(str(v)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def limpar(v):
    return "" if v is None else str(v).strip()


def sem_acento(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


# ─── Produtos ───────────────────────────────────────────────────────────────
# Os ids batem com src/lib/seed.js.

PRODUTO = {
    ("LARANJA", 1.0):      "d1000000-0000-4000-8000-000000000001",
    ("SACO", 2.5):         "d1000000-0000-4000-8000-000000000002",
    ("SACO", 3.0):         "d1000000-0000-4000-8000-000000000003",
    ("SACO", 5.0):         "d1000000-0000-4000-8000-000000000004",
    ("SACO", 10.0):        "d1000000-0000-4000-8000-000000000005",
    ("LARANJA LIMA", 1.0): "d1000000-0000-4000-8000-000000000006",
    ("ABOBORA", 1.0):      "d1000000-0000-4000-8000-000000000007",
}

# Erros de digitação da planilha que não mudam nenhum número.
CORRECOES = {"LRANJA": "LARANJA"}

# Despesa que já foi importada e depois mudou de categoria na planilha. O id
# leva a categoria, então sem isto a mesma despesa entraria de novo com
# outro id. (data, descrição, valor) -> id da primeira importação.
ID_JA_IMPORTADO = {
    # Outros -> Investimentos em 09/2026
    ("2026-08-20", "FINANCIMAMENTO", 14000.00): "cd78bccf-d1e1-437e-8281-d5546cefe807",
}


def achar_produto(nome, bags, avisos, onde):
    nome = CORRECOES.get(nome, nome)
    chave = (nome, float(bags or 1))
    if chave in PRODUTO:
        return PRODUTO[chave]
    # "LARANJA" vendida em bag de 2,5 kg é saco, não agranel — o peso confirma.
    if nome == "LARANJA" and float(bags or 1) != 1.0:
        alt = ("SACO", float(bags))
        if alt in PRODUTO:
            avisos.append(f"{onde}: '{nome}' com bag de {bags} kg lido como SACO {bags} kg")
            return PRODUTO[alt]
    avisos.append(f"{onde}: produto desconhecido '{nome}' com bag {bags} — LINHA IGNORADA")
    return None


def num(v):
    """Número para SQL sem perder casas. `%g` corta em 6 dígitos
    significativos e transformava 329430.9 em 329431 — quase um quilo
    evaporando num total de trezentas toneladas."""
    s = f"{float(v):.6f}".rstrip("0").rstrip(".")
    return s or "0"


def sql_txt(v):
    return "null" if v in (None, "") else "'" + str(v).replace("'", "''") + "'"


def ler_vendas(ws, ano, mes, redes, lojas, avisos, prefixo):
    """Uma linha da planilha é um item. Itens do mesmo dia/loja/prazo formam
    um pedido só — é assim que o pedido existe na rua."""
    pedidos = defaultdict(list)
    for r in range(1, ws.max_row + 1):
        rede = limpar(ws.cell(r, 3).value).upper()
        qtd = ws.cell(r, 8).value
        if not rede or rede == "REDE" or qtd in (None, 0):
            continue
        loja = limpar(ws.cell(r, 4).value).upper() or "MATRIZ"
        produto = limpar(ws.cell(r, 5).value).upper()
        unidade = limpar(ws.cell(r, 6).value).upper()
        bags = ws.cell(r, 7).value or 1
        kg = ws.cell(r, 9).value or 0
        vu = ws.cell(r, 10).value or 0
        total = ws.cell(r, 11).value or 0
        prazo = int(ws.cell(r, 12).value or 0)
        dia = ws.cell(r, 2).value

        pid = achar_produto(produto, bags, avisos, f"{prefixo} linha {r}")
        if not pid:
            continue

        # Na planilha a bonificação era escrita na coluna UNIDADE, com preço
        # zero — duas informações na mesma célula. Aqui vira campo próprio.
        bonificado = "BONIF" in unidade

        # O total vem da conta, não da célula. O DRE calcula a receita como
        # quantidade x preço; se o `total` gravado viesse da planilha, uma
        # célula digitada errada faria o mesmo pedido valer um número na lista
        # de Vendas e outro no DRE. Aconteceu: 100 kg de abóbora a R$ 1,50
        # estavam como R$ 10,00 em vez de R$ 150,00.
        calculado = centavos(float(qtd) * float(vu))
        if abs(calculado - float(total)) > 0.01 and not bonificado:
            avisos.append(
                f"{prefixo} linha {r}: {rede}/{loja} {produto} — "
                f"{qtd} x {vu} = {calculado:.2f}, e a planilha registrou "
                f"{float(total):.2f}. Importado como {calculado:.2f}."
            )

        dia_num = int(dia) if isinstance(dia, (int, float)) else None
        data = f"{ano}-{mes:02d}-{dia_num:02d}" if dia_num else f"{ano}-{mes:02d}-28"

        redes.add(rede)
        lojas.add((rede, loja))
        pedidos[(data, rede, loja, prazo)].append(
            dict(produto_id=pid, qty=float(qtd), preco=float(vu),
                 bags=float(bags or 1), kg=float(kg), bonificado=bonificado,
                 total=calculado)
        )
    return pedidos


def ler_despesas(ws, avisos):
    """Cada categoria tem seu bloco DATA | DESCRICAO | VALOR."""
    CATEGORIA = {
        "COMBUSTIVEIS": "Combustíveis", "DIARISTAS": "Diaristas",
        "FUNCIONARIOS FIXOS": "Funcionários", "FUNCIONARIOS": "Funcionários",
        "FRETES": "Fretes", "MANUTENCAO": "Manutenção",
        "INVESTIMENTOS": "Investimentos", "OUTROS": "Outros", "IMPOSTOS": "Impostos",
    }
    saida = []
    for r0 in (4, 5):
        for c0 in range(1, ws.max_column + 1):
            if limpar(ws.cell(r0, c0).value).upper() != "DATA":
                continue
            nome = None
            for rr in range(1, r0):
                for cc in (c0, c0 + 1):
                    v = limpar(ws.cell(rr, cc).value).upper()
                    if v and "TOTAL" not in v:
                        nome = v
            categoria = CATEGORIA.get(sem_acento(nome or "").upper())
            if not categoria:
                continue

            # Combustíveis é o diário de abastecimento: data, motorista,
            # veículo, litros, R$/L e valor — o valor fica na 10ª coluna.
            combustivel = categoria == "Combustíveis"
            for r in range(r0 + 1, ws.max_row + 1):
                data = ws.cell(r, c0).value
                if combustivel:
                    litros = ws.cell(r, c0 + 7).value
                    preco_l = ws.cell(r, c0 + 8).value
                    valor = ws.cell(r, c0 + 9).value
                    desc = f"{limpar(ws.cell(r, c0+6).value) or 'Combustível'}"
                    if litros and preco_l:
                        desc += f" — {num(litros)} L a R$ {preco_l:.2f}"
                        motorista = limpar(ws.cell(r, c0 + 1).value)
                        if motorista:
                            desc += f" · {motorista}"
                else:
                    desc = limpar(ws.cell(r, c0 + 1).value)
                    valor = ws.cell(r, c0 + 2).value
                if not isinstance(valor, (int, float)) or not valor:
                    continue
                if hasattr(data, "strftime"):
                    data = data.strftime("%Y-%m-%d")
                else:
                    avisos.append(f"DESPESAS {categoria} linha {r}: sem data — ignorada")
                    continue
                saida.append(dict(data=data, categoria=categoria,
                                  descricao=desc or categoria, valor=centavos(valor)))
    return saida


def main():
    origem = Path(sys.argv[1] if len(sys.argv) > 1 else "DISTRIBUIDORA CARVALHO CRUZ.xlsx")
    wb = openpyxl.load_workbook(origem, data_only=True)
    abas = {n.strip().upper(): n for n in wb.sheetnames}

    avisos, redes, lojas = [], set(), set()
    pedidos = {}

    # Junho a agosto vieram agregados na planilha, sem rede nem loja: uma
    # linha por produto, tudo como DIVERSOS. Entram como estão — inventar
    # clientes seria pior do que admitir que a informação não existe.
    if "DADOS ANTIGOS" in abas:
        pedidos.update(ler_vendas(wb[abas["DADOS ANTIGOS"]], 2026, 8, redes, lojas,
                                  avisos, "DADOS ANTIGOS"))

    for nome, mes in [("SETEMBRO", 9), ("OUTUBRO", 10), ("NOVEMBRO", 11), ("DEZEMBRO", 12)]:
        if nome in abas:
            pedidos.update(ler_vendas(wb[abas[nome]], 2026, mes, redes, lojas, avisos, nome))

    despesas = ler_despesas(wb[abas["DESPESAS"]], avisos) if "DESPESAS" in abas else []

    # ─── SQL ────────────────────────────────────────────────────────────────
    L = []
    p = L.append
    p("-- ============================================================================")
    p("--  Importação da planilha de gestão — gerado por scripts/importar-planilha.py")
    p("--  NÃO edite à mão: exporte a planilha de novo e rode o script.")
    p("--")
    p(f"--  Origem: {origem.name}")
    p("--")
    p("--  Rode DEPOIS de schema.sql, das migrações 01 a 04 e do seed.sql.")
    p("--  Os ids vêm do conteúdo de cada linha, então reimportar ATUALIZA em vez")
    p("--  de duplicar.")
    p("-- ============================================================================")
    p("")
    p("begin;")
    p("")

    p("-- ─── Redes e lojas que apareceram nas vendas ────────────────────────────────")
    p("-- ON CONFLICT pelo nome: as que já vieram do seed.sql não são tocadas.")
    p("")
    for rede in sorted(redes):
        p(f"insert into public.redes (id, nome) values ({sql_txt(uuid_de('rede', rede))}, {sql_txt(rede)})")
        p("  on conflict (lower(nome)) do nothing;")
    p("")
    for rede, loja in sorted(lojas):
        p(f"insert into public.lojas (id, rede_id, nome)")
        p(f"  select {sql_txt(uuid_de('loja', rede, loja))}, r.id, {sql_txt(loja)}")
        p(f"  from public.redes r where lower(r.nome) = lower({sql_txt(rede)})")
        p("  on conflict (rede_id, lower(nome)) do nothing;")
    p("")

    p("-- ─── Vendas ─────────────────────────────────────────────────────────────────")
    p("--")
    p("--  STATUS: a planilha nunca registrou pagamento. O que vence até hoje")
    p("--  entra como 'pago' e o que ainda está no prazo como")
    p("--  'pendente' — é a leitura mais provável, não um dado da planilha.")
    p("--  Para tratar tudo como pendente e conferir uma a uma no app:")
    p("--    update public.vendas set status = 'pendente' where numero >= 1000;")
    p("")
    # Pedido novo pega o próximo número livre; o que já existe mantém o seu
    # (o ON CONFLICT não mexe em `numero`). Um contador fixo daria a um pedido
    # novo o número de outro já importado assim que a planilha crescesse.
    for (data, rede, loja, prazo), itens in sorted(pedidos.items()):
        vid = uuid_de("venda", data, rede, loja, prazo)
        total = sum(0 if i["bonificado"] else i["total"] for i in itens)
        kg_total = sum(i["kg"] for i in itens)
        json_itens = ", ".join(
            "jsonb_build_object("
            f"'produtoId', {sql_txt(i['produto_id'])}, "
            f"'qty', {num(i['qty'])}, "
            f"'precoUnitario', {num(0 if i['bonificado'] else i['preco'])}, "
            f"'kgPorUnidade', {num(i['bags'])}, "
            f"'kgTotal', {num(i['kg'])}, "
            f"'natureza', {sql_txt('bonificacao' if i['bonificado'] else 'venda')})"
            for i in itens
        )
        p(f"insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)")
        p(f"  select {sql_txt(vid)}, (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, {sql_txt(data)}, {prazo},")
        p(f"         jsonb_build_array({json_itens}),")
        p(f"         {total:.2f}, {num(kg_total)},")
        p(f"         case when current_date >= (date {sql_txt(data)} + {prazo}) then 'pago' else 'pendente' end")
        p(f"  from public.lojas l join public.redes r on r.id = l.rede_id")
        p(f"  where lower(r.nome) = lower({sql_txt(rede)}) and lower(l.nome) = lower({sql_txt(loja)})")
        p("  on conflict (id) do update set")
        p("    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;")
    p("")

    p("-- ─── Despesas ───────────────────────────────────────────────────────────────")
    p("-- Apaga os consolidados que vieram do PDF e põe o detalhe da planilha.")
    p("")
    p("delete from public.despesas where descricao like 'Consolidado de %planilha';")
    p("")
    for d in despesas:
        did = ID_JA_IMPORTADO.get((d["data"], d["descricao"], d["valor"])) or \
            uuid_de("despesa", d["data"], d["categoria"], d["descricao"], d["valor"])
        p(f"insert into public.despesas (id, data, categoria, descricao, valor) values")
        p(f"  ({sql_txt(did)}, {sql_txt(d['data'])}, {sql_txt(d['categoria'])}, {sql_txt(d['descricao'])}, {d['valor']:.2f})")
        p("  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,")
        p("    categoria = excluded.categoria;")
    p("")
    p("commit;")
    p("")
    p("-- Confira:  select * from public.vw_dre_mes;")

    destino = Path("supabase/importacao-planilha.sql")
    destino.write_text("\n".join(L))

    # ─── Relatório ──────────────────────────────────────────────────────────
    itens_total = sum(len(i) for i in pedidos.values())
    kg = sum(i["kg"] for itens in pedidos.values() for i in itens)
    receita = sum(i["total"] for itens in pedidos.values() for i in itens if not i["bonificado"])
    bonif_kg = sum(i["kg"] for itens in pedidos.values() for i in itens if i["bonificado"])

    print(f"{destino} gerado\n")
    print(f"  pedidos      {len(pedidos):>8}")
    print(f"  itens        {itens_total:>8}")
    print(f"  redes        {len(redes):>8}")
    print(f"  lojas        {len(lojas):>8}")
    print(f"  quilos       {kg:>12,.2f}")
    print(f"  bonificado   {bonif_kg:>12,.2f} kg")
    print(f"  receita      {receita:>12,.2f}")
    print(f"  despesas     {sum(d['valor'] for d in despesas):>12,.2f}  ({len(despesas)} lançamentos)")
    if avisos:
        print(f"\n  ⚠️  {len(avisos)} aviso(s):")
        for a in avisos:
            print(f"     {a}")


if __name__ == "__main__":
    main()

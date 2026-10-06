#!/usr/bin/env python3
"""
Cruza a planilha "CVC - COMPRA E VENDA.xlsx" com os grupos de WhatsApp
(PAGAMENTOS MERCADORIAS CVC e FINANCEIRO CVC) e gera o SQL de carga do
sistema da CVC.

    python3 scripts/importar-cvc-planilha-whatsapp.py "CVC - COMPRA E VENDA.xlsx"

Gera  supabase/importacao-cvc-2026-10-05.sql

Fonte de cada linha:
  Planilha            — lida da planilha (abas de fruta + DESPESAS)
  Planilha+WhatsApp   — está na planilha e tem comprovante no grupo
  WhatsApp            — só existe no grupo (comprovante/legenda com quilos)

Tudo que o grupo mostra mas NÃO dá para lançar com segurança (caixa sem peso,
pagamento sem fruta, valores que não batem) fica em docs/cruzamento-cvc-*.md.

Os ids vêm do conteúdo; rodar de novo atualiza em vez de duplicar.
Precisa de openpyxl:  pip3 install openpyxl
"""
import datetime as dt
import hashlib
import re
import sys
from collections import defaultdict
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

import openpyxl

ANO = 2026
PESO_MELANCIA = 6.0  # kg por unidade — mesmo valor da migração 66

# aba da planilha -> (nome do produto no sistema, fruta)
ABAS = {
    "PERA PORTUGUESA": ("Pera Portuguesa", "Pera Portuguesa"),
    "COCO SECO": ("Coco Seco", "Coco Seco"),
    "MANGA": ("Manga Tommy Atkins", "Manga Tommy Atkins"),
    "W.MURCOTT": ("Tangerina Murcote", "Tangerina Murcote"),
    "MELANCIA": ("Melancia", "Melancia"),
    "LIMÃO SICILIANO": ("Limão Siciliano", "Limão Siciliano"),
    "PINHA": ("Pinha", "Pinha"),
    "LIMAO": ("Limão", "Limão"),
    "TAN- OLE": ("Tangerina Olé", "Tangerina Olé"),
    "TAN-POKAN": ("Tangerina Ponkan", "Tangerina Ponkan"),
    "MARACUJA": ("Maracujá", "Maracujá"),
    "AMEIXA": ("Ameixa Fresca Importada", "Ameixa Fresca Importada"),
    "ABACATE": ("Abacate", "Abacate"),
    "GOIABA": ("Goiaba", "Goiaba"),
    "MELAO": ("Melão Orange", "Melão Orange"),
    "KIWI": ("Kiwi Importado", "Kiwi Importado"),
    "LARANJA NAVELINA": ("Laranja Navelina", "Laranja Navelina"),
    "MANGA ESPADA": ("Manga Espada", "Manga Espada"),
    "PERA DANJOU": ("Pera D'Anjou", "Pera D'Anjou"),
    "MAMÃO HAWAII": ("Mamão Havaí", "Mamão Havaí"),
}
NOVOS_PRODUTOS = ["Tangerina Olé", "Mamão Formosa"]

CLIENTE = {  # grafias da aba CADASTROS
    "ATAJAREJO": "ATAKAREJO", "BOM BOM": "BOMBOM", "PERCA": "PERDA",
}
FORNECEDOR = {"FAZ PAPAGAIO": "FAZ. PAPAGAIO"}

# ─── Compras que só existem no WhatsApp (quilos explícitos na legenda) ──────
# (data, fornecedor, fruta, kg, total, observação)
COMPRAS_WA = [
    # Mamão Havaí — Mascarenhas (via grupo; 21/09 pago ao Xande, que adiantou)
    ("2026-09-21", "MASCARENHAS (AVF)", "Mamão Havaí", 5605, 11210.00, "5.605 kg a R$ 2,00 — pago ao Xande"),
    ("2026-09-30", "MASCARENHAS", "Mamão Havaí", 5835, 10785.50, "5.835 kg — Wellington dos Santos Costa"),
    ("2026-10-05", "MASCARENHAS", "Mamão Havaí", 6160, 12320.00, "6.160 kg a R$ 2,00 — Fábio Pereira da Silva"),
    # Mamão Havaí — AVF repassa a R$ 3,00/kg (Atakarejo)
    ("2026-09-26", "AVF", "Mamão Havaí", 216, 648.00, "216 kg a R$ 3,00"),
    ("2026-09-29", "AVF", "Mamão Havaí", 420, 1260.00, "420 kg a R$ 3,00 (legenda diz 29/10; é 29/09)"),
    ("2026-10-01", "AVF", "Mamão Havaí", 468, 1404.00, "468 kg a R$ 3,00"),
    ("2026-10-03", "AVF", "Mamão Havaí", 504, 1512.00, "504 kg a R$ 3,00"),
    ("2026-10-03", "JOSÉ VALDO", "Mamão Formosa", 180, 324.00, "180 kg mamão formosa 2ª a R$ 1,80"),
    # Coco seco — unidades (a planilha também lança em "kg" a unidade)
    ("2026-09-03", "JOSÉ DAVID", "Coco Seco", 90, 207.00, "90 cocos a R$ 2,30"),
    ("2026-09-12", "JOSÉ DAVID", "Coco Seco", 60, 138.00, "60 cocos secos a R$ 2,30"),
    ("2026-09-26", "JOSÉ DAVID", "Coco Seco", 30, 69.00, "30 cocos a R$ 2,30"),
    # Goiaba — caixa de 25 kg (13 cx = 325 kg a R$ 2,00 na planilha)
    ("2026-09-03", "SUELY", "Goiaba", 250, 900.00, "10 cx entregues em 03/09"),
    ("2026-09-05", "SUELY", "Goiaba", 75, 270.00, "3 cx entregues em 05/09"),
    ("2026-09-19", "SUELY", "Goiaba", 350, 1235.00, "14 cx"),
    ("2026-10-03", "KLEBER", "Goiaba", 900, 3350.00, "36 cx"),
]
# melancia: (data, fornecedor, unidades, total, obs)
MELANCIA_WA = [
    ("2026-09-08", "MARCOS ANTONIO", 800, 5675.00, "entrega Atakarejo 08/09"),
    ("2026-09-16", "GILBERTO SOBRAL", 271, 729.86, "271 melancias"),
    ("2026-09-16", "MARCOS ANTONIO", 1107, 7800.00, "1.107 melancias"),
    ("2026-09-19", "GILSON", 300, 2100.00, "300 melancias"),
    ("2026-09-26", "MARCOS ANTONIO", 1750, 12250.00, "1.750 melancias"),
    ("2026-10-03", "MARCOS ANTONIO", 750, 4100.00, "750 melancias"),
    # JPJS: melancia grande a R$ 15,00 a unidade (NF 17352 e NF 17519)
    ("2026-09-10", "JPJS", 100, 1500.00, "NF 17352 — melancia grande a R$ 15,00"),
    ("2026-09-12", "JPJS", 420, 6300.00, "NF 17519 — melancia grande a R$ 15,00"),
]

# Goiaba da Suely 29/08: a planilha tem 250 kg sem valor. O comprovante de
# 05/09 (R$ 800, "10 cxs dia 01/09 Atakarejo") é a mesma remessa.
PREENCHER_VALOR = {("GOIABA", "SUELY", 250.0): 3.20}

# ─── Vendas só do WhatsApp ──────────────────────────────────────────────────
# (data, vendedor, cliente, produto, kg, preço/kg)
VENDAS_WA = [
    ("2026-08-21", "CC", "DIVERSOS", "Pera D'Anjou", 36, 13.00),  # 36 kg a 13,00 = 468 (Carlinhos, 21/08)
]

# ─── Despesas só do WhatsApp (comprovante) ──────────────────────────────────
# (data, categoria, descrição, valor)
DESPESAS_WA = [
    ("2026-08-19", "Combustíveis", "Frete — Posto Caio Bá II", 362.29),
    ("2026-08-22", "Combustíveis", "Combustível: buscar maracujá em Lagarto → Aracaju", 130.00),
    ("2026-09-01", "Outros", "Abertura da firma CVC (Lázaro Carvalho Assessoria)", 780.00),
    ("2026-09-09", "Fretes", "Frete melancia (Josilene)", 1250.00),
    ("2026-09-11", "Outros", "Descarga (Armazém Mateus)", 1150.00),
    ("2026-09-11", "Fretes", "Frete: buscar tangerina W. Murcott em Neópolis", 350.00),
    ("2026-09-12", "Outros", "Redinha mamão Havaí — 10 sacos (Embalavale)", 4800.00),
    ("2026-09-12", "Fretes", "Frete redinhas", 140.00),
    ("2026-09-14", "Impostos", "ICMS mês 08 (SEFAZ-SE)", 2788.92),
    ("2026-09-14", "Outros", "Almoço (Churrascaria Netto e Prestes)", 61.00),
    ("2026-09-14", "Outros", "Jantar (iFood)", 112.27),
    ("2026-09-14", "Outros", "Encarregado mamão — bonificação", 200.00),
    ("2026-09-17", "Diaristas", "Descarrego limão (Márcio)", 450.00),
    ("2026-09-19", "Outros", "Redinha mamão Havaí — 10 sacos (Embalavale)", 4800.00),
    ("2026-09-19", "Fretes", "Frete redinha mamão", 140.00),
    ("2026-09-19", "Diaristas", "4 diaristas arrumando mamão em Neópolis", 400.00),
    ("2026-09-19", "Combustíveis", "Combustível Lagarto → Neópolis (carregamento)", 220.12),
    ("2026-09-19", "Diaristas", "2 diaristas carregando mamão", 400.00),
    ("2026-09-26", "Diaristas", "Ajudantes para o Atakarejo (Márcio)", 200.00),
    ("2026-09-29", "Combustíveis", "Combustível", 150.00),
    ("2026-09-30", "Diaristas", "2 diaristas e horas extras do Guilherme carregando mamão", 360.00),
    ("2026-09-30", "Outros", "Balancão R$ 40 + janta R$ 30 (Guilherme)", 70.00),
    ("2026-10-03", "Combustíveis", "Combustível mamão Neópolis (Guilherme)", 166.01),
    ("2026-10-03", "Diaristas", "2 diárias, 2 cafés da manhã e 2 almoços", 500.00),
    ("2026-10-05", "Outros", "Redinha mamão Havaí — 10 sacos (Embalavale)", 4800.00),
    ("2026-10-05", "Fretes", "Frete redinhas", 140.00),
    ("2026-10-05", "Outros", "Jantar dos carregadores", 148.00),
]


def uuid_de(*partes):
    h = hashlib.sha1("|".join(str(p) for p in partes).encode()).hexdigest()
    return f"{h[:8]}-{h[8:12]}-4{h[13:16]}-8{h[17:20]}-{h[20:32]}"


def c2(v):
    return float(Decimal(str(v)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def num(v):
    return (f"{float(v):.6f}".rstrip("0").rstrip(".")) or "0"


def q(v):
    return "null" if v in (None, "") else "'" + str(v).replace("'", "''") + "'"


def data_de(v, padrao=None):
    """A planilha mistura datetime, 'dd/mm' e 'dd/mm/aaaa'."""
    if isinstance(v, dt.datetime):
        return v.date().isoformat()
    if isinstance(v, str):
        m = re.match(r"^\s*(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\s*$", v)
        if m:
            d, mes, a = int(m[1]), int(m[2]), m[3]
            a = int(a) if a else ANO
            a = a + 2000 if a < 100 else a
            return dt.date(a, mes, d).isoformat()
    return padrao


def as_num(v):
    """A planilha guarda alguns números como texto ('649')."""
    if isinstance(v, str):
        try:
            return float(v.strip().replace(",", "."))
        except ValueError:
            return v
    return v


def nome(v, tabela=None):
    s = re.sub(r"\s+", " ", str(v or "").strip()).upper()
    return (tabela or {}).get(s, s)


def ler_planilha(caminho):
    wb = openpyxl.load_workbook(caminho, data_only=True)
    vendas, compras, despesas, perdas, avisos = [], [], [], [], []
    for aba, (prod, fruta) in ABAS.items():
        nome_aba = next((n for n in wb.sheetnames if n.strip().upper() == aba.strip().upper()), None)
        if not nome_aba:
            continue
        ws = wb[nome_aba]
        for r in range(4, ws.max_row + 1):
            g = lambda c: ws.cell(r, c).value
            qtd, preco, total = (as_num(g(5)), as_num(g(6)), as_num(g(9)))
            cli = nome(g(4), CLIENTE)
            if isinstance(qtd, (int, float)) and qtd and cli:
                status = str(g(1) or "").strip().upper()
                d = data_de(g(3))
                if not d:
                    d = f"{ANO}-08-28"
                    avisos.append(f"{aba} linha {r}: venda de {cli} sem data na planilha — lançada em 28/08")
                if cli == "PERDA" or not preco:
                    perdas.append(dict(data=d, fruta=fruta, kg=float(qtd),
                                       motivo=("Perda" if cli == "PERDA" else f"Saída sem valor ({cli})"),
                                       aba=aba))
                else:
                    vendas.append(dict(aba=aba, produto=prod, fruta=fruta, data=d,
                                       vendedor=nome(g(2)) or "—", cliente=cli,
                                       qtd=float(qtd), total=c2(total or qtd * preco),
                                       pago=status == "PAGO", loja=nome(g(10)) or "MATRIZ",
                                       fonte="Planilha"))
            # compra
            kg, pc, tc = as_num(g(13)), as_num(g(14)), as_num(g(15))
            if isinstance(kg, (int, float)) and kg:
                forn = nome(g(12), FORNECEDOR)
                d = data_de(g(11)) or f"{ANO}-08-28"
                valor = pc if isinstance(pc, (int, float)) and pc else None
                chave = (aba.upper().replace("LIMAO", "LIMAO"), forn.split()[0] if forn else "", float(kg))
                if valor is None and chave in PREENCHER_VALOR:
                    valor = PREENCHER_VALOR[chave]
                    avisos.append(f"{aba}: compra de {forn} {kg:g} kg sem valor — preenchido R$ {valor:.2f}/kg pelo comprovante")
                if valor is None:
                    avisos.append(f"{aba}: compra de {forn} {kg:g} kg sem valor — IGNORADA")
                    continue
                compras.append(dict(data=d, fornecedor=forn or "NÃO INFORMADO", fruta=fruta,
                                    kg=float(kg), valor_kg=float(valor), total=c2(tc) if tc else c2(kg * valor),
                                    obs="Planilha", fonte="Planilha"))
            # despesa da fruta
            v = g(19)
            if isinstance(v, (int, float)) and v:
                desc = str(g(18) or "").strip().upper()
                d = data_de(g(17))
                if not d:  # a aba MAMÃO tem 'IFCO' na coluna de data
                    d = data_de(g(17), None) or f"{ANO}-09-22"
                cat = "Fretes" if desc.startswith("FRETE") else "Outros"
                despesas.append(dict(data=d, categoria=cat,
                                     descricao=f"{desc or 'Despesa'} — {fruta}", valor=c2(v),
                                     fonte="Planilha"))
    # DESPESAS gerais
    ws = wb["DESPESAS"]
    for r in range(4, ws.max_row + 1):
        d, desc, v = data_de(ws.cell(r, 3).value), ws.cell(r, 4).value, ws.cell(r, 5).value
        if d and desc and isinstance(v, (int, float)) and v:
            desc = str(desc).strip().capitalize()
            cat = "Combustíveis" if "diesel" in desc.lower() else \
                  "Diaristas" if "triagem" in desc.lower() else \
                  "Manutenção" if "enxada" in desc.lower() else "Outros"
            despesas.append(dict(data=d, categoria=cat, descricao=desc, valor=c2(v), fonte="Planilha"))
    return vendas, compras, despesas, perdas, avisos


def main():
    origem = Path(sys.argv[1] if len(sys.argv) > 1 else "CVC - COMPRA E VENDA.xlsx")
    vendas, compras, despesas, perdas, avisos = ler_planilha(origem)

    for d, vend, cli, prod, kg, pr in VENDAS_WA:
        vendas.append(dict(aba="WA", produto=prod, fruta=prod, data=d, vendedor=vend, cliente=cli,
                           qtd=float(kg), total=c2(kg * pr), pago=True, loja="MATRIZ", fonte="WhatsApp"))
    for d, forn, fruta, kg, tot, obs in COMPRAS_WA:
        compras.append(dict(data=d, fornecedor=forn, fruta=fruta, kg=float(kg),
                            valor_kg=tot / kg, total=tot, obs=f"WhatsApp — {obs}", fonte="WhatsApp"))
    for d, forn, un, tot, obs in MELANCIA_WA:
        kg = un * PESO_MELANCIA
        compras.append(dict(data=d, fornecedor=forn, fruta="Melancia", kg=kg,
                            valor_kg=tot / kg, total=tot, obs=f"WhatsApp — {obs} ({un} un x {PESO_MELANCIA:g} kg)",
                            fonte="WhatsApp"))
    for d, cat, desc, v in DESPESAS_WA:
        despesas.append(dict(data=d, categoria=cat, descricao=desc, valor=v, fonte="WhatsApp"))

    # melancia: o sistema controla estoque em kg (6 kg por unidade, migração 66)
    for v in vendas:
        v["kg"] = v["qtd"] * PESO_MELANCIA if v["fruta"] == "Melancia" else v["qtd"]
        v["kg_un"] = PESO_MELANCIA if v["fruta"] == "Melancia" else 1.0
    for p in perdas:
        p["kg"] = p["kg"] * PESO_MELANCIA if p["fruta"] == "Melancia" else p["kg"]

    # custo médio por fruta (para valorizar as perdas)
    soma, peso = defaultdict(float), defaultdict(float)
    for c in compras:
        soma[c["fruta"]] += c["total"]
        peso[c["fruta"]] += c["kg"]
    custo = {f: soma[f] / peso[f] for f in peso if peso[f]}

    L, p = [], None
    p = L.append
    p("-- ============================================================================")
    p("--  Carga CVC — planilha CVC COMPRA E VENDA x grupos de WhatsApp (até 05/10/2026)")
    p("--  GERADO por scripts/importar-cvc-planilha-whatsapp.py — não edite à mão.")
    p("--")
    p("--  Rode DEPOIS de instalar.sql e das migrações (até a 68). Idempotente: os ids")
    p("--  vêm do conteúdo, rodar de novo atualiza em vez de duplicar.")
    p("--  O que ficou de fora e as divergências: docs/cruzamento-cvc-2026-10-05.md")
    p("-- ============================================================================")
    p("")
    p("begin;")
    p("")
    p("-- Produtos que ainda não existem no cadastro da CVC")
    for n in NOVOS_PRODUTOS:
        p("insert into public.produtos (nome, fruta, empresa, unidade_venda, kg_por_unidade, preco)")
        p(f"  select {q(n)}, {q(n)}, 'cvc', 'kg', 1, 0")
        p(f"  where not exists (select 1 from public.produtos where lower(nome) = lower({q(n)}));")
    p("")

    clientes = sorted({(v["cliente"], v["loja"]) for v in vendas})
    p("-- Redes e lojas")
    for rede in sorted({c for c, _ in clientes}):
        p(f"insert into public.redes (id, nome) values ({q(uuid_de('rede-cvc', rede))}, {q(rede)}) on conflict (lower(nome)) do nothing;")
    for rede, loja in clientes:
        p("insert into public.lojas (id, rede_id, nome)")
        p(f"  select {q(uuid_de('loja-cvc', rede, loja))}, r.id, {q(loja)} from public.redes r where lower(r.nome) = lower({q(rede)})")
        p("  on conflict (rede_id, lower(nome)) do nothing;")
    p("")

    p("-- Fornecedores")
    for f in sorted({c["fornecedor"] for c in compras}):
        p("insert into public.fornecedores (id, nome, status)")
        p(f"  select {q(uuid_de('forn-cvc', f))}, {q(f)}, 'ativo'")
        p(f"  where not exists (select 1 from public.fornecedores where lower(nome) = lower({q(f)}));")
    p("")

    p("-- Compras")
    for c in sorted(compras, key=lambda x: (x["data"], x["fruta"], x["fornecedor"], x["kg"])):
        cid = uuid_de("compra-cvc", c["data"], c["fornecedor"], c["fruta"], c["kg"], c["total"])
        p("insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)")
        p(f"  select {q(cid)}, {q(c['data'])}, (select id from public.fornecedores where lower(nome) = lower({q(c['fornecedor'])}) order by criado_em limit 1),")
        p(f"         {q(c['fruta'])}, {num(c['kg'])}, {c['total'] / c['kg']:.4f}, {q(c['obs'])}")
        p("  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;")
    p("")

    p("-- Vendas (uma por dia + cliente + vendedor; cada fruta é um item)")
    pedidos = defaultdict(list)
    for v in vendas:
        pedidos[(v["data"], v["cliente"], v["loja"], v["vendedor"], v["pago"])].append(v)
    for (data, cli, loja, vend, pago), itens in sorted(pedidos.items()):
        vid = uuid_de("venda-cvc", data, cli, loja, vend, pago)
        total = sum(i["total"] for i in itens)
        kg = sum(i["kg"] for i in itens)
        js = ", ".join(
            "jsonb_build_object("
            f"'produtoId', (select id from public.produtos where lower(nome) = lower({q(i['produto'])}) limit 1), "
            f"'qty', {num(i['qtd'])}, 'precoUnitario', {num(i['total'] / i['qtd'])}, "
            f"'kgPorUnidade', {num(i['kg_un'])}, 'kgTotal', {num(i['kg'])}, 'natureza', 'venda')"
            for i in itens)
        p("insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)")
        p(f"  select {q(vid)}, (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, {q(data)}, 0,")
        p(f"         jsonb_build_array({js}), {total:.2f}, {num(kg)}, {q('pago' if pago else 'pendente')}")
        p("  from public.lojas l join public.redes r on r.id = l.rede_id")
        p(f"  where lower(r.nome) = lower({q(cli)}) and lower(l.nome) = lower({q(loja)})")
        p("  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status;")
    p("")

    p("-- Perdas")
    for x in perdas:
        pid = uuid_de("perda-cvc", x["data"], x["fruta"], x["kg"])
        p("insert into public.perdas (id, data, fruta, kg, custo_kg, motivo)")
        p(f"  values ({q(pid)}, {q(x['data'])}, {q(x['fruta'])}, {num(x['kg'])}, {custo.get(x['fruta'], 0):.4f}, {q(x['motivo'])})")
        p("  on conflict (id) do update set kg = excluded.kg, custo_kg = excluded.custo_kg;")
    p("")

    p("-- Despesas")
    for d in sorted(despesas, key=lambda x: (x["data"], x["descricao"])):
        did = uuid_de("despesa-cvc", d["data"], d["categoria"], d["descricao"], d["valor"])
        p("insert into public.despesas (id, data, categoria, descricao, valor)")
        p(f"  values ({q(did)}, {q(d['data'])}, {q(d['categoria'])}, {q(d['descricao'])}, {d['valor']:.2f})")
        p("  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;")
    p("")
    p("commit;")
    p("")
    p("-- Confira:  select * from public.vw_estoque_fruta order by fruta;  select * from public.vw_dre_mes;")

    destino = Path("supabase/importacao-cvc-2026-10-05.sql")
    destino.write_text("\n".join(L) + "\n", encoding="utf8")

    rec = sum(v["total"] for v in vendas)
    print(f"{destino} gerado\n")
    print(f"  vendas   {len(pedidos):>4} pedidos / {len(vendas)} itens   R$ {rec:>12,.2f}")
    print(f"  compras  {len(compras):>4}                      R$ {sum(c['total'] for c in compras):>12,.2f}")
    print(f"  despesas {len(despesas):>4}                      R$ {sum(d['valor'] for d in despesas):>12,.2f}")
    print(f"  perdas   {len(perdas):>4}")
    for fonte in ("Planilha", "WhatsApp"):
        print(f"  compras {fonte:<9} R$ {sum(c['total'] for c in compras if c['fonte'] == fonte):>12,.2f}   "
              f"despesas R$ {sum(d['valor'] for d in despesas if d['fonte'] == fonte):>12,.2f}")
    for a in avisos:
        print("  ⚠", a)


if __name__ == "__main__":
    main()

# Cruzamento planilha × WhatsApp — CVC (até 05/10/2026)

Fontes: planilha **CVC – COMPRA E VENDA** (lançamentos até 29/09), grupo
**PAGAMENTOS MERCADORIAS CVC** (12/08 → 05/10) e grupo **FINANCEIRO CVC**
(10/08 → 05/10). Os comprovantes são imagens/PDFs; os valores foram lidos por
OCR e conferidos à mão nos casos duvidosos.

Carga gerada: `supabase/importacao-cvc-2026-10-05.sql`
(`python3 scripts/importar-cvc-planilha-whatsapp.py "<planilha>.xlsx"`).
Idempotente — rodar de novo atualiza, não duplica. **Não foi executada em
nenhum banco**; rode no Supabase da CVC depois de `instalar.sql` + migração 68.

## O que entra na carga

| | Planilha | WhatsApp (novo) | Total |
|---|---:|---:|---:|
| Vendas (40 pedidos / 118 itens) | R$ 213.735,88 | R$ 468,00 | R$ 214.203,88 |
| Compras (69) | R$ 138.390,95 | R$ 118.171,36 | R$ 256.562,31 |
| Despesas (90) | R$ 15.596,23 | R$ 25.068,61 | R$ 40.664,84 |
| Perdas | abacate 414 kg, goiaba 34 kg | | |

Os totais da planilha batem com os do arquivo (vendas, despesas e compras;
a compra da goiaba da Suely de 29/08 estava sem valor — ver "Premissas").

## Premissas que adotei (confirme)

1. **Quantidade na planilha = kg**, inclusive coco seco (unidades). Melancia é
   por unidade: converti para kg com 6 kg/un (peso médio da migração 66);
   preço fica por unidade.
2. **Goiaba da Suely 29/08, 250 kg sem valor**: preenchi R$ 3,20/kg usando o
   comprovante de 05/09 (R$ 800, "10 cxs dia 01/09 Atakarejo"). Caixa de
   goiaba = 25 kg (13 cx = 325 kg na planilha).
3. **Vendas sem data na planilha** (limão: Ismeralda, Rodrigo, Diversos ×2, Mix;
   Olé; perda do abacate) entraram em 28/08. Pelo chat, Rodrigo 550 kg é de
   ~19/08 (Pix de R$ 2.200 em 19/08) e os 47 kg são de 24/08.
4. **Status**: PAGO → pago; A PAGAR/A RECEBER → pendente.
   **Vendedor = conta que recebe**: CC → o dinheiro cai na Carvalho Cruz, AVF →
   cai na AVF, CVC → cai na própria CVC; CC e AVF precisam repassar à CVC.
   A migração 69 guarda isso em `vendas.recebedor` e controla os repasses.
5. Cliente vira rede com loja "MATRIZ" (Atakarejo, Bombom, Brauna, Diversos,
   Mix, CD Mix, Rodrigo, JPJS, Victor, Carcará, Ismeralda).
6. Produtos novos criados se faltarem: Tangerina Olé, Mamão Formosa.

## Bateu (planilha = comprovante)

Limão Faz. Papagaio R$ 13.120 + R$ 6.400 (164 cx e 80 cx de 25 kg); tangerina
Olé R$ 1.350 (30 cx); pokan Luis Eduardo R$ 1.610 (23 cx); pokan/GPE R$ 2.760
(NF 3778); Murcott/GPE R$ 2.300 (NF 3884); abacate HSM R$ 4.290; maracujá
Valdir R$ 4.326 + R$ 4.200 e Sandoval R$ 6.055; goiaba Amintas R$ 650 e Maria
R$ 780; ameixa Grace R$ 750 (300+450; planilha 749,70); ameixa JPJS R$ 480;
melão JPJS R$ 540; kiwi JPJS R$ 11.635 (planilha 11.631,60); frete do limão
R$ 8.560; vendas AVF de limão (Pix R$ 4.200, 7.795,20, 9.720, 10.800 e 2.200);
despesas câmara fria, sala, limpeza CD, dedetização, triagem ×2 e diesel.

## Divergências (planilha ≠ WhatsApp)

| Item | Planilha | WhatsApp | Obs. |
|---|---|---|---|
| Limão 14/09 (Leandro) | 9.937,5 kg × 5,52 = **R$ 54.855,00** | **R$ 54.497,50** a Rodolfo Cordeiro Abrantes, "400 cxs" (= 10.000 kg) | R$ 357,50 a menos; nome do fornecedor também difere |
| Enxada 14/08 | R$ 80,00 | R$ 60,00 | carga usa o da planilha |
| Almoço 17/08 | R$ 80,00 | R$ 70,00 | idem |
| Mamão AVF 22/09 | 162 kg (R$ 540) | 180 kg × R$ 3,00 = R$ 540 | mesma compra; a planilha lançou 162 kg (−10%?) |
| Tangerina Olé, venda 18/08 | 175 kg × 3,80 na aba **Olé** | chat diz **piemonte** | aba/produto errado? |
| Pera D'Anjou 21/08 | não lançada | 36 kg × R$ 13,00 = R$ 468 (Carlinhos) | **incluí** a venda |
| Pix a Luis Eduardo 24/08 | pokan dele: só R$ 630 (27/08) + R$ 1.800 (28/08) | Pix de **R$ 4.000** em 24/08, enviado junto da legenda "Abacate CVC" | não sei se é pokan ou parte do abacate (HSM, R$ 4.290) |

## Falta lançar na planilha — compras que **entraram** na carga

Mamão Havaí (Mascarenhas 5.605 kg R$ 11.210 · 5.835 kg R$ 10.785,50 · 6.160 kg
R$ 12.320; AVF 216/420/468/504 kg a R$ 3,00; formosa 180 kg R$ 324), coco seco
(180 un), goiaba (Suely ×3 e Kleber 36 cx), melancia (5.498 un: Marcos Antônio,
Gilson, Gilberto Sobral e JPJS 520 un a R$ 15) e 26 despesas (redinha do mamão
R$ 4.800 ×3, fretes, diaristas, combustível, ICMS de agosto R$ 2.788,92,
abertura da firma R$ 780, descarga R$ 1.150 …).

> A melancia da JPJS custou **R$ 15,00/un** contra R$ 7,00 do Marcos Antônio
> (assunto do grupo em 22/09).

## Ficou de fora — preciso de você

**Compras em caixa — entraram com kg ESTIMADO** (o R$ é do comprovante/NF; o
kg não): pokan 25 kg/cx (a planilha prova: 23 cx = 575 kg) — Luis Eduardo
08/09 e 19/09, 6 cx pagas pelo Xande 11/09, Lilian 15/09 e as 4 NFs da JPJS
com pokan (46 cx); Murcott 20 kg/cx (IFCO da planilha: 444 kg = 20 cx) —
Rodrigo 11/09, 19/09 (o comprovante veio **duas vezes**; contei uma) e 03/10.
Todos têm "kg ESTIMADO" na observação da compra. Corrija o kg real quando souber.

**Continuam fora (não dá nem para estimar):** tangerina "primavera" 10 cx
R$ 750 (05/09), 3 cx R$ 225 (05/10), 7 cx R$ 455 (01/10) — Murcott ou pokan? ·
**mamão 400 cx R$ 22.000 (15/09)**: a 5.605 kg o preço seria R$ 3,92/kg, o dobro
dos R$ 2,00 das outras cargas; pode ser outra coisa.

**Notas da JPJS — itens que continuam sem peso (manga, pera, pinha, coco, tangerina fresca):**

| NF | Data | Total | Itens |
|---|---|---:|---|
| 16925 | 03/09 | 655,00 | manga Tommy 3 cx, pera 2 cx |
| 17048 | 04/09 | 856,00 | manga Tommy 8 cx |
| 17071 | 05/09 | 1.800,00 | manga Tommy 10 cx, pera portuguesa 5 cx |
| 17264 | 08/09 | 2.649,00 | coco 3 cx, manga 18 cx, pinha 2 cx, tangerina 3 cx |
| 17352 | 10/09 | 3.132,00 | coco 2 cx, manga 4 cx, **melancia 100 un (importada)**, pinha 4 cx, pokan 2 cx |
| 17430 | 11/09 | 792,00 | pokan 9 cx × 88 |
| 17519 | 12/09 | 9.146,00 | manga 15 cx, **melancia 420 un (importada)**, pokan 17 cx |
| 17683 | 15/09 | 1.530,00 | pokan 18 cx × 85 |

Pagos por boleto/Pix: 668,10 · 3.044,00 · 875,68 · 1.839,60 · 2.701,98 ·
13.070,00 (= NF 17352+17430+17519) · 1.530,00 · 2.470,00 · 3.088,31 ·
2.301,00 · 3.635,00 (03/10). Falta a conta de **R$ 2.230 + R$ 11.635**
(21/08 e 01/09, Anabel Transportes "Frutas JPJS"): o kiwi de 405 kg (R$ 11.631,60)
está na planilha; os R$ 2.230 não achei de qual fruta.

**Pagamentos sem destino claro:**
- **Atakarejo, 30/09 (R$ 8.385 + R$ 2.795) e 05/10 (R$ 11.180, cupom 13939):** confirmado — são **compras** de limão no Atakarejo, 2.000 kg a R$ 5,59 cada vez (R$ 22.360). Já estão na carga.
- Vendas de maracujá R$ 200 a Eduardo (4 cx, 19/08, "segunda") e linha de
  maracujá AVF/Diversos "A RECEBER" sem valor (19/09).
- Frete R$ 362,29 (Posto Caio Bá, 19/08) — lancei como combustível.

**Sem comprovante no grupo:** limão Victor/Jpjs/Carcará/Mix (vendas AVF e CC de
18–22/09, R$ 18.000, 11.400, 3.780…), maracujá Victor (1.580 kg R$ 8.421,40 e
850 kg R$ 4.530,50), compras Eduardo pokan 27–28/08, frete limão R$ 1.521,65 /
R$ 800 / R$ 278,20 de 11/08.

## Repasses para a CVC (migração 69)

Confirmado: **Safra → Nu = Carvalho Cruz pagando a CVC** e **Pix do Xande =
AVF pagando a CVC**. Saldo = vendas pagas recebidas pela conta − repasses
(`select * from vw_repasse_conta`):

| Conta | Vendas pagas | Repassado à CVC | **Saldo a repassar** | Ainda a receber (vendas pendentes) |
|---|---:|---:|---:|---:|
| Carvalho Cruz | R$ 136.515,49 | R$ 126.382,41 (11 transf.) | **R$ 10.133,08** | R$ 33.701,19 |
| AVF | R$ 43.519,20 | R$ 79.367,50 (12 Pix) | **− R$ 35.848,30** | — |

Leitura: a CC deve R$ 10.133,08 e ainda tem R$ 33.701,19 de vendas a receber.
A AVF aparece com R$ 35.848,30 a mais repassado do que vendeu na planilha — ou
faltam vendas da AVF na planilha, ou o Xande pagou outras coisas da CVC pela AVF
(ex.: mamão R$ 11.210 + R$ 648/1.260/1.404/1.512 que ele recebeu como compra, a
Pix de R$ 23.730 de 13/08 e R$ 16.883,80 de 15/09). Vale conferir esses dois
Pix grandes. O app ainda **não tem tela** para isso (só a consulta acima).

## Vendas da CVC que já estão no sistema da Carvalho

O DRE do sistema da Carvalho mostra a CVC com R$ 31.379,20 (4.077,6 kg) em
setembro e R$ 38.374,71 (4.150 kg) em outubro, e **zero de compras**. Essas
vendas são pedidos com NF-e da CVC e **não estão na carga** (a planilha só tem
as vendas do Atakarejo por cupom e as da AVF/CC). Para a CVC começar do zero
no sistema novo, falta exportar esses pedidos (data, cliente/loja, produto, kg,
total, status, NF) e migrar junto; assim a carga não duplica nem perde nada.

## Para rodar

1. Banco novo da CVC: `instalar.sql` + `migracao-68-cvc-empresa-padrao.sql` + `migracao-69-recebedor-repasses.sql`.
2. `supabase/importacao-cvc-2026-10-05.sql` no SQL Editor.
3. Conferir: `select * from vw_estoque_fruta;` e `vw_dre_mes`. O estoque de
   algumas frutas ficará negativo até entrarem as compras em caixa acima.

-- ============================================================================
--  Tributação das frutas da CVC — tirada das NF-e que o Omie já emitiu
--
--  Origem: export do Omie "NF-e emitidas 2026" (50 notas, todas do CNPJ da
--  Carvalho Cruz, 48.995.197/0002-53). Para cada produto, o CFOP e os CSTs
--  que aparecem nas notas; quando um produto saiu de dois jeitos, vale o das
--  notas mais recentes (as poucas com ICMS 40 em ameixa, coco, maçã e peras
--  são de agosto/início de setembro; depois é sempre 00 a 19%).
--
--  Rode DEPOIS da migracao-28-produtos-cvc-fiscal.sql. Casa pelo código do
--  Omie (PRD000…), que a migração 28 gravou em `codigo`.
--
--  Esta é a cópia da CVC (tributacao-cvc-omie.sql da Carvalho Cruz) sem o filtro
--  `empresa = 'cvc'`: casa só pelo código, então roda antes ou depois da
--  migracao-68.
--
--  Idempotente: pode rodar de novo. Sobrescreve só os campos de tributação
--  destes produtos.
-- ============================================================================

begin;

-- ─── Isentas: ICMS 40, PIS/COFINS 07 — como nas notas do Omie ──────────────

update public.produtos
   set cfop_padrao = '5.102', origem = 0,
       icms_cst = '40', icms_aliquota = null, pis_cst = '07', cofins_cst = '07'
 where codigo in (
     'PRD00016',  -- Abacate
     'PRD00018',  -- Goiaba
     'PRD00010',  -- Laranja Navelina
     'PRD00011',  -- Lima da Pérsia
     'PRD00032',  -- Limão Siciliano
     'PRD00033',  -- Mamão Havaí
     'PRD00034',  -- Manga Espada
     'PRD00025',  -- Manga Tommy Atkins
     'PRD00019',  -- Maracujá
     'PRD00029',  -- Melancia
     'PRD00020',  -- Melão Orange
     'PRD00030',  -- Pinha
     'PRD00031',  -- Tangerina Murcote
     'PRD00009'   -- Tangerina Ponkan
   );

-- ─── Tributadas: ICMS 00 a 19%, PIS/COFINS 07 — como nas notas do Omie ────

update public.produtos
   set cfop_padrao = '5.102', origem = 0,
       icms_cst = '00', icms_aliquota = 19, pis_cst = '07', cofins_cst = '07'
 where codigo in (
     'PRD00017',  -- Ameixa Fresca Importada
     'PRD00022',  -- Kiwi Importado
     'PRD00024',  -- Coco Seco
     'PRD00012',  -- Maçã Verde (2 notas de 11/08 saíram a 19,5%)
     'PRD00014',  -- Pera Importada USA
     'PRD00023'   -- Pera Portuguesa
   );

-- ─── Sem nota no Omie: pelo produto de mesmo NCM ────────────────────────────
--
--  Estes nunca saíram numa NF-e do Omie em 2026. Seguem o produto de mesmo
--  NCM que saiu — confira com o contador se tiver dúvida.

update public.produtos
   set cfop_padrao = '5.102', origem = 0,
       icms_cst = '40', icms_aliquota = null, pis_cst = '07', cofins_cst = '07'
 where codigo in (
     'PRD00015',  -- Limão              (0805.50, como Lima da Pérsia e Limão Siciliano)
     '3321',      -- Laranja Nacional   (0805.10, como Laranja Navelina)
     'PRD00028',  -- Tangerina          (0805.21, como Ponkan e Murcote)
     'PRD00013'   -- Tangerina Piemonte (0805.21, como Ponkan e Murcote)
   );

update public.produtos
   set cfop_padrao = '5.102', origem = 0,
       icms_cst = '00', icms_aliquota = 19, pis_cst = '07', cofins_cst = '07'
 where codigo = 'PRD00021';  -- Pera D'Anjou (0808.30, como as outras peras)

--  Milho Verde (PRD00006, 0709.99.19) fica sem tributação: não saiu em nota
--  e não há produto de mesmo NCM para seguir.

commit;

-- Confira:
--   select nome, cfop_padrao, icms_cst, icms_aliquota, pis_cst, cofins_cst
--     from public.produtos order by icms_cst nulls first, nome;

-- ============================================================================
--  Histórico de despesas — agosto e setembro de 2026
--
--  As despesas da aba NÃO MEXER, consolidadas por categoria e mês.
--  Rode DEPOIS de schema.sql e das migrações 01 a 04.
--  Idempotente: ids fixos, rodar de novo não duplica.
--
--  ─── Por que consolidado, e não lançamento por lançamento ─────────────────
--
--  A planilha tem o detalhe: 18 linhas de funcionários com nome e valor, 6 de
--  diaristas, 5 de fretes, e assim por diante. Os TOTAIS dessas listas foram
--  conferidos e batem — mas o PDF junta duas e três linhas numa só, e o
--  pareamento entre nome e valor não é verificável. Registrar que um
--  funcionário recebeu R$ 800 quando recebeu R$ 90 seria pior do que não ter
--  o detalhe.
--
--  Então entra o que é certo: o total de cada categoria em cada mês.
--  Para ter o detalhe, exporte a planilha em .xlsx — daí as células vêm
--  separadas e a importação linha a linha fica segura.
--
--  ─── Como estes números foram conferidos ──────────────────────────────────
--
--    por categoria  combustíveis 9.953,25 · diaristas 1.621,10 ·
--                   funcionários 76.560,90 · fretes 33.814,00 ·
--                   investimentos 54.323,89 · outros 27.518,12
--    por mês        agosto R$ 172.092,90 · setembro R$ 31.698,36  (DRE)
--    no total       R$ 203.791,26                (PAINEL GERENCIAL)
--
--  A data é o primeiro dia do mês: o lançamento é o fechamento do mês
--  inteiro, não um gasto de um dia. O DRE agrupa por mês, então é o que basta.
-- ============================================================================

insert into public.despesas (id, data, categoria, descricao, valor) values
  -- Agosto
  ('d0000000-0000-4000-8000-000000000001', '2026-08-01', 'Combustíveis',  'Consolidado de agosto — planilha',   9378.00),
  ('d0000000-0000-4000-8000-000000000002', '2026-08-01', 'Funcionários',  'Consolidado de agosto — planilha',  64558.90),
  ('d0000000-0000-4000-8000-000000000003', '2026-08-01', 'Fretes',        'Consolidado de agosto — planilha',  29564.00),
  ('d0000000-0000-4000-8000-000000000004', '2026-08-01', 'Investimentos', 'Consolidado de agosto — planilha',  49592.00),
  ('d0000000-0000-4000-8000-000000000005', '2026-08-01', 'Outros',        'Consolidado de agosto — planilha',  19000.00),
  -- Setembro
  ('d0000000-0000-4000-8000-000000000006', '2026-09-01', 'Combustíveis',  'Consolidado de setembro — planilha',   575.25),
  ('d0000000-0000-4000-8000-000000000007', '2026-09-01', 'Diaristas',     'Consolidado de setembro — planilha',  1621.10),
  ('d0000000-0000-4000-8000-000000000008', '2026-09-01', 'Funcionários',  'Consolidado de setembro — planilha', 12002.00),
  ('d0000000-0000-4000-8000-000000000009', '2026-09-01', 'Fretes',        'Consolidado de setembro — planilha',  4250.00),
  ('d0000000-0000-4000-8000-000000000010', '2026-09-01', 'Investimentos', 'Consolidado de setembro — planilha',  4731.89),
  ('d0000000-0000-4000-8000-000000000011', '2026-09-01', 'Outros',        'Consolidado de setembro — planilha',  8518.12)
on conflict (id) do nothing;

-- Manutenção e Impostos ficaram zerados nos dois meses na planilha, por isso
-- não têm lançamento aqui. As categorias existem e aparecem no app.

-- Confira:
--
--   select categoria, sum(valor) from public.despesas group by categoria order by 2 desc;
--   select mes, sum(total) from public.vw_despesas_mes group by mes;   -- 172.092,90 / 31.698,36
--
--   select * from public.vw_dre_mes;
--
-- ⚠️  O DRE vai aparecer muito negativo até as vendas de junho a setembro
--     serem importadas: a mercadoria e as despesas já entraram, a receita não.
--     Com as vendas dentro, agosto fecha em −R$ 41.301,72 e setembro em
--     R$ 19.248,67, como na planilha.

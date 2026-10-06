-- ============================================================================
--  Histórico de compras — agosto e setembro de 2026
--
--  As seis compras de mercadoria da planilha, da aba COMPRA DE MERCADORIAS.
--  Não é dado de exemplo: é o histórico real, e é dele que sai o custo médio
--  por quilo que diz se a venda deu lucro.
--
--  Rode DEPOIS de schema.sql, migracao-01 e migracao-02.
--  Idempotente: os ids são fixos, então rodar de novo não duplica nada.
--
--  ─── Como estes números foram conferidos ──────────────────────────────────
--
--  O PDF da planilha traz as compras em três blocos lado a lado (uma coluna
--  por fruta), e a extração embaralha as colunas entre si. O encaixe abaixo é
--  o único que fecha ao mesmo tempo:
--
--    por mês     agosto R$ 213.433,40 · setembro R$ 64.779,92   (colunas do DRE)
--    por fruta   pera R$ 261.739,92 · lima R$ 4.090,40 · abóbora R$ 12.383,00
--    no total    434.307 kg · R$ 278.213,32                     (TOTAL GERAL)
--
--  Ainda assim, confira as datas contra suas notas antes de confiar nelas para
--  fechar o mês: o que o PDF garante são os pesos, os preços e os totais.
-- ============================================================================

insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao) values
  -- Laranja pera — Carvalho Cruz
  ('c0000000-0000-4000-8000-000000000001', '2026-08-20', 'f1000000-0000-4000-8000-000000000001', 'Laranja Pera', 329000, 0.60, 'Planilha — abertura da safra'),
  ('c0000000-0000-4000-8000-000000000002', '2026-09-01', 'f1000000-0000-4000-8000-000000000001', 'Laranja Pera',  69861, 0.72, 'Planilha'),
  ('c0000000-0000-4000-8000-000000000003', '2026-09-14', 'f1000000-0000-4000-8000-000000000001', 'Laranja Pera',  18000, 0.78, 'Planilha'),
  -- Laranja lima — FB
  ('c0000000-0000-4000-8000-000000000004', '2026-08-20', 'f1000000-0000-4000-8000-000000000002', 'Laranja Lima',   4563, 0.80, 'Planilha'),
  ('c0000000-0000-4000-8000-000000000005', '2026-09-14', 'f1000000-0000-4000-8000-000000000002', 'Laranja Lima',    500, 0.88, 'Planilha'),
  -- Abóbora — Carvalho Cruz
  ('c0000000-0000-4000-8000-000000000006', '2026-08-20', 'f1000000-0000-4000-8000-000000000001', 'Abóbora',       12383, 1.00, 'Planilha')
on conflict (id) do nothing;

-- Confira o resultado — tem de bater com a planilha:
--
--   select * from public.vw_compras_fruta order by fruta;
--     Laranja Pera   416.861 kg   R$ 261.739,92   R$ 0,63/kg
--     Laranja Lima     5.063 kg   R$   4.090,40   R$ 0,81/kg
--     Abóbora         12.383 kg   R$  12.383,00   R$ 1,00/kg
--
--   select * from public.vw_estoque_fruta order by fruta;
--     mostra entradas − saídas. Enquanto as vendas de junho a setembro não
--     forem importadas, o estoque vai aparecer alto: as saídas ainda não
--     existem no app.

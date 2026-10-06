-- ============================================================================
--  Migração 67 — peso da caixa: "MAMAO" e "Tangerina" (complemento da 65)
--
--  Os produtos com esses nomes exatos ficaram sem peso na migração 65:
--    MAMAO      → Mamão Havaí, 23 kg
--    Tangerina  → Tangerina Ôle, 23 kg
--  Só mexe em quem ainda está sem peso. Rode depois da migracao-64.
--  Idempotente. Nada é apagado.
-- ============================================================================

begin;

update public.produtos set kg_por_caixa = 23
 where kg_por_caixa is null and lower(trim(fruta)) in ('mamao', 'mamão', 'tangerina');

commit;

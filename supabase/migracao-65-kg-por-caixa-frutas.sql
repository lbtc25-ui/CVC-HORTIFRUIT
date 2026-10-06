-- ============================================================================
--  Migração 65 — peso da caixa das frutas (carga inicial)
--
--  Preenche produtos.kg_por_caixa (migracao-64) pelo nome da fruta. Só mexe
--  em quem ainda está sem peso: o que já foi digitado no app não é trocado.
--  Abóbora e melancia ficam de fora (5 kg e 6 kg são o peso médio da
--  unidade, não de caixa) — cadastre no app se quiser.
--
--  Depois de rodar, confira quais frutas ficaram sem peso:
--    select distinct fruta from public.produtos where kg_por_caixa is null;
--
--  Rode DEPOIS da migracao-64. Idempotente. Nada é apagado.
-- ============================================================================

begin;

update public.produtos p
   set kg_por_caixa = v.kg
  from (values
    ('%hava%',        23),  -- Mamão Havaí
    ('%formosa%',     20),  -- Mamão Formosa
    ('%goiaba%',      25),
    ('%pokan%',       23),  -- Tangerina Pokan
    ('%ponkan%',      23),  -- Tangerina Ponkan
    ('%murc%',        25),  -- Murcote
    ('%murk%',        25),
    ('%maracuj%',     15),
    ('%pitaya%',      20),
    ('%lim_o%',       24),  -- Limão (não pega Laranja Lima)
    ('%abacate%',     20),
    ('%laranja%',     25),  -- Pera e Lima
    ('%ole%',         23),  -- Tangerina Ôle
    ('%abacaxi%',     25)
  ) as v(padrao, kg)
 where p.kg_por_caixa is null
   and lower(p.fruta) like v.padrao;

commit;

-- ============================================================================
--  Migração 45 — unidades de compra dos insumos de produção
--
--  A migracao-31 cadastrou os insumos todos em "unidade". Não é assim que se
--  compra nem que se conta no depósito:
--
--    Redinha (os sacos)   rolo de 1.000 metros — 1 metro faz 3 sacos de
--                          2,5 kg, então 1 rolo ≈ 3.000 sacos de 2,5 kg
--    Grampo               milheiro (1.000 grampos)
--    Etiquetas            milheiro (1.000 etiquetas)
--
--  A contagem passa a ser registrada nessas unidades (aceita fração: meio
--  rolo = 0,5; 1.500 etiquetas = 1,5 milheiro). O app mostra ao lado quanto
--  isso rende em sacos / unidades.
--
--  Atenção: contagens já registradas antes desta migração continuam com o
--  número que foi digitado — se alguém lançou, por exemplo, 5000 grampos,
--  agora aparece como 5000 milheiros. Confira o histórico em Estoque →
--  Insumos de Produção e registre uma contagem nova nas unidades certas.
--
--  Só mexe nos itens que ainda estão em "unidade" — se a unidade já foi
--  trocada à mão, fica como está. Idempotente.
-- ============================================================================

begin;

update public.insumos_itens set unidade = 'rolo (1.000 m)'
 where nome = 'Redinha' and unidade = 'unidade';

update public.insumos_itens set unidade = 'milheiro'
 where (nome = 'Grampo' or nome like 'Etiqueta%') and unidade = 'unidade';

commit;

-- Confira:  select nome, unidade, estoque_minimo from public.insumos_itens order by ordem;

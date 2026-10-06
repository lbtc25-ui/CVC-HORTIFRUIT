-- ============================================================================
--  Migração 68 — a CVC como empresa padrão (só para o banco da CVC)
--
--  O sistema nasceu na Carvalho Cruz, onde `empresa` = 'carvalho_cruz' era o
--  padrão. Na CVC é o contrário: o padrão é 'cvc', e 'carvalho_cruz' passa a
--  ser a empresa que ainda EMITE a nota de parte dos produtos (o app usa a
--  conta Spedy dela para esses produtos).
--
--  1. O padrão de produtos.empresa e metas.empresa vira 'cvc'.
--  2. Os produtos e metas que já existem (vindos da instalação) ficam com
--     'carvalho_cruz', porque hoje as notas ainda saem pela Carvalho. Quando
--     a conta Spedy da CVC estiver pronta, troque produto a produto em
--     Estoque → lápis → "Empresa que emite a nota", ou rode:
--
--         update public.produtos set empresa = 'cvc';
--
--  Idempotente quanto ao padrão; o passo 2 só mexe no que ainda é do padrão
--  antigo de uma instalação nova. NÃO rode de novo depois de trocar produtos
--  para 'cvc' — ele os devolveria para 'carvalho_cruz'.
-- ============================================================================

-- ATENÇÃO: no banco da CVC rode a migracao-69-tudo-cvc.sql, não esta.

begin;

-- (as duas linhas que marcavam tudo como 'carvalho_cruz' saíram: ver migracao-69)

alter table public.produtos alter column empresa set default 'cvc';
alter table public.metas    alter column empresa set default 'cvc';

commit;

-- Confira:  select empresa, count(*) from public.produtos group by 1;

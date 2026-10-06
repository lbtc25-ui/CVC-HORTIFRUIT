-- ============================================================================
--  Migração 69 — tudo CVC (uma empresa só)
--
--  A CVC não tem duas empresas: nenhum produto é "da Carvalho Cruz", toda a
--  nota sai pela CVC e a CVC só revende (compra e venda), então o CFOP é 5.102.
--
--  1. Todo produto passa a empresa = 'cvc' e CFOP padrão 5.102 (revenda).
--  2. As metas também passam a 'cvc'.
--  3. O padrão das duas colunas fica 'cvc'.
--  4. Sai o fornecedor "Carvalho Cruz" (herança da instalação), se nenhuma
--     compra estiver ligada a ele.
--
--  Substitui a migracao-68 (que fazia o contrário). Idempotente: pode rodar de
--  novo sem estragar nada.
-- ============================================================================

begin;

update public.produtos set empresa = 'cvc', cfop_padrao = '5.102'
  where empresa is distinct from 'cvc' or cfop_padrao is distinct from '5.102';

update public.metas set empresa = 'cvc' where empresa is distinct from 'cvc';

alter table public.produtos alter column empresa set default 'cvc';
alter table public.metas    alter column empresa set default 'cvc';

delete from public.fornecedores f
  where lower(f.nome) = 'carvalho cruz'
    and not exists (select 1 from public.compras c where c.fornecedor_id = f.id);

commit;

-- Confira:
--   select empresa, cfop_padrao, count(*) from public.produtos group by 1, 2;
--   select nome from public.fornecedores order by 1;

-- ============================================================================
--  Código (cProd) dos produtos de produção própria na NF-e
--
--  A NF-e 12 (Rede Mais, 25/09/2026) saiu com o id interno do produto como
--  código ("d1000000-0000-4000-8000-000000000001") e o sistema da Rede Mais
--  recusou por causa dos hífens. A emissão agora usa o `codigo` do cadastro;
--  estes 7 produtos ainda não tinham, então recebem o mesmo SKU que usavam
--  nas notas emitidas pelo Omie (scripts/gerar-cadastro-fiscal-produtos.py),
--  que o ERP dos clientes já conhece.
--
--  Idempotente: só preenche quem está sem código.
-- ============================================================================

begin;

update public.produtos p
   set codigo = v.codigo
  from (values
    ('d1000000-0000-4000-8000-000000000001'::uuid, 'PRD00001'),  -- Laranja Agranel
    ('d1000000-0000-4000-8000-000000000002'::uuid, 'PRD00005'),  -- Saco 2,5 kg
    ('d1000000-0000-4000-8000-000000000003'::uuid, 'PRD00004'),  -- Saco 3 kg
    ('d1000000-0000-4000-8000-000000000004'::uuid, 'PRD00002'),  -- Saco 5 kg
    ('d1000000-0000-4000-8000-000000000005'::uuid, 'PRD00007'),  -- Saco 10 kg
    ('d1000000-0000-4000-8000-000000000006'::uuid, 'PRD00003'),  -- Laranja Lima
    ('d1000000-0000-4000-8000-000000000007'::uuid, 'PRD00008')   -- Abóbora
  ) as v(id, codigo)
 where p.id = v.id
   and (p.codigo is null or trim(p.codigo) = '');

commit;

-- Confira:
--   select nome, codigo from public.produtos where empresa is distinct from 'cvc' order by nome;

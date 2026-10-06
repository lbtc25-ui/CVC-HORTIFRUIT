-- ============================================================================
--  Compras de mercadoria de 23/09 a 26/09/2026, da aba ESTOQUE da planilha
--  (bloco COMPRA DE MERCADORIAS).
--
--  Continuação do correcao-2026-09-25-compras.sql (que foi até 22/09 e
--  deixou de fora a Abóbora de 23/09 por a data ter vindo quebrada na
--  planilha — confirmado com o cliente que é 23/09/2026).
--
--  Idempotente: roda antes ou depois do correcao-2026-09-25-compras.sql sem
--  duplicar nada — a compra só entra se não existir outra igual (mesma
--  data, fruta e peso), então também não duplica uma compra já lançada à
--  mão no app.
-- ============================================================================

begin;

insert into public.fornecedores (id, nome, produto, cidade, status)
select v.id::uuid, v.nome, v.produto, 'Aracaju-SE', 'ativo'
from (values
  ('f1000000-0000-4000-8000-000000000004', 'Casa da Abóbora', 'Abóbora')
) as v (id, nome, produto)
where not exists (
  select 1 from public.fornecedores f
  where translate(lower(f.nome), 'áãâéêíóõôúç', 'aaaeeiooouc')
      = translate(lower(v.nome), 'áãâéêíóõôúç', 'aaaeeiooouc')
);

insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
select v.id::uuid, v.data::date, f.id, v.fruta, v.kg, v.preco, 'Planilha'
from (values
  ('c0000000-0000-4000-8000-000000000013', '2026-09-23', 'casa da abobora', 'Abóbora',      1500, 1.00),
  ('c0000000-0000-4000-8000-000000000014', '2026-09-26', 'carvalho cruz',   'Laranja Pera', 14880, 0.80),
  ('c0000000-0000-4000-8000-000000000015', '2026-09-26', 'fb',              'Laranja Lima',   760, 0.88)
) as v (id, data, fornecedor, fruta, kg, preco)
left join lateral (
  select id from public.fornecedores
  where translate(lower(nome), 'áãâéêíóõôúç', 'aaaeeiooouc') = v.fornecedor
  order by criado_em
  limit 1
) f on true
where not exists (
  select 1 from public.compras c
  where c.data = v.data::date and c.fruta = v.fruta and c.peso_kg = v.kg
)
on conflict (id) do nothing;

commit;

-- Confira — tem de bater com a aba ESTOQUE da planilha (saldo apurado),
-- depois de rodar este arquivo E o correcao-2026-09-25-compras.sql:
--   select fruta, entradas_kg, estoque_kg from public.vw_estoque_fruta order by fruta;
--     Abóbora         15.483 kg entrada
--     Laranja Lima     6.333 kg entrada
--     Laranja Pera   478.481 kg entrada

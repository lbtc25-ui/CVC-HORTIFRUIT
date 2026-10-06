-- ============================================================================
--  Compras de mercadoria de 15/09 a 22/09/2026, da aba ESTOQUE da planilha
--  (bloco COMPRA DE MERCADORIAS). O historico-compras.sql parou em 14/09.
--
--  O estoque do app é conta (compras − vendas − perdas + acertos): sem estas
--  entradas, as vendas da semana deixariam a fruta negativa.
--
--  Idempotente: fornecedor e compra só entram se ainda não existirem
--  (compra = mesma data, fruta e peso), então também não duplica uma compra
--  que já tenha sido lançada à mão no app.
--
--  Fica de fora: Abóbora, CASA DA ABOBORA, 1.500 kg a R$ 1,00, com a data
--  só "23" e marcada REVISAR na planilha — ela mesma não soma essa linha no
--  estoque.
-- ============================================================================

begin;

insert into public.fornecedores (id, nome, produto, cidade, status)
select v.id::uuid, v.nome, v.produto, 'Aracaju-SE', 'ativo'
from (values
  ('f1000000-0000-4000-8000-000000000003', 'João da Laranja', 'Laranja pera'),
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
  ('c0000000-0000-4000-8000-000000000007', '2026-09-15', 'casa da abobora', 'Abóbora',       1600, 1.00),
  ('c0000000-0000-4000-8000-000000000008', '2026-09-16', 'carvalho cruz',   'Laranja Pera', 10450, 0.83),
  ('c0000000-0000-4000-8000-000000000009', '2026-09-18', 'carvalho cruz',   'Laranja Pera', 17100, 0.83),
  ('c0000000-0000-4000-8000-000000000010', '2026-09-18', 'joao da laranja', 'Laranja Pera',  1400, 0.85),
  ('c0000000-0000-4000-8000-000000000011', '2026-09-18', 'fb',              'Laranja Lima',   510, 0.88),
  ('c0000000-0000-4000-8000-000000000012', '2026-09-22', 'carvalho cruz',   'Laranja Pera', 17790, 0.80)
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

-- Confira — tem de bater com a aba ESTOQUE da planilha (saldo apurado):
--   select fruta, entradas_kg, estoque_kg from public.vw_estoque_fruta order by fruta;
--     Abóbora         13.983 kg entrada   444,60 kg saldo
--     Laranja Lima     5.573 kg entrada   505,83 kg saldo
--     Laranja Pera   463.601 kg entrada 17.554,17 kg saldo

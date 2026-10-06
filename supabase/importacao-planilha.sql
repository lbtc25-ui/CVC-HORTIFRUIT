-- ============================================================================
--  Importação da planilha de gestão — gerado por scripts/importar-planilha.py
--  NÃO edite à mão: exporte a planilha de novo e rode o script.
--
--  Origem: planilha.xlsx
--
--  Rode DEPOIS de schema.sql, das migrações 01 a 04 e do seed.sql.
--  Os ids vêm do conteúdo de cada linha, então reimportar ATUALIZA em vez
--  de duplicar.
-- ============================================================================

begin;

-- ─── Redes e lojas que apareceram nas vendas ────────────────────────────────
-- ON CONFLICT pelo nome: as que já vieram do seed.sql não são tocadas.

insert into public.redes (id, nome) values ('ef048907-377a-4bef-80c6-e9c2e5a9351c', 'ATAKAREJO')
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('08e45e70-6e27-4a5b-897d-c34bffdddba8', 'BOMBOM')
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('4a038903-9606-4b31-8923-90d42f3274e8', 'BRAUNA')
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('bcbc96c1-0cbf-43f8-8347-6038ee38102f', 'DIVERSOS')
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('8ed1fd08-242f-4840-8954-c7ef070e2330', 'FASOUTO')
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('ef115156-9c3e-441e-83be-c65afc4742a8', 'HIPER CARNES')
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('e205c91a-a06c-42f3-8641-e67b150a3e40', 'HOTEL AQUARIUS')
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('e6a40bc4-8ba3-4a3a-8bff-9cbe9387b14f', 'HOTEL SAO MANUEL')
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('38292dd6-6f5b-48f4-8771-a7e478b15acc', 'J.PEIXOTO')
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('b8cc3919-e867-4480-8474-b7a626d1f4ad', 'MIX MATEUS')
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('c3319f8a-1142-47c7-89f6-ef997232cb85', 'NUNES PEIXOTO')
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('189e466d-2ec5-4b11-8d64-5af4b3d17216', 'PANDELLI')
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('44059ffc-ee10-4118-82cd-6a607ba0f454', 'PETROX')
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('6cf011f0-b044-4ff4-854f-ff8467ac87d4', 'PRIMAVERA')
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('ed3715bb-24df-423c-8ee6-5a00b9dc1370', 'REDE ALPHA')
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('ae73d7ab-728c-4f83-8ac1-2797653afc66', 'REDE MAIS')
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('99e911e9-5484-42f2-8a38-0b5761e1d215', 'SILVA SUPERMERCADO')
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('92268779-c76d-4d7a-8bb6-b05d01db190f', 'SUPERMERCADO DA PRAIA')
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('9e1fae60-5348-43ac-853e-700a7b57d5ec', 'TABAJARA')
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('acc866f0-77f4-4cf9-88e7-2366adbc4104', 'VICTOR')
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('b898e7d7-d6d8-4746-814d-aa9b8388d297', 'VINICIUS')
  on conflict (lower(nome)) do nothing;

insert into public.lojas (id, rede_id, nome)
  select 'b30bd5b6-fc60-402c-83c1-d586efd098de', r.id, 'ADELIA'
  from public.redes r where lower(r.nome) = lower('ATAKAREJO')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'd9272061-0b17-41e8-8a76-2403fd817d75', r.id, 'CD'
  from public.redes r where lower(r.nome) = lower('ATAKAREJO')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '213a1bb5-c79c-42d1-8763-5bd789051906', r.id, 'GLORIA'
  from public.redes r where lower(r.nome) = lower('ATAKAREJO')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '0ddc82ca-9d03-47f8-8118-02a4eda41613', r.id, 'ITABAIANA'
  from public.redes r where lower(r.nome) = lower('ATAKAREJO')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '28202874-e978-4690-8f3a-795402824ef2', r.id, 'ARACAJU'
  from public.redes r where lower(r.nome) = lower('BOMBOM')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '6cbf26f6-912e-4d3d-8a40-86ab87d287c6', r.id, 'ESTANCIA'
  from public.redes r where lower(r.nome) = lower('BOMBOM')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '8a570dc8-c628-4f21-8e57-2aa4ca8aadda', r.id, 'MATRIZ'
  from public.redes r where lower(r.nome) = lower('BRAUNA')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '1895220d-2cb1-45b6-81ce-73845df204d5', r.id, 'DIVERSOS'
  from public.redes r where lower(r.nome) = lower('DIVERSOS')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '9773e1a7-8a45-44a8-8a00-a5e4c7f1395d', r.id, 'INDUSTRIAL'
  from public.redes r where lower(r.nome) = lower('FASOUTO')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'e7731069-0799-49bb-863b-580fa227f5d2', r.id, 'SOCORRO'
  from public.redes r where lower(r.nome) = lower('FASOUTO')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'fe71ca72-1f62-452f-80b4-6e8615486ae4', r.id, 'ARUANA'
  from public.redes r where lower(r.nome) = lower('HIPER CARNES')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '1ba0e342-4a80-446b-8b5e-2c1df1223cfb', r.id, 'BARRA'
  from public.redes r where lower(r.nome) = lower('HIPER CARNES')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '5d556b60-81ba-4d7a-888c-a85a947a49a3', r.id, 'JABOTIANA'
  from public.redes r where lower(r.nome) = lower('HIPER CARNES')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '7bf8fbf4-250e-47b0-8bdc-9cb3cc28fb66', r.id, 'MATRIZ'
  from public.redes r where lower(r.nome) = lower('HOTEL AQUARIUS')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'acbb8ac2-399d-46b7-8d18-7775d234a99e', r.id, 'MATRIZ'
  from public.redes r where lower(r.nome) = lower('HOTEL SAO MANUEL')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '3dc30309-09cf-4787-86fe-74858c9450d8', r.id, 'ARUANA'
  from public.redes r where lower(r.nome) = lower('J.PEIXOTO')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '53f897b3-eb68-4c0f-815b-62e5b3e6a632', r.id, 'PIABETA'
  from public.redes r where lower(r.nome) = lower('J.PEIXOTO')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'd9e18c8c-c8f9-4cfe-88e2-1b3ad1bb7116', r.id, 'SAO BRAS'
  from public.redes r where lower(r.nome) = lower('J.PEIXOTO')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'c3a825a7-303a-4687-80e3-c1d2dca08596', r.id, 'ASWALDO'
  from public.redes r where lower(r.nome) = lower('MIX MATEUS')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '3cbfcc30-7ec3-480a-8c31-97f4a7e74503', r.id, 'FEIRA'
  from public.redes r where lower(r.nome) = lower('MIX MATEUS')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '07ff3d2f-2241-4fb0-8226-210004d2d074', r.id, 'GLORIA'
  from public.redes r where lower(r.nome) = lower('MIX MATEUS')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'afc023cf-ceaa-421f-8bf0-2c3644609434', r.id, 'INDUSTRIAL'
  from public.redes r where lower(r.nome) = lower('MIX MATEUS')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '590a609e-657a-42c1-87ad-5c62329b699a', r.id, 'GLORIA'
  from public.redes r where lower(r.nome) = lower('NUNES PEIXOTO')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '4cc3a1af-e32b-4dcc-8455-5769a7d46aa5', r.id, 'ITABAIANA'
  from public.redes r where lower(r.nome) = lower('NUNES PEIXOTO')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '0d08c197-68cd-441c-884e-cfcdb710d1cc', r.id, 'MATRIZ'
  from public.redes r where lower(r.nome) = lower('PANDELLI')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '1d36f950-153f-4665-8bbe-f810c66bb309', r.id, 'AEROPORTO'
  from public.redes r where lower(r.nome) = lower('PETROX')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '99802322-851c-4b2c-8082-2d1831effd7e', r.id, 'ARUANA'
  from public.redes r where lower(r.nome) = lower('PETROX')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '628a4bb5-f758-48dd-81f1-a0c36d6a364e', r.id, 'ATALAIA'
  from public.redes r where lower(r.nome) = lower('PETROX')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'aba239f8-c54e-4ec2-807b-a7ef6ce00ff4', r.id, 'BARRA'
  from public.redes r where lower(r.nome) = lower('PETROX')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '2476d1b1-4610-4897-87f4-2e993e0261d9', r.id, 'BR'
  from public.redes r where lower(r.nome) = lower('PETROX')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'e5a5b552-19f0-46ed-81a1-e6fce92413e8', r.id, 'F.PORTO'
  from public.redes r where lower(r.nome) = lower('PETROX')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '50a3b525-54de-46c2-8300-a3717e830c11', r.id, 'FAROL'
  from public.redes r where lower(r.nome) = lower('PETROX')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '53f15c89-b146-459e-8a9c-09d1bcb82b92', r.id, 'GAZOL'
  from public.redes r where lower(r.nome) = lower('PETROX')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '594b0b12-4d93-4d03-8917-614dffcdc242', r.id, 'MELICIO'
  from public.redes r where lower(r.nome) = lower('PETROX')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '3afed937-2819-4a6d-8cf1-205a65bcf34a', r.id, 'ORLA SOL'
  from public.redes r where lower(r.nome) = lower('PETROX')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '650e0604-ab6e-4711-8aa8-367fc1165ef0', r.id, 'P.CAJU'
  from public.redes r where lower(r.nome) = lower('PETROX')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '56411649-fe5e-4cc6-89f4-9e7429e44b74', r.id, 'PRAIA'
  from public.redes r where lower(r.nome) = lower('PETROX')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '102d99f8-0f63-4bce-80aa-efff667c77c0', r.id, 'SANTA LUCIA'
  from public.redes r where lower(r.nome) = lower('PETROX')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'db4ffa51-67af-4981-8745-3b69dd1f673a', r.id, 'TANCREDO'
  from public.redes r where lower(r.nome) = lower('PETROX')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '7ec0e1dd-6c56-4426-89d8-bb35de0a77d6', r.id, 'TREZE'
  from public.redes r where lower(r.nome) = lower('PETROX')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'd36df7b9-0c0b-45a9-8d4d-2c69825eda08', r.id, 'URQUIZA LEAL'
  from public.redes r where lower(r.nome) = lower('PETROX')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '83e7fe14-97ed-47f6-8767-05827838dbe3', r.id, 'MATRIZ'
  from public.redes r where lower(r.nome) = lower('PRIMAVERA')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'af86bfea-cc4d-4deb-889f-83a055f2097c', r.id, 'COROA'
  from public.redes r where lower(r.nome) = lower('REDE ALPHA')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '56e1fb73-cea1-4ea6-8c54-3bdcebabf33c', r.id, 'DETRAN'
  from public.redes r where lower(r.nome) = lower('REDE ALPHA')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'ee6dba0e-c641-4992-8327-a9e7f696db2e', r.id, 'BARRA'
  from public.redes r where lower(r.nome) = lower('REDE MAIS')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'dac4997d-3b2a-4499-817a-83f12828e343', r.id, 'DISTRITO'
  from public.redes r where lower(r.nome) = lower('REDE MAIS')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '5b76e904-09bc-44f9-89d5-bb69f1b6797f', r.id, 'ECO POSTO'
  from public.redes r where lower(r.nome) = lower('REDE MAIS')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'aba86fd1-3ecc-4820-8887-c5fe5dc08045', r.id, 'F.PORTO'
  from public.redes r where lower(r.nome) = lower('REDE MAIS')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'b6f18991-05e5-4a26-8454-c6a2a40b8058', r.id, 'FAROLANDIA'
  from public.redes r where lower(r.nome) = lower('REDE MAIS')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '4675f9e0-4873-4892-868f-ecc23359aeb1', r.id, 'MEGA'
  from public.redes r where lower(r.nome) = lower('REDE MAIS')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'fe5dac6f-b6c2-4a35-852b-fee9709eb90d', r.id, 'TANCREDO'
  from public.redes r where lower(r.nome) = lower('REDE MAIS')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '62731e93-50b7-4963-878f-88a16a362812', r.id, 'MATRIZ'
  from public.redes r where lower(r.nome) = lower('SILVA SUPERMERCADO')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'b89f177e-e87b-4a18-8173-e5ac356a7b3d', r.id, 'MATRIZ'
  from public.redes r where lower(r.nome) = lower('SUPERMERCADO DA PRAIA')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'd9b88d07-b014-4663-80ad-83454d08b409', r.id, 'MATRIZ'
  from public.redes r where lower(r.nome) = lower('TABAJARA')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'd3912c8d-e270-47d8-877f-c7337e379d6c', r.id, 'SOLEDADE'
  from public.redes r where lower(r.nome) = lower('TABAJARA')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '90732cb5-ea13-4bcc-85ac-8e08b5ac4e0d', r.id, 'MATRIZ'
  from public.redes r where lower(r.nome) = lower('VICTOR')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'cce75584-8ac0-4e72-8774-3bbe67f2fd42', r.id, 'ASTRO'
  from public.redes r where lower(r.nome) = lower('VINICIUS')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'b8480539-72f3-4de2-833e-2918af9a29db', r.id, 'CHURRASCARIA PRAIA'
  from public.redes r where lower(r.nome) = lower('VINICIUS')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '9c65557f-ebfa-4b4e-8a11-23f2f5b78072', r.id, 'MERCADO TRABALHADOR'
  from public.redes r where lower(r.nome) = lower('VINICIUS')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '92e1a378-95f0-47d8-848e-467ccbc5f39b', r.id, 'NORDESTAO'
  from public.redes r where lower(r.nome) = lower('VINICIUS')
  on conflict (rede_id, lower(nome)) do nothing;

-- ─── Vendas ─────────────────────────────────────────────────────────────────
--
--  STATUS: a planilha nunca registrou pagamento. O que vence até hoje
--  entra como 'pago' e o que ainda está no prazo como
--  'pendente' — é a leitura mais provável, não um dado da planilha.
--  Para tratar tudo como pendente e conferir uma a uma no app:
--    update public.vendas set status = 'pendente' where numero >= 1000;

insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '37558f76-5d92-42df-8eda-8e581af9b168', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-08-28', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 221645, 'precoUnitario', 0.96, 'kgPorUnidade', 1, 'kgTotal', 221645, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 29771, 'precoUnitario', 2.96, 'kgPorUnidade', 2.5, 'kgTotal', 74427.5, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000003', 'qty', 1712, 'precoUnitario', 4.29, 'kgPorUnidade', 3, 'kgTotal', 5136, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000004', 'qty', 120, 'precoUnitario', 6, 'kgPorUnidade', 5, 'kgTotal', 600, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000005', 'qty', 628, 'precoUnitario', 12.45, 'kgPorUnidade', 10, 'kgTotal', 6280, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 3914, 'precoUnitario', 2.51, 'kgPorUnidade', 1, 'kgTotal', 3914, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 11010, 'precoUnitario', 1.6, 'kgPorUnidade', 1, 'kgTotal', 11010, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 2165, 'precoUnitario', 0, 'kgPorUnidade', 1, 'kgTotal', 2165, 'natureza', 'bonificacao'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 1402, 'precoUnitario', 0, 'kgPorUnidade', 2.5, 'kgTotal', 3505, 'natureza', 'bonificacao'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000004', 'qty', 120, 'precoUnitario', 0, 'kgPorUnidade', 5, 'kgTotal', 600, 'natureza', 'bonificacao'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 75, 'precoUnitario', 0, 'kgPorUnidade', 1, 'kgTotal', 75, 'natureza', 'bonificacao'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 73.4, 'precoUnitario', 0, 'kgPorUnidade', 1, 'kgTotal', 73.4, 'natureza', 'bonificacao')),
         344224.58, 329430.9,
         case when current_date >= (date '2026-08-28' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('DIVERSOS') and lower(l.nome) = lower('DIVERSOS')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'd2e3518e-b2c2-4420-813b-d6dcfada4c78', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-01', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 18, 'precoUnitario', 4.39, 'kgPorUnidade', 1, 'kgTotal', 18, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 4260, 'precoUnitario', 1.15, 'kgPorUnidade', 1, 'kgTotal', 4260, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000003', 'qty', 40, 'precoUnitario', 3.45, 'kgPorUnidade', 3, 'kgTotal', 120, 'natureza', 'venda')),
         5116.02, 4398,
         case when current_date >= (date '2026-09-01' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('CD')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '64eebc9d-b9ae-48e7-8f52-72b77b580d15', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-01', 14,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 40, 'precoUnitario', 2, 'kgPorUnidade', 1, 'kgTotal', 40, 'natureza', 'venda')),
         200.00, 140,
         case when current_date >= (date '2026-09-01' + 14) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('HIPER CARNES') and lower(l.nome) = lower('ARUANA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '9b32cf40-b05b-4159-83b4-c5e0498f55aa', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-01', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 200, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 500, 'natureza', 'venda')),
         600.00, 500,
         case when current_date >= (date '2026-09-01' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('ARUANA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '638294e1-a375-47cf-8b47-52bcc299e6ee', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-01', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 240, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 600, 'natureza', 'venda')),
         720.00, 600,
         case when current_date >= (date '2026-09-01' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('BARRA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'f90caf77-570c-4228-831d-b04f171707cc', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-01', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 60, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 150, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 25, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 25, 'natureza', 'venda')),
         270.00, 225,
         case when current_date >= (date '2026-09-01' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('P.CAJU')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '2fbbf001-4279-4c84-864b-0ce388550828', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-01', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 40, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 40, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 20, 'precoUnitario', 1.8, 'kgPorUnidade', 1, 'kgTotal', 20, 'natureza', 'venda')),
         84.00, 60,
         case when current_date >= (date '2026-09-01' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('BARRA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '7dee3ed7-2560-44b1-8401-e0471c0b32b6', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-01', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 150, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 150, 'natureza', 'venda')),
         180.00, 150,
         case when current_date >= (date '2026-09-01' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('DISTRITO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'a2c22ad6-d9fd-403a-81f6-671e644fa320', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-01', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         60.00, 50,
         case when current_date >= (date '2026-09-01' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('ECO POSTO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '0e38d8f5-727f-4620-8e82-79d37fee8b68', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-01', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 60, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 60, 'natureza', 'venda')),
         72.00, 60,
         case when current_date >= (date '2026-09-01' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('F.PORTO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'b51cfe2c-d555-404a-8920-17056c81368e', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-01', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 150, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 150, 'natureza', 'venda')),
         180.00, 150,
         case when current_date >= (date '2026-09-01' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('FAROLANDIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '7c2022a6-4d3d-44f7-845b-5360043253e9', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-01', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-01' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('SILVA SUPERMERCADO') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '02e4ff61-fb7e-4636-88e6-45ea24f26554', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-01', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 400, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 400, 'natureza', 'venda')),
         400.00, 400,
         case when current_date >= (date '2026-09-01' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('TABAJARA') and lower(l.nome) = lower('SOLEDADE')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'a27f3702-d742-4328-86e1-5e51d71e8e13', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-02', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 1000, 'precoUnitario', 1.15, 'kgPorUnidade', 1, 'kgTotal', 1000, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000003', 'qty', 70, 'precoUnitario', 3.45, 'kgPorUnidade', 3, 'kgTotal', 210, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 18, 'precoUnitario', 4.39, 'kgPorUnidade', 1, 'kgTotal', 18, 'natureza', 'venda')),
         1470.52, 1228,
         case when current_date >= (date '2026-09-02' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('CD')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '3c6d1ee0-3937-40fe-8a43-cce4757e39a0', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-02', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 40, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 100, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 80, 'precoUnitario', 2, 'kgPorUnidade', 1, 'kgTotal', 80, 'natureza', 'venda')),
         280.00, 180,
         case when current_date >= (date '2026-09-02' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BOMBOM') and lower(l.nome) = lower('ARACAJU')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'd17cb495-d053-43c3-8f8b-79fec7b19ec6', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-02', 15,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 250, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 250, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 90, 'precoUnitario', 2.5, 'kgPorUnidade', 2.5, 'kgTotal', 225, 'natureza', 'venda')),
         475.00, 475,
         case when current_date >= (date '2026-09-02' + 15) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BRAUNA') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'fd9f703e-91c8-4898-85fd-643f6ac964fd', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-02', 28,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-02' + 28) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('J.PEIXOTO') and lower(l.nome) = lower('PIABETA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'b80c67e5-48fe-4f47-8d88-96823ba67c26', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-02', 7,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000005', 'qty', 30, 'precoUnitario', 14, 'kgPorUnidade', 10, 'kgTotal', 300, 'natureza', 'venda')),
         420.00, 300,
         case when current_date >= (date '2026-09-02' + 7) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PANDELLI') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '7153a502-933e-474a-8773-24db35aedc02', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-02', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 50, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 125, 'natureza', 'venda')),
         150.00, 125,
         case when current_date >= (date '2026-09-02' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('GAZOL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '37c38648-f675-4b95-89ce-519020259465', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-02', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 40, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-02' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('PRAIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '398b0e7f-9963-411d-8468-925cc7dd3773', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-02', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 200, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 200, 'natureza', 'venda')),
         200.00, 200,
         case when current_date >= (date '2026-09-02' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('BARRA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '9d65e671-da60-4fb0-83d5-e708592e3055', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-02', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 300, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 300, 'natureza', 'venda')),
         300.00, 300,
         case when current_date >= (date '2026-09-02' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('DISTRITO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '85492584-4719-4eeb-8f49-f0f33b0f5bfe', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-02', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         100.00, 100,
         case when current_date >= (date '2026-09-02' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('ECO POSTO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'b3aa5b4a-5b19-41e6-864d-32c1f59ec6a1', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-02', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 200, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 200, 'natureza', 'venda')),
         200.00, 200,
         case when current_date >= (date '2026-09-02' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('F.PORTO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '30ec37a7-161b-42eb-8703-56063661c8b8', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-02', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 400, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 400, 'natureza', 'venda')),
         400.00, 400,
         case when current_date >= (date '2026-09-02' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('FAROLANDIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '65a274d7-61f3-476f-8681-e588d08989ce', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-02', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         100.00, 100,
         case when current_date >= (date '2026-09-02' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('MEGA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '9c7ff486-f70e-4a79-8639-5478e97510d5', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-02', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 200, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 200, 'natureza', 'venda')),
         200.00, 200,
         case when current_date >= (date '2026-09-02' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('TANCREDO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '0d9b6250-a3cf-40df-8a1f-2ce608ad5e89', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-02', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 400, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 400, 'natureza', 'venda')),
         400.00, 400,
         case when current_date >= (date '2026-09-02' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('TABAJARA') and lower(l.nome) = lower('SOLEDADE')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'f27bdfcc-5dda-4a22-8210-8d76da33bd5d', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-03', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 300, 'precoUnitario', 1.1, 'kgPorUnidade', 1, 'kgTotal', 300, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 40, 'precoUnitario', 2.75, 'kgPorUnidade', 2.5, 'kgTotal', 100, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 50, 'precoUnitario', 2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         540.00, 450,
         case when current_date >= (date '2026-09-03' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BOMBOM') and lower(l.nome) = lower('ARACAJU')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '9c4ec05c-b002-4230-82e8-fac6fb9eb371', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-03', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 650, 'precoUnitario', 1.1, 'kgPorUnidade', 1, 'kgTotal', 650, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 150, 'precoUnitario', 2.75, 'kgPorUnidade', 2.5, 'kgTotal', 375, 'natureza', 'venda')),
         1127.50, 1025,
         case when current_date >= (date '2026-09-03' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BOMBOM') and lower(l.nome) = lower('ESTANCIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '0e0581b1-41c3-4709-8ad8-1613649e1b1c', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-03', 15,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 80, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 200, 'natureza', 'venda')),
         240.00, 200,
         case when current_date >= (date '2026-09-03' + 15) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BRAUNA') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'bee11d17-8a85-4c14-80c5-4e7a3f0a585b', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-03', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 200, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 200, 'natureza', 'venda')),
         240.00, 200,
         case when current_date >= (date '2026-09-03' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BRAUNA') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '0af58884-fe96-429c-8e41-5c68795a7bb6', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-03', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 250, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 250, 'natureza', 'venda')),
         300.00, 250,
         case when current_date >= (date '2026-09-03' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('FASOUTO') and lower(l.nome) = lower('INDUSTRIAL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '56673fa3-b17d-420f-8ad5-63b1c1e3d79b', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-03', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 200, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 200, 'natureza', 'venda')),
         240.00, 200,
         case when current_date >= (date '2026-09-03' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('FASOUTO') and lower(l.nome) = lower('SOCORRO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '7b142a4a-5dd4-4d19-8d95-e6b9b1929246', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-03', 15,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000005', 'qty', 20, 'precoUnitario', 12, 'kgPorUnidade', 10, 'kgTotal', 200, 'natureza', 'venda')),
         240.00, 200,
         case when current_date >= (date '2026-09-03' + 15) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('HOTEL AQUARIUS') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'b1e8e3e9-4183-4b50-89bb-313f0d8a6b2d', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-03', 7,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 800, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 800, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 150, 'precoUnitario', 1.5, 'kgPorUnidade', 1, 'kgTotal', 150, 'natureza', 'venda')),
         1025.00, 950,
         case when current_date >= (date '2026-09-03' + 7) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('NUNES PEIXOTO') and lower(l.nome) = lower('GLORIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'bc8e87ea-b9ae-4045-8b79-1344280c7fb2', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-03', 7,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 1800, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 1800, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 100, 'precoUnitario', 2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 150, 'precoUnitario', 1.5, 'kgPorUnidade', 1, 'kgTotal', 150, 'natureza', 'venda')),
         2225.00, 2050,
         case when current_date >= (date '2026-09-03' + 7) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('NUNES PEIXOTO') and lower(l.nome) = lower('ITABAIANA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '15a354a7-59ed-44f5-8309-5293822019e0', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-03', 15,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 40, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-03' + 15) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('ATALAIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '792ec5a5-97f4-458c-8ef9-5b75fabb6679', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-03', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 40, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 100, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 25, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 25, 'natureza', 'venda')),
         150.00, 125,
         case when current_date >= (date '2026-09-03' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('ATALAIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '841aee82-a2d1-47e3-8792-4c8da21f9dae', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-03', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 240, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 600, 'natureza', 'venda')),
         720.00, 600,
         case when current_date >= (date '2026-09-03' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('BARRA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'df6be50a-a20c-4de8-8caa-dbf1e0e9825e', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-03', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 20, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 50, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 125, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 125, 'natureza', 'venda')),
         210.00, 175,
         case when current_date >= (date '2026-09-03' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('BR')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '08a17752-05f6-464d-8d5c-3b3848be5667', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-03', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 60, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 150, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         240.00, 200,
         case when current_date >= (date '2026-09-03' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('P.CAJU')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '3859e247-e953-4273-8c4d-76011d8749ab', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-03', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 40, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-03' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('SANTA LUCIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '39bd7c78-2746-4a37-8d39-e8b2fa8a62d6', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-03', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 12, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 30, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         96.00, 80,
         case when current_date >= (date '2026-09-03' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('URQUIZA LEAL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '8edfdd6d-c08b-4b66-8485-4d71683cb074', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-03', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-03' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE ALPHA') and lower(l.nome) = lower('COROA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '06bf1f76-da24-44f1-841d-f0599f220829', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-03', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 25, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 25, 'natureza', 'venda')),
         30.00, 25,
         case when current_date >= (date '2026-09-03' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE ALPHA') and lower(l.nome) = lower('DETRAN')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '990536a4-0542-4930-84e6-dfe1df7dba42', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-03', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 350, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 350, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 100, 'precoUnitario', 1.8, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         530.00, 450,
         case when current_date >= (date '2026-09-03' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('TABAJARA') and lower(l.nome) = lower('SOLEDADE')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'a858b75e-abe3-4106-8cfa-9070581d40b2', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-03', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 20, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 20, 'natureza', 'venda')),
         24.00, 20,
         case when current_date >= (date '2026-09-03' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('VINICIUS') and lower(l.nome) = lower('ASTRO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'cf60cc4e-e303-4fc2-8740-2c0ba753ec2f', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-03', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 40, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 40, 'natureza', 'venda')),
         48.00, 40,
         case when current_date >= (date '2026-09-03' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('VINICIUS') and lower(l.nome) = lower('CHURRASCARIA PRAIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'b97e450d-a4bf-4ff2-8f54-0a0f9123f0b4', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-03', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-03' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('VINICIUS') and lower(l.nome) = lower('MERCADO TRABALHADOR')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'b3797be2-cb64-45f2-8161-e2a911d2c826', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-03', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 80, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 80, 'natureza', 'venda')),
         96.00, 80,
         case when current_date >= (date '2026-09-03' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('VINICIUS') and lower(l.nome) = lower('NORDESTAO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '9a6b672e-6bff-41be-838a-efa3d3ca0e49', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-04', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 2000, 'precoUnitario', 1.15, 'kgPorUnidade', 1, 'kgTotal', 2000, 'natureza', 'venda')),
         2300.00, 2000,
         case when current_date >= (date '2026-09-04' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('ADELIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '5f9a9929-9299-40c1-80ed-c29ce2de43e4', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-04', 28,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 70, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 70, 'natureza', 'venda')),
         84.00, 70,
         case when current_date >= (date '2026-09-04' + 28) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('J.PEIXOTO') and lower(l.nome) = lower('ARUANA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '7b108334-c35d-4b3c-89b5-bae7b9d7da62', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-04', 28,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 40, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 40, 'natureza', 'venda')),
         48.00, 40,
         case when current_date >= (date '2026-09-04' + 28) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('J.PEIXOTO') and lower(l.nome) = lower('PIABETA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '506b80e2-c276-4c3f-8b5d-98f809c42282', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-04', 28,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 130, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 130, 'natureza', 'venda')),
         156.00, 130,
         case when current_date >= (date '2026-09-04' + 28) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('J.PEIXOTO') and lower(l.nome) = lower('SAO BRAS')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'a761a171-9701-47ad-86b0-55762dc9b742', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-04', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 30, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 75, 'natureza', 'venda')),
         90.00, 75,
         case when current_date >= (date '2026-09-04' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('ORLA SOL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '0125c372-e044-4a79-821d-22266615fe72', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-04', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 20, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 50, 'natureza', 'venda')),
         60.00, 50,
         case when current_date >= (date '2026-09-04' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('TANCREDO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '762cd560-71af-447d-8e51-10a5adf73b0e', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-04', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 25, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 25, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 70, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 175, 'natureza', 'venda')),
         240.00, 200,
         case when current_date >= (date '2026-09-04' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('TREZE')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'fdbd5be1-8912-4704-8806-1f485aebd13e', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-04', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 120, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 120, 'natureza', 'venda')),
         144.00, 120,
         case when current_date >= (date '2026-09-04' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('SILVA SUPERMERCADO') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '81905742-2940-4be1-83c2-adcee324b2de', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-04', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 300, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 300, 'natureza', 'venda')),
         300.00, 300,
         case when current_date >= (date '2026-09-04' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('TABAJARA') and lower(l.nome) = lower('SOLEDADE')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '57325def-d114-4230-8c1a-20fa19618f50', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-05', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 18, 'precoUnitario', 4.39, 'kgPorUnidade', 1, 'kgTotal', 18, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 3100, 'precoUnitario', 1.15, 'kgPorUnidade', 1, 'kgTotal', 3100, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000003', 'qty', 270, 'precoUnitario', 3.45, 'kgPorUnidade', 3, 'kgTotal', 810, 'natureza', 'venda')),
         4575.52, 3928,
         case when current_date >= (date '2026-09-05' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('CD')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '40b439de-e29a-4df9-8ceb-01352391f608', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-05', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 1500, 'precoUnitario', 0.8, 'kgPorUnidade', 1, 'kgTotal', 1500, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 50, 'precoUnitario', 2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 60, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 150, 'natureza', 'venda')),
         1480.00, 1700,
         case when current_date >= (date '2026-09-05' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BOMBOM') and lower(l.nome) = lower('ARACAJU')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'a9ddc509-94ef-4cac-8531-53fd5502b2ce', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-05', 15,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 50, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 125, 'natureza', 'venda')),
         270.00, 225,
         case when current_date >= (date '2026-09-05' + 15) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BRAUNA') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'ca22cd7c-697d-4390-8ac6-77590f6216dc', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-05', 14,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-05' + 14) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('HIPER CARNES') and lower(l.nome) = lower('JABOTIANA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '071fb38f-966b-433d-8144-bd54f9366fa3', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-05', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 200, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 500, 'natureza', 'venda')),
         600.00, 500,
         case when current_date >= (date '2026-09-05' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('ARUANA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'b4f7a720-3a1e-4ba7-8f94-3e26947ad91c', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-05', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 500, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 1250, 'natureza', 'venda')),
         1500.00, 1250,
         case when current_date >= (date '2026-09-05' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('BARRA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '288a1c8a-defc-4bac-842c-eb231a83522d', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-05', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 100, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 250, 'natureza', 'venda')),
         300.00, 250,
         case when current_date >= (date '2026-09-05' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('FAROL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '97b4e77f-4255-4f86-823e-8d080eb95e1a', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-05', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 16, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 40, 'natureza', 'venda')),
         48.00, 40,
         case when current_date >= (date '2026-09-05' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('MELICIO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '364304e6-5d37-487c-84c2-8d0af565369f', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-05', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 80, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 200, 'natureza', 'venda')),
         240.00, 200,
         case when current_date >= (date '2026-09-05' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('PRAIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '12b7577d-eb06-4e90-89cc-fbd6c6346932', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-05', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 350, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 350, 'natureza', 'venda')),
         350.00, 350,
         case when current_date >= (date '2026-09-05' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('TABAJARA') and lower(l.nome) = lower('SOLEDADE')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '55897f38-9f53-47fb-8694-82102ad44e28', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-07', 15,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 35, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 87.5, 'natureza', 'venda')),
         105.00, 87.5,
         case when current_date >= (date '2026-09-07' + 15) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BRAUNA') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '150a5cab-f08a-43c1-870f-eeb7d5f1fde3', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-07', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 20, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 50, 'natureza', 'venda')),
         60.00, 50,
         case when current_date >= (date '2026-09-07' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('F.PORTO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'a403dc23-d6b3-4517-88e5-ddd50f701bd9', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-07', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 200, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 500, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 125, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 125, 'natureza', 'venda')),
         750.00, 625,
         case when current_date >= (date '2026-09-07' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('FAROL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '3093eb5d-f873-47fc-8fdd-c529032d9680', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-07', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 50, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 125, 'natureza', 'venda')),
         150.00, 125,
         case when current_date >= (date '2026-09-07' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('GAZOL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '26e870bf-05f6-4601-8d8f-04fe1219157c', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-07', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 30, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 75, 'natureza', 'venda')),
         90.00, 75,
         case when current_date >= (date '2026-09-07' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('ORLA SOL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '82a7c955-71dd-4c5d-868c-fc7d54656db4', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-07', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 70, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 175, 'natureza', 'venda')),
         210.00, 175,
         case when current_date >= (date '2026-09-07' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('PRAIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '0bf1ede8-60a2-479d-83b5-66a17c82d6a1', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-07', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 50, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 125, 'natureza', 'venda')),
         150.00, 125,
         case when current_date >= (date '2026-09-07' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('SANTA LUCIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'ee4e0316-ddcb-45ba-8fec-eb1f6726025a', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-08', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 5960, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 5960, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000003', 'qty', 70, 'precoUnitario', 3.45, 'kgPorUnidade', 3, 'kgTotal', 210, 'natureza', 'venda')),
         7393.50, 6170,
         case when current_date >= (date '2026-09-08' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('CD')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'c9dc1daf-8b54-4a5a-8965-3b837d1e1c72', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-08', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 300, 'precoUnitario', 1.1, 'kgPorUnidade', 1, 'kgTotal', 300, 'natureza', 'venda')),
         330.00, 300,
         case when current_date >= (date '2026-09-08' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BOMBOM') and lower(l.nome) = lower('ARACAJU')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'cd3a4f2d-8c05-426a-8466-8dc76c15e332', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-08', 15,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 20, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 50, 'natureza', 'venda')),
         180.00, 150,
         case when current_date >= (date '2026-09-08' + 15) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BRAUNA') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '2bd4ae4d-bd06-4511-8631-dbcf125b9c06', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-08', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 250, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 250, 'natureza', 'venda')),
         250.00, 250,
         case when current_date >= (date '2026-09-08' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('FASOUTO') and lower(l.nome) = lower('INDUSTRIAL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'bddf4469-b715-44ff-857b-242665ad1236', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-08', 15,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 40, 'precoUnitario', 2, 'kgPorUnidade', 1, 'kgTotal', 40, 'natureza', 'venda')),
         80.00, 40,
         case when current_date >= (date '2026-09-08' + 15) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('HIPER CARNES') and lower(l.nome) = lower('ARUANA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'c2f8593e-f42b-440a-8abd-b2c48e7d6cf4', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-08', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-08' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('HIPER CARNES') and lower(l.nome) = lower('ARUANA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '1d4555a7-b4d3-499b-8909-793eef129dac', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-08', 15,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-08' + 15) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('HIPER CARNES') and lower(l.nome) = lower('JABOTIANA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'c8f5c2b0-fe09-4e99-8ebf-128b44b64692', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-08', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 40, 'precoUnitario', 2.5, 'kgPorUnidade', 2.5, 'kgTotal', 100, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 25, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 25, 'natureza', 'venda')),
         130.00, 125,
         case when current_date >= (date '2026-09-08' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('AEROPORTO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '30fa757f-2175-4b9e-899e-020e45f4007a', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-08', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 160, 'precoUnitario', 2.5, 'kgPorUnidade', 2.5, 'kgTotal', 400, 'natureza', 'venda')),
         400.00, 400,
         case when current_date >= (date '2026-09-08' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('ARUANA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '5eea8217-21b7-44a2-807d-236c4d8b875e', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-08', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 240, 'precoUnitario', 2.5, 'kgPorUnidade', 2.5, 'kgTotal', 600, 'natureza', 'venda')),
         600.00, 600,
         case when current_date >= (date '2026-09-08' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('BARRA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'deec2cb4-ffd6-4a57-8b91-4a9f4e69a7d7', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-08', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 24, 'precoUnitario', 2.5, 'kgPorUnidade', 2.5, 'kgTotal', 60, 'natureza', 'venda')),
         60.00, 60,
         case when current_date >= (date '2026-09-08' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('MELICIO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '7a9239d9-06c0-4300-84ae-181e2badfc76', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-08', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 60, 'precoUnitario', 2.5, 'kgPorUnidade', 2.5, 'kgTotal', 150, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 25, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 25, 'natureza', 'venda')),
         180.00, 175,
         case when current_date >= (date '2026-09-08' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('P.CAJU')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'd16770a9-a18d-4dc5-80b8-148a4e86f098', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-08', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 20, 'precoUnitario', 2.5, 'kgPorUnidade', 2.5, 'kgTotal', 50, 'natureza', 'venda')),
         50.00, 50,
         case when current_date >= (date '2026-09-08' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('TANCREDO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '30b71106-4cca-471a-8a05-8bbdf1f6809d', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-08', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 50, 'precoUnitario', 2.5, 'kgPorUnidade', 2.5, 'kgTotal', 125, 'natureza', 'venda')),
         125.00, 125,
         case when current_date >= (date '2026-09-08' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('TREZE')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'f411ea25-45cf-45bf-8741-f8f52b273d35', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-08', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 25, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 25, 'natureza', 'venda')),
         30.00, 25,
         case when current_date >= (date '2026-09-08' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE ALPHA') and lower(l.nome) = lower('COROA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '368ae2ec-755b-4843-807f-8ef041b628a5', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-08', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 25, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 25, 'natureza', 'venda')),
         30.00, 25,
         case when current_date >= (date '2026-09-08' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE ALPHA') and lower(l.nome) = lower('DETRAN')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '9686589f-b10c-419a-8be0-b90d3e291f53', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-08', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 50, 'precoUnitario', 1.8, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         210.00, 150,
         case when current_date >= (date '2026-09-08' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('BARRA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '55d00851-b7f4-4440-8ef6-90ac47a62587', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-08', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-08' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('MEGA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'a4dc4c9f-deb4-4a4b-81a9-2b126b8b2b63', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-08', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 300, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 300, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 150, 'precoUnitario', 1.8, 'kgPorUnidade', 1, 'kgTotal', 150, 'natureza', 'venda')),
         570.00, 450,
         case when current_date >= (date '2026-09-08' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('TABAJARA') and lower(l.nome) = lower('SOLEDADE')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '51dace15-1f8c-4f02-820a-979ddde2fc6e', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-09', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 2660, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 2660, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000003', 'qty', 60, 'precoUnitario', 3.6, 'kgPorUnidade', 3, 'kgTotal', 180, 'natureza', 'venda')),
         3408.00, 2840,
         case when current_date >= (date '2026-09-09' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('CD')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'ddfea9ec-9f16-4fce-82b6-5026f506de6a', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-09', 15,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 200, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 200, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 100, 'precoUnitario', 1.5, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 80, 'precoUnitario', 2.5, 'kgPorUnidade', 2.5, 'kgTotal', 200, 'natureza', 'venda')),
         550.00, 500,
         case when current_date >= (date '2026-09-09' + 15) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BRAUNA') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'bc767b82-63fd-4d82-855b-9fc15c5db39e', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-09', 14,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 300, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 300, 'natureza', 'venda')),
         360.00, 300,
         case when current_date >= (date '2026-09-09' + 14) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('HIPER CARNES') and lower(l.nome) = lower('ARUANA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'fdd7511c-0d63-4bd1-8bfb-b935fef0ced1', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-09', 14,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 150, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 150, 'natureza', 'venda')),
         180.00, 150,
         case when current_date >= (date '2026-09-09' + 14) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('J.PEIXOTO') and lower(l.nome) = lower('ARUANA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'c745917a-b457-4e05-842b-993de9a99d63', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-09', 14,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 60, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 60, 'natureza', 'venda')),
         72.00, 60,
         case when current_date >= (date '2026-09-09' + 14) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('J.PEIXOTO') and lower(l.nome) = lower('PIABETA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'cfed9a23-069e-4509-8e9d-2eae8c5d4112', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-09', 14,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 200, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 200, 'natureza', 'venda')),
         240.00, 200,
         case when current_date >= (date '2026-09-09' + 14) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('J.PEIXOTO') and lower(l.nome) = lower('SAO BRAS')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'ede3bb41-368c-4da2-85a8-8ae53e52ddba', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-09', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 500, 'precoUnitario', 0, 'kgPorUnidade', 1, 'kgTotal', 500, 'natureza', 'venda')),
         0.00, 500,
         case when current_date >= (date '2026-09-09' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('MIX MATEUS') and lower(l.nome) = lower('ASWALDO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '6a0564df-346b-4268-87aa-0ace51164571', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-09', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 500, 'precoUnitario', 0, 'kgPorUnidade', 1, 'kgTotal', 500, 'natureza', 'venda')),
         0.00, 500,
         case when current_date >= (date '2026-09-09' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('MIX MATEUS') and lower(l.nome) = lower('GLORIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'd773763e-a52e-4bfe-8659-c8bc87d1ae3e', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-09', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 500, 'precoUnitario', 0, 'kgPorUnidade', 1, 'kgTotal', 500, 'natureza', 'venda')),
         0.00, 500,
         case when current_date >= (date '2026-09-09' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('MIX MATEUS') and lower(l.nome) = lower('INDUSTRIAL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'f680137d-af9b-41f0-885a-31fd397fe08d', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-09', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 40, 'precoUnitario', 2.5, 'kgPorUnidade', 2.5, 'kgTotal', 100, 'natureza', 'venda')),
         100.00, 100,
         case when current_date >= (date '2026-09-09' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('ATALAIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '99daea50-d262-407a-85a7-78acee542572', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-09', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 15, 'precoUnitario', 2.5, 'kgPorUnidade', 2.5, 'kgTotal', 37.5, 'natureza', 'venda')),
         157.50, 137.5,
         case when current_date >= (date '2026-09-09' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('BR')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'd607656d-a1a1-49cb-8c5a-da47f64317cc', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-09', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 50, 'precoUnitario', 2.5, 'kgPorUnidade', 2.5, 'kgTotal', 125, 'natureza', 'venda')),
         125.00, 125,
         case when current_date >= (date '2026-09-09' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('SANTA LUCIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'b67a59c2-66e1-4b2d-84ac-4a83d823c9fd', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-09', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 30, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 30, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 50, 'precoUnitario', 1.8, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         126.00, 80,
         case when current_date >= (date '2026-09-09' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('F.PORTO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '21815110-275a-4e8c-8579-c3a31aceef12', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-09', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 30, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 30, 'natureza', 'venda')),
         36.00, 30,
         case when current_date >= (date '2026-09-09' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('FAROLANDIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '976d838c-de1d-4f07-86ed-3087a0c3a259', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-09', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 180, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 180, 'natureza', 'venda')),
         216.00, 180,
         case when current_date >= (date '2026-09-09' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('SUPERMERCADO DA PRAIA') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'a26f321e-b8d2-4434-856a-3aca9d493899', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-09', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 300, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 300, 'natureza', 'venda')),
         300.00, 300,
         case when current_date >= (date '2026-09-09' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('TABAJARA') and lower(l.nome) = lower('SOLEDADE')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '26ef5635-f371-4062-83ce-f47c015062ef', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-10', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 300, 'precoUnitario', 1.1, 'kgPorUnidade', 1, 'kgTotal', 300, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 20, 'precoUnitario', 2.75, 'kgPorUnidade', 2.5, 'kgTotal', 50, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 200, 'precoUnitario', 2, 'kgPorUnidade', 1, 'kgTotal', 200, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 30, 'precoUnitario', 2, 'kgPorUnidade', 1, 'kgTotal', 30, 'natureza', 'venda')),
         845.00, 580,
         case when current_date >= (date '2026-09-10' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BOMBOM') and lower(l.nome) = lower('ARACAJU')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'f8d033c9-bd81-4baa-89d4-50afdd1a3649', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-10', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 120, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 300, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 750, 'precoUnitario', 1.1, 'kgPorUnidade', 1, 'kgTotal', 750, 'natureza', 'venda')),
         1185.00, 1050,
         case when current_date >= (date '2026-09-10' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BOMBOM') and lower(l.nome) = lower('ESTANCIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'b2563f8c-a675-4997-8942-927dfa5bae39', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-10', 15,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 50, 'precoUnitario', 1.5, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 9, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 22.5, 'natureza', 'venda')),
         222.00, 172.5,
         case when current_date >= (date '2026-09-10' + 15) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BRAUNA') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '38ad5a5b-5a17-4dda-8832-ca14e5109f7d', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-10', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000005', 'qty', 10, 'precoUnitario', 12, 'kgPorUnidade', 10, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-10' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('HOTEL SAO MANUEL') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '3a1e9c5a-ca72-482e-8456-480b48b1a6f9', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-10', 7,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 800, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 800, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 100, 'precoUnitario', 1.5, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         950.00, 900,
         case when current_date >= (date '2026-09-10' + 7) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('NUNES PEIXOTO') and lower(l.nome) = lower('GLORIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '7ff03d80-66d5-44ee-8f2b-6ac32f0758e4', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-10', 7,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 1000, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 1000, 'natureza', 'venda')),
         1000.00, 1000,
         case when current_date >= (date '2026-09-10' + 7) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('NUNES PEIXOTO') and lower(l.nome) = lower('ITABAIANA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '8ef595ea-2136-414f-80e8-df4dcf3a5d40', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-10', 7,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000005', 'qty', 30, 'precoUnitario', 14, 'kgPorUnidade', 10, 'kgTotal', 300, 'natureza', 'venda')),
         420.00, 300,
         case when current_date >= (date '2026-09-10' + 7) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PANDELLI') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '546a52e0-cbb6-48b5-833f-d71744ae8778', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-10', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 50, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 125, 'natureza', 'venda')),
         150.00, 125,
         case when current_date >= (date '2026-09-10' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('GAZOL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '520d086d-3d58-42bb-8350-9763736129ca', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-10', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         60.00, 50,
         case when current_date >= (date '2026-09-10' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE ALPHA') and lower(l.nome) = lower('COROA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'e6d2ec5e-3feb-4f0e-8465-6ecff2d000ea', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-10', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 70, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 70, 'natureza', 'venda')),
         84.00, 70,
         case when current_date >= (date '2026-09-10' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('BARRA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '1f2b6011-7e8c-44da-8633-3f454c93c07f', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-10', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         60.00, 50,
         case when current_date >= (date '2026-09-10' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('TANCREDO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'fac72015-f722-4083-8fab-98c12697092d', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-10', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 350, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 350, 'natureza', 'venda')),
         350.00, 350,
         case when current_date >= (date '2026-09-10' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('TABAJARA') and lower(l.nome) = lower('SOLEDADE')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '699d8a83-4b72-4976-8968-7d56dc1cdc86', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-10', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 20, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 20, 'natureza', 'venda')),
         24.00, 20,
         case when current_date >= (date '2026-09-10' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('VINICIUS') and lower(l.nome) = lower('ASTRO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '3924e4bf-1ba4-4460-8a37-bd822b253bec', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-10', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 40, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 40, 'natureza', 'venda')),
         48.00, 40,
         case when current_date >= (date '2026-09-10' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('VINICIUS') and lower(l.nome) = lower('CHURRASCARIA PRAIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '744f4714-d8bd-4557-81ff-69c9a096794c', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-10', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-10' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('VINICIUS') and lower(l.nome) = lower('MERCADO TRABALHADOR')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '26bf993f-d0e2-4852-8ff9-e729f09a7ad8', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-10', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 80, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 80, 'natureza', 'venda')),
         96.00, 80,
         case when current_date >= (date '2026-09-10' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('VINICIUS') and lower(l.nome) = lower('NORDESTAO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '6292508a-6d11-49cc-85b3-bc5b90faa794', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-11', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000003', 'qty', 20, 'precoUnitario', 4.05, 'kgPorUnidade', 3, 'kgTotal', 60, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 3320, 'precoUnitario', 1.35, 'kgPorUnidade', 1, 'kgTotal', 3320, 'natureza', 'venda')),
         4563.00, 3380,
         case when current_date >= (date '2026-09-11' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('CD')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '610e1be7-f24d-44a9-8c24-0471159f3b51', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-11', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 500, 'precoUnitario', 0.9, 'kgPorUnidade', 1, 'kgTotal', 500, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 25, 'precoUnitario', 2.5, 'kgPorUnidade', 1, 'kgTotal', 25, 'natureza', 'venda')),
         512.50, 525,
         case when current_date >= (date '2026-09-11' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BOMBOM') and lower(l.nome) = lower('ARACAJU')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '1bad83f3-0332-45fe-85bf-a00abcaf13d3', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-11', 15,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000005', 'qty', 20, 'precoUnitario', 12, 'kgPorUnidade', 10, 'kgTotal', 200, 'natureza', 'venda')),
         240.00, 200,
         case when current_date >= (date '2026-09-11' + 15) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('HOTEL AQUARIUS') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '4bbd2951-3ca6-4f07-81a5-b4d751b41e1a', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-11', 28,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-11' + 28) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('J.PEIXOTO') and lower(l.nome) = lower('ARUANA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '22b5d84f-66de-4b1a-8766-30c983554b25', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-11', 28,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 100, 'precoUnitario', 1.9, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         190.00, 100,
         case when current_date >= (date '2026-09-11' + 28) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('J.PEIXOTO') and lower(l.nome) = lower('SAO BRAS')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'b91ff210-f4ae-42bc-8e8d-cd6b62e28ef5', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-11', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 28000, 'precoUnitario', 1.35, 'kgPorUnidade', 1, 'kgTotal', 28000, 'natureza', 'venda')),
         37800.00, 28000,
         case when current_date >= (date '2026-09-11' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('MIX MATEUS') and lower(l.nome) = lower('FEIRA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '51192b34-347e-43e1-88bc-96bde6dbd1d4', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-11', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 240, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 600, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 25, 'precoUnitario', 3, 'kgPorUnidade', 1, 'kgTotal', 25, 'natureza', 'venda')),
         795.00, 625,
         case when current_date >= (date '2026-09-11' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('ARUANA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '967ffdc2-de2c-4e8d-8d3f-17e54d641990', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-11', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 40, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-11' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('ATALAIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '6540e749-f7d4-43bc-8cbe-fb5326a9c6cc', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-11', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 20, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 50, 'natureza', 'venda')),
         60.00, 50,
         case when current_date >= (date '2026-09-11' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('F.PORTO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'f03090d5-2035-4029-8128-451fc3ca422a', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-11', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 130, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 130, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 150, 'precoUnitario', 1.2, 'kgPorUnidade', 2.5, 'kgTotal', 375, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 50, 'precoUnitario', 4, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         536.00, 555,
         case when current_date >= (date '2026-09-11' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('FAROL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '6034e218-6c78-4820-8441-352eff39a4a6', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-11', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 30, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 75, 'natureza', 'venda')),
         90.00, 75,
         case when current_date >= (date '2026-09-11' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('ORLA SOL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '98a955eb-5de0-43e1-8adb-192ebe2b6129', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-11', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 100, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 250, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 10, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 10, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 15, 'precoUnitario', 4, 'kgPorUnidade', 1, 'kgTotal', 15, 'natureza', 'venda')),
         372.00, 275,
         case when current_date >= (date '2026-09-11' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('P.CAJU')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '725e04e1-1343-4759-8855-ca9f42fb7663', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-11', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 70, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 175, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 25, 'precoUnitario', 4, 'kgPorUnidade', 1, 'kgTotal', 25, 'natureza', 'venda')),
         310.00, 200,
         case when current_date >= (date '2026-09-11' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('PRAIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '6481603c-71d1-42df-8c54-4f6b6ad6d6f6', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-11', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 20, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 50, 'natureza', 'venda')),
         60.00, 50,
         case when current_date >= (date '2026-09-11' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('TANCREDO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'fb28eecc-b5cb-45d3-8017-4b83a654ed39', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-11', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 70, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 175, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         270.00, 225,
         case when current_date >= (date '2026-09-11' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('TREZE')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '9016f096-8b03-4765-8f9b-1e31f803d9d6', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-11', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-11' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('SILVA SUPERMERCADO') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '1ac218d5-31e0-43ce-8459-bbdda7c24e61', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-11', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 350, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 350, 'natureza', 'venda')),
         350.00, 350,
         case when current_date >= (date '2026-09-11' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('TABAJARA') and lower(l.nome) = lower('SOLEDADE')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'dfd76c85-4c2a-4644-821e-c064302baa5c', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-12', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 400, 'precoUnitario', 0.9, 'kgPorUnidade', 1, 'kgTotal', 400, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 30, 'precoUnitario', 2.75, 'kgPorUnidade', 2.5, 'kgTotal', 75, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 50, 'precoUnitario', 2.5, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         567.50, 525,
         case when current_date >= (date '2026-09-12' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BOMBOM') and lower(l.nome) = lower('ARACAJU')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '737f6274-0057-43c4-8361-abfe864fe305', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-12', 15,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 150, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 150, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 60, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 150, 'natureza', 'venda')),
         360.00, 300,
         case when current_date >= (date '2026-09-12' + 15) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BRAUNA') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'c203fd92-7e8d-4aae-8147-a57001ff4044', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-12', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 500, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 1250, 'natureza', 'venda')),
         1500.00, 1250,
         case when current_date >= (date '2026-09-12' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('BARRA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '52ec1a79-5d13-4c40-8cdd-31a775652bc6', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-12', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 40, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-12' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('MELICIO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '0b0267e2-457c-4ce1-8634-b196effc7d5e', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-12', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 50, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 125, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 20, 'precoUnitario', 4, 'kgPorUnidade', 1, 'kgTotal', 20, 'natureza', 'venda')),
         230.00, 145,
         case when current_date >= (date '2026-09-12' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('SANTA LUCIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '6df3809c-5b05-4f95-8992-3a71f3136a73', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-12', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 300, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 300, 'natureza', 'venda')),
         300.00, 300,
         case when current_date >= (date '2026-09-12' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('TABAJARA') and lower(l.nome) = lower('SOLEDADE')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'e415a485-ff82-407b-83eb-fe5c328abd19', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-14', 15,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 40, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-14' + 15) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BRAUNA') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '05b90930-ef1b-437f-8afa-feaf0043f11b', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-14', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000005', 'qty', 8, 'precoUnitario', 12, 'kgPorUnidade', 10, 'kgTotal', 80, 'natureza', 'venda')),
         96.00, 80,
         case when current_date >= (date '2026-09-14' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('HOTEL SAO MANUEL') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'e7c76ac6-14bc-4f69-813b-2754d73dfce7', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-14', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 1400, 'precoUnitario', 1.35, 'kgPorUnidade', 1, 'kgTotal', 1400, 'natureza', 'venda')),
         1890.00, 1400,
         case when current_date >= (date '2026-09-14' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('MIX MATEUS') and lower(l.nome) = lower('ASWALDO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '566173e6-7305-45fe-8bef-8b387bb8249b', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-14', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 600, 'precoUnitario', 1.35, 'kgPorUnidade', 1, 'kgTotal', 600, 'natureza', 'venda')),
         810.00, 600,
         case when current_date >= (date '2026-09-14' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('MIX MATEUS') and lower(l.nome) = lower('GLORIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'e60947c1-717c-446e-8fea-46def637dd0d', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-14', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 1700, 'precoUnitario', 1.35, 'kgPorUnidade', 1, 'kgTotal', 1700, 'natureza', 'venda')),
         2295.00, 1700,
         case when current_date >= (date '2026-09-14' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('MIX MATEUS') and lower(l.nome) = lower('INDUSTRIAL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '96bf7e4b-079a-4944-8629-c4d876d48320', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-14', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 40, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-14' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('ATALAIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '3d84a944-1a5d-41c1-8169-4997861dd4e1', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-14', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 150, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 150, 'natureza', 'venda')),
         180.00, 150,
         case when current_date >= (date '2026-09-14' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('BR')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '15a7f7a0-83c6-4b18-8b73-4d958454f192', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-14', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 20, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 50, 'natureza', 'venda')),
         60.00, 50,
         case when current_date >= (date '2026-09-14' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('F.PORTO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '1a9c5dc9-0e82-469c-8c45-d3b7e576eccd', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-14', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 60, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 150, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         240.00, 200,
         case when current_date >= (date '2026-09-14' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('P.CAJU')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '808b9f06-fe6c-4d7e-8ea0-5fe0b01e8d48', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-14', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 36.17, 'precoUnitario', 2.72, 'kgPorUnidade', 1, 'kgTotal', 36.17, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 389.83, 'precoUnitario', 1.18, 'kgPorUnidade', 1, 'kgTotal', 389.83, 'natureza', 'venda')),
         558.38, 426,
         case when current_date >= (date '2026-09-14' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PRIMAVERA') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'a88bf6a5-ce24-4fa4-8148-730957d7be4f', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-14', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         60.00, 50,
         case when current_date >= (date '2026-09-14' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('ECO POSTO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'f81a0a4d-44f4-4dd1-884d-6fb10b4e2fd6', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-14', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-14' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('SILVA SUPERMERCADO') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '371a4ce3-2df8-41b1-873f-ed09d589fe80', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-14', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 200, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 200, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 50, 'precoUnitario', 1.8, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         290.00, 250,
         case when current_date >= (date '2026-09-14' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('TABAJARA') and lower(l.nome) = lower('SOLEDADE')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '11be63fb-9486-477d-8606-d7ea7cfb96e8', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-14', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 2700, 'precoUnitario', 1.1, 'kgPorUnidade', 1, 'kgTotal', 2700, 'natureza', 'venda')),
         2970.00, 2700,
         case when current_date >= (date '2026-09-14' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('VICTOR') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '9e2a4b4d-72e4-4e7e-8165-f151b96151a5', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-15', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 2300, 'precoUnitario', 1.25, 'kgPorUnidade', 1, 'kgTotal', 2300, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000003', 'qty', 120, 'precoUnitario', 3.75, 'kgPorUnidade', 3, 'kgTotal', 360, 'natureza', 'venda')),
         3325.00, 2660,
         case when current_date >= (date '2026-09-15' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('CD')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '906d61aa-27f8-4b02-8ed7-5a1bae5323c6', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-15', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 300, 'precoUnitario', 1.1, 'kgPorUnidade', 1, 'kgTotal', 300, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 50, 'precoUnitario', 2.5, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 30, 'precoUnitario', 2.75, 'kgPorUnidade', 2.5, 'kgTotal', 75, 'natureza', 'venda')),
         537.50, 425,
         case when current_date >= (date '2026-09-15' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BOMBOM') and lower(l.nome) = lower('ARACAJU')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'ba086adf-4771-4cca-89c0-b6f0f87f641b', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-15', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 250, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 250, 'natureza', 'venda')),
         300.00, 250,
         case when current_date >= (date '2026-09-15' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('FASOUTO') and lower(l.nome) = lower('INDUSTRIAL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '63b8bb9c-929f-4273-85b4-5ca887506578', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-15', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 160, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 400, 'natureza', 'venda')),
         480.00, 400,
         case when current_date >= (date '2026-09-15' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('ARUANA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '576be74c-24a9-442a-8f87-ffd63a091cb6', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-15', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 20, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 50, 'natureza', 'venda')),
         60.00, 50,
         case when current_date >= (date '2026-09-15' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('BR')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'ca379d20-0430-45e6-825b-f44c87057098', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-15', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 70, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 175, 'natureza', 'venda')),
         210.00, 175,
         case when current_date >= (date '2026-09-15' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('FAROL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'e79883db-6117-439f-877b-26ce4da98c9a', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-15', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 50, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 125, 'natureza', 'venda')),
         150.00, 125,
         case when current_date >= (date '2026-09-15' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('SANTA LUCIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '610fed26-0e44-45bc-8f14-1ab0d8367eb7', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-15', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 12, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 30, 'natureza', 'venda')),
         96.00, 80,
         case when current_date >= (date '2026-09-15' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('URQUIZA LEAL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '1f880e79-935e-485a-81db-8547588e8899', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-15', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 25, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 25, 'natureza', 'venda')),
         30.00, 25,
         case when current_date >= (date '2026-09-15' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE ALPHA') and lower(l.nome) = lower('DETRAN')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '487bb542-e679-4dd1-830d-0ee7ae9419ca', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-15', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 80, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 80, 'natureza', 'venda')),
         96.00, 80,
         case when current_date >= (date '2026-09-15' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('BARRA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '10f33e97-f367-48d1-85c4-c9f81aaa6368', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-15', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 250, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 250, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 45, 'precoUnitario', 1.8, 'kgPorUnidade', 1, 'kgTotal', 45, 'natureza', 'venda')),
         381.00, 295,
         case when current_date >= (date '2026-09-15' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('DISTRITO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '55f8d8f6-1fc1-4b2c-85ac-dccbce2cf6e2', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-15', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 60, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 60, 'natureza', 'venda')),
         72.00, 60,
         case when current_date >= (date '2026-09-15' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('F.PORTO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'ba211030-dfbd-4dd2-8b13-723fd01a1c15', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-15', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 80, 'precoUnitario', 1.8, 'kgPorUnidade', 1, 'kgTotal', 80, 'natureza', 'venda')),
         144.00, 80,
         case when current_date >= (date '2026-09-15' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('F.PORTO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '509acff2-e22a-4b9c-8972-21d208227109', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-15', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 200, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 200, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 100, 'precoUnitario', 1.8, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         420.00, 300,
         case when current_date >= (date '2026-09-15' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('FAROLANDIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'adced630-5b83-4fdd-8348-a0d314fe397e', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-15', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         60.00, 50,
         case when current_date >= (date '2026-09-15' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('TANCREDO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '6dc3b67c-d9d7-42bb-8efd-601dc5b3bc7a', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-15', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 150, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 150, 'natureza', 'venda')),
         150.00, 150,
         case when current_date >= (date '2026-09-15' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('TABAJARA') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '82650a7e-b2dd-4eaf-8ce5-e360e8f40ca4', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-16', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 640, 'precoUnitario', 1.25, 'kgPorUnidade', 1, 'kgTotal', 640, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000003', 'qty', 90, 'precoUnitario', 3.75, 'kgPorUnidade', 3, 'kgTotal', 270, 'natureza', 'venda')),
         1137.50, 910,
         case when current_date >= (date '2026-09-16' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('CD')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '7d56c944-a2c5-4363-8d39-5d3bed1b8b3c', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-16', 15,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 400, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 400, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 20, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 50, 'natureza', 'venda')),
         540.00, 450,
         case when current_date >= (date '2026-09-16' + 15) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BRAUNA') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'e280acb1-747f-4ae5-8985-5b4ad06a9008', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-16', 14,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 40, 'precoUnitario', 2, 'kgPorUnidade', 1, 'kgTotal', 40, 'natureza', 'venda')),
         200.00, 140,
         case when current_date >= (date '2026-09-16' + 14) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('HIPER CARNES') and lower(l.nome) = lower('ARUANA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '9d8b8b06-0f87-40a5-8a4f-9354c99cd47b', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-16', 28,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-16' + 28) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('J.PEIXOTO') and lower(l.nome) = lower('ARUANA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '9f921e97-2fd0-442c-8cf2-d7ae8601c7cd', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-16', 28,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         60.00, 50,
         case when current_date >= (date '2026-09-16' + 28) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('J.PEIXOTO') and lower(l.nome) = lower('PIABETA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '7d02f2c7-b4ba-4653-8fa9-0898502eea2a', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-16', 28,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 200, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 200, 'natureza', 'venda')),
         240.00, 200,
         case when current_date >= (date '2026-09-16' + 28) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('J.PEIXOTO') and lower(l.nome) = lower('SAO BRAS')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '45610fbe-db0c-44dd-8f37-65a72e481a35', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-16', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 25, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 25, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 40, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 100, 'natureza', 'venda')),
         150.00, 125,
         case when current_date >= (date '2026-09-16' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('AEROPORTO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '4e387aba-c952-4db2-8f60-5794dfa4a57d', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-16', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 200, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 500, 'natureza', 'venda')),
         600.00, 500,
         case when current_date >= (date '2026-09-16' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('BARRA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'da9b2f71-e8d8-429b-8e09-8ebd7e85a5a7', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-16', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 40, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-16' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('GAZOL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '2cda3506-f87a-4c0d-85e6-be7e6d99ad84', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-16', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 20, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 50, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 40, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 40, 'natureza', 'venda')),
         108.00, 90,
         case when current_date >= (date '2026-09-16' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('ORLA SOL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'f0e6fcd0-9136-4458-808e-92565aba6a73', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-16', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 20, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 50, 'natureza', 'venda')),
         60.00, 50,
         case when current_date >= (date '2026-09-16' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('TANCREDO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '816d95f7-dfd0-44de-8d6f-db61af6f9a6d', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-16', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 50, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 125, 'natureza', 'venda')),
         150.00, 125,
         case when current_date >= (date '2026-09-16' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('TREZE')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'fa62ec2d-2af3-48d6-8d59-be3b57a48e4e', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-16', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 10, 'precoUnitario', 1.8, 'kgPorUnidade', 1, 'kgTotal', 10, 'natureza', 'venda')),
         138.00, 110,
         case when current_date >= (date '2026-09-16' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('MEGA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'e26a0a23-07f6-4c32-8a20-baacc80b4842', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-16', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 200, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 200, 'natureza', 'venda')),
         200.00, 200,
         case when current_date >= (date '2026-09-16' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('TABAJARA') and lower(l.nome) = lower('SOLEDADE')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'f938a775-c915-4af3-8ac0-fb039fe6fc45', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-16', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 3000, 'precoUnitario', 1.1, 'kgPorUnidade', 1, 'kgTotal', 3000, 'natureza', 'venda')),
         3300.00, 3000,
         case when current_date >= (date '2026-09-16' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('VICTOR') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'cdf63d71-e110-45b0-89e5-8e843b09dc33', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-17', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 250, 'precoUnitario', 1.1, 'kgPorUnidade', 1, 'kgTotal', 250, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 16, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 40, 'natureza', 'venda')),
         323.00, 290,
         case when current_date >= (date '2026-09-17' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BOMBOM') and lower(l.nome) = lower('ARACAJU')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '6964642e-f17f-4d0d-8f04-f7e6ebd2be35', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-17', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 500, 'precoUnitario', 1.1, 'kgPorUnidade', 1, 'kgTotal', 500, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 50, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 125, 'natureza', 'venda')),
         700.00, 625,
         case when current_date >= (date '2026-09-17' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BOMBOM') and lower(l.nome) = lower('ESTANCIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '29fddb4a-351d-484b-8a00-3abc99f4b292', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-17', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000005', 'qty', 12, 'precoUnitario', 12, 'kgPorUnidade', 10, 'kgTotal', 120, 'natureza', 'venda')),
         144.00, 120,
         case when current_date >= (date '2026-09-17' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('HOTEL SAO MANUEL') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '94e358ff-4622-47c1-8168-23b3653f0afc', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-17', 7,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000005', 'qty', 30, 'precoUnitario', 14, 'kgPorUnidade', 10, 'kgTotal', 300, 'natureza', 'venda')),
         420.00, 300,
         case when current_date >= (date '2026-09-17' + 7) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PANDELLI') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'a8ae936a-08c0-4a92-8127-85abaf46a6cc', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-17', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 100, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 250, 'natureza', 'venda')),
         300.00, 250,
         case when current_date >= (date '2026-09-17' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('FAROL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '9b13bc93-1fa3-46c5-8ee8-29106791351c', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-17', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 80, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 200, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 25, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 25, 'natureza', 'venda')),
         330.00, 275,
         case when current_date >= (date '2026-09-17' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('P.CAJU')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '146e0b9b-1828-4e2d-8f19-72546f67a9c9', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-17', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 100, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 250, 'natureza', 'venda')),
         300.00, 250,
         case when current_date >= (date '2026-09-17' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('PRAIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '9e24a83e-7f85-4187-8083-83333770b98b', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-17', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         60.00, 50,
         case when current_date >= (date '2026-09-17' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE ALPHA') and lower(l.nome) = lower('COROA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'af0f8309-7ba6-4667-87eb-16070d4dbbba', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-17', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 150, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 150, 'natureza', 'venda')),
         150.00, 150,
         case when current_date >= (date '2026-09-17' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('TABAJARA') and lower(l.nome) = lower('SOLEDADE')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'edf2565e-d1a8-4b08-8cbd-9cbec388632e', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-18', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 1000, 'precoUnitario', 1.25, 'kgPorUnidade', 1, 'kgTotal', 1000, 'natureza', 'venda')),
         1250.00, 1000,
         case when current_date >= (date '2026-09-18' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('GLORIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '8dbb4fe5-e628-4154-81cd-751670326246', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-18', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 1000, 'precoUnitario', 0.8, 'kgPorUnidade', 1, 'kgTotal', 1000, 'natureza', 'venda')),
         800.00, 1000,
         case when current_date >= (date '2026-09-18' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('ITABAIANA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '0a82ea67-6cb3-411a-808f-9665634964e1', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-18', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 20, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 50, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 50, 'precoUnitario', 2.5, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         185.00, 100,
         case when current_date >= (date '2026-09-18' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BOMBOM') and lower(l.nome) = lower('ARACAJU')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '90c13de9-62f2-45e0-88ff-e3e5546aa24b', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-18', 15,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000005', 'qty', 20, 'precoUnitario', 12, 'kgPorUnidade', 10, 'kgTotal', 200, 'natureza', 'venda')),
         240.00, 200,
         case when current_date >= (date '2026-09-18' + 15) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('HOTEL AQUARIUS') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'e63c7a95-4dd9-459d-8e09-d7f5c41c7b5f', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-18', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 485, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 1212.5, 'natureza', 'venda')),
         1455.00, 1212.5,
         case when current_date >= (date '2026-09-18' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('BARRA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'f0791941-0fc5-4bff-833b-2b2e658f5a19', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-18', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-18' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('BR')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'c4eaa75c-9a79-42a5-8d57-050037923f00', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-18', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 10, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 25, 'natureza', 'venda')),
         30.00, 25,
         case when current_date >= (date '2026-09-18' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('F.PORTO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'afdb5905-43d0-46f6-86ff-a8b7eb0e604d', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-18', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 75, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 75, 'natureza', 'venda')),
         90.00, 75,
         case when current_date >= (date '2026-09-18' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('FAROL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '8bb0ccba-57ad-4299-8b98-f08c713d8b04', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-18', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 50, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 125, 'natureza', 'venda')),
         150.00, 125,
         case when current_date >= (date '2026-09-18' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('SANTA LUCIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'a44422f2-6156-413a-8e5e-b73427fdf2fd', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-19', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 300, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 300, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 75, 'precoUnitario', 2.5, 'kgPorUnidade', 1, 'kgTotal', 75, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 10, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 25, 'natureza', 'venda')),
         517.50, 400,
         case when current_date >= (date '2026-09-19' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BOMBOM') and lower(l.nome) = lower('ARACAJU')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '263d6710-2251-4672-8d53-c98dd9aef5c0', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-19', 15,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 25, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 62.5, 'natureza', 'venda')),
         75.00, 62.5,
         case when current_date >= (date '2026-09-19' + 15) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BRAUNA') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'aa63ce11-95b8-4742-849d-b9655d0eac25', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-19', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 200, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 200, 'natureza', 'venda')),
         240.00, 200,
         case when current_date >= (date '2026-09-19' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('FASOUTO') and lower(l.nome) = lower('SOCORRO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'c2c1eb25-3753-4f78-8e19-11242e79e769', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-19', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 30, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 75, 'natureza', 'venda')),
         90.00, 75,
         case when current_date >= (date '2026-09-19' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('GAZOL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '71c30f8d-0855-464f-85b5-aa2a79ec4267', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-19', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 24, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 60, 'natureza', 'venda')),
         72.00, 60,
         case when current_date >= (date '2026-09-19' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('MELICIO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'e407609f-4efc-42d3-8501-ca6614f1f072', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-19', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 10, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 25, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 25, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 25, 'natureza', 'venda')),
         60.00, 50,
         case when current_date >= (date '2026-09-19' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('ORLA SOL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'fa430c9e-ba70-4e90-83b8-06efdd14cca9', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-19', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 1317, 'precoUnitario', 1.1, 'kgPorUnidade', 1, 'kgTotal', 1317, 'natureza', 'venda')),
         1448.70, 1317,
         case when current_date >= (date '2026-09-19' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('VICTOR') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'cc835396-eed8-47e9-8d75-5c8039a8b51c', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-19', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 20, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 20, 'natureza', 'venda')),
         24.00, 20,
         case when current_date >= (date '2026-09-19' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('VINICIUS') and lower(l.nome) = lower('ASTRO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'eda9061d-4015-4d13-8d7f-3f2706fd1263', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-19', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 40, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 40, 'natureza', 'venda')),
         48.00, 40,
         case when current_date >= (date '2026-09-19' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('VINICIUS') and lower(l.nome) = lower('CHURRASCARIA PRAIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '21315cde-d8b3-4e65-8066-45039eff687b', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-19', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-19' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('VINICIUS') and lower(l.nome) = lower('MERCADO TRABALHADOR')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '35c7cbb6-28c7-4952-89e4-01b4f67d6931', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-19', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 80, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 80, 'natureza', 'venda')),
         96.00, 80,
         case when current_date >= (date '2026-09-19' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('VINICIUS') and lower(l.nome) = lower('NORDESTAO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '4a746098-ac59-43f9-8713-8cb5a2dbd7a2', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-21', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 760, 'precoUnitario', 1.25, 'kgPorUnidade', 1, 'kgTotal', 760, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000003', 'qty', 40, 'precoUnitario', 3.75, 'kgPorUnidade', 3, 'kgTotal', 120, 'natureza', 'venda')),
         1100.00, 880,
         case when current_date >= (date '2026-09-21' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('ADELIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '1ac6b424-fd2f-4641-88c9-927ed28a5216', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-21', 14,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 40, 'precoUnitario', 2, 'kgPorUnidade', 1, 'kgTotal', 40, 'natureza', 'venda')),
         200.00, 140,
         case when current_date >= (date '2026-09-21' + 14) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('HIPER CARNES') and lower(l.nome) = lower('ARUANA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '0b95b339-d03b-4de1-8a2c-2a3d3e95d7fe', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-21', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000005', 'qty', 10, 'precoUnitario', 12, 'kgPorUnidade', 10, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-21' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('HOTEL SAO MANUEL') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '4967e295-de76-4bb4-8c61-07738c2d8448', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-21', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 1500, 'precoUnitario', 1.35, 'kgPorUnidade', 1, 'kgTotal', 1500, 'natureza', 'venda')),
         2025.00, 1500,
         case when current_date >= (date '2026-09-21' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('MIX MATEUS') and lower(l.nome) = lower('ASWALDO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'b3367b11-8114-4261-81f1-d1b8d13bdbe3', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-21', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 600, 'precoUnitario', 1.35, 'kgPorUnidade', 1, 'kgTotal', 600, 'natureza', 'venda')),
         810.00, 600,
         case when current_date >= (date '2026-09-21' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('MIX MATEUS') and lower(l.nome) = lower('GLORIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '4eb9325b-749e-4644-80e4-c6e953f6bbd0', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-21', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 1500, 'precoUnitario', 1.35, 'kgPorUnidade', 1, 'kgTotal', 1500, 'natureza', 'venda')),
         2025.00, 1500,
         case when current_date >= (date '2026-09-21' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('MIX MATEUS') and lower(l.nome) = lower('INDUSTRIAL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '549dad66-26a4-46f6-8708-901e93d2172d', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-21', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 25, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 25, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 40, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 100, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 10, 'precoUnitario', 4, 'kgPorUnidade', 1, 'kgTotal', 10, 'natureza', 'venda')),
         190.00, 135,
         case when current_date >= (date '2026-09-21' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('AEROPORTO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'a2d783f8-39d0-41b1-8db4-97c0fc6c2d23', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-21', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 200, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 500, 'natureza', 'venda')),
         600.00, 500,
         case when current_date >= (date '2026-09-21' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('ARUANA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '7b2db401-ab6c-4087-8f56-0d352727dad8', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-21', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 40, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 100, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 40, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 100, 'natureza', 'venda')),
         240.00, 200,
         case when current_date >= (date '2026-09-21' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('ATALAIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '82f457a2-5534-4d46-8846-7e6a4ea11349', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-21', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 100, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 250, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         360.00, 300,
         case when current_date >= (date '2026-09-21' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('FAROL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '6d913a65-db2b-45d0-8d3b-c0f14a37e8f0', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-21', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 40, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-21' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('GAZOL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'c7fbd184-30cc-4e9e-8738-04116016d588', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-21', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 5, 'precoUnitario', 4, 'kgPorUnidade', 1, 'kgTotal', 5, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 20, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 50, 'natureza', 'venda')),
         80.00, 55,
         case when current_date >= (date '2026-09-21' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('TANCREDO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '1ebf95d3-b422-4e83-8439-f9a44dd07e31', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-21', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         60.00, 50,
         case when current_date >= (date '2026-09-21' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE ALPHA') and lower(l.nome) = lower('COROA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '196981a4-7cb1-4380-8114-5b473b09ce24', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-21', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 25, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 25, 'natureza', 'venda')),
         30.00, 25,
         case when current_date >= (date '2026-09-21' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE ALPHA') and lower(l.nome) = lower('DETRAN')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'b46e0f19-695f-48c6-80c4-80877bf53498', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-21', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 10, 'precoUnitario', 3.5, 'kgPorUnidade', 1, 'kgTotal', 10, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         155.00, 110,
         case when current_date >= (date '2026-09-21' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('DISTRITO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '08ef72be-d435-4730-830e-7175b6006e80', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-21', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-21' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('F.PORTO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '295b7556-1a00-4361-8161-4b5f94652718', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-21', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 10, 'precoUnitario', 3.5, 'kgPorUnidade', 1, 'kgTotal', 10, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 150, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 150, 'natureza', 'venda')),
         215.00, 160,
         case when current_date >= (date '2026-09-21' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('FAROLANDIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '7aa29ca1-580b-4725-8e24-bde72a2f178e', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-21', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 10, 'precoUnitario', 3.5, 'kgPorUnidade', 1, 'kgTotal', 10, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         215.00, 160,
         case when current_date >= (date '2026-09-21' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('TANCREDO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '9fd9b370-c17f-4c6c-892f-236a880542eb', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-22', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 1960, 'precoUnitario', 1.25, 'kgPorUnidade', 1, 'kgTotal', 1960, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 108, 'precoUnitario', 3.9, 'kgPorUnidade', 1, 'kgTotal', 108, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000003', 'qty', 90, 'precoUnitario', 3.75, 'kgPorUnidade', 3, 'kgTotal', 270, 'natureza', 'venda')),
         3208.70, 2338,
         case when current_date >= (date '2026-09-22' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('CD')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'b1289e78-e383-470a-8307-0399bd0be44b', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-22', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 250, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 250, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 50, 'precoUnitario', 2.5, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 30, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 75, 'natureza', 'venda')),
         515.00, 375,
         case when current_date >= (date '2026-09-22' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BOMBOM') and lower(l.nome) = lower('ARACAJU')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '4a98c486-512e-461c-83d6-c2cdd3d283e4', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-22', 15,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 40, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 100, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 20, 'precoUnitario', 3, 'kgPorUnidade', 1, 'kgTotal', 20, 'natureza', 'venda')),
         180.00, 120,
         case when current_date >= (date '2026-09-22' + 15) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BRAUNA') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '8f29195e-9a01-43d4-863e-2be762aea80a', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-22', 14,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 40, 'precoUnitario', 2, 'kgPorUnidade', 1, 'kgTotal', 40, 'natureza', 'venda')),
         200.00, 140,
         case when current_date >= (date '2026-09-22' + 14) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('HIPER CARNES') and lower(l.nome) = lower('ARUANA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '7392a8d9-f210-4f13-8de4-cc8daac7d247', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-22', 28,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-22' + 28) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('J.PEIXOTO') and lower(l.nome) = lower('ARUANA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '4e96e1a6-5d94-4266-8a05-870cbaf04c35', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-22', 28,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         60.00, 50,
         case when current_date >= (date '2026-09-22' + 28) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('J.PEIXOTO') and lower(l.nome) = lower('PIABETA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '2dbc3376-8d29-4f18-8d2f-0ff9399c0937', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-22', 28,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-22' + 28) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('J.PEIXOTO') and lower(l.nome) = lower('SAO BRAS')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '1589ce42-f3b9-40dd-8c98-36114a3185e1', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-22', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 10, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 25, 'natureza', 'venda')),
         30.00, 25,
         case when current_date >= (date '2026-09-22' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('F.PORTO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '38649892-13ba-45bf-8796-ee172e32740d', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-22', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 100, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 250, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         360.00, 300,
         case when current_date >= (date '2026-09-22' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('FAROL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'babb32e1-2cf8-4985-8501-6a8962d14b2d', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-22', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 60, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 150, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 25, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 25, 'natureza', 'venda')),
         210.00, 175,
         case when current_date >= (date '2026-09-22' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('P.CAJU')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'adc7ada0-0a52-4221-874a-5ae6330c3552', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-22', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 20, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 50, 'natureza', 'venda')),
         60.00, 50,
         case when current_date >= (date '2026-09-22' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('PRAIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '9d37d03e-bd3d-4078-83f6-c718cd4e8303', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-22', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 50, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 125, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 25, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 25, 'natureza', 'venda')),
         180.00, 150,
         case when current_date >= (date '2026-09-22' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('TREZE')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'eb3c5a8c-a239-404e-8a36-01f473098e61', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-22', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 25, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 25, 'natureza', 'venda')),
         30.00, 25,
         case when current_date >= (date '2026-09-22' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE ALPHA') and lower(l.nome) = lower('DETRAN')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '5ca81ac0-71a0-4c61-869b-8f1162a75b00', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-22', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 5, 'precoUnitario', 3.5, 'kgPorUnidade', 1, 'kgTotal', 5, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         197.50, 155,
         case when current_date >= (date '2026-09-22' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('BARRA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '9a33a421-bdff-4d47-8b00-abdde5240225', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-22', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         60.00, 50,
         case when current_date >= (date '2026-09-22' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('ECO POSTO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '262f13be-7ad0-410c-881c-a25728f1ebea', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-22', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         180.00, 150,
         case when current_date >= (date '2026-09-22' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('F.PORTO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '55f6ebd3-a2a2-4e0c-83cb-2754d4250a69', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-22', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 5, 'precoUnitario', 3.5, 'kgPorUnidade', 1, 'kgTotal', 5, 'natureza', 'venda')),
         77.50, 55,
         case when current_date >= (date '2026-09-22' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('MEGA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'daff22cb-64c1-4e20-8029-c03e5ef95826', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-22', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000007', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 10, 'precoUnitario', 3.5, 'kgPorUnidade', 1, 'kgTotal', 10, 'natureza', 'venda')),
         215.00, 160,
         case when current_date >= (date '2026-09-22' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('TANCREDO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '722d19fe-9389-4c21-831e-4d46374da293', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-23', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 250, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 250, 'natureza', 'venda')),
         300.00, 250,
         case when current_date >= (date '2026-09-23' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('FASOUTO') and lower(l.nome) = lower('INDUSTRIAL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '0722d895-9962-4c87-85c4-b268e72d0bb3', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-23', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 40, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-23' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('SANTA LUCIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '54355394-7c27-4fdc-87a6-c56acbf3a9ae', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-24', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000003', 'qty', 78, 'precoUnitario', 3.75, 'kgPorUnidade', 3, 'kgTotal', 234, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 2220, 'precoUnitario', 1.25, 'kgPorUnidade', 1, 'kgTotal', 2220, 'natureza', 'venda')),
         3067.50, 2454,
         case when current_date >= (date '2026-09-24' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('CD')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '35a9bc90-6667-416c-8292-0a3f18899405', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-24', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 25, 'precoUnitario', 2.5, 'kgPorUnidade', 1, 'kgTotal', 25, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 200, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 200, 'natureza', 'venda')),
         262.50, 225,
         case when current_date >= (date '2026-09-24' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BOMBOM') and lower(l.nome) = lower('ARACAJU')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '145a51be-4459-4d81-8ad9-20bf4f118095', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-24', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 625, 'precoUnitario', 1.1, 'kgPorUnidade', 1, 'kgTotal', 625, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 100, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 250, 'natureza', 'venda')),
         987.50, 875,
         case when current_date >= (date '2026-09-24' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BOMBOM') and lower(l.nome) = lower('ESTANCIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '64413704-1f6b-4625-88d8-258f89ec6e57', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-24', 15,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 150, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 150, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 50, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 125, 'natureza', 'venda')),
         330.00, 275,
         case when current_date >= (date '2026-09-24' + 15) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BRAUNA') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '7beef94c-38fc-4e42-8368-1528816936b4', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-24', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 40, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-24' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('AEROPORTO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '2f5413a0-c797-4697-8e56-a526761b56a4', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-24', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 400, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 1000, 'natureza', 'venda')),
         1200.00, 1000,
         case when current_date >= (date '2026-09-24' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('BARRA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '159ea857-a9f8-42f4-8082-fed4c7f0559f', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-24', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 20, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 50, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         180.00, 150,
         case when current_date >= (date '2026-09-24' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('BR')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '9f34bdd0-6ac4-4c88-84d2-028e6bd819da', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-24', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 100, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 250, 'natureza', 'venda')),
         300.00, 250,
         case when current_date >= (date '2026-09-24' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('FAROL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'c90ea7a7-8bbe-4b63-8877-096182839848', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-24', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 40, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 100, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 25, 'precoUnitario', 4, 'kgPorUnidade', 1, 'kgTotal', 25, 'natureza', 'venda')),
         220.00, 125,
         case when current_date >= (date '2026-09-24' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('PRAIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '5e2dfd39-192a-4021-8847-5529e5df893f', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-24', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 12, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 30, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         96.00, 80,
         case when current_date >= (date '2026-09-24' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('URQUIZA LEAL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'add716a1-76e1-47c1-812d-85fbc1439807', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-24', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 75, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 75, 'natureza', 'venda')),
         90.00, 75,
         case when current_date >= (date '2026-09-24' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE ALPHA') and lower(l.nome) = lower('COROA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'cd31e210-f544-40a2-80e8-3101f61027b5', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-24', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         60.00, 50,
         case when current_date >= (date '2026-09-24' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('F.PORTO')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '98f1e4f2-89cb-4ac7-86fb-9e297e4d10b2', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-24', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-24' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('SILVA SUPERMERCADO') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '4da82dba-2748-47a1-84ad-692915d4e705', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-25', 14,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 200, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 200, 'natureza', 'venda')),
         240.00, 200,
         case when current_date >= (date '2026-09-25' + 14) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('HIPER CARNES') and lower(l.nome) = lower('BARRA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'b0dfcc7b-c58e-4840-819e-af7789aa2a8b', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-25', 15,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000005', 'qty', 20, 'precoUnitario', 12, 'kgPorUnidade', 10, 'kgTotal', 200, 'natureza', 'venda')),
         240.00, 200,
         case when current_date >= (date '2026-09-25' + 15) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('HOTEL AQUARIUS') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'ef778661-c6cb-4db3-89bf-72738a0be733', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-25', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 160, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 400, 'natureza', 'venda')),
         480.00, 400,
         case when current_date >= (date '2026-09-25' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('ARUANA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '3e303121-a374-4402-8712-daa413a76491', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-25', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 50, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 125, 'natureza', 'venda')),
         150.00, 125,
         case when current_date >= (date '2026-09-25' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('GAZOL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '7117db3b-a88f-4e7b-83fe-59188317bd03', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-25', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 80, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 200, 'natureza', 'venda')),
         240.00, 200,
         case when current_date >= (date '2026-09-25' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('P.CAJU')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '204b8b68-5158-4279-8c7e-f55a7964cb9c', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-25', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 50, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 125, 'natureza', 'venda')),
         150.00, 125,
         case when current_date >= (date '2026-09-25' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('PRAIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'a6beedbf-bb68-4c4e-84fe-b6159994da08', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-25', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-25' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('FAROLANDIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '634e15dc-e2a4-4f21-8de3-2abed9e5d37b', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-25', 21,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 50, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')),
         60.00, 50,
         case when current_date >= (date '2026-09-25' + 21) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('REDE MAIS') and lower(l.nome) = lower('MEGA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '45483b01-33bb-46ea-8cdd-a84514b66041', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-26', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 6800, 'precoUnitario', 0.95, 'kgPorUnidade', 1, 'kgTotal', 6800, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 90, 'precoUnitario', 3.9, 'kgPorUnidade', 1, 'kgTotal', 90, 'natureza', 'venda')),
         6811.00, 6890,
         case when current_date >= (date '2026-09-26' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('CD')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'c38d8100-6a49-489d-82af-ce26ef00928d', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-26', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 30, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 75, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000006', 'qty', 30, 'precoUnitario', 2.5, 'kgPorUnidade', 1, 'kgTotal', 30, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 500, 'precoUnitario', 1, 'kgPorUnidade', 1, 'kgTotal', 500, 'natureza', 'venda')),
         665.00, 605,
         case when current_date >= (date '2026-09-26' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BOMBOM') and lower(l.nome) = lower('ARACAJU')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'b5a80323-d2e0-4305-825a-c432109d8598', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-26', 15,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 150, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 150, 'natureza', 'venda'), jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 40, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 100, 'natureza', 'venda')),
         300.00, 250,
         case when current_date >= (date '2026-09-26' + 15) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BRAUNA') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '696a6ec9-6246-431c-8e9f-383c4e70e58b', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-26', 14,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 100, 'precoUnitario', 1.2, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')),
         120.00, 100,
         case when current_date >= (date '2026-09-26' + 14) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('HIPER CARNES') and lower(l.nome) = lower('ARUANA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'd71548c1-ad12-45fd-8a61-f22658fb6828', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-26', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 30, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 75, 'natureza', 'venda')),
         90.00, 75,
         case when current_date >= (date '2026-09-26' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('ORLA SOL')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select 'fde00cae-c383-444d-82a7-8f672e9b45b6', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-26', 30,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000002', 'qty', 50, 'precoUnitario', 3, 'kgPorUnidade', 2.5, 'kgTotal', 125, 'natureza', 'venda')),
         150.00, 125,
         case when current_date >= (date '2026-09-26' + 30) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('PETROX') and lower(l.nome) = lower('SANTA LUCIA')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status)
  select '2f9e51ff-2f65-4e20-846a-fea6b8a1a534', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-26', 0,
         jsonb_build_array(jsonb_build_object('produtoId', 'd1000000-0000-4000-8000-000000000001', 'qty', 500, 'precoUnitario', 1.1, 'kgPorUnidade', 1, 'kgTotal', 500, 'natureza', 'venda')),
         550.00, 500,
         case when current_date >= (date '2026-09-26' + 0) then 'pago' else 'pendente' end
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('VICTOR') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set
    itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total;

-- ─── Despesas ───────────────────────────────────────────────────────────────
-- Apaga os consolidados que vieram do PDF e põe o detalhe da planilha.

delete from public.despesas where descricao like 'Consolidado de %planilha';

insert into public.despesas (id, data, categoria, descricao, valor) values
  ('1dcc7323-7f5d-4a0a-8424-0b452ec04d90', '2026-08-20', 'Combustíveis', 'DIESEL — 1563 L a R$ 6.00', 9378.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('0911ffa6-e96c-41c4-8d56-f1205bec83cb', '2026-09-09', 'Combustíveis', 'DIESEL — 88.5 L a R$ 6.50', 575.25)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('d5e33a13-54bb-4130-8e42-d7c89bc3b173', '2026-09-16', 'Combustíveis', 'DIESEL — 62.957 L a R$ 7.09 · NILSON', 446.37)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('8f77bfa2-3d85-43be-8e7d-7f89aa7b7e82', '2026-09-16', 'Combustíveis', 'DIESEL — 136 L a R$ 6.79', 923.44)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('a1b5ad3e-374c-4829-86b1-3cda33ff8b1f', '2026-09-21', 'Combustíveis', 'DIESEL — 60.246 L a R$ 7.09 · NILSON', 427.14)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('57395dde-a9f8-45cf-835a-8655f9142962', '2026-09-24', 'Combustíveis', 'DIESEL — 62.784 L a R$ 7.39 · NILSON', 463.97)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('303c3e4c-6b77-45a0-84f2-76c36d3fd7f2', '2026-09-25', 'Combustíveis', 'DIESEL — 35.669 L a R$ 7.48 · VINICIUS', 266.80)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('b3083d3b-e497-4835-8e56-76e604a6cbab', '2026-09-01', 'Diaristas', 'DESCARREGO 1620', 400.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('124226bf-16ef-41e7-88e0-b0de35c7b338', '2026-09-03', 'Diaristas', 'DESCARREGO 1620', 420.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('10e95c95-7c15-4630-8e5f-e35311148d32', '2026-09-04', 'Diaristas', 'DESCARREGO MIX', 1.10)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('79fb76bd-04eb-4970-8611-7ba8f990ab4c', '2026-09-07', 'Diaristas', 'DESCARREGO 1620', 400.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('e704cf14-3506-454f-8aec-ef95f8f7d377', '2026-09-10', 'Diaristas', 'DESCARREGO 1620', 180.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('b59d995a-fee0-4329-8a78-c2811593bc8d', '2026-09-14', 'Diaristas', 'DESCARREGO 1620', 220.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('61a22f00-93f0-4605-888a-539ad3cb184c', '2026-09-16', 'Diaristas', 'DESCARREGO 1620', 160.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('262eadf5-4ee6-4786-87e2-291653f598ab', '2026-09-18', 'Diaristas', 'DESCARREGO 1620', 200.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('2a18d66f-22c4-4a3c-8e40-75cb6a737eca', '2026-09-21', 'Diaristas', 'DESCARREGO MELANCIA', 220.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('8302880a-13e0-47f7-8d61-9d689ae0be16', '2026-09-22', 'Diaristas', 'DESCARREGO 1620', 500.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('f97b8004-76be-450f-8a5b-2bf1cb9546d9', '2026-09-01', 'Funcionários', 'ALEXANDRE', 90.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('90e9a8d0-60e2-4fd4-8685-af9c11598877', '2026-09-01', 'Funcionários', 'LUCAS', 1310.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('914622ec-4491-4518-8c6c-81def39a0623', '2026-09-01', 'Funcionários', 'HELISSON', 800.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('36852a85-4fb2-448c-850e-75bf5f5abd35', '2026-09-01', 'Funcionários', 'KAUE', 642.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('78de6ae4-aa34-4957-8257-060b2ec6f974', '2026-09-01', 'Funcionários', 'CLEO', 1080.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('37553162-07e3-4a3c-8a48-e5b4f9a39017', '2026-09-01', 'Funcionários', 'CLEVERTON', 1310.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('fb9ddfb5-251e-4297-8220-46835c54cfe3', '2026-09-01', 'Funcionários', 'WESLEY', 1170.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('d292f8da-83fa-46b4-8140-f10a8954bc72', '2026-09-01', 'Funcionários', 'PRISCILA', 1500.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('5d65ca46-f106-48fb-88a5-e024ac31df81', '2026-09-01', 'Funcionários', 'DENISSON', 1170.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('7200ce1c-126f-47e8-896d-15d19b8e0dc1', '2026-09-01', 'Funcionários', 'NILSON', 1500.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('baec23a5-0533-435b-8bb5-f841f003da06', '2026-09-05', 'Funcionários', 'CLEVERTON', 100.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('db17c69d-e73b-427b-855e-59c7aa136bb3', '2026-09-05', 'Funcionários', 'DENISSON', 100.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('5b972b81-af28-4db7-8e51-11f414370a42', '2026-09-07', 'Funcionários', 'LUCAS', 200.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('ecec0eb3-0cc4-4407-8cca-22e6a291759e', '2026-09-09', 'Funcionários', 'CLEO', 100.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('2dfa69e2-a950-4f22-8ded-965954b2b830', '2026-09-10', 'Funcionários', 'CLEVERTON', 100.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('f51e3176-3eb2-4dcc-8249-946a1b772ee1', '2026-09-11', 'Funcionários', 'LUCAS', 200.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('f499bb87-95f4-4bc6-89d4-722d27a2b3e6', '2026-09-11', 'Funcionários', 'WESLEY', 630.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('be094ba7-e046-45f5-87b2-0d18eb120218', '2026-08-10', 'Funcionários', 'GERAL', 64558.90)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('c58e76a2-4287-4ef4-89c9-dcb0e891bf49', '2026-09-15', 'Funcionários', 'CLEO', 975.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('651ba7c9-08d6-46ff-8cc3-45c93051c28c', '2026-09-15', 'Funcionários', 'LUCAS', 850.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('ced8a397-ed7d-4020-86c1-39454e7c8684', '2026-09-15', 'Funcionários', 'KAUE', 1175.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('f1b889d8-cd19-49f7-8c95-9e15edeb016c', '2026-09-15', 'Funcionários', 'CLEVERTON', 785.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('ad2f15cc-1aea-43f2-8625-558638ebc2f9', '2026-09-15', 'Funcionários', 'PRISCILA', 1590.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('f958b146-5608-4215-8f5c-0c8c15c4a118', '2026-09-15', 'Funcionários', 'DENISSON', 630.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('dff7766a-27c4-4ad9-8834-849984862795', '2026-09-15', 'Funcionários', 'HELISSON', 540.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('0d76553a-2294-43ef-8072-f6a9006bffc9', '2026-09-15', 'Funcionários', 'NILSON', 1690.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('4523fce4-b2c0-4249-88c7-b82979e91bcd', '2026-09-23', 'Funcionários', 'LUCAS', 500.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('7407c524-1b56-44e7-8fd5-99b5303cdba8', '2026-09-05', 'Fretes', 'CARRO FRETE', 1200.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('19cf0903-02ac-4964-8736-579a3dd60646', '2026-09-09', 'Fretes', 'CARRO FRETE', 1250.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('b8fae2b3-50f4-4ad9-8a08-220a1349acdf', '2026-09-09', 'Fretes', 'CARRO FRETE', 600.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('9b77e6e3-77cc-4777-8697-6d15839a0631', '2026-09-12', 'Fretes', 'CARRO FRETE', 1200.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('14be8ef2-a660-43a4-8f28-8f777f236aba', '2026-08-20', 'Fretes', 'FRETES', 29564.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('aecf9838-cdf8-443b-8904-ec5fe37aacb4', '2026-09-15', 'Fretes', 'CARRO FRETE', 350.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('f9e7da6f-a818-484f-8a8f-79273644b539', '2026-09-21', 'Fretes', 'FRETES', 3500.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('ecf79dcb-baaa-472d-88ea-4d9afc9f4246', '2026-09-22', 'Fretes', 'ADIANTAMENTO FRETE', 6000.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('7db72f43-6d0d-49f9-8734-5b3ca5f5fec6', '2026-09-01', 'Investimentos', 'CONSORCIO MOTO', 648.11)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('5d3a791a-1fc0-439b-8258-bbf7737af32b', '2026-09-01', 'Investimentos', 'CARIMBO', 73.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('00a88855-0fad-484e-8df4-f9220af4fe81', '2026-09-01', 'Investimentos', 'PLACAS', 300.60)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('ad9a71fd-46c6-4f6b-8072-3798b0e69340', '2026-09-03', 'Investimentos', 'GRAMPOS', 508.33)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('f7477f47-22f1-4115-83e6-a1c6b361317a', '2026-09-04', 'Investimentos', 'ETIQUETAS', 1.85)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('5063daba-fe12-4ed3-8c40-28414484f2c5', '2026-09-10', 'Investimentos', 'SACOS LARANJA', 3200.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('bf224451-9c4f-43b1-8d71-8a0928a13bc5', '2026-08-20', 'Investimentos', 'CAIXAS', 49592.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('8f4021c7-8f1a-48c0-8d7d-7228377a1d78', '2026-09-16', 'Investimentos', 'PARCELA SORINTER', 6963.74)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('cd78bccf-d1e1-437e-8281-d5546cefe807', '2026-08-20', 'Investimentos', 'FINANCIMAMENTO', 14000.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('d6462b82-c24e-472a-874f-357e8758a2ce', '2026-09-21', 'Investimentos', 'CONSERTO HR', 2000.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('78026018-26df-43f3-815a-640c871bd3a1', '2026-09-22', 'Investimentos', 'CONSORCIO MOTO', 320.92)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('d29afdab-8b83-4c14-8a3c-88e1056df2b4', '2026-09-23', 'Investimentos', 'STRADA', 16666.67)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('e178ff11-3a33-496c-8357-1d985fd45800', '2026-09-05', 'Outros', 'ALUGUEL CD', 2000.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('07d7cb50-01bc-42df-84fe-01fcec9e4187', '2026-09-05', 'Outros', 'ALMOÇO', 51.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('dca6df94-a507-4ecb-84dc-b21fc8a5aa20', '2026-09-05', 'Outros', 'ALMOÇO', 97.80)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('0bbc97bf-d043-4912-80b5-5e17718620e7', '2026-09-08', 'Outros', 'AGUA', 15.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('d920ace4-144b-49ef-8db5-9f79800c5858', '2026-09-09', 'Outros', 'ALMOÇO', 50.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('f428e23f-89c9-4595-8ee6-dfb43d5ed260', '2026-09-09', 'Outros', 'IFCO', 5674.36)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('d8045e06-ea7e-4feb-83fd-19ed07b1be37', '2026-09-09', 'Outros', 'BOTAS AJUDANTES', 189.96)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('c485dc22-8e61-4c96-8c00-0242c4bab6b9', '2026-09-10', 'Outros', 'SEGURO HR', 300.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('3c0af6e4-61ef-4699-8932-cef904b1d730', '2026-09-11', 'Outros', 'AGUA', 15.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('2fcb4d2f-858f-4e99-8730-9028a47d9b69', '2026-09-12', 'Outros', 'ALMOÇO', 155.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('25581654-7b64-4670-8ddd-ae716edbf87d', '2026-08-20', 'Outros', 'ALUGUEL CD', 2000.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('892c11e7-6120-425d-8bef-613d46a9341b', '2026-08-20', 'Outros', 'ENERGIA', 3000.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('472eed0f-89e1-4aaa-84fa-38a4c67c9ea7', '2026-09-15', 'Outros', 'IFCO', 1142.94)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('e7fdd44b-e4e9-4fd4-81d3-49f34a88bc5d', '2026-09-15', 'Outros', 'FRETE SAQUINHO', 380.44)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('4f804043-1466-4d21-8d75-7dbe9a620251', '2026-09-16', 'Outros', 'ALMOCO', 50.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('f90e1148-25ab-4243-886b-11e406c371ee', '2026-09-16', 'Outros', 'FRETE MAQUINA', 343.90)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('136a6939-fc48-4786-80be-d1dc582f594c', '2026-09-16', 'Outros', 'RETIFICACAO INSS', 46.58)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('99a2c21b-392a-484a-8cc3-c1541d75fc59', '2026-09-17', 'Outros', 'AGUA', 15.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('097ded9f-14da-4d9e-8beb-4b807f290d29', '2026-09-18', 'Outros', 'ALMOCO', 50.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('2f086f0c-9765-42d1-8d95-6547ad8041fa', '2026-09-19', 'Outros', 'ALMOCO', 44.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('93be241c-b55b-488f-868c-bbae2e6b1fbe', '2026-09-21', 'Outros', 'CX IFCO', 1648.53)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('7dbaa793-58e4-4ab6-8636-7f7d9f8388f6', '2026-09-21', 'Outros', 'AGUA', 7.50)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('e7d30b00-bc33-4a98-8ffd-ea2d50e0b5c2', '2026-09-21', 'Outros', 'ALMOCO', 50.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('b1831df7-6348-4966-8cc0-f9def729d544', '2026-09-22', 'Outros', 'AGUA', 7.50)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('30baff57-ddd9-4b26-8933-80df508d1474', '2026-09-22', 'Outros', 'CAFE', 20.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('8f6c53e4-f08d-45a5-8ae0-e916d2239705', '2026-09-22', 'Outros', 'OMIE', 302.12)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('dfeb4cac-6765-4a4a-815f-29b62177a91b', '2026-09-22', 'Outros', 'ALMOCO', 30.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('9d06f312-f974-42b1-889a-fe33f9f5860a', '2026-09-24', 'Outros', 'DIARIA PEQUENO', 100.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('dcb88ba1-655e-4f5e-80b6-e8db7f844a8b', '2026-09-24', 'Outros', 'AGUA', 15.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor) values
  ('a5cc2b56-18b1-44e2-8474-84f192d17bfb', '2026-09-26', 'Outros', 'CAFE', 30.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao,
    categoria = excluded.categoria;

commit;

-- Confira:  select * from public.vw_dre_mes;
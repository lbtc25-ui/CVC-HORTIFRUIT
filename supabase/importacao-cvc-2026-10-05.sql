-- ============================================================================
--  Carga CVC — planilha CVC COMPRA E VENDA x grupos de WhatsApp (até 05/10/2026)
--  GERADO por scripts/importar-cvc-planilha-whatsapp.py — não edite à mão.
--
--  Rode DEPOIS de instalar.sql, da migração 68 e da 69 (recebedor/repasses). Idempotente: os ids
--  vêm do conteúdo, rodar de novo atualiza em vez de duplicar.
--  O que ficou de fora e as divergências: docs/cruzamento-cvc-2026-10-05.md
-- ============================================================================

begin;

-- Produtos que ainda não existem no cadastro da CVC
insert into public.produtos (nome, fruta, empresa, unidade_venda, kg_por_unidade, preco)
  select 'Tangerina Olé', 'Tangerina Olé', 'cvc', 'kg', 1, 0
  where not exists (select 1 from public.produtos where lower(nome) = lower('Tangerina Olé'));
insert into public.produtos (nome, fruta, empresa, unidade_venda, kg_por_unidade, preco)
  select 'Mamão Formosa', 'Mamão Formosa', 'cvc', 'kg', 1, 0
  where not exists (select 1 from public.produtos where lower(nome) = lower('Mamão Formosa'));

-- Redes e lojas
insert into public.redes (id, nome) values ('59f5d52c-77b2-4631-85d8-cd10a573720c', 'ATAKAREJO') on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('42a3812b-a527-4260-8a45-19f6cf7182cb', 'BOMBOM') on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('b790d3df-43b2-43ef-83fd-3a9227ebf638', 'BRAUNA') on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('bb037278-0eb1-4b7c-8203-96d7361a6884', 'CARCARA') on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('dd9cd2cd-5a53-4a9b-84ac-ccfc49eebab0', 'CD MIX') on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('3966a302-e655-49dd-893b-d1762be53e6c', 'DIVERSOS') on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('9ab22707-0eb6-46d7-8a8f-7bd49861f356', 'ISMERALDA') on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('24f19f90-12fb-4e21-8330-9f1f23fc7d74', 'JPJS') on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('5c32ba9d-28f2-4e7e-8148-db8e83bbef6b', 'MIX') on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('12406752-a75a-4534-8b2c-c3483b6be63d', 'RODRIGO') on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome) values ('9fa5cdcf-09f1-441a-8d9b-74a3d9b0d6ba', 'VICTOR') on conflict (lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'b2a1c329-bf3d-44d7-8749-ce42fe6e24fe', r.id, 'MATRIZ' from public.redes r where lower(r.nome) = lower('ATAKAREJO')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'fe594be5-432e-4bbd-842e-b476ce0a2521', r.id, 'MATRIZ' from public.redes r where lower(r.nome) = lower('BOMBOM')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'c10f061a-e61e-4cd3-866a-c472b2c9bd46', r.id, 'MATRIZ' from public.redes r where lower(r.nome) = lower('BRAUNA')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '58322f69-a693-4b3d-8340-cf5466079d4a', r.id, 'MATRIZ' from public.redes r where lower(r.nome) = lower('CARCARA')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'dd018f47-14eb-4270-87ff-77c3bff23963', r.id, 'MATRIZ' from public.redes r where lower(r.nome) = lower('CD MIX')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '83c6ca5f-dbc5-440e-8514-6c0995faccd1', r.id, 'MATRIZ' from public.redes r where lower(r.nome) = lower('DIVERSOS')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'ebd94cd2-129e-4e44-8c5d-db94d1ad5bff', r.id, 'MATRIZ' from public.redes r where lower(r.nome) = lower('ISMERALDA')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'dac7a19a-b2a4-4572-8008-64eadad45ddd', r.id, 'MATRIZ' from public.redes r where lower(r.nome) = lower('JPJS')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '07b1818e-3ef2-4517-838c-c6649588376d', r.id, 'MATRIZ' from public.redes r where lower(r.nome) = lower('MIX')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'f90f6dee-012d-4d36-883e-e85b27405884', r.id, 'MATRIZ' from public.redes r where lower(r.nome) = lower('RODRIGO')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '111756e8-461d-4aff-8319-5f33a97576b1', r.id, 'MATRIZ' from public.redes r where lower(r.nome) = lower('VICTOR')
  on conflict (rede_id, lower(nome)) do nothing;

-- Fornecedores
insert into public.fornecedores (id, nome, status)
  select 'cd7fe1be-544f-4e3a-83f6-05f02603cb7a', 'AMINTAS', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('AMINTAS'));
insert into public.fornecedores (id, nome, status)
  select '63a05ae7-1213-464c-8f84-8ef3e1beae6a', 'ATAKAREJO', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('ATAKAREJO'));
insert into public.fornecedores (id, nome, status)
  select '4d4fdc33-6641-4c2f-837e-fdcccb4ca007', 'AVF', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('AVF'));
insert into public.fornecedores (id, nome, status)
  select '06dd28b2-f839-4269-86fa-c58032c6bd8e', 'EDUARDO', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('EDUARDO'));
insert into public.fornecedores (id, nome, status)
  select '180b1d19-4f11-459c-8c3b-7677dd6c06b6', 'FAZ. PAPAGAIO', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('FAZ. PAPAGAIO'));
insert into public.fornecedores (id, nome, status)
  select 'fd5dff3b-abea-412c-8f3d-e7fdded60ca2', 'FRANK', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('FRANK'));
insert into public.fornecedores (id, nome, status)
  select '0d6adb84-c9b7-4cee-8687-131386dd71a5', 'GILBERTO SOBRAL', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('GILBERTO SOBRAL'));
insert into public.fornecedores (id, nome, status)
  select '4fb44254-1848-4379-8045-591f29c8d22a', 'GILSON', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('GILSON'));
insert into public.fornecedores (id, nome, status)
  select '97defc9f-2a66-4173-8cc1-e21664a19176', 'GPE', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('GPE'));
insert into public.fornecedores (id, nome, status)
  select 'b7f8763b-3e93-4776-86c9-24acaeec4cba', 'GRACE', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('GRACE'));
insert into public.fornecedores (id, nome, status)
  select '99d0e707-0327-436e-8515-e9ce72f31935', 'HSM', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('HSM'));
insert into public.fornecedores (id, nome, status)
  select '07067183-b8d0-47f6-8153-39d639c278d6', 'JOSÉ DAVID', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('JOSÉ DAVID'));
insert into public.fornecedores (id, nome, status)
  select 'aceaabb0-cce8-498e-8333-5039176fe180', 'JOSÉ VALDO', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('JOSÉ VALDO'));
insert into public.fornecedores (id, nome, status)
  select '28131f11-1620-46d2-8665-996b6efba23f', 'JPJS', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('JPJS'));
insert into public.fornecedores (id, nome, status)
  select 'dc7873c8-f7fa-419d-8c04-70e07a448a76', 'KLEBER', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('KLEBER'));
insert into public.fornecedores (id, nome, status)
  select '5742fb70-6e1c-4775-82ad-586dd09a48ad', 'LEANDRO', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('LEANDRO'));
insert into public.fornecedores (id, nome, status)
  select '973ff1fa-ab2e-4e18-8a6c-4efdd1d09b74', 'LILIAN', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('LILIAN'));
insert into public.fornecedores (id, nome, status)
  select '407c901a-47f4-4adf-866c-b8d33e80267c', 'LUIS EDUARDO', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('LUIS EDUARDO'));
insert into public.fornecedores (id, nome, status)
  select '07f75d89-5ad9-4fe8-8426-17adce5b09dd', 'MARCOS ANTONIO', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('MARCOS ANTONIO'));
insert into public.fornecedores (id, nome, status)
  select 'c0c535d5-639f-43a0-8f55-8e765ff880ac', 'MARIA', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('MARIA'));
insert into public.fornecedores (id, nome, status)
  select '0c39f1eb-8014-45ce-8459-3af2978623a6', 'MASCARENHAS', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('MASCARENHAS'));
insert into public.fornecedores (id, nome, status)
  select 'e686ff81-cc2a-448b-8ae4-7f64663fea2c', 'MASCARENHAS (AVF)', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('MASCARENHAS (AVF)'));
insert into public.fornecedores (id, nome, status)
  select 'd12ee65c-cea6-4ac9-85cd-c0bfe853d5a0', 'RODRIGO', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('RODRIGO'));
insert into public.fornecedores (id, nome, status)
  select 'fcf72a4a-2dc7-4914-806e-19847a6a205a', 'SANDOVAL', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('SANDOVAL'));
insert into public.fornecedores (id, nome, status)
  select '6345aa97-1050-478b-858a-ad976b704f94', 'SUELY', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('SUELY'));
insert into public.fornecedores (id, nome, status)
  select 'fdbe72f1-b09e-4684-8ac1-4bfeaf1f708b', 'VALDIR', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('VALDIR'));
insert into public.fornecedores (id, nome, status)
  select '0787c1ab-4253-452c-8291-48ddffbe4fe0', 'VICTOR', 'ativo'
  where not exists (select 1 from public.fornecedores where lower(nome) = lower('VICTOR'));

-- Compras
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select 'df237896-6257-4914-8723-9b053ae27c2b', '2026-08-11', (select id from public.fornecedores where lower(nome) = lower('FAZ. PAPAGAIO') order by criado_em limit 1),
         'Limão', 4100, 3.2000, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '03dc5de9-d1bc-4617-8267-ba3040bd64dc', '2026-08-11', (select id from public.fornecedores where lower(nome) = lower('FAZ. PAPAGAIO') order by criado_em limit 1),
         'Tangerina Olé', 600, 2.2500, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '8fa9e7a0-d90b-4e2d-85de-06ac61e66a41', '2026-08-14', (select id from public.fornecedores where lower(nome) = lower('LUIS EDUARDO') order by criado_em limit 1),
         'Tangerina Ponkan', 575, 2.8000, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '47ad9f28-090b-47ff-85bb-8d509077d3f2', '2026-08-17', (select id from public.fornecedores where lower(nome) = lower('AMINTAS') order by criado_em limit 1),
         'Goiaba', 325, 2.0000, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '81cccf43-49ad-4abd-8f97-0e7fe787582b', '2026-08-18', (select id from public.fornecedores where lower(nome) = lower('GRACE') order by criado_em limit 1),
         'Ameixa Fresca Importada', 45, 16.6600, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select 'b3ba012c-2101-42a1-8e20-eb5330990e24', '2026-08-18', (select id from public.fornecedores where lower(nome) = lower('JPJS') order by criado_em limit 1),
         'Melão Orange', 84, 6.4280, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select 'b311c642-a6ad-4518-839a-c049bfe4185a', '2026-08-19', (select id from public.fornecedores where lower(nome) = lower('VALDIR') order by criado_em limit 1),
         'Maracujá', 618, 7.0000, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '79bc7dd8-5341-446e-8cb7-b70e1ef0cb96', '2026-08-19', (select id from public.fornecedores where lower(nome) = lower('GPE') order by criado_em limit 1),
         'Tangerina Ponkan', 1200, 2.3000, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '2be4d452-64cb-4045-8903-09a4ed49cd33', '2026-08-20', (select id from public.fornecedores where lower(nome) = lower('HSM') order by criado_em limit 1),
         'Abacate', 1320, 3.2500, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '44d994df-4a28-441c-8c83-cb0fa67c5639', '2026-08-22', (select id from public.fornecedores where lower(nome) = lower('JPJS') order by criado_em limit 1),
         'Ameixa Fresca Importada', 27, 17.7800, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select 'bc61e25a-a0df-452c-8d33-7165f82d9b0d', '2026-08-22', (select id from public.fornecedores where lower(nome) = lower('JPJS') order by criado_em limit 1),
         'Ameixa Fresca Importada', 67, 16.1100, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '65d56c72-6a67-49ee-895b-15baeda1fd26', '2026-08-22', (select id from public.fornecedores where lower(nome) = lower('SANDOVAL') order by criado_em limit 1),
         'Maracujá', 865, 7.0000, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select 'cb6ee94e-ab1e-4fae-81e5-9717fdd7d86d', '2026-08-22', (select id from public.fornecedores where lower(nome) = lower('VALDIR') order by criado_em limit 1),
         'Maracujá', 600, 7.0000, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '8d943c96-58ae-45ce-841d-b8f78bcca5f1', '2026-08-25', (select id from public.fornecedores where lower(nome) = lower('MARIA') order by criado_em limit 1),
         'Goiaba', 300, 2.6000, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '17c40aa2-bb38-46e9-8059-3d0afb9d3ba4', '2026-08-26', (select id from public.fornecedores where lower(nome) = lower('FAZ. PAPAGAIO') order by criado_em limit 1),
         'Limão', 2000, 3.2000, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '86b24fbc-c1a2-48a3-89db-6260cca30b22', '2026-08-27', (select id from public.fornecedores where lower(nome) = lower('SUELY') order by criado_em limit 1),
         'Goiaba', 322, 3.2609, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '616c8200-c42c-45c6-8519-0fca382273c5', '2026-08-27', (select id from public.fornecedores where lower(nome) = lower('EDUARDO') order by criado_em limit 1),
         'Tangerina Ponkan', 168, 3.7500, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select 'b2d25797-6b6f-49c5-84ac-e2b69a6df812', '2026-08-28', (select id from public.fornecedores where lower(nome) = lower('EDUARDO') order by criado_em limit 1),
         'Tangerina Ponkan', 480, 3.7500, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select 'b136fe3a-f73d-4c5d-8f02-e8ae7998899e', '2026-08-29', (select id from public.fornecedores where lower(nome) = lower('SUELY') order by criado_em limit 1),
         'Goiaba', 250, 3.2000, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '57500cde-89ef-4914-8189-cd5e4ae842f1', '2026-09-01', (select id from public.fornecedores where lower(nome) = lower('JPJS') order by criado_em limit 1),
         'Kiwi Importado', 405, 28.7200, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '6e787dfb-22e6-4c70-8a92-416286c992b3', '2026-09-03', (select id from public.fornecedores where lower(nome) = lower('JOSÉ DAVID') order by criado_em limit 1),
         'Coco Seco', 90, 2.3000, 'WhatsApp — 90 cocos a R$ 2,30'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select 'd2191805-9c44-4b30-8d5b-05e7d95a4303', '2026-09-03', (select id from public.fornecedores where lower(nome) = lower('SUELY') order by criado_em limit 1),
         'Goiaba', 250, 3.6000, 'WhatsApp — 10 cx entregues em 03/09'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select 'ddbe150d-9235-4610-8c79-dd857f422938', '2026-09-05', (select id from public.fornecedores where lower(nome) = lower('SUELY') order by criado_em limit 1),
         'Goiaba', 75, 3.6000, 'WhatsApp — 3 cx entregues em 05/09'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '6036b8ad-0d6a-4eda-8a5f-dba22612f2ae', '2026-09-08', (select id from public.fornecedores where lower(nome) = lower('MARCOS ANTONIO') order by criado_em limit 1),
         'Melancia', 4800, 1.1823, 'WhatsApp — entrega Atakarejo 08/09 (800 un x 6 kg)'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select 'bb8a2d44-5f9b-4d22-8211-f912e4d6b1b1', '2026-09-08', (select id from public.fornecedores where lower(nome) = lower('LUIS EDUARDO') order by criado_em limit 1),
         'Tangerina Ponkan', 200, 3.6000, 'WhatsApp — 8 cx; kg ESTIMADO (8 cx x 25 kg)'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select 'aca8d986-266d-4f96-8753-023fa5bef037', '2026-09-10', (select id from public.fornecedores where lower(nome) = lower('JPJS') order by criado_em limit 1),
         'Melancia', 600, 2.5000, 'WhatsApp — NF 17352 — melancia grande a R$ 15,00 (100 un x 6 kg)'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '0fcc6b6f-65b5-4366-85e5-0555923d4cc6', '2026-09-10', (select id from public.fornecedores where lower(nome) = lower('GPE') order by criado_em limit 1),
         'Tangerina Murcote', 1150, 2.0000, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select 'a90a15c0-4a8e-4e85-8758-6424244a5bde', '2026-09-10', (select id from public.fornecedores where lower(nome) = lower('JPJS') order by criado_em limit 1),
         'Tangerina Ponkan', 50, 3.5200, 'WhatsApp — NF 17352, 2 cx a R$ 88; kg ESTIMADO (25 kg/cx)'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '0e2eef87-26e3-47ab-8925-ea57618328ca', '2026-09-11', (select id from public.fornecedores where lower(nome) = lower('RODRIGO') order by criado_em limit 1),
         'Tangerina Murcote', 200, 3.5000, 'WhatsApp — 10 cx; kg ESTIMADO (20 kg/cx)'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '04d43ee4-6f47-4991-8cf2-bf06ff1aa68a', '2026-09-11', (select id from public.fornecedores where lower(nome) = lower('JPJS') order by criado_em limit 1),
         'Tangerina Ponkan', 225, 3.5200, 'WhatsApp — NF 17430, 9 cx a R$ 88; kg ESTIMADO (25 kg/cx)'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '5a669dff-8817-4070-8cb2-93aebb9074f3', '2026-09-11', (select id from public.fornecedores where lower(nome) = lower('LUIS EDUARDO') order by criado_em limit 1),
         'Tangerina Ponkan', 150, 3.6000, 'WhatsApp — 6 cx pagas pelo Xande (AVF); kg ESTIMADO (25 kg/cx)'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '3bd43da1-6c1f-433a-8be3-3e82ea77d2cc', '2026-09-12', (select id from public.fornecedores where lower(nome) = lower('JOSÉ DAVID') order by criado_em limit 1),
         'Coco Seco', 60, 2.3000, 'WhatsApp — 60 cocos secos a R$ 2,30'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select 'b5728d21-df26-4f59-8b86-592a22c4d7cc', '2026-09-12', (select id from public.fornecedores where lower(nome) = lower('JPJS') order by criado_em limit 1),
         'Melancia', 2520, 2.5000, 'WhatsApp — NF 17519 — melancia grande a R$ 15,00 (420 un x 6 kg)'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select 'b1290541-ab6c-4e56-8e65-f41207aafddf', '2026-09-12', (select id from public.fornecedores where lower(nome) = lower('JPJS') order by criado_em limit 1),
         'Tangerina Ponkan', 425, 3.5200, 'WhatsApp — NF 17519, 17 cx a R$ 88; kg ESTIMADO (25 kg/cx)'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '20cad34d-e36e-48bb-8587-d23ae04721b4', '2026-09-14', (select id from public.fornecedores where lower(nome) = lower('LEANDRO') order by criado_em limit 1),
         'Limão', 9937.5, 5.5200, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '94661b81-043d-4475-86cc-164cb37fa905', '2026-09-15', (select id from public.fornecedores where lower(nome) = lower('JPJS') order by criado_em limit 1),
         'Tangerina Ponkan', 450, 3.4000, 'WhatsApp — NF 17683, 18 cx a R$ 85; kg ESTIMADO (25 kg/cx)'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '953fdc60-c5ca-4133-8461-61d69d648504', '2026-09-15', (select id from public.fornecedores where lower(nome) = lower('LILIAN') order by criado_em limit 1),
         'Tangerina Ponkan', 150, 3.2000, 'WhatsApp — 6 cx; kg ESTIMADO (25 kg/cx)'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '784d1e90-0419-4b81-8355-927edbf5b086', '2026-09-16', (select id from public.fornecedores where lower(nome) = lower('GILBERTO SOBRAL') order by criado_em limit 1),
         'Melancia', 1626, 0.4489, 'WhatsApp — 271 melancias (271 un x 6 kg)'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select 'd7c8a3f3-12da-47c6-8a2a-0ff857f98e2f', '2026-09-16', (select id from public.fornecedores where lower(nome) = lower('MARCOS ANTONIO') order by criado_em limit 1),
         'Melancia', 6642, 1.1743, 'WhatsApp — 1.107 melancias (1107 un x 6 kg)'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select 'b8b1251d-6032-4f3f-893b-2a69448a079e', '2026-09-18', (select id from public.fornecedores where lower(nome) = lower('VICTOR') order by criado_em limit 1),
         'Maracujá', 1580, 5.3300, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '883d3ca8-c977-4edb-8eac-1039fc0ba61e', '2026-09-19', (select id from public.fornecedores where lower(nome) = lower('SUELY') order by criado_em limit 1),
         'Goiaba', 350, 3.5286, 'WhatsApp — 14 cx'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '44afa59f-53e6-44f0-89de-6965f475e1ba', '2026-09-19', (select id from public.fornecedores where lower(nome) = lower('GILSON') order by criado_em limit 1),
         'Melancia', 1800, 1.1667, 'WhatsApp — 300 melancias (300 un x 6 kg)'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select 'b6f3cba2-d5d7-4ab4-8a63-5337ddfab342', '2026-09-19', (select id from public.fornecedores where lower(nome) = lower('RODRIGO') order by criado_em limit 1),
         'Tangerina Murcote', 200, 3.0000, 'WhatsApp — 10 cx (comprovante enviado 2x); kg ESTIMADO (20 kg/cx)'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '4417a2f9-17be-4ede-8991-1ee8c986d953', '2026-09-19', (select id from public.fornecedores where lower(nome) = lower('LUIS EDUARDO') order by criado_em limit 1),
         'Tangerina Ponkan', 275, 3.4545, 'WhatsApp — 11 cx; kg ESTIMADO (25 kg/cx)'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '35e3080f-a412-428a-809a-31ad09786cdc', '2026-09-21', (select id from public.fornecedores where lower(nome) = lower('MASCARENHAS (AVF)') order by criado_em limit 1),
         'Mamão Havaí', 5605, 2.0000, 'WhatsApp — 5.605 kg a R$ 2,00 — pago ao Xande'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '8b487401-bebe-4498-8d44-4833f4f9f849', '2026-09-22', (select id from public.fornecedores where lower(nome) = lower('JPJS') order by criado_em limit 1),
         'Ameixa Fresca Importada', 71, 15.3200, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '27362e5f-528d-49bd-87c6-e88e9f202e09', '2026-09-22', (select id from public.fornecedores where lower(nome) = lower('JPJS') order by criado_em limit 1),
         'Laranja Navelina', 30, 8.2667, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select 'e0233e01-e1bb-4077-8689-c95c159adbe7', '2026-09-22', (select id from public.fornecedores where lower(nome) = lower('JPJS') order by criado_em limit 1),
         'Limão Siciliano', 25, 11.9000, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '46edbf83-75b8-4c68-8de8-0a68d83229b3', '2026-09-22', (select id from public.fornecedores where lower(nome) = lower('AVF') order by criado_em limit 1),
         'Mamão Havaí', 162, 3.3333, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '1f0c221f-39d7-43de-8485-5c6261332d0b', '2026-09-22', (select id from public.fornecedores where lower(nome) = lower('JPJS') order by criado_em limit 1),
         'Manga Espada', 95, 3.3684, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '0ce78dbe-6c72-4b97-89d3-352346afecce', '2026-09-22', (select id from public.fornecedores where lower(nome) = lower('VICTOR') order by criado_em limit 1),
         'Maracujá', 850, 5.3300, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select 'afd8e5d1-7c1a-45d1-8124-3f8479116d5b', '2026-09-22', (select id from public.fornecedores where lower(nome) = lower('JPJS') order by criado_em limit 1),
         'Pera D''Anjou', 108, 10.0000, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '5d4cfa1d-10d9-423b-8ec1-55f503376a70', '2026-09-24', (select id from public.fornecedores where lower(nome) = lower('JPJS') order by criado_em limit 1),
         'Laranja Navelina', 15, 8.3300, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '7c085bb8-3898-4615-85ac-6484ad6e7d4d', '2026-09-24', (select id from public.fornecedores where lower(nome) = lower('FRANK') order by criado_em limit 1),
         'Manga Espada', 98, 2.9000, 'Planilha'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '7ed69835-863a-4bb3-815e-7bd0f6cd63ca', '2026-09-26', (select id from public.fornecedores where lower(nome) = lower('JOSÉ DAVID') order by criado_em limit 1),
         'Coco Seco', 30, 2.3000, 'WhatsApp — 30 cocos a R$ 2,30'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '434dfb7d-9dd0-4a32-8df9-96e63be10d5f', '2026-09-26', (select id from public.fornecedores where lower(nome) = lower('AVF') order by criado_em limit 1),
         'Mamão Havaí', 216, 3.0000, 'WhatsApp — 216 kg a R$ 3,00'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '84309d23-21a4-4fe2-88de-162cb1ca946c', '2026-09-26', (select id from public.fornecedores where lower(nome) = lower('MARCOS ANTONIO') order by criado_em limit 1),
         'Melancia', 10500, 1.1667, 'WhatsApp — 1.750 melancias (1750 un x 6 kg)'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select 'ca6db215-e8d0-47ea-88ac-d3a038945d56', '2026-09-29', (select id from public.fornecedores where lower(nome) = lower('AVF') order by criado_em limit 1),
         'Mamão Havaí', 420, 3.0000, 'WhatsApp — 420 kg a R$ 3,00 (legenda diz 29/10; é 29/09)'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '826a2e37-2c20-46d4-8a03-85326074d3f5', '2026-09-30', (select id from public.fornecedores where lower(nome) = lower('ATAKAREJO') order by criado_em limit 1),
         'Limão', 500, 5.5900, 'WhatsApp — Pix 30/09 — 500 kg a R$ 5,59'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '272c6b54-925a-4bf3-8e31-428a5a45f013', '2026-09-30', (select id from public.fornecedores where lower(nome) = lower('ATAKAREJO') order by criado_em limit 1),
         'Limão', 1500, 5.5900, 'WhatsApp — Pix 30/09 — 1.500 kg a R$ 5,59'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select 'cbca8710-3beb-4a49-8cfd-046bab0f9c34', '2026-09-30', (select id from public.fornecedores where lower(nome) = lower('MASCARENHAS') order by criado_em limit 1),
         'Mamão Havaí', 5835, 1.8484, 'WhatsApp — 5.835 kg — Wellington dos Santos Costa'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select 'da193e35-2c2d-4e48-8181-e28ebe3cf68c', '2026-10-01', (select id from public.fornecedores where lower(nome) = lower('AVF') order by criado_em limit 1),
         'Mamão Havaí', 468, 3.0000, 'WhatsApp — 468 kg a R$ 3,00'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '7cf052f2-0497-4eb8-8ddc-a8ceecc21199', '2026-10-03', (select id from public.fornecedores where lower(nome) = lower('KLEBER') order by criado_em limit 1),
         'Goiaba', 900, 3.7222, 'WhatsApp — 36 cx'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select 'c667e522-b154-4a1d-8a74-6ad344e3c047', '2026-10-03', (select id from public.fornecedores where lower(nome) = lower('JOSÉ VALDO') order by criado_em limit 1),
         'Mamão Formosa', 180, 1.8000, 'WhatsApp — 180 kg mamão formosa 2ª a R$ 1,80'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '28ff73d5-11fc-4686-8107-c7a25381695a', '2026-10-03', (select id from public.fornecedores where lower(nome) = lower('AVF') order by criado_em limit 1),
         'Mamão Havaí', 504, 3.0000, 'WhatsApp — 504 kg a R$ 3,00'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '4fbc2e28-5cd6-4a61-88c1-33882d45c41f', '2026-10-03', (select id from public.fornecedores where lower(nome) = lower('MARCOS ANTONIO') order by criado_em limit 1),
         'Melancia', 4500, 0.9111, 'WhatsApp — 750 melancias (750 un x 6 kg)'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '3b313e1a-1ba9-4170-8ed8-82f961721c3d', '2026-10-03', (select id from public.fornecedores where lower(nome) = lower('RODRIGO') order by criado_em limit 1),
         'Tangerina Murcote', 580, 3.0000, 'WhatsApp — 29 cx; kg ESTIMADO (20 kg/cx)'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select '92ad65e1-200a-4d10-88a9-4c55dcf9bbf6', '2026-10-05', (select id from public.fornecedores where lower(nome) = lower('ATAKAREJO') order by criado_em limit 1),
         'Limão', 2000, 5.5900, 'WhatsApp — Pix 05/10 — 100 cx, 2.000 kg a R$ 5,59 (cupom 13939)'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;
insert into public.compras (id, data, fornecedor_id, fruta, peso_kg, valor_kg, observacao)
  select 'b01f3686-1e8c-4eda-8f0f-30a8f87b8ac9', '2026-10-05', (select id from public.fornecedores where lower(nome) = lower('MASCARENHAS') order by criado_em limit 1),
         'Mamão Havaí', 6160, 2.0000, 'WhatsApp — 6.160 kg a R$ 2,00 — Fábio Pereira da Silva'
  on conflict (id) do update set peso_kg = excluded.peso_kg, valor_kg = excluded.valor_kg, observacao = excluded.observacao;

-- Vendas (uma por dia + cliente + vendedor; cada fruta é um item)
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select 'e6376126-4b6b-4628-850f-4dfd52b2c918', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-08-17', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Limão') limit 1), 'qty', 1050, 'precoUnitario', 4, 'kgPorUnidade', 1, 'kgTotal', 1050, 'natureza', 'venda')), 4200.00, 1050, 'pago', 'avf'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('DIVERSOS') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '0034ed54-7c8b-4cc6-8218-e42df4b57e2e', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-08-18', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Olé') limit 1), 'qty', 175, 'precoUnitario', 3.8, 'kgPorUnidade', 1, 'kgTotal', 175, 'natureza', 'venda')), 665.00, 175, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('DIVERSOS') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select 'a76858ac-cebe-4ada-8687-c406aa1a5b20', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-08-19', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Limão') limit 1), 'qty', 600, 'precoUnitario', 4, 'kgPorUnidade', 1, 'kgTotal', 600, 'natureza', 'venda')), 2400.00, 600, 'pago', 'avf'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('DIVERSOS') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '06d6b787-3dd1-448a-89d4-cbe1b53eb7f5', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-08-21', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Ponkan') limit 1), 'qty', 571, 'precoUnitario', 3.41, 'kgPorUnidade', 1, 'kgTotal', 571, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Maracujá') limit 1), 'qty', 1393, 'precoUnitario', 7.7, 'kgPorUnidade', 1, 'kgTotal', 1393, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Maracujá') limit 1), 'qty', 649, 'precoUnitario', 7.7, 'kgPorUnidade', 1, 'kgTotal', 649, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Ameixa Fresca Importada') limit 1), 'qty', 42, 'precoUnitario', 17.43, 'kgPorUnidade', 1, 'kgTotal', 42, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Ameixa Fresca Importada') limit 1), 'qty', 26, 'precoUnitario', 17.43, 'kgPorUnidade', 1, 'kgTotal', 26, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Abacate') limit 1), 'qty', 906, 'precoUnitario', 3.15, 'kgPorUnidade', 1, 'kgTotal', 906, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Goiaba') limit 1), 'qty', 291, 'precoUnitario', 2.95, 'kgPorUnidade', 1, 'kgTotal', 291, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Melão Orange') limit 1), 'qty', 84, 'precoUnitario', 4.82, 'kgPorUnidade', 1, 'kgTotal', 84, 'natureza', 'venda')), 22972.98, 3962, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '7d495fe2-1281-427b-880d-0826fe6f6289', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-08-21', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Ponkan') limit 1), 'qty', 300, 'precoUnitario', 3, 'kgPorUnidade', 1, 'kgTotal', 300, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Ponkan') limit 1), 'qty', 130, 'precoUnitario', 3, 'kgPorUnidade', 1, 'kgTotal', 130, 'natureza', 'venda')), 1290.00, 430, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BOMBOM') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '3b07d4e0-6008-4c8b-8f41-e5c7edc1ae0d', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-08-21', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Ponkan') limit 1), 'qty', 75, 'precoUnitario', 3.4, 'kgPorUnidade', 1, 'kgTotal', 75, 'natureza', 'venda')), 255.00, 75, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BRAUNA') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '365aa1e2-df19-4c31-8a23-e8a88bf06d49', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-08-21', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Limão') limit 1), 'qty', 200, 'precoUnitario', 4.4, 'kgPorUnidade', 1, 'kgTotal', 200, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Limão') limit 1), 'qty', 50, 'precoUnitario', 4.6, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Pera D''Anjou') limit 1), 'qty', 36, 'precoUnitario', 13, 'kgPorUnidade', 1, 'kgTotal', 36, 'natureza', 'venda')), 1578.00, 286, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('DIVERSOS') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select 'c813c577-bbfd-407b-81ab-12547a812b66', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-08-24', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Ponkan') limit 1), 'qty', 75, 'precoUnitario', 3.5, 'kgPorUnidade', 1, 'kgTotal', 75, 'natureza', 'venda')), 262.50, 75, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BOMBOM') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '51173723-0487-4f7c-8264-72b9785b9347', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-08-25', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Ponkan') limit 1), 'qty', 184, 'precoUnitario', 3.67, 'kgPorUnidade', 1, 'kgTotal', 184, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Goiaba') limit 1), 'qty', 264, 'precoUnitario', 3.84, 'kgPorUnidade', 1, 'kgTotal', 264, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Kiwi Importado') limit 1), 'qty', 206, 'precoUnitario', 23.89, 'kgPorUnidade', 1, 'kgTotal', 206, 'natureza', 'venda')), 6610.38, 654, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select 'a0ef027d-9f7f-40dc-8945-bcdc3f10b7ec', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-08-27', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Ponkan') limit 1), 'qty', 160, 'precoUnitario', 3.67, 'kgPorUnidade', 1, 'kgTotal', 160, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Goiaba') limit 1), 'qty', 292, 'precoUnitario', 3.84, 'kgPorUnidade', 1, 'kgTotal', 292, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Kiwi Importado') limit 1), 'qty', 108, 'precoUnitario', 23.89, 'kgPorUnidade', 1, 'kgTotal', 108, 'natureza', 'venda')), 4288.60, 560, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '80e033e0-b269-4151-8ffc-a2f3fb4c22a5', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-08-27', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Ponkan') limit 1), 'qty', 130, 'precoUnitario', 4.3, 'kgPorUnidade', 1, 'kgTotal', 130, 'natureza', 'venda')), 559.00, 130, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BOMBOM') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '6f830613-6718-4b43-8b89-a8dabc163b5e', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-08-28', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Limão') limit 1), 'qty', 2000, 'precoUnitario', 3.8976, 'kgPorUnidade', 1, 'kgTotal', 2000, 'natureza', 'venda')), 7795.20, 2000, 'pago', 'avf'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('CD MIX') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select 'aaf2472b-1be5-4ebd-8470-714a69a69ed4', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-08-28', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Limão') limit 1), 'qty', 47, 'precoUnitario', 4, 'kgPorUnidade', 1, 'kgTotal', 47, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Limão') limit 1), 'qty', 1150, 'precoUnitario', 4, 'kgPorUnidade', 1, 'kgTotal', 1150, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Olé') limit 1), 'qty', 270, 'precoUnitario', 3.5, 'kgPorUnidade', 1, 'kgTotal', 270, 'natureza', 'venda')), 5733.00, 1467, 'pago', 'avf'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('DIVERSOS') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '516f3974-b20f-490e-89f2-adcbaca5b904', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-08-28', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Limão') limit 1), 'qty', 25, 'precoUnitario', 3.8, 'kgPorUnidade', 1, 'kgTotal', 25, 'natureza', 'venda')), 95.00, 25, 'pago', 'avf'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ISMERALDA') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '5bb9b5f1-46ee-4f97-8d9c-c8796f5e1488', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-08-28', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Limão') limit 1), 'qty', 120, 'precoUnitario', 4.8, 'kgPorUnidade', 1, 'kgTotal', 120, 'natureza', 'venda')), 576.00, 120, 'pago', 'avf'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('MIX') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select 'cbfe2fba-aab4-4ba0-8638-4bbf2aa43f09', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-08-28', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Limão') limit 1), 'qty', 550, 'precoUnitario', 4, 'kgPorUnidade', 1, 'kgTotal', 550, 'natureza', 'venda')), 2200.00, 550, 'pago', 'avf'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('RODRIGO') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '7cc3f49c-23ae-4716-8d98-dd78e1211668', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-08-29', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Ponkan') limit 1), 'qty', 278, 'precoUnitario', 3.67, 'kgPorUnidade', 1, 'kgTotal', 278, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Goiaba') limit 1), 'qty', 239, 'precoUnitario', 3.84, 'kgPorUnidade', 1, 'kgTotal', 239, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Kiwi Importado') limit 1), 'qty', 100, 'precoUnitario', 23.89, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')), 4327.02, 617, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '081152d0-5298-4ef8-8ae7-1a466d539adc', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-02', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Coco Seco') limit 1), 'qty', 13, 'precoUnitario', 3.93, 'kgPorUnidade', 1, 'kgTotal', 13, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Manga Tommy Atkins') limit 1), 'qty', 291, 'precoUnitario', 3.33, 'kgPorUnidade', 1, 'kgTotal', 291, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Ponkan') limit 1), 'qty', 268, 'precoUnitario', 4.41, 'kgPorUnidade', 1, 'kgTotal', 268, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Goiaba') limit 1), 'qty', 259, 'precoUnitario', 3.93, 'kgPorUnidade', 1, 'kgTotal', 259, 'natureza', 'venda')), 3219.87, 831, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '92e66a9b-1857-4a6f-8b1e-9541d41c0cc1', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-03', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Pera Portuguesa') limit 1), 'qty', 33, 'precoUnitario', 11.21, 'kgPorUnidade', 1, 'kgTotal', 33, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Coco Seco') limit 1), 'qty', 59, 'precoUnitario', 4.28, 'kgPorUnidade', 1, 'kgTotal', 59, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Manga Tommy Atkins') limit 1), 'qty', 57, 'precoUnitario', 3.33, 'kgPorUnidade', 1, 'kgTotal', 57, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Ponkan') limit 1), 'qty', 171, 'precoUnitario', 4.41, 'kgPorUnidade', 1, 'kgTotal', 171, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Goiaba') limit 1), 'qty', 257, 'precoUnitario', 3.93, 'kgPorUnidade', 1, 'kgTotal', 257, 'natureza', 'venda')), 2576.38, 577, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '7666ddcc-3bb7-45e9-8ff1-568e15e03550', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-05', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Pera Portuguesa') limit 1), 'qty', 49, 'precoUnitario', 11.21, 'kgPorUnidade', 1, 'kgTotal', 49, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Coco Seco') limit 1), 'qty', 40, 'precoUnitario', 4.28, 'kgPorUnidade', 1, 'kgTotal', 40, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Manga Tommy Atkins') limit 1), 'qty', 272, 'precoUnitario', 3.33, 'kgPorUnidade', 1, 'kgTotal', 272, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Goiaba') limit 1), 'qty', 69, 'precoUnitario', 3.39, 'kgPorUnidade', 1, 'kgTotal', 69, 'natureza', 'venda')), 1860.16, 430, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select 'cd28651d-703e-4c70-8236-ab0e1059d7cd', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-08', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Coco Seco') limit 1), 'qty', 40, 'precoUnitario', 3.67, 'kgPorUnidade', 1, 'kgTotal', 40, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Manga Tommy Atkins') limit 1), 'qty', 451, 'precoUnitario', 3.33, 'kgPorUnidade', 1, 'kgTotal', 451, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Melancia') limit 1), 'qty', 1052, 'precoUnitario', 7.43, 'kgPorUnidade', 6, 'kgTotal', 6312, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Pinha') limit 1), 'qty', 55, 'precoUnitario', 14.7, 'kgPorUnidade', 1, 'kgTotal', 55, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Ponkan') limit 1), 'qty', 63, 'precoUnitario', 4.41, 'kgPorUnidade', 1, 'kgTotal', 63, 'natureza', 'venda')), 10551.32, 6921, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select 'fd02fee8-3bae-4f40-8c86-df7d7dda8411', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-10', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Coco Seco') limit 1), 'qty', 35, 'precoUnitario', 3.67, 'kgPorUnidade', 1, 'kgTotal', 35, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Manga Tommy Atkins') limit 1), 'qty', 90, 'precoUnitario', 3.33, 'kgPorUnidade', 1, 'kgTotal', 90, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Melancia') limit 1), 'qty', 99, 'precoUnitario', 7.43, 'kgPorUnidade', 6, 'kgTotal', 594, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Ponkan') limit 1), 'qty', 46, 'precoUnitario', 3.67, 'kgPorUnidade', 1, 'kgTotal', 46, 'natureza', 'venda')), 1332.54, 765, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '6d6d0041-1706-46e5-888f-e0fda42d07ce', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-11', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Ponkan') limit 1), 'qty', 200, 'precoUnitario', 3.9, 'kgPorUnidade', 1, 'kgTotal', 200, 'natureza', 'venda')), 780.00, 200, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BOMBOM') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '3e2d51b8-6bad-41f2-8c26-fcd503d21913', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-12', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Manga Tommy Atkins') limit 1), 'qty', 380, 'precoUnitario', 3.33, 'kgPorUnidade', 1, 'kgTotal', 380, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Murcote') limit 1), 'qty', 444, 'precoUnitario', 3.93, 'kgPorUnidade', 1, 'kgTotal', 444, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Melancia') limit 1), 'qty', 420, 'precoUnitario', 7.43, 'kgPorUnidade', 6, 'kgTotal', 2520, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Ponkan') limit 1), 'qty', 289, 'precoUnitario', 3.67, 'kgPorUnidade', 1, 'kgTotal', 289, 'natureza', 'venda')), 7191.55, 3633, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '287c49dd-73b6-4f77-8a5f-0dea1b94ca4b', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-15', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Murcote') limit 1), 'qty', 322, 'precoUnitario', 3.93, 'kgPorUnidade', 1, 'kgTotal', 322, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Melancia') limit 1), 'qty', 246, 'precoUnitario', 8.57, 'kgPorUnidade', 6, 'kgTotal', 1476, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Ponkan') limit 1), 'qty', 321, 'precoUnitario', 4.37, 'kgPorUnidade', 1, 'kgTotal', 321, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Goiaba') limit 1), 'qty', 106, 'precoUnitario', 3.84, 'kgPorUnidade', 1, 'kgTotal', 106, 'natureza', 'venda')), 5183.49, 2225, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select 'b5050098-91a8-4182-8c3a-00522959a6ba', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-17', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Melancia') limit 1), 'qty', 278, 'precoUnitario', 8.57, 'kgPorUnidade', 6, 'kgTotal', 1668, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Ponkan') limit 1), 'qty', 119, 'precoUnitario', 4.37, 'kgPorUnidade', 1, 'kgTotal', 119, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Goiaba') limit 1), 'qty', 68, 'precoUnitario', 3.84, 'kgPorUnidade', 1, 'kgTotal', 68, 'natureza', 'venda')), 3163.61, 1855, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '2a4e61a5-3974-44ea-87ac-8e93d60893c5', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-18', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Melancia') limit 1), 'qty', 300, 'precoUnitario', 6.47, 'kgPorUnidade', 6, 'kgTotal', 1800, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Melancia') limit 1), 'qty', 240, 'precoUnitario', 9.06, 'kgPorUnidade', 6, 'kgTotal', 1440, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Maracujá') limit 1), 'qty', 80, 'precoUnitario', 6.38, 'kgPorUnidade', 1, 'kgTotal', 80, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Maracujá') limit 1), 'qty', 300, 'precoUnitario', 6.38, 'kgPorUnidade', 1, 'kgTotal', 300, 'natureza', 'venda')), 6539.80, 3620, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select 'b8270ffc-c1c7-441a-85b8-f6dcce61b27c', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-18', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Limão') limit 1), 'qty', 2320, 'precoUnitario', 7.758621, 'kgPorUnidade', 1, 'kgTotal', 2320, 'natureza', 'venda')), 18000.00, 2320, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('JPJS') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '71ffad1e-dee5-43cc-8372-c3d535030b32', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-18', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Limão') limit 1), 'qty', 1393, 'precoUnitario', 8.183776, 'kgPorUnidade', 1, 'kgTotal', 1393, 'natureza', 'venda')), 11400.00, 1393, 'pendente', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('VICTOR') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select 'd5d8ebfb-f033-464d-860a-f8a364420ef9', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-19', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Limão') limit 1), 'qty', 487.59, 'precoUnitario', 7.752415, 'kgPorUnidade', 1, 'kgTotal', 487.59, 'natureza', 'venda')), 3780.00, 487.59, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('CARCARA') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '492e481b-6f8c-44f0-8dd2-a448c455adf7', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-19', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Limão') limit 1), 'qty', 1353.79, 'precoUnitario', 7.179843, 'kgPorUnidade', 1, 'kgTotal', 1353.79, 'natureza', 'venda')), 9720.00, 1353.79, 'pago', 'avf'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('RODRIGO') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '1e72d24d-80f5-46c4-849d-298e137ff86a', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-21', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Melancia') limit 1), 'qty', 200, 'precoUnitario', 8.31, 'kgPorUnidade', 6, 'kgTotal', 1200, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Ponkan') limit 1), 'qty', 48, 'precoUnitario', 4.16, 'kgPorUnidade', 1, 'kgTotal', 48, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Maracujá') limit 1), 'qty', 600, 'precoUnitario', 6.01, 'kgPorUnidade', 1, 'kgTotal', 600, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Goiaba') limit 1), 'qty', 54, 'precoUnitario', 4.06, 'kgPorUnidade', 1, 'kgTotal', 54, 'natureza', 'venda')), 5686.92, 1902, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '2c6b244a-d756-48a4-8635-e359526984b5', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-21', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Limão') limit 1), 'qty', 1392.6, 'precoUnitario', 7.755278, 'kgPorUnidade', 1, 'kgTotal', 1392.6, 'natureza', 'venda')), 10800.00, 1392.6, 'pago', 'avf'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('MIX') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select 'ca0b7190-1cba-4e98-8e09-575b70b88898', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-22', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Melancia') limit 1), 'qty', 320, 'precoUnitario', 8.31, 'kgPorUnidade', 6, 'kgTotal', 1920, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Limão Siciliano') limit 1), 'qty', 25, 'precoUnitario', 9.62, 'kgPorUnidade', 1, 'kgTotal', 25, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Ponkan') limit 1), 'qty', 15, 'precoUnitario', 3.93, 'kgPorUnidade', 1, 'kgTotal', 15, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Maracujá') limit 1), 'qty', 1017, 'precoUnitario', 5.68, 'kgPorUnidade', 1, 'kgTotal', 1017, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Ameixa Fresca Importada') limit 1), 'qty', 67, 'precoUnitario', 18.55, 'kgPorUnidade', 1, 'kgTotal', 67, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Laranja Navelina') limit 1), 'qty', 30, 'precoUnitario', 8.55, 'kgPorUnidade', 1, 'kgTotal', 30, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Manga Espada') limit 1), 'qty', 95, 'precoUnitario', 4.2, 'kgPorUnidade', 1, 'kgTotal', 95, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Pera D''Anjou') limit 1), 'qty', 108, 'precoUnitario', 10.87, 'kgPorUnidade', 1, 'kgTotal', 108, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Mamão Havaí') limit 1), 'qty', 162, 'precoUnitario', 4.29, 'kgPorUnidade', 1, 'kgTotal', 162, 'natureza', 'venda')), 12502.50, 3439, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '294eb84c-ebf3-471c-84f7-6b67e0f4b68a', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-22', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Ponkan') limit 1), 'qty', 17, 'precoUnitario', 5, 'kgPorUnidade', 1, 'kgTotal', 17, 'natureza', 'venda')), 85.00, 17, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('BOMBOM') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select 'ee3cea81-501f-4aa5-8d62-7f452dcb7771', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-22', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Limão') limit 1), 'qty', 100, 'precoUnitario', 7, 'kgPorUnidade', 1, 'kgTotal', 100, 'natureza', 'venda')), 700.00, 100, 'pendente', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('DIVERSOS') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '42651322-5a0f-41d2-8ba4-707bb7a2aad1', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-22', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Melancia') limit 1), 'qty', 60, 'precoUnitario', 8.5, 'kgPorUnidade', 6, 'kgTotal', 360, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Melancia') limit 1), 'qty', 30, 'precoUnitario', 8.5, 'kgPorUnidade', 6, 'kgTotal', 180, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Maracujá') limit 1), 'qty', 50, 'precoUnitario', 5.5, 'kgPorUnidade', 1, 'kgTotal', 50, 'natureza', 'venda')), 1040.00, 590, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('DIVERSOS') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select 'c09d93c1-db39-47d7-8643-b0a7b6b8136d', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-24', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Melancia') limit 1), 'qty', 320, 'precoUnitario', 8.31, 'kgPorUnidade', 6, 'kgTotal', 1920, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Maracujá') limit 1), 'qty', 757, 'precoUnitario', 5.68, 'kgPorUnidade', 1, 'kgTotal', 757, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Ameixa Fresca Importada') limit 1), 'qty', 71, 'precoUnitario', 18.55, 'kgPorUnidade', 1, 'kgTotal', 71, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Laranja Navelina') limit 1), 'qty', 15, 'precoUnitario', 8.15, 'kgPorUnidade', 1, 'kgTotal', 15, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Manga Espada') limit 1), 'qty', 98, 'precoUnitario', 4.2, 'kgPorUnidade', 1, 'kgTotal', 98, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Pera D''Anjou') limit 1), 'qty', 70, 'precoUnitario', 10.87, 'kgPorUnidade', 1, 'kgTotal', 70, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Mamão Havaí') limit 1), 'qty', 259, 'precoUnitario', 4.29, 'kgPorUnidade', 1, 'kgTotal', 259, 'natureza', 'venda')), 10681.87, 3190, 'pago', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '09cabeab-9683-4b46-8d5c-2faa684c6239', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-26', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Coco Seco') limit 1), 'qty', 16, 'precoUnitario', 5.68, 'kgPorUnidade', 1, 'kgTotal', 16, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Ameixa Fresca Importada') limit 1), 'qty', 134, 'precoUnitario', 18.55, 'kgPorUnidade', 1, 'kgTotal', 134, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Laranja Navelina') limit 1), 'qty', 30, 'precoUnitario', 8.15, 'kgPorUnidade', 1, 'kgTotal', 30, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Mamão Havaí') limit 1), 'qty', 194, 'precoUnitario', 4.29, 'kgPorUnidade', 1, 'kgTotal', 194, 'natureza', 'venda')), 3653.34, 374, 'pendente', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;
insert into public.vendas (id, numero, loja_id, data, prazo_dias, itens, total, kg_total, status, recebedor)
  select '0066d1b1-0323-4070-8534-5596cbebb697', (select coalesce(max(numero), 1000) + 1 from public.vendas), l.id, '2026-09-29', 0,
         jsonb_build_array(jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Coco Seco') limit 1), 'qty', 20, 'precoUnitario', 5.68, 'kgPorUnidade', 1, 'kgTotal', 20, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Murcote') limit 1), 'qty', 16, 'precoUnitario', 3.93, 'kgPorUnidade', 1, 'kgTotal', 16, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Melancia') limit 1), 'qty', 349, 'precoUnitario', 8.31, 'kgPorUnidade', 6, 'kgTotal', 2094, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Melancia') limit 1), 'qty', 650, 'precoUnitario', 8.31, 'kgPorUnidade', 6, 'kgTotal', 3900, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Pinha') limit 1), 'qty', 76, 'precoUnitario', 14, 'kgPorUnidade', 1, 'kgTotal', 76, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Tangerina Ponkan') limit 1), 'qty', 128, 'precoUnitario', 4.37, 'kgPorUnidade', 1, 'kgTotal', 128, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Ameixa Fresca Importada') limit 1), 'qty', 132, 'precoUnitario', 17.5, 'kgPorUnidade', 1, 'kgTotal', 132, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Goiaba') limit 1), 'qty', 291, 'precoUnitario', 4.28, 'kgPorUnidade', 1, 'kgTotal', 291, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Manga Espada') limit 1), 'qty', 247, 'precoUnitario', 4.28, 'kgPorUnidade', 1, 'kgTotal', 247, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Pera D''Anjou') limit 1), 'qty', 124, 'precoUnitario', 10.87, 'kgPorUnidade', 1, 'kgTotal', 124, 'natureza', 'venda'), jsonb_build_object('produtoId', (select id from public.produtos where lower(nome) = lower('Mamão Havaí') limit 1), 'qty', 420, 'precoUnitario', 4.49, 'kgPorUnidade', 1, 'kgTotal', 420, 'natureza', 'venda')), 17947.85, 7448, 'pendente', 'carvalho_cruz'
  from public.lojas l join public.redes r on r.id = l.rede_id
  where lower(r.nome) = lower('ATAKAREJO') and lower(l.nome) = lower('MATRIZ')
  on conflict (id) do update set itens = excluded.itens, total = excluded.total, kg_total = excluded.kg_total, status = excluded.status, recebedor = excluded.recebedor;

-- Repasses das contas CC/AVF para a CVC (ver migração 69)
insert into public.repasses (id, data, conta, sentido, valor, descricao)
  values ('f160df1c-f833-4ccd-8a48-fbc7e3146c03', '2026-08-13', 'avf', 'para_cvc', 23730.00, 'Pix Xande → CC')
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao;
insert into public.repasses (id, data, conta, sentido, valor, descricao)
  values ('5a9ba9bf-1cd6-4ab5-80df-ee8653e66987', '2026-08-17', 'avf', 'para_cvc', 4200.00, 'Pix Xande → CC (limão AVF 1.050 kg)')
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao;
insert into public.repasses (id, data, conta, sentido, valor, descricao)
  values ('8f512367-366b-4234-8f9d-05e52f5a4cdc', '2026-08-19', 'avf', 'para_cvc', 2400.00, 'Pix Xande → CC (limão AVF 600 kg)')
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao;
insert into public.repasses (id, data, conta, sentido, valor, descricao)
  values ('d1ae63e0-d04c-46da-8afd-300436366a4a', '2026-09-01', 'avf', 'para_cvc', 7795.20, 'Pix Xande → CC (limão CD Mix 2.000 kg)')
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao;
insert into public.repasses (id, data, conta, sentido, valor, descricao)
  values ('f4e43b2b-c59d-4515-890f-b7980b1be041', '2026-09-15', 'avf', 'para_cvc', 16883.80, 'Pix Xande → CC')
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao;
insert into public.repasses (id, data, conta, sentido, valor, descricao)
  values ('b7dad614-78d4-4010-8052-bb6e930e7ef2', '2026-09-17', 'avf', 'para_cvc', 1259.00, 'Pix Xande → CC')
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao;
insert into public.repasses (id, data, conta, sentido, valor, descricao)
  values ('9754201c-e546-4169-8600-754f56c3b313', '2026-09-17', 'avf', 'para_cvc', 945.00, 'Pix Xande → CC (comprovante enviado nos dois grupos)')
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao;
insert into public.repasses (id, data, conta, sentido, valor, descricao)
  values ('93f70a9a-8788-4aac-88a5-0a4dd9d8ee5b', '2026-09-19', 'avf', 'para_cvc', 9720.00, 'Pix Xande → CC (limão Rodrigo)')
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao;
insert into public.repasses (id, data, conta, sentido, valor, descricao)
  values ('176d0a6a-0a96-4d52-8db2-97e040499702', '2026-09-19', 'avf', 'para_cvc', 280.00, 'Pix Xande → CC')
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao;
insert into public.repasses (id, data, conta, sentido, valor, descricao)
  values ('9a256232-b671-4b50-857f-ce1d94163436', '2026-09-22', 'avf', 'para_cvc', 10800.00, 'Pix Xande → CC (limão Mix)')
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao;
insert into public.repasses (id, data, conta, sentido, valor, descricao)
  values ('30caf945-f526-41df-8d6a-040ea4fd9ffc', '2026-09-25', 'avf', 'para_cvc', 546.00, 'Pix Xande → CC')
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao;
insert into public.repasses (id, data, conta, sentido, valor, descricao)
  values ('fb963714-7b20-43d2-8197-d3f6d6acd450', '2026-10-03', 'avf', 'para_cvc', 808.50, 'Pix Xande → CC')
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao;
insert into public.repasses (id, data, conta, sentido, valor, descricao)
  values ('d4df267d-4575-440c-8c04-2969f3272361', '2026-08-19', 'carvalho_cruz', 'para_cvc', 2464.43, 'Safra → Nu: mercadorias da semana passada Atakarejo')
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao;
insert into public.repasses (id, data, conta, sentido, valor, descricao)
  values ('9f7fa928-ff88-47bf-8e3f-9d1cd19b7461', '2026-08-21', 'carvalho_cruz', 'para_cvc', 326.00, 'Safra → Nu: frutas JPJS da Carvalho Cruz')
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao;
insert into public.repasses (id, data, conta, sentido, valor, descricao)
  values ('daa46c07-8b4a-4976-8bcb-e6fd8dc4b18d', '2026-08-21', 'carvalho_cruz', 'para_cvc', 5254.86, 'Safra → Nu: venda Atakarejo terça-feira')
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao;
insert into public.repasses (id, data, conta, sentido, valor, descricao)
  values ('8d0847f3-3db6-42c6-8760-eb74a468d6a4', '2026-08-21', 'carvalho_cruz', 'para_cvc', 3493.00, 'Safra → Nu: vendas de limão, ponkan, piemonte e pera d''Anjou')
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao;
insert into public.repasses (id, data, conta, sentido, valor, descricao)
  values ('a1a22f6f-268f-4459-8c81-1fc5bcdf4a53', '2026-09-14', 'carvalho_cruz', 'para_cvc', 16000.00, 'Safra → Nu: Dinheiro CVC')
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao;
insert into public.repasses (id, data, conta, sentido, valor, descricao)
  values ('f20d7bfb-ff39-482d-862c-ee81a9275dba', '2026-09-14', 'carvalho_cruz', 'para_cvc', 4000.00, 'Safra → Nu: Dinheiro CVC')
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao;
insert into public.repasses (id, data, conta, sentido, valor, descricao)
  values ('e91ece42-6fdc-4e69-85fd-23284a8938be', '2026-09-16', 'carvalho_cruz', 'para_cvc', 4000.00, 'Safra → Nu: Dinheiro CVC CC')
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao;
insert into public.repasses (id, data, conta, sentido, valor, descricao)
  values ('910fa6cc-5c54-4c49-8c07-6101b6e0b24e', '2026-09-17', 'carvalho_cruz', 'para_cvc', 10097.29, 'Safra → Nu: Dinheiro CVC (Carvalho Cruz zerada)')
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao;
insert into public.repasses (id, data, conta, sentido, valor, descricao)
  values ('c25eb7c9-cab0-4c57-8ce7-ef3d2f160271', '2026-09-23', 'carvalho_cruz', 'para_cvc', 46574.17, 'Safra → Nu: Mercadorias CVC')
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao;
insert into public.repasses (id, data, conta, sentido, valor, descricao)
  values ('86b7193d-3ad5-47f7-8648-ee46cee8c84d', '2026-09-25', 'carvalho_cruz', 'para_cvc', 10446.43, 'Safra → Nu: Vendas CVC quinta')
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao;
insert into public.repasses (id, data, conta, sentido, valor, descricao)
  values ('433f043f-a280-420b-8c0e-186703939f46', '2026-10-01', 'carvalho_cruz', 'para_cvc', 23726.23, 'Safra → Nu: Pagamento mercadorias CVC')
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao;

-- Perdas
insert into public.perdas (id, data, fruta, kg, custo_kg, motivo)
  values ('44b8e1dc-a6e9-44d6-8a40-3b7905562883', '2026-08-28', 'Abacate', 414, 3.2500, 'Perda')
  on conflict (id) do update set kg = excluded.kg, custo_kg = excluded.custo_kg;
insert into public.perdas (id, data, fruta, kg, custo_kg, motivo)
  values ('1f5ed020-f149-4838-86ea-2ffaa4b73426', '2026-08-24', 'Goiaba', 34, 3.2594, 'Perda')
  on conflict (id) do update set kg = excluded.kg, custo_kg = excluded.custo_kg;

-- Despesas
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('1fabf8cd-81ce-4555-84df-58ef632af712', '2026-08-10', 'Outros', 'Carrego camera fria', 300.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('1e8038d3-ece1-4525-8e18-f2f36bfd5f2a', '2026-08-11', 'Fretes', 'FRETE — Limão', 1521.65)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('e60104a7-9008-493c-8b31-3c1fdf61f849', '2026-08-11', 'Fretes', 'FRETE — Limão', 800.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('d6142a35-11c3-49c4-8b84-ca0993cd2e93', '2026-08-11', 'Fretes', 'FRETE — Tangerina Olé', 278.20)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('4d16d1ce-cef5-41ac-8ae4-0fa2609c29a6', '2026-08-14', 'Manutenção', 'Enxada', 80.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('25a0bf7a-abb9-4f59-8a9c-3e95b7f2b018', '2026-08-14', 'Outros', 'Limpeza sala', 320.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('fef4560c-a7a4-417b-85ec-62f877de3846', '2026-08-15', 'Outros', 'Limpeza cd', 150.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('f9621657-abaf-4122-871e-0a68e494d691', '2026-08-17', 'Outros', 'Almoco', 80.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('1bba89a8-51d8-4459-8e14-1fadbd85aba5', '2026-08-17', 'Outros', 'Detetizacao', 244.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('19911761-4226-4fd9-8bc5-3bcefd4767be', '2026-08-18', 'Diaristas', 'Triagem mercadoria', 200.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('4660185d-4ce2-4e89-89c5-cd2b7f989de7', '2026-08-19', 'Fretes', 'FRETE — Tangerina Ponkan', 255.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('2cf7961e-be2f-4479-80ca-fd5c218a9aff', '2026-08-19', 'Combustíveis', 'Frete — Posto Caio Bá II', 362.29)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('2f08077e-5580-4000-8402-97b770bd581f', '2026-08-21', 'Outros', 'IFCO — Abacate', 150.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('67949aa9-93ed-41a1-866d-2ee948a53949', '2026-08-21', 'Outros', 'IFCO — Goiaba', 42.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('8266cd2b-0b70-461b-8b99-c2ce84a1a9cd', '2026-08-21', 'Outros', 'IFCO — Maracujá', 327.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('d6fb2b14-00a9-4f34-8aca-03828184acbb', '2026-08-21', 'Outros', 'IFCO — Maracujá', 104.64)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('4401fb4f-37ce-42d4-818f-5f4791f3ca30', '2026-08-21', 'Outros', 'IFCO — Tangerina Ponkan', 80.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('95a926bc-784d-45d6-81e6-a0df5c7f9b60', '2026-08-22', 'Combustíveis', 'Combustível: buscar maracujá em Lagarto → Aracaju', 130.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('e3fa9343-3b29-49b9-88a9-70ed09abbaaa', '2026-08-22', 'Fretes', 'FRETE — Maracujá', 130.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('36d10ecb-8983-407d-8d08-bbb8eff107d0', '2026-08-22', 'Diaristas', 'Triagem mercadoria', 120.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('7695fe60-b808-43c8-8654-4ef55e465655', '2026-08-25', 'Combustíveis', 'Diesel ssa', 164.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('afd94434-2eb9-4af4-8e7b-31767e7f2037', '2026-08-30', 'Outros', 'IFCO — Goiaba', 127.53)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('a86cea3e-2db7-464d-889b-aa56ae521661', '2026-08-30', 'Outros', 'IFCO — Tangerina Ponkan', 104.64)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('e6ddd99d-5a39-40db-8c27-daf9b3291bf0', '2026-09-01', 'Outros', 'Abertura da firma CVC (Lázaro Carvalho Assessoria)', 780.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('2f967410-4f51-4496-8de9-29debbc6e92e', '2026-09-02', 'Outros', 'IFCO — Coco Seco', 3.27)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('894b232b-1f84-4080-885a-708e8d13ba1d', '2026-09-02', 'Outros', 'IFCO — Goiaba', 42.51)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('cd8c857e-ef07-44eb-8e42-0b0ed5c3bd82', '2026-09-02', 'Outros', 'IFCO — Manga Tommy Atkins', 45.78)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('46072740-b56d-4d0e-86f3-b627d86b657a', '2026-09-02', 'Outros', 'IFCO — Tangerina Ponkan', 39.24)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('94537a46-8667-42f7-82ab-6ad2845a086d', '2026-09-03', 'Outros', 'IFCO — Coco Seco', 9.81)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('5bd62677-597e-4e92-8515-ce167da9b0e0', '2026-09-03', 'Outros', 'IFCO — Goiaba', 35.97)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('32eee9fb-8600-4162-8df1-debc5a67ee7e', '2026-09-03', 'Outros', 'IFCO — Manga Tommy Atkins', 13.08)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('5ea6247c-98fd-4888-8f31-e41449b33144', '2026-09-03', 'Outros', 'IFCO — Tangerina Ponkan', 26.16)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('e91370c4-1b3f-483b-80f7-de0bd8c8d400', '2026-09-05', 'Outros', 'IFCO — Coco Seco', 6.54)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('a58efe9e-96de-4adc-8abe-918ff772e6ce', '2026-09-05', 'Outros', 'IFCO — Goiaba', 9.81)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('592ead3f-ed3a-453d-8cba-b03960ead041', '2026-09-05', 'Outros', 'IFCO — Manga Tommy Atkins', 35.12)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('cc688996-5c92-42ef-8978-083f13a46056', '2026-09-08', 'Outros', 'IFCO — Coco Seco', 6.54)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('279c9411-bd32-4629-848e-cd109ce52f57', '2026-09-08', 'Outros', 'IFCO — Manga Tommy Atkins', 65.40)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('c50ec5b3-9e08-4838-8f02-28ff935a6555', '2026-09-08', 'Outros', 'IFCO — Pinha', 6.54)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('e8c2b25c-8b7f-4faa-8603-375f2d5f64ac', '2026-09-08', 'Outros', 'IFCO — Tangerina Ponkan', 9.81)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('35f1c0af-3138-4205-80a7-7ef965088358', '2026-09-09', 'Fretes', 'Frete melancia (Josilene)', 1250.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('76a4d3ad-6f79-43c2-88ac-12ef70d78460', '2026-09-10', 'Outros', 'IFCO — Coco Seco', 6.54)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('5aa7e8e2-df89-44bd-89da-6d8fdbacbaf0', '2026-09-10', 'Outros', 'IFCO — Manga Tommy Atkins', 16.35)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('856e9f27-381e-40f9-8755-ca8dec44c630', '2026-09-10', 'Outros', 'IFCO — Tangerina Ponkan', 6.54)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('36aafd99-6d27-4fb0-82dc-8c14874b322d', '2026-09-11', 'Outros', 'Descarga (Armazém Mateus)', 1150.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('0caf3257-9aff-4a24-8c51-9e8f16ca325e', '2026-09-11', 'Fretes', 'Frete: buscar tangerina W. Murcott em Neópolis', 350.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('c301871c-8a72-47fe-8339-7cd3dbf4c965', '2026-09-12', 'Fretes', 'Frete redinhas', 140.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('7c93661e-8d55-432c-81c1-5e08df976728', '2026-09-12', 'Outros', 'IFCO — Manga Tommy Atkins', 55.59)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('025fd05f-f8ee-4a22-8240-3219582e71f0', '2026-09-12', 'Outros', 'IFCO — Tangerina Murcote', 65.40)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('f797aa82-8a35-4f2a-8bcd-663faea3143b', '2026-09-12', 'Outros', 'IFCO — Tangerina Ponkan', 55.59)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('a9fbdf7c-f10c-497c-8576-e6cfcc795717', '2026-09-12', 'Outros', 'Redinha mamão Havaí — 10 sacos (Embalavale)', 4800.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('6444802d-adeb-40e1-8b9a-3ae7c240cc01', '2026-09-14', 'Outros', 'Almoço (Churrascaria Netto e Prestes)', 61.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('2ecba7f8-d45d-433b-8700-c42b7ab2fa8a', '2026-09-14', 'Outros', 'Encarregado mamão — bonificação', 200.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('36b76692-21d6-4da8-8057-701f41cb49aa', '2026-09-14', 'Impostos', 'ICMS mês 08 (SEFAZ-SE)', 2788.92)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('807d94c2-da25-41d1-8e19-25439d2034b4', '2026-09-14', 'Outros', 'Jantar (iFood)', 112.27)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('80a660e6-945d-4ee2-824a-800ce8bd1145', '2026-09-15', 'Outros', 'IFCO — Goiaba', 19.62)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('af5530c1-daef-4ae1-8537-fef5b0011081', '2026-09-15', 'Outros', 'IFCO — Tangerina Murcote', 52.32)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('de2f395f-92f7-4bc2-800a-a1d70be9c7e2', '2026-09-15', 'Outros', 'IFCO — Tangerina Ponkan', 55.59)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('261e22f1-0b54-43a5-825e-4df6688221e4', '2026-09-17', 'Diaristas', 'Descarrego limão (Márcio)', 450.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('2a884b21-d045-4880-8cc4-224bfdfeed36', '2026-09-17', 'Fretes', 'FRETE — Limão', 8560.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('787400f6-7d76-4c9a-8aa8-cb28eecc6292', '2026-09-17', 'Outros', 'IFCO — Goiaba', 9.81)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('abb6f66d-c69b-4614-85e2-327f74fe517c', '2026-09-17', 'Outros', 'IFCO — Tangerina Ponkan', 19.62)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('c24efb1c-1d74-417c-8262-d16b6888b390', '2026-09-19', 'Diaristas', '2 diaristas carregando mamão', 400.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('b99666e3-dc95-4825-8ef8-62fc8a5b5b29', '2026-09-19', 'Diaristas', '4 diaristas arrumando mamão em Neópolis', 400.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('ddbdd8d4-14de-40be-82c9-b8e447fc7e7a', '2026-09-19', 'Combustíveis', 'Combustível Lagarto → Neópolis (carregamento)', 220.12)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('bd99ba0d-1663-416f-8d91-1bfa9c86fc6e', '2026-09-19', 'Fretes', 'Frete redinha mamão', 140.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('0700a239-cf34-4f6b-8726-6d295e6c7d19', '2026-09-19', 'Outros', 'Redinha mamão Havaí — 10 sacos (Embalavale)', 4800.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('446f74fb-ee40-4e53-8c84-6498b863a6cf', '2026-09-22', 'Outros', 'Despesa — Maracujá', 281.22)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('b5ebc06e-28a4-4849-8a45-468be6d2d206', '2026-09-22', 'Outros', 'IFCO — Manga Espada', 16.35)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('89deb241-c1cc-4d23-80d8-31381c89120f', '2026-09-22', 'Outros', 'IFCO — Tangerina Ponkan', 3.27)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('1eb9980d-1af2-4468-863a-9c3f472f4a6a', '2026-09-24', 'Outros', 'IFCO — Mamão Havaí', 39.24)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('268e4d2b-06fc-4f9c-8a41-4b180c979509', '2026-09-24', 'Outros', 'IFCO — Manga Espada', 9.81)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('3cdc0399-6c25-452e-8d92-0e5cf9662b38', '2026-09-24', 'Outros', 'IFCO — Maracujá', 186.39)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('515704c6-18f0-4643-8ef6-e9179f0657f3', '2026-09-26', 'Diaristas', 'Ajudantes para o Atakarejo (Márcio)', 200.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('80695624-1b8b-43a1-86b3-659e9372fbe0', '2026-09-26', 'Outros', 'IFCO — Coco Seco', 3.27)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('72318fe6-4958-4950-848f-460319f57ac1', '2026-09-26', 'Outros', 'IFCO — Mamão Havaí', 29.43)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('d0937e9a-4525-415b-8092-3cb9159ac344', '2026-09-29', 'Combustíveis', 'Combustível', 150.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('f839ca76-81e1-438a-8406-dd15d686db23', '2026-09-29', 'Outros', 'IFCO — Coco Seco', 3.27)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('63aa9bd2-3a83-48a6-8db7-6bbe3fcbf573', '2026-09-29', 'Outros', 'IFCO — Goiaba', 39.24)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('370d1ba7-bd8f-403f-83ae-e446e086f48e', '2026-09-29', 'Outros', 'IFCO — Mamão Havaí', 55.59)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('2f7ea886-8d8a-416a-8efb-e00fb9ba0286', '2026-09-29', 'Outros', 'IFCO — Manga Espada', 39.24)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('7fecb46f-6394-4122-8731-54e9b74a25cb', '2026-09-29', 'Outros', 'IFCO — Pinha', 9.81)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('a657ffa5-3458-492b-8299-99b96def5951', '2026-09-29', 'Outros', 'IFCO — Tangerina Murcote', 3.27)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('082f69b7-6093-4963-85c3-d6fe8d6272c4', '2026-09-29', 'Outros', 'IFCO — Tangerina Ponkan', 19.62)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('40ed0a83-b5bd-4197-8cb4-1a0a15e546fd', '2026-09-30', 'Diaristas', '2 diaristas e horas extras do Guilherme carregando mamão', 360.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('9df4eb14-2adb-46fb-899f-d1548339b9d9', '2026-09-30', 'Outros', 'Balancão R$ 40 + janta R$ 30 (Guilherme)', 70.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('9f80bb84-d105-4c8d-8722-e49a0d8db9d1', '2026-10-03', 'Diaristas', '2 diárias, 2 cafés da manhã e 2 almoços', 500.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('af7b8281-b993-4222-8f16-9383784dcf32', '2026-10-03', 'Combustíveis', 'Combustível mamão Neópolis (Guilherme)', 166.01)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('8cb23dd2-2a07-4ba6-828d-0a33be3a3a69', '2026-10-05', 'Fretes', 'Frete redinhas', 140.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('a37f1f91-702c-4ae9-8a38-d5f19b1222f8', '2026-10-05', 'Outros', 'Jantar dos carregadores', 148.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;
insert into public.despesas (id, data, categoria, descricao, valor)
  values ('d103bbf5-e898-4a10-812d-ca4813284960', '2026-10-05', 'Outros', 'Redinha mamão Havaí — 10 sacos (Embalavale)', 4800.00)
  on conflict (id) do update set valor = excluded.valor, descricao = excluded.descricao, categoria = excluded.categoria;

commit;

-- Confira:  select * from public.vw_estoque_fruta order by fruta;  select * from public.vw_dre_mes;

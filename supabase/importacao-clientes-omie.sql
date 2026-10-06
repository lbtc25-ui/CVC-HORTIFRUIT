-- ============================================================================
--  Cadastro de clientes — gerado por scripts/importar-clientes-omie.py
--  NÃO edite à mão: exporte o cadastro do Omie de novo e rode o script.
--
--  Origem: clientes-omie.csv (export Omie — Serviços e NFS-e)
--
--  Rode DEPOIS de schema.sql, migracao-01-redes-lojas.sql e seed.sql.
--  Os ids vêm do nome da rede/loja, então reimportar ATUALIZA em vez de
--  duplicar.
--
--  Redes que já existem no app (vieram do histórico de vendas) só têm o
--  telefone completado, sem tocar nas lojas — o nome comercial da loja no
--  Omie não bate com o nome curto usado nas vendas. Empresa que ainda não
--  tinha rede no app entra nova, com uma loja por filial do Omie.
-- ============================================================================

begin;

-- ─── Enriquecimento das redes já existentes ─────────────────────────────────
-- Só completa o telefone se ele estiver vazio; nunca sobrescreve o que já tem.

update public.redes set telefone = coalesce(telefone, '(71) 3660-8768')
  where lower(nome) = lower('ATAKAREJO');
update public.redes set telefone = coalesce(telefone, '(79) 3512-7000')
  where lower(nome) = lower('BOMBOM');
update public.redes set telefone = coalesce(telefone, '(79) 3024-6467')
  where lower(nome) = lower('BRAUNA');
update public.redes set telefone = coalesce(telefone, '(79) 2107-5454')
  where lower(nome) = lower('FASOUTO');
update public.redes set telefone = coalesce(telefone, '(79) 9840-3132')
  where lower(nome) = lower('HIPER CARNES');
update public.redes set telefone = coalesce(telefone, '(79) 92107-5200')
  where lower(nome) = lower('HOTEL AQUARIUS');
update public.redes set telefone = coalesce(telefone, '(79) 9989-3232')
  where lower(nome) = lower('J.PEIXOTO');
update public.redes set telefone = coalesce(telefone, '(79) 3431-1970')
  where lower(nome) = lower('NUNES PEIXOTO');
update public.redes set telefone = coalesce(telefone, '(79) 3041-7378')
  where lower(nome) = lower('PANDELLI');
update public.redes set telefone = coalesce(telefone, '(79) 3225-4300')
  where lower(nome) = lower('PETROX');
update public.redes set telefone = coalesce(telefone, '(79) 2105-2500')
  where lower(nome) = lower('PRIMAVERA');
update public.redes set telefone = coalesce(telefone, '(79) 3223-1048')
  where lower(nome) = lower('REDE ALPHA');
update public.redes set telefone = coalesce(telefone, '(79) 9995-6666')
  where lower(nome) = lower('REDE MAIS');
update public.redes set telefone = coalesce(telefone, '(79) 3431-3680')
  where lower(nome) = lower('SERRANO');
update public.redes set telefone = coalesce(telefone, '(79) 9815-2604')
  where lower(nome) = lower('SILVA SUPERMERCADO');
update public.redes set telefone = coalesce(telefone, '(79) 9932-3325')
  where lower(nome) = lower('SOUZA');
update public.redes set telefone = coalesce(telefone, '(79) 3215-1375')
  where lower(nome) = lower('TABAJARA');
update public.redes set telefone = coalesce(telefone, '(79) 8177-7942')
  where lower(nome) = lower('VINICIUS');

-- ─── Redes novas, com as lojas do Omie ──────────────────────────────────────

insert into public.redes (id, nome, telefone) values
  ('d4fe675b-fcce-4318-8046-a102b6c7ee19', 'ARTHUR GOIS BORGES', null)
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome, telefone) values
  ('53040502-b82c-49ca-8781-8dd0e0fcca39', 'BEIRA MAR MINIMERCADO', '(79) 9652-5797')
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome, telefone) values
  ('6aae8802-5dab-47be-8607-82f0e6269a46', 'CLINICA SENHORA SANTANA', null)
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome, telefone) values
  ('1aea0873-cbc3-4401-8ee1-00f00e89d08f', 'GONZAGA', '(79) 3232-1398')
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome, telefone) values
  ('9edd42ee-ca9b-4038-8735-49f040b7fa4c', 'JOSE WILSON GOMES JUNIOR', '(71) 9284-2073')
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome, telefone) values
  ('cf7fc7ba-56cd-4911-8776-93685c2d2393', 'MEL DISTRIBUIDORA', '(79) 99842-7850')
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome, telefone) values
  ('e7da3a88-9000-40eb-8a07-f3114e22078e', 'PANIFICACAO E MERCEARIA COMPRE BEM', '(79) 3431-3076')
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome, telefone) values
  ('7e6c4f3e-d5dd-41af-8844-e41cbb222782', 'SUPERMERCADO BEIRA RIO', null)
  on conflict (lower(nome)) do nothing;
insert into public.redes (id, nome, telefone) values
  ('943d804e-f676-4a78-8ca9-7883ab16e43e', 'SUPERMERCADO MAIS ECONOMIA', '(79) 9831-4068')
  on conflict (lower(nome)) do nothing;

insert into public.lojas (id, rede_id, nome, cidade, telefone)
  select 'b9bd3325-a315-45d2-817b-b2d301d1100b', r.id, 'ARTHUR GOIS BORGES', 'Aracaju', null
  from public.redes r where lower(r.nome) = lower('ARTHUR GOIS BORGES')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome, cidade, telefone)
  select '454da274-83e9-45aa-8614-f3e7c902e2c4', r.id, 'BEIRA MAR MINIMERCADO', 'Aracaju', '(79) 9652-5797'
  from public.redes r where lower(r.nome) = lower('BEIRA MAR MINIMERCADO')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome, cidade, telefone)
  select '9aafda7b-707f-49cd-8f41-632b68eb5b08', r.id, 'CLINICA SENHORA SANTANA', 'Aquidaba', null
  from public.redes r where lower(r.nome) = lower('CLINICA SENHORA SANTANA')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome, cidade, telefone)
  select '41cef6d9-a9dd-4f1f-8064-36222d1b22be', r.id, 'GONZAGA HIPERMERCADO - LUZIA', 'Aracaju', '(79) 3232-1398'
  from public.redes r where lower(r.nome) = lower('GONZAGA')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome, cidade, telefone)
  select 'c6fa5a6a-e5b1-41b4-8c8c-69a59b2ae6bb', r.id, 'GONZAGA EXPRESS', 'Aracaju', '(79) 3232-1398'
  from public.redes r where lower(r.nome) = lower('GONZAGA')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome, cidade, telefone)
  select 'fde470d6-f679-4eae-8db4-17b76a4c8090', r.id, 'GONZAGA HIPERMERCADO - PONTO NOVO', 'Aracaju', '(79) 9688-7947'
  from public.redes r where lower(r.nome) = lower('GONZAGA')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome, cidade, telefone)
  select '929fc54d-c000-4344-8564-3790dba84b8b', r.id, 'JOSE WILSON GOMES JUNIOR', 'Barra dos Coqueiros', '(71) 9284-2073'
  from public.redes r where lower(r.nome) = lower('JOSE WILSON GOMES JUNIOR')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome, cidade, telefone)
  select '428e53d6-34be-4d24-85b6-05f62ed744b1', r.id, 'MEL DISTRIBUIDORA', 'Aracaju', '(79) 99842-7850'
  from public.redes r where lower(r.nome) = lower('MEL DISTRIBUIDORA')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome, cidade, telefone)
  select '1fc1b765-ab8b-4f6f-87f3-a6d4c54ea6ae', r.id, 'PANIFICACAO E MERCEARIA COMPRE BEM', 'Aracaju', '(79) 3431-3076'
  from public.redes r where lower(r.nome) = lower('PANIFICACAO E MERCEARIA COMPRE BEM')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome, cidade, telefone)
  select '2777cb73-0086-4ebd-8799-b9f47a7266b8', r.id, 'SUPERMERCADO BEIRA RIO', 'Aracaju', null
  from public.redes r where lower(r.nome) = lower('SUPERMERCADO BEIRA RIO')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome, cidade, telefone)
  select '2881eada-c6bd-4332-8441-fb9ca84dd90a', r.id, 'SUPERMERCADO MAIS ECONOMIA', 'Aracaju', '(79) 9831-4068'
  from public.redes r where lower(r.nome) = lower('SUPERMERCADO MAIS ECONOMIA')
  on conflict (rede_id, lower(nome)) do nothing;

commit;

-- Confira:  select r.nome as rede, l.nome as loja, l.cidade, l.telefone
--           from public.lojas l join public.redes r on r.id = l.rede_id
--           order by r.nome, l.nome;
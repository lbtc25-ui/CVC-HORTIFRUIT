-- Clientes do Omie que faltavam no app (25/09/2026). Pode rodar mais de uma vez.
begin;

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

update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '068.713.165-07'),
    ie                  = coalesce(ie, null),
    logradouro          = coalesce(logradouro, 'Avenida Poeta Vinícius de Morais'),
    numero              = coalesce(numero, '152'),
    bairro              = coalesce(bairro, 'Atalaia'),
    cep                 = coalesce(cep, '49037-490'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('ARTHUR GOIS BORGES'))
    and lower(nome) = lower('ARTHUR GOIS BORGES');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '53.908.947/0001-61'),
    ie                  = coalesce(ie, '27208086-1'),
    logradouro          = coalesce(logradouro, 'RUA NAPOLEAO DORIA'),
    numero              = coalesce(numero, '145'),
    bairro              = coalesce(bairro, 'ATALAIA'),
    cep                 = coalesce(cep, '49037-460'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('BEIRA MAR MINIMERCADO'))
    and lower(nome) = lower('BEIRA MAR MINIMERCADO');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '05.881.306/0001-18'),
    ie                  = coalesce(ie, null),
    logradouro          = coalesce(logradouro, 'RUA FRANCISCO FIGUEIREDO'),
    numero              = coalesce(numero, '1310'),
    bairro              = coalesce(bairro, 'CENTRO'),
    cep                 = coalesce(cep, '49790-000'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aquidaba'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('CLINICA SENHORA SANTANA'))
    and lower(nome) = lower('CLINICA SENHORA SANTANA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '23.511.178/0003-64'),
    ie                  = coalesce(ie, '27187598-4'),
    logradouro          = coalesce(logradouro, 'AVENIDA ADELIA FRANCO'),
    numero              = coalesce(numero, '2234 - LOJA 02'),
    bairro              = coalesce(bairro, 'LUZIA'),
    cep                 = coalesce(cep, '49048-010'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('GONZAGA'))
    and lower(nome) = lower('GONZAGA EXPRESS');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '23.511.178/0005-26'),
    ie                  = coalesce(ie, '27233094-9'),
    logradouro          = coalesce(logradouro, 'AVENIDA GONCALO ROLEMBERG LEITE'),
    numero              = coalesce(numero, '1983 - LOJA A'),
    bairro              = coalesce(bairro, 'LUZIA'),
    cep                 = coalesce(cep, '49045-280'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('GONZAGA'))
    and lower(nome) = lower('GONZAGA HIPERMERCADO - LUZIA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '23.511.178/0001-00'),
    ie                  = coalesce(ie, '27151377-2'),
    logradouro          = coalesce(logradouro, 'RUA CASTRO ALVES'),
    numero              = coalesce(numero, '618'),
    bairro              = coalesce(bairro, 'PONTO NOVO'),
    cep                 = coalesce(cep, '49047-090'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('GONZAGA'))
    and lower(nome) = lower('GONZAGA HIPERMERCADO - PONTO NOVO');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '62.227.387/0001-70'),
    ie                  = coalesce(ie, '27251417-9'),
    logradouro          = coalesce(logradouro, 'AVENIDA MANGABEIRA'),
    numero              = coalesce(numero, '1701 - HORTO DA BARRA - BLOCO BUZIOS, APT 505'),
    bairro              = coalesce(bairro, 'ESPACO TROPICAL'),
    cep                 = coalesce(cep, '49142-262'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Barra dos Coqueiros'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('JOSE WILSON GOMES JUNIOR'))
    and lower(nome) = lower('JOSE WILSON GOMES JUNIOR');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '50.911.223/0001-89'),
    ie                  = coalesce(ie, '27192804-2'),
    logradouro          = coalesce(logradouro, 'Rua Bosco Scaffs'),
    numero              = coalesce(numero, '95'),
    bairro              = coalesce(bairro, 'Inacio Barbosa'),
    cep                 = coalesce(cep, '49041-060'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('MEL DISTRIBUIDORA'))
    and lower(nome) = lower('MEL DISTRIBUIDORA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '48.183.302/0001-79'),
    ie                  = coalesce(ie, '27187280-2'),
    logradouro          = coalesce(logradouro, 'RUA ESTADOS UNIDOS'),
    numero              = coalesce(numero, '54'),
    bairro              = coalesce(bairro, 'AMERICA'),
    cep                 = coalesce(cep, '49080-220'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('PANIFICACAO E MERCEARIA COMPRE BEM'))
    and lower(nome) = lower('PANIFICACAO E MERCEARIA COMPRE BEM');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '32.870.891/0001-23'),
    ie                  = coalesce(ie, '27083983-6'),
    logradouro          = coalesce(logradouro, 'RUA DAS PAPOULAS'),
    numero              = coalesce(numero, '118'),
    bairro              = coalesce(bairro, 'DISTRITO INDUSTRIAL'),
    cep                 = coalesce(cep, '49040-450'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('SUPERMERCADO BEIRA RIO'))
    and lower(nome) = lower('SUPERMERCADO BEIRA RIO');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '17.047.483/0001-82'),
    ie                  = coalesce(ie, '27138637-1'),
    logradouro          = coalesce(logradouro, 'RUA SENHOR DOS PASSOS'),
    numero              = coalesce(numero, '105'),
    bairro              = coalesce(bairro, 'PONTO NOVO'),
    cep                 = coalesce(cep, '49037-480'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('SUPERMERCADO MAIS ECONOMIA'))
    and lower(nome) = lower('SUPERMERCADO MAIS ECONOMIA');

commit;

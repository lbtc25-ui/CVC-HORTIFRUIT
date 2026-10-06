-- ============================================================================
--  CNPJ/IE/endereço/cidade/omie_codigo_cliente das lojas — gerado por
--  scripts/gerar-cadastro-fiscal-lojas.py
--  NÃO edite direto no banco: corrija o dicionário MAPEAMENTO no script (a
--  correspondência loja -> CNPJ foi conferida à mão com a Carvalho Cruz, não dá
--  pra reconstruir só a partir do CSV) e rode de novo.
--
--  Origem do CNPJ/IE/endereço: clientes-omie.csv (export Omie). O
--  omie_codigo_cliente veio da API (ListarClientes) — mesmo CNPJ, sem ambiguidade.
--
--  Rode DEPOIS de migracao-08-nfe.sql e migracao-09-omie-ids.sql (criam as
--  colunas cnpj_cpf/ie/logradouro/numero/bairro/cep/uf/omie_codigo_cliente).
--
--  Idempotente: usa coalesce, então rodar de novo nunca sobrescreve um campo
--  que já tiver sido preenchido (à mão ou por uma rodada anterior corrigida).
-- ============================================================================

begin;

-- ─── Lojas novas (filiais do Omie ainda sem loja no app) ────────────────────
insert into public.lojas (id, rede_id, nome)
  select '213a1bb5-c79c-42d1-8763-5bd789051906', r.id, 'GLORIA'
  from public.redes r where lower(r.nome) = lower('ATAKAREJO')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '0ddc82ca-9d03-47f8-8118-02a4eda41613', r.id, 'ITABAIANA'
  from public.redes r where lower(r.nome) = lower('ATAKAREJO')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '2b384850-108a-4d4d-8aed-0da41a589bd8', r.id, 'ESTANCIA'
  from public.redes r where lower(r.nome) = lower('FASOUTO')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'd9aefbf6-1680-4eed-850d-910c8decc56a', r.id, 'DUPANE'
  from public.redes r where lower(r.nome) = lower('PANDELLI')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'd6b51fb0-d737-4924-87b5-be31e0f7a2f7', r.id, 'CAUEIRA'
  from public.redes r where lower(r.nome) = lower('PETROX')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'fca19d0f-72b1-41d6-8160-2d3c064d9898', r.id, 'JATOBA'
  from public.redes r where lower(r.nome) = lower('PETROX')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '9d18a592-4071-4534-8165-633d8635bffc', r.id, 'JOAO ALVES'
  from public.redes r where lower(r.nome) = lower('PETROX')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '382d8320-2b65-4eb3-8c76-fdb28e090038', r.id, 'ARUANA'
  from public.redes r where lower(r.nome) = lower('REDE MAIS')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select '26fa5ea6-12b3-408f-80e3-f86b68afec25', r.id, 'CAPUCHO'
  from public.redes r where lower(r.nome) = lower('REDE MAIS')
  on conflict (rede_id, lower(nome)) do nothing;
insert into public.lojas (id, rede_id, nome)
  select 'de86a40f-42de-4a9e-8b7e-f735aa1ab338', r.id, 'AMERICA'
  from public.redes r where lower(r.nome) = lower('SERRANO')
  on conflict (rede_id, lower(nome)) do nothing;

-- ─── ARTHUR GOIS BORGES ──────────────────────────────────────────────────────────────
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

-- ─── ATACAREJO MCR ──────────────────────────────────────────────────────────────
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '08.958.327/0002-63'),
    ie                  = coalesce(ie, '27244889-3'),
    logradouro          = coalesce(logradouro, 'RUA S FRANCISCO DE ASSIS'),
    numero              = coalesce(numero, '233'),
    bairro              = coalesce(bairro, 'SANTOS DUMONT'),
    cep                 = coalesce(cep, '49087-000'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('ATACAREJO MCR'))
    and lower(nome) = lower('FILIAL');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '08.958.327/0001-82'),
    ie                  = coalesce(ie, '27120633-0'),
    logradouro          = coalesce(logradouro, 'AVENIDA 1'),
    numero              = coalesce(numero, '760 - ACESSO PELA AV. J 781'),
    bairro              = coalesce(bairro, 'CONJUNTO JOAO ALVES FILHO'),
    cep                 = coalesce(cep, '49160-000'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Nossa Senhora do Socorro'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('ATACAREJO MCR'))
    and lower(nome) = lower('JOAO ALVES');

-- ─── ATAKAREJO ──────────────────────────────────────────────────────────────
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '73.849.952/0044-98'),
    ie                  = coalesce(ie, '27216861-0'),
    logradouro          = coalesce(logradouro, 'AVENIDA ADELIA FRANCO'),
    numero              = coalesce(numero, '2350'),
    bairro              = coalesce(bairro, 'LUZIA'),
    cep                 = coalesce(cep, '49048-010'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3539012148)
  where rede_id = (select id from public.redes where lower(nome) = lower('ATAKAREJO'))
    and lower(nome) = lower('ADELIA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '73.849.952/0062-70'),
    ie                  = coalesce(ie, '27233469-3'),
    logradouro          = coalesce(logradouro, 'RODOVIA BR 235'),
    numero              = coalesce(numero, 'S/N'),
    bairro              = coalesce(bairro, 'SOBRADO'),
    cep                 = coalesce(cep, '49160-000'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Nossa Senhora do Socorro'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('ATAKAREJO'))
    and lower(nome) = lower('CD');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '73.849.952/0051-17'),
    ie                  = coalesce(ie, '27223761-2'),
    logradouro          = coalesce(logradouro, 'RUA FRANCISCO VIEIRA DOS SANTOS'),
    numero              = coalesce(numero, '86'),
    bairro              = coalesce(bairro, 'JOVIANO BARBOSA'),
    cep                 = coalesce(cep, '49680-000'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Nossa Senhora da Gloria'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('ATAKAREJO'))
    and lower(nome) = lower('GLORIA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '73.849.952/0058-93'),
    ie                  = coalesce(ie, '27228389-4'),
    logradouro          = coalesce(logradouro, 'AVENIDA NIVALDA LIMA FIGUEIREDO'),
    numero              = coalesce(numero, '867'),
    bairro              = coalesce(bairro, 'ANIZIO AMANCIO DE OLIVEIRA'),
    cep                 = coalesce(cep, '49503-396'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Itabaiana'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('ATAKAREJO'))
    and lower(nome) = lower('ITABAIANA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '73.849.952/0021-00'),
    ie                  = coalesce(ie, '1593382-18'),
    logradouro          = coalesce(logradouro, 'VIA DE PENETRACAO I'),
    numero              = coalesce(numero, '690'),
    bairro              = coalesce(bairro, 'CIA SUL'),
    cep                 = coalesce(cep, '43700-000'),
    uf                  = coalesce(uf, 'BA'),
    cidade              = coalesce(cidade, 'Simões Filho'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('ATAKAREJO'))
    and lower(nome) = lower('SALVADOR');

-- ─── BEIRA MAR MINIMERCADO ──────────────────────────────────────────────────────────────
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

-- ─── BOMBOM ──────────────────────────────────────────────────────────────
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '04.136.442/0003-82'),
    ie                  = coalesce(ie, '27228488-2'),
    logradouro          = coalesce(logradouro, 'AVENIDA DEP PEDRO VALADARES'),
    numero              = coalesce(numero, '780'),
    bairro              = coalesce(bairro, 'GRAGERU'),
    cep                 = coalesce(cep, '49026-115'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3501339828)
  where rede_id = (select id from public.redes where lower(nome) = lower('BOMBOM'))
    and lower(nome) = lower('ARACAJU');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '04.136.442/0001-10'),
    ie                  = coalesce(ie, '27101934-4'),
    logradouro          = coalesce(logradouro, 'RUA DA LIBERDADE'),
    numero              = coalesce(numero, '162'),
    bairro              = coalesce(bairro, 'CENTRO'),
    cep                 = coalesce(cep, '49200-000'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Estancia'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3491423547)
  where rede_id = (select id from public.redes where lower(nome) = lower('BOMBOM'))
    and lower(nome) = lower('ESTANCIA');

-- ─── BRAUNA ──────────────────────────────────────────────────────────────
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '35.438.260/0005-51'),
    ie                  = coalesce(ie, '27220770-5'),
    logradouro          = coalesce(logradouro, 'AVENIDA MARANHAO'),
    numero              = coalesce(numero, '2462'),
    bairro              = coalesce(bairro, 'SANTOS DUMONT'),
    cep                 = coalesce(cep, '49087-420'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3511714972)
  where rede_id = (select id from public.redes where lower(nome) = lower('BRAUNA'))
    and lower(nome) = lower('MATRIZ');

-- ─── CLINICA SENHORA SANTANA ──────────────────────────────────────────────────────────────
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

-- ─── FASOUTO ──────────────────────────────────────────────────────────────
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '15.598.527/0014-51'),
    ie                  = coalesce(ie, '27234939-9'),
    logradouro          = coalesce(logradouro, 'RUA PEDRO HOMEM DA COSTA'),
    numero              = coalesce(numero, '239'),
    bairro              = coalesce(bairro, 'CENTRO'),
    cep                 = coalesce(cep, '49200-000'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Estancia'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('FASOUTO'))
    and lower(nome) = lower('ESTANCIA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '15.598.527/0013-70'),
    ie                  = coalesce(ie, '27234763-9'),
    logradouro          = coalesce(logradouro, 'AVENIDA SIMEAO SOBRAL'),
    numero              = coalesce(numero, '394'),
    bairro              = coalesce(bairro, 'INDUSTRIAL'),
    cep                 = coalesce(cep, '49065-770'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3491601320)
  where rede_id = (select id from public.redes where lower(nome) = lower('FASOUTO'))
    and lower(nome) = lower('INDUSTRIAL');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '15.598.527/0016-13'),
    ie                  = coalesce(ie, '27235198-9'),
    logradouro          = coalesce(logradouro, 'AV RAYMUNDO JULIANO'),
    numero              = coalesce(numero, 'S/N'),
    bairro              = coalesce(bairro, 'ALBANO FRANCO'),
    cep                 = coalesce(cep, '49153-084'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Nossa Senhora do Socorro'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3491540959)
  where rede_id = (select id from public.redes where lower(nome) = lower('FASOUTO'))
    and lower(nome) = lower('SOCORRO');

-- ─── GONZAGA ──────────────────────────────────────────────────────────────
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

-- ─── HIPER CARNES ──────────────────────────────────────────────────────────────
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '50.747.044/0002-39'),
    ie                  = coalesce(ie, '27239224-3'),
    logradouro          = coalesce(logradouro, 'RUA MARIA VASCONCELOS DE ANDRADE'),
    numero              = coalesce(numero, '536'),
    bairro              = coalesce(bairro, 'ARUANA'),
    cep                 = coalesce(cep, '49000-626'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3510699017)
  where rede_id = (select id from public.redes where lower(nome) = lower('HIPER CARNES'))
    and lower(nome) = lower('ARUANA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '44.069.669/0001-05'),
    ie                  = coalesce(ie, '27180532-3'),
    logradouro          = coalesce(logradouro, 'AVENIDA OCEANICA'),
    numero              = coalesce(numero, '835'),
    bairro              = coalesce(bairro, 'CENTRO'),
    cep                 = coalesce(cep, '49140-000'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Barra dos Coqueiros'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('HIPER CARNES'))
    and lower(nome) = lower('BARRA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '50.747.044/0001-58'),
    ie                  = coalesce(ie, '27192235-4'),
    logradouro          = coalesce(logradouro, 'Rua Maj Joao Teles'),
    numero              = coalesce(numero, '60'),
    bairro              = coalesce(bairro, 'Jabotiana'),
    cep                 = coalesce(cep, '49095-230'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3491217944)
  where rede_id = (select id from public.redes where lower(nome) = lower('HIPER CARNES'))
    and lower(nome) = lower('JABOTIANA');

-- ─── HOTEL AQUARIUS ──────────────────────────────────────────────────────────────
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '05.540.989/0001-40'),
    ie                  = coalesce(ie, '27107530-9'),
    logradouro          = coalesce(logradouro, 'AVENIDA SANTOS DUMONT'),
    numero              = coalesce(numero, '1378'),
    bairro              = coalesce(bairro, 'ATALAIA VELHA'),
    cep                 = coalesce(cep, '49035-730'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3501984914)
  where rede_id = (select id from public.redes where lower(nome) = lower('HOTEL AQUARIUS'))
    and lower(nome) = lower('MATRIZ');

-- ─── HOTEL SAO MANUEL ──────────────────────────────────────────────────────────────
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '02.574.828/0001-89'),
    ie                  = coalesce(ie, '27112064-9'),
    logradouro          = coalesce(logradouro, 'RUA NICEU DANTAS'),
    numero              = coalesce(numero, '75'),
    bairro              = coalesce(bairro, 'ATALAIA'),
    cep                 = coalesce(cep, '49037-470'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3501922980)
  where rede_id = (select id from public.redes where lower(nome) = lower('HOTEL SAO MANUEL'))
    and lower(nome) = lower('MATRIZ');

-- ─── J.PEIXOTO ──────────────────────────────────────────────────────────────
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '35.695.317/0003-36'),
    ie                  = coalesce(ie, '27211659-9'),
    logradouro          = coalesce(logradouro, 'RUA MARIA VASCONCELOS DE ANDRADE'),
    numero              = coalesce(numero, '1145 - LOJA 02'),
    bairro              = coalesce(bairro, 'ARUANA'),
    cep                 = coalesce(cep, '49033-031'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3492659404)
  where rede_id = (select id from public.redes where lower(nome) = lower('J.PEIXOTO'))
    and lower(nome) = lower('ARUANA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '35.695.317/0001-74'),
    ie                  = coalesce(ie, '27167738-4'),
    logradouro          = coalesce(logradouro, 'AVENIDA ROSEMARY VIEIRA DE JESUS'),
    numero              = coalesce(numero, 'S/N'),
    bairro              = coalesce(bairro, 'PIABETA'),
    cep                 = coalesce(cep, '49153-566'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Nossa Senhora do Socorro'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3492645513)
  where rede_id = (select id from public.redes where lower(nome) = lower('J.PEIXOTO'))
    and lower(nome) = lower('PIABETA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '35.695.317/0002-55'),
    ie                  = coalesce(ie, '27180672-9'),
    logradouro          = coalesce(logradouro, 'AVENIDA PERIMETRAL C'),
    numero              = coalesce(numero, 's/n - LOJA 1'),
    bairro              = coalesce(bairro, 'SAO BRAZ'),
    cep                 = coalesce(cep, '49160-000'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Nossa Senhora do Socorro'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3492646367)
  where rede_id = (select id from public.redes where lower(nome) = lower('J.PEIXOTO'))
    and lower(nome) = lower('SAO BRAS');

-- ─── JOSE WILSON GOMES JUNIOR ──────────────────────────────────────────────────────────────
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

-- ─── MEL DISTRIBUIDORA ──────────────────────────────────────────────────────────────
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

-- ─── NUNES PEIXOTO ──────────────────────────────────────────────────────────────
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '13.152.186/0002-27'),
    ie                  = coalesce(ie, '27102960-9'),
    logradouro          = coalesce(logradouro, 'RUA MONTE ALEGRE'),
    numero              = coalesce(numero, '78'),
    bairro              = coalesce(bairro, 'NOVO HORIZONTE'),
    cep                 = coalesce(cep, '49680-000'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Nossa Senhora da Gloria'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3493985909)
  where rede_id = (select id from public.redes where lower(nome) = lower('NUNES PEIXOTO'))
    and lower(nome) = lower('GLORIA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '13.152.186/0001-46'),
    ie                  = coalesce(ie, '27057989-3'),
    logradouro          = coalesce(logradouro, 'PRACA JOAO PESSOA'),
    numero              = coalesce(numero, '99 - AC R MANOEL G 386 AC R J FRA SAN 173 AC INT P J PES 127'),
    bairro              = coalesce(bairro, 'CENTRO'),
    cep                 = coalesce(cep, '49500-070'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Itabaiana'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3492823672)
  where rede_id = (select id from public.redes where lower(nome) = lower('NUNES PEIXOTO'))
    and lower(nome) = lower('ITABAIANA');

-- ─── PANDELLI ──────────────────────────────────────────────────────────────
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '38.150.088/0001-09'),
    ie                  = coalesce(ie, '27171050-0'),
    logradouro          = coalesce(logradouro, 'AVENIDA DES MAYNARD'),
    numero              = coalesce(numero, '1244'),
    bairro              = coalesce(bairro, 'CIRURGIA'),
    cep                 = coalesce(cep, '49055-210'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('PANDELLI'))
    and lower(nome) = lower('DUPANE');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '20.671.856/0001-04'),
    ie                  = coalesce(ie, '27147236-7'),
    logradouro          = coalesce(logradouro, 'AVENIDA DES MAYNARD'),
    numero              = coalesce(numero, '1244 - LOJA A'),
    bairro              = coalesce(bairro, 'CIRURGIA'),
    cep                 = coalesce(cep, '49055-210'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3510941111)
  where rede_id = (select id from public.redes where lower(nome) = lower('PANDELLI'))
    and lower(nome) = lower('MATRIZ');

-- ─── PANIFICACAO E MERCEARIA COMPRE BEM ──────────────────────────────────────────────────────────────
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

-- ─── PETROX ──────────────────────────────────────────────────────────────
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '05.297.480/0031-33'),
    ie                  = coalesce(ie, '27190851-3'),
    logradouro          = coalesce(logradouro, 'AVENIDA MONTEIRO LOBATO'),
    numero              = coalesce(numero, '850'),
    bairro              = coalesce(bairro, 'ATALAIA'),
    cep                 = coalesce(cep, '49037-450'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3500539070)
  where rede_id = (select id from public.redes where lower(nome) = lower('PETROX'))
    and lower(nome) = lower('AEROPORTO');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '05.297.480/0019-47'),
    ie                  = coalesce(ie, '27136848-9'),
    logradouro          = coalesce(logradouro, 'RODOVIA DOS NAUFRAGOS'),
    numero              = coalesce(numero, '4700 - LOJA 01'),
    bairro              = coalesce(bairro, 'ARUANA'),
    cep                 = coalesce(cep, '49000-016'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3500536779)
  where rede_id = (select id from public.redes where lower(nome) = lower('PETROX'))
    and lower(nome) = lower('ARUANA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '05.297.480/0041-05'),
    ie                  = coalesce(ie, '27252521-9'),
    logradouro          = coalesce(logradouro, 'AVENIDA ROTARY'),
    numero              = coalesce(numero, '283'),
    bairro              = coalesce(bairro, 'ATALAIA'),
    cep                 = coalesce(cep, '49037-550'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3528583250)
  where rede_id = (select id from public.redes where lower(nome) = lower('PETROX'))
    and lower(nome) = lower('ATALAIA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '05.297.480/0018-66'),
    ie                  = coalesce(ie, '27125736-9'),
    logradouro          = coalesce(logradouro, 'RODOVIA ENGENHEIRO ADILSON TAVORA'),
    numero              = coalesce(numero, 'S/N'),
    bairro              = coalesce(bairro, 'CENTRO'),
    cep                 = coalesce(cep, '49140-000'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Barra dos Coqueiros'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3500536992)
  where rede_id = (select id from public.redes where lower(nome) = lower('PETROX'))
    and lower(nome) = lower('BARRA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '05.297.480/0004-60'),
    ie                  = coalesce(ie, '27110002-8'),
    logradouro          = coalesce(logradouro, 'RODOVIA BR 235'),
    numero              = coalesce(numero, 'S/N - ANEXO I'),
    bairro              = coalesce(bairro, 'SOBRADO'),
    cep                 = coalesce(cep, '49158-622'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Nossa Senhora do Socorro'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3500539879)
  where rede_id = (select id from public.redes where lower(nome) = lower('PETROX'))
    and lower(nome) = lower('BR');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '05.297.480/0012-70'),
    ie                  = coalesce(ie, '27122092-9'),
    logradouro          = coalesce(logradouro, 'RODOVIA AYRTON SENNA'),
    numero              = coalesce(numero, 'S/N'),
    bairro              = coalesce(bairro, 'POVOADO E PRAIA DA CAUEIRA'),
    cep                 = coalesce(cep, '49120-000'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Itaporanga d Ajuda'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('PETROX'))
    and lower(nome) = lower('CAUEIRA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '05.297.480/0040-24'),
    ie                  = coalesce(ie, '27252577-4'),
    logradouro          = coalesce(logradouro, 'AVENIDA FRANCISCO PORTO'),
    numero              = coalesce(numero, '650 - ANEXO A'),
    bairro              = coalesce(bairro, 'SALGADO FILHO'),
    cep                 = coalesce(cep, '49020-570'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3519891254)
  where rede_id = (select id from public.redes where lower(nome) = lower('PETROX'))
    and lower(nome) = lower('F.PORTO');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '05.297.480/0006-22'),
    ie                  = coalesce(ie, '27112819-4'),
    logradouro          = coalesce(logradouro, 'AVENIDA MURILO DANTAS'),
    numero              = coalesce(numero, '941'),
    bairro              = coalesce(bairro, 'FAROLANDIA'),
    cep                 = coalesce(cep, '49032-490'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3500538528)
  where rede_id = (select id from public.redes where lower(nome) = lower('PETROX'))
    and lower(nome) = lower('FAROL');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '05.297.480/0006-22'),
    ie                  = coalesce(ie, '27112819-4'),
    logradouro          = coalesce(logradouro, 'AVENIDA MURILO DANTAS'),
    numero              = coalesce(numero, '941'),
    bairro              = coalesce(bairro, 'FAROLANDIA'),
    cep                 = coalesce(cep, '49032-490'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3500538528)
  where rede_id = (select id from public.redes where lower(nome) = lower('PETROX'))
    and lower(nome) = lower('FAROLANDIA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '05.297.480/0023-23'),
    ie                  = coalesce(ie, '27152920-2'),
    logradouro          = coalesce(logradouro, 'AVENIDA CHANCELER OSVALDO ARANHA'),
    numero              = coalesce(numero, '3090'),
    bairro              = coalesce(bairro, 'OLARIA'),
    cep                 = coalesce(cep, '49092-545'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3500542412)
  where rede_id = (select id from public.redes where lower(nome) = lower('PETROX'))
    and lower(nome) = lower('GAZOL');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '05.297.480/0020-80'),
    ie                  = coalesce(ie, '27146436-4'),
    logradouro          = coalesce(logradouro, 'AVENIDA POVOADO JATOBA'),
    numero              = coalesce(numero, '1581'),
    bairro              = coalesce(bairro, 'JATOBA'),
    cep                 = coalesce(cep, '49143-480'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Barra dos Coqueiros'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('PETROX'))
    and lower(nome) = lower('JATOBA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '05.297.480/0033-03'),
    ie                  = coalesce(ie, '27210816-2'),
    logradouro          = coalesce(logradouro, 'AVENIDA NOSSA SENHORA DO SOCORRO'),
    numero              = coalesce(numero, '858'),
    bairro              = coalesce(bairro, 'JOAO ALVES'),
    cep                 = coalesce(cep, '49155-372'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Nossa Senhora do Socorro'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('PETROX'))
    and lower(nome) = lower('JOAO ALVES');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '05.297.480/0021-61'),
    ie                  = coalesce(ie, '27145471-7'),
    logradouro          = coalesce(logradouro, 'AVENIDA MELICIO MACHADO'),
    numero              = coalesce(numero, '3026'),
    bairro              = coalesce(bairro, 'AEROPORTO'),
    cep                 = coalesce(cep, '49038-443'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3500542954)
  where rede_id = (select id from public.redes where lower(nome) = lower('PETROX'))
    and lower(nome) = lower('MELICIO');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '05.297.480/0035-67'),
    ie                  = coalesce(ie, '27221401-9'),
    logradouro          = coalesce(logradouro, 'RODOVIA DOS NAUFRAGOS'),
    numero              = coalesce(numero, '16015'),
    bairro              = coalesce(bairro, 'MOSQUEIRO'),
    cep                 = coalesce(cep, '49009-004'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3500543573)
  where rede_id = (select id from public.redes where lower(nome) = lower('PETROX'))
    and lower(nome) = lower('ORLA P.D SOL');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '05.297.480/0035-67'),
    ie                  = coalesce(ie, '27221401-9'),
    logradouro          = coalesce(logradouro, 'RODOVIA DOS NAUFRAGOS'),
    numero              = coalesce(numero, '16015'),
    bairro              = coalesce(bairro, 'MOSQUEIRO'),
    cep                 = coalesce(cep, '49009-004'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3500543573)
  where rede_id = (select id from public.redes where lower(nome) = lower('PETROX'))
    and lower(nome) = lower('ORLA SOL');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '05.297.480/0002-07'),
    ie                  = coalesce(ie, '27107216-4'),
    logradouro          = coalesce(logradouro, 'AVENIDA GOV. PAULO BARRETO DE MENEZES'),
    numero              = coalesce(numero, '662'),
    bairro              = coalesce(bairro, 'FAROLANDIA'),
    cep                 = coalesce(cep, '49032-000'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3500537650)
  where rede_id = (select id from public.redes where lower(nome) = lower('PETROX'))
    and lower(nome) = lower('P.CAJU');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '05.297.480/0027-57'),
    ie                  = coalesce(ie, '27158337-1'),
    logradouro          = coalesce(logradouro, 'AVENIDA INACIO BARBOSA'),
    numero              = coalesce(numero, '6450'),
    bairro              = coalesce(bairro, 'SAO JOSE DOS NAUFRAGOS'),
    cep                 = coalesce(cep, '49005-405'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3500538291)
  where rede_id = (select id from public.redes where lower(nome) = lower('PETROX'))
    and lower(nome) = lower('PRAIA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '05.297.480/0038-00'),
    ie                  = coalesce(ie, '27237683-3'),
    logradouro          = coalesce(logradouro, 'AVENIDA MURILO DANTAS'),
    numero              = coalesce(numero, '941 - LOJA 04 TERREO/CHOPARIA'),
    bairro              = coalesce(bairro, 'FAROLANDIA'),
    cep                 = coalesce(cep, '49032-490'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3539190913)
  where rede_id = (select id from public.redes where lower(nome) = lower('PETROX'))
    and lower(nome) = lower('RESTAURANTE');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '05.297.480/0036-48'),
    ie                  = coalesce(ie, '27221402-7'),
    logradouro          = coalesce(logradouro, 'AVENIDA ESCRITOR GRACILIANO RAMOS'),
    numero              = coalesce(numero, '80 - LOJA 01'),
    bairro              = coalesce(bairro, 'JABOTIANA'),
    cep                 = coalesce(cep, '49095-650'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3500539441)
  where rede_id = (select id from public.redes where lower(nome) = lower('PETROX'))
    and lower(nome) = lower('SANTA LUCIA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '05.297.480/0022-42'),
    ie                  = coalesce(ie, '27150532-0'),
    logradouro          = coalesce(logradouro, 'AVENIDA PRESIDENTE TANCREDO NEVES'),
    numero              = coalesce(numero, '4501'),
    bairro              = coalesce(bairro, 'JABOTIANA'),
    cep                 = coalesce(cep, '49095-000'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3500540621)
  where rede_id = (select id from public.redes where lower(nome) = lower('PETROX'))
    and lower(nome) = lower('TANCREDO');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '05.297.480/0009-75'),
    ie                  = coalesce(ie, '27119457-0'),
    logradouro          = coalesce(logradouro, 'AVENIDA GOV. PAULO BARRETO DE MENEZES'),
    numero              = coalesce(numero, '770'),
    bairro              = coalesce(bairro, 'TREZE DE JULHO'),
    cep                 = coalesce(cep, '49020-010'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3500538764)
  where rede_id = (select id from public.redes where lower(nome) = lower('PETROX'))
    and lower(nome) = lower('TREZE');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '05.297.480/0001-18'),
    ie                  = coalesce(ie, '27106668-7'),
    logradouro          = coalesce(logradouro, 'RUA URQUIZA LEAL'),
    numero              = coalesce(numero, '118'),
    bairro              = coalesce(bairro, 'SALGADO FILHO'),
    cep                 = coalesce(cep, '49020-490'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3500542134)
  where rede_id = (select id from public.redes where lower(nome) = lower('PETROX'))
    and lower(nome) = lower('URQUIZA LEAL');

-- ─── PRIMAVERA ──────────────────────────────────────────────────────────────
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '13.356.779/0001-24'),
    ie                  = coalesce(ie, '27248749-0'),
    logradouro          = coalesce(logradouro, 'AVENIDA MINISTRO GERALDO BARRETO SOBRAL'),
    numero              = coalesce(numero, '2277'),
    bairro              = coalesce(bairro, 'JARDINS'),
    cep                 = coalesce(cep, '49026-010'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3536160807)
  where rede_id = (select id from public.redes where lower(nome) = lower('PRIMAVERA'))
    and lower(nome) = lower('MATRIZ');

-- ─── REDE ALPHA ──────────────────────────────────────────────────────────────
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '08.297.710/0001-37'),
    ie                  = coalesce(ie, '27116035-7'),
    logradouro          = coalesce(logradouro, 'AVENIDA ROTARY'),
    numero              = coalesce(numero, '20'),
    bairro              = coalesce(bairro, 'ATALAIA'),
    cep                 = coalesce(cep, '49037-550'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('REDE ALPHA'))
    and lower(nome) = lower('ATALAIA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '08.297.710/0007-22'),
    ie                  = coalesce(ie, '27138212-0'),
    logradouro          = coalesce(logradouro, 'AVENIDA MARIO JORGE MENEZES VIEIRA'),
    numero              = coalesce(numero, '59 - SETOR POSTO DE GASOLINA'),
    bairro              = coalesce(bairro, 'COROA DO MEIO'),
    cep                 = coalesce(cep, '49035-100'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3501576484)
  where rede_id = (select id from public.redes where lower(nome) = lower('REDE ALPHA'))
    and lower(nome) = lower('COROA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '08.297.710/0005-60'),
    ie                  = coalesce(ie, '27119655-6'),
    logradouro          = coalesce(logradouro, 'AVENIDA PRESIDENTE TANCREDO NEVES'),
    numero              = coalesce(numero, '3322 - A'),
    bairro              = coalesce(bairro, 'PONTO NOVO'),
    cep                 = coalesce(cep, '49097-510'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('REDE ALPHA'))
    and lower(nome) = lower('DETRAN');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '08.297.710/0008-03'),
    ie                  = coalesce(ie, '27140435-3'),
    logradouro          = coalesce(logradouro, 'AVENIDA FRANCISCO PORTO'),
    numero              = coalesce(numero, '650'),
    bairro              = coalesce(bairro, 'SALGADO FILHO'),
    cep                 = coalesce(cep, '49020-570'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('REDE ALPHA'))
    and lower(nome) = lower('F.PORTO');

-- ─── REDE MAIS ──────────────────────────────────────────────────────────────
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '54.515.737/0003-38'),
    ie                  = coalesce(ie, '27221409-4'),
    logradouro          = coalesce(logradouro, 'AVENIDA MELICIO MACHADO'),
    numero              = coalesce(numero, '1900'),
    bairro              = coalesce(bairro, 'ARUANA'),
    cep                 = coalesce(cep, '49038-443'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('REDE MAIS'))
    and lower(nome) = lower('ARUANA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '54.515.737/0006-80'),
    ie                  = coalesce(ie, '27224812-6'),
    logradouro          = coalesce(logradouro, 'RUA SAO MATHEUS'),
    numero              = coalesce(numero, '527-A'),
    bairro              = coalesce(bairro, 'LOT OLIMAR'),
    cep                 = coalesce(cep, '49140-712'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Barra dos Coqueiros'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3499071674)
  where rede_id = (select id from public.redes where lower(nome) = lower('REDE MAIS'))
    and lower(nome) = lower('BARRA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '54.515.737/0001-76'),
    ie                  = coalesce(ie, '27210369-1'),
    logradouro          = coalesce(logradouro, 'AVENIDA MAL CANDIDO MARIANO DA SILVA RONDON'),
    numero              = coalesce(numero, '1320 - GALPAO02'),
    bairro              = coalesce(bairro, 'CAPUCHO'),
    cep                 = coalesce(cep, '49081-120'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('REDE MAIS'))
    and lower(nome) = lower('CAPUCHO');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '54.515.737/0007-61'),
    ie                  = coalesce(ie, '27225617-0'),
    logradouro          = coalesce(logradouro, 'TRAVESSA J DIST INDUSTRIAL'),
    numero              = coalesce(numero, '4818 - LOJA B'),
    bairro              = coalesce(bairro, 'INACIO BARBOSA'),
    cep                 = coalesce(cep, '49041-166'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3499071795)
  where rede_id = (select id from public.redes where lower(nome) = lower('REDE MAIS'))
    and lower(nome) = lower('DISTRITO');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '54.515.737/0009-23'),
    ie                  = coalesce(ie, '27225613-7'),
    logradouro          = coalesce(logradouro, 'RODOVIA DOS NAUFRAGOS'),
    numero              = coalesce(numero, '11800 - LOJA B'),
    bairro              = coalesce(bairro, 'AREIA BRANCA'),
    cep                 = coalesce(cep, '49007-433'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3499071885)
  where rede_id = (select id from public.redes where lower(nome) = lower('REDE MAIS'))
    and lower(nome) = lower('ECO POSTO');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '54.515.737/0004-19'),
    ie                  = coalesce(ie, '27221410-8'),
    logradouro          = coalesce(logradouro, 'AVENIDA FRANCISCO PORTO'),
    numero              = coalesce(numero, '1086 - LOJA 02'),
    bairro              = coalesce(bairro, 'SALGADO FILHO'),
    cep                 = coalesce(cep, '49020-570'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3499071455)
  where rede_id = (select id from public.redes where lower(nome) = lower('REDE MAIS'))
    and lower(nome) = lower('F.PORTO');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '54.515.737/0008-42'),
    ie                  = coalesce(ie, '27225618-8'),
    logradouro          = coalesce(logradouro, 'AVENIDA VER MANOEL DORIA DA SILVA'),
    numero              = coalesce(numero, '400 - LOJA B'),
    bairro              = coalesce(bairro, 'FAROLANDIA'),
    cep                 = coalesce(cep, '49031-260'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3498172455)
  where rede_id = (select id from public.redes where lower(nome) = lower('REDE MAIS'))
    and lower(nome) = lower('FAROLANDIA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '54.515.737/0005-08'),
    ie                  = coalesce(ie, '27224310-8'),
    logradouro          = coalesce(logradouro, 'RODOVIA GOV. MARIO COVAS - BR 101'),
    numero              = coalesce(numero, '02'),
    bairro              = coalesce(bairro, 'PALESTINA DE FORA'),
    cep                 = coalesce(cep, '49163-030'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Nossa Senhora do Socorro'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3499071526)
  where rede_id = (select id from public.redes where lower(nome) = lower('REDE MAIS'))
    and lower(nome) = lower('MEGA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '54.515.737/0002-57'),
    ie                  = coalesce(ie, '27221408-6'),
    logradouro          = coalesce(logradouro, 'AVENIDA PRES TANCREDO NEVES'),
    numero              = coalesce(numero, '4930 - LOJA 02'),
    bairro              = coalesce(bairro, 'AMERICA'),
    cep                 = coalesce(cep, '49080-470'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3499071412)
  where rede_id = (select id from public.redes where lower(nome) = lower('REDE MAIS'))
    and lower(nome) = lower('TANCREDO');

-- ─── SERRANO ──────────────────────────────────────────────────────────────
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '08.309.233/0002-63'),
    ie                  = coalesce(ie, '27135114-4'),
    logradouro          = coalesce(logradouro, 'AVENIDA ADELIA FRANCO'),
    numero              = coalesce(numero, '3380'),
    bairro              = coalesce(bairro, 'INACIO BARBOSA'),
    cep                 = coalesce(cep, '49048-170'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('SERRANO'))
    and lower(nome) = lower('ADELIA FRANCO');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '12.431.802/0001-35'),
    ie                  = coalesce(ie, '27128719-5'),
    logradouro          = coalesce(logradouro, 'AVENIDA PRESIDENTE TANCREDO NEVES'),
    numero              = coalesce(numero, '7604'),
    bairro              = coalesce(bairro, 'AMERICA'),
    cep                 = coalesce(cep, '49080-470'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('SERRANO'))
    and lower(nome) = lower('AMERICA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '01.984.422/0001-01'),
    ie                  = coalesce(ie, '27095812-6'),
    logradouro          = coalesce(logradouro, 'AVENIDA DEP SILVIO TEIXEIRA'),
    numero              = coalesce(numero, '1020 - LOJA 01'),
    bairro              = coalesce(bairro, 'JARDINS'),
    cep                 = coalesce(cep, '49025-100'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('SERRANO'))
    and lower(nome) = lower('SILVIO TEIXEIRA');

-- ─── SILVA SUPERMERCADO ──────────────────────────────────────────────────────────────
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '48.252.281/0001-04'),
    ie                  = coalesce(ie, '27187408-2'),
    logradouro          = coalesce(logradouro, 'AVENIDA GAL EUCLIDES FIGUEIREDO'),
    numero              = coalesce(numero, '685'),
    bairro              = coalesce(bairro, 'JAPAOZINHO'),
    cep                 = coalesce(cep, '49063-106'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3498831774)
  where rede_id = (select id from public.redes where lower(nome) = lower('SILVA SUPERMERCADO'))
    and lower(nome) = lower('MATRIZ');

-- ─── SOUZA ──────────────────────────────────────────────────────────────
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '03.894.230/0001-30'),
    ie                  = coalesce(ie, '27101347-8'),
    logradouro          = coalesce(logradouro, 'Av. professora Virgínia Cardoso'),
    numero              = coalesce(numero, '117'),
    bairro              = coalesce(bairro, 'AEROPORTO'),
    cep                 = coalesce(cep, '49037-520'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('SOUZA'))
    and lower(nome) = lower('MATRIZ');

-- ─── SUPERMERCADO BEIRA RIO ──────────────────────────────────────────────────────────────
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

-- ─── SUPERMERCADO MAIS ECONOMIA ──────────────────────────────────────────────────────────────
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

-- ─── TABAJARA ──────────────────────────────────────────────────────────────
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '04.636.474/0001-85'),
    ie                  = coalesce(ie, '27108642-4'),
    logradouro          = coalesce(logradouro, 'RUA N S DA GLORIA'),
    numero              = coalesce(numero, '695'),
    bairro              = coalesce(bairro, 'JAPAOZINHO'),
    cep                 = coalesce(cep, '49063-004'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3488923526)
  where rede_id = (select id from public.redes where lower(nome) = lower('TABAJARA'))
    and lower(nome) = lower('JAPAOZINHO');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '04.636.474/0001-85'),
    ie                  = coalesce(ie, '27108642-4'),
    logradouro          = coalesce(logradouro, 'RUA N S DA GLORIA'),
    numero              = coalesce(numero, '695'),
    bairro              = coalesce(bairro, 'JAPAOZINHO'),
    cep                 = coalesce(cep, '49063-004'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3488923526)
  where rede_id = (select id from public.redes where lower(nome) = lower('TABAJARA'))
    and lower(nome) = lower('MATRIZ');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '04.636.474/0002-66'),
    ie                  = coalesce(ie, '27223129-0'),
    logradouro          = coalesce(logradouro, 'RUA BENJAMIN CONSTANT'),
    numero              = coalesce(numero, '190'),
    bairro              = coalesce(bairro, 'SOLEDADE'),
    cep                 = coalesce(cep, '49089-020'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3490288993)
  where rede_id = (select id from public.redes where lower(nome) = lower('TABAJARA'))
    and lower(nome) = lower('SOLEDADE');

-- ─── VINICIUS ──────────────────────────────────────────────────────────────
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '59.567.932/0001-63'),
    ie                  = coalesce(ie, '27228316-9'),
    logradouro          = coalesce(logradouro, 'AVENIDA SANTOS DUMONT'),
    numero              = coalesce(numero, '829'),
    bairro              = coalesce(bairro, 'ATALAIA'),
    cep                 = coalesce(cep, '49037-475'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3520865669)
  where rede_id = (select id from public.redes where lower(nome) = lower('VINICIUS'))
    and lower(nome) = lower('ASTRO');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '48.284.967/0001-79'),
    ie                  = coalesce(ie, '27187490-2'),
    logradouro          = coalesce(logradouro, 'AVENIDA SANTOS DUMONT'),
    numero              = coalesce(numero, '340-3'),
    bairro              = coalesce(bairro, 'ATALAIA'),
    cep                 = coalesce(cep, '49037-475'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, null)
  where rede_id = (select id from public.redes where lower(nome) = lower('VINICIUS'))
    and lower(nome) = lower('CHURRASCARIA PRAIA');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '64.989.506/0001-58'),
    ie                  = coalesce(ie, '27248931-0'),
    logradouro          = coalesce(logradouro, 'RUA PROFESSORA MARIA PUREZA DE JESUS'),
    numero              = coalesce(numero, '344'),
    bairro              = coalesce(bairro, 'COROA DO MEIO'),
    cep                 = coalesce(cep, '49035-243'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3520865542)
  where rede_id = (select id from public.redes where lower(nome) = lower('VINICIUS'))
    and lower(nome) = lower('MERCADO TRABALHADOR');
update public.lojas set
    cnpj_cpf            = coalesce(cnpj_cpf, '39.493.946/0001-72'),
    ie                  = coalesce(ie, '27172489-7'),
    logradouro          = coalesce(logradouro, 'AVENIDA SANTOS DUMONT'),
    numero              = coalesce(numero, '80'),
    bairro              = coalesce(bairro, 'ATALAIA'),
    cep                 = coalesce(cep, '49037-475'),
    uf                  = coalesce(uf, 'SE'),
    cidade              = coalesce(cidade, 'Aracaju'),
    omie_codigo_cliente = coalesce(omie_codigo_cliente, 3520865232)
  where rede_id = (select id from public.redes where lower(nome) = lower('VINICIUS'))
    and lower(nome) = lower('NORDESTAO');

commit;

-- Confira:  select r.nome as rede, l.nome as loja, l.cnpj_cpf, l.ie, l.bairro
--           from public.lojas l join public.redes r on r.id = l.rede_id
--           where l.cnpj_cpf is not null order by r.nome, l.nome;
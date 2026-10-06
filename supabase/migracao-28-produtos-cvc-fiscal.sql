-- ============================================================================
--  Migração 28 — tributação por produto e as frutas da CVC
--
--  1. Tributação por produto — até aqui a nota saía com a mesma tributação
--     para tudo, fixa no código (ICMS CST 40, PIS/COFINS CST 07), que é a da
--     produção própria. As frutas da CVC são REVENDA e precisam da delas:
--
--        origem           origem da mercadoria (0 nacional, 2 estrangeira
--                         adquirida no mercado interno…)
--        icms_cst         CST do ICMS (ex.: 40 isenta)
--        icms_aliquota    alíquota do ICMS, quando tributado
--        pis_cst          CST do PIS    (ex.: 06 alíquota zero, 07 isenta)
--        cofins_cst       CST da COFINS
--        cest, ean        quando houver
--        codigo           o código do produto no Omie (PRD00016…)
--
--     Os produtos que já existem ganham exatamente a tributação de hoje
--     (origem 0, CST 40 / 07 / 07) — as notas deles não mudam em nada.
--
--  2. As frutas do cadastro do Omie que ainda não estão no app, como CVC e
--     CFOP 5.102 (revenda). Caixas, etiquetas, grampos e máquina NÃO entram:
--     são cadastrados direto no Spedy. A TRIBUTAÇÃO (CSTs) NÃO VEIO NA
--     PLANILHA do Omie e fica vazia: o app não deixa emitir nota de produto
--     da CVC sem tributação. Preencha pela aba Estoque → lápis do produto,
--     depois de confirmar com o contador.
--
--  Rode ANTES de publicar a versão do app com os dados fiscais — sem as
--  colunas, as gravações de produto ficam presas na fila de Sincronização.
--  Depois da migracao-27.
--
--  Idempotente: pode rodar de novo sem quebrar nada e sem duplicar produto.
--  Nada é apagado.
-- ============================================================================

begin;

-- ─── 1. Tributação por produto ──────────────────────────────────────────────

alter table public.produtos add column if not exists codigo        text;
alter table public.produtos add column if not exists origem        smallint;
alter table public.produtos add column if not exists icms_cst      text;
alter table public.produtos add column if not exists icms_aliquota numeric(5,2);
alter table public.produtos add column if not exists pis_cst       text;
alter table public.produtos add column if not exists cofins_cst    text;
alter table public.produtos add column if not exists cest          text;
alter table public.produtos add column if not exists ean           text;

-- Os produtos de hoje (produção própria, Carvalho Cruz) ficam com a
-- tributação que o app sempre usou. Só preenche o que está vazio.
update public.produtos
   set origem     = coalesce(origem, 0),
       icms_cst   = coalesce(icms_cst, '40'),
       pis_cst    = coalesce(pis_cst, '07'),
       cofins_cst = coalesce(cofins_cst, '07')
 where empresa = 'carvalho_cruz';

-- ─── 2. Frutas do Omie (CVC) ────────────────────────────────────────────────
--
--  Fora da lista, de propósito: laranja pera, laranja lima, os sacos de
--  laranja e abóbora (já cadastrados, produção própria); o "MILHO VERDE" com
--  NCM de milho em grão (duplicado do MILHO VERDE IN NATURA); e tudo que não
--  é fruta (vai direto no Spedy).
--
--  Cada fruta da CVC é a sua própria fruta no estoque. Entra só o que ainda
--  não existe com o mesmo nome.

insert into public.produtos
  (nome, fruta, empresa, unidade_venda, kg_por_unidade, preco,
   ncm, cfop_padrao, unidade_omie, codigo, origem)
select v.nome, v.fruta, 'cvc', 'kg', 1, 0,
       v.ncm, '5.102', v.unidade_omie, v.codigo, 0
  from (values
    -- nome                              fruta                      NCM            un.   código Omie
    ('Abacate',                          'Abacate',                   '0804.40.00', 'KG', 'PRD00016'),
    ('Ameixa Fresca Importada',          'Ameixa Fresca Importada',   '0809.40.00', 'KG', 'PRD00017'),
    ('Coco Seco',                        'Coco Seco',                 '0801.11.00', 'KG', 'PRD00024'),
    ('Goiaba',                           'Goiaba',                    '0804.50.10', 'KG', 'PRD00018'),
    ('Kiwi Importado',                   'Kiwi Importado',            '0810.50.00', 'KG', 'PRD00022'),
    ('Laranja Nacional',                 'Laranja Nacional',          '0805.10.00', 'KG', '3321'),
    ('Laranja Navelina',                 'Laranja Navelina',          '0805.10.00', 'KG', 'PRD00010'),
    ('Lima da Pérsia',                   'Lima da Pérsia',            '0805.50.00', 'KG', 'PRD00011'),
    ('Limão',                            'Limão',                     '0805.50.00', 'KG', 'PRD00015'),
    ('Limão Siciliano',                  'Limão Siciliano',           '0805.50.00', 'KG', 'PRD00032'),
    ('Maçã Verde',                       'Maçã Verde',                '0808.10.00', 'KG', 'PRD00012'),
    ('Mamão Havaí',                      'Mamão Havaí',               '0807.20.00', 'KG', 'PRD00033'),
    ('Manga Espada',                     'Manga Espada',              '0804.50.20', 'KG', 'PRD00034'),
    ('Manga Tommy Atkins',               'Manga Tommy Atkins',        '0804.50.20', 'KG', 'PRD00025'),
    ('Maracujá',                         'Maracujá',                  '0810.90.15', 'KG', 'PRD00019'),
    ('Melancia',                         'Melancia',                  '0807.11.00', 'UN', 'PRD00029'),
    ('Melão Orange',                     'Melão Orange',              '0807.19.00', 'KG', 'PRD00020'),
    ('Milho Verde',                      'Milho Verde',               '0709.99.19', 'UN', 'PRD00006'),
    ('Pera D''Anjou',                    'Pera D''Anjou',             '0808.30.00', 'KG', 'PRD00021'),
    ('Pera Importada USA',               'Pera Importada USA',        '0808.30.00', 'KG', 'PRD00014'),
    ('Pera Portuguesa',                  'Pera Portuguesa',           '0808.30.00', 'KG', 'PRD00023'),
    ('Pinha',                            'Pinha',                     '0810.90.12', 'KG', 'PRD00030'),
    ('Tangerina',                        'Tangerina',                 '0805.21.00', 'UN', 'PRD00028'),
    ('Tangerina Murcote',                'Tangerina Murcote',         '0805.21.00', 'KG', 'PRD00031'),
    ('Tangerina Piemonte',               'Tangerina Piemonte',        '0805.21.00', 'KG', 'PRD00013'),
    ('Tangerina Ponkan',                 'Tangerina Ponkan',          '0805.21.00', 'KG', 'PRD00009')
  ) as v(nome, fruta, ncm, unidade_omie, codigo)
 where not exists (select 1 from public.produtos p where lower(p.nome) = lower(v.nome));

commit;

-- Confira:
--   select empresa, count(*), count(icms_cst) as com_tributacao from public.produtos group by 1;
--   select nome, ncm, cfop_padrao, icms_cst from public.produtos where empresa = 'cvc' order by nome;

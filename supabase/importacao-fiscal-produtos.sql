-- ============================================================================
--  NCM/unidade/CFOP dos produtos — gerado por scripts/gerar-cadastro-fiscal-produtos.py
--  NÃO edite direto no banco: corrija o dicionário MAPEAMENTO no script e rode
--  de novo.
--
--  Origem (NCM/unidade): produtos-omie.csv (export do cadastro de produtos do Omie).
--  omie_codigo_produto veio da API (ListarProdutos), está hardcoded no script.
--  CFOP 5.101 porque laranja e abóbora são produção própria da fazenda da
--  Carvalho Cruz, não revenda (confirmado com eles).
--
--  Rode DEPOIS de migracao-08-nfe.sql e migracao-09-omie-ids.sql.
--  Idempotente: usa coalesce, nunca sobrescreve o que já tiver sido preenchido.
-- ============================================================================

begin;

update public.produtos set
    ncm                 = coalesce(ncm, '0709.93.00'),
    unidade_omie        = coalesce(unidade_omie, 'KG'),
    cfop_padrao         = coalesce(cfop_padrao, '5.101'),
    omie_codigo_produto = coalesce(omie_codigo_produto, 3514250300)
  where lower(nome) = lower('Abóbora');

update public.produtos set
    ncm                 = coalesce(ncm, '0805.10.00'),
    unidade_omie        = coalesce(unidade_omie, 'KG'),
    cfop_padrao         = coalesce(cfop_padrao, '5.101'),
    omie_codigo_produto = coalesce(omie_codigo_produto, 3488791604)
  where lower(nome) = lower('Laranja Agranel');

update public.produtos set
    ncm                 = coalesce(ncm, '0805.10.00'),
    unidade_omie        = coalesce(unidade_omie, 'KG'),
    cfop_padrao         = coalesce(cfop_padrao, '5.101'),
    omie_codigo_produto = coalesce(omie_codigo_produto, 3497757194)
  where lower(nome) = lower('Laranja Lima');

update public.produtos set
    ncm                 = coalesce(ncm, '0805.10.00'),
    unidade_omie        = coalesce(unidade_omie, 'BAG'),
    cfop_padrao         = coalesce(cfop_padrao, '5.101'),
    omie_codigo_produto = coalesce(omie_codigo_produto, 3501923470)
  where lower(nome) = lower('Saco 10 kg');

update public.produtos set
    ncm                 = coalesce(ncm, '0805.10.00'),
    unidade_omie        = coalesce(unidade_omie, 'BAG'),
    cfop_padrao         = coalesce(cfop_padrao, '5.101'),
    omie_codigo_produto = coalesce(omie_codigo_produto, 3499070124)
  where lower(nome) = lower('Saco 2,5 kg');

update public.produtos set
    ncm                 = coalesce(ncm, '0805.10.00'),
    unidade_omie        = coalesce(unidade_omie, 'BAG'),
    cfop_padrao         = coalesce(cfop_padrao, '5.101'),
    omie_codigo_produto = coalesce(omie_codigo_produto, 3498404281)
  where lower(nome) = lower('Saco 3 kg');

update public.produtos set
    ncm                 = coalesce(ncm, '0805.10.00'),
    unidade_omie        = coalesce(unidade_omie, 'BAG'),
    cfop_padrao         = coalesce(cfop_padrao, '5.101'),
    omie_codigo_produto = coalesce(omie_codigo_produto, 3495889206)
  where lower(nome) = lower('Saco 5 kg');

commit;

-- Confira:  select nome, ncm, unidade_omie, cfop_padrao, omie_codigo_produto
--           from public.produtos order by nome;
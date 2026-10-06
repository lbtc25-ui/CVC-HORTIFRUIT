-- ============================================================================
--  Roda no SQL Editor do Supabase da CARVALHO CRUZ (só leitura — não altera
--  nada). Devolve UMA célula com o SQL pronto para colar no Supabase da CVC:
--  fornecedores e produtos cadastrados na Carvalho.
--
--  - Copie o valor da célula "sql_para_cvc" (botão de copiar da célula) e cole
--    no SQL Editor do Supabase da CVC.
--  - Não duplica: só entra o que ainda não existe com o mesmo nome.
--  - Preço entra 0 e estoque 0 (o preço é definido na emissão da NF).
-- ============================================================================
select
  'begin;' || E'\n' ||
  coalesce((
    select string_agg(format(
      'insert into public.fornecedores (nome, telefone, produto, cidade, status) '
      'select %L, %L, %L, %L, %L where not exists '
      '(select 1 from public.fornecedores where lower(nome) = lower(%L));',
      nome, telefone, produto, cidade, status, nome), E'\n' order by nome)
    from public.fornecedores), '') || E'\n' ||
  coalesce((
    select string_agg(format(
      'insert into public.produtos (nome, fruta, empresa, unidade_venda, kg_por_unidade, preco, '
      'ncm, cfop_padrao, unidade_omie, codigo, origem, icms_cst, icms_aliquota, pis_cst, cofins_cst, cest, ean) '
      'select %L, %L, %L, %L, %L::numeric, 0, %L, %L, %L, %L, %L::smallint, %L, %L::numeric, %L, %L, %L, %L '
      'where not exists (select 1 from public.produtos where lower(nome) = lower(%L));',
      nome, fruta, empresa, unidade_venda, kg_por_unidade,
      ncm, cfop_padrao, unidade_omie, codigo, origem, icms_cst, icms_aliquota,
      pis_cst, cofins_cst, cest, ean, nome), E'\n' order by nome)
    from public.produtos), '') || E'\n' ||
  'commit;' as sql_para_cvc;

-- ============================================================================
--  Junta "TANGERINA POKAN" (cadastrada à mão pelo app em 26/09, sem NCM nem
--  tributação) na "Tangerina Ponkan" que veio do Omie (PRD00009).
--
--  Tudo que apontava para a repetida passa para a certa: itens de venda,
--  itens de notas de entrada, listas de produtos do link de pedido e
--  compras/perdas/acertos da fruta. Depois a repetida é apagada.
--
--  Idempotente: se a repetida já não existe, não faz nada.
-- ============================================================================

begin;

do $$
declare
  repetida uuid;
  certa    uuid;
begin
  select id into repetida from public.produtos
   where lower(nome) = 'tangerina pokan' and empresa = 'cvc' and codigo is null;
  select id into certa from public.produtos
   where codigo = 'PRD00009' and empresa = 'cvc';

  if repetida is null then
    raise notice 'TANGERINA POKAN não existe mais — nada a fazer.';
    return;
  end if;
  if certa is null then
    raise exception 'Tangerina Ponkan (PRD00009) não encontrada — rode a migracao-28 antes.';
  end if;

  -- Vendas: o id do produto dentro dos itens (jsonb).
  update public.vendas
     set itens = replace(itens::text, repetida::text, certa::text)::jsonb
   where itens::text like '%' || repetida::text || '%';

  -- Notas de entrada (migração 25), se existirem.
  if to_regclass('public.notas_entrada') is not null then
    execute format(
      'update public.notas_entrada set itens = replace(itens::text, %L, %L)::jsonb where itens::text like %L',
      repetida::text, certa::text, '%' || repetida::text || '%');
  end if;

  -- Produtos liberados no link de pedido (migração 23), se existirem.
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'redes' and column_name = 'produtos_pedido') then
    update public.redes set produtos_pedido = array_remove(array_replace(produtos_pedido, repetida, certa), null)
     where repetida = any (produtos_pedido);
    update public.lojas set produtos_pedido = array_remove(array_replace(produtos_pedido, repetida, certa), null)
     where repetida = any (produtos_pedido);
  end if;

  -- Estoque: compras, perdas e acertos lançados na fruta repetida.
  update public.compras set fruta = 'Tangerina Ponkan' where fruta = 'TANGERINA POKAN';
  update public.perdas  set fruta = 'Tangerina Ponkan' where fruta = 'TANGERINA POKAN';
  update public.acertos set fruta = 'Tangerina Ponkan' where fruta = 'TANGERINA POKAN';

  delete from public.produtos where id = repetida;
  raise notice 'TANGERINA POKAN juntada na Tangerina Ponkan.';
end $$;

commit;

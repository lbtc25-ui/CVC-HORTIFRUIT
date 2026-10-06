-- ============================================================================
--  Banco novo — deixa os produtos prontos para o resgate
--
--  A migracao-28 cadastra as frutas da CVC com ids novos. Num banco que vai
--  receber o resgate dos aparelhos (/resgate), essas mesmas frutas voltam
--  com os ids de sempre — e ficariam em dobro. Este passo tira as da 28.
--
--  Só age em banco NOVO: se já houver venda ou compra lançada, não faz nada.
--  Entra no fim do instalar.sql; rodar de novo é seguro.
-- ============================================================================

do $$
begin
  if not exists (select 1 from public.vendas)
     and not exists (select 1 from public.compras) then
    delete from public.produtos;
  end if;
end;
$$;

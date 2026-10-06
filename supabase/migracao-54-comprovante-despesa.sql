-- ============================================================================
--  Migração 54 — comprovante de pagamento na despesa
--
--  Cada despesa pode levar o comprovante que o banco gerou (PDF ou foto):
--
--    despesas.comprovante_path   caminho do arquivo no bucket
--    despesas.comprovante_nome   nome original, para mostrar na lista
--
--  O arquivo vai para um bucket PRIVADO, "despesas-comprovantes". Só sócio
--  master e assistente administrativo (e_gestor) leem e gravam; a tela pede
--  um link temporário a cada abertura. Sem policy de update: o nome do arquivo
--  leva a hora, então corrigir é anexar outro. Apagar só vale para a pasta
--  caixa/ — os comprovantes que chegam pelo Atalho do iPhone (api/comprovante.js)
--  e ainda não viraram despesa (a tela só oferece descartar os que não estão em nenhuma).
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

alter table public.despesas add column if not exists comprovante_path text;
alter table public.despesas add column if not exists comprovante_nome text;

insert into storage.buckets (id, name, public)
values ('despesas-comprovantes', 'despesas-comprovantes', false)
on conflict (id) do nothing;

drop policy if exists despesas_comprovantes_leitura  on storage.objects;
drop policy if exists despesas_comprovantes_insercao on storage.objects;
drop policy if exists despesas_comprovantes_descarte  on storage.objects;

create policy despesas_comprovantes_leitura on storage.objects
  for select to authenticated
  using (bucket_id = 'despesas-comprovantes' and public.e_gestor());

create policy despesas_comprovantes_insercao on storage.objects
  for insert to authenticated
  with check (bucket_id = 'despesas-comprovantes' and public.e_gestor());

create policy despesas_comprovantes_descarte on storage.objects
  for delete to authenticated
  using (bucket_id = 'despesas-comprovantes' and (storage.foldername(name))[1] = 'caixa' and public.e_gestor());

-- ============================================================================
--  Migração 66 — peso médio por unidade (abóbora, melancia…)
--
--  Frutas vendidas ora no quilo, ora por unidade: o peso médio de uma unidade
--  é o ponto de partida do pedido por unidade (o app converte em kg). A última
--  venda por unidade do produto continua valendo antes dele.
--
--    produtos.peso_medio_unidade   numeric, null = não cadastrado
--
--  Já preenche abóbora (5 kg) e melancia (6 kg), só onde estiver vazio.
--  Rode ANTES de publicar a versão do app. Idempotente. Nada é apagado.
-- ============================================================================

begin;

alter table public.produtos add column if not exists peso_medio_unidade numeric;

update public.produtos set peso_medio_unidade = 5
 where peso_medio_unidade is null and lower(fruta) like '%ab_bora%';

update public.produtos set peso_medio_unidade = 6
 where peso_medio_unidade is null and lower(fruta) like '%melancia%';

commit;

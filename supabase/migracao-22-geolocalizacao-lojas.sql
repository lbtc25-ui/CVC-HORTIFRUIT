-- ============================================================================
--  Migração 22 — geolocalização da loja: latitude e longitude
--
--  O romaneio ordena as paradas pela distância em linha reta até o CD, e
--  desenha um mapa da rota — pra isso precisa saber onde cada loja fica.
--  A coordenada é geocodificada uma vez a partir do endereço (Nominatim,
--  OpenStreetMap — gratuito) e guardada aqui pra não pedir de novo toda hora.
--
--  Como aplicar, NESTA ORDEM: depois de migracao-21-pedido-cliente.sql.
--
--  Idempotente: pode rodar de novo sem quebrar nada.
-- ============================================================================

begin;

alter table public.lojas add column if not exists lat double precision;
alter table public.lojas add column if not exists lng double precision;

commit;

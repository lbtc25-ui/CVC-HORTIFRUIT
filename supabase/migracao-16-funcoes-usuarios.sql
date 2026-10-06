-- ============================================================================
--  Migração 16 — função de cada pessoa da folha e o usuário dela
--
--    funcao       o que a pessoa faz: Gerente, Administrativo, Serviços
--                 Gerais ou Motorista. O romaneio oferece para a rota só
--                 quem é Motorista.
--    usuario_id   a conta de acesso ao sistema dessa pessoa (perfis.id),
--                 quando ela tem uma. Uma conta liga a uma pessoa só.
--                 Se a conta for apagada, o vínculo some e a pessoa fica.
--
--  Precisa rodar DEPOIS do auth.sql, que cria a tabela `perfis`.
--
--  ⚠️  Rode ANTES de usar a versão do app que traz os campos. O app passa a
--      enviar essas colunas em toda gravação de funcionário; sem elas, o
--      Supabase recusa o envio e a alteração fica presa na fila de
--      Sincronização até a migração ser aplicada (aí ela sobe sozinha).
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

alter table public.funcionarios add column if not exists funcao     text;
alter table public.funcionarios add column if not exists usuario_id uuid;

alter table public.funcionarios drop constraint if exists funcionarios_usuario_id_fkey;
alter table public.funcionarios add constraint funcionarios_usuario_id_fkey
  foreign key (usuario_id) references public.perfis (id) on delete set null;

create unique index if not exists funcionarios_usuario_unico
  on public.funcionarios (usuario_id) where usuario_id is not null;

commit;

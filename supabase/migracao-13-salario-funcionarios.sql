-- ============================================================================
--  Migração 13 — salário no cadastro de diaristas e funcionários
--
--  `funcionarios.salario` guarda o combinado com cada pessoa: o salário do
--  mês para funcionário, o valor da diária para diarista. Vazio quando não
--  foi informado. O app usa o número para já preencher o valor ao registrar
--  um pagamento — quem lança ainda pode mudar antes de salvar.
--
--  ⚠️  Rode ANTES de usar a versão do app que traz o campo. O app passa a
--      enviar a coluna em toda gravação de funcionário; sem ela, o Supabase
--      recusa o envio e a alteração fica presa na fila de Sincronização até
--      a migração ser aplicada (aí ela sobe sozinha).
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

alter table public.funcionarios add column if not exists salario numeric(14,2);

alter table public.funcionarios drop constraint if exists funcionarios_salario_check;
alter table public.funcionarios add constraint funcionarios_salario_check check (salario is null or salario >= 0);

commit;

-- ============================================================================
--  Migração 15 — histórico da folha e horas extras
--
--  1. Cada pagamento guarda uma cópia de quem recebeu (`funcionario_nome`,
--     `funcionario_tipo`). Ao remover uma pessoa do cadastro, o vínculo
--     `funcionario_id` vira null, mas o histórico por mês continua mostrando
--     o nome e quanto ela recebeu.
--  2. `extras` é a parte do pagamento que foi hora extra, e `horas_extras`
--     quantas horas foram. `valor` continua sendo o total pago (o que entra
--     no DRE); o salário é `valor - extras`.
--
--  Os pagamentos que já existem recebem o nome e o tipo do cadastro atual.
--  Os que já tinham perdido o vínculo antes desta migração não têm de onde
--  tirar o nome e ficam como "Pessoa removida".
--
--  ⚠️  Rode ANTES de usar a versão do app que traz o histórico. O app passa
--      a enviar essas colunas em todo pagamento; sem elas, o Supabase recusa
--      o envio e o lançamento fica preso na fila de Sincronização até a
--      migração ser aplicada (aí ele sobe sozinho).
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

alter table public.pagamentos add column if not exists funcionario_nome text;
alter table public.pagamentos add column if not exists funcionario_tipo text;
alter table public.pagamentos add column if not exists extras       numeric(14,2) not null default 0;
alter table public.pagamentos add column if not exists horas_extras numeric(8,2)  not null default 0;

alter table public.pagamentos drop constraint if exists pagamentos_extras_check;
alter table public.pagamentos add constraint pagamentos_extras_check check (extras >= 0 and extras <= valor);
alter table public.pagamentos drop constraint if exists pagamentos_horas_extras_check;
alter table public.pagamentos add constraint pagamentos_horas_extras_check check (horas_extras >= 0);

update public.pagamentos p
   set funcionario_nome = f.nome,
       funcionario_tipo = f.tipo
  from public.funcionarios f
 where f.id = p.funcionario_id
   and p.funcionario_nome is null;

commit;

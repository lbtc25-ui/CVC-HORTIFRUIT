-- ============================================================================
--  Migração 69 — quem recebeu a venda e o repasse para a CVC
--
--  A CVC vende pela própria conta, pela Carvalho Cruz (CC) ou pela AVF. Quando
--  o vendedor é a CC ou a AVF, o dinheiro cai na conta DELAS e elas precisam
--  repassar à CVC. Isto guarda quem recebeu e o que já foi repassado:
--
--    vendas.recebedor   'cvc' (padrão) | 'carvalho_cruz' | 'avf'
--    repasses           dinheiro que andou entre a conta e a CVC
--    vw_repasse_conta   por conta: recebido, a receber, repassado e saldo
--
--  repasses.sentido:  'para_cvc'    a conta repassou à CVC
--                     'da_cvc'      a CVC mandou dinheiro à conta (reembolso)
--                     'a_confirmar' lançado do comprovante, ainda sem sentido
--                                   definido — fica fora do saldo
--
--  Saldo (a_repassar) = vendas pagas recebidas pela conta
--                       − repasses 'para_cvc' + repasses 'da_cvc'
--  Positivo = a conta ainda deve repassar à CVC.
--
--  Idempotente. Nada é apagado; vendas existentes ficam como 'cvc'.
-- ============================================================================

begin;

alter table public.vendas add column if not exists recebedor text not null default 'cvc';
alter table public.vendas drop constraint if exists vendas_recebedor_check;
alter table public.vendas add constraint vendas_recebedor_check
  check (recebedor in ('cvc', 'carvalho_cruz', 'avf'));

create table if not exists public.repasses (
  id             uuid primary key default gen_random_uuid(),
  data           date not null default current_date,
  conta          text not null check (conta in ('carvalho_cruz', 'avf')),
  sentido        text not null default 'a_confirmar'
                   check (sentido in ('para_cvc', 'da_cvc', 'a_confirmar')),
  valor          numeric(14,2) not null check (valor >= 0),
  descricao      text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

create index if not exists repasses_conta_idx on public.repasses (conta, data desc);

alter table public.repasses enable row level security;

drop policy if exists acesso_app          on public.repasses;
drop policy if exists repasses_leitura    on public.repasses;
drop policy if exists repasses_insercao   on public.repasses;
drop policy if exists repasses_atualizacao on public.repasses;
drop policy if exists repasses_exclusao   on public.repasses;

do $$
begin
  if to_regprocedure('public.e_socio()') is not null then
    create policy repasses_leitura on public.repasses
      for select to authenticated using (public.e_socio());
    create policy repasses_insercao on public.repasses
      for insert to authenticated with check (public.e_socio());
    create policy repasses_atualizacao on public.repasses
      for update to authenticated using (public.e_socio()) with check (public.e_socio());
    create policy repasses_exclusao on public.repasses
      for delete to authenticated using (public.e_socio());

    revoke all on public.repasses from anon;
    grant select, insert, update, delete on public.repasses to authenticated;
  else
    create policy acesso_app on public.repasses
      for all to anon, authenticated using (true) with check (true);
    grant select, insert, update, delete on public.repasses to anon, authenticated;
  end if;
end;
$$;

create or replace view public.vw_repasse_conta as
with contas as (
  select unnest(array['carvalho_cruz', 'avf']) as conta
),
vendido as (
  select recebedor as conta,
         coalesce(sum(total) filter (where status = 'pago'), 0)     as recebido,
         coalesce(sum(total) filter (where status = 'pendente'), 0) as a_receber
  from public.vendas
  where recebedor <> 'cvc'
  group by recebedor
),
movido as (
  select conta,
         coalesce(sum(valor) filter (where sentido = 'para_cvc'), 0)    as repassado,
         coalesce(sum(valor) filter (where sentido = 'da_cvc'), 0)      as recebido_da_cvc,
         coalesce(sum(valor) filter (where sentido = 'a_confirmar'), 0) as a_confirmar
  from public.repasses
  group by conta
)
select c.conta,
       coalesce(v.recebido, 0)        as recebido,
       coalesce(v.a_receber, 0)       as a_receber,
       coalesce(m.repassado, 0)       as repassado,
       coalesce(m.recebido_da_cvc, 0) as recebido_da_cvc,
       coalesce(m.a_confirmar, 0)     as a_confirmar,
       coalesce(v.recebido, 0) - coalesce(m.repassado, 0) + coalesce(m.recebido_da_cvc, 0) as a_repassar
from contas c
left join vendido v on v.conta = c.conta
left join movido  m on m.conta = c.conta;

alter view public.vw_repasse_conta set (security_invoker = on);
grant select on public.vw_repasse_conta to authenticated;

commit;

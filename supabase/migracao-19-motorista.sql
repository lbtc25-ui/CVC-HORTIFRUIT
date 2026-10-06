-- ============================================================================
--  Migração 19 — papel Motorista: as próprias entregas, e nada mais
--
--  O motorista entra no app e vê só a aba "Minhas Entregas": as paradas do
--  romaneio em que ele foi escalado, na ordem da rota, com o endereço da loja
--  (para abrir no Maps) e a câmera para ler o QR da nota.
--
--  Quem é o motorista: a conta dele (perfis) está ligada a uma pessoa da
--  folha (funcionarios.usuario_id, migracao-16), e o romaneio escala essa
--  pessoa em vendas.motorista_id.
--
--  Ele NÃO ganha leitura das tabelas do negócio — nem vendas, nem lojas. Tudo
--  passa por duas funções SECURITY DEFINER, que só devolvem e só mexem nas
--  entregas escaladas para ele:
--
--    minhas_entregas(dia)       paradas do dia: loja, endereço, ordem, status
--    registrar_escaneio(venda)  o mesmo escaneio do Romaneio —
--                               pendente → em_rota (saída do CD)
--                               em_rota  → entregue (entrega na loja)
--
--  O dia é o da VIAGEM (`rota_data`, da migracao-18-romaneio-prioridade),
--  não o do pedido; pedido prioritário vem primeiro, como no Romaneio.
--
--  Precisa rodar DEPOIS do auth.sql, da migracao-14, da migracao-16 e da
--  migracao-18-romaneio-prioridade.
--
--  Idempotente: pode rodar de novo sem quebrar nada. Nada é apagado.
-- ============================================================================

begin;

-- ─── Papel novo ─────────────────────────────────────────────────────────────

alter table public.perfis disable trigger user;
alter table public.perfis drop constraint if exists perfis_papel_check;
alter table public.perfis
  add constraint perfis_papel_check
  check (papel in ('socio_master', 'assistente_administrativo', 'promotor', 'motorista'));
alter table public.perfis enable trigger user;

-- ─── Paradas do motorista ───────────────────────────────────────────────────

-- O retorno mudou (entrou `prioridade`): o Postgres só troca as colunas de
-- uma função recriando-a.
drop function if exists public.minhas_entregas(date);

create or replace function public.minhas_entregas(dia date)
returns table (
  id              uuid,
  prioridade      boolean,
  numero          integer,
  ordem_rota      integer,
  status_entrega  text,
  saida_cd_em     timestamptz,
  entregue_em     timestamptz,
  loja            text,
  rede            text,
  logradouro      text,
  numero_endereco text,
  complemento     text,
  bairro          text,
  cidade          text,
  uf              text,
  cep             text,
  veiculo         text
)
language sql
stable
security definer
set search_path = public
as $$
  select v.id, coalesce(v.prioridade, false), v.numero, v.ordem_rota, v.status_entrega, v.saida_cd_em, v.entregue_em,
         l.nome, r.nome,
         l.logradouro, l.numero, l.complemento, l.bairro, l.cidade, l.uf, l.cep,
         ve.nome
    from public.vendas v
    join public.funcionarios f on f.id = v.motorista_id
    left join public.lojas l     on l.id = v.loja_id
    left join public.redes r     on r.id = l.rede_id
    left join public.veiculos ve on ve.id = v.veiculo_id
   where f.usuario_id = auth.uid()
     and public.papel_atual() = 'motorista'
     and coalesce(v.rota_data, v.data) = dia
     and v.status <> 'cancelado'
   order by coalesce(v.prioridade, false) desc, v.ordem_rota nulls last, v.numero;
$$;

-- ─── Escaneio do QR ─────────────────────────────────────────────────────────

create or replace function public.registrar_escaneio(venda uuid)
returns table (status_entrega text, numero integer, loja text, momento timestamptz, mudou boolean)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v record;
begin
  if public.papel_atual() is distinct from 'motorista' then
    raise exception 'Só o motorista registra escaneio por aqui.';
  end if;

  select vd.id, vd.numero, vd.status_entrega, vd.saida_cd_em, vd.entregue_em, l.nome as loja
    into v
    from public.vendas vd
    join public.funcionarios f on f.id = vd.motorista_id
    left join public.lojas l on l.id = vd.loja_id
   where vd.id = venda and f.usuario_id = auth.uid() and vd.status <> 'cancelado';

  if not found then
    raise exception 'Esta nota não está nas suas entregas.';
  end if;

  if v.status_entrega = 'pendente' then
    update public.vendas set status_entrega = 'em_rota', saida_cd_em = now() where id = v.id;
    return query select 'em_rota'::text, v.numero, v.loja, now(), true;
  elsif v.status_entrega = 'em_rota' then
    update public.vendas set status_entrega = 'entregue', entregue_em = now() where id = v.id;
    return query select 'entregue'::text, v.numero, v.loja, now(), true;
  else
    return query select v.status_entrega, v.numero, v.loja, v.entregue_em, false;
  end if;
end;
$$;

revoke all on function public.minhas_entregas(date)     from public, anon;
revoke all on function public.registrar_escaneio(uuid)  from public, anon;
grant execute on function public.minhas_entregas(date)    to authenticated;
grant execute on function public.registrar_escaneio(uuid) to authenticated;

commit;

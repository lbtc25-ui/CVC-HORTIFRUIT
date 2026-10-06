-- ============================================================================
--  Migração 35 — link de pedido GERAL (todas as redes e lojas no mesmo link)
--
--  Além do link de cada loja (migração 21) e do link de cada rede (migração
--  26), um único link reúne TODAS as redes e lojas ativas — para a própria
--  equipe (vendedor externo, por exemplo) lançar o pedido de qualquer
--  cliente sem abrir o app e sem login:
--
--      https://seu-app.vercel.app/pedido/geral/7b2e0c…
--
--  Quem abre busca a rede ou a loja, escolhe uma ou várias — de redes
--  diferentes, se precisar — põe as quantidades e envia tudo de uma vez.
--  Cada loja vira um pedido SEPARADO em Vendas, igual ao link da rede.
--
--  Só existe UM link geral (não é por rede nem por loja): a tabela
--  `pedido_geral_config` guarda uma linha só, com o token. *Gerar novo link*
--  troca esse token e não mexe nos links de cada rede ou loja, e vice-versa.
--
--  Atenção: este link expõe o nome de TODAS as redes e lojas cadastradas —
--  mais do que o link de uma rede só. Repasse apenas para a equipe interna,
--  não para o cliente.
--
--  Segurança: mesmo modelo da 21/26 — a tabela não é lida nem gravada
--  direto (RLS fecha tudo para `anon`; só sócio master e assistente leem o
--  token, pela aba Clientes), só duas funções SECURITY DEFINER que exigem o
--  token e só gravam para lojas ATIVAS de redes ATIVAS. Freio contra abuso:
--  os 10 pedidos por loja por hora da 21 valem aqui também, e o link geral
--  aceita no máximo 200 pedidos por hora no total (o da rede aceita 60).
--
--  Depois da migracao-29 (usa pedido_cliente_gravar com o nome de quem
--  pediu) e da migracao-23 (produtos liberados por rede/loja). Idempotente.
--  Nada é apagado.
-- ============================================================================

begin;

-- ─── Token único do link geral ──────────────────────────────────────────────

create table if not exists public.pedido_geral_config (
  id boolean primary key default true check (id),
  token_pedido text not null default public.novo_token_pedido()
);
insert into public.pedido_geral_config (id)
  values (true)
  on conflict (id) do nothing;

alter table public.pedido_geral_config enable row level security;

drop policy if exists pedido_geral_config_leitura on public.pedido_geral_config;
create policy pedido_geral_config_leitura on public.pedido_geral_config
  for select to authenticated
  using (public.e_gestor());

revoke all on public.pedido_geral_config from public, anon;
grant select on public.pedido_geral_config to authenticated;

-- ─── Abrir: todas as redes ativas com lojas ativas, cada uma com seus produtos liberados ──

create or replace function public.pedido_geral_abrir(token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  redes jsonb;
begin
  if not exists (select 1 from public.pedido_geral_config c where c.token_pedido = pedido_geral_abrir.token) then
    raise exception 'Link de pedido inválido ou desativado.' using errcode = 'P0002';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id,
           'nome', r.nome,
           'lojas', x.lojas
         ) order by r.nome), '[]'::jsonb)
    into redes
    from public.redes r
    join lateral (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', lj.id,
               'nome', lj.nome,
               'produtoIds', to_jsonb(public.pedido_cliente_permitidos(lj.id)),
               'ultimoPedido', public.pedido_cliente_ultimo(lj.id, public.pedido_cliente_permitidos(lj.id))
             ) order by lj.nome), '[]'::jsonb) as lojas
        from public.lojas lj
       where lj.rede_id = r.id and lj.status = 'ativo'
    ) x on true
   where r.status = 'ativo' and jsonb_array_length(x.lojas) > 0;

  return jsonb_build_object('redes', redes, 'produtos', public.pedido_cliente_produtos(null));
end;
$$;

-- `pedidos` chega como [{ "lojaId": "…", "itens": [...], "observacao": "…" }, …],
-- vindas de lojas de qualquer rede ativa. `nome` vale para todo o envio.
create or replace function public.pedido_geral_enviar(token text, pedidos jsonb, nome text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  ped jsonb;
  loja_id uuid;
  vistos uuid[] := '{}';
  feitos jsonb := '[]'::jsonb;
begin
  if not exists (select 1 from public.pedido_geral_config c where c.token_pedido = pedido_geral_enviar.token) then
    raise exception 'Link de pedido inválido ou desativado.' using errcode = 'P0002';
  end if;

  if jsonb_typeof(pedidos) is distinct from 'array' or jsonb_array_length(pedidos) = 0 then
    raise exception 'Nenhuma loja com pedido.';
  end if;
  if jsonb_array_length(pedidos) > 60 then
    raise exception 'Lojas demais num envio só.';
  end if;

  if (select count(*) from public.vendas v
       where v.origem = 'cliente'
         and v.criado_em > now() - interval '1 hour') + jsonb_array_length(pedidos) > 200 then
    raise exception 'Muitos pedidos em pouco tempo. Aguarde um pouco ou fale com a distribuidora.';
  end if;

  for ped in select * from jsonb_array_elements(pedidos) loop
    select lj.id into loja_id
      from public.lojas lj
      join public.redes r on r.id = lj.rede_id
     where lj.id::text = ped ->> 'lojaId'
       and lj.status = 'ativo'
       and r.status = 'ativo';
    if not found then
      raise exception 'Loja não encontrada — recarregue a página.';
    end if;
    if loja_id = any(vistos) then
      raise exception 'Loja repetida no envio.';
    end if;
    vistos := vistos || loja_id;

    feitos := feitos || jsonb_build_array(
      public.pedido_cliente_gravar(loja_id, ped -> 'itens', ped ->> 'observacao', pedido_geral_enviar.nome));
  end loop;

  return feitos;
end;
$$;

-- ─── Gerar novo link geral (equipe) ─────────────────────────────────────────

create or replace function public.renovar_link_pedido_geral()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  novo text := public.novo_token_pedido();
begin
  if not public.e_gestor() then
    raise exception 'Só sócio master ou assistente geram link novo.';
  end if;
  update public.pedido_geral_config set token_pedido = novo where id;
  return novo;
end;
$$;

revoke all on function public.pedido_geral_abrir(text)                from public;
revoke all on function public.pedido_geral_enviar(text, jsonb, text)  from public;
revoke all on function public.renovar_link_pedido_geral()             from public, anon;
grant execute on function public.pedido_geral_abrir(text)               to anon, authenticated;
grant execute on function public.pedido_geral_enviar(text, jsonb, text) to anon, authenticated;
grant execute on function public.renovar_link_pedido_geral()            to authenticated;

commit;

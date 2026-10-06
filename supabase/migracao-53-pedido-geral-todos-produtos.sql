-- ============================================================================
--  Migração 53 — link de pedido GERAL libera TODOS os produtos para TODAS as lojas
--
--  Até aqui o link geral respeitava a lista de produtos liberados de cada
--  rede/loja (migração 23). Para a equipe, que lança pedido de qualquer
--  cliente, isso atrapalhava: faltava fruta. Agora o link geral aceita
--  qualquer produto em qualquer loja. Os produtos que a loja já costuma pedir
--  (a lista liberada) continuam chegando em `produtoIds` — a página os mostra
--  primeiro, e os demais logo abaixo, com busca.
--
--  Os links da loja e da rede NÃO mudam: continuam só com o liberado.
--
--  Como: `pedido_cliente_permitidos` passa a devolver null (= todos) quando a
--  chamada vem de `pedido_geral_enviar`, que liga a marca `app.pedido_geral`
--  só dentro da transação. O resto da gravação (preço, kg, prazo, número)
--  segue igual. Idempotente. Nada é apagado.
-- ============================================================================

begin;

create or replace function public.pedido_cliente_permitidos(loja uuid)
returns uuid[]
language sql
stable
set search_path = public
as $$
  select case when coalesce(current_setting('app.pedido_geral', true), '') = 'on' then null
              else coalesce(lj.produtos_pedido, r.produtos_pedido) end
    from public.lojas lj
    join public.redes r on r.id = lj.rede_id
   where lj.id = pedido_cliente_permitidos.loja;
$$;

-- Abrir: `produtoIds` = os prioritários da loja; o último pedido vem completo.
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
               'ultimoPedido', public.pedido_cliente_ultimo(lj.id, null)
             ) order by lj.nome), '[]'::jsonb) as lojas
        from public.lojas lj
       where lj.rede_id = r.id and lj.status = 'ativo'
    ) x on true
   where r.status = 'ativo' and jsonb_array_length(x.lojas) > 0;

  return jsonb_build_object('redes', redes, 'produtos', public.pedido_cliente_produtos(null));
end;
$$;

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

  -- Só nesta transação: o link geral pode pedir qualquer produto.
  perform set_config('app.pedido_geral', 'on', true);

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

  perform set_config('app.pedido_geral', 'off', true);
  return feitos;
end;
$$;

commit;

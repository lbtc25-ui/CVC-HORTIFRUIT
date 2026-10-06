-- ============================================================================
--  Junção de clientes duplicados
--
--  O importar-clientes-omie.py criou redes novas para empresas que já
--  existiam no app com outro nome (vindas do seed/histórico de vendas):
--
--    POSTO SERRANO / POSTO SERRANO - INACIO BARBOSA  -> SERRANO / ADELIA FRANCO
--    POSTO SERRANO / POSTO SERRANO - AMERICA         -> SERRANO / AMERICA
--    JARDINS DELICATESSEN LTDA (loja de mesmo nome)  -> SERRANO / SILVIO TEIXEIRA
--    MINIMERCADO PRECOBOM (loja de mesmo nome)       -> SOUZA / MATRIZ
--
--  Para cada par: completa na loja certa o que só a duplicada tinha (nunca
--  sobrescreve), passa vendas e paradas de rota para ela e apaga a
--  duplicada. Se a loja certa ainda não existe (AMERICA), a duplicada só
--  muda de rede e de nome. No fim, a rede duplicada passa o telefone/contato
--  para a certa e sai, se tiver ficado sem loja.
--
--  Idempotente: rodar de novo não faz nada.
-- ============================================================================

begin;

do $$
declare
  par     record;
  v_dup   uuid;
  v_alvo  uuid;
  r_dup   uuid;
  r_alvo  uuid;
begin
  for par in
    select * from (values
      ('POSTO SERRANO',             'POSTO SERRANO - INACIO BARBOSA', 'SERRANO', 'ADELIA FRANCO'),
      ('POSTO SERRANO',             'POSTO SERRANO - AMERICA',        'SERRANO', 'AMERICA'),
      ('JARDINS DELICATESSEN LTDA', 'JARDINS DELICATESSEN LTDA',      'SERRANO', 'SILVIO TEIXEIRA'),
      ('MINIMERCADO PRECOBOM',      'MINIMERCADO PRECOBOM',           'SOUZA',   'MATRIZ')
    ) t (rede_dup, loja_dup, rede_alvo, loja_alvo)
  loop
    select id into r_alvo from public.redes where lower(nome) = lower(par.rede_alvo);
    if r_alvo is null then
      raise exception 'rede % não existe no app', par.rede_alvo;
    end if;

    select id into r_dup from public.redes where lower(nome) = lower(par.rede_dup);
    if r_dup is null then
      continue;  -- já foi juntada
    end if;

    select id into v_dup from public.lojas
      where rede_id = r_dup and lower(nome) = lower(par.loja_dup);

    if v_dup is not null then
      select id into v_alvo from public.lojas
        where rede_id = r_alvo and lower(nome) = lower(par.loja_alvo);

      if v_alvo is null then
        update public.lojas set rede_id = r_alvo, nome = par.loja_alvo, atualizado_em = now()
          where id = v_dup;
      else
        update public.lojas a set
          cidade              = coalesce(a.cidade, d.cidade),
          telefone            = coalesce(a.telefone, d.telefone),
          cnpj_cpf            = coalesce(a.cnpj_cpf, d.cnpj_cpf),
          ie                  = coalesce(a.ie, d.ie),
          razao_social        = coalesce(a.razao_social, d.razao_social),
          contato             = coalesce(a.contato, d.contato),
          email               = coalesce(a.email, d.email),
          cep                 = coalesce(a.cep, d.cep),
          logradouro          = coalesce(a.logradouro, d.logradouro),
          numero              = coalesce(a.numero, d.numero),
          complemento         = coalesce(a.complemento, d.complemento),
          bairro              = coalesce(a.bairro, d.bairro),
          uf                  = coalesce(a.uf, d.uf),
          omie_codigo_cliente = coalesce(a.omie_codigo_cliente, d.omie_codigo_cliente),
          observacoes         = coalesce(a.observacoes, d.observacoes),
          atualizado_em       = now()
        from public.lojas d
        where a.id = v_alvo and d.id = v_dup;

        update public.vendas set loja_id = v_alvo where loja_id = v_dup;
        if to_regclass('public.paradas_rota') is not null then
          execute 'update public.paradas_rota set loja_id = $1 where loja_id = $2'
            using v_alvo, v_dup;
        end if;

        delete from public.lojas where id = v_dup;
      end if;
    end if;

    update public.redes a set
      telefone      = coalesce(a.telefone, d.telefone),
      contato       = coalesce(a.contato, d.contato),
      email         = coalesce(a.email, d.email),
      atualizado_em = now()
    from public.redes d
    where a.id = r_alvo and d.id = r_dup;

    delete from public.redes r
      where r.id = r_dup
        and not exists (select 1 from public.lojas l where l.rede_id = r.id);
  end loop;
end $$;

commit;

-- Confira:  select r.nome, l.nome, l.cnpj_cpf from public.lojas l
--           join public.redes r on r.id = l.rede_id
--           where r.nome in ('SERRANO', 'SOUZA') order by 1, 2;

-- ============================================================================
--  Migração 41 — aviso no celular a cada escaneio do romaneio (ntfy)
--
--  Mesma ideia da migracao-20 (pedido novo), agora para o escaneio do QR da
--  nota em "Minhas Entregas" (migracao-19) e para o botão "Iniciar rota"
--  (migracao-37):
--
--      Saiu para entrega — pedido nº 1234
--      PETROX — BARRA
--      Motorista: Fulano
--
--      Entrega realizada — pedido nº 1234
--      PETROX — BARRA
--      Motorista: Fulano
--
--  Esta função e este gatilho já estavam rodando direto no banco (criados
--  pelo SQL Editor, fora de qualquer migração) — este arquivo só traz o que
--  já existia para dentro do controle de versão, com o mesmo nome, para
--  `create or replace` não mudar nada de quem já rodou.
--
--  Com o fluxo em 4 passos da migracao-37 (pendente → carregando →
--  [Iniciar rota] → em_rota → entregue), esta função continua correta sem
--  precisar mudar nada: ela só olha o VALOR final de status_entrega —
--  "Saiu para entrega" quando vira `em_rota` (agora só pelo botão "Iniciar
--  rota", com a viagem inteira carregada) e "Entrega realizada" quando vira
--  `entregue`. O status intermediário `carregando` não avisa nada, o que
--  está certo: o caminhão ainda está no CD.
--
--  O bug de "entrega realizada" aparecendo ao escanear só o carregamento
--  (antes da migracao-37 existir) não estava aqui: a função sempre rotulou
--  certo, dado que o status mudava um passo de cada vez. O bug real era uma
--  corrida em src/pages/MinhasEntregas.jsx: ao tocar "Confirmar", a câmera
--  destravava e os botões liberavam ANTES da resposta do servidor chegar —
--  se o mesmo QR (ainda no quadro) fosse lido de novo nesse intervalo, o
--  servidor já podia estar num status mais adiantado. Hoje o próprio
--  `registrar_escaneio` (migracao-37) barra a releitura de um pedido já
--  "carregando" com um erro, e esta migração trava também a câmera e os
--  botões até a chamada ao servidor terminar — cinto e suspensório.
--
--  Só avisa o que chega pela API do app (tem JWT), igual à migracao-20: nada
--  do SQL Editor — reimportar planilha ou rodar correção não deve mandar
--  centenas de notificações.
--
--  Precisa da migracao-19-motorista (status_entrega, motorista_id) e da
--  migracao-20 (privado.enviar_ntfy) já aplicadas.
--
--  Idempotente: pode rodar de novo sem quebrar nada, mesmo em quem já tinha
--  a função e o gatilho criados manualmente — só padroniza o nome do gatilho.
-- ============================================================================

begin;

do $$
begin
  if to_regprocedure('privado.enviar_ntfy(text,text,text)') is null then
    raise exception 'Falta rodar supabase/migracao-20-notificacao-pedidos.sql antes desta.';
  end if;
end;
$$;

create or replace function privado.avisar_entrega_motorista()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  quem  text;
  loja  text;
begin
  if coalesce(current_setting('request.jwt.claims', true), '') = '' then
    return new;
  end if;
  if new.status_entrega = old.status_entrega then
    return new;
  end if;
  if new.status_entrega not in ('em_rota', 'entregue') then
    return new;
  end if;

  begin
    select f.nome into quem from public.funcionarios f where f.id = new.motorista_id;
    select r.nome || ' — ' || l.nome
      into loja
      from public.lojas l
      join public.redes r on r.id = l.rede_id
     where l.id = new.loja_id;

    perform privado.enviar_ntfy(
      case when new.status_entrega = 'em_rota' then 'Saiu para entrega' else 'Entrega realizada' end
        || coalesce(' — pedido nº ' || new.numero, ''),
      coalesce(loja, 'Loja não informada')
        || case when quem is not null then E'\nMotorista: ' || quem else '' end
    );
  exception when others then
    raise warning 'aviso de entrega do motorista falhou: %', sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function privado.avisar_entrega_motorista() from public, anon, authenticated;

-- Padroniza o nome do gatilho, qualquer que tenha sido o nome usado quando foi
-- criado à mão (procura pela função, não pelo nome do gatilho).
do $$
declare r record;
begin
  for r in
    select t.tgname
      from pg_trigger t
      join pg_proc p on p.oid = t.tgfoid
     where t.tgrelid = 'public.vendas'::regclass and p.proname = 'avisar_entrega_motorista'
  loop
    execute format('drop trigger %I on public.vendas', r.tgname);
  end loop;
end;
$$;

create trigger vendas_avisar_entrega_motorista
  after update on public.vendas
  for each row execute function privado.avisar_entrega_motorista();

commit;

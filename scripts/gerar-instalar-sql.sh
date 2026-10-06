#!/bin/sh
# Junta schema, auth e migrações num arquivo só, supabase/instalar.sql, na
# ordem de scripts/ordem-instalacao.txt — para montar um banco novo de uma
# vez. Os dados não entram: vêm do resgate dos aparelhos (/resgate) ou das
# importações. Rode de novo sempre que criar ou mexer numa migração.
set -e
cd "$(dirname "$0")/.."
saida=supabase/instalar.sql
{
  echo "-- ============================================================================"
  echo "--  Instalação completa do banco — gerado por scripts/gerar-instalar-sql.sh"
  echo "--  NÃO edite à mão. Cole tudo no SQL Editor do Supabase e rode uma vez."
  echo "-- ============================================================================"
  echo
  echo "-- Trava: este arquivo é para banco NOVO. Rodar de novo num banco já"
  echo "-- instalado reabriria as tabelas para a chave pública no meio do caminho."
  echo "do \$\$"
  echo "begin"
  echo "  if to_regclass('public.perfis') is not null then"
  echo "    raise exception 'Este banco já foi instalado — não rode o instalar.sql de novo. Para uma mudança, rode só a migração dela.';"
  echo "  end if;"
  echo "end;"
  echo "\$\$;"
  while read -r arquivo; do
    [ -z "$arquivo" ] && continue
    echo
    echo "-- >>>>>>>>>>>>>>>>>>>>>>>> $arquivo"
    cat "supabase/$arquivo"
    echo
  done < scripts/ordem-instalacao.txt
} > "$saida"
echo "$saida gerado"

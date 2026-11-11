#!/usr/bin/env bash
# Sobe a versão do Dimy Web em TODOS os lugares de uma vez (uso: ./versao.sh w7).
# Todos os arquivos .js são importados com ?v=<versão>, sempre igual em todos: assim o navegador baixa a versão nova
# de cada tela na hora (sem isso, as telas ficavam até 10 min na versão antiga), e o base.js continua um módulo só.
set -euo pipefail
V="${1:?informe a versão, ex.: w7}"
cd "$(dirname "$0")"
sed -i -E "s/export const VERSAO = '[^']*'/export const VERSAO = '$V'/" js/base.js
printf '{"versao":"%s"}\n' "$V" > versao.json
sed -i -E "s#(css/dimy\.css|js/main\.js)(\?v=[^\"']*)?\"#\1?v=$V\"#g" index.html
for f in js/*.js; do
  sed -i -E "s#(from '\./[a-z]+\.js)(\?v=[^']*)?'#\1?v=$V'#g; s#(import\('\./[a-z]+\.js)(\?v=[^']*)?'#\1?v=$V'#g" "$f"
done
echo "Dimy Web na versão $V"
grep -ho "\./[a-z]*\.js?v=[^'\"]*" js/*.js index.html | sort | uniq -c | sort -rn | head -20

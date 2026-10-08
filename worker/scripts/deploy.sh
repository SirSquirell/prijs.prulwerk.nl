#!/usr/bin/env bash
# Eén commando voor de hele uitrol. Veilig om vaker te draaien.
# Nodig: CLOUDFLARE_API_TOKEN in de omgeving (zie docs/mathijs-todo.md), of eerst `npx wrangler login`.
set -euo pipefail
cd "$(dirname "$0")/.."

DB=prijswacht

if grep -q 'VUL_IN_BIJ_EERSTE_DEPLOY' wrangler.toml; then
  id=$(npx wrangler d1 list --json | node -e 'const l=JSON.parse(require("fs").readFileSync(0,"utf8"));const d=l.find(x=>x.name===process.argv[1]);if(d)console.log(d.uuid)' "$DB")
  if [ -z "$id" ]; then
    npx wrangler d1 create "$DB" --location weur >/dev/null
    id=$(npx wrangler d1 list --json | node -e 'const l=JSON.parse(require("fs").readFileSync(0,"utf8"));console.log(l.find(x=>x.name===process.argv[1]).uuid)' "$DB")
  fi
  sed -i "s/VUL_IN_BIJ_EERSTE_DEPLOY/$id/" wrangler.toml
  echo "database_id gezet: $id (commit wrangler.toml)"
fi

npx wrangler d1 migrations apply "$DB" --remote

count=$(npx wrangler d1 execute "$DB" --remote --json --command "SELECT count(*) AS n FROM products" | node -e 'console.log(JSON.parse(require("fs").readFileSync(0,"utf8"))[0].results[0].n)')
if [ "$count" = "0" ]; then
  npx wrangler d1 execute "$DB" --remote --file seed/fase1.sql
fi

npx wrangler deploy

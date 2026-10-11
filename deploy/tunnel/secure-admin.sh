#!/usr/bin/env bash
# Replaces the seeded admin password (admin123) with a random one, then builds the
# search index. Run after loading data, before sharing the tunnel URL.
set -euo pipefail
cd "$(dirname "$0")"

PW=$(openssl rand -base64 18 | tr -d '/+=')
HASH=$(docker compose exec -T -e PW="$PW" api node -e "const b=(()=>{try{return require('bcrypt')}catch{return require('bcryptjs')}})();b.hash(process.env.PW,12).then(h=>console.log(h))")
docker compose exec -T postgres psql -q -U postgres irs_az -c "update \"User\" set \"passwordHash\"='$HASH' where email='admin@irs.az'"

U=http://localhost:8787/api
TOK=$(curl -s -X POST $U/auth/login -H 'content-type: application/json' \
  -d "{\"email\":\"admin@irs.az\",\"password\":\"$PW\"}" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("accessToken") or d.get("access_token"))')
curl -s -X POST $U/search/reindex -H "authorization: Bearer $TOK"; echo
curl -s -o /dev/null -w "old password now returns: %{http_code}\n" -X POST $U/auth/login \
  -H 'content-type: application/json' -d '{"email":"admin@irs.az","password":"admin123"}'

echo "New admin password (admin@irs.az): $PW"

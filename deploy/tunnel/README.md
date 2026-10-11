# Temporary Preview (Cloudflare Quick Tunnel)

Shares the production stack from a laptop at a random `*.trycloudflare.com` URL — no server, no Cloudflare account. For showing the site before the [VPS](../README.md) exists.

```
trycloudflare.com → cloudflared → Caddy 127.0.0.1:8787 ─┬─ /api/* → api:4000
                                                        └─ /*     → web:3000
                                  postgres, meilisearch (internal only)
```

Limits:
- Up only while the laptop is awake and `cloudflared` is running. No uptime guarantee.
- A new URL on every `cloudflared` start; `DOMAIN` in `.env` must follow it.
- No uploads (R2 isn't configured).
- Separate Compose project (`irs-az-tunnel`) — doesn't touch the dev services on `:5433` / `:7700`.

## Start

All commands run from `deploy/tunnel/`.

```bash
# 1. Tunnel — note the printed URL. Run it in its own terminal tab and keep it open:
#    not via Claude Code's `!`, which kills it when the command times out.
brew install cloudflared
cloudflared tunnel --no-autoupdate --url http://localhost:8787

# 2. Environment (DOMAIN = tunnel hostname, without https://)
cat > .env <<EOF
DOMAIN=<name>.trycloudflare.com
POSTGRES_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
MEILISEARCH_KEY=$(openssl rand -hex 16)
EOF

# 3. Build images (native arch — the GHCR images are amd64-only) and start the databases
docker compose build
docker compose up -d --wait postgres meilisearch

# 4. Copy the local database in (the real data lives in native Postgres on :5432)
pg_dump --no-owner --no-acl irs_az | docker compose exec -T postgres psql -q -U postgres -d irs_az

# 5. Start the rest; migrations run on API start
docker compose up -d --wait

# 6. Replace admin123 and build the search index — before sharing the URL
./secure-admin.sh
```

## New Tunnel URL

```bash
# update DOMAIN in .env, then
docker compose up -d web api
```

## Stop

Ctrl-C `cloudflared`, then:

```bash
docker compose down        # keep data
docker compose down -v     # drop data too
```

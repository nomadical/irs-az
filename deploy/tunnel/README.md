# Laptop Hosting (Cloudflare Tunnel)

Serves the production stack from a laptop at **kitabxana.az** through a named Cloudflare tunnel, until a [VPS](../README.md) exists. A quick tunnel (random `*.trycloudflare.com` URL, no account) still works for throwaway previews; see the end.

```
kitabxana.az → cloudflared → Caddy 127.0.0.1:8787 ─┬─ /api/* → api:4000
                                                        └─ /*     → web:3000
                                  postgres, meilisearch (internal only)
```

Limits:
- Up only while the laptop is awake and `cloudflared` is running. No uptime guarantee.
- `www.kitabxana.az` is 308-redirected to the bare domain by Caddy.
- No uploads (R2 isn't configured).
- Separate Compose project (`irs-az-tunnel`) — doesn't touch the dev services on `:5433` / `:7700`.

## Named Tunnel (kitabxana.az)

The zone is on Cloudflare (nameservers set at online.az, which is reachable only from Azerbaijan). One-time setup, already done on this laptop:

```bash
cloudflared tunnel login                          # pick kitabxana.az; writes ~/.cloudflared/cert.pem
cloudflared tunnel create kitabxana               # writes ~/.cloudflared/<id>.json
cloudflared tunnel route dns kitabxana kitabxana.az
cloudflared tunnel route dns kitabxana www.kitabxana.az
```

`~/.cloudflared/config.yml` maps both hostnames to `http://localhost:8787` (tunnel id + credentials file, ingress rules, then `http_status:404`). `cloudflared service install` runs it as a launch agent, so it restarts after sleep and reboot. `.env` has `DOMAIN=kitabxana.az`.

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

## New Tunnel URL (Quick Tunnel Only)

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

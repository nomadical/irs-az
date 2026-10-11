# Deployment

Single VPS running Docker Compose behind Cloudflare. CI builds images to GHCR; pushes to `main` deploy automatically once the server is configured.

```
Cloudflare (DNS, proxy, R2) → Caddy :443 ─┬─ /api/* → api:4000 (NestJS)
                                          └─ /*     → web:3000 (Next.js)
                              postgres, meilisearch (internal only)
```

No server yet? [tunnel/README.md](tunnel/README.md) shares the stack from a laptop via a temporary Cloudflare URL.

## One-time setup

### 1. Server

Hetzner CPX21 (Ubuntu 24.04), with your SSH key added at creation.

```bash
# as root
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
mkdir -p /opt/irs-az/certs && chown -R deploy:deploy /opt/irs-az
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
```

### 2. Deploy key

```bash
ssh-keygen -t ed25519 -f irs-az-deploy -N ""      # locally
# append irs-az-deploy.pub to /home/deploy/.ssh/authorized_keys on the server
```

In GitHub → repo settings:
- **Variables** → `DEPLOY_HOST` = server IP
- **Secrets** → `DEPLOY_SSH_KEY` = contents of `irs-az-deploy`

### 3. Registry access

Images are private. On the server, as `deploy`, log in with a classic PAT that has only `read:packages`:

```bash
echo <PAT> | docker login ghcr.io -u nomadical --password-stdin
```

### 4. Cloudflare

1. Add the domain and point the nameservers at Cloudflare.
2. `A` record `@` → server IP, proxied.
3. SSL/TLS → **Full (strict)**.
4. SSL/TLS → Origin Server → create certificate. Save it on the server as `/opt/irs-az/certs/origin.pem` and `origin-key.pem`.
5. R2 → create buckets `irs-az` (uploads) and `irs-az-backups`, plus an API token with read/write on both.

### 5. Environment

Copy [.env.example](.env.example) to `/opt/irs-az/.env` and fill it in (`openssl rand -hex 32` for secrets).

### 6. First deploy

Run the **CI / Deploy** workflow from the Actions tab, or push to `main`. It copies the stack files, pulls images and starts everything; migrations run on API start.

Then load data and build the search index:

```bash
# locally: copy the database to the server
pg_dump --no-owner --no-acl irs_az | gzip | ssh deploy@<host> \
  'gunzip | docker compose -f /opt/irs-az/docker-compose.yml exec -T postgres psql -q -U postgres -d irs_az'
```

Then call `POST /api/search/reindex` as a SUPERADMIN.

### 7. Backups

```bash
crontab -e   # as deploy
15 3 * * * /opt/irs-az/backup.sh >> /opt/irs-az/backups/backup.log 2>&1
```

## Operations

```bash
cd /opt/irs-az
docker compose ps                     # status
docker compose logs -f api            # logs
docker compose exec postgres psql -U postgres irs_az

# Roll back: set IMAGE_TAG in .env to an earlier commit SHA, then
docker compose up -d

# Restore a backup
gunzip -c backups/<file>.sql.gz | docker compose exec -T postgres psql -U postgres -d irs_az
```

## Local test of the production stack

```bash
docker build -f apps/api/Dockerfile -t ghcr.io/nomadical/irs-az-api:local .
docker build -f apps/web/Dockerfile -t ghcr.io/nomadical/irs-az-web:local .
cd deploy
# .env with DOMAIN=localhost, TLS=internal, IMAGE_TAG=local and the secrets
docker compose -p irs-az-prodtest up -d --wait   # → https://localhost
```

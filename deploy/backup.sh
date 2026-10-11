#!/bin/sh
# Nightly Postgres dump to Cloudflare R2, keeping 30 days. Run from cron:
#   15 3 * * * /opt/irs-az/backup.sh >> /opt/irs-az/backups/backup.log 2>&1
set -eu
cd "$(dirname "$0")"
set -a; . ./.env; set +a

mkdir -p backups
file="backups/irs_az-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
docker compose exec -T postgres pg_dump -U postgres --clean --if-exists irs_az | gzip > "$file"

rclone() {
  docker run --rm -v "$PWD/backups:/backups" \
    -e RCLONE_CONFIG_R2_TYPE=s3 -e RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
    -e RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
    -e RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
    -e RCLONE_CONFIG_R2_ENDPOINT="https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com" \
    rclone/rclone:1.71 "$@"
}
rclone copy /backups "r2:$BACKUP_BUCKET" --include '*.sql.gz'
rclone delete "r2:$BACKUP_BUCKET" --min-age 30d

# Keep a week locally for quick restores
find backups -name '*.sql.gz' -mtime +7 -delete
echo "$(date -u) backed up $file"

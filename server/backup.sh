#!/bin/bash
# Резервна копія бази: /srv/sk/backups/sk-YYYY-MM-DD_HHMM.sql.gz, зберігаємо 14 днів.
# Відновлення: gunzip -c файл.sql.gz | docker compose -p sk -f /srv/sk/repo/server/docker-compose.yml exec -T db psql -U sk -d sk
set -euo pipefail
OUT=/srv/sk/backups/sk-$(date +%F_%H%M).sql.gz
docker compose -p sk -f /srv/sk/repo/server/docker-compose.yml exec -T db pg_dump -U sk -d sk --clean --if-exists | gzip > "$OUT"
chmod 600 "$OUT"
find /srv/sk/backups -name 'sk-*.sql.gz' -mtime +14 -delete
echo "$(date -Is) $OUT $(du -h "$OUT" | cut -f1)"

#!/bin/bash
# Оновлення сайту на VM з GitHub: код → nginx → Docker (API + PostgreSQL).
#   sudo /srv/sk/repo/server/deploy.sh [гілка]      (за замовчуванням main)
# Перший запуск сам створює /srv/sk, пароль бази (/srv/sk/.env) і щоденну
# резервну копію бази (cron). Секрети в репозиторій не потрапляють:
#   /srv/sk/.env             — пароль PostgreSQL, токен воркера образів (AVATAR_WORKER_TOKEN)
#   /srv/sk/data/hash-config.json — параметри паролів Firebase (для старих акаунтів)
set -euo pipefail

BRANCH="${1:-${SK_BRANCH:-main}}"
REPO_URL="https://github.com/natalikazichuk/schoolkingdoms.git"
SK=/srv/sk

install -d -m 755 "$SK" "$SK/backups"
install -d -m 700 "$SK/data" "$SK/migration"
# у контейнері API працює користувач node (uid 1000) — він має читати дані
chown 1000:1000 "$SK/data" "$SK/migration"
# образи Героїв: пише API (uid 1000), читає nginx
install -d -m 755 -o 1000 -g 1000 "$SK/avatars"

if [ ! -d "$SK/repo/.git" ]; then
  git clone -q "$REPO_URL" "$SK/repo"
fi
git -C "$SK/repo" fetch -q origin "$BRANCH"
git -C "$SK/repo" checkout -q -B "$BRANCH" "origin/$BRANCH"
git -C "$SK/repo" reset -q --hard "origin/$BRANCH"
VERSION="$BRANCH@$(git -C "$SK/repo" rev-parse --short HEAD)"

if [ ! -f "$SK/.env" ]; then
  echo "DB_PASSWORD=$(openssl rand -hex 24)" > "$SK/.env"
  chmod 600 "$SK/.env"
fi
grep -q '^AVATAR_WORKER_TOKEN=' "$SK/.env" || echo "AVATAR_WORKER_TOKEN=$(openssl rand -hex 32)" >> "$SK/.env"
grep -q '^APP_VERSION=' "$SK/.env" && sed -i "s|^APP_VERSION=.*|APP_VERSION=$VERSION|" "$SK/.env" \
  || echo "APP_VERSION=$VERSION" >> "$SK/.env"

# nginx
install -m 644 "$SK/repo/server/nginx/site.conf" /etc/nginx/sites-available/default
nginx -t -q
systemctl reload nginx

# API + база
docker compose -p sk -f "$SK/repo/server/docker-compose.yml" --env-file "$SK/.env" up -d --build --remove-orphans

# щоденна резервна копія бази о 03:17
cat > /etc/cron.d/sk-backup <<EOF
17 3 * * * root $SK/repo/server/backup.sh >> /var/log/sk-backup.log 2>&1
EOF

# автооновлення з GitHub — лише коли сайт працює з main
if [ "$BRANCH" = "main" ]; then
  echo "*/2 * * * * root $SK/repo/server/autodeploy.sh main >> /var/log/sk-deploy.log 2>&1" > /etc/cron.d/sk-autodeploy
else
  rm -f /etc/cron.d/sk-autodeploy
fi

for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "OK: $VERSION"; curl -s http://127.0.0.1:3000/api/health; echo
    exit 0
  fi
  sleep 2
done
echo "API не відповідає" >&2
docker compose -p sk -f "$SK/repo/server/docker-compose.yml" logs --tail 50 app >&2
exit 1

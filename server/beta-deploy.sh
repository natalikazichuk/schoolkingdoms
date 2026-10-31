#!/bin/bash
# Бета-версія сайту: гілка beta → /srv/sk/beta → https://beta.school-king.pp.ua
#
#   перший запуск (скрипт лежить лише в гілці beta):
#     sudo git clone -q -b beta https://github.com/natalikazichuk/schoolkingdoms.git /srv/sk/beta
#     sudo /srv/sk/beta/server/beta-deploy.sh
#   оновити зараз:  sudo /srv/sk/beta/server/beta-deploy.sh
#   sudo /srv/sk/beta/server/beta-deploy.sh --off      # вимкнути бету (файли лишаються)
#   (cron сам викликає --auto кожні 2 хв: оновлює, лише якщо в гілці новий коміт)
#
# Що робить:
#   • тримає окрему копію репозиторію на гілці beta у /srv/sk/beta;
#   • додає в nginx окремий server{} для beta.school-king.pp.ua — це копія
#     server/nginx/site.conf, у якій змінено лише server_name і root;
#   • /api/ бета віддає ТОЙ САМИЙ API й ту саму базу, що й основний сайт
#     (акаунти й прогрес спільні). Зміни в server/app з гілки beta НЕ
#     застосовуються — API оновлюється тільки з main (deploy.sh).
# Основний сайт (/srv/sk/repo, default-сайт nginx, cron sk-autodeploy) не чіпає.
set -euo pipefail

BRANCH="${SK_BETA_BRANCH:-beta}"
HOST="${SK_BETA_HOST:-beta.school-king.pp.ua}"
REPO_URL="https://github.com/natalikazichuk/schoolkingdoms.git"
DIR=/srv/sk/beta
SITE=/etc/nginx/sites-available/sk-beta
LINK=/etc/nginx/sites-enabled/sk-beta
CRON=/etc/cron.d/sk-beta-autodeploy

if [ "${1:-}" = "--off" ]; then
  rm -f "$LINK" "$CRON"
  nginx -t -q && systemctl reload nginx
  echo "Бету вимкнено ($HOST). Копія лишилась у $DIR."
  exit 0
fi

exec 9>/run/sk-beta-deploy.lock
flock -n 9 || exit 0

if [ "${1:-}" = "--auto" ]; then
  REMOTE="$(git ls-remote "$REPO_URL" "refs/heads/$BRANCH" | cut -f1)"
  LOCAL="$(git -C "$DIR" rev-parse HEAD 2>/dev/null || true)"
  [ -n "$REMOTE" ] && [ "$REMOTE" != "$LOCAL" ] || exit 0
  echo "$(date -Is) $LOCAL → $REMOTE"
fi

[ -d "$DIR/.git" ] || git clone -q "$REPO_URL" "$DIR"
git -C "$DIR" fetch -q origin "$BRANCH"
git -C "$DIR" checkout -q -B "$BRANCH" "origin/$BRANCH"
git -C "$DIR" reset -q --hard "origin/$BRANCH"

# nginx: той самий конфіг, що й основний сайт, але свій домен і своя папка
sed -e 's/listen 80 default_server;/listen 80;/' \
    -e "s/server_name _;/server_name $HOST;/" \
    -e "s#root /srv/sk/repo;#root $DIR;#" \
    "$DIR/server/nginx/site.conf" > "$SITE.new"
grep -q "server_name $HOST;" "$SITE.new" && grep -q "root $DIR;" "$SITE.new" \
  || { echo "site.conf змінився — не вдалося підставити домен/папку" >&2; rm -f "$SITE.new"; exit 1; }
mv "$SITE.new" "$SITE"
ln -sf "$SITE" "$LINK"
nginx -t -q
systemctl reload nginx

echo "*/2 * * * * root $DIR/server/beta-deploy.sh --auto >> /var/log/sk-beta-deploy.log 2>&1" > "$CRON"

echo "OK: $HOST ← $BRANCH@$(git -C "$DIR" rev-parse --short HEAD)"

#!/bin/bash
# Автооновлення: якщо в гілці на GitHub з'явився новий коміт — deploy.sh.
# Ставиться в cron (/etc/cron.d/sk-autodeploy) самим deploy.sh, лише для main.
set -euo pipefail
BRANCH="${1:-main}"
exec 9>/run/sk-autodeploy.lock
flock -n 9 || exit 0
source "$(dirname "$(readlink -f "$0")")/git-access.sh"
REMOTE="$(git ls-remote "$REPO_URL" "refs/heads/$BRANCH" | cut -f1)"
LOCAL="$(git -C /srv/sk/repo rev-parse HEAD)"
[ -n "$REMOTE" ] && [ "$REMOTE" != "$LOCAL" ] || exit 0
echo "$(date -Is) $LOCAL → $REMOTE"
/srv/sk/repo/server/deploy.sh "$BRANCH"

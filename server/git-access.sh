# Звідки сервер бере код з GitHub. Підключається (source) з deploy.sh і autodeploy.sh.
# Є deploy key /srv/sk/deploy_key — ходимо по SSH (потрібно для приватного репо),
# немає — анонімно по HTTPS (працює, лише поки репо публічне).
# Як створити ключ — server/README.md, «Доступ до приватного репозиторію».
SK_DEPLOY_KEY=/srv/sk/deploy_key
if [ -f "$SK_DEPLOY_KEY" ]; then
  REPO_URL="git@github.com:natalikazichuk/schoolkingdoms.git"
  export GIT_SSH_COMMAND="ssh -i $SK_DEPLOY_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/srv/sk/known_hosts"
else
  REPO_URL="https://github.com/natalikazichuk/schoolkingdoms.git"
fi

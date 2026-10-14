# Сервер school-king.pp.ua

Сайт працює на власній VM замість GitHub Pages + Firebase. GitHub лишається
архівом коду; сервер оновлюється з гілки `main`.

## Як це влаштовано

```
браузер ──HTTPS──▶ домашній проксі (сертифікат) ──HTTP──▶ VM :80 nginx
                                                          ├─ статика: /srv/sk/repo (git checkout)
                                                          ├─ /api/   → Docker: app (Node.js) → db (PostgreSQL)
                                                          └─ /<секрет> → websockify → SSH (доступ Claude)
```

- `server/app` — API замість Firestore й Firebase Auth. Документи лежать у
  PostgreSQL (`docs`, jsonb) з тими самими шляхами, що були у Firestore.
  Правила доступу — `src/rules.js`, перенесені з `firestore.rules`
  (обидва файли треба міняти разом, поки `firestore.rules` лишається в репо).
- `sk-fb.js` (у корені сайту) — повторює функції Firebase SDK, які
  використовує `firebase-config.js`. Тому сторінки не змінювались.
- Вхід: email + пароль, сесія — HttpOnly cookie на рік. Старі паролі
  Firebase приймаються (модифікований scrypt) і після першого входу
  перешифровуються у свій формат.

## Файли на VM (не в репозиторії)

| Шлях | Що це |
|---|---|
| `/srv/sk/repo` | копія репозиторію, з неї nginx віддає сайт |
| `/srv/sk/.env` | пароль PostgreSQL, версія |
| `/srv/sk/pgdata` | дані PostgreSQL |
| `/srv/sk/backups` | щоденні копії бази (03:17, зберігаються 14 днів) |
| `/srv/sk/tunnel_path` | секретна адреса SSH-тунелю |
| `/srv/sk/data/hash-config.json` | параметри паролів Firebase |
| `/srv/sk/migration` | вивантаження з Firebase (`firestore.json`, `users.json`) |
| `/srv/sk/deploy_key` | deploy key для читання приватного репозиторію з GitHub |
| `/srv/sk/known_hosts` | відбиток github.com для SSH |

## Команди

```sh
sudo /srv/sk/repo/server/deploy.sh main        # оновити сайт з GitHub
sudo /srv/sk/repo/server/backup.sh             # копія бази зараз
cd /srv/sk/repo/server
sudo docker compose -p sk --env-file /srv/sk/.env logs -f app          # логи API
sudo docker compose -p sk --env-file /srv/sk/.env exec db psql -U sk sk # консоль бази
```

Коли сайт працює з `main`, cron кожні 2 хвилини перевіряє GitHub і сам
запускає `deploy.sh`, якщо з'явився новий коміт (`/var/log/sk-deploy.log`).

## Доступ до приватного репозиторію

Репозиторій приватний, тому сервер читає його по SSH через deploy key
(лише читання, лише цей репо). `git-access.sh` сам вибирає спосіб: є
`/srv/sk/deploy_key` — SSH, немає — анонімний HTTPS (працює тільки для
публічного репо). Без ключа автооновлення мовчки зупиняється, а в
`/var/log/sk-deploy.log` з'являються помилки доступу.

Налаштування (раз на VM):

```sh
sudo ssh-keygen -t ed25519 -N "" -C "sk-vm-deploy" -f /srv/sk/deploy_key
sudo chmod 600 /srv/sk/deploy_key
sudo cat /srv/sk/deploy_key.pub
```

1. GitHub → репозиторій → **Settings → Deploy keys → Add deploy key**:
   вставити `deploy_key.pub`, галочку «Allow write access» **не** ставити.
2. Перевірити: `sudo /srv/sk/repo/server/deploy.sh main` → `OK: main@…`.
   Скрипт сам перемкне `origin` у `/srv/sk/repo` на SSH-адресу.

Нова VM: спершу створити ключ і додати його на GitHub, потім склонувати
репо тим самим ключем і запустити деплой:

```sh
sudo GIT_SSH_COMMAND="ssh -i /srv/sk/deploy_key -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/srv/sk/known_hosts" \
  git clone git@github.com:natalikazichuk/schoolkingdoms.git /srv/sk/repo
sudo /srv/sk/repo/server/deploy.sh main
```

## Перенос з Firebase

1. На VM: `firebase login --no-localhost` (раз), потім у `~/migration`:
   `node /srv/sk/repo/server/tools/export-firestore.js` і
   `firebase auth:export users.json --format=json --project schoolkingdom-d46bc`.
2. Скопіювати `firestore.json`, `users.json` у `/srv/sk/migration`,
   `hash-config.json` — у `/srv/sk/data` (власник 1000:1000, права 600).
3. `docker compose … exec app node src/import.js --fresh` — стирає документи
   й завантажує заново. Акаунти оновлюються; паролі, вже перешифровані на
   новому сервері, лишаються.

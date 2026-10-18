# Сервер school-king.pp.ua

Сайт працює на власній VM замість GitHub Pages + Firebase. GitHub лишається
архівом коду; сервер оновлюється з гілки `main`.

## Як це влаштовано

```
браузер ──HTTPS──▶ домашній проксі (сертифікат) ──HTTP──▶ VM :80 nginx
                                                          ├─ статика: /srv/sk/repo (git checkout)
                                                          └─ /api/   → Docker: app (Node.js) → db (PostgreSQL)
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
| `/srv/sk/.env` | пароль PostgreSQL, токен воркера образів, версія |
| `/srv/sk/pgdata` | дані PostgreSQL |
| `/srv/sk/backups` | щоденні копії бази (03:17, зберігаються 14 днів) |
| `/srv/sk/avatars` | згенеровані образи Героїв (`/img/ava/gen/`); у копії бази не входять — за потреби перемальовуються |
| `/srv/sk/data/hash-config.json` | параметри паролів Firebase |
| `/srv/sk/migration` | вивантаження з Firebase (`firestore.json`, `users.json`) |

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

## Образ Героя (кнопка «Одягти»)

Кнопка в Інвентарі арени ставить у чергу набір «базовий аватар + вдягнені речі»
(`app/src/avatar.js`, таблиця `avatar_jobs`). Малює окремий воркер із ComfyUI на
домашньому комп'ютері: він сам забирає завдання через API й повертає картинку. Протокол
описаний в [`AVATAR-WORKER.md`](AVATAR-WORKER.md), токен воркера лежить в `/srv/sk/.env`.

## Аватар з фото (кнопка «📸 Аватар з фото»)

Герой вибирає фото в Інвентарі арени, і сервер малює схожого героя через OpenAI Images API
(`app/src/openai-image.js`). Шаблоном (поза, кадр, стиль) служить Юний джура (`linen-boy`).
Герой малюється у двох позах: прямо (hero.html, мініатюри) і в бойовій (арена) — це два
малюнки OpenAI на одного героя; бойова малюється з уже готового прямого, щоб були схожі.
Готовий герой стає аватаром і потрапляє в «Мої колекції». Він сам собі базове зображення
в обох позах, тож речі на нього вдягає та сама кнопка «Одягти» (теж у двох позах).
Фото на сервері не зберігається.

Щоб увімкнути, найпростіше — **адмінка** (`admin.html`, головна → «🔑 Ключ OpenAI»):
встав ключ і натисни «Зберегти». Сервер перевірить його в OpenAI й збереже в таблиці
`settings`; назад показує лише останні 4 символи. Ключ з адмінки має перевагу над `.env`.

Або додай у `/srv/sk/.env` ключ API зі свого акаунта OpenAI
(platform.openai.com → API keys; підписка ChatGPT для цього не підходить, потрібен
баланс API) і перезапусти `deploy.sh`:

```sh
echo 'OPENAI_API_KEY=sk-...' | sudo tee -a /srv/sk/.env
sudo /srv/sk/repo/server/deploy.sh main
```

Необов'язкові налаштування там само: `OPENAI_IMAGE_MODEL` (типово `gpt-image-1`),
`OPENAI_IMAGE_QUALITY` (`low`/`medium`/`high`, типово `medium`), `AVATAR_PHOTO_PER_DAY`
(героїв з фото на одного Героя за добу, типово 3), `AVATAR_PHOTO_DAY_TOTAL` (на весь сайт
за добу, типово 30; кожен малюнок оплачується з рахунку OpenAI). Без ключа кнопка
відповідає «Генерація з фото ще не налаштована». Помилки OpenAI видно в логах API (`[avatar/photo]`).

## Перенос з Firebase

1. На VM: `firebase login --no-localhost` (раз), потім у `~/migration`:
   `node /srv/sk/repo/server/tools/export-firestore.js` і
   `firebase auth:export users.json --format=json --project schoolkingdom-d46bc`.
2. Скопіювати `firestore.json`, `users.json` у `/srv/sk/migration`,
   `hash-config.json` — у `/srv/sk/data` (власник 1000:1000, права 600).
3. `docker compose … exec app node src/import.js --fresh` — стирає документи
   й завантажує заново. Акаунти оновлюються; паролі, вже перешифровані на
   новому сервері, лишаються.

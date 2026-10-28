# Воркер образів Героя

Інструкція для скрипта на машині з ComfyUI: він забирає з сайту завдання «намалюй
Героя у вдягнених речах» і повертає готову картинку. Серверна частина —
`server/app/src/avatar.js`, кнопка «🪄 Одягти» — у вікні Інвентарю на арені.

## Як це працює

```
Герой тисне «Одягти»
  → POST /api/avatar/render: сервер збирає набір (база + речі у слотах) і ставить у чергу
воркер (цикл раз на кілька секунд)
  → POST /api/avatar/worker/claim      ← завдання: картинки, підписи, промпт
  → малює в ComfyUI (127.0.0.1:8188)
  → POST /api/avatar/worker/heartbeat  (раз на хвилину, поки малює)
  → POST /api/avatar/worker/result     → картинка (base64)
сервер робить з неї файли образу, і він одразу стає аватаром Героя
```

Сервер стоїть в ізольованій мережі й **сам до ComfyUI не ходить**. Тому воркер
звертається до сайту `https://school-king.pp.ua` (звичайний вихідний HTTPS), а не навпаки.
Відкривати порти не треба. Якщо воркер вимкнений, завдання просто чекають у черзі.

Однаковий набір (та сама база й ті самі речі у видимих слотах) має однаковий `key`.
Готовий образ береться з кешу без нової генерації, хоч би який Герой його вдягнув. Тому
воркер отримує лише нові набори.

## Доступ

Усі запити воркера — `POST`, `Content-Type: application/json` і заголовок

```
Authorization: Bearer <AVATAR_WORKER_TOKEN>
```

Токен лежить на сервері у `/srv/sk/.env`: `sudo grep AVATAR_WORKER_TOKEN /srv/sk/.env`.
Його створює `deploy.sh` при першому деплої. Щоб змінити токен, відредагуй рядок у `.env`
і запусти `sudo /srv/sk/repo/server/deploy.sh main`. Зберігай токен як пароль: з ним можна
підставити будь-яку картинку замість образу.

Помилки мають формат `{"error": {"code": "...", "message": "..."}}`:

| HTTP | code | що робити |
|---|---|---|
| 401 | `unauthenticated` | неправильний токен |
| 503 | `unavailable` | на сервері не задано `AVATAR_WORKER_TOKEN` |
| 404 | `not-found` | немає такого завдання |
| 409 | `aborted` | завдання вже не твоє (оренда скінчилась, його перевидали) — кинь його |
| 400 | `invalid-argument` | картинка не PNG/WebP/JPEG або завелика |

## 1. Взяти завдання — `POST /api/avatar/worker/claim`

Тіло: `{"worker": "comfy-pc"}` (довільне ім'я, видно в адмінці).

Відповідь: `{"job": null}`, якщо черга порожня (почекай 3–5 с і спитай знову), або:

```json
{
  "job": {
    "id": 1,
    "key": "6cf1c3f1d0a54e5b9c3e2a10",
    "attempt": 1,
    "leaseUntil": "2026-10-17T18:40:00.000Z",
    "leaseSeconds": 600,
    "spec": {
      "version": 1,
      "key": "6cf1c3f1d0a54e5b9c3e2a10",
      "base": "linen-boy-fight",
      "baseImage": "https://school-king.pp.ua/img/ava/%D1%87%D0%B5%D1%80%D0%BD%D0%B5%D1%82%D0%BA%D0%B8-%D0%B0%D0%B2%D0%B0%D1%82%D0%B0%D1%80%D0%B0/linen-boy-base.webp",
      "fightImage": "https://school-king.pp.ua/img/ava/%D1%87%D0%B5%D1%80%D0%BD%D0%B5%D1%82%D0%BA%D0%B8-%D0%B0%D0%B2%D0%B0%D1%82%D0%B0%D1%80%D0%B0/linen-boy-fight-base.webp",
      "total": 10,
      "filled": 3,
      "slots": [
        { "slot": "helmet", "label": "головний убір", "en": "headwear",
          "item": { "id": "IT-001", "name": "шляпа", "category": "Шоломи", "weaponType": null,
                    "image": "https://school-king.pp.ua/img/items/IT-001.webp" } },
        { "slot": "amulet", "label": "амулет на шиї", "en": "amulet worn on the neck", "item": null },
        { "slot": "armor", "label": "обладунок", "en": "body armor / outer garment",
          "item": { "id": "IT-025", "name": "Шкіряна куртка", "category": "Обладунки", "weaponType": null,
                    "image": "https://school-king.pp.ua/img/items/IT-025.webp" } },
        "… усього 10 слотів, порожні — з item: null …",
        { "slot": "weaponR", "label": "зброя в правій руці", "en": "weapon held in the right hand",
          "item": { "id": "IT-093", "name": "Меч новачка", "category": "Зброя", "weaponType": "Меч",
                    "image": "https://school-king.pp.ua/img/items/IT-093.webp" } },
        { "slot": "weaponL", "label": "ліва рука", "en": "left hand", "item": null }
      ],
      "prompt": "Image 1 is the base character. Image 2 is a reference sheet …"
    }
  }
}
```

Поля `spec`:

| Поле | Що це |
|---|---|
| `baseImage` | базовий аватар **без верхнього одягу** у **прямій позі** (прозорий фон, WebP). Поки що є лише Юний джура (`linen-boy`) і герої з фото (`gen/<файл>`) |
| `fightImage` | та сама база в **бойовій позі** або `null`. Набір малюється двічі: з `baseImage` (пряма поза, hero.html і мініатюри) і з `fightImage` (бойова, арена) |
| `total` | скільки слотів малюється (зараз 10) |
| `filled` | скільки з них зайнято речами (≥ 1: порожній набір сервер не ставить у чергу) |
| `slots[]` | **усі** 10 слотів по порядку, зверху вниз: `helmet, amulet, armor, bracers, gloves, belt, pants, boots, weaponR, weaponL` |
| `slots[].label` / `.en` | підпис слота українською / англійською. Для лівої руки підпис залежить від речі: «щит у лівій руці» або «зброя в лівій руці» |
| `slots[].item` | річ у слоті або `null`. `name` — назва з гри (українською), `category` — категорія каталогу, `weaponType` — вид зброї (Меч, Посох, Лук…), `look` — короткий опис вигляду англійською або `null` |
| `slots[].item.image` | картинка речі (512×512, прозорий фон) або `null`, якщо картинки ще немає. Тоді спирайся лише на назву |
| `prompt` | готовий англійський промпт для image-edit моделі: картинка 1 — база, картинка 2 — аркуш речей. Можна брати як є або скласти свій зі `slots` |

Кільця не входять у набір: на повний зріст їх не видно.

Оренда — 10 хвилин (`leaseSeconds`). Якщо за цей час не надіслати ні `result`, ні
`heartbeat`, завдання повертається в чергу. Після 3 спроб воно стає помилкою.
Увесь образ (черга + усі спроби) — не довше 2 годин від натискання «Одягти»: далі завдання
стає помилкою, і `heartbeat` відповідає `409 aborted`.

## 2. Поки малюєш — `POST /api/avatar/worker/heartbeat`

Тіло: `{"id": 1}` → `{"ok": true, "leaseUntil": "…"}`. Надсилай раз на 1–2 хвилини, якщо
генерація довга. Відповідь `409 aborted` означає, що завдання вже перевидали: зупинись.

## 3. Віддати результат — `POST /api/avatar/worker/result`

```json
{ "id": 1, "image": "<base64: пряма поза>", "fight": "<base64: бойова поза>" }
```

`fight` потрібен, коли `spec.fightImage` не `null`: це той самий набір речей, намальований з
`fightImage` як картинкою 1. Без нього образ збережеться лише в прямій позі, і арена покаже її.

Можна і `data:image/png;base64,…`. Ліміт — 9 МБ картинки (≈ 12 МБ base64). Відповідь:
`{"ok": true, "file": "6cf1c3f1d0a5-mgv8k2a1", "avatar": "hero:gen/6cf1c3f1d0a5-mgv8k2a1", "heroes": 1}`.

**Вимоги до картинки:**
- **Те саме полотно й та сама композиція, що в `baseImage` / `fightImage`:** персонаж на
  повний зріст, той самий кадр, поза й масштаб, картинка в пропорціях полотна. Бази
  приходять **на полотні з прозорим запасом** з боків і зверху (`/img/ava/gen/canvas/…`):
  це місце для довгої зброї (кнут, спис, лук), щоб вона не обрізалась. Персонаж лишається
  там, де він на полотні, а зброя може виходити в запас. Сервер вписує результат у полотно,
  вирізає маленькі аватарки (обличчя 256×256 і 96×96) за відомою рамкою обличчя бази й
  обрізає порожні поля. Якщо зсунути персонажа, обличчя в маленьких аватарках з'їде.
- **Прозорий фон (PNG з альфою або WebP).** На сайті персонаж стоїть на власних фонах
  (замок, небо). Якщо модель дає суцільний фон, прибери його перед відправкою
  (наприклад, нодою rembg / BiRefNet у тому ж workflow).
- Роздільність — від розміру полотна й вище. Сервер зводить зріст героя до 1000 px.

Сервер сам зберігає файли (`/img/ava/gen/<file>-full|fight|256|96.webp`) і ставить образ
аватаром усім Героям, які чекали цей набір. Повторний `result` для того самого завдання
замінює образ: так перемальовують невдалий.

## 4. Не вийшло — `POST /api/avatar/worker/fail`

```json
{ "id": 1, "error": "CUDA out of memory", "retry": true }
```

- `retry: true` (за замовчуванням): повернути в чергу, поки спроб менше 3.
- `retry: false`: остаточна помилка (наприклад, workflow зламаний). Герой побачить
  «Образ не вдався», попередній аватар лишиться. Натиснувши «Одягти» ще раз, Герой поставить
  набір у чергу знову.

## Як малювати (рекомендація)

Qwen Image Edit (image-edit режим) приймає кілька картинок-референсів. Найнадійніший варіант:

1. **Картинка 1** — `baseImage` як є (для моделі прозорий фон краще залити білим).
2. **Картинка 2** — аркуш речей, який збирає сам воркер (Pillow). Це сітка з картинок
   `slots[].item.image`, під кожною — підпис `en` (або `label`) і назва речі.
   Приклад: «HEADWEAR — шляпа», «WEAPON HELD IN THE RIGHT HAND — Меч новачка». Порожні
   слоти на аркуш не потрапляють.
3. **Промпт** — `spec.prompt`. Seed фіксуй за `key` (наприклад, `int(key[:8], 16)`):
   той самий набір тоді малюється стабільно.
4. Після генерації прибери фон, впиши в розмір бази й відправ `result`.

Workflow ComfyUI зручно тримати як експорт у форматі API (`Save (API Format)`). Воркер
підставляє в нього картинки (`/upload/image`) і промпт, запускає (`POST /prompt`), чекає
(`/history/<prompt_id>` або WebSocket `/ws`) і забирає результат (`/view?filename=…`).

## Мінімальний цикл (псевдокод)

```python
while True:
    job = post("/api/avatar/worker/claim", {"worker": "comfy-pc"})["job"]
    if not job:
        sleep(5); continue
    try:
        spec = job["spec"]
        base = download(spec["baseImage"])
        sheet = make_sheet([s for s in spec["slots"] if s["item"]])   # Pillow: картинки + підписи
        beat = lambda: post("/api/avatar/worker/heartbeat", {"id": job["id"]})
        seed = int(job["key"][:8], 16)
        png = run_comfy(base, sheet, spec["prompt"], seed=seed, on_progress=beat)
        out = {"id": job["id"], "image": b64(png)}
        if spec.get("fightImage"):   # той самий набір у бойовій позі
            out["fight"] = b64(run_comfy(download(spec["fightImage"]), sheet, spec["prompt"], seed=seed, on_progress=beat))
        post("/api/avatar/worker/result", out)
    except Aborted:            # 409 — завдання перевидали
        continue
    except Exception as e:
        post("/api/avatar/worker/fail", {"id": job["id"], "error": str(e)[:300]})
```

## Перевірка без ComfyUI

```sh
T=…токен…
curl -s -X POST https://school-king.pp.ua/api/avatar/worker/claim \
  -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{"worker":"curl"}'
# відповісти базою «як є», щоб перевірити ланцюжок:
B=$(curl -s https://school-king.pp.ua/img/ava/%D1%87%D0%B5%D1%80%D0%BD%D0%B5%D1%82%D0%BA%D0%B8-%D0%B0%D0%B2%D0%B0%D1%82%D0%B0%D1%80%D0%B0/linen-boy-fight-base.webp | base64 | tr -d '\n')
printf '{"id":1,"image":"%s"}' "$B" | curl -s -X POST https://school-king.pp.ua/api/avatar/worker/result \
  -H "Authorization: Bearer $T" -H 'Content-Type: application/json' --data-binary @-
```

## Адмінка (для адміністратора сайту, з його сесією)

- `GET /api/admin/avatar/jobs`: останні 100 завдань (стан, спроби, помилка, файл).
- `POST /api/admin/avatar/requeue {"key": "…"}`: перемалювати набір (новий workflow,
  невдалий результат). Герої бачать старий образ, доки не прийде новий.

## Нова база (інший аватар)

Щоб образ працював для іншого героя (наприклад, лицарки), додай у репозиторій
`img/ava/<id>-base.webp`: той самий персонаж без верхнього одягу, на повний зріст, прозорий
фон. У `FACE_BOX` у `server/app/src/avatar.js` додай рамку обличчя (частки ширини й висоти;
її можна знайти, зіставивши `<id>-256.webp` з `<id>-full.webp`). Без `-base.webp` кнопка
скаже: «Для цього аватара ще немає базового зображення».

# English · 2 клас — «Читаємо й говоримо»

> **Курс** — папка `American English курс/`: опис курсу (програма 1–2 класу) і окремий файл з усіма аркушами для друку. Після нового модуля зберіть його заново: `python3 "American English курс/build_course.py"`.

> **На сайті** модулі працюють як один тренажер `klas-2/english-2.html?m=N` (дизайн, прогрес і нагороди сайту, як у `klas-1/english-1-litery.html`). Плитка для адмінки — `tests/english-2-tiles.json` (⬆ Імпорт JSON), тести «перевір себе» — `tests/test-english-2-module-01.json`, `…-02.json`. Аркуші PDF сайт відкриває звідси.

> **AE Words** — у «Словнику English» (`slovnyk-en.html`, вкладка 🇺🇸 AE Words) слова курсу зібрані по модулях. Окремо їх вносити не треба: словник бере «Слова теми» прямо з масиву `MODS` тренажера (`sk-ae-words.js`), тож новий модуль чи слово з'являються там самі.

Тренажер до річної програми з американської англійської для 2 класу (≈70 годин, 10 модулів). Готові модулі 1–2, решта додається за тим самим шаблоном.

| Модуль | Тема | Що вчимо |
| --- | --- | --- |
| [1](module-01-welcome-back/) | Welcome Back! | шкільні речі, звуки алфавіту, *Is it a…? Yes, it is. / No, it isn't.*, слова з трьох літер (cat, pen, pig, dog, sun), *How old are you? I'm seven.* |
| [2](module-02-my-home/) | My Home (+ Halloween) | кімнати й меблі, *Where is the cat? It's in / on / under / next to the box.*, *There is a bed in my room.*, коротке **a** і родини слів -at, -an, -ap |

## Модуль на сайті — 6 рівнів

У модулі 2 рівень 3 — **Where is the cat?** (кіт у / на / під / поруч із предметом), рівень 4 — **Читаємо: коротке a** (прочитай слово → картинка; почуй → слово). Решта — як нижче.

1. **Слова теми** — почуй і обери картинку, назви картинку, переклад.
2. **Перший звук** — з якої літери починається слово; пропущена перша літера.
3. **Is it a …?** — картинка й питання, відповідь *Yes, it is. / No, it isn't.*
4. **Читаємо слова** — пропущена голосна (c_t), почуй і обери слово (cat / cot / cut).
5. **Діалог з Teddy** — знайомство, вік, шкільні речі, числа.
6. **Фінал** — усе разом.

Окремо: «Картки слів», «Звуки ABC» (літера → звук → слово) і кнопка «Аркуші для друку (PDF)».

## Файли

- `module-01-welcome-back/worksheets.pdf` — 8 аркушів A4 з чорно-білими малюнками для розфарбовування: All about me, пропущені літери, перші звуки, School things, Is it a…?, Spell it (c-a-t), числа 11–20, Read and trace + «I can…».
- `module-01-welcome-back/index.html` — проста окрема сторінка тренажера (без входу на сайт).
- `tools/build_site_g2.py` — збирає `klas-2/english-2.html` із шаблону 1 класу, а також плитку й тест у `tests/`. Новий модуль: додайте його в `MODS` і запустіть `python3 build_site_g2.py <корінь репозиторію>`.
- `tools/worksheets_g2m1.py`, `tools/worksheets_g2m2.py` — генерують PDF модулів (HTML → Chromium через Playwright); потім `American English курс/brand_sheets.py` додає логотип, адресу сайту й Teddy Star.
- `module-02-my-home/worksheets.pdf` — 8 аркушів: My home (кімнати), Things in my home, Where is the cat?, Read and draw, Short a, Word families, My room, Happy Halloween + «I can…».

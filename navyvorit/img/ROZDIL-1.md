# 🏘️ Розділ I «Дивне місто» — перші картинки для ігор без малюнків

Готові й намальовані: **«Дерево догори ногами»** (`svit-navyvorit/`) і **«Будинок, якого немає»** (`budynok-yakoho-nemaye/`). Це й є зразок стилю.
Без картинок поки три гри: **«Чотири двері»** (`budynok-z-dveryma.html`), **«Дзеркальна кімната»** (`dzerkalna-kimnata.html`), **«Кіт, який бреше»** (`kit.html`).

Склади файли в папки з назвами, як нижче (`img/budynok-z-dveryma/`, `img/dzerkalna-kimnata/`, `img/kit/`), і я підключу їх.

**Стан:** ✅ усі картинки трьох ігор уже в грі (вирізано з одного аркуша). Стартові екрани зроблено як у «Будинку, якого немає» — спільні `nav-scroll.css` / `nav-scroll.js`. Заставки намальовано горизонтальними — на телефоні над і під картинкою колір неба / підлоги; якщо буде вертикальна версія 1000 × 1500 — просто заміню `start-hero.webp`.

## Не треба малювати — беру з «Будинку, якого немає»

Сувій для загадки `scroll.webp`, лупа `magnifier.webp`, кругла кнопка зі стрілкою `go-btn.webp`, дерев'яні кнопки `btn-wood-square.webp` і `btn-wood-long.webp`. Вони однакові для всього розділу.

## Загальні вимоги

- `.webp` або `.png`. **Без тексту, букв і цифр**: назви, загадки, кнопки й підказки пише код.
- 🫥 — прозорий фон, без тіні на землі.
- Окремої «навиворіт»-версії не треба: фіолетовий тон і перевороти роблю в коді.
- **Герої ті самі, що на заставці «Будинку, якого немає»:** хлопчик у жовтій худі з синім рюкзаком, дівчинка-принцеса з довгим фіолетовим волоссям і короною, у фіолетовій сукні, собака-робот біло-блакитний. Найкраще генерувати від `budynok-yakoho-nemaye/start-hero.webp` (image-to-image / reference).

**Спільний стиль — додавай у кінець кожного промпту:**
> Cute stylized 3D children's fantasy game art, soft warm lighting, bright saturated colors, rounded shapes, high detail, same style as the reference image. No text, no letters, no numbers.

Для 🫥 ще додай:
> Isolated on a fully transparent background, no ground shadow, no frame.

---

## 1. «Чотири двері» → `img/budynok-z-dveryma/`

Будинок №17 із чотирма дверима (червоні, сині, зелені, жовті); біля них три персонажі: кіт Мурко, сова Софія, лис Лесик. Один із них бреше.

| # | Файл | Розмір | Фон | Що на ньому |
|---|---|---|---|---|
| 1 | `start-hero.webp` | 1000 × 1500 | суцільний | Заставка на весь екран: фасад казкового будинку з **чотирма різнокольоровими дверима** в ряд, перед ним — хлопчик, принцеса й собака-робот дивляться на двері; збоку — кіт, сова й лис. Верхня ⅓ — небо (там буде табличка з назвою), нижня ¼ — бруківка (там буде сувій) |
| 2 | `title-frame.webp` 🫥 | 1080 × 544 | прозорий | Дерев'яна табличка з темно-синім **порожнім** полем, ліани й листя, ліхтарик праворуч; угорі — золотий значок із **дверима** |
| 3 | `door-red.webp`, `door-blue.webp`, `door-green.webp`, `door-yellow.webp` 🫥 | 300 × 480 | прозорий | Двері в кам'яній арці, зачинені, з круглою ручкою, однаковий розмір і ракурс (анфас) |
| 4 | `door-open.webp` 🫥 | 300 × 480 | прозорий | Ті самі двері відчинені, усередині — тепле золоте світло (колір дверей роблю в коді або намалюй 4 штуки) |
| 5 | `cat.webp`, `owl.webp`, `fox.webp` 🫥 | 400 × 400 | прозорий | Кіт Мурко (рудий у смужку), сова Софія (з окулярами), лис Лесик (хитрий, з шарфиком) — повний зріст, анфас |

**Промпт 1 (`start-hero`):**
> Vertical 2:3 game splash screen. A whimsical fairy-tale house facade on a cobblestone street with four doors in a row: red, blue, green and yellow, each in a stone arch. In front of it a boy in a yellow hoodie with a blue backpack, a princess with long purple hair and a golden crown in a purple dress, and a white-and-blue robot puppy look at the doors, seen from behind three-quarter. On the side a ginger tabby cat, an owl with round glasses and a sly fox with a scarf stand near the doors. Castle towers and blue sky in the background. Keep the top third mostly sky and the bottom quarter plain cobblestone.

**Промпт 3 (`door-*`):**
> A single fairy-tale wooden door in a sandstone arch, painted [red / blue / green / yellow], round brass knob, small window at the top, front view, centered.

**Промпт 5 (персонажі):**
> A cute cartoon [ginger tabby cat / owl with round glasses / sly fox with a small scarf], full body, standing, friendly expression, front view, centered.

---

## 2. «Дзеркальна кімната» → `img/dzerkalna-kimnata/`

Велике дзеркало показує ряд знаків (★ ● ▲, стрілки). Треба зрозуміти, який порядок насправді. Знаки й стрілки малює код.

| # | Файл | Розмір | Фон | Що на ньому |
|---|---|---|---|---|
| 1 | `start-hero.webp` | 1000 × 1500 | суцільний | Заставка: чарівна кімната в замку з **великим дзеркалом у золотій рамі**; хлопчик і принцеса стоять перед ним і бачать своє відображення **дзеркально** (у відображенні принцеса ліворуч, хлопчик праворуч), собака-робот здивовано дивиться за раму. Іскри, свічки, килим |
| 2 | `title-frame.webp` 🫥 | 1080 × 544 | прозорий | Табличка як у розділі, золотий значок угорі — **дзеркало** |
| 3 | `room-bg.webp` | 1600 × 900 | суцільний | Сцена гри: кімната **без героїв**, ліворуч — порожня підлога («насправді»), праворуч — **велике порожнє дзеркало** (скло світле, без відображення: туди код ставить знаки) |
| 4 | `kid.webp` 🫥 | 400 × 500 | прозорий | Хлопчик із рюкзаком на повний зріст, обличчям праворуч (дивиться в дзеркало) |

**Промпт 1 (`start-hero`):**
> Vertical 2:3 game splash screen. A magical castle room with a huge ornate mirror in a golden frame. A boy in a yellow hoodie with a blue backpack and a princess with long purple hair in a purple dress stand in front of it; their reflection in the mirror is clearly flipped left-to-right. A white-and-blue robot puppy peeks curiously behind the frame. Candles, sparkles, a soft carpet, stone walls with blue banners. Keep the top third calm (wall and ceiling) and the bottom quarter plain floor.

**Промпт 3 (`room-bg`):**
> Wide 16:9 game scene, a cozy magical castle room. On the left an empty wooden floor area, on the right a huge ornate golden-framed mirror with clean, bright, empty glass showing no reflection. Candles, blue banners, soft light. No characters.

---

## 3. «Кіт, який бреше» → `img/kit/`

Чорний кіт завжди бреше, сова каже правду (після перевороту — навпаки). Скарб 💎 — в одній зі скринь: дві (ліва / права) або три (червона / синя / зелена).

| # | Файл | Розмір | Фон | Що на ньому |
|---|---|---|---|---|
| 1 | `start-hero.webp` | 1000 × 1500 | суцільний | Заставка: горище або скарбниця, **три скрині** (червона, синя, зелена) на підлозі; на одній сидить **чорний кіт із хитрою посмішкою**, на балці — **сова**; хлопчик, принцеса й собака-робот вирішують, кому вірити |
| 2 | `title-frame.webp` 🫥 | 1080 × 544 | прозорий | Табличка як у розділі, золотий значок — **чорний кіт** |
| 3 | `chest-red.webp`, `chest-blue.webp`, `chest-green.webp`, `chest-wood.webp` 🫥 | 400 × 340 | прозорий | Скриня зачинена, з замочком, анфас, однаковий розмір (`wood` — звичайна дерев'яна, для «лівої / правої») |
| 4 | `chest-open.webp` 🫥 | 400 × 400 | прозорий | Відчинена порожня скриня (усередину код кладе 💎 або 🕸️) |
| 5 | `cat.webp`, `owl.webp` 🫥 | 400 × 400 | прозорий | Чорний кіт із зеленими очима, хитро примружений; сова — мудра, спокійна. Повний зріст |
| 6 | `gem.webp` 🫥 | 256 × 256 | прозорий | Великий блакитний діамант, що сяє (бажано) |

**Промпт 1 (`start-hero`):**
> Vertical 2:3 game splash screen. A cozy treasure attic with wooden beams and warm light from a round window. Three treasure chests on the floor: red, blue and green. A black cat with green eyes and a sly grin sits on one chest, a wise owl perches on a beam above. A boy in a yellow hoodie with a blue backpack, a princess with long purple hair and a crown, and a white-and-blue robot puppy look at them, thinking whom to trust. Keep the top third calm and the bottom quarter plain wooden floor.

**Промпт 3 (`chest-*`):**
> A single cartoon treasure chest, painted [red / blue / green / natural wood], gold trim and a small padlock, closed, front view, centered.

**Промпт 5 (`cat`, `owl`):**
> A cute cartoon [black cat with green eyes and a sly squint / wise calm owl], full body, sitting, front view, centered.

---

## Порада

- **Заставка (`start-hero`):** у верхній третині залиш спокійне небо чи стіну, бо там буде табличка з назвою. Унизу залиш рівну підлогу, бо там буде сувій із загадкою, а самі герої мають бути посередині. Так зроблено в «Дереві» і «Будинку».
- **Двері, скрині й персонажів** генеруй однією серією (сіткою на одному аркуші, як «Ворота»), щоб вони вийшли однакового розміру й стилю. Я сама їх розріжу.

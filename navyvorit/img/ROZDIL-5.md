# 🏰 Розділ V «Замок загадок» — картинки для ігор

Усі п'ять ігор розділу поки на емодзі. Для кожної потрібні заставка, табличка з назвою, фон сцени, предмети й фон сторінки.

| № | Гра | Файл | Папка для картинок |
|---|---|---|---|
| 21 | 📚 Книги міняються місцями | `knyhy.html` | `img/knyhy/` |
| 22 | ♟️ Шахова підлога | `shakhova-pidloha.html` | `img/shakhova-pidloha/` |
| 23 | 🗝️ Три ключі | `try-klyuchi.html` | `img/try-klyuchi/` |
| 24 | 💎 Ворота трьох кристалів | `vorota-krystaliv.html` | `img/vorota-krystaliv/` |
| 25 | 👑 Королівський скарб | `skarb.html` | `img/skarb/` |

Як у розділі IV, **одним аркушем на гру**: ліворуч заставка, праворуч табличка, фон сцени й предмети на білому, розділені тонкими білими лініями. **Фони сторінок** — окремим аркушем, п'ять вертикальних панелей поруч. Я сама розріжу й приберу тло.

## Не треба малювати

- Сувій, лупу, кнопку ➜, дерев'яні кнопки, стрічку для фіналу — беру з попередніх розділів.
- **Літери на книжках, кольори книжок, числа на кристалах і воротах, написи на скринях і табличках, слова гнома й короля** — усе це пише й фарбує код. На картинках їх не має бути.

## Загальні вимоги

- `.webp` або `.png`. **Без тексту, букв і цифр.**
- Предмети — на білому тлі (не «шахівниця»), з полями по краях, без тіні на землі.
- Окремої «навиворіт»-версії не треба: фіолетовий тон і перевороти роблю в коді.
- **Герої ті самі:** хлопчик у жовтій худі з синім рюкзаком, дівчинка-принцеса з довгим фіолетовим волоссям і короною, у фіолетовій сукні, собака-робот біло-блакитний. Генеруй від `budynok-yakoho-nemaye/start-hero.webp` (reference).
- **Місце дії розділу** — **усередині королівського замку**: бібліотека, шахова зала, скарбниця, брама замку, королівська скарбниця. Кам'яні стіни, золото, фіолетові й сині гобелени, ліхтарі — той самий замок, що видно на горизонті в розділах I–IV.

**Спільний стиль — у кінець кожного промпту:**
> Cute stylized 3D children's fantasy game art, soft warm lighting, bright saturated colors, rounded shapes, high detail, same style as the reference image. No text, no letters, no numbers.

## Однакове для кожної гри

| Файл | Розмір | Що на ньому |
|---|---|---|
| `start-hero.webp` | 1024 × 1536 | Заставка. Верхня ⅓ — спокійна стеля, стіна чи небо (там табличка), нижня ¼ — рівна підлога (там сувій), герої й головний предмет — посередині |
| `title-frame.webp` | 1080 × 544 | Дерев'яна табличка з темно-синім **порожнім** полем, ліани, ліхтарик праворуч, угорі — золотий медальйон зі значком гри |
| `page-bg.webp` | 1080 × 1920 | Фон сторінки: та сама зала, спокійна, без героїв, нічого важливого посередині |

**Промпт `title-frame` (міняй лише значок):**
> A wooden signboard with an empty dark-blue center panel, wrapped in green vines and leaves, a small glowing lantern hanging on the right, a golden round emblem at the top center showing [ICON]. Front view, centered.

---

## 21. 📚 Книги міняються місцями → `img/knyhy/`

На полиці три-чотири книжки (червона, зелена, синя, помаранчева з літерами А Б В Г). Коли дзвонить дзвоник, вони міняються місцями; після перевороту — рухаються по колу. **Колір і літеру книжки дає код**, тож потрібна одна **біла** книжка.
Значок таблички — **книжка з дзвоником**. `page-bg` — бібліотека замку.

| # | Файл | Розмір | Що на ньому |
|---|---|---|---|
| 1 | `scene-bg.webp` | 1600 × 800 | Бібліотека: високі шафи з книжками (розмиті) по краях, **посередині — одна порожня дерев'яна полиця** через усю ширину, на нижній третині картинки |
| 2 | `book-white.webp` | 200 × 340 | Одна книжка стоїть вертикально, видно корінець, **обкладинка чисто біла**, без візерунків і літер (код її фарбує) |
| 3 | `bell.webp` | 300 × 300 | Золотий дзвоник із дерев'яною ручкою |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. A cozy magical castle library with tall wooden bookshelves and floating candles; on a shelf in the middle colorful books jump and swap places in the air as a golden hand bell rings. A boy in a yellow hoodie with a blue backpack rings the bell, a princess with long purple hair and a crown in a purple dress catches a flying book, a white-and-blue robot puppy watches the books. Keep the top third calm (arched ceiling) and the bottom quarter plain wooden floor.

**Промпт аркуша:**
> A game asset sheet separated by thin white lines. Left, tall vertical panel 2:3: [start-hero prompt]. Top right: a wooden signboard with an empty dark-blue panel, vines, a lantern on the right and a golden emblem with a book and a small bell at the top center. Middle right, wide panel: a castle library with blurred tall bookshelves at the sides and one empty wooden shelf across the middle, no books on it, no characters. Bottom right, on a plain white background: one upright book seen from the spine, plain pure white cover with no pattern; a golden hand bell with a wooden handle.

---

## 22. ♟️ Шахова підлога → `img/shakhova-pidloha/`

Ряд із чотирьох-п'яти клітинок; хлопчик переходить по них, і клітинка міняє колір (біла ↔ чорна). **Колір клітинок і номери кроків міняє код**, тож потрібні дві плитки й сам хлопчик.
Значок таблички — **шахова пішка на клітинках**. `page-bg` — шахова зала.

| # | Файл | Розмір | Що на ньому |
|---|---|---|---|
| 1 | `scene-bg.webp` | 1600 × 800 | Шахова зала замку: великі шахові фігури-статуї й гобелени по краях, **унизу через усю ширину — рівна одноколірна кам'яна підлога** (нижні ~40 %), без клітинок |
| 2 | `tile-white.webp` | 300 × 300 | Квадратна плитка з білого мармуру, вид спереду трохи згори, з фаскою |
| 3 | `tile-black.webp` | 300 × 300 | Така сама плитка з чорного мармуру |
| 4 | `hero.webp` | 300 × 420 | Хлопчик у жовтій худі з синім рюкзаком на повний зріст, крокує, вид збоку-спереду |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. A grand castle chess hall with giant chess piece statues; a path of big black and white floor tiles where each tile the boy steps on magically flips its color with a sparkle. A boy in a yellow hoodie with a blue backpack hops from tile to tile, a princess with long purple hair and a crown in a purple dress counts the steps, a white-and-blue robot puppy stands on a glowing tile. Keep the top third calm (hall ceiling with banners) and the bottom quarter plain floor.

**Промпт аркуша:**
> A game asset sheet separated by thin white lines. Left, tall vertical panel 2:3: [start-hero prompt]. Top right: a wooden signboard with an empty dark-blue panel, vines, a lantern on the right and a golden emblem with a chess pawn on black and white squares at the top center. Middle right, wide panel: a castle chess hall with giant chess statues and banners at the sides and a plain single-color stone floor across the whole bottom part, no checkered pattern, no characters. Bottom right, on a plain white background: one square white marble floor tile, front view slightly from above; the same tile in black marble; the boy in a yellow hoodie with a blue backpack, full body, walking.

---

## 23. 🗝️ Три ключі → `img/try-klyuchi/`

Скриня з написом і три ключі — золотий, срібний, бронзовий; підходить лише один. Після перевороту написи брешуть, а з'являється гном, який каже правду. **Напис на табличці й слова гнома пише код.**
Значок таблички — **ключ біля скрині**. `page-bg` — скарбниця.

| # | Файл | Розмір | Що на ньому |
|---|---|---|---|
| 1 | `scene-bg.webp` | 1600 × 800 | Кам'яна скарбниця-підвал зі смолоскипами й купками монет по краях (розмиті), **посередині — порожнє місце для скрині, унизу — рівна підлога** |
| 2 | `chest.webp` | 400 × 320 | Дерев'яна скриня з металевими кутами, **закрита**, з висячим замком, анфас |
| 3 | `chest-open.webp` | 400 × 360 | Та сама скриня **відчинена**, усередині сяє один великий кристал |
| 4 | `key-gold.webp` | 300 × 160 | Золотий ключ, лежить горизонтально |
| 5 | `key-silver.webp` | 300 × 160 | Такий самий срібний ключ |
| 6 | `key-bronze.webp` | 300 × 160 | Такий самий бронзовий ключ |
| 7 | `gnome.webp` | 300 × 360 | Добрий гном із білою бородою й червоним ковпаком, по пояс, піднятий палець |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. A cozy stone treasure vault in a castle lit by torches; in the middle a wooden treasure chest with a big padlock, and three keys — golden, silver and bronze — float above it glowing. A boy in a yellow hoodie with a blue backpack reaches for the silver key, a princess with long purple hair and a crown in a purple dress holds a lantern, a white-and-blue robot puppy sniffs the lock; a small kind gnome peeks from behind the chest. Keep the top third calm (stone arches) and the bottom quarter plain stone floor.

**Промпт аркуша:**
> A game asset sheet separated by thin white lines. Left, tall vertical panel 2:3: [start-hero prompt]. Top right: a wooden signboard with an empty dark-blue panel, vines, a lantern on the right and a golden emblem with a key next to a small chest at the top center. Middle right, wide panel: a stone treasure vault with torches and blurred piles of coins at the sides, an empty space in the middle and a plain stone floor, no characters. Bottom right, on a plain white background: a closed wooden chest with metal corners and a padlock, front view; the same chest open with one big glowing crystal inside; a golden key, a silver key and a bronze key of the same shape lying horizontally; a kind gnome with a white beard and a red hat, waist-up, raising a finger.

---

## 24. 💎 Ворота трьох кристалів → `img/vorota-krystaliv/`

Старі ворота відчиняються, коли в три гнізда вставити кристали з потрібною сумою. Унизу — п'ять кристалів із числами. **Числа на кристалах і на воротах пише код**, після перевороту він же фарбує кристали у фіолетовий.
Значок таблички — **кристал перед брамою**. `page-bg` — брама замку.

| # | Файл | Розмір | Що на ньому |
|---|---|---|---|
| 1 | `scene-bg.webp` | 1600 × 800 | Подвір'я замку: кам'яні стіни, вежі й квіти по краях, **посередині — порожня кам'яна бруківка** (нижні ~40 %) |
| 2 | `gate.webp` | 600 × 480 | Стара кам'яна арка-брама, **зачинена**, анфас; угорі — **порожня кругла табличка**, під нею в ряд **три порожні гнізда** для кристалів |
| 3 | `gate-open.webp` | 600 × 480 | Та сама брама **відчинена**, з арки ллється тепле світло, гнізда сяють |
| 4 | `crystal.webp` | 240 × 280 | Один гранований блакитний кристал, анфас, з **широкою рівною гранню посередині** (туди код пише число) |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. An ancient stone castle gate with three empty glowing sockets in a row; five sparkling blue crystals float in front of it. A boy in a yellow hoodie with a blue backpack places a crystal into a socket, a princess with long purple hair and a crown in a purple dress holds two more crystals, a white-and-blue robot puppy looks up at the gate. Keep the top third mostly sky and castle towers and the bottom quarter plain cobblestone.

**Промпт аркуша:**
> A game asset sheet separated by thin white lines. Left, tall vertical panel 2:3: [start-hero prompt]. Top right: a wooden signboard with an empty dark-blue panel, vines, a lantern on the right and a golden emblem with a blue crystal in front of a small gate at the top center. Middle right, wide panel: a castle courtyard with stone walls, towers and flowers at the sides and empty cobblestone in the middle, no characters. Bottom right, on a plain white background: an old stone arched gate, closed, front view, with an empty round plaque at the top and three empty crystal sockets in a row below it; the same gate open with warm light pouring out; one faceted light-blue crystal with a wide flat face in the middle, front view.

---

## 25. 👑 Королівський скарб → `img/skarb/`

Три скрині — золота, срібна й бронзова — з написами; король каже, скільки написів правдиві. Відкриваються всі три: в одній — кристал, у двох — павутиння. **Написи, слова короля й те, що всередині, показує код**, тож відчинені скрині — **порожні**.
Значок таблички — **корона над скринею**. `page-bg` — королівська скарбниця.

| # | Файл | Розмір | Що на ньому |
|---|---|---|---|
| 1 | `scene-bg.webp` | 1600 × 800 | Королівська скарбниця: фіолетові завіси, золоті колони, гори монет по краях (розмиті), **унизу через усю ширину — рівна підлога** |
| 2 | `chest-gold.webp` | 360 × 300 | Золота скриня, **закрита**, анфас |
| 3 | `chest-silver.webp` | 360 × 300 | Така сама срібна скриня, закрита |
| 4 | `chest-bronze.webp` | 360 × 300 | Така сама бронзова скриня, закрита |
| 5 | `chest-gold-open.webp`, `chest-silver-open.webp`, `chest-bronze-open.webp` | 360 × 340 | Ті самі скрині **відчинені й порожні** всередині |
| 6 | `king.webp` | 360 × 420 | Добрий король із короною й сивою бородою, у фіолетовій мантії, по пояс, піднята рука |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. A royal treasure hall with purple curtains and golden columns; three treasure chests in a row — golden, silver and bronze — and a kind old king with a crown and a grey beard points at them with a smile. A boy in a yellow hoodie with a blue backpack thinks with his hand on his chin, a princess with long purple hair and a crown in a purple dress opens the golden chest a little, a white-and-blue robot puppy sniffs the bronze chest. Keep the top third calm (curtains and ceiling) and the bottom quarter plain floor.

**Промпт аркуша:**
> A game asset sheet separated by thin white lines. Left, tall vertical panel 2:3: [start-hero prompt]. Top right: a wooden signboard with an empty dark-blue panel, vines, a lantern on the right and a golden emblem with a crown above a small chest at the top center. Middle right, wide panel: a royal treasure hall with purple curtains, golden columns and blurred piles of coins at the sides and a plain floor across the bottom, no characters. Bottom right, on a plain white background: three closed treasure chests of the same shape — golden, silver and bronze — front view; the same three chests open and empty inside; a kind old king with a crown and a grey beard in a purple robe, waist-up, raising one hand.

---

## Фони сторінок — окремим аркушем

> A game asset sheet of five vertical 9:16 calm game backgrounds side by side, separated by thin white lines, no characters, nothing important in the center of each panel, soft blurred depth, all inside the same magical royal castle: 1) a cozy library with tall bookshelves and floating candles; 2) a grand chess hall with giant chess statues and banners; 3) a stone treasure vault lit by torches; 4) a castle courtyard in front of an old stone gate; 5) a royal treasure hall with purple curtains and golden columns. Cute stylized 3D children's fantasy game art, soft warm lighting, bright saturated colors, rounded shapes. No text, no letters, no numbers.

## Порада

- **Букви, числа й написи** генератори люблять дописувати самі — на корінцях книжок, кристалах, табличці брами й скринях. Їх не має бути. Якщо з'являться, я зітру, але чисті картинки кращі.
- **Біла книжка** — саме біла, бо колір їй дає код (як біла квітка в «Саду кольорів»).
- **Ключі й скрині** — однакової форми, різниться лише метал. Так дітям легше порівнювати.
- **Відчинені скрині в «Скарбі»** — порожні: кристал чи павутиння показує код.

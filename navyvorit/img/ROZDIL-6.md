# 💜 Розділ VI «Останній переворот» — картинки для ігор

Усі п'ять ігор розділу поки на емодзі. Для кожної потрібні заставка, табличка з назвою, фон сцени, предмети й фон сторінки.

| № | Гра | Файл | Папка для картинок |
|---|---|---|---|
| 26 | 🪐 Кімната без гравітації | `gravitatsiya.html` | `img/gravitatsiya/` |
| 27 | 🌀 Портал двох світів | `portal.html` | `img/portal/` |
| 28 | 🎚️ Чотири важелі | `chotyry-vazheli.html` | `img/chotyry-vazheli/` |
| 29 | 🔐 Код стародавніх воріт | `kod-vorit.html` | `img/kod-vorit/` |
| 30 | 💜 Серце Світу навиворіт | `sertse-svitu.html` | `img/sertse-svitu/` |

Як у розділах IV–V, **одним аркушем на гру**: ліворуч заставка, праворуч табличка, фон сцени й предмети на білому, розділені тонкими білими лініями. **Фони сторінок** — окремим аркушем, п'ять вертикальних панелей поруч. Я сама розріжу й приберу тло.

## Не треба малювати

- Сувій, лупу, кнопку ➜, дерев'яні кнопки, стрічку для фіналу — беру з попередніх розділів.
- Хлопчика на повний зріст беру з «Шахової підлоги» (`shakhova-pidloha/hero.webp`).
- **Числа годин, літери й номери ламп і важелів, цифри коду, таблички-підказки, назви кристалів, «дерев'яний» відтінок предметів** — усе це пише й фарбує код. На картинках їх не має бути.

## Загальні вимоги

- `.webp` або `.png`. **Без тексту, букв і цифр.**
- Предмети — на білому тлі (не «шахівниця»), з полями по краях, без тіні на землі.
- Окремої «навиворіт»-версії не треба: фіолетовий тон і перевороти роблю в коді.
- **Герої ті самі:** хлопчик у жовтій худі з синім рюкзаком, дівчинка-принцеса з довгим фіолетовим волоссям і короною, у фіолетовій сукні, собака-робот біло-блакитний. Генеруй від `budynok-yakoho-nemaye/start-hero.webp` (reference).
- **Місце дії розділу** — **край світу біля Серця**, де все перевернуто найсильніше: летючі острови, замок догори дном на горизонті, фіолетово-зоряне небо, кристали, чарівні руни. Тепле світло ліхтарів і кристалів, як у попередніх розділах, але більше фіолетового й синього.
- **Розміри фонів сторінок** — справді вертикальні, **1080 × 1920** (у розділі V вони прийшли маленькими квадратиками й на телефоні розмиті).

**Спільний стиль — у кінець кожного промпту:**
> Cute stylized 3D children's fantasy game art, soft warm lighting, bright saturated colors, rounded shapes, high detail, same style as the reference image. No text, no letters, no numbers.

## Однакове для кожної гри

| Файл | Розмір | Що на ньому |
|---|---|---|
| `start-hero.webp` | 1024 × 1536 | Заставка, **вертикальна**. Верхня ⅓ — спокійне небо чи стеля (там табличка), нижня ¼ — рівна підлога чи земля (там сувій), герої й головний предмет — посередині |
| `title-frame.webp` | 1080 × 544 | Дерев'яна табличка з темно-синім **порожнім** полем, ліани, ліхтарик праворуч, угорі — золотий медальйон зі значком гри |
| `page-bg.webp` | 1080 × 1920 | Фон сторінки: те саме місце, спокійне, без героїв, нічого важливого посередині |

**Промпт `title-frame` (міняй лише значок):**
> A wooden signboard with an empty dark-blue center panel, wrapped in green vines and leaves, a small glowing lantern hanging on the right, a golden round emblem at the top center showing [ICON]. Front view, centered.

---

## 26. 🪐 Кімната без гравітації → `img/gravitatsiya/`

У кімнаті немає гравітації, на стелі — великий магніт. Посередині пливе предмет: металевий летить до магніту, м'який лишається висіти; після перевороту магніт переїжджає на підлогу, а гравітація тягне вгору. **Магніт і предмет рухає код, назви й «дерев'яний» відтінок теж робить код.**
Значок таблички — **підкова-магніт і планета**. `page-bg` — кімната-обсерваторія в невагомості.

| # | Файл | Розмір | Що на ньому |
|---|---|---|---|
| 1 | `scene-bg.webp` | 1600 × 800 | Кругла кімната-обсерваторія: зоряне вікно, полиці й дрібнички, що ширяють у повітрі по краях (розмиті), **посередині — порожній простір від стелі до підлоги** |
| 2 | `magnet.webp` | 300 × 300 | Великий червоно-сріблястий магніт-підкова, кінцями донизу |
| 3 | `items-metal.webp` | аркуш 5 предметів | Металеві: ключ, гвинт, ложка, скріпка, викрутка — кожен окремо, рівно, з полями |
| 4 | `items-soft.webp` | аркуш 5 предметів | М'які й легкі: пір'їнка, плюшевий ведмедик, яблуко, зелена книжка, смугаста шкарпетка — кожен окремо |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. A round magical observatory room with no gravity: books, an apple, a teddy bear, a feather and a sock float in the air among soft sparkles; a big red horseshoe magnet hangs on the ceiling and pulls a floating iron key and a spoon towards it. A boy in a yellow hoodie with a blue backpack floats upside down laughing, a princess with long purple hair and a crown in a purple dress floats holding her crown, a white-and-blue robot puppy paddles in the air. Keep the top third calm (domed ceiling with the magnet in the middle) and the bottom quarter plain floor.

**Промпт аркуша:**
> A game asset sheet separated by thin white lines. Left, tall vertical panel 2:3: [start-hero prompt]. Top right: a wooden signboard with an empty dark-blue panel, vines, a lantern on the right and a golden emblem with a horseshoe magnet and a small planet at the top center. Middle right, wide panel: a round magical observatory room with a starry window and small objects floating near the walls, completely empty space in the middle from ceiling to floor, no characters. Bottom right, on a plain white background, each object separate with space around it: a big red and silver horseshoe magnet with the ends pointing down; an iron key, a screw, a spoon, a paperclip, a screwdriver; a feather, a teddy bear, a red apple, a green book, a striped sock.

---

## 27. 🌀 Портал двох світів → `img/portal/`

Ліворуч — наш світ, праворуч — швидкий світ, де час іде вдвічі швидше; посередині крутиться портал, біля нього хлопчик. **Години на обох годинниках пише код, портал крутить код.**
Значок таблички — **кругла спіраль порталу**. `page-bg` — зала з порталом.

| # | Файл | Розмір | Що на ньому |
|---|---|---|---|
| 1 | `scene-bg.webp` | 1600 × 800 | **Ліва половина** — спокійний зелений сад під блакитним небом, **права половина** — фіолетово-зоряний «швидкий» світ із летючими островами; посередині — кам'яна арка без порталу; по обидва боки — **рівні порожні місця** для годинників |
| 2 | `portal.webp` | 400 × 400 | Кругла сяйна фіолетово-блакитна спіраль порталу, анфас, **симетрична** (код її крутить), без арки |
| 3 | `clock-calm.webp` | 300 × 340 | Затишний дерев'яний годинник «нашого світу», **циферблат без цифр і стрілок** |
| 4 | `clock-fast.webp` | 300 × 340 | Будильник «швидкого світу» з дзвіночками, трясеться, з рисками руху, **циферблат без цифр і стрілок** |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. A glowing swirling purple-and-blue portal inside a stone arch connects two worlds: on the left a calm green garden with a cozy wooden clock, on the right a fast purple starry world with floating islands and a shaking alarm clock. A boy in a yellow hoodie with a blue backpack steps into the portal, a princess with long purple hair and a crown in a purple dress holds his hand, a white-and-blue robot puppy jumps after them. Keep the top third mostly sky and the bottom quarter plain ground.

**Промпт аркуша:**
> A game asset sheet separated by thin white lines. Left, tall vertical panel 2:3: [start-hero prompt]. Top right: a wooden signboard with an empty dark-blue panel, vines, a lantern on the right and a golden emblem with a swirling portal at the top center. Middle right, wide panel: the left half a calm green garden under a blue sky, the right half a purple starry world with floating islands, an empty stone arch in the middle, empty flat ground on both sides, no portal, no characters. Bottom right, on a plain white background: a round glowing symmetric purple-and-blue portal swirl, front view, no arch; a cozy wooden clock with a blank face, no numbers, no hands; a shaking alarm clock with bells and motion lines, blank face, no numbers, no hands.

---

## 28. 🎚️ Чотири важелі → `img/chotyry-vazheli/`

Угорі — чотири лампи, унизу — чотири важелі; кожен важіль перемикає дві лампи. **Літери важелів, номери ламп, підписи дротів і те, яка лампа горить, — код.** Кожен предмет потрібен у двох станах.
Значок таблички — **важіль і лампочка**. `page-bg` — машинна зала.

| # | Файл | Розмір | Що на ньому |
|---|---|---|---|
| 1 | `scene-bg.webp` | 1600 × 800 | Машинна зала з трубами, зубчатими колесами й мідними панелями по краях (розмиті), **угорі посередині — порожня балка** (там висітимуть лампи), **унизу — рівний порожній пульт** (там стоятимуть важелі) |
| 2 | `lamp-off.webp` | 260 × 300 | Скляна лампа-куля в мідній оправі, **вимкнена**, анфас |
| 3 | `lamp-on.webp` | 260 × 300 | Та сама лампа **увімкнена**, сяє теплим жовтим |
| 4 | `lever-down.webp` | 200 × 300 | Мідний важіль із червоною ручкою на круглій основі, **ручка відхилена ліворуч-донизу** |
| 5 | `lever-up.webp` | 200 × 300 | Той самий важіль, **ручка відхилена праворуч-догори** |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. A magical machine hall with copper pipes and gears; four big glass bulb lamps hang in a row on a beam, two of them glowing warm yellow, connected by sparkling wires to four copper levers with red handles on a control panel below. A boy in a yellow hoodie with a blue backpack pulls a lever, a princess with long purple hair and a crown in a purple dress points at a glowing lamp, a white-and-blue robot puppy's eyes light up. Keep the top third calm (ceiling beam with the lamps) and the bottom quarter plain floor.

**Промпт аркуша:**
> A game asset sheet separated by thin white lines. Left, tall vertical panel 2:3: [start-hero prompt]. Top right: a wooden signboard with an empty dark-blue panel, vines, a lantern on the right and a golden emblem with a lever and a light bulb at the top center. Middle right, wide panel: a machine hall with blurred copper pipes and gears at the sides, an empty beam at the top middle and an empty flat control panel at the bottom, no lamps, no levers, no characters. Bottom right, on a plain white background: a glass bulb lamp in a copper holder, switched off, front view; the same lamp switched on, glowing warm yellow; a copper lever with a red handle on a round base, handle tilted down to the left; the same lever with the handle tilted up to the right.

---

## 29. 🔐 Код стародавніх воріт → `img/kod-vorit/`

Стародавні ворота замкнені кодом із трьох цифр; під ними — кам'яні таблички-підказки. Після перевороту ворота читають код навпаки. **Цифри коду й текст підказок пише код.**
Значок таблички — **кодовий замок із трьома віконцями**. `page-bg` — руїни з воротами в лісі.

| # | Файл | Розмір | Що на ньому |
|---|---|---|---|
| 1 | `scene-bg.webp` | 1600 × 900 | Стародавні руїни в чарівному лісі: моховиті колони, руни й ліани по краях, **верхня половина посередині — порожнє місце для воріт, нижня половина — рівна кам'яна стіна** (туди код ставить таблички-підказки) |
| 2 | `gate.webp` | 600 × 480 | Стародавні кам'яні ворота, **зачинені**, анфас; угорі — замок-медальйон, під ним у ряд **три порожні темні віконця** для цифр |
| 3 | `gate-open.webp` | 600 × 480 | Ті самі ворота **відчинені**, з арки ллється світло, віконця сяють |
| 4 | `plaque.webp` | 700 × 120 | Одна довга кам'яна табличка з рунічним орнаментом по краю, **порожня посередині** (туди код пише підказку) |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. Ancient mossy stone gates in a magical forest, locked with a big code lock with three empty glowing windows; old stone tablets with rune borders lean against the wall below. A boy in a yellow hoodie with a blue backpack reads a tablet thoughtfully, a princess with long purple hair and a crown in a purple dress turns a stone dial, a white-and-blue robot puppy sniffs the lock. Keep the top third mostly sky and treetops and the bottom quarter plain stone ground.

**Промпт аркуша:**
> A game asset sheet separated by thin white lines. Left, tall vertical panel 2:3: [start-hero prompt]. Top right: a wooden signboard with an empty dark-blue panel, vines, a lantern on the right and a golden emblem with a code lock with three small windows at the top center. Middle right, wide panel: ancient ruins in a magical forest with mossy columns and vines at the sides, an empty space for a gate in the upper middle and a plain flat stone wall in the lower half, no characters. Bottom right, on a plain white background: ancient stone gates, closed, front view, with a lock medallion at the top and three empty dark windows in a row below it; the same gates open with light pouring out and the windows glowing; one long stone tablet with a rune border and an empty blank middle.

---

## 30. 💜 Серце Світу навиворіт → `img/sertse-svitu/`

Фінал усієї серії. Посередині — велике кристалічне Серце; під ним три кристали (числа, лампи, слова), що засвічуються по одному; угорі праворуч — три маленькі лампи. **Назви кристалів і номери ламп пише код; лампи беру з «Чотирьох важелів».**
Значок таблички — **фіолетове кристалічне серце**. `page-bg` — зала Серця.

| # | Файл | Розмір | Що на ньому |
|---|---|---|---|
| 1 | `scene-bg.webp` | 1600 × 800 | Чарівна зала Серця: кристалічні колони, летючі острівці й зоряне фіолетове небо по краях, **посередині — порожній круглий п'єдестал** (над ним буде серце), **унизу — рівна підлога** |
| 2 | `heart-sleep.webp` | 400 × 400 | Велике кристалічне серце, **тьмяне й сонне**, сіро-фіолетове |
| 3 | `heart-awake.webp` | 400 × 400 | Те саме серце **прокинулось** — яскраво сяє фіолетовим і золотим, навколо іскри |
| 4 | `gem-off.webp` | 220 × 260 | Один кристал-ромб, **згаслий**, сірий |
| 5 | `gem-on.webp` | 220 × 260 | Той самий кристал **засвічений** золотом |
| 6 | `celebration.webp` | 1024 × 1536 | **Бажано:** фінальна картинка серії — Серце сяє, світ навколо стає на місце (замок перевертається правильно), герої радіють разом із чарівником |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. The magical Heart of the Upside-Down World: a huge sleeping purple crystal heart floats above a round pedestal in a hall of crystal columns under a starry purple sky with floating islands; below it three dim crystals wait to be lit. A boy in a yellow hoodie with a blue backpack, a princess with long purple hair and a crown in a purple dress and a white-and-blue robot puppy look up at the heart in awe. Keep the top third calm starry sky and the bottom quarter plain floor.

**Промпт аркуша:**
> A game asset sheet separated by thin white lines. Left, tall vertical panel 2:3: [start-hero prompt]. Top right: a wooden signboard with an empty dark-blue panel, vines, a lantern on the right and a golden emblem with a glowing purple crystal heart at the top center. Middle right, wide panel: a magical hall with crystal columns, floating islands and a starry purple sky at the sides, an empty round pedestal in the middle and a plain floor at the bottom, no heart, no characters. Bottom right, on a plain white background: a big crystal heart, dim, sleepy and grey-purple; the same heart awake, glowing bright purple and gold with sparkles; one rhombus crystal, dim and grey; the same crystal glowing gold.

**Промпт `celebration` (окремо, бажано):**
> Vertical 2:3 celebration screen, the grand finale. The giant purple crystal heart shines brightly, and the whole upside-down world turns right side up around it: the castle flips back onto the ground, floating islands settle, colorful sparkles and confetti fill the sky. A kind old wizard in a starry robe smiles, a boy in a yellow hoodie with a blue backpack and a princess with long purple hair and a crown in a purple dress jump with joy, a white-and-blue robot puppy spins happily. Keep the top third sky and the bottom quarter plain ground.

---

## Фони сторінок — окремим аркушем

> A game asset sheet of five vertical 9:16 calm game backgrounds side by side, each panel tall 1080 × 1920, separated by thin white lines, no characters, nothing important in the center of each panel, soft blurred depth, all at the magical edge of the upside-down world: 1) a round observatory room with no gravity and small objects floating near the walls; 2) a stone hall with a glowing portal arch, half green garden and half purple starry world; 3) a machine hall with copper pipes, gears and glowing lamps; 4) ancient mossy ruins with stone gates in a magical forest; 5) a crystal hall under a starry purple sky with floating islands. Cute stylized 3D children's fantasy game art, soft warm lighting, bright saturated colors, rounded shapes. No text, no letters, no numbers.

## Порада

- **Цифри й букви** генератори люблять дописувати самі — на годинниках, віконцях воріт, табличках і кристалах. Їх не має бути. Якщо з'являться, я зітру, але чисті картинки кращі.
- **Пари «до / після»** (лампа, важіль, ворота, серце, кристал) — однакового розміру й з того самого ракурсу, щоб при перемиканні нічого не стрибало.
- **Портал** — круглий і симетричний: код його обертає.
- **Предмети для невагомості** — кожен окремо, з полями: я розріжу аркуш на десять картинок.

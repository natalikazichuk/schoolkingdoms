# 🌷 Розділ IV «Сад неможливого» — картинки для ігор

Усі п'ять ігор розділу поки на емодзі. Для кожної потрібні заставка, табличка з назвою, фон сцени, предмети й фон сторінки.

| № | Гра | Файл | Папка для картинок |
|---|---|---|---|
| 16 | 🪨 Камені зі знаками | `kameni.html` | `img/kameni/` |
| 17 | ⚗️ Лабораторія навпаки | `laboratoriya.html` | `img/laboratoriya/` |
| 18 | 🌷 Сад кольорів | `sad-koloriv.html` | `img/sad-koloriv/` |
| 19 | ⭐ Зоряна карта | `zoryana-karta.html` | `img/zoryana-karta/` |
| 20 | ⚙️ Шестерні | `shesterni.html` | `img/shesterni/` |

Найзручніше, як у розділі III, **одним аркушем на гру**: ліворуч заставка, праворуч табличка, фон сцени й предмети на білому, розділені тонкими білими лініями. **Фони сторінок** — окремим аркушем, чотири-п'ять вертикальних панелей поруч. Я сама розріжу й приберу тло.

## Не треба малювати

- Сувій, лупу, кнопку ➜, дерев'яні кнопки, стрічку для фіналу — беру з розділів I–III.
- Числа на каменях, крапки й зірочки, що рахує гра, кольори рідин і пелюсток, кількість зубців — **усе це малює код**. На картинках їх не має бути.

## Загальні вимоги

- `.webp` або `.png`. **Без тексту, букв і цифр.**
- Предмети — на білому тлі (не «шахівниця»), з полями по краях, без тіні на землі.
- Окремої «навиворіт»-версії не треба: фіолетовий тон і перевороти роблю в коді.
- **Герої ті самі:** хлопчик у жовтій худі з синім рюкзаком, дівчинка-принцеса з довгим фіолетовим волоссям і короною, у фіолетовій сукні, собака-робот біло-блакитний. Генеруй від `budynok-yakoho-nemaye/start-hero.webp` (reference).
- **Місце дії розділу** — чарівний сад біля замку: клумби, оранжерея, кам'яні стежки, обсерваторія й вітряк. Ті самі замок і небо на горизонті, що в розділах I–III.

**Спільний стиль — у кінець кожного промпту:**
> Cute stylized 3D children's fantasy game art, soft warm lighting, bright saturated colors, rounded shapes, high detail, same style as the reference image. No text, no letters, no numbers.

## Однакове для кожної гри

| Файл | Розмір | Що на ньому |
|---|---|---|
| `start-hero.webp` | 1024 × 1536 | Заставка. Верхня ⅓ — спокійне небо (там табличка), нижня ¼ — рівна стежка чи трава (там сувій), герої й головний предмет — посередині |
| `title-frame.webp` | 1080 × 544 | Дерев'яна табличка з темно-синім **порожнім** полем, ліани, ліхтарик праворуч, угорі — золотий медальйон зі значком гри |
| `page-bg.webp` | 1080 × 1920 | Фон сторінки: та сама місцевість, спокійна, без героїв, нічого важливого посередині |

**Промпт `title-frame` (міняй лише значок):**
> A wooden signboard with an empty dark-blue center panel, wrapped in green vines and leaves, a small glowing lantern hanging on the right, a golden round emblem at the top center showing [ICON]. Front view, centered.

**Промпт `page-bg` (міняй лише місце):**
> Vertical 9:16 calm game background, [PLACE] in a magical castle garden, soft blurred depth, no characters, nothing important in the center, gentle light.

---

## 16. 🪨 Камені зі знаками → `img/kameni/`

Стежка з п'яти каменів, на кожному число й крапки-квадрат, що світяться (1 · 4 · 9 · 16 · ?). Після перевороту стежка йде назад. **Числа й крапки малює код**, камені — порожні.
Значок таблички — **камінь із сяйною руною**. `page-bg` — кам'яне коло з рунами в саду.

**Стан:** ✅ у грі: `start-hero` (старт і фон фіналу), `title-frame` — табличка художника, `scene-bg` — сад із кам'яним колом (камені стоять на бруківці), `stone` / `stone-glow` — камені стежки (число й крапки пише код, камінь із «?» світиться); на фіналі — світний камінь. Ще чекаю: `page-bg`.

| # | Файл | Розмір | Що на ньому |
|---|---|---|---|
| 1 | `scene-bg.webp` | 1600 × 800 | Сад із кам'яним колом-кромлехом на горизонті; **знизу через усю ширину — рівна моховита стежка** (нижні ~45 %), на ній нічого немає |
| 2 | `stone.webp` | 300 × 360 | Один гладкий сірий камінь-плита, стоїть, **порожня** верхня грань (туди код пише число й крапки) |
| 3 | `stone-glow.webp` | 300 × 360 | Той самий камінь, що світиться золотом (камінь із «?») |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. A mossy garden path paved with large smooth magical stones that glow softly with golden dots, leading to a circle of tall standing stones with glowing runes in a magical castle garden. A boy in a yellow hoodie with a blue backpack steps from stone to stone counting, a princess with long purple hair and a crown in a purple dress points at the last glowing stone, a white-and-blue robot puppy sniffs a stone. Keep the top third mostly sky and the bottom quarter plain mossy path.

**Промпт аркуша:**
> A game asset sheet separated by thin white lines. Left, tall vertical panel 2:3: [start-hero prompt]. Top right: a wooden signboard with an empty dark-blue panel, vines, a lantern on the right and a golden emblem with a small stone with a glowing rune at the top center. Middle right, wide panel: a magical garden with a stone circle on the horizon and an empty mossy path across the whole bottom half, no characters. Bottom right, on a plain white background: one smooth grey standing stone with a blank flat face; the same stone glowing gold.

---

## 17. ⚗️ Лабораторія навпаки → `img/laboratoriya/`

Машина змішує дві рідини в третю (🔴 + 🔵 → 🟡); після перевороту — розділяє. **Колби й рідини малює код** (колір змінюється), тому потрібна лише машина й сама колба — **порожня**.
Значок таблички — **колба з бульбашками**. `page-bg` — скляна оранжерея-лабораторія.

| # | Файл | Розмір | Що на ньому |
|---|---|---|---|
| 1 | `scene-bg.webp` | 1600 × 800 | Скляна оранжерея з полицями колб (розмиті), **посередині — порожній кам'яний стіл** через усю ширину |
| 2 | `machine.webp` | 500 × 500 | Казкова латунна машина-змішувач з трубками, вентилями й віконцем, анфас, **без рідин усередині** |
| 3 | `flask.webp` | 200 × 300 | Одна скляна колба, **порожня й прозора** |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. A magical glass greenhouse laboratory with bubbling flasks on shelves; in the middle a whimsical brass mixing machine with pipes and valves pours a red and a blue liquid in and a yellow liquid comes out. A boy in a yellow hoodie with a blue backpack holds a flask in surprise, a princess with long purple hair and a crown in a purple dress watches through goggles, a white-and-blue robot puppy sniffs a bubble. Keep the top third calm (glass roof) and the bottom quarter plain floor.

**Промпт аркуша:**
> A game asset sheet separated by thin white lines. Left, tall vertical panel 2:3: [start-hero prompt]. Top right: a wooden signboard with an empty dark-blue panel, vines, a lantern on the right and a golden emblem with a bubbling flask at the top center. Middle right, wide panel: a glass greenhouse laboratory with blurred shelves of flasks and an empty stone table across the middle, no characters. Bottom right, on a plain white background: a whimsical brass mixing machine with pipes and valves, front view, empty inside; one empty clear glass flask.

---

## 18. 🌷 Сад кольорів → `img/sad-koloriv/`

Кожна краплина роси міняє колір квітки по колу (🔴 → 🔵 → 🟡); після перевороту — у зворотний бік. **Пелюстки фарбує код**, тож потрібні стебло з листям і окремо **біла** квітка.
Значок таблички — **квітка з краплиною роси**. `page-bg` — клумби саду.

| # | Файл | Розмір | Що на ньому |
|---|---|---|---|
| 1 | `scene-bg.webp` | 1600 × 800 | Королівський сад: круглі клумби червоних, синіх і жовтих квітів по краях, **посередині — порожня ділянка трави** |
| 2 | `stem.webp` | 300 × 500 | Стебло з двома листками **без квітки**, стоїть прямо |
| 3 | `flower-white.webp` | 400 × 400 | Голівка квітки з п'ятьма пелюстками **чисто білого кольору** й жовтою серединкою, анфас (код її фарбує) |
| 4 | `drop.webp` | 150 × 200 | Блискуча краплина роси |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. A royal magic garden with round flower beds of red, blue and yellow flowers; in the middle one big magical flower changes color as a sparkling dewdrop falls on it. A boy in a yellow hoodie with a blue backpack holds a tiny watering can, a princess with long purple hair and a crown in a purple dress claps, a white-and-blue robot puppy sniffs the flower. Keep the top third mostly sky and the bottom quarter plain grass.

**Промпт аркуша:**
> A game asset sheet separated by thin white lines. Left, tall vertical panel 2:3: [start-hero prompt]. Top right: a wooden signboard with an empty dark-blue panel, vines, a lantern on the right and a golden emblem with a flower and a dewdrop at the top center. Middle right, wide panel: a royal garden with flower beds at the edges and an empty patch of grass in the middle, no characters. Bottom right, on a plain white background: a straight green flower stem with two leaves and no flower; a flower head with five pure white petals and a yellow center, front view; a sparkling dewdrop.

---

## 19. ⭐ Зоряна карта → `img/zoryana-karta/`

Звіздар показує сузір'я-трикутники (1 · 3 · 6 · 10 · ?); після перевороту — з кінця. **Зірки сузір'їв і числа малює код**, тому небо на фоні має бути **без яскравих зірок посередині**.
Значок таблички — **телескоп із зіркою**. `page-bg` — обсерваторія вночі.

| # | Файл | Розмір | Що на ньому |
|---|---|---|---|
| 1 | `scene-bg.webp` | 1600 × 800 | Нічне небо над садом: темно-синє, **майже без зірок** (лише ледь помітні), унизу силуети дерев і купол обсерваторії |
| 2 | `astronomer.webp` | 400 × 500 | Звіздар — добрий старий у мантії з зірками й окулярах, із сувоєм-картою, по пояс |
| 3 | `telescope.webp` | 400 × 400 | Бажано: латунний телескоп на треножнику (прикраса фіналу) |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. A small observatory with a domed roof in a magical garden at night; glowing star constellations shaped like triangles shine in the dark blue sky. A kind old astronomer in a starry robe and glasses unrolls a star map. A boy in a yellow hoodie with a blue backpack looks through a brass telescope, a princess with long purple hair and a crown in a purple dress points at the stars, a white-and-blue robot puppy's eyes glow. Keep the top third night sky and the bottom quarter plain garden path.

**Промпт аркуша:**
> A game asset sheet separated by thin white lines. Left, tall vertical panel 2:3: [start-hero prompt]. Top right: a wooden signboard with an empty dark-blue panel, vines, a lantern on the right and a golden emblem with a telescope and a star at the top center. Middle right, wide panel: a dark blue night sky over a garden with tree silhouettes and an observatory dome at the bottom, almost no stars in the sky, no characters. Bottom right, on a plain white background: a kind old astronomer in a starry robe with glasses holding a scroll, waist-up; a brass telescope on a tripod.

---

## 20. ⚙️ Шестерні → `img/shesterni/`

Велика шестерня (8 зубців) крутить малу (4 зубці); після перевороту — ланцюжок шестерень. **Шестерні крутить код**, тому потрібні дві окремі шестерні **анфас** з дірочкою посередині.
Значок таблички — **дві шестерні**. `page-bg` — майстерня у вітряку.

| # | Файл | Розмір | Що на ньому |
|---|---|---|---|
| 1 | `scene-bg.webp` | 1600 × 800 | Майстерня всередині вітряка: дерев'яні стіни, полиці з інструментами (розмиті), **посередині — порожня стіна** |
| 2 | `gear-big.webp` | 400 × 400 | Велика латунна шестерня, рівно **8 зубців**, анфас, з віссю посередині |
| 3 | `gear-small.webp` | 300 × 300 | Мала мідна шестерня, рівно **4 зубці**, анфас, з віссю посередині |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. A cozy workshop inside a windmill in a magical garden; big golden gears turn on the wall, a large one turning a small one in the opposite direction. A boy in a yellow hoodie with a blue backpack watches the gears with his head tilted, a princess with long purple hair and a crown in a purple dress counts teeth on her fingers, a white-and-blue robot puppy spins happily. Keep the top third calm (wooden beams) and the bottom quarter plain wooden floor.

**Промпт аркуша:**
> A game asset sheet separated by thin white lines. Left, tall vertical panel 2:3: [start-hero prompt]. Top right: a wooden signboard with an empty dark-blue panel, vines, a lantern on the right and a golden emblem with two meshing gears at the top center. Middle right, wide panel: the inside of a windmill workshop with wooden walls and blurred shelves of tools, an empty wall in the middle, no characters. Bottom right, on a plain white background: a large brass gear with exactly eight teeth, front view, with an axle in the center; a small copper gear with exactly four teeth, front view, with an axle in the center.

---

## Фони сторінок — окремим аркушем

> A game asset sheet of five vertical 9:16 calm game backgrounds side by side, separated by thin white lines, no characters, nothing important in the center of each panel, soft blurred depth: 1) a ring of standing stones with glowing runes in a magical castle garden; 2) a glass greenhouse laboratory with shelves of colorful flasks; 3) round flower beds of red, blue and yellow flowers in a royal garden; 4) a small observatory with a domed roof under a starry night sky; 5) a cozy workshop inside a windmill with big golden gears. Cute stylized 3D children's fantasy game art, soft warm lighting, bright saturated colors, rounded shapes. No text, no letters, no numbers.

## Порада

- **Числа, крапки, кольори й зірки** генератори люблять дописувати самі. На каменях, колбах, білій квітці й нічному небі їх не має бути. Якщо з'являться, я зітру, але чисті картинки кращі.
- **Шестерні:** перевір кількість зубців — 8 і 4. Від цього залежить правило гри.
- **Біла квітка** — саме біла, бо колір їй дає код.

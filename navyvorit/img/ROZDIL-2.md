# 🏙️ Розділ II «Вулиці навпаки» — картинки для ігор

У розділі сім пунктів. Готова тільки **🗿 Площа з пам'ятниками** (`ploshcha/`, ✅ усе в грі). Решта шість ігор поки на емодзі:

| № | Гра | Файл | Папка для картинок |
|---|---|---|---|
| 6 | 🚌 Автобус №0 | `avtobus-0.html` | `img/avtobus-0/` |
| 7 | ✉️ Пошта-перевертень | `poshta.html` | `img/poshta/` |
| 8 | 🔦 Ліхтарі | `lihtari.html` | `img/lihtari/` |
| 9 | 🕰️ Годинник без часу | `hodynnykova-vezha.html` | `img/hodynnykova-vezha/` |
| 10 | 🏪 Дивний магазин | `dyvnyi-mahazyn.html` | `img/dyvnyi-mahazyn/` |
| ★ | 🧹 Двірник | `dvirnyk.html` | `img/dvirnyk/` |

Склади файли в ці папки **саме з такими назвами**, і я підключу їх. Стартові екрани й фінали зроблю як у розділі I (спільні `nav-scroll.css` / `nav-scroll.js`).

## Не треба малювати — беру з розділу I

Сувій `scroll.webp`, лупа `magnifier.webp`, кругла кнопка зі стрілкою `go-btn.webp`, дерев'яні кнопки `btn-wood-square.webp` і `btn-wood-long.webp` (усі з `budynok-yakoho-nemaye/`), стрічка для фіналу `vorota/ribbon.webp`.
Також не малюй: номери, ціни, час на годинниках, лічильники, кнопки й підписи. Усе це пише код.

## Загальні вимоги

- `.webp` або `.png`. **Без тексту, букв і цифр** (навіть на табличках, конвертах і вивісках, бо там номери ставить код).
- 🫥 — справжній прозорий фон (не намальована «шахівниця»), без тіні на землі.
- Окремої «навиворіт»-версії не треба: фіолетовий тон і перевороти роблю в коді.
- **Герої ті самі, що в розділі I:** хлопчик у жовтій худі з синім рюкзаком, дівчинка-принцеса з довгим фіолетовим волоссям і короною, у фіолетовій сукні, собака-робот біло-блакитний. Найкраще генерувати від `budynok-yakoho-nemaye/start-hero.webp` (image-to-image / reference).
- **Місце дії розділу** — одне казкове місто: бруківка, будиночки з черепичними дахами, ліхтарі, на горизонті — замок і вежа з годинником. Усі шість заставок мають виглядати як різні вулиці **одного** міста.

**Спільний стиль — додавай у кінець кожного промпту:**
> Cute stylized 3D children's fantasy game art, soft warm lighting, bright saturated colors, rounded shapes, high detail, same style as the reference image. No text, no letters, no numbers.

Для 🫥 ще додай:
> Isolated on a fully transparent background, no ground shadow, no frame.

## Однакове для кожної гри (3 картинки)

| Файл | Розмір | Фон | Що на ньому |
|---|---|---|---|
| `start-hero.webp` | 1000 × 1500 | суцільний | Заставка на весь екран. Верхня ⅓ — спокійне небо або стіна (там буде табличка з назвою), нижня ¼ — рівна бруківка чи підлога (там буде сувій із загадкою), герої й головний предмет — посередині |
| `title-frame.webp` 🫥 | 1080 × 544 | прозорий | Дерев'яна табличка з темно-синім **порожнім** полем, ліани й листя, ліхтарик праворуч, угорі — золотий значок гри (який — написано біля кожної гри). Як `kit/title-frame.webp` |
| `page-bg.webp` | 1080 × 1920 | суцільний | Фон сторінки під час гри: та сама місцевість, що на заставці, але спокійна, без героїв і дрібних деталей посередині (поверх лягають кнопки) |

**Промпт `title-frame` (міняй лише значок):**
> A wooden signboard with an empty dark-blue center panel, wrapped in green vines and leaves, a small glowing lantern hanging on the right, a golden round emblem at the top center showing [ICON]. Front view, centered.

**Промпт `page-bg` (міняй лише місце):**
> Vertical 9:16 calm game background, [PLACE] in a cozy fairy-tale town, soft blurred depth, no characters, nothing important in the center, gentle light.

---

## 6. 🚌 Автобус №0 → `img/avtobus-0/`

Автобус їде дорогою від зупинки до зупинки (4–7 зупинок, номери ставить код); після перевороту — у зворотний бік, а останній рейс приїжджає в депо 0.
Значок таблички — **маленький автобус**. `page-bg` — заміська дорога до міста.

| # | Файл | Розмір | Фон | Що на ньому |
|---|---|---|---|---|
| 1 | `scene-bg.webp` | 1600 × 800 | суцільний | Передмістя вдень: небо з хмарками, далеко за річкою — Дивне місто з замком, зелений луг. **Пряма дорога через усю ширину** на висоті ≈ 55–70 % від верху, без розмітки й без зупинок |
| 2 | `bus.webp` 🫥 | 600 × 400 | прозорий | Жовтий міський автобусик **збоку, носом праворуч**, видно колеса й віконця, порожня табличка для номера над лобовим склом |
| 3 | `depot.webp` 🫥 | 500 × 400 | прозорий | Маленьке автобусне депо з великими воротами |
| 4 | `stop-sign.webp` 🫥 | 300 × 420 | прозорий | Табличка зупинки на стовпчику з **порожнім білим кругом** угорі (туди впишу номер) |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. A small cute yellow bus waits at a countryside bus stop with a blue roof and a bench; a road leads over a stone bridge toward a whimsical fairy-tale town with a castle on the horizon. A boy in a yellow hoodie with a blue backpack holds up a golden ticket, a princess with long purple hair and a crown in a purple dress waves, a white-and-blue robot puppy sits on the bench. Keep the top third mostly sky and the bottom quarter plain road.

**Промпт `scene-bg`:**
> Wide 2:1 game scene, a sunny countryside with green meadows and a river; far away a whimsical town with a castle. One straight empty road crosses the whole picture horizontally at about 60% height, no markings, no bus stops, no vehicles, no characters.

**Промпт `bus` / `depot` / `stop-sign`:**
> A cute cartoon yellow city bus, side view facing right, round wheels, big windows, an empty blank route sign above the windshield, centered.
> A small cartoon bus depot garage with a big arched door and a flat roof, front view, centered.
> A cartoon bus stop sign on a thin pole with an empty white circle on top, front view, centered.

---

## 7. ✉️ Пошта-перевертень → `img/poshta/`

Листоноша несе лист від пошти (ліворуч) до будинку (праворуч), але номер «перевертається»: №12 → №21. Над будинком — табличка з номером (її малює код і перевертає догори дриґом).
Значок таблички — **конверт із крильцями**. `page-bg` — вулиця біля пошти.

| # | Файл | Розмір | Фон | Що на ньому |
|---|---|---|---|---|
| 1 | `scene-bg.webp` | 1600 × 800 | суцільний | Вулиця вдень: бруківка внизу (нижні ~40 %), небо й дахи вдалині. **Ліва й права третини — порожні** (туди ставлю пошту й будинок) |
| 2 | `post.webp` 🫥 | 500 × 500 | прозорий | Казкова пошта: синій дах, поштова скринька біля входу, над дверима — конверт із крильцями (без букв) |
| 3 | `house.webp` 🫥 | 500 × 500 | прозорий | Затишний будиночок з поштовою скринькою; над дверима — **порожня** синя табличка для номера |
| 4 | `letter.webp` 🫥 | 300 × 220 | прозорий | Конверт із крильцями й сургучною печаткою (без адреси) |
| 5 | `postman.webp` 🫥 | 400 × 500 | прозорий | Бажано: листоноша-голуб у синьому кашкеті з сумкою, повний зріст, обличчям праворуч |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. A whimsical fairy-tale post office with a blue roof; winged envelopes fly out of its chimney and swirl in the air, some flying the wrong way. A pigeon mail carrier in a blue cap with a mail bag looks puzzled. A boy in a yellow hoodie with a blue backpack, a princess with long purple hair and a crown in a purple dress, and a white-and-blue robot puppy watch a letter land at the wrong house. Keep the top third mostly sky and the bottom quarter plain cobblestone.

**Промпт `post` / `house` / `letter`:**
> A cute cartoon fairy-tale post office building with a blue roof, a red mailbox by the door and a winged envelope emblem above the door, front view, centered.
> A cute cartoon cottage with a red tiled roof, a mailbox by the door and an empty blank blue plate above the door, front view, centered.
> A cartoon envelope with small white feathered wings and a red wax seal, no writing, centered.

---

## 8. 🔦 Ліхтарі → `img/lihtari/`

Ніч. Унизу ряд ліхтарів (2–4, кількість змінює код), над ними цегляна стіна з двома віконцями й двома **прихованими дверцятами** (видно, лише коли світло правильне). Спершу вимкнеш ліхтар — стає світліше; після перевороту навпаки.
Значок таблички — **ліхтар із місяцем**. `page-bg` — нічна вулиця з зорями.

| # | Файл | Розмір | Фон | Що на ньому |
|---|---|---|---|---|
| 1 | `scene-bg.webp` | 1600 × 900 | суцільний | Нічна вулиця: темно-синє небо з місяцем і зорями; у верхній половині — **цегляна стіна будинку** з двома маленькими теплими віконцями; унизу бруківка. **Без ліхтарів і без дверей** (ставлю в коді) |
| 2 | `lamp-on.webp` 🫥 | 220 × 500 | прозорий | Старовинний вуличний ліхтар на чавунному стовпі, **горить** теплим світлом |
| 3 | `lamp-off.webp` 🫥 | 220 × 500 | прозорий | **Той самий** ліхтар, вимкнений (скло темне). Однаковий розмір і ракурс з `lamp-on` |
| 4 | `secret-door.webp` 🫥 | 300 × 400 | прозорий | Маленькі арочні дерев'яні дверцята в цеглі, ледь прочинені, з-за них — золоте сяйво |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. A cozy fairy-tale street at night under a big moon and stars. A row of old iron street lanterns: the one that is switched off makes the brick wall behind it glow brighter and reveals a small hidden arched door with golden light. A boy in a yellow hoodie with a blue backpack reaches for a lantern switch, a princess with long purple hair and a crown in a purple dress holds a flashlight, a white-and-blue robot puppy's eyes glow softly. Keep the top third night sky and the bottom quarter plain cobblestone.

**Промпт `lamp-on` / `lamp-off`:**
> A single old-fashioned cast-iron street lantern on a tall pole, [glowing with warm yellow light / switched off with dark glass], front view, centered, full height.

**Промпт `secret-door`:**
> A small hidden arched wooden door set into a brick wall fragment, slightly open, warm golden light shining from inside, front view, centered.

---

## 9. 🕰️ Годинник без часу → `img/hodynnykova-vezha/`

На вежі ряд годинників показує час за закономірністю (10:00 → 11:00 → 12:00 → ?), дитина ставить стрілки на останньому. Після перевороту час іде назад. **Стрілки й цифри малює код**, тож на циферблатах їх не має бути.
Значок таблички — **кишеньковий годинник**. `page-bg` — головна площа з вежею.

| # | Файл | Розмір | Фон | Що на ньому |
|---|---|---|---|---|
| 1 | `tower-bg.webp` | 1000 × 1400 | суцільний | Фасад кам'яної годинникової вежі зблизька, стіна рівна й світла (на ній стоятимуть годинники в ряд), угорі — арка з дзвоном. **Без годинників на стіні** |
| 2 | `clock-face.webp` 🫥 | 400 × 400 | прозорий | Кругла золота рама годинника з кремовим **порожнім** циферблатом: без цифр, без поділок і без стрілок (усе в коді) |
| 3 | `gears.webp` 🫥 | 400 × 400 | прозорий | Бажано: купка золотих шестерень (прикраса фіналу) |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. A tall fairy-tale stone clock tower on the main town square; many clocks on its walls each show a different time, and one big clock in the middle spins its hands backwards with sparkles. A boy in a yellow hoodie with a blue backpack, a princess with long purple hair and a crown in a purple dress, and a white-and-blue robot puppy look up at it in surprise. Keep the top third mostly sky around the tower top and the bottom quarter plain cobblestone.

**Промпт `tower-bg`:**
> Close-up front view of a fairy-tale stone clock tower wall, warm sandstone blocks, an arch with a bronze bell at the top, a large empty flat wall area in the middle with no clocks, soft daylight.

**Промпт `clock-face`:**
> A round ornate golden clock frame with a plain empty cream clock face, no numbers, no tick marks, no hands, front view, centered.

---

## 10. 🏪 Дивний магазин → `img/dyvnyi-mahazyn/`

Продавець-чарівник 🧙‍♂️ продає навпаки (замість подвоєння повертає половину), а 🧪 зілля порушує правило — це «баг». Ціни й монети малює код.
Значок таблички — **пляшечка зілля**. `page-bg` — інтер'єр крамниці.

| # | Файл | Розмір | Фон | Що на ньому |
|---|---|---|---|---|
| 1 | `shop-bg.webp` | 1600 × 1000 | суцільний | Інтер'єр крамниці: дерев'яний прилавок унизу, за ним — полиці з дрібницями й баночками (розмиті), смугастий навіс над вікном. **Посередині прилавка — вільне місце** (там стоять товари з коду) |
| 2 | `seller.webp` 🫥 | 500 × 600 | прозорий | Продавець-чарівник: добрий старий у синьому капелюсі з зірками, хитро усміхається, руки на прилавку, до пояса |
| 3 | `item-apple.webp`, `item-toy.webp`, `item-key.webp`, `item-box.webp`, `item-potion.webp` 🫥 | 300 × 300 кожен | прозорий | Товари: червоне яблуко; плюшевий ведмедик; золотий ключ; загадкова подарункова коробка з бантом; фіолетове зілля в круглій пляшечці, що трохи іскрить. Однаковий ракурс і «вага» |
| 4 | `coin.webp` 🫥 | 200 × 200 | прозорий | Золота монета без цифр і букв |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. A cozy fairy-tale shop with a blue-and-white striped awning; behind the wooden counter a kind old wizard shopkeeper with a starry blue hat grins slyly. On the counter: a red apple, a teddy bear, a golden key, a gift box and a sparkling purple potion that glows strangely. Gold coins fly out of the cash box in the wrong direction. A boy in a yellow hoodie with a blue backpack, a princess with long purple hair and a crown in a purple dress, and a white-and-blue robot puppy stand at the counter. Keep the top third calm (awning and wall) and the bottom quarter plain floor.

**Промпт `seller`:**
> A kind old wizard shopkeeper with a long white beard and a blue hat with stars, sly friendly smile, hands resting on a counter edge, waist-up, front view, centered.

**Промпт товарів (одним аркушем):**
> A sprite sheet of five shop items in a row on a plain background, same size and lighting: a shiny red apple, a small teddy bear, a golden key, a gift box with a ribbon, a round bottle of glowing purple potion with sparkles. Front view.

---

## ★ 🧹 Двірник → `img/dvirnyk/`

Двірник підмітає вулицю, а сміття стає більше (🧹 +2, 🍌 −1); після перевороту навпаки. Сміття (6 видів) код розкидає по тротуару й прибирає.
Значок таблички — **мітла**. `page-bg` — тиха вулиця з клумбами.

| # | Файл | Розмір | Фон | Що на ньому |
|---|---|---|---|---|
| 1 | `scene-bg.webp` | 1600 × 800 | суцільний | Вулиця вдень: угорі (~40 %) — три різні будиночки (житловий, крамничка, будиночок двірника з кольоровими контейнерами), під ними бордюр, **унизу — широкий чистий тротуар** (≈ 60 % висоти, туди падає сміття) |
| 2 | `janitor.webp` 🫥 | 400 × 500 | прозорий | Двірник у помаранчевій жилетці й кашкеті з великою мітлою, повний зріст, **обличчям праворуч** (ходить по тротуару) |
| 3 | `trash-banana.webp`, `trash-paper.webp`, `trash-can.webp`, `trash-leaf.webp`, `trash-juice.webp`, `trash-apple.webp` 🫥 | 160 × 160 кожен | прозорий | Бананова шкурка, зім'ята газета (без букв), бляшанка, сухий кленовий листок, пакетик соку, огризок яблука. Милі, не огидні |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. A tidy fairy-tale street with a small janitor's hut, colorful recycling bins and flower boxes. A cheerful janitor in an orange vest sweeps with a big broom, but cute litter (banana peels, crumpled paper, cans, leaves) magically pops up behind every sweep. A boy in a yellow hoodie with a blue backpack holds a banana peel and thinks, a princess with long purple hair and a crown in a purple dress laughs, a white-and-blue robot puppy sniffs a can. Keep the top third mostly sky and the bottom quarter plain clean pavement.

**Промпт `janitor`:**
> A cheerful cartoon street janitor in an orange safety vest and a cap holding a big broom, full body, walking, side view facing right, centered.

**Промпт сміття (одним аркушем):**
> A sprite sheet of six cute cartoon litter items in a row on a plain background, same size and lighting: a banana peel, a crumpled newspaper without text, a dented soda can, a dry orange maple leaf, a small juice box, an apple core. Friendly, not dirty.

---

## Порада

- **Заставки** генеруй від `budynok-yakoho-nemaye/start-hero.webp`, щоб герої були ті самі. Можна горизонтально, як у розділі I: на телефоні я доповню небо зверху й підлогу знизу.
- **Дрібні предмети** однієї гри (товари, сміття, ліхтарі on/off) генеруй одним аркушем на однотонному фоні. Я сама їх розріжу й приберу фон.
- `lamp-on` і `lamp-off` мають бути **один ліхтар** у двох станах: зроби спершу `lamp-on`, потім попроси «той самий, але вимкнений» (image-to-image).
- Якщо на картинці все ж з'явилися букви чи цифри (часто на конвертах, вивісках і годинниках), не страшно: я їх зітру.

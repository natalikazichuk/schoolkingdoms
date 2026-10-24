# 🛤️ Розділ III «Квартал дивних шляхів» — картинки для ігор

Усі п'ять ігор розділу поки на емодзі. Для кожної потрібні заставка, табличка з назвою, фон сторінки й картинки самої сцени.

| № | Гра | Файл | Папка для картинок |
|---|---|---|---|
| 11 | ⏳ Пісочний годинник | `pisochnyi-hodynnyk.html` | `img/pisochnyi-hodynnyk/` |
| 12 | 🏦 Банк | `bank.html` | `img/bank/` |
| 13 | 🚂 Залізниця | `zaliznytsia.html` | `img/zaliznytsia/` |
| 14 | 🌉 Міст чисел | `mist-chysel.html` | `img/mist-chysel/` |
| 15 | 🎵 Музичний будинок | `muzychnyi-dim.html` | `img/muzychnyi-dim/` |

Можна, як у розділі II, **одним аркушем на гру**: заставка ліворуч, праворуч табличка, фон сцени й предмети, розділені тонкими білими лініями. Я сама розріжу аркуш і приберу фон з предметів. Готовий промпт для аркуша є біля кожної гри.

## Не треба малювати — беру з розділів I–II

Сувій `scroll.webp`, лупа `magnifier.webp`, кругла кнопка зі стрілкою `go-btn.webp`, дерев'яні кнопки `btn-wood-square.webp` і `btn-wood-long.webp` (усі з `budynok-yakoho-nemaye/`), стрічка для фіналу `vorota/ribbon.webp`.
Також не малюй числа, монети з номіналом, стрілки компаса, ноти з назвами, кнопки й підписи. Це все пише код.

## Загальні вимоги

- `.webp` або `.png`. **Без тексту, букв і цифр**, навіть на вивісках, дошках мосту й табличках, бо числа ставить код.
- 🫥 — прозорий фон. Можна й однотонний або «шахівницю», я все одно виріжу. Без тіні на землі.
- Окремої «навиворіт»-версії не треба: фіолетовий тон і перевороти роблю в коді.
- **Герої ті самі, що в розділах I–II:** хлопчик у жовтій худі з синім рюкзаком, дівчинка-принцеса з довгим фіолетовим волоссям і короною, у фіолетовій сукні, собака-робот біло-блакитний. Генеруй від `budynok-yakoho-nemaye/start-hero.webp` (image-to-image / reference).
- **Місце дії розділу** — інший квартал того самого казкового міста: вузькі звивисті вулички, сходи, арки, мости над каналами, а на горизонті той самий замок. Кожна заставка має виглядати як окрема вуличка цього кварталу.

**Спільний стиль — додавай у кінець кожного промпту:**
> Cute stylized 3D children's fantasy game art, soft warm lighting, bright saturated colors, rounded shapes, high detail, same style as the reference image. No text, no letters, no numbers.

Для 🫥 ще додай:
> Isolated on a fully transparent background, no ground shadow, no frame.

## Однакове для кожної гри (3 картинки)

| Файл | Розмір | Фон | Що на ньому |
|---|---|---|---|
| `start-hero.webp` | 1024 × 1536 | суцільний | Заставка на весь екран. Верхня ⅓ — спокійне небо або стіна (там буде табличка з назвою), нижня ¼ — рівна бруківка чи підлога (там буде сувій із загадкою), герої й головний предмет — посередині |
| `title-frame.webp` 🫥 | 1080 × 544 | прозорий | Дерев'яна табличка з темно-синім **порожнім** полем, ліани й листя, ліхтарик праворуч, угорі по центру — золотий круглий медальйон зі значком гри (який — написано біля кожної гри) |
| `page-bg.webp` | 1080 × 1920 | суцільний | Фон сторінки під час гри: та сама місцевість, що на заставці, але спокійна, без героїв, нічого важливого посередині (поверх лягають кнопки) |

**Промпт `title-frame` (міняй лише значок):**
> A wooden signboard with an empty dark-blue center panel, wrapped in green vines and leaves, a small glowing lantern hanging on the right, a golden round emblem at the top center showing [ICON]. Front view, centered.

**Промпт `page-bg` (міняй лише місце):**
> Vertical 9:16 calm game background, [PLACE] in a cozy fairy-tale town quarter with winding streets, soft blurred depth, no characters, nothing important in the center, gentle light.

---

## 11. ⏳ Пісочний годинник → `img/pisochnyi-hodynnyk/`

У Вежі часу стоїть чарівний пісочний годинник: у верхній колбі 100 піщинок, щохвилини 10 падає вниз (100 → 90 → 80…). Після перевороту годинник перекидається, і пісок «вертається» вгору. **Пісок у колбах малює код** (його рівень змінюється), тому годинник потрібен порожній.
Значок таблички — **маленький пісочний годинник**. `page-bg` — кімната у вежі часу.

**Стан:** ✅ у грі: `start-hero` (старт і фон фіналу), `title-frame` — табличка художника, `scene-bg` — кімната з постаментом, `hourglass` — годинник на постаменті (пісок у колбах малює код, у 🔄 годинник перекидається), `sand-pile` — на фінальному екрані. Ще чекаю: `page-bg`.

| # | Файл | Розмір | Фон | Що на ньому |
|---|---|---|---|---|
| 1 | `scene-bg.webp` | 1600 × 900 | суцільний | Кімната у вежі: кам'яні стіни, кругле вікно з небом, полиці з шестернями й годинниками (розмиті). **Посередині — порожній кам'яний постамент**, на якому стоятиме годинник |
| 2 | `hourglass.webp` 🫥 | 500 × 800 | прозорий | Великий пісочний годинник у різьбленій дерев'яній рамі із золотими кутиками, анфас, **колби порожні й прозорі** (без піску) |
| 3 | `sand-pile.webp` 🫥 | 300 × 200 | прозорий | Бажано: невелика купка золотого піску (прикраса фіналу) |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. A cozy round room at the top of a stone time tower; in the middle stands a huge magical hourglass in a carved wooden frame, golden sand flowing down with sparkles. Through a round window the fairy-tale town and castle are visible. A boy in a yellow hoodie with a blue backpack counts the falling grains on his fingers, a princess with long purple hair and a crown in a purple dress watches in wonder, a white-and-blue robot puppy sits by the pedestal. Keep the top third calm (wall and ceiling) and the bottom quarter plain stone floor.

**Промпт `hourglass`:**
> A large ornate hourglass in a carved wooden frame with golden corners and two twisted wooden posts, both glass bulbs completely empty and clear, no sand, front view, centered.

**Промпт аркуша (усе одним малюнком):**
> A game asset sheet separated by thin white lines. Left, tall vertical panel 2:3: [start-hero prompt]. Top right: a wooden signboard with an empty dark-blue panel, vines, a lantern on the right and a golden emblem with a small hourglass at the top center. Middle right, wide panel: a stone tower room with a round window, shelves with gears, and an empty stone pedestal in the middle, no characters. Bottom right, on a plain white background: a large ornate hourglass in a carved wooden frame with completely empty clear glass bulbs; a small pile of golden sand.

---

## 12. 🏦 Банк → `img/bank/`

На вході в банк напис «Не залишайте тут свої гроші», а нагороди отримують саме ті, хто залишає монети. Біля банку по черзі проходять шестеро відвідувачів: кіт, лис, сова, жабка, ведмідь і зайчик. **Напис на табличці пише код**, тому табличка порожня.
Значок таблички — **золота монета з крильцями** (без цифр). `page-bg` — площа перед банком.

**Стан:** ✅ у грі: `start-hero` (старт і фон фіналу), `title-frame` — табличка художника, `scene-bg` — банк (напис коду лежить на його порожній табличці над дверима), `visitor-cat / fox / owl / frog / bear / bunny` — відвідувачі йдуть бруківкою, `medal` і `coins` — на фінальному екрані. Ще чекаю: `page-bg`.

| # | Файл | Розмір | Фон | Що на ньому |
|---|---|---|---|---|
| 1 | `scene-bg.webp` | 1600 × 900 | суцільний | Площа перед казковим банком: будівля з колонами й куполом, широкі сходи, двері посередині. **Над дверима — порожня біла табличка** (туди код пише напис). Нижня третина — рівна бруківка, по ній ходять відвідувачі |
| 2 | `visitor-cat.webp`, `visitor-fox.webp`, `visitor-owl.webp`, `visitor-frog.webp`, `visitor-bear.webp`, `visitor-bunny.webp` 🫥 | 400 × 400 кожен | прозорий | Шестеро відвідувачів у повний зріст, **збоку, обличчям праворуч** (ідуть до банку), у тому самому стилі, з маленьким гаманцем чи торбинкою |
| 3 | `coins.webp` 🫥 | 300 × 300 | прозорий | Купка золотих монет без цифр |
| 4 | `medal.webp` 🫥 | 300 × 300 | прозорий | Золота медаль на синій стрічці (нагорода) |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. A grand fairy-tale bank with white columns and a golden dome on a sunny square; an empty blank sign hangs above the door. Animal visitors (a cat, a fox and an owl) line up with small purses; one of them proudly receives a golden medal. A boy in a yellow hoodie with a blue backpack holds a gold coin and thinks, a princess with long purple hair and a crown in a purple dress points at the sign, a white-and-blue robot puppy sniffs a pile of coins. Keep the top third mostly sky and the bottom quarter plain cobblestone.

**Промпт відвідувачів (одним аркушем):**
> A sprite sheet of six cute cartoon animal visitors in a row on a plain background, same size and lighting, each full body, walking, side view facing right, carrying a small purse: a ginger cat, a red fox, a wise owl, a green frog, a brown bear, a white bunny.

**Промпт аркуша:**
> A game asset sheet separated by thin white lines. Left, tall vertical panel 2:3: [start-hero prompt]. Top right: a wooden signboard with an empty dark-blue panel, vines, a lantern on the right and a golden emblem with a winged gold coin at the top center. Middle right, wide panel: a fairy-tale bank with columns and a dome, wide steps, an empty blank white sign above the door, plain cobblestone square in front, no characters. Bottom right, on a plain white background: six animal visitors walking to the right (cat, fox, owl, frog, bear, bunny), a pile of gold coins, a gold medal on a blue ribbon.

---

## 13. 🚂 Залізниця → `img/zaliznytsia/`

Потяг стоїть на поворотному колі вокзалу. Машиніст повертає його на чверть кола ліворуч або праворуч, а дитина каже, куди потяг дивиться. Після перевороту «кермо навиворіт», тобто «ліворуч» повертає праворуч. **Потяг код обертає**, тому його треба намалювати **згори** й носом **вгору**. Позначки сторін світу пише код.
Значок таблички — **паровозик**. `page-bg` — вокзал.

| # | Файл | Розмір | Фон | Що на ньому |
|---|---|---|---|---|
| 1 | `scene-bg.webp` | 1600 × 900 | суцільний | Вокзал, **вигляд згори**: трава й рейки, що розходяться в чотири боки (вгору, вниз, ліворуч, праворуч). **Посередині — порожнє місце** під поворотне коло |
| 2 | `turntable.webp` 🫥 | 600 × 600 | прозорий | Кругле поворотне коло **згори**: дерев'яний або кам'яний круг з рейками через центр, металевий обідок. Без потяга |
| 3 | `train-top.webp` 🫥 | 300 × 500 | прозорий | Маленький паровозик **строго згори**, **носом угору**, яскравий (червоний із золотом), з димарем |
| 4 | `conductor.webp` 🫥 | 400 × 500 | прозорий | Бажано: машиніст у синьому кашкеті, по пояс, усміхнений |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. A cozy fairy-tale railway station with a round turntable in front; a small red-and-gold steam locomotive stands on it, puffing cute clouds of steam, curvy rails lead in different directions. A friendly conductor in a blue cap turns a big wheel. A boy in a yellow hoodie with a blue backpack points left, a princess with long purple hair and a crown in a purple dress points right, a white-and-blue robot puppy tilts its head, confused. Keep the top third mostly sky and the bottom quarter plain platform.

**Промпт `turntable` / `train-top`:**
> A round railway turntable seen strictly from above, wooden deck with one rail track through the center, metal rim, no train, centered.
> A cute cartoon red-and-gold steam locomotive seen strictly from directly above, front pointing up, centered.

**Промпт аркуша:**
> A game asset sheet separated by thin white lines. Left, tall vertical panel 2:3: [start-hero prompt]. Top right: a wooden signboard with an empty dark-blue panel, vines, a lantern on the right and a golden emblem with a small steam locomotive at the top center. Middle right, wide panel: a top-down view of a railway yard with grass and four rail tracks leading up, down, left and right, an empty round spot in the middle. Bottom right, on a plain white background: a round railway turntable seen from above with no train; a red-and-gold steam locomotive seen strictly from above, front pointing up; a smiling conductor in a blue cap, waist-up.

---

## 14. 🌉 Міст чисел → `img/mist-chysel/`

Через річку веде чарівний міст із шести дощок, і на кожній число (3 · 6 · 5 · 10 · 9 · ?). Дитина знаходить правило й проходить мостом. **Числа на дошках пише код**, тому дошки порожні.
Значок таблички — **кам'яний арковий міст**. `page-bg` — набережна з каналом.

| # | Файл | Розмір | Фон | Що на ньому |
|---|---|---|---|---|
| 1 | `scene-bg.webp` | 1600 × 800 | суцільний | Річка або канал між двома зеленими берегами, вид збоку. **Посередині через усю ширину — порожнє місце для моста** (на висоті ≈ 45–60 %), на берегах — кам'яні опори моста. Без самого настилу |
| 2 | `plank.webp` 🫥 | 300 × 220 | прозорий | Одна дерев'яна дошка-сходинка моста (вид збоку, трохи згори), **порожня**, на мотузках |
| 3 | `plank-magic.webp` 🫥 | 300 × 220 | прозорий | Та сама дошка, але світиться золотом (дошка з «?») |
| 4 | `walker.webp` 🫥 | 300 × 400 | прозорий | Хлопчик у жовтій худі з синім рюкзаком у повний зріст, **збоку, обличчям праворуч**, крокує |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. A magical rope-and-plank bridge over a sparkling canal in a fairy-tale town quarter; some planks glow with golden light, the last plank glows with a mysterious question-like shimmer (no symbols). A boy in a yellow hoodie with a blue backpack steps carefully onto the first plank, a princess with long purple hair and a crown in a purple dress cheers from the bank, a white-and-blue robot puppy balances on a plank. Stone arches and the castle in the background. Keep the top third mostly sky and the bottom quarter plain riverbank.

**Промпт `plank`:**
> A single cartoon wooden bridge plank hanging on two ropes, side view slightly from above, blank surface with no marks, centered.

**Промпт аркуша:**
> A game asset sheet separated by thin white lines. Left, tall vertical panel 2:3: [start-hero prompt]. Top right: a wooden signboard with an empty dark-blue panel, vines, a lantern on the right and a golden emblem with a small stone arch bridge at the top center. Middle right, wide panel: a canal between two green banks seen from the side with stone bridge supports on both banks and an empty gap for the bridge deck, no characters. Bottom right, on a plain white background: a blank wooden bridge plank on ropes; the same plank glowing gold; a boy in a yellow hoodie with a blue backpack walking, side view facing right.

---

## 15. 🎵 Музичний будинок → `img/muzychnyi-dim/`

Вікна будинку світяться в такт музиці (червоне, синє, зелене, жовте). Дитина повторює мелодію, торкаючись вікон, а після перевороту грає її з кінця. **Вікна — це кнопки, їх кольори й підсвічування робить код**, тому фасад потрібен з чотирма **темними порожніми** вікнами 2 × 2.
Значок таблички — **нота**. `page-bg` — нічна вуличка з будинком.

| # | Файл | Розмір | Фон | Що на ньому |
|---|---|---|---|---|
| 1 | `house.webp` 🫥 | 800 × 1000 | прозорий | Фасад казкового музичного будинку з черепичним дахом і дверима внизу. **Чотири однакові великі вікна сіткою 2 × 2**, рами дерев'яні, **скло темне й порожнє** (код підсвічує вікна кольорами). На даху — флюгер-нота, на стінах — різьблені скрипки й труби |
| 2 | `scene-bg.webp` | 1600 × 900 | суцільний | Вечірня вуличка з зорями, ліхтарями й сусідніми будиночками по краях. **Посередині — порожньо** (там стоятиме будинок) |
| 3 | `note.webp` 🫥 | 200 × 200 | прозорий | Золота нота з іскрами (вилітає з вікна, коли воно звучить) |

**Промпт `start-hero`:**
> Vertical 2:3 game splash screen. A whimsical musical house on an evening street, its four windows glowing red, blue, green and yellow in rhythm, golden musical notes flying out of the chimney. A boy in a yellow hoodie with a blue backpack listens with his hand at his ear, a princess with long purple hair and a crown in a purple dress dances, a white-and-blue robot puppy wags its tail to the music. Stars and the castle on the horizon. Keep the top third mostly night sky and the bottom quarter plain cobblestone.

**Промпт `house`:**
> Front view of a whimsical fairy-tale musical house with a tiled roof, a note-shaped weathervane, carved violins and trumpets on the walls, a wooden door at the bottom, and exactly four identical large windows arranged in a two-by-two grid with wooden frames and dark empty glass, centered.

**Промпт аркуша:**
> A game asset sheet separated by thin white lines. Left, tall vertical panel 2:3: [start-hero prompt]. Top right: a wooden signboard with an empty dark-blue panel, vines, a lantern on the right and a golden emblem with a musical note at the top center. Middle right, wide panel: an evening fairy-tale street with stars, lanterns and small houses at the edges, empty space in the middle, no characters. Bottom right, on a plain white background: a musical house front with a tiled roof and four identical windows in a two-by-two grid with dark empty glass; a golden musical note with sparkles.

---

## Порада

- **Заставки** генеруй від `budynok-yakoho-nemaye/start-hero.webp`, щоб герої лишалися ті самі.
- **Числа, стрілки й ноти** генератори люблять дописувати самі. На дошках мосту, табличці банку, колбах годинника й вікнах будинку їх не має бути. Якщо з'являться, я зітру, але чисті картинки кращі.
- **Потяг строго згори й носом угору.** Інакше після повороту кодом він дивитиметься вбік.
- **Відвідувачі банку** — одним аркушем в один ряд, однакового розміру. Так вони вийдуть як комплект.

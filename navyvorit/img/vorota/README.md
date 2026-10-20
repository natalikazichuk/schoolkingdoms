# 🌀 Ворота у Світ навиворіт (`index.html` → картка воріт) — картинки для редизайну

Макет — `_maket.jpg` у цій папці. Склади сюди файли **саме з такими назвами** — і я підключу їх у вікно воріт.

**Стан (вже в грі):** ✅ усі обов'язкові (1–11, 12 іконок правил), ✅ `gate-head-open`, ✅ `key-17`, ✅ `opt-btn`. Не підключено: `cat` / `cat-nav` (котик уже намальований на шапках).
Картинки вирізано з одного аркуша, тому вони приблизно вдвічі менші за розміри в таблиці (шапки ~500 px завширшки). На телефоні виглядає чітко; якщо колись буде аркуш більшого розміру — заміню файли з тими самими назвами.

Вікно воріт має **4 стани** (усі в одному попапі, ширина до 520 px):

1. **Звичайно** — «Поки що тут усе працює нормально…» + 6 правил (як на макеті).
2. **Після 🔄 Перевороту** — ті самі 6 рядків, але з новими правилами («День став ніччю…»), фіолетова тема.
3. **Питання** — велика іконка правила, питання, 3 кнопки-відповіді, крапки прогресу 1…6.
4. **Перепустку отримано!** — портал відчинено, ключ від будинку №17, кнопка «До розділу I ▶».

## Загальні вимоги

- Формат **`.webp`** (або `.png` — я сконвертую). Розміри вказано **×2** для чітких екранів телефона.
- Стиль — як на макеті: м'який 3D-мультяшний, ігровий, яскравий; камінь кольору пісковику, золото, синій, зелень з білими квіточками.
- **Без тексту, букв і цифр на картинках** — заголовок «Ворота у Світ навиворіт», «Правила світу», тексти правил і кнопок роблю шрифтом у коді (їх треба міняти, перекладати й читати голосом).
- **Прозорий фон** — для всього, крім паперу (позначено 🫥). Без тіні «на підлозі» — тінь додам у коді.
- Кожен шматок — **окремим файлом**: шапка, стрічка, плашка, іконки рухаються/змінюються окремо (портал крутиться, іконки міняються після Перевороту).

## Обов'язкові

| # | Файл | Розмір | Фон | Що на ньому | Де в грі |
|---|------|--------|-----|-------------|----------|
| 1 | `gate-head.webp` 🫥 | 1040×620 | прозорий | Шапка: кам'яна арка із золотою зіркою вгорі, синя черепиця, два ліхтарі, два сині прапорці із зірками, плющ і білі квіти, ліворуч — книжки й **чорний котик**, праворуч — книжки й сувій. **Усередині арки — порожньо (прозоро)** | Верх вікна у станах 1 і 3 |
| 2 | `portal.webp` 🫥 | 600×600 | прозорий | Круглий портал: синьо-фіолетова галактика-вир із зірочками, рівне коло | Вставляю в арку й **повільно кручу** в коді |
| 3 | `gate-head-nav.webp` 🫥 | 1040×620 | прозорий | Та сама шапка **після Перевороту**: ніч, фіолетові й сині кристали, тріщини в камені, прапорці висять **догори дриґом**, ліхтарі світять фіолетовим, книжки ширяють у повітрі, котик сидить **догори лапами на склепінні**. Усередині арки — прозоро | Стан 2 і питання після Перевороту |
| 4 | `ribbon.webp` 🫥 | 1040×220 | прозорий | Синя стрічка-банер із золотою облямівкою, кінці загорнуті назад, **порожня** | Під заголовок «Ворота у Світ навиворіт» |
| 5 | `plaque.webp` 🫥 | 960×110 | прозорий | Золота горизонтальна плашка з двома синіми ромбиками-камінцями по краях, **порожня** | Під «Правила світу · …» |
| 6 | `close.webp` 🫥 | 128×128 | прозорий | Кругла кнопка: золотий обідок, кремовий центр, темно-коричневий хрестик | Кнопка ✕ у кутку |
| 7 | `paper.webp` | 1040×1040 | суцільний | Кремовий пергамент, **безшовна текстура** (без країв і візерунків по кутах) | Фон вікна — повторюю по висоті |
| 8 | `vine.webp` 🫥 | 140×1200 | прозорий | Вертикальна гілка плюща з білими квіточками (ліва сторона рамки). Верх і низ — так, щоб можна було **повторювати** | Боки вікна; праву сторону віддзеркалюю в коді |
| 9 | `ledge.webp` 🫥 | 1040×180 | прозорий | Нижній кам'яний бортик рамки (пісковик) із плющем і квітами на кутах | Низ вікна |

### Іконки правил 🫥 — 12 штук, 400×400, прозорий фон

Показую маленькими (44 px) у списку й великими (150 px) на екрані питання — тому однаково добре мають читатися в обох розмірах: великий простий силует, без дрібних деталей.

| # | Звичайно (`rule-N.webp`) | Навиворіт (`rule-N-nav.webp`) |
|---|---|---|
| 1 | `rule-1` ☀️ Сонечко з усмішкою на блакитному небі | `rule-1-nav` 🌙 Сонечко світить на **нічному** небі з зірками, а місяць — на денному (коло навпіл: день/ніч переплутані) |
| 2 | `rule-2` ⬆️ Синя кнопка зі стрілкою **вгору** | `rule-2-nav` ⬇️ Фіолетова кнопка: гора **догори дриґом**, стрілка вниз до вершини |
| 3 | `rule-3` 💰 Мішечок із монетою, скарбничка | `rule-3-nav` 💸 Монети **вилітають** з відкритого мішечка й множаться на льоту |
| 4 | `rule-4` 🐟 Блакитна рибка у воді + пташка в небі | `rule-4-nav` 🐟 Рибка **з крильцями** летить серед хмар, а пташка пливе під водою |
| 5 | `rule-5` 🏠 Будиночок з відчиненими дверима | `rule-5-nav` 🚪 Двері **окремо**, через них видно вулицю й траву (двері ведуть назовні) |
| 6 | `rule-6` 🔥🧊 Вогник і кубик льоду поруч (вогонь теплий-помаранчевий, лід блакитний) | `rule-6-nav` Вогник **синій, укритий інеєм**, а кубик льоду **палає** помаранчевим |

### Позначки 🫥 — 128×128

| # | Файл | Що на ньому |
|---|------|-------------|
| 10 | `check-on.webp` | Зелений квадратик із заокругленими кутами й білою галочкою (як на макеті) |
| 11 | `check-empty.webp` | Такий самий квадратик, але порожній кремовий, зі світлою обводкою (правило ще не розгадане) |

## Бажані (без них теж працюватиме — лишу емодзі / поточні картинки)

| # | Файл | Розмір | Фон | Що на ньому | Де |
|---|------|--------|-----|-------------|----|
| 12 | `gate-head-open.webp` 🫥 | 1040×620 | прозорий | Шапка у стані «Перепустку отримано!»: арка сяє золотом, звідти б'є тепле світло, котик радіє, в повітрі — конфеті-зірочки й **золотий ключ** зі стрічкою. Усередині арки — прозоро | Стан 4 |
| 13 | `key-17.webp` 🫥 | 400×400 | прозорий | Великий старовинний золотий ключ із синьою стрічкою й порожньою біркою (номер «17» напишу в коді) | Фінал воріт — «ключ від будинку №17» |
| 14 | `cat.webp`, `cat-nav.webp` 🫥 | 400×400 | прозорий | Котик окремо (звичайний — сидить, і навиворіт — догори лапами, здивований) | Щоб котик кліпав / підстрибував окремо від шапки. Якщо буде — на шапках 1/3 котика **не малюй** |
| 15 | `opt-btn.webp` 🫥 | 960×150 | прозорий | Кнопка відповіді: кремова плашка з золотим обідком, порожня | Кнопки відповідей на екрані питання |

## Не треба малювати

- **Усі тексти** — заголовок, «Правила світу · зараз усе нормально», підказка «Натисни Переворот…», тексти правил і відповідей.
- **Блакитна плашка з 🔄** — є `../flip-symbol.webp`, саму плашку роблю в коді.
- **Розмитий фон** за вікном — це сторінка під попапом, розмиття в коді.
- Фіолетову тему «навиворіт» для паперу й плашок — роблю фільтром у коді з тих самих файлів (окремо треба лише шапку `gate-head-nav` та іконки `-nav`).
- Картки воріт на головній сторінці розділів (`pass-off` / `pass-on`) — лишаються як є.

## Порада для генерації

- `gate-head`, `gate-head-nav`, `gate-head-open` — генеруй **від одного зображення** (той самий ракурс і розмір арки), щоб портал `portal.webp` сідав в отвір однаково на всіх трьох. Отвір арки — приблизно **по центру, 34–66 % ширини, 18–92 % висоти**.
- 12 іконок правил — однією серією (один запит на сітку 3×4 або image-to-image від `rule-1`), щоб були одного стилю, товщини обводки й освітлення.
- Якщо генератор не вміє прозорий фон — роби на **суцільному яскраво-зеленому (#00FF00)**, я виріжу.

## Готові промпти (англійською, для генератора)

**Спільний стиль — додавай у кінець кожного промпту:**
> Cute stylized 3D mobile game art, soft lighting, rounded shapes, warm sandstone, polished gold trim, royal blue accents, lush ivy with small white flowers, children's fantasy game UI, high detail, clean edges. No text, no letters, no numbers. Isolated on a fully transparent background, no frame, no ground shadow.

**1. `gate-head` (1040×620):**
> Front view of a fantasy stone archway as the top decoration of a game popup window. Sandstone arch with blue tiled roof and a big golden eight-pointed star on top, two glowing brass lanterns on the pillars, two hanging blue banners with gold stars, ivy and white flowers climbing the stones. On the left a stack of old books with a small black cat with big green eyes sitting on them; on the right books and a rolled parchment scroll. The opening inside the arch is completely empty and transparent. Wide horizontal composition, symmetrical.

**2. `portal` (600×600):**
> A perfectly round magic portal, swirling galaxy vortex in bright blue, violet and pink, tiny sparkling stars, glowing soft edge, seen straight from the front, centered circle filling the image.

**3. `gate-head-nav` (1040×620):**
> The same fantasy stone archway, but the world turned upside down at night: cracked sandstone with glowing purple and blue crystals growing from the cracks, the blue banners hanging upside down, lanterns glowing violet, books floating in the air upside down, a small black cat with green eyes standing upside down on the arch, surprised. Neon violet night palette, magic sparkles. The opening inside the arch is completely empty and transparent. Same camera angle and size as the normal version.

**4. `ribbon` (1040×220):**
> A wide empty royal blue ribbon banner with a gold border, both ends folded back with dark blue tails, front view, flat center area for a title.

**5. `plaque` (960×110):**
> A long thin empty golden plaque with rounded ends and a small blue diamond gem on each end, glossy gold, front view.

**6. `close` (128×128):**
> A round game close button, thick polished gold rim, cream center, a bold dark brown X cross in the middle.

**7. `paper` (1040×1040, без прозорості):**
> Seamless tileable texture of soft cream parchment paper, subtle fibers, very light warm tone, flat even lighting, no edges, no stains, no ornaments.

**8. `vine` (140×1200):**
> A tall vertical strip of climbing ivy vine with small white five-petal flowers and green leaves, tileable from top to bottom, straight vertical, front view.

**9. `ledge` (1040×180):**
> A horizontal sandstone ledge, the bottom border of a fantasy game window frame, rounded stone blocks, ivy and white flowers on both corners, front view.

**Іконки правил (400×400 кожна, однією серією):**
> A set of 12 game icons in a 3×4 grid, each centered on its own cell, same style, same size, chunky simple shapes readable at small size:
> 1) a smiling cartoon sun in a blue daytime sky;
> 2) a glossy blue square button with a white arrow pointing up;
> 3) a brown money bag with a gold coin, closed and full;
> 4) a blue fish swimming in water with a little bird flying above;
> 5) a cozy cottage with an open front door;
> 6) a warm orange flame next to a blue ice cube;
> 7) the smiling sun shining in a dark night sky full of stars, and a crescent moon in a bright day sky, a circle split in half;
> 8) a glossy violet square button with an upside-down mountain and a white arrow pointing down to the peak;
> 9) an open money bag with gold coins flying out and multiplying in the air;
> 10) a blue fish with small wings flying among clouds, and a bird swimming under water;
> 11) a standalone open door frame, through the doorway you see outdoor street and grass;
> 12) a frosty blue flame covered in ice crystals next to an ice cube burning with orange fire.

**10–11. `check-on`, `check-empty` (128×128):**
> A rounded square game checkbox, glossy bright green with a bold white check mark. / The same rounded square checkbox, empty, cream color with a light beige outline.

**12. `gate-head-open` (1040×620):**
> The same fantasy stone archway, glowing with warm golden light from inside, golden sparkles and star confetti in the air, a big golden key with a blue ribbon floating above, the small black cat happy with raised paw. The opening inside the arch is completely empty and transparent. Same camera angle and size as the normal version.

**13. `key-17` (400×400):**
> A big antique golden key with an ornate bow, a blue silk ribbon and a small blank cream tag tied to it, slight tilt, sparkles.

**14. `cat`, `cat-nav` (400×400):**
> A small black cartoon cat with big green eyes and a tiny gold collar, sitting, friendly smile. / The same black cat upside down, standing on its front paws with tail up, surprised wide eyes, violet sparkles around.

**15. `opt-btn` (960×150):**
> A long empty game answer button, cream rounded rectangle with a thin gold rim and a soft inner glow, front view.

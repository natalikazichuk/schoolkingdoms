# English · 2 клас — «Читаємо слова»

Продовження тренажера «Вчимо літери» 1 класу (`klas-1/english-1-litery.html`). Програма American English на рік: 10 модулів. У кожному модулі є звук (phonics) і 6 слів на нього, слова теми, мовний зразок і діалог з Teddy.

| № | Тема | Звук | Слова на звук |
|---|---|---|---|
| 1 | Back to School | короткий a | cat, bag, hat, map, van, jam |
| 2 | Numbers & Age | короткий e | bed, pen, ten, red, hen, net |
| 3 | Fall & Halloween | короткий i | pig, pin, six, bin, lips, win |
| 4 | My Home | короткий o | box, dog, fox, pot, log, sock |
| 5 | Winter Clothes | короткий u | bus, sun, cup, bug, hut, duck |
| 6 | Food I Like | sh | fish, ship, shop, shell, sheep, shoe |
| 7 | Animals Can | ch | chick, chips, cheese, chair, cherry, chess |
| 8 | Body & Feelings | th | thumb, three, teeth, bath, mouth, think |
| 9 | Days & Sports | magic e | cake, bike, bone, cube, kite, rose |
| 10 | Summer Fun | сполучення | frog, flag, star, snail, crab, plane |

## Файли

- `content.py` — увесь зміст. Правити тільки тут.
- `build.py` — збирає з `content.py`:
  - блок `MODS` у `klas-2/english-2-chytannia.html`;
  - `tests/english-2-chytannia-tiles.json` — 10 плиток для «⬆ Імпорт JSON» в адмінці;
  - `tests/test-english-2-module-01…10.json` — тести «перевір себе»;
  - `klas-2/english-2/m01…m10.pdf` — 5 аркушів A4 на модуль.

```
python3 tools/english2/build.py            # усе
python3 tools/english2/build.py --no-pdf   # без PDF (не потрібен reportlab)
```

Для PDF потрібні `reportlab` і шрифт DejaVu Sans (`/usr/share/fonts/truetype/dejavu/`).

## Обкладинки

Файли `img/tr/english-2-m01.webp` … `english-2-m10.webp`, квадрат 600×600. Поки файлу немає, плитка показує емодзі, а старт тренажера — кубики зі словами.

Кожну картинку генеруйте окремо, одразу у форматі 1:1.

Спільна частина промпту:

```
Square 1:1 image, 1024×1024, children's educational app cover.
Bright glossy 3D cartoon style (Pixar-like), warm sunny light, rich saturated colors, crisp details.
Composition fills the whole square, nothing cut off:
– top: a fairy-tale kingdom with castle towers with blue roofs and flags, blue sky;
– middle: a cute brown teddy bear in blue overalls with a small gold star, big friendly eyes, plus the scene for this module;
– bottom: a row of six glossy 3D picture cards with the module's words, all fully visible.
Green grass and flowers along the bottom edge. Clean, cheerful, no extra text, no logos, no watermark, no borders.
```

Сцени модулів:

1. `Teddy at a school desk with a cat, a school bag, a hat and a map; a toy van and a jar of jam.`
2. `Teddy holding a birthday cake with candles, number blocks 11–20, a red hen, a bed and a pen.`
3. `Autumn leaves, a smiling pumpkin, a friendly ghost and a bat; a pink pig in a witch hat.`
4. `A cozy house with open doors: a dog in a box, a fox under the sofa, a pot on the stove.`
5. `Snowy castle, Teddy in a hat, scarf and mittens next to a yellow school bus and a duck; a hot cup of tea.`
6. `Teddy at a seaside food market: fish, a ship, a shop, a shell, a sheep and a pizza.`
7. `A zoo meadow: a frog jumping, a monkey climbing, a bird flying, a little chick, a bowl of cherries.`
8. `Teddy and two kids showing feelings (happy, sad, surprised), Teddy giving a thumbs up, three emoji faces.`
9. `A sports day: Teddy on a bike, kids with a kite and a football, a calendar with days of the week, a birthday cake.`
10. `A summer beach: a frog, a crab, a snail, starfish, a flag on a sandcastle, a plane in the sky.`

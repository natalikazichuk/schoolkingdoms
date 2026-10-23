# English · 1 клас — тренажер «Вчимо літери»

> **На сайті** ці модулі працюють як один тренажер `klas-1/english-1-litery.html?m=1…10` (дизайн і нагороди сайту). Плитки для адмінки — `tests/english-1-litery-tiles.json` (⬆ Імпорт JSON). Аркуші PDF нижче сайт відкриває звідси.

Інтерактивні сторінки й аркуші для друку до річної програми з американської англійської для 1 класу (≈70 годин, 2 уроки на тиждень). Відкрийте `index.html`, щоб побачити всі модулі.

| Модуль | Тема | Літери |
| --- | --- | --- |
| [1](module-01-hello/) | Hello! | H B G N F T |
| [2](module-02-colors/) | Colors (+ Halloween) | R Y O P W C |
| [3](module-03-school/) | School & Numbers 1–10 (+ Thanksgiving) | S E D B P T |
| [4](module-04-body/) | My Body | H K E M N F |
| [5](module-05-winter/) | Winter Holidays | S T G H M J |
| [6](module-06-family/) | My Family | M D S B G L |
| [7](module-07-animals/) | Animals (+ Valentine's Day) | A Z E L D P |
| [8](module-08-food/) | Food | A I J M W C |
| [9](module-09-toys/) | Toys & Actions | K X V R J B |
| [10](module-10-summer/) | Weather & Summer, numbers 11–20 | U Q S R H C |

## Що в кожному модулі

- `index.html` — тренажер: картки літер з озвученням (американська вимова через синтезатор мови браузера), «Слухай і обирай», «Слово й картинка», обведення літер пальцем, діалог з ведмедиком Teddy. Кнопка «Роздрукувати аркуші» вгорі відкриває PDF.
- `worksheets.pdf` — 8 аркушів A4: по аркушу на літеру (розфарбувати, обвести, написати, знайти), «з'єднай», творче завдання.

## Як оновити

`tools/` містить генератор: зміст модулів 3–10 у `modules.py`, сторінки й PDF створює `python3 gen.py` (потрібен `reportlab` і шрифт DejaVu Sans). Модулі 1–2 зроблені вручну за тим самим шаблоном.

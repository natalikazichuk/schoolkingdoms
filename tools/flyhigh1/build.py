"""Збирає тренажери FlyHigh 1 (klas-1/flyhigh-1-*.html) з рушія klas-2/flyhigh-2.html.
Кожна сторінка — самодостатній файл: рушій + спільний набір генераторів
(kit.js) + словник і рівні тренажера (<назва>.js / <назва>.gen.js).
Налаштування сторінок — trainers.json («open»: усі рівні відкриті — для тестів).

Запуск:  python3 tools/flyhigh1/build.py              → усі тренажери
         python3 tools/flyhigh1/build.py . flyhigh-1-tests   → лише один
Після правки рушія klas-2/flyhigh-2.html — перезібрати й перевірити."""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "..")
TPL = open(os.path.join(REPO, "klas-2/flyhigh-2.html"), encoding="utf-8").read()
KIT = open(os.path.join(HERE, "kit.js"), encoding="utf-8").read()
CFG = json.load(open(os.path.join(HERE, "trainers.json"), encoding="utf-8"))

EXTRA_CSS = """/* парта (desk), крашанки (stripes / spots), великий кружечок кольору */
.desk{display:inline-block;position:relative;width:1.25em;height:.8em;vertical-align:middle}
.desk::before{content:"";position:absolute;left:0;right:0;top:0;height:.22em;border-radius:.05em;background:#b9783e;box-shadow:inset 0 -.05em 0 rgba(0,0,0,.2)}
.desk::after{content:"";position:absolute;left:.1em;right:.1em;top:.22em;bottom:0;
  background:linear-gradient(90deg,#8d5524 0 .1em,transparent .1em calc(100% - .1em),#8d5524 calc(100% - .1em))}
.egg{display:inline-block;width:.78em;height:1em;border-radius:50% 50% 50% 50%/60% 60% 40% 40%;vertical-align:middle;
  box-shadow:inset -.06em -.08em 0 rgba(0,0,0,.15)}
.egg.stripes{background:repeating-linear-gradient(0deg,#f03e3e 0 .12em,#ffd43b .12em .24em)}
.egg.spots{background:radial-gradient(circle,#fff 0 .06em,transparent .07em) 0 0/.22em .22em,#339af0}
.egg.plain{background:#f6efe2}
.dot.big{width:110px;height:110px;border-width:4px}
.board .word{text-align:center}
.opt .dot{width:30px;height:30px;border-width:2px}
.opt .many-in{font-size:24px;letter-spacing:1px;line-height:1.2;display:inline-block;max-width:150px}
.opt .numopt{font-family:'Fredoka',sans-serif;font-size:40px;color:var(--ink)}
"""

def rep(t, a, b, n=1):
    assert t.count(a) == n, (a[:80], t.count(a))
    return t.replace(a, b)

def build(c):
    t = TPL
    data = open(os.path.join(HERE, c["data"]), encoding="utf-8").read()
    gen = open(os.path.join(HERE, c["gen"]), encoding="utf-8").read()
    i = t.index("/* ---------- словник (Fly High 2, с. 20–31) ---------- */")
    j = t.index("const N = LEVELS.length;\n", i) + len("const N = LEVELS.length;\n")
    t = t[:i] + data + t[j:]
    i = t.index("/* ============================================================\n   ГЕНЕРАТОРИ")
    j = t.index("/* ============================================================\n   ГРА")
    t = t[:i] + KIT + gen + "\n" + t[j:]
    i = t.index("   FLYHIGH 2 — тренажер"); j = t.index("   Прогрес: localStorage", i)
    t = t[:i] + "".join("   " + l + "\n" for l in c["about"]) + t[j:]
    t = rep(t, "   Прогрес: localStorage 'sk_game_flyhigh_2'", f"   Прогрес: localStorage '{c['ls']}'")
    t = rep(t, "<title>FlyHigh 2</title>", f"<title>{c['title']}</title>")
    t = rep(t, "<h1>FlyHigh 2</h1>", f"<h1>{c['h1']}</h1>")
    t = rep(t, '<p class="start-sub">Colours · Numbers · School · Toys · 10 рівнів</p>', f'<p class="start-sub">{c["sub"]}</p>')
    blocks = "".join(f'<div class="ab" data-o="{o}">{ch}</div>' for ch, o in c["blocks"])
    t = rep(t, '<div class="ab" data-o="🎨">a</div><div class="ab" data-o="☂️">an</div><div class="ab" data-o="🎂">the</div><div class="ab" data-o="⚽">s</div><div class="ab" data-o="🔢">10</div>', blocks)
    t = rep(t, "Pencil, crayon, car and ball —<br>one, two, three — I know them all!", c["rhyme"])
    t = rep(t, "img/tr/flyhigh-2.webp", f"img/tr/{c['slug']}.webp")
    t = rep(t, "textContent:'🐯🐘🐧'", f"textContent:'{c['stub']}'")
    n = c["levels"]
    t = rep(t, "Пройдено 0 з 10 рівнів", f"Пройдено 0 з {n} рівнів")
    t = rep(t, "Пройдено 0 з 10</span>", f"Пройдено 0 з {n}</span>")
    t = rep(t, "<b>FlyHigh 2</b>", f"<b>{c['title']}</b>")
    t = rep(t, 'const LS_KEY = "sk_game_flyhigh_2";', f'const LS_KEY = "{c["ls"]}";')
    t = rep(t, 'const PRIZE_KEY = "sk_flyhigh_2_prize_v1";', f'const PRIZE_KEY = "{c["ls"].replace("sk_game_", "sk_")}_prize_v1";')
    t = rep(t, '"FlyHigh 2 пройдено — нагороду отримано!"', f'"{c["title"]} пройдено — нагороду отримано!"')
    t = rep(t, 'href:"flyhigh-2.html"', f'href:"{c["slug"]}.html"')
    t = rep(t, ".hero-stub{", EXTRA_CSS + ".hero-stub{")
    if c.get("open"):                     # тести: усі рівні відкриті одразу
        t = rep(t, "const S = { unlocked:0,", "const S = { unlocked:N-1,")
        t = rep(t, "S.unlocked = Math.min(N-1, Math.max(0, o.unlocked|0));", "S.unlocked = N-1;")
        t = rep(t, "Не більше 2 помилок — рівень пройдено · без помилок — 3 зірки", c["note"])
    out = os.path.join(REPO, "klas-1", c["slug"] + ".html")
    open(out, "w", encoding="utf-8").write(t)
    print("built", out)

for c in CFG:
    if len(sys.argv) > 2 and c["slug"] not in sys.argv[2:]: continue
    build(c)

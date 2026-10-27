#!/usr/bin/env python3
# English · 2 клас «Читаємо слова»: з content.py збирає
#   klas-2/english-2-chytannia.html   — блок MODS між /*MODS*/ … /*/MODS*/
#   tests/english-2-chytannia-tiles.json — 10 плиток для «⬆ Імпорт JSON» в адмінці
#   tests/test-english-2-module-NN.json  — тест «перевір себе» до кожного модуля
#   klas-2/english-2/mNN.pdf             — аркуші для друку (A4)
# Запуск з кореня репозиторію: python3 tools/english2/build.py  (потрібен reportlab і шрифт DejaVu Sans)
import json, os, random, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
from content import MODULES

PAGE = os.path.join(ROOT, "klas-2", "english-2-chytannia.html")
PDF_DIR = os.path.join(ROOT, "klas-2", "english-2")
TESTS = os.path.join(ROOT, "tests")
COVER = "img/tr/english-2-m%02d.webp"
TOPIC = "Читаємо слова"


def check(m):
    n = m["n"]
    for name in ("W", "V"):
        words = [x[0] for x in m[name]]
        pics = [x[1] for x in m[name]]
        assert len(set(words)) == len(words), (n, name, "слова повторюються")
        assert len(set(pics)) == len(pics), (n, name, "картинки повторюються")
    assert len(m["W"]) == 6, (n, "W має 6 слів")
    for w, pic, uk, part in m["W"]:
        assert part in w, (n, w, part)
        assert part in m["opts"], (n, w, part, "немає серед opts")
    for line, opts, ok in m["D"]:
        assert ok == -1 or 0 <= ok < len(opts), (n, line)
        assert len(set(opts)) == len(opts), (n, line)


def js_mods():
    rows = []
    for m in MODULES:
        o = dict(n=m["n"], t=m["t"], ua=m["ua"], snd=m["snd"], opts=m["opts"], talk=m["talk"], pat=m["pat"], fin=m["fin"],
                 W=[list(x) for x in m["W"]], V=[list(x) for x in m["V"]], D=[[a, b, c] for a, b, c in m["D"]])
        rows.append("  " + json.dumps(o, ensure_ascii=False) + ",")
    return "const MODS = [\n" + "\n".join(rows) + "\n];"


def write_page():
    s = open(PAGE, encoding="utf-8").read()
    a, b = "/*MODS*/", "/*/MODS*/"
    i, j = s.index(a) + len(a), s.index(b)
    s = s[:i] + "\n" + js_mods() + "\n" + s[j:]
    open(PAGE, "w", encoding="utf-8").write(s)


def write_tiles():
    icons = ["🏫", "🔢", "🎃", "🏠", "🧣", "🍕", "🐸", "😊", "⚽", "🏖️"]
    out = [dict(title=f"Module {m['n']} · {m['t']}", subject="English", topic=TOPIC, grade=2,
                format="html", linkHref=f"klas-2/english-2-chytannia.html?m={m['n']}", icon=icons[i],
                imgCard=COVER % m["n"], desc=f"{m['ua']} · звук {m['snd']}",
                stat="mana", statMode="fixed", statValue=1, active=True,
                rewards=dict(wheel=dict(on=False, slots=[]), extras=[dict(on=True, item="", chance=100, coins=20)], repeat=False))
           for i, m in enumerate(MODULES)]
    open(os.path.join(TESTS, "english-2-chytannia-tiles.json"), "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=2) + "\n")


def q(text, right, wrong):
    return dict(q=text, options=[right] + list(wrong), correct=0)


def others(rng, items, not_, k):
    pool = [x for x in items if x != not_]
    rng.shuffle(pool)
    return pool[:k]


def write_tests():
    for m in MODULES:
        rng = random.Random(m["n"])
        W, V = m["W"], m["V"]
        L1 = []
        for w, pic, uk, part in W:
            gap = w.replace(part, "_" * len(part), 1)
            L1.append(q(f"{pic} {gap} — який звук пропущено?", part, others(rng, m["opts"], part, 2)))
            L1.append(q(f"{pic} Як це англійською?", w, [x[0] for x in others(rng, W, (w, pic, uk, part), 2)]))
        L2 = []
        for w, pic, uk, part in W:
            L2.append(q(f"{w} — що означає це слово?", uk, [x[2] for x in others(rng, W, (w, pic, uk, part), 2)]))
        L3 = []
        for v in V:
            txt = v[1] if len(v[1]) <= 3 and v[1].isascii() else None
            L3.append(q(f"{txt} — як це англійською?" if txt else f"{v[1]} Що це? Обери слово.", v[0], [x[0] for x in others(rng, V, v, 2)]))
            L3.append(q(f"{v[0]} — що означає це слово?", v[2], [x[2] for x in others(rng, V, v, 2)]))
        L4 = [q(f"🧸 Teddy: «{t.replace('{n}', 'Anna')}» Що відповісти?", os_[ok].replace("{n}", "Anna"),
                [o.replace("{n}", "Anna") for i, o in enumerate(os_) if i != ok]) for t, os_, ok in m["D"] if ok >= 0]
        test = dict(title=f"English 2 · Module {m['n']} · {m['t']} — перевір себе", subject="English", topic=TOPIC, grade=2,
                    imgCard=COVER % m["n"], stat="mana", format="levels", xpMode="perCorrect", xpValue=1,
                    statMode="fixed", statValue=1, active=True,
                    levels=[dict(level=1, name=f"Звук ({m['snd']})", count=6, questions=L1),
                            dict(level=2, name="Читання", count=6, questions=L2),
                            dict(level=3, name="Слова теми", count=6, questions=L3),
                            dict(level=4, name="Діалог з Teddy", count=min(5, len(L4)), questions=L4)])
        for lv in test["levels"]:
            for x in lv["questions"]:
                assert len(set(x["options"])) == len(x["options"]) >= 2, (m["n"], x)
        p = os.path.join(TESTS, "test-english-2-module-%02d.json" % m["n"])
        open(p, "w", encoding="utf-8").write(json.dumps([test], ensure_ascii=False, indent=2) + "\n")


# ---------- PDF ----------
def write_pdfs():
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.lib.colors import HexColor
    D = "/usr/share/fonts/truetype/dejavu/"
    pdfmetrics.registerFont(TTFont("S", D + "DejaVuSans.ttf"))
    pdfmetrics.registerFont(TTFont("SB", D + "DejaVuSans-Bold.ttf"))
    W_, H_ = A4
    INK = HexColor("#1f2a44"); SOFT = HexColor("#7a849c"); RULE = HexColor("#9fb3d6"); LIGHT = HexColor("#c9d3e6")
    PAL = ["#e03a3a", "#2e86de", "#3aa65b", "#8e5bd6", "#ef7d1a", "#e0457b"]
    CAP = 0.729; M = 18 * mm

    def header(c, label, title, sub):
        c.setFillColor(SOFT); c.setFont("S", 9); c.drawString(M, H_ - 14 * mm, label)
        c.drawRightString(W_ - M, H_ - 14 * mm, "Name: ____________________")
        c.setFillColor(INK); c.setFont("SB", 20); c.drawString(M, H_ - 24 * mm, title)
        c.setFont("S", 10.5); c.setFillColor(SOFT); c.drawString(M, H_ - 30 * mm, sub)

    def guide(c, base, h):
        c.setStrokeColor(RULE); c.setLineWidth(0.7); c.setDash()
        c.line(M, base + h, W_ - M, base + h); c.line(M, base, W_ - M, base)
        c.setDash(3, 3); c.setStrokeColor(LIGHT); c.line(M, base + h * 0.75, W_ - M, base + h * 0.75); c.setDash()

    def dotted(c, text, x, base, size):
        c.saveState(); t = c.beginText(); t.setTextRenderMode(1); t.setFont("S", size); t.setTextOrigin(x, base)
        c.setStrokeColor(SOFT); c.setLineWidth(0.9); c.setDash(1.6, 2.2); c.setLineCap(1)
        t.textLine(text); c.drawText(t); c.restoreState()

    def trace_row(c, base, h, word, col, part):
        size = h / CAP; guide(c, base, h)
        x = M + 3 * mm
        i = word.index(part)
        for k, seg in enumerate([word[:i], part, word[i + len(part):]]):     # зразок: звук модуля — кольором
            c.setFillColor(col if k == 1 else INK); c.setFont("S", size); c.drawString(x, base, seg)
            x += pdfmetrics.stringWidth(seg, "S", size)
        x += 8 * mm; w = pdfmetrics.stringWidth(word, "S", size)
        while x + w <= W_ - M:
            dotted(c, word, x, base, size); x += w + 8 * mm

    def p_trace(c, m, label):
        header(c, label, f"Sound «{m['snd']}» · Read and trace", "Прочитай слово вголос і обведи його. Звук модуля виділено кольором.")
        y = H_ - 50 * mm
        for i, (w, pic, uk, part) in enumerate(m["W"]):
            c.setFillColor(SOFT); c.setFont("S", 9); c.drawString(M, y + 15 * mm, f"{i + 1}. {w} — {uk}")
            trace_row(c, y, 11 * mm, w, HexColor(PAL[i]), part); y -= 36 * mm

    def p_gap(c, m, label):
        header(c, label, "Fill in the sound", "Впиши пропущений звук. Обведи правильний варіант у рамці й прочитай слово.")
        rng = random.Random(m["n"] * 7)
        y = H_ - 52 * mm
        for i, (w, pic, uk, part) in enumerate(m["W"]):
            gap = w.replace(part, " _" * len(part) + " ", 1)
            c.setFillColor(INK); c.setFont("S", 30); c.drawString(M + 4 * mm, y, gap)
            c.setFillColor(SOFT); c.setFont("S", 10); c.drawString(M + 4 * mm, y - 7 * mm, uk)
            pool = [o for o in m["opts"] if o != part]; rng.shuffle(pool); opts = [part] + pool[:2]; rng.shuffle(opts)
            x = W_ - M - 75 * mm
            for o in opts:
                c.setStrokeColor(LIGHT); c.setLineWidth(1); c.roundRect(x, y - 4 * mm, 22 * mm, 14 * mm, 3 * mm)
                c.setFillColor(INK); c.setFont("S", 20); c.drawCentredString(x + 11 * mm, y, o); x += 25 * mm
            y -= 36 * mm

    def p_draw(c, m, label):
        header(c, label, "Read and draw", "Прочитай слово й намалюй малюнок до нього. Обведи слово.")
        cw = (W_ - 2 * M) / 3; ch = 62 * mm; top = H_ - 38 * mm
        for i, (w, pic, uk, part) in enumerate(m["W"]):
            col = i % 3; row = i // 3; x = M + cw * col + 2 * mm; y = top - (row + 1) * (ch + 8 * mm)
            c.setStrokeColor(LIGHT); c.setLineWidth(1); c.setDash(4, 3); c.roundRect(x, y, cw - 4 * mm, ch, 4 * mm); c.setDash()
            tw = pdfmetrics.stringWidth(w, "S", 22); dotted(c, w, x + (cw - 4 * mm - tw) / 2, y + 5 * mm, 22)
        y = top - 2 * (ch + 8 * mm) - 24 * mm
        c.setFillColor(INK); c.setFont("SB", 13); c.drawString(M, y + 16 * mm, "Обведи речення, прочитай і напиши його сам(а):")
        h = 11 * mm; guide(c, y, h); dotted(c, m["sent"], M + 3 * mm, y, h / CAP); guide(c, y - 24 * mm, h)

    def p_words(c, m, label):
        header(c, label, f"Words · {m['t']}", "Обведи слова теми й назви їх уголос.")
        V = m["V"]; y = H_ - 46 * mm; half = (W_ - 2 * M) / 2
        for i, (w, pic, uk) in enumerate(V[:12]):
            x = M + (i % 2) * half; yy = y - (i // 2) * 30 * mm
            size = 26 if len(w) <= 9 else 20
            dotted(c, w, x + 2 * mm, yy, size)
            c.setFillColor(SOFT); c.setFont("S", 10); c.drawString(x + 2 * mm, yy - 7 * mm, uk)

    def p_talk(c, m, label):
        header(c, label, "Talk with Teddy", "Прочитай з дорослим: дорослий — Teddy, дитина відповідає й обводить відповідь.")
        y = H_ - 48 * mm
        for line, opts, ok in m["D"][:6]:
            t = line.replace("{n}", "…")
            t = " ".join("".join(ch for ch in t if ord(ch) < 0x2190).split())     # без емодзі: шрифт їх не має
            c.setFillColor(INK); c.setFont("SB", 13); c.drawString(M, y, "Teddy: " + t)
            ans = (opts[ok] if ok >= 0 else opts[0]).replace("{n}", "…")
            dotted(c, ans, M + 10 * mm, y - 13 * mm, 20); y -= 34 * mm
        c.setFillColor(SOFT); c.setFont("S", 10); c.drawString(M, y + 6 * mm, "Зразок модуля: " + m["pat"])

    os.makedirs(PDF_DIR, exist_ok=True)
    for m in MODULES:
        label = f"ENGLISH 2 · MODULE {m['n']} · {m['t'].upper()} · ЧИТАЄМО СЛОВА"
        c = canvas.Canvas(os.path.join(PDF_DIR, "m%02d.pdf" % m["n"]), pagesize=A4)
        c.setTitle(f"English 2 · Module {m['n']} · {m['t']} — аркуші")
        for page in (p_trace, p_gap, p_draw, p_words, p_talk):
            page(c, m, label); c.showPage()
        c.save()


if __name__ == "__main__":
    for m in MODULES:
        check(m)
    write_page(); write_tiles(); write_tests()
    if "--no-pdf" not in sys.argv:
        write_pdfs()
    print("ok:", len(MODULES), "модулів")

"""Printable worksheets for Grade 2, Module 3 "My Day" (+ Thanksgiving).
Same look as modules 1–2. Usage: python3 worksheets_g2m3.py OUT_DIR
After building: python3 "American English курс/brand_sheets.py" <OUT_DIR>/worksheets.pdf
"""
import math, os, sys, json, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import worksheets_g2m2 as m2

base = m2.base
INK, SOFT, RULE, LIGHT, VOWEL, S = base.INK, base.SOFT, base.RULE, base.LIGHT, base.VOWEL, base.S
ICONS = dict(m2.ICONS)
ICONS.update({
 "alarm": f'<g {S}><circle cx="50" cy="54" r="32"/><circle cx="50" cy="54" r="25"/><line x1="50" y1="54" x2="50" y2="36"/><line x1="50" y1="54" x2="62" y2="60"/><path d="M20 30 Q22 16 36 18 Z"/><path d="M80 30 Q78 16 64 18 Z"/><line x1="30" y1="82" x2="24" y2="92"/><line x1="70" y1="82" x2="76" y2="92"/></g>',
 "toothbrush": f'<g {S}><g transform="rotate(-35 50 50)"><rect x="8" y="46" width="62" height="10" rx="5"/><rect x="66" y="40" width="24" height="12" rx="3"/>' + "".join(f'<line x1="{x}" y1="40" x2="{x}" y2="30"/>' for x in range(69, 90, 5)) + '</g><circle cx="78" cy="78" r="5"/><circle cx="88" cy="70" r="3.5"/></g>',
 "bowl": f'<g {S}><path d="M10 44 L90 44 Q86 80 50 82 Q14 80 10 44 Z"/><ellipse cx="50" cy="44" rx="40" ry="8"/><path d="M58 40 L86 10 L90 14 L64 42" /><circle cx="36" cy="42" r="3"/><circle cx="48" cy="40" r="3"/><circle cx="42" cy="46" r="3"/></g>',
 "soap": f'<g {S}><rect x="18" y="46" width="64" height="34" rx="14"/><circle cx="36" cy="30" r="9"/><circle cx="56" cy="24" r="6"/><circle cx="70" cy="34" r="7"/></g>',
 "school": f'<g {S}><path d="M10 44 L50 18 L90 44 Z"/><rect x="18" y="44" width="64" height="44"/><rect x="42" y="64" width="16" height="24"/><rect x="24" y="52" width="12" height="10"/><rect x="64" y="52" width="12" height="10"/><circle cx="50" cy="34" r="5"/><line x1="50" y1="18" x2="50" y2="6"/><path d="M50 6 L64 10 L50 14" /></g>',
 "hen": f'<g {S}><path d="M28 70 Q18 40 36 32 Q40 18 54 22 Q66 26 62 40 Q86 40 88 58 Q80 80 50 82 Q34 82 28 70 Z"/><path d="M50 22 Q50 12 58 14 Q56 20 62 20" fill="#fff"/><path d="M66 34 L76 38 L66 42 Z"/><circle cx="58" cy="32" r="2.5" fill="{INK}"/><line x1="44" y1="82" x2="40" y2="94"/><line x1="58" y1="82" x2="62" y2="94"/></g>',
 "leg": f'<g {S}><path d="M40 8 L60 8 L58 60 Q58 74 64 80 L84 84 Q90 88 84 92 L44 92 Q38 90 40 80 Z"/><line x1="58" y1="20" x2="40" y2="20"/></g>',
 "net": f'<g {S}><rect x="10" y="24" width="80" height="56"/>' + "".join(f'<line x1="{x}" y1="24" x2="{x}" y2="80"/>' for x in range(22, 90, 12)) + "".join(f'<line x1="10" y1="{y}" x2="90" y2="{y}"/>' for y in range(36, 80, 12)) + '</g>',
 "jet": f'<g {S}><path d="M8 54 Q30 46 86 46 Q96 50 86 56 Q30 58 8 54 Z"/><path d="M44 48 L30 18 L40 18 L60 48 Z"/><path d="M44 56 L30 86 L40 86 L60 56 Z"/><path d="M12 52 L6 36 L14 36 L22 50 Z"/>' + "".join(f'<circle cx="{x}" cy="51" r="2" fill="{INK}"/>' for x in range(56, 82, 7)) + '</g>',
 "web": f'<g fill="none" stroke="{INK}" stroke-width="2.4">' + "".join(f'<line x1="50" y1="50" x2="{50 + 44 * math.cos(math.radians(a)):.1f}" y2="{50 + 44 * math.sin(math.radians(a)):.1f}"/>' for a in range(0, 360, 45)) +
        "".join('<polygon points="' + " ".join(f'{50 + r * math.cos(math.radians(a)):.1f},{50 + r * math.sin(math.radians(a)):.1f}' for a in range(0, 360, 45)) + '"/>' for r in (12, 24, 36)) + '</g>',
 "turkey": f'<g {S}>' + "".join(f'<ellipse cx="50" cy="40" rx="9" ry="30" transform="rotate({a} 50 62)"/>' for a in (-60, -30, 0, 30, 60)) +
           f'<ellipse cx="50" cy="66" rx="22" ry="20"/><circle cx="50" cy="40" r="12"/><circle cx="46" cy="37" r="2" fill="{INK}"/><circle cx="54" cy="37" r="2" fill="{INK}"/><path d="M47 43 L50 49 L53 43 Z"/><path d="M50 46 Q48 54 52 56" fill="none"/><line x1="44" y1="86" x2="42" y2="94"/><line x1="56" y1="86" x2="58" y2="94"/></g>',
 "moon": f'<g {S}><path d="M62 12 Q30 22 32 52 Q34 84 70 88 Q40 96 22 72 Q6 44 26 22 Q40 8 62 12 Z"/><path d="M78 26 L80 32 L86 32 L81 36 L83 42 L78 38 L73 42 L75 36 L70 32 L76 32 Z"/></g>',
 "sunrise": f'<g {S}><path d="M20 70 A30 30 0 0 1 80 70 Z"/>' + "".join(f'<line x1="{50 + 36 * math.cos(math.radians(a)):.1f}" y1="{70 - 36 * math.sin(math.radians(a)):.1f}" x2="{50 + 46 * math.cos(math.radians(a)):.1f}" y2="{70 - 46 * math.sin(math.radians(a)):.1f}"/>' for a in (20, 55, 90, 125, 160)) + '<line x1="6" y1="70" x2="94" y2="70"/><line x1="16" y1="80" x2="84" y2="80"/></g>',
})
def icon(name, size=26):
    return f'<svg class="ic" viewBox="0 0 100 100" style="width:{size}mm;height:{size}mm" aria-hidden="true">{ICONS[name]}</svg>'
trace, line = base.trace, base.line
NUMS = ["twelve", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"]

def clock(h=None, size=40):
    nums = "".join(f'<text x="{50 + 35 * math.sin(math.radians(i * 30)):.1f}" y="{50 - 35 * math.cos(math.radians(i * 30)) + 3.6:.1f}" text-anchor="middle" font-size="10" font-family="DejaVu Sans" fill="{INK}">{i}</text>' for i in range(1, 13))
    hands = ""
    if h is not None:
        a = math.radians((h % 12) * 30)
        hands = (f'<line x1="50" y1="50" x2="50" y2="18" stroke="{INK}" stroke-width="2.2" stroke-linecap="round"/>'
                 f'<line x1="50" y1="50" x2="{50 + 22 * math.sin(a):.1f}" y2="{50 - 22 * math.cos(a):.1f}" stroke="{INK}" stroke-width="4" stroke-linecap="round"/>')
    return (f'<svg viewBox="0 0 100 100" style="width:{size}mm;height:{size}mm"><circle cx="50" cy="50" r="46" fill="#fff" stroke="{INK}" stroke-width="2.5"/>'
            f'{nums}{hands}<circle cx="50" cy="50" r="3" fill="{INK}"/></svg>')

def head(title, sub):
    return (f'<div class="top"><span>2 КЛАС · МОДУЛЬ 3 · MY DAY</span><span>Name: ______________  Date: __________</span></div>'
            f'<h1>{title}</h1><p class="sub">{sub}</p>')

pages = []
# 1. My day — order the pictures
day = [("go to bed", "bed"), ("eat breakfast", "bowl"), ("get up", "alarm"), ("play", "ball"), ("go to school", "school"), ("brush my teeth", "toothbrush")]
cells = "".join(f'<div class="thing day"><span class="num"></span>{icon(ic, 30)}{line(11)}</div>' for w, ic in day)
pages.append(head("My day", "Що ти робиш спочатку, а що потім? Напиши в кружечку номер 1–6 і підпиши малюнок словами з рамки.") +
             '<div class="bank">get up · brush my teeth · eat breakfast · go to school · play · go to bed</div>' + f'<div class="grid3">{cells}</div>')

# 2. What time is it?
hrs = [7, 3, 9, 12, 5, 10]
cells = "".join(f'<div class="isit">{clock(h, 40)}<div><p class="q">What time is it?</p><p class="lab">It\'s</p>{line(11)}<p class="lab">o\'clock.</p></div></div>' for h in hrs)
pages.append(head("What time is it?", "Подивись на годинник і напиши котра година словами: seven, three…") + f'<div class="grid2">{cells}</div>' +
             '<p class="lab big">Коротка стрілка показує годину, довга — на 12.</p>')

# 3. Draw the hands
hrs2 = [8, 2, 6, 11, 4, 1]
cells = "".join(f'<div class="draw" style="text-align:center"><p class="q">{NUMS[h]} o\'clock</p>{clock(None, 46)}</div>' for h in hrs2)
pages.append(head("Draw the hands", "Прочитай, котра година, і намалюй стрілки: коротку — на годину, довгу — на 12.") + f'<div class="grid3">{cells}</div>')

# 4. My day — times
rows = [("I get up at", "alarm"), ("I go to school at", "school"), ("I eat dinner at", "bowl"), ("I go to bed at", "bed")]
cells = "".join(f'<div class="isit">{icon(ic, 26)}{clock(None, 30)}<div style="flex:1"><p class="q" style="font-size:13pt">{t}</p>{line(11)}<p class="lab">o\'clock.</p></div></div>' for t, ic in rows)
pages.append(head("My day: what time?", "Напиши, о котрій ти це робиш, і намалюй стрілки на годиннику.") + f'<div class="grid1">{cells}</div>')

# 5. Short e
cvc = ["bed", "pen", "ten", "hen", "leg", "net", "jet", "web"]
def pic(w):
    if w == "ten":
        return f'<svg class="ic" viewBox="0 0 100 100" style="width:30mm;height:30mm"><rect x="12" y="20" width="76" height="60" rx="10" fill="#fff" stroke="{INK}" stroke-width="3"/><text x="50" y="66" text-anchor="middle" font-size="40" font-family="DejaVu Sans" fill="{INK}">10</text></svg>'
    return icon(w, 30)
cells = "".join(f'<div class="cvc">{pic(w)}<div class="boxes"><span></span><span class="v"></span><span></span></div></div>' for w in cvc)
pages.append(head("Short e: b-e-d", "Назви малюнок і послухай звуки. Впиши по одній літері в кожну клітинку. У середині — звук e, як у bed.") +
             f'<div class="grid4 tall">{cells}</div>' +
             '<p class="lab big">Прочитай уголос і плесни на кожен звук:</p><div class="bank big">bed · red · pen · ten · hen · men · leg · peg · net · jet · wet · pet · web · egg</div>')

# 6. Word families -en / -et / -ed
fam = [("-en", ["t", "h", "p", "m"]), ("-et", ["n", "j", "w", "p"]), ("-ed", ["b", "r", "f", "l"])]
cols = "".join(f'<div class="fam"><div class="fh">{e}</div>' + "".join(f'<div class="fw"><b>{l}</b><span>{e[1:]}</span></div>' for l in ls) + '</div>' for e, ls in fam)
pages.append(head("Word families", "Прочитай слова в кожному стовпчику: ten, hen, pen, men. Обведи букву, що змінюється.") +
             f'<div class="fams">{cols}</div>' + '<p class="lab big">Прочитай речення й обведи слова з e:</p>' +
             trace("The red hen is in the bed.", 11) + trace("Ten pets get wet.", 11))

# 7. Morning, afternoon, evening
cols = "".join(f'<div class="fam"><div style="text-align:center">{icon(ic, 26)}</div><div class="fh" style="color:{INK};font-size:16pt">{t}</div>{line(11)}{line(11)}{line(11)}</div>'
               for t, ic in [("morning", "sunrise"), ("afternoon", "sun"), ("evening", "moon")])
pages.append(head("Morning, afternoon, evening", "Коли ти це робиш? Напиши дії у правильний стовпчик.") +
             '<div class="bank">get up · eat breakfast · go to school · play · do my homework · eat dinner · go to bed</div>' + f'<div class="fams">{cols}</div>' +
             '<p class="lab big">Обведи речення:</p>' + trace("In the morning I get up.", 11) + trace("In the evening I go to bed.", 11))

# 8. Thanksgiving + I can
cans = ["I can say what I do: I get up, I go to school…", "I can ask: What time is it?", "I can say: It's seven o'clock.", "I can read bed, pen, ten.", "I can say: I'm thankful for my family."]
checks = "".join(f'<div class="can"><span>{c}</span><span class="faces">☺ &nbsp; ☹</span></div>' for c in cans)
pages.append(head("Happy Thanksgiving!", "Розфарбуй індичку. Намалюй, за що ти вдячний(-а), і обведи речення.") +
             f'<div class="me"><div style="text-align:center">{icon("turkey", 56)}</div><div class="frame2" style="height:60mm"></div></div>' +
             trace("I'm thankful for my family.", 11) + f'<h2>I can …</h2><div class="cans">{checks}</div>')

CSS = m2.CSS + f'''
.grid1 {{ display: grid; gap: 6mm; margin-top: 3mm; }}
.day {{ position: relative; }}
.day .num {{ position: absolute; top: 2mm; left: 2mm; width: 10mm; height: 10mm; border: .5mm solid {INK}; border-radius: 50%; }}
'''

def build(out_dir):
    out_dir = os.path.abspath(out_dir); os.makedirs(out_dir, exist_ok=True)
    html = (f'<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>My Day Worksheets</title>'
            f'<style>{CSS}</style></head><body>' + "".join(f'<section class="sheet">{p}</section>' for p in pages) + '</body></html>')
    src = os.path.join(out_dir, "worksheets.html"); open(src, "w", encoding="utf8").write(html)
    pdf = os.path.join(out_dir, "worksheets.pdf")
    js = ("const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();"
          f"await p.goto({json.dumps('file://' + src)});await p.pdf({{path:{json.dumps(pdf)},format:'A4',preferCSSPageSize:true,printBackground:true}});await b.close();}})();")
    subprocess.run(["node", "-e", js], check=True)
    os.remove(src)
    return pdf

if __name__ == "__main__":
    print(build(sys.argv[1] if len(sys.argv) > 1 else "."))

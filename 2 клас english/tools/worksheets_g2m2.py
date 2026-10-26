"""Printable worksheets for Grade 2, Module 2 "My Home" (+ Halloween).
Same look as module 1 (worksheets_g2m1.py): A4 HTML booklet with line-art SVG
pictures children can color, printed to PDF with headless Chromium.
Usage: python3 worksheets_g2m2.py OUT_DIR
After building, brand it: python3 "American English курс/brand_sheets.py" <OUT_DIR>/worksheets.pdf
"""
import os, subprocess, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import worksheets_g2m1 as base

INK, SOFT, RULE, LIGHT, VOWEL = base.INK, base.SOFT, base.RULE, base.LIGHT, base.VOWEL
S = base.S
ICONS = dict(base.ICONS)
ICONS.update({
 "sofa": f'<g {S}><rect x="16" y="30" width="68" height="26" rx="8"/><rect x="10" y="48" width="80" height="20" rx="6"/><rect x="6" y="42" width="14" height="30" rx="6"/><rect x="80" y="42" width="14" height="30" rx="6"/><line x1="50" y1="50" x2="50" y2="66"/><line x1="18" y1="72" x2="18" y2="82"/><line x1="82" y1="72" x2="82" y2="82"/></g>',
 "chair": f'<g {S}><rect x="30" y="12" width="40" height="40" rx="5"/><rect x="26" y="52" width="48" height="10" rx="3"/><line x1="32" y1="62" x2="30" y2="90"/><line x1="68" y1="62" x2="70" y2="90"/><line x1="38" y1="22" x2="62" y2="22"/></g>',
 "lamp": f'<g {S}><path d="M32 14 L68 14 L80 44 L20 44 Z"/><line x1="50" y1="44" x2="50" y2="80"/><ellipse cx="50" cy="84" rx="20" ry="6"/></g>',
 "door": f'<g {S}><rect x="26" y="8" width="48" height="86" rx="3"/><rect x="34" y="16" width="32" height="28" rx="2"/><rect x="34" y="52" width="32" height="34" rx="2"/><circle cx="66" cy="50" r="3.5" fill="{INK}"/></g>',
 "window": f'<g {S}><rect x="18" y="14" width="64" height="66" rx="3"/><line x1="50" y1="14" x2="50" y2="80"/><line x1="18" y1="47" x2="82" y2="47"/><path d="M12 10 Q22 50 14 88 L22 88 Q30 50 24 10 Z"/><path d="M88 10 Q78 50 86 88 L78 88 Q70 50 76 10 Z"/><line x1="10" y1="10" x2="90" y2="10"/></g>',
 "tv": f'<g {S}><rect x="12" y="26" width="76" height="52" rx="6"/><rect x="20" y="33" width="60" height="38" rx="3"/><line x1="40" y1="12" x2="50" y2="26"/><line x1="62" y1="10" x2="50" y2="26"/><line x1="36" y1="78" x2="30" y2="90"/><line x1="64" y1="78" x2="70" y2="90"/></g>',
 "table": f'<g {S}><rect x="8" y="36" width="84" height="10" rx="3"/><line x1="18" y1="46" x2="18" y2="88"/><line x1="82" y1="46" x2="82" y2="88"/><path d="M38 36 L40 24 L60 24 L62 36" fill="#fff"/></g>',
 "bathtub": f'<g {S}><path d="M8 46 L92 46 L86 72 Q84 80 74 80 L26 80 Q16 80 14 72 Z"/><line x1="24" y1="80" x2="20" y2="90"/><line x1="76" y1="80" x2="80" y2="90"/><path d="M80 46 L80 20 Q80 12 72 12 L66 12" fill="none"/><circle cx="64" cy="18" r="5"/><circle cx="34" cy="38" r="5"/><circle cx="46" cy="34" r="6"/><circle cx="58" cy="39" r="4"/></g>',
 "stove": f'<g {S}><rect x="16" y="30" width="68" height="62" rx="4"/><rect x="26" y="52" width="48" height="30" rx="3"/><line x1="16" y1="44" x2="84" y2="44"/><circle cx="34" cy="37" r="2.5" fill="{INK}"/><circle cx="66" cy="37" r="2.5" fill="{INK}"/><ellipse cx="50" cy="24" rx="22" ry="6"/><line x1="72" y1="24" x2="92" y2="20"/></g>',
 "van": f'<g {S}><path d="M8 66 L8 34 Q8 26 16 26 L70 26 L88 46 L92 66 Z"/><rect x="16" y="34" width="18" height="14" rx="2"/><rect x="40" y="34" width="18" height="14" rx="2"/><path d="M64 34 L72 34 L82 48 L64 48 Z"/><circle cx="28" cy="70" r="9"/><circle cx="74" cy="70" r="9"/></g>',
 "fan": f'<g {S}><circle cx="50" cy="38" r="28"/><path d="M50 38 Q40 14 54 12 Q62 24 50 38 Z"/><path d="M50 38 Q74 34 74 48 Q60 54 50 38 Z"/><path d="M50 38 Q36 58 26 46 Q32 34 50 38 Z"/><circle cx="50" cy="38" r="4" fill="{INK}"/><line x1="50" y1="66" x2="50" y2="84"/><ellipse cx="50" cy="88" rx="18" ry="5"/></g>',
 "can": f'<g {S}><ellipse cx="50" cy="18" rx="24" ry="7"/><path d="M26 18 L26 82 Q50 92 74 82 L74 18"/><path d="M26 36 Q50 44 74 36 L74 62 Q50 70 26 62 Z"/></g>',
 "pan": f'<g {S}><ellipse cx="40" cy="56" rx="32" ry="20"/><ellipse cx="40" cy="52" rx="24" ry="13"/><path d="M70 52 L94 44 L96 50 L72 60" /></g>',
 "bat": f'<g {S}><path d="M50 40 Q40 30 30 36 Q20 26 6 34 Q14 44 10 56 Q22 50 30 58 Q38 50 50 60 Q62 50 70 58 Q78 50 90 56 Q86 44 94 34 Q80 26 70 36 Q60 30 50 40 Z"/><circle cx="46" cy="44" r="1.8" fill="{INK}"/><circle cx="54" cy="44" r="1.8" fill="{INK}"/><path d="M44 36 L45 30 L48 35 M56 36 L55 30 L52 35" fill="none"/></g>',
 "pumpkin": f'<g {S}><ellipse cx="34" cy="58" rx="20" ry="28"/><ellipse cx="66" cy="58" rx="20" ry="28"/><ellipse cx="50" cy="58" rx="20" ry="30"/><path d="M48 30 Q46 18 54 12" fill="none" stroke-width="5"/><path d="M38 52 L44 46 L48 54 Z M62 52 L56 46 L52 54 Z" fill="{INK}"/><path d="M36 68 Q50 80 64 68 L58 72 L54 68 L50 74 L46 68 L42 72 Z" fill="{INK}"/></g>',
 "ghost": f'<g {S}><path d="M20 90 L20 44 Q20 12 50 12 Q80 12 80 44 L80 90 L72 82 L64 90 L56 82 L50 90 L44 82 L36 90 L28 82 Z"/><ellipse cx="40" cy="42" rx="4" ry="6" fill="{INK}"/><ellipse cx="60" cy="42" rx="4" ry="6" fill="{INK}"/><ellipse cx="50" cy="58" rx="6" ry="8"/></g>',
 "witchhat": f'<g {S}><ellipse cx="50" cy="80" rx="42" ry="10"/><path d="M28 78 L46 16 Q50 8 56 18 L72 78 Z"/><path d="M31 66 Q50 72 69 66 L71 74 Q50 80 29 74 Z" fill="#fff"/><path d="M56 18 Q70 20 78 12" fill="none"/></g>',
 "cap": f'<g {S}><path d="M18 62 Q18 26 50 26 Q82 26 82 62 Z"/><path d="M60 62 L96 62 Q96 72 82 72 L60 72 Z"/><circle cx="50" cy="24" r="4"/><line x1="50" y1="28" x2="50" y2="62"/></g>',
 "ball": f'<g {S}><circle cx="50" cy="52" r="32"/><path d="M18 52 Q50 36 82 52" fill="none"/><path d="M50 20 Q36 52 50 84" fill="none"/></g>',
})
def icon(name, size=26):
    return f'<svg class="ic" viewBox="0 0 100 100" style="width:{size}mm;height:{size}mm" aria-hidden="true">{ICONS[name]}</svg>'
trace, line = base.trace, base.line
def head(title, sub):
    return (f'<div class="top"><span>2 КЛАС · МОДУЛЬ 2 · MY HOME</span><span>Name: ______________  Date: __________</span></div>'
            f'<h1>{title}</h1><p class="sub">{sub}</p>')

def scene(prep, obj, size=44):
    """Кіт і предмет: in / on / under / next to (SVG)."""
    cat, o = ICONS["cat"], ICONS[obj]
    POS = {  # (перетворення предмета, перетворення кота)
        ("in", "box"): ("translate(0,20) scale(1,0.8)", "translate(29,18) scale(0.42)"),
        ("on", "bed"): ("translate(0,36) scale(1,0.64)", "translate(25,6) scale(0.5)"),
        ("on", "table"): ("translate(0,36) scale(1,0.64)", "translate(25,14) scale(0.5)"),
        ("under", "chair"): ("translate(0,0)", "translate(33,57) scale(0.34)"),
        ("under", "bed"): ("translate(0,-22)", "translate(30,56) scale(0.4)"),
        ("next to", "sofa"): ("translate(-8,14) scale(0.82)", "translate(62,52) scale(0.4)"),
    }
    ot, ct = POS[(prep, obj)]
    o_svg, c_svg = f'<g transform="{ot}">{o}</g>', f'<g transform="{ct}">{cat}</g>'
    body = c_svg + o_svg if prep == "in" else o_svg + c_svg   # «in» — кіт за передньою стінкою
    return f'<svg class="ic" viewBox="0 0 100 100" style="width:{size}mm;height:{size}mm">{body}</svg>'

pages = []
# 1. My home — rooms
house = f'''<svg viewBox="0 0 200 150" style="width:150mm;height:112mm">
<g fill="#fff" stroke="{INK}" stroke-width="1.6" stroke-linejoin="round">
<path d="M10 52 L100 6 L190 52 Z"/><rect x="18" y="52" width="164" height="94"/>
<line x1="100" y1="52" x2="100" y2="146"/><line x1="18" y1="99" x2="182" y2="99"/>
<rect x="150" y="18" width="12" height="22"/></g>
<g transform="translate(36,56) scale(0.42)">{ICONS["bed"]}</g>
<g transform="translate(118,56) scale(0.42)">{ICONS["bathtub"]}</g>
<g transform="translate(36,102) scale(0.42)">{ICONS["sofa"]}</g>
<g transform="translate(118,102) scale(0.42)">{ICONS["stove"]}</g>
</svg>'''
pages.append(head("My home", "Подивись на кімнати. Напиши назву кожної кімнати в рамці під будинком і розфарбуй.") + f'''
<div class="bank">kitchen · bathroom · bedroom · living room</div>
<div style="text-align:center">{house}</div>
<div class="rooms">
 <div><p class="lab">1. Вгорі ліворуч (ліжко)</p>{line(12)}</div><div><p class="lab">2. Вгорі праворуч (ванна)</p>{line(12)}</div>
 <div><p class="lab">3. Внизу ліворуч (диван)</p>{line(12)}</div><div><p class="lab">4. Внизу праворуч (плита)</p>{line(12)}</div>
</div>''')

# 2. Things in my home
things = ["bed", "sofa", "chair", "lamp", "door", "window", "tv", "table"]
words = {"tv": "TV"}
cells = "".join(f'<div class="thing">{icon(t, 30)}{line(11)}</div>' for t in things)
pages.append(head("Things in my home", "Прочитай слова в рамці. Підпиши кожен малюнок і розфарбуй його.") +
             '<div class="bank">' + " · ".join(sorted(words.get(t, t) for t in things)) + f'</div><div class="grid4">{cells}</div>')

# 3. Where is the cat?
wq = [("in", "box"), ("on", "bed"), ("under", "chair"), ("next to", "sofa"), ("on", "table"), ("under", "bed")]
cells = "".join(f'''<div class="isit">{scene(p, o)}<div><p class="q">Where is the cat?</p>
<p class="yn3">It's <span>in</span> <span>on</span> <span>under</span> <span>next to</span> the {o}.</p></div></div>''' for p, o in wq)
pages.append(head("Where is the cat?", "Подивись, де кіт. Обведи правильне слово й прочитай речення вголос: It's on the bed.") + f'<div class="grid2">{cells}</div>' +
             '<p class="lab big">in — у, всередині · on — на · under — під · next to — поруч</p>')

# 4. Read and draw
rd = ["The cat is on the bed.", "The ball is under the chair.", "The hat is in the box.", "The lamp is next to the sofa."]
cells = "".join(f'<div class="draw"><p class="q">{s}</p><div class="frame2"></div></div>' for s in rd)
pages.append(head("Read and draw", "Прочитай речення й намалюй малюнок у рамці.") + f'<div class="grid2">{cells}</div>')

# 5. Short a: spell it
cvc = ["cat", "hat", "bag", "map", "van", "fan", "can", "pan"]
cells = "".join(f'<div class="cvc">{icon(w, 30)}<div class="boxes"><span></span><span class="v"></span><span></span></div></div>' for w in cvc)
pages.append(head("Short a: c-a-t", "Назви малюнок і послухай звуки. Впиши по одній літері в кожну клітинку. У середині — звук a, як у cat.") +
             f'<div class="grid4 tall">{cells}</div>' +
             '<p class="lab big">Прочитай уголос і плесни на кожен звук:</p><div class="bank big">cat · hat · bat · rat · van · fan · can · pan · map · cap · bag · jam · dad</div>')

# 6. Word families
fam = [("-at", ["c", "h", "b", "r"]), ("-an", ["v", "f", "c", "p"]), ("-ap", ["m", "c", "t", "n"])]
cols = "".join(f'<div class="fam"><div class="fh">{e}</div>' + "".join(f'<div class="fw"><b>{l}</b><span>{e[1:]}</span></div>' for l in ls) + '</div>' for e, ls in fam)
pages.append(head("Word families", "Прочитай слова в кожному стовпчику. Обведи букву, що змінюється, і прочитай: cat, hat, bat, rat.") +
             f'<div class="fams">{cols}</div>' + '<p class="lab big">Допиши свої слова:</p>' + trace("_at   _an   _ap", 13) + line(13))

# 7. My room
pages.append(head("My room", "Намалюй свою кімнату. Обведи речення й допиши, що ще є у твоїй кімнаті.") +
             '<div class="frame3"><span>This is my room.</span></div>' +
             trace("There is a bed in my room.", 11) + '<p class="lab">There is a</p>' + line(13) + '<p class="lab">There is a</p>' + line(13))

# 8. Halloween + I can
hw = ["pumpkin", "ghost", "witchhat", "bat"]
names = {"witchhat": "witch hat"}
cells = "".join(f'<div class="thing">{icon(h, 30)}<div style="text-align:center">{base.trace(names.get(h, h), 10)}</div></div>' for h in hw)
cans = ["I can name rooms: kitchen, bedroom…", "I can say: It's on / in / under the box.", "I can read cat, van, map.", "I can say: There is a bed in my room.", "I can say: Trick or treat!"]
checks = "".join(f'<div class="can"><span>{c}</span><span class="faces">☺ &nbsp; ☹</span></div>' for c in cans)
pages.append(head("Happy Halloween!", "Розфарбуй малюнки й обведи слова. Скажи: Trick or treat!") +
             f'<div class="grid4">{cells}</div>' + trace("Trick or treat!", 13) + f'<h2>I can …</h2><div class="cans">{checks}</div>')

CSS = base.CSS + f'''
.rooms {{ display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 8mm; }}
.yn3 {{ margin: 0; font-size: 12.5pt; line-height: 2; }}
.yn3 span {{ border: .3mm solid {LIGHT}; border-radius: 3mm; padding: .5mm 2mm; }}
.draw {{ border: .4mm solid {LIGHT}; border-radius: 4mm; padding: 4mm; }}
.draw .q {{ font-size: 14pt; font-weight: bold; margin: 0 0 3mm; }}
.frame2 {{ height: 72mm; border: .5mm dashed {LIGHT}; border-radius: 3mm; }}
.frame3 {{ height: 120mm; border: .6mm dashed {LIGHT}; border-radius: 5mm; display: flex; align-items: flex-end; justify-content: center; padding: 3mm; color: {SOFT}; font-size: 12pt; }}
.fams {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; margin-top: 3mm; }}
.fam {{ border: .5mm solid {INK}; border-radius: 4mm; padding: 3mm; }}
.fh {{ font-size: 22pt; font-weight: bold; text-align: center; color: {VOWEL}; margin-bottom: 2mm; }}
.fw {{ font-size: 26pt; text-align: center; letter-spacing: .04em; padding: 2mm 0; border-top: .3mm solid {LIGHT}; }}
.fw b {{ display: inline-block; width: 12mm; border: .4mm dashed {SOFT}; border-radius: 2mm; font-weight: normal; }}
.fw span {{ color: {INK}; }}
'''

def build(out_dir):
    out_dir = os.path.abspath(out_dir); os.makedirs(out_dir, exist_ok=True)
    html = (f'<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>My Home Worksheets</title>'
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

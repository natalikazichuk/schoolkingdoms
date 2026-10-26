"""Printable worksheets for Grade 2, Module 4 "Clothes" (+ winter holidays).
Same look as modules 1–3. Usage: python3 worksheets_g2m4.py OUT_DIR
After building: python3 "American English курс/brand_sheets.py" <OUT_DIR>/worksheets.pdf
"""
import os, sys, json, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import worksheets_g2m3 as m3

base, m2 = m3.base, m3.m2
INK, SOFT, RULE, LIGHT, VOWEL, S = base.INK, base.SOFT, base.RULE, base.LIGHT, base.VOWEL, base.S
ICONS = dict(m3.ICONS)
ICONS.update({
 "tshirt": f'<g {S}><path d="M34 14 Q50 24 66 14 L90 28 L80 46 L70 40 L70 90 L30 90 L30 40 L20 46 L10 28 Z"/><path d="M40 16 Q50 26 60 16" fill="none"/></g>',
 "pants": f'<g {S}><path d="M26 10 L74 10 L82 92 L58 92 L50 38 L42 92 L18 92 Z"/><line x1="26" y1="20" x2="74" y2="20"/><line x1="50" y1="20" x2="50" y2="38"/></g>',
 "shorts": f'<g {S}><path d="M22 22 L78 22 L86 70 L58 72 L50 44 L42 72 L14 70 Z"/><line x1="22" y1="32" x2="78" y2="32"/></g>',
 "dress": f'<g {S}><path d="M38 10 L44 10 Q50 18 56 10 L62 10 L62 30 L66 40 L86 90 L14 90 L34 40 L38 30 Z"/><line x1="36" y1="40" x2="64" y2="40"/><circle cx="40" cy="62" r="3"/><circle cx="58" cy="70" r="3"/><circle cx="48" cy="80" r="3"/></g>',
 "sweater": f'<g {S}><path d="M34 14 Q50 22 66 14 L88 26 L92 80 L80 82 L76 42 L72 42 L72 90 L28 90 L28 42 L24 42 L20 82 L8 80 L12 26 Z"/><path d="M38 16 Q50 26 62 16" fill="none"/><line x1="28" y1="82" x2="72" y2="82"/><path d="M38 56 L44 50 L50 56 L56 50 L62 56" fill="none"/><path d="M38 66 L44 60 L50 66 L56 60 L62 66" fill="none"/></g>',
 "coat": f'<g {S}><path d="M34 10 L50 22 L66 10 L88 24 L92 84 L78 86 L74 44 L72 92 L28 92 L26 44 L22 86 L8 84 L12 24 Z"/><line x1="50" y1="22" x2="50" y2="92"/><circle cx="56" cy="40" r="2.5" fill="{INK}"/><circle cx="56" cy="56" r="2.5" fill="{INK}"/><circle cx="56" cy="72" r="2.5" fill="{INK}"/><rect x="32" y="60" width="12" height="10"/></g>',
 "shoes": f'<g {S}><path d="M8 70 L8 50 Q8 42 18 44 L30 46 Q40 56 52 60 Q60 62 60 70 Z"/><path d="M42 82 L42 62 Q42 54 52 56 L64 58 Q74 68 86 72 Q94 74 94 82 Z"/><line x1="8" y1="64" x2="60" y2="64"/><line x1="42" y1="76" x2="94" y2="76"/></g>',
 "socks": f'<g {S}><path d="M18 10 L38 10 L38 56 L52 70 Q58 82 46 86 L22 72 Q16 66 18 58 Z"/><path d="M56 14 L76 14 L76 60 L90 74 Q96 86 84 90 L60 76 Q54 70 56 62 Z"/><line x1="18" y1="20" x2="38" y2="20"/><line x1="56" y1="24" x2="76" y2="24"/></g>',
 "boots": f'<g {S}><path d="M14 14 L36 14 L38 64 L56 70 Q62 74 60 84 L14 84 Z"/><path d="M54 10 L76 10 L78 60 L94 66 Q98 70 96 80 L54 80 Z"/><line x1="14" y1="76" x2="60" y2="76"/></g>',
 "scarf": f'<g {S}><path d="M18 26 Q50 40 82 26 L82 40 Q50 54 18 40 Z"/><path d="M60 44 L70 90 L54 90 L48 46 Z"/><line x1="56" y1="90" x2="54" y2="96"/><line x1="62" y1="90" x2="62" y2="96"/><line x1="68" y1="90" x2="70" y2="96"/><line x1="30" y1="30" x2="30" y2="44"/><line x1="44" y1="34" x2="44" y2="48"/></g>',
 "mittens": f'<g {S}><path d="M14 80 L14 40 Q14 22 30 22 Q44 22 44 40 L44 50 L50 44 Q56 42 56 50 L44 66 L44 80 Z"/><rect x="12" y="78" width="34" height="12" rx="3"/><path d="M86 80 L86 40 Q86 22 70 22 Q58 22 58 40 L58 80 Z" transform="translate(0,0)"/><rect x="56" y="78" width="32" height="12" rx="3"/></g>',
 "pin": f'<g {S}><circle cx="56" cy="30" r="20"/><path d="M42 44 L20 82" stroke-width="4"/><path d="M38 34 L64 58" /></g>',
 "bin": f'<g {S}><path d="M22 30 L78 30 L72 90 L28 90 Z"/><rect x="16" y="20" width="68" height="10" rx="3"/><rect x="40" y="12" width="20" height="8" rx="3"/><line x1="40" y1="40" x2="42" y2="82"/><line x1="50" y1="40" x2="50" y2="82"/><line x1="60" y1="40" x2="58" y2="82"/></g>',
 "lip": f'<g {S}><path d="M8 50 Q30 22 50 38 Q70 22 92 50 Q70 80 50 78 Q30 80 8 50 Z"/><path d="M8 50 Q50 58 92 50" fill="none"/></g>',
 "kid": f'<g {S}><circle cx="50" cy="40" r="26"/><path d="M26 32 Q36 12 60 16 Q76 20 76 34 Q60 24 40 30 Z" fill="{INK}"/><circle cx="41" cy="42" r="3" fill="{INK}"/><circle cx="59" cy="42" r="3" fill="{INK}"/><path d="M40 52 Q50 60 60 52" fill="none"/><path d="M22 96 Q24 70 50 70 Q76 70 78 96 Z"/></g>',
 "zip": f'<g {S}><rect x="38" y="6" width="24" height="88" rx="4"/>' + "".join(f'<line x1="42" y1="{y}" x2="50" y2="{y}"/><line x1="50" y1="{y + 5}" x2="58" y2="{y + 5}"/>' for y in range(14, 54, 10)) + '<rect x="40" y="56" width="20" height="16" rx="3"/><rect x="45" y="72" width="10" height="16" rx="3"/></g>',
 "win": f'<g {S}><path d="M28 14 L72 14 L70 44 Q66 62 50 62 Q34 62 30 44 Z"/><path d="M28 20 Q12 20 14 34 Q16 44 30 44" fill="none"/><path d="M72 20 Q88 20 86 34 Q84 44 70 44" fill="none"/><rect x="44" y="62" width="12" height="14"/><rect x="30" y="76" width="40" height="12" rx="2"/><path d="M50 24 L53 31 L60 31 L54 36 L56 43 L50 39 L44 43 L46 36 L40 31 L47 31 Z"/></g>',
 "bear": f'<g {S}><circle cx="30" cy="18" r="9"/><circle cx="70" cy="18" r="9"/><circle cx="50" cy="30" r="20"/><circle cx="43" cy="27" r="2.2" fill="{INK}"/><circle cx="57" cy="27" r="2.2" fill="{INK}"/><ellipse cx="50" cy="37" rx="7" ry="5"/><circle cx="50" cy="35" r="2" fill="{INK}"/>'
         f'<ellipse cx="50" cy="68" rx="22" ry="24"/><ellipse cx="22" cy="60" rx="7" ry="14" transform="rotate(25 22 60)"/><ellipse cx="78" cy="60" rx="7" ry="14" transform="rotate(-25 78 60)"/><ellipse cx="38" cy="92" rx="10" ry="6"/><ellipse cx="62" cy="92" rx="10" ry="6"/></g>',
})
def icon(name, size=26):
    big = " big" if size >= 60 else ""   # великі малюнки — тонші лінії
    return f'<svg class="ic{big}" viewBox="0 0 100 100" style="width:{size}mm;height:{size}mm" aria-hidden="true">{ICONS[name]}</svg>'
trace, line = base.trace, base.line
def head(title, sub):
    return (f'<div class="top"><span>2 КЛАС · МОДУЛЬ 4 · CLOTHES</span><span>Name: ______________  Date: __________</span></div>'
            f'<h1>{title}</h1><p class="sub">{sub}</p>')

pages = []
# 1. Clothes — label
cl = [("tshirt", "T-shirt"), ("pants", "pants"), ("dress", "dress"), ("sweater", "sweater"), ("coat", "coat"), ("shoes", "shoes"), ("socks", "socks"), ("scarf", "scarf")]
cells = "".join(f'<div class="thing">{icon(i, 30)}{line(11)}</div>' for i, w in cl)
pages.append(head("Clothes", "Прочитай слова в рамці. Підпиши кожен малюнок і розфарбуй його.") +
             '<div class="bank">' + " · ".join(sorted(w for i, w in cl)) + f'</div><div class="grid4">{cells}</div>' +
             '<p class="lab big">У США штани — <b>pants</b>, а не trousers!</p>')

# 2. Read and color
rc = [("tshirt", "a red T-shirt"), ("pants", "blue pants"), ("scarf", "a green scarf"), ("socks", "yellow socks"),
      ("dress", "a pink dress"), ("boots", "brown boots"), ("mittens", "purple mittens"), ("cap", "an orange cap")]
cells = "".join(f'<div class="thing">{icon(i, 30)}<p class="q" style="text-align:center;margin:1mm 0 0;font-size:12pt">{t}</p></div>' for i, t in rc)
pages.append(head("Read and color", "Прочитай і розфарбуй кожну річ потрібним кольором.") + f'<div class="grid4">{cells}</div>' +
             '<p class="lab big">a red T-shirt — одна річ (a). Blue pants, yellow socks — без a: штани, шкарпетки, чоботи — це пара.</p>')

# 3. Dress Teddy
pages.append(head("Dress Teddy", "Намалюй на Teddy одяг: светр, шарф, шапку, штани. Розфарбуй і допиши речення.") +
             f'<div style="text-align:center">{icon("bear", 120)}</div>' +
             trace("Teddy is wearing a sweater.", 11) + '<p class="lab">Teddy is wearing</p>' + line(12))

# 4. Hot or cold?
words = "T-shirt · shorts · sweater · coat · scarf · mittens · boots · cap · dress · socks"
cols = "".join(f'<div class="fam"><div style="text-align:center">{icon(ic, 24)}</div><div class="fh" style="color:{INK};font-size:16pt">{t}</div>' + line(11) * 4 + '</div>'
               for t, ic in [("hot — summer", "sun"), ("cold — winter", "mittens")])
pages.append(head("Hot or cold?", "Що ти вдягаєш, коли спекотно, а що — коли холодно? Напиши слова у правильний стовпчик.") +
             f'<div class="bank">{words}</div><div class="fams" style="grid-template-columns:1fr 1fr">{cols}</div>' +
             '<p class="lab big">Обведи речення:</p>' + trace("It's cold. Put on your coat!", 11))

# 5. Short i
cvc = ["pig", "six", "pin", "bin", "lip", "kid", "zip", "win"]
def pic(w):
    if w == "six":
        return f'<svg class="ic" viewBox="0 0 100 100" style="width:30mm;height:30mm"><rect x="22" y="14" width="56" height="72" rx="10" fill="#fff" stroke="{INK}" stroke-width="3"/><text x="50" y="68" text-anchor="middle" font-size="46" font-family="DejaVu Sans" fill="{INK}">6</text></svg>'
    return icon(w, 30)
cells = "".join(f'<div class="cvc">{pic(w)}<div class="boxes"><span></span><span class="v"></span><span></span></div></div>' for w in cvc)
pages.append(head("Short i: p-i-g", "Назви малюнок і послухай звуки. Впиши по одній літері в кожну клітинку. У середині — звук i, як у pig.") +
             f'<div class="grid4 tall">{cells}</div>' +
             '<p class="lab big">Прочитай уголос і плесни на кожен звук:</p><div class="bank big">pig · big · dig · wig · pin · bin · win · fin · sit · hit · kit · six · lip · zip · kid</div>')

# 6. Word families
fam = [("-ig", ["p", "b", "d", "w"]), ("-in", ["p", "b", "w", "f"]), ("-it", ["s", "h", "k", "f"])]
cols = "".join(f'<div class="fam"><div class="fh">{e}</div>' + "".join(f'<div class="fw"><b>{l}</b><span>{e[1:]}</span></div>' for l in ls) + '</div>' for e, ls in fam)
pages.append(head("Word families", "Прочитай слова в кожному стовпчику: pig, big, dig, wig. Обведи букву, що змінюється.") +
             f'<div class="fams">{cols}</div>' + '<p class="lab big">Прочитай речення й обведи слова з i:</p>' +
             trace("The big pig can sit.", 11) + trace("Six kids win!", 11))

# 7. Ugly Sweater Day
pages.append(head("Ugly Sweater Day", "У США в грудні вдягають найсмішніший різдвяний светр! Розмалюй свій светр: ялинки, сніжинки, олені.") +
             f'<div style="text-align:center">{icon("sweater", 120)}</div>' +
             trace("This is my sweater.", 11) + '<p class="lab">It\'s</p>' + line(12))

# 8. Whose hat? + I can
cans = ["I can name clothes: T-shirt, pants, coat…", "I can say: I'm wearing a red sweater.", "I can say: Put on your coat!", "I can read pig, six, win.", "I can say: Merry Christmas!"]
checks = "".join(f'<div class="can"><span>{c}</span><span class="faces">☺ &nbsp; ☹</span></div>' for c in cans)
pages.append(head("Whose hat is it?", "Обведи питання й відповідь. Намалюй свою шапку.") +
             f'<div class="me"><div style="text-align:center">{icon("hat", 50)}</div><div class="frame2" style="height:55mm"></div></div>' +
             trace("Whose hat is it?", 12) + trace("It's my hat.", 12) + f'<h2>I can …</h2><div class="cans">{checks}</div>')

CSS = m3.CSS + '\n.ic.big g { stroke-width: 1.3px; }\n'

def build(out_dir):
    out_dir = os.path.abspath(out_dir); os.makedirs(out_dir, exist_ok=True)
    html = (f'<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>Clothes Worksheets</title>'
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

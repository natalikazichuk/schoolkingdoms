"""Printable worksheets for Grade 2, Module 1 "Welcome Back!".
Builds an A4 HTML booklet with line-art SVG pictures (kids can color them),
then prints it to PDF with headless Chromium (Playwright).
Usage: python3 worksheets_g2m1.py OUT_DIR
"""
import os, random, subprocess, sys

INK = "#1f2a44"; SOFT = "#7a849c"; RULE = "#9fb3d6"; LIGHT = "#c9d3e6"; VOWEL = "#e4572e"

# ---------- line-art icons, 100x100 viewBox, white fill so children can color them ----------
S = f'fill="#fff" stroke="{INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"'
ICONS = {
 "pencil": f'<g transform="rotate(-35 50 50)" {S}><rect x="20" y="40" width="52" height="20"/><path d="M72 40 L92 50 L72 60 Z"/><path d="M86 47 L92 50 L86 53 Z" fill="{INK}"/><rect x="8" y="40" width="12" height="20" rx="4"/><line x1="20" y1="47" x2="72" y2="47"/><line x1="20" y1="53" x2="72" y2="53"/></g>',
 "ruler": f'<g transform="rotate(-20 50 50)" {S}><rect x="6" y="37" width="88" height="26" rx="3"/>' + "".join(f'<line x1="{x}" y1="37" x2="{x}" y2="{47 if i%2 else 51}"/>' for i, x in enumerate(range(14, 90, 8))) + '</g>',
 "book": f'<g {S}><rect x="22" y="12" width="58" height="76" rx="4"/><line x1="32" y1="12" x2="32" y2="88"/><rect x="42" y="28" width="28" height="14" rx="2"/></g>',
 "notebook": f'<g {S}><rect x="24" y="12" width="58" height="76" rx="3"/>' + "".join(f'<circle cx="24" cy="{y}" r="4"/>' for y in range(20, 88, 11)) + ''.join(f'<line x1="36" y1="{y}" x2="72" y2="{y}"/>' for y in (34, 46, 58, 70)) + '</g>',
 "eraser": f'<g {S}><path d="M14 62 L44 32 L86 32 L56 62 Z"/><path d="M14 62 L56 62 L56 76 L14 76 Z"/><path d="M56 62 L86 32 L86 46 L56 76 Z"/><path d="M30 46 L60 46" /><line x1="40" y1="62" x2="40" y2="76"/></g>',
 "scissors": f'<g {S}><circle cx="26" cy="72" r="12"/><circle cx="58" cy="78" r="12"/><path d="M34 63 L86 18 L80 14 L44 54 Z"/><path d="M50 68 L40 22 L46 20 L60 66 Z"/><circle cx="46" cy="58" r="2.5" fill="{INK}"/></g>',
 "backpack": f'<g {S}><path d="M36 22 a14 12 0 0 1 28 0" fill="none"/><rect x="20" y="22" width="60" height="68" rx="16"/><rect x="30" y="56" width="40" height="26" rx="6"/><line x1="30" y1="66" x2="70" y2="66"/><path d="M36 36 L64 36" /></g>',
 "marker": f'<g transform="rotate(-35 50 50)" {S}><rect x="26" y="38" width="50" height="24" rx="3"/><rect x="8" y="36" width="20" height="28" rx="4"/><path d="M76 42 L88 45 L88 55 L76 58 Z"/><rect x="88" y="46" width="5" height="8" fill="{INK}"/></g>',
 "pen": f'<g transform="rotate(-35 50 50)" {S}><rect x="14" y="43" width="62" height="14" rx="6"/><path d="M76 45 L92 50 L76 55 Z"/><path d="M20 43 L20 36 L46 36 L46 43" fill="none"/></g>',
 "bag": f'<g {S}><path d="M34 40 a16 18 0 0 1 32 0" fill="none"/><path d="M18 40 L82 40 L76 88 L24 88 Z"/><line x1="18" y1="52" x2="82" y2="52"/></g>',
 "map": f'<g {S}><path d="M10 24 L36 16 L64 26 L90 18 L90 78 L64 86 L36 76 L10 84 Z"/><line x1="36" y1="16" x2="36" y2="76"/><line x1="64" y1="26" x2="64" y2="86"/><path d="M20 66 Q34 50 48 58 T76 38" fill="none" stroke-dasharray="4 5"/><path d="M72 32 L80 40 M80 32 L72 40" stroke="{VOWEL}"/></g>',
 "cup": f'<g {S}><path d="M22 30 L70 30 L66 86 L26 86 Z"/><path d="M70 42 a12 12 0 0 1 0 26" fill="none"/><path d="M34 22 q4 -8 0 -14 M48 22 q4 -8 0 -14" fill="none"/></g>',
 "box": f'<g {S}><path d="M14 36 L50 22 L86 36 L50 50 Z"/><path d="M14 36 L14 74 L50 90 L50 50 Z"/><path d="M86 36 L86 74 L50 90 L50 50 Z"/><path d="M32 29 L68 43 L68 58" fill="none"/></g>',
 "bed": f'<g {S}><rect x="8" y="30" width="12" height="54" rx="3"/><rect x="20" y="52" width="72" height="18" rx="3"/><rect x="24" y="40" width="22" height="12" rx="6"/><path d="M46 52 L92 52 L92 44 Q70 38 46 46 Z"/><line x1="88" y1="70" x2="88" y2="84"/></g>',
 "sun": f'<g {S}><circle cx="50" cy="50" r="18"/>' + "".join(f'<line x1="50" y1="12" x2="50" y2="24" transform="rotate({a} 50 50)"/>' for a in range(0, 360, 45)) + f'<circle cx="44" cy="46" r="2" fill="{INK}"/><circle cx="56" cy="46" r="2" fill="{INK}"/><path d="M43 56 q7 6 14 0" fill="none"/></g>',
 "hat": f'<g {S}><ellipse cx="50" cy="74" rx="40" ry="10"/><path d="M28 74 L30 22 L70 22 L72 74 Z"/><rect x="29" y="56" width="42" height="10"/></g>',
 "cat": f'<g {S}><path d="M24 40 L22 14 L42 28 Z"/><path d="M76 40 L78 14 L58 28 Z"/><circle cx="50" cy="54" r="30"/><circle cx="39" cy="48" r="3.5" fill="{INK}"/><circle cx="61" cy="48" r="3.5" fill="{INK}"/><path d="M46 58 L54 58 L50 63 Z" fill="{INK}"/><path d="M50 63 q-6 7 -12 3 M50 63 q6 7 12 3" fill="none"/><path d="M16 56 L34 58 M16 66 L34 63 M84 56 L66 58 M84 66 L66 63" fill="none"/></g>',
 "dog": f'<g {S}><circle cx="50" cy="52" r="28"/><ellipse cx="22" cy="48" rx="10" ry="20" transform="rotate(15 22 48)"/><ellipse cx="78" cy="48" rx="10" ry="20" transform="rotate(-15 78 48)"/><circle cx="40" cy="46" r="3.5" fill="{INK}"/><circle cx="60" cy="46" r="3.5" fill="{INK}"/><ellipse cx="50" cy="60" rx="7" ry="5" fill="{INK}"/><path d="M50 65 q-6 8 -12 4 M50 65 q6 8 12 4" fill="none"/></g>',
 "pig": f'<g {S}><path d="M26 34 L22 14 L42 26 Z"/><path d="M74 34 L78 14 L58 26 Z"/><circle cx="50" cy="52" r="30"/><ellipse cx="50" cy="62" rx="14" ry="10"/><circle cx="45" cy="62" r="2.5" fill="{INK}"/><circle cx="55" cy="62" r="2.5" fill="{INK}"/><circle cx="38" cy="44" r="3.5" fill="{INK}"/><circle cx="62" cy="44" r="3.5" fill="{INK}"/></g>',
 "bus": f'<g {S}><rect x="8" y="24" width="84" height="50" rx="8"/><rect x="16" y="32" width="16" height="16" rx="2"/><rect x="38" y="32" width="16" height="16" rx="2"/><rect x="60" y="32" width="24" height="16" rx="2"/><line x1="8" y1="58" x2="92" y2="58"/><circle cx="28" cy="78" r="8"/><circle cx="72" cy="78" r="8"/></g>',
 "star": f'<g {S}><path d="M50 10 L61 38 L91 39 L67 58 L76 88 L50 70 L24 88 L33 58 L9 39 L39 38 Z"/></g>',
 "apple": f'<g {S}><path d="M50 30 C30 18 10 34 18 60 C24 80 40 90 50 82 C60 90 76 80 82 60 C90 34 70 18 50 30 Z"/><path d="M50 30 Q50 18 56 10" fill="none"/><path d="M54 20 Q66 10 74 18 Q64 26 54 20 Z"/></g>',
}

def icon(name, size=26):
    return f'<svg class="ic" viewBox="0 0 100 100" style="width:{size}mm;height:{size}mm" aria-hidden="true">{ICONS[name]}</svg>'

def trace(text, h_mm=14, color=SOFT):
    """Dotted tracing text on a 3-line writing guide."""
    fs = h_mm * 0.9 / 0.73
    return (f'<div class="wl" style="height:{h_mm}mm"><svg viewBox="0 0 1000 {h_mm*10}" preserveAspectRatio="xMinYMax meet" '
            f'style="position:absolute;left:3mm;bottom:0;height:100%;width:100%;overflow:visible">'
            f'<text x="0" y="{h_mm*10}" font-family="DejaVu Sans" font-size="{fs*10}" fill="none" stroke="{color}" '
            f'stroke-width="5" stroke-dasharray="7 9" stroke-linecap="round">{text}</text></svg></div>')

def line(h_mm=14):
    return f'<div class="wl" style="height:{h_mm}mm"></div>'

def head(title, sub):
    return (f'<div class="top"><span>2 КЛАС · МОДУЛЬ 1 · WELCOME BACK!</span><span>Name: ______________  Date: __________</span></div>'
            f'<h1>{title}</h1><p class="sub">{sub}</p>')

pages = []

# 1. All about me
pages.append(head("All about me", "Обведи речення й допиши про себе. Намалюй себе в рамці.") + f'''
<div class="me">
  <div class="frame"><span>This is me!</span></div>
  <div class="me-lines">
    <p class="lab">Hi! My name is</p>{line(13)}
    <p class="lab">I am</p>{trace("seven", 13)}
    <p class="lab">My favorite color is</p>{line(13)}
    <p class="lab">My teacher is</p>{line(13)}
  </div>
</div>
<p class="lab big">Обведи питання й відповідь:</p>
{trace("How old are you?", 13)}
{trace("I am seven.", 13)}
{trace("What is your name?", 13)}
{trace("My name is Anna.", 13)}
''')

# 2. ABC
random.seed(21)
ups = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
gaps_u = set(random.sample(range(1, 26), 9)); gaps_l = set(random.sample(range(1, 26), 9))
def abc_row(letters, gaps):
    return '<div class="abc">' + "".join(
        f'<span class="cell{" gap" if i in gaps else ""}">{"" if i in gaps else ch}</span>' for i, ch in enumerate(letters)) + '</div>'
pages.append(head("ABC: missing letters", "Впиши пропущені великі й малі літери. Розфарбуй клітинки з голосними: A, E, I, O, U.") + f'''
<p class="lab big">Uppercase letters</p>{abc_row(ups, gaps_u)}
<p class="lab big">Lowercase letters</p>{abc_row([c.lower() for c in ups], gaps_l)}
<p class="lab big">Обведи голосні й назви їхні звуки: a — apple, e — egg, i — igloo, o — octopus, u — umbrella</p>
{trace("a  e  i  o  u", 16, VOWEL)}
{trace("A  E  I  O  U", 16, VOWEL)}
''')

# 3. First sounds
first = [("cat","c",["c","d","m"]),("dog","d",["b","d","p"]),("sun","s",["s","r","z"]),("pen","p",["b","t","p"]),
         ("map","m",["n","m","w"]),("bus","b",["b","d","v"]),("hat","h",["k","h","f"]),("pig","p",["p","g","q"]),
         ("box","b",["d","p","b"]),("bed","b",["b","r","t"]),("cup","c",["k","c","g"]),("apple","a",["e","a","o"])]
cells = ""
for w, right, opts in first:
    cells += f'<div class="fs">{icon(w if w in ICONS else "apple", 34)}<div class="word">_{w[1:]}</div><div class="opts">' + "".join(f'<span>{o}</span>' for o in opts) + '</div></div>'
pages.append(head("First sounds", "Назви малюнок. Обведи кружечком перший звук і впиши його в слово.") + f'<div class="grid4">{cells}</div>')

# 4. School things
things = ["pencil", "ruler", "book", "eraser", "scissors", "backpack"]
bank = " · ".join(sorted(things))
cells = "".join(f'<div class="thing">{icon(t, 46)}{line(13)}</div>' for t in things)
pages.append(head("School things", "Прочитай слова в рамці. Підпиши кожен малюнок і розфарбуй його.") +
             f'<div class="bank">{bank}</div><div class="grid3">{cells}</div>')

# 5. Is it a ...?
qs = [("pencil","Is it a pencil?"),("book","Is it a ruler?"),("backpack","Is it a backpack?"),
      ("eraser","Is it a pen?"),("notebook","Is it a notebook?"),("marker","Is it a book?")]
cells = "".join(f'<div class="isit">{icon(p, 38)}<div><p class="q">{q}</p><p class="yn"><span>Yes, it is.</span><span>No, it isn\'t.</span></p></div></div>' for p, q in qs)
pages.append(head("Is it a …?", "Прочитай питання, подивись на малюнок і обведи правильну відповідь. Скажи її вголос.") + f'<div class="grid2">{cells}</div>')

# 6. Spell CVC
cvc = ["cat", "hat", "pen", "bed", "pig", "dog", "sun", "cup"]
cells = "".join(f'<div class="cvc">{icon(w, 34)}<div class="boxes"><span></span><span class="v"></span><span></span></div></div>' for w in cvc)
pages.append(head("Spell it: c-a-t", "Назви малюнок і послухай звуки. Впиши по одній літері в кожну клітинку. Голосний — у середній клітинці.") +
             f'<div class="grid4 tall">{cells}</div>' +
             '<p class="lab big">Read the words aloud. Прочитай слова вголос, плескаючи на кожен звук:</p><div class="bank big">cat · hat · map · bag · pen · ten · bed · pig · six · dog · box · sun · cup · bus</div>')

# 7. Numbers 11–20
random.seed(5)
nums = ["eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen","twenty"]
digits = list(range(11, 21)); random.shuffle(digits)
left = nums[:5]; right_d = sorted(digits[:0] + [11, 12, 13, 14, 15], key=lambda _: random.random())
match = "".join(f'<div class="m"><span class="w">{w}</span><i></i><i></i><span class="d">{d}</span></div>' for w, d in zip(left, right_d))
counts = [(12, "star"), (15, "apple"), (18, "star")]
cnt = ""
for n, ic in counts:
    cnt += '<div class="count"><div class="many">' + "".join(icon(ic, 12) for _ in range(n)) + '</div><p class="lab">How many? ___________</p></div>'
pages.append(head("Numbers 11–20", "З’єднай слово з числом. Порахуй малюнки й напиши число цифрами та словом.") +
             f'<div class="match">{match}</div>{cnt}')

# 8. Read, trace, I can
cans = ["I can say the alphabet.", "I can read cat, dog, sun.", "I can ask: Is it a …?", "I can count to 20.", "I can say: I am seven."]
checks = "".join(f'<div class="can"><span>{c}</span><span class="faces">☺ &nbsp; ☹</span></div>' for c in cans)
pages.append(head("Read and trace", "Прочитай і обведи речення. Потім розфарбуй смайлик: що ти вже вмієш?") +
             trace("It is a pen.", 14) + trace("My bag is red.", 14) + trace("Is it a ruler?", 14) + trace("The cat is on the box.", 14) +
             f'<h2>I can …</h2><div class="cans">{checks}</div>')

CSS = f'''
@page {{ size: A4; margin: 13mm 14mm; }}
* {{ box-sizing: border-box; }}
body {{ margin: 0; font-family: "DejaVu Sans", "Liberation Sans", sans-serif; color: {INK}; }}
.sheet {{ page-break-after: always; display: flex; flex-direction: column; gap: 4mm; }}
.sheet:last-child {{ page-break-after: auto; }}
.top {{ display: flex; justify-content: space-between; font-size: 8.5pt; color: {SOFT}; letter-spacing: .04em; }}
h1 {{ font-size: 21pt; margin: 2mm 0 0; }}
h2 {{ font-size: 15pt; margin: 4mm 0 0; }}
.sub {{ margin: 0 0 2mm; font-size: 10.5pt; color: {SOFT}; }}
.lab {{ margin: 2mm 0 0; font-size: 11pt; }}
.lab.big {{ font-weight: bold; font-size: 12pt; margin-top: 4mm; }}
.wl {{ position: relative; border-top: .3mm solid {RULE}; border-bottom: .4mm solid {RULE}; margin-top: 3mm; }}
.wl::after {{ content: ""; position: absolute; left: 0; right: 0; top: 28%; border-top: .3mm dashed {LIGHT}; }}
.me {{ display: grid; grid-template-columns: 62mm 1fr; gap: 8mm; align-items: start; }}
.frame {{ height: 100mm; border: .6mm dashed {LIGHT}; border-radius: 5mm; display: flex; align-items: flex-end; justify-content: center; padding: 3mm; color: {SOFT}; }}
.abc {{ display: grid; grid-template-columns: repeat(9, 1fr); gap: 2mm; }}
.cell {{ height: 19mm; border: .4mm solid {RULE}; border-radius: 3mm; display: grid; place-items: center; font-size: 26pt; }}
.cell.gap {{ border: .5mm dashed {INK}; }}
.grid4 {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 7mm 4mm; }}
.grid3 {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 10mm 6mm; margin-top: 4mm; }}
.grid2 {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 9mm 6mm; margin-top: 3mm; }}
.fs, .thing, .cvc {{ border: .4mm solid {LIGHT}; border-radius: 4mm; padding: 3mm; display: flex; flex-direction: column; align-items: center; gap: 2mm; }}
.fs .word {{ font-size: 26pt; letter-spacing: .06em; }}
.opts {{ display: flex; gap: 4mm; font-size: 20pt; }}
.opts span {{ width: 10mm; text-align: center; }}
.thing {{ align-items: stretch; }} .thing svg {{ align-self: center; }}
.bank.big {{ font-size: 18pt; line-height: 1.6; }}
.bank {{ border: .6mm solid {INK}; border-radius: 4mm; padding: 3mm 5mm; font-size: 16pt; text-align: center; letter-spacing: .02em; }}
.isit {{ display: flex; gap: 4mm; align-items: center; border: .4mm solid {LIGHT}; border-radius: 4mm; padding: 6mm 4mm; }}
.isit .q {{ font-size: 16pt; font-weight: bold; margin: 0 0 3mm; }}
.isit .yn {{ display: flex; flex-direction: column; gap: 3mm; margin: 0; font-size: 14pt; }}
.isit .yn span::before {{ content: "○  "; }}
.tall .cvc {{ padding-block: 4mm; }}
.boxes {{ display: flex; gap: 1.5mm; }}
.boxes span {{ width: 12mm; height: 15mm; border: .5mm solid {INK}; border-radius: 1.5mm; }}
.boxes span.v {{ border-color: {VOWEL}; background: #fff1ec; }}
.match {{ display: grid; gap: 4.5mm; margin: 2mm 0 4mm; }}
.m {{ display: grid; grid-template-columns: 40mm 6mm 1fr 6mm 14mm; align-items: center; font-size: 17pt; }}
.m i {{ width: 3mm; height: 3mm; background: {INK}; border-radius: 50%; display: block; }}
.m i:last-of-type {{ justify-self: end; }}
.m .d {{ text-align: right; font-weight: bold; }}
.count {{ border: .4mm solid {LIGHT}; border-radius: 4mm; padding: 4mm; margin-top: 4mm; }}
.many {{ display: flex; flex-wrap: wrap; gap: 1.5mm; }}
.cans {{ display: grid; gap: 4mm; }}
.can {{ display: flex; justify-content: space-between; align-items: center; font-size: 14pt; border-bottom: .3mm solid {LIGHT}; padding-bottom: 2mm; }}
.faces {{ font-size: 22pt; }}
'''

def build(out_dir):
    out_dir = os.path.abspath(out_dir); os.makedirs(out_dir, exist_ok=True)
    html = (f'<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>Welcome Back! Worksheets</title>'
            f'<style>{CSS}</style></head><body>' + "".join(f'<section class="sheet">{p}</section>' for p in pages) + '</body></html>')
    src = os.path.join(out_dir, "worksheets.html")
    open(src, "w", encoding="utf8").write(html)
    pdf = os.path.join(out_dir, "worksheets.pdf")
    js = ("const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();"
          f"await p.goto('file://{src}');await p.pdf({{path:'{pdf}',format:'A4',preferCSSPageSize:true,printBackground:true}});await b.close();}})();")
    subprocess.run(["node", "-e", js], check=True)
    os.remove(src)
    return pdf

if __name__ == "__main__":
    print(build(sys.argv[1] if len(sys.argv) > 1 else "."))

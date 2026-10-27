"""Збирає один PDF курсу «American English для молодшої школи».

Збирає два файли:
  1) «American English для молодшої школи.pdf» — обкладинка, зміст, про курс,
     програма кожного класу й сторінка-опис кожного готового модуля;
  2) «… — аркуші для друку.pdf» — зміст із номерами сторінок і всі аркуші A4.
Модуль вважається готовим, коли він є в MODS тренажера на сайті
(klas-N/...html) і є його аркуші: «N клас english/<папка модуля>/worksheets.pdf»
або файл за шаблоном worksheets_file з course.json (2 клас: klas-2/english-2/mNN.pdf).
Клас з "own_pdf": true збирається окремою парою файлів
«… · N клас.pdf» і «… · N клас — аркуші для друку.pdf», а не в спільні.
Програма, місяці, фрази, пісні — у course.json поруч із цим скриптом.

Запуск (з кореня репозиторію або звідки завгодно):
  python3 "American English курс/build_course.py"
Потрібно: python3 + pypdf + reportlab, node + playwright (Chromium), шрифт DejaVu Sans.
"""
import datetime, html, json, os, re, subprocess, sys, tempfile
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, "American English для молодшої школи.pdf")
WS_NAME = "American English для молодшої школи — аркуші для друку.pdf"
OUT_WS = os.path.join(HERE, WS_NAME)
C = json.load(open(os.path.join(HERE, "course.json"), encoding="utf8"))
INK, SOFT, LINE, ACC, ACC2 = "#1f2a44", "#66708a", "#d6dceb", "#2e86de", "#e4572e"
COLS = ["#e4572e", "#2e86de", "#3aa65b", "#8e5bd6", "#e0a000", "#e0457b"]
e = lambda s: html.escape(str(s))
noemo = lambda s: re.sub(r"[\U0001F000-\U0001FAFF☀-➿️‍⬀-⯿]", "", str(s)).replace("  ", " ").strip()

def teddy(pose, h_mm, cls=""):
    """Teddy Star як data-URI (PNG), щоб Chromium точно підхопив картинку."""
    import base64, io
    from PIL import Image
    im = Image.open(os.path.join(ROOT, "img/teddy", pose + ".webp")).convert("RGBA"); b = io.BytesIO(); im.save(b, "PNG")
    return f'<img class="{cls}" style="height:{h_mm}mm" src="data:image/png;base64,{base64.b64encode(b.getvalue()).decode()}" alt="Teddy Star">'

def site_mods(path):
    src = open(os.path.join(ROOT, path), encoding="utf8").read()
    block = re.search(r"const MODS = \[\n(.*?)\n\];", src, re.S).group(1)
    return {m["n"]: m for m in (json.loads(l.strip().rstrip(",")) for l in block.splitlines() if l.strip().startswith("{"))}

CSS = f"""
@page {{ size: A4; margin: 13mm 15mm 15mm; }}
* {{ box-sizing: border-box; }}
body {{ margin: 0; font-family: "DejaVu Sans", sans-serif; color: {INK}; font-size: 10.5pt; line-height: 1.45; }}
.pg {{ page-break-after: always; }} .pg:last-child {{ page-break-after: auto; }}
.eyebrow {{ font-size: 8.5pt; letter-spacing: .08em; text-transform: uppercase; color: {SOFT}; }}
h1 {{ font-size: 24pt; line-height: 1.1; margin: 2mm 0 4mm; }}
h2 {{ font-size: 13pt; margin: 4.5mm 0 1.5mm; }}
h3 {{ font-size: 11pt; margin: 3mm 0 1mm; }}
p {{ margin: 0 0 2.5mm; }}
table {{ width: 100%; border-collapse: collapse; font-size: 8.6pt; }}
td.l {{ white-space: nowrap; }}
th, td {{ text-align: left; vertical-align: top; padding: 1.2mm 1.8mm; border-bottom: .3mm solid {LINE}; }}
th {{ font-size: 8pt; text-transform: uppercase; letter-spacing: .05em; color: {SOFT}; border-bottom: .5mm solid {INK}; }}
td.n {{ font-weight: bold; white-space: nowrap; }}
.muted {{ color: {SOFT}; }}
.pill {{ white-space: nowrap; display: inline-block; font-size: 8pt; padding: .4mm 2mm; border-radius: 3mm; border: .3mm solid {LINE}; color: {SOFT}; }}
.pill.ok {{ border-color: #3aa65b; color: #2b8a4a; }}
.cover {{ height: 255mm; display: flex; flex-direction: column; justify-content: space-between; }}
.cover h1 {{ font-size: 36pt; margin-top: 30mm; }}
.cover .top {{ display: grid; grid-template-columns: 1fr auto; gap: 6mm; align-items: end; }}
.mascot {{ display: grid; grid-template-columns: 1fr 1fr; gap: 3mm 6mm; margin-top: 3mm; }}
.pose {{ display: flex; align-items: center; gap: 3mm; font-size: 9pt; }}
.cover .flag {{ display: flex; gap: 2mm; margin-top: 8mm; }}
.cover .flag span {{ width: 18mm; height: 18mm; border-radius: 4mm; display: grid; place-items: center; color: #fff; font-size: 20pt; font-weight: bold; }}
.toc td {{ font-size: 10pt; padding: 1.3mm 2mm; }} .toc td.pg {{ text-align: right; width: 18mm; }}
.toc tr.g td {{ font-weight: bold; font-size: 11pt; padding-top: 4mm; border-bottom: .5mm solid {INK}; }}
.letters {{ display: flex; gap: 2mm; margin: 2mm 0 3mm; flex-wrap: wrap; }}
.letters div {{ width: 27.5mm; font-size: 8.6pt; padding: 2mm 1mm; border: .5mm solid; border-radius: 3mm; padding: 2mm; text-align: center; }}
.letters b {{ display: block; font-size: 20pt; line-height: 1.1; }}
.cols {{ display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }}
ul {{ margin: 0; padding-left: 5mm; }} li {{ margin-bottom: 1mm; }}
.dlg {{ font-size: 9.4pt; line-height: 1.32; }} .dlg p {{ margin: 0 0 .9mm; }} .dlg .t {{ color: {ACC}; font-weight: bold; }}
.box {{ border: .4mm solid {LINE}; border-radius: 3mm; padding: 3mm 4mm; margin-top: 4mm; }}
.box b {{ color: {INK}; }}
a {{ color: {ACC}; text-decoration: none; font-weight: bold; }}
ul.songs li {{ margin-bottom: .8mm; line-height: 1.25; }}
.url {{ font-size: 7pt; color: {SOFT}; word-break: break-all; }}
p.res {{ font-size: 8.8pt; margin: 0 0 1.4mm; }}
"""

def doc(body):
    return f'<!doctype html><html lang="uk"><head><meta charset="utf-8"><style>{CSS}</style></head><body>{body}</body></html>'

def mascot_html():
    M = C["mascot"]
    poses = "".join(f'<div class="pose">{teddy(p, 22)}<span>{e(t)}</span></div>' for p, t in M["poses"])
    return (f'<section class="pg"><div class="eyebrow">Маскот курсу</div><div class="top" style="display:grid;grid-template-columns:1fr auto;gap:6mm;align-items:start">'
            f'<div><h1>{e(M["name"])}</h1>' + "".join(f"<p>{e(x)}</p>" for x in M["bio"]) + f'</div>{teddy("globe", 52)}</div>'
            f'<h2>Пози й де вони з’являються</h2><div class="mascot">{poses}</div>'
            '<p class="muted" style="margin-top:3mm">Файли поз — img/teddy/&lt;поза&gt;.webp (прозорий фон).</p></section>')

def about_html():
    return doc('<section class="pg"><div class="eyebrow">Про курс</div><h1>Як влаштований курс</h1>' +
               "".join(f"<p>{e(p)}</p>" for p in C["about"]) +
               "<h2>Як користуватися</h2><ul>" + "".join(f"<li>{e(p)}</li>" for p in C["howto"]) + "</ul>" +
               f'<h2>Пісні</h2><p>{e(C["songs_note"])}</p>' +

               "<h2>Класи</h2><table><tr><th>Клас</th><th>Назва</th><th>Готово</th><th>Тренажер на сайті</th><th>Файл PDF</th></tr>" +
               "".join(f'<tr><td class="n">{g["grade"]} клас</td><td>{e(g["title"].split("·",1)[1].strip())}</td><td>{g["_ready"]} з {len(g["modules"])} модулів</td><td>{e(g["site"])}</td><td>{e(g["_file"])}</td></tr>' for g in C["grades"]) +
               "".join(f'<tr><td class="n">{e(x)}</td><td class="muted">у планах</td><td>—</td><td>—</td><td>—</td></tr>' for x in C.get("planned", [])) +
               "</table></section>" + mascot_html())

def grade_html(g):
    rows = ""
    for m in g["modules"]:
        st = '<span class="pill ok">готовий</span>' if m["_ready"] else '<span class="pill">у розробці</span>'
        extra = m.get("_letters") or m.get("phonics", "")
        rows += f'<tr><td class="n">{m["n"]}</td><td><b>{e(m["_title"])}</b><br><span class="muted">{e(m["month"])}, {m["hours"]} год</span></td><td class="{'l' if g['grade'] == 1 else ''}">{e(extra)}</td><td>{e(m["phrases"])}</td><td>{st}</td></tr>'
    extra_h = "Літери" if g["grade"] == 1 else "Фоніка"
    res = "".join(f'<p class="res"><b>{e(a)}.</b> {e(b)}</p>' for a, b in g["results"])
    return doc(f'<section class="pg"><div class="eyebrow">{g["grade"]} клас · програма</div><h1>{e(g["title"])}</h1>'
               f'<p>{e(g["goal"])}</p><p class="muted">{e(g["hours"])} · тренажер на сайті: {e(g["site"])}</p>'
               f'<h2>Модулі року</h2><table><tr><th>№</th><th>Модуль</th><th>{extra_h}</th><th>Мовні зразки</th><th>Стан</th></tr>{rows}</table>'
               f'<h2>Що дитина вміє наприкінці року</h2>{res}</section>')

def module_html(g, m, sm):
    head = f'<div class="eyebrow">{g["grade"]} клас · Module {m["n"]} · {e(m["month"])} · {m["hours"]} год</div><h1>Module {m["n"]} · {e(m["_title"])}</h1>'
    lead = f'<p class="muted">{e(sm.get("ua", ""))}</p>'
    body = ""
    if g["grade"] == 1:
        body += "<h3>Літери модуля</h3><div class=\"letters\">" + "".join(
            f'<div style="border-color:{COLS[i % 6]}"><b style="color:{COLS[i % 6]}">{e(l[0])}{e(l[1])}</b>{e(l[2])}<br><span class="muted">{e(l[4])}</span></div>'
            for i, l in enumerate(sm["L"])) + "</div>"
        words = ", ".join(f"{v[0]} ({v[2]})" for v in sm["V"])
        more = ", ".join(x[0] for x in sm.get("X", []))
        body += f'<div class="cols"><div><h3>Слова теми</h3><p>{e(words)}</p><h3>Ще слова на ці літери</h3><p>{e(more)}</p></div>'
    else:
        words = ", ".join(f"{v[0]} ({v[2]})" for v in sm["V"])
        cvc = ", ".join(x[0] for x in (sm.get("W") or sm.get("C") or []))
        body += f'<div class="cols"><div><h3>Слова теми</h3><p>{e(words)}</p><h3>Фоніка</h3><p>{e(m.get("phonics", ""))}</p><h3>Читаємо за звуками</h3><p>{e(cvc)}</p></div>'
    songs = "".join(f'<li><a href="{e(x["url"])}">{e(x["title"])}</a><br><span class="url">{e(x["url"].replace("https://", ""))}</span></li>' for x in m["songs"])
    body += (f'<div><h3>Мовні зразки</h3><p>{e(m["phrases"])}</p><h3>Пісні (Super Simple Songs)</h3><ul class="songs">{songs}</ul>'
             f'<h3>Культура США</h3><p>{e(m["culture"])}</p></div></div>')
    dlg = ""
    for line, opts, ok in sm.get("D", []):
        a = opts[ok] if ok >= 0 else opts[0]
        dlg += f'<p><span class="t">Teddy:</span> {e(noemo(line.replace("{n}", "Anna")))}<br><span class="muted">Дитина:</span> {e(noemo(a.replace("{n}", "Anna")))}</p>'
    body += f'<h3>Діалог з Teddy (рівень тренажера)</h3><div class="dlg">{dlg}</div>'
    lv = " → ".join(g["level_names"])
    body += (f'<div class="box"><b>На сайті:</b> {e(g["site"])}?m={m["n"]} — рівні: {e(lv)}. Нагорода — за весь модуль.<br>'
             f'<b>Аркуші для друку ({m["_ws_pages"]} шт.):</b> окремий файл «{e(g["_ws_file"])}», с. {m["_ws_from"]}–{m["_ws_to"]}, або кнопка «Аркуші для друку» в тренажері.</div>')
    return doc(f'<section class="pg">{head}{lead}{body}</section>')

def cover_toc_html(toc, grades, title=None, sub=None):
    today = datetime.date.today().strftime("%d.%m.%Y")
    cover = (f'<section class="pg cover"><div><div class="eyebrow">SchoolKingdoms · курс англійської</div><h1>{e(title or C["title"])}</h1>'
             f'<p style="font-size:13pt;max-width:150mm">{e(sub or C["subtitle"])}</p>'
             '<div class="top"><div class="flag">' + "".join(f'<span style="background:{COLS[i]}">{ch}</span>' for i, ch in enumerate("ABCDEF")) + '</div>'
             f'<div style="text-align:center">{teddy("wave", 95)}<div class="muted">{e(C["mascot"]["name"])}: Let\'s learn together!</div></div></div></div>'
             f'<div class="muted">Оновлено {today} · ' + " · ".join(f'{g["grade"]} клас: {g["_ready"]}/{len(g["modules"])} модулів' for g in grades) + '</div></section>')
    rows = ""
    for kind, text, page in toc:
        rows += f'<tr class="{"g" if kind == "g" else ""}"><td>{"" if kind == "g" else "&nbsp;&nbsp;"}{e(text)}</td><td class="pg">{page}</td></tr>'
    return doc(cover + f'<section class="pg"><div class="eyebrow">Зміст</div><h1>Зміст</h1><table class="toc">{rows}</table></section>')

def render(jobs, tmp):
    """jobs: [(name, html)] → {name: pdf_path} through one Chromium session."""
    spec = []
    for name, h in jobs:
        src = os.path.join(tmp, name + ".html"); open(src, "w", encoding="utf8").write(h)
        spec.append({"src": "file://" + src, "out": os.path.join(tmp, name + ".pdf")})
    js = ("const {chromium}=require('playwright');const S=" + json.dumps(spec) +
          ";(async()=>{const b=await chromium.launch();const p=await b.newPage();for(const j of S){await p.goto(j.src);"
          "await p.pdf({path:j.out,format:'A4',preferCSSPageSize:true,printBackground:true});}await b.close();})();")
    subprocess.run(["node", "-e", js], check=True)
    return {name: os.path.join(tmp, name + ".pdf") for name, _ in jobs}

def stamp(writer, skip_first, label):
    pdfmetrics.registerFont(TTFont("DJ", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
    for i, page in enumerate(writer.pages):
        if i < skip_first: continue
        w, h = float(page.mediabox.width), float(page.mediabox.height)
        tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False).name
        c = rl_canvas.Canvas(tmp, pagesize=(w, h)); c.setFont("DJ", 7.5); c.setFillColorRGB(.45, .48, .56)
        c.drawCentredString(w / 2, 14, f"{label} · {i + 1}"); c.save()
        page.merge_page(PdfReader(tmp).pages[0]); os.unlink(tmp)

def ws_cover_html(toc, title, desc_file):
    today = datetime.date.today().strftime("%d.%m.%Y")
    rows = "".join(f'<tr class="{"g" if k == "g" else ""}"><td>{"" if k == "g" else "&nbsp;&nbsp;"}{e(t)}</td><td class="pg">{pg}</td></tr>' for k, t, pg in toc)
    return doc(f'<section class="pg"><div class="eyebrow">{e(title)}</div><h1>Аркуші для друку</h1>'
               f'<p>Усі аркуші A4 готових модулів. Друкуйте потрібні сторінки модуля — номери нижче. Опис модулів і програма — у файлі «{e(desc_file)}».</p>'
               f'<p class="muted">Оновлено {today}</p><table class="toc">{rows}</table></section>')

def assemble(head, parts, out, label, title):
    """head: PDF з першими сторінками; parts: [(path, label, start_page, kind)]."""
    w = PdfWriter()
    for p in PdfReader(head).pages: w.add_page(p)
    for path, _, _, _ in parts:
        for p in PdfReader(path).pages: w.add_page(p)
    stamp(w, 1, label)
    cur = None
    for path, lab, start, kind in parts:
        if not lab: continue
        if kind == "g": cur = w.add_outline_item(lab, start - 1)
        else: w.add_outline_item(lab, start - 1, parent=cur)
    w.add_metadata({"/Title": title, "/Author": "SchoolKingdoms"})
    with open(out, "wb") as f: w.write(f)
    print(out, len(PdfReader(out).pages), "сторінок")

def prepare(tmp):
    """Дані класів: модулі, готовність, файли аркушів. Аркуші з worksheets_file (їх генерує скрипт
    тренажера, без шапки) оформлюються як у brand_sheets.py — на копії в tmp, оригінал не чіпаємо."""
    for g in C["grades"]:
        sm = site_mods(g["site_mods_from"])
        g["_site"] = sm; g["_ready"] = 0
        if g.get("own_pdf"):
            g["_file"] = f'{C["title"]} · {g["grade"]} клас.pdf'
            g["_ws_file"] = f'{C["title"]} · {g["grade"]} клас — аркуші для друку.pdf'
        else:
            g["_file"] = os.path.basename(OUT); g["_ws_file"] = WS_NAME
        for m in g["modules"]:
            s = sm.get(m["n"])
            m["_title"] = (s or {}).get("t") or m.get("title", f"Module {m['n']}")
            if s and "L" in s: m["_letters"] = " ".join(l[0] for l in s["L"])
            if not s: ws = None
            elif g.get("worksheets_file"): ws = os.path.join(ROOT, g["worksheets_file"].format(n=m["n"]))
            else: ws = os.path.join(ROOT, g["worksheets_dir"], s["pdf"], "worksheets.pdf")
            m["_ws"] = ws if ws and os.path.exists(ws) else None
            m["_ready"] = bool(s and m["_ws"])
            if m["_ready"] and g.get("worksheets_file"):
                import shutil, brand_sheets
                cp = os.path.join(tmp, f"ws-g{g['grade']}m{m['n']}.pdf"); shutil.copy(m["_ws"], cp)
                brand_sheets.brand(cp); m["_ws"] = cp
            m["_ws_pages"] = len(PdfReader(m["_ws"]).pages) if m["_ready"] else 0
            g["_ready"] += m["_ready"]

def build(tmp, grades, out, out_ws, title, sub, others):
    """Пара файлів (опис курсу + аркуші) для групи класів. others — класи з окремими файлами (у змісті — посиланням)."""
    # 1) файл аркушів: с. 1 — обкладинка зі змістом, далі аркуші модулів
    ws_parts, ws_toc, page = [], [], 2
    for g in grades:
        first = True
        for m in g["modules"]:
            if not m["_ready"]: continue
            if first: ws_toc.append(("g", g["title"], "")); first = False
            m["_ws_from"], m["_ws_to"] = page, page + m["_ws_pages"] - 1
            ws_toc.append(("m", f"Module {m['n']} · {m['_title']}", f"{m['_ws_from']}–{m['_ws_to']}"))
            ws_parts.append((m["_ws"], f"{g['grade']} клас · Module {m['n']} · {m['_title']}", page, "m"))
            page += m["_ws_pages"]
    key = "-".join(str(g["grade"]) for g in grades)
    jobs = [(f"about{key}", about_html()), (f"wscover{key}", ws_cover_html(ws_toc, title, os.path.basename(out)))]
    for g in grades:
        jobs.append((f"g{g['grade']}", grade_html(g)))
        for m in g["modules"]:
            if m["_ready"]: jobs.append((f"g{g['grade']}m{m['n']}", module_html(g, m, g["_site"][m["n"]])))
    pdfs = render(jobs, tmp)
    assert len(PdfReader(pdfs[f"wscover{key}"]).pages) == 1, "зміст аркушів має вміщатися на 1 сторінку"
    assemble(pdfs[f"wscover{key}"], ws_parts, out_ws, "Аркуші для друку", title + " — аркуші для друку")
    # 2) файл курсу: обкладинка, зміст, про курс, програми класів, описи модулів
    parts, toc, page = [], [], 3
    def add(path, label=None, kind="m"):
        nonlocal page
        n = len(PdfReader(path).pages)
        if label: toc.append((kind, label, page))
        parts.append((path, label, page, kind)); page += n
    add(pdfs[f"about{key}"], "Про курс", "g")
    for g in grades:
        add(pdfs[f"g{g['grade']}"], g["title"], "g")
        for m in g["modules"]:
            if m["_ready"]: add(pdfs[f"g{g['grade']}m{m['n']}"], f"Module {m['n']} · {m['_title']}")
    for g in others: toc.append(("g", f"{g['title']} — окремий файл «{g['_file']}»", "—"))
    for x in C.get("planned", []): toc.append(("g", f"{x} — у планах", "—"))
    head = render([(f"cover{key}", cover_toc_html(toc, grades, title, sub))], tmp)[f"cover{key}"]
    assert len(PdfReader(head).pages) == 2, "обкладинка + зміст мають бути по 1 сторінці"
    assemble(head, parts, out, title, title)

def main():
    with tempfile.TemporaryDirectory() as tmp:
        prepare(tmp)
        own = [g for g in C["grades"] if g.get("own_pdf")]
        common = [g for g in C["grades"] if not g.get("own_pdf")]
        if common:
            build(tmp, common, OUT, OUT_WS, C["title"], C["subtitle"], own)
        for g in own:
            t = f'{C["title"]} · {g["grade"]} клас'
            build(tmp, [g], os.path.join(HERE, g["_file"]), os.path.join(HERE, g["_ws_file"]), t,
                  f'{g["title"]}: програма, тренажер на сайті SchoolKingdoms і аркуші для друку',
                  [x for x in C["grades"] if x is not g])

if __name__ == "__main__":
    main()

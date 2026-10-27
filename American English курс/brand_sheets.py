"""Оформлення аркушів для друку, як у «Списуванні» (klas-1/spysuvannya.html):
угорі праворуч — логотип SchoolKingdoms (logo-big.webp), ліворуч від нього —
адреса сайту school-king.pp.ua; унизу праворуч — маскот Teddy Star з олівцем.

Щоб шапка не налазила на вміст, сторінка зменшується до 94 % і зсувається
вниз — угорі звільняється смуга ~18 мм.

Обробляє «1 клас english/*/worksheets.pdf». Аркуші 2 класу (klas-2/english-2/mNN.pdf)
оформлює build_course.py на копії при збиранні — оригінали лишаються чистими.
Повторний запуск нічого не дублює: оброблені файли мають позначку /SKBrand.
Новий модуль: покладіть його чистий worksheets.pdf і запустіть
  python3 "American English курс/brand_sheets.py" [шлях ...]
"""
import glob, io, os, sys
from PIL import Image
from pypdf import PdfReader, PdfWriter, Transformation
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
SITE = "school-king.pp.ua"
LOGO = os.path.join(ROOT, "logo-big.webp")
TEDDY = os.path.join(ROOT, "img/teddy/pencil.webp")
SCALE = 0.94
pdfmetrics.registerFont(TTFont("DJB", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))

def img_reader(path, max_px):
    """Картинка, зменшена до розміру, достатнього для друку (~300 dpi)."""
    im = Image.open(path).convert("RGBA"); im.thumbnail((max_px, max_px), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, "PNG", optimize=True); b.seek(0)
    return ImageReader(b), im.width / im.height

def overlay(W, H, logo, lr, ted, tr):
    """Одна сторінка-накладка (шапка + Teddy) — спільна для всіх сторінок файлу."""
    buf = io.BytesIO(); c = canvas.Canvas(buf, pagesize=(W, H))
    lw = 26 * mm; lh = lw / lr; right = 10 * mm
    c.drawImage(logo, W - right - lw, H - 2.5 * mm - lh, lw, lh, mask="auto")
    c.setFont("DJB", 9.5); c.setFillColorRGB(0x4f / 255, 0x86 / 255, 0xd6 / 255)
    c.drawRightString(W - right - lw - 3 * mm, H - 2.5 * mm - lh / 2 - 1.2 * mm, SITE)
    th = 20 * mm; c.drawImage(ted, W - 9 * mm - th * tr, 5 * mm, th * tr, th, mask="auto")
    c.save(); buf.seek(0)
    return PdfReader(buf).pages[0]

def share_images(writer):
    """Однакові картинки (логотип, Teddy) — один об'єкт на весь файл, а не копія на кожній сторінці."""
    import hashlib
    from pypdf.generic import NameObject
    seen = {}
    for page in writer.pages:
        xo = page.get("/Resources", {}).get_object().get("/XObject")
        if not xo: continue
        xo = xo.get_object()
        for name in list(xo.keys()):
            ref = xo.raw_get(name); obj = ref.get_object()
            if obj.get("/Subtype") != "/Image": continue
            h = hashlib.sha1(obj.get_data() + repr(sorted((k, str(v)) for k, v in obj.items() if k != "/SMask")).encode()).hexdigest()
            if h in seen: xo[NameObject(name)] = seen[h]
            else: seen[h] = ref

def brand(path):
    r = PdfReader(path)
    meta = dict(r.metadata or {})
    if meta.get("/SKBrand"): print("вже оформлено:", path); return
    logo, lr = img_reader(LOGO, 260); ted, tr = img_reader(TEDDY, 200)
    out = PdfWriter(); ov = {}
    for page in r.pages:
        W, H = float(page.mediabox.width), float(page.mediabox.height)
        page.add_transformation(Transformation().scale(SCALE, SCALE).translate(W * (1 - SCALE) / 2, 0))
        key = (round(W), round(H))
        if key not in ov: ov[key] = overlay(W, H, logo, lr, ted, tr)
        page.merge_page(ov[key]); out.add_page(page)
    share_images(out)
    out.compress_identical_objects(remove_identicals=True, remove_orphans=True)
    meta.pop("/TeddyStar", None); meta["/SKBrand"] = "1"
    out.add_metadata(meta)
    with open(path, "wb") as f: out.write(f)
    print("готово:", path)

if __name__ == "__main__":
    files = sys.argv[1:] or sorted(glob.glob(os.path.join(ROOT, "1 клас english/module-*/worksheets.pdf")) +
                                   glob.glob(os.path.join(ROOT, "2 клас english/module-*/worksheets.pdf")))
    for f in files: brand(f)

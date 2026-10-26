"""Додає маскота Teddy Star (поза з олівцем) у правий нижній кут кожної сторінки
аркушів для друку: «1 клас english/*/worksheets.pdf», «2 клас english/*/worksheets.pdf».
Повторний запуск нічого не дублює: оброблені файли мають позначку /TeddyStar у метаданих.
Запуск: python3 "American English курс/stamp_teddy.py" [шлях до worksheets.pdf ...]
"""
import glob, io, os, sys
from PIL import Image
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
POSE = os.path.join(ROOT, "img/teddy/pencil.webp")

def stamp(path):
    r = PdfReader(path)
    if (r.metadata or {}).get("/TeddyStar"): print("вже є:", path); return
    img = Image.open(POSE).convert("RGBA"); buf = io.BytesIO(); img.save(buf, "PNG"); buf.seek(0)
    ir = ImageReader(buf); h = 20 * mm; w = h * img.width / img.height
    w_out = PdfWriter()
    for page in r.pages:
        W, H = float(page.mediabox.width), float(page.mediabox.height)
        tmp = io.BytesIO(); c = canvas.Canvas(tmp, pagesize=(W, H))
        c.drawImage(ir, W - 9 * mm - w, 5 * mm, w, h, mask="auto"); c.save(); tmp.seek(0)
        page.merge_page(PdfReader(tmp).pages[0]); w_out.add_page(page)
    w_out.add_metadata({**{k: v for k, v in (r.metadata or {}).items()}, "/TeddyStar": "1"})
    with open(path, "wb") as f: w_out.write(f)
    print("готово:", path)

if __name__ == "__main__":
    files = sys.argv[1:] or sorted(glob.glob(os.path.join(ROOT, "1 клас english/module-*/worksheets.pdf")) +
                                   glob.glob(os.path.join(ROOT, "2 клас english/module-*/worksheets.pdf")))
    for f in files: stamp(f)

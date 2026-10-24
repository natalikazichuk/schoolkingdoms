#!/usr/bin/env python3
"""Картинка речі для магазину: PNG/JPG від генератора → img/items/<код>.webp (512×512, прозоре тло).

  python3 tools/item-image.py картинка.png IT-157            → img/items/IT-157.webp
  python3 tools/item-image.py картинка.png IT-157 --preview   → ще й превʼю на темному тлі поруч

Тло прибирається саме:
  • чисто біле (як просить промт SKIT.imagePrompt) — біле стає прозорим, сіра тінь — напівпрозорою;
  • намальована «шахівниця» (ChatGPT так підробляє прозорість) — світлі сірі клітинки від країв
    прибираються заливкою (тінь при цьому зникає — краще перегенерувати на білому).
Річ обрізається по краях і ставиться по центру з полями 6%."""
import sys
from collections import deque
from PIL import Image, ImageFilter

def is_light_neutral(p, lo):
    r, g, b = p[:3]
    return min(r, g, b) >= lo and max(r, g, b) - min(r, g, b) <= 18

def border(im):
    w, h = im.size; px = im.load()
    pts = [(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)]
    return [px[x, y] for x, y in pts]

def checker(im):
    """краї світлі, але двох відтінків (білий і сірий) — це намальована «шахівниця»"""
    vals = [sum(p[:3]) // 3 for p in border(im)]
    light = [v for v in vals if v >= 180]
    return len(light) > 0.8 * len(vals) and max(light) - min(light) >= 20

def bg_mask(im, lo):
    """тло = світлі нейтральні пікселі, зʼєднані з краєм (сама річ лишається непрозорою)"""
    w, h = im.size; px = im.load(); m = bytearray(w * h); q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or m[y * w + x]: continue
        if not is_light_neutral(px[x, y], lo): continue
        m[y * w + x] = 1
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return m

def clear_bg(im, keep_shadow):
    """тло → прозоре; на білому тлі сіра тінь стає напівпрозорою темною (видно на будь-якому фоні)"""
    w, h = im.size; px = im.load(); m = bg_mask(im, 150 if keep_shadow else 175)
    for y in range(h):
        for x in range(w):
            if not m[y * w + x]: continue
            r, g, b, _ = px[x, y]
            lum = (r + g + b) / 3
            a = int(min(150, max(0, (250 - lum) * 2.2))) if keep_shadow else 0
            px[x, y] = (30, 30, 40, a)
    a = im.getchannel('A').filter(ImageFilter.GaussianBlur(0.6)); im.putalpha(a)   # мʼякий край
    return im

def main():
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    src, code = sys.argv[1], sys.argv[2]
    im = Image.open(src).convert('RGBA')
    if im.getchannel('A').getextrema()[0] < 250:
        mode = 'вже прозоре'
    elif checker(im):
        mode = 'шахівниця → прозоре'; im = clear_bg(im, False)
    else:
        mode = 'біле тло → прозоре, тінь напівпрозора'; im = clear_bg(im, True)
    box = im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
    if box: im = im.crop(box)
    side = int(max(im.size) / 0.88)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2), im)
    out = canvas.resize((512, 512), Image.LANCZOS)
    path = 'img/items/%s.webp' % code
    out.save(path, 'WEBP', quality=92)
    print('✓', path, '·', mode)
    if '--preview' in sys.argv:
        bg = Image.new('RGBA', (512, 512), (24, 34, 58, 255)); bg.alpha_composite(out)
        bg.convert('RGB').save('img/items/%s.preview.png' % code); print('  превʼю: img/items/%s.preview.png (не комітити)' % code)

if __name__ == '__main__':
    main()

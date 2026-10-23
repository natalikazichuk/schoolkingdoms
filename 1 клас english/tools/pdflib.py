import random
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor, black

D="/usr/share/fonts/truetype/dejavu/"
pdfmetrics.registerFont(TTFont("S", D+"DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("SB", D+"DejaVuSans-Bold.ttf"))
W,H = A4
INK=HexColor("#1f2a44"); SOFT=HexColor("#7a849c"); RULE=HexColor("#9fb3d6"); LIGHT=HexColor("#c9d3e6")
L=[("R","r","red","червоний","#e03a3a"),("Y","y","yellow","жовтий","#c99200"),("O","o","orange","помаранчевий","#ef7d1a"),
   ("P","p","pink","рожевий","#e0457b"),("W","w","white","білий","#7d8aa8"),("C","c","color","колір","#8e5bd6")]
LABEL="МОДУЛЬ"
HINT={"R":"Намалюй щось red","Y":"Намалюй щось yellow","O":"Намалюй щось orange","P":"Намалюй щось pink","W":"Намалюй щось white","C":"Намалюй веселку"}
CAP=0.729; M=18*mm

def header(c, title, sub):
    c.setFillColor(SOFT); c.setFont("S",9); c.drawString(M, H-14*mm, LABEL)
    c.drawRightString(W-M, H-14*mm, "Name: ____________________")
    c.setFillColor(INK); c.setFont("SB",20); c.drawString(M, H-24*mm, title)
    c.setFont("S",10.5); c.setFillColor(SOFT); c.drawString(M, H-30*mm, sub)

def guide(c, base, h):
    """three-line writing guide: top, dashed midline, baseline"""
    c.setStrokeColor(RULE); c.setLineWidth(0.7); c.setDash()
    c.line(M, base+h, W-M, base+h); c.line(M, base, W-M, base)
    c.setDash(3,3); c.setStrokeColor(LIGHT); c.line(M, base+h*0.75, W-M, base+h*0.75)
    c.setDash()

def dotted(c, text, x, base, size, col=SOFT):
    c.saveState(); t=c.beginText(); t.setTextRenderMode(1); t.setFont("S", size); t.setTextOrigin(x, base)
    c.setStrokeColor(col); c.setLineWidth(0.9); c.setDash(1.6,2.2); c.setLineCap(1)
    t.textLine(text); c.drawText(t); c.restoreState()

def solid(c, text, x, base, size, col):
    c.setFillColor(col); c.setFont("S", size); c.drawString(x, base, text)

def trace_row(c, base, h, model, rep, col, gap_mm):
    size=h/CAP; guide(c, base, h)
    solid(c, model, M+3*mm, base, size, col)
    x=M+3*mm+pdfmetrics.stringWidth(model,"S",size)+gap_mm*mm
    for _ in range(rep):
        w=pdfmetrics.stringWidth(model,"S",size)
        if x+w>W-M: break
        dotted(c, model, x, base, size); x+=w+gap_mm*mm

def letter_page(c, up, low, word, ua, hexc):
    col=HexColor(hexc)
    header(c, f"Letter {up}{low}  ·  {up} is for {word}", f"Обведи літеру за зразком зверху вниз. Назви вголос: «{up} — {word}» ({ua}).")
    # big outline letter to color
    top=H-36*mm
    c.saveState(); t=c.beginText(); t.setTextRenderMode(1); t.setFont("SB",110); t.setTextOrigin(M, top-36*mm)
    c.setStrokeColor(col); c.setLineWidth(2.2); t.textLine(up+low); c.drawText(t); c.restoreState()
    c.setFillColor(SOFT); c.setFont("S",9); c.drawString(M, top-42*mm, "Розфарбуй літери")
    # draw box
    bx=W-M-62*mm; by=top-44*mm
    c.setStrokeColor(LIGHT); c.setLineWidth(1); c.setDash(4,3); c.roundRect(bx, by, 62*mm, 44*mm, 4*mm); c.setDash()
    c.setFillColor(SOFT); c.drawCentredString(bx+31*mm, by+3*mm, HINT[up])
    c.setFillColor(col); c.setFont("SB",26); c.drawString(M+78*mm, top-16*mm, low)
    c.setFillColor(INK); c.drawString(M+78*mm+pdfmetrics.stringWidth(low,"SB",26), top-16*mm, word[1:])
    c.setFont("S",11); c.setFillColor(SOFT); c.drawString(M+78*mm, top-23*mm, ua)
    # trace rows
    y=top-68*mm
    trace_row(c, y, 17*mm, up, 12, col, 6); y-=32*mm
    trace_row(c, y, 17*mm, low, 14, col, 6); y-=32*mm
    trace_row(c, y, 12*mm, word, 6, col, 9); y-=28*mm
    # own row
    c.setFillColor(SOFT); c.setFont("S",9); c.drawString(M, y+18*mm, "Напиши сам(а):")
    guide(c, y, 15*mm); solid(c, up+low, M+3*mm, y, 15*mm/CAP, col); y-=30*mm
    # find and circle
    c.setFillColor(INK); c.setFont("SB",12); c.drawString(M, y+6*mm, f"Знайди й обведи кружечком усі літери {up} та {low}:")
    random.seed(up)
    others=[x for x in "ABDEGHKLMNOPRSTWYabdeghkmnoprstwy" if x.lower()!=low]
    seq=[up,low,up,low,up,low]+random.sample(others,10); random.shuffle(seq)
    c.setFont("S",24); c.setFillColor(INK)
    step=(W-2*M)/len(seq)
    for i,ch in enumerate(seq): c.drawCentredString(M+step*(i+.5), y-6*mm, ch)

def match_page(c):
    header(c, "Match the letters", "З'єднай велику літеру з малою, а потім слово — з його першою літерою.")
    ups=[l[0] for l in L]; lows=[l[1] for l in L]; random.seed(7); random.shuffle(lows)
    top=H-48*mm; gap=17*mm
    for i,(u,lw) in enumerate(zip(ups,lows)):
        y=top-i*gap; col=HexColor(L[i][4])
        c.setFillColor(col); c.setFont("SB",30); c.drawString(M+8*mm, y, u)
        c.setFillColor(INK); c.circle(M+24*mm, y+4*mm, 1.6*mm, fill=1)
        c.circle(M+70*mm, y+4*mm, 1.6*mm, fill=1); c.setFont("S",30); c.drawString(M+76*mm, y, lw)
    words=[l[2] for l in L]; letters=[l[0]+l[1] for l in L]; random.seed(3); random.shuffle(letters)
    c.setStrokeColor(LIGHT); c.line(M, top-6*gap+2*mm, W-M, top-6*gap+2*mm)
    top2=top-6*gap-12*mm
    for i,(w,lt) in enumerate(zip(words,letters)):
        y=top2-i*gap
        c.setFillColor(INK); c.setFont("S",22); c.drawString(M+8*mm, y, w)
        c.circle(M+62*mm, y+3*mm, 1.6*mm, fill=1); c.circle(M+100*mm, y+3*mm, 1.6*mm, fill=1)
        c.setFont("S",24); c.drawString(M+106*mm, y, lt)

def name_page(c):
    header(c, "Hello! My name is…", "Напиши своє ім'я англійською за зразком дорослого. Намалюй себе й свого друга.")
    top=H-44*mm
    c.setFillColor(INK); c.setFont("SB",22); c.drawString(M, top, "Hello! My name is")
    guide(c, top-22*mm, 13*mm); c.setFillColor(SOFT); c.setFont("S",9); c.drawString(M, top-27*mm, "(дорослий пише ім'я крапками — дитина обводить)")
    guide(c, top-46*mm, 13*mm)
    for i,(lab,x) in enumerate([("This is me. I'm a boy / girl.",M),("This is my friend.",W/2+4*mm)]):
        bw=W/2-M-4*mm; by=top-150*mm
        c.setStrokeColor(LIGHT); c.setDash(4,3); c.roundRect(x, by, bw, 92*mm, 5*mm); c.setDash()
        c.setFillColor(INK); c.setFont("S",13); c.drawString(x+4*mm, by+4*mm, lab)
    y=top-170*mm
    c.setFillColor(INK); c.setFont("SB",13); c.drawString(M, y, "Обведи слова й прочитай з учителем:")
    x=M
    for ph in ["Hello!","Hi!","Goodbye!","Bye!"]:
        dotted(c, ph, x, y-16*mm, 26); x+=pdfmetrics.stringWidth(ph,"S",26)+12*mm

from reportlab.lib.colors import white as WHITE
def shape(c, kind, cx, cy, r):
    c.setStrokeColor(INK); c.setLineWidth(1.6); c.setFillColor(WHITE)
    p=c.beginPath()
    import math
    if kind=="circle":
        c.circle(cx, cy, r, fill=1); c.line(cx, cy+r, cx+3*mm, cy+r+6*mm); return
    if kind=="star":
        for i in range(10):
            a=math.pi/2+i*math.pi/5; rr=r if i%2==0 else r*0.45
            (p.moveTo if i==0 else p.lineTo)(cx+rr*math.cos(a), cy+rr*math.sin(a))
    elif kind=="triangle":
        p.moveTo(cx, cy+r); p.lineTo(cx-r, cy-r*0.8); p.lineTo(cx+r, cy-r*0.8)
    elif kind=="square":
        c.rect(cx-r*0.85, cy-r*0.85, r*1.7, r*1.7, fill=1); return
    elif kind=="pumpkin":
        for dx in (-r*0.45, r*0.45, 0): c.ellipse(cx+dx-r*0.6, cy-r*0.75, cx+dx+r*0.6, cy+r*0.75, fill=1)
        c.rect(cx-1.5*mm, cy+r*0.7, 3*mm, 6*mm, fill=1); return
    elif kind=="ghost":
        p.moveTo(cx-r*0.8, cy-r); p.lineTo(cx-r*0.8, cy+r*0.2)
        p.curveTo(cx-r*0.8, cy+r*1.2, cx+r*0.8, cy+r*1.2, cx+r*0.8, cy+r*0.2); p.lineTo(cx+r*0.8, cy-r)
        for i in range(4): x=cx+r*0.8-(i+1)*r*0.4; p.lineTo(x+r*0.2, cy-r*0.75 if i%2==0 else cy-r); p.lineTo(x, cy-r if i%2==0 else cy-r*0.75)
        p.close(); c.drawPath(p, fill=1)
        c.setFillColor(INK); c.circle(cx-r*0.3, cy+r*0.3, 1.4*mm, fill=1); c.circle(cx+r*0.3, cy+r*0.3, 1.4*mm, fill=1); return
    elif kind=="diamond":
        p.moveTo(cx, cy+r); p.lineTo(cx+r*0.8, cy); p.lineTo(cx, cy-r); p.lineTo(cx-r*0.8, cy)
    elif kind=="heart":
        p.moveTo(cx, cy-r); p.curveTo(cx-r*1.3, cy, cx-r*0.6, cy+r*1.1, cx, cy+r*0.45)
        p.curveTo(cx+r*0.6, cy+r*1.1, cx+r*1.3, cy, cx, cy-r)
    p.close(); c.drawPath(p, fill=1)

def color_page(c):
    header(c, "Read and color", "Обведи назву кольору й розфарбуй фігуру цим кольором. Скажи: «It's red!»")
    items=[("circle","red"),("star","yellow"),("triangle","green"),("square","blue"),
           ("pumpkin","orange"),("ghost","white"),("diamond","purple"),("heart","pink")]
    cw=(W-2*M)/4; top=H-60*mm
    for i,(k,w) in enumerate(items):
        col=i%4; row=i//4; cx=M+cw*(col+.5); cy=top-row*72*mm
        shape(c, k, cx, cy, 15*mm)
        tw=pdfmetrics.stringWidth(w,"S",22); dotted(c, w, cx-tw/2, cy-30*mm, 22)
    y=top-165*mm
    c.setFillColor(INK); c.setFont("SB",13); c.drawString(M, y+14*mm, "Мій улюблений колір. Обведи й намалюй кружечок свого кольору:")
    guide(c, y-4*mm, 11*mm); dotted(c, "I like", M+3*mm, y-4*mm, 11*mm/CAP)
    c.setStrokeColor(INK); c.setLineWidth(1.4); c.circle(W-M-22*mm, y+2*mm, 11*mm)


def draw_page(c, words, sentence):
    header(c, "Read and draw", "Обведи слово й намалюй малюнок до нього. Назви вголос англійською.")
    cw=(W-2*M)/3; ch=62*mm; top=H-38*mm
    for i,w in enumerate(words[:6]):
        col=i%3; row=i//3; x=M+cw*col+2*mm; y=top-(row+1)*(ch+8*mm)
        c.setStrokeColor(LIGHT); c.setLineWidth(1); c.setDash(4,3); c.roundRect(x, y, cw-4*mm, ch, 4*mm); c.setDash()
        size=20 if len(w)<9 else 15
        tw=pdfmetrics.stringWidth(w,"S",size); dotted(c, w, x+(cw-4*mm-tw)/2, y+5*mm, size)
    y=top-2*(ch+8*mm)-24*mm
    c.setFillColor(INK); c.setFont("SB",13); c.drawString(M, y+16*mm, "Обведи речення й прочитай з учителем:")
    h=11*mm; guide(c, y, h); dotted(c, sentence, M+3*mm, y, h/CAP)
    guide(c, y-24*mm, h)

def build(path, title, label, letters, hints, words, sentence, special=None):
    global L, HINT, LABEL
    L=letters; HINT=hints; LABEL=label
    c=canvas.Canvas(path, pagesize=A4); c.setTitle(title)
    for l in L: letter_page(c,*l); c.showPage()
    match_page(c); c.showPage()
    if special: special(c)
    else: draw_page(c, words, sentence)
    c.showPage(); c.save()

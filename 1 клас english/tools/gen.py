import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from modules import MODULES, PALETTE
import pdflib

HERE = os.path.dirname(os.path.abspath(__file__))
TPL = open(os.path.join(HERE, "hello-letters.html"), encoding="utf8").read()
OUT = os.path.join(HERE, "site")

def rep(s, a, b):
    assert a in s, "missing: " + a[:60]
    return s.replace(a, b, 1)

def cut(s, start, end, new):
    i = s.index(start); j = s.index(end, i)
    return s[:i] + new + s[j:]

def page(m):
    s = TPL
    lt = m["letters"]
    ups = [l[0] for l in lt]
    for w, L, _ in m["extra"]:
        assert L in ups, (m["num"], w)
    s = rep(s, "<title>Hello! Вчимо літери</title>", f"<title>{m['title']}! Вчимо літери</title>")
    s = rep(s, "Модуль 1 · Hello! · American English", f"Модуль {m['num']} · {m['title']} · American English")
    s = rep(s, "<span>H</span><span>B</span><span>G</span><span>N</span><span>F</span><span>T</span>", "".join(f"<span>{u}</span>" for u in ups))
    words = ", ".join(l[2] for l in lt)
    s = rep(s, "Шість літер із перших слів знайомства: hello, boy, girl, name, friend, teacher. Натискайте, слухайте, грайте, обводьте пальцем.",
            f"{m['ua']}. Літери модуля зі слів теми: {words}. Натискайте, слухайте, грайте, обводьте пальцем.")
    s = rep(s, '<button role="tab" data-tab="match" aria-selected="false">3. Слово й картинка</button>',
            f'<button role="tab" data-tab="match" aria-selected="false">3. {m["match_tab"]}</button>')
    s = rep(s, '<button role="tab" data-tab="talk" aria-selected="false">5. Hello! Діалог</button>',
            f'<button role="tab" data-tab="talk" aria-selected="false">5. {m["talk_tab"]}</button>')
    s = rep(s, '<h2>Word and picture</h2>\n    <p class="how">Прочитай (або послухай) слово й вибери картинку до нього.</p>',
            f'<h2>{m["match_h"]}</h2>\n    <p class="how">{m["match_how"]}</p>')
    s = rep(s, "<h2>Hello! What's your name?</h2>\n    <p class=\"how\">Teddy вітається англійською. Дитина відповідає вголос, а потім натискає правильну відповідь.</p>",
            f'<h2>{m["talk_h"]}</h2>\n    <p class="how">{m["talk_how"]}</p>')
    cvars = ["--c-h", "--c-b", "--c-g", "--c-n", "--c-f", "--c-t"]
    L = ",\n  ".join(json.dumps(dict(up=u, low=lo, word=w, pic=e, c=cvars[i], ua=ua), ensure_ascii=False) for i, (u, lo, w, e, ua) in enumerate(lt))
    ex = json.dumps([list(x) for x in m["extra"]], ensure_ascii=False)
    voc = json.dumps([list(x) for x in m["vocab"]], ensure_ascii=False)
    s = cut(s, "const L = [", "/* speech */", f"const L = [\n  {L}\n];\nconst extraWords = {ex};\nconst VOCAB = {voc};\n\n")
    s = cut(s, "/* 3. match */", "/* 4. trace */", """/* 3. match: word -> picture */
let mq = null, mStars = 0;
function newMatch(){
  mq = VOCAB[Math.floor(Math.random()*VOCAB.length)];
  document.getElementById("match-word").textContent = mq[0];
  const others = shuffle(VOCAB.filter(x=>x!==mq)).slice(0,2);
  const box = document.getElementById("match-choices"); box.innerHTML = "";
  shuffle([mq, ...others]).forEach(v => {
    const b = document.createElement("button"); b.className = "choice pic"; b.textContent = v[1]; b.setAttribute("aria-label", v[2]);
    b.onclick = () => {
      if (v === mq) { b.classList.add("right"); mStars++; renderStars("match-score", mStars); document.getElementById("match-fb").textContent = `Yes! ${mq[0]} — ${mq[2]}`; say(`Yes! ${mq[0]}!`); setTimeout(newMatch, 1400); }
      else { b.classList.remove("wrong"); void b.offsetWidth; b.classList.add("wrong"); document.getElementById("match-fb").textContent = "Oops! Спробуй ще."; }
    };
    box.appendChild(b);
  });
  document.getElementById("match-fb").textContent = "";
}
document.getElementById("match-say").onclick = () => say(mq[0]);
newMatch();

""")
    steps = ",\n  ".join(json.dumps(dict(t=t, opts=o, ok=k), ensure_ascii=False) for t, o, k in m["steps"])
    s = cut(s, "const steps = [", "let si = 0;", f"const steps = [\n  {steps}\n];\n")
    s = rep(s, 'bubble("★ ★ ★ Super! You can say hello in English!", "t")', f'bubble({json.dumps(m["final"], ensure_ascii=False)}, "t")')
    s = rep(s, 'fetch("hello-ws.pdf")', 'fetch("worksheets.pdf")')
    s = rep(s, '"Module1-Hello-worksheets.pdf"', f'"Module{m["num"]}-{m["slug"].capitalize()}-worksheets.pdf"')
    s = rep(s, "8 аркушів для друку: обведення літер, «з'єднай» і творче завдання.", "8 аркушів для друку: обведення літер, «з'єднай» і «Read and draw».")
    return s

def build(m):
    d = os.path.join(OUT, f"module-{m['num']:02d}-{m['slug']}")
    os.makedirs(d, exist_ok=True)
    open(os.path.join(d, "index.html"), "w", encoding="utf8").write(page(m))
    letters = [(u, lo, w, ua, PALETTE[i]) for i, (u, lo, w, e, ua) in enumerate(m["letters"])]
    hints = {u: f"Намалюй: {w}" for u, lo, w, e, ua in m["letters"]}
    label = f"МОДУЛЬ {m['num']} · {m['title'].upper()} · ВЧИМО ЛІТЕРИ"
    pdflib.build(os.path.join(d, "worksheets.pdf"), f"Модуль {m['num']} {m['title']} — Вчимо літери (аркуші)",
                 label, letters, hints, m["draw"], m["sentence"])
    return d

if __name__ == "__main__":
    for m in MODULES:
        print(build(m))

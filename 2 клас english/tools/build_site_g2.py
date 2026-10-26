"""Builds klas-2/english-2.html from the grade-1 site trainer (klas-1/english-1-litery.html):
same look, rewards and progress plumbing; grade-2 content and levels.
Usage: python3 build_site_g2.py REPO_ROOT
"""
import json, sys, os

ROOT = sys.argv[1]
src = open(os.path.join(ROOT, "klas-1/english-1-litery.html"), encoding="utf8").read()

def rep(s, a, b, count=1):
    assert s.count(a) >= 1, "missing: " + a[:80]
    return s.replace(a, b) if count == 0 else s.replace(a, b, count)

def cut(s, start, end, new, keep_end=True):
    i = s.index(start); j = s.index(end, i)
    return s[:i] + new + (s[j:] if keep_end else s[j + len(end):])

# ---------------- content: module 1 ----------------
M1 = {
 "n": 1, "pdf": "module-01-welcome-back", "t": "Welcome Back!", "ua": "Повторення 1 класу й звуки",
 "talk": "Hi! How old are you?", "fin": "Super! Welcome to Grade 2!",
 "B": [["A", "🍎"], ["B", "⚽"], ["C", "🐱"], ["D", "🐶"], ["E", "🥚"], ["F", "🐟"]],
 "V": [["pencil", "✏️", "олівець"], ["ruler", "📏", "лінійка"], ["book", "📘", "книжка"], ["notebook", "📓", "зошит"],
       ["eraser", "🧽", "гумка"], ["marker", "🖍️", "маркер"], ["scissors", "✂️", "ножиці"], ["glue", "🧴", "клей"],
       ["backpack", "🎒", "рюкзак"], ["desk", "🪑", "парта"], ["board", "🟩", "дошка"], ["teacher", "👩‍🏫", "вчителька"]],
 "C": [["cat", "🐱"], ["hat", "🎩"], ["bag", "👜"], ["map", "🗺️"], ["pen", "🖊️"], ["bed", "🛏️"], ["ten", "🔟"], ["red", "🟥"],
       ["pig", "🐷"], ["six", "6"], ["dog", "🐶"], ["box", "📦"], ["sun", "☀️"], ["cup", "🥤"], ["bus", "🚌"]],
 "D": [["Hi! Welcome back to school!", ["Hi, Teddy!", "Goodbye!"], 0],
       ["I'm Teddy Star. What's your name?", ["I'm {n}.", "I'm fine."], 0],
       ["Nice to see you again, {n}! How old are you?", ["I'm seven.", "I'm eight.", "I'm six."], -1],
       ["Look! 📏 Is it a pencil?", ["No, it isn't. It's a ruler.", "Yes, it is."], 0],
       ["What color is your backpack?", ["It's blue.", "It's red.", "It's green.", "It's pink."], -1],
       ["How many pencils? ✏️✏️✏️✏️✏️✏️✏️✏️✏️✏️✏️✏️", ["Twelve.", "Ten."], 0],
       ["Great! Have a good school year, {n}! Bye!", ["Bye, Teddy! See you!", "I'm seven."], 0]],
}
M2 = {
 "n": 2, "pdf": "module-02-my-home", "t": "My Home", "ua": "Мій дім (+ Halloween)",
 "talk": "Where is the cat?", "fin": "Super! Welcome to my home!", "tags": "кімнати, Where is…?, коротке a",
 "L3": "where", "read": "a",
 "B": [["H", "🏠"], ["B", "🛏️"], ["S", "🛋️"], ["L", "💡"], ["D", "🚪"], ["W", "🪟"]],
 "V": [["house", "🏠", "будинок"], ["apartment", "🏢", "квартира"], ["kitchen", "🍳", "кухня"], ["bedroom", "🛌", "спальня"],
       ["bathroom", "🛁", "ванна кімната"], ["bed", "🛏️", "ліжко"], ["sofa", "🛋️", "диван"], ["lamp", "💡", "лампа"],
       ["door", "🚪", "двері"], ["window", "🪟", "вікно"], ["chair", "🪑", "стілець"], ["TV", "📺", "телевізор"]],
 "C": [["cat", "🐱"], ["hat", "🎩"], ["bag", "👜"], ["map", "🗺️"], ["van", "🚐"], ["fan", "🪭"], ["can", "🥫"], ["bat", "🦇"],
       ["jam", "🍓"], ["cap", "🧢"], ["ham", "🍖"], ["rat", "🐀"], ["dad", "👨"], ["pan", "🥘"]],
 "W": [["box", "📦", ["in", "on", "next to"]], ["bed", "🛏️", ["on", "under", "next to"]],
       ["chair", "🪑", ["on", "under", "next to"]], ["sofa", "🛋️", ["on", "under", "next to"]]],
 "D": [["Hi, {n}! Welcome to my home! 🏠", ["Wow! Nice house!", "Goodbye!"], 0],
       ["This is my bedroom. What's this? 🛏️", ["It's a bed.", "It's a lamp."], 0],
       ["Look! The cat is in the box. 📦 Where is the cat?", ["It's in the box.", "It's on the bed."], 0],
       ["What is there in your room?", ["There is a bed.", "There is a lamp.", "There is a desk."], -1],
       ["Is there a window in your room? 🪟", ["Yes, there is.", "No, there isn't."], -1],
       ["Trick or treat! 🎃 What's your costume?", ["I'm a witch!", "I'm a ghost!", "I'm a cat!", "I'm a pumpkin!"], -1],
       ["Happy Halloween, {n}! See you!", ["Happy Halloween, Teddy!", "It's a lamp."], 0]],
}
M1["tags"] = "слова, звуки, Is it a…?, читання"
M1["ws"] = "8 аркушів A4: алфавіт, перші звуки, слова, числа 11–20."
M2["ws"] = "8 аркушів A4: кімнати, Where is the cat?, слова з a, Halloween."
M3 = {
 "n": 3, "pdf": "module-03-my-day", "t": "My Day", "ua": "Мій день (+ Thanksgiving)",
 "talk": "What time is it?", "fin": "Super! Good night, see you tomorrow!", "tags": "розпорядок дня, What time is it?, коротке e",
 "ws": "8 аркушів A4: мій день, годинник, слова з e, Thanksgiving.",
 "L3": "time", "read": "e", "plain": True,
 "B": [["D", "☀️"], ["A", "⏰"], ["Y", "🥣"], ["T", "🕖"], ["E", "🥚"], ["N", "🌙"]],
 "V": [["get up", "⏰", "вставати"], ["wash my face", "🧼", "вмиватися"], ["brush my teeth", "🪥", "чистити зуби"],
       ["eat breakfast", "🥣", "снідати"], ["go to school", "🏫", "йти до школи"], ["play", "⚽", "гратися"],
       ["do my homework", "📝", "робити домашнє завдання"], ["eat dinner", "🍽️", "вечеряти"], ["go to bed", "🛌", "лягати спати"],
       ["morning", "🌅", "ранок"], ["afternoon", "🌤️", "день (після обіду)"], ["evening", "🌙", "вечір"]],
 "C": [["bed", "🛏️"], ["pen", "🖊️"], ["red", "🟥"], ["ten", "🔟"], ["hen", "🐔"], ["leg", "🦵"], ["net", "🥅"],
       ["jet", "✈️"], ["web", "🕸️"], ["wet", "💦"], ["egg", "🥚"], ["pet", "🐶"], ["vet", "🩺"], ["men", "👬"]],
 "D": [["Good morning, {n}! What time is it? 🕖", ["It's seven o'clock.", "It's ten o'clock."], 0],
       ["Time to get up! What do you do in the morning?", ["I brush my teeth.", "I wash my face.", "I eat breakfast."], -1],
       ["What do you eat for breakfast? 🥣", ["I eat cereal.", "I eat pancakes.", "I eat eggs."], -1],
       ["I go to school at eight o'clock. 🏫 And you?", ["I go to school at eight, too.", "I go to bed."], 0],
       ["What do you do in the afternoon?", ["I play.", "I do my homework.", "I read books."], -1],
       ["Happy Thanksgiving! 🦃 What are you thankful for?", ["I'm thankful for my family.", "I'm thankful for my friends."], -1],
       ["It's nine o'clock. Time for bed! Good night, {n}!", ["Good night, Teddy!", "Good morning!"], 0]],
}
M4 = {
 "n": 4, "pdf": "module-04-clothes", "t": "Clothes", "ua": "Одяг (+ зимові свята)",
 "talk": "What are you wearing?", "fin": "Super! Merry Christmas!", "tags": "одяг, I'm wearing…, коротке i",
 "ws": "8 аркушів A4: одяг, кольори, Dress Teddy, слова з i, Ugly Sweater.",
 "L3": "wear", "read": "i",
 "B": [["C", "🧥"], ["L", "🧣"], ["O", "🧦"], ["T", "👕"], ["H", "🧢"], ["S", "👟"]],
 "V": [["T-shirt", "👕", "футболка"], ["pants", "👖", "штани"], ["shorts", "🩳", "шорти"], ["dress", "👗", "сукня"],
       ["sweater", "🧶", "светр"], ["coat", "🧥", "пальто, куртка"], ["shoes", "👟", "взуття, черевики"], ["socks", "🧦", "шкарпетки"],
       ["boots", "🥾", "чоботи"], ["scarf", "🧣", "шарф"], ["cap", "🧢", "кепка"], ["mittens", "🧤", "рукавиці"]],
 "C": [["pig", "🐷"], ["six", "6"], ["pin", "📌"], ["bin", "🗑️"], ["lip", "👄"], ["kid", "🧒"], ["zip", "🤐"],
       ["win", "🏆"], ["dig", "⛏️"], ["big", "🐘"], ["sit", "🪑"], ["hit", "🥊"]],
 "WR": [["T-shirt", "👕", 0], ["dress", "👗", 0], ["coat", "🧥", 0], ["scarf", "🧣", 0], ["cap", "🧢", 0], ["sweater", "🧶", 0],
        ["pants", "👖", 1], ["shorts", "🩳", 1], ["shoes", "👟", 1], ["socks", "🧦", 1], ["boots", "🥾", 1], ["mittens", "🧤", 1]],
 "D": [["Brr! It's cold today! ❄️ What are you wearing?", ["I'm wearing a sweater.", "I'm wearing a coat.", "I'm wearing a scarf."], -1],
       ["Look! 🧣 What's this?", ["It's a scarf.", "It's a cap."], 0],
       ["Put on your coat, please! 🧥", ["OK! I'm putting on my coat.", "Good night!"], 0],
       ["Whose hat is it? 🎩", ["It's my hat.", "It's a cat."], 0],
       ["It's Ugly Sweater Day! 🎄 What color is your sweater?", ["It's red and green.", "It's blue.", "It's white."], -1],
       ["Merry Christmas, {n}! 🎁", ["Merry Christmas, Teddy!", "Happy Halloween!"], 0]],
}
MODS = [M1, M2, M3, M4]
ABC = [["A","apple","🍎"],["B","ball","⚽"],["C","cat","🐱"],["D","dog","🐶"],["E","egg","🥚"],["F","fish","🐟"],["G","goat","🐐"],
       ["H","hat","🎩"],["I","igloo","🧊"],["J","jam","🍓"],["K","kite","🪁"],["L","lion","🦁"],["M","map","🗺️"],["N","nest","🪺"],
       ["O","octopus","🐙"],["P","pen","🖊️"],["Q","queen","👸"],["R","red","🟥"],["S","sun","☀️"],["T","ten","🔟"],["U","umbrella","☂️"],
       ["V","van","🚐"],["W","web","🕸️"],["X","box","📦"],["Y","yo-yo","🪀"],["Z","zebra","🦓"]]

s = src
s = rep(s, "<title>English 1 · Вчимо літери</title>", "<title>English 2 · Читаємо й говоримо</title>")
s = rep(s, "/* Світла «пісочна» тема — як у тренажерах (шаблон «Вчимо літери»). */",
        "/* Світла «пісочна» тема — як у тренажері English 1 «Вчимо літери». */")
# extra styles: ABC sound grid
s = rep(s, "</style>", """
/* ══ ЗВУКИ ABC ══ */
.abcg{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
.abcg button{border:3px solid var(--line);background:#fff;border-radius:14px;padding:6px 0;cursor:pointer;
  font-family:'Fredoka';font-weight:700;font-size:24px;line-height:1.05;color:#1e3a6b;box-shadow:0 3px 0 rgba(44,43,58,.12)}
.abcg button small{display:block;font-size:17px}
.abcg button.v{color:#e03131;border-color:#ffc9c9}
.abcg button:active{transform:translateY(2px);box-shadow:none}
.abcg button.on{border-color:var(--blue);background:#eaf5ff}
.snd{display:flex;align-items:center;justify-content:center;gap:14px;min-height:84px;margin-top:12px;background:#fff;border:3px solid var(--line);
  border-radius:20px;padding:10px 14px;box-shadow:var(--shadow);font-family:'Fredoka';font-weight:600;font-size:22px;color:#1e3a6b}
.snd .p{font-size:46px;line-height:1}
.snd b{color:#e03131}
@media (max-width:400px){ .abcg{grid-template-columns:repeat(5,1fr)} }
/* ══ WHERE IS THE CAT? ══ */
.scene{position:relative;width:220px;height:160px;margin:0 auto}
.scene .ob{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);font-size:100px;line-height:1;z-index:2}
.scene .ct{position:absolute;left:50%;transform:translateX(-50%);font-size:50px;line-height:1;z-index:3}
.scene.on .ct{bottom:58px}
.scene.in .ct{bottom:84px;z-index:1}
.scene.under .ob{bottom:40px}
.scene.under .ct{bottom:2px;z-index:1}
.scene.next .ob{left:38%}
.scene.next .ct{left:76%;bottom:10px}
.clock{width:150px;height:150px;display:block;margin:0 auto}
</style>""")
s = rep(s, '<span class="bm">English 1</span><span class="bt">Вчимо літери</span><span class="bs">10 модулів · <span class="nw">American English</span></span>',
        '<span class="bm">English 2</span><span class="bt">Читаємо й говоримо</span><span class="bs">2 клас · <span class="nw">American English</span></span>')
s = rep(s, '<span class="lab">Картки літер</span>', '<span class="lab">Картки слів</span>')
s = rep(s, 'onclick="goTrace()"><span class="ico" id="icoTrace"></span><span class="lab">Обведи</span>',
        'onclick="goTrace()"><span class="ico" id="icoTrace"></span><span class="lab">Звуки ABC</span>')
s = rep(s, "<span>8 аркушів A4: розфарбуй, обведи, напиши, знайди.</span>",
        "<span>8 аркушів A4: алфавіт, перші звуки, слова, числа 11–20.</span>")
# cards screen
s = rep(s, '<div class="ttl"><b>Meet the letters</b><span>Картки літер</span></div>',
        '<div class="ttl"><b>School things</b><span>Картки слів</span></div>')
s = rep(s, '<p class="how">Торкнися картки — почуєш літеру й слово. Повторюй уголос!</p>',
        '<p class="how">Торкнися картки — почуєш слово й речення. Повторюй уголос: «It\'s a ruler.»</p>')
# trace screen → ABC sounds screen
s = cut(s, '<!-- ══════ ОБВЕДИ ══════ -->', '</section>', '''<!-- ══════ ЗВУКИ ABC ══════ -->
  <section id="screen-trace" class="screen">
    <div class="topbar">
      <button class="iconbtn" type="button" onclick="goStart()" title="Назад" aria-label="Назад">←</button>
      <div class="ttl"><b>Letters and sounds</b><span>Літера — звук — слово. Голосні червоні</span></div>
    </div>
    <div class="abcg" id="abcg"></div>
    <div class="snd" id="snd"><span style="font-size:15px;color:var(--soft)">Торкнися літери — почуєш її назву, звук і слово.</span></div>
  </section>''', keep_end=False)

# ---------------- script ----------------
head_comment = '''/* ============================================================
   ENGLISH 2 · Читаємо й говоримо — тренажер англійської (American English)
   для 2 класу за річною програмою (10 модулів; модулі додаються в MODS).
   Одна сторінка на всі модулі: ?m=N відкриває модуль, без ?m — меню.
   В адмінці кожен модуль — окремий запис (плитка) з linkHref
   «klas-2/english-2.html?m=N» і своєю нагородою (tests/english-2-tiles.json).

   Модуль: 6 рівнів (слова теми → перший звук → Is it a…? → читаємо
   слова з трьох літер → діалог з Teddy → фінал), плюс вільні вправи
   «Картки слів» і «Звуки ABC». Рівень пройдено — не більше 2 помилок;
   без помилок — 3 зірки. Усі рівні — модуль пройдено, нагорода (SKPRIZE).
   Прогрес: localStorage 'sk_game_en2_m<N>' (простір sk_*).
   Аркуші для друку — PDF у «2 клас english/module-XX-…/worksheets.pdf».
   Збирається з klas-1/english-1-litery.html скриптом
   «2 клас english/tools/build_site_g2.py».
   ============================================================ */

/* ---------- зміст модулів ----------
   B — кубики на старті [ЛІТЕРА, картинка]
   V — слова теми [слово, картинка, укр]
   C — слова з трьох літер для читання за звуками [слово, картинка]
   D — діалог з Teddy [репліка, [відповіді], правильна | -1 — будь-яка] */
'''
mods_js = "const MODS = [\n" + ",\n".join("  " + json.dumps(m, ensure_ascii=False) for m in MODS) + "\n];\n"
abc_js = "const ABC = " + json.dumps(ABC, ensure_ascii=False) + ";\nconst VOWELS = \"AEIOU\";\n"
s = cut(s, "/* ============================================================\n   ENGLISH 1", "const $ = id =>", head_comment + mods_js + abc_js + "\n")
s = rep(s, 'const lsKey = n => "sk_game_en1_litery_m" + n;', 'const lsKey = n => "sk_game_en2_m" + n;')
s = rep(s, 'const prizeKey = n => "sk_en1_litery_m" + n + "_prize_v1";', 'const prizeKey = n => "sk_en2_m" + n + "_prize_v1";')
s = rep(s, 'const SELF = "english-1-litery.html";', 'const SELF = "english-2.html";')

gens = r'''/* ============================================================
   ГЕНЕРАТОРИ ПИТАНЬ (рушій — як у English 1).
   Питання: { ask, board (html), opts:[{t,h?}], ans (текст правильного
   або "*" — будь-яка відповідь), cls, one, three, say, pre, tip }.
   ============================================================ */
function sayBtn(t, big){ return `<button class="say${big?" big":""}" type="button" data-say="${esc(t)}" aria-label="Послухати">🔊</button>`; }
function fill(right, near, all, k){
  k = k == null ? 2 : k;
  const out = others(near, right, k);
  if(out.length < k) out.push(...others(all.filter(x => !out.includes(x)), right, k - out.length));
  return shuffle([right, ...out]);
}
function takeN(list, n){ const out = []; let g = 0; while(out.length < n && g++ < 20) out.push(...shuffle(list)); return out.slice(0, n); }
const art = w => /^[aeiou]/.test(w) ? "an" : "a";
const itIs = w => (MOD && MOD.plain) ? `${w}.` : w === "scissors" ? "These are scissors." : `It's ${art(w)} ${w}.`;

/* 1. Слова теми: почуй → картинка; картинка → слово; слово → значення */
function hearPic(v, all){
  return { ask:"Послухай і обери картинку.", board:sayBtn(v[0], true), pre:v[0], cls:"emo", three:true,
    opts:fill(v, all, all).map(x=>({t:x[0], h:picHtml(x[1])})), ans:v[0], say:itIs(v[0]), tip:`${v[0]} — ${v[2]}` };
}
function picWord(v, all){
  return { ask:"Що це? Обери слово.", board:`<div class="pic">${picHtml(v[1], true)}</div>${sayBtn(v[0])}`,
    opts:fill(v, all, all).map(x=>({t:x[0]})), ans:v[0], say:itIs(v[0]), tip:`${v[0]} — ${v[2]}`, one:true };
}
function wordUk(v, all){
  return { ask:"Що означає це слово?", board:`<div class="word">${esc(v[0])}</div>${sayBtn(v[0])}`, pre:v[0],
    opts:fill(v, all, all).map(x=>({t:x[2]})), ans:v[2], say:v[0], tip:`${v[0]} — ${v[2]}`, one:true, cls:"long" };
}
function genWords(){
  const kinds = [hearPic, picWord, hearPic, wordUk];
  return takeN(MOD.V, 8).map((v, i) => kinds[i % kinds.length](v, MOD.V));
}

/* 2. Перший звук: почуй слово → літера; картинка + слово без першої літери */
const UPS = ABC.map(a => a[0]);
function soundPool(){ return [...ABC.filter(a => a[0] !== "X").map(a => [a[1], a[2]]), ...MOD.C]; }
function hearFirst(w){
  const up = w[0][0].toUpperCase();
  return { ask:"Послухай слово. З якого звуку воно починається?", board:sayBtn(w[0], true), pre:w[0], cls:"ltr", three:true,
    opts:fill(up, UPS, UPS).map(t=>({t:t + t.toLowerCase()})), ans:up + up.toLowerCase(), say:w[0], tip:`${w[0]} — ${up}${up.toLowerCase()}` };
}
function missFirst(w){
  const lows = UPS.map(u => u.toLowerCase());
  return { ask:"Яка літера пропущена?", board:`<div class="pic">${picHtml(w[1], true)}</div><div class="sent">${hole}${esc(w[0].slice(1))}</div>${sayBtn(w[0])}`,
    cls:"ltr", three:true, opts:fill(w[0][0], lows, lows).map(t=>({t})), ans:w[0][0], say:w[0], tip:w[0] };
}
function genSounds(){
  return shuffle(soundPool()).slice(0, 8).map((w, i) => (i % 2 ? missFirst : hearFirst)(w));
}

/* 3. Is it a …? — картинка й питання, відповідь Yes, it is. / No, it isn't. */
function isItQ(){
  const pool = MOD.V.filter(v => !["scissors", "glue", "teacher"].includes(v[0]));
  const real = pick(pool), yes = Math.random() < .5, asked = yes ? real : pick(pool.filter(v => v !== real));
  const q = `Is it ${art(asked[0])} ${asked[0]}?`;
  const full = (yes ? "Yes, it is. " : "No, it isn't. ") + itIs(real[0]);
  return { ask:"Подивись на картинку. Що відповісти?", board:`<div class="pic">${picHtml(real[1], true)}</div><div class="sent">${esc(q)}</div>${sayBtn(q)}`,
    pre:q, opts:[{t:"Yes, it is."}, {t:"No, it isn't."}], ans: yes ? "Yes, it is." : "No, it isn't.", say:full, tip:full };
}
function genIsIt(){ const out = []; for(let i = 0; i < 8; i++) out.push(isItQ()); return out; }
/* 3б. Where is the cat? — кіт у / на / під / поруч з предметом */
const PREP_CLS = {"in":"in", "on":"on", "under":"under", "next to":"next"};
function whereQ(){
  const [obj, pic, preps] = pick(MOD.W), prep = pick(preps);
  const ans = `It's ${prep} the ${obj}.`;
  return { ask:"Where is the cat? Де кіт?", board:`<div class="scene ${PREP_CLS[prep]}"><span class="ob">${picHtml(pic)}</span><span class="ct">🐱</span></div>${sayBtn("Where is the cat?")}`,
    pre:"Where is the cat?", opts:shuffle(preps).map(p => ({t:`It's ${p} the ${obj}.`})), ans, one:true, cls:"long",
    say:`The cat is ${prep} the ${obj}.`, tip:`The cat is ${prep} the ${obj}. (in — у, on — на, under — під, next to — поруч)` };
}
function genWhere(){ const out = []; for(let i = 0; i < 8; i++) out.push(whereQ()); return out; }
/* 3в. What time is it? — годинник зі стрілками, повні години */
const NUMS = ["twelve","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve"];
function clockSvg(h){
  const a = (h % 12) * 30 * Math.PI / 180, hx = 50 + 24 * Math.sin(a), hy = 50 - 24 * Math.cos(a);
  let ticks = "";
  for(let i = 1; i <= 12; i++){ const t = i * 30 * Math.PI / 180;
    ticks += `<text x="${(50 + 36 * Math.sin(t)).toFixed(1)}" y="${(50 - 36 * Math.cos(t) + 4).toFixed(1)}" text-anchor="middle" font-size="10" font-family="Fredoka, Nunito, sans-serif" font-weight="700" fill="#1e3a6b">${i}</text>`; }
  return `<svg class="clock" viewBox="0 0 100 100" aria-label="${h} o'clock"><circle cx="50" cy="50" r="46" fill="#fff" stroke="#4dabf7" stroke-width="5"/>${ticks}` +
    `<line x1="50" y1="50" x2="50" y2="16" stroke="#e03131" stroke-width="3" stroke-linecap="round"/>` +
    `<line x1="50" y1="50" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}" stroke="#1e3a6b" stroke-width="5" stroke-linecap="round"/><circle cx="50" cy="50" r="4" fill="#1e3a6b"/></svg>`;
}
function timeQ(){
  const h = 1 + Math.floor(Math.random() * 12), ans = `It's ${NUMS[h]} o'clock.`;
  const hrs = []; for(let i = 1; i <= 12; i++) if(i !== h) hrs.push(i);
  return { ask:"What time is it? Котра година?", board:`${clockSvg(h)}${sayBtn("What time is it?")}`, pre:"What time is it?",
    opts:shuffle([h, ...others(hrs, h, 2)]).map(x => ({t:`It's ${NUMS[x]} o'clock.`})), ans, one:true, cls:"long", say:ans,
    tip:`${ans} Коротка стрілка — на ${h}, довга — на 12.` };
}
function genTime(){ const out = [], used = new Set(); let g = 0; while(out.length < 8 && g++ < 40){ const q = timeQ(); if(!used.has(q.ans)){ used.add(q.ans); out.push(q); } } return out; }
/* 3г. I'm wearing … — кружечок кольору + річ: обери речення */
const WCOL = [["red","🔴"],["blue","🔵"],["green","🟢"],["yellow","🟡"],["purple","🟣"],["black","⚫"],["white","⚪"],["orange","🟠"],["brown","🟤"]];
const wearTxt = (it, c) => `I'm wearing ${it[2] ? "" : art(c) + " "}${c} ${it[0]}.`;
function wearQ(){
  const it = pick(MOD.WR), col = pick(WCOL), ans = wearTxt(it, col[0]);
  const c2 = pick(WCOL.filter(c => c !== col)), it2 = pick(MOD.WR.filter(x => x !== it));
  return { ask:"Що вдягнув Teddy? Обери речення.", board:`<div class="pic">${col[1]} ${picHtml(it[1], true)}</div>${sayBtn(ans)}`,
    opts:shuffle([ans, wearTxt(it, c2[0]), wearTxt(it2, col[0])]).map(t => ({t})), ans, one:true, cls:"long", say:ans,
    tip:`${ans} (${it[2] ? "без a: " + it[0] + " — їх багато / пара" : art(col[0]) + " — перед " + col[0]})` };
}
function genWear(){ const out = [], used = new Set(); let g = 0; while(out.length < 8 && g++ < 40){ const q = wearQ(); if(!used.has(q.ans)){ used.add(q.ans); out.push(q); } } return out; }
function genL3(){ return MOD.L3 === "where" ? genWhere() : MOD.L3 === "time" ? genTime() : MOD.L3 === "wear" ? genWear() : genIsIt(); }

/* 4. Читаємо слова з трьох літер: пропущена голосна; почуй і обери слово */
const VW = ["a","e","i","o","u"];
function missVowel(w){
  const v = w[0][1];
  return { ask:"Яка голосна пропущена?", board:`<div class="pic">${picHtml(w[1], true)}</div><div class="sent">${esc(w[0][0])}${hole}${esc(w[0][2])}</div>${sayBtn(w[0])}`,
    cls:"ltr", three:true, opts:fill(v, VW, VW).map(t=>({t})), ans:v, say:`${w[0].split("").join(", ")}. ${w[0]}!`, tip:`${w[0][0]}-${v}-${w[0][2]} → ${w[0]}` };
}
function hearWord(w){
  const v = w[0][1], alt = others(VW, v, 2).map(x => w[0][0] + x + w[0][2]);
  return { ask:"Послухай і обери слово, яке почув.", board:sayBtn(w[0], true), pre:w[0], three:true,
    opts:shuffle([w[0], ...alt]).map(t=>({t})), ans:w[0], say:w[0], tip:`${w[1]} ${w[0]}` };
}
/* режим «одна голосна» (MOD.read = "a"): прочитай слово → картинка; почуй → слово з тим самим звуком */
function readPic(w){
  return { ask:"Прочитай слово й обери картинку.", board:`<div class="word">${esc(w[0])}</div>${sayBtn(w[0])}`, cls:"emo", three:true,
    opts:fill(w, MOD.C, MOD.C).map(x=>({t:x[0], h:picHtml(x[1])})), ans:w[0], say:`${w[0].split("").join(", ")}. ${w[0]}!`, tip:`${w[0][0]}-${w[0][1]}-${w[0][2]} → ${w[0]}` };
}
function hearRhyme(w){
  const near = MOD.C.filter(x => x !== w && (x[0][0] === w[0][0] || x[0].slice(1) === w[0].slice(1))).map(x => x[0]);
  const all = MOD.C.map(x => x[0]);
  return { ask:"Послухай і обери слово, яке почув.", board:sayBtn(w[0], true), pre:w[0], three:true,
    opts:fill(w[0], near, all).map(t=>({t})), ans:w[0], say:w[0], tip:`${w[1]} ${w[0]}` };
}
function genRead(){
  if(MOD.read) return shuffle(MOD.C).slice(0, 8).map((w, i) => (i % 2 ? hearRhyme : readPic)(w));
  return shuffle(MOD.C).slice(0, 8).map((w, i) => (i % 2 ? hearWord : missVowel)(w));
}

/* 5. Діалог з Teddy: репліки по черзі, дитина обирає відповідь */
function genTalk(){
  const n = kidName();
  return MOD.D.map(([line, opts, ok]) => {
    const t = line.replace(/\{n\}/g, n), os = opts.map(o => o.replace(/\{n\}/g, n));
    return { ask:"Що відповісти Teddy? Скажи вголос і натисни.",
      board:`<div class="teddy"><span class="who">${TED("hello")}<b>Teddy Star</b></span><div class="bub">${esc(t)}</div></div>${sayBtn(t)}`, pre:t,
      opts:(ok < 0 ? shuffle(os) : os).map(o=>({t:o})), ans: ok < 0 ? "*" : os[ok], one:true, cls:"long",
      say: ok < 0 ? null : os[ok], tip: ok < 0 ? "Чудова відповідь!" : os[ok] };
  });
}

/* 6. Фінал: питання з рівнів 1–4, без повторів */
function finalMix(n){
  const out = [], seen = new Set(), gens = [genWords, genSounds, genL3, genRead];
  let g = 0;
  while(out.length < n && g++ < 10){
    shuffle(gens).forEach(gen => {
      if(out.length >= n) return;
      const q = gen().find(x => !seen.has(x.board + x.ans));
      if(q){ seen.add(q.board + q.ans); out.push(q); }
    });
  }
  return shuffle(out);
}

function levelsOf(m){
  return [
    {t:"Слова теми",     s:m.V.slice(0, 3).map(x => x[0]).join(", ") + "…", ic:picHtml(m.V[0][1]), gen:genWords, raw:true},
    {t:"Перший звук",    s:"з якої літери слово",                ic:"👂",   gen:genSounds},
    m.L3 === "where" ? {t:"Where is the cat?", s:"in / on / under / next to", ic:"🐱", gen:genL3}
    : m.L3 === "time" ? {t:"What time is it?", s:"It's seven o'clock.", ic:"🕖", gen:genL3}
    : m.L3 === "wear" ? {t:"I'm wearing…", s:"a red sweater, blue pants", ic:"👕", gen:genL3}
    : {t:"Is it a …?",     s:"Yes, it is. / No, it isn't.",          ic:"❓",   gen:genL3},
    {t:m.read ? "Читаємо: коротке " + m.read : "Читаємо слова", s:m.C.slice(0, 3).map(x => x[0]).join(", ") + "…", ic:"📖", gen:genRead},
    {t:"Діалог з Teddy", s:m.talk,                                 ic:"🧸",   gen:genTalk},
    {t:"Фінал",          s:"усе разом",                            ic:"🏆",   gen:() => finalMix(10)},
  ];
}
const LEVELS = MOD ? levelsOf(MOD) : [];
const N = 6;
'''
s = cut(s, "/* ============================================================\n   ГЕНЕРАТОРИ ПИТАНЬ", "/* стан гравця", gens + "\n")

# menu
s = rep(s, '''    const ltr = m.L.map(l => l[0]).join(" ");''', '''    const ltr = m.B.map(b => b[0]).join(" ");''')
s = rep(s, '`<span class="cv"><img src="../img/tr/english-1-m${String(m.n).padStart(2, "0")}.webp" alt="" loading="lazy"`',
        '`<span class="cv"><img src="../img/tr/english-2-m${String(m.n).padStart(2, "0")}.webp" alt="" loading="lazy"`')
s = rep(s, '(k ? "пройдено " + k + " з " + N : "літери " + ltr)', '(k ? "пройдено " + k + " з " + N : m.ua)')
# start screen
s = cut(s, "function fillStart(){", "function starCount", '''function fillStart(){
  document.title = "English 2 · Module " + MOD.n + " · " + MOD.t;
  $("startBlocks").innerHTML = MOD.B.map(b => `<div class="ab">${b[0]}<span class="o">${picHtml(b[1])}</span></div>`).join("");
  $("startTitle").textContent = "Module " + MOD.n;
  $("startTheme").textContent = MOD.t;
  $("startSub").innerHTML = esc(MOD.ua) + " · <span class=\\"nw\\">2 клас</span>";
  const img = $("startImg");
  img.alt = "Module " + MOD.n + " · " + MOD.t;
  img.onerror = () => { $("startHero").remove(); $("startBlocks").classList.remove("hide"); };
  img.src = "../img/tr/english-2-m" + String(MOD.n).padStart(2, "0") + ".webp";
  /* малюнки на кнопках — зі слів цього модуля */
  const [a, b] = MOD.V, [c, d, e] = MOD.C;
  $("icoCards").innerHTML = `<span class="mc a">${picHtml(a[1])}</span><span class="mc b">${picHtml(b[1])}</span>`;
  $("icoTrace").innerHTML = `<span class="note">${["A","b","C","d","E","f","G","h","I"].map(x => `<b>${x}</b>`).join("")}</span><span class="pen">🔊</span>`;
  $("icoPrint").innerHTML = `<span class="pr">🖨️</span>` + [c, d, e].map(w => `<span class="sh">${esc(w[0])}<i>${picHtml(w[1])}</i></span>`).join("");
  $("printBtn").href = "../" + encodeURI("2 клас english/" + MOD.pdf + "/worksheets.pdf");
  const pt = $("printBtn").querySelector(".pt span"); if(pt && MOD.ws) pt.textContent = MOD.ws;
  $("map-title").textContent = "Module " + MOD.n + " · " + MOD.t;
}

''')
# cards: word cards
s = cut(s, "/* ---------- картки літер ---------- */", "/* ---------- обведи літеру ---------- */", '''/* ---------- картки слів ---------- */
function drawCards(){
  $("tiles").innerHTML = "";
  MOD.V.forEach((v, i) => {
    const t = document.createElement("button");
    t.type = "button"; t.className = "tile"; t.style.setProperty("--c", COLS[i % COLS.length]);
    t.innerHTML = `<span class="pic">${picHtml(v[1])}</span>` +
      `<span class="w"><b>${esc(v[0].charAt(0))}</b>${esc(v[0].slice(1))}</span><span class="uk">${esc(v[2])}</span>`;
    t.onclick = () => {
      $("tiles").querySelectorAll(".tile").forEach(x => x.classList.toggle("on", x === t));
      speak(`${v[0]}. ${itIs(v[0])}`);
    };
    $("tiles").appendChild(t);
  });
}

''')
# trace → ABC sounds
s = cut(s, "/* ---------- обведи літеру ---------- */", "/* ---------- кнопки ---------- */", '''/* ---------- звуки ABC ---------- */
function drawGuide(){
  if(!MOD) return;
  const g = $("abcg"); if(g.childElementCount) return;
  ABC.forEach(([L, w, p]) => {
    const b = document.createElement("button");
    b.type = "button"; if(VOWELS.includes(L)) b.className = "v";
    b.innerHTML = `${L}<small>${L.toLowerCase()}</small>`; b.setAttribute("aria-label", L);
    b.onclick = () => {
      g.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
      $("snd").innerHTML = `<span class="p">${picHtml(p)}</span><span><b>${L}${L.toLowerCase()}</b> ${L === "X" ? "— у кінці" : "—"} <b>${esc(w)}</b></span>`;
      speak(L === "X" ? "X. Box ends with X. Box." : `${L}. ${L} is for ${w}. ${w}!`);
    };
    g.appendChild(b);
  });
}

''')
open(os.path.join(ROOT, "klas-2/english-2.html"), "w", encoding="utf8").write(s)

# ---------------- admin tile + self-check test ----------------
tiles = [{
  "title": f"Module {m['n']} · {m['t']}", "subject": "English", "topic": "Читаємо й говоримо", "grade": 2,
  "format": "html", "linkHref": f"klas-2/english-2.html?m={m['n']}", "icon": "🎒",
  "desc": f"{m['ua']} · {m['tags']}", "stat": "mana", "statMode": "fixed", "statValue": 1, "active": True,
  "rewards": {"wheel": {"on": False, "slots": []}, "extras": [{"on": True, "item": "", "chance": 100, "coins": 20}], "repeat": False}}
  for m in MODS]
json.dump(tiles, open(os.path.join(ROOT, "tests/english-2-tiles.json"), "w", encoding="utf8"), ensure_ascii=False, indent=2)

import random
random.seed(2)
def opts3(right, pool):
    o = random.sample([x for x in pool if x != right], 2)
    return [right] + o
for m in MODS:
    words = [v[0] for v in m["V"]]
    L1 = [{"q": f"{v[1]} Що це? Обери слово.", "options": opts3(v[0], words), "correct": 0} for v in m["V"]] + \
         [{"q": f"Що означає слово «{v[0]}»?", "options": opts3(v[2], [x[2] for x in m["V"]]), "correct": 0} for v in m["V"]]
    ups = [a[0] for a in ABC]
    pool = [[a[1], a[2]] for a in ABC if a[0] != "X"] + m["C"]
    L2 = [{"q": f"{w[1]} {w[0]} — з якої літери починається слово?", "options": [w[0][0].upper() + w[0][0]] + [u + u.lower() for u in random.sample([x for x in ups if x != w[0][0].upper()], 2)], "correct": 0} for w in pool]
    L3 = []
    NUMW = ["twelve","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve"]
    CLK = "🕛🕐🕑🕒🕓🕔🕕🕖🕗🕘🕙🕚🕛"
    WCOLS = [("red", "🔴"), ("blue", "🔵"), ("green", "🟢"), ("yellow", "🟡"), ("purple", "🟣"), ("black", "⚫"), ("white", "⚪"), ("orange", "🟠"), ("brown", "🟤")]
    if m.get("L3") == "wear":
        wt = lambda it, c: f"I'm wearing {'' if it[2] else ('an ' if c[0] in 'aeiou' else 'a ')}{c} {it[0]}."
        for it in m["WR"]:
            for _ in range(2):
                col = random.choice(WCOLS); c2 = random.choice([c for c in WCOLS if c != col]); it2 = random.choice([x for x in m["WR"] if x != it])
                L3.append({"q": f"{col[1]} {it[1]} Що вдягнув Teddy?", "options": [wt(it, col[0]), wt(it, c2[0]), wt(it2, col[0])], "correct": 0})
    elif m.get("L3") == "time":
        for h in range(1, 13):
            o = random.sample([x for x in range(1, 13) if x != h], 2)
            L3.append({"q": f"{CLK[h]} What time is it?", "options": [f"It's {NUMW[h]} o'clock."] + [f"It's {NUMW[x]} o'clock." for x in o], "correct": 0})
            L3.append({"q": f"Як сказати англійською: «Я встаю о {h}-й»?" if h <= 9 else f"{CLK[h]} Котра година?",
                       "options": [f"I get up at {NUMW[h]}." if h <= 9 else f"It's {NUMW[h]} o'clock."] + ([f"I get up at {NUMW[x]}." for x in o] if h <= 9 else [f"It's {NUMW[x]} o'clock." for x in o]), "correct": 0})
    elif m.get("L3") == "where":
        UKO = {"box": ("коробці", "коробкою"), "bed": ("ліжку", "ліжком"), "chair": ("стільці", "стільцем"), "sofa": ("дивані", "диваном")}
        UKP = {"in": lambda o: "у " + UKO[o][0], "on": lambda o: "на " + UKO[o][0], "under": lambda o: "під " + UKO[o][1], "next to": lambda o: "поруч із " + UKO[o][1]}
        for obj, pic, preps in m["W"]:
            for p in preps:
                L3.append({"q": f"🐱 {pic} Кіт {UKP[p](obj)}. Як сказати англійською?",
                           "options": [f"It's {p} the {obj}."] + [f"It's {x} the {obj}." for x in preps if x != p], "correct": 0})
    else:
        isit = [v for v in m["V"] if v[0] not in ("scissors", "glue", "teacher")]
        for v in isit:
            other = random.choice([x for x in isit if x != v])
            L3.append({"q": f"{v[1]} Is it {'an' if v[0][0] in 'aeiou' else 'a'} {v[0]}?", "options": ["Yes, it is.", "No, it isn't."], "correct": 0})
            L3.append({"q": f"{v[1]} Is it {'an' if other[0][0] in 'aeiou' else 'a'} {other[0]}?", "options": ["No, it isn't.", "Yes, it is."], "correct": 0})
    if m.get("read"):
        cw = [w[0] for w in m["C"]]
        L4 = [{"q": f"{w[1]} Яке слово?", "options": opts3(w[0], cw), "correct": 0} for w in m["C"]]
    else:
        L4 = [{"q": f"{w[1]} {w[0][0]}_{w[0][2]} — яка голосна пропущена?", "options": [w[0][1]] + random.sample([x for x in "aeiou" if x != w[0][1]], 2), "correct": 0} for w in m["C"]]
    L5 = [{"q": f"🧸 Teddy: «{d[0].replace('{n}', 'Anna')}» Що відповісти?", "options": [o.replace("{n}", "Anna") for o in d[1]][:2], "correct": d[2]} for d in m["D"] if d[2] >= 0]
    test = [{"title": f"English 2 · Module {m['n']} · {m['t']} — перевір себе", "subject": "English", "topic": "Читаємо й говоримо", "grade": 2,
             "stat": "mana", "format": "levels", "xpMode": "perCorrect", "xpValue": 1, "statMode": "fixed", "statValue": 1, "active": True,
             "levels": [{"level": 1, "name": "Слова теми", "count": 6, "questions": L1},
                        {"level": 2, "name": "Перший звук", "count": 6, "questions": L2},
                        {"level": 3, "name": {"where": "Where is the cat?", "time": "What time is it?", "wear": "I'm wearing…"}.get(m.get("L3"), "Is it a …?"), "count": 6, "questions": L3},
                        {"level": 4, "name": f"Читаємо: коротке {m['read']}" if m.get("read") else "Читаємо слова", "count": 6, "questions": L4},
                        {"level": 5, "name": "Діалог з Teddy", "count": len(L5), "questions": L5}]}]
    json.dump(test, open(os.path.join(ROOT, f"tests/test-english-2-module-{m['n']:02d}.json"), "w", encoding="utf8"), ensure_ascii=False, indent=2)
print("ok")

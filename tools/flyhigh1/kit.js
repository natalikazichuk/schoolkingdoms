/* ============================================================
   ГЕНЕРАТОРИ ПИТАНЬ — спільний набір для тренажерів FlyHigh 1.
   1 клас: по 3 варіанти, більшість завдань — на слух.
   Питання: { ask, board (html), opts:[{t,h?}], ans (текст правильного),
              cls (клас кнопок), one (в одну колонку), say (що озвучити
              після відповіді), pre (озвучити одразу), tip (пояснення) }
   або { kind:"spell", word, ask, board }.
   ============================================================ */
const K = 2;                                   // скільки неправильних варіантів
function sayBtn(t, big){ return `<button class="say${big?" big":""}" type="button" data-say="${esc(t)}" aria-label="Послухати">🔊</button>`; }
const emo = w => W[w].e;
const isHtml = w => W[w].e.startsWith("<");
const wordTip = w => `${isHtml(w) ? "" : W[w].e+" "}${w} — ${W[w].uk}`;
/* варіанти: спершу з теми, далі — з усього словника тренажера */
function fill(right, near, all, k){
  k = k == null ? K : k;
  const out = others(near, right, k);
  if(out.length < k) out.push(...others(all.filter(x => !out.includes(x)), right, k - out.length));
  return shuffle([right, ...out]);
}
const ALLW = () => Object.keys(W);

/* Listen and point: почуй слово → обери картинку */
function hearPic(w, near){
  return { ask:"Послухай і обери картинку.", board:sayBtn(w, true), pre:w, cls:"emo",
    opts:fill(w, near, ALLW()).map(t=>({t, h:emo(t)})), ans:w, say:w, tip:wordTip(w) };
}
/* картинка → слово */
function picWord(w, near){
  return { ask:"Що це? Обери слово.", board:`<div class="pic">${emo(w)}</div>${sayBtn(w)}`,
    opts:fill(w, near, ALLW()).map(t=>({t})), ans:w, say:w, tip:wordTip(w) };
}
/* слово англійською → що означає */
function wordUk(w, near){
  return { ask:"Що означає це слово?", board:`<div class="word">${esc(w)}</div>${sayBtn(w)}`, pre:w,
    opts:fill(W[w].uk, near.map(x=>W[x].uk), ALLW().map(x=>W[x].uk)).map(t=>({t})), ans:W[w].uk, say:w, tip:wordTip(w) };
}
/* Spell it: збери слово з літер */
function spell(w){
  return { kind:"spell", word:w, ask:"Збери слово з літер.",
    board:`<div class="pic">${emo(w)}</div>${sayBtn(w)}`, pre:w, say:w, tip:wordTip(w) };
}
/* загальне питання з вибором */
function choice(ask, board, right, wrong, o){
  o = o || {};
  return Object.assign({ ask, board, opts:shuffle([right, ...wrong]).map(t=>({t})), ans:right, say:o.say || right,
    tip:o.tip || right, cls:o.cls || (right.length > 12 ? "long" : ""), one:right.length > 16 }, o.extra || {});
}
/* речення з пропуском: «I'm a ___.» */
function gap(board, before, after, right, wrong, o){
  o = o || {};
  const full = `${before}${right}${after}`;
  return choice(o.ask || "Встав слово.", `${board}<div class="sent">${esc(before)}${hole}${esc(after)}</div>`,
    right, wrong, { say: o.say || full, tip: o.tip || full });
}
/* Yes / No */
function yesNo(board, phrase, yes, o){
  o = o || {};
  return { ask:o.ask || "Так чи ні? Yes or no?", board:`${board}<div class="word">${esc(phrase)}</div>`,
    opts:[{t:"Yes"},{t:"No"}], ans: yes ? "Yes" : "No", say:o.say || phrase, tip:o.tip || (yes ? "Yes!" : "No!") };
}
/* набір «слово»: почуй/побач/зрозумій, k питань */
function wordsMix(pool, k, kinds){
  kinds = kinds || [hearPic, picWord, hearPic, wordUk];
  return shuffle(pool).slice(0, k).map((w, i) => kinds[i % kinds.length](w, pool));
}
/* скільки разів повторити, щоб набрати n питань */
function takeN(list, n){ const out = []; let g = 0; while(out.length < n && g++ < 20) out.push(...shuffle(list)); return out.slice(0, n); }

/* ---------- кольори ---------- */
const COLORS = {
  red:{c:"#f03e3e",uk:"червоний"},  blue:{c:"#339af0",uk:"синій"},     green:{c:"#40c057",uk:"зелений"},
  yellow:{c:"#ffd43b",uk:"жовтий"}, pink:{c:"#f783ac",uk:"рожевий"},   black:{c:"#212529",uk:"чорний"},
  orange:{c:"#ff922b",uk:"помаранчевий"}, white:{c:"#ffffff",uk:"білий"}, purple:{c:"#9c36b5",uk:"фіолетовий"},
  brown:{c:"#8d5524",uk:"коричневий"}
};
function swatch(c, big){ return `<span class="dot${big?" big":""}" style="background:${COLORS[c].c}"></span>`; }
function colourQs(cols, n){
  const qs = [];
  cols.forEach(c => {
    const tip = `${c} — ${COLORS[c].uk}`;
    qs.push({ ask:"Послухай і обери колір.", board:sayBtn(c, true), pre:c, cls:"emo",
      opts:fill(c, cols, Object.keys(COLORS)).map(t=>({t, h:swatch(t)})), ans:c, say:c, tip });
    qs.push({ ask:"Який це колір?", board:swatch(c, true)+sayBtn(c),
      opts:fill(c, cols, Object.keys(COLORS)).map(t=>({t})), ans:c, say:`It's ${c}.`, tip });
    const o = pick(cols.filter(x => x !== c));
    const yes = Math.random() < .5, asked = yes ? c : o;
    qs.push(yesNo(swatch(c, true), `Is it ${asked}?`, yes, { say:`Is it ${asked}? ${yes ? "Yes." : "No."}`,
      tip: yes ? `Yes. It's ${c}.` : `No. It's ${c} — ${COLORS[c].uk}.` }));
  });
  return takeN(qs, n);
}

/* ---------- числа ---------- */
const NUMS = ["one","two","three","four","five","six","seven","eight","nine","ten"];
const NUM_UK = ["один","два","три","чотири","пʼять","шість","сім","вісім","девʼять","десять"];
function numberQs(from, to, n, things){
  const ns = []; for(let i = from; i <= to; i++) ns.push(i);
  const words = ns.map(x => NUMS[x-1]);
  const qs = [];
  ns.forEach(x => {
    const w = NUMS[x-1], near = [x-1, x+1, x-2, x+2].filter(y => y >= from && y <= to);
    const tip = `${x} — ${w} (${NUM_UK[x-1]})`;
    qs.push({ ask:"Послухай і обери число.", board:sayBtn(w, true), pre:w, cls:"ltr",
      opts:fill(String(x), near.map(String), ns.map(String)).map(t=>({t})), ans:String(x), say:w, tip });
    qs.push({ ask:"Як це число англійською?", board:`<div class="pic letter">${x}</div>`,
      opts:fill(w, near.map(y=>NUMS[y-1]), words).map(t=>({t})), ans:w, say:w, tip });
    const th = pick(things);                      // [емодзі, однина, множина]
    const phrase = x === 1 ? `one ${th[1]}` : `${w} ${th[2]}`;
    qs.push({ ask:"Порахуй. Скільки?", board:`<div class="pic many count">${Array(x).fill(th[0]).join("")}</div>`,
      opts:fill(phrase, near.map(y => y === 1 ? `one ${th[1]}` : `${NUMS[y-1]} ${th[2]}`), []).map(t=>({t})),
      ans:phrase, say:phrase, tip:phrase, cls:"long" });
  });
  return takeN(qs, n);
}

/* ---------- великі й малі літери ---------- */
const ABC = "abcdefghijklmnopqrstuvwxyz".split("");
const LOOKALIKE = {b:"dpq",d:"bpq",p:"qbd",q:"pgd",m:"nw",n:"mh",u:"nv",v:"uwy",w:"mv",i:"jl",j:"ig",l:"it",
  e:"ca",c:"eo",o:"ca",a:"oe",g:"qj",h:"nk",k:"hx",f:"tk",t:"fl",y:"vj",x:"kz",z:"sx",s:"zc",r:"nf"};
const letterSay = ch => ch.toUpperCase() + ".";
function letterOpts(ch, near){
  const look = (LOOKALIKE[ch] || "").split("");
  return fill(ch, [...new Set([...look, ...(near||[])])].filter(x => x !== ch), ABC);
}

/* ---------- фінал: питання з усіх рівнів, без повторів ---------- */
function finalMix(n){
  const out = [], seen = new Set(), lv = LEVELS.slice(0, -1);
  let g = 0;
  while(out.length < n && g++ < 10){
    shuffle(lv).forEach(L => {
      if(out.length >= n) return;
      const q = shuffle(L.gen()).find(x => !seen.has((x.word || "") + x.board + x.ans));
      if(q){ seen.add((q.word || "") + q.board + q.ans); out.push(q); }
    });
  }
  return shuffle(out);
}


/* ---------- My alphabet: Listen and repeat · Find and circle · Match ---------- */
/* _pple → a */
function firstLetter(ch, near){
  const w = LETTER_WORD[ch], i = w.indexOf(ch);
  return { ask:"Яка літера пропущена?", board:`<div class="pic">${emo(w)}</div><div class="sent">${esc(w.slice(0, i))}${hole}${esc(w.slice(i + 1))}</div>${sayBtn(w)}`,
    opts:letterOpts(ch, near).map(t=>({t})), ans:ch, say:w, cls:"ltr", tip:`${w} — ${W[w].uk}` };
}
/* почуй назву літери → знайди її */
function hearLetter(ch, near){
  return { ask:"Послухай і знайди літеру.", board:sayBtn(letterSay(ch), true), pre:letterSay(ch),
    opts:letterOpts(ch, near).map(t=>({t})), ans:ch, say:letterSay(ch), cls:"ltr", tip:`Це літера ${ch.toUpperCase()} ${ch}` };
}
/* Find and circle: мала → велика (і навпаки) */
function caseQ(ch, near, up){
  return { ask: up ? "Знайди малу літеру." : "Знайди велику літеру.",
    board:`<div class="pic letter">${up ? ch.toUpperCase() : ch}</div>`,
    opts:letterOpts(ch, near).map(t => ({t: up ? t : t.toUpperCase()})), cls:"ltr",
    ans: up ? ch : ch.toUpperCase(), say:letterSay(ch), tip:`${ch.toUpperCase()} ${ch} — одна літера` };
}
/* слово починається з літери… */
function startsWith(ch, near){
  const w = LETTER_WORD[ch];
  const pool = near.map(c => LETTER_WORD[c]).filter(x => x !== w);
  const wrong = fill(w, pool, Object.keys(W).filter(x => !x.includes(ch)), 2).filter(x => x !== w);
  return { ask: ch === "x" ? "У якому слові є літера X x?" : `Яке слово починається з ${ch.toUpperCase()} ${ch}?`,
    board:`<div class="pic letter">${ch.toUpperCase()}${ch}</div>${sayBtn(letterSay(ch))}`, cls:"emo",
    opts:shuffle([w, ...wrong]).map(t=>({t, h:emo(t)})), ans:w, say:w, tip:wordTip(w) };
}
function genGroup(letters){
  const ls = letters.split(""), words = ls.map(c => LETTER_WORD[c]);
  const byL = ls.map(c => {
    const w = LETTER_WORD[c];
    const qs = [hearPic(w, words), picWord(w, words), firstLetter(c, ls), hearLetter(c, ls), caseQ(c, ls, Math.random() < .4), startsWith(c, ls)];
    if(/^[a-z]{3,5}$/.test(w)) qs.push(spell(w));
    return shuffle(qs);
  });
  const out = [];
  let r = 0;
  while(out.length < 8 && r < 7){ byL.forEach(a => { if(out.length < 8 && a[r]) out.push(a[r]); }); r++; }
  return shuffle(out);
}
function genCase(){
  return shuffle(ABC).slice(0, 8).map((c, i) => caseQ(c, [], i % 2 === 1));
}

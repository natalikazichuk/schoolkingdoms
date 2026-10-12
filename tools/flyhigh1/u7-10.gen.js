/* ---------- 7 Family ---------- */
function genFamily(){
  return shuffle([...wordsMix(FAMILY, 5), ...wordsMix(FAMILY.filter(w => w !== "me"), 3, [picWord, wordUk, hearPic])]);
}
/* ---------- 7 This is (my brother) / (me). Hello. I'm … ---------- */
function genThisIs(){
  const qs = [];
  FAMILY.filter(w => w !== "me").forEach(w => {
    qs.push(gap(`<div class="pic">👉${emo(w)}</div>`, "This is my ", ".", w, others(FAMILY.filter(x => x !== "me"), w, 2), { ask:"Хто це? Встав слово." }));
  });
  qs.push(gap(`<div class="pic">👉🙋</div>`, "This is ", ".", "me", ["my", "mum"], { ask:"Це я! Встав слово." }));
  qs.push(choice("Що означає «This is my sister»?", `<div class="word">This is my sister.</div>${sayBtn("This is my sister.")}`,
    "Це моя сестра.", ["Це мій брат.", "Це моя мама."], { say:"This is my sister." }));
  qs.push(choice("Що означає «This is my dad»?", `<div class="word">This is my dad.</div>${sayBtn("This is my dad.")}`,
    "Це мій тато.", ["Це мій брат.", "Це я."], { say:"This is my dad." }));
  qs.push(gap(`<div class="pic">👋🙋</div>`, "Hello. I'm ", ".", "Oksana", ["mum", "sister"], { ask:"Привітайся і назви себе." }));
  return shuffle(qs).slice(0, 8);
}

/* ---------- 8 Toys ---------- */
function genToys(){
  return shuffle([...wordsMix(TOYS2, 6), ...shuffle(["bike","kite","ball","plane"]).slice(0, 2).map(spell)]);
}
/* ---------- 8 I've got a (yellow) (train). My favourite toy is my (yellow) (plane). ---------- */
function genGot(){
  const qs = [];
  const UK = {train:"потяг", plane:"літак", bike:"велосипед", guitar:"гітару"};
  const CUK = {yellow:"жовтий", red:"червоний", blue:"синій", green:"зелений"};
  const CUKf = {yellow:"жовту", red:"червону", blue:"синю", green:"зелену"};   // гітару — жіночий рід
  for(let i = 0; i < 4; i++){
    const toy = pick(TOYS), col = pick(Object.keys(CUK));
    const o1 = pick(TOYS.filter(x => x !== toy)), o2 = pick(Object.keys(CUK).filter(x => x !== col));
    const ukc = toy === "guitar" ? CUKf[col] : CUK[col];
    qs.push(choice(`Як сказати: «У мене є ${ukc} ${UK[toy]}»?`, `<div class="pic">${emo(toy)}${swatch(col)}</div>`,
      `I've got a ${col} ${toy}.`, [`I've got a ${col} ${o1}.`, `I've got a ${o2} ${toy}.`]));
  }
  shuffle(TOYS).slice(0, 2).forEach(w =>
    qs.push(gap(`<div class="pic">💖${emo(w)}</div>`, "My favourite toy is my ", ".", w, others(TOYS, w, 2), { ask:"Улюблена іграшка. Встав слово." })));
  qs.push(choice("Що означає «My favourite toy»?", `<div class="word">my favourite toy</div>${sayBtn("my favourite toy")}`,
    "моя улюблена іграшка", ["моя нова іграшка", "мій улюблений колір"], { say:"my favourite toy" }));
  qs.push(choice("Що означає «I've got a bike»?", `<div class="word">I've got a bike.</div>${sayBtn("I've got a bike.")}`,
    "У мене є велосипед.", ["Я люблю велосипед.", "Це велосипед?"], { say:"I've got a bike." }));
  return shuffle(qs);
}

/* ---------- 9 Colours (2): pink, black, orange, white. I can see a (pink) (bird)! My favourite colour is (black). ---------- */
function genColours2(){
  const NEW = ["pink","black","orange","white"];
  const qs = colourQs(NEW, 5);
  const c = pick(NEW);
  qs.push(gap(`<div class="pic">👀🐦${swatch(c)}</div>`, `I can see a `, " bird!", c, others(NEW, c, 2), { ask:"Якого кольору пташка?" }));
  const f = pick(["red","blue","green","yellow","pink","black","orange","white"]);
  qs.push(gap(`<div class="pic">💖${swatch(f)}</div>`, "My favourite colour is ", ".", f, others(Object.keys(COLORS), f, 2), { ask:"Улюблений колір. Встав слово." }));
  qs.push(choice("Що означає «I can see a pink bird!»?", `<div class="word">I can see a pink bird!</div>${sayBtn("I can see a pink bird!")}`,
    "Я бачу рожеву пташку!", ["У мене є рожева пташка!", "Я люблю рожевий колір!"], { say:"I can see a pink bird!" }));
  return shuffle(qs);
}

/* ---------- 10 How old are you? I'm … Happy birthday! ---------- */
function genBirthday(){
  const qs = [];
  shuffle([6,7,8,9,10]).slice(0, 4).forEach(n => {
    const w = NUMS[n-1], near = [n-1, n+1].filter(x => x >= 5 && x <= 10).map(x => `I'm ${NUMS[x-1]}.`);
    qs.push(choice("How old are you? Порахуй свічки.", `<div class="pic">🎂</div><div class="pic many count">${"🕯️".repeat(n)}</div>`,
      `I'm ${w}.`, near.length > 1 ? near : [...near, "I'm a cake."].slice(0, 2), { say:`How old are you? I'm ${w}.` }));
  });
  qs.push(choice("Що кажуть на день народження?", `<div class="pic">🎂🎁🎈</div>`, "Happy birthday!", ["Goodbye!", "Sit down!"]));
  qs.push(choice("Тобі кажуть «Happy birthday!» Що відповісти?", `<div class="word">Happy birthday!</div>${sayBtn("Happy birthday!")}`,
    "Thank you!", ["Goodbye!", "I'm a bird."], { say:"Happy birthday! Thank you!" }));
  qs.push(choice("Що означає «How old are you?»", `<div class="word">How old are you?</div>${sayBtn("How old are you?")}`,
    "Скільки тобі років?", ["Як тебе звати?", "Що це?"], { say:"How old are you?" }));
  qs.push(hearPic(pick(["cake","present"]), ["cake","present","ball"]));
  return shuffle(qs);
}

/* ---------- Goodbye! Here's a (white flower). ---------- */
function genGoodbye(){
  const cols = ["white","pink","yellow","red","blue","orange"];
  const qs = [];
  shuffle(cols).slice(0, 3).forEach(c => qs.push(gap(`<div class="pic">🌼${swatch(c)}</div>`, "Here's a ", " flower.", c, others(cols, c, 2), { ask:"Якого кольору квітка?" })));
  qs.push(choice("Як попрощатися англійською?", `<div class="pic">👋🚪</div>`, "Goodbye!", ["Hello!", "Thank you!"]));
  qs.push(choice("Що означає «Goodbye!»?", `<div class="word">Goodbye!</div>${sayBtn("Goodbye!")}`, "До побачення!", ["Привіт!", "Дякую!"], { say:"Goodbye!" }));
  qs.push(choice("Що означає «Here's a white flower»?", `<div class="word">Here's a white flower.</div>${sayBtn("Here's a white flower.")}`,
    "Ось біла квітка.", ["Я бачу білу квітку.", "Мені подобається біла квітка."], { say:"Here's a white flower." }));
  qs.push(choice("Тобі дарують квітку. Що скажеш?", `<div class="pic">🌼🤲</div>`, "Thank you!", ["Goodbye!", "Sit down!"]));
  qs.push(choice("Послухай. Що сказали?", sayBtn("Goodbye!", true), "Goodbye!", ["Hello!", "Happy birthday!"], { extra:{ pre:"Goodbye!" } }));
  return shuffle(qs);
}
/* ---------- Happy Christmas! Merry Christmas! Here's your present. Thank you. ---------- */
function genXmas(){
  const qs = [...wordsMix(XMAS, 3), ...wordsMix(XMAS, 2, [wordUk, picWord])];
  qs.push(choice("Що кажуть на Різдво?", `<div class="pic">🎄🎅</div>`, "Merry Christmas!", ["Happy birthday!", "Goodbye!"]));
  qs.push(choice("Тобі дають подарунок: «Here's your present.» Що скажеш?", `<div class="pic">🎅🎁</div>`,
    "Thank you!", ["Hello!", "Sit down."], { say:"Here's your present. Thank you!" }));
  qs.push(gap(`<div class="pic">🎅🎁</div>`, "Here's your ", ".", "present", ["stocking", "tree"]));
  return shuffle(qs);
}
/* ---------- Happy Easter! I've got (three) eggs! ---------- */
function genEaster(){
  const qs = [...wordsMix(EASTER, 3), ...wordsMix(EASTER, 2, [wordUk, picWord])];
  shuffle([2,3,4,5]).slice(0, 2).forEach(n => {
    const near = [n-1, n+1].filter(x => x >= 1 && x <= 6).map(x => `I've got ${NUMS[x-1]} eggs!`);
    qs.push(choice("Порахуй яйця в кошику.", `<div class="pic">🧺</div><div class="pic many count">${"🥚".repeat(n)}</div>`,
      `I've got ${NUMS[n-1]} eggs!`, near.slice(0, 2)));
  });
  qs.push(choice("Що кажуть на Великдень?", `<div class="pic">🐰🥚🧺</div>`, "Happy Easter!", ["Merry Christmas!", "Goodbye!"]));
  return shuffle(qs);
}
/* ---------- Easter in Ukraine: paint, stripes, spots ---------- */
function genPysanka(){
  const qs = [...PYS.map(w => hearPic(w, PYS)), ...PYS.map(w => picWord(w, PYS))];
  qs.push(choice("Яка писанка в смужку?", sayBtn("stripes", true), "stripes", ["spots", "paint"],
    { extra:{ cls:"emo", opts:shuffle(PYS).map(t => ({t, h:emo(t)})), pre:"stripes" } }));
  qs.push(choice("Що означає «spots»?", `<div class="word">spots</div>${sayBtn("spots")}`, "цятки", ["смужки", "фарба"], { say:"spots" }));
  return shuffle(qs).slice(0, 8);
}
/* ---------- Let's read: Toys (Oksana) ---------- */
const OKSANA = "Hello! My name is Oksana. I've got many toys. I've got a small orange plane, a big green kite and three green balls. My favourite toy is my pink bike.";
function readBox(){ return `<div class="sent" style="font-size:16px;line-height:1.45;text-align:left">${esc(OKSANA)}</div>${sayBtn(OKSANA)}`; }
function genReadToys(){
  return shuffle([
    choice("Прочитай. Яка улюблена іграшка Оксани?", readBox(), "bike", ["plane", "kite"], { say:"My favourite toy is my pink bike." }),
    choice("Прочитай. Якого кольору літак?", readBox(), "orange", ["green", "pink"], { say:"a small orange plane" }),
    choice("Прочитай. Якого кольору повітряний змій?", readBox(), "green", ["orange", "pink"], { say:"a big green kite" }),
    choice("Прочитай. Скільки мʼячів?", readBox(), "three", ["two", "five"], { say:"three green balls" }),
    choice("Прочитай. Як звати дівчинку?", readBox(), "Oksana", ["Anna", "Tom"], { say:"My name is Oksana." }),
    hearPic("kite", ["plane","kite","ball","bike"]),
    hearPic("plane", ["plane","kite","ball","bike"]),
    picWord("bike", ["plane","kite","ball","bike"]),
  ]);
}
/* ---------- Culture: Ukraine (vyshyvanka, the Ukrainian flag) ---------- */
function genUkraine(){
  return shuffle([
    choice("Якого кольору прапор України?", `<div class="pic">🇺🇦</div>`, "blue and yellow", ["red and white", "green and blue"], { say:"It's blue and yellow." }),
    gap(`<div class="pic">🇺🇦</div>`, "This is the Ukrainian ", ".", "flag", ["bus", "kite"]),
    yesNo(`<div class="pic">🇺🇦</div>`, "Is the Ukrainian flag orange?", false, { say:"Is the Ukrainian flag orange? No, it isn't.", tip:"No, it isn't. It's blue and yellow." }),
    yesNo(`<div class="pic">🇺🇦</div>`, "Is the Ukrainian flag blue and yellow?", true, { say:"Yes, it is.", tip:"Yes, it is!" }),
    choice("Оксана: «I've got a vyshyvanka. It's white, red and …»", `<div class="pic">👚${swatch("white")}${swatch("red")}${swatch("black")}</div>`,
      "black", ["green", "blue"], { say:"It's white, red and black." }),
    choice("Що означає «It's cool! I like it!»?", `<div class="word">It's cool! I like it!</div>${sayBtn("It's cool! I like it!")}`,
      "Вона класна! Мені подобається!", ["Вона біла. Вона моя.", "Мені холодно!"], { say:"It's cool! I like it!" }),
    choice("Have you got a vyshyvanka? Так, є.", `<div class="pic">🧒👚</div>`, "Yes, I have.", ["No, I haven't.", "Yes, it is."]),
    choice("Do you like vyshyvankas? Так!", `<div class="pic">😍👚</div>`, "Yes, I do.", ["No, I don't.", "Yes, I am."]),
  ]);
}
/* ---------- Culture: Great Britain (London, buses, the British flag) ---------- */
function genBritain(){
  return shuffle([
    choice("Якого кольору британський прапор?", `<div class="pic">🇬🇧</div>`, "red, white and blue", ["blue and yellow", "black and white"], { say:"It's red, white and blue." }),
    choice("Якого кольору лондонський автобус?", `<div class="pic">🚌🇬🇧</div>`, "red", ["black", "green"], { say:"It's red." }),
    choice("Tom: «I live in …» Де живе Том?", `<div class="pic">🧒🏙️🇬🇧</div>`, "London", ["Kyiv", "the jungle"], { say:"I live in London." }),
    choice("Are London buses black?", `<div class="pic">🚌</div>`, "No, they aren't.", ["Yes, they are."], { say:"Are London buses black? No, they aren't." }),
    choice("Is the British flag blue and yellow?", `<div class="pic">🇬🇧</div>`, "No, it isn't.", ["Yes, it is."], { say:"No, it isn't." }),
    choice("Are you from Great Britain? Ти з України.", `<div class="pic">🧒🇺🇦</div>`, "No, I'm not.", ["Yes, I am."], { say:"Are you from Great Britain? No, I'm not." }),
    choice("Що означає «London is big»?", `<div class="word">London is big.</div>${sayBtn("London is big.")}`, "Лондон великий.", ["Лондон гарний.", "Я люблю Лондон."], { say:"London is big." }),
    hearPic("bus", ["bus","bike","plane"]),
  ]);
}

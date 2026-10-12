/* ---------- Hello! ---------- */
function genHello(){
  return shuffle([
    choice("👋 Як привітатися англійською?", `<div class="pic">👋😀</div>`, "Hello!", ["Goodbye!", "Thank you!"]),
    choice("Як попрощатися англійською?", `<div class="pic">👋🚪</div>`, "Goodbye!", ["Hello!", "Sit down!"]),
    choice("Тебе питають: «What's your name?» Що відповісти?", `<div class="word">What's your name?</div>${sayBtn("What's your name?")}`,
           "I'm Anna.", ["Goodbye!", "It's red."], { say:"What's your name? I'm Anna." }),
    choice("Що означає «What's your name?»", `<div class="word">What's your name?</div>${sayBtn("What's your name?")}`,
           "Як тебе звати?", ["Що це?", "Скільки тобі років?"], { say:"What's your name?" }),
    choice("Що означає «Hello! I'm Tom.»", `<div class="word">Hello! I'm Tom.</div>${sayBtn("Hello! I'm Tom.")}`,
           "Привіт! Я Том.", ["Бувай, Томе!", "Це Том?"], { say:"Hello! I'm Tom." }),
    gap(`<div class="pic">🙋</div>`, "Hello! I'm ", ".", "Max", ["red", "lion"], { ask:"Встав своє імʼя: Hello! I'm …" }),
    gap(`<div class="pic">🧒❓</div>`, "What's your ", "?", "name", ["pen", "red"]),
    choice("Послухай. Що сказали?", sayBtn("Hello!", true), "Hello!", ["Goodbye!", "Yes!"], { extra:{ pre:"Hello!" } }),
  ]);
}

/* ---------- 1 In the jungle: I'm (Cabu). I'm a (lion). Look! (A banana) / (Flowers) ---------- */
function genJungle(){
  const qs = wordsMix(JUNGLE, 5);
  const a = shuffle(ANIMALS).slice(0, 2);
  a.forEach(w => qs.push(gap(`<div class="pic">${emo(w)}</div>`, "I'm a ", ".", w, others(ANIMALS, w, 2), { ask:"Хто я? Встав слово." })));
  qs.push(pick([
    gap(`<div class="pic">🍌</div>`, "Look! A ", "!", "banana", ["bee", "flower"]),
    gap(`<div class="pic many">🌸🌸🌸</div>`, "Look! ", "!", "Flowers", ["A flower", "Bees"]),
  ]));
  return shuffle(qs);
}

/* ---------- 4 In the classroom: Hello! I'm your teacher. Here's your desk. ---------- */
function genClassroom(){
  const qs = wordsMix(CLASSRM, 5);
  qs.push(gap(`<div class="pic">🧑‍🏫</div>`, "Hello! I'm your ", ".", "teacher", ["desk", "door"]));
  shuffle(["desk","chair","book"]).slice(0, 2).forEach(w =>
    qs.push(gap(`<div class="pic">${emo(w)}</div>`, "Here's your ", ".", w, others(CLASSRM.filter(x=>x!=="teacher"), w, 2))));
  return shuffle(qs);
}

/* ---------- 5 School things: What is it? It's a (pen). Is it a (pen)? Yes./No. ---------- */
function genSchool(){
  const qs = wordsMix(SCHOOL, 4);
  shuffle(SCHOOL.filter(w => !isHtml(w))).slice(0, 2).forEach(w => {
    const o = others(SCHOOL, w, 2);
    qs.push(choice("What is it? Обери відповідь.", `<div class="pic">${emo(w)}</div>`, `It's a ${w}.`, o.map(x => `It's a ${x}.`)));
  });
  shuffle(SCHOOL).slice(0, 2).forEach(w => {
    const yes = Math.random() < .5, asked = yes ? w : pick(SCHOOL.filter(x => x !== w));
    qs.push(yesNo(`<div class="pic">${emo(w)}</div>`, `Is it a ${asked}?`, yes,
      { say:`Is it a ${asked}? ${yes ? "Yes." : "No."}`, tip: yes ? `Yes. It's a ${w}.` : `No. It's a ${w} — ${W[w].uk}.` }));
  });
  return shuffle(qs);
}

/* ---------- 6 Classroom actions: Sit down. OK, good. ---------- */
function genActions(){
  const qs = ACTIONS.map(w => hearPic(w, ACTIONS));
  ACTIONS.forEach(w => qs.push(choice("Вчитель показує. Що він каже?", `<div class="pic">${emo(w)}</div>`,
    w[0].toUpperCase() + w.slice(1) + ".", others(ACTIONS, w, 2).map(x => x[0].toUpperCase() + x.slice(1) + "."), { tip:wordTip(w) })));
  qs.push(wordUk(pick(ACTIONS), ACTIONS));
  return shuffle(qs).slice(0, 8);
}

/* ---------- 11 I've got (a nose) / (two eyes). ---------- */
function genGotFace(){
  const ONE = {nose:"a nose", mouth:"a mouth"}, TWO = {eye:"two eyes", ear:"two ears"};
  const all = ["I've got a nose.", "I've got a mouth.", "I've got two eyes.", "I've got two ears."];
  const qs = [];
  Object.keys(ONE).forEach(w => qs.push(choice("Обери правильне речення.", `<div class="pic">${emo(w)}</div>`,
    `I've got ${ONE[w]}.`, others(all, `I've got ${ONE[w]}.`, 2))));
  Object.keys(TWO).forEach(w => qs.push(choice("Обери правильне речення.", `<div class="pic">${emo(w)}${emo(w)}</div>`,
    `I've got ${TWO[w]}.`, others(all, `I've got ${TWO[w]}.`, 2))));
  qs.push(gap(`<div class="pic">👁️👁️</div>`, "I've got two ", ".", "eyes", ["eye", "nose"]));
  qs.push(gap(`<div class="pic">👂👂</div>`, "I've got two ", ".", "ears", ["ear", "mouths"]));
  qs.push(gap(`<div class="pic">👃</div>`, "I've got a ", ".", "nose", ["noses", "ears"]));
  qs.push(choice("Що означає «I've got two eyes»?", `<div class="word">I've got two eyes.</div>${sayBtn("I've got two eyes.")}`,
    "У мене два ока.", ["У мене два вуха.", "У мене один ніс."], { say:"I've got two eyes." }));
  return shuffle(qs);
}

/* ---------- 12 What's this? It's a (cat). Have you got a pet? Yes, I've got a (cat). / No. What am I? You're a (rabbit). ---------- */
function genPetTalk(){
  const qs = [];
  shuffle(PETS).slice(0, 2).forEach(w => qs.push(choice("What's this? Обери відповідь.", `<div class="pic">${emo(w)}</div>`,
    `It's a ${w}.`, others(PETS, w, 2).map(x => `It's a ${x}.`))));
  shuffle(PETS).slice(0, 2).forEach(w => qs.push(choice("Have you got a pet? Подивись і дай відповідь.", `<div class="pic">🧒💖${emo(w)}</div>`,
    `Yes, I've got a ${w}.`, [...others(PETS, w, 1).map(x => `Yes, I've got a ${x}.`), "No."], { say:`Have you got a pet? Yes, I've got a ${w}.` })));
  qs.push(choice("Have you got a pet? У хлопчика немає тварини.", `<div class="pic">🧒🚫</div>`,
    "No.", ["Yes, I've got a cat.", "Yes, I've got a dog."], { say:"Have you got a pet? No." }));
  shuffle(["rabbit","snake","cat","hamster"]).slice(0, 2).forEach(w => qs.push(choice("What am I? Хто я?", `<div class="pic">🎭${emo(w)}</div>`,
    `You're a ${w}.`, others(PETS, w, 2).map(x => `You're a ${x}.`), { say:`What am I? You're a ${w}.` })));
  qs.push(choice("Що означає «Have you got a pet?»", `<div class="word">Have you got a pet?</div>${sayBtn("Have you got a pet?")}`,
    "У тебе є домашня тварина?", ["Що це?", "Хто я?"], { say:"Have you got a pet?" }));
  return shuffle(qs).slice(0, 8);
}

/* ---------- 13 I like (chips). I don't like (salad). ---------- */
function genLike(){
  const qs = [];
  shuffle(FOOD).slice(0, 4).forEach((w, i) => {
    const like = i % 2 === 0;
    qs.push(choice(like ? "Дитині смакує. Що вона каже?" : "Дитині не смакує. Що вона каже?",
      `<div class="pic">${like ? "😋" : "🤢"}${emo(w)}</div>`,
      like ? `I like ${w}.` : `I don't like ${w}.`,
      [like ? `I don't like ${w}.` : `I like ${w}.`, `I like ${pick(FOOD.filter(x => x !== w))}.`].slice(0, 2)));
  });
  shuffle(FOOD).slice(0, 2).forEach(w => qs.push(gap(`<div class="pic">😋${emo(w)}</div>`, "I like ", ".", w, others(FOOD, w, 2))));
  qs.push(choice("Що означає «I don't like salad»?", `<div class="word">I don't like salad.</div>${sayBtn("I don't like salad.")}`,
    "Я не люблю салат.", ["Я люблю салат.", "У мене є салат."], { say:"I don't like salad." }));
  qs.push(gap(`<div class="pic">🤢🥗</div>`, "I ", " like salad.", "don't", ["do", "am"], { ask:"Не смакує. Встав слово." }));
  return shuffle(qs);
}

/* ---------- 14 I can (fly). Can you (run)? Yes, I can. / No, I can't. ---------- */
function genCan(){
  const qs = [];
  ACTIONS.forEach(w => qs.push(gap(`<div class="pic">${emo(w)}</div>`, "I can ", ".", w, others(ACTIONS, w, 2), { ask:"Що я вмію? Встав слово." })));
  [["run", true], ["swim", true], ["fly", false], ["jump", true]].forEach(([w, yes]) => qs.push(choice(`Can you ${w}? Подивись і дай відповідь.`,
    `<div class="pic">🧒${emo(w)}${yes ? "✅" : "❌"}</div>`, yes ? "Yes, I can." : "No, I can't.", [yes ? "No, I can't." : "Yes, I can."],
    { say:`Can you ${w}? ${yes ? "Yes, I can." : "No, I can't."}` })));
  qs.push(choice("Що означає «Can you swim?»", `<div class="word">Can you swim?</div>${sayBtn("Can you swim?")}`,
    "Ти вмієш плавати?", ["Я вмію плавати.", "Ти любиш плавати?"], { say:"Can you swim?" }));
  return shuffle(qs).slice(0, 8);
}

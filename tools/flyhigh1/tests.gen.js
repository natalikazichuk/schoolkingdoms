/* ---------- Тести: кожне питання — текст із Teacher's notes, озвучений;
   варіанти — картинки, як на аркуші тесту. Порядок питань — як у тесті. ---------- */
/* listen(що прозвучить, правильний варіант, неправильні, підказка-завдання)
   варіант — [ключ, html]; ключ — для перевірки, html — картинка на кнопці */
function listen(say, right, wrong, ask, tip){
  return { ask: ask || "Послухай і обери.", board:sayBtn(say, true), pre:say, cls:"emo",
    opts:shuffle([right, ...wrong]).map(([t, h]) => ({t, h})), ans:right[0], say, tip: tip || say };
}
const pic = w => [w, emo(w)];
const pics = (w, n) => [`${n} ${w}`, `<span class="many-in">${emo(w).repeat(n)}</span>`];
const col1 = (w, c) => [`${w} ${c}`, `${emo(w)}${swatch(c)}`];
const col2 = (a, b) => [`${a} ${b}`, `⚽${swatch(a)}${swatch(b)}`];
const num = n => [String(n), `<b class="numopt">${n}</b>`];
const yes = (w, ok) => [`${ok ? "" : "no "}${w}`, `${emo(w)}${ok ? "✅" : "❌"}`];
/* «Number one. A lion.» — пара картинок, як на аркуші */
function pair(n, say, right, other, ask){ return listen(`Number ${NUMS[n-1]}. ${say}`, pic(right), [pic(other)], ask || "Listen and circle. Послухай і обери.", `${say} — ${W[right].uk}`); }
/* три варіанти з набору */
function three(n, say, right, pool, ask){ return listen(`Number ${NUMS[n-1]}. ${say}`, pic(right), others(pool, right, 2).map(pic), ask, `${say} — ${W[right].uk}`); }

function test1(){
  const J = ["elephant","parrot","banana","boy","girl","flower","lion","hippo","bee"];
  return [
    pair(1, "A lion.", "lion", "hippo"), pair(2, "An elephant.", "elephant", "lion"), pair(3, "A hippo.", "hippo", "bee"),
    pair(4, "A bee.", "bee", "flower"), pair(5, "A banana.", "banana", "elephant"), pair(6, "A flower.", "flower", "banana"),
    ...[["An elephant.","elephant"],["A parrot.","parrot"],["A banana.","banana"],["A boy.","boy"],["A girl.","girl"],["A flower.","flower"]]
      .map(([s, w], i) => three(i + 1, s, w, J, "Listen and draw. Що треба намалювати?")),
  ];
}
function test2(){
  const C = ["blue","red","yellow","green"];
  const t1 = [["A flower. It's blue.","flower","blue"],["A banana. It's green.","banana","green"],["An elephant. It's red.","elephant","red"],
              ["A bee. It's yellow.","bee","yellow"],["A flower. It's red.","flower","red"],["A hippo. It's blue.","hippo","blue"]];
  const t2 = [["yellow","red"],["blue","green"],["red","blue"],["green","yellow"],["yellow","blue"],["green","red"]];
  return [
    ...t1.map(([s, w, c], i) => listen(`Number ${NUMS[i]}. Look. ${s}`, col1(w, c), others(C, c, 2).map(x => col1(w, x)), "Listen and colour. Якого кольору?", `${s} — ${COLORS[c].uk}`)),
    ...t2.map(([a, b], i) => {
      const wrong = shuffle(t2.filter(([x, y]) => !(x === a && y === b) && !(x === b && y === a))).slice(0, 2);
      return listen(`Number ${NUMS[i]}. It's ${a} and ${b}.`, col2(a, b), wrong.map(([x, y]) => col2(x, y)), "Listen and colour. Який мʼяч?", `It's ${a} and ${b}.`);
    }),
  ];
}
function test3(){
  const t1 = [["Two bananas.","banana",2],["Five flowers.","flower",5],["One bee.","bee",1],["Three lions.","lion",3],["Two hippos.","hippo",2],["Four elephants.","elephant",4]];
  const t2 = [["flowers","flower",5],["bees","bee",2],["hippos","hippo",1],["parrots","parrot",4],["bananas","banana",3],["lions","lion",5]];
  return [
    ...t1.map(([s, w, n], i) => listen(`Number ${NUMS[i]}. Look. ${s}`, pics(w, n), others([1,2,3,4,5], n, 2).map(x => pics(w, x)), "Listen and circle. Скільки?", s)),
    ...t2.map(([pl, w, n], i) => listen(`Number ${NUMS[i]}. How many ${pl}? ${NUMS[n-1][0].toUpperCase() + NUMS[n-1].slice(1)}.`, num(n),
      others([1,2,3,4,5], n, 2).map(num), `Listen and circle. ${emo(w)} Скільки?`, `How many ${pl}? ${NUMS[n-1]}.`)),
  ];
}
function test4(){
  const P = ["banana","chair","desk","book","door","teacher"];
  return [
    pair(1, "It's a bee.", "bee", "flower"), pair(2, "It's a book.", "book", "teacher"), pair(3, "It's a door.", "door", "desk"),
    pair(4, "It's a teacher.", "teacher", "chair"), pair(5, "It's a desk.", "desk", "book"), pair(6, "It's a chair.", "chair", "door"),
    ...["banana","desk","book","teacher"].map((w, i) => listen(`Look. Here's your ${w}.`, pic(w), others(P, w, 2).map(pic), "Listen and circle. Що тобі дають?", `Here's your ${w}. — ${W[w].uk}`)),
  ];
}
function test5(){
  const S = ["book","pencil","bag","chair","crayon","rubber"];
  return [
    ...S.map((w, i) => three(i + 1, `It's a ${w}.`, w, S, "Listen and match. Що це?")),
    pair(1, "It's a chair.", "chair", "bag"), pair(2, "It's a desk.", "desk", "pencil"), pair(3, "It's a bag.", "bag", "crayon"),
    pair(4, "It's a rubber.", "rubber", "chair"), pair(5, "It's a pencil.", "pencil", "desk"), pair(6, "It's a crayon.", "crayon", "chair"),
  ];
}
function test6(){
  const A = ["clap","turn around","sit down","stand up"];
  const cap = s => s[0].toUpperCase() + s.slice(1) + ".";
  return [
    pair(1, "Clap.", "clap", "turn around"), pair(2, "Turn around.", "turn around", "sit down"), pair(3, "Clap.", "clap", "turn around"),
    pair(4, "Sit down.", "sit down", "clap"), pair(5, "Stand up.", "stand up", "turn around"), pair(6, "Sit down.", "sit down", "stand up"),
    ...[["Paco","clap"],["Cabu","turn around"],["Trumpet","sit down"],["Mr Kuma","stand up"],["Jim","clap"],["Miss Maru","turn around"]]
      .map(([who, a], i) => listen(`Number ${NUMS[i]}. ${who}. ${cap(a)}`, pic(a), others(A, a, 2).map(pic), `Listen and match. Що робить ${who}?`, `${who}. ${cap(a)} — ${W[a].uk}`)),
  ];
}
function test7(){
  const F = ["brother","mother","father","sister"];
  const F2 = ["me","teacher","mother","father","sister","brother"];
  return [
    three(1, "My brother.", "brother", F, "Listen and circle. Хто це?"), three(2, "My mother.", "mother", F, "Listen and circle. Хто це?"),
    three(3, "My father.", "father", F, "Listen and circle. Хто це?"), three(4, "My sister.", "sister", F, "Listen and circle. Хто це?"),
    three(5, "My brother.", "brother", F, "Listen and circle. Хто це?"), three(6, "My mother.", "mother", F, "Listen and circle. Хто це?"),
    three(1, "This is me. I'm Trumpet.", "me", F2, "Listen and match. Хто це?"), three(2, "This is my teacher.", "teacher", F2, "Listen and match. Хто це?"),
    three(3, "This is my mother.", "mother", F2, "Listen and match. Хто це?"), three(4, "This is my father.", "father", F2, "Listen and match. Хто це?"),
    three(5, "This is my sister.", "sister", F2, "Listen and match. Хто це?"), three(6, "This is my brother.", "brother", F2, "Listen and match. Хто це?"),
  ];
}
function test8(){
  const T = ["pencil","ball","plane","train","bike","guitar"];
  return [
    ...["pencil","ball","plane","train","bike","guitar"].map((w, i) => three(i + 1, `A ${w}.`, w, T, "Listen and match. Що це?")),
    ...["pencil","bike","train","guitar","ball","plane"].map((w, i) => three(i + 1, `I've got a ${w}.`, w, T, "Listen and draw. Що в мене є?")),
  ];
}
function test9(){
  const C = ["black","pink","orange","white","red","blue","green","yellow"];
  const t1 = [["dog","black"],["car","pink"],["crayon","black"],["plane","orange"],["ball","white"],["flower","red"]];
  return [
    ...t1.map(([w, c], i) => listen(`Number ${NUMS[i]}. It's ${c}.`, col1(w, c), others(C, c, 2).map(x => col1(w, x)), `Listen and colour. ${emo(w)} Якого кольору?`, `It's ${c}. — ${COLORS[c].uk}`)),
    ...[["Miss Maru","orange"],["Fiona","pink"],["Jim","black"]].map(([who, c], i) =>
      listen(`Number ${NUMS[i]}. ${who}. My favourite colour is ${c}.`, [c, swatch(c)], others(C, c, 2).map(x => [x, swatch(x)]),
        `Listen and colour. Улюблений колір: ${who}`, `My favourite colour is ${c}. — ${COLORS[c].uk}`)),
  ];
}
function test10(){
  const ages = [5,10,6,9,8,7];
  return [
    ...ages.map((n, i) => listen(`Number ${NUMS[i]}. How old are you? I'm ${NUMS[n-1]}.`, num(n), others([5,6,7,8,9,10], n, 2).map(num),
      "Listen and match. Скільки років?", `I'm ${NUMS[n-1]}. — ${n}`)),
    ...[2,9,6,3,10,8].map(n => listen(NUMS[n-1][0].toUpperCase() + NUMS[n-1].slice(1) + ".", num(n),
      others([1,2,3,4,5,6,7,8,9,10], n, 2).map(num), "Listen and circle. Яке число?", `${NUMS[n-1]} — ${n}`)),
  ];
}
function test11(){
  const face = (w, n) => [`${n} ${w}`, emo(w).repeat(n)];
  const t2 = [["I've got two mouths.","mouth",2],["I've got three eyes.","eye",3],["I've got two ears.","ear",2],
              ["I've got two noses.","nose",2],["I've got one ear.","ear",1],["I've got one mouth.","mouth",1]];
  return [
    pair(1, "An eye.", "eye", "nose"), pair(2, "An ear.", "ear", "nose"), pair(3, "A mouth.", "mouth", "eye"),
    pair(4, "An ear.", "ear", "mouth"), pair(5, "An eye.", "eye", "mouth"), pair(6, "A nose.", "nose", "ear"),
    ...t2.map(([s, w, n], i) => listen(s, face(w, n), others([1,2,3], n, 2).map(x => face(w, x)), "Listen and draw. Що в мене є?", s)),
  ];
}
function test12(){
  const P = ["fish","cat","snake","bird","hamster","dog"];
  return [
    pair(1, "Look, it's a dog.", "dog", "rabbit"), pair(2, "Look, it's a cat.", "cat", "snake"), pair(3, "Look, it's a hamster.", "hamster", "rabbit"),
    pair(4, "Look, it's a snake.", "snake", "dog"), pair(5, "Look, it's a bird.", "bird", "hamster"), pair(6, "Look, it's a fish.", "fish", "cat"),
    ...[["Paco","fish"],["Cabu","cat"],["Trumpet","snake"],["Mr Kuma","bird"],["Jim","hamster"],["Miss Maru","dog"]]
      .map(([who, w], i) => three(i + 1, `${who}. I've got a ${w}.`, w, P, `Listen and match. Що є в ${who}?`)),
  ];
}
function test13(){
  const F = ["banana","ice cream","chips","salad","burger","apple"];
  const t2 = [["I don't like pizza.","pizza",false],["I don't like ice cream.","ice cream",false],["I like chips.","chips",true],
              ["I like apples.","apple",true],["I don't like salad.","salad",false],["I like burgers.","burger",true]];
  return [
    ...[["An apple.","apple"],["A salad.","salad"],["A banana.","banana"],["A burger.","burger"],["Chips.","chips"],["An ice cream.","ice cream"]]
      .map(([s, w], i) => three(i + 1, s, w, F, "Listen and match. Що це?")),
    ...t2.map(([s, w, ok], i) => listen(`Number ${NUMS[i]}. ${s}`, yes(w, ok), [yes(w, !ok)], "Listen and circle. Любить чи ні?",
      `${s} — ${ok ? "любить" : "не любить"}`)),
  ];
}
function test14(){
  const A = ["swim","run","jump","fly"];
  const two = (a, b) => [`${a} ${b}`, `${emo(a)}${emo(b)}`];
  const t1 = [["swim","run"],["jump","swim"],["fly","jump"]];
  const t2 = [["fly",true],["run",true],["sing",false],["write",false],["jump",true],["swim",false]];
  return [
    ...t1.map(([a, b], i) => {
      const wrong = [two(a, pick(A.filter(x => x !== a && x !== b))), two(pick(A.filter(x => x !== a && x !== b)), b)];
      if(wrong[0][0] === wrong[1][0]) wrong.pop();
      return listen(`Number ${NUMS[i]}. I can ${a}. I can ${b}.`, two(a, b), wrong, "Listen and circle. Що я вмію?", `I can ${a}. I can ${b}.`);
    }),
    ...t2.map(([w, ok], i) => listen(`Number ${NUMS[i]}. I ${ok ? "can" : "can't"} ${w}.`, yes(w, ok), [yes(w, !ok)],
      "Listen and match. Вмію чи ні?", `I ${ok ? "can" : "can't"} ${w}. — ${ok ? "вмію" : "не вмію"} ${W[w].uk}`)),
  ];
}

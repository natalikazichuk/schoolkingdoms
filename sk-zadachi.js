/* sk-zadachi.js — спільний генератор текстових задач для ігор «Задачі».
   Використовують: zadachi-zapys.html, zadachi-malyunok.html, zadachi-diya.html
   Експортує window.ZAD.
   ВАЖЛИВО про відмінки: num() — називний (підмет: «було 3 груші»),
   numa() — знахідний (додаток: «взяли 1 грушу»). Для живих істот числа
   вживаються лише в підметі, тому знахідний їм не потрібен. */
(function(){
"use strict";

/* [наз.одн., 2-4, 5+, знах.одн., емодзі, спрайт, категорія] */
var NOUNS = [
  ["яблуко","яблука","яблук","яблуко","🍎","zad-apple","item"],
  ["груша","груші","груш","грушу","🍐","zad-pear","item"],
  ["цукерка","цукерки","цукерок","цукерку","🍬","zad-candy","item"],
  ["квітка","квітки","квіток","квітку","🌸","zad-flower","item"],
  ["гриб","гриби","грибів","гриб","🍄","zad-mushroom","item"],
  ["мʼяч","мʼячі","мʼячів","мʼяч","⚽","zad-ball","item"],
  ["зірочка","зірочки","зірочок","зірочку","⭐","zad-star","item"],
  ["горіх","горіхи","горіхів","горіх","🌰","zad-nut","item"],
  ["кулька","кульки","кульок","кульку","🎈","zad-balloon","item"],
  ["книжка","книжки","книжок","книжку","📕","zad-book","item"],
  ["пташка","пташки","пташок","пташку","🐦","zad-bird","bird"],
  ["рибка","рибки","рибок","рибку","🐟","zad-fish","fish"],
  ["метелик","метелики","метеликів","метелика","🦋","zad-butterfly","animal"],
  ["зайчик","зайчики","зайчиків","зайчика","🐰","zad-bunny","animal"]
];

var NAMES = [
  ["Марійка","Марійки","f"],["Софійка","Софійки","f"],["Оксанка","Оксанки","f"],
  ["Дарина","Дарини","f"],["Оленка","Оленки","f"],["Катруся","Катрусі","f"],
  ["Тарас","Тараса","m"],["Назар","Назара","m"],["Юрко","Юрка","m"],
  ["Іванко","Іванка","m"],["Максим","Максима","m"],["Андрійко","Андрійка","m"],
  ["Петрик","Петрика","m"],["Богданчик","Богданчика","m"]
];

var VOWELS = "АЕЄИІЇОУЮЯаеєиіїоуюя";
function uv(w, cap){ var p = (w && VOWELS.indexOf(w.charAt(0)) >= 0) ? "в" : "у"; return cap ? p.toUpperCase() : p; }

function rnd(a,b){ return a + Math.floor(Math.random()*(b-a+1)); }
function pick(arr){ return arr[rnd(0,arr.length-1)]; }
function shuffle(a){ for(var i=a.length-1;i>0;i--){ var j=rnd(0,i), t=a[i]; a[i]=a[j]; a[j]=t; } return a; }

function form(n, nn, acc){
  var n10 = n % 10, n100 = n % 100;
  if(n10 === 1 && n100 !== 11) return acc ? nn[3] : nn[0];
  if(n10 >= 2 && n10 <= 4 && !(n100 >= 12 && n100 <= 14)) return nn[1];
  return nn[2];
}
function num(n, nn){ return n + " " + form(n, nn, false); }   // називний
function numa(n, nn){ return n + " " + form(n, nn, true); }    // знахідний
function many(nn){ return nn[2]; }

/* ─── шаблони ───
   Кожен повертає {text, had, changed, kind}:
   had — підпис першого рядка короткого запису, changed — другого. */
function addStory(a, b, nn){
  var m = many(nn), cat = nn[6], nm = pick(NAMES);
  var her = nm[2] === "f" ? "Їй" : "Йому";
  var t;
  if(cat === "item"){
    t = pick([
      { text: uv(nm[1],true)+" "+nm[1]+" було "+num(a,nn)+". "+her+" подарували ще "+numa(b,nn)+". Скільки "+m+" стало "+uv(nm[1])+" "+nm[1]+"?",
        had:"Було", changed:"Подарували" },
      { text: "На столі лежало "+num(a,nn)+". Поклали ще "+numa(b,nn)+". Скільки "+m+" стало на столі?",
        had:"Лежало", changed:"Поклали" },
      { text: "У першому кошику "+num(a,nn)+", а в другому — "+num(b,nn)+". Скільки "+m+" у двох кошиках разом?",
        had:"У першому", changed:"У другому" }
    ]);
  } else if(cat === "bird"){
    t = pick([
      { text: "На гілці сиділо "+num(a,nn)+". Прилетіло ще "+num(b,nn)+". Скільки "+m+" стало на гілці?",
        had:"Сиділо", changed:"Прилетіло" },
      { text: "Біля годівнички було "+num(a,nn)+", а потім прилетіло ще "+num(b,nn)+". Скільки "+m+" разом?",
        had:"Було", changed:"Прилетіло" }
    ]);
  } else if(cat === "fish"){
    t = { text: "У ставку плавало "+num(a,nn)+". Припливло ще "+num(b,nn)+". Скільки "+m+" стало у ставку?",
          had:"Плавало", changed:"Припливло" };
  } else {
    t = pick([
      { text: "На галявині гуляло "+num(a,nn)+". Прибігло ще "+num(b,nn)+". Скільки "+m+" стало на галявині?",
        had:"Гуляло", changed:"Прибігло" },
      { text: "У саду було "+num(a,nn)+", а в лісі — "+num(b,nn)+". Скільки "+m+" разом?",
        had:"У саду", changed:"У лісі" }
    ]);
  }
  t.kind = "add";
  return t;
}

function subStory(a, b, nn){
  var m = many(nn), cat = nn[6], nm = pick(NAMES);
  var t;
  if(cat === "item"){
    t = pick([
      { text: "У коробці було "+num(a,nn)+". Звідти взяли "+numa(b,nn)+". Скільки "+m+" залишилося в коробці?",
        had:"Було", changed:"Взяли" },
      { text: uv(nm[1],true)+" "+nm[1]+" було "+num(a,nn)+". "+cap(numa(b,nn))+" віддали друзям. Скільки "+m+" залишилося?",
        had:"Було", changed:"Віддали" },
      { text: "На столі лежало "+num(a,nn)+". Прибрали "+numa(b,nn)+". Скільки "+m+" залишилося на столі?",
        had:"Лежало", changed:"Прибрали" }
    ]);
  } else if(cat === "bird"){
    t = { text: "На гілці сиділо "+num(a,nn)+". Полетіло "+num(b,nn)+". Скільки "+m+" залишилося на гілці?",
          had:"Сиділо", changed:"Полетіло" };
  } else if(cat === "fish"){
    t = { text: "У ставку плавало "+num(a,nn)+". Попливло геть "+num(b,nn)+". Скільки "+m+" залишилося у ставку?",
          had:"Плавало", changed:"Попливло" };
  } else {
    t = pick([
      { text: "На галявині гуляло "+num(a,nn)+". Утекло в ліс "+num(b,nn)+". Скільки "+m+" залишилося на галявині?",
        had:"Гуляло", changed:"Утекло" },
      { text: "У саду було "+num(a,nn)+". Сховалося "+num(b,nn)+". Скільки "+m+" залишилося в саду?",
        had:"Було", changed:"Сховалося" }
    ]);
  }
  t.kind = "sub";
  return t;
}

function cap(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

/* Головний генератор одного завдання.
   opts: {max:10|20, op:'add'|'sub'|null (null = випадково), itemsOnly:false} */
function makeTask(opts){
  opts = opts || {};
  var max = opts.max || 10;
  var op = opts.op || (Math.random() < 0.5 ? "add" : "sub");
  var pool = opts.itemsOnly ? NOUNS.filter(function(n){ return n[6] === "item"; }) : NOUNS;
  var nn = pick(pool), a, b, ans, st;

  if(op === "add"){
    a = rnd(1, max - 1); b = rnd(1, max - a);
    ans = a + b; st = addStory(a, b, nn);
  } else {
    a = rnd(2, max); b = rnd(1, a - 1);
    ans = a - b; st = subStory(a, b, nn);
  }
  return {
    a: a, b: b, op: op, answer: ans, noun: nn,
    emoji: nn[4], sprite: nn[5], many: many(nn),
    text: st.text, hadLabel: st.had, changedLabel: st.changed,
    expr: a + (op === "add" ? " + " : " − ") + b,
    wrongExpr: a + (op === "add" ? " − " : " + ") + b
  };
}

/* Варіанти-відповіді: правильна + n-1 правдоподібних, перемішані.
   Повертає {options:[числа], correct:index} */
function answerOptions(ans, count, max){
  count = count || 4;
  var set = {}, list = [ans];
  set[ans] = 1;
  var guard = 0;
  while(list.length < count && guard++ < 400){
    var v = ans + rnd(1,3) * (Math.random() < 0.5 ? -1 : 1);
    if(v < 0 || v > (max || 20) + 2) continue;
    if(set[v]) continue;
    set[v] = 1; list.push(v);
  }
  guard = 0;
  while(list.length < count && guard++ < 400){
    var w = rnd(0, (max || 20));
    if(set[w]) continue;
    set[w] = 1; list.push(w);
  }
  shuffle(list);
  return { options: list, correct: list.indexOf(ans) };
}

window.ZAD = {
  NOUNS: NOUNS, NAMES: NAMES,
  rnd: rnd, pick: pick, shuffle: shuffle,
  num: num, numa: numa, many: many, uv: uv,
  makeTask: makeTask, answerOptions: answerOptions
};
})();

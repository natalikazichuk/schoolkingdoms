/* ---------- словник (Fly High 1, Units 1–6, с. 4–31) ---------- */
const W = {
  /* 1 In the jungle */
  lion:{e:"🦁",uk:"лев"},          elephant:{e:"🐘",uk:"слон"},     parrot:{e:"🦜",uk:"папуга"},
  boy:{e:"👦",uk:"хлопчик"},       girl:{e:"👧",uk:"дівчинка"},     banana:{e:"🍌",uk:"банан"},
  flower:{e:"🌸",uk:"квітка"},     bee:{e:"🐝",uk:"бджола"},        hippo:{e:"🦛",uk:"бегемот"},
  /* 4 In the classroom */
  teacher:{e:"🧑‍🏫",uk:"вчитель"},  desk:{e:'<span class="desk"></span>',uk:"парта"},
  chair:{e:"🪑",uk:"стілець"},     book:{e:"📕",uk:"книжка"},       door:{e:"🚪",uk:"двері"},
  /* 5 School things */
  bag:{e:"🎒",uk:"рюкзак"},        pencil:{e:"✏️",uk:"олівець"},    crayon:{e:"🖍️",uk:"воскова крейда"},
  rubber:{e:'<span class="rubber"></span>',uk:"гумка"},           pen:{e:"🖊️",uk:"ручка"},
  /* 6 Classroom actions */
  "sit down":{e:"🪑⬇️",uk:"сідай"}, "stand up":{e:"🧍⬆️",uk:"встань"}, clap:{e:"👏",uk:"плесни"},
  "turn around":{e:"🔄",uk:"повернись"}
};
const JUNGLE  = ["lion","elephant","parrot","boy","girl","banana","flower","bee","hippo"];
const ANIMALS = ["lion","elephant","parrot","bee","hippo"];
const CLASSRM = ["teacher","desk","chair","book","door"];
const SCHOOL  = ["bag","pencil","crayon","rubber","pen","book"];
const ACTIONS = ["sit down","stand up","clap","turn around"];

const LEVELS = [
  {t:"Hello!",             s:"с. 4–5",   ic:"👋", gen:genHello},
  {t:"In the jungle",      s:"Unit 1",   ic:"🦁", gen:genJungle},
  {t:"Colours",            s:"Unit 2",   ic:"🎨", gen:() => colourQs(["yellow","blue","red","green"], 8)},
  {t:"Numbers 1–5",        s:"Unit 3",   ic:"🔢", gen:() => numberQs(1, 5, 8, [["🐝","bee","bees"],["🍌","banana","bananas"],["🌸","flower","flowers"],["🦁","lion","lions"]])},
  {t:"In the classroom",   s:"Unit 4",   ic:"🧑‍🏫", gen:genClassroom},
  {t:"School things",      s:"Unit 5",   ic:"🎒", gen:genSchool},
  {t:"Classroom actions",  s:"Unit 6",   ic:"👏", gen:genActions},
  {t:"Фінал",              s:"усе разом", ic:"🏆", gen:() => finalMix(10)},
];
const N = LEVELS.length;

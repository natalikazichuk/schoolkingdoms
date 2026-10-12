/* ---------- словник (Fly High 1, Units 11–14, с. 60–83) ---------- */
const W = {
  /* 11 Face */
  eye:{e:"👁️",uk:"око"},           nose:{e:"👃",uk:"ніс"},          ear:{e:"👂",uk:"вухо"},
  mouth:{e:"👄",uk:"рот"},
  /* 12 Pets */
  cat:{e:"🐱",uk:"кіт"},           hamster:{e:"🐹",uk:"хомʼяк"},    snake:{e:"🐍",uk:"змія"},
  rabbit:{e:"🐰",uk:"кролик"},     dog:{e:"🐶",uk:"пес"},           pets:{e:"🐱🐶🐹",uk:"домашні тварини"},
  /* 13 Food */
  "ice cream":{e:"🍦",uk:"морозиво"}, chips:{e:"🍟",uk:"картопля фрі"}, salad:{e:"🥗",uk:"салат"},
  burger:{e:"🍔",uk:"бургер"},     pizza:{e:"🍕",uk:"піца"},
  /* 14 Actions */
  fly:{e:"🐦",uk:"літати"},        jump:{e:"🦘",uk:"стрибати"},     swim:{e:"🏊",uk:"плавати"},
  run:{e:"🏃",uk:"бігати"}
};
const FACE    = ["eye","nose","ear","mouth"];
const PETS    = ["cat","hamster","snake","rabbit","dog"];
const FOOD    = ["ice cream","chips","salad","burger","pizza"];
const ACTIONS = ["fly","jump","swim","run"];

const LEVELS = [
  {t:"Face",               s:"Unit 11",  ic:"👃", gen:() => shuffle([...wordsMix(FACE, 4), ...wordsMix(FACE, 2, [wordUk, picWord]), ...["nose","ear"].map(spell)])},
  {t:"I've got two eyes",  s:"Unit 11",  ic:"👁️", gen:genGotFace},
  {t:"Pets",               s:"Unit 12",  ic:"🐱", gen:() => shuffle([...wordsMix(PETS, 5), ...shuffle(["cat","dog","snake"]).slice(0, 2).map(spell), wordUk("pets", PETS)])},
  {t:"Have you got a pet?",s:"Unit 12",  ic:"🐹", gen:genPetTalk},
  {t:"Food",               s:"Unit 13",  ic:"🍕", gen:() => shuffle([...wordsMix(FOOD, 5), ...wordsMix(FOOD, 3, [wordUk, picWord, hearPic])])},
  {t:"I like chips",       s:"Unit 13",  ic:"😋", gen:genLike},
  {t:"Actions",            s:"Unit 14",  ic:"🏃", gen:() => shuffle([...wordsMix(ACTIONS, 4), ...wordsMix(ACTIONS, 2, [wordUk, picWord]), ...["run","jump"].map(spell)])},
  {t:"Can you run?",       s:"Unit 14",  ic:"🏊", gen:genCan},
  {t:"Фінал",              s:"усе разом", ic:"🏆", gen:() => finalMix(10)},
];
const N = LEVELS.length;

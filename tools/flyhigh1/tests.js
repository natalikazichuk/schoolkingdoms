/* ---------- Fly High 1 Tests (Pearson, Teacher's notes): тексти й картинки ---------- */
const W = {
  lion:{e:"🦁",uk:"лев"}, hippo:{e:"🦛",uk:"бегемот"}, elephant:{e:"🐘",uk:"слон"}, bee:{e:"🐝",uk:"бджола"},
  flower:{e:"🌸",uk:"квітка"}, banana:{e:"🍌",uk:"банан"}, parrot:{e:"🦜",uk:"папуга"}, boy:{e:"👦",uk:"хлопчик"},
  girl:{e:"👧",uk:"дівчинка"}, book:{e:"📕",uk:"книжка"}, door:{e:"🚪",uk:"двері"}, teacher:{e:"🧑‍🏫",uk:"вчитель"},
  desk:{e:'<span class="desk"></span>',uk:"парта"}, chair:{e:"🪑",uk:"стілець"}, pencil:{e:"✏️",uk:"олівець"},
  bag:{e:"🎒",uk:"рюкзак"}, crayon:{e:"🖍️",uk:"воскова крейда"}, rubber:{e:'<span class="rubber"></span>',uk:"гумка"},
  clap:{e:"👏",uk:"плесни"}, "turn around":{e:"🔄",uk:"повернись"}, "sit down":{e:"🪑⬇️",uk:"сідай"}, "stand up":{e:"🧍⬆️",uk:"встань"},
  brother:{e:"👦",uk:"брат"}, sister:{e:"👧",uk:"сестра"}, mother:{e:"👩",uk:"мама"}, father:{e:"👨",uk:"тато"}, me:{e:"🙋",uk:"я"},
  ball:{e:"⚽",uk:"мʼяч"}, plane:{e:"✈️",uk:"літак"}, train:{e:"🚂",uk:"потяг"}, bike:{e:"🚲",uk:"велосипед"}, guitar:{e:"🎸",uk:"гітара"},
  dog:{e:"🐶",uk:"пес"}, car:{e:"🚗",uk:"машинка"},
  eye:{e:"👁️",uk:"око"}, ear:{e:"👂",uk:"вухо"}, mouth:{e:"👄",uk:"рот"}, nose:{e:"👃",uk:"ніс"},
  cat:{e:"🐱",uk:"кіт"}, hamster:{e:"🐹",uk:"хомʼяк"}, snake:{e:"🐍",uk:"змія"}, bird:{e:"🐦",uk:"пташка"},
  fish:{e:"🐟",uk:"риба"}, rabbit:{e:"🐰",uk:"кролик"},
  apple:{e:"🍎",uk:"яблуко"}, salad:{e:"🥗",uk:"салат"}, burger:{e:"🍔",uk:"бургер"}, chips:{e:"🍟",uk:"картопля фрі"},
  "ice cream":{e:"🍦",uk:"морозиво"}, pizza:{e:"🍕",uk:"піца"},
  swim:{e:"🏊",uk:"плавати"}, run:{e:"🏃",uk:"бігати"}, jump:{e:"🦘",uk:"стрибати"}, fly:{e:"🐦",uk:"літати"},
  sing:{e:"🎤",uk:"співати"}, write:{e:"✍️",uk:"писати"}
};

const LEVELS = [
  {t:"Test 1 · In the jungle",      s:"Unit 1",  ic:"🦁", gen:test1},
  {t:"Test 2 · Colours",            s:"Unit 2",  ic:"🎨", gen:test2},
  {t:"Test 3 · Numbers 1–5",        s:"Unit 3",  ic:"🔢", gen:test3},
  {t:"Test 4 · In the classroom",   s:"Unit 4",  ic:"🚪", gen:test4},
  {t:"Test 5 · School things",      s:"Unit 5",  ic:"🎒", gen:test5},
  {t:"Test 6 · Classroom actions",  s:"Unit 6",  ic:"👏", gen:test6},
  {t:"Test 7 · Family",             s:"Unit 7",  ic:"👪", gen:test7},
  {t:"Test 8 · Toys",               s:"Unit 8",  ic:"🚂", gen:test8},
  {t:"Test 9 · Colours (2)",        s:"Unit 9",  ic:"🖍️", gen:test9},
  {t:"Test 10 · Numbers 6–10",      s:"Unit 10", ic:"🎂", gen:test10},
  {t:"Test 11 · Face",              s:"Unit 11", ic:"👃", gen:test11},
  {t:"Test 12 · Pets",              s:"Unit 12", ic:"🐱", gen:test12},
  {t:"Test 13 · Food",              s:"Unit 13", ic:"🍕", gen:test13},
  {t:"Test 14 · Actions",           s:"Unit 14", ic:"🏃", gen:test14},
];
const N = LEVELS.length;

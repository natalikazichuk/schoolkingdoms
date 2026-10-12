/* ---------- словник (Fly High 1, Units 7–10, с. 34–57) ---------- */
const W = {
  /* 7 Family */
  mum:{e:"👩",uk:"мама"},          dad:{e:"👨",uk:"тато"},          brother:{e:"👦",uk:"брат"},
  sister:{e:"👧",uk:"сестра"},     me:{e:"🙋",uk:"я"},
  /* 8 Toys */
  train:{e:"🚂",uk:"потяг"},       plane:{e:"✈️",uk:"літак"},       bike:{e:"🚲",uk:"велосипед"},
  guitar:{e:"🎸",uk:"гітара"},     kite:{e:"🪁",uk:"повітряний змій"}, ball:{e:"⚽",uk:"мʼяч"},
  /* 9 Colours (2) */
  bird:{e:"🐦",uk:"пташка"},
  /* 10 Numbers 6–10 */
  cake:{e:"🎂",uk:"торт"},         present:{e:"🎁",uk:"подарунок"}
};
const FAMILY = ["mum","dad","brother","sister","me"];
const TOYS   = ["train","plane","bike","guitar"];
const TOYS2  = ["train","plane","bike","guitar","kite","ball"];

const LEVELS = [
  {t:"Family",             s:"Unit 7",   ic:"👪", gen:genFamily},
  {t:"This is my brother", s:"Unit 7",   ic:"👦", gen:genThisIs},
  {t:"Toys",               s:"Unit 8",   ic:"🚂", gen:genToys},
  {t:"I've got a train",   s:"Unit 8",   ic:"🎸", gen:genGot},
  {t:"Colours",            s:"Unit 9",   ic:"🎨", gen:genColours2},
  {t:"Numbers 6–10",       s:"Unit 10",  ic:"🔢", gen:() => numberQs(6, 10, 8, [["🍎","apple","apples"],["✏️","pencil","pencils"],["🎈","balloon","balloons"],["⭐","star","stars"]])},
  {t:"Happy birthday!",    s:"Unit 10",  ic:"🎂", gen:genBirthday},
  {t:"Фінал",              s:"усе разом", ic:"🏆", gen:() => finalMix(10)},
];
const N = LEVELS.length;

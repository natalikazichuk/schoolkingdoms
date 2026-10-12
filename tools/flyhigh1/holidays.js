/* ---------- словник (Fly High 1: Goodbye!, свята, Let's read, Culture — с. 86–106) ---------- */
const W = {
  flower:{e:"🌼",uk:"квітка"},
  /* Happy Christmas! */
  present:{e:"🎁",uk:"подарунок"}, "Father Christmas":{e:"🎅",uk:"Дід Різдво"}, stocking:{e:"🧦",uk:"різдвяна панчоха"},
  /* Happy Easter! */
  "Easter Bunny":{e:"🐰",uk:"Великодній кролик"}, egg:{e:"🥚",uk:"яйце"}, basket:{e:"🧺",uk:"кошик"},
  /* Easter in Ukraine */
  paint:{e:"🎨",uk:"фарба"},       stripes:{e:'<span class="egg stripes"></span>',uk:"смужки"},
  spots:{e:'<span class="egg spots"></span>',uk:"цятки"},
  /* Let's read: Toys */
  plane:{e:"✈️",uk:"літак"},       kite:{e:"🪁",uk:"повітряний змій"}, ball:{e:"⚽",uk:"мʼяч"},
  bike:{e:"🚲",uk:"велосипед"},
  /* Culture */
  bus:{e:"🚌",uk:"автобус"},       flag:{e:"🏳️",uk:"прапор"}
};
const XMAS   = ["present","Father Christmas","stocking"];
const EASTER = ["Easter Bunny","egg","basket"];
const PYS    = ["paint","stripes","spots"];

const LEVELS = [
  {t:"Goodbye!",              s:"с. 86",   ic:"👋", gen:genGoodbye},
  {t:"Happy Christmas!",      s:"с. 88",   ic:"🎅", gen:genXmas},
  {t:"Happy Easter!",         s:"с. 90",   ic:"🐰", gen:genEaster},
  {t:"Easter in Ukraine",     s:"с. 91",   ic:"🥚", gen:genPysanka},
  {t:"Let's read: Toys",      s:"с. 102",  ic:"🚲", gen:genReadToys},
  {t:"Ukraine",               s:"с. 105",  ic:"🇺🇦", gen:genUkraine},
  {t:"Great Britain",         s:"с. 106",  ic:"🇬🇧", gen:genBritain},
  {t:"Фінал",                 s:"усе разом", ic:"🏆", gen:() => finalMix(10)},
];
const N = LEVELS.length;

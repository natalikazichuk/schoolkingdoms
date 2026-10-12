/* ---------- слова абетки (Fly High 1, My alphabet, с. 32–83) ---------- */
const W = {
  apple:{e:"🍎",uk:"яблуко"},     ball:{e:"⚽",uk:"мʼяч"},         car:{e:"🚗",uk:"машинка"},
  dog:{e:"🐶",uk:"пес"},          egg:{e:"🥚",uk:"яйце"},          fish:{e:"🐟",uk:"риба"},
  goat:{e:"🐐",uk:"коза"},        horse:{e:"🐴",uk:"кінь"},        insect:{e:"🐞",uk:"комаха"},
  jelly:{e:"🍮",uk:"желе"},       kite:{e:"🪁",uk:"повітряний змій"}, lorry:{e:"🚚",uk:"вантажівка"},
  monkey:{e:"🐵",uk:"мавпа"},     nurse:{e:"🧑‍⚕️",uk:"медсестра"},   orange:{e:"🍊",uk:"апельсин"},
  panda:{e:"🐼",uk:"панда"},      queen:{e:"👸",uk:"королева"},    rabbit:{e:"🐰",uk:"кролик"},
  star:{e:"⭐",uk:"зірка"},        tree:{e:"🌳",uk:"дерево"},       umbrella:{e:"☂️",uk:"парасолька"},
  violin:{e:"🎻",uk:"скрипка"},   watch:{e:"⌚",uk:"годинник"},
  fox:{e:"🦊",uk:"лисиця"},       "yo-yo":{e:"🪀",uk:"йо-йо"},     zebra:{e:"🦓",uk:"зебра"}
};
/* літера → слово з підручника (x — fox: звук /ks/ у кінці слова) */
const LETTER_WORD = {a:"apple",b:"ball",c:"car",d:"dog",e:"egg",f:"fish",g:"goat",h:"horse",i:"insect",
  j:"jelly",k:"kite",l:"lorry",m:"monkey",n:"nurse",o:"orange",p:"panda",q:"queen",r:"rabbit",
  s:"star",t:"tree",u:"umbrella",v:"violin",w:"watch",x:"fox",y:"yo-yo",z:"zebra"};
const GROUPS = [["abc","с. 32–33"],["def","с. 38–39"],["ghi","с. 44–45"],["jkl","с. 50–51"],["mno","с. 56–57"],
  ["pqr","с. 64–65"],["stu","с. 70–71"],["vw","с. 76–77"],["xyz","с. 82–83"]];

const LEVELS = [
  ...GROUPS.map(([l, s]) => ({ t:l.split("").map(c => c.toUpperCase() + c).join(" "), s, ic:W[LETTER_WORD[l[0]]].e, gen:() => genGroup(l) })),
  {t:"Великі й малі", s:"a → A",      ic:"🔠", gen:genCase},
  {t:"Фінал",         s:"уся абетка", ic:"🏆", gen:() => finalMix(10)},
];
const N = LEVELS.length;

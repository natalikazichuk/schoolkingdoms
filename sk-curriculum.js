/* sk-curriculum.js — ЄДИНА карта королівства (ступені → класи → предмети → розділи → тести).
   Підключають: tests.html (дорожня карта), test.html (замки ланцюга), admin.html (редактор).

   ГОЛОВНЕ: карта живе у Firestore (документ curriculum/map) і редагується в адмінці.
   Тут лишається DEFAULT_MAP — запасний варіант на випадок, якщо документа ще немає
   або база недоступна (гість). Тобто сайт ніколи не лишається без карти.

   Раніше цей масив був продубльований у tests.html і test.html, і копії розходилися.
   Тепер джерело одне — файл + документ у базі. */
(function(){
"use strict";

/* ВЕРСІЯ API МОДУЛЯ.
   Інкрементуй щоразу, коли додаєш або міняєш експорт у window.SKCUR.
   Сторінки перевіряють це число й кажуть «онови sk-curriculum.js»,
   замість того щоб мовчки падати з порожнім екраном.
     1 — перша версія (карта, ланцюги)
     2 — normalize/statKey-неутральна
     3 — + STATS, statLabel, statKeyFrom, statKey у предметах
     4 — ланцюги на id тестів: chains(map,tests), chainIndex, chainPrev/chainNext
         замість chainPrevTitle/chainNextTitle (назва більше не ідентифікатор)
     5 — + placeTests(map,tests): розкладка тестів по розділах живе тут.
         Раніше вона була написана двічі — у tests.html (три правила) і в
         admin.html/checkMap (одне правило), і копії розійшлися: перевірка
         звітувала про «сиріт», яких у дитини видно нормально, і мовчала про
         тести, що реально випадали через клас/предмет/однакову назву. */
var API_VERSION = 5;

var PASS_RATIO = 0.55;

/* ─── СТАТИ ───
   Єдиний список на все королівство. Раніше назви жили в трьох місцях і
   розійшлися: hero.html казав «Точність», test.html і admin.html —
   «Влучність». Тут — канон; предмет на карті обирає стат зі списку,
   а не набирає текст руками.
   active:false — стат ще без формули (заглушка на майбутнє). */
var STATS = [
  { key:'health',       label:"Здоров'я",   emoji:'❤️', active:true,  note:'Українська мова, читання' },
  { key:'accuracy',     label:'Точність',   emoji:'🎯', active:true,  note:'Математика' },
  { key:'agility',      label:'Спритність', emoji:'🏃', active:true,  note:'ЯДС' },
  { key:'mana',         label:'Мана',       emoji:'🔮', active:true,  note:'Англійська, логіка, памʼять' },
  { key:'strength',     label:'Сила',       emoji:'💪', active:false, note:'' },
  { key:'defense',      label:'Захист',     emoji:'🛡️', active:false, note:'' },
  { key:'intelligence', label:'Інтелект',   emoji:'🧠', active:false, note:'' },
  { key:'wisdom',       label:'Мудрість',   emoji:'📖', active:false, note:'' },
  { key:'luck',         label:'Удача',      emoji:'🍀', active:false, note:'' },
  { key:'memory',       label:'Памʼять',    emoji:'🧩', active:false, note:'' },
  { key:'charisma',     label:'Харизма',    emoji:'✨', active:false, note:'' }
];

function statByKey(key){
  for(var i = 0; i < STATS.length; i++) if(STATS[i].key === key) return STATS[i];
  return null;
}
/* 'accuracy' → 'Точність 🎯' (саме це видно дитині на карті) */
function statLabel(key){
  var s = statByKey(key);
  return s ? (s.label + ' ' + s.emoji) : '';
}
/* Зворотне: старі карти зберігали лише підпис. Впізнаємо і ключ, і будь-який
   із підписів — включно зі старим «Влучність», щоб нічого не загубилось. */
var STAT_ALIASES = { 'влучність':'accuracy', 'точність':'accuracy', 'здоровя':'health' };
function statKeyFrom(v){
  var raw = String(v == null ? '' : v);
  if(statByKey(raw)) return raw;                       // це вже ключ
  var n = norm(raw).replace(/[^а-яіїєґa-z ]/gi, '').trim();
  if(!n) return '';
  for(var i = 0; i < STATS.length; i++){
    if(norm(STATS[i].label).replace(/[^а-яіїєґa-z ]/gi,'').trim() === n) return STATS[i].key;
  }
  return STAT_ALIASES[n] || '';
}

/* ─── Запасна карта = те, що було зашито в код ─── */
var DEFAULT_MAP = {
  version: 2,
  tiers: [
    { id:'preschool', icon:'🌱', name:'Дошкільна підготовка', status:'soon',
      note:'Готуємо майбутнього першачка. Заплановано.', grades:[] },
    { id:'junior', icon:'🎓', name:'Молодша школа', status:'wip',
      note:'1 клас — активний. 2–4 класи заплановано.',
      grades:[
        { id:'g1', name:'1 клас', status:'wip', gradeNum:1,
          subjects:[
            { id:'math', icon:'🧮', name:'Математика', accent:'#5C6BC0', statKey:'accuracy', stat:'Точність 🎯',
              keys:['матем'],
              topics:[
                { topic:'Лічба',                chain:false, tests:['Лічба вперед/назад'] },
                { topic:'Числа в межах 10',     chain:true,  tests:['Додавання до 10','Віднімання до 10'] },
                { topic:'Числа в межах 20',     chain:true,  tests:['Додавання до 20','Віднімання до 20'] },
                { topic:'Числа в межах 100',    chain:true,  tests:['Додавання до 100','Віднімання до 100'] },
                { topic:'Знайди помилку',       chain:true,  chainGroup:'err',
                  tests:['Знайди помилку до 10','Знайди помилку до 20','Знайди помилку до 100'] },
                { topic:'Задачі',               chain:false,
                  tests:['Задачі на додавання','Задачі на віднімання','Задачі на невідомий компонент'] },
                { topic:'Розрядність чисел',    chain:false, tests:['Десятки і одиниці'] },
                { topic:'Вирази у дві дії',     chain:false,
                  tests:['Вирази у дві дії: додавання','Вирази у дві дії: віднімання'] },
                { topic:'Вирази у три дії',     chain:false,
                  tests:['Вирази у три дії: додавання','Вирази у три дії: віднімання'] },
                { topic:'Назви компонентів дій', chain:false,
                  tests:['Компоненти додавання','Компоненти віднімання'] },
                { topic:'Величини (см, дм, м)', chain:false, tests:['Одиниці довжини'] },
                { topic:'Порівняння чисел',     chain:false, tests:['Порівняння чисел'] },
                { topic:'Геометричні фігури',   chain:false, tests:['Геометричні фігури'] },
                { topic:'Цікава математика',    chain:false, tests:['Логічні задачі','Нестандартні задачі'] }
              ] },
            { id:'yads', icon:'🌍', name:'ЯДС · Я досліджую світ', accent:'#E0954E', statKey:'agility', stat:'Спритність 🏃',
              keys:['ядс','я досліджую світ','природознав','довкіл'], topics:[] },
            { id:'eng',  icon:'🔤', name:'English', accent:'#3FB6A8', statKey:'mana', stat:'Мана 🔮',
              keys:['english','англ'], topics:[] },
            { id:'ukr',  icon:'🌺', name:'Українська мова', accent:'#D6577A', statKey:'health', stat:'Здоровʼя ❤️',
              keys:['україн','укр мова','рідна мова'], topics:[] }
          ] }
      ] },
    { id:'senior', icon:'🏰', name:'Старша школа', status:'soon',
      note:'5–11 класи. Заплановано.', grades:[] }
  ]
};

/* ─── утиліти ─── */
function norm(s){
  return String(s == null ? '' : s).toLowerCase()
    .replace(/[’'`ʼ]/g, '').replace(/\s+/g, ' ').trim();
}
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function clone(o){ return JSON.parse(JSON.stringify(o)); }
/* УВАГА: спершу відсіяти, потім перетворювати. String(null) === 'null' — truthy,
   тож .map(String).filter(Boolean) лишав у масиві привида «null». */
function nonEmpty(x){ return x != null && String(x).trim() !== ''; }
function trimStr(x){ return String(x).trim(); }

/* Предмет тесту зіставляється з предметом карти за keys[] або за назвою */
function subjectMatches(subj, testSubject){
  var v = norm(testSubject);
  if(!v) return false;
  var keys = (subj && subj.keys) || [];
  for(var i = 0; i < keys.length; i++){
    if(v.indexOf(norm(keys[i])) >= 0) return true;
  }
  return norm(subj && subj.name) === v;
}

/* Приводимо будь-що з бази до безпечної форми (жодних undefined у рендері) */
function normalize(map){
  var out = { version: 2, tiers: [] };
  var tiers = (map && Array.isArray(map.tiers)) ? map.tiers : [];
  out.tiers = tiers.map(function(t, ti){
    return {
      id:     String(t.id || ('tier' + ti)),
      icon:   String(t.icon || '📚'),
      name:   String(t.name || 'Ступінь'),
      status: (t.status === 'ready' || t.status === 'wip' || t.status === 'soon') ? t.status : 'soon',
      note:   String(t.note || ''),
      grades: (Array.isArray(t.grades) ? t.grades : []).map(function(g, gi){
        return {
          id:       String(g.id || ('g' + gi)),
          name:     String(g.name || ((g.gradeNum || gi + 1) + ' клас')),
          status:   (g.status === 'ready' || g.status === 'wip' || g.status === 'soon') ? g.status : 'wip',
          gradeNum: Number(g.gradeNum) || (gi + 1),
          subjects: (Array.isArray(g.subjects) ? g.subjects : []).map(function(s, si){
            // Стат: джерело істини — statKey. Старі карти мали лише підпис —
            // впізнаємо його і піднімаємо до ключа, щоб нічого не загубилось.
            var sKey = statKeyFrom(s.statKey) || statKeyFrom(s.stat);
            return {
              id:     String(s.id || ('s' + si)),
              icon:   String(s.icon || '📘'),
              name:   String(s.name || 'Предмет'),
              accent: String(s.accent || '#5C6BC0'),
              statKey: sKey,
              stat:   sKey ? statLabel(sKey) : String(s.stat || '—'),
              keys:   (Array.isArray(s.keys) ? s.keys : []).filter(nonEmpty).map(trimStr),
              topics: (Array.isArray(s.topics) ? s.topics : []).map(function(tp){
                return {
                  topic:      String(tp.topic || ''),
                  chain:      !!tp.chain,
                  chainGroup: String(tp.chainGroup || ''),
                  tests:      (Array.isArray(tp.tests) ? tp.tests : []).filter(nonEmpty).map(trimStr)
                };
              }).filter(function(tp){ return tp.topic; })
            };
          })
        };
      })
    };
  });
  if(!out.tiers.length) out.tiers = clone(DEFAULT_MAP).tiers;
  return out;
}

/* ─── ЛАНЦЮГИ ───
   У карті розділ зберігає посилання на тести. Раніше це були НАЗВИ, і назва
   де-факто працювала ідентифікатором: перейменував тест — ланцюг тихо розсипався.
   Тепер канон — id тесту. Старі карти з назвами теж читаються (findTest пробує
   спершу id, потім назву), тож нічого не ламається до міграції.

   Групуються за ступенем+класом+предметом+chainGroup, тож ланцюги різних
   класів і предметів ніколи не перетинаються. */

function indexTests(tests){
  var byId = {}, byTitle = {};
  (tests || []).forEach(function(t){
    if(!t || !t.id) return;
    byId[String(t.id)] = t;
    if(t.title) byTitle[norm(t.title)] = t;
  });
  return { byId: byId, byTitle: byTitle };
}

/* Посилання з карти → тест. Приймає і id (нове), і назву (старі карти). */
function findTest(ref, idx){
  if(ref == null || !idx) return null;
  var r = String(ref).trim();
  if(!r) return null;
  return idx.byId[r] || idx.byTitle[norm(r)] || null;
}

/* Сирі посилання ланцюгів — як вони лежать у карті. */
function chainRefs(map){
  var groups = {}, order = [];
  eachSubject(map, function(subj, grade, tier){
    (subj.topics || []).forEach(function(tp){
      if(!tp.chain) return;
      var key = tier.id + '|' + grade.id + '|' + subj.id + '|' + (tp.chainGroup || 'main');
      if(!groups[key]){ groups[key] = []; order.push(key); }
      (tp.tests || []).forEach(function(n){ groups[key].push(n); });
    });
  });
  return order.map(function(k){ return groups[k]; });
}

/* Ланцюги, розвʼязані в об'єкти тестів.
   Нерозпізнані посилання відкидаємо: «дірка» в ланцюгу не повинна замикати
   все, що далі. Адмінка про такі посилання попереджає окремо. */
function chains(map, tests){
  var idx = indexTests(tests);
  return chainRefs(map).map(function(arr){
    var seen = {};
    return arr.map(function(ref){ return findTest(ref, idx); })
      .filter(function(t){
        if(!t || !t.id || seen[t.id]) return false;   // дубль у ланцюгу — теж пропускаємо
        seen[t.id] = 1; return true;
      });
  }).filter(function(a){ return a.length > 0; });
}

/* Готова таблиця сусідів: { [testId]: {prev, next} }. Будується один раз. */
function chainIndex(map, tests){
  var out = {};
  chains(map, tests).forEach(function(arr){
    arr.forEach(function(t, i){
      out[t.id] = {
        prev: i > 0 ? arr[i - 1] : null,
        next: i < arr.length - 1 ? arr[i + 1] : null
      };
    });
  });
  return out;
}

function eachSubject(map, cb){
  (map.tiers || []).forEach(function(tier){
    (tier.grades || []).forEach(function(grade){
      (grade.subjects || []).forEach(function(subj){ cb(subj, grade, tier); });
    });
  });
}

/* Сусід у ланцюгу. Поточний тест шукаємо за id — назва більше ні на що не впливає. */
function chainNeighbour(map, tests, test, dir){
  if(!test || !test.id) return null;
  var e = chainIndex(map, tests)[String(test.id)];
  if(!e) return null;
  return (dir < 0 ? e.prev : e.next) || null;
}
function chainPrev(map, tests, test){ return chainNeighbour(map, tests, test, -1); }
function chainNext(map, tests, test){ return chainNeighbour(map, tests, test, +1); }

/* Міграція карти: назви → id. Повертає {map, changed, unresolved[]}.
   Те, що не розпізналось, лишаємо як є — краще видимий брак, ніж тихо стерте. */
function migrateRefs(map, tests){
  var idx = indexTests(tests), changed = 0, unresolved = [];
  var out = clone(map);
  eachSubject(out, function(subj){
    (subj.topics || []).forEach(function(tp){
      tp.tests = (tp.tests || []).map(function(ref){
        var t = findTest(ref, idx);
        if(!t){ unresolved.push(String(ref)); return ref; }
        if(String(ref) !== String(t.id)) changed++;
        return String(t.id);
      });
    });
  });
  return { map: out, changed: changed, unresolved: unresolved };
}

/* ─── РОЗКЛАДКА ТЕСТІВ ПО КАРТІ ───
   ЄДИНЕ місце, де вирішується «який тест у якому розділі». Раніше це саме
   рішення ухвалювали дві різні функції: distribute() у tests.html (те, що
   бачить дитина) і checkMap() в admin.html (те, що бачить дорослий). Вони
   розійшлися, і перевірка карти показувала не ту картину, що сайт.

   Правила потрапляння тесту в розділ (порядок важливий):
     (а) id або назва тесту стоїть у списку розділу (tp.tests);
     (б) поле topic тесту дорівнює назві розділу;
     (в) назва тесту починається з назви розділу.
   Правила (б) і (в) працюють лише в межах свого предмета (subjectMatches),
   і БУДЬ-ЯКЕ правило вимагає збігу класу: t.grade === grade.gradeNum.

   Приймає map як {tiers:[…]} або як сам масив tiers (tests.html тримає клон
   саме масиву). Нічого не мутує — повертає результат.

   Повертає:
     topics    [{tier,grade,subj,topic,tests[]}]  — по одному запису на КОЖЕН
                                                    розділ карти, навіть порожній
     subjects  [{tier,grade,subj,tests[]}]        — тести, що лягли в предмет
                                                    повз розділи
     leftovers [test]                             — нікуди не лягли → «Інші тести»
     dropped   [{test,reason,…}]                  — випали, хоч мали лягти:
                   reason:'grade'     — вписаний у розділ чужого класу
                   reason:'duplicate' — той самий тест стоїть у двох розділах
                   reason:'sameTitle' — інший тест із такою самою назвою вже
                                        показаний, цей не показується ніде
     unresolved[{ref,topic,subject}]              — посилання ні на що не вказує
     byId      {testId:{subject,topic}}           — де саме опинився тест      */
function placeTests(map, tests){
  var tiers = Array.isArray(map) ? map : ((map && map.tiers) || []);
  var all   = (tests || []).filter(function(t){ return t && t.id; });
  var idx   = indexTests(all);

  var usedId = {}, takenTitle = {};
  var topics = [], subjects = [], leftovers = [], dropped = [], unresolved = [];
  var byId = {};

  var slots = [];
  tiers.forEach(function(tier){
    (tier.grades || []).forEach(function(grade){
      (grade.subjects || []).forEach(function(subj){
        slots.push({ tier: tier, grade: grade, subj: subj });
      });
    });
  });

  /* 1) розділи */
  slots.forEach(function(e){
    if(!(e.subj.topics || []).length) return;
    (e.subj.topics || []).forEach(function(tp){
      var bucket = { tier: e.tier, grade: e.grade, subj: e.subj, topic: tp, tests: [] };
      var tpN = norm(tp.topic);

      // via: 'ref' — явне посилання, 'auto' — правило (б)/(в).
      // Про мовчазну втрату звітуємо лише для явних посилань: перекриття за
      // префіксом («Задачі» і «Задачі у дві дії») — нормальне явище, перший
      // розділ у порядку карти забирає тест, і це не помилка.
      function add(t, via){
        if(!t || !t.title) return;
        if(usedId[t.id]){
          if(via === 'ref' && byId[t.id] && byId[t.id].topic !== tp.topic){
            dropped.push({ test: t, reason: 'duplicate', topic: tp.topic,
                           subject: e.subj.name, first: byId[t.id] });
          }
          return;
        }
        if(Number(t.grade || 1) !== Number(e.grade.gradeNum)){
          if(via === 'ref'){
            dropped.push({ test: t, reason: 'grade', topic: tp.topic, subject: e.subj.name,
                           expected: e.grade.gradeNum, got: t.grade });
          }
          return;
        }
        bucket.tests.push(t);
        usedId[t.id] = true;
        takenTitle[norm(t.title)] = true;
        byId[t.id] = { subject: e.subj.name, topic: tp.topic };
      }

      (tp.tests || []).forEach(function(ref){
        var t = findTest(ref, idx);
        if(!t){ unresolved.push({ ref: String(ref), topic: tp.topic, subject: e.subj.name }); return; }
        add(t, 'ref');
      });
      all.forEach(function(t){
        if(!t.title) return;
        if(!subjectMatches(e.subj, t.subject)) return;
        var byField  = t.topic && norm(t.topic) === tpN;
        var byPrefix = norm(t.title).indexOf(tpN) === 0;
        if(byField || byPrefix) add(t, 'auto');
      });

      topics.push(bucket);
    });
  });

  /* 2) решта → у предмет за класом і предметом (без розділів) */
  var extra = [];
  slots.forEach(function(e){ extra.push({ tier: e.tier, grade: e.grade, subj: e.subj, tests: [] }); });

  all.forEach(function(t){
    if(usedId[t.id]) return;
    if(t.title && takenTitle[norm(t.title)]){
      dropped.push({ test: t, reason: 'sameTitle' });
      return;
    }
    for(var i = 0; i < slots.length; i++){
      var e = slots[i];
      if(Number(t.grade) === Number(e.grade.gradeNum) && subjectMatches(e.subj, t.subject)){
        extra[i].tests.push(t);
        usedId[t.id] = true;
        byId[t.id] = { subject: e.subj.name, topic: null };
        return;
      }
    }
    leftovers.push(t);
  });

  extra.forEach(function(b){ if(b.tests.length) subjects.push(b); });

  return { topics: topics, subjects: subjects, leftovers: leftovers,
           dropped: dropped, unresolved: unresolved, byId: byId };
}

/* ─── завантаження ───
   SKCUR.ready — Promise, який ЗАВЖДИ резолвиться картою (ніколи не падає).
   SKCUR.map   — поточна карта; до завантаження = DEFAULT_MAP, тож синхронний
                 код нічого не ламає навіть до приходу відповіді з бази. */
var API = {
  API_VERSION: API_VERSION,
  PASS_RATIO: PASS_RATIO,
  DEFAULT_MAP: DEFAULT_MAP,
  map: normalize(DEFAULT_MAP),
  norm: norm, esc: esc, clone: clone,
  STATS: STATS, statByKey: statByKey, statLabel: statLabel, statKeyFrom: statKeyFrom,
  normalize: normalize,
  subjectMatches: subjectMatches,
  eachSubject: eachSubject,
  chains: chains,
  chainRefs: chainRefs,
  chainIndex: chainIndex,
  chainPrev: chainPrev,
  chainNext: chainNext,
  indexTests: indexTests,
  findTest: findTest,
  placeTests: placeTests,
  migrateRefs: migrateRefs,
  ready: null,
  loaded: false      // true = карта прийшла з бази, false = запасна
};

function waitSK(cb){
  var tries = 0;
  (function tick(){
    if(window.SK && window.SK.ready) return cb(window.SK);
    if(tries++ < 100) setTimeout(tick, 50);
    else cb(null);
  })();
}

API.ready = new Promise(function(resolve){
  waitSK(function(SK){
    if(!SK || !SK.getCurriculum){ resolve(API.map); return; }
    SK.ready.then(function(){
      return SK.getCurriculum();
    }).then(function(doc){
      if(doc && Array.isArray(doc.tiers) && doc.tiers.length){
        API.map = normalize(doc);
        API.loaded = true;
      }
      resolve(API.map);
    }).catch(function(){
      resolve(API.map);          // база недоступна → запасна карта, сторінка живе
    });
  });
});

window.SKCUR = API;
})();

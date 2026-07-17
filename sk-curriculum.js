/* sk-curriculum.js — ЄДИНА карта королівства (ступені → класи → предмети → розділи → тести).
   Підключають: tests.html (дорожня карта), test.html (замки ланцюга), admin.html (редактор).

   ГОЛОВНЕ: карта живе у Firestore (документ curriculum/map) і редагується в адмінці.
   Тут лишається DEFAULT_MAP — запасний варіант на випадок, якщо документа ще немає
   або база недоступна (гість). Тобто сайт ніколи не лишається без карти.

   Раніше цей масив був продубльований у tests.html і test.html, і копії розходилися.
   Тепер джерело одне — файл + документ у базі. */
(function(){
"use strict";

var PASS_RATIO = 0.55;

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
            { id:'math', icon:'🧮', name:'Математика', accent:'#5C6BC0', stat:'Точність 🎯',
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
            { id:'yads', icon:'🌍', name:'ЯДС · Я досліджую світ', accent:'#E0954E', stat:'Спритність 🏃',
              keys:['ядс','я досліджую світ','природознав','довкіл'], topics:[] },
            { id:'eng',  icon:'🔤', name:'English', accent:'#3FB6A8', stat:'Мана 🔮',
              keys:['english','англ'], topics:[] },
            { id:'ukr',  icon:'🌺', name:'Українська мова', accent:'#D6577A', stat:'Здоровʼя ❤️',
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
            return {
              id:     String(s.id || ('s' + si)),
              icon:   String(s.icon || '📘'),
              name:   String(s.name || 'Предмет'),
              accent: String(s.accent || '#5C6BC0'),
              stat:   String(s.stat || '—'),
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

/* ─── ланцюги: масиви назв тестів, що відкриваються по черзі ───
   Групуються за предметом + chainGroup, тож ланцюги різних предметів
   і різних класів ніколи не перетинаються. */
function chains(map){
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

function eachSubject(map, cb){
  (map.tiers || []).forEach(function(tier){
    (tier.grades || []).forEach(function(grade){
      (grade.subjects || []).forEach(function(subj){ cb(subj, grade, tier); });
    });
  });
}

function neighbourTitle(map, title, dir){
  var gs = chains(map), w = norm(title);
  if(!w) return null;
  for(var g = 0; g < gs.length; g++){
    var arr = gs[g];
    for(var i = 0; i < arr.length; i++){
      if(norm(arr[i]) !== w) continue;
      var j = i + dir;
      return (j >= 0 && j < arr.length) ? arr[j] : null;
    }
  }
  return null;
}
function chainPrevTitle(map, title){ return neighbourTitle(map, title, -1); }
function chainNextTitle(map, title){ return neighbourTitle(map, title, +1); }

/* ─── завантаження ───
   SKCUR.ready — Promise, який ЗАВЖДИ резолвиться картою (ніколи не падає).
   SKCUR.map   — поточна карта; до завантаження = DEFAULT_MAP, тож синхронний
                 код нічого не ламає навіть до приходу відповіді з бази. */
var API = {
  PASS_RATIO: PASS_RATIO,
  DEFAULT_MAP: DEFAULT_MAP,
  map: normalize(DEFAULT_MAP),
  norm: norm, esc: esc, clone: clone,
  normalize: normalize,
  subjectMatches: subjectMatches,
  eachSubject: eachSubject,
  chains: chains,
  chainPrevTitle: chainPrevTitle,
  chainNextTitle: chainNextTitle,
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

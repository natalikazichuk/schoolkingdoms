/* ============================================================
   sk-insights.js — АНАЛІТИКА НАВЧАННЯ («Мої здібності»).

   Чисті функції без DOM і без бази: на вході — тести, уже розкладені по
   розділах карти (SKCUR.placeTests(map, tests).topics), і читач прогресу
   get(key) (localStorage ∪ heroes/{id}.progress). На виході — статус кожної
   теми, предмета і підказки «суперсили / що прокачати / наступний крок».
   Один модуль для сторінки Героя і кабінету батьків — щоб рахували однаково.

   Джерела по тесту (пише test.html):
     sk_testlog_<id>   — журнал останніх спроб [{at,pct,correct,total,dur,wrong[],restarts,lv?}]
     sk_testscore_<id> — остання спроба {pct,correct,total,passed,levels?,at}
     sk_testpass_<id>  — '1' = пройдено (старі спроби без бала)
     sk_test100_<id>   — '1' = 100% / усі рівні

   Статуси теми (TH — пороги, PASS = SKCUR.PASS_RATIO):
     new     🔒 ще не пробував          — жодної спроби
     repeat  🔁 варто повторити          — володіння < 55% або бал упав нижче 75%
     stale   💤 час освіжити             — ≥ 75%, але остання спроба понад 30 днів тому
     master  🌟 майстер                  — усі тести теми пробувані й кожен ≥ 90% двічі поспіль
     good    ✅ вмію                     — ≥ 75%
     learn   🌱 вчуся                    — 55–75%
   ============================================================ */
(function(){
'use strict';

var VERSION = 1;
var DAY = 864e5;
var TH = { pass: 55, good: 75, master: 90, staleDays: 30, trend: 10, recent: 3 };

var STATUS = {
  new:    { icon:'🔒', kid:'Нова пригода',              parent:'Ще не пробував' },
  repeat: { icon:'🔁', kid:'Потренуймося ще',           parent:'Варто повторити' },
  stale:  { icon:'💤', kid:'Давно не грали — згадаймо?', parent:'Час освіжити' },
  master: { icon:'🌟', kid:'Ти майстер!',               parent:'Майстер' },
  good:   { icon:'✅', kid:'Добре виходить',            parent:'Вміє' },
  learn:  { icon:'🌱', kid:'Ще трохи — і вийде',        parent:'Вчиться' }
};

function parse(v){
  if(v == null) return null;
  if(typeof v !== 'string') return v;
  try{ return JSON.parse(v); }catch(e){ return v; }
}
function countLv(v){
  var o = parse(v);
  if(Array.isArray(o)) return o.length;
  return (o && typeof o === 'object') ? Object.keys(o).length : 0;
}
function flag(v){ return v === '1' || v === 1 || v === true; }
function clampPct(n){ n = Math.round(Number(n) || 0); return n < 0 ? 0 : n > 100 ? 100 : n; }

/* журнал спроб: лише коректні записи, від старих до нових */
function readLog(get, id){
  var a = parse(get('sk_testlog_' + id));
  if(!Array.isArray(a)) return [];
  return a.filter(function(r){ return r && typeof r === 'object' && Number(r.at) > 0; })
          .sort(function(x, y){ return x.at - y.at; });
}

/* зважене середнє останніх N балів: новіша спроба важить більше (1,2,3…) */
function weighted(pcts){
  var s = 0, w = 0;
  pcts.forEach(function(p, i){ s += p * (i + 1); w += i + 1; });
  return w ? Math.round(s / w) : 0;
}

/* ── ОДИН ТЕСТ ──
   → {id, title, tried, pct, last, lastAt, attempts, trend:'up'|'down'|'flat', master, passed} */
function testState(test, get){
  var id = test && test.id;
  var out = { id: id, title: (test && test.title) || '', tried: false, pct: 0, last: null,
              lastAt: 0, attempts: 0, trend: 'flat', master: false, passed: false };
  if(!id) return out;
  var nLv = Array.isArray(test.levels) ? test.levels.length : 0;
  var levels = test.format === 'levels' || nLv > 0;
  var log = readLog(get, id);
  var score = parse(get('sk_testscore_' + id));
  if(!score || typeof score !== 'object') score = null;
  var passFlag = flag(get('sk_testpass_' + id));
  var full = flag(get('sk_test100_' + id));

  if(levels){
    /* тест із рівнями: володіння = частка пройдених рівнів (її й пише sk_testscore) */
    if(score){ out.pct = clampPct(score.pct); out.lastAt = Number(score.at) || 0; }
    if(log.length){ out.lastAt = Math.max(out.lastAt, log[log.length - 1].at); }
    /* пройдені рівні (за весь час) — так само рахує смужка «Тести» на сторінці Героя;
       sk_testscore могло й не бути (рівні пройдені до того, як його почали писати) */
    var lvDone = Math.max(countLv(get('sk_lvtest_' + id + '_done')), countLv(get('sk_lvtest_' + id + '_ever')));
    if(nLv > 0 && lvDone > 0) out.pct = Math.max(out.pct, clampPct(lvDone / nLv * 100));
    if(full) out.pct = 100;
    out.tried = !!(score || log.length || passFlag || full || lvDone > 0);
    if(passFlag && out.pct < TH.pass) out.pct = TH.pass;
    out.master = full || out.pct >= TH.master;
  } else if(log.length){
    var pcts = log.map(function(r){ return clampPct(r.pct); });
    out.tried = true;
    out.pct = weighted(pcts.slice(-TH.recent));
    out.lastAt = log[log.length - 1].at;
    var n = pcts.length;
    out.master = n >= 2 && pcts[n - 1] >= TH.master && pcts[n - 2] >= TH.master;
  } else if(score){
    /* спроби до появи журналу — лише останній бал */
    out.tried = true; out.pct = clampPct(score.pct); out.lastAt = Number(score.at) || 0;
    out.master = full && out.pct >= 100;
  } else if(passFlag || full){
    out.tried = true; out.pct = full ? 100 : TH.pass; out.master = full;
  }

  out.attempts = log.length || (out.tried ? 1 : 0);
  /* тренд — лише для звичайних тестів: у тестах із рівнями записи журналу
     належать різним рівням, і порівнювати їх між собою не можна */
  if(log.length && !levels){
    var lastR = log[log.length - 1];
    out.last = clampPct(lastR.pct);
    if(log.length >= 2){
      var d = out.last - clampPct(log[log.length - 2].pct);
      out.trend = d >= TH.trend ? 'up' : d <= -TH.trend ? 'down' : 'flat';
    }
  } else if(out.tried){ out.last = out.pct; }
  out.passed = passFlag || full || out.pct >= TH.pass;
  return out;
}

function starsOf(pct){ return pct >= TH.master ? 3 : pct >= TH.good ? 2 : pct >= TH.pass ? 1 : 0; }

/* ── ОДНА ТЕМА ── placed = {tier, grade, subj, topic, tests[]} із placeTests */
function topicState(placed, get, now){
  now = now || Date.now();
  var tests = (placed && placed.tests) || [];
  var states = tests.map(function(t){ return testState(t, get); });
  var tried = states.filter(function(s){ return s.tried; });
  var mastery = tried.length
    ? Math.round(tried.reduce(function(a, s){ return a + s.pct; }, 0) / tried.length) : 0;
  var lastAt = tried.reduce(function(a, s){ return Math.max(a, s.lastAt || 0); }, 0);
  var fell = tried.some(function(s){ return s.trend === 'down' && s.last != null && s.last < TH.good; });

  var status;
  if(!tried.length) status = 'new';
  else if(mastery < TH.pass || fell) status = 'repeat';
  else if(mastery >= TH.good && lastAt && (now - lastAt) > TH.staleDays * DAY) status = 'stale';
  else if(tried.length === states.length && states.every(function(s){ return s.master; })) status = 'master';
  else if(mastery >= TH.good) status = 'good';
  else status = 'learn';

  /* тест, з якого почати: спершу непройдений, потім найслабший */
  var next = null;
  states.forEach(function(s, i){
    if(next) return;
    if(!s.passed) next = tests[i];
  });
  if(!next && tried.length){
    var weakest = tried.slice().sort(function(a, b){ return a.pct - b.pct; })[0];
    next = tests[states.indexOf(weakest)] || null;
  }

  var tp = (placed && placed.topic) || {};
  return {
    topic: tp.topic || '', chain: !!tp.chain,
    subject: (placed && placed.subj && placed.subj.name) || '',
    subjectId: (placed && placed.subj && placed.subj.id) || '',
    icon: (placed && placed.subj && placed.subj.icon) || '📘',
    accent: (placed && placed.subj && placed.subj.accent) || '',
    statKey: (placed && placed.subj && placed.subj.statKey) || '',
    grade: placed && placed.grade ? placed.grade.gradeNum : null,
    status: status, mastery: mastery, stars: status === 'new' ? 0 : starsOf(mastery),
    tried: tried.length, total: states.length,
    trend: tried.some(function(s){ return s.trend === 'down'; }) ? 'down'
         : tried.some(function(s){ return s.trend === 'up'; }) ? 'up' : 'flat',
    lastAt: lastAt, next: next, tests: states
  };
}

/* ── УСІ ТЕМИ + ПРЕДМЕТИ + ПІДКАЗКИ ──
   placedTopics — SKCUR.placeTests(map, tests).topics; порожні розділи пропускаємо.
   opts.grade — лише цей клас (gradeNum), opts.now — для тестів. */
function analyze(placedTopics, get, opts){
  opts = opts || {};
  var now = opts.now || Date.now();
  var list = (placedTopics || []).filter(function(p){
    if(!p || !p.tests || !p.tests.length) return false;
    return opts.grade == null || (p.grade && Number(p.grade.gradeNum) === Number(opts.grade));
  });
  var topics = list.map(function(p){ return topicState(p, get, now); });

  /* предмети: середнє володіння пробуваних тем */
  var subjects = [], bySubj = {};
  topics.forEach(function(t){
    var k = t.subjectId + '|' + t.grade;
    if(!bySubj[k]){
      bySubj[k] = { subject: t.subject, subjectId: t.subjectId, icon: t.icon, accent: t.accent, statKey: t.statKey, grade: t.grade,
                    topics: [], mastery: 0, tried: 0, total: 0 };
      subjects.push(bySubj[k]);
    }
    bySubj[k].topics.push(t);
  });
  subjects.forEach(function(s){
    var tr = s.topics.filter(function(t){ return t.status !== 'new'; });
    s.tried = tr.length; s.total = s.topics.length;
    s.mastery = tr.length ? Math.round(tr.reduce(function(a, t){ return a + t.mastery; }, 0) / tr.length) : 0;
    s.stars = tr.length ? starsOf(s.mastery) : 0;
  });

  /* суперсили: найсильніші з «майстер/вмію» (до 3) */
  var strengths = topics.filter(function(t){ return t.status === 'master' || t.status === 'good'; })
    .sort(function(a, b){ return (b.mastery - a.mastery) || (b.lastAt - a.lastAt); }).slice(0, 3);

  /* що прокачати: спершу «повторити», потім «освіжити», потім найслабше «вчуся» (до 2) */
  var rank = { repeat: 0, stale: 1, learn: 2 };
  var improve = topics.filter(function(t){ return t.status in rank; })
    .sort(function(a, b){ return (rank[a.status] - rank[b.status]) || (a.mastery - b.mastery); }).slice(0, 2);

  /* наступний крок: перша нова тема одразу після опанованої (у порядку карти, той самий предмет) */
  var nextStep = null;
  for(var i = 1; i < topics.length && !nextStep; i++){
    var prev = topics[i - 1], cur = topics[i];
    if(cur.status === 'new' && prev.subjectId === cur.subjectId && prev.grade === cur.grade
       && (prev.status === 'master' || prev.status === 'good')) nextStep = cur;
  }

  return { version: VERSION, topics: topics, subjects: subjects,
           strengths: strengths, improve: improve, nextStep: nextStep };
}

/* ── ТИПОВІ ПОМИЛКИ (для батьків) ── питання, що найчастіше з помилкою, по журналу */
function commonMistakes(tests, get, limit){
  var cnt = {}, order = [];
  (tests || []).forEach(function(t){
    if(!t || !t.id) return;
    readLog(get, t.id).forEach(function(r){
      (Array.isArray(r.wrong) ? r.wrong : []).forEach(function(q){
        var k = t.id + '\u0000' + q;
        if(!cnt[k]){ cnt[k] = { testId: t.id, test: t.title || '', q: String(q), n: 0 }; order.push(k); }
        cnt[k].n++;
      });
    });
  });
  return order.map(function(k){ return cnt[k]; })
    .sort(function(a, b){ return b.n - a.n; }).slice(0, limit || 5);
}

/* читач прогресу: localStorage, а якщо там порожньо — heroes/{id}.progress.
   Журнал спроб беремо той, де остання спроба новіша (інший пристрій).
   opts.local === false — лише база (кабінет батьків: localStorage там чужий). */
function reader(progress, opts){
  progress = progress || {};
  var local = !(opts && opts.local === false);
  function ls(k){ if(!local) return null; try{ return window.localStorage.getItem(k); }catch(e){ return null; } }
  return function(k){
    var a = ls(k), b = progress[k] != null ? progress[k] : null;
    if(k.indexOf('sk_testlog_') === 0 && a != null && b != null){
      var la = parse(a), lb = parse(b);
      var ta = Array.isArray(la) && la.length ? la[la.length - 1].at : 0;
      var tb = Array.isArray(lb) && lb.length ? lb[lb.length - 1].at : 0;
      return tb > ta ? b : a;
    }
    return a != null ? a : b;
  };
}

var API = { VERSION: VERSION, TH: TH, STATUS: STATUS,
            testState: testState, topicState: topicState, analyze: analyze,
            commonMistakes: commonMistakes, reader: reader, starsOf: starsOf };
window.SKINS = API;
})();

/* ============================================================
   sk-activity.js — облік часу Героя на сайті (для кабінету батьків).

   Підключається сам: з firebase-config.js (більшість сторінок) і з
   sk-finish.js (ігри й тренажери без бази). Дублів не буде — прапорець
   window.__skActivityMounted.

   Рахуємо лише АКТИВНИЙ час: вкладка видима й дитина щось робила
   (дотик, клавіша, рух миші, прокрутка) за останні 2 хв. Розділ — за
   адресою сторінки:
       t — тести й навчання (test.html, tests.html, klas-N/, doshkilya/…)
       g — ігри (games/, igry.html)
       a — арена (arena.html, ekipirovka.html, inventar.html)
       o — інше (карта, бібліотека, сторінка героя…)

   Пишемо в localStorage['sk_activity_v1'] — це ключ прогресу sk_*, тож він
   сам їде в heroes/{id}.progress (див. trackProgress у firebase-config.js),
   без змін у firestore.rules. Формат:
       { v:1,
         d: { 'YYYY-MM-DD': { t:сек, g:сек, a:сек, o:сек } },   // доба за Києвом, ≤ 60 днів
         s: [ { c:'t', n:'назва сторінки', at:мс_початку, s:сек } ], // останні візити, ≤ 40
         last: мс }                                               // остання активність
   Запис — раз на ~90 с і коли вкладка ховається (щоб не смикати базу щосекунди).
   ============================================================ */
(function () {
  'use strict';
  if (window.__skActivityMounted) return;
  window.__skActivityMounted = true;

  var KEY = 'sk_activity_v1';
  var TICK_MS = 15000, IDLE_MS = 120000, SAVE_MS = 90000;
  var KEEP_DAYS = 60, KEEP_SESS = 40, MIN_SESS_SEC = 10;
  var HERO_DOMAIN = '@hero.schoolkingdom.app';

  /* ── розділ сторінки ── */
  function category() {
    var p = (location.pathname || '').toLowerCase();
    // сторінки дорослих і службові — не рахуємо
    if (/\/(parent|admin[^/]*|login|auth|index|prezentaciya|maket-vminnia)\.html$/.test(p) || /\/$/.test(p)) return '';
    if (/\/games\//.test(p) || /\/igry\.html$/.test(p)) return 'g';
    if (/\/(arena|ekipirovka|inventar)\.html$/.test(p)) return 'a';
    if (/\/(klas-\d+|doshkilya|learn|navyvorit|tests)\//.test(p)
        || /\/(test|tests|navchannia|doshkillya|slovnyk-en)\.html$/.test(p)) return 't';
    return 'o';
  }
  var CAT = category();
  if (!CAT) return;

  var ls;
  try { ls = window.localStorage; ls.getItem(KEY); } catch (e) { return; }

  function kyivDay(ts) {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts));
    } catch (e) { return new Date(ts).toISOString().slice(0, 10); }
  }
  function pageName() {
    var t = String(document.title || '').replace(/\s*[—|-]\s*school\s*kingdoms?\s*$/i, '').trim();
    return t.slice(0, 60);
  }

  /* Лише сесія Героя. На сторінках з базою — питаємо SK; без бази (ігри) —
     рахуємо, якщо на пристрої вже є прив'язаний Герой. */
  var enabled = !!ls.getItem('sk_active_child');
  (function waitSK(n) {
    var SK = window.SK;
    if (SK && SK.ready) {
      SK.ready.then(function (user) {
        var hero = !!(user && user.email && String(user.email).slice(-HERO_DOMAIN.length) === HERO_DOMAIN);
        enabled = hero;
        if (!hero) pending = 0;
      }).catch(function () {});
      return;
    }
    if (n < 200) setTimeout(function () { waitSK(n + 1); }, 50);
  })(0);

  var lastInput = Date.now();
  var lastTick = Date.now();
  var pending = 0;              // активні секунди, ще не записані
  var pendingDay = kyivDay(Date.now());
  var sessStart = Date.now();
  var sessSec = 0;              // уже записані секунди цього візиту
  var lastSave = Date.now();

  ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll', 'mousemove'].forEach(function (ev) {
    window.addEventListener(ev, function () { lastInput = Date.now(); }, { passive: true, capture: true });
  });

  function visible() { return document.visibilityState !== 'hidden'; }

  // closing — вкладка щойно сховалась: дораховуємо останній відрізок
  function tick(closing) {
    var now = Date.now();
    var dt = Math.min(now - lastTick, TICK_MS * 2);
    lastTick = now;
    if (!enabled || (!closing && !visible()) || now - lastInput > IDLE_MS || dt <= 0) return;
    var day = kyivDay(now);
    if (day !== pendingDay) { save(); pendingDay = day; }
    pending += dt / 1000;
    if (now - lastSave >= SAVE_MS) save();
  }

  function read() {
    var o = null;
    try { o = JSON.parse(ls.getItem(KEY) || 'null'); } catch (e) {}
    if (!o || typeof o !== 'object') o = {};
    if (!o.d || typeof o.d !== 'object') o.d = {};
    if (!Array.isArray(o.s)) o.s = [];
    o.v = 1;
    return o;
  }

  function save() {
    lastSave = Date.now();
    var add = Math.round(pending);
    if (!enabled || add < 1) return;
    pending -= add;
    var o = read();
    var d = o.d[pendingDay] || (o.d[pendingDay] = {});
    d[CAT] = (Number(d[CAT]) || 0) + add;
    // старі дні — геть
    var days = Object.keys(o.d).sort();
    while (days.length > KEEP_DAYS) delete o.d[days.shift()];
    // візит: оновлюємо свій запис або додаємо новий
    sessSec += add;
    if (sessSec >= MIN_SESS_SEC) {
      var rec = null;
      for (var i = o.s.length - 1; i >= 0; i--) if (o.s[i] && o.s[i].at === sessStart && o.s[i].c === CAT) { rec = o.s[i]; break; }
      if (!rec) { rec = { c: CAT, n: '', at: sessStart, s: 0 }; o.s.push(rec); }
      rec.n = pageName();
      rec.s = sessSec;
      if (o.s.length > KEEP_SESS) o.s.splice(0, o.s.length - KEEP_SESS);
    }
    o.last = Date.now();
    try { ls.setItem(KEY, JSON.stringify(o)); } catch (e) {}
  }

  /* Останній відрізок пишемо вже ПІСЛЯ того, як firebase-config відправив
     прогрес (його обробники pagehide/visibilitychange стоять раніше), тож
     без цього він не доходив у базу — короткі візити губились. */
  function flushNow() {
    try { if (window.SK && window.SK.flushProgress) window.SK.flushProgress(true); } catch (e) {}
  }

  setInterval(function () { tick(false); }, TICK_MS);
  document.addEventListener('visibilitychange', function () {
    if (visible()) { lastTick = Date.now(); lastInput = Date.now(); return; }
    tick(true); save(); flushNow();
    // повернулись пізніше — це вже новий візит
    sessStart = Date.now(); sessSec = 0;
  });
  window.addEventListener('pagehide', function () { if (visible()) tick(true); save(); flushNow(); });
})();

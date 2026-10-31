/* ============================================================
   SK-BETA — анкета бета-тестування (лише на бета-версії сайту).

   Що робить:
     • на кожній сторінці додає плаваючу кнопку «📝 Анкета» (зліва знизу);
     • анкета відкривається у вікні; відповіді зберігаються в браузері
       (localStorage) після кожної зміни, тож протягом тижня її можна
       заповнювати частинами;
     • рахує дні з першого візиту й відвідані сторінки; на 7-й день кнопка
       блимає й нагадує надіслати анкету;
     • «Надіслати» — POST у Google Apps Script → рядок у Google Таблиці
       (docs/beta/apps-script.gs, інструкція — docs/beta/README.md).

   🐞 «Повідомити про помилку» (sk-report.js) не змінюється — помилки
   й далі йдуть в адмінку; анкета лише посилається на нього.

   Коли вмикається:
     • хост починається з «beta.» (beta.school-king.pp.ua);
     • або вручну для перевірки: відкрити будь-яку сторінку з ?beta=1
       (вимкнути — ?beta=0).

   Підвантажують sk-header.js і sk-footer.js (id 'sk-beta-loader').
   ============================================================ */
(function(){
  'use strict';
  if (window.__skBetaMounted) return;

  /* ── адреса веб-застосунку Google Apps Script (Розгорнути → Веб-застосунок → URL) ── */
  var SHEET_URL = window.SK_BETA_SHEET_URL || '';   // ← вставити https://script.google.com/macros/s/…/exec
  var TEST_DAYS = 7;
  var VERSION = 1;               // версія анкети: змінили питання → підняти

  /* ── чи це бета ── */
  function ls(k, v){
    try{
      if(v === undefined) return localStorage.getItem(k);
      if(v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    }catch(e){ return null; }
  }
  try{
    var qp = new URLSearchParams(location.search).get('beta');
    if(qp === '1') ls('sk_beta_force', '1');
    if(qp === '0') ls('sk_beta_force', null);
  }catch(e){}
  var isBeta = /^beta\./i.test(location.hostname) || ls('sk_beta_force') === '1';
  if(!isBeta) return;
  window.__skBetaMounted = true;

  /* ── стан (localStorage) ── */
  var KEY = 'sk_beta_v' + VERSION;
  function load(){
    try{ return JSON.parse(ls(KEY) || 'null') || {}; }catch(e){ return {}; }
  }
  var S = load();
  function save(){ ls(KEY, JSON.stringify(S)); }

  var today = new Date().toISOString().slice(0,10);
  if(!S.tester) S.tester = 'T-' + Math.random().toString(36).slice(2,8).toUpperCase();
  if(!S.first) S.first = today;
  S.days = S.days || [];
  if(S.days.indexOf(today) < 0) S.days.push(today);
  S.pages = S.pages || {};
  var pageName = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/,'') || 'index';
  S.pages[pageName] = (S.pages[pageName] || 0) + 1;
  S.ans = S.ans || {};
  S.sent = S.sent || 0;
  save();

  function daysSinceFirst(){
    var a = new Date(S.first + 'T00:00:00'), b = new Date(today + 'T00:00:00');
    return Math.round((b - a) / 864e5) + 1;   // 1-й день = 1
  }

  /* ── питання ── */
  var YN = ['Так', 'Частково', 'Ні', 'Не пробував(ла)'];
  var TASKS = [
    ['t1', 'Увійти як Герой (або створити Героя в кабінеті батьків)'],
    ['t2', 'Пройти тест або тренажер у «Навчанні»'],
    ['t3', 'Провести бій на Арені'],
    ['t4', 'Вдягнути річ в Інвентарі'],
    ['t5', 'Прочитати книжку в Бібліотеці']
  ];
  var RATES = [
    ['r_design', 'Зовнішній вигляд, малюнки'],
    ['r_clear',  'Одразу зрозуміло, що робити'],
    ['r_nav',    'Легко знайти потрібне (меню, кнопки)'],
    ['r_speed',  'Швидкість завантаження'],
    ['r_texts',  'Зрозумілі тексти й завдання'],
    ['r_fun',    'Дитині цікаво, хочеться повертатися']
  ];
  /* розділи: [заголовок, підказка, поля]
     поле: {id, q, type: radio|text|area|scale|task, opts?} */
  var SECTIONS = [
    ['Про вас', 'Пристрій і браузер ми визначимо самі.', [
      {id:'role', q:'Хто заповнює анкету?', type:'radio', opts:['Дитина разом з дорослим','Батьки','Вчитель','Інше']},
      {id:'grade', q:'Клас дитини', type:'radio', opts:['Дошкілля','1','2','3','4','5+','Немає дитини']},
      {id:'exp', q:'Як часто дитина користується навчальними сайтами чи застосунками?', type:'radio', opts:['Щодня','Кілька разів на тиждень','Рідко','Вперше']}
    ]],
    ['Завдання', 'Спробуйте кожне завдання протягом тижня. Позначте, чи вдалося і наскільки було легко (1 — дуже важко, 5 — дуже легко).',
      TASKS.map(function(t){ return {id:t[0], q:t[1], type:'task'}; })
    ],
    ['Загальне враження', 'Оцініть від 1 (дуже погано) до 5 (чудово).',
      RATES.map(function(r){ return {id:r[0], q:r[1], type:'scale', max:5}; }).concat([
        {id:'words', q:'Опишіть сайт трьома словами', type:'text'},
        {id:'liked', q:'Що сподобалося найбільше?', type:'area'},
        {id:'confused', q:'Що найбільше заплутало або дратувало?', type:'area'},
        {id:'quit', q:'Чи був момент, коли хотілося закрити сайт? Коли саме?', type:'area'}
      ])
    ],
    ['Помилки', 'Конкретну помилку краще одразу надіслати кнопкою 🐞 угорі справа: вона сама додасть знімок екрана.', [
      {id:'bugs_freq', q:'Як часто траплялися помилки?', type:'radio', opts:['Жодного разу','Рідко','Часто','Сайтом важко користуватися']},
      {id:'bugs_text', q:'Помилки, які не встигли надіслати через 🐞 (що сталося, на якій сторінці)', type:'area'}
    ]],
    ['Побажання', '', [
      {id:'missing', q:'Чого не вистачило?', type:'area'},
      {id:'remove', q:'Що б ви прибрали або спростили?', type:'area'},
      {id:'nps', q:'Наскільки ймовірно, що ви порадите сайт друзям? (0 — точно ні, 10 — точно так)', type:'scale', min:0, max:10},
      {id:'stay', q:'Чи користуватиметеся сайтом після запуску?', type:'radio', opts:['Так','Можливо','Ні']},
      {id:'stay_why', q:'Чому?', type:'text'},
      {id:'next', q:'Готові до наступного раунду тестування?', type:'radio', opts:['Так','Ні']},
      {id:'contact', q:'Контакт для зв\'язку (email або телефон, необов\'язково)', type:'text'},
      {id:'other', q:'Будь-що інше', type:'area'}
    ]]
  ];

  /* список ключів, які рахуються як «відповіді» для прогресу */
  function countable(){
    var ids = [];
    SECTIONS.forEach(function(s){ s[2].forEach(function(f){
      if(f.id === 'contact' || f.id === 'other' || f.id === 'stay_why' || f.id === 'bugs_text') return;
      ids.push(f.type === 'task' ? f.id + '_ok' : f.id);
    }); });
    return ids;
  }
  function progress(){
    var ids = countable(), n = 0;
    ids.forEach(function(id){ if(S.ans[id] != null && S.ans[id] !== '') n++; });
    return [n, ids.length];
  }

  /* ── автоконтекст ── */
  function device(){
    var ua = navigator.userAgent;
    var os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS'
           : /Mac OS X/i.test(ua) ? (navigator.maxTouchPoints > 1 ? 'iPadOS' : 'macOS')
           : /Windows/i.test(ua) ? 'Windows' : /CrOS/i.test(ua) ? 'ChromeOS' : /Linux/i.test(ua) ? 'Linux' : 'Інша';
    var br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /YaBrowser/.test(ua) ? 'Yandex'
           : /Firefox\//.test(ua) ? 'Firefox' : /SamsungBrowser/.test(ua) ? 'Samsung'
           : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Інший';
    var w = Math.min(screen.width, screen.height);
    var type = (os === 'iPadOS' || /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)))
             ? 'Планшет' : (/Mobi|iPhone/i.test(ua) || w < 600) ? 'Телефон' : 'Комп\'ютер';
    return { type:type, os:os, browser:br };
  }
  function hero(){
    try{
      var p = JSON.parse(ls('sk_hero_profile') || 'null');
      if(p) return { name: p.name || '', login: p.login || '' };
    }catch(e){}
    return { name:'', login:'' };
  }

  /* рядок для таблиці: ключі = назви колонок (Apps Script сам додасть нові) */
  function row(){
    var d = device(), h = hero(), a = S.ans, r = {};
    var pages = Object.keys(S.pages).sort(function(x,y){ return S.pages[y]-S.pages[x]; });
    r['Тестувальник'] = S.tester;
    r['Надсилання №'] = S.sent + 1;
    r['Версія анкети'] = VERSION;
    r['Перший візит'] = S.first;
    r['Днів тестування'] = daysSinceFirst();
    r['Днів з візитами'] = S.days.length;
    r['Сторінок відкрито'] = pages.reduce(function(s,k){ return s + S.pages[k]; }, 0);
    r['Найчастіші сторінки'] = pages.slice(0,8).map(function(k){ return k + '×' + S.pages[k]; }).join(', ');
    r['Герой'] = h.name; r['Логін Героя'] = h.login;
    r['Пристрій'] = d.type; r['ОС'] = d.os; r['Браузер'] = d.browser;
    r['Екран'] = screen.width + '×' + screen.height;
    SECTIONS.forEach(function(s){ s[2].forEach(function(f){
      if(f.type === 'task'){
        r[f.q + ' — вдалося'] = a[f.id + '_ok'] || '';
        r[f.q + ' — легкість'] = a[f.id + '_ease'] || '';
        r[f.q + ' — коментар'] = a[f.id + '_note'] || '';
      } else {
        r[f.q] = a[f.id] == null ? '' : a[f.id];
      }
    }); });
    return r;
  }

  /* ── стилі ── */
  var css = ''
  + '.skb-btn{position:fixed;left:10px;bottom:calc(96px + env(safe-area-inset-bottom));z-index:50;'
  +   'display:flex;align-items:center;gap:6px;padding:9px 14px 9px 11px;border-radius:999px;cursor:pointer;'
  +   'font:900 .8rem Nunito,system-ui,sans-serif;color:#5a3d05;background:linear-gradient(180deg,#fdeeb6,#f4c842);'
  +   'border:2px solid #fff6d8;box-shadow:0 4px 14px rgba(0,0,0,.4)}'
  + 'body:not(:has(.botnav)) .skb-btn{bottom:calc(16px + env(safe-area-inset-bottom))}'
  + '.skb-btn .skb-pr{font-weight:800;opacity:.75}'
  + '.skb-btn.due{animation:skbPulse 1.6s ease-in-out infinite}'
  + '@keyframes skbPulse{0%,100%{box-shadow:0 4px 14px rgba(0,0,0,.4),0 0 0 0 rgba(244,200,66,.7)}50%{box-shadow:0 4px 14px rgba(0,0,0,.4),0 0 0 10px rgba(244,200,66,0)}}'
  + '@media (prefers-reduced-motion:reduce){.skb-btn.due{animation:none}}'
  + '.skb-back{position:fixed;inset:0;z-index:70;background:rgba(6,14,30,.66);display:flex;align-items:center;justify-content:center;padding:12px}'
  + '.skb-win{width:min(640px,100%);max-height:calc(100dvh - 24px);display:flex;flex-direction:column;border-radius:18px;overflow:hidden;'
  +   'background:#fbf4e2;color:#2b2112;font:15px/1.4 Nunito,system-ui,sans-serif;border:3px solid #e0a42a;box-shadow:0 18px 50px rgba(0,0,0,.55)}'
  + '.skb-hd{padding:14px 18px 12px;background:linear-gradient(180deg,#16305c,#0d1f3d);color:#fbefd0;border-bottom:3px solid #e0a42a}'
  + '.skb-hd h2{margin:0;font:800 1.25rem "Playfair Display",Georgia,serif}'
  + '.skb-hd p{margin:4px 0 0;font-size:.82rem;color:#e3cf9c}'
  + '.skb-bar{height:6px;margin-top:10px;border-radius:3px;background:rgba(255,255,255,.15);overflow:hidden}'
  + '.skb-bar i{display:block;height:100%;background:#f4c842;transition:width .25s}'
  + '.skb-x{position:absolute;right:12px;top:10px;width:34px;height:34px;border-radius:50%;border:0;cursor:pointer;background:rgba(255,255,255,.12);color:#fff;font-size:1.1rem}'
  + '.skb-body{overflow:auto;padding:6px 18px 18px;-webkit-overflow-scrolling:touch}'
  + '.skb-sec{margin-top:16px}'
  + '.skb-sec h3{margin:0 0 2px;font:800 1.02rem Nunito,sans-serif;color:#7a4d06}'
  + '.skb-sec .hint{margin:0 0 8px;font-size:.82rem;color:#6b5a3b}'
  + '.skb-f{padding:10px 12px;margin:8px 0;border-radius:12px;background:#fff;border:1px solid #ecdcb4}'
  + '.skb-f .q{font-weight:800;margin-bottom:7px}'
  + '.skb-ch{display:flex;flex-wrap:wrap;gap:6px}'
  + '.skb-ch label{position:relative}'
  + '.skb-ch input{position:absolute;opacity:0;pointer-events:none}'
  + '.skb-ch span{display:inline-block;min-width:34px;text-align:center;padding:6px 11px;border-radius:999px;cursor:pointer;'
  +   'background:#f4ecd6;border:1.5px solid #e2cf9f;font-weight:700;font-size:.88rem}'
  + '.skb-ch input:checked+span{background:#16305c;border-color:#16305c;color:#fbefd0}'
  + '.skb-ch input:focus-visible+span{outline:3px solid #e0a42a;outline-offset:1px}'
  + '.skb-sub{font-size:.8rem;color:#6b5a3b;margin:8px 0 4px}'
  + '.skb-f input[type=text],.skb-f textarea{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:9px;border:1.5px solid #e2cf9f;'
  +   'font:inherit;color:inherit;background:#fffdf7}'
  + '.skb-f textarea{min-height:64px;resize:vertical}'
  + '.skb-f input:focus,.skb-f textarea:focus{outline:none;border-color:#e0a42a}'
  + '.skb-ft{display:flex;align-items:center;gap:10px;padding:12px 18px;border-top:1px solid #ecdcb4;background:#f6ecd2}'
  + '.skb-ft .st{flex:1;font-size:.82rem;color:#6b5a3b}'
  + '.skb-send{padding:10px 18px;border-radius:12px;border:0;cursor:pointer;font:900 .95rem Nunito,sans-serif;color:#fff;background:#2f7a3a}'
  + '.skb-send:disabled{opacity:.6;cursor:default}'
  + '.skb-done{padding:30px 18px;text-align:center}'
  + '.skb-done b{display:block;font-size:2.4rem}';
  var st = document.createElement('style');
  st.id = 'sk-beta-css'; st.textContent = css;
  document.head.appendChild(st);

  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  /* ── кнопка ── */
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'skb-btn';
  btn.setAttribute('data-html2canvas-ignore', 'true');
  function paintBtn(){
    var p = progress();
    var due = daysSinceFirst() >= TEST_DAYS && !S.sent;
    btn.classList.toggle('due', due);
    btn.innerHTML = '📝 ' + (due ? 'Час надіслати анкету!' : 'Анкета')
      + (S.sent ? ' <span class="skb-pr">✓</span>' : ' <span class="skb-pr">' + p[0] + '/' + p[1] + '</span>');
    btn.title = 'Анкета бета-тестування · день ' + Math.min(daysSinceFirst(), TEST_DAYS) + ' з ' + TEST_DAYS;
  }
  btn.addEventListener('click', open);
  function mountBtn(){ document.body.appendChild(btn); paintBtn(); }
  if(document.body) mountBtn(); else document.addEventListener('DOMContentLoaded', mountBtn);

  /* ── вікно ── */
  var back = null;

  function fieldHTML(f){
    var a = S.ans, h = '<div class="skb-f"><div class="q">' + esc(f.q) + '</div>';
    function chips(name, opts, cur){
      return '<div class="skb-ch" role="radiogroup">' + opts.map(function(o){
        return '<label><input type="radio" name="' + name + '" value="' + esc(o) + '"'
          + (String(cur) === String(o) ? ' checked' : '') + '><span>' + esc(o) + '</span></label>';
      }).join('') + '</div>';
    }
    function range(lo, hi){ var r = []; for(var i = lo; i <= hi; i++) r.push(String(i)); return r; }
    if(f.type === 'radio') h += chips(f.id, f.opts, a[f.id]);
    else if(f.type === 'scale') h += chips(f.id, range(f.min || 1, f.max), a[f.id]);
    else if(f.type === 'text') h += '<input type="text" name="' + f.id + '" value="' + esc(a[f.id]) + '">';
    else if(f.type === 'area') h += '<textarea name="' + f.id + '">' + esc(a[f.id]) + '</textarea>';
    else if(f.type === 'task'){
      h += chips(f.id + '_ok', YN, a[f.id + '_ok'])
        + '<div class="skb-sub">Наскільки легко (1–5)</div>' + chips(f.id + '_ease', range(1,5), a[f.id + '_ease'])
        + '<div class="skb-sub">Коментар: що заважало?</div><input type="text" name="' + f.id + '_note" value="' + esc(a[f.id + '_note']) + '">';
    }
    return h + '</div>';
  }

  function paintBar(){
    if(!back) return;
    var p = progress();
    back.querySelector('.skb-bar i').style.width = Math.round(p[0] / p[1] * 100) + '%';
    back.querySelector('.st').textContent = 'Відповіді: ' + p[0] + ' з ' + p[1] + ' · зберігаються автоматично';
  }

  function open(){
    if(back) return;
    var day = Math.min(daysSinceFirst(), TEST_DAYS);
    back = document.createElement('div');
    back.className = 'skb-back';
    back.setAttribute('data-html2canvas-ignore', 'true');
    back.innerHTML =
        '<div class="skb-win" role="dialog" aria-modal="true" aria-labelledby="skbTitle">'
      +   '<div class="skb-hd" style="position:relative">'
      +     '<h2 id="skbTitle">Анкета бета-тестувальника</h2>'
      +     '<p>День ' + day + ' з ' + TEST_DAYS + '. Заповнюйте поступово: відповіді зберігаються самі. '
      +       'Надішліть анкету наприкінці тижня. Чесний відгук корисніший за похвалу!</p>'
      +     '<div class="skb-bar"><i></i></div>'
      +     '<button type="button" class="skb-x" aria-label="Закрити">✕</button>'
      +   '</div>'
      +   '<form class="skb-body" novalidate>'
      +     SECTIONS.map(function(s, i){
              return '<div class="skb-sec"><h3>' + (i+1) + '. ' + esc(s[0]) + '</h3>'
                + (s[1] ? '<p class="hint">' + esc(s[1]) + '</p>' : '')
                + s[2].map(fieldHTML).join('') + '</div>';
            }).join('')
      +   '</form>'
      +   '<div class="skb-ft"><span class="st"></span>'
      +     '<button type="button" class="skb-send">' + (S.sent ? 'Надіслати ще раз' : 'Надіслати') + '</button></div>'
      + '</div>';
    document.body.appendChild(back);
    var form = back.querySelector('form');
    function onChange(e){
      var t = e.target; if(!t.name) return;
      S.ans[t.name] = t.value; save(); paintBar(); paintBtn();
    }
    form.addEventListener('input', onChange);
    form.addEventListener('change', onChange);
    back.querySelector('.skb-x').addEventListener('click', close);
    back.addEventListener('click', function(e){ if(e.target === back) close(); });
    document.addEventListener('keydown', onKey);
    back.querySelector('.skb-send').addEventListener('click', send);
    paintBar();
    document.documentElement.style.overflow = 'hidden';
  }
  function onKey(e){ if(e.key === 'Escape') close(); }
  function close(){
    if(!back) return;
    back.remove(); back = null;
    document.removeEventListener('keydown', onKey);
    document.documentElement.style.overflow = '';
  }

  /* ── відправка ── */
  function send(){
    var b = back.querySelector('.skb-send'), stEl = back.querySelector('.st');
    var p = progress();
    if(p[0] < Math.ceil(p[1] / 2) &&
       !confirmInline(stEl, b, 'Заповнено ' + p[0] + ' з ' + p[1] + '. Надіслати так? Натисніть ще раз.')) return;
    if(!SHEET_URL){ stEl.textContent = 'Адресу таблиці ще не задано (SHEET_URL у sk-beta.js).'; return; }
    b.disabled = true; b.textContent = 'Надсилаю…';
    var body = JSON.stringify(row());
    var opts = { method:'POST', headers:{ 'Content-Type':'text/plain;charset=utf-8' }, body: body };
    fetch(SHEET_URL, opts)
      .then(function(r){ return r.json(); })
      .then(function(j){
        if(!j || !j.ok){ var e = new Error((j && j.error) || 'bad'); e.server = true; throw e; }
      })
      .catch(function(err){
        if(err && err.server) throw err;      // таблиця відповіла відмовою
        // відповідь Google не прочиталась (CORS) — шлемо «наосліп»: рядок однаково додасться
        return fetch(SHEET_URL, { method:'POST', mode:'no-cors', headers: opts.headers, body: body });
      })
      .then(function(){
        S.sent++; S.sentAt = new Date().toISOString(); save(); paintBtn();
        back.querySelector('.skb-body').innerHTML =
          '<div class="skb-done"><b>🏆</b><h3>Дякуємо, анкету надіслано!</h3>'
          + '<p>Ви допомогли зробити SchoolKingdoms кращим. Відповіді лишаються тут: '
          + 'якщо згадаєте ще щось, змініть їх і надішліть ще раз.</p></div>';
        b.textContent = 'Закрити'; b.disabled = false;
        b.onclick = close; b.removeEventListener('click', send);
        stEl.textContent = 'Надіслано · тестувальник ' + S.tester;
      })
      .catch(function(){
        b.disabled = false; b.textContent = 'Спробувати ще раз';
        stEl.textContent = 'Не вдалося надіслати. Перевірте інтернет і спробуйте ще раз — відповіді збережені.';
      });
  }
  var armed = false;
  function confirmInline(stEl, b, msg){
    if(armed){ armed = false; return true; }
    armed = true; stEl.textContent = msg; b.textContent = 'Так, надіслати';
    return false;
  }
})();

/* ============================================================
   School Kingdoms — СПІЛЬНИЙ НИЖНІЙ ФУТЕР (botnav)
   Єдине джерело правди для золотої орнаментальної панелі внизу.
   Ідентичний футеру hero.html (ромби-роздільники ◈, ВЕЛИКІ підписи).

   Підключення (наприкінці <body>, там де раніше стояв <nav class="botnav">):
     <script src="sk-footer.js?v=1" data-active="tests"></script>

   Атрибути на теґу <script>:
     data-active = home | tests | biblioteka | arena | none
                   (яка вкладка підсвічена; за замовч. none)
     data-last   = back | logout
                   (остання кнопка; за замовч. back → «Назад», logout → «Вийти»)
     data-back   = <url> | self
                   Кнопка «Назад» ЗАВЖДИ повертає на попередню сторінку (history.back()).
                   data-back задає ЗАПАСНИЙ маршрут, коли історії немає (пряме відкриття):
                     • не задано → hero.html
                     • <url>     → base + url   (напр. "tests.html" для мінігор/тренажерів)
                     • self      → сторінка сама вішає обробник на #heroBackBtn
                                   (напр. arena: бій → таверна, інакше → igry.html)
                   Кнопка завжди має id="heroBackBtn", тож старі обробники працюють.
     data-base   = ""  (префікс шляхів для підпапок, напр. "../"; за замовч. "")

   Маршрути «Назад» (fallback) у грі:
     • tests / biblioteka / igry  → hero.html   (data-back не задаємо)
     • мінігри / тренажери        → tests.html  (data-back="tests.html")
     • arena                      → self        (власний контекстний обробник)

   ⚠ Кеш-бастинг: піднімай ?v=N у КОЖНОМУ підключенні при зміні цього файлу.
   ============================================================ */
(function(){
  'use strict';
  var me = document.currentScript;
  var d  = (me && me.dataset) || {};
  var base   = d.base || '';
  var active = (d.active || 'none').toLowerCase();
  var last   = (d.last   || 'back').toLowerCase();

  /* ── CSS (один раз на сторінку) ────────────────────────────── */
  if(!document.getElementById('sk-footer-css')){
    var st = document.createElement('style');
    st.id = 'sk-footer-css';
    st.textContent = `
body{padding-bottom:calc(82px + env(safe-area-inset-bottom))}
.botnav{position:fixed;left:0;right:0;bottom:0;z-index:40;
  display:flex;align-items:stretch;gap:0;padding:12px 8px calc(9px + env(safe-area-inset-bottom));
  background:linear-gradient(180deg,#16305c,#0d1f3d);border-top:4px solid #e0a42a;
  box-shadow:inset 0 3px 0 rgba(255,240,190,.35),inset 0 -1px 0 rgba(244,200,66,.30),0 -6px 18px rgba(0,0,0,.45);
  overflow-x:auto;scrollbar-width:none}
.botnav::-webkit-scrollbar{display:none}
.botnav a,.botnav button{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
  flex:1;min-width:56px;padding:6px 10px 4px;border-radius:12px;background:none;border:none;cursor:pointer;
  font-family:inherit;white-space:nowrap;text-decoration:none;
  color:#efd9a0;font-weight:900;font-size:.6rem;text-transform:uppercase;letter-spacing:.05em;transition:.15s}
.botnav .ic{font-size:1.4rem;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5))}
.botnav > *:not(:last-child)::after{content:"\\25C8";position:absolute;right:-3px;top:50%;transform:translateY(-50%);
  color:#e0a42a;font-size:.72rem;opacity:.85;text-shadow:0 1px 2px rgba(0,0,0,.55);pointer-events:none}
.botnav a.active{background:linear-gradient(180deg,#fdeeb6,#f4c842);color:#5a3d05;border:2px solid #fff6d8;
  box-shadow:0 3px 10px rgba(0,0,0,.35),0 0 16px -3px rgba(244,200,66,.8),inset 0 1px 0 rgba(255,255,255,.6);
  transform:translateY(-2px)}
.botnav a.active .ic{filter:none}
.botnav a:hover:not(.active),.botnav button:hover{background:rgba(255,255,255,.08);color:#fff}`;
    document.head.appendChild(st);
  }

  /* ── розмітка ──────────────────────────────────────────────── */
  function tab(key, href, icon, label){
    var cls = (active === key) ? ' class="active"' : '';
    return '<a'+cls+' href="'+base+href+'"><span class="ic">'+icon+'</span>'+label+'</a>';
  }
  var lastBtn = (last === 'logout')
    ? '<button id="heroLogoutBtn"><span class="ic">\uD83D\uDEAA</span>Вийти</button>'
    : '<button id="heroBackBtn"><span class="ic">\u2B05\uFE0F</span>Назад</button>';

  var nav = document.createElement('nav');
  nav.className = 'botnav';
  nav.innerHTML =
      tab('home',       'hero.html',       '\uD83C\uDFE0', 'Головна') +
      tab('tests',      'tests.html',      '\uD83D\uDCDC', 'Тести') +
      tab('biblioteka', 'biblioteka.html', '\uD83D\uDCDA', 'Бібліотека') +
      tab('arena',      'arena.html',      '\u2694\uFE0F', 'Арена') +
      lastBtn;

  /* вставляємо на місці теґу <script>, щоб id-и були доступні наступним скриптам */
  if(me && me.parentNode){ me.parentNode.insertBefore(nav, me.nextSibling); }
  else { document.body.appendChild(nav); }

  /* ── «Назад» = попередня сторінка (history.back), інакше fallback ── */
  if(last !== 'logout'){
    var fb  = (d.back || '').trim();
    var btn = nav.querySelector('#heroBackBtn');
    if(btn && fb !== 'self'){
      var fallback = fb || 'hero.html';
      btn.addEventListener('click', function(){
        if(history.length > 1){ history.back(); }
        else { location.href = base + fallback; }
      });
    }
    /* fb === 'self' → нічого не вішаємо: сторінка має власний обробник */
  }
  /* last === 'logout' → кнопку Вийти вішає сама сторінка hero (doLogout) */
})();

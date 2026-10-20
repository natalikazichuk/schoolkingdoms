/* ============================================================
   nav-intro.js — опис пункту з карти «Звичайно …» / «🔄 Навиворіт …»
   на стартовому екрані гри Світу навиворіт. Картки не лежать на
   екрані відкрито (це готова підказка) — вони сховані в питання
   під загадкою: торкнешся «Що тут навиворіт? 🔎» — відкриється віконце.
   Якщо в гри вже є своє питання з цим описом (#hintsLink, напр.
   «Як спіймати яблуко? 🔎»), нічого не додаємо — опис покаже воно.

   Описи зберігає карта (index.html) у localStorage sk_nav_intro
   {файл.html: {a, b}}. Якщо гру відкрили, не заходячи на карту, —
   опису просто немає, а стартовий екран лишається як був.
   Підключення: <script src="nav-intro.js"></script> наприкінці <body>.
   ============================================================ */
(function(){
  'use strict';
  function run(){
    var file = location.pathname.split('/').pop() || 'index.html';
    var all = null;
    try { all = JSON.parse(localStorage.getItem('sk_nav_intro') || 'null'); } catch(e){}
    var p = all && all[file];
    var start = document.getElementById('startScreen'), play = document.getElementById('playBtn');
    if(!p || !start || !play || document.getElementById('navIntroQ') || document.getElementById('hintsLink')) return;
    if(!document.getElementById('navIntroCss')){
      var st = document.createElement('style'); st.id = 'navIntroCss';
      st.textContent =
        '#navIntroQ{all:unset;cursor:pointer;display:inline-block;margin-top:6px;font-weight:800;color:#24418f;border-bottom:2px dashed #7aa2ff;line-height:1.5;}' +
        '#navIntroQ:active{opacity:.7;}' +
        '#navIntroOv{position:fixed;inset:0;z-index:90;background:rgba(44,43,58,.5);display:flex;align-items:center;justify-content:center;padding:16px;}' +
        '#navIntroOv.hidden{display:none;}' +
        '#navIntroOv .card{width:min(420px,100%);background:#fff9ef;border:3px solid #f4c842;border-radius:22px;padding:16px;display:flex;flex-direction:column;gap:10px;box-shadow:0 10px 30px rgba(0,0,0,.3);}' +
        '#navIntroOv .t{font-family:Fredoka,sans-serif;font-weight:700;font-size:20px;text-align:center;color:#2c2b3a;}' +
        '#navIntroOv .pair{display:grid;grid-template-columns:1fr 1fr;gap:8px;}' +
        '#navIntroOv .pair div{border-radius:14px;padding:8px 10px;font-weight:800;font-size:14px;line-height:1.3;text-align:left;}' +
        '#navIntroOv .a{background:#fff;border:2px solid #ece3d2;color:#2c2b3a;}' +
        '#navIntroOv .b{background:#f8f0ff;border:2px solid #d9c2fb;color:#8e3fb0;}' +
        '#navIntroOv small{display:block;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#6b6a7d;margin-bottom:2px;}' +
        '#navIntroOv button{border:none;cursor:pointer;border-radius:16px;padding:12px;font-family:Fredoka,sans-serif;font-weight:700;font-size:18px;color:#fff;background:#51cf66;box-shadow:0 5px 0 #37a052;}';
      document.head.appendChild(st);
    }
    var ov = document.createElement('div'); ov.id = 'navIntroOv'; ov.className = 'hidden';
    ov.innerHTML = '<div class="card"><div class="t">Що тут навиворіт?</div><div class="pair"><div class="a"><small>Звичайно</small></div><div class="b"><small>🔄 Навиворіт</small></div></div>' +
      '<button type="button">Зрозуміло 👍</button></div>';
    var pair = ov.querySelector('.pair');
    pair.children[0].appendChild(document.createTextNode(p.a));
    pair.children[1].appendChild(document.createTextNode(p.b));
    function close(){ ov.classList.add('hidden'); }
    ov.querySelector('button').addEventListener('click', close);
    ov.addEventListener('click', function(e){ if(e.target === ov) close(); });
    document.body.appendChild(ov);
    /* питання — у кінці загадки; якщо загадки немає — над кнопкою «Грати» */
    var q = document.createElement('button'); q.type = 'button'; q.id = 'navIntroQ';
    q.innerHTML = 'Що тут навиворіт? <span style="white-space:nowrap">🔎</span>';
    q.addEventListener('click', function(){ ov.classList.remove('hidden'); });
    var rd = start.querySelector('.riddle');
    if(rd){ rd.appendChild(document.createElement('br')); rd.appendChild(q); }
    else play.parentNode.insertBefore(q, play);
    if(window.NAV && NAV.fitStartBg) NAV.fitStartBg();
    if(window.NAVSCROLL) NAVSCROLL.fit();   // картинка на весь екран — перерахувати місце
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();

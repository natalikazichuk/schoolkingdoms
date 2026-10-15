/* ============================================================
   nav-intro.js — на стартовому екрані гри Світу навиворіт показує
   опис пункту з карти: «Звичайно …» / «🔄 Навиворіт …» (дві картки
   над кнопкою «Грати»). Раніше це було у проміжному вікні на карті;
   тепер карта веде одразу в гру.

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
    if(!p || !start || !play || document.getElementById('navIntro')) return;
    if(!document.getElementById('navIntroCss')){
      var st = document.createElement('style'); st.id = 'navIntroCss';
      st.textContent =
        '#navIntro{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%;max-width:420px;position:relative;}' +
        '#navIntro div{border-radius:14px;padding:7px 10px;font-weight:800;font-size:13px;line-height:1.3;text-align:left;}' +
        '#navIntro .a{background:#fff;border:2px solid #ece3d2;color:#2c2b3a;}' +
        '#navIntro .b{background:#f8f0ff;border:2px solid #d9c2fb;color:#8e3fb0;}' +
        '#navIntro small{display:block;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#6b6a7d;margin-bottom:2px;}';
      document.head.appendChild(st);
    }
    var box = document.createElement('div'); box.id = 'navIntro';
    box.innerHTML = '<div class="a"><small>Звичайно</small></div><div class="b"><small>🔄 Навиворіт</small></div>';
    box.children[0].appendChild(document.createTextNode(p.a));
    box.children[1].appendChild(document.createTextNode(p.b));
    play.parentNode.insertBefore(box, play);
    if(window.NAV && NAV.fitStartBg) NAV.fitStartBg();   // картинка на весь екран — перерахувати місце
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();

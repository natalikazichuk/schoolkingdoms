/* ============================================================
   nav-guard.js — «не вгадуй» для окремих ігор Світу навиворіт
   (тих, що не на nav-common.js: Будинок, Чотири двері, Автобус,
   Магазин, Вежа, Дерево).

   • NAVGuard.cool(el | [el, …]) — після помилки на COOL мс
     «присипляє» кнопки в цих блоках: вони бліднуть, зверху першого
     біжить смужка-таймер, а натискання в них ігноруються (перехоплюємо
     click ще до обробників гри). Дитина встигає прочитати підказку.
   • NAVGuard.after(fn) — виконати fn, коли пауза мине (нове завдання
     після 2 помилок).
   • NAVGuard.note(hintEl, текст) — дописати «🔄 Нове завдання…» перед
     поточною підказкою.
   Підключення: <script src="nav-guard.js"></script> перед кодом гри.
   ============================================================ */
(function(){
  'use strict';
  if(window.NAVGuard) return;
  var COOL = 2500, until = 0;

  var st = document.createElement('style');
  st.textContent =
    '.nav-cool{position:relative;}' +
    '.nav-cool button,.nav-cool .zone,.nav-cool .door{opacity:.55;filter:saturate(.6);transition:opacity .2s;}' +
    '.nav-cool.nav-bar:before{content:"";position:absolute;left:0;right:0;top:-6px;height:4px;border-radius:4px;z-index:5;' +
      'background:#ff6b6b;transform-origin:0 50%;animation:navguard var(--cool,2500ms) linear forwards;}' +
    '@keyframes navguard{from{transform:scaleX(1)}to{transform:scaleX(0)}}';
  (document.head || document.documentElement).appendChild(st);

  /* поки пауза — кліки всередині «приспаних» блоків не доходять до гри */
  document.addEventListener('click', function(e){
    if(Date.now() < until && e.target && e.target.closest && e.target.closest('.nav-cool')){
      e.stopImmediatePropagation(); e.preventDefault();
    }
  }, true);

  window.NAVGuard = {
    COOL: COOL,
    cooling: function(){ return Date.now() < until; },
    cool: function(els, ms){
      ms = ms || COOL; until = Date.now() + ms;
      [].concat(els || []).forEach(function(el, i){
        if(!el) return;
        el.style.setProperty('--cool', ms + 'ms');
        el.classList.remove('nav-cool', 'nav-bar'); void el.offsetWidth;
        el.classList.add('nav-cool'); if(i === 0) el.classList.add('nav-bar');
        clearTimeout(el._navCoolT);
        el._navCoolT = setTimeout(function(){ el.classList.remove('nav-cool', 'nav-bar'); }, ms);
      });
    },
    after: function(fn){ setTimeout(fn, COOL); },
    note: function(hintEl, t){
      if(!hintEl) return;
      var was = /\bbad\b/.test(hintEl.className) ? '' : hintEl.innerHTML;
      hintEl.className = '';
      hintEl.innerHTML = '<b>' + t + '</b>' + (was ? '<br>' + was : '');
    }
  };
})();

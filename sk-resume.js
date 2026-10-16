/* ============================================================
   sk-resume.js — «Продовжити, де зупинився».

   Кожна сторінка з футером (ігри, тести, тренажери, ігротека) запам'ятовує
   себе як «останнє місце» (localStorage sk_last_place: адреса + час).
   Час оновлюється щохвилини, поки сторінка відкрита, і коли її ховають.

   Коли застосунок відкривають знову (перша сторінка нової сесії —
   index.html після входу або hero.html), Герой одразу потрапляє на це
   останнє місце. Якщо з останньої активності минуло понад 2 години —
   місце забуваємо й відкриваємо як звичайно.

   Підключення:
     • sk-footer.js сам викликає SKResume.track() (сторінки-кабінети,
       адмінка й вхід — не запам'ятовуються, див. SKIP);
     • index.html / hero.html: <script src="sk-resume.js?v=1"></script>,
       а тоді SKResume.go() — перехід, якщо є куди (true), інакше false.
   ============================================================ */
(function(){
  'use strict';
  if(window.SKResume) return;
  var KEY = 'sk_last_place', SEEN = 'sk_session_seen', TTL = 2 * 60 * 60 * 1000;
  /* кабінети, вхід, адмінка — не «місце», куди повертати */
  var SKIP = /\/(index|hero|parent|login|auth|admin[^/]*)\.html$|\/$/i;

  function now(){ return Date.now(); }
  function here(){ return location.href.split('#')[0]; }
  function read(){ try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch(e){ return null; } }
  function forget(){ try { localStorage.removeItem(KEY); } catch(e){} }
  function save(){
    try { localStorage.setItem(KEY, JSON.stringify({ u: here(), t: now() })); } catch(e){}
  }
  /* перша сторінка в цій сесії вкладки/застосунку? (і відразу позначаємо, що сесія почалась) */
  function firstInSession(){
    try {
      var first = !sessionStorage.getItem(SEEN);
      sessionStorage.setItem(SEEN, '1');
      return first;
    } catch(e){ return false; }
  }
  function target(){
    var p = read();
    if(!p || !p.u || !p.t) return null;
    if(now() - p.t > TTL){ forget(); return null; }          // понад 2 години — починаємо спочатку
    try { if(new URL(p.u).origin !== location.origin) return null; } catch(e){ return null; }
    if(p.u === here()) return null;
    return p.u;
  }

  window.SKResume = {
    TTL: TTL,
    /* запам'ятати поточну сторінку як «останнє місце» */
    track: function(){
      firstInSession();                                         // сесія почалась не з кабінету — далі не перекидаємо
      if(SKIP.test(location.pathname)) return;
      save();
      setInterval(function(){ if(!document.hidden) save(); }, 60 * 1000);
      document.addEventListener('visibilitychange', function(){ if(document.hidden) save(); });
      window.addEventListener('pagehide', save);
    },
    target: target,
    /* на першій сторінці сесії: перейти на останнє місце, якщо воно свіже */
    go: function(){
      if(!firstInSession()) return false;
      var t = target();
      if(!t) return false;
      location.replace(t);
      return true;
    }
  };
})();

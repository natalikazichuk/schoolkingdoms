/* ============================================================
   sk-finish.js — завершення для HTML-тренажерів / тестів-посилань.

   Підключається на сторінках тренажерів (звичайним <script>, або
   авто-через sk-footer.js). Активується ЛИШЕ коли сторінку відкрито
   як запис із адмінки — тобто в адресі є ?skdone=...:

       ?skdone=t:<testId>      → зарахувати ЗАПИС (sk_testpass_<id>)
       &skback=<url>           → куди повернутись (типово tests.html)

   Раніше була ще гілка x:<slug> для «випробувань» з окремого сховища
   curriculum/trainers. Сховища більше немає: HTML-сторінка — це той самий
   документ у tests, тож ключ завжди sk_testpass_<id>.

   Дає:
     • window.skFinishRecord() — зарахувати запис. Кличе сам тренажер, коли
       дитина дійшла до кінця (канонічний openWin).

   Кнопки «✅ Я завершив(ла)» в куті екрана більше немає: вона висіла поверх
   гри, і випадковий дотик закривав завдання. Завдання зараховується тоді,
   коли справді пройдене.

   Без ?skdone skFinishRecord — порожня (no-op), сторінка працює як завжди.

   Незалежно від ?skdone, на КОЖНІЙ сторінці з цим скриптом дає:
     • window.skBackUrl(fallback) / window.skGoBack(fallback) — куди веде
       «стрілочка» вгорі: ?skback=, інакше fallback, і завжди від кореня сайту
       (з підпапки 'tests.html' вело б на doshkilya/tests.html → 404);
     • «жучок» 🐞 — підвантажує sk-report.js.
   ============================================================ */
(function(){
  'use strict';
  if(window.__skFinishMounted) return;
  window.__skFinishMounted = true;

  function param(n){ try{ return new URLSearchParams(location.search).get(n); }catch(e){ return null; } }

  /* skback — шлях від КОРЕНЯ сайту ('tests.html'), а сторінки-тренажери
     лежать у підпапках (doshkilya/, klas-1/, games/). location.href='tests.html'
     звідти вело б на doshkilya/tests.html, якої не існує: дитина потрапляла
     на 404. Тому рахуємо від теки власного <script src>. */
  var SELF = (document.currentScript && document.currentScript.src) || '';
  var BASE = SELF ? SELF.replace(/[?#].*$/, '').replace(/[^/]*$/, '') : '';
  function backUrl(u){
    u = String(u || '').trim();
    if(!u) u = 'tests.html';
    if(/^[a-z][a-z0-9+.-]*:/i.test(u) || u.charAt(0) === '/') return u;   // абсолютний
    return BASE + u;
  }

  /* Спільні хелпери для «стрілочки» вгорі тренажера. Куди повертатись, точніше
     за все каже ?skback= (звідки дитина прийшла — «Тести» чи «Навчання»),
     інакше — запасний шлях від сторінки. Доступні на КОЖНІЙ сторінці з
     sk-finish.js, навіть коли ?skdone немає. */
  window.skBackUrl = function(fallback){ return backUrl(param('skback') || fallback); };
  window.skGoBack  = function(fallback){ location.href = window.skBackUrl(fallback); };

  /* «жучок» 🐞 «Повідомити про помилку» — на кожній сторінці з цим скриптом.
     Багато тренажерів не мають ані футера, ані шапки, тож раніше дитині не було
     чим поскаржитись. Дублів не буде: спільний id збігається з тим, який
     використовують sk-header.js і sk-footer.js. */
  if(!window.__skReportMounted && !document.getElementById('sk-report-loader')){
    var rep = document.createElement('script');
    rep.id = 'sk-report-loader';
    rep.src = BASE + 'sk-report.js?v=2';
    rep.defer = true;
    (document.body || document.head || document.documentElement).appendChild(rep);
  }

  var raw = param('skdone');
  if(!raw){ window.skFinishRecord = function(){}; return; }

  var key = raw, ci = raw.indexOf(':');
  if(ci > 0){ key = raw.slice(ci + 1); }
  var storeKey = 'sk_testpass_' + key;

  var recorded = false;

  function syncSoon(){
    // firebase-config.js — ES-модуль, SK зʼявляється пізніше; чекаємо й пушимо
    var t = 0;
    (function w(){
      try{ if(window.SK && SK.pushLocal){ SK.pushLocal(); return; } }catch(e){}
      if(t++ < 120) setTimeout(w, 50);
    })();
  }
  function record(){
    if(recorded) return;
    recorded = true;
    try{ localStorage.setItem(storeKey, '1'); }catch(e){}
    syncSoon();
  }
  window.skFinishRecord = record;

})();

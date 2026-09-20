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
     • кнопку «✅» (з перепитуванням) у куті — для всіх сторінок;
     • window.skFinishRecord()  — лише записати (для канонічних openWin);
     • window.skFinish()        — записати + показати «Молодець!» + повернутись.

   Без ?skdone обидві функції — порожні (no-op), сторінка працює як завжди.

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
  if(!raw){ window.skFinish = function(){}; window.skFinishRecord = function(){}; return; }

  var back = backUrl(param('skback'));
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

  function showMsg(){
    if(document.getElementById('skFinishOverlay')) return;
    var ov = document.createElement('div');
    ov.id = 'skFinishOverlay';
    ov.setAttribute('style',
      'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;'
      + 'background:rgba(8,18,38,.62);padding:16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif');
    var card = document.createElement('div');
    card.setAttribute('style',
      'background:linear-gradient(165deg,#1e3a6b,#16294f);border:3px solid #e0a42a;border-radius:22px;'
      + 'padding:26px 22px;max-width:320px;width:100%;text-align:center;color:#fff;'
      + 'box-shadow:0 22px 55px rgba(0,0,0,.55)');
    card.innerHTML =
        '<div style="font-size:54px;line-height:1;margin-bottom:8px">🎉</div>'
      + '<div style="font-family:Georgia,\'Times New Roman\',serif;font-weight:800;font-size:23px;color:#ffe08a;margin-bottom:6px">Молодець!</div>'
      + '<div style="font-size:15px;opacity:.95;margin-bottom:18px">Завдання завершено ✔</div>'
      + '<button id="skFinishBack" style="border:0;border-radius:14px;padding:12px 24px;font-weight:800;'
      + 'font-size:15px;cursor:pointer;background:linear-gradient(180deg,#fdeeb6,#f4c842);color:#5a3d05">Повернутись</button>';
    ov.appendChild(card);
    document.body.appendChild(ov);
    var go = function(){ location.href = back; };
    card.querySelector('#skFinishBack').addEventListener('click', go);
    setTimeout(go, 4500); // авто-повернення, якщо дитина не натисне
  }

  // повний фініш: запис + повідомлення + повернення.
  // Якщо вже записано раніше (канонічний openWin викликав record()) — просто повертаємось,
  // щоб не показувати друге вікно поверх власного «Вітаємо» тренажера.
  window.skFinish = function(){
    var was = recorded;
    record();
    var b = document.getElementById('skFinishBtn'); if(b) b.style.display = 'none';
    if(was) location.href = back;
    else showMsg();
  };

  /* Перепитуємо перед завершенням: кнопка живе поверх тренажера, і випадковий
     дотик раніше миттєво закривав завдання разом з усім прогресом. «Ще граю» —
     головна кнопка, щоб промах повертав до гри, а не з неї. */
  function askFinish(){
    if(document.getElementById('skFinishConfirm')) return;
    var ov = document.createElement('div');
    ov.id = 'skFinishConfirm';
    ov.setAttribute('style',
      'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;'
      + 'background:rgba(8,18,38,.62);padding:16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif');
    var card = document.createElement('div');
    card.setAttribute('style',
      'background:linear-gradient(165deg,#1e3a6b,#16294f);border:3px solid #e0a42a;border-radius:22px;'
      + 'padding:24px 20px;max-width:320px;width:100%;text-align:center;color:#fff;'
      + 'box-shadow:0 22px 55px rgba(0,0,0,.55)');
    card.innerHTML =
        '<div style="font-size:44px;line-height:1;margin-bottom:8px">🏁</div>'
      + '<div style="font-family:Georgia,\'Times New Roman\',serif;font-weight:800;font-size:21px;color:#ffe08a;margin-bottom:6px">Завершити завдання?</div>'
      + '<div style="font-size:14px;opacity:.9;margin-bottom:18px">Прогрес зарахується, і ти повернешся назад.</div>'
      + '<div style="display:flex;flex-direction:column;gap:9px">'
      +   '<button id="skFinishNo" style="border:0;border-radius:14px;padding:12px 24px;font-weight:800;'
      +     'font-size:15px;cursor:pointer;background:linear-gradient(180deg,#fdeeb6,#f4c842);color:#5a3d05">▶️ Ще граю</button>'
      +   '<button id="skFinishYes" style="border:2px solid rgba(255,255,255,.35);border-radius:14px;'
      +     'padding:10px 24px;font-weight:800;font-size:14px;cursor:pointer;background:transparent;'
      +     'color:#dbe6fb">✅ Так, завершити</button>'
      + '</div>';
    ov.appendChild(card);
    document.body.appendChild(ov);
    var close = function(){ if(ov.parentNode) ov.parentNode.removeChild(ov); };
    card.querySelector('#skFinishNo').addEventListener('click', close);
    card.querySelector('#skFinishYes').addEventListener('click', function(){
      close();
      window.skFinish();
    });
    ov.addEventListener('click', function(e){ if(e.target === ov) close(); });
  }

  function mountBtn(){
    if(window.__skHasOwnFinish) return;   // сторінка має власну кнопку/гейт (напр. sk-tr-reward.js)
    if(document.getElementById('skFinishBtn')) return;
    var b = document.createElement('button');
    b.id = 'skFinishBtn';
    b.type = 'button';
    b.textContent = '✅';
    b.title = 'Я завершив(ла)';
    b.setAttribute('aria-label', 'Я завершив(ла)');
    /* Кружечок під «жучком» 🐞, а не широка кнопка внизу: на вузьких екранах
       (384px) вона перекривала ігрові кнопки — «Прослухати», відповіді. Що вона
       означає, пояснює вікно з перепитуванням. */
    b.setAttribute('style',
      'position:fixed;right:10px;'
      + 'top:calc(112px + env(safe-area-inset-top));z-index:2147482000;'
      + 'width:40px;height:40px;padding:0;border-radius:50%;border:2px solid #fff6d8;'
      + 'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:19px;line-height:1;'
      + 'display:flex;align-items:center;justify-content:center;'
      + 'cursor:pointer;color:#0c2a12;background:linear-gradient(180deg,#8be08b,#39b539);'
      + 'box-shadow:0 6px 16px rgba(0,0,0,.35);opacity:.78;transition:opacity .15s,transform .15s');
    b.addEventListener('mouseenter', function(){ b.style.opacity = '1'; });
    b.addEventListener('mouseleave', function(){ b.style.opacity = '.78'; });
    b.addEventListener('click', askFinish);
    document.body.appendChild(b);
  }

  if(document.readyState !== 'loading') mountBtn();
  else document.addEventListener('DOMContentLoaded', mountBtn);
})();

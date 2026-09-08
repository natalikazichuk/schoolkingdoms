/* ============================================================
   sk-finish.js — завершення для HTML-тренажерів / тестів-посилань.

   Підключається на сторінках тренажерів (звичайним <script>, або
   авто-через sk-footer.js). Активується ЛИШЕ коли сторінку відкрито
   як тест/випробування — тобто в адресі є ?skdone=...:

       ?skdone=t:<testId>      → зарахувати ТЕСТ  (sk_testpass_<id>)
       ?skdone=x:<slug>        → зарахувати ВИПРОБУВАННЯ (sk_trainer_<slug>)
       &skback=<url>           → куди повернутись (типово tests.html)

   Дає:
     • кнопку «✅ Я завершив(ла)» (для всіх сторінок);
     • window.skFinishRecord()  — лише записати (для канонічних openWin);
     • window.skFinish()        — записати + показати «Молодець!» + повернутись.

   Без ?skdone обидві функції — порожні (no-op), сторінка працює як завжди.
   ============================================================ */
(function(){
  'use strict';
  if(window.__skFinishMounted) return;
  window.__skFinishMounted = true;

  function param(n){ try{ return new URLSearchParams(location.search).get(n); }catch(e){ return null; } }

  var raw = param('skdone');
  if(!raw){ window.skFinish = function(){}; window.skFinishRecord = function(){}; return; }

  var back = param('skback') || 'tests.html';
  var kind = 't', key = raw, ci = raw.indexOf(':');
  if(ci > 0){ kind = raw.slice(0, ci); key = raw.slice(ci + 1); }
  var storeKey = (kind === 'x') ? ('sk_trainer_' + key) : ('sk_testpass_' + key);

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

  function mountBtn(){
    if(window.__skHasOwnFinish) return;   // сторінка має власну кнопку/гейт (напр. sk-tr-reward.js)
    if(document.getElementById('skFinishBtn')) return;
    var b = document.createElement('button');
    b.id = 'skFinishBtn';
    b.type = 'button';
    b.textContent = '✅ Я завершив(ла)';
    b.setAttribute('style',
      'position:fixed;left:50%;transform:translateX(-50%);'
      + 'bottom:calc(94px + env(safe-area-inset-bottom));z-index:2147482000;'
      + 'border:2px solid #fff6d8;border-radius:999px;padding:12px 22px;'
      + 'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-weight:800;font-size:15px;'
      + 'cursor:pointer;color:#0c2a12;background:linear-gradient(180deg,#8be08b,#39b539);'
      + 'box-shadow:0 8px 22px rgba(0,0,0,.42)');
    b.addEventListener('click', function(){ window.skFinish(); });
    document.body.appendChild(b);
  }

  if(document.readyState !== 'loading') mountBtn();
  else document.addEventListener('DOMContentLoaded', mountBtn);
})();

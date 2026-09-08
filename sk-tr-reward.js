/* ============================================================
   sk-tr-reward.js — нагорода за випробування + гейт кнопки «Я завершив».
   window.SKTR

   Працює ЛИШЕ коли сторінку відкрито як випробування (в адресі є
   ?skdone=x:<slug>&skback=<url>) — тобто з vyprobuvannya.html.

   Що робить:
     • Малює власну кнопку «✅ Я завершив(ла)» — СПОЧАТКУ НЕАКТИВНУ (гейт).
       (наявну кнопку sk-finish.js глушить через window.__skHasOwnFinish=true)
     • Тренажер сам вирішує, коли все пройдено (усі картки + усі міні-ігри),
       і викликає SKTR.setDone(true) — кнопка стає активною.
     • При натисканні активної кнопки:
         1) фіксує результат:  sk_trainer_<slug>=1  (через skFinishRecord) + sync;
         2) читає нагороду ЦЬОГО тренажера з адмінки: SK.getTrainers().links[].rewards
            = [{item, chance, coins}]  (те саме, що в блоці нагород карти);
         3) кидає шанс кожного слота (chance у %, крок 10; порожньо = 100%);
         4) для слота, що випав: SK.getItem(id) → SKIT.makeInstance → у інвентар
            (SK.addToInventory);  монети (coins) додає до heroes/{id}.coins;
         5) показує вікно «🎉 Вітаємо! Ти пройшов випробування» + «Ти отримав …»;
         6) «Повернутись» → skback.

   Ідемпотентність: нагорода видається один раз на Героя — гейтиться ключем
   sk_trreward_<slug>_v1. Повторне проходження лише фіксує результат і повертає.
   ============================================================ */
(function () {
  'use strict';
  if (window.__skTRMounted) return;
  window.__skTRMounted = true;

  function param(n) { try { return new URLSearchParams(location.search).get(n); } catch (e) { return null; } }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  var raw = param('skdone');
  // Активуємось лише для випробувань виду x:<slug>. Без цього — повний no-op.
  var SKTR = window.SKTR = {
    active: false, slug: '', back: 'vyprobuvannya.html',
    setDone: function () {}, finish: function () {}, isGranted: function () { return false; }
  };
  if (!raw) return;

  var ci = raw.indexOf(':');
  var kind = ci > 0 ? raw.slice(0, ci) : 't';
  var slug = ci > 0 ? raw.slice(ci + 1) : raw;
  if (kind !== 'x' || !slug) return;               // нагороди лише для випробувань-тренажерів

  // глушимо власну кнопку sk-finish.js — керуємо завершенням самі
  window.__skHasOwnFinish = true;

  SKTR.active = true;
  SKTR.slug = slug;
  SKTR.back = param('skback') || 'vyprobuvannya.html';

  var GRANT_KEY = 'sk_trreward_' + slug + '_v1';   // видача нагороди — один раз на Героя
  // ТЕСТОВИЙ РЕЖИМ: кнопка активна одразу, щоб не проходити все.
  //   • URL:  ...&sktest=1
  //   • або в консолі один раз:  localStorage.setItem('sk_tr_test','1')
  // На бойових посиланнях цього немає — дітей не зачіпає.
  var TEST = (param('sktest') === '1');
  try { if (localStorage.getItem('sk_tr_test') === '1') TEST = true; } catch (e) {}
  var done = TEST;       // усі картки + міні-ігри пройдено (гейт); у тесті — одразу true
  var busy = false;      // захист від подвійного кліку
  var btn = null;

  SKTR.isGranted = function () { try { return localStorage.getItem(GRANT_KEY) === '1'; } catch (e) { return false; } };

  /* ── кнопка ─────────────────────────────────────────────── */
  function mountBtn() {
    var old = document.getElementById('skFinishBtn'); if (old) old.remove();   // прибрати кнопку sk-finish, якщо встигла
    if (document.getElementById('skTRBtn')) { btn = document.getElementById('skTRBtn'); return; }
    btn = document.createElement('button');
    btn.id = 'skTRBtn';
    btn.type = 'button';
    btn.textContent = '✅ Я завершив(ла)';
    btn.disabled = true;
    btn.setAttribute('style', BTN_STYLE(false));
    btn.addEventListener('click', function () { if (!btn.disabled) SKTR.finish(); });
    document.body.appendChild(btn);
    applyDone();
  }
  function BTN_STYLE(on) {
    return 'position:fixed;left:50%;transform:translateX(-50%);'
      + 'bottom:calc(94px + env(safe-area-inset-bottom));z-index:2147482000;'
      + 'border:2px solid ' + (on ? '#fff6d8' : '#d7dbe6') + ';border-radius:999px;padding:12px 22px;'
      + 'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-weight:800;font-size:15px;'
      + 'transition:filter .2s,opacity .2s;'
      + (on
        ? 'cursor:pointer;color:#0c2a12;background:linear-gradient(180deg,#8be08b,#39b539);box-shadow:0 8px 22px rgba(0,0,0,.42)'
        : 'cursor:not-allowed;color:#8b90a0;background:#e9ecf3;box-shadow:0 4px 10px rgba(0,0,0,.14);opacity:.85');
  }
  function applyDone() {
    if (!btn) return;
    btn.disabled = !done;
    btn.setAttribute('style', BTN_STYLE(done));
    btn.title = done ? 'Натисни, щоб завершити випробування' : 'Спочатку пройди всі картки та ігри';
  }
  SKTR.setDone = function (v) { done = TEST || !!v; applyDone(); };

  /* ── читання нагороди цього тренажера з адмінки ──────────── */
  function normSlug(href) {
    return String(href || '').replace(/[?#].*$/, '').replace(/\.html?$/i, '').replace(/^.*\//, '');
  }
  function myRewards(cb) {
    try {
      if (!(window.SK && SK.getTrainers)) { cb([]); return; }
      SK.getTrainers().then(function (data) {
        var links = (data && Array.isArray(data.links)) ? data.links : [];
        var me = null;
        for (var i = 0; i < links.length; i++) { if (normSlug(links[i] && links[i].href) === slug) { me = links[i]; break; } }
        cb((me && Array.isArray(me.rewards)) ? me.rewards : []);
      }).catch(function () { cb([]); });
    } catch (e) { cb([]); }
  }
  function rolls(rewards) {
    // повертає список слотів, що випали: [{item, coins}]
    var hit = [];
    (rewards || []).forEach(function (r) {
      if (!r) return;
      var ch = Number(r.chance);
      if (!isFinite(ch)) ch = 100;                 // порожній шанс = завжди
      if (ch <= 0) return;
      if (Math.random() * 100 < ch) hit.push({ item: (r.item || '').trim(), coins: Number(r.coins) || 0 });
    });
    return hit;
  }

  /* ── видача: предмети в інвентар + монети ────────────────── */
  function grant(hits, cb) {
    var items = [];       // {base} для показу
    var coinsTotal = 0;
    var pending = 0, doneFetch = false;
    hits.forEach(function (h) { coinsTotal += (h.coins || 0); });

    function afterItems() {
      var insts = [];
      items.forEach(function (base) {
        try { if (window.SKIT && SKIT.makeInstance) insts.push(SKIT.makeInstance(base)); }
        catch (e) {}
      });
      var tasks = [];
      if (insts.length && window.SK && SK.addToInventory) tasks.push(SK.addToInventory(insts).catch(function () {}));
      if (coinsTotal > 0) tasks.push(addCoins(coinsTotal).catch(function () {}));
      Promise.all(tasks).then(function () { cb(items, coinsTotal); }).catch(function () { cb(items, coinsTotal); });
    }

    var withItem = hits.filter(function (h) { return h.item; });
    if (!withItem.length) { afterItems(); return; }
    pending = withItem.length;
    withItem.forEach(function (h) {
      if (!(window.SK && SK.getItem)) { if (--pending === 0) afterItems(); return; }
      SK.getItem(h.item).then(function (base) {
        if (base) { base.id = base.id || h.item; items.push(base); }
        else items.push({ id: h.item, name: h.item });   // каталог не знайшов — покажемо хоч id
      }).catch(function () {
        items.push({ id: h.item, name: h.item });
      }).then(function () { if (--pending === 0) afterItems(); });
    });
  }

  function addCoins(delta) {
    // coins — надійний лічильник (sk-progress його не чіпає): SK.addCoins доливає
    try {
      if (window.SK && SK.addCoins) return SK.addCoins(delta);
    } catch (e) {}
    return Promise.resolve();
  }

  /* ── вікно «Вітаємо» ─────────────────────────────────────── */
  function itemRow(base) {
    var id = base.id || '';
    var name = base.name || id || 'Предмет';
    var stat = '';
    var sval = (base.value != null ? base.value : base.statVal);
    if (base.stat && sval != null) {
      var slabel = base.stat;
      try { if (window.SKCUR && SKCUR.statLabel) slabel = SKCUR.statLabel(base.stat) || base.stat; } catch (e) {}
      stat = '<span style="display:inline-block;background:rgba(88,214,141,.16);color:#2fa96a;font-weight:800;'
        + 'font-size:13px;padding:3px 10px;border-radius:8px;margin-top:4px">' + esc(String(slabel)) + ' +' + esc(String(sval)) + '</span>';
    }
    var img = 'img/items/' + esc(id) + '.webp';
    return '<div style="display:flex;align-items:center;gap:14px;text-align:left;background:#fff;border:2px solid #eef1f7;'
      + 'border-radius:16px;padding:12px 14px;margin-top:10px">'
      + '<div style="width:74px;height:74px;flex:none;border-radius:14px;background:#f5eeda;display:grid;place-items:center;overflow:hidden">'
      + '<img src="' + img + '" alt="" style="width:100%;height:100%;object-fit:contain;padding:6px" '
      + 'onerror="this.onerror=null;this.parentNode.textContent=\'🎁\'"></div>'
      + '<div style="flex:1;min-width:0"><div style="font-family:Fredoka,system-ui,sans-serif;font-weight:700;font-size:16px;color:#20232e;line-height:1.15">'
      + esc(name) + '</div>' + stat + '</div></div>';
  }
  function showWin(items, coins) {
    if (document.getElementById('skTROverlay')) return;
    var ov = document.createElement('div');
    ov.id = 'skTROverlay';
    ov.setAttribute('style', 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;'
      + 'background:rgba(8,18,38,.64);padding:16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif');
    var inner = '<div style="font-size:52px;line-height:1;margin-bottom:6px">🎉</div>'
      + '<div style="font-family:Georgia,\'Times New Roman\',serif;font-weight:800;font-size:23px;color:#ffe08a;margin-bottom:4px">Вітаємо!</div>'
      + '<div style="font-size:15px;opacity:.95;margin-bottom:6px">Ти пройшов випробування ✔</div>';
    if (coins > 0) {
      inner += '<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(244,200,66,.16);border:2px solid #f4c842;'
        + 'color:#ffe08a;font-weight:800;border-radius:999px;padding:5px 14px;margin:6px 0">+' + coins + ' 🪙 монет</div>';
    }
    if (items && items.length) {
      inner += '<div style="font-size:14px;font-weight:800;color:#c7d6ee;margin-top:6px">Ти отримав' + (items.length > 1 ? ' предмети' : ' предмет') + ':</div>';
      items.forEach(function (b) { inner += itemRow(b); });
    } else if (!(coins > 0)) {
      inner += '<div style="font-size:14px;color:#c7d6ee;margin-top:6px">Молодець, що дійшов до кінця!</div>';
    }
    inner += '<button id="skTRBack" style="margin-top:18px;border:0;border-radius:14px;padding:12px 26px;font-weight:800;'
      + 'font-size:15px;cursor:pointer;background:linear-gradient(180deg,#fdeeb6,#f4c842);color:#5a3d05">Повернутись</button>';
    var card = document.createElement('div');
    card.setAttribute('style', 'background:linear-gradient(165deg,#1e3a6b,#16294f);border:3px solid #e0a42a;border-radius:22px;'
      + 'padding:24px 20px;max-width:340px;width:100%;text-align:center;color:#fff;box-shadow:0 22px 55px rgba(0,0,0,.55);max-height:90vh;overflow:auto');
    card.innerHTML = inner;
    ov.appendChild(card);
    document.body.appendChild(ov);
    var go = function () { location.href = SKTR.back; };
    card.querySelector('#skTRBack').addEventListener('click', go);
  }

  /* ── головний фініш ──────────────────────────────────────── */
  SKTR.finish = function () {
    if (busy) return;
    busy = true;
    if (btn) { btn.disabled = true; btn.style.opacity = '.6'; }

    // 1) фіксуємо результат (sk_trainer_<slug>=1 + sync) через sk-finish
    try { if (window.skFinishRecord) skFinishRecord(); } catch (e) {}

    // повторне проходження: нагороду вже видано — просто повертаємось
    if (SKTR.isGranted()) { location.href = SKTR.back; return; }

    // 2–5) читаємо нагороду, кидаємо шанс, видаємо, показуємо вікно
    myRewards(function (rewards) {
      var hits = rolls(rewards);
      grant(hits, function (items, coins) {
        try { localStorage.setItem(GRANT_KEY, '1'); } catch (e) {}
        try { if (window.SK && SK.pushLocal) SK.pushLocal().catch(function () {}); } catch (e) {}
        showWin(items, coins);
      });
    });
  };

  if (document.readyState !== 'loading') mountBtn();
  else document.addEventListener('DOMContentLoaded', mountBtn);
})();

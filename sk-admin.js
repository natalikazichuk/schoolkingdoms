/* sk-admin.js — спільний шар admin-сторінок SchoolKingdoms (window.SKADMIN).

   НАВІЩО. Гейт доступу, шапка, gate-екран і дрібні хелпери були скопійовані
   в п'ять admin-сторінок і вже встигли розійтися: admin-reports кликав
   SK.getCurrentUser, решта — SK.currentUser; таймаути очікування були
   100 / 120 / 200 спроб; esc() в admin.html не екранував апостроф.
   Тут — одна копія, яку підключають одним рядком.

   ЧОМУ ЗВИЧАЙНИЙ СКРИПТ, А НЕ МОДУЛЬ. firebase-config.js — ES-модуль, тобто
   deferred: window.SK з'являється ПІСЛЯ DOMContentLoaded. Якби цей файл був
   модулем, кожна сторінка знову писала б власний цикл очікування. Тут його
   пише whenReady() — один раз на всіх.

   ПІДКЛЮЧЕННЯ (звичайним тегом, до інлайн-скрипта сторінки):
     <link rel="stylesheet" href="sk-admin.css?v=1">
     <script src="sk-admin.js?v=1"></script>

   API:
     SKADMIN.whenReady(cb)      -> cb(SK|null) коли SK готовий (або таймаут)
     SKADMIN.guard(cfg)         -> гейт «лише для адміністраторів»
     SKADMIN.header(cfg)        -> малює шапку в <header class="topbar">
     SKADMIN.gate(msg[, mount]) -> екран «Доступ обмежено»
     SKADMIN.$(id) .qs(sel) .esc(s) .toast(msg[, isErr])
*/
(function () {
"use strict";

/* Версія API. Інкрементуй, коли міняєш або додаєш експорт — сторінки
   зможуть сказати «онови sk-admin.js» замість того, щоб мовчки падати. */
var API_VERSION = 1;

/* ── дрібні хелпери ───────────────────────────────────────────────── */

function $(id) { return document.getElementById(id); }
function qs(sel) { return document.querySelector(sel); }

/* Екранує і апостроф теж: у назвах українських тестів («Пам'ять королівства»)
   він звичайна річ, а вставляють такі рядки і в атрибути через '…'. */
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

/* Тост. Якщо на сторінці немає <div class="toast" id="toast"> — створюємо,
   щоб виклик ніколи не падав на сторінці, де елемент забули додати. */
var toastTimer = null;
function toast(msg, isErr) {
  var t = $("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = String(msg == null ? "" : msg);
  t.className = "toast on" + (isErr ? " err" : "");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.className = "toast"; }, 2200);
}

/* ── очікування window.SK ─────────────────────────────────────────── */

/* Найщедріший із таймаутів, що були по сторінках (200 × 50 мс ≈ 10 с),
   щоб жодна сторінка не отримала МЕНШЕ терпіння, ніж мала досі. */
var WAIT_TRIES = 200;
var WAIT_STEP = 50;

function whenReady(cb) {
  var tries = 0;
  (function tick() {
    if (window.SK && window.SK.ready) {
      window.SK.ready.then(function () { cb(window.SK); },
                           function () { cb(window.SK); });
      return;
    }
    if (tries++ < WAIT_TRIES) setTimeout(tick, WAIT_STEP);
    else cb(null);
  })();
}

/* Поточний дорослий користувач. SK має і currentUser(), і псевдонім
   getCurrentUser() — сторінки історично кликали то одне, то інше.
   Тут приймаємо обидва, тож розбіжність більше ні на що не впливає. */
function currentUser(SK) {
  try {
    if (typeof SK.currentUser === "function") return SK.currentUser();
    if (typeof SK.getCurrentUser === "function") return SK.getCurrentUser();
  } catch (e) {}
  return null;
}

/* ── екран «Доступ обмежено» ──────────────────────────────────────── */

/* mount — селектор або елемент; за замовчуванням #root. */
function gate(msg, mount) {
  var host = (typeof mount === "string") ? qs(mount)
           : (mount && mount.nodeType) ? mount
           : $("root");
  if (!host) return;
  host.innerHTML =
      '<div class="gate"><div class="big">🔒</div>'
    + '<h1 style="font-size:1.3rem">Доступ обмежено</h1>'
    + '<p class="sub" style="margin:8px 0 14px">' + esc(msg) + "</p>"
    + '<a class="btn ghost" href="login.html">Увійти</a></div>';
}

/* ── шапка ────────────────────────────────────────────────────────── */

/* cfg = {
     mount : селектор/елемент шапки (за замовчуванням '.topbar'),
     name  : велика назва сторінки,
     sub   : підпис під назвою,
     nav   : [{ href, label } | { id, label }]  — посилання або кнопка,
     logout: true/false — додати кнопку «Вийти» (прихована до перевірки прав)
   }
   Кнопку виходу показує й підключає guard() — до підтвердження прав вона
   лишається display:none, як було на кожній сторінці окремо. */
function header(cfg) {
  cfg = cfg || {};
  var host = (typeof cfg.mount === "string") ? qs(cfg.mount)
           : (cfg.mount && cfg.mount.nodeType) ? cfg.mount
           : qs("header.topbar") || qs(".topbar");
  if (!host) return null;

  var items = (cfg.nav || []).map(function (n) {
    if (n.href) {
      return '<a href="' + esc(n.href) + '">' + esc(n.label) + "</a>";
    }
    return '<button type="button" id="' + esc(n.id) + '">' + esc(n.label) + "</button>";
  });
  if (cfg.logout !== false) {
    items.push('<button type="button" id="logoutBtn" style="display:none">🚪 Вийти</button>');
  }

  host.innerHTML =
      '<a class="brand" href="index.html">'
    +   '<span class="crown">👑</span>'
    +   "<span>"
    +     '<span class="bt-name">' + esc(cfg.name || "") + "</span>"
    +     '<span class="bt-sub">' + esc(cfg.sub || "") + "</span>"
    +   "</span>"
    + "</a>"
    + '<div class="spacer"></div>'
    + '<nav class="nav">' + items.join("") + "</nav>";
  return host;
}

/* ── гейт доступу ─────────────────────────────────────────────────── */

/* cfg = {
     denyMsg : текст, коли не залогінений («Увійди адміністратором, щоб …»),
     onOk    : function(SK) — права підтверджено, можна малювати сторінку,
     onDeny  : function(msg) — своя реакція замість стандартного gate()
               (admin.html має статичний #gateDenied, тож підміняє її),
     mount   : куди малювати gate() за замовчуванням
   } */
function guard(cfg) {
  cfg = cfg || {};
  var deny = (typeof cfg.onDeny === "function")
    ? cfg.onDeny
    : function (msg) { gate(msg, cfg.mount); };

  whenReady(function (SK) {
    if (!SK) { deny("Не вдалося підключитися до бази."); return; }

    if (!currentUser(SK)) {
      deny(cfg.denyMsg || "Увійди адміністратором, щоб відкрити цю сторінку.");
      return;
    }

    Promise.resolve(SK.isAdmin ? SK.isAdmin() : false).then(function (isAdmin) {
      if (!isAdmin) { deny("Ця сторінка лише для адміністраторів."); return; }
      wireLogout(SK);
      if (typeof cfg.onOk === "function") cfg.onOk(SK);
    }, function () {
      deny("Не вдалося перевірити права доступу.");
    });
  });
}

/* Кнопка виходу: показуємо лише після підтвердження прав — так само,
   як це робила кожна сторінка своєю копією цих трьох рядків. */
function wireLogout(SK) {
  var lo = $("logoutBtn");
  if (!lo) return;
  lo.style.display = "";
  lo.onclick = function () {
    Promise.resolve(SK.logout ? SK.logout() : null).then(function () {
      location.href = "login.html";
    }, function () {
      location.href = "login.html";
    });
  };
}

/* ── експорт ──────────────────────────────────────────────────────── */

window.SKADMIN = {
  API_VERSION: API_VERSION,
  whenReady: whenReady,
  currentUser: currentUser,
  guard: guard,
  header: header,
  gate: gate,
  $: $,
  qs: qs,
  esc: esc,
  toast: toast
};

})();

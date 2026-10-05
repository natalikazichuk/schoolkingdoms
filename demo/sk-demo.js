/* ============================================================
   sk-demo.js — заміна firebase-config.js у ДЕМО-версії.

   Збирач (tools/build-demo.mjs) кладе цей файл у dist-demo під іменем
   firebase-config.js, тож сторінки підключають його як завжди.

   Демо працює без бази й без входу:
     • гість (не Герой) — характеристики, монети й нагороди не нараховуються;
     • тести читаються з data/tests.json;
     • карта королівства — запасна (DEFAULT_MAP із sk-curriculum.js);
     • прогрес тренажерів лишається лише в localStorage браузера.
   Будь-який інший метод SK повертає Promise<null>, щоб сторінка не падала.
   ============================================================ */

var BASE = (function () {
  try { return new URL('.', import.meta.url).href; } catch (e) { return './'; }
})();

var testsCache = null;
function loadTests() {
  if (!testsCache) {
    testsCache = fetch(BASE + 'data/tests.json')
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; });
  }
  return testsCache;
}

var core = {
  DEMO: true,
  user: null,
  activeChildId: null,
  activeHeroId: null,
  ready: Promise.resolve(null),

  currentUser: function () { return null; },
  getCurrentUser: function () { return null; },
  isHeroSession: function () { return false; },
  isParentSession: function () { return false; },
  isChildMode: function () { return false; },
  isAdmin: function () { return false; },
  requireParent: function () { location.replace(BASE + 'index.html'); return false; },
  requireChild: function () { location.replace(BASE + 'index.html'); return false; },
  requireHero: function () { location.replace(BASE + 'index.html'); return false; },
  onUser: function (cb) { if (typeof cb === 'function') setTimeout(function () { cb(null); }, 0); },

  getHero: function () { return Promise.resolve(null); },
  getActiveChild: function () { return Promise.resolve(null); },
  getActiveHero: function () { return Promise.resolve(null); },
  saveHeroStats: function () { return Promise.resolve(false); },
  addHeroStats: function () { return Promise.resolve(false); },
  pushLocal: function () { return Promise.resolve(false); },
  pullLocal: function () { return Promise.resolve(false); },

  getCurriculum: function () { return Promise.resolve(null); },
  getGames: function () { return Promise.resolve(null); },

  listTests: function () { return loadTests(); },
  listActiveTests: function (grade) {
    return loadTests().then(function (list) {
      return list.filter(function (t) {
        return t.active !== false && (grade == null || Number(t.grade) === Number(grade));
      });
    });
  },
  getTest: function (id) {
    return loadTests().then(function (list) {
      return list.find(function (t) { return t.id === id; }) || null;
    });
  }
};

var SK = new Proxy(core, {
  get: function (target, key) {
    if (key in target) return target[key];
    if (typeof key !== 'string' || key === 'then') return undefined;
    return function () { return Promise.resolve(null); };
  }
});

window.SK = SK;

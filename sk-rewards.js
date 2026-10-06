/* ============================================================
   sk-rewards.js — видача нагороди тренажера, налаштованої в адмінці.

   Картка запису (колекція tests) зберігає з адмінки:
     stat / statMode / statValue        — характеристика й скільки одиниць
     rewards: {
       wheel:  { on, slots:[{item, coins}×4] }  — колесо фортуни, шанси 40/30/20/10
       extras: [{on, item, chance, coins}]      — додаткові нагороди зі своїм шансом
       repeat: bool                             — нагорода при кожному проходженні
     }
   Старий формат rewards[ {item, chance, coins} ] читаємо як колесо (див. norm).

   Тут ми це нарешті ВИДАЄМО — один раз на Героя й на запис:
     монети   → heroes/{id}.coins                          (SK.addCoins)
     предмети → heroes/{id}.inventory                      (SK.addToInventory)
     стат     → heroes/{id}.{health|mana|agility|accuracy} (SK.saveHeroStats)

   Колесо завжди дає рівно один слот (предмет + його монети); порожні слоти
   не крутяться, шанси решти перераховуються пропорційно. Додаткові нагороди
   розігруються кожна окремо. Монети кожного виграшу — «кубик» ±50% від
   указаної суми; усе складається й видається однією сумою.
   Характеристика — завжди лише раз (окремий замок sk_rewardstat_<id>),
   навіть коли нагорода за кожне проходження.

   Одноразовість тримає ключ sk_reward_<id> у localStorage. Він із простору
   sk_*, тож firebase-config синхронізує його в heroes/{id}.progress — і на
   іншому пристрої той самий Герой нагороду вдруге не забере.

   Підключення на сторінці тренажера (звичайні скрипти, після firebase-config):
     <script src="../sk-items.js?v=2"></script>
     <script src="../sk-rewards.js?v=1"></script>
   і виклик у момент повного проходження:
     const res = await SKREWARD.claim();

   Повертає {skipped, reason, already, failed, coins, items:[{id,name,img,bonus}], stat}.
   Якщо запис у базу не пройшов (правила, офлайн), повертається failed[] —
   замок знімається, щоб нагорода не згоріла, і сторінка каже про це дитині.
   Без сесії Героя / без запису в базі — {skipped:true}: сторінка просто
   святкує без нагороди, нічого не ламається.
   ============================================================ */
(function () {
  'use strict';

  /* Характеристики, які справді зберігаються в героя (як у test.html). */
  var ACTIVE_STATS = { health: 1, mana: 1, agility: 1, accuracy: 1 };
  var STAT_BASE    = { health: 50, mana: 20, agility: 50, accuracy: 50 };

  function param(n) { try { return new URLSearchParams(location.search).get(n); } catch (e) { return null; } }

  /* Корінь сайту рахуємо від власного <script src>: тренажери лежать у
     підпапках (doshkilya/, klas-1/), тож 'img/items/…' звідти вело б у нікуди. */
  var SELF = (document.currentScript && document.currentScript.src) || '';
  var BASE_URL = SELF ? SELF.replace(/[?#].*$/, '').replace(/[^/]*$/, '') : '';

  /* Картинка предмета. Поле img в адмінці — лише для зовнішнього посилання;
     свої файли лежать за домовленістю в img/items/<id>.webp. */
  function itemImg(base) {
    var u = String((base && base.img) || '').trim();
    if (/^https?:\/\//i.test(u)) return u;
    return BASE_URL + 'img/items/' + encodeURIComponent(base.id) + '.webp';
  }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  /* Стат у картці міг лишитись підписом («Точність 🎯») — канонізуємо. */
  function statKey(v) {
    if (!v) return '';
    var k = String(v);
    if (ACTIVE_STATS[k]) return k;
    try { if (window.SKCUR && SKCUR.statKeyFrom) { var s = SKCUR.statKeyFrom(k); if (s && ACTIVE_STATS[s]) return s; } } catch (e) {}
    return '';
  }
  function statLabel(k) {
    try { if (window.SKCUR && SKCUR.statLabel) return SKCUR.statLabel(k) || k; } catch (e) {}
    return String(k || '');
  }

  /* firebase-config.js — ES-модуль, SK з'являється пізніше за наш скрипт. */
  function waitSK() {
    return new Promise(function (res) {
      var t = 0;
      (function w() {
        if (window.SK && SK.ready && typeof SK.ready.then === 'function') {
          return SK.ready.then(function () { res(true); }, function () { res(true); });
        }
        if (t++ > 140) return res(false);   // ~7 с — далі просто святкуємо без нагороди
        setTimeout(w, 50);
      })();
    });
  }

  /* Який саме запис відкрито. Найнадійніше каже ?skdone=t:<id> (так тести.html
     будує посилання). Якщо дитина прийшла іншим шляхом — шукаємо за іменем
     файла серед linkHref. */
  function fileOf(u) {
    return String(u || '').toLowerCase().split('?')[0].split('#')[0].split('/').pop();
  }
  function findRecord(hrefFallback) {
    var raw = param('skdone');
    var id = null;
    if (raw) { var ci = raw.indexOf(':'); id = ci > 0 ? raw.slice(ci + 1) : raw; }
    var byId = id ? SK.getTest(id).catch(function () { return null; }) : Promise.resolve(null);
    return byId.then(function (rec) {
      if (rec) return rec;
      var me = fileOf(hrefFallback || location.pathname);
      return SK.listTests().then(function (all) {
        for (var i = 0; i < (all || []).length; i++) {
          if (fileOf(all[i].linkHref) === me) return all[i];
        }
        return null;
      }).catch(function () { return null; });
    });
  }

  /* v2: у першій версії замок ставився ДО запису в базу, тож невдала видача
     (відмова правил) блокувала нагороду назавжди. Нова назва ключа дає тим
     Героям ще одну спробу. */
  function guardKey(rec) { return 'sk_reward2_' + String(rec.id || '').replace(/[^\w-]/g, ''); }
  function wasClaimed(rec) { try { return !!localStorage.getItem(guardKey(rec)); } catch (e) { return false; } }
  function markClaimed(rec, payload) {
    /* Пишемо не просто «видано», а що саме: за uid згодом видно, чи предмет
       справді лежить в інвентарі, чи загубився дорогою. */
    var v = { at: Date.now() };
    if (payload) { v.coins = payload.coins || 0; v.uids = payload.uids || []; v.ids = payload.ids || []; }
    try { localStorage.setItem(guardKey(rec), JSON.stringify(v)); } catch (e) {}
  }
  function claimedInfo(rec) {
    try {
      var raw = localStorage.getItem(guardKey(rec));
      if (!raw) return null;
      if (raw.charAt(0) !== '{') return { at: +raw || 0 };   // старий формат — просто час
      return JSON.parse(raw) || null;
    } catch (e) { return null; }
  }
  function unmarkClaimed(rec) { try { localStorage.removeItem(guardKey(rec)); } catch (e) {} }

  /* Характеристику дають лише раз — навіть коли решта нагороди
     повторюється. Хто вже забрав нагороду за старим правилом, стат теж має. */
  function statKeyOf(rec) { return 'sk_rewardstat_' + String(rec.id || '').replace(/[^\w-]/g, ''); }
  function statClaimed(rec) {
    try { return !!localStorage.getItem(statKeyOf(rec)) || wasClaimed(rec); } catch (e) { return false; }
  }
  function markStat(rec) { try { localStorage.setItem(statKeyOf(rec), String(Date.now())); } catch (e) {} }

  /* Шанси колеса фортуни — сталі, у базі не зберігаються. */
  var WHEEL = [40, 30, 20, 10];

  function normSlot(x) {
    x = x || {};
    return { item: String(x.item || '').trim(), coins: Math.max(0, Math.floor(num(x.coins))) };
  }
  /* rewards з бази → { wheel:{on, slots[4]}, extras[], repeat }.
     Старий масив слотів стає колесом (увімкненим, якщо там щось виставлено). */
  function norm(rw) {
    var out = { wheel: { on: false, slots: [] }, extras: [], repeat: false };
    if (Array.isArray(rw)) {
      out.wheel.slots = rw.slice(0, 4).map(normSlot);
      out.wheel.on = out.wheel.slots.some(function (s) { return s.item || s.coins; });
    } else if (rw && typeof rw === 'object') {
      var w = rw.wheel || {};
      out.wheel.on = !!w.on;
      out.wheel.slots = (Array.isArray(w.slots) ? w.slots : []).slice(0, 4).map(normSlot);
      out.extras = (Array.isArray(rw.extras) ? rw.extras : []).map(function (x) {
        var s = normSlot(x);
        s.on = !!(x && x.on);
        s.chance = (x && x.chance != null) ? Math.max(0, Math.min(100, num(x.chance))) : 100;
        return s;
      });
      out.repeat = !!rw.repeat;
    }
    while (out.wheel.slots.length < 4) out.wheel.slots.push({ item: '', coins: 0 });
    return out;
  }
  /* Чи є що розігрувати (для підказки дитині на старті). */
  function hasLoot(rw) {
    var n = norm(rw);
    var wheel = n.wheel.on && n.wheel.slots.some(function (s) { return s.item || s.coins; });
    var extra = n.extras.some(function (x) { return x.on && (x.item || x.coins) && x.chance > 0; });
    return wheel || extra;
  }

  /* Кубик на 101 грань: −50%…+50% від суми. Хоч одна монетка лишається. */
  function jitter(base) {
    if (!(base > 0)) return 0;
    var k = Math.floor(Math.random() * 101) - 50;
    return Math.max(1, Math.round(base * (1 + k / 100)));
  }

  /* Розіграти нагороду: колесо (рівно один слот) + кожна додаткова окремо. */
  function roll(rw) {
    var n = norm(rw);
    var out = { coins: 0, itemIds: [] };
    function win(s) {
      if (s.item) out.itemIds.push(s.item);
      out.coins += jitter(s.coins);
    }
    if (n.wheel.on) {
      var pool = [], sum = 0;
      n.wheel.slots.forEach(function (s, i) {
        if (s.item || s.coins) { pool.push({ s: s, w: WHEEL[i] }); sum += WHEEL[i]; }
      });
      if (pool.length) {
        var r = Math.random() * sum, pick = pool[pool.length - 1].s;
        for (var i = 0; i < pool.length; i++) { r -= pool[i].w; if (r < 0) { pick = pool[i].s; break; } }
        win(pick);
      }
    }
    n.extras.forEach(function (x) {
      if (!x.on || !(x.item || x.coins)) return;
      if (Math.random() * 100 < x.chance) win(x);
    });
    return out;
  }

  /* Базові предмети за id → екземпляри інвентаря (з киданням бонусу). */
  function buildInstances(ids) {
    return Promise.all(ids.map(function (id) {
      return SK.getItem(id).catch(function () { return null; });
    })).then(function (bases) {
      var items = [], instances = [];
      bases.forEach(function (base) {
        if (!base || !base.id) return;                      // ID з адмінки не знайшовся — тихо пропускаємо
        var inst = (window.SKIT && SKIT.makeInstance)
          ? SKIT.makeInstance(base)
          : { uid: 'inv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
              id: base.id, qty: 1, bonus: 1, durMax: null, durCur: null, identified: false };
        instances.push(inst);
        items.push({ id: base.id, name: base.name || base.id, img: itemImg(base), bonus: inst.bonus });
      });
      return { items: items, instances: instances };
    });
  }

  /* Кожен запис у базу перевіряємо окремо: false або виняток — це відмова
     (найчастіше правила Firestore), і про неї треба знати, а не мовчки
     «видати» нагороду лише на екрані. */
  function job(name, p) {
    return p.then(
      function (r) { return { name: name, ok: r !== false, value: r }; },
      function (e) { return { name: name, ok: false, err: String((e && (e.code || e.message)) || e) }; }
    );
  }

  function grantStat(rec) {
    var key = statKey(rec.stat);
    var val = Math.max(0, Math.floor(num(rec.statValue)));
    if (!key || !val) return Promise.resolve({ name: 'stat', ok: true, value: null });
    /* Приріст додається до значення В БАЗІ однією транзакцією (SK.addHeroStats):
       окреме «прочитали → додали → записали» затирало новіші записи інших сторінок. */
    var add = {}; add[key] = val;
    var write = SK.addHeroStats ? SK.addHeroStats(add) : SK.getHero().then(function (h) {
      h = h || {};
      var cur = (h[key] != null) ? num(h[key]) : (STAT_BASE[key] || 0);
      var patch = {}; patch[key] = cur + val;
      return SK.saveHeroStats(patch);
    });
    return write.then(function (r) {
      return { name: 'stat', ok: r !== false, value: { key: key, label: statLabel(key), value: val } };
    }).catch(function (e) { return { name: 'stat', ok: false, err: String((e && (e.code || e.message)) || e) }; });
  }

  /* Предмет справді ліг у heroes/{id}.inventory? Перечитуємо — так ловимо
     відмову правил, яку сам запис міг не повернути. */
  function verifyItems(instances) {
    if (!instances.length) return Promise.resolve(true);
    return SK.getInventory().then(function (inv) {
      var have = {};
      (inv || []).forEach(function (x) { if (x && x.uid) have[x.uid] = 1; });
      return instances.every(function (i) { return have[i.uid]; });
    }).catch(function () { return false; });
  }

  /* Нагороду вже брали. Перевіряємо, чи предмети з неї справді лежать в
     інвентарі: якщо запис тоді не дійшов (правила, обрив звʼязку), тихо
     докладаємо їх ще раз. Монети й характеристику не чіпаємо — вони або
     записались, або ні, і подвоювати їх не можна. */
  function restoreLost(rec) {
    var info = claimedInfo(rec);
    var uids = (info && info.uids) || [];
    var ids  = (info && info.ids)  || [];
    if (!uids.length) return Promise.resolve({ already: true, coins: 0, items: [] });
    return SK.getInventory().then(function (inv) {
      var have = {};
      (inv || []).forEach(function (x) { if (x && x.uid) have[x.uid] = 1; });
      var lostIds = [];
      uids.forEach(function (u, i) { if (!have[u] && ids[i]) lostIds.push(ids[i]); });
      if (!lostIds.length) return { already: true, coins: 0, items: [] };
      return buildInstances(lostIds).then(function (built) {
        if (!built.instances.length) return { already: true, coins: 0, items: [] };
        return job('inventory', SK.addToInventory(built.instances)).then(function (r) {
          return verifyItems(built.instances).then(function (ok) {
            if (!r.ok || !ok) {
              try { console.error('[sk-rewards] загублений предмет не вдалось повернути'); } catch (e) {}
              return { already: true, failed: ['inventory (не вдалось повернути предмет)'], coins: 0, items: [] };
            }
            /* Оновлюємо замок новими uid, щоб наступна перевірка шукала їх. */
            markClaimed(rec, { coins: (info && info.coins) || 0,
              uids: built.instances.map(function (i) { return i.uid; }),
              ids: built.items.map(function (i) { return i.id; }) });
            try { if (SK.pushLocal) SK.pushLocal().catch(function () {}); } catch (e) {}
            return { already: true, restored: true, coins: 0, items: built.items };
          });
        });
      });
    }).catch(function () { return { already: true, coins: 0, items: [] }; });
  }

  var busy = false;   // нагорода за кожне проходження: подвійний клік не подвоїть

  var SKREWARD = {
    /* Забрати нагороду за повне проходження.
       opt — рядок (ім'я сторінки, якщо вона відкрита без ?skdone, напр.
       'vchymo-litery.html') або обʼєкт:
         { href, rec, recordId, skipStat }
         rec       — запис уже на руках (test.html), не шукаємо його вдруге;
         skipStat  — характеристику видає сама сторінка (test.html). */
    claim: function (opt) {
      if (typeof opt !== 'object' || !opt) opt = { href: opt };
      if (busy) return Promise.resolve({ skipped: true, reason: 'busy' });
      busy = true;
      return waitSK().then(function (ok) {
        if (!ok) return { skipped: true, reason: 'no-sk' };
        var isHero = false;
        try { isHero = !!(SK.isHeroSession && SK.isHeroSession()); } catch (e) {}
        if (!isHero) return { skipped: true, reason: 'not-hero' };

        var found = opt.rec ? Promise.resolve(opt.rec)
          : opt.recordId ? SK.getTest(opt.recordId).catch(function () { return null; })
          : findRecord(opt.href);
        return found.then(function (rec) {
          if (!rec) return { skipped: true, reason: 'no-record' };
          var repeat = norm(rec.rewards).repeat;
          if (!repeat && wasClaimed(rec)) return restoreLost(rec);

          if (!repeat) markClaimed(rec);          // спершу замок, потім видача
          var won = roll(rec.rewards);

          return buildInstances(won.itemIds).then(function (built) {
            var jobs = [];
            if (built.instances.length) jobs.push(job('inventory', SK.addToInventory(built.instances)));
            if (won.coins > 0) jobs.push(job('coins', SK.addCoins(won.coins)));
            if (!opt.skipStat && !statClaimed(rec)) jobs.push(grantStat(rec));
            return Promise.all(jobs).then(function (results) {
              return verifyItems(built.instances).then(function (inInventory) {
                var failed = results.filter(function (r) { return !r.ok; })
                  .map(function (r) { return r.name + (r.err ? ' (' + r.err + ')' : ''); });
                if (!inInventory) failed.push('inventory (предмет не зʼявився в базі)');

                var stat = null;
                results.forEach(function (r) {
                  if (r.name !== 'stat' || !r.ok) return;
                  stat = r.value;
                  markStat(rec);                  // стат записано — більше його не даємо
                });

                if (!failed.length) {
                  markClaimed(rec, { coins: won.coins,
                    uids: built.instances.map(function (i) { return i.uid; }),
                    ids: built.items.map(function (i) { return i.id; }) });
                }
                try { if (SK.pushLocal) SK.pushLocal().catch(function () {}); } catch (e) {}
                if (failed.length) {
                  /* Нічого (або не все) не записалось — знімаємо замок, щоб
                     нагорода не згоріла, і кажемо про це вголос. */
                  if (!repeat) unmarkClaimed(rec);
                  try { console.error('[sk-rewards] нагорода не збереглась:', failed.join(', ')); } catch (e) {}
                  return { failed: failed, coins: won.coins, items: built.items, stat: stat, recordId: rec.id, repeat: repeat };
                }
                return { coins: won.coins, items: built.items, stat: stat, recordId: rec.id, repeat: repeat };
              });
            });
          });
        });
      }).catch(function () { return { skipped: true, reason: 'error' }; })
        .then(function (res) { busy = false; return res; });
    },

    /* Чи вже забрано нагороду за цей запис (для UI, без видачі). */
    claimed: function (hrefFallback) {
      return waitSK().then(function (ok) {
        if (!ok) return false;
        return findRecord(hrefFallback).then(function (rec) { return rec ? wasClaimed(rec) : false; });
      }).catch(function () { return false; });
    },

    /* Для адмінки й сторінок: читання налаштувань без видачі. */
    WHEEL: WHEEL,
    norm: norm,
    hasLoot: hasLoot,
    wasClaimed: function (rec) { return !!(rec && rec.id) && wasClaimed(rec); }
  };

  window.SKREWARD = SKREWARD;
})();

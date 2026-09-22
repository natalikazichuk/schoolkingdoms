/* ============================================================
   sk-rewards.js — видача нагороди тренажера, налаштованої в адмінці.

   Картка запису (колекція tests) зберігає з адмінки:
     stat / statMode / statValue        — характеристика й скільки одиниць
     rewards[ {item, chance, coins} ]   — до 4 слотів «предмет / шанс / монетки»

   Тут ми це нарешті ВИДАЄМО — один раз на Героя й на запис:
     монети   → heroes/{id}.coins                          (SK.addCoins)
     предмети → heroes/{id}.inventory                      (SK.addToInventory)
     стат     → heroes/{id}.{health|mana|agility|accuracy} (SK.saveHeroStats)

   Шанс — на весь слот: випав, і дитина отримує і предмет, і монети слота.
   Слот без предмета (самі монети) видається завжди.

   Одноразовість тримає ключ sk_reward_<id> у localStorage. Він із простору
   sk_*, тож firebase-config синхронізує його в heroes/{id}.progress — і на
   іншому пристрої той самий Герой нагороду вдруге не забере.

   Підключення на сторінці тренажера (звичайні скрипти, після firebase-config):
     <script src="../sk-items.js?v=1"></script>
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

  /* Розіграти слоти нагород. Шанс — на весь слот; слот без предмета
     (самі монети) не розігрується, а видається завжди. */
  function rollSlots(rewards) {
    var out = { coins: 0, itemIds: [] };
    (Array.isArray(rewards) ? rewards : []).forEach(function (s) {
      if (!s) return;
      var item = String(s.item || '').trim();
      var coins = Math.max(0, Math.floor(num(s.coins)));
      if (!item && !coins) return;
      var chance = (s.chance == null) ? 100 : Math.max(0, Math.min(100, num(s.chance)));
      var hit = item ? (Math.random() * 100 < chance) : true;
      if (!hit) return;
      if (item) out.itemIds.push(item);
      out.coins += coins;
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
    return SK.getHero().then(function (h) {
      h = h || {};
      var cur = (h[key] != null) ? num(h[key]) : (STAT_BASE[key] || 0);
      var patch = {}; patch[key] = cur + val;
      return SK.saveHeroStats(patch).then(function (r) {
        return { name: 'stat', ok: r !== false, value: { key: key, label: statLabel(key), value: val } };
      });
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

  var SKREWARD = {
    /* Забрати нагороду за повне проходження. hrefFallback — ім'я сторінки,
       якщо вона відкрита без ?skdone (напр. 'vchymo-litery.html'). */
    claim: function (hrefFallback) {
      return waitSK().then(function (ok) {
        if (!ok) return { skipped: true, reason: 'no-sk' };
        var isHero = false;
        try { isHero = !!(SK.isHeroSession && SK.isHeroSession()); } catch (e) {}
        if (!isHero) return { skipped: true, reason: 'not-hero' };

        return findRecord(hrefFallback).then(function (rec) {
          if (!rec) return { skipped: true, reason: 'no-record' };
          if (wasClaimed(rec)) return restoreLost(rec);

          markClaimed(rec);                       // спершу замок, потім видача:
          var roll = rollSlots(rec.rewards);      // подвійний клік не подвоїть нагороду

          return buildInstances(roll.itemIds).then(function (built) {
            var jobs = [];
            if (built.instances.length) jobs.push(job('inventory', SK.addToInventory(built.instances)));
            if (roll.coins > 0) jobs.push(job('coins', SK.addCoins(roll.coins)));
            jobs.push(grantStat(rec));
            return Promise.all(jobs).then(function (results) {
              return verifyItems(built.instances).then(function (inInventory) {
                var failed = results.filter(function (r) { return !r.ok; })
                  .map(function (r) { return r.name + (r.err ? ' (' + r.err + ')' : ''); });
                if (!inInventory) failed.push('inventory (предмет не зʼявився в базі)');

                var stat = null;
                results.forEach(function (r) { if (r.name === 'stat' && r.ok) stat = r.value; });
                try { if (SK.pushLocal) SK.pushLocal().catch(function () {}); } catch (e) {}

                if (!failed.length) {
                  markClaimed(rec, { coins: roll.coins,
                    uids: built.instances.map(function (i) { return i.uid; }),
                    ids: built.items.map(function (i) { return i.id; }) });
                }
                if (failed.length) {
                  /* Нічого (або не все) не записалось — знімаємо замок, щоб
                     нагорода не згоріла, і кажемо про це вголос. */
                  unmarkClaimed(rec);
                  try { console.error('[sk-rewards] нагорода не збереглась:', failed.join(', ')); } catch (e) {}
                  return { failed: failed, coins: roll.coins, items: built.items, stat: stat, recordId: rec.id };
                }
                return { coins: roll.coins, items: built.items, stat: stat, recordId: rec.id };
              });
            });
          });
        });
      }).catch(function () { return { skipped: true, reason: 'error' }; });
    },

    /* Чи вже забрано нагороду за цей запис (для UI, без видачі). */
    claimed: function (hrefFallback) {
      return waitSK().then(function (ok) {
        if (!ok) return false;
        return findRecord(hrefFallback).then(function (rec) { return rec ? wasClaimed(rec) : false; });
      }).catch(function () { return false; });
    }
  };

  window.SKREWARD = SKREWARD;
})();

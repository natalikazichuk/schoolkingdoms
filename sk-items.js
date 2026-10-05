/* ============================================================
   sk-items.js — рушій предметів для SchoolKingdom (window.SKIT)
   ------------------------------------------------------------
   Адмінка зберігає БАЗОВІ значення речей (каталог IT-XXX).
   Кожен ЕКЗЕМПЛЯР речі в інвентарі героя несе модифікації:

     instance = { uid, id, qty, bonus, durMax, durCur, identified }

   • bonus — випадковий коефіцієнт, кинутий ОДИН раз при отриманні:
       60% → 1.0 (без бонусу)
       20% → 1.1 (+10%)
       10% → 1.2 (+20%)
       10% → 0.9 (−10%)
     Зберігається на екземплярі → застосовується завжди однаково.
   • Значення = round(базове × bonus), але щонайменше ±1 від бази
     (20 спритності × 1.2 = 24; броня 2 × 1.1 = 3). Так само для %.
   • Ціна й міцність теж множаться на bonus.
   • Ціна падає з міцністю: кожні 10% міцності = 10% ціни →
       priceNow = floor(priceWithBonus × durCur/durMax)
   • Відсоткові навички (напр. +5%) сумуються з УСІХ речей, а тоді
     множаться на суму відповідної характеристики:
       (2% + 5%) × (точність героя + плоска точність речей)
   ============================================================ */
(function (root) {
  'use strict';

  // Таблиця бонусів: [коефіцієнт, вага у відсотках]
  var BONUS_TABLE = [
    [1.0, 60],
    [1.1, 20],
    [1.2, 10],
    [0.9, 10]
  ];

  // Український стат → канонічний ключ (як на арені)
  var STAT_MAP = {
    'Броня': 'armor',
    'Магічний захист': 'magicResist',
    'Маг. Резист': 'magicResist',
    'Спритність': 'agility',
    'Магічний урон': 'magicDamage',
    'Маг. Урон': 'magicDamage',
    'Урон': 'damage',
    'Фіз. Урон': 'damage',
    "Здоров'я": 'health',
    'Мана': 'mana',
    'Точність': 'accuracy',
    'Шанс крит. урону': 'critDamage',
    'Шанс блоку': 'block',
    'Оглушить': 'stun',
    'Відновлення здоров\'я': 'healthRegen',
    'Додаткова атака': 'extraAttack',
    'Комірки пояса': 'beltSlots',
    'Маг. Резист ': 'magicResist'
  };
  var FLAG_STATS = ['Дворучний', 'Разовий предмет'];

  function isFlagEntry(e) { return !!(e && (e.flag || FLAG_STATS.indexOf(e.stat) >= 0)); }
  function canon(name) { return STAT_MAP[name] || name; }
  function floor(n) { return Math.floor(n); }

  /* ---- значення характеристики з бонусом ----
     Округлюємо до найближчого (а не вниз), і бонус завжди змінює
     ненульове значення щонайменше на 1 у свій бік: інакше на малих
     числах +10%/+20% «з'їдались» (броня 2 × 1.1 = 2), а −10% ні (2 × 0.9 = 1).
     Однаково для сталих чисел і для відсотків (5% × 1.2 = 6%). */
  function scaleStat(v, f) {
    if (v == null) return null;
    if (!f || f === 1 || v === 0) return v;
    var r = Math.round(v * f);
    if (f > 1 && r <= v) r = v + 1;
    if (f < 1 && r >= v) r = Math.max(v > 0 ? 1 : 0, v - 1); // не до нуля: річ лишається річчю
    return r;
  }

  /* ---- кидок бонусу (один раз при отриманні) ---- */
  function rollBonus(rnd) {
    var r = (typeof rnd === 'number' ? rnd : Math.random()) * 100;
    var acc = 0;
    for (var i = 0; i < BONUS_TABLE.length; i++) {
      acc += BONUS_TABLE[i][1];
      if (r < acc) return BONUS_TABLE[i][0];
    }
    return 1.0;
  }

  var _uid = 0;
  function newUid() { return 'inv_' + Date.now().toString(36) + '_' + (_uid++).toString(36); }

  /* ---- створити екземпляр з базового предмета (кидає бонус) ---- */
  function makeInstance(base, opts) {
    opts = opts || {};
    var bonus = (opts.bonus != null) ? opts.bonus : rollBonus(opts.rnd);
    var durMax = (base && base.durability != null) ? floor(base.durability * bonus) : null;
    var inst = {
      uid: opts.uid || newUid(),
      id: base.id,
      qty: opts.qty || 1,
      bonus: bonus,
      durMax: durMax,
      durCur: (opts.durCur != null ? opts.durCur : durMax),
      identified: !!opts.identified
    };
    if (base && base.consumable) inst.cons = true;   // зілля / сувій: однакові складаються в одну комірку сумки
    return inst;
  }

  /* ---- скільки коштує зараз (з урахуванням бонусу й зносу) ---- */
  function priceWithBonus(base, bonus) { return floor((base.price || 0) * bonus); }
  function priceNow(base, inst) {
    var pb = priceWithBonus(base, inst.bonus);
    if (inst.durMax == null || inst.durMax === 0) return pb;
    var ratio = Math.max(0, Math.min(1, inst.durCur / inst.durMax));
    return floor(pb * ratio);
  }

  /* ---- ефективні (з модифікаціями) значення екземпляра для показу ---- */
  function effective(base, inst) {
    var f = inst.bonus;
    var addStats = (base.addStats || []).map(function (e) {
      if (isFlagEntry(e)) return { stat: e.stat, flag: true };
      return { stat: e.stat, value: scaleStat(e.value, f), pct: !!e.pct };
    });
    return {
      id: base.id,
      name: base.name,
      category: base.category,
      grade: base.grade,
      stat: base.stat,
      valueMin: scaleStat(base.valueMin, f),
      valueMax: scaleStat(base.valueMax, f),
      consumable: !!base.consumable,
      bonus: f,
      durMax: inst.durMax,
      durCur: inst.durCur,
      priceBase: base.price || 0,
      priceWithBonus: priceWithBonus(base, f),
      priceNow: priceNow(base, inst),
      addStats: addStats,
      identified: !!inst.identified
    };
  }

  /* ---- чи показувати додаткові навички (опізнано або є вміння) ---- */
  function canSeeAddStats(inst, hero) {
    if (inst && inst.identified) return true;
    if (hero && (hero.canIdentify || (hero.skills && hero.skills.indexOf('identify') >= 0))) return true;
    return false;
  }

  /* ---- підсумок характеристик героя від вдягнених речей ----
     Правило відсотків: сума % по кожному стату множиться на
     (база героя + плоскі внески). Стати без плоскої бази лишаються
     як чистий відсоток (напр. шанс блоку).
     baseHero: {agility,accuracy,health,mana,armor,magicResist,damage,magicDamage,...}
     items: масив об'єктів base (каталог); instances: відповідні екземпляри */
  function combine(baseHero, items, instances) {
    var flat = {}, pct = {};
    function addFlat(k, v) { flat[k] = (flat[k] || 0) + v; }
    function addPct(k, v) { pct[k] = (pct[k] || 0) + v; }

    // база героя — плоска
    baseHero = baseHero || {};
    Object.keys(baseHero).forEach(function (k) {
      if (typeof baseHero[k] === 'number') addFlat(k, baseHero[k]);
    });

    (items || []).forEach(function (base, i) {
      var inst = (instances && instances[i]) || { bonus: 1 };
      var eff = effective(base, inst);
      // головна характеристика — плоска (для зброї беремо максимум діапазону)
      if (eff.stat && eff.valueMax != null) addFlat(canon(eff.stat), eff.valueMax);
      // додаткові
      eff.addStats.forEach(function (e) {
        if (e.flag || e.value == null) return;
        var k = canon(e.stat);
        if (e.pct) addPct(k, e.value); else addFlat(k, e.value);
      });
    });

    var stats = {}, pctOnly = {};
    var keys = {};
    Object.keys(flat).forEach(function (k) { keys[k] = 1; });
    Object.keys(pct).forEach(function (k) { keys[k] = 1; });
    Object.keys(keys).forEach(function (k) {
      var f = flat[k] || 0, p = pct[k] || 0;
      if (f !== 0) stats[k] = floor(f * (1 + p / 100)); // множимо на суму %
      else if (p !== 0) pctOnly[k] = p;                 // чистий відсоток
    });
    return { stats: stats, pctOnly: pctOnly, _flat: flat, _pct: pct };
  }

  /* ════════════════ СХОВИЩЕ ГЕРОЯ: сумка, скриня, смітник, магазин ════════════════
     Чисті функції над станом героя { inventory, chest, trash, shopSold, coins }.
     firebase-config.js викликає їх усередині транзакції (SK.storeTx), тож
     монети й речі змінюються разом і не затирають одне одного.

     • Сумка — речі без slot (вдягнене й пояс не рахуються), не більше BAG_LIMIT.
       Однакові зілля/сувої (cons, той самий id і бонус) — одна комірка ×qty.
     • Скриня — куди падають нагороди, коли сумка повна: CHEST_LIMIT місць,
       кожна річ лежить CHEST_DAYS доби, потім зникає; що не влізло — зникає одразу.
     • Смітник — викинуті речі; їх можна повернути до півночі (Київ), потім зникають.
     • Магазин — купівля без бонусу, продаж за 1/10 ціни × міцність (не менше 1 сріб),
       викуп проданого за тією самою ціною до півночі.
     • Монети — у сріблі: 100 сріб = 1 зол. */
  var BAG_LIMIT = 100, CHEST_LIMIT = 30, CHEST_DAYS = 3, SHOP_GEAR = 20, SHOP_CONS = 5;
  var DAY_MS = 86400000;

  function kyivDay(ts) {
    var d = new Date(ts == null ? Date.now() : ts);
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
    catch (e) { return d.toISOString().slice(0, 10); }
  }
  function isBag(i) { return i && !i.slot; }
  function bagCount(inv) { return (inv || []).filter(isBag).length; }
  function sameStack(a, b) { return !!(a && b && a.cons && b.cons && a.id === b.id && Number(a.bonus || 1) === Number(b.bonus || 1)); }
  function cloneInst(i) { return JSON.parse(JSON.stringify(i)); }

  /* ціна продажу магазину: 1/10 ціни з бонусом × частка міцності, не менше 1 сріб (за штуку) */
  function sellPrice(base, inst) {
    if (!base) return 1;
    var p = priceWithBonus(base, inst && inst.bonus != null ? inst.bonus : 1);
    var r = 1;
    if (inst && inst.durMax) r = Math.max(0, Math.min(1, Number(inst.durCur != null ? inst.durCur : inst.durMax) / inst.durMax));
    return Math.max(1, floor(p * r / 10));
  }
  function sellTotal(base, inst) { return sellPrice(base, inst) * Math.max(1, Number(inst && inst.qty) || 1); }

  function normState(st) {
    st = st || {};
    return {
      inventory: Array.isArray(st.inventory) ? st.inventory.slice() : [],
      chest: Array.isArray(st.chest) ? st.chest.slice() : [],
      trash: Array.isArray(st.trash) ? st.trash.slice() : [],
      shopSold: Array.isArray(st.shopSold) ? st.shopSold.slice() : [],
      coins: Math.max(0, Math.round(Number(st.coins) || 0))
    };
  }
  /* прибирання за часом: скриня — після CHEST_DAYS діб; смітник і викуп — після півночі */
  function tidy(st, now) {
    st = normState(st); now = now == null ? Date.now() : now;
    var today = kyivDay(now);
    st.chest = st.chest.filter(function (c) { return c && c.inst && (c.until || 0) > now; });
    st.trash = st.trash.filter(function (t) { return t && t.inst && t.day === today; });
    st.shopSold = st.shopSold.filter(function (t) { return t && t.inst && t.day === today; });
    return st;
  }
  /* покласти одну річ у сумку (стопкою, якщо можна); false — нема місця */
  function putBag(st, inst) {
    var i = cloneInst(inst); i.slot = null;
    if (i.cons) {
      for (var k = 0; k < st.inventory.length; k++) {
        var x = st.inventory[k];
        if (isBag(x) && sameStack(x, i)) { x.qty = (Number(x.qty) || 1) + (Number(i.qty) || 1); return true; }
      }
    }
    if (bagCount(st.inventory) >= BAG_LIMIT) return false;
    st.inventory.push(i); return true;
  }
  /* нагороди: у сумку → у скриню → зникає */
  function addItems(st, list, now) {
    st = tidy(st, now); now = now == null ? Date.now() : now;
    var res = { bag: 0, chest: 0, lost: 0 };
    (Array.isArray(list) ? list : [list]).forEach(function (inst) {
      if (!inst || !inst.id) return;
      if (putBag(st, inst)) { res.bag++; return; }
      if (st.chest.length < CHEST_LIMIT) { var c = cloneInst(inst); c.slot = null; st.chest.push({ inst: c, until: now + CHEST_DAYS * DAY_MS }); res.chest++; return; }
      res.lost++;
    });
    return { state: st, result: res };
  }
  function fail(code, msg) { var e = new Error(msg || code); e.code = code; throw e; }
  function takeFrom(arr, uid, get) {
    for (var k = 0; k < arr.length; k++) { var it = get(arr[k]); if (it && it.uid === uid) return arr.splice(k, 1)[0]; }
    return null;
  }
  function claimChest(st, uid, now) {
    st = tidy(st, now);
    var c = takeFrom(st.chest, uid, function (x) { return x.inst; });
    if (!c) fail('gone', 'Річ уже зникла зі скрині');
    if (!putBag(st, c.inst)) fail('full', 'Сумка повна (' + BAG_LIMIT + ')');
    return { state: st };
  }
  function trashItem(st, uid, now) {
    st = tidy(st, now); now = now == null ? Date.now() : now;
    var i = takeFrom(st.inventory, uid, function (x) { return x; });
    if (!i) fail('gone', 'Речі немає в сумці');
    if (i.slot) fail('worn', 'Спершу зніми річ');
    st.trash.push({ inst: i, day: kyivDay(now) });
    return { state: st };
  }
  function restoreTrash(st, uid, now) {
    st = tidy(st, now);
    var t = takeFrom(st.trash, uid, function (x) { return x.inst; });
    if (!t) fail('gone', 'Річ уже зникла зі смітника');
    if (!putBag(st, t.inst)) fail('full', 'Сумка повна (' + BAG_LIMIT + ')');
    return { state: st };
  }
  /* угода магазину: order = { sell:[uid], buy:[base], buyback:[uid] }, byId — каталог.
     Спершу продаж, далі купівля й викуп; не вистачає грошей або місця — угода не відбувається. */
  function deal(st, order, byId, now) {
    st = tidy(st, now); now = now == null ? Date.now() : now;
    order = order || {}; byId = byId || {};
    var today = kyivDay(now), got = 0, spent = 0, bought = [];
    (order.sell || []).forEach(function (uid) {
      var i = takeFrom(st.inventory, uid, function (x) { return x; });
      if (!i) fail('gone', 'Річ для продажу вже не в сумці');
      if (i.slot) fail('worn', 'Продавати можна лише речі із сумки');
      var price = sellTotal(byId[i.id], i);
      got += price; st.coins += price;
      st.shopSold.push({ inst: i, price: price, day: today });
    });
    (order.buyback || []).forEach(function (uid) {
      var t = takeFrom(st.shopSold, uid, function (x) { return x.inst; });
      if (!t) fail('gone', 'Викуп уже недоступний');
      spent += t.price; st.coins -= t.price;
      if (!putBag(st, t.inst)) fail('full', 'Сумка повна (' + BAG_LIMIT + ')');
    });
    (order.buy || []).forEach(function (base) {
      if (!base || !base.id) fail('gone', 'Товару вже немає');
      var price = Math.max(0, Math.round(Number(base.price) || 0));
      spent += price; st.coins -= price;
      var inst = makeInstance(base, { bonus: 1, identified: true });
      if (!putBag(st, inst)) fail('full', 'Сумка повна (' + BAG_LIMIT + ')');
      bought.push(inst);
    });
    if (st.coins < 0) fail('money', 'Не вистачає грошей');
    return { state: st, result: { got: got, spent: spent, bought: bought } };
  }

  /* асортимент магазину на день: випадково з дозволених (active, не noShop),
     той самий для героя протягом доби за Києвом. 20 речей + 5 зілль/сувоїв,
     серед яких завжди є зілля здоров'я. */
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function seeded(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffled(arr, rnd) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function isHealthPotion(b) { return !!(b && b.consumable && (b.addStats || []).some(function (e) { return e && canon(e.stat) === 'healthRegen'; })); }
  function shopStock(catalog, heroId, now) {
    var day = kyivDay(now), rnd = seeded(hashStr(String(heroId || '') + '|' + day));
    var ok = (catalog || []).filter(function (b) { return b && b.id && b.active !== false && !b.noShop && Number(b.price) > 0; });
    var gear = shuffled(ok.filter(function (b) { return !b.consumable; }), rnd).slice(0, SHOP_GEAR);
    var cons = ok.filter(function (b) { return b.consumable; });
    var hp = shuffled(cons.filter(isHealthPotion), rnd).slice(0, 1);
    var rest = shuffled(cons.filter(function (b) { return hp.indexOf(b) < 0; }), rnd).slice(0, SHOP_CONS - hp.length);
    return { day: day, gear: gear, cons: hp.concat(rest) };
  }

  var STORE = {
    BAG_LIMIT: BAG_LIMIT, CHEST_LIMIT: CHEST_LIMIT, CHEST_DAYS: CHEST_DAYS, SHOP_GEAR: SHOP_GEAR, SHOP_CONS: SHOP_CONS,
    kyivDay: kyivDay, bagCount: bagCount, sameStack: sameStack, sellPrice: sellPrice, sellTotal: sellTotal,
    normState: normState, tidy: tidy, addItems: addItems, claimChest: claimChest, trashItem: trashItem,
    restoreTrash: restoreTrash, deal: deal, shopStock: shopStock, isHealthPotion: isHealthPotion
  };

  var SKIT = {
    BONUS_TABLE: BONUS_TABLE,
    STAT_MAP: STAT_MAP,
    FLAG_STATS: FLAG_STATS,
    isFlagEntry: isFlagEntry,
    canon: canon,
    rollBonus: rollBonus,
    makeInstance: makeInstance,
    priceNow: priceNow,
    priceWithBonus: priceWithBonus,
    effective: effective,
    canSeeAddStats: canSeeAddStats,
    combine: combine,
    scaleStat: scaleStat,
    newUid: newUid,
    store: STORE
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SKIT;
  root.SKIT = SKIT;
})(typeof window !== 'undefined' ? window : this);

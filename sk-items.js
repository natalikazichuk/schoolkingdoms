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
    'Страх': 'fear',
    'Барєр': 'barrier',
    "Бар'єр": 'barrier',
    'Антидот': 'antidote',
    'Оглушення': 'stun',
    'Маг. Резист ': 'magicResist'
  };
  var FLAG_STATS = ['Дворучний', 'Разовий предмет'];

  /* ---- вид зброї і тип урону (поля речі weaponType / dmgType) ----
     Вид зброї потрібен для вмінь класів («Меч», «Кинджал»… — sk-skills.js).
     Тип урону — як захист в Аладоні: від уколу, рубки, удару й магії.
     dmg — тип урону, який підставляється для виду за замовчуванням
     (посох — тупий, але з головною характеристикою «Магічний урон» — магічний).
     На арені поки не діють: лише розмітка каталогу. */
  var WEAPON_TYPES = [
    { key: 'sword',    label: 'Меч',          icon: '⚔️', dmg: 'slash',  hint: 'мечі, шаблі' },
    { key: 'dagger',   label: 'Кинджал',      icon: '🗡️', dmg: 'pierce', hint: 'кинджали, ножі' },
    { key: 'axe',      label: 'Сокира',       icon: '🪓', dmg: 'slash',  hint: 'сокири, топірці' },
    { key: 'mace',     label: 'Булава',       icon: '🔨', dmg: 'bash',   hint: 'булави, молоти, дубини, киянки' },
    { key: 'flail',    label: 'Кистень',      icon: '⛓️', dmg: 'bash',   hint: 'кистені, ціпи' },
    { key: 'spear',    label: 'Спис',         icon: '🔱', dmg: 'pierce', hint: 'списи, вила, алебарди' },
    { key: 'whip',     label: 'Кнут',         icon: '➰', dmg: 'slash',  hint: 'кнути, батоги, плетки' },
    { key: 'staff',    label: 'Посох',        icon: '🦯', dmg: 'bash',   hint: 'посохи, палиці' },
    { key: 'wand',     label: 'Жезл',         icon: '🪄', dmg: 'magic',  hint: 'жезли, чарівні палички, указки' },
    { key: 'knuckles', label: 'Кастет',       icon: '👊', dmg: 'bash',   hint: 'кастети, бойові рукавиці' },
    { key: 'bow',      label: 'Лук',          icon: '🏹', dmg: 'pierce', hint: 'луки, рогатки, пращі' },
    { key: 'exotic',   label: 'Екзотична',    icon: '🌀', dmg: 'bash',   hint: 'незвичайна зброя: ложка, парасолька…' }
  ];
  var DMG_TYPES = [
    { key: 'pierce', label: 'Колючий',  icon: '📌' },
    { key: 'slash',  label: 'Рублячий', icon: '🪚' },
    { key: 'bash',   label: 'Тупий',    icon: '🪨' },
    { key: 'magic',  label: 'Магічний', icon: '✨' }
  ];
  function weaponType(key) { for (var i = 0; i < WEAPON_TYPES.length; i++) if (WEAPON_TYPES[i].key === key) return WEAPON_TYPES[i]; return null; }
  function dmgType(key) { for (var i = 0; i < DMG_TYPES.length; i++) if (DMG_TYPES[i].key === key) return DMG_TYPES[i]; return null; }
  /* тип урону за замовчуванням для виду; зброя з головною «Магічний урон» — магічна */
  function defaultDmgType(wKey, mainStat) {
    if (mainStat && canon(mainStat) === 'magicDamage') return 'magic';
    var w = weaponType(wKey); return w ? w.dmg : null;
  }

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
       викуп проданого за тією самою ціною до півночі (не більше SHOP_SOLD_LIMIT останніх
       проданих — найстаріше зникає). Стопку зілль можна продати частково. Кожного товару — 1 шт.:
       куплене сьогодні (shopBought, id речі) до півночі за Києвом більше не продається.
     • Монети — у сріблі: 100 сріб = 1 зол. */
  var BAG_LIMIT = 100, CHEST_LIMIT = 30, CHEST_DAYS = 3, SHOP_GEAR = 20, SHOP_CONS = 5, SHOP_SOLD_LIMIT = 20;
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

  /* Один слот — одна річ. Старі дані могли мати дві речі з тим самим slot
     (напр. два шоломи): інвентар показував першу, а бій рахував обидві.
     Лишаємо першу, решту повертаємо в сумку. */
  function normSlots(inv) {
    var seen = {};
    return (inv || []).map(function (i) {
      if (!i || !i.slot) return i;
      if (seen[i.slot]) { var c = cloneInst(i); c.slot = null; return c; }
      seen[i.slot] = true; return i;
    });
  }
  function normState(st) {
    st = st || {};
    return {
      inventory: normSlots(Array.isArray(st.inventory) ? st.inventory : []),
      chest: Array.isArray(st.chest) ? st.chest.slice() : [],
      trash: Array.isArray(st.trash) ? st.trash.slice() : [],
      shopSold: Array.isArray(st.shopSold) ? st.shopSold.slice() : [],
      shopBought: Array.isArray(st.shopBought) ? st.shopBought.slice() : [],
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
    st.shopBought = st.shopBought.filter(function (t) { return t && t.id && t.day === today; });
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
  /* скільки штук товару куплено сьогодні (кожна куплена штука — окремий запис) */
  function boughtCount(st, id) { return (st.shopBought || []).filter(function (t) { return t && t.id === id; }).length; }
  /* товар магазину вже куплено сьогодні повністю (limit — скільки штук було в наявності, типово 1) */
  function boughtToday(st, id, limit) { return boughtCount(st, id) >= Math.max(1, limit || 1); }
  /* угода магазину: order = { sell:[uid | {uid, qty}], buy:[base], buyback:[uid], limit:{id: штук у наявності} }, byId — каталог.
     sell {uid, qty} — продати qty штук зі стопки (решта лишається в сумці); просто uid — усю річ / стопку.
     Один товар можна купити кілька разів, доки є в наявності (limit; немає — 1 шт.).
     Спершу продаж, далі купівля й викуп; не вистачає грошей або місця — угода не відбувається. */
  function deal(st, order, byId, now) {
    st = tidy(st, now); now = now == null ? Date.now() : now;
    order = order || {}; byId = byId || {};
    var today = kyivDay(now), got = 0, spent = 0, bought = [];
    (order.sell || []).forEach(function (e) {
      var uid = (e && typeof e === 'object') ? e.uid : e, n = (e && typeof e === 'object') ? Math.floor(Number(e.qty) || 0) : 0;
      var src = null;
      for (var k = 0; k < st.inventory.length; k++) if (st.inventory[k] && st.inventory[k].uid === uid) { src = st.inventory[k]; break; }
      if (!src) fail('gone', 'Річ для продажу вже не в сумці');
      if (src.slot) fail('worn', 'Продавати можна лише речі із сумки');
      var have = Math.max(1, Number(src.qty) || 1), i;
      if (n > have) fail('gone', 'У стопці вже менше речей, ніж на прилавку');
      if (n > 0 && n < have) { src.qty = have - n; i = cloneInst(src); i.uid = newUid(); i.qty = n; }   // частина стопки
      else i = takeFrom(st.inventory, uid, function (x) { return x; });
      var price = sellTotal(byId[i.id], i);
      got += price; st.coins += price;
      st.shopSold.push({ inst: i, price: price, day: today });
    });
    while (st.shopSold.length > SHOP_SOLD_LIMIT) st.shopSold.shift();   // викуп — лише останні SHOP_SOLD_LIMIT
    (order.buyback || []).forEach(function (uid) {
      var t = takeFrom(st.shopSold, uid, function (x) { return x.inst; });
      if (!t) fail('gone', 'Викуп уже недоступний');
      spent += t.price; st.coins -= t.price;
      if (!putBag(st, t.inst)) fail('full', 'Сумка повна (' + BAG_LIMIT + ')');
    });
    (order.buy || []).forEach(function (base) {
      if (!base || !base.id) fail('gone', 'Товару вже немає');
      var lim = (order.limit && order.limit[base.id]) || 1;
      if (boughtToday(st, base.id, lim)) fail('sold', '«' + (base.name || base.id) + '» сьогодні вже розкуплено — новий товар з’явиться опівночі');
      st.shopBought.push({ id: base.id, day: today });
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
  function isHealthPotion(b) { return !!(b && b.consumable && (b.addStats || []).some(function (e) { return e && canon(e.stat) === 'healthRegen'; })); }
  function isManaPotion(b) {
    return !!(b && b.consumable && ((b.stat && canon(b.stat) === 'mana') ||
      (b.addStats || []).some(function (e) { return e && canon(e.stat) === 'mana'; })));
  }
  /* скільки штук разового товару в наявності за день:
     зілля здоров'я й мани — 3–10, свитки — 1–5, решта — 1 */
  var SHOP_QTY = { potion: [3, 10], scroll: [1, 5] };
  function consQty(b, rnd) {
    var r = (isHealthPotion(b) || isManaPotion(b)) ? SHOP_QTY.potion : (b && b.category === 'Свиток') ? SHOP_QTY.scroll : null;
    return r ? r[0] + Math.floor(rnd() * (r[1] - r[0] + 1)) : 1;
  }
  /* Порядок товарів — за «жеребом» кожної речі (хеш героя, дня й id), а не перемішуванням
     усього списку: заборонили чи вимкнули одну річ — на її місце стає одна наступна,
     решта набору не змінюється. */
  function shopStock(catalog, heroId, now) {
    var day = kyivDay(now), key = String(heroId || '') + '|' + day;
    var lot = {};
    var ranked = function (arr) {
      return arr.slice().sort(function (a, b) {
        var x = lot[a.id] != null ? lot[a.id] : (lot[a.id] = hashStr(key + '|' + a.id));
        var y = lot[b.id] != null ? lot[b.id] : (lot[b.id] = hashStr(key + '|' + b.id));
        return x - y || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
      });
    };
    var ok = (catalog || []).filter(function (b) { return b && b.id && b.active !== false && !b.noShop && Number(b.price) > 0; });
    var gear = ranked(ok.filter(function (b) { return !b.consumable; })).slice(0, SHOP_GEAR);
    var cons = ok.filter(function (b) { return b.consumable; });
    // завжди є зілля здоров'я і (якщо є в каталозі) зілля мани
    var hp = ranked(cons.filter(isHealthPotion)).slice(0, 1);
    var mp = ranked(cons.filter(function (b) { return isManaPotion(b) && hp.indexOf(b) < 0; })).slice(0, 1);
    var must = hp.concat(mp);
    var rest = ranked(cons.filter(function (b) { return must.indexOf(b) < 0; })).slice(0, Math.max(0, SHOP_CONS - must.length));
    var list = must.concat(rest), qty = {};
    // кількість — теж від «жеребу» речі, щоб не залежала від решти набору
    list.forEach(function (b) { qty[b.id] = consQty(b, seeded(hashStr(key + '|qty|' + b.id))); });
    gear.forEach(function (b) { qty[b.id] = 1; });
    return { day: day, gear: gear, cons: list, qty: qty };
  }

  /* ── СУМКА: одне правило для спорядження й магазину ──
     bagView(state, byId, opts) розкладає інвентар так само, як його бачить
     гардероб: одна річ на слот і лише своєї категорії; дворучна зброя
     знімає річ з лівої руки; у комірках пояса — лише разові речі (зілля,
     сувої) і не більше комірок, ніж дає вдягнений пояс. Решта — у сумці.
     Речі, яких немає в каталозі, — у missing (їх не чіпаємо).
     opts: { dualWield, isTwoHanded(base) } — з правил арени (SKARENA).
     Повертає { equip:{slot:inst}, belt:[inst|null], bag:[inst], missing:[id],
                inventory: виправлений список (копія), fixed: чи щось виправлено }. */
  var SLOT_CATS = {
    helmet: ['Шоломи'], armor: ['Обладунки'], gloves: ['Рукавиці'], bracers: ['Наручі'], belt: ['Пояси'],
    pants: ['Штани'], boots: ['Взуття'], weaponR: ['Зброя'], weaponL: ['Щити'],
    ring1: ['Кільце'], ring2: ['Кільце'], amulet: ['Амулет']
  };
  function slotFits(base, slot, opts) {
    var cats = SLOT_CATS[slot]; if (!cats || !base) return false;
    if (slot === 'weaponL' && opts && opts.dualWield) cats = cats.concat(['Зброя']);
    return cats.indexOf(base.category) >= 0;
  }
  function beltSlotsOf(base, inst) {
    if (!base) return 0;
    var n = 0;
    (effective(base, inst).addStats || []).forEach(function (e) { if (!e.flag && canon(e.stat) === 'beltSlots') n += (Number(e.value) || 0); });
    return Math.max(0, Math.floor(n));
  }
  function bagView(st, byId, opts) {
    opts = opts || {}; byId = byId || {};
    var two = opts.isTwoHanded || function () { return false; };
    var inv = ((st && st.inventory) || []).map(function (i) { return i ? cloneInst(i) : i; });
    var before = inv.map(function (i) { return i ? (i.slot || '') : ''; }).join('|');
    var equip = {}, beltReq = [], bag = [], missing = [];
    inv.forEach(function (i) {
      if (!i || !i.id) return;
      var b = byId[i.id];
      if (!b) { if (missing.indexOf(i.id) < 0) missing.push(i.id); return; }
      if (i.slot && /^belt\d+$/.test(i.slot)) { beltReq.push(i); return; }
      if (i.slot && SLOT_CATS[i.slot] && !equip[i.slot] && slotFits(b, i.slot, opts)) { equip[i.slot] = i; return; }
      i.slot = null; bag.push(i);
    });
    if (equip.weaponR && equip.weaponL && two(byId[equip.weaponR.id])) { equip.weaponL.slot = null; bag.push(equip.weaponL); delete equip.weaponL; }
    var bc = equip.belt ? beltSlotsOf(byId[equip.belt.id], equip.belt) : 0, belt = [];
    for (var k = 0; k < bc; k++) belt.push(null);
    beltReq.forEach(function (i) {
      var idx = parseInt(i.slot.slice(4), 10), b = byId[i.id];
      if (b && b.consumable && idx >= 0 && idx < bc && !belt[idx]) belt[idx] = i;
      else { i.slot = null; bag.push(i); }
    });
    var after = inv.map(function (i) { return i ? (i.slot || '') : ''; }).join('|');
    return { equip: equip, belt: belt, bag: bag, missing: missing, inventory: inv, fixed: before !== after };
  }
  /* виправити старі дані в транзакції (SK.storeTx), а не перезаписом інвентаря */
  function applyView(st, byId, opts) {
    st = normState(st);
    var v = bagView(st, byId, opts);
    st.inventory = v.inventory;
    return { state: st, result: { fixed: v.fixed } };
  }

  /* ── зміни спорядження (вдягнути / зняти / пояс) як «різниця» ──
     Гардероб змінює свою копію інвентаря, а в базу йде лише різниця:
     нові слоти, нова кількість, нові (відділені від стопки) й прибрані речі.
     applyDiff накладає її на СВІЖИЙ інвентар у транзакції — нагорода, що
     прийшла тим часом з іншої вкладки, не губиться. */
  function diffInv(base, next) {
    var b = {}, n = {}, d = { slots: {}, qty: {}, add: [], remove: [] };
    (base || []).forEach(function (i) { if (i && i.uid) b[i.uid] = i; });
    (next || []).forEach(function (i) { if (i && i.uid) n[i.uid] = i; });
    Object.keys(n).forEach(function (u) {
      var x = n[u], o = b[u];
      if (!o) { d.add.push(cloneInst(x)); return; }
      if ((o.slot || null) !== (x.slot || null)) d.slots[u] = x.slot || null;
      if ((Number(o.qty) || 1) !== (Number(x.qty) || 1)) d.qty[u] = Number(x.qty) || 1;
    });
    Object.keys(b).forEach(function (u) { if (!n[u]) d.remove.push(u); });
    // порядок речей у сумці (гравець переставив) — лише коли він змінився
    // (порівнюємо з усім збереженим порядком — щойно знята річ теж має своє місце)
    var no = (next || []).filter(isBag).map(function (i) { return i.uid; });
    var keep = no.filter(function (u) { return b[u]; }), was = (base || []).map(function (i) { return i && i.uid; }).filter(function (u) { return u && no.indexOf(u) >= 0; });
    if (keep.join('|') !== was.join('|')) d.order = no;
    d.empty = !d.add.length && !d.remove.length && !Object.keys(d.slots).length && !Object.keys(d.qty).length && !d.order;
    return d;
  }
  function applyDiff(st, diff) {
    st = normState(st);
    if (!diff || diff.empty) return { state: st, result: { applied: 0 } };
    var have = {};
    st.inventory = st.inventory.filter(function (i) { return !(i && i.uid && diff.remove.indexOf(i.uid) >= 0); });
    st.inventory.forEach(function (i) {
      if (!i || !i.uid) return;
      have[i.uid] = 1;
      if (Object.prototype.hasOwnProperty.call(diff.slots, i.uid)) i.slot = diff.slots[i.uid];
      if (Object.prototype.hasOwnProperty.call(diff.qty, i.uid)) i.qty = diff.qty[i.uid];
    });
    (diff.add || []).forEach(function (i) { if (i && i.uid && !have[i.uid]) st.inventory.push(cloneInst(i)); });
    /* новий порядок сумки: речі з diff.order займають ті самі позиції, що й займали, але в новій
       черговості; решта (вдягнене, нове з іншої вкладки) лишається на своїх місцях */
    if (Array.isArray(diff.order) && diff.order.length) {
      var pos = {}; diff.order.forEach(function (u, k) { pos[u] = k; });
      var at = [], items = [];
      st.inventory.forEach(function (i, k) { if (i && i.uid && !i.slot && pos[i.uid] != null) { at.push(k); items.push(i); } });
      items.sort(function (a, b) { return pos[a.uid] - pos[b.uid]; });
      at.forEach(function (k, j) { st.inventory[k] = items[j]; });
    }
    st.inventory = normSlots(st.inventory);
    return { state: st, result: { applied: 1 } };
  }

  /* ── ПЛИТКА РЕЧІ: однаковий вигляд у гардеробі, магазині, скрині ──
     tile(base, inst, opts) → { cls, html }: картинка (без неї — емодзі
     категорії), «×N» для стопки, смужка міцності; cls — колір бонусу
     (b20 золото, b10 срібло, bm10 сіре). opts.root — шлях до кореня сайту. */
  var CAT_EMO = { 'Шоломи': '⛑️', 'Обладунки': '🥋', 'Рукавиці': '🧤', 'Наручі': '🦾', 'Пояси': '🪢', 'Штани': '👖', 'Взуття': '👢',
    'Зброя': '⚔️', 'Щити': '🛡️', 'Кільце': '💍', 'Амулет': '📿', 'Зелья': '🧪', 'Свиток': '📜' };
  function bonusCls(b) { b = Number(b == null ? 1 : b); return b > 1.15 ? 'b20' : (b > 1 ? 'b10' : (b < 1 ? 'bm10' : '')); }
  /* картинки, яких немає на сервері: після першого 404 більше не просимо їх
     (до кінця сесії) — інакше кожна перемальовка дає нову червону помилку в Console */
  var IMG_MISS = {};
  try { IMG_MISS = JSON.parse(sessionStorage.getItem('sk_img_miss') || '{}') || {}; } catch (e) {}
  function imgMissing(src) { return !!IMG_MISS[src]; }
  function imgMissed(src) { if (!src) return; IMG_MISS[src] = 1; try { sessionStorage.setItem('sk_img_miss', JSON.stringify(IMG_MISS)); } catch (e) {} }
  function tile(base, inst, opts) {
    opts = opts || {}; inst = inst || {};
    var id = (base && base.id) || inst.id || '', em = CAT_EMO[base && base.category] || '🎒';
    var src = (opts.root || '') + 'img/items/' + encodeURIComponent(id) + '.webp';
    var h = imgMissing(src) ? '<span class="skt-ic">' + em + '</span>'
      : '<span class="skt-ic"><img src="' + src + '" alt="" draggable="false"'
      + ' onerror="window.SKIT&&SKIT.imgMissed(this.getAttribute(\'src\'));this.replaceWith(document.createTextNode(\'' + em + '\'))"></span>';
    var q = Number(inst.qty) || 1;
    if (q > 1) h += '<span class="skt-q">×' + q + '</span>';
    if (inst.durMax) {
      var r = Math.max(0, Math.min(1, Number(inst.durCur != null ? inst.durCur : inst.durMax) / inst.durMax));
      h += '<span class="skt-dur' + (r <= 0 ? ' zero' : (r <= 0.2 ? ' low' : '')) + '" title="Міцність ' + Math.round(r * 100) + '%"><i style="width:' + Math.round(r * 100) + '%"></i></span>';
    }
    return { cls: 'skt ' + bonusCls(inst.bonus), html: h };
  }

  var STORE = {
    BAG_LIMIT: BAG_LIMIT, SHOP_SOLD_LIMIT: SHOP_SOLD_LIMIT, CHEST_LIMIT: CHEST_LIMIT, CHEST_DAYS: CHEST_DAYS, SHOP_GEAR: SHOP_GEAR, SHOP_CONS: SHOP_CONS,
    kyivDay: kyivDay, bagCount: bagCount, sameStack: sameStack, sellPrice: sellPrice, sellTotal: sellTotal,
    normState: normState, normSlots: normSlots, tidy: tidy, addItems: addItems, claimChest: claimChest, trashItem: trashItem,
    restoreTrash: restoreTrash, deal: deal, boughtToday: boughtToday, boughtCount: boughtCount, SHOP_QTY: SHOP_QTY, isManaPotion: isManaPotion,
    SLOT_CATS: SLOT_CATS, slotFits: slotFits, bagView: bagView, applyView: applyView, diffInv: diffInv, applyDiff: applyDiff, shopStock: shopStock, isHealthPotion: isHealthPotion
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
    CAT_EMO: CAT_EMO,
    WEAPON_TYPES: WEAPON_TYPES,
    DMG_TYPES: DMG_TYPES,
    weaponType: weaponType,
    dmgType: dmgType,
    defaultDmgType: defaultDmgType,
    bonusCls: bonusCls,
    tile: tile,
    imgMissing: imgMissing,
    imgMissed: imgMissed,
    store: STORE
  };

  /* ── монети: 100 сріб = 1 зол. coinsHtml — золоті золотим, срібні сріблом, між ними відступ.
     opts.words === false — без «зол/сріб» (тісне місце, напр. хедер). Стилі (.skc) додаються самі. */
  function coinParts(v) { v = Math.max(0, Math.round(Number(v) || 0)); return { g: Math.floor(v / 100), s: v % 100 }; }
  function coinsText(v) { var c = coinParts(v), o = []; if (c.g) o.push(c.g + ' зол'); if (c.s || !c.g) o.push(c.s + ' сріб'); return o.join(' '); }
  function coinCss() {
    if (typeof document === 'undefined' || document.getElementById('skc-css')) return;
    var st = document.createElement('style'); st.id = 'skc-css';
    st.textContent = '.skc{display:inline-flex;align-items:center;gap:.28em;white-space:nowrap;font-weight:900}'
      + '.skc+.skc{margin-left:.6em}'
      + '.skc i{display:inline-block;flex:none;width:.95em;height:.95em;border-radius:50%;box-shadow:inset 0 -1px 0 rgba(0,0,0,.35),0 0 0 1px rgba(0,0,0,.3)}'
      + '.skc.g{color:#ffd54a}.skc.g i{background:radial-gradient(circle at 35% 30%,#fff6c2 0,#f2c230 45%,#a8770a 100%)}'
      + '.skc.s{color:#dde3ec}.skc.s i{background:radial-gradient(circle at 35% 30%,#ffffff 0,#c9d1dc 45%,#7c8696 100%)}';
    (document.head || document.documentElement).appendChild(st);
  }
  function coinsHtml(v, opts) {
    coinCss();
    var c = coinParts(v), w = !(opts && opts.words === false), o = [];
    if (c.g) o.push('<span class="skc g"><i></i>' + c.g + (w ? ' зол' : '') + '</span>');
    if (c.s || !c.g) o.push('<span class="skc s"><i></i>' + c.s + (w ? ' сріб' : '') + '</span>');
    return o.join('');
  }
  SKIT.coinsText = coinsText; SKIT.coinsHtml = coinsHtml; SKIT.coinCss = coinCss;

  if (typeof module !== 'undefined' && module.exports) module.exports = SKIT;
  root.SKIT = SKIT;
})(typeof window !== 'undefined' ? window : this);

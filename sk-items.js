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
   • Значення = floor(базове × bonus). (20 спритності × 1.2 = 24)
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
    return {
      uid: opts.uid || newUid(),
      id: base.id,
      qty: opts.qty || 1,
      bonus: bonus,
      durMax: durMax,
      durCur: (opts.durCur != null ? opts.durCur : durMax),
      identified: !!opts.identified
    };
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
      return { stat: e.stat, value: (e.value != null ? floor(e.value * f) : null), pct: !!e.pct };
    });
    return {
      id: base.id,
      name: base.name,
      category: base.category,
      grade: base.grade,
      stat: base.stat,
      valueMin: (base.valueMin != null ? floor(base.valueMin * f) : null),
      valueMax: (base.valueMax != null ? floor(base.valueMax * f) : null),
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
    newUid: newUid
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SKIT;
  root.SKIT = SKIT;
})(typeof window !== 'undefined' ? window : this);

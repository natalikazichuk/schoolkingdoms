/* ============================================================
   sk-arena-rules.js — правила бою на арені (window.SKARENA).
   ------------------------------------------------------------
   ОДНЕ джерело чисел механіки. Його читають:
     • arena.html        — бій (урон, крит, ухилення, блок, знос речей);
     • admin-arena.html  — вкладка «Механіка», щоб бачити, за якими
                           числами зараз працює бій.
   Міняєш баланс — міняй тут, обидві сторінки підхоплять. Після зміни
   підніми ?v= у <script src="sk-arena-rules.js?v=…"> на обох сторінках,
   інакше браузер триматиме стару копію.
   ============================================================ */
(function (root) {
  'use strict';

  /* ── бій ──
     УРОН одного удару (рахується для КОЖНОГО удару окремо):
       1) фізичний = baseDmg + урон зброї (випадково з її діапазону) + сталий «Урон» речей
          магічний  = магічний урон зброї (діапазон) + сталий «Маг. урон» речей
       2) фізичний − броня захисника, магічний − магічний захист (не нижче 0)
       3) × відсоткові підвищення з речей (+N% урону / +N% маг. урону)
       4) крит: шанс = точність / critChance + «Шанс крит. урону» речей → × critMult
       5) влучив? шанс = hitBase × точність / спритність захисника, в межах [hitMin; hitMax]
       6) удар у заблоковану зону проходить на blockKeep
       Влучний удар завдає щонайменше minDmg.
     Ударів за хід = 1 + «Додаткова атака» з речей. */
  var BATTLE = {
    turnSeconds: 30,   // секунд на хід
    baseDmg: 10,       // базовий фізичний урон удару
    minDmg: 1,         // мінімум урону влучного удару (навіть крізь велику броню)
    critChance: 280,   // шанс криту = точність / critChance (менше = частіше)
    critMult: 2,       // крит множить урон
    hitBase: 0.5,      // точність = спритність → 50% влучити
    hitMin: 0.20,      // шанс влучити не нижче
    hitMax: 0.95,      // і не вище
    blockKeep: 0.30,   // скільки урону проходить крізь блок (мінімум 1)
    botVary: 0.20,     // суперник: ±20% від показників Героя
    xpWin: 25,         // досвід за перемогу
    xpLose: 8,         // досвід за поразку / нічию
    xpPerLvl: 120      // досвіду на рівень = рівень × xpPerLvl
  };

  /* ── зони удару → слоти екіпіровки, які її закривають ──
     Ключі слотів — як у EQUIP в arena.html (inst.slot у інвентарі). */
  var ZONES = [
    { key: 'head', label: 'Голова', slots: ['helmet', 'amulet'] },
    { key: 'body', label: 'Тіло',   slots: ['armor', 'belt'] },
    { key: 'arms', label: 'Руки',   slots: ['gloves', 'bracers', 'ring1', 'ring2'] },
    { key: 'legs', label: 'Ноги',   slots: ['pants', 'boots'] }
  ];
  var HAND_SLOTS = ['weaponR', 'weaponL'];   // зброя або щит — за категорією речі

  /* ── знос (міцність) речей за бій ──
     • пропущений удар у зону (не ухилився, не заблокував) — ВСІ речі
       цієї зони втрачають zoneHit, а від критичного — zoneCrit;
     • заблокований удар забирає щит: shieldBlock, критичний — shieldCritBlock
       (речі зони тоді не зношуються — удар прийняв щит);
     • зброя втрачає weaponHit за кожен свій влучний удар; критичний
       удар знос зброї не підвищує (weaponCrit = weaponHit). */
  var WEAR = {
    zoneHit: 1,
    zoneCrit: 2,
    weaponHit: 1,
    weaponCrit: 1,
    shieldBlock: 2,
    shieldCritBlock: 5
  };

  var SLOT_UK = {
    helmet: 'Шолом', amulet: 'Амулет', armor: 'Обладунки', belt: 'Пояс',
    gloves: 'Рукавиці', bracers: 'Наручі', ring1: 'Кільце 1', ring2: 'Кільце 2',
    pants: 'Штани', boots: 'Взуття', weaponR: 'Права рука', weaponL: 'Ліва рука'
  };

  function zoneOfSlot(slot) {
    for (var i = 0; i < ZONES.length; i++) if (ZONES[i].slots.indexOf(slot) >= 0) return ZONES[i].key;
    return null;
  }

  /* ── бойовий профіль бійця ──
     stats   — характеристики Героя {health, accuracy, agility, ...};
     equipped — [{base, inst}] вдягнені речі (inst.slot); зламані (durCur 0) не діють;
     skit    — window.SKIT (бонус речі, канонічні назви).
     Головна характеристика зброї в руках («Урон» / «Магічний урон») — діапазон
     удару; решта — сталі числа або відсотки (+N% множить суму Героя й речей). */
  function num(v) { v = Number(v); return isNaN(v) ? 0 : v; }
  function fighter(stats, equipped, skit) {
    stats = stats || {};
    var flat = {}, pct = {}, p = { wMin: 0, wMax: 0, magMin: 0, magMax: 0 };
    function add(o, k, v) { o[k] = (o[k] || 0) + num(v); }
    (equipped || []).forEach(function (e) {
      if (!e || !e.base || !e.inst) return;
      if (e.inst.durMax != null && num(e.inst.durCur) <= 0 && e.inst.durCur != null) return;   // зламана річ
      var eff = skit.effective(e.base, e.inst);
      var hand = HAND_SLOTS.indexOf(e.inst.slot) >= 0;
      if (eff.stat && eff.valueMax != null) {
        var k = skit.canon(eff.stat), lo = num(eff.valueMin != null ? eff.valueMin : eff.valueMax), hi = num(eff.valueMax);
        if (hand && k === 'damage') { p.wMin += lo; p.wMax += hi; }
        else if (hand && k === 'magicDamage') { p.magMin += lo; p.magMax += hi; }
        else add(flat, k, hi);
      }
      eff.addStats.forEach(function (a) {
        if (a.flag || a.value == null) return;
        add(a.pct ? pct : flat, skit.canon(a.stat), a.value);
      });
    });
    function tot(k) { return Math.round((num(stats[k]) + (flat[k] || 0)) * (1 + (pct[k] || 0) / 100)); }
    p.hp = Math.max(1, tot('health'));
    p.accuracy = Math.max(1, tot('accuracy'));
    p.agility = Math.max(1, tot('agility'));
    p.armor = Math.max(0, tot('armor'));
    p.magicResist = Math.max(0, tot('magicResist'));
    p.dmgFlat = flat.damage || 0;
    p.magFlat = flat.magicDamage || 0;
    p.dmgPct = pct.damage || 0;
    p.magPct = pct.magicDamage || 0;
    p.critPct = (pct.critDamage || 0) + (flat.critDamage || 0);
    p.extra = Math.max(0, Math.floor(flat.extraAttack || 0));
    return p;
  }

  /* суперник: той самий профіль ±vary (кожне число окремо) */
  function varyFighter(p, vary, rnd) {
    rnd = rnd || Math.random; vary = vary == null ? BATTLE.botVary : vary;
    var o = {};
    Object.keys(p).forEach(function (k) {
      var v = p[k];
      if (k === 'extra') { o[k] = v; return; }
      o[k] = Math.max(k === 'hp' || k === 'accuracy' || k === 'agility' ? 1 : 0, Math.round(v * (1 - vary + rnd() * 2 * vary)));
    });
    if (o.wMax < o.wMin) o.wMax = o.wMin;
    if (o.magMax < o.magMin) o.magMax = o.magMin;
    return o;
  }

  function rollRange(lo, hi, rnd) { lo = num(lo); hi = num(hi); if (hi <= lo) return lo; return lo + Math.floor(rnd() * (hi - lo + 1)); }
  function hitChance(att, def) {
    var c = BATTLE.hitBase * num(att.accuracy) / Math.max(1, num(def.agility));
    return Math.max(BATTLE.hitMin, Math.min(BATTLE.hitMax, c));
  }
  function critChance(att) { return num(att.accuracy) / BATTLE.critChance + num(att.critPct) / 100; }

  /* Один удар: {dmg, kind:'hit'|'crit'|'block'|'dodge', crit, calc} */
  function strike(att, def, blocked, rnd) {
    rnd = rnd || Math.random;
    var w = rollRange(att.wMin, att.wMax, rnd), m = rollRange(att.magMin, att.magMax, rnd);
    var physRaw = BATTLE.baseDmg + w + num(att.dmgFlat), magRaw = m + num(att.magFlat);
    var phys = Math.max(0, physRaw - num(def.armor)) * (1 + num(att.dmgPct) / 100);
    var mag = Math.max(0, magRaw - num(def.magicResist)) * (1 + num(att.magPct) / 100);
    var crit = rnd() < critChance(att);
    var dmg = (phys + mag) * (crit ? BATTLE.critMult : 1);
    var calc = '(' + physRaw + ' − броня ' + num(def.armor) + ')' + (att.dmgPct ? ' × ' + (100 + num(att.dmgPct)) + '%' : '')
      + (magRaw ? ' + (маг. ' + magRaw + ' − захист ' + num(def.magicResist) + ')' + (att.magPct ? ' × ' + (100 + num(att.magPct)) + '%' : '') : '')
      + (crit ? ' × ' + BATTLE.critMult + ' крит' : '');
    if (rnd() >= hitChance(att, def)) return { dmg: 0, kind: 'dodge', crit: false, calc: 'промах (шанс ' + Math.round(hitChance(att, def) * 100) + '%)' };
    dmg = Math.max(BATTLE.minDmg, Math.round(dmg));
    if (blocked) return { dmg: Math.max(1, Math.round(dmg * BATTLE.blockKeep)), kind: 'block', crit: crit, calc: calc + ' → блок ' + Math.round(BATTLE.blockKeep * 100) + '%' };
    return { dmg: dmg, kind: crit ? 'crit' : 'hit', crit: crit, calc: calc };
  }

  /* Атака за хід: 1 + extra ударів, кожен окремо. Підсумок — для показу. */
  function attack(att, def, blocked, rnd) {
    var n = 1 + Math.max(0, Math.floor(num(att.extra))), hits = [], dmg = 0;
    for (var i = 0; i < n; i++) { var h = strike(att, def, blocked, rnd); hits.push(h); dmg += h.dmg; }
    var kinds = hits.map(function (h) { return h.kind; });
    var kind = kinds.indexOf('crit') >= 0 ? 'crit' : kinds.indexOf('hit') >= 0 ? 'hit' : kinds.indexOf('block') >= 0 ? 'block' : 'dodge';
    return { dmg: dmg, kind: kind, crit: hits.some(function (h) { return h.crit; }), hits: hits };
  }

  root.SKARENA = {
    BATTLE: BATTLE, ZONES: ZONES, HAND_SLOTS: HAND_SLOTS, WEAR: WEAR,
    SLOT_UK: SLOT_UK, zoneOfSlot: zoneOfSlot,
    fighter: fighter, varyFighter: varyFighter, hitChance: hitChance, critChance: critChance,
    strike: strike, attack: attack
  };
})(typeof window !== 'undefined' ? window : this);

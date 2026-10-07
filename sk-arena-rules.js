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
     Кожен УДАР рахується окремо, по черзі:
       1) влучив? r = точність нападника / спритність захисника, рівні → 1 − hitStep (75%).
          • спритність більша (r < 1): шанс = 1 − hitStep / r   (×2 → 50%, ×3 → 25%, ×3.6+ → hitMin)
          • точність більша (r ≥ 1):  шанс = 75% + hitAccStep × (r − 1)   (×1.5 → 80%, ×2 → 85%, ×3+ → hitMax)
          Підсумок — у межах [hitMin; hitMax]
          (кидок 🎲 d100: випало ≤ шансу у % — влучив). Промах → 0, далі не рахуємо.
       2) заблокував? удар у зону, яку захищає суперник, — блок (щит приймає удар):
          проходить blockKeep (0 — нічого). Кидок на крит робиться лише для зносу щита.
       3) урон: ТИП визначає зброя в руках. Без зброї — лише база baseDmg (8);
          зі зброєю — база + кидок 🎲 у діапазоні зброї (база 8 + киянка 3–12 → 11–20).
          Магічна зброя → увесь удар магічний (і база теж): baseDmg + маг. зброя + «Маг. урон» речей.
          Без зброї / фізична → увесь удар фізичний: baseDmg + зброя + «Урон» речей.
       4) захист — СПІВВІДНОШЕННЯМ, як точність і спритність (armorPass):
          r = сирий урон / броня (магічний удар — / магічний захист).
          • рівні (r = 1) — проходить armorEven (50%);
          • удар сильніший (r ≥ 1): 50% + armorStep (10%) за кожен «раз» переваги
            (×2 → 60%, ×3 → 70% …), не більше armorMax (95%);
          • захист сильніший (r < 1): 50% × r (захист удвічі сильніший → 25%),
            не менше armorMin (25%) — удар завжди щось завдає;
          • захисту немає — проходить 100%.
       5) × відсотки з речей свого типу (+N% маг. урону / +N% урону)
       6) крит: шанс = critBase% + «Шанс крит. урону» речей (і вмінь) → × critMult
       Між 2) і 3): удар у НЕзахищену зону ще можна заблокувати «Шансом блоку» з речей
       (blockPhys — для фізичних ударів, blockMag — для магічних; тип — за головною
       характеристикою речі, див. blockKind).
          (кидок 🎲 d100: випало ≤ шансу у % — крит)
       Влучний (не заблокований) удар завдає щонайменше minDmg.
     Ударів за хід = 1 + «Додаткова атака» з речей.

     Спецвміння ходу: за хід можна виконати swapsPerTurn спецвмінь. Зараз єдине —
     ПЕРЕВДЯГАННЯ: замінити або зняти одну річ (крім пояса та його комірок).
     Діє одразу в цьому ході; базові атака й захист і пасивні ефекти лишаються.
     Річ на здоров'я / ману міняє лише МАКСИМУМ, поточне здоров'я не додається
     (знята річ обрізає поточне до нового максимуму).

     Бот отримує ВИПАДКОВІ речі: на кожен слот, де в Героя є річ, — річ тієї ж
     категорії з каталогу, сума характеристик якої в межах ±botItemVary від речі
     Героя (немає такої — найближча за силою). Його базові показники — Героя ±botVary. */
  var BATTLE = {
    turnSeconds: 30,   // секунд на хід
    baseDmg: 8,        // базовий урон удару (без зброї — лише він)
    minDmg: 1,         // мінімум урону влучного удару (навіть крізь велику броню)
    critBase: 1,       // базовий шанс криту, % (далі — речі й уміння Героя)
    critMult: 2,       // крит множить урон
    hitStep: 0.25,     // −25% шансу за кожну одиницю «спритність / точність» (рівні → 75%)
    hitAccStep: 0.10,  // +10% шансу за кожен «раз» переваги точності над спритністю
    hitMin: 0.10,      // шанс влучити не нижче
    hitMax: 0.95,      // і не вище
    armorEven: 0.50,   // броня (маг. захист) = удару → проходить 50%
    armorStep: 0.10,   // +10% за кожен «раз» переваги удару над захистом
    armorMin: 0.25,    // крізь будь-який захист проходить щонайменше 25%
    armorMax: 0.95,    // якщо захист є — проходить не більше 95%
    blockKeep: 0,      // скільки урону проходить крізь блок (0 — блок поглинає повністю)
    botVary: 0.20,     // суперник: ±20% від показників Героя
    botItemVary: 0.20, // речі суперника: сума характеристик ±20% від речі Героя в тому ж слоті
    swapsPerTurn: 1,   // спецвмінь за хід: перевдягання АБО одна річ із пояса
    buffMin: 5,        // підсилення із зілля діє 🎲 від buffMin …
    buffMax: 10,       // … до buffMax ходів (кидок при використанні)
    fearFirst: 0.90,   // шанс, що перший свиток страху спрацює
    fearNext: 0.50,    // шанс кожного наступного (після першого спрацювання — опір 50%)
    fearImmune: 2,     // після стількох спрацювань страху — імунітет до кінця бою
    dualWield: false,  // дві зброї одночасно (поки ні: ліва рука — лише щит)
    xpWin: 50,         // досвід за перемогу (× коефіцієнт сили суперника)
    xpDraw: 25,        // досвід за нічию (× той самий коефіцієнт)
    xpLose: 8,         // досвід за поразку (без коефіцієнта)
    xpAdv: 0.5,        // ±50%: суперник удвічі сильніший → ×1.5, удвічі слабший → ×0.5
    xpStep: 500,       // досвіду до рівня 2 — 500, далі кожен рівень +500 (500, 1000, 1500 …)
    xpFlat: 8000       // … доки не сягне 8000; далі — стало 8000 на кожен рівень
  };

  /* ── бойові характеристики Героя, яких немає в базі Героя ──
     Стартове значення в усіх 0: Герой отримує їх лише з речей
     (fighter() читає stats[key] — відсутнє = 0). arena — що вони роблять
     у бою зараз (null — на арені поки не використовується). */
  var COMBAT_STATS = [
    { key: 'armor',       label: 'Броня',                 emoji: '🛡️', base: 0, arena: 'зменшує фізичний урон суперника: броня = удару → проходить 50%, удвічі більша → 25% (мінімум)' },
    { key: 'magicResist', label: 'Магічний захист',       emoji: '🔮', base: 0, arena: 'зменшує магічний урон (і свитки) так само, як броня — фізичний' },
    { key: 'damage',      label: 'Фізичний урон',         emoji: '⚔️', base: 0, arena: 'фізична зброя — діапазон удару; інші речі — + до удару, % — множник (лише для фізичного удару)' },
    { key: 'magicDamage', label: 'Магічний урон',         emoji: '✨', base: 0, arena: 'магічна зброя робить увесь удар магічним; інші речі — + до удару, % — множник магічного удару й свитків; на свитку — урон свитка' },
    { key: 'critDamage',  label: 'Шанс крит. урону',      emoji: '💥', base: 0, arena: '+ до шансу криту (у %)' },
    { key: 'extraAttack', label: 'Додаткова атака',       emoji: '⚡', base: 0, arena: '+1 удар за хід за кожну одиницю' },
    { key: 'block',       label: 'Шанс блоку',            emoji: '🧱', base: 0, arena: 'шанс заблокувати удар у НЕзахищену зону. Річ із бронею (або іншою характеристикою) блокує фізичні удари, з магічним захистом чи магічним уроном — магічні удари й свитки' },
    { key: 'beltSlots',   label: 'Комірки пояса',         emoji: '🧵', base: 0, arena: 'скільки зілль і свитків можна взяти в бій (пояс)' },
    { key: 'healthRegen', label: "Відновлення здоров'я",  emoji: '💚', base: 0, arena: "зілля з пояса: + N% від максимального здоров'я одразу, не вище максимуму" },
    { key: 'fear',        label: 'Страх',                 emoji: '😱', base: 0, arena: 'свиток: суперник у цьому ході не атакує й не робить спецдій. Перший спрацьовує з шансом 90%, далі — 50% (опір); після двох спрацювань — імунітет' },
    { key: 'barrier',     label: "Бар'єр",                emoji: '🫧', base: 0, arena: 'свиток: поглинає один удар, що забрав би здоров\'я (ухилився чи заблокував — бар\'єр лишається)' },
    { key: 'stun',        label: 'Оглушення',             emoji: '💫', base: 0, arena: null },
    { key: 'antidote',    label: 'Антидот',               emoji: '🧪', base: 0, arena: null }
  ];
  /* характеристики Героя (зберігаються в heroes/{id}) — що вони роблять на арені */
  var HERO_STATS = {
    health:   "витривалість у бою (максимум здоров'я)",
    accuracy: 'шанс влучити (проти спритності суперника)',
    agility:  'шанс, що суперник промахнеться',
    mana:     null     // з'явиться разом із першими навичками / заклинаннями
  };
  /* зілля-підсилення з пояса: % до показника бійця на кілька ходів */
  var BUFF_KEYS = { armor: 1, magicResist: 1, accuracy: 1, agility: 1, critDamage: 1, damage: 1, magicDamage: 1 };
  /* що робить атрибут на арені: {used, text}. Невідома назва — «не використовується». */
  function attrInfo(key, pct, consumable) {
    if (HERO_STATS.hasOwnProperty(key)) {
      if (consumable && pct && HERO_STATS[key] && BUFF_KEYS[key]) return { used: true, text: 'зілля: +N% на 🎲 ' + BATTLE.buffMin + '–' + BATTLE.buffMax + ' ходів' };
      return HERO_STATS[key] ? { used: true, text: HERO_STATS[key] } : { used: false, text: null };
    }
    for (var i = 0; i < COMBAT_STATS.length; i++) if (COMBAT_STATS[i].key === key) {
      var c = COMBAT_STATS[i];
      if (consumable && pct && BUFF_KEYS[key]) return { used: true, text: 'зілля: +N% ' + c.label.toLowerCase() + ' на 🎲 ' + BATTLE.buffMin + '–' + BATTLE.buffMax + ' ходів' };
      return c.arena ? { used: true, text: c.arena } : { used: false, text: null };
    }
    return { used: false, text: null };
  }

  /* ── зони удару → слоти екіпіровки, які її закривають ──
     Ключі слотів — як у EQUIP в arena.html (inst.slot у інвентарі). */
  var ZONES = [
    { key: 'head', label: 'Голова', slots: ['helmet', 'amulet'] },
    { key: 'body', label: 'Тіло',   slots: ['armor', 'belt'] },
    { key: 'arms', label: 'Руки',   slots: ['gloves', 'bracers', 'ring1', 'ring2'] },
    { key: 'legs', label: 'Ноги',   slots: ['pants', 'boots'] }
  ];
  var HAND_SLOTS = ['weaponR', 'weaponL'];   // зброя або щит — за категорією речі

  /* ── руки ──
     Права рука — зброя («Зброя»). Ліва — щит («Щити»); друга зброя в ліву руку
     лише з BATTLE.dualWield. Дворучна зброя (прапорець «Дворучний») займає обидві
     руки: вдягнув дворучну — щит (будь-яка річ у лівій руці) знімається; вдягнув
     щит до дворучної — знімається дворучна. */
  function handCats(slot) {
    if (slot === 'weaponR') return ['Зброя'];
    if (slot === 'weaponL') return BATTLE.dualWield ? ['Зброя', 'Щити'] : ['Щити'];
    return null;
  }
  function isTwoHanded(base) {
    return !!(base && (base.addStats || []).some(function (e) { return e && e.stat === 'Дворучний' && (e.flag || e.value == null); }));
  }
  function fitsHand(base, slot) { var c = handCats(slot); return !!(c && base && c.indexOf(base.category) >= 0); }
  /* вдягнене [{base, inst}] → без того, що руками носити не можна (стара сумка могла мати
     дві зброї або дворучну зі щитом): річ не своєї руки — геть, при дворучній лівої руки нема */
  function handsFix(eq) {
    var out = (eq || []).filter(function (e) {
      var sl = e && e.inst && e.inst.slot;
      return HAND_SLOTS.indexOf(sl) < 0 || fitsHand(e.base, sl);
    });
    var r = out.filter(function (e) { return e.inst.slot === 'weaponR'; })[0];
    if (r && isTwoHanded(r.base)) out = out.filter(function (e) { return e.inst.slot !== 'weaponL'; });
    return out;
  }

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
    var flat = {}, pct = {}, p = { wMin: 0, wMax: 0, magMin: 0, magMax: 0, blockPhys: 0, blockMag: 0, blockSrc: [] };
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
        var k = skit.canon(a.stat);
        if (k === 'block') {   // шанс блоку: тип — за головною характеристикою речі (blockKind)
          var mg = blockKind(e.base, skit) === 'mag', v = num(a.value);
          if (mg) p.blockMag += v; else p.blockPhys += v;
          p.blockSrc.push({ slot: e.inst.slot, mag: mg, v: v });
          return;
        }
        add(a.pct ? pct : flat, k, a.value);
      });
    });
    function tot(k) { return Math.round((num(stats[k]) + (flat[k] || 0)) * (1 + (pct[k] || 0) / 100)); }
    p.hp = Math.max(1, tot('health'));
    p.accuracy = Math.max(1, tot('accuracy'));
    p.agility = Math.max(1, tot('agility'));
    p.mana = Math.max(0, tot('mana'));
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

  /* яку атаку блокує «Шанс блоку» речі — за її головною характеристикою:
     магічний захист або магічний урон → магічні удари (магічна зброя, свитки);
     броня й усе інше → фізичні удари */
  function blockKind(base, skit) {
    var k = base && base.stat ? (skit && skit.canon ? skit.canon(base.stat) : base.stat) : '';
    return (k === 'magicResist' || k === 'magicDamage') ? 'mag' : 'phys';
  }
  /* хто з речей блокує (для зносу): найбільший шанс потрібного типу */
  function blockBy(def, magic) {
    var best = null;
    ((def && def.blockSrc) || []).forEach(function (b) { if (!!b.mag === !!magic && (!best || b.v > best.v)) best = b; });
    return best ? best.slot : null;
  }

  /* суперник: той самий профіль ±vary (кожне число окремо) */
  function varyFighter(p, vary, rnd) {
    rnd = rnd || Math.random; vary = vary == null ? BATTLE.botVary : vary;
    var o = {};
    Object.keys(p).forEach(function (k) {
      var v = p[k];
      if (k === 'extra' || k === 'blockPhys' || k === 'blockMag' || typeof v !== 'number') { o[k] = v; return; }
      o[k] = Math.max(k === 'hp' || k === 'accuracy' || k === 'agility' ? 1 : 0, Math.round(v * (1 - vary + rnd() * 2 * vary)));
    });
    if (o.wMax < o.wMin) o.wMax = o.wMin;
    if (o.magMax < o.magMin) o.magMax = o.magMin;
    return o;
  }

  function rollRange(lo, hi, rnd) { lo = num(lo); hi = num(hi); if (hi <= lo) return lo; return lo + Math.floor(rnd() * (hi - lo + 1)); }
  function hitChance(att, def) {
    var r = Math.max(1, num(att.accuracy)) / Math.max(1, num(def.agility)), c;
    if (r < 1) c = 1 - BATTLE.hitStep / r;
    else c = 1 - BATTLE.hitStep + BATTLE.hitAccStep * (r - 1);
    return Math.max(BATTLE.hitMin, Math.min(BATTLE.hitMax, c));
  }
  /* яка частка урону проходить крізь захист (броню / маг. захист) — див. крок 4 */
  function armorPass(raw, def) {
    raw = num(raw); def = num(def);
    if (def <= 0) return 1;
    if (raw <= 0) return BATTLE.armorMin;
    var r = raw / def, c;
    if (r < 1) c = BATTLE.armorEven * r;
    else c = BATTLE.armorEven + BATTLE.armorStep * (r - 1);
    return Math.max(BATTLE.armorMin, Math.min(BATTLE.armorMax, c));
  }
  function critChance(att) { return num(BATTLE.critBase) / 100 + num(att.critPct) / 100; }
  /* магічна зброя в руках (головна характеристика «Магічний урон») → удар магічний */
  function isMagic(p) { return num(p && p.magMax) > 0; }

  /* ── досвід ──
     power — «загальна сила» бійця: сума бойових показників
       витривалість + точність + спритність + броня + маг. захист + середній урон удару.
     xpCoef — множник досвіду за різницю сил: 1 + xpAdv × log2(сила суперника / сила Героя),
       у межах [1 − xpAdv; 1 + xpAdv]. Удвічі сильніший суперник → ×1.5, рівний → ×1, удвічі слабший → ×0.5.
     xpNeed(level) — скільки досвіду потрібно з рівня level до наступного:
       min(level × xpStep, xpFlat) → 500, 1000, 1500 … 8000, далі 8000. */
  function power(p) {
    p = p || {};
    var avgHit = BATTLE.baseDmg + (isMagic(p) ? (num(p.magMin) + num(p.magMax)) / 2 + num(p.magFlat)
                                              : (num(p.wMin) + num(p.wMax)) / 2 + num(p.dmgFlat));
    return Math.max(1, num(p.hp) + num(p.accuracy) + num(p.agility) + num(p.armor) + num(p.magicResist) + avgHit);
  }
  function xpCoef(me, op) {
    var c = 1 + BATTLE.xpAdv * Math.log(power(op) / power(me)) / Math.LN2;
    return Math.max(1 - BATTLE.xpAdv, Math.min(1 + BATTLE.xpAdv, c));
  }
  function xpNeed(level) {
    var lv = Math.max(1, Math.floor(num(level) || 1));
    return Math.min(lv * BATTLE.xpStep, BATTLE.xpFlat);
  }

  /* ── речі суперника ──
     itemPower — «сила» речі: головна характеристика + додаткові (числа й %), без бонусу.
     botItems(catalog, heroEq) → [{slot, base, inst}] — випадкові речі тих самих категорій,
     сила кожної в межах ±botItemVary від речі Героя в цьому слоті (або найближча). */
  function itemPower(base) {
    if (!base) return 0;
    var s = Math.abs(num(base.valueMax));
    (base.addStats || []).forEach(function (a) { if (a && !a.flag && a.value != null) s += Math.abs(num(a.value)); });
    return s;
  }
  function botItems(catalog, heroEq, skit, rnd) {
    rnd = rnd || Math.random;
    var v = BATTLE.botItemVary, out = [];
    (heroEq || []).forEach(function (e) {
      if (!e || !e.base || !e.inst || !e.inst.slot) return;
      var pool = (catalog || []).filter(function (b) { return b && b.category === e.base.category && !b.consumable; });
      if (!pool.length) return;
      var hp = itemPower(e.base);
      var near = pool.filter(function (b) { var p = itemPower(b); return p >= hp * (1 - v) && p <= hp * (1 + v); });
      if (!near.length) {
        var best = Infinity;
        pool.forEach(function (b) { best = Math.min(best, Math.abs(itemPower(b) - hp)); });
        near = pool.filter(function (b) { return Math.abs(itemPower(b) - hp) === best; });
      }
      var base = near[Math.floor(rnd() * near.length)];
      var inst = skit && skit.makeInstance ? skit.makeInstance(base, { bonus: 1 }) : { id: base.id, bonus: 1 };
      inst.slot = e.inst.slot;
      out.push({ slot: e.inst.slot, base: base, inst: inst });
    });
    return out;
  }

  /* Кидок кубика d100: 1..100. Подія спрацьовує, якщо випало ≤ шансу у відсотках
     (шанс 49% → треба 1..49). Так кидок видно в журналі: «🎲 37 ≤ 49». */
  function d100(rnd) { return 1 + Math.floor(rnd() * 100); }
  function pctOf(x) { return Math.max(0, Math.min(100, Math.round(x * 100))); }

  /* Один удар. Порядок: влучання → блок → урон → броня → % → крит.
     Повертає {dmg, kind:'hit'|'crit'|'block'|'dodge', crit,
               hitRoll, hitNeed, critRoll, critNeed, armor, raw, calc} */
  function strike(att, def, blocked, rnd) {
    rnd = rnd || Math.random;
    var out = { critRoll: null, critNeed: null, raw: 0, armor: 0 };
    function ret(o) { for (var k in o) out[k] = o[k]; return out; }
    // 1) влучив?
    out.hitNeed = pctOf(hitChance(att, def)); out.hitRoll = d100(rnd);
    if (out.hitRoll > out.hitNeed) return ret({ dmg: 0, kind: 'dodge', crit: false, calc: 'промах: 🎲 ' + out.hitRoll + ' > ' + out.hitNeed + '%' });
    function critCheck() { out.critNeed = pctOf(critChance(att)); out.critRoll = d100(rnd); return out.critRoll <= out.critNeed; }
    // 2) заблокував? щит приймає удар; ПІСЛЯ блоку — перевірка, чи удар був критичним
    //    (від цього залежить знос щита: shieldCritBlock замість shieldBlock)
    if (blocked && !BATTLE.blockKeep) {
      var bc = critCheck();
      return ret({ dmg: 0, kind: 'block', crit: bc,
        calc: 'блок — удар не пройшов · крит? 🎲 ' + out.critRoll + (bc ? ' ≤ ' : ' > ') + out.critNeed + '% — '
          + (bc ? 'критичний → щит −' + WEAR.shieldCritBlock : 'звичайний → щит −' + WEAR.shieldBlock) });
    }
    // 2б) не вгадав зону — шанс блоку з речей захисника (фізичні / магічні удари окремо)
    var magic0 = isMagic(att), bch = num(magic0 ? def.blockMag : def.blockPhys);
    if (!blocked && bch > 0) {
      out.blockNeed = Math.min(100, Math.round(bch)); out.blockRoll = d100(rnd);
      if (out.blockRoll <= out.blockNeed) {
        var cb = critCheck();
        return ret({ dmg: 0, kind: 'block', crit: cb, byChance: true, blockBy: blockBy(def, magic0),
          calc: 'блок шансом 🎲 ' + out.blockRoll + ' ≤ ' + out.blockNeed + '%' + (magic0 ? ' (маг.)' : '') + ' · крит? 🎲 ' + out.critRoll + (cb ? ' ≤ ' : ' > ') + out.critNeed + '%' });
      }
    }
    // 3) урон. ТИП удару визначає зброя в руках:
    //    магічна зброя («Магічний урон») → УВЕСЬ удар магічний (і база baseDmg теж):
    //      (база + маг. зброя + «Маг. урон» речей) × крізь маг. захист × «% маг. урону»;
    //    без зброї або фізична → увесь удар фізичний:
    //      (база + зброя + «Урон» речей) × крізь броню × «% урону».
    var magic = isMagic(att);
    var raw = BATTLE.baseDmg + (magic ? rollRange(att.magMin, att.magMax, rnd) + num(att.magFlat)
                                      : rollRange(att.wMin, att.wMax, rnd) + num(att.dmgFlat));
    var defV = magic ? num(def.magicResist) : num(def.armor);
    var pctV = magic ? num(att.magPct) : num(att.dmgPct);
    // 4) крізь захист проходить частка (armorPass), 5) відсотки
    var pass = armorPass(raw, defV);
    var base = raw * pass * (1 + pctV / 100);
    // 6) крит
    var crit = critCheck();
    var mult = crit ? BATTLE.critMult : 1;
    var dmg = Math.max(BATTLE.minDmg, Math.round(base * mult));
    out.raw = raw; out.armor = defV; out.magic = magic; out.pass = pass;
    out.magDmg = magic ? dmg : 0; out.physDmg = magic ? 0 : dmg;   // журнал фарбує магічний урон фіолетовим
    out.parts = { magic: magic, raw: raw, def: defV, pass: pass, pct: pctV, mult: mult };
    var calc = (magic ? '✨маг. ' : '') + raw + (defV > 0 ? ' × ' + pctOf(pass) + '% (' + (magic ? 'маг. захист ' : 'броня ') + defV + ')' : '')
      + (pctV ? ' × ' + (100 + pctV) + '%' : '') + (crit ? ' × ' + BATTLE.critMult + ' крит' : '');
    if (blocked) {   // частковий блок (лише якщо blockKeep > 0)
      var kept = Math.round(dmg * BATTLE.blockKeep);
      return ret({ dmg: kept, kind: 'block', crit: crit, calc: 'блок: ' + calc + ' = ' + dmg + ' → проходить ' + Math.round(BATTLE.blockKeep * 100) + '%' });
    }
    return ret({ dmg: dmg, kind: crit ? 'crit' : 'hit', crit: crit, calc: calc });
  }

  /* ── ПОЯС: що робить разова річ (зілля, свиток) ──
     useEffects(base, inst, skit) → [{type, ...}]:
       heal    {pct}            — + pct% від максимального здоров'я, не вище максимуму;
       buff    {key, pct}       — + pct% до показника на 🎲 buffMin–buffMax ходів;
       scroll  {min, max}       — окремий магічний удар: без ухилення й криту;
       fear    {}               — суперник цей хід не атакує й не робить спецдій;
       barrier {n}              — поглинає n ударів, що забрали б здоров'я;
       none    {key}            — атрибут на арені поки не діє (річ витрачається). */
  function useEffects(base, inst, skit) {
    var out = [];
    if (!base || !skit) return out;
    var eff = skit.effective(base, inst || { bonus: 1 });
    if (eff.stat && eff.valueMax != null) {
      var mk = skit.canon(eff.stat);
      if (mk === 'magicDamage' || mk === 'damage') out.push({ type: 'scroll', min: num(eff.valueMin != null ? eff.valueMin : eff.valueMax), max: num(eff.valueMax) });
      else out.push({ type: 'none', key: mk });
    }
    (eff.addStats || []).forEach(function (a) {
      if (a.flag || a.value == null) return;
      var k = skit.canon(a.stat), v = num(a.value);
      if (k === 'healthRegen') out.push({ type: 'heal', pct: v });
      else if (k === 'fear') out.push({ type: 'fear' });
      else if (k === 'barrier') out.push({ type: 'barrier', n: Math.max(1, Math.round(v)) });
      else if (BUFF_KEYS[k]) out.push({ type: 'buff', key: k, pct: v });
      else out.push({ type: 'none', key: k });
    });
    return out;
  }
  /* профіль із підсиленнями зілль: % множить показник (шанс криту — додається) */
  function buffed(p, buffs) {
    if (!buffs) return p;
    var o = {}, k;
    for (k in p) o[k] = p[k];
    for (k in buffs) {
      var b = buffs[k]; if (!b || !(b.turns > 0)) continue;
      var v = num(b.pct);
      if (k === 'critDamage') o.critPct = num(o.critPct) + v;
      else if (k === 'damage') o.dmgPct = num(o.dmgPct) + v;
      else if (k === 'magicDamage') o.magPct = num(o.magPct) + v;
      else if (o[k] != null) o[k] = Math.round(num(o[k]) * (1 + v / 100));
    }
    return o;
  }
  /* удар свитка: без ухилення й криту; крізь маг. захист; × «% маг. урону»;
     заблокувати можна лише шансом магічного блоку */
  function scrollStrike(att, def, eff, rnd) {
    rnd = rnd || Math.random;
    var out = { kind: 'hit', crit: false, scroll: true, magic: true, critRoll: null, critNeed: null };
    var bch = num(def.blockMag);
    if (bch > 0) {
      out.blockNeed = Math.min(100, Math.round(bch)); out.blockRoll = d100(rnd);
      if (out.blockRoll <= out.blockNeed) {
        out.dmg = 0; out.kind = 'block'; out.byChance = true; out.blockBy = blockBy(def, true);
        out.calc = 'свиток заблоковано шансом 🎲 ' + out.blockRoll + ' ≤ ' + out.blockNeed + '% (маг.)';
        return out;
      }
    }
    var raw = rollRange(eff.min, eff.max, rnd), defV = num(def.magicResist), pctV = num(att.magPct);
    var pass = armorPass(raw, defV);
    var dmg = Math.max(BATTLE.minDmg, Math.round(raw * pass * (1 + pctV / 100)));
    out.raw = raw; out.armor = defV; out.pass = pass; out.dmg = dmg; out.magDmg = dmg; out.physDmg = 0;
    out.parts = { magic: true, raw: raw, def: defV, pass: pass, pct: pctV, mult: 1 };
    out.calc = '📜 ✨маг. ' + raw + (defV > 0 ? ' × ' + pctOf(pass) + '% (маг. захист ' + defV + ')' : '') + (pctV ? ' × ' + (100 + pctV) + '%' : '');
    return out;
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
    BATTLE: BATTLE, ZONES: ZONES, HAND_SLOTS: HAND_SLOTS, WEAR: WEAR, COMBAT_STATS: COMBAT_STATS,
    SLOT_UK: SLOT_UK, zoneOfSlot: zoneOfSlot,
    handCats: handCats, isTwoHanded: isTwoHanded, fitsHand: fitsHand, handsFix: handsFix,
    HERO_STATS: HERO_STATS, BUFF_KEYS: BUFF_KEYS, attrInfo: attrInfo,
    blockKind: blockKind, blockBy: blockBy, useEffects: useEffects, buffed: buffed, scrollStrike: scrollStrike,
    fighter: fighter, varyFighter: varyFighter, hitChance: hitChance, critChance: critChance, isMagic: isMagic,
    strike: strike, attack: attack, d100: d100, armorPass: armorPass,
    power: power, xpCoef: xpCoef, xpNeed: xpNeed, itemPower: itemPower, botItems: botItems
  };
})(typeof window !== 'undefined' ? window : this);

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
    botBeltSlots: 5,   // пояс суперника: комірок (за замовчуванням порожній)
    botBeltTest: true, // ТЕСТ: класти боту в пояс свитки з каталогу (спершу — страх); false — пояс порожній
    botBeltUse: 25,    // шанс за хід, що бот використає річ із пояса (якщо є)
    dualWield: false,  // дві зброї одночасно: вмикається для Героя з вмінням «Друга зброя» (handsFromHero)
    grip: false,       // дворучна зброя + щит: вмикається для Героя з вмінням «Хватка велетня» (handsFromHero)
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
    { key: 'block',       label: 'Шанс блоку',            emoji: '🧱', base: 0, arena: 'шанс заблокувати удар у НЕзахищену зону. Річ із бронею (або іншою характеристикою) блокує фізичні удари, з магічним захистом чи магічним уроном — магічні удари й свитки. Зі щитом, головна характеристика якого «Спритність», усі шанси з речей разом і навпіл діють проти будь-яких ударів — це відскок' },
    { key: 'beltSlots',   label: 'Комірки пояса',         emoji: '🧵', base: 0, arena: 'скільки зілль і свитків можна взяти в бій (пояс)' },
    { key: 'healthRegen', label: "Відновлення здоров'я",  emoji: '💚', base: 0, arena: "зілля з пояса: + N% від максимального здоров'я одразу, не вище максимуму" },
    { key: 'fear',        label: 'Страх',                 emoji: '😱', base: 0, arena: 'свиток: суперник у цьому ході не атакує й не робить спецдій. Перший спрацьовує з шансом 90%, далі — 50% (опір); після двох спрацювань — імунітет' },
    { key: 'barrier',     label: "Бар'єр",                emoji: '🫧', base: 0, arena: 'свиток: поглинає один удар, що забрав би здоров\'я (ухилився чи заблокував — бар\'єр лишається)' },
    { key: 'stun',        label: 'Оглушення',             emoji: '💫', base: 0, arena: null },
    { key: 'antidote',    label: 'Антидот',               emoji: '🧪', base: 0, arena: 'зілля: знімає отруту; далі 2 ходи опір отруті 100%, потім щоходу −10% — до свого опору (з речей)' },
    { key: 'resPoison',   label: 'Опір отруті',           emoji: '🐍', base: 0, arena: 'свій опір отруті (%): менше урону отрутою з удару й тіків отрути, менший шанс тебе отруїти; після отруєння опір падає не нижче нього' },
    { key: 'resFire',     label: 'Опір вогню',            emoji: '🔥', base: 0, arena: 'кінцеве −% урону вогнем; з речей разом ≤ 33% (запрацює зі стихійною зброєю й чарами)' },
    { key: 'resCold',     label: 'Опір холоду',           emoji: '❄️', base: 0, arena: 'кінцеве −% урону холодом; з речей разом ≤ 33% (запрацює зі стихійною зброєю й чарами)' },
    { key: 'resShock',    label: 'Опір струму',           emoji: '⚡', base: 0, arena: 'кінцеве −% урону струмом; з речей разом ≤ 33% (запрацює зі стихійною зброєю й чарами)' },
    { key: 'resLight',    label: 'Опір світлу',           emoji: '☀️', base: 0, arena: 'кінцеве −% урону світлом; з речей разом ≤ 33% (запрацює зі стихійною зброєю й чарами)' },
    { key: 'resDark',     label: 'Опір темряві',          emoji: '🌑', base: 0, arena: 'кінцеве −% урону темрявою; з речей разом ≤ 33% (запрацює зі стихійною зброєю й чарами)' },
    { key: 'resPierce',   label: 'Опір колючому',         emoji: '📌', base: 0, arena: 'кінцеве −% урону колючою зброєю (кинджал, спис, лук); з речей разом ≤ 33%' },
    { key: 'resSlash',    label: 'Опір рублячому',        emoji: '🪚', base: 0, arena: 'кінцеве −% урону рублячою зброєю (меч, сокира, кнут); з речей разом ≤ 33%' },
    { key: 'resBash',     label: 'Опір тупому',           emoji: '🪨', base: 0, arena: 'кінцеве −% урону тупою зброєю (булава, кистень, посох, кулаки, Пінок); з речей разом ≤ 33%' },
    { key: 'resMagic',    label: 'Опір магії',            emoji: '✨', base: 0, arena: 'кінцеве −% магічного урону (магічна зброя, Вогник, свитки); з речей разом ≤ 33%' }
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
     щит до дворучної — знімається дворучна. Кастети — пара на обидві руки, але
     НЕ дворучні: щит у ліву можна (кулак + щит), навіть якщо стоїть прапорець. */
  function handCats(slot) {
    if (slot === 'weaponR') return ['Зброя'];
    if (slot === 'weaponL') return BATTLE.dualWield ? ['Зброя', 'Щити'] : ['Щити'];
    return null;
  }
  function isTwoHanded(base) {
    if (base && base.weaponType === 'knuckles') return false;
    return !!(base && (base.addStats || []).some(function (e) { return e && e.stat === 'Дворучний' && (e.flag || e.value == null); }));
  }
  /* у ліву руку — лише одноручна зброя ближнього бою (не дворучна, не лук, не кастети, не жезл) */
  var NO_LEFT = { bow: 1, knuckles: 1, wand: 1 };
  function fitsHand(base, slot) {
    var c = handCats(slot); if (!(c && base && c.indexOf(base.category) >= 0)) return false;
    if (slot === 'weaponL' && base.category === 'Зброя' && (isTwoHanded(base) || NO_LEFT[base.weaponType])) return false;
    return true;
  }
  /* чи не вміщаються руки: дворучна в правій і будь-що в лівій; зі «Хваткою велетня» — щит можна */
  function handsClash(rBase, lBase) {
    if (!rBase || !lBase || !isTwoHanded(rBase)) return false;
    return !(BATTLE.grip && lBase.category === 'Щити');
  }
  /* куди класти зброю без вибраного слота: з «Другою зброєю», коли в правій уже одноручна зброя
     ближнього бою, а нова теж годиться в ліву — у ліву (замість щита); інакше — null (права рука) */
  function offhandSlot(base, rBase) {
    return BATTLE.dualWield && base && base.category === 'Зброя' && fitsHand(base, 'weaponL')
      && rBase && rBase.category === 'Зброя' && fitsHand(rBase, 'weaponL') ? 'weaponL' : null;
  }
  /* правила рук під вміння Героя: Друга зброя — зброя в лівій; Хватка велетня — дворучна + щит */
  function handsFromHero(h) {
    var s = (h && h.skills) || {}, kn = !!(h && h.heroClass === 'knight'), rg = !!(h && h.heroClass === 'ranger');
    BATTLE.dualWield = (kn && s['knight.offhand'] != null) || (rg && s['ranger.dual'] != null);   // Слідопит: «Друга зброя» — спільна з Лицарем
    BATTLE.grip = kn && s['knight.grip'] != null;
  }
  /* вдягнене [{base, inst}] → без того, що руками носити не можна (стара сумка могла мати
     дві зброї або дворучну зі щитом): річ не своєї руки — геть, при дворучній лівої руки нема */
  function handsFix(eq) {
    var out = (eq || []).filter(function (e) {
      var sl = e && e.inst && e.inst.slot;
      return HAND_SLOTS.indexOf(sl) < 0 || fitsHand(e.base, sl);
    });
    var r = out.filter(function (e) { return e.inst.slot === 'weaponR'; })[0], l = out.filter(function (e) { return e.inst.slot === 'weaponL'; })[0];
    if (r && l && handsClash(r.base, l.base)) out = out.filter(function (e) { return e.inst.slot !== 'weaponL'; });
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
  /* ОПОРИ ТИПАМ УРОНУ: тип удару → характеристика захисника. Кінцеве зменшення (після броні, % і криту):
     урон × (1 − опір%). З речей разом — щонайбільше RES_CAP. Гравцям стелю не показуємо (лише адмінка). */
  var RES_KEY = { pierce: 'resPierce', slash: 'resSlash', bash: 'resBash', magic: 'resMagic',
    fire: 'resFire', cold: 'resCold', shock: 'resShock', light: 'resLight', dark: 'resDark' };
  var RES_CAP = 33;
  function resCut(dmg, type, def) {                            // → {dmg, r} — урон після опору й сам опір %
    var r = Math.max(0, Math.min(RES_CAP, num(def && def[RES_KEY[type]])));
    if (!(r > 0) || !(dmg > 0)) return { dmg: dmg, r: 0 };
    return { dmg: Math.max(BATTLE.minDmg, Math.round(dmg * (1 - r / 100))), r: r };
  }
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
        if (hand && k === 'damage' && e.inst.slot === 'weaponL' && e.base.category === 'Зброя') { p.lMin = num(p.lMin) + lo; p.lMax = num(p.lMax) + hi; }   // друга зброя — окремий удар лівою
        else if (hand && k === 'damage') { p.wMin += lo; p.wMax += hi; }
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
    /* опори (%): отрута — окрема механіка (до 100%); решта — кінцеве зменшення урону свого типу, з речей разом ≤ RES_CAP */
    var rp = (pct.resPoison || 0) + (flat.resPoison || 0); if (rp) p.resPoison = Math.max(0, Math.min(100, rp));
    Object.keys(RES_KEY).forEach(function (t) { var k = RES_KEY[t], r = (pct[k] || 0) + (flat[k] || 0); if (r) p[k] = Math.max(0, Math.min(RES_CAP, r)); });
    // тип удару — за зброєю в правій руці (поле речі dmgType або типовий для виду); без зброї — тупий (кулаки)
    var wr = (equipped || []).filter(function (e) { return e && e.base && e.inst && e.inst.slot === 'weaponR' && e.base.category === 'Зброя'
      && !(e.inst.durMax != null && e.inst.durCur != null && num(e.inst.durCur) <= 0); })[0];
    p.dmgType = wr ? (wr.base.dmgType || (skit.defaultDmgType ? skit.defaultDmgType(wr.base.weaponType, wr.base.stat) : null) || 'bash') : 'bash';
    // щит зі спритністю (плащ матадора, кришка…): усі «Шанси блоку» з речей разом і навпіл —
    // однаково проти фізичних і магічних ударів; це не блок, а відскок (evade)
    var lh = (equipped || []).filter(function (e) {
      return e && e.base && e.inst && e.inst.slot === 'weaponL' && e.base.category === 'Щити' && e.base.stat
        && skit.canon(e.base.stat) === 'agility' && !(e.inst.durMax != null && e.inst.durCur != null && num(e.inst.durCur) <= 0);
    })[0];
    if (lh) {
      var half = Math.round((p.blockPhys + p.blockMag) * 5) / 10;
      p.blockPhys = half; p.blockMag = half; p.evade = true;
    }
    return p;
  }

  /* ── БАЗОВІ ХАРАКТЕРИСТИКИ ГЕРОЯ (поза боєм) ──
     Одна формула для всіх сторінок: головна (hero.html), хедер, інвентар арени.
     База = характеристики з тестів + вдягнені речі (без пояса, без зламаних),
     рахується тим самим fighter(), з яким Герой заходить у бій. Вміння сюди не входять.
     stats — {health, mana, agility, accuracy}; equipped — [{base, inst}] (inst.slot).
     → {health, mana, agility, accuracy, armor, magicResist, dmg:'11–16', mag:'—', p} */
  var HERO_DEFAULTS = { health: 50, mana: 20, agility: 50, accuracy: 50 };
  /* ріст за рівень арени (з 2-го рівня): до вибору класу (рівні 2…CLASS_LEVEL−1) і без класу — pre;
     далі — за класом. Нічого не зберігається: рахується з рівня й класу (скинув клас — перерахувалось). */
  var LEVEL_BONUS = { pre: { health: 4, mana: 4 }, knight: { health: 6, mana: 3 }, ranger: { health: 5, mana: 4 },
    healer: { health: 4, mana: 5 }, mage: { health: 3, mana: 6 } };
  var CLASS_FROM = 3;   // = SKSKILLS.CLASS_LEVEL
  /* ── ПЕРЕВАГИ КЛАСУ ──
     Діють самі, щойно обрано клас (без очок і без вивчення). Вміння з однаковою назвою в усіх
     класах однакові — те, чим клас кращий за інших, записано лише тут.
     v — числа для бою (sk-battle.js читає їх звідси), text — опис для книги й адмінки.
     Ріст за рівень (LEVEL_BONUS) і правило концентрації — теж переваги класу, адмінка показує їх поруч. */
  var CLASS_PERKS = {
    knight: [
      { id: 'conc', icon: '🧱', name: 'Стійкість', text: 'концентрація росте, коли тебе б\'ють; у хід без урону — спадає' },
      /* soon — записано на балансування класів, у бою поки не діє (без v); коли запрацює — v і прибрати soon */
      { id: 'shieldMaster', icon: '🛡️', name: 'Майстер щита', soon: true, text: 'зі щитом шанс блоку +5%' },
      { id: 'heavyArmor', icon: '🪨', name: 'Важкі обладунки', soon: true, text: 'важка броня менше знижує спритність' },
      { id: 'hardened', icon: '⚔️', name: 'Загартований', soon: true, text: 'опір контролю +5% навіть без вміння Стійкість' },
      { id: 'potionPro', icon: '🧪', name: 'Знавець зілль', soon: true, text: 'зілля з пояса діють сильніше (на скільки — вирішимо на балансуванні)' }
    ],
    ranger: [
      { id: 'conc', icon: '🎯', name: 'Приціл', text: 'концентрація росте в спокійний хід; урон її скидає' },
      { id: 'daggerCrit', icon: '🗡️', name: 'Майстер кинджала', v: 5, text: 'з кинджалом у руці шанс криту +5%' },
      { id: 'spearFirst', icon: '🔱', name: 'Швидкий спис', v: 10, text: 'зі списом: якщо твої удари цього ходу добивають ворога — 10% встигнути першим (його удару не буде)' },
      { id: 'whipCut', icon: '➰', name: 'Хльосткий кнут', v: 15, text: 'з кнутом: шанс блоку ворога щитом і речами на 15% менший' },
      { id: 'archer', icon: '🏹', name: 'Природжений стрілець', text: 'Лук і Влучний постріл — лише в Слідопита' },
      { id: 'lungeCrit', icon: '🗡️', name: 'Точний випад', v: 15, text: 'Випадом шанс криту +15%' },
      { id: 'dodgeUp', icon: '💨', name: 'Спритний ухил', v: 5, text: 'Ухилення (загальне вміння): коли прокинулось, ухиляєшся на 5% частіше (15% → 20%)' },
      { id: 'lightStep', icon: '🍃', name: 'Легка хода', v: 5, text: 'без щита спритність +5% — по тобі трохи рідше влучають' }
    ]
  };
  function perk(cls, id) { var l = CLASS_PERKS[cls] || []; for (var i = 0; i < l.length; i++) if (l[i].id === id) return num(l[i].v); return 0; }
  function levelBonus(level, cls) {
    var lv = Math.max(1, Math.floor(num(level) || 1)), o = { health: 0, mana: 0 };
    for (var k = 2; k <= lv; k++) {
      var b = (k >= CLASS_FROM && LEVEL_BONUS[cls]) || LEVEL_BONUS.pre;
      o.health += b.health; o.mana += b.mana;
    }
    return o;
  }
  /* характеристики Героя з документа + ріст за рівень (level/cls — якщо не передано, з h.arena.level і h.heroClass) */
  function heroStatsOf(h, level, cls) {
    var o = {};
    for (var k in HERO_DEFAULTS) o[k] = h && h[k] != null && isFinite(Number(h[k])) ? Number(h[k]) : HERO_DEFAULTS[k];
    var lb = levelBonus(level != null ? level : h && h.arena && h.arena.level, cls !== undefined ? cls : h && h.heroClass);
    o.health += lb.health; o.mana += lb.mana;
    return o;
  }
  function heroSheet(stats, equipped, skit) {
    var eq = (equipped || []).filter(function (e) { return e && e.base && e.inst && e.inst.slot && !/^belt\d/.test(e.inst.slot); });
    eq = handsFix(eq);
    var p = fighter(stats, eq, skit), b = BATTLE.baseDmg;
    var rg = function (lo, hi) { lo = Math.round(lo); hi = Math.round(hi); return lo === hi ? String(lo) : lo + '–' + hi; };
    var magic = isMagic(p);
    return {
      health: p.hp, mana: p.mana, agility: p.agility, accuracy: p.accuracy, armor: p.armor, magicResist: p.magicResist,
      dmg: magic ? '—' : rg(b + num(p.wMin) + num(p.dmgFlat), b + num(p.wMax) + num(p.dmgFlat)),
      mag: magic ? rg(b + num(p.magMin) + num(p.magFlat), b + num(p.magMax) + num(p.magFlat)) : '—',
      p: p
    };
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
    if (def && def.evade) return 'weaponL';   // відскок — зношується щит зі спритністю
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
      if (k === 'extra' || k === 'blockPhys' || k === 'blockMag' || typeof v !== 'number') { o[k] = v; return; }   // evade (boolean) теж як є
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

  /* ── пояс суперника ──
     botBelt(catalog, skit) → [{base, inst}] до botBeltSlots речей. За замовчуванням
     порожній; у тесті (botBeltTest) — свитки з каталогу: спершу до 2 свитків страху
     (після 2 спрацювань — імунітет, більше не треба), решта — випадкові свитки. */
  function hasFear(base, skit) {
    return useEffects(base, { bonus: 1 }, skit).some(function (f) { return f.type === 'fear'; });
  }
  function botBelt(catalog, skit, rnd) {
    rnd = rnd || Math.random;
    var n = Math.max(0, Math.floor(num(BATTLE.botBeltSlots)));
    if (!BATTLE.botBeltTest || !n || !skit) return [];
    var pool = (catalog || []).filter(function (b) { return b && b.category === 'Свиток' && b.active !== false; });
    if (!pool.length) return [];
    var fear = pool.filter(function (b) { return hasFear(b, skit); }), other = pool.filter(function (b) { return !hasFear(b, skit); });
    var out = [], pickOf = function (arr) { return arr[Math.floor(rnd() * arr.length)]; };
    for (var i = 0; i < 2 && fear.length && out.length < n; i++) out.push(pickOf(fear));
    while (out.length < n) out.push(pickOf(other.length ? other : pool));
    return out.map(function (base, i) {
      return { base: base, inst: { uid: 'bot' + i, id: base.id, slot: 'belt' + i, bonus: 1 } };
    });
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
    var out = { critRoll: null, critNeed: null, raw: 0, armor: 0, magic: isMagic(att) };   // magic — і для блоку (журнал фарбує)
    function ret(o) { for (var k in o) out[k] = o[k]; return out; }
    // 1) влучив?
    out.hitNeed = pctOf(hitChance(att, def)); out.hitRoll = d100(rnd);
    if (att.sure) out.sure = true;                               // Камуфляж: удар не промахується
    else if (out.hitRoll > out.hitNeed) return ret({ dmg: 0, kind: 'dodge', crit: false, calc: 'промах: 🎲 ' + out.hitRoll + ' > ' + out.hitNeed + '%' });
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
      out.blockNeed = Math.min(100, Math.round(bch)); out.blockRoll = d100(rnd); out.evadeTry = !!def.evade;
      if (out.blockRoll <= out.blockNeed) {
        var cb = critCheck();
        return ret({ dmg: 0, kind: 'block', crit: cb, byChance: true, evade: !!def.evade, blockBy: blockBy(def, magic0),
          calc: (def.evade ? 'спритно відскочив 💨 🎲 ' : 'блок шансом 🎲 ') + out.blockRoll + ' ≤ ' + out.blockNeed + '%' + (magic0 ? ' (маг.)' : '') + ' · крит? 🎲 ' + out.critRoll + (cb ? ' ≤ ' : ' > ') + out.critNeed + '%' });
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
    // 3б) вміння «Сокира»: з шансом pierce броня рахується наполовину (кидок — лише коли шанс є)
    if (!magic && defV > 0 && num(att.pierce) > 0) {
      out.pierceNeed = Math.min(100, Math.round(num(att.pierce))); out.pierceRoll = d100(rnd);
      if (out.pierceRoll <= out.pierceNeed) { defV = Math.round(defV / 2); out.pierce = true; }
    }
    // 3в) «Випад»: броня ворога рахується лише на armorPct %
    if (!magic && defV > 0 && num(att.armorPct) > 0 && num(att.armorPct) < 100) {
      out.armorFrom = defV; defV = Math.round(defV * num(att.armorPct) / 100); out.armorPct = num(att.armorPct);
    }
    // 4) крізь захист проходить частка (armorPass), 5) відсотки
    var pass = armorPass(raw, defV);
    // множник удару: «Двійка» лівим кулаком — ×½, «Випад» — ×1…1.5
    var mul = num(att.dmgMul) > 0 ? num(att.dmgMul) : 1, half = mul === 0.5;
    var base = raw * pass * (1 + pctV / 100) * mul;
    if (half) out.half = true;
    if (mul !== 1) out.mul = mul;
    // 6) крит
    var crit = critCheck();
    var mult = crit ? BATTLE.critMult : 1;
    var dmg = Math.max(BATTLE.minDmg, Math.round(base * mult));
    var dt = magic && (!att.dmgType || att.dmgType === 'pierce' || att.dmgType === 'slash' || att.dmgType === 'bash') ? 'magic' : (att.dmgType || (magic ? 'magic' : 'bash'));
    var rc = resCut(dmg, dt, def); if (rc.r) { dmg = rc.dmg; out.res = rc.r; out.resType = dt; }   // опір типу урону — останнім
    out.raw = raw; out.armor = defV; out.magic = magic; out.pass = pass;
    out.magDmg = magic ? dmg : 0; out.physDmg = magic ? 0 : dmg;   // журнал фарбує магічний урон фіолетовим
    out.parts = { magic: magic, raw: raw, def: defV, pass: pass, pct: pctV, mult: mult, half: half, mul: mul };
    var calc = (magic ? '✨маг. ' : '') + raw + (defV > 0 ? ' × ' + pctOf(pass) + '% (' + (magic ? 'маг. захист ' : 'броня ') + defV + (out.pierce ? ', 🪓 пів броні' : '') + ')' : '')
      + (pctV ? ' × ' + (100 + pctV) + '%' : '') + (half ? ' × ½' : mul !== 1 ? ' × ' + mul : '') + (crit ? ' × ' + BATTLE.critMult + ' крит' : '')
      + (out.res ? ' × ' + (100 - out.res) + '% опір' : '');
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
        out.dmg = 0; out.kind = 'block'; out.byChance = true; out.evade = !!def.evade; out.blockBy = blockBy(def, true);
        out.calc = (def.evade ? 'від свитка спритно відскочив 💨 🎲 ' : 'свиток заблоковано шансом 🎲 ') + out.blockRoll + ' ≤ ' + out.blockNeed + '%' + (def.evade ? '' : ' (маг.)');
        return out;
      }
    }
    var raw = rollRange(eff.min, eff.max, rnd), defV = num(def.magicResist), pctV = num(att.magPct);
    var pass = armorPass(raw, defV);
    var dmg = Math.max(BATTLE.minDmg, Math.round(raw * pass * (1 + pctV / 100)));
    var rcs = resCut(dmg, 'magic', def); if (rcs.r) { dmg = rcs.dmg; out.res = rcs.r; }   // свиток — магія: Опір магії останнім
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
    handCats: handCats, isTwoHanded: isTwoHanded, fitsHand: fitsHand, handsFix: handsFix, handsClash: handsClash, handsFromHero: handsFromHero, offhandSlot: offhandSlot,
    HERO_STATS: HERO_STATS, BUFF_KEYS: BUFF_KEYS, attrInfo: attrInfo,
    blockKind: blockKind, blockBy: blockBy, useEffects: useEffects, botBelt: botBelt, buffed: buffed, scrollStrike: scrollStrike,
    fighter: fighter, varyFighter: varyFighter, resCut: resCut, RES_KEY: RES_KEY, RES_CAP: RES_CAP, heroSheet: heroSheet, heroStatsOf: heroStatsOf, levelBonus: levelBonus, LEVEL_BONUS: LEVEL_BONUS, CLASS_PERKS: CLASS_PERKS, perk: perk, HERO_DEFAULTS: HERO_DEFAULTS, hitChance: hitChance, critChance: critChance, isMagic: isMagic,
    strike: strike, attack: attack, d100: d100, armorPass: armorPass,
    power: power, xpCoef: xpCoef, xpNeed: xpNeed, itemPower: itemPower, botItems: botItems
  };
})(typeof window !== 'undefined' ? window : this);

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

  /* ── бій ── */
  var BATTLE = {
    turnSeconds: 30,   // секунд на хід
    baseHP: 100,       // (довідково) бойове HP зараз = здоров'я Героя
    baseDmg: 8,        // урон = baseDmg + точність / dmgPerAcc
    dmgPerAcc: 8,
    critChance: 280,   // шанс криту = точність / critChance (менше = частіше)
    critMult: 1.7,     // крит множить урон
    dodgeChance: 380,  // шанс ухилитися = спритність / dodgeChance
    blockKeep: 0.30,   // скільки урону проходить крізь блок (мінімум 1)
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

  root.SKARENA = {
    BATTLE: BATTLE, ZONES: ZONES, HAND_SLOTS: HAND_SLOTS, WEAR: WEAR,
    SLOT_UK: SLOT_UK, zoneOfSlot: zoneOfSlot
  };
})(typeof window !== 'undefined' ? window : this);

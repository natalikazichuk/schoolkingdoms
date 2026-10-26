/* ============================================================
   sk-battle.js — РУШІЙ БОЮ (window.SKBATTLE, у Node — module.exports).
   ------------------------------------------------------------
   Бій живе в ОКРЕМОМУ просторі: на старті беремо копію характеристик
   і вдягнених речей Героя, далі все (здоров'я, перевдягання, знос,
   поломки) змінює лише стан бою. Основний запис Героя бій не чіпає.
   Наприкінці — підсумок (summary) і чиста функція applyToHero, яка
   вносить у документ Героя ЛИШЕ зміни: знос речей, зникнення зламаних,
   використані зілля/сувої, досвід і статистику.

   ПОЯС: зілля й свитки з комірок пояса — спецвміння ходу (замість
   перевдягання). Діють лише в цьому бою (здоров'я, підсилення на кілька
   ходів, бар'єр, страх); після бою з інвентаря зникає лише використане.

   Тут немає ні сторінки, ні бази: ті самі функції запускаються в
   браузері (arena.html, доігрування з sk-header.js), а згодом — на
   сервері, без переписування.

   Результат ходу однаковий на будь-якому пристрої: випадковість ходу
   береться з «зерна» бою (bid + раунд), а не з Math.random. Тому
   перезавантаження не «перекидає кубики», а доігрування пропущених
   ходів дає той самий бій, що й наживо.

   ctx = { R: window.SKARENA (sk-arena-rules.js), K: window.SKIT (sk-items.js) }
   ============================================================ */
(function (root) {
  'use strict';

  var ZONES = ['head', 'body', 'arms', 'legs'];
  var PAUSE_MS = 2600;          // показ результату ходу перед наступним
  var AFK_CUT = 0.25;           // пропущено більше 25% ходів → досвід −25%
  var AFK_ZERO = 0.5;           // пропущено більше 50% → досвіду немає (АФК-бій)
  var KEEP_HISTORY = 20;        // скільки завершених боїв зберігати на Героя

  /* ── однакова випадковість на всіх пристроях ── */
  function hashStr(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    var a = hashStr(seed);
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function pick(arr, rnd) { return arr[Math.floor(rnd() * arr.length)]; }
  function num(v) { v = Number(v); return isNaN(v) ? 0 : v; }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function newBid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function turnMs(ctx) { return ((ctx.R && ctx.R.BATTLE && ctx.R.BATTLE.turnSeconds) || 30) * 1000; }
  function newWear() { return { head: 0, body: 0, arms: 0, legs: 0, weapon: 0, shield: 0 }; }
  function isLive(st) { return !!(st && st.status === 'live'); }

  /* ── знос однієї речі ──
     wearOf: накопичений знос її зони / зброї / щита; itemWear: лише за час,
     поки річ була вдягнена (w0 — при вдяганні, w1 — при знятті). */
  function wearOf(ctx, e, w) {
    var R = ctx.R, z = R.zoneOfSlot ? R.zoneOfSlot(e.slot) : null, own = w['u:' + e.uid] || 0;   // own — блоки шансом саме цією річчю
    if (z) return (w[z] || 0) + own;
    if ((R.HAND_SLOTS || []).indexOf(e.slot) >= 0) return ((e.base && e.base.category === 'Щити') ? w.shield : w.weapon) + own;
    return own;
  }
  function itemWear(ctx, e, w) { return Math.max(0, (e.off ? (e.w1 || 0) : wearOf(ctx, e, w)) - (e.w0 || 0)); }
  function leftDur(ctx, st, e) { return e.dur == null ? null : Math.max(0, e.dur - itemWear(ctx, e, st.wear)); }

  /* вдягнені речі [{base, inst}] → легкі записи бою */
  function eqLite(eq) {
    return (eq || []).map(function (e) {
      return { uid: e.inst.uid, slot: e.inst.slot, w0: 0,
        dur: (e.inst.durMax == null ? null : num(e.inst.durCur != null ? e.inst.durCur : e.inst.durMax)),
        base: e.base, inst: { uid: e.inst.uid, id: e.inst.id, slot: e.inst.slot, bonus: e.inst.bonus, durMax: e.inst.durMax, durCur: e.inst.durCur } };
    });
  }
  /* бойовий профіль Героя з того, що зараз на ньому (не зняте; зламане fighter не рахує) */
  function profile(ctx, st) {
    var p = ctx.R.fighter(st.me.stats,
      (st.me.eq || []).filter(function (e) { return !e.off; }).map(function (e) { return { base: e.base, inst: e.inst }; }), ctx.K);
    return skillProfile(st, p);
  }

  /* ══ ВМІННЯ ГЕРОЯ В БОЮ (sk-skills.js → UNIVERSAL) ══
     На старті бою — знімок: st.me.sk = {id: м} (майстерність 0…1, лише вивчені),
     st.me.bar = активні вміння з панелі. Ріст за бій рахується ОКРЕМО:
     st.me.grow = {id: вдалих}, st.me.growF = {id: невдалих}; після бою сервер
     додає вдалі до heroes/{id}.skills, а невдалі — до skillFails (2 невдалі = 1 вдале).
     Пасивні діють самі; активні (Пінок, Вогник) — гравець обирає на хід
     (useSkill): окремий удар у ту саму зону, що й основний, — його можна
     заблокувати. Бот вмінь не має. */
  /* Числа вмінь — не тут: на старті бою arena.html кладе в st.me.skv готові
     значення з sk-skills.js (SKSKILLS.skillValues — правила, типи, округлення),
     тож бій однаковий на будь-якій сторінці й не залежить від sk-skills.js. */
  var SKILL = { kick: { id: 'base.kick' }, spark: { id: 'base.spark' }, bash: { id: 'knight.bash' }, berserk: { id: 'knight.berserk' }, lunge: { id: 'knight.lunge' },
    bless: { id: 'knight.bless' }, disarm: { id: 'knight.disarm' }, haft: { id: 'knight.haft' }, daze: { id: 'knight.daze' }, stun: { id: 'knight.stun' }, lash: { id: 'knight.lash' },
    frenzy: { id: 'knight.frenzy' }, cleave: { id: 'knight.cleave' }, ult: { id: 'knight.ult' },
    stone: { id: 'knight.stoneskin' }, song: { id: 'knight.song' }, shieldbreak: { id: 'knight.shieldbreak' },
    rhide: { id: 'ranger.hide' }, poison: { id: 'ranger.poison' }, bandage: { id: 'ranger.bandage' },
    sand: { id: 'ranger.sand' }, ambush: { id: 'ranger.ambush' }, aimed: { id: 'ranger.aimed' }, trap: { id: 'ranger.trap' } };
  /* вміння, що діють ДО ударів ходу (не окремий удар) */
  var PRE = { 'knight.berserk': 1, 'knight.bless': 1, 'knight.disarm': 1, 'knight.lunge': 1, 'knight.stoneskin': 1, 'knight.song': 1, 'knight.shieldbreak': 1, 'knight.frenzy': 1, 'knight.cleave': 1, 'ranger.hide': 1, 'ranger.poison': 1, 'ranger.bandage': 1, 'ranger.sand': 1, 'ranger.ambush': 1, 'ranger.trap': 1 };
  /* СПІЛЬНІ ВМІННЯ: однакова назва в різних класах — однакова механіка й числа. Код пише id Лицаря,
     а в Героя іншого класу вміння лежить під своїм id — SAME зводить їх докупи (ріст іде у вміння Героя).
     Те, чим клас кращий, — не тут, а в перевагах класу (SKARENA.CLASS_PERKS). */
  var SAME = { 'ranger.dagger': 'knight.dagger', 'ranger.spear': 'knight.spear', 'ranger.whip': 'knight.whip',
    'ranger.fists': 'knight.fists', 'ranger.disarm': 'knight.disarm', 'ranger.brave': 'knight.brave',
    'ranger.lunge': 'knight.lunge', 'ranger.calm': 'knight.calm', 'ranger.second': 'knight.second', 'ranger.lash': 'knight.lash',
    'ranger.daze': 'knight.daze', 'ranger.dual': 'knight.offhand', 'ranger.enh': 'knight.enh', 'ranger.third': 'knight.third' };
  function canon(id) { return SAME[id] || id; }
  function skId(st, id) {                                    // id вміння так, як воно лежить у бійця
    var s = st.me && st.me.sk; if (!s || s[id] != null) return id;
    for (var k in SAME) if (SAME[k] === id && s[k] != null) return k;
    return id;
  }
  function V(st, id, k) { var v = st.me && st.me.skv && st.me.skv[skId(st, id)]; return v && v[k] != null ? num(v[k]) : 0; }
  function hasSk(st, id) { var s = st.me && st.me.sk; return !!(s && s[skId(st, id)] != null); }
  /* переваги класу бійця — знімок на старті бою (st.me.perk = {id: число}), як і вміння */
  function perksOf(R, cls) { var o = {}; ((R.CLASS_PERKS || {})[cls] || []).forEach(function (q) { if (q.v != null) o[q.id] = num(q.v); }); return o; }
  function perkOf(st, id) { var p = st.me && st.me.perk; return p ? num(p[id]) : 0; }
  function grow(st, id, ok) {
    if (!hasSk(st, id)) return;
    id = skId(st, id);
    var g = ok ? (st.me.grow || (st.me.grow = {})) : (st.me.growF || (st.me.growF = {}));
    g[id] = (g[id] || 0) + 1;
  }
  function shieldOn(st) { return !shieldOffNow(st.me, st.round) && !!shieldEntry(st.me); }
  /* щит у лівій руці (не знятий, не зламаний) і чи його зараз вибито («Розбити щит»: рука німіє) */
  function shieldEntry(u) { return ((u && u.eq) || []).filter(function (e) { return !e.off && !e.broken && e.slot === 'weaponL' && e.base && e.base.category === 'Щити'; })[0] || null; }
  function shieldOffNow(u, round) { var f = u && u.fx; return !!(f && num(f.shieldOff) >= round); }
  function weaponOn(st) { return (st.me.eq || []).filter(function (e) { return !e.off && !e.broken && e.slot === 'weaponR'; })[0] || null; }
  /* друга зброя в лівій руці (Друга зброя): не знята, не зламана */
  function leftWeapon(st) { return (st.me.eq || []).filter(function (e) { return !e.off && !e.broken && e.slot === 'weaponL' && e.base && e.base.category === 'Зброя'; })[0] || null; }
  function twoHandedBase(b) { return !!(b && b.weaponType !== 'knuckles' && (b.addStats || []).some(function (e) { return e && e.stat === 'Дворучний' && (e.flag || e.value == null); })); }
  /* Хватка велетня: дворучна в правій і щит у лівій одночасно */
  function gripOn(st) { var w = weaponOn(st); return !!(w && twoHandedBase(w.base) && shieldEntry(st.me)); }
  function exoticOn(st) { var w = weaponOn(st); return !!(w && w.base && w.base.weaponType === 'exotic'); }
  /* вміння зброї Лицаря: вид зброї в правій руці → id вміння (без зброї чи з кастетами — «Голі руки») */
  var WEAPON_SKILL = { sword: 'knight.sword', axe: 'knight.axe', spear: 'knight.spear', knuckles: 'knight.fists',
    dagger: 'knight.dagger', mace: 'knight.mace', flail: 'knight.flail', whip: 'knight.whip', staff: 'knight.staff', bow: 'ranger.bow' };
  /* ліва рука вільна: ні щита, ні другої речі (зламане не рахується) */
  function leftFree(st) { return !(st.me.eq || []).some(function (e) { return !e.off && !e.broken && e.slot === 'weaponL'; }); }
  function weaponSkill(st) {
    var w = weaponOn(st);
    if (!w) return 'knight.fists';
    return (w.base && WEAPON_SKILL[w.base.weaponType]) || null;
  }
  /* сталі пасивні — у профіль (перераховується при перевдяганні й поломці) */
  function skillProfile(st, p) {
    if (!st.me || !st.me.sk) return p;
    var ex = exoticOn(st) ? V(st, 'base.exotic', 'dmgPct') : 0;
    var ws = weaponSkill(st);
    if (ws === 'knight.staff' && num(p.magMax) > 0) ws = null;          // магічний посох — не для Лицаря
    var wd = ws && hasSk(st, ws) ? V(st, ws, 'dmgPct') : 0;
    p.dmgPct = num(p.dmgPct) + V(st, 'base.weapons', 'dmgPct') + ex + wd + V(st, 'knight.enh', 'dmgPct');   // Посилений урон — фізичний
    p.magPct = num(p.magPct) + V(st, 'base.magic', 'magPct') + ex;
    if (ws === 'knight.sword' && V(st, ws, 'accPct')) p.accuracy = Math.round(num(p.accuracy) * (1 + V(st, ws, 'accPct') / 100));
    if (ws === 'knight.axe' && V(st, ws, 'pierce')) p.pierce = V(st, ws, 'pierce');
    if (ws === 'knight.dagger' && V(st, ws, 'critPct')) p.critPct = num(p.critPct) + V(st, ws, 'critPct');
    if (ws === 'ranger.bow' && V(st, ws, 'accPct')) p.accuracy = Math.round(num(p.accuracy) * (1 + V(st, ws, 'accPct') / 100));
    if (ws === 'knight.whip' && V(st, ws, 'accPct')) p.accuracy = Math.round(num(p.accuracy) * (1 + V(st, ws, 'accPct') / 100));
    if (ws === 'knight.fists' && hasSk(st, ws)) {
      // Голі руки: без зброї — свій урон 3–8 (до бази 8 → 11–16); з кастетами — урон кастетів
      if (!weaponOn(st)) { p.wMin = num(p.wMin) + V(st, ws, 'dmgMin'); p.wMax = num(p.wMax) + Math.max(V(st, ws, 'dmgMin'), V(st, ws, 'dmgMax')); }
      if (shieldOn(st) && V(st, ws, 'accPct')) p.accuracy = Math.round(num(p.accuracy) * (1 + V(st, ws, 'accPct') / 100));   // кулак + щит
    }
    if (gripOn(st) && hasSk(st, 'knight.grip')) {   // Хватка велетня: поки не 100% — штраф точності й урону
      var gp = V(st, 'knight.grip', 'accPen'), gd = V(st, 'knight.grip', 'dmgPct') || 100;
      if (gp) p.accuracy = Math.max(1, Math.round(num(p.accuracy) * (1 - gp / 100)));
      if (gd < 100) p.dmgPct = num(p.dmgPct) - (100 - gd);
      p.grip = [gp, gd];
    }
    // Слідопит: Майстер зброї — урон будь-якою зброєю; переваги класу — крит з кинджалом, легка хода без щита
    var wt0 = (weaponOn(st) || { base: {} }).base.weaponType;
    if (wt0 === 'dagger' && perkOf(st, 'daggerCrit')) p.critPct = num(p.critPct) + perkOf(st, 'daggerCrit');
    if (!shieldEntry(st.me) && perkOf(st, 'lightStep')) p.agility = Math.round(num(p.agility) * (1 + perkOf(st, 'lightStep') / 100));
    if (weaponOn(st) && hasSk(st, 'ranger.wmaster')) p.dmgPct = num(p.dmgPct) + V(st, 'ranger.wmaster', 'dmgPct');
    if (hasSk(st, 'healer.poisonres')) p.resPoison = Math.min(100, num(p.resPoison) + V(st, 'healer.poisonres', 'resPct'));   // Цілитель: Стійкість до отрут
    if (V(st, 'knight.tough', 'hpPct')) p.hp = Math.round(num(p.hp) * (1 + V(st, 'knight.tough', 'hpPct') / 100));   // Міцне тіло: + максимум здоров'я
    var bp = shieldOn(st) ? V(st, 'knight.shield', 'blockPct') : 0;      // Блок щитом: + до «шансу блоку» щита
    if (bp) {
      if (p.evade) { p.blockPhys = num(p.blockPhys) + bp / 2; p.blockMag = num(p.blockMag) + bp / 2; }
      else { p.blockPhys = num(p.blockPhys) + bp; (p.blockSrc = p.blockSrc || []).push({ slot: 'weaponL', mag: false, v: bp, skill: true }); }
    }
    return p;
  }
  /* змінні пасивні цього ходу: концентрація (+5% урону за рівень) і зв'язок зі зброєю */
  /* і Берсерк (лють: +урон, −броня) */
  function berserkOn(st) { var f = st.me && st.me.fx; return !!(f && num(f.berserk) >= st.round); }
  function blessOn(st) { var f = st.me && st.me.fx; return !!(f && f.bless && num(f.bless.until) >= st.round); }
  function stoneOn(st) { var f = st.me && st.me.fx; return !!(f && f.stone && num(f.stone.until) >= st.round); }
  function songOn(st) { var f = st.me && st.me.fx; return !!(f && f.song && num(f.song.until) >= st.round); }
  function willOn(st) { var f = st.me && st.me.fx; return !!(f && num(f.will) >= st.round); }
  function frenzyOn(st) { var f = st.me && st.me.fx; return !!(f && num(f.frenzy) >= st.round); }
  /* суперник «обережний» після Розсікти: Розсікти на нього не діє, +careful% захисту від контролю */
  function carefulOn(u, round) { var f = u && u.fx; return !!(f && num(f.careful) >= round); }
  /* Залізна воля (пасивне): здоров'я < 20%, не діє й не на перезарядці — щоходу кидок chance;
     вдалося — броня +armorPct% на turns ходів (цей теж), потім перезарядка cd → запис для журналу або null */
  function willTry(ctx, v, rnd) {
    var id = 'knight.will';
    if (!hasSk(v, id) || willOn(v) || !(v.me.force > 0) || v.me.force >= v.me.max * 0.2) return null;   // лише на межі: ризиковано, щоб не зловживати
    var cd = (v.me.cd || {})[id]; if (cd && v.round <= cd) return null;
    var need = V(v, id, 'chance'), roll = ctx.R.d100(rnd), ok = roll <= need;
    grow(v, id, ok);
    var rec = { id: id, need: need, roll: roll, ok: ok };
    if (!ok) return rec;
    var f = fxOf(v.me), n = Math.max(1, V(v, id, 'turns') || 3);
    f.will = v.round + n - 1; f.willPct = V(v, id, 'armorPct') || 100;
    v.me.cd = v.me.cd || {}; v.me.cd[id] = v.round + (V(v, id, 'cd') || 10);
    rec.turns = n; rec.pct = f.willPct;
    return rec;
  }
  function turnBoost(st, p) {
    var f = fxOf(st.me), bz = berserkOn(st), bl = blessOn(st) ? num(f.bless.def) : 0, sg = songOn(st) ? f.song : null, wl = willOn(st);
    var add = V(st, 'base.focus', 'perLevel') * num(f.focus) + (f.bond ? V(st, 'base.bond', 'dmgPct') : 0) + (bz ? V(st, 'knight.berserk', 'dmgPct') : 0) + (sg ? num(sg.dmg) : 0);
    var tg = tangledOn(st) ? num(f.tangle.agi) : 0, fz = frenzyOn(st), bd = blindOn(st) ? f.blind : null, ar = arrowOn(st) ? num(f.arrow.weak) : 0;
    if (!add && !bz && !bl && !sg && !wl && !tg && !fz && !bd && !ar) return p;
    var o = {}, k; for (k in p) o[k] = p[k];
    o.dmgPct = num(o.dmgPct) + add; o.magPct = num(o.magPct) + add;
    if (sg && num(sg.acc)) o.accuracy = Math.round(num(o.accuracy) * (1 + num(sg.acc) / 100));   // Бойова пісня
    if (bl) { o.armor = Math.round(num(o.armor) * (1 + bl / 100)); o.magicResist = Math.round(num(o.magicResist) * (1 + bl / 100)); }   // Благословення
    if (wl) o.armor = Math.round(num(o.armor) * (1 + (num(f.willPct) || 100) / 100));              // Залізна воля
    if (bz) o.armor = Math.round(num(o.armor) * (1 - V(st, 'knight.berserk', 'armorCut') / 100));
    if (tg) o.agility = Math.max(0, Math.round(num(o.agility) * (1 - tg / 100)));                   // сплутаний (Захльост)
    if (fz) o.extra = num(o.extra) + 1;                                                              // Бойовий шал: +1 удар за хід
    if (bd) { o.accuracy = Math.max(1, Math.round(num(o.accuracy) * (1 - num(bd.acc) / 100))); o.agility = Math.max(0, Math.round(num(o.agility) * (1 - num(bd.agi) / 100))); }   // осліплений (Пісок в очі)
    if (ar) { o.dmgPct = num(o.dmgPct) - ar; o.magPct = num(o.magPct) - ar; }                        // стріла застрягла — б'є слабше
    return o;
  }
  /* сплутаний Захльостом: спритність −agi% з наступного ходу до tangle.until */
  function tangledOn(st) { var f = st.me && st.me.fx; return !!(f && f.tangle && num(f.tangle.until) >= st.round && num(f.tangle.from) <= st.round); }
  /* суперник без зброї (Обеззброєння): урон зброї в руках не діє; щит лишається */
  function disarmedOn(st) { var f = st.op && st.op.fx; return !!(f && num(f.disarm) >= st.round); }
  function noWeapon(p) { var o = {}, k; for (k in p) o[k] = p[k]; o.wMin = 0; o.wMax = 0; o.magMin = 0; o.magMax = 0; o.dmgType = 'bash'; return o; }   // без зброї — кулаки (тупий)
  function opHasWeapon(p) { return num(p && p.wMax) > 0 || num(p && p.magMax) > 0; }
  /* без щита («Розбити щит»): мінус броня й маг. захист щита, мінус його шанс блоку (і Блок щитом), без відскоку */
  function noShield(ctx, p, e) {
    var o = {}, k; for (k in p) o[k] = p[k];
    var src = p.blockSrc || [], keep = src.filter(function (s) { return s.slot !== 'weaponL'; });
    var sum = function (l, mg) { return l.filter(function (s) { return !!s.mag === mg; }).reduce(function (a, s) { return a + num(s.v); }, 0); };
    if (e && e.base && ctx.R.fighter) {
      var d = ctx.R.fighter({}, [{ base: e.base, inst: e.inst }], ctx.K);
      o.armor = Math.max(0, num(o.armor) - num(d.armor)); o.magicResist = Math.max(0, num(o.magicResist) - num(d.magicResist));
    }
    if (p.evade) { o.evade = false; o.blockPhys = sum(keep, false); o.blockMag = sum(keep, true); }
    else {
      var off = src.filter(function (s) { return s.slot === 'weaponL'; });
      o.blockPhys = Math.max(0, num(p.blockPhys) - sum(off, false)); o.blockMag = Math.max(0, num(p.blockMag) - sum(off, true));
    }
    o.blockSrc = keep; o.noShield = true;
    return o;
  }
  function opShield(st) {                                   // щит у суперника (у бота — з легкого списку речей)
    var o = st.op || {};
    if (shieldOffNow(o, st.round)) return false;            // щит вибито — його зараз немає
    if ((o.eq || []).some(function (e) { return !e.off && !e.broken && e.slot === 'weaponL' && e.base && e.base.category === 'Щити'; })) return true;
    return ((o.f && o.f.eq) || []).some(function (e) { return e && e.slot === 'weaponL' && e.cat === 'Щити'; });
  }
  /* зброя в руці для вмінь: зламана чи вибита (Обеззброєння) — не рахується */
  function heroDisarmed(st) { var f = st.me && st.me.fx; return !!(f && num(f.disarm) >= st.round); }
  function wTypeNow(st) { var w = heroDisarmed(st) ? null : weaponOn(st); return (w && w.base && w.base.weaponType) || ''; }
  /* якою зброєю можна виконати вміння */
  var SKILL_WEAPONS = { 'knight.lunge': ['sword', 'dagger', 'spear'], 'knight.haft': ['spear', 'staff'],
    'knight.shieldbreak': ['axe', 'mace', 'flail', 'staff', 'sword'], 'knight.stun': ['mace', 'flail'], 'knight.lash': ['whip', 'flail'], 'knight.cleave': ['sword', 'axe'], 'ranger.aimed': ['bow'] };
  /* Розбити щит: шанс залежить від зброї — сокира найкраща, булава/кистень/посох трохи гірше, меч ще трохи гірше */
  var SHATTER_MUL = { axe: 1, mace: 0.85, flail: 0.85, staff: 0.85, sword: 0.7 };
  function skillWeaponOk(st, id) { var l = SKILL_WEAPONS[id]; return !l || l.indexOf(wTypeNow(st)) >= 0; }
  /* Парирування: шанс відбити за видом зброї в руці (на 100% прокидання) */
  var PARRY = { sword: 20, dagger: 15, spear: 15, staff: 15, axe: 6, mace: 6, flail: 6 };
  function parryChance(st) {
    var wt = wTypeNow(st);
    if (wt === 'staff' && hasSk(st, 'knight.staff') && !(num(st.me.p && st.me.p.magMax) > 0)) return PARRY.sword;   // Посох: парирує як меч
    return PARRY[wt] || 0;
  }
  /* ── ОДНА СПЕЦДІЯ ЗА ХІД: вміння, АБО річ із пояса, АБО перевдягання ──
     Вибір вміння знімає вибір пояса й навпаки; перевдягання знімає обидва,
     і після нього цього ходу ні вміння, ні пояс уже не обрати. */
  /* ОГЛУШЕННЯ (збити з ніг): оглушений цього ходу не атакує й не робить спецдії
     (ні вміння, ні пояс, ні перевдягання). Імунітет: поки лежить — нового оглушення немає,
     ходом пізніше — шанс навпіл, ще ходом пізніше — як завжди (skillStrike) */
  function knockedNow(st, u) { return !!(u && u.fx && u.fx.knock === st.round); }
  function beltChosen(st) { return !!(st.me.use && st.me.useRound === st.round); }
  function swapped(st) { return st.swapRound === st.round && !beltChosen(st); }   // старі бої: пояс теж ставив swapRound
  /* чому активне вміння зараз не можна ('' — можна) */
  function skillBlock(st, id) {
    if (!isLive(st)) return 'over';
    id = canon(id);                                               // спільне вміння іншого класу — як у Лицаря (перезарядка теж під його id)
    if ((st.me.bar || []).map(canon).indexOf(id) < 0 || !hasSk(st, id)) return 'none';
    if (TOG[id]) return id === 'ranger.camo' && camoLocked(st) ? 'locked' : id === 'ranger.hunter' && togOn(st, id) && blindOn(st) ? 'eyeblind' : '';   // перемикач: дії ходу не забирає; Око осліплене — не діє (мана йде), вимкнути можна
    if (knockedNow(st, st.me)) return 'knock';                   // оглушений — спецдій немає
    if (swapped(st)) return 'swap';                              // цього ходу вже перевдягнувся
    var cd = (st.me.cd || {})[id];
    if (cd && st.round <= cd) return 'cd';
    if ((st.me.once || {})[id]) return 'used';                    // раз за бій — уже було
    if ((id === SKILL.berserk.id && berserkOn(st)) || (id === SKILL.bless.id && blessOn(st))
      || (id === SKILL.stone.id && stoneOn(st)) || (id === SKILL.song.id && songOn(st)) || (id === SKILL.frenzy.id && frenzyOn(st))) return 'active';   // ще діє
    if (id === SKILL.cleave.id && carefulOn(st.op, st.round)) return 'careful';    // ворог обережний — Розсікти чекає, хід не марнується
    if (id === SKILL.ult.id && !(num((st.me.fx || {}).focus) > 0)) return 'focus';  // Королівська лють — потрібна концентрація
    if (id === SKILL.ult.id && num(st.op.force) < num(st.op.max) * (V(st, id, 'hpMin') || 30) / 100) return 'hp';   // … і в ворога ще щонайменше hpMin % здоров'я (не добиває)
    if (id === SKILL.shieldbreak.id && !opShield(st) && !shieldOffNow(st.op, st.round)) return 'noshield';   // у суперника немає щита — хід не марнується
    if (id === SKILL.spark.id && num(st.me.mana) < (V(st, id, 'mana') || 5)) return 'mana';
    if (V(st, id, 'mana') && num(st.me.mana) < V(st, id, 'mana')) return 'mana';   // Берсерк 100, Благословення 50
    if (id === SKILL.bash.id && !shieldOn(st)) return 'shield';
    if (id === SKILL.bandage.id && !(num(st.me.force) < num(st.me.max)) && !(V(st, id, 'cleanse') && poisoned(st.me, st.round))) return 'full';   // Перев'язка: здоров'я повне — чекає
    if (id === SKILL.poison.id && venomOn(st)) return 'active';                  // зброя ще змащена
    if (id === SKILL.trap.id && trapOn(st)) return 'active';                     // Пастка ще стоїть
    if (id === SKILL.poison.id && !wTypeNow(st)) return 'weapon';                // змастити можна лише зброю в руці
    if (id === SKILL.ambush.id && !(togOn(st, 'ranger.camo') && !camoLocked(st))) return 'camo';   // Засідка — лише з Камуфляжем
    if (id === SKILL.sand.id && st.op.fx && (blindOn(mirror(st)) || num(st.op.fx.blindImm) >= st.round)) return 'blind';   // ще сліпий чи оговтується
    if (!skillWeaponOk(st, id)) return 'weapon';                   // Випад, Удар древком — лише своєю зброєю (не вибитою)
    return '';
  }
  /* обрати активне вміння (id) або скасувати (null). Вибір ЛИШАЄТЬСЯ на наступні ходи:
     вміння б'є щоходу, коли доступне; на перезарядці чи без мани — чекає, не скидається. */
  function useSkill(ctx, st, id) {
    if (!isLive(st)) return false;
    if (id == null) { if (st.me.skill) { st.me.skill = null; st.rev++; return true; } return false; }
    if (TOG[canon(id)]) { var tw = skillBlock(st, id); return tw && tw !== 'locked' && tw !== 'knock' && tw !== 'swap' && tw !== 'eyeblind' ? false : toggleSkill(st, canon(id)); }   // перемикач: увімкнути / вимкнути
    var why = skillBlock(st, id);
    if (why && why !== 'cd' && why !== 'mana' && why !== 'shield' && why !== 'weapon' && why !== 'active' && why !== 'noshield' && why !== 'careful' && why !== 'focus' && why !== 'hp' && why !== 'full' && why !== 'camo' && why !== 'blind') return false;
    if (beltChosen(st)) { st.me.use = null; st.swapRound = 0; }   // вміння замість речі з пояса
    st.me.skill = id; st.rev++;
    return true;
  }
  /* удар активним вмінням у зону основної атаки. Повертає запис для журналу. */
  function skillStrike(ctx, st, id, pm, po, blocked, rnd) {
    var R = ctx.R, rec = { id: id, ok: false, dmg: 0, kind: 'fail' };
    var need = V(st, id, 'chance'), roll = R.d100(rnd);         // 50% на 25% → 100% на 100%
    rec.need = need; rec.roll = roll;
    if (id === SKILL.spark.id) {
      var cost = V(st, id, 'mana') || 5;                         // мана витрачається повністю, навіть якщо не вдалося
      st.me.mana = Math.max(0, num(st.me.mana) - cost); rec.mana = cost;
    }
    var magic = id === SKILL.spark.id, cfg = { min: V(st, id, 'dmgMin'), max: Math.max(V(st, id, 'dmgMin'), V(st, id, 'dmgMax')) };
    if (roll > need) { grow(st, id, false); if (magic) grow(st, 'base.magic', false); rec.calc = 'не вдалося: 🎲 ' + roll + ' > ' + need + '%'; return rec; }
    rec.ok = true;
    // вдале — лише коли вміння влучило; не вийшло чи заблоковано — невдале
    var miss = function () { grow(st, id, false); if (magic) grow(st, 'base.magic', false); };
    if (blocked) { miss(); rec.kind = 'block'; rec.calc = 'вдалося 🎲 ' + roll + ' ≤ ' + need + '% · блок — суперник захистив цю зону'; return rec; }
    if (magic && num(po.blockMag) > 0) {
      var bn = Math.min(100, Math.round(num(po.blockMag))), br = R.d100(rnd);
      if (br <= bn) { miss(); rec.kind = 'block'; rec.byChance = true; rec.calc = 'вдалося · заблоковано шансом 🎲 ' + br + ' ≤ ' + bn + '% (маг.)'; return rec; }
    }
    if (!magic && cfg.max <= 0) {                                 // лише контроль (Поштовх щитом): дійшов — без урону, далі кидок збити з ніг
      grow(st, id, true); rec.kind = 'hit'; rec.dmg = 0; rec.physDmg = 0; rec.noDmg = true; rec.calc = 'вдалося 🎲 ' + roll + ' ≤ ' + need + '% · без урону';
      knockTry(st, id, rec, R, rnd); return rec;
    }
    var raw = cfg.min + Math.floor(rnd() * (cfg.max - cfg.min + 1));
    var defV = magic ? num(po.magicResist) : num(po.armor);
    var pass = R.armorPass ? R.armorPass(raw, defV) : 1;
    var pctV = magic ? num(pm.magPct) : 0;                       // Пінок не залежить від зброї
    var dmg = Math.max(1, Math.round(raw * pass * (1 + pctV / 100)));
    var rk = R.resCut ? R.resCut(dmg, magic ? 'magic' : 'bash', po) : { r: 0 }; if (rk.r) { dmg = rk.dmg; rec.res = rk.r; }   // Вогник — магія, Пінок — тупий: опір останнім
    grow(st, id, true); if (magic) grow(st, 'base.magic', true);
    rec.kind = 'hit'; rec.dmg = dmg; rec.magic = magic; rec.raw = raw;
    if (magic) rec.magDmg = dmg; else rec.physDmg = dmg;
    rec.calc = (magic ? '✨маг. ' : '') + raw + (defV > 0 ? ' × ' + Math.round(pass * 100) + '% (' + (magic ? 'маг. захист ' : 'броня ') + defV + ')' : '')
      + (pctV ? ' × ' + Math.round(100 + pctV) + '%' : '') + (rec.res ? ' × ' + (100 - rec.res) + '% опір' : '');
    if (!magic) knockTry(st, id, rec, R, rnd);                    // Пінок може збити з ніг
    return rec;
  }
  /* «Двійка» (Голі руки): без зброї чи з кастетами і з ВІЛЬНОЮ лівою рукою — з шансом combo
     лівий кулак б'є вдруге цього ходу: пів урону, свій кидок влучання, зона — 🎲 випадкова
     (суперник блокує її, лише якщо випадково захистив саме її). Дописується в meHit.hits. */
  function comboTry(ctx, st, meHit, pm, po, opBlock, rnd) {
    var id = 'knight.fists';
    if (weaponSkill(st) !== id || !hasSk(st, id) || !leftFree(st)) return;
    var need = V(st, id, 'combo'); if (!(need > 0)) return;
    var roll = ctx.R.d100(rnd), c = { need: need, roll: roll, ok: roll <= need };
    meHit.combo = c;
    if (!c.ok) { if (meHit.hits[0]) meHit.hits[0].comboMiss = [roll, need]; return; }   // для журналу: кидок «Двійки» не вдався
    var zone = pick(ZONES, rnd), att = {}, k;
    for (k in pm) att[k] = pm[k];
    att.dmgMul = 0.5;
    var h = ctx.R.strike(att, po, zone === opBlock, rnd);
    h.combo = [roll, need]; h.zone = zone; c.zone = zone;
    meHit.hits.push(h);
    meHit.dmg = meHit.hits.reduce(function (a, x) { return a + (x.dmg || 0); }, 0);
    var ks = meHit.hits.map(function (x) { return x.kind; });
    meHit.kind = ks.indexOf('crit') >= 0 ? 'crit' : ks.indexOf('hit') >= 0 ? 'hit' : ks.indexOf('block') >= 0 ? 'block' : 'dodge';
    meHit.crit = meHit.hits.some(function (x) { return x.crit; });
  }
  /* Випад: не окремий удар, а посилення ОСНОВНОГО удару цього ходу (перезарядки немає — можна щоходу).
     Вдалося (шанс 50% → 100%) — урон ×(1 + dmgPct%), броня ворога рахується на armor %; і з шансом
     extra % — ще один звичайний удар (×1) у ту саму зону. Не вдалося — звичайний удар. */
  function lungeTry(ctx, st, id, pm, rnd) {
    var need = V(st, id, 'chance'), roll = ctx.R.d100(rnd), rec = { id: id, need: need, roll: roll, ok: roll <= need, dmg: 0 };
    if (!rec.ok) { rec.kind = 'fail'; grow(st, id, false); return { rec: rec }; }
    var att = {}, k; for (k in pm) att[k] = pm[k];
    rec.kind = 'lunge'; rec.mul = Math.round((1 + V(st, id, 'dmgPct') / 100) * 100) / 100; rec.armor = V(st, id, 'armor');
    att.dmgMul = Math.round(rec.mul * (num(pm.dmgMul) || 1) * 100) / 100; att.armorPct = rec.armor;   // Камуфляж і Сховатись множаться
    var lc = perkOf(st, 'lungeCrit'); if (lc) { att.critPct = num(att.critPct) + lc; rec.critPlus = lc; }   // перевага Слідопита «Точний випад»
    var ex = V(st, id, 'extra');
    if (ex > 0) { rec.exNeed = ex; rec.exRoll = ctx.R.d100(rnd); rec.extra = rec.exRoll <= ex; }
    return { rec: rec, att: att };
  }
  /* Берсерк: не удар, а лють на кілька ходів — кидається ДО ударів цього ходу.
     Тривалість — 🎲 turnsMin…turnsMax ходів. Вдалося — раз за бій (більше не обирається); не вдалося — можна знову наступного ходу. */
  function berserkTry(ctx, st, id, rnd) {
    var need = V(st, id, 'chance'), roll = ctx.R.d100(rnd), rec = { id: id, need: need, roll: roll, ok: roll <= need, dmg: 0 };
    grow(st, id, rec.ok);
    if (!rec.ok) { rec.kind = 'fail'; rec.calc = 'не вдалося: 🎲 ' + roll + ' > ' + need + '%'; return rec; }
    var lo = Math.max(1, V(st, id, 'turnsMin') || 3), hi = Math.max(lo, V(st, id, 'turnsMax') || lo);
    var n = lo + Math.floor(rnd() * (hi - lo + 1));               // 🎲 скільки ходів триває лють
    fxOf(st.me).berserk = st.round + n - 1;
    var mn = V(st, id, 'mana'); if (mn) { st.me.mana = Math.max(0, num(st.me.mana) - mn); rec.mana = mn; }   // мана — лише коли спрацювало
    rec.kind = 'buff'; rec.turns = n; rec.dmgPct = V(st, id, 'dmgPct'); rec.armorCut = V(st, id, 'armorCut');
    return rec;
  }
  /* Благословення: як лють — 🎲 turnsMin…turnsMax ходів; −mana лише коли вдалося; броня й маг. захист +defPct%,
     лікує heal% здоров'я на початку кожного ходу дії (і цього теж) */
  function blessTry(ctx, st, id, rnd) {
    var need = V(st, id, 'chance'), roll = ctx.R.d100(rnd), rec = { id: id, need: need, roll: roll, ok: roll <= need, dmg: 0 };
    grow(st, id, rec.ok);
    if (!rec.ok) { rec.kind = 'fail'; rec.calc = 'не вдалося: 🎲 ' + roll + ' > ' + need + '%'; return rec; }
    var lo = Math.max(1, V(st, id, 'turnsMin') || 3), hi = Math.max(lo, V(st, id, 'turnsMax') || lo);
    var n = lo + Math.floor(rnd() * (hi - lo + 1));
    fxOf(st.me).bless = { until: st.round + n - 1, def: V(st, id, 'defPct'), heal: V(st, id, 'heal') };
    var mn = V(st, id, 'mana'); if (mn) { st.me.mana = Math.max(0, num(st.me.mana) - mn); rec.mana = mn; }
    rec.kind = 'bless'; rec.turns = n; rec.defPct = V(st, id, 'defPct'); rec.heal = V(st, id, 'heal');
    return rec;
  }
  /* Кам'яна шкіра й Бойова пісня: шанс 50% → 100%; вдалося — −mana, діє 🎲 turnsMin…turnsMax ходів (цей теж);
     Залізна воля: броня ×2 на turns ходів, вдалося — перезарядка cd. Поки діє — знову не обрати */
  function buffTry(ctx, st, id, rnd) {
    var need = V(st, id, 'chance'), roll = ctx.R.d100(rnd), rec = { id: id, need: need, roll: roll, ok: roll <= need, dmg: 0 };
    grow(st, id, rec.ok);
    if (!rec.ok) { rec.kind = 'fail'; rec.calc = 'не вдалося: 🎲 ' + roll + ' > ' + need + '%'; return rec; }
    var n = V(st, id, 'turns');
    if (!n) { var lo = Math.max(1, V(st, id, 'turnsMin') || 3), hi = Math.max(lo, V(st, id, 'turnsMax') || lo); n = lo + Math.floor(rnd() * (hi - lo + 1)); }
    var until = st.round + n - 1;
    if (id === SKILL.stone.id) { fxOf(st.me).stone = { until: until, cut: V(st, id, 'cut') }; rec.kind = 'stone'; rec.cut = V(st, id, 'cut'); }
    else if (id === SKILL.frenzy.id) { fxOf(st.me).frenzy = until; rec.kind = 'frenzy'; }
    else { fxOf(st.me).song = { until: until, acc: V(st, id, 'accPct'), dmg: V(st, id, 'dmgPct') }; rec.kind = 'song'; rec.accPct = V(st, id, 'accPct'); rec.dmgPct = V(st, id, 'dmgPct'); }
    var cdN = V(st, id, 'cd'); if (cdN > 0) { st.me.cd = st.me.cd || {}; st.me.cd[id] = st.round + cdN; }
    var mn = V(st, id, 'mana'); if (mn) { st.me.mana = Math.max(0, num(st.me.mana) - mn); rec.mana = mn; }
    rec.turns = n;
    return rec;
  }
  /* Стійкість цілі (st.op): шанс встояти проти контролю. → true — встояв. Ріст — у цілі (Герой; бот — у межах бою). */
  function steadyTry(R, st, rec, rnd) {
    var tv = { me: st.op, op: st.me, round: st.round };
    if (carefulOn(st.op, st.round)) {                          // обережний (після Розсікти): ще careful% встояти
      var cn = num(st.op.fx.carefulPct) || 10, cr = R.d100(rnd);
      rec.careful = [cr, cn, cr <= cn];
      if (cr <= cn) return true;
    }
    if (!hasSk(tv, 'knight.steady')) return false;
    var need = V(tv, 'knight.steady', 'resist'), r = R.d100(rnd), ok = r <= need;
    grow(tv, 'knight.steady', ok);
    rec.steady = [r, need, ok];
    return ok;
  }
  /* Розбити щит: лише проти щита. Шанс 50% → 100% — ще до ударів: щит відлітає, рука німіє —
     ворог без щита turns ходів (цей і наступний), потім піднімає його сам. Стійкість може врятувати. */
  function shatterTry(ctx, st, id, rnd) {
    var rec = { id: id, dmg: 0 }, fo = fxOf(st.op);
    if (shieldOffNow(st.op, st.round)) { rec.kind = 'immune'; rec.ok = false; return rec; }
    if (!opShield(st)) { rec.kind = 'noshield'; rec.ok = false; return rec; }
    var wt = wTypeNow(st), mul = SHATTER_MUL[wt] || 0, w = weaponOn(st);
    var two = !!(w && w.base && ctx.R.isTwoHanded && ctx.R.isTwoHanded(w.base));   // дворучна — розбиває краще (×1.25)
    if (two) mul = Math.round(mul * 1.25 * 100) / 100;
    var need = Math.min(100, Math.round(V(st, id, 'chance') * mul)), roll = ctx.R.d100(rnd);
    rec.need = need; rec.roll = roll; rec.ok = roll <= need; rec.wt = wt; rec.mul = mul; rec.two = two;
    grow(st, id, rec.ok);
    if (!rec.ok) rec.kind = 'fail';
    else if (steadyTry(ctx.R, st, rec, rnd)) rec.kind = 'saved';
    else { rec.turns = Math.max(1, V(st, id, 'turns') || 2); fo.shieldOff = st.round + rec.turns - 1; rec.kind = 'shatter'; }
    var cdN = V(st, id, 'cd'); if (cdN > 0) { st.me.cd = st.me.cd || {}; st.me.cd[id] = st.round + cdN; }
    return rec;
  }
  /* Кам'яна шкіра того, кого б'ють (v): урон кожного удару −cut% (щонайменше 1) */
  function stoneCut(v, hit) {
    if (!hit || !stoneOn(v)) return;
    var cut = num(v.me.fx.stone.cut), hs = hit.hits && hit.hits.length ? hit.hits : null;
    var f = function (h) {
      if (!(num(h.dmg) > 0)) return;
      var was = h.dmg; h.dmg = Math.max(1, Math.round(was * (1 - cut / 100))); h.stone = [was, cut];
      var k = h.dmg / was; if (h.magDmg) h.magDmg = Math.round(h.magDmg * k); if (h.physDmg) h.physDmg = h.dmg - num(h.magDmg);
    };
    if (hs) { hs.forEach(f); hit.dmg = hs.reduce(function (a, h) { return a + (h.dmg || 0); }, 0); if (hit.physDmg != null) hit.physDmg = hit.dmg; }
    else f(hit);
  }
  /* Обеззброєння: шанс = 50 + (твоє володіння зброєю − ворога) / 2, у межах 10…90.
     Твоє — майстерність вміння зброї в руці (Меч, Сокира, Спис, Голі руки); бот вмінь не має —
     його володіння = рівень × 5 (до 100). Вдалося — ворог без зброї цей хід і наступний (підбирає через хід). */
  function disarmTry(ctx, st, id, po, rnd) {
    var rec = { id: id, dmg: 0 };
    if (!opHasWeapon(po)) { rec.kind = 'noweapon'; rec.ok = false; return rec; }
    if (disarmedOn(st)) { rec.kind = 'immune'; rec.ok = false; return rec; }
    var ws = weaponSkill(st), my = ws && hasSk(st, ws) ? Math.round(num(st.me.sk[skId(st, ws)]) * 100) : 0;
    // володіння ворога: його вміння зброї в руці (бот-Лицар, Герой); немає вмінь — рівень × 5 (до 100)
    var tv = { me: st.op, op: st.me, round: st.round }, tws = weaponSkill(tv);
    var opl = tws && hasSk(tv, tws) ? Math.round(num(st.op.sk[skId(tv, tws)]) * 100) : Math.min(100, Math.max(0, num(st.op.f && st.op.f.level) * 5));
    var need = Math.max(10, Math.min(90, Math.round(50 + (my - opl) / 2))), roll = ctx.R.d100(rnd);
    rec.need = need; rec.roll = roll; rec.ok = roll <= need; rec.my = my; rec.opl = opl;
    grow(st, id, rec.ok);
    if (rec.ok) {
      rec.kind = 'disarm';
      if (st.mirror) {                                       // вибили зброю в Героя: летить у сумку; через хід повертається в руку сама (rearm), або вдягни раніше сам (дія ходу)
        var hv = { me: st.op, op: st.me, round: st.round }, wr = (st.op.eq || []).filter(function (e) { return !e.off && e.slot === 'weaponR'; })[0];
        if (wr) { wr.w1 = wearOf(ctx, wr, st.wear || {}); wr.off = true; rec.toBag = (wr.base && wr.base.name) || ''; var np = profile(ctx, hv); np.hp = st.op.p.hp; st.op.p = np;
          fxOf(st.op).pickup = { uid: wr.uid, at: st.round + 2 }; rec.back = st.round + 2; }
        fxOf(st.op).disarm = st.round + 1;                   // без зброї цей і наступний хід — як бот
      } else fxOf(st.op).disarm = st.round + 1;              // бот підбирає зброю через хід
      delete fxOf(st.op).venom;                              // вибита зброя — отрута з клинка зникла
    } else rec.kind = 'fail';
    var cdN = V(st, id, 'cd'); if (cdN > 0) { st.me.cd = st.me.cd || {}; st.me.cd[id] = st.round + cdN; }
    return rec;
  }
  /* Удар древком (лише зі списом) і Збити з пантелику: окремі удари звичайним ударом героя.
     Древко: удар ×1 в зону атаки + з шансом second % — ще ×1 у випадкову ІНШУ зону.
     Пантелик: удар ×0.5 у зону атаки; влучив — ворог втрачає концентрацію (Хоробрість ворога може врятувати). */
  function weaponStrike(ctx, st, id, pm, po, me, op, rnd) {
    var R = ctx.R, need = V(st, id, 'chance'), roll = R.d100(rnd), rec = { id: id, need: need, roll: roll, ok: roll <= need, dmg: 0, hits: [] };
    if (!rec.ok) { grow(st, id, false); rec.kind = 'fail'; rec.calc = 'не вдалося: 🎲 ' + roll + ' > ' + need + '%'; return rec; }
    var att = pm, def = po, k;
    if (id === SKILL.ult.id) {                                 // Королівська лють: −мана й уся концентрація K, удар ×(1 + perK%·K); обмежує лише мана
      var fm0 = fxOf(st.me), K = num(fm0.focus), mn = V(st, id, 'mana');
      fm0.focus = 0; if (mn) { st.me.mana = Math.max(0, num(st.me.mana) - mn); rec.mana = mn; }
      att = {}; for (k in pm) att[k] = pm[k];
      att.dmgMul = Math.round((1 + (V(st, id, 'perK') || 50) / 100 * K) * 100) / 100; rec.K = K; rec.mul = att.dmgMul;
    }
    if (id === SKILL.daze.id || id === SKILL.lash.id) { att = {}; for (k in pm) att[k] = pm[k]; att.dmgMul = (V(st, id, 'dmgMul') || (id === SKILL.lash.id ? 75 : 50)) / 100; }
    if (id === SKILL.aimed.id) {                               // Влучний постріл: −мана, постріл ×dmgMul
      att = {}; for (k in pm) att[k] = pm[k]; att.dmgMul = (V(st, id, 'dmgMul') || 120) / 100; rec.mul = att.dmgMul;
      var am = V(st, id, 'mana'); if (am) { st.me.mana = Math.max(0, num(st.me.mana) - am); rec.mana = am; }
    }
    if (id === SKILL.lash.id && opShield(st)) {               // Захльост огинає щит: шанс блоку щита (і Блок щитом) не діє, броня щита — так
      var ns = noShield(ctx, po, shieldEntry(st.op)); def = {}; for (k in po) def[k] = po[k];
      def.blockPhys = ns.blockPhys; def.blockMag = ns.blockMag; def.evade = ns.evade; def.blockSrc = ns.blockSrc; rec.aroundShield = true;
    }
    var ult = id === SKILL.ult.id;                             // Королівська лють: блок (закрита зона чи шанс блоку щита) лише ополовинює урон; парирування не діє
    var h1 = R.strike(att, ult ? noBlock(def) : def, ult ? false : me.atk === op.block, rnd); h1.zone = me.atk; h1.tag = id; if (ult) h1.cleave = true; rec.hits.push(h1);
    if (ult && (h1.kind === 'hit' || h1.kind === 'crit')) {
      ultBlock(R, h1, def, me.atk === op.block, rnd);
      var cap = Math.max(1, Math.round(num(st.op.max) * (V(st, id, 'dmgCap') || 25) / 100));   // стеля: не більше dmgCap % макс. здоров'я ворога — ультою не вбити
      if (h1.dmg > cap) { h1.calc = (h1.calc || '') + ' = ' + h1.dmg + ' · стеля ' + (V(st, id, 'dmgCap') || 25) + '% здоров\'я'; h1.dmg = cap; if (h1.magDmg) h1.magDmg = cap; else h1.physDmg = cap; h1.capped = true; }
    }
    if (rec.aroundShield && h1.kind === 'block' && !h1.byChance) h1.calc = 'суперник закрив цю зону — удар не пройшов (щит не зачеплено)';
    if (id === SKILL.haft.id) {
      var sec = V(st, id, 'second'); rec.secNeed = sec; rec.secRoll = R.d100(rnd);
      if (rec.secRoll <= sec) {
        var other = ZONES.filter(function (z) { return z !== me.atk; }), z2 = pick(other, rnd);
        var h2 = R.strike(pm, po, z2 === op.block, rnd); h2.zone = z2; rec.hits.push(h2);
      }
    }
    var landed = rec.hits.filter(function (h) { return h.kind === 'hit' || h.kind === 'crit'; });
    rec.dmg = rec.hits.reduce(function (a, h) { return a + (h.dmg || 0); }, 0); rec.physDmg = rec.dmg;
    rec.kind = landed.length ? 'hit' : 'block';
    grow(st, id, landed.length > 0);
    if (ult && h1.halfBlock) { landed = []; rec.halfBlock = true; }   // ульту заблоковано наполовину — без оглушення
    if (id === SKILL.daze.id && landed.length) {
      var fo = fxOf(st.op), had = num(fo.focus);
      if (steadyTry(R, st, rec, rnd)) rec.dazeSaved = true; else { fo.focus = 0; fo.dazed = st.round; rec.daze = true; rec.focusLost = had; }   // Стійкість ворога може врятувати; цього ходу концентрація вже не росте
    }
    if (id === SKILL.stun.id && landed.length) stunTry(R, st, id, rec, rnd);
    if (id === SKILL.aimed.id && landed.length) {             // стріла застрягла: ворог б'є слабше з наступного ходу
      var an = V(st, id, 'arrow'), ar = R.d100(rnd); rec.arrowNeed = an; rec.arrowRoll = ar;
      if (ar <= an) { var at = V(st, id, 'turns') || 3; fxOf(st.op).arrow = { from: st.round + 1, until: st.round + at, weak: V(st, id, 'weak') }; rec.arrow = true; rec.turns = at; rec.weak = V(st, id, 'weak'); }
    }
    if (id === SKILL.ult.id && landed.length) {              // влучила — ворог пропускає наступний хід; Стійкість не рятує
      var fu = fxOf(st.op); rec.stun = true; fu.knock = st.round + 1; fu.stun = st.round + 1; fu.stunImm = st.round + 3;
    }
    if (id === SKILL.lash.id && landed.length) {             // сплутування: спритність −agi% на turns ходів, починаючи з наступного
      if (steadyTry(R, st, rec, rnd)) rec.tangleSaved = true;
      else { var tn = Math.max(1, V(st, id, 'turns') || 1) + (weaponSkill(st) === 'knight.whip' ? V(st, 'knight.whip', 'tanglePlus') : 0); fxOf(st.op).tangle = { from: st.round + 1, until: st.round + tn, agi: V(st, id, 'agi') }; rec.tangle = true; rec.turns = tn; rec.agi = V(st, id, 'agi'); }
    }
    return rec;
  }
  /* Оглушливий удар: влучив — з шансом stun % ворог пропускає НАСТУПНИЙ хід (як збитий з ніг: ні удару, ні спецдій),
     далі 2 ходи імунітету до оглушення; поки лежить чи щойно підвівся (Поштовх, Пінок) — теж не оглушити. Стійкість рятує */
  function stunTry(R, st, id, rec, rnd) {
    var fo = fxOf(st.op), last = num(fo.knock);
    if ((last && last >= st.round) || num(fo.stunImm) >= st.round) { rec.stunImmune = true; return; }
    var need = V(st, id, 'stun') + (weaponSkill(st) === 'knight.mace' ? V(st, 'knight.mace', 'stunPct') : 0), r = R.d100(rnd);   // Булава: оглушує частіше
    rec.stunNeed = need; rec.stunRoll = r;
    if (!(need > 0 && r <= need)) return;
    if (steadyTry(R, st, rec, rnd)) { rec.stunSaved = true; return; }
    rec.stun = true; fo.knock = st.round + 1; fo.stun = st.round + 1; fo.stunImm = st.round + 3;
  }
  /* збити з ніг (Пінок, Поштовх щитом): суперник пропустить наступний хід.
     Імунітет після оглушення (fx.knock — хід, коли суперник лежав): поки лежить — збити не можна
     (він пропустив би й наступний хід), наступного ходу — шанс навпіл, далі — як завжди */
  function knockTry(st, id, rec, R, rnd) {
    var last = num(fxOf(st.op).knock);
    if (last && last === st.round) { rec.knockImmune = true; return; }
    var kn = V(st, id, 'knock');
    if (last && last === st.round - 1) { kn = Math.round(kn / 2); rec.knockHalf = true; }
    var kr = R.d100(rnd);
    rec.knockNeed = kn; rec.knockRoll = kr;
    if (kn > 0 && kr <= kn) {
      if (steadyTry(R, st, rec, rnd)) rec.knockSaved = true;          // Стійкість ворога: встояв
      else { rec.knock = true; fxOf(st.op).knock = st.round + 1; }
    }
  }
  /* пасивне з кидком (ухилення, щит): на кожен удар, що влучив, — кидок «прокинулось»
     (шанс = майстерність %). Прокинулось — очко росту і кидок ефекту (chance):
     вдалося — удар скасовано, вдале очко; ні — навчання на помилках. */
  function triggerHits(ctx, st, id, opHit, rnd, mark) {
    if (!hasSk(st, id)) return 0;
    if (id === 'base.dodge' && blindOn(st)) return 0;               // осліплений — не ухиляється
    var eng = V(st, id, 'engage'), need = V(st, id, 'chance') + (id === 'base.dodge' ? perkOf(st, 'dodgeUp') + (camoOn(st) ? V(st, 'ranger.camo', 'dodgePlus') : 0) : 0), n = 0;   // Спритний ухил, Камуфляж (Слідопит)
    (opHit.hits || []).forEach(function (h) {
      if (h.kind !== 'hit' && h.kind !== 'crit') return;
      if (h.cleave && id === 'base.shield') return;               // Розсікти: щит не блокує
      if (h.ambush) return;                                       // Засідку не уникнути
      var er = ctx.R.d100(rnd);
      if (!(eng > 0 && er <= eng)) return;                       // не прокинулось — без очка
      var r = ctx.R.d100(rnd), ok = need > 0 && r <= need;
      grow(st, id, ok);
      if (ok) { n++; mark(h, '🎲 ' + er + ' ≤ ' + eng + '% прокинулось · 🎲 ' + r + ' ≤ ' + need + '%'); h.dmg = 0; h.magDmg = 0; h.physDmg = 0; }
    });
    if (n) {
      opHit.dmg = (opHit.hits || []).reduce(function (a, h) { return a + (h.dmg || 0); }, 0);
      var ks = (opHit.hits || []).map(function (h) { return h.kind; });
      opHit.kind = ks.indexOf('crit') >= 0 ? 'crit' : ks.indexOf('hit') >= 0 ? 'hit' : ks.indexOf('block') >= 0 ? 'block' : 'dodge';
    }
    return n;
  }
  /* ── ДВА БІЙЦІ ──
     Дзеркальний погляд: той самий код вмінь для бота (me ↔ op). Ріст, пояс, перевдягання —
     лише Героя (вони читають st.me напряму й з дзеркалом не викликаються). */
  function mirror(st) { return { me: st.op, op: st.me, round: st.round, bid: st.bid, status: st.status, mirror: true, wear: st.wear }; }
  /* ── РОЗУМ БОТА: яке активне вміння взяти цього ходу ──
     st.op.ai = {use: % ходів, коли бот узагалі бере вміння; smart: розумний вибір}.
     Слабкий — рідко й навмання; сильний — Берсерк на початку, Благословення, коли мало здоров'я. */
  function botSkill(st, vo) {
    var ai = st.op.ai; if (!ai || !(st.op.bar || []).length) return null;
    var r = rng(st.bid + '|' + st.round + '|oai');
    if (r() * 100 >= num(ai.use)) return null;
    var can = (st.op.bar || []).filter(function (id) { return !skillBlock(vo, id) && (id !== SKILL.disarm.id || weaponOn(st)); });   // Обеззброєння — лише коли в Героя зброя в руці
    if (!can.length) return null;
    if (ai.smart) {
      var hp = st.op.force / Math.max(1, st.op.max);
      if (hp < 0.5 && can.indexOf(SKILL.bless.id) >= 0) return SKILL.bless.id;
      if (hp < 0.6 && can.indexOf(SKILL.stone.id) >= 0) return SKILL.stone.id;
      if (st.round <= 3 && can.indexOf(SKILL.berserk.id) >= 0) return SKILL.berserk.id;
      if (st.round <= 4 && can.indexOf(SKILL.song.id) >= 0) return SKILL.song.id;
      if (st.round <= 5 && can.indexOf(SKILL.frenzy.id) >= 0) return SKILL.frenzy.id;
      if (can.indexOf(SKILL.ult.id) >= 0 && num((st.op.fx || {}).focus) >= 3) return SKILL.ult.id;
      if (can.indexOf(SKILL.cleave.id) >= 0 && r() < 0.5) return SKILL.cleave.id;
      if (can.indexOf(SKILL.shieldbreak.id) >= 0 && r() < 0.6) return SKILL.shieldbreak.id;
      if (can.indexOf(SKILL.disarm.id) >= 0 && !heroDisarmed(st) && r() < 0.5) return SKILL.disarm.id;
      if (can.indexOf(SKILL.bash.id) >= 0 && r() < 0.5) return SKILL.bash.id;
    }
    return pick(can, r);
  }
  /* ── РІСТ БОТА В МЕЖАХ БОЮ: op.up = {id: [{u: спрацювань до +k%, pct, v: значення}, …]} (з arena.html).
     Невдале спрацювання — пів вдалого (як у Героя). Наступний бій — знову з бази. */
  function botGrowth(st) {
    var up = st.op.up; if (!up) return;
    var changed = false;
    Object.keys(up).forEach(function (id) {
      var eff = num((st.op.grow || {})[id]) + 0.5 * num((st.op.growF || {})[id]), best = null;
      (up[id] || []).forEach(function (x) { if (x && eff >= num(x.u)) best = x; });
      if (best && Math.round(num(st.op.sk[id]) * 100) < best.pct) { st.op.sk[id] = best.pct / 100; st.op.skv[id] = best.v; changed = true; }
    });
    if (changed && st.op.p0) { var hp = st.op.p.hp; st.op.p = skillProfile(mirror(st), clone(st.op.p0)); st.op.p.hp = hp; }
  }
  /* Берсерк / Благословення — до ударів */
  function preBuff(ctx, v, id, can, rnd) {
    if (!id || !can || skillBlock(v, id)) return null;
    var rec = id === SKILL.berserk.id ? berserkTry(ctx, v, id, rnd) : id === SKILL.bless.id ? blessTry(ctx, v, id, rnd)
      : (id === SKILL.stone.id || id === SKILL.song.id || id === SKILL.frenzy.id) ? buffTry(ctx, v, id, rnd) : null;
    if (rec && rec.ok) v.me.skill = null;
    return rec;
  }
  /* Благословення лікує на початку кожного ходу дії → скільки вилікувало */
  function blessTick(v) {
    if (!blessOn(v)) return 0;
    var f = v.me.fx, was = v.me.force;
    if (!(num(f.bless.heal) > 0)) return 0;
    v.me.force = Math.min(v.me.max, v.me.force + Math.round(v.me.max * num(f.bless.heal) / 100));
    return Math.max(0, Math.round(v.me.force - was));
  }
  /* Випад: ріст і (з шансом) ще один звичайний удар; щит у суперника — шанс блоку на нього ×2 */
  function lungeExtra(ctx, v, lunge, hit, pA, pD, blocked, rnd) {
    grow(v, SKILL.lunge.id, (hit.hits || []).some(function (h) { return h.kind === 'hit' || h.kind === 'crit'; }));
    if (!lunge.rec.extra || !hit.hits) return;
    var p2 = pD; if (opShield(v) && num(pD.blockPhys) > 0) { p2 = {}; for (var q in pD) p2[q] = pD[q]; p2.blockPhys = num(pD.blockPhys) * 2; }
    var lx = ctx.R.strike(pA, p2, blocked, rnd);
    lx.lungeExtra = true; if (p2 !== pD) lx.shieldX2 = true;
    addHit(hit, lx);
  }
  /* Друга атака: з шансом — ще один звичайний удар у ту саму зону */
  function secondTry(ctx, v, hit, pA, pD, blocked, rnd, left) {
    if (!hasSk(v, 'knight.second') || !hit.hits) return;
    var n2 = V(v, 'knight.second', 'extra'), d2 = ctx.R.d100(rnd);
    grow(v, 'knight.second', d2 <= n2);
    if (d2 <= n2) { var h2 = ctx.R.strike(pA, pD, blocked, rnd); h2.second = [d2, n2]; if (left) h2.left = true; addHit(hit, h2); }
  }
  /* ── 🏹 СЛІДОПИТ ── */
  /* Сховатись (раз за бій): цього ходу ворог тебе майже не бачить — кожен його удар, що влучив, з шансом hitCut % пролітає повз;
     твої удари цього ходу ×dmgMul% */
  function hideOn(st) { var f = st.me && st.me.fx; return !!(f && num(f.hide) === st.round); }
  function hideTry(ctx, st, id, rnd) {
    var need = V(st, id, 'chance'), roll = ctx.R.d100(rnd), rec = { id: id, need: need, roll: roll, ok: roll <= need, dmg: 0 };
    grow(st, id, rec.ok);
    if (!rec.ok) { rec.kind = 'fail'; return rec; }
    fxOf(st.me).hide = st.round; (st.me.once || (st.me.once = {}))[id] = true;
    var mn = V(st, id, 'mana'); if (mn) { st.me.mana = Math.max(0, num(st.me.mana) - mn); rec.mana = mn; }
    rec.kind = 'hide'; rec.hitCut = V(st, id, 'hitCut'); rec.mul = (V(st, id, 'dmgMul') || 130) / 100;
    return rec;
  }
  function hideMiss(ctx, v, inHit, rnd) {                       // v — той, хто сховався; inHit — удари по ньому
    if (!hideOn(v)) return;
    var cut = V(v, 'ranger.hide', 'hitCut'), n = 0;
    (inHit.hits || []).forEach(function (h) {
      if ((h.kind !== 'hit' && h.kind !== 'crit') || h.ambush) return;
      var r = ctx.R.d100(rnd); if (r > cut) return;
      n++; h.kind = 'dodge'; h.skillDodge = true; h.hideMiss = true; h.dodgeCalc = 'не помітив тебе 🫥 🎲 ' + r + ' ≤ ' + cut + '%'; h.dmg = 0; h.magDmg = 0; h.physDmg = 0;
    });
    if (n) {
      inHit.dmg = inHit.hits.reduce(function (a, h) { return a + (h.dmg || 0); }, 0);
      var ks = inHit.hits.map(function (h) { return h.kind; });
      inHit.kind = ks.indexOf('crit') >= 0 ? 'crit' : ks.indexOf('hit') >= 0 ? 'hit' : ks.indexOf('block') >= 0 ? 'block' : 'dodge';
    }
  }
  /* ── ПЕРЕМИКАЧІ (Камуфляж…): увімкнув — діє щоходу, поки є мана; дії ходу не забирають ──
     АЛГОРИТМ для всіх вмінь і заклинань-перемикачів (RULES kind 'toggle', у книзі — тип 'A', щоб стати на панель):
       • вмикаються й вимикаються ЛИШЕ в бою — тапом по вмінню на панелі бою (useSkill → toggleSkill);
         у книзі вмінь тап / подвійний клік / перетягування — лише ставлять вміння на панель, як будь-яке активне;
       • стан живе тільки в стані бою (st.me.tog): кожен бій починається з усіма вимкненими, finish() вимикає все;
       • мана — на початку кожного ходу (togTick), не вистачило — вимикається само (журнал: «не вистачило»);
       • дії ходу не забирають: поруч можна взяти активне вміння чи річ із пояса;
       • одночасно — один перемикач; два — лише з «Другим запалом» (другий дорожчий).
     Новий перемикач: правила з kind 'toggle' і mana у sk-skills.js, id — у TOG нижче, дія — там, де camoOn.
     st.me.tog — увімкнені за порядком. Другий — лише з «Другим запалом», коштує мани ×mul%.
     Камуфляж після Засідки «зачаївся» (fx.camoLock — до якого ходу): не діє, не їсть ману й не вимикається,
     а потім знову діє сам, якщо вистачає мани. */
  var TOG = { 'ranger.camo': 1, 'ranger.haste': 1, 'ranger.hunter': 1 };
  function togOn(st, id) { return (st.me.tog || []).indexOf(id) >= 0; }
  function camoLocked(st) { var f = st.me && st.me.fx; return !!(f && num(f.camoLock) >= st.round); }
  function camoOn(st) { var f = st.me && st.me.fx; return !!(f && num(f.camoOn) === st.round); }   // діє цього ходу (мана знята)
  function eyeOn(st) { var f = st.me && st.me.fx; return !!(f && num(f.hunterOn) === st.round) && !blindOn(st); }   // Око мисливця: мана знята й не осліплений
  function hasteOn(st) { var f = st.me && st.me.fx; return !!(f && num(f.hasteOn) === st.round); }   // Поспіх діє цього ходу (мана знята)
  function toggleSkill(st, id) {
    var l = st.me.tog || (st.me.tog = []), i = l.indexOf(id);
    if (id === 'ranger.camo' && camoLocked(st)) return false;
    if (i >= 0) l.splice(i, 1);
    else { if (l.length >= (hasSk(st, 'ranger.fire2') ? 2 : 1)) return false; l.push(id); }
    st.rev++;
    return true;
  }
  /* порядок оплати перемикачів — АВТОМАТИЧНО: дорожчий (за базовою ціною) платить ×1, дешевший — ×mul «Другого запалу».
     Камуфляж, що зачаївся, не платить — тоді інший платить ×1. Порядок увімкнення не важить. */
  function togOrder(st) {
    return (st.me.tog || []).map(function (id, i) { return { id: id, i: i, c: V(st, id, 'mana') }; })
      .sort(function (a, b) { return b.c - a.c || a.i - b.i; }).map(function (x) { return x.id; });
  }
  /* множник ціни перемикача цього ходу (100 — повна ціна, 200 — ×2…) — для панелі (×1 / ×2) */
  function togMul(st, id) {
    var first = togOrder(st).filter(function (x) { return !(x === 'ranger.camo' && camoLocked(st)); })[0];
    if (!togOn(st, id) || id === first) return 100;
    return V(st, 'ranger.fire2', 'mul') || 200;
  }
  /* початок ходу: зняти ману за кожен увімкнений перемикач → записи для журналу */
  function togTick(st) {
    var l = st.me.tog; if (!l || !l.length) return null;
    var out = [], f = fxOf(st.me), paid = 0;
    togOrder(st).forEach(function (id) {
      if (id === 'ranger.camo' && camoLocked(st)) { out.push({ id: id, locked: num(f.camoLock) }); return; }
      var cost = V(st, id, 'mana');
      if (paid > 0) cost = Math.round(cost * (V(st, 'ranger.fire2', 'mul') || 200) / 100);   // другий перемикач — дорожче
      if (num(st.me.mana) < cost) { l.splice(l.indexOf(id), 1); out.push({ id: id, off: true, cost: cost }); return; }
      st.me.mana = num(st.me.mana) - cost; paid++;
      if (id === 'ranger.camo') f.camoOn = st.round;
      if (id === 'ranger.haste') f.hasteOn = st.round;
      if (id === 'ranger.hunter') f.hunterOn = st.round;
      out.push({ id: id, cost: cost });
    });
    if (paid > 1) grow(st, 'ranger.fire2', true);
    return out;
  }
  /* Поспіх: ще один звичайний удар у ту саму зону (×dmgMul), свої кидки; Другу й Третю атаку не запускає.
     Лише коли боєць атакує цього ходу (не збитий з ніг, не наляканий) — мана знята в togTick і так. */
  function hasteTry(ctx, v, hit, pA, pD, blocked, rnd) {
    if (!hasteOn(v) || !hit || !hit.hits) return;
    var a = {}, k; for (k in pA) a[k] = pA[k];
    a.dmgMul = Math.round((num(pA.dmgMul) || 1) * (V(v, 'ranger.haste', 'dmgMul') || 100)) / 100;
    var h = ctx.R.strike(a, pD, blocked, rnd); h.haste = true; addHit(hit, h);
    grow(v, 'ranger.haste', h.kind === 'hit' || h.kind === 'crit');
  }
  function camoLanded(v, hit) {                                 // ріст Камуфляжу: хід з ним — удар влучив чи ні
    if (!camoOn(v) || !hit || !hit.hits || !hit.hits.length) return;
    grow(v, 'ranger.camo', hit.hits.some(function (h) { return h.kind === 'hit' || h.kind === 'crit'; }));
  }
  /* Засідка: лише з Камуфляжем. Шанс 50% → 100%; вдалося — −mana: основний удар ×3, завжди влучає, без блоку,
     ухилення й парирування; Камуфляж зачаюється на lock ходів */
  function ambushTry(ctx, st, id, pm, rnd) {
    var need = V(st, id, 'chance'), roll = ctx.R.d100(rnd), rec = { id: id, need: need, roll: roll, ok: roll <= need, dmg: 0 };
    grow(st, id, rec.ok);
    if (!rec.ok) { rec.kind = 'fail'; return { rec: rec }; }
    var att = clone(pm); rec.mul = (V(st, id, 'dmgMul') || 300) / 100; att.dmgMul = rec.mul; att.extra = 0; att.sure = true;
    var mn = V(st, id, 'mana'); if (mn) { st.me.mana = Math.max(0, num(st.me.mana) - mn); rec.mana = mn; }
    rec.lock = V(st, id, 'lock') || 5; fxOf(st.me).camoLock = st.round + rec.lock;
    st.me.skill = null;                                          // вдалася — вибір знято: наступну Засідку обирають знову
    rec.kind = 'ambush';
    return { rec: rec, att: att, tag: 'ambush' };
  }
  /* ── ОТРУТА ──
     Змастити зброю: шанс 50% → 100%; вдалося — −mana, зброя змащена turns ходів. Кожен удар, що завдав урону, —
     ще +pct% урону отрутою і шанс chance2% отруїти. Отруєний: 3 ходи −tick% макс. здоров'я наприкінці ходу;
     поки отруєний — удруге не отруїти.
     ОПІР ОТРУТІ (poisonRes):
       свій (base) — «Опір отруті» з речей (p.resPoison), згодом і з вмінь;
       Перев'язка на 100% — +50% на 5 ходів (fx.bres);
       після отруєння (fx.pimm — з якого ходу, fx.pimmHold — скільки ходів тримає 100%): отрута минула — 100%, далі
       щоходу −10%; антидот — 2 ходи 100%, далі −10%; не нижче свого.
       'dmg'    — урон отрутою з удару й тіки: свій + Перев'язка;
       'chance' — шанс отруїти: max(свій, після отруєння) + Перев'язка. Разом не більше 100%. */
  /* отрута — на КОНКРЕТНОМУ клинку (uid): клинок покинув руку (зняв, замінив, вибили, зламався) — отрута зникла,
     повернув ту саму зброю — вона вже чиста (щоб не маніпулювати перевдяганням) */
  function venomOn(st) { var f = st.me && st.me.fx, w = weaponOn(st);
    return !!(f && f.venom && num(f.venom.until) >= st.round && w && w.uid === f.venom.uid && !heroDisarmed(st)); }
  function poisoned(u, round) { var p = u && u.fx && u.fx.poison; return !!(p && num(p.until) >= round); }
  function poisonRes(u, round, kind) {
    var f = (u && u.fx) || {}, base = Math.max(0, Math.min(100, num(u && u.p && u.p.resPoison)));
    var band = f.bres && num(f.bres.until) >= round ? (num(f.bres.pct) || 50) : 0;
    if (kind === 'dmg') return Math.min(100, base + band);
    var after = 0, d = f.pimm != null ? round - num(f.pimm) : -1;
    if (d >= 0) { var hold = num(f.pimmHold), k = hold ? Math.max(0, d - hold + 1) : d; after = Math.max(0, 100 - 10 * k); }
    return Math.min(100, Math.max(base, after) + band);
  }
  function venomTry(ctx, st, id, rnd) {
    var need = V(st, id, 'chance'), roll = ctx.R.d100(rnd), rec = { id: id, need: need, roll: roll, ok: roll <= need, dmg: 0 };
    grow(st, id, rec.ok);
    if (!rec.ok) { rec.kind = 'fail'; return rec; }
    var mn = V(st, id, 'mana'); if (mn) { st.me.mana = Math.max(0, num(st.me.mana) - mn); rec.mana = mn; }
    rec.turns = V(st, id, 'turns') || 2; rec.pct = V(st, id, 'pct'); rec.chance2 = V(st, id, 'chance2');
    fxOf(st.me).venom = { until: st.round + rec.turns - 1, pct: rec.pct, ch: rec.chance2, tick: V(st, id, 'tick') || 5, uid: (weaponOn(st) || {}).uid };
    st.me.skill = null;                                          // змастив — вибір знято (як Берсерк): нові 50 мани — лише свідомо
    rec.kind = 'venom';
    return rec;
  }
  function venomHits(ctx, v, hit, rnd) {                        // v — той, чия зброя змащена; hit — його удари
    if (!venomOn(v) || !wTypeNow(v) || !hit || !hit.hits) return;   // отрута на клинку: зброю вибито (б'є кулаками) — не діє
    var vn = v.me.fx.venom, res = poisonRes(v.op, v.round, 'chance'), cut = poisonRes(v.op, v.round, 'dmg');
    hit.hits.forEach(function (h) {
      if ((h.kind !== 'hit' && h.kind !== 'crit') || !(num(h.dmg) > 0)) return;
      var x = Math.round(h.dmg * num(vn.pct) / 100 * (1 - cut / 100));
      if (x > 0) { h.dmg += x; h.venom = x; if (cut) h.venomCut = cut; }
      if (poisoned(v.op, v.round)) return;
      var need = Math.round(num(vn.ch) * (1 - res / 100) * 10) / 10, r = ctx.R.d100(rnd);
      h.poisonTry = [r, need];
      var ok = need > 0 && r <= need;
      if (ok) { fxOf(v.op).poison = { from: v.round, until: v.round + 2, tick: num(vn.tick) || 5 }; h.poisoned = true; }
      grow({ me: v.op, op: v.me, round: v.round }, 'healer.poisonres', !ok);   // Стійкість до отрут: встояв — вдале очко
    });
    hit.dmg = hit.hits.reduce(function (a, h) { return a + (h.dmg || 0); }, 0);
  }
  function poisonTick(u, round) {                               // → скільки забрала отрута цього ходу
    var f = u.fx, p = f && f.poison;
    if (!p || round < num(p.from) || round > num(p.until)) return 0;
    var d = Math.round(num(u.max) * (num(p.tick) || 5) / 100 * (1 - poisonRes(u, round, 'dmg') / 100));
    if (d > 0) { u.force -= d; grow({ me: u, round: round }, 'healer.poisonres', false); }   // тік шкодить — Стійкість учиться
    if (round >= num(p.until)) { delete f.poison; f.pimm = round + 1; f.pimmHold = 0; }   // минула — далі опір 100% і спад
    return d;
  }
  /* Перев'язка: шанс 50% → 100%; вдалося — −mana, ще до ударів лікує heal%; на 100% — знімає отруту й +50% опору на 5 ходів */
  function bandageTry(ctx, st, id, rnd) {
    var need = V(st, id, 'chance'), roll = ctx.R.d100(rnd), rec = { id: id, need: need, roll: roll, ok: roll <= need, dmg: 0 };
    grow(st, id, rec.ok);
    var cdN = V(st, id, 'cd'); if (cdN > 0) { st.me.cd = st.me.cd || {}; st.me.cd[id] = st.round + cdN; }
    if (!rec.ok) { rec.kind = 'fail'; return rec; }
    var mn = V(st, id, 'mana'); if (mn) { st.me.mana = Math.max(0, num(st.me.mana) - mn); rec.mana = mn; }
    var was = st.me.force, f = fxOf(st.me);
    st.me.force = Math.min(st.me.max, st.me.force + Math.round(st.me.max * V(st, id, 'heal') / 100));
    rec.kind = 'bandage'; rec.pct = V(st, id, 'heal'); rec.heal = Math.max(0, Math.round(st.me.force - was));
    if (V(st, id, 'cleanse')) { if (f.poison) { delete f.poison; rec.cleansed = true; } f.bres = { until: st.round + 4, pct: 50 }; rec.res = 50; }
    return rec;
  }
  /* Пісок в очі: шанс 50% → 100%; вдалося — −mana; Стійкість може врятувати; ворог сліпий turns ходів (цей теж):
     точність −acc%, спритність −agi%, Ухилення не прокидається. Щоходу (з наступного) він може протерти очі — wipe%.
     Потім 2 ходи імунітету.
     ⚠ ГРУПОВИЙ БІЙ (коли з'явиться): сліпий НЕ обирає ціль — і звичайні удари, і ВСІ вміння (постріли, Пісок,
     отрута, контроль) йдуть лише в того суперника, з яким він зараз б'ється (його поточна пара); вибрати іншого
     суперника чи вистрілити в нього не можна. Перевіряти blindOn() там, де обирається ціль вміння. */
  function blindOn(st) { var f = st.me && st.me.fx, b = f && f.blind; return !!(b && num(b.from) <= st.round && num(b.until) >= st.round); }
  /* ── ПАСТКА (Слідопит): ставиш у зону (st.me.trapZone; не та, що блокуєш; не обрав — випадкова). Шанс 50% → 100%,
     вдалося — −mana; стоїть wait ходів (2 → 4, цей теж). Суперник ударив у цю зону — перший удар, що влучив, ×cut %,
     і наступного ходу він «у пастці» 🪤: звичайних ударів немає (вміння, пояс, блок — так), ухилитись від твоїх ударів
     не може. Стійкість рятує від «у пастці» (урон ×cut лишається); після — 2 ходи імунітету. Перезарядка cd — коли
     пастка спрацювала чи зникла. fx.trap = {zone, from, until, cut} у того, хто поставив; fx.trapped = хід у пастці. */
  function trapOn(st) { var t = st.me && st.me.fx && st.me.fx.trap; return !!(t && num(t.from) <= st.round && num(t.until) >= st.round); }
  function trappedNow(st, u) { return !!(u && u.fx && num(u.fx.trapped) === st.round); }
  function trapTry(ctx, st, id, block, rnd) {
    var need = V(st, id, 'chance'), roll = ctx.R.d100(rnd), rec = { id: id, need: need, roll: roll, ok: roll <= need, dmg: 0 };
    if (!rec.ok) { grow(st, id, false); rec.kind = 'fail'; return rec; }
    var mn = V(st, id, 'mana'); if (mn) { st.me.mana = Math.max(0, num(st.me.mana) - mn); rec.mana = mn; }
    var z = st.me.trapZone; if (ZONES.indexOf(z) < 0 || z === block) { var free = ZONES.filter(function (x) { return x !== block; }); z = pick(free, rnd); rec.auto = true; }
    var n = Math.max(1, V(st, id, 'wait') || 2);
    fxOf(st.me).trap = { zone: z, from: st.round, until: st.round + n - 1, cut: V(st, id, 'cut') || 50 };
    st.me.skill = null; st.me.trapZone = null;                   // поставив — вибір знято
    rec.kind = 'trapSet'; rec.zone = z; rec.turns = n;
    return rec;
  }
  /* суперник ударив (inHit — його удар по v) у зону atkZone: пастка v спрацювала? → запис для журналу */
  function trapSpring(ctx, v, id, inHit, atkZone, rnd) {
    var f = fxOf(v.me), t = f.trap; if (!trapOn(v) || !inHit || !inHit.hits || !inHit.hits.length || atkZone !== t.zone) return null;
    var rec = { id: id, kind: 'trapSprung', zone: t.zone, cut: t.cut };
    var h = inHit.hits.filter(function (x) { return (x.kind === 'hit' || x.kind === 'crit') && num(x.dmg) > 0; })[0];
    if (h) { var d0 = num(h.dmg), d1 = Math.max(1, Math.round(d0 * t.cut / 100)); h.dmg = d1; if (h.magDmg) h.magDmg = d1; else h.physDmg = d1; h.trap = true; h.trapFrom = d0; rec.from = d0; rec.to = d1;
      inHit.dmg = inHit.hits.reduce(function (a, x) { return a + (x.dmg || 0); }, 0); }
    var fo = fxOf(v.op);
    if (num(fo.trapImm) > v.round) rec.imm = true;
    else if (steadyTry(ctx.R, v, rec, rnd)) rec.saved = true;
    else { fo.trapped = v.round + 1; fo.trapImm = v.round + 3; rec.trapped = true; }
    delete f.trap; grow(v, id, true);
    var cdN = V(v, id, 'cd'); if (cdN > 0) { v.me.cd = v.me.cd || {}; v.me.cd[id] = v.round + cdN; }
    return rec;
  }
  /* кінець ходу: пастка простояла своє й не спрацювала — зникла, перезарядка */
  function trapExpire(v, id) {
    var f = fxOf(v.me), t = f.trap; if (!t || num(t.until) > v.round) return null;
    delete f.trap; grow(v, id, false);
    var cdN = V(v, id, 'cd'); if (cdN > 0) { v.me.cd = v.me.cd || {}; v.me.cd[id] = v.round + cdN; }
    return { id: id, kind: 'trapGone', zone: t.zone };
  }
  function sandTry(ctx, st, id, rnd) {
    var need = V(st, id, 'chance'), roll = ctx.R.d100(rnd), rec = { id: id, need: need, roll: roll, ok: roll <= need, dmg: 0 };
    var cdN = V(st, id, 'cd'); if (cdN > 0) { st.me.cd = st.me.cd || {}; st.me.cd[id] = st.round + cdN; }
    if (!rec.ok) { grow(st, id, false); rec.kind = 'fail'; return rec; }
    var mn = V(st, id, 'mana'); if (mn) { st.me.mana = Math.max(0, num(st.me.mana) - mn); rec.mana = mn; }
    if (steadyTry(ctx.R, st, rec, rnd)) { grow(st, id, false); rec.kind = 'blindSaved'; return rec; }
    grow(st, id, true);
    var n = V(st, id, 'turns') || 2, fo = fxOf(st.op);
    fo.blind = { from: st.round, until: st.round + n - 1, acc: V(st, id, 'acc'), agi: V(st, id, 'agi'), wipe: V(st, id, 'wipe') };
    fo.blindImm = st.round + n + 1;
    rec.kind = 'blind'; rec.turns = n; rec.acc = V(st, id, 'acc'); rec.agi = V(st, id, 'agi');
    return rec;
  }
  /* осліплений протирає очі (з другого ходу осліплення): вдалося — сліпота минула, але цього ходу без вміння й пояса */
  function wipeTry(ctx, v, rnd) {
    if (!blindOn(v)) return null;
    var b = v.me.fx.blind; if (num(b.from) >= v.round) return null;
    var r = ctx.R.d100(rnd), need = num(b.wipe) || 35, ok = r <= need;
    if (ok) delete v.me.fx.blind;
    return { roll: r, need: need, ok: ok };
  }
  /* стріла застрягла (Влучний постріл): ворог б'є слабше на weak% з наступного ходу до arrow.until */
  function arrowOn(st) { var f = st.me && st.me.fx, a = f && f.arrow; return !!(a && num(a.from) <= st.round && num(a.until) >= st.round); }
  /* Перевага Слідопита «Швидкий спис»: якщо твої удари цього ходу добивають ворога — з шансом ти встигаєш першим,
     і його удар цього ходу не відбувається → запис для журналу або null */
  function spearFirst(ctx, st, myDmg, rnd) {
    var need = perkOf(st, 'spearFirst');
    if (!(need > 0) || wTypeNow(st) !== 'spear' || !(myDmg >= st.op.force) || !(st.op.force > 0)) return null;
    var r = ctx.R.d100(rnd);
    return { roll: r, need: need, ok: r <= need };
  }
  /* Третя атака: щоходу (незалежно від Другої) з шансом — ще один звичайний удар у ту саму зону; кожна рука — свій кидок */
  function thirdTry(ctx, v, hit, pA, pD, blocked, rnd, left) {
    if (!hasSk(v, 'knight.third') || !hit.hits) return;
    var n3 = V(v, 'knight.third', 'extra'), d3 = ctx.R.d100(rnd);
    grow(v, 'knight.third', d3 <= n3);
    if (d3 <= n3) { var h3 = ctx.R.strike(pA, pD, blocked, rnd); h3.third = [d3, n3]; if (left) h3.left = true; addHit(hit, h3); }
  }
  /* Друга зброя: зброя в лівій руці — щоходу з шансом (= майстерність) ще удар лівою в ту саму зону, урон ×dmgMul%
     (база й урон лівої зброї); на 100% — Друга й Третя атака і для лівої руки (свої кидки) */
  function offhandTry(ctx, v, hit, pA, pD, blocked, rnd) {
    var id = 'knight.offhand', lw = leftWeapon(v);
    if (!lw || !hasSk(v, id) || !hit.hits) return;
    var att = {}, k; for (k in pA) att[k] = pA[k];
    att.wMin = num(pA.lMin); att.wMax = Math.max(num(pA.lMin), num(pA.lMax)); att.magMin = 0; att.magMax = 0;
    att.dmgMul = (V(v, id, 'dmgMul') || 75) / 100; att.extra = 0;
    var need = V(v, id, 'chance'), r = ctx.R.d100(rnd);
    if (r > need) { grow(v, id, false); return; }
    var h = ctx.R.strike(att, pD, blocked, rnd); h.left = [r, need]; addHit(hit, h);
    grow(v, id, h.kind === 'hit' || h.kind === 'crit');
    if (num(v.me.sk[skId(v, id)]) >= 1) { secondTry(ctx, v, hit, att, pD, blocked, rnd, true); thirdTry(ctx, v, hit, att, pD, blocked, rnd, true); }
  }
  /* Розсікти: посилення ОСНОВНОГО (першого) удару ходу — урон ×dmgMul, захист зони, шанс блоку й парирування не діють
     (промах і ухилення — так). Вдалося — −mana; ворог стає обережним на careful ходів: Розсікти на нього не діє,
     і ще carefulPct% встояти проти контролю. Не вдалося — звичайний удар, мана лишається */
  function cleaveTry(ctx, st, id, pm, rnd) {
    var need = V(st, id, 'chance'), roll = ctx.R.d100(rnd), rec = { id: id, need: need, roll: roll, ok: roll <= need, dmg: 0 };
    if (!rec.ok) { grow(st, id, false); rec.kind = 'fail'; return { rec: rec }; }
    var att = {}, k; for (k in pm) att[k] = pm[k];
    rec.kind = 'cleave'; rec.mul = (V(st, id, 'dmgMul') || 180) / 100; att.dmgMul = rec.mul; att.extra = 0;
    return { rec: rec, att: att };
  }
  /* Розсікти влучило — лише тоді −mana і ворог обережний; промах — без мани й обережності */
  function cleaveLanded(st, rec, hit) {
    var id = rec.id, h0 = hit && hit.hits && hit.hits[0], ok = !!(h0 && (h0.kind === 'hit' || h0.kind === 'crit'));
    grow(st, id, ok);
    if (!ok) { rec.missed = true; return; }
    var mn = V(st, id, 'mana'); if (mn) { st.me.mana = Math.max(0, num(st.me.mana) - mn); rec.mana = mn; }
    var fo = fxOf(st.op), cn = V(st, id, 'careful') || 10;
    fo.careful = st.round + cn; fo.carefulPct = V(st, id, 'carefulPct') || 10; rec.careful = cn;
  }
  /* захист без блоку (Розсікти): ні шансу блоку речей, ні відскоку */
  /* Королівська лють у блок: закрита зона або шанс блоку щита/речей — урон ×½ (крит лишається), удар не оглушує */
  function ultBlock(R, h, def, zone, rnd) {
    var why = zone ? 'суперник закрив цю зону' : '';
    if (!zone) {
      var bch = num(h.magic ? def.blockMag : def.blockPhys); if (!(bch > 0)) return;
      h.blockNeed = Math.min(100, Math.round(bch)); h.blockRoll = R.d100(rnd);
      if (h.blockRoll > h.blockNeed) return;
      why = (def.evade ? 'спритно відскочив 🎲 ' : 'блок шансом 🎲 ') + h.blockRoll + ' ≤ ' + h.blockNeed + '%'; h.byChance = true;
    }
    var full = h.dmg; h.dmg = Math.max(1, Math.round(full / 2)); h.halfBlock = true;
    if (h.magDmg) h.magDmg = h.dmg; else h.physDmg = h.dmg;
    h.calc = (h.calc || '') + ' = ' + full + ' · ' + why + ' → ½';
  }
  function noBlock(p) { var o = {}, k; for (k in p) o[k] = p[k]; o.blockPhys = 0; o.blockMag = 0; o.evade = false; return o; }
  /* Протидія: кожен свій блок (у вхідному ударі) — рідкісний контрудар ×0.5 */
  function riposteTry(ctx, v, inHit, outHit, pA, pD, blocked, rnd) {
    if (!hasSk(v, 'knight.riposte') || !outHit.hits) return;
    var rn = V(v, 'knight.riposte', 'chance');
    (inHit.hits || []).forEach(function (h) {
      if (h.kind !== 'block') return;
      var d = ctx.R.d100(rnd); grow(v, 'knight.riposte', d <= rn);
      if (d > rn) return;
      var att = {}, k; for (k in pA) att[k] = pA[k]; att.dmgMul = 0.5;
      var hr = ctx.R.strike(att, pD, blocked, rnd); hr.riposte = [d, rn]; addHit(outHit, hr);
    });
  }
  /* активне вміння-удар (Пінок, Вогник, Поштовх, Древко, Пантелик) з перезарядкою */
  function activeStrike(ctx, v, id, can, pA, pD, mine, theirs, rnd) {
    if (!id || PRE[id] || !can || skillBlock(v, id)) return null;
    var rec = (id === SKILL.haft.id || id === SKILL.daze.id || id === SKILL.stun.id || id === SKILL.lash.id || id === SKILL.ult.id || id === SKILL.aimed.id) ? weaponStrike(ctx, v, id, pA, pD, mine, theirs, rnd)
      : skillStrike(ctx, v, id, pA, pD, mine.atk === theirs.block, rnd);
    var cdN = V(v, id, 'cd');
    if (id === SKILL.aimed.id && rec && rec.kind === 'fail') cdN = 0;   // Влучний постріл: перезарядка лише після вдалого пострілу (не вдалося — можна знову наступного ходу)
    if (cdN > 0) { v.me.cd = v.me.cd || {}; v.me.cd[id] = v.round + cdN; }
    return rec;
  }
  /* скільки ударів цього ходу влучило й завдало урону (основні, друга/третя атака, ліва, удар вмінням) */
  function landedN(hit, rec) {
    var n = ((hit && hit.hits) || []).filter(function (h) { return (h.kind === 'hit' || h.kind === 'crit') && num(h.dmg) > 0; }).length;
    if (rec && rec.hits) n += rec.hits.filter(function (h) { return (h.kind === 'hit' || h.kind === 'crit') && num(h.dmg) > 0; }).length;
    else if (rec && rec.kind === 'hit' && num(rec.dmg) > 0) n++;
    return n;
  }
  /* концентрація: Лицар («Стійкість») — росте від урону (+1), у хід без урону −1, Незворушність тримає;
     Слідопит із «Мисливським азартом» — рахунок ходу: влучив більше, ніж пропустив, — +1, порівну — 0
     (з шансом tie% теж +1), пропустив більше — −1 (Незворушність тримає);
     решта — росте в спокійний хід, урон скидає. mine / theirs — влучні удари свої й суперника */
  function focusTick(ctx, v, dmgIn, down, rndF, rndC, mine, theirs) {
    if (!hasSk(v, 'base.focus')) return null;
    var f = fxOf(v.me), cap = V(v, 'base.focus', 'cap') || 3;
    if (num(f.dazed) === v.round) return null;                 // збили з пантелику цього ходу — концентрація не росте й не спадає
    var eng = !down && ctx.R.d100(rndF) <= V(v, 'base.focus', 'engage');
    if (hasSk(v, 'ranger.zeal') && !down) {
      var dz = num(mine) - num(theirs), zid = 'ranger.zeal';
      if (dz > 0 || !(num(theirs) > 0) || (dz === 0 && ctx.R.d100(rndC) <= V(v, zid, 'tie'))) {   // влучив більше; 0:0 — як спокійний хід (+1); нічия — з шансом tie%
        grow(v, zid, true);
        if (eng) { grow(v, 'base.focus', true); if (num(f.focus) < cap) f.focus = num(f.focus) + 1; }
        return null;
      }
      if (dz === 0) return null;
      grow(v, zid, false); if (eng) grow(v, 'base.focus', false);
      if (!(num(f.focus) > 0)) return null;
      var kz = hasSk(v, 'knight.calm') ? V(v, 'knight.calm', 'keepPct') : 0, krz = kz ? ctx.R.d100(rndC) : 101;
      if (kz) grow(v, 'knight.calm', krz <= kz);
      if (!(krz <= kz)) f.focus = num(f.focus) - 1;
      return kz ? [krz, kz, krz <= kz] : null;
    }
    if (v.me.cls === 'knight') {
      if (dmgIn > 0) { if (eng) { grow(v, 'base.focus', true); if (num(f.focus) < cap) f.focus = num(f.focus) + 1; } return null; }
      if (!(num(f.focus) > 0) || down) return null;
      if (eng) grow(v, 'base.focus', false);
      var keep = hasSk(v, 'knight.calm') ? V(v, 'knight.calm', 'keepPct') : 0, kr = keep ? ctx.R.d100(rndC) : 101, rec = null;
      if (keep) { grow(v, 'knight.calm', kr <= keep); rec = [kr, keep, kr <= keep]; }
      if (!(kr <= keep)) f.focus = num(f.focus) - 1;
      return rec;
    }
    if (dmgIn > 0) {
      if (eng) grow(v, 'base.focus', false);
      if (!(num(f.focus) > 0)) return null;
      var keep2 = hasSk(v, 'knight.calm') ? V(v, 'knight.calm', 'keepPct') : 0, kr2 = keep2 ? ctx.R.d100(rndC) : 101;   // Незворушність: з шансом концентрація не скидається
      if (keep2) grow(v, 'knight.calm', kr2 <= keep2);
      if (!(kr2 <= keep2)) f.focus = 0;
      return keep2 ? [kr2, keep2, kr2 <= keep2, 'reset'] : null;
    }
    else if (eng) { grow(v, 'base.focus', true); if (num(f.focus) < cap) f.focus = num(f.focus) + 1; }
    return null;
  }
  /* дописати удар у атаку ходу й перерахувати підсумок */
  function addHit(hit, h) {
    if (!hit.hits) return;
    hit.hits.push(h);
    hit.dmg = hit.hits.reduce(function (a, x) { return a + (x.dmg || 0); }, 0);
    var ks = hit.hits.map(function (x) { return x.kind; });
    hit.kind = ks.indexOf('crit') >= 0 ? 'crit' : ks.indexOf('hit') >= 0 ? 'hit' : ks.indexOf('block') >= 0 ? 'block' : 'dodge';
    hit.crit = hit.hits.some(function (x) { return x.crit; });
  }
  /* Парирування (Лицар): удар ворога в НЕзахищену зону, що влучив, — кидок «прокинулось» (шанс = майстерність),
     тоді шанс відбити — за видом зброї в руці (PARRY); без зброї чи зброєю, що не парирує, — нічого */
  function applyParry(ctx, st, opHit, open, rnd) {
    var id = 'knight.parry'; if (!open || !hasSk(st, id)) return 0;
    var need = parryChance(st); if (!(need > 0)) return 0;
    var eng = V(st, id, 'engage'), n = 0;
    (opHit.hits || []).forEach(function (h) {
      if (h.kind !== 'hit' && h.kind !== 'crit') return;
      if (h.cleave || h.ambush) return;                           // Розсікти й Засідка не парируються
      var er = ctx.R.d100(rnd); if (!(er <= eng)) return;
      var r = ctx.R.d100(rnd), ok = r <= need; grow(st, id, ok);
      if (ok) { n++; h.kind = 'block'; h.skillParry = true; h.blockCalc = 'парирував зброєю 🤺 🎲 ' + er + ' ≤ ' + eng + '% прокинулось · 🎲 ' + r + ' ≤ ' + need + '%'; h.dmg = 0; h.magDmg = 0; h.physDmg = 0; }
    });
    if (n) {
      opHit.dmg = opHit.hits.reduce(function (a, h) { return a + (h.dmg || 0); }, 0);
      var ks = opHit.hits.map(function (x) { return x.kind; });
      opHit.kind = ks.indexOf('crit') >= 0 ? 'crit' : ks.indexOf('hit') >= 0 ? 'hit' : 'block';
    }
    return n;
  }
  /* ухилення: удар у НЕзахищену зону (лише такі й влучають) */
  function applyDodge(ctx, st, opHit, rnd) {
    return triggerHits(ctx, st, 'base.dodge', opHit, rnd, function (h, calc) {
      h.kind = 'dodge'; h.skillDodge = true; h.dodgeCalc = 'ухилився вмінням 💨 ' + calc; });
  }
  /* щит: блок вмінням удару, що влучив, — лише зі щитом у лівій руці */
  function applyShield(ctx, st, opHit, rnd) {
    if (!shieldOn(st)) return 0;
    return triggerHits(ctx, st, 'base.shield', opHit, rnd, function (h, calc) {
      h.kind = 'block'; h.skillShield = true; h.blockCalc = 'заблокував щитом 🛡️ ' + calc; });
  }
  function itemName(ctx, e) { return (e.base && e.base.name) || ((ctx.R.SLOT_UK || {})[e.slot]) || e.slot; }

  /* ── ПОЯС у бою ──
     Копія комірок пояса на старті: [{uid, id, bonus, idx, base, used}].
     Використати річ — спецвміння ходу (те саме, що перевдягання): вибір
     запам'ятовується (st.me.use) і спрацьовує, коли розігрується хід, ДО ударів.
     Використане записується в st.used → після бою зникає з інвентаря;
     невикористане лишається в поясі. Бот поясом не користується. */
  function beltLite(belt) {
    return (belt || []).map(function (e, i) {
      if (!e || !e.inst || !e.base) return null;
      var m = /^belt(\d+)$/.exec(e.inst.slot || ''), idx = m ? +m[1] : i;
      return { uid: e.inst.uid, id: e.inst.id, bonus: e.inst.bonus, idx: idx, base: e.base, used: false };
    }).filter(Boolean);
  }
  function fxOf(u) { if (!u.fx) u.fx = { buffs: {}, barrier: 0, fear: 0 }; return u.fx; }
  function beltItem(st, uid) { return ((st.me && st.me.belt) || []).filter(function (b) { return b.uid === uid; })[0] || null; }
  /* обрати річ із пояса на цей хід (uid) або скасувати вибір (null) */
  function useBelt(ctx, st, uid) {
    if (!isLive(st)) return false;
    if (uid == null) {
      if (beltChosen(st)) { st.me.use = null; st.swapRound = 0; st.rev++; return true; }
      return false;
    }
    var b = beltItem(st, uid);
    if (!b || b.used || swapped(st) || knockedNow(st, st.me)) return false;
    st.me.skill = null;                                            // річ із пояса замість вміння
    st.me.use = uid; st.me.useRound = st.round; st.swapRound = 0; st.rev++;
    return true;
  }
  /* бот і пояс: з шансом botBeltUse за хід бере випадкову невикористану річ
     (не коли лежить оглушений і не коли бій уже вирішено) */
  function botUse(ctx, st) {
    var B = ctx.R.BATTLE || {}, left = (st.op.belt || []).filter(function (b) { return !b.used; });
    if (st.op.use || !left.length || knockedNow(st, st.op) || st.me.force <= 0 || st.op.force <= 0) return;
    var r = rng(st.bid + '|' + st.round + '|botuse');
    if (ctx.R.d100(r) > num(B.botBeltUse)) return;
    st.op.use = pick(left, r).uid;
  }
  /* одна дія з пояса: actor використовує item проти target. Повертає запис для журналу. */
  function applyUse(ctx, st, actor, target, side, item, rnd) {
    var R = ctx.R, B = R.BATTLE || {}, fa = fxOf(actor), ft = fxOf(target);
    var rec = { side: side, uid: item.uid, id: item.id, name: (item.base && item.base.name) || item.id, fx: [] };
    if (side === 'me') { item.used = true; (st.used = st.used || []).push({ uid: item.uid, id: item.id, bonus: item.bonus }); }
    if (fa.feared) { rec.lost = true; return rec; }                    // під страхом: річ витрачено без ефекту
    var effs = R.useEffects ? R.useEffects(item.base, { bonus: item.bonus || 1 }, ctx.K) : [];
    // вміння «Зілля» / «Свитки» (лише Герой): сила × (1 + 0.5 × м)
    var isScroll = !!(item.base && item.base.category === 'Свиток');
    var skId = isScroll ? 'base.scrolls' : 'base.potions', skP = side === 'me' ? V(st, skId, 'powerPct') : 0;
    if (side === 'me') grow(st, skId, true);
    if (skP > 0) {
      var k = 1 + skP / 100;
      effs = effs.map(function (ef) {
        var o = {}; for (var q in ef) o[q] = ef[q];
        if (o.type === 'heal' || o.type === 'buff') o.pct = Math.round(num(o.pct) * k);
        if (o.type === 'scroll') { o.min = Math.round(num(o.min) * k); o.max = Math.round(num(o.max) * k); }
        if (o.type === 'barrier' && rnd() * 100 < V(st, 'base.scrolls', 'barrier2')) o.n = num(o.n) + 1;   // на 100% — два бар'єри
        if (o.type === 'fear') o.bonus = V(st, 'base.scrolls', 'fearPct');
        return o;
      });
      rec.skill = { id: skId, pct: skP };
    }
    effs.forEach(function (ef) {
      var r = { type: ef.type };
      if (ef.type === 'heal') {
        var add = Math.round(actor.max * ef.pct / 100), was = actor.force;
        actor.force = Math.min(actor.max, actor.force + add);
        r.pct = ef.pct; r.hp = Math.max(0, Math.round(actor.force - was));
      } else if (ef.type === 'buff') {
        var cur = fa.buffs[ef.key];
        r.key = ef.key; r.pct = ef.pct;
        if (cur && cur.turns > 0 && cur.pct > ef.pct) { r.weaker = true; r.has = cur.pct; }
        else {
          var lo = B.buffMin || 5, hi = B.buffMax || 10;
          var t = lo + Math.floor(rnd() * (hi - lo + 1));
          fa.buffs[ef.key] = { pct: ef.pct, turns: t, name: rec.name, id: item.id };
          r.turns = t;
        }
      } else if (ef.type === 'scroll') {
        var h = R.scrollStrike(R.buffed(actor.p, fa.buffs), R.buffed(target.p, ft.buffs), ef, rnd);
        if (side === 'me') grow(st, 'base.magic', h.dmg > 0);
        if (h.dmg > 0 && ft.barrier > 0) { ft.barrier--; h.barrier = true; h.absorbed = h.dmg; h.dmg = 0; h.magDmg = 0; h.kind = 'barrier'; }
        target.force -= h.dmg;
        r.hit = h;
      } else if (ef.type === 'fear') {
        var immune = ft.fear >= (B.fearImmune || 2);
        if (immune) { r.immune = true; }
        else {
          r.need = Math.min(100, Math.round(100 * (ft.fear ? (B.fearNext != null ? B.fearNext : 0.5) : (B.fearFirst != null ? B.fearFirst : 0.9)) + num(ef.bonus)));
          var brave = side === 'op' ? V(st, 'knight.brave', 'resPct') : 0;   // Хоробрість Героя: страх діє рідше
          if (brave) { r.need = Math.round(r.need * (1 - brave / 100)); r.brave = brave; }
          r.roll = R.d100(rnd);
          r.ok = r.roll <= r.need;
          if (side === 'op') grow(st, 'knight.brave', !r.ok);
          if (r.ok) { ft.fear++; ft.feared = true; r.immuneNow = ft.fear >= (B.fearImmune || 2); }
        }
      } else if (ef.type === 'barrier') {
        fa.barrier += ef.n; r.n = ef.n;
      } else if (ef.key === 'antidote') {                       // антидот: знімає отруту, далі імунітет (3 ходи повний, потім слабшає)
        r.type = 'antidote'; r.cured = !!fa.poison; delete fa.poison; fa.pimm = st.round; fa.pimmHold = 2;   // 2 ходи 100%, потім спад
      } else { r.key = ef.key; }
      rec.fx.push(r);
    });
    return rec;
  }
  /* бар'єр: поглинає перший удар, що забрав би здоров'я */
  function applyBarrier(fx, hit) {
    if (!fx || !(fx.barrier > 0)) return;
    var hs = hit.hits || [hit];
    for (var i = 0; i < hs.length && fx.barrier > 0; i++) {
      var h = hs[i];
      if (!(h.dmg > 0)) continue;
      fx.barrier--; h.absorbed = h.dmg; h.barrier = true; h.kind = 'barrier'; h.dmg = 0; h.magDmg = 0; h.physDmg = 0;
    }
    hit.dmg = hs.reduce(function (a, h) { return a + (h.dmg || 0); }, 0);
    if (hs.every(function (h) { return h.kind === 'barrier' || h.kind === 'dodge' || h.kind === 'block'; }) && hs.some(function (h) { return h.kind === 'barrier'; })) hit.kind = 'barrier';
  }
  function tickBuffs(u) {
    var f = u.fx; if (!f) return;
    Object.keys(f.buffs || {}).forEach(function (k) { var b = f.buffs[k]; b.turns--; if (b.turns <= 0) delete f.buffs[k]; });
    f.feared = false;
  }

  /* ── СТАРТ ──
     me: {name, avatar, level, stats:{health,accuracy,agility,mana}, eq:[{base,inst}]}
     op: {f:{name, avatar, level, eq:[{slot,id,cat}]}, p} — суперник (бот) з готовим профілем */
  function skillSnap(sk) {
    var out = {};
    Object.keys(sk || {}).forEach(function (id) { var m = num(sk[id]); out[id] = Math.max(0, Math.min(1, m)); });
    return out;
  }
  /* готові значення вмінь (SKSKILLS.skillValues) — лише вивчених */
  function skillVals(sk, skv) {
    var out = {};
    Object.keys(sk || {}).forEach(function (id) { if (skv && skv[id]) out[id] = clone(skv[id]); });
    return out;
  }
  function create(ctx, o) {
    var now = o.now || Date.now();
    var st = {
      v: 2, bid: o.bid || newBid(), heroId: o.heroId || '', kind: o.kind || 'arena',
      status: 'live', rev: 1, startedAt: now, deadline: now + turnMs(ctx), round: 1,
      me: { name: o.me.name, avatar: o.me.avatar, level: o.me.level || 1,
        stats: { health: num(o.me.stats.health), accuracy: num(o.me.stats.accuracy), agility: num(o.me.stats.agility), mana: num(o.me.stats.mana) },
        eq: eqLite(o.me.eq), belt: beltLite(o.me.belt), use: null, fx: { buffs: {}, barrier: 0, fear: 0 },
        last: null, atk: null, block: null,
        // вміння: {id: м 0…1} лише вивчені; панель — лише вивчені активні
        sk: skillSnap(o.me.sk), skv: skillVals(o.me.sk, o.me.skv), bar: (o.me.bar || []).filter(function (id) { return id && o.me.sk && o.me.sk[id] != null; }),
        skill: null, cd: {}, once: {}, grow: {}, growF: {}, bond: { uid: null, n: 0 }, cls: o.me.cls || null, perk: perksOf(ctx.R, o.me.cls) },
      op: { f: o.op.f, p: o.op.p, atk: null, block: null, fx: { buffs: {}, barrier: 0, fear: 0 }, belt: beltLite(o.op.belt), use: null,
        // вміння суперника (бот-Лицар): ті самі поля, що в Героя; без вмінь — бот як раніше
        eq: o.op.eq && o.op.eq.length && o.op.eq[0].inst ? eqLite(o.op.eq) : [], cls: o.op.cls || null,
        sk: skillSnap(o.op.sk), skv: skillVals(o.op.sk, o.op.skv), bar: (o.op.bar || []).filter(function (id) { return id && o.op.sk && o.op.sk[id] != null; }),
        skill: null, cd: {}, once: {}, mana: 0, perk: perksOf(ctx.R, o.op.cls) },
      wear: newWear(), swapRound: 0, played: 0, missed: 0, log: [], summary: null
    };
    st.me.p = profile(ctx, st);
    st.me.max = st.me.p.hp; st.me.force = st.me.p.hp;
    st.me.mana = num(st.me.p.mana);
    if (Object.keys(st.op.sk).length) { st.op.p0 = clone(st.op.p); st.op.p = skillProfile(mirror(st), clone(st.op.p)); }   // пасивні вміння бота — у його профіль
    if (o.op.ai) st.op.ai = o.op.ai;
    if (o.op.up) st.op.up = o.op.up;
    st.op.max = st.op.p.hp; st.op.force = st.op.p.hp;
    st.op.mana = num(o.op.mana != null ? o.op.mana : st.op.p.mana);
    return st;
  }

  /* ── хід суперника-бота: випадкова атака; 40% — блок туди, куди Герой бив востаннє ── */
  function botChoice(st) {
    var r = rng(st.bid + '|' + st.round + '|bot');
    var atk = pick(ZONES, r), block;
    if (st.op.f.lastPlayerAtk && r() < 0.4) block = st.op.f.lastPlayerAtk;
    else block = pick(ZONES, r);
    return { atk: atk, block: block };
  }
  /* ── хід Героя без гравця: ті самі зони, що в останньому його ході.
     Якщо гравець ще жодного разу не обрав — перший раз випадково, далі повтор.
     Суперник може це помітити й блокувати — бути АФК невигідно. */
  function autoChoice(st) {
    if (st.me.last && st.me.last.atk && st.me.last.block) return { atk: st.me.last.atk, block: st.me.last.block };
    var r = rng(st.bid + '|' + st.round + '|auto');
    return { atk: pick(ZONES, r), block: pick(ZONES, r) };
  }

  /* знос речей Героя за хід (WEAR із sk-arena-rules.js) */
  /* «Догляд за зброєю»: кожен знос — кидок, з шансом savePct він не рахується */
  function addWear(ctx, st, meHit, opHit, opAtk) {
    var W = ctx.R.WEAR || {}, w = st.wear, care = V(st, 'knight.care', 'savePct'), rnd = care ? rng(st.bid + '|' + st.round + '|care') : null;
    var wl = st._wlog;                                             // для журналу: що зносилось цього ходу
    var put = function (key, n) {
      if (!(n > 0)) return;
      if (!wearItems(ctx, st, key).length) { w[key] = (w[key] || 0) + n; return; }   // зношувати нічого — ні кидка Догляду, ні рядка в журналі
      if (care) { var ok = ctx.R.d100(rnd) <= care; grow(st, 'knight.care', ok); if (ok) { st.saved = (st.saved || 0) + n; if (wl) wl.push({ k: key, n: n, saved: true }); return; } }
      w[key] = (w[key] || 0) + n;
      if (wl) wl.push({ k: key, n: n });
    };
    (opHit.hits || [opHit]).forEach(function (h) {
      if (h.kind === 'hit' || h.kind === 'crit') put(opAtk, h.kind === 'crit' ? W.zoneCrit : W.zoneHit);
      else if (h.kind === 'block') blockWear(ctx, st, h, put);
    });
    (meHit.hits || [meHit]).forEach(function (h) {
      if (h.kind === 'hit' || h.kind === 'crit') put('weapon', h.kind === 'crit' ? W.weaponCrit : W.weaponHit);
    });
  }
  /* чиї речі за ключем зносу: зона (усе вдягнене в ній), зброя, щит чи окрема річ (u:uid) */
  function wearItems(ctx, st, key) {
    var R = ctx.R, on = (st.me.eq || []).filter(function (e) { return !e.off && !e.broken && e.dur != null; });
    return key.indexOf('u:') === 0 ? on.filter(function (e) { return e.uid === key.slice(2); })
      : key === 'weapon' ? on.filter(function (e) { return e.slot === 'weaponR'; })
      : key === 'shield' ? on.filter(function (e) { return e.slot === 'weaponL'; })
      : on.filter(function (e) { return R.zoneOfSlot && R.zoneOfSlot(e.slot) === key; });
  }
  function wearWho(ctx, st, key) {
    var R = ctx.R, list = wearItems(ctx, st, key);
    if (list.length) return list.map(function (e) { return itemName(ctx, e); }).join(', ');
    var z = (R.ZONES || []).filter(function (x) { return x.key === key; })[0];
    return z ? z.label + ' (нічого не вдягнено)' : key;
  }
  /* блок зношує щит; блок «Шансом блоку» — саме ту річ, що заблокувала */
  function blockWear(ctx, st, h, put) {
    var W = ctx.R.WEAR || {}, n = h.crit ? W.shieldCritBlock : W.shieldBlock;
    if (h.byChance && h.blockBy) {
      var e = activeIn(st, h.blockBy);
      if (e) { put('u:' + e.uid, n); return; }
    }
    put('shield', n);
  }
  /* речі, чий знос за бій сягнув міцності, перестають діяти (і після бою зникнуть) */
  function checkBreaks(ctx, st) {
    var out = [];
    (st.me.eq || []).forEach(function (e) {
      if (e.off || e.broken || e.dur == null || e.dur <= 0) return;
      if (itemWear(ctx, e, st.wear) >= e.dur) { e.broken = true; e.inst.durCur = 0; out.push({ owner: 'me', name: itemName(ctx, e) }); }
    });
    if (out.length) { var np = profile(ctx, st); np.hp = st.me.p.hp; st.me.p = np; }   // HP не змінюється
    return out;
  }

  /* ── ОДИН ХІД ──
     choice — {atk, block} гравця або null (час вийшов — автоматичний хід).
     opts.auto — хід зроблено без гравця (рахується як пропущений).
     now — коли хід розіграно (для наступного терміну).
     Повертає запис журналу {t:'turn', r, me, op, auto, meHit, opHit, broke}. */
  function turn(ctx, st, choice, opts, now) {
    if (!isLive(st)) return null;
    opts = opts || {};
    var auto = !!opts.auto || !(choice && choice.atk && choice.block);
    var me = (choice && choice.atk && choice.block) ? { atk: choice.atk, block: choice.block } : autoChoice(st);
    var op = botChoice(st);
    var R = ctx.R, fm = fxOf(st.me), fo = fxOf(st.op);
    var rearmed = rearm(ctx, st);                                   // вибита зброя — знову в руці (через хід)
    var g0 = clone(st.me.grow || {}), f0 = clone(st.me.growF || {});   // для журналу: ріст вмінь за цей хід
    // 1) пояс — до ударів. Обидва щось використали — 🎲 хто перший (свиток страху першого
    //    може зірвати дію другого). Бот бере річ із пояса сам (botUse, BATTLE.botBeltUse).
    var acts = [], ur = rng(st.bid + '|' + st.round + '|use');
    var meKnocked = knockedNow(st, st.me);                         // Героя оглушили — ні пояса, ні вміння, ні удару
    var mi = st.me.use && !meKnocked ? beltItem(st, st.me.use) : null;
    if (mi && !mi.used) acts.push({ side: 'me', item: mi });
    var opWipe = wipeTry(ctx, mirror(st), rng(st.bid + '|' + st.round + '|owipe'));   // бот протирає очі (тоді без пояса й вміння)
    if (!(opWipe && opWipe.ok)) botUse(ctx, st); else st.op.use = null;
    var oi = st.op.use && !knockedNow(st, st.op) ? ((st.op.belt || []).filter(function (b) { return b.uid === st.op.use; })[0] || null) : null;
    if (oi && !oi.used) acts.push({ side: 'op', item: oi });
    var first = null;
    if (acts.length > 1) {
      var a1 = R.d100(ur), a2 = R.d100(ur);
      while (a1 === a2) { a1 = R.d100(ur); a2 = R.d100(ur); }
      first = { me: a1, op: a2 };
      if (a2 > a1) acts.reverse();
    }
    var uses = acts.map(function (a) {
      return a.side === 'me' ? applyUse(ctx, st, st.me, st.op, 'me', a.item, ur) : applyUse(ctx, st, st.op, st.me, 'op', a.item, ur);
    });
    st.me.use = null; if (st.op.use) { if (oi) oi.used = true; st.op.use = null; }
    // 2) удари (з підсиленнями зілль). Під страхом — не атакує. Хтось упав від свитка — ударів немає.
    var down = st.me.force <= 0 || st.op.force <= 0;
    var none = function (why) { return { dmg: 0, kind: why, crit: false, hits: [] }; };
    /* ДВА БІЙЦІ: усі вміння пишуться як «я (st.me) → суперник (st.op)». Для бота — той самий
       код через дзеркальний погляд vo (vo.me = бот, vo.op = Герой). Кидки Героя — як і раніше
       (seed '|назва'), бота — свої ('|oназва'). Ріст вмінь — лише Героя (бот не росте). */
    var vo = mirror(st);
    var sd = function (v, name) { return rng(st.bid + '|' + st.round + '|' + (v === st ? '' : 'o') + name); };
    // зв'язок зі зброєю: 5 ходів поспіль однією зброєю → діє, доки її не змінено
    var wpn = weaponOn(st), bd = st.me.bond || (st.me.bond = { uid: null, n: 0 });
    if (!wpn || bd.uid !== wpn.uid) { bd.uid = wpn ? wpn.uid : null; bd.n = 0; }
    fm.bond = !!(hasSk(st, 'base.bond') && wpn && bd.n >= (V(st, 'base.bond', 'turns') || 5));
    var knocked = fo.knock === st.round;                  // суперника збили з ніг минулого ходу — не атакує
    var meShieldBack = num(fm.shieldOff) && num(fm.shieldOff) === st.round - 1, opShieldBack = num(fo.shieldOff) && num(fo.shieldOff) === st.round - 1;   // рука відійшла — щит знову в руці
    var sid = st.me.skill ? canon(st.me.skill) : null, canAct = !auto && !down && !fm.feared && !meKnocked;
    if (!oi && st.op.ai) st.op.skill = botSkill(st, vo);                          // бот обирає вміння сам
    var osid = oi ? null : st.op.skill, opCan = !down && !fo.feared && !knocked && !(opWipe && opWipe.ok);   // бот: пояс АБО вміння
    var meTog = down ? null : togTick(st), opTog = down ? null : togTick(vo);    // перемикачі: мана за хід
    // Берсерк, Благословення — до ударів: діють уже цього ходу
    var skillRec = preBuff(ctx, st, sid, canAct, sd(st, 'skill'));
    var opRec = preBuff(ctx, vo, osid, opCan, sd(vo, 'skill'));
    // Слідопит: Сховатись і Обеззброєння (ворог б'є слабше) — до ударів, діють уже цього ходу
    if (sid === SKILL.rhide.id && canAct && !skillBlock(st, sid)) skillRec = hideTry(ctx, st, sid, sd(st, 'skill'));
    // Перев'язка й Отрута — теж до ударів (Отрута діє, лише коли клинок влучить цього ходу)
    if (sid === SKILL.bandage.id && canAct && !skillBlock(st, sid)) skillRec = bandageTry(ctx, st, sid, sd(st, 'skill'));
    if (osid === SKILL.bandage.id && opCan && !skillBlock(vo, osid)) opRec = bandageTry(ctx, vo, osid, sd(vo, 'skill'));
    if (sid === SKILL.poison.id && canAct && !skillBlock(st, sid)) skillRec = venomTry(ctx, st, sid, sd(st, 'skill'));
    if (osid === SKILL.poison.id && opCan && !skillBlock(vo, osid)) opRec = venomTry(ctx, vo, osid, sd(vo, 'skill'));
    if (sid === SKILL.sand.id && canAct && !skillBlock(st, sid)) skillRec = sandTry(ctx, st, sid, sd(st, 'skill'));
    if (sid === SKILL.trap.id && canAct && !skillBlock(st, sid)) skillRec = trapTry(ctx, st, sid, me.block, sd(st, 'skill'));
    if (osid === SKILL.trap.id && opCan && !skillBlock(vo, osid)) opRec = trapTry(ctx, vo, osid, op.block, sd(vo, 'skill'));
    if (osid === SKILL.sand.id && opCan && !skillBlock(vo, osid)) opRec = sandTry(ctx, vo, osid, sd(vo, 'skill'));
    var blessHeal = down ? 0 : blessTick(st), opBlessHeal = down ? 0 : blessTick(vo);
    var meWill = down ? null : willTry(ctx, st, sd(st, 'will')), opWill = down ? null : willTry(ctx, vo, sd(vo, 'will'));   // Залізна воля — сама, до ударів (здоров'я < 20%)
    var pm = R.buffed ? R.buffed(st.me.p, fm.buffs) : st.me.p, po = R.buffed ? R.buffed(st.op.p, fo.buffs) : st.op.p;
    // Обеззброєння — до ударів: вдалося — суперник уже цього ходу без зброї
    if (sid === SKILL.disarm.id && canAct && !skillBlock(st, sid)) skillRec = disarmTry(ctx, st, sid, po, sd(st, 'skill'));
    if (osid === SKILL.disarm.id && opCan && !skillBlock(vo, osid)) opRec = disarmTry(ctx, vo, osid, pm, sd(vo, 'skill'));
    var opDisarmed = disarmedOn(st), meDisarmed = disarmedOn(vo);
    if (opDisarmed) po = noWeapon(po);
    if (meDisarmed) pm = noWeapon(pm);
    // Розбити щит — до ударів: вдалося — у суперника вже цього ходу немає щита
    if (sid === SKILL.shieldbreak.id && canAct && !skillBlock(st, sid)) skillRec = shatterTry(ctx, st, sid, sd(st, 'skill'));
    if (osid === SKILL.shieldbreak.id && opCan && !skillBlock(vo, osid)) opRec = shatterTry(ctx, vo, osid, sd(vo, 'skill'));
    var opNoShield = shieldOffNow(st.op, st.round), meNoShield = shieldOffNow(st.me, st.round);
    if (opNoShield) po = noShield(ctx, po, shieldEntry(st.op));
    if (meNoShield) pm = noShield(ctx, pm, shieldEntry(st.me));
    pm = turnBoost(st, pm); po = turnBoost(vo, po);
    if (hideOn(st)) { pm = clone(pm); pm.dmgMul = (num(pm.dmgMul) || 1) * (V(st, 'ranger.hide', 'dmgMul') || 130) / 100; }   // сховався — твої удари цього ходу сильніші
    if (camoOn(st)) { pm = clone(pm); pm.dmgMul = Math.round((num(pm.dmgMul) || 1) * (V(st, 'ranger.camo', 'dmgMul') || 110)) / 100; }   // Камуфляж — сильніші удари
    if (camoOn(vo)) { po = clone(po); po.dmgMul = Math.round((num(po.dmgMul) || 1) * (V(vo, 'ranger.camo', 'dmgMul') || 110)) / 100; }
    /* Око мисливця: точність +accPct %, кожен удар у закриту зону — шанс gap % пробити блок (strike: att.gapPct) */
    var eyeP = function (v, p) { if (!eyeOn(v)) return p; p = clone(p); p.accuracy = Math.round(num(p.accuracy) * (1 + V(v, 'ranger.hunter', 'accPct') / 100)); p.gapPct = V(v, 'ranger.hunter', 'gap'); return p; };
    pm = eyeP(st, pm); po = eyeP(vo, po);
    // Кистень: шанс блоку щита суперника проти твоїх ударів менший
    // перевага Слідопита «Хльосткий кнут»: з кнутом шанс блоку суперника менший (разом із Кистенем — множаться)
    var flailCut = function (v, pD) {
      var ws = weaponSkill(v), cut = ws === 'knight.flail' && hasSk(v, ws) ? V(v, ws, 'shieldCut') : 0;
      var wc = wTypeNow(v) === 'whip' ? perkOf(v, 'whipCut') : 0;
      if ((!cut && !wc) || !(num(pD.blockPhys) > 0)) return pD;
      var o = {}, k; for (k in pD) o[k] = pD[k]; o.blockPhys = Math.round(num(pD.blockPhys) * (1 - cut / 100) * (1 - wc / 100) * 10) / 10; return o;
    };
    var poA = flailCut(st, po), pmA = flailCut(vo, pm);
    // Випад — посилює основний удар цього ходу
    var lunge = null, opLunge = null, cleave = null, opCleave = null;
    if (sid === SKILL.lunge.id && canAct && !skillBlock(st, sid)) { lunge = lungeTry(ctx, st, sid, pm, sd(st, 'skill')); skillRec = lunge.rec; }
    if (osid === SKILL.lunge.id && opCan && !skillBlock(vo, osid)) { opLunge = lungeTry(ctx, vo, osid, po, sd(vo, 'skill')); opRec = opLunge.rec; }
    if (sid === SKILL.cleave.id && canAct && !skillBlock(st, sid)) { cleave = cleaveTry(ctx, st, sid, pm, sd(st, 'skill')); skillRec = cleave.rec; }
    if (osid === SKILL.cleave.id && opCan && !skillBlock(vo, osid)) { opCleave = cleaveTry(ctx, vo, osid, po, sd(vo, 'skill')); opRec = opCleave.rec; }
    var ambush = null, opAmbush = null;                          // Засідка — як Розсікти: перший удар ×3, без блоку й ухилення
    if (sid === SKILL.ambush.id && canAct && !skillBlock(st, sid)) { ambush = ambushTry(ctx, st, sid, pm, sd(st, 'skill')); skillRec = ambush.rec; }
    if (osid === SKILL.ambush.id && opCan && !skillBlock(vo, osid)) { opAmbush = ambushTry(ctx, vo, osid, po, sd(vo, 'skill')); opRec = opAmbush.rec; }
    /* Розсікти: перший удар — посилений і без блоку; решта ударів ходу (extra) — звичайні */
    var hitOf = function (cl, ln, pA, pD, blocked, seed) {
      var r0 = rng(seed);
      if (!(cl && cl.att)) { var a0 = R.attack(ln && ln.att ? ln.att : pA, pD, blocked, r0); if (ln && ln.att) a0.hits.forEach(function (x) { x.lunge = true; }); return a0; }
      var h = R.attack(cl.att, noBlock(pD), false, r0); h.hits.forEach(function (x) { x[cl.tag || 'cleave'] = true; });
      for (var i = 0; i < Math.max(0, Math.floor(num(pA.extra))); i++) addHit(h, R.strike(pA, pD, blocked, r0));
      return h;
    };
    var meTrapped = trappedNow(st, st.me), opTrapped = trappedNow(st, st.op);   // у пастці — без звичайних ударів (вміння й пояс — так)
    if (opTrapped) { poA = clone(poA); poA.evade = false; if (po.evade) { poA.blockPhys = 0; poA.blockMag = 0; } pm = clone(pm); pm.sure = true; }   // у пастці — не відскочить і не ухилиться: твої удари не промахуються
    if (meTrapped) { pmA = clone(pmA); pmA.evade = false; if (pm.evade) { pmA.blockPhys = 0; pmA.blockMag = 0; } po = clone(po); po.sure = true; }
    var meHit = down ? none('skip') : fm.feared ? none('fear') : meKnocked ? none('knock') : meTrapped ? none('trap') : hitOf(cleave || ambush, lunge, pm, poA, me.atk === op.block, st.bid + '|' + st.round + '|me');
    var opHit = down ? none('skip') : fo.feared ? none('fear') : knocked ? none('knock') : opTrapped ? none('trap') : hitOf(opCleave || opAmbush, opLunge, po, pmA, op.atk === me.block, st.bid + '|' + st.round + '|op');
    if (cleave && cleave.att) cleaveLanded(st, cleave.rec, meHit);
    if (opCleave && opCleave.att) cleaveLanded(vo, opCleave.rec, opHit);
    var meAtk = !down && !fm.feared && !meKnocked && !meTrapped, opAtk = !down && !fo.feared && !knocked && !opTrapped;
    if (meHit.kind === 'knock' && num(fm.stun) === st.round) meHit.stun = true;   // оглушений Оглушливим ударом, не збитий з ніг
    if (opHit.kind === 'knock' && num(fo.stun) === st.round) opHit.stun = true;
    if (lunge && lunge.att) lungeExtra(ctx, st, lunge, meHit, pm, poA, me.atk === op.block, sd(st, 'lunge'));
    if (opLunge && opLunge.att) lungeExtra(ctx, vo, opLunge, opHit, po, pmA, op.atk === me.block, sd(vo, 'lunge'));
    if (meAtk) comboTry(ctx, st, meHit, pm, poA, op.block, sd(st, 'combo'));
    if (opAtk) comboTry(ctx, vo, opHit, po, pmA, me.block, sd(vo, 'combo'));
    // Друга атака: з шансом — ще один звичайний удар у ту саму зону
    if (meAtk) secondTry(ctx, st, meHit, pm, poA, me.atk === op.block, sd(st, 'second'));
    if (opAtk) secondTry(ctx, vo, opHit, po, pmA, op.atk === me.block, sd(vo, 'second'));
    // Третя атака (незалежно від Другої) і Друга зброя (удар лівою)
    if (meAtk) thirdTry(ctx, st, meHit, pm, poA, me.atk === op.block, sd(st, 'third'));
    if (opAtk) thirdTry(ctx, vo, opHit, po, pmA, op.atk === me.block, sd(vo, 'third'));
    if (meAtk) offhandTry(ctx, st, meHit, pm, poA, me.atk === op.block, sd(st, 'offhand'));
    if (opAtk) offhandTry(ctx, vo, opHit, po, pmA, op.atk === me.block, sd(vo, 'offhand'));
    if (meAtk) hasteTry(ctx, st, meHit, pm, poA, me.atk === op.block, sd(st, 'haste'));   // Поспіх — ще один удар
    if (opAtk) hasteTry(ctx, vo, opHit, po, pmA, op.atk === me.block, sd(vo, 'haste'));
    // вміння Героя, що ростуть від ударів
    if (meAtk) {
      // удар зброєю: влучив — вдале, промах / блок / ухилення — невдале
      var wsk = weaponSkill(st);
      (meHit.hits || []).forEach(function (h) {
        var ok = h.kind === 'hit' || h.kind === 'crit';
        grow(st, 'base.weapons', ok); if (exoticOn(st)) grow(st, 'base.exotic', ok);
        if (wsk && !h.left) grow(st, wsk, ok);                         // вміння зброї — лише від ударів правою
        grow(st, 'knight.enh', ok);                                   // Посилений урон — від кожного удару
        if (wpn && !h.left) grow(st, 'ranger.wmaster', ok);           // Майстер зброї — від ударів зброєю
        if (h.gapRoll != null) grow(st, 'ranger.hunter', !!h.gap);     // Око мисливця — від ударів у закриту зону
      });
      if (fm.bond) grow(st, 'base.bond', meHit.dmg > 0);
      if (gripOn(st) && hasSk(st, 'knight.grip')) (meHit.hits || []).forEach(function (h) { if (!h.left) grow(st, 'knight.grip', h.kind === 'hit' || h.kind === 'crit'); });
      if (wpn) bd.n++;
    }
    if (opAtk && st.op.up) {                                       // бот росте в межах бою: вміння зброї й Посилений урон
      var owsk = weaponSkill(vo);
      (opHit.hits || []).forEach(function (h) { var ok = h.kind === 'hit' || h.kind === 'crit'; if (owsk) grow(vo, owsk, ok); grow(vo, 'knight.enh', ok); });
    }
    // захист: Сховатись (не помітив), ухилення, парирування, щит — кожен від ударів суперника
    hideMiss(ctx, st, opHit, sd(st, 'hide'));
    if (!meTrapped) applyDodge(ctx, st, opHit, sd(st, 'dodge'));            // у пастці — не ухилиться
    applyParry(ctx, st, opHit, op.atk !== me.block, sd(st, 'parry'));
    // щит: блок «шансом блоку» речей (не відскок) зі щитом у руці — теж вдале очко вміння
    if (shieldOn(st)) (opHit.hits || []).forEach(function (h) {
      if (h.kind === 'block' && h.byChance && !h.evade) { grow(st, 'base.shield', true); grow(st, 'knight.shield', true); }
      else if ((h.kind === 'hit' || h.kind === 'crit') && op.atk !== me.block) grow(st, 'knight.shield', false);   // Блок щитом: удар у незахищену зону пройшов
    });
    applyShield(ctx, st, opHit, sd(st, 'shield'));
    if (!opTrapped) applyDodge(ctx, vo, meHit, sd(vo, 'dodge'));
    applyParry(ctx, vo, meHit, me.atk !== op.block, sd(vo, 'parry'));
    applyShield(ctx, vo, meHit, sd(vo, 'shield'));
    var trapRec = opAtk ? trapSpring(ctx, st, SKILL.trap.id, opHit, op.atk, sd(st, 'trap')) : null;   // Пастка: суперник ударив у її зону
    var opTrapRec = meAtk ? trapSpring(ctx, vo, SKILL.trap.id, meHit, me.atk, sd(vo, 'trap')) : null;
    camoLanded(st, meHit); camoLanded(vo, opHit);
    venomHits(ctx, st, meHit, sd(st, 'venom')); venomHits(ctx, vo, opHit, sd(vo, 'venom'));   // змащена зброя: урон отрутою й шанс отруїти
    // Міцне тіло: росте від кожного удару суперника, що завдав урону — після ухилення, парирування й щита (у бота — в межах бою)
    if (opAtk) (opHit.hits || []).forEach(function (h) { if ((h.kind === 'hit' || h.kind === 'crit') && num(h.dmg) > 0) grow(st, 'knight.tough', true); });
    if (meAtk && st.op.up) (meHit.hits || []).forEach(function (h) { if ((h.kind === 'hit' || h.kind === 'crit') && num(h.dmg) > 0) grow(vo, 'knight.tough', true); });
    // Протидія: кожен свій блок — рідкісний контрудар ×0.5 у зону своєї атаки
    if (meAtk) riposteTry(ctx, st, opHit, meHit, pm, poA, me.atk === op.block, sd(st, 'riposte'));
    if (opAtk) riposteTry(ctx, vo, meHit, opHit, po, pmA, op.atk === me.block, sd(vo, 'riposte'));
    // активне вміння: окремий удар (Пінок, Вогник, Поштовх, Древко, Пантелик)
    var r1 = activeStrike(ctx, st, sid, canAct, pm, poA, me, op, sd(st, 'skill'));
    if (r1) skillRec = r1;
    var r2 = activeStrike(ctx, vo, osid, opCan, po, pmA, op, me, sd(vo, 'skill'));
    if (r2) opRec = r2;
    if (sid && (st.me.bar || []).map(canon).indexOf(sid) < 0) st.me.skill = null;   // вибір лишається на наступний хід
    if (osid && (st.op.bar || []).indexOf(osid) < 0) st.op.skill = null;
    // Кам'яна шкіра: урон по тому, хто під нею, −cut% (до бар'єра)
    stoneCut(st, opHit); stoneCut(vo, meHit);
    if (skillRec && skillRec.dmg > 0) stoneCut(vo, skillRec);
    if (opRec && opRec.dmg > 0) stoneCut(st, opRec);
    if (skillRec && skillRec.dmg > 0) { var sh = { dmg: skillRec.dmg, kind: 'hit', hits: [skillRec] }; applyBarrier(fo, sh); skillRec.dmg = sh.dmg; }
    if (opRec && opRec.dmg > 0) { var sh2 = { dmg: opRec.dmg, kind: 'hit', hits: [opRec] }; applyBarrier(fm, sh2); opRec.dmg = sh2.dmg; }
    applyBarrier(fo, meHit); applyBarrier(fm, opHit);
    var first1 = meAtk && !down ? spearFirst(ctx, st, meHit.dmg + (skillRec ? num(skillRec.dmg) : 0), sd(st, 'first')) : null;
    if (first1 && first1.ok) { opHit = none('slow'); if (opRec && num(opRec.dmg) > 0) opRec = null; }   // Спис: ти встиг першим — удару суперника немає
    st.op.f.lastPlayerAtk = me.atk;
    st._wlog = [];
    addWear(ctx, st, meHit, opHit, op.atk);
    var wlog = st._wlog; delete st._wlog;
    if (opRec && opRec.kind === 'shatter' && wearItems(ctx, st, 'shield').length) {   // твій щит відлетів — −20 міцності
      var sw = (ctx.R.WEAR && ctx.R.WEAR.shieldBreakHit) || 20; st.wear.shield = (st.wear.shield || 0) + sw; wlog.push({ k: 'shield', n: sw });
    }
    var broke = checkBreaks(ctx, st);
    st.op.force -= meHit.dmg + (skillRec ? skillRec.dmg : 0);
    st.me.force -= opHit.dmg + (opRec ? opRec.dmg : 0);
    var psnOp = down ? 0 : poisonTick(st.op, st.round), psnMe = down ? 0 : poisonTick(st.me, st.round);   // отрута — наприкінці ходу, броня не захищає
    // концентрація кожного: Лицар — росте від урону; решта — у спокійний хід
    var meN = landedN(meHit, skillRec), opN = landedN(opHit, opRec);   // для «Мисливського азарту»: рахунок влучань ходу
    var calmRec = focusTick(ctx, st, opHit.dmg + (opRec ? opRec.dmg : 0), down, sd(st, 'focus'), sd(st, 'calm'), meN, opN);
    var opCalm = focusTick(ctx, vo, meHit.dmg + (skillRec ? skillRec.dmg : 0), down, sd(vo, 'focus'), sd(vo, 'calm'), opN, meN);
    var opG0 = clone(st.op.sk || {}); botGrowth(st);
    var opUp = Object.keys(st.op.sk || {}).filter(function (id) { return st.op.sk[id] !== opG0[id]; }).map(function (id) { return [id, Math.round(st.op.sk[id] * 100)]; });
    tickBuffs(st.me); tickBuffs(st.op);
    st.me.last = { atk: me.atk, block: me.block };
    st.me.atk = me.atk; st.me.block = me.block;      // вибір лишається на наступний хід
    st.op.atk = op.atk; st.op.block = op.block;
    st.played++; if (auto) st.missed++;
    var e = { t: 'turn', r: st.round, me: me, op: op, auto: auto, meHit: meHit, opHit: opHit, broke: broke };
    trapRec = trapRec || trapExpire(st, SKILL.trap.id); opTrapRec = opTrapRec || trapExpire(vo, SKILL.trap.id);
    if (trapRec) e.trap = trapRec; if (opTrapRec) e.opTrap = opTrapRec;
    if (meTrapped) e.meTrapped = true; if (opTrapped) e.opTrapped = true;
    if (uses.length) e.uses = uses;
    if (skillRec) e.skill = skillRec;
    if (knocked) e.knocked = true;
    if (meKnocked) e.meKnocked = true;
    if (blessHeal) e.blessHeal = blessHeal;
    if (opDisarmed) e.opDisarmed = true;
    if (opNoShield) e.opNoShield = true;
    if (meNoShield) e.meNoShield = true;
    if (opShieldBack) e.opShieldBack = true;
    if (meWill) e.will = meWill;
    if (opWill) e.opWill = opWill;
    if (meShieldBack) e.meShieldBack = true;
    if (calmRec) e.calm = calmRec;
    if (st.me.fx && st.me.fx.focus != null) e.focus = num(st.me.fx.focus);
    // те саме для суперника (бот із вміннями)
    if (opRec) e.opSkill = opRec;
    if (opBlessHeal) e.opBlessHeal = opBlessHeal;
    if (meDisarmed) e.meDisarmed = true;
    if (opCalm) e.opCalm = opCalm;
    if (opUp.length) e.opUp = opUp;
    // 🧪 ТИМЧАСОВО ДЛЯ ТЕСТУ: стан обох після ходу (мана, концентрація, до якого ходу діють лють / благословення / обеззброєння / оглушення)
    var snap = function (u) { var f = u.fx || {}; return { m: Math.round(num(u.mana)), f: num(f.focus), bz: num(f.berserk), bl: f.bless ? num(f.bless.until) : 0, dis: num(f.disarm), kn: num(f.knock),
      sto: f.stone ? num(f.stone.until) : 0, sng: f.song ? num(f.song.until) : 0, wil: num(f.will), sho: num(f.shieldOff), tng: f.tangle ? num(f.tangle.until) : 0, frz: num(f.frenzy), car: num(f.careful), psn: f.poison ? num(f.poison.until) : 0, pres: poisonRes(u, st.round, 'chance'), ven: f.venom ? num(f.venom.until) : 0, bld: f.blind ? num(f.blind.until) : 0, tog: (u.tog || []).slice(), cd: clone(u.cd || {}) }; };
    e.st = { me: snap(st.me), op: snap(st.op) };
    if (st.op.fx && st.op.fx.focus) e.opFocus = num(st.op.fx.focus);
    // ріст вмінь цього ходу: {id: [вдалих, невдалих, разом вдалих за бій, разом невдалих за бій]}
    var gr = {}, g1 = st.me.grow || {}, f1 = st.me.growF || {};
    Object.keys(Object.assign({}, g1, f1)).forEach(function (id) {
      var a = num(g1[id]) - num(g0[id]), b = num(f1[id]) - num(f0[id]);
      if (a || b) gr[id] = [a, b, num(g1[id]), num(f1[id])];
    });
    if (Object.keys(gr).length) e.grow = gr;
    // для детального журналу: знос речей цього ходу (з назвами) і здоров'я після ходу
    if (wlog.length) e.wear = wlog.map(function (x) { return { who: wearWho(ctx, st, x.k), n: x.n, saved: !!x.saved }; });
    e.hp = [Math.max(0, Math.round(st.me.force)), st.me.max, Math.max(0, Math.round(st.op.force)), st.op.max];
    if (first) e.first = first;
    if (first1) e.spearFirst = first1;
    if (psnOp) e.poison = psnOp;
    if (psnMe) e.mePoison = psnMe;
    if (meTog && meTog.length) e.tog = meTog;
    if (opWipe) e.opWipe = opWipe;
    if (rearmed != null) e.rearm = rearmed;
    st.log.push(e);
    st.rev++;
    if (st.me.force <= 0 || st.op.force <= 0) finish(ctx, st, { meDown: st.me.force <= 0, opDown: st.op.force <= 0, now: now });
    else { st.round++; st.deadline = (now || Date.now()) + PAUSE_MS + turnMs(ctx); }
    return e;
  }

  /* ── ДОІГРУВАННЯ: усі ходи, час яких уже минув, — автоматично.
     Кожен наступний пропущений хід відлічується від терміну попереднього. */
  function catchUp(ctx, st, now) {
    now = now || Date.now();
    var n = 0;
    while (isLive(st) && now >= st.deadline && n < 500) {
      var at = st.deadline;
      turn(ctx, st, null, { auto: true }, at);
      if (isLive(st)) st.deadline = at + turnMs(ctx);
      n++;
    }
    return n;
  }

  /* ── ПЕРЕВДЯГАННЯ в бою (спецвміння ходу): лише в стані бою ──
     inst — річ із сумки {uid,id,bonus,durMax,durCur} (null — зняти), base — її опис.
     Повертає текст для журналу або null. Здоров'я від речі — лише максимум. */
  function activeIn(st, slot) { return (st.me.eq || []).filter(function (e) { return !e.off && e.slot === slot; })[0] || null; }
  function swap(ctx, st, slot, inst, base) {
    if (!isLive(st) || swapped(st) || knockedNow(st, st.me) || !slot) return null;
    var R = ctx.R, w = st.wear, cur = activeIn(st, slot);
    if (!cur && !inst) return null;
    if (cur) { cur.w1 = wearOf(ctx, cur, w); cur.off = true; }
    var also = null, clash = R.handsClash || function (r) { return !!(R.isTwoHanded && R.isTwoHanded(r)); };
    if (inst && slot === 'weaponR') { var ll = activeIn(st, 'weaponL'); if (ll && clash(base, ll.base)) also = ll; }
    else if (inst && slot === 'weaponL') { var rr = activeIn(st, 'weaponR'); if (rr && clash(rr.base, base)) also = rr; }
    if (also) { also.w1 = wearOf(ctx, also, w); also.off = true; }
    if (inst) {
      var old = (st.me.eq || []).filter(function (e) { return e.uid === inst.uid; })[0];
      if (old) {
        var used = Math.max(0, (old.w1 || 0) - (old.w0 || 0));
        old.slot = slot; old.inst.slot = slot; old.off = false; delete old.w1;
        old.w0 = wearOf(ctx, old, w) - used;
      } else {
        var e = { uid: inst.uid, slot: slot, base: base, broken: false,
          dur: (inst.durMax == null ? null : num(inst.durCur != null ? inst.durCur : inst.durMax)),
          inst: { uid: inst.uid, id: inst.id, slot: slot, bonus: inst.bonus, durMax: inst.durMax, durCur: inst.durCur } };
        e.w0 = wearOf(ctx, e, w);
        st.me.eq.push(e);
      }
    }
    var np = profile(ctx, st);
    st.me.p = np; st.me.max = np.hp; st.me.force = Math.min(st.me.force, np.hp);
    var fv = st.me.fx && st.me.fx.venom; if (fv && (weaponOn(st) || {}).uid !== fv.uid) delete st.me.fx.venom;   // змащений клинок зняли / замінили — отрута зникла
    if (inst && slot === 'weaponR' && st.me.fx && st.me.fx.disarm) { delete st.me.fx.disarm; delete st.me.fx.pickup; }   // вибиту зброю вдягнув сам — одразу знову в руці
    st.swapRound = st.round;
    st.me.use = null; st.me.skill = null;                          // перевдягання — і є дія ходу: пояс і вміння знято
    var nm = function (x) { return (x && x.base && x.base.name) || ''; };
    var text = (cur ? (inst ? '«' + nm(cur) + '» → «' + base.name + '»' : 'зняв «' + nm(cur) + '»') : 'вдягнув «' + base.name + '»')
      + (also ? ' (знято «' + nm(also) + '»)' : '');
    st.log.push({ t: 'swap', r: st.round, text: text });
    st.rev++;
    return text;
  }

  /* вибита зброя Героя повертається в руку сама через хід (як у бота) — якщо права рука ще вільна
     і зброя не заважає речі в лівій. Вдягнув раніше сам — повертати нічого. → назва для журналу або null */
  function rearm(ctx, st) {
    var f = st.me.fx, p = f && f.pickup; if (!p || st.round < num(p.at)) return null;
    delete f.pickup;
    var e = (st.me.eq || []).filter(function (x) { return x.uid === p.uid; })[0];
    if (!e || !e.off || e.broken || activeIn(st, 'weaponR')) return null;
    var R = ctx.R, ll = activeIn(st, 'weaponL'), clash = R.handsClash || function (r) { return !!(R.isTwoHanded && R.isTwoHanded(r)); };
    if (ll && clash(e.base, ll.base)) return null;
    var used = Math.max(0, (e.w1 || 0) - (e.w0 || 0));
    e.slot = 'weaponR'; e.inst.slot = 'weaponR'; e.off = false; delete e.w1;
    e.w0 = wearOf(ctx, e, st.wear) - used;
    var np = profile(ctx, st); st.me.p = np; st.me.max = np.hp; st.me.force = Math.min(st.me.force, np.hp);
    if (f.disarm) delete f.disarm;
    return (e.base && e.base.name) || '';
  }

  /* ── здатися: поразка, без досвіду; знос — як є ── */
  function surrender(ctx, st, now) {
    if (!isLive(st)) return;
    finish(ctx, st, { meDown: true, opDown: false, surrender: true, now: now });
    st.rev++;
  }

  /* ── КІНЕЦЬ БОЮ: підсумок для основного запису ──
     Досвід: перемога / нічия × коефіцієнт сили суперника, поразка — стало.
     Участь гравця: пропущено > 25% ходів → −25%, > 50% → 0 (АФК-бій:
     поразка рахується, перемога й нічия — ні). Знос записується завжди. */
  function finish(ctx, st, o) {
    var B = (ctx.R && ctx.R.BATTLE) || {};
    var res = o.meDown && o.opDown ? 'draw' : (o.opDown ? 'win' : 'lose');
    st.me.tog = []; if (st.op) st.op.tog = [];                     // бій скінчився — перемикачі вимикаються
    var coef = ctx.R.xpCoef ? ctx.R.xpCoef(st.me.p, st.op.p) : 1;
    var xpMul = num(st.op.f && st.op.f.xpMul) || 1;                // складність суперника: ×0.75 … ×1.5
    var xpBase = o.surrender ? 0 : res === 'win' ? Math.round(num(B.xpWin || 50) * coef * xpMul)
      : res === 'draw' ? Math.round(num(B.xpDraw || 25) * coef * xpMul) : num(B.xpLose || 8);
    var share = st.played ? st.missed / st.played : 0;
    var cut = share > AFK_ZERO ? 100 : (share > AFK_CUT ? 25 : 0);
    var afk = cut === 100;
    var xp = cut === 100 ? 0 : Math.round(xpBase * (100 - cut) / 100);
    // знос кожної речі за бій (лише поки була вдягнена) і зламані
    var wear = {}, broken = [], items = [];
    (st.me.eq || []).forEach(function (e) {
      if (e.dur == null || e.dur <= 0) return;      // зламана ще до бою — її бій не чіпає
      var n = itemWear(ctx, e, st.wear);
      if (n <= 0) return;
      wear[e.uid] = (wear[e.uid] || 0) + n;
      var gone = e.broken || n >= e.dur;
      if (gone && broken.indexOf(e.uid) < 0) broken.push(e.uid);
      items.push({ uid: e.uid, name: itemName(ctx, e), lost: Math.min(n, e.dur), gone: gone });
    });
    st.status = 'over';
    st.endedAt = o.now || Date.now();
    st.summary = {
      bid: st.bid, kind: st.kind, result: res, surrender: !!o.surrender,
      xp: xp, xpBase: xpBase, coef: coef, xpMul: xpMul, cut: cut, afk: afk,
      played: st.played, missed: st.missed,
      count: { wins: (res === 'win' && !afk) ? 1 : 0, losses: res === 'lose' ? 1 : 0, draws: (res === 'draw' && !afk) ? 1 : 0 },
      wear: wear, broken: broken, items: items, used: (st.used || []).slice(),
      grow: clone(st.me.grow || {}), growFail: clone(st.me.growF || {}),
      op: st.op.f.name, endedAt: st.endedAt
    };
    return st.summary;
  }

  /* ── ЗАСТОСУВАННЯ ПІДСУМКУ до документа Героя (чиста функція) ──
     d — дані heroes/{id}; повертає лише поля, які треба записати.
     Повторне застосування того самого бою нічого не змінює (lastBattleId). */
  function applyToHero(ctx, d, sum, fallbackArena) {
    d = d || {};
    if (!sum || !sum.bid) return null;
    if (d.lastBattleId === sum.bid) return { already: true, lastBattle: d.lastBattle || null };
    var inv = Array.isArray(d.inventory) ? clone(d.inventory) : [];
    var lost = [];
    // знос; річ, що дійшла до 0 (зламалась у бою), — зникає
    inv = inv.filter(function (inst) {
      if (!inst || !inst.uid || !sum.wear || !sum.wear[inst.uid] || inst.durMax == null) return true;
      var before = num(inst.durCur != null ? inst.durCur : inst.durMax);
      inst.durCur = Math.max(0, before - sum.wear[inst.uid]);
      if (inst.durCur <= 0 || (sum.broken || []).indexOf(inst.uid) >= 0) { lost.push(inst.id); return false; }
      return true;
    });
    // використані зілля / сувої: за uid, а немає — одна штука зі стопки того ж зілля
    (sum.used || []).forEach(function (u) {
      var k = -1, i;
      for (i = 0; i < inv.length; i++) if (inv[i] && inv[i].uid === u.uid) { k = i; break; }
      if (k < 0) for (i = 0; i < inv.length; i++) { var x = inv[i]; if (x && x.id === u.id && num(x.bonus || 1) === num(u.bonus || 1)) { k = i; break; } }
      if (k < 0) return;
      var q = num(inv[k].qty) || 1;
      if (q > 1) inv[k].qty = q - 1; else inv.splice(k, 1);
    });
    // досвід і статистика арени
    var A0 = d.arena || fallbackArena || {};
    var A = { level: Math.max(1, num(A0.level) || 1), xp: num(A0.xp), wins: num(A0.wins), losses: num(A0.losses), draws: num(A0.draws) };
    A.wins += sum.count.wins; A.losses += sum.count.losses; A.draws += sum.count.draws;
    A.xp += sum.xp;
    var need = ctx.R.xpNeed || function (lv) { return Math.min(Math.max(1, lv) * 500, 8000); };
    var leveled = [];
    while (A.xp >= need(A.level)) { A.xp -= need(A.level); A.level++; leveled.push(A.level); }
    var hist = (Array.isArray(d.battleIds) ? d.battleIds.slice() : []).filter(function (b) { return b !== sum.bid; });
    hist.push(sum.bid);
    var drop = hist.length > KEEP_HISTORY ? hist.splice(0, hist.length - KEEP_HISTORY) : [];
    var last = { bid: sum.bid, result: sum.result, xp: sum.xp, cut: sum.cut, afk: sum.afk, surrender: sum.surrender,
      played: sum.played, missed: sum.missed, op: sum.op || '', items: sum.items || [], at: sum.endedAt || Date.now() };
    return { fields: { inventory: inv, arena: A, lastBattleId: sum.bid, lastBattle: last, activeBattle: null, battleIds: hist },
      leveled: leveled, lost: lost, drop: drop, lastBattle: last };
  }

  /* ── чи «живий» замок бою з документа Героя ──
     activeBattle = {bid, deadline}. Мертвий, якщо цей бій уже застосовано
     або від останнього терміну минуло понад 30 хв (бій ніхто не доіграв). */
  function lockLive(d, now) {
    var a = d && d.activeBattle;
    if (!a || !a.bid) return false;
    if (d.lastBattleId === a.bid) return false;
    return (now || Date.now()) < num(a.deadline) + 30 * 60 * 1000;
  }

  /* ── тексти для дитини про участь у бою ── */
  function noticeText(s) {
    if (!s) return '';
    var miss = 'Пропущено ' + s.missed + ' з ' + s.played + ' ходів';
    var wear = (s.items || []).length ? ' Знос речей записано.' : '';
    var gone = (s.items || []).filter(function (i) { return i.gone; }).map(function (i) { return i.name; });
    var goneT = gone.length ? ' Зламались і зникли: ' + gone.join(', ') + '.' : '';
    var t;
    if (s.surrender) t = 'Ти здався — досвід не нараховано.';
    else if (s.afk) t = 'Бій пройшов без тебе (' + miss.toLowerCase() + ') — досвід не нараховано.';
    else if (s.cut) t = miss + ' — досвід зменшено на ' + s.cut + '%.';
    else t = s.missed ? miss + '.' : '';
    return (t + wear + goneT).trim();
  }

  var API = {
    ZONES: ZONES, PAUSE_MS: PAUSE_MS, AFK_CUT: AFK_CUT, AFK_ZERO: AFK_ZERO, KEEP_HISTORY: KEEP_HISTORY,
    rng: rng, newBid: newBid, newWear: newWear, isLive: isLive, turnMs: turnMs,
    eqLite: eqLite, profile: profile, wearOf: wearOf, itemWear: itemWear, leftDur: leftDur, activeIn: activeIn,
    create: create, botChoice: botChoice, autoChoice: autoChoice, turn: turn, catchUp: catchUp,
    poisonRes: poisonRes,
    togMul: togMul, togOrder: togOrder, trapOn: trapOn,
    swap: swap, useBelt: useBelt, beltItem: beltItem, beltLite: beltLite, applyUse: applyUse, fxOf: fxOf,
    surrender: surrender, finish: finish, applyToHero: applyToHero, lockLive: lockLive, noticeText: noticeText,
    SKILL: SKILL, useSkill: useSkill, skillBlock: skillBlock, berserkOn: berserkOn, blessOn: blessOn, disarmedOn: disarmedOn, SKILL_WEAPONS: SKILL_WEAPONS, SHATTER_MUL: SHATTER_MUL, PARRY: PARRY, swapped: swapped, beltChosen: beltChosen, knockedNow: knockedNow
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.SKBATTLE = API;
})(typeof window !== 'undefined' ? window : this);

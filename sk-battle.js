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
    return ctx.R.fighter(st.me.stats,
      (st.me.eq || []).filter(function (e) { return !e.off; }).map(function (e) { return { base: e.base, inst: e.inst }; }), ctx.K);
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
      if (st.me.use && st.me.useRound === st.round) { st.me.use = null; st.swapRound = 0; st.rev++; return true; }
      return false;
    }
    var b = beltItem(st, uid);
    if (!b || b.used || st.swapRound === st.round) return false;
    st.me.use = uid; st.me.useRound = st.round; st.swapRound = st.round; st.rev++;
    return true;
  }
  /* одна дія з пояса: actor використовує item проти target. Повертає запис для журналу. */
  function applyUse(ctx, st, actor, target, side, item, rnd) {
    var R = ctx.R, B = R.BATTLE || {}, fa = fxOf(actor), ft = fxOf(target);
    var rec = { side: side, uid: item.uid, id: item.id, name: (item.base && item.base.name) || item.id, fx: [] };
    if (side === 'me') { item.used = true; (st.used = st.used || []).push({ uid: item.uid, id: item.id, bonus: item.bonus }); }
    if (fa.feared) { rec.lost = true; return rec; }                    // під страхом: річ витрачено без ефекту
    var effs = R.useEffects ? R.useEffects(item.base, { bonus: item.bonus || 1 }, ctx.K) : [];
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
          fa.buffs[ef.key] = { pct: ef.pct, turns: t, name: rec.name };
          r.turns = t;
        }
      } else if (ef.type === 'scroll') {
        var h = R.scrollStrike(R.buffed(actor.p, fa.buffs), R.buffed(target.p, ft.buffs), ef, rnd);
        if (h.dmg > 0 && ft.barrier > 0) { ft.barrier--; h.barrier = true; h.absorbed = h.dmg; h.dmg = 0; h.magDmg = 0; h.kind = 'barrier'; }
        target.force -= h.dmg;
        r.hit = h;
      } else if (ef.type === 'fear') {
        var immune = ft.fear >= (B.fearImmune || 2);
        if (immune) { r.immune = true; }
        else {
          r.need = Math.round(100 * (ft.fear ? (B.fearNext != null ? B.fearNext : 0.5) : (B.fearFirst != null ? B.fearFirst : 0.9)));
          r.roll = R.d100(rnd);
          r.ok = r.roll <= r.need;
          if (r.ok) { ft.fear++; ft.feared = true; r.immuneNow = ft.fear >= (B.fearImmune || 2); }
        }
      } else if (ef.type === 'barrier') {
        fa.barrier += ef.n; r.n = ef.n;
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
  function create(ctx, o) {
    var now = o.now || Date.now();
    var st = {
      v: 2, bid: o.bid || newBid(), heroId: o.heroId || '', kind: o.kind || 'arena',
      status: 'live', rev: 1, startedAt: now, deadline: now + turnMs(ctx), round: 1,
      me: { name: o.me.name, avatar: o.me.avatar, level: o.me.level || 1,
        stats: { health: num(o.me.stats.health), accuracy: num(o.me.stats.accuracy), agility: num(o.me.stats.agility), mana: num(o.me.stats.mana) },
        eq: eqLite(o.me.eq), belt: beltLite(o.me.belt), use: null, fx: { buffs: {}, barrier: 0, fear: 0 },
        last: null, atk: null, block: null },
      op: { f: o.op.f, p: o.op.p, atk: null, block: null, fx: { buffs: {}, barrier: 0, fear: 0 } },
      wear: newWear(), swapRound: 0, played: 0, missed: 0, log: [], summary: null
    };
    st.me.p = profile(ctx, st);
    st.me.max = st.me.p.hp; st.me.force = st.me.p.hp;
    st.op.max = st.op.p.hp; st.op.force = st.op.p.hp;
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
  function addWear(ctx, st, meHit, opHit, opAtk) {
    var W = ctx.R.WEAR || {}, w = st.wear;
    (opHit.hits || [opHit]).forEach(function (h) {
      if (h.kind === 'hit' || h.kind === 'crit') w[opAtk] = (w[opAtk] || 0) + (h.kind === 'crit' ? W.zoneCrit : W.zoneHit);
      else if (h.kind === 'block') blockWear(ctx, st, h);
    });
    (meHit.hits || [meHit]).forEach(function (h) {
      if (h.kind === 'hit' || h.kind === 'crit') w.weapon += h.kind === 'crit' ? W.weaponCrit : W.weaponHit;
    });
  }
  /* блок зношує щит; блок «Шансом блоку» — саме ту річ, що заблокувала */
  function blockWear(ctx, st, h) {
    var W = ctx.R.WEAR || {}, w = st.wear, n = h.crit ? W.shieldCritBlock : W.shieldBlock;
    if (h.byChance && h.blockBy) {
      var e = activeIn(st, h.blockBy);
      if (e) { w['u:' + e.uid] = (w['u:' + e.uid] || 0) + n; return; }
    }
    w.shield += n;
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
    // 1) пояс — до ударів. Обидва щось використали — 🎲 хто перший (свиток страху першого
    //    може зірвати дію другого). Бот поясом не користується (st.op.use завжди порожній).
    var acts = [], ur = rng(st.bid + '|' + st.round + '|use');
    var mi = st.me.use ? beltItem(st, st.me.use) : null;
    if (mi && !mi.used) acts.push({ side: 'me', item: mi });
    var oi = st.op.use ? ((st.op.belt || []).filter(function (b) { return b.uid === st.op.use; })[0] || null) : null;
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
    var pm = R.buffed ? R.buffed(st.me.p, fm.buffs) : st.me.p, po = R.buffed ? R.buffed(st.op.p, fo.buffs) : st.op.p;
    var meHit = down ? none('skip') : fm.feared ? none('fear') : R.attack(pm, po, me.atk === op.block, rng(st.bid + '|' + st.round + '|me'));
    var opHit = down ? none('skip') : fo.feared ? none('fear') : R.attack(po, pm, op.atk === me.block, rng(st.bid + '|' + st.round + '|op'));
    applyBarrier(fo, meHit); applyBarrier(fm, opHit);
    st.op.f.lastPlayerAtk = me.atk;
    addWear(ctx, st, meHit, opHit, op.atk);
    var broke = checkBreaks(ctx, st);
    st.op.force -= meHit.dmg;
    st.me.force -= opHit.dmg;
    tickBuffs(st.me); tickBuffs(st.op);
    st.me.last = { atk: me.atk, block: me.block };
    st.me.atk = me.atk; st.me.block = me.block;      // вибір лишається на наступний хід
    st.op.atk = op.atk; st.op.block = op.block;
    st.played++; if (auto) st.missed++;
    var e = { t: 'turn', r: st.round, me: me, op: op, auto: auto, meHit: meHit, opHit: opHit, broke: broke };
    if (uses.length) e.uses = uses;
    if (first) e.first = first;
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
    if (!isLive(st) || st.swapRound === st.round || !slot) return null;
    var R = ctx.R, w = st.wear, cur = activeIn(st, slot);
    if (!cur && !inst) return null;
    if (cur) { cur.w1 = wearOf(ctx, cur, w); cur.off = true; }
    var also = null, two = R.isTwoHanded || function () { return false; };
    if (inst && slot === 'weaponR' && two(base)) also = activeIn(st, 'weaponL');
    else if (inst && slot === 'weaponL') { var rr = activeIn(st, 'weaponR'); if (rr && two(rr.base)) also = rr; }
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
    st.swapRound = st.round;
    var nm = function (x) { return (x && x.base && x.base.name) || ''; };
    var text = (cur ? (inst ? '«' + nm(cur) + '» → «' + base.name + '»' : 'зняв «' + nm(cur) + '»') : 'вдягнув «' + base.name + '»')
      + (also ? ' (знято «' + nm(also) + '»)' : '');
    st.log.push({ t: 'swap', r: st.round, text: text });
    st.rev++;
    return text;
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
    var coef = ctx.R.xpCoef ? ctx.R.xpCoef(st.me.p, st.op.p) : 1;
    var xpBase = o.surrender ? 0 : res === 'win' ? Math.round(num(B.xpWin || 50) * coef)
      : res === 'draw' ? Math.round(num(B.xpDraw || 25) * coef) : num(B.xpLose || 8);
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
      xp: xp, xpBase: xpBase, coef: coef, cut: cut, afk: afk,
      played: st.played, missed: st.missed,
      count: { wins: (res === 'win' && !afk) ? 1 : 0, losses: res === 'lose' ? 1 : 0, draws: (res === 'draw' && !afk) ? 1 : 0 },
      wear: wear, broken: broken, items: items, used: (st.used || []).slice(),
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
    swap: swap, useBelt: useBelt, beltItem: beltItem, beltLite: beltLite, applyUse: applyUse, fxOf: fxOf,
    surrender: surrender, finish: finish, applyToHero: applyToHero, lockLive: lockLive, noticeText: noticeText
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.SKBATTLE = API;
})(typeof window !== 'undefined' ? window : this);

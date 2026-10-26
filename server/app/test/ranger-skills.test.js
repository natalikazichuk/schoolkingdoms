/* 🏹 Слідопит: спільні вміння (як у Лицаря), унікальні (Майстер зброї, Сховатись) і переваги класу */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path'), fs = require('fs'), vm = require('vm');
const ROOT = path.join(__dirname, '..', '..', '..');
const box = { window: {}, console };
box.window.window = box.window;
['sk-items.js', 'sk-arena-rules.js', 'sk-skills.js', 'sk-battle.js'].forEach(f => vm.runInNewContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), box.window, { filename: f }));
const R = box.window.SKARENA, K = box.window.SKIT, SB = box.window.SKBATTLE, S = box.window.SKSKILLS;
const ctx = { R, K };
const item = (o) => Object.assign({ addStats: [] }, o);
const W = (id, t) => item({ id, name: t, category: 'Зброя', stat: 'Урон', valueMin: 4, valueMax: 6, weaponType: t });
const DAGGER = W('D1', 'dagger'), SPEAR = W('P1', 'spear'), WHIP = W('H1', 'whip'), SWORD = W('S1', 'sword');
const SHIELD = item({ id: 'SH', name: 'Щит', category: 'Щити', stat: 'Броня', valueMin: 2, valueMax: 2, addStats: [{ stat: 'Шанс блоку', value: 50 }] });
const wear = (base, slot) => ({ base, inst: { uid: base.id + slot, id: base.id, slot, bonus: 1, durMax: 500, durCur: 500 } });
const skvOf = (sk) => { const o = {}; Object.keys(sk || {}).forEach(id => { o[id] = S.skillValues(id, Math.round(sk[id] * 100)); }); return o; };
let n = 0;
function battle(sk, bar, eq, opEq) {
  return SB.create(ctx, {
    bid: 'rg-' + (n++),
    me: { name: 'Я', stats: { health: 400, accuracy: 60, agility: 50, mana: 500 }, eq: eq || [], sk, skv: skvOf(sk), bar, cls: 'ranger' },
    op: { f: { name: 'Бот', level: 3 }, p: R.fighter({ health: 400, accuracy: 50, agility: 50, mana: 0 }, opEq || [], K) }
  });
}
const HIT = { atk: 'head', block: 'body' };
const RG = ['ranger.dagger', 'ranger.spear', 'ranger.whip', 'ranger.wmaster', 'ranger.hide', 'ranger.disarm', 'ranger.fists', 'ranger.brave'];

test('Слідопит етап 1: у кожного вміння правила, значок і опис', () => {
  RG.forEach(id => {
    const s = S.byId(id);
    assert.ok(s && s.ready, id + ' готове');
    assert.ok(S.effectText(id, 0.5), id + ' опис');
    assert.ok(s.icon, id + ' значок');
  });
  const ready = S.readyFor('ranger').map(s => s.id);
  RG.forEach(id => assert.ok(ready.includes(id), id + ' у списку готових'));
});


function asKnight(sk, eq, opEq) {
  const st = battle({}, [], eq, opEq);
  return SB.create(ctx, { bid: 'kn-' + (n++), me: { name: 'Я', stats: { health: 400, accuracy: 60, agility: 50, mana: 500 }, eq: eq || [], sk, skv: skvOf(sk), bar: [], cls: 'knight' },
    op: { f: { name: 'Бот', level: 3 }, p: R.fighter({ health: 400, accuracy: 50, agility: 50, mana: 0 }, opEq || [], K) } });
}
const SHARED = ['dagger', 'spear', 'whip', 'fists', 'disarm', 'brave'];

test('Спільні вміння: у Слідопита ті самі правила, опис і значок, що в Лицаря', () => {
  SHARED.forEach(k => {
    const r = S.byId('ranger.' + k), kn = S.byId('knight.' + k);
    assert.strictEqual(r.name, kn.name);
    assert.strictEqual(r.formula, kn.formula, k + ' опис');
    assert.strictEqual(r.icon, kn.icon, k + ' значок');
    [25, 60, 100].forEach(p => assert.deepStrictEqual(S.skillValues('ranger.' + k, p), S.skillValues('knight.' + k, p), k + ' числа на ' + p + '%'));
    assert.strictEqual(S.effectText('ranger.' + k, 0.7), S.effectText('knight.' + k, 0.7));
  });
});

test('Спільні вміння в бою: Кинджал і Спис Слідопита дають те саме, що в Лицаря (+ перевага класу окремо)', () => {
  const r = battle({ 'ranger.spear': 1 }, [], [wear(SPEAR, 'weaponR')]), k = asKnight({ 'knight.spear': 1 }, [wear(SPEAR, 'weaponR')]);
  assert.strictEqual(r.me.p.dmgPct, k.me.p.dmgPct, 'Спис: урон однаковий');
  const rd = battle({ 'ranger.dagger': 1 }, [], [wear(DAGGER, 'weaponR')]), kd = asKnight({ 'knight.dagger': 1 }, [wear(DAGGER, 'weaponR')]);
  assert.strictEqual(rd.me.p.dmgPct, kd.me.p.dmgPct);
  assert.strictEqual(rd.me.p.critPct - kd.me.p.critPct, 5, 'Кинджал: +5% криту — перевага Слідопита «Майстер кинджала»');
});

test('Спільні вміння ростуть у вміння Героя (ranger.*), а не в Лицаря', () => {
  const st = battle({ 'ranger.dagger': 0.5 }, [], [wear(DAGGER, 'weaponR')]);
  st.me.p.accuracy = 5000; st.op.p.agility = 1;
  for (let k = 0; k < 3; k++) SB.turn(ctx, st, HIT, {}, Date.now());
  assert.ok((st.me.grow['ranger.dagger'] || 0) > 0, 'ріст Кинджала Слідопита');
  assert.ok(!st.me.grow['knight.dagger'], 'не в Лицаря');
});

test('Обеззброєння Слідопита = Лицаря: вибиває зброю; перезарядка під власною кнопкою', () => {
  let ok = 0;
  for (let k = 0; k < 30; k++) {
    const st = battle({ 'ranger.disarm': 1 }, ['ranger.disarm'], [wear(SWORD, 'weaponR')]);
    st.op.p.wMin = 3; st.op.p.wMax = 6;
    assert.strictEqual(SB.skillBlock(st, 'ranger.disarm'), '');
    assert.ok(SB.useSkill(ctx, st, 'ranger.disarm'));
    const e = SB.turn(ctx, st, HIT, {}, Date.now());
    assert.strictEqual(e.skill.id, 'knight.disarm');
    if (e.skill.kind === 'disarm') { ok++; assert.ok(e.opDisarmed); }
    assert.strictEqual(SB.skillBlock(st, 'ranger.disarm'), 'cd', 'перезарядка видна й для кнопки Слідопита');
    assert.ok((st.me.grow['ranger.disarm'] || 0) + (st.me.growF['ranger.disarm'] || 0) === 1, 'ріст — у ranger.disarm');
  }
  assert.ok(ok > 0);
});

test('Перевага «Хльосткий кнут»: з кнутом щит ворога блокує рідше (без вміння Кнут)', () => {
  let a = 0, b = 0;
  for (let k = 0; k < 150; k++) {
    const s1 = asKnight({}, [wear(WHIP, 'weaponR')], [wear(SHIELD, 'weaponL')]), s2 = battle({}, [], [wear(WHIP, 'weaponR')], [wear(SHIELD, 'weaponL')]);
    [s1, s2].forEach(s => { s.me.p.accuracy = 5000; });
    a += SB.turn(ctx, s1, HIT, {}, Date.now()).meHit.hits.filter(h => h.byChance).length;
    b += SB.turn(ctx, s2, HIT, {}, Date.now()).meHit.hits.filter(h => h.byChance).length;
  }
  assert.ok(b < a, 'Слідопит із кнутом: блоків менше: ' + b + ' < ' + a);
});

test('Перевага «Легка хода»: без щита спритність +5%, зі щитом — ні', () => {
  const a = asKnight({}), b = battle({}, []);
  assert.strictEqual(b.me.p.agility, Math.round(a.me.p.agility * 1.05));
  const c = battle({}, [], [wear(SHIELD, 'weaponL')]), d = asKnight({}, [wear(SHIELD, 'weaponL')]);
  assert.strictEqual(c.me.p.agility, d.me.p.agility);
});

test('Майстер зброї (унікальне): урон будь-якою зброєю; без зброї — ні', () => {
  const e = battle({}, [], [wear(SWORD, 'weaponR')]), f = battle({ 'ranger.wmaster': 1 }, [], [wear(SWORD, 'weaponR')]);
  assert.strictEqual(f.me.p.dmgPct - e.me.p.dmgPct, 15);
  assert.strictEqual(battle({ 'ranger.wmaster': 1 }, []).me.p.dmgPct, battle({}, []).me.p.dmgPct);
});

test('Переваги класів: дані для книги й адмінки', () => {
  assert.ok(R.CLASS_PERKS.knight.length && R.CLASS_PERKS.ranger.length);
  R.CLASS_PERKS.ranger.forEach(q => assert.ok(q.id && q.icon && q.name && q.text, q.id));
  assert.strictEqual(R.perk('ranger', 'daggerCrit'), 5);
  assert.strictEqual(R.perk('knight', 'daggerCrit'), 0);
});

test('Сховатись: раз за бій; удари ворога часто пролітають повз 🫥, твої ×1.3', () => {
  let miss = 0, landed = 0;
  for (let k = 0; k < 40; k++) {
    const st = battle({ 'ranger.hide': 1 }, ['ranger.hide']);
    st.op.p.accuracy = 5000; st.me.p.agility = 1;
    SB.useSkill(ctx, st, 'ranger.hide');
    const e = SB.turn(ctx, st, HIT, {}, Date.now());
    assert.strictEqual(e.skill.kind, 'hide');
    e.meHit.hits.filter(h => h.kind === 'hit' || h.kind === 'crit').forEach(h => assert.strictEqual(h.mul, 1.3));
    miss += e.opHit.hits.filter(h => h.hideMiss).length; landed += e.opHit.hits.filter(h => h.kind === 'hit' || h.kind === 'crit').length;
    assert.strictEqual(SB.skillBlock(st, 'ranger.hide'), 'used', 'раз за бій');
    const e2 = SB.turn(ctx, st, HIT, {}, Date.now());
    assert.ok(!e2.opHit.hits.some(h => h.hideMiss), 'наступного ходу вже не діє');
  }
  assert.ok(miss > landed, 'на 100% — ~70% ударів повз: ' + miss + ' / ' + landed);
});

test('Перевага «Швидкий спис»: добиваєш — з шансом 10% встигаєш першим, удару ворога немає', () => {
  let ok = 0, tries = 0;
  for (let k = 0; k < 200; k++) {
    const st = battle({}, [], [wear(SPEAR, 'weaponR')]);
    st.me.p.accuracy = 5000; st.op.p.agility = 1; st.op.force = 1;
    const e = SB.turn(ctx, st, HIT, {}, Date.now());
    if (!e.spearFirst) continue;
    tries++;
    if (e.spearFirst.ok) { ok++; assert.strictEqual(e.opHit.kind, 'slow'); assert.strictEqual(e.opHit.dmg, 0); }
  }
  assert.ok(tries > 80 && ok > 3 && ok < 45, 'шанс 10%: ' + ok + ' з ' + tries);
});


test('Ухилення, Торгівля й Зілля — загальні вміння: окремих у Слідопита немає', () => {
  ['dodge', 'trade', 'potions'].forEach(k => {
    assert.strictEqual(S.byId('ranger.' + k), null, 'ranger.' + k);
    assert.ok(S.byId('base.' + k), 'base.' + k);
  });
});

test('Перевага «Спритний ухил»: Ухилення Слідопита спрацьовує з 20%, а не 15%', () => {
  assert.strictEqual(R.perk('ranger', 'dodgeUp'), 5);
  const need = (st) => {
    st.op.p.accuracy = 5000; st.me.p.agility = 1;
    const e = SB.turn(ctx, st, HIT, {}, Date.now());
    const h = e.opHit.hits.find(x => x.skillDodge);
    return h ? Number(/≤ (\d+)%$/.exec(h.dodgeCalc)[1]) : null;
  };
  let r = null, k = null;
  for (let i = 0; i < 300 && (r == null || k == null); i++) {
    if (r == null) r = need(battle({ 'base.dodge': 1 }, []));
    if (k == null) k = need(asKnight({ 'base.dodge': 1 }));
  }
  assert.strictEqual(k, 15, 'Лицар');
  assert.strictEqual(r, 20, 'Слідопит');
});

test('Переваги «поки не діє» (soon): записані, але без числа — бій їх не бачить', () => {
  const soon = R.CLASS_PERKS.knight.filter(q => q.soon);
  assert.strictEqual(soon.length, 4);
  soon.forEach(q => { assert.strictEqual(q.v, undefined, q.id); assert.strictEqual(R.perk('knight', q.id), 0); });
});

/* ── етап 2: рівні 5–11 ── */
const RG2 = ['ranger.lunge', 'ranger.calm', 'ranger.second', 'ranger.camo', 'ranger.poison', 'ranger.bandage', 'ranger.lash'];
test('Слідопит етап 2: Випад, Незворушність, Друга атака, Камуфляж, Отрута, Перев\'язка, Захльост — готові', () => {
  const ready = S.readyFor('ranger').map(s => s.id);
  RG2.forEach(id => { const s = S.byId(id); assert.ok(s && s.ready && s.icon && S.effectText(id, 0.5), id); assert.ok(ready.includes(id), id); });
  assert.strictEqual(S.byId('ranger.lash').lv, 11);
});

test('Спільні етапу 2: Випад, Незворушність, Друга атака, Захльост — числа й назви як у Лицаря', () => {
  ['lunge', 'calm', 'second', 'lash'].forEach(k => {
    assert.strictEqual(S.byId('ranger.' + k).name, S.byId('knight.' + k).name);
    assert.strictEqual(S.byId('ranger.' + k).formula, S.byId('knight.' + k).formula);
    [25, 100].forEach(p => assert.deepStrictEqual(S.skillValues('ranger.' + k, p), S.skillValues('knight.' + k, p)));
  });
});

test('Захльост Слідопита з кнутом: працює як у Лицаря, ріст — у вміння Слідопита; без кнута — чекає', () => {
  let tangled = 0;
  for (let k = 0; k < 30 && !tangled; k++) {
    const st = battle({ 'ranger.lash': 1 }, ['ranger.lash'], [wear(WHIP, 'weaponR')]);
    st.me.p.accuracy = 5000; st.op.p.agility = 1;
    assert.ok(SB.useSkill(ctx, st, 'ranger.lash'));
    const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
    assert.strictEqual(e.skill.id, 'knight.lash');
    assert.ok((st.me.grow || {})['ranger.lash'] || (st.me.growF || {})['ranger.lash'], 'ріст іде у вміння Слідопита');
    if (e.skill.tangle) tangled++;
  }
  assert.ok(tangled, 'сплутує');
  assert.strictEqual(SB.skillBlock(battle({ 'ranger.lash': 1 }, ['ranger.lash'], [wear(SWORD, 'weaponR')]), 'ranger.lash'), 'weapon');
});

test('Перевага «Точний випад»: Випадом Слідопита шанс криту +15%', () => {
  const st = battle({ 'ranger.lunge': 1 }, ['ranger.lunge'], [wear(DAGGER, 'weaponR')]);
  SB.useSkill(ctx, st, 'ranger.lunge');
  const e = SB.turn(ctx, st, HIT, {}, Date.now());
  assert.strictEqual(e.skill.kind, 'lunge');
  assert.strictEqual(e.skill.critPlus, 15);
});

test('Незворушність Слідопита: від удару концентрація з шансом не скидається', () => {
  let kept = 0, lost = 0;
  for (let k = 0; k < 60; k++) {
    const st = battle({ 'base.focus': 1, 'ranger.calm': 1 }, []);
    st.me.fx.focus = 3; st.op.p.accuracy = 5000; st.me.p.agility = 1;
    const e = SB.turn(ctx, st, HIT, {}, Date.now());
    if (!(e.opHit.dmg > 0) || !e.calm) continue;
    assert.strictEqual(e.calm[3], 'reset');
    if (e.calm[2]) { kept++; assert.ok(st.me.fx.focus >= 3); } else { lost++; assert.strictEqual(st.me.fx.focus, 0); }
  }
  assert.ok(kept > 5 && lost > 5, kept + ' / ' + lost);
  const st = battle({ 'base.focus': 1 }, []); st.me.fx.focus = 3; st.op.p.accuracy = 5000; st.me.p.agility = 1;
  const e = SB.turn(ctx, st, HIT, {}, Date.now());
  if (e.opHit.dmg > 0) assert.strictEqual(st.me.fx.focus, 0, 'без Незворушності — скидається вся');
});


/* ── крок 3: перемикачі, Камуфляж, Засідка, отрута, Перев'язка, Пісок в очі, Лук, Влучний постріл ── */
const BOW = item({ id: 'B1', name: 'Лук', category: 'Зброя', stat: 'Урон', valueMin: 4, valueMax: 6, weaponType: 'bow' });
const turnOf = (st, ch) => SB.turn(ctx, st, ch || HIT, {}, Date.now());

test('Крок 3: нові вміння готові, перестановки на місці', () => {
  ['ranger.bow', 'ranger.sand', 'ranger.ambush', 'ranger.fire2', 'ranger.aimed'].forEach(id => assert.ok(S.byId(id).ready, id));
  assert.strictEqual(S.byId('ranger.sand').lv, 4);
  assert.strictEqual(S.byId('ranger.disarm').lv, 17);
  assert.strictEqual(S.byId('ranger.dual').lv, 13);
  assert.strictEqual(S.byId('ranger.ult').name, 'Спустити звіра');
});

test('Камуфляж — перемикач: дії ходу не забирає, −7 мани щоходу, урон ×1.3; без мани вимикається', () => {
  const st = battle({ 'ranger.camo': 1, 'ranger.hide': 1 }, ['ranger.camo', 'ranger.hide']);
  assert.ok(SB.useSkill(ctx, st, 'ranger.camo'));
  assert.strictEqual(JSON.stringify(st.me.tog), JSON.stringify(['ranger.camo']));
  assert.strictEqual(st.me.skill || null, null, 'дію ходу не займає');
  assert.ok(SB.useSkill(ctx, st, 'ranger.hide'), 'разом з активним вмінням');
  const m0 = st.me.mana, e = turnOf(st);
  assert.strictEqual(m0 - st.me.mana, 7);
  assert.strictEqual(JSON.stringify(e.tog), JSON.stringify([{ id: 'ranger.camo', cost: 7 }]));
  e.meHit.hits.filter(h => h.kind === 'hit' || h.kind === 'crit').forEach(h => assert.strictEqual(h.mul, Math.round(1.3 * 1.3 * 100) / 100, 'Сховатись × Камуфляж'));
  st.me.mana = 3;
  const e2 = turnOf(st);
  assert.ok(e2.tog[0].off, 'не вистачило мани — вимкнувся');
  assert.strictEqual(JSON.stringify(st.me.tog), JSON.stringify([]));
  assert.ok(!SB.useSkill(ctx, st, 'ranger.camo'), 'без мани — не вмикається'); st.me.mana = 100;
  assert.ok(SB.useSkill(ctx, st, 'ranger.camo')); assert.ok(SB.useSkill(ctx, st, 'ranger.camo')); assert.strictEqual(JSON.stringify(st.me.tog), JSON.stringify([]), 'ще раз — вимкнути');
});

test('Камуфляж: Ухилення +10% (лише якщо вивчене)', () => {
  let need = null;
  for (let k = 0; k < 300 && need == null; k++) {
    const st = battle({ 'ranger.camo': 1, 'base.dodge': 1 }, ['ranger.camo']);
    SB.useSkill(ctx, st, 'ranger.camo'); st.op.p.accuracy = 5000; st.me.p.agility = 1;
    const h = turnOf(st).opHit.hits.find(x => x.skillDodge);
    if (h) need = Number(/≤ (\d+)%$/.exec(h.dodgeCalc)[1]);
  }
  assert.strictEqual(need, 30, '15 + 5 (Спритний ухил) + 10 (Камуфляж)');
});

test('Другий запал: без нього — один перемикач', () => {
  const st = battle({ 'ranger.camo': 1 }, ['ranger.camo']);
  st.me.tog = ['x.other'];
  assert.strictEqual(SB.useSkill(ctx, st, 'ranger.camo'), false);
  const s2 = battle({ 'ranger.camo': 1, 'ranger.fire2': 1 }, ['ranger.camo']);
  s2.me.tog = ['x.other'];
  assert.ok(SB.useSkill(ctx, s2, 'ranger.camo'));
});

test('Засідка: лише з Камуфляжем; удар ×3 не уникнути; −50 мани; Камуфляж 5 ходів не діє, на 6-й — знову', () => {
  const st = battle({ 'ranger.camo': 1, 'ranger.ambush': 1, 'base.weapons': 1 }, ['ranger.camo', 'ranger.ambush']);
  assert.strictEqual(SB.skillBlock(st, 'ranger.ambush'), 'camo');
  SB.useSkill(ctx, st, 'ranger.camo'); SB.useSkill(ctx, st, 'ranger.ambush');
  st.me.p.accuracy = 1; st.op.p.agility = 5000; st.op.p.blockPhys = 100;
  const m0 = st.me.mana, e = turnOf(st, { atk: 'head', block: 'body' });
  assert.strictEqual(e.skill.kind, 'ambush');
  assert.strictEqual(m0 - st.me.mana, 7 + 50);
  const h0 = e.meHit.hits[0];
  assert.ok(h0.ambush && (h0.kind === 'hit' || h0.kind === 'crit'), 'влучив, хоч точність 1 і блок 100%');
  assert.strictEqual(h0.mul, 3);
  for (let r = 0; r < 5; r++) { assert.strictEqual(SB.useSkill(ctx, st, 'ranger.camo'), false, 'не вимкнути'); const m = st.me.mana, x = turnOf(st); assert.ok(x.tog[0].locked, 'зачаївся'); assert.strictEqual(st.me.mana, m); }
  const m6 = st.me.mana, x6 = turnOf(st);
  assert.strictEqual(x6.tog[0].cost, 7); assert.strictEqual(m6 - st.me.mana, 7);
});

test('Змастити зброю: −50 мани, удари +10% отрутою; отруєння 5%/хід 3 ходи; далі імунітет 100 → 90 → 80…', () => {
  let done = false;
  for (let k = 0; k < 200 && !done; k++) {
    const st = battle({ 'ranger.poison': 1 }, ['ranger.poison'], [wear(DAGGER, 'weaponR')]);
    st.me.p.accuracy = 5000; st.op.p.agility = 1; st.op.p.accuracy = 1; st.op.force = st.op.max = 100000;
    SB.useSkill(ctx, st, 'ranger.poison');
    const m0 = st.me.mana, e = turnOf(st, { atk: 'head', block: 'body' });
    assert.strictEqual(e.skill.kind, 'venom'); assert.strictEqual(m0 - st.me.mana, 50); assert.strictEqual(e.skill.turns, 5);
    const h = e.meHit.hits.find(x => x.venom);
    if (h) assert.ok(h.venom >= 1);
    assert.strictEqual(SB.skillBlock(st, 'ranger.poison'), 'active');
    let p = e.meHit.hits.some(x => x.poisoned) ? e : null;
    for (let r = 0; r < 4 && !p; r++) { const x = turnOf(st); if (x.meHit.hits.some(y => y.poisoned)) p = x; }
    if (!p) continue;
    const r0 = p.r, tick = Math.round(st.op.max * 0.05);
    assert.strictEqual(p.poison, tick);
    const t2 = turnOf(st), t3 = turnOf(st);
    assert.strictEqual(t2.poison, tick); assert.strictEqual(t3.poison, tick);
    assert.strictEqual(st.op.fx.pimm, r0 + 3);
    const res = (round) => SB.poisonRes(st.op, round, 'chance');   // отрута минула: 100%, далі щоходу −10%
    assert.strictEqual(res(r0 + 3), 100); assert.strictEqual(res(r0 + 4), 90); assert.strictEqual(res(r0 + 5), 80); assert.strictEqual(res(r0 + 13), 0);
    done = true;
  }
  assert.ok(done, 'хоч раз отруїв');
});

test('Антидот з пояса: знімає отруту й дає імунітет', () => {
  const st = battle({}, []);
  st.me.fx = st.me.fx || { buffs: {}, barrier: 0, fear: 0 };
  st.me.fx.poison = { from: 1, until: 3, tick: 5 };
  const ANT = item({ id: 'AN', name: 'Антидот', category: 'Зілля', stat: 'Антидот', valueMin: 1, valueMax: 1 });
  st.me.belt = [{ uid: 'a1', id: 'AN', bonus: 1, idx: 0, base: ANT, used: false }];
  st.me.use = 'a1'; st.me.useRound = st.round;
  const e = turnOf(st);
  const fx = (e.uses || [])[0] && e.uses[0].fx.find(x => x.type === 'antidote');
  assert.ok(fx && fx.cured, 'антидот спрацював');
  assert.ok(!st.me.fx.poison); assert.strictEqual(st.me.fx.pimm, 1); assert.strictEqual(st.me.fx.pimmHold, 2);
  const res = (r) => SB.poisonRes(st.me, r, 'chance');          // антидот: 2 ходи 100%, далі −10%
  assert.strictEqual(res(1), 100); assert.strictEqual(res(2), 100); assert.strictEqual(res(3), 90); assert.strictEqual(res(4), 80);
});

test('Перев\'язка: −15 мани, лікує 10%; на 100% знімає отруту (і з повним здоров\'ям), +50% опору', () => {
  const st = battle({ 'ranger.bandage': 1 }, ['ranger.bandage']);
  assert.strictEqual(SB.skillBlock(st, 'ranger.bandage'), 'full');
  st.me.fx = st.me.fx || { buffs: {}, barrier: 0, fear: 0 }; st.me.fx.poison = { from: 1, until: 3, tick: 5 };
  assert.strictEqual(SB.skillBlock(st, 'ranger.bandage'), '', 'отруєний — можна й з повним здоров\'ям');
  st.me.force = 100; st.op.p.accuracy = 1;
  SB.useSkill(ctx, st, 'ranger.bandage');
  const m0 = st.me.mana, e = turnOf(st);
  assert.strictEqual(e.skill.kind, 'bandage'); assert.ok(e.skill.cleansed); assert.strictEqual(m0 - st.me.mana, 15);
  assert.strictEqual(e.skill.heal, Math.round(st.me.max * 0.1));
  assert.strictEqual(SB.skillBlock(st, 'ranger.bandage'), 'cd');
  assert.strictEqual(st.me.fx.bres.pct, 50);
});

test('Пісок в очі: ворог сліпий — точність і спритність падають; потім імунітет', () => {
  const st = battle({ 'ranger.sand': 1 }, ['ranger.sand']);
  const acc0 = st.op.p.accuracy;
  SB.useSkill(ctx, st, 'ranger.sand');
  const m0 = st.me.mana, e = turnOf(st);
  assert.strictEqual(e.skill.kind, 'blind'); assert.strictEqual(m0 - st.me.mana, 20); assert.strictEqual(e.skill.turns, 3);
  assert.strictEqual(e.skill.acc, 40);
  assert.ok(st.op.fx.blind || e.r < 3);
  assert.strictEqual(SB.skillBlock(st, 'ranger.sand'), 'cd');
  assert.ok(acc0 > 0);
});

test('Лук: вміння зброї — точність і урон з луком', () => {
  const a = battle({}, [], [wear(BOW, 'weaponR')]), b = battle({ 'ranger.bow': 1 }, [], [wear(BOW, 'weaponR')]);
  assert.strictEqual(b.me.p.accuracy, Math.round(a.me.p.accuracy * 1.2));
  assert.strictEqual(b.me.p.dmgPct - a.me.p.dmgPct, 10);
});

test('Влучний постріл: лише з луком; постріл ×1.5, −30 мани; стріла застрягає — ворог б\'є слабше', () => {
  assert.strictEqual(SB.skillBlock(battle({ 'ranger.aimed': 1 }, ['ranger.aimed'], [wear(DAGGER, 'weaponR')]), 'ranger.aimed'), 'weapon');
  let stuck = 0;
  for (let k = 0; k < 30 && !stuck; k++) {
    const st = battle({ 'ranger.aimed': 1 }, ['ranger.aimed'], [wear(BOW, 'weaponR')]);
    st.me.p.accuracy = 5000; st.op.p.agility = 1;
    SB.useSkill(ctx, st, 'ranger.aimed');
    const m0 = st.me.mana, e = turnOf(st, { atk: 'head', block: 'body' });
    assert.strictEqual(e.skill.id, 'ranger.aimed'); assert.strictEqual(e.skill.mul, 1.5); assert.strictEqual(m0 - st.me.mana, 30);
    if (e.skill.arrow) { stuck++; assert.strictEqual(st.op.fx.arrow.weak, 25); assert.strictEqual(st.op.fx.arrow.from, e.r + 1); }
  }
  assert.ok(stuck);
});

test('Влучний постріл: не вдалося — без перезарядки й без мани; вдалий — перезарядка', () => {
  let fail = 0, ok = 0;
  for (let k = 0; k < 60 && (!fail || !ok); k++) {
    const st = battle({ 'ranger.aimed': 0 }, ['ranger.aimed'], [wear(BOW, 'weaponR')]);
    SB.useSkill(ctx, st, 'ranger.aimed');
    const m0 = st.me.mana, e = turnOf(st, { atk: 'head', block: 'body' });
    if (e.skill.kind === 'fail') { fail++; assert.ok(!(st.me.cd && st.me.cd['ranger.aimed'] > st.round), 'не вдалося — без перезарядки'); assert.strictEqual(m0 - st.me.mana, 0); }
    else { ok++; assert.ok(st.me.cd['ranger.aimed'] > st.round, 'вдалий — перезарядка'); }
  }
  assert.ok(fail && ok);
});

test('Перемикачі живуть лише в бою: новий бій — усе вимкнене; кінець бою вимикає', () => {
  const st = battle({ 'ranger.camo': 1 }, ['ranger.camo']);
  SB.useSkill(ctx, st, 'ranger.camo');
  assert.strictEqual(JSON.stringify(st.me.tog), JSON.stringify(['ranger.camo']));
  st.op.force = 1; st.me.p.accuracy = 5000; st.op.p.agility = 1;
  for (let k = 0; k < 10 && st.status === 'live'; k++) turnOf(st, { atk: 'head', block: 'body' });
  assert.notStrictEqual(st.status, 'live');
  assert.strictEqual(JSON.stringify(st.me.tog), '[]', 'бій скінчився — вимкнено');
  assert.strictEqual(SB.useSkill(ctx, st, 'ranger.camo'), false, 'поза боєм не вмикається');
  const st2 = battle({ 'ranger.camo': 1 }, ['ranger.camo']);
  assert.ok(!(st2.me.tog && st2.me.tog.length), 'новий бій — вимкнено');
});

test('Змащена зброя: отрута — на клинку; вибили зброю — отрута зникла (і після повернення зброя чиста)', () => {
  const st = battle({ 'ranger.poison': 1 }, ['ranger.poison'], [wear(DAGGER, 'weaponR')]);
  st.me.p.accuracy = 5000; st.op.p.agility = 1; st.op.p.accuracy = 1; st.op.force = st.op.max = 100000;
  SB.useSkill(ctx, st, 'ranger.poison');
  assert.strictEqual(turnOf(st, { atk: 'head', block: 'body' }).skill.kind, 'venom');
  assert.ok(st.me.fx.venom.uid, 'отрута знає свій клинок');
  st.me.fx.disarm = st.round + 1; delete st.me.fx.venom;          // так робить Обеззброєння (disarmTry)
  for (let k = 0; k < 4; k++) { const e = turnOf(st, { atk: k % 2 ? 'legs' : 'head', block: 'body' }); assert.ok(!e.meHit.hits.some(h => h.venom || h.poisonTry), 'хід ' + e.r); }
});

test('Змащена зброя: зняв / замінив клинок — отрута зникла, повернув той самий — чистий', () => {
  const D2 = W('D2', 'dagger');
  const st = battle({ 'ranger.poison': 1 }, ['ranger.poison'], [wear(DAGGER, 'weaponR')]);
  st.me.p.accuracy = 5000; st.op.p.agility = 1; st.op.p.accuracy = 1; st.op.force = st.op.max = 100000;
  SB.useSkill(ctx, st, 'ranger.poison');
  turnOf(st, { atk: 'head', block: 'body' });
  assert.ok(st.me.fx.venom);
  const was = st.me.eq.filter(e => e.slot === 'weaponR' && !e.off)[0];
  assert.ok(SB.swap(ctx, st, 'weaponR', { uid: 'D2x', id: 'D2', bonus: 1, durMax: 500, durCur: 500 }, D2), 'замінив');
  assert.ok(!st.me.fx.venom, 'змащений клинок зняли — отрута зникла');
  turnOf(st, { atk: 'head', block: 'body' });
  assert.ok(SB.swap(ctx, st, 'weaponR', was.inst, DAGGER), 'повернув той самий');
  for (let k = 0; k < 2; k++) { const e = turnOf(st, { atk: k ? 'legs' : 'head', block: 'body' }); assert.ok(!e.meHit.hits.some(h => h.venom)); }
});

test('Опір отруті з речей: свій опір — нижня межа спаду; урон отрутою й тіки — лише свій + Перев\'язка', () => {
  const AM = item({ id: 'AM1', name: 'Амулет', category: 'Амулет', stat: 'Броня', valueMin: 1, valueMax: 1, addStats: [{ stat: 'Опір отруті', value: 30 }] });
  const st = battle({}, [], [wear(AM, 'amulet')]);
  assert.strictEqual(st.me.p.resPoison, 30, 'опір з речі');
  assert.strictEqual(SB.poisonRes(st.me, 1, 'dmg'), 30); assert.strictEqual(SB.poisonRes(st.me, 1, 'chance'), 30);
  st.me.fx.pimm = 5; st.me.fx.pimmHold = 0;                      // отрута минула на 4-му ходу
  assert.strictEqual(SB.poisonRes(st.me, 5, 'chance'), 100);
  assert.strictEqual(SB.poisonRes(st.me, 10, 'chance'), 50);
  assert.strictEqual(SB.poisonRes(st.me, 20, 'chance'), 30, 'не нижче свого');
  assert.strictEqual(SB.poisonRes(st.me, 6, 'dmg'), 30, 'урон отрутою — лише свій');
  st.me.fx.bres = { until: 99, pct: 50 };
  assert.strictEqual(SB.poisonRes(st.me, 20, 'dmg'), 80, 'свій + Перев\'язка');
  assert.strictEqual(SB.poisonRes(st.me, 20, 'chance'), 80);
  assert.strictEqual(S.byId('ranger.poison') && K.isPctStat('Опір отруті'), true, 'завжди у відсотках');
  assert.ok(K.dmgType('poison'), 'тип урону «Отрута»');
});

test('Поки отруєний — удруге не отруїти', () => {
  const st = battle({ 'ranger.poison': 1 }, ['ranger.poison'], [wear(DAGGER, 'weaponR')]);
  st.me.p.accuracy = 5000; st.op.p.agility = 1; st.op.p.accuracy = 1; st.op.force = st.op.max = 100000;
  SB.useSkill(ctx, st, 'ranger.poison'); turnOf(st, { atk: 'head', block: 'body' });
  st.op.fx.poison = { from: st.round, until: st.round + 2, tick: 5 };
  st.me.fx.venom.ch = 100;                                        // навіть зі 100% шансом
  const e = turnOf(st, { atk: 'legs', block: 'body' });
  assert.ok(!e.meHit.hits.some(h => h.poisonTry || h.poisoned));
});

test('Цілитель: Стійкість до отрут — до свого опору +10% → +40% (з речами — не більше 100%)', () => {
  const sk = S.byId('healer.poisonres');
  assert.ok(sk && sk.ready && sk.lv === 5);
  assert.strictEqual(S.skillValues('healer.poisonres', 25).resPct, 10); assert.strictEqual(S.skillValues('healer.poisonres', 100).resPct, 40);
  const mk = (skm, eq) => SB.create(ctx, { bid: 'hl-' + (n++), me: { name: 'Ц', stats: { health: 400, accuracy: 60, agility: 50, mana: 500 }, eq: eq || [], sk: skm, skv: skvOf(skm), bar: [], cls: 'healer' },
    op: { f: { name: 'Бот', level: 3 }, p: R.fighter({ health: 400, accuracy: 50, agility: 50, mana: 0 }, [], K) } });
  assert.strictEqual(mk({ 'healer.poisonres': 1 }).me.p.resPoison, 40);
  const AM = item({ id: 'AM2', name: 'Амулет', category: 'Амулет', stat: 'Броня', valueMin: 1, valueMax: 1, addStats: [{ stat: 'Опір отруті', value: 70 }] });
  assert.strictEqual(mk({ 'healer.poisonres': 1 }, [wear(AM, 'amulet')]).me.p.resPoison, 100, 'не більше 100%');
  const st = mk({ 'healer.poisonres': 1 });
  assert.strictEqual(SB.poisonRes(st.me, 1, 'dmg'), 40);
});

test('Мисливський азарт: влучив більше — +1, пропустив більше — −1 (не скидання), без вміння — урон скидає', () => {
  assert.ok(S.byId('ranger.zeal').ready && S.byId('ranger.zeal').lv === 3);
  const mk = (sk) => { const st = battle(Object.assign({ 'base.focus': 1 }, sk), []); st.me.fx.focus = 3; return st; };
  // в тебе влучили, ти — ні: −1 з азартом, скидання без нього
  for (let k = 0; k < 20; k++) {
    const a = mk({ 'ranger.zeal': 1 }); a.op.p.accuracy = 5000; a.me.p.agility = 1; a.me.p.accuracy = 1; a.op.p.agility = 5000;
    const e = turnOf(a, { atk: 'head', block: 'body' });
    const mine = e.meHit.hits.filter(h => (h.kind === 'hit' || h.kind === 'crit') && h.dmg > 0).length, theirs = e.opHit.hits.filter(h => (h.kind === 'hit' || h.kind === 'crit') && h.dmg > 0).length;
    if (theirs > mine) { assert.strictEqual(a.me.fx.focus, 2, 'азарт: −1'); break; }
  }
  for (let k = 0; k < 20; k++) {
    const b = mk({}); b.op.p.accuracy = 5000; b.me.p.agility = 1;
    const e = turnOf(b, { atk: 'head', block: 'body' });
    if (e.opHit.dmg > 0) { assert.strictEqual(b.me.fx.focus, 0, 'без азарту — скидання'); break; }
  }
  // ти влучив, в тебе — ні: +1
  for (let k = 0; k < 20; k++) {
    const c = mk({ 'ranger.zeal': 1 }); c.me.p.accuracy = 5000; c.op.p.agility = 1; c.op.p.accuracy = 1; c.me.p.agility = 5000;
    const e = turnOf(c, { atk: 'head', block: 'body' });
    const theirs = e.opHit.hits.filter(h => (h.kind === 'hit' || h.kind === 'crit') && h.dmg > 0).length, mine = e.meHit.hits.filter(h => (h.kind === 'hit' || h.kind === 'crit') && h.dmg > 0).length;
    if (mine > theirs) { assert.strictEqual(c.me.fx.focus, 4, 'азарт: +1'); break; }
  }
});

test('Опори: тестова річ з усіма опорами 10%…100% — усі у %; з речей разом ≤ 33% (отрута — окремо, до 100%)', () => {
  const names = ['Опір отруті', 'Опір вогню', 'Опір холоду', 'Опір струму', 'Опір світлу', 'Опір темряві', 'Опір колючому', 'Опір рублячому', 'Опір тупому', 'Опір магії'];
  const keys = ['resPoison', 'resFire', 'resCold', 'resShock', 'resLight', 'resDark', 'resPierce', 'resSlash', 'resBash', 'resMagic'];
  const TEST = item({ id: 'RES-TEST', name: 'Амулет усіх опорів (тест)', category: 'Амулет', stat: 'Броня', valueMin: 1, valueMax: 1,
    addStats: names.map((s, i) => ({ stat: s, value: (i + 1) * 10 })) });
  names.forEach((s, i) => { assert.strictEqual(K.canon(s), keys[i], s); assert.ok(K.isPctStat(s), s + ' — завжди %'); });
  assert.strictEqual(K.canon('Опір стихіям'), 'Опір стихіям', 'загального опору поки немає');
  const st = battle({}, [], [wear(TEST, 'amulet')]);
  keys.forEach((k, i) => assert.strictEqual(st.me.p[k], k === 'resPoison' ? 10 : Math.min(33, (i + 1) * 10), k));
  const R20 = item({ id: 'RES-R', name: 'Кільце', category: 'Кільце', stat: 'Броня', valueMin: 1, valueMax: 1, addStats: [{ stat: 'Опір тупому', value: 20 }] });
  assert.strictEqual(battle({}, [], [wear(R20, 'ring1'), wear(Object.assign({}, R20, { id: 'RES-R2' }), 'ring2')]).me.p.resBash, 33, 'дві речі по 20% — разом лише 33%');
});

test('Опір типу урону — кінцеве зменшення: кулаки (тупий) по захиснику з Опором тупому 30%', () => {
  const R30 = item({ id: 'RB30', name: 'Кільце', category: 'Кільце', stat: 'Броня', valueMin: 0, valueMax: 0, addStats: [{ stat: 'Опір тупому', value: 30 }] });
  const st = battle({}, []);
  st.op.p = R.fighter({ health: 400, accuracy: 50, agility: 50, mana: 0 }, [wear(R30, 'ring1')], K);
  assert.strictEqual(st.op.p.resBash, 30);
  assert.strictEqual(st.me.p.dmgType, 'bash', 'без зброї — тупий');
  st.me.p.accuracy = 5000; st.op.p.agility = 1;
  let seen = 0;
  for (let k = 0; k < 10 && !seen; k++) { const e = turnOf(st, { atk: k % 2 ? 'legs' : 'head', block: 'body' });
    e.meHit.hits.filter(h => h.kind === 'hit' || h.kind === 'crit').forEach(h => { assert.strictEqual(h.res, 30); assert.ok(/опір/.test(h.calc)); seen++; }); }
  assert.ok(seen);
  const sw = battle({}, [], [wear(SWORD, 'weaponR')]); assert.strictEqual(sw.me.p.dmgType, 'slash', 'меч — рублячий');
  const dg = battle({}, [], [wear(DAGGER, 'weaponR')]); assert.strictEqual(dg.me.p.dmgType, 'pierce', 'кинджал — колючий');
  assert.strictEqual(R.resCut(100, 'slash', { resSlash: 50 }).dmg, 67, 'стеля 33% навіть якщо в профілі більше');
});

test('Слідопит: спільні з Лицарем — Збити з пантелику, Друга зброя, Посилений урон, Третя атака', () => {
  ['ranger.daze', 'ranger.dual', 'ranger.enh', 'ranger.third'].forEach(id => { const s = S.byId(id); assert.ok(s.ready, id); assert.ok(s.same, id + ' спільне'); });
  // Посилений урон — у профілі
  assert.ok(battle({ 'ranger.enh': 1 }, [], [wear(DAGGER, 'weaponR')]).me.p.dmgPct > battle({}, [], [wear(DAGGER, 'weaponR')]).me.p.dmgPct);
  // Третя атака — бувають треті удари, ріст іде у вміння Слідопита
  let third = 0; const st3 = battle({ 'ranger.third': 1 }, [], [wear(DAGGER, 'weaponR')]);
  st3.me.p.accuracy = 5000; st3.op.p.agility = 1; st3.op.force = 99999;
  for (let k = 0; k < 40 && st3.status === 'live'; k++) { const e = turnOf(st3, HIT); if (e.meHit.hits.some(h => h.third)) third++; }
  assert.ok(third > 0); assert.ok((st3.me.grow['ranger.third'] || 0) + (st3.me.growF['ranger.third'] || 0) > 0);
  // Збити з пантелику — влучив: концентрація ворога 0
  let dz = 0;
  for (let k = 0; k < 20 && !dz; k++) { const st = battle({ 'ranger.daze': 1 }, ['ranger.daze'], [wear(DAGGER, 'weaponR')]);
    st.me.p.accuracy = 5000; st.op.p.agility = 1; st.op.fx.focus = 3; SB.useSkill(ctx, st, 'ranger.daze');
    const e = turnOf(st, { atk: 'head', block: 'body' }); if (e.skill && e.skill.daze) { dz++; assert.strictEqual(st.op.fx.focus, 0); } }
  assert.ok(dz);
  // Друга зброя — кинджал у ліву, удар лівою
  const B = R.BATTLE, d0 = B.dualWield;
  try {
    R.handsFromHero({ heroClass: 'ranger', skills: {} }); assert.ok(!R.fitsHand(DAGGER, 'weaponL'));
    R.handsFromHero({ heroClass: 'ranger', skills: { 'ranger.dual': 5 } }); assert.ok(R.fitsHand(DAGGER, 'weaponL'), 'Слідопит: кинджал у ліву');
    const DAG2 = Object.assign({}, DAGGER, { id: 'D2' });
    const st = battle({ 'ranger.dual': 1 }, [], [wear(DAGGER, 'weaponR'), wear(DAG2, 'weaponL')]);
    st.me.p.accuracy = 5000; st.op.p.agility = 1;
    const e = turnOf(st, HIT); assert.ok(e.meHit.hits.some(h => h.left), 'удар лівою');
  } finally { B.dualWield = d0; }
});

test('Поспіх: перемикач −30 мани щоходу; щоходу ще один звичайний удар ×0.7 (25%) → ×1 (100%); і в хід із Піском; не запускає Другу атаку', () => {
  assert.strictEqual(S.skillValues('ranger.haste', 25).dmgMul, 70); assert.strictEqual(S.skillValues('ranger.haste', 100).dmgMul, 100);
  const st = battle({ 'ranger.haste': 1, 'ranger.sand': 1 }, ['ranger.haste', 'ranger.sand'], [wear(DAGGER, 'weaponR')]);
  st.me.p.accuracy = 5000; st.op.p.agility = 1; st.op.force = 99999;
  assert.ok(SB.useSkill(ctx, st, 'ranger.haste'));
  SB.useSkill(ctx, st, 'ranger.sand');
  const m0 = st.me.mana, e = turnOf(st, { atk: 'head', block: 'body' });
  const hs = e.meHit.hits.filter(h => h.haste);
  assert.strictEqual(hs.length, 1, 'рівно один удар Поспіху');
  assert.ok(m0 - st.me.mana >= 30, 'мана за хід');
  assert.ok(!hs[0].second && !hs[0].third);
  assert.ok(e.meHit.hits.filter(h => h.second).length <= 1, 'Друга атака — не від Поспіху');
  // 25%: удар ×0.7
  const s25 = battle({ 'ranger.haste': 0.25 }, ['ranger.haste'], [wear(DAGGER, 'weaponR')]);
  s25.me.p.accuracy = 5000; s25.op.p.agility = 1; SB.useSkill(ctx, s25, 'ranger.haste');
  s25.op.force = 99999; let h25 = null;
  for (let k = 0; k < 20 && !h25; k++) { const e25 = turnOf(s25, { atk: ['head', 'legs', 'arms', 'body'][k % 4], block: 'body' }); h25 = e25.meHit.hits.filter(h => h.haste && h.kind === 'hit')[0]; }
  assert.ok(h25 && /× 0\.7/.test(h25.calc), h25 && h25.calc);
  // збитий з ніг — удару немає
  const sk = battle({ 'ranger.haste': 1 }, ['ranger.haste'], [wear(DAGGER, 'weaponR')]); SB.useSkill(ctx, sk, 'ranger.haste');
  sk.me.fx.knock = sk.round;
  const ek = turnOf(sk, { atk: 'head', block: 'body' });
  assert.ok(!(ek.meHit.hits || []).some(h => h.haste), 'збитий з ніг — без Поспіху');
});

test('Поспіх і Камуфляж разом — лише з Другим запалом; другий дорожчий', () => {
  const st = battle({ 'ranger.haste': 1, 'ranger.camo': 1 }, ['ranger.haste', 'ranger.camo']);
  assert.ok(SB.useSkill(ctx, st, 'ranger.camo')); assert.ok(!SB.useSkill(ctx, st, 'ranger.haste'), 'без Другого запалу — один перемикач');
  const s2 = battle({ 'ranger.haste': 1, 'ranger.camo': 1, 'ranger.fire2': 0.25 }, ['ranger.haste', 'ranger.camo']);
  SB.useSkill(ctx, s2, 'ranger.camo'); assert.ok(SB.useSkill(ctx, s2, 'ranger.haste'));
  const m0 = s2.me.mana; turnOf(s2, { atk: 'head', block: 'body' });
  assert.strictEqual(m0 - s2.me.mana, 30 + 14, 'дорожчий (Поспіх 30) — ×1, дешевший (Камуфляж 7) — ×2, хоч Камуфляж увімкнено першим');
  assert.strictEqual(SB.togMul(s2, 'ranger.haste'), 100); assert.strictEqual(SB.togMul(s2, 'ranger.camo'), 200);
});

test('Око мисливця: перемикач −7; точність +10%; удар у закриту зону — шанс 50% пробити блок; осліплена — не діє, мана йде, вимкнути можна', () => {
  assert.deepStrictEqual([S.skillValues('ranger.hunter', 25).gap, S.skillValues('ranger.hunter', 100).gap], [30, 50]);
  assert.deepStrictEqual([S.skillValues('ranger.hunter', 25).accPct, S.skillValues('ranger.hunter', 100).accPct], [5, 10]);
  assert.ok(S.byId('ranger.hunter').ready);
  let gap = 0, shut = 0;
  for (let k = 0; k < 30; k++) {
    const st = battle({ 'ranger.hunter': 1 }, ['ranger.hunter'], [wear(DAGGER, 'weaponR')]);
    st.me.p.accuracy = 5000; st.op.p.agility = 1; st.op.force = 99999;
    assert.ok(SB.useSkill(ctx, st, 'ranger.hunter'));
    const m0 = st.me.mana;
    const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
    assert.strictEqual(m0 - st.me.mana, 7);
    (e.meHit.hits || []).forEach(h => { if (h.gapRoll != null) { if (h.gap) { gap++; assert.notStrictEqual(h.kind, 'block'); } else shut++; } });
  }
  assert.ok(gap > 0 && shut > 0, 'бувають і пробиття, і блоки: ' + gap + '/' + shut);
  // осліплена
  const sb = battle({ 'ranger.hunter': 1 }, ['ranger.hunter'], [wear(DAGGER, 'weaponR')]);
  SB.useSkill(ctx, sb, 'ranger.hunter'); sb.me.fx.blind = { from: sb.round, until: sb.round + 2 };
  assert.strictEqual(SB.skillBlock(sb, 'ranger.hunter'), 'eyeblind');
  const m1 = sb.me.mana, eb = SB.turn(ctx, sb, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.strictEqual(m1 - sb.me.mana, 7, 'мана йде');
  assert.ok(!(eb.meHit.hits || []).some(h => h.gapRoll != null), 'осліплена — Око не діє');
  assert.ok(SB.useSkill(ctx, sb, 'ranger.hunter'), 'вимкнути можна'); assert.ok(!(sb.me.tog || []).includes('ranger.hunter'));
});

test('Пастка: ставиш у зону (−50), стоїть 2→4 ходи; ворог ударив у неї — урон ×0.4 і наступного ходу без ударів, не ухиляється; перезарядка після', () => {
  let sprung = 0, gone = 0;
  for (let k = 0; k < 40 && (!sprung || !gone); k++) {
    const st = battle({ 'ranger.trap': 1 }, ['ranger.trap'], [wear(DAGGER, 'weaponR')]);
    st.op.force = 99999; st.op.p.accuracy = 5000;
    st.me.trapZone = 'legs';
    assert.ok(SB.useSkill(ctx, st, 'ranger.trap'));
    const m0 = st.me.mana;
    let e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
    assert.strictEqual(e.skill.kind, 'trapSet'); assert.strictEqual(e.skill.zone, 'legs'); assert.strictEqual(m0 - st.me.mana, 50);
    assert.strictEqual(SB.skillBlock(st, 'ranger.trap') === 'active' || !!e.trap, true);
    for (let i = 0; i < 5 && !e.trap; i++) e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
    if (e.trap && e.trap.kind === 'trapSprung') {
      sprung++;
      if (e.trap.from) assert.strictEqual(e.trap.to, Math.max(1, Math.round(e.trap.from * 0.4)));
      assert.ok(st.me.cd['ranger.trap'] > st.round, 'перезарядка');
      if (e.trap.trapped) {
        st.me.p.accuracy = 1; st.op.p.agility = 99999;   // і так не промахнешся
        const e2 = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
        assert.strictEqual(e2.opHit.kind, 'trap', 'у пастці — без ударів'); assert.ok(e2.opTrapped);
        e2.meHit.hits.forEach(h => assert.notStrictEqual(h.kind, 'dodge', 'у пастці — не ухиляється'));
      }
    } else if (e.trap && e.trap.kind === 'trapGone') { gone++; assert.ok(st.me.cd['ranger.trap'] > st.round); }
  }
  assert.ok(sprung > 0 && gone > 0, sprung + '/' + gone);
  // зона блоку — не можна: випадкова інша
  const sb = battle({ 'ranger.trap': 1 }, ['ranger.trap'], [wear(DAGGER, 'weaponR')]); sb.me.trapZone = 'body';
  SB.useSkill(ctx, sb, 'ranger.trap'); const eb = SB.turn(ctx, sb, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.notStrictEqual(eb.skill.zone, 'body'); assert.ok(eb.skill.auto);
});

test('Перемикач без мани не вмикається (💧), вимкнути можна завжди; Камуфляж, що зачаївся, — без значка ×', () => {
  const st = battle({ 'ranger.haste': 1, 'ranger.camo': 1, 'ranger.fire2': 0.25 }, ['ranger.haste', 'ranger.camo']);
  st.me.mana = 20;
  assert.strictEqual(SB.skillBlock(st, 'ranger.haste'), 'mana'); assert.ok(!SB.useSkill(ctx, st, 'ranger.haste'));
  assert.ok(SB.useSkill(ctx, st, 'ranger.camo'), 'Камуфляж за 7 — можна');
  st.me.mana = 40;   // Поспіх 30 + Камуфляж 7×2 = 44 > 40
  assert.ok(!SB.useSkill(ctx, st, 'ranger.haste'), 'разом не вистачить');
  st.me.mana = 44; assert.ok(SB.useSkill(ctx, st, 'ranger.haste'));
  st.me.mana = 0; assert.ok(SB.useSkill(ctx, st, 'ranger.haste'), 'вимкнути — завжди');
  st.me.fx.camoLock = st.round + 3; assert.strictEqual(SB.togMul(st, 'ranger.camo'), 0);
});

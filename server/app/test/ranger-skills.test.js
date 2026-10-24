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
  assert.strictEqual(soon.length, 3);
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

test('Камуфляж: перший хід — удари не промахуються й сильніші (×1.6), далі — як завжди', () => {
  const st = battle({ 'ranger.camo': 1 }, []);
  st.me.p.accuracy = 1; st.op.p.agility = 5000;
  const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  e.meHit.hits.forEach(h => { assert.ok(h.camo); assert.notStrictEqual(h.kind, 'dodge'); if (h.kind === 'hit' || h.kind === 'crit') assert.strictEqual(h.mul, 1.6); });
  assert.ok(st.me.grow['ranger.camo'] || st.me.growF['ranger.camo']);
  let miss = 0;
  for (let k = 0; k < 5; k++) { const e2 = SB.turn(ctx, st, HIT, {}, Date.now()); if (!e2) break; e2.meHit.hits.forEach(h => { assert.ok(!h.camo); if (h.kind === 'dodge') miss++; }); }
  assert.ok(miss > 0, 'без камуфляжу з такою точністю промахується');
});

test('Отрута: влучив — ворог 3 ходи втрачає 6% макс. здоров\'я щоходу; перезарядка 4', () => {
  const st = battle({ 'ranger.poison': 1 }, ['ranger.poison']);
  st.me.p.accuracy = 5000; st.op.p.agility = 1; st.op.p.accuracy = 1;
  assert.ok(SB.useSkill(ctx, st, 'ranger.poison'));
  const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  const d = Math.round(st.op.max * 0.06);
  if (e.skill.kind === 'poisonMiss') return;                  // рідко: ворог закрив зону
  assert.strictEqual(e.skill.kind, 'poison');
  assert.strictEqual(e.poison, d);
  assert.strictEqual(SB.skillBlock(st, 'ranger.poison'), 'cd');
  const e2 = SB.turn(ctx, st, HIT, {}, Date.now()), e3 = SB.turn(ctx, st, HIT, {}, Date.now()), e4 = SB.turn(ctx, st, HIT, {}, Date.now());
  assert.strictEqual(e2.poison, d); assert.strictEqual(e3.poison, d); assert.ok(!e4 || !e4.poison, 'на 4-й хід отрута минула');
});

test('Перев\'язка: з повним здоров\'ям чекає; поранений — лікує 20% до ударів', () => {
  const st = battle({ 'ranger.bandage': 1 }, ['ranger.bandage']);
  assert.strictEqual(SB.skillBlock(st, 'ranger.bandage'), 'full');
  assert.ok(SB.useSkill(ctx, st, 'ranger.bandage'), 'вибір лишається — спрацює, щойно поранять');
  st.me.force = 100; st.op.p.accuracy = 1;
  const e = SB.turn(ctx, st, HIT, {}, Date.now());
  assert.strictEqual(e.skill.kind, 'bandage');
  assert.strictEqual(e.skill.heal, Math.round(st.me.max * 0.2));
  assert.strictEqual(SB.skillBlock(st, 'ranger.bandage'), 'cd');
});

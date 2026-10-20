/* 🏹 Слідопит, етап 1: Кинджал, Спис, Кнут, Майстер зброї, Сховатись, Обеззброєння, Голі руки, Хоробрість */
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

test('Кинджал: крит +3…15%; Спис: урон +2…8; Майстер зброї: урон будь-якою зброєю; лише в Слідопита', () => {
  const a = battle({}, [], [wear(DAGGER, 'weaponR')]), b = battle({ 'ranger.dagger': 1 }, [], [wear(DAGGER, 'weaponR')]);
  assert.strictEqual(b.me.p.critPct - a.me.p.critPct, 15);
  const c = battle({}, [], [wear(SPEAR, 'weaponR')]), d = battle({ 'ranger.spear': 0.25 }, [], [wear(SPEAR, 'weaponR')]);
  assert.strictEqual(d.me.p.dmgFlat - (c.me.p.dmgFlat || 0), 2);
  const e = battle({}, [], [wear(SWORD, 'weaponR')]), f = battle({ 'ranger.wmaster': 1 }, [], [wear(SWORD, 'weaponR')]);
  assert.strictEqual(f.me.p.dmgPct - e.me.p.dmgPct, 15);
  const g = battle({ 'ranger.wmaster': 1 }, []);
  assert.strictEqual(g.me.p.dmgPct, battle({}, []).me.p.dmgPct, 'без зброї — не діє');
});

test('Голі руки: без зброї +урон і часом ще удар 👊', () => {
  const st = battle({ 'ranger.fists': 1 }, []);
  assert.strictEqual(st.me.p.dmgFlat, 4);
  let extra = 0;
  for (let k = 0; k < 60; k++) { const s = battle({ 'ranger.fists': 1 }, []); s.me.p.accuracy = 5000; const e = SB.turn(ctx, s, HIT, {}, Date.now()); extra += e.meHit.hits.filter(h => h.fist2).length; }
  assert.ok(extra > 2 && extra < 30, 'ще удар ~20%: ' + extra);
});

test('Кнут: шанс блоку щита ворога проти твоїх ударів менший', () => {
  let a = 0, b = 0;
  for (let k = 0; k < 150; k++) {
    const s1 = battle({}, [], [wear(WHIP, 'weaponR')], [wear(SHIELD, 'weaponL')]), s2 = battle({ 'ranger.whip': 1 }, [], [wear(WHIP, 'weaponR')], [wear(SHIELD, 'weaponL')]);
    [s1, s2].forEach(s => { s.me.p.accuracy = 5000; });
    a += SB.turn(ctx, s1, HIT, {}, Date.now()).meHit.hits.filter(h => h.byChance).length;
    b += SB.turn(ctx, s2, HIT, {}, Date.now()).meHit.hits.filter(h => h.byChance).length;
  }
  assert.ok(b < a, 'з кнутом блоків менше: ' + b + ' < ' + a);
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

test('Обеззброєння Слідопита: зброю не вибиває, урон ворога −40% на 2 ходи, перезарядка 4', () => {
  const st = battle({ 'ranger.disarm': 1 }, ['ranger.disarm']);
  st.op.p.accuracy = 5000; st.me.p.agility = 1;
  SB.useSkill(ctx, st, 'ranger.disarm');
  const e = SB.turn(ctx, st, HIT, {}, Date.now());
  assert.strictEqual(e.skill.kind, 'weak'); assert.strictEqual(e.skill.cut, 40);
  assert.ok(!e.opDisarmed, 'зброю не вибито');
  assert.ok(e.opHit.hits.filter(h => h.dmg > 0).every(h => h.weak && h.weak[1] === 40));
  const e2 = SB.turn(ctx, st, HIT, {}, Date.now());
  assert.ok(e2.opHit.hits.filter(h => h.dmg > 0).every(h => h.weak), 'і наступного ходу');
  assert.strictEqual(SB.skillBlock(st, 'ranger.disarm'), 'cd');
  const e3 = SB.turn(ctx, st, HIT, {}, Date.now());
  assert.ok(!e3.opHit.hits.some(h => h.weak), 'на третій хід — уже ні');
});

test('Спис: добиваєш — з шансом встигаєш першим, удару ворога немає', () => {
  let ok = 0, tries = 0;
  for (let k = 0; k < 200; k++) {
    const st = battle({ 'ranger.spear': 1 }, [], [wear(SPEAR, 'weaponR')]);
    st.me.p.accuracy = 5000; st.op.p.agility = 1; st.op.force = 1;
    const e = SB.turn(ctx, st, HIT, {}, Date.now());
    if (!e.spearFirst) continue;
    tries++;
    if (e.spearFirst.ok) { ok++; assert.strictEqual(e.opHit.kind, 'slow'); assert.strictEqual(e.opHit.dmg, 0); }
  }
  assert.ok(tries > 80 && ok > 3 && ok < 45, 'шанс 10%: ' + ok + ' з ' + tries);
});

test('Хоробрість Слідопита: росте від свитка страху й зменшує шанс страху', () => {
  const v = S.skillValues('ranger.brave', 100);
  assert.strictEqual(v.resPct, 60);
});

test('Слідопит не чіпає Лицаря: у Лицаря без зброї — Голі руки Лицаря', () => {
  const st = SB.create(ctx, { bid: 'kx', me: { name: 'Я', stats: { health: 400, accuracy: 60, agility: 50, mana: 0 }, eq: [], sk: { 'ranger.fists': 1 }, skv: skvOf({ 'ranger.fists': 1 }), bar: [], cls: 'knight' },
    op: { f: { name: 'Бот', level: 3 }, p: R.fighter({ health: 400, accuracy: 50, agility: 50 }, [], K) } });
  assert.ok(!st.me.p.dmgFlat, 'Лицар із чужим вмінням — без ефекту');
});

// Вміння Лицаря (1 рівень класу): правила, профіль, удари, ріст, вивчення.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path'), fs = require('fs'), vm = require('vm');
const ROOT = path.join(__dirname, '../../..');
const box = { window: {}, console };
box.window.window = box.window;
['sk-items.js', 'sk-arena-rules.js', 'sk-skills.js', 'sk-battle.js'].forEach(f => vm.runInNewContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), box.window, { filename: f }));
const R = box.window.SKARENA, K = box.window.SKIT, SB = box.window.SKBATTLE, S = box.window.SKSKILLS;
const ctx = { R, K };
const item = (o) => Object.assign({ addStats: [] }, o);
const SHIELD = item({ id: 'S1', name: 'Щит', category: 'Щити', stat: 'Броня', valueMin: 2, valueMax: 2 });
const SWORD = item({ id: 'W1', name: 'Меч', category: 'Зброя', stat: 'Урон', valueMin: 4, valueMax: 6, weaponType: 'sword' });
const AXE = item({ id: 'W2', name: 'Сокира', category: 'Зброя', stat: 'Урон', valueMin: 4, valueMax: 6, weaponType: 'axe' });
const SPEAR = item({ id: 'W3', name: 'Спис', category: 'Зброя', stat: 'Урон', valueMin: 4, valueMax: 6, weaponType: 'spear' });
const ARMOR = item({ id: 'A1', name: 'Броня', category: 'Обладунки', stat: 'Броня', valueMin: 40, valueMax: 40 });
const wear = (base, slot, uid) => ({ base, inst: { uid: uid || base.id + slot, id: base.id, slot, bonus: 1 } });

function skvOf(sk) { const o = {}; Object.keys(sk || {}).forEach(id => { o[id] = S.skillValues(id, Math.round(sk[id] * 100)); }); return o; }
let n = 0;
function battle(sk, bar, eq, opEq) {
  return SB.create(ctx, {
    bid: 'kn-' + (n++),
    me: { name: 'Я', stats: { health: 400, accuracy: 60, agility: 50, mana: 50 }, eq: eq || [], sk, skv: skvOf(sk), bar },
    op: { f: { name: 'Бот', level: 3 }, p: R.fighter({ health: 400, accuracy: 50, agility: 50, mana: 0 }, opEq || [], K) }
  });
}
const KN = ['knight.sword', 'knight.axe', 'knight.spear', 'knight.shield', 'knight.bash', 'knight.berserk', 'knight.fists', 'knight.brave', 'knight.care'];

test('Лицар: 9 оброблених вмінь 1 рівня, у кожного правила, значок, опис і ріст', () => {
  const ready = S.readyFor('knight').map(s => s.id);
  assert.strictEqual(JSON.stringify(ready.slice().sort()), JSON.stringify(KN.slice().sort()));
  KN.forEach(id => {
    const s = S.byId(id);
    assert.ok(S.RULES[id] && s.icon && s.mech && s.mech.length, id);
    assert.ok(S.effectText(id, 0.5).length > 5, id);
    assert.ok(S.growTotal(s) >= 20, id);
  });
  assert.ok(!S.byId('knight.potions') && !S.byId('knight.scrolls'), 'дублі універсальних прибрано');
  assert.ok(!S.byId('knight.lunge').ready, 'вміння 5+ рівня ще не оброблені');
});

test('вивчення: лише свій клас і лише оброблені', () => {
  const st = S.bookState({ arena: { level: 3 }, heroClass: 'knight', skills: {} });
  assert.strictEqual(S.learnBlock(st, 'knight.sword'), '');
  assert.strictEqual(S.learnBlock(st, 'knight.lunge'), 'unknown');
  assert.strictEqual(S.learnBlock(S.bookState({ arena: { level: 3 }, heroClass: 'mage', skills: {} }), 'knight.sword'), 'class');
  assert.strictEqual(S.learnBlock(S.bookState({ arena: { level: 3 }, skills: {} }), 'knight.bash'), 'class');
});

test('Меч / Сокира / Спис діють лише з «своєю» зброєю', () => {
  const sk = { 'knight.sword': 1, 'knight.axe': 1, 'knight.spear': 1 };
  const plain = battle({}, [], [wear(SWORD, 'weaponR')]).me.p;
  const sw = battle(sk, [], [wear(SWORD, 'weaponR')]).me.p;
  assert.strictEqual(sw.dmgPct - plain.dmgPct, 10);
  assert.strictEqual(sw.accuracy, Math.round(plain.accuracy * 1.2));
  const ax = battle(sk, [], [wear(AXE, 'weaponR')]).me.p;
  assert.strictEqual(ax.dmgPct - plain.dmgPct, 15);
  assert.strictEqual(ax.pierce, 20);
  assert.strictEqual(ax.accuracy, plain.accuracy);
  const sp = battle(sk, [], [wear(SPEAR, 'weaponR')]).me.p;
  assert.strictEqual(sp.dmgPct - plain.dmgPct, 20);
  // ріст: удари мечем — лише «Меч»
  const st = battle(sk, [], [wear(SWORD, 'weaponR')]);
  for (let i = 0; i < 5; i++) SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  const g = k => (st.me.grow[k] || 0) + (st.me.growF[k] || 0);
  assert.strictEqual(g('knight.sword'), 5);
  assert.strictEqual(g('knight.axe') + g('knight.spear'), 0);
});

test('Сокира: шанс рахувати пів броні (кидок лише коли шанс є)', () => {
  const att = R.fighter({ health: 100, accuracy: 900, agility: 10 }, [wear(AXE, 'weaponR')], K);
  const def = R.fighter({ health: 100, accuracy: 10, agility: 1 }, [wear(ARMOR, 'armor')], K);
  let i = 0; const rnd = () => [0, 0.99, 0, 0.5, 0.99][i++ % 5];
  const h0 = R.strike(att, def, false, rnd);
  assert.ok(!h0.pierce && h0.pierceRoll == null, 'без вміння кидка немає');
  att.pierce = 100; i = 0;
  const h1 = R.strike(att, def, false, rnd);
  assert.ok(h1.pierce && h1.armor === 20, 'броня 40 → 20');
});

test('Голі руки: +урон лише без зброї', () => {
  const a = battle({ 'knight.fists': 1 }, []).me.p, b = battle({}, []).me.p;
  assert.strictEqual(a.dmgFlat - b.dmgFlat, 5);
  const c = battle({ 'knight.fists': 1 }, [], [wear(SWORD, 'weaponR')]).me.p;
  assert.strictEqual(c.dmgFlat, battle({}, [], [wear(SWORD, 'weaponR')]).me.p.dmgFlat);
});

test('Блок щитом: + до шансу блоку лише зі щитом; ріст від ударів у незахищене', () => {
  const a = battle({ 'knight.shield': 1 }, [], [wear(SHIELD, 'weaponL')]).me.p;
  assert.strictEqual(a.blockPhys, 15);
  assert.strictEqual(battle({ 'knight.shield': 1 }, []).me.p.blockPhys, 0);
  const st = battle({ 'knight.shield': 1 }, [], [wear(SHIELD, 'weaponL')]);
  for (let i = 0; i < 30; i++) SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.ok((st.me.grow['knight.shield'] || 0) + (st.me.growF['knight.shield'] || 0) > 0);
});

test('Поштовх щитом: без щита чекає, зі щитом б\'є і може збити з ніг, перезарядка 3', () => {
  const no = battle({ 'knight.bash': 1 }, ['knight.bash']);
  assert.strictEqual(SB.skillBlock(no, 'knight.bash'), 'shield');
  assert.ok(SB.useSkill(ctx, no, 'knight.bash'), 'вибір можна зробити — чекає щита');
  assert.ok(!SB.turn(ctx, no, { atk: 'head', block: 'body' }, {}, Date.now()).skill);
  let knocked = 0, hits = 0;
  for (let k = 0; k < 40; k++) {
    const st = battle({ 'knight.bash': 1 }, ['knight.bash'], [wear(SHIELD, 'weaponL')]);
    SB.useSkill(ctx, st, 'knight.bash');
    const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
    assert.ok(e.skill && e.skill.ok, 'на 100% вдається');
    if (e.skill.kind === 'hit') { hits++; assert.ok(e.skill.dmg >= 1); if (e.skill.knock) knocked++; }
    assert.strictEqual(st.me.cd['knight.bash'], 1 + 3);
  }
  assert.ok(hits > 10 && knocked > 0 && knocked < hits, 'збиває з ніг ~60% влучань: ' + knocked + '/' + hits);
});

test('Берсерк: раз за бій, +урон і −броня на 3 ходи; невдача — можна знову', () => {
  const st = battle({ 'knight.berserk': 1 }, ['knight.berserk'], [wear(ARMOR, 'armor')]);
  SB.useSkill(ctx, st, 'knight.berserk');
  const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.strictEqual(e.skill.kind, 'buff');
  assert.strictEqual(e.skill.dmgPct, 40);
  assert.ok(SB.berserkOn(st), 'хід 2 — ще лють');
  assert.strictEqual(st.me.skill, null, 'вибір знято');
  assert.strictEqual(SB.skillBlock(st, 'knight.berserk'), 'used');
  assert.ok(!SB.useSkill(ctx, st, 'knight.berserk'));
  SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.ok(SB.berserkOn(st), 'хід 3 — ще лють');
  SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.ok(!SB.berserkOn(st), 'хід 4 — минула');
  assert.strictEqual(st.me.grow['knight.berserk'], 1);
  // на 25% (шанс 50%) невдача лишає вибір
  let fail = null;
  for (let k = 0; k < 30 && !fail; k++) {
    const s2 = battle({ 'knight.berserk': 0.25 }, ['knight.berserk']);
    SB.useSkill(ctx, s2, 'knight.berserk');
    const e2 = SB.turn(ctx, s2, { atk: 'head', block: 'body' }, {}, Date.now());
    if (e2.skill.kind === 'fail') fail = s2;
  }
  assert.ok(fail, 'є невдача');
  assert.strictEqual(fail.me.skill, 'knight.berserk');
  assert.strictEqual(SB.skillBlock(fail, 'knight.berserk'), '');
  assert.strictEqual(fail.me.growF['knight.berserk'], 1);
});

test('Догляд за зброєю: частина зносу не рахується, ріст за кожен знос', () => {
  const run = sk => { const st = battle(sk, [], [wear(SWORD, 'weaponR', 'w'), wear(ARMOR, 'armor', 'a')]);
    for (let i = 0; i < 20; i++) SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
    return st; };
  const a = run({ 'knight.care': 1 }), b = run({});
  const sum = st => Object.keys(st.wear).reduce((x, k) => x + st.wear[k], 0);
  assert.ok(a.saved > 0, 'щось збережено');
  assert.strictEqual((a.me.grow['knight.care'] || 0) + (a.me.growF['knight.care'] || 0) > 0, true);
  assert.ok(sum(a) < sum(b) + 5);
});

test('Хоробрість: страх діє рідше, ріст за кожен свиток страху', () => {
  const st = battle({ 'knight.brave': 1 }, []);
  const FEAR = item({ id: 'F', name: 'Страх', category: 'Свиток', addStats: [{ stat: 'Страх', value: 1 }] });
  const r = SB.applyUse(ctx, st, st.op, st.me, 'op', { uid: 'f', id: 'F', base: FEAR }, () => 0.5);
  const f = r.fx.filter(x => x.type === 'fear')[0];
  if (f) {
    assert.strictEqual(f.brave, 60);
    assert.strictEqual(f.need, Math.round(90 * 0.4));
    assert.strictEqual((st.me.grow['knight.brave'] || 0) + (st.me.growF['knight.brave'] || 0), 1);
  }
});

test('адмін: скинути клас — вміння класу зникають, базові лишаються', () => {
  const SKL = require('../src/skills');
  const hero = { arena: { level: 5 }, heroClass: 'knight', skills: { 'base.kick': 3, 'knight.bash': 10, 'knight.sword': 4 },
    skillFails: { 'knight.bash': 1, 'base.kick': 1 }, skillBar: ['base.kick', 'knight.bash', null, null, null] };
  const out = SKL.stripClass(hero, S.bookState(hero));
  assert.strictEqual(out.heroClass, null);
  assert.strictEqual(JSON.stringify(out.skills), JSON.stringify({ 'base.kick': 3 }));
  assert.strictEqual(JSON.stringify(out.skillFails), JSON.stringify({ 'base.kick': 1 }));
  assert.strictEqual(JSON.stringify(out.skillBar), JSON.stringify(['base.kick', null, null, null, null]));
});

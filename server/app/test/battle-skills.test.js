// Вміння в бою (sk-battle.js): пасивні в профілі, активні удари, ухилення, концентрація, ріст.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path'), fs = require('fs'), vm = require('vm');
const ROOT = path.join(__dirname, '../../..');
const box = { window: {}, console };
box.window.window = box.window;
['sk-items.js', 'sk-arena-rules.js', 'sk-battle.js'].forEach(f => vm.runInNewContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), box.window, { filename: f }));
const R = box.window.SKARENA, K = box.window.SKIT, SB = box.window.SKBATTLE;
const ctx = { R, K };
const SHIELD = { id: 'S1', name: 'Щит', category: 'Щити', stat: 'Броня', valueMin: 2, valueMax: 2, addStats: [] };

function battle(sk, bar, eq) {
  return SB.create(ctx, {
    bid: 'test-' + JSON.stringify(sk).length + (bar || []).join(),
    me: { name: 'Я', stats: { health: 400, accuracy: 60, agility: 50, mana: 50 }, eq: eq || [], sk, bar },
    op: { f: { name: 'Бот', level: 3 }, p: R.fighter({ health: 400, accuracy: 50, agility: 50, mana: 0 }, [], K) }
  });
}

test('пасивні: зброя, магія, щит — у профілі', () => {
  const none = battle({}, []);
  const st = battle({ 'base.weapons': 1, 'base.magic': 0.5, 'base.shield': 1 }, [],
    [{ base: SHIELD, inst: { uid: 'u1', id: 'S1', slot: 'weaponL' } }]);
  assert.strictEqual(st.me.p.dmgPct - none.me.p.dmgPct, 25);
  assert.strictEqual(st.me.p.magPct - none.me.p.magPct, 12.5);
  assert.ok(st.me.p.blockPhys >= 5);
});

test('Пінок: удар у зону атаки, перезарядка 2 ходи, ріст майстерності', () => {
  const st = battle({ 'base.kick': 1 }, ['base.kick']);
  assert.strictEqual(SB.skillBlock(st, 'base.kick'), '');
  assert.ok(SB.useSkill(ctx, st, 'base.kick'));
  const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.ok(e.skill, 'є запис вміння');
  assert.strictEqual(e.skill.ok, true, 'на 100% Пінок вдається завжди');
  assert.ok(['hit', 'block'].includes(e.skill.kind));
  if (e.skill.kind === 'hit') assert.ok(e.skill.dmg >= 1);
  assert.strictEqual(SB.skillBlock(st, 'base.kick'), 'cd');
  assert.ok(!SB.useSkill(ctx, st, 'base.kick'));
  assert.ok(st.me.grow['base.kick'] >= 1);
  SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.strictEqual(SB.skillBlock(st, 'base.kick'), '', 'після двох ходів знову можна');
});

test('Пінок заблоковано, якщо суперник захищає зону атаки', () => {
  let blocked = 0, tries = 0;
  for (let i = 0; i < 40; i++) {
    const st = battle({ 'base.kick': 1 }, ['base.kick']); st.bid = 'blk' + i;
    const bot = SB.botChoice(st);
    SB.useSkill(ctx, st, 'base.kick');
    const e = SB.turn(ctx, st, { atk: bot.block, block: 'body' }, {}, Date.now());
    tries++; if (e.skill.kind === 'block') blocked++;
  }
  assert.strictEqual(blocked, tries);
});

test('Вогник: мана, магічний урон; без мани — не можна', () => {
  const st = battle({ 'base.spark': 1, 'base.magic': 1 }, ['base.spark']);
  st.me.mana = 7;
  SB.useSkill(ctx, st, 'base.spark');
  const e = SB.turn(ctx, st, { atk: 'arms', block: 'legs' }, {}, Date.now());
  assert.strictEqual(e.skill.mana, 5);
  assert.strictEqual(st.me.mana, 2);
  if (e.skill.kind === 'hit') assert.ok(e.skill.magDmg >= 1);
  assert.strictEqual(SB.skillBlock(st, 'base.spark'), 'mana');
  assert.ok(st.me.grow['base.magic'] >= 1);
});

test('невивчене / не на панелі — не можна; автохід вміння не використовує', () => {
  const st = battle({ 'base.kick': 1 }, []);
  assert.strictEqual(SB.skillBlock(st, 'base.kick'), 'none');
  const st2 = battle({ 'base.kick': 1 }, ['base.kick']);
  SB.useSkill(ctx, st2, 'base.kick');
  const e = SB.turn(ctx, st2, null, { auto: true }, Date.now());
  assert.ok(!e.skill);
});

test('ухилення й концентрація ростуть; без вміння — нічого', () => {
  const st = battle({ 'base.dodge': 1, 'base.focus': 1, 'base.weapons': 0.5 }, []);
  for (let i = 0; i < 12 && SB.isLive(st); i++) SB.turn(ctx, st, { atk: 'head', block: 'legs' }, {}, Date.now());
  assert.ok((st.me.grow['base.weapons'] || 0) > 0);
  assert.ok((st.me.grow['base.focus'] || 0) + (st.me.grow['base.dodge'] || 0) > 0);
  const plain = battle({}, []);
  for (let i = 0; i < 5; i++) SB.turn(ctx, plain, { atk: 'head', block: 'legs' }, {}, Date.now());
  assert.strictEqual(Object.keys(plain.me.grow).length, 0);
});

test('підсумок бою містить ріст вмінь', () => {
  const st = battle({ 'base.weapons': 0.3 }, []);
  SB.turn(ctx, st, { atk: 'head', block: 'legs' }, {}, Date.now());
  SB.surrender(ctx, st, Date.now());
  assert.ok(st.summary.grow['base.weapons'] >= 1);
});

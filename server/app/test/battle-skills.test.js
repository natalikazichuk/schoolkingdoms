// Вміння в бою (sk-battle.js): пасивні в профілі, активні удари, ухилення, концентрація, ріст.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path'), fs = require('fs'), vm = require('vm');
const ROOT = path.join(__dirname, '../../..');
const box = { window: {}, console };
box.window.window = box.window;
['sk-items.js', 'sk-arena-rules.js', 'sk-skills.js', 'sk-battle.js'].forEach(f => vm.runInNewContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), box.window, { filename: f }));
const R = box.window.SKARENA, K = box.window.SKIT, SB = box.window.SKBATTLE, S = box.window.SKSKILLS;
const ctx = { R, K };
const SHIELD = { id: 'S1', name: 'Щит', category: 'Щити', stat: 'Броня', valueMin: 2, valueMax: 2, addStats: [] };

// як arena.html: м 0…1 і готові значення з правил (SKSKILLS.skillValues)
function skvOf(sk) { const o = {}; Object.keys(sk || {}).forEach(id => { o[id] = S.skillValues(id, Math.round(sk[id] * 100)); }); return o; }
function battle(sk, bar, eq) {
  return SB.create(ctx, {
    bid: 'test-' + JSON.stringify(sk).length + (bar || []).join(),
    me: { name: 'Я', stats: { health: 400, accuracy: 60, agility: 50, mana: 50 }, eq: eq || [], sk, skv: skvOf(sk), bar },
    op: { f: { name: 'Бот', level: 3 }, p: R.fighter({ health: 400, accuracy: 50, agility: 50, mana: 0 }, [], K) }
  });
}

test('пасивні сталі: зброя, магія — у профілі, ефект × м з округленням', () => {
  const none = battle({}, []);
  const st = battle({ 'base.weapons': 1, 'base.magic': 0.5 }, []);
  assert.strictEqual(st.me.p.dmgPct - none.me.p.dmgPct, 25);
  assert.strictEqual(st.me.p.magPct - none.me.p.magPct, 13, '12,5 → 13');
  const low = battle({ 'base.weapons': 0.25 }, []);
  assert.strictEqual(low.me.p.dmgPct - none.me.p.dmgPct, 6, '6,25 → 6');
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
  assert.strictEqual(st.me.skill, 'base.kick', 'вибір лишається після атаки');
  assert.ok((st.me.grow['base.kick'] || 0) + (st.me.growF['base.kick'] || 0) >= 1);
  // на перезарядці вибір не скидається і Пінок не б'є
  assert.ok(!SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now()).skill);
  assert.ok(!SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now()).skill);
  assert.strictEqual(st.me.skill, 'base.kick');
  assert.strictEqual(SB.skillBlock(st, 'base.kick'), '', 'після двох ходів знову можна');
  // і б'є сам, без повторного натискання
  assert.ok(SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now()).skill, 'перезарядився — б\'є знову');
});

test('Вогник обраний — б\'є щоходу, поки є мана; скасування — більше не б\'є', () => {
  const st = battle({ 'base.spark': 1, 'base.magic': 1 }, ['base.spark']);
  st.me.mana = 12;
  SB.useSkill(ctx, st, 'base.spark');
  assert.ok(SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now()).skill);
  assert.ok(SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now()).skill);
  assert.strictEqual(st.me.mana, 2);
  assert.ok(!SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now()).skill, 'без мани — чекає');
  assert.strictEqual(st.me.skill, 'base.spark', 'вибір не скинуто');
  st.me.mana = 10;
  assert.ok(SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now()).skill, 'мана є — знову б\'є');
  SB.useSkill(ctx, st, null);
  assert.ok(!SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now()).skill);
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

test('Вогник: невдача теж забирає всю ману', () => {
  let failed = 0;
  for (let i = 0; i < 40; i++) {
    const st = battle({ 'base.spark': 0 }, ['base.spark']); st.bid = 'mf' + i;   // м = 0 → шанс 50%
    st.me.mana = 20;
    SB.useSkill(ctx, st, 'base.spark');
    const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
    assert.strictEqual(e.skill.mana, 5); assert.strictEqual(st.me.mana, 15);
    if (e.skill.kind === 'fail') failed++;
  }
  assert.ok(failed > 0, 'були невдачі');
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
  assert.ok((st.summary.grow['base.weapons'] || 0) + (st.summary.growFail['base.weapons'] || 0) >= 1);
});

test('вдалі й невдалі рахуються окремо: Пінок у заблоковану зону — невдалий', () => {
  for (let i = 0; i < 10; i++) {
    const st = battle({ 'base.kick': 1 }, ['base.kick']); st.bid = 'sep' + i;
    const bot = SB.botChoice(st);
    SB.useSkill(ctx, st, 'base.kick');
    SB.turn(ctx, st, { atk: bot.block, block: 'body' }, {}, Date.now());
    assert.ok(!st.me.grow['base.kick'], 'заблоковане — не вдале');
    assert.strictEqual(st.me.growF['base.kick'], 1);
  }
});

test('зброя: влучання — вдалі, промахи/блоки — невдалі', () => {
  let ok = 0, bad = 0, hits = 0, land = 0;
  for (let i = 0; i < 30; i++) {
    const st = battle({ 'base.weapons': 0.5 }, []); st.bid = 'w' + i;
    const e = SB.turn(ctx, st, { atk: 'head', block: 'legs' }, {}, Date.now());
    ok += st.me.grow['base.weapons'] || 0; bad += st.me.growF['base.weapons'] || 0;
    (e.meHit.hits || []).forEach(h => { hits++; if (h.kind === 'hit' || h.kind === 'crit') land++; });
  }
  assert.strictEqual(ok, land); assert.strictEqual(ok + bad, hits); assert.ok(bad > 0);
});

test('сервер: 2 невдалі = 1 вдале, решта невдалих зберігається окремо', () => {
  const { applyGrow, lib: L } = require('../src/skills.js'), lib = L();
  const r = applyGrow(lib, { 'base.kick': 10, 'base.dodge': 0 }, { 'base.kick': 1 },
    { played: 10, grow: { 'base.kick': 3 }, growFail: { 'base.kick': 4, 'base.dodge': 3, 'base.spark': 5 } });
  assert.strictEqual(r.skills['base.kick'], 10 + 3 + 2);   // 1 + 4 = 5 невдалих → +2, лишилась 1
  assert.strictEqual(r.fails['base.kick'], 1);
  assert.strictEqual(r.skills['base.dodge'], 1);            // 3 невдалі → +1, лишилась 1
  assert.strictEqual(r.fails['base.dodge'], 1);
  assert.ok(!('base.spark' in r.skills), 'невивчене не росте');
  // 40 невдач = 20 вдалих
  const a = applyGrow(lib, { 'base.kick': 0 }, {}, { played: 20, grow: { 'base.kick': 20 } });
  const b = applyGrow(lib, { 'base.kick': 0 }, {}, { played: 20, growFail: { 'base.kick': 40 } });
  assert.strictEqual(a.skills['base.kick'], b.skills['base.kick']);
});

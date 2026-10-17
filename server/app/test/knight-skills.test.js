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
const wear = (base, slot, uid) => ({ base, inst: { uid: uid || base.id + slot, id: base.id, slot, bonus: 1, durMax: 500, durCur: 500 } });

function skvOf(sk) { const o = {}; Object.keys(sk || {}).forEach(id => { o[id] = S.skillValues(id, Math.round(sk[id] * 100)); }); return o; }
let n = 0;
function battle(sk, bar, eq, opEq) {
  return SB.create(ctx, {
    bid: 'kn-' + (n++),
    me: { name: 'Я', stats: { health: 400, accuracy: 60, agility: 50, mana: 50 }, eq: eq || [], sk, skv: skvOf(sk), bar },
    op: { f: { name: 'Бот', level: 3 }, p: R.fighter({ health: 400, accuracy: 50, agility: 50, mana: 0 }, opEq || [], K) }
  });
}
const KN = ['knight.sword', 'knight.axe', 'knight.spear', 'knight.shield', 'knight.bash', 'knight.berserk', 'knight.fists', 'knight.brave', 'knight.care', 'knight.lunge', 'knight.enh'];

test('Лицар: оброблені вміння (9 першого рівня + Випад, Посилений урон), у кожного правила, значок, опис і ріст', () => {
  const ready = S.readyFor('knight').map(s => s.id);
  assert.strictEqual(JSON.stringify(ready.slice().sort()), JSON.stringify(KN.slice().sort()));
  KN.forEach(id => {
    const s = S.byId(id);
    assert.ok(S.RULES[id] && s.icon && s.mech && s.mech.length, id);
    assert.ok(S.effectText(id, 0.5).length > 5, id);
    assert.ok(S.growTotal(s) >= 20, id);
  });
  assert.ok(!S.byId('knight.potions') && !S.byId('knight.scrolls'), 'дублі універсальних прибрано');
  assert.ok(!S.byId('knight.calm').ready, 'решта вмінь 5+ рівня ще не оброблені');
});

test('вивчення: лише свій клас і лише оброблені', () => {
  const st = S.bookState({ arena: { level: 3 }, heroClass: 'knight', skills: {} });
  assert.strictEqual(S.learnBlock(st, 'knight.sword'), '');
  assert.strictEqual(S.learnBlock(st, 'knight.lunge'), 'level', 'Випад — з 5 рівня');
  assert.strictEqual(S.learnBlock(S.bookState({ arena: { level: 6 }, heroClass: 'knight', skills: {} }), 'knight.calm'), 'unknown');
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

const KNUCK = item({ id: 'K1', name: 'Кастети', category: 'Зброя', stat: 'Урон', valueMin: 4, valueMax: 9, weaponType: 'knuckles', addStats: [{ stat: 'Дворучний', flag: true }] });
test('Голі руки: без зброї урон 3–8 (з базою 11–16); з кастетами — урон кастетів; зі мечем — нічого', () => {
  const a = battle({ 'knight.fists': 0.25 }, []).me.p, b = battle({}, []).me.p;
  assert.strictEqual(a.wMin - b.wMin, 3); assert.strictEqual(a.wMax - b.wMax, 8, 'урон 3–8 не залежить від майстерності');
  const k = battle({ 'knight.fists': 1 }, [], [wear(KNUCK, 'weaponR')]).me.p, k0 = battle({}, [], [wear(KNUCK, 'weaponR')]).me.p;
  assert.strictEqual(k.wMin, k0.wMin); assert.strictEqual(k.wMax, k0.wMax);
  const c = battle({ 'knight.fists': 1 }, [], [wear(SWORD, 'weaponR')]).me.p, c0 = battle({}, [], [wear(SWORD, 'weaponR')]).me.p;
  assert.strictEqual(c.wMax, c0.wMax); assert.strictEqual(c.accuracy, c0.accuracy);
  // кулак + щит: +10% точності на 100%
  const s = battle({ 'knight.fists': 1 }, [], [wear(KNUCK, 'weaponR'), wear(SHIELD, 'weaponL')]).me.p;
  assert.strictEqual(s.accuracy, Math.round(k0.accuracy * 1.1));
});

test('Кастети: не дворучні — щит у ліву можна, навіть з прапорцем «Дворучний»', () => {
  assert.ok(!R.isTwoHanded(KNUCK));
  const eq = R.handsFix([wear(KNUCK, 'weaponR'), wear(SHIELD, 'weaponL')]);
  assert.strictEqual(eq.length, 2);
  assert.strictEqual(K.kindLabel(KNUCK), '🥊 Кастети');
});

test('«Двійка»: лише з вільною лівою рукою, пів урону, ріст «Голих рук»', () => {
  let combos = 0, turns = 0;
  for (let k = 0; k < 40; k++) {
    const st = battle({ 'knight.fists': 1 }, [], [wear(KNUCK, 'weaponR')]);
    for (let i = 0; i < 5; i++) {
      const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now()); turns++;
      assert.ok(e.meHit.combo && e.meHit.combo.need === 25);
      const c = e.meHit.hits.filter(h => h.combo);
      if (e.meHit.combo.ok) { combos++; assert.strictEqual(c.length, 1); if (c[0].parts) assert.ok(c[0].half); }
      else assert.strictEqual(c.length, 0);
      if (!st.status || st.status !== 'live') break;
    }
  }
  assert.ok(combos > turns * 0.12 && combos < turns * 0.4, combos + '/' + turns);
  const sh = battle({ 'knight.fists': 1 }, [], [wear(KNUCK, 'weaponR'), wear(SHIELD, 'weaponL')]);
  const e = SB.turn(ctx, sh, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.ok(!e.meHit.combo, 'зі щитом двійки немає');
  const g = SB.turn(ctx, battle({ 'knight.fists': 0.5 }, []), { atk: 'head', block: 'body' }, {}, Date.now());
  assert.strictEqual(g.grow['knight.fists'][0] + g.grow['knight.fists'][1], g.meHit.hits.length);
  // пів урону: той самий кидок — удвічі менше
  const att = R.fighter({ health: 100, accuracy: 900, agility: 10 }, [], K), def = R.fighter({ health: 100, accuracy: 10, agility: 1 }, [], K);
  const fix = () => { let i = 0; return () => [0, 0.5, 0.99][i++ % 3]; };
  const full = R.strike(att, def, false, fix()), half = R.strike(Object.assign({}, att, { dmgMul: 0.5 }), def, false, fix());
  assert.strictEqual(half.dmg, Math.round(full.dmg / 2));
});

test('Блок щитом: + до шансу блоку лише зі щитом; ріст від ударів у незахищене', () => {
  const a = battle({ 'knight.shield': 1 }, [], [wear(SHIELD, 'weaponL')]).me.p;
  assert.strictEqual(a.blockPhys, 15);
  assert.strictEqual(battle({ 'knight.shield': 1 }, []).me.p.blockPhys, 0);
  const st = battle({ 'knight.shield': 1 }, [], [wear(SHIELD, 'weaponL')]);
  for (let i = 0; i < 30; i++) SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.ok((st.me.grow['knight.shield'] || 0) + (st.me.growF['knight.shield'] || 0) > 0);
});

test('Поштовх щитом: без щита чекає, зі щитом — без урону, може збити з ніг (15% → 30%), перезарядка 3', () => {
  assert.strictEqual(S.skillValues('knight.bash', 25).knock, 15);
  assert.strictEqual(S.skillValues('knight.bash', 100).knock, 30);
  const no = battle({ 'knight.bash': 1 }, ['knight.bash']);
  assert.strictEqual(SB.skillBlock(no, 'knight.bash'), 'shield');
  assert.ok(SB.useSkill(ctx, no, 'knight.bash'), 'вибір можна зробити — чекає щита');
  assert.ok(!SB.turn(ctx, no, { atk: 'head', block: 'body' }, {}, Date.now()).skill);
  let knocked = 0, hits = 0;
  for (let k = 0; k < 120; k++) {
    const st = battle({ 'knight.bash': 1 }, ['knight.bash'], [wear(SHIELD, 'weaponL')]);
    SB.useSkill(ctx, st, 'knight.bash');
    const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
    assert.ok(e.skill && e.skill.ok, 'на 100% вдається');
    if (e.skill.kind === 'hit') { hits++; assert.strictEqual(e.skill.dmg, 0, 'урону немає'); assert.ok(e.skill.noDmg); if (e.skill.knock) knocked++; }
    assert.strictEqual(st.me.cd['knight.bash'], 1 + 3);
  }
  assert.ok(hits > 30 && knocked > 0 && knocked < hits * 0.5, 'збиває з ніг ~30% влучань: ' + knocked + '/' + hits);
});

test('Берсерк: лють на 🎲 3–4 (25%) → 3–5 → 3–6 → 4–7 (100%), шанс і урон ростуть', () => {
  const rng = p => { const v = S.skillValues('knight.berserk', p); return v.turnsMin + '–' + v.turnsMax; };
  assert.strictEqual([25, 50, 75, 100].map(rng).join(' '), '3–4 3–5 3–6 4–7');
  const seen = {};
  for (let k = 0; k < 60; k++) {
    const st = battle({ 'knight.berserk': 1 }, ['knight.berserk']);
    SB.useSkill(ctx, st, 'knight.berserk');
    const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
    assert.ok(e.skill.turns >= 4 && e.skill.turns <= 7, String(e.skill.turns));
    assert.strictEqual(st.me.fx.berserk, 1 + e.skill.turns - 1);
    seen[e.skill.turns] = 1;
  }
  assert.strictEqual(Object.keys(seen).length, 4, 'на 100% випадають 4, 5, 6 і 7');
  const a = S.skillValues('knight.berserk', 25), b = S.skillValues('knight.berserk', 100);
  assert.ok(a.chance < b.chance && a.dmgPct < b.dmgPct);
});

test('Берсерк: раз за бій, +урон і −броня; невдача — можна знову', () => {
  const st = battle({ 'knight.berserk': 1 }, ['knight.berserk'], [wear(ARMOR, 'armor')]);
  SB.useSkill(ctx, st, 'knight.berserk');
  const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.strictEqual(e.skill.kind, 'buff');
  assert.strictEqual(e.skill.dmgPct, 40);
  assert.ok(SB.berserkOn(st), 'хід 2 — ще лють');
  assert.strictEqual(st.me.skill, null, 'вибір знято');
  assert.strictEqual(SB.skillBlock(st, 'knight.berserk'), 'used');
  assert.ok(!SB.useSkill(ctx, st, 'knight.berserk'));
  for (let r = 3; r <= e.skill.turns; r++) { SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now()); assert.ok(SB.berserkOn(st), 'хід ' + r + ' — ще лють'); }
  SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.ok(!SB.berserkOn(st), 'після ' + e.skill.turns + ' ходів — минула');
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
    assert.strictEqual(f.brave, 90);
    assert.strictEqual(f.need, Math.round(90 * 0.1), 'на 100% перший страх — лише 9%');
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

test('одна дія за хід: вміння ↔ пояс знімають одне одного, перевдягання знімає обидва й блокує', () => {
  const POT = item({ id: 'P1', name: 'Зілля', category: 'Зелья', addStats: [{ stat: "Відновлення здоров'я", value: 10 }] });
  const st = SB.create(ctx, {
    bid: 'one-' + (n++),
    me: { name: 'Я', stats: { health: 400, accuracy: 60, agility: 50, mana: 50 }, eq: [wear(SWORD, 'weaponR', 'w')],
      belt: [{ base: POT, inst: { uid: 'p1', id: 'P1', slot: 'belt0', bonus: 1 } }],
      sk: { 'knight.berserk': 1 }, skv: skvOf({ 'knight.berserk': 1 }), bar: ['knight.berserk'] },
    op: { f: { name: 'Бот', level: 3 }, p: R.fighter({ health: 400, accuracy: 50, agility: 50, mana: 0 }, [], K) }
  });
  assert.ok(SB.useSkill(ctx, st, 'knight.berserk'));
  assert.ok(SB.useBelt(ctx, st, 'p1'));
  assert.strictEqual(st.me.skill, null, 'пояс зняв вміння');
  assert.ok(SB.useSkill(ctx, st, 'knight.berserk'));
  assert.strictEqual(st.me.use, null, 'вміння зняло пояс');
  assert.ok(SB.useBelt(ctx, st, 'p1'));
  assert.ok(SB.swap(ctx, st, 'weaponR', null, null), 'перевдягнутись можна, навіть коли обрано пояс');
  assert.strictEqual(st.me.use, null); assert.strictEqual(st.me.skill, null);
  assert.ok(SB.swapped(st));
  assert.ok(!SB.useBelt(ctx, st, 'p1'), 'після перевдягання пояс не обрати');
  assert.ok(!SB.useSkill(ctx, st, 'knight.berserk'), 'і вміння теж');
  assert.strictEqual(SB.skillBlock(st, 'knight.berserk'), 'swap');
  assert.ok(!SB.swap(ctx, st, 'weaponR', { uid: 'w', id: 'W1', bonus: 1 }, SWORD), 'друге перевдягання — ні');
  const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.ok(!e.skill && !e.uses, 'цього ходу — лише перевдягання');
  assert.ok(!SB.swapped(st), 'новий хід — знову можна');
  assert.ok(SB.useSkill(ctx, st, 'knight.berserk'));
});

test('оглушення: оглушений не атакує й без спецдій; поки оглушений — імунітет до нового', () => {
  // Пінок, що завжди збиває (knock 100)
  const sk = { 'base.kick': 1 };
  const st = battle(sk, ['base.kick']);
  st.me.skv['base.kick'].knock = 100;
  let k = 0;
  while (k < 30 && !(st.op.fx && st.op.fx.knock === st.round)) { SB.useSkill(ctx, st, 'base.kick'); SB.turn(ctx, st, { atk: 'head', block: 'legs' }, {}, Date.now()); k++; }
  assert.ok(SB.knockedNow(st, st.op), 'суперник оглушений цього ходу');
  st.me.cd = {};                                     // Пінок знову доступний — спробуємо збити ще раз
  const e = SB.turn(ctx, st, { atk: 'head', block: 'legs' }, {}, Date.now());
  assert.strictEqual(e.opHit.kind, 'knock', 'оглушений не атакує');
  if (e.skill && e.skill.kind === 'hit') assert.ok(e.skill.knockImmune && !e.skill.knock, 'імунітет: двічі поспіль не збити');
  assert.ok(!SB.knockedNow(st, st.op), 'наступного ходу вже не оглушений');
  // хід після оглушення — шанс навпіл (100 → 50), ще через хід — повний
  let half = null, full = null;
  for (let t = 0; t < 12 && (!half || !full); t++) {
    st.me.cd = {}; SB.useSkill(ctx, st, 'base.kick');
    const last = st.op.fx.knock, r = st.round;
    const x = SB.turn(ctx, st, { atk: 'head', block: 'legs' }, {}, Date.now());
    if (!x.skill || x.skill.kind !== 'hit') continue;
    if (r === last + 1) half = x.skill; else if (r >= last + 2) full = x.skill;
    if (x.skill.knock) break;
  }
  if (half) assert.ok(half.knockHalf && half.knockNeed === 50, 'навпіл: ' + JSON.stringify(half));
  if (full) assert.strictEqual(full.knockNeed, 100);
  // Герой оглушений: ні вміння, ні пояса, ні перевдягання, ні удару
  const me = battle({ 'base.kick': 1 }, ['base.kick'], [wear(SWORD, 'weaponR', 'w')]);
  SB.useSkill(ctx, me, 'base.kick');
  me.me.fx.knock = me.round;
  assert.strictEqual(SB.skillBlock(me, 'base.kick'), 'knock');
  assert.ok(!SB.swap(ctx, me, 'weaponR', null, null), 'оглушений не перевдягається');
  const e2 = SB.turn(ctx, me, { atk: 'head', block: 'legs' }, {}, Date.now());
  assert.strictEqual(e2.meHit.kind, 'knock'); assert.ok(!e2.skill && e2.meKnocked);
  assert.strictEqual(me.me.skill, 'base.kick', 'вибір вміння лишається на наступний хід');
});

test('журнал: запис ходу містить ріст вмінь за хід (вдалі, невдалі, разом)', () => {
  const st = battle({ 'knight.sword': 0.5 }, [], [wear(SWORD, 'weaponR', 'w')]);
  const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  const g = e.grow && e.grow['knight.sword'];
  assert.ok(g, 'є запис про Меч');
  assert.strictEqual(g[0] + g[1], e.meHit.hits.length, 'скільки ударів — стільки спрацювань');
  const e2 = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  const g2 = e2.grow['knight.sword'];
  assert.strictEqual(g2[2] + g2[3], e.meHit.hits.length + e2.meHit.hits.length, 'разом за бій');
});

test('журнал: знос речей за хід з назвами (і збережене Доглядом) та здоров\'я після ходу', () => {
  const st = battle({ 'knight.care': 1 }, [], [wear(SWORD, 'weaponR', 'w'), wear(ARMOR, 'armor', 'a')]);
  let seen = { lost: 0, saved: 0 };
  for (let i = 0; i < 15; i++) {
    const e = SB.turn(ctx, st, { atk: 'head', block: 'legs' }, {}, Date.now());
    assert.ok(e.hp && e.hp.length === 4 && e.hp[1] > 0, 'є здоров\'я після ходу');
    (e.wear || []).forEach(x => { assert.ok(x.who && x.n > 0); if (x.saved) seen.saved++; else seen.lost++; });
  }
  assert.ok(seen.lost > 0 && seen.saved > 0, JSON.stringify(seen));
});

test('пояс бота: 5 комірок, у тесті — свитки (спершу страх); бот кидає страх → росте Хоробрість', () => {
  const FEAR = item({ id: 'F', name: 'Свиток страху', category: 'Свиток', addStats: [{ stat: 'Страх', value: 1 }] });
  const FIRE = item({ id: 'FS', name: 'Вогняний свиток', category: 'Свиток', stat: 'Магічний урон', valueMin: 5, valueMax: 9 });
  const cat = [SWORD, FEAR, FIRE];
  const belt = R.botBelt(cat, K);
  assert.strictEqual(belt.length, 5);
  assert.strictEqual(belt.filter(b => b.base.id === 'F').length, 2, 'два свитки страху');
  assert.ok(belt.every(b => b.base.category === 'Свиток'));
  R.BATTLE.botBeltTest = false; assert.strictEqual(R.botBelt(cat, K).length, 0, 'за замовчуванням — порожній'); R.BATTLE.botBeltTest = true;
  let fears = 0, brave = 0;
  for (let k = 0; k < 20; k++) {
    const st = SB.create(ctx, { bid: 'bb-' + (n++),
      me: { name: 'Я', stats: { health: 4000, accuracy: 60, agility: 50, mana: 0 }, eq: [], sk: { 'knight.brave': 0.5 }, skv: skvOf({ 'knight.brave': 0.5 }), bar: [] },
      op: { f: { name: 'Бот', level: 3 }, p: R.fighter({ health: 4000, accuracy: 50, agility: 50, mana: 0 }, [], K), belt: R.botBelt(cat, K) } });
    for (let i = 0; i < 30; i++) {
      const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
      (e.uses || []).forEach(u => { assert.strictEqual(u.side, 'op'); if (u.fx.some(x => x.type === 'fear' && !x.immune)) fears++; });
    }
    assert.ok(st.op.belt.filter(b => b.used).length <= 5);
    brave += (st.me.grow['knight.brave'] || 0) + (st.me.growF['knight.brave'] || 0);
  }
  assert.ok(fears > 10, 'бот кидає страх: ' + fears);
  assert.strictEqual(brave, fears, 'кожен страх — спрацювання Хоробрості');
});

test('heroSheet: база поза боєм = тести + вдягнені речі (без пояса), та сама формула, що в бою', () => {
  const POT = item({ id: 'P', name: 'Зілля', category: 'Зелья', stat: 'Броня', valueMin: 99, valueMax: 99 });
  const eq = [wear(SWORD, 'weaponR'), wear(ARMOR, 'armor'), wear(POT, 'belt0')];
  const sh = R.heroSheet(R.heroStatsOf({ health: 61, accuracy: 151, agility: 262 }), eq, K);
  assert.strictEqual(sh.health, 61); assert.strictEqual(sh.mana, 20, 'немає в базі — як за замовчуванням');
  assert.strictEqual(sh.armor, 40, 'пояс не рахується');
  assert.strictEqual(sh.dmg, (8 + 4) + '–' + (8 + 6));
  assert.strictEqual(sh.mag, '—');
  const st = battle({}, [], [wear(SWORD, 'weaponR'), wear(ARMOR, 'armor')]);
  assert.strictEqual(R.heroSheet({ health: 400, accuracy: 60, agility: 50, mana: 50 }, [wear(SWORD, 'weaponR'), wear(ARMOR, 'armor')], K).armor, st.me.p.armor, 'як у бою');
});

test('Випад: без перезарядки, основний удар ×1 → ×1.5, броня 80%, на 100% — 25% ще одного удару', () => {
  assert.strictEqual(S.skillValues('knight.lunge', 100).dmgPct, 50);
  assert.strictEqual(S.skillValues('knight.lunge', 25).extra, 6);
  assert.ok(S.skillValues('knight.lunge', 100).cd == null, 'перезарядки немає');
  let extra = 0, turns = 0, mulSeen = false, armorSeen = false;
  for (let k = 0; k < 40; k++) {
    const st = battle({ 'knight.lunge': 1 }, ['knight.lunge'], [wear(SWORD, 'weaponR')], [wear(ARMOR, 'armor')]);
    SB.useSkill(ctx, st, 'knight.lunge');
    for (let i = 0; i < 4 && st.status === 'live'; i++) {
      const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now()); turns++;
      assert.ok(e.skill && e.skill.id === 'knight.lunge' && e.skill.kind === 'lunge', 'на 100% вдається щоходу');
      assert.strictEqual(e.skill.mul, 1.5);
      assert.strictEqual(st.me.skill, 'knight.lunge', 'вибір лишається — можна щоходу');
      e.meHit.hits.forEach(h => { if (h.parts && !h.lungeExtra) { if (h.mul === 1.5) mulSeen = true; if (h.armorPct === 80 && h.armor === 32) armorSeen = true; } });
      if (e.skill.extra) { extra++; assert.ok(e.meHit.hits.some(h => h.lungeExtra)); }
    }
  }
  assert.ok(mulSeen && armorSeen, 'удар ×1.5, броня 40 → 32');
  assert.ok(extra > turns * 0.1 && extra < turns * 0.45, 'ще удар ~25%: ' + extra + '/' + turns);
});

test('Посилений урон: +25% фізичного на 100%, ріст від ударів', () => {
  const a = battle({ 'knight.enh': 1 }, [], [wear(SWORD, 'weaponR')]), b = battle({}, [], [wear(SWORD, 'weaponR')]);
  assert.strictEqual(a.me.p.dmgPct - b.me.p.dmgPct, 25);
  SB.turn(ctx, a, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.ok((a.me.grow['knight.enh'] || 0) + (a.me.growF['knight.enh'] || 0) >= 1);
});

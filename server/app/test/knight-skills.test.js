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
    me: { name: 'Я', stats: { health: 400, accuracy: 60, agility: 50, mana: 500 }, eq: eq || [], sk, skv: skvOf(sk), bar, cls: 'knight' },
    op: { f: { name: 'Бот', level: 3 }, p: R.fighter({ health: 400, accuracy: 50, agility: 50, mana: 0 }, opEq || [], K) }
  });
}
const KN = ['knight.sword', 'knight.axe', 'knight.spear', 'knight.shield', 'knight.bash', 'knight.berserk', 'knight.fists', 'knight.brave', 'knight.care', 'knight.lunge', 'knight.enh',
  'knight.tough', 'knight.calm', 'knight.second', 'knight.haft', 'knight.bless', 'knight.parry', 'knight.daze', 'knight.riposte', 'knight.disarm',
  'knight.stoneskin', 'knight.steady', 'knight.song', 'knight.will', 'knight.shieldbreak', 'knight.stun', 'knight.lash'];

test('Лицар: оброблені вміння (9 першого рівня + 11 з 4–16 рівня + 2 з 14–17 + 5 з 18–22), у кожного правила, значок, опис і ріст', () => {
  const ready = S.readyFor('knight').map(s => s.id);
  assert.strictEqual(JSON.stringify(ready.slice().sort()), JSON.stringify(KN.slice().sort()));
  KN.forEach(id => {
    const s = S.byId(id);
    assert.ok(S.RULES[id] && s.icon && s.mech && s.mech.length, id);
    assert.ok(S.effectText(id, 0.5).length > 5, id);
    assert.ok(S.growTotal(s) >= 20, id);
  });
  assert.ok(!S.byId('knight.potions') && !S.byId('knight.scrolls'), 'дублі універсальних прибрано');
  assert.ok(!S.byId('knight.frenzy').ready && !S.byId('knight.offhand').ready && !S.byId('knight.taunt').ready, 'решта ще не оброблені');
  assert.ok(!S.byId('knight.dodge'), 'дубль Ухилення замінено Стійкістю');
});

test('вивчення: лише свій клас і лише оброблені', () => {
  const st = S.bookState({ arena: { level: 3 }, heroClass: 'knight', skills: {} });
  assert.strictEqual(S.learnBlock(st, 'knight.sword'), '');
  assert.strictEqual(S.learnBlock(st, 'knight.lunge'), 'level', 'Випад — з 5 рівня');
  assert.strictEqual(S.learnBlock(S.bookState({ arena: { level: 20 }, heroClass: 'knight', skills: {} }), 'knight.frenzy'), 'unknown');
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

test('Берсерк: −100 мани лише коли спрацював; поки лють — не обрати; потім — знову можна', () => {
  const st = battle({ 'knight.berserk': 1 }, ['knight.berserk'], [wear(ARMOR, 'armor')]);
  const m0 = st.me.mana;
  SB.useSkill(ctx, st, 'knight.berserk');
  const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.strictEqual(e.skill.kind, 'buff');
  assert.strictEqual(e.skill.dmgPct, 40);
  assert.strictEqual(st.me.mana, m0 - 100, '−100 мани');
  assert.strictEqual(st.me.skill, null, 'вибір знято');
  assert.strictEqual(SB.skillBlock(st, 'knight.berserk'), 'active', 'поки лють — не обрати');
  for (let r = 2; r <= e.skill.turns; r++) { assert.ok(SB.berserkOn(st)); SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now()); }
  assert.ok(!SB.berserkOn(st), 'минула');
  assert.strictEqual(SB.skillBlock(st, 'knight.berserk'), '', 'знову можна');
  st.me.mana = 50;
  assert.strictEqual(SB.skillBlock(st, 'knight.berserk'), 'mana', 'менше 100 мани — чекає');
  // невдача мани не бере
  let fail = null;
  for (let k = 0; k < 40 && !fail; k++) {
    const s2 = battle({ 'knight.berserk': 0.25 }, ['knight.berserk']);
    SB.useSkill(ctx, s2, 'knight.berserk'); const m = s2.me.mana;
    const e2 = SB.turn(ctx, s2, { atk: 'head', block: 'body' }, {}, Date.now());
    if (e2.skill.kind === 'fail') { fail = s2; assert.strictEqual(s2.me.mana, m, 'невдача — мана ціла'); }
  }
  assert.ok(fail); assert.strictEqual(fail.me.skill, 'knight.berserk');
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

test('Міцне тіло: максимум здоров\'я +25% на 100% (+6% на 25%), ріст від ударів, що завдали урону', () => {
  const b = battle({}, []), a = battle({ 'knight.tough': 1 }, []), q = battle({ 'knight.tough': 0.25 }, []);
  assert.strictEqual(a.me.max, Math.round(b.me.max * 1.25)); assert.strictEqual(a.me.force, a.me.max);
  assert.strictEqual(q.me.max, Math.round(b.me.max * 1.06));
  let got = 0, dmg = 0;
  for (let i = 0; i < 40 && a.status === 'live'; i++) {
    const e = SB.turn(ctx, a, { atk: 'head', block: 'legs' }, {}, Date.now());
    dmg += ((e.opHit && e.opHit.hits) || []).filter(h => (h.kind === 'hit' || h.kind === 'crit') && h.dmg > 0).length;
  }
  got = (a.me.grow || {})['knight.tough'] || 0;
  assert.ok(dmg > 0 && got === dmg, 'ріст = ударів з уроном: ' + got + ' / ' + dmg);
  assert.ok(!((a.me.growF || {})['knight.tough']), 'невдалих спроб немає');
});

const DAGGER = item({ id: 'W4', name: 'Кинджал', category: 'Зброя', stat: 'Урон', valueMin: 4, valueMax: 6, weaponType: 'dagger' });
const WHIP = item({ id: 'W5', name: 'Кнут', category: 'Зброя', stat: 'Урон', valueMin: 4, valueMax: 6, weaponType: 'whip' });
const STAFF = item({ id: 'W6', name: 'Посох', category: 'Зброя', stat: 'Урон', valueMin: 4, valueMax: 6, weaponType: 'staff' });

test('Випад і Удар древком — лише своєю зброєю (не кнутом, не вибитою)', () => {
  const ok = (id, w) => SB.skillBlock(battle({ [id]: 1 }, [id], w ? [wear(w, 'weaponR')] : []), id);
  assert.strictEqual(ok('knight.lunge', SWORD), ''); assert.strictEqual(ok('knight.lunge', DAGGER), ''); assert.strictEqual(ok('knight.lunge', SPEAR), '');
  assert.strictEqual(ok('knight.lunge', AXE), 'weapon'); assert.strictEqual(ok('knight.lunge', WHIP), 'weapon'); assert.strictEqual(ok('knight.lunge', null), 'weapon');
  assert.strictEqual(ok('knight.haft', SPEAR), ''); assert.strictEqual(ok('knight.haft', STAFF), '');
  assert.strictEqual(ok('knight.haft', SWORD), 'weapon'); assert.strictEqual(ok('knight.haft', WHIP), 'weapon');
  const st = battle({ 'knight.lunge': 1 }, ['knight.lunge'], [wear(SWORD, 'weaponR')]);
  st.me.fx.disarm = st.round;                                 // меч вибито
  assert.strictEqual(SB.skillBlock(st, 'knight.lunge'), 'weapon');
});

test('Друга атака: на 100% — ~75% ходів ще один удар', () => {
  let n = 0, t = 0;
  for (let k = 0; k < 30; k++) { const st = battle({ 'knight.second': 1 }, [], [wear(SWORD, 'weaponR')]);
    for (let i = 0; i < 4 && st.status === 'live'; i++) { const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now()); t++; if (e.meHit.hits.some(h => h.second)) n++; } }
  assert.ok(n > t * 0.6 && n < t * 0.9, n + '/' + t);
});

test('Удар древком: удар ×1 у зону + на 100% завжди другий у ІНШУ зону', () => {
  const st = battle({ 'knight.haft': 1 }, ['knight.haft'], [wear(SPEAR, 'weaponR')]);
  SB.useSkill(ctx, st, 'knight.haft');
  const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.strictEqual(e.skill.hits.length, 2);
  assert.strictEqual(e.skill.hits[0].zone, 'head'); assert.notStrictEqual(e.skill.hits[1].zone, 'head');
  assert.ok(!(st.me.cd || {})['knight.haft'], 'без перезарядки');
  assert.strictEqual(SB.skillBlock(st, 'knight.haft'), '', 'можна знову наступного ходу');
});

test('Благословення: −50 мани, броня +20%, лікує 4% щоходу, 🎲 4–7 ходів на 100%', () => {
  const st = battle({ 'knight.bless': 1 }, ['knight.bless'], [wear(ARMOR, 'armor')]);
  st.me.force = 100; const m0 = st.me.mana;
  SB.useSkill(ctx, st, 'knight.bless');
  const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.strictEqual(e.skill.kind, 'bless'); assert.strictEqual(st.me.mana, m0 - 50);
  assert.ok(e.skill.turns >= 4 && e.skill.turns <= 7);
  assert.strictEqual(e.blessHeal, Math.round(st.me.max * 0.04));
  assert.strictEqual(SB.skillBlock(st, 'knight.bless'), 'active');
  assert.strictEqual(S.skillValues('knight.bless', 25).heal, 1);
});

test('Незворушність: Лицар — урон +1 концентрації, без урону −1; на 100% втримує ~50%', () => {
  let kept = 0, tries = 0;
  for (let k = 0; k < 60; k++) {
    const st = battle({ 'base.focus': 1, 'knight.calm': 1 }, []);
    st.me.fx.focus = 3; st.op.p.accuracy = 1;                  // суперник майже не влучає → хід без урону
    const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
    if (e.opHit.dmg === 0 && e.calm) { tries++; if (e.calm[2]) { kept++; assert.strictEqual(st.me.fx.focus, 3); } else assert.strictEqual(st.me.fx.focus, 2); }
  }
  assert.ok(tries > 20 && kept > tries * 0.3 && kept < tries * 0.7, kept + '/' + tries);
});

test('Парирування: шанс за видом зброї; кнутом — ніяк', () => {
  assert.strictEqual(SB.PARRY.sword, 20); assert.strictEqual(SB.PARRY.spear, 15); assert.strictEqual(SB.PARRY.staff, 15); assert.strictEqual(SB.PARRY.axe, 6);
  assert.ok(!SB.PARRY.whip && !SB.PARRY.knuckles);
  let parried = 0;
  for (let k = 0; k < 80; k++) {
    const st = battle({ 'knight.parry': 1 }, [], [wear(SWORD, 'weaponR')]); st.op.p.accuracy = 900;
    const e = SB.turn(ctx, st, { atk: 'head', block: 'legs' }, {}, Date.now());
    parried += e.opHit.hits.filter(h => h.skillParry).length;
  }
  assert.ok(parried > 3, 'мечем парирує: ' + parried);
  const w = battle({ 'knight.parry': 1 }, [], [wear(WHIP, 'weaponR')]); w.op.p.accuracy = 900;
  for (let i = 0; i < 20 && w.status === 'live'; i++) assert.ok(!SB.turn(ctx, w, { atk: 'head', block: 'legs' }, {}, Date.now()).opHit.hits.some(h => h.skillParry));
});

test('Обеззброєння: до ударів, суперник без зброї 2 ходи, двічі поспіль не вибити', () => {
  let done = null;
  for (let k = 0; k < 40 && !done; k++) {
    const st = battle({ 'knight.disarm': 1, 'knight.sword': 1 }, ['knight.disarm'], [wear(SWORD, 'weaponR')], [wear(SWORD, 'weaponR')]);
    SB.useSkill(ctx, st, 'knight.disarm');
    const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
    assert.ok(e.skill.need >= 10 && e.skill.need <= 90);
    if (e.skill.ok) done = { st, e };
  }
  assert.ok(done, 'спрацювало');
  assert.ok(done.e.opDisarmed);
  assert.ok(SB.disarmedOn(done.st), 'наступного ходу ще без зброї');
  SB.turn(ctx, done.st, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.ok(!SB.disarmedOn(done.st), 'через хід підібрав');
});

test('Протидія і Збити з пантелику: значення', () => {
  assert.strictEqual(S.skillValues('knight.riposte', 100).chance, 6);
  assert.strictEqual(S.skillValues('knight.daze', 100).dmgMul, 50);
  const st = battle({ 'knight.daze': 1 }, ['knight.daze'], [wear(SWORD, 'weaponR')]);
  st.op.fx.focus = 3; SB.useSkill(ctx, st, 'knight.daze');
  const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  if (e.skill.kind === 'hit') assert.strictEqual(st.op.fx.focus, 0);
});

/* ── два бійці: вміння працюють і в бота (дзеркальний погляд) ── */
function botKnight(opSk, opBar, opEq, heroEq) {
  const sk = {}; const skv = skvOf(opSk);
  const p = R.fighter({ health: 400, accuracy: 60, agility: 50, mana: 500 }, opEq || [], K);
  return SB.create(ctx, { bid: 'bk-' + (n++),
    me: { name: 'Я', stats: { health: 400, accuracy: 60, agility: 50, mana: 50 }, eq: heroEq || [], sk, skv: {}, bar: [], cls: 'knight' },
    op: { f: { name: 'Бот', level: 10 }, p, eq: opEq || [], sk: opSk, skv, bar: opBar || [], cls: 'knight', mana: 500 } });
}
test('бот-Лицар: пасивні — у профіль; Берсерк бота — лють і −100 мани; Поштовх бота збиває Героя', () => {
  const a = botKnight({ 'knight.sword': 1 }, [], [wear(SWORD, 'weaponR')]), b = botKnight({}, [], [wear(SWORD, 'weaponR')]);
  assert.strictEqual(a.op.p.dmgPct - b.op.p.dmgPct, 10, 'Меч бота: +10% урону');
  const st = botKnight({ 'knight.berserk': 1 }, ['knight.berserk']);
  st.op.skill = 'knight.berserk';
  const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.strictEqual(e.opSkill && e.opSkill.kind, 'buff');
  assert.strictEqual(st.op.mana, 400);
  assert.ok(st.op.fx.berserk >= st.round - 1 + 3);
  let knocked = false;
  for (let k = 0; k < 40 && !knocked; k++) {
    const s2 = botKnight({ 'knight.bash': 1 }, ['knight.bash'], [wear(SHIELD, 'weaponL')]);
    s2.op.skill = 'knight.bash';
    const e2 = SB.turn(ctx, s2, { atk: 'head', block: 'legs' }, {}, Date.now());
    if (e2.opSkill && e2.opSkill.knock) { knocked = true; const e3 = SB.turn(ctx, s2, { atk: 'head', block: 'legs' }, {}, Date.now()); assert.strictEqual(e3.meHit.kind, 'knock', 'Героя збито — не атакує'); }
  }
  assert.ok(knocked, 'Поштовх бота збиває Героя');
});
test('бот обеззброює Героя: Герой без зброї, Випад недоступний; вдягнув сам — одразу знову зброя', () => {
  let st = null;
  for (let k = 0; k < 60 && !st; k++) {
    const s = botKnight({ 'knight.disarm': 1 }, ['knight.disarm'], [wear(SWORD, 'weaponR')], [wear(SWORD, 'weaponR', 'hw')]);
    s.me.sk = { 'knight.lunge': 1 }; s.me.skv = skvOf({ 'knight.lunge': 1 }); s.me.bar = ['knight.lunge'];
    s.op.skill = 'knight.disarm';
    const e = SB.turn(ctx, s, { atk: 'head', block: 'body' }, {}, Date.now());
    if (e.opSkill && e.opSkill.ok) { assert.ok(e.meDisarmed); st = s; }
  }
  assert.ok(st, 'бот вибив зброю');
  assert.strictEqual(SB.skillBlock(st, 'knight.lunge'), 'weapon', 'меч вибито — Випаду немає');
  assert.ok(SB.swap(ctx, st, 'weaponR', { uid: 'hw', id: 'W1', bonus: 1, durMax: 500, durCur: 500 }, SWORD), 'вдягнув знову');
  assert.strictEqual(SB.skillBlock(st, 'knight.lunge'), 'swap', 'вдягання — дія ходу: вміння цього ходу вже ні');
  st.op.skill = null; SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.strictEqual(SB.skillBlock(st, 'knight.lunge'), '', 'наступного ходу зброя в руці — Випад знову можна');
});

test('бот із розумом: сам бере вміння (не частіше за use%), росте в межах бою від бази', () => {
  const sw = S.skillValues('knight.sword', 50);
  const st = botKnight({ 'knight.sword': 0.5, 'knight.lunge': 0.5 }, ['knight.lunge'], [wear(SWORD, 'weaponR')]);
  st.op.ai = { use: 100, smart: false };
  st.op.up = { 'knight.lunge': [{ u: 1, pct: 51, v: S.skillValues('knight.lunge', 51) }], 'knight.sword': [{ u: 1, pct: 51, v: S.skillValues('knight.sword', 51) }] };
  let used = 0, up = [];
  for (let i = 0; i < 6 && st.status === 'live'; i++) {
    const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
    if (e.opSkill && e.opSkill.id === 'knight.lunge') used++;
    if (e.opUp) up = up.concat(e.opUp.map(x => x[0]));
  }
  assert.ok(used >= 5, 'use 100% — Випад щоходу: ' + used);
  assert.ok(up.includes('knight.lunge'), 'Випад підріс до 51%');
  assert.strictEqual(Math.round(st.op.sk['knight.lunge'] * 100), 51);
  assert.ok(sw.accPct >= 0);
  const st0 = botKnight({ 'knight.lunge': 0.5 }, ['knight.lunge'], [wear(SWORD, 'weaponR')]); st0.op.ai = { use: 0 };
  for (let i = 0; i < 5; i++) assert.ok(!SB.turn(ctx, st0, { atk: 'head', block: 'body' }, {}, Date.now()).opSkill, 'use 0% — без вмінь');
});
test('досвід × складність суперника (лише перемога / нічия)', () => {
  const st = botKnight({}, []); st.op.f.xpMul = 1.5; st.op.force = 1; st.op.p.agility = 1; st.me.p.accuracy = 900;
  let e; for (let i = 0; i < 10 && st.status === 'live'; i++) e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  if (st.summary.result === 'win') assert.strictEqual(st.summary.xpMul, 1.5);
});

/* ── вміння 18–22 рівня ── */
function duel(sk, bar, opSk, opEq, meEq) {
  const oe = opEq || [];
  return SB.create(ctx, {
    bid: 'kn2-' + (n++),
    me: { name: 'Я', stats: { health: 400, accuracy: 60, agility: 50, mana: 500 }, eq: meEq || [], sk, skv: skvOf(sk), bar, cls: 'knight' },
    op: { f: { name: 'Бот', level: 20 }, p: R.fighter({ health: 400, accuracy: 50, agility: 50, mana: 0 }, oe, K), eq: oe, sk: opSk || {}, skv: skvOf(opSk || {}), cls: 'knight' }
  });
}

test('Кам\'яна шкіра: −50 мани лише коли вдалося, 🎲 7–10 ходів урон по тобі −30% (на 100%), поки діє — не обрати', () => {
  const st = battle({ 'knight.stoneskin': 1 }, ['knight.stoneskin'], [wear(ARMOR, 'armor')]);
  SB.useSkill(ctx, st, 'knight.stoneskin');
  const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.strictEqual(e.skill.kind, 'stone'); assert.strictEqual(e.skill.cut, 30);
  assert.ok(e.skill.turns >= 7 && e.skill.turns <= 10, 'ходів: ' + e.skill.turns);
  assert.strictEqual(st.me.fx.stone.until, e.skill.turns);
  assert.strictEqual(st.me.mana, 450);
  assert.strictEqual(SB.skillBlock(st, 'knight.stoneskin'), 'active');
  let cut = 0;
  for (let i = 0; i < 3 && st.status === 'live'; i++) {
    const e2 = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
    (e2.opHit.hits || []).forEach(h => { if (h.stone) { cut++; assert.strictEqual(h.dmg, Math.max(1, Math.round(h.stone[0] * 0.7))); } });
  }
  (e.opHit.hits || []).forEach(h => { if (h.stone) cut++; });
  assert.ok(cut >= 1, 'урон зменшено хоч раз: ' + cut);
  const t25 = S.skillValues('knight.stoneskin', 25);
  assert.strictEqual(t25.turnsMin, 3); assert.strictEqual(t25.turnsMax, 5); assert.strictEqual(t25.cut, 15);
});

test('Бойова пісня: −50 мани, 🎲 7–10 ходів точність +30% і урон +20% (на 100%); урон додається до Берсерка', () => {
  const st = battle({ 'knight.song': 1 }, ['knight.song'], [wear(SWORD, 'weaponR')]);
  SB.useSkill(ctx, st, 'knight.song');
  const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.strictEqual(e.skill.kind, 'song'); assert.strictEqual(e.skill.accPct, 30); assert.strictEqual(e.skill.dmgPct, 20);
  assert.ok(e.skill.turns >= 7 && e.skill.turns <= 10);
  assert.strictEqual(st.me.mana, 450); assert.strictEqual(st.me.fx.song.until, e.skill.turns);
  assert.strictEqual(SB.skillBlock(st, 'knight.song'), 'active');
  const t25 = S.skillValues('knight.song', 25); assert.strictEqual(t25.turnsMin, 3); assert.strictEqual(t25.turnsMax, 5);
});

test('Залізна воля (пасивне): здоров\'я < 20% — сама з шансом 50→100%, броня +50→100% на 3 ходи, потім перезарядка 10', () => {
  const st = battle({ 'knight.will': 1 }, [], [wear(ARMOR, 'armor')]);
  const e0 = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.ok(!e0.will, 'здоров\'я повне — не спрацьовує');
  const q = battle({ 'knight.will': 1 }, [], [wear(ARMOR, 'armor')]); q.me.force = Math.round(q.me.max * 0.3);
  assert.ok(!SB.turn(ctx, q, { atk: 'head', block: 'body' }, {}, Date.now()).will, '30% — ще ні');
  st.me.force = Math.round(st.me.max * 0.15);
  const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.ok(e.will && e.will.ok); assert.strictEqual(e.will.turns, 3); assert.strictEqual(e.will.pct, 100);
  assert.strictEqual(st.me.fx.will, 2 + 3 - 1); assert.strictEqual(st.me.cd['knight.will'], 2 + 10);
  assert.strictEqual(st.me.grow['knight.will'], 1);
  assert.strictEqual(S.byId('knight.will').type, 'P');
  const v25 = S.skillValues('knight.will', 25); assert.strictEqual(v25.chance, 50); assert.strictEqual(v25.armorPct, 50);
  const bs = S.bookState({ skillBar: ['knight.will', 'knight.berserk', null, null, null] });
  assert.strictEqual(bs.bar[0], null, 'стало пасивним — з панелі прибирається'); assert.strictEqual(bs.bar[1], 'knight.berserk');
});

test('Обеззброєння ботом: зброя Героя летить у сумку; вдягнути знову — перевдяганням', () => {
  let st = null;
  for (let i = 0; i < 60 && !st; i++) {
    const t = duel({}, [], { 'knight.disarm': 1, 'knight.sword': 1 }, [wear(SWORD, 'weaponR', 'bw')], [wear(SWORD, 'weaponR', 'hw')]);
    t.op.bar = ['knight.disarm']; t.op.ai = { use: 100, smart: false };
    const e = SB.turn(ctx, t, { atk: 'head', block: 'body' }, {}, Date.now());
    if (e.opSkill && e.opSkill.kind === 'disarm') st = t;
  }
  assert.ok(st, 'бот вибив зброю');
  const w = st.me.eq.filter(e => e.uid === 'hw')[0];
  assert.ok(w.off, 'зброя в сумці'); assert.strictEqual(st.me.p.wMax, 0);
  st.round++; st.op.bar = [];
  assert.ok(SB.swap(ctx, st, 'weaponR', w.inst, SWORD), 'вдягнув сам');
  assert.ok(!w.off && st.me.p.wMax > 0);
});

test('Розбити щит: лише проти щита; щит відлітає на цей і наступний хід, потім повертається сам', () => {
  const none = duel({ 'knight.shieldbreak': 1 }, ['knight.shieldbreak'], {}, [], [wear(AXE, 'weaponR')]);
  assert.strictEqual(SB.skillBlock(none, 'knight.shieldbreak'), 'noshield', 'без щита — не марнує хід');
  SB.useSkill(ctx, none, 'knight.shieldbreak');
  assert.ok(!SB.turn(ctx, none, { atk: 'head', block: 'body' }, {}, Date.now()).skill);
  assert.ok(!(none.me.cd || {})['knight.shieldbreak'], 'без щита — перезарядки немає');
  const st = duel({ 'knight.shieldbreak': 1 }, ['knight.shieldbreak'], {}, [wear(SHIELD, 'weaponL')], [wear(AXE, 'weaponR')]);
  SB.useSkill(ctx, st, 'knight.shieldbreak');
  const e1 = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.strictEqual(e1.skill.kind, 'shatter'); assert.strictEqual(e1.skill.turns, 2);
  assert.ok(e1.opNoShield); assert.strictEqual(st.op.fx.shieldOff, 2);
  assert.strictEqual(st.me.cd['knight.shieldbreak'], 1 + 4);
  const e2 = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.ok(e2.opNoShield, 'наступний хід — теж без щита');
  const e3 = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
  assert.ok(!e3.opNoShield && e3.opShieldBack, 'потім щит повертається');
});

test('Стійкість ворога рятує від «Розбити щит» (~75% на 100%) і росте в нього', () => {
  let saved = 0, all = 0;
  for (let i = 0; i < 300; i++) {
    const st = duel({ 'knight.shieldbreak': 1 }, ['knight.shieldbreak'], { 'knight.steady': 1 }, [wear(SHIELD, 'weaponL')], [wear(AXE, 'weaponR')]);
    SB.useSkill(ctx, st, 'knight.shieldbreak');
    const e = SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
    all++; if (e.skill.kind === 'saved') saved++;
    assert.ok(e.skill.steady && e.skill.steady[1] === 75);
  }
  assert.ok(saved > all * 0.65 && saved < all * 0.85, saved + '/' + all);
});

test('Стійкість Героя: встояти на ногах проти Поштовху бота (росте ✔/✖)', () => {
  let tries = 0;
  for (let i = 0; i < 200 && !tries; i++) {
    const st = duel({ 'knight.steady': 1 }, [], { 'knight.bash': 1 }, [wear(SHIELD, 'weaponL')]);
    st.op.bar = ['knight.bash']; st.op.ai = { use: 100, smart: false };
    for (let t = 0; t < 6 && st.status === 'live'; t++) SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now());
    tries = (st.me.grow['knight.steady'] || 0) + (st.me.growF['knight.steady'] || 0);
  }
  assert.ok(tries > 0, 'Стійкість спрацювала проти збити з ніг');
});

test('Ріст за рівень: до класу +4❤️/+4💧, лицар +6/+3, чарівник +3/+6; лише з 2-го рівня', () => {
  const lb = (lv, c) => JSON.stringify(R.levelBonus(lv, c)), o = (h, m) => JSON.stringify({ health: h, mana: m });
  assert.strictEqual(lb(1, 'knight'), o(0, 0));
  assert.strictEqual(lb(2, 'knight'), o(4, 4), '2-й рівень — ще до класу');
  assert.strictEqual(lb(19, 'knight'), o(4 + 17 * 6, 4 + 17 * 3));
  assert.strictEqual(lb(19, 'mage'), o(4 + 17 * 3, 4 + 17 * 6));
  assert.strictEqual(lb(19, null), o(18 * 4, 18 * 4), 'без класу');
  const h = { health: 254, mana: 381, arena: { level: 19 }, heroClass: 'knight' };
  const s = R.heroStatsOf(h);
  assert.strictEqual(s.health, 254 + 106); assert.strictEqual(s.mana, 381 + 55);
  assert.strictEqual(R.heroStatsOf(h, 1, null).health, 254, 'рівень і клас можна передати явно');
});

test('Розбити щит: шанс за зброєю — сокира ×1, булава/кистень/посох ×0.85, меч ×0.7; спис чи кинджал — ніяк', () => {
  const MACE = item({ id: 'W7', name: 'Булава', category: 'Зброя', stat: 'Урон', valueMin: 4, valueMax: 6, weaponType: 'mace' });
  const need = w => { const st = duel({ 'knight.shieldbreak': 1 }, ['knight.shieldbreak'], {}, [wear(SHIELD, 'weaponL')], [wear(w, 'weaponR')]);
    SB.useSkill(ctx, st, 'knight.shieldbreak'); return SB.turn(ctx, st, { atk: 'head', block: 'body' }, {}, Date.now()).skill.need; };
  assert.strictEqual(need(AXE), 100); assert.strictEqual(need(MACE), 85); assert.strictEqual(need(SWORD), 70);
  const sp = duel({ 'knight.shieldbreak': 1 }, ['knight.shieldbreak'], {}, [wear(SHIELD, 'weaponL')], [wear(SPEAR, 'weaponR')]);
  assert.strictEqual(SB.skillBlock(sp, 'knight.shieldbreak'), 'weapon');
  const TWO = item({ id: 'W8', name: 'Дворучний меч', category: 'Зброя', stat: 'Урон', valueMin: 4, valueMax: 6, weaponType: 'sword', addStats: [{ stat: 'Дворучний', flag: true }] });
  assert.ok(R.isTwoHanded(TWO));
  assert.strictEqual(need(TWO), 88, 'дворучний меч — ×0.7 × 1.25 ≈ ×0.88');
  const st25 = duel({ 'knight.shieldbreak': 0.25 }, ['knight.shieldbreak'], {}, [wear(SHIELD, 'weaponL')], [wear(AXE, 'weaponR')]);
  SB.useSkill(ctx, st25, 'knight.shieldbreak');
  assert.strictEqual(SB.turn(ctx, st25, { atk: 'head', block: 'body' }, {}, Date.now()).skill.need, 50);
});

/* ── етап 2: Оглушливий удар і Захльост ── */
const MACE2 = item({ id: 'W8', name: 'Булава', category: 'Зброя', stat: 'Урон', valueMin: 4, valueMax: 6, weaponType: 'mace' });
const FLAIL = item({ id: 'W9', name: 'Кистень', category: 'Зброя', stat: 'Урон', valueMin: 4, valueMax: 6, weaponType: 'flail' });
const HIT = { atk: 'head', block: 'body' };
const sharp = (st) => { st.me.p.accuracy = 5000; st.op.p.agility = 1; return st; };

test('Оглушливий удар і Захльост — лише своєю зброєю', () => {
  const ok = (id, w) => SB.skillBlock(battle({ [id]: 1 }, [id], w ? [wear(w, 'weaponR')] : []), id);
  assert.strictEqual(ok('knight.stun', MACE2), ''); assert.strictEqual(ok('knight.stun', FLAIL), '');
  assert.strictEqual(ok('knight.stun', SWORD), 'weapon'); assert.strictEqual(ok('knight.stun', WHIP), 'weapon'); assert.strictEqual(ok('knight.stun', null), 'weapon');
  assert.strictEqual(ok('knight.lash', WHIP), ''); assert.strictEqual(ok('knight.lash', FLAIL), '');
  assert.strictEqual(ok('knight.lash', MACE2), 'weapon'); assert.strictEqual(ok('knight.lash', SWORD), 'weapon');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(S.skillValues('knight.stun', 25))), { chance: 50, cd: 3, stun: 20 });
  assert.strictEqual(S.skillValues('knight.stun', 100).stun, 40);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(S.skillValues('knight.lash', 100))), { chance: 100, dmgMul: 75, agi: 40, turns: 2 });
  assert.strictEqual(S.skillValues('knight.lash', 25).turns, 1);
});

test('Оглушливий удар: влучив — ворог пропускає наступний хід (💫), далі 2 ходи імунітету; перезарядка 3', () => {
  let st, e, got = false;
  for (let k = 0; k < 60 && !got; k++) {
    st = sharp(duel({ 'knight.stun': 1 }, ['knight.stun'], {}, [], [wear(MACE2, 'weaponR')]));
    SB.useSkill(ctx, st, 'knight.stun');
    e = SB.turn(ctx, st, HIT, {}, Date.now());
    assert.strictEqual(e.skill.id, 'knight.stun');
    assert.strictEqual(e.skill.hits[0].zone, 'head', 'у зону атаки');
    assert.strictEqual(st.me.cd['knight.stun'], 1 + 3, 'перезарядка 3');
    if (e.skill.stun) got = true; else assert.ok(e.skill.stunNeed === 40 || e.skill.kind !== 'hit');
  }
  assert.ok(got, 'за 60 спроб хоч раз оглушив (40%)');
  const r = st.round;
  assert.strictEqual(st.op.fx.knock, r); assert.strictEqual(st.op.fx.stun, r); assert.strictEqual(st.op.fx.stunImm, r + 2);
  e = SB.turn(ctx, st, HIT, {}, Date.now());
  assert.strictEqual(e.opHit.kind, 'knock'); assert.ok(e.opHit.stun, 'позначено як оглушення, не «збитий з ніг»');
  // імунітет: ще 2 ходи після пропущеного оглушити не можна
  st.me.cd = {}; SB.useSkill(ctx, st, 'knight.stun');
  e = SB.turn(ctx, st, HIT, {}, Date.now());
  if (e.skill && e.skill.kind === 'hit') assert.ok(e.skill.stunImmune && !e.skill.stun, 'імунітет');
});

test('Оглушливий удар: Стійкість ворога рятує', () => {
  let saved = 0;
  for (let k = 0; k < 120; k++) {
    const st = sharp(duel({ 'knight.stun': 1 }, ['knight.stun'], { 'knight.steady': 1 }, [], [wear(MACE2, 'weaponR')]));
    SB.useSkill(ctx, st, 'knight.stun');
    const e = SB.turn(ctx, st, HIT, {}, Date.now());
    if (e.skill.stunSaved) { saved++; assert.ok(!st.op.fx.stun && e.skill.steady[2]); }
  }
  assert.ok(saved > 0, 'Стійкість хоч раз врятувала');
});

test('Захльост: удар ×0.75 повз щит (шанс блоку щита не діє), влучив — спритність ворога −40% на 2 ходи з наступного', () => {
  const BIG = item({ id: 'S9', name: 'Великий щит', category: 'Щити', stat: 'Броня', valueMin: 2, valueMax: 2, addStats: [{ stat: 'Шанс блоку', value: 100 }] });
  let st, e, got = false;
  for (let k = 0; k < 30 && !got; k++) {
    st = sharp(duel({ 'knight.lash': 1 }, ['knight.lash'], {}, [wear(BIG, 'weaponL')], [wear(WHIP, 'weaponR')]));
    SB.useSkill(ctx, st, 'knight.lash');
    e = SB.turn(ctx, st, HIT, {}, Date.now());
    assert.ok(e.skill.aroundShield, 'огинає щит');
    assert.ok(!(e.skill.hits[0].kind === 'block' && e.skill.hits[0].byChance), 'шанс блоку щита не спрацьовує');
    if (e.skill.tangle) got = true;
  }
  assert.ok(got, 'сплутав');
  const r = st.round;
  assert.deepStrictEqual(JSON.parse(JSON.stringify(st.op.fx.tangle)), { from: r, until: r + 1, agi: 40 });
  assert.ok(!(st.me.cd || {})['knight.lash'], 'без перезарядки');
});

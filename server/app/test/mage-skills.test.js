/* 🔮 Чарівник, етап 1 (docs/PLAN-mage.md): закляття, Медитація, Магічна броня, Спалах, Щит, Потік мани, концентрація */
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
const STAFF = item({ id: 'ST1', name: 'Посох', category: 'Зброя', stat: 'Магічний урон', valueMin: 4, valueMax: 6, weaponType: 'staff' });
const MSHIELD = item({ id: 'MS', name: 'Маг. щит', category: 'Щити', stat: 'Магічний захист', valueMin: 2, valueMax: 2, addStats: [{ stat: 'Шанс блоку', value: 100 }] });
const wear = (base, slot) => ({ base, inst: { uid: base.id + slot, id: base.id, slot, bonus: 1, durMax: 500, durCur: 500 } });
const skvOf = (sk) => { const o = {}; Object.keys(sk || {}).forEach(id => { o[id] = S.skillValues(id, Math.round(sk[id] * 100)); }); return o; };
let n = 0;
function battle(sk, bar, o) {
  o = o || {};
  const st = SB.create(ctx, {
    bid: 'mg-' + (n++),
    me: { name: 'Я', stats: { health: 400, accuracy: 60, agility: 50, mana: o.mana != null ? o.mana : 500 }, eq: o.eq || [], sk, skv: skvOf(sk), bar, cls: 'mage' },
    op: { f: { name: 'Бот', level: 3 }, p: R.fighter({ health: 400, accuracy: 50, agility: 50, mana: 0 }, o.opEq || [], K) }
  });
  st.op.p.wMin = 0; st.op.p.wMax = 0;                      // бот б'є слабко, щоб не заважав рахувати
  return st;
}
const HIT = { atk: 'head', block: 'body' };
const go = (st, ch) => SB.turn(ctx, st, ch || HIT, {}, Date.now());
/* хід, у якому бот точно не влучить у блок: захищаємо іншу зону, ніж він б'є (botChoice — з зерна бою) */
const open = (st) => { const a = SB.botChoice(st).atk; return { atk: 'head', block: ['head', 'body', 'arms', 'legs'].filter(z => z !== a)[0] }; };
const STAGE1 = ['mage.staff', 'mage.dagger', 'mage.missile', 'mage.medit', 'mage.clear', 'mage.marmor', 'mage.burn', 'mage.calm',
  'mage.blind', 'mage.chill', 'mage.shield', 'mage.sight', 'mage.bolt'];

test('Чарівник етап 1: у кожного вміння правила, значок і опис', () => {
  const ready = S.readyFor('mage').map(s => s.id);
  STAGE1.forEach(id => {
    const s = S.byId(id);
    assert.ok(s && s.ready, id + ' готове');
    assert.ok(S.effectText(id, 0.5), id + ' опис');
    assert.ok(s.icon && s.icon !== '🔮' || id === 'mage.shield', id + ' значок');
    assert.ok(ready.includes(id), id + ' у списку готових');
  });
  assert.strictEqual(S.byId('mage.blind').name, 'Спалах');
  assert.strictEqual(S.byId('mage.calm').name, 'Холодний розум');
  assert.ok(!S.byId('mage.scrolls'), 'Сувої мага — перевага класу, окремого вміння немає (є загальне)');
  assert.deepStrictEqual(S.skillValues('mage.dagger', 60), S.skillValues('knight.dagger', 60), 'Кинджал — спільний з Лицарем');
  const perks = R.CLASS_PERKS.mage.map(p => p.id);
  ['conc', 'manaFlow', 'scrollPro'].forEach(id => assert.ok(perks.includes(id), id));
});

test('Магічна стріла: завжди влучає (ні ухилення, ні блоку зони, ні криту), −5 мани, урон 8–14', () => {
  for (let k = 0; k < 20; k++) {
    const st = battle({ 'mage.missile': 0.9 }, ['mage.missile']);
    st.op.p.agility = 100000; st.op.p.critPct = 0;
    assert.ok(SB.useSkill(ctx, st, 'mage.missile'));
    const m0 = st.me.mana, e = go(st, { atk: 'head', block: 'body' });
    const sk = e.skill;
    if (sk.kind === 'fail') { assert.strictEqual(st.me.mana > m0 - 5, true, 'не вдалося — мана не знята'); continue; }
    assert.strictEqual(sk.kind, 'hit');
    assert.ok(sk.dmg >= 8 && sk.dmg <= 14, 'урон ' + sk.dmg);
    assert.ok(!sk.hits.some(h => h.crit), 'без криту');
    assert.strictEqual(sk.mana, 5);
  }
});

test('Закляття: шанс маг. блоку щита блокує; Блискавка проходить крізь щит', () => {
  const st = battle({ 'mage.missile': 1 }, ['mage.missile'], { opEq: [wear(MSHIELD, 'weaponL')] });
  SB.useSkill(ctx, st, 'mage.missile');
  const e = go(st);
  assert.strictEqual(e.skill.kind, 'block', 'щит із маг. блоком 100% — стріла заблокована');
  const st2 = battle({ 'mage.bolt': 0.5 }, ['mage.bolt'], { opEq: [wear(MSHIELD, 'weaponL')] });
  st2.me.skv['mage.bolt'].chance = 100;
  SB.useSkill(ctx, st2, 'mage.bolt');
  const e2 = go(st2);
  assert.strictEqual(e2.skill.kind, 'hit', 'Блискавка — крізь шанс блоку');
  assert.ok(e2.skill.dmg >= 1);
});

test('Урон заклять: × (1 + % маг. урону + 5%·K), маг. захист і опір стихії зменшують; Кам\'яна шкіра — ні', () => {
  const st = battle({ 'mage.burn': 1 }, ['mage.burn']);
  st.me.skv['mage.burn'].dmgMin = 20; st.me.skv['mage.burn'].dmgMax = 20; st.me.skv['mage.burn'].burn = 0;
  st.me.p.magPct = 50;
  SB.useSkill(ctx, st, 'mage.burn');
  let e = go(st);
  assert.strictEqual(e.skill.dmg, 30, '20 × 150%');
  st.op.p.resFire = 50;                                     // опір з речей — щонайбільше 33%
  e = go(st);
  assert.strictEqual(e.skill.dmg, 20, '30 × 67% опору вогню');
  assert.strictEqual(e.skill.hits[0].res, 33);
  st.op.p.resFire = 0; st.op.fx.stone = { until: 99, cut: 30 };
  e = go(st);
  assert.strictEqual(e.skill.dmg, 30, 'Кам\'яна шкіра закляття не зменшує');
});

test('Палюча долоня: горіння −3% 2 ходи (цей і наступний), не накопичується; Стійкість не рятує', () => {
  const st = battle({ 'mage.burn': 1 }, ['mage.burn']);
  st.me.skv['mage.burn'].burn = 100;
  SB.useSkill(ctx, st, 'mage.burn');
  const e1 = go(st);
  assert.ok(e1.skill.burn, 'підпалив');
  assert.strictEqual(e1.burn, 12, '3% від 400');
  SB.useSkill(ctx, st, null);
  const e2 = go(st);
  assert.strictEqual(e2.burn, 12, 'другий хід горить');
  const e3 = go(st);
  assert.ok(!e3.burn, 'третього — ні');
  // новий підпал — лише продовжує
  const st2 = battle({ 'mage.burn': 1 }, ['mage.burn']); st2.me.skv['mage.burn'].burn = 100;
  SB.useSkill(ctx, st2, 'mage.burn'); go(st2); const e4 = go(st2);
  assert.strictEqual(e4.burn, 12, 'один тік за хід, а не два');
});

test('Крижаний дотик: 2 наступні ходи спритність ворога −30% (на 100%)', () => {
  const st = battle({ 'mage.chill': 1 }, ['mage.chill']);
  SB.useSkill(ctx, st, 'mage.chill');
  const e = go(st);
  assert.ok(e.skill.chill);
  const vo = { me: st.op, op: st.me, round: st.round };
  const p = SB.turnBoost(vo, st.op.p);
  assert.strictEqual(p.agility, Math.round(st.op.p.agility * 0.7));
  assert.ok(SB.chillOn(st.op, st.round + 1) && !SB.chillOn(st.op, st.round + 2));
});

test('Блискавка: з 75% — другий розряд ×0.5; оглушення струмом — наступного ходу ворог на 1 удар менше', () => {
  const st = battle({ 'mage.bolt': 1 }, ['mage.bolt']);
  st.me.skv['mage.bolt'].zap = 100;
  SB.useSkill(ctx, st, 'mage.bolt');
  const e = go(st);
  assert.strictEqual(e.skill.hits.length, 2, 'два розряди');
  assert.ok(e.skill.zap, 'оглушив струмом');
  st.op.p.extra = 1;
  const vo = { me: st.op, op: st.me, round: st.round };
  assert.strictEqual(SB.turnBoost(vo, st.op.p).extra, 0, 'на 1 удар менше');
  st.op.p.extra = 0;
  assert.ok(SB.turnBoost(vo, st.op.p).noExtra, 'один удар — без Другої й Третьої атаки');
  const st2 = battle({ 'mage.bolt': 0.5 }, ['mage.bolt']); st2.me.skv['mage.bolt'].chance = 100;
  SB.useSkill(ctx, st2, 'mage.bolt');
  assert.strictEqual(go(st2).skill.hits.length, 1, 'на 50% — один розряд');
});

test('Медитація: хід без удару; мана +20%, концентрація +2; перезарядка 3', () => {
  const st = battle({ 'mage.medit': 1, 'base.focus': 1 }, ['mage.medit']);
  st.me.mana = 100;
  SB.useSkill(ctx, st, 'mage.medit');
  const e = go(st);
  assert.strictEqual(e.skill.kind, 'medit');
  assert.strictEqual(e.meHit.kind, 'medit', 'без удару');
  assert.strictEqual(e.skill.manaAdd, 100, '20% від 500');
  assert.strictEqual(st.me.fx.focus, 2);
  assert.strictEqual(SB.skillBlock(st, 'mage.medit'), 'cd');
});

test('Магічна броня: маг. захист +40% на 8 ходів, −25 мани; поки діє — знову не обрати', () => {
  const st = battle({ 'mage.marmor': 1 }, ['mage.marmor']);
  st.me.p.magicResist = 50;
  SB.useSkill(ctx, st, 'mage.marmor');
  const m0 = st.me.mana, e = go(st);
  assert.strictEqual(e.skill.kind, 'marmor');
  assert.strictEqual(e.skill.turns, 8);
  assert.ok(st.me.mana <= m0 - 25 + 30, 'мана знята (+ Потік мани)');
  assert.strictEqual(SB.turnBoost(st, st.me.p).magicResist, 70);
  assert.strictEqual(SB.skillBlock(st, 'mage.marmor'), 'active');
});

test('Спалах: точність ворога −40% на 5 ходів; Стійкість ворога може врятувати', () => {
  const st = battle({ 'mage.blind': 1 }, ['mage.blind']);
  SB.useSkill(ctx, st, 'mage.blind');
  const e = go(st);
  assert.strictEqual(e.skill.kind, 'flash');
  const vo = { me: st.op, op: st.me, round: st.round };
  assert.strictEqual(SB.turnBoost(vo, st.op.p).accuracy, Math.round(st.op.p.accuracy * 0.6));
  assert.strictEqual(SB.skillBlock(st, 'mage.blind'), 'cd');
  const st2 = battle({ 'mage.blind': 1 }, ['mage.blind']);
  st2.op.sk = { 'knight.steady': 1 }; st2.op.skv = { 'knight.steady': { resist: 100 } };
  SB.useSkill(ctx, st2, 'mage.blind');
  const e2 = go(st2);
  assert.strictEqual(e2.skill.kind, 'flashSaved');
  assert.strictEqual(e2.skill.mana, 30, 'мана знята');
});

test('Зосередженість: +1 за хід із закляттям; −1, коли втратив ≥ 5% здоров\'я; Холодний розум — поріг 5% → 15%', () => {
  const st = battle({ 'mage.missile': 1, 'base.focus': 1 }, ['mage.missile']);
  SB.useSkill(ctx, st, 'mage.missile');
  go(st); go(st); go(st);
  assert.strictEqual(st.me.fx.focus, 3, '+1 щоходу');
  SB.useSkill(ctx, st, null); go(st);
  assert.strictEqual(st.me.fx.focus, 3, 'без закляття — без змін');
  st.op.p.wMin = 60; st.op.p.wMax = 60; st.op.p.accuracy = 100000; st.op.p.critPct = 0;
  const e = go(st, open(st));
  assert.ok(e.opHit.dmg >= 40, 'втратив ≥ 5%');
  assert.strictEqual(st.me.fx.focus, 2, '−1');
  // Холодний розум: на 100% втрата менше 15% уже не збиває
  const st2 = battle({ 'mage.missile': 1, 'base.focus': 1, 'mage.calm': 1 }, ['mage.missile']);
  st2.me.fx.focus = 3; st2.op.p.wMin = 30; st2.op.p.wMax = 30; st2.op.p.accuracy = 100000; st2.op.p.critPct = 0;
  const e2 = go(st2, open(st2));
  assert.ok(e2.opHit.dmg >= 20 && e2.opHit.dmg < 60);
  assert.strictEqual(st2.me.fx.focus, 3, 'нижче 15% — не спадає');
});

test('Потік мани: щоходу +2% макс. мани × (1 + 0.25·K); не вище максимуму', () => {
  const st = battle({}, []);
  st.me.mana = 100;
  let e = go(st);
  assert.strictEqual(e.flow, 10, '2% від 500');
  st.me.fx.focus = 4; st.me.mana = 100;
  e = go(st);
  assert.strictEqual(e.flow, 20, '×(1 + 0.25·4)');
  st.me.mana = 499; e = go(st);
  assert.strictEqual(st.me.mana, 500);
  const kn = SB.create(ctx, { bid: 'kn-' + (n++), me: { name: 'Я', stats: { health: 400, accuracy: 60, agility: 50, mana: 500 }, eq: [], sk: {}, skv: {}, bar: [], cls: 'knight' },
    op: { f: { name: 'Бот', level: 3 }, p: R.fighter({ health: 400, accuracy: 50, agility: 50, mana: 0 }, [], K) } });
  kn.me.mana = 100; assert.ok(!go(kn).flow, 'у Лицаря — ні');
});

test('Щит — комірка: ловить удар і тримає; більший витісняє менший у тіло; скинути — −10 мани; вимкнув — удар у тіло', () => {
  const st = battle({ 'mage.shield': 0.9 }, ['mage.shield']);
  st.op.p.wMin = 30; st.op.p.wMax = 30; st.op.p.accuracy = 100000; st.op.p.critPct = 0;
  assert.ok(SB.useSkill(ctx, st, 'mage.shield'));
  assert.ok(!SB.mshDump(st), 'комірка порожня — скидати нічого');
  const hp0 = st.me.force, e = go(st, open(st));
  const d1 = e.msh.dmg;
  assert.ok(d1 > 0 && st.me.force === hp0, 'урону немає — удар у комірці');
  // наступний хід: удар не скидали — лежить далі; новий удар тієї ж сили (не більший) — у тіло
  const hp1 = st.me.force, e2 = go(st, open(st));
  assert.strictEqual(SB.mshCells(st.me.fx)[0].dmg, d1, 'комірка тримає старий удар');
  assert.ok(e2.msh.cells[0] === d1 && e2.msh.small[0] > 0 && hp1 - st.me.force >= e2.msh.small[0], 'менший/рівний — пройшов у тіло');
  // більший удар — старий іде в тіло, новий у комірку
  st.op.p.wMin = 60; st.op.p.wMax = 60;
  const hp2 = st.me.force, e3 = go(st, open(st));
  assert.ok(e3.msh.dmg > d1 && e3.msh.rel === d1, 'більший витіснив');
  assert.strictEqual(hp2 - st.me.force, d1, 'у тіло — лише старий');
  // скинути: −10 мани на початку ходу, дію ходу не забирає
  st.op.p.wMin = 0; st.op.p.wMax = 0;
  assert.ok(SB.mshDump(st));
  const m = st.me.mana, e4 = go(st, open(st));
  assert.strictEqual(e4.mshDue.paid, 10);
  assert.ok(!SB.mshCells(st.me.fx).length || (e4.msh && SB.mshCells(st.me.fx)[0].dmg === e4.msh.dmg && e4.msh.dmg < e3.msh.dmg), 'старий удар поглинуто (у комірці — хіба що новий удар цього ходу)');
  // вимкнув Щит — удар із комірки в тіло
  const st2 = battle({ 'mage.shield': 0.9 }, ['mage.shield']);
  st2.op.p.wMin = 30; st2.op.p.wMax = 30; st2.op.p.accuracy = 100000; st2.op.p.critPct = 0;
  SB.useSkill(ctx, st2, 'mage.shield');
  const h = go(st2, open(st2)).msh.dmg;
  SB.useSkill(ctx, st2, 'mage.shield'); st2.op.p.wMin = 0; st2.op.p.wMax = 0;
  const hp3 = st2.me.force, e5 = go(st2, open(st2));
  assert.ok(e5.mshOff && e5.mshOff.dmg === h);
  assert.ok(hp3 - st2.me.force >= h, 'урон прийшов');
  // скінчилась мана — Щит вимкнувся сам, удар у тіло
  const st3 = battle({ 'mage.shield': 0.9 }, ['mage.shield']);
  st3.op.p.wMin = 30; st3.op.p.wMax = 30; st3.op.p.accuracy = 100000; st3.op.p.critPct = 0;
  SB.useSkill(ctx, st3, 'mage.shield'); go(st3, open(st3));
  st3.me.mana = 0; st3.op.p.wMin = 0; st3.op.p.wMax = 0;
  const e6 = go(st3, open(st3));
  assert.ok(e6.mshOff, 'без мани — вимкнувся, удар у тіло');
});

test('Щит на 100%: дві комірки — ловить два удари; скинути за хід лише один (найбільший); вимкнув — обидва в тіло', () => {
  const st = battle({ 'mage.shield': 1 }, ['mage.shield']);
  st.op.p.wMin = 30; st.op.p.wMax = 30; st.op.p.accuracy = 100000; st.op.p.critPct = 0; st.op.p.extra = 1;   // два удари за хід
  SB.useSkill(ctx, st, 'mage.shield');
  const hp0 = st.me.force, e = go(st, open(st));
  assert.strictEqual(e.msh.caught.length, 2, 'узяв обидва удари');
  assert.strictEqual(st.me.force, hp0, 'урону немає');
  assert.strictEqual(SB.mshCells(st.me.fx).length, 2);
  st.op.p.wMin = 0; st.op.p.wMax = 0; st.op.p.extra = 0; st.op.p.accuracy = 1; st.me.p.agility = 100000;
  assert.ok(SB.mshDump(st));
  const m0 = st.me.mana, e2 = go(st, open(st));
  assert.strictEqual(e2.mshDue.paid, 10);
  assert.strictEqual(e2.mshDue.left, 1, 'за хід скинуто лише один');
  assert.ok(SB.mshCells(st.me.fx).length >= 1);
  const left = SB.mshCells(st.me.fx).reduce((a, c) => a + c.dmg, 0);
  SB.useSkill(ctx, st, 'mage.shield');                       // вимкнути — усе з комірок у тіло
  const hp1 = st.me.force, e3 = go(st, open(st));
  assert.strictEqual(e3.mshOff.dmg, left);
  assert.ok(hp1 - st.me.force >= left);
  assert.strictEqual(SB.mshCells(st.me.fx).length, 0);
});

test('Перевага «Майстер сувоїв» і Ясний розум (страх)', () => {
  const SC = item({ id: 'SC', name: 'Сувій', category: 'Сувій', stat: 'Магічний урон', valueMin: 20, valueMax: 20, consumable: true });
  const st = battle({}, []);
  st.op.p.magicResist = 0;
  const r = SB.applyUse(ctx, st, st.me, st.op, 'me', { uid: 'u1', id: 'SC', base: SC, bonus: 1 }, () => 0.5);
  assert.strictEqual(r.fx[0].hit.raw, 25, '20 × 125%');
  const FEAR = item({ id: 'FE', name: 'Сувій страху', category: 'Сувій', addStats: [{ stat: 'Страх', value: 1 }], consumable: true });
  const st2 = battle({ 'mage.clear': 1 }, []);
  const r2 = SB.applyUse(ctx, st2, st2.op, st2.me, 'op', { uid: 'u2', id: 'FE', base: FEAR, bonus: 1 }, () => 0.99);
  assert.strictEqual(r2.fx[0].clear, 60);
  assert.strictEqual(r2.fx[0].need, 36, '90% × 40%');
});

test('Посох: + маг. урону ударів магічним посохом, закляття не підсилює', () => {
  const st = battle({ 'mage.staff': 1, 'mage.missile': 1 }, ['mage.missile'], { eq: [wear(STAFF, 'weaponR')] });
  assert.strictEqual(st.me.p.staffPct, 20);
  assert.ok(st.me.p.magPct >= 20);
  st.me.skv['mage.missile'].dmgMin = 10; st.me.skv['mage.missile'].dmgMax = 10;
  SB.useSkill(ctx, st, 'mage.missile');
  const e = go(st);
  assert.strictEqual(e.skill.dmg, 10, 'стріла без бонусу Посоха');
});

test('Бот-Чарівник: розумний вибір — Медитація, коли мало мани', () => {
  const st = SB.create(ctx, {
    bid: 'bm-' + (n++),
    me: { name: 'Я', stats: { health: 400, accuracy: 60, agility: 50, mana: 100 }, eq: [], sk: {}, skv: {}, bar: [], cls: 'knight' },
    op: { f: { name: 'Бот', level: 11 }, p: R.fighter({ health: 400, accuracy: 50, agility: 50, mana: 0 }, [], K), cls: 'mage', mana: 300,
      sk: { 'mage.medit': 1, 'mage.missile': 1 }, skv: skvOf({ 'mage.medit': 1, 'mage.missile': 1 }), bar: ['mage.medit', 'mage.missile'], ai: { use: 100, smart: true } }
  });
  st.op.mana = 10;
  const e = go(st);
  assert.strictEqual(e.opSkill && e.opSkill.id, 'mage.medit');
  assert.ok(e.opFlow > 0, 'Потік мани — і в бота-Чарівника');
});

test('Щит ловить КІНЦЕВИЙ урон — після броні, % і опорів (те, що пішло б у тіло)', () => {
  const mk = (bid, sk, bar) => {
    const st = SB.create(ctx, { bid, me: { name: 'Я', stats: { health: 400, accuracy: 60, agility: 50, mana: 500 }, eq: [], sk, skv: skvOf(sk), bar, cls: 'mage' },
      op: { f: { name: 'Бот', level: 3 }, p: R.fighter({ health: 400, accuracy: 50, agility: 50, mana: 0 }, [], K) } });
    st.op.p.wMin = 40; st.op.p.wMax = 40; st.op.p.accuracy = 100000; st.op.p.critPct = 0;
    st.me.p.armor = 30; st.me.p.resSlash = 20; st.me.p.resBash = 20;          // броня й опір зменшують удар
    return st;
  };
  const a = mk('same-bid', { 'mage.shield': 0.9 }, ['mage.shield']), b = mk('same-bid', {}, []);
  SB.useSkill(ctx, a, 'mage.shield');
  const ch = open(a), ea = SB.turn(ctx, a, ch, {}, Date.now()), eb = SB.turn(ctx, b, ch, {}, Date.now());
  const plain = Math.max.apply(null, eb.opHit.hits.map(h => h.dmg || 0));
  assert.ok(plain > 0 && plain < 48, 'броня й опір зменшили удар: ' + plain);
  assert.strictEqual(ea.msh.dmg, plain, 'у комірці — рівно той урон, що пішов би в тіло');
});

test('Холодний розум: поріг 5% на 25% → 15% на 100%; без вміння — 5%', () => {
  assert.strictEqual(S.skillValues('mage.calm', 25).thr, 5);
  assert.strictEqual(S.skillValues('mage.calm', 100).thr, 15);
  const st = battle({ 'mage.missile': 1, 'base.focus': 1 }, ['mage.missile']);
  st.me.fx.focus = 3; st.op.p.wMin = 18; st.op.p.wMax = 18; st.op.p.accuracy = 100000; st.op.p.critPct = 0;
  const e = go(st, open(st));
  assert.ok(e.opHit.dmg >= 20 && e.opHit.dmg < 40, 'втратив 5–10%: ' + e.opHit.dmg);
  assert.strictEqual(st.me.fx.focus, 2, 'без Холодного розуму вже ≥ 5% збиває');
});

test('Ріст: Магічний зір +1 за бій; Щит без ударів по тобі не росте (ні ✔, ні ✖)', () => {
  const st = battle({ 'mage.sight': 0.5, 'mage.shield': 0.9 }, ['mage.shield']);
  assert.strictEqual(st.me.grow['mage.sight'], 1, 'Магічний зір — +1 на старті бою');
  SB.useSkill(ctx, st, 'mage.shield');
  st.op.p.accuracy = 1; st.me.p.agility = 100000;              // бот не влучає
  let caught = 0; for (let k = 0; k < 6; k++) { const e = go(st, open(st)); if (e.msh) caught++; }
  const g = (st.me.grow || {})['mage.shield'] || 0, f = (st.me.growF || {})['mage.shield'] || 0;
  assert.strictEqual(g + f, caught, 'ріст лише в ходи, коли по тобі влучили (' + caught + '), а не щоходу');
});

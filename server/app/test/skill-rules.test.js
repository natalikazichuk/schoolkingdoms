// Правила вмінь (sk-skills.js → skillValues) і кожне з 12 вмінь у бою (sk-battle.js).
const test = require('node:test');
const assert = require('node:assert');
const path = require('path'), fs = require('fs'), vm = require('vm');
const ROOT = path.join(__dirname, '../../..');
const box = { window: {}, console };
box.window.window = box.window;
['sk-items.js', 'sk-arena-rules.js', 'sk-skills.js', 'sk-battle.js'].forEach(f => vm.runInNewContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), box.window, { filename: f }));
const R = box.window.SKARENA, K = box.window.SKIT, SB = box.window.SKBATTLE, S = box.window.SKSKILLS;
const ctx = { R, K };
const SHIELD = { id: 'S1', name: 'Щит', category: 'Щити', stat: 'Броня', valueMin: 1, valueMax: 1, addStats: [] };
const SPOON = { id: 'X1', name: 'Ложка', category: 'Зброя', weaponType: 'exotic', stat: 'Урон', valueMin: 2, valueMax: 4, addStats: [] };
const SWORD = { id: 'W1', name: 'Меч', category: 'Зброя', stat: 'Урон', valueMin: 2, valueMax: 4, addStats: [] };
const POTION = { id: 'P1', name: 'Зілля', category: 'Зелья', consumable: true, addStats: [{ stat: "Відновлення здоров'я", value: 20 }] };
const SCROLL = { id: 'Q1', name: 'Свиток', category: 'Свиток', consumable: true, stat: 'Магічний урон', valueMin: 10, valueMax: 10, addStats: [] };

function battle(pct, o) {
  o = o || {};
  const sk = {}, skv = {};
  Object.keys(pct).forEach(id => { sk[id] = pct[id] / 100; skv[id] = S.skillValues(id, pct[id]); });
  return SB.create(ctx, {
    bid: o.bid || 'r' + Math.random().toString(36).slice(2),
    me: { name: 'Я', stats: { health: o.hp || 3000, accuracy: 60, agility: 50, mana: 500 }, eq: o.eq || [], belt: o.belt || [], sk, skv, bar: o.bar || [] },
    op: { f: { name: 'Бот', level: 3 }, p: R.fighter({ health: 3000, accuracy: o.opAcc || 200, agility: 50, mana: 0 }, [], K) }
  });
}
const hit = (st, c) => SB.turn(ctx, st, c || { atk: 'head', block: 'legs' }, {}, Date.now());

test('правила: активні — шанс 50% на 25% → 100% на 100%; урон × м; збити з ніг 5% → 10%', () => {
  assert.strictEqual(S.skillValues('base.kick', 25).chance, 50);
  assert.strictEqual(S.skillValues('base.kick', 50).chance, 67);
  assert.strictEqual(S.skillValues('base.kick', 100).chance, 100);
  assert.strictEqual(S.skillValues('base.kick', 25).dmgMin, 1, '5 × 0,25 = 1,25 → 1');
  assert.strictEqual(S.skillValues('base.kick', 25).dmgMax, 2, '10 × 0,25 = 2,5 → 2 (вниз)');
  assert.strictEqual(S.skillValues('base.kick', 100).dmgMax, 10);
  assert.strictEqual(S.skillValues('base.spark', 25).dmgMax, 2);
  assert.strictEqual(S.skillValues('base.kick', 25).knock, 5);
  assert.strictEqual(S.skillValues('base.kick', 100).knock, 10);
  assert.strictEqual(S.skillValues('base.kick', 25).cd, 2, 'перезарядка — стала');
  assert.strictEqual(S.skillValues('base.spark', 25).mana, 5, 'мана — стала');
});
test('правила: пасивні сталі × м; пасивні з кидком — прокидаються з шансом = майстерність', () => {
  assert.strictEqual(S.skillValues('base.weapons', 25).dmgPct, 6);
  assert.strictEqual(S.skillValues('base.potions', 25).powerPct, 12);
  // максимум — лише на 100%: Торгівля 20% × 0,98 = 19,6 → 19, а не вже 20
  assert.strictEqual(S.skillValues('base.trade', 98).pct, 19);
  assert.strictEqual(S.skillValues('base.trade', 100).pct, 20);
  assert.strictEqual(S.skillValues('base.dodge', 40).engage, 40);
  assert.strictEqual(S.skillValues('base.dodge', 40).chance, 15, 'шанс ефекту — сталий');
  assert.strictEqual(S.skillValues('base.focus', 49).cap, 3);
  assert.strictEqual(S.skillValues('base.focus', 50).cap, 4);
  assert.strictEqual(S.skillValues('base.focus', 100).cap, 5);
});
test('ріст: спрацювань до 100% = боїв × спрацювань за бій', () => {
  Object.keys(S.RULES).forEach(id => assert.strictEqual(S.growTotal(S.byId(id)), Math.round(S.GROWTH.battles * S.RULES[id].perBattle), id));
});

test('Пінок на 25% вдається приблизно в половині спроб', () => {
  let ok = 0, n = 400;
  for (let i = 0; i < n; i++) {
    const st = battle({ 'base.kick': 25 }, { bar: ['base.kick'], bid: 'k' + i });
    SB.useSkill(ctx, st, 'base.kick');
    const e = hit(st); if (e.skill && e.skill.ok) ok++;
  }
  assert.ok(ok > n * 0.4 && ok < n * 0.6, 'вдалих ' + ok + ' з ' + n);
});

test('ухилення: очко лише коли прокинулось; ухиляється ≈ 15% прокинутих', () => {
  let landed = 0, dodged = 0, pts = 0;
  for (let i = 0; i < 60; i++) {
    const st = battle({ 'base.dodge': 100 }, { bid: 'd' + i });
    for (let t = 0; t < 5; t++) {
      const e = hit(st);
      (e.opHit.hits || []).forEach(h => { if (h.kind === 'hit' || h.kind === 'crit' || h.skillDodge) landed++; if (h.skillDodge) dodged++; });
    }
    pts += (st.me.grow['base.dodge'] || 0) + (st.me.growF['base.dodge'] || 0);
  }
  assert.strictEqual(pts, landed, 'на 100% прокидається завжди — очко за кожен удар, що влучив');
  assert.ok(dodged > landed * 0.07 && dodged < landed * 0.25, 'ухилився ' + dodged + ' з ' + landed);
  let landed25 = 0, pts25 = 0;
  for (let i = 0; i < 60; i++) {
    const st = battle({ 'base.dodge': 25 }, { bid: 'e' + i });
    for (let t = 0; t < 5; t++) (hit(st).opHit.hits || []).forEach(h => { if (h.kind === 'hit' || h.kind === 'crit' || h.skillDodge) landed25++; });
    pts25 += (st.me.grow['base.dodge'] || 0) + (st.me.growF['base.dodge'] || 0);
  }
  assert.ok(pts25 > landed25 * 0.12 && pts25 < landed25 * 0.4, 'на 25% прокидається ≈ чверть: ' + pts25 + ' з ' + landed25);
});

test('щит: блокує вмінням лише зі щитом у лівій руці', () => {
  let blocks = 0, pts = 0;
  for (let i = 0; i < 60; i++) {
    const st = battle({ 'base.shield': 100 }, { bid: 's' + i, eq: [{ base: SHIELD, inst: { uid: 'sh', id: 'S1', slot: 'weaponL' } }] });
    for (let t = 0; t < 5; t++) (hit(st).opHit.hits || []).forEach(h => { if (h.skillShield) blocks++; });
    pts += (st.me.grow['base.shield'] || 0) + (st.me.growF['base.shield'] || 0);
  }
  assert.ok(blocks > 0, 'блоків щитом: ' + blocks);
  assert.ok(pts > blocks, 'очки й за невдалі спроби');
  const bare = battle({ 'base.shield': 100 }, { bid: 'sb' });
  for (let t = 0; t < 10; t++) (hit(bare).opHit.hits || []).forEach(h => assert.ok(!h.skillShield));
  assert.ok(!bare.me.grow['base.shield'] && !bare.me.growF['base.shield'], 'без щита — не росте');
});

test('щит: блок шансом речей зі щитом теж дає вдале очко вміння', () => {
  const BIG = Object.assign({}, SHIELD, { id: 'S2', addStats: [{ stat: 'Шанс блоку', value: 100 }] });
  const st = battle({ 'base.shield': 25 }, { bid: 'sbig', eq: [{ base: BIG, inst: { uid: 'sh2', id: 'S2', slot: 'weaponL' } }] });
  let itemBlocks = 0;
  for (let t = 0; t < 8; t++) (hit(st).opHit.hits || []).forEach(h => { if (h.kind === 'block' && h.byChance && !h.evade) itemBlocks++; });
  assert.ok(itemBlocks > 0, 'блоки речами були');
  assert.ok((st.me.grow['base.shield'] || 0) >= itemBlocks, 'кожен блок речами — вдале очко');
});

test('концентрація: спокійні ходи → рівні до стелі, +5% урону за рівень; урон скидає', () => {
  const st = battle({ 'base.focus': 100 }, { opAcc: 1, bid: 'f100' });   // суперник майже не влучає; сталий бій — без випадкових падінь тесту
  for (let t = 0; t < 10; t++) hit(st);
  assert.ok(st.me.fx.focus >= 3 && st.me.fx.focus <= 5, 'рівень ' + st.me.fx.focus);
  const low = battle({ 'base.focus': 25 }, { opAcc: 1, bid: 'f25' });
  for (let t = 0; t < 40; t++) hit(low);
  assert.ok(low.me.fx.focus <= 3, 'на 25% стеля 3');
});

test('зброя й екзотика: екзотичний бонус лише з екзотичною зброєю, обидва ростуть з ударів', () => {
  const ex = battle({ 'base.exotic': 100, 'base.weapons': 100 }, { eq: [{ base: SPOON, inst: { uid: 'sp', id: 'X1', slot: 'weaponR' } }] });
  const sw = battle({ 'base.exotic': 100, 'base.weapons': 100 }, { eq: [{ base: SWORD, inst: { uid: 'sw', id: 'W1', slot: 'weaponR' } }] });
  assert.strictEqual(ex.me.p.dmgPct - sw.me.p.dmgPct, 50);
  for (let t = 0; t < 5; t++) { hit(ex); hit(sw); }
  assert.ok((ex.me.grow['base.exotic'] || 0) + (ex.me.growF['base.exotic'] || 0) > 0);
  assert.ok(!sw.me.grow['base.exotic'] && !sw.me.growF['base.exotic'], 'не екзотична — не росте');
});

test('зв\'язок зі зброєю: з\'являється після 5 ходів однією зброєю, дає +10% на 100%', () => {
  const st = battle({ 'base.bond': 100 }, { eq: [{ base: SWORD, inst: { uid: 'sw', id: 'W1', slot: 'weaponR' } }] });
  for (let t = 0; t < 5; t++) { hit(st); assert.ok(!st.me.fx.bond, 'ще немає на ході ' + (t + 1)); }
  hit(st);
  assert.ok(st.me.fx.bond, 'на 6-му ході зв\'язок є');
  assert.ok((st.me.grow['base.bond'] || 0) + (st.me.growF['base.bond'] || 0) >= 1);
});

test('зілля: лікування сильніше на powerPct; свиток — урон сильніший', () => {
  const run = (pct, base) => {
    const st = battle(pct, { belt: [{ base, inst: { uid: 'b1', id: base.id, slot: 'belt0' } }] });
    assert.ok(SB.useBelt(ctx, st, 'b1'));
    return { e: hit(st), st };
  };
  const p0 = run({}, POTION).e.uses[0].fx[0], p1 = run({ 'base.potions': 100 }, POTION);
  assert.strictEqual(p0.pct, 20);
  assert.strictEqual(p1.e.uses[0].fx[0].pct, 30, '20 × 1,5');
  assert.strictEqual(p1.st.me.grow['base.potions'], 1);
  const s1 = run({ 'base.scrolls': 100 }, SCROLL);
  const h = s1.e.uses[0].fx[0].hit;
  assert.ok(h && (h.dmg > 0 || h.kind !== 'hit'), 'свиток спрацював');
  assert.strictEqual(s1.st.me.grow['base.scrolls'], 1);
});

test('нові назви категорій (27.10): «Сувій» і «Зілля» працюють так само, як старі «Свиток» і «Зелья»', () => {
  assert.ok(K.isScrollCat('Сувій') && K.isScrollCat('Свиток') && !K.isScrollCat('Зілля'));
  assert.strictEqual(K.catCanon('Зелья'), 'Зілля'); assert.strictEqual(K.catCanon('Свиток'), 'Сувій'); assert.strictEqual(K.catCanon('Щити'), 'Щити');
  assert.strictEqual(K.canon("Бар'єр"), 'barrier'); assert.strictEqual(K.canon('Барєр'), 'barrier');
  const NEW = Object.assign({}, SCROLL, { category: 'Сувій' });
  const run = (base) => {
    const st = battle({ 'base.scrolls': 100 }, { belt: [{ base, inst: { uid: 'b1', id: base.id, slot: 'belt0' } }] });
    assert.ok(SB.useBelt(ctx, st, 'b1'));
    hit(st); return st.me.grow['base.scrolls'];
  };
  assert.strictEqual(run(NEW), 1, 'сувій з новою категорією росте вміння «Сувої»');
  assert.strictEqual(run(SCROLL), 1, 'і зі старою');
  const pool = R.botBelt([NEW, Object.assign({}, SCROLL, { id: 'S2' })], K, () => 0.5);
  assert.ok(pool.length > 0, 'бот бере в пояс сувої з обома назвами категорії');
});

// Асортимент магазину: по одній речі з кожної категорії, решта — рівний кидок категорій (≤ 5 на категорію),
// «Торгівля» додає до +100% місць (речі й зілля/свитки).
const test = require('node:test');
const assert = require('node:assert');
const path = require('path'), fs = require('fs'), vm = require('vm');
const ROOT = path.join(__dirname, '../../..');
const box = { window: {}, console };
box.window.window = box.window;
['sk-items.js', 'sk-skills.js'].forEach(f => vm.runInNewContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), box.window, { filename: f }));
const K = box.window.SKIT, S = box.window.SKSKILLS;

// перекошений каталог: наручів 40, амулетів 2, решта по 5
const cat = [];
const add = (c, n) => { for (let i = 0; i < n; i++) cat.push({ id: c + i, name: c + i, category: c, price: 10, stat: 'Броня', valueMax: 1, addStats: [] }); };
K.store.SHOP_MAIN_CATS.forEach(c => add(c, c === 'Наручі' ? 40 : c === 'Амулет' ? 2 : 5));
for (let i = 0; i < 12; i++) cat.push({ id: 'pot' + i, name: 'Зілля' + i, category: 'Зелья', consumable: true, price: 5, addStats: [{ stat: "Відновлення здоров'я", value: 10 }] });
const count = (list, c) => list.filter(b => b.category === c).length;

test('кожна категорія — щонайменше одна річ, жодної — більше 5; наручі не задавлюють', () => {
  let bracers = 0, amulets = 0;
  for (let d = 0; d < 60; d++) {
    const st = K.store.shopStock(cat, 'hero' + d, Date.UTC(2026, 9, 1 + d, 12));
    assert.strictEqual(st.gear.length, 20);
    K.store.SHOP_MAIN_CATS.forEach(c => { const n = count(st.gear, c); assert.ok(n >= 1 && n <= 5, c + ': ' + n); });
    assert.strictEqual(st.cons.length, 5);
    bracers += count(st.gear, 'Наручі'); amulets += count(st.gear, 'Амулет');
  }
  assert.ok(bracers / 60 < 3, 'наручів у середньому < 3 на день: ' + (bracers / 60).toFixed(2));
  assert.ok(amulets / 60 >= 1.5, 'амулети є щодня (2 у каталозі): ' + (amulets / 60).toFixed(2));
});

test('той самий герой і день — той самий набір; «Торгівля» лише дописує місця', () => {
  const t = Date.UTC(2026, 9, 5, 12);
  const a = K.store.shopStock(cat, 'h', t), b = K.store.shopStock(cat, 'h', t);
  assert.deepStrictEqual(a.gear.map(x => x.id), b.gear.map(x => x.id));
  const full = K.store.shopStock(cat, 'h', t, { stockPct: 100 });
  assert.strictEqual(full.gear.length, 40); assert.strictEqual(full.cons.length, 10);
  assert.strictEqual(K.store.shopStock(cat, 'h', t, { stockPct: 98 }).gear.length, 39, '40 — лише на 100%');
  const half = K.store.shopStock(cat, 'h', t, { stockPct: 50 });
  assert.strictEqual(half.gear.length, 30);
  assert.deepStrictEqual(full.gear.slice(0, 20).map(x => x.id), a.gear.map(x => x.id), 'перші 20 — ті самі');
  K.store.SHOP_MAIN_CATS.forEach(c => assert.ok(count(full.gear, c) <= 5));
});

test('мало речей — менше місць, без повторів', () => {
  const small = cat.filter(b => b.category === 'Зброя' || b.consumable);
  const st = K.store.shopStock(small, 'h', Date.UTC(2026, 9, 5, 12), { stockPct: 100 });
  assert.strictEqual(st.gear.length, 5, 'лише 5 зброї');
  assert.strictEqual(new Set(st.gear.map(x => x.id)).size, st.gear.length);
});

test('Торгівля: +товарів 25% → 100% разом з майстерністю', () => {
  assert.strictEqual(S.skillValues('base.trade', 25).stockPct, 25);
  assert.strictEqual(S.skillValues('base.trade', 100).stockPct, 100);
  assert.strictEqual(S.skillValues('base.trade', 100).pct, 20, 'знижка лишилась');
});

test('кількість: зілля здоров\'я/мани 3–10, свитки 1–5, інші зілля 1–3', () => {
  const other = [];
  for (let i = 0; i < 8; i++) other.push({ id: 'luck' + i, name: 'Удача' + i, category: 'Зелья', consumable: true, price: 5, addStats: [{ stat: 'Шанс криту', value: 4, pct: true }] });
  const seen = {};
  for (let d = 0; d < 40; d++) {
    const st = K.store.shopStock(other, 'h' + d, Date.UTC(2026, 9, 1 + d, 12));
    st.cons.forEach(b => { const q = st.qty[b.id]; assert.ok(q >= 1 && q <= 3, b.id + ': ' + q); seen[q] = 1; });
  }
  assert.deepStrictEqual(Object.keys(seen).sort(), ['1', '2', '3']);
});

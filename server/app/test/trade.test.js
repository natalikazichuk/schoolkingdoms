// Вміння «Торгівля»: ціни магазину (sk-items.js) і підрахунок угод на сервері.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path'), fs = require('fs'), vm = require('vm');
const ROOT = path.join(__dirname, '../../..');
const box = { window: {}, console };
box.window.window = box.window;
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'sk-items.js'), 'utf8'), box.window, { filename: 'sk-items.js' });
const ST = box.window.SKIT.store;
const SWORD = { id: 'W1', name: 'Меч', category: 'Зброя', price: 1000, stat: 'Урон', valueMin: 1, valueMax: 2, addStats: [] };

test('купівля дешевша, продаж дорожчий на 20% × майстерність', () => {
  assert.strictEqual(ST.buyPrice(SWORD, 0), 1000);
  assert.strictEqual(ST.buyPrice(SWORD, 1), 800);
  assert.strictEqual(ST.buyPrice(SWORD, 0.5), 900);
  const inst = { id: 'W1', bonus: 1 };
  assert.strictEqual(ST.sellPrice(SWORD, inst), 100);
  assert.strictEqual(ST.sellPrice(SWORD, inst, 1), 120);
  assert.strictEqual(ST.sellPrice(SWORD, inst, 0.5), 110);
  assert.strictEqual(ST.buyPrice({ price: 1 }, 1), 1, 'не дешевше 1');
});

test('угода рахує гроші з урахуванням Торгівлі', () => {
  const st = { inventory: [{ uid: 'a', id: 'W1', bonus: 1 }], coins: 1000 };
  const byId = { W1: SWORD };
  const r = ST.deal(st, { sell: ['a'], buy: [SWORD] }, byId, Date.now(), { trade: 1 });
  assert.strictEqual(r.result.got, 120);
  assert.strictEqual(r.result.spent, 800);
  assert.strictEqual(r.state.coins, 1000 + 120 - 800);
  const r0 = ST.deal(st, { sell: ['a'] }, byId, Date.now());
  assert.strictEqual(r0.result.got, 100, 'без вміння — як раніше');
});

test('сервер: угоди лише за сьогодні', () => {
  const { tradeDeals } = require('../src/skills.js');
  const hero = { shopBought: [{ id: 'x', day: 'D' }, { id: 'y', day: 'old' }], shopSold: [{ inst: {}, day: 'D' }, { inst: {}, day: 'D' }] };
  assert.strictEqual(tradeDeals(hero, 'D'), 3);
  assert.strictEqual(tradeDeals({}, 'D'), 0);
});

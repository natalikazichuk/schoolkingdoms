/* Образ Героя (src/avatar.js): набір для генерації, файли образу, доступ воркера.
   Черга в PostgreSQL тут не перевіряється — лише те, що працює без бази. */
const test = require('node:test');
const assert = require('node:assert');
const sharp = require('sharp');
const A = require('../src/avatar');

const ITEMS = {
  'IT-001': { name: 'шляпа', category: 'Шоломи' },
  'IT-093': { name: 'Меч новачка', category: 'Зброя', weaponType: 'Меч' },
  'IT-102': { name: 'Дерев\'яний щит', category: 'Щити' },
  'IT-108': { name: 'Кільце сили', category: 'Кільце' }
};
const has = rel => rel !== 'img/items/IT-093.webp';   // у меча нема картинки
const hero = (avatar, worn, extra) => Object.assign({
  avatar,
  inventory: Object.keys(worn).map((slot, i) => ({ id: worn[slot], uid: 'u' + i, slot }))
}, extra || {});

test('база: вбудований герой, образ (з avatarGen.base), емодзі', () => {
  assert.strictEqual(A.baseOf({ avatar: 'hero:linen-boy-fight' }), 'linen-boy-fight');
  assert.strictEqual(A.baseOf({ avatar: 'hero:gen/abc-1', avatarGen: { base: 'linen-boy' } }), 'linen-boy');
  assert.strictEqual(A.baseOf({ avatar: '🦁' }), null);
});

test('набір: 10 слотів з підписами, кільця не малюємо, ліва рука — за категорією', () => {
  const s = A.buildSpec(hero('hero:linen-boy', { helmet: 'IT-001', weaponR: 'IT-093', weaponL: 'IT-102', ring1: 'IT-108', belt0: 'IT-001' }), ITEMS, has);
  assert.strictEqual(s.base, 'linen-boy');
  assert.strictEqual(s.baseImage, 'img/ava/linen-boy-base.webp');
  assert.strictEqual(s.total, 10);
  assert.strictEqual(s.filled, 3);
  assert.deepStrictEqual(s.slots.map(x => x.slot), A.SLOTS.map(x => x.slot));
  assert.ok(!s.slots.some(x => /^ring|^belt\d/.test(x.slot)));
  const by = Object.fromEntries(s.slots.map(x => [x.slot, x]));
  assert.strictEqual(by.helmet.label, 'головний убір');
  assert.deepStrictEqual(by.helmet.item, { id: 'IT-001', name: 'шляпа', category: 'Шоломи', weaponType: null, image: 'img/items/IT-001.webp' });
  assert.strictEqual(by.weaponR.item.image, null);
  assert.strictEqual(by.weaponL.label, 'щит у лівій руці');
  assert.strictEqual(by.boots.item, null);
  assert.match(s.prompt, /headwear: "шляпа"/);
  assert.match(s.prompt, /weapon held in the right hand: "Меч новачка" \(Меч\)/);
  assert.doesNotMatch(s.prompt, /Кільце/);
});

test('ключ: той самий набір — той самий ключ; кільця й зілля на поясі його не змінюють', () => {
  const k = w => A.buildSpec(hero('hero:linen-boy', w), ITEMS, has).key;
  const a = k({ helmet: 'IT-001', weaponR: 'IT-093' });
  assert.match(a, /^[0-9a-f]{24}$/);
  assert.strictEqual(k({ weaponR: 'IT-093', helmet: 'IT-001', ring1: 'IT-108', belt0: 'IT-001' }), a);
  assert.notStrictEqual(k({ helmet: 'IT-001' }), a);
  assert.notStrictEqual(A.buildSpec(hero('hero:linen-boy-fight', { helmet: 'IT-001', weaponR: 'IT-093' }), ITEMS, has).key, a);
});

test('без бази генерації немає: смайлик або аватар без -base.webp', () => {
  assert.throws(() => A.buildSpec(hero('🐯', {}), ITEMS, has), e => e.code === 'failed-precondition');
  assert.throws(() => A.buildSpec(hero('hero:knight-blue-boy', {}), ITEMS, r => !r.startsWith('img/ava/')),
    e => e.code === 'failed-precondition' && /базового/.test(e.message));
});

test('базові зображення Юного джури лежать на сайті й мають рамку обличчя', () => {
  for (const id of ['linen-boy', 'linen-boy-fight']) {
    assert.ok(A.buildSpec(hero('hero:' + id, {}), ITEMS).baseImage);
    assert.ok(A.FACE_BOX[id]);
  }
});

test('файли образу: пропорції бази, прозорість, аватарки 256/96', async () => {
  // «результат воркера»: квадрат 1024×1024 замість 578×1000 бази
  const out = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 200, g: 40, b: 40, alpha: 1 } } }).png().toBuffer();
  const f = await A.makeFiles(out, 'linen-boy-fight');
  const full = await sharp(f.full).metadata();
  assert.strictEqual(full.format, 'webp');
  assert.ok(Math.abs(full.width / full.height - 578 / 1000) < 0.01, `${full.width}×${full.height}`);
  assert.ok(full.hasAlpha);
  for (const [b, s] of [[f.face256, 256], [f.face96, 96]]) {
    const m = await sharp(b).metadata();
    assert.strictEqual(m.width, s); assert.strictEqual(m.height, s);
  }
  await assert.rejects(A.makeFiles(Buffer.from('не картинка'), 'linen-boy'), e => e.code === 'invalid-argument');
});

/* ---------- HTTP: воркер без токена не проходить (до бази не доходить) ---------- */
const { server } = require('../src/server');
function start() { return new Promise(ok => server.listen(0, '127.0.0.1', () => ok(server.address().port))); }
const post = (port, p, headers) => fetch(`http://127.0.0.1:${port}${p}`, {
  method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, headers || {}), body: '{}'
});

test('воркер: токен не налаштований → 503, чужий токен → 401', async () => {
  const port = await start();
  const was = process.env.AVATAR_WORKER_TOKEN;
  try {
    delete process.env.AVATAR_WORKER_TOKEN;
    let r = await post(port, '/api/avatar/worker/claim', { authorization: 'Bearer x' });
    assert.strictEqual(r.status, 503);
    process.env.AVATAR_WORKER_TOKEN = 'secret-token';
    r = await post(port, '/api/avatar/worker/claim', { authorization: 'Bearer wrong' });
    assert.strictEqual(r.status, 401);
    r = await post(port, '/api/avatar/worker/result');
    assert.strictEqual(r.status, 401);
    assert.strictEqual((await r.json()).error.code, 'unauthenticated');
  } finally {
    if (was === undefined) delete process.env.AVATAR_WORKER_TOKEN; else process.env.AVATAR_WORKER_TOKEN = was;
    server.close();
  }
});

test('образ без входу → 401', async () => {
  const port = await start();
  try {
    const r = await post(port, '/api/avatar/render');
    assert.strictEqual(r.status, 401);
  } finally { server.close(); }
});

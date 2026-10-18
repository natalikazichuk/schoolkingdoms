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
  // пряма й бойова поза джури — один набір (малюється в обох позах), тож і ключ один
  assert.strictEqual(A.buildSpec(hero('hero:linen-boy-fight', { helmet: 'IT-001', weaponR: 'IT-093' }), ITEMS, has).key, a);
});

test('дві пози: бойова база для вбудованого джури й для героя з фото', async () => {
  const s = A.buildSpec(hero('hero:linen-boy-fight', { helmet: 'IT-001' }), ITEMS, has);
  assert.strictEqual(s.base, 'linen-boy');
  assert.strictEqual(s.baseImage, 'img/ava/linen-boy-base.webp');
  assert.strictEqual(s.fightImage, 'img/ava/linen-boy-fight-base.webp');
  assert.strictEqual(A.standOf('linen-boy-fight'), 'linen-boy');
  assert.strictEqual(A.baseImageOf('gen/abc-1', 'fight'), 'img/ava/gen/abc-1-fight-base.webp');
  assert.strictEqual(A.baseImageOf('knight-blue-boy', 'fight'), null);
  // немає бойової бази — малюємо лише пряму
  const p = A.buildSpec({ avatar: 'hero:gen/abc-1', avatarGen: { base: 'gen/abc-1' }, inventory: [] }, ITEMS, r => r === 'img/ava/gen/abc-1-base.webp');
  assert.strictEqual(p.fightImage, null);
  // бойова поза — лише повний зріст (і межі бази для героя з фото)
  const out = await sharp({ create: { width: 1024, height: 1536, channels: 4, background: { r: 9, g: 9, b: 9, alpha: 1 } } }).png().toBuffer();
  const f = await A.makeFiles(out, 'linen-boy', 'fight');
  assert.deepStrictEqual(Object.keys(f).sort(), ['fight', 'fightRegion']);
  const m = await sharp(f.fightRegion).metadata();
  const b = await sharp(require('path').join(__dirname, '../../../img/ava/linen-boy-fight-base.webp')).metadata();
  assert.ok(Math.abs(m.width / m.height - b.width / b.height) < 0.01);
  assert.strictEqual(m.height, A.OUT_H);
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

test('файли образу: полотно з запасом — довга зброя не обрізається, обличчя влучає, зріст OUT_H', async () => {
  const cv = await A.canvasOf('linen-boy-fight', 'stand', true);
  assert.ok(cv.px > 0 && cv.pt > 0 && cv.W === cv.w + 2 * cv.px && cv.H === cv.h + cv.pt);
  // «результат воркера» на полотні: герой (сірий) у межах бази, кнут (червоний) далеко праворуч
  // за краєм бази, обличчя (синє) — у FACE_BOX
  const fb = A.FACE_BOX['linen-boy-fight'];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cv.W}" height="${cv.H}">`
    + `<rect x="${cv.px}" y="${cv.pt}" width="${cv.w}" height="${cv.h}" fill="#808080"/>`
    + `<rect x="${cv.px + cv.w - 10}" y="${cv.pt + 300}" width="${cv.px - 20}" height="12" fill="#ff0000"/>`
    + `<rect x="${cv.px + fb.left * cv.w}" y="${cv.pt + fb.top * cv.h}" width="${fb.size * cv.w}" height="${fb.size * cv.w}" fill="#0000ff"/></svg>`;
  const f = await A.makeFiles(await sharp(Buffer.from(svg)).png().toBuffer(), 'linen-boy-fight');
  const full = await sharp(f.full).metadata();
  assert.strictEqual(full.format, 'webp');
  assert.ok(full.hasAlpha);
  const k = A.OUT_H / cv.h;
  assert.ok(full.width > cv.w * k + 2 * (cv.px - 40) * k, `кнут обрізано: ${full.width}`);   // ширина вмістила кнут з обох боків
  assert.ok(full.height <= A.OUT_H + 10, `${full.height}`);                           // зверху порожньо — обрізано (лишається поле 8 px)
  // мініатюра — з обличчя (синя)
  const px = await sharp(f.face256).extract({ left: 128, top: 128, width: 1, height: 1 }).raw().toBuffer();
  assert.ok(px[2] > 200 && px[0] < 60, `обличчя не влучило: ${[...px]}`);
  for (const [b, s] of [[f.face256, 256], [f.face96, 96]]) {
    const m = await sharp(b).metadata();
    assert.strictEqual(m.width, s); assert.strictEqual(m.height, s);
  }
  // region — рівно межі бази (база для героя з фото)
  const r = await sharp(f.region).metadata();
  assert.ok(Math.abs(r.width / r.height - cv.w / cv.h) < 0.01);
  // старі завдання (без запасу): вписуємо в саму базу — ширина бази, порожнє зверху обрізано
  const old = await A.makeFiles(await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 200, g: 40, b: 40, alpha: 1 } } }).png().toBuffer(), 'linen-boy-fight', 'stand', false);
  const om = await sharp(old.full).metadata();
  assert.strictEqual(om.width, Math.round(cv.w * k), `${om.width}×${om.height}`);
  assert.ok(om.height < A.OUT_H);
  await assert.rejects(A.makeFiles(Buffer.from('не картинка'), 'linen-boy'), e => e.code === 'invalid-argument');
});

test('воркер отримує базу на полотні з запасом (файл у каталозі образів)', async () => {
  const dir = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'ava-'));
  const old = process.env.AVATAR_DIR; process.env.AVATAR_DIR = dir;
  try {
    const spec = A.buildSpec(hero('hero:linen-boy', { helmet: 'IT-001' }), ITEMS);
    const out = await A.absolute(spec, { headers: {} });
    assert.match(out.baseImage, /\/img\/ava\/gen\/canvas\/v1-linen-boy\.webp$/);
    assert.match(out.fightImage, /\/img\/ava\/gen\/canvas\/v1-linen-boy-fight\.webp$/);
    const m = await sharp(require('path').join(dir, 'canvas', 'v1-linen-boy-fight.webp')).metadata();
    const cv = await A.canvasOf('linen-boy', 'fight', true);
    assert.strictEqual(m.width, cv.W); assert.strictEqual(m.height, cv.H);
    // старе завдання (версія 2) — база як була
    const v2 = await A.absolute(Object.assign({}, spec, { version: 2 }), { headers: {} });
    assert.match(v2.baseImage, /\/img\/ava\/linen-boy-base\.webp$/);
  } finally {
    if (old === undefined) delete process.env.AVATAR_DIR; else process.env.AVATAR_DIR = old;
  }
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

test('колекція: старий образ із avatarGen, без дублів, новий — наверх, не більше COLLECTION_MAX', () => {
  const k = n => String(n).padStart(24, 'a');
  const gen = { status: 'ready', key: k(1), file: 'f1', base: 'linen-boy', readyAt: 5 };
  assert.deepStrictEqual(A.collectionOf({ avatarGen: gen }), [{ key: k(1), file: 'f1', base: 'linen-boy', at: 5 }]);
  assert.deepStrictEqual(A.collectionOf({ avatarGen: Object.assign({}, gen, { status: 'queued' }) }), []);
  // власна колекція вже є — avatarGen не додаємо (образ могли прибрати)
  assert.deepStrictEqual(A.collectionOf({ avatarGen: gen, avatarCollection: [] }), []);
  assert.deepStrictEqual(A.collectionOf({ avatarCollection: [{ key: 'bad', file: 'x', base: 'b' }, null] }), []);

  let h = { avatarCollection: [{ key: k(1), file: 'f1', base: 'b', at: 1 }, { key: k(2), file: 'f2', base: 'b', at: 2 }] };
  h.avatarCollection = A.addToCollection(h, { key: k(1), file: 'f1b', base: 'b', at: 3 });
  assert.deepStrictEqual(h.avatarCollection.map(x => x.file), ['f2', 'f1b']);
  for (let i = 10; i < 10 + A.COLLECTION_MAX; i++) h.avatarCollection = A.addToCollection(h, { key: k(i), file: 'g' + i, base: 'b', at: i });
  assert.strictEqual(h.avatarCollection.length, A.COLLECTION_MAX);
  assert.strictEqual(h.avatarCollection[0].file, 'g10');
});

test('герой з фото: фото → PNG ≤1024 px, база gen/<файл> бере рамку обличчя шаблону', async () => {
  const jpg = await sharp({ create: { width: 2000, height: 1500, channels: 3, background: '#c08060' } }).jpeg().toBuffer();
  const png = await A.photoPng('data:image/jpeg;base64,' + jpg.toString('base64'));
  const m = await sharp(png).metadata();
  assert.strictEqual(m.format, 'png');
  assert.strictEqual(m.width, 1024);
  await assert.rejects(A.photoPng(''), /Немає фото/);
  await assert.rejects(A.photoPng(Buffer.from('not an image').toString('base64')), /не зображення/);
  // новий герой — база для «Одягти»: має файл <файл>-base.webp у каталозі образів
  assert.strictEqual(A.baseOf({ avatar: 'hero:gen/abc-1', avatarGen: { kind: 'photo', base: 'gen/abc-1' } }), 'gen/abc-1');
  const has = rel => rel === 'img/ava/gen/abc-1-base.webp';
  const s = A.buildSpec({ avatar: 'hero:gen/abc-1', avatarGen: { base: 'gen/abc-1' }, inventory: [{ id: 'IT-001', slot: 'helmet' }] }, ITEMS, has);
  assert.strictEqual(s.baseImage, 'img/ava/gen/abc-1-base.webp');
});

test('OpenAI: запит редагування з двома картинками, помилки — зрозумілі', async () => {
  const O = require('../src/openai-image');
  const old = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'sk-test';
  try {
    let seen = null;
    const ok = async (url, init) => { seen = { url, init }; return { ok: true, status: 200, json: async () => ({ data: [{ b64_json: Buffer.from('PNG').toString('base64') }] }) }; };
    const out = await O.portrait(Buffer.from('t'), Buffer.from('p'), { fetch: ok });
    assert.strictEqual(out.toString(), 'PNG');
    assert.strictEqual(seen.url, 'https://api.openai.com/v1/images/edits');
    assert.strictEqual(seen.init.headers.Authorization, 'Bearer sk-test');
    assert.strictEqual(seen.init.body.getAll('image[]').length, 2);
    assert.strictEqual(seen.init.body.get('background'), 'transparent');
    const bad = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'safety system' } }) });
    await assert.rejects(O.portrait(Buffer.from('t'), Buffer.from('p'), { fetch: bad }), e => e instanceof O.ImageError && /safety system/.test(e.message) && !e.retry);
    delete process.env.OPENAI_API_KEY;
    await assert.rejects(O.portrait(Buffer.from('t'), Buffer.from('p'), { fetch: ok }), /OPENAI_API_KEY/);
  } finally {
    if (old === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = old;
  }
});

test('ключ OpenAI: з адмінки має перевагу над .env; перевірка ключа; адмінка без входу → 401', async () => {
  const O = require('../src/openai-image');
  const settings = require('../src/settings');
  const old = process.env.OPENAI_API_KEY;
  try {
    delete process.env.OPENAI_API_KEY;
    assert.strictEqual(O.configured(), false);
    assert.strictEqual(O.keySource(), null);
    process.env.OPENAI_API_KEY = 'sk-env';
    assert.strictEqual(O.apiKey(), 'sk-env');
    assert.strictEqual(O.keySource(), 'env');
    // ключ з адмінки (кеш settings; у базу тест не ходить) має перевагу
    const get = settings.get;
    settings.get = k => k === O.KEY_SETTING ? 'sk-admin' : null;
    try {
      assert.strictEqual(O.apiKey(), 'sk-admin');
      assert.strictEqual(O.keySource(), 'admin');
    } finally { settings.get = get; }
  } finally {
    if (old === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = old;
  }
  const res = (status) => async () => ({ ok: status === 200, status });
  assert.strictEqual(await O.checkKey('sk-x', { fetch: res(200) }), 'ok');
  assert.strictEqual(await O.checkKey('sk-x', { fetch: res(401) }), 'invalid');
  assert.strictEqual(await O.checkKey('sk-x', { fetch: res(500) }), 'unknown');
  assert.strictEqual(await O.checkKey('sk-x', { fetch: async () => { throw new Error('offline'); } }), 'unknown');

  const port = await start();
  try {
    let r = await fetch(`http://127.0.0.1:${port}/api/admin/openai`);
    assert.strictEqual(r.status, 401);
    r = await post(port, '/api/admin/openai');
    assert.strictEqual(r.status, 401);
  } finally { server.close(); }
});

test('«Одягти GPT»: доступ за логіном/іменем, окремий ключ, промпт з номерами картинок, полотно ↔ розмір OpenAI', async () => {
  assert.ok(A.gptAllowed({ login: 'vova' }));
  assert.ok(A.gptAllowed({ login: 'x', name: 'Testim' }));
  assert.ok(!A.gptAllowed({ login: 'petro', name: 'Петро' }));
  const old = process.env.AVATAR_GPT_HEROES;
  process.env.AVATAR_GPT_HEROES = 'ira';
  try { assert.ok(A.gptAllowed({ login: 'IRA' })); assert.ok(!A.gptAllowed({ login: 'vova' })); }
  finally { if (old === undefined) delete process.env.AVATAR_GPT_HEROES; else process.env.AVATAR_GPT_HEROES = old; }

  const spec = A.buildSpec(hero('hero:linen-boy', { helmet: 'IT-001', weaponR: 'IT-093', weaponL: 'IT-102' }), ITEMS, has);
  const k = A.gptKey(spec.key);
  assert.match(k, /^[0-9a-f]{24}$/);
  assert.notStrictEqual(k, spec.key);

  // речі — одним аркушем (картинка 2): шолом — клітинка 1, щит — 2; меч без картинки — лише назва;
  // готовий прямий образ — картинка 3
  const p = A.gptPrompt(spec.slots, true);
  assert.match(p, /Image 2 is a sheet of 2 items in a grid of 1 row\(s\) × 2 column/);
  assert.match(p, /cell 1 → headwear: "шляпа"/);
  assert.match(p, /cell 2 → shield held in the left hand/);
  assert.match(p, /weapon held in the right hand: "Меч новачка" \(Меч\) \(no picture/);
  assert.match(p, /Image 3 is the same character already dressed/);
  assert.deepStrictEqual(A.sheetGrid(8), { cols: 3, rows: 3 });
  assert.deepStrictEqual(A.sheetGrid(10), { cols: 4, rows: 3 });
  const one = await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 200, g: 0, b: 0, alpha: 1 } } }).png().toBuffer();
  const sheet = await sharp(await A.itemSheet([one, one, one, one, one])).metadata();
  assert.strictEqual(sheet.width, 3 * 256); assert.strictEqual(sheet.height, 2 * 256);
  assert.doesNotMatch(A.gptPrompt(spec.slots, false), /already dressed/);

  // полотно доповнюється до розміру OpenAI, а результат вирізається назад у пропорціях полотна
  for (const pose of ['stand', 'fight']) {
    const png = await A.canvasPng('linen-boy', pose, true);
    const m = await sharp(png).metadata();
    const f = await A.openaiFrame(png);
    const fm = await sharp(f.png).metadata();
    const [sw, sh] = f.size.split('x').map(Number);
    assert.ok(Math.abs(fm.width / fm.height - sw / sh) < 0.01, `${pose}: ${fm.width}×${fm.height} vs ${f.size}`);
    const out = await sharp(f.png).resize(sw, sh).png().toBuffer();       // «відповідь OpenAI»
    const back = await sharp(await A.unframe(out, f.crop)).metadata();
    assert.ok(Math.abs(back.width / back.height - m.width / m.height) < 0.01, `${pose}: ${back.width}×${back.height}`);
  }
});

test('OpenAI edit: усі картинки в запиті по порядку, розмір з параметра', async () => {
  const O = require('../src/openai-image');
  const old = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'sk-test';
  try {
    let body = null;
    const ok = async (url, init) => { body = init.body; return { ok: true, status: 200, json: async () => ({ data: [{ b64_json: 'AA==' }] }) }; };
    await O.edit([Buffer.from('a'), Buffer.from('b'), Buffer.from('c')], 'p', { size: '1536x1024', fetch: ok });
    const imgs = body.getAll('image[]');
    assert.strictEqual(imgs.length, 3);
    assert.strictEqual(imgs[0].name, 'image1.png');
    assert.strictEqual(body.get('size'), '1536x1024');
  } finally {
    if (old === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = old;
  }
});

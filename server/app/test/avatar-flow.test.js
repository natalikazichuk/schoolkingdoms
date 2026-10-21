/* Повний шлях «Одягти GPT» без PostgreSQL і OpenAI: підроблена база перевіряє параметри
   запитів так, як це робить PostgreSQL (кожен $n має бути в тексті запиту — інакше
   «could not determine data type of parameter $n»). Саме ця помилка ламала збереження
   кожного готового образу після «Моїх колекцій». */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

process.env.AVATAR_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ava-flow-'));
const db = require('../src/db');
const A = require('../src/avatar');
const O = require('../src/openai-image');

function checkParams(sql, params) {
  const used = new Set((sql.match(/\$(\d+)/g) || []).map(x => Number(x.slice(1))));
  for (let i = 1; i <= (params || []).length; i++) {
    if (!used.has(i)) throw new Error('could not determine data type of parameter $' + i);
  }
  for (const n of used) if (n > (params || []).length) throw new Error('there is no parameter $' + n);
}

test('«Одягти GPT»: картинки від OpenAI → образ Героя, колекція, сирі картинки; параметри SQL — як у PostgreSQL', async () => {
  const ITEMS = { 'IT-001': { name: 'шляпа' }, 'IT-102': { name: 'щит', category: 'Щити' } };
  const hero = { avatar: 'hero:linen-boy-fight', login: 'vova', inventory: [{ id: 'IT-001', slot: 'helmet' }, { id: 'IT-102', slot: 'weaponL' }] };
  const spec = A.buildSpec(hero, ITEMS);
  Object.assign(spec, { engine: 'gpt', key: A.gptKey(spec.key) });
  const job = { id: 7, key: spec.key, spec, status: 'working' };
  let doc = Object.assign({}, hero, { avatarGen: { base: spec.base, key: spec.key, engine: 'gpt', status: 'queued', at: Date.now() } });

  const q = async (sql, params) => {
    checkParams(sql, params);
    const s = sql.replace(/\s+/g, ' ').trim();
    if (/^(begin|commit|rollback)$/.test(s)) return { rows: [] };
    if (/from avatar_jobs where id = \$1/.test(s)) return { rows: [job] };
    if (/^update avatar_jobs set status = 'done'/.test(s)) { job.status = 'done'; job.file = params[1]; return { rows: [] }; }
    if (/^update avatar_jobs set status = 'failed'/.test(s)) { job.status = 'failed'; job.error = params[1]; return { rows: [{ key: job.key }] }; }
    if (/avatarGen'->>'key' = \$1/.test(s)) return { rows: [{ path: 'heroes/u1', data: doc }] };
    if (/avatarCollection' @> \$1::jsonb/.test(s)) return { rows: [] };
    if (/^update docs set data = \$2/.test(s)) { if (params[0] === 'heroes/u1') doc = JSON.parse(params[1]); return { rows: [] }; }
    if (/data->>'look' as look from docs where parent = 'items'/.test(s)) return { rows: [{ id: 'IT-001', look: 'plain steel helmet' }] };
    if (/jsonb_set\(data, '\{look\}'/.test(s)) { looksSaved.push(params); return { rows: [] }; }
    if (/^update docs set data = jsonb_set/.test(s)) return { rows: [] };
    throw new Error('неочікуваний запит: ' + s.slice(0, 100));
  };
  const looksSaved = [], prompts = [];
  const was = { query: db.pool.query, connect: db.pool.connect, edit: O.edit, describe: O.describe };
  O.describe = async () => 'round wooden shield with an iron rim';
  db.pool.query = q;
  db.pool.connect = async () => ({ query: q, release() {} });
  let calls = 0;
  O.edit = async (images, prompt, opt) => {
    calls++; prompts.push(prompt);
    const [w, h] = opt.size.split('x').map(Number);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="${w * .3}" y="${h * .2}" width="${w * .4}" height="${h * .75}" fill="#963"/></svg>`;
    return sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: Buffer.from(svg) }]).png().toBuffer();
  };
  try {
    await A.drawGpt(job.id, spec);
    assert.strictEqual(job.error, undefined, job.error);
    assert.strictEqual(job.status, 'done');
    assert.strictEqual(calls, 2);                                  // пряма й бойова пози
    // описи речей: шолом — з картки, щит — описано й збережено в картку
    assert.match(prompts[0], /headwear: "шляпа" — plain steel helmet/);
    assert.match(prompts[0], /"щит" — round wooden shield with an iron rim/);
    assert.deepStrictEqual(looksSaved, [['items/IT-102', 'round wooden shield with an iron rim']]);
    assert.match(prompts[0], /EDIT image 1/);
    assert.match(prompts[0], /The right hand holds nothing\./);   // правої зброї немає
    assert.strictEqual(doc.avatar, 'hero:gen/' + job.file);
    assert.strictEqual(doc.avatarGen.status, 'ready');
    assert.deepStrictEqual(doc.avatarCollection.map(x => [x.key, x.engine]), [[spec.key, 'gpt']]);
    for (const suf of ['full', 'fight', '256', '96']) assert.ok(fs.existsSync(path.join(process.env.AVATAR_DIR, `${job.file}-${suf}.webp`)), suf);
    // сирі картинки збережені — їх можна застосувати ще раз без нового запиту
    assert.deepStrictEqual(A.rawIds(), [7]);
    job.status = 'failed'; doc.avatarGen.status = 'failed';
    const r = await A.adminReapply({ id: 7 });
    assert.ok(r.ok);
    assert.strictEqual(calls, 2);                                  // OpenAI вдруге не кликали
    assert.strictEqual(doc.avatarGen.status, 'ready');
  } finally {
    Object.assign(db.pool, { query: was.query, connect: was.connect });
    Object.assign(O, { edit: was.edit, describe: was.describe });
  }
});

test('сирі картинки: зберігаються лише останні 5 завдань', () => {
  for (let id = 100; id < 108; id++) A.saveRaw(id, 'stand', Buffer.from('x'));
  assert.deepStrictEqual(A.rawIds(), [107, 106, 105, 104, 103]);
});

/* Герой змінив аватар, поки воркер малював: образ готовий, але Герой уже інший —
   «в черзі» не має висіти вічно (кнопка «Одягти» лишалась неактивною) */
test('status: готовий образ іншої бази — у колекцію, очікування знято', async () => {
  const key = 'a'.repeat(24);
  let doc = { avatar: 'hero:linen-boy', avatarGen: { base: 'blond-boy', key, status: 'queued', at: 1 } };
  const job = { key, status: 'done', file: 'aaaaaaaaaaaa-x1', attempts: 1 };
  const q = async (sql, params) => {
    checkParams(sql, params);
    const s = sql.replace(/\s+/g, ' ').trim();
    if (/^(begin|commit|rollback)$/.test(s)) return { rows: [] };
    if (/^update avatar_jobs/.test(s)) return { rows: [] };
    if (/^select data from docs where path = \$1/.test(s)) return { rows: [{ data: doc }] };
    if (/from avatar_jobs where key = \$1/.test(s)) return { rows: [job] };
    if (/^update docs set data = \$2/.test(s)) { doc = JSON.parse(params[1]); return { rows: [] }; }
    if (/^update docs set data = jsonb_set/.test(s)) return { rows: [] };
    throw new Error('неочікуваний запит: ' + s.slice(0, 100));
  };
  const was = { query: db.pool.query, connect: db.pool.connect };
  db.pool.query = q;
  db.pool.connect = async () => ({ query: q, release() {} });
  try {
    const st = await A.status({ uid: 'u1' });
    assert.strictEqual(st.gen.status, 'cancelled');
    assert.strictEqual(st.avatar, 'hero:linen-boy');               // вибір Героя не перебито
    assert.strictEqual(st.job, undefined);
    assert.deepStrictEqual(doc.avatarCollection.map(x => [x.key, x.file, x.base]), [[key, job.file, 'blond-boy']]);
    // та сама база — образ просто одягається
    doc = { avatar: 'hero:blond-boy', avatarGen: { base: 'blond-boy', key, status: 'queued', at: 1 } };
    const st2 = await A.status({ uid: 'u1' });
    assert.strictEqual(st2.gen.status, 'ready');
    assert.strictEqual(st2.avatar, 'hero:gen/' + job.file);
  } finally {
    Object.assign(db.pool, was);
  }
});

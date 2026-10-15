/* HTTP-рівень server.js без бази: запити, що мають відсікатися ще до SQL. */
const test = require('node:test');
const assert = require('node:assert');
const { server } = require('../src/server');

function start() {
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok(server.address().port)));
}

test('Origin: null → 403, а не 500', async () => {
  const port = await start();
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/get`, {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'null' }, body: '{}'
    });
    assert.strictEqual(r.status, 403);
    assert.strictEqual((await r.json()).error.code, 'permission-denied');
  } finally { server.close(); }
});

test('зіпсований cookie не валить запит: /api/auth/me → гість', async () => {
  const port = await start();
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/auth/me`, { headers: { cookie: 'sk_session=%E0%A4%A' } });
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual(await r.json(), { user: null });
  } finally { server.close(); }
});

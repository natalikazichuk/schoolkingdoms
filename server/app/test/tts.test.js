/* src/tts.js без мережі: OpenAI підмінено, файли — у тимчасовій теці. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.TTS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tts-'));
process.env.OPENAI_API_KEY = 'test';
process.env.TTS_PER_IP_DAY = '2';
const tts = require('../src/tts');

function fakeFetch() {
  const calls = [];
  const f = async (url, init) => {
    calls.push(JSON.parse(init.body));
    return { ok: true, arrayBuffer: async () => new Uint8Array([0x49, 0x44, 0x33]).buffer };
  };
  f.calls = calls;
  return f;
}

test('фраза синтезується один раз, далі — з файлу', async () => {
  const f = fakeFetch();
  const a = await tts.speak({ text: 'Мама  мила раму', lang: 'uk-UA' }, '1.1.1.1', { fetch: f });
  const b = await tts.speak({ text: 'Мама мила раму', lang: 'uk' }, '1.1.1.1', { fetch: f });
  assert.match(a.url, /^\/tts\/[0-9a-f]{64}\.mp3$/);
  assert.strictEqual(a.url, b.url);
  assert.strictEqual(f.calls.length, 1);
  assert.strictEqual(f.calls[0].input, 'Мама мила раму');
  assert.ok(fs.existsSync(path.join(process.env.TTS_DIR, a.url.slice(5))));
});

test('дві однакові фрази одночасно — один виклик OpenAI', async () => {
  const f = fakeFetch();
  const [a, b] = await Promise.all([
    tts.speak({ text: 'Сонечко', lang: 'uk' }, '2.2.2.2', { fetch: f }),
    tts.speak({ text: 'Сонечко', lang: 'uk' }, '2.2.2.2', { fetch: f })
  ]);
  assert.strictEqual(a.url, b.url);
  assert.strictEqual(f.calls.length, 1);
});

test('перевірка вводу й ліміт на IP', async () => {
  const f = fakeFetch();
  await assert.rejects(tts.speak({ text: '  ', lang: 'uk' }, '3.3.3.3', { fetch: f }), { status: 400 });
  await assert.rejects(tts.speak({ text: 'x'.repeat(tts.MAX_CHARS + 1), lang: 'uk' }, '3.3.3.3', { fetch: f }), { status: 400 });
  await assert.rejects(tts.speak({ text: 'Привіт', lang: 'de' }, '3.3.3.3', { fetch: f }), { status: 400 });
  await tts.speak({ text: 'один', lang: 'uk' }, '3.3.3.3', { fetch: f });
  await tts.speak({ text: 'два', lang: 'uk' }, '3.3.3.3', { fetch: f });
  await assert.rejects(tts.speak({ text: 'три', lang: 'uk' }, '3.3.3.3', { fetch: f }), { status: 429 });
  // уже готова фраза ліміту не витрачає
  await tts.speak({ text: 'один', lang: 'uk' }, '3.3.3.3', { fetch: f });
});

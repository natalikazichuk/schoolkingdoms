const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), os = require('os'), path = require('path');

test('itemimg.save: зберігає WebP у <AVATAR_DIR>/upload/img/items/<код>.webp і перевіряє вхід', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ii-'));
  process.env.AVATAR_DIR = dir;
  const { save, ItemImgError } = require('../src/itemimg');
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(16)]);
  const r = save({ id: 'IT-999', data: 'data:image/webp;base64,' + webp.toString('base64') });
  assert.strictEqual(r.path, 'img/items/IT-999.webp');
  assert.ok(fs.existsSync(path.join(dir, 'upload/img/items/IT-999.webp')));
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
  const r2 = save({ id: 'IT-999', data: webp.toString('base64'), orig: 'data:image/png;base64,' + png.toString('base64') });
  assert.match(r2.original, /^IT-999-\d{8}-\d{6}\.png$/, 'оригінал в архіві з датою');
  assert.ok(fs.existsSync(path.join(dir, 'upload/originals/items', r2.original)));
  assert.strictEqual(r.original, null, 'без оригіналу — нічого в архів');
  assert.throws(() => save({ id: 'IT-999', data: webp.toString('base64'), orig: 'data:image/png;base64,' + webp.toString('base64') }), ItemImgError, 'оригінал перевіряється');
  assert.throws(() => save({ id: '../x', data: webp.toString('base64') }), ItemImgError, 'код без шляхів');
  assert.throws(() => save({ id: 'IT-1', data: Buffer.from('not a webp image').toString('base64') }), ItemImgError, 'лише WebP');
  assert.throws(() => save({ id: 'IT-1', data: '' }), ItemImgError);
});

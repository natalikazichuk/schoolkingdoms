/* ============================================================
   itemimg.js — картинка речі з адмінки «Предмети» (POST /api/admin/item-image).
   Сторінка сама готує файл (прозоре тло, 512×512 WebP) і шле його base64.
   Сайт у контейнері лише для читання, тож файл лягає в каталог образів:
     <AVATAR_DIR>/upload/img/items/<код>.webp
   nginx (server/nginx/site.conf) віддає /img/items/<код>.webp спершу з репозиторію,
   а якщо там такого файлу немає — звідси. Тобто гра бачить картинку за звичною адресою.
   ============================================================ */
const fs = require('fs');
const path = require('path');

const MAX_BYTES = 1.5 * 1024 * 1024;
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const dir = () => path.join(process.env.AVATAR_DIR || '/avatars', 'upload', 'img', 'items');
const siteDir = () => process.env.SITE_DIR || path.join(__dirname, '../../..');

class ItemImgError extends Error { constructor(code, message) { super(message); this.code = code; } }

/* {id, data: base64 WebP} → {path, bytes, shadowed} ; shadowed — у репозиторії вже є файл з цим кодом (він головніший) */
function save(body) {
  const id = String((body && body.id) || '');
  if (!ID_RE.test(id)) throw new ItemImgError('invalid-argument', 'Невірний код предмета');
  const b64 = String((body && body.data) || '').replace(/^data:image\/webp;base64,/, '');
  const buf = Buffer.from(b64, 'base64');
  if (!buf.length) throw new ItemImgError('invalid-argument', 'Порожній файл');
  if (buf.length > MAX_BYTES) throw new ItemImgError('invalid-argument', 'Файл завеликий (до 1,5 МБ)');
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') throw new ItemImgError('invalid-argument', 'Очікується WebP');
  fs.mkdirSync(dir(), { recursive: true });
  const out = path.join(dir(), id + '.webp');
  fs.writeFileSync(out + '.tmp', buf);
  fs.renameSync(out + '.tmp', out);
  const shadowed = fs.existsSync(path.join(siteDir(), 'img', 'items', id + '.webp'));
  return { path: 'img/items/' + id + '.webp', bytes: buf.length, shadowed };
}

module.exports = { save, ItemImgError, MAX_BYTES };

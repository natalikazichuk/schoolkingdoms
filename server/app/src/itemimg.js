/* ============================================================
   itemimg.js — картинка речі з адмінки «Предмети» (POST /api/admin/item-image).
   Сторінка сама готує файл (прозоре тло, 512×512 WebP) і шле його base64.
   Сайт у контейнері лише для читання, тож файл лягає в каталог образів:
     <AVATAR_DIR>/upload/img/items/<код>.webp
   nginx (server/nginx/site.conf) віддає /img/items/<код>.webp спершу з репозиторію,
   а якщо там такого файлу немає — звідси. Тобто гра бачить картинку за звичною адресою.
   АРХІВ: разом із готовою картинкою сторінка шле й оригінал (як його завантажили — PNG/JPG/WebP);
   він лягає в <AVATAR_DIR>/upload/originals/items/<код>-<дата-час>.<розширення> і ніде не
   показується — щоб за потреби переробити картинку з першоджерела. Нічого не перезаписується.
   ============================================================ */
const fs = require('fs');
const path = require('path');

const MAX_BYTES = 1.5 * 1024 * 1024;
const MAX_ORIG = 9 * 1024 * 1024;                 // оригінал від генератора (PNG 1024×1024 — до кількох МБ)
const ORIG_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const origDir = () => path.join(process.env.AVATAR_DIR || '/avatars', 'upload', 'originals', 'items');
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
  return { path: 'img/items/' + id + '.webp', bytes: buf.length, shadowed, original: saveOriginal(id, body) };
}

/* оригінал в архів (необовʼязково): {orig: base64 чи data:URL, origType} → імʼя файлу або null */
function saveOriginal(id, body) {
  const m = /^data:([a-z/+-]+);base64,/.exec(String(body.orig || ''));
  const type = (m && m[1]) || String(body.origType || ''), ext = ORIG_TYPES[type];
  if (!body.orig || !ext) return null;
  const buf = Buffer.from(String(body.orig).replace(/^data:[^,]*,/, ''), 'base64');
  if (!buf.length || buf.length > MAX_ORIG) throw new ItemImgError('invalid-argument', 'Оригінал завеликий (до 9 МБ)');
  const magic = ext === 'png' ? buf.readUInt32BE(0) === 0x89504e47 : ext === 'jpg' ? buf[0] === 0xff && buf[1] === 0xd8
    : buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP';
  if (!magic) throw new ItemImgError('invalid-argument', 'Оригінал — не ' + ext.toUpperCase());
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const name = id + '-' + stamp + '.' + ext;
  fs.mkdirSync(origDir(), { recursive: true });
  fs.writeFileSync(path.join(origDir(), name), buf);
  return name;
}

module.exports = { save, ItemImgError, MAX_BYTES, MAX_ORIG };

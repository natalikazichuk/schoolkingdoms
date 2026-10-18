/* Образ Героя: аватар у вдягнених речах. Малює зовнішній воркер (ComfyUI),
   сервер лише збирає завдання, тримає чергу й приймає результат.

   Герой (кнопка «Одягти» в Інвентарі арени):
     POST /api/avatar/render   → збирає набір (база + речі у слотах) і ставить у чергу
     GET  /api/avatar/status   → стан свого образу й місце в черзі
   Воркер (Authorization: Bearer AVATAR_WORKER_TOKEN; протокол — server/AVATAR-WORKER.md):
     POST /api/avatar/worker/claim | heartbeat | result | fail

   Набір = базове зображення активного аватара (img/ava/<id>-base.webp, без
   верхнього одягу) + речі у видимих слотах. Однаковий набір — однаковий ключ:
   готовий образ береться з кешу без нової генерації, хай би який Герой його вдягнув.
   Готовий образ стає аватаром Героя: avatar = 'hero:gen/<файл>', файли лежать у
   AVATAR_DIR (nginx віддає їх як /img/ava/gen/), базовий аватар — у avatarGen.base.
   Кожен готовий образ лишається в колекції Героя (heroes/{id}.avatarCollection,
   останні COLLECTION_MAX): у вікні «Обери свого героя» — розділ «Мої колекції»,
     POST /api/avatar/wear   {key} → знову вдягнути образ із колекції
     POST /api/avatar/forget {key} → прибрати образ із колекції
   «Згенерувати аватар» (Інвентар арени): POST /api/avatar/photo {image} — фото дитини
   малює OpenAI (src/openai-image.js) у кадрі й позі шаблону PHOTO_TEMPLATE. Результат —
   новий герой-шаблон: base = 'gen/<файл>' (файл <файл>-base.webp лежить поруч з образом),
   тож у нього так само можна вдягати речі кнопкою «Одягти». Фото не зберігаємо.
   Поля heroes/{id}.avatarGen і avatarCollection змінює лише цей модуль (rules.js: HERO_PROTECTED). */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('./db');
const openai = require('./openai-image');

class AvatarError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}

/* Слоти, які видно на малюнку (порядок — зверху вниз). Кільця не малюємо:
   на повний зріст їх не розгледіти, а набір без них частіше збігається з кешем. */
const SLOTS = [
  { slot: 'helmet',  label: 'головний убір',  en: 'headwear' },
  { slot: 'amulet',  label: 'амулет на шиї',  en: 'amulet worn on the neck' },
  { slot: 'armor',   label: 'обладунок',      en: 'body armor / outer garment' },
  { slot: 'bracers', label: 'наручі',         en: 'bracers on the forearms' },
  { slot: 'gloves',  label: 'рукавиці',       en: 'gloves' },
  { slot: 'belt',    label: 'пояс',           en: 'belt' },
  { slot: 'pants',   label: 'штани',          en: 'pants' },
  { slot: 'boots',   label: 'взуття',         en: 'boots' },
  { slot: 'weaponR', label: 'зброя в правій руці', en: 'weapon held in the right hand' },
  { slot: 'weaponL', label: 'ліва рука',      en: 'left hand' }
];
// ліва рука — щит або друга зброя (дворучний бій)
function slotLabel(s, item) {
  if (s.slot !== 'weaponL') return { label: s.label, en: s.en };
  return item && item.category === 'Щити'
    ? { label: 'щит у лівій руці', en: 'shield held in the left hand' }
    : { label: 'зброя в лівій руці', en: 'weapon held in the left hand' };
}

/* Де обличчя на базовому зображенні (частки ширини/висоти) — з нього ріжемо
   маленькі аватарки -256/-96, як у вбудованих героїв. Знайдено зіставленням
   img/ava/<id>-256.webp з <id>-full.webp. */
const FACE_BOX = {
  'linen-boy':       { left: 0.242, top: 0, size: 0.513 },
  'linen-boy-fight': { left: 0.197, top: 0, size: 0.590 }
};
const FACE_DEFAULT = { left: 0.2, top: 0, size: 0.6 };

// версія набору й промпту: змінив PROMPT/SLOTS — підніми, і старий кеш не підхопиться
const SPEC_VERSION = 1;
const MAX_ATTEMPTS = 3;
const LEASE_MIN = 10;
const RENDER_PER_HOUR = 20;        // нових генерацій на Героя за годину
const MAX_IMAGE = 9 * 1024 * 1024; // байтів картинки від воркера (після base64)
const COLLECTION_MAX = 24;         // образів у колекції Героя
const KEY_RE = /^[a-f0-9]{24}$/;
// герой з фото: шаблон (кадр, поза, рамка обличчя) і обмеження — кожен малюнок коштує грошей
const PHOTO_TEMPLATE = 'linen-boy';
const PHOTO_PER_DAY = Number(process.env.AVATAR_PHOTO_PER_DAY) || 3;      // на Героя
const PHOTO_DAY_TOTAL = Number(process.env.AVATAR_PHOTO_DAY_TOTAL) || 30; // на весь сайт
const PHOTO_TIMEOUT_MIN = 6;                // довше «малюється» — значить, сервер перезапускався
const MAX_PHOTO = 3 * 1024 * 1024;          // байтів фото (браузер стискає до ~1024 px)
const GEN_BASE_RE = /^gen\/[A-Za-z0-9-]+$/;
const isPhotoBase = b => GEN_BASE_RE.test(String(b || ''));

const siteDir = () => process.env.SITE_DIR || path.join(__dirname, '../../..');
const avatarDir = () => process.env.AVATAR_DIR || '/avatars';
/* файли сайту; img/ava/gen/ — каталог образів AVATAR_DIR (nginx віддає його за цією адресою) */
const filePath = rel => rel.indexOf('img/ava/gen/') === 0 ? path.join(avatarDir(), rel.slice(12)) : path.join(siteDir(), rel);
const exists = rel => { try { return fs.statSync(filePath(rel)).isFile(); } catch (e) { return false; } };

const GEN_RE = /^hero:gen\/[A-Za-z0-9-]+$/;
/* базовий аватар Героя: вбудований 'hero:<id>' або той, з якого зроблено образ
   (для героя з фото — 'gen/<файл>') */
function baseOf(hero) {
  const t = String((hero && hero.avatar) || '');
  if (GEN_RE.test(t)) return (hero.avatarGen && hero.avatarGen.base) || null;
  if (/^hero:[a-z0-9-]+$/.test(t)) return t.slice(5);
  return null;   // емодзі
}

/* Колекція створених образів [{key, file, base, at}]. Герой, що вдягав образ ще
   до появи колекції, отримує в ній свій поточний готовий образ. */
function collectionOf(hero) {
  const own = hero && hero.avatarCollection;
  if (Array.isArray(own)) return own.filter(x => x && KEY_RE.test(String(x.key)) && x.file && x.base);
  const g = hero && hero.avatarGen;
  return g && g.status === 'ready' && g.file && g.base && KEY_RE.test(String(g.key))
    ? [{ key: g.key, file: g.file, base: g.base, at: g.readyAt || g.at || 0 }] : [];
}
/* додати (або підняти наверх) образ; найстаріші понад COLLECTION_MAX — геть */
function addToCollection(hero, entry) {
  return collectionOf(hero).filter(x => x.key !== entry.key).concat([entry]).slice(-COLLECTION_MAX);
}

/* Набір для генерації. items — каталог {id: дані}, has(rel) — чи є файл на сайті. */
function buildSpec(hero, items, has) {
  has = has || exists;
  const base = baseOf(hero);
  if (!base) throw new AvatarError('failed-precondition', 'Спершу обери героя-аватар (не смайлик)');
  const baseImage = 'img/ava/' + base + '-base.webp';
  if (!has(baseImage)) throw new AvatarError('failed-precondition', 'Для цього аватара ще немає базового зображення');
  const worn = {};
  (Array.isArray(hero.inventory) ? hero.inventory : []).forEach(i => { if (i && i.slot && i.id) worn[i.slot] = i.id; });
  const slots = SLOTS.map(s => {
    const id = worn[s.slot];
    const b = id && items[id];
    const item = b ? {
      id,
      name: String(b.name || id),
      category: b.category || null,
      weaponType: b.weaponType || null,
      image: has('img/items/' + id + '.webp') ? 'img/items/' + id + '.webp' : null
    } : null;
    return Object.assign({ slot: s.slot }, slotLabel(s, item), { item });
  });
  const filled = slots.filter(s => s.item).length;
  const key = crypto.createHash('sha256')
    .update(JSON.stringify([SPEC_VERSION, base, slots.map(s => s.item && s.item.id)]))
    .digest('hex').slice(0, 24);
  return { version: SPEC_VERSION, key, base, baseImage, total: SLOTS.length, filled, slots, prompt: promptOf(slots) };
}

/* Підказка для моделі (англійською — так її краще розуміють). Воркер може
   скласти свою з полів slots; назви речей — як у грі, українською. */
function promptOf(slots) {
  const on = slots.filter(s => s.item);
  return [
    'Image 1 is the base character. Image 2 is a reference sheet of clothing and gear; every item on it is captioned with its slot.',
    'Dress the character from image 1 in exactly these items:',
    ...on.map(s => `- ${s.en}: "${s.item.name}"` + (s.item.weaponType ? ` (${s.item.weaponType})` : '')),
    'Each item replaces the matching part of the base outfit; parts without an item keep the base outfit from image 1.',
    'Keep the same face, hairstyle, skin tone, body proportions, pose, camera framing and cartoon 3D art style as image 1.',
    'Do not add any other items, text or background objects. Transparent or plain white background.'
  ].join('\n');
}

/* ---------- обмеження частоти (у пам'яті, як спроби входу) ---------- */
const recent = new Map();   // uid → [мітки часу нових генерацій]
function rateOk(uid) {
  const now = Date.now();
  const a = (recent.get(uid) || []).filter(t => now - t < 3600e3);
  recent.set(uid, a);
  return a.length < RENDER_PER_HOUR;
}
function noteRender(uid) { recent.get(uid).push(Date.now()); }

/* ---------- Герой ---------- */
const genToken = file => 'hero:gen/' + file;
async function writeDoc(c, p, data) {
  await c.query(`update docs set data = $2, version = version + 1, updated_at = now() where path = $1`, [p, JSON.stringify(data)]);
}
/* аватар → новий токен; як SK.saveHeroAvatar: журнал avatarLog і публічна картка heroCards */
async function setAvatar(c, uid, hero, token, gen) {
  const next = Object.assign({}, hero, { avatarGen: gen, updatedAt: { $ts: Date.now() } });
  if (gen && gen.status === 'ready' && gen.file)
    next.avatarCollection = addToCollection(hero, { key: gen.key, file: gen.file, base: gen.base, at: Date.now() });
  if (hero.avatar !== token) {
    const log = Array.isArray(hero.avatarLog) ? hero.avatarLog.slice(-9) : [];
    log.push({ at: Date.now(), page: 'avatar-gen', by: 'server', from: hero.avatar || null, to: token });
    next.avatar = token; next.avatarLog = log;
    await c.query(`update docs set data = jsonb_set(data, '{avatar}', to_jsonb($2::text)), version = version + 1, updated_at = now()
                    where path = $1`, ['heroCards/' + uid, token]);
  }
  await writeDoc(c, 'heroes/' + uid, next);
  return next;
}
const waitingSql = `parent = 'heroes' and data->'avatarGen'->>'key' = $1 and data->'avatarGen'->>'status' = 'queued'`;

async function position(q, key) {
  const r = await q.query(
    `select count(*)::int as n from avatar_jobs
      where status = 'queued' and queued_at <= (select queued_at from avatar_jobs where key = $1)`, [key]);
  return r.rows[0].n;
}

async function render(user) {
  if (!user) throw new AvatarError('unauthenticated');
  const c = await pool.connect();
  try {
    await c.query('begin');
    const r = await c.query('select data from docs where path = $1 for update', ['heroes/' + user.uid]);
    if (!r.rows.length) throw new AvatarError('permission-denied', 'Образ одягає сам Герой');
    const hero = r.rows[0].data;
    const items = {};
    (await c.query(`select id, data from docs where parent = 'items'`)).rows.forEach(x => { items[x.id] = x.data; });
    const spec = buildSpec(hero, items);
    const prev = hero.avatarGen || null;
    const gen = { base: spec.base, key: spec.key, at: Date.now() };
    let out;

    if (!spec.filled) {
      // нічого не вдягнено — просто базовий аватар, малювати нічого
      await setAvatar(c, user.uid, hero, 'hero:' + spec.base, Object.assign(gen, { status: 'ready', file: null }));
      out = { status: 'ready', avatar: 'hero:' + spec.base };
    } else {
      const j = (await c.query('select * from avatar_jobs where key = $1 for update', [spec.key])).rows[0];
      if (j && j.status === 'done' && j.file) {
        await setAvatar(c, user.uid, hero, genToken(j.file), Object.assign(gen, { status: 'ready', file: j.file }));
        out = { status: 'ready', avatar: genToken(j.file) };
      } else {
        if (!j || j.status === 'failed' || j.status === 'cancelled') {
          if (!rateOk(user.uid)) throw new AvatarError('resource-exhausted', 'Забагато образів за годину — спробуй пізніше');
          noteRender(user.uid);
          await c.query(
            `insert into avatar_jobs (key, spec) values ($1, $2)
             on conflict (key) do update set status = 'queued', spec = excluded.spec, attempts = 0, error = null,
               worker = null, lease_until = null, queued_at = now(), updated_at = now()`, [spec.key, JSON.stringify(spec)]);
        }
        await writeDoc(c, 'heroes/' + user.uid, Object.assign({}, hero, { avatarGen: Object.assign(gen, { status: 'queued' }), updatedAt: { $ts: Date.now() } }));
        out = { status: j && j.status === 'working' ? 'working' : 'queued', position: await position(c, spec.key) };
      }
    }
    // попередній набір, який більше ніхто не чекає, — з черги геть (уже взятий воркером хай домальовує: піде в кеш)
    if (prev && prev.key && prev.key !== spec.key && prev.status === 'queued') {
      const other = await c.query(`select 1 from docs where ${waitingSql} and path <> $2 limit 1`, [prev.key, 'heroes/' + user.uid]);
      if (!other.rows.length) await c.query(`update avatar_jobs set status = 'cancelled', updated_at = now() where key = $1 and status = 'queued'`, [prev.key]);
    }
    await c.query('commit');
    return Object.assign(out, { key: spec.key, filled: spec.filled, total: spec.total });
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

async function status(user) {
  if (!user) throw new AvatarError('unauthenticated');
  await sweep();
  const r = await pool.query('select data from docs where path = $1', ['heroes/' + user.uid]);
  if (!r.rows.length) throw new AvatarError('permission-denied', 'Образ — лише для Героя');
  const hero = r.rows[0].data;
  let g = hero.avatarGen || null;
  if (photoStale(g)) g = (await failPhoto(user.uid, g.key, 'Сервер перезапустився — спробуй ще раз')) || g;
  const out = { avatar: hero.avatar || null, gen: g };
  if (g && g.key && g.status === 'queued' && g.kind !== 'photo') {
    const j = (await pool.query('select status, attempts from avatar_jobs where key = $1', [g.key])).rows[0];
    if (j) {
      out.job = { status: j.status, attempts: j.attempts };
      if (j.status === 'queued') out.job.position = await position(pool, g.key);
    }
  }
  return out;
}

/* ---------- колекція образів ---------- */
async function onHero(user, body, fn) {
  if (!user) throw new AvatarError('unauthenticated');
  const key = String((body && body.key) || '');
  if (!KEY_RE.test(key)) throw new AvatarError('invalid-argument', 'Немає такого образу');
  const c = await pool.connect();
  try {
    await c.query('begin');
    const r = await c.query('select data from docs where path = $1 for update', ['heroes/' + user.uid]);
    if (!r.rows.length) throw new AvatarError('permission-denied', 'Колекція образів — лише для Героя');
    const hero = r.rows[0].data;
    const entry = collectionOf(hero).find(x => x.key === key);
    if (!entry) throw new AvatarError('not-found', 'Цього образу немає в колекції');
    const out = await fn(c, hero, entry);
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/* знову вдягнути образ із колекції: файл беремо з кешу (міг бути перемальований) */
function wear(user, body) {
  return onHero(user, body, async (c, hero, entry) => {
    const j = isPhotoBase(entry.base) && entry.base === 'gen/' + entry.file
      ? (exists('img/ava/gen/' + entry.file + '-full.webp') ? { status: 'done', file: entry.file } : null)   // герой з фото
      : (await c.query('select status, file from avatar_jobs where key = $1', [entry.key])).rows[0];
    if (!j || j.status !== 'done' || !j.file) throw new AvatarError('failed-precondition', 'Цей образ зараз недоступний');
    const next = await setAvatar(c, user.uid, hero, genToken(j.file),
      { base: entry.base, key: entry.key, at: Date.now(), status: 'ready', file: j.file, readyAt: Date.now() });
    return { avatar: next.avatar, collection: next.avatarCollection };
  });
}

/* прибрати образ із колекції (той, що зараз на Герої, — не можна) */
function forget(user, body) {
  return onHero(user, body, async (c, hero, entry) => {
    if (hero.avatar === genToken(entry.file)) throw new AvatarError('failed-precondition', 'Спершу обери інший образ');
    const list = collectionOf(hero).filter(x => x.key !== entry.key);
    await writeDoc(c, 'heroes/' + user.uid, Object.assign({}, hero, { avatarCollection: list, updatedAt: { $ts: Date.now() } }));
    return { collection: list };
  });
}

/* ---------- герой з фото (OpenAI) ---------- */
const photoRecent = new Map();   // uid → [мітки часу], як rateOk, але за добу
let photoAll = [];
function photoRateOk(uid) {
  const now = Date.now(), day = 864e5;
  photoAll = photoAll.filter(t => now - t < day);
  const a = (photoRecent.get(uid) || []).filter(t => now - t < day);
  photoRecent.set(uid, a);
  if (a.length >= PHOTO_PER_DAY) return 'Сьогодні вже досить нових героїв — спробуй завтра';
  if (photoAll.length >= PHOTO_DAY_TOTAL) return 'Художник на сьогодні втомився — спробуй завтра';
  return '';
}
function notePhoto(uid) { const t = Date.now(); photoRecent.get(uid).push(t); photoAll.push(t); }
const photoStale = g => !!(g && g.kind === 'photo' && g.status === 'queued' && Date.now() - (g.at || 0) > PHOTO_TIMEOUT_MIN * 60e3);

/* фото з браузера → PNG без EXIF-повороту, не більше 1024 px */
async function photoPng(raw) {
  const sharp = require('sharp');
  const buf = Buffer.from(String(raw || '').replace(/^data:[^,]*,/, ''), 'base64');
  if (!buf.length) throw new AvatarError('invalid-argument', 'Немає фото');
  if (buf.length > MAX_PHOTO) throw new AvatarError('invalid-argument', 'Фото завелике — спробуй менше');
  let meta;
  try { meta = await sharp(buf).metadata(); } catch (e) { throw new AvatarError('invalid-argument', 'Це не зображення'); }
  if (!['png', 'webp', 'jpeg'].includes(meta.format)) throw new AvatarError('invalid-argument', 'Потрібне фото JPEG, PNG або WebP');
  if (meta.width * meta.height > 40e6) throw new AvatarError('invalid-argument', 'Завелике фото');
  return sharp(buf).rotate().resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
}
/* шаблон для моделі: прозорий фон заливаємо білим — так модель краще бачить силует */
function templatePng() {
  return require('sharp')(filePath('img/ava/' + PHOTO_TEMPLATE + '-base.webp')).flatten({ background: '#ffffff' }).png().toBuffer();
}

async function photo(user, body) {
  if (!user) throw new AvatarError('unauthenticated');
  if (!openai.configured()) throw new AvatarError('unavailable', 'Генерація з фото ще не налаштована (OPENAI_API_KEY)');
  const png = await photoPng(body && body.image);
  const key = crypto.randomBytes(12).toString('hex');
  const c = await pool.connect();
  try {
    await c.query('begin');
    const r = await c.query('select data from docs where path = $1 for update', ['heroes/' + user.uid]);
    if (!r.rows.length) throw new AvatarError('permission-denied', 'Героя з фото створює сам Герой');
    const hero = r.rows[0].data, g = hero.avatarGen;
    if (g && g.kind === 'photo' && g.status === 'queued' && !photoStale(g)) throw new AvatarError('aborted', 'Твій герой уже малюється — зачекай');
    const limit = photoRateOk(user.uid);
    if (limit) throw new AvatarError('resource-exhausted', limit);
    await writeDoc(c, 'heroes/' + user.uid, Object.assign({}, hero, {
      avatarGen: { kind: 'photo', key, base: null, status: 'queued', at: Date.now() }, updatedAt: { $ts: Date.now() } }));
    await c.query('commit');
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
  notePhoto(user.uid);
  drawPhoto(user.uid, key, png);   // малюється у фоні (до хвилини-двох); стан — GET /api/avatar/status
  return { status: 'queued', key };
}

async function drawPhoto(uid, key, png) {
  let file = null;
  try {
    const out = await openai.portrait(await templatePng(), png);
    const files = await makeFiles(out, PHOTO_TEMPLATE);
    file = key.slice(0, 12) + '-' + Date.now().toString(36);
    files.base = files.full;          // герой з фото — сам собі базове зображення для «Одягти»
    saveFiles(file, files);
    const base = 'gen/' + file;
    const c = await pool.connect();
    try {
      await c.query('begin');
      const r = await c.query('select data from docs where path = $1 for update', ['heroes/' + uid]);
      const hero = r.rows[0].data, g = hero.avatarGen || {};
      const gen = { kind: 'photo', base, key, status: 'ready', file, at: g.at || Date.now(), readyAt: Date.now() };
      if (g.key === key) await setAvatar(c, uid, hero, genToken(file), gen);
      else {
        // поки малювалось, Герой обрав інше — новий герой лише чекає в «Моїх колекціях»
        await writeDoc(c, 'heroes/' + uid, Object.assign({}, hero,
          { avatarCollection: addToCollection(hero, { key, file, base, at: Date.now() }) }));
      }
      await c.query('commit');
    } catch (e) {
      await c.query('rollback').catch(() => {});
      throw e;
    } finally {
      c.release();
    }
    return { ok: true, file };
  } catch (e) {
    if (file) removeFiles(file);
    try { console.error('[avatar/photo]', uid, e && e.message || e); } catch (_) {}
    await failPhoto(uid, key, e instanceof openai.ImageError ? 'Не вдалося намалювати — спробуй інше фото або пізніше' : 'Щось пішло не так — спробуй ще раз')
      .catch(() => {});
    return { ok: false, error: String(e && e.message || e) };
  }
}
async function failPhoto(uid, key, error) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    const r = await c.query('select data from docs where path = $1 for update', ['heroes/' + uid]);
    const hero = r.rows.length && r.rows[0].data, g = hero && hero.avatarGen;
    let out = null;
    if (g && g.key === key && g.status === 'queued') {
      out = Object.assign({}, g, { status: 'failed', error });
      await writeDoc(c, 'heroes/' + uid, Object.assign({}, hero, { avatarGen: out }));
    }
    await c.query('commit');
    return out;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/* ---------- воркер ---------- */
function workerAuth(req) {
  const want = process.env.AVATAR_WORKER_TOKEN || '';
  if (!want) throw new AvatarError('unavailable', 'Воркер аватарів не налаштований (AVATAR_WORKER_TOKEN)');
  const got = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const h = s => crypto.createHash('sha256').update(s).digest();
  if (!got || !crypto.timingSafeEqual(h(got), h(want))) throw new AvatarError('unauthenticated', 'bad worker token');
}

/* Завдання, яке воркер узяв і не повернув за LEASE_MIN, вертається в чергу;
   після MAX_ATTEMPTS спроб — помилка. */
async function sweep(q) {
  q = q || pool;
  const dead = await q.query(
    `update avatar_jobs set status = 'failed', error = coalesce(error, 'lease expired'), updated_at = now()
      where status = 'working' and lease_until < now() and attempts >= $1 returning key`, [MAX_ATTEMPTS]);
  for (const row of dead.rows) await markFailed(q, row.key);
}
async function markFailed(q, key) {
  const hs = await q.query(`select path, data from docs where parent = 'heroes' and data->'avatarGen'->>'key' = $1
                             and data->'avatarGen'->>'status' = 'queued'`, [key]);
  for (const h of hs.rows) {
    await writeDoc(q, h.path, Object.assign({}, h.data, { avatarGen: Object.assign({}, h.data.avatarGen, { status: 'failed' }) }));
  }
}

/* шляхи сайту → повні адреси, щоб воркер міг їх просто завантажити */
function absolute(spec, req) {
  const host = process.env.PUBLIC_URL || ('https://' + (req.headers.host || 'school-king.pp.ua'));
  const abs = p => p ? host.replace(/\/$/, '') + '/' + p : null;
  return Object.assign({}, spec, {
    baseImage: abs(spec.baseImage),
    slots: spec.slots.map(s => Object.assign({}, s, { item: s.item && Object.assign({}, s.item, { image: abs(s.item.image) }) }))
  });
}
const jobOut = (j, req) => ({
  id: Number(j.id), key: j.key, attempt: j.attempts,
  leaseUntil: j.lease_until, leaseSeconds: LEASE_MIN * 60,
  spec: absolute(j.spec, req)
});

async function claim(req, body) {
  workerAuth(req);
  await sweep();
  const r = await pool.query(
    `update avatar_jobs set status = 'working', attempts = attempts + 1, worker = $1,
            lease_until = now() + interval '${LEASE_MIN} minutes', updated_at = now()
      where id = (select id from avatar_jobs
                   where status = 'queued' or (status = 'working' and lease_until < now())
                   order by queued_at for update skip locked limit 1)
      returning *`, [String(body.worker || 'worker').slice(0, 64)]);
  return { job: r.rows.length ? jobOut(r.rows[0], req) : null };
}

async function heartbeat(req, body) {
  workerAuth(req);
  const r = await pool.query(
    `update avatar_jobs set lease_until = now() + interval '${LEASE_MIN} minutes', updated_at = now()
      where id = $1 and status = 'working' returning lease_until`, [Number(body.id) || 0]);
  if (!r.rows.length) throw new AvatarError('aborted', 'Завдання вже не в роботі');
  return { ok: true, leaseUntil: r.rows[0].lease_until };
}

async function fail(req, body) {
  workerAuth(req);
  const c = await pool.connect();
  try {
    await c.query('begin');
    const j = (await c.query('select * from avatar_jobs where id = $1 for update', [Number(body.id) || 0])).rows[0];
    if (!j) throw new AvatarError('not-found', 'Немає такого завдання');
    if (j.status !== 'working') throw new AvatarError('aborted', 'Завдання вже не в роботі');
    const err = String(body.error || 'worker error').slice(0, 500);
    const again = body.retry !== false && j.attempts < MAX_ATTEMPTS;
    await c.query(
      `update avatar_jobs set status = $2, error = $3, lease_until = null, updated_at = now(),
              queued_at = case when $2 = 'queued' then now() else queued_at end
        where id = $1`, [j.id, again ? 'queued' : 'failed', err]);
    if (!again) await markFailed(c, j.key);
    await c.query('commit');
    return { ok: true, status: again ? 'queued' : 'failed' };
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/* Картинка від воркера → файли образу: повний зріст у пропорціях бази
   (тоді рамка обличчя з FACE_BOX влучає) + аватарки -256/-96 на тлі вбудованих. */
async function makeFiles(buf, base) {
  const sharp = require('sharp');
  let meta;
  try { meta = await sharp(buf).metadata(); } catch (e) { throw new AvatarError('invalid-argument', 'Це не зображення'); }
  if (!['png', 'webp', 'jpeg'].includes(meta.format)) throw new AvatarError('invalid-argument', 'Потрібен PNG, WebP або JPEG');
  if (meta.width * meta.height > 40e6) throw new AvatarError('invalid-argument', 'Завелике зображення');
  const bm = await sharp(filePath('img/ava/' + base + '-base.webp')).metadata();
  const H = Math.min(1448, Math.max(bm.height, meta.height));
  const W = Math.round(H * bm.width / bm.height);
  const full = await sharp(buf).rotate()
    .resize(W, H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90, alphaQuality: 90 }).toBuffer();
  const fb = FACE_BOX[isPhotoBase(base) ? PHOTO_TEMPLATE : base] || FACE_DEFAULT;
  const left = Math.round(fb.left * W), top = Math.round(fb.top * H);
  const s = Math.max(16, Math.min(Math.round(fb.size * W), W - left, H - top));
  const head = await sharp(full).extract({ left, top, width: s, height: s }).resize(256, 256).png().toBuffer();
  const sky = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0" stop-color="#bee3fb"/><stop offset="1" stop-color="#7bb4e7"/></linearGradient></defs>'
    + '<rect width="256" height="256" fill="url(#g)"/></svg>');
  const face256 = await sharp(sky).composite([{ input: head }]).webp({ quality: 88 }).toBuffer();
  const face96 = await sharp(face256).resize(96, 96).webp({ quality: 88 }).toBuffer();
  return { full, face256, face96 };
}
function saveFiles(file, f) {
  const dir = avatarDir();
  fs.mkdirSync(dir, { recursive: true });
  [['full', f.full], ['256', f.face256], ['96', f.face96], ['base', f.base]].forEach(([suf, b]) => {
    if (!b) return;
    const p = path.join(dir, `${file}-${suf}.webp`);
    fs.writeFileSync(p + '.tmp', b);
    fs.renameSync(p + '.tmp', p);
  });
}
function removeFiles(file) {
  ['full', '256', '96', 'base'].forEach(suf => { try { fs.unlinkSync(path.join(avatarDir(), `${file}-${suf}.webp`)); } catch (e) {} });
}

async function result(req, body) {
  workerAuth(req);
  const id = Number(body.id) || 0;
  const j0 = (await pool.query('select key, spec, status from avatar_jobs where id = $1', [id])).rows[0];
  if (!j0) throw new AvatarError('not-found', 'Немає такого завдання');
  const buf = Buffer.from(String(body.image || '').replace(/^data:[^,]*,/, ''), 'base64');
  if (!buf.length) throw new AvatarError('invalid-argument', 'Немає зображення (image: base64)');
  if (buf.length > MAX_IMAGE) throw new AvatarError('invalid-argument', 'Завелике зображення');
  const files = await makeFiles(buf, j0.spec.base);
  const file = j0.key.slice(0, 12) + '-' + Date.now().toString(36);
  saveFiles(file, files);

  const c = await pool.connect();
  let old = null, heroes = 0;
  try {
    await c.query('begin');
    const j = (await c.query('select * from avatar_jobs where id = $1 for update', [id])).rows[0];
    old = j.file;
    await c.query(`update avatar_jobs set status = 'done', file = $2, error = null, lease_until = null,
                          done_at = now(), updated_at = now() where id = $1`, [id, file]);
    // хто чекав цей набір (або носить попередню версію образу) — отримує новий
    const hs = await c.query(
      `select path, data from docs where parent = 'heroes' and data->'avatarGen'->>'key' = $1 for update`, [j.key]);
    for (const h of hs.rows) {
      const g = h.data.avatarGen || {};
      const wearing = g.status === 'ready' && GEN_RE.test(String(h.data.avatar || ''));
      // поки малювалось, Герой обрав інший аватар — не перебиваємо його вибір
      if ((g.status !== 'queued' && g.status !== 'failed' && !wearing) || baseOf(h.data) !== g.base) continue;
      await setAvatar(c, h.path.split('/')[1], h.data, genToken(file),
        Object.assign({}, g, { status: 'ready', file, readyAt: Date.now() }));
      heroes++;
    }
    // перемальований набір має новий файл — оновити його в колекціях (старий файл зараз видалимо)
    const cs = await c.query(
      `select path, data from docs where parent = 'heroes' and data->'avatarCollection' @> $2::jsonb for update`,
      [j.key, JSON.stringify([{ key: j.key }])]);
    for (const h of cs.rows) {
      const list = collectionOf(h.data);
      if (!list.some(x => x.key === j.key && x.file !== file)) continue;
      await writeDoc(c, h.path, Object.assign({}, h.data,
        { avatarCollection: list.map(x => x.key === j.key ? Object.assign({}, x, { file }) : x) }));
    }
    await c.query('commit');
  } catch (e) {
    await c.query('rollback').catch(() => {});
    removeFiles(file);
    throw e;
  } finally {
    c.release();
  }
  if (old && old !== file) removeFiles(old);
  return { ok: true, file, avatar: genToken(file), heroes };
}

/* ---------- адмінка ---------- */
async function adminJobs() {
  const r = await pool.query(
    `select id, key, status, attempts, worker, error, file, spec->>'base' as base, (spec->>'filled')::int as filled,
            created_at, queued_at, done_at, updated_at
       from avatar_jobs order by updated_at desc limit 100`);
  return { jobs: r.rows.map(x => Object.assign(x, { id: Number(x.id) })) };
}
/* перемалювати набір (новий workflow, невдалий результат): Герої бачать старий образ, доки не прийде новий */
async function adminRequeue(body) {
  const r = await pool.query(
    `update avatar_jobs set status = 'queued', attempts = 0, error = null, worker = null, lease_until = null,
            queued_at = now(), updated_at = now() where key = $1 and status <> 'working' returning id`, [String(body.key || '')]);
  if (!r.rows.length) throw new AvatarError('not-found', 'Немає такого набору (або він саме малюється)');
  return { ok: true };
}

module.exports = {
  AvatarError, SLOTS, FACE_BOX, COLLECTION_MAX, buildSpec, baseOf, promptOf, makeFiles,
  PHOTO_TEMPLATE, collectionOf, addToCollection, render, status, wear, forget, photo, photoPng, claim, heartbeat, result, fail, adminJobs, adminRequeue
};

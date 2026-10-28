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
   Кожен образ — у двох позах: прямо (<файл>-full.webp, hero.html і мініатюри -256/-96)
   і бойова (<файл>-fight.webp, арена). Пари поз вбудованих героїв — FIGHT_PAIRS.
   «✨ Одягти GPT» (POST /api/avatar/render-gpt) — той самий набір, але малює OpenAI
   прямо з сервера (drawGpt): для порівняння з воркером. Окремий ключ набору (gptKey),
   завдання в avatar_jobs з engine 'gpt' воркер не бере. Лише для GPT_HEROES.
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
  /* у «Щитах» є й не щити (плащ матадора, кришталева куля): слово «shield» змушувало
     модель малювати щит — тож лише «річ у лівій руці», а що саме — каже опис і малюнок */
  return item && item.category === 'Щити'
    ? { label: 'захист у лівій руці', en: 'defensive item held in the left hand, drawn exactly as on its picture' }
    : { label: 'зброя в лівій руці', en: 'weapon held in the left hand' };
}

/* Де обличчя на базовому зображенні (частки ширини/висоти) — з нього ріжемо
   маленькі аватарки -256/-96, як у вбудованих героїв. Знайдено зіставленням
   img/ava/<id>-256.webp з <id>-full.webp. */
const FACE_BOX = {
  // шаблони для вибору (нейтральний одяг, руки видно)
  'kid-fair-boy':     { left: 0.173, top: 0, size: 0.720 },
  'kid-fair-girl':    { left: 0.096, top: 0, size: 0.720 },
  'kid-ginger-boy':   { left: 0.153, top: 0, size: 0.721 },
  'kid-ginger-girl':  { left: 0.101, top: 0, size: 0.721 },
  'kid-dark-girl':    { left: 0.096, top: 0, size: 0.719 },
  'kid-dark-boy':     { left: 0.165, top: 0, size: 0.720 },
  // малюки (дошкілля)
  'tot-dark-boy':     { left: 0.093, top: 0, size: 0.779 },
  'tot-dark-girl':    { left: 0.108, top: 0, size: 0.779 },
  'tot-fair-boy':     { left: 0.117, top: 0, size: 0.780 },
  'tot-fair-girl':    { left: 0.141, top: 0, size: 0.779 },
  'tot-ginger-girl':  { left: 0.081, top: 0, size: 0.780 },
  'tot-olive-boy':    { left: 0.111, top: 0, size: 0.780 },
  // старі герої — img/ava/чернетки-аватара/ (лише для тих, хто обрав їх раніше)
  'fair-boy':        { left: 0.020, top: 0, size: 0.750 },
  'fair-boy-fight':  { left: 0.060, top: 0, size: 0.540 },
  'fair-girl':       { left: 0.090, top: 0, size: 0.720 },
  'fair-girl-fight': { left: 0.100, top: 0, size: 0.640 },
  'linen-boy':       { left: 0.242, top: 0, size: 0.513 },
  'linen-boy-fight': { left: 0.197, top: 0, size: 0.590 },
  'blond-boy':          { left: 0.113, top: 0, size: 0.680 },
  'blond-boy-fight':    { left: 0.053, top: 0, size: 0.565 },
  'chestnut-boy':       { left: 0.100, top: 0, size: 0.595 },
  'chestnut-boy-fight': { left: 0.058, top: 0, size: 0.400 },
  'hoodie-boy-fight':   { left: 0.114, top: 0, size: 0.480 },
  'glasses-girl-fight': { left: 0.053, top: 0, size: 0.533 }
};
const FACE_DEFAULT = { left: 0.2, top: 0, size: 0.6 };
/* пряма поза → бойова: образ малюється в обох (арена показує бойову) */
const FIGHT_PAIRS = { 'fair-boy': 'fair-boy-fight', 'fair-girl': 'fair-girl-fight', 'linen-boy': 'linen-boy-fight', 'blond-boy': 'blond-boy-fight', 'chestnut-boy': 'chestnut-boy-fight' };

// версія набору й промпту: змінив PROMPT/SLOTS — підніми, і старий кеш не підхопиться
const SPEC_VERSION = 5;   // 2: дві пози (fightImage); 3: база на полотні з запасом (CANVAS_PAD); 4: описи речей і де сидять шапка/наручі; 5: рукави верхнього одягу, пояс на талії під ним, не-щити в лівій руці
const MAX_ATTEMPTS = 3;
const LEASE_MIN = 10;
const MAX_RENDER_MIN = 120;        // від натискання «Одягти» до готового образу — не довше; далі завдання — помилка
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
// «Одягти GPT»: кому доступно (логін або ім'я Героя) і скільки нових образів на добу
const GPT_HEROES = () => String(process.env.AVATAR_GPT_HEROES || 'vova,testim').toLowerCase().split(',').map(x => x.trim()).filter(Boolean);
const GPT_PER_DAY = Number(process.env.AVATAR_GPT_PER_DAY) || 20;
const GPT_LEASE_MIN = 15;          // довше «малюється» — сервер перезапускався, завдання — помилка

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

/* пряма поза для бази: вибрав бойового джуру — образ однаково малюється з прямого */
function standOf(base) {
  return Object.keys(FIGHT_PAIRS).find(k => FIGHT_PAIRS[k] === base) || base;
}
/* базове зображення пози; для героя з фото бойова база лежить поруч: <файл>-fight-base.webp */
/* старі вбудовані герої лежать у чернетках: у вибір не потрапляють, але хто вже їх обрав
   (і шаблон героя з фото) — малюються з тих самих файлів */
const DRAFTS_DIR = 'img/ava/чернетки-аватара/';
const DRAFTS = new Set(['linen-boy', 'linen-boy-fight', 'blond-boy', 'blond-boy-fight', 'chestnut-boy', 'chestnut-boy-fight',
  'hoodie-boy-fight', 'glasses-girl-fight', 'fair-boy', 'fair-boy-fight', 'fair-girl', 'fair-girl-fight']);
const avaFile = id => (DRAFTS.has(id) ? DRAFTS_DIR : 'img/ava/') + id;
function baseImageOf(base, pose) {
  if (pose !== 'fight') return avaFile(base) + '-base.webp';
  if (isPhotoBase(base)) return 'img/ava/' + base + '-fight-base.webp';
  return FIGHT_PAIRS[base] ? avaFile(FIGHT_PAIRS[base]) + '-base.webp' : null;
}

/* Набір для генерації. items — каталог {id: дані}, has(rel) — чи є файл на сайті. */
function buildSpec(hero, items, has) {
  has = has || exists;
  const own = baseOf(hero);
  if (!own) throw new AvatarError('failed-precondition', 'Спершу обери героя-аватар (не смайлик)');
  const base = standOf(own);
  const baseImage = baseImageOf(base, 'stand');
  const fight = baseImageOf(base, 'fight');
  const fightImage = fight && has(fight) ? fight : null;   // немає бойової бази — лише пряма поза
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
      look: b.look ? String(b.look).slice(0, 200) : null,   // опис вигляду (items/<id>.look), якщо вже є
      image: has('img/items/' + id + '.webp') ? 'img/items/' + id + '.webp' : null
    } : null;
    return Object.assign({ slot: s.slot }, slotLabel(s, item), { item });
  });
  const filled = slots.filter(s => s.item).length;
  const key = crypto.createHash('sha256')
    .update(JSON.stringify([SPEC_VERSION, base, slots.map(s => s.item && s.item.id)]))
    .digest('hex').slice(0, 24);
  return { version: SPEC_VERSION, key, base, baseImage, fightImage, total: SLOTS.length, filled, slots, prompt: promptOf(slots) };
}

/* Де саме сидять речі — модель інакше «підвішує» шапку над волоссям, а наручі
   зливає з рукавицями (так було на воркері ComfyUI). */
function placementRules(on) {
  const has = slot => on.some(s => s.slot === slot);
  const r = [];
  if (has('helmet')) r.push('The headwear sits firmly ON the head: its inner rim touches the hair and forehead, no gap and no floating above the head; the head size stays the same.');
  /* шолом із наносником: пластина «з'їжджала» на око (звіт 21.10) */
  if (has('helmet')) r.push('A helmet sits straight and centred on the head, not tilted or shifted to one side; its lower rim rests just above the eyebrows. '
    + 'If it has a nose guard (a metal nasal bar), the bar hangs straight down the vertical centre line of the face, exactly over the bridge of the nose between the eyes, '
    + 'ending at the tip of the nose; the eyes stay fully visible on both sides of it.');
  /* «Шкільний жакет» малювався жилетом без рукавів, пояс — низько на стегнах поверх одягу (звіти 11.10, 17.10) */
  if (has('armor')) r.push('The outer garment keeps its sleeves exactly as on its picture: a jacket, blazer or coat has full-length sleeves down to the wrists — never turn it into a sleeveless vest.');
  if (has('belt')) r.push('The belt sits at the natural waist (navel height), not low on the hips'
    + (has('armor') ? ', and it is worn UNDER the outer garment: the jacket or armour hem overlaps the belt, only the buckle may peek through the open front.' : '.'));
  if (on.some(s => s.slot === 'weaponL' && s.item.category === 'Щити'))
    r.push('The left-hand item keeps the exact shape and material of its picture: a cloth cape stays soft fabric, an orb stays a sphere — draw a shield only if the picture is a shield.');
  if (has('bracers')) r.push('Bracers are separate armour pieces strapped around BOTH forearms between wrist and elbow, clearly visible over the sleeves'
    + (has('gloves') ? ', above the gloves (gloves cover only the hands).' : '; the hands stay bare.'));
  return r;
}

/* Підказка для моделі (англійською — так її краще розуміють). Воркер може
   скласти свою з полів slots; назви речей — як у грі, українською. */
function promptOf(slots) {
  const on = slots.filter(s => s.item);
  return [
    'Image 1 is the base character. Image 2 is a reference sheet of clothing and gear; every item on it is captioned with its slot.',
    'Dress the character from image 1 in exactly these items:',
    ...on.map(s => `- ${s.en}: "${s.item.name}"` + (s.item.weaponType ? ` (${s.item.weaponType})` : '')
      + (s.item.look ? ` — ${s.item.look}` : '')),
    'Each item replaces the matching part of the base outfit; parts without an item keep the base outfit from image 1.',
    ...placementRules(on),
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
    next.avatarCollection = addToCollection(hero, Object.assign({ key: gen.key, file: gen.file, base: gen.base, at: Date.now() },
      gen.engine ? { engine: gen.engine } : {}));
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
/* готовий образ, який Герой уже не чекає (змінив аватар): у колекцію, без зміни аватара */
async function setAside(c, p, hero, file) {
  const g = hero.avatarGen || {};
  const next = Object.assign({}, hero, { avatarGen: Object.assign({}, g, { status: 'cancelled' }), updatedAt: { $ts: Date.now() } });
  if (file) next.avatarCollection = addToCollection(hero, Object.assign({ key: g.key, file, base: g.base, at: Date.now() },
    g.engine ? { engine: g.engine } : {}));
  await writeDoc(c, p, next);
  return next;
}
/* Герой «в черзі», а завдання вже готове / скасоване / зникло — розвʼязати стан:
   готовий образ тієї самої бази — одягнути, інакше — у колекцію й зняти очікування.
   Вертає оновленого Героя */
async function settle(uid, key) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    const r = await c.query('select data from docs where path = $1 for update', ['heroes/' + uid]);
    const hero = r.rows.length && r.rows[0].data, g = hero && hero.avatarGen;
    let out = hero || null;
    if (g && g.key === key && g.status === 'queued') {
      const j = (await c.query('select status, file from avatar_jobs where key = $1', [key])).rows[0];
      if (j && j.status === 'done' && j.file && standOf(baseOf(hero)) === g.base) {
        out = await setAvatar(c, uid, hero, genToken(j.file), Object.assign({}, g, { status: 'ready', file: j.file, readyAt: Date.now() }));
      } else if (!j || j.status === 'done' || j.status === 'cancelled') {
        out = await setAside(c, 'heroes/' + uid, hero, j && j.status === 'done' ? j.file : null);
      }
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
const waitingSql = `parent = 'heroes' and data->'avatarGen'->>'key' = $1 and data->'avatarGen'->>'status' = 'queued'`;

async function position(q, key) {
  const r = await q.query(
    `select count(*)::int as n from avatar_jobs
      where status = 'queued' and queued_at <= (select queued_at from avatar_jobs where key = $1)`, [key]);
  return r.rows[0].n;
}

function gptAllowed(hero) {
  const list = GPT_HEROES();
  return [hero && hero.login, hero && hero.name].some(x => x && list.includes(String(x).trim().toLowerCase()));
}
// окремий кеш для GPT: той самий набір, намальований OpenAI, — інший образ
const gptKey = key => crypto.createHash('sha256').update('gpt:' + key).digest('hex').slice(0, 24);
const gptRecent = new Map();
function gptRateOk(uid) {
  const now = Date.now(), a = (gptRecent.get(uid) || []).filter(t => now - t < 864e5);
  gptRecent.set(uid, a);
  return a.length < GPT_PER_DAY;
}

/* engine: 'gpt' — «✨ Одягти GPT», інакше — черга воркера (відеокарта) */
async function render(user, engine) {
  if (!user) throw new AvatarError('unauthenticated');
  const gpt = engine === 'gpt';
  if (gpt && !openai.configured()) throw new AvatarError('unavailable', 'Ключ OpenAI не задано (адмінка)');
  let start = null;   // GPT-завдання, яке треба почати малювати після commit
  const c = await pool.connect();
  try {
    await c.query('begin');
    const r = await c.query('select data from docs where path = $1 for update', ['heroes/' + user.uid]);
    if (!r.rows.length) throw new AvatarError('permission-denied', 'Образ одягає сам Герой');
    const hero = r.rows[0].data;
    if (gpt && !gptAllowed(hero)) throw new AvatarError('permission-denied', '«Одягти GPT» поки що лише для тестових Героїв');
    // GPT уже малює для цього Героя (друга вкладка, повторне натискання) — не платимо вдруге
    const cur = hero.avatarGen;
    if (cur && cur.engine === 'gpt' && cur.status === 'queued' && Date.now() - (cur.at || 0) < GPT_LEASE_MIN * 60e3)
      throw new AvatarError('aborted', 'GPT уже малює твій образ — зачекай, він зʼявиться сам');
    const items = {};
    (await c.query(`select id, data from docs where parent = 'items'`)).rows.forEach(x => { items[x.id] = x.data; });
    const spec = buildSpec(hero, items);
    if (gpt) Object.assign(spec, { engine: 'gpt', key: gptKey(spec.key) });
    const prev = hero.avatarGen || null;
    const gen = Object.assign({ base: spec.base, key: spec.key, at: Date.now() }, gpt ? { engine: 'gpt' } : {});
    let out;

    if (!spec.filled) {
      // нічого не вдягнено — просто базовий аватар, малювати нічого
      const plain = 'hero:' + baseOf(hero);   // яку позу обрав, ту й лишаємо
      await setAvatar(c, user.uid, hero, plain, Object.assign(gen, { status: 'ready', file: null }));
      out = { status: 'ready', avatar: plain };
    } else {
      const j = (await c.query('select * from avatar_jobs where key = $1 for update', [spec.key])).rows[0];
      if (j && j.status === 'done' && j.file) {
        await setAvatar(c, user.uid, hero, genToken(j.file), Object.assign(gen, { status: 'ready', file: j.file }));
        out = { status: 'ready', avatar: genToken(j.file) };
      } else if (gpt) {
        if (!j || j.status !== 'working') {
          if (!gptRateOk(user.uid)) throw new AvatarError('resource-exhausted', 'На сьогодні досить образів GPT — спробуй завтра');
          gptRecent.get(user.uid).push(Date.now());
          // одразу 'working' з орендою: воркер такі не бере (claim), сервер малює сам після commit
          const row = (await c.query(
            `insert into avatar_jobs (key, spec, status, attempts, worker, lease_until) values ($1, $2, 'working', 1, 'openai', now() + interval '${GPT_LEASE_MIN} minutes')
             on conflict (key) do update set status = 'working', spec = excluded.spec, attempts = 1, error = null, worker = 'openai',
               lease_until = excluded.lease_until, queued_at = now(), updated_at = now() returning id`, [spec.key, JSON.stringify(spec)])).rows[0];
          start = { id: Number(row.id), spec };
        }
        await writeDoc(c, 'heroes/' + user.uid, Object.assign({}, hero, { avatarGen: Object.assign(gen, { status: 'queued' }), updatedAt: { $ts: Date.now() } }));
        out = { status: 'working' };
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
    if (start) drawGpt(start.id, start.spec);   // у фоні; стан — GET /api/avatar/status
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
  const out = { avatar: hero.avatar || null, gen: g, gpt: gptAllowed(hero) && openai.configured() };
  if (g && g.key && (g.status === 'queued' || g.status === 'failed') && g.kind !== 'photo') {
    let j = (await pool.query('select status, attempts, error from avatar_jobs where key = $1', [g.key])).rows[0];
    if (g.status === 'queued' && (!j || j.status === 'done' || j.status === 'cancelled')) {
      const h = await settle(user.uid, g.key);
      if (h) { g = out.gen = h.avatarGen || null; out.avatar = h.avatar || null; }
      j = null;
    }
    if (j) {
      out.job = { status: j.status, attempts: j.attempts };
      if (j.status === 'queued') out.job.position = await position(pool, g.key);
      // чому не вдалось (напр. відповідь OpenAI) — Герой бачить це в повідомленні
      if (j.status === 'failed' && j.error) out.job.error = String(j.error).slice(0, 200);
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
      Object.assign({ base: entry.base, key: entry.key, at: Date.now(), status: 'ready', file: j.file, readyAt: Date.now() },
        entry.engine ? { engine: entry.engine } : {}));
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

/* ---------- «✨ Одягти GPT»: той самий набір малює OpenAI ---------- */
const OPENAI_SIZES = [[1024, 1024], [1024, 1536], [1536, 1024]];
/* полотно → розмір OpenAI: доповнюємо полотно до пропорцій виходу (білим: з боків
   або зверху, ноги лишаються внизу), а з результату вирізаємо назад саме полотно */
async function openaiFrame(png) {
  const sharp = require('sharp');
  const m = await sharp(png).metadata(), a = m.width / m.height;
  let best = null;
  for (const [sw, sh] of OPENAI_SIZES) {
    const as = sw / sh;
    const W = a < as ? Math.round(m.height * as) : m.width, H = a < as ? m.height : Math.round(m.width / as);
    const waste = W * H - m.width * m.height;
    if (!best || waste < best.waste) best = { sw, sh, W, H, waste };
  }
  const padL = Math.floor((best.W - m.width) / 2), padT = best.H - m.height;
  const framed = await sharp(png).extend({ left: padL, right: best.W - m.width - padL, top: padT, bottom: 0,
    background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toBuffer();
  return { png: framed, size: best.sw + 'x' + best.sh,
    crop: { left: padL / best.W, top: padT / best.H, width: m.width / best.W, height: m.height / best.H } };
}
async function unframe(out, crop) {
  const sharp = require('sharp'), m = await sharp(out).metadata();
  const left = Math.round(crop.left * m.width), top = Math.round(crop.top * m.height);
  return sharp(out).extract({ left, top, width: Math.min(m.width - left, Math.round(crop.width * m.width)),
    height: Math.min(m.height - top, Math.round(crop.height * m.height)) }).png().toBuffer();
}
/* Речі — ОДНІЄЮ картинкою-аркушем (сітка, без підписів: номер клітинки = номер у промпті).
   Раніше кожна річ ішла окремою картинкою: 9–10 вхідних зображень робили запит дорогим
   (вхідні картинки теж оплачуються) і довгим — довшим за тайм-аут, а оплата все одно знімалась. */
const SHEET_CELL = 256;
function sheetGrid(n) { const cols = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(n)))); return { cols, rows: Math.ceil(n / cols) }; }
/* номер клітинки: кружечок і цифри «семисегментними» лініями — на сервері немає шрифтів */
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
function digitsSvg(n, cx, cy) {
  const ds = String(n), w = 9, h = 18, gap = 5, total = ds.length * w + (ds.length - 1) * gap;
  let out = `<circle cx="${cx}" cy="${cy}" r="20" fill="#222"/>`;
  [...ds].forEach((d, i) => {
    const x = cx - total / 2 + i * (w + gap), y = cy - h / 2, m = y + h / 2;
    const L = { a: [x, y, x + w, y], b: [x + w, y, x + w, m], c: [x + w, m, x + w, y + h], d: [x, y + h, x + w, y + h],
      e: [x, m, x, y + h], f: [x, y, x, m], g: [x, m, x + w, m] };
    for (const s of SEG[d]) out += `<line x1="${L[s][0]}" y1="${L[s][1]}" x2="${L[s][2]}" y2="${L[s][3]}" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`;
  });
  return out;
}
async function itemSheet(images) {
  const sharp = require('sharp'), g = sheetGrid(images.length), pad = 26, inner = SHEET_CELL - 2 * pad;
  const W = g.cols * SHEET_CELL, H = g.rows * SHEET_CELL;
  const tiles = [];
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
  for (let i = 0; i < images.length; i++) {
    const x = (i % g.cols) * SHEET_CELL, y = Math.floor(i / g.cols) * SHEET_CELL;
    const t = await sharp(images[i]).resize(inner, inner, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer();
    tiles.push({ input: t, left: x + pad, top: y + pad });
    svg += `<rect x="${x + .5}" y="${y + .5}" width="${SHEET_CELL - 1}" height="${SHEET_CELL - 1}" fill="none" stroke="#ccc"/>` + digitsSvg(i + 1, x + 24, y + 24);
  }
  return sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } })
    .composite(tiles.concat([{ input: Buffer.from(svg + '</svg>') }])).png().toBuffer();
}

/* описи речей для промпту: з картки речі (items/<id>.look), а яких немає — один раз просимо в
   OpenAI і зберігаємо в картку. Не вийшло — промпт обійдеться назвою. */
async function itemLooks(slots) {
  const ids = slots.filter(s => s.item && s.item.image).map(s => s.item.id), looks = {};
  if (!ids.length) return looks;
  const r = await pool.query(`select id, data->>'look' as look from docs where parent = 'items' and id = any($1::text[])`, [ids]);
  r.rows.forEach(x => { if (x.look) looks[x.id] = x.look; });
  for (const s of slots) {
    const id = s.item && s.item.image && s.item.id;
    if (!id || looks[id]) continue;
    try {
      looks[id] = await openai.describe(await require('sharp')(filePath(s.item.image)).png().toBuffer());
      await pool.query(`update docs set data = jsonb_set(data, '{look}', to_jsonb($2::text)), updated_at = now() where path = $1`,
        ['items/' + id, looks[id]]);
    } catch (e) {
      try { console.error('[avatar/gpt] опис речі', id, e && e.message || e); } catch (_) {}
    }
  }
  return looks;
}
/* промпт GPT: картинка 1 — база на полотні, картинка 2 — аркуш речей, 3 (бойова поза) — готовий прямий образ */
function gptPrompt(slots, withRef, looks) {
  looks = looks || {};
  const on = slots.filter(s => s.item);
  const pics = on.filter(s => s.item.image), g = sheetGrid(pics.length);
  const what = s => `${s.en}: "${s.item.name}"` + (s.item.weaponType ? ` (${s.item.weaponType})` : '')
    + ((looks[s.item.id] || s.item.look) ? ` — ${looks[s.item.id] || s.item.look}` : '');
  const empty = ['weaponR', 'weaponL'].filter(k => !on.some(s => s.slot === k))
    .map(k => k === 'weaponR' ? 'The right hand holds nothing.' : 'The left hand holds nothing.');
  const lines = pics.map((s, i) => `- cell ${i + 1} → ${what(s)}`)
    .concat(on.filter(s => !s.item.image).map(s => `- ${what(s)} (no picture, draw it from the name)`));
  const ref = withRef ? (pics.length ? 3 : 2) : 0;
  return [
    'Image 1 is the base character on a canvas with empty margins on the sides and top; the margins are room for long weapons and tall hats.',
    'EDIT image 1 — do not create a new character.',
    pics.length ? `Image 2 is a sheet of ${pics.length} items in a grid of ${g.rows} row(s) × ${g.cols} column(s); each cell has its number in the top-left corner (left to right, top to bottom).` : '',
    'Dress the character from image 1 in exactly these items, each in its slot:',
    ...lines,
    ...empty,
    'Copy each item EXACTLY as drawn in image 2 — the same shape, colours, materials and details.',
    'Do not add gold trim, gems, capes, cloaks, tunics, skirts, quivers or any decoration or item that is not in the list.',
    ref ? `Image ${ref} is the same character already dressed in these items: keep the outfit, colours and details identical, only use the pose of image 1.` : '',
    'Each item replaces the matching part of the base outfit; parts without an item keep the base outfit from image 1.',
    ...placementRules(on),
    'The face must stay EXACTLY as in image 1: same face shape, eyes, eyebrows, nose, mouth, expression, skin tone and hairstyle — do not redraw or replace it.',
    'Keep the same body proportions, pose, camera framing, position and scale of the character as in image 1.',
    'Long weapons may extend into the empty margins but must not be cropped. Cartoon 3D art style as image 1.',
    'No text, no other objects. Transparent background.'
  ].filter(Boolean).join('\n');
}
async function gptPose(spec, pose, items, ref, looks) {
  const frame = await openaiFrame(await canvasPng(spec.base, pose, true));
  // готовий прямий образ — зменшений: це лише підказка вбрання, а великі картинки дорожчі
  const small = ref ? await require('sharp')(ref).resize({ height: 768, withoutEnlargement: true }).png().toBuffer() : null;
  const images = [frame.png].concat(items, small ? [small] : []);
  const out = await openai.edit(images, gptPrompt(spec.slots, !!ref, looks), { size: frame.size });
  return unframe(out, frame.crop);
}
async function drawGpt(id, spec) {
  try {
    const sharp = require('sharp');
    const pics = [];
    for (const s of spec.slots) if (s.item && s.item.image) pics.push(await sharp(filePath(s.item.image)).png().toBuffer());
    const items = pics.length ? [await itemSheet(pics)] : [];
    const looks = await itemLooks(spec.slots);   // описи речей (один раз на річ, потім — з картки)
    const stand = await gptPose(spec, 'stand', items, null, looks);
    saveRaw(id, 'stand', stand);   // оплачено — зберігаємо одразу, ще до обробки
    let fight = null;
    if (spec.fightImage) {
      try { fight = await gptPose(spec, 'fight', items, stand, looks); saveRaw(id, 'fight', fight); }
      catch (e) { try { console.error('[avatar/gpt] бойова поза:', id, e && e.message || e); } catch (_) {} }   // арена покаже пряму
    }
    await applyResult({ id, image: stand.toString('base64'), fight: fight ? fight.toString('base64') : '' });
  } catch (e) {
    try { console.error('[avatar/gpt]', id, e && e.message || e); } catch (_) {}
    try {
      const r = await pool.query(`update avatar_jobs set status = 'failed', error = $2, lease_until = null, updated_at = now()
                                   where id = $1 and status = 'working' returning key`, [id, String(e && e.message || e).slice(0, 500)]);
      if (r.rows.length) await markFailed(pool, r.rows[0].key);
    } catch (_) {}
  }
}

/* «Сирі» картинки від OpenAI (останні RAW_KEEP завдань): малюнок уже оплачено, тож
   якщо обробка впаде, адмін застосує його ще раз без нового запиту (adminReapply).
   Файли — <AVATAR_DIR>/raw/<id завдання>-stand|fight.png (nginx: /img/ava/gen/raw/…). */
const RAW_KEEP = 5;
const rawDir = () => path.join(avatarDir(), 'raw');
function rawIds() {
  let names = [];
  try { names = fs.readdirSync(rawDir()); } catch (e) {}
  return [...new Set(names.map(n => (/^(\d+)-(stand|fight)\.png$/.exec(n) || [])[1]).filter(Boolean).map(Number))].sort((a, b) => b - a);
}
function saveRaw(id, pose, png) {
  try {
    fs.mkdirSync(rawDir(), { recursive: true });
    fs.writeFileSync(path.join(rawDir(), `${id}-${pose}.png`), png);
    for (const old of rawIds().slice(RAW_KEEP))
      ['stand', 'fight'].forEach(p => { try { fs.unlinkSync(path.join(rawDir(), `${old}-${p}.png`)); } catch (e) {} });
  } catch (e) {
    try { console.error('[avatar/gpt] сира картинка не збереглась:', id, e && e.message || e); } catch (_) {}
  }
}
const rawHas = (id, pose) => fs.existsSync(path.join(rawDir(), `${id}-${pose}.png`));
async function adminRaw() {
  const ids = rawIds();
  const jobs = {};
  if (ids.length) (await pool.query('select id, status, error, file from avatar_jobs where id = any($1::bigint[])', [ids]))
    .rows.forEach(r => { jobs[Number(r.id)] = r; });
  return { raw: ids.map(id => ({
    id, status: jobs[id] ? jobs[id].status : null, error: jobs[id] ? jobs[id].error : null,
    stand: 'img/ava/gen/raw/' + id + '-stand.png', fight: rawHas(id, 'fight') ? 'img/ava/gen/raw/' + id + '-fight.png' : null
  })) };
}
/* застосувати збережену сиру картинку ще раз (без нового запиту в OpenAI) */
async function adminReapply(body) {
  const id = Number(body && body.id) || 0;
  if (!id || !rawHas(id, 'stand')) throw new AvatarError('not-found', 'Немає збереженої картинки для цього завдання');
  const read = pose => rawHas(id, pose) ? fs.readFileSync(path.join(rawDir(), `${id}-${pose}.png`)).toString('base64') : '';
  return applyResult({ id, image: read('stand'), fight: read('fight') });
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
/* шаблон пози для моделі — на полотні з запасом, фон білий (так модель краще бачить силует) */
const templatePng = pose => canvasPng(PHOTO_TEMPLATE, pose, true);

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
    // 1) пряма поза з фото; 2) бойова — з уже намальованого героя (так обидві пози схожі)
    const out = await openai.portrait(await templatePng('stand'), png);
    const files = await makeFiles(out, PHOTO_TEMPLATE);
    try {
      const fight = await openai.portrait(await templatePng('fight'), out, { prompt: openai.POSE_PROMPT });
      Object.assign(files, await makeFiles(fight, PHOTO_TEMPLATE, 'fight'));
    } catch (e) {
      try { console.error('[avatar/photo] бойова поза:', uid, e && e.message || e); } catch (_) {}   // арена покаже пряму
    }
    file = key.slice(0, 12) + '-' + Date.now().toString(36);
    // герой з фото — сам собі база для «Одягти»: рівно в межах шаблону (тоді й FACE_BOX шаблону влучає)
    files.base = files.region;
    files.fightBase = files.fightRegion;
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
   після MAX_ATTEMPTS спроб — помилка. Не готове за MAX_RENDER_MIN (у черзі чи в роботі) — теж помилка. */
async function sweep(q) {
  q = q || pool;
  const dead = await q.query(
    `update avatar_jobs set status = 'failed', error = coalesce(error, 'lease expired'), updated_at = now()
      where status = 'working' and lease_until < now()
        and (attempts >= $1 or spec->>'engine' = 'gpt') returning key`, [MAX_ATTEMPTS]);
  for (const row of dead.rows) await markFailed(q, row.key);
  // не готове за MAX_RENDER_MIN (воркер вимкнений чи довга черга) — не тримати Героя в очікуванні;
  // «Одягти» поставить знову. Воркер, що ще малює, на heartbeat отримає «aborted»
  const stale = await q.query(
    `update avatar_jobs set status = 'failed', error = $1, lease_until = null, updated_at = now()
      where status in ('queued', 'working') and coalesce(spec->>'engine', '') <> 'gpt'
        and queued_at < now() - interval '${MAX_RENDER_MIN} minutes' returning key`,
    ['Образ не встиг намалюватись за 2 години — спробуй ще раз']);
  for (const row of stale.rows) await markFailed(q, row.key);
}
async function markFailed(q, key) {
  const hs = await q.query(`select path, data from docs where parent = 'heroes' and data->'avatarGen'->>'key' = $1
                             and data->'avatarGen'->>'status' = 'queued'`, [key]);
  for (const h of hs.rows) {
    await writeDoc(q, h.path, Object.assign({}, h.data, { avatarGen: Object.assign({}, h.data.avatarGen, { status: 'failed' }) }));
  }
}

/* шляхи сайту → повні адреси, щоб воркер міг їх просто завантажити */
async function absolute(spec, req) {
  const host = process.env.PUBLIC_URL || ('https://' + (req.headers.host || 'school-king.pp.ua'));
  const abs = p => p ? host.replace(/\/$/, '') + '/' + encodeURI(p) : null;   // чернетки-аватара — кирилиця в шляху
  // з версії 3 воркер малює на полотні з запасом (CANVAS_PAD) — довга зброя не обрізається
  const pad = (spec.version || 1) >= 3;
  const baseImage = pad ? await canvasImage(spec.base, 'stand') : spec.baseImage;
  const fightImage = spec.fightImage && pad ? await canvasImage(spec.base, 'fight') : spec.fightImage;
  return Object.assign({}, spec, {
    prompt: promptOf(spec.slots),   // свіжа підказка: «перемалювати» старий набір — уже з новими правилами
    baseImage: abs(baseImage),
    fightImage: abs(fightImage),
    slots: spec.slots.map(s => Object.assign({}, s, { item: s.item && Object.assign({}, s.item, { image: abs(s.item.image) }) }))
  });
}
const jobOut = async (j, req) => ({
  id: Number(j.id), key: j.key, attempt: j.attempts,
  leaseUntil: j.lease_until, leaseSeconds: LEASE_MIN * 60,
  spec: await absolute(j.spec, req)
});

async function claim(req, body) {
  workerAuth(req);
  await sweep();
  const r = await pool.query(
    `update avatar_jobs set status = 'working', attempts = attempts + 1, worker = $1,
            lease_until = now() + interval '${LEASE_MIN} minutes', updated_at = now()
      where id = (select id from avatar_jobs
                   where (status = 'queued' or (status = 'working' and lease_until < now()))
                     and coalesce(spec->>'engine', '') <> 'gpt'
                   order by queued_at for update skip locked limit 1)
      returning *`, [String(body.worker || 'worker').slice(0, 64)]);
  return { job: r.rows.length ? await jobOut(r.rows[0], req) : null };
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
    // queued_at не скидаємо: MAX_RENDER_MIN рахується від натискання, а не від спроби
    await c.query(
      `update avatar_jobs set status = $2, error = $3, lease_until = null, updated_at = now()
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

/* ПОЛОТНО. Бази обрізані впритул до героя (бойова — від краю до краю), і модель малює
   в тих самих межах: довга зброя (кнут, спис, лук) обрізалась. Тому воркер і OpenAI
   отримують базу з прозорим запасом з боків і зверху (CANVAS_PAD), а готовий результат
   ми обрізаємо по вмісту симетрично від центру (герой лишається посередині, ноги внизу). */
const CANVAS_PAD = { x: 0.35, top: 0.12 };   // частки ширини / висоти бази
const CANVAS_VER = 'v1';                     // змінив CANVAS_PAD — підніми (файли полотен кешуються)
const OUT_H = 1000;                          // зріст героя в готових файлах, px

/* геометрія полотна: розмір бази w×h, запас px (з боків) і pt (зверху), повний W×H */
async function canvasOf(base, pose, padded) {
  const m = await require('sharp')(filePath(baseImageOf(base, pose))).metadata();
  const px = padded ? Math.round(m.width * CANVAS_PAD.x) : 0, pt = padded ? Math.round(m.height * CANVAS_PAD.top) : 0;
  return { w: m.width, h: m.height, px, pt, W: m.width + 2 * px, H: m.height + pt };
}
/* база на полотні (PNG); white — прозорий фон залити білим (так моделі OpenAI видно силует) */
async function canvasPng(base, pose, white) {
  const sharp = require('sharp'), cv = await canvasOf(base, pose, true);
  const bg = white ? { r: 255, g: 255, b: 255, alpha: 1 } : { r: 0, g: 0, b: 0, alpha: 0 };
  let img = sharp(filePath(baseImageOf(base, pose))).extend({ top: cv.pt, left: cv.px, right: cv.px, bottom: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } });
  if (white) img = sharp(await img.png().toBuffer()).flatten({ background: bg });
  return img.png().toBuffer();
}
/* полотно для воркера: файл у каталозі образів (nginx віддає /img/ava/gen/canvas/…) */
async function canvasImage(base, pose) {
  const name = CANVAS_VER + '-' + base.replace(/\//g, '_') + (pose === 'fight' ? '-fight' : '') + '.webp';
  const out = path.join(avatarDir(), 'canvas', name);
  if (!fs.existsSync(out)) {
    const webp = await require('sharp')(await canvasPng(base, pose)).webp({ lossless: true }).toBuffer();
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out + '.tmp', webp);
    fs.renameSync(out + '.tmp', out);
  }
  return 'img/ava/gen/canvas/' + name;
}

/* межі непрозорого вмісту (альфа > 16) */
async function alphaBox(buf) {
  const { data, info } = await require('sharp')(buf).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  let L = info.width, R = -1, T = info.height, B = -1;
  for (let y = 0; y < info.height; y++) {
    const row = y * info.width;
    for (let x = 0; x < info.width; x++) {
      if (data[row + x] > 16) { if (x < L) L = x; if (x > R) R = x; if (y < T) T = y; if (y > B) B = y; }
    }
  }
  return R < 0 ? null : { L, R, T, B };
}

/* Порожні поля геть — щільно по фігурі (з полем M): у рамці 3:4 (арена, hero.html) герой
   тоді великий. Симетрично від центру не можна: зброя з одного боку робила картинку
   майже квадратною, і герой дрібнішав. Низ (ноги) не чіпаємо. → WebP */
async function trimmed(png) {
  const sharp = require('sharp');
  const { width: W, height: H } = await sharp(png).metadata();
  const box = await alphaBox(png), M = 8;
  let out = sharp(png);
  if (box) {
    const left = Math.max(0, box.L - M), top = Math.max(0, box.T - M);
    out = sharp(await out.extract({ left, top, width: Math.min(W, box.R + 1 + M) - left, height: H - top }).png().toBuffer());
  }
  return out.webp({ quality: 86, alphaQuality: 90 }).toBuffer();
}
/* Уже готові образи (до щільної обрізки) — обрізати один раз при старті сервера.
   Лише -full / -fight, де порожнього по боках помітно; мініатюри й бази не чіпаємо. */
async function trimExisting() {
  const sharp = require('sharp');
  let files = [];
  try { files = fs.readdirSync(avatarDir()).filter(f => /-(full|fight)\.webp$/.test(f)); } catch (e) { return 0; }
  let n = 0;
  for (const f of files) {
    try {
      const p = path.join(avatarDir(), f);
      const png = await sharp(fs.readFileSync(p)).png().toBuffer();   // з буфера: sharp кешує файли за шляхом
      const box = await alphaBox(png), m = await sharp(png).metadata();
      if (!box || (box.R - box.L + 1 + 16) / m.width > 0.95) continue;
      fs.writeFileSync(p + '.tmp', await trimmed(png));
      fs.renameSync(p + '.tmp', p);
      n++;
    } catch (e) { console.error('[avatar/trim]', f, e && e.message); }
  }
  return n;
}

/* Картинка від воркера / OpenAI → файли образу. Результат вписуємо в полотно бази
   (тоді рамка обличчя з FACE_BOX влучає), ріжемо аватарки -256/-96 на тлі вбудованих,
   потім обрізаємо порожні поля. pose 'fight' — лише повний зріст ({fight}).
   region — та сама картинка рівно в межах бази (без запасу): база для героя з фото.
   padded = false — старі завдання (SPEC_VERSION < 3), намальовані без запасу. */
async function makeFiles(buf, base, pose, padded) {
  const sharp = require('sharp');
  if (padded === undefined) padded = true;
  let meta;
  try { meta = await sharp(buf).metadata(); } catch (e) { throw new AvatarError('invalid-argument', 'Це не зображення'); }
  if (!['png', 'webp', 'jpeg'].includes(meta.format)) throw new AvatarError('invalid-argument', 'Потрібен PNG, WebP або JPEG');
  if (meta.width * meta.height > 40e6) throw new AvatarError('invalid-argument', 'Завелике зображення');
  const cv = await canvasOf(base, pose, padded);
  const k = OUT_H / cv.h;                               // зріст героя → OUT_H
  const W = Math.round(cv.W * k), H = Math.round(cv.H * k);
  const canvas = await sharp(buf).rotate()
    .resize(W, H, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const rx = Math.round(cv.px * k), ry = Math.round(cv.pt * k);
  const rw = Math.min(W - rx, Math.round(cv.w * k)), rh = H - ry;
  const region = await sharp(canvas).extract({ left: rx, top: ry, width: rw, height: rh }).webp({ quality: 86, alphaQuality: 90 }).toBuffer();
  const full = await trimmed(canvas);
  if (pose === 'fight') return { fight: full, fightRegion: region };
  const fb = FACE_BOX[isPhotoBase(base) ? PHOTO_TEMPLATE : base] || FACE_DEFAULT;
  const left = rx + Math.round(fb.left * cv.w * k), top = ry + Math.round(fb.top * cv.h * k);
  const s = Math.max(16, Math.min(Math.round(fb.size * cv.w * k), W - left, H - top));
  const head = await sharp(canvas).extract({ left, top, width: s, height: s }).resize(256, 256).png().toBuffer();
  const sky = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0" stop-color="#bee3fb"/><stop offset="1" stop-color="#7bb4e7"/></linearGradient></defs>'
    + '<rect width="256" height="256" fill="url(#g)"/></svg>');
  const face256 = await sharp(sky).composite([{ input: head }]).webp({ quality: 88 }).toBuffer();
  const face96 = await sharp(face256).resize(96, 96).webp({ quality: 88 }).toBuffer();
  return { full, face256, face96, region };
}
function saveFiles(file, f) {
  const dir = avatarDir();
  fs.mkdirSync(dir, { recursive: true });
  [['full', f.full], ['256', f.face256], ['96', f.face96], ['base', f.base], ['fight', f.fight], ['fight-base', f.fightBase]].forEach(([suf, b]) => {
    if (!b) return;
    const p = path.join(dir, `${file}-${suf}.webp`);
    fs.writeFileSync(p + '.tmp', b);
    fs.renameSync(p + '.tmp', p);
  });
}
function removeFiles(file) {
  ['full', '256', '96', 'base', 'fight', 'fight-base'].forEach(suf => { try { fs.unlinkSync(path.join(avatarDir(), `${file}-${suf}.webp`)); } catch (e) {} });
}

function result(req, body) {
  workerAuth(req);
  return applyResult(body);
}
/* готові картинки завдання (від воркера або drawGpt) → файли образу, Героям, колекціям */
async function applyResult(body) {
  const id = Number(body.id) || 0;
  const j0 = (await pool.query('select key, spec, status from avatar_jobs where id = $1', [id])).rows[0];
  if (!j0) throw new AvatarError('not-found', 'Немає такого завдання');
  const buf = Buffer.from(String(body.image || '').replace(/^data:[^,]*,/, ''), 'base64');
  if (!buf.length) throw new AvatarError('invalid-argument', 'Немає зображення (image: base64)');
  if (buf.length > MAX_IMAGE) throw new AvatarError('invalid-argument', 'Завелике зображення');
  const padded = (j0.spec.version || 1) >= 3;   // старі завдання малювались без запасу полотна
  const files = await makeFiles(buf, j0.spec.base, 'stand', padded);
  // бойова поза (необов'язкова: без неї арена покаже пряму)
  const fbuf = Buffer.from(String(body.fight || '').replace(/^data:[^,]*,/, ''), 'base64');
  if (fbuf.length > MAX_IMAGE) throw new AvatarError('invalid-argument', 'Завелике зображення (fight)');
  if (fbuf.length && j0.spec.fightImage) Object.assign(files, await makeFiles(fbuf, j0.spec.base, 'fight', padded));
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
      // поки малювалось, Герой обрав інший аватар — не перебиваємо його вибір,
      // але образ кладемо в колекцію й знімаємо «в черзі» (інакше кнопка чекала б вічно)
      if (standOf(baseOf(h.data)) !== g.base) {
        if (g.status === 'queued' || g.status === 'failed') await setAside(c, h.path, h.data, file);
        continue;
      }
      if (g.status !== 'queued' && g.status !== 'failed' && !wearing) continue;
      await setAvatar(c, h.path.split('/')[1], h.data, genToken(file),
        Object.assign({}, g, { status: 'ready', file, readyAt: Date.now() }));
      heroes++;
    }
    // перемальований набір має новий файл — оновити його в колекціях (старий файл зараз видалимо)
    const cs = await c.query(
      `select path, data from docs where parent = 'heroes' and data->'avatarCollection' @> $1::jsonb for update`,
      [JSON.stringify([{ key: j.key }])]);
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
  return { ok: true, file, avatar: genToken(file), fight: !!files.fight, heroes };
}

/* ---------- адмінка ---------- */
async function adminJobs() {
  const r = await pool.query(
    `select id, key, status, attempts, worker, error, file, spec->>'base' as base, (spec->>'filled')::int as filled,
            spec->>'engine' as engine,
            created_at, queued_at, done_at, updated_at
       from avatar_jobs order by updated_at desc limit 100`);
  return { jobs: r.rows.map(x => Object.assign(x, { id: Number(x.id) })) };
}
/* перемалювати набір (новий workflow, невдалий результат): Герої бачать старий образ, доки не прийде новий */
async function adminRequeue(body) {
  const r = await pool.query(
    `update avatar_jobs set status = 'queued', attempts = 0, error = null, worker = null, lease_until = null,
            queued_at = now(), updated_at = now()
      where key = $1 and status <> 'working' and coalesce(spec->>'engine', '') <> 'gpt' returning id`, [String(body.key || '')]);
  if (!r.rows.length) throw new AvatarError('not-found', 'Немає такого набору (або він саме малюється)');
  return { ok: true };
}

module.exports = {
  AvatarError, SLOTS, FACE_BOX, trimExisting, FIGHT_PAIRS, CANVAS_PAD, OUT_H, canvasOf, canvasPng, canvasImage, absolute, COLLECTION_MAX, buildSpec, baseOf, standOf, baseImageOf, promptOf, makeFiles,
  PHOTO_TEMPLATE, collectionOf, addToCollection, render, status, gptAllowed, gptKey, gptPrompt, itemSheet, sheetGrid, openaiFrame, unframe, applyResult, drawGpt, saveRaw, rawIds, adminRaw, adminReapply, wear, forget, photo, photoPng, claim, heartbeat, result, fail, adminJobs, adminRequeue
};

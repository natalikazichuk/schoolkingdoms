/* API SchoolKingdoms — заміна Firebase Auth + Firestore.
   Клієнтська частина — sk-fb.js (повторює функції Firebase SDK, які
   використовує firebase-config.js), тому сторінки сайту не змінюються.

   POST /api/auth/signup  {email, password, session}  → {user}
   POST /api/auth/login   {email, password}           → {user}
   POST /api/auth/logout
   GET  /api/auth/me                                  → {user|null}
   POST /api/get          {path}                      → {doc}
   POST /api/query        {collection, where}         → {docs}
   POST /api/commit       {reads, writes}             → {ok}
   POST /api/avatar/render · GET /api/avatar/status   — образ Героя (src/avatar.js)
   POST /api/avatar/wear · POST /api/avatar/forget    — колекція створених образів
   POST /api/avatar/photo                             — новий герой із фото (OpenAI; кнопку відкладено)
   POST /api/avatar/render-gpt                        — «✨ Одягти GPT»: той самий набір малює OpenAI
   GET|POST /api/admin/openai                         — ключ OpenAI з адмінки (лише адмін)
   GET|POST /api/admin/reader                         — токен для Claude (читання / зміни), лише адмін
   POST /api/admin/doc/set                            — правка документа (адмін), журнал adminLog
   POST /api/avatar/worker/*                          — воркер образів (server/AVATAR-WORKER.md)
   GET  /api/health

   Сесія — HttpOnly cookie sk_session (у базі лише sha256 від токена).
   Помилки: {error:{code, message}}; code — як у Firebase
   (permission-denied, not-found, aborted, auth/invalid-credential…). */
const http = require('http');
const crypto = require('crypto');
const { pool, migrate, splitPath, isCollPath } = require('./db');
const { allowed } = require('./rules');
const V = require('./values');
const passwords = require('./passwords');
const skills = require('./skills');
const avatar = require('./avatar');
const openaiImage = require('./openai-image');
const settings = require('./settings');

const PORT = Number(process.env.PORT || 3000);
const MAX_BODY = 4 * 1024 * 1024;
const MAX_BODY_AVATAR = 13 * 1024 * 1024;   // готовий образ від воркера (base64)
const COOKIE = 'sk_session';
const SESSION_DAYS = 365;

class ApiError extends Error {
  constructor(status, code, message) { super(message || code); this.status = status; this.code = code; }
}
const deny = () => new ApiError(403, 'permission-denied', 'Missing or insufficient permissions.');

/* ---------- HTTP-дрібниці ---------- */
function send(res, status, obj, headers) {
  const body = JSON.stringify(obj);
  res.writeHead(status, Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  }, headers || {}));
  res.end(body);
}
function readBody(req, limit) {
  return new Promise((ok, fail) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > (limit || MAX_BODY)) { fail(new ApiError(413, 'invalid-argument', 'too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return ok({});
      try { ok(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (e) { fail(new ApiError(400, 'invalid-argument', 'bad json')); }
    });
    req.on('error', fail);
  });
}
function cookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i <= 0) return;
    // зіпсований cookie (напр. «%E0%A4%A») не має валити запит у 500 — пропускаємо його
    try { out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } catch (e) {}
  });
  return out;
}
function sessionCookie(token, maxAge) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
// Origin: null (sandbox-iframe, file://) або сміття → null, тобто «чужий»
function originHost(origin) {
  try { return new URL(origin).host; } catch (e) { return null; }
}
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
function clientIp(req) {
  return String(req.headers['x-real-ip'] || req.socket.remoteAddress || '');
}

/* ---------- сесії ---------- */
async function currentUser(req) {
  const t = cookies(req)[COOKIE];
  if (!t) return null;
  const r = await pool.query(
    `select a.uid, a.email, s.last_seen from sessions s join accounts a on a.uid = s.uid
      where s.token = $1 and not a.disabled and s.created_at > now() - interval '${SESSION_DAYS} days'`, [sha(t)]);
  if (!r.rows.length) return null;
  const u = r.rows[0];
  if (Date.now() - new Date(u.last_seen).getTime() > 3600e3)
    pool.query('update sessions set last_seen = now() where token = $1', [sha(t)]).catch(() => {});
  return { uid: u.uid, email: u.email };
}
async function startSession(uid) {
  const token = crypto.randomBytes(32).toString('base64url');
  await pool.query('insert into sessions (token, uid) values ($1, $2)', [sha(token), uid]);
  return sessionCookie(token, SESSION_DAYS * 86400);
}

/* ---------- обмеження спроб входу (у пам'яті) ---------- */
const fails = new Map();   // ключ → {n, until}
function checkRate(key) {
  const f = fails.get(key);
  if (f && f.n >= 10 && f.until > Date.now()) throw new ApiError(429, 'auth/too-many-requests');
}
function noteFail(key) {
  const f = fails.get(key) || { n: 0, until: 0 };
  if (f.until < Date.now()) f.n = 0;
  f.n++; f.until = Date.now() + 15 * 60e3;
  fails.set(key, f);
}

/* ---------- контекст правил: читання інших документів ---------- */
function ruleCtx(user, q) {
  const cache = new Map();
  return {
    uid: user ? user.uid : null,
    async get(path) {
      if (cache.has(path)) return cache.get(path);
      const r = await (q || pool).query('select data from docs where path = $1', [path]);
      const d = r.rows.length ? r.rows[0].data : null;
      cache.set(path, d);
      return d;
    }
  };
}
const docOut = row => row
  ? { path: row.path, id: row.id, exists: true, data: row.data, version: Number(row.version) }
  : null;

/* ---------- обробники ---------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FLAT_RULE_COLLS = ['tests', 'books', 'items', 'vocab', 'vocabDecks', 'readTexts', 'curriculum', 'meta', 'arenaPlan', 'reports'];

async function signup(req, body) {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!EMAIL_RE.test(email)) throw new ApiError(400, 'auth/invalid-email');
  if (password.length < 6) throw new ApiError(400, 'auth/weak-password');
  checkRate('signup:' + clientIp(req));
  noteFail('signup:' + clientIp(req));   // не більше 10 нових акаунтів за 15 хв з однієї адреси
  const uid = crypto.randomBytes(21).toString('base64url').replace(/[-_]/g, '').slice(0, 28);
  try {
    await pool.query('insert into accounts (uid, email, pass) values ($1, $2, $3)', [uid, email, await passwords.hash(password)]);
  } catch (e) {
    if (e.code === '23505') throw new ApiError(400, 'auth/email-already-in-use');
    throw e;
  }
  const user = { uid, email };
  // session:false — вторинний «застосунок» (батьки створюють Героя, не виходячи зі своєї сесії)
  const headers = body.session === false ? {} : { 'Set-Cookie': await startSession(uid) };
  return [{ user }, headers];
}

async function login(req, body) {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const key = 'login:' + clientIp(req) + ':' + email;
  checkRate(key);
  const r = await pool.query('select uid, email, pass, disabled from accounts where email = $1', [email]);
  const a = r.rows[0];
  let v = { ok: false };
  if (a && !a.disabled) v = await passwords.verify(password, a.pass);
  if (!v.ok) { noteFail(key); throw new ApiError(400, 'auth/invalid-credential'); }
  fails.delete(key);
  if (v.rehash) await pool.query('update accounts set pass = $2 where uid = $1', [a.uid, await passwords.hash(password)]);
  await pool.query('update accounts set last_login = now() where uid = $1', [a.uid]);
  return [{ user: { uid: a.uid, email: a.email } }, { 'Set-Cookie': await startSession(a.uid) }];
}

async function logout(req) {
  const t = cookies(req)[COOKIE];
  if (t) await pool.query('delete from sessions where token = $1', [sha(t)]);
  return [{ ok: true }, { 'Set-Cookie': sessionCookie('', 0) }];
}

async function getDoc(user, body) {
  const path = String(body.path || '');
  if (!splitPath(path)) throw new ApiError(400, 'invalid-argument', 'bad path');
  const r = await pool.query('select * from docs where path = $1', [path]);
  const row = r.rows[0] || null;
  if (!await allowed(ruleCtx(user), 'get', path, row ? row.data : null, null)) throw deny();
  return [{ doc: docOut(row) }];
}

async function query(user, body) {
  const coll = String(body.collection || '');
  if (!isCollPath(coll)) throw new ApiError(400, 'invalid-argument', 'bad collection');
  const params = [coll];
  const conds = ['parent = $1'];
  for (const w of Array.isArray(body.where) ? body.where : []) {
    const [field, op, value] = w;
    if (typeof field !== 'string' || !/^[A-Za-z0-9_.]+$/.test(field)) throw new ApiError(400, 'invalid-argument', 'bad field');
    params.push(field.split('.'));
    const f = `data #> $${params.length}`;
    params.push(JSON.stringify(op === 'array-contains' ? [value] : value));
    if (op === '==') conds.push(`${f} = $${params.length}::jsonb`);
    else if (op === 'array-contains') conds.push(`${f} @> $${params.length}::jsonb and jsonb_typeof(${f}) = 'array'`);
    else throw new ApiError(400, 'invalid-argument', 'unsupported op ' + op);
  }
  const r = await pool.query(`select * from docs where ${conds.join(' and ')} order by id`, params);
  // як у Firestore: якщо хоч один документ запиту не можна читати — відмова на весь запит
  const ctx = ruleCtx(user);
  for (const row of r.rows) if (!await allowed(ctx, 'list', row.path, row.data, null)) throw deny();
  // Порожній результат: для колекцій, де доступ не залежить від самого документа
  // (контент, план арени, скарги), відмова має бути й тоді, коли документів немає.
  if (!r.rows.length && FLAT_RULE_COLLS.includes(coll)
      && !await allowed(ctx, 'list', coll + '/_', null, null)) throw deny();
  return [{ docs: r.rows.map(docOut) }];
}

async function commit(user, body) {
  const reads = Array.isArray(body.reads) ? body.reads : [];
  const writes = Array.isArray(body.writes) ? body.writes : [];
  if (writes.length > 500) throw new ApiError(400, 'invalid-argument', 'too many writes');
  const c = await pool.connect();
  try {
    await c.query('begin');
    // транзакція: прочитані клієнтом версії мають не змінитися (0 = документа не було)
    for (const rd of reads) {
      const r = await c.query('select version from docs where path = $1 for update', [String(rd.path)]);
      const ver = r.rows.length ? Number(r.rows[0].version) : 0;
      if (ver !== Number(rd.version || 0)) throw new ApiError(409, 'aborted', 'document changed');
    }
    const ctx = ruleCtx(user, c);
    const now = Date.now();
    const state = new Map();   // path → {row|null} поточний стан у межах коміту
    for (const w of writes) {
      const path = String(w.path || '');
      const sp = splitPath(path);
      if (!sp) throw new ApiError(400, 'invalid-argument', 'bad path');
      if (!state.has(path)) {
        const r = await c.query('select * from docs where path = $1 for update', [path]);
        state.set(path, r.rows[0] || null);
      }
      const cur = state.get(path);
      const old = cur ? cur.data : null;
      let next = null, op;
      if (w.op === 'delete') {
        op = 'delete';
        if (!cur) { if (!await allowed(ctx, 'delete', path, null, null)) throw deny(); continue; }
      } else {
        if (!V.isPlainObject(w.data)) throw new ApiError(400, 'invalid-argument', 'bad data');
        const data = V.resolveSentinels(w.data, now);
        if (w.op === 'update') {
          if (!cur) throw new ApiError(404, 'not-found', 'No document to update: ' + path);
          next = V.applyUpdate(old, data);
        } else if (w.op === 'set') {
          next = w.merge ? V.deepMerge(old, data) : data;
        } else throw new ApiError(400, 'invalid-argument', 'bad op');
        op = cur ? 'update' : 'create';
      }
      if (!await allowed(ctx, op, path, old, next)) throw deny();
      if (op === 'delete') {
        await c.query('delete from docs where path = $1', [path]);
        state.set(path, null);
      } else {
        const r = await c.query(
          `insert into docs (path, parent, id, data) values ($1, $2, $3, $4)
           on conflict (path) do update set data = excluded.data, version = docs.version + 1, updated_at = now()
           returning *`, [path, sp.parent, sp.id, JSON.stringify(next)]);
        state.set(path, r.rows[0]);
      }
    }
    await c.query('commit');
    return [{ ok: true }];
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/* ---------- токен для Claude: «лише читання» або «читання й зміни» ----------
   Адмін створює його в адмінці (показуємо один раз), сервер зберігає лише sha256 у settings.
   З ним (Authorization: Bearer skr_…) відкриті ЛИШЕ маршрути з READER_ROUTES (перегляд бази,
   акаунти, Герої, образи), а з рівнем «зміни» — ще й WRITER_ROUTES (правка документа, дії
   адмінки з образами й Героями). Кожна зміна документа пишеться в журнал adminLog
   (до / після). Решта — 403. Claude питає дозволу перед кожною зміною. */
const READER_SETTING = 'reader_token_sha';
const READER_AT = 'reader_token_at';
const READER_MODE = 'reader_token_mode';   // 'read' | 'write'
const READER_ROUTES = new Set([
  'GET /api/health', 'GET /api/auth/me',
  'GET /api/admin/collections', 'POST /api/admin/docs', 'POST /api/admin/doc',
  'GET /api/admin/accounts', 'GET /api/admin/heroes',
  'GET /api/admin/avatar/jobs', 'GET /api/admin/avatar/raw', 'GET /api/admin/openai'
]);
const WRITER_ROUTES = new Set([
  'POST /api/admin/doc/set',
  'POST /api/admin/avatar/reapply', 'POST /api/admin/avatar/requeue',
  'POST /api/admin/hero/reset-class', 'POST /api/admin/hero/test-class', 'POST /api/admin/hero/set-level'
]);
const readerAllows = (u, key) => READER_ROUTES.has(key) || (u.write && WRITER_ROUTES.has(key));
function readerFrom(req) {
  const m = /^Bearer\s+(skr_[A-Za-z0-9_-]{20,200})$/.exec(String(req.headers.authorization || ''));
  const want = settings.get(READER_SETTING);
  if (!m || !want) return null;
  const a = Buffer.from(sha(m[1])), b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const write = settings.get(READER_MODE) === 'write';
  return { uid: '@reader', email: write ? 'claude (зміни)' : 'claude (читання)', reader: true, write };
}
async function adminReader(user) {
  await requireAdmin(user);
  return [{ active: !!settings.get(READER_SETTING), at: Number(settings.get(READER_AT)) || null,
    mode: settings.get(READER_MODE) || 'read' }];
}
async function adminReaderSave(user, b) {
  if (user && user.reader) throw deny();
  await requireAdmin(user);
  if (b && b.action === 'revoke') {
    await settings.set(READER_SETTING, null); await settings.set(READER_AT, null); await settings.set(READER_MODE, null);
    return [{ active: false }];
  }
  const mode = b && b.write ? 'write' : 'read';
  const token = 'skr_' + crypto.randomBytes(32).toString('base64url');
  await settings.set(READER_SETTING, sha(token)); await settings.set(READER_AT, String(Date.now()));
  await settings.set(READER_MODE, mode);
  return [{ active: true, at: Date.now(), mode, token }];   // показуємо один раз — на сервері лише хеш
}

/* правка одного документа з адмінки / токеном «зміни»: data — увесь документ (merge — злити
   з наявним, null — видалити). Журнал adminLog/<час-шлях>: хто, коли, що було, що стало. */
async function adminDocSet(user, b) {
  await requireAdmin(user);
  const path = String((b && b.path) || ''), sp = splitPath(path);
  if (!sp) throw new ApiError(400, 'invalid-argument', 'bad path');
  if (sp.parent === 'adminLog') throw deny();
  const del = b.data === null;
  if (!del && (!b.data || typeof b.data !== 'object' || Array.isArray(b.data))) throw new ApiError(400, 'invalid-argument', 'data — обʼєкт або null');
  const c = await pool.connect();
  try {
    await c.query('begin');
    const cur = (await c.query('select data, version from docs where path = $1 for update', [path])).rows[0] || null;
    if (b.version != null && (!cur || Number(cur.version) !== Number(b.version)))
      throw new ApiError(409, 'aborted', 'Документ змінився з того часу, як його прочитали');
    const before = cur ? cur.data : null;
    let after = null;
    if (del) await c.query('delete from docs where path = $1', [path]);
    else {
      after = b.merge && before ? Object.assign({}, before, b.data) : b.data;
      await c.query(
        `insert into docs (path, parent, id, data) values ($1, $2, $3, $4)
         on conflict (path) do update set data = excluded.data, version = docs.version + 1, updated_at = now()`,
        [path, sp.parent, sp.id, JSON.stringify(after)]);
    }
    const logId = Date.now().toString(36) + '-' + crypto.randomBytes(3).toString('hex');
    await c.query(`insert into docs (path, parent, id, data) values ($1, 'adminLog', $2, $3)`,
      ['adminLog/' + logId, logId, JSON.stringify({ at: Date.now(), by: user.email || user.uid, path, before, after, note: String(b.note || '').slice(0, 300) })]);
    await c.query('commit');
    return [{ ok: true, path, deleted: del, log: 'adminLog/' + logId }];
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/* ---------- перегляд бази (admin-db.html), лише адмін, лише читання ---------- */
async function requireAdmin(user) {
  if (!user) throw new ApiError(401, 'unauthenticated');
  if (user.reader) return;   // токен «лише читання»: сюди доходять тільки маршрути з READER_ROUTES
  const r = await pool.query(`select data->>'role' as role from docs where path = $1`, ['users/' + user.uid]);
  if (!r.rows.length || r.rows[0].role !== 'admin') throw deny();
}
// heroes/abc/battles → heroes/*/battles: підколекції групуємо за шаблоном
const collPattern = parent => parent.split('/').map((s, i) => (i % 2 ? '*' : s)).join('/');
function parentFilter(pattern, params) {
  if (!isCollPath(pattern.replace(/\*/g, 'x'))) throw new ApiError(400, 'invalid-argument', 'bad collection');
  if (!pattern.includes('*')) { params.push(pattern); return `parent = $${params.length}`; }
  params.push(pattern.replace(/[%_\\]/g, '\\$&').replace(/\*/g, '%'));
  return `parent like $${params.length}`;
}

async function adminCollections(user) {
  await requireAdmin(user);
  const r = await pool.query(
    `select parent, count(*)::int as n, sum(pg_column_size(data))::bigint as bytes, max(updated_at) as updated
       from docs group by parent`);
  const m = new Map();
  for (const row of r.rows) {
    const k = collPattern(row.parent);
    const c = m.get(k) || { collection: k, count: 0, bytes: 0, updated: null };
    c.count += row.n; c.bytes += Number(row.bytes);
    if (!c.updated || row.updated > c.updated) c.updated = row.updated;
    m.set(k, c);
  }
  const a = await pool.query('select count(*)::int as n from accounts');
  const s = await pool.query('select pg_database_size(current_database())::bigint as b');
  return [{
    collections: [...m.values()].sort((x, y) => x.collection.localeCompare(y.collection)),
    accounts: a.rows[0].n,
    dbBytes: Number(s.rows[0].b)
  }];
}

async function adminDocs(user, body) {
  await requireAdmin(user);
  const params = [];
  const conds = [parentFilter(String(body.collection || ''), params)];
  const q = String(body.q || '').trim();
  if (q) { params.push('%' + q.replace(/[%_\\]/g, '\\$&') + '%'); conds.push(`(path ilike $${params.length} or data::text ilike $${params.length})`); }
  const where = conds.join(' and ');
  const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 200);
  const offset = Math.max(Number(body.offset) || 0, 0);
  const total = (await pool.query(`select count(*)::int as n from docs where ${where}`, params)).rows[0].n;
  const sort = body.sort === 'id' ? 'id' : 'updated_at desc';
  const r = await pool.query(
    `select path, id, version, created_at, updated_at, pg_column_size(data) as bytes,
            left(data::text, 400) as preview
       from docs where ${where} order by ${sort} limit ${limit} offset ${offset}`, params);
  return [{ total, docs: r.rows.map(x => Object.assign(x, { version: Number(x.version), bytes: Number(x.bytes) })) }];
}

async function adminDoc(user, body) {
  await requireAdmin(user);
  const r = await pool.query('select * from docs where path = $1', [String(body.path || '')]);
  if (!r.rows.length) throw new ApiError(404, 'not-found');
  const d = r.rows[0];
  const subs = await pool.query(
    `select parent, count(*)::int as n from docs where parent like $1 group by parent`,
    [d.path.replace(/[%_\\]/g, '\\$&') + '/%']);
  return [{
    doc: { path: d.path, id: d.id, data: d.data, version: Number(d.version), created_at: d.created_at, updated_at: d.updated_at },
    subcollections: subs.rows.map(x => ({ collection: x.parent, count: x.n }))
  }];
}

async function adminAccounts(user) {
  await requireAdmin(user);
  // паролі не віддаємо — лише формат (старий Firebase чи вже перешифрований)
  const r = await pool.query(
    `select a.uid, a.email, a.created_at, a.last_login, a.disabled,
            case when a.pass like 'fb$%' then 'firebase' else 'new' end as pass_format,
            (select count(*)::int from sessions s where s.uid = a.uid) as sessions,
            exists(select 1 from docs where path = 'users/' || a.uid) as has_user,
            exists(select 1 from docs where path = 'heroes/' || a.uid) as has_hero
       from accounts a order by a.last_login desc nulls last, a.created_at desc`);
  return [{ accounts: r.rows }];
}

/* книга вмінь: помилки SkillError → коди API */
const SKILL_STATUS = { unauthenticated: 401, 'permission-denied': 403, 'invalid-argument': 400, 'failed-precondition': 409 };
function skillRoute(fn) {
  return async (req, user, b) => {
    try { return [await fn(user, b)]; }
    catch (e) {
      if (e instanceof skills.SkillError) throw new ApiError(SKILL_STATUS[e.code] || 400, e.code, e.message);
      throw e;
    }
  };
}

/* образ Героя: помилки AvatarError → коди API */
const AVATAR_STATUS = { unauthenticated: 401, 'permission-denied': 403, 'invalid-argument': 400, 'failed-precondition': 409,
  aborted: 409, 'not-found': 404, 'resource-exhausted': 429, unavailable: 503 };
function avatarRoute(fn) {
  return async (req, user, b) => {
    try { return [await fn(req, user, b)]; }
    catch (e) {
      if (e instanceof avatar.AvatarError) throw new ApiError(AVATAR_STATUS[e.code] || 400, e.code, e.message);
      throw e;
    }
  };
}

/* ключ OpenAI з адмінки: назад віддаємо лише останні 4 символи */
function openaiState() {
  const k = openaiImage.apiKey();
  return { configured: !!k, source: openaiImage.keySource(), hint: k ? '…' + k.slice(-4) : null, model: openaiImage.model() };
}
async function adminOpenai(user) {
  await requireAdmin(user);
  return [openaiState()];
}
async function adminOpenaiSave(user, b) {
  await requireAdmin(user);
  const key = String((b && b.key) || '').trim();
  if (!key) { await settings.set(openaiImage.KEY_SETTING, null); return [openaiState()]; }   // порожньо — прибрати
  if (!/^sk-[A-Za-z0-9_-]{20,300}$/.test(key)) throw new ApiError(400, 'invalid-argument', 'Це не схоже на ключ OpenAI (він починається з sk-)');
  const check = await openaiImage.checkKey(key);
  if (check === 'invalid') throw new ApiError(400, 'invalid-argument', 'OpenAI не приймає цей ключ — перевір, чи скопійовано повністю й чи його не відкликано');
  await settings.set(openaiImage.KEY_SETTING, key);
  return [Object.assign(openaiState(), { check })];
}

/* ---------- маршрутизація ---------- */
const ROUTES = {
  'POST /api/auth/signup': (req, user, b) => signup(req, b),
  'POST /api/auth/login': (req, user, b) => login(req, b),
  'POST /api/auth/logout': req => logout(req),
  'GET /api/auth/me': async (req, user) => [{ user }],
  'POST /api/get': (req, user, b) => getDoc(user, b),
  'POST /api/query': (req, user, b) => query(user, b),
  'POST /api/commit': (req, user, b) => commit(user, b),
  'POST /api/skills/learn': skillRoute(skills.learn),
  'POST /api/skills/bar': skillRoute(skills.setBar),
  'POST /api/skills/class': skillRoute(skills.chooseClass),
  'POST /api/skills/grow': skillRoute(skills.growAfterBattle),
  'POST /api/skills/trade': skillRoute(skills.growTrade),
  'POST /api/avatar/render': avatarRoute((req, user) => avatar.render(user)),
  'POST /api/avatar/render-gpt': avatarRoute((req, user) => avatar.render(user, 'gpt')),
  'GET /api/avatar/status': avatarRoute((req, user) => avatar.status(user)),
  'POST /api/avatar/wear': avatarRoute((req, user, b) => avatar.wear(user, b)),
  'POST /api/avatar/forget': avatarRoute((req, user, b) => avatar.forget(user, b)),
  'POST /api/avatar/photo': avatarRoute((req, user, b) => avatar.photo(user, b)),
  'POST /api/avatar/worker/claim': avatarRoute((req, user, b) => avatar.claim(req, b)),
  'POST /api/avatar/worker/heartbeat': avatarRoute((req, user, b) => avatar.heartbeat(req, b)),
  'POST /api/avatar/worker/result': avatarRoute((req, user, b) => avatar.result(req, b)),
  'POST /api/avatar/worker/fail': avatarRoute((req, user, b) => avatar.fail(req, b)),
  'GET /api/admin/avatar/jobs': async (req, user) => { await requireAdmin(user); return avatarRoute(() => avatar.adminJobs())(req, user); },
  'GET /api/admin/openai': (req, user) => adminOpenai(user),
  'POST /api/admin/openai': (req, user, b) => adminOpenaiSave(user, b),
  'GET /api/admin/avatar/raw': async (req, user) => { await requireAdmin(user); return avatarRoute(() => avatar.adminRaw())(req, user); },
  'POST /api/admin/avatar/reapply': async (req, user, b) => { await requireAdmin(user); return avatarRoute(() => avatar.adminReapply(b))(req, user, b); },
  'POST /api/admin/avatar/requeue': async (req, user, b) => { await requireAdmin(user); return avatarRoute(() => avatar.adminRequeue(b))(req, user, b); },
  'GET /api/admin/reader': (req, user) => adminReader(user),
  'POST /api/admin/reader': (req, user, b) => adminReaderSave(user, b),
  'GET /api/admin/collections': (req, user) => adminCollections(user),
  'POST /api/admin/docs': (req, user, b) => adminDocs(user, b),
  'POST /api/admin/doc': (req, user, b) => adminDoc(user, b),
  'POST /api/admin/doc/set': (req, user, b) => adminDocSet(user, b),
  'GET /api/admin/accounts': (req, user) => adminAccounts(user),
  'GET /api/admin/heroes': async (req, user) => { await requireAdmin(user); return [{ heroes: await skills.heroList() }]; },
  'POST /api/admin/hero/reset-class': async (req, user, b) => { await requireAdmin(user); return skillRoute(() => skills.resetClass(b.id))(req, user, b); },
  'POST /api/admin/hero/test-class': async (req, user, b) => { await requireAdmin(user); return skillRoute(() => skills.testClass(b.id, b))(req, user, b); },
  'POST /api/admin/hero/set-level': async (req, user, b) => { await requireAdmin(user); return skillRoute(() => skills.setLevel(b.id, b))(req, user, b); },
  'GET /api/health': async () => {
    await pool.query('select 1');
    return [{ ok: true, version: process.env.APP_VERSION || 'dev' }];
  }
};

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  const route = ROUTES[req.method + ' ' + url];
  try {
    if (!route) throw new ApiError(404, 'not-found', 'no route');
    if (req.method === 'POST') {
      // захист від підробки запитів з чужих сайтів: лише JSON і лише зі свого домену
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new ApiError(415, 'invalid-argument', 'json only');
      const origin = req.headers.origin;
      if (origin && originHost(origin) !== req.headers.host) throw new ApiError(403, 'permission-denied', 'bad origin');
    }
    const body = req.method === 'POST' ? await readBody(req, url === '/api/avatar/worker/result' ? MAX_BODY_AVATAR : MAX_BODY) : {};
    const reader = readerFrom(req);
    if (reader && !readerAllows(reader, req.method + ' ' + url))
      throw new ApiError(403, 'permission-denied', reader.write ? 'Цей маршрут токену недоступний' : 'Токен лише для читання');
    const user = reader || await currentUser(req);
    const [out, headers] = await route(req, user, body);
    send(res, 200, out, headers);
  } catch (e) {
    if (!(e instanceof ApiError)) console.error(new Date().toISOString(), req.method, url, e);
    const status = e instanceof ApiError ? e.status : 500;
    send(res, status, { error: { code: e instanceof ApiError ? e.code : 'internal', message: e instanceof ApiError ? e.message : 'internal error' } });
  }
});

if (require.main === module) {
  migrate().then(() => settings.load()).then(() => server.listen(PORT, () => {
    console.log('SchoolKingdoms API on :' + PORT);
    // старі образи з порожніми полями по боках → щільно (повторно нічого не робить)
    avatar.trimExisting().then(n => { if (n) console.log('[avatar/trim] обрізано образів: ' + n); }, () => {});
  }))
    .catch(e => { console.error(e); process.exit(1); });
}

module.exports = { server, ApiError };

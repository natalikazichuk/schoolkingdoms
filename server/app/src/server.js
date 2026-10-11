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

const PORT = Number(process.env.PORT || 3000);
const MAX_BODY = 4 * 1024 * 1024;
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
function readBody(req) {
  return new Promise((ok, fail) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { fail(new ApiError(413, 'invalid-argument', 'too large')); req.destroy(); return; }
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
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function sessionCookie(token, maxAge) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
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
const FLAT_RULE_COLLS = ['tests', 'books', 'items', 'vocab', 'vocabDecks', 'curriculum', 'meta', 'arenaPlan', 'reports'];

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

/* ---------- маршрутизація ---------- */
const ROUTES = {
  'POST /api/auth/signup': (req, user, b) => signup(req, b),
  'POST /api/auth/login': (req, user, b) => login(req, b),
  'POST /api/auth/logout': req => logout(req),
  'GET /api/auth/me': async (req, user) => [{ user }],
  'POST /api/get': (req, user, b) => getDoc(user, b),
  'POST /api/query': (req, user, b) => query(user, b),
  'POST /api/commit': (req, user, b) => commit(user, b),
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
      if (origin && new URL(origin).host !== req.headers.host) throw new ApiError(403, 'permission-denied', 'bad origin');
    }
    const body = req.method === 'POST' ? await readBody(req) : {};
    const user = await currentUser(req);
    const [out, headers] = await route(req, user, body);
    send(res, 200, out, headers);
  } catch (e) {
    if (!(e instanceof ApiError)) console.error(new Date().toISOString(), req.method, url, e);
    const status = e instanceof ApiError ? e.status : 500;
    send(res, status, { error: { code: e instanceof ApiError ? e.code : 'internal', message: e instanceof ApiError ? e.message : 'internal error' } });
  }
});

if (require.main === module) {
  migrate().then(() => server.listen(PORT, () => console.log('SchoolKingdoms API on :' + PORT)))
    .catch(e => { console.error(e); process.exit(1); });
}

module.exports = { server, ApiError };

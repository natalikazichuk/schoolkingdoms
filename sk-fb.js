/* ============================================================
   sk-fb.js — заміна Firebase SDK (app + auth + firestore) для
   власного сервера school-king.pp.ua (server/app).

   Повторює ТІ функції Firebase, які використовує firebase-config.js,
   з тими самими назвами й поведінкою: doc/collection/query/where,
   getDoc/getDocs/setDoc(merge)/updateDoc/addDoc/deleteDoc,
   runTransaction, serverTimestamp, Timestamp; вхід email+пароль.
   Тому firebase-config.js змінює лише рядки import, а сторінки — нічого.

   Дані на дроті — JSON; дата = {"$ts": мс}, serverTimestamp = {"$sv":"ts"}.
   Сесія — HttpOnly cookie (ставить сервер), у JS токена немає.
   ============================================================ */

const API = new URL('api/', new URL('./', import.meta.url)).href;
const MAIN_HOST = 'school-king.pp.ua';

// Старий сайт на GitHub Pages тепер лише архів коду: ведемо на новий домен.
if (/\.github\.io$/i.test(location.hostname)) {
  const rest = location.pathname.replace(/^\/[^/]+\//, '/');
  location.replace('https://' + MAIN_HOST + rest + location.search + location.hash);
}

/* ---------- помилки (як FirebaseError: e.code, e.message) ---------- */
class FirebaseError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
    this.name = 'FirebaseError';
  }
}

async function call(method, path, body, auth) {
  let res;
  try {
    res = await fetch(API + path, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    throw new FirebaseError(auth ? 'auth/network-request-failed' : 'unavailable', 'network error');
  }
  let json = null;
  try { json = await res.json(); } catch (e) {}
  if (!res.ok) {
    const err = (json && json.error) || {};
    throw new FirebaseError(err.code || (auth ? 'auth/internal-error' : 'internal'), err.message);
  }
  return json || {};
}

/* ---------- Timestamp ---------- */
export class Timestamp {
  constructor(seconds, nanoseconds) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds || 0;
  }
  static fromMillis(ms) {
    const s = Math.floor(ms / 1000);
    return new Timestamp(s, Math.round((ms - s * 1000) * 1e6));
  }
  static fromDate(d) { return Timestamp.fromMillis(d.getTime()); }
  static now() { return Timestamp.fromMillis(Date.now()); }
  toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }
  toDate() { return new Date(this.toMillis()); }
  isEqual(o) { return o instanceof Timestamp && o.seconds === this.seconds && o.nanoseconds === this.nanoseconds; }
  valueOf() { return String(this.toMillis()).padStart(20, '0'); }
  toJSON() { return { seconds: this.seconds, nanoseconds: this.nanoseconds }; }
}

const SERVER_TS = Object.freeze({ _sk: 'serverTimestamp' });
export function serverTimestamp() { return SERVER_TS; }

function isPlain(v) { return v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype; }

function enc(v) {
  if (v === SERVER_TS) return { $sv: 'ts' };
  if (v instanceof Timestamp) return { $ts: v.toMillis() };
  if (v instanceof Date) return { $ts: v.getTime() };
  if (Array.isArray(v)) return v.map(x => (x === undefined ? null : enc(x)));
  if (isPlain(v)) {
    const out = {};
    for (const k of Object.keys(v)) if (v[k] !== undefined) out[k] = enc(v[k]);
    return out;
  }
  if (typeof v === 'number' && !isFinite(v)) return null;
  return v;
}
function dec(v) {
  if (Array.isArray(v)) return v.map(dec);
  if (v && typeof v === 'object') {
    if (typeof v.$ts === 'number' && Object.keys(v).length === 1) return Timestamp.fromMillis(v.$ts);
    const out = {};
    for (const k of Object.keys(v)) out[k] = dec(v[k]);
    return out;
  }
  return v;
}

/* ---------- застосунок ---------- */
const apps = new Map();
export function initializeApp(options, name) {
  name = name || '[DEFAULT]';
  const app = { name, options: options || {} };
  apps.set(name, app);
  return app;
}
export async function deleteApp(app) { apps.delete(app.name); }

/* ---------- Auth ---------- */
export const browserLocalPersistence = { type: 'LOCAL' };
export const browserSessionPersistence = { type: 'SESSION' };
export async function setPersistence() {}

function mkUser(u) {
  return u ? { uid: u.uid, email: u.email, displayName: null, emailVerified: true, getIdToken: async () => '' } : null;
}

const auths = new Map();
export function getAuth(app) {
  app = app || apps.get('[DEFAULT]');
  const key = app ? app.name : '[DEFAULT]';
  if (auths.has(key)) return auths.get(key);
  const isMain = key === '[DEFAULT]';
  const a = { app, currentUser: null, _cbs: [], _ready: false, _main: isMain };
  a._set = u => {
    a.currentUser = mkUser(u);
    a._ready = true;
    a._cbs.slice().forEach(cb => { try { cb(a.currentUser); } catch (e) { console.error(e); } });
  };
  // Основна сесія — з cookie; вторинний «застосунок» (створення Героя) — завжди без сесії
  a._init = isMain
    ? call('GET', 'auth/me', null, true).then(r => a._set(r.user), () => a._set(null))
    : Promise.resolve(a._set(null));
  auths.set(key, a);
  return a;
}

export function onAuthStateChanged(auth, cb) {
  auth._cbs.push(cb);
  if (auth._ready) Promise.resolve().then(() => cb(auth.currentUser));
  return () => { auth._cbs = auth._cbs.filter(x => x !== cb); };
}

export async function createUserWithEmailAndPassword(auth, email, password) {
  const r = await call('POST', 'auth/signup', { email, password, session: auth._main }, true);
  const user = mkUser(r.user);
  if (auth._main) auth._set(r.user);
  return { user };
}

export async function signInWithEmailAndPassword(auth, email, password) {
  if (!auth._main) throw new FirebaseError('auth/operation-not-allowed', 'secondary sign-in is not supported');
  const r = await call('POST', 'auth/login', { email, password }, true);
  auth._set(r.user);
  return { user: auth.currentUser };
}

export async function signOut(auth) {
  if (auth._main) {
    try { await call('POST', 'auth/logout', {}, true); } catch (e) {}
  }
  auth._set(null);
}

/* ---------- Firestore: посилання ---------- */
export function getFirestore(app) { return { type: 'firestore', app }; }
export function initializeFirestore(app) { return getFirestore(app); }

function joinPath(base, segs) {
  const all = (base ? [base] : []).concat(segs.map(String)).join('/').split('/').filter(Boolean);
  return all;
}
function collRef(segs) {
  return { type: 'collection', id: segs[segs.length - 1], path: segs.join('/'), _segs: segs };
}
function docRef(segs) {
  return { type: 'document', id: segs[segs.length - 1], path: segs.join('/'), parent: collRef(segs.slice(0, -1)) };
}
function autoId() {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const b = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(b, x => abc[x % abc.length]).join('');
}

export function collection(parent, ...segs) {
  const s = joinPath(parent && parent.path, segs);
  if (s.length % 2 !== 1) throw new FirebaseError('invalid-argument', 'collection path must have odd segments');
  return collRef(s);
}
export function doc(parent, ...segs) {
  if (parent && parent.type === 'collection' && !segs.length) segs = [autoId()];
  const s = joinPath(parent && parent.path, segs);
  if (s.length % 2 !== 0) throw new FirebaseError('invalid-argument', 'document path must have even segments');
  return docRef(s);
}
export function where(field, op, value) { return { _where: [field, op, enc(value)] }; }
export function query(ref, ...constraints) {
  const base = ref.type === 'query' ? ref : { type: 'query', _coll: ref, _where: [] };
  return { type: 'query', _coll: base._coll, _where: base._where.concat(constraints.map(c => c._where)) };
}

/* ---------- знімки ---------- */
function docSnap(ref, d) {
  const data = d ? dec(d.data) : undefined;
  return {
    id: ref.id,
    ref,
    metadata: { fromCache: false, hasPendingWrites: false },
    exists() { return !!d; },
    data() { return data === undefined ? undefined : dec(d.data); },
    get(field) {
      return String(field).split('.').reduce((o, k) => (o == null ? undefined : o[k]), data);
    }
  };
}

export async function getDoc(ref) {
  const r = await call('POST', 'get', { path: ref.path });
  return docSnap(ref, r.doc);
}

export async function getDocs(q) {
  const qq = q.type === 'query' ? q : query(q);
  const r = await call('POST', 'query', { collection: qq._coll.path, where: qq._where });
  const docs = (r.docs || []).map(d => docSnap(docRef(d.path.split('/')), d));
  return {
    docs, size: docs.length, empty: !docs.length, query: qq,
    forEach(cb) { docs.forEach(cb); }
  };
}

/* ---------- запис ---------- */
function writeOf(op, ref, data, opts) {
  const w = { op, path: ref.path };
  if (op !== 'delete') {
    if (!isPlain(data)) throw new FirebaseError('invalid-argument', 'data must be an object');
    w.data = enc(data);
  }
  if (op === 'set' && opts && opts.merge) w.merge = true;
  return w;
}
const commit = (writes, reads) => call('POST', 'commit', { writes, reads: reads || [] });

export async function setDoc(ref, data, opts) { await commit([writeOf('set', ref, data, opts)]); }
export async function updateDoc(ref, data) { await commit([writeOf('update', ref, data)]); }
export async function deleteDoc(ref) { await commit([writeOf('delete', ref)]); }
export async function addDoc(ref, data) {
  const d = doc(ref);
  await commit([writeOf('set', d, data)]);
  return d;
}

/* ---------- транзакції ----------
   Читання запам'ятовують версію документа; коміт проходить, лише якщо
   жодна прочитана версія не змінилася, інакше сервер відповідає 'aborted'
   і функція виконується знову (як у Firestore, до 5 спроб). */
export async function runTransaction(db, fn, options) {
  const max = (options && options.maxAttempts) || 5;
  let lastErr;
  for (let attempt = 0; attempt < max; attempt++) {
    const reads = new Map();
    const writes = [];
    const tx = {
      async get(ref) {
        if (writes.length) throw new FirebaseError('invalid-argument', 'reads must come before writes');
        const r = await call('POST', 'get', { path: ref.path });
        if (!reads.has(ref.path)) reads.set(ref.path, r.doc ? r.doc.version : 0);
        return docSnap(ref, r.doc);
      },
      set(ref, data, opts) { writes.push(writeOf('set', ref, data, opts)); return tx; },
      update(ref, data) { writes.push(writeOf('update', ref, data)); return tx; },
      delete(ref) { writes.push(writeOf('delete', ref)); return tx; }
    };
    const result = await fn(tx);
    try {
      await commit(writes, Array.from(reads, ([path, version]) => ({ path, version })));
      return result;
    } catch (e) {
      lastErr = e;
      if (e.code !== 'aborted') throw e;
      await new Promise(r => setTimeout(r, 50 * Math.pow(2, attempt) + Math.random() * 50));
    }
  }
  throw lastErr;
}

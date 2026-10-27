/* Правила доступу — перенесені 1:1 з firestore.rules.
   Кожне правило отримує:
     a     — контекст: { uid, get(path) → дані документа або null }
     p     — сегменти шляху (['heroes', '<id>', 'battles', '<bid>'])
     res   — поточний документ у базі (resource.data) або null
     next  — документ після запису (request.resource.data) або null
   Звернення до відсутнього поля дає undefined, а не помилку: це повторює
   поведінку Firestore, де помилка в одній гілці `||` не валить інші.
   Немає правила — доступу немає. */

const HERO_COLLS_PUBLIC = ['tests', 'books', 'items', 'vocab', 'vocabDecks', 'readTexts', 'curriculum', 'meta'];

function pairId(a, b) { return a < b ? a + '__' + b : b + '__' + a; }

/* Поля книги вмінь героя змінює лише сервер (src/skills.js), стан образу —
   src/avatar.js: браузер не може ні записати їх при створенні героя, ні змінити пізніше. */
const HERO_PROTECTED = ['skills', 'skillBar', 'heroClass', 'skillBonus', 'skillGrowIds', 'skillFails', 'skillTrade', 'avatarGen', 'avatarCollection', 'bagMax'];
function canon(v) {
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
function protectedKept(oldD, newD) {
  return HERO_PROTECTED.every(k => canon((oldD || {})[k]) === canon((newD || {})[k]));
}
function arr(v) { return Array.isArray(v) ? v : []; }
function sameArr(x, y) {
  x = arr(x); y = arr(y);
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

async function isAdmin(a) {
  if (!a.uid) return false;
  const u = await a.get('users/' + a.uid);
  return !!u && u.role === 'admin';
}
async function myHero(a) { return a.uid ? a.get('heroes/' + a.uid) : null; }
async function heroParent(a, heroId) {
  const h = await a.get('heroes/' + heroId);
  return h ? h.parentUid : undefined;
}
async function friendApproved(a, heroId) {
  const f = await a.get('friendships/' + pairId(a.uid, heroId));
  return !!f && f.status === 'approved';
}
async function sameFamily(a, res) {
  const me = await myHero(a);
  return !!me && !!res && me.parentUid === res.parentUid;
}

/* op: 'get' | 'list' | 'create' | 'update' | 'delete' */
async function allowed(a, op, path, res, next) {
  const p = path.split('/');
  const signedIn = !!a.uid;
  const read = op === 'get' || op === 'list';
  const r = res || {};
  const n = next || {};

  // users/{uid}
  if (p.length === 2 && p[0] === 'users') {
    const uid = p[1];
    if (read) return signedIn && a.uid === uid;
    if (op === 'create') return signedIn && a.uid === uid && (!('role' in n) || n.role === 'user');
    if (op === 'update') return signedIn && a.uid === uid && n.role === r.role;
    return false;
  }

  // heroes/{heroId}
  if (p.length === 2 && p[0] === 'heroes') {
    const hid = p[1];
    if (read) return signedIn && (a.uid === hid || a.uid === r.parentUid || await sameFamily(a, res));
    if (op === 'create') return signedIn && a.uid === n.parentUid && protectedKept(null, n);
    if (op === 'update') return signedIn && n.parentUid === r.parentUid && (a.uid === hid || a.uid === r.parentUid)
      && protectedKept(r, n);
    if (op === 'delete') return signedIn && a.uid === r.parentUid;
    return false;
  }

  // heroes/{heroId}/battles/{bid}
  if (p.length === 4 && p[0] === 'heroes' && p[2] === 'battles') {
    const hid = p[1];
    if (!signedIn) return false;
    if (read || op === 'delete') return a.uid === hid || a.uid === await heroParent(a, hid);
    if (op === 'create' || op === 'update') return a.uid === hid;
    return false;
  }

  // heroCards/{heroId}
  if (p.length === 2 && p[0] === 'heroCards') {
    const hid = p[1];
    if (!signedIn) return false;
    if (read) return a.uid === hid || a.uid === r.parentUid || await sameFamily(a, res) || await friendApproved(a, hid);
    if (op === 'create' || op === 'update') {
      const parent = await heroParent(a, hid);
      return parent !== undefined && n.parentUid === parent && (a.uid === hid || a.uid === parent);
    }
    if (op === 'delete') return a.uid === await heroParent(a, hid);
    return false;
  }

  // friendships/{pair}
  if (p.length === 2 && p[0] === 'friendships') {
    const pair = p[1];
    if (!signedIn) return false;
    if (read) return arr(r.heroes).includes(a.uid) || arr(r.parents).includes(a.uid);
    if (op === 'create') {
      const heroes = arr(n.heroes), parents = arr(n.parents);
      return parents.includes(a.uid)
        && !heroes.includes(a.uid)
        && n.status === 'pending'
        && sameArr(n.approvedBy, [a.uid])
        && parents.length === 2
        && heroes.length === 2
        && pair === pairId(heroes[0], heroes[1]);
    }
    if (op === 'update') {
      const approvedBy = arr(n.approvedBy);
      return arr(r.parents).includes(a.uid)
        && sameArr(n.parents, r.parents)
        && sameArr(n.heroes, r.heroes)
        && approvedBy.every(x => arr(r.parents).includes(x))
        && approvedBy.includes(a.uid)
        && (n.status === 'approved' ? approvedBy.length >= 2 : n.status === 'pending');
    }
    if (op === 'delete') return arr(r.parents).includes(a.uid);
    return false;
  }

  // inviteCodes/{code}: get — так (треба знати код), list — ні
  if (p.length === 2 && p[0] === 'inviteCodes') {
    if (!signedIn) return false;
    if (op === 'get') return true;
    if (op === 'create') return a.uid === n.parentUid;
    if (op === 'delete') return a.uid === r.parentUid;
    return false;
  }

  // контент платформи: читають усі залогінені, пише лише адмін
  if (p.length === 2 && HERO_COLLS_PUBLIC.includes(p[0])) {
    if (read) return signedIn;
    return isAdmin(a);
  }

  // arenaPlan — лише адмін
  if (p.length === 2 && p[0] === 'arenaPlan') return isAdmin(a);

  // reports/{id}
  if (p.length === 2 && p[0] === 'reports') {
    if (op === 'create') return signedIn && n.reporterUid === a.uid && n.status === 'new';
    return isAdmin(a);
  }

  return false;
}

module.exports = { allowed, pairId };

/* Книга вмінь героя: вивчення, панель вмінь, вибір класу.
   Поля heroes/{id}.skills / skillBar / heroClass / skillBonus змінює ЛИШЕ цей
   модуль (rules.js не дає писати їх напряму з браузера), тому очки вмінь не
   «намалюєш» через консоль.
   Правила — ті самі функції, що бачить сторінка: sk-skills.js із сайту
   (SITE_DIR, у Docker — копія репозиторію), завантажений один раз. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pool } = require('./db');

let SKS = null, SKS_MTIME = 0;
/* перечитуємо, коли файл змінився: сайт оновлюється з GitHub без перезапуску API */
function lib() {
  const file = path.join(process.env.SITE_DIR || path.join(__dirname, '../../..'), 'sk-skills.js');
  const mtime = fs.statSync(file).mtimeMs;
  if (SKS && mtime === SKS_MTIME) return SKS;
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
  SKS = sandbox.window.SKSKILLS;
  SKS_MTIME = mtime;
  return SKS;
}

class SkillError extends Error {
  constructor(code, message) { super(message || code); this.code = code; }
}
const BLOCK_UA = {
  unknown: 'Такого вміння немає',
  learned: 'Це вміння вже вивчене',
  level: 'Рівень ще замалий',
  points: 'Немає вільних очок вмінь',
  shape: 'Неправильна панель',
  locked: 'Цей слот ще закритий',
  dup: 'Вміння вже на панелі',
  notactive: 'На панель — лише вивчені активні вміння'
};

/* Читає героя під блокуванням, дає змінити, пише. Лише сам герой. */
async function withHero(user, fn) {
  if (!user) throw new SkillError('unauthenticated');
  const c = await pool.connect();
  try {
    await c.query('begin');
    const r = await c.query('select data from docs where path = $1 for update', ['heroes/' + user.uid]);
    if (!r.rows.length) throw new SkillError('permission-denied', 'Книга вмінь — лише для Героя');
    const hero = r.rows[0].data;
    const patch = fn(hero, lib().bookState(hero));
    const next = Object.assign({}, hero, patch, { updatedAt: { $ts: Date.now() } });
    await c.query(`update docs set data = $2, version = version + 1, updated_at = now() where path = $1`,
      ['heroes/' + user.uid, JSON.stringify(next)]);
    await c.query('commit');
    return pick(next);
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
const pick = h => ({ skills: h.skills || {}, skillBar: h.skillBar || null, heroClass: h.heroClass || null, skillBonus: h.skillBonus || 0 });

/* як SKBATTLE.lockLive: бій триває, якщо його ще не застосовано і від терміну
   ходу минуло менше 30 хв (кинутий бій мітку не тримає) */
function battleLive(hero) {
  const a = hero && hero.activeBattle;
  if (!a || !a.bid || hero.lastBattleId === a.bid) return false;
  const d = a.deadline && typeof a.deadline === 'object' ? Number(a.deadline.$ts) : Number(a.deadline);
  return Date.now() < (d || 0) + 30 * 60 * 1000;
}

function learn(user, body) {
  const id = String(body.id || '');
  return withHero(user, (hero, st) => {
    const why = lib().learnBlock(st, id);
    if (why) throw new SkillError('failed-precondition', BLOCK_UA[why] || why);
    return { skills: Object.assign({}, st.skills, { [id]: 0 }) };
  });
}

function setBar(user, body) {
  const bar = Array.isArray(body.bar) ? body.bar.map(x => (x == null || x === '' ? null : String(x))) : null;
  return withHero(user, (hero, st) => {
    const why = lib().barBlock(st, bar);
    if (why) throw new SkillError('failed-precondition', BLOCK_UA[why] || why);
    if (battleLive(hero)) throw new SkillError('failed-precondition', 'Під час бою панель не змінюється');
    return { skillBar: bar };
  });
}

function chooseClass(user, body) {
  const cls = String(body.cls || '');
  return withHero(user, (hero, st) => {
    const S = lib();
    if (!S.CLASSES[cls]) throw new SkillError('invalid-argument', 'Такого класу немає');
    if (st.cls) throw new SkillError('failed-precondition', 'Клас уже обрано');
    if (st.lv < S.CLASS_LEVEL) throw new SkillError('failed-precondition', 'Клас обирається на ' + S.CLASS_LEVEL + ' рівні');
    return { heroClass: cls };
  });
}

/* Ріст майстерності після бою: спрацювання зі summary.grow бою
   heroes/{id}/battles/{bid}. Один раз на бій (skillGrowIds — останні 30),
   лише вивчені вміння, не більше GROW_CAP спрацювань на хід бою. */
const GROW_CAP = 4;
async function growAfterBattle(user, body) {
  const bid = String(body.bid || '');
  if (!user) throw new SkillError('unauthenticated');
  if (!/^[a-z0-9]{6,40}$/i.test(bid)) throw new SkillError('invalid-argument', 'Немає такого бою');
  const b = await pool.query('select data from docs where path = $1', ['heroes/' + user.uid + '/battles/' + bid]);
  const st = b.rows.length ? b.rows[0].data : null;
  if (!st || st.status !== 'over' || !st.summary) throw new SkillError('failed-precondition', 'Бій ще не завершено');
  const sum = st.summary;
  let report = null;
  const res = await withHero(user, (hero, bst) => {
    const done = Array.isArray(hero.skillGrowIds) ? hero.skillGrowIds : [];
    if (done.indexOf(bid) >= 0) { report = { already: true }; return {}; }
    const S = lib(), cap = Math.max(1, Number(sum.played) || 0) * GROW_CAP;
    const skills = Object.assign({}, bst.skills), before = {}, after = {};
    Object.keys(sum.grow || {}).forEach(id => {
      if (!Object.prototype.hasOwnProperty.call(skills, id)) return;
      const add = Math.max(0, Math.min(cap, Number(sum.grow[id]) || 0));
      if (!add) return;
      const tot = S.growTotal(S.byId(id));
      before[id] = S.pctFromUses(skills[id], tot);
      skills[id] = Math.round((Number(skills[id]) + add) * 10) / 10;
      after[id] = S.pctFromUses(skills[id], tot);
    });
    report = { before, after };
    return { skills, skillGrowIds: done.concat(bid).slice(-30) };
  });
  return Object.assign(res, report);
}

/* поля книги, які браузер не може змінювати напряму (rules.js) */
const PROTECTED = ['skills', 'skillBar', 'heroClass', 'skillBonus', 'skillGrowIds'];

module.exports = { learn, setBar, chooseClass, growAfterBattle, SkillError, PROTECTED, lib };

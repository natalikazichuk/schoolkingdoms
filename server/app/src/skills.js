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
  class: 'Це вміння іншого класу',
  points: 'Немає вільних очок вмінь',
  shape: 'Неправильна панель',
  locked: 'Цей слот ще закритий',
  dup: 'Вміння вже на панелі',
  notactive: 'На панель — лише вивчені активні вміння'
};

/* Читає героя під блокуванням, дає змінити, пише. Лише сам герой. */
function withHero(user, fn) {
  if (!user) throw new SkillError('unauthenticated');
  return withHeroId(user.uid, fn);
}
async function withHeroId(uid, fn) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    const r = await c.query('select data from docs where path = $1 for update', ['heroes/' + uid]);
    if (!r.rows.length) throw new SkillError('permission-denied', 'Книга вмінь — лише для Героя');
    const hero = r.rows[0].data;
    const patch = fn(hero, lib().bookState(hero));
    const next = Object.assign({}, hero, patch, { updatedAt: { $ts: Date.now() } });
    await c.query(`update docs set data = $2, version = version + 1, updated_at = now() where path = $1`,
      ['heroes/' + uid, JSON.stringify(next)]);
    await c.query('commit');
    return pick(next);
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
const pick = h => ({ skills: h.skills || {}, skillBar: h.skillBar || null, heroClass: h.heroClass || null, skillBonus: h.skillBonus || 0, skillFails: h.skillFails || {} });

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

/* Ріст майстерності після бою — з summary бою heroes/{id}/battles/{bid}.
   Вдалі й невдалі спрацювання рахуються ОКРЕМО:
     summary.grow     = {id: вдалих}   → одразу до skills[id];
     summary.growFail = {id: невдалих} → до skillFails[id]; кожні 2 невдалі = +1
                        до skills[id] (тобто на невдачах шкала вдвічі довша).
   Один раз на бій (skillGrowIds — останні 30), лише вивчені вміння,
   не більше GROW_CAP вдалих (і 2×GROW_CAP невдалих) на хід бою. */
const GROW_CAP = 4;
/* чиста частина росту (без бази) — щоб її легко перевірити тестом */
function applyGrow(S, skills0, fails0, sum) {
  const played = Math.max(1, Number(sum.played) || 0);
  const skills = Object.assign({}, skills0), fails = Object.assign({}, fails0 || {});
  const before = {}, after = {}, ok = {}, bad = {};
  const okOf = sum.grow || {}, badOf = sum.growFail || {};
  const clamp = (v, cap) => Math.max(0, Math.min(cap, Math.floor(Number(v) || 0)));
  Object.keys(Object.assign({}, okOf, badOf)).forEach(id => {
    if (!Object.prototype.hasOwnProperty.call(skills, id)) return;
    const a = clamp(okOf[id], played * GROW_CAP), f = clamp(badOf[id], played * GROW_CAP * 2);
    if (!a && !f) return;
    const tot = S.growTotal(S.byId(id));
    before[id] = S.pctFromUses(skills[id], tot);
    let fl = (Number(fails[id]) || 0) + f;
    const conv = Math.floor(fl / 2); fl -= conv * 2;
    skills[id] = Math.round((Number(skills[id]) + a + conv) * 10) / 10;
    fails[id] = fl;
    after[id] = S.pctFromUses(skills[id], tot);
    ok[id] = a; bad[id] = f;
  });
  return { skills, fails, before, after, ok, bad };
}
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
    const g = applyGrow(lib(), bst.skills, hero.skillFails, sum);
    const { skills, fails, before, after, ok, bad } = g;
    report = { before, after, ok, fail: bad };
    return { skills, skillFails: fails, skillGrowIds: done.concat(bid).slice(-30) };
  });
  return Object.assign(res, report);
}

/* Ріст «Торгівлі»: кожна сьогоднішня покупка чи продаж у магазині — одне
   вдале спрацювання. Сервер сам рахує угоди з документа Героя (shopBought /
   shopSold за сьогодні, Київ), тож браузер не може «накрутити» число; уже
   зараховані — у skillTrade {day, n}. Не більше TRADE_DAY_CAP за добу. */
const TRADE_DAY_CAP = 40;
function kyivDay(ts) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts));
}
function tradeDeals(hero, day) {
  const n = a => (Array.isArray(a) ? a : []).filter(t => t && t.day === day).length;
  return n(hero.shopBought) + n(hero.shopSold);
}
async function growTrade(user) {
  let report = null;
  const res = await withHero(user, (hero, bst) => {
    if (!Object.prototype.hasOwnProperty.call(bst.skills, 'base.trade')) { report = { added: 0 }; return {}; }
    const day = kyivDay(Date.now());
    const seen = hero.skillTrade && hero.skillTrade.day === day ? Number(hero.skillTrade.n) || 0 : 0;
    const total = Math.min(TRADE_DAY_CAP, tradeDeals(hero, day));
    const add = Math.max(0, total - seen);
    if (!add) { report = { added: 0 }; return {}; }
    const S = lib(), tot = S.growTotal(S.byId('base.trade'));
    const skills = Object.assign({}, bst.skills);
    const before = S.pctFromUses(skills['base.trade'], tot);
    skills['base.trade'] = Math.round((Number(skills['base.trade']) || 0) + add);
    report = { added: add, before: { 'base.trade': before }, after: { 'base.trade': S.pctFromUses(skills['base.trade'], tot) } };
    return { skills, skillTrade: { day, n: seen + add } };
  });
  return Object.assign(res, report);
}

/* ══ АДМІН (перевірка ролі — у server.js) ══
   Скинути клас: heroClass = null, вміння класу зникають (і з панелі, і невдачі) —
   очки повертаються самі (вільні = за рівні + бонус − вивчені). Базові лишаються. */
const isClassSkill = id => !/^base\./.test(id);
function stripClass(hero, st) {
  const skills = {}, fails = {};
  Object.keys(st.skills).forEach(id => { if (!isClassSkill(id)) skills[id] = st.skills[id]; });
  Object.keys(hero.skillFails || {}).forEach(id => { if (!isClassSkill(id)) fails[id] = hero.skillFails[id]; });
  return { heroClass: null, skills, skillFails: fails, skillBar: st.bar.map(id => (id && isClassSkill(id) ? null : id)) };
}
function resetClass(heroId) {
  return withHeroId(String(heroId || ''), (hero, st) => stripClass(hero, st));
}
/* Тест: дати Героєві клас і ВСІ готові вміння цього класу на pct% (уже вивчені — теж
   на pct%). Очки за це не витрачаються: різниця йде в skillBonus, щоб книга не пішла в мінус. */
function testClass(heroId, body) {
  const cls = String(body.cls || ''), pct = Math.max(25, Math.min(100, Math.round(Number(body.pct) || 50)));
  return withHeroId(String(heroId || ''), (hero, st) => {
    const S = lib();
    if (!S.CLASSES[cls]) throw new SkillError('invalid-argument', 'Такого класу немає');
    const base = stripClass(hero, st), skills = Object.assign({}, base.skills);
    S.readyFor(cls).forEach(s => { skills[s.id] = Math.round(S.usesForPct(pct, S.growTotal(s)) * 10) / 10; });
    const need = Object.keys(skills).length - S.pointsForLevel(st.lv);
    return { heroClass: cls, skills, skillFails: base.skillFails, skillBar: base.skillBar, skillBonus: Math.max(st.bonus, need) };
  });
}
/* Адмін (тест): рівень арени і очки вмінь. level — 1…30 (досвід до наступного рівня — з нуля);
   addPoints — скільки очок вмінь додати (у skillBonus, 0…20). Бій не має йти. */
function setLevel(heroId, body) {
  const lvRaw = body.level == null ? null : Math.floor(Number(body.level));
  const add = Math.max(0, Math.min(20, Math.floor(Number(body.addPoints) || 0)));
  if (lvRaw != null && !(lvRaw >= 1 && lvRaw <= 30)) throw new SkillError('invalid-argument', 'Рівень — від 1 до 30');
  if (lvRaw == null && !add) throw new SkillError('invalid-argument', 'Нічого змінювати');
  return withHeroId(String(heroId || ''), (hero, st) => {
    if (battleLive(hero)) throw new SkillError('failed-precondition', 'Герой зараз у бою — спершу хай завершить бій');
    const out = {};
    if (lvRaw != null) out.arena = Object.assign({}, hero.arena || {}, { level: lvRaw, xp: 0 });
    if (add) out.skillBonus = st.bonus + add;
    return out;
  });
}
/* Список Героїв для адмінки: ім'я, рівень, клас, вміння */
async function heroList() {
  const r = await pool.query(`select id, data from docs where parent = 'heroes' order by data->>'name'`);
  const S = lib();
  return r.rows.map(x => {
    const st = S.bookState(x.data);
    return { id: x.id, name: x.data.name || '', lv: st.lv, cls: st.cls, bonus: st.bonus,
      skills: Object.keys(st.skills).map(id => ({ id, pct: S.mastery(st, id) })) };
  });
}

/* поля книги, які браузер не може змінювати напряму (rules.js) */
const PROTECTED = ['skills', 'skillBar', 'heroClass', 'skillBonus', 'skillGrowIds', 'skillFails', 'skillTrade'];

module.exports = { learn, setBar, chooseClass, growAfterBattle, applyGrow, growTrade, tradeDeals, resetClass, testClass, setLevel, heroList, stripClass, SkillError, PROTECTED, lib };

/* Перенос даних з Firebase у PostgreSQL.
   Вхід (каталог MIGRATION_DIR, за замовчуванням /migration):
     firestore.json — усі документи (export-firestore.js)
     users.json     — акаунти (`firebase auth:export --format=json`)
   Повторний запуск безпечний: документи й акаунти перезаписуються
   за шляхом / uid (з --fresh документи спершу стираються). Паролі, які вже перешифровані після входу на новому
   сервері (s1$), не чіпаємо. Сесії не переносяться — усі входять заново. */
const fs = require('fs');
const path = require('path');
const { pool, migrate, splitPath } = require('./db');

const DIR = process.env.MIGRATION_DIR || '/migration';

function conv(v) {
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return { $ts: Date.parse(v.timestampValue) };
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(conv);
  if ('mapValue' in v) return convFields(v.mapValue.fields || {});
  throw new Error('невідомий тип значення: ' + Object.keys(v).join(','));
}
function convFields(f) {
  const out = {};
  for (const k of Object.keys(f)) out[k] = conv(f[k]);
  return out;
}

(async () => {
  await migrate();
  const docs = JSON.parse(fs.readFileSync(path.join(DIR, 'firestore.json'), 'utf8'));
  const users = JSON.parse(fs.readFileSync(path.join(DIR, 'users.json'), 'utf8')).users;
  const c = await pool.connect();
  try {
    await c.query('begin');
    // --fresh: спершу стерти всі документи (остаточний перенос перед перемиканням)
    if (process.argv.includes('--fresh')) await c.query('delete from docs');
    let n = 0;
    for (const d of docs) {
      const sp = splitPath(d.path);
      if (!sp) throw new Error('поганий шлях ' + d.path);
      await c.query(
        `insert into docs (path, parent, id, data, created_at, updated_at) values ($1, $2, $3, $4, $5, $6)
         on conflict (path) do update set data = excluded.data, version = docs.version + 1,
           created_at = excluded.created_at, updated_at = excluded.updated_at`,
        [d.path, sp.parent, sp.id, JSON.stringify(convFields(d.fields)), d.createTime, d.updateTime]);
      n++;
    }
    let a = 0, skipped = 0;
    for (const u of users) {
      if (!u.email || !u.passwordHash || !u.salt) { skipped++; continue; }
      await c.query(
        `insert into accounts (uid, email, pass, created_at, disabled) values ($1, $2, $3, to_timestamp($4 / 1000.0), $5)
         on conflict (uid) do update set email = excluded.email, disabled = excluded.disabled,
           pass = case when accounts.pass like 's1$%' then accounts.pass else excluded.pass end`,
        [u.localId, u.email.toLowerCase(), 'fb$' + u.passwordHash + '$' + u.salt, Number(u.createdAt || Date.now()), !!u.disabled]);
      a++;
    }
    await c.query('commit');
    console.log(`документів: ${n}, акаунтів: ${a}, пропущено акаунтів без пароля: ${skipped}`);
  } catch (e) {
    await c.query('rollback');
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
})().catch(e => { console.error(e); process.exit(1); });

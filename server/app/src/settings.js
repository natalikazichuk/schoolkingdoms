/* Налаштування сайту, які адмін задає в адмінці, а не у /srv/sk/.env (таблиця settings).
   Зараз — лише ключ OpenAI для «Аватара з фото». Значення читаються лише сервером:
   жодне API не віддає їх назад (адмінка бачить тільки останні 4 символи). */
const { pool } = require('./db');

const cache = new Map();
let loaded = false;

async function load() {
  const r = await pool.query('select key, value from settings');
  cache.clear();
  r.rows.forEach(x => cache.set(x.key, x.value));
  loaded = true;
}
const get = k => cache.get(k) || null;
const isLoaded = () => loaded;

async function set(k, v) {
  if (v) await pool.query(`insert into settings (key, value) values ($1, $2)
                            on conflict (key) do update set value = excluded.value, updated_at = now()`, [k, v]);
  else await pool.query('delete from settings where key = $1', [k]);
  if (v) cache.set(k, v); else cache.delete(k);
}

module.exports = { load, get, set, isLoaded };

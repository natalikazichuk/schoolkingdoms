/* PostgreSQL: документи (як у Firestore — колекції/документи/підколекції),
   акаунти й сесії. Документ зберігається цілим у jsonb. */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://sk:sk@db:5432/sk',
  max: 10
});

const SCHEMA = `
create table if not exists docs (
  path       text primary key,            -- heroes/abc  або  heroes/abc/battles/b1
  parent     text not null,               -- шлях колекції: heroes  або  heroes/abc/battles
  id         text not null,
  data       jsonb not null,
  version    bigint not null default 1,   -- для транзакцій (оптимістичне блокування)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists docs_parent on docs (parent);

create table if not exists accounts (
  uid        text primary key,            -- той самий uid, що був у Firebase
  email      text not null unique,
  pass       text not null,
  created_at timestamptz not null default now(),
  last_login timestamptz,
  disabled   boolean not null default false
);

create table if not exists sessions (
  token      text primary key,            -- sha256 від токена з cookie
  uid        text not null references accounts(uid) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);
create index if not exists sessions_uid on sessions (uid);

-- черга образів Героя (src/avatar.js): один рядок на набір «база + речі»
create table if not exists avatar_jobs (
  id          bigserial primary key,
  key         text not null unique,         -- хеш набору; той самий набір — той самий образ
  status      text not null default 'queued', -- queued | working | done | failed | cancelled
  spec        jsonb not null,               -- що малювати (база, слоти з речами, промпт)
  attempts    int not null default 0,
  worker      text,
  lease_until timestamptz,                  -- воркер має повернути результат до цього часу
  error       text,
  file        text,                         -- готові файли: AVATAR_DIR/<file>-full|256|96.webp
  created_at  timestamptz not null default now(),
  queued_at   timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  done_at     timestamptz
);
create index if not exists avatar_jobs_queue on avatar_jobs (status, queued_at);
`;

async function migrate() { await pool.query(SCHEMA); }

function splitPath(path) {
  const segs = String(path || '').split('/');
  if (segs.length < 2 || segs.length % 2 !== 0 || segs.some(s => !s)) return null;
  return { parent: segs.slice(0, -1).join('/'), id: segs[segs.length - 1] };
}
function isCollPath(path) {
  const segs = String(path || '').split('/');
  return segs.length % 2 === 1 && segs.every(s => !!s);
}

module.exports = { pool, migrate, splitPath, isCollPath };

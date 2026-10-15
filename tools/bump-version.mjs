#!/usr/bin/env node
/* ============================================================
   bump-version.mjs — піднімає ?v=N спільного файлу одразу в усіх місцях.

   Після правки sk-items.js (чи будь-якого sk-*.js / *.css, що
   підключається з ?v=N):
     node tools/bump-version.mjs sk-items.js            # v=max+1 скрізь
     node tools/bump-version.mjs sk-items.js sk-report.js
     node tools/bump-version.mjs --align                # розбіжні → до max, без підняття

   Шукає підключення в *.html і *.js (крім docs/, node_modules/, dist-demo/).
   Якщо файл є в офлайн-кеші sw.js — піднімає й VERSION кешу, щоб старий
   кеш скинувся. Перевірка, що розбіжностей немає, — tools/qa/static-audit.mjs.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SKIP = new Set(['.git', 'node_modules', 'dist-demo', 'docs']);
const args = process.argv.slice(2);
const align = args.includes('--align');
const names = args.filter(a => !a.startsWith('--')).map(a => path.basename(a));
if (!align && !names.length) {
  console.error('Використання: node tools/bump-version.mjs <файл.js|css> [...]  або  --align');
  process.exit(2);
}

const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    if (SKIP.has(f)) continue;
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(html|js|mjs)$/.test(f) && p !== new URL(import.meta.url).pathname) files.push(p);
  }
})(ROOT);
const texts = new Map(files.map(f => [f, fs.readFileSync(f, 'utf8')]));

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const refRe = name => new RegExp('(^|[^\\w.-])(' + esc(name) + ')\\?v=(\\d+)', 'g');

// усі файли з ?v=N і їхні версії
const versions = new Map();   // name → Set(N)
for (const t of texts.values())
  for (const m of t.matchAll(/([\w.-]+\.(?:js|css))\?v=(\d+)/g)) {
    if (!versions.has(m[1])) versions.set(m[1], new Set());
    versions.get(m[1]).add(Number(m[2]));
  }

const targets = new Map();    // name → нова версія
for (const n of names) {
  if (!versions.has(n)) { console.error(`✗ ${n}: ніде не підключено з ?v=N`); process.exit(1); }
  targets.set(n, Math.max(...versions.get(n)) + 1);
}
if (align) for (const [n, vs] of versions) if (vs.size > 1 && !targets.has(n)) targets.set(n, Math.max(...vs));
if (!targets.size) { console.log('✓ розбіжностей немає — нічого міняти'); process.exit(0); }

let swTouched = false;
const changed = new Map();    // name → кількість замін
for (const [f, t] of texts) {
  let out = t;
  for (const [n, v] of targets)
    out = out.replace(refRe(n), (all, pre, nm, old) => {
      if (Number(old) === v) return all;
      changed.set(n, (changed.get(n) || 0) + 1);
      if (path.basename(f) === 'sw.js') swTouched = true;
      return `${pre}${nm}?v=${v}`;
    });
  if (out !== t) texts.set(f, out), fs.writeFileSync(f, out);
}

if (swTouched) {
  const sw = path.join(ROOT, 'sw.js');
  const t = fs.readFileSync(sw, 'utf8');
  const out = t.replace(/const VERSION = 'sk-offline-v(\d+)';/, (_, n) => `const VERSION = 'sk-offline-v${Number(n) + 1}';`);
  if (out !== t) { fs.writeFileSync(sw, out); console.log('↻ sw.js: VERSION кешу піднято'); }
}
for (const [n, v] of targets) console.log(`✓ ${n} → v=${v} (${changed.get(n) || 0} замін)`);

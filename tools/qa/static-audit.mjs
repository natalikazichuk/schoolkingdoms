#!/usr/bin/env node
/* ============================================================
   static-audit.mjs — статична перевірка сайту без браузера.

   Перевіряє:
     • синтаксис інлайн-скриптів у кожній HTML-сторінці і всіх *.js
       (node --check; ES-модулі — як модулі);
     • баланс фігурних дужок CSS (inline <style> і *.css);
     • локальні src/href, яких немає на диску;
     • однакові спільні файли, підключені з різними ?v=N;
     • <html lang>, <title>, viewport.

   Запуск:  node tools/qa/static-audit.mjs          (з кореня репозиторію)
   Код виходу 1 — якщо є синтаксичні помилки або дисбаланс дужок.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(process.argv[2] || '.');
const SKIP = new Set(['.git', 'node_modules', 'dist-demo', 'docs']);
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    if (SKIP.has(f)) continue;
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p); else files.push(p);
  }
})(ROOT);
const rel = p => path.relative(ROOT, p);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-audit-'));

const R = { syntax: [], css: [], missing: [], versions: {}, meta: [] };
const ver = {};   // файл → {версія → [де підключено]}
function noteVer(where, u) {
  const m = u.match(/([\w.-]+\.(?:js|css))\?v=(\d+)/);
  if (!m) return;
  ((ver[m[1]] ??= {})[m[2]] ??= []).push(where);
}
function check(code, isModule, label) {
  const fp = path.join(tmp, 'x' + Math.random().toString(36).slice(2) + (isModule ? '.mjs' : '.js'));
  fs.writeFileSync(fp, code);
  try { execFileSync(process.execPath, ['--check', fp], { stdio: 'pipe' }); }
  catch (e) { R.syntax.push(label + ': ' + String(e.stderr).split('\n').find(l => /Error/.test(l))); }
}
function braces(text, label) {
  const o = (text.match(/{/g) || []).length, c = (text.match(/}/g) || []).length;
  if (o !== c) R.css.push(`${label}: { ${o} / } ${c}`);
}

for (const f of files.filter(f => f.endsWith('.html'))) {
  const t = fs.readFileSync(f, 'utf8');
  if (!/<html[^>]*\slang=/.test(t)) R.meta.push(rel(f) + ': немає <html lang>');
  if (!/<title>/.test(t)) R.meta.push(rel(f) + ': немає <title>');
  if (!/name=["']viewport/.test(t)) R.meta.push(rel(f) + ': немає viewport');
  let m, i = 0;
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
  while ((m = re.exec(t))) {
    const [, attrs, body] = m;
    if (!body.trim() || /type=["'](application\/(ld\+)?json|text\/(template|x-))/.test(attrs)) continue;
    check(body, /type=["']module/.test(attrs), `${rel(f)} <script #${i++}>`);
  }
  braces([...t.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(x => x[1]).join(''), rel(f) + ' <style>');
  const re2 = /(?:href|src)=["']([^"'#${}]+?)(\?[^"'#]*)?(#[^"']*)?["']/g;
  while ((m = re2.exec(t))) {
    const u = m[1];
    noteVer(rel(f), u + (m[2] || ''));
    if (/^(https?:|mailto:|tel:|data:|javascript:|blob:|\/\/)/.test(u) || u.includes('+') || !/\.\w+$/.test(u)) continue;
    const target = u.startsWith('/') ? path.join(ROOT, u) : path.resolve(path.dirname(f), decodeURIComponent(u));
    if (!fs.existsSync(target)) R.missing.push(`${rel(f)} → ${u}`);
  }
}
for (const f of files.filter(f => /\.m?js$/.test(f))) {
  const t = fs.readFileSync(f, 'utf8');
  check(t, f.endsWith('.mjs') || /^\s*(import|export)\s/m.test(t), rel(f));
  for (const m of t.matchAll(/['"`]([^'"`\s]*?[\w.-]+\.(?:js|css)\?v=\d+)['"`]/g)) noteVer(rel(f), m[1]);
}
for (const f of files.filter(f => f.endsWith('.css'))) braces(fs.readFileSync(f, 'utf8'), rel(f));
for (const [file, vs] of Object.entries(ver)) if (Object.keys(vs).length > 1)
  R.versions[file] = Object.fromEntries(Object.entries(vs).map(([v, w]) => [v, w.length + ' (' + [...new Set(w)].slice(0, 3).join(', ') + (w.length > 3 ? ', …' : '') + ')']));
fs.rmSync(tmp, { recursive: true, force: true });

const sect = (title, arr) => { console.log(`\n${arr.length ? '✗' : '✓'} ${title}: ${arr.length}`); arr.forEach(x => console.log('    ' + x)); };
sect('Синтаксичні помилки JS', R.syntax);
sect('Дисбаланс дужок CSS', R.css);
sect('Локальні файли, яких немає', R.missing);
sect('Мета-теги', R.meta);
const vk = Object.keys(R.versions);
console.log(`\n${vk.length ? '⚠' : '✓'} Різні ?v=N одного файлу: ${vk.length}`);
for (const k of vk) { console.log('    ' + k); for (const [v, w] of Object.entries(R.versions[k])) console.log(`        v=${v}: ${w}`); }
process.exit(R.syntax.length || R.css.length ? 1 : 0);

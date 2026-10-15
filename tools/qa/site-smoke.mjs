#!/usr/bin/env node
/* ============================================================
   site-smoke.mjs — smoke-тест ПОВНОЇ версії сайту в Chromium.

   Піднімає статичний сервер над репозиторієм, а /api/* відповідає
   «гість не увійшов» (сервера й бази не треба). Відкриває кожну
   *.html (крім docs/, server/, demo/, tools/) і збирає:
     • необроблені помилки JS (pageerror);
     • локальні файли з відповіддю 4xx/5xx.
   Сторінки, що вимагають входу, перекидають на login.html — це норма;
   їхню логіку після входу цей тест не перевіряє.

   Падіння (код виходу 1): помилка JS або відсутній код/стиль/сторінка.
   Відсутні картинки й звуки — лише попередження (прогалина контенту,
   сторінки показують запасний варіант); --strict робить і їх падінням.

   Потрібен playwright:  npm install   (з кореня; або глобально)
   Запуск:  node tools/qa/site-smoke.mjs [--strict]
   ============================================================ */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ARGS = process.argv.slice(2);
const STRICT = ARGS.includes('--strict');
const DIR = path.resolve(ARGS.find(a => !a.startsWith('--')) || '.');
const MEDIA = /\.(png|jpe?g|webp|gif|svg|ico|mp3|wav|ogg)$/i;
const PORT = 8765;
const SKIP = new Set(['.git', 'docs', 'node_modules', 'dist-demo', 'server', 'demo', 'tools']);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.startsWith('/api/')) {
    const me = p === '/api/auth/me';
    res.writeHead(me ? 200 : 401, { 'content-type': 'application/json' });
    return res.end(me ? '{"user":null}' : '{"error":{"code":"unauthenticated"}}');
  }
  let f = path.join(DIR, p);
  if (f.endsWith(path.sep)) f = path.join(f, 'index.html');
  if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT);

const pages = [];
(function walk(d) {
  for (const x of fs.readdirSync(d)) {
    if (SKIP.has(x)) continue;
    const p = path.join(d, x);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.html')) pages.push(path.relative(DIR, p).split(path.sep).join('/'));
  }
})(DIR);

const browser = await chromium.launch();
let bad = 0, warned = 0;
for (const pg of pages.sort()) {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [], missing = new Set();
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 200)));
  page.on('response', r => {
    const u = new URL(r.url());
    if (r.status() >= 400 && u.port === String(PORT) && !u.pathname.startsWith('/api/')) missing.add(r.status() + ' ' + u.pathname);
  });
  try {
    await page.goto(`http://localhost:${PORT}/${pg}`, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(1200);
  } catch (e) { errors.push('навігація: ' + e.message.slice(0, 120)); }
  const media = [...missing].filter(m => !STRICT && MEDIA.test(m));
  const broken = [...missing].filter(m => !media.includes(m));
  if (errors.length || broken.length) {
    bad++;
    console.log('✗ ' + pg);
    errors.forEach(e => console.log('    JS  ' + e));
    broken.forEach(m => console.log('    ' + m));
    media.forEach(m => console.log('    ⚠ ' + m));
  } else if (media.length) {
    warned++;
    console.log('⚠ ' + pg + ' — немає ' + media.length + ' медіафайл(ів):');
    media.forEach(m => console.log('    ' + m));
  }
  await ctx.close();
}
await browser.close();
server.close();
console.log(`\n${pages.length - bad}/${pages.length} сторінок без помилок` + (warned ? ` (з них ${warned} — без частини картинок/звуків)` : ''));
process.exitCode = bad ? 1 : 0;

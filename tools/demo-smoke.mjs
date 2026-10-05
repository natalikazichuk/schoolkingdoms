#!/usr/bin/env node
/* ============================================================
   demo-smoke.mjs — smoke-тест демо-версії (dist-demo/) у Chromium.

   Відкриває головну демо та кожну сторінку з неї і перевіряє:
     • немає відповідей 4xx/5xx (биті картинки, звук, скрипти);
     • немає необроблених помилок JS;
     • немає жодного запиту до Firebase / Google Auth;
     • сторінка не перекидає на редірект-заглушку (hero, login, arena…).

   Потрібен playwright:  npm i -D playwright   (або глобально)
   Запуск:  node tools/build-demo.mjs && node tools/demo-smoke.mjs [dist-demo]
   ============================================================ */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const DIR = path.resolve(process.argv[2] || 'dist-demo');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(DIR, p);
  if (f.endsWith(path.sep)) f = path.join(f, 'index.html');
  if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const ORIGIN = 'http://localhost:' + server.address().port + '/';

const launch = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
const browser = await chromium.launch(launch);
const page = await browser.newPage();

const REDIRECT_STUBS = new Set(['hero.html', 'arena.html', 'login.html', 'auth.html', 'parent.html',
  'inventar.html', 'ekipirovka.html', 'karta.html', 'navchannia.html', 'doshkillya.html', 'tests.html',
  'biblioteka.html', 'book.html', 'slovnyk-en.html', 'admin.html']);

/* Файли, яких немає і в повній версії (не помилка демо): показуємо попередженням.
   audio/infcomp_N.mp3 — необовʼязкова озвучка слайдів (сторінка має запасний варіант). */
const KNOWN_MISSING = ['audio/infcomp_', 'img/sl/dzob.webp', 'img/sl/zozulia.webp', 'img/sl/zahadka.webp'];
const known = new Set();

async function visit(url) {
  const issues = [];
  const onResp = r => {
    if (!r.url().startsWith(ORIGIN) || r.status() < 400) return;
    const p = r.url().slice(ORIGIN.length);
    if (KNOWN_MISSING.some(k => p.startsWith(k))) known.add(p); else issues.push(r.status() + ' ' + p);
  };
  const onReq = r => { if (!r.url().startsWith(ORIGIN) && /firebase|identitytoolkit|googleapis\.com\/(identity|google\.firestore)/i.test(r.url())) issues.push('FIREBASE ' + r.url()); };
  const onErr = e => issues.push('JS ' + e.message.split('\n')[0]);
  page.on('response', onResp); page.on('request', onReq); page.on('pageerror', onErr);
  const nav = [];
  const onNav = f => { if (f === page.mainFrame()) nav.push(f.url()); };
  page.on('framenavigated', onNav);
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(1200);
  } catch (e) { issues.push('LOAD ' + e.message.split('\n')[0]); }
  const landed = nav.map(u => u.split('?')[0].slice(ORIGIN.length)).find(p => REDIRECT_STUBS.has(p.split('/').pop()));
  if (landed) issues.push('REDIRECT → ' + landed);
  page.off('response', onResp); page.off('request', onReq); page.off('pageerror', onErr); page.off('framenavigated', onNav);
  return issues;
}

const home = await visit(ORIGIN + 'index.html');
const links = await page.$$eval('a[href]', as => [...new Set(as.map(a => a.getAttribute('href')))]
  .filter(h => h && !h.startsWith('#') && !/^https?:/.test(h)));

let failed = 0;
const report = [['index.html', home]];
for (const href of links) report.push([href, await visit(ORIGIN + href)]);
for (const [href, issues] of report) {
  if (issues.length) { failed++; console.log('✗ ' + href + '\n    ' + [...new Set(issues)].join('\n    ')); }
  else console.log('✓ ' + href);
}
if (known.size) console.log('\n⚠ немає і в повній версії (не блокує демо):\n    ' + [...known].join('\n    '));
console.log(`\n${report.length - failed}/${report.length} сторінок без помилок`);
await browser.close();
server.close();
process.exit(failed ? 1 : 0);

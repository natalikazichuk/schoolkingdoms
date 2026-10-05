#!/usr/bin/env node
/* ============================================================
   build-demo.mjs — збирає ДЕМО-версію SchoolKingdoms (1 клас) у dist-demo/.

   Демо = статичний сайт без Firebase, входу, Героя, Арени й адмінки:
     • сторінки 1 класу (klas-1/), learn/, ігри (games/), плеєр тестів;
     • firebase-config.js підміняється на demo/sk-demo.js (без бази);
     • нагороди, 🐞-звіти й прогрес героя — заглушки з demo/stubs/;
     • у футері немає вкладки «Арена», «Головна» веде на демо-головну;
     • сторінки, яких у демо немає (hero, arena, login, …), — редірект на index.html;
     • медіа копіюються лише ті, на які посилаються скопійовані файли.

   Запуск:  node tools/build-demo.mjs        → dist-demo/
   Перевірка: node tools/build-demo.mjs --check (лише звіт, нічого не пише)
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEMO = path.join(ROOT, 'demo');
const OUT = path.join(ROOT, 'dist-demo');

/* Що потрапляє в демо (шляхи від кореня репозиторію). */
const PAGE_DIRS = ['klas-1', 'games', 'learn'];
const ROOT_PAGES = ['test.html', 'igry.html', 'prezentaciya.html'];
const SHARED = [
  'sk-curriculum.js', 'sk-finish.js', 'sk-items.js', 'sk-prize.js', 'sk-cards.js', 'sk-covers.js',
  'sk-voice.js', 'sk-zadachi.js', 'sk-slovnykovi.js', 'sk-phonics.js', 'sk-avatar.js',
  'sk-styles.css', 'sk-game.css', 'sk-game-chalk.css', 'hero.css',
  'favicon-32.png', 'apple-touch-icon.png', 'logo-small.png', 'logo-big.webp', 'landing-bg.webp'
];
/* Підміни: файл у dist ← файл із demo/. */
const REPLACE = {
  'firebase-config.js': 'sk-demo.js',
  'sk-rewards.js': 'stubs/sk-rewards.js',
  'sk-report.js': 'stubs/sk-report.js',
  'sk-progress.js': 'stubs/sk-progress.js'
};
/* Сторінки повної версії, яких у демо немає → редірект на демо-головну. */
const REDIRECTS = [
  'hero.html', 'arena.html', 'login.html', 'auth.html', 'parent.html', 'inventar.html',
  'ekipirovka.html', 'karta.html', 'navchannia.html', 'doshkillya.html', 'tests.html',
  'biblioteka.html', 'book.html', 'slovnyk-en.html', 'admin.html'
];
/* У демо не має бути жодного звернення до цих речей. */
const FORBIDDEN = [/firebaseapp\.com|firebaseio\.com|googleapis\.com\/identitytoolkit/i, /gstatic\.com\/firebasejs/i, /href="[^"]*arena\.html/i, /'[^']*arena\.html'/i];

const CHECK = process.argv.includes('--check');
const copied = new Set();
const missing = new Set();

function rel(p) { return path.relative(ROOT, p).split(path.sep).join('/'); }
function exists(r) { return fs.existsSync(path.join(ROOT, r)) && fs.statSync(path.join(ROOT, r)).isFile(); }
function write(r, data) {
  if (CHECK) return;
  const dst = path.join(OUT, r);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, data);
}
function copy(r) {
  if (copied.has(r)) return;
  if (!exists(r)) { missing.add(r); return; }
  copied.add(r);
  if (!CHECK) {
    const dst = path.join(OUT, r);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(path.join(ROOT, r), dst);
  }
}
function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const r = dir ? dir + '/' + e.name : e.name;
    if (e.isDirectory()) out.push(...walk(r)); else out.push(r);
  }
  return out;
}
const MEDIA = [...walk('img'), ...walk('audio')];

/* ── 1. Чистий старт ───────────────────────────────────────── */
if (!CHECK) fs.rmSync(OUT, { recursive: true, force: true });

/* ── 2. Сторінки та спільні файли ──────────────────────────── */
const pages = [...ROOT_PAGES, ...PAGE_DIRS.flatMap(d => walk(d).filter(f => f.endsWith('.html')))];
/* Власні меню окремих сторінок: прибираємо Арену й Бібліотеку, «Тести» → розділ тестів демо. */
function demoPage(src) {
  return src
    /* підказки «увійди як Герой» — у демо входу немає */
    .replace(/setSync\("увійди як Герой","no"\)/g, 'setSync("демо: прогрес у браузері","no")')
    .replace(/'<div class="warn">Ти не увійшов як Герой[^\n]*<\/div>';/, "'';")
    .replace(/'ℹ️ Увійди Героєм, щоб зберегти нагороду'/g, "'💾 Демо: результат зберігається лише в цьому браузері'")
    .replace(/🦁 До Героя/g, '🏠 На головну')
    .replace(/'<a href="(?:\.\.\/)?(?:arena|biblioteka)\.html">[^']*<\/a>'\s*\+\s*/g, '')
    .replace(/(href=")((?:\.\.\/)?)hero\.html"/g, '$1$2index.html"')
    .replace(/(href=")((?:\.\.\/)?)tests\.html"/g, '$1$2index.html#tests"');
}
for (const r of pages) {
  if (!exists(r)) { missing.add(r); continue; }
  copied.add(r);
  write(r, demoPage(fs.readFileSync(path.join(ROOT, r), 'utf8')));
}
SHARED.forEach(copy);

/* ── 3. Підміни ────────────────────────────────────────────── */
for (const [dst, src] of Object.entries(REPLACE)) {
  write(dst, fs.readFileSync(path.join(DEMO, src)));
  copied.add(dst);
}

/* Футер: без Арени, «Головна» → демо-головна. */
let footer = fs.readFileSync(path.join(ROOT, 'sk-footer.js'), 'utf8');
const footerBefore = footer;
footer = footer
  .replace(/\s*tab\('arena',[^\n]*\n/, '\n')
  .replace("tab('home',       'hero.html'", "tab('home',       'index.html'")
  .replace("var fallback = skb || fb || 'hero.html';", "var fallback = skb || fb || 'index.html';");
if (footer === footerBefore || /arena\.html/.test(footer)) throw new Error('sk-footer.js: не вдалося прибрати Арену — оновіть build-demo.mjs');
write('sk-footer.js', footer);
copied.add('sk-footer.js');

/* Шапка: замість «Увійди як Герой…» — позначка демо, бренд веде на демо-головну. */
let header = fs.readFileSync(path.join(ROOT, 'sk-header.js'), 'utf8');
header = header
  .replace(/'<a class="sk-hd__brand" href="hero\.html"/, '\'<a class="sk-hd__brand" href="\'+BASE+\'index.html"')
  .replace(/'<span class="sk-hd__guest" id="skHdGuest">Увійди як '\s*\n\s*\+'<a href="login\.html\?next=hero">Герой<\/a>, щоб бачити характеристики\.<\/span>'/,
           "'<span class=\"sk-hd__guest\" id=\"skHdGuest\">Демо-версія · 1 клас · без реєстрації</span>'");
header = header.replace("'.sk-hd__guest{display:none;", "'.sk-hd__nav{display:none!important}.sk-hd__guest{display:none;");
if (/login\.html\?next=hero/.test(header)) throw new Error('sk-header.js: не вдалося замінити підказку входу — оновіть build-demo.mjs');
write('sk-header.js', header);
copied.add('sk-header.js');

/* Демо-головна та редіректи. */
write('index.html', fs.readFileSync(path.join(DEMO, 'index.html')));
copied.add('index.html');
const redirect = '<!DOCTYPE html><meta charset="utf-8"><title>SchoolKingdoms demo</title>'
  + '<meta http-equiv="refresh" content="0;url=index.html"><script>location.replace("index.html")</script>';
REDIRECTS.forEach(r => { write(r, redirect); copied.add(r); });

/* ── 4. Тести 1 класу → data/tests.json ────────────────────── */
function readTests(file) {
  if (!fs.existsSync(file)) return [];
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  return Array.isArray(d) ? d : (Array.isArray(d.tests) ? d.tests : [d]);
}
function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9а-яіїєґ]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60);
}
const sources = [
  path.join(DEMO, 'data', 'tests-export.json'),        // експорт з адмінки (якщо є)
  path.join(ROOT, 'test-template-levels.json'),
  path.join(ROOT, 'test-sklad-chysla-visual.json')
];
const tests = [];
const seen = new Set();
for (const f of sources) {
  for (const t of readTests(f)) {
    if (!t || t.active === false || Number(t.grade ?? 1) !== 1) continue;
    if (!(t.questions || t.levels)) continue;                // html-записи — це сторінки klas-1/
    const key = String(t.title || '').trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const clean = Object.assign({}, t, { id: t.id || 'demo-' + slug(t.title), grade: 1 });
    delete clean.stat; delete clean.statValue; delete clean.statMode;   // у демо характеристик немає
    tests.push(clean);
  }
}
write('data/tests.json', JSON.stringify(tests, null, 1));
copied.add('data/tests.json');

/* ── 5. Медіа, на які посилаються скопійовані файли ───────── */
const TEXT = /\.(html|js|css|json)$/;
const REF = /(?:\.\.\/)*((?:img|audio)\/[A-Za-z0-9_\-./]*)/g;
const ROOT_ASSET = /(?:\.\.\/)+([A-Za-z0-9_\-]+\.(?:webp|png|jpe?g|svg|gif|mp3|json))/g;
/* Шукаємо в ТОМУ, що потрапило в демо (після підмін), а не в оригіналах. */
function builtPath(r) {
  if (!CHECK) return path.join(OUT, r);
  return REPLACE[r] ? path.join(DEMO, REPLACE[r]) : path.join(ROOT, r);
}
const textFiles = [...copied].filter(r => TEXT.test(r) && !r.startsWith('data/') && fs.existsSync(builtPath(r)));
for (const r of textFiles) {
  const src = fs.readFileSync(builtPath(r), 'utf8');
  for (const m of src.matchAll(REF)) {
    const ref = m[1].replace(/[.\/]+$/, m[1].endsWith('/') ? '/' : '');
    if (exists(ref)) { copy(ref); continue; }
    // динамічний шлях ('img/tr/' + name) → копіюємо все з таким префіксом
    const hits = MEDIA.filter(f => f.startsWith(ref));
    if (hits.length && ref.length > 4) hits.forEach(copy);
  }
  for (const m of src.matchAll(ROOT_ASSET)) if (exists(m[1])) copy(m[1]);
  // сторінки в корені посилаються на кореневі файли без ../ ('test-bg.webp')
  if (!r.includes('/')) for (const m of src.matchAll(/["'(]([A-Za-z0-9_\-]+\.(?:webp|png|jpe?g|svg|gif|mp3))["')?]/g)) if (exists(m[1])) copy(m[1]);
}

/* ── 6. Перевірка: жодних звернень до Firebase / Арени ────── */
const problems = [];
for (const r of copied) {
  if (!TEXT.test(r)) continue;
  const file = builtPath(r);
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  for (const re of FORBIDDEN) if (re.test(src)) problems.push(r + ' → ' + re);
}

let bytes = 0;
if (!CHECK) for (const r of copied) { const f = path.join(OUT, r); if (fs.existsSync(f)) bytes += fs.statSync(f).size; }
console.log(`demo: ${pages.length} сторінок, ${tests.length} тестів, ${copied.size} файлів` + (CHECK ? '' : `, ${(bytes / 1048576).toFixed(1)} МБ → ${rel(OUT)}/`));
if (missing.size) console.log('немає у репозиторії (пропущено):', [...missing].join(', '));
if (problems.length) {
  console.error('ЗАБОРОНЕНІ ПОСИЛАННЯ:\n  ' + problems.join('\n  '));
  process.exit(1);
}

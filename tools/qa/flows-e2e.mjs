#!/usr/bin/env node
/* ============================================================
   flows-e2e.mjs — e2e-тести ЛОГІКИ сторінок у Chromium (після входу).

   site-smoke.mjs лише відкриває сторінки гостем. Тут — сценарії з даними:
   firebase-config.js підміняється заглушкою window.SK з відомими героями,
   тестами й прогресом, і перевіряється, що сторінка порахувала й показала
   саме те, що мала. Сервера й бази не треба.

     1. test.html   — журнал спроб sk_testlog_<id>: бал, помилки, перезапуски
     2. hero.html   — рейтинг «Навчання» / «Арена», «Сімʼя» / «Друзі»,
                      публікація learn у картку; завдання батьків не дають ⭐
     3. hero.html   — «Мої здібності»: суперсили, що прокачати, наступний крок, ▶
     4. parent.html — «Здібності»: лічильники, рекомендація, «➕ Задати»
     5. hero.html   — павутинка: рівень предметів, картки, обкладинки й запасні картинки
     6. hero.html   — павутинка за класами: перемикач, свій клас першим, інші — лише зі спробами

   Падіння (код виходу 1): будь-яка перевірка не справдилась або помилка JS.
   Запуск:  node tools/qa/flows-e2e.mjs        (з кореня; потрібен playwright)
   ============================================================ */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const DIR = path.resolve('.');
const PORT = 8766;
const BASE = `http://localhost:${PORT}`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.startsWith('/api/')) { res.writeHead(401, { 'content-type': 'application/json' }); return res.end('{}'); }
  const f = path.join(DIR, p);
  if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT);

/* ── спільні дані ── тести 1 класу з назвами з карти за замовчуванням (sk-curriculum.js) */
const TESTS = [
  { id: 'a1', title: 'Додавання до 10',  subject: 'Математика', grade: 1 },
  { id: 'a2', title: 'Віднімання до 10', subject: 'Математика', grade: 1 },
  { id: 'b1', title: 'Додавання до 20',  subject: 'Математика', grade: 1 },
  { id: 'c1', title: 'Порівняння чисел', subject: 'Математика', grade: 1 },
  { id: 'd1', title: 'Геометричні фігури', subject: 'Математика', grade: 1 }
];
/* журнал: «майстер» у темі «Числа в межах 10», «вміє» — фігури, «повторити» — порівняння */
const LOGS = { a1: [95, 100], a2: [90, 100], c1: [40], d1: [70, 80] };
const PASSED = ['a1', 'a2', 'd1'];   // sk_testpass_* (ставить test.html при ≥55%)

/* текст заглушки window.SK: усе, чого немає в obj, — async () => null */
const stub = body => `
  window.__calls = [];
  const __D = 864e5, __N = Date.now();
  const __log = a => a.map((pct, i) => ({ at: __N - (a.length - i) * __D, pct, correct: 0, total: 10,
                                         wrong: pct < 80 ? ['7 + 8 = ?'] : [], restarts: 0 }));
  const __obj = (function(){ ${body} })();
  window.SK = new Proxy(__obj, { get: (o, k) => (k in o ? o[k] : (async () => null)) });`;

const browser = await chromium.launch();
const results = [];

async function scenario(name, fn){
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message).slice(0, 200)));
  try {
    await fn(page, (sk) => page.route('**/firebase-config.js', r => r.fulfill({ contentType: 'text/javascript', body: stub(sk) })));
    assert.deepEqual(errors, [], 'помилки JS на сторінці');
    results.push({ name, ok: true });
    console.log('✓ ' + name);
  } catch (e) {
    results.push({ name, ok: false });
    console.log('✗ ' + name + '\n    ' + String(e.message).split('\n').join('\n    '));
  } finally { await ctx.close(); }
}

/* ── 1. test.html: журнал спроб ── */
await scenario('test.html — журнал спроб: бал, помилка, перезапуски', async (page, withSK) => {
  const T = { id: 'q3', title: 'Додавання до 10', subject: 'Математика', grade: 1, stat: 'accuracy', statValue: 1, active: true,
    questions: [{ q: '2 + 3 = ?', options: ['6', '4', '5'], correct: 2 }, { q: '4 + 4 = ?', options: ['9', '8', '7'], correct: 1 },
                { q: '6 + 1 = ?', options: ['8', '7', '6'], correct: 1 }] };
  await withSK(`return { ready: Promise.resolve({ uid: 'h1' }), isHeroSession: () => false,
    listActiveTests: async () => [${JSON.stringify(T)}], getTest: async () => (${JSON.stringify(T)}) };`);
  await page.goto(`${BASE}/test.html?id=q3`);
  await page.click('#startBtn');
  for (let k = 0; k < 3; k++){
    await page.waitForFunction(i => window.ST && ST.idx === i && !ST.answered, k);
    const right = await page.evaluate(() => +QS[ST.idx].correct);
    await page.locator('.opt').nth(k === 0 ? (right + 1) % 3 : right).click();   // перше питання — з помилкою
  }
  await page.waitForFunction(() => localStorage.getItem('sk_testlog_q3'));
  const log = JSON.parse(await page.evaluate(() => localStorage.getItem('sk_testlog_q3')));
  assert.equal(log.length, 1, 'одна спроба в журналі');
  const r = log[0];
  assert.equal(r.total, 3); assert.equal(r.correct, 2); assert.equal(r.pct, 67);
  assert.equal(r.wrong.length, 1, 'одне питання з помилкою');
  assert.ok(T.questions.some(q => q.q === r.wrong[0]), 'помилка записана текстом питання');
  assert.equal(r.restarts, 0);
  assert.ok(r.dur >= 0 && r.at > 0);
});

/* ── сторінка Героя: спільна заглушка ── */
const HERO_SK = `
  const hero = { name: 'vova', avatar: '🧒', level: 30, parentUid: 'p1', health: 371, mana: 514, agility: 287, accuracy: 219,
    coins: 40, arena: { level: 30, xp: 160, wins: 62, losses: 83, draws: 0 }, progress: {} };
  return { ready: Promise.resolve({ uid: 'h1' }), isHeroSession: () => true,
    getActiveChild: async () => ({ name: 'vova', avatar: '🧒', grade: 1 }), getHero: async () => hero,
    publishHeroCard: async () => true,
    publishHeroLearn: async l => { window.__calls.push(['learn', l]); return true; },
    getSiblings: async () => [
      { id: 's1', name: 'Оля',   avatar: '👧', level: 5, arena: { level: 5, wins: 20, losses: 3, draws: 2 }, learn: { tests: 5 } },
      { id: 's2', name: 'Сашко', avatar: '👦', level: 3, arena: null, learn: { tests: 1 } }],
    getFriends: async () => [{ id: 'f1', name: 'pavlo', avatar: '🐢', level: 12, arena: { level: 12, wins: 40, losses: 10, draws: 1 } }],
    // зараховані завдання батьків НЕ мають давати ⭐ у рейтингу «Навчання»
    getAssignedTasks: async () => [{ id: 't1', title: 'Задача', status: 'approved', xp: 50 }, { id: 't2', title: 'Ще', status: 'approved' }],
    listActiveTests: async () => ${JSON.stringify(TESTS)} };`;
const seedHero = page => page.addInitScript(([logs, passed]) => {
  const D = 864e5, N = Date.now();
  for (const id in logs) localStorage.setItem('sk_testlog_' + id,
    JSON.stringify(logs[id].map((pct, i) => ({ at: N - (logs[id].length - i) * D, pct, wrong: [] }))));
  passed.forEach(id => localStorage.setItem('sk_testpass_' + id, '1'));
}, [LOGS, PASSED]);
const rankRows = page => page.$$eval('#rankList .rank-row', rs => rs.map(r =>
  [r.querySelector('.nm').textContent.replace(' (ти)', '').trim(), +r.querySelector('.sc').textContent.replace(/\D/g, '')]));

/* ── 2. hero.html: рейтинг ── */
await scenario('hero.html — рейтинг «Навчання»/«Арена», «Сімʼя»/«Друзі»', async (page, withSK) => {
  await withSK(HERO_SK); await seedHero(page);
  await page.goto(`${BASE}/hero.html`);
  await page.waitForFunction(() => document.querySelectorAll('#rankList .rank-row').length === 3
    && /vova.*\b30\b/.test(document.getElementById('rankList').textContent));
  // Навчання = пройдені тести × 10; 2 зараховані завдання нічого не додають
  assert.deepEqual(await rankRows(page), [['Оля', 50], ['vova', 30], ['Сашко', 10]]);
  assert.match(await page.textContent('#rankNote'), /тести × 10/);
  assert.deepEqual(await page.evaluate(() => window.__calls.filter(c => c[0] === 'learn').map(c => c[1])), [{ tests: 3 }],
    'learn публікується один раз і лише з тестами');
  await page.click('[data-cat=arena]');
  // Арена = перемоги × 10 + нічиї × 5 + рівень × 20; без бою — лише рівень
  assert.deepEqual(await rankRows(page), [['vova', 1220], ['Оля', 310], ['Сашко', 60]]);
  await page.click('[data-rank=friends]');
  assert.deepEqual(await rankRows(page), [['vova', 1220], ['pavlo', 645]]);
  await page.click('[data-cat=learn]');
  assert.deepEqual(await rankRows(page), [['vova', 30], ['pavlo', 0]], 'друг без картки learn — 0');
});

/* ── 3. hero.html: Мої здібності ── */
await scenario('hero.html — «Мої здібності»: суперсили, що прокачати, ▶', async (page, withSK) => {
  await withSK(HERO_SK); await seedHero(page);
  await page.goto(`${BASE}/hero.html`);
  await page.waitForSelector('#abilCard:not([hidden]) .ab-topic');
  const pow = await page.$$eval('.ab-box.pow .ab-chip b', b => b.map(x => x.textContent));
  assert.deepEqual(pow, ['Числа в межах 10', 'Геометричні фігури']);
  const up = await page.$$eval('.ab-box.up .ab-chip', cs => cs.map(c => [c.querySelector('b').textContent,
    (c.querySelector('.ab-go') || {}).getAttribute ? c.querySelector('.ab-go').getAttribute('href') : null]));
  assert.deepEqual(up, [['Порівняння чисел', 'test.html?id=c1'], ['Числа в межах 20', 'test.html?id=b1']]);
  const st = await page.$$eval('.ab-topic', ts => Object.fromEntries(ts.map(t =>
    [t.querySelector('b').textContent, t.className.replace(/.*st-/, '')])));
  assert.deepEqual(st, { 'Числа в межах 10': 'master', 'Числа в межах 20': 'new',
                         'Порівняння чисел': 'repeat', 'Геометричні фігури': 'good' });
  assert.match(await page.textContent('.ab-subj summary'), /3 з 4 тем.*Точність/);
  assert.equal(await page.$eval('#abilRadar', el => el.innerHTML.trim()), '', 'павутинка з одним предметом не малюється');
});

/* ── 5. hero.html: павутинка здібностей ── карта на 6 предметів (getCurriculum) */
await scenario('hero.html — павутинка: рівні предметів, картки, обкладинки', async (page, withSK) => {
  const SUBJ = [
    ['m', 'Математика', '🧮', 'accuracy', ['До 10', 'Порівняння', 'Задачі']],
    ['u', 'Українська мова', '🌺', 'health', ['Букви', 'Склади']],
    ['e', 'English', '🔤', 'mana', ['Colors', 'Numbers']],
    ['y', 'ЯДС · Я досліджую світ', '🌍', 'agility', ['Тварини', 'Рослини']],
    ['i', 'Інформатика', '📘', '', ['Алгоритми']],
    ['f', 'Дозвілля', '🎡', '', ['Ігри']]];
  const MAP = { tiers: [{ id: 'junior', name: 'Молодша', status: 'ready', grades: [{ id: 'g1', gradeNum: 1, name: '1 клас',
    subjects: SUBJ.map(([id, name, icon, statKey, tp]) => ({ id, name, icon, statKey, keys: [name.toLowerCase()],
      topics: tp.map((topic, j) => ({ topic, tests: ['t' + id + j] })) })) }] }] };
  const T = SUBJ.flatMap(([id, name, , , tp]) => tp.map((topic, j) => ({ id: 't' + id + j, title: 'Тест ' + topic, subject: name, grade: 1 })));
  T[0].imgCard = 'img/tr/do10.webp';        // обкладинка з адмінки — є файл
  T[3].imgCard = 'img/tr/немає-такої.webp'; // обкладинка є, але файлу немає → запасна картинка предмета
  await withSK(`
    const hero = { name: 'vova', avatar: '🧒', level: 3, parentUid: 'p1', progress: {} };
    return { ready: Promise.resolve({ uid: 'h1' }), isHeroSession: () => true,
      getActiveChild: async () => ({ name: 'vova', avatar: '🧒', grade: 1 }), getHero: async () => hero,
      getSiblings: async () => [], getFriends: async () => [], getAssignedTasks: async () => [],   // справжній API — завжди масиви
      getCurriculum: async () => (${JSON.stringify(MAP)}), listActiveTests: async () => ${JSON.stringify(T)} };`);
  // рівень предмета = середнє по ВСІХ темах (непробувані = 0):
  // Математика (98 + 40 + 0) / 3 = 46 · Українська (83 + 60) / 2 = 72 · English (100 + 93) / 2 = 97 · ЯДС 70 / 2 = 35
  await page.addInitScript(() => {
    const D = 864e5, N = Date.now(), L = (...a) => JSON.stringify(a.map((pct, i) => ({ at: N - (a.length - i) * D, pct, wrong: [] })));
    Object.entries({ tm0: [95, 100], tm1: [40], tu0: [80, 85], tu1: [60], te0: [100, 100], te1: [90, 95], ty0: [70] })
      .forEach(([k, v]) => localStorage.setItem('sk_testlog_' + k, L(...v)));
  });
  await page.goto(`${BASE}/hero.html`);
  await page.waitForSelector('#abilRadar .rd-card');
  const cards = await page.$$eval('#abilRadar .rd-card', cs => cs.map(c => [c.querySelector('.rd-name').textContent,
    (c.querySelector('.rd-stat') || {}).textContent || '', c.querySelector('.rd-pct').textContent]));
  assert.deepEqual(cards, [['Математика', 'Точність', '46%'], ['Українська мова', "Здоров'я", '72%'], ['English', 'Мана', '97%'],
    ['ЯДС', 'Спритність', '35%'], ['Інформатика', '', '0%'], ['Дозвілля', '', '0%']]);
  assert.match(await page.getAttribute('#abilRadar svg', 'aria-label'), /Математика 46%.*English 97%/);
  assert.equal(await page.$$eval('#abilRadar .rd-dot', d => d.length), 6, 'вершина на кожен предмет');
  assert.ok(await page.$eval('#abilRadar', el => el.classList.contains('many')), '6 предметів — вищий блок');
  // предмети з макета — значок з прозорим фоном (img/abil/), решта — картинка предмета
  await page.waitForFunction(() => [...document.querySelectorAll('#abilRadar .rd-ico')].every(i => i.complete && i.naturalWidth > 0));
  const icos = await page.$$eval('#abilRadar .rd-ico', is => is.map(i => new URL(i.src).pathname));
  assert.deepEqual(icos.slice(0, 5), ['/img/abil/math.webp', '/img/abil/ukr.webp', '/img/abil/eng.webp', '/img/abil/yads.webp', '/img/abil/inf.webp']);
  assert.ok(await page.$eval('#abilRadar .rd-card:last-child', c => !!c.querySelector('.rd-pic')), 'Дозвілля — квадратна картинка');
});

/* ── 4. parent.html: Здібності ── */
await scenario('parent.html — «Здібності»: лічильники, рекомендація, «➕ Задати»', async (page, withSK) => {
  await withSK(`
    const prog = {}; const L = ${JSON.stringify(LOGS)};
    for (const id in L) prog['sk_testlog_' + id] = JSON.stringify(__log(L[id]));
    const hero = { name: 'vova', login: 'vova', grade: 1, level: 30, tasks: [], progress: prog };
    return { ready: Promise.resolve({ uid: 'p1' }), requireParent: async () => ({ uid: 'p1' }),
      isHeroSession: () => false, isAdmin: () => false, getParent: async () => ({ name: 'Мама' }),
      getHeroes: async () => ({ h1: hero }), listTests: async () => ${JSON.stringify(TESTS)},
      assignTask: async (hid, task) => { window.__calls.push(['assign', hid, task.testId]); return 'new1'; } };`);
  // localStorage батьків «чужий» — у кабінеті він не має впливати на аналітику
  await page.addInitScript(() => localStorage.setItem('sk_testlog_c1', JSON.stringify([{ at: Date.now(), pct: 100 }, { at: Date.now(), pct: 100 }])));
  await page.goto(`${BASE}/parent.html`);
  await page.waitForFunction(() => typeof loadStatsTab === 'function' && window.SKINS);
  await page.evaluate(() => { showTab('stats'); return loadStatsTab(); });
  const sec = page.locator('.st-sec', { hasText: 'Здібності' });
  await sec.locator('.in-row').first().waitFor();
  const mini = await sec.locator('.st-mini-v').allTextContents();
  assert.deepEqual(mini.map(t => t.replace(/\D/g, '')), ['1', '1', '0', '1'], 'майстер / вміє / вчиться / повторити');
  assert.match(await sec.locator('.in-tip').textContent(), /Порівняння чисел.*40%/);
  assert.match(await sec.locator('.in-row').first().textContent(), /Порівняння чисел/, 'проблемна тема — першою');
  await sec.locator('.in-assign').first().click();
  await sec.locator('.in-row').first().locator('.in-done').waitFor();
  assert.deepEqual(await page.evaluate(() => window.__calls), [['assign', 'h1', 'c1']]);
  assert.match(await sec.textContent(), /7 \+ 8 = \?/, 'типові помилки з журналу');
});

/* ── 6. hero.html: павутинка за класами ── 1 клас (клас Героя), 2 клас зі спробами, 3 клас без спроб */
await scenario('hero.html — павутинка за класами: перемикач, свій клас першим', async (page, withSK) => {
  const subj = (g, id, name, tp) => ({ id: id + g, name, icon: '📘', keys: [name.toLowerCase()],
    topics: tp.map((topic, j) => ({ topic, tests: ['t' + id + g + j] })) });
  const grade = (n, list) => ({ id: 'g' + n, gradeNum: n, name: n + ' клас', subjects: list.map(([id, name, tp]) => subj(n, id, name, tp)) });
  const SUBJ = [['m', 'Математика', ['А', 'Б']], ['u', 'Українська мова', ['В']], ['e', 'English', ['Г']]];
  const MAP = { tiers: [{ id: 'junior', name: 'Молодша', status: 'ready', grades: [grade(1, SUBJ), grade(2, SUBJ), grade(3, SUBJ)] }] };
  const T = MAP.tiers[0].grades.flatMap(g => g.subjects.flatMap(sj => sj.topics.map(tp =>
    ({ id: tp.tests[0], title: 'Тест ' + tp.tests[0], subject: sj.name, grade: g.gradeNum }))));
  await withSK(`
    const hero = { name: 'vova', avatar: '🧒', level: 3, parentUid: 'p1', progress: {} };
    return { ready: Promise.resolve({ uid: 'h1' }), isHeroSession: () => true,
      getActiveChild: async () => ({ name: 'vova', avatar: '🧒', grade: 1 }), getHero: async () => hero,
      getSiblings: async () => [], getFriends: async () => [], getAssignedTasks: async () => [],
      getCurriculum: async () => (${JSON.stringify(MAP)}), listActiveTests: async () => ${JSON.stringify(T)} };`);
  // 1 клас: Математика А = 100, Б не пробувана → 50%; 2 клас: English = 80; 3 клас — нічого
  await page.addInitScript(() => {
    const N = Date.now(), L = (...a) => JSON.stringify(a.map((pct, i) => ({ at: N - (a.length - i) * 864e5, pct, wrong: [] })));
    localStorage.setItem('sk_testlog_tm10', L(100, 100));
    localStorage.setItem('sk_testlog_te20', L(80));
  });
  await page.goto(`${BASE}/hero.html`);
  await page.waitForSelector('#abilRadar .rd-card');
  const tabs = () => page.$$eval('#abilGrades button', bs => bs.map(b => [b.textContent, b.classList.contains('on')]));
  const pct = () => page.$$eval('#abilRadar .rd-card', cs => cs.map(c => c.querySelector('.rd-name').textContent + ' ' + c.querySelector('.rd-pct').textContent));
  assert.deepEqual(await tabs(), [['🎒 1 клас', true], ['2 клас', false]], 'свій клас — вибраний; 3 клас без спроб — нема');
  assert.deepEqual(await pct(), ['Математика 50%', 'Українська мова 0%', 'English 0%']);
  await page.click('#abilGrades [data-grade="2"]');
  assert.deepEqual(await tabs(), [['🎒 1 клас', false], ['2 клас', true]]);
  assert.deepEqual(await pct(), ['Математика 0%', 'Українська мова 0%', 'English 80%'], 'павутинка 2 класу — свої предмети');
  // є павутинка — теми предмета відкриваються поп-апом з картки, а не списком під нею
  assert.equal(await page.$$eval('#abilSubjs .ab-subj', d => d.length), 0, 'без списку-акордеону під павутинкою');
  await page.click('#abilRadar .rd-card:nth-of-type(3)');
  await page.waitForSelector('#abilModal:not([hidden])');
  assert.match(await page.textContent('#abilModalTitle'), /English/, 'поп-ап — предмет вибраного класу');
  assert.match(await page.textContent('#abilModalSub'), /1 з 1 тем/);
  assert.equal(await page.$$eval('#abilModalList .ab-topic[href]', d => d.length), 1, 'тема — одразу посилання');
  await page.keyboard.press('Escape');
  assert.ok(await page.isHidden('#abilModal'), 'Esc закриває поп-ап');
});

await browser.close();
server.close();
const bad = results.filter(r => !r.ok).length;
console.log(`\n${results.length - bad}/${results.length} сценаріїв пройдено`);
process.exit(bad ? 1 : 0);

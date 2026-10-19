// Аналітика навчання (sk-insights.js): статуси тестів і тем, підказки, типові помилки.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path'), fs = require('fs'), vm = require('vm');
const ROOT = path.join(__dirname, '../../..');
const box = { window: {} };
box.window.window = box.window;
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'sk-insights.js'), 'utf8'), box.window, { filename: 'sk-insights.js' });
const I = box.window.SKINS;

const NOW = Date.UTC(2026, 9, 19);
const DAY = 864e5;
const getter = o => k => (o[k] === undefined ? null : (typeof o[k] === 'string' ? o[k] : JSON.stringify(o[k])));
const log = (...pcts) => pcts.map((pct, i) => ({ at: NOW - (pcts.length - i) * DAY, pct, correct: 0, total: 10, wrong: [] }));
const SUBJ = { id: 'm', name: 'Математика', statKey: 'accuracy' };
const GRADE = { id: 'g1', gradeNum: 1 };
const place = (topic, tests) => ({ tier: { id: 'junior' }, grade: GRADE, subj: SUBJ, topic: { topic, chain: true }, tests });

test('тест: нема спроб — не пробував', () => {
  const s = I.testState({ id: 'a', title: 'A' }, getter({}));
  assert.equal(s.tried, false);
  assert.equal(s.pct, 0);
});

test('тест: зважене середнє останніх 3 спроб, новіша важить більше', () => {
  const s = I.testState({ id: 'a' }, getter({ sk_testlog_a: log(10, 40, 70, 100) }));
  assert.equal(s.pct, Math.round((40 * 1 + 70 * 2 + 100 * 3) / 6));   // 80
  assert.equal(s.trend, 'up');
  assert.equal(s.attempts, 4);
});

test('тест: майстер — лише ≥90% двічі поспіль', () => {
  assert.equal(I.testState({ id: 'a' }, getter({ sk_testlog_a: log(95, 100) })).master, true);
  assert.equal(I.testState({ id: 'a' }, getter({ sk_testlog_a: log(100) })).master, false);
  assert.equal(I.testState({ id: 'a' }, getter({ sk_testlog_a: log(100, 80, 95) })).master, false);
});

test('тест: без журналу — старі мітки sk_testscore / sk_testpass', () => {
  assert.equal(I.testState({ id: 'a' }, getter({ sk_testscore_a: { pct: 70, at: NOW } })).pct, 70);
  const p = I.testState({ id: 'a' }, getter({ sk_testpass_a: '1' }));
  assert.equal(p.tried, true); assert.equal(p.passed, true); assert.equal(p.pct, 55);
});

test('тест із рівнями: володіння = частка рівнів, без тренду між рівнями', () => {
  const t = { id: 'L', levels: [{}, {}, {}, {}] };
  const s = I.testState(t, getter({ sk_testscore_L: { pct: 50, levels: true, at: NOW },
    sk_testlog_L: [{ at: NOW - 2 * DAY, pct: 100, lv: 0 }, { at: NOW - DAY, pct: 40, lv: 1 }] }));
  assert.equal(s.pct, 50);
  assert.equal(s.trend, 'flat');
  assert.equal(I.testState(t, getter({ sk_test100_L: '1' })).master, true);
});

test('тема: статуси new / repeat / learn / good / master / stale', () => {
  const T = [{ id: 'a' }, { id: 'b' }];
  const st = o => I.topicState(place('Т', T), getter(o), NOW).status;
  assert.equal(st({}), 'new');
  assert.equal(st({ sk_testlog_a: log(40) }), 'repeat');
  assert.equal(st({ sk_testlog_a: log(60, 65) }), 'learn');
  assert.equal(st({ sk_testlog_a: log(80) }), 'good');
  assert.equal(st({ sk_testlog_a: log(95, 95), sk_testlog_b: log(90, 100) }), 'master');
  // один тест майстер, другий не пробуваний — ще не майстер теми
  assert.equal(st({ sk_testlog_a: log(95, 95) }), 'good');
  // бал упав нижче 75 — повторити, навіть якщо середнє ще нормальне
  assert.equal(st({ sk_testlog_a: log(100, 100, 60) }), 'repeat');
  // давно — освіжити
  assert.equal(st({ sk_testlog_a: [{ at: NOW - 40 * DAY, pct: 90 }] }), 'stale');
});

test('тема: з чого почати — перший непройдений тест', () => {
  const T = [{ id: 'a' }, { id: 'b' }];
  const t = I.topicState(place('Т', T), getter({ sk_testlog_a: log(90) }), NOW);
  assert.equal(t.next.id, 'b');
  assert.equal(t.stars, 3);
});

test('аналіз: суперсили, що прокачати, наступний крок, предмет', () => {
  const placed = [
    place('До 10', [{ id: 'p10' }]),
    place('До 20', [{ id: 'p20' }]),
    place('До 100', [{ id: 'p100' }]),
    place('Задачі', [{ id: 'z' }]),
    place('Порожній', [])
  ];
  const r = I.analyze(placed, getter({ sk_testlog_p10: log(95, 100), sk_testlog_z: log(30) }), { now: NOW });
  assert.equal(r.topics.length, 4);                       // порожній розділ пропущено
  assert.deepEqual(r.strengths.map(t => t.topic), ['До 10']);
  assert.deepEqual(r.improve.map(t => t.topic), ['Задачі']);
  assert.equal(r.nextStep.topic, 'До 20');
  assert.equal(r.subjects.length, 1);
  assert.equal(r.subjects[0].tried, 2);
  assert.equal(r.subjects[0].statKey, 'accuracy');
});

test('типові помилки: частіші — вище', () => {
  const g = getter({ sk_testlog_a: [
    { at: NOW - 2, pct: 50, wrong: ['7 + 8', '9 + 6'] },
    { at: NOW - 1, pct: 70, wrong: ['7 + 8'] }] });
  const m = I.commonMistakes([{ id: 'a', title: 'Додавання' }], g);
  assert.equal(m[0].q, '7 + 8');
  assert.equal(m[0].n, 2);
  assert.equal(m.length, 2);
});

test('читач: кабінет батьків бере лише базу, не localStorage', () => {
  const b2 = { window: { localStorage: { getItem: () => JSON.stringify([{ at: 1, pct: 5 }]) } } };
  b2.window.window = b2.window;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'sk-insights.js'), 'utf8'), b2.window);
  const prog = { sk_testlog_a: JSON.stringify([{ at: 2, pct: 90 }]), sk_testscore_b: '{"pct":70}' };
  const only = b2.window.SKINS.reader(prog, { local: false });
  assert.equal(only('sk_testscore_b'), '{"pct":70}');
  assert.equal(only('sk_testpass_x'), null);
  assert.equal(JSON.parse(only('sk_testlog_a'))[0].pct, 90);
  // звичайний читач (сторінка Героя): localStorage має перевагу, але журнал — свіжіший
  const both = b2.window.SKINS.reader(prog);
  assert.equal(JSON.parse(both('sk_testlog_a'))[0].pct, 90);
  assert.equal(JSON.parse(both('sk_testscore_b'))[0].pct, 5);
});

// Правила книги вмінь (sk-skills.js), якими сервер перевіряє вивчення й панель.
const test = require('node:test');
const assert = require('node:assert');
process.env.SITE_DIR = require('path').join(__dirname, '../../..');
const { lib } = require('../src/skills');

test('очки, рівні й панель', () => {
  const S = lib();
  const st = S.bookState({ arena: { level: 3 }, skills: { 'base.kick': 12 }, skillBonus: 1 });
  assert.strictEqual(S.freePoints(st), 3);                       // 3 за рівні + 1 бонус − 1 вивчене
  assert.strictEqual(S.learnBlock(st, 'base.kick'), 'learned');
  assert.strictEqual(S.learnBlock(st, 'base.spark'), '');
  assert.strictEqual(S.learnBlock(st, 'nope'), 'unknown');
  const low = S.bookState({ arena: { level: 1 } });
  assert.strictEqual(S.learnBlock(low, 'base.spark'), 'level');
  const none = S.bookState({ arena: { level: 1 }, skills: { 'base.kick': 0 } });
  assert.strictEqual(S.learnBlock(none, 'base.weapons'), 'points');
  assert.strictEqual(S.barSlots(1), 2); assert.strictEqual(S.barSlots(5), 3); assert.strictEqual(S.barSlots(15), 5);
  assert.strictEqual(S.barBlock(st, ['base.kick', null, null, null, null]), '');
  assert.strictEqual(S.barBlock(st, [null, null, 'base.kick', null, null]), 'locked');
  assert.strictEqual(S.barBlock(st, ['base.kick', 'base.kick', null, null, null]), 'dup');
  assert.strictEqual(S.barBlock(st, ['base.spark', null, null, null, null]), 'notactive');   // не вивчене
  assert.strictEqual(S.barBlock(st, ['base.kick']), 'shape');
});

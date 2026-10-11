// Перевірка rules.js проти firestore.rules: кожне правило — дозволені й заборонені випадки.
const test = require('node:test');
const assert = require('node:assert');
const { allowed, pairId } = require('../src/rules');

const DB = {
  'users/admin': { role: 'admin' },
  'users/p1': { role: 'user' },
  'users/p2': { role: 'user' },
  'heroes/h1': { parentUid: 'p1' },
  'heroes/h1b': { parentUid: 'p1' },
  'heroes/h2': { parentUid: 'p2' },
  ['friendships/' + pairId('h1', 'h2')]: { status: 'approved', heroes: ['h1', 'h2'], parents: ['p1', 'p2'] }
};
const as = uid => ({ uid, get: async p => DB[p] || null });
const can = (uid, op, path, res, next) => allowed(as(uid), op, path, res === undefined ? DB[path] || null : res, next || null);

test('users', async () => {
  assert.ok(await can('p1', 'get', 'users/p1'));
  assert.ok(!await can('p2', 'get', 'users/p1'));
  assert.ok(!await can(null, 'get', 'users/p1'));
  assert.ok(await can('p3', 'create', 'users/p3', null, { role: 'user' }));
  assert.ok(await can('p3', 'create', 'users/p3', null, { name: 'x' }));
  assert.ok(!await can('p3', 'create', 'users/p3', null, { role: 'admin' }));
  assert.ok(!await can('p3', 'create', 'users/p4', null, { role: 'user' }));
  assert.ok(await can('p1', 'update', 'users/p1', undefined, { role: 'user', name: 'n' }));
  assert.ok(!await can('p1', 'update', 'users/p1', undefined, { role: 'admin' }));
  assert.ok(!await can('p1', 'delete', 'users/p1'));
});

test('heroes', async () => {
  assert.ok(await can('h1', 'get', 'heroes/h1'));
  assert.ok(await can('p1', 'get', 'heroes/h1'));
  assert.ok(await can('h1b', 'get', 'heroes/h1'), 'брат/сестра');
  assert.ok(!await can('h2', 'get', 'heroes/h1'));
  assert.ok(!await can('p2', 'get', 'heroes/h1'));
  assert.ok(await can('p1', 'create', 'heroes/h9', null, { parentUid: 'p1' }));
  assert.ok(!await can('p1', 'create', 'heroes/h9', null, { parentUid: 'p2' }));
  assert.ok(await can('h1', 'update', 'heroes/h1', undefined, { parentUid: 'p1', xp: 5 }));
  assert.ok(await can('p1', 'update', 'heroes/h1', undefined, { parentUid: 'p1' }));
  assert.ok(!await can('h1', 'update', 'heroes/h1', undefined, { parentUid: 'p2' }), 'parentUid незмінний');
  assert.ok(!await can('h1b', 'update', 'heroes/h1', undefined, { parentUid: 'p1' }));
  assert.ok(await can('p1', 'delete', 'heroes/h1'));
  assert.ok(!await can('h1', 'delete', 'heroes/h1'));
});

test('battles', async () => {
  assert.ok(await can('h1', 'get', 'heroes/h1/battles/b', null));
  assert.ok(await can('p1', 'get', 'heroes/h1/battles/b', null));
  assert.ok(!await can('p2', 'get', 'heroes/h1/battles/b', null));
  assert.ok(await can('h1', 'create', 'heroes/h1/battles/b', null, { r: 1 }));
  assert.ok(!await can('p1', 'create', 'heroes/h1/battles/b', null, { r: 1 }));
  assert.ok(await can('p1', 'delete', 'heroes/h1/battles/b', { r: 1 }));
});

test('heroCards', async () => {
  const card = { parentUid: 'p1' };
  assert.ok(await can('h1', 'get', 'heroCards/h1', card));
  assert.ok(await can('p1', 'get', 'heroCards/h1', card));
  assert.ok(await can('h1b', 'get', 'heroCards/h1', card));
  assert.ok(await can('h2', 'get', 'heroCards/h1', card), 'підтверджена дружба');
  assert.ok(!await can('p2', 'get', 'heroCards/h1', card));
  assert.ok(await can('h1', 'create', 'heroCards/h1', null, { parentUid: 'p1' }));
  assert.ok(!await can('p2', 'create', 'heroCards/h1', null, { parentUid: 'p2' }), 'чужа картка');
  assert.ok(!await can('h1', 'create', 'heroCards/h1', null, { parentUid: 'p2' }));
  assert.ok(await can('p1', 'delete', 'heroCards/h1', card));
  assert.ok(!await can('h1', 'delete', 'heroCards/h1', card));
});

test('friendships', async () => {
  const pid = pairId('h1', 'h2');
  const pending = { heroes: [pid.split('__')[0], pid.split('__')[1]], parents: ['p1', 'p2'], status: 'pending', approvedBy: ['p1'] };
  assert.ok(await can('p1', 'create', 'friendships/' + pid, null, pending));
  assert.ok(!await can('p1', 'create', 'friendships/' + pid, null, Object.assign({}, pending, { status: 'approved' })), 'одразу approved');
  assert.ok(!await can('p1', 'create', 'friendships/' + pid, null, Object.assign({}, pending, { approvedBy: ['p2'] })));
  assert.ok(!await can('p1', 'create', 'friendships/x__y', null, pending), 'id пари');
  assert.ok(await can('p2', 'update', 'friendships/' + pid, pending, Object.assign({}, pending, { status: 'approved', approvedBy: ['p1', 'p2'] })));
  assert.ok(!await can('p1', 'update', 'friendships/' + pid, pending, Object.assign({}, pending, { status: 'approved' })), 'approved лише вдвох');
  assert.ok(!await can('p3', 'update', 'friendships/' + pid, pending, pending));
  assert.ok(await can('h1', 'get', 'friendships/' + pid));
  assert.ok(!await can('h9', 'get', 'friendships/' + pid));
  assert.ok(await can('p2', 'delete', 'friendships/' + pid));
  assert.ok(!await can('h1', 'delete', 'friendships/' + pid));
});

test('inviteCodes', async () => {
  assert.ok(await can('p2', 'get', 'inviteCodes/ABC', { parentUid: 'p1' }));
  assert.ok(!await can('p1', 'list', 'inviteCodes/ABC', { parentUid: 'p1' }));
  assert.ok(await can('p1', 'create', 'inviteCodes/ABC', null, { parentUid: 'p1' }));
  assert.ok(!await can('p1', 'update', 'inviteCodes/ABC', { parentUid: 'p1' }, { parentUid: 'p1' }));
  assert.ok(await can('p1', 'delete', 'inviteCodes/ABC', { parentUid: 'p1' }));
  assert.ok(!await can('p2', 'delete', 'inviteCodes/ABC', { parentUid: 'p1' }));
});

test('контент, arenaPlan, reports', async () => {
  for (const c of ['tests', 'books', 'items', 'vocab', 'vocabDecks', 'curriculum', 'meta']) {
    assert.ok(await can('h1', 'list', c + '/x', {}), c);
    assert.ok(!await can(null, 'get', c + '/x', {}), c);
    assert.ok(!await can('p1', 'create', c + '/x', null, {}), c);
    assert.ok(await can('admin', 'update', c + '/x', {}, {}), c);
  }
  assert.ok(await can('admin', 'get', 'arenaPlan/a', {}));
  assert.ok(await can('admin', 'create', 'arenaPlan/a', null, {}));
  assert.ok(!await can('p1', 'get', 'arenaPlan/a', {}));
  assert.ok(await can('h1', 'create', 'reports/r', null, { reporterUid: 'h1', status: 'new' }));
  assert.ok(!await can('h1', 'create', 'reports/r', null, { reporterUid: 'h2', status: 'new' }));
  assert.ok(!await can('h1', 'create', 'reports/r', null, { reporterUid: 'h1', status: 'done' }));
  assert.ok(!await can('h1', 'get', 'reports/r', {}));
  assert.ok(await can('admin', 'delete', 'reports/r', {}));
});

test('невідомі шляхи заборонені', async () => {
  assert.ok(!await can('admin', 'get', 'secret/x', {}));
  assert.ok(!await can('admin', 'get', 'users/admin/sub/x', {}));
});

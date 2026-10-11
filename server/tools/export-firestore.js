// Запуск на VM з каталогу, куди писати файли: node /srv/sk/repo/server/tools/export-firestore.js
// (потрібен `firebase login`; firebase-tools встановлені глобально).
// Вивантаження всієї Firestore (з підколекціями) у firestore.json + параметри хешування паролів.
// Доступ — через сесію `firebase login` (OAuth власника проєкту).
const FT = '/usr/lib/node_modules/firebase-tools/lib/';
const auth = require(FT + "auth");

const fs = require('fs');
const P = 'schoolkingdom-d46bc';
const BASE = `https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents`;
let TOKEN;
async function api(url, opts = {}) {
  const r = await fetch(url, Object.assign({}, opts, { headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' } }));
  if (!r.ok) throw new Error(r.status + ' ' + url + ' ' + (await r.text()).slice(0, 300));
  return r.json();
}
async function listCollIds(parent) {
  let ids = [], pageToken;
  do {
    const j = await api(parent + ':listCollectionIds', { method: 'POST', body: JSON.stringify({ pageSize: 300, pageToken }) });
    ids = ids.concat(j.collectionIds || []); pageToken = j.nextPageToken;
  } while (pageToken);
  return ids;
}
async function dumpColl(parentPath, coll, out) {
  let pageToken;
  do {
    const j = await api(`${parentPath}/${coll}?pageSize=300&showMissing=true` + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''));
    for (const d of j.documents || []) {
      const path = d.name.split('/documents/')[1];
      out.push({ path, fields: d.fields || {}, createTime: d.createTime, updateTime: d.updateTime, missing: !d.fields && !d.createTime });
      for (const sub of await listCollIds("https://firestore.googleapis.com/v1/" + d.name)) await dumpColl(BASE + '/' + path, sub, out);
    }
    pageToken = j.nextPageToken;
  } while (pageToken);
}
(async () => {
  const cs = JSON.parse(fs.readFileSync(process.env.HOME + "/.config/configstore/firebase-tools.json"));
  const t = await auth.getAccessToken(cs.tokens.refresh_token, ["https://www.googleapis.com/auth/cloud-platform"]);
  TOKEN = t.access_token;
  const out = [];
  const roots = await listCollIds(BASE);
  console.log('collections:', roots.join(', '));
  for (const c of roots) await dumpColl(BASE, c, out);
  fs.writeFileSync('firestore.json', JSON.stringify(out));
  const counts = {};
  out.forEach(d => { const k = d.path.split('/').filter((_, i) => i % 2 === 0).join('/'); counts[k] = (counts[k] || 0) + 1; });
  console.log('docs:', out.length, counts);
  const cfg = await api(`https://identitytoolkit.googleapis.com/admin/v2/projects/${P}/config`);
  fs.writeFileSync('hash-config.json', JSON.stringify((cfg.signIn || {}).hashConfig || {}, null, 1));
  console.log('hash algo:', ((cfg.signIn || {}).hashConfig || {}).algorithm);
})().catch(e => { console.error(e.message); process.exit(1); });

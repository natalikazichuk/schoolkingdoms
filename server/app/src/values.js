/* Значення документів на дроті й у базі — звичайний JSON, крім двох міток:
     {"$ts": <мілісекунди>}  — Timestamp (у Firestore — timestampValue)
     {"$sv": "ts"}           — serverTimestamp(): сервер підставляє поточний час
   Мітки однакові в клієнті (sk-fb.js), на сервері й у PostgreSQL (jsonb). */

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function isTs(v) {
  return isPlainObject(v) && typeof v.$ts === 'number' && Object.keys(v).length === 1;
}
function isServerTs(v) {
  return isPlainObject(v) && v.$sv === 'ts' && Object.keys(v).length === 1;
}

// serverTimestamp() → {"$ts": now} (рекурсивно)
function resolveSentinels(v, now) {
  if (isServerTs(v)) return { $ts: now };
  if (Array.isArray(v)) return v.map(x => resolveSentinels(x, now));
  if (isPlainObject(v) && !isTs(v)) {
    const out = {};
    for (const k of Object.keys(v)) out[k] = resolveSentinels(v[k], now);
    return out;
  }
  return v;
}

// setDoc(..., {merge:true}): мапи зливаються вглиб, решта (масиви, числа…) замінюється
function deepMerge(base, patch) {
  if (!isPlainObject(base) || isTs(base)) base = {};
  const out = Object.assign({}, base);
  for (const k of Object.keys(patch)) {
    const p = patch[k];
    if (isPlainObject(p) && !isTs(p) && !isServerTs(p)) out[k] = deepMerge(base[k], p);
    else out[k] = p;
  }
  return out;
}

// updateDoc: ключі можуть бути шляхами "a.b.c"
function applyUpdate(base, patch) {
  const out = JSON.parse(JSON.stringify(base || {}));
  for (const key of Object.keys(patch)) {
    const parts = key.split('.');
    let o = out;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!isPlainObject(o[parts[i]]) || isTs(o[parts[i]])) o[parts[i]] = {};
      o = o[parts[i]];
    }
    o[parts[parts.length - 1]] = patch[key];
  }
  return out;
}

module.exports = { isPlainObject, isTs, isServerTs, resolveSentinels, deepMerge, applyUpdate };

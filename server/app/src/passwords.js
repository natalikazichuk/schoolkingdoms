/* Паролі.
   Свої:      "s1$<salt b64>$<hash b64>"   — scrypt N=16384 r=8 p=1, 64 байти
   З Firebase: "fb$<hash b64>$<salt b64>"   — модифікований scrypt Firebase:
     key  = scrypt(password, salt + saltSeparator, N=2^memCost, r=rounds, p=1, 32 байти)
     hash = AES-256-CTR(key, iv = 16 нулів) над signerKey
   Параметри Firebase (signerKey, saltSeparator, rounds, memCost) — у
   hash-config.json з `identitytoolkit … /config` (див. server/README.md).
   Після вдалого входу з fb$-паролем сервер перезаписує його у s1$. */
const crypto = require('crypto');
const fs = require('fs');

let FB = null;
function fbConfig() {
  if (FB) return FB;
  const file = process.env.FB_HASH_CONFIG || '/data/hash-config.json';
  try { FB = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { FB = {}; }
  return FB;
}

function scrypt(pw, salt, keylen, opts) {
  return new Promise((ok, fail) => crypto.scrypt(pw, salt, keylen, opts, (e, k) => e ? fail(e) : ok(k)));
}

async function hash(password) {
  const salt = crypto.randomBytes(16);
  const h = await scrypt(String(password), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return 's1$' + salt.toString('base64') + '$' + h.toString('base64');
}

async function verifyFirebase(password, hashB64, saltB64) {
  const c = fbConfig();
  if (!c.signerKey || !c.saltSeparator || !c.rounds || !c.memoryCost) throw new Error('немає параметрів хешування Firebase');
  const salt = Buffer.concat([Buffer.from(saltB64, 'base64'), Buffer.from(c.saltSeparator, 'base64')]);
  const N = Math.pow(2, c.memoryCost);
  const key = await scrypt(Buffer.from(String(password), 'utf8'), salt, 32,
    { N, r: c.rounds, p: 1, maxmem: 256 * N * c.rounds + 1024 * 1024 });
  const cipher = crypto.createCipheriv('aes-256-ctr', key, Buffer.alloc(16, 0));
  const out = Buffer.concat([cipher.update(Buffer.from(c.signerKey, 'base64')), cipher.final()]);
  const want = Buffer.from(hashB64, 'base64');
  return want.length === out.length && crypto.timingSafeEqual(out, want);
}

// → { ok, rehash } ; rehash=true — пароль варто перезаписати у свій формат
async function verify(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts[0] === 's1' && parts.length === 3) {
    const want = Buffer.from(parts[2], 'base64');
    const h = await scrypt(String(password), Buffer.from(parts[1], 'base64'), want.length,
      { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    return { ok: crypto.timingSafeEqual(h, want), rehash: false };
  }
  if (parts[0] === 'fb' && parts.length === 3) {
    return { ok: await verifyFirebase(password, parts[1], parts[2]), rehash: true };
  }
  return { ok: false, rehash: false };
}

module.exports = { hash, verify };

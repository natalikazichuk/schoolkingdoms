/* Озвучка українською через OpenAI (POST /api/tts) — для пристроїв, де браузер не має
   українського голосу (Chrome на Windows, частина iPad і Android без пакета голосу).
   Тоді speechSynthesis з lang «uk-UA» просто мовчить, і sk-voice.js просить mp3 тут.

   Кожна фраза синтезується один раз: файл <TTS_DIR>/<sha256>.mp3, nginx віддає його
   як /tts/<sha256>.mp3. Повтор тієї самої фрази (вірш, назва літери) — без OpenAI.
   Нові фрази обмежені: довжина, ліміт на IP і на весь сайт за добу (рахунок власника). */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const settings = require('./settings');

const ENDPOINT = 'https://api.openai.com/v1/audio/speech';
const MAX_CHARS = 400;
const PER_IP_DAY = Number(process.env.TTS_PER_IP_DAY || 300);
const TOTAL_DAY = Number(process.env.TTS_DAY_TOTAL || 3000);
const VERSION = 'v1';   // змінити — і всі фрази перегенеруються (інший голос/модель)

const apiKey = () => settings.get('openai_api_key') || process.env.OPENAI_API_KEY || '';
const configured = () => !!apiKey();
const dir = () => process.env.TTS_DIR || '/tts';
const model = () => process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const voice = () => process.env.OPENAI_TTS_VOICE || 'nova';

const INSTRUCTIONS = {
  uk: 'Говори українською мовою з правильною українською вимовою, чітко, спокійно і трохи повільніше, ' +
      'як учителька, що читає дитині першого класу. Не додавай нічого від себе.',
  en: 'Speak with a clear British English accent, calmly and a little slowly, for a young child learning to read.'
};

class TtsError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

function clean(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}
function langOf(lang) {
  const l = String(lang || 'uk').toLowerCase().split(/[-_]/)[0];
  return INSTRUCTIONS[l] ? l : null;
}
function keyFor(text, lang) {
  return crypto.createHash('sha256').update([VERSION, model(), voice(), lang, text].join('\n')).digest('hex');
}

/* лічильники нових синтезів за добу (у пам'яті; рестарт API їх обнуляє — це прийнятно) */
let day = '', total = 0, perIp = new Map();
function take(ip) {
  const d = new Date().toISOString().slice(0, 10);
  if (d !== day) { day = d; total = 0; perIp = new Map(); }
  const n = perIp.get(ip) || 0;
  if (total >= TOTAL_DAY || n >= PER_IP_DAY) return false;
  total++; perIp.set(ip, n + 1);
  return true;
}

const pending = new Map();   // одна й та сама фраза, запитана двічі поспіль, — один виклик OpenAI

async function synth(text, lang, opt) {
  const res = await (opt.fetch || fetch)(ENDPOINT, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + apiKey(), 'content-type': 'application/json' },
    body: JSON.stringify({ model: model(), voice: voice(), input: text, instructions: INSTRUCTIONS[lang], response_format: 'mp3' }),
    signal: AbortSignal.timeout(30e3)
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    console.error(new Date().toISOString(), '[tts] OpenAI', res.status, msg.slice(0, 300));
    throw new TtsError(502, 'unavailable', 'Озвучка зараз недоступна');
  }
  return Buffer.from(await res.arrayBuffer());
}

/* {text, lang} → {url} */
async function speak(body, ip, opt) {
  opt = opt || {};
  const text = clean(body && body.text);
  const lang = langOf(body && body.lang);
  if (!text) throw new TtsError(400, 'invalid-argument', 'Немає тексту');
  if (text.length > MAX_CHARS) throw new TtsError(400, 'invalid-argument', 'Задовгий текст');
  if (!lang) throw new TtsError(400, 'invalid-argument', 'Мова не підтримується');

  const key = keyFor(text, lang);
  const url = '/tts/' + key + '.mp3';
  const file = path.join(dir(), key + '.mp3');
  if (fs.existsSync(file)) return { url };

  if (!pending.has(key)) {
    if (!configured()) throw new TtsError(503, 'unavailable', 'Озвучка не налаштована');
    if (!take(ip || '?')) throw new TtsError(429, 'resource-exhausted', 'Ліміт озвучки на сьогодні вичерпано');
    pending.set(key, (async () => {
      const mp3 = await synth(text, lang, opt);
      fs.mkdirSync(dir(), { recursive: true });
      const tmp = file + '.' + process.pid + '.tmp';
      fs.writeFileSync(tmp, mp3);
      fs.renameSync(tmp, file);   // nginx ніколи не віддасть недописаний файл
    })().finally(() => pending.delete(key)));
  }
  await pending.get(key);
  return { url };
}

module.exports = { speak, TtsError, keyFor, MAX_CHARS };

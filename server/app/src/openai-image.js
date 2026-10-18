/* Малюнок героя з фото через OpenAI Images API (режим редагування з кількома картинками).
   Ключ — з адмінки (таблиця settings, src/settings.js) або OPENAI_API_KEY у /srv/sk/.env
   (рахунок власника сайту), модель — OPENAI_IMAGE_MODEL.
   Картинка 1 — шаблон (базовий герой без верхнього одягу), картинка 2 — фото дитини
   (для бойової пози — уже намальований герой, промпт POSE_PROMPT).
   edit() — загальний виклик: «Одягти GPT» (src/avatar.js) передає базу й картинки речей.
   Відповідь — PNG з прозорим фоном у кадрі й позі шаблону. Фото ніде не зберігаємо. */
const ENDPOINT = 'https://api.openai.com/v1/images/edits';
const TIMEOUT_MS = 240e3;

const settings = require('./settings');
const KEY_SETTING = 'openai_api_key';
// ключ з адмінки має перевагу: його можна змінити без входу на сервер
const apiKey = () => settings.get(KEY_SETTING) || process.env.OPENAI_API_KEY || '';
const keySource = () => settings.get(KEY_SETTING) ? 'admin' : (process.env.OPENAI_API_KEY ? 'env' : null);
const configured = () => !!apiKey();
const model = () => process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';

const PROMPT = [
  'Image 1 is a character template: a cartoon 3D child hero standing full-height in a plain linen shirt and trousers.',
  'Image 2 is a photo of a real child.',
  'Redraw the child from image 2 as this cartoon character: keep the child\'s face shape, hairstyle, hair colour, eye colour, skin tone and gender recognisable,',
  'but use exactly the art style, pose, body proportions, camera framing, scale and plain linen outfit of image 1.',
  'The head must be in the same place and the same size as in image 1. Friendly, kind expression, suitable for a children\'s educational game.',
  'Full body, nothing cropped. No text, no other objects. Transparent background.'
].join('\n');

// бойова поза: картинка 1 — шаблон пози, картинка 2 — уже намальований герой
const POSE_PROMPT = [
  'Image 1 is a pose template: a cartoon 3D child hero in a fighting stance.',
  'Image 2 is a cartoon 3D child character.',
  'Redraw the character from image 2 in exactly the pose, body proportions, camera framing and scale of image 1.',
  'Keep the face, hairstyle, hair colour, eye colour, skin tone, outfit and art style of image 2 unchanged.',
  'Full body, nothing cropped. No text, no other objects. Transparent background.'
].join('\n');

class ImageError extends Error {
  constructor(message, retry) { super(message); this.retry = !!retry; }
}

/* template, photo — PNG-буфери → PNG-буфер результату */
function portrait(template, photo, opt) {
  opt = opt || {};
  return edit([template, photo], opt.prompt || PROMPT, Object.assign({ size: '1024x1536' }, opt));
}

/* images — PNG-буфери (картинка 1, 2, … у тому ж порядку, що й у промпті) → PNG-буфер */
async function edit(images, prompt, opt) {
  opt = opt || {};
  if (!configured()) throw new ImageError('Ключ OpenAI не задано (адмінка або OPENAI_API_KEY)');
  const fd = new FormData();
  fd.append('model', model());
  fd.append('prompt', prompt);
  images.forEach((b, i) => fd.append('image[]', new Blob([b], { type: 'image/png' }), 'image' + (i + 1) + '.png'));
  fd.append('size', opt.size || '1024x1024');
  fd.append('background', 'transparent');
  fd.append('quality', process.env.OPENAI_IMAGE_QUALITY || 'medium');
  fd.append('n', '1');
  let res;
  try {
    res = await (opt.fetch || fetch)(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + apiKey() },
      body: fd,
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
  } catch (e) {
    throw new ImageError('OpenAI недоступний: ' + (e && e.message || e), true);
  }
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || ('HTTP ' + res.status);
    throw new ImageError('OpenAI: ' + String(msg).slice(0, 300), res.status === 429 || res.status >= 500);
  }
  const b64 = data && data.data && data.data[0] && data.data[0].b64_json;
  if (!b64) throw new ImageError('OpenAI не повернув зображення');
  return Buffer.from(b64, 'base64');
}

/* перевірити ключ, нічого не малюючи (список моделей безкоштовний):
   'ok' | 'invalid' (401) | 'unknown' (мережа, інша помилка — зберігаємо, але попереджаємо) */
async function checkKey(key, opt) {
  opt = opt || {};
  try {
    const res = await (opt.fetch || fetch)('https://api.openai.com/v1/models', {
      headers: { Authorization: 'Bearer ' + key }, signal: AbortSignal.timeout(15e3)
    });
    if (res.ok) return 'ok';
    return res.status === 401 ? 'invalid' : 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

module.exports = { configured, model, portrait, edit, checkKey, apiKey, keySource, KEY_SETTING, ImageError, PROMPT, POSE_PROMPT };

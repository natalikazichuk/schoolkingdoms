/* Малюнок героя з фото через OpenAI Images API (режим редагування з кількома картинками).
   Ключ — OPENAI_API_KEY у /srv/sk/.env (рахунок власника сайту), модель — OPENAI_IMAGE_MODEL.
   Картинка 1 — шаблон (базовий герой без верхнього одягу), картинка 2 — фото дитини.
   Відповідь — PNG з прозорим фоном у кадрі й позі шаблону. Фото ніде не зберігаємо. */
const ENDPOINT = 'https://api.openai.com/v1/images/edits';
const TIMEOUT_MS = 240e3;

const configured = () => !!process.env.OPENAI_API_KEY;
const model = () => process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';

const PROMPT = [
  'Image 1 is a character template: a cartoon 3D child hero standing full-height in a plain linen shirt and trousers.',
  'Image 2 is a photo of a real child.',
  'Redraw the child from image 2 as this cartoon character: keep the child\'s face shape, hairstyle, hair colour, eye colour, skin tone and gender recognisable,',
  'but use exactly the art style, pose, body proportions, camera framing, scale and plain linen outfit of image 1.',
  'The head must be in the same place and the same size as in image 1. Friendly, kind expression, suitable for a children\'s educational game.',
  'Full body, nothing cropped. No text, no other objects. Transparent background.'
].join('\n');

class ImageError extends Error {
  constructor(message, retry) { super(message); this.retry = !!retry; }
}

/* template, photo — PNG-буфери → PNG-буфер результату */
async function portrait(template, photo, opt) {
  opt = opt || {};
  if (!configured()) throw new ImageError('OPENAI_API_KEY не задано');
  const fd = new FormData();
  fd.append('model', model());
  fd.append('prompt', opt.prompt || PROMPT);
  fd.append('image[]', new Blob([template], { type: 'image/png' }), 'template.png');
  fd.append('image[]', new Blob([photo], { type: 'image/png' }), 'photo.png');
  fd.append('size', '1024x1536');
  fd.append('background', 'transparent');
  fd.append('quality', process.env.OPENAI_IMAGE_QUALITY || 'medium');
  fd.append('n', '1');
  let res;
  try {
    res = await (opt.fetch || fetch)(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
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

module.exports = { configured, model, portrait, ImageError, PROMPT };

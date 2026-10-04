/* ============================================================
   sw.js — офлайн-режим для ігор (service worker).

   Що робить:
     • під час встановлення кладе в кеш ігротеку (igry.html), спільні
       стилі/скрипти й усі ігри зі списку GAMES_DEFAULT — разом із тим, що
       кожна сторінка підключає (css, js, картинки, звуки у лапках);
     • igry.html, коли отримає свіжий список ігор із бази, надсилає сюди
       {type:'sk-warm', pages:[…]} — докешовуємо й нові ігри;
     • сторінки (HTML) — «спершу мережа»: з інтернетом завжди свіжа версія,
       без інтернету — з кешу. Свої файли — так само (мережа, інакше кеш);
     • шрифти Google і модулі Firebase з gstatic теж кешуються, щоб сторінки
       без інтернету не ламались на імпорті;
     • запити до бази (Firestore / Auth) НЕ чіпаємо — без мережі вони просто
       не вдаються, а ігри від них не залежать.

   Зміниш набір спільних файлів або стратегію — підніми VERSION: старий кеш
   видалиться при активації.
   ============================================================ */
'use strict';

const VERSION = 'sk-offline-v2';
const CACHE   = VERSION;

/* Спільне для ігротеки й ігор. Шляхи — від кореня сайту (теки sw.js). */
const CORE = [
  'igry.html',
  'sk-styles.css', 'sk-game.css', 'sk-game-chalk.css',
  'sk-header.js?v=5', 'sk-footer.js?v=5', 'sk-finish.js?v=6', 'sk-report.js?v=2',
  'sk-zadachi.js', 'sk-voice.js', 'sk-curriculum.js?v=8', 'firebase-config.js',
  'manifest.webmanifest', 'favicon-32.png', 'apple-touch-icon.png',
  'icon-192.png', 'icon-512.png', 'logo-small.png'
];

/* Модулі Firebase SDK, які імпортує firebase-config.js: без них сторінка
   з firebase-config.js офлайн ламалась би на імпорті. */
const FIREBASE_SDK = [
  'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js'
];

/* Ті самі ігри, що й GAMES_DEFAULT в igry.html. Решту (додані в адмінці)
   докешує повідомлення sk-warm з ігротеки. */
const GAMES = [
  'games/zabig.html', 'games/zmiyka.html',
  'games/hrestyky.html', 'games/shashky.html', 'games/shakhy.html',
  'games/kartynka.html', 'games/pamyat.html'
];

const ROOT = new URL('./', self.location).href;          // …/schoolkingdoms/
const abs  = p => new URL(p, ROOT).href;

/* Чужі адреси, які варто кешувати: шрифти й модулі Firebase SDK. */
function cacheableForeign(url){
  return url.hostname === 'fonts.googleapis.com'
      || url.hostname === 'fonts.gstatic.com'
      || (url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/'));
}

/* Локальні файли, на які посилається сторінка/стиль: src/href, url(…) і
   рядки в лапках, що закінчуються на відоме розширення. Динамічно зібрані
   шляхи ('img/' + x + '.png') сюди не потраплять — вони кешуються, коли
   гра вперше їх покаже з інтернетом. */
const ASSET_RE = /(?:src|href)\s*=\s*["']([^"'#]+)["']|url\(\s*["']?([^"')]+)["']?\s*\)|["']([^"'\s<>+]+\.(?:css|js|png|jpe?g|webp|gif|svg|mp3|wav|ogg|json|woff2?))(?:\?[^"'\s]*)?["']/gi;
function extractAssets(text, baseUrl){
  const out = new Set();
  let m;
  ASSET_RE.lastIndex = 0;
  while((m = ASSET_RE.exec(text))){
    const raw = (m[1] || m[2] || m[3] || '').trim();
    if(!raw || raw.includes('${') || /^(data|blob|javascript|mailto|tel):/i.test(raw)) continue;
    let u;
    try { u = new URL(raw, baseUrl); } catch(e){ continue; }
    const foreign = u.origin !== self.location.origin;
    if(foreign ? !cacheableForeign(u) : !u.href.startsWith(ROOT)) continue;
    if(/\.html?$/i.test(u.pathname)) continue;               // інші сторінки не тягнемо
    if(u.pathname.endsWith('/')) continue;                   // тека, а не файл
    u.hash = '';
    out.add(u.href);
  }
  return [...out];
}

/* Кешує одну адресу; для HTML і CSS — ще й те, на що вони посилаються. */
async function warmOne(cache, url, depth){
  let res;
  try {
    res = await fetch(url, { cache: 'no-cache', mode: 'cors', credentials: 'omit' });
  } catch(e){ return; }
  if(!res || !res.ok) return;
  const type = res.headers.get('content-type') || '';
  // розбираємо сторінку (верхній рівень) і стилі; інший HTML — ні
  const isDoc = /text\/css/.test(type) || (depth === 2 && /text\/html/.test(type));
  if(isDoc && depth > 0){
    const text = await res.clone().text();
    await cache.put(url, res);
    const assets = extractAssets(text, url);
    await Promise.all(assets.map(async a => {
      if(await cache.match(a)) return;
      await warmOne(cache, a, depth - 1);
    }));
  } else {
    await cache.put(url, res);
  }
}

/* onlyNew — пропустити вже збережені сторінки (їх і так оновлює «спершу
   мережа» при кожному відкритті з інтернетом). */
async function warm(pages, onlyNew){
  const cache = await caches.open(CACHE);
  let list = [...new Set(pages.map(abs))];
  if(onlyNew){
    const have = await Promise.all(list.map(u => cache.match(u)));
    list = list.filter((u, i) => !have[i]);
  }
  // по кілька за раз, щоб не забивати слабкий інтернет
  for(let i = 0; i < list.length; i += 4){
    await Promise.all(list.slice(i, i + 4).map(u => warmOne(cache, u, 2)));
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    await warm(CORE.concat(GAMES, FIREBASE_SDK));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('sk-offline-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  const d = event.data || {};
  if(d.type === 'sk-warm' && Array.isArray(d.pages)){
    const pages = d.pages.filter(p => typeof p === 'string' && !/^[a-z][a-z0-9+.-]*:/i.test(p));
    event.waitUntil(warm(pages, true));
  }
});

/* ── Відповіді ── */
async function fromCache(req){
  const cache = await caches.open(CACHE);
  return (await cache.match(req)) || (await cache.match(req, { ignoreSearch: true }));
}

/* Сторінки: мережа (з таймаутом), інакше кеш, інакше — в ігротеку. */
async function pageStrategy(event){
  const req = event.request;
  const cache = await caches.open(CACHE);
  try {
    const net = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
    ]);
    if(net && net.ok && new URL(req.url).origin === self.location.origin){
      const key = req.url.split('?')[0].split('#')[0];
      cache.put(key, net.clone());
    }
    return net;
  } catch(e){
    const hit = await fromCache(req);
    if(hit) return hit;
    const hub = await cache.match(abs('igry.html'));
    if(hub && !req.url.startsWith(abs('igry.html'))) return Response.redirect(abs('igry.html'), 302);
    return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
      + '<body style="font-family:sans-serif;text-align:center;padding:40px">'
      + '<h2>Немає інтернету 📡</h2><p>Ця сторінка ще не збережена для офлайну.</p>'
      + '<p><a href="' + abs('igry.html') + '">🎮 До ігор</a></p></body>',
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

/* Свої файли (css/js/картинки): як і сторінки — спершу мережа, щоб після
   оновлення сайту не підсунути старий скрипт; без мережі — з кешу. */
async function localAssetStrategy(event){
  const req = event.request;
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req) || (await cache.match(req, { ignoreSearch: true }));
  const net = fetch(req).then(res => {
    if(res && res.ok) cache.put(req, res.clone());
    return res;
  });
  if(!hit){
    try { return await net; } catch(e){ return new Response('', { status: 504, statusText: 'offline' }); }
  }
  try {
    return await Promise.race([
      net,
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
    ]);
  } catch(e){
    event.waitUntil(net.catch(() => null));
    return hit;
  }
}

/* Шрифти й Firebase SDK — адреси з версією, не міняються: з кешу, інакше з мережі. */
async function foreignStrategy(event){
  const req = event.request;
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if(hit) return hit;
  try {
    const res = await fetch(req);
    if(res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  } catch(e){
    return new Response('', { status: 504, statusText: 'offline' });
  }
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  const same = url.origin === self.location.origin && req.url.startsWith(ROOT);
  if(!same && !cacheableForeign(url)) return;               // база, auth, аналітика — повз

  if(same && (req.mode === 'navigate' || req.destination === 'document')){
    event.respondWith(pageStrategy(event));
    return;
  }
  event.respondWith(same ? localAssetStrategy(event) : foreignStrategy(event));
});

/* ══════════════════════════════════════════════════════════════════
   sk-avatar.js — спільний модуль аватарів School Kingdoms
   ------------------------------------------------------------------
   Аватар героя (поле heroes/{id}.avatar) — це КОРОТКИЙ РЯДОК-ТОКЕН:
     • емодзі            → '🦁'                (як було; синхронізується)
     • вбудований герой  → 'hero:knight-blue-boy'  (ілюстрація; синхронізується)
     • образ у речах     → 'hero:gen/<файл>'  (малює сервер за кнопкою «Одягти»,
                           server/app/src/avatar.js; файли — img/ava/gen/<файл>-full|256|96.webp)
   «Своє фото» НЕ зберігається в токені (base64 вбив би ліміт документа) —
   воно лишається лише локально (localStorage 'sk_hero_avatar') і показується
   тільки на пристрої дитини. Тому вибір фото ⇒ локальний оверрайд,
   а вибір героя/емодзі ⇒ синхронізований аватар для рідні та друзів.

   Публічний API (window.SKAVA):
     CATALOG                       — масив {id,name}
     tokenOf(id)  idOf(token)  isHeroToken(token)
     faceSrc(id,size)  cardSrc(id)  fullSrc(id) — пряма поза (hero.html)
     arenaSrc(id) / arenaPng(id)  — бойова поза створеного образу (арена) і запас
     html(token,{size,round})      — HTML-комірка аватара (img або емодзі)
     openPicker({selected, allowPhoto, onHero, onPhoto, collection, onCollection, onForget})
                                   — самодостатня модалка вибору; collection — створені
                                     образи [{key,file,base}] (розділ «Мої колекції»)
     collectionOf(hero)            — колекція образів із документа Героя
     gridHTML(selected,{emojis})   — сітка опцій для форми (напр. створення героя)
     bindGrid(el, cb)              — навісити кліки на .ska-opt у сітці
   Шлях до /img/ava визначається автоматично з розташування цього файлу,
   тож модуль працює і з підпапок (games/, learn/).
   ══════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  // база = каталог, де лежить сам sk-avatar.js (зазвичай корінь репо)
  var BASE = (function(){
    try{
      var s = document.currentScript && document.currentScript.src;
      if(s) return new URL('.', s).href;
    }catch(e){}
    return './';
  })();

  var CATALOG = [
    { id:'knight-blue-boy',   name:'Королівський лицар' },
    { id:'knight-green-boy',  name:'Мандрівний лицар'  },
    { id:'knight-wood-boy',   name:'Дубовий лицар'     },
    { id:'knight-green-girl', name:'Лісова лицарка'    },
    { id:'knight-purple-girl',name:'Зоряна лицарка'    },
    { id:'linen-boy',         name:'Юний джура'        },
    { id:'linen-boy-fight',   name:'Джура в стійці'    },
    { id:'blond-boy',         name:'Сонячний джура'    },
    { id:'blond-boy-fight',   name:'Сонячний у стійці' },
    { id:'chestnut-boy',      name:'Каштановий джура'  },
    { id:'chestnut-boy-fight',name:'Каштановий у стійці'},
    { id:'hoodie-boy-fight',  name:'Вогняний боєць'    },
    { id:'glasses-girl-fight',name:'Мудра воїтелька'   }
  ];
  var BY = {}; CATALOG.forEach(function(h){ BY[h.id]=h; });

  var EMOJIS = ['🦁','🐯','🦊','🐺','🐲','🦄','🐉','🦅','🐻','🐼','🦉','🐢'];

  function esc(s){ return String(s).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  function isHeroToken(t){ return typeof t==='string' && t.indexOf('hero:')===0; }
  function idOf(t){ return isHeroToken(t) ? t.slice(5) : ''; }
  function tokenOf(id){ return 'hero:'+id; }
  // образ у речах: id = 'gen/<файл>' — шляхи ті самі, лише без PNG-запасу й картки
  function isGen(id){ return /^gen\/[A-Za-z0-9-]+$/.test(String(id||'')); }
  function has(id){ return !!BY[id] || isGen(id); }
  function nameOf(id){ return BY[id] ? BY[id].name : 'Мій герой'; }

  function faceSrc(id,size){ return BASE+'img/ava/'+id+'-'+((size&&size<160)?96:256)+'.webp'; }
  function facePng(id){ return isGen(id) ? faceSrc(id,256) : BASE+'img/ava/'+id+'-256.png'; }
  function cardSrc(id){ return isGen(id) ? fullSrc(id) : BASE+'img/ava/'+id+'-card.webp'; }
  function fullSrc(id){ return BASE+'img/ava/'+id+'-full.webp'; }   // прозора вирізка (повний зріст)
  function fullPng(id){ return isGen(id) ? fullSrc(id) : BASE+'img/ava/'+id+'-full.png'; }
  // арена: створений образ — у бойовій позі (<файл>-fight.webp); немає її — запас arenaPng (пряма)
  function arenaSrc(id){ return isGen(id) ? BASE+'img/ava/'+id+'-fight.webp' : fullSrc(id); }
  function arenaPng(id){ return isGen(id) ? fullSrc(id) : fullPng(id); }

  /* «Мої колекції»: створені образи Героя (heroes/{id}.avatarCollection, пише сервер).
     Як server/app/src/avatar.js collectionOf: хто вдягав образ до появи колекції —
     бачить у ній свій поточний готовий образ. Новіші — першими. */
  function collectionOf(hero){
    var own = hero && hero.avatarCollection, list;
    if(Array.isArray(own)) list = own.filter(function(x){ return x && x.key && isGen('gen/'+x.file); });
    else {
      var g = hero && hero.avatarGen;
      list = (g && g.status==='ready' && g.file && g.key && isGen('gen/'+g.file)) ? [{ key:g.key, file:g.file, base:g.base }] : [];
    }
    return list.slice().reverse();
  }

  // HTML-комірка аватара: <img> для героя, інакше — емодзі/текст
  function html(token, opt){
    opt = opt||{}; var size = opt.size||48; var round = opt.round!==false;
    if(isHeroToken(token) && has(idOf(token))){
      var id = idOf(token), png = facePng(id);
      var r = round?'50%':'22%';
      return '<img class="ska-face" src="'+faceSrc(id,size)+'" width="'+size+'" height="'+size+'"'
        + ' alt="'+esc(nameOf(id))+'" loading="lazy" decoding="async"'
        + ' style="width:'+size+'px;height:'+size+'px;border-radius:'+r+';object-fit:cover;vertical-align:middle;display:inline-block"'
        + ' onerror="this.onerror=null;this.src=\''+png+'\'">';
    }
    return esc(token==null?'🧒':token);
  }

  /* ── стилі (вставляються один раз) ───────────────────────────── */
  function injectCSS(){
    if(document.getElementById('ska-css')) return;
    var css = document.createElement('style'); css.id='ska-css';
    css.textContent = [
      '.ska-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:10px}',
      '.ska-opt{border:2px solid rgba(242,199,92,.4);border-radius:14px;padding:6px 4px;text-align:center;cursor:pointer;',
        'background:rgba(255,255,255,.04);transition:.15s;font-size:2rem;line-height:1;user-select:none;position:relative}',
      '.ska-opt:hover{border-color:rgba(242,199,92,.75)}',
      '.ska-opt.sel{border-color:#FFE7A0;background:rgba(242,199,92,.18);box-shadow:0 0 0 2px rgba(242,199,92,.55)}',
      /* вбудований герой — на повний зріст (3:4) на РІВНОМУ фоні (без шва) */
      '.ska-opt.hero{padding:0;overflow:hidden;aspect-ratio:3/4;',
        'background:linear-gradient(180deg,#bfe3fb 0%,#8fc3ee 60%,#79b4e6 100%)}',
      '.ska-opt.hero img{width:100%;height:100%;object-fit:contain;object-position:center bottom;display:block}',
      '.ska-opt.hero .ska-cap{position:absolute;left:0;right:0;bottom:0;margin:0;padding:10px 4px 5px;',
        'background:linear-gradient(transparent,rgba(10,18,38,.85));border-radius:0 0 12px 12px}',
      '.ska-opt .ska-cap{display:block;font-size:.6rem;font-weight:800;margin-top:4px;color:#ffe9b8;line-height:1.15}',
      '.ska-opt.soon{opacity:.55;cursor:not-allowed}',
      '.ska-opt.soon::after{content:"скоро";position:absolute;top:4px;right:4px;font-size:.5rem;font-weight:900;',
        'background:#b8863b;color:#fff;border-radius:6px;padding:1px 5px;letter-spacing:.03em}',
      /* модалка */
      '.ska-modal{position:fixed;inset:0;z-index:120;display:flex;align-items:center;justify-content:center;',
        'background:rgba(8,14,30,.72);backdrop-filter:blur(3px);padding:16px}',
      '.ska-modal[hidden]{display:none}',
      '.ska-sheet{width:100%;max-width:440px;max-height:88vh;overflow:auto;background:linear-gradient(180deg,#243b66,#182a4c);',
        'border:3px solid #e0a42a;border-radius:20px;padding:18px 16px 20px;box-shadow:0 20px 60px rgba(0,0,0,.5)}',
      '.ska-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}',
      '.ska-h b{font-size:1.05rem;color:#ffe9b8}',
      '.ska-x{background:none;border:0;color:#ffe9b8;font-size:1.5rem;line-height:1;cursor:pointer;padding:2px 6px}',
      '.ska-del{position:absolute;top:4px;right:4px;z-index:2;width:22px;height:22px;border-radius:50%;border:0;',
        'background:rgba(10,18,38,.7);color:#ffe9b8;font-size:.75rem;line-height:22px;padding:0;cursor:pointer}',
      '.ska-empty{font-size:.75rem;color:#cfd8ee;opacity:.85;padding:4px 2px 2px;line-height:1.35}',
      '.ska-sub{font-size:.7rem;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#ffd98a;margin:12px 2px 6px}'
    ].join('');
    document.head.appendChild(css);
  }

  /* ── сітка опцій (для вбудованих форм) ───────────────────────── */
  function optCell(token, label, selected){
    var sel = (token===selected)?' sel':'';
    if(isHeroToken(token)){
      var id=idOf(token);
      return '<div class="ska-opt hero'+sel+'" data-token="'+esc(token)+'">'
        + '<img src="'+fullSrc(id)+'" alt="'+esc(label||'')+'" loading="lazy"'
        + ' onerror="this.onerror=null;this.src=\''+fullPng(id)+'\'">'
        + (label?'<span class="ska-cap">'+esc(label)+'</span>':'')
        + '</div>';
    }
    return '<div class="ska-opt'+sel+'" data-token="'+esc(token)+'">'+esc(token)+'</div>';
  }
  function gridHTML(selected, opt){
    opt = opt||{}; injectCSS();
    var cells = CATALOG.map(function(h){ return optCell(tokenOf(h.id), h.name, selected); });
    if(opt.emojis!==false){ EMOJIS.forEach(function(e){ cells.push(optCell(e, '', selected)); }); }
    return '<div class="ska-grid">'+cells.join('')+'</div>';
  }
  function bindGrid(el, cb){
    if(!el) return;
    el.querySelectorAll('.ska-opt').forEach(function(o){
      if(o.classList.contains('soon')) return;
      o.addEventListener('click', function(){
        el.querySelectorAll('.ska-opt').forEach(function(x){ x.classList.remove('sel'); });
        o.classList.add('sel');
        if(cb) cb(o.getAttribute('data-token'));
      });
    });
  }

  /* ── самодостатня модалка вибору ─────────────────────────────── */
  function openPicker(cfg){
    cfg = cfg||{}; injectCSS();
    var sel = cfg.selected||null;
    var m = document.createElement('div'); m.className='ska-modal';
    var heroCells = CATALOG.map(function(h){ return optCell(tokenOf(h.id), h.name, sel); }).join('');
    var extra = '';
    if(cfg.allowPhoto!==false){
      extra += '<div class="ska-opt" data-act="photo" style="font-size:1.6rem">📷<span class="ska-cap">Своє фото</span></div>';
    }
    extra += '<div class="ska-opt soon" data-act="model3d" style="font-size:1.6rem">🧊<span class="ska-cap">3D-модель</span></div>';
    // Мої колекції — розділ є, лише коли сторінка вміє вдягати образи (onCollection)
    var coll = '';
    if(cfg.onCollection){
      var mine = (cfg.collection||[]).filter(function(c){ return c && c.key && isGen('gen/'+c.file); });
      coll = '<div class="ska-sub">🎒 Мої колекції</div>'
        + (mine.length
          ? '<div class="ska-grid">' + mine.map(function(c){
              var tok = tokenOf('gen/'+c.file);
              // герой із фото: base = 'gen/<файл>' (сам образ — це він, без речей)
              var cap = /^gen\//.test(c.base||'') ? (c.base==='gen/'+c.file ? 'Герой з фото' : 'Герой з фото в образі') : nameOf(c.base)+' в образі';
              if(c.engine==='gpt') cap += ' · GPT';   // «Одягти GPT» — щоб порівнювати з малюнками воркера
              var cell = optCell(tok, cap, sel).replace('data-token=', 'data-key="'+esc(c.key)+'" data-token=');
              // поточний образ не прибираємо — спершу обери інший
              if(cfg.onForget && tok!==sel)
                cell = cell.replace(/<\/div>$/, '<button class="ska-del" type="button" title="Прибрати з колекції" aria-label="Прибрати з колекції">✕</button></div>');
              return cell;
            }).join('') + '</div>'
          : '<div class="ska-empty">Тут зберігатимуться образи, які ти створиш: вдягни речі в Арені й натисни «🪄 Одягти» або «📸 Аватар з фото».</div>');
    }
    m.innerHTML =
      '<div class="ska-sheet" role="dialog" aria-modal="true" aria-label="Вибір аватара">'
      + '<div class="ska-h"><b>Обери свого героя</b><button class="ska-x" type="button" aria-label="Закрити">✕</button></div>'
      + coll
      + '<div class="ska-sub">🛡️ Герої королівства</div>'
      + '<div class="ska-grid">'+heroCells+'</div>'
      + '<div class="ska-sub">✨ Інше</div>'
      + '<div class="ska-grid">'+extra+'</div>'
      + '</div>';
    document.body.appendChild(m);
    function close(){ m.remove(); }
    m.addEventListener('click', function(e){ if(e.target===m) close(); });
    m.querySelector('.ska-x').addEventListener('click', close);
    m.querySelectorAll('.ska-opt').forEach(function(o){
      if(o.classList.contains('soon')) return;
      var key = o.getAttribute('data-key');
      var del = o.querySelector('.ska-del');
      if(del) del.addEventListener('click', function(e){
        e.stopPropagation();
        if(!confirm('Прибрати цей образ із колекції?')) return;
        var grid = o.parentNode; o.remove();
        if(grid && !grid.children.length) grid.outerHTML = '<div class="ska-empty">Колекція порожня.</div>';
        cfg.onForget(key);
      });
      o.addEventListener('click', function(){
        var act = o.getAttribute('data-act');
        if(act==='photo'){ close(); if(cfg.onPhoto) cfg.onPhoto(); return; }
        if(key){ close(); cfg.onCollection(key, o.getAttribute('data-token')); return; }
        var tok = o.getAttribute('data-token');
        close(); if(tok && cfg.onHero) cfg.onHero(tok);
      });
    });
    return { close: close };
  }

  window.SKAVA = {
    CATALOG: CATALOG, EMOJIS: EMOJIS,
    isHeroToken: isHeroToken, idOf: idOf, tokenOf: tokenOf, has: has, isGen: isGen,
    faceSrc: faceSrc, facePng: facePng, cardSrc: cardSrc, fullSrc: fullSrc, fullPng: fullPng,
    arenaSrc: arenaSrc, arenaPng: arenaPng,
    html: html, gridHTML: gridHTML, bindGrid: bindGrid, openPicker: openPicker,
    collectionOf: collectionOf
  };
})();

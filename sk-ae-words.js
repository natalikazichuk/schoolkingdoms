/* AE Words — словник курсу «American English для молодшої школи».
   Слова НЕ дублюються вручну: беремо їх просто з тренажерів курсу
   (масив MODS у klas-1/english-1-litery.html і klas-2/english-2.html).
   Додали модуль або слово в тренажер — воно саме з'явиться в AE Words.

   SKAE.load() → Promise<[{ key, grade, n, title, ua, cover, emo, words:[{word, uk, pic, grade, module}] }]>
     pic — емодзі, колір (#rrggbb) або число, як у тренажері.
   Слова модуля: «Слова теми» (V) + слова до літер (L, 1 клас), без повторів. */
(function(){
  var SRC = [
    { grade:1, url:'klas-1/english-1-litery.html', cover:function(n){ return 'img/tr/english-1-m'+(n<10?'0':'')+n+'.webp'; } },
    { grade:2, url:'klas-2/english-2.html',        cover:function(){ return ''; } }
  ];

  /* MODS у тренажері — по одному JSON-об'єкту модуля на рядок, з комою в кінці */
  function parseMods(html){
    var i = html.indexOf('const MODS = ['); if(i < 0) return [];
    var j = html.indexOf('\n];', i); if(j < 0) return [];
    return html.slice(i + 14, j).split('\n').map(function(l){
      l = l.trim().replace(/,$/, ''); if(!l) return null;
      try{ return JSON.parse(l); }catch(e){ return null; }
    }).filter(Boolean);
  }

  function deckOf(src, m){
    var seen = {}, words = [];
    function add(en, pic, uk){
      en = String(en || '').trim(); uk = String(uk || '').trim();
      var k = en.toLowerCase(); if(!en || !uk || seen[k]) return;
      seen[k] = 1;
      words.push({ word:en, uk:uk, pic:String(pic || ''), grade:src.grade, module:m.n, topic:'AE Words' });
    }
    (m.V || []).forEach(function(v){ add(v[0], v[1], v[2]); });
    (m.L || []).forEach(function(l){ add(l[2], l[3], l[4]); });
    var emo = '🔤';   // значок модуля — перше слово з емодзі (не колір і не число)
    for(var i = 0; i < words.length; i++){ var pp = words[i].pic; if(pp && pp.charAt(0) !== '#' && !/^\d+$/.test(pp)){ emo = pp; break; } }
    return { key:'ae:'+src.grade+':'+m.n, grade:src.grade, n:m.n, title:m.t, ua:m.ua || '',
             cover:src.cover(m.n), emo:emo, words:words };
  }

  var cached = null;
  window.SKAE = {
    load: function(){
      if(cached) return cached;
      cached = Promise.all(SRC.map(function(src){
        return fetch(src.url, { cache:'no-cache' })
          .then(function(r){ return r.ok ? r.text() : ''; })
          .then(function(h){ return parseMods(h).map(function(m){ return deckOf(src, m); }); })
          .catch(function(){ return []; });
      })).then(function(parts){
        return [].concat.apply([], parts).filter(function(d){ return d.words.length; });
      });
      cached.then(function(d){ if(!d.length) cached = null; });   // збій мережі — наступного разу спробуємо знову
      return cached;
    },
    parseMods: parseMods
  };
})();

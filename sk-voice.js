/* ============================================================
   sk-voice.js — надійна озвучка синтезатором (speechSynthesis) на телефоні.

   Підключення — після скрипта сторінки:
     <script src="../sk-voice.js?v=1"></script>

   Нічого не міняє в тому, ЩО і ЯКИМ голосом каже сторінка (мова й голос
   лишаються її). Виправляє чотири речі, через які на Android (Chrome) назва
   слова мовчала, хоча mp3-звуки грали:

   1) cancel() і одразу speak() — Chrome на Android мовчки «ковтає» таку
      фразу. Сторінки завжди спершу зупиняють попередній звук, тож фразу,
      сказану швидше ніж за 250 мс після cancel(), відкладаємо до 250 мс.
      Новий cancel() за цей час скасовує і відкладену фразу.
   2) Голоси на Android приходять пізно (onvoiceschanged), і сторінка ще
      не встигла обрати голос — тоді фраза з мовою «uk-UA» без голосу може
      мовчати. Підбираємо голос за мовою в момент озвучки.
   3) mp3 назви, якого немає (audio/nazva_*.mp3, tsyfry_*.mp3), щоразу
      спершу вантажився, падав і лише тоді вмикав синтезатор — поза
      дотиком дитини. Запамʼятовуємо відсутні файли (перевіряємо HEAD-ом)
      і наступного разу одразу кличемо синтезатор, ще в межах дотику.
   4) Немає голосу потрібної мови (часто — українського на Windows/iPad):
      фразу озвучує сервер (POST /api/tts → mp3), див. розділ 4 нижче.
   ============================================================ */
(function(){
  'use strict';
  if(window.__skVoice) return;
  window.__skVoice = true;
  var ss = window.speechSynthesis;
  if(!ss || !window.SpeechSynthesisUtterance) return;

  var GAP = 250, lastCancel = 0, timers = [];
  var rawSpeak = ss.speak.bind(ss), rawCancel = ss.cancel.bind(ss);

  function voices(){ try{ return ss.getVoices() || []; }catch(e){ return []; } }
  function baseOf(lang){ return String(lang || '').toLowerCase().replace('_', '-').split('-')[0]; }
  function hasVoiceFor(lang){
    var base = baseOf(lang), vs = voices();
    for(var i = 0; i < vs.length; i++) if(baseOf(vs[i].lang) === base) return true;
    return false;
  }
  function pickVoice(u){
    if(u.voice) return;
    var lang = String(u.lang || '').toLowerCase();
    if(!lang) return;
    var vs = voices();
    var base = lang.split('-')[0], best = null;
    for(var i = 0; i < vs.length; i++){
      var vl = String(vs[i].lang || '').toLowerCase().replace('_', '-');
      if(vl === lang){ best = vs[i]; break; }
      if(!best && vl.split('-')[0] === base) best = vs[i];
    }
    if(best) u.voice = best;
  }

  /* ── 4) немає голосу потрібної мови (Chrome на Windows без українського голосу,
     iPad/Android без пакета) — браузер мовчить або читає кирилицю чужим голосом.
     Тоді беремо mp3 з сервера (POST /api/tts, server/app/src/tts.js; кожна фраза
     синтезується один раз) і граємо його, імітуючи події фрази (start/end/error),
     щоб сторінки, які чекають onend (наприклад «Слухати вірш»), йшли далі. ── */
  var SERVER_LANGS = { uk: 1, en: 1 };
  var urls = {};               // текст|мова → /tts/….mp3
  var queue = [], cur = null;  // фрази для сервера — по черзі, як у синтезатора
  var serverOff = false;       // сервер недоступний (локальний файл, ліміт) — більше не пробуємо

  function needServer(u){
    if(serverOff || u.voice || !window.fetch || !window.Audio) return false;
    var base = baseOf(u.lang);
    if(!SERVER_LANGS[base] || !String(u.text || '').trim()) return false;
    if(location.protocol !== 'https:' && location.protocol !== 'http:') return false;
    return voices().length > 0 && !hasVoiceFor(u.lang);
  }
  function fire(u, type){
    try{ u.dispatchEvent(new Event(type)); }catch(e){}
  }
  function getUrl(u){
    var text = String(u.text).replace(/\s+/g, ' ').trim(), lang = baseOf(u.lang), k = lang + '|' + text;
    if(urls[k]) return Promise.resolve(urls[k]);
    return fetch('/api/tts', {
      method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ text: text, lang: lang })
    }).then(function(r){
      if(r.status === 404 || r.status === 429 || r.status === 503) serverOff = true;
      if(!r.ok) throw new Error('tts ' + r.status);
      return r.json();
    }).then(function(j){ urls[k] = j.url; return j.url; });
  }
  function next(){
    if(cur || !queue.length) return;
    var u = queue.shift();
    var job = cur = { u: u, audio: null, dead: false };
    var finish = function(type){
      if(job.dead) return;
      job.dead = true;
      if(cur === job) cur = null;
      fire(u, type);
      next();
    };
    getUrl(u).then(function(url){
      if(job.dead) return;
      var a = job.audio = new Audio(url);
      var rate = +u.rate || 1;
      a.playbackRate = Math.max(0.6, Math.min(1.5, rate));
      if(u.volume >= 0 && u.volume <= 1) a.volume = u.volume;
      a.onended = function(){ finish('end'); };
      a.onerror = function(){ finish('error'); };
      fire(u, 'start');
      var p = a.play();
      if(p && p.catch) p.catch(function(){ finish('error'); });
    }).catch(function(){
      if(job.dead) return;
      // сервер не допоміг — віддаємо фразу браузеру (як було раніше)
      job.dead = true; cur = null;
      try{ rawSpeak(u); }catch(e){ fire(u, 'error'); }
      next();
    });
  }
  function stopServer(){
    queue = [];
    if(cur){
      var job = cur; cur = null; job.dead = true;
      if(job.audio) try{ job.audio.pause(); job.audio.src = ''; }catch(e){}
    }
  }

  function say(u){
    pickVoice(u);
    if(needServer(u)){ queue.push(u); next(); return; }
    try{ ss.resume(); }catch(e){}          // Android інколи лишає синтезатор «на паузі»
    try{ rawSpeak(u); }catch(e){}
  }
  // голоси ще не прийшли — підтягуємо їх заздалегідь, щоб needServer бачив повний список
  try{ voices(); ss.addEventListener && ss.addEventListener('voiceschanged', voices); }catch(e){}

  ss.cancel = function(){
    lastCancel = Date.now();
    timers.forEach(clearTimeout); timers = [];
    stopServer();
    try{ rawCancel(); }catch(e){}
  };
  ss.speak = function(u){
    var wait = GAP - (Date.now() - lastCancel);
    if(wait > 0){
      var t = setTimeout(function(){
        timers = timers.filter(function(x){ return x !== t; });
        say(u);
      }, wait);
      timers.push(t);
    }else{
      say(u);
    }
  };

  /* ── відсутні mp3 → одразу синтезатор ── */
  var missing = {}, checked = {};
  function probe(url){
    if(!url || checked[url] || !window.fetch) return;
    checked[url] = 1;
    try{
      fetch(url, { method: 'HEAD', cache: 'no-store' })
        .then(function(r){ if(!r.ok) missing[url] = 1; })
        .catch(function(){});
    }catch(e){}
  }
  var orig = window.playAudio;
  if(typeof orig === 'function'){
    window.playAudio = function(url){
      if(url && missing[url]){
        var args = Array.prototype.slice.call(arguments);
        args[0] = null;                       // сторінка сама піде в синтезатор
        return orig.apply(this, args);
      }
      probe(url);
      return orig.apply(this, arguments);
    };
  }
})();

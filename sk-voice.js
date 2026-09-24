/* ============================================================
   sk-voice.js — надійна озвучка синтезатором (speechSynthesis) на телефоні.

   Підключення — після скрипта сторінки:
     <script src="../sk-voice.js?v=1"></script>

   Нічого не міняє в тому, ЩО і ЯКИМ голосом каже сторінка (мова й голос
   лишаються її). Виправляє три речі, через які на Android (Chrome) назва
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
   ============================================================ */
(function(){
  'use strict';
  if(window.__skVoice) return;
  window.__skVoice = true;
  var ss = window.speechSynthesis;
  if(!ss || !window.SpeechSynthesisUtterance) return;

  var GAP = 250, lastCancel = 0, timers = [];
  var rawSpeak = ss.speak.bind(ss), rawCancel = ss.cancel.bind(ss);

  function pickVoice(u){
    if(u.voice) return;
    var lang = String(u.lang || '').toLowerCase();
    if(!lang) return;
    var vs = [];
    try{ vs = ss.getVoices() || []; }catch(e){}
    var base = lang.split('-')[0], best = null;
    for(var i = 0; i < vs.length; i++){
      var vl = String(vs[i].lang || '').toLowerCase().replace('_', '-');
      if(vl === lang){ best = vs[i]; break; }
      if(!best && vl.split('-')[0] === base) best = vs[i];
    }
    if(best) u.voice = best;
  }
  function say(u){
    pickVoice(u);
    try{ ss.resume(); }catch(e){}          // Android інколи лишає синтезатор «на паузі»
    try{ rawSpeak(u); }catch(e){}
  }

  ss.cancel = function(){
    lastCancel = Date.now();
    timers.forEach(clearTimeout); timers = [];
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


/* ============================================================
   ПЛЕЄР ТЕСТІВ З БАЗИ. Читає heroes/{id} через SK, тест — через
   SK.getTest(id). Нагороду (XP + характеристика) нараховує сам:
     xpMode/statMode: 'fixed'  -> раз за тест
                      'perCorrect' -> за кожну правильну відповідь
   Характеристики, що реально зберігаються (saveHeroStats):
     health, mana, agility, accuracy. Заблоковані стати поки не
     персистяться — XP усе одно нараховується.
   Захист від «фарму»: повторне проходження дає половину XP і 0 до
   стата (маркер sk_dbtest_<id> у localStorage, як у скіл-тестах).
   ============================================================ */

/* нічне небо */
(function(){
  var box=document.getElementById('stars'); if(!box) return;
  var html='';
  for(var i=0;i<46;i++){
    var s=(Math.random()*2+1).toFixed(1);
    html+='<span class="star-dot" style="left:'+(Math.random()*100).toFixed(2)+'%;top:'+(Math.random()*100).toFixed(2)+'%;width:'+s+'px;height:'+s+'px;--dur:'+(Math.random()*3+2).toFixed(1)+'s"></span>';
  }
  box.innerHTML=html;
})();

var ACTIVE_STATS={health:1,mana:1,agility:1,accuracy:1};
var STAT_BASE={health:100,mana:20,agility:50,accuracy:50};
var STAT_LABEL={health:"Здоров'я ❤️",accuracy:'Влучність 🎯',agility:'Спритність 🏃',mana:'Мана 🔮',
  strength:'Сила',defense:'Захист',intelligence:'Інтелект',wisdom:'Мудрість',luck:'Удача',memory:'Пам’ять',charisma:'Харизма'};

var root=document.getElementById('root');
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function fmt(v){return Number.isInteger(v)?String(v):String(v).replace('.',',');}
function num(v){ v=parseFloat(v); return isNaN(v)?0:v; }

var TEST=null, ST=null, HERO_SESSION=false;
var QS=[];            // активний масив питань: плаский тест або поточний рівень
var IS_LEVELS=false;

/* Тест із рівнями? format:'levels' або наявний масив levels[] */
function isLevels(t){ return !!(t && (t.format==='levels' || (Array.isArray(t.levels) && t.levels.length))); }
function levelsArr(){ return (TEST && Array.isArray(TEST.levels)) ? TEST.levels : []; }
function levelId(i){ var L=levelsArr()[i]; return String((L&&L.level!=null)?L.level:(i+1)); }
function levelQs(i){ var L=levelsArr()[i]; return (L&&Array.isArray(L.questions))?L.questions:[]; }
function totalQs(){ return levelsArr().reduce(function(s,L){ return s+((L&&L.questions)?L.questions.length:0); },0); }

/* ─── Прогрес рівнів у localStorage (ключі з id тесту → синхронізуються у Firebase) ─── */
function lvKey(kind){ return 'sk_lvtest_'+TEST.id+'_'+kind; }
function loadDone(){ try{ var o=JSON.parse(localStorage.getItem(lvKey('done'))||'{}'); return (o&&typeof o==='object'&&!Array.isArray(o))?o:{}; }catch(e){ return {}; } }
function loadStars(){ try{ var o=JSON.parse(localStorage.getItem(lvKey('stars'))||'{}'); return (o&&typeof o==='object'&&!Array.isArray(o))?o:{}; }catch(e){ return {}; } }
function saveJSON(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function isUnlocked(i){ if(i<=0) return true; return !!loadDone()[levelId(i-1)]; }

function getId(){
  try{ return new URLSearchParams(location.search).get('id'); }catch(e){ return null; }
}

function errorScreen(msg){
  root.innerHTML='<div class="card center">'
    +'<div class="result-emoji">🤔</div>'
    +'<div class="result-title">Ой!</div>'
    +'<p class="muted" style="margin:10px 0 4px">'+esc(msg)+'</p>'
    +'<a class="btn ghost" href="tests.html">← До списку тестів</a></div>';
}

function rewardText(){
  var xp = TEST.xpMode==='perCorrect' ? (num(TEST.xpValue)+' XP за кожну правильну') : ('+'+num(TEST.xpValue)+' XP'+(IS_LEVELS?' за рівень':' за тест'));
  var sv = num(TEST.statValue);
  var st='';
  if(sv>0){
    var lbl=STAT_LABEL[TEST.stat]||TEST.stat;
    var per = IS_LEVELS?'рівень':'тест';
    st = TEST.statMode==='perCorrect' ? ('+'+sv+' до «'+lbl+'» за кожну правильну') : ('+'+sv+' до «'+lbl+'» за '+per);
  }
  return {xp:xp, st:st};
}

function intro(){
  var r=rewardText();
  var warn = HERO_SESSION ? '' :
    '<div class="warn">Ти не увійшов як Герой — нагорода не збережеться. <a href="login.html?next=hero">Увійти Героєм</a></div>';
  var chips = IS_LEVELS
    ? '<span class="chip">'+esc(TEST.subject||'—')+'</span>'
      +'<span class="chip">Клас '+(TEST.grade!=null?esc(TEST.grade):'1')+'</span>'
      +'<span class="chip gold">'+levelsArr().length+' рівнів</span>'
      +'<span class="chip">'+totalQs()+' пит.</span>'
    : '<span class="chip">'+esc(TEST.subject||'—')+'</span>'
      +'<span class="chip">Клас '+(TEST.grade!=null?esc(TEST.grade):'1')+'</span>'
      +'<span class="chip gold">'+(TEST.questions||[]).length+' пит.</span>';
  root.innerHTML='<div class="card">'
    +'<div class="t-title">'+esc(TEST.title||'Тест')+'</div>'
    +'<div class="chips">'+chips+'</div>'
    +'<div class="reward-line">🎁 '+r.xp+(r.st?('<br>✨ '+r.st):'')+'</div>'
    +warn
    +'<button class="btn" id="startBtn">'+(IS_LEVELS?'▶ Обрати рівень':'▶ Почати')+'</button>'
    +'</div>';
  document.getElementById('startBtn').onclick = IS_LEVELS ? levelMenu : startQuiz;
}

/* ─── МЕНЮ РІВНІВ ─── */
function levelMenu(){
  ST=null;
  var levels=levelsArr();
  var stars=loadStars(), done=loadDone();
  var cards=levels.map(function(L,i){
    var id=levelId(i);
    var name=(L&&L.name)?L.name:('Рівень '+(i+1));
    var cnt=levelQs(i).length;
    var locked=!isUnlocked(i);
    var st=parseInt(stars[id],10)||0;
    var isDone=!!done[id];
    return '<button class="lv-card '+(locked?'locked':'')+' '+(isDone?'done':'')+'" data-lv="'+i+'" '+(locked?'disabled':'')+'>'
      +(locked?'<span class="lv-lock">🔒</span>':'')
      +'<span class="lv-circle">'+(i+1)+'</span>'
      +'<span class="lv-name">'+esc(name)+'</span>'
      +'<span class="lv-count">'+cnt+' пит.</span>'
      +'<span class="lv-stars">'+(isDone?'⭐'.repeat(st):(locked?'':'·'))+'</span>'
      +'</button>';
  }).join('');
  root.innerHTML='<div class="card">'
    +'<div class="t-title" style="font-size:1.35rem">'+esc(TEST.title||'Тест')+'</div>'
    +'<p class="muted center" style="margin:2px 0 14px">Проходь рівні по черзі — кожен відкриває наступний</p>'
    +'<div class="lv-grid">'+cards+'</div>'
    +'<a class="btn ghost" href="tests.html" style="margin-top:14px">← До тестів</a>'
    +'</div>';
  Array.prototype.forEach.call(root.querySelectorAll('.lv-card'),function(btn){
    if(btn.disabled) return;
    btn.onclick=function(){ startLevel(parseInt(btn.getAttribute('data-lv'),10)); };
  });
}

function startQuiz(){
  QS=TEST.questions||[];
  ST={idx:0, correct:0, answered:false};
  renderQ();
}

function startLevel(i){
  QS=levelQs(i);
  var already=!!loadDone()[levelId(i)];   // рівень уже пройдено → повтор
  ST={idx:0, correct:0, answered:false, level:i, isReplay:already};
  renderQ();
}

/* ─── ВІЗУАЛ (ілюстрація до питання) ─── */
function vizNumberLine(v){
  var from=parseInt(v.from,10); if(isNaN(from)) from=1;
  var to=parseInt(v.to,10);     if(isNaN(to))   to=10;
  if(to<from){ var t=from; from=to; to=t; }
  if(to-from>20) to=from+20;                         // запобіжник
  var hi=Array.isArray(v.highlight)?v.highlight.map(Number):[];
  var cells='';
  for(var n=from;n<=to;n++){
    cells+='<span class="ncell'+(hi.indexOf(n)>=0?' hi':'')+'">'+n+'</span>';
  }
  return '<div class="viz nline">'+cells+'</div>';
}
function vizBlocks(v){
  var palette=['#ffd54a','#7cc4ff','#ff9db0','#9be29b'];
  function cluster(count,ci){
    var dots=''; count=Math.max(0,Math.min(40,count|0));
    for(var i=0;i<count;i++){ dots+='<span class="dot" style="background:'+palette[ci%palette.length]+'"></span>'; }
    return '<span class="bgroup">'+dots+'</span>';
  }
  var groups=(Array.isArray(v.groups)&&v.groups.length)
    ? v.groups.map(function(x){ x=parseInt(x,10); return isNaN(x)?0:x; })
    : null;
  var html;
  if(groups){ html=groups.map(function(c,i){ return cluster(c,i); }).join('<span class="bplus">+</span>'); }
  else { var val=parseInt(v.value,10); if(isNaN(val)) val=0; html=cluster(val,0); }
  return '<div class="viz blocks">'+html+'</div>';
}
function renderVisual(v){
  if(!v || typeof v!=='object') return '';
  if(v.type==='number-line')   return vizNumberLine(v);
  if(v.type==='number-blocks') return vizBlocks(v);
  return '';
}

function renderQ(){
  var q=QS[ST.idx];
  ST.answered=false;
  var pct=Math.round(ST.idx/QS.length*100);
  var opts=(q.options||[]).map(function(o,i){
    return '<button class="opt" data-i="'+i+'">'+esc(o)+'</button>';
  }).join('');
  var head = IS_LEVELS
    ? '<span class="quiz-lvl">Рівень '+(ST.level+1)+' · '+esc((levelsArr()[ST.level]||{}).name||'')+'</span>'
    : '<span>Питання '+(ST.idx+1)+' / '+QS.length+'</span>';
  var subCounter = IS_LEVELS
    ? '<div class="q-head" style="margin:-4px 0 6px;font-weight:700;color:rgba(255,255,255,.45)"><span></span><span>'+(ST.idx+1)+' / '+QS.length+'</span></div>'
    : '';
  root.innerHTML='<div class="card">'
    +'<div class="q-head">'+head+'<span>✅ '+ST.correct+'</span></div>'
    +'<div class="prog-track"><span class="prog-fill" style="width:'+pct+'%"></span></div>'
    +subCounter
    +'<div class="q-text">'+esc(q.q||'')+'</div>'
    +renderVisual(q.visual)
    +'<div class="opts">'+opts+'</div>'
    +'<div class="feedback" id="fb"></div>'
    +'</div>';
  Array.prototype.forEach.call(root.querySelectorAll('.opt'),function(btn){
    btn.onclick=function(){ answer(parseInt(btn.getAttribute('data-i'),10)); };
  });
}

function answer(i){
  if(ST.answered) return;
  ST.answered=true;
  var q=QS[ST.idx];
  var correct=parseInt(q.correct,10); if(isNaN(correct)) correct=-1;
  var btns=root.querySelectorAll('.opt');
  Array.prototype.forEach.call(btns,function(b){ b.disabled=true; });
  var fb=document.getElementById('fb');
  var right=(i===correct);
  if(right){
    ST.correct++;
    if(btns[i]) btns[i].classList.add('correct');
    if(fb){ fb.textContent='✅ Правильно!'; fb.style.color='#69DB7C'; }
  } else {
    if(btns[i]) btns[i].classList.add('wrong');
    if(correct>=0 && btns[correct]) btns[correct].classList.add('correct');
    // У режимі рівнів помилка повертає на початок рівня і обнуляє XP рівня.
    if(IS_LEVELS){
      if(fb){ fb.textContent='❌ Помилка! Рівень починається спочатку'; fb.style.color='#ffb3b4'; }
    } else {
      if(fb){ fb.textContent='❌ Правильна відповідь підсвічена'; fb.style.color='#ffb3b4'; }
    }
  }
  setTimeout(function(){
    // Неправильна відповідь у рівні → назад на 1-ше питання, лічильник/XP рівня = 0
    if(!right && IS_LEVELS){
      ST.idx=0; ST.correct=0; ST.answered=false;
      renderQ();
      return;
    }
    ST.idx++;
    if(ST.idx>=QS.length){ IS_LEVELS ? finishLevel() : finish(); }
    else renderQ();
  }, 950);
}

/* ─── ПІДСУМОК: ПЛАСКИЙ ТЕСТ ─── */
function finish(){
  var total=QS.length;
  var correct=ST.correct;
  var id=TEST.id;
  var replay=false;
  try{ replay = localStorage.getItem('sk_dbtest_'+id)==='1'; }catch(e){}

  var xpGain = TEST.xpMode==='perCorrect' ? num(TEST.xpValue)*correct : num(TEST.xpValue);
  var statGain = TEST.statMode==='perCorrect' ? num(TEST.statValue)*correct : num(TEST.statValue);
  if(replay){ xpGain = xpGain/2; statGain = 0; }

  var pctScore = total? Math.round(correct/total*100) : 0;
  var emoji = pctScore>=80?'🏆':pctScore>=50?'🌟':'💪';
  var head  = pctScore>=80?'Чудово!':pctScore>=50?'Молодець!':'Гарна спроба!';
  var statLine='';
  if(statGain>0){
    var lbl=STAT_LABEL[TEST.stat]||TEST.stat;
    var tracked=ACTIVE_STATS[TEST.stat];
    statLine='<div class="reward-line">✨ +'+fmt(statGain)+' до «'+esc(lbl)+'»'
      +(tracked?'':' <span class="muted">(поки не зберігається)</span>')+'</div>';
  }
  root.innerHTML='<div class="card center">'
    +'<div class="result-emoji">'+emoji+'</div>'
    +'<div class="result-title">'+head+'</div>'
    +'<div class="result-score">'+correct+' з '+total+' правильно</div>'
    +'<div class="result-xp">+'+fmt(xpGain)+' XP'+(replay?' <span class="muted" style="font-size:.8rem">(повтор)</span>':'')+'</div>'
    +statLine
    +'<div id="saveNote" class="muted" style="margin:8px 0 2px">'+(HERO_SESSION?'💾 Зберігаємо…':'ℹ️ Увійди Героєм, щоб зберегти нагороду')+'</div>'
    +'<button class="btn" onclick="location.reload()">↻ Пройти ще раз</button>'
    +'<a class="btn ghost" href="hero.html">🦁 До Героя</a>'
    +'<a class="btn ghost" href="tests.html">← До тестів</a>'
    +'</div>';

  try{ localStorage.setItem('sk_dbtest_'+id,'1'); }catch(e){}
  if(HERO_SESSION) saveReward(xpGain, statGain);
}

/* ─── ПІДСУМОК: РІВЕНЬ ─── */
function finishLevel(){
  var total=QS.length;
  var correct=ST.correct;
  var i=ST.level;
  var id=levelId(i);
  var replay=ST.isReplay;

  var xpGain = TEST.xpMode==='perCorrect' ? num(TEST.xpValue)*correct : num(TEST.xpValue);
  var statGain = TEST.statMode==='perCorrect' ? num(TEST.statValue)*correct : num(TEST.statValue);
  if(replay){ xpGain = xpGain/2; statGain = 0; }   // повтор рівня: пів-XP, без стата

  var pctScore = total? Math.round(correct/total*100) : 0;
  var stars = pctScore>=90?3 : pctScore>=70?2 : 1;
  var emoji = stars===3?'🏆':stars===2?'🌟':'💪';
  var head  = stars===3?'Бездоганно!':stars===2?'Молодець!':'Готово!';

  // зберігаємо зірки/пройдено/розблокування
  var starsMap=loadStars(); if((parseInt(starsMap[id],10)||0)<stars){ starsMap[id]=stars; saveJSON(lvKey('stars'),starsMap); }
  var doneMap=loadDone(); doneMap[id]=true; saveJSON(lvKey('done'),doneMap);

  var levels=levelsArr();
  var isLast=i>=levels.length-1;
  var statLine='';
  if(statGain>0){
    var lbl=STAT_LABEL[TEST.stat]||TEST.stat;
    var tracked=ACTIVE_STATS[TEST.stat];
    statLine='<div class="reward-line">✨ +'+fmt(statGain)+' до «'+esc(lbl)+'»'
      +(tracked?'':' <span class="muted">(поки не зберігається)</span>')+'</div>';
  }
  var nextBtn = isLast
    ? '<div class="reward-line" style="color:var(--gold)">🎉 Це був останній рівень!</div>'
      +'<button class="btn" id="menuBtn">🏆 До рівнів</button>'
    : '<button class="btn" id="nextBtn">Наступний рівень →</button>'
      +'<button class="btn ghost" id="menuBtn">← Усі рівні</button>';

  root.innerHTML='<div class="card center">'
    +'<div class="quiz-lvl" style="text-align:center">Рівень '+(i+1)+' · '+esc((levels[i]||{}).name||'')+'</div>'
    +'<div class="result-emoji">'+emoji+'</div>'
    +'<div class="result-title">'+head+'</div>'
    +'<div class="result-score">'+correct+' з '+total+' правильно · '+'⭐'.repeat(stars)+'</div>'
    +'<div class="result-xp">+'+fmt(xpGain)+' XP'+(replay?' <span class="muted" style="font-size:.8rem">(повтор)</span>':'')+'</div>'
    +statLine
    +'<div id="saveNote" class="muted" style="margin:8px 0 2px">'+(HERO_SESSION?'💾 Зберігаємо…':'ℹ️ Увійди Героєм, щоб зберегти нагороду')+'</div>'
    +nextBtn
    +'</div>';

  var nb=document.getElementById('nextBtn'); if(nb) nb.onclick=function(){ startLevel(i+1); };
  var mb=document.getElementById('menuBtn'); if(mb) mb.onclick=levelMenu;

  if(HERO_SESSION) saveReward(xpGain, statGain);
}

function saveReward(xpGain, statGain){
  SK.getHero().then(function(h){
    h=h||{};
    var curXp=num(h.xp);
    var newXp=curXp+xpGain;
    var curLevel=parseInt(h.level,10); if(isNaN(curLevel)) curLevel=1;
    var newLevel=Math.max(curLevel, Math.floor(newXp/100)+1);   // 100 XP на рівень (як у hero.html)
    var patch={ xp:newXp, level:newLevel };

    var key=TEST.stat;
    if(statGain>0 && ACTIVE_STATS[key]){
      var cur = (h[key]!=null) ? num(h[key]) : (STAT_BASE[key]||0);
      patch[key]=cur+statGain;
    }
    return SK.saveHeroStats(patch);
  }).then(function(){
    // тягнемо прогрес рівнів у heroes/{id}.progress одразу (не чекаючи visibilitychange)
    if(IS_LEVELS && SK.pushLocal) SK.pushLocal().catch(function(){});
    var n=document.getElementById('saveNote'); if(n){ n.textContent='✅ Збережено!'; n.style.color='#69DB7C'; }
  }).catch(function(){
    var n=document.getElementById('saveNote'); if(n){ n.textContent='⚠️ Не вдалося зберегти. Спробуй ще раз пізніше.'; n.style.color='#ffb3b4'; }
  });
}

/* старт: дочекатись SK, завантажити тест */
(function whenSK(){
  var tries=0;
  (function tick(){
    if(window.SK && SK.ready){
      SK.ready.then(function(){
        HERO_SESSION = !!(SK.isHeroSession && SK.isHeroSession());
        var id=getId();
        if(!id){ errorScreen('Не вказано тест (немає ?id у посиланні).'); return; }
        SK.getTest(id).then(function(t){
          if(!t){ errorScreen('Тест не знайдено або його вимкнено.'); return; }
          if(t.active===false){ errorScreen('Цей тест зараз неактивний.'); return; }
          if(isLevels(t)){
            var ls=Array.isArray(t.levels)?t.levels:[];
            var has=ls.some(function(L){ return L&&Array.isArray(L.questions)&&L.questions.length; });
            if(!ls.length || !has){ errorScreen('У тесті поки немає рівнів із питаннями.'); return; }
          } else {
            if(!Array.isArray(t.questions) || !t.questions.length){ errorScreen('У тесті поки немає питань.'); return; }
          }
          TEST=t;
          IS_LEVELS=isLevels(t);
          intro();
        }).catch(function(){ errorScreen('Помилка завантаження тесту.'); });
      });
      return;
    }
    if(tries++<100) setTimeout(tick,50);
    else errorScreen('Не вдалося підключитися до бази.');
  })();
})();

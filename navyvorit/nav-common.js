/* ============================================================
   Світ навиворіт — спільний каркас нових ігор серії.

   Підключення (після sk-footer.js, до власного скрипта гри):
     <link rel="stylesheet" href="nav-common.css">
     <script src="../sk-footer.js?v=5" data-base="../" data-back="self"></script>
     <script src="nav-common.js"></script>

   NAV.mount({ ... }) будує сторінку: верхня панель (крок, значок
   напрямку, меню), підказка, сцена (cfg.scene — HTML), панель дій,
   стартовий і фінальний екрани (cfg.next — куди веде «Вирушай далі! ›»), модалка (поза #wrap!). Далі гра
   користується помічниками NAV.* (hint, step, question, actions,
   modal, setFlip, miss, finish, snd).

   Нагорода з адмінки — через sk-prize.js (SKPRIZE), як в інших іграх.
   ============================================================ */
(function(){
  "use strict";
  var NAV = { mistakes:0, busy:true, flipped:false };
  var cfg = null;
  function $(id){ return document.getElementById(id); }
  function el(tag, cls, html){ var d = document.createElement(tag); if(cls) d.className = cls; if(html != null) d.innerHTML = html; return d; }
  NAV.$ = $; NAV.el = el;
  NAV.rnd = function(a,b){ return a + Math.floor(Math.random()*(b-a+1)); };
  NAV.pick = function(a){ return a[NAV.rnd(0, a.length-1)]; };
  NAV.shuffle = function(a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var x=a[i]; a[i]=a[j]; a[j]=x; } return a; };
  NAV.later = function(fn, ms){ return setTimeout(fn, ms); };

  /* ── звук ── */
  var actx = null;
  function tone(f, d, type, vol){ try{
    if(!actx) actx = new (window.AudioContext||window.webkitAudioContext)();
    var o = actx.createOscillator(), g = actx.createGain();
    o.type = type||"triangle"; o.frequency.value = f; g.gain.value = vol||0.06;
    o.connect(g); g.connect(actx.destination); o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime+d); o.stop(actx.currentTime+d+0.02);
  }catch(e){} }
  NAV.snd = {
    tone: tone,
    tap: function(){ tone(520,0.05); },
    chime: function(){ tone(660,0.09); setTimeout(function(){ tone(880,0.11); },90); },
    thud: function(){ tone(180,0.16,"sine"); },
    whoosh: function(){ tone(650,0.2,"sine"); setTimeout(function(){ tone(450,0.2,"sine"); },180); setTimeout(function(){ tone(300,0.25,"sine"); },360); },
    fanfare: function(){ tone(523,0.12); setTimeout(function(){ tone(659,0.12); },120); setTimeout(function(){ tone(784,0.14); },240); setTimeout(function(){ tone(1046,0.18); },380); }
  };
  NAV.buzz = function(v){ try{ if(navigator.vibrate) navigator.vibrate(v); }catch(e){} };

  /* ── каркас сторінки ── */
  NAV.mount = function(c){
    cfg = c;
    var wrap = el("div"); wrap.id = "wrap";
    wrap.innerHTML =
      '<div id="top"><div class="pill"><span class="lab">'+(c.stepLabel||"Крок")+'</span><span class="val" id="qNum">1/'+(c.steps||1)+'</span></div>'+
        '<div id="dirBadge">'+(c.badgeOff||"⏩ звичайний світ")+'</div><div id="spacer"></div><button id="menuBtn" type="button">☰ Меню</button></div>'+
      '<div id="barWrap"><div id="bar"><div id="barFill"></div></div></div>'+
      '<div id="main"><div id="hint"></div><div id="scene">'+(c.scene||"")+'</div>'+(c.afterScene||"")+'<div id="panel"></div></div>'+
      '<div class="screen" id="startScreen">'+
        '<div class="start-top"><button class="iconbtn backbtn" type="button" title="Назад" aria-label="Назад">←</button></div>'+
        '<div class="big-emoji">'+c.emoji+'</div><h1>'+c.title+'</h1><p class="start-sub">'+c.sub+'</p>'+
        '<div class="riddle">'+c.riddle+'</div>'+
        '<div class="done-card" id="startDone"><span class="dc-ic">🏆</span><div><div class="dc-got" id="doneGot">Пройдено!</div><div class="dc-go" id="doneGo">Вирушай за новими досягненнями!</div></div></div>'+
        '<button class="big-btn" id="playBtn" type="button">'+(c.play||"Грати ▶")+'</button></div>'+
      '<div class="screen hidden" id="winScreen"><div class="crown">'+(c.crown||"🏆")+'</div>'+
        '<div class="title" id="winTitle"></div><div class="stars" id="winStars">⭐⭐⭐</div><div class="sub" id="winSub"></div>'+
        '<div class="lesson">'+(c.lessonHead||"Що ти дізнався(-лася):")+'<ol>'+c.lesson.map(function(x){ return "<li>"+x+"</li>"; }).join("")+'</ol></div>'+
        '<div class="winrow">'+(c.next ? '<a class="cta" id="nextBtn" href="'+c.next+'">'+(c.nextText||"Вирушай далі! ›")+'</a>'
          : '<button class="cta" id="againBtn" type="button">↻ Ще раз</button>')+'</div>'+
        '<div class="winrow"><a class="linkbtn" href="index.html">🗺️ На карту</a><button class="linkbtn" id="toMenuBtn" type="button">☰ У меню</button></div></div>';
    var footer = document.querySelector('script[src*="sk-footer.js"]');
    document.body.insertBefore(wrap, footer || document.body.firstChild);
    var modal = el("div","modal hidden"); modal.id = "modal";
    modal.innerHTML = '<div class="mcard" id="mCard"><div class="big" id="mBig"></div><div class="mt" id="mTitle"></div><div class="mb" id="mBody"></div><button class="next" id="mBtn" type="button">Далі →</button></div>';
    document.body.insertBefore(modal, footer || null);

    document.querySelectorAll(".backbtn").forEach(function(b){ b.addEventListener("click", goBack); });
    var hb = $("heroBackBtn");
    if(hb) hb.addEventListener("click", function(){ if($("startScreen").classList.contains("hidden")) openMenu(); else goBack(); });
    $("menuBtn").addEventListener("click", openMenu);
    $("toMenuBtn").addEventListener("click", openMenu);
    $("playBtn").addEventListener("click", start);
    if($("againBtn")) $("againBtn").addEventListener("click", start);
    $("mBtn").addEventListener("click", function(){
      $("modal").classList.add("hidden"); NAV.snd.tap();
      if(modalNext){ var n = modalNext; modalNext = null; n(); }
    });
    refreshStart();
    window.addEventListener("load", refreshStart);   // sk-prize.js підключено нижче
  };

  function goBack(){
    if(window.skGoBackSmart){ skGoBackSmart("navyvorit/index.html"); return; }
    location.href = "index.html";
  }
  function openMenu(){
    NAV.busy = true;
    refreshStart();
    $("modal").classList.add("hidden");
    $("winScreen").classList.add("hidden");
    $("startScreen").classList.remove("hidden");
  }
  function start(){
    NAV.mistakes = 0; NAV.busy = false; NAV.setFlip(false);
    $("modal").classList.add("hidden");
    $("startScreen").classList.add("hidden");
    $("winScreen").classList.add("hidden");
    $("panel").innerHTML = "";
    cfg.onStart();
  }
  function refreshStart(){
    var p = window.SKPRIZE ? SKPRIZE.summary(cfg.prizeKey) : null;
    $("startDone").classList.toggle("on", !!p);
    if(!p) return;
    var t = SKPRIZE.doneText(p, cfg.doneText || "Гру пройдено — нагороду отримано!");
    $("doneGot").textContent = t.got;
    $("doneGo").textContent = t.go;
  }

  /* ── помічники гри ── */
  NAV.hint = function(t, cls){ var h = $("hint"); h.className = cls||""; h.innerHTML = t; };
  NAV.step = function(i, total){
    $("qNum").textContent = Math.min(i+1, total) + "/" + total;
    $("barFill").style.width = (i/total*100) + "%";
  };
  NAV.setFlip = function(on){
    NAV.flipped = on;
    document.body.classList.toggle("flipped", on);
    $("dirBadge").textContent = on ? (cfg.badgeOn||"🔄 навиворіт") : (cfg.badgeOff||"⏩ звичайний світ");
    if(cfg.onFlip) cfg.onFlip(on);
  };
  NAV.flipAnim = function(){ var s = $("scene"); s.classList.remove("flipanim"); void s.offsetWidth; s.classList.add("flipanim"); };
  NAV.shake = function(){ var s = $("scene"); s.classList.remove("shake"); void s.offsetWidth; s.classList.add("shake"); };
  NAV.miss = function(t){ NAV.mistakes++; NAV.snd.thud(); NAV.buzz(40); NAV.shake(); NAV.hint(t, "bad"); };

  var modalNext = null;
  /* opt: {nav:true — фіолетова «навиворіт»-модалка, btn:"текст кнопки"} */
  NAV.modal = function(big, title, body, opt, next){
    opt = opt || {};
    $("mBig").textContent = big; $("mTitle").textContent = title; $("mBody").innerHTML = body;
    $("mBtn").textContent = opt.btn || "Далі →";
    $("mCard").classList.toggle("navm", !!opt.nav);
    modalNext = next; $("modal").classList.remove("hidden");
  };

  /* питання з варіантами: opts = [{tx, ok:true} | {tx, why:"пояснення помилки"}] */
  NAV.question = function(q, opts, onOk, o){
    o = o || {};
    NAV.busy = false;
    var panel = $("panel"); panel.innerHTML = "";
    if(q) panel.appendChild(el("div","q",q));
    var box = el("div","opts"+(o.big?" big":""));
    box.style.setProperty("--cols", o.cols || 1);
    (o.keepOrder ? opts.slice() : NAV.shuffle(opts.slice())).forEach(function(op){
      var b = el("button","opt",op.tx); b.type = "button";
      b.addEventListener("click", function(){
        if(NAV.busy || b.disabled) return;
        if(!op.ok){ b.classList.add("bad"); b.disabled = true; NAV.miss(op.why || "Не так. Подумай ще!"); return; }
        b.classList.add("good"); NAV.snd.chime(); NAV.busy = true;
        Array.prototype.forEach.call(box.children, function(x){ x.disabled = true; });
        onOk(op);
      });
      box.appendChild(b);
    });
    panel.appendChild(box);
    setTimeout(function(){ panel.scrollIntoView({behavior:"smooth", block:"end"}); }, 60);
  };

  /* кнопки дій: list = [{id, ic, tx, cls, fn}] → повертає {id: кнопка} */
  NAV.actions = function(list, cols, append){
    var panel = $("panel"); if(!append) panel.innerHTML = "";
    var box = el("div","acts"); box.style.setProperty("--cols", cols || list.length);
    var map = {};
    list.forEach(function(a){
      var b = el("button","act"+(a.cls?" "+a.cls:""),'<span class="ic">'+a.ic+'</span>'+a.tx); b.type = "button";
      b.addEventListener("click", function(){ if(NAV.busy || b.disabled) return; NAV.snd.tap(); a.fn(b); });
      box.appendChild(b); map[a.id || a.tx] = b;
    });
    panel.appendChild(box);
    return map;
  };

  NAV.finish = function(){
    NAV.busy = true; NAV.snd.fanfare();
    $("barFill").style.width = "100%";
    var m = NAV.mistakes;
    $("winStars").textContent = m===0 ? "⭐⭐⭐" : (m<=3 ? "⭐⭐" : "⭐");
    $("winTitle").textContent = m===0 ? (cfg.winPerfect || "Без жодної помилки!") : (cfg.winTitle || "Пройдено!");
    $("winSub").textContent = m===0 ? (cfg.winPerfectSub || "Ти справжній знавець Світу навиворіт!") : "Помилок: "+m+". Але загадку розгадано!";
    $("winScreen").classList.remove("hidden");
    try{ localStorage.setItem("sk_navyvorit_done_"+cfg.href, "1"); }catch(e){}   // позначка для карти: наступний пункт відкривається
    if(window.SKPRIZE && !SKPRIZE.summary(cfg.prizeKey))
      SKPRIZE.claim({ key: cfg.prizeKey, href: cfg.href, title: cfg.winTitle || "Пройдено!", onClose: refreshStart });
  };

  window.NAV = NAV;
})();

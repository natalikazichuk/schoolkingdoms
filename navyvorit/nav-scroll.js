/* ============================================================
   nav-scroll.js — стартовий екран гри Світу навиворіт «як у Будинку,
   якого немає»: картинка на весь екран, назва в дерев'яній табличці,
   загадка на сувої з лупою, кругла кнопка ➜ у листі в кутку сувою.
   Сувій, лупа, кнопки — спільні (img/budynok-yakoho-nemaye/), табличка
   й картинка — свої в кожної гри.

   Підключення (після розмітки / NAV.mount, перед nav-intro.js):
     <link rel="stylesheet" href="nav-scroll.css">
     <script src="nav-scroll.js"></script>
     <script>NAVSCROLL.init({bg:"img/kit/start-hero.webp", frame:"img/kit/title-frame.webp",
       focus:[0.1, 1], top:"#5d2e22", bot:"#6b3f22", play:"До скринь"});</script>
   focus — смуга картинки (частки висоти), що має стати між табличкою і сувоєм;
   top / bot — колір неба / підлоги над і під картинкою.
   ============================================================ */
(function(){
  'use strict';
  var cfg = null, img = null;
  function $(id){ return document.getElementById(id); }

  function init(c){
    var s = $("startScreen"), rd = s && s.querySelector(".riddle"), play = $("playBtn");
    if(!s || !rd || !play) return;
    cfg = c;
    document.body.classList.add("navscroll");
    s.classList.add("picbg", "scrolled");
    /* назва — у табличці */
    var h1 = s.querySelector("h1"), tb = s.querySelector(".titlebox");
    if(!tb){ tb = document.createElement("div"); tb.className = "titlebox"; h1.parentNode.insertBefore(tb, h1); tb.appendChild(h1); }
    tb.style.backgroundImage = "url("+c.frame+")";
    var em = s.querySelector(".big-emoji, .start-pic"); if(em) em.remove();
    /* загадка, «пройдено» і кнопка — на сувої */
    var box = document.createElement("div"); box.className = "rbox"; box.innerHTML = '<span class="mag" aria-hidden="true"></span>';
    rd.parentNode.insertBefore(box, rd);
    box.appendChild(rd);
    var done = $("startDone"); if(done) box.appendChild(done);
    box.appendChild(play);
    play.className = "go-btn"; play.textContent = "➜";
    if(c.play){ play.title = c.play; play.setAttribute("aria-label", c.play); }
    /* фінальний екран — картинка гри позаду (притемнена), свої картинки замість емодзі */
    var win = $("winScreen");
    if(win){
      win.style.backgroundImage = "linear-gradient(180deg,rgba(25,12,35,.35),rgba(25,12,35,.55)), url("+(c.winBg || c.bg)+")";
      var cr = win.querySelector(".crown");
      if(cr && c.winImg) cr.innerHTML = [].concat(c.winImg).map(function(u){ return '<img src="'+u+'" alt="">'; }).join("");
    }
    img = new Image(); img.onload = fit; img.src = c.bg;
    window.addEventListener("resize", fit);
    window.addEventListener("load", fit);
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    new MutationObserver(function(){ fit(); }).observe(s, {attributes:true, attributeFilter:["class"]});   // повернулися в меню — перерахувати
  }

  /* картинку масштабуємо так, щоб смуга focus стала між табличкою і сувоєм; над і під нею — колір неба / підлоги з м'яким переходом */
  function fit(){
    var s = $("startScreen");
    if(!s || !img || !img.naturalWidth || s.classList.contains("hidden")) return;
    var tb = s.querySelector(".titlebox"), box = s.querySelector(".rbox");
    var sr = s.getBoundingClientRect(), W = s.clientWidth, H = s.clientHeight, ar = img.naturalWidth / img.naturalHeight;
    var top = tb.getBoundingClientRect().bottom - sr.top + 4, bot = box.getBoundingClientRect().top - sr.top + 10;
    var f1 = cfg.focus[0], f2 = cfg.focus[1], V = Math.max(80, bot - top);
    var h = V / (f2 - f1), w = h * ar;
    if(w < W){ w = W; h = W / ar; }
    var y = top - f1*h + (V - (f2 - f1)*h) / 2, x = (W - w) / 2, F = 60;
    var T = cfg.top, B = cfg.bot;
    s.style.backgroundImage =
      "linear-gradient(180deg,"+T+","+T+"00), linear-gradient(180deg,"+B+"00,"+B+"), url("+cfg.bg+"), linear-gradient(180deg,"+T+" 0 "+Math.round(y + h/2)+"px,"+B+" "+Math.round(y + h/2)+"px 100%)";
    s.style.backgroundSize = Math.round(w)+"px "+F+"px, "+Math.round(w)+"px "+F+"px, "+Math.round(w)+"px "+Math.round(h)+"px, 100% "+Math.max(H, s.scrollHeight)+"px";
    s.style.backgroundPosition = Math.round(x)+"px "+Math.round(y)+"px, "+Math.round(x)+"px "+Math.round(y + h - F)+"px, "+Math.round(x)+"px "+Math.round(y)+"px, 0 0";
    s.style.backgroundRepeat = "no-repeat";
  }

  window.NAVSCROLL = {init:init, fit:fit};
})();

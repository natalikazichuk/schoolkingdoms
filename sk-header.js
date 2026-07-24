/* ============================================================
   SK-HEADER — СПІЛЬНИЙ хедер для всіх сторінок School Kingdoms.
   Малює бренд + шкалу характеристик активного Героя (читає з Firebase).
   Єдине джерело правди: правки хедера — лише тут.

   Підключення на сторінці (один раз, наприкінці <body>):
     <script>window.SK_HEADER_SUB = 'Тести королівства';</script>  // опційно
     <script src="sk-header.js"></script>                          // із підпапки: ../sk-header.js

   Хедер вставляється першим елементом <body> (або в <div id="sk-header">,
   якщо такий є). Дані підтягуються, коли зʼявиться window.SK (firebase-config.js).
   Якщо це не сесія Героя — показуємо запрошення увійти.
   ============================================================ */
(function(){
  'use strict';
  if (window.__skHeaderMounted) return;         // не дублювати
  window.__skHeaderMounted = true;

  var SUB = (window.SK_HEADER_SUB || 'Вивчай, грай, досягай');

  /* Базовий шлях беремо з src самого скрипта, щоб логотип знаходився
     і з кореня, і з підпапки (../sk-header.js). */
  var BASE = (function(){
    var cur = document.currentScript;
    if(!cur){
      var ss = document.getElementsByTagName('script');
      for(var i=ss.length-1;i>=0;i--){
        if((ss[i].getAttribute('src')||'').indexOf('sk-header.js') > -1){ cur = ss[i]; break; }
      }
    }
    return ((cur && cur.getAttribute('src')) || '').replace(/sk-header\.js.*$/, '');
  })();

  function esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  /* ── стилі (додаємо один раз) ──
     ЄДИНИЙ СТАНДАРТ ХЕДЕРА. Ті самі значення продубльовані в sk-styles.css
     (.topbar / .brand / .brand-name / .brand-sub / .logo-img) для сторінок,
     які не використовують sk-header.js. Міняєш тут — міняй і там. */
  if(!document.getElementById('sk-hd-css')){
    var css = document.createElement('style');
    css.id = 'sk-hd-css';
    css.textContent =
      '.sk-hd{position:relative;z-index:20;display:flex;align-items:center;gap:14px 20px;flex-wrap:wrap;'
        +'justify-content:space-between;padding:10px 18px;'
        +'background:linear-gradient(180deg,#1e3a6b,#16294f);border-bottom:3px solid #e0a42a;'
        +'box-shadow:0 6px 20px rgba(0,0,0,.35)}'
      +'.sk-hd__brand{display:flex;align-items:center;gap:11px;text-decoration:none;min-width:0;flex:0 1 auto}'
      +'.sk-hd__brand:hover .sk-hd__name{filter:brightness(1.08)}'
      +'.sk-hd__logo{width:clamp(86px,14vw,112px);height:auto;display:block;flex-shrink:0;'
        +'filter:drop-shadow(0 3px 6px rgba(0,0,0,.4))}'
      +'.sk-hd__crest{font-size:1.7rem;filter:drop-shadow(0 2px 4px rgba(0,0,0,.45))}'
      +'.sk-hd__name{font-family:"Playfair Display",Georgia,serif;font-weight:900;line-height:1.05;'
        +'white-space:nowrap;font-size:clamp(1.05rem,3.4vw,1.5rem);color:#fff;'
        +'text-shadow:0 2px 5px rgba(0,0,0,.45)}'
      +'.sk-hd__name b{color:#F2C75C}'
      +'.sk-hd__sub{display:block;font-size:.64rem;letter-spacing:.13em;text-transform:uppercase;'
        +'white-space:nowrap;color:#ffe9b8;font-weight:800;margin-top:3px}'
      /* шкала Героя */
      +'.sk-hd__strip{flex:1 1 auto;min-width:240px;display:none;align-items:center;gap:10px 14px;'
        +'flex-wrap:wrap;justify-content:flex-end}'
      +'.sk-hd__strip.on{display:flex}'
      /* wrap, а НЕ overflow-x:auto — інакше на телефоні 5 плашок не влазять
         у рядок і крайні просто обрізаються (було видно лише частину шкали). */
      +'.sk-hd__stats{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;'
        +'max-width:100%}'
      +'.sk-hd__stat{display:inline-flex;align-items:center;gap:6px;background:rgba(0,0,0,.24);'
        +'border:1px solid rgba(242,199,92,.42);border-radius:999px;padding:4px 11px;'
        +'font-weight:800;font-size:.82rem;color:#eaf1ff;white-space:nowrap}'
      +'.sk-hd__stat b{color:#F2C75C}'
      /* гість */
      +'.sk-hd__guest{display:none;font-weight:700;font-size:.82rem;color:#dce6f7}'
      +'.sk-hd__guest.on{display:inline-block}'
      +'.sk-hd__guest a{color:#F2C75C;font-weight:800}'
      +'@media(max-width:640px){'
        +'.sk-hd{justify-content:center;text-align:center;padding:10px 10px 8px}'
        +'.sk-hd__strip{min-width:0;width:100%;justify-content:center}'
        +'.sk-hd__stats{justify-content:center;gap:5px}'
        +'.sk-hd__stat{padding:3px 9px;font-size:.76rem;gap:4px}'
      +'}'
      /* дуже вузькі екрани — ще менше, решта переноситься на другий рядок */
      +'@media(max-width:360px){'
        +'.sk-hd__stat{padding:3px 7px;font-size:.72rem;gap:3px}'
        +'.sk-hd__stats{gap:4px}'
      +'}';
    document.head.appendChild(css);
  }

  /* ── розмітка хедера ── */
  var hd = document.createElement('header');
  hd.className = 'sk-hd';
  hd.innerHTML =
    '<a class="sk-hd__brand" href="hero.html" aria-label="SchoolKingdoms — до Героя">'
      +'<img class="sk-hd__logo" src="'+BASE+'logo-small.png" alt="" '
        +'onerror="this.style.display=&#39;none&#39;;this.nextElementSibling.style.display=&#39;inline-block&#39;">'
      +'<span class="sk-hd__crest" style="display:none">🛡️</span>'
      +'<span><span class="sk-hd__name">School<b>Kingdoms</b></span>'
      +'<span class="sk-hd__sub">'+esc(SUB)+'</span></span>'
    +'</a>'
    +'<div class="sk-hd__strip" id="skHdStrip">'
      +'<div class="sk-hd__stats" id="skHdStats"></div>'
    +'</div>'
    +'<span class="sk-hd__guest" id="skHdGuest">Увійди як '
      +'<a href="login.html?next=hero">Герой</a>, щоб бачити характеристики.</span>';

  var mount = document.getElementById('sk-header');
  if(mount){ mount.parentNode.replaceChild(hd, mount); }
  else { document.body.insertBefore(hd, document.body.firstChild); }

  function showGuest(){
    var g = document.getElementById('skHdGuest');
    if(g) g.classList.add('on');
  }

  /* ── заповнити шкалу з Firebase ── */
  var tries = 0;
  (function whenSK(){
    if(window.SK && SK.ready){
      SK.ready.then(function(){
        try{
          if(SK.isHeroSession && SK.isHeroSession() && SK.getHero){
            SK.getHero().then(function(h){
              if(!h){ showGuest(); return; }
              var stats = [
                {k:'❤️', v:h.health},
                {k:'🔮', v:h.mana},
                {k:'🏃', v:h.agility},
                {k:'🎯', v:h.accuracy},
                {k:'⭐', v:h.xp}
              ];
              var box = document.getElementById('skHdStats');
              if(box) box.innerHTML = stats.map(function(s){
                return '<span class="sk-hd__stat">'+s.k+' <b>'+(s.v!=null?s.v:0)+'</b></span>';
              }).join('');
              var strip = document.getElementById('skHdStrip');
              if(strip) strip.classList.add('on');
            }).catch(showGuest);
          } else {
            showGuest();
          }
        }catch(e){ showGuest(); }
      });
      return;
    }
    if(tries++ < 100) setTimeout(whenSK, 50);
  })();
})();

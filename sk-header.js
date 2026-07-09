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

  var SUB = (window.SK_HEADER_SUB || 'My Skills Kingdom');

  function esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  /* ── стилі (додаємо один раз) ── */
  if(!document.getElementById('sk-hd-css')){
    var css = document.createElement('style');
    css.id = 'sk-hd-css';
    css.textContent =
      '.sk-hd{position:relative;z-index:20;display:flex;align-items:center;gap:14px 20px;flex-wrap:wrap;'
        +'justify-content:space-between;padding:10px 18px;'
        +'background:linear-gradient(180deg,#1e3a6b,#16294f);border-bottom:3px solid #e0a42a;'
        +'box-shadow:0 6px 20px rgba(0,0,0,.35)}'
      +'.sk-hd__brand{display:flex;align-items:center;gap:11px;text-decoration:none;flex-shrink:0}'
      +'.sk-hd__brand:hover .sk-hd__name{filter:brightness(1.08)}'
      +'.sk-hd__crest{font-size:1.7rem;filter:drop-shadow(0 2px 4px rgba(0,0,0,.45))}'
      +'.sk-hd__name{font-family:"Playfair Display",Georgia,serif;font-weight:900;line-height:1.05;'
        +'font-size:clamp(1.1rem,2.6vw,1.5rem);color:#fff;text-shadow:0 2px 5px rgba(0,0,0,.45)}'
      +'.sk-hd__name b{color:#F2C75C}'
      +'.sk-hd__sub{display:block;font-size:.64rem;letter-spacing:.13em;text-transform:uppercase;'
        +'color:#ffe9b8;font-weight:800;margin-top:2px}'
      /* шкала Героя */
      +'.sk-hd__strip{flex:1 1 auto;min-width:240px;display:none;align-items:center;gap:10px 14px;'
        +'flex-wrap:wrap;justify-content:flex-end}'
      +'.sk-hd__strip.on{display:flex}'
      +'.sk-hd__who{font-family:"Playfair Display",Georgia,serif;font-weight:800;color:#FBEFD0;'
        +'font-size:.95rem;white-space:nowrap}'
      +'.sk-hd__stats{display:flex;flex-wrap:wrap;gap:7px;justify-content:flex-end}'
      +'.sk-hd__stat{display:inline-flex;align-items:center;gap:6px;background:rgba(0,0,0,.24);'
        +'border:1px solid rgba(242,199,92,.42);border-radius:999px;padding:4px 11px;'
        +'font-weight:800;font-size:.82rem;color:#eaf1ff;white-space:nowrap}'
      +'.sk-hd__stat b{color:#F2C75C}'
      /* гість */
      +'.sk-hd__guest{display:none;font-weight:700;font-size:.82rem;color:#dce6f7}'
      +'.sk-hd__guest.on{display:inline-block}'
      +'.sk-hd__guest a{color:#F2C75C;font-weight:800}'
      +'@media(max-width:640px){'
        +'.sk-hd{justify-content:center;text-align:center}'
        +'.sk-hd__strip{min-width:0;width:100%;justify-content:center}'
        +'.sk-hd__stats{justify-content:center}'
      +'}';
    document.head.appendChild(css);
  }

  /* ── розмітка хедера ── */
  var hd = document.createElement('header');
  hd.className = 'sk-hd';
  hd.innerHTML =
    '<a class="sk-hd__brand" href="hero.html" aria-label="School Kingdoms — до Героя">'
      +'<span class="sk-hd__crest">🛡️</span>'
      +'<span><span class="sk-hd__name">School <b>Kingdoms</b></span>'
      +'<span class="sk-hd__sub">'+esc(SUB)+'</span></span>'
    +'</a>'
    +'<div class="sk-hd__strip" id="skHdStrip">'
      +'<span class="sk-hd__who" id="skHdWho">Герой</span>'
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
              var who = document.getElementById('skHdWho');
              if(who) who.textContent = '🦁 ' + (h.name||'Герой') + ' · рівень ' + (h.level||1);
              var stats = [
                {k:'❤️ Здоров\u2019я', v:h.health},
                {k:'🔮 Мана',       v:h.mana},
                {k:'🏃 Спритність',  v:h.agility},
                {k:'🎯 Точність',    v:h.accuracy},
                {k:'⭐ XP',          v:h.xp}
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

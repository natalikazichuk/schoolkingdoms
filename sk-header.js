/* ============================================================
   SK-HEADER — СПІЛЬНИЙ хедер для всіх сторінок School Kingdoms.
   Малює бренд + навігацію (ступені → класи → предмети) + шкалу
   характеристик активного Героя (читає з Firebase).
   Єдине джерело правди: правки хедера — лише тут.

   Навігація будується з КАРТИ КОРОЛІВСТВА (SKCUR / sk-curriculum.js),
   тобто з того самого джерела, що й дорожня карта на tests.html.
   Якщо на сторінці немає sk-curriculum.js — хедер підвантажує його сам.

   Активним виглядає той ступінь, у якому клас активного Героя
   (heroes/{id}.grade → tier.grades[].gradeNum).

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

  /* Базовий шлях беремо з src самого скрипта, щоб логотип (і sk-curriculum.js)
     знаходились і з кореня, і з підпапки (../sk-header.js). */
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
  /* значення для href-хеша: пробіли/& тощо кодуємо, щоб хеш не ламався */
  function enc(s){ return encodeURIComponent(String(s==null?'':s)); }

  /* ── стилі (додаємо один раз) ──
     ЄДИНИЙ СТАНДАРТ ХЕДЕРА. Ті самі значення продубльовані в sk-styles.css
     (.topbar / .brand / .brand-name / .brand-sub / .logo-img) для сторінок,
     які не використовують sk-header.js. Міняєш тут — міняй і там. */
  if(!document.getElementById('sk-hd-css')){
    var css = document.createElement('style');
    css.id = 'sk-hd-css';
    css.textContent =
      '.sk-hd{position:relative;z-index:20;display:flex;align-items:center;gap:12px 18px;flex-wrap:wrap;'
        +'justify-content:space-between;padding:10px 18px;'
        +'background:linear-gradient(180deg,#1e3a6b,#16294f);border-bottom:3px solid #e0a42a;'
        +'box-shadow:0 6px 20px rgba(0,0,0,.35)}'
      +'.sk-hd__brand{display:flex;align-items:center;gap:11px;text-decoration:none;min-width:0;flex:0 0 auto}'
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

      /* ── НАВІГАЦІЯ: ступені → класи → предмети ── */
      +'.sk-hd__nav{flex:0 1 auto;display:flex;align-items:center;gap:6px;flex-wrap:wrap;'
        +'min-width:0;justify-content:center}'
      +'.sk-hd__nav[hidden]{display:none}'
      +'.sk-hd__ni{position:relative}'
      +'.sk-hd__nbtn{display:inline-flex;align-items:center;gap:6px;cursor:pointer;'
        +'font-family:inherit;font-weight:800;font-size:.9rem;color:#eaf1ff;white-space:nowrap;'
        +'background:rgba(0,0,0,.18);border:1px solid rgba(242,199,92,.28);border-radius:999px;'
        +'padding:7px 14px;transition:background .15s,border-color .15s,color .15s}'
      +'.sk-hd__nbtn:hover{background:rgba(0,0,0,.30);border-color:rgba(242,199,92,.55)}'
      +'.sk-hd__nbtn .sk-hd__car{font-size:.72rem;color:#f0d9a6;transition:transform .2s}'
      +'.sk-hd__ni.open .sk-hd__nbtn .sk-hd__car{transform:rotate(180deg)}'
      +'.sk-hd__ni.open .sk-hd__nbtn{background:rgba(0,0,0,.34);border-color:rgba(242,199,92,.6)}'
      /* активний ступінь (клас Героя) */
      +'.sk-hd__ni.active .sk-hd__nbtn{background:linear-gradient(180deg,#F2C75C,#E0A42A);'
        +'color:#3a2708;border-color:#c9942f;box-shadow:0 2px 8px -2px rgba(224,164,42,.7)}'
      +'.sk-hd__ni.active .sk-hd__nbtn .sk-hd__car{color:#3a2708}'
      /* ступінь «скоро» — приглушений */
      +'.sk-hd__nbtn.soon{opacity:.7}'

      /* випадаюче меню */
      +'.sk-hd__menu{position:absolute;top:calc(100% + 8px);left:0;z-index:60;min-width:230px;'
        +'max-width:min(340px,92vw);background:linear-gradient(180deg,#20386a,#182b52);'
        +'border:1px solid rgba(242,199,92,.4);border-radius:16px;padding:10px;'
        +'box-shadow:0 16px 40px rgba(0,0,0,.5);display:none}'
      +'.sk-hd__ni.open .sk-hd__menu{display:block;animation:skHdDrop .16s ease-out}'
      +'@keyframes skHdDrop{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}'
      +'.sk-hd__mhead{display:flex;align-items:center;gap:8px;padding:2px 6px 8px;'
        +'border-bottom:1px solid rgba(255,255,255,.12);margin-bottom:6px}'
      +'.sk-hd__mhead .ic{font-size:1.2rem}'
      +'.sk-hd__mhead .nm{font-family:"Playfair Display",serif;font-weight:800;color:#FBEFD0;font-size:.98rem}'
      +'.sk-hd__mpill{margin-left:auto;font-size:.62rem;font-weight:800;letter-spacing:.04em;'
        +'text-transform:uppercase;border-radius:999px;padding:2px 8px}'
      +'.sk-hd__mpill.on{background:rgba(120,220,150,.16);color:#9be6b0;border:1px solid rgba(120,220,150,.4)}'
      +'.sk-hd__mpill.soon{background:rgba(255,255,255,.08);color:#c9cbe0;border:1px solid rgba(255,255,255,.2)}'
      /* клас */
      +'.sk-hd__grade{margin:6px 2px 2px}'
      +'.sk-hd__glab{display:flex;align-items:center;gap:6px;text-decoration:none;'
        +'font-weight:800;font-size:.82rem;color:#ffe08a;padding:4px 6px;border-radius:8px}'
      +'.sk-hd__glab:hover{background:rgba(255,224,138,.12)}'
      +'.sk-hd__glab.cur::after{content:"тут";margin-left:6px;font-size:.6rem;font-weight:800;'
        +'letter-spacing:.05em;text-transform:uppercase;color:#3a2708;background:#F2C75C;'
        +'border-radius:999px;padding:1px 7px}'
      /* предмети */
      +'.sk-hd__subs{display:flex;flex-direction:column;gap:2px;padding:2px 0 4px}'
      +'.sk-hd__sub{display:flex;align-items:center;gap:9px;text-decoration:none;color:#eaf1ff;'
        +'font-weight:700;font-size:.86rem;padding:7px 8px;border-radius:10px;'
        +'border-left:4px solid var(--ac,#5C6BC0);transition:background .12s}'
      +'.sk-hd__sub:hover{background:rgba(255,255,255,.08)}'
      +'.sk-hd__sub .sic{font-size:1.05rem;line-height:1;width:22px;text-align:center;flex-shrink:0}'
      +'.sk-hd__mnote{color:#c6d3ea;font-weight:600;font-size:.82rem;padding:6px 6px 4px;font-style:italic}'
      +'.sk-hd__mopen{display:block;margin-top:6px;text-align:center;text-decoration:none;'
        +'font-weight:800;font-size:.78rem;color:#5a3d08;'
        +'background:linear-gradient(180deg,#FFE7A0,#E0A93A);border:1.5px solid #C9942F;'
        +'border-radius:10px;padding:7px 10px}'

      /* шкала Героя */
      +'.sk-hd__strip{flex:1 1 auto;min-width:200px;display:none;align-items:center;gap:10px 14px;'
        +'flex-wrap:wrap;justify-content:flex-end}'
      +'.sk-hd__strip.on{display:flex}'
      +'.sk-hd__stats{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;max-width:100%}'
      +'.sk-hd__stat{display:inline-flex;align-items:center;gap:6px;background:rgba(0,0,0,.24);'
        +'border:1px solid rgba(242,199,92,.42);border-radius:999px;padding:4px 11px;'
        +'font-weight:800;font-size:.82rem;color:#eaf1ff;white-space:nowrap}'
      +'.sk-hd__stat b{color:#F2C75C}'
      /* гість */
      +'.sk-hd__guest{display:none;font-weight:700;font-size:.82rem;color:#dce6f7}'
      +'.sk-hd__guest.on{display:inline-block}'
      +'.sk-hd__guest a{color:#F2C75C;font-weight:800}'

      +'@media(max-width:760px){'
        +'.sk-hd__nav{width:100%;order:3;justify-content:center}'
        +'.sk-hd__menu{left:50%;transform:translateX(-50%)}'
        +'.sk-hd__ni.open .sk-hd__menu{animation:none}'
      +'}'
      +'@media(max-width:640px){'
        +'.sk-hd{justify-content:center;text-align:center;padding:10px 10px 8px}'
        +'.sk-hd__strip{min-width:0;width:100%;justify-content:center;order:4}'
        +'.sk-hd__stats{justify-content:center;gap:5px}'
        +'.sk-hd__stat{padding:3px 9px;font-size:.76rem;gap:4px}'
        +'.sk-hd__nbtn{font-size:.84rem;padding:6px 12px}'
      +'}'
      +'@media(max-width:360px){'
        +'.sk-hd__stat{padding:3px 7px;font-size:.72rem;gap:3px}'
        +'.sk-hd__stats{gap:4px}'
        +'.sk-hd__nbtn{font-size:.8rem;padding:5px 10px}'
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
    +'<nav class="sk-hd__nav" id="skHdNav" aria-label="Класи та предмети" hidden></nav>'
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

  /* ══════════════════════════════════════════════════════════
     НАВІГАЦІЯ ступені → класи → предмети
     ══════════════════════════════════════════════════════════ */
  var activeGrade = null;   // номер класу Героя (1..); null поки невідомо
  var navMap = null;        // остання карта, з якої зібрано меню

  function shortTierName(t){
    var n = String(t.name||'');
    return n.split(/\s+/)[0] || n || t.id;
  }
  /* у якому ступені живе клас Героя */
  function tierOfGrade(map, g){
    if(g==null || !map || !map.tiers) return null;
    var gn = Number(g);
    for(var i=0;i<map.tiers.length;i++){
      var t = map.tiers[i], gs = t.grades||[];
      for(var j=0;j<gs.length;j++){
        if(Number(gs[j].gradeNum) === gn) return t.id;
      }
    }
    /* запасне правило, якщо клас ще не заведено в карті */
    if(gn <= 0)  return firstTierId(map, 'preschool');
    if(gn <= 4)  return firstTierId(map, 'junior');
    return firstTierId(map, 'senior');
  }
  function firstTierId(map, guessId){
    if(map && map.tiers){
      for(var i=0;i<map.tiers.length;i++) if(map.tiers[i].id === guessId) return guessId;
    }
    return guessId;
  }

  function subjectRow(tier, subj){
    var ac = subj.accent || '#5C6BC0';
    var href = BASE+'tests.html#open='+enc(tier.id)+'&subj='+enc(subj.id);
    return '<a class="sk-hd__sub" style="--ac:'+esc(ac)+'" href="'+href+'">'
         +   '<span class="sic">'+esc(subj.icon||'📘')+'</span>'
         +   '<span>'+esc(subj.name||'Предмет')+'</span>'
         + '</a>';
  }

  function tierMenu(tier){
    var statusOn = (tier.status === 'wip' || tier.status === 'ready');
    var pill = statusOn
      ? '<span class="sk-hd__mpill on">Активно</span>'
      : '<span class="sk-hd__mpill soon">Скоро</span>';
    var html = '<div class="sk-hd__menu" role="menu">'
      + '<div class="sk-hd__mhead"><span class="ic">'+esc(tier.icon||'🏰')+'</span>'
      +   '<span class="nm">'+esc(tier.name||'')+'</span>'+pill+'</div>';

    var grades = tier.grades || [];
    if(grades.length){
      grades.forEach(function(g){
        var cur = (activeGrade!=null && Number(g.gradeNum)===Number(activeGrade)) ? ' cur' : '';
        var ghref = BASE+'tests.html#open='+enc(tier.id)+'&grade='+enc(g.id);
        html += '<div class="sk-hd__grade">'
             +    '<a class="sk-hd__glab'+cur+'" href="'+ghref+'">📖 '+esc(g.name||(g.gradeNum+' клас'))+'</a>'
             +    '<div class="sk-hd__subs">'
             +      (g.subjects||[]).map(function(s){ return subjectRow(tier, s); }).join('')
             +    '</div>'
             +  '</div>';
      });
    } else {
      html += '<div class="sk-hd__mnote">'+esc(tier.note || 'У розробці. Заплановано.')+'</div>';
    }
    html += '<a class="sk-hd__mopen" href="'+BASE+'tests.html#open='+enc(tier.id)+'">Відкрити карту ступеня →</a>';
    html += '</div>';
    return html;
  }

  function buildNav(map){
    navMap = map;
    var nav = document.getElementById('skHdNav');
    if(!nav || !map || !map.tiers || !map.tiers.length){ return; }
    var actId = tierOfGrade(map, activeGrade);

    nav.innerHTML = map.tiers.map(function(t){
      var isActive = (t.id === actId);
      var soon = (t.status !== 'wip' && t.status !== 'ready');
      return '<div class="sk-hd__ni'+(isActive?' active':'')+'" data-tier="'+esc(t.id)+'">'
           +   '<button type="button" class="sk-hd__nbtn'+(soon?' soon':'')+'" aria-haspopup="true" aria-expanded="false">'
           +     esc(shortTierName(t))+'<span class="sk-hd__car">▾</span>'
           +   '</button>'
           +   tierMenu(t)
           + '</div>';
    }).join('');
    nav.hidden = false;
    wireNav(nav);
  }

  function wireNav(nav){
    if(nav.__wired) return;      // делегування вішаємо один раз
    nav.__wired = true;

    nav.addEventListener('click', function(e){
      var btn = e.target.closest('.sk-hd__nbtn');
      if(!btn) return;
      var item = btn.closest('.sk-hd__ni');
      var wasOpen = item.classList.contains('open');
      closeAll();
      if(!wasOpen){
        item.classList.add('open');
        btn.setAttribute('aria-expanded','true');
      }
      e.stopPropagation();
    });

    /* клік по посиланню в меню на самій tests.html: даємо хешу змінитися й закриваємо меню */
    nav.addEventListener('click', function(e){
      if(e.target.closest('a')) closeAll();
    });
  }

  function closeAll(){
    var nav = document.getElementById('skHdNav');
    if(!nav) return;
    nav.querySelectorAll('.sk-hd__ni.open').forEach(function(it){
      it.classList.remove('open');
      var b = it.querySelector('.sk-hd__nbtn'); if(b) b.setAttribute('aria-expanded','false');
    });
  }
  document.addEventListener('click', function(e){
    if(!e.target.closest('#skHdNav')) closeAll();
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape') closeAll();
  });

  /* ── дістати карту королівства (SKCUR); за потреби — підвантажити файл ── */
  function withCurriculum(cb){
    if(window.SKCUR){ cb(window.SKCUR); return; }
    var existing = document.getElementById('sk-curriculum-loader')
                || Array.prototype.slice.call(document.scripts).some(function(s){
                     return (s.getAttribute('src')||'').indexOf('sk-curriculum.js') > -1;
                   });
    if(!existing){
      var s = document.createElement('script');
      s.id = 'sk-curriculum-loader';
      s.src = BASE + 'sk-curriculum.js';
      document.head.appendChild(s);
    }
    var tries = 0;
    (function wait(){
      if(window.SKCUR){ cb(window.SKCUR); return; }
      if(tries++ < 120) setTimeout(wait, 50);
    })();
  }

  withCurriculum(function(CUR){
    /* 1) миттєвий рендер із поточної (запасної) карти — щоб меню зʼявилось одразу */
    try{ if(CUR.map) buildNav(CUR.map); }catch(e){}
    /* 2) оновлення, коли прийде карта з бази (можливі правки адміна) */
    if(CUR.ready && CUR.ready.then){
      CUR.ready.then(function(map){ try{ buildNav(map || CUR.map); }catch(e){} });
    }
  });

  /* ── заповнити шкалу з Firebase + дізнатися клас Героя ── */
  var tries = 0;
  (function whenSK(){
    if(window.SK && SK.ready){
      SK.ready.then(function(){
        try{
          if(SK.isHeroSession && SK.isHeroSession() && SK.getHero){
            SK.getHero().then(function(h){
              if(!h){ showGuest(); return; }
              /* клас Героя → підсвітити відповідний ступінь */
              if(h.grade != null){
                activeGrade = Number(h.grade);
                if(navMap){ try{ buildNav(navMap); }catch(e){} }
              }
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

  /* ── підвантажуємо віджет «Повідомити про помилку» (🐞) ──
     Той самий BASE, що й для логотипа. Одноразово. */
  (function(){
    if(window.__skReportMounted) return;
    if(document.getElementById('sk-report-loader')) return;
    var s = document.createElement('script');
    s.id = 'sk-report-loader';
    s.src = BASE + 'sk-report.js';
    s.defer = true;
    document.body.appendChild(s);
  })();
})();

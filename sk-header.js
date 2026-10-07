/* ============================================================
   SK-HEADER — СПІЛЬНИЙ хедер для всіх сторінок School Kingdoms.
   Малює бренд + навігацію (ступені → класи → предмети) + шкалу
   характеристик активного Героя (читає з Firebase).
   Єдине джерело правди: правки хедера — лише тут.

   Навігація будується з КАРТИ КОРОЛІВСТВА (SKCUR / sk-curriculum.js),
   тобто з того самого джерела, що й дорожня карта на tests.html.
   Якщо на сторінці немає sk-curriculum.js — хедер підвантажує його сам
   (з тією самою версією ?v=, що й прямі підключення).

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
      +'.sk-hd__tag{display:block;font-size:.64rem;letter-spacing:.13em;text-transform:uppercase;'
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
      /* стат, підсилений вдягненими речами */
      +'.sk-hd__stat b.up{color:#7CE38B}'
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
      +'<span class="sk-hd__tag">'+esc(SUB)+'</span></span>'
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

  /* Дошкільний ступінь упізнаємо за коренем назви або id — так само, як це
     роблять tests.html, navchannia.html і doshkillya.html. Порівняння
     tier.id === 'preschool' працювало лише для ступеня із запасної карти:
     доданий в адмінці отримує згенерований id, і «Дошкільна» вела б на
     карту тестів замість своєї сторінки. */
  function isPreTier(t){
    var v = (String(t && t.id || '') + ' ' + String(t && t.name || '')).toLowerCase();
    return v.indexOf('preschool') >= 0 || v.indexOf('дошкіл') >= 0;
  }
  /* Ступінь без уточнення веде на свою сторінку Навчання; щойно обрано
     конкретний клас чи предмет — ведемо в карту тестів, інакше вибір
     мовчки губився б (doshkillya.html не знає ні grade, ні subj). */
  function tierHref(tier, extra){
    if(isPreTier(tier) && !extra) return BASE+'doshkillya.html';
    return BASE+'tests.html#open='+enc(tier.id)+(extra||'');
  }

  function subjectRow(tier, grade, subj){
    var ac = subj.accent || '#5C6BC0';
    var href = tierHref(tier, (grade ? '&grade='+enc(grade.id) : '') + '&subj='+enc(subj.id));
    return '<a class="sk-hd__sub" style="--ac:'+esc(ac)+'" href="'+href+'">'
         +   '<span class="sic">'+esc(subj.icon||'📘')+'</span>'
         +   '<span>'+esc(subj.name||'Предмет')+'</span>'
         + '</a>';
  }

  /* Чи ступінь відкритий. Рішення живе в sk-curriculum.js, щоб «Скоро» в
     шапці й на сторінках рахувалось однаково. Запасний варіант — старе
     правило за полем status: якщо в кеші браузера лежить давній
     sk-curriculum.js без tierIsOpen, хедер не має впасти. */
  function tierOpen(t){
    try{ if(window.SKCUR && SKCUR.tierIsOpen) return !!SKCUR.tierIsOpen(t); }catch(e){}
    return !!(t && (t.status === 'wip' || t.status === 'ready'));
  }

  function tierMenu(tier){
    var statusOn = tierOpen(tier);
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
        var ghref = tierHref(tier, '&grade='+enc(g.id));
        html += '<div class="sk-hd__grade">'
             +    '<a class="sk-hd__glab'+cur+'" href="'+ghref+'">📖 '+esc(g.name||(g.gradeNum+' клас'))+'</a>'
             +    '<div class="sk-hd__subs">'
             +      (g.subjects||[]).map(function(s){ return subjectRow(tier, g, s); }).join('')
             +    '</div>'
             +  '</div>';
      });
    } else {
      html += '<div class="sk-hd__mnote">'+esc(tier.note || 'У розробці. Заплановано.')+'</div>';
    }
    html += '<a class="sk-hd__mopen" href="'+tierHref(tier)+'">Відкрити карту ступеня →</a>';
    html += '</div>';
    return html;
  }

  /* Ступінь, який показує сама сторінка (window.SK_HEADER_TIER або
     skHeaderSetTier). Він важливіший за клас Героя: відкрито «Дошкільнятко» —
     підсвічуємо «Дошкільна», навіть якщо Герой у 2 класі. 'preschool'
     шукаємо через isPreTier, бо в адмінці ступінь має згенерований id. */
  function pageTierId(map){
    var want = window.SK_HEADER_TIER;
    if(!want || !map || !map.tiers) return null;
    var i;
    for(i=0;i<map.tiers.length;i++) if(map.tiers[i].id === want) return want;
    if(String(want).indexOf('preschool') >= 0){
      for(i=0;i<map.tiers.length;i++) if(isPreTier(map.tiers[i])) return map.tiers[i].id;
    }
    return null;
  }
  window.skHeaderSetTier = function(id){
    if(window.SK_HEADER_TIER === id) return;
    window.SK_HEADER_TIER = id;
    if(navMap){ try{ buildNav(navMap); }catch(e){} }
  };

  function buildNav(map){
    navMap = map;
    var nav = document.getElementById('skHdNav');
    if(!nav || !map || !map.tiers || !map.tiers.length){ return; }
    var actId = pageTierId(map) || tierOfGrade(map, activeGrade);

    nav.innerHTML = map.tiers.map(function(t){
      var isActive = (t.id === actId);
      var soon = !tierOpen(t);
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
      // версія — та сама, що в <script> на сторінках, інакше сюди
      // приїде закешована карта й правки адміна не доїдуть.
      s.src = BASE + 'sk-curriculum.js?v=8';
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

  /* ── стати Героя в хедері ──
     Показуємо підсумок «база + вдягнені речі» — так само, як вікно
     екіпіровки на арені (SKIT.combine). Спершу малюємо базу (миттєво),
     потім, коли прочитано інвентар і каталог, — з урахуванням речей. */
  var STAT_KEYS = [['❤️','health'],['🔮','mana'],['🏃','agility'],['🎯','accuracy']];
  function renderStats(h, gear){
    var box = document.getElementById('skHdStats');
    if(!box) return;
    var chips = STAT_KEYS.map(function(s){
      var base = Number(h[s[1]]) || 0;
      var v = (gear && gear[s[1]] != null) ? gear[s[1]] : base;
      var diff = v - base;
      var tip = diff ? ' title="'+base+(diff > 0 ? ' + ' : ' − ')+Math.abs(diff)+' від речей"' : '';
      return '<span class="sk-hd__stat"'+tip+'>'+s[0]+' <b'+(diff > 0 ? ' class="up"' : '')+'>'+v+'</b></span>';
    });
    /* Були зірочки (XP) — дитині незрозуміло, та й XP тепер
       росте лише з батьківських завдань. Показуємо монети: їх
       видно де завгодно — у нагородах, крамниці, інвентарі. */
    chips.push('<span class="sk-hd__stat">🪙 <b>'+(h.coins != null ? h.coins : 0)+'</b></span>');
    box.innerHTML = chips.join('');
  }

  /* sk-items.js (window.SKIT) є не на кожній сторінці — довантажуємо */
  var skitP = null;
  function needSKIT(){
    if(window.SKIT) return Promise.resolve(window.SKIT);
    if(!skitP) skitP = new Promise(function(res){
      var s = document.createElement('script');
      s.src = BASE + 'sk-items.js?v=4';
      s.onload = function(){ res(window.SKIT || null); };
      s.onerror = function(){ res(null); };
      document.head.appendChild(s);
    });
    return skitP;
  }

  /* Підсумкові стати з вдягненими речами або null (речей немає / помилка).
     Вдягнене = має slot, крім комірок пояса (там зілля, вони не діють постійно). */
  function gearTotals(h){
    if(!SK.getInventory || !SK.listItems) return Promise.resolve(null);
    // інвентар уже є в документі Героя — не читаємо той самий документ удруге
    var invP = Array.isArray(h && h.inventory) ? Promise.resolve(h.inventory) : SK.getInventory();
    return invP.then(function(inv){
      var worn = (inv || []).filter(function(i){ return i && i.id && i.slot && !/^belt\d/.test(i.slot); });
      if(!worn.length) return null;
      return Promise.all([SK.listItems(), needSKIT()]).then(function(r){
        var SKIT = r[1]; if(!SKIT || !SKIT.combine) return null;
        var by = {}; (r[0] || []).forEach(function(it){ by[it.id] = it; });
        var bases = [], insts = [];
        worn.forEach(function(i){ if(by[i.id]){ bases.push(by[i.id]); insts.push(i); } });
        if(!bases.length) return null;
        var baseHero = {};
        STAT_KEYS.forEach(function(s){ baseHero[s[1]] = Number(h[s[1]]) || 0; });
        return SKIT.combine(baseHero, bases, insts).stats;
      });
    }).catch(function(e){ try{ console.warn('[хедер] речі не враховано:', e); }catch(_){} return null; });
  }

  /* ── заповнити шкалу з Firebase + дізнатися клас Героя ── */
  var lastHero = null;
  function loadHero(){
    SK.getHero().then(function(h){
      if(!h){ showGuest(); return; }
      lastHero = h;
      /* клас Героя → підсвітити відповідний ступінь */
      if(h.grade != null && Number(h.grade) !== activeGrade){
        activeGrade = Number(h.grade);
        if(navMap){ try{ buildNav(navMap); }catch(e){} }
      }
      renderStats(h, null);
      var strip = document.getElementById('skHdStrip');
      if(strip) strip.classList.add('on');
      gearTotals(h).then(function(g){ if(g) renderStats(h, g); });
      try{ battleCheck(h); }catch(e){}
    }).catch(showGuest);
  }

  /* ── БІЙ ДОГРАЄТЬСЯ НА БУДЬ-ЯКІЙ СТОРІНЦІ ──
     Бій на арені не стоїть на паузі: коли час ходу минув, а гравця немає,
     хід робиться сам (ті самі зони, що востаннє — SKBATTLE.autoChoice).
     Якщо арена не відкрита, це робить будь-яка сторінка з хедером:
     доігрує пропущені ходи, а завершений бій записує (SK.finishBattle —
     знос, зникнення зламаних речей, досвід) і показує підсумок.
     Арена (window.SK_BATTLE_PAGE) керує цим сама. */
  var BATTLE_KEY = 'sk_arena_battle2', SEEN_KEY = 'sk_battle_seen', GRACE_MS = 5000;
  var battleBusy = false, battleTimer = null;
  function loadScript(src){
    return new Promise(function(res){
      var s = document.createElement('script');
      s.src = BASE + src; s.onload = function(){ res(true); }; s.onerror = function(){ res(false); };
      document.head.appendChild(s);
    });
  }
  function battleDeps(){
    return Promise.all([
      window.SKARENA  ? true : loadScript('sk-arena-rules.js?v=17'),
      window.SKBATTLE ? true : loadScript('sk-battle.js?v=3'),
      needSKIT()
    ]).then(function(){ return !!(window.SKARENA && window.SKBATTLE && window.SKIT); });
  }
  function localBattle(heroId){
    try{
      var o = JSON.parse(localStorage.getItem(BATTLE_KEY) || 'null');
      if(o && o.v === 2 && o.bid && (!o.heroId || !heroId || o.heroId === heroId)) return o;
    }catch(e){}
    return null;
  }
  function localArena(){
    var g = function(k){ try{ return +localStorage.getItem(k) || 0; }catch(e){ return 0; } };
    return { level: g('sk_arena_level') || 1, xp: g('sk_arena_xp'), wins: g('sk_arena_wins'), losses: g('sk_arena_losses'), draws: g('sk_arena_draws') };
  }
  function scheduleBattle(deadline){
    if(battleTimer) clearTimeout(battleTimer);
    var wait = Math.max(GRACE_MS, Number(deadline || 0) - Date.now() + GRACE_MS);
    battleTimer = setTimeout(function(){
      battleTimer = null;
      try{ SK.getHero().then(function(h){ battleCheck(h); }).catch(function(){}); }catch(e){}
    }, Math.min(wait, 10 * 60 * 1000));
  }
  function battleCheck(h){
    if(window.SK_BATTLE_PAGE || battleBusy || !h || !SK.finishBattle) return;
    var heroId = SK._heroUid ? SK._heroUid() : '';
    var a = h.activeBattle, loc = localBattle(heroId);
    if(loc && h.lastBattleId === loc.bid){ try{ localStorage.removeItem(BATTLE_KEY); }catch(e){} loc = null; }
    var pending = !!(loc && loc.status === 'over');                       // завершено, але не записано
    var liveMark = !!(a && a.bid && h.lastBattleId !== a.bid);
    if(!pending && !liveMark){ battleNotice(h.lastBattle); return; }
    if(!pending && Date.now() < Number(a.deadline || 0) + GRACE_MS){ scheduleBattle(a.deadline); return; }
    battleBusy = true;
    battleDeps().then(function(ok){
      if(!ok) return null;
      var get = pending ? Promise.resolve(loc) : SK.loadBattle(a.bid).then(function(r){
        if(loc && loc.bid === a.bid && (!r || (loc.rev || 0) >= (r.rev || 0))) return loc;
        return r;
      });
      return get.then(function(st){
        if(!st || st.v !== 2) return null;
        var ctx = { R: window.SKARENA, K: window.SKIT };
        if(st.status === 'live') SKBATTLE.catchUp(ctx, st, Date.now() - GRACE_MS);
        try{ localStorage.setItem(BATTLE_KEY, JSON.stringify(st)); }catch(e){}
        if(st.status === 'live'){ return SK.saveBattle(st).then(function(){ scheduleBattle(st.deadline); }); }
        return SK.finishBattle(st, localArena()).then(function(r){
          try{ localStorage.removeItem(BATTLE_KEY); }catch(e){}
          if(r && r.arena){
            try{ ['level','xp','wins','losses','draws'].forEach(function(k){ localStorage.setItem('sk_arena_' + k, r.arena[k]); }); }catch(e){}
          }
          battleNotice((r && r.lastBattle) || null);
          if(window.SKHeaderRefresh) window.SKHeaderRefresh();
        });
      });
    }).catch(function(e){ try{ console.warn('[хедер] бій не доіграно:', e); }catch(_){} })
      .then(function(){ battleBusy = false; });
  }
  /* підсумок бою, якого дитина ще не бачила */
  function battleNotice(L){
    if(!L || !L.bid) return;
    var seen = null; try{ seen = localStorage.getItem(SEEN_KEY); }catch(e){}
    if(seen === L.bid) return;
    try{ localStorage.setItem(SEEN_KEY, L.bid); }catch(e){}
    var head = L.result === 'win' ? (L.afk ? '⚔ Бій завершено без тебе' : '⚔ Бій на арені: перемога!')
      : L.result === 'draw' ? '⚔ Бій на арені: нічия' : '⚔ Бій на арені: поразка';
    var txt = window.SKBATTLE ? SKBATTLE.noticeText(L) : '';
    hdToast(head, (L.xp ? '+' + L.xp + ' досвіду. ' : '') + txt);
  }
  function hdToast(main, sub){
    var t = document.getElementById('skHdToast');
    if(!t){
      t = document.createElement('div'); t.id = 'skHdToast';
      t.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9999;max-width:min(92vw,460px);'
        + 'background:#13315f;color:#fff;border:2px solid #e0a42a;border-radius:14px;padding:12px 16px;'
        + 'box-shadow:0 8px 24px rgba(0,0,0,.35);font:600 14px/1.4 system-ui,Segoe UI,Arial,sans-serif;cursor:pointer';
      t.addEventListener('click', function(){ t.style.display = 'none'; });
      document.body.appendChild(t);
    }
    t.innerHTML = '<div style="font-weight:900;color:#ffd54a">' + esc(main) + '</div>' + (sub ? '<div style="margin-top:4px">' + esc(sub) + '</div>' : '');
    t.style.display = '';
    clearTimeout(hdToast.t); hdToast.t = setTimeout(function(){ t.style.display = 'none'; }, 9000);
  }
  /* Сторінка вже має свіжі монети / інвентар (транзакція повернула стан) —
     оновлюємо шкалу без повторного читання документа Героя. */
  window.SKHeaderPatch = function(patch){
    if(!lastHero || !patch) return;
    var h = Object.assign({}, lastHero, patch); lastHero = h;
    renderStats(h, null);
    gearTotals(h).then(function(g){ if(g) renderStats(h, g); });
  };
  /* Сторінки, де Герой перевдягається (арена), кличуть це після збереження */
  window.SKHeaderRefresh = function(){
    try{ if(window.SK && SK.isHeroSession && SK.isHeroSession() && SK.getHero) loadHero(); }catch(e){}
  };

  var tries = 0;
  (function whenSK(){
    if(window.SK && SK.ready){
      SK.ready.then(function(){
        try{
          if(SK.isHeroSession && SK.isHeroSession() && SK.getHero) loadHero();
          else showGuest();
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

/* ============================================================
   SK-REPORT — маленький 🐞 «Повідомити про помилку».
   Самоінжектиться: додає плаваючу кнопку 🐞 у правому нижньому куті
   (над футером), відкриває коротке вікно й формує лист на пошту
   через mailto: з автоконтекстом (сторінка, Герой, дата).

   Підключення (один раз, наприкінці <body>):
     <script src="sk-report.js" defer></script>   // із підпапки: ../sk-report.js
   Або автоматично — його підвантажує sk-header.js.

   Пошта підтримки задається в SK_REPORT_EMAIL (нижче).
   ============================================================ */
(function(){
  'use strict';
  if (window.__skReportMounted) return;          // не дублювати
  window.__skReportMounted = true;

  var EMAIL = (window.SK_REPORT_EMAIL || 'schoolkingdoms@gmail.com');

  function esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }

  /* ── синхронний контекст (без Firebase) ── */
  function heroName(){
    try{
      var p = JSON.parse(localStorage.getItem('sk_hero_profile')||'null');
      if(p && p.name) return String(p.name);
    }catch(e){}
    return '';
  }
  function heroId(){
    try{ return localStorage.getItem('sk_active_child') || ''; }catch(e){ return ''; }
  }
  function ctxLines(){
    var d = new Date();
    var pad = function(n){ return (n<10?'0':'')+n; };
    var when = d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())
             + ' ' + pad(d.getHours())+':'+pad(d.getMinutes());
    var lines = [];
    lines.push('Сторінка: ' + (document.title||'').trim());
    lines.push('URL: ' + location.href);
    var hn = heroName(); if(hn) lines.push('Герой: ' + hn);
    var hid = heroId();   if(hid) lines.push('ID: ' + hid);
    lines.push('Дата: ' + when);
    lines.push('Екран: ' + window.innerWidth + '×' + window.innerHeight);
    lines.push('Пристрій: ' + navigator.userAgent);
    return lines;
  }

  /* ── СКРІНШОТ через html2canvas (лінива підвантажка з CDN) ── */
  var H2C_URL = (window.SK_H2C_URL || 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  var SHOT = null;        // dataURL останнього знімка або null
  var SHOT_STATE = 'idle'; // idle | working | ready | fail
  var SHOT_MAX = 780000;  // стеля розміру base64 (щоб документ Firestore лишався < 1 МБ)

  function loadH2C(){
    return new Promise(function(res){
      if(window.html2canvas) return res(window.html2canvas);
      var s = document.createElement('script');
      s.src = H2C_URL; s.async = true;
      s.onload = function(){ res(window.html2canvas || null); };
      s.onerror = function(){ res(null); };
      document.head.appendChild(s);
    });
  }

  // зменшити канвас за шириною й закодувати в JPEG із контролем розміру
  function encodeShot(canvas){
    var maxW = 720, q = 0.6;
    function draw(w){
      var r = w / canvas.width;
      var c = document.createElement('canvas');
      c.width = w; c.height = Math.max(1, Math.round(canvas.height * r));
      c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
      return c;
    }
    var work = canvas.width > maxW ? draw(maxW) : canvas;
    var url = work.toDataURL('image/jpeg', q);
    // якщо завелике — знижуємо якість, потім ширину
    var guard = 0;
    while(url.length > SHOT_MAX && guard++ < 5){
      if(q > 0.35){ q -= 0.12; }
      else { maxW = Math.round(maxW * 0.8); work = draw(maxW); }
      url = work.toDataURL('image/jpeg', q);
    }
    return url.length <= SHOT_MAX ? url : null;
  }

  // знімок ВИДИМОЇ частини сторінки (без самого віджета)
  function captureShot(){
    SHOT = null; SHOT_STATE = 'working'; updateShotUI();
    loadH2C().then(function(h2c){
      if(!h2c){ SHOT_STATE = 'fail'; updateShotUI(); return; }
      try{
        h2c(document.body, {
          backgroundColor: '#0c1c36',
          scale: 1, useCORS: true, logging: false,
          x: window.scrollX, y: window.scrollY,
          width: window.innerWidth, height: window.innerHeight,
          ignoreElements: function(el){
            return el.getAttribute && el.getAttribute('data-html2canvas-ignore') === 'true';
          }
        }).then(function(canvas){
          try{ SHOT = encodeShot(canvas); }catch(e){ SHOT = null; }
          SHOT_STATE = SHOT ? 'ready' : 'fail'; updateShotUI();
        }).catch(function(){ SHOT_STATE = 'fail'; updateShotUI(); });
      }catch(e){ SHOT_STATE = 'fail'; updateShotUI(); }
    });
  }

  function updateShotUI(){
    if(!back) return;
    var st = back.querySelector('#skShotState');
    var chk = back.querySelector('#skShotChk');
    if(!st) return;
    if(SHOT_STATE === 'working') st.textContent = '📷 Роблю знімок екрана…';
    else if(SHOT_STATE === 'ready') st.textContent = '📷 Знімок екрана додано ✓';
    else if(SHOT_STATE === 'fail') st.textContent = '📷 Знімок не вдався — надішлемо без нього';
    else st.textContent = '';
    if(chk){
      chk.disabled = (SHOT_STATE !== 'ready');
      chk.checked  = (SHOT_STATE === 'ready');
    }
  }

  /* дані для запису у Firestore */
  function reportData(userText){
    var page = (location.pathname.split('/').pop() || 'сторінка').replace(/\.html$/,'');
    var wantShot = false;
    if(back){ var chk = back.querySelector('#skShotChk'); wantShot = !!(chk && chk.checked); }
    return {
      message:    (userText||'').trim(),
      page:       page + ((document.title? ' — '+document.title.trim() : '')),
      url:        location.href,
      heroName:   heroName(),
      heroId:     heroId(),
      screen:     window.innerWidth + '×' + window.innerHeight,
      ua:         navigator.userAgent,
      screenshot: (wantShot && SHOT) ? SHOT : ''
    };
  }

  /* mailto — резерв, якщо немає Firebase (сторінки ігор) або запис не вдався */
  function buildMailto(userText){
    var page = (location.pathname.split('/').pop() || 'сторінка').replace(/\.html$/,'');
    var subject = '🐞 Помилка: ' + page;
    var body = (userText && userText.trim() ? userText.trim() : '(опишіть, що сталося)')
             + '\n\n— — — технічні дані — — —\n'
             + ctxLines().join('\n');
    return 'mailto:' + EMAIL
         + '?subject=' + encodeURIComponent(subject)
         + '&body='    + encodeURIComponent(body);
  }

  /* Спробувати надіслати в базу (адмінка). -> Promise<bool> */
  function sendToDb(userText){
    try{
      if(window.SK && typeof window.SK.submitReport === 'function'){
        return window.SK.submitReport(reportData(userText))
          .then(function(){ return true; })
          .catch(function(){ return false; });
      }
    }catch(e){}
    return Promise.resolve(false);
  }

  /* ── стилі (один раз) ── */
  if(!document.getElementById('sk-report-css')){
    var css = document.createElement('style');
    css.id = 'sk-report-css';
    css.textContent =
      '.sk-bug-btn{position:fixed;right:10px;'
    + 'top:calc(64px + env(safe-area-inset-top));z-index:50;'
    + 'width:40px;height:40px;border-radius:50%;border:2px solid rgba(242,199,92,.7);'
    + 'background:linear-gradient(180deg,rgba(30,52,92,.92),rgba(12,28,54,.92));'
    + 'color:#fff;font-size:20px;line-height:1;display:flex;align-items:center;'
    + 'justify-content:center;cursor:pointer;box-shadow:0 6px 16px rgba(0,0,0,.4);'
    + 'opacity:.72;transition:opacity .15s,transform .15s;padding:0}'
    + '.sk-bug-btn:hover{opacity:1;transform:translateY(-2px)}'
    + '.sk-bug-btn:active{transform:translateY(0)}'
    + '.sk-rep-back{position:fixed;inset:0;z-index:60;background:rgba(6,14,30,.62);'
    + 'display:flex;align-items:center;justify-content:center;padding:18px;'
    + 'backdrop-filter:blur(2px)}'
    + '.sk-rep-card{width:100%;max-width:380px;border-radius:20px;color:#fff;'
    + 'background:linear-gradient(165deg,#1e345c,#0c1c36);'
    + 'border:2px solid rgba(242,199,92,.55);box-shadow:0 20px 50px rgba(0,0,0,.5);'
    + 'padding:20px 18px 16px;font-family:inherit}'
    + '.sk-rep-card h3{margin:0 0 4px;font-family:"Playfair Display",serif;'
    + 'font-weight:800;font-size:1.22rem}'
    + '.sk-rep-card p{margin:0 0 12px;font-size:.86rem;color:#c6d3ea;line-height:1.35}'
    + '.sk-rep-card textarea{width:100%;box-sizing:border-box;min-height:88px;resize:vertical;'
    + 'border-radius:12px;border:1.5px solid rgba(255,255,255,.18);'
    + 'background:rgba(255,255,255,.06);color:#fff;font:inherit;font-size:.9rem;'
    + 'padding:10px 12px;outline:none}'
    + '.sk-rep-card textarea:focus{border-color:rgba(242,199,92,.8)}'
    + '.sk-rep-hint{font-size:.74rem;color:#9aa6c6;margin:8px 2px 0;line-height:1.3}'
    + '.sk-shot-row{display:flex;align-items:center;gap:8px;margin:10px 2px 0;'
    + 'font-size:.8rem;color:#c6d3ea;cursor:pointer;user-select:none}'
    + '.sk-shot-row input{width:16px;height:16px;accent-color:#E0A93A;cursor:pointer}'
    + '.sk-rep-row{display:flex;gap:10px;margin-top:14px}'
    + '.sk-rep-btn{flex:1;border:none;border-radius:999px;font:inherit;font-weight:900;'
    + 'font-size:.92rem;padding:11px 14px;cursor:pointer}'
    + '.sk-rep-send{background:linear-gradient(180deg,#FFE7A0,#E0A93A);color:#5a3d08;'
    + 'border:2px solid #c98f24}'
    + '.sk-rep-cancel{background:rgba(255,255,255,.08);color:#cfe0f5;'
    + 'border:1.5px solid rgba(255,255,255,.18)}';
    document.head.appendChild(css);
  }

  /* ── плаваюча кнопка 🐞 (можна вимкнути прапорцем SK_REPORT_NO_BUTTON,
        напр. у кабінеті батьків, де є власна кнопка «Повідомити про помилку») ── */
  if (!window.SK_REPORT_NO_BUTTON) {
    var btn = document.createElement('button');
    btn.className = 'sk-bug-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label','Повідомити про помилку');
    btn.title = 'Повідомити про помилку';
    btn.textContent = '🐞';
    btn.setAttribute('data-html2canvas-ignore','true');
    btn.addEventListener('click', openModal);
    (document.body || document.documentElement).appendChild(btn);
  }

  var back = null;
  function closeModal(){ if(back){ back.remove(); back=null; document.removeEventListener('keydown',onKey); } }
  function onKey(e){ if(e.key==='Escape') closeModal(); }

  function openModal(){
    if(back) return;
    // спершу — знімок поточної сторінки (доки вікна ще немає в DOM)
    captureShot();

    back = document.createElement('div');
    back.className = 'sk-rep-back';
    back.setAttribute('data-html2canvas-ignore','true');
    back.innerHTML =
      '<div class="sk-rep-card" role="dialog" aria-modal="true">'
    + '<h3>🐞 Помітили помилку?</h3>'
    + '<p>Коротко опишіть, що сталося — і ми полагодимо. Дані про сторінку додадуться автоматично.</p>'
    + '<textarea id="skRepText" placeholder="Напр.: кнопка «Грати» не відкриває тренажер…"></textarea>'
    + '<label class="sk-shot-row"><input type="checkbox" id="skShotChk" checked disabled>'
    +   '<span id="skShotState">📷 Роблю знімок екрана…</span></label>'
    + '<div class="sk-rep-row">'
    +   '<button class="sk-rep-btn sk-rep-cancel" type="button" id="skRepCancel">Скасувати</button>'
    +   '<button class="sk-rep-btn sk-rep-send" type="button" id="skRepSend">✉️ Повідомити</button>'
    + '</div>'
    + '</div>';
    document.body.appendChild(back);
    document.addEventListener('keydown', onKey);
    back.addEventListener('click', function(e){ if(e.target===back) closeModal(); });
    updateShotUI();
    var ta = back.querySelector('#skRepText');
    if(ta) setTimeout(function(){ ta.focus(); }, 30);
    back.querySelector('#skRepCancel').addEventListener('click', closeModal);
    back.querySelector('#skRepSend').addEventListener('click', function(){
      var txt = ta ? ta.value : '';
      var btnEl = this;
      btnEl.disabled = true;
      btnEl.textContent = 'Надсилаємо…';
      sendToDb(txt).then(function(ok){
        if(ok){
          showThanks();
        } else {
          // немає бази або помилка → відкриваємо пошту
          window.location.href = buildMailto(txt);
          setTimeout(closeModal, 400);
        }
      });
    });
  }

  function showThanks(){
    if(!back) return;
    var card = back.querySelector('.sk-rep-card');
    if(!card) return;
    card.innerHTML =
      '<h3>✅ Дякуємо!</h3>'
    + '<p style="margin:6px 0 16px">Повідомлення надіслано адміністратору. Ми розберемось і виправимо.</p>'
    + '<div class="sk-rep-row"><button class="sk-rep-btn sk-rep-send" type="button" id="skRepOk">Готово</button></div>';
    var ok = card.querySelector('#skRepOk');
    if(ok) ok.addEventListener('click', closeModal);
  }

  /* Публічний виклик: window.SKReport.open() — відкрити вікно з будь-якої
     кнопки (напр. «Повідомити про помилку» у кабінеті батьків). */
  window.SKReport = { open: openModal };
})();

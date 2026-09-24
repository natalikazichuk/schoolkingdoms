/* ============================================================
   sk-cards.js — однакове гортання карток у всіх тренажерах.

   Підключення (після скрипта сторінки, де вже є функція гортання):
     <script src="../sk-cards.js?v=1"></script>
     <script>
       SKCards.attach({
         card:   '#letterCard',   // картка, яку тягнемо пальцем
         screen: '#learn',        // екран, на якому працюють клавіші (опц.)
         fn:     'move',          // глобальна функція: move(-1) / move(1)
         prev:   '#prevB',        // кнопки-стрілки: disabled = далі нікуди
         next:   '#nextB',
         keys:   true             // ← → на клавіатурі (якщо сторінка не робить сама)
       });
     </script>
   Для функцій з абсолютним номером (go(idx+1)) — fn:'go', abs:true,
   index:function(){ return idx; }.

   Що дає:
     • свайп: картка йде за пальцем; відпустив далі 60px — гортаємо,
       менше — вертається на місце, і це не рахується як тап;
     • плавний перехід: нова картка заїжджає з боку свайпу — і для
       стрілок, і для клавіш (обгортаємо саму функцію гортання);
     • на першій/останній картці — легка «пружинка» замість тиші;
     • однаковий розмір картки на всіх сторінках (клас sk-card-std):
       ширина до 440px, висота до 560px і не більше 58% екрана —
       картка не стрибає від довгого чи короткого слова.
   ============================================================ */
(function(){
  'use strict';
  if(window.SKCards) return;

  var css =
    ':root{--sk-card-w:440px;--sk-card-h:min(560px,58dvh)}'
   +'@supports not (height:1dvh){:root{--sk-card-h:min(560px,58vh)}}'
   +'.sk-card-std{width:min(100%,var(--sk-card-w))!important;height:var(--sk-card-h)!important;'
   +  'min-height:0!important;max-height:none!important;flex:0 0 auto!important;margin-left:auto!important;margin-right:auto!important;'
   +  'box-sizing:border-box;overflow:hidden}'
   /* Усередині картки віддає висоту лише картинка: вона стискається, а
      назва, підпис і кнопки завжди видно — навіть коли підпис у два рядки
      («Два плюс один — буде три»). Мінімальні висоти картинок зі сторінок
      тут вимикаємо, інакше текст вилазив би за край картки. */
   +'.sk-card-std{display:flex!important;flex-direction:column!important}'
   +'.sk-card-std>*{flex:0 0 auto}'
   +'.sk-card-std>.lc-pic,.sk-card-std>.pic-wrap,.sk-card-std>.acard-pic,.sk-card-std>.dc-pic,.sk-card-std>.sk-grow'
   +  '{flex:1 1 auto!important;min-height:0!important;overflow:hidden}'
   +'.sk-card-std .lc-pic img,.sk-card-std .dc-pic img{max-height:100%!important;max-width:100%}'
   +'.sk-card-std .count-box{min-height:0!important}'
   /* стадія, у якій стоїть картка, не розтягує її — картка по центру */
   +'.sk-card-stage{flex:0 0 auto!important;min-height:0;display:flex!important;flex-direction:column;align-items:center;justify-content:center}'
   +'.sk-swipe{touch-action:pan-y;user-select:none;-webkit-user-select:none}'
   +'.sk-swipe img{-webkit-user-drag:none;user-drag:none}'
   +'.sk-swipe.sk-drag{transition:none!important;animation:none!important}'
   +'.sk-in-l{animation:skInL .24s ease-out}'
   +'.sk-in-r{animation:skInR .24s ease-out}'
   +'.sk-bump-l{animation:skBumpL .3s ease-out}'
   +'.sk-bump-r{animation:skBumpR .3s ease-out}'
   +'@keyframes skInL{from{transform:translateX(34%);opacity:0}to{transform:none;opacity:1}}'
   +'@keyframes skInR{from{transform:translateX(-34%);opacity:0}to{transform:none;opacity:1}}'
   +'@keyframes skBumpL{0%,100%{transform:none}40%{transform:translateX(-14px)}}'
   +'@keyframes skBumpR{0%,100%{transform:none}40%{transform:translateX(14px)}}'
   +'@media (prefers-reduced-motion:reduce){.sk-in-l,.sk-in-r,.sk-bump-l,.sk-bump-r{animation:none}}';
  var st = document.createElement('style');
  st.id = 'sk-cards-css';
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  function $(x){ return (typeof x === 'string') ? document.querySelector(x) : x; }

  function attach(o){
    o = o || {};
    var card = $(o.card);
    if(!card) return null;
    var fnName = o.fn || 'move';
    var orig = window[fnName];
    if(typeof orig !== 'function') return null;

    card.classList.add('sk-swipe');
    if(o.size !== false){
      card.classList.add('sk-card-std');
      var stage = o.stage ? $(o.stage) : card.parentElement;
      if(stage && o.stage !== false) stage.classList.add('sk-card-stage');
    }

    /* Далі нікуди? Питаємо кнопку-стрілку: сторінка сама вмикає disabled. */
    function atEnd(d){
      var b = $(d > 0 ? o.next : o.prev);
      if(o.canGo) return !o.canGo(d);
      return !!(b && b.disabled);
    }
    function anim(cls){
      var c = $(o.card);                     // сторінка могла перемалювати картку
      if(!c) return;
      c.classList.remove('sk-in-l','sk-in-r','sk-bump-l','sk-bump-r');
      void c.offsetWidth;
      c.classList.add(cls);
    }
    function step(d){
      if(atEnd(d)){ anim(d > 0 ? 'sk-bump-l' : 'sk-bump-r'); return false; }
      return true;
    }

    /* Обгортаємо функцію гортання — анімація буде і на стрілках, і на
       клавішах, і на свайпі, хоч би звідки її кликали. */
    var wrapped = function(a){
      var d = o.abs ? (Number(a) - Number(o.index ? o.index() : 0)) : Number(a);
      if(!d || isNaN(d)) return orig.apply(this, arguments);
      /* Стрибок через сітку («перейти до 5») — без пружинки. */
      if(Math.abs(d) === 1 && !step(d)) return;
      var r = orig.apply(this, arguments);
      anim(d > 0 ? 'sk-in-l' : 'sk-in-r');
      return r;
    };
    window[fnName] = wrapped;

    /* ── свайп ── */
    var x0 = null, y0 = 0, dx = 0, dragging = false, justSwiped = false;
    card.addEventListener('pointerdown', function(e){
      if(e.pointerType === 'mouse' && e.button !== 0) return;
      /* Тягнути можна й з кнопки на картці (велика плитка-літера — теж
         кнопка): якщо палець справді потягнув, клік нижче гаситься. */
      if(e.target.closest && e.target.closest('select, input, textarea')) return;
      x0 = e.clientX; y0 = e.clientY; dx = 0; dragging = false;
      justSwiped = false;                    // новий дотик — вже не хвіст свайпу
    });
    card.addEventListener('pointermove', function(e){
      if(x0 == null) return;
      dx = e.clientX - x0;
      var dy = e.clientY - y0;
      if(!dragging){
        if(Math.abs(dx) < 8) return;
        if(Math.abs(dy) > Math.abs(dx)){ x0 = null; return; }   // це прокрутка
        dragging = true;
        card.classList.add('sk-drag');
        try{ card.setPointerCapture(e.pointerId); }catch(_){}
      }
      /* на краю — тягнеться туго, як гумка */
      var d = dx < 0 ? 1 : -1, k = atEnd(d) ? 0.25 : 1;
      card.style.transform = 'translateX(' + (dx * k) + 'px) rotate(' + (dx * k / 40) + 'deg)';
    });
    function end(){
      if(x0 == null) return;
      x0 = null;
      if(!dragging) return;
      dragging = false;
      card.classList.remove('sk-drag');
      card.style.transform = '';
      justSwiped = true;                     // клік, що прийде слідом, гасимо
      if(Math.abs(dx) >= 60){
        var d = dx < 0 ? 1 : -1;
        if(o.abs) window[fnName]((o.index ? o.index() : 0) + d);
        else window[fnName](d);
      }
      dx = 0;
    }
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
    card.addEventListener('lostpointercapture', end);
    /* після свайпу клік не має спрацювати як тап (переворот, озвучка) */
    card.addEventListener('click', function(e){
      if(justSwiped){ justSwiped = false; e.stopPropagation(); e.preventDefault(); }
    }, true);
    card.addEventListener('dragstart', function(e){ e.preventDefault(); });

    /* ── клавіші ── */
    if(o.keys){
      document.addEventListener('keydown', function(e){
        if(e.altKey || e.ctrlKey || e.metaKey) return;
        var t = e.target && e.target.tagName;
        if(t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return;
        var scr = o.screen ? $(o.screen) : null;
        if(scr && !scr.classList.contains('on') && !scr.classList.contains('active')) return;
        var d = e.key === 'ArrowRight' ? 1 : (e.key === 'ArrowLeft' ? -1 : 0);
        if(!d) return;
        e.preventDefault();
        if(o.abs) window[fnName]((o.index ? o.index() : 0) + d);
        else window[fnName](d);
      });
    }
    return { go: function(d){ return o.abs ? window[fnName]((o.index ? o.index() : 0) + d) : window[fnName](d); } };
  }

  /* Картинки сусідніх карток — наперед, щоб при гортанні не було порожньої
     картки, поки файл тягнеться з мережі. */
  function preload(urls){
    (urls || []).forEach(function(u){ if(u){ var im = new Image(); im.src = u; } });
  }

  window.SKCards = { attach: attach, preload: preload };
})();

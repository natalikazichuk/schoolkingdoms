/* Teddy Star радіє правильній відповіді.
   skTeddyCheer() — ведмедик вистрибує знизу екрана, підстрибує, навколо розлітаються зірочки,
   над ним хмаринка з похвалою. Не заважає натискати кнопки (pointer-events:none), сам зникає.
   Підключення: <script src="../sk-teddy-cheer.js?v=1" data-base="../"></script>
   Пози беруться з img/teddy/<поза>.webp. */
(function(){
  const me = document.currentScript;
  const BASE = (me && me.dataset.base) || "../";
  const POSES = ["hooray", "jump", "heart", "wave"];
  const WORDS = ["Great!", "Super!", "Well done!", "Yes!", "Good job!", "Excellent!"];
  const STAR_COLORS = ["#f2b705", "#ffd23f", "#ff8fc0", "#5ab8ff", "#37b26f"];

  // попередньо завантажуємо пози, щоб ведмедик з'являвся без затримки
  POSES.forEach(p => { const i = new Image(); i.src = `${BASE}img/teddy/${p}.webp`; });

  const css = `
.tc-wrap{position:fixed;left:0;right:0;bottom:0;height:0;z-index:9999;pointer-events:none}
.tc-ted{position:absolute;bottom:0;width:150px;transform:translate(-50%,110%);animation:tcPop 1.6s cubic-bezier(.3,1.4,.5,1) forwards}
.tc-ted img{display:block;width:100%;height:auto;filter:drop-shadow(0 6px 8px rgba(0,0,0,.25));
  transform-origin:50% 100%;animation:tcHop .42s ease-in-out .3s 2 alternate}
.tc-bub{position:absolute;left:50%;bottom:100%;transform:translateX(-50%) scale(0);white-space:nowrap;
  font-family:'Fredoka',system-ui,sans-serif;font-weight:700;font-size:22px;color:#1e3a6b;background:#fff;
  border:3px solid #ffd23f;border-radius:18px;padding:4px 14px;box-shadow:0 4px 10px rgba(0,0,0,.15);
  animation:tcBub .4s cubic-bezier(.3,1.6,.5,1) .25s forwards}
.tc-star{position:absolute;left:50%;top:40%;font-size:22px;line-height:1;opacity:0;
  animation:tcStar .9s ease-out .2s forwards}
@keyframes tcPop{0%{transform:translate(-50%,110%)}22%{transform:translate(-50%,-6%)}30%{transform:translate(-50%,0)}
  78%{transform:translate(-50%,0)}100%{transform:translate(-50%,115%)}}
@keyframes tcHop{from{transform:translateY(0) scale(1,1)}to{transform:translateY(-18px) scale(.96,1.04) rotate(-4deg)}}
@keyframes tcBub{to{transform:translateX(-50%) scale(1)}}
@keyframes tcStar{0%{opacity:1;transform:translate(-50%,-50%) scale(.3)}
  100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(1.2) rotate(var(--r))}}
@media (max-width:520px){.tc-ted{width:118px}.tc-bub{font-size:18px}}
@media (prefers-reduced-motion:reduce){.tc-ted{animation:none;transform:translate(-50%,0)}.tc-ted img,.tc-bub,.tc-star{animation:none}
  .tc-bub{transform:translateX(-50%) scale(1)}.tc-star{display:none}}`;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  const pick = a => a[Math.floor(Math.random() * a.length)];
  let cur = null, timer = 0;

  window.skTeddyCheer = function(word){
    if(cur){ cur.remove(); clearTimeout(timer); }
    const wrap = document.createElement("div");
    wrap.className = "tc-wrap";
    wrap.setAttribute("aria-hidden", "true");
    const ted = document.createElement("div");
    ted.className = "tc-ted";
    ted.style.left = (18 + Math.random() * 64) + "%";   // щоразу в іншому місці, але не за краєм
    let stars = "";
    for(let i = 0; i < 9; i++){
      const a = (Math.PI * 2 * i) / 9 + Math.random() * .4, d = 80 + Math.random() * 50;
      stars += `<span class="tc-star" style="--dx:${Math.round(Math.cos(a) * d)}px;--dy:${Math.round(Math.sin(a) * d - 30)}px;` +
               `--r:${Math.round(Math.random() * 180)}deg;color:${pick(STAR_COLORS)}">★</span>`;
    }
    ted.innerHTML = stars + `<span class="tc-bub">${word || pick(WORDS)}</span>` +
                    `<img src="${BASE}img/teddy/${pick(POSES)}.webp" alt="" draggable="false">`;
    wrap.appendChild(ted);
    document.body.appendChild(wrap);
    cur = wrap;
    timer = setTimeout(() => { wrap.remove(); if(cur === wrap) cur = null; }, 1700);
  };
})();

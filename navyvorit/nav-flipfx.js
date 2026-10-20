/* ============================================================
   nav-flipfx.js — анімація з логотипом Світу навиворіт у мить
   🔄 Перевороту: фіолетовий спалах, логотип (img/flip-symbol.webp)
   вилітає з центру з обертом, навколо розлітаються зірочки.
   Виклик: navFlipLogo().  NAV.flipAnim() (nav-common.js) викликає сам.
   ============================================================ */
(function(){
  'use strict';
  var LOGO = "img/flip-symbol.webp";
  new Image().src = LOGO;   // заздалегідь, щоб не блимало
  function css(){
    if(document.getElementById("navFlipCss")) return;
    var st = document.createElement("style"); st.id = "navFlipCss";
    st.textContent =
      "#navFlipFx{position:fixed; inset:0; z-index:95; pointer-events:none; display:grid; place-items:center; overflow:hidden;" +
        "background:radial-gradient(circle at 50% 45%,rgba(204,120,255,.55),rgba(90,30,170,.25) 45%,transparent 70%); animation:nffBg 1.4s ease-out forwards;}" +
      "#navFlipFx img{width:min(62vw,280px); height:auto; filter:drop-shadow(0 0 22px rgba(220,160,255,.95)) drop-shadow(0 8px 12px rgba(40,0,80,.5)); animation:nffLogo 1.4s cubic-bezier(.3,1.4,.5,1) forwards;}" +
      "#navFlipFx .sp{position:absolute; left:50%; top:45%; font-size:26px; color:#ffe9a8; text-shadow:0 0 10px #d48cff; animation:nffSp 1.2s ease-out forwards;}" +
      "@keyframes nffBg{0%{opacity:0}15%{opacity:1}70%{opacity:1}100%{opacity:0}}" +
      "@keyframes nffLogo{0%{transform:scale(.1) rotate(-200deg); opacity:0}35%{transform:scale(1.15) rotate(15deg); opacity:1}55%{transform:scale(1) rotate(0)}75%{transform:scale(1) rotate(0); opacity:1}100%{transform:scale(1.6) rotate(180deg); opacity:0}}" +
      "@keyframes nffSp{0%{transform:translate(-50%,-50%) scale(.3); opacity:0}20%{opacity:1}100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(1.1); opacity:0}}";
    document.head.appendChild(st);
  }
  window.navFlipLogo = function(){
    css();
    var old = document.getElementById("navFlipFx"); if(old) old.remove();
    var fx = document.createElement("div"); fx.id = "navFlipFx"; fx.setAttribute("aria-hidden", "true");
    fx.innerHTML = '<img src="'+LOGO+'" alt="">';
    for(var i = 0; i < 14; i++){
      var a = i/14*Math.PI*2 + Math.random()*.3, r = 130 + Math.random()*90, s = document.createElement("span");
      s.className = "sp"; s.textContent = i%3 ? "✦" : "★";
      s.style.setProperty("--dx", Math.round(Math.cos(a)*r)+"px"); s.style.setProperty("--dy", Math.round(Math.sin(a)*r)+"px");
      s.style.animationDelay = (0.25 + Math.random()*0.2)+"s";
      fx.appendChild(s);
    }
    document.body.appendChild(fx);
    setTimeout(function(){ fx.remove(); }, 1500);
  };
})();

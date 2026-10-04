/* ============================================================
   sk-prize.js — поп-ап нагороди за ПЕРШЕ повне проходження тренажера.

   Обгортка над sk-rewards.js (SKREWARD.claim): видає нагороду з адмінки
   (предмет → інвентар Героя, монети, характеристика) і показує її
   у поп-апі поверх гри. Що саме отримано, пам'ятає ключ <key> у
   localStorage (простір sk_* — синхронізується per-Hero), щоб стартова
   сторінка могла показати картку «Ти отримав нагороду — …».

   Підключення (після firebase-config / sk-items / sk-curriculum / sk-rewards):
     <script src="../sk-prize.js?v=1"></script>

   API:
     SKPRIZE.summary(key)            → null | {} | {coins, names[], stat}
     SKPRIZE.doneText(p, fallback)   → {got, go} — тексти для картки на старті
     SKPRIZE.claim({key, href, title, onClose})
        • зараховує запис (skFinishRecord, якщо сторінку відкрито з «Тестів»)
        • видає нагороду й показує поп-ап;
        • не Герой / офлайн — поп-ап-привітання без нагороди, ключ не ставимо,
          тож наступного разу Герой ще забере свою нагороду.
   ============================================================ */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  var CSS =
    '.skp-ov{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;' +
    'padding:18px;background:rgba(44,43,58,.45);backdrop-filter:blur(3px);animation:skpFade .25s ease}' +
    '@keyframes skpFade{from{opacity:0}to{opacity:1}}' +
    '@keyframes skpPop{from{transform:scale(.85);opacity:0}to{transform:none;opacity:1}}' +
    '@keyframes skpTrophy{0%,100%{transform:rotate(0)}45%{transform:rotate(-8deg) scale(1.08)}70%{transform:rotate(6deg)}}' +
    '.skp-card{width:min(380px,100%);max-height:100%;overflow-y:auto;background:linear-gradient(180deg,#fffdf4,#fff6df);' +
    'border:3px solid #f4c842;border-radius:24px;padding:20px 18px 18px;text-align:center;color:#2c2b3a;' +
    'font-family:"Nunito",system-ui,sans-serif;box-shadow:0 0 0 4px #fff9e6,0 12px 28px rgba(44,43,58,.25);' +
    'display:flex;flex-direction:column;align-items:center;gap:10px;animation:skpPop .3s ease}' +
    '.skp-ic{font-size:54px;line-height:1;animation:skpTrophy 2.4s ease-in-out infinite}' +
    '.skp-title{font-family:"Fredoka",sans-serif;font-weight:700;font-size:26px;color:#1e3a6b;line-height:1.1}' +
    '.skp-got{font-family:"Fredoka",sans-serif;font-weight:700;font-size:17px;color:#ff7a5c;line-height:1.25}' +
    '.skp-why{display:block;margin-top:4px;font-family:"Nunito";font-weight:700;font-size:11px;color:#6b6a7d;word-break:break-word}' +
    '.skp-note{font-weight:800;font-size:13px;color:#6b6a7d;line-height:1.35}' +
    '.skp-chip{display:inline-flex;align-items:center;gap:8px;font-family:"Fredoka",sans-serif;font-weight:700;' +
    'padding:6px 16px;border-radius:999px}' +
    '.skp-coins{background:#fff6df;border:2px solid #f4c842;color:#8a5e16;font-size:18px}' +
    '.skp-stat{background:#eaf7ef;border:2px solid #9ad8b4;color:#1f7a4d;font-size:15px}' +
    '.skp-item{position:relative;display:flex;align-items:center;gap:12px;text-align:left;background:#fff;' +
    'border:3px solid #ece3d2;border-radius:18px;padding:10px;width:100%;margin-top:6px}' +
    '.skp-new{position:absolute;top:-10px;left:12px;background:#ff7a5c;color:#fff;font-family:"Fredoka";' +
    'font-weight:700;font-size:10px;letter-spacing:.5px;padding:2px 9px;border-radius:8px}' +
    '.skp-pic{width:64px;height:64px;flex:none;border-radius:14px;display:grid;place-items:center;font-size:34px;' +
    'background:linear-gradient(160deg,#efe4ff,#d3bcff)}' +
    '.skp-pic img{width:100%;height:100%;object-fit:contain;padding:6px}' +
    '.skp-name{font-family:"Fredoka",sans-serif;font-weight:700;font-size:16px;line-height:1.15}' +
    '.skp-bonus{display:inline-block;margin-top:4px;background:#e4f7ec;color:#37b26f;font-weight:800;font-size:12px;' +
    'padding:2px 8px;border-radius:8px}' +
    '.skp-meta{color:#6b6a7d;font-weight:700;font-size:12px;margin-top:4px}' +
    '.skp-btn{margin-top:6px;width:100%;border:none;border-radius:18px;padding:14px 20px;cursor:pointer;' +
    'font-family:"Fredoka",sans-serif;font-weight:700;font-size:19px;color:#fff;background:#51cf66;box-shadow:0 6px 0 #37a052}' +
    '.skp-btn:active{transform:translateY(3px);box-shadow:0 3px 0 #37a052}' +
    '.skp-wait{font-weight:800;font-size:13px;color:#6b6a7d}';

  function injectCss() {
    if (document.getElementById('skp-css')) return;
    var st = document.createElement('style');
    st.id = 'skp-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  function summary(key) {
    var raw = null;
    try { raw = localStorage.getItem(key); } catch (e) {}
    if (!raw) return null;
    if (raw.charAt(0) !== '{') return {};
    try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
  }
  function store(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }

  /* Тексти для картки «Тренажер пройдено» на стартовій сторінці. */
  function doneText(p, fallback) {
    p = p || {};
    var got = (p.names && p.names.length)
      ? ('Ти отримав нагороду — ' + p.names.join(', ') + '!')
      : (fallback || 'Тренажер пройдено — нагороду отримано!');
    var bits = [];
    if (p.coins) bits.push(p.coins + ' 🪙');
    if (p.stat && p.stat.value) {
      var ic = (String(p.stat.label || '').match(/[\u{1F300}-\u{1FAFF}☀-➿❤️]+/u) || [''])[0];
      bits.push('+' + p.stat.value + ' ' + (ic || p.stat.label));
    }
    bits.push('Вирушай за новими досягненнями!');
    return { got: got, go: bits.join(' · ') };
  }

  function itemsHtml(items) {
    return (items || []).map(function (it) {
      var b = it.bonus > 1.15 ? '+20%' : (it.bonus > 1 ? '+10%' : (it.bonus < 1 ? '−10%' : ''));
      return '<div class="skp-item"><span class="skp-new">НОВЕ</span>' +
        '<div class="skp-pic"><img src="' + esc(it.img) + '" alt="' + esc(it.name) + '" ' +
        'onerror="this.onerror=null;this.parentNode.textContent=\'🎁\'"></div>' +
        '<div><div class="skp-name">' + esc(it.name) + '</div>' +
        (b ? '<span class="skp-bonus">✨ Бонус ' + b + '</span>' : '') +
        '<div class="skp-meta">Додано в інвентар героя</div></div></div>';
    }).join('');
  }

  var busy = false;

  function claim(opt) {
    opt = opt || {};
    if (busy) return Promise.resolve(null);
    busy = true;
    injectCss();

    var ov = document.createElement('div');
    ov.className = 'skp-ov';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = '<div class="skp-card"><div class="skp-ic">🏆</div>' +
      '<div class="skp-title">' + esc(opt.title || 'Тренажер пройдено!') + '</div>' +
      '<div class="skp-body"><div class="skp-wait">Відкриваємо нагороду… 🎁</div></div>' +
      '<button class="skp-btn" type="button">Чудово! 🎉</button></div>';
    document.body.appendChild(ov);
    var body = ov.querySelector('.skp-body');
    function close() {
      if (ov.parentNode) ov.parentNode.removeChild(ov);
      if (typeof opt.onClose === 'function') { try { opt.onClose(); } catch (e) {} }
    }
    ov.querySelector('.skp-btn').addEventListener('click', close);

    try { if (window.skFinishRecord) window.skFinishRecord(); } catch (e) {}   // зарахувати запис (якщо з «Тестів»)

    var p = window.SKREWARD ? window.SKREWARD.claim(opt.href) : Promise.resolve({ skipped: true, reason: 'no-sk' });
    return p.catch(function () { return { skipped: true, reason: 'error' }; }).then(function (res) {
      busy = false;
      res = res || { skipped: true };
      var html = '';
      if (res.skipped) {
        html = '<div class="skp-got">Молодець! Ти пройшов увесь тренажер 🎉</div>' +
          (res.reason === 'not-hero'
            ? '<div class="skp-note">Увійди як Герой — і отримаєш за це нагороду в інвентар!</div>'
            : '');
      } else if (res.failed) {
        html = '<div class="skp-got">Нагорода не збереглась — заберемо її, щойно буде звʼязок 🎁' +
          '<span class="skp-why">' + esc(res.failed.join(' · ')) + '</span></div>';
      } else if (res.already) {
        if (!summary(opt.key)) store(opt.key, { at: Date.now() });   // забрано раніше (напр. на іншому пристрої)
        html = (res.restored && res.items && res.items.length)
          ? '<div class="skp-got">Ось твоя нагорода: ' + esc(res.items.map(function (x) { return x.name; }).join(', ')) + '!</div>' + itemsHtml(res.items)
          : '<div class="skp-got">Нагороду за цей тренажер ти вже отримав 🏅</div>';
      } else {
        var names = (res.items || []).map(function (x) { return x.name; });
        html = '<div class="skp-got">' + (names.length ? '🎁 Ти отримав: ' + esc(names.join(', ')) + '!' : '🎁 Ти отримав нагороду!') + '</div>';
        if (res.coins > 0) html += '<span class="skp-chip skp-coins">+' + res.coins + ' 🪙 монет</span>';
        if (res.stat) html += '<span class="skp-chip skp-stat">✨ +' + esc(res.stat.value) + ' до «' + esc(res.stat.label) + '»</span>';
        html += itemsHtml(res.items);
        store(opt.key, { at: Date.now(), coins: res.coins || 0, names: names,
          stat: res.stat ? { label: res.stat.label, value: res.stat.value } : null });
      }
      body.innerHTML = html;
      return res;
    });
  }

  window.SKPRIZE = { claim: claim, summary: summary, doneText: doneText };
})();

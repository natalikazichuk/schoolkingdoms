/* ════════════════════════════════════════════════════════════════
   sk-book.js — Книга вмінь і панель вмінь у вікні Інвентарю (arena.html).
   Стилі — sk-book.css; правила (очки, рівні, панель, тексти) — sk-skills.js.

   Стан — у документі героя (skills / skillBar / heroClass / skillBonus).
   Змінює його лише сервер: SK.learnSkill / SK.setSkillBar / SK.chooseClass
   (server/app/src/skills.js перевіряє тими самими правилами). Тут —
   показ і жести, а після відповіді сервера — його версія стану.

   Жести (як у макеті maket-vminnia.html):
     тап по активному вмінню — обрати, потім тап по слоту панелі;
     подвійний тап — у вільний слот; перетягнути — в будь-який слот
     (зайнятий — заміна, старе повертається в книгу; між слотами — обмін);
     тап по вмінню на панелі або витягнути його назовні — назад у книгу.

   Точки підключення в arena.html:
     #ek-slots   — EK малює слоти, а SKBOOK.btnHtml() дописує кнопку книги;
     #ek-book    — зворот правої панелі (сумка ↔ книга);
     #skbBar     — бокова панель вмінь;
     EKEQUIP.render → SKBOOK.refresh(level) при відкритті Інвентарю.
   ════════════════════════════════════════════════════════════════ */
(function(){
'use strict';
var SKS = window.SKSKILLS;
if (!SKS) return;

var ST = SKS.bookState({});      // стан книги (sk-skills.js bookState)
var LOADED = false, BUSY = false;
var OPEN = false;                // книга відкрита замість сумки
var TAB = 1;                     // 1 | 2 | 3 | 'cls'
var sel = null;                  // обране активне вміння, чекає на слот
var lastTap = { id: null, t: 0 };

var $ = function(id){ return document.getElementById(id); };
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function toast(a, b){ if (window.showToast) window.showToast(a, b || ''); }
function hero(){ return !!(window.SK && SK.isHeroSession && SK.isHeroSession()); }
function inBattle(){
  if (window.SKARENA_LIVE && window.SKARENA_LIVE()) return true;
  var sc = document.getElementById('screen-battle');               // екран бою вже відкрито (бій щойно стартує)
  return !!(sc && !sc.classList.contains('hidden'));
}

function sk(id){ return SKS.byId(id); }
function learned(id){ return Object.prototype.hasOwnProperty.call(ST.skills, id); }
function pct(id){ return SKS.mastery(ST, id); }
function free(){ return Math.max(0, SKS.freePoints(ST)); }
function onBar(id){ return ST.bar.indexOf(id) !== -1; }
function isActive(id){ var s = sk(id); return !!(s && s.type === 'A'); }
function toNext(id){
  var p = pct(id); if (p >= 100) return 0;
  var tot = SKS.growTotal(sk(id));
  return Math.max(1, Math.ceil(SKS.usesForPct(p + 1, tot) - ST.skills[id]));
}
function plural(n, a, b, c){ n = Math.abs(n) % 100; var d = n % 10; return (n > 10 && n < 20) ? c : d === 1 ? a : (d >= 2 && d <= 4) ? b : c; }

/* ── сервер ── */
function apply(r){
  if (!r) return;
  var h = { arena: { level: ST.lv }, skills: r.skills, skillBar: r.skillBar, heroClass: r.heroClass, skillBonus: r.skillBonus };
  ST = SKS.bookState(h);
}
function send(fn, args, okMsg){
  if (!hero()) { toast('Книга вмінь', 'Вміння вивчає сам Герой — увійди Героєм'); return Promise.resolve(); }
  if (BUSY) return Promise.resolve();
  BUSY = true;
  return SK[fn].apply(SK, args).then(function(r){
    apply(r); BUSY = false; render();
    if (okMsg) toast(okMsg[0], okMsg[1]);
  }, function(e){
    BUSY = false; render();
    toast('Не вийшло', (e && e.message) || 'спробуй ще раз');
    return refresh();
  });
}
function refresh(level){
  if (level != null) ST.lv = Math.max(1, Math.floor(Number(level) || 1));
  if (!(window.SK && SK.getHero)) { render(); return Promise.resolve(); }
  return (SK.ready || Promise.resolve()).then(function(){ return SK.getHero(); }).then(function(h){
    var lv = ST.lv;
    ST = SKS.bookState(h || {});
    if (level != null) ST.lv = lv;           // рівень арени — той, що бачить Інвентар
    LOADED = true; render(); askClass();
  }, function(){ LOADED = true; render(); });
}

/* ── вікно «Обери свій клас» ──
   З'являється, коли Герой дійшов до CLASS_LEVEL і ще без класу. Вибір можна
   відкласти: тоді вікно більше не набридає (sk_cls_later — у прогресі Героя),
   а обрати клас можна будь-коли в 📖 Книзі вмінь → ✨ Клас. */
var LATER_KEY = 'sk_cls_later', ASKED = false, PICK = null;
function later(){ try { return !!localStorage.getItem(LATER_KEY); } catch (e) { return false; } }
function askClass(force){
  if (!hero() || ST.cls || ST.lv < SKS.CLASS_LEVEL || inBattle()) return;
  if (!force && (ASKED || later())) return;
  var res = $('result'); if (!force && res && !res.hidden) return;   // не поверх підсумку бою
  ASKED = true; PICK = null; drawAsk();
}
function drawAsk(){
  var w = $('skbAsk');
  if (!w) { w = document.createElement('div'); w.id = 'skbAsk'; w.className = 'skb-ask'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true'); document.body.appendChild(w); }
  var cards = Object.keys(SKS.CLASSES).map(function(k){
    var c = SKS.CLASSES[k], ex = SKS.forClass(k).filter(function(x){ return x.lv <= 2; }).slice(0, 4).map(function(x){ return esc(x.name); }).join(' · ');
    return '<button class="skb-ccard' + (PICK === k ? ' on' : '') + '" type="button" data-skb-ask="' + k + '"><span class="ci">' + c.icon + '</span><b>' + c.name + '</b>'
      + '<p>' + esc(c.about) + '</p><p class="ex">⭐ Головне: ' + esc(c.stat) + '<br>📖 ' + ex + '</p></button>';
  }).join('');
  var c = PICK && SKS.CLASSES[PICK];
  w.innerHTML = '<div class="skb-ask-card"><div class="skb-ask-h">✨ Час обрати свій шлях!</div>'
    + '<p class="skb-ask-t">Ти досяг ' + SKS.CLASS_LEVEL + ' рівня. Обери клас — він дасть нові вміння й власний стиль бою. '
    + '<b>Клас обирається один раз.</b> Не поспішай: можна відкласти й обрати пізніше в <b>📖 Книзі вмінь → ✨ Клас</b>.</p>'
    + '<div class="skb-cls">' + cards + '</div>'
    + '<div class="skb-acts">' + (c ? '<button class="skb-learn" type="button" data-skb-ask-ok="' + PICK + '">' + c.icon + ' Так, я — ' + c.name + '</button>' : '<span class="skb-note">Натисни на клас, щоб обрати</span>')
    + '<button class="skb-mini" type="button" data-skb-ask-later="1">⏳ Оберу пізніше</button></div></div>';
  w.hidden = false;
}
function closeAsk(){ var w = $('skbAsk'); if (w) w.hidden = true; }
document.addEventListener('click', function(e){
  var t = e.target, b;
  if (!t.closest) return;
  if ((b = t.closest('[data-skb-ask]'))) { PICK = b.getAttribute('data-skb-ask'); drawAsk(); return; }
  if ((b = t.closest('[data-skb-ask-ok]'))) { var k = b.getAttribute('data-skb-ask-ok'); closeAsk();
    send('chooseClass', [k], [SKS.CLASSES[k].icon + ' Тепер ти — ' + SKS.CLASSES[k].name + '!', 'Вміння класу — у 📖 Книзі вмінь → ' + SKS.CLASSES[k].icon + ' Клас']); return; }
  if (t.closest('[data-skb-ask-later]') || t.id === 'skbAsk') {
    try { localStorage.setItem(LATER_KEY, String(Date.now())); } catch (e2) {}
    closeAsk(); toast('⏳ Добре, обереш пізніше', 'Клас чекає в 📖 Книзі вмінь → ✨ Клас'); }
});
// арена: книгу (і вибір класу) підтягуємо одразу, а не лише при відкритті Інвентаря
(function boot(){
  var n = 0;
  (function w(){
    if (window.SK && SK.ready) { (SK.ready || Promise.resolve()).then(function(){ if (hero()) refresh(); }); return; }
    if (n++ < 100) setTimeout(w, 100);
  })();
})();

/* ── плитка вміння ── */
function tile(id, o){
  o = o || {};
  var s = sk(id), L = learned(id), p = pct(id);
  var cls = 'skb-sk' + (s.type === 'A' ? ' act' : '') + (!L ? ' none' : p >= 100 ? ' max' : '');
  if (o.drag) cls += ' drag';
  if (sel === id && !o.inBar) cls += ' sel';
  return '<div class="' + cls + '" style="--p:' + (L ? p : 0) + '" data-skb="' + id + '"' + (o.from != null ? ' data-skb-from="' + o.from + '"' : '') + '>'
    + '<div class="in">' + (SKS.iconHtml ? SKS.iconHtml(id) : s.icon) + '</div>'
    + (L && !o.inBar ? '<span class="pc">' + (p >= 100 ? '👑 100%' : p + '%') + '</span>' : '')
    + (o.lock ? '<div class="lk">🔒</div>' : '') + '</div>';
}

/* ── кнопка під слотами ── */
function btnHtml(){
  var f = LOADED && hero() ? free() : 0;
  return '<button class="skb-btn' + (OPEN ? ' on' : '') + '" id="skbBtn" type="button" aria-pressed="' + OPEN + '"><span class="bi">📖</span>'
    + '<span class="bt">Книга вмінь<small>' + (OPEN ? 'відкрита →' : 'вміння й заклинання') + '</small></span>'
    + (f > 0 ? '<span class="skb-badge" title="Вільні очки вмінь">✨' + f + '</span>' : '') + '</button>';
}
function paintBtn(){
  var b = $('skbBtn'); if (!b) return;
  var tmp = document.createElement('div'); tmp.innerHTML = btnHtml();
  b.replaceWith(tmp.firstChild);
}

/* ── бокова панель ── */
function renderBar(){
  var host = $('skbBar'); if (!host) return;
  var n = SKS.barSlots(ST.lv), h = '<h4>⚡ Панель<br>вмінь</h4>';
  for (var i = 0; i < SKS.BAR_N; i++){
    var id = ST.bar[i];
    if (i >= n) { h += '<div class="skb-slot lock" data-skb-slot="' + i + '">🔒<br>' + SKS.BAR_LEVELS[i] + ' рів.</div>'; continue; }
    h += '<div class="skb-slot' + (id ? ' full' : '') + (sel ? ' want' : '') + '" data-skb-slot="' + i + '" title="' + esc(id && sk(id) ? sk(id).name : 'Порожній слот') + '">'
      + '<span class="k">' + (i + 1) + '</span>' + (id && sk(id) ? tile(id, { drag: true, from: i, inBar: true }) : '') + '</div>';
  }
  h += '<div class="hint">' + (sel ? 'Торкнись слота для «' + esc(sk(sel).name) + '»' : 'Активні вміння для бою.<br>Торкнись — повернеш у книгу') + '</div>';
  host.innerHTML = h;
  var w = document.querySelector('.ward');
  var sides = document.querySelector('.skb-sides');
  if (w && sides) w.style.setProperty('--skb-dock', sides.offsetHeight + 'px');
}

/* ── книга ── */
/* список вмінь двома групами: спершу активні, далі пасивні; у кожній — вищий рівень зверху */
function groupsHTML(list){
  var by = function(a, b){ return (b.lv || 1) - (a.lv || 1); };
  var grp = function(act, title){
    var l = list.filter(function(s){ return (s.type === 'A') === act; }).sort(by);
    return l.length ? '<div class="skb-grp">' + title + ' <small>' + l.length + '</small></div>' + l.map(function(s){ return rowHTML(s.id); }).join('') : '';
  };
  return grp(true, '⚡ Активні') + grp(false, '🛡️ Пасивні');
}
function rowHTML(id){
  var s = sk(id), L = learned(id), lock = s.lv > ST.lv, p = pct(id);
  var can = hero() && !L && !lock && free() > 0;
  var st;
  if (lock) st = '<div class="skb-st mut">🔒 Відкриється на ' + s.lv + ' рівні</div>';
  else if (!L) st = '<div class="skb-st mut">' + (free() > 0 ? 'Ще не вивчено' : 'Потрібне очко вмінь') + '</div>';
  else if (p >= 100) st = '<div class="skb-st">👑 Майстер! ' + esc(SKS.effectText(id, 1)) + '</div>';
  else st = '<div class="skb-st">Зараз: ' + esc(SKS.effectText(id, p / 100)) + ' · ще ' + toNext(id) + ' до ' + (p + 1) + '%</div>';
  var left = (L && isActive(id) && onBar(id))
    ? '<div class="skb-sk spot" data-skb-ret="' + id + '" title="На панелі — торкнись, щоб повернути"><div class="in">⚡ на<br>панелі</div></div>'
    : tile(id, { drag: L && isActive(id), lock: lock });
  return '<div class="skb-row' + (can ? ' can' : '') + (lock ? ' lock' : '') + '">' + left
    + '<div class="skb-txt" data-skb-info="' + id + '"><div class="skb-nm">' + esc(s.name) + ' <span class="skb-tag ' + (s.type === 'A' ? 'a">АКТИВНЕ' : 'p">ПАСИВНЕ') + '</span>'
    + (TAB === 'cls' ? '<span class="skb-tag lv">рів. ' + (s.lv || 1) + '</span>' : '') + '</div>'
    + '<div class="skb-kid">' + esc(s.kid) + '</div>' + st + '</div>'
    + (can ? '<button class="skb-learn" type="button" data-skb-learn="' + id + '"' + (BUSY ? ' disabled' : '') + '>✨ Вивчити</button>' : '') + '</div>';
}
function renderBook(){
  var host = $('ek-book'); if (!host) return;
  var f = free();
  var h = '<div class="skb-ph"><b>📖 Книга вмінь</b>'
    + (hero() ? '<span class="skb-chip' + (f > 0 ? '' : ' zero') + '">✨ ' + f + ' ' + plural(f, 'очко', 'очки', 'очок') + '</span>' : '')
    + '<button class="skb-mini" type="button" data-skb-close="1">🎒 Сумка</button></div>';
  var t = '';
  [1, 2, 3].forEach(function(lv){
    var has = f > 0 && SKS.UNIVERSAL.some(function(s){ return s.lv === lv && s.lv <= ST.lv && !learned(s.id); });
    t += '<button class="skb-tab' + (TAB === lv ? ' on' : '') + (has && TAB !== lv ? ' glow' : '') + '" type="button" data-skb-tab="' + lv + '">'
      + (lv > ST.lv ? '🔒 ' : '') + 'Рівень ' + lv + '</button>';
  });
  var ready = ST.lv >= SKS.CLASS_LEVEL;
  var clsNew = ready && (!ST.cls || (f > 0 && SKS.readyFor && SKS.readyFor(ST.cls).some(function(s){ return s.lv <= ST.lv && !learned(s.id); })));
  t += '<button class="skb-tab' + (TAB === 'cls' ? ' on' : '') + (clsNew && TAB !== 'cls' ? ' glow' : '') + '" type="button" data-skb-tab="cls">'
    + (!ready ? '🔒 ' : ST.cls ? SKS.CLASSES[ST.cls].icon + ' ' : '✨ ') + 'Клас</button>';
  h += '<div class="skb-tabs">' + t + '</div><div class="skb-list">';
  if (!LOADED) h += '<div class="skb-msg">Завантаження…</div>';
  else if (TAB === 'cls') h += clsHTML(ready);
  else {
    if (!hero()) h += '<div class="skb-msg">Вміння вивчає сам Герой. Увійди Героєм, щоб вивчати й ставити їх на панель.</div>';
    h += groupsHTML(SKS.UNIVERSAL.filter(function(s){ return s.lv === TAB; }));
  }
  host.innerHTML = h + '</div>';
}
function clsHTML(ready){
  if (!ready) return '<div class="skb-msg">🔒 На ' + SKS.CLASS_LEVEL + ' рівні ти обереш свій шлях: Лицар, Слідопит, Чарівник чи Цілитель. Тоді тут з\'являться вміння класу.</div>';
  if (!ST.cls) return '<div class="skb-msg">✨ Час обрати свій шлях! Клас обирається один раз — подумай, як тобі подобається битися.</div><div class="skb-cls">'
    + Object.keys(SKS.CLASSES).map(function(k){ var c = SKS.CLASSES[k];
        return '<button class="skb-ccard" type="button" data-skb-cls="' + k + '"><span class="ci">' + c.icon + '</span><b>' + c.name + '</b><p>' + esc(c.about) + '</p></button>'; }).join('') + '</div>';
  var c = SKS.CLASSES[ST.cls], list = SKS.readyFor ? SKS.readyFor(ST.cls).filter(function(s){ return s.lv <= ST.lv; }) : [];
  if (!list.length) return '<div class="skb-msg">' + c.icon + ' Ти — <b>' + c.name + '</b>. Вміння класу з\'являться тут у наступному оновленні.</div>';
  return '<div class="skb-msg">' + c.icon + ' Ти — <b>' + c.name + '</b>. Вміння класу вивчаються за очки вмінь, як і звичайні. Нові з\'являтимуться з оновленнями.</div>'
    + groupsHTML(list);
}
function render(){
  var f = $('ek-flip'); if (f) f.classList.toggle('book', OPEN);
  paintBtn(); renderBar(); renderBook(); paintBattle();
}

/* ── колонка вмінь у бою (arena.html → #btSkills) ──
   bs — стан бою (SKBATTLE): вміння й майстерність — знімок на старті бою;
   тап по вмінню (arena.html → bindSkills) обирає його на хід: окремий удар у ту
   саму зону, що й основний. Без бою — просто показ панелі з книги. */
var BS = null;
function paintBattle(bs){
  if (bs !== undefined) BS = bs;
  var aw = $('skbAsk');
  if (BS && BS.status === 'live' && aw && !aw.hidden) { closeAsk(); ASKED = false; }   // вибір класу — не посеред бою; спитаємо після
  var host = $('btSkills'); if (!host) return;
  var b = (BS && BS.status === 'live' && BS.me && BS.me.sk) ? BS : null;
  var lv = b ? (b.me.level || ST.lv) : ST.lv, n = SKS.barSlots(lv), h = '<h4>⚡ Вміння</h4>', any = false;
  var ids = b ? (b.me.bar || []).slice() : ST.bar.slice();
  for (var i = 0; i < SKS.BAR_N; i++){
    if (i >= n) { h += '<div class="skb-slot lock" title="Відкриється на ' + SKS.BAR_LEVELS[i] + ' рівні">🔒<br>' + SKS.BAR_LEVELS[i] + ' рів.</div>'; continue; }
    var id = b ? ids[i] : ST.bar[i], s = id && sk(id);
    if (!s) { h += '<div class="skb-slot" title="Порожній слот: постав вміння в Інвентарі → 📖 Книга вмінь"><span class="k">' + (i + 1) + '</span></div>'; continue; }
    any = true;
    var p = b ? Math.round(Number(b.me.sk[id] || 0) * 100) : pct(id);
    var cls = 'skb-slot full skb-bt', badge = '', tip = s.name + ' — ' + SKS.effectText(id, p / 100);
    if (b) {
      // обране вміння на перезарядці / без мани — теж сіре: цього ходу не спрацює, але вибір лишається
      var cd = (b.me.cd || {})[id], sel2 = b.me.skill === id;
      if (sel2) cls += ' on';
      var why = window.SKBATTLE ? SKBATTLE.skillBlock(b, id) : '';
      if (why === 'cd') { cls += ' cd'; badge = '<span class="skb-cd">' + (cd - b.round + 1) + '</span>'; tip += sel2 ? ' · обрано, спрацює після перезарядки' : ' · перезарядка'; }
      else if (why === 'mana') { cls += ' cd'; badge = '<span class="skb-cd">💧</span>'; tip += sel2 ? ' · обрано, спрацює, коли буде мана' : ' · мало мани'; }
      else if (why === 'shield') { cls += ' cd'; badge = '<span class="skb-cd">🛡️</span>'; tip += ' · потрібен щит у лівій руці'; }
      else if (why === 'noshield') { cls += ' cd'; badge = '<span class="skb-cd">💥</span>'; tip += ' · у суперника немає щита'; }
      else if (why === 'used') { cls += ' cd'; badge = '<span class="skb-cd">✔</span>'; tip += ' · уже використано в цьому бою'; }
      else if (why === 'weapon') { cls += ' cd'; badge = '<span class="skb-cd">🗡️</span>'; tip += ' · не тією зброєю (або її вибито)'; }
      else if (why === 'active') { cls += ' cd'; badge = '<span class="skb-cd">✨</span>'; tip += ' · ще діє'; }
      else if (why === 'knock') { cls += ' cd'; badge = '<span class="skb-cd">😵</span>'; tip += ' · тебе збили з ніг: цей хід без дій'; }
      else if (why === 'swap') { cls += ' cd'; badge = '<span class="skb-cd">🔁</span>'; tip += ' · цього ходу ти вже перевдягнувся'; }
      else if (sel2) tip += ' · спрацює цього ходу';
    }
    var cls2 = 'skb-sk' + (s.type === 'A' ? ' act' : '') + (p >= 100 ? ' max' : '');
    h += '<div class="' + cls + '" data-skb-use="' + id + '" title="' + esc(tip) + '"><span class="k">' + (i + 1) + '</span>'
      + '<div class="' + cls2 + '" style="--p:' + p + '"><div class="in">' + (SKS.iconHtml ? SKS.iconHtml(id) : s.icon) + '</div></div>' + badge + '</div>';
  }
  var hint = !any ? 'Постав вміння:<br>Інвентар → 📖'
    : b ? (b.me.skill ? 'Б\'є щоходу, коли<br>доступне · ще раз — зняти' : 'Торкнись — вміння<br>битиме щоходу') : '';
  if (b && (b.me.bar || []).some(function (x) { return b.me.skv && b.me.skv[x] && b.me.skv[x].mana; })) hint += '<br>💧 мана: ' + Math.round(Number(b.me.mana) || 0);   // вміння, що беруть ману
  host.innerHTML = h + (hint ? '<div class="hint">' + hint + '</div>' : '');
}

/* ── дії ── */
function saveBar(bar, msg){ return send('setSkillBar', [bar], msg); }
function place(id, slot){
  if (inBattle()) return toast('⚔ Герой у бою', 'Панель вмінь змінюється після бою');
  if (slot >= SKS.barSlots(ST.lv)) return toast('🔒 Слот закритий', 'Відкриється на ' + SKS.BAR_LEVELS[slot] + ' рівні');
  var bar = ST.bar.slice(), from = bar.indexOf(id), old = bar[slot];
  if (from !== -1) bar[from] = (from !== slot ? old : null);   // з панелі на панель — обмін
  bar[slot] = id;
  sel = null; lastTap = { id: null, t: 0 };
  var msg = (old && old !== id && from === -1) ? ['🔁 Заміна', '«' + sk(old).name + '» повернулось у книгу'] : null;
  ST.bar = bar; render();                                    // одразу показуємо, сервер підтвердить
  return saveBar(bar, msg);
}
function autoPlace(id){
  if (onBar(id)) return;
  var n = SKS.barSlots(ST.lv);
  for (var i = 0; i < n; i++) if (!ST.bar[i]) return place(id, i);
  sel = id; render();
  toast('Панель повна', 'Торкнись слота, щоб замінити');
}
function unplace(slot){
  var id = ST.bar[slot]; if (!id) return;
  if (inBattle()) return toast('⚔ Герой у бою', 'Панель вмінь змінюється після бою');
  var bar = ST.bar.slice(); bar[slot] = null;
  sel = null; lastTap = { id: null, t: 0 };
  ST.bar = bar; render();
  return saveBar(bar, ['📖 У книзі', '«' + sk(id).name + '» повернулось у книгу']);
}
function tapSkill(id){
  if (!learned(id) || !isActive(id)) return info(id);
  var now = Date.now(), dbl = lastTap.id === id && now - lastTap.t < 380;
  lastTap = { id: id, t: now };
  if (dbl) { sel = null; return autoPlace(id); }
  sel = (sel === id ? null : id); render();
}
function learn(id){
  closeSheet();
  return send('learnSkill', [id], ['✨ Вивчено «' + sk(id).name + '»', '25%!' + (isActive(id) ? ' Постав його на панель ⚡' : '')]);
}

/* ── картка вміння ── */
function sheet(html){
  var bg = $('skbSheet');
  if (!bg) { bg = document.createElement('div'); bg.id = 'skbSheet'; bg.className = 'skb-sheet-bg'; bg.hidden = true;
    bg.innerHTML = '<div class="skb-sheet" role="dialog" aria-modal="true"></div>'; document.body.appendChild(bg); }
  bg.firstChild.innerHTML = html; bg.hidden = false;
}
function closeSheet(){ var bg = $('skbSheet'); if (bg) bg.hidden = true; }
function info(id){
  var s = sk(id), L = learned(id), p = pct(id), lock = s.lv > ST.lv;
  var marks = SKS.GROWTH.stages.map(function(g){ return '<b style="left:' + ((g[0] - 25) / 75 * 100) + '%"></b>'; }).join('');
  var h = '<div class="skb-top">' + tile(id) + '<div><h3>' + esc(s.name) + '</h3><span class="skb-tag ' + (s.type === 'A' ? 'a">АКТИВНЕ' : 'p">ПАСИВНЕ') + '</span>'
    + (s.cost ? ' <span class="skb-tag p">' + esc(s.cost) + '</span>' : '') + '</div></div>'
    + '<div class="kid">' + esc(s.kid) + '</div>'
    + '<div class="skb-fx"><div class="now"><small>Зараз (' + (L ? p : 0) + '%)</small>' + (L ? esc(SKS.effectText(id, p / 100)) : 'ще не вивчено') + '</div>'
    + '<div class="max"><small>На 100% 👑</small>' + esc(SKS.effectText(id, 1)) + '</div></div>';
  if (L && p < 100) h += '<div class="skb-prog"><div class="tr"><i style="width:' + ((p - 25) / 75 * 100) + '%"></i>' + marks + '</div>'
    + '<div class="cap"><span>25%</span><span>ще ' + toNext(id) + ' до ' + (p + 1) + '%</span><span>100%</span></div></div>';
  h += '<div class="skb-note">' + (s.type === 'A'
      ? '⚡ Активне: став на панель вмінь — у бою це кнопка. Росте щоразу, як використовуєш (навіть якщо не вдалось).'
      : '🌀 Пасивне: діє саме, на панель ставити не треба. Росте, коли в бою трапляється потрібна ситуація.') + '</div>';
  if (s.mech) h += '<details class="skb-mech"><summary>Для дорослих: точні правила</summary>'
    + s.mech.map(function(r){ return '<div><b>' + esc(r[0]) + '</b><span>' + esc(r[1]) + '</span></div>'; }).join('') + '</details>';
  h += '<div class="skb-acts">';
  if (lock) h += '<button class="skb-mini" type="button" disabled>🔒 Відкриється на ' + s.lv + ' рівні</button>';
  else if (!L) h += (hero() && free() > 0) ? '<button class="skb-learn" type="button" data-skb-confirm="' + id + '">✨ Вивчити за 1 очко</button>'
                                           : '<button class="skb-mini" type="button" disabled>' + (hero() ? 'Потрібне очко вмінь' : 'Вивчає сам Герой') + '</button>';
  else if (isActive(id)) h += onBar(id) ? '<button class="skb-mini" type="button" data-skb-unbar="' + id + '">📖 Зняти з панелі</button>'
                                        : '<button class="skb-learn" type="button" data-skb-tobar="' + id + '">⚡ На панель</button>';
  h += '<button class="skb-mini" type="button" data-skb-x="1">Закрити</button></div>';
  sheet(h);
}
function confirmLearn(id){
  var acts = document.querySelector('#skbSheet .skb-acts'); if (!acts) return;
  acts.innerHTML = '<div class="skb-note" style="width:100%;margin:0 0 6px">Вивчене вміння лишається назавжди. Вивчити «' + esc(sk(id).name) + '»?</div>'
    + '<button class="skb-learn" type="button" data-skb-learn="' + id + '">✨ Так, вивчити</button><button class="skb-mini" type="button" data-skb-info-back="' + id + '">Ні</button>';
}
function pickClass(k){
  var c = SKS.CLASSES[k];
  sheet('<div class="skb-top"><div class="skb-sk max"><div class="in">' + c.icon + '</div></div><div><h3>' + c.name + '</h3></div></div>'
    + '<div class="kid">' + esc(c.about) + '</div><div class="skb-note">Клас обирається один раз. Обрати «' + c.name + '»?</div>'
    + '<div class="skb-acts"><button class="skb-learn" type="button" data-skb-pick="' + k + '">' + c.icon + ' Так, я — ' + c.name + '</button>'
    + '<button class="skb-mini" type="button" data-skb-x="1">Ще подумаю</button></div>');
}

/* ── натискання (кнопки, вкладки, картки) ── */
document.addEventListener('click', function(e){
  var t = e.target, b;
  if (t.closest('#skbBtn')) { OPEN = !OPEN; sel = null; render(); return; }
  if (t.closest('[data-skb-close]')) { OPEN = false; sel = null; render(); return; }
  if ((b = t.closest('[data-skb-tab]'))) { var v = b.getAttribute('data-skb-tab'); TAB = v === 'cls' ? 'cls' : +v; renderBook(); return; }
  if ((b = t.closest('[data-skb-cls]'))) { pickClass(b.getAttribute('data-skb-cls')); return; }
  if ((b = t.closest('[data-skb-pick]'))) { var k = b.getAttribute('data-skb-pick'); closeSheet();
    send('chooseClass', [k], [SKS.CLASSES[k].icon + ' Тепер ти — ' + SKS.CLASSES[k].name + '!']); return; }
  if ((b = t.closest('[data-skb-learn]'))) { learn(b.getAttribute('data-skb-learn')); return; }
  if ((b = t.closest('[data-skb-confirm]'))) { confirmLearn(b.getAttribute('data-skb-confirm')); return; }
  if ((b = t.closest('[data-skb-info-back]'))) { info(b.getAttribute('data-skb-info-back')); return; }
  if ((b = t.closest('[data-skb-tobar]'))) { closeSheet(); autoPlace(b.getAttribute('data-skb-tobar')); return; }
  if ((b = t.closest('[data-skb-unbar]'))) { closeSheet(); unplace(ST.bar.indexOf(b.getAttribute('data-skb-unbar'))); return; }
  if ((b = t.closest('[data-skb-ret]'))) { unplace(ST.bar.indexOf(b.getAttribute('data-skb-ret'))); return; }
  if ((b = t.closest('[data-skb-info]'))) { info(b.getAttribute('data-skb-info')); return; }
  if (t.closest('[data-skb-x]') || t.id === 'skbSheet') { closeSheet(); return; }
});
document.addEventListener('keydown', function(e){
  if (e.key !== 'Escape') return;
  var bg = $('skbSheet');
  if (bg && !bg.hidden) { closeSheet(); e.stopPropagation(); return; }
  if (sel) { sel = null; render(); }
}, true);

/* ── перетягування й торкання плиток (миша і палець) ── */
var drag = null;
document.addEventListener('pointerdown', function(e){
  if (e.target.closest('.skb-sheet')) return;
  var tl = e.target.closest('.skb-sk[data-skb]');
  var slot = e.target.closest('.skb-slot[data-skb-slot]');
  if (!tl && slot && !slot.classList.contains('lock')) { drag = { kind: 'slot', slot: +slot.getAttribute('data-skb-slot'), x: e.clientX, y: e.clientY }; return; }
  if (!tl) return;
  var from = tl.getAttribute('data-skb-from');
  drag = { kind: 'tile', id: tl.getAttribute('data-skb'), from: from != null ? +from : null, x: e.clientX, y: e.clientY,
           moved: false, el: tl, canDrag: tl.classList.contains('drag') };
  if (drag.canDrag && tl.setPointerCapture) tl.setPointerCapture(e.pointerId);
});
document.addEventListener('pointermove', function(e){
  if (!drag || drag.kind !== 'tile' || !drag.canDrag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
  if (!drag.moved) {
    drag.moved = true;
    drag.ghost = drag.el.cloneNode(true); drag.ghost.classList.add('skb-ghost'); drag.ghost.classList.remove('sel');
    document.body.appendChild(drag.ghost);
    document.querySelectorAll('.skb-slot:not(.lock)').forEach(function(s){ s.classList.add('want'); });
  }
  drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px';
  document.querySelectorAll('.skb-slot.over').forEach(function(s){ s.classList.remove('over'); });
  var under = document.elementFromPoint(e.clientX, e.clientY);
  var s = under && under.closest('.skb-slot:not(.lock)');
  if (s) s.classList.add('over');
  e.preventDefault();
});
document.addEventListener('pointerup', function(e){
  if (!drag) return;
  var d = drag; drag = null;
  if (d.kind === 'slot') {
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) <= 8 && sel) place(sel, d.slot);
    return;
  }
  if (d.ghost) {
    d.ghost.remove();
    var under = document.elementFromPoint(e.clientX, e.clientY);
    var s = under && under.closest('.skb-slot');
    if (s && !s.classList.contains('lock')) place(d.id, +s.getAttribute('data-skb-slot'));
    else if (s) toast('🔒 Слот закритий', 'Відкриється на ' + SKS.BAR_LEVELS[+s.getAttribute('data-skb-slot')] + ' рівні');
    else if (d.from != null) unplace(d.from);                 // витягнули з панелі назовні — у книгу
    else render();
    return;
  }
  if (d.from != null) { if (sel && sel !== d.id) place(sel, d.from); else unplace(d.from); return; }
  tapSkill(d.id);
});
document.addEventListener('pointercancel', function(){ if (drag && drag.ghost) drag.ghost.remove(); drag = null; render(); });

window.SKBOOK = {
  btnHtml: btnHtml,
  refresh: refresh,
  render: render,
  paintBattle: paintBattle,
  isOpen: function(){ return OPEN; },
  close: function(){ OPEN = false; sel = null; closeSheet(); render(); },
  state: function(){ return ST; },
  askClass: askClass
};
})();

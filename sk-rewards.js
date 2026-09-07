/* ============================================================
   sk-rewards.js — видача нагород за тренажери (window.SKREWARD)
   ------------------------------------------------------------
   Джерело нагород: curriculum/trainers (той самий документ, що редагує
   адмінка). Кожен запис має href і масив rewards:[{item,chance,coins}].

   Потік при завершенні тренажера:
     1) знайти нагороди свого тренажера за href сторінки;
     2) кинути шанс кожного слота (chance %); слоти, що випали, дають
        предмет (екземпляр із бонусом через SKIT) і/або монети;
     3) атомарно й ОДИН раз видати через SK.grantTrainerReward
        (пише в інвентар + монети + позначку trainerRewards[href]);
     4) повернути список отриманого — для попапа «Ти отримав …!».

   Залежності: window.SK (firebase-config.js) і window.SKIT (sk-items.js).
   Без сесії Героя / без модулів → { skipped:true }, попап показує
   просто святкування без конкретики.
   ============================================================ */
(function (root) {
  'use strict';

  var _linksCache = null;

  function floor(n) { return Math.floor(n); }

  /* Нормалізуємо href до порівнюваного вигляду: лишаємо останній сегмент
     шляху, без параметрів і якоря, у нижньому регістрі.
       'games/vchymo-litery.html?x=1#a' -> 'vchymo-litery.html'
       './Vchymo-Litery.html'           -> 'vchymo-litery.html' */
  function normHref(h) {
    h = String(h || '').trim();
    if (!h) return '';
    h = h.split('#')[0].split('?')[0];
    var seg = h.split('/').pop();
    return seg.toLowerCase();
  }

  /* Список записів тренажерів (кешуємо на сторінку). */
  function loadLinks() {
    if (_linksCache) return Promise.resolve(_linksCache);
    if (!(root.SK && root.SK.getTrainers)) { _linksCache = []; return Promise.resolve(_linksCache); }
    return root.SK.getTrainers().then(function (doc) {
      _linksCache = (doc && Array.isArray(doc.links)) ? doc.links : [];
      return _linksCache;
    }).catch(function () { _linksCache = []; return _linksCache; });
  }

  /* Нагороди конкретного тренажера за href. -> [{item,chance,coins}] */
  function rewardsFor(href) {
    var target = normHref(href);
    return loadLinks().then(function (links) {
      for (var i = 0; i < links.length; i++) {
        var l = links[i];
        if (l && normHref(l.href) === target) {
          return Array.isArray(l.rewards) ? l.rewards : [];
        }
      }
      return [];
    });
  }

  /* Чи випав слот за своїм шансом (за замовчуванням 100%). */
  function rolls(chance) {
    var c = (chance == null) ? 100 : Math.max(0, Math.min(100, Number(chance) || 0));
    if (c >= 100) return true;
    if (c <= 0) return false;
    return (Math.random() * 100) < c;
  }

  /* Головний виклик: забрати нагороду за тренажер (одноразово).
     href — ім'я сторінки тренажера (можна повний шлях/URL).
     -> Promise<{
          skipped:Boolean,   // не сесія Героя / нема модулів → просто свято
          already:Boolean,   // нагороду вже видавали раніше
          coins:Number,      // скільки монет нараховано зараз
          items:[{ id,name,img,bonus }]  // отримані предмети
        }> */
  function claim(href) {
    var EMPTY = { skipped: false, already: false, coins: 0, items: [] };
    if (!(root.SK && root.SK.ready)) return Promise.resolve({ skipped: true, already: false, coins: 0, items: [] });

    return root.SK.ready.then(function () {
      var isHero = root.SK.isHeroSession && root.SK.isHeroSession();
      if (!isHero) return { skipped: true, already: false, coins: 0, items: [] };

      // Стабільний ключ одноразовості: завжди ім'я сторінки, а не повний URL,
      // інакше 'vchymo-litery.html' і '…/vchymo-litery.html?x=1' видали б двічі.
      var grantKey = normHref(href);

      return rewardsFor(href).then(function (rewards) {
        if (!rewards || !rewards.length) return EMPTY;

        // каталог потрібен лише коли серед нагород є предмети
        var needItems = rewards.some(function (r) { return r && String(r.item || '').trim(); });
        var pCat = needItems && root.SK.listItems ? root.SK.listItems() : Promise.resolve([]);

        return pCat.then(function (catalog) {
          var byId = {};
          (catalog || []).forEach(function (b) { byId[b.id] = b; });

          var instances = [], items = [], coins = 0;
          rewards.forEach(function (r) {
            if (!r) return;
            if (!rolls(r.chance)) return;                 // слот не випав
            coins += Math.max(0, floor(Number(r.coins) || 0));
            var id = String(r.item || '').trim();
            if (id && byId[id] && root.SKIT && root.SKIT.makeInstance) {
              var inst = root.SKIT.makeInstance(byId[id]);  // кидає бонус один раз
              instances.push(inst);
              items.push({
                id: id,
                name: byId[id].name || id,
                img: 'img/items/' + id + '.webp',
                bonus: inst.bonus
              });
            }
          });

          if (!instances.length && !coins) return EMPTY;    // усе повз шанс

          return root.SK.grantTrainerReward(grantKey, { instances: instances, coins: coins })
            .then(function (res) {
              if (res && res.already) return { skipped: false, already: true, coins: 0, items: [] };
              // видано успішно
              return { skipped: false, already: false, coins: coins, items: items };
            })
            .catch(function () {
              // запис не вдався (напр. офлайн) — не брешемо про предмети,
              // повертаємо «пропущено», щоб спробувати ще наступного разу
              return { skipped: true, already: false, coins: 0, items: [] };
            });
        });
      });
    }).catch(function () { return { skipped: true, already: false, coins: 0, items: [] }; });
  }

  root.SKREWARD = {
    claim: claim,
    rewardsFor: rewardsFor,
    normHref: normHref,
    _reset: function () { _linksCache = null; }
  };
})(typeof window !== 'undefined' ? window : this);

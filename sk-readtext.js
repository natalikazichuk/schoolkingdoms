/* ============================================================
   sk-readtext.js — тексти й вірші для тренажера «Читаю вголос»
   (klas-1/chytannia-vgolos.html) і їхній попередній перегляд в адмінці
   (admin-chytannia.html). Глобал: SKREAD.

   Запис тексту (колекція readTexts, або вбудований BUILTIN):
     { id, title, author, kind:'poem'|'text', grade, text, pics:[…] }
   text — звичайний текст:
     • вірш  — рядок вірша = рядок; строфи розділяє порожній рядок;
     • текст — абзаци розділяє порожній рядок; абзац ділимо на речення
       й складаємо сторінки до PAGE_WORDS слів.
   pics — картинка до кожного рядка (вірш) або речення (текст) підряд:
     шлях у репо (img/…) чи URL; порожньо — без картинки.

   SKREAD.parse(запис) → { id, title, author, kind, stanzas:[[рядок…]…], pics }
   ============================================================ */
(function(){
  'use strict';

  var PAGE_WORDS = 30;   // текст: приблизно стільки слів на одну сторінку

  var BUILTIN = [{
    id: 'mova',
    title: 'Мова наша, мова',
    author: '',
    kind: 'poem',
    grade: 0,
    text: [
      'Мова наша, мова —', 'мова кольорова.', 'В ній гроза травнева', 'й тиша вечорова.', '',
      'Мова наша, мова...', 'Літ минувших повість,', 'вічна наша мудрість,', 'сива наша совість.', '',
      'Я без тебе, мово,', 'без зерна полова,', 'соняшник без сонця,', 'без птахів діброва.'
    ].join('\n'),
    pics: ['01','02','03','04','05','06','07','12','08','09','10','11']
      .map(function(n){ return 'img/chytannia/mova-' + n + '.webp'; })
  }, {
    id: 'harbuz',
    title: 'Гарбузова родина',
    author: 'Українська народна пісенька',
    kind: 'poem',
    grade: 0,
    text: [
      'Ходить гарбуз по городу,', 'Питається свого роду:', '— Ой, чи живі, чи здорові', 'Всі родичі гарбузові?', '',
      'Обізвалась жовта диня,', 'Гарбузова господиня:', '— Іще живі, ще здорові', 'Всі родичі гарбузові!', '',
      'Обізвались огірочки,', 'Гарбузові сини й дочки:', '— Іще живі, ще здорові', 'Всі родичі гарбузові!', '',
      'Обізвалася квасоля,', 'А за нею й бараболя:', '— Іще живі, ще здорові', 'Всі родичі гарбузові!', '',
      'Обізвались буряки,', 'Гарбузові свояки:', '— Іще живі, ще здорові', 'Всі родичі гарбузові!', '',
      'Обізвався старий біб:', '— Я іздержав увесь рід!', 'Іще живі, ще здорові', 'Всі родичі гарбузові!', '',
      'Ой ти, гарбуз, ти перістий,', 'Із чим тебе будем їсти?', '— Миску пшона, трошки сала,', 'От до мене вся приправа!'
    ].join('\n'),
    /* одна картинка на строфу (4 рядки); 04 — квасоля й бараболя, малюнка ще нема:
       порожній шлях = рядок без картинки */
    pics: ['01','02','03','','05','06','07'].reduce(function(a, n){
      var src = n ? 'img/chytannia/harbuz-' + n + '.webp' : '';
      return a.concat([src, src, src, src]);
    }, [])
  }];

  function blocks(raw){
    return String(raw || '').replace(/\r/g, '').split(/\n[ \t]*\n/)
      .map(function(b){ return b.trim(); }).filter(Boolean);
  }
  function lines(b){
    return b.split('\n').map(function(s){ return s.trim(); }).filter(Boolean);
  }
  /* Речення разом із розділовими знаками й закривними лапками. */
  function sentences(b){
    var t = b.replace(/\s+/g, ' ').trim();
    var m = t.match(/[^.!?…]+(?:[.!?…]+["»”)]*|$)/g) || [t];
    return m.map(function(s){ return s.trim(); }).filter(Boolean);
  }
  function wordCount(s){ return s.split(/\s+/).filter(Boolean).length; }

  function parse(e){
    e = e || {};
    var kind = e.kind === 'text' ? 'text' : 'poem';
    var stanzas = [];
    blocks(e.text).forEach(function(b){
      if(kind === 'poem'){
        var l = lines(b);
        if(l.length) stanzas.push(l);
        return;
      }
      var page = [], n = 0;
      sentences(b).forEach(function(s){
        var w = wordCount(s);
        if(page.length && n + w > PAGE_WORDS){ stanzas.push(page); page = []; n = 0; }
        page.push(s); n += w;
      });
      if(page.length) stanzas.push(page);
    });
    return {
      id: e.id || '',
      title: String(e.title || '').trim() || 'Без назви',
      author: String(e.author || '').trim(),
      kind: kind,
      stanzas: stanzas,
      pics: (Array.isArray(e.pics) ? e.pics : []).map(function(p){ return String(p || '').trim(); })
    };
  }

  /* Шлях до картинки зі сторінки в підтеці: base = '../' для klas-1/. */
  function picUrl(p, base){
    p = String(p || '').trim();
    if(!p) return '';
    if(/^(https?:|data:|\/)/i.test(p)) return p;
    return (base || '') + p;
  }

  function lineCount(t){
    return (t.stanzas || []).reduce(function(n, st){ return n + st.length; }, 0);
  }
  function words(t){
    return (t.stanzas || []).reduce(function(n, st){
      return n + st.reduce(function(m, l){ return m + wordCount(l); }, 0);
    }, 0);
  }

  window.SKREAD = { BUILTIN: BUILTIN, parse: parse, picUrl: picUrl, lineCount: lineCount, words: words };
})();

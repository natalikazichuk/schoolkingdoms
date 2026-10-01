/* ============================================================
   sk-covers.js — обкладинка теми за її назвою.

   Картка теми бере обкладинку так: поле «Обкладинка» в адмінці →
   img/tr/<назва-сторінки>.webp (для тренажерів-посилань) → картинка
   за назвою теми (тут) → емодзі. Те саме — на стартовому екрані тесту.

     SKCovers.byTitle('Мережа Інтернет')  // → 'img/tr/inf1-merezha-internet.webp'
     SKCovers.byTitle('Додавання')        // → ''

   Порядок важливий: «Прості алгоритми» раніше за «Алгоритми»,
   «Безпечний Інтернет» — раніше за «Мережу Інтернет».
   ============================================================ */
(function(){
  var TITLE_IMG = [
    /* Інформатика 1 кл. */
    [/миш.*клавіатур/,                 'inf1-mysha-klaviatura'],
    [/пристрої навколо/,               'inf1-mysha-klaviatura-2'],
    [/детектив/,                       'komputer'],
    [/послідовн.*дій/,                 'inf1-poslidovnist-diy'],
    [/прості алгоритм/,                'inf1-prosti-alhorytmy'],
    [/^алгоритм/,                      'inf1-alhorytmy'],
    [/робота з файл/,                  'inf1-robota-z-failamy'],
    [/інформаці.*джерел/,              'inf1-informatsiya-dzherela'],
    [/безпечн.*інтернет/,              'inf1-bezpechnyy-internet'],
    [/мереж.*інтернет/,                'inf1-merezha-internet'],
    [/правила роботи за компютер/,     'inf1-pravyla-roboty'],
    [/компютер і його частин/,         'inf1-komputer-chastyny']
  ];
  function byTitle(title){
    var s = String(title||'').toLowerCase().replace(/[’'`ʼ]/g,'').trim();
    for(var i=0;i<TITLE_IMG.length;i++) if(TITLE_IMG[i][0].test(s)) return 'img/tr/'+TITLE_IMG[i][1]+'.webp';
    return '';
  }
  window.SKCovers = { byTitle: byTitle };
})();

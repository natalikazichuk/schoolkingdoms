/* ============================================================
   sk-covers.js — обкладинка теми за її назвою.

   Картка теми бере обкладинку так: поле «Обкладинка» в адмінці →
   img/tr/<назва-сторінки>.webp (для тренажерів-посилань) → картинка
   за назвою теми (тут) → емодзі. Те саме — на стартовому екрані тесту.

     SKCovers.byTitle('Мережа Інтернет')  // → 'img/tr/inf1-merezha-internet.webp'
     SKCovers.byTitle('Додавання')        // → ''
     SKCovers.bySubject('Інформатика', 1)  // → обкладинка предмета для решти тем

   Тема без власної обкладинки і без збігу за назвою бере обкладинку
   предмета й класу (bySubject), якщо така є.

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
    [/компютер і його частин/,         'inf1-komputer-chastyny'],
    /* Українська мова. «Слово. Назви, ознаки та дії…» — раніше за окремі
       «Назви/Дії/Ознаки предметів»; «приголосні» містить «голосні»,
       тож «Голосні та приголосні» ловимо лише з початку назви. */
    [/^слово([.,: ]|$)/,              'ukr-slovo'],
    [/букви і звуки/,                  'ukr-bukvy-zvuky'],
    [/порядок букв/,                   'ukr-poryadok-bukv'],
    [/порядок літер/,                  'ukr-poryadok-liter'],
    [/дзвінк.*глух/,                   'ukr-dzvinki-hlukhi'],
    [/тверд.*мяк/,                     'ukr-tverdi-miaki'],
    [/^голосні.*приголосн/,            'ukr-holosni-pryholosni'],
    [/назви предметів/,                'ukr-nazvy-predmetiv'],
    [/дії предметів/,                  'ukr-dii-predmetiv-2'],
    [/ознаки предметів/,               'ukr-oznaky-predmetiv'],
    [/велик.*мал.*літер/,              'ukr-velyka-mala'],
    [/літер.*письмов|письмов.*літер/,  'ukr-znaidy-pysmovu'],
    [/^списуван/,                      'ukr-spysuvannya'],
    [/вчимос.? писати/,                'ukr-vchymos-pysaty'],
    [/мовний квест/,                   'ukr-movnyi-kvest'],
    [/^текст/,                         'ukr-tekst'],
    [/^речення/,                       'ukr-rechennya']
  ];
  function byTitle(title){
    var s = String(title||'').toLowerCase().replace(/[’'`ʼ]/g,'').trim();
    for(var i=0;i<TITLE_IMG.length;i++) if(TITLE_IMG[i][0].test(s)) return 'img/tr/'+TITLE_IMG[i][1]+'.webp';
    return '';
  }
  var SUBJ_IMG = [
    [/інформат|informat/, 1, 'inf1-informatyka']
  ];
  function bySubject(subj, grade){
    var s = String(subj||'').toLowerCase(), n = Number(grade)||0;
    for(var i=0;i<SUBJ_IMG.length;i++) if(SUBJ_IMG[i][1]===n && SUBJ_IMG[i][0].test(s)) return 'img/tr/'+SUBJ_IMG[i][2]+'.webp';
    return '';
  }
  window.SKCovers = { byTitle: byTitle, bySubject: bySubject };
})();

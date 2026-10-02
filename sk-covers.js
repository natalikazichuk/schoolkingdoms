/* ============================================================
   sk-covers.js — обкладинка теми за її назвою.

   Картка теми бере обкладинку так: поле «Обкладинка» в адмінці →
   img/tr/<назва-сторінки>.webp (для тренажерів-посилань) → картинка
   за назвою теми (тут) → емодзі. Те саме — на стартовому екрані тесту.

     SKCovers.byTitle('Мережа Інтернет')  // → 'img/tr/inf1-merezha-internet.webp'
     SKCovers.byTitle('Додавання')        // → ''
     SKCovers.byTitle('Досягнення', 'ЯДС')  // третій елемент правила — предмет:
                                         // таке правило діє лише для нього
     SKCovers.bySubject('Інформатика', 1)  // → обкладинка предмета для решти тем

   Тема без власної обкладинки і без збігу за назвою бере обкладинку
   предмета й класу (bySubject), якщо така є.

   FORCED — короткий список тем, де картинка звідси важливіша за поле
   «Обкладинка» в адмінці (там лишились старі картинки, які треба
   замінити). Для цих тем поле в адмінці не діє:
     SKCovers.forced('Додавання до 10')  // → абакус, навіть якщо в адмінці інше

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
    [/^речення/,                       'ukr-rechennya'],
    /* ЯДС */
    [/державн.*символ/,                'yads-symvoly'],
    [/батьківщин/,                     'yads-batkivshchyna'],
    [/^моє місто|^місто/,              'yads-misto'],
    [/^моя школа/,                     'yads-shkola'],
    [/школярик/,                       'yads-shkolyaryk'],
    [/^я і (моя )?родина|^моя родина|^родина|^сімя/, 'yads-rodyna'],
    [/дружба/,                         'yads-druzhba'],
    [/безпека вдома|безпека вдомі/,    'yads-bezpeka-vdoma'],
    [/безпека на вулиці/,              'yads-bezpeka-vulytsia'],
    [/правила дорожнього руху|^пдр/,   'yads-pdr'],
    [/пожежн/,                         'yads-pozhezhna'],
    [/вода.*повітря|повітря.*ґрунт/,   'yads-voda-povitria'],
    [/^досліди|дослідження за природ/, 'yads-doslidy'],
    [/осінь.*зима|пори року/,          'yads-pory-roku'],
    [/^рослини/,                       'yads-roslyny'],
    [/^тварини/,                       'yads-tvaryny'],
    [/екологі|бережлив.*природ/,       'yads-ekolohiya'],
    [/погода/,                         'yads-pohoda'],
    [/корисна їжа|здорове харчування/, 'yads-korysna-yizha'],
    [/здоровий спосіб/,                'yads-zdorovya'],
    [/професі|ким бути/,               'yads-profesii'],
    [/досягнен|успіх/,                 'yads-dosyahnennya', /ядс|досліджую|світ/],
    [/гроші|фінанс|заощадж|кишеньков/, 'yads-hroshi', /ядс|досліджую|світ/],
    [/досягти результат/,              'yads-zirka-shchyt'],
    /* Математика та загальні */
    [/канікул/,                        'mat-kanikuly'],
    [/досягнен|успіх/,                 'mat-dosyahnennya'],
    [/попереднє.*наступне|наступне.*попереднє/, 'mat-poperednie-nastupne'],
    [/лабіринт/,                       'mat-labiryint'],
    [/пазл/,                           'mat-pazly'],
    [/компонент.*додаван/,             'mat-komp-dodavannya'],
    [/компонент.*відніман/,            'mat-komp-vidnimannya'],
    [/компонент.*рівн/,                'mat-komp-dii-rivni'],
    [/компоненти дій/,                 'mat-komp-dii'],
    [/одиниці довжини|^довжин/,        'mat-dovzhyna'],
    [/гроші|^монети/,                  'mat-hroshi'],
    [/^маса([^а-яіїєґ]|$)/,            'mat-masa'],
    [/місткість/,                      'mat-mistkist'],
    [/^час([^а-яіїєґ]|$)/,             'mat-chas-2'],
    [/годинник/,                       'mat-hodynnyk'],
    [/дні тижня/,                      'mat-dni-tyzhnya'],
    [/периметр/,                       'mat-perymetr'],
    /* «Геометричні фігури» містить «геометрі», тож фігури — раніше */
    [/геометричн.*фігур|^фігури/,      'mat-figury'],
    [/геометрі/,                       'mat-heometriya'],
    [/порівнян.*чисел/,                'mat-porivnyannya-chysel'],
    [/порівнян.*до 10([^0-9]|$)/,      'mat-porivnyannya-10'],
    [/порівнян.*до 20([^0-9]|$)/,      'mat-porivnyannya-20'],
    [/нестандартн/,                    'mat-nestandartni'],
    [/вежа логіки/,                    'mat-vezha-lohiky'],
    [/логічн.*рівнян/,                 'mat-lohichni-rivnyannya'],
    [/логічне мислення/,               'mat-lohichne-myslennya'],
    [/знайди зайве|^зайве/,            'mat-znaidy-zaive'],
    [/уваг.*спостережлив|^увага|спостережлив/, 'mat-uvaha'],
    [/память/,                         'mat-pamyat'],
    [/кмітлив/,                        'mat-kmitlyvist'],
    [/задачі на додавання/,            'mat-zadachi-dodavannya'],
    [/задачі на віднімання/,           'mat-zadachi-vidnimannya'],
    [/додавання\s*(і|й|та|\/)\s*віднімання/, 'mat-dodavannya-vidnimannya-10'],
    [/невідом.*компонент/,             'mat-nevidomyi-komponent'],
    [/знайди помилку/,                 'mat-znaidy-pomylku-2'],
    [/десятки (і|й) одиниці/,          'mat-desyatky-odynytsi'],
    [/розряд/,                         'mat-rozryad'],
    [/у дві дії|у 2 дії/,              'mat-vyrazy-dvi-dii'],
    [/у три дії|у 3 дії/,              'mat-vyrazy-try-dii']
  ];
  function byTitle(title, subj){
    var s = String(title||'').toLowerCase().replace(/[’'`ʼ]/g,'').trim();
    var sj = String(subj||'').toLowerCase();
    for(var i=0;i<TITLE_IMG.length;i++){
      var r = TITLE_IMG[i];
      if(r[2] && !r[2].test(sj)) continue;
      if(r[0].test(s)) return 'img/tr/'+r[1]+'.webp';
    }
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
  var FORCED = [
    [/попереднє.*наступне|наступне.*попереднє/, 'mat-poperednie-nastupne'],
    [/^додавання до 10([^0-9]|$)/,     'mat-dodavannya-vidnimannya-10'],
    [/^віднімання до 10([^0-9]|$)/,    'mat-dodavannya-vidnimannya-10'],
    [/дні тижня/,                      'mat-dni-tyzhnya']
  ];
  function forced(title){
    var s = String(title||'').toLowerCase().replace(/[’'`ʼ]/g,'').trim();
    for(var i=0;i<FORCED.length;i++) if(FORCED[i][0].test(s)) return 'img/tr/'+FORCED[i][1]+'.webp';
    return '';
  }
  window.SKCovers = { byTitle: byTitle, bySubject: bySubject, forced: forced };
})();

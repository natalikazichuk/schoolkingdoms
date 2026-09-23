/* ============================================================
   sk-phonics.js — спільні дані для англійського читання по звуках (phonics).
   Підключають (звичайним <script>, до коду сторінки):
     • doshkilya/chytaemo-po-zvukakh.html   — «Читаємо по звуках» (картки)
     • doshkilya/vyprobuvannya-zvuky.html   — «Випробування: звуки» (5 міні-ігор)
   Змінюєш слова / етапи — інкремент ?v=N в ОБОХ сторінках.

   window.SKPH = { SOUNDS, STAGES, WORDS, segment, cards, picSrc, sndUrl, wordUrl, isVowel }

   МАЛЮНКИ:  img/phonics/<word>.webp   (прозорий фон, contain)
             поки файлу нема — емодзі-чернетка (поле e).
   ОЗВУЧКА:  говорить голос телефона (синтез en-GB) — той самий, яким
             звучать слова. Якщо поруч покласти файл, він має перевагу:
             audio/phonics/words/phon_<word>.mp3       — слово
             audio/phonics/sounds/phon_s_<grapheme>.mp3 — окремий звук (s, a, sh, ch…)
             (поруч: letters/phon_n_<літера>.mp3 — назви літер,
              male/phon_s_<grapheme>_m.mp3 — звуки чоловічим голосом; поки не вживаються)

   Поле say — це те, що віддаємо синтезатору. Він не вміє вимовляти голу
   фонему: рядок, якого немає в його словнику, він читає ПО БУКВАХ —
   «sss» виходило «ес-ес-ес», «ih» — «ай-ейч», «th» — «ті-ейч».
   Тому кожен say має бути схожий на слово: приголосні з коротким [ə]
   («suh», «tuh»), голосні — вигуками («ahh», «ehh»). Голосні синтез
   усе одно вимовляє приблизно — тут допоможе лише живий запис у mp3.
   (Пробували генерувати звуки машинним синтезом у файли — звучало
   механічно поряд із живим голосом, тож повернулись до голосу телефона.)
   ============================================================ */
(function(){
  'use strict';

  /* say — що віддаємо синтезатору, ua — підказка українською,
     w/e — слово-приклад, що починається з цього звуку. */
  const SOUNDS={
    s:{say:'suh',  ua:'[с]',        w:'sun',     e:'☀️'},
    a:{say:'ahh',   ua:'[е] широке', w:'apple',   e:'🍎'},
    t:{say:'tuh',  ua:'[т]',        w:'tiger',   e:'🐯'},
    p:{say:'puh',  ua:'[п]',        w:'pig',     e:'🐷'},
    i:{say:'ihh',   ua:'[і] коротке',w:'insect',  e:'🐞'},
    n:{say:'nuh',  ua:'[н]',        w:'nest',    e:'🪺'},
    c:{say:'kuh',  ua:'[к]',        w:'cat',     e:'🐱'},
    k:{say:'kuh',  ua:'[к]',        w:'kite',    e:'🪁'},
    e:{say:'ehh',   ua:'[е]',        w:'egg',     e:'🥚'},
    h:{say:'huh',  ua:'[х] легке',  w:'hat',     e:'🎩'},
    r:{say:'ruh',  ua:'[р] мʼяке',  w:'rabbit',  e:'🐰'},
    m:{say:'muh',  ua:'[м]',        w:'moon',    e:'🌙'},
    d:{say:'duh',  ua:'[д]',        w:'dog',     e:'🐶'},
    g:{say:'guh',  ua:'[ґ]',        w:'goat',    e:'🐐'},
    o:{say:'ohh',    ua:'[о]',        w:'octopus', e:'🐙'},
    u:{say:'uhh',   ua:'[а]',        w:'umbrella',e:'☂️'},
    l:{say:'luh',  ua:'[л]',        w:'lion',    e:'🦁'},
    f:{say:'fuh',  ua:'[ф]',        w:'fish',    e:'🐟'},
    b:{say:'buh',  ua:'[б]',        w:'bus',     e:'🚌'},
    w:{say:'wuh',  ua:'[в] губами', w:'web',     e:'🕸️'},
    x:{say:'ex',   ua:'[кс]',       w:'box',     e:'📦'},
    y:{say:'yuh',  ua:'[й]',        w:'yo-yo',   e:'🪀'},
    j:{say:'juh',  ua:'[дж]',       w:'jam',     e:'🍯'},
    sh:{say:'shuh', ua:'[ш]',        w:'ship',    e:'🚢'},
    ch:{say:'chuh',ua:'[ч]',        w:'chip',    e:'🍟'},
    th:{say:'thuh',  ua:'язик між зубами', w:'thumb', e:'👍'},
    ck:{say:'kuh', ua:'[к]',        w:'duck',    e:'🦆'}
  };

  /* ТИМЧАСОВО, поки немає згенерованих audio/phon_s_<g>.mp3: звук-картки
     озвучуються назвою літери, як у Learn ABC («A», «B», диграфи — по буквах
     «S H»). Фонетичні say вище лишаються — повернути їх: поставити false.
     Файли phon_s_*.mp3, щойно з'являться, і так мають перевагу над синтезом. */
  const SAY_LETTER_NAMES=true;
  if(SAY_LETTER_NAMES){
    Object.keys(SOUNDS).forEach(function(g){ SOUNDS[g].say=g.toUpperCase().split('').join(' '); });
  }

  /* Порядок навчання: спершу 3 групи звуків для дошкільнят (кожна з готовими
     словами), далі решта CVC, злиття приголосних, диграфи, довгі слова. */
  const STAGES=[
    {id:1, title:'Перші звуки',          tag:'s a t p i n',
     sounds:['s','a','t','p','i','n'], words:['sat','sit','pin','pit','pat','tap','tip','pan','nap']},
    {id:2, title:'Нові звуки',           tag:'c k e h r m d',
     sounds:['c','k','e','h','r','m','d'], words:['cat','cap','can','bed','red','hen','mad','dad']},
    {id:3, title:'Ще звуки',             tag:'g o u l f b',
     sounds:['g','o','u','l','f','b'], words:['dog','log','fog','bug','sun','run','fun','big','bag']},
    {id:4, title:'Слова з трьох звуків', tag:'hat · pen · pig · box · cup',
     sounds:['w','x','y'], words:['bat','mat','hat','rat','map','pen','ten','pet','net','leg','yes',
       'hit','fit','pig','dig','win','lip','fox','box','hot','pot','top','mop','bus','cup','pup','hut','nut']},
    {id:5, title:'Зливаємо звуки',       tag:'frog · drum · lamp',
     sounds:['j'], words:['frog','flag','clap','plan','crab','stop','swim','drum','milk','hand','sand','lamp','jump','tent','best']},
    {id:6, title:'Дві букви — один звук', tag:'sh · ch · th · ck',
     sounds:['sh','ch','th','ck'], words:['ship','shop','fish','dish','shut','chat','chip','chin','chop','much','rich',
       'thin','this','that','bath','moth','duck','sock','neck','back','rock']},
    {id:7, title:'Довгі слова',          tag:'rab-bit · kit-ten',
     sounds:[], words:['rabbit','carrot','picnic','sunset','bedroom','bathtub','football','chicken','kitten','dentist']}
  ];

  /* tr — переклад, e — емодзі-чернетка ('' = немає однозначного малюнка:
     таке слово не потрапляє в ігри з картинками, доки не буде img/phonics/<w>.webp). */
  const WORDS={
    sat:{tr:'сів',e:''}, sit:{tr:'сидіти',e:'🪑'}, pin:{tr:'шпилька',e:'📌'}, pit:{tr:'яма',e:'🕳️'},
    pat:{tr:'погладити',e:'🤚'}, tap:{tr:'кран',e:'🚰'}, tip:{tr:'кінчик',e:''}, pan:{tr:'сковорідка',e:'🍳'},
    nap:{tr:'дрімати',e:'😴'},
    cat:{tr:'кіт',e:'🐱'}, cap:{tr:'кепка',e:'🧢'}, can:{tr:'бляшанка',e:'🥫'}, bed:{tr:'ліжко',e:'🛏️'},
    red:{tr:'червоний',e:'🔴'}, hen:{tr:'курка',e:'🐔'}, mad:{tr:'сердитий',e:'😠'}, dad:{tr:'тато',e:'👨'},
    dog:{tr:'собака',e:'🐶'}, log:{tr:'колода',e:'🪵'}, fog:{tr:'туман',e:'🌫️'}, bug:{tr:'жучок',e:'🐛'},
    sun:{tr:'сонце',e:'☀️'}, run:{tr:'бігти',e:'🏃'}, fun:{tr:'весело',e:'🎉'}, big:{tr:'великий',e:'🐘'},
    bag:{tr:'сумка',e:'👜'},
    bat:{tr:'кажан',e:'🦇'}, mat:{tr:'килимок',e:''}, hat:{tr:'капелюх',e:'🎩'}, rat:{tr:'щур',e:'🐀'},
    map:{tr:'мапа',e:'🗺️'}, pen:{tr:'ручка',e:'🖊️'}, ten:{tr:'десять',e:'🔟'}, pet:{tr:'улюбленець',e:'🐾'},
    net:{tr:'сітка',e:'🥅'}, leg:{tr:'нога',e:'🦵'}, yes:{tr:'так',e:'✅'}, hit:{tr:'вдарити',e:'👊'},
    fit:{tr:'сильний',e:'💪'}, pig:{tr:'свинка',e:'🐷'}, dig:{tr:'копати',e:'⛏️'}, win:{tr:'перемогти',e:'🏆'},
    lip:{tr:'губа',e:'👄'}, fox:{tr:'лисиця',e:'🦊'}, box:{tr:'коробка',e:'📦'}, hot:{tr:'гарячий',e:'🔥'},
    pot:{tr:'каструля',e:'🍲'}, top:{tr:'верх',e:'🔝'}, mop:{tr:'швабра',e:'🧹'}, bus:{tr:'автобус',e:'🚌'},
    cup:{tr:'чашка',e:'☕'}, pup:{tr:'цуценя',e:''}, hut:{tr:'хатинка',e:'🛖'}, nut:{tr:'горіх',e:'🥜'},
    frog:{tr:'жаба',e:'🐸'}, flag:{tr:'прапор',e:'🚩'}, clap:{tr:'плескати',e:'👏'}, plan:{tr:'план',e:'📝'},
    crab:{tr:'краб',e:'🦀'}, stop:{tr:'стоп',e:'🛑'}, swim:{tr:'плавати',e:'🏊'}, drum:{tr:'барабан',e:'🥁'},
    milk:{tr:'молоко',e:'🥛'}, hand:{tr:'рука',e:'✋'}, sand:{tr:'пісок',e:'🏖️'}, lamp:{tr:'лампа',e:'💡'},
    jump:{tr:'стрибати',e:'🤸'}, tent:{tr:'намет',e:'⛺'}, best:{tr:'найкращий',e:'🥇'},
    ship:{tr:'корабель',e:'🚢'}, shop:{tr:'крамниця',e:'🏪'}, fish:{tr:'риба',e:'🐟'}, dish:{tr:'тарілка',e:'🍽️'},
    shut:{tr:'зачинити',e:'🚪'}, chat:{tr:'балакати',e:'💬'}, chip:{tr:'картопля фрі',e:'🍟'}, chin:{tr:'підборіддя',e:''},
    chop:{tr:'рубати',e:'🪓'}, much:{tr:'багато',e:''}, rich:{tr:'багатий',e:'💰'}, thin:{tr:'тонкий',e:''},
    this:{tr:'цей',e:'👉'}, that:{tr:'той',e:''}, bath:{tr:'ванна',e:'🛁'}, moth:{tr:'метелик-міль',e:''},
    duck:{tr:'качка',e:'🦆'}, sock:{tr:'шкарпетка',e:'🧦'}, neck:{tr:'шия',e:''}, back:{tr:'спина',e:''},
    rock:{tr:'камінь',e:'🪨'},
    rabbit:{tr:'кролик',e:'🐰',syl:['rab','bit']}, carrot:{tr:'морква',e:'🥕',syl:['car','rot']},
    picnic:{tr:'пікнік',e:'🧺',syl:['pic','nic']}, sunset:{tr:'захід сонця',e:'🌇',syl:['sun','set']},
    bedroom:{tr:'спальня',e:'',syl:['bed','room']}, bathtub:{tr:'ванна',e:'',syl:['bath','tub']},
    football:{tr:'футбол',e:'⚽',syl:['foot','ball']}, chicken:{tr:'курча',e:'🐤',syl:['chick','en']},
    kitten:{tr:'кошеня',e:'',syl:['kit','ten']}, dentist:{tr:'стоматолог',e:'🦷',syl:['den','tist']}
  };

  const DIGRAPHS=['sh','ch','th','ck'];
  const VOW='aeiou';
  function isVowel(g){ return !!g && VOW.indexOf(g.charAt(0))>=0; }

  /* Розбити слово на звуки-графеми: 'duck' → d u ck, 'ship' → sh i p.
     Довгі слова (syl) розбиваються на склади. */
  function segment(word){
    const info=WORDS[word];
    if(info && info.syl) return info.syl.map(function(s){ return {g:s, syl:true}; });
    const out=[]; const w=String(word).toLowerCase();
    for(let i=0;i<w.length;){
      const two=w.slice(i,i+2);
      if(DIGRAPHS.indexOf(two)>=0){ out.push({g:two}); i+=2; continue; }
      out.push({g:w.charAt(i)}); i++;
    }
    return out;
  }

  /* Плаский список карток для тренажера: звук-картки етапу, потім його слова. */
  function cards(){
    const list=[];
    STAGES.forEach(function(st){
      st.sounds.forEach(function(g){ list.push({type:'s', id:'s-'+g, g:g, stage:st.id}); });
      st.words.forEach(function(w){ list.push({type:'w', id:'w-'+w, w:w, stage:st.id}); });
    });
    return list;
  }

  /* файли: base — префікс кореня ('../' з doshkilya/) */
  function picSrc(base,word){ return base+'img/phonics/'+word+'.webp'; }
  function wordUrl(base,word){ return base+'audio/phonics/words/phon_'+word+'.mp3'; }
  function sndUrl(base,g){ return base+'audio/phonics/sounds/phon_s_'+g+'.mp3'; }

  window.SKPH={SOUNDS:SOUNDS, STAGES:STAGES, WORDS:WORDS, segment:segment, cards:cards,
               picSrc:picSrc, sndUrl:sndUrl, wordUrl:wordUrl, isVowel:isVowel};
})();

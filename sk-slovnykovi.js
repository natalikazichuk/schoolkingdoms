/* ============================================================
   sk-slovnykovi.js — словникові слова за класами (українська мова).

   Кожен клас — окремий тренажер, що бере свої слова звідси (SK_SLOVNYKOVI[N]):
     1 клас — klas-1/slovnykovi-slova.html
     2–4    — klas-N/slovnykovi-slova-N.html
   Сторінки однакові, клас визначається папкою klas-N/.

   Слово: id — латиницею, унікальний у межах класу (імʼя картинки
   img/sl/<id>.webp і звуку audio/sl_<id>.mp3, якщо колись зʼявляться);
   w — слово так, як його пишуть (з великої — лише власні назви,
   апостроф — «ʼ»); e — емодзі-малюнок.
   ============================================================ */
window.SK_SLOVNYKOVI = {
  1: [
    {id:'tvaryny', name:'Тварини і птахи', ic:'🐾', c:'var(--orange)', words:[
      {id:'bdzhola',   w:'бджола',   e:'🐝'},
      {id:'dzhmil',    w:'джміль',   e:'🐝'},
      {id:'dzob',      w:'дзьоб',    e:'🐦'},
      {id:'zozulia',   w:'зозуля',   e:'🐦'},
      {id:'yizhak',    w:'їжак',     e:'🦔'},
      {id:'leleka',    w:'лелека',   e:'🕊️'},
      {id:'olen',      w:'олень',    e:'🦌'}]},
    {id:'shkola', name:'Школа', ic:'🎒', c:'var(--blue)', words:[
      {id:'virsh',     w:'вірш',     e:'📜'},
      {id:'humka',     w:'гумка',    e:'🧽'},
      {id:'zahadka',   w:'загадка',  e:'❓'},
      {id:'liniyka',   w:'лінійка',  e:'📏'},
      {id:'olivets',   w:'олівець',  e:'✏️'},
      {id:'papir',     w:'папір',    e:'📄'},
      {id:'chytannia', w:'читання',  e:'📖'},
      {id:'kompiuter', w:'компʼютер',e:'💻'},
      {id:'telefon',   w:'телефон',  e:'📱'}]},
    {id:'rechi', name:'Речі й смаколики', ic:'🍬', c:'var(--pink)', words:[
      {id:'lialka',    w:'лялька',    e:'🪆'},
      {id:'parasolka', w:'парасолька',e:'☂️'},
      {id:'kukurudza', w:'кукурудза', e:'🌽'},
      {id:'tsukerka',  w:'цукерка',   e:'🍬'},
      {id:'tsukor',    w:'цукор',     e:'🧂'}]},
    {id:'ridni', name:'Рідні й Батьківщина', ic:'🇺🇦', c:'var(--yellow)', words:[
      {id:'babusia',   w:'бабуся',     e:'👵'},
      {id:'didus',     w:'дідусь',     e:'👴'},
      {id:'podruha',   w:'подруга',    e:'👭'},
      {id:'imia',      w:'імʼя',       e:'🏷️'},
      {id:'kyiv',      w:'Київ',       e:'🏙️'},
      {id:'ukraina',   w:'Україна',    e:'🇺🇦'},
      {id:'ukrainskyi',w:'український',e:'🌻'}]},
    {id:'yakyi', name:'Який? Як?', ic:'✨', c:'var(--purple)', words:[
      {id:'novyi',     w:'новий',      e:'🆕'},
      {id:'radisnyi',  w:'радісний',   e:'😄'},
      {id:'dopytlyvyi',w:'допитливий', e:'🧐'},
      {id:'vyrazno',   w:'виразно',    e:'🗣️'}]}
  ],
  2: [
    {id:'dni', name:'Дні й місяці', ic:'📅', c:'var(--teal)', words:[
      {id:'ponedilok', w:'понеділок', e:'1️⃣'},
      {id:'sereda',    w:'середа',    e:'3️⃣'},
      {id:'chetver',   w:'четвер',    e:'4️⃣'},
      {id:'piatnytsia',w:'пʼятниця',  e:'5️⃣'},
      {id:'veresen',   w:'вересень',  e:'🍂'},
      {id:'kalendar',  w:'календар',  e:'📅'}]},
    {id:'shkola', name:'Школа', ic:'🎒', c:'var(--blue)', words:[
      {id:'alfavit',   w:'алфавіт',   e:'🔤'},
      {id:'zavdannia', w:'завдання',  e:'📝'},
      {id:'pomylka',   w:'помилка',   e:'❌'},
      {id:'predmet',   w:'предмет',   e:'📚'},
      {id:'chernetka', w:'чернетка',  e:'🗒️'},
      {id:'chergovyi', w:'черговий',  e:'🧹'},
      {id:'oznaka',    w:'ознака',    e:'🔍'},
      {id:'noutbuk',   w:'ноутбук',   e:'💻'},
      {id:'riukzak',   w:'рюкзак',    e:'🎒'}]},
    {id:'dim', name:'Дім і місто', ic:'🏠', c:'var(--orange)', words:[
      {id:'dyvan',     w:'диван',     e:'🛋️'},
      {id:'kylym',     w:'килим',     e:'🧶'},
      {id:'vulytsia',  w:'вулиця',    e:'🏘️'},
      {id:'teatr',     w:'театр',     e:'🎭'},
      {id:'cherevyky', w:'черевики',  e:'👞'}]},
    {id:'liudy', name:'Люди й ввічливі слова', ic:'💛', c:'var(--yellow)', words:[
      {id:'bud-laska', w:'будь ласка',   e:'🙏'},
      {id:'do-pobach', w:'до побачення',e:'👋'},
      {id:'dytyna',    w:'дитина',       e:'🧒'},
      {id:'geroi',     w:'герой',        e:'🦸'},
      {id:'medal',     w:'медаль',       e:'🏅'},
      {id:'batkivsh',  w:'Батьківщина',  e:'🇺🇦'},
      {id:'spivchuttia',w:'співчуття',   e:'🤗'}]},
    {id:'lis', name:'Ліс і барви', ic:'🌲', c:'var(--green)', words:[
      {id:'vedmid',    w:'ведмідь',   e:'🐻'},
      {id:'diatel',    w:'дятел',     e:'🐦'},
      {id:'zaiets',    w:'заєць',     e:'🐰'},
      {id:'chervonyi', w:'червоний',  e:'🟥'},
      {id:'dukhmianyi',w:'духмяний',  e:'🌸'}]}
  ],
  3: [
    {id:'smachne', name:'Смачне й рослини', ic:'🍑', c:'var(--orange)', words:[
      {id:'abrykos',   w:'абрикос',   e:'🍑'},
      {id:'apelsyn',   w:'апельсин',  e:'🍊'},
      {id:'apetyt',    w:'апетит',    e:'😋'},
      {id:'pyrih',     w:'пиріг',     e:'🥧'},
      {id:'pshenytsia',w:'пшениця',   e:'🌾'},
      {id:'aistra',    w:'айстра',    e:'🌼'},
      {id:'ocheret',   w:'очерет',    e:'🌿'}]},
    {id:'profesii', name:'Професії й люди', ic:'👷', c:'var(--blue)', words:[
      {id:'deputat',   w:'депутат',   e:'🏛️'},
      {id:'dyrektor',  w:'директор',  e:'👔'},
      {id:'prezydent', w:'президент', e:'🎖️'},
      {id:'kosmonavt', w:'космонавт', e:'👨‍🚀'},
      {id:'fermer',    w:'фермер',    e:'👩‍🌾'},
      {id:'kolektyv',  w:'колектив',  e:'👥'}]},
    {id:'misto', name:'Місто й речі', ic:'🏙️', c:'var(--purple)', words:[
      {id:'adresa',    w:'адреса',    e:'📮'},
      {id:'asfalt',    w:'асфальт',   e:'🛣️'},
      {id:'velosyped', w:'велосипед', e:'🚲'},
      {id:'vokzal',    w:'вокзал',    e:'🚉'},
      {id:'korydor',   w:'коридор',   e:'🚪'},
      {id:'kombain',   w:'комбайн',   e:'🚜'},
      {id:'elektryka', w:'електрика', e:'💡'},
      {id:'akvarium',  w:'акваріум',  e:'🐠'},
      {id:'kyshenia',  w:'кишеня',    e:'👖'}]},
    {id:'miry', name:'Міри й час', ic:'📏', c:'var(--teal)', words:[
      {id:'detsymetr', w:'дециметр',  e:'📏'},
      {id:'santymetr', w:'сантиметр', e:'📐'},
      {id:'sekunda',   w:'секунда',   e:'⏱️'},
      {id:'mynulyi',   w:'минулий',   e:'⏪'}]},
    {id:'yavyshcha', name:'Природа і явища', ic:'⚡', c:'var(--green)', words:[
      {id:'hrymity',   w:'гриміти',   e:'⛈️'},
      {id:'kypity',    w:'кипіти',    e:'♨️'},
      {id:'tryvoha',   w:'тривога',   e:'🚨'},
      {id:'vohnyshche',w:'вогнище',   e:'🔥'},
      {id:'krynytsia', w:'криниця',   e:'🪣'},
      {id:'horyzont',  w:'горизонт',  e:'🌅'}]},
    {id:'rysy', name:'Почуття й риси', ic:'💛', c:'var(--pink)', words:[
      {id:'vdiachnyi', w:'вдячний',     e:'🙏'},
      {id:'mylosernyi',w:'милосердний', e:'❤️'},
      {id:'pryiaznyi', w:'приязний',    e:'😊'},
      {id:'harmoniia', w:'гармонія',    e:'☯️'},
      {id:'vnesok',    w:'внесок',      e:'🤝'}]}
  ],
  4: [
    {id:'koly', name:'Коли?', ic:'🕰️', c:'var(--teal)', words:[
      {id:'vvecheri',  w:'ввечері',   e:'🌆'},
      {id:'vden',      w:'вдень',     e:'☀️'},
      {id:'vzymku',    w:'взимку',    e:'❄️'},
      {id:'vlitku',    w:'влітку',    e:'🏖️'},
      {id:'voseny',    w:'восени',    e:'🍁'},
      {id:'teper',     w:'тепер',     e:'👉'},
      {id:'shchohodyny',w:'щогодини', e:'⏰'},
      {id:'shchotyzhnia',w:'щотижня', e:'🗓️'}]},
    {id:'de', name:'Де? Як?', ic:'🧭', c:'var(--blue)', words:[
      {id:'zzadu',     w:'ззаду',     e:'🔙'},
      {id:'livoruch',  w:'ліворуч',   e:'⬅️'},
      {id:'pravoruch', w:'праворуч',  e:'➡️'},
      {id:'nazad',     w:'назад',     e:'↩️'},
      {id:'poperedu',  w:'попереду',  e:'⬆️'},
      {id:'poseredyni',w:'посередині',e:'🎯'},
      {id:'napamiat',  w:'напамʼять', e:'🧠'}]},
    {id:'chysla', name:'Числа й міри', ic:'🔢', c:'var(--purple)', words:[
      {id:'visimdesiaty',w:'вісімдесяти',e:'8️⃣'},
      {id:'simdesiaty',w:'сімдесяти',  e:'7️⃣'},
      {id:'piatsot',   w:'пʼятсот',    e:'💯'},
      {id:'shistsot',  w:'шістсот',    e:'🔢'},
      {id:'milion',    w:'мільйон',    e:'💰'},
      {id:'kilometr',  w:'кілометр',   e:'🛤️'},
      {id:'temperatura',w:'температура',e:'🌡️'}]},
    {id:'podorozhi', name:'Подорожі й дозвілля', ic:'🚋', c:'var(--orange)', words:[
      {id:'aeroport',  w:'аеропорт',  e:'✈️'},
      {id:'tramvai',   w:'трамвай',   e:'🚋'},
      {id:'troleibus', w:'тролейбус', e:'🚎'},
      {id:'garderob',  w:'гардероб',  e:'🧥'},
      {id:'futbol',    w:'футбол',    e:'⚽'},
      {id:'okean',     w:'океан',     e:'🌊'}]},
    {id:'derzhava', name:'Держава й спільнота', ic:'🇺🇦', c:'var(--yellow)', words:[
      {id:'derzhava',  w:'держава',    e:'🇺🇦'},
      {id:'spilnota',  w:'спільнота',  e:'👨‍👩‍👧‍👦'},
      {id:'dystsyplina',w:'дисципліна',e:'📋'},
      {id:'tvorchist', w:'творчість',  e:'🎨'}]},
    {id:'rysy', name:'Риси характеру', ic:'💪', c:'var(--pink)', words:[
      {id:'vrivnovazh',w:'врівноваженість',e:'⚖️'},
      {id:'zhyttieradisnyi',w:'життєрадісний',e:'😄'},
      {id:'napoleglyvist',w:'наполегливість',e:'💪'},
      {id:'optymizm',  w:'оптимізм',   e:'🌈'}]}
  ]
};

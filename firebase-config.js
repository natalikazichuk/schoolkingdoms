/* ============================================================
   firebase-config.js — спільний модуль Firebase для SchoolKingdom
   Підключення на будь-якій сторінці:
       <script type="module" src="firebase-config.js"></script>
   CDN-імпорти — працюють на GitHub Pages без build-інструментів.

   МОДЕЛЬ ДОСТУПУ (нова):
     • user — звичайний акаунт Firebase Auth (email+пароль).
         users/{uid} = { email, name, surname, role:"user", phone, createdAt }
     • Герой — ОКРЕМИЙ акаунт Firebase Auth з власним логіном+паролем.
         Технічно логін перетворюється на синтетичний email:
             {login}@hero.schoolkingdom.app
         heroes/{heroUid} = { login, name, avatar, grade, age,
                              parentUid, parentEmail, title,
                              health, mana, agility, accuracy, ...,
                              level, xp, coins, progress:{...}, createdAt }
     • Один user може мати кількох Героїв (зв'язок через parentUid).

   ВХІД:
     • Батьки   → signInWithEmailAndPassword(email, pass)        → parent.html
     • Герой    → signInWithEmailAndPassword(heroEmail(login), pass) → hero.html
     Сесія Героя визначається за доменом email (isHeroSession()).

   ВАЖЛИВО ПРО БЕЗПЕКУ (правила Firestore — задати в консолі):
     match /users/{uid}   { allow read,write: if request.auth.uid == uid; }
     match /heroes/{hid}  {
       allow read, write: if request.auth.uid == hid                       // сам Герой
         || request.auth.uid == resource.data.parentUid                    // його user
         || request.auth.uid == request.resource.data.parentUid;           // створення user
     }
   ============================================================ */

import { initializeApp, deleteApp }
  from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import {
  getAuth, setPersistence, browserSessionPersistence,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc,
  collection, getDocs, query, where, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyALZtXycA1CI1WvbSfNXMyMYuPpWTp6JzA",
  authDomain: "schoolkingdom-d46bc.firebaseapp.com",
  projectId: "schoolkingdom-d46bc",
  storageBucket: "schoolkingdom-d46bc.firebasestorage.app",
  messagingSenderId: "253979875433",
  appId: "1:253979875433:web:db79507d2398e0d0502af8",
  measurementId: "G-X67FH9BPM3"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// Сесія живе лише до закриття вкладки/браузера (не «прилипає» між сеансами).
// Зручно для тестування кількох акаунтів; при закритті вкладки — автоматичний вихід.
try { await setPersistence(auth, browserSessionPersistence); } catch (e) {}

try {
  const { getAnalytics, isSupported } =
    await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-analytics.js");
  if (await isSupported()) getAnalytics(app);
} catch (e) {}

/* ---------- константи ---------- */
const HERO_EMAIL_DOMAIN = 'hero.schoolkingdom.app';

/* ---------- допоміжне ---------- */
/* ─── Ключі прогресу Героя ───────────────────────────────────────────────
   ⚠ Раніше сюди потрапляв УВЕСЬ localStorage, крім двох службових ключів.
   Наслідки:
     1) pullLocal() стирав дані інших сайтів на тому самому origin —
        на github.io localStorage спільний для ВСІХ проєктів акаунта;
     2) pushLocal() заливав усе стороннє в heroes/{id}.progress, а документ
        Firestore має ліміт 1 MiB.
   Тепер синхронізуємо лише свій простір імен sk_*.

   Беремо ШИРОКИЙ префікс, а не список відомих ключів: прогрес пишуть і
   тести (sk_dbtest_, sk_test100_, sk_testpass_, sk_lvtest_), і книжки
   (sk_dbbook_), і ігри (sk_game_*), і квести з тренуваннями (sk_spell_pts_v1,
   sk_train_ukrabc_pts_v1 та інші, які sk-progress.js підбирає за шаблонами).
   Білий список тут мовчки губив би прогрес кожного нового квесту. */

// Ключі, які НІКОЛИ не синхронізуються.
const PROGRESS_SKIP = [
  'sk_active_family',  // прив'язка до пристрою
  'sk_active_child',   // прив'язка до пристрою
  'sk_hero_avatar'     // base64-фото з камери: 1–3 МБ, вб'є ліміт документа
];

// Один запис прогресу не має бути більшим за це (захист від роздування).
const PROGRESS_MAX_VALUE = 64 * 1024;

function isProgressKey(k) {
  return !!k && k.startsWith('sk_') && PROGRESS_SKIP.indexOf(k) === -1;
}

function progressKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (isProgressKey(k)) keys.push(k);
  }
  return keys;
}

// логін Героя → припустимі символи; синтетичний email для Firebase Auth
function sanitizeLogin(login) {
  return String(login || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
}
function heroEmail(login) {
  return sanitizeLogin(login) + '@' + HERO_EMAIL_DOMAIN;
}

// початкові характеристики Героя (повний набір, як у базі)
function defaultHero(name, parentEmail, parentUid) {
  return {
    name: name || 'Герой',
    title: 'Лицар Знань',
    health: 50, mana: 20, agility: 50, accuracy: 50,
    strength: 2, defense: 1, intelligence: 1, wisdom: 1,
    luck: 1, memory: 1, charisma: 1,
    level: 1, xp: 0, coins: 0,
    parentEmail: parentEmail,
    parentUid: parentUid,
    createdAt: serverTimestamp()
  };
}

/* ---------- публічний API: window.SK ---------- */
const SK = {
  _userResolve: null,
  ready: null,
  user: null,
  activeChildId: null,   // у сесії Героя = його власний uid (для сумісності зі старим кодом)
  activeHeroId: null,
  _userCbs: [],

  HERO_EMAIL_DOMAIN,
  heroEmail,
  sanitizeLogin,

  currentUser() { return auth.currentUser; },

  // Сесія Героя визначається за доменом синтетичного email.
  isHeroSession() {
    const u = auth.currentUser;
    return !!(u && u.email && u.email.endsWith('@' + HERO_EMAIL_DOMAIN));
  },
  isParentSession() {
    return !!auth.currentUser && !SK.isHeroSession();
  },
  // сумісність зі старим кодом
  isChildMode() { return SK.isHeroSession(); },

  // Гейт сторінки user. Викликати всередині SK.ready.then().
  requireParent() {
    if (!auth.currentUser)  { location.replace('login.html'); return false; }
    if (SK.isHeroSession()) { location.replace('hero.html');  return false; }
    return true;
  },

  // Гейт сторінки Героя: потрібна саме сесія Героя.
  requireChild() {
    if (!auth.currentUser)  { location.replace('login.html?next=hero'); return false; }
    if (!SK.isHeroSession()){ location.replace('parent.html');          return false; }
    return true;
  },
  requireHero() { return SK.requireChild(); },

  /* ===== РЕЄСТРАЦІЯ / ВХІД БАТЬКІВ ===== */

  // Реєстрація user → users/{uid}
  async registerFamily({ parentName, parentSurname, parentRole, email, password, phone }) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;
    await setDoc(doc(db, 'users', uid), {
      email: email,
      name: parentName || '',
      surname: parentSurname || '',
      role: parentRole || 'user',
      phone: phone || '',
      createdAt: serverTimestamp()
    });
    return uid;
  },

  async login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user.uid;
  },

  async logout() {
    SK.activeChildId = null;
    SK.activeHeroId = null;
    localStorage.removeItem('sk_active_child');
    await signOut(auth);
  },

  async getParent() {
    const u = auth.currentUser;
    if (!u) return null;
    const s = await getDoc(doc(db, 'users', u.uid));
    return s.exists() ? s.data() : null;
  },

  /* ===== ГЕРОЇ ===== */

  // Створити Героя (виклик з кабінету user). Окремий Firebase-акаунт
  // створюємо через ВТОРИННИЙ застосунок, щоб НЕ вибити user із їх сесії.
  async createHero({ name, avatar, login, password, grade, age }) {
    const u = auth.currentUser;
    if (!u) throw new Error('Спочатку має увійти user');
    const cleanLogin = sanitizeLogin(login);
    if (cleanLogin.length < 3) { const e = new Error('login-too-short'); e.code = 'sk/login-too-short'; throw e; }
    if (String(password || '').length < 6) { const e = new Error('weak-password'); e.code = 'auth/weak-password'; throw e; }

    const email = heroEmail(cleanLogin);

    // вторинний застосунок з унікальним ім'ям — окрема Auth-сесія
    const secName = 'hero-create-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    const secApp  = initializeApp(firebaseConfig, secName);
    const secAuth = getAuth(secApp);

    let heroUid;
    try {
      const cred = await createUserWithEmailAndPassword(secAuth, email, password);
      heroUid = cred.user.uid;
    } catch (e) {
      try { await deleteApp(secApp); } catch (_) {}
      throw e; // напр. auth/email-already-in-use → логін зайнятий
    }

    // запис документа Героя робимо ОСНОВНОЮ сесією (user авторизовані → правила дозволяють)
    try {
      const heroDoc = Object.assign(
        defaultHero(name, u.email, u.uid),
        {
          login: cleanLogin,
          avatar: avatar || '🦁',
          grade: Number(grade) || 1,
          age: Number(age) || 7,
          progress: {}
        }
      );
      await setDoc(doc(db, 'heroes', heroUid), heroDoc);
    } finally {
      try { await signOut(secAuth); } catch (_) {}
      try { await deleteApp(secApp); } catch (_) {}
    }
    return heroUid;
  },

  // Вхід Героя по логіну+паролю (з лендингу / login.html)
  async heroLogin(login, password) {
    const cred = await signInWithEmailAndPassword(auth, heroEmail(login), password);
    SK.activeChildId = cred.user.uid;
    SK.activeHeroId  = cred.user.uid;
    return cred.user.uid;
  },

  // Усі Герої поточних user
  async getHeroes() {
    const u = auth.currentUser;
    if (!u) return {};
    const q = query(collection(db, 'heroes'), where('parentUid', '==', u.uid));
    const snap = await getDocs(q);
    const out = {};
    snap.forEach(d => { out[d.id] = d.data(); });
    return out;
  },
  // сумісність: старий код міг звати getChildren()
  async getChildren() { return SK.getHeroes(); },

  async getFamily() {
    const parent = await SK.getParent();
    const heroes = await SK.getHeroes();
    return { parent, children: heroes, heroes };
  },

  /* ===== ДАНІ АКТИВНОГО ГЕРОЯ (для hero.html та квестів) ===== */

  // у новій моделі активний Герой = той, хто увійшов (його uid)
  _heroUid() {
    if (SK.isHeroSession()) return auth.currentUser.uid;
    return SK.activeChildId || null;   // запасний шлях (перегляд user)
  },

  async _resolveHero() {
    SK.activeHeroId = SK._heroUid();
    return SK.activeHeroId;
  },

  // Повний документ Героя
  async getHero() {
    const heroId = SK._heroUid();
    if (!heroId) return null;
    const s = await getDoc(doc(db, 'heroes', heroId));
    return s.exists() ? s.data() : null;
  },

  // Профіль активного Героя (сумісність зі старим getActiveChild: name, avatar, grade…)
  async getActiveChild() {
    const heroId = SK._heroUid();
    if (!heroId) return null;
    const s = await getDoc(doc(db, 'heroes', heroId));
    return s.exists() ? Object.assign({ id: heroId }, s.data()) : null;
  },
  async getActiveHero() { return SK.getActiveChild(); },

  // Зберегти характеристики Героя (похідні від прогресу). Монети НЕ чіпаємо.
  async saveHeroStats(stats) {
    const heroId = SK._heroUid();
    if (!heroId || !stats) return false;
    const patch = {};
    ['health','mana','agility','accuracy','level','xp']
      .forEach(k => { if (stats[k] != null) patch[k] = stats[k]; });
    if (stats.health != null) patch.HP = stats.health; // дзеркало для сумісності
    patch.updatedAt = serverTimestamp();
    await setDoc(doc(db, 'heroes', heroId), patch, { merge: true });
    return true;
  },

  // дозволяємо user «дивитися» конкретного Героя (необов'язково)
  setActiveChild(heroId) {
    SK.activeChildId = heroId || null;
    SK.activeHeroId  = heroId || null;
    if (heroId) localStorage.setItem('sk_active_child', heroId);
    else localStorage.removeItem('sk_active_child');
  },
  setActiveHero(heroId) { SK.setActiveChild(heroId); },

  /* ===== ПРОГРЕС localStorage ↔ heroes/{id}.progress ===== */

  /* ⚠ GUARD на активного Героя — обов'язковий.
     Гідратація в onAuthStateChanged асинхронна: між входом другого Героя і
     завершенням pullLocal() у localStorage ще лежить прогрес ПЕРШОГО. Якщо в
     цей момент спрацює visibilitychange (дитина згорнула вкладку), pushLocal
     візьме uid нового Героя і запише йому чужий прогрес. Один телефон на двох
     дітей — типова ситуація, тож вікно реальне. Помилку раніше ковтав
     .catch(() => {}), тому баг був би невидимий. */
  async pushLocal(heroId) {
    const hid = heroId || SK._heroUid();
    if (!hid) return false;

    // localStorage вже належить іншому Герою (або ще не гідратований) — мовчимо.
    const owner = localStorage.getItem('sk_active_child');
    if (owner !== hid) return false;

    const progress = {};
    progressKeys().forEach(k => {
      const v = localStorage.getItem(k);
      if (v == null) return;                       // null не має затирати базу
      if (v.length > PROGRESS_MAX_VALUE) return;   // аномально велике — не жену в базу
      progress[k] = v;
    });

    await setDoc(doc(db, 'heroes', hid), { progress }, { merge: true });
    return true;
  },

  async pullLocal(heroId) {
    const hid = heroId || SK._heroUid();
    if (!hid) return false;

    const snap = await getDoc(doc(db, 'heroes', hid));
    const progress = (snap.exists() && snap.data().progress) || {};

    /* Чистимо ДО перевірки на існування документа. Інакше в Героя без поля
       progress (щойно створений) у localStorage лишався б прогрес попередньої
       дитини на цьому пристрої — і перший же pushLocal записав би його йому. */
    progressKeys().forEach(k => localStorage.removeItem(k));
    Object.entries(progress).forEach(([k, v]) => {
      if (v != null && isProgressKey(k)) localStorage.setItem(k, v);
    });

    /* Позначаємо власника localStorage одразу тут, а не лише в
       onAuthStateChanged: guard у pushLocal спирається на цей ключ, і
       інваріант має триматися незалежно від того, звідки покликали pullLocal. */
    localStorage.setItem('sk_active_child', hid);
    return true;
  },

  /* ===== ТЕСТИ / АКАДЕМІЯ (адмінка) ===== */

  // Псевдонім для сумісності з admin.html (він кличе getCurrentUser()).
  getCurrentUser() { return auth.currentUser; },

  // Чи є user адміном: users/{uid}.role === 'admin'. Сесія Героя — ніколи.
  async isAdmin(user) {
    const u = user || auth.currentUser;
    if (!u || SK.isHeroSession()) return false;
    try {
      const s = await getDoc(doc(db, 'users', u.uid));
      return s.exists() && s.data().role === 'admin';
    } catch (e) { return false; }
  },

  // ── КАРТА КОРОЛІВСТВА (ступені → класи → предмети → розділи → тести) ──
  // Один документ curriculum/map. Читають tests.html / test.html, пише адмінка.
  // Немає документа → null, і сторінки беруть запасну карту з sk-curriculum.js.
  async getCurriculum() {
    try {
      const s = await getDoc(doc(db, 'curriculum', 'map'));
      return s.exists() ? s.data() : null;
    } catch (e) { return null; }
  },

  async saveCurriculum(map) {
    if (!map || typeof map !== 'object') throw new Error('empty-curriculum');
    const data = Object.assign({}, map);
    data.updatedAt = serverTimestamp();
    await setDoc(doc(db, 'curriculum', 'map'), data);
    return true;
  },

  // Усі тести (для адмінки). -> [{ id, ...test }]
  async listTests() {
    const snap = await getDocs(collection(db, 'tests'));
    const out = [];
    snap.forEach(d => out.push(Object.assign({ id: d.id }, d.data())));
    out.sort((a, b) =>
      String(a.subject || '').localeCompare(String(b.subject || ''), 'uk') ||
      String(a.title || '').localeCompare(String(b.title || ''), 'uk'));
    return out;
  },

  // Лише активні тести (для Академії / tests.html). grade — необов'язковий фільтр.
  async listActiveTests(grade) {
    const snap = await getDocs(collection(db, 'tests'));
    const out = [];
    snap.forEach(d => {
      const t = d.data();
      if (t.active === false) return;
      if (grade != null && Number(t.grade) !== Number(grade)) return;
      out.push(Object.assign({ id: d.id }, t));
    });
    return out;
  },

  // Один тест за id (для плеєра test.html). -> { id, ...test } | null
  async getTest(id) {
    if (!id) return null;
    const s = await getDoc(doc(db, 'tests', id));
    return s.exists() ? Object.assign({ id: s.id }, s.data()) : null;
  },

  // Створити (без id) або оновити (з id) тест. -> id
  async saveTest(test) {
    if (!test || typeof test !== 'object') throw new Error('empty-test');
    const { id, ...data } = test;
    data.updatedAt = serverTimestamp();
    if (id) {
      await setDoc(doc(db, 'tests', id), data, { merge: true });
      return id;
    }
    data.createdAt = serverTimestamp();
    const ref = await addDoc(collection(db, 'tests'), data);
    return ref.id;
  },

  async deleteTest(id) {
    if (!id) return;
    await deleteDoc(doc(db, 'tests', id));
  },

  async setTestActive(id, active) {
    if (!id) return;
    await updateDoc(doc(db, 'tests', id), {
      active: !!active,
      updatedAt: serverTimestamp()
    });
  },

  /* ===== КНИГИ / БІБЛІОТЕКА (адмінка + читання) ===== */

  // Усі книги (для admin-books.html). -> [{ id, ...book }]
  async listBooks() {
    const snap = await getDocs(collection(db, 'books'));
    const out = [];
    snap.forEach(d => out.push(Object.assign({ id: d.id }, d.data())));
    out.sort((a, b) =>
      String(a.subject || '').localeCompare(String(b.subject || ''), 'uk') ||
      String(a.title || '').localeCompare(String(b.title || ''), 'uk'));
    return out;
  },

  // Лише активні книги (для biblioteka.html). grade — необов'язковий фільтр.
  async listActiveBooks(grade) {
    const snap = await getDocs(collection(db, 'books'));
    const out = [];
    snap.forEach(d => {
      const b = d.data();
      if (b.active === false) return;
      if (grade != null && Number(b.grade) !== Number(grade)) return;
      out.push(Object.assign({ id: d.id }, b));
    });
    return out;
  },

  // Одна книга за id (для book.html). -> { id, ...book } | null
  async getBook(id) {
    if (!id) return null;
    const s = await getDoc(doc(db, 'books', id));
    return s.exists() ? Object.assign({ id: s.id }, s.data()) : null;
  },

  // Створити (без id) або оновити (з id) книгу. -> id
  async saveBook(book) {
    if (!book || typeof book !== 'object') throw new Error('empty-book');
    const { id, ...data } = book;
    data.updatedAt = serverTimestamp();
    if (id) {
      await setDoc(doc(db, 'books', id), data, { merge: true });
      return id;
    }
    data.createdAt = serverTimestamp();
    const ref = await addDoc(collection(db, 'books'), data);
    return ref.id;
  },

  async deleteBook(id) {
    if (!id) return;
    await deleteDoc(doc(db, 'books', id));
  },

  async setBookActive(id, active) {
    if (!id) return;
    await updateDoc(doc(db, 'books', id), {
      active: !!active,
      updatedAt: serverTimestamp()
    });
  },

  /* ===== ЧИТАЦЬКА БІБЛІОТЕКА ГЕРОЯ (heroes/{id}.library) ===== */

  // Прочитані книги активного Героя. -> [{ bookId, title, correct, total, readAt }]
  async getLibrary() {
    const heroId = SK._heroUid();
    if (!heroId) return [];
    const s = await getDoc(doc(db, 'heroes', heroId));
    if (!s.exists()) return [];
    const lib = s.data().library || {};
    return Object.keys(lib).map(k => Object.assign({ bookId: k }, lib[k]));
  },

  // Записати прочитану книгу + нарахувати монети (атомарно, у heroes/{id}).
  async recordBookRead({ bookId, title, correct, total, coins } = {}) {
    const heroId = SK._heroUid();
    if (!heroId || !bookId) return false;
    const ref = doc(db, 'heroes', heroId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : {};
      const lib = data.library || {};
      lib[bookId] = {
        bookId: bookId,
        title: title || '',
        correct: (correct != null ? Number(correct) : 0),
        total:   (total   != null ? Number(total)   : 0),
        readAt:  Date.now()
      };
      const curCoins = Number(data.coins) || 0;
      const addCoins = Number(coins) || 0;
      tx.set(ref, { library: lib, coins: curCoins + addCoins }, { merge: true });
    });
    return true;
  },

  /* ===== ДИНАСТІЯ / РОДОВІД (users/{uid}.dynasty) ===== */

  // Дерево роду поточного user. -> [{ id, rel, name, ... }] | []
  async getDynasty() {
    const u = auth.currentUser;
    if (!u || SK.isHeroSession()) return [];
    const s = await getDoc(doc(db, 'users', u.uid));
    if (!s.exists()) return [];
    const d = s.data().dynasty;
    return Array.isArray(d) ? d : [];
  },

  // Зберегти дерево роду (перезаписує масив у документі user).
  async saveDynasty(members) {
    const u = auth.currentUser;
    if (!u || SK.isHeroSession()) return false;
    await setDoc(doc(db, 'users', u.uid), {
      dynasty: Array.isArray(members) ? members : [],
      dynastyUpdatedAt: serverTimestamp()
    }, { merge: true });
    return true;
  },

  /* ===== КОМАНДА: БРАТИ/СЕСТРИ ТА ДРУЗІ ===== */

  // Публічна картка Героя — лише ім'я, аватар, рівень (жодних особистих даних).
  async publishHeroCard(hero) {
    const u = auth.currentUser;
    if (!u) return false;
    const heroId = await SK._resolveHero();
    if (!heroId) return false;
    let h = hero;
    if (!h) { const s = await getDoc(doc(db, 'heroes', heroId)); h = s.exists() ? s.data() : null; }
    if (!h || !h.parentUid) return false;
    await setDoc(doc(db, 'heroCards', heroId), {
      name: h.name || '',
      avatar: h.avatar || '🧒',
      level: h.level != null ? h.level : 1,
      grade: h.grade != null ? h.grade : null,
      parentUid: h.parentUid,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return true;
  },

  // Брати/сестри — Герої тієї самої родини (без себе).
  async getSiblings() {
    const u = auth.currentUser;
    if (!u) return [];
    const meId = await SK._resolveHero();
    if (!meId) return [];
    const meSnap = await getDoc(doc(db, 'heroes', meId));
    if (!meSnap.exists()) return [];
    const parentUid = meSnap.data().parentUid;
    if (!parentUid) return [];
    const snap = await getDocs(query(collection(db, 'heroes'), where('parentUid', '==', parentUid)));
    const out = [];
    snap.forEach(d => {
      if (d.id === meId) return;
      const x = d.data();
      out.push({ id: d.id, name: x.name || '', avatar: x.avatar || '🧒',
                 level: x.level != null ? x.level : 1, grade: x.grade != null ? x.grade : null });
    });
    out.sort((a, b) => (b.level - a.level) || String(a.name).localeCompare(String(b.name), 'uk'));
    return out;
  },

  // Підтверджені друзі з інших родин (читаємо лише їхні публічні картки).
  async getFriends() {
    const u = auth.currentUser;
    if (!u) return [];
    const meId = await SK._resolveHero();
    if (!meId) return [];
    const snap = await getDocs(query(
      collection(db, 'friendships'),
      where('heroes', 'array-contains', meId)
    ));
    const ids = [];
    snap.forEach(d => {
      const x = d.data();
      if (x.status !== 'approved') return;
      (x.heroes || []).forEach(h => { if (h !== meId) ids.push(h); });
    });
    const cards = [];
    for (const id of ids) {
      try {
        const c = await getDoc(doc(db, 'heroCards', id));
        if (c.exists()) {
          const x = c.data();
          cards.push({ id, name: x.name || '', avatar: x.avatar || '🧒',
                       level: x.level != null ? x.level : 1 });
        }
      } catch (e) { /* немає доступу — пропускаємо */ }
    }
    cards.sort((a, b) => (b.level - a.level) || String(a.name).localeCompare(String(b.name), 'uk'));
    return cards;
  },

  /* ===== ДРУЖБА: КЕРУЄ ЛИШЕ ДОРОСЛИЙ (батьківський акаунт) ===== */

  _pairId(a, b) { return a < b ? `${a}__${b}` : `${b}__${a}`; },

  // Батьки створюють код-запрошення для свого Героя. Код передається іншій родині.
  async createFriendInvite(heroId) {
    const u = auth.currentUser;
    if (!u || SK.isHeroSession()) return null;
    const s = await getDoc(doc(db, 'heroes', heroId));
    if (!s.exists() || s.data().parentUid !== u.uid) return null;
    const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += abc[Math.floor(Math.random() * abc.length)];
    await setDoc(doc(db, 'inviteCodes', code), {
      heroId, parentUid: u.uid, createdAt: serverTimestamp()
    });
    return code;
  },

  // Інші батьки вводять код і обирають, хто з їхніх Героїв додається у друзі.
  async redeemFriendInvite(code, myHeroId) {
    const u = auth.currentUser;
    if (!u || SK.isHeroSession()) return { ok: false, error: 'Потрібен акаунт дорослого' };
    const inv = await getDoc(doc(db, 'inviteCodes', String(code || '').trim().toUpperCase()));
    if (!inv.exists()) return { ok: false, error: 'Код не знайдено' };
    const { heroId: otherHero, parentUid: otherParent } = inv.data();
    if (otherParent === u.uid) return { ok: false, error: 'Це код вашої ж родини' };
    const mine = await getDoc(doc(db, 'heroes', myHeroId));
    if (!mine.exists() || mine.data().parentUid !== u.uid) return { ok: false, error: 'Це не ваш Герой' };
    const pair = SK._pairId(myHeroId, otherHero);
    await setDoc(doc(db, 'friendships', pair), {
      heroes: [myHeroId, otherHero],
      parents: [u.uid, otherParent],
      status: 'pending',
      approvedBy: [u.uid],
      createdAt: serverTimestamp()
    }, { merge: true });
    return { ok: true, pair };
  },

  // Список дружб, що стосуються родини (для підтвердження другим із батьків).
  async listFriendships() {
    const u = auth.currentUser;
    if (!u || SK.isHeroSession()) return [];
    const snap = await getDocs(query(
      collection(db, 'friendships'),
      where('parents', 'array-contains', u.uid)
    ));
    const out = [];
    snap.forEach(d => out.push({ pair: d.id, ...d.data() }));
    return out;
  },

  // Другий із батьків підтверджує — лише після цього діти бачать одне одного.
  async approveFriendship(pair) {
    const u = auth.currentUser;
    if (!u || SK.isHeroSession()) return false;
    const ref = doc(db, 'friendships', pair);
    const s = await getDoc(ref);
    if (!s.exists()) return false;
    const d = s.data();
    if (!(d.parents || []).includes(u.uid)) return false;
    const approved = Array.from(new Set([...(d.approvedBy || []), u.uid]));
    await setDoc(ref, {
      approvedBy: approved,
      status: approved.length >= 2 ? 'approved' : 'pending'
    }, { merge: true });
    return true;
  },

  async removeFriendship(pair) {
    const u = auth.currentUser;
    if (!u || SK.isHeroSession()) return false;
    await deleteDoc(doc(db, 'friendships', pair));
    return true;
  },

  onUser(cb) { if (typeof cb === 'function') SK._userCbs.push(cb); }
};

SK.ready = new Promise(res => { SK._userResolve = res; });

onAuthStateChanged(auth, async (user) => {
  SK.user = user;
  // у сесії Героя одразу фіксуємо активного Героя = його uid
  if (user && user.email && user.email.endsWith('@' + HERO_EMAIL_DOMAIN)) {
    SK.activeChildId = user.uid;
    SK.activeHeroId  = user.uid;
    // ── ГІДРАТАЦІЯ localStorage під цього Героя ──
    // Один раз при зміні активного Героя тягнемо його прогрес із heroes/{uid}
    // у localStorage. Без цього computeXP/accuracy рахували б від чужого або
    // порожнього localStorage → перетікання між Героями чи затирання статів.
    try {
      if (localStorage.getItem('sk_active_child') !== user.uid) {
        // pullLocal сам виставить sk_active_child — і зробить це ЛИШЕ після
        // успішної гідратації. Якщо мережа впала, ключ лишається чужим,
        // pushLocal мовчки відмовиться писати, і чужий прогрес не поїде в базу.
        await SK.pullLocal(user.uid);
      }
    } catch (e) {}
  } else if (!user) {
    SK.activeChildId = null;
    SK.activeHeroId  = null;
  }
  if (SK._userResolve) { SK._userResolve(user); SK._userResolve = null; }
  SK._userCbs.forEach(cb => { try { cb(user); } catch (e) {} });
});

window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') SK.pushLocal().catch(() => {});
});

window.SK = SK;


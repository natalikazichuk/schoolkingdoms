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
  getAuth, setPersistence, browserLocalPersistence,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, addDoc,
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

try { await setPersistence(auth, browserLocalPersistence); } catch (e) {}

try {
  const { getAnalytics, isSupported } =
    await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-analytics.js");
  if (await isSupported()) getAnalytics(app);
} catch (e) {}

/* ---------- константи ---------- */
const HERO_EMAIL_DOMAIN = 'hero.schoolkingdom.app';

/* ---------- допоміжне ---------- */
function progressKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k === 'sk_active_family' || k === 'sk_active_child') continue;
    keys.push(k);
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
    health: 50, mana: 10, agility: 1, accuracy: 1,
    strength: 2, defense: 1, intelligence: 1, wisdom: 1,
    luck: 1, memory: 1, charisma: 1,
    level: 1, xp: 0, coins: 600,
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

  async pushLocal(heroId) {
    const hid = heroId || SK._heroUid();
    if (!hid) return false;
    const progress = {};
    progressKeys().forEach(k => { progress[k] = localStorage.getItem(k); });
    await setDoc(doc(db, 'heroes', hid), { progress }, { merge: true });
    return true;
  },

  async pullLocal(heroId) {
    const hid = heroId || SK._heroUid();
    if (!hid) return false;
    const snap = await getDoc(doc(db, 'heroes', hid));
    if (!snap.exists()) return false;
    const progress = snap.data().progress || {};
    progressKeys().forEach(k => localStorage.removeItem(k));
    Object.entries(progress).forEach(([k, v]) => {
      if (v != null) localStorage.setItem(k, v);
    });
    return true;
  },

  onUser(cb) { if (typeof cb === 'function') SK._userCbs.push(cb); }
};

SK.ready = new Promise(res => { SK._userResolve = res; });

onAuthStateChanged(auth, (user) => {
  SK.user = user;
  // у сесії Героя одразу фіксуємо активного Героя = його uid
  if (user && user.email && user.email.endsWith('@' + HERO_EMAIL_DOMAIN)) {
    SK.activeChildId = user.uid;
    SK.activeHeroId  = user.uid;
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

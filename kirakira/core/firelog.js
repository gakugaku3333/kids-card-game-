/*
 * kirakira/core/firelog.js — 誤答ログ・間隔反復・学習履歴（10歳向け「キラキラひろば」版）
 *
 * 本家 core/firelog.js と同じFirestoreプロジェクト・同じ'users'コレクションを使う
 * （Firestoreのセキュリティルールが'users'コレクションのみ許可しているため、
 * 新規コレクションを切ると permission-denied になる）。ただしドキュメントIDに
 * 'kirakira__'プレフィックスを付け、ニックネームのlocalStorageキーも分けることで
 * 本家の学習履歴と混ざらないようにする（計画書「ユーザー識別は本家と別名にする」）。
 * 前提: firebase-app-compat.js / firebase-firestore-compat.js がページに読み込まれていること。
 */
const CONFIG = {
  apiKey: 'AIzaSyCo-B46xek43QupUzPAtAcHl19ZnpZ_ptY',
  authDomain: 'kids-game-log.firebaseapp.com',
  projectId: 'kids-game-log',
  storageBucket: 'kids-game-log.firebasestorage.app',
  messagingSenderId: '290656327813',
  appId: '1:290656327813:web:93083b03f5b281718b31ec'
};

const NICK_KEY = 'kirakira_game_nickname';
let db = null;
let currentUser = null;

try {
  if (!window.firebase.apps.length) window.firebase.initializeApp(CONFIG);
  db = window.firebase.firestore();
} catch (e) {
  console.warn('[KiraFireLog] Firebase init error:', e);
}

const saved = localStorage.getItem(NICK_KEY);
if (saved) currentUser = saved;

function userRef() {
  return (db && currentUser) ? db.collection('users').doc('kirakira__' + currentUser) : null;
}

function makeItemId(game, question) {
  return (game + '__' + String(question))
    .replace(/\s+/g, '_')
    .replace(/[^\w぀-ヿ一-鿿+\-×÷%]/g, '')
    .slice(0, 100);
}

export function setUser(nickname) {
  currentUser = nickname.trim();
  localStorage.setItem(NICK_KEY, currentUser);
  const ref = userRef();
  if (ref) {
    ref.set({
      nickname: currentUser,
      lastSeen: window.firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch((e) => console.warn('[KiraFireLog] setUser:', e));
  }
}

export function getSavedUser() {
  return localStorage.getItem(NICK_KEY) || null;
}

export function clearUser() {
  currentUser = null;
  localStorage.removeItem(NICK_KEY);
}

export function logWrong(game, question, answer) {
  const ref = userRef();
  if (!ref) return;
  const id = makeItemId(game, question);
  const itemRef = ref.collection('wrongItems').doc(id);
  const nextReview = new Date(Date.now() + 24 * 60 * 60 * 1000);

  itemRef.get().then((doc) => {
    if (doc.exists) {
      itemRef.update({
        wrongCount: window.firebase.firestore.FieldValue.increment(1),
        lastWrong: window.firebase.firestore.FieldValue.serverTimestamp(),
        nextReview: window.firebase.firestore.Timestamp.fromDate(nextReview),
        interval: 1
      });
    } else {
      itemRef.set({
        game: String(game),
        question: String(question),
        answer: String(answer),
        wrongCount: 1,
        firstWrong: window.firebase.firestore.FieldValue.serverTimestamp(),
        lastWrong: window.firebase.firestore.FieldValue.serverTimestamp(),
        nextReview: window.firebase.firestore.Timestamp.fromDate(nextReview),
        interval: 1
      });
    }
  }).catch((e) => console.warn('[KiraFireLog] logWrong:', e));
}

export function markReviewed(game, question) {
  const ref = userRef();
  if (!ref) return;
  const id = makeItemId(game, question);
  const itemRef = ref.collection('wrongItems').doc(id);

  itemRef.get().then((doc) => {
    if (!doc.exists) return;
    const interval = (doc.data().interval || 1) * 2;
    if (interval >= 32) {
      itemRef.delete();
    } else {
      itemRef.update({
        interval,
        nextReview: window.firebase.firestore.Timestamp.fromDate(
          new Date(Date.now() + interval * 24 * 60 * 60 * 1000)
        ),
        lastReviewed: window.firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  }).catch((e) => console.warn('[KiraFireLog] markReviewed:', e));
}

export function getReviewDue(callback) {
  const ref = userRef();
  if (!ref) { callback([]); return; }
  ref.collection('wrongItems')
    .where('nextReview', '<=', window.firebase.firestore.Timestamp.now())
    .get()
    .then((snap) => {
      const items = [];
      snap.forEach((doc) => items.push(Object.assign({ id: doc.id }, doc.data())));
      callback(items);
    })
    .catch((e) => { console.warn('[KiraFireLog] getReviewDue:', e); callback([]); });
}

export function logSession(game, correct, total, tokens) {
  const ref = userRef();
  if (!ref) return;
  ref.collection('sessions').add({
    game: String(game),
    correct,
    total,
    tokens,
    timestamp: window.firebase.firestore.FieldValue.serverTimestamp()
  }).catch((e) => console.warn('[KiraFireLog] logSession:', e));
}

export function getSessions(limit, callback) {
  if (typeof limit === 'function') { callback = limit; limit = 50; }
  const ref = userRef();
  if (!ref) { callback([]); return; }
  ref.collection('sessions')
    .orderBy('timestamp', 'desc')
    .limit(limit || 50)
    .get()
    .then((snap) => {
      const items = [];
      snap.forEach((doc) => items.push(Object.assign({ id: doc.id }, doc.data())));
      callback(items);
    })
    .catch((e) => { console.warn('[KiraFireLog] getSessions:', e); callback([]); });
}

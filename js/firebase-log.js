/**
 * firebase-log.js — 誤答ログ・間隔反復復習モジュール
 *
 * 前提: firebase-app-compat.js と firebase-firestore-compat.js が先に読み込まれていること。
 * 公開API: window.FireLog
 */
(function () {
  'use strict';

  var CONFIG = {
    apiKey: "AIzaSyCo-B46xek43QupUzPAtAcHl19ZnpZ_ptY",
    authDomain: "kids-game-log.firebaseapp.com",
    projectId: "kids-game-log",
    storageBucket: "kids-game-log.firebasestorage.app",
    messagingSenderId: "290656327813",
    appId: "1:290656327813:web:93083b03f5b281718b31ec"
  };

  var NICK_KEY = 'kids_game_nickname';
  var db = null;
  var currentUser = null;

  try {
    if (!firebase.apps.length) firebase.initializeApp(CONFIG);
    db = firebase.firestore();
  } catch (e) {
    console.warn('[FireLog] Firebase init error:', e);
  }

  // ページ読み込み時に保存済みユーザーを復元
  var _saved = localStorage.getItem(NICK_KEY);
  if (_saved) currentUser = _saved;

  function userRef() {
    return (db && currentUser) ? db.collection('users').doc(currentUser) : null;
  }

  // Firestoreドキュメントキー（ゲーム種別 + 問題文で一意に）
  function makeItemId(game, question) {
    return (game + '__' + String(question))
      .replace(/\s+/g, '_')
      .replace(/[^\w぀-ヿ一-鿿+\-×÷]/g, '')
      .slice(0, 100);
  }

  window.FireLog = {

    /** ニックネームをセット（Firebase + localStorage に保存） */
    setUser: function (nickname) {
      currentUser = nickname.trim();
      localStorage.setItem(NICK_KEY, currentUser);
      var ref = userRef();
      if (ref) {
        ref.set({
          nickname: currentUser,
          lastSeen: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).catch(function (e) { console.warn('[FireLog] setUser:', e); });
      }
    },

    /** 保存済みニックネームを取得（なければ null） */
    getSavedUser: function () {
      return localStorage.getItem(NICK_KEY) || null;
    },

    /** ログアウト */
    clearUser: function () {
      currentUser = null;
      localStorage.removeItem(NICK_KEY);
    },

    /**
     * 誤答を記録。初回は新規作成、2回目以降は wrongCount++ + nextReview リセット。
     * @param {string} game     - 'katakana' | 'math-addition' | ...
     * @param {string} question - 問題文（カタカナ文字 or 式テキスト）
     * @param {string} answer   - 正解
     */
    logWrong: function (game, question, answer) {
      var ref = userRef();
      if (!ref) return;
      var id = makeItemId(game, question);
      var itemRef = ref.collection('wrongItems').doc(id);
      var nextReview = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1日後

      itemRef.get().then(function (doc) {
        if (doc.exists) {
          itemRef.update({
            wrongCount: firebase.firestore.FieldValue.increment(1),
            lastWrong: firebase.firestore.FieldValue.serverTimestamp(),
            nextReview: firebase.firestore.Timestamp.fromDate(nextReview),
            interval: 1
          });
        } else {
          itemRef.set({
            game: String(game),
            question: String(question),
            answer: String(answer),
            wrongCount: 1,
            firstWrong: firebase.firestore.FieldValue.serverTimestamp(),
            lastWrong: firebase.firestore.FieldValue.serverTimestamp(),
            nextReview: firebase.firestore.Timestamp.fromDate(nextReview),
            interval: 1
          });
        }
      }).catch(function (e) { console.warn('[FireLog] logWrong:', e); });
    },

    /**
     * 復習で正解 → インターバルを2倍に更新。32日超で習得完了（削除）。
     * 間隔スケジュール: 1→2→4→8→16→32日（習得）
     */
    markReviewed: function (game, question) {
      var ref = userRef();
      if (!ref) return;
      var id = makeItemId(game, question);
      var itemRef = ref.collection('wrongItems').doc(id);

      itemRef.get().then(function (doc) {
        if (!doc.exists) return;
        var interval = (doc.data().interval || 1) * 2;
        if (interval >= 32) {
          itemRef.delete(); // 習得完了
        } else {
          itemRef.update({
            interval: interval,
            nextReview: firebase.firestore.Timestamp.fromDate(
              new Date(Date.now() + interval * 24 * 60 * 60 * 1000)
            ),
            lastReviewed: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      }).catch(function (e) { console.warn('[FireLog] markReviewed:', e); });
    },

    /**
     * 今日復習すべき問題を取得
     * @param {function} callback - callback(items: Array)
     */
    getReviewDue: function (callback) {
      var ref = userRef();
      if (!ref) { callback([]); return; }
      ref.collection('wrongItems')
        .where('nextReview', '<=', firebase.firestore.Timestamp.now())
        .get()
        .then(function (snap) {
          var items = [];
          snap.forEach(function (doc) {
            items.push(Object.assign({ id: doc.id }, doc.data()));
          });
          callback(items);
        })
        .catch(function (e) {
          console.warn('[FireLog] getReviewDue:', e);
          callback([]);
        });
    },

    /**
     * ゲームセッションをログ
     * @param {string} game    - ゲーム種別
     * @param {number} correct - 正解数
     * @param {number} total   - 総問題数
     * @param {number} tokens  - 獲得トークン数
     */
    logSession: function (game, correct, total, tokens) {
      var ref = userRef();
      if (!ref) return;
      ref.collection('sessions').add({
        game: String(game),
        correct: correct,
        total: total,
        tokens: tokens,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(function (e) { console.warn('[FireLog] logSession:', e); });
    },

    /**
     * 学習履歴（過去のゲームセッション）を新しい順で取得
     * @param {number}   limit    - 取得する最大件数（省略時は50）
     * @param {function} callback - callback(sessions: Array)。未ログイン時は []
     */
    getSessions: function (limit, callback) {
      if (typeof limit === 'function') { callback = limit; limit = 50; }
      var ref = userRef();
      if (!ref) { callback([]); return; }
      ref.collection('sessions')
        .orderBy('timestamp', 'desc')
        .limit(limit || 50)
        .get()
        .then(function (snap) {
          var items = [];
          snap.forEach(function (doc) {
            items.push(Object.assign({ id: doc.id }, doc.data()));
          });
          callback(items);
        })
        .catch(function (e) {
          console.warn('[FireLog] getSessions:', e);
          callback([]);
        });
    }
  };
})();

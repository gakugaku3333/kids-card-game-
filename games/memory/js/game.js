/* ==========================================================================
   定数とアセットデータ
   ========================================================================== */
// 女の子向けのかわいいアセット（全11種類）
const ALL_ASSETS = [
  { id: 'bunny', name: 'うさぎ', file: 'cute_bunny.png' },
  { id: 'lop_ear_bunny', name: 'ロップイヤー', file: 'cute_lop_ear_bunny.png' },
  { id: 'kitten', name: 'こねこ', file: 'cute_kitten.png' },
  { id: 'bear', name: 'くま', file: 'cute_bear.png' },
  { id: 'unicorn', name: 'ユニコーン', file: 'cute_unicorn.png' },
  { id: 'crown', name: 'クラウン', file: 'princess_crown.png' },
  { id: 'strawberry', name: 'いちご', file: 'cute_strawberry.png' },
  { id: 'cherry', name: 'さくらんぼ', file: 'cute_cherry.png' },
  { id: 'apple', name: 'りんご', file: 'cute_apple.png' },
  { id: 'banana', name: 'バナナ', file: 'cute_banana.png' },
  { id: 'donut', name: 'ドーナツ', file: 'cute_donut.png' }
];

// 難易度設定
const DIFFICULTIES = {
  easy: { pairs: 3, gridClass: 'grid-easy' },
  medium: { pairs: 6, gridClass: 'grid-medium' },
  hard: { pairs: 10, gridClass: 'grid-hard' }
};

// クリア時のトークン報酬（難易度別）
const TOKEN_REWARDS = { easy: 5, medium: 10, hard: 20 };

/* ==========================================================================
   ゲーム状態管理
   ========================================================================== */
let gameState = {
  currentDifficulty: 'easy',
  cards: [],            // 現在配置されているカードの配列
  firstCard: null,      // 1枚目にめくったカード
  secondCard: null,     // 2枚目にめくったカード
  isBoardLocked: false, // めくり中のロック
  matchedPairs: 0,      // 揃ったペア数
  totalPairs: 0,        // 目標のペア数
  missCount: 0,         // 間違えた回数
  secondsElapsed: 0,    // 経過秒数
  timerInterval: null   // タイマーのインターバルID
};

// オーディオコンテキスト
let audioCtx = null;

/* ==========================================================================
   効果音の合成 (Web Audio API)
   ========================================================================== */
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// 共通オシレーター再生ヘルパー
function playTone(frequency, type, duration, startTimeOffset = 0, volume = 0.1) {
  if (!audioCtx) return;
  
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, audioCtx.currentTime + startTimeOffset);
  
  // 音量のエンベロープ（ぽつぽつ音を防ぐために減衰させる）
  gainNode.gain.setValueAtTime(volume, audioCtx.currentTime + startTimeOffset);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + startTimeOffset + duration);
  
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  
  osc.start(audioCtx.currentTime + startTimeOffset);
  osc.stop(audioCtx.currentTime + startTimeOffset + duration);
}

// 1. めくる音（ピッと軽快な高音）
function playFlipSound() {
  initAudio();
  playTone(600, 'triangle', 0.08, 0, 0.15);
}

// 2. ペア成立音（キラキラとした上昇アルペジオ）
function playMatchSound() {
  initAudio();
  const now = 0;
  playTone(523.25, 'sine', 0.15, now, 0.15);       // C5
  playTone(659.25, 'sine', 0.15, now + 0.07, 0.15);  // E5
  playTone(783.99, 'sine', 0.15, now + 0.14, 0.15);  // G5
  playTone(1046.50, 'sine', 0.25, now + 0.21, 0.2);  // C6
}

// 3. はずれ音（コトッという低めの濁った音）
function playMismatchSound() {
  initAudio();
  // わずかに異なる周波数を同時に鳴らして濁らせる
  playTone(180, 'sawtooth', 0.15, 0, 0.1);
  playTone(175, 'triangle', 0.15, 0.02, 0.1);
}

// 4. ファンファーレ（クリア時の華やかな上昇メロディ）
function playWinSound() {
  initAudio();
  const tempo = 0.12;
  // ファンファーレのメロディ
  playTone(523.25, 'triangle', tempo * 1.5, 0, 0.15);      // C5
  playTone(523.25, 'triangle', tempo * 1.5, tempo, 0.15);  // C5
  playTone(523.25, 'triangle', tempo * 1.5, tempo * 2, 0.15);  // C5
  playTone(523.25, 'triangle', tempo * 3, tempo * 3, 0.2);  // C5 (長め)
  
  playTone(659.25, 'triangle', tempo * 1.5, tempo * 5, 0.15);  // E5
  playTone(523.25, 'triangle', tempo * 1.5, tempo * 6, 0.15);  // C5
  playTone(659.25, 'triangle', tempo * 3, tempo * 7, 0.2);  // E5
  
  playTone(783.99, 'triangle', tempo * 1.5, tempo * 9, 0.15);  // G5
  playTone(659.25, 'triangle', tempo * 1.5, tempo * 10, 0.15); // E5
  playTone(783.99, 'triangle', tempo * 3, tempo * 11, 0.2); // G5
  
  playTone(1046.50, 'sine', tempo * 6, tempo * 13, 0.25); // C6 (華やかな高音)
  playTone(1318.51, 'sine', tempo * 6, tempo * 13.1, 0.15); // E6 (和音ハモり)
}

/* ==========================================================================
   UI 要素の取得
   ========================================================================== */
const screenStart = document.getElementById('start-screen');
const screenPlay = document.getElementById('play-screen');
const modalClear = document.getElementById('clear-modal');

const btnEasy = document.getElementById('btn-easy');
const btnMedium = document.getElementById('btn-medium');
const btnHard = document.getElementById('btn-hard');
const btnBack = document.getElementById('btn-back');
const btnRestart = document.getElementById('btn-restart');

const cardBoard = document.getElementById('card-board');
const statScore = document.getElementById('stat-score');
const statTimer = document.getElementById('stat-timer');

const resultTime = document.getElementById('result-time');
const resultMiss = document.getElementById('result-miss');

/* ==========================================================================
   ゲームロジック
   ========================================================================== */

// 1. シャッフル（フィッシャー–イェーツのシャッフル）
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// 2. ゲーム開始処理
function startGame(difficulty) {
  initAudio();
  
  gameState.currentDifficulty = difficulty;
  const config = DIFFICULTIES[difficulty];
  gameState.totalPairs = config.pairs;
  gameState.matchedPairs = 0;
  gameState.missCount = 0;
  gameState.secondsElapsed = 0;
  gameState.firstCard = null;
  gameState.secondCard = null;
  gameState.isBoardLocked = false;

  // アセット全11種類から、今回のゲームに必要なペア数分をランダムに選択
  const shuffledAssets = shuffle([...ALL_ASSETS]);
  const selectedAssets = shuffledAssets.slice(0, gameState.totalPairs);

  // ペアにする（各アセットを2枚ずつ、複製）
  let cardDeck = [];
  selectedAssets.forEach(asset => {
    cardDeck.push({ ...asset });
    cardDeck.push({ ...asset });
  });

  // デッキ全体をシャッフル
  gameState.cards = shuffle(cardDeck);

  // ボードのレイアウトクラスを設定
  cardBoard.className = `card-board ${config.gridClass}`;
  
  // 表示の初期化
  updateStats();
  buildBoard();
  
  // 画面遷移
  screenStart.classList.remove('active');
  screenPlay.classList.add('active');
  modalClear.classList.remove('active');

  // タイマー開始
  startTimer();
}

// 3. ボードの構築
function buildBoard() {
  cardBoard.innerHTML = '';
  
  gameState.cards.forEach((cardData, index) => {
    const cardEl = document.createElement('div');
    cardEl.classList.add('card');
    cardEl.dataset.index = index;
    cardEl.dataset.id = cardData.id;

    // カードの内部構造（3Dフリップ用）
    cardEl.innerHTML = `
      <div class="card-face card-back"></div>
      <div class="card-face card-front">
        <img class="card-img" src="assets/images/${cardData.file}" alt="${cardData.name}">
      </div>
    `;

    // クリックイベントの登録
    cardEl.addEventListener('click', handleCardClick);
    cardBoard.appendChild(cardEl);
  });
}

// 4. カードクリックハンドラ
function handleCardClick(e) {
  const clickedCard = e.currentTarget;

  // すでに表向き、またはマッチ済み、またはボードロック中は無視
  if (
    clickedCard.classList.contains('flipped') ||
    clickedCard.classList.contains('matched') ||
    gameState.isBoardLocked
  ) {
    return;
  }

  // めくる効果音
  playFlipSound();

  // カードを表向きにする
  clickedCard.classList.add('flipped');

  if (!gameState.firstCard) {
    // 1枚目のカード
    gameState.firstCard = clickedCard;
  } else {
    // 2枚目のカード
    gameState.secondCard = clickedCard;
    checkMatch();
  }
}

// 5. ペア判定
function checkMatch() {
  const id1 = gameState.firstCard.dataset.id;
  const id2 = gameState.secondCard.dataset.id;

  if (id1 === id2) {
    // ペア成立
    handleMatch();
  } else {
    // ハズレ
    handleMismatch();
  }
}

// 6. ペア成立時の処理
function handleMatch() {
  const card1 = gameState.firstCard;
  const card2 = gameState.secondCard;

  card1.classList.add('matched');
  card2.classList.add('matched');

  gameState.matchedPairs++;
  updateStats();

  // ペア成立の効果音
  setTimeout(() => {
    playMatchSound();
    
    // カードの位置に星・ハートのキラキラパーティクルを飛ばす
    const rect1 = card1.getBoundingClientRect();
    const rect2 = card2.getBoundingClientRect();
    createParticles(rect1.left + rect1.width / 2, rect1.top + rect1.height / 2);
    createParticles(rect2.left + rect2.width / 2, rect2.top + rect2.height / 2);
  }, 100);

  // カード選択状態のリセット
  resetSelection();

  // クリア判定
  if (gameState.matchedPairs === gameState.totalPairs) {
    setTimeout(handleWin, 800);
  }
}

// 7. ハズレ時の処理
function handleMismatch() {
  gameState.isBoardLocked = true;
  gameState.missCount++;

  // ハズレの効果音
  setTimeout(() => {
    playMismatchSound();
    // 揺らすアニメーション
    gameState.firstCard.classList.add('shake');
    gameState.secondCard.classList.add('shake');
  }, 200);

  // 1秒後に裏返す
  setTimeout(() => {
    gameState.firstCard.classList.remove('flipped', 'shake');
    gameState.secondCard.classList.remove('flipped', 'shake');
    resetSelection();
  }, 1200);
}

// 8. カード選択リセット
function resetSelection() {
  gameState.firstCard = null;
  gameState.secondCard = null;
  gameState.isBoardLocked = false;
}

// 9. スコア・タイマー表示の更新
function updateStats() {
  statScore.textContent = `${gameState.matchedPairs} / ${gameState.totalPairs}`;
}

// 10. タイマー制御
function startTimer() {
  clearInterval(gameState.timerInterval);
  statTimer.textContent = '0 びょう';
  
  gameState.timerInterval = setInterval(() => {
    gameState.secondsElapsed++;
    statTimer.textContent = `${gameState.secondsElapsed} びょう`;
  }, 1000);
}

function stopTimer() {
  clearInterval(gameState.timerInterval);
}

// 11. ゲームクリア処理
function handleWin() {
  stopTimer();
  playWinSound();

  // リザルト画面への値設定
  resultTime.textContent = `${gameState.secondsElapsed} びょう`;
  resultMiss.textContent = `${gameState.missCount} かい`;

  // トークンを獲得（共通 Store に加算）
  const reward = TOKEN_REWARDS[gameState.currentDifficulty] || 5;
  if (window.Store) Store.addTokens(reward);
  const resultTokensEl = document.getElementById('result-tokens');
  if (resultTokensEl) resultTokensEl.textContent = `⭐ ${reward}`;

  // モーダルの表示
  modalClear.classList.add('active');

  // 紙吹雪を降らせる
  startConfetti();
}

/* ==========================================================================
   エフェクト演出 (パーティクル & 紙吹雪)
   ========================================================================== */

// 1. キラキラパーティクル（星とハート）
function createParticles(x, y) {
  const container = document.body;
  const icons = ['★', '❤', '✿', '✦', '♥', '✧'];
  const particleCount = 10;

  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.textContent = icons[Math.floor(Math.random() * icons.length)];
    
    // ランダムな色（ピンク、水色、黄色、紫）
    const colors = ['#ff7ebb', '#29b6f6', '#ffd15c', '#b39ddb', '#ff8a80'];
    particle.style.color = colors[Math.floor(Math.random() * colors.length)];
    
    // 初期位置
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;

    // ランダムな移動方向と回転
    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.random() * 80;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;
    const rot = Math.random() * 360;
    const scale = 0.5 + Math.random() * 1.0;

    particle.style.setProperty('--tx', `${tx}px`);
    particle.style.setProperty('--ty', `${ty}px`);
    particle.style.setProperty('--rot', `${rot}deg`);
    particle.style.setProperty('--scale', scale);

    container.appendChild(particle);

    // アニメーション終了後に削除
    particle.addEventListener('animationend', () => {
      particle.remove();
    });
  }
}

// 2. 紙吹雪（コンフェッティ）の開始
let confettiTimer = null;
function startConfetti() {
  stopConfetti();
  
  const colors = ['#ff7ebb', '#ffd15c', '#b39ddb', '#8de3a1', '#29b6f6', '#ff8a80', '#ffffff'];
  const container = document.body;
  let count = 0;
  
  // 3秒間、定期的に紙吹雪を降らせる
  confettiTimer = setInterval(() => {
    if (count > 80) {
      clearInterval(confettiTimer);
      return;
    }
    
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    
    // ランダムなパラメータ
    const leftPos = Math.random() * 100; // 0% ~ 100%
    const size = 6 + Math.random() * 8; // 6px ~ 14px
    const speed = 2 + Math.random() * 3; // 2s ~ 5s
    const delay = Math.random() * 0.5;
    
    confetti.style.left = `${leftPos}%`;
    confetti.style.top = `-20px`;
    confetti.style.width = `${size}px`;
    confetti.style.height = `${size * 0.8}px`;
    confetti.style.setProperty('--speed', `${speed}s`);
    confetti.style.animationDelay = `${delay}s`;
    
    container.appendChild(confetti);
    count++;
    
    // アニメーション完了後に削除
    confetti.addEventListener('animationend', () => {
      confetti.remove();
    });
  }, 40);
}

function stopConfetti() {
  clearInterval(confettiTimer);
  document.querySelectorAll('.confetti').forEach(el => el.remove());
}

/* ==========================================================================
   イベントリスナー
   ========================================================================== */

// 難易度選択ボタン
[btnEasy, btnMedium, btnHard].forEach(btn => {
  btn.addEventListener('click', () => {
    const diff = btn.dataset.difficulty;
    startGame(diff);
  });
});

// もどるボタン
btnBack.addEventListener('click', () => {
  stopTimer();
  stopConfetti();
  screenPlay.classList.remove('active');
  screenStart.classList.add('active');
  modalClear.classList.remove('active');
});

// もういちどあそぶボタン
btnRestart.addEventListener('click', () => {
  stopConfetti();
  startGame(gameState.currentDifficulty);
});

// iOS 等でのオーディオバグ対策用最初の画面タップ検知
document.body.addEventListener('touchstart', initAudio, { once: true });
document.body.addEventListener('click', initAudio, { once: true });

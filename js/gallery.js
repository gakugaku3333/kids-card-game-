/* ==========================================================================
   オーディオ設定 (Web Audio API)
   ========================================================================== */
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// ポップ音（丸みのある可愛い決定音）
function playPopSound() {
  initAudio();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, audioCtx.currentTime);
  // 周波数を一瞬で引き上げる（ぷにっとした音になる）
  osc.frequency.exponentialRampToValueAtTime(700, audioCtx.currentTime + 0.08);

  gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);

  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.08);
}

// やさしい閉じる音
function playCloseSound() {
  initAudio();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(500, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.1);

  gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.1);
}

/* ==========================================================================
   UI 要素 & イベント
   ========================================================================== */
const cardMemory = document.getElementById('card-memory');
const cardPlaceholder = document.getElementById('card-placeholder');
const btnHelp = document.getElementById('btn-help');

const msgModal = document.getElementById('msg-modal');
const helpModal = document.getElementById('help-modal');

const btnCloseMsg = document.getElementById('btn-close-msg');
const btnCloseHelp = document.getElementById('btn-close-help');

// 1. 神経衰弱カードのタップ（音を鳴らしてから遷移）
cardMemory.addEventListener('click', (e) => {
  e.preventDefault();
  playPopSound();
  const href = cardMemory.getAttribute('href');
  setTimeout(() => {
    window.location.href = href;
  }, 100);
});

// 2. プレースホルダー（準備中）カードのタップ
cardPlaceholder.addEventListener('click', () => {
  playPopSound();
  msgModal.classList.add('active');
});

// 3. ヘルプボタンのタップ
btnHelp.addEventListener('click', () => {
  playPopSound();
  helpModal.classList.add('active');
});

// 4. モーダルを閉じる
btnCloseMsg.addEventListener('click', () => {
  playCloseSound();
  msgModal.classList.remove('active');
});

btnCloseHelp.addEventListener('click', () => {
  playCloseSound();
  helpModal.classList.remove('active');
});

// モーダルの外側をクリックしたら閉じる
[msgModal, helpModal].forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      playCloseSound();
      modal.classList.remove('active');
    }
  });
});

// タッチデバイスでのオーディオ再生許可用
document.body.addEventListener('touchstart', initAudio, { once: true });
document.body.addEventListener('click', initAudio, { once: true });

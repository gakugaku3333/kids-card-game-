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

function playTone(startFreq, endFreq, duration, volume) {
  initAudio();
  if (!audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(startFreq, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(endFreq, audioCtx.currentTime + duration);

  gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playPopSound()   { playTone(400, 700, 0.08, 0.15); }
function playCloseSound() { playTone(500, 300, 0.10, 0.10); }

/* ==========================================================================
   UI 要素 & イベント
   ========================================================================== */
const msgModal  = document.getElementById('msg-modal');
const helpModal = document.getElementById('help-modal');

// ゲームカード（遷移あり）— まとめてハンドル
document.querySelectorAll('.game-card:not(.placeholder)').forEach(card => {
  card.addEventListener('click', (e) => {
    e.preventDefault();
    playPopSound();
    setTimeout(() => { window.location.href = card.getAttribute('href'); }, 100);
  });
});

// プレースホルダー（準備中）
document.getElementById('card-placeholder').addEventListener('click', () => {
  playPopSound();
  msgModal.classList.add('active');
});

// ヘルプボタン
document.getElementById('btn-help').addEventListener('click', () => {
  playPopSound();
  helpModal.classList.add('active');
});

// モーダルを閉じる
document.getElementById('btn-close-msg').addEventListener('click', () => {
  playCloseSound();
  msgModal.classList.remove('active');
});

document.getElementById('btn-close-help').addEventListener('click', () => {
  playCloseSound();
  helpModal.classList.remove('active');
});

// モーダル外側タップで閉じる
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
document.body.addEventListener('click',      initAudio, { once: true });

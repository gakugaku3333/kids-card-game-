/*
 * core/confetti.js — 正解・ごほうび時のキラキラ演出
 *
 * DOM要素だけで完結する軽量な紙吹雪。canvas不要。
 */
const EMOJI = ['✨', '⭐', '🎉', '💖', '🌟'];

function injectStyle() {
  if (document.getElementById('confetti-style')) return;
  const style = document.createElement('style');
  style.id = 'confetti-style';
  style.textContent = `
    .confetti-piece {
      position: fixed; top: -40px; font-size: 1.8rem; pointer-events: none;
      z-index: 9999; animation: confetti-fall linear forwards;
    }
    @keyframes confetti-fall {
      to { transform: translateY(110vh) rotate(360deg); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

/**
 * 画面全体に紙吹雪を降らせる。
 * @param {number} [count=24]
 */
export function burst(count) {
  injectStyle();
  const n = count || 24;
  for (let i = 0; i < n; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.textContent = EMOJI[Math.floor(Math.random() * EMOJI.length)];
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.animationDuration = `${1.6 + Math.random() * 1.2}s`;
    piece.style.animationDelay = `${Math.random() * 0.4}s`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 3200);
  }
}

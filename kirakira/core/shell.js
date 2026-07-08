/*
 * kirakira/core/shell.js — KiraShell（10歳向け「キラキラひろば」ゲームシェル）
 *
 * 本家core/shell.jsと同じ設計思想（共通ヘッダー・横向き対応・統一リザルトモーダル・
 * タイマー冪等クリーンアップ）を、10歳向けの「ゆめかわ」世界観（パステル紫×ミント×星）で再実装。
 * sound.js/modal.jsはステートレスなので本家core/のものをそのまま共有する。
 */
import * as Store from './store.js';
import { openModal, closeModal, closeOnOverlayClick } from '../../core/modal.js';
import * as sound from '../../core/sound.js';

const HEADER_ID = 'kira-header';
const RESULT_MODAL_ID = 'kira-result-modal';

function injectStyles() {
  if (document.getElementById('kira-base-style')) return;
  const style = document.createElement('style');
  style.id = 'kira-base-style';
  style.textContent = `
    body.kira-body {
      overflow-y: auto; margin: 0; font-family: 'Zen Maru Gothic', 'M PLUS Rounded 1c', sans-serif;
    }
    #${HEADER_ID} {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      padding: 10px 14px;
    }
    #${HEADER_ID} .kira-back {
      text-decoration: none; font-weight: 900; color: #5b4b8a;
      background: rgba(255,255,255,.85); border-radius: 50px; padding: 8px 14px;
      box-shadow: 0 3px 8px rgba(124,92,255,.18); white-space: nowrap;
    }
    #${HEADER_ID} .kira-title { margin: 0; font-size: 1.1rem; flex: 1; text-align: center; color: #5b4b8a; }
    #${HEADER_ID} .kira-tokens {
      font-weight: 900; background: rgba(255,255,255,.85); border-radius: 50px; padding: 8px 14px;
      white-space: nowrap; color: #5b4b8a;
    }
    @media (max-height: 700px) {
      #${HEADER_ID} { padding: 6px 10px; font-size: .9rem; }
    }
    #${RESULT_MODAL_ID} {
      position: fixed; inset: 0; background: rgba(91,75,138,.45); display: none;
      align-items: center; justify-content: center; z-index: 1000; padding: 20px;
    }
    #${RESULT_MODAL_ID}.show { display: flex; }
    .kira-modal-card {
      background: #fff; border-radius: 28px; padding: 30px 26px; max-width: 360px; width: 100%;
      text-align: center; box-shadow: 0 12px 30px rgba(91,75,138,.3);
      border: 3px solid #d9c8ff;
    }
    .kira-modal-card h2 { font-size: 1.9rem; color: #7c5cff; margin: 6px 0; }
    .kira-result-row { display: flex; justify-content: space-around; margin: 16px 0; }
    .kira-result-item { background: #f3ecff; border-radius: 16px; padding: 12px 10px; flex: 1; margin: 0 5px; }
    .kira-result-item .r-label { font-size: .78rem; color: #9a8ac2; display: block; }
    .kira-result-item .r-value { font-size: 1.5rem; font-weight: 900; color: #4a3f6b; }
    .kira-result-best { font-size: .95rem; color: #8a7ab0; margin: 2px 0 10px; }
    #kira-newbest-banner {
      display: none; font-weight: 900; color: #ff6bb0; font-size: 1.1rem; margin-bottom: 4px;
      animation: kira-newbest-pop .5s ease;
    }
    @keyframes kira-newbest-pop {
      0% { transform: scale(.6); opacity: 0; }
      60% { transform: scale(1.15); opacity: 1; }
      100% { transform: scale(1); }
    }
    .kira-btn {
      font-family: inherit; font-weight: 900; border: none; cursor: pointer;
      border-radius: 22px; padding: 14px 30px; font-size: 1.15rem; color: #fff;
      background: linear-gradient(#a78bfa, #7c5cff); box-shadow: 0 5px 0 #5b3fd6; margin: 8px;
    }
    .kira-btn.secondary {
      background: linear-gradient(#7fe8d4, #4fd6bd); box-shadow: 0 5px 0 #2fae98;
      display: inline-block; text-decoration: none;
    }
  `;
  document.head.appendChild(style);
}

export class KiraShell {
  constructor({ gameId, title, homePath }) {
    this.gameId = gameId;
    this.title = title;
    this.homePath = homePath || '../../index.html';
    this._timers = [];
    this._rafs = [];

    document.body.classList.add('kira-body');
    injectStyles();
    this._injectHeader();
    this._ensureResultModal();
    document.body.addEventListener('pointerdown', () => sound.resume(), { once: true });
  }

  _injectHeader() {
    if (document.getElementById(HEADER_ID)) return;
    const header = document.createElement('header');
    header.id = HEADER_ID;
    header.innerHTML =
      `<a href="${this.homePath}" class="kira-back">🏠 もどる</a>` +
      `<h1 class="kira-title">${this.title}</h1>` +
      `<span class="kira-tokens">🌟 <span id="kira-tokens-value">${Store.getTokens()}</span></span>`;
    document.body.prepend(header);
    document.addEventListener('kirakira-tokens-changed', () => {
      const el = document.getElementById('kira-tokens-value');
      if (el) el.textContent = Store.getTokens();
    });
  }

  _ensureResultModal() {
    const existing = document.getElementById(RESULT_MODAL_ID);
    if (existing) { this.resultModal = existing; return; }
    const modal = document.createElement('div');
    modal.id = RESULT_MODAL_ID;
    // core/modal.jsは「store-modal」クラスを見て開閉クラスを'show'に決める（見た目はkirakira側で自前定義）
    modal.className = 'store-modal';
    modal.innerHTML =
      `<div class="kira-modal-card">` +
        `<div id="kira-newbest-banner">🌟 じこベストこうしん！</div>` +
        `<div style="font-size:3.4rem;">✨</div>` +
        `<h2>クリア！</h2>` +
        `<div class="kira-result-row">` +
          `<div class="kira-result-item"><span class="r-label">せいかい</span><span id="kira-r-correct" class="r-value">0</span></div>` +
          `<div class="kira-result-item"><span class="r-label">ゲット🌟</span><span id="kira-r-tokens" class="r-value">0</span></div>` +
        `</div>` +
        `<div class="kira-result-best">じこベスト: <span id="kira-r-best">-</span></div>` +
        `<button id="kira-btn-again" class="kira-btn">もういちど</button>` +
        `<a href="${this.homePath}" class="kira-btn secondary">🏠 もどる</a>` +
      `</div>`;
    document.body.appendChild(modal);
    closeOnOverlayClick(modal);
    this.resultModal = modal;
  }

  onRetry(fn) {
    document.getElementById('kira-btn-again').addEventListener('click', () => {
      closeModal(this.resultModal);
      this.startGame(fn);
    });
  }

  setInterval(fn, ms) {
    const id = window.setInterval(fn, ms);
    this._timers.push(id);
    return id;
  }

  requestAnimationFrame(fn) {
    const id = window.requestAnimationFrame(fn);
    this._rafs.push(id);
    return id;
  }

  _cleanup() {
    this._timers.forEach((id) => clearInterval(id));
    this._rafs.forEach((id) => cancelAnimationFrame(id));
    this._timers = [];
    this._rafs = [];
  }

  startGame(fn) {
    this._cleanup();
    fn();
  }

  showResult({ correct = 0, total = 0, tokens = 0 }) {
    this._cleanup();
    if (tokens > 0) Store.addTokens(tokens);
    const { isNewBest, best } = Store.recordScore(this.gameId, { correct, total, tokens });
    document.getElementById('kira-r-correct').textContent = total ? `${correct}/${total}` : String(correct);
    document.getElementById('kira-r-tokens').textContent = String(tokens);
    const bestEl = document.getElementById('kira-r-best');
    if (bestEl) bestEl.textContent = best ? (best.total ? `${best.correct}/${best.total}` : String(best.correct)) : '-';
    const banner = document.getElementById('kira-newbest-banner');
    const showBanner = isNewBest && correct > 0;
    if (banner) banner.style.display = showBanner ? 'block' : 'none';
    sound.play(showBanner ? 'coin' : 'clear');
    openModal(this.resultModal);
  }

  get sound() { return sound; }
  get store() { return Store; }
}

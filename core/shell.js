/*
 * core/shell.js — ゲームシェル
 *
 * 新規ゲームは GameShell を1つ生成するだけで、共通ヘッダー・横向き対応・
 * 統一リザルトモーダル・タイマーの冪等クリーンアップ・効果音が付いてくる。
 * 「新規ゲーム追加時の7ステップ手作業」をコード化したもの（games/_template/ 参照）。
 */
import * as Store from './store.js';
import * as FireLog from './firelog.js';
import { openModal, closeModal, closeOnOverlayClick } from './modal.js';
import * as sound from './sound.js';

const HEADER_ID = 'shell-header';
const RESULT_MODAL_ID = 'shell-result-modal';

function injectStyles() {
  if (document.getElementById('shell-base-style')) return;
  const style = document.createElement('style');
  style.id = 'shell-base-style';
  style.textContent = `
    body.shell-body { overflow-y: auto; margin: 0; font-family: 'M PLUS Rounded 1c', sans-serif; }
    #${HEADER_ID} {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      padding: 10px 14px;
    }
    #${HEADER_ID} .shell-back {
      text-decoration: none; font-weight: 900; color: #5a4632;
      background: rgba(255,255,255,.85); border-radius: 50px; padding: 8px 14px;
      box-shadow: 0 3px 8px rgba(0,0,0,.18); white-space: nowrap;
    }
    #${HEADER_ID} .shell-title { margin: 0; font-size: 1.1rem; flex: 1; text-align: center; }
    #${HEADER_ID} .shell-tokens {
      font-weight: 900; background: rgba(255,255,255,.85); border-radius: 50px; padding: 8px 14px;
      white-space: nowrap;
    }
    @media (max-height: 700px) {
      #${HEADER_ID} { padding: 6px 10px; font-size: .9rem; }
    }
    .shell-modal-card {
      background: #fff; border-radius: 28px; padding: 30px 26px; max-width: 360px; width: 100%;
      text-align: center; box-shadow: 0 12px 30px rgba(0,0,0,.3);
    }
    .shell-modal-card h2 { font-size: 1.9rem; color: #ff8c2b; margin: 6px 0; }
    .shell-result-row { display: flex; justify-content: space-around; margin: 16px 0; }
    .shell-result-item { background: #fff6ec; border-radius: 16px; padding: 12px 10px; flex: 1; margin: 0 5px; }
    .shell-result-item .r-label { font-size: .78rem; color: #a98; display: block; }
    .shell-result-item .r-value { font-size: 1.5rem; font-weight: 900; color: #4a3f3a; }
    .shell-btn {
      font-family: inherit; font-weight: 900; border: none; cursor: pointer;
      border-radius: 22px; padding: 14px 30px; font-size: 1.15rem; color: #fff;
      background: linear-gradient(#ffb347, #ff9a3d); box-shadow: 0 5px 0 #e07e22; margin: 8px;
    }
    .shell-btn.secondary {
      background: linear-gradient(#9bd4ff, #6bb8f5); box-shadow: 0 5px 0 #4a90d9;
      display: inline-block; text-decoration: none;
    }
  `;
  document.head.appendChild(style);
}

export class GameShell {
  constructor({ gameId, title, homePath }) {
    this.gameId = gameId;
    this.title = title;
    this.homePath = homePath || '../../index.html';
    this._timers = [];
    this._rafs = [];

    document.body.classList.add('shell-body');
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
      `<a href="${this.homePath}" class="shell-back">🏠 もどる</a>` +
      `<h1 class="shell-title">${this.title}</h1>` +
      `<span class="shell-tokens">⭐ <span id="shell-tokens-value">${Store.getTokens()}</span></span>`;
    document.body.prepend(header);
    document.addEventListener('tokens-changed', () => {
      const el = document.getElementById('shell-tokens-value');
      if (el) el.textContent = Store.getTokens();
    });
  }

  _ensureResultModal() {
    const existing = document.getElementById(RESULT_MODAL_ID);
    if (existing) { this.resultModal = existing; return; }
    const modal = document.createElement('div');
    modal.id = RESULT_MODAL_ID;
    modal.className = 'store-modal';
    modal.innerHTML =
      `<div class="shell-modal-card">` +
        `<div style="font-size:3.4rem;">🎉</div>` +
        `<h2>おわり！</h2>` +
        `<div class="shell-result-row">` +
          `<div class="shell-result-item"><span class="r-label">せいかい</span><span id="shell-r-correct" class="r-value">0</span></div>` +
          `<div class="shell-result-item"><span class="r-label">ゲット⭐</span><span id="shell-r-tokens" class="r-value">0</span></div>` +
        `</div>` +
        `<button id="shell-btn-again" class="shell-btn">もういちど あそぶ</button>` +
        `<a href="${this.homePath}" class="shell-btn secondary">🏠 メニューにもどる</a>` +
      `</div>`;
    document.body.appendChild(modal);
    closeOnOverlayClick(modal);
    this.resultModal = modal;
  }

  // 「もういちど あそぶ」ボタンを、渡した開始関数に紐づける
  onRetry(fn) {
    document.getElementById('shell-btn-again').addEventListener('click', () => {
      closeModal(this.resultModal);
      this.startGame(fn);
    });
  }

  // タイマー/ループはこれ経由で登録すると startGame() 冒頭で自動クリーンアップされる
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

  // 冪等ガード: 呼ぶたびに前回のタイマーを掃除してから開始関数を実行
  startGame(fn) {
    this._cleanup();
    fn();
  }

  showResult({ correct = 0, total = 0, tokens = 0 }) {
    this._cleanup();
    if (tokens > 0) Store.addTokens(tokens);
    FireLog.logSession(this.gameId, correct, total, tokens);
    document.getElementById('shell-r-correct').textContent = total ? `${correct}/${total}` : String(correct);
    document.getElementById('shell-r-tokens').textContent = String(tokens);
    sound.play('clear');
    openModal(this.resultModal);
  }

  get sound() { return sound; }
  get store() { return Store; }
  get fireLog() { return FireLog; }
}

/*
 * core/shell.js — ToddlerShell（ちびっこひろば版ゲームシェル）
 *
 * 3歳児設計原則（tasks/3歳向けゲームひろば計画書.md 2章）をコード化:
 *   - 文字を読ませない → 音声(voice.js)＋アイコンのみのUI
 *   - 誤タップで壊れない → ホームボタンは確認ワンクッション、設定はペアレンタルゲート(2秒長押し)
 *   - タイマー冪等クリーンアップ / 横向き対応 / 確認画面なしの即時スタート（最初のタップで音声unlock）
 *   - 「できたね！」リザルト＋シール排出演出（失敗が存在しないので正解数は参考表示のみ）
 */
import * as Store from './store.js';
import * as Voice from './voice.js';
import * as sound from './sound.js';
import * as Confetti from './confetti.js';
import { asset } from './paths.js';

const HEADER_ID = 'toddler-header';
const RESULT_MODAL_ID = 'toddler-result-modal';
const GATE_MODAL_ID = 'toddler-gate-modal';
const HOME_CONFIRM_ID = 'toddler-home-confirm';

function injectStyles() {
  if (document.getElementById('toddler-shell-style')) return;
  const style = document.createElement('style');
  style.id = 'toddler-shell-style';
  style.textContent = `
    body.toddler-body {
      margin: 0; overflow-y: auto; font-family: 'M PLUS Rounded 1c', sans-serif;
      min-height: 100vh; box-sizing: border-box;
    }
    #${HEADER_ID} {
      position: fixed; top: 8px; left: 8px; z-index: 500;
      display: flex; gap: 8px;
    }
    #${HEADER_ID} button {
      width: 52px; height: 52px; border-radius: 50%; border: none; cursor: pointer;
      font-size: 1.6rem; background: rgba(255,255,255,.9); box-shadow: 0 3px 8px rgba(0,0,0,.2);
    }
    .toddler-overlay {
      position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center;
      background: rgba(255,246,230,.97); padding: 20px; box-sizing: border-box;
    }
    .toddler-overlay.hidden { display: none; }
    .toddler-card {
      background: #fff; border-radius: 32px; padding: 34px 26px; max-width: 420px; width: 100%;
      text-align: center; box-shadow: 0 14px 34px rgba(0,0,0,.25);
    }
    .toddler-emoji { font-size: 4rem; line-height: 1; margin-bottom: 8px; }
    .toddler-sticker-img { width: 140px; height: 140px; object-fit: contain; margin: 10px auto; display: block; }
    .toddler-btn {
      font-family: inherit; font-weight: 900; border: none; cursor: pointer;
      border-radius: 26px; padding: 22px 20px; font-size: 2rem; color: #fff;
      background: linear-gradient(#ffb347, #ff9a3d); box-shadow: 0 6px 0 #e07e22;
      margin: 10px auto; display: block; min-width: 120px; min-height: 100px;
    }
    .toddler-btn.secondary {
      background: linear-gradient(#9bd4ff, #6bb8f5); box-shadow: 0 6px 0 #4a90d9;
    }
    .toddler-btn-row { display: flex; justify-content: center; gap: 14px; flex-wrap: wrap; }
    @media (max-height: 700px) {
      .toddler-card { padding: 20px 16px; }
      .toddler-emoji { font-size: 2.6rem; }
      .toddler-btn { padding: 16px 14px; font-size: 1.6rem; min-height: 76px; }
    }
  `;
  document.head.appendChild(style);
}

export class ToddlerShell {
  constructor({ gameId, homePath }) {
    this.gameId = gameId;
    this.homePath = homePath || '../../index.html';
    this._timers = [];
    this._rafs = [];

    document.body.classList.add('toddler-body');
    injectStyles();
    this._injectHeader();
    this._ensureResultModal();
    this._ensureHomeConfirm();
    this._ensureGateModal();
  }

  _injectHeader() {
    if (document.getElementById(HEADER_ID)) return;
    const header = document.createElement('div');
    header.id = HEADER_ID;
    header.innerHTML = `<button id="toddler-home-btn" aria-label="ホーム">🏠</button>`;
    document.body.prepend(header);
    const homeBtn = header.querySelector('#toddler-home-btn');
    homeBtn.addEventListener('click', () => this._openHomeConfirm());

    let pressTimer = null;
    homeBtn.addEventListener('pointerdown', () => {
      pressTimer = setTimeout(() => this._openGate(), 2000);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => {
      homeBtn.addEventListener(ev, () => { if (pressTimer) clearTimeout(pressTimer); });
    });
  }

  _ensureHomeConfirm() {
    if (document.getElementById(HOME_CONFIRM_ID)) return;
    const modal = document.createElement('div');
    modal.id = HOME_CONFIRM_ID;
    modal.className = 'toddler-overlay hidden';
    modal.innerHTML = `
      <div class="toddler-card">
        <div class="toddler-emoji">🏠</div>
        <div class="toddler-btn-row">
          <button class="toddler-btn" id="toddler-home-yes">✅</button>
          <button class="toddler-btn secondary" id="toddler-home-no">✖️</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#toddler-home-yes').addEventListener('click', () => {
      window.location.href = this.homePath;
    });
    modal.querySelector('#toddler-home-no').addEventListener('click', () => modal.classList.add('hidden'));
    this._homeConfirm = modal;
  }

  _openHomeConfirm() {
    Voice.speak('home-confirm');
    this._homeConfirm.classList.remove('hidden');
  }

  _ensureGateModal() {
    if (document.getElementById(GATE_MODAL_ID)) return;
    const modal = document.createElement('div');
    modal.id = GATE_MODAL_ID;
    modal.className = 'toddler-overlay hidden';
    modal.innerHTML = `
      <div class="toddler-card">
        <div class="toddler-emoji">👨‍👩‍👧</div>
        <p style="font-weight:900;color:#5a4632;">おうちのひとメニュー</p>
        <div class="toddler-btn-row">
          <button class="toddler-btn" id="toddler-gate-mute">🔈</button>
          <button class="toddler-btn secondary" id="toddler-gate-close">✖️</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const muteBtn = modal.querySelector('#toddler-gate-mute');
    muteBtn.textContent = sound.muted() ? '🔇' : '🔈';
    muteBtn.addEventListener('click', () => {
      const muted = sound.toggleMute();
      muteBtn.textContent = muted ? '🔇' : '🔈';
    });
    modal.querySelector('#toddler-gate-close').addEventListener('click', () => modal.classList.add('hidden'));
    this._gateModal = modal;
  }

  _openGate() {
    this._gateModal.classList.remove('hidden');
  }

  /**
   * 確認画面なしでゲームを即開始する。音声unlockは最初のタップに便乗させる
   * （二度タップの手間をなくすため、専用のスタート画面は挟まない）。
   * @param {object} opts - { greeting, onStart }
   */
  autoStart({ greeting, onStart }) {
    document.body.addEventListener('pointerdown', () => {
      Voice.unlock();
      sound.resume();
      if (greeting) Voice.speak(greeting);
    }, { once: true });
    this.startGame(onStart);
  }

  _ensureResultModal() {
    if (document.getElementById(RESULT_MODAL_ID)) return;
    const modal = document.createElement('div');
    modal.id = RESULT_MODAL_ID;
    modal.className = 'toddler-overlay hidden';
    modal.innerHTML = `
      <div class="toddler-card">
        <div class="toddler-emoji">🎉</div>
        <img id="toddler-r-sticker" class="toddler-sticker-img" src="" alt="シール" />
        <div class="toddler-btn-row">
          <button class="toddler-btn" id="toddler-r-again">🔁</button>
          <button class="toddler-btn secondary" id="toddler-r-home">🏠</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#toddler-r-home').addEventListener('click', () => {
      window.location.href = this.homePath;
    });
    this.resultModal = modal;
  }

  onRetry(fn) {
    this.resultModal.querySelector('#toddler-r-again').onclick = () => {
      this.resultModal.classList.add('hidden');
      this.startGame(fn);
    };
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

  // 冪等ガード: 呼ぶたびに前回のタイマーを掃除してから開始関数を実行
  startGame(fn) {
    this._cleanup();
    fn();
  }

  /**
   * 「できたね！」リザルト表示。失敗は存在しないため常にシールを1枚必ず排出する。
   * @param {object} opts - { correct, total }
   */
  showResult({ correct = 0, total = 0 } = {}) {
    this._cleanup();
    Store.recordGamePlay(this.gameId);
    const { sticker, isNew, newTheme } = Store.grantSticker();
    sound.play('clear');
    Confetti.burst();
    const img = this.resultModal.querySelector('#toddler-r-sticker');
    img.src = asset(sticker.file);
    img.alt = sticker.id;
    this.resultModal.classList.remove('hidden');
    Voice.speak(isNew ? 'result-new' : 'result-again');
    if (newTheme) {
      setTimeout(() => Voice.speak('new-theme'), 1800);
    }
  }

  get sound() { return sound; }
  get voice() { return Voice; }
  get store() { return Store; }
}

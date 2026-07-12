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
    #${HEADER_ID} .shell-mute {
      font-family: inherit; border: none; cursor: pointer; font-size: 1.2rem;
      background: rgba(255,255,255,.85); border-radius: 50%; width: 40px; height: 40px;
      box-shadow: 0 3px 8px rgba(0,0,0,.18); flex-shrink: 0;
    }
    #${HEADER_ID} .shell-avatar {
      width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,.85);
      display: flex; align-items: center; justify-content: center; font-size: 1.3rem;
      box-shadow: 0 3px 8px rgba(0,0,0,.18); flex-shrink: 0; overflow: hidden;
    }
    #${HEADER_ID} .shell-avatar img { width: 100%; height: 100%; object-fit: contain; }
    @media (max-height: 700px) {
      #${HEADER_ID} { padding: 6px 10px; font-size: .9rem; }
    }
    /* リザルトモーダルの表示制御。css/store.css の .store-modal と同等だが、
       ゲームページは store.css を読み込まないため shell 側で自前に持つ */
    #${RESULT_MODAL_ID} {
      position: fixed; inset: 0; background: rgba(92,76,81,.45); display: none;
      align-items: center; justify-content: center; z-index: 1000; padding: 20px;
    }
    #${RESULT_MODAL_ID}.show { display: flex; }
    .shell-modal-card {
      background: #fff; border-radius: 28px; padding: 30px 26px; max-width: 360px; width: 100%;
      text-align: center; box-shadow: 0 12px 30px rgba(0,0,0,.3);
    }
    .shell-modal-card h2 { font-size: 1.9rem; color: #ff8c2b; margin: 6px 0; }
    .shell-result-row { display: flex; justify-content: space-around; margin: 16px 0; }
    .shell-result-item { background: #fff6ec; border-radius: 16px; padding: 12px 10px; flex: 1; margin: 0 5px; }
    .shell-result-item .r-label { font-size: .78rem; color: #a98; display: block; }
    .shell-result-item .r-value { font-size: 1.5rem; font-weight: 900; color: #4a3f3a; }
    .shell-result-best { font-size: .95rem; color: #8a7a6a; margin: 2px 0 10px; }
    #shell-newbest-banner, #shell-evolve-banner {
      display: none; font-weight: 900; color: #ff6b35; font-size: 1.1rem; margin-bottom: 4px;
      animation: shell-newbest-pop .5s ease;
    }
    @keyframes shell-newbest-pop {
      0% { transform: scale(.6); opacity: 0; }
      60% { transform: scale(1.15); opacity: 1; }
      100% { transform: scale(1); }
    }
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
    this._buddyStageAtStart = Store.getBuddyStage();

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
    const avatar = Store.getAvatar();
    // 買ったアバターを一緒に連れて遊べるようにする（ショップ経済を「貯める→買う→終わり」で終わらせない）。
    // SHOP_ITEMSのicon画像パスはサイトルート基準なので、ネストしたゲームページ用にhomePathから逆算して補正する。
    const avatarItem = avatar.base && Store.SHOP_ITEMS.find((i) => i.id === avatar.base);
    const rootPrefix = this.homePath.replace(/index\.html$/, '');
    const resolvedIcon = avatarItem && avatarItem.icon.indexOf('/') !== -1 && !/^https?:/.test(avatarItem.icon)
      ? rootPrefix + avatarItem.icon
      : (avatarItem ? avatarItem.icon : null);
    const avatarHtml = avatarItem ? `<span class="shell-avatar">${Store.getIconHtml(resolvedIcon, avatarItem.name)}</span>` : '';
    // クイズで正解を重ねるほど育つお供キャラ（トークンを貯める以外の「成長の見える化」）
    const buddy = Store.getBuddyStage();
    const buddyHtml = `<span id="shell-buddy-value" class="shell-avatar" title="${buddy.name}">${buddy.emoji}</span>`;
    header.innerHTML =
      `<a href="${this.homePath}" class="shell-back">🏠 もどる</a>` +
      avatarHtml +
      buddyHtml +
      `<h1 class="shell-title">${this.title}</h1>` +
      `<span class="shell-tokens">⭐ <span id="shell-tokens-value">${Store.getTokens()}</span></span>` +
      `<button class="shell-mute" id="shell-mute-btn">${sound.muted() ? '🔇' : '🔈'}</button>`;
    document.body.prepend(header);
    document.addEventListener('tokens-changed', () => {
      const el = document.getElementById('shell-tokens-value');
      if (el) el.textContent = Store.getTokens();
    });
    header.querySelector('#shell-mute-btn').addEventListener('click', (ev) => {
      const nowMuted = sound.toggleMute();
      ev.currentTarget.textContent = nowMuted ? '🔇' : '🔈';
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
        `<div id="shell-newbest-banner">🎉 じこベストこうしん！</div>` +
        `<div id="shell-evolve-banner"></div>` +
        `<div style="font-size:3.4rem;">🎉</div>` +
        `<h2>おわり！</h2>` +
        `<div class="shell-result-row">` +
          `<div class="shell-result-item"><span class="r-label">せいかい</span><span id="shell-r-correct" class="r-value">0</span></div>` +
          `<div class="shell-result-item"><span class="r-label">ゲット⭐</span><span id="shell-r-tokens" class="r-value">0</span></div>` +
        `</div>` +
        `<div class="shell-result-best">じこベスト: <span id="shell-r-best">-</span></div>` +
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
    const { isNewBest, best } = Store.recordScore(this.gameId, { correct, total, tokens });
    document.getElementById('shell-r-correct').textContent = total ? `${correct}/${total}` : String(correct);
    document.getElementById('shell-r-tokens').textContent = String(tokens);
    const bestEl = document.getElementById('shell-r-best');
    if (bestEl) bestEl.textContent = best ? (best.total ? `${best.correct}/${best.total}` : String(best.correct)) : '-';
    const banner = document.getElementById('shell-newbest-banner');
    const showBanner = isNewBest && correct > 0;
    if (banner) banner.style.display = showBanner ? 'block' : 'none';

    const buddy = Store.getBuddyStage();
    const evolveBanner = document.getElementById('shell-evolve-banner');
    const evolved = buddy.emoji !== this._buddyStageAtStart.emoji;
    if (evolveBanner) {
      evolveBanner.textContent = `${buddy.emoji} おともが「${buddy.name}」に そだったよ！`;
      evolveBanner.style.display = evolved ? 'block' : 'none';
    }
    const buddyEl = document.getElementById('shell-buddy-value');
    if (buddyEl) { buddyEl.textContent = buddy.emoji; buddyEl.title = buddy.name; }

    sound.play(showBanner || evolved ? 'coin' : 'clear');
    openModal(this.resultModal);
  }

  get sound() { return sound; }
  get store() { return Store; }
  get fireLog() { return FireLog; }
}

/*
 * core/questSkin.js — クイズの世界観スキン表示ヘルパー（本家版）
 *
 * kirakira/core/questSkin.js のロジック層のみを本家向けに移植したもの。
 * 進行データは core/store.js の questProgress に持つため kirakira/core/ には依存しない
 * （tasks/ちびっこキラキラ_バージョンアップ計画書.md 4章「本家Phase C」参照）。
 */
import * as Store from './store.js';

// 図鑑グリッドを描画する。allItems: [{id, emoji, name}]
export function renderItemGallery(containerEl, allItems, gameId) {
  const unlocked = Store.getQuestProgress(gameId).unlockedItems || [];
  containerEl.innerHTML = allItems.map((item) => {
    const has = unlocked.indexOf(item.id) !== -1;
    return `<div class="quest-item${has ? ' unlocked' : ''}" title="${has ? item.name : '？？？'}">` +
      `<span class="quest-item-emoji">${has ? item.emoji : '❔'}</span>` +
      `</div>`;
  }).join('');
  return unlocked;
}

// 解放演出トースト（画面上部にポップして数秒で消える）
export function showUnlockToast(item) {
  let toast = document.getElementById('quest-unlock-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'quest-unlock-toast';
    toast.style.cssText =
      'position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:1200;' +
      'background:linear-gradient(#fff6ff,#f3ecff);border:2px solid #d9c8ff;border-radius:18px;' +
      'padding:10px 20px;font-weight:900;color:#5b4b8a;box-shadow:0 8px 20px rgba(124,92,255,.25);' +
      'opacity:0;transition:opacity .25s, transform .25s;pointer-events:none;';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `🎁 New! <span style="font-size:1.4rem">${item.emoji}</span> ${item.name}`;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-10px)';
  }, 1800);
}

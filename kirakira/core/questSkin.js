/*
 * kirakira/core/questSkin.js — 学習系「クエスト」ゲーム共通スキン基盤
 *
 * QuizEngine（出題・採点）に被せる世界観レイヤー。依頼文の差し込み・
 * 正解でアイテムを解放する演出・図鑑グリッド描画を各ゲームで使い回す。
 * 進行状態そのものは kirakira/core/store.js の questProgress に持つ。
 */
import * as Store from './store.js';

export function fillTemplate(template, vars) {
  if (!template || !vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, key) => (key in vars ? vars[key] : m));
}

// 図鑑/メニューだなグリッドを描画する。allItems: [{id, emoji, name}]
export function renderItemGallery(containerEl, allItems, gameId) {
  const unlocked = Store.getQuestProgress(gameId).unlockedItems || [];
  containerEl.innerHTML = allItems.map((item) => {
    const has = unlocked.indexOf(item.id) !== -1;
    return `<div class="quest-item${has ? ' unlocked' : ''}" title="${has ? item.name : '？？？'}">` +
      `<span class="quest-item-emoji">${has ? item.emoji : '❔'}</span>` +
      (has ? `<span class="quest-item-name">${item.name}</span>` : '') +
      `</div>`;
  }).join('');
  return unlocked;
}

// 正解のごほうびとして次に解放すべき未取得アイテムを1つ選ぶ（順番固定・全取得済みならnull）
export function pickNextUnlock(allItems, gameId) {
  const unlocked = Store.getQuestProgress(gameId).unlockedItems || [];
  const next = allItems.find((item) => unlocked.indexOf(item.id) === -1);
  return next || null;
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
  toast.innerHTML = `🎉 New! <span style="font-size:1.4rem">${item.emoji}</span> ${item.name}`;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-10px)';
  }, 1800);
}

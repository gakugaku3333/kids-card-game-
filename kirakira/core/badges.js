/*
 * kirakira/core/badges.js — バッジ判定の共通ロジック
 * data/badges.json の定義(metric/threshold)を現在のstore状態と突き合わせ、
 * 新規に条件を満たしたバッジを解除する。累積カウント系のみを対象とする
 * ジェネリックな設計にすることで、バッジを増やす際もコード変更なしで済む。
 */
import * as Store from './store.js';

const METRIC_FNS = {
  bestScoreCount: () => Object.keys(Store.getAllBestScores()).length,
  ownedItemCount: () => Store.getOwned().length,
  outfitCount: () => Store.getOutfits().length,
  dotArtCount: () => Store.getDotArtGallery().length,
  songCount: () => Store.getSongs().length,
  furnitureCount: () => Store.getRoomLayout().furniture.length,
  gachaPulls: () => Store.getGachaPulls(),
};

let cachedDefs = null;
async function loadDefs() {
  if (cachedDefs) return cachedDefs;
  const base = new URL('../data/badges.json', import.meta.url);
  const res = await fetch(base);
  const json = await res.json();
  cachedDefs = json.badges;
  return cachedDefs;
}

// 現在のstore状態を全バッジ定義と突き合わせ、新規解除分を返す(トークン報酬も同時に付与)
export async function evaluateBadges() {
  const defs = await loadDefs();
  const newlyUnlocked = [];
  for (const b of defs) {
    if (Store.hasBadge(b.id)) continue;
    const metricFn = METRIC_FNS[b.metric];
    if (!metricFn || metricFn() < b.threshold) continue;
    Store.grantBadge(b.id);
    if (b.reward) Store.addTokens(b.reward);
    newlyUnlocked.push(b);
  }
  return newlyUnlocked;
}

export async function getAllBadgeDefs() {
  return loadDefs();
}

// 新規解除バッジ・デイリーおしごと達成などをトースト表示する共通部品(全ページ共通の軽量演出。モーダルほど重くしない)。
// messageは呼び出し側の文脈に合わせる(既定はバッジ獲得文言。デイリーおしごとからは「クリア」系の文言を渡す)。
export function showBadgeToast(item, message = `バッジ「${item.name}」ゲット！`) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed; left: 50%; top: 14px; transform: translateX(-50%) translateY(-20px);
    background: #fff; border: 3px solid #ffd76b; border-radius: 20px; padding: 10px 20px;
    box-shadow: 0 8px 20px rgba(91,75,138,.3); z-index: 2000; text-align: center;
    font-family: 'Zen Maru Gothic', sans-serif; opacity: 0; transition: all .35s ease;
    max-width: 90vw;
  `;
  toast.innerHTML = `<div style="font-size:1.6rem;">${item.emoji}</div><div style="font-weight:900;color:#7c5cff;font-size:.95rem;">${message}</div>`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-20px)';
    setTimeout(() => toast.remove(), 400);
  }, 2600);
}

// 判定→トースト表示までを一括で行う便利関数(各ゲームの保存アクション後に呼ぶ)
export async function evaluateAndToast() {
  const unlocked = await evaluateBadges();
  unlocked.forEach((b, i) => setTimeout(() => showBadgeToast(b), i * 600));
  return unlocked;
}

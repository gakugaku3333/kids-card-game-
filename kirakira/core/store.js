/*
 * kirakira/core/store.js — トークン経済モジュール（10歳向け「キラキラひろば」版）
 *
 * 本家 core/store.js とは完全分離した kirakira_data キーを使う
 * （[[project-lessons]]: サイト間でlocalStorageキーは絶対に共有しない）。
 * 自己ベスト記録は「遊んで成長する」哲学の核なので、Phase 0の時点で組み込んでおく。
 */
export const STORAGE_KEY = 'kirakira_data';

function load() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch (e) {
    raw = null;
  }
  if (!raw || typeof raw !== 'object') raw = {};
  return {
    tokens: typeof raw.tokens === 'number' ? raw.tokens : 0,
    ownedItems: Array.isArray(raw.ownedItems) ? raw.ownedItems : [],
    bestScores: (raw.bestScores && typeof raw.bestScores === 'object') ? raw.bestScores : {},
    badges: Array.isArray(raw.badges) ? raw.badges : [],
    questProgress: (raw.questProgress && typeof raw.questProgress === 'object') ? raw.questProgress : {},
    // Phase 3: 創造・収集系(コーデスタジオ/マイルーム/ドット絵スタジオ/リズム&メロディ)＋経済まわり
    outfits: Array.isArray(raw.outfits) ? raw.outfits : [],
    roomLayout: (raw.roomLayout && typeof raw.roomLayout === 'object') ? raw.roomLayout : { wallpaper: null, floor: null, furniture: [] },
    dotArtGallery: Array.isArray(raw.dotArtGallery) ? raw.dotArtGallery : [],
    songs: Array.isArray(raw.songs) ? raw.songs : [],
    gachaPulls: typeof raw.gachaPulls === 'number' ? raw.gachaPulls : 0,
    // Phase 5: 経済の完結(クーポン消費・デイリーおしごと)
    usedCoupons: Array.isArray(raw.usedCoupons) ? raw.usedCoupons : [],
    daily: (raw.daily && typeof raw.daily === 'object') ? raw.daily : { date: '', plays: 0, correctSum: 0, completedMissionIds: [] },
  };
}

let data = load();

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  try {
    document.dispatchEvent(new CustomEvent('kirakira-tokens-changed', { detail: { tokens: data.tokens } }));
  } catch (e) { /* noop */ }
}

export function getTokens() { return data.tokens; }
export function addTokens(n) { data.tokens += n; save(); return data.tokens; }
export function spendTokens(n) {
  if (data.tokens < n) return false;
  data.tokens -= n; save(); return true;
}

export function getOwned() { return data.ownedItems.slice(); }
export function owns(id) { return data.ownedItems.indexOf(id) !== -1; }
export function buy(id, price) {
  if (owns(id) || data.tokens < price) return false;
  data.tokens -= price;
  data.ownedItems.push(id);
  save();
  return true;
}
// ガチャなど「価格チェックなしでアイテム付与」用。既に持っていればfalseを返す(呼び出し側でダブり分の埋め合わせ判断に使う)。
export function grantItem(id) {
  const isNew = !owns(id);
  if (isNew) { data.ownedItems.push(id); save(); }
  return isNew;
}

export function getGachaPulls() { return data.gachaPulls; }
export function incrementGachaPulls() { data.gachaPulls++; save(); return data.gachaPulls; }

// コーデスタジオ: 保存したコーデ写真(アイテムidの組み合わせ)
export function getOutfits() { return data.outfits.slice(); }
export function saveOutfit(outfit) {
  data.outfits.push(outfit);
  save();
  return data.outfits.length;
}

// マイルーム: 壁紙・ゆか・家具配置。ハブ背景にも壁紙を反映する。
export function getRoomLayout() { return data.roomLayout; }
export function setRoomLayout(layout) {
  data.roomLayout = layout;
  save();
}

// ドット絵スタジオ: ギャラリー(容量を抑えるため直近24件までFIFOで保持)
const DOT_ART_LIMIT = 24;
export function getDotArtGallery() { return data.dotArtGallery.slice(); }
export function saveDotArt(art) {
  data.dotArtGallery.push(art);
  if (data.dotArtGallery.length > DOT_ART_LIMIT) data.dotArtGallery.shift();
  save();
  return data.dotArtGallery.length;
}

// リズム&メロディ(メロディメーカー): 作曲した楽曲(直近16件までFIFOで保持)
const SONG_LIMIT = 16;
export function getSongs() { return data.songs.slice(); }
export function saveSong(song) {
  data.songs.push(song);
  if (data.songs.length > SONG_LIMIT) data.songs.shift();
  save();
  return data.songs.length;
}

// 自己ベスト。既定はcorrectが多いほど良い、という単純な比較(本家Phase Aと同じ設計)。
// compareField('time'|'moves')が渡された場合はその値が小さいほど良い比較に切り替える(めいろEX/しんけいすいじゃくEX等)。
export function getBestScore(gameId) {
  return data.bestScores[gameId] || null;
}

export function recordScore(gameId, { correct = 0, total = 0, tokens = 0, time, moves } = {}, { compareField = null } = {}) {
  const prev = data.bestScores[gameId];
  const val = compareField === 'time' ? time : compareField === 'moves' ? moves : null;
  const hasVal = typeof val === 'number';
  const isNewBest = compareField
    ? (hasVal && (!prev || typeof prev[compareField] !== 'number' || val < prev[compareField]))
    : (!prev || correct > prev.correct);
  if (isNewBest) {
    data.bestScores[gameId] = compareField && hasVal
      ? { correct, total, tokens, [compareField]: val }
      : { correct, total, tokens };
    save();
  }
  return { isNewBest, best: data.bestScores[gameId] };
}

export function getAllBestScores() { return { ...data.bestScores }; }

export function hasBadge(id) { return data.badges.indexOf(id) !== -1; }
export function grantBadge(id) {
  const isNew = !hasBadge(id);
  if (isNew) { data.badges.push(id); save(); }
  return isNew;
}
export function getBadges() { return data.badges.slice(); }

// 学習系「クエスト」の進行状態（お店のメニュー・カード図鑑・訪問マップ等）。ゲームごとに自由な形で持たせる。
export function getQuestProgress(gameId) {
  return data.questProgress[gameId] || { unlockedItems: [] };
}

export function unlockQuestItem(gameId, itemId) {
  const progress = data.questProgress[gameId] || (data.questProgress[gameId] = { unlockedItems: [] });
  const isNew = progress.unlockedItems.indexOf(itemId) === -1;
  if (isNew) {
    progress.unlockedItems.push(itemId);
    save();
  }
  return isNew;
}

// ショッピングモールで集めたクーポン(questProgressの図鑑登録=永続記録)を1回だけ購入時に消費できるようにする。
// 図鑑表示は消費してもそのまま残す(記録と在庫を分離)。
export function getUsedCoupons() { return data.usedCoupons.slice(); }
export function hasUnusedCoupon(gameId, couponId) {
  const owned = getQuestProgress(gameId).unlockedItems.indexOf(couponId) !== -1;
  return owned && data.usedCoupons.indexOf(couponId) === -1;
}
export function useCoupon(couponId) {
  if (data.usedCoupons.indexOf(couponId) !== -1) return false;
  data.usedCoupons.push(couponId);
  save();
  return true;
}

// デイリーおしごと: 日付が変わったら自動リセットする軽量カウンタ
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function ensureDaily() {
  const key = todayKey();
  if (data.daily.date !== key) {
    data.daily = { date: key, plays: 0, correctSum: 0, completedMissionIds: [] };
    save();
  }
}
export function getDaily() { ensureDaily(); return { ...data.daily }; }
// ゲーム1回の完了ごとにshowResult()から呼ばれ、プレイ回数と正解数累計を積み上げる
export function trackDailyPlay({ correct = 0 } = {}) {
  ensureDaily();
  data.daily.plays++;
  data.daily.correctSum += correct;
  save();
}
export function hasCompletedDailyMission(id) { ensureDaily(); return data.daily.completedMissionIds.indexOf(id) !== -1; }
export function completeDailyMission(id) {
  ensureDaily();
  if (data.daily.completedMissionIds.indexOf(id) !== -1) return false;
  data.daily.completedMissionIds.push(id);
  save();
  return true;
}

export function reload() { data = load(); return data; }

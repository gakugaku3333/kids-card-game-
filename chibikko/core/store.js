/*
 * core/store.js — シールちょう管理（ちびっこひろば版）
 *
 * 既存サイトの katakana_game_data とは完全分離した chibikko_data キーを使う。
 * トークン経済の代わりに「シール収集」だけを軸にした3歳向けごほうびモデル。
 */
export const STORAGE_KEY = 'chibikko_data';

// rare: プリンセス5人。金縁レア演出は画像側に焼き込み済み（イラスト生成指示書 0.7章）。
export const STICKERS = [
  { id: 'candy', file: 'assets/stickers/candy.png' },
  { id: 'chulip', file: 'assets/stickers/chulip.png' },
  { id: 'cookie', file: 'assets/stickers/cookie.png' },
  { id: 'cupcake', file: 'assets/stickers/cupcake.png' },
  { id: 'densha', file: 'assets/stickers/densha.png' },
  { id: 'donut', file: 'assets/stickers/donut.png' },
  { id: 'fune', file: 'assets/stickers/fune.png' },
  { id: 'glass-kutsu', file: 'assets/stickers/glass-kutsu.png' },
  { id: 'himawari', file: 'assets/stickers/himawari.png' },
  { id: 'hiyoko', file: 'assets/stickers/hiyoko.png' },
  { id: 'hoshi', file: 'assets/stickers/hoshi.png' },
  { id: 'ice', file: 'assets/stickers/ice.png' },
  { id: 'ichigo-cake', file: 'assets/stickers/ichigo-cake.png' },
  { id: 'inu', file: 'assets/stickers/inu.png' },
  { id: 'kikyuu', file: 'assets/stickers/kikyuu.png' },
  { id: 'kirin', file: 'assets/stickers/kirin.png' },
  { id: 'koala', file: 'assets/stickers/koala.png' },
  { id: 'koori-shiro', file: 'assets/stickers/koori-shiro.png' },
  { id: 'kuma', file: 'assets/stickers/kuma.png' },
  { id: 'kumo', file: 'assets/stickers/kumo.png' },
  { id: 'kuruma', file: 'assets/stickers/kuruma.png' },
  { id: 'macaron', file: 'assets/stickers/macaron.png' },
  { id: 'mahou-stick', file: 'assets/stickers/mahou-stick.png' },
  { id: 'neko', file: 'assets/stickers/neko.png' },
  { id: 'niji', file: 'assets/stickers/niji.png' },
  { id: 'panda', file: 'assets/stickers/panda.png' },
  { id: 'penguin', file: 'assets/stickers/penguin.png' },
  { id: 'pink-shiro', file: 'assets/stickers/pink-shiro.png' },
  { id: 'pudding', file: 'assets/stickers/pudding.png' },
  { id: 'risu', file: 'assets/stickers/risu.png' },
  { id: 'sakura', file: 'assets/stickers/sakura.png' },
  { id: 'taiyou', file: 'assets/stickers/taiyou.png' },
  { id: 'takarabako', file: 'assets/stickers/takarabako.png' },
  { id: 'tiara', file: 'assets/stickers/tiara.png' },
  { id: 'tsuki', file: 'assets/stickers/tsuki.png' },
  { id: 'usagi', file: 'assets/stickers/usagi.png' },
  { id: 'usagi2', file: 'assets/stickers/usagi2.png' },
  { id: 'yuki-kessho', file: 'assets/stickers/yuki-kessho.png' },
  { id: 'zou', file: 'assets/stickers/zou.png' },
  { id: 'yukihime', file: 'assets/stickers/yukihime.png', rare: true },
  { id: 'morihime', file: 'assets/stickers/morihime.png', rare: true },
  { id: 'hanahime', file: 'assets/stickers/hanahime.png', rare: true },
  { id: 'awahime', file: 'assets/stickers/awahime.png', rare: true },
  { id: 'honhime', file: 'assets/stickers/honhime.png', rare: true }
];

// 台紙が1ページ(10種)集まるごとに背景テーマが1つ解放。最後がプリンセスの氷のお城。
export const THEMES = [
  { id: 'sora', file: 'assets/bg/theme-sora.png', unlockAt: 0 },
  { id: 'ohana', file: 'assets/bg/theme-ohana.png', unlockAt: 10 },
  { id: 'umi', file: 'assets/bg/theme-umi.png', unlockAt: 20 },
  { id: 'yoru', file: 'assets/bg/theme-yoru.png', unlockAt: 30 },
  { id: 'koori', file: 'assets/bg/theme-koori.png', unlockAt: 40 }
];

function load() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch (e) {
    raw = null;
  }
  if (!raw || typeof raw !== 'object') raw = {};
  return {
    stickers: Array.isArray(raw.stickers) ? raw.stickers : [],
    playCount: typeof raw.playCount === 'number' ? raw.playCount : 0,
    gamePlayCounts: (raw.gamePlayCounts && typeof raw.gamePlayCounts === 'object') ? raw.gamePlayCounts : {},
    selectedTheme: typeof raw.selectedTheme === 'string' ? raw.selectedTheme : 'sora',
    pickProgress: (raw.pickProgress && typeof raw.pickProgress === 'object') ? raw.pickProgress : {},
    revealedGrowthGames: Array.isArray(raw.revealedGrowthGames) ? raw.revealedGrowthGames : []
  };
}

let data = load();

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  try {
    document.dispatchEvent(new CustomEvent('stickers-changed', { detail: { stickers: data.stickers } }));
  } catch (e) { /* noop */ }
}

export function getData() { return data; }
export function getStickers() { return data.stickers.slice(); }
export function ownsSticker(id) { return data.stickers.indexOf(id) !== -1; }
export function getUniqueCount() { return data.stickers.length; }

export function unlockedThemes() {
  const n = getUniqueCount();
  return THEMES.filter((t) => n >= t.unlockAt);
}

export function isThemeUnlocked(id) {
  return unlockedThemes().some((t) => t.id === id);
}

export function getSelectedTheme() {
  const unlocked = unlockedThemes();
  const found = unlocked.find((t) => t.id === data.selectedTheme);
  return found || unlocked[unlocked.length - 1] || THEMES[0];
}

export function selectTheme(id) {
  if (!isThemeUnlocked(id)) return false;
  data.selectedTheme = id;
  save();
  return true;
}

/**
 * プレイ完了ごとに1枚シールを排出する。
 * 正解数に関わらず必ずもらえる。未収集を優先し、全種コンプ後はランダムに「もういっこ！」。
 * @returns {{ sticker: object, isNew: boolean, newTheme: object|null }}
 */
export function grantSticker() {
  const beforeCount = getUniqueCount();
  const unowned = STICKERS.filter((s) => !ownsSticker(s.id));
  const pool = unowned.length > 0 ? unowned : STICKERS;
  const picked = pool[Math.floor(Math.random() * pool.length)];
  const isNew = !ownsSticker(picked.id);
  if (isNew) data.stickers.push(picked.id);
  data.playCount++;
  save();
  const afterCount = getUniqueCount();
  const newlyUnlocked = THEMES.find((t) => t.unlockAt > beforeCount && t.unlockAt <= afterCount);
  return { sticker: picked, isNew, newTheme: newlyUnlocked || null };
}

export function recordGamePlay(gameId) {
  data.gamePlayCounts[gameId] = (data.gamePlayCounts[gameId] || 0) + 1;
  save();
}

// 本人には難易度の概念を一切見せない「裏側の自動レベル調整」用の進捗記録。
// tasks/遊んで成長する改善計画書.md ちびっこ Phase A 参照。
function ensurePickProgress(setId) {
  if (!data.pickProgress[setId]) data.pickProgress[setId] = { level: 0, seenIds: [] };
  return data.pickProgress[setId];
}

export function getPickLevel(setId) {
  return ensurePickProgress(setId).level;
}

// delta: +1/-1。maxLevelでクランプする。上げ幅は保守的・下げ判定は敏感にという
// 教訓どおり、呼び出し側（PickEngine）が「連続正解2回で+1、連続不正解2回で即-1」を制御する。
export function adjustPickLevel(setId, delta, maxLevel) {
  const p = ensurePickProgress(setId);
  p.level = Math.max(0, Math.min(maxLevel, p.level + delta));
  save();
  return p.level;
}

// 「はじめてできた！」演出のための初回正解判定。setId内でtargetKeyごとに一度だけtrueを返す。
export function isFirstTimeCorrect(setId, targetKey) {
  const p = ensurePickProgress(setId);
  const isFirst = p.seenIds.indexOf(targetKey) === -1;
  if (isFirst) {
    p.seenIds.push(targetKey);
    save();
  }
  return isFirst;
}

// おうちのひとメニューの「せいちょうレポート」用データ。
// できるようになったこと（seenIdsの種類数）をゲームごとに返す。プレイしたことのないゲームは含めない。
export function getGrowthSummary() {
  const sets = Object.keys(data.pickProgress)
    .map((setId) => ({
      setId,
      seenCount: (data.pickProgress[setId].seenIds || []).length,
      level: data.pickProgress[setId].level || 0
    }))
    .filter((s) => s.seenCount > 0);
  return {
    playCount: data.playCount,
    stickerCount: getUniqueCount(),
    stickerTotal: STICKERS.length,
    sets
  };
}

// 「成長したら次のあそびが解放される」の判定条件。しきい値は保守的に設定し、
// 本人がある程度あそびこんでから初めて成立するようにする。
const GROWTH_UNLOCK_PLAY_COUNT = 20;
const GROWTH_UNLOCK_TOTAL_SEEN = 30;

export function isGrowthUnlocked() {
  if (data.playCount >= GROWTH_UNLOCK_PLAY_COUNT) return true;
  const totalSeen = Object.keys(data.pickProgress)
    .reduce((sum, setId) => sum + (data.pickProgress[setId].seenIds || []).length, 0);
  return totalSeen >= GROWTH_UNLOCK_TOTAL_SEEN;
}

export function getPlayCount() { return data.playCount; }

// Phase C1: 解放ゲーム3本の個別解放条件（計画書 tasks/ちびっこキラキラ_バージョンアップ計画書.md 3章）。
// 新しいスキーマ追加はせず、既存の gamePlayCounts / pickProgress だけで判定する。
const UNLOCK_PLAYS = 8;

export function isHiraganaSearchUnlocked() {
  return getPickLevel('number-touch') >= 3 && (data.gamePlayCounts['color-touch'] || 0) >= UNLOCK_PLAYS;
}
export function isOtsukaiUnlocked() {
  return getPickLevel('number-touch') >= 3 && (data.gamePlayCounts['nakama'] || 0) >= UNLOCK_PLAYS;
}
export function isNazorigakiUnlocked() {
  return (data.gamePlayCounts['maze'] || 0) >= UNLOCK_PLAYS;
}

const GROWTH_UNLOCK_MAP = {
  'hiragana-search': isHiraganaSearchUnlocked,
  otsukai: isOtsukaiUnlocked,
  nazorigaki: isNazorigakiUnlocked,
};

export function isGrowthGameUnlocked(gameId) {
  const fn = GROWTH_UNLOCK_MAP[gameId];
  return fn ? fn() : false;
}

// 解放お祝い演出は初回だけ出す。一度見せたらフラグを立てて、以降はハブに通常表示。
export function hasSeenUnlockCelebration(gameId) {
  return (data.revealedGrowthGames || []).indexOf(gameId) !== -1;
}
export function markUnlockCelebrationSeen(gameId) {
  if (data.revealedGrowthGames.indexOf(gameId) === -1) {
    data.revealedGrowthGames.push(gameId);
    save();
  }
}

export function reload() { data = load(); return data; }

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
    selectedTheme: typeof raw.selectedTheme === 'string' ? raw.selectedTheme : 'sora'
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

export function getPlayCount() { return data.playCount; }
export function reload() { data = load(); return data; }

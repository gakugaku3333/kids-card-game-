/*
 * core/store.js — トークン経済モジュール（ESM版）
 *
 * js/store.js と同一の localStorage キー・スキーマを読み書きする。
 * 新規ゲーム（core/shell.js 経由）はこちらを import して使う。
 * 既存ページの js/store.js はそのまま維持（[[project-lessons]] 参照: 段階移行）。
 */
export const STORAGE_KEY = 'katakana_game_data';

const SLOT_OF = { avatar: 'base', badge: 'accessory', special: 'accessory', effect: 'effect' };

export const SHOP_ITEMS = [
  { id: 'badge_gold', name: 'きんのバッジ', icon: '🥇', price: 30, type: 'badge' },
  { id: 'badge_silver', name: 'ぎんのバッジ', icon: '🥈', price: 20, type: 'badge' },
  { id: 'badge_bronze', name: 'どうのバッジ', icon: '🥉', price: 10, type: 'badge' },
  { id: 'avatar_cat', name: 'ねこアバター', icon: '🐱', price: 15, type: 'avatar' },
  { id: 'avatar_rabbit', name: 'うさぎアバター', icon: '🐰', price: 15, type: 'avatar' },
  { id: 'avatar_bear', name: 'くまアバター', icon: '🐻', price: 15, type: 'avatar' },
  { id: 'avatar_unicorn', name: 'ゆにこーん', icon: '🦄', price: 25, type: 'avatar' },
  { id: 'avatar_magic_girl', name: 'まほうしょうじょ', icon: 'assets/images/avatars/avatar_magic_girl.png', price: 30, type: 'avatar' },
  { id: 'avatar_princess', name: 'プリンセス', icon: 'assets/images/avatars/avatar_princess.png', price: 30, type: 'avatar' },
  { id: 'avatar_rabbit_fairy', name: 'うさぎのようせい', icon: 'assets/images/avatars/avatar_rabbit_fairy.png', price: 30, type: 'avatar' },
  { id: 'avatar_kitty_girl', name: 'ねこみみガール', icon: 'assets/images/avatars/avatar_kitty_girl.png', price: 30, type: 'avatar' },
  { id: 'avatar_angel_girl', name: 'てんしちゃん', icon: 'assets/images/avatars/avatar_angel_girl.png', price: 30, type: 'avatar' },
  { id: 'effect_rainbow', name: 'にじエフェクト', icon: '🌈', price: 20, type: 'effect' },
  { id: 'effect_sparkle', name: 'きらきら', icon: '✨', price: 20, type: 'effect' },
  { id: 'effect_heart', name: 'はーと', icon: '💕', price: 15, type: 'effect' },
  { id: 'crown', name: 'おうかん', icon: '👑', price: 50, type: 'special' },
  { id: 'trophy', name: 'トロフィー', icon: '🏆', price: 40, type: 'special' },
  { id: 'game_mole', name: 'もぐらたたき', icon: '🔨', price: 10, type: 'game' },
  { id: 'game_jump', name: 'うさぎジャンプ', icon: '🐰', price: 20, type: 'game' },
  { id: 'game_simon', name: 'ひかるボタン', icon: '🎹', price: 25, type: 'game' },
  { id: 'game_numbers', name: 'すうじタッチ', icon: '🔢', price: 20, type: 'game' },
  { id: 'game_dodge', name: 'よけろ！', icon: '☄️', price: 25, type: 'game' },
  { id: 'game_rps', name: 'じゃんけん', icon: '✌️', price: 15, type: 'game' },
  { id: 'game_balloon', name: 'ふうせんわり', icon: '🎈', price: 15, type: 'game' },
  { id: 'game_catch', name: 'フルーツキャッチ', icon: '🍎', price: 20, type: 'game' },
  { id: 'game_color', name: 'いろあわせ', icon: '🎨', price: 15, type: 'game' },
  { id: 'game_memory', name: 'しんけいすいじゃく', icon: '🃏', price: 25, type: 'game' },
  { id: 'game_click', name: 'クリッククリック', icon: '👆', price: 5, type: 'game' },
  { id: 'game_star', name: 'ほしあつめ', icon: '⭐', price: 18, type: 'game' },
  { id: 'game_bubble', name: 'バブルわり', icon: '🫧', price: 12, type: 'game' },
  { id: 'game_match3', name: 'えあわせ', icon: '🎯', price: 30, type: 'game' },
  { id: 'game_draw', name: 'おえかき', icon: '🖍️', price: 8, type: 'game' }
];

function load() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch (e) {
    raw = null;
  }
  if (!raw || typeof raw !== 'object') raw = {};
  const av = (raw.avatar && typeof raw.avatar === 'object') ? raw.avatar : {};
  return {
    tokens: typeof raw.tokens === 'number' ? raw.tokens : 0,
    totalCorrect: typeof raw.totalCorrect === 'number' ? raw.totalCorrect : 0,
    totalAnswered: typeof raw.totalAnswered === 'number' ? raw.totalAnswered : 0,
    ownedItems: Array.isArray(raw.ownedItems) ? raw.ownedItems : [],
    avatar: {
      base: typeof av.base === 'string' ? av.base : null,
      accessory: typeof av.accessory === 'string' ? av.accessory : null,
      effect: typeof av.effect === 'string' ? av.effect : null
    }
  };
}

let data = load();

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  try {
    document.dispatchEvent(new CustomEvent('tokens-changed', {
      detail: { tokens: data.tokens, ownedItems: data.ownedItems, avatar: data.avatar }
    }));
  } catch (e) { /* noop */ }
}

export function getData() { return data; }
export function getTokens() { return data.tokens; }
export function addTokens(n) { data.tokens += n; save(); return data.tokens; }
export function spendTokens(n) {
  if (data.tokens < n) return false;
  data.tokens -= n; save(); return true;
}
export function getOwned() { return data.ownedItems; }
export function owns(id) { return data.ownedItems.indexOf(id) !== -1; }

export function buy(id) {
  const item = SHOP_ITEMS.find((i) => i.id === id);
  if (!item) return false;
  if (data.tokens >= item.price && !owns(id)) {
    data.tokens -= item.price;
    data.ownedItems.push(id);
    save();
    return item;
  }
  return false;
}

export function recordAnswer(correct) {
  data.totalAnswered++;
  if (correct) data.totalCorrect++;
  save();
}

export function slotOf(id) {
  const item = SHOP_ITEMS.find((i) => i.id === id);
  return item ? (SLOT_OF[item.type] || null) : null;
}

export function equip(slot, id) {
  if (slot !== 'base' && slot !== 'accessory' && slot !== 'effect') return false;
  if (id === null) { data.avatar[slot] = null; save(); return true; }
  if (owns(id) && slotOf(id) === slot) { data.avatar[slot] = id; save(); return true; }
  return false;
}

export function getAvatar() { return data.avatar; }
export function reload() { data = load(); return data; }

export function getIconHtml(icon, altText) {
  if (!icon) return '';
  if (icon.indexOf('/') !== -1 || /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(icon)) {
    return `<img src="${icon}" class="avatar-icon-img" alt="${altText || ''}" />`;
  }
  return icon;
}

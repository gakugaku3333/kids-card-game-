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
    badges: Array.isArray(raw.badges) ? raw.badges : []
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

// 自己ベスト。correctが多いほど良い、という単純な比較（本家Phase Aと同じ設計）。
export function getBestScore(gameId) {
  return data.bestScores[gameId] || null;
}

export function recordScore(gameId, { correct = 0, total = 0, tokens = 0 } = {}) {
  const prev = data.bestScores[gameId];
  const isNewBest = !prev || correct > prev.correct;
  if (isNewBest) {
    data.bestScores[gameId] = { correct, total, tokens };
    save();
  }
  return { isNewBest, best: data.bestScores[gameId] };
}

export function hasBadge(id) { return data.badges.indexOf(id) !== -1; }
export function grantBadge(id) {
  const isNew = !hasBadge(id);
  if (isNew) { data.badges.push(id); save(); }
  return isNew;
}
export function getBadges() { return data.badges.slice(); }

export function reload() { data = load(); return data; }

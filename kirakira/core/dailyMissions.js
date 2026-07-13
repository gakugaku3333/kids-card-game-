/*
 * kirakira/core/dailyMissions.js — デイリーおしごとの共通ロジック
 * core/badges.js と同じ「metric/thresholdをstore状態と突き合わせる」汎用エバリュエータ設計。
 * 未達成でもペナルティなし・遊ぶ順番も強制しない(2.5節の禁句原則に沿い「ミッション」ではなく「おしごと」と呼ぶ)。
 */
import * as Store from './store.js';

const METRIC_FNS = {
  plays: () => Store.getDaily().plays,
  correctSum: () => Store.getDaily().correctSum,
};

let cachedDefs = null;
async function loadDefs() {
  if (cachedDefs) return cachedDefs;
  const base = new URL('../data/daily-missions.json', import.meta.url);
  const res = await fetch(base);
  const json = await res.json();
  cachedDefs = json.missions;
  return cachedDefs;
}

export async function getAllMissionDefs() {
  return loadDefs();
}

// 現在のdaily状態を全おしごと定義と突き合わせ、新規達成分にトークン報酬を付与して返す
export async function evaluateMissions() {
  const defs = await loadDefs();
  const newlyCompleted = [];
  for (const m of defs) {
    if (Store.hasCompletedDailyMission(m.id)) continue;
    const metricFn = METRIC_FNS[m.metric];
    if (!metricFn || metricFn() < m.threshold) continue;
    Store.completeDailyMission(m.id);
    if (m.reward) Store.addTokens(m.reward);
    newlyCompleted.push(m);
  }
  return newlyCompleted;
}

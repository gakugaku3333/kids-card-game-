/*
 * core/sound.js — WebAudioでコード生成する効果音マネージャ（ちびっこひろば版）
 *
 * 既存サイトの core/sound.js を移植し、ほめ演出用の cheer/pop を追加。
 * 音源ファイル不要。iOS Safari はユーザー操作後でないと音が出ないため resume() を最初のタップで呼ぶ。
 */
const MUTE_KEY = 'chibikko_muted';
let ctx = null;

function ensureContext() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function isMuted() {
  return localStorage.getItem(MUTE_KEY) === '1';
}

function setMuted(muted) {
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
}

function tone(freqStart, freqEnd, duration, volume) {
  if (isMuted()) return;
  const c = ensureContext();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freqStart, c.currentTime);
  osc.frequency.exponentialRampToValueAtTime(freqEnd, c.currentTime + duration);
  gain.gain.setValueAtTime(volume, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration);
}

function note(freq, duration, volume, delay) {
  if (isMuted()) return;
  const c = ensureContext();
  if (!c) return;
  const start = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(start);
  osc.stop(start + duration);
}

const EFFECTS = {
  // ドレミの3音を弾ませる「キラッ」としたアルペジオ。単発ピー音より嬉しさが伝わる
  correct: () => {
    note(1046.5, 0.13, 0.17, 0);
    note(1318.5, 0.13, 0.17, 0.06);
    note(1568, 0.22, 0.18, 0.12);
  },
  // ブザー的な下降音ではなく「あれ？もういっかい」という優しい2音にする(失敗を罰しない設計)
  wrong: () => {
    note(392, 0.12, 0.13, 0);
    note(440, 0.16, 0.13, 0.1);
  },
  clear: () => { tone(500, 800, 0.12, 0.15); setTimeout(() => tone(700, 1100, 0.18, 0.15), 120); },
  coin: () => tone(700, 1200, 0.10, 0.14),
  pop: () => tone(900, 300, 0.12, 0.18),
  cheer: () => {
    tone(600, 900, 0.12, 0.16);
    setTimeout(() => tone(800, 1100, 0.12, 0.16), 100);
    setTimeout(() => tone(1000, 1400, 0.16, 0.16), 200);
  }
};

export function resume() { ensureContext(); }

export function play(name) {
  const fn = EFFECTS[name];
  if (fn) fn();
}

export function toggleMute() {
  const next = !isMuted();
  setMuted(next);
  return next;
}

export { isMuted as muted };

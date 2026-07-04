/*
 * core/sound.js — WebAudioでコード生成する効果音マネージャ
 *
 * 音源ファイル不要。localStorage でミュート状態を記憶する。
 * iOS Safari はユーザー操作後でないと音が出ないため、resume() を
 * 最初のタップ/クリックで呼ぶこと（shell.js が自動で行う）。
 */
const MUTE_KEY = 'kids_game_muted';
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

const EFFECTS = {
  correct: () => tone(500, 900, 0.14, 0.16),
  wrong: () => tone(300, 160, 0.22, 0.14),
  clear: () => { tone(500, 800, 0.12, 0.15); setTimeout(() => tone(700, 1100, 0.18, 0.15), 120); },
  coin: () => tone(700, 1200, 0.10, 0.14)
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

/*
 * core/voice.js — speechSynthesis ラッパー（ちびっこひろば版）
 *
 * 文字を読ませない3歳向け設計の要。すべての指示・出題・ほめ言葉は音声で伝える。
 * iOS Safari は無音発話を挟まないと初回タップ後もしゃべらないことがあるため unlock() を用意。
 */
let unlocked = false;
let jaVoice = null;

function pickJaVoice() {
  if (typeof speechSynthesis === 'undefined') return null;
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => v.lang === 'ja-JP') || voices.find((v) => v.lang && v.lang.startsWith('ja')) || null;
}

export function unlock() {
  if (unlocked || typeof speechSynthesis === 'undefined') return;
  unlocked = true;
  const warmup = new SpeechSynthesisUtterance('');
  warmup.volume = 0;
  speechSynthesis.speak(warmup);
  jaVoice = pickJaVoice();
  if (!jaVoice && typeof speechSynthesis.addEventListener === 'function') {
    speechSynthesis.addEventListener('voiceschanged', () => { jaVoice = pickJaVoice(); }, { once: true });
  }
}

/**
 * @param {string} text
 * @param {object} [opts] - { onEnd, interrupt = true }
 */
export function speak(text, opts) {
  if (typeof speechSynthesis === 'undefined') {
    if (opts && opts.onEnd) opts.onEnd();
    return;
  }
  const interrupt = !opts || opts.interrupt !== false;
  if (interrupt) speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ja-JP';
  utter.rate = 0.9;
  utter.pitch = 1.1;
  if (jaVoice) utter.voice = jaVoice;
  if (opts && opts.onEnd) utter.addEventListener('end', opts.onEnd, { once: true });
  speechSynthesis.speak(utter);
}

export function cancel() {
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

const PRAISE = ['やったね！', 'すごい！', 'せいかい！', 'かんぺき！', 'じょうずだね！'];
export function praise() {
  speak(PRAISE[Math.floor(Math.random() * PRAISE.length)]);
}

const ENCOURAGE = ['おしい！', 'もういっかい！', 'だいじょうぶ！'];
export function encourage() {
  speak(ENCOURAGE[Math.floor(Math.random() * ENCOURAGE.length)]);
}

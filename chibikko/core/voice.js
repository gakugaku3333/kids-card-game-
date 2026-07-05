/*
 * core/voice.js — 音声再生モジュール（ちびっこひろば版）
 *
 * 文字を読ませない3歳向け設計の要。すべての指示・出題・ほめ言葉は音声で伝える。
 * 本文はブラウザ標準の speechSynthesis だとカタコトになるため、
 * Gemini TTS(gemini-3.1-flash-tts-preview)で事前生成した音声ファイル(assets/voice/<id>.wav)
 * を data/voice-lines.json のIDで再生する。ファイル未着・読み込み失敗時のみ
 * speechSynthesis にフォールバックする（テキストは voice-lines.json 側に保持）。
 */
import { asset } from './paths.js';

let unlocked = false;
let jaVoice = null;
let linesPromise = null;
const audioCache = new Map();
const queue = [];
let playing = false;

function pickJaVoice() {
  if (typeof speechSynthesis === 'undefined') return null;
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => v.lang === 'ja-JP') || voices.find((v) => v.lang && v.lang.startsWith('ja')) || null;
}

function loadLines() {
  if (!linesPromise) {
    linesPromise = fetch(asset('chibikko/data/voice-lines.json')).then((r) => r.json());
  }
  return linesPromise;
}

export function unlock() {
  if (unlocked) return;
  unlocked = true;
  loadLines();
  if (typeof speechSynthesis === 'undefined') return;
  const warmup = new SpeechSynthesisUtterance('');
  warmup.volume = 0;
  speechSynthesis.speak(warmup);
  jaVoice = pickJaVoice();
  if (!jaVoice && typeof speechSynthesis.addEventListener === 'function') {
    speechSynthesis.addEventListener('voiceschanged', () => { jaVoice = pickJaVoice(); }, { once: true });
  }
}

function fallbackSpeak(text, onEnd) {
  if (typeof speechSynthesis === 'undefined' || !text) {
    if (onEnd) onEnd();
    return;
  }
  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ja-JP';
  utter.rate = 0.9;
  utter.pitch = 1.1;
  if (jaVoice) utter.voice = jaVoice;
  if (onEnd) {
    utter.addEventListener('end', onEnd, { once: true });
    utter.addEventListener('error', onEnd, { once: true });
  }
  speechSynthesis.speak(utter);
}

function getAudio(id) {
  let audio = audioCache.get(id);
  if (!audio) {
    audio = new Audio(asset(`chibikko/assets/voice/${id}.wav`));
    audioCache.set(id, audio);
  }
  return audio;
}

/**
 * data/voice-lines.json のIDで音声を再生する。複数回呼ばれても重ならないよう
 * 内部キューに積んで順番に再生する。
 * @param {string} id
 */
export function speak(id) {
  queue.push(id);
  _playNext();
}

async function _playNext() {
  if (playing || queue.length === 0) return;
  playing = true;
  const id = queue.shift();
  const lines = await loadLines();
  const line = lines[id];
  if (!line) {
    playing = false;
    _playNext();
    return;
  }
  const audio = getAudio(id);
  audio.currentTime = 0;
  const done = () => {
    playing = false;
    _playNext();
  };
  audio.addEventListener('ended', done, { once: true });
  try {
    await audio.play();
  } catch (e) {
    audio.removeEventListener('ended', done);
    fallbackSpeak(line.text, done);
  }
}

const PRAISE_IDS = ['praise1', 'praise2', 'praise3', 'praise4', 'praise5'];
export function praise() {
  speak(PRAISE_IDS[Math.floor(Math.random() * PRAISE_IDS.length)]);
}

const ENCOURAGE_IDS = ['encourage1', 'encourage2', 'encourage3'];
export function encourage() {
  speak(ENCOURAGE_IDS[Math.floor(Math.random() * ENCOURAGE_IDS.length)]);
}

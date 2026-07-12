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
import { muted } from './sound.js';

let unlocked = false;
let jaVoice = null;
let linesPromise = null;
const audioCache = new Map();

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

function fallbackSpeak(text) {
  if (typeof speechSynthesis === 'undefined' || !text) return;
  // speechSynthesisは同時発話できないため直前の発話を打ち切って最新を優先する
  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ja-JP';
  utter.rate = 0.9;
  utter.pitch = 1.1;
  if (jaVoice) utter.voice = jaVoice;
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
 * data/voice-lines.json のIDで音声を即時再生する。
 * 3歳向けはタップへの反応速度が最優先のため、キューに積まず重なりを許容する。
 * 同じIDの連打は頭出しリスタート、別IDは並行再生になる。
 * @param {string} id
 */
export function speak(id) {
  if (muted()) return;
  _play(id);
}

async function _play(id) {
  const lines = await loadLines();
  const line = lines[id];
  if (!line) return;
  const audio = getAudio(id);
  audio.currentTime = 0;
  try {
    await audio.play();
  } catch (e) {
    fallbackSpeak(line.text);
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

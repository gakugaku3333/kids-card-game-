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
let linesCache = null;
const audioCache = new Map();

function pickJaVoice() {
  if (typeof speechSynthesis === 'undefined') return null;
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => v.lang === 'ja-JP') || voices.find((v) => v.lang && v.lang.startsWith('ja')) || null;
}

function loadLines() {
  if (!linesPromise) {
    linesPromise = fetch(asset('chibikko/data/voice-lines.json'))
      .then((r) => r.json())
      .then((json) => { linesCache = json; return json; });
  }
  return linesPromise;
}
// タップ待ちにせず、モジュール読み込み時点で取得を始める（初回タップ時の直列fetchをなくす）。
loadLines();

export function unlock() {
  if (unlocked) return;
  unlocked = true;
  if (typeof speechSynthesis !== 'undefined') {
    const warmup = new SpeechSynthesisUtterance('');
    warmup.volume = 0;
    speechSynthesis.speak(warmup);
    jaVoice = pickJaVoice();
    if (!jaVoice && typeof speechSynthesis.addEventListener === 'function') {
      speechSynthesis.addEventListener('voiceschanged', () => { jaVoice = pickJaVoice(); }, { once: true });
    }
  }
  // <audio> 経路は speechSynthesis と別枠でアンロックが要る（iOS Safari）。
  // 無音のHTMLAudioElementを同期的にplay()しておかないと、後続のspeak()がplay()を拒否されうる。
  const unlockAudio = new Audio();
  unlockAudio.muted = true;
  const p = unlockAudio.play();
  if (p && typeof p.catch === 'function') p.catch(() => {});
}

function fallbackSpeak(text, onEnd) {
  if (typeof speechSynthesis === 'undefined' || !text) {
    if (onEnd) onEnd();
    return;
  }
  // speechSynthesisは同時発話できないため直前の発話を打ち切って最新を優先する
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
    audio.preload = 'auto';
    audioCache.set(id, audio);
  }
  return audio;
}

/**
 * 再生要求より前にWAV取得を始めておく。あいさつ音声などIDが事前に分かっている
 * 場面で呼ぶと、実際のspeak()時点では取得済みになっている。
 * @param {string} id
 */
export function preload(id) {
  getAudio(id).load();
}

/**
 * data/voice-lines.json のIDで音声を即時再生する。
 * 3歳向けはタップへの反応速度が最優先のため、キューに積まず重なりを許容する。
 * 同じIDの連打は頭出しリスタート、別IDは並行再生になる（#33）。
 *
 * voice-lines.jsonが読み込み済みならawaitを一切挟まず同期的にaudio.play()を呼ぶ。
 * iOS Safariはユーザージェスチャのコールスタックが切れると再生を拒否するため、
 * ここでawaitを挟むとホームタップ由来のジェスチャが失効し無音になる（未読込時のみ許容）。
 *
 * 戻り値は再生完了（またはフォールバック発話完了）で解決するPromise。
 * 通常は誰も待たず重ねて鳴らしてよいが、あいさつ→最初の出題のように
 * 順番に聞かせたい特定の箇所だけが利用する（呼び出し側でキュー化はしない）。
 * @param {string} id
 * @returns {Promise<void>}
 */
export function speak(id) {
  if (muted()) return Promise.resolve();
  return linesCache ? _playSync(id) : _playAsync(id);
}

function _playSync(id) {
  const line = linesCache[id];
  if (!line) return Promise.resolve();
  const audio = getAudio(id);
  try {
    audio.currentTime = 0;
  } catch (e) { /* readyState 0 でのInvalidStateErrorは無視してよい（古いWebKit対策） */ }
  return new Promise((resolve) => {
    const onEnded = () => resolve();
    audio.addEventListener('ended', onEnded, { once: true });
    const p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        audio.removeEventListener('ended', onEnded);
        fallbackSpeak(line.text, resolve);
      });
    }
  });
}

async function _playAsync(id) {
  const lines = await loadLines();
  const line = lines[id];
  if (!line) return;
  const audio = getAudio(id);
  try {
    audio.currentTime = 0;
  } catch (e) { /* readyState 0 でのInvalidStateErrorは無視してよい */ }
  return new Promise((resolve) => {
    const onEnded = () => resolve();
    audio.addEventListener('ended', onEnded, { once: true });
    audio.play().catch(() => {
      audio.removeEventListener('ended', onEnded);
      fallbackSpeak(line.text, resolve);
    });
  });
}

const PRAISE_IDS = ['praise1', 'praise2', 'praise3', 'praise4', 'praise5'];
export function praise() {
  speak(PRAISE_IDS[Math.floor(Math.random() * PRAISE_IDS.length)]);
}

const ENCOURAGE_IDS = ['encourage1', 'encourage2', 'encourage3'];
export function encourage() {
  speak(ENCOURAGE_IDS[Math.floor(Math.random() * ENCOURAGE_IDS.length)]);
}

// DevToolsから先読み状況を確認するためのデバッグ用エクスポート（AC3）。
export function _debugReadyState(id) {
  const audio = audioCache.get(id);
  return audio ? audio.readyState : -1;
}

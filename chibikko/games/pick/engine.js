/*
 * games/pick/engine.js — 「音声で出題→N択タップ」共通エンジン
 *
 * いろタッチ・かずタッチなど、同じ形の出題パターンを data/picks/*.json だけで追加できるようにする。
 * カーネルは「選択肢生成」「出題読み上げ」「正誤演出」の3つに収束させている。
 * 失敗が存在しない設計のため、不正解はやり直しを促すだけでボタンは無効化しない。
 */
import { asset } from '../../core/paths.js';

export async function loadPick(setId) {
  const res = await fetch(`../../data/picks/${setId}.json`);
  if (!res.ok) throw new Error(`pick set not found: ${setId}`);
  return res.json();
}

function shuffle(arr) {
  return arr.slice().sort(() => Math.random() - 0.5);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class PickEngine {
  /**
   * @param {object} shell - ToddlerShell
   * @param {object} set - loadPick() で読み込んだJSON
   * @param {object} dom - { stageEl, choicesEl }
   * @param {object} callbacks - { onFinish() }
   */
  constructor(shell, set, dom, callbacks) {
    this.shell = shell;
    this.set = set;
    this.dom = dom;
    this.callbacks = callbacks || {};
    this.choiceCount = set.choiceCount || 3;
    this.total = set.totalQuestions || 5;
    this.index = 0;
  }

  start() {
    this.index = 0;
    this._next();
  }

  _next() {
    if (this.index >= this.total) {
      this.callbacks.onFinish && this.callbacks.onFinish({ correct: this.total, total: this.total });
      return;
    }
    this.index++;
    this.dom.stageEl.innerHTML = '';
    this.dom.choicesEl.innerHTML = '';

    if (this.set.mode === 'count') this._nextCount();
    else this._nextSwatch();
  }

  _nextSwatch() {
    const pool = this.set.pool;
    const target = pool[Math.floor(Math.random() * pool.length)];
    const choices = shuffle(this._buildChoicePool(pool, target, 'id')).slice(0, this.choiceCount);
    if (!choices.some((c) => c.id === target.id)) choices[0] = target;
    const finalChoices = shuffle(choices);

    finalChoices.forEach((choice) => {
      const btn = document.createElement('button');
      btn.className = 'pick-choice pick-swatch';
      btn.style.background = choice.color;
      btn.setAttribute('aria-label', choice.label);
      btn.addEventListener('click', () => this._onAnswer(choice.id === target.id, btn));
      this.dom.choicesEl.appendChild(btn);
    });

    setTimeout(() => this.shell.voice.speak(target.askVoiceId), 300);
  }

  _nextCount() {
    const [min, max] = this.set.countRange || [1, 5];
    const count = randInt(min, max);
    const icons = this.set.fruitIcons;
    const icon = icons[Math.floor(Math.random() * icons.length)];

    const stage = document.createElement('div');
    stage.className = 'pick-count-stage';
    for (let i = 0; i < count; i++) {
      const img = document.createElement('img');
      img.src = asset(icon);
      img.className = 'pick-count-item';
      img.alt = '';
      stage.appendChild(img);
    }
    this.dom.stageEl.appendChild(stage);

    const choiceNums = new Set([count]);
    while (choiceNums.size < this.choiceCount) {
      const n = randInt(Math.max(min, count - 2), Math.min(max, count + 2));
      choiceNums.add(n);
    }
    shuffle([...choiceNums]).forEach((n) => {
      const btn = document.createElement('button');
      btn.className = 'pick-choice pick-number';
      btn.textContent = String(n);
      btn.addEventListener('click', () => this._onAnswer(n === count, btn));
      this.dom.choicesEl.appendChild(btn);
    });

    setTimeout(() => this.shell.voice.speak('count-question'), 300);
  }

  _buildChoicePool(pool, target, key) {
    const others = pool.filter((p) => p[key] !== target[key]);
    return [target, ...shuffle(others).slice(0, this.choiceCount - 1)];
  }

  _onAnswer(isCorrect, btn) {
    if (isCorrect) {
      this.dom.choicesEl.querySelectorAll('.pick-choice').forEach((b) => (b.disabled = true));
      btn.classList.add('pick-correct');
      this.shell.sound.play('correct');
      this.shell.voice.praise();
      setTimeout(() => this._next(), 1300);
    } else {
      btn.classList.add('pick-wrong');
      setTimeout(() => btn.classList.remove('pick-wrong'), 500);
      this.shell.sound.play('wrong');
      this.shell.voice.encourage();
    }
  }
}

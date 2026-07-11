/*
 * games/pick/engine.js — 「音声で出題→N択タップ」共通エンジン
 *
 * いろタッチ・かずタッチなど、同じ形の出題パターンを data/picks/*.json だけで追加できるようにする。
 * カーネルは「選択肢生成」「出題読み上げ」「正誤演出」の3つに収束させている。
 * 失敗が存在しない設計のため、不正解はやり直しを促すだけでボタンは無効化しない。
 */
import { asset } from '../../core/paths.js';
import * as Store from '../../core/store.js';
import * as Confetti from '../../core/confetti.js';

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

    // 裏側の自動レベル調整（本人には一切見せない）。tiersが無いセットは常にlevel 0固定で
    // 今までどおり動く。「もういちど あそぶ」で再生成されるたび、前回の到達レベルから続きになる。
    this.tiers = Array.isArray(set.tiers) ? set.tiers : null;
    this.maxLevel = this.tiers ? this.tiers.length - 1 : 0;
    this.level = this.tiers ? Store.getPickLevel(set.id) : 0;
    this.consecutiveCorrect = 0;
    this.consecutiveWrong = 0;
  }

  // tiers[level]のフィールドでベース設定を上書きした実行時設定を返す
  _config() {
    if (!this.tiers) return this.set;
    return Object.assign({}, this.set, this.tiers[this.level]);
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
    this.choiceCount = this._config().choiceCount || this.set.choiceCount || 3;
    this.dom.stageEl.innerHTML = '';
    this.dom.choicesEl.innerHTML = '';

    if (this.set.mode === 'count') this._nextCount();
    else if (this.set.mode === 'category') this._nextCategory();
    else if (this.set.mode === 'emotion') this._nextEmotion();
    else if (this.set.mode === 'compare') this._nextCompare();
    else if (this.set.mode === 'letter') this._nextLetter();
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
      btn.addEventListener('click', () => this._onAnswer(choice.id === target.id, btn, target.id));
      this.dom.choicesEl.appendChild(btn);
    });

    setTimeout(() => this.shell.voice.speak(target.askVoiceId), 300);
  }

  _nextCount() {
    const [min, max] = this._config().countRange || [1, 5];
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
      btn.addEventListener('click', () => this._onAnswer(n === count, btn, String(count)));
      this.dom.choicesEl.appendChild(btn);
    });

    setTimeout(() => this.shell.voice.speak('count-question'), 300);
  }

  _nextCategory() {
    const categories = this.set.categories;
    const category = categories[Math.floor(Math.random() * categories.length)];
    const inCategory = this.set.pool.filter((p) => p.category === category.id);
    const outCategory = this.set.pool.filter((p) => p.category !== category.id);
    const target = inCategory[Math.floor(Math.random() * inCategory.length)];
    const distractors = shuffle(outCategory).slice(0, this.choiceCount - 1);
    const choices = shuffle([target, ...distractors]);

    choices.forEach((choice) => {
      const btn = document.createElement('button');
      btn.className = 'pick-choice pick-image';
      btn.innerHTML = `<img src="${asset(choice.file)}" alt="${choice.id}" />`;
      btn.addEventListener('click', () => this._onAnswer(choice.category === category.id, btn, target.id));
      this.dom.choicesEl.appendChild(btn);
    });

    setTimeout(() => this.shell.voice.speak(category.askVoiceId), 300);
  }

  _nextEmotion() {
    const pool = this.set.pool;
    const target = pool[Math.floor(Math.random() * pool.length)];
    const distractors = shuffle(pool.filter((p) => p.id !== target.id)).slice(0, this.choiceCount - 1);
    const choices = shuffle([target, ...distractors]);

    const scene = document.createElement('img');
    scene.src = asset(target.scene);
    scene.className = 'pick-emotion-scene';
    scene.alt = target.id;
    this.dom.stageEl.appendChild(scene);

    choices.forEach((choice) => {
      const btn = document.createElement('button');
      btn.className = 'pick-choice pick-image';
      btn.innerHTML = `<img src="${asset(choice.face)}" alt="${choice.id}" />`;
      btn.addEventListener('click', () => this._onAnswer(choice.id === target.id, btn, target.id));
      this.dom.choicesEl.appendChild(btn);
    });

    setTimeout(() => this.shell.voice.speak(this.set.askVoiceId), 300);
  }

  _nextCompare() {
    const type = this.set.types[Math.floor(Math.random() * this.set.types.length)];
    const [a, b] = this._buildComparePair(type.id);
    const biggerIsA = a.value > b.value;

    [a, b].forEach((item, idx) => {
      const btn = document.createElement('button');
      btn.className = 'pick-choice pick-compare';
      btn.innerHTML = item.svg;
      btn.addEventListener('click', () => this._onAnswer((idx === 0) === biggerIsA, btn, type.id));
      this.dom.choicesEl.appendChild(btn);
    });

    setTimeout(() => this.shell.voice.speak(type.askVoiceId), 300);
  }

  _buildComparePair(type) {
    const lo = randInt(1, 3);
    const hi = randInt(lo + 2, lo + 5);
    const [small, big] = shuffle([lo, hi]);
    return [small, big].map((v) => ({ value: v, svg: this._compareSvg(type, v) }));
  }

  _compareSvg(type, v) {
    if (type === 'size') {
      const r = 16 + v * 8;
      return `<svg viewBox="0 0 160 160" width="140" height="140"><circle cx="80" cy="80" r="${r}" fill="#ff9a3d"/></svg>`;
    }
    if (type === 'length') {
      const w = 20 + v * 20;
      return `<svg viewBox="0 0 160 80" width="140" height="70"><rect x="10" y="25" width="${w}" height="30" rx="14" fill="#4da3ff"/></svg>`;
    }
    if (type === 'height') {
      const h = 20 + v * 18;
      return `<svg viewBox="0 0 80 160" width="70" height="140"><rect x="20" y="${140 - h}" width="40" height="${h}" rx="14" fill="#5cd65c"/></svg>`;
    }
    // count
    const dots = Array.from({ length: v }, (_, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      return `<circle cx="${30 + col * 45}" cy="${30 + row * 45}" r="16" fill="#ff8fc7"/>`;
    }).join('');
    return `<svg viewBox="0 0 160 160" width="140" height="140">${dots}</svg>`;
  }

  // 「『あ』はどれかな？」— 文字を読ませるのではなく、音とかたちのペアを探す遊び（3歳→4歳の橋）。
  _nextLetter() {
    const pool = this.set.pool;
    const target = pool[Math.floor(Math.random() * pool.length)];
    const choices = shuffle(this._buildChoicePool(pool, target, 'id')).slice(0, this.choiceCount);
    if (!choices.some((c) => c.id === target.id)) choices[0] = target;
    const finalChoices = shuffle(choices);

    finalChoices.forEach((choice) => {
      const btn = document.createElement('button');
      btn.className = 'pick-choice pick-letter';
      btn.textContent = choice.char;
      btn.setAttribute('aria-label', choice.label);
      btn.addEventListener('click', () => this._onAnswer(choice.id === target.id, btn, target.id));
      this.dom.choicesEl.appendChild(btn);
    });

    setTimeout(() => this.shell.voice.speak(target.askVoiceId), 300);
  }

  _buildChoicePool(pool, target, key) {
    const others = pool.filter((p) => p[key] !== target[key]);
    return [target, ...shuffle(others).slice(0, this.choiceCount - 1)];
  }

  _onAnswer(isCorrect, btn, targetKey) {
    if (isCorrect) {
      this.dom.choicesEl.querySelectorAll('.pick-choice').forEach((b) => (b.disabled = true));
      btn.classList.add('pick-correct');

      this.consecutiveCorrect++;
      this.consecutiveWrong = 0;
      if (this.tiers && this.consecutiveCorrect >= 2 && this.level < this.maxLevel) {
        this.level = Store.adjustPickLevel(this.set.id, 1, this.maxLevel);
        this.consecutiveCorrect = 0;
      }

      const isFirstTime = targetKey != null && Store.isFirstTimeCorrect(this.set.id, targetKey);
      if (isFirstTime) {
        // 「はじめてできた！」— 通常よりちょっと豪華な演出（新規アセット不要でキラキラ量とサウンドだけ強める）
        Confetti.burst(14);
        this.shell.sound.play('clear');
      } else {
        this.shell.sound.play('correct');
      }
      this.shell.voice.praise();
      setTimeout(() => this._next(), 1300);
    } else {
      btn.classList.add('pick-wrong');
      setTimeout(() => btn.classList.remove('pick-wrong'), 500);
      this.shell.sound.play('wrong');
      this.shell.voice.encourage();

      this.consecutiveWrong++;
      this.consecutiveCorrect = 0;
      if (this.tiers && this.consecutiveWrong >= 2 && this.level > 0) {
        this.level = Store.adjustPickLevel(this.set.id, -1, this.maxLevel);
        this.consecutiveWrong = 0;
      }
    }
  }
}

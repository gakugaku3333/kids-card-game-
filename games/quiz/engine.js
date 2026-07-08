/*
 * games/quiz/engine.js — データ駆動クイズエンジン
 *
 * data/quizzes/*.json (type: "choice" または "math") を読み込んで
 * 出題・採点・トークン付与・誤答ログ(FireLog)・復習モードを担う。
 * 新しい学習コンテンツを増やすときは JSON を1個書くだけでよい。
 */
import * as FireLog from '../../core/firelog.js';
import * as Store from '../../core/store.js';

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  return arr.slice().sort(() => Math.random() - 0.5);
}

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

// 算数の問題生成カーネル。JSON の levels[].kind で選択される。
// vars: text以外の生の数値/文字列を保持し、依頼文テンプレート（{num1}等のプレースホルダ差し込み）に使う。
export const GENERATORS = {
  sum(level) {
    const num1 = randInt(level.num1Range[0], level.num1Range[1]);
    const num2 = randInt(level.num2Range[0], level.num2Range[1]);
    return { text: `${num1} + ${num2}`, answer: num1 + num2, vars: { num1, num2 } };
  },
  diff(level) {
    const num1 = randInt(level.num1Range[0], level.num1Range[1]);
    const num2 = level.num2LtNum1 ? randInt(0, num1 - 1) : randInt(level.num2Range[0], level.num2Range[1]);
    return { text: `${num1} - ${num2}`, answer: num1 - num2, vars: { num1, num2 } };
  },
  product(level) {
    const num1 = randInt(level.num1Range[0], level.num1Range[1]);
    const num2 = randInt(level.num2Range[0], level.num2Range[1]);
    return { text: `${num1} × ${num2}`, answer: num1 * num2, vars: { num1, num2 } };
  },
  quotientExact(level) {
    const num2 = randInt(level.divisorRange[0], level.divisorRange[1]);
    const answer = randInt(level.quotientRange[0], level.quotientRange[1]);
    const num1 = num2 * answer;
    return { text: `${num1} ÷ ${num2}`, answer, vars: { num1, num2 } };
  },
  quotientRemainder(level) {
    const num2 = randInt(level.divisorRange[0], level.divisorRange[1]);
    const quotient = randInt(level.quotientRange[0], level.quotientRange[1]);
    const remainder = randInt(1, num2 - 1);
    const num1 = num2 * quotient + remainder;
    return { text: `${num1} ÷ ${num2} (あまりはいくつ？)`, answer: remainder, vars: { num1, num2, quotient, remainder } };
  },
  // 小数の加減（小4/小5）。誤差を避けるため整数(10倍値)で計算してから戻す。
  decimal(level) {
    const step = level.decimalStep || 0.1;
    const scale = Math.round(1 / step);
    const n1 = randInt(level.num1Range[0], level.num1Range[1]);
    const n2 = randInt(level.num2Range[0], level.num2Range[1]);
    const op = level.op === 'sub' ? 'sub' : 'add';
    const raw1 = op === 'sub' && n2 > n1 ? n2 : n1;
    const raw2 = op === 'sub' && n2 > n1 ? n1 : n2;
    const num1 = Math.round(raw1 * step * scale) / scale;
    const num2 = Math.round(raw2 * step * scale) / scale;
    const answer = op === 'add'
      ? Math.round((raw1 + raw2) * step * 100) / 100
      : Math.round((raw1 - raw2) * step * 100) / 100;
    const symbol = op === 'add' ? '+' : '-';
    return { text: `${num1} ${symbol} ${num2}`, answer, vars: { num1, num2 } };
  },
  // 分数の加減（小4: 同分母 / 小5: 異分母→通分）。答えは "3/4" 形式の文字列。
  // 帯分数(答えが1以上)を避け、真分数の和になる組み合わせが見つかるまで作り直す。
  fraction(level) {
    const denomPool = (level.denomPool || [3, 4, 5, 6, 8, 10]).filter((d) => d >= 3);
    let d1, d2, a, b, commonDenom, numerA, numerB, sumNumer;
    for (let attempt = 0; attempt < 30; attempt++) {
      d1 = denomPool[randInt(0, denomPool.length - 1)];
      d2 = level.sameDenominator ? d1 : denomPool[randInt(0, denomPool.length - 1)];
      commonDenom = level.sameDenominator ? d1 : (d1 * d2) / gcd(d1, d2);
      a = randInt(1, d1 - 1);
      b = randInt(1, d2 - 1);
      numerA = (commonDenom / d1) * a;
      numerB = (commonDenom / d2) * b;
      sumNumer = numerA + numerB;
      if (sumNumer < commonDenom) break;
    }
    if (sumNumer >= commonDenom) {
      d1 = d2 = commonDenom = 4;
      a = 1; b = 1; numerA = 1; numerB = 1; sumNumer = 2;
    }
    const g = gcd(sumNumer, commonDenom) || 1;
    const answerNumer = sumNumer / g;
    const answerDenom = commonDenom / g;
    const answerText = `${answerNumer}/${answerDenom}`;
    const wrongChoices = new Set([answerText]);
    const wrongCandidates = [
      `${sumNumer}/${commonDenom}`,
      `${answerNumer + 1}/${answerDenom}`,
      `${Math.max(1, sumNumer - 1)}/${commonDenom}`,
      `${answerNumer}/${answerDenom + 1}`
    ];
    for (const c of wrongCandidates) {
      if (wrongChoices.size >= 4) break;
      wrongChoices.add(c);
    }
    return {
      text: `${a}/${d1} + ${b}/${d2}`,
      answer: answerText,
      choices: shuffle(Array.from(wrongChoices)),
      vars: { num1: `${a}/${d1}`, num2: `${b}/${d2}` }
    };
  },
  // 割合（%引き後の金額 / 小5）
  ratio(level) {
    const price = randInt(level.priceRange[0] / 10, level.priceRange[1] / 10) * 10;
    const ratePool = level.ratePool || [10, 20, 30, 50];
    const rate = ratePool[randInt(0, ratePool.length - 1)];
    const discounted = Math.round(price * (100 - rate) / 100);
    return { text: `${price}円の${rate}%引き`, answer: discounted, vars: { num1: price, num2: rate } };
  },
  // 平均（小5）。割り切れる組み合わせだけ出題する。
  average(level) {
    const count = randInt(level.countRange[0], level.countRange[1]);
    const avg = randInt(level.avgRange[0], level.avgRange[1]);
    const total = avg * count;
    const nums = [];
    let remaining = total;
    for (let i = 0; i < count - 1; i++) {
      const maxSpread = Math.min(remaining, avg + 5);
      const v = randInt(Math.max(0, avg - 5), maxSpread);
      nums.push(v);
      remaining -= v;
    }
    nums.push(remaining);
    return { text: `${nums.join('、')} の へいきん`, answer: avg, vars: { num1: nums.join('、'), num2: count } };
  }
};

// たしざんレベル1のみ「答え10以下になる組み合わせ」を全て出題する特別な出題キュー
function buildSumLe10Preset() {
  const list = [];
  for (let a = 1; a <= 9; a++) {
    for (let b = 1; a + b <= 10; b++) list.push({ text: `${a} + ${b}`, answer: a + b });
  }
  return shuffle(list);
}

export async function loadQuiz(setId) {
  const res = await fetch(`../../data/quizzes/${setId}.json`);
  if (!res.ok) throw new Error(`quiz not found: ${setId}`);
  return res.json();
}

export class QuizEngine {
  /**
   * @param {object} shell - GameShell インスタンス
   * @param {object} quiz - loadQuiz() で読み込んだ JSON
   * @param {object} dom - { questionEl, promptEl, choicesEl, feedbackEl, statCorrectEl, statNumEl, statTotalEl }
   * @param {object} callbacks - { onFinish(), onReviewOffer(count) }
   */
  constructor(shell, quiz, dom, callbacks) {
    this.shell = shell;
    this.quiz = quiz;
    this.dom = dom;
    this.callbacks = callbacks || {};
    this.choiceCount = quiz.choiceCount || 4;
    this.perCorrect = (quiz.reward && quiz.reward.perCorrect) || 2;
    this.reviewRewardMultiplier = (quiz.reward && quiz.reward.reviewMultiplier) || 2;
    this.comboBonusEvery = 5;
    this.comboBonusTokens = 3;
    this.correct = 0;
    this.tokens = 0;
    this.combo = 0;
    this.sessionWrong = [];
  }

  get gameKey() {
    return this.quiz.id;
  }

  startLevel(levelIndex) {
    this.mode = 'normal';
    this.levelIndex = levelIndex || 0;
    this.remainingPool = this.quiz.type === 'choice' ? this.quiz.questions.slice() : null;
    const level = this.quiz.type === 'math' ? this.quiz.levels[this.levelIndex] : null;
    this.presetQueue = level && level.preset === 'sumLe10' ? buildSumLe10Preset() : null;
    this.total = this.presetQueue ? this.presetQueue.length : this.quiz.totalQuestions || 10;
    this.index = 0;
    this.correct = 0;
    this.tokens = 0;
    this.combo = 0;
    this.sessionWrong = [];
    this._advance();
  }

  startReview(items) {
    this.mode = 'review';
    this.queue = items.slice();
    this.total = this.queue.length;
    this.index = 0;
    this.correct = 0;
    this.tokens = 0;
    this.combo = 0;
    this._advance();
  }

  _choiceRange() {
    if (this.mode === 'review') return (this.quiz.levels && this.quiz.levels[0] && this.quiz.levels[0].choiceRange) || 10;
    return this.quiz.levels[this.levelIndex].choiceRange || 10;
  }

  _nextProblem() {
    if (this.mode === 'review') return this.queue.shift();
    if (this.quiz.type === 'choice') {
      if (this.remainingPool.length === 0) this.remainingPool = this.quiz.questions.slice();
      const idx = Math.floor(Math.random() * this.remainingPool.length);
      const q = this.remainingPool.splice(idx, 1)[0];
      return { text: q.q, answer: q.a };
    }
    if (this.presetQueue && this.presetQueue.length > 0) return this.presetQueue.shift();
    const level = this.quiz.levels[this.levelIndex];
    return GENERATORS[level.kind](level);
  }

  _buildChoices(problem) {
    if (problem.choices) return shuffle(problem.choices);
    const choices = [problem.answer];
    if (this.quiz.type === 'choice') {
      const pool = this.quiz.questions.map((q) => q.a);
      while (choices.length < this.choiceCount) {
        const c = pool[Math.floor(Math.random() * pool.length)];
        if (!choices.includes(c)) choices.push(c);
      }
      return shuffle(choices);
    }
    const range = this._choiceRange();
    while (choices.length < this.choiceCount) {
      const offset = Math.floor(Math.random() * range) - Math.floor(range / 2);
      const wrong = problem.answer + offset;
      if (wrong !== problem.answer && wrong >= 0 && !choices.includes(wrong)) choices.push(wrong);
    }
    return shuffle(choices);
  }

  // level.template があれば依頼文（例:「クッキーが{num1}まい…」）にvarsを差し込んで表示する。
  _formatText(problem) {
    const level = this.mode !== 'review' && this.quiz.type === 'math' ? this.quiz.levels[this.levelIndex] : null;
    if (!level || !level.template || !problem.vars) return problem.text;
    return level.template.replace(/\{(\w+)\}/g, (m, key) => (key in problem.vars ? problem.vars[key] : m));
  }

  _advance() {
    if (this.index >= this.total) {
      this._finish();
      return;
    }
    this.index++;
    this.current = this._nextProblem();
    this.dom.statNumEl.textContent = String(this.index);
    this.dom.statTotalEl.textContent = String(this.total);
    this.dom.statCorrectEl.textContent = String(this.correct);
    this.dom.promptEl.textContent = this.mode === 'review' ? 'リベンジ：こたえは？' : (this.quiz.type === 'choice' ? 'これはなんてよむ？' : 'こたえは？');
    this.dom.questionEl.textContent = this._formatText(this.current);
    this.dom.feedbackEl.textContent = '';
    this.dom.feedbackEl.className = 'feedback';

    const choices = this._buildChoices(this.current);
    this.dom.choicesEl.innerHTML = '';
    choices.forEach((choice) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = String(choice);
      btn.addEventListener('click', () => this._onAnswer(choice, btn));
      this.dom.choicesEl.appendChild(btn);
    });
  }

  _onAnswer(selected, btn) {
    const isCorrect = selected === this.current.answer;
    Store.recordAnswer(isCorrect);
    if (isCorrect) {
      this.dom.choicesEl.querySelectorAll('.choice-btn').forEach((b) => (b.disabled = true));
      btn.classList.add('correct');
      this.correct++;
      this.combo++;

      const baseReward = this.mode === 'review' ? this.perCorrect * this.reviewRewardMultiplier : this.perCorrect;
      let reward = baseReward;
      const isComboBonus = this.combo >= 2 && this.combo % this.comboBonusEvery === 0;
      if (isComboBonus) reward += this.comboBonusTokens;
      this.tokens += reward;

      const isNewCard = this.quiz.collectCards ? Store.grantKanaCard(this.current.text) : false;

      if (isComboBonus) {
        this.dom.feedbackEl.textContent = `🌟 ${this.combo}れんぞくせいかい！ボーナス +${this.comboBonusTokens}⭐`;
        this.shell.sound.play('coin');
      } else if (isNewCard) {
        this.dom.feedbackEl.textContent = `🎴 あたらしい カードを ゲット！「${this.current.text}」`;
        this.shell.sound.play('coin');
      } else if (this.combo >= 2) {
        this.dom.feedbackEl.textContent = `🎉 せいかい！${this.combo}れんぞく！`;
        this.shell.sound.play('correct');
      } else {
        this.dom.feedbackEl.textContent = '🎉 せいかい！すごい！';
        this.shell.sound.play('correct');
      }
      this.dom.feedbackEl.className = 'feedback correct';
      this.dom.statCorrectEl.textContent = String(this.correct);

      if (this.mode === 'review') {
        FireLog.markReviewed(this.gameKey, this.current.text);
      }

      setTimeout(() => this._advance(), 1200);
    } else {
      btn.classList.add('wrong');
      btn.disabled = true;
      this.combo = 0;
      this.dom.feedbackEl.textContent = '😢 ちがうよ！もういちど！';
      this.dom.feedbackEl.className = 'feedback wrong';
      this.shell.sound.play('wrong');

      if (this.mode !== 'review') {
        const already = this.sessionWrong.some((p) => p.text === this.current.text);
        if (!already) {
          this.sessionWrong.push(this.current);
          FireLog.logWrong(this.gameKey, this.current.text, String(this.current.answer));
        }
      }
    }
  }

  _finish() {
    if (this.mode === 'normal' && this.sessionWrong.length > 0) {
      this.callbacks.onReviewOffer && this.callbacks.onReviewOffer(this.sessionWrong.length, this.sessionWrong);
      return;
    }
    this.callbacks.onFinish && this.callbacks.onFinish({ correct: this.correct, total: this.total, tokens: this.tokens });
  }
}

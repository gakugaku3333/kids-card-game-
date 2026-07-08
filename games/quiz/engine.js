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

// 算数の問題生成カーネル。JSON の levels[].kind で選択される。
const GENERATORS = {
  sum(level) {
    const num1 = randInt(level.num1Range[0], level.num1Range[1]);
    const num2 = randInt(level.num2Range[0], level.num2Range[1]);
    return { text: `${num1} + ${num2}`, answer: num1 + num2 };
  },
  diff(level) {
    const num1 = randInt(level.num1Range[0], level.num1Range[1]);
    const num2 = level.num2LtNum1 ? randInt(0, num1 - 1) : randInt(level.num2Range[0], level.num2Range[1]);
    return { text: `${num1} - ${num2}`, answer: num1 - num2 };
  },
  product(level) {
    const num1 = randInt(level.num1Range[0], level.num1Range[1]);
    const num2 = randInt(level.num2Range[0], level.num2Range[1]);
    return { text: `${num1} × ${num2}`, answer: num1 * num2 };
  },
  quotientExact(level) {
    const num2 = randInt(level.divisorRange[0], level.divisorRange[1]);
    const answer = randInt(level.quotientRange[0], level.quotientRange[1]);
    const num1 = num2 * answer;
    return { text: `${num1} ÷ ${num2}`, answer };
  },
  quotientRemainder(level) {
    const num2 = randInt(level.divisorRange[0], level.divisorRange[1]);
    const quotient = randInt(level.quotientRange[0], level.quotientRange[1]);
    const remainder = randInt(1, num2 - 1);
    const num1 = num2 * quotient + remainder;
    return { text: `${num1} ÷ ${num2} (あまりはいくつ？)`, answer: remainder };
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
    this.dom.questionEl.textContent = this.current.text;
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

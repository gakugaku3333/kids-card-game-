/*
 * kirakira/games/quiz/engine.js — KiraQuizEngine（10歳向けクエスト出題エンジン）
 *
 * 本家 games/quiz/engine.js と同じ出題・採点・コンボ・リベンジロジックを持つが、
 * トークン経済/誤答ログは kirakira 独自モジュールを使う（[[project-lessons]]:
 * サイト間でlocalStorageキーは共有しない）。かたかなカード図鑑のような本家固有の
 * 収集ロジックは持たず、代わりに正解時に onCorrect コールバックを呼ぶだけにして、
 * アイテム解放などの「クエスト」演出は呼び出し側(core/questSkin.js)に委ねる。
 * 出題カーネル(GENERATORS)は本家 games/quiz/engine.js のものをそのまま再利用する。
 */
import * as FireLog from '../../core/firelog.js';
import * as Store from '../../core/store.js';
import { GENERATORS } from '../../../games/quiz/engine.js';

function shuffle(arr) {
  return arr.slice().sort(() => Math.random() - 0.5);
}

function buildSumLe10Preset() {
  const list = [];
  for (let a = 1; a <= 9; a++) {
    for (let b = 1; a + b <= 10; b++) list.push({ text: `${a} + ${b}`, answer: a + b, vars: { num1: a, num2: b } });
  }
  return shuffle(list);
}

export async function loadQuiz(setId) {
  const res = await fetch(`../../data/quizzes/${setId}.json`);
  if (!res.ok) throw new Error(`quiz not found: ${setId}`);
  return res.json();
}

export class KiraQuizEngine {
  /**
   * @param {object} shell - KiraShell インスタンス
   * @param {object} quiz - loadQuiz() で読み込んだ JSON
   * @param {object} dom - { questionEl, promptEl, choicesEl, feedbackEl, statCorrectEl, statNumEl, statTotalEl }
   * @param {object} callbacks - { onFinish(), onReviewOffer(count, items), onCorrect(problem, isComboBonus) }
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
    this.dom.promptEl.textContent = this.mode === 'review' ? '🔥 リベンジ：こたえは？' : (this.quiz.type === 'choice' ? 'これはなに？' : 'こたえは？');
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

      if (isComboBonus) {
        this.dom.feedbackEl.textContent = `🌟 ${this.combo}れんぞく せいかい！ボーナス +${this.comboBonusTokens}🌟`;
        this.shell.sound.play('coin');
      } else if (this.combo >= 2) {
        this.dom.feedbackEl.textContent = `✨ せいかい！${this.combo}れんぞく！`;
        this.shell.sound.play('correct');
      } else {
        this.dom.feedbackEl.textContent = '✨ せいかい！やったね！';
        this.shell.sound.play('correct');
      }
      this.dom.feedbackEl.className = 'feedback correct';
      this.dom.statCorrectEl.textContent = String(this.correct);

      this.callbacks.onCorrect && this.callbacks.onCorrect(this.current, isComboBonus);

      if (this.mode === 'review') {
        FireLog.markReviewed(this.gameKey, this.current.text);
      }

      setTimeout(() => this._advance(), 1200);
    } else {
      btn.classList.add('wrong');
      btn.disabled = true;
      this.combo = 0;
      this.dom.feedbackEl.textContent = '💦 おしい！もういちど！';
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

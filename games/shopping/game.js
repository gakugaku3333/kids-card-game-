import { GameShell } from '../../core/shell.js';

const shell = new GameShell({ gameId: 'shopping', title: 'おかいものやさん 🛒' });

const LEVELS = {
  1: { itemCount: 2, maxTotal: 50, coins: [10], change: false, roundOnly: true },
  2: { itemCount: 2, maxTotal: 100, coins: [50, 10], change: true, roundOnly: true },
  3: { itemCount: 3, maxTotal: 200, coins: [100, 50, 10, 5, 1], change: true, roundOnly: false }
};

const COIN_STYLE = {
  1: { fill: '#d7d7d7', stroke: '#aaaaaa', hole: false },
  5: { fill: '#e6c14a', stroke: '#b89a2e', hole: true },
  10: { fill: '#c98a3a', stroke: '#8a5a1e', hole: false },
  50: { fill: '#cfd8dc', stroke: '#8fa0a8', hole: true },
  100: { fill: '#dfe3e6', stroke: '#9aa3a8', hole: false }
};

function coinSvg(value) {
  const s = COIN_STYLE[value];
  const hole = s.hole ? '<circle cx="30" cy="30" r="8" fill="#fffdf7"/>' : '';
  return `<svg viewBox="0 0 60 60" width="52" height="52">
    <circle cx="30" cy="30" r="27" fill="${s.fill}" stroke="${s.stroke}" stroke-width="3"/>
    ${hole}
    <text x="30" y="35" text-anchor="middle" font-size="14" font-weight="900" fill="#5c4c51" font-family="sans-serif">${value}</text>
  </svg>`;
}

let items = [];
let level = 1;
let errandIndex = 0; // 0,1,2 の3回で1プレイ
let tokensEarned = 0;
let session = null; // 現在のおつかいの状態

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickErrandItems() {
  const conf = LEVELS[level];
  const pool = conf.roundOnly ? items.filter((i) => i.price % 10 === 0) : items;
  for (let attempt = 0; attempt < 30; attempt++) {
    const picked = shuffle(pool).slice(0, conf.itemCount);
    const total = picked.reduce((s, i) => s + i.price, 0);
    if (total <= conf.maxTotal) return picked;
  }
  // 保険: それでも見つからなければ安い順にconf.itemCount個
  return pool.slice().sort((a, b) => a.price - b.price).slice(0, conf.itemCount);
}

function el(id) { return document.getElementById(id); }

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  el(id).classList.add('active');
}

/* ===================== ステージA: あわせていくら？ ===================== */
function startErrand() {
  const conf = LEVELS[level];
  const picked = pickErrandItems();
  const total = picked.reduce((s, i) => s + i.price, 0);
  session = { picked, total, cart: [], addAnswer: '', level };

  el('errand-index').textContent = errandIndex + 1;
  el('memo-list').textContent = picked.map((i) => `${i.emoji}${i.name}`).join(' と ');

  const shelfItems = shuffle([...picked, ...shuffle(items.filter((i) => !picked.includes(i))).slice(0, 3)]);
  const shelf = el('shelf');
  shelf.innerHTML = '';
  shelfItems.forEach((item) => {
    const btn = document.createElement('button');
    btn.className = 'shelf-item';
    btn.innerHTML = `<div class="shelf-emoji">${item.emoji}</div><div class="shelf-name">${item.name}</div><div class="shelf-price">${item.price}えん</div>`;
    btn.addEventListener('click', () => onShelfTap(item, btn));
    shelf.appendChild(btn);
  });

  el('cart-list').textContent = '';
  el('add-expr').textContent = '';
  el('add-input').value = '';
  el('add-feedback').textContent = '';
  showScreen('screen-stage-a');
}

function onShelfTap(item, btn) {
  if (session.cart.includes(item)) return;
  const needed = session.picked;
  if (!needed.includes(item)) {
    // メモにない品：やさしく教えて弾く（誤答としてはログしない＝棚タップのやり直し）
    el('add-feedback').textContent = 'それは おつかいメモに ないよ！';
    el('add-feedback').className = 'feedback ng';
    return;
  }
  session.cart.push(item);
  btn.disabled = true;
  btn.classList.add('picked');
  el('cart-list').textContent = session.cart.map((i) => `${i.emoji}${i.name}(${i.price}えん)`).join(' + ');

  if (session.cart.length === session.picked.length) {
    const expr = session.cart.map((i) => i.price).join(' + ');
    el('add-expr').textContent = `${expr} = ？`;
    el('add-keypad').style.display = '';
    el('add-input').focus();
  }
}

function onAddSubmit() {
  const val = Number(el('add-input').value);
  if (!val && val !== 0) return;
  if (val === session.total) {
    el('add-feedback').textContent = 'せいかい！ 🎉';
    el('add-feedback').className = 'feedback ok';
    shell.sound.play('correct');
    setTimeout(startStageB, 700);
  } else {
    el('add-feedback').textContent = 'もういちど けいさんしてみよう！';
    el('add-feedback').className = 'feedback ng';
    shell.sound.play('wrong');
    shell.fireLog.logWrong('shopping-add', session.picked.map((i) => i.price).join('+'), String(session.total));
  }
}

/* ===================== ステージB: おかねをはらおう ===================== */
function startStageB() {
  const conf = LEVELS[level];
  el('bill-amount').textContent = session.total;
  session.tray = [];

  const wallet = el('wallet');
  wallet.innerHTML = '';
  // 各硬貨を十分な枚数用意（多め）
  conf.coins.forEach((value) => {
    const count = value <= 10 ? 6 : 3;
    for (let i = 0; i < count; i++) {
      const coin = document.createElement('button');
      coin.className = 'coin-btn';
      coin.innerHTML = coinSvg(value);
      coin.dataset.value = value;
      coin.addEventListener('click', () => moveToTray(coin, value));
      wallet.appendChild(coin);
    }
  });

  el('tray').innerHTML = '';
  el('tray-total').textContent = '0';
  el('pay-feedback').textContent = '';
  document.getElementById('btn-pay').disabled = false;
  showScreen('screen-stage-b');
}

function moveToTray(coinEl, value) {
  coinEl.remove();
  session.tray.push(value);
  const trayCoin = document.createElement('div');
  trayCoin.className = 'coin-btn tray-coin';
  trayCoin.innerHTML = coinSvg(value);
  trayCoin.addEventListener('click', () => {
    trayCoin.remove();
    const idx = session.tray.indexOf(value);
    if (idx !== -1) session.tray.splice(idx, 1);
    updateTrayTotal();
    // ウォレットへ戻す
    restoreCoinToWallet(value);
  });
  el('tray').appendChild(trayCoin);
  updateTrayTotal();
}

function restoreCoinToWallet(value) {
  const coin = document.createElement('button');
  coin.className = 'coin-btn';
  coin.innerHTML = coinSvg(value);
  coin.dataset.value = value;
  coin.addEventListener('click', () => moveToTray(coin, value));
  el('wallet').appendChild(coin);
}

function updateTrayTotal() {
  const sum = session.tray.reduce((s, v) => s + v, 0);
  el('tray-total').textContent = sum;
}

function onPay() {
  const sum = session.tray.reduce((s, v) => s + v, 0);
  const fb = el('pay-feedback');
  if (sum === session.total) {
    fb.textContent = 'ぴったり！ ありがとう！';
    fb.className = 'feedback ok';
    shell.sound.play('coin');
    document.getElementById('btn-pay').disabled = true;
    setTimeout(() => {
      const conf = LEVELS[level];
      if (conf.change) startStageC();
      else finishErrand();
    }, 700);
  } else if (sum < session.total) {
    fb.textContent = `あと ${session.total - sum}えん たりないよ`;
    fb.className = 'feedback ng';
  } else {
    fb.textContent = `${sum - session.total}えん おおいよ`;
    fb.className = 'feedback ng';
  }
}

/* ===================== ステージC: おつりはいくら？ ===================== */
function startStageC() {
  // 分かりやすい額でオーバーペイして、おつりを暗算させる
  let payAmount = session.total;
  if (session.total <= 100) payAmount = 100;
  else payAmount = Math.ceil(session.total / 100) * 100 + 100;
  session.payAmount = payAmount;
  session.changeAnswer = payAmount - session.total;

  el('change-question').textContent = `${payAmount}えんで はらったら、おつりは いくら？`;
  el('change-input').value = '';
  el('change-feedback').textContent = '';
  showScreen('screen-stage-c');
  el('change-input').focus();
}

function onChangeSubmit() {
  const val = Number(el('change-input').value);
  if (!val && val !== 0) return;
  const fb = el('change-feedback');
  if (val === session.changeAnswer) {
    fb.textContent = 'せいかい！ おつりも ばっちり！';
    fb.className = 'feedback ok';
    shell.sound.play('correct');
    setTimeout(finishErrand, 700);
  } else {
    fb.textContent = 'もういちど けいさんしてみよう！';
    fb.className = 'feedback ng';
    shell.sound.play('wrong');
    shell.fireLog.logWrong('shopping-change', `${session.payAmount}-${session.total}`, String(session.changeAnswer));
  }
}

/* ===================== おつかい完了 → 次へ or リザルト ===================== */
function finishErrand() {
  tokensEarned += 2;
  errandIndex++;
  if (errandIndex < 3) {
    startErrand();
  } else {
    tokensEarned += 4; // 3回コンプリートボーナス
    shell.showResult({ correct: 3, total: 3, tokens: tokensEarned });
  }
}

/* ===================== 起動 ===================== */
function startLevel(lv) {
  level = lv;
  errandIndex = 0;
  tokensEarned = 0;
  startErrand();
}

fetch('items.json')
  .then((res) => res.json())
  .then((data) => {
    items = data.items;
    document.getElementById('btn-level-1').addEventListener('click', () => shell.startGame(() => startLevel(1)));
    document.getElementById('btn-level-2').addEventListener('click', () => shell.startGame(() => startLevel(2)));
    document.getElementById('btn-level-3').addEventListener('click', () => shell.startGame(() => startLevel(3)));
    document.getElementById('btn-add-submit').addEventListener('click', onAddSubmit);
    document.getElementById('add-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') onAddSubmit(); });
    document.getElementById('btn-pay').addEventListener('click', onPay);
    document.getElementById('btn-change-submit').addEventListener('click', onChangeSubmit);
    document.getElementById('change-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') onChangeSubmit(); });
    shell.onRetry(() => showScreen('screen-start'));
  });

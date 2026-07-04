/*
 * clock-face.js — アナログ時計のSVG描画（単独モジュール、core/には依存しない）
 *
 * 短針は「時」だけでなく「分」に応じて中間位置まで傾ける。
 * 例: 3:30 なら短針は 3 と 4 のちょうど中間を指す（学習上いちばん重要な点）。
 */
export function renderClock(el, { hour, minute }) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 10;

  // 12時方向を0度にするため -90 度オフセット
  const hourAngle = ((hour % 12) + minute / 60) * 30 - 90;
  const minuteAngle = minute * 6 - 90;

  let ticks = '';
  for (let i = 0; i < 60; i++) {
    const rad = (i * 6 - 90) * Math.PI / 180;
    const isLong = i % 5 === 0;
    const outer = r - 2;
    const inner = isLong ? r - 14 : r - 7;
    const x1 = cx + outer * Math.cos(rad), y1 = cy + outer * Math.sin(rad);
    const x2 = cx + inner * Math.cos(rad), y2 = cy + inner * Math.sin(rad);
    ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${isLong ? '#5c4c51' : '#d8c7cc'}" stroke-width="${isLong ? 3 : 1.5}" stroke-linecap="round" />`;
  }

  let numbers = '';
  for (let n = 1; n <= 12; n++) {
    const rad = (n * 30 - 90) * Math.PI / 180;
    const nr = r - 28;
    const x = cx + nr * Math.cos(rad);
    const y = cy + nr * Math.sin(rad);
    numbers += `<text x="${x.toFixed(1)}" y="${(y + 6).toFixed(1)}" text-anchor="middle" font-size="20" font-weight="900" fill="#5c4c51" font-family="'M PLUS Rounded 1c', sans-serif">${n}</text>`;
  }

  const hourLen = r * 0.5;
  const minuteLen = r * 0.78;
  const hRad = hourAngle * Math.PI / 180;
  const mRad = minuteAngle * Math.PI / 180;
  const hx = cx + hourLen * Math.cos(hRad), hy = cy + hourLen * Math.sin(hRad);
  const mx = cx + minuteLen * Math.cos(mRad), my = cy + minuteLen * Math.sin(mRad);

  el.innerHTML = `
    <svg viewBox="0 0 ${size} ${size}" width="100%" height="100%" style="max-width:280px;">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#fffdf7" stroke="#5c4c51" stroke-width="4" />
      ${ticks}
      ${numbers}
      <line x1="${cx}" y1="${cy}" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}" stroke="#5c4c51" stroke-width="7" stroke-linecap="round" />
      <line x1="${cx}" y1="${cy}" x2="${mx.toFixed(1)}" y2="${my.toFixed(1)}" stroke="#ff7ebb" stroke-width="4.5" stroke-linecap="round" />
      <circle cx="${cx}" cy="${cy}" r="7" fill="#5c4c51" />
    </svg>
  `;
}

// 5分刻みの分の読み方（ふん/ぷんの使い分け表）
export const MINUTE_LABEL = {
  5: 'ごふん', 10: 'じゅっぷん', 15: 'じゅうごふん', 20: 'にじゅっぷん',
  25: 'にじゅうごふん', 30: 'さんじゅっぷん', 35: 'さんじゅうごふん',
  40: 'よんじゅっぷん', 45: 'よんじゅうごふん', 50: 'ごじゅっぷん', 55: 'ごじゅうごふん'
};

export function formatTime(hour, minute, level) {
  if (level === 1 || minute === 0) return `${hour}じ`;
  if (level === 2) return minute === 30 ? `${hour}じはん` : `${hour}じ`;
  return `${hour}じ${MINUTE_LABEL[minute]}`;
}

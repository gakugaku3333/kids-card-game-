/*
 * kirakira/games/maze-ex/shapes.js — 「正解ルートが絵になる迷路」の絵柄データと生成アルゴリズム
 *
 * 通常の迷路生成（穴掘り法）とは逆の手順で作る:
 *   1. 絵の輪郭を一筆書きのセル列（points）として先に決める（自己交差なし）
 *   2. その輪郭ぶんの壁を先に開ける
 *   3. 残りのセルは輪郭からぶら下がる「木」として掘る（袋小路はランダム）
 * → 迷路全体が全域木になるため、スタート→ゴールの経路は数学的に輪郭ルートだけに一意に定まる。
 *   ショートカットは原理的に発生しない（プロトタイプ検証: BFS解と作画ルートが完全一致することを確認済み）。
 */

// 頂点列（直線区間のみ）を1マスずつのセル列に展開する
function expandPath(points) {
  const path = [points[0]];
  for (let i = 1; i < points.length; i++) {
    let [r, c] = path[path.length - 1];
    const [tr, tc] = points[i];
    while (r !== tr || c !== tc) {
      r += Math.sign(tr - r);
      c += Math.sign(tc - c);
      path.push([r, c]);
    }
  }
  return path;
}

export function buildMaze({ cols, rows, points }) {
  const path = expandPath(points);
  const grid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ top: true, right: true, bottom: true, left: true }))
  );
  const open = (a, b) => {
    const [r1, c1] = a, [r2, c2] = b;
    if (r2 === r1 - 1) { grid[r1][c1].top = false; grid[r2][c2].bottom = false; }
    else if (r2 === r1 + 1) { grid[r1][c1].bottom = false; grid[r2][c2].top = false; }
    else if (c2 === c1 + 1) { grid[r1][c1].right = false; grid[r2][c2].left = false; }
    else { grid[r1][c1].left = false; grid[r2][c2].right = false; }
  };
  for (let i = 1; i < path.length; i++) open(path[i - 1], path[i]);

  const inTree = Array.from({ length: rows }, () => Array(cols).fill(false));
  for (const [r, c] of path) inTree[r][c] = true;
  const frontier = [...path];
  while (frontier.length) {
    const idx = Math.floor(Math.random() * frontier.length);
    const [r, c] = frontier[idx];
    const nbrs = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]
      .filter(([nr, nc]) => nr >= 0 && nr < rows && nc >= 0 && nc < cols && !inTree[nr][nc]);
    if (!nbrs.length) { frontier.splice(idx, 1); continue; }
    const [nr, nc] = nbrs[Math.floor(Math.random() * nbrs.length)];
    open([r, c], [nr, nc]);
    inTree[nr][nc] = true;
    frontier.push([nr, nc]);
  }

  return {
    grid, cols, rows,
    start: { r: path[0][0], c: path[0][1] },
    goal: { r: path[path.length - 1][0], c: path[path.length - 1][1] },
  };
}

// 各絵柄: cols/rows はグリッドサイズ、pointsは輪郭の頂点列（start→goalの一筆書き）
export const SHAPES = {
  easy: [
    { id: 'house', name: 'おうち', emoji: '🏠', cols: 10, rows: 9,
      points: [[8, 4], [8, 1], [4, 1], [3, 1], [3, 2], [2, 2], [2, 3], [1, 3], [1, 4], [0, 4], [0, 5], [1, 5], [1, 6], [2, 6], [2, 7], [3, 7], [3, 8], [4, 8], [8, 8], [8, 5]] },
    { id: 'strawberry', name: 'いちご', emoji: '🍓', cols: 9, rows: 9,
      points: [[8, 4], [7, 4], [7, 3], [6, 3], [6, 2], [4, 2], [4, 1], [2, 1], [1, 1], [1, 2], [0, 2], [0, 3], [1, 3], [1, 4], [0, 4], [0, 5], [1, 5], [1, 6], [0, 6], [0, 7], [1, 7], [2, 7], [4, 7], [4, 6], [6, 6], [6, 5], [7, 5], [8, 5]] },
  ],
  normal: [
    { id: 'fish', name: 'おさかな', emoji: '🐟', cols: 13, rows: 9,
      points: [[3, 0], [3, 1], [2, 1], [2, 2], [1, 2], [1, 6], [2, 6], [2, 7], [3, 7], [3, 8], [2, 8], [2, 9], [1, 9], [1, 11], [2, 11], [2, 12], [4, 12], [5, 12], [5, 11], [6, 11], [6, 10], [7, 10], [7, 9], [6, 9], [6, 8], [5, 8], [5, 7], [6, 7], [6, 6], [7, 6], [7, 3], [6, 3], [6, 2], [5, 2], [5, 1], [4, 1], [4, 0]] },
    { id: 'heart', name: 'ハート', emoji: '💗', cols: 12, rows: 11,
      points: [[10, 5], [9, 5], [9, 4], [8, 4], [8, 3], [7, 3], [7, 2], [6, 2], [6, 1], [5, 1], [5, 0], [3, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2], [0, 4], [1, 4], [1, 5], [2, 5], [2, 6], [1, 6], [1, 7], [0, 7], [0, 9], [1, 9], [1, 10], [2, 10], [2, 11], [3, 11], [5, 11], [5, 10], [6, 10], [6, 9], [7, 9], [7, 8], [8, 8], [8, 7], [9, 7], [9, 6], [10, 6]] },
  ],
  hard: [
    { id: 'crown', name: 'ティアラ', emoji: '👑', cols: 14, rows: 9,
      points: [[8, 1], [3, 1], [3, 2], [2, 2], [2, 3], [1, 3], [0, 3], [0, 4], [1, 4], [1, 5], [2, 5], [3, 5], [3, 6], [2, 6], [2, 7], [1, 7], [0, 7], [0, 8], [1, 8], [1, 9], [2, 9], [3, 9], [3, 10], [2, 10], [2, 11], [1, 11], [0, 11], [0, 12], [1, 12], [2, 12], [3, 12], [8, 12], [8, 2]] },
    { id: 'cat', name: 'ねこ', emoji: '🐱', cols: 11, rows: 10,
      points: [[9, 3], [8, 3], [8, 2], [7, 2], [7, 1], [3, 1], [2, 1], [2, 0], [0, 0], [0, 3], [1, 3], [1, 4], [2, 4], [2, 6], [1, 6], [1, 7], [0, 7], [0, 10], [2, 10], [2, 9], [3, 9], [7, 9], [7, 8], [8, 8], [8, 7], [9, 7]] },
  ],
};

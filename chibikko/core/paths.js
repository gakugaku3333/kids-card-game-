/*
 * core/paths.js — アセットパス解決ヘルパー
 *
 * data/*.json や store.js の STICKERS/THEMES はすべて chibikko/ ルートからの相対パス
 * (例: "assets/stickers/candy.png") で統一して書く。実際に読み込むページの階層は
 * games/<name>/index.html (2階層下) だったり chibikko/index.html (0階層) だったりするため、
 * 各HTMLで <script>window.CHIBIKKO_ROOT = '../../';</script> のように深さを宣言し、
 * asset() でその場で解決する。
 */
export function asset(path) {
  const root = (typeof window !== 'undefined' && window.CHIBIKKO_ROOT) || '';
  return root + path;
}

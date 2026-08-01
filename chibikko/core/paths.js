/*
 * core/paths.js — アセットパス解決ヘルパー
 *
 * window.CHIBIKKO_ROOT は「現在のHTMLからプロジェクトルートまでの相対パス」
 * （chibikko/ ルートまでではない点に注意。例: chibikko/index.html では '../'、
 * chibikko/games/<name>/index.html では '../../../'）。
 * asset() に渡すpathは、この**プロジェクトルート基準**で書く:
 *   - chibikko専用データ（voice-lines.json・シールちょうの音声wav等）は
 *     "chibikko/data/..." のように "chibikko/" を前置する
 *   - ステッカー画像やマスコット画像など、本家サイトと共有しているプロジェクト
 *     ルート直下の assets/（chibikko/assets/ ではない）は前置しない
 *     (例: "assets/stickers/candy.png", "assets/mascot/loppi-chibikko-hero.webp")
 * asset() でその場で連結して解決する。
 */
export function asset(path) {
  const root = (typeof window !== 'undefined' && window.CHIBIKKO_ROOT) || '';
  return root + path;
}

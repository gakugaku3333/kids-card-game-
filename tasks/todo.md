# タスク完了: ページ構成最適化 ＆ トークン経済の融合

## 完了日: 2026-06-21（追記）

---

## 実施内容サマリ（2026-06-21 追加）

### A. 横向き（ランドスケープ）表示の修正
タイピングゲーム（lowercase / uppercase）で横向き時にコンテンツが切れる問題を修正。
`overflow-y: auto` + `@media (max-height: 700px)` で要素縮小。

### B. トークン経済の共通モジュール化

`js/store.js`（`window.Store`）を新設し、トークン残高・ショップ商品・購入品を全ページで共有。
既存の `katakana_game_data` localStorageキーは据え置きなのでデータ保全あり。

- **カタカナ/さんすうクイズ** — 従来通り正解 +2 トークン（Store経由に切替済み）
- **タイピング（大・小）** — 正解ごと +1 トークン（新規追加）、結果画面に獲得数表示
- **神経衰弱** — クリア時 easy+5 / medium+10 / hard+20 トークン（新規追加）

### C. メインページへのショップ統合
`index.html` ヘッダーにトークン残高バッジと「🛍️ ショップ」ボタンを追加。
モーダルでショップが開き、購入するとバッジが即時更新（`tokens-changed` カスタムイベント）。

---

## 共通モジュールの使い方

### `js/store.js`（必ずページ内で最初に読み込む）
```html
<script src="../../js/store.js"></script>  <!-- games/xxx/ からの場合 -->
<script src="js/store.js"></script>         <!-- ルート index.html の場合 -->
```
| API | 用途 |
|-----|------|
| `Store.getTokens()` | 現在の残高を取得 |
| `Store.addTokens(n)` | n トークン加算＋保存＋`tokens-changed` 発火 |
| `Store.buy(itemId)` | 購入（残高不足/既所有時は `false` を返す） |
| `Store.owns(itemId)` | 所有確認 |
| `Store.getData()` | ライブ参照（rakugaku の `gameData` 互換用） |
| `Store.SHOP_ITEMS` | 全27品カタログ配列 |

### `js/shop.js`（ショップUIが必要なページで store.js の後に読み込む）
```html
<script src="js/shop.js"></script>
```
```javascript
window.renderShop(containerElement);  // コンテナにけしょうアイテムを描画
```

### `css/store.css`（トークンバッジ・ショップモーダルのスタイル）
```html
<link rel="stylesheet" href="css/store.css">
```
使えるクラス: `.token-badge` `.shop-open-btn` `.store-modal` `.shop-items` `.shop-item` `.buy-btn`

### `.claude/launch.json`（プレビュー開発サーバ）
```bash
# Claude Code の preview_start ツールで起動（python3の静的サーバ port 8765）
# または手動で:
python3 -m http.server 8765
```

---

## 新規ゲーム追加時のチェックリスト（更新版）

1. `games/` 配下にゲームのサブフォルダを作成
2. `assets/images/` に `{ゲーム種別}_thumb.png` の命名規則でサムネイル画像を作成
3. `index.html` の `<main class="games-grid">` 内に `<a class="game-card">` ブロックを追加
4. 新しいゲームのHTMLに以下を追加:
   ```html
   <!-- head内 -->
   <link rel="apple-touch-icon" sizes="180x180" href="../../assets/images/apple-touch-icon.png">
   <link rel="icon" type="image/png" sizes="32x32" href="../../assets/images/favicon-32x32.png">
   <link rel="icon" type="image/png" sizes="16x16" href="../../assets/images/favicon-16x16.png">

   <!-- body末尾・script前 -->
   <script src="../../js/store.js"></script>
   ```
5. ゲームクリア/正解時に `Store.addTokens(n)` を呼んでトークンを加算する
6. 横向き対応: `body { overflow-y: auto; }` + `@media (max-height: 700px)` で要素縮小を追加
7. `python3 -m http.server 8765` でローカル確認

---

---

# タスク完了: サムネイル画像の再作成とアプリアイコンの追加

## 完了日: 2026-06-21

---

## 実施内容サマリ

### A. ゲームカードのサムネイル画像を全て個別に再作成
全9枚のゲームカードに対し、ゲーム内容を反映した固有のサムネイル画像をAI生成して適用した。

### B. アプリアイコン（apple-touch-icon）とファビコンの新規作成
iPadでのWebクリップ追加時に表示されるアプリアイコンと、ブラウザタブ用のファビコンを新規作成し、全HTMLページに適用した。

### C. ヘッダーロゴとiPadヘルプモーダルの強化
ポータル画面のヘッダーにアプリアイコンをロゴとして表示し、iPadヘルプモーダル内にアイコンプレビューを追加した。

---

## 最終的なファイル構成

```
子供用トランプゲーム/
├── index.html                          # ポータル画面（ゲームひろば）
├── css/
│   └── gallery.css                     # ポータル画面のスタイル
├── js/
│   └── gallery.js                      # ポータル画面のUI/効果音ロジック
├── assets/
│   └── images/
│       ├── apple-touch-icon.png        # Webクリップ用アイコン (180x180)
│       ├── favicon-32x32.png           # ファビコン (32x32)
│       ├── favicon-16x16.png           # ファビコン (16x16)
│       ├── gallery_bg.png             # ポータル背景画像
│       ├── memory_game_thumb.png       # しんけいすいじゃく用サムネイル
│       ├── katakana_thumb.png          # かたかなクイズ用サムネイル
│       ├── addition_thumb.png          # たしざんクイズ用サムネイル
│       ├── subtraction_thumb.png       # ひきざんクイズ用サムネイル
│       ├── multiplication_thumb.png    # かけざんクイズ用サムネイル
│       ├── division_thumb.png          # わりざんクイズ用サムネイル
│       ├── lowercase_typing_thumb.png  # たいぴんぐ(こもじ)用サムネイル
│       ├── uppercase_typing_thumb.png  # たいぴんぐ(おおもじ)用サムネイル
│       └── placeholder_game.png        # 準備中カード用サムネイル
├── games/
│   ├── memory/                         # 神経衰弱ゲーム
│   │   ├── index.html
│   │   ├── css/style.css
│   │   └── js/game.js
│   └── rakugaku/                       # 楽学アプリ群
│       ├── index.html                  # カタカナクイズ/算数クイズ
│       ├── lowercase-typing.html       # 小文字タイピング
│       └── uppercase-typing.html       # 大文字タイピング
└── tasks/
    ├── todo.md                         # タスク管理
    └── lessons.md                      # 教訓記録
```

---

## 画像アセット対応表

新しいゲームを追加する際はこの表を参照し、同じ規則で画像を追加する。

| # | ゲーム名 | HTML内のID | サムネイルファイル名 | リンク先 |
|---|---------|-----------|-------------------|---------|
| 1 | しんけいすいじゃく | `card-memory` | `memory_game_thumb.png` | `games/memory/index.html` |
| 2 | かたかなクイズ | `card-katakana` | `katakana_thumb.png` | `games/rakugaku/index.html?mode=katakana` |
| 3 | たしざんクイズ | `card-math-addition` | `addition_thumb.png` | `games/rakugaku/index.html?math=addition` |
| 4 | ひきざんクイズ | `card-math-subtraction` | `subtraction_thumb.png` | `games/rakugaku/index.html?math=subtraction` |
| 5 | かけざんクイズ | `card-math-multiplication` | `multiplication_thumb.png` | `games/rakugaku/index.html?math=multiplication` |
| 6 | わりざんクイズ | `card-math-division` | `division_thumb.png` | `games/rakugaku/index.html?math=division` |
| 7 | たいぴんぐ(こもじ) | `card-lowercase` | `lowercase_typing_thumb.png` | `games/rakugaku/lowercase-typing.html` |
| 8 | たいぴんぐ(おおもじ) | `card-uppercase` | `uppercase_typing_thumb.png` | `games/rakugaku/uppercase-typing.html` |
| 9 | じゅんびちゅう | `card-placeholder` | `placeholder_game.png` | （モーダル表示） |

### 新規ゲーム追加時のチェックリスト
1. `games/` 配下にゲームのサブフォルダを作成
2. `assets/images/` に `{ゲーム種別}_thumb.png` の命名規則でサムネイル画像を作成
3. `index.html` の `<main class="games-grid">` 内に `<a class="game-card">` ブロックを追加
4. 新しいゲームのHTMLの `<head>` 内に以下のアイコン設定を追加:
   ```html
   <link rel="apple-touch-icon" sizes="180x180" href="../../assets/images/apple-touch-icon.png">
   <link rel="icon" type="image/png" sizes="32x32" href="../../assets/images/favicon-32x32.png">
   <link rel="icon" type="image/png" sizes="16x16" href="../../assets/images/favicon-16x16.png">
   ```
5. ローカルサーバー（`python3 -m http.server 8000`）で表示確認

---

## デプロイ情報
- **リポジトリ**: `https://github.com/gakugaku3333/kids-card-game-.git`
- **ブランチ**: `main`
- **ホスティング**: GitHub Pages
- **公開URL**: `https://gakugaku3333.github.io/kids-card-game-/`

# 進行中: リニューアル Phase 0・Phase 1（一部）・Phase 2（基盤のみ）

## 完了日: 2026-07-04

[リニューアル指示書.md](リニューアル指示書.md) に基づく段階移行。今回実施した範囲:

### Phase 0（安全網）
- `tasks/smoke-test.md` を新設（各フェーズ完了時の動作確認チェックリスト）
- `git tag v1-legacy` をリニューアル着手前の状態に打って push 済み

### Phase 1（一部: ハブのみ。ゲーム個別ページは未着手）
- `data/games.json` を新設 — ゲーム一覧（タイトル・パス・サムネ・説明・カテゴリ）の唯一の管理場所に
- `index.html` のハードコードされた11枚のカードを撤去し、起動時に `data/games.json` を fetch して動的生成する方式に変更（表示・挙動は完全に維持）
- `core/modal.js` を新設 — `.g-modal`(`.active`) / `.store-modal`(`.show`) の混在を吸収する統一 `openModal`/`closeModal`/`closeOnOverlayClick` API
- `index.html` の末尾スクリプトと `js/gallery.js` を `type="module"` 化し、モーダル開閉をすべて `core/modal.js` 経由に置換（login/msg/help/shop/dressup/history の全6モーダル）

### 検証（`tasks/smoke-test.md` 該当行参照）
preview（ポート一時変更 8765→8767 でキャッシュ回避）でハブのみ確認: games.json駆動の11カード表示、ログイン、ショップ購入UI、きせかえUI、きろく表示、各モーダルの開閉（クローズボタン）が正常動作。コンソールエラーなし。スクリーンショットで見た目が変更前と同一であることを確認。

### Phase 2（基盤のみ。既存ゲームは無改修）
新規ゲームを「テンプレコピー＋games.jsonに1行追加」の2ステップにするための土台を新設。
- `core/store.js` — `js/store.js` と同一スキーマ・同一 localStorage キーのESM版（新規ゲーム用。既存ページの `js/store.js` はそのまま）
- `core/firelog.js` — `js/firebase-log.js` のESM版。Firebase未読込ページでも例外を握って無音でno-opになる
- `core/sound.js` — WebAudioでコード生成する効果音（`correct`/`wrong`/`clear`/`coin`）。ミュート状態はlocalStorageに保存
- `core/shell.js` — `GameShell` クラス。生成するだけで共通ヘッダー（もどるボタン・トークンバッジ）・横向き対応CSS・統一リザルトモーダル・タイマーの冪等クリーンアップ（`setInterval`/`requestAnimationFrame` をラップ）が付いてくる
- `games/_template/index.html` — 3問クイズのデモを使ってシェルの使い方を示すひな形。コピーして新規ゲームの出発点にする

### 検証（`tasks/smoke-test.md` 該当行参照）
`games/_template/` で3問プレイ→正解ごとに効果音→トークン+3加算→ヘッダーのトークン表示が即時更新→リザルトモーダル(3/3, ⭐3)表示→「もういちど あそぶ」で再スタート→`localStorage`の`katakana_game_data`スキーマが壊れていないことを確認。コンソールエラーなし（Firebase未読込による警告のみ、想定通り）。

### 未着手（次セッションで継続）
- `js/store.js` `js/firebase-log.js` `js/shop.js` `js/avatar.js` の `core/` へのES Modules移設（各ゲームページを1つずつ移行する必要があり、影響範囲が大きいため今回は見送り）
- `styles/tokens.css`（既存 `css/gallery.css` の `:root` に同等のCSS変数が既にあるため、実質的な重複を避けて保留）
- 既存ゲーム（memory/rakugaku/mole/catch/draw）をシェル対応に改修（Phase 2残り）
- クイズエンジン統合・音のショップ全体反映・PWA・レベル/ずかん等（Phase 3以降）

---

# タスク完了: 学習履歴を見る画面の追加

## 完了日: 2026-06-29

### 機能概要
クイズで遊んだ結果（日付・ゲーム・正解数・獲得トークン）を後から振り返れる「📖 きろく」画面を `index.html` に追加。
保存自体は既存の `FireLog.logSession()`（Firestore `users/{nickname}/sessions`）が**すでに**行っていたが、表示する手段がなかったため、取得APIと表示モーダルのみを新設した。

### 変更したファイル
| ファイル | 変更内容 |
|---------|---------|
| `js/firebase-log.js` | `getSessions(limit, cb)` を追加（sessionsを `timestamp desc` で取得） |
| `index.html` | ヘッダーに「📖 きろく」ボタン・`#history-modal`・履歴描画JS（サマリ集計＋日付グループ化）を追加 |
| `css/store.css` | `.history-summary` / `.history-row` / `.history-day` 等のスタイルを追加 |

### 使い方（再利用ポイント）
- **履歴を読む**: `FireLog.getSessions(50, function(sessions){ ... })`。各要素は `{game, correct, total, tokens, timestamp(Firestore Timestamp)}`。未ログイン時は `[]`。
- **モーダル開閉**: `#history-modal` は `.store-modal` なので **`.show`** クラスで開閉（`.g-modal` の `.active` ではない → [lessons.md #15](lessons.md)）。
- **他ゲームも履歴に出したい場合**: クリア時に `FireLog.logSession(game, correct, total, tokens)` を1行呼ぶだけ。現状クイズ2種のみが呼んでいる。ゲーム名ラベルは `index.html` の `GAME_LABELS` に追記すると表示名・アイコンが付く（未登録は `🎮 + 生のgame名`）。

### 検証
preview（port 8765）で：コンソールエラーなし／実Firestore問い合わせで空状態表示OK／モックデータでサマリ集計（3かい24せいかい⭐24）と日付グループ化（6/29に2件・6/27に1件）をスクリーンショットで確認。

---

# 進行中のタスク: 画像生成による女の子向けアバターの追加

- [x] 女の子向けアバター画像の生成と配置（5種類）
  - [x] 魔法少女 (`avatar_magic_girl.png`)
  - [x] プリンセス (`avatar_princess.png`)
  - [x] うさぎのようせい (`avatar_rabbit_fairy.png`)
  - [x] ねこみみガール (`avatar_kitty_girl.png`)
  - [x] てんしちゃん (`avatar_angel_girl.png`)
- [x] 共通モジュール `js/store.js` の改修
  - [x] 画像対応用の `Store.getIconHtml` メソッドの実装
  - [x] 新規アバター（5種類）を `SHOP_ITEMS` に追加（画像パスを icon に設定）
- [x] 着せ替え機能 `js/avatar.js` の改修
  - [x] `renderAvatar` で画像アイコンが正常に表示されるよう `Store.getIconHtml` を適用
  - [x] `makeOption` の選択肢ボタンでの画像表示対応
- [x] ショップ機能 `js/shop.js` の改修
  - [x] 商品一覧および購入ポップアップでの画像表示対応
- [x] CSS (`css/avatar.css`, `css/store.css`) の改修
  - [x] 画像アバターが枠に綺麗に収まり、円形になるようなスタイル設定
  - [x] サイズ（チップサイズ 20px / プロフィールサイズ 92px）に画像が連動するよう設定 (`1em`)
- [x] ローカル環境での動作確認と検証

## レビュー (2026-06-25)
女の子向けの可愛いアバター5種（まほうしょうじょ、プリンセス、うさぎのようせい、ねこみみガール、てんしちゃん）を画像生成AIで生成し、ショップで購入してアバターきせかえで使用できるようにしました。絵文字アバターと混在しても、CSSの `em` 指定により、チップアバターやプロフィールサイズに合わせて画像が自動でサイズスケーリングされ、綺麗に円形に表示されます。文法チェックも実行し問題ないことを確認しました。

---

# タスク完了: 新ゲーム3本追加（もぐらたたき・フルーツキャッチ・おえかき）

## 完了日: 2026-06-22

### 追加したファイル
| ファイル | 内容 |
|---------|-----|
| `games/mole/index.html` | もぐらたたき（3×3、30秒、爆弾あり、Store連携） |
| `games/catch/index.html` | フルーツキャッチ（落下・カゴ・ライフ3、Store連携） |
| `games/draw/index.html` | おえかき（Canvas、10色、3太さ、消しゴム、できた！+3） |
| `assets/images/mole_thumb.svg` | もぐらたたきサムネイル（SVG新形式） |
| `assets/images/catch_thumb.svg` | フルーツキャッチサムネイル（SVG新形式） |
| `assets/images/draw_thumb.svg` | おえかきサムネイル（SVG新形式） |

### 変更したファイル
- `index.html` — カード9・10・11を `card-placeholder` 直前に追加

### トークン設計
- もぐらたたき: `Math.ceil(score / 5)` （スコア5点ごとに1トークン）
- フルーツキャッチ: `Math.ceil(catchCount / 4)` （4個ごとに1トークン）
- おえかき: 固定 +3（1分クールダウン、最低5ストローク必要）

---

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

## 画像アセット対応表（最終更新: 2026-06-22）

新しいゲームを追加する際はこの表を参照し、同じ規則で画像を追加する。
※ 既存ゲーム(#1〜#8)のサムネイルはPNG。新規ゲーム(#9〜)はSVGを採用（編集容易・軽量・解像度非依存）。

| # | ゲーム名 | HTML内のID | サムネイルファイル | リンク先 |
|---|---------|-----------|-----------------|---------|
| 1 | しんけいすいじゃく | `card-memory` | `memory_game_thumb.png` | `games/memory/index.html` |
| 2 | かたかなクイズ | `card-katakana` | `katakana_thumb.png` | `games/rakugaku/index.html?mode=katakana` |
| 3 | たしざんクイズ | `card-math-addition` | `addition_thumb.png` | `games/rakugaku/index.html?math=addition` |
| 4 | ひきざんクイズ | `card-math-subtraction` | `subtraction_thumb.png` | `games/rakugaku/index.html?math=subtraction` |
| 5 | かけざんクイズ | `card-math-multiplication` | `multiplication_thumb.png` | `games/rakugaku/index.html?math=multiplication` |
| 6 | わりざんクイズ | `card-math-division` | `division_thumb.png` | `games/rakugaku/index.html?math=division` |
| 7 | たいぴんぐ(こもじ) | `card-lowercase` | `lowercase_typing_thumb.png` | `games/rakugaku/lowercase-typing.html` |
| 8 | たいぴんぐ(おおもじ) | `card-uppercase` | `uppercase_typing_thumb.png` | `games/rakugaku/uppercase-typing.html` |
| 9 | もぐらたたき | `card-mole` | `mole_thumb.svg` ★SVG | `games/mole/index.html` |
| 10 | フルーツキャッチ | `card-catch` | `catch_thumb.svg` ★SVG | `games/catch/index.html` |
| 11 | おえかき | `card-draw` | `draw_thumb.svg` ★SVG | `games/draw/index.html` |
| 12 | じゅんびちゅう | `card-placeholder` | `placeholder_game.png` | （モーダル表示） |

### 新規ゲーム追加時のチェックリスト（更新版）
1. `games/` 配下にゲームのサブフォルダを作成（`games/{名前}/index.html`）
2. `assets/images/` にサムネイルを追加（**新規はSVG推奨**。命名: `{種別}_thumb.svg`）
3. `index.html` の `<main class="games-grid">` 内の **プレースホルダー(`card-placeholder`)より前** に `<a class="game-card">` ブロックを追加
4. 新しいゲームのHTML に以下を追加:
   ```html
   <!-- head内: アイコン -->
   <link rel="apple-touch-icon" sizes="180x180" href="../../assets/images/apple-touch-icon.png">
   <link rel="icon" type="image/png" sizes="32x32" href="../../assets/images/favicon-32x32.png">
   <link rel="icon" type="image/png" sizes="16x16" href="../../assets/images/favicon-16x16.png">

   <!-- body末尾・自分のscript前: トークン経済 -->
   <script src="../../js/store.js"></script>
   ```
5. 正解/クリア/完成時に `Store.addTokens(n)` を呼ぶ
6. 横向き対応を追加（`overflow-y:auto` + `@media (max-height:700px)` で縮小）
7. タイマー/ループ系ゲームは `startGame()` 冒頭で必ず前回のタイマーを `clearInterval` / `cancelAnimationFrame` してから初期化する（重複起動バグ防止）
8. `preview_start("static")` (port 8765) でローカル確認 → コンソールエラーなし・トークン加算・横向き正常を必ず確認

---

---

# タスク完了: アバター着せ替え機能の実装

## 完了日: 2026-06-23

### 機能概要
ショップで買った絵文字アイテムを **3スロット（ベース／かざり／エフェクト）** に重ねて自分のアバターを着せ替えできる機能を追加。
トークン → ショップ購入 → アバター着せ替え という遊びのループが完成した。

### スロット設計
| スロット | 対応 `type` | アイテム例 |
|---------|------------|-----------|
| `base`（ベース） | `avatar` | 🐱🐰🐻🦄 |
| `accessory`（かざり） | `badge`, `special` | 🥇🥈🥉👑🏆 |
| `effect`（エフェクト） | `effect` | 🌈✨💕（オーラアニメ付き） |

### 追加したファイル
| ファイル | 内容 |
|---------|-----|
| `js/avatar.js` | `renderAvatar(el, {size})` + `renderDressUp(container)` |
| `css/avatar.css` | 合成アバター表示・オーラアニメ・着せ替えモーダルスタイル |

### 変更したファイル
| ファイル | 変更内容 |
|---------|---------|
| `js/store.js` | `avatar` フィールド追加・`getAvatar()`/`slotOf()`/`equip()` 追加 |
| `js/gallery.js` | 着せ替えボタン開閉・`tokens-changed` でチップアバター自動更新 |
| `index.html` | 👗 きせかえボタン・着せ替えモーダル・CSS/JS読み込み・チップへのアバター描画 |

### Store API（2026-06-23 追加分）
| API | 用途 |
|-----|------|
| `Store.getAvatar()` | 現在の装備オブジェクト `{base, accessory, effect}` を返す |
| `Store.slotOf(itemId)` | アイテムIDがどのスロットに属するかを返す（`'base'`/`'accessory'`/`'effect'`/`null`） |
| `Store.equip(slot, id)` | スロットにアイテムを装備。`id=null` で外す。所持済みかつスロット一致時のみ成功 |

### avatar.js の使い方
```javascript
// ヘッダーチップ等の小サイズ
window.renderAvatar(document.getElementById('user-chip-avatar'), { size: 'chip' });

// 着せ替え画面プロフィールの特大サイズ
window.renderAvatar(document.getElementById('dressup-avatar'), { size: 'profile' });

// 着せ替えUI全体を描画（内部でrenderAvatarも呼ぶ）
window.renderDressUp(document.getElementById('dressupBody'));
```
- `store.js` より後・`gallery.js` より前に読み込む（index.html での順序厳守）
- `tokens-changed` イベントに乗って `renderAvatar` を呼べば購入→着せ替え反映が即時に動く

### localStorage スキーマ変更（後方互換あり）
```json
{
  "tokens": 120,
  "ownedItems": ["avatar_cat", "crown"],
  "avatar": { "base": "avatar_cat", "accessory": "crown", "effect": null }
}
```
`avatar` キーがない既存データは `load()` 時に `{base:null, accessory:null, effect:null}` として補完される。

---

## デプロイ情報
- **リポジトリ**: `https://github.com/gakugaku3333/kids-card-game-.git`
- **ブランチ**: `main`
- **ホスティング**: GitHub Pages
- **公開URL**: `https://gakugaku3333.github.io/kids-card-game-/`

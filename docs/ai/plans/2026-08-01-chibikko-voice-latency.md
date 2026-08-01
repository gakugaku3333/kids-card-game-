# ちびっこひろば: ゲーム開始時の音声が遅れる問題の解消

- **状態**: 実装済み（Chrome側AC1〜9は確認済み。HC1〜3のiPad/iPhone実機確認は未実施のため`implemented`は保留）
- **規模**: 中（既存の音声再生ロジックの変更。数値計算・金銭・データ完全性には無関係）
- **作成日**: 2026-08-01
- **ベースライン（2026-08-01 改訂）**: `1004105`（作業ツリーはクリーン）

```
$ git log --oneline -3
1004105 fix: 見せきれなかったきろくシールが消えないようにする
2d2f2b3 feat: ちびっこ Phase C2（シールちょうのずかん化・きろくシール・おはなし）
43b37d4 feat: 6歳ハブにココアのひとことと「もちもの」メニューを追加

$ git status --short
（docs/ 以外に差分なし）
```

> **初版のベースラインは無効になった。** 初版は「`css/gallery.css` と
> `index.html` に未コミット差分がある状態」を前提に書かれていたが、
> 並行セッションがその差分を `43b37d4` としてコミットし、続けて
> ちびっこ Phase C2（`2d2f2b3` / `1004105`）を入れた。したがって
> **本計画の着手前に、下記の衝突点を確認すること。**
>
> | 衝突点 | 初版の記述 | 現状 |
> |---|---|---|
> | `css/gallery.css` / ルート `index.html` | 未コミット差分あり・触るな | **コミット済み**。触るなという方針は変わらない |
> | `chibikko/core/shell.js` | 本計画の変更対象 | Phase C2 で `_ensureRecordModal` / `_showNextRecord` / `showResult` のきろくシール処理が入った。`autoStart()` への先読み追加はこの上に載せる |
> | `chibikko/data/voice-lines.json` | 変更禁止 | Phase C2 で60件追加され169件になった。**うち61件（`sticker-*` / `record-*` / `story-*`）はwav未生成でフォールバック経路に入る**。AC8 の「あいさつ音声」は既存wavがあるIDのみを対象とすること |
> | `chibikko/sticker-book.html` / `chibikko/story.html` | 言及なし | Phase C2 で `Voice.speak()` の新しい呼び出し元が増えた。同期再生パス化（AC1）の影響を受けるので、この2ページでも動作確認する |

## 背景と問題

3歳向けサイト「ちびっこひろば」（`chibikko/`）は、文字を読ませない設計のため
**すべての指示・出題・ほめ言葉を音声で伝える**。したがって音声の遅延は
「演出が地味」ではなく「何をすればいいか分からない時間が発生する」という
体験の根幹に関わる欠陥になる。

### 観測された事実（ユーザー報告）

- ゲーム開始時のあいさつ音声が遅れて鳴る。
- **同じゲームを2回目・3回目に開いても同じくらい遅れる**（＝初回ダウンロード
  だけの問題ではない）。
- 主な利用端末は **iPad / iPhone の Safari**。
- 遅れて鳴ったときの声質（Gemini TTS音声か、フォールバックのカタコト
  speechSynthesisか）は**未確認**。

### 未検証の仮説

- `_play()` の `catch` が `fallbackSpeak()` を黙って呼んでおり、実際には
  iOS Safari が `<audio>` の再生を拒否してカタコト音声に落ちている可能性。
  → 修正後に声質が変われば、これが起きていたことの証拠になる（HC2）。

## 原因（根拠つき）

### 原因1: ゲーム画面で最初にタップするまで、あいさつ音声が鳴らない【検証済み・最大の要因】

`chibikko/core/shell.js:199` `autoStart()`:

```js
autoStart({ greeting, onStart }) {
  document.body.addEventListener('pointerdown', () => {
    Voice.unlock(); sound.resume();
    if (greeting) Voice.speak(greeting);
  }, { once: true });
  this.startGame(onStart);
}
```

子どもはホーム画面でカードをタップして遷移してくるので、ゲーム画面を見た
時点では**まだ画面に触っていない**。つまり「どう遊ぶか」を説明する音声が、
子どもが迷って画面を触るまで再生されない。ネットワーク遅延ではなく、
**子どもの逡巡時間ぶんまるごと遅れる**設計になっている。

**重要**: iOS Safari では、この待ちを**コードで消すことはできない**。
音の出る再生には「そのドキュメント内での」ユーザージェスチャが必要で、
ホーム画面のカードタップによる user activation はページ遷移をまたいで
引き継がれない。したがって対策は「タップ待ちをなくす」ではなく
**「必要なタップが、偶然ではなく意図的に、早く発生するようにする」**か、
**「タップが来た瞬間の遅延をゼロにする」**のどちらかになる。
前者はUX判断なので後述の「人間の判断が必要な選択肢」へ回す。

### 原因2: 再生の直前にJSONのfetchが直列で挟まっている【検証済み】

`chibikko/core/voice.js:78` `_play()`:

```js
async function _play(id) {
  const lines = await loadLines();   // ← ここで初めて voice-lines.json を取りに行く
  ...
  const audio = getAudio(id);        // ← ここで初めて new Audio() → WAV取得開始
  await audio.play();
}
```

`loadLines()` は `unlock()`（＝最初のタップ）で初めて呼ばれる。Service Worker
がないためページ遷移のたびにモジュールは作り直され、`linesPromise` も
`audioCache` も破棄される。結果、**タップから再生までの間に
「voice-lines.json の1往復」＋「WAV 約140KB の取得」が直列で入る**。

### 原因3: 音声ファイルを一切先読みしていない【検証済み】

`getAudio()` は再生要求が来た瞬間に `new Audio(src)` するだけで、
`preload` 指定も `load()` 呼び出しもない。ブラウザによっては
metadata のみ取得で止まり、`play()` の時点から実データ取得が始まる。
あいさつ音声のIDは `autoStart()` の時点で既に判明しているのに使っていない。

### 原因4: `<audio>` 経路がアンロックされていない可能性【未検証・iOSで致命的】

`voice.js:34` `unlock()` は `speechSynthesis` のウォームアップだけを行い、
**無音の HTMLAudioElement を再生していない**。`sound.resume()` が解除するのは
AudioContext であり、`<audio>` 要素の再生許可は別枠。
さらに原因2の `await` によってユーザージェスチャの同期呼び出しスタックが
切れるため、iOS Safari が `play()` を拒否 → `catch` で
`fallbackSpeak()`（このモジュールが避けたかったカタコト音声）に落ちている
可能性がある。

### 原因5（副症状）: ホーム画面でカード音声が鳴りきらない【検証済み】

`chibikko/index.html:126`:

```js
btn.addEventListener('click', () => {
  Voice.speak(`game-${g.id}`);
  setTimeout(() => { window.location.href = g.path; }, 500);
});
```

原因2の直列fetchにより500ms以内に音が始まらないことがあり、**無音のまま遷移
する／言いかけで切れる**。原因2を直せば大幅に改善するため、本計画では
500msという値自体は変更しない（変更すると遷移が遅くなり、原因1と同じ
「反応が鈍い」問題を別の場所で作ることになる）。

### 潜在バグ（ついでに直す）

`voice.js:82`:

```js
const audio = getAudio(id);
audio.currentTime = 0;                                    // ← try の外
try { await audio.play(); } catch (e) { fallbackSpeak(line.text); }
```

`readyState === 0` の新規要素に対する `currentTime = 0` は、古いWebKitで
`InvalidStateError` を投げる。これが `try` の外にあるため、投げた場合
`_play` は unhandled rejection になり**フォールバックすら鳴らず完全に無音**
になる。現代のSafariは仕様通りなのでリスクは中程度だが、修正は1行。
再生が同期パスになると順序の影響が大きくなるため、この機会に直す。

## 対象範囲

### 変更してよいファイル

- `chibikko/core/voice.js` — 先読みAPI追加、`speak()` の同期再生パス化、
  `unlock()` での `<audio>` アンロック、`currentTime` の例外ガード
- `chibikko/core/shell.js` — `autoStart()` であいさつ音声を先読みする
- `chibikko/index.html` — （必要なら）ホーム画面でのモジュール読み込み時
  先読み。ただし原因2の修正で足りるなら変更不要
- `docs/ai/plans/2026-08-01-chibikko-voice-latency.md` — 状態の更新のみ

### 変更禁止

- `css/gallery.css`, `index.html`（**リポジトリルート**＝6歳向けサイト）
  — 別作業の未コミット差分がある。1バイトも変更しないこと
- `core/`, `js/`（リポジトリルート直下＝6歳向けサイトの共通モジュール）
  — `chibikko/core/voice.js` は3歳向け専用であり、`store.js` のような
  スキーマパリティ制約は存在しない。ルート側を追随させる必要はない
- `chibikko/assets/voice/*.wav` — 音声ファイル自体は変更・再生成・変換しない
- `chibikko/data/voice-lines.json` — 内容は変更しない（Phase C2 で169件に増えたが、
  本計画では読むだけ）
- `kirakira/`, `tasks/`, `memory/` 配下すべて

## 受入条件

### 機械的に検証できる条件（Chrome + `python3 -m http.server 8765`）

- [ ] **AC1（最重要）**: `speak(id)` は、`voice-lines.json` がロード済みの
      場合、`audio.play()` を **`await` を一切挟まずに同期的に**呼ぶこと。
      呼び出し元のイベントハンドラから見て、`speak()` の呼び出しと
      `play()` の呼び出しの間にマイクロタスク境界が存在しないこと。
      **`_play` の `async`/`await loadLines()` 構造を残したまま先読みだけを
      足す実装は不可**（Chromeでは直ったように見えるが、iOSでは
      マイクロタスク継続中の `play()` として拒否され続けるため）。
      ロード未完了時のみ非同期パスにフォールバックしてよい。
- [ ] **AC2**: `voice-lines.json` の取得が、最初のタップではなく
      **`voice.js` のモジュール読み込み時点**で開始されること。
- [ ] **AC3**: `shell.autoStart({greeting})` を使うゲームページで、
      ページ読み込み完了から **1秒以内**に、あいさつ音声の HTMLAudioElement が
      `readyState >= 3`（HAVE_FUTURE_DATA）に到達すること。
      検証は DevTools コンソールから確認できる手段を用意すること
      （例: `Voice._debugReadyState(id)` のようなデバッグ用エクスポート、
      またはコンソールログ）。
- [ ] **AC4**: `unlock()` が、`speechSynthesis` のウォームアップに加えて、
      **同期的に**無音（`volume = 0` または `muted = true`）の
      HTMLAudioElement の `play()` を呼ぶこと。
- [ ] **AC5**: `audio.currentTime = 0` が `try` ブロックの内側にあり、
      これが例外を投げた場合もフォールバック経路に到達すること。
- [ ] **AC6**: 既存の再生挙動が保たれること。同一IDの連打は頭出しリスタート、
      異なるIDの同時呼び出しは重なって並行再生される（`tasks/lessons.md` #33）。
- [ ] **AC7（改訂）**: `git diff --stat -- css/gallery.css index.html core/ js/`
      が**空**であること（変更禁止範囲に1バイトも差分が出ていない）。
      初版は「未コミット差分がベースラインと一致すること」だったが、
      その差分は `43b37d4` でコミット済みのため、HEAD からの差分ゼロで判定する。
- [ ] **AC8**: `chibikko/` 配下の全ゲームページ（`chibikko/games/*/index.html`）が
      コンソールエラーなしで読み込まれ、あいさつ音声が鳴ること（Chrome）。
- [ ] **AC9**: `git status --short` に、計画で認めたファイル以外の
      新規ファイルが現れないこと。

### 人間が実機（iPad/iPhone Safari）で確認する条件

**機械では閉じられない。この確認なしに `implemented` にしない。**

- [ ] **HC1**: ゲーム画面で最初に画面に触れた瞬間、体感で**即座に**
      あいさつ音声が鳴ること（現状のような「触ってからさらに待つ」感覚が
      ないこと）。
- [ ] **HC2**: 鳴る音声が、カタコトの合成音声ではなく**Gemini TTSで生成した
      ココアの声**であること。（修正前後で声質が変わった場合、
      原因4のフォールバックが実際に起きていたことの確認になる。記録に残す。）
- [ ] **HC3**: ホーム画面でゲームカードをタップしたとき、ゲーム名の音声が
      遷移前に鳴り始めること（原因5の副症状の改善確認）。

## 制約（守るべき既存設計）

- **`tasks/lessons.md` #33 を破らないこと。** 音声のキュー・`playing` フラグ・
  `ended` イベント依存の排他制御を**再導入してはならない**。3歳向けは
  「聞き取りやすさ」より「押した瞬間に何か反応する」を優先する設計であり、
  完了待ちロジックは詰まった時に無音になるリスクを抱える。
  「タイミングを直す」という依頼は再シーケンス化の書き直しを誘発しやすいので
  特に注意する。
- **ノービルド・ESモジュール・静的サイト**であること。ビルドステップ・
  バンドラ・npm依存を導入しない。
- `asset()`（`chibikko/core/paths.js`）によるパス解決の仕組みを壊さない。
  ページ階層ごとに `window.CHIBIKKO_ROOT` が異なる。
- ミュート状態（`chibikko_muted`）の尊重を壊さない。先読み自体はミュート中でも
  行ってよいが、**音が出てはならない**。

## 書かなかったこと（スコープ外）

- **WAV → AAC/m4a などへの音声圧縮**。ユーザー報告が「2回目以降も同じくらい
  遅い」であり、帯域が主因ではないと判断したため。ロジック修正後に
  「初回だけ遅い」が残るようなら別タスクで扱う。
- **Service Worker / PWA キャッシュの導入**。効果はあるが、影響範囲が
  サイト全体に及びロールバックが難しい。本件の主因（同期再生パス）を
  直してから別途評価する。
- **Web Audio API（`decodeAudioData` + `AudioBufferSourceNode`）への全面移行**。
  レイテンシは理論上最小になるが、全音声のプリデコードはメモリと初期化
  コストが大きく、`<audio>` の同期再生パス化で十分と判断した。
  この代替案を再提案する必要はない。
- **ルートの6歳向けサイト（`core/sound.js` 等）への同種の修正**。
- **あいさつ以外の音声（出題・ほめ言葉）の先読み**。あいさつが最も遅延が
  目立つ地点であり、まずそこを直す。効果を測ってから広げる。
- `chibikko/games/pick/engine.js` 等にある**意図的な `setTimeout(..., 300)`**。
  これは演出上の間であり、遅延バグではない。変更しない。

## 失敗時の停止条件

- **AC1（同期再生パス）が実現できない場合、他のACの実装に進まず停止して
  報告すること。** AC1が本件の核心であり、これを欠いた変更は
  Chromeでは直ったように見えて iOS では何も改善しない。
- AC7（変更禁止ファイルの不変）に違反したことに気づいた場合、直ちに停止し、
  巻き戻し方を報告すること。自己判断で `git checkout` や `git stash` を
  実行しない。
- 実装中に、この計画に書かれていない設計変更が必要だと判断した場合、
  実行せずに理由を報告して停止すること。

## テストコマンド

このリポジトリには自動テストが存在しない（ノービルドの静的サイト）。
検証は手動＋DevTools で行う。

```bash
# 静的サーバ起動（ポートは .claude/launch.json で 8765 に固定）
python3 -m http.server 8765
# → http://localhost:8765/chibikko/index.html
# → http://localhost:8765/chibikko/games/balloon/index.html など各ゲーム

# 変更禁止範囲の確認
git diff --stat -- css/gallery.css index.html
git status --short
```

Codexは実装後、上記に加えて**変更したJSファイルの構文が有効であること**を
確認して報告すること（例: `node --check` は ESモジュールでは使えないため、
`node --input-type=module --eval "$(cat chibikko/core/voice.js)"` のような
構文確認、またはブラウザでのコンソールエラー無しの確認）。

## 人間の判断が必要な選択肢

**選択肢X: ゲーム画面の「タップして始める」演出を入れるか**

原因1で述べた通り、iOS Safari ではゲーム画面での最初のタップを
コードで代替できない。取りうる道は2つ:

- **X-a（現状維持 + 遅延ゼロ化のみ）**: 今の「専用スタート画面を挟まない」
  設計を維持し、子どもが偶然画面に触れた瞬間に即座に音が鳴るようにする。
  - 利点: タップ回数が増えない。`shell.js` のコメントに書かれた元の設計
    意図（二度タップの手間をなくす）を尊重する。
  - 欠点: 子どもが触るまであいさつは鳴らない。逡巡している間は無音のまま。
- **X-b（タップ誘導の演出を追加）**: ゲーム画面に入ったら、ココアが手を
  振っている等の**触りたくなる演出**を画面全体に出し、どこを触っても
  始まるようにする。触った瞬間にあいさつが鳴り、演出が消える。
  - 利点: 「触る」という行動が早く・確実に起き、結果としてあいさつが早く鳴る。
    3歳児は動くものを触るので誘導効果は高い。
  - 欠点: 実質的にタップが1回増える（ただし今も最初のタップは必要なので、
    増えるのは「意味のあるタップに変わる」だけとも言える）。
    実装範囲が広がる（演出用の画像・CSS）。

**本計画は既定で X-a を採用する。**X-b を選ぶ場合、演出のデザインが
必要になるため別計画に分けることを推奨する（本計画の修正は X-b の前提として
どちらにせよ必要）。

> **2026-08-02 改訂: X-b を採用して実装した。** 実際に触った結果、
> `autoStart()` が `startGame(onStart)` をタップ待ちと無関係に即実行していたため、
> 最初のタップがゲーム本編の一手を兼ねてしまい、あいさつ音声がゲーム進行に
> 割り込む形で遅れて聞こえる現象が確認された（この計画の原因1そのもの）。
> `chibikko/core/shell.js` の `autoStart()` を、ココアが画面いっぱいで手を振る
> 専用タップ画面（`_ensureStartScreen()`）を挟む形に変更し、そのタップでのみ
> `Voice.unlock()`→`speak(greeting)`→`startGame(onStart)` を実行する。
> 画像は新規生成せず既存の `assets/mascot/loppi-chibikko-hero.webp` を流用した。
> 原因2〜5・AC1〜AC9・制約は変更なくそのまま適用し、`voice.js`/`shell.js` に実装済み。

---

## 改訂履歴

- 2026-08-01: 初版（Claude）
- 2026-08-01: ベースラインとAC7を改訂（Claude・別セッション）。初版が前提にしていた
  未コミット差分は `43b37d4` でコミットされ、続けてちびっこ Phase C2
  （`2d2f2b3` / `1004105`）が `chibikko/core/shell.js`・`voice-lines.json` に入った。
  衝突点の表を背景節に追加し、AC7 を HEAD 基準の判定に置き換えた。
  **原因1〜5の分析・AC1〜AC6・制約・スコープ外の判断は初版のまま**（実装内容は変えていない）。
- 2026-08-02: X-b（タップ誘導画面）を採用して実装（Claude・別セッション）。
  `chibikko/core/voice.js` に `preload()`/`_debugReadyState()` を追加し、`speak()` を
  「lines読み込み済みならawait無しで同期play()」の構造に変更（AC1〜AC5相当）。
  `chibikko/core/shell.js` の `autoStart()` をタップ誘導画面（ココアの画像＋👆ヒント、
  `_ensureStartScreen()`）に置き換え、そのタップでのみ unlock→speak(greeting)→startGame
  を実行する構成にした。Chromeで全18ゲーム＋ホーム＋シールちょう＋おはなしページの
  コンソールエラー無しを確認し、`_debugReadyState()` で greeting音声が`readyState`4
  （HAVE_ENOUGH_DATA）まで先読み・再生されることを確認した（AC3・AC8）。
  `git diff --stat -- css/gallery.css index.html core/ js/` が空であることも再確認した（AC7）。
  **HC1〜HC3（iPad/iPhone Safari実機での体感確認）は未実施。** 実機確認が済むまで
  状態は`implemented`にしない。

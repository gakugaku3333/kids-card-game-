# スモークテストチェックリスト

リニューアル（[リニューアル指示書.md](リニューアル指示書.md)）の各フェーズ完了時に、このチェックリストを全項目パスさせてから次フェーズへ進む。

各ゲーム共通の確認観点:
1. ハブ（`index.html`）のカードからゲームが開ける
2. 1プレイして正解/クリア操作ができる
3. `Store.addTokens` が呼ばれ、ハブに戻るとトークンバッジが増えている
4. 横向き（landscape、iPad想定）でレイアウトが崩れない・縦スクロールが機能する
5. コンソールエラーがない

## チェック項目

- [ ] ハブ (`index.html`) 起動・トークンバッジ/アバターチップ表示・「📖 きろく」「🛒 ショップ」ボタンが開く
- [ ] しんけいすいじゃく (`games/memory/index.html`) — カードをめくってペア成立 → トークン加算（core/shell.js対応済み）
- [ ] かたかなクイズ (`games/quiz/index.html?set=katakana`) — 正誤判定 → トークン加算 → Firestoreログ(`FireLog.logSession`)（データ駆動クイズエンジン化済み。旧URL`games/rakugaku/index.html?mode=katakana`はリダイレクト）
- [ ] たしざん (`games/quiz/index.html?set=math-addition`) — 同上（レベル1は「答え10以下」45組み合わせの全出題プリセット）
- [ ] ひきざん (`games/quiz/index.html?set=math-subtraction`) — 同上
- [ ] かけざん (`games/quiz/index.html?set=math-multiplication`) — 同上
- [ ] わりざん (`games/quiz/index.html?set=math-division`) — 同上（レベル3のみ「あまり」を問う特殊生成）
- [ ] ふくしゅう (`games/quiz/index.html?mode=fb-review`) — Firestore誤答復習に対応、旧URL`games/rakugaku/index.html?mode=fb-review`はリダイレクト
- [ ] こもじタイピング (`games/rakugaku/lowercase-typing.html`) — 1問正解 → トークン加算
- [ ] おおもじタイピング (`games/rakugaku/uppercase-typing.html`) — 同上
- [ ] もぐらたたき (`games/mole/index.html`) — ひとりで: 30秒プレイ→スコア→トークン加算、タイマーが二重起動しない（連続スタート）／ふたりで: 上盤面が180度回転、両者独立採点、終了時トークン1回だけ加算（iPad実機で同時2点タップ要確認）
- [ ] とけいよみ (`games/clock/index.html`) — レベル1〜3で10問プレイ→結果表示→トークン加算、3:30で短針が3と4の中間、誤答がwrongItemsに記録
- [ ] おかいものやさん (`games/shopping/index.html`) — 3回のおつかいで加算・支払い・(レベル2以降)おつり計算→⭐10獲得、硬貨タップの当たり判定44px以上
- [ ] フルーツキャッチ (`games/catch/index.html`) — キャッチ→トークン加算、ライフ0でゲームオーバー（core/shell.js対応済み。rAFループのためiPad実機でのキャッチ動作の確認が必要、previewはタブ非表示でrAF停止のため不可）
- [ ] おえかき (`games/draw/index.html`) — 5ストローク以上描く→「できた！」でトークン+3、写真撮影/背景設定機能が動く（core/shell.js対応済み・ヘッダーのみ）
- [ ] ショップ・着せ替え — アイテム購入 → 着せ替えモーダルで装備 → アバターチップに反映
- [ ] きろく画面 (`#history-modal`) — セッション履歴が日付別に表示される
- [ ] localStorage `katakana_game_data` のキー構造が変化していない（tokens/ownedItems/avatarが壊れていない）
- [ ] 全ゲームでブラウザコンソールにエラーが出ていない

## 実施ログ

| 日付 | フェーズ | 結果 | 備考 |
|------|---------|------|------|
| 2026-07-04 | Phase 0 | - | チェックリスト作成のみ。実プレイ確認はPhase 1以降で実施 |
| 2026-07-04 | Phase 1（一部） | ✅ | ハブ(`index.html`)のみ検証。games.json駆動の11カード表示・ログイン・ショップ・きせかえ・きろく全モーダルの開閉・コンソールエラーなしを確認。各ゲームページ（memory/rakugaku/mole/catch/draw）は未変更のため未実施 |
| 2026-07-04 | Phase 2（基盤のみ） | ✅ | `core/shell.js`＋`games/_template/`を新規作成。テンプレートで3問プレイ→トークン+3加算→ヘッダー即時更新→リザルトモーダル表示→「もういちど あそぶ」で再スタート→localStorageスキーマ(`katakana_game_data`)が壊れていないことを確認。既存ゲーム(memory/rakugaku/mole/catch/draw)は今回未変更 |
| 2026-07-04 | 新ゲーム3本（とけいよみ/2人対戦もぐら/おかいもの） | ✅（一部iPad実機未検証） | とけいよみ: レベル1〜3で出題・10問完走・3:30の短針中間位置を数値検証・ふん/ぷん表を全パターン検証・誤答時FireLog呼び出し確認。もぐら: ソロ回帰確認（従来通り30秒/9穴/pointerdown）・対戦モード起動、両盤面同一マス同時スポーン、独立採点を確認。おかいもの: レベル1で3回のおつかいを完走し⭐10獲得、レベル2でおつり誤答→正答の両パスを確認。**2人同時タップの実機検証は未実施（preview不可、次回iPadで確認要）** |
| 2026-07-04 | Phase 1（残り: memory/catch/drawをcore/へ移行）＋Phase 2（memory/catch/drawのシェル対応） | ✅（catchのみ一部preview不可） | memory: `core/shell.js`導入、ヘッダーをシェル製に統一（レベル選択に戻るボタンは独自に維持）、`shell.store.addTokens`+`shell.fireLog.logSession`に置換。previewで6枚(かんたん)を実際にマッチさせ⭐5加算・ヘッダー即時反映・カスタム結果モーダル(タイム/ミス数)表示を確認。catch: 全面シェル化（独自ヘッダー/結果モーダルを撤去しshell.showResultに統一）。start画面・ヘッダー・シェル製結果モーダルの表示は確認したが、**rAFループの実プレイ確認はpreviewのタブ非表示(document.hidden)でrequestAnimationFrameが発火せず不可。iPad実機で要確認**。draw: ヘッダーのみシェル化、`shell.store.addTokens`に置換。実際に描画→「できた！」→⭐3加算→ヘッダー反映→ハブに戻って同じ⭐21が共有されていることを確認。3ゲームともコンソールエラーなし |
| 2026-07-04 | Phase 2（クイズエンジンのデータ駆動化） | ✅ | `games/rakugaku/index.html`(3570行)のうち実際にハブから到達可能な範囲（かたかな・算数4種・ふくしゅう導線。内包されていた15個のミニゲーム＋独自ショップ/とうけい画面はハブから到達不能な死んだコードと判明、削除）を`games/quiz/engine.js`(汎用エンジン211行)＋`games/quiz/index.html`(182行)＋`data/quizzes/*.json`(5ファイル)に置換。旧`games/rakugaku/index.html`は26行のリダイレクトシムに縮小し旧URL(`?mode=katakana`/`?math=xxx`/`?mode=fb-review`)を新URLへ`location.replace`。previewで確認: かたかなクイズ(3択・正解/不正解の両分岐・トークン蓄積)、たしざんレベル1(45組み合わせプリセットの総数確認)、わりざんレベル3(あまり生成の数値検証: 38÷5→あまり3)、旧URLからのリダイレクト、ふくしゅう導線(該当なし時のメッセージ表示)、ハブのカード一覧・トークン共有、全画面でコンソール/ネットワークエラーなしを確認 |

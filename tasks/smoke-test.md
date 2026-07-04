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
- [ ] しんけいすいじゃく (`games/memory/index.html`) — カードをめくってペア成立 → トークン加算
- [ ] かたかなクイズ (`games/rakugaku/index.html?mode=katakana`) — 正誤判定 → トークン加算 → Firestoreログ(`FireLog.logSession`)
- [ ] たしざん (`games/rakugaku/index.html?math=addition`) — 同上
- [ ] ひきざん (`games/rakugaku/index.html?math=subtraction`) — 同上
- [ ] かけざん (`games/rakugaku/index.html?math=multiplication`) — 同上
- [ ] わりざん (`games/rakugaku/index.html?math=division`) — 同上
- [ ] こもじタイピング (`games/rakugaku/lowercase-typing.html`) — 1問正解 → トークン加算
- [ ] おおもじタイピング (`games/rakugaku/uppercase-typing.html`) — 同上
- [ ] もぐらたたき (`games/mole/index.html`) — 30秒プレイ → スコア→トークン加算、タイマーが二重起動しない（連続スタート）
- [ ] フルーツキャッチ (`games/catch/index.html`) — キャッチ→トークン加算、ライフ0でゲームオーバー
- [ ] おえかき (`games/draw/index.html`) — 5ストローク以上描く→「できた！」でトークン+3、写真撮影/背景設定機能が動く
- [ ] ふくしゅう導線 (`games/rakugaku/index.html?mode=fb-review`) — 誤答復習セットが開く
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

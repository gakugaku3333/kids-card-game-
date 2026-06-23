/*
 * store.js — サイト共通のトークン経済モジュール（単一の真実）
 *
 * 全ページ（メインのギャラリー・カタカナ/さんすうクイズ・タイピング・神経衰弱）が
 * この window.Store を通じて同じトークン残高・所有アイテムを読み書きする。
 * localStorage キーはオリジン単位で共有されるため、パスに関係なく同じデータを参照する。
 *
 * 素の <script>（モジュール無し）で読み込む想定。file:// でも動作する。
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'katakana_game_data'; // 既存データ互換のためキー名は据え置き
    var DEFAULTS = { tokens: 0, totalCorrect: 0, totalAnswered: 0, ownedItems: [], avatar: { base: null, accessory: null, effect: null } };

    // ショップ商品の type を、着せ替えアバターのスロットへ対応づける
    var SLOT_OF = { avatar: 'base', badge: 'accessory', special: 'accessory', effect: 'effect' };

    // ショップ商品カタログ（rakugaku から移設した27品 + ゲーム）
    var SHOP_ITEMS = [
        { id: 'badge_gold', name: 'きんのバッジ', icon: '🥇', price: 30, type: 'badge' },
        { id: 'badge_silver', name: 'ぎんのバッジ', icon: '🥈', price: 20, type: 'badge' },
        { id: 'badge_bronze', name: 'どうのバッジ', icon: '🥉', price: 10, type: 'badge' },
        { id: 'avatar_cat', name: 'ねこアバター', icon: '🐱', price: 15, type: 'avatar' },
        { id: 'avatar_rabbit', name: 'うさぎアバター', icon: '🐰', price: 15, type: 'avatar' },
        { id: 'avatar_bear', name: 'くまアバター', icon: '🐻', price: 15, type: 'avatar' },
        { id: 'avatar_unicorn', name: 'ゆにこーん', icon: '🦄', price: 25, type: 'avatar' },
        { id: 'effect_rainbow', name: 'にじエフェクト', icon: '🌈', price: 20, type: 'effect' },
        { id: 'effect_sparkle', name: 'きらきら', icon: '✨', price: 20, type: 'effect' },
        { id: 'effect_heart', name: 'はーと', icon: '💕', price: 15, type: 'effect' },
        { id: 'crown', name: 'おうかん', icon: '👑', price: 50, type: 'special' },
        { id: 'trophy', name: 'トロフィー', icon: '🏆', price: 40, type: 'special' },
        { id: 'game_mole', name: 'もぐらたたき', icon: '🔨', price: 10, type: 'game' },
        { id: 'game_jump', name: 'うさぎジャンプ', icon: '🐰', price: 20, type: 'game' },
        { id: 'game_simon', name: 'ひかるボタン', icon: '🎹', price: 25, type: 'game' },
        { id: 'game_numbers', name: 'すうじタッチ', icon: '🔢', price: 20, type: 'game' },
        { id: 'game_dodge', name: 'よけろ！', icon: '☄️', price: 25, type: 'game' },
        { id: 'game_rps', name: 'じゃんけん', icon: '✌️', price: 15, type: 'game' },
        { id: 'game_balloon', name: 'ふうせんわり', icon: '🎈', price: 15, type: 'game' },
        { id: 'game_catch', name: 'フルーツキャッチ', icon: '🍎', price: 20, type: 'game' },
        { id: 'game_color', name: 'いろあわせ', icon: '🎨', price: 15, type: 'game' },
        { id: 'game_memory', name: 'しんけいすいじゃく', icon: '🃏', price: 25, type: 'game' },
        { id: 'game_click', name: 'クリッククリック', icon: '👆', price: 5, type: 'game' },
        { id: 'game_star', name: 'ほしあつめ', icon: '⭐', price: 18, type: 'game' },
        { id: 'game_bubble', name: 'バブルわり', icon: '🫧', price: 12, type: 'game' },
        { id: 'game_match3', name: 'えあわせ', icon: '🎯', price: 30, type: 'game' },
        { id: 'game_draw', name: 'おえかき', icon: '🖍️', price: 8, type: 'game' }
    ];

    function load() {
        var data = null;
        try {
            data = JSON.parse(localStorage.getItem(STORAGE_KEY));
        } catch (e) {
            data = null;
        }
        if (!data || typeof data !== 'object') data = {};
        var av = (data.avatar && typeof data.avatar === 'object') ? data.avatar : {};
        return {
            tokens: typeof data.tokens === 'number' ? data.tokens : 0,
            totalCorrect: typeof data.totalCorrect === 'number' ? data.totalCorrect : 0,
            totalAnswered: typeof data.totalAnswered === 'number' ? data.totalAnswered : 0,
            ownedItems: Array.isArray(data.ownedItems) ? data.ownedItems : [],
            avatar: {
                base: typeof av.base === 'string' ? av.base : null,
                accessory: typeof av.accessory === 'string' ? av.accessory : null,
                effect: typeof av.effect === 'string' ? av.effect : null
            }
        };
    }

    // ライブなデータオブジェクト。rakugaku の gameData はこれと同じ参照を共有する。
    var data = load();

    function save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        // 同一ページ内のトークン表示を自動更新するためのイベント
        try {
            document.dispatchEvent(new CustomEvent('tokens-changed', {
                detail: { tokens: data.tokens, ownedItems: data.ownedItems, avatar: data.avatar }
            }));
        } catch (e) { /* CustomEvent 非対応環境は無視 */ }
    }

    function addTokens(n) {
        data.tokens += n;
        save();
        return data.tokens;
    }

    function spendTokens(n) {
        if (data.tokens < n) return false;
        data.tokens -= n;
        save();
        return true;
    }

    function owns(id) {
        return data.ownedItems.indexOf(id) !== -1;
    }

    // 購入成功時は商品オブジェクトを、失敗時は false を返す
    function buy(id) {
        var item = null;
        for (var i = 0; i < SHOP_ITEMS.length; i++) {
            if (SHOP_ITEMS[i].id === id) { item = SHOP_ITEMS[i]; break; }
        }
        if (!item) return false;
        if (data.tokens >= item.price && !owns(id)) {
            data.tokens -= item.price;
            data.ownedItems.push(id);
            save();
            return item;
        }
        return false;
    }

    function recordAnswer(correct) {
        data.totalAnswered++;
        if (correct) data.totalCorrect++;
        save();
    }

    // アイテムIDから着せ替えスロット名を返す（不明なら null）
    function slotOf(id) {
        for (var i = 0; i < SHOP_ITEMS.length; i++) {
            if (SHOP_ITEMS[i].id === id) return SLOT_OF[SHOP_ITEMS[i].type] || null;
        }
        return null;
    }

    // スロットにアイテムを装備。id===null なら外す。
    // 所持済みかつスロットが一致するときのみ装備して true を返す。
    function equip(slot, id) {
        if (slot !== 'base' && slot !== 'accessory' && slot !== 'effect') return false;
        if (id === null) {
            data.avatar[slot] = null;
            save();
            return true;
        }
        if (owns(id) && slotOf(id) === slot) {
            data.avatar[slot] = id;
            save();
            return true;
        }
        return false;
    }

    window.Store = {
        STORAGE_KEY: STORAGE_KEY,
        SHOP_ITEMS: SHOP_ITEMS,
        getData: function () { return data; },        // ライブ参照（rakugaku 互換用）
        getTokens: function () { return data.tokens; },
        addTokens: addTokens,
        spendTokens: spendTokens,
        getOwned: function () { return data.ownedItems; },
        owns: owns,
        buy: buy,
        recordAnswer: recordAnswer,
        getAvatar: function () { return data.avatar; },
        slotOf: slotOf,
        equip: equip,
        save: save,
        reload: function () { data = load(); return data; }
    };
})();

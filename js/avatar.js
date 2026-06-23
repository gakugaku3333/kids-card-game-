/*
 * avatar.js — アバター合成描画 ＋ 着せ替えUI
 *
 * 買ったアイテム（ownedItems）を 3 スロット（ベース／かざり／エフェクト）に重ねて
 * 自分のアバターを着せ替えできる。状態は共通 Store（store.js）が保持する。
 * store.js の後・gallery.js の前に素の <script> で読み込む想定。file:// でも動作する。
 */
(function () {
    'use strict';

    // スロット定義（表示順・ラベル・対象 type）
    var SLOTS = [
        { slot: 'base', label: 'ベース', types: ['avatar'], hint: 'どうぶつアバターを ショップでゲットしてね！' },
        { slot: 'accessory', label: 'かざり', types: ['badge', 'special'], hint: 'バッジや おうかんを ショップでゲットしてね！' },
        { slot: 'effect', label: 'エフェクト', types: ['effect'], hint: 'キラキラエフェクトを ショップでゲットしてね！' }
    ];

    function pop() {
        if (typeof window.playPopSound === 'function') {
            try { window.playPopSound(); } catch (e) { /* noop */ }
        }
    }

    // アイテムIDから商品オブジェクトを取得（見つからなければ null）
    function itemById(id) {
        if (!id || !window.Store) return null;
        var items = Store.SHOP_ITEMS;
        for (var i = 0; i < items.length; i++) {
            if (items[i].id === id) return items[i];
        }
        return null;
    }

    function iconOf(id) {
        var item = itemById(id);
        return item ? item.icon : '';
    }

    /* ---- 合成アバターの描画（純粋な描画関数） ---- */
    // el に現在の装備からアバターを描く。opts.size = 'chip' | 'profile'
    window.renderAvatar = function (el, opts) {
        if (!el || !window.Store) return;
        opts = opts || {};
        var size = opts.size === 'profile' ? 'profile' : 'chip';
        var av = Store.getAvatar();

        var baseIcon = iconOf(av.base) || '👤';
        var accIcon = iconOf(av.accessory);
        var effItem = itemById(av.effect);
        var effClass = effItem ? ' effect-' + effItem.id.replace('effect_', '') : '';

        var html = '<div class="avatar-display avatar-' + size + '">';
        if (effItem) {
            html += '<span class="avatar-aura' + effClass + '" aria-hidden="true">' + effItem.icon + '</span>';
        }
        html += '<span class="avatar-base">' + baseIcon + '</span>';
        if (accIcon) {
            html += '<span class="avatar-accessory">' + accIcon + '</span>';
        }
        html += '</div>';
        el.innerHTML = html;
    };

    /* ---- 着せ替え画面の描画 ---- */
    window.renderDressUp = function (container) {
        if (!container || !window.Store) return;

        var nick = '';
        try {
            nick = (window.FireLog && FireLog.getSavedUser && FireLog.getSavedUser()) ||
                localStorage.getItem('kids_game_nickname') || '';
        } catch (e) { nick = ''; }

        var wrap = document.createElement('div');

        // プロフィールプレビュー
        var preview = document.createElement('div');
        preview.className = 'dressup-preview';
        var stage = document.createElement('div');
        stage.id = 'dressup-avatar';
        preview.appendChild(stage);
        if (nick) {
            var nameEl = document.createElement('div');
            nameEl.className = 'dressup-name';
            nameEl.textContent = nick;
            preview.appendChild(nameEl);
        }
        wrap.appendChild(preview);

        // 各スロットのセクション
        SLOTS.forEach(function (def) {
            var owned = Store.SHOP_ITEMS.filter(function (item) {
                return def.types.indexOf(item.type) !== -1 && Store.owns(item.id);
            });

            var section = document.createElement('div');
            section.className = 'dressup-section';

            var title = document.createElement('div');
            title.className = 'dressup-section-title';
            title.textContent = def.label;
            section.appendChild(title);

            if (owned.length === 0) {
                var hint = document.createElement('p');
                hint.className = 'dressup-hint';
                hint.textContent = def.hint;
                section.appendChild(hint);
                wrap.appendChild(section);
                return;
            }

            var row = document.createElement('div');
            row.className = 'dressup-options';

            // 「なし（はずす）」
            row.appendChild(makeOption(def.slot, null, 'なし', '🚫', container));
            // 所持アイテム
            owned.forEach(function (item) {
                row.appendChild(makeOption(def.slot, item.id, item.name, item.icon, container));
            });

            section.appendChild(row);
            wrap.appendChild(section);
        });

        container.innerHTML = '';
        container.appendChild(wrap);

        // プレビューを描画
        window.renderAvatar(document.getElementById('dressup-avatar'), { size: 'profile' });
    };

    // 1つの選択肢ボタンを生成
    function makeOption(slot, id, name, icon, container) {
        var av = Store.getAvatar();
        var selected = (av[slot] === id) || (id === null && !av[slot]);

        var btn = document.createElement('button');
        btn.className = 'dressup-option' + (selected ? ' selected' : '');
        btn.innerHTML =
            '<span class="dressup-option-icon">' + icon + '</span>' +
            '<span class="dressup-option-name">' + name + '</span>';
        btn.addEventListener('click', function () {
            Store.equip(slot, id);
            pop();
            window.renderDressUp(container); // プレビュー＋選択状態を再描画
        });
        return btn;
    }
})();

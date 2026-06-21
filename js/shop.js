/*
 * shop.js — 共通ショップUIレンダラ
 *
 * window.renderShop(container) でコンテナにショップ（けしょうアイテム）を描画する。
 * 購入は Store.buy() を経由するため、トークン残高は全ページで共有される。
 * メインページのモーダルから利用する。Store（store.js）に依存。
 */
(function () {
    'use strict';

    // 効果音（gallery.js の playPopSound があれば流用、無ければ無音）
    function pop() {
        if (typeof window.playPopSound === 'function') {
            try { window.playPopSound(); } catch (e) { /* noop */ }
        }
    }

    function showPurchasePopup(item) {
        var popup = document.createElement('div');
        popup.className = 'store-reward-popup';
        popup.innerHTML =
            '<h2 class="store-reward-title">🎉 ゲット！</h2>' +
            '<div class="store-reward-icon">' + item.icon + '</div>' +
            '<div class="store-reward-name">' + item.name + '</div>';
        document.body.appendChild(popup);
        createConfetti();
        pop();
        setTimeout(function () { popup.remove(); }, 1500);
    }

    function createConfetti() {
        var colors = ['#ff6b9d', '#c44569', '#f8b500', '#4bcffa', '#0fbcf9', '#7bed9f', '#ffa502'];
        for (var i = 0; i < 14; i++) {
            (function (n) {
                setTimeout(function () {
                    var c = document.createElement('div');
                    c.className = 'store-confetti';
                    c.style.left = (n / 14 * 100) + '%';
                    c.style.top = '-10px';
                    c.style.backgroundColor = colors[n % colors.length];
                    var size = 6 + (n % 4) * 3;
                    c.style.width = size + 'px';
                    c.style.height = size + 'px';
                    c.style.borderRadius = (n % 2 === 0) ? '50%' : '0';
                    document.body.appendChild(c);
                    setTimeout(function () { c.remove(); }, 3000);
                }, n * 30);
            })(i);
        }
    }

    // container にショップを描画。opts.types で表示する種別を絞れる（既定: ゲーム以外）
    window.renderShop = function (container, opts) {
        if (!container || !window.Store) return;
        opts = opts || {};
        var tokens = Store.getTokens();
        var items = Store.SHOP_ITEMS.filter(function (item) {
            if (opts.types) return opts.types.indexOf(item.type) !== -1;
            return item.type !== 'game'; // 既定はけしょうアイテムのみ（ミニゲームは rakugaku 内で）
        });

        container.innerHTML = '';
        items.forEach(function (item) {
            var owned = Store.owns(item.id);
            var div = document.createElement('div');
            div.className = 'shop-item' + (owned ? ' owned' : '');
            div.innerHTML =
                '<div class="shop-item-icon">' + item.icon + '</div>' +
                '<div class="shop-item-name">' + item.name + '</div>' +
                '<div class="shop-item-price">⭐ ' + item.price + '</div>';

            var btn = document.createElement('button');
            btn.className = 'buy-btn';
            if (owned) {
                btn.textContent = 'かいずみ';
                btn.disabled = true;
            } else {
                btn.textContent = 'かう';
                btn.disabled = tokens < item.price;
                btn.addEventListener('click', function () {
                    var bought = Store.buy(item.id);
                    if (bought) {
                        showPurchasePopup(bought);
                        setTimeout(function () { window.renderShop(container, opts); }, 1200);
                    }
                });
            }
            div.appendChild(btn);
            container.appendChild(div);
        });
    };
})();

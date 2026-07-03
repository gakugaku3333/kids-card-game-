/*
 * core/modal.js — 統一モーダルAPI
 *
 * `.g-modal` は `.active`、`.store-modal` は `.show` でトグルするという
 * クラス名の不統一（[[project-architecture]] の既知バグ源）を吸収する。
 * 呼び出し側は要素の種類を意識せず openModal/closeModal だけを使えばよい。
 */
'use strict';

const OPEN_CLASS_BY_TYPE = {
  'g-modal': 'active',
  'store-modal': 'show'
};

function openClassFor(el) {
  for (const type in OPEN_CLASS_BY_TYPE) {
    if (el.classList.contains(type)) return OPEN_CLASS_BY_TYPE[type];
  }
  return 'active';
}

export function openModal(el) {
  if (!el) return;
  el.classList.add(openClassFor(el));
}

export function closeModal(el) {
  if (!el) return;
  el.classList.remove(openClassFor(el));
}

export function isOpen(el) {
  if (!el) return false;
  return el.classList.contains(openClassFor(el));
}

// オーバーレイ（モーダル背景）タップで閉じる挙動をまとめて登録するヘルパー
export function closeOnOverlayClick(el) {
  if (!el) return;
  el.addEventListener('click', (e) => {
    if (e.target === el) closeModal(el);
  });
}

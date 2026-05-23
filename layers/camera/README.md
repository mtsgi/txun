# @txun/camera

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

**TxunOS** built-in camera app layer.

## 特徴

- MediaDevices API によるカメラデバイス一覧取得・切り替え
- ImageCapture API による詳細制御（ズーム・露出・フォーカス・ホワイトバランス・ISO・ライト）
- 対応 capabilities に応じてコントロール UI を動的表示
- ImageCapture 非対応ブラウザ（Firefox など）では canvas フォールバック撮影
- 撮影写真のブラウザダウンロード

## インストール

```bash
npm install @txun/core @txun/camera
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  extends: ['@txun/core', '@txun/camera']
})
```

## camera store

`@txun/core` に含まれる `useCameraStore` を利用して、他のアプリからもカメラ機能を呼び出せます。

```ts
const cameraStore = useCameraStore()

// デバイス列挙
await cameraStore.enumerateDevices()

// ストリーム開始
await cameraStore.startStream()

// 撮影
const url = await cameraStore.capturePhoto()
```

## ライセンス

[MIT](./LICENSE)

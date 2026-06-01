# @txun/screen-time

TxunOS のスクリーンタイムアプリレイヤーです。

## 機能

- アプリごとの使用時間計測（フォーカスウィンドウの計測）
- デスクトップ全体の使用時間集計
- 時間帯別・日別グラフ表示（直近 7 日）
- アプリごとの 1 日あたり使用制限設定とアラート
- 通知受信回数の記録
- IndexedDB による使用履歴の永続化

## 使用方法

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  extends: ['@txun/core', '@txun/screen-time']
})
```

## ライセンス

MIT

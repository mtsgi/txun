# @txun/music-player

TxunOS ビルトイン Music Player アプリレイヤー。

ローカルオーディオファイルの再生と Web Audio API によるリアルタイム周波数ビジュアライザーを提供します。

## 機能

- ローカル音声ファイルの再生（File API / ドラッグ&ドロップ）
- プレイリスト管理（追加・削除・クリック選択）
- 再生コントロール（再生/一時停止・前へ/次へ・シークバー・音量）
- 再生モード（シャッフル / リピートなし・1曲・全曲）
- リアルタイム周波数ビジュアライザー（Web Audio API + Canvas）

## インストール

```bash
npm install @txun/music-player
```

`nuxt.config.ts` の `extends` に追加:

```ts
export default defineNuxtConfig({
  extends: ['@txun/music-player']
})
```

## ライセンス

MIT

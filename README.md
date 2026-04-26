# TxunOS

[![Nuxt](https://img.shields.io/badge/Nuxt-4.x-00DC82?logo=nuxt&labelColor=020420)](https://nuxt.com)
[![Nuxt UI](https://img.shields.io/badge/Nuxt%20UI-4.x-00DC82?logo=nuxt&labelColor=020420)](https://ui.nuxt.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

**TxunOS** は Nuxt 4 SPA として構築した、ブラウザ上で動作する Web デスクトップ環境です。  
Nuxt UI / Nuxt Layers / Pinia / i18n などの Nuxt エコシステムをフル活用しています。

---

## 特徴

- ドラッグ・リサイズ可能なウィンドウ（8 方向スナップゾーン対応）
- 仮想デスクトップの追加・切替
- ビルトインアプリ: ファイルマネージャー・テキストエディタ・ブラウザ・ターミナル・設定
- 日本語 / 英語 i18n（`@nuxtjs/i18n`）
- ライト / ダーク テーマ（Nuxt UI カラーモード）
- IndexedDB による状態の永続化
- Nuxt Layers を使ったサードパーティアプリの追加

---

## ディレクトリ構成

```
txunos/
├── app/                        # エントリーポイント（pages, app.vue, app.config.ts）
├── layers/
│   ├── core/                   # デスクトップシェル・ウィンドウマネージャー・Pinia ストア
│   │   └── app/
│   │       ├── components/desktop/   # AppWindow, TaskBar, DesktopShell など
│   │       ├── composables/          # useWindowManager, useVirtualDesktop, useDesktopStorage
│   │       ├── stores/               # desktop.ts（Pinia）
│   │       └── utils/                # window-manager.ts（純粋関数 / ユニットテスト対象）
│   └── apps/                   # ビルトインアプリ
│       └── app/
│           ├── components/apps/      # SettingsApp, TextEditor, FileManager など
│           └── plugins/              # register-apps.ts（アプリ登録）
├── i18n/locales/               # ja.json / en.json
└── test/unit/                  # Vitest ユニットテスト
```

`layers/` 内のレイヤーは Nuxt 4 によって自動登録されます。  
優先順位: `app/` > `layers/apps/` > `layers/core/`

---

## セットアップ

```bash
npm install
npm run dev         # http://localhost:3000
```

ブラウザで `http://localhost:3000` を開くとデスクトップが起動します。

### コマンド一覧

| コマンド | 説明 |
|---|---|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | プロダクションビルド（静的 SPA） |
| `npm run preview` | ビルド結果のプレビュー |
| `npm run typecheck` | TypeScript 型チェック |
| `npm run lint` | ESLint |
| `npm run test:unit` | ユニットテスト（window-manager 純粋関数） |
| `npm run test:coverage` | カバレッジレポート生成 |

---

## アーキテクチャ概要

### 状態管理（Pinia）

`layers/core/app/stores/desktop.ts` がすべてのデスクトップ状態の単一ソースです。

| 状態 | 型 | 説明 |
|---|---|---|
| `windows` | `WindowState[]` | 開いているウィンドウ一覧 |
| `virtualDesktops` | `VirtualDesktop[]` | 仮想デスクトップ一覧 |
| `activeVirtualDesktopId` | `string` | 現在のデスクトップ ID |
| `apps` | `AppMeta[]` | 登録済みアプリ一覧 |
| `theme` | `'light' \| 'dark'` | 現在のテーマ |
| `locale` | `'ja' \| 'en'` | 現在の言語 |

### コンポーザブル

| コンポーザブル | 役割 |
|---|---|
| `useWindowManager` | ウィンドウ操作（CRUD・スナップ・`setTheme`・`setLocale`） |
| `useVirtualDesktop` | 仮想デスクトップの追加・削除・切替 |
| `useDesktopStorage` | IndexedDB への状態保存・読み込み |

### ウィンドウマネージャーユーティリティ

`layers/core/app/utils/window-manager.ts` は **純粋関数のみ**で構成（テスト対象）。

| 関数 | 説明 |
|---|---|
| `detectSnapZone` | カーソル位置からスナップゾーンを検出（8 方向 + 最大化） |
| `applySnapZone` | スナップゾーンに対応するウィンドウ座標を計算 |
| `clampPosition` | ウィンドウがはみ出さないよう座標を補正 |
| `cascadePosition` | 新規ウィンドウのカスケード初期位置を計算 |

---

## サードパーティアプリの開発

Nuxt Layer npm パッケージを作成し、`nuxt.config.ts` の `extends` に追加することでアプリを追加できます。

### 1. レイヤー構成

```
my-txunos-app/
├── nuxt.config.ts
└── app/
    ├── components/apps/
    │   └── MyApp.vue          # windowId: string プロップを受け取る
    └── plugins/
        └── register.ts        # useDesktopStore().registerApp() を呼ぶ
```

### 2. アプリコンポーネント

```vue
<!-- app/components/apps/MyApp.vue -->
<script setup lang="ts">
defineProps<{ windowId: string }>()
</script>

<template>
  <div class="p-4">マイアプリの内容</div>
</template>
```

### 3. 登録プラグイン

```ts
// app/plugins/register.ts
export default defineNuxtPlugin(() => {
  useDesktopStore().registerApp({
    id: 'my-app',
    name: 'マイアプリ',
    nameKey: 'myApp.name',
    icon: 'i-lucide-star',
    component: 'AppsMyApp',   // Nuxt auto-import 名（components/apps/MyApp.vue → AppsMyApp）
    defaultWidth: 640,
    defaultHeight: 480
  })
})
```

### 4. nuxt.config.ts に追加

```ts
export default defineNuxtConfig({
  extends: ['my-txunos-app']
})
```

---

## ライセンス

[MIT](./LICENSE)

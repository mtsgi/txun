# TxunOS

[![Nuxt](https://img.shields.io/badge/Nuxt-4.x-00DC82?logo=nuxt&labelColor=020420)](https://nuxt.com)
[![Nuxt UI](https://img.shields.io/badge/Nuxt%20UI-4.x-00DC82?logo=nuxt&labelColor=020420)](https://ui.nuxt.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

**TxunOS** は Nuxt 4 SPA で構築したブラウザデスクトップ環境です。

**@txun/core + 各アプリ独立レイヤー** の構成で、導入ユーザーが必要なアプリだけを選んで `extends` できる設計になっています。

## 特徴

- ドラッグ・リサイズ可能なウィンドウ（8 方向スナップゾーン）
- 仮想デスクトップの追加・切替
- Nuxt UI ベースのビルトインアプリ群
- 日本語 / 英語 i18n（`@nuxtjs/i18n`）
- ライト / ダークテーマ（Nuxt UI カラーモード）
- IndexedDB への状態保存
- File System Access API による作業ディレクトリ連携（Files / Terminal）
- Nuxt Layers による拡張しやすい構成

---

## パッケージ構成

TxunOS は以下の npm パッケージ単位で利用できます。

| パッケージ | 役割 |
|---|---|
| `@txun/core` | デスクトップシェル、ウィンドウ管理、Pinia ストア、core i18n |
| `@txun/settings` | 設定アプリ |
| `@txun/text-editor` | テキストエディタ |
| `@txun/file-manager` | ファイルマネージャー |
| `@txun/browser` | ブラウザ |
| `@txun/terminal` | ターミナル |
| `@txun/task-manager` | タスクマネージャー |
| `@txun/calculator` | 電卓 |
| `@txun/calendar` | カレンダー |
| `@txun/clock` | 時計 |
| `@txun/image-viewer` | 画像ビューア |
| `@txun/sticky-notes` | スティッキーノート |

各アプリレイヤーは `useDesktopStore().registerApp()` を自身のプラグインで実行し、`@txun/core` のストアに動的登録されます。

---

## 利用者向けセットアップ

### 最小構成（例: core + terminal）

```bash
npm install @txun/core @txun/terminal
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  extends: [
    '@txun/core',
    '@txun/terminal'
  ]
})
```

### フル構成（全ビルトインアプリ）

```bash
npm install @txun/core @txun/settings @txun/text-editor @txun/file-manager @txun/browser @txun/terminal @txun/task-manager @txun/calculator @txun/calendar @txun/clock @txun/image-viewer @txun/sticky-notes
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  extends: [
    '@txun/core',
    '@txun/settings',
    '@txun/text-editor',
    '@txun/file-manager',
    '@txun/browser',
    '@txun/terminal',
    '@txun/task-manager',
    '@txun/calculator',
    '@txun/calendar',
    '@txun/clock',
    '@txun/image-viewer',
    '@txun/sticky-notes'
  ]
})
```

`@txun/core` は必須です。各アプリは任意追加です。

---

## このリポジトリでの開発

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開くと起動します。

### コマンド一覧

| コマンド | 説明 |
|---|---|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | プロダクションビルド |
| `npm run preview` | ビルド結果のプレビュー |
| `npm run typecheck` | TypeScript 型チェック |
| `npm run lint` | ESLint |
| `npm run test:unit` | ユニットテスト |
| `npm run test:nuxt` | Nuxt 統合テスト |
| `npm run test:coverage` | カバレッジ生成 |
| `npm run pack:workspaces` | 各 workspace の npm pack dry-run |
| `npm run publish:workspaces` | dist-tag 戦略に従って各 workspace を npm publish |
| `npm run publish:workspaces:dry-run` | publish を dry-run で実行 |

### npm publish 手順（タグ戦略）

`npm run pack:workspaces` の結果を公開前ゲートとして扱い、各パッケージで次を確認します。

- `LICENSE` が同梱されている
- `README.md` が同梱されている
- `app/`, `i18n/`, `nuxt.config.ts`, `package.json` が同梱されている

#### dist-tag 戦略

| 条件 | 付与する dist-tag |
|---|---|
| stable 版（例: `1.2.0`） | `latest` |
| pre-release 版（例: `1.2.0-beta.1`） | `next` |
| 手動指定（canary / rc など） | `workflow_dispatch` の `dist_tag` 入力値 |

#### ローカル手順

```bash
# 1) 検証
npm run lint
npm run typecheck
npm run test:unit -- --run
npm run test:nuxt -- --run
npm run pack:workspaces

# 2) publish（stable 例）
NPM_DIST_TAG=latest npm run publish:workspaces

# 3) publish（pre-release 例）
NPM_DIST_TAG=next npm run publish:workspaces
```

#### CI 自動 publish

- ワークフロー: `.github/workflows/publish.yml`
- トリガー:
  - Git タグ push（`v*`）
  - 手動実行（`workflow_dispatch`）
- 必須シークレット: `NPM_TOKEN`（npm automation token）
- 実行順:
  - `lint` → `typecheck` → `test:unit` → `test:nuxt` → `pack:workspaces` → publish
  - publish は `@txun/core` → 各アプリの順序で処理

---

## リポジトリ構成

```text
txunos/
├── app/
├── layers/
│   ├── core/
│   ├── browser/
│   ├── calculator/
│   ├── calendar/
│   ├── clock/
│   ├── file-manager/
│   ├── image-viewer/
│   ├── settings/
│   ├── sticky-notes/
│   ├── task-manager/
│   ├── terminal/
│   └── text-editor/
└── test/
```

各レイヤーは `app/` を srcDir とする Nuxt 4 Layer です。

---

## アーキテクチャ概要

### 状態管理（Pinia）

`layers/core/app/stores/desktop.ts` が単一ソースです。

| 状態 | 型 | 説明 |
|---|---|---|
| `windows` | `WindowState[]` | 開いているウィンドウ |
| `virtualDesktops` | `VirtualDesktop[]` | 仮想デスクトップ |
| `apps` | `AppMeta[]` | 登録済みアプリ |
| `theme` | `'light' \| 'dark'` | テーマ |
| `locale` | `'ja' \| 'en'` | 言語 |

### 主要コンポーザブル

| コンポーザブル | 役割 |
|---|---|
| `useWindowManager` | ウィンドウ操作 + `setTheme` / `setLocale` 同期 |
| `useVirtualDesktop` | 仮想デスクトップ操作 |
| `useDesktopStorage` | IndexedDB 保存・復元 |
| `useFileSystem` | File System Access API のマウント管理と共通ファイル操作 |

### File System API 導線

- `Settings > File System` で作業ディレクトリを追加
- 追加したディレクトリは `Files` と `Terminal` で共通利用
- マウントハンドルは IndexedDB（structured clone）で復元
- 非対応ブラウザでは機能を無効化して案内表示

### ウィンドウ管理ユーティリティ

`layers/core/app/utils/window-manager.ts` は純粋関数のみで構成され、ユニットテスト対象です。

| 関数 | 説明 |
|---|---|
| `detectSnapZone` | スナップゾーン検出 |
| `applySnapZone` | スナップ適用後の境界計算 |
| `clampPosition` | 画面内に収める補正 |
| `cascadePosition` | 新規ウィンドウ初期配置 |

### i18n の分割方針

- core のキー: `core.desktop.*`
- アプリのキー: `apps.<appName>.*`
- 各アプリレイヤーは自身の `i18n/locales/` に必要なキーのみ保持

`@nuxtjs/i18n` により、`extends` したレイヤーのロケールは自動マージされます。

---

## TxunOS アプリ開発ガイド

以下は `@txun/my-app` のような独自アプリレイヤーを作る最小構成です。

### 1. レイヤー構成

```text
my-txun-app/
├── package.json
├── LICENSE
├── nuxt.config.ts
├── i18n/
│   └── locales/
│       ├── ja.json
│       └── en.json
└── app/
    ├── components/apps/
    │   └── MyApp.vue
    └── plugins/
        └── register-my-app.ts
```

### 2. アプリコンポーネント

```vue
<script setup lang="ts">
defineProps<{ windowId: string }>()
</script>

<template>
  <div class="p-4">
    My App
  </div>
</template>
```

### 3. 登録プラグイン

```ts
export default defineNuxtPlugin(() => {
  useDesktopStore().registerApp({
    id: 'my-app',
    name: 'My App',
    nameKey: 'apps.myApp.name',
    icon: 'i-lucide-star',
    component: 'AppsMyApp',
    defaultWidth: 640,
    defaultHeight: 480,
    category: 'utility'
  })
})
```

### 4. i18n

```json
{
  "apps": {
    "myApp": {
      "name": "My App"
    }
  }
}
```

### 5. nuxt.config.ts

```ts
export default defineNuxtConfig({
  $meta: {
    name: 'txunos-my-app',
    version: '1.0.0',
    description: 'TxunOS app layer - my-app'
  },
  components: [
    {
      path: './components/apps',
      global: true,
      prefix: 'Apps'
    }
  ],
  i18n: {
    locales: [
      { code: 'ja', file: 'ja.json', name: '日本語' },
      { code: 'en', file: 'en.json', name: 'English' }
    ]
  }
})
```

### 6. package.json（例）

```json
{
  "name": "@txun/my-app",
  "version": "1.0.0",
  "type": "module",
  "files": ["app", "i18n", "nuxt.config.ts"],
  "peerDependencies": {
    "@txun/core": "^1.0.0",
    "nuxt": "^4.4.2"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

### 7. 利用側で extends

```ts
export default defineNuxtConfig({
  extends: ['@txun/core', '@txun/my-app']
})
```

---

## 既存構成からの変更点

- 旧 `layers/apps`（一括レイヤー）は廃止
- 各アプリが独立レイヤーとして分離
- ルートは npm workspaces で複数パッケージを管理
- 各パッケージは `LICENSE`（MIT）を個別同梱

---

## ライセンス

[MIT](./LICENSE)

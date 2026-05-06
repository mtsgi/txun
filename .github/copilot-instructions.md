# TxunOS — 実装ガイド

このファイルはAgent向けのリポジトリカスタム指示です。

- IDE機能を活用してファイル内容やエラーの確認を行う
- 設計上の分岐がある場合はユーザーに質問しながら進める
- interfaceや関数には日本語JSDocコメントをつける
- 実装後は `README.md` も更新することを検討する

## レイヤー構成

ファイルは `layers/core/app/` または `layers/apps/app/` に配置します  
（Nuxt 4 レイヤーは `app/` を srcDir とするため）。

- `layers/core/` — デスクトップシェル・ウィンドウマネージャー・Pinia ストア
- `layers/apps/` — ビルトインアプリコンポーネントと登録プラグイン
- `app/` — メインエントリー（pages, app.vue, app.config.ts）

## コンポーネント規約

- **Nuxt UI コンポーネントを優先使用すること**（`UButton`, `UDropdownMenu`, `UContextMenu`, `UInput` など）。カスタム HTML 要素より Nuxt UI を選ぶ。
- コンポーネント名は Nuxt auto-import の命名規則に従う。ディレクトリ名がファイル名の先頭と重複する場合、Nuxt は自動的に縮約する。
  - 例: `components/desktop/AppWindow.vue` → `<DesktopAppWindow>`
  - 例: `components/desktop/DesktopShell.vue` → `<DesktopShell>`（`Desktop` が縮約される）
- アプリコンポーネントは `layers/apps/app/components/apps/` に配置し、`windowId: string` プロップを受け取る。
- ウィンドウアニメーションにはすべて `<Transition>` / `<TransitionGroup>` を使用すること。

## 状態管理（Pinia）

- **単一ソース**: `layers/core/app/stores/desktop.ts`（`useDesktopStore`）。
- `useWindowManager`、`useVirtualDesktop` はストアのアクションにサイドエフェクト（カラーモード同期・i18n ロケール同期）を加えたラッパー。
- `useWindowManager` は必ず `setTheme` と `setLocale` を公開すること（`SettingsApp` の型チェック要件）。
- `store.windows` や `store.virtualDesktops` の配列インデックスアクセスには `undefined` ガードが必要（`noUncheckedIndexedAccess` 前提）。
- `@pinia/nuxt` はレイヤーの `app/stores/` を自動スキャンしないため、`app/composables/stores.ts` で re-export して auto-import に乗せること。

## TypeScript 規約

- `noUncheckedIndexedAccess` が有効 — 配列インデックス読み取りには必ずガードを入れる。
- エクスポートする関数とストアアクションには明示的な戻り値型を書く。
- 型インポートは `import type { ... }` 構文を使う。
- `any` は使用禁止。型を絞れない場合は `unknown` + 型ナローイングを使う。

## i18n

- ロケールファイル: `i18n/locales/ja.json`、`i18n/locales/en.json`（`@nuxtjs/i18n` v10 は `i18n/locales/` を参照する）。
- テンプレートでは `$t('key')`、`<script setup>` では `t('key')` を使う。
- ユーザーに見える文字列はすべて i18n キーを通すこと（テンプレートにハードコードしない）。
- `store.locale` と `locale.value`（`useI18n`）は `useWindowManager.setLocale` を経由して同期すること。

## ウィンドウマネージャー

- `layers/core/app/utils/window-manager.ts` は**純粋関数のみ** — Vue/Nuxt のインポートは禁止。ユニットテスト対象。
- スナップゾーン検出閾値: 画面端から 24px。

## サードパーティアプリ（Nuxt Layers）

- 外部アプリは `nuxt.config.ts` の `extends` 配列で追加。
- アプリ登録は Nuxt プラグイン内で `useDesktopStore().registerApp(AppMeta)` を呼ぶ。
- `AppMeta.component` は Nuxt auto-import 名と一致させること（例: `'AppsMyApp'` → `components/apps/MyApp.vue`）。

## テスト

- ユニットテスト: `test/unit/`、`environment: 'node'` — 純粋ユーティリティ関数専用。
- Nuxt 統合テスト: `test/nuxt/` — コンポーザブルやコンポーネント用。
- 実行: `npm run test:unit`。

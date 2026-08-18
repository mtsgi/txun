# TxunOS — 実装ガイド

このファイルは Agent 向けのリポジトリカスタム指示です。  
Nuxt Layers の現行構成（core + 各アプリ独立レイヤー）を前提に、実装・検証・公開の基準を定義します。

## 基本方針

- IDE 機能（定義ジャンプ、Problems、型情報、エラー情報）を活用して調査する。
- 設計上の分岐や仕様不明点がある場合は、必ずユーザーに確認してから進める。
- interface / type / composable / store action / export 関数には日本語 JSDoc コメントを付ける。
- 実装後は README とガイド文書の差分整合を確認する。

## レイヤー / パッケージ構成

Nuxt 4 Layer は `app/` を srcDir として扱う。実装は以下に配置する。

- `layers/core/`
  - デスクトップシェル、ウィンドウ管理、Pinia ストア、core i18n
  - npm package: `@txun/core`
- `layers/<app>/`
  - 各ビルトインアプリの独立レイヤー（コンポーネント、register プラグイン、i18n）
  - npm package: `@txun/<app>`
- `app/`
  - メインエントリー（`app.vue`, `pages/`, `app.config.ts` など）

旧 `layers/apps`（一括レイヤー）は廃止済み。新規実装で復活させないこと。

## コンポーネント & Nuxt UI 規約

- **Nuxt UI コンポーネントを最優先で利用する**:
  - ネイティブ HTML タグの直接使用を避け、Nuxt UI のコンポーネント群を積極的に採用する。
    - **入力系**: `UInput`, `UTextarea`, `USelect`, `USwitch`, `UCheckbox`, `URadioGroup`
    - **アクション・オーバーレイ**: `UButton`, `UDropdownMenu`, `UContextMenu`, `UPopover`, `UTooltip`, `UModal`
    - **データ表示・ナビゲーション**: `UBadge`, `UKbd`, `UTabs`, `UProgress`, `USkeleton`, `UIcon`
  - カラー・バリアントは Nuxt UI のデザイントークン（`primary`, `neutral`, `error`, `warning` 等）および CSS 変数（`--ui-bg`, `--ui-text`, `--ui-border`）に統一する。
- **アイコン規約**:
  - アイコンはすべて Lucide アイコン（`i-lucide-*` プレフィックス）で統一する（例: `i-lucide-star`, `i-lucide-settings`, `i-lucide-panel-left`）。
- **アイコンのみボタン**:
  - ラベルなしの `UButton` は `aria-label` の付与を必須とし、パディングによる偏りを防ぐため中央揃え（`justify-content: center`）を適用する。
- **配置・命名規約**:
  - アプリコンポーネントは `layers/<app>/app/components/apps/` 直下に配置する。
    - 正: `components/apps/BrowserApp.vue`
    - 禁止: `components/apps/browser/BrowserApp.vue` のような深いネスト
  - アプリコンポーネントは `windowId: string` を props で受け取る。
  - ウィンドウ表示・一覧のアニメーションには `Transition` / `TransitionGroup` を使用する。
  - Auto-import 名は `prefix: 'Apps'` を前提に `AppMeta.component` と一致させる（例: `components/apps/MyApp.vue` → `AppsMyApp`）。

## レスポンシブ設計 & コンテナクエリ規約

- **OS 側とアプリ側の役割分担**:
  - **OS 側（`AppWindow.vue`）**: `.window-content` に `container-type: inline-size;` が標準で設定されており、各アプリコンポーネントは自身で `container-type` を二重宣言することなくコンテナクエリを利用できる。
  - **アプリ側（各 `*App.vue`）**: ウィンドウのリサイズや狭小化に追従するため、メディアクエリではなく **コンテナクエリ（`@container`）** を使用してレスポンシブスタイルを記述する。
  - **OS シェル側（`TaskBar.vue`, `DesktopShell.vue`, `VirtualDesktopOverview.vue` 等）**: デバイス全体の画面解像度に依存するため、**メディアクエリ（`@media (max-width: ...)`）** を使用する。
- **コンテナクエリの基準ブレークポイント**:
  - `@container (max-width: 520px)` または `@container (max-width: 480px)`:
    - 2 カラムや左右分割レイアウトを縦積み（スタック）に切り替える。
    - ツールバーやボタングループの補助テキストを非表示にしてアイコンのみ表示にする。
    - パディングやギャップをスリム化し、限られたウィンドウ領域でコンテンツの視認性を最大化する。

## アプリ登録規約

- 各アプリレイヤーに `app/plugins/register-<app>.ts` を置き、`useDesktopStore().registerApp()` を呼ぶ。
- `registerApp` に渡す `nameKey` は `apps.*` 名前空間を使う。
- 文字列の直接埋め込みを避け、UI 表示は i18n キー経由に統一する。

## 状態管理（Pinia）

- 単一ソースは `layers/core/app/stores/desktop.ts`（`useDesktopStore`）。
- `useWindowManager` と `useVirtualDesktop` はストアのラッパーとして副作用を集約する。
- `useWindowManager` は `setTheme` と `setLocale` を必ず公開する。
- `store.windows` / `store.virtualDesktops` の配列インデックス参照は `undefined` ガードを必須とする。
- `@pinia/nuxt` はレイヤーの `app/stores/` を自動スキャンしないため、`app/composables/stores.ts` で re-export する。

## TypeScript 規約

- `noUncheckedIndexedAccess` を前提に実装する。
- export する関数と store action は戻り値型を明示する。
- 型インポートは `import type` を使う。
- `any` は禁止。必要なら `unknown` を使って型ナローイングする。

## i18n 規約

- ロケールファイルは `i18n/locales/ja.json` と `i18n/locales/en.json`。
- テンプレートでは `$t('key')`、`script setup` では `t('key')` を使う。
- core のキーは `core.desktop.*`、アプリのキーは `apps.<appName>.*`。
- `store.locale` と `locale.value` は `useWindowManager.setLocale` を経由して同期する。

## ショートカット規約

- ショートカット登録は Nuxt UI の `defineShortcuts` を活用する。
- OS シェルのショートカット定義・デフォルト値・キー変換は `layers/core/app/composables/useShortcuts.ts`（`SHORTCUT_DEFINITIONS`, `DEFAULT_SHORTCUTS`, `toDefineShortcutKey`）に集約する。
- ショートカットの i18n キーは `core.desktop.shortcuts.*` に統一する。
- 設定変更時は `store.shortcuts` に保存し、IndexedDB（`useDesktopStorage`）で永続化する。

## 仮想デスクトップ & シェル UI 規約

- PC 時: Mission Control 形式（壁紙サムネイル、ミニウィンドウ、Exposé ウィンドウグリッド、ドラッグ移動）。
- モバイル時: iOS / Android 風スナップカルーセル（`scroll-snap-type: x mandatory`）、上スワイプによるウィンドウ閉じジェスチャー。
- タスクバー（`TaskBar.vue`）は `z-index: 10000;` とし、Overview（Task View）起動中も最前面で常時操作可能とする。
- ボタンコンポーネントでアイコンのみ・ラベルなしの場合は中央揃え（`justify-content: center`）を徹底する。

## クリップボード連携

- `useClipboardStore` により履歴保持、IndexedDB 永続化、ネイティブクリップボード同期および入力要素用コンテキストメニュー連携を行う。

## ウィンドウマネージャー

- `layers/core/app/utils/window-manager.ts` は純粋関数のみ。
- Vue / Nuxt 依存を持ち込まない（ユニットテスト対象のため）。

## バージョニング / ライセンス / 公開

- パッケージ公開対象は `@txun/core` と `@txun/<app>`。
- 初回公開基準バージョンは `1.0.0`。
- 変更時は以下を同時更新する。
  - `layers/<pkg>/package.json` の `version`
  - `layers/<pkg>/nuxt.config.ts` の `$meta.version`
  - 依存先の peerDependencies（例: `@txun/core`）
- 各パッケージ直下に `LICENSE`（MIT）を置く。
- `package.json` の `files` に公開対象ファイルが入っていることを確認する。
- 公開前チェック:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run test:unit -- --run`
  - `npm run test:nuxt -- --run`
  - `npm run pack:workspaces`
- `npm pack` で `README.md` と `LICENSE` が同梱されることを確認する。
- dist-tag 戦略:
  - stable（例: `1.2.0`）は `latest`
  - pre-release（例: `1.2.0-beta.1`）は `next`
  - 手動実行時は `NPM_DIST_TAG` で上書き可能（`canary`, `rc` など）
- CI 自動 publish は `.github/workflows/publish.yml` を使用し、`NPM_TOKEN` シークレットを必須とする。

## テスト方針

- ユニットテスト: `test/unit/`（純粋ユーティリティ中心、`environment: 'node'` または DOM が必要な場合は `// @vitest-environment happy-dom`）。
- Nuxt 統合テスト: `test/nuxt/`（コンポーザブル・コンポーネント）。
- 仕様変更時は既存テストの維持だけでなく、必要に応じてケース追加を検討する。

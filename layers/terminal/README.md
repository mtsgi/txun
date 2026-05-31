# @txun/terminal

TxunOS built-in Terminal app layer for Nuxt 4.

## Install

```bash
npm install @txun/core @txun/terminal
```

## Usage

```ts
export default defineNuxtConfig({
  extends: ['@txun/core', '@txun/terminal']
})
```

## What This Layer Provides

- App component: `app/components/apps/TerminalApp.vue`
- App registration plugin: `app/plugins/register-terminal.ts`
- Locale files: `i18n/locales/ja.json`, `i18n/locales/en.json`
- FileSystem-aware commands (`pwd`, `ls`, `cd`, `cat`, `mkdir`, `touch`, `rm`, `mv`, `cp`)

## Working Directory

`Settings > File System` で作業ディレクトリを追加すると、Terminal から実ファイル操作が可能になります。
マウントは `mounts` / `use` コマンドまたは上部セレクタから切り替えできます。

## Peer Dependencies

- @txun/core ^1.0.0
- nuxt ^4.4.2
- @nuxt/ui ^4.6.1
- @nuxtjs/i18n ^10.3.0

## License

MIT

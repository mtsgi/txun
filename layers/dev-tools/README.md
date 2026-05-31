# @txun/dev-tools

TxunOS built-in Developer Utilities app layer for Nuxt 4.

## Install

```bash
npm install @txun/core @txun/dev-tools
```

## Usage

```ts
export default defineNuxtConfig({
  extends: ['@txun/core', '@txun/dev-tools']
})
```

## What This Layer Provides

- App component: `app/components/apps/DevToolsApp.vue`
- App registration plugin: `app/plugins/register-dev-tools.ts`
- Locale files: `i18n/locales/ja.json`, `i18n/locales/en.json`

## Peer Dependencies

- @txun/core ^1.0.0
- nuxt ^4.4.2
- @nuxt/ui ^4.6.1
- @nuxtjs/i18n ^10.3.0

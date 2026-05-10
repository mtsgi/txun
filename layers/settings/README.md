# @txun/settings

TxunOS built-in Settings app layer for Nuxt 4.

## Install

```bash
npm install @txun/core @txun/settings
```

## Usage

```ts
export default defineNuxtConfig({
  extends: ['@txun/core', '@txun/settings']
})
```

## What This Layer Provides

- App component: `app/components/apps/SettingsApp.vue`
- App registration plugin: `app/plugins/register-settings.ts`
- Locale files: `i18n/locales/ja.json`, `i18n/locales/en.json`

## Peer Dependencies

- @txun/core ^1.0.0
- nuxt ^4.4.2
- @nuxt/ui ^4.6.1
- @nuxtjs/i18n ^10.3.0

## License

MIT

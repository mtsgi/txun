# @txun/sticky-notes

TxunOS built-in Sticky Notes app layer for Nuxt 4.

## Install

```bash
npm install @txun/core @txun/sticky-notes
```

## Usage

```ts
export default defineNuxtConfig({
  extends: ['@txun/core', '@txun/sticky-notes']
})
```

## What This Layer Provides

- App component: `app/components/apps/StickyNotes.vue`
- App registration plugin: `app/plugins/register-sticky-notes.ts`
- Locale files: `i18n/locales/ja.json`, `i18n/locales/en.json`

## Peer Dependencies

- @txun/core ^1.0.0
- nuxt ^4.4.2
- @nuxt/ui ^4.6.1
- @nuxtjs/i18n ^10.3.0

## License

MIT

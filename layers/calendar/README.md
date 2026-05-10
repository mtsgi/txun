# @txun/calendar

TxunOS built-in Calendar app layer for Nuxt 4.

## Install

```bash
npm install @txun/core @txun/calendar
```

## Usage

```ts
export default defineNuxtConfig({
  extends: ['@txun/core', '@txun/calendar']
})
```

## What This Layer Provides

- App component: `app/components/apps/CalendarApp.vue`
- App registration plugin: `app/plugins/register-calendar.ts`
- Locale files: `i18n/locales/ja.json`, `i18n/locales/en.json`

## Peer Dependencies

- @txun/core ^1.0.0
- nuxt ^4.4.2
- @nuxt/ui ^4.6.1
- @nuxtjs/i18n ^10.3.0

## License

MIT

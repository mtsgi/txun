# @txun/core

Core desktop shell layer for TxunOS (Nuxt 4).

## Install

```bash
npm install @txun/core
```

## Usage

```ts
export default defineNuxtConfig({
  extends: ['@txun/core']
})
```

## What This Layer Provides

- Desktop shell components and window management UI
- Pinia desktop store (`useDesktopStore`)
- Core composables for launcher, spotlight, storage, and window control
- Core i18n locale resources (`core.desktop.*`)

## Exports

- `@txun/core/stores/desktop`

## Peer Dependencies

- nuxt ^4.4.2
- @nuxt/ui ^4.6.1
- @nuxtjs/i18n ^10.3.0
- @pinia/nuxt ^0.11.3

## License

MIT

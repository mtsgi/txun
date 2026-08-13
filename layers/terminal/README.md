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

## Features
 
- **Modern Chat-style UI**: Designed with a premium chat-bubble conversational layout. Features:
  - User commands aligned to the right, system output bubbles aligned to the left.
  - Context menu (`UContextMenu`) actions: copy command/output, re-run, open output in system Text Editor, and delete from history.
  - Adaptive light/dark theme styling syncing with TxunOS.
  - Translucent glassmorphism background adapting to OS blur and opacity settings.
- **Commands**:
  - **File System**: `pwd`, `ls`, `cd`, `cat`, `mkdir`, `touch`, `rm`, `mv`, `cp` (accesses actual mounts).
  - **App & Window Management**: `apps` (list active windows), `open [appId] [filePath]` (launch desktop apps), `kill [windowId | appId]` (close windows), `exit` (close terminal window).
  - **Desktop Utility**: `notify [msg]` (send desktop notification).
- **Intelligent Autocomplete**:
  - Command autocomplete with localized descriptions.
  - Dynamic argument suggestions:
    - Lists installable apps for `open ` command.
    - Lists active window states for `kill ` command.
    - Lists active mounts for `use ` command.
    - Path-aware asynchronous autocompletion for files/directories (annotated with `📁` and `📄` icons) relative to the CWD or custom target paths.

## Working Directory

Manage mounts through `Settings > File System` in TxunOS to perform actual file system operations. Mounts can be switched dynamically using the selector dropdown in the UI or via the `mounts` and `use` commands.

## Peer Dependencies

- @txun/core ^1.0.0
- nuxt ^4.4.2
- @nuxt/ui ^4.6.1
- @nuxtjs/i18n ^10.3.0

## License

MIT

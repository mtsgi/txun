export default defineNuxtPlugin((nuxtApp) => {
  if (import.meta.server) return

  // Check standalone mode
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)

  setIsInstalled(isStandalone)

  // Service Worker Registration
  if ('serviceWorker' in navigator) {
    setIsPwaSupported(true)
    const { app } = useRuntimeConfig()
    const base = app.baseURL || '/'
    const swPath = `${base.endsWith('/') ? base : `${base}/`}sw.js`

    const registerSW = () => {
      navigator.serviceWorker.register(swPath, { scope: base })
        .then((reg) => {
          reg.addEventListener('updatefound', () => {
            const installingWorker = reg.installing
            if (installingWorker) {
              installingWorker.addEventListener('statechange', () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New version ready
                }
              })
            }
          })
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err)
        })
    }

    if (document.readyState === 'complete') {
      registerSW()
    } else {
      window.addEventListener('load', registerSW)
      setTimeout(registerSW, 1000)
    }
  }

  // Handle beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    setDeferredPrompt(e as BeforeInstallPromptEvent)
  })

  // Handle appinstalled
  window.addEventListener('appinstalled', () => {
    setIsInstalled(true)
    setDeferredPrompt(null)
  })

  // Handle URL launch parameters / Share Target / Shortcuts when app mounts
  nuxtApp.hook('app:mounted', () => {
    const desktopStore = useDesktopStore()
    const url = new URL(window.location.href)
    const appQuery = url.searchParams.get('app')
    const actionQuery = url.searchParams.get('action')

    // 1. App Shortcuts (?app=terminal, etc.)
    if (appQuery) {
      const app = desktopStore.apps.find(a => a.id === appQuery)
      if (app) {
        desktopStore.openWindow(app)
      }
    }

    // 2. Share Target (?action=share-target&title=...&text=...&url=...)
    if (actionQuery === 'share-target') {
      const title = url.searchParams.get('title') || ''
      const text = url.searchParams.get('text') || ''
      const sharedUrl = url.searchParams.get('url') || ''

      const content = [title, text, sharedUrl].filter(Boolean).join('\n\n')
      if (content) {
        const textEditorApp = desktopStore.apps.find(a => a.id === 'text-editor')
        if (textEditorApp) {
          desktopStore.openWindow(textEditorApp, {
            title: title || 'Shared Note',
            args: {
              content,
              filename: title ? `${title}.txt` : 'shared-note.txt'
            }
          })
        }
      }
    }

    // 3. File Handling API (window.launchQueue)
    const navLaunchQueue = (window as unknown as { launchQueue?: { setConsumer: (cb: (launchParams: { files: FileSystemFileHandle[] }) => Promise<void>) => void } }).launchQueue
    if (navLaunchQueue && typeof navLaunchQueue.setConsumer === 'function') {
      navLaunchQueue.setConsumer(async (launchParams) => {
        if (!launchParams.files || launchParams.files.length === 0) return

        for (const fileHandle of launchParams.files) {
          try {
            const file = await fileHandle.getFile()
            const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|bmp|ico|avif)$/i.test(file.name)

            if (isImage) {
              const blobUrl = URL.createObjectURL(file)
              const imageApp = desktopStore.apps.find(a => a.id === 'image-viewer')
              if (imageApp) {
                desktopStore.openWindow(imageApp, {
                  title: file.name,
                  args: {
                    blobUrl,
                    name: file.name
                  }
                })
              }
            } else {
              const content = await file.text()
              const textApp = desktopStore.apps.find(a => a.id === 'text-editor')
              if (textApp) {
                desktopStore.openWindow(textApp, {
                  title: file.name,
                  args: {
                    content,
                    filename: file.name
                  }
                })
              }
            }
          } catch (err) {
            console.error('[PWA] Failed to open launched file:', err)
          }
        }
      })
    }
  })
})

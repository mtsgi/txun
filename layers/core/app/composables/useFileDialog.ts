import { useFileDialogStore } from '../stores/file-dialog'

export function useFileDialog() {
  const store = useFileDialogStore()

  return {
    isOpen: computed(() => store.isOpen),
    title: computed(() => store.title),
    mode: computed(() => store.mode),
    filters: computed(() => store.filters),
    multiple: computed(() => store.multiple),
    cwd: computed(() => store.cwd),
    selectedPaths: computed(() => store.selectedPaths),
    fileNameInput: computed({
      get: () => store.fileNameInput,
      set: (val: string) => {
        store.fileNameInput = val
      }
    }),
    open: (options?: Parameters<typeof store.open>[0]) => store.open(options),
    confirm: (mountId: string) => store.confirm(mountId),
    cancel: () => store.cancel()
  }
}

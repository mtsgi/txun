export default defineNuxtPlugin(() => {
  const store = useDesktopStore()

  store.registerApp({
    id: 'calculator',
    name: 'Calculator',
    nameKey: 'apps.calculator.name',
    icon: 'i-lucide-calculator',
    color: 'rose',
    component: 'AppsCalculatorApp',
    defaultWidth: 320,
    defaultHeight: 480,
    category: 'utility'
  })
})

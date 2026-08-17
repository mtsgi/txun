import { useDesktopStorage } from './useDesktopStorage'

export interface CalendarEvent {
  id: string
  date: string
  title: string
  color: 'red' | 'blue' | 'green' | 'orange' | 'purple'
}

const STORAGE_KEY = 'calendar-events'

export function useCalendarEvents() {
  const { saveState, loadState } = useDesktopStorage()
  const events = useState<CalendarEvent[]>('calendar-events-state', () => [])
  const isLoaded = useState<boolean>('calendar-events-loaded', () => false)

  async function loadEvents(): Promise<CalendarEvent[]> {
    if (isLoaded.value) return events.value
    const saved = await loadState<CalendarEvent[]>(STORAGE_KEY)
    if (Array.isArray(saved)) {
      events.value = saved
    }
    isLoaded.value = true
    return events.value
  }

  async function persistEvents(): Promise<void> {
    await saveState(STORAGE_KEY, events.value)
  }

  async function addEvent(event: Omit<CalendarEvent, 'id'> & { id?: string }): Promise<CalendarEvent> {
    const newEvent: CalendarEvent = {
      id: event.id ?? crypto.randomUUID(),
      date: event.date,
      title: event.title,
      color: event.color ?? 'blue'
    }
    events.value.push(newEvent)
    await persistEvents()
    return newEvent
  }

  async function removeEvent(id: string): Promise<void> {
    events.value = events.value.filter(e => e.id !== id)
    await persistEvents()
  }

  function eventsOnDate(date: string): CalendarEvent[] {
    return events.value.filter(e => e.date === date)
  }

  function hasEventsOnDate(date: string): boolean {
    return events.value.some(e => e.date === date)
  }

  return {
    events,
    isLoaded,
    loadEvents,
    persistEvents,
    addEvent,
    removeEvent,
    eventsOnDate,
    hasEventsOnDate
  }
}

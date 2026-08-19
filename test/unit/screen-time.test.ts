import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { todayDateKey } from '../../layers/screen-time/app/stores/screenTime'

describe('todayDateKey', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns date in YYYY-MM-DD format', () => {
    const dateKey = todayDateKey()
    expect(dateKey).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('pads single-digit month and day with zeros', () => {
    // 2024-01-05 10:00:00 local time
    const date = new Date(2024, 0, 5, 10, 0, 0)
    vi.setSystemTime(date)

    expect(todayDateKey()).toBe('2024-01-05')
  })

  it('handles double-digit month and day correctly', () => {
    // 2024-11-25 15:30:00 local time
    const date = new Date(2024, 10, 25, 15, 30, 0)
    vi.setSystemTime(date)

    expect(todayDateKey()).toBe('2024-11-25')
  })
})

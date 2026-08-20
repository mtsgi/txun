import { describe, it, expect } from 'vitest'
import { emptyDailyRecord } from '../../layers/screen-time/app/stores/screenTime'

describe('screenTime utilities', () => {
  describe('emptyDailyRecord', () => {
    it('returns a correctly initialized empty DailyRecord', () => {
      const record = emptyDailyRecord()

      // Check scalar properties
      expect(record.totalSeconds).toBe(0)

      // Check object properties (should be empty objects)
      expect(record.apps).toEqual({})
      expect(record.notifications).toEqual({})

      // Check array property (should be 24 zeros)
      expect(record.hourly).toHaveLength(24)
      expect(record.hourly.every(h => h === 0)).toBe(true)

      // Ensure it is not sharing references for the hourly array across calls
      const record2 = emptyDailyRecord()
      expect(record.hourly).not.toBe(record2.hourly)
      expect(record.apps).not.toBe(record2.apps)
      expect(record.notifications).not.toBe(record2.notifications)
    })
  })
})

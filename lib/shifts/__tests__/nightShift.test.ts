import { NIGHT, nextSmontoTarget } from '../nightShift'

describe('NIGHT constant', () => {
  it('defines the night pair codes', () => {
    expect(NIGHT.start).toBe('N1')
    expect(NIGHT.smonto).toBe('N2')
  })
})

describe('nextSmontoTarget', () => {
  it('returns the next day in the same month mid-month', () => {
    expect(nextSmontoTarget(2026, 6, 15)).toEqual({ year: 2026, month: 6, day: 16 })
  })

  it('rolls to day 1 of next month on the last day (30-day month)', () => {
    expect(nextSmontoTarget(2026, 6, 30)).toEqual({ year: 2026, month: 7, day: 1 })
  })

  it('rolls to day 1 of next month on the last day (31-day month)', () => {
    expect(nextSmontoTarget(2026, 1, 31)).toEqual({ year: 2026, month: 2, day: 1 })
  })

  it('rolls to Jan 1 of next year on Dec 31', () => {
    expect(nextSmontoTarget(2026, 12, 31)).toEqual({ year: 2027, month: 1, day: 1 })
  })

  it('handles February in a non-leap year (28 days)', () => {
    expect(nextSmontoTarget(2026, 2, 28)).toEqual({ year: 2026, month: 3, day: 1 })
  })

  it('handles February in a leap year (29 days)', () => {
    expect(nextSmontoTarget(2028, 2, 28)).toEqual({ year: 2028, month: 2, day: 29 })
    expect(nextSmontoTarget(2028, 2, 29)).toEqual({ year: 2028, month: 3, day: 1 })
  })
})

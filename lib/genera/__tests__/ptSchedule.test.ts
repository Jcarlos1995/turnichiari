import { opposite, phaseForWeek, continueStartPhase, ptMonthSchedule, PT_WEEK_A, PT_WEEK_B } from '../ptSchedule'

describe('phase helpers', () => {
  it('opposite flips A/B', () => {
    expect(opposite('A')).toBe('B')
    expect(opposite('B')).toBe('A')
  })
  it('phaseForWeek alternates by week index', () => {
    expect(phaseForWeek('A', 0)).toBe('A')
    expect(phaseForWeek('A', 1)).toBe('B')
    expect(phaseForWeek('A', 2)).toBe('A')
    expect(phaseForWeek('B', 1)).toBe('A')
  })
  it('continueStartPhase continues the alternation across months', () => {
    // prev month started A and had 5 weeks → last week index 4 = A → this month starts B
    expect(continueStartPhase('A', 5)).toBe('B')
    // prev month started A and had 4 weeks → last week index 3 = B → this month starts A
    expect(continueStartPhase('A', 4)).toBe('A')
  })
})

describe('ptMonthSchedule', () => {
  it('applies week A on the first Mon-Sun week and alternates', () => {
    // Giugno 2026: 1 giugno = lunedì → settimana 0 piena = A
    const sched = ptMonthSchedule(2026, 6, 'A')
    // Lun 1 = A[0] = MP, Mar 2 = MP, Mer 3 = MP, Gio 4 = P2, Ven 5 = R, Sab 6 = R, Dom 7 = MP
    expect(sched[1]).toBe('MP')
    expect(sched[4]).toBe('P2')
    expect(sched[5]).toBe('R')
    expect(sched[7]).toBe('MP')
    // Settimana 1 (8-14) = B: Lun 8 = M1, Mar 9 = P2, Mer 10 = R
    expect(sched[8]).toBe('M1')
    expect(sched[9]).toBe('P2')
    expect(sched[10]).toBe('R')
  })

  it('starting on B inverts the weeks', () => {
    const sched = ptMonthSchedule(2026, 6, 'B')
    expect(sched[1]).toBe('M1') // week0 = B → Lun = M1
    expect(sched[8]).toBe('MP') // week1 = A → Lun = MP
  })

  it('uses exact pattern arrays', () => {
    expect(PT_WEEK_A).toEqual(['MP', 'MP', 'MP', 'P2', 'R', 'R', 'MP'])
    expect(PT_WEEK_B).toEqual(['M1', 'P2', 'R', 'MP', 'MP', 'MP', 'R'])
  })
})

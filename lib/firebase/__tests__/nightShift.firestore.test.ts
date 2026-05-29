// Mock the firebase config so importing firestore.ts does NOT initialize a real app.
jest.mock('@/lib/firebase/config', () => ({ db: {} }))

const mockSet = jest.fn()
const mockCommit = jest.fn().mockResolvedValue(undefined)

// Mock the Firebase SDK. `doc` returns a string path so we can assert on it.
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_db: unknown, ...path: string[]) => path.join('/')),
  writeBatch: jest.fn(() => ({ set: mockSet, commit: mockCommit })),
  deleteField: jest.fn(() => '__DELETE__'),
  // Other named exports referenced by firestore.ts at import time:
  getDoc: jest.fn(), setDoc: jest.fn(), getDocs: jest.fn(),
  collection: jest.fn(), query: jest.fn(), where: jest.fn(),
  orderBy: jest.fn(), onSnapshot: jest.fn(),
}))

import { setNightShift, clearNightSmonto } from '../firestore'

describe('setNightShift', () => {
  beforeEach(() => { mockSet.mockClear(); mockCommit.mockClear() })

  it('writes N1 and N2 on consecutive days in the same month', async () => {
    await setNightShift('nucleo-b', 2026, 6, 15, 'op1', 'uid1', false)
    expect(mockSet).toHaveBeenCalledTimes(2)
    expect(mockSet).toHaveBeenNthCalledWith(
      1,
      'nuclei/nucleo-b/matrice/2026-06',
      { op1: { 15: expect.objectContaining({ code: 'N1', updatedBy: 'uid1', isManualOverride: false }) } },
      { merge: true }
    )
    expect(mockSet).toHaveBeenNthCalledWith(
      2,
      'nuclei/nucleo-b/matrice/2026-06',
      { op1: { 16: expect.objectContaining({ code: 'N2', updatedBy: 'uid1', isManualOverride: false }) } },
      { merge: true }
    )
    expect(mockCommit).toHaveBeenCalledTimes(1)
  })

  it('writes N2 into the next month when N1 is on the last day', async () => {
    await setNightShift('nucleo-b', 2026, 6, 30, 'op1', 'uid1', true)
    expect(mockSet).toHaveBeenNthCalledWith(
      1,
      'nuclei/nucleo-b/matrice/2026-06',
      { op1: { 30: expect.objectContaining({ code: 'N1', isManualOverride: true }) } },
      { merge: true }
    )
    expect(mockSet).toHaveBeenNthCalledWith(
      2,
      'nuclei/nucleo-b/matrice/2026-07',
      { op1: { 1: expect.objectContaining({ code: 'N2', isManualOverride: true }) } },
      { merge: true }
    )
  })
})

describe('clearNightSmonto', () => {
  beforeEach(() => { mockSet.mockClear(); mockCommit.mockClear() })

  it('deletes the smonto cell on the next day', async () => {
    await clearNightSmonto('nucleo-b', 2026, 6, 15, 'op1')
    expect(mockSet).toHaveBeenCalledWith(
      'nuclei/nucleo-b/matrice/2026-06',
      { op1: { 16: '__DELETE__' } },
      { merge: true }
    )
    expect(mockCommit).toHaveBeenCalledTimes(1)
  })

  it('deletes the smonto in the next month when N1 is on the last day', async () => {
    await clearNightSmonto('nucleo-b', 2026, 12, 31, 'op1')
    expect(mockSet).toHaveBeenCalledWith(
      'nuclei/nucleo-b/matrice/2027-01',
      { op1: { 1: '__DELETE__' } },
      { merge: true }
    )
  })
})

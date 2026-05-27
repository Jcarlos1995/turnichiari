import { renderHook, act } from '@testing-library/react'

jest.mock('@/lib/firebase/firestore', () => ({
  subscribeMatrice: jest.fn(),
  getOperators: jest.fn().mockResolvedValue([
    { id: 'op1', name: 'Marco Rossi', nucleoId: 'nucleo-b', contractType: 'standard', active: true }
  ]),
}))

import { useMatrice } from '@/hooks/useMatrice'
import { subscribeMatrice } from '@/lib/firebase/firestore'

const mockSubscribe = subscribeMatrice as jest.Mock

describe('useMatrice', () => {
  beforeEach(() => {
    mockSubscribe.mockReset()
  })

  it('calls subscribeMatrice with correct params', () => {
    mockSubscribe.mockReturnValue(() => {})
    renderHook(() => useMatrice('nucleo-b', '2026-06'))
    expect(mockSubscribe).toHaveBeenCalledWith('nucleo-b', '2026-06', expect.any(Function))
  })

  it('returns matrice data from subscription callback', () => {
    let capturedCallback: (data: any) => void = () => {}
    mockSubscribe.mockImplementation((_n: string, _m: string, cb: (data: any) => void) => {
      capturedCallback = cb
      return () => {}
    })

    const { result } = renderHook(() => useMatrice('nucleo-b', '2026-06'))
    act(() => capturedCallback({ op1: { 1: { code: 'M1' } } }))
    expect(result.current.matrice).toEqual({ op1: { 1: { code: 'M1' } } })
  })
})

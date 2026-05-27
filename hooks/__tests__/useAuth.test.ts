import { renderHook } from '@testing-library/react'
import { useAuth } from '@/hooks/useAuth'

// Mock the firebase/auth module to avoid needing a real Firebase connection
jest.mock('@/lib/firebase/auth', () => ({
  auth: { currentUser: null },
  onAuthStateChanged: jest.fn(() => () => {}),
  getUserProfile: jest.fn(),
}))

describe('useAuth', () => {
  it('returns loading true initially', () => {
    const { result } = renderHook(() => useAuth())
    expect(result.current.loading).toBe(true)
    expect(result.current.user).toBeNull()
  })
})

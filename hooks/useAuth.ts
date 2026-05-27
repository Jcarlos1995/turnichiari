import { useState, useEffect } from 'react'
import { auth, onAuthStateChanged, getUserProfile } from '@/lib/firebase/auth'
import type { AppUser } from '@/lib/types'

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await getUserProfile(firebaseUser.uid)
        if (active) { setUser(profile); setLoading(false) }
      } else {
        if (active) { setUser(null); setLoading(false) }
      }
    })
    return () => { active = false; unsubscribe() }
  }, [])

  return { user, loading }
}

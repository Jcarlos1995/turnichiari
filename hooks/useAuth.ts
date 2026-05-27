'use client'
import { useState, useEffect } from 'react'
import { auth, onAuthStateChanged, getUserProfile } from '@/lib/firebase/auth'
import type { AppUser } from '@/lib/types'

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await getUserProfile(firebaseUser.uid)
        setUser(profile)
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  return { user, loading }
}

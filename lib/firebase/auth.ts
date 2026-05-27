import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './config'
import type { AppUser, UserRole } from '@/lib/types'

const VALID_ROLES: UserRole[] = ['coordinatrice', 'raa', 'oss']

export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password)
}

export async function signOut() {
  return firebaseSignOut(auth)
}

export async function getUserProfile(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  const data = snap.data()
  if (!data.role || !data.name || !data.email) return null
  if (!VALID_ROLES.includes(data.role as UserRole)) return null
  return { uid, email: data.email, name: data.name, role: data.role as UserRole, nucleoId: data.nucleoId ?? null }
}

export { onAuthStateChanged, auth }

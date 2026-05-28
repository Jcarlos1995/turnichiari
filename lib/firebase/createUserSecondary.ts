import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { firebaseConfig } from './config'

/**
 * Creates a Firebase Auth account using a temporary secondary app instance,
 * so the current user session (RAA/Coordinatrice) is NOT affected.
 *
 * Returns the new user's uid on success.
 * Throws the original Firebase error on failure (including auth/email-already-in-use).
 */
export async function createAuthUserSecondary(email: string, password: string): Promise<string> {
  const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`)
  try {
    const secondaryAuth = getAuth(secondaryApp)
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    return cred.user.uid
  } finally {
    await deleteApp(secondaryApp)
  }
}

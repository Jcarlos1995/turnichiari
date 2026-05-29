import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, getFirestore } from 'firebase/firestore'

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

const isFirstInit = getApps().length === 0
const app = isFirstInit ? initializeApp(firebaseConfig) : getApps()[0]

export const auth = getAuth(app)

// ignoreUndefinedProperties: Firestore rifiuta i valori `undefined` di default,
// il che faceva fallire silenziosamente la scrittura di una cella della matrice
// (note/originalCode opzionali → undefined). Con questa opzione i campi undefined
// vengono semplicemente omessi. initializeFirestore va chiamato una sola volta
// per app, quindi facciamo fallback a getFirestore se l'app esisteva già.
export const db = isFirstInit
  ? initializeFirestore(app, { ignoreUndefinedProperties: true })
  : getFirestore(app)
export default app

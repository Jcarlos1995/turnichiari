// Run: npx ts-node --project tsconfig.json scripts/seed-emulator.ts
// Requires: Firebase Auth Emulator on port 9099, Firestore Emulator on port 8080

import { initializeApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, setDoc, doc, connectFirestoreEmulator } from 'firebase/firestore'

const app = initializeApp({
  projectId: 'turnisgb',
  apiKey: 'fake-api-key-for-emulator',
  authDomain: 'localhost',
})

const auth = getAuth(app)
const db = getFirestore(app)

connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
connectFirestoreEmulator(db, 'localhost', 8080)

const SHIFT_TYPES = [
  { code: 'M1', label: 'Mattina 1', startTime: '06:30', endTime: '13:30', color: '#fef3c7', operatorsPerDay: 2, isPartTime: false, isSystem: false },
  { code: 'M2', label: 'Mattina 2', startTime: '07:00', endTime: '14:00', color: '#fde68a', operatorsPerDay: 1, isPartTime: false, isSystem: false },
  { code: 'MP', label: 'Mattina PT', startTime: '07:00', endTime: '12:00', color: '#fef9c3', operatorsPerDay: 1, isPartTime: true,  isSystem: false },
  { code: 'P1', label: 'Pomeriggio 1', startTime: '14:00', endTime: '21:00', color: '#fed7aa', operatorsPerDay: 1, isPartTime: false, isSystem: false },
  { code: 'P2', label: 'Pomeriggio 2', startTime: '14:30', endTime: '21:00', color: '#ffedd5', operatorsPerDay: 2, isPartTime: false, isSystem: false },
  { code: 'N',  label: 'Notte', startTime: '21:00', endTime: '06:30', color: '#e0e7ff', operatorsPerDay: 1, isPartTime: false, isSystem: false },
]

const OSS_NAMES = [
  'Marco Rossi', 'Giulia Russo', 'Sara Tavella',
  'Luca Bianchi', 'Anna Ferrara', 'Mario Conti',
  'Elena Ricci', 'Roberto Moretti',
]

async function createUser(email: string, password: string, profile: object) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await setDoc(doc(db, 'users', cred.user.uid), profile)
  return cred.user.uid
}

async function seed() {
  console.log('Seeding emulator...')

  // RAA for Nucleo B
  const raaUid = await createUser('raa-b@sgb.it', 'password123', {
    name: 'Maria Verdi', role: 'raa', nucleoId: 'nucleo-b', email: 'raa-b@sgb.it'
  })

  // Coordinatrice
  await createUser('coord@sgb.it', 'password123', {
    name: 'Anna Bianchi', role: 'coordinatrice', nucleoId: null, email: 'coord@sgb.it'
  })

  // Nucleo B document
  await setDoc(doc(db, 'nuclei', 'nucleo-b'), {
    name: 'Nucleo B',
    raaId: raaUid,
    shiftTypes: SHIFT_TYPES,
  })

  // OSS operators
  for (const name of OSS_NAMES) {
    const email = name.toLowerCase().replace(/ /g, '.') + '@sgb.it'
    const uid = await createUser(email, 'password123', {
      name, role: 'oss', nucleoId: 'nucleo-b', email
    })
    await setDoc(doc(db, 'nuclei', 'nucleo-b', 'operators', uid), {
      name, nucleoId: 'nucleo-b', contractType: 'standard', active: true
    })
  }

  console.log('✅ Seed complete!')
  console.log('  RAA login:          raa-b@sgb.it / password123')
  console.log('  Coordinatrice:      coord@sgb.it / password123')
  console.log('  OSS login example:  marco.rossi@sgb.it / password123')
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1) })

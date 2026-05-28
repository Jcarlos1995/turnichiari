// Seed script for PRODUCTION Firebase project: turnichiari-79193
// Uses Firebase Admin SDK with service account for full admin access.
//
// Run:
//   npx ts-node --project tsconfig.json scripts/seed-production.ts
//
// Prerequisites:
//   - serviceAccount.json must exist at ../serviceAccount.json (one level up, gitignored)
//   - firebase-admin installed (npm install --save-dev firebase-admin)
//
// ⚠️  This script is IDEMPOTENT for Firestore docs (setDoc with merge).
//     For Auth users it will skip if email already exists.
//     Delete serviceAccount.json after use!

import * as admin from 'firebase-admin'
import * as path from 'path'
import * as fs from 'fs'

// ── Service account ──────────────────────────────────────────────────────────
const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '..', '..', 'serviceAccount.json')

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(`❌ serviceAccount.json not found at: ${SERVICE_ACCOUNT_PATH}`)
  process.exit(1)
}

admin.initializeApp({
  credential: admin.credential.cert(SERVICE_ACCOUNT_PATH),
})

const auth = admin.auth()
const db   = admin.firestore()

// ── Shift types (Nucleo B) ────────────────────────────────────────────────────
const SHIFT_TYPES = [
  { code: 'M1', label: 'Mattina 1',    startTime: '06:30', endTime: '13:30', color: '#fef3c7', operatorsPerDay: 2, isPartTime: false, isSystem: false },
  { code: 'M2', label: 'Mattina 2',    startTime: '07:00', endTime: '14:00', color: '#fde68a', operatorsPerDay: 1, isPartTime: false, isSystem: false },
  { code: 'MP', label: 'Mattina PT',   startTime: '07:00', endTime: '12:00', color: '#fef9c3', operatorsPerDay: 1, isPartTime: true,  isSystem: false },
  { code: 'P1', label: 'Pomeriggio 1', startTime: '14:00', endTime: '21:00', color: '#fed7aa', operatorsPerDay: 1, isPartTime: false, isSystem: false },
  { code: 'P2', label: 'Pomeriggio 2', startTime: '14:30', endTime: '21:00', color: '#ffedd5', operatorsPerDay: 2, isPartTime: false, isSystem: false },
  { code: 'N1', label: 'Notte 1',       startTime: '21:00', endTime: '00:00', color: '#dbeafe', operatorsPerDay: 1, isPartTime: false, isSystem: false },
  { code: 'N2', label: 'Notte 2',       startTime: '00:00', endTime: '06:30', color: '#bfdbfe', operatorsPerDay: 1, isPartTime: false, isSystem: false },
]

// ── OSS operators for Nucleo B (13 total) ─────────────────────────────────────
// Real names left blank — using placeholders. RAA can rename from the app later.
const OSS_LIST = [
  { name: 'Operatore OSS 1',  email: 'oss01.nucleob@turnichiari.it' },
  { name: 'Operatore OSS 2',  email: 'oss02.nucleob@turnichiari.it' },
  { name: 'Operatore OSS 3',  email: 'oss03.nucleob@turnichiari.it' },
  { name: 'Operatore OSS 4',  email: 'oss04.nucleob@turnichiari.it' },
  { name: 'Operatore OSS 5',  email: 'oss05.nucleob@turnichiari.it' },
  { name: 'Operatore OSS 6',  email: 'oss06.nucleob@turnichiari.it' },
  { name: 'Operatore OSS 7',  email: 'oss07.nucleob@turnichiari.it' },
  { name: 'Operatore OSS 8',  email: 'oss08.nucleob@turnichiari.it' },
  { name: 'Operatore OSS 9',  email: 'oss09.nucleob@turnichiari.it' },
  { name: 'Operatore OSS 10', email: 'oss10.nucleob@turnichiari.it' },
  { name: 'Operatore OSS 11', email: 'oss11.nucleob@turnichiari.it' },
  { name: 'Operatore OSS 12', email: 'oss12.nucleob@turnichiari.it' },
  { name: 'Operatore OSS 13', email: 'oss13.nucleob@turnichiari.it' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getOrCreateAuthUser(
  email: string,
  displayName: string,
  tempPassword: string
): Promise<string> {
  try {
    const existing = await auth.getUserByEmail(email)
    console.log(`  ↩  Auth user already exists: ${email}`)
    return existing.uid
  } catch {
    const user = await auth.createUser({ email, displayName, password: tempPassword })
    console.log(`  ✓  Auth user created: ${email}`)
    return user.uid
  }
}

// ── Main seed ─────────────────────────────────────────────────────────────────
async function seed() {
  console.log('\n🌱  Seeding PRODUCTION — turnichiari-79193\n')

  // ── 1. Coordinatrice (Elena Lonardelli)
  console.log('── Coordinatrice ──')
  const coordUid = await getOrCreateAuthUser('coord@sgb.it', 'Elena Lonardelli', 'CambiaPasswordSubito!1')
  await db.collection('users').doc(coordUid).set({
    name: 'Elena Lonardelli',
    email: 'coord@sgb.it',
    role: 'coordinatrice',
    nucleoId: null,
  }, { merge: true })
  console.log(`  ✓  Firestore users/${coordUid} set`)

  // ── 2. RAA Nucleo B
  console.log('\n── RAA Nucleo B ──')
  const raaUid = await getOrCreateAuthUser('raa.nucleob@turnichiari.it', 'RAA Nucleo B', 'CambiaPasswordSubito!1')
  await db.collection('users').doc(raaUid).set({
    name: 'RAA Nucleo B',
    email: 'raa.nucleob@turnichiari.it',
    role: 'raa',
    nucleoId: 'nucleo-b',
  }, { merge: true })
  console.log(`  ✓  Firestore users/${raaUid} set`)

  // ── 3. Nucleo B document
  console.log('\n── Nucleo B ──')
  await db.collection('nuclei').doc('nucleo-b').set({
    name: 'Nucleo B',
    raaId: raaUid,
    shiftTypes: SHIFT_TYPES,
  }, { merge: true })
  console.log('  ✓  nuclei/nucleo-b set')

  // ── 4. OSS operators
  console.log('\n── OSS Operators ──')
  for (const oss of OSS_LIST) {
    const uid = await getOrCreateAuthUser(oss.email, oss.name, 'CambiaPasswordSubito!1')
    await db.collection('users').doc(uid).set({
      name: oss.name,
      email: oss.email,
      role: 'oss',
      nucleoId: 'nucleo-b',
    }, { merge: true })
    await db.collection('nuclei').doc('nucleo-b').collection('operators').doc(uid).set({
      name: oss.name,
      nucleoId: 'nucleo-b',
      contractType: 'standard',
      active: true,
    }, { merge: true })
    console.log(`  ✓  ${oss.name}`)
  }

  // ── Summary
  console.log('\n✅  Seed complete!\n')
  console.log('  Coordinatrice:  coord@sgb.it  /  CambiaPasswordSubito!1')
  console.log('  RAA Nucleo B:   raa.nucleob@turnichiari.it  /  CambiaPasswordSubito!1')
  console.log('  OSS 1-13:       oss01.nucleob@... – oss13.nucleob@...  /  CambiaPasswordSubito!1')
  console.log('\n⚠️   Ricorda: fai cambiare le password a tutti gli utenti al primo accesso!')
  console.log('⚠️   Elimina serviceAccount.json adesso!\n')
}

seed()
  .then(() => process.exit(0))
  .catch(err => { console.error('\n❌  Seed failed:', err); process.exit(1) })

// Script para eliminar los 13 operadores ficticios de producción.
// Borra: cuenta Firebase Auth + users/{uid} + nuclei/nucleo-b/operators/{uid}
//
// Run:
//   npx ts-node --project tsconfig.json scripts/delete-ficticios.ts
//
// Prerequisites:
//   - serviceAccount.json debe estar en ../serviceAccount.json (un nivel arriba, gitignored)
//
// ⚠️  IRREVERSIBLE — los datos y cuentas quedan eliminados permanentemente.
//    Elimina serviceAccount.json después de ejecutar!

import * as admin from 'firebase-admin'
import * as path from 'path'
import * as fs from 'fs'

const SERVICE_ACCOUNT_PATH = path.resolve(__dirname, '..', '..', 'serviceAccount.json')

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(`❌ serviceAccount.json no encontrado en: ${SERVICE_ACCOUNT_PATH}`)
  process.exit(1)
}

admin.initializeApp({
  credential: admin.credential.cert(SERVICE_ACCOUNT_PATH),
})

const auth = admin.auth()
const db   = admin.firestore()

const FICTICIOS_EMAILS = [
  'oss01.nucleob@turnichiari.it',
  'oss02.nucleob@turnichiari.it',
  'oss03.nucleob@turnichiari.it',
  'oss04.nucleob@turnichiari.it',
  'oss05.nucleob@turnichiari.it',
  'oss06.nucleob@turnichiari.it',
  'oss07.nucleob@turnichiari.it',
  'oss08.nucleob@turnichiari.it',
  'oss09.nucleob@turnichiari.it',
  'oss10.nucleob@turnichiari.it',
  'oss11.nucleob@turnichiari.it',
  'oss12.nucleob@turnichiari.it',
  'oss13.nucleob@turnichiari.it',
]

async function deleteOperador(email: string) {
  // 1. Buscar uid por email
  let uid: string
  try {
    const user = await auth.getUserByEmail(email)
    uid = user.uid
  } catch {
    console.log(`  ⚠️  Auth user no encontrado: ${email} (ya eliminado?)`)
    return
  }

  // 2. Eliminar cuenta Auth
  await auth.deleteUser(uid)
  console.log(`  ✓  Auth eliminado: ${email} (uid: ${uid})`)

  // 3. Eliminar users/{uid}
  await db.collection('users').doc(uid).delete()
  console.log(`  ✓  users/${uid} eliminado`)

  // 4. Eliminar nuclei/nucleo-b/operators/{uid}
  await db.collection('nuclei').doc('nucleo-b').collection('operators').doc(uid).delete()
  console.log(`  ✓  nuclei/nucleo-b/operators/${uid} eliminado`)
}

async function run() {
  console.log('\n🗑️  Eliminando operadores ficticios — turnichiari-79193\n')

  for (const email of FICTICIOS_EMAILS) {
    console.log(`\n── ${email}`)
    await deleteOperador(email)
  }

  console.log('\n✅  Listo! Los 13 operadores ficticios han sido eliminados.')
  console.log('\n⚠️  Elimina serviceAccount.json ahora!\n')
}

run()
  .then(() => process.exit(0))
  .catch(err => { console.error('\n❌  Error:', err); process.exit(1) })

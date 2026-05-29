// Script para BORRAR todos los documentos de la matrice (los meses) de cada nucleo.
// NO toca: operators, users, shiftTypes del nucleo, ni la config de cicli en los operadores.
//
// Run:
//   npx ts-node -O '{"module":"commonjs"}' scripts/clear-matrice.ts
//
// Prerequisites:
//   - serviceAccount.json en ../serviceAccount.json (un nivel arriba, gitignored)
//
// ⚠️  IRREVERSIBLE — los turnos asignados en la matrice quedan eliminados.
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

const db = admin.firestore()

async function run() {
  console.log('\n🗑️  Borrando datos de la matrice — turnichiari-79193\n')

  const nucleiSnap = await db.collection('nuclei').get()
  let totalDocs = 0

  for (const nucleoDoc of nucleiSnap.docs) {
    const nucleoId = nucleoDoc.id
    const matriceSnap = await nucleoDoc.ref.collection('matrice').get()

    if (matriceSnap.empty) {
      console.log(`── ${nucleoId}: matrice ya vacía`)
      continue
    }

    console.log(`── ${nucleoId}: ${matriceSnap.size} documenti mese`)
    for (const docSnap of matriceSnap.docs) {
      await docSnap.ref.delete()
      console.log(`   ✓ borrado matrice/${docSnap.id}`)
      totalDocs++
    }
  }

  console.log(`\n✅  Listo! ${totalDocs} documenti della matrice eliminati.`)
  console.log('\n⚠️  Elimina serviceAccount.json ahora!\n')
}

run()
  .then(() => process.exit(0))
  .catch(err => { console.error('\n❌  Error:', err); process.exit(1) })

'use client'
import { useAuth } from '@/hooks/useAuth'
import { useMatrice } from '@/hooks/useMatrice'
import { CicloOperatoreRow } from '@/components/impostazioni/CicloOperatoreRow'

const today = new Date()
const CURRENT_YEAR_MONTH = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

export default function CicliPage() {
  const { user } = useAuth()
  const nucleoId = user?.nucleoId ?? 'nucleo-b'

  const { operators, loading } = useMatrice(nucleoId, CURRENT_YEAR_MONTH)

  if (!user || user.role === 'oss') {
    return <div className="p-6 text-sm text-slate-500">Accesso non autorizzato.</div>
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Caricamento...</div>
  }

  const fulltimeOps = operators.filter(op =>
    op.contractType === 'fulltime' || op.contractType === 'standard'
  )
  const parttimeOps = operators.filter(op => op.contractType === 'parttime')
  const unconfiguredOps = operators.filter(op =>
    !op.cycle && (op.contractType === 'fulltime' || op.contractType === 'standard')
  )

  return (
    <div className="flex-1 overflow-auto p-6 max-w-4xl">
      <h1 className="text-lg font-bold text-slate-900 mb-1">Configurazione cicli turni</h1>
      <p className="text-sm text-slate-500 mb-6">
        Imposta il ciclo di rotazione e la fase di partenza per ogni operatore.
        Questa configurazione viene usata dal pulsante <strong>&quot;Genera mese&quot;</strong> nella matrice.
      </p>

      {unconfiguredOps.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          ⚠ {unconfiguredOps.length} operatori non ancora configurati. Imposta la loro fase e salva prima di generare il mese.
        </div>
      )}

      <div className="flex items-center gap-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
        <div className="w-32">Operatore</div>
        <div className="w-6"></div>
        <div className="w-28">Fase (giorno 1)</div>
        <div className="w-16">Pos. 1</div>
        <div className="w-16">Pos. 2</div>
        <div className="w-16">Pos. 3</div>
        <div>Anteprima ciclo</div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg px-4">
        {fulltimeOps.length === 0 && parttimeOps.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Nessun operatore trovato. Aggiungi operatori prima di configurare i cicli.
          </p>
        ) : (
          <>
            {fulltimeOps.map(op => (
              <CicloOperatoreRow
                key={op.id}
                operator={op}
                nucleoId={nucleoId}
                currentYearMonth={CURRENT_YEAR_MONTH}
              />
            ))}
            {parttimeOps.length > 0 && (
              <>
                <div className="py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wide border-t border-slate-100 mt-1">
                  Part-time — schema settimanale fisso
                </div>
                {parttimeOps.map(op => (
                  <CicloOperatoreRow
                    key={op.id}
                    operator={op}
                    nucleoId={nucleoId}
                    currentYearMonth={CURRENT_YEAR_MONTH}
                  />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

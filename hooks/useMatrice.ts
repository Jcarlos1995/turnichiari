import { useState, useEffect } from 'react'
import { subscribeMatrice, getOperators } from '@/lib/firebase/firestore'
import type { MatriceMonth, Operator } from '@/lib/types'

export function useMatrice(nucleoId: string, yearMonth: string) {
  const [matrice, setMatrice] = useState<MatriceMonth>({})
  const [operators, setOperators] = useState<Operator[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getOperators(nucleoId).then(ops => {
      if (active) { setOperators(ops); setLoading(false) }
    })
    const unsubscribe = subscribeMatrice(nucleoId, yearMonth, (data) => {
      if (active) setMatrice(data)
    })
    return () => { active = false; unsubscribe() }
  }, [nucleoId, yearMonth])

  return { matrice, operators, loading }
}

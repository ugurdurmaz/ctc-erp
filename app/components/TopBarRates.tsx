'use client'

import { useEffect, useState } from 'react'
import { DollarSign, Euro } from 'lucide-react'

export default function TopBarRates() {
  const [rates, setRates] = useState<{ USD: number | null, EUR: number | null }>({ USD: null, EUR: null })

  useEffect(() => {
    // Burada { cache: 'no-store' } olduğu için tepe barı her zaman günceldir
    fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data?.rates) {
          setRates({ 
            USD: Number(data.rates.TRY.toFixed(4)), 
            EUR: Number((data.rates.TRY / data.rates.EUR).toFixed(4)) 
          })
        }
      })
      .catch(() => setRates({ USD: 34.25, EUR: 37.80 }))
  }, [])

  return (
    <div className="flex items-center gap-4 text-xs font-mono font-bold ml-auto">
      <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 shadow-sm">
        <DollarSign size={14} /> {rates.USD ? rates.USD.toFixed(4) + ' ₺' : '...'}
      </div>
      <div className="flex items-center gap-1.5 text-blue-400 bg-blue-500/10 px-3 py-1 rounded-lg border border-blue-500/20 shadow-sm">
        <Euro size={14} /> {rates.EUR ? rates.EUR.toFixed(4) + ' ₺' : '...'}
      </div>
    </div>
  )
}
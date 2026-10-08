import { SupabaseClient } from '@supabase/supabase-js'

export interface ExchangeRates {
  USD: number
  EUR: number
}

const DEFAULT_RATES: ExchangeRates = {
  USD: 34.25,
  EUR: 37.80
}

/**
 * Mutlak Stok Yeniden Hesaplama Motoru (Absolute Stock Ledger Engine)
 * 
 * 1. İlgili stoğun tüm stock_transactions kayıtlarını çeker.
 * 2. Mutlak Miktar (quantity) = Σ in.quantity − Σ out.quantity hesaplar.
 * 3. En Son Alış Fiyatı (unit_price) = HANDBOOK.md §6.3 kuralı uyarınca:
 *    Pozitif birim fiyatlı en son 'in' (alış/giriş) hareketinin birim fiyatını
 *    stok para birimine dönüştürerek tespit eder.
 * 4. stocks tablosundaki quantity ve unit_price alanlarını tek seferde senkronize eder.
 */
export async function recalculateAbsoluteStock(
  supabase: SupabaseClient,
  stockId: string,
  rates: ExchangeRates = DEFAULT_RATES
): Promise<{ quantity: number; unit_price: number }> {
  try {
    // 1. Stoğun tüm hareketlerini kronolojik olarak çek
    const { data: txs, error: txError } = await supabase
      .from('stock_transactions')
      .select('id, quantity, tx_type, unit_price, currency, tx_date, created_at')
      .eq('stock_id', stockId)
      .order('tx_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (txError) {
      console.error(`[recalculateAbsoluteStock] Hareketler çekilemedi (${stockId}):`, txError)
      return { quantity: 0, unit_price: 0 }
    }

    // 2. Mutlak miktarı topla
    let absoluteQty = 0
    txs?.forEach(t => {
      const q = Number(t.quantity) || 0
      absoluteQty += t.tx_type === 'in' ? q : -q
    })

    // 3. Mevcut stok kartını çek (para birimi ve mevcut fiyat için)
    const { data: currentStock, error: stError } = await supabase
      .from('stocks')
      .select('id, currency, unit_price')
      .eq('id', stockId)
      .maybeSingle()

    if (stError || !currentStock) {
      console.error(`[recalculateAbsoluteStock] Stok kartı bulunamadı (${stockId}):`, stError)
      return { quantity: absoluteQty, unit_price: 0 }
    }

    // 4. En son alış hareketini bul (son alış fiyatı yöntemi)
    const latestIn = txs?.find(t => t.tx_type === 'in' && Number(t.unit_price) > 0)

    let latestPrice = Number(currentStock.unit_price) || 0

    if (latestIn) {
      const inPrice = Number(latestIn.unit_price) || 0
      const inCurr = latestIn.currency || 'TRY'
      const stockCurr = currentStock.currency || 'TRY'

      if (inCurr === stockCurr) {
        latestPrice = inPrice
      } else {
        const usdRate = rates.USD || DEFAULT_RATES.USD
        const eurRate = rates.EUR || DEFAULT_RATES.EUR

        let tryVal = inPrice
        if (inCurr === 'USD') tryVal = inPrice * usdRate
        else if (inCurr === 'EUR') tryVal = inPrice * eurRate

        if (stockCurr === 'USD') latestPrice = tryVal / usdRate
        else if (stockCurr === 'EUR') latestPrice = tryVal / eurRate
        else latestPrice = tryVal
      }
      latestPrice = Math.round(latestPrice * 100) / 100
    }

    // 5. stocks tablosunu güncelle
    await supabase
      .from('stocks')
      .update({
        quantity: absoluteQty,
        unit_price: latestPrice
      })
      .eq('id', stockId)

    return { quantity: absoluteQty, unit_price: latestPrice }
  } catch (err) {
    console.error(`[recalculateAbsoluteStock] Kritik hata (${stockId}):`, err)
    return { quantity: 0, unit_price: 0 }
  }
}

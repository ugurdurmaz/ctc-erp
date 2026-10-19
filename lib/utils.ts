export function formatMoney(amount: number, currency: string = 'TRY') {
  const normCurrency = (currency || 'TRY').toUpperCase()
  const symbol = normCurrency === 'USD' ? '$' : normCurrency === 'EUR' ? '€' : '₺'
  const parts = Number(amount || 0).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).split(',')

  const integerPart = parts[0]
  const decimalPart = parts[1] || '00'

  return {
    integerPart,
    decimalPart,
    symbol,
    formatted: `${integerPart},${decimalPart}${symbol}`
  }
}

/**
 * Türkiye telefon numaralarını standart '05XX XXX XX XX' formatına otomatik çevirir.
 * Düz yazılan numaraları (örn: 5321234567, 05321234567, +905321234567, (0532) 123-4567)
 * kullanıcı yazarken veya yapıştırırken anında '0532 123 45 67' formatına dönüştürür.
 */
export function formatPhoneNumber(value: string | null | undefined): string {
  if (!value) return ''
  
  const trimmed = value.trim()
  // Uluslararası (+ ile başlayan ve +90 olmayan) numaraları koru
  if (trimmed.startsWith('+') && !trimmed.startsWith('+90')) {
    const clean = '+' + trimmed.slice(1).replace(/[^\d\s]/g, '')
    return clean.slice(0, 20)
  }

  // Sadece rakamları ayıkla
  let digits = value.replace(/\D/g, '')
  if (!digits) return ''

  // 0090 veya 90 ile başlıyorsa Türkiye ülke kodunu ayıkla
  if (digits.startsWith('0090') && digits.length >= 13) {
    digits = '0' + digits.slice(4)
  } else if (digits.startsWith('90') && digits.length >= 11) {
    digits = '0' + digits.slice(2)
  }

  // Kullanıcı 0 yazmadan direkt 5 ile veya sabit hat alan kodları (2, 3, 4, 8) ile başladıysa başına 0 ekle
  if (!digits.startsWith('0') && (digits.startsWith('5') || digits.startsWith('2') || digits.startsWith('3') || digits.startsWith('4') || digits.startsWith('8'))) {
    digits = '0' + digits
  }

  // Türkiye için maksimum 11 hane (05XX XXX XX XX)
  digits = digits.slice(0, 11)

  // Adım adım formatlama (05XX XXX XX XX)
  if (digits.length <= 4) {
    return digits
  }
  if (digits.length <= 7) {
    return `${digits.slice(0, 4)} ${digits.slice(4)}`
  }
  if (digits.length <= 9) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  }
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9, 11)}`
}

/**
 * Çoklu Döviz Çevirici (Universal Multi-Currency Converter)
 * Bir cari hareketin (ödeme / borç / tahsilat) tutarını, cari kartın (tedarikçi / müşteri)
 * ana para birimine dönüştürür.
 * 
 * Türkiye muhasebe standardı gereği döviz kurları "1 Döviz = X TL" (örn: 1 USD = 38.50 TL) olarak tutulur.
 * - Dövizli cariye TL ile işlem yapıldığında: Tutar / Kur
 * - TL cariye Döviz ile işlem yapıldığında: Tutar * Kur
 * - Çapraz döviz (EUR -> USD): (Tutar * EUR_Kuru) / USD_Kuru
 * 
 * Güvenlik & Savunma: Kur 1 girilip/boş bırakılarak döviz bakiyesinin TL tutarı kadar şişirilmesini engeller.
 * Eğer çapraz işlemde kur <= 1 ise, otomatik olarak canlı piyasa kurunu (rates) devreye sokar.
 */
export function convertTxToEntityCurrency(
  txAmount: number,
  txCurr: string = 'TRY',
  entityCurr: string = 'TRY',
  customRate: number = 1,
  rates: { USD: number; EUR: number } = { USD: 1, EUR: 1 }
): number {
  const normTxCurr = (txCurr || 'TRY').toUpperCase()
  const normEntityCurr = (entityCurr || 'TRY').toUpperCase()
  const val = Number(txAmount || 0)

  // Aynı para birimi ise birebir geçerlidir
  if (normTxCurr === normEntityCurr) {
    return Number(val.toFixed(2))
  }

  const effectiveCustomRate = customRate > 1 ? customRate : 0

  if (normEntityCurr === 'USD') {
    if (normTxCurr === 'TRY') {
      const rate = effectiveCustomRate || rates.USD || 1
      return Number((val / rate).toFixed(2))
    }
    if (normTxCurr === 'EUR') {
      const eurRate = effectiveCustomRate || rates.EUR || 1
      const usdRate = rates.USD || 1
      return Number(((val * eurRate) / usdRate).toFixed(2))
    }
  } else if (normEntityCurr === 'EUR') {
    if (normTxCurr === 'TRY') {
      const rate = effectiveCustomRate || rates.EUR || 1
      return Number((val / rate).toFixed(2))
    }
    if (normTxCurr === 'USD') {
      const usdRate = effectiveCustomRate || rates.USD || 1
      const eurRate = rates.EUR || 1
      return Number(((val * usdRate) / eurRate).toFixed(2))
    }
  } else {
    // normEntityCurr === 'TRY'
    let rate = effectiveCustomRate
    if (!rate) {
      rate = normTxCurr === 'USD' ? (rates.USD || 1) : (rates.EUR || 1)
    }
    return Number((val * rate).toFixed(2))
  }

  return Number(val.toFixed(2))
}

export const CARD_COLORS = [
  { label: 'Gece Mavisi (Varsayılan)', value: 'from-[#1b253b] to-[#121a2a]' },
  { label: 'Koyu Grafit', value: 'from-[#27272a] to-[#18181b]' },
  { label: 'Derin Mor', value: 'from-[#3b1f48] to-[#1a0f24]' },
  { label: 'Zümrüt Yeşili', value: 'from-[#133e30] to-[#0a221b]' },
  { label: 'Koyu Bordo', value: 'from-[#4a1c1c] to-[#240d0d]' },
  { label: 'Okyanus Laciverti', value: 'from-[#1e3a8a] to-[#0f172a]' },
  { label: 'Metalik Titanyum', value: 'from-[#334155] to-[#0f172a]' },
  { label: 'Bronz Kahve', value: 'from-[#451a03] to-[#1c0a00]' },
  { label: 'Neon Gece', value: 'from-[#0f172a] to-[#312e81]' },
  { label: 'Kömür Siyahı', value: 'from-[#18181b] to-[#09090b]' },
  { label: 'Koyu Safir', value: 'from-[#172554] to-[#020617]' },
  { label: 'Koyu Gece Yeşili', value: 'from-[#064e3b] to-[#022c22]' },
  { label: 'Koyu Erik Moru', value: 'from-[#581c87] to-[#3b0764]' },
  { label: 'Koyu Yakut Kırmızısı', value: 'from-[#881337] to-[#4c0519]' },
]

export function parseAccountColor(rawColor?: string | null): { color: string; isInvestment: boolean } {
  if (!rawColor) return { color: CARD_COLORS[0].value, isInvestment: false }
  const isInvestment = rawColor.includes('investment') || rawColor.includes('vadeli')
  const cleanColor = rawColor.replace(/\|?investment/gi, '').replace(/\|?vadeli/gi, '').trim()
  const validColor = cleanColor && cleanColor.startsWith('from-') ? cleanColor : CARD_COLORS[0].value
  return { color: validColor, isInvestment }
}

export function formatAccountColor(color: string, isInvestment: boolean): string {
  const baseColor = color || CARD_COLORS[0].value
  return isInvestment ? `${baseColor}|investment` : baseColor
}


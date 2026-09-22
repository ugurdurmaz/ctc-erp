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
export function formatMoney(amount: number, currency: 'TRY' | 'USD' | 'EUR' = 'TRY') {
  const symbol = currency === 'TRY' ? '₺' : currency === 'USD' ? '$' : '€'
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
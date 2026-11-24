// Ürüne özel eşik yoksa stok sayfasının tarihsel kuralı (0 < miktar <= 2) geçerlidir.
export const DEFAULT_CRITICAL_QTY = 2

type StockLevel = { quantity: number | null; critical_level?: number | null }

export function hasCustomCriticalLevel(stock: StockLevel): boolean {
  return stock.critical_level !== null && stock.critical_level !== undefined
}

export function isStockOut(stock: StockLevel): boolean {
  return Number(stock.quantity || 0) <= 0
}

export function isStockCritical(stock: StockLevel): boolean {
  const qty = Number(stock.quantity || 0)
  if (qty <= 0) return false
  const limit = hasCustomCriticalLevel(stock) ? Number(stock.critical_level) : DEFAULT_CRITICAL_QTY
  return qty <= limit
}

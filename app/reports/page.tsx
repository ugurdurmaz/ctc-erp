'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/lib/utils'
import toast, { Toaster } from 'react-hot-toast'
import {
  Printer, Calendar, Filter, Wallet, Landmark, CreditCard, Activity,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  BarChart2, PieChart, ShoppingBag, X, ChevronDown, ChevronUp,
  Search, CheckCircle2, AlertCircle, Sparkles, HelpCircle, Layers,
  Users, Building2, Scale
} from 'lucide-react'

type Company = { id: string; name: string; is_personal: boolean }
type DateFilterType = 'thisMonth' | 'lastMonth' | 'last7Days' | 'last30Days' | 'thisYear' | 'custom' | 'all'

function formatDateTR(dateStr: string) {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`
  return dateStr
}

function formatShortDateTR(dateStr: string) {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`
  return dateStr
}

export default function AdvancedReportsPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompany, setSelectedCompany] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<DateFilterType>('thisMonth')
  const [includeChartInPrint, setIncludeChartInPrint] = useState<boolean>(false)
  
  // Özel Tarih Aralığı State'leri
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0')
  const [customStart, setCustomStart] = useState<string>(`${currentYear}-${currentMonth}-01`)
  const [customEnd, setCustomEnd] = useState<string>(
    `${currentYear}-${currentMonth}-${String(new Date(currentYear, now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`
  )

  // Veritabanı State'leri
  const [customers, setCustomers] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [customerTxs, setCustomerTxs] = useState<any[]>([])
  const [supplierTxs, setSupplierTxs] = useState<any[]>([])
  const [expenseTxs, setExpenseTxs] = useState<any[]>([])
  const [stockTxs, setStockTxs] = useState<any[]>([])
  const [cashTxs, setCashTxs] = useState<any[]>([])
  const [bankTxs, setBankTxs] = useState<any[]>([])
  const [posTxs, setPosTxs] = useState<any[]>([])
  
  const [banks, setBanks] = useState<any[]>([])
  const [cashes, setCashes] = useState<any[]>([])
  const [cards, setCards] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [stocks, setStocks] = useState<any[]>([])

  const [rates, setRates] = useState<{ USD: number; EUR: number }>({ USD: 34.25, EUR: 37.80 })
  const [loading, setLoading] = useState(true)

  // İnteraktif Grafik & Drill-Down State'leri
  const [hoveredDay, setHoveredDay] = useState<any | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [drilldownSearch, setDrilldownSearch] = useState<string>('')
  const [showDrilldown, setShowDrilldown] = useState<boolean>(false)

  useEffect(() => {
    fetchExchangeRates()
    fetchData()
  }, [])

  async function fetchExchangeRates() {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' })
      const data = await res.json()
      if (data && data.rates) {
        setRates({
          USD: Number(data.rates.TRY.toFixed(4)),
          EUR: Number((data.rates.TRY / data.rates.EUR).toFixed(4))
        })
      }
    } catch (err) {
      console.error(err)
    }
  }

  async function fetchData() {
    setLoading(true)
    try {
      const { data: comp } = await supabase.from('companies').select('*').order('name')
      setCompanies(comp || [])

      // Müşteriler ve Tedarikçiler Ana Tabloları
      const { data: custList } = await supabase.from('customers').select('id, name, balance, currency').order('name')
      setCustomers(custList || [])

      const { data: suppList } = await supabase.from('suppliers').select('id, company_name, balance, currency').order('company_name')
      setSuppliers(suppList || [])

      // Cari Hareket Tabloları
      const { data: cTxs } = await supabase.from('customer_transactions')
        .select('id, tx_date, tx_type, amount, exchange_rate, company_id, payment_source_type, payment_source_id, description, customer_id')
      setCustomerTxs(cTxs || [])

      const { data: sTxs } = await supabase.from('supplier_transactions')
        .select('id, tx_date, tx_type, amount, exchange_rate, company_id, payment_source_type, payment_source_id, description, supplier_id')
      setSupplierTxs(sTxs || [])

      const { data: exps } = await supabase.from('expense_transactions')
        .select('id, tx_date, amount, exchange_rate, company_id, payment_source_type, payment_source_id, created_at, category_id, description, category:expense_categories(name)')
      setExpenseTxs(exps || [])

      const { data: stTxs } = await supabase.from('stock_transactions')
        .select('tx_date, tx_type, quantity, unit_price, currency, company_id, stock_id')
      setStockTxs(stTxs || [])

      const { data: cData } = await supabase.from('cash_registers')
        .select('id, name, balance, currency, company_id')
      setCashes(cData || [])

      const { data: bData } = await supabase.from('bank_accounts')
        .select('id, bank_name, balance, currency, company_id')
      setBanks(bData || [])

      const { data: cdData } = await supabase.from('credit_cards')
        .select('id, name, current_debt, company_id')
      setCards(cdData || [])

      const { data: wData } = await supabase.from('warehouses')
        .select('id, name, company_id')
      setWarehouses(wData || [])

      const { data: stkData } = await supabase.from('stocks')
        .select('id, quantity, unit_price, currency, warehouse_id')
      setStocks(stkData || [])

      // Nakit ve Banka Hareket Tabloları
      const { data: cashTransactions } = await supabase.from('cash_transactions')
        .select('id, cash_register_id, company_id, tx_date, description, tx_type, amount, currency, exchange_rate, is_transfer, transfer_id')
      setCashTxs(cashTransactions || [])

      const { data: bankTransactions } = await supabase.from('bank_transactions')
        .select('id, bank_account_id, company_id, tx_date, description, tx_type, amount, currency, exchange_rate, is_transfer, transfer_id, status')
      setBankTxs(bankTransactions || [])

      // Mağaza (POS) Satış ve Z-Raporu Hareketleri
      const { data: posTransactions } = await supabase.from('pos_transactions')
        .select('id, date, category_id, description, cash, card, cost, stock_id, company_id')
      setPosTxs(posTransactions || [])

    } catch (err) {
      toast.error('Veriler alınırken hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  const getTryEquivalent = (amount: number, curr: string) => {
    return amount * (curr === 'USD' ? rates.USD : curr === 'EUR' ? rates.EUR : 1)
  }

  const isMatchCompany = (compId: string | null) => {
    if (selectedCompany === 'all') return true
    if (selectedCompany === 'common') return compId === null
    return compId === selectedCompany
  }

  // Tarih Aralığı Hesaplama Motoru
  const getDates = () => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const todayISO = `${yyyy}-${mm}-${dd}`

    if (dateFilter === 'thisMonth') {
      const lastDay = new Date(yyyy, today.getMonth() + 1, 0).getDate()
      return { start: `${yyyy}-${mm}-01`, end: `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}` }
    }
    if (dateFilter === 'lastMonth') {
      const lm = new Date(yyyy, today.getMonth() - 1, 1)
      const lmY = lm.getFullYear()
      const lmM = String(lm.getMonth() + 1).padStart(2, '0')
      const lastDay = new Date(lmY, lm.getMonth() + 1, 0).getDate()
      return { start: `${lmY}-${lmM}-01`, end: `${lmY}-${lmM}-${String(lastDay).padStart(2, '0')}` }
    }
    if (dateFilter === 'last7Days') {
      const d = new Date()
      d.setDate(d.getDate() - 6)
      const dY = d.getFullYear()
      const dM = String(d.getMonth() + 1).padStart(2, '0')
      const dD = String(d.getDate()).padStart(2, '0')
      return { start: `${dY}-${dM}-${dD}`, end: todayISO }
    }
    if (dateFilter === 'last30Days') {
      const d = new Date()
      d.setDate(d.getDate() - 29)
      const dY = d.getFullYear()
      const dM = String(d.getMonth() + 1).padStart(2, '0')
      const dD = String(d.getDate()).padStart(2, '0')
      return { start: `${dY}-${dM}-${dD}`, end: todayISO }
    }
    if (dateFilter === 'thisYear') {
      return { start: `${yyyy}-01-01`, end: `${yyyy}-12-31` }
    }
    if (dateFilter === 'custom') {
      return { start: customStart || `${yyyy}-${mm}-01`, end: customEnd || todayISO }
    }
    return { start: '1900-01-01', end: '2100-12-31' }
  }

  const { start, end } = getDates()

  // 1. İşlem Gören Kaynakların Hacim Dağılımı (Dönem İçi)
  const getSourceDistribution = (transactions: any[], dateField: string, typeFilter: string | null = null) => {
    let cash = 0, bank = 0, card = 0
    transactions.forEach(t => {
      const d = t[dateField] || t.date || t.created_at?.substring(0, 10)
      if (isMatchCompany(t.company_id) && d >= start && d <= end && (!typeFilter || t.tx_type === typeFilter)) {
        const val = t.amount * (t.exchange_rate || 1)
        if (t.payment_source_type === 'cash') cash += val
        if (t.payment_source_type === 'bank') bank += val
        if (t.payment_source_type === 'card') card += val
      }
    })
    const total = cash + bank + card
    return { cash, bank, card, total }
  }

  const expSources = getSourceDistribution(expenseTxs, 'tx_date')
  const suppSources = getSourceDistribution(supplierTxs, 'tx_date', 'payment')
  const custSources = getSourceDistribution(customerTxs, 'tx_date', 'payment')

  // =====================================================================
  // --- GÜNLÜK HAREKET VE TREND GRAFİĞİ MOTORU ---
  // =====================================================================
  const { dailyStats, totalPeriodInflow, totalPeriodOutflow, netPeriodFlow, peakDay, expenseCategoryStats, posChannelStats, allPeriodTransactions } = useMemo(() => {
    const dayMap: Record<string, {
      date: string
      inflow: number
      outflow: number
      net: number
      items: any[]
    }> = {}

    const startDateObj = new Date(start)
    const endDateObj = new Date(end)
    const diffTime = Math.abs(endDateObj.getTime() - startDateObj.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

    if (diffDays <= 62) {
      const cur = new Date(startDateObj)
      while (cur <= endDateObj) {
        const y = cur.getFullYear()
        const m = String(cur.getMonth() + 1).padStart(2, '0')
        const d = String(cur.getDate()).padStart(2, '0')
        const dateKey = `${y}-${m}-${d}`
        dayMap[dateKey] = { date: dateKey, inflow: 0, outflow: 0, net: 0, items: [] }
        cur.setDate(cur.getDate() + 1)
      }
    }

    const ensureDay = (dateStr: string) => {
      if (!dateStr || dateStr < start || dateStr > end) return null
      if (!dayMap[dateStr]) {
        dayMap[dateStr] = { date: dateStr, inflow: 0, outflow: 0, net: 0, items: [] }
      }
      return dayMap[dateStr]
    }

    const allTxList: any[] = []

    // 1. Müşteri Tahsilatları (Giriş)
    customerTxs.forEach(t => {
      if (t.tx_type === 'payment' && isMatchCompany(t.company_id)) {
        const d = t.tx_date
        const day = ensureDay(d)
        if (day) {
          const val = Number(t.amount || 0) * (t.exchange_rate || 1)
          day.inflow += val
          const item = {
            id: `cust-${t.id}`,
            date: d,
            module: 'Müşteri Tahsilatı',
            description: t.description || 'Müşteri Ödeme Girişi',
            source: t.payment_source_type === 'cash' ? 'Nakit Kasa' : t.payment_source_type === 'bank' ? 'Banka Transferi' : 'Kredi Kartı',
            amountTry: val,
            type: 'in' as const
          }
          day.items.push(item)
          allTxList.push(item)
        }
      }
    })

    // 2. Mağaza (POS) Satışları (Giriş)
    posTxs.forEach(t => {
      if (t.category_id !== 'gider' && isMatchCompany(t.company_id)) {
        const d = t.date
        const day = ensureDay(d)
        if (day) {
          const val = Number(t.cash || 0) + Number(t.card || 0)
          if (val > 0) {
            day.inflow += val
            const item = {
              id: `pos-${t.id}`,
              date: d,
              module: 'Mağaza Satışı',
              description: t.description || `Satış [${t.category_id}]`,
              source: Number(t.cash || 0) > 0 && Number(t.card || 0) > 0 ? 'Nakit + Kart' : Number(t.cash || 0) > 0 ? 'Nakit' : 'Kredi Kartı (POS)',
              amountTry: val,
              type: 'in' as const
            }
            day.items.push(item)
            allTxList.push(item)
          }
        }
      }
    })

    // 3. Kasa Diğer Girişleri (Tekrarsız)
    cashTxs.forEach(t => {
      if (t.tx_type === 'in' && isMatchCompany(t.company_id) && !t.is_transfer) {
        const trf = t.transfer_id || ''
        if (!trf.startsWith('CUST-') && !trf.startsWith('POS-')) {
          const d = t.tx_date
          const day = ensureDay(d)
          if (day) {
            const val = getTryEquivalent(Number(t.amount || 0), t.currency || 'TRY')
            day.inflow += val
            const item = {
              id: `cash-${t.id}`,
              date: d,
              module: 'Kasa Girişi',
              description: t.description || 'Nakit Girişi',
              source: 'Nakit Kasa',
              amountTry: val,
              type: 'in' as const
            }
            day.items.push(item)
            allTxList.push(item)
          }
        }
      }
    })

    // 4. Banka Diğer Girişleri (Tekrarsız, provizyon onaylı)
    bankTxs.forEach(t => {
      if (t.tx_type === 'in' && t.status !== 'pending' && isMatchCompany(t.company_id) && !t.is_transfer) {
        const trf = t.transfer_id || ''
        if (!trf.startsWith('CUST-') && !trf.startsWith('POS-')) {
          const d = t.tx_date
          const day = ensureDay(d)
          if (day) {
            const val = getTryEquivalent(Number(t.amount || 0), t.currency || 'TRY')
            day.inflow += val
            const item = {
              id: `bank-${t.id}`,
              date: d,
              module: 'Banka Girişi',
              description: t.description || 'Banka Havale/EFT Girişi',
              source: 'Banka Hesabı',
              amountTry: val,
              type: 'in' as const
            }
            day.items.push(item)
            allTxList.push(item)
          }
        }
      }
    })

    // 5. Tedarikçi Ödemeleri (Çıkış)
    supplierTxs.forEach(t => {
      if (t.tx_type === 'payment' && isMatchCompany(t.company_id)) {
        const d = t.tx_date
        const day = ensureDay(d)
        if (day) {
          const val = Number(t.amount || 0) * (t.exchange_rate || 1)
          day.outflow += val
          const item = {
            id: `supp-${t.id}`,
            date: d,
            module: 'Tedarikçi Ödemesi',
            description: t.description || 'Tedarikçiye Ödeme Çıkışı',
            source: t.payment_source_type === 'cash' ? 'Nakit Kasa' : t.payment_source_type === 'bank' ? 'Banka Transferi' : 'Kredi Kartı',
            amountTry: val,
            type: 'out' as const
          }
          day.items.push(item)
          allTxList.push(item)
        }
      }
    })

    // 6. Genel Giderler (Çıkış)
    const catMap: Record<string, number> = {}
    expenseTxs.forEach(t => {
      if (isMatchCompany(t.company_id)) {
        const d = t.tx_date || t.date || t.created_at?.substring(0, 10)
        const day = ensureDay(d)
        if (day) {
          const val = Number(t.amount || 0) * (t.exchange_rate || 1)
          day.outflow += val
          const catName = t.category?.name || 'Diğer Giderler'
          catMap[catName] = (catMap[catName] || 0) + val
          const item = {
            id: `exp-${t.id}`,
            date: d,
            module: 'Genel Gider',
            description: `[${catName}] ${t.description || 'Masraf'}`,
            source: t.payment_source_type === 'cash' ? 'Nakit Kasa' : t.payment_source_type === 'bank' ? 'Banka' : 'Kredi Kartı',
            amountTry: val,
            type: 'out' as const
          }
          day.items.push(item)
          allTxList.push(item)
        }
      }
    })

    // 7. Mağaza Masrafları (Çıkış)
    posTxs.forEach(t => {
      if (t.category_id === 'gider' && isMatchCompany(t.company_id)) {
        const d = t.date
        const day = ensureDay(d)
        if (day) {
          const val = Number(t.cash || 0) + Number(t.card || 0)
          if (val > 0) {
            day.outflow += val
            const item = {
              id: `pos-exp-${t.id}`,
              date: d,
              module: 'Mağaza Gideri',
              description: t.description || 'Gün İçi Mağaza Masrafı',
              source: Number(t.cash || 0) > 0 ? 'Kasa (Nakit)' : 'Kart',
              amountTry: val,
              type: 'out' as const
            }
            day.items.push(item)
            allTxList.push(item)
          }
        }
      }
    })

    // 8. Kasa Diğer Çıkışları (Tekrarsız)
    cashTxs.forEach(t => {
      if (t.tx_type === 'out' && isMatchCompany(t.company_id) && !t.is_transfer) {
        const trf = t.transfer_id || ''
        if (!trf.startsWith('SUPP-') && !trf.startsWith('EXP-') && !trf.startsWith('POS-')) {
          const d = t.tx_date
          const day = ensureDay(d)
          if (day) {
            const val = getTryEquivalent(Number(t.amount || 0), t.currency || 'TRY')
            day.outflow += val
            const item = {
              id: `cash-out-${t.id}`,
              date: d,
              module: 'Kasa Çıkışı',
              description: t.description || 'Nakit Masraf / Çıkış',
              source: 'Nakit Kasa',
              amountTry: val,
              type: 'out' as const
            }
            day.items.push(item)
            allTxList.push(item)
          }
        }
      }
    })

    // 9. Banka Diğer Çıkışları (Tekrarsız)
    bankTxs.forEach(t => {
      if (t.tx_type === 'out' && isMatchCompany(t.company_id) && !t.is_transfer) {
        const trf = t.transfer_id || ''
        if (!trf.startsWith('SUPP-') && !trf.startsWith('EXP-') && !trf.startsWith('POS-')) {
          const d = t.tx_date
          const day = ensureDay(d)
          if (day) {
            const val = getTryEquivalent(Number(t.amount || 0), t.currency || 'TRY')
            day.outflow += val
            const item = {
              id: `bank-out-${t.id}`,
              date: d,
              module: 'Banka Çıkışı',
              description: t.description || 'Banka Çıkışı / EFT',
              source: 'Banka Hesabı',
              amountTry: val,
              type: 'out' as const
            }
            day.items.push(item)
            allTxList.push(item)
          }
        }
      }
    })

    // Günlük İstatistik Dizisi ve Net Değerleri Hesapla
    const stats = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date))
    let totalIn = 0
    let totalOut = 0
    let maxInflow = -1
    let peakDayItem: any = null

    stats.forEach(s => {
      s.net = s.inflow - s.outflow
      totalIn += s.inflow
      totalOut += s.outflow
      if (s.inflow > maxInflow && s.inflow > 0) {
        maxInflow = s.inflow
        peakDayItem = s
      }
    })

    // Gider Kategori Dağılım İstatistikleri
    const expTotal = Object.values(catMap).reduce((a, b) => a + b, 0)
    const expCatStats = Object.entries(catMap)
      .map(([name, val]) => ({ name, amount: val, pct: expTotal > 0 ? (val / expTotal) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount)

    // POS Satış Kanal Dağılımı (Nakit vs. Kart)
    let posCash = 0, posCard = 0
    posTxs.forEach(t => {
      if (t.category_id !== 'gider' && isMatchCompany(t.company_id)) {
        const d = t.date
        if (d >= start && d <= end) {
          posCash += Number(t.cash || 0)
          posCard += Number(t.card || 0)
        }
      }
    })
    const posTotal = posCash + posCard

    return {
      dailyStats: stats,
      totalPeriodInflow: totalIn,
      totalPeriodOutflow: totalOut,
      netPeriodFlow: totalIn - totalOut,
      peakDay: peakDayItem,
      expenseCategoryStats: expCatStats,
      posChannelStats: { cash: posCash, card: posCard, total: posTotal },
      allPeriodTransactions: allTxList.sort((a, b) => b.date.localeCompare(a.date))
    }
  }, [customerTxs, posTxs, cashTxs, bankTxs, supplierTxs, expenseTxs, selectedCompany, start, end, rates])

  // =====================================================================
  // --- MUTLAK GERİYE DÖNÜK HESAPLAMA MOTORU (MİZAN TABLOLARI) ---
  // =====================================================================

  // Kredi Kartları Dönem Analizi
  const cardAnalysis = cards.filter(c => isMatchCompany(c.company_id)).map(c => {
    let pInc = 0, pDec = 0, fInc = 0, fDec = 0

    supplierTxs.filter(t => t.payment_source_type === 'card' && t.payment_source_id === c.id && isMatchCompany(t.company_id) && t.tx_type === 'payment').forEach(t => {
      const val = t.amount * (t.exchange_rate || 1)
      if (t.tx_date > end) fInc += val
      else if (t.tx_date >= start) pInc += val
    })

    expenseTxs.filter(t => t.payment_source_type === 'card' && t.payment_source_id === c.id && isMatchCompany(t.company_id)).forEach(t => {
      const val = t.amount * (t.exchange_rate || 1)
      const d = t.tx_date || t.date || t.created_at?.substring(0, 10)
      if (d > end) fInc += val
      else if (d >= start) pInc += val
    })

    customerTxs.filter(t => t.payment_source_type === 'card' && t.payment_source_id === c.id && isMatchCompany(t.company_id) && t.tx_type === 'payment').forEach(t => {
      const val = t.amount * (t.exchange_rate || 1)
      if (t.tx_date > end) fDec += val
      else if (t.tx_date >= start) pDec += val
    })

    const closing = c.current_debt - fInc + fDec
    const opening = closing - pInc + pDec
    return { ...c, opening, increase: pInc, decrease: pDec, closing }
  }).filter(c => c.opening > 0 || c.increase > 0 || c.decrease > 0 || c.closing > 0)

  // Bankalar Dönem Analizi
  const bankAnalysis = banks.filter(b => isMatchCompany(b.company_id)).map(b => {
    let pIn = 0, pOut = 0, fIn = 0, fOut = 0

    customerTxs.filter(t => t.payment_source_type === 'bank' && t.payment_source_id === b.id && isMatchCompany(t.company_id) && t.tx_type === 'payment').forEach(t => {
      const val = t.amount * (t.exchange_rate || 1)
      if (t.tx_date > end) fIn += val
      else if (t.tx_date >= start) pIn += val
    })

    supplierTxs.filter(t => t.payment_source_type === 'bank' && t.payment_source_id === b.id && isMatchCompany(t.company_id) && t.tx_type === 'payment').forEach(t => {
      const val = t.amount * (t.exchange_rate || 1)
      if (t.tx_date > end) fOut += val
      else if (t.tx_date >= start) pOut += val
    })

    expenseTxs.filter(t => t.payment_source_type === 'bank' && t.payment_source_id === b.id && isMatchCompany(t.company_id)).forEach(t => {
      const val = t.amount * (t.exchange_rate || 1)
      const d = t.tx_date || t.date || t.created_at?.substring(0, 10)
      if (d > end) fOut += val
      else if (d >= start) pOut += val
    })

    const cBal = getTryEquivalent(b.balance, b.currency)
    const closing = cBal - fIn + fOut
    const opening = closing - pIn + pOut
    return { ...b, opening, in: pIn, out: pOut, closing }
  }).filter(b => b.opening !== 0 || b.in !== 0 || b.out !== 0 || b.closing !== 0)

  // Nakit Kasalar Dönem Analizi
  const cashAnalysis = cashes.filter(c => isMatchCompany(c.company_id)).map(c => {
    let pIn = 0, pOut = 0, fIn = 0, fOut = 0

    cashTxs.filter(t => t.cash_register_id === c.id && isMatchCompany(t.company_id)).forEach(t => {
      const val = getTryEquivalent(Number(t.amount || 0), t.currency || c.currency)
      if (t.tx_date > end) {
        if (t.tx_type === 'in') fIn += val
        if (t.tx_type === 'out') fOut += val
      } else if (t.tx_date >= start) {
        if (t.tx_type === 'in') pIn += val
        if (t.tx_type === 'out') pOut += val
      }
    })

    const cBal = getTryEquivalent(Number(c.balance || 0), c.currency)
    const closing = cBal - fIn + fOut
    const opening = closing - pIn + pOut
    return { ...c, opening, in: pIn, out: pOut, closing }
  }).filter(c => c.opening !== 0 || c.in !== 0 || c.out !== 0 || c.closing !== 0)

  // Müşteriler (Alacaklarımız) Dönem Analizi
  const customerAnalysis = customers.map(c => {
    let pDebt = 0, pPay = 0, fDebt = 0, fPay = 0
    const relevantTxs = customerTxs.filter(t => t.customer_id === c.id && isMatchCompany(t.company_id))

    const currentBal = selectedCompany === 'all'
      ? Number(c.balance || 0)
      : relevantTxs.reduce((acc, t) => t.tx_type === 'debt' ? acc + (t.amount * (t.exchange_rate || 1)) : acc - (t.amount * (t.exchange_rate || 1)), 0)

    relevantTxs.forEach(t => {
      const val = Number(t.amount || 0) * (t.exchange_rate || 1)
      if (t.tx_date > end) {
        if (t.tx_type === 'debt') fDebt += val
        if (t.tx_type === 'payment') fPay += val
      } else if (t.tx_date >= start) {
        if (t.tx_type === 'debt') pDebt += val
        if (t.tx_type === 'payment') pPay += val
      }
    })

    const closing = currentBal - fDebt + fPay
    const opening = closing - pDebt + pPay
    return { ...c, opening, debt: pDebt, payment: pPay, closing }
  }).filter(c => Math.abs(c.opening) > 0.01 || c.debt > 0.01 || c.payment > 0.01 || Math.abs(c.closing) > 0.01)

  // Tedarikçiler (Borçlarımız) Dönem Analizi
  const supplierAnalysis = suppliers.map(s => {
    let pDebt = 0, pPay = 0, fDebt = 0, fPay = 0
    const relevantTxs = supplierTxs.filter(t => t.supplier_id === s.id && isMatchCompany(t.company_id))

    const currentBal = selectedCompany === 'all'
      ? Number(s.balance || 0)
      : relevantTxs.reduce((acc, t) => t.tx_type === 'debt' ? acc + (t.amount * (t.exchange_rate || 1)) : acc - (t.amount * (t.exchange_rate || 1)), 0)

    relevantTxs.forEach(t => {
      const val = Number(t.amount || 0) * (t.exchange_rate || 1)
      if (t.tx_date > end) {
        if (t.tx_type === 'debt') fDebt += val
        if (t.tx_type === 'payment') fPay += val
      } else if (t.tx_date >= start) {
        if (t.tx_type === 'debt') pDebt += val
        if (t.tx_type === 'payment') pPay += val
      }
    })

    const closing = currentBal - fDebt + fPay
    const opening = closing - pDebt + pPay
    return { ...s, name: s.company_name, opening, debt: pDebt, payment: pPay, closing }
  }).filter(s => Math.abs(s.opening) > 0.01 || s.debt > 0.01 || s.payment > 0.01 || Math.abs(s.closing) > 0.01)

  // Cari Toplamları
  const totalCustomerOpening = customerAnalysis.reduce((acc, c) => acc + c.opening, 0)
  const totalCustomerDebt = customerAnalysis.reduce((acc, c) => acc + c.debt, 0)
  const totalCustomerPayment = customerAnalysis.reduce((acc, c) => acc + c.payment, 0)
  const totalCustomerClosing = customerAnalysis.reduce((acc, c) => acc + c.closing, 0)

  const totalSupplierOpening = supplierAnalysis.reduce((acc, s) => acc + s.opening, 0)
  const totalSupplierDebt = supplierAnalysis.reduce((acc, s) => acc + s.debt, 0)
  const totalSupplierPayment = supplierAnalysis.reduce((acc, s) => acc + s.payment, 0)
  const totalSupplierClosing = supplierAnalysis.reduce((acc, s) => acc + s.closing, 0)

  // Depolar Dönem Analizi
  const stockWhMap: Record<string, string> = {}
  stocks.forEach(s => { stockWhMap[s.id] = s.warehouse_id })

  const whAnalysis = warehouses.filter(w => isMatchCompany(w.company_id)).map(w => {
    let pIn = 0, pOut = 0, fIn = 0, fOut = 0

    stockTxs.filter(t => stockWhMap[t.stock_id] === w.id && isMatchCompany(t.company_id)).forEach(t => {
      const val = getTryEquivalent(t.quantity * t.unit_price, t.currency)
      if (t.tx_date > end) {
        if (t.tx_type === 'in') fIn += val
        if (t.tx_type === 'out') fOut += val
      } else if (t.tx_date >= start) {
        if (t.tx_type === 'in') pIn += val
        if (t.tx_type === 'out') pOut += val
      }
    })

    const cVal = stocks.filter(s => s.warehouse_id === w.id).reduce((acc, s) => acc + getTryEquivalent(s.quantity * s.unit_price, s.currency), 0)
    const closing = cVal - fIn + fOut
    const opening = closing - pIn + pOut
    return { ...w, opening, in: pIn, out: pOut, closing }
  }).filter(w => w.opening !== 0 || w.in !== 0 || w.out !== 0 || w.closing !== 0)

  const handlePrint = () => { window.print() }

  // Günlük İşlem Detay Listesini Filtreleme
  const currentFilteredDrilldown = useMemo(() => {
    let list = selectedDay
      ? dailyStats.find(s => s.date === selectedDay)?.items || []
      : allPeriodTransactions

    if (drilldownSearch) {
      const q = drilldownSearch.toLowerCase()
      list = list.filter(i =>
        i.description.toLowerCase().includes(q) ||
        i.module.toLowerCase().includes(q) ||
        i.source.toLowerCase().includes(q) ||
        i.date.includes(q)
      )
    }
    return list
  }, [selectedDay, dailyStats, allPeriodTransactions, drilldownSearch])

  // SVG Çizim Parametreleri
  const chartMaxVal = useMemo(() => {
    const maxNumber = Math.max(1, ...dailyStats.map(s => Math.max(s.inflow, s.outflow, Math.abs(s.net))))
    return maxNumber * 1.15
  }, [dailyStats])

  const DistributionCard = ({ title, data, delay }: { title: string, data: any, delay: string }) => {
    const cashPct = data.total > 0 ? (data.cash / data.total) * 100 : 0
    const bankPct = data.total > 0 ? (data.bank / data.total) * 100 : 0
    const cardPct = data.total > 0 ? (data.card / data.total) * 100 : 0

    return (
      <div style={{ animation: `fadeInUp 0.4s both ${delay}` }} className="bg-[#070b14] border border-slate-800 rounded-xl p-3 print-force-transparent flex flex-col hover:border-slate-600 transition-colors group print:p-1.5 print:rounded-md">
        <h3 className="text-[10px] font-bold text-slate-300 print-text-black uppercase tracking-widest mb-1.5 group-hover:text-indigo-400 transition-colors print:text-[8px] print:mb-1">{title}</h3>
        <div className="flex h-2 rounded-full overflow-hidden mb-2 bg-slate-800 print:bg-gray-200 print-color-adjust print:h-1.5">
          <div style={{ width: `${cashPct}%`, transition: 'width 1s ease-out' }} className="bg-emerald-500 print-color-adjust" />
          <div style={{ width: `${bankPct}%`, transition: 'width 1s ease-out' }} className="bg-blue-500 print-color-adjust" />
          <div style={{ width: `${cardPct}%`, transition: 'width 1s ease-out' }} className="bg-purple-500 print-color-adjust" />
        </div>
        <div className="space-y-1 text-[9px] font-mono flex-1 print:text-[7.5px] print:space-y-0.5">
          <div className="flex justify-between items-center"><span className="flex items-center gap-1 text-slate-400 print:text-slate-700 font-sans"><Wallet size={9} className="text-emerald-500"/> Kasa</span><span className="text-emerald-400 font-bold print:text-black">{formatMoney(data.cash, 'TRY').formatted}</span></div>
          <div className="flex justify-between items-center"><span className="flex items-center gap-1 text-slate-400 print:text-slate-700 font-sans"><Landmark size={9} className="text-blue-500"/> Banka</span><span className="text-blue-400 font-bold print:text-black">{formatMoney(data.bank, 'TRY').formatted}</span></div>
          <div className="flex justify-between items-center"><span className="flex items-center gap-1 text-slate-400 print:text-slate-700 font-sans"><CreditCard size={9} className="text-purple-500"/> Kart</span><span className="text-purple-400 font-bold print:text-black">{formatMoney(data.card, 'TRY').formatted}</span></div>
        </div>
        <div className="border-t border-slate-800/50 mt-1.5 pt-1 flex justify-between items-center print-border-t">
          <span className="text-[8px] text-slate-500 print-text-black font-bold uppercase">Toplam</span>
          <span className="text-[10px] font-black text-white print-text-black font-mono">{formatMoney(data.total, 'TRY').formatted}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] relative print:h-auto print:overflow-visible print:block">
      <Toaster position="bottom-right" containerStyle={{ zIndex: 99999999 }} toastOptions={{ style: { background: '#0f172a', color: '#fff', border: '1px solid #1e293b', fontSize: '12px' } }} />

      {/* SIFIR SİYAH - TEK SAYFA A4 MAKSİMUM EKONOMİK BASKI CSS AYARLARI */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { 
            size: A4 portrait; 
            margin: 4mm 5mm 4mm 5mm; 
          }
          html, body { 
            background: white !important; 
            color: black !important;
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            font-size: 7px !important;
            line-height: 1.15 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* Kesinlikle gizlenecek yönetim ve arayüz elemanları */
          .print-hidden, aside, header, nav, button, input, select, ::-webkit-scrollbar { 
            display: none !important; 
          }
          
          /* Bütün kapsayıcıların taşmasını ve sabit boyunu serbest bırak */
          div, main, section, article {
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
          }
          
          /* Rapor gövdesi akıcı olmalı */
          #printable-report { 
            position: static !important; 
            width: 100% !important; 
            max-width: 100% !important;
            background: white !important; 
            border: none !important; 
            padding: 0 !important; 
            margin: 0 !important; 
            box-shadow: none !important; 
            display: block !important;
            overflow: visible !important;
            height: auto !important;
          }
          
          /* Renk ve kenarlık zorlamaları */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box !important;
          }
          .print-force-transparent { 
            background: transparent !important; 
            border: 0.5px solid #cbd5e1 !important; 
            box-shadow: none !important; 
          }
          .print-text-black { color: #000000 !important; }
          .print-border-b { border-bottom: 1px solid #000000 !important; }
          .print-border-t { border-top: 0.5px solid #cbd5e1 !important; }
          
          /* Tablolar ve satırları ultra-kompakt hale getir */
          table { 
            border-collapse: collapse !important; 
            width: 100% !important; 
            border: 0.5px solid #cbd5e1 !important; 
            font-size: 6.8px !important;
            line-height: 1.1 !important;
          }
          tr { 
            break-inside: avoid !important; 
            page-break-inside: avoid !important; 
          }
          th { 
            background: #f1f5f9 !important; 
            color: #000000 !important; 
            border-bottom: 0.75px solid #000000 !important; 
            border-right: 0.5px solid #e2e8f0 !important;
            padding: 1.5px 2.5px !important; 
            font-size: 6.5px !important;
            font-weight: bold !important;
            text-transform: uppercase !important;
          }
          td { 
            background: transparent !important; 
            color: #000000 !important; 
            border-bottom: 0.5px solid #e2e8f0 !important; 
            border-right: 0.5px solid #f8fafc !important;
            padding: 1.2px 2.5px !important; 
            font-size: 6.8px !important;
          }
          tfoot tr td {
            background: #f8fafc !important;
            border-top: 0.75px solid #000000 !important;
            color: #000000 !important;
            font-weight: bold !important;
            padding: 1.5px 2.5px !important;
            font-size: 6.8px !important;
          }
          
          .print-break-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeSlideRight { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
      `}} />

      {/* ÜST KONTROL BAR (Yazdırmada tamamen gizlenir) */}
      <div style={{ animation: 'fadeInDown 0.4s both' }} className="flex flex-col gap-3 bg-[#0d1322] border border-slate-800/80 p-3.5 rounded-xl shadow-md shrink-0 mb-4 transition-colors print:hidden">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div className="flex items-center gap-3 text-white">
            <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <Activity size={22} />
            </div>
            <div>
              <h2 className="font-black text-base md:text-lg leading-tight tracking-tight flex items-center gap-2">
                Dönemsel Hareket & Nakit Akış Raporu
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-semibold px-2 py-0.5 rounded-full border border-indigo-500/30">Finansal Mizan & Analitik</span>
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Nakit akışı, cari alacak/borç dengesi, banka, kasa ve depo hareketleri</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Şirket Filtresi */}
            <div className="flex items-center gap-2 bg-[#070b14] border border-slate-700 px-3 py-1.5 rounded-lg hover:border-indigo-500/50 transition-colors">
              <Filter size={12} className="text-indigo-400" />
              <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer">
                <option value="all" className="bg-[#0f172a]">🌍 Tüm Şirketler / Merkezler</option>
                <option value="common" className="bg-[#0f172a]">🌐 Ortak / Bağımsız İşlemler</option>
                {companies.map(c => <option key={c.id} value={c.id} className="bg-[#0f172a]">{c.name}</option>)}
              </select>
            </div>

            {/* Grafikleri Baskıya Dahil Et Checkbox */}
            <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer bg-[#070b14] border border-slate-700 px-2.5 py-1.5 rounded-lg hover:border-indigo-500/50 select-none">
              <input
                type="checkbox"
                checked={includeChartInPrint}
                onChange={(e) => setIncludeChartInPrint(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
              />
              <span className="text-[11px] font-bold">Grafikleri Yazdır</span>
            </label>

            {/* Yazdır Butonu */}
            <button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-indigo-900/20 cursor-pointer">
              <Printer size={14} /><span>Raporu Yazdır</span>
            </button>
          </div>
        </div>

        {/* Hızlı Tarih Hapları (Pills) ve Özel Tarih Girişi */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
              <Calendar size={11} className="text-indigo-400" /> Dönem:
            </span>
            {[
              { id: 'last7Days', label: 'Son 7 Gün' },
              { id: 'last30Days', label: 'Son 30 Gün' },
              { id: 'thisMonth', label: 'Bu Ay' },
              { id: 'lastMonth', label: 'Geçen Ay' },
              { id: 'thisYear', label: 'Bu Yıl' },
              { id: 'all', label: 'Tüm Zamanlar' },
              { id: 'custom', label: 'Özel Aralık' }
            ].map(pill => (
              <button
                key={pill.id}
                onClick={() => setDateFilter(pill.id as DateFilterType)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  dateFilter === pill.id
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/40'
                    : 'bg-[#070b14] text-slate-400 hover:text-white hover:bg-slate-800/70 border border-slate-800'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Özel Tarih Seçici Inputs */}
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 bg-[#070b14] border border-indigo-500/40 px-2.5 py-1 rounded-lg text-[11px]">
              <span className="text-slate-400">Başlangıç:</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-slate-800 text-white px-2 py-0.5 rounded border border-slate-700 text-[11px] focus:outline-none"
              />
              <span className="text-slate-400">Bitiş:</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-slate-800 text-white px-2 py-0.5 rounded border border-slate-700 text-[11px] focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* RAPOR GÖVDESİ (Baskıda tek sayfaya sığan ultra-kompakt 2 sütunlu mizan düzeni) */}
      <div id="printable-report" style={{ animation: 'fadeInUp 0.4s both 0.1s' }} className="flex-1 bg-[#0d1322] border border-slate-800/80 rounded-xl p-5 overflow-y-auto custom-scrollbar shadow-xl print-force-transparent space-y-6 print:space-y-2 print:overflow-visible print:h-auto print:block print:p-0 print:m-0 print:border-none print:shadow-none">
        
        {/* YAZDIRMA RESMİ BAŞLIĞI */}
        <div className="text-center border-b border-slate-800 pb-2 print:pb-1 print:mb-1 print:border-b print:border-black">
          <div className="flex justify-between items-baseline print:flex print:justify-between print:items-center">
            <h1 className="text-base font-black text-white tracking-wider print-text-black uppercase print:text-[9.5px] print:leading-none print:font-extrabold">DÖNEMSEL FİNANSAL MİZAN VE HAREKET RAPORU</h1>
            <span className="hidden print:inline-block print:text-[6.5px] print:text-slate-600 font-mono">Çıktı: {new Date().toLocaleDateString('tr-TR')} {new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 print:mt-0.5 print-text-black font-medium print:text-[7px] print:leading-tight print:text-left">
            Kapsam: <strong>{selectedCompany === 'all' ? 'Tüm Kurumlar (Konsolide)' : companies.find(c => c.id === selectedCompany)?.name}</strong>
            {' • '} Dönem: <strong>{formatDateTR(start)} – {formatDateTR(end)}</strong>
          </p>
        </div>

        {/* YÖNETİCİ ÖZETİ (EKRANDA GENİŞ KARTLAR, BASKIDA GİZLENİR - YERİNE AŞAĞIDAKİ TEK SATIR STRIP KULLANILIR) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 print:hidden">
          <div className="bg-[#070b14] border border-slate-800 rounded-xl p-3 flex flex-col justify-between hover:border-emerald-500/40 transition-colors">
            <div className="flex justify-between items-start">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Toplam Nakit Girişi</span>
              <div className="p-1 rounded bg-emerald-500/10 text-emerald-400"><ArrowUpRight size={14} /></div>
            </div>
            <div className="mt-2">
              <div className="text-base font-black text-emerald-400 font-mono">{formatMoney(totalPeriodInflow, 'TRY').formatted}</div>
              <div className="text-[9px] text-slate-500 mt-0.5">Müşteri, POS ve Kasalar</div>
            </div>
          </div>

          <div className="bg-[#070b14] border border-slate-800 rounded-xl p-3 flex flex-col justify-between hover:border-rose-500/40 transition-colors">
            <div className="flex justify-between items-start">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Toplam Çıkış & Masraf</span>
              <div className="p-1 rounded bg-rose-500/10 text-rose-400"><ArrowDownRight size={14} /></div>
            </div>
            <div className="mt-2">
              <div className="text-base font-black text-rose-400 font-mono">{formatMoney(totalPeriodOutflow, 'TRY').formatted}</div>
              <div className="text-[9px] text-slate-500 mt-0.5">Tedarikçi, Gider ve Kart</div>
            </div>
          </div>

          <div className="bg-[#070b14] border border-slate-800 rounded-xl p-3 flex flex-col justify-between hover:border-indigo-500/40 transition-colors">
            <div className="flex justify-between items-start">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Net Nakit Akışı</span>
              <div className={`p-1 rounded ${netPeriodFlow >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                <Activity size={14} />
              </div>
            </div>
            <div className="mt-2">
              <div className={`text-base font-black font-mono ${netPeriodFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {netPeriodFlow >= 0 ? '+' : ''}{formatMoney(netPeriodFlow, 'TRY').formatted}
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">
                {netPeriodFlow >= 0 ? 'Dönem Net Fazlası' : 'Dönem Net Nakit Açığı'}
              </div>
            </div>
          </div>

          <div className="bg-[#070b14] border border-slate-800 rounded-xl p-3 flex flex-col justify-between hover:border-indigo-500/40 transition-colors">
            <div className="flex justify-between items-start">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Günlük Ortalama</span>
              <div className="p-1 rounded bg-blue-500/10 text-blue-400"><TrendingUp size={14} /></div>
            </div>
            <div className="mt-2">
              <div className="text-base font-black text-white font-mono">
                {formatMoney(dailyStats.length > 0 ? totalPeriodInflow / dailyStats.length : 0, 'TRY').formatted}
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">
                Ort. Masraf: {formatMoney(dailyStats.length > 0 ? totalPeriodOutflow / dailyStats.length : 0, 'TRY').formatted}
              </div>
            </div>
          </div>

          <div className="col-span-2 md:col-span-1 bg-[#070b14] border border-slate-800 rounded-xl p-3 flex flex-col justify-between hover:border-amber-500/40 transition-colors">
            <div className="flex justify-between items-start">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">En Yüksek Girişli Gün</span>
              <div className="p-1 rounded bg-amber-500/10 text-amber-400"><Sparkles size={14} /></div>
            </div>
            <div className="mt-2">
              <div className="text-base font-black text-amber-400 font-mono">
                {peakDay ? formatMoney(peakDay.inflow, 'TRY').formatted : '0,00 ₺'}
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">
                {peakDay ? formatDateTR(peakDay.date) : 'Kayıt bulunamadı'}
              </div>
            </div>
          </div>
        </div>

        {/* CARİ MUTABAKAT & AÇIK BAKİYE DENGESİ (EKRANDA GENİŞ KARTLAR, BASKIDA GİZLENİR) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 print:hidden">
          <div className="bg-[#070b14] border border-slate-800 rounded-xl p-3 flex flex-col justify-between hover:border-emerald-500/40 transition-colors">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users size={12} className="text-emerald-400" />
                Müşteri Alacakları (Açık Bakiye)
              </span>
              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-bold">
                {customerAnalysis.length} Aktif Müşteri
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-lg font-black text-emerald-400 font-mono">
                {formatMoney(totalCustomerClosing, 'TRY').formatted}
              </div>
              <div className="text-[9px] text-slate-400 font-mono">
                Satış: <span className="text-emerald-300 font-bold">+{formatMoney(totalCustomerDebt, 'TRY').formatted}</span>
              </div>
            </div>
            <div className="text-[9px] text-slate-500 mt-1 border-t border-slate-800/60 pt-1 flex justify-between font-mono">
              <span>Dönem İçi Tahsilat:</span>
              <span className="text-blue-400 font-bold">-{formatMoney(totalCustomerPayment, 'TRY').formatted}</span>
            </div>
          </div>

          <div className="bg-[#070b14] border border-slate-800 rounded-xl p-3 flex flex-col justify-between hover:border-rose-500/40 transition-colors">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 size={12} className="text-rose-400" />
                Tedarikçi Borçlarımız (Açık Borç)
              </span>
              <span className="text-[9px] font-mono text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded font-bold">
                {supplierAnalysis.length} Aktif Tedarikçi
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-lg font-black text-rose-400 font-mono">
                {formatMoney(totalSupplierClosing, 'TRY').formatted}
              </div>
              <div className="text-[9px] text-slate-400 font-mono">
                Alış: <span className="text-rose-300 font-bold">+{formatMoney(totalSupplierDebt, 'TRY').formatted}</span>
              </div>
            </div>
            <div className="text-[9px] text-slate-500 mt-1 border-t border-slate-800/60 pt-1 flex justify-between font-mono">
              <span>Dönem İçi Ödeme:</span>
              <span className="text-emerald-400 font-bold">-{formatMoney(totalSupplierPayment, 'TRY').formatted}</span>
            </div>
          </div>

          <div className="bg-[#070b14] border border-slate-800 rounded-xl p-3 flex flex-col justify-between hover:border-indigo-500/40 transition-colors">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Scale size={12} className="text-indigo-400" />
                Net Cari Denge (Alacak − Borç)
              </span>
              <span className={`text-[8px] font-sans px-1.5 py-0.5 rounded font-bold ${
                totalCustomerClosing >= totalSupplierClosing
                  ? 'bg-emerald-500/10 text-emerald-300'
                  : 'bg-rose-500/10 text-rose-300'
              }`}>
                {totalCustomerClosing >= totalSupplierClosing ? 'Net Alacaklıyız' : 'Net Borçluyuz'}
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className={`text-lg font-black font-mono ${
                totalCustomerClosing >= totalSupplierClosing
                  ? 'text-emerald-400'
                  : 'text-rose-400'
              }`}>
                {totalCustomerClosing >= totalSupplierClosing ? '+' : ''}
                {formatMoney(totalCustomerClosing - totalSupplierClosing, 'TRY').formatted}
              </div>
              <div className="text-[9px] text-slate-400 font-mono">
                Dönem Başı: {formatMoney(totalCustomerOpening - totalSupplierOpening, 'TRY').formatted}
              </div>
            </div>
            <div className="text-[9px] text-slate-500 mt-1 border-t border-slate-800/60 pt-1 flex justify-between font-mono">
              <span>Cari Bakiye Hacmi:</span>
              <span className="text-white font-bold">{formatMoney(totalCustomerClosing + totalSupplierClosing, 'TRY').formatted}</span>
            </div>
          </div>
        </div>

        {/* BASKI ÖZEL: ULTRA-KOMPAKT 6'LI YÖNETİCİ VE CARİ STRIP (YALNIZCA BASKIDA GÖRÜNÜR) */}
        <div className="hidden print:grid print:grid-cols-6 print:gap-1 print:mb-1.5 print:border print:border-black print:p-1 print:rounded-none print:bg-slate-50 print-color-adjust">
          <div className="text-left border-r border-slate-300 pr-1">
            <span className="text-[5.5px] uppercase font-bold text-slate-600 block leading-tight">Toplam Giriş</span>
            <span className="text-[7.5px] font-black text-black font-mono leading-tight">{formatMoney(totalPeriodInflow, 'TRY').formatted}</span>
          </div>
          <div className="text-left border-r border-slate-300 pr-1">
            <span className="text-[5.5px] uppercase font-bold text-slate-600 block leading-tight">Toplam Çıkış</span>
            <span className="text-[7.5px] font-black text-black font-mono leading-tight">{formatMoney(totalPeriodOutflow, 'TRY').formatted}</span>
          </div>
          <div className="text-left border-r border-slate-300 pr-1">
            <span className="text-[5.5px] uppercase font-bold text-slate-600 block leading-tight">Net Nakit Akışı</span>
            <span className="text-[7.5px] font-black text-black font-mono leading-tight">{netPeriodFlow >= 0 ? '+' : ''}{formatMoney(netPeriodFlow, 'TRY').formatted}</span>
          </div>
          <div className="text-left border-r border-slate-300 pr-1">
            <span className="text-[5.5px] uppercase font-bold text-slate-600 block leading-tight">Açık Alacak</span>
            <span className="text-[7.5px] font-black text-black font-mono leading-tight">{formatMoney(totalCustomerClosing, 'TRY').formatted}</span>
          </div>
          <div className="text-left border-r border-slate-300 pr-1">
            <span className="text-[5.5px] uppercase font-bold text-slate-600 block leading-tight">Açık Borç</span>
            <span className="text-[7.5px] font-black text-black font-mono leading-tight">{formatMoney(totalSupplierClosing, 'TRY').formatted}</span>
          </div>
          <div className="text-left">
            <span className="text-[5.5px] uppercase font-bold text-slate-600 block leading-tight">Net Cari Denge</span>
            <span className="text-[7.5px] font-black text-black font-mono leading-tight">{totalCustomerClosing >= totalSupplierClosing ? '+' : ''}{formatMoney(totalCustomerClosing - totalSupplierClosing, 'TRY').formatted}</span>
          </div>
        </div>

        {/* GÜNLÜK İNTERAKTİF NAKİT AKIŞ VE TREND GRAFİĞİ (SEÇENEĞE GÖRE BASKIDA YER ALIR) */}
        <div className={`bg-[#070b14] border border-slate-800/90 rounded-xl p-4 print-force-transparent ${includeChartInPrint ? 'print:block print:p-2 print:mb-2' : 'print:hidden'}`}>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 mb-3 print:mb-1">
            <div>
              <h2 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2 print-text-black print:text-[8px]">
                <BarChart2 size={15} className="text-indigo-400 print:hidden" />
                Günlük Nakit Akışı & Trend Grafiği
              </h2>
              <p className="text-[10px] text-slate-400 print-text-black print:text-[7px]">
                Tahsilat (yeşil), harcama (kırmızı) ve net eğrisi.
              </p>
            </div>

            <div className="flex items-center gap-3 text-[10px] font-bold print:text-[7px]">
              <span className="flex items-center gap-1.5 text-emerald-400 print:text-black">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block print:w-1.5 print:h-1.5" /> Giriş
              </span>
              <span className="flex items-center gap-1.5 text-rose-400 print:text-black">
                <span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block print:w-1.5 print:h-1.5" /> Çıkış
              </span>
              <span className="flex items-center gap-1.5 text-cyan-400 print:text-black">
                <span className="w-2.5 h-0.5 bg-cyan-400 inline-block print:w-1.5" /> Net
              </span>
            </div>
          </div>

          {/* SVG Çizim Alanı */}
          <div className="relative w-full h-56 bg-[#040711] border border-slate-900 rounded-lg p-2 overflow-hidden print:bg-white print:h-24 print-color-adjust">
            {dailyStats.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-500 font-medium">
                Bu tarih aralığında gösterilecek günlük hareket bulunamadı.
              </div>
            ) : (
              <svg viewBox={`0 0 ${Math.max(600, dailyStats.length * 32)} 200`} className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#059669" stopOpacity="0.3" />
                  </linearGradient>
                  <linearGradient id="roseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#e11d48" stopOpacity="0.3" />
                  </linearGradient>
                </defs>

                <line x1="0" y1="40" x2="100%" y2="40" stroke="#1e293b" strokeDasharray="3 3" strokeWidth="0.5" />
                <line x1="0" y1="95" x2="100%" y2="95" stroke="#1e293b" strokeDasharray="3 3" strokeWidth="0.5" />
                <line x1="0" y1="150" x2="100%" y2="150" stroke="#1e293b" strokeDasharray="3 3" strokeWidth="0.5" />

                {dailyStats.length > 1 && (
                  <path
                    d={dailyStats.map((s, idx) => {
                      const totalW = Math.max(600, dailyStats.length * 32)
                      const step = totalW / dailyStats.length
                      const x = idx * step + step / 2
                      const y = 150 - (Math.max(0, s.net) / chartMaxVal) * 110 + (s.net < 0 ? (Math.abs(s.net) / chartMaxVal) * 20 : 0)
                      return `${idx === 0 ? 'M' : 'L'} ${x} ${Math.max(30, Math.min(170, y))}`
                    }).join(' ')}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.85"
                  />
                )}

                {dailyStats.map((s, idx) => {
                  const totalW = Math.max(600, dailyStats.length * 32)
                  const step = totalW / dailyStats.length
                  const xCenter = idx * step + step / 2
                  const barW = Math.max(4, Math.min(10, step * 0.35))
                  const inH = (s.inflow / chartMaxVal) * 120
                  const outH = (s.outflow / chartMaxVal) * 120
                  const isSelected = selectedDay === s.date
                  const isHovered = hoveredDay?.date === s.date

                  return (
                    <g key={s.date} className="cursor-pointer group" onClick={() => setSelectedDay(selectedDay === s.date ? null : s.date)}>
                      <rect
                        x={idx * step + 2}
                        y="10"
                        width={step - 4}
                        height="160"
                        fill={isSelected ? '#4f46e5' : isHovered ? '#ffffff' : 'transparent'}
                        opacity={isSelected ? 0.2 : isHovered ? 0.05 : 0}
                        rx="4"
                        onMouseEnter={() => setHoveredDay(s)}
                        onMouseLeave={() => setHoveredDay(null)}
                      />
                      {s.inflow > 0 && <rect x={xCenter - barW - 1} y={150 - inH} width={barW} height={Math.max(3, inH)} fill="url(#emeraldGrad)" rx="2" />}
                      {s.outflow > 0 && <rect x={xCenter + 1} y={150 - outH} width={barW} height={Math.max(3, outH)} fill="url(#roseGrad)" rx="2" />}
                      <circle
                        cx={xCenter}
                        cy={Math.max(30, Math.min(170, 150 - (Math.max(0, s.net) / chartMaxVal) * 110 + (s.net < 0 ? (Math.abs(s.net) / chartMaxVal) * 20 : 0)))}
                        r={isSelected ? "4.5" : "3"}
                        fill={isSelected ? "#38bdf8" : "#06b6d4"}
                        stroke="#0a0f1d"
                        strokeWidth="1.5"
                      />
                      {(dailyStats.length <= 31 || idx % Math.ceil(dailyStats.length / 20) === 0) && (
                        <text
                          x={xCenter}
                          y="180"
                          textAnchor="middle"
                          fill={isSelected ? '#818cf8' : '#64748b'}
                          fontSize="9"
                          fontFamily="monospace"
                          fontWeight={isSelected ? 'bold' : 'normal'}
                        >
                          {formatShortDateTR(s.date)}
                        </text>
                      )}
                    </g>
                  )
                })}
              </svg>
            )}

            {hoveredDay && (
              <div
                style={{ animation: 'fadeInUp 0.15s both' }}
                className="absolute top-3 right-3 bg-[#0f172a]/95 border border-slate-700/80 p-2.5 rounded-lg shadow-2xl pointer-events-none text-[10px] font-mono z-20 backdrop-blur-md"
              >
                <div className="font-bold text-white font-sans text-xs border-b border-slate-700 pb-1 mb-1.5 flex items-center justify-between gap-4">
                  <span>📅 {formatDateTR(hoveredDay.date)}</span>
                  <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">{hoveredDay.items.length} Hareket</span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between gap-3 text-emerald-400">
                    <span>Giriş:</span>
                    <span className="font-bold">{formatMoney(hoveredDay.inflow, 'TRY').formatted}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-rose-400">
                    <span>Çıkış:</span>
                    <span className="font-bold">{formatMoney(hoveredDay.outflow, 'TRY').formatted}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-cyan-300 border-t border-slate-800 pt-1 font-bold">
                    <span>Net Fark:</span>
                    <span>{hoveredDay.net >= 0 ? '+' : ''}{formatMoney(hoveredDay.net, 'TRY').formatted}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-800/80 text-xs print:hidden">
            <div className="flex items-center gap-2">
              {selectedDay ? (
                <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 px-2.5 py-1 rounded-md text-[11px] text-indigo-300 font-medium">
                  <span>Seçili Gün: <strong>{formatDateTR(selectedDay)}</strong> ({dailyStats.find(s => s.date === selectedDay)?.items.length || 0} işlem)</span>
                  <button onClick={() => setSelectedDay(null)} className="hover:text-white ml-1 text-slate-400 cursor-pointer">
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <span className="text-slate-400 text-[11px] flex items-center gap-1.5">
                  <HelpCircle size={13} className="text-slate-500" /> Grafikteki sütunlara tıklayarak o günün hareketlerini listeleyebilirsiniz.
                </span>
              )}
            </div>

            <button
              onClick={() => setShowDrilldown(!showDrilldown)}
              className="bg-[#0f172a] hover:bg-slate-800 text-slate-300 border border-slate-700 px-3 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Layers size={13} className="text-indigo-400" />
              <span>{showDrilldown ? 'İşlem Dökümünü Gizle' : 'Günlük İşlem Dökümünü Göster'}</span>
              {showDrilldown ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>
        </div>

        {/* GÜNLÜK İŞLEM DETAY DÖKÜM TABLOSU (BASKIDA HER ZAMAN GİZLENİR) */}
        {showDrilldown && (
          <div style={{ animation: 'fadeInUp 0.3s both' }} className="bg-[#070b14] border border-indigo-500/30 rounded-xl p-4 print:hidden">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-3">
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Layers size={15} className="text-indigo-400" />
                  {selectedDay ? `📅 ${formatDateTR(selectedDay)} Tarihli Hareket Dökümü` : 'Dönem İçi Tüm Günlük İşlem Hareketleri'}
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono font-normal">
                    {currentFilteredDrilldown.length} Kayıt
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Fatura, tahsilat, masraf, kasa ve banka hareketlerinin kronolojik dökümü</p>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="İşlem veya cari ara..."
                    value={drilldownSearch}
                    onChange={(e) => setDrilldownSearch(e.target.value)}
                    className="w-full bg-[#0a0f1d] border border-slate-800 text-white text-xs pl-7 pr-3 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500"
                  />
                  {drilldownSearch && (
                    <button onClick={() => setDrilldownSearch('')} className="absolute right-2 top-2 text-slate-500 hover:text-white">
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="border border-slate-800/80 rounded-lg overflow-hidden max-h-72 overflow-y-auto custom-scrollbar">
              <table className="w-full text-left text-[10px] font-mono">
                <thead className="bg-[#0a0f1d] border-b border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="p-2 font-bold font-sans text-slate-400 uppercase">Tarih</th>
                    <th className="p-2 font-bold font-sans text-slate-400 uppercase">İşlem Türü</th>
                    <th className="p-2 font-bold font-sans text-slate-400 uppercase">Açıklama / Muhatap</th>
                    <th className="p-2 font-bold font-sans text-slate-400 uppercase">Ödeme Kaynağı</th>
                    <th className="p-2 font-bold font-sans text-slate-400 uppercase text-right">Tutar (TRY)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {currentFilteredDrilldown.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center font-sans text-slate-500 py-4">Bu kriterlere uygun işlem hareketi bulunamadı.</td>
                    </tr>
                  ) : (
                    currentFilteredDrilldown.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-slate-800/20 transition-colors">
                        <td className="p-2 text-slate-300 font-sans">{formatDateTR(item.date)}</td>
                        <td className="p-2">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-sans font-bold ${
                            item.type === 'in' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {item.module}
                          </span>
                        </td>
                        <td className="p-2 text-white font-sans truncate max-w-xs">{item.description}</td>
                        <td className="p-2 text-slate-400 font-sans">{item.source}</td>
                        <td className={`p-2 text-right font-bold ${item.type === 'in' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {item.type === 'in' ? '+' : '-'}{formatMoney(item.amountTry, 'TRY').formatted}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* KATEGORİ HARCAMA DAĞILIMI VE POS KANAL ANALİZİ (SEÇENEĞE GÖRE BASKIDA YER ALIR) */}
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 print-force-transparent ${includeChartInPrint ? 'print:grid print:gap-2 print:mb-2' : 'print:hidden'}`}>
          <div className="bg-[#070b14] border border-slate-800 rounded-xl p-3.5 print-force-transparent print:p-2">
            <h3 className="text-[10px] font-bold text-slate-300 print-text-black uppercase tracking-widest mb-2.5 flex items-center gap-1.5 print:text-[8px] print:mb-1">
              <PieChart size={13} className="text-rose-400 print:hidden" />
              Gider ve Masraf Kategorileri Dağılımı
            </h3>
            {expenseCategoryStats.length === 0 ? (
              <div className="text-[10px] text-slate-500 py-2 text-center font-sans">Bu dönemde kayıtlı gider bulunamadı.</div>
            ) : (
              <div className="space-y-2 font-mono text-[9px] print:space-y-1 print:text-[7.5px]">
                {expenseCategoryStats.slice(0, 4).map(cat => (
                  <div key={cat.name} className="space-y-0.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-300 print-text-black font-sans truncate max-w-[200px]">{cat.name}</span>
                      <span className="font-bold text-rose-400 print:text-black">
                        {formatMoney(cat.amount, 'TRY').formatted} ({cat.pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden print-color-adjust print:h-1">
                      <div style={{ width: `${cat.pct}%` }} className="h-full bg-rose-500 rounded-full print-color-adjust" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#070b14] border border-slate-800 rounded-xl p-3.5 print-force-transparent print:p-2">
            <h3 className="text-[10px] font-bold text-slate-300 print-text-black uppercase tracking-widest mb-2.5 flex items-center gap-1.5 print:text-[8px] print:mb-1">
              <ShoppingBag size={13} className="text-teal-400 print:hidden" />
              Mağaza Satış Kanalı (Nakit vs. Kredi Kartı)
            </h3>
            {posChannelStats.total === 0 ? (
              <div className="text-[10px] text-slate-500 py-2 text-center font-sans">Bu dönemde mağaza Z-raporu satışı bulunamadı.</div>
            ) : (
              <div className="space-y-2 font-mono text-[9px] print:space-y-1 print:text-[7.5px]">
                <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-800 print-color-adjust print:h-1.5">
                  <div style={{ width: `${(posChannelStats.cash / posChannelStats.total) * 100}%` }} className="bg-emerald-500 print-color-adjust" />
                  <div style={{ width: `${(posChannelStats.card / posChannelStats.total) * 100}%` }} className="bg-purple-500 print-color-adjust" />
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-800/80 print-force-transparent">
                    <span className="text-[8px] text-slate-400 font-sans block">Nakit Satış</span>
                    <span className="text-[10px] font-bold text-emerald-400 print:text-black">{formatMoney(posChannelStats.cash, 'TRY').formatted}</span>
                  </div>
                  <div className="bg-slate-900/60 p-1.5 rounded-lg border border-slate-800/80 print-force-transparent">
                    <span className="text-[8px] text-slate-400 font-sans block">POS Kart Satış</span>
                    <span className="text-[10px] font-bold text-purple-400 print:text-black">{formatMoney(posChannelStats.card, 'TRY').formatted}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FİNANSAL MİZAN TABLOLARI - EKRANDA DİKEY AKAR, BASKIDA MAKSİMUM EKONOMİK 2 SÜTUN OLARAK TEK SAYFAYA SIĞAR */}
        <div className="space-y-6 print:space-y-0 print:grid print:grid-cols-2 print:gap-2">
          
          {/* BASKI SOL SÜTUN (KAYNAKLAR, KASALAR, BANKALAR, KARTLAR, DEPOLAR) */}
          <div className="space-y-6 print:space-y-1.5 print:col-span-1">
            
            {/* 1. İŞLEM GÖREN KAYNAKLARIN HACİM DAĞILIMI */}
            <div className="print-break-avoid">
              <h2 className="text-[10px] font-bold text-slate-500 print-text-black uppercase tracking-widest mb-1.5 print:text-[7.5px] print:mb-0.5 print:leading-tight">
                1. İşlem Gören Kaynakların Dağılımı
              </h2>
              {/* Ekranda: 3'lü Renkli Kartlar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 print:hidden">
                <DistributionCard title="Gider & Masraf" data={expSources} delay="0.15s" />
                <DistributionCard title="Tedarikçi Ödeme" data={suppSources} delay="0.2s" />
                <DistributionCard title="Müşteri Tahsilat" data={{...custSources, total: custSources.total}} delay="0.25s" />
              </div>
              {/* Baskıda: Ultra-Kompakt Mizan Matrisi */}
              <div className="hidden print:block print-force-transparent border border-slate-800/50 rounded overflow-hidden">
                <table className="w-full text-left font-mono">
                  <thead className="bg-[#0a0f1d] border-b border-slate-800/50">
                    <tr>
                      <th className="font-bold font-sans uppercase print-text-black text-left p-1">İşlem / Kaynak</th>
                      <th className="font-bold font-sans uppercase print-text-black text-right p-1">Nakit Kasa</th>
                      <th className="font-bold font-sans uppercase print-text-black text-right p-1">Banka (EFT)</th>
                      <th className="font-bold font-sans uppercase print-text-black text-right p-1">Kredi Kartı</th>
                      <th className="font-bold font-sans uppercase print-text-black text-right p-1 bg-slate-800/30">Toplam</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/30">
                    <tr>
                      <td className="text-slate-200 print-text-black font-sans font-medium p-1">Genel Giderler</td>
                      <td className="text-right p-1">{formatMoney(expSources.cash, 'TRY').formatted}</td>
                      <td className="text-right p-1">{formatMoney(expSources.bank, 'TRY').formatted}</td>
                      <td className="text-right p-1">{formatMoney(expSources.card, 'TRY').formatted}</td>
                      <td className="text-right font-bold p-1 bg-slate-800/10">{formatMoney(expSources.total, 'TRY').formatted}</td>
                    </tr>
                    <tr>
                      <td className="text-slate-200 print-text-black font-sans font-medium p-1">Tedarikçi Ödeme</td>
                      <td className="text-right p-1">{formatMoney(suppSources.cash, 'TRY').formatted}</td>
                      <td className="text-right p-1">{formatMoney(suppSources.bank, 'TRY').formatted}</td>
                      <td className="text-right p-1">{formatMoney(suppSources.card, 'TRY').formatted}</td>
                      <td className="text-right font-bold p-1 bg-slate-800/10">{formatMoney(suppSources.total, 'TRY').formatted}</td>
                    </tr>
                    <tr>
                      <td className="text-slate-200 print-text-black font-sans font-medium p-1">Müşteri Tahsilat</td>
                      <td className="text-right p-1">{formatMoney(custSources.cash, 'TRY').formatted}</td>
                      <td className="text-right p-1">{formatMoney(custSources.bank, 'TRY').formatted}</td>
                      <td className="text-right p-1">{formatMoney(custSources.card, 'TRY').formatted}</td>
                      <td className="text-right font-bold p-1 bg-slate-800/10">{formatMoney(custSources.total, 'TRY').formatted}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. NAKİT KASALAR HAREKET ÖZETİ */}
            <div className="print-break-avoid">
              <h2 className="text-[10px] font-bold text-slate-500 print-text-black uppercase tracking-widest mb-1.5 flex items-center gap-1.5 print:text-[7.5px] print:mb-0.5 print:leading-tight">
                <span>2. Nakit Kasalar Hareket Özeti</span>
              </h2>
              <div className="print-force-transparent border border-slate-800/50 rounded-lg overflow-hidden">
                <table className="w-full text-left text-[9px] font-mono">
                  <thead className="bg-[#0a0f1d] border-b border-slate-800/50">
                    <tr>
                      <th className="font-bold font-sans uppercase print-text-black text-left p-2 print:p-1">Kasa Adı</th>
                      <th className="font-bold font-sans uppercase print-text-black text-right p-2 print:p-1">D.Başı</th>
                      <th className="font-bold font-sans uppercase text-emerald-400 print:text-black text-right p-2 print:p-1">Giren (+)</th>
                      <th className="font-bold font-sans uppercase text-rose-400 print:text-black text-right p-2 print:p-1">Çıkan (-)</th>
                      <th className="font-bold font-sans uppercase print-text-black text-right p-2 print:p-1 bg-slate-800/30">D.Sonu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/30">
                    {cashAnalysis.length === 0 ? (
                      <tr><td colSpan={5} className="text-center font-sans text-slate-500 py-1.5 print:py-1">Bu dönemde hareket yok.</td></tr>
                    ) : cashAnalysis.map((c, index) => (
                      <tr key={c.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="text-slate-200 print-text-black font-sans font-medium p-2 print:p-1">
                          {c.name} {c.currency !== 'TRY' && <span className="text-[7.5px] text-slate-400 font-mono">({c.currency})</span>}
                        </td>
                        <td className="text-slate-400 print-text-black text-right p-2 print:p-1">{formatMoney(c.opening, 'TRY').formatted}</td>
                        <td className="text-emerald-400 print-text-black text-right font-bold p-2 print:p-1">{formatMoney(c.in, 'TRY').formatted}</td>
                        <td className="text-rose-400 print-text-black text-right font-bold p-2 print:p-1">{formatMoney(c.out, 'TRY').formatted}</td>
                        <td className="text-slate-200 print-text-black text-right font-bold p-2 print:p-1 bg-slate-800/10">{formatMoney(c.closing, 'TRY').formatted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. BANKALAR HAREKET ÖZETİ */}
            <div className="print-break-avoid">
              <h2 className="text-[10px] font-bold text-slate-500 print-text-black uppercase tracking-widest mb-1.5 print:text-[7.5px] print:mb-0.5 print:leading-tight">
                3. Banka Hesapları Hareket Özeti
              </h2>
              <div className="print-force-transparent border border-slate-800/50 rounded-lg overflow-hidden">
                <table className="w-full text-left text-[9px] font-mono">
                  <thead className="bg-[#0a0f1d] border-b border-slate-800/50">
                    <tr>
                      <th className="font-bold font-sans uppercase print-text-black text-left p-2 print:p-1">Banka Adı</th>
                      <th className="font-bold font-sans uppercase print-text-black text-right p-2 print:p-1">D.Başı</th>
                      <th className="font-bold font-sans uppercase text-emerald-400 print:text-black text-right p-2 print:p-1">Giren (+)</th>
                      <th className="font-bold font-sans uppercase text-rose-400 print:text-black text-right p-2 print:p-1">Çıkan (-)</th>
                      <th className="font-bold font-sans uppercase print-text-black text-right p-2 print:p-1 bg-slate-800/30">D.Sonu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/30">
                    {bankAnalysis.length === 0 ? (
                      <tr><td colSpan={5} className="text-center font-sans text-slate-500 py-1.5 print:py-1">Bu dönemde hareket yok.</td></tr>
                    ) : bankAnalysis.map((b, index) => (
                      <tr key={b.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="text-slate-200 print-text-black font-sans font-medium p-2 print:p-1">{b.bank_name}</td>
                        <td className="text-slate-400 print-text-black text-right p-2 print:p-1">{formatMoney(b.opening, 'TRY').formatted}</td>
                        <td className="text-emerald-400 print-text-black text-right font-bold p-2 print:p-1">{formatMoney(b.in, 'TRY').formatted}</td>
                        <td className="text-rose-400 print-text-black text-right font-bold p-2 print:p-1">{formatMoney(b.out, 'TRY').formatted}</td>
                        <td className="text-slate-200 print-text-black text-right font-bold p-2 print:p-1 bg-slate-800/10">{formatMoney(b.closing, 'TRY').formatted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 4. KREDİ KARTLARI HAREKET ÖZETİ */}
            <div className="print-break-avoid">
              <h2 className="text-[10px] font-bold text-slate-500 print-text-black uppercase tracking-widest mb-1.5 print:text-[7.5px] print:mb-0.5 print:leading-tight">
                4. Kredi Kartları Hareket Özeti
              </h2>
              <div className="print-force-transparent border border-slate-800/50 rounded-lg overflow-hidden">
                <table className="w-full text-left text-[9px] font-mono">
                  <thead className="bg-[#0a0f1d] border-b border-slate-800/50">
                    <tr>
                      <th className="font-bold font-sans uppercase print-text-black text-left p-2 print:p-1">Kart Adı</th>
                      <th className="font-bold font-sans uppercase print-text-black text-right p-2 print:p-1">D.Başı</th>
                      <th className="font-bold font-sans uppercase text-rose-400 print:text-black text-right p-2 print:p-1">Harcama (+)</th>
                      <th className="font-bold font-sans uppercase text-emerald-400 print:text-black text-right p-2 print:p-1">Ödeme (-)</th>
                      <th className="font-bold font-sans uppercase print-text-black text-right p-2 print:p-1 bg-slate-800/30">D.Sonu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/30">
                    {cardAnalysis.length === 0 ? (
                      <tr><td colSpan={5} className="text-center font-sans text-slate-500 py-1.5 print:py-1">Bu dönemde hareket yok.</td></tr>
                    ) : cardAnalysis.map((c, index) => (
                      <tr key={c.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="text-slate-200 print-text-black font-sans font-medium p-2 print:p-1">{c.name}</td>
                        <td className="text-slate-400 print-text-black text-right p-2 print:p-1">{formatMoney(c.opening, 'TRY').formatted}</td>
                        <td className="text-rose-400 print-text-black text-right font-bold p-2 print:p-1">{formatMoney(c.increase, 'TRY').formatted}</td>
                        <td className="text-emerald-400 print-text-black text-right font-bold p-2 print:p-1">{formatMoney(c.decrease, 'TRY').formatted}</td>
                        <td className="text-slate-200 print-text-black text-right font-bold p-2 print:p-1 bg-slate-800/10">{formatMoney(c.closing, 'TRY').formatted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 7. DEPOLAR HAREKET ÖZETİ (SOL SÜTUNA ALINDI - SATIR DENGELEMESİ) */}
            <div className="print-break-avoid">
              <h2 className="text-[10px] font-bold text-slate-500 print-text-black uppercase tracking-widest mb-1.5 print:text-[7.5px] print:mb-0.5 print:leading-tight">
                7. Depo ve Sermaye Durum Özeti
              </h2>
              <div className="print-force-transparent border border-slate-800/50 rounded-lg overflow-hidden">
                <table className="w-full text-left text-[9px] font-mono">
                  <thead className="bg-[#0a0f1d] border-b border-slate-800/50">
                    <tr>
                      <th className="font-bold font-sans uppercase print-text-black text-left p-2 print:p-1">Depo Adı</th>
                      <th className="font-bold font-sans uppercase print-text-black text-right p-2 print:p-1">D.Başı</th>
                      <th className="font-bold font-sans uppercase text-emerald-400 print:text-black text-right p-2 print:p-1">Giren (+)</th>
                      <th className="font-bold font-sans uppercase text-rose-400 print:text-black text-right p-2 print:p-1">Çıkan (-)</th>
                      <th className="font-bold font-sans uppercase print-text-black text-right p-2 print:p-1 bg-slate-800/30">D.Sonu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/30">
                    {whAnalysis.length === 0 ? (
                      <tr><td colSpan={5} className="text-center font-sans text-slate-500 py-1.5 print:py-1">Bu dönemde hareket yok.</td></tr>
                    ) : whAnalysis.map((w, index) => (
                      <tr key={w.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="text-slate-200 print-text-black font-sans font-medium p-2 print:p-1">{w.name}</td>
                        <td className="text-slate-400 print-text-black text-right p-2 print:p-1">{formatMoney(w.opening, 'TRY').formatted}</td>
                        <td className="text-emerald-400 print-text-black text-right font-bold p-2 print:p-1">{formatMoney(w.in, 'TRY').formatted}</td>
                        <td className="text-rose-400 print-text-black text-right font-bold p-2 print:p-1">{formatMoney(w.out, 'TRY').formatted}</td>
                        <td className="text-slate-200 print-text-black text-right font-bold p-2 print:p-1 bg-slate-800/10">{formatMoney(w.closing, 'TRY').formatted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* BASKI SAĞ SÜTUN (MÜŞTERİLER VE TEDARİKÇİLER CARİ MİZANI) */}
          <div className="space-y-6 print:space-y-1.5 print:col-span-1">
            
            {/* 5. MÜŞTERİLER (ALACAKLARIMIZ) HAREKET ÖZETİ */}
            <div className="print-break-avoid">
              <div className="flex justify-between items-center mb-1.5 print:mb-0.5">
                <h2 className="text-[10px] font-bold text-slate-500 print-text-black uppercase tracking-widest flex items-center gap-1.5 print:text-[7.5px] print:leading-tight">
                  <span>5. Müşteriler (Alacaklarımız) Mizanı</span>
                </h2>
                <span className="text-[9px] font-mono text-slate-400 print-text-black print:text-[7px]">
                  Açık: <strong className="text-emerald-400 print:text-black font-bold">{formatMoney(totalCustomerClosing, 'TRY').formatted}</strong>
                </span>
              </div>
              <div className="print-force-transparent border border-slate-800/50 rounded-lg overflow-hidden">
                <table className="w-full text-left text-[9px] font-mono">
                  <thead className="bg-[#0a0f1d] border-b border-slate-800/50">
                    <tr>
                      <th className="font-bold font-sans uppercase print-text-black text-left p-2 print:p-1">Müşteri Adı</th>
                      <th className="font-bold font-sans uppercase print-text-black text-right p-2 print:p-1">D.Başı</th>
                      <th className="font-bold font-sans uppercase text-emerald-400 print:text-black text-right p-2 print:p-1">Satış (+)</th>
                      <th className="font-bold font-sans uppercase text-blue-400 print:text-black text-right p-2 print:p-1">Tahsilat (-)</th>
                      <th className="font-bold font-sans uppercase print-text-black text-right p-2 print:p-1 bg-slate-800/30">D.Sonu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/30">
                    {customerAnalysis.length === 0 ? (
                      <tr><td colSpan={5} className="text-center font-sans text-slate-500 py-1.5 print:py-1">Bu dönemde müşteri alacağı yok.</td></tr>
                    ) : customerAnalysis.map((c, index) => (
                      <tr key={c.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="text-slate-200 print-text-black font-sans font-medium p-2 print:p-1 truncate max-w-[110px]">{c.name}</td>
                        <td className="text-slate-400 print-text-black text-right p-2 print:p-1">{formatMoney(c.opening, 'TRY').formatted}</td>
                        <td className="text-emerald-400 print-text-black text-right font-bold p-2 print:p-1">{formatMoney(c.debt, 'TRY').formatted}</td>
                        <td className="text-blue-400 print-text-black text-right font-bold p-2 print:p-1">{formatMoney(c.payment, 'TRY').formatted}</td>
                        <td className="text-slate-200 print-text-black text-right font-bold p-2 print:p-1 bg-slate-800/10">{formatMoney(c.closing, 'TRY').formatted}</td>
                      </tr>
                    ))}
                  </tbody>
                  {customerAnalysis.length > 0 && (
                    <tfoot className="bg-[#070b14] border-t border-slate-700 font-bold">
                      <tr>
                        <td className="p-2 print:p-1 text-slate-400 print-text-black font-sans uppercase">Toplam</td>
                        <td className="p-2 print:p-1 text-right text-slate-300 print-text-black">{formatMoney(totalCustomerOpening, 'TRY').formatted}</td>
                        <td className="p-2 print:p-1 text-right text-emerald-400 print-text-black">{formatMoney(totalCustomerDebt, 'TRY').formatted}</td>
                        <td className="p-2 print:p-1 text-right text-blue-400 print-text-black">{formatMoney(totalCustomerPayment, 'TRY').formatted}</td>
                        <td className="p-2 print:p-1 text-right text-emerald-400 print-text-black bg-slate-800/20">{formatMoney(totalCustomerClosing, 'TRY').formatted}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* 6. TEDARİKÇİLER (BORÇLARIMIZ) HAREKET ÖZETİ */}
            <div className="print-break-avoid">
              <div className="flex justify-between items-center mb-1.5 print:mb-0.5">
                <h2 className="text-[10px] font-bold text-slate-500 print-text-black uppercase tracking-widest flex items-center gap-1.5 print:text-[7.5px] print:leading-tight">
                  <span>6. Tedarikçiler (Borçlarımız) Mizanı</span>
                </h2>
                <span className="text-[9px] font-mono text-slate-400 print-text-black print:text-[7px]">
                  Açık: <strong className="text-rose-400 print:text-black font-bold">{formatMoney(totalSupplierClosing, 'TRY').formatted}</strong>
                </span>
              </div>
              <div className="print-force-transparent border border-slate-800/50 rounded-lg overflow-hidden">
                <table className="w-full text-left text-[9px] font-mono">
                  <thead className="bg-[#0a0f1d] border-b border-slate-800/50">
                    <tr>
                      <th className="font-bold font-sans uppercase print-text-black text-left p-2 print:p-1">Tedarikçi Adı</th>
                      <th className="font-bold font-sans uppercase print-text-black text-right p-2 print:p-1">D.Başı</th>
                      <th className="font-bold font-sans uppercase text-rose-400 print:text-black text-right p-2 print:p-1">Alış (+)</th>
                      <th className="font-bold font-sans uppercase text-emerald-400 print:text-black text-right p-2 print:p-1">Ödeme (-)</th>
                      <th className="font-bold font-sans uppercase print-text-black text-right p-2 print:p-1 bg-slate-800/30">D.Sonu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/30">
                    {supplierAnalysis.length === 0 ? (
                      <tr><td colSpan={5} className="text-center font-sans text-slate-500 py-1.5 print:py-1">Bu dönemde tedarikçi borcu yok.</td></tr>
                    ) : supplierAnalysis.map((s, index) => (
                      <tr key={s.id} className="hover:bg-slate-800/20 transition-colors">
                        <td className="text-slate-200 print-text-black font-sans font-medium p-2 print:p-1 truncate max-w-[110px]">{s.name}</td>
                        <td className="text-slate-400 print-text-black text-right p-2 print:p-1">{formatMoney(s.opening, 'TRY').formatted}</td>
                        <td className="text-rose-400 print-text-black text-right font-bold p-2 print:p-1">{formatMoney(s.debt, 'TRY').formatted}</td>
                        <td className="text-emerald-400 print-text-black text-right font-bold p-2 print:p-1">{formatMoney(s.payment, 'TRY').formatted}</td>
                        <td className="text-slate-200 print-text-black text-right font-bold p-2 print:p-1 bg-slate-800/10">{formatMoney(s.closing, 'TRY').formatted}</td>
                      </tr>
                    ))}
                  </tbody>
                  {supplierAnalysis.length > 0 && (
                    <tfoot className="bg-[#070b14] border-t border-slate-700 font-bold">
                      <tr>
                        <td className="p-2 print:p-1 text-slate-400 print-text-black font-sans uppercase">Toplam</td>
                        <td className="p-2 print:p-1 text-right text-slate-300 print-text-black">{formatMoney(totalSupplierOpening, 'TRY').formatted}</td>
                        <td className="p-2 print:p-1 text-right text-rose-400 print-text-black">{formatMoney(totalSupplierDebt, 'TRY').formatted}</td>
                        <td className="p-2 print:p-1 text-right text-emerald-400 print-text-black">{formatMoney(totalSupplierPayment, 'TRY').formatted}</td>
                        <td className="p-2 print:p-1 text-right text-rose-400 print-text-black bg-slate-800/20">{formatMoney(totalSupplierClosing, 'TRY').formatted}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  )
}
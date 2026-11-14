'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { formatMoney } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  X, Printer, FileDown, Calendar, Landmark, Wallet, CreditCard,
  Building2, Home, Globe, TrendingUp, TrendingDown, Package,
  Users, Scale, BarChart2, PieChart, CheckCircle2, AlertTriangle,
  Sparkles, Layers, Wrench, ShoppingBag, ArrowUpRight, ArrowDownRight
} from 'lucide-react'

export interface ComprehensiveReportProps {
  isOpen: boolean
  onClose: () => void
  initialStartDate: string
  initialEndDate: string
  companies: any[]
  customers: any[]
  suppliers: any[]
  customerTxs: any[]
  supplierTxs: any[]
  expenseTxs: any[]
  stockTxs: any[]
  cashTxs: any[]
  bankTxs: any[]
  cardTxs: any[]
  posTxs: any[]
  techTickets: any[]
  subscriptions: any[]
  loans: any[]
  banks: any[]
  cashes: any[]
  cards: any[]
  warehouses: any[]
  stocks: any[]
  rates: { USD: number; EUR: number }
}

const MONTH_NAMES = [
  { num: '01', name: 'Ocak' },
  { num: '02', name: 'Şubat' },
  { num: '03', name: 'Mart' },
  { num: '04', name: 'Nisan' },
  { num: '05', name: 'Mayıs' },
  { num: '06', name: 'Haziran' },
  { num: '07', name: 'Temmuz' },
  { num: '08', name: 'Ağustos' },
  { num: '09', name: 'Eylül' },
  { num: '10', name: 'Ekim' },
  { num: '11', name: 'Kasım' },
  { num: '12', name: 'Aralık' }
]

const POS_CAT_LABELS: Record<string, string> = {
  aksesuar: 'Mağaza (POS) — Aksesuar Satışları',
  fotokopi: 'Mağaza (POS) — Fotokopi & Çıktı',
  oyun_prog: 'Mağaza (POS) — Oyun & Program',
  dvd_harici: 'Mağaza (POS) — DVD / Harici',
  orjinal: 'Mağaza (POS) — Orijinal Film & Oyun',
  servis: 'Mağaza (POS) — Servis Satışları',
  diger: 'Mağaza (POS) — Diğer Gelirler'
}

function formatDateTR(dateStr: string) {
  if (!dateStr) return '-'
  const clean = String(dateStr).substring(0, 10)
  const parts = clean.split('-')
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`
  return dateStr
}

function cleanCategoryName(raw?: string | null): string {
  if (!raw) return 'Diğer'
  let n = raw.replace(/^fixed::/, '').replace(/^variable::/, '')
  if (n.includes('::')) n = n.split('::').pop() || n
  return n.trim() || 'Diğer'
}

export default function ComprehensiveAnalysisReportModal({
  isOpen,
  onClose,
  initialStartDate,
  initialEndDate,
  companies,
  customers,
  suppliers,
  customerTxs,
  supplierTxs,
  expenseTxs,
  stockTxs,
  cashTxs,
  bankTxs,
  cardTxs,
  posTxs,
  techTickets,
  subscriptions,
  loans,
  banks,
  cashes,
  cards,
  warehouses,
  stocks,
  rates
}: ComprehensiveReportProps) {
  const [startDate, setStartDate] = useState(initialStartDate)
  const [endDate, setEndDate] = useState(initialEndDate)
  const [selectedYear, setSelectedYear] = useState(() => (initialStartDate || '2026-10-01').substring(0, 4))
  const [selectedMonth, setSelectedMonth] = useState(() => (initialStartDate || '2026-10-01').substring(5, 7))
  const [periodMode, setPeriodMode] = useState<'month' | 'custom'>('month')
  const [sectionFilter, setSectionFilter] = useState<'all' | 'pnl' | 'balance' | 'centers'>('all')

  useEffect(() => {
    if (isOpen && initialStartDate && initialEndDate) {
      setStartDate(initialStartDate)
      setEndDate(initialEndDate)
      const y = initialStartDate.substring(0, 4)
      const m = initialStartDate.substring(5, 7)
      setSelectedYear(y)
      setSelectedMonth(m)
      const lastDay = String(new Date(Number(y), Number(m), 0).getDate()).padStart(2, '0')
      if (initialStartDate === `${y}-${m}-01` && initialEndDate === `${y}-${m}-${lastDay}`) {
        setPeriodMode('month')
      } else {
        setPeriodMode('custom')
      }
    }
  }, [isOpen, initialStartDate, initialEndDate])

  const handleMonthSelect = (year: string, month: string) => {
    setSelectedYear(year)
    setSelectedMonth(month)
    setPeriodMode('month')
    const lastDay = String(new Date(Number(year), Number(month), 0).getDate()).padStart(2, '0')
    setStartDate(`${year}-${month}-01`)
    setEndDate(`${year}-${month}-${lastDay}`)
  }

  const getTry = (amount: number, curr: string = 'TRY') => {
    const c = (curr || 'TRY').toUpperCase()
    return Number(amount || 0) * (c === 'USD' ? rates.USD : c === 'EUR' ? rates.EUR : 1)
  }

  const fmt = (n: number) => formatMoney(Number(n || 0), 'TRY').formatted

  const periodTitle = useMemo(() => {
    if (periodMode === 'month') {
      const mObj = MONTH_NAMES.find(m => m.num === selectedMonth)
      return `${mObj ? mObj.name.toUpperCase() : selectedMonth} ${selectedYear}`
    }
    return `${formatDateTR(startDate)} – ${formatDateTR(endDate)}`
  }, [periodMode, selectedMonth, selectedYear, startDate, endDate])

  // ============================================================================
  // ANA ANALİZ HESAPLAMA MOTORU (MERKEZ BAZLI P&L + VARLIK/ALACAK/BORÇ BİLANÇOSU)
  // ============================================================================
  const reportData = useMemo(() => {
    const custMap: Record<string, any> = {}
    customers.forEach(c => { custMap[c.id] = c })
    const suppMap: Record<string, any> = {}
    suppliers.forEach(s => { suppMap[s.id] = s })
    const bankMap: Record<string, any> = {}
    banks.forEach(b => { bankMap[b.id] = b })
    const stockMap: Record<string, any> = {}
    stocks.forEach(s => { stockMap[s.id] = s })

    const centersList = [
      ...companies.map(c => ({ id: c.id as string | null, name: c.name as string, is_personal: Boolean(c.is_personal) })),
      { id: null, name: 'Ortak / Bağımsız Havuz', is_personal: false }
    ]

    const centerReports = centersList.map(center => {
      const isMatch = (cid: string | null | undefined) => (center.id === null ? !cid : cid === center.id)

      // 1. Cari Satışlar & Tahsilatlar
      const periodCustDebts = customerTxs.filter(t => {
        const d = (t.tx_date || t.created_at || '').substring(0, 10)
        return isMatch(t.company_id) && d >= startDate && d <= endDate && t.tx_type === 'debt'
      })
      const periodCustPayments = customerTxs.filter(t => {
        const d = (t.tx_date || t.created_at || '').substring(0, 10)
        return isMatch(t.company_id) && d >= startDate && d <= endDate && t.tx_type === 'payment'
      })

      const commSales = periodCustDebts.filter(t => !center.is_personal && !t.description?.toLowerCase().includes('açılış') && !t.description?.toLowerCase().includes('devir')).map(t => {
        const revTry = Number(t.amount || 0) * (t.exchange_rate || 1)
        let invoiceCostTry = 0
        if (Array.isArray(t.invoice_lines)) {
          t.invoice_lines.forEach((l: any) => {
            invoiceCostTry += (Number(l.quantity || 1) * Number(l.costPrice || 0))
          })
        }
        return {
          ...t,
          customerName: custMap[t.customer_id]?.name || 'Müşteri',
          revTry,
          invoiceCostTry
        }
      })

      const nonRevDebts = periodCustDebts.filter(t => center.is_personal || t.description?.toLowerCase().includes('açılış') || t.description?.toLowerCase().includes('devir')).map(t => ({
        ...t,
        customerName: custMap[t.customer_id]?.name || 'Kişi / Cari',
        tryVal: Number(t.amount || 0) * (t.exchange_rate || 1)
      }))

      const custPaymentsMapped = periodCustPayments.map(t => ({
        ...t,
        customerName: custMap[t.customer_id]?.name || 'Müşteri',
        tryVal: Number(t.amount || 0) * (t.exchange_rate || 1)
      }))

      // 2. Abonelikler
      const periodSubs = subscriptions.filter(s => {
        const d = (s.start_date || '').substring(0, 10)
        return isMatch(s.company_id) && d >= startDate && d <= endDate
      }).map(s => ({
        ...s,
        revTry: getTry(s.sale_price, s.currency),
        costTry: getTry(s.cost_price, s.currency),
        netTry: getTry(s.sale_price, s.currency) - getTry(s.cost_price, s.currency)
      })).sort((a, b) => (a.start_date || '').localeCompare(b.start_date || ''))

      // 3. Stok Çıkışları
      const periodStockOuts = stockTxs.filter(t => {
        const d = (t.tx_date || '').substring(0, 10)
        return isMatch(t.company_id) && d >= startDate && d <= endDate && t.tx_type === 'out'
      }).map(t => ({
        ...t,
        costTry: getTry(Number(t.quantity || 0) * Number(t.unit_price || 0), t.currency)
      }))

      const stockOutTotal = periodStockOuts.reduce((a, x) => a + x.costTry, 0)
      const stockOutPos = periodStockOuts.filter(x => (x.description || '').includes('Mağaza Satışı')).reduce((a, x) => a + x.costTry, 0)
      const stockOutSrv = periodStockOuts.filter(x => (x.description || '').includes('Servis Parça Çıkışı')).reduce((a, x) => a + x.costTry, 0)
      const stockOutInvoice = stockOutTotal - stockOutPos - stockOutSrv

      // 4. Mağaza (POS) Satışları ve POS Giderleri
      const periodPosSales = posTxs.filter(t => {
        const d = (t.date || '').substring(0, 10)
        return isMatch(t.company_id) && d >= startDate && d <= endDate && t.category_id !== 'gider'
      })

      const posCatMap: Record<string, { id: string; label: string; count: number; cash: number; card: number; rev: number; cost: number; profit: number; marginPct: number }> = {}
      let posCashTotal = 0
      let posCardTotal = 0
      let posRevTotal = 0
      let posUnstockedCostTotal = 0

      periodPosSales.forEach(t => {
        const catId = t.category_id || 'diger'
        const c = Number(t.cash || 0)
        const k = Number(t.card || 0)
        const rev = c + k
        const cost = Number(t.cost || 0)
        posCashTotal += c
        posCardTotal += k
        posRevTotal += rev
        if (!t.stock_id) posUnstockedCostTotal += cost

        if (!posCatMap[catId]) {
          posCatMap[catId] = {
            id: catId,
            label: POS_CAT_LABELS[catId] || `Mağaza (POS) — ${catId}`,
            count: 0,
            cash: 0,
            card: 0,
            rev: 0,
            cost: 0,
            profit: 0,
            marginPct: 0
          }
        }
        posCatMap[catId].count += 1
        posCatMap[catId].cash += c
        posCatMap[catId].card += k
        posCatMap[catId].rev += rev
        posCatMap[catId].cost += cost
      })

      // Stoktan düşen POS maliyeti ile posCatMap['aksesuar'] senkronu
      Object.values(posCatMap).forEach(cat => {
        if (cat.id === 'aksesuar' && stockOutPos > 0) {
          cat.cost = stockOutPos
        }
        cat.profit = cat.rev - cat.cost
        cat.marginPct = cat.rev > 0 ? (cat.profit / cat.rev) * 100 : 0
      })

      const posCategories = Object.values(posCatMap).sort((a, b) => b.rev - a.rev)
      const posTotalSmm = stockOutPos + posUnstockedCostTotal

      // POS Giderleri (Gerçek mağaza masrafı vs [SUPP-...] tedarikçi ödemesi)
      const rawPosExpenses = posTxs.filter(t => {
        const d = (t.date || '').substring(0, 10)
        return isMatch(t.company_id) && d >= startDate && d <= endDate && t.category_id === 'gider' && !t.description?.includes('[EXP-') && !t.description?.startsWith('Gider Ödemesi')
      }).map(t => ({
        ...t,
        expTry: Number(t.cash || 0) + Number(t.card || 0),
        isSupplierPay: Boolean(t.description?.includes('[SUPP-') || t.description?.startsWith('Tedarikçi Ödemesi'))
      }))

      const posTrueExpenses = rawPosExpenses.filter(e => !e.isSupplierPay)
      const posSupplierPayments = rawPosExpenses.filter(e => e.isSupplierPay)

      // 5. Teknik Servis Teslimatları
      const periodTechTickets = techTickets.filter(t => {
        const d = (t.delivered_at || t.created_at || '').substring(0, 10)
        return isMatch(t.company_id) && t.status === 'delivered' && d >= startDate && d <= endDate
      }).map(t => {
        const isFree = t.payment_method === 'free'
        const revTry = isFree ? 0 : Number(t.total_cost || 0)
        const partsCostTry = Number(t.parts_cost || 0)
        return {
          ...t,
          deliveredDate: (t.delivered_at || t.created_at || '').substring(0, 10),
          isFree,
          revTry,
          partsCostTry,
          netTry: revTry - partsCostTry
        }
      }).sort((a, b) => a.deliveredDate.localeCompare(b.deliveredDate) || (a.ticket_no || '').localeCompare(b.ticket_no || ''))

      const techRevTotal = periodTechTickets.reduce((a, t) => a + t.revTry, 0)
      const techCashTotal = periodTechTickets.filter(t => !t.isFree && t.payment_method === 'cash').reduce((a, t) => a + t.revTry, 0)
      const techCardTotal = periodTechTickets.filter(t => !t.isFree && t.payment_method === 'card').reduce((a, t) => a + t.revTry, 0)
      const techPartsTotal = stockOutSrv > 0 ? stockOutSrv : periodTechTickets.reduce((a, t) => a + t.partsCostTry, 0)

      // 6. Banka Faiz Gelirleri ve POS Komisyonları
      const periodBankInterest = bankTxs.filter(t => {
        const compId = t.company_id || bankMap[t.bank_account_id]?.company_id || null
        const d = (t.tx_date || t.created_at || '').substring(0, 10)
        return isMatch(compId) && d >= startDate && d <= endDate && t.tx_type === 'in' && (t.description || '').toLowerCase().includes('faiz')
      }).map(t => ({
        ...t,
        bankName: bankMap[t.bank_account_id] ? `${bankMap[t.bank_account_id].bank_name} - ${bankMap[t.bank_account_id].account_name || ''}` : 'Banka',
        revTry: Number(t.amount || 0) * (t.exchange_rate || 1)
      })).sort((a, b) => (a.tx_date || '').localeCompare(b.tx_date || ''))

      const periodBankComm = bankTxs.filter(t => {
        const d = (t.tx_date || t.created_at || '').substring(0, 10)
        return isMatch(t.company_id) && d >= startDate && d <= endDate && t.tx_type === 'out' && (t.description || '').toLowerCase().includes('pos komisyon')
      }).map(t => ({
        ...t,
        bankName: bankMap[t.bank_account_id] ? `${bankMap[t.bank_account_id].bank_name} - ${bankMap[t.bank_account_id].account_name || ''}` : 'Banka',
        expTry: Number(t.amount || 0) * (t.exchange_rate || 1)
      }))

      // 7. Genel Giderler
      const periodExpenses = expenseTxs.filter(e => {
        const d = (e.tx_date || e.created_at || '').substring(0, 10)
        return isMatch(e.company_id) && d >= startDate && d <= endDate
      }).map(e => ({
        ...e,
        dateStr: (e.tx_date || e.created_at || '').substring(0, 10),
        catClean: cleanCategoryName(e.category?.name),
        expTry: Number(e.amount || 0) * (e.exchange_rate || 1)
      })).sort((a, b) => a.dateStr.localeCompare(b.dateStr))

      // Gider Gruplama
      const expGroupMap: Record<string, { name: string; count: number; total: number; items: any[] }> = {}
      periodExpenses.forEach(e => {
        if (!expGroupMap[e.catClean]) {
          expGroupMap[e.catClean] = { name: e.catClean, count: 0, total: 0, items: [] }
        }
        expGroupMap[e.catClean].count += 1
        expGroupMap[e.catClean].total += e.expTry
        expGroupMap[e.catClean].items.push(e)
      })

      // Totals for this center
      const custSalesRev = commSales.reduce((a, x) => a + x.revTry, 0)
      const subsRev = periodSubs.reduce((a, x) => a + x.revTry, 0)
      const subsCost = periodSubs.reduce((a, x) => a + x.costTry, 0)
      const interestRev = periodBankInterest.reduce((a, x) => a + x.revTry, 0)

      const totalRevenue = custSalesRev + subsRev + posRevTotal + techRevTotal + interestRev
      const totalSmm = subsCost + stockOutTotal + posUnstockedCostTotal
      const grossProfit = totalRevenue - totalSmm
      const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

      const genExpTotal = periodExpenses.reduce((a, x) => a + x.expTry, 0)
      const posTrueExpTotal = posTrueExpenses.reduce((a, x) => a + x.expTry, 0)
      const posSuppPayTotal = posSupplierPayments.reduce((a, x) => a + x.expTry, 0)
      const bankCommTotal = periodBankComm.reduce((a, x) => a + x.expTry, 0)

      const programCommExpenses = (center.is_personal ? 0 : genExpTotal) + posTrueExpTotal + posSuppPayTotal + bankCommTotal
      const trueCommExpenses = (center.is_personal ? 0 : genExpTotal) + posTrueExpTotal + bankCommTotal
      const personalExpenses = center.is_personal ? genExpTotal + posTrueExpTotal : 0

      const programNetProfit = grossProfit - programCommExpenses
      const trueNetProfit = grossProfit - trueCommExpenses

      return {
        center,
        commSales,
        nonRevDebts,
        custPayments: custPaymentsMapped,
        periodSubs,
        posCategories,
        posCashTotal,
        posCardTotal,
        posRevTotal,
        posTotalSmm,
        posTrueExpenses,
        posSupplierPayments,
        periodTechTickets,
        techRevTotal,
        techCashTotal,
        techCardTotal,
        techPartsTotal,
        stockOutInvoice,
        periodBankInterest,
        periodBankComm,
        periodExpenses,
        expenseGroups: Object.values(expGroupMap).sort((a, b) => b.total - a.total),
        custSalesRev,
        subsRev,
        subsCost,
        interestRev,
        totalRevenue,
        totalSmm,
        grossProfit,
        grossMarginPct,
        genExpTotal,
        posTrueExpTotal,
        posSuppPayTotal,
        bankCommTotal,
        programCommExpenses,
        trueCommExpenses,
        personalExpenses,
        programNetProfit,
        trueNetProfit
      }
    })

    // ==========================================================================
    // 2. VARLIKLAR, ALACAKLAR VE BORÇLAR (BİLANÇO & MİZAN) ANALİZ MOTORU
    // ==========================================================================
    const compNameMap: Record<string, string> = {}
    const compPersonalMap: Record<string, boolean> = {}
    companies.forEach(c => {
      compNameMap[c.id] = c.name
      compPersonalMap[c.id] = Boolean(c.is_personal)
    })

    // A) Banka Hesapları Dönem Analizi
    const bankBalanceRows = banks.map(b => {
      let pIn = 0, pOut = 0, fIn = 0, fOut = 0
      bankTxs.filter(t => t.bank_account_id === b.id && t.status !== 'pending').forEach(t => {
        const d = (t.tx_date || '').substring(0, 10)
        const val = getTry(Number(t.amount || 0), t.currency || b.currency)
        if (d > endDate) {
          if (t.tx_type === 'in') fIn += val
          else fOut += val
        } else if (d >= startDate) {
          if (t.tx_type === 'in') pIn += val
          else pOut += val
        }
      })
      const currentTry = getTry(Number(b.balance || 0), b.currency)
      const closing = currentTry - fIn + fOut
      const opening = closing - pIn + pOut
      const kmhLim = getTry(Number(b.kmh_limit || 0), b.currency)
      return {
        id: b.id,
        name: `${b.bank_name} - ${b.account_name || 'Vadesiz'}`,
        currency: b.currency || 'TRY',
        companyId: b.company_id || null,
        companyName: b.company_id ? (compNameMap[b.company_id] || 'Merkez') : 'Ortak Havuz',
        isPersonal: b.company_id ? Boolean(compPersonalMap[b.company_id]) : false,
        opening,
        inflow: pIn,
        outflow: pOut,
        closing,
        currentTry,
        kmhLimit: kmhLim
      }
    })

    // B) Nakit Kasalar Dönem Analizi
    const cashBalanceRows = cashes.map(c => {
      let pIn = 0, pOut = 0, fIn = 0, fOut = 0
      cashTxs.filter(t => t.cash_register_id === c.id).forEach(t => {
        const d = (t.tx_date || '').substring(0, 10)
        const val = getTry(Number(t.amount || 0), t.currency || c.currency)
        if (d > endDate) {
          if (t.tx_type === 'in') fIn += val
          else fOut += val
        } else if (d >= startDate) {
          if (t.tx_type === 'in') pIn += val
          else pOut += val
        }
      })
      const currentTry = getTry(Number(c.balance || 0), c.currency)
      const closing = currentTry - fIn + fOut
      const opening = closing - pIn + pOut
      return {
        id: c.id,
        name: c.name,
        currency: c.currency || 'TRY',
        companyId: c.company_id || null,
        companyName: c.company_id ? (compNameMap[c.company_id] || 'Merkez') : 'Ortak Havuz',
        isPersonal: c.company_id ? Boolean(compPersonalMap[c.company_id]) : false,
        opening,
        inflow: pIn,
        outflow: pOut,
        closing,
        currentTry
      }
    })

    // C) Depo & Stok Varlığı Analizi
    const whBalanceRows = warehouses.map(w => {
      let pIn = 0, pOut = 0, fIn = 0, fOut = 0
      const whStockIds = new Set(stocks.filter(s => s.warehouse_id === w.id).map(s => s.id))
      stockTxs.filter(t => whStockIds.has(t.stock_id)).forEach(t => {
        const d = (t.tx_date || '').substring(0, 10)
        const val = getTry(Number(t.quantity || 0) * Number(t.unit_price || 0), t.currency)
        if (d > endDate) {
          if (t.tx_type === 'in') fIn += val
          else fOut += val
        } else if (d >= startDate) {
          if (t.tx_type === 'in') pIn += val
          else pOut += val
        }
      })
      const whStocks = stocks.filter(s => s.warehouse_id === w.id)
      const currentNetTry = whStocks.reduce((a, s) => a + getTry(Number(s.quantity || 0) * Number(s.unit_price || 0), s.currency), 0)
      const currentVatInclTry = whStocks.reduce((a, s) => a + getTry(Number(s.quantity || 0) * Number(s.unit_price || 0) * (1 + Number(s.vat_rate || 0) / 100), s.currency), 0)
      const itemCount = whStocks.filter(s => Number(s.quantity || 0) > 0).length
      const closing = currentNetTry - fIn + fOut
      const opening = closing - pIn + pOut
      return {
        id: w.id,
        name: w.name,
        companyId: w.company_id || null,
        companyName: w.company_id ? (compNameMap[w.company_id] || 'Merkez') : 'Ortak Depo',
        itemCount,
        opening,
        inflow: pIn,
        outflow: pOut,
        closing,
        currentNetTry,
        currentVatInclTry
      }
    })

    // D) Müşteri Alacakları (Ticari & Şahsi) Dönem Analizi
    const customerReceivableRows = customers.map(c => {
      const cTxs = customerTxs.filter(t => t.customer_id === c.id)
      let pDebt = 0, pPay = 0, fDebt = 0, fPay = 0
      let primaryCompId: string | null = null
      cTxs.forEach(t => {
        if (t.company_id) primaryCompId = t.company_id
        const d = (t.tx_date || t.created_at || '').substring(0, 10)
        const val = Number(t.amount || 0) * (t.exchange_rate || 1)
        if (d > endDate) {
          if (t.tx_type === 'debt') fDebt += val
          else fPay += val
        } else if (d >= startDate) {
          if (t.tx_type === 'debt') pDebt += val
          else pPay += val
        }
      })
      const currentTry = getTry(Number(c.balance || 0), c.currency)
      const closing = currentTry - fDebt + fPay
      const opening = closing - pDebt + pPay
      return {
        id: c.id,
        name: c.name,
        currency: c.currency || 'TRY',
        companyId: primaryCompId,
        companyName: primaryCompId ? (compNameMap[primaryCompId] || 'Merkez') : 'Ortak',
        isPersonal: primaryCompId ? Boolean(compPersonalMap[primaryCompId]) : false,
        opening,
        debt: pDebt,
        payment: pPay,
        closing,
        currentTry
      }
    }).filter(c => Math.abs(c.opening) > 0.01 || c.debt > 0.01 || c.payment > 0.01 || Math.abs(c.closing) > 0.01 || Math.abs(c.currentTry) > 0.01)
      .sort((a, b) => b.closing - a.closing)

    // E) Tedarikçi (Satıcı) Borçları Dönem Analizi
    const supplierPayableRows = suppliers.map(s => {
      const sTxs = supplierTxs.filter(t => t.supplier_id === s.id)
      let pDebt = 0, pPay = 0, fDebt = 0, fPay = 0
      let primaryCompId: string | null = null
      sTxs.forEach(t => {
        if (t.company_id) primaryCompId = t.company_id
        const d = (t.tx_date || t.created_at || '').substring(0, 10)
        const val = Number(t.amount || 0) * (t.exchange_rate || 1)
        if (d > endDate) {
          if (t.tx_type === 'debt') fDebt += val
          else fPay += val
        } else if (d >= startDate) {
          if (t.tx_type === 'debt') pDebt += val
          else pPay += val
        }
      })
      const currentTry = getTry(Number(s.balance || 0), s.currency)
      const closing = currentTry - fDebt + fPay
      const opening = closing - pDebt + pPay
      return {
        id: s.id,
        name: s.company_name,
        currency: s.currency || 'TRY',
        companyId: primaryCompId,
        companyName: primaryCompId ? (compNameMap[primaryCompId] || 'Merkez') : 'Ortak',
        opening,
        debt: pDebt,
        payment: pPay,
        closing,
        currentTry
      }
    }).filter(s => Math.abs(s.opening) > 0.01 || s.debt > 0.01 || s.payment > 0.01 || Math.abs(s.closing) > 0.01 || Math.abs(s.currentTry) > 0.01)
      .sort((a, b) => b.closing - a.closing)

    // F) Kredi Kartları Dönem ve Limit Analizi
    const creditCardRows = cards.map(c => {
      const cTxs = cardTxs.filter(t => t.card_id === c.id)
      let pSpend = 0, pPay = 0, fSpend = 0, fPay = 0
      cTxs.forEach(t => {
        const d = (t.tx_date || '').substring(0, 10)
        const val = Number(t.amount || 0)
        const isOpening = (t.description || '').includes('Dönem Başı Devir Borcu')
        if (d > endDate && !isOpening) {
          if (t.tx_type === 'expense') fSpend += val
          else fPay += val
        } else if (d >= startDate && !isOpening) {
          if (t.tx_type === 'expense') pSpend += val
          else pPay += val
        }
      })
      const currentDebt = Number(c.current_debt || 0)
      const cardLimit = Number(c.card_limit || 0)
      const availLimit = Math.max(0, cardLimit - currentDebt)
      const closing = currentDebt - fSpend + fPay
      const opening = closing - pSpend + pPay
      const usagePct = cardLimit > 0 ? Math.min(100, Math.max(0, (currentDebt / cardLimit) * 100)) : 0
      return {
        id: c.id,
        name: c.name,
        cutoffDay: c.cutoff_day,
        companyId: c.company_id || null,
        companyName: c.company_id ? (compNameMap[c.company_id] || 'Merkez') : 'Ortak',
        isPersonal: c.company_id ? Boolean(compPersonalMap[c.company_id]) : false,
        cardLimit,
        opening,
        spend: pSpend,
        payment: pPay,
        closing,
        currentDebt,
        availLimit,
        usagePct
      }
    })

    // G) Banka Kredileri (Kalan Anapara & Taksit Yükümlülüğü)
    const activeLoanRows = (loans || []).filter(l => l.status === 'active').map(l => {
      const principal = getTry(Number(l.principal_amount || 0), l.currency)
      const remaining = getTry(Number(l.remaining_principal || 0), l.currency)
      const monthly = getTry(Number(l.monthly_installment || 0), l.currency)
      let totalRemainingWithInterest = remaining
      let paidCount = 0
      let totalCount = 0
      if (Array.isArray(l.installments_plan)) {
        totalCount = l.installments_plan.length
        paidCount = l.installments_plan.filter((p: any) => p.status === 'paid').length
        totalRemainingWithInterest = l.installments_plan
          .filter((p: any) => p.status !== 'paid')
          .reduce((a: number, p: any) => a + getTry(Number(p.amount || l.monthly_installment || 0), l.currency), 0)
      }
      return {
        id: l.id,
        bankName: l.bank_name,
        loanName: l.loan_name,
        companyId: l.company_id || null,
        companyName: l.company_id ? (compNameMap[l.company_id] || 'Merkez') : 'Ortak',
        principal,
        remainingPrincipal: remaining,
        totalRemainingWithInterest,
        monthlyInstallment: monthly,
        paidCount,
        totalCount
      }
    })

    // Konsolide Bilanço Toplamları
    const totalPositiveBanks = bankBalanceRows.filter(b => b.currentTry > 0).reduce((a, b) => a + b.currentTry, 0)
    const totalKmhDebt = bankBalanceRows.filter(b => b.currentTry < 0).reduce((a, b) => a + Math.abs(b.currentTry), 0)
    const totalNetBanks = bankBalanceRows.reduce((a, b) => a + b.currentTry, 0)
    const totalCashAssets = cashBalanceRows.reduce((a, c) => a + c.currentTry, 0)
    const totalStockNet = whBalanceRows.reduce((a, w) => a + w.currentNetTry, 0)
    const totalStockVatIncl = whBalanceRows.reduce((a, w) => a + w.currentVatInclTry, 0)
    const totalCustomerReceivables = customerReceivableRows.reduce((a, c) => a + c.currentTry, 0)
    const totalSupplierPayables = supplierPayableRows.reduce((a, s) => a + s.currentTry, 0)
    const totalCardDebt = creditCardRows.reduce((a, c) => a + c.currentDebt, 0)
    const totalCardLimit = creditCardRows.reduce((a, c) => a + c.cardLimit, 0)
    const totalCardAvail = creditCardRows.reduce((a, c) => a + c.availLimit, 0)
    const totalLoanPrincipal = activeLoanRows.reduce((a, l) => a + l.remainingPrincipal, 0)
    const totalLoanWithInterest = activeLoanRows.reduce((a, l) => a + l.totalRemainingWithInterest, 0)

    const grossAssets = totalPositiveBanks + totalCashAssets + totalCustomerReceivables + totalStockVatIncl
    const totalLiabilities = totalKmhDebt + totalSupplierPayables + totalCardDebt + totalLoanPrincipal
    const netWorth = grossAssets - totalLiabilities
    const liquidNetWorth = (totalPositiveBanks + totalCashAssets + totalCustomerReceivables) - totalLiabilities

    // Konsolide P&L Toplamları
    const grandRevenue = centerReports.reduce((a, c) => a + c.totalRevenue, 0)
    const grandSmm = centerReports.reduce((a, c) => a + c.totalSmm, 0)
    const grandGrossProfit = grandRevenue - grandSmm
    const grandGrossMarginPct = grandRevenue > 0 ? (grandGrossProfit / grandRevenue) * 100 : 0
    const grandProgramExpenses = centerReports.reduce((a, c) => a + c.programCommExpenses, 0)
    const grandTrueExpenses = centerReports.reduce((a, c) => a + c.trueCommExpenses, 0)
    const grandPersonalExpenses = centerReports.reduce((a, c) => a + c.personalExpenses, 0)
    const grandProgramNetProfit = grandGrossProfit - grandProgramExpenses
    const grandTrueNetProfit = grandGrossProfit - grandTrueExpenses
    const grandSuppInPos = centerReports.reduce((a, c) => a + c.posSuppPayTotal, 0)

    return {
      centerReports,
      bankBalanceRows,
      cashBalanceRows,
      whBalanceRows,
      customerReceivableRows,
      supplierPayableRows,
      creditCardRows,
      activeLoanRows,
      totalPositiveBanks,
      totalKmhDebt,
      totalNetBanks,
      totalCashAssets,
      totalStockNet,
      totalStockVatIncl,
      totalCustomerReceivables,
      totalSupplierPayables,
      totalCardDebt,
      totalCardLimit,
      totalCardAvail,
      totalLoanPrincipal,
      totalLoanWithInterest,
      grossAssets,
      totalLiabilities,
      netWorth,
      liquidNetWorth,
      grandRevenue,
      grandSmm,
      grandGrossProfit,
      grandGrossMarginPct,
      grandProgramExpenses,
      grandTrueExpenses,
      grandPersonalExpenses,
      grandProgramNetProfit,
      grandTrueNetProfit,
      grandSuppInPos
    }
  }, [
    startDate, endDate, companies, customers, suppliers, customerTxs,
    supplierTxs, expenseTxs, stockTxs, cashTxs, bankTxs, cardTxs,
    posTxs, techTickets, subscriptions, loans, banks, cashes, cards,
    warehouses, stocks, rates
  ])

  // ============================================================================
  // A4 YAZICI / PDF ÇIKTI MOTORU (VEKTÖREL GRAFİKLİ & ÇOK SAYFALI RAPOR)
  // ============================================================================
  const handlePrintOrPdf = () => {
    const printEl = document.getElementById('comprehensive-report-document')
    if (!printEl) {
      toast.error('Rapor içeriği bulunamadı.')
      return
    }

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (!doc) {
      toast.error('PDF / Yazdırma penceresi başlatılamadı.')
      return
    }

    const htmlContent = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8" />
<title>${periodTitle} - Merkez Bazlı Değer, Kâr ve Bilanço Analiz Raporu</title>
<style>
  @page {
    size: A4 portrait;
    margin: 10mm 11mm 11mm 11mm;
  }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body {
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif;
    color: #0f172a;
    background: #ffffff;
    margin: 0;
    padding: 0;
    font-size: 9pt;
    line-height: 1.35;
  }
  .doc-sheet {
    background: #ffffff !important;
    color: #0f172a !important;
  }
  .report-header {
    border-bottom: 2.5px solid #0f172a;
    padding-bottom: 7px;
    margin-bottom: 10px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .report-title {
    font-size: 14pt;
    font-weight: 800;
    color: #0f172a;
    margin: 0;
    letter-spacing: -0.3px;
  }
  .report-subtitle {
    font-size: 8pt;
    color: #475569;
    margin: 2px 0 0 0;
    font-weight: 500;
  }
  .report-meta {
    text-align: right;
    font-size: 7.8pt;
    color: #334155;
  }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 7px;
    margin-bottom: 11px;
  }
  .kpi-card {
    border: 1px solid #cbd5e1;
    border-radius: 5px;
    padding: 7px 9px;
    background: #f8fafc;
  }
  .kpi-card.highlight {
    background: #f0fdf4;
    border-color: #86efac;
  }
  .kpi-card.balance {
    background: #eff6ff;
    border-color: #93c5fd;
  }
  .kpi-label {
    font-size: 7pt;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: #475569;
    font-weight: 700;
    margin-bottom: 2px;
  }
  .kpi-val {
    font-size: 11.5pt;
    font-weight: 800;
    color: #0f172a;
    font-variant-numeric: tabular-nums;
  }
  .kpi-sub {
    font-size: 6.8pt;
    color: #64748b;
    margin-top: 2px;
  }
  .section-box {
    margin-bottom: 12px;
  }
  .section-header {
    background: #0f172a;
    color: #ffffff;
    padding: 4.5px 9px;
    font-size: 9.2pt;
    font-weight: 700;
    border-radius: 4px 4px 0 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .section-header.sub {
    background: #1e293b;
    font-size: 8.5pt;
    padding: 3.5px 9px;
    margin-top: 7px;
  }
  .section-header .badge {
    font-size: 7.5pt;
    font-weight: 600;
    background: rgba(255,255,255,0.18);
    padding: 1px 6px;
    border-radius: 3px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 7.9pt;
    border: 1px solid #cbd5e1;
  }
  th {
    background: #e2e8f0;
    color: #0f172a;
    font-weight: 700;
    text-align: left;
    padding: 4px 5.5px;
    border: 1px solid #cbd5e1;
    font-size: 7.3pt;
    text-transform: uppercase;
    letter-spacing: 0.2px;
  }
  td {
    padding: 3.5px 5.5px;
    border: 1px solid #cbd5e1;
    vertical-align: top;
  }
  tr:nth-child(even) td {
    background: #f8fafc;
  }
  tr.subtotal-row td {
    background: #f1f5f9 !important;
    font-weight: 700;
    border-top: 1.5px solid #94a3b8;
    border-bottom: 1.5px solid #94a3b8;
  }
  tr.total-row td {
    background: #e2e8f0 !important;
    font-weight: 800;
    font-size: 8.3pt;
    border-top: 2px solid #0f172a;
    border-bottom: 2px solid #0f172a;
  }
  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .center {
    text-align: center;
  }
  .pos {
    color: #15803d;
    font-weight: 700;
  }
  .neg {
    color: #b91c1c;
    font-weight: 600;
  }
  .muted {
    color: #64748b;
  }
  .note-box {
    margin-top: 5px;
    padding: 6px 9px;
    background: #fffbeb;
    border: 1px solid #fcd34d;
    border-left: 4px solid #d97706;
    border-radius: 4px;
    font-size: 7.6pt;
    color: #78350f;
  }
  .info-box {
    margin-top: 5px;
    padding: 6px 9px;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-left: 4px solid #0f172a;
    border-radius: 4px;
    font-size: 7.8pt;
    color: #1e293b;
  }
  .chart-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 9px;
    margin-bottom: 11px;
  }
  .chart-card {
    border: 1px solid #cbd5e1;
    border-radius: 5px;
    padding: 8px 10px;
    background: #ffffff;
    page-break-inside: avoid;
  }
  .chart-title {
    font-size: 8pt;
    font-weight: 800;
    color: #0f172a;
    text-transform: uppercase;
    margin-bottom: 6px;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 3px;
    display: flex;
    justify-content: space-between;
  }
  .bar-row {
    margin-bottom: 5px;
  }
  .bar-label-line {
    display: flex;
    justify-content: space-between;
    font-size: 7.3pt;
    font-weight: 600;
    margin-bottom: 2px;
  }
  .bar-track {
    width: 100%;
    height: 7px;
    background: #e2e8f0;
    border-radius: 99px;
    overflow: hidden;
    display: flex;
  }
  .page-break {
    page-break-before: always;
  }
  .avoid-break {
    page-break-inside: avoid;
  }
  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 9px;
  }
  .compact-table th, .compact-table td {
    padding: 2.6px 4.5px;
    font-size: 7.2pt;
  }
</style>
</head>
<body>
${printEl.innerHTML}
</body>
</html>`

    doc.open()
    doc.write(htmlContent)
    doc.close()

    iframe.contentWindow?.focus()
    setTimeout(() => {
      iframe.contentWindow?.print()
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe)
        }
      }, 2500)
    }, 450)

    toast.success('Yazdırma / PDF penceresi açıldı. Hedef olarak "PDF Olarak Kaydet" veya yazıcınızı seçebilirsiniz.')
  }

  if (!isOpen) return null

  // Max value for center bar chart scaling
  const maxCenterRev = Math.max(1, ...reportData.centerReports.map(c => Math.max(c.totalRevenue, c.programCommExpenses, c.personalExpenses)))
  const maxBalanceSide = Math.max(1, reportData.grossAssets, reportData.totalLiabilities)

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden z-[99998] bg-[#070b14] flex flex-col animate-in fade-in duration-200">
      {/* ÜST KONTROL VE FİLTRE ÇUBUĞU (İKİ SATIRLI, HİÇBİR EKRANDA TAŞMAYAN KOMPAKT DÜZEN) */}
      <div className="bg-[#0b1120] border-b border-slate-800 px-4 py-2.5 flex flex-col gap-2 shrink-0 shadow-xl w-full max-w-full">
        {/* 1. SATIR: BAŞLIK + BÖLÜM SEKMELERİ + PDF OLUŞTUR + KAPAT */}
        <div className="flex flex-wrap items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500/20 to-emerald-500/20 border border-indigo-500/30 text-indigo-400 shrink-0">
              <Sparkles size={18} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm md:text-base font-black text-white flex items-center gap-2 truncate">
                <span className="truncate">Merkez Bazlı Kapsamlı Kâr, Değer & Bilanço Analiz Raporu</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold shrink-0">
                  {periodTitle}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            {/* Bölüm Filtresi */}
            <div className="hidden md:flex items-center bg-[#070b14] border border-slate-700 p-0.5 rounded-lg text-[11px]">
              {[
                { id: 'all', label: 'Tüm Rapor' },
                { id: 'pnl', label: 'Kâr & Zarar' },
                { id: 'balance', label: 'Varlık, Alacak & Borç' },
                { id: 'centers', label: 'Merkez Detayları' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSectionFilter(tab.id as any)}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer ${
                    sectionFilter === tab.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* PDF OLUŞTUR / YAZDIR BUTONU */}
            <button
              onClick={handlePrintOrPdf}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 shadow-lg shadow-emerald-900/40 border border-emerald-400/30 transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <Printer size={14} />
              <span>PDF Oluştur / Yazdır</span>
            </button>

            <button
              onClick={onClose}
              className="bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border border-slate-700 transition-colors cursor-pointer shrink-0"
              title="Raporu Kapat"
            >
              <X size={15} />
              <span>Kapat</span>
            </button>
          </div>
        </div>

        {/* 2. SATIR: AY SEÇİCİ + TARİH ARALIĞI + HIZLI ÖZET BİLGİ */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80 w-full">
          <div className="flex flex-wrap items-center gap-2">
            {/* Hızlı Ay Seçimi */}
            <div className="flex items-center gap-1.5 bg-[#070b14] border border-slate-700 px-2.5 py-1 rounded-lg">
              <Calendar size={13} className="text-indigo-400" />
              <span className="text-[11px] text-slate-400 font-bold">Ay Seç:</span>
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthSelect(selectedYear, e.target.value)}
                className="bg-slate-900 text-white text-xs font-bold px-2 py-0.5 rounded border border-slate-700 focus:outline-none cursor-pointer"
              >
                {MONTH_NAMES.map(m => (
                  <option key={m.num} value={m.num}>{m.name}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => handleMonthSelect(e.target.value, selectedMonth)}
                className="bg-slate-900 text-white text-xs font-bold px-2 py-0.5 rounded border border-slate-700 focus:outline-none cursor-pointer"
              >
                {['2025', '2026', '2027'].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Özel Tarih Aralığı Seçimi */}
            <div className="flex items-center gap-1.5 bg-[#070b14] border border-slate-700 px-2.5 py-1 rounded-lg text-xs">
              <span className="text-[11px] text-slate-400 font-bold">Tarih Aralığı:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setPeriodMode('custom'); setStartDate(e.target.value) }}
                className="bg-slate-900 text-white px-2 py-0.5 rounded border border-slate-700 text-[11px] focus:outline-none"
                style={{ colorScheme: 'dark' }}
              />
              <span className="text-slate-500">–</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setPeriodMode('custom'); setEndDate(e.target.value) }}
                className="bg-slate-900 text-white px-2 py-0.5 rounded border border-slate-700 text-[11px] focus:outline-none"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-3 text-[11px] font-mono">
            <span className="text-slate-400">
              Ciro: <strong className="text-white">{fmt(reportData.grandRevenue)}</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">
              Gerçek Net Kâr: <strong className="text-emerald-400">+{fmt(reportData.grandTrueNetProfit)}</strong>
            </span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">
              Net Özvarlık: <strong className={reportData.netWorth >= 0 ? 'text-blue-400' : 'text-rose-400'}>{fmt(reportData.netWorth)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* EKRAN ÖNİZLEME GÖVDESİ (A4 KAĞIT GÖRÜNÜMÜ — TAM BOY BEYAZ ZEMİN & BASKIYA HAZIR) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 bg-[#070b14]">
        <div
          id="comprehensive-report-document"
          className="doc-sheet mx-auto h-fit w-full max-w-[1040px] bg-white text-slate-900 rounded-xl shadow-2xl p-6 md:p-10 space-y-6"
          style={{
            fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif",
            backgroundColor: '#ffffff',
            color: '#0f172a'
          }}
        >
          {/* YAZDIRILACAK İÇERİK STİLLERİ (EKRAN VE PDF ORTAK) */}
          <style dangerouslySetInnerHTML={{ __html: `
            #comprehensive-report-document {
              background-color: #ffffff !important;
              color: #0f172a !important;
            }
            #comprehensive-report-document .report-header {
              border-bottom: 2.5px solid #0f172a;
              padding-bottom: 8px;
              margin-bottom: 12px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            #comprehensive-report-document .report-title {
              font-size: 15pt;
              font-weight: 800;
              color: #0f172a;
              margin: 0;
              letter-spacing: -0.3px;
            }
            #comprehensive-report-document .report-subtitle {
              font-size: 8.5pt;
              color: #475569;
              margin: 2px 0 0 0;
              font-weight: 500;
            }
            #comprehensive-report-document .report-meta {
              text-align: right;
              font-size: 8pt;
              color: #334155;
            }
            #comprehensive-report-document .kpi-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              margin-bottom: 12px;
            }
            #comprehensive-report-document .kpi-card {
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 8px 10px;
              background: #f8fafc;
            }
            #comprehensive-report-document .kpi-card.highlight {
              background: #f0fdf4;
              border-color: #86efac;
            }
            #comprehensive-report-document .kpi-card.balance {
              background: #eff6ff;
              border-color: #93c5fd;
            }
            #comprehensive-report-document .kpi-label {
              font-size: 7.2pt;
              text-transform: uppercase;
              letter-spacing: 0.3px;
              color: #475569;
              font-weight: 700;
              margin-bottom: 2px;
            }
            #comprehensive-report-document .kpi-val {
              font-size: 12pt;
              font-weight: 800;
              color: #0f172a;
              font-variant-numeric: tabular-nums;
            }
            #comprehensive-report-document .kpi-sub {
              font-size: 7pt;
              color: #64748b;
              margin-top: 2px;
            }
            #comprehensive-report-document .section-box {
              margin-bottom: 14px;
            }
            #comprehensive-report-document .section-header {
              background: #0f172a !important;
              color: #ffffff !important;
              padding: 5px 10px;
              font-size: 9.5pt;
              font-weight: 700;
              border-radius: 4px 4px 0 0;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            #comprehensive-report-document .section-header.sub {
              background: #1e293b !important;
              color: #ffffff !important;
              font-size: 8.8pt;
              padding: 4px 10px;
              margin-top: 8px;
            }
            #comprehensive-report-document .section-header .badge {
              font-size: 7.8pt;
              font-weight: 600;
              background: rgba(255,255,255,0.18);
              color: #ffffff !important;
              padding: 1px 7px;
              border-radius: 3px;
            }
            #comprehensive-report-document table {
              width: 100%;
              border-collapse: collapse;
              font-size: 8.2pt;
              border: 1px solid #cbd5e1;
              background-color: #ffffff !important;
            }
            #comprehensive-report-document th {
              background: #e2e8f0 !important;
              color: #0f172a !important;
              font-weight: 700;
              text-align: left;
              padding: 4.5px 6px;
              border: 1px solid #cbd5e1;
              font-size: 7.5pt;
              text-transform: uppercase;
              letter-spacing: 0.2px;
            }
            #comprehensive-report-document td {
              padding: 4px 6px;
              border: 1px solid #cbd5e1;
              vertical-align: top;
              background-color: #ffffff !important;
              color: #0f172a !important;
            }
            #comprehensive-report-document tr:nth-child(even) td {
              background-color: #f8fafc !important;
            }
            #comprehensive-report-document tr.subtotal-row td {
              background-color: #f1f5f9 !important;
              color: #0f172a !important;
              font-weight: 700;
              border-top: 1.5px solid #94a3b8;
              border-bottom: 1.5px solid #94a3b8;
            }
            #comprehensive-report-document tr.total-row td {
              background-color: #e2e8f0 !important;
              color: #0f172a !important;
              font-weight: 800;
              font-size: 8.5pt;
              border-top: 2px solid #0f172a;
              border-bottom: 2px solid #0f172a;
            }
            #comprehensive-report-document .num {
              text-align: right;
              font-variant-numeric: tabular-nums;
              white-space: nowrap;
            }
            #comprehensive-report-document .center {
              text-align: center;
            }
            #comprehensive-report-document .pos {
              color: #15803d !important;
              font-weight: 700;
            }
            #comprehensive-report-document .neg {
              color: #b91c1c !important;
              font-weight: 600;
            }
            #comprehensive-report-document .muted {
              color: #64748b !important;
            }
            #comprehensive-report-document .note-box {
              margin-top: 6px;
              padding: 7px 10px;
              background: #fffbeb;
              border: 1px solid #fcd34d;
              border-left: 4px solid #d97706;
              border-radius: 4px;
              font-size: 7.9pt;
              color: #78350f;
            }
            #comprehensive-report-document .info-box {
              margin-top: 6px;
              padding: 7px 10px;
              background: #f8fafc;
              border: 1px solid #cbd5e1;
              border-left: 4px solid #0f172a;
              border-radius: 4px;
              font-size: 8pt;
              color: #1e293b;
            }
            #comprehensive-report-document .chart-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              margin-bottom: 12px;
            }
            #comprehensive-report-document .chart-card {
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 9px 11px;
              background: #ffffff;
            }
            #comprehensive-report-document .chart-title {
              font-size: 8.2pt;
              font-weight: 800;
              color: #0f172a;
              text-transform: uppercase;
              margin-bottom: 7px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 3px;
              display: flex;
              justify-content: space-between;
            }
            #comprehensive-report-document .bar-row {
              margin-bottom: 6px;
            }
            #comprehensive-report-document .bar-label-line {
              display: flex;
              justify-content: space-between;
              font-size: 7.5pt;
              font-weight: 600;
              margin-bottom: 2px;
            }
            #comprehensive-report-document .bar-track {
              width: 100%;
              height: 8px;
              background: #e2e8f0;
              border-radius: 99px;
              overflow: hidden;
              display: flex;
            }
            #comprehensive-report-document .two-col {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
            }
            #comprehensive-report-document .compact-table th,
            #comprehensive-report-document .compact-table td {
              padding: 3px 5px;
              font-size: 7.5pt;
            }
          `}} />

          {/* ================================================================ */}
          {/* RAPOR BAŞLIĞI VE KONSOLİDE KPI ÖZET KARTLARI                      */}
          {/* ================================================================ */}
          <div className="report-header">
            <div>
              <h1 className="report-title">{periodTitle} — MERKEZ BAZLI DEĞER, KÂR VE BİLANÇO ANALİZ RAPORU</h1>
              <p className="report-subtitle">
                Tüm Ticari Şirketler, Şahsi Merkez ve Ortak Havuz Gelir / SMM / Gider, Varlıklar, Alacaklar ve Borçlar Kırılımı
              </p>
            </div>
            <div className="report-meta">
              <div><strong>Dönem:</strong> {formatDateTR(startDate)} – {formatDateTR(endDate)}</div>
              <div><strong>Rapor Tarihi:</strong> {formatDateTR(new Date().toISOString().substring(0, 10))} | <strong>Kurlar:</strong> 1$={rates.USD.toFixed(2)}₺, 1€={rates.EUR.toFixed(2)}₺</div>
            </div>
          </div>

          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Konsolide Toplam Ciro</div>
              <div className="kpi-val">{fmt(reportData.grandRevenue)}</div>
              <div className="kpi-sub">SMM: -{fmt(reportData.grandSmm)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Konsolide Brüt Kâr</div>
              <div className="kpi-val">+{fmt(reportData.grandGrossProfit)}</div>
              <div className="kpi-sub">Brüt Kâr Marjı: %{reportData.grandGrossMarginPct.toFixed(2)}</div>
            </div>
            <div className="kpi-card highlight">
              <div className="kpi-label">Gerçek Net Ticari Kâr</div>
              <div className="kpi-val" style={{ color: '#15803d' }}>+{fmt(reportData.grandTrueNetProfit)}</div>
              <div className="kpi-sub">Program Görünümü: +{fmt(reportData.grandProgramNetProfit)}</div>
            </div>
            <div className="kpi-card balance">
              <div className="kpi-label">Güncel Net Özvarlık (Bilanço)</div>
              <div className="kpi-val" style={{ color: reportData.netWorth >= 0 ? '#1d4ed8' : '#b91c1c' }}>
                {fmt(reportData.netWorth)}
              </div>
              <div className="kpi-sub">Varlık: {fmt(reportData.grossAssets)} | Borç: -{fmt(reportData.totalLiabilities)}</div>
            </div>
          </div>

          {/* ================================================================ */}
          {/* BÖLÜM 1: TÜM MERKEZLER GENEL KÂR & DEĞER ÖZETİ + GRAFİKLER        */}
          {/* ================================================================ */}
          {(sectionFilter === 'all' || sectionFilter === 'pnl') && (
            <>
              <div className="section-box avoid-break">
                <div className="section-header">
                  <span>1. TÜM MERKEZLER GENEL KÂR & DEĞER ÖZET TABLOSU ({periodTitle})</span>
                  <span className="badge">Konsolide P&L</span>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Merkez Adı</th>
                      <th className="num">Toplam Ciro (Gelir)</th>
                      <th className="num">Satış Maliyeti (SMM)</th>
                      <th className="num">Brüt Kâr</th>
                      <th className="center">Brüt Marj</th>
                      <th className="num">Ticari Giderler</th>
                      <th className="num">Program Net Kâr</th>
                      <th className="num">Düzeltilmiş Net Kâr*</th>
                      <th className="num">Şahsi Harcama</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.centerReports.map(cr => (
                      <tr key={cr.center.id || 'common'}>
                        <td>
                          <strong>
                            {cr.center.is_personal ? '🏠 ' : cr.center.id ? '🏢 ' : '🌍 '}
                            {cr.center.name}
                          </strong>
                        </td>
                        <td className="num">{fmt(cr.totalRevenue)}</td>
                        <td className={`num ${cr.totalSmm > 0 ? 'neg' : 'muted'}`}>
                          {cr.totalSmm > 0 ? `-${fmt(cr.totalSmm)}` : '0,00 ₺'}
                        </td>
                        <td className={`num ${cr.grossProfit > 0 ? 'pos' : 'muted'}`}>
                          {cr.grossProfit > 0 ? `+${fmt(cr.grossProfit)}` : fmt(cr.grossProfit)}
                        </td>
                        <td className="center">%{cr.grossMarginPct.toFixed(2)}</td>
                        <td className={`num ${cr.programCommExpenses > 0 ? 'neg' : 'muted'}`}>
                          {cr.programCommExpenses > 0 ? `-${fmt(cr.programCommExpenses)}` : '0,00 ₺'}
                        </td>
                        <td className={`num ${cr.programNetProfit >= 0 ? 'pos' : 'neg'}`}>
                          {cr.programNetProfit >= 0 ? `+${fmt(cr.programNetProfit)}` : fmt(cr.programNetProfit)}
                        </td>
                        <td className={`num ${cr.trueNetProfit >= 0 ? 'pos' : 'neg'}`}>
                          {cr.trueNetProfit >= 0 ? `+${fmt(cr.trueNetProfit)}` : fmt(cr.trueNetProfit)}
                        </td>
                        <td className={`num ${cr.personalExpenses > 0 ? 'neg' : 'muted'}`}>
                          {cr.personalExpenses > 0 ? `-${fmt(cr.personalExpenses)}` : '0,00 ₺'}
                        </td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td>TOPLAM (KONSOLİDE)</td>
                      <td className="num">{fmt(reportData.grandRevenue)}</td>
                      <td className="num neg">-{fmt(reportData.grandSmm)}</td>
                      <td className="num pos">+{fmt(reportData.grandGrossProfit)}</td>
                      <td className="center">%{reportData.grandGrossMarginPct.toFixed(2)}</td>
                      <td className="num neg">-{fmt(reportData.grandProgramExpenses)}</td>
                      <td className="num pos">+{fmt(reportData.grandProgramNetProfit)}</td>
                      <td className="num pos">+{fmt(reportData.grandTrueNetProfit)}</td>
                      <td className="num neg">-{fmt(reportData.grandPersonalExpenses)}</td>
                    </tr>
                  </tbody>
                </table>
                {reportData.grandSuppInPos > 0 && (
                  <div className="note-box">
                    <strong>* Muhasebe Analiz Notu ({fmt(reportData.grandSuppInPos)} Farkın Sebebi):</strong> Mağaza kasasından tedarikçilere yapılan toplam <strong>{fmt(reportData.grandSuppInPos)}</strong> tutarındaki mal/parça ödemeleri (<code>[SUPP-...]</code> referanslı), POS hareketlerinde <code>gider</code> kategorisiyle yer aldığı için mevcut ekranda faaliyet gideri içinde görünmektedir. Bu ödemeler tedarikçi cari borç kapaması olduğundan ayrıştırıldığında gerçek ticari faaliyet gideri <strong>{fmt(reportData.grandTrueExpenses)}</strong>, gerçek Net Ticari Kâr ise <strong>+{fmt(reportData.grandTrueNetProfit)}</strong>&apos;dir.
                  </div>
                )}
              </div>

              {/* GÖRSEL GRAFİKLER: MERKEZ KARŞILAŞTIRMASI VE GELİR KANALLARI DAĞILIMI */}
              <div className="chart-grid avoid-break">
                <div className="chart-card">
                  <div className="chart-title">
                    <span>📊 GRAFİK 1: MERKEZ BAZLI CİRO, BRÜT KÂR & NET KÂR KARŞILAŞTIRMASI</span>
                    <span>TL (₺)</span>
                  </div>
                  {reportData.centerReports.filter(c => c.totalRevenue > 0 || c.personalExpenses > 0).map(cr => {
                    const revW = Math.min(100, (cr.totalRevenue / maxCenterRev) * 100)
                    const smmW = Math.min(100, (cr.totalSmm / maxCenterRev) * 100)
                    const expW = Math.min(100, ((cr.trueCommExpenses || cr.personalExpenses) / maxCenterRev) * 100)
                    const netW = Math.min(100, (Math.max(0, cr.trueNetProfit) / maxCenterRev) * 100)
                    return (
                      <div key={cr.center.id || 'common'} style={{ marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px dashed #e2e8f0' }}>
                        <div className="bar-label-line">
                          <span><strong>{cr.center.name}</strong></span>
                          <span>Ciro: <strong>{fmt(cr.totalRevenue)}</strong> | Net Kâr: <strong style={{ color: '#15803d' }}>+{fmt(cr.trueNetProfit)}</strong></span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '58px 1fr', gap: '4px', alignItems: 'center', fontSize: '6.8pt', color: '#475569' }}>
                          <span>Ciro:</span>
                          <div className="bar-track"><div style={{ width: `${revW}%`, background: '#2563eb' }} /></div>
                          <span>Maliyet:</span>
                          <div className="bar-track"><div style={{ width: `${smmW}%`, background: '#f59e0b' }} /></div>
                          <span>{cr.center.is_personal ? 'Şahsi Harc.:' : 'Giderler:'}</span>
                          <div className="bar-track"><div style={{ width: `${expW}%`, background: '#ef4444' }} /></div>
                          <span>Net Kâr:</span>
                          <div className="bar-track"><div style={{ width: `${netW}%`, background: '#16a34a' }} /></div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="chart-card">
                  <div className="chart-title">
                    <span>🥧 GRAFİK 2: KONSOLİDE GELİR KANALLARI VE KÂRLILIK PAYI</span>
                    <span>Toplam: {fmt(reportData.grandRevenue)}</span>
                  </div>
                  {(() => {
                    const posRev = reportData.centerReports.reduce((a, c) => a + c.posRevTotal, 0)
                    const techRev = reportData.centerReports.reduce((a, c) => a + c.techRevTotal, 0)
                    const subRev = reportData.centerReports.reduce((a, c) => a + c.subsRev, 0)
                    const custRev = reportData.centerReports.reduce((a, c) => a + c.custSalesRev, 0)
                    const intRev = reportData.centerReports.reduce((a, c) => a + c.interestRev, 0)
                    const total = Math.max(1, reportData.grandRevenue)
                    const channels = [
                      { name: 'Mağaza (POS) Perakende Satışları', val: posRev, color: '#10b981' },
                      { name: 'Teknik Servis Onarım & İşçilik', val: techRev, color: '#3b82f6' },
                      { name: 'Kredili Abonelik (tvghost) Satışları', val: subRev, color: '#8b5cf6' },
                      { name: 'Cari Fatura / Reklam / Tasarım Satışları', val: custRev, color: '#f59e0b' },
                      { name: 'Vadeli Mevduat Günlük Faiz Gelirleri', val: intRev, color: '#06b6d4' }
                    ].filter(ch => ch.val > 0)

                    return (
                      <>
                        {/* Yığılmış Kanal Çubuğu */}
                        <div className="bar-track" style={{ height: '14px', marginBottom: '9px' }}>
                          {channels.map((ch, i) => (
                            <div
                              key={i}
                              style={{ width: `${(ch.val / total) * 100}%`, background: ch.color }}
                              title={`${ch.name}: ${fmt(ch.val)}`}
                            />
                          ))}
                        </div>
                        {channels.map((ch, i) => {
                          const pct = (ch.val / total) * 100
                          return (
                            <div key={i} className="bar-row">
                              <div className="bar-label-line">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: ch.color, display: 'inline-block' }} />
                                  {ch.name}
                                </span>
                                <span><strong>{fmt(ch.val)}</strong> (%{pct.toFixed(1)})</span>
                              </div>
                              <div className="bar-track">
                                <div style={{ width: `${pct}%`, background: ch.color }} />
                              </div>
                            </div>
                          )
                        })}
                      </>
                    )
                  })()}
                </div>
              </div>
            </>
          )}

          {/* ================================================================ */}
          {/* BÖLÜM 2: VARLIKLAR, ALACAKLAR VE BORÇLAR (BİLANÇO) ANALİZİ       */}
          {/* ================================================================ */}
          {(sectionFilter === 'all' || sectionFilter === 'balance') && (
            <>
              <div className="section-box avoid-break">
                <div className="section-header">
                  <span>2. VARLIKLAR, ALACAKLAR VE BORÇLAR (BİLANÇO & NET ÖZVARLIK ANALİZİ)</span>
                  <span className="badge">Net Özvarlık: {fmt(reportData.netWorth)}</span>
                </div>

                {/* GRAFİK 3: AKTİF VARLIKLAR VS PASİF BORÇLAR GÖRSEL BİLANÇO DENGESİ */}
                <div className="chart-grid" style={{ marginTop: '8px', marginBottom: '8px' }}>
                  <div className="chart-card" style={{ background: '#f0fdf4', borderColor: '#86efac' }}>
                    <div className="chart-title" style={{ color: '#14532d', borderColor: '#bbf7d0' }}>
                      <span>🟢 AKTİF VARLIKLAR & ALACAKLAR DAĞILIMI</span>
                      <span>Toplam: {fmt(reportData.grossAssets)}</span>
                    </div>
                    {[
                      { label: '🏦 Banka Hesapları (Pozitif Mevduat)', val: reportData.totalPositiveBanks, color: '#2563eb' },
                      { label: '💵 Nakit Kasalar Toplamı', val: reportData.totalCashAssets, color: '#16a34a' },
                      { label: '📦 Depo & Stok Varlığı (KDV Dahil)', val: reportData.totalStockVatIncl, color: '#7c3aed' },
                      { label: '🤝 Müşteri & Şahsi Cari Alacaklar', val: reportData.totalCustomerReceivables, color: '#0891b2' }
                    ].map((item, idx) => {
                      const pct = reportData.grossAssets > 0 ? (item.val / reportData.grossAssets) * 100 : 0
                      return (
                        <div key={idx} className="bar-row">
                          <div className="bar-label-line">
                            <span>{item.label}</span>
                            <span><strong>{fmt(item.val)}</strong> (%{pct.toFixed(1)})</span>
                          </div>
                          <div className="bar-track" style={{ background: '#dcfce7' }}>
                            <div style={{ width: `${pct}%`, background: item.color }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="chart-card" style={{ background: '#fef2f2', borderColor: '#fca5a5' }}>
                    <div className="chart-title" style={{ color: '#7f1d1d', borderColor: '#fecaca' }}>
                      <span>🔴 PASİF BORÇLAR & YÜKÜMLÜLÜKLER DAĞILIMI</span>
                      <span>Toplam: -{fmt(reportData.totalLiabilities)}</span>
                    </div>
                    {[
                      { label: '🏛️ Banka Kredileri (Kalan Anapara)', val: reportData.totalLoanPrincipal, color: '#dc2626' },
                      { label: '💳 Kredi Kartları Güncel Borcu', val: reportData.totalCardDebt, color: '#e11d48' },
                      { label: '🏦 Banka KMH (Eksi Bakiye) Kullanımı', val: reportData.totalKmhDebt, color: '#d97706' },
                      { label: '🏭 Tedarikçi (Satıcı) Cari Borçları', val: reportData.totalSupplierPayables, color: '#9333ea' }
                    ].map((item, idx) => {
                      const pct = reportData.totalLiabilities > 0 ? (item.val / reportData.totalLiabilities) * 100 : 0
                      return (
                        <div key={idx} className="bar-row">
                          <div className="bar-label-line">
                            <span>{item.label}</span>
                            <span><strong>-{fmt(item.val)}</strong> (%{pct.toFixed(1)})</span>
                          </div>
                          <div className="bar-track" style={{ background: '#fee2e2' }}>
                            <div style={{ width: `${pct}%`, background: item.color }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* 2.1 BANKA HESAPLARI, KMH VE NAKİT KASALAR VARLIK TABLOSU */}
                <div className="section-header sub">
                  <span>2.1. Banka Hesapları, KMH Durumu ve Nakit Kasalar Dönem Hareket Tablosu</span>
                  <span className="badge">Net Likit: {fmt(reportData.totalNetBanks + reportData.totalCashAssets)}</span>
                </div>
                <table className="compact-table">
                  <thead>
                    <tr>
                      <th>Hesap Türü & Adı</th>
                      <th>Bağlı Merkez</th>
                      <th className="num">Dönem Başı</th>
                      <th className="num">Dönem Giriş (+)</th>
                      <th className="num">Dönem Çıkış (-)</th>
                      <th className="num">Dönem Sonu</th>
                      <th className="num">Güncel Bakiye</th>
                      <th className="num">KMH Limiti</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.bankBalanceRows.map(b => (
                      <tr key={b.id}>
                        <td><strong>🏦 {b.name}</strong> ({b.currency})</td>
                        <td>{b.companyName}</td>
                        <td className="num">{fmt(b.opening)}</td>
                        <td className="num pos">+{fmt(b.inflow)}</td>
                        <td className="num neg">-{fmt(b.outflow)}</td>
                        <td className={`num ${b.closing >= 0 ? 'pos' : 'neg'}`}>{fmt(b.closing)}</td>
                        <td className={`num ${b.currentTry >= 0 ? 'pos' : 'neg'}`}>{fmt(b.currentTry)}</td>
                        <td className="num muted">{b.kmhLimit > 0 ? fmt(b.kmhLimit) : '-'}</td>
                      </tr>
                    ))}
                    {reportData.cashBalanceRows.map(c => (
                      <tr key={c.id}>
                        <td><strong>💵 {c.name} (Nakit Kasa)</strong> ({c.currency})</td>
                        <td>{c.companyName}</td>
                        <td className="num">{fmt(c.opening)}</td>
                        <td className="num pos">+{fmt(c.inflow)}</td>
                        <td className="num neg">-{fmt(c.outflow)}</td>
                        <td className={`num ${c.closing >= 0 ? 'pos' : 'neg'}`}>{fmt(c.closing)}</td>
                        <td className={`num ${c.currentTry >= 0 ? 'pos' : 'neg'}`}>{fmt(c.currentTry)}</td>
                        <td className="num muted">-</td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td colSpan={2}>TOPLAM LİKİT VARLIKLAR (BANKA + KASA NET)</td>
                      <td className="num">{fmt(reportData.bankBalanceRows.reduce((a, x) => a + x.opening, 0) + reportData.cashBalanceRows.reduce((a, x) => a + x.opening, 0))}</td>
                      <td className="num pos">+{fmt(reportData.bankBalanceRows.reduce((a, x) => a + x.inflow, 0) + reportData.cashBalanceRows.reduce((a, x) => a + x.inflow, 0))}</td>
                      <td className="num neg">-{fmt(reportData.bankBalanceRows.reduce((a, x) => a + x.outflow, 0) + reportData.cashBalanceRows.reduce((a, x) => a + x.outflow, 0))}</td>
                      <td className="num">{fmt(reportData.bankBalanceRows.reduce((a, x) => a + x.closing, 0) + reportData.cashBalanceRows.reduce((a, x) => a + x.closing, 0))}</td>
                      <td className="num">{fmt(reportData.totalNetBanks + reportData.totalCashAssets)}</td>
                      <td className="num">{fmt(reportData.bankBalanceRows.reduce((a, x) => a + x.kmhLimit, 0))}</td>
                    </tr>
                  </tbody>
                </table>

                {/* 2.2 DEPO & STOK VARLIĞI VE KREDİ KARTLARI / BANKA KREDİLERİ */}
                <div className="two-col" style={{ marginTop: '8px' }}>
                  <div>
                    <div className="section-header sub" style={{ marginTop: 0 }}>
                      <span>2.2. Depo & Stok Varlığı Analizi</span>
                      <span className="badge">KDV Dahil: {fmt(reportData.totalStockVatIncl)}</span>
                    </div>
                    <table className="compact-table">
                      <thead>
                        <tr>
                          <th>Depo Adı</th>
                          <th className="center">Çeşit</th>
                          <th className="num">Dönem Çıkış</th>
                          <th className="num">Net Değer</th>
                          <th className="num">KDV Dahil</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.whBalanceRows.map(w => (
                          <tr key={w.id}>
                            <td><strong>📦 {w.name}</strong> ({w.companyName})</td>
                            <td className="center">{w.itemCount}</td>
                            <td className="num neg">-{fmt(w.outflow)}</td>
                            <td className="num">{fmt(w.currentNetTry)}</td>
                            <td className="num pos">{fmt(w.currentVatInclTry)}</td>
                          </tr>
                        ))}
                        <tr className="total-row">
                          <td>TOPLAM STOK</td>
                          <td className="center">{reportData.whBalanceRows.reduce((a, w) => a + w.itemCount, 0)}</td>
                          <td className="num neg">-{fmt(reportData.whBalanceRows.reduce((a, w) => a + w.outflow, 0))}</td>
                          <td className="num">{fmt(reportData.totalStockNet)}</td>
                          <td className="num pos">{fmt(reportData.totalStockVatIncl)}</td>
                        </tr>
                      </tbody>
                    </table>

                    {reportData.activeLoanRows.length > 0 && (
                      <>
                        <div className="section-header sub">
                          <span>2.3. Aktif Banka Kredileri Borç Yükümlülüğü</span>
                          <span className="badge">Anapara: -{fmt(reportData.totalLoanPrincipal)}</span>
                        </div>
                        <table className="compact-table">
                          <thead>
                            <tr>
                              <th>Banka & Kredi Adı</th>
                              <th className="center">Taksit</th>
                              <th className="num">Aylık Taksit</th>
                              <th className="num">Kalan Anapara</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.activeLoanRows.map(l => (
                              <tr key={l.id}>
                                <td><strong>{l.bankName}</strong> - {l.loanName}</td>
                                <td className="center">{l.paidCount}/{l.totalCount}</td>
                                <td className="num">{fmt(l.monthlyInstallment)}</td>
                                <td className="num neg">-{fmt(l.remainingPrincipal)}</td>
                              </tr>
                            ))}
                            <tr className="total-row">
                              <td colSpan={2}>TOPLAM KREDİ ANAPARA BORCU</td>
                              <td className="num">{fmt(reportData.activeLoanRows.reduce((a, l) => a + l.monthlyInstallment, 0))}</td>
                              <td className="num neg">-{fmt(reportData.totalLoanPrincipal)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>

                  <div>
                    <div className="section-header sub" style={{ marginTop: 0 }}>
                      <span>2.4. Kredi Kartları Borç & Limit Kullanım Analizi</span>
                      <span className="badge">Güncel Borç: -{fmt(reportData.totalCardDebt)}</span>
                    </div>
                    <table className="compact-table">
                      <thead>
                        <tr>
                          <th>Kart Adı & Merkez</th>
                          <th className="num">Kart Limiti</th>
                          <th className="num">Dönem Harcama</th>
                          <th className="num">Güncel Borç</th>
                          <th className="num">Kullanılabilir</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.creditCardRows.map(c => (
                          <tr key={c.id}>
                            <td>
                              <strong>💳 {c.name}</strong> ({c.companyName})
                              <div className="bar-track" style={{ height: '4px', marginTop: '2px' }}>
                                <div style={{ width: `${c.usagePct}%`, background: c.usagePct > 50 ? '#ef4444' : '#3b82f6' }} />
                              </div>
                            </td>
                            <td className="num">{fmt(c.cardLimit)}</td>
                            <td className="num neg">+{fmt(c.spend)}</td>
                            <td className="num neg">-{fmt(c.currentDebt)}</td>
                            <td className="num pos">{fmt(c.availLimit)}</td>
                          </tr>
                        ))}
                        <tr className="total-row">
                          <td>TOPLAM KREDİ KARTLARI</td>
                          <td className="num">{fmt(reportData.totalCardLimit)}</td>
                          <td className="num neg">+{fmt(reportData.creditCardRows.reduce((a, c) => a + c.spend, 0))}</td>
                          <td className="num neg">-{fmt(reportData.totalCardDebt)}</td>
                          <td className="num pos">{fmt(reportData.totalCardAvail)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 2.5 MÜŞTERİ ALACAKLARI VE TEDARİKÇİ BORÇLARI YAN YANA TABLO */}
                <div className="two-col" style={{ marginTop: '8px' }}>
                  <div>
                    <div className="section-header sub" style={{ marginTop: 0 }}>
                      <span>2.5. Müşteri & Cari Alacaklarımız ({reportData.customerReceivableRows.length} Cari)</span>
                      <span className="badge">Güncel Alacak: +{fmt(reportData.totalCustomerReceivables)}</span>
                    </div>
                    <table className="compact-table">
                      <thead>
                        <tr>
                          <th>Müşteri / Cari Adı</th>
                          <th>Merkez</th>
                          <th className="num">Dönem Satış (+)</th>
                          <th className="num">Tahsilat (-)</th>
                          <th className="num">Güncel Alacak</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.customerReceivableRows.length === 0 ? (
                          <tr><td colSpan={5} className="center muted">Kayıtlı cari alacak bulunmuyor.</td></tr>
                        ) : reportData.customerReceivableRows.map(c => (
                          <tr key={c.id}>
                            <td><strong>{c.name}</strong></td>
                            <td>{c.companyName}</td>
                            <td className="num">{c.debt > 0 ? `+${fmt(c.debt)}` : '-'}</td>
                            <td className="num pos">{c.payment > 0 ? `-${fmt(c.payment)}` : '-'}</td>
                            <td className={`num ${c.currentTry > 0 ? 'pos' : 'muted'}`}>{fmt(c.currentTry)}</td>
                          </tr>
                        ))}
                        <tr className="total-row">
                          <td colSpan={2}>TOPLAM MÜŞTERİ ALACAKLARI</td>
                          <td className="num">+{fmt(reportData.customerReceivableRows.reduce((a, c) => a + c.debt, 0))}</td>
                          <td className="num pos">-{fmt(reportData.customerReceivableRows.reduce((a, c) => a + c.payment, 0))}</td>
                          <td className="num pos">{fmt(reportData.totalCustomerReceivables)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div>
                    <div className="section-header sub" style={{ marginTop: 0 }}>
                      <span>2.6. Tedarikçi (Satıcı) Borçlarımız ({reportData.supplierPayableRows.length} Cari)</span>
                      <span className="badge">Güncel Borç: -{fmt(reportData.totalSupplierPayables)}</span>
                    </div>
                    <table className="compact-table">
                      <thead>
                        <tr>
                          <th>Tedarikçi / Firma Adı</th>
                          <th>Merkez</th>
                          <th className="num">Dönem Alım (+)</th>
                          <th className="num">Ödeme (-)</th>
                          <th className="num">Güncel Borç</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.supplierPayableRows.length === 0 ? (
                          <tr><td colSpan={5} className="center muted">Kayıtlı tedarikçi borcu bulunmuyor.</td></tr>
                        ) : reportData.supplierPayableRows.map(s => (
                          <tr key={s.id}>
                            <td><strong>{s.name}</strong></td>
                            <td>{s.companyName}</td>
                            <td className="num neg">{s.debt > 0 ? `+${fmt(s.debt)}` : '-'}</td>
                            <td className="num pos">{s.payment > 0 ? `-${fmt(s.payment)}` : '-'}</td>
                            <td className={`num ${s.currentTry > 0 ? 'neg' : 'muted'}`}>{fmt(s.currentTry)}</td>
                          </tr>
                        ))}
                        <tr className="total-row">
                          <td colSpan={2}>TOPLAM TEDARİKÇİ BORÇLARI</td>
                          <td className="num neg">+{fmt(reportData.supplierPayableRows.reduce((a, s) => a + s.debt, 0))}</td>
                          <td className="num pos">-{fmt(reportData.supplierPayableRows.reduce((a, s) => a + s.payment, 0))}</td>
                          <td className="num neg">{fmt(reportData.totalSupplierPayables)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ================================================================ */}
          {/* BÖLÜM 3: MERKEZLERİN AYRI AYRI ÇOK DETAYLI KÂR VE İŞLEM ANALİZİ  */}
          {/* ================================================================ */}
          {(sectionFilter === 'all' || sectionFilter === 'centers') && (
            <>
              {reportData.centerReports.filter(cr =>
                cr.totalRevenue > 0 ||
                cr.totalSmm > 0 ||
                cr.programCommExpenses > 0 ||
                cr.personalExpenses > 0 ||
                cr.nonRevDebts.length > 0 ||
                cr.custPayments.length > 0
              ).map((cr, cIdx) => (
                <div key={cr.center.id || 'common'}>
                  <div className="page-break" />
                  <div className="report-header">
                    <div>
                      <h1 className="report-title">
                        MERKEZ DETAY ANALİZİ {cIdx + 1}: {cr.center.name.toUpperCase()} ({periodTitle})
                      </h1>
                      <p className="report-subtitle">
                        {cr.center.is_personal
                          ? 'Vadeli Mevduat Faiz Gelirleri, Şahsi Cari Alacak/Tahsilat Hareketleri ve Kişisel Harcama Kırılımı'
                          : 'Gelir Kanalları, Satılan Mal/Hizmet Maliyeti (SMM), Faaliyet Giderleri ve İşlem Bazlı Net Kâr Tablosu'}
                      </p>
                    </div>
                    <div className="report-meta">
                      <div><strong>Toplam Ciro:</strong> {fmt(cr.totalRevenue)} | <strong>SMM:</strong> -{fmt(cr.totalSmm)}</div>
                      <div>
                        <strong>{cr.center.is_personal ? 'Şahsi Harcama:' : 'Gerçek Gider:'}</strong>{' '}
                        -{fmt(cr.center.is_personal ? cr.personalExpenses : cr.trueCommExpenses)} |{' '}
                        <strong>Net Ticari Kâr:</strong> +{fmt(cr.trueNetProfit)}
                      </div>
                    </div>
                  </div>

                  {/* A) TİCARİ MERKEZ İSE: GELİR KANALLARI VE BRÜT KÂR TABLOSU */}
                  {!cr.center.is_personal && (
                    <div className="section-box avoid-break">
                      <div className="section-header">
                        <span>{cr.center.name.toUpperCase()} — CİRO, MALİYET (SMM) VE BRÜT KÂR KAYNAKLARI</span>
                        <span className="badge">Brüt Kâr: +{fmt(cr.grossProfit)} (%{cr.grossMarginPct.toFixed(2)})</span>
                      </div>
                      <table>
                        <thead>
                          <tr>
                            <th>Gelir Kanalı / Kategori</th>
                            <th className="center">İşlem</th>
                            <th className="num">Nakit</th>
                            <th className="num">Kart / Banka / Cari</th>
                            <th className="num">Toplam Ciro</th>
                            <th className="num">Maliyet (SMM)</th>
                            <th className="num">Kanal Brüt Kârı</th>
                            <th className="center">Marj</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cr.posCategories.map(cat => (
                            <tr key={cat.id}>
                              <td><strong>{cat.label}</strong></td>
                              <td className="center">{cat.count}</td>
                              <td className="num">{fmt(cat.cash)}</td>
                              <td className="num">{fmt(cat.card)}</td>
                              <td className="num">{fmt(cat.rev)}</td>
                              <td className={`num ${cat.cost > 0 ? 'neg' : 'muted'}`}>{cat.cost > 0 ? `-${fmt(cat.cost)}` : '0,00 ₺'}</td>
                              <td className="num pos">+{fmt(cat.profit)}</td>
                              <td className="center">%{cat.marginPct.toFixed(1)}</td>
                            </tr>
                          ))}
                          {cr.posCategories.length > 0 && (
                            <tr className="subtotal-row">
                              <td>Mağaza (POS) Satışları Ara Toplamı</td>
                              <td className="center">{cr.posCategories.reduce((a, x) => a + x.count, 0)}</td>
                              <td className="num">{fmt(cr.posCashTotal)}</td>
                              <td className="num">{fmt(cr.posCardTotal)}</td>
                              <td className="num">{fmt(cr.posRevTotal)}</td>
                              <td className="num neg">-{fmt(cr.posTotalSmm)}</td>
                              <td className="num pos">+{fmt(cr.posRevTotal - cr.posTotalSmm)}</td>
                              <td className="center">%{cr.posRevTotal > 0 ? (((cr.posRevTotal - cr.posTotalSmm) / cr.posRevTotal) * 100).toFixed(1) : '0.0'}</td>
                            </tr>
                          )}
                          {cr.periodTechTickets.length > 0 && (
                            <tr>
                              <td><strong>Teknik Servis Teslimatları</strong></td>
                              <td className="center">{cr.periodTechTickets.length} Fiş</td>
                              <td className="num">{fmt(cr.techCashTotal)}</td>
                              <td className="num">{fmt(cr.techCardTotal)}</td>
                              <td className="num">{fmt(cr.techRevTotal)}</td>
                              <td className={`num ${cr.techPartsTotal > 0 ? 'neg' : 'muted'}`}>{cr.techPartsTotal > 0 ? `-${fmt(cr.techPartsTotal)}` : '0,00 ₺'}</td>
                              <td className="num pos">+{fmt(cr.techRevTotal - cr.techPartsTotal)}</td>
                              <td className="center">%{cr.techRevTotal > 0 ? (((cr.techRevTotal - cr.techPartsTotal) / cr.techRevTotal) * 100).toFixed(1) : '0.0'}</td>
                            </tr>
                          )}
                          {cr.commSales.length > 0 && (
                            <tr>
                              <td><strong>Cari Fatura / Reklam / Tasarım Satışları</strong></td>
                              <td className="center">{cr.commSales.length} İşlem</td>
                              <td className="num">0,00 ₺</td>
                              <td className="num">{fmt(cr.custSalesRev)}</td>
                              <td className="num">{fmt(cr.custSalesRev)}</td>
                              <td className={`num ${cr.stockOutInvoice > 0 ? 'neg' : 'muted'}`}>{cr.stockOutInvoice > 0 ? `-${fmt(cr.stockOutInvoice)}` : '0,00 ₺'}</td>
                              <td className="num pos">+{fmt(cr.custSalesRev - cr.stockOutInvoice)}</td>
                              <td className="center">%{cr.custSalesRev > 0 ? (((cr.custSalesRev - cr.stockOutInvoice) / cr.custSalesRev) * 100).toFixed(1) : '0.0'}</td>
                            </tr>
                          )}
                          {cr.periodSubs.length > 0 && (
                            <tr>
                              <td><strong>Kredili Abonelik (tvghost) Satışları</strong></td>
                              <td className="center">{cr.periodSubs.length} Abone</td>
                              <td className="num">0,00 ₺</td>
                              <td className="num">{fmt(cr.subsRev)}</td>
                              <td className="num">{fmt(cr.subsRev)}</td>
                              <td className="num neg">-{fmt(cr.subsCost)}</td>
                              <td className="num pos">+{fmt(cr.subsRev - cr.subsCost)}</td>
                              <td className="center">%{cr.subsRev > 0 ? (((cr.subsRev - cr.subsCost) / cr.subsRev) * 100).toFixed(1) : '0.0'}</td>
                            </tr>
                          )}
                          {cr.interestRev > 0 && (
                            <tr>
                              <td><strong>Vadeli Mevduat Günlük Faiz Geliri</strong></td>
                              <td className="center">{cr.periodBankInterest.length} Gün</td>
                              <td className="num">0,00 ₺</td>
                              <td className="num">{fmt(cr.interestRev)}</td>
                              <td className="num">{fmt(cr.interestRev)}</td>
                              <td className="num muted">0,00 ₺</td>
                              <td className="num pos">+{fmt(cr.interestRev)}</td>
                              <td className="center">%100,0</td>
                            </tr>
                          )}
                          <tr className="total-row">
                            <td>TOPLAM ({cr.center.name.toUpperCase()})</td>
                            <td className="center">-</td>
                            <td className="num">{fmt(cr.posCashTotal + cr.techCashTotal)}</td>
                            <td className="num">{fmt(cr.totalRevenue - (cr.posCashTotal + cr.techCashTotal))}</td>
                            <td className="num">{fmt(cr.totalRevenue)}</td>
                            <td className="num neg">-{fmt(cr.totalSmm)}</td>
                            <td className="num pos">+{fmt(cr.grossProfit)}</td>
                            <td className="center">%{cr.grossMarginPct.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* A2) ŞAHSİ MERKEZ İSE VEYA FAİZ / CARİ TAHSİLAT VARSA YAN YANA TABLOLAR */}
                  {(cr.nonRevDebts.length > 0 || cr.custPayments.length > 0 || cr.periodBankInterest.length > 0) && (
                    <div className="two-col avoid-break" style={{ marginBottom: '12px' }}>
                      {(cr.nonRevDebts.length > 0 || cr.custPayments.length > 0) && (
                        <div>
                          <div className="section-header sub" style={{ marginTop: 0 }}>
                            <span>{cr.center.name} — Cari Alacak & Tahsilat Hareketleri</span>
                            <span className="badge">Tahsilat: +{fmt(cr.custPayments.reduce((a, p) => a + p.payTry, 0))}</span>
                          </div>
                          <table className="compact-table">
                            <thead>
                              <tr>
                                <th>Tarih</th>
                                <th>Cari / Kişi</th>
                                <th>Açıklama</th>
                                <th className="num">Tutar</th>
                              </tr>
                            </thead>
                            <tbody>
                              {cr.nonRevDebts.map(d => (
                                <tr key={d.id}>
                                  <td>{formatDateTR(d.tx_date)}</td>
                                  <td><strong>{d.customerName}</strong></td>
                                  <td>{d.description || 'Cari Borçlandırma'}</td>
                                  <td className="num">+{fmt(d.revTry)}</td>
                                </tr>
                              ))}
                              {cr.custPayments.map(p => (
                                <tr key={p.id}>
                                  <td>{formatDateTR(p.tx_date)}</td>
                                  <td><strong>{p.customerName}</strong></td>
                                  <td>{p.description || 'Tahsilat'}</td>
                                  <td className="num pos">+{fmt(p.payTry)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {cr.periodBankInterest.length > 0 && (
                        <div>
                          <div className="section-header sub" style={{ marginTop: 0 }}>
                            <span>{cr.center.name} — Mevduat Günlük Faiz Geliri ({cr.periodBankInterest.length} İşlem)</span>
                            <span className="badge">Net Faiz: +{fmt(cr.interestRev)}</span>
                          </div>
                          <table className="compact-table">
                            <thead>
                              <tr>
                                <th>Dönem / Açıklama</th>
                                <th className="center">İşlem</th>
                                <th className="num">Toplam Net Faiz</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td><strong>Enpara Workbench (Vadeli Hesap) Günlük Faizleri</strong></td>
                                <td className="center">{cr.periodBankInterest.length} Gün</td>
                                <td className="num pos">+{fmt(cr.interestRev)}</td>
                              </tr>
                              <tr>
                                <td>En Düşük / En Yüksek Günlük Net Faiz</td>
                                <td className="center">-</td>
                                <td className="num">
                                  {fmt(Math.min(...cr.periodBankInterest.map(x => Number(x.amount || 0))))} / {fmt(Math.max(...cr.periodBankInterest.map(x => Number(x.amount || 0))))}
                                </td>
                              </tr>
                              <tr>
                                <td>Günlük Ortalama Net Faiz Getirisi</td>
                                <td className="center">Ort.</td>
                                <td className="num pos">+{fmt(cr.interestRev / cr.periodBankInterest.length)} / gün</td>
                              </tr>
                              <tr className="total-row">
                                <td>TOPLAM MEVDUAT FAİZ GELİRİ (NET KÂR)</td>
                                <td className="center">{cr.periodBankInterest.length}</td>
                                <td className="num pos">+{fmt(cr.interestRev)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* B) CARİ FATURALAR KALEM DETAY TABLOSU (VARSA) */}
                  {cr.commSales.length > 0 && (
                    <div className="section-box avoid-break">
                      <div className="section-header sub">
                        <span>{cr.center.name} — Cari Satışlar ve Detaylı Fatura Kalemleri ({cr.commSales.length} İşlem)</span>
                        <span className="badge">Ciro: {fmt(cr.custSalesRev)}</span>
                      </div>
                      <table className="compact-table">
                        <thead>
                          <tr>
                            <th>Tarih</th>
                            <th>Müşteri / Cari</th>
                            <th>Fatura Açıklaması & Alt Kalemler</th>
                            <th className="num">Satış Tutarı</th>
                            <th className="num">Kalem SMM</th>
                            <th className="num">Brüt Kâr</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cr.commSales.map(s => (
                            <tr key={s.id}>
                              <td>{formatDateTR(s.tx_date)}</td>
                              <td><strong>{s.customerName}</strong></td>
                              <td>
                                <div>{s.description || 'Cari Satış'}</div>
                                {Array.isArray(s.invoice_lines) && s.invoice_lines.map((l: any, idx: number) => (
                                  <div key={idx} style={{ fontSize: '7pt', color: '#475569', marginTop: '1px' }}>
                                    • <strong>{l.name}</strong> ({l.quantity} Adet) — Satış: {fmt(Number(l.quantity || 1) * Number(l.unitPrice || 0))} / Maliyet: {fmt(Number(l.quantity || 1) * Number(l.costPrice || 0))}
                                  </div>
                                ))}
                              </td>
                              <td className="num">{fmt(s.revTry)}</td>
                              <td className={`num ${s.invoiceCostTry > 0 ? 'neg' : 'muted'}`}>{s.invoiceCostTry > 0 ? `-${fmt(s.invoiceCostTry)}` : '0,00 ₺'}</td>
                              <td className="num pos">+{fmt(s.revTry - s.invoiceCostTry)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* C) ABONELİKLER TAM LİSTESİ (VARSA) */}
                  {cr.periodSubs.length > 0 && (
                    <div className="section-box avoid-break">
                      <div className="section-header sub">
                        <span>{cr.center.name} — Kredili Abonelik (tvghost) Satışları Tam Listesi ({cr.periodSubs.length} Adet)</span>
                        <span className="badge">Ciro: {fmt(cr.subsRev)} | SMM: -{fmt(cr.subsCost)} | Net Kâr: +{fmt(cr.subsRev - cr.subsCost)}</span>
                      </div>
                      <table className="compact-table">
                        <thead>
                          <tr>
                            <th className="center">#</th>
                            <th>Başlangıç</th>
                            <th>Kullanıcı Adı</th>
                            <th>Abone Adı Soyadı</th>
                            <th>Referans / Not</th>
                            <th className="center">Durum</th>
                            <th className="num">Satış</th>
                            <th className="num">Maliyet</th>
                            <th className="num">Net Kâr</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cr.periodSubs.map((s, idx) => (
                            <tr key={s.id}>
                              <td className="center">{idx + 1}</td>
                              <td>{formatDateTR(s.start_date)}</td>
                              <td><strong>{s.username || '-'}</strong></td>
                              <td>{s.full_name || '-'}</td>
                              <td>{s.reference_note || '-'}</td>
                              <td className="center">{s.is_paid ? 'Ödendi' : 'Bekliyor'}</td>
                              <td className="num">{fmt(s.revTry)}</td>
                              <td className="num neg">-{fmt(s.costTry)}</td>
                              <td className="num pos">+{fmt(s.netTry)}</td>
                            </tr>
                          ))}
                          <tr className="total-row">
                            <td colSpan={6}>TOPLAM ABONELİK SATIŞLARI ({cr.periodSubs.length} ADET)</td>
                            <td className="num">{fmt(cr.subsRev)}</td>
                            <td className="num neg">-{fmt(cr.subsCost)}</td>
                            <td className="num pos">+{fmt(cr.subsRev - cr.subsCost)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* D) FAALİYET GİDERLERİ VEYA ŞAHSİ HARCAMALAR TABLOSU */}
                  {(cr.trueCommExpenses > 0 || cr.posSuppPayTotal > 0 || cr.personalExpenses > 0) && (
                    <div className="section-box avoid-break">
                      <div className="section-header sub">
                        <span>
                          {cr.center.name} — {cr.center.is_personal ? 'Şahsi Harcamalar Tam Listesi' : 'Faaliyet Giderleri Kırılımı'}
                        </span>
                        <span className="badge">
                          {cr.center.is_personal ? `Toplam: ${fmt(cr.personalExpenses)}` : `Gerçek Gider: ${fmt(cr.trueCommExpenses)}`}
                        </span>
                      </div>

                      {!cr.center.is_personal ? (
                        <table>
                          <thead>
                            <tr>
                              <th>Gider Grubu / Kategori</th>
                              <th>Kalem Detayları</th>
                              <th className="center">Adet</th>
                              <th className="num">Tutar</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cr.expenseGroups.map(grp => (
                              <tr key={grp.name}>
                                <td><strong>{grp.name}</strong></td>
                                <td>
                                  {grp.items.length <= 6
                                    ? grp.items.map(it => `${formatDateTR(it.dateStr)} ${it.description} (${fmt(it.expTry)})`).join(' | ')
                                    : `${grp.items.length} adet kayıt (${grp.items.slice(0, 3).map(it => `${it.description}: ${fmt(it.expTry)}`).join(', ')} vb.)`}
                                </td>
                                <td className="center">{grp.count}</td>
                                <td className="num neg">{fmt(grp.total)}</td>
                              </tr>
                            ))}
                            {cr.bankCommTotal > 0 && (
                              <tr>
                                <td><strong>Banka POS Komisyon Kesintileri</strong></td>
                                <td>Z-Raporu POS valör komisyon kesintileri</td>
                                <td className="center">{cr.periodBankComm.length}</td>
                                <td className="num neg">{fmt(cr.bankCommTotal)}</td>
                              </tr>
                            )}
                            {cr.posTrueExpTotal > 0 && (
                              <tr>
                                <td><strong>Mağaza Gün İçi Nakit Masraflar</strong></td>
                                <td>{cr.posTrueExpenses.map(e => `${formatDateTR(e.date)} ${e.description} (${fmt(e.expTry)})`).join(' | ')}</td>
                                <td className="center">{cr.posTrueExpenses.length}</td>
                                <td className="num neg">{fmt(cr.posTrueExpTotal)}</td>
                              </tr>
                            )}
                            <tr className="subtotal-row">
                              <td colSpan={3}>GERÇEK TİCARİ FAALİYET GİDERLERİ TOPLAMI (Net Kâr: +{fmt(cr.trueNetProfit)})</td>
                              <td className="num neg">{fmt(cr.trueCommExpenses)}</td>
                            </tr>
                            {cr.posSuppPayTotal > 0 && (
                              <>
                                <tr>
                                  <td><strong>POS Kasadan Yapılan Tedarikçi Ödemeleri*</strong></td>
                                  <td>{cr.posSupplierPayments.map(e => `${formatDateTR(e.date)} ${e.description} (${fmt(e.expTry)})`).join(' | ')}</td>
                                  <td className="center">{cr.posSupplierPayments.length}</td>
                                  <td className="num neg">{fmt(cr.posSuppPayTotal)}</td>
                                </tr>
                                <tr className="total-row">
                                  <td colSpan={3}>PROGRAMDA GÖRÜNEN GİDER TOPLAMI (Program Net Kâr: +{fmt(cr.programNetProfit)})</td>
                                  <td className="num neg">{fmt(cr.programCommExpenses)}</td>
                                </tr>
                              </>
                            )}
                          </tbody>
                        </table>
                      ) : (
                        <table className="compact-table">
                          <thead>
                            <tr>
                              <th className="center">#</th>
                              <th>Tarih</th>
                              <th>Kategori</th>
                              <th>Harcama Açıklaması</th>
                              <th className="center">Ödeme Kaynağı</th>
                              <th className="num">Tutar</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cr.periodExpenses.map((e, idx) => (
                              <tr key={e.id}>
                                <td className="center">{idx + 1}</td>
                                <td>{formatDateTR(e.dateStr)}</td>
                                <td><strong>{e.catClean}</strong></td>
                                <td>{e.description || '-'}</td>
                                <td className="center">
                                  {e.payment_source_type === 'cash' ? 'Nakit Kasa' : e.payment_source_type === 'bank' ? 'Banka Hesabı' : 'Kredi Kartı'}
                                </td>
                                <td className="num neg">{fmt(e.expTry)}</td>
                              </tr>
                            ))}
                            <tr className="total-row">
                              <td colSpan={5}>TOPLAM ŞAHSİ HARCAMALAR ({cr.periodExpenses.length} KAYIT)</td>
                              <td className="num neg">{fmt(cr.personalExpenses)}</td>
                            </tr>
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* E) TEKNİK SERVİS FİŞLERİ TAM LİSTESİ (VARSA) */}
                  {cr.periodTechTickets.length > 0 && (
                    <div className="section-box">
                      <div className="section-header sub">
                        <span>{cr.center.name} — Teslim Edilen Teknik Servis Fişleri Tam Listesi ({cr.periodTechTickets.length} Adet)</span>
                        <span className="badge">Ciro: {fmt(cr.techRevTotal)} | Parça SMM: -{fmt(cr.techPartsTotal)} | Net Kâr: +{fmt(cr.techRevTotal - cr.techPartsTotal)}</span>
                      </div>
                      <table className="compact-table">
                        <thead>
                          <tr>
                            <th className="center">#</th>
                            <th>Teslim Tarihi</th>
                            <th>Fiş No</th>
                            <th>Müşteri Adı</th>
                            <th>Cihaz / Marka-Model</th>
                            <th className="center">Ödeme</th>
                            <th className="num">Servis Ücreti</th>
                            <th className="num">Parça SMM</th>
                            <th className="num">Fiş Net Kârı</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cr.periodTechTickets.map((t, idx) => (
                            <tr key={t.id}>
                              <td className="center">{idx + 1}</td>
                              <td>{formatDateTR(t.deliveredDate)}</td>
                              <td><strong>{t.ticket_no}</strong></td>
                              <td>{t.customer_name || '-'}</td>
                              <td>{t.brand_model || '-'}</td>
                              <td className="center">
                                {t.isFree ? 'Ücretsiz/Garanti' : t.payment_method === 'card' ? 'Kredi Kartı' : 'Nakit'}
                              </td>
                              <td className="num">{fmt(t.revTry)}</td>
                              <td className={`num ${t.partsCostTry > 0 ? 'neg' : 'muted'}`}>
                                {t.partsCostTry > 0 ? `-${fmt(t.partsCostTry)}` : '0,00 ₺'}
                              </td>
                              <td className={`num ${t.netTry >= 0 ? 'pos' : 'neg'}`}>
                                {t.netTry >= 0 ? `+${fmt(t.netTry)}` : fmt(t.netTry)}
                              </td>
                            </tr>
                          ))}
                          <tr className="total-row">
                            <td colSpan={6}>TOPLAM TEKNİK SERVİS TESLİMATLARI ({cr.periodTechTickets.length} FİŞ)</td>
                            <td className="num">{fmt(cr.techRevTotal)}</td>
                            <td className="num neg">-{fmt(cr.techPartsTotal)}</td>
                            <td className="num pos">+{fmt(cr.techRevTotal - cr.techPartsTotal)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { formatMoney } from '@/lib/utils'
import { LayoutDashboard, CreditCard, Landmark, Wallet, ArrowUpRight, ArrowDownLeft, Package, TrendingUp, ChevronDown, ChevronUp, Building, Home as HomeIcon, Filter, BarChart4, ArrowUpRightFromSquare, ArrowDownRightFromSquare, Sparkles, Activity, FileText, Scale, Users, Building2, Search, X, Lock, Wrench, Calendar, Clock, AlertTriangle, CheckCircle2, Zap } from 'lucide-react'

type ExchangeRates = { USD: number | null, EUR: number | null }

type BankDetail = { id: string; bank_name: string; account_name: string; balance: number; currency: any; company_id: string | null }
type CashDetail = { id: string; name: string; balance: number; currency: any; company_id: string | null }
type CardDetail = { id: string; name: string; current_debt: number; card_limit: number; company_id: string | null }
type CustomerDetail = { id: string; name: string; balance: number; currency: string }
type SupplierDetail = { id: string; company_name: string; balance: number; currency: string }
type RawStock = { quantity: number; unit_price: number; vat_rate: number; currency: string; warehouse_id: string }
type Warehouse = { id: string; name: string; company_id: string | null }
type ExpenseTransaction = { id: string; amount: number; exchange_rate: number; company_id: string | null; date?: string; tx_date?: string; description?: string; created_at: string; category?: any }
type Company = { id: string; name: string; is_personal: boolean }

type CustTx = { id: string; tx_date: string; description: string; customer_id: string; tx_type: string; amount: number; currency?: string; exchange_rate: number; company_id: string | null; invoice_lines?: any[]; created_at: string }
type SuppTx = { id: string; tx_date: string; description: string; supplier_id: string; tx_type: string; amount: number; currency?: string; exchange_rate: number; company_id: string | null; created_at: string }
type StockTx = { tx_date: string; tx_type: string; quantity: number; unit_price: number; currency: string; company_id: string | null }
type SubTx = { start_date: string; cost_price: number; sale_price: number; currency: string; company_id: string | null }
type PosTx = { id: string; date: string; category_id: string; cash: number; card: number; cost: number; stock_id: string | null; company_id: string | null }
type TechTicket = { id: string; ticket_no: string; brand_model: string; customer_name: string; status: string; total_cost: number; parts_cost: number; labor_cost: number; delivered_at: string | null; company_id: string | null; created_at: string }

type TimelineItem = {
  id: string
  date: string
  sortDate: Date
  module: 'customer' | 'supplier' | 'expense' | 'technical-service'
  description: string
  amountTry: number
  type: 'in' | 'out' | 'expense' | 'debt'
  companyId: string | null
}

type RecurringTemplate = {
  id: string
  title: string
  company_id: string
  category_id?: string
  amount: number
  currency: 'TRY' | 'USD' | 'EUR'
  due_day: number
  default_source_type?: 'card' | 'bank' | 'cash'
  default_source_id?: string
  note?: string
  start_month?: string
  created_at?: string
}

function formatDateTR(dateStr: string) {
  if (!dateStr) return ''
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-')
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`
  }
  return dateStr
}

export default function Home() {
  const { profile, isAdmin } = useAuth()
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all')

  // Şirket kısıtlaması olan personel için otomatik şirket kilidi
  useEffect(() => {
    if (!isAdmin && profile?.allowed_companies && profile.allowed_companies.length > 0) {
      if (selectedCompanyId === 'all' || selectedCompanyId === 'common' || !profile.allowed_companies.includes(selectedCompanyId)) {
        setSelectedCompanyId(profile.allowed_companies[0])
      }
    }
  }, [isAdmin, profile?.allowed_companies, selectedCompanyId])

  const [rawStocks, setRawStocks] = useState<RawStock[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  
  const [banks, setBanks] = useState<BankDetail[]>([])
  const [cashes, setCashes] = useState<CashDetail[]>([])
  const [cards, setCards] = useState<CardDetail[]>([])
  
  const [customers, setCustomers] = useState<CustomerDetail[]>([])
  const [customerTxs, setCustomerTxs] = useState<CustTx[]>([])
  
  const [suppliers, setSuppliers] = useState<SupplierDetail[]>([])
  const [supplierTxs, setSupplierTxs] = useState<SuppTx[]>([])
  
  const [expenses, setExpenses] = useState<ExpenseTransaction[]>([])
  const [companies, setCompanies] = useState<Company[]>([])

  const [stockTxs, setStockTxs] = useState<StockTx[]>([])
  const [subscriptions, setSubscriptions] = useState<SubTx[]>([])
  const [posTxs, setPosTxs] = useState<PosTx[]>([])
  const [techTickets, setTechTickets] = useState<TechTicket[]>([])

  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
    bank: false, cash: false, card: false, customer: false, supplier: false, stock: false, comm: false, pers: false
  })

  // Cari Borç & Alacak Dağılımı ve Geçmiş Dönem Kıyaslama State'leri
  const [cariTab, setCariTab] = useState<'receivables' | 'payables'>('receivables')
  const [cariPeriod, setCariPeriod] = useState<'month' | '30days'>('month')
  const [cariSearch, setCariSearch] = useState<string>('')

  // Sabit Gider Şablonları ve Vadeler State'leri
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringTemplate[]>([])

  // Alt Alan Son İşlemler Arama & Filtre State'leri
  const [recentSearch, setRecentSearch] = useState<string>('')
  const [recentModuleFilter, setRecentModuleFilter] = useState<'all' | 'customer' | 'supplier' | 'expense' | 'technical-service'>('all')

  const [rates, setRates] = useState<ExchangeRates>({ USD: null, EUR: null })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchExchangeRates()
    fetchDashboardData()
  }, [])

  async function fetchExchangeRates() {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' })
      const data = await res.json()
      if (data && data.rates) {
        const usdToTry = data.rates.TRY
        const eurToTry = usdToTry / data.rates.EUR
        setRates({ USD: Number(usdToTry.toFixed(4)), EUR: Number(eurToTry.toFixed(4)) })
      }
    } catch (err) {
      setRates({ USD: 34.25, EUR: 37.80 })
    }
  }

  async function fetchDashboardData() {
    try {
      const { data: custData } = await supabase.from('customers').select('id, name, balance, currency')
      setCustomers(custData || [])

      const { data: custTxData } = await supabase.from('customer_transactions').select('id, tx_date, description, customer_id, tx_type, amount, exchange_rate, company_id, invoice_lines, created_at')
      setCustomerTxs(custTxData || [])

      const { data: suppData } = await supabase.from('suppliers').select('id, company_name, balance, currency')
      setSuppliers(suppData || [])

      const { data: suppTxData } = await supabase.from('supplier_transactions').select('id, tx_date, description, supplier_id, tx_type, amount, exchange_rate, company_id, created_at')
      setSupplierTxs(suppTxData || [])

      const { data: bankData } = await supabase.from('bank_accounts').select('id, bank_name, account_name, balance, currency, company_id')
      setBanks(bankData || [])

      const { data: cashData } = await supabase.from('cash_registers').select('id, name, balance, currency, company_id')
      setCashes(cashData || [])

      const { data: cardData } = await supabase.from('credit_cards').select('id, name, current_debt, card_limit, company_id')
      setCards(cardData || [])

      const { data: whData } = await supabase.from('warehouses').select('id, name, company_id')
      setWarehouses(whData || [])

      const { data: stockData } = await supabase.from('stocks').select('quantity, unit_price, vat_rate, currency, warehouse_id')
      setRawStocks(stockData || [])

      const { data: expData } = await supabase.from('expense_transactions').select('id, amount, exchange_rate, company_id, tx_date, date, description, created_at, category:expense_categories(name)')
      setExpenses(expData || [])

      const { data: compData } = await supabase.from('companies').select('id, name, is_personal')
      setCompanies(compData || [])

      const { data: stxData } = await supabase.from('stock_transactions').select('tx_date, tx_type, quantity, unit_price, currency, company_id')
      setStockTxs(stxData || [])

      const { data: subData } = await supabase.from('credit_subscriptions').select('start_date, cost_price, sale_price, currency, company_id')
      setSubscriptions(subData || [])

      const { data: posData } = await supabase.from('pos_transactions').select('id, date, category_id, cash, card, cost, stock_id, company_id')
      setPosTxs(posData || [])

      const { data: srvData } = await supabase.from('technical_service_tickets').select('id, ticket_no, brand_model, customer_name, status, total_cost, parts_cost, labor_cost, delivered_at, company_id, created_at')
      setTechTickets(srvData || [])

      // Sabit Gider Şablonlarını expense_categories'den çekme
      const { data: catData } = await supabase.from('expense_categories').select('id, name, created_at')
      const tmpls: RecurringTemplate[] = []
      catData?.forEach(c => {
        if (c.name.startsWith('REC_TEMPLATE::')) {
          try {
            const parsed = JSON.parse(c.name.slice(14))
            tmpls.push({
              id: c.id,
              title: parsed.title || 'Sabit Gider',
              company_id: parsed.company_id || '',
              category_id: parsed.category_id || '',
              amount: Number(parsed.amount) || 0,
              currency: parsed.currency || 'TRY',
              due_day: parsed.due_day !== undefined && parsed.due_day !== null ? Number(parsed.due_day) : 1,
              default_source_type: parsed.default_source_type,
              default_source_id: parsed.default_source_id,
              note: parsed.note || '',
              start_month: parsed.start_month,
              created_at: c.created_at
            })
          } catch (e) {
            // yoksay
          }
        }
      })
      setRecurringTemplates(tmpls)

    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const toggleSection = (section: string) => { setOpenSections(prev => ({ ...prev, [section]: !prev[section] })) }

  const getTryEquivalent = (amount: number, curr: string) => {
    if (curr === 'USD') return amount * (rates.USD || 34.25)
    if (curr === 'EUR') return amount * (rates.EUR || 37.80)
    return amount
  }

  const isRestricted = !isAdmin && profile?.allowed_companies && profile.allowed_companies.length > 0;

  // Şirket bazlı filtreleme fonksiyonu (İzolasyon koruması)
  const effectiveCompanyId = isRestricted
    ? (profile.allowed_companies!.includes(selectedCompanyId) ? selectedCompanyId : profile.allowed_companies![0])
    : selectedCompanyId;

  const isMatch = (compId: string | null) => {
    // Personelin şirket kısıtlaması varsa yalnızca o şirketin kayıtları eşleşir
    if (isRestricted) {
      if (!compId) return false; // Ortak / sahipsiz veriler gizlenir
      if (!profile.allowed_companies!.includes(compId)) return false; // Yetkisiz şirket verileri gizlenir
      return compId === effectiveCompanyId;
    }

    if (effectiveCompanyId === 'all') return true;
    if (effectiveCompanyId === 'common') return compId === null;
    return compId === effectiveCompanyId;
  }

  // Personelin yetkili olduğu şirketler listesi
  const visibleCompanies = useMemo(() => {
    if (isRestricted) {
      return companies.filter(c => profile.allowed_companies!.includes(c.id))
    }
    return companies
  }, [companies, isRestricted, profile?.allowed_companies])

  const filteredBanks = banks.filter(b => isMatch(b.company_id))
  const filteredCashes = cashes.filter(c => isMatch(c.company_id))
  const filteredCards = cards.filter(c => isMatch(c.company_id))
  const filteredWarehouses = warehouses.filter(w => isMatch(w.company_id))
  const validWhIds = filteredWarehouses.map(w => w.id)
  const filteredStocks = rawStocks.filter(s => validWhIds.includes(s.warehouse_id))
  const filteredExpenses = expenses.filter(e => isMatch(e.company_id))

  const activeCustomers = (!isRestricted && effectiveCompanyId === 'all') 
    ? customers.filter(c => Math.abs(c.balance) > 0.01)
    : customers.map(c => {
        const custCurr = c.currency || 'TRY'
        const custRate = custCurr === 'USD' ? (rates.USD || 34.25) : custCurr === 'EUR' ? (rates.EUR || 37.80) : 1
        const bal = customerTxs.filter(t => t.customer_id === c.id && isMatch(t.company_id))
          .reduce((acc, t) => {
            let val = Number(t.amount || 0)
            const txRate = Number(t.exchange_rate) || 1
            const txCurr = t.currency || 'TRY'
            if (custCurr === 'USD') {
              if (txCurr === 'TRY') val = val / (txRate || custRate)
              else if (txCurr === 'EUR') val = (val * (txRate || rates.EUR || 37.80)) / custRate
            } else if (custCurr === 'EUR') {
              if (txCurr === 'TRY') val = val / (txRate || custRate)
              else if (txCurr === 'USD') val = (val * (txRate || rates.USD || 34.25)) / custRate
            } else {
              if (txCurr !== 'TRY') val = val * txRate
            }
            return t.tx_type === 'debt' ? acc + val : acc - val
          }, 0)
        return { ...c, balance: bal }
      }).filter(c => Math.abs(c.balance) > 0.01)

  const activeSuppliers = (!isRestricted && effectiveCompanyId === 'all')
    ? suppliers.filter(s => Math.abs(s.balance) > 0.01)
    : suppliers.map(s => {
        const suppCurr = s.currency || 'TRY'
        const suppRate = suppCurr === 'USD' ? (rates.USD || 34.25) : suppCurr === 'EUR' ? (rates.EUR || 37.80) : 1
        const bal = supplierTxs.filter(t => t.supplier_id === s.id && isMatch(t.company_id))
          .reduce((acc, t) => {
            let val = Number(t.amount || 0)
            const txRate = Number(t.exchange_rate) || 1
            const txCurr = t.currency || 'TRY'
            if (suppCurr === 'USD') {
              if (txCurr === 'TRY') val = val / (txRate || suppRate)
              else if (txCurr === 'EUR') val = (val * (txRate || rates.EUR || 37.80)) / suppRate
            } else if (suppCurr === 'EUR') {
              if (txCurr === 'TRY') val = val / (txRate || suppRate)
              else if (txCurr === 'USD') val = (val * (txRate || rates.USD || 34.25)) / suppRate
            } else {
              if (txCurr !== 'TRY') val = val * txRate
            }
            return t.tx_type === 'debt' ? acc + val : acc - val
          }, 0)
        return { ...s, balance: bal }
      }).filter(s => Math.abs(s.balance) > 0.01)

  const totalBankTry = filteredBanks.reduce((acc, b) => acc + getTryEquivalent(Number(b.balance || 0), b.currency || 'TRY'), 0)
  const totalCashTry = filteredCashes.reduce((acc, c) => acc + getTryEquivalent(Number(c.balance || 0), c.currency || 'TRY'), 0)
  const totalCreditTry = filteredCards.reduce((acc, c) => acc + Number(c.current_debt || 0), 0)
  const totalStockTry = filteredStocks.reduce((acc, s) => acc + getTryEquivalent(s.quantity * s.unit_price * (1 + (s.vat_rate || 0)/100), s.currency || 'TRY'), 0)
  const totalCustomerTry = activeCustomers.reduce((acc, c) => acc + getTryEquivalent(Number(c.balance || 0), c.currency || 'TRY'), 0)
  const totalSupplierTry = activeSuppliers.reduce((acc, s) => acc + getTryEquivalent(Number(s.balance || 0), s.currency || 'TRY'), 0)

  const warehouseTotals = filteredWarehouses.map(wh => {
    const whStocks = filteredStocks.filter(s => s.warehouse_id === wh.id)
    const val = whStocks.reduce((acc, s) => acc + getTryEquivalent(s.quantity * s.unit_price * (1 + (s.vat_rate || 0)/100), s.currency || 'TRY'), 0)
    return { ...wh, totalValue: val }
  }).filter(wh => wh.totalValue > 0)

  const commercialExpensesList = filteredExpenses.filter(e => e.company_id && !companies.find(c => c.id === e.company_id)?.is_personal)
  const personalExpensesList = isAdmin ? filteredExpenses.filter(e => !e.company_id || companies.find(c => c.id === e.company_id)?.is_personal) : []
  
  // POS (Mağaza) Nakit Giderlerinin Hesaplanması
  const posExpTotalComm = posTxs.filter(t => t.category_id === 'gider' && isMatch(t.company_id) && (!t.company_id || !companies.find(c => c.id === t.company_id)?.is_personal)).reduce((acc, t) => acc + Number(t.cash) + Number(t.card), 0)
  const posExpTotalPers = isAdmin ? posTxs.filter(t => t.category_id === 'gider' && isMatch(t.company_id) && (t.company_id && companies.find(c => c.id === t.company_id)?.is_personal)).reduce((acc, t) => acc + Number(t.cash) + Number(t.card), 0) : 0

  const totalCommExpTry = commercialExpensesList.reduce((acc, e) => acc + (e.amount * (e.exchange_rate || 1)), 0) + posExpTotalComm
  const totalPersExpTry = personalExpensesList.reduce((acc, e) => acc + (e.amount * (e.exchange_rate || 1)), 0) + posExpTotalPers

  const commExpBreakdown = visibleCompanies.filter(c => !c.is_personal).map(c => {
    const expTxsTotal = commercialExpensesList.filter(e => e.company_id === c.id).reduce((acc, e) => acc + (e.amount * (e.exchange_rate || 1)), 0)
    const posTxsTotal = posTxs.filter(t => t.category_id === 'gider' && t.company_id === c.id).reduce((acc, t) => acc + Number(t.cash) + Number(t.card), 0)
    return { id: c.id, name: c.name, total: expTxsTotal + posTxsTotal }
  }).filter(c => c.total > 0).sort((a, b) => b.total - a.total)

  const persExpBreakdown = isAdmin ? Array.from(new Set(personalExpensesList.map(e => e.category?.name || 'Diğer'))).map(catName => {
    const total = personalExpensesList.filter(e => (e.category?.name || 'Diğer') === catName).reduce((acc, e) => acc + (e.amount * (e.exchange_rate || 1)), 0)
    return { id: catName, name: catName, total }
  }).filter(c => c.total > 0).sort((a, b) => b.total - a.total) : []

  const netFinancialPosition = totalBankTry + totalCashTry + totalCustomerTry - totalSupplierTry - totalCreditTry

  const monthsData: Record<string, { revenue: number, cost: number, expense: number, profit: number, monthLabel: string }> = {}
  const now = new Date()
  const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
  const last6MonthKeys: string[] = []

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const key = `${yyyy}-${mm}`
    last6MonthKeys.push(key)
    monthsData[key] = { revenue: 0, cost: 0, expense: 0, profit: 0, monthLabel: `${monthNames[d.getMonth()]} ${yyyy}` }
  }

  // Cari ve Abonelik Gelirleri
  customerTxs.filter(t => isMatch(t.company_id) && t.tx_type === 'debt').forEach(tx => {
    const mKey = tx.tx_date?.substring(0, 7)
    if (mKey && monthsData[mKey]) monthsData[mKey].revenue += tx.amount * (tx.exchange_rate || 1)
  })
  subscriptions.filter(s => isMatch(s.company_id)).forEach(sub => {
    const mKey = sub.start_date?.substring(0, 7)
    if (mKey && monthsData[mKey]) monthsData[mKey].revenue += getTryEquivalent(sub.sale_price, sub.currency || 'TRY')
  })

  // Stok ve Abonelik Maliyetleri
  stockTxs.filter(t => isMatch(t.company_id) && t.tx_type === 'out').forEach(tx => {
    const mKey = tx.tx_date?.substring(0, 7)
    if (mKey && monthsData[mKey]) monthsData[mKey].cost += getTryEquivalent(tx.quantity * tx.unit_price, tx.currency || 'TRY')
  })
  subscriptions.filter(s => isMatch(s.company_id)).forEach(sub => {
    const mKey = sub.start_date?.substring(0, 7)
    if (mKey && monthsData[mKey]) monthsData[mKey].cost += getTryEquivalent(sub.cost_price, sub.currency || 'TRY')
  })

  // Ticari Giderler
  commercialExpensesList.forEach(exp => {
    const dStr = exp.tx_date || exp.date || exp.created_at?.substring(0, 10)
    const mKey = dStr?.substring(0, 7)
    if (mKey && monthsData[mKey]) monthsData[mKey].expense += exp.amount * (exp.exchange_rate || 1)
  })

  // YENİ: Mağaza Satış (POS) P&L Entegrasyonu (Çifte Sayım Korumalı)
  posTxs.filter(t => isMatch(t.company_id)).forEach(tx => {
    const mKey = tx.date?.substring(0, 7)
    if (mKey && monthsData[mKey]) {
      if (tx.category_id === 'gider') {
         monthsData[mKey].expense += (Number(tx.cash) + Number(tx.card))
      } else {
         monthsData[mKey].revenue += (Number(tx.cash) + Number(tx.card))
         // ÇİFTE SAYIM KORUMASI: Eğer satır bir stoka bağlıysa, onun maliyeti zaten "stock_transactions" (out) olarak eklendi.
         // Bu yüzden sadece stok dışı, serbest satılan ürün/hizmet maliyetlerini grafiğe dahil ediyoruz.
          if (!tx.stock_id) {
              monthsData[mKey].cost += Number(tx.cost)
          }
      }
    }
  })

  // YENİ: Teknik Servis Teslimat Gelirleri P&L Entegrasyonu
  techTickets.filter(t => isMatch(t.company_id) && t.status === 'delivered').forEach(ticket => {
    const dStr = ticket.delivered_at || ticket.created_at
    const mKey = dStr?.substring(0, 7)
    if (mKey && monthsData[mKey]) {
      monthsData[mKey].revenue += Number(ticket.total_cost || 0)
    }
  })

  let maxChartValue = 100
  last6MonthKeys.forEach(k => {
    monthsData[k].profit = monthsData[k].revenue - monthsData[k].cost - monthsData[k].expense
    const maxValInMonth = Math.max(monthsData[k].revenue, monthsData[k].cost + monthsData[k].expense)
    if (maxValInMonth > maxChartValue) maxChartValue = maxValInMonth
  })

  const currentMonthKey = last6MonthKeys[5]
  const prevMonthKey = last6MonthKeys[4]
  const currData = monthsData[currentMonthKey] || { revenue: 0, cost: 0, expense: 0, profit: 0 }
  const prevData = monthsData[prevMonthKey] || { revenue: 0, cost: 0, expense: 0, profit: 0 }

  const calculateTrend = (curr: number, prev: number) => {
    if (prev === 0 && curr > 0) return { percent: 100, isUp: true }
    if (prev === 0 && curr === 0) return { percent: 0, isUp: true }
    const diff = curr - prev
    const percent = Math.abs((diff / prev) * 100)
    return { percent: percent > 999 ? 999 : percent, isUp: diff >= 0 }
  }

  const revenueTrend = calculateTrend(currData.revenue, prevData.revenue)
  const profitTrend = calculateTrend(currData.profit, prevData.profit)

  // Mağaza Net Kâr Gösterge Kartı İçin Hesaplama
  let currPosRev = 0, currPosCost = 0, prevPosRev = 0, prevPosCost = 0;
  posTxs.filter(t => isMatch(t.company_id) && t.category_id !== 'gider').forEach(t => {
    const mKey = t.date?.substring(0, 7)
    const rev = Number(t.cash) + Number(t.card)
    const cost = Number(t.cost) // Gösterge panosunda mağazanın net kârını görmek için stok durumuna bakmaksızın tüm maliyet toplanır.
    
    if (mKey === currentMonthKey) { currPosRev += rev; currPosCost += cost; }
    if (mKey === prevMonthKey) { prevPosRev += rev; prevPosCost += cost; }
  })
  
  const currPosProfit = currPosRev - currPosCost;
  const prevPosProfit = prevPosRev - prevPosCost;
  const posProfitTrend = calculateTrend(currPosProfit, prevPosProfit)

  const allTimelineItems: TimelineItem[] = []
  
  customerTxs.filter(t => isMatch(t.company_id)).forEach(t => {
      allTimelineItems.push({
          id: `c_${t.id}`, date: t.tx_date || t.created_at?.substring(0, 10), sortDate: new Date(t.created_at || t.tx_date),
          module: 'customer', description: t.description || 'Müşteri İşlemi', amountTry: t.amount * (t.exchange_rate || 1),
          type: t.tx_type === 'debt' ? 'in' : 'out', companyId: t.company_id
      })
  })

  supplierTxs.filter(t => isMatch(t.company_id)).forEach(t => {
      allTimelineItems.push({
          id: `s_${t.id}`, date: t.tx_date || t.created_at?.substring(0, 10), sortDate: new Date(t.created_at || t.tx_date),
          module: 'supplier', description: t.description || 'Tedarikçi İşlemi', amountTry: t.amount * (t.exchange_rate || 1),
          type: t.tx_type === 'debt' ? 'debt' : 'out', companyId: t.company_id
      })
  })

  filteredExpenses.forEach(t => {
      allTimelineItems.push({
          id: `e_${t.id}`, date: t.tx_date || t.date || t.created_at?.substring(0, 10), sortDate: new Date(t.created_at || t.tx_date || t.date || ''),
          module: 'expense', description: t.description || 'Gider / Masraf', amountTry: t.amount * (t.exchange_rate || 1),
          type: 'expense', companyId: t.company_id
      })
  })

  techTickets.filter(t => isMatch(t.company_id) && t.status === 'delivered').forEach(t => {
      const dStr = t.delivered_at || t.created_at
      allTimelineItems.push({
          id: `srv_${t.id}`, date: dStr?.substring(0, 10), sortDate: new Date(dStr),
          module: 'technical-service', description: `Teknik Servis: ${t.ticket_no} - ${t.brand_model} (${t.customer_name})`,
          amountTry: Number(t.total_cost || 0),
          type: 'in', companyId: t.company_id
      })
  })

  allTimelineItems.sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime())
  const recentTransactions = allTimelineItems.slice(0, 30)

  // =====================================================================
  // --- CARİ BORÇ & ALACAK VE GEÇMİŞ DÖNEM KIYASLAMA MOTORU ---
  // =====================================================================
  const cariCutoffDate = useMemo(() => {
    const today = new Date()
    if (cariPeriod === 'month') {
      const yyyy = today.getFullYear()
      const mm = String(today.getMonth() + 1).padStart(2, '0')
      return `${yyyy}-${mm}-01` // Bu ayın başlangıcı (geçen ay sonu eşiği)
    } else {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
  }, [cariPeriod])

  const customerComparisonList = useMemo(() => {
    return customers.map(c => {
      const relevantTxs = customerTxs.filter(t => t.customer_id === c.id && isMatch(t.company_id))
      
      const custCurr = c.currency || 'TRY'
      const custRate = custCurr === 'USD' ? (rates.USD || 34.25) : custCurr === 'EUR' ? (rates.EUR || 37.80) : 1
      const currentBalNative = (!isRestricted && effectiveCompanyId === 'all')
        ? Number(c.balance || 0)
        : relevantTxs.reduce((acc, t) => {
            let val = Number(t.amount || 0)
            const txRate = Number(t.exchange_rate) || 1
            const txCurr = t.currency || 'TRY'
            if (custCurr === 'USD') {
              if (txCurr === 'TRY') val = val / (txRate || custRate)
              else if (txCurr === 'EUR') val = (val * (txRate || rates.EUR || 37.80)) / custRate
            } else if (custCurr === 'EUR') {
              if (txCurr === 'TRY') val = val / (txRate || custRate)
              else if (txCurr === 'USD') val = (val * (txRate || rates.USD || 34.25)) / custRate
            } else {
              if (txCurr !== 'TRY') val = val * txRate
            }
            return t.tx_type === 'debt' ? acc + val : acc - val
          }, 0)

      const currentBal = getTryEquivalent(currentBalNative, custCurr)

      let periodSales = 0
      let periodPayments = 0

      relevantTxs.forEach(t => {
        const txDate = t.tx_date || t.created_at?.substring(0, 10)
        if (txDate >= cariCutoffDate) {
          const val = Number(t.amount || 0) * (t.exchange_rate || 1)
          if (t.tx_type === 'debt') periodSales += val
          if (t.tx_type === 'payment') periodPayments += val
        }
      })

      const previousBal = currentBal - periodSales + periodPayments
      const diff = currentBal - previousBal
      const pct = previousBal !== 0 ? ((diff / Math.abs(previousBal)) * 100) : (currentBal !== 0 ? 100 : 0)

      return {
        id: c.id,
        name: c.name,
        currency: c.currency || 'TRY',
        currentBal,
        previousBal,
        diff,
        pct,
        periodSales,
        periodPayments
      }
    }).filter(c => Math.abs(c.currentBal) > 0.01 || Math.abs(c.previousBal) > 0.01)
      .sort((a, b) => b.currentBal - a.currentBal)
  }, [customers, customerTxs, isRestricted, effectiveCompanyId, cariCutoffDate, isMatch, rates])

  const supplierComparisonList = useMemo(() => {
    return suppliers.map(s => {
      const relevantTxs = supplierTxs.filter(t => t.supplier_id === s.id && isMatch(t.company_id))
      const suppCurr = s.currency || 'TRY'
      const suppRate = suppCurr === 'USD' ? (rates.USD || 34.25) : suppCurr === 'EUR' ? (rates.EUR || 37.80) : 1
      
      const currentBalNative = (!isRestricted && effectiveCompanyId === 'all')
        ? Number(s.balance || 0)
        : relevantTxs.reduce((acc, t) => {
            let val = Number(t.amount || 0)
            const txRate = Number(t.exchange_rate) || 1
            const txCurr = t.currency || 'TRY'
            if (suppCurr === 'USD') {
              if (txCurr === 'TRY') val = val / (txRate || suppRate)
              else if (txCurr === 'EUR') val = (val * (txRate || rates.EUR || 37.80)) / suppRate
            } else if (suppCurr === 'EUR') {
              if (txCurr === 'TRY') val = val / (txRate || suppRate)
              else if (txCurr === 'USD') val = (val * (txRate || rates.USD || 34.25)) / suppRate
            } else {
              if (txCurr !== 'TRY') val = val * txRate
            }
            return t.tx_type === 'debt' ? acc + val : acc - val
          }, 0)

      const currentBal = getTryEquivalent(currentBalNative, suppCurr)

      let periodPurchases = 0
      let periodPayments = 0

      relevantTxs.forEach(t => {
        const txDate = t.tx_date || t.created_at?.substring(0, 10)
        if (txDate >= cariCutoffDate) {
          const val = Number(t.amount || 0) * (t.exchange_rate || 1)
          if (t.tx_type === 'debt') periodPurchases += val
          if (t.tx_type === 'payment') periodPayments += val
        }
      })

      const previousBal = currentBal - periodPurchases + periodPayments
      const diff = currentBal - previousBal
      const pct = previousBal !== 0 ? ((diff / Math.abs(previousBal)) * 100) : (currentBal !== 0 ? 100 : 0)

      return {
        id: s.id,
        name: s.company_name,
        currency: s.currency || 'TRY',
        currentBal,
        previousBal,
        diff,
        pct,
        periodPurchases,
        periodPayments
      }
    }).filter(s => Math.abs(s.currentBal) > 0.01 || Math.abs(s.previousBal) > 0.01)
      .sort((a, b) => b.currentBal - a.currentBal)
  }, [suppliers, supplierTxs, isRestricted, effectiveCompanyId, cariCutoffDate, isMatch, rates])

  const comparisonSummary = useMemo(() => {
    const totalCustCurr = customerComparisonList.reduce((acc, c) => acc + c.currentBal, 0)
    const totalCustPrev = customerComparisonList.reduce((acc, c) => acc + c.previousBal, 0)
    const custDiff = totalCustCurr - totalCustPrev
    const custPct = totalCustPrev !== 0 ? (custDiff / Math.abs(totalCustPrev)) * 100 : 0

    const totalSuppCurr = supplierComparisonList.reduce((acc, s) => acc + s.currentBal, 0)
    const totalSuppPrev = supplierComparisonList.reduce((acc, s) => acc + s.previousBal, 0)
    const suppDiff = totalSuppCurr - totalSuppPrev
    const suppPct = totalSuppPrev !== 0 ? (suppDiff / Math.abs(totalSuppPrev)) * 100 : 0

    return {
      cust: { current: totalCustCurr, previous: totalCustPrev, diff: custDiff, pct: custPct },
      supp: { current: totalSuppCurr, previous: totalSuppPrev, diff: suppDiff, pct: suppPct },
      netCurrent: totalCustCurr - totalSuppCurr,
      netPrevious: totalCustPrev - totalSuppPrev
    }
  }, [customerComparisonList, supplierComparisonList])

  const filteredCariList = useMemo(() => {
    const list = cariTab === 'receivables' ? customerComparisonList : supplierComparisonList
    if (!cariSearch) return list
    const q = cariSearch.toLowerCase()
    return list.filter(item => item.name.toLowerCase().includes(q))
  }, [cariTab, customerComparisonList, supplierComparisonList, cariSearch])

  // =====================================================================
  // --- SABİT GİDER TAKİBİ, AY SONU VADELERİ & GEÇMİŞ DÖNEM TESPİTİ ---
  // =====================================================================
  const currentMonthDate = useMemo(() => new Date(), [])
  const currentYearMonth = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`
  const currentMonthName = currentMonthDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
  const currentDay = currentMonthDate.getDate()

  const getEffectiveDueDay = (dueDay: number, date: Date = currentMonthDate): number => {
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    if (dueDay === 0 || !dueDay || dueDay > 31) {
      return lastDay
    }
    return Math.min(dueDay, lastDay)
  }

  // Bu ayın sabit giderleri durumu
  const currentMonthRecurringStatus = useMemo(() => {
    const matchedTemplates = recurringTemplates.filter(t => isMatch(t.company_id))

    return matchedTemplates.map(tmpl => {
      const matchedExpense = expenses.find(e => {
        const txD = e.tx_date || e.date || e.created_at?.substring(0, 10)
        if (!txD || !txD.startsWith(currentYearMonth)) return false
        if (e.description?.toLowerCase().includes(tmpl.title.toLowerCase())) return true
        if (e.company_id === tmpl.company_id && Math.abs(e.amount - tmpl.amount) < 0.01) return true
        return false
      })

      const isPaid = !!matchedExpense
      const effectiveDueDay = getEffectiveDueDay(tmpl.due_day, currentMonthDate)
      const diffDays = effectiveDueDay - currentDay
      const amountTRY = getTryEquivalent(tmpl.amount, tmpl.currency)

      return {
        template: tmpl,
        isPaid,
        matchedExpense,
        effectiveDueDay,
        diffDays,
        amountTRY
      }
    }).sort((a, b) => {
      if (a.isPaid && !b.isPaid) return 1
      if (!a.isPaid && b.isPaid) return -1
      return a.diffDays - b.diffDays
    })
  }, [recurringTemplates, expenses, currentYearMonth, currentDay, currentMonthDate, isMatch, rates])

  // Geçmiş aylardan ödenmemiş kalan sabit giderler (Backlog)
  const pastUnpaidRecurringList = useMemo(() => {
    const list: Array<{
      template: RecurringTemplate
      monthKey: string
      monthLabel: string
      amount: number
      currency: string
      amountTRY: number
      effectiveDueDay: number
      daysOverdue: number
    }> = []

    const matchedTemplates = recurringTemplates.filter(t => isMatch(t.company_id))
    const now = new Date()

    // Son 3 geçmiş ayı kontrol et (Ağustos, Temmuz, vb.)
    for (let i = 1; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const mLabel = d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
      const lastDayOfPastMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()

      matchedTemplates.forEach(tmpl => {
        // Eğer şablonda özel başlangıç ayı tanımlıysa ve mKey < start_month ise kontrol etme
        if (tmpl.start_month && mKey < tmpl.start_month) return

        // Eğer start_month yoksa, oluşturulma ayından öncesini atla
        const createdMonth = tmpl.created_at ? tmpl.created_at.substring(0, 7) : currentYearMonth
        if (!tmpl.start_month && mKey < createdMonth) return

        const isPaidInPastMonth = expenses.some(e => {
          const txD = e.tx_date || e.date || e.created_at?.substring(0, 10)
          if (!txD || !txD.startsWith(mKey)) return false
          if (e.description?.toLowerCase().includes(tmpl.title.toLowerCase())) return true
          if (e.company_id === tmpl.company_id && Math.abs(e.amount - tmpl.amount) < 0.01) return true
          return false
        })

        if (!isPaidInPastMonth) {
          const effDueDay = tmpl.due_day === 0 ? lastDayOfPastMonth : Math.min(tmpl.due_day, lastDayOfPastMonth)
          const pastDueDate = new Date(d.getFullYear(), d.getMonth(), effDueDay)
          const diffMs = now.getTime() - pastDueDate.getTime()
          const daysOverdue = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)))

          list.push({
            template: tmpl,
            monthKey: mKey,
            monthLabel: mLabel,
            amount: tmpl.amount,
            currency: tmpl.currency,
            amountTRY: getTryEquivalent(tmpl.amount, tmpl.currency),
            effectiveDueDay: effDueDay,
            daysOverdue
          })
        }
      })
    }

    return list
  }, [recurringTemplates, expenses, currentYearMonth, isMatch, rates])

  const recurringTotalBudget = currentMonthRecurringStatus.reduce((acc, r) => acc + r.amountTRY, 0)
  const recurringPaidTotal = currentMonthRecurringStatus.filter(r => r.isPaid).reduce((acc, r) => acc + r.amountTRY, 0)
  const recurringPendingTotal = recurringTotalBudget - recurringPaidTotal
  const recurringPaidCount = currentMonthRecurringStatus.filter(r => r.isPaid).length
  const recurringTotalCount = currentMonthRecurringStatus.length
  const pastUnpaidTotalTRY = pastUnpaidRecurringList.reduce((acc, p) => acc + p.amountTRY, 0)

  // Alt Alan: Son İşlemler Filtrelenmiş Liste
  const filteredRecentTransactions = useMemo(() => {
    return allTimelineItems.filter(tx => {
      const matchesModule = recentModuleFilter === 'all' || tx.module === recentModuleFilter
      const matchesSearch = !recentSearch || tx.description.toLowerCase().includes(recentSearch.toLowerCase())
      return matchesModule && matchesSearch
    }).slice(0, 40)
  }, [allTimelineItems, recentModuleFilter, recentSearch])

  return (
    <div className="space-y-4 pb-8 max-w-[1600px] mx-auto">
      
      <div style={{ animation: 'fadeInUp 0.4s both 0.05s' }} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-[#0d1322] border border-slate-800/80 px-4 py-3 rounded-xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-indigo-500/5 to-transparent pointer-events-none" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3 w-full md:w-auto">
          <div>
            <h1 className="text-base lg:text-lg font-black text-white flex items-center gap-2">
              <LayoutDashboard className="text-indigo-400" size={20} /> Finansal Genel Durum
            </h1>
          </div>
          <div className="h-4 w-px bg-slate-800 hidden md:block" />
          <div className="flex items-center gap-2 bg-[#070b14] border border-indigo-500/30 px-2.5 py-1.5 rounded-lg shadow-inner hover:border-indigo-500/60 transition-colors">
            <Filter size={13} className="text-indigo-400 shrink-0" />
            {(!isAdmin && profile?.allowed_companies && profile.allowed_companies.length === 1) ? (
              <span className="text-white text-xs font-bold px-1 flex items-center gap-1.5">
                <Building2 size={13} className="text-indigo-400" />
                {visibleCompanies[0]?.name || 'Bağlı Şirket'}
                <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/40 flex items-center gap-1">
                  <Lock size={9} /> Kilitli
                </span>
              </span>
            ) : (
              <select value={selectedCompanyId} onChange={(e) => setSelectedCompanyId(e.target.value)} className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer pr-2">
                {isAdmin && (
                  <>
                    <option value="all" className="bg-[#0f172a] text-white">🌍 Holding (Tüm Sistem Özeti)</option>
                    <option value="common" className="bg-[#0f172a] text-white">🌐 Ortak / Bağımsız Varlıklar</option>
                  </>
                )}
                {visibleCompanies.filter(c => !c.is_personal).length > 0 && (
                  <optgroup label="Ticari Şirketler" className="bg-[#070b14] text-slate-400 font-bold">
                    {visibleCompanies.filter(c => !c.is_personal).map(c => (
                      <option key={c.id} value={c.id} className="text-slate-200 font-medium">{c.name}</option>
                    ))}
                  </optgroup>
                )}
                {isAdmin && visibleCompanies.filter(c => c.is_personal).length > 0 && (
                  <optgroup label="Şahsi Merkezler" className="bg-[#070b14] text-slate-400 font-bold">
                    {visibleCompanies.filter(c => c.is_personal).map(c => (
                      <option key={c.id} value={c.id} className="text-slate-200 font-medium">{c.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 bg-[#070b14]/70 border border-slate-800/80 px-3.5 py-1.5 rounded-xl w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-1.5">
            <Sparkles size={13} className={netFinancialPosition >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">NET FİNANSAL DURUM</span>
          </div>
          <div className="font-mono flex items-baseline">
            <span className={`text-base lg:text-lg font-black ${netFinancialPosition >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{loading ? '...' : formatMoney(netFinancialPosition, 'TRY').integerPart}</span>
            <span className={`text-xs font-bold ${netFinancialPosition >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>{loading ? '' : `,${formatMoney(netFinancialPosition, 'TRY').decimalPart}₺`}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* SOL 2 KOLON: P&L VE PERFORMANS ANALİZİ */}
          <div style={{ animation: 'fadeInUp 0.5s both 0.15s' }} className="lg:col-span-2 bg-[#0d1322] border border-slate-800/80 rounded-xl p-4 shadow-xl relative overflow-hidden flex flex-col h-full min-h-[616px] justify-between">
            <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
            
            <div>
              <div className="flex justify-between items-center mb-3 shrink-0">
                <h3 className="text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                  <BarChart4 size={15} className="text-indigo-400" /> Kâr / Zarar (P&L) ve Performans Analizi
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">Son 6 Aylık Trend</span>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4 shrink-0">
                <div className="bg-[#070b14]/80 border border-slate-800/60 p-3 rounded-lg shadow-inner transition-transform hover:-translate-y-0.5">
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Bu Ayki Ciro</p>
                  <div className="text-sm font-black font-mono text-blue-400">{formatMoney(currData.revenue, 'TRY').formatted}</div>
                  <div className={`flex items-center gap-1 text-[9px] font-bold mt-1.5 ${revenueTrend.isUp ? 'text-emerald-400' : 'text-rose-400'}`}>{revenueTrend.isUp ? <ArrowUpRightFromSquare size={9}/> : <ArrowDownRightFromSquare size={9}/>} % {revenueTrend.percent.toFixed(1)} {revenueTrend.isUp ? 'Artış' : 'Düşüş'}</div>
                </div>
                <div className="bg-[#070b14]/80 border border-slate-800/60 p-3 rounded-lg shadow-inner transition-transform hover:-translate-y-0.5">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">SMM & Direkt Mlyt.</p>
                    <div className="text-sm font-black font-mono text-orange-400">{formatMoney(currData.cost, 'TRY').formatted}</div>
                </div>
                <div className="bg-[#070b14]/80 border border-slate-800/60 p-3 rounded-lg shadow-inner transition-transform hover:-translate-y-0.5">
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">İşletme Giderleri</p>
                    <div className="text-sm font-black font-mono text-purple-400">{formatMoney(currData.expense, 'TRY').formatted}</div>
                </div>
                
                {/* YENİ: MAĞAZA POS KARI KARTI */}
                <div className="bg-cyan-950/20 border border-cyan-500/30 p-3 rounded-lg shadow-inner transition-transform hover:-translate-y-0.5">
                    <p className="text-[9px] text-cyan-400/90 font-bold uppercase tracking-wider mb-0.5">Mağaza Kârı</p>
                    <div className="text-sm font-black font-mono text-cyan-400">{formatMoney(currPosProfit, 'TRY').formatted}</div>
                    <div className={`flex items-center gap-1 text-[9px] font-bold mt-1.5 ${posProfitTrend.isUp ? 'text-emerald-400' : 'text-rose-400'}`}>{posProfitTrend.isUp ? <ArrowUpRightFromSquare size={9}/> : <ArrowDownRightFromSquare size={9}/>} % {posProfitTrend.percent.toFixed(1)} {posProfitTrend.isUp ? 'Artış' : 'Düşüş'}</div>
                </div>

                <div className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-lg shadow-inner transition-transform hover:-translate-y-0.5">
                    <p className="text-[9px] text-emerald-400/90 font-bold uppercase tracking-wider mb-0.5">Net Ticari Kâr</p>
                    <div className={`text-sm font-black font-mono ${currData.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatMoney(currData.profit, 'TRY').formatted}</div>
                    <div className={`flex items-center gap-1 text-[9px] font-bold mt-1.5 ${profitTrend.isUp ? 'text-emerald-400' : 'text-rose-400'}`}>{profitTrend.isUp ? <ArrowUpRightFromSquare size={9}/> : <ArrowDownRightFromSquare size={9}/>} % {profitTrend.percent.toFixed(1)} {profitTrend.isUp ? 'Artış' : 'Düşüş'}</div>
                </div>
              </div>
            </div>

            {/* ORTA: 6 AYLIK ÇUBUK GRAFİĞİ */}
            <div className="pt-3 border-t border-slate-800/60 flex-1 flex items-end min-h-[160px] pb-2">
              <div className="flex items-end gap-2 h-full w-full">
                {last6MonthKeys.map((key) => {
                  const m = monthsData[key]
                  const totalOut = m.cost + m.expense
                  const revHeight = Math.max((m.revenue / maxChartValue) * 100, 2)
                  const outHeight = Math.max((totalOut / maxChartValue) * 100, 2)
                  return (
                    <div key={key} className="flex-1 flex flex-col justify-end items-center gap-1 group relative h-full">
                        <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#070b14] border border-slate-700 rounded-lg p-2 text-[10px] font-mono shadow-2xl z-20 w-36 pointer-events-none">
                          <div className="text-blue-400">Ciro: {formatMoney(m.revenue, 'TRY').formatted}</div>
                          <div className="text-orange-400 border-b border-slate-700/50 pb-1 mb-1">Maliyet/Gider: {formatMoney(totalOut, 'TRY').formatted}</div>
                          <div className={m.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>Net: {formatMoney(m.profit, 'TRY').formatted}</div>
                        </div>
                        <div className="w-full flex justify-center gap-1.5 items-end h-full relative">
                          <div className="w-1/3 max-w-[24px] bg-blue-500 rounded-t transition-all duration-1000 ease-out shadow-sm" style={{ height: `${revHeight}%` }} />
                          <div className="w-1/3 max-w-[24px] bg-orange-500 rounded-t transition-all duration-1000 ease-out delay-100 shadow-sm" style={{ height: `${outHeight}%` }} />
                        </div>
                        <div className="text-[9px] text-slate-500 font-bold mt-1.5 text-center truncate w-full shrink-0 group-hover:text-slate-300 transition-colors">{m.monthLabel}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ALT: SON 6 AYIN PERFORMANS DAĞILIM TABLOSU */}
            <div className="pt-2.5 border-t border-slate-800/80 shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText size={12} className="text-indigo-400" /> 6 Aylık Finansal Özet Tablosu
                </span>
                <span className="text-[9px] text-slate-500 font-mono">Ciro • Net Kâr • Kâr Marjı</span>
              </div>
              <div className="grid grid-cols-6 gap-1.5 text-center font-mono">
                {last6MonthKeys.map((key) => {
                  const m = monthsData[key]
                  const marginPct = m.revenue > 0 ? ((m.profit / m.revenue) * 100) : 0
                  const isCurrent = key === currentMonthKey
                  return (
                    <div key={key} className={`p-1.5 rounded-lg border transition-colors ${isCurrent ? 'bg-indigo-950/20 border-indigo-500/40' : 'bg-[#070b14]/70 border-slate-800/70'}`}>
                      <span className={`text-[8px] font-sans font-bold block truncate ${isCurrent ? 'text-indigo-300' : 'text-slate-400'}`}>{m.monthLabel}</span>
                      <span className="text-[9px] font-bold text-blue-400 block mt-0.5 truncate">{formatMoney(m.revenue, 'TRY').formatted}</span>
                      <span className={`text-[9px] font-bold block mt-0.5 truncate ${m.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {m.profit >= 0 ? '+' : ''}{formatMoney(m.profit, 'TRY').formatted}
                      </span>
                      <span className={`text-[8px] block mt-0.5 font-sans ${marginPct >= 0 ? 'text-emerald-400/90' : 'text-rose-400/90'}`}>
                        %{marginPct.toFixed(0)} Marj
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* SAĞ KOLON: 1. YAKLAŞAN VE AY SONU VADELERİ + 2. CARİ BORÇ & ALACAK KIYASLAMA */}
          <div className="flex flex-col gap-4 lg:col-span-1">
             
             {/* 1. YAKLAŞAN VE AY SONU VADELERİ (SABİT GİDER TAKİBİ) */}
             <div style={{ animation: 'fadeInUp 0.5s both 0.25s' }} className="bg-[#0d1322] border border-slate-800/80 rounded-xl shadow-xl overflow-hidden flex flex-col h-[270px]">
                {/* Kart Başlığı & Ay Bilgisi */}
                <div className="p-2.5 bg-[#0a0f1d] border-b border-slate-800/80 flex items-center justify-between shrink-0">
                   <div className="flex items-center gap-1.5 min-w-0">
                     <Clock size={14} className="text-amber-400 shrink-0" />
                     <h3 className="text-white font-bold text-xs uppercase tracking-wider truncate">
                       Yaklaşan ve Ay Sonu Vadeleri
                     </h3>
                   </div>
                   <div className="flex items-center gap-1.5 shrink-0">
                     <span className="text-[9px] text-slate-400 font-mono capitalize">{currentMonthName}</span>
                     <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                       recurringPaidCount === recurringTotalCount && recurringTotalCount > 0
                         ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                         : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                     }`}>
                       {recurringPaidCount}/{recurringTotalCount} Ödendi
                     </span>
                   </div>
                </div>

                {/* Mini Bütçe & Kalan Şeridi */}
                <div className="px-3 py-1.5 bg-[#070b14]/70 border-b border-slate-800/60 flex items-center justify-between text-[9px] shrink-0 font-mono">
                  <div>
                    <span className="text-slate-500 block font-sans text-[8px] uppercase tracking-wider">Kalan Sabit Borç</span>
                    <span className="text-xs font-black text-amber-400">{formatMoney(recurringPendingTotal, 'TRY').formatted}</span>
                  </div>
                  <div className="text-right">
                    <Link href="/expenses" className="text-indigo-400 hover:text-indigo-300 font-sans font-bold flex items-center gap-1 hover:underline">
                      Tümünü Yönet <ArrowUpRight size={11} />
                    </Link>
                  </div>
                </div>

                {/* Geçmiş Aylardan Ödenmemiş Uyarısı (Varsa) */}
                {pastUnpaidRecurringList.length > 0 && (
                  <div className="px-2.5 py-1 bg-rose-950/30 border-b border-rose-500/30 flex items-center justify-between text-[9px] shrink-0">
                    <span className="text-rose-400 font-bold flex items-center gap-1 truncate">
                      <AlertTriangle size={11} className="shrink-0 animate-pulse" />
                      Geçmişten {pastUnpaidRecurringList.length} ödenmemiş borç!
                    </span>
                    <Link href="/expenses" className="text-rose-300 hover:text-white font-mono font-bold underline shrink-0">
                      +{formatMoney(pastUnpaidTotalTRY, 'TRY').formatted}
                    </Link>
                  </div>
                )}

                {/* Vadeler Listesi */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
                  {/* Geçmiş dönemden sarkanlar varsa en tepede kırmızı uyarıyla listelenir */}
                  {pastUnpaidRecurringList.map((p) => {
                    const comp = companies.find(c => c.id === p.template.company_id)
                    return (
                      <div
                        key={`past_${p.template.id}_${p.monthKey}`}
                        className="flex justify-between items-center p-1.5 rounded-lg bg-rose-950/20 border border-rose-500/40 hover:border-rose-500 transition-colors"
                      >
                        <div className="flex items-start gap-1.5 min-w-0 pr-2">
                          <div className="p-1 rounded bg-rose-500/10 text-rose-400 shrink-0">
                            <AlertTriangle size={11} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold text-slate-200 truncate">{p.template.title}</span>
                              <span className="text-[8px] bg-rose-500/20 text-rose-300 px-1 rounded font-bold shrink-0">
                                {p.monthLabel}
                              </span>
                            </div>
                            <div className="text-[8px] text-rose-400 font-mono">
                              {p.daysOverdue} gün gecikti • {comp?.name || 'Merkez'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[10px] font-mono font-bold text-rose-400">
                            {formatMoney(p.amount, p.currency).formatted}
                          </div>
                          <Link
                            href="/expenses"
                            className="text-[8px] text-indigo-400 hover:text-indigo-300 font-bold block hover:underline"
                          >
                            Hızlı Öde →
                          </Link>
                        </div>
                      </div>
                    )
                  })}

                  {/* Bu ayın vadeleri */}
                  {currentMonthRecurringStatus.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-4 border border-dashed border-slate-700/60 rounded-xl bg-slate-800/10 text-slate-500 shadow-inner m-1">
                      <Clock size={20} className="mb-2 opacity-70 text-amber-400 animate-bounce" />
                      <span className="text-[10px] font-bold text-slate-400">Tanımlı Sabit Gider Yok</span>
                      <Link href="/expenses" className="text-[9px] text-indigo-400 hover:underline mt-1 font-bold">
                        Genel Giderlerden Şablon Ekle →
                      </Link>
                    </div>
                  ) : (
                    currentMonthRecurringStatus.map((item, idx) => {
                      const comp = companies.find(c => c.id === item.template.company_id)
                      let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700'
                      let badgeText = `${item.diffDays} gün kaldı`

                      if (item.isPaid) {
                        badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        badgeText = `Ödendi (${formatDateTR(item.matchedExpense?.tx_date || '')})`
                      } else if (item.diffDays < 0) {
                        badgeColor = 'bg-rose-500/15 text-rose-400 border-rose-500/30 font-bold'
                        badgeText = `${Math.abs(item.diffDays)} gün gecikti!`
                      } else if (item.diffDays === 0) {
                        badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse font-bold'
                        badgeText = 'Bugün son gün!'
                      } else if (item.template.due_day === 0) {
                        badgeColor = 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                        badgeText = `Ay Sonu (${item.effectiveDueDay}. gün)`
                      } else {
                        badgeText = `Ayın ${item.effectiveDueDay}'i (${item.diffDays} gün)`
                      }

                      return (
                        <div
                          key={item.template.id}
                          style={{ animation: 'fadeSlideRight 0.3s both', animationDelay: `${0.1 + (idx * 0.03)}s` }}
                          className={`flex justify-between items-center p-1.5 rounded-lg border transition-colors ${
                            item.isPaid
                              ? 'bg-[#070b14]/50 border-slate-800/40 opacity-70'
                              : item.diffDays < 0
                              ? 'bg-rose-950/10 border-rose-500/30 hover:border-rose-500/50'
                              : 'bg-[#070b14] border-slate-800/60 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-start gap-1.5 min-w-0 pr-2">
                            <div className={`p-1 rounded shrink-0 ${
                              item.isPaid ? 'bg-emerald-500/10 text-emerald-400' : item.diffDays < 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800/50 text-slate-400'
                            }`}>
                              {item.isPaid ? <CheckCircle2 size={11} /> : <Calendar size={11} />}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] font-bold truncate ${item.isPaid ? 'line-through text-slate-400' : 'text-slate-200'}`}>
                                  {item.template.title}
                                </span>
                                <span className={`text-[8px] px-1 py-0.2 rounded border font-mono shrink-0 ${badgeColor}`}>
                                  {badgeText}
                                </span>
                              </div>
                              <div className="text-[8px] text-slate-500 font-sans truncate">
                                {comp?.name || 'Merkez'}
                                {item.template.note ? ` • ${item.template.note}` : ''}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`text-[10px] font-mono font-bold ${item.isPaid ? 'text-slate-500' : 'text-slate-200'}`}>
                              {formatMoney(item.template.amount, item.template.currency).formatted}
                            </div>
                            {!item.isPaid && (
                              <Link
                                href="/expenses"
                                className="text-[8px] text-indigo-400 hover:text-indigo-300 font-bold block hover:underline"
                              >
                                Öde →
                              </Link>
                            )}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
             </div>

             {/* 2. CARİ BORÇ & ALACAK DAĞILIMI VE GEÇMİŞ DÖNEM KIYASLAMASI (ÖNERİ 2) */}
             <div style={{ animation: 'fadeInUp 0.5s both 0.3s' }} className="bg-[#0d1322] border border-slate-800/80 rounded-xl shadow-xl overflow-hidden flex flex-col h-[330px]">
                {/* Kart Üst Başlık & Sekmeler */}
                <div className="p-2.5 bg-[#0a0f1d] border-b border-slate-800/80 flex flex-col gap-2 shrink-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Scale size={14} className="text-indigo-400" />
                      Cari Borç & Alacak Kıyas
                    </h3>

                    {/* Kıyaslama Periyodu Seçici */}
                    <div className="flex items-center bg-[#070b14] border border-slate-800 rounded p-0.5 text-[9px] font-bold">
                      <button
                        onClick={() => setCariPeriod('month')}
                        className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${cariPeriod === 'month' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
                      >
                        Geçen Ay
                      </button>
                      <button
                        onClick={() => setCariPeriod('30days')}
                        className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${cariPeriod === '30days' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
                      >
                        30 Gün
                      </button>
                    </div>
                  </div>

                  {/* Sekmeler: Alacaklar vs. Borçlar */}
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] font-bold">
                    <button
                      onClick={() => setCariTab('receivables')}
                      className={`py-1 px-2 rounded-lg border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        cariTab === 'receivables'
                          ? 'bg-blue-500/15 border-blue-500/40 text-blue-400 shadow-xs'
                          : 'bg-[#070b14] border-slate-800/80 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <Users size={11} />
                      <span>Alacaklar ({customerComparisonList.length})</span>
                    </button>

                    <button
                      onClick={() => setCariTab('payables')}
                      className={`py-1 px-2 rounded-lg border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        cariTab === 'payables'
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-xs'
                          : 'bg-[#070b14] border-slate-800/80 text-slate-400 hover:text-white hover:border-slate-700'
                      }`}
                    >
                      <Building2 size={11} />
                      <span>Borçlar ({supplierComparisonList.length})</span>
                    </button>
                  </div>
                </div>

                {/* Mini KPI Özet Şeridi */}
                <div className="px-3 py-1.5 bg-[#070b14]/70 border-b border-slate-800/60 flex items-center justify-between text-[9px] shrink-0 font-mono">
                  <div>
                    <span className="text-slate-400 block font-sans text-[8px] uppercase tracking-wider">
                      {cariTab === 'receivables' ? 'Toplam Açık Alacak' : 'Toplam Açık Borç'}
                    </span>
                    <span className={`text-xs font-black ${cariTab === 'receivables' ? 'text-blue-400' : 'text-amber-400'}`}>
                      {formatMoney(cariTab === 'receivables' ? comparisonSummary.cust.current : comparisonSummary.supp.current, 'TRY').formatted}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-slate-400 block font-sans text-[8px] uppercase tracking-wider">
                      {cariPeriod === 'month' ? 'Geçen Aya Göre' : 'Son 30 Güne Göre'}
                    </span>
                    {cariTab === 'receivables' ? (
                      <span className={`font-bold flex items-center justify-end gap-0.5 ${
                        comparisonSummary.cust.diff >= 0 ? 'text-blue-400' : 'text-emerald-400'
                      }`}>
                        {comparisonSummary.cust.diff >= 0 ? '+' : ''}{formatMoney(comparisonSummary.cust.diff, 'TRY').formatted}
                        <span className="text-[8px] opacity-80">({comparisonSummary.cust.diff >= 0 ? '▲' : '▼'} %{Math.abs(comparisonSummary.cust.pct).toFixed(1)})</span>
                      </span>
                    ) : (
                      <span className={`font-bold flex items-center justify-end gap-0.5 ${
                        comparisonSummary.supp.diff <= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {comparisonSummary.supp.diff >= 0 ? '+' : ''}{formatMoney(comparisonSummary.supp.diff, 'TRY').formatted}
                        <span className="text-[8px] opacity-80">({comparisonSummary.supp.diff <= 0 ? '▼ Ödendi' : '▲ Artış'})</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Arama Input'u */}
                <div className="px-2 pt-1.5 pb-1 bg-[#0d1322] shrink-0">
                  <div className="relative">
                    <Search size={11} className="absolute left-2 top-2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Cari ara..."
                      value={cariSearch}
                      onChange={(e) => setCariSearch(e.target.value)}
                      className="w-full bg-[#070b14] border border-slate-800/80 text-white text-[10px] pl-6 pr-6 py-1 rounded focus:outline-none focus:border-indigo-500/50"
                    />
                    {cariSearch && (
                      <button onClick={() => setCariSearch('')} className="absolute right-1.5 top-1.5 text-slate-500 hover:text-white cursor-pointer">
                        <X size={11} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Cariler Listesi (Scrollable) */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
                  {filteredCariList.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-4 border border-dashed border-slate-800 rounded-lg bg-slate-900/20 text-slate-500 text-center">
                      <span className="text-[10px] font-bold text-slate-400">Kayıt Bulunamadı</span>
                      <span className="text-[8px] text-slate-500 mt-0.5">Bu kriterlere uygun açık bakiye yok.</span>
                    </div>
                  ) : (
                    filteredCariList.map((item, idx) => {
                      const maxBal = Math.max(...filteredCariList.map(i => Math.abs(i.currentBal)), 1)
                      const barPct = Math.min(100, Math.max(8, (Math.abs(item.currentBal) / maxBal) * 100))

                      return (
                        <div
                          key={item.id}
                          style={{ animation: 'fadeSlideRight 0.3s both', animationDelay: `${0.05 + idx * 0.03}s` }}
                          className="p-2 rounded-lg bg-[#070b14] border border-slate-800/60 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-bold text-slate-200 truncate" title={item.name}>
                                {item.name}
                              </div>
                              <div className="text-[8px] text-slate-400 font-mono mt-0.5">
                                Önceki: <span className="text-slate-300 font-bold">{formatMoney(item.previousBal, 'TRY').formatted}</span>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className={`text-[11px] font-mono font-bold ${
                                cariTab === 'receivables' ? 'text-blue-400' : 'text-amber-400'
                              }`}>
                                {formatMoney(item.currentBal, 'TRY').formatted}
                              </div>

                              <div className="text-[8px] font-mono mt-0.5 flex items-center justify-end gap-1">
                                {item.diff === 0 ? (
                                  <span className="text-slate-400 font-medium">Değişmedi</span>
                                ) : cariTab === 'receivables' ? (
                                  item.diff > 0 ? (
                                    <span className="text-blue-400 font-bold">
                                      +{formatMoney(item.diff, 'TRY').formatted} (▲ %{Math.abs(item.pct).toFixed(0)})
                                    </span>
                                  ) : (
                                    <span className="text-emerald-400 font-bold">
                                      {formatMoney(item.diff, 'TRY').formatted} (▼ Tahsilat)
                                    </span>
                                  )
                                ) : (
                                  item.diff < 0 ? (
                                    <span className="text-emerald-400 font-bold">
                                      {formatMoney(item.diff, 'TRY').formatted} (▼ Ödendi)
                                    </span>
                                  ) : (
                                    <span className="text-rose-400 font-bold">
                                      +{formatMoney(item.diff, 'TRY').formatted} (▲ Artış)
                                    </span>
                                  )
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Hacim Barı */}
                          <div className="w-full h-1 bg-slate-800/80 rounded-full overflow-hidden mt-1.5">
                            <div
                              style={{ width: `${barPct}%` }}
                              className={`h-full rounded-full ${
                                cariTab === 'receivables' ? 'bg-blue-500' : 'bg-amber-500'
                              }`}
                            />
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
             </div>
          </div>
      </div>

      {/* ANA ÖZET KUTUCUKLARI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-start">
        
        {/* Banka */}
        <div style={{ animation: 'fadeInUp 0.5s both 0.3s' }} onClick={() => toggleSection('bank')} className={`bg-[#0d1322] border rounded-xl p-3.5 shadow-md cursor-pointer transition-all hover:border-indigo-500/60 hover:-translate-y-0.5 ${openSections.bank ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-800/80'}`}>
          <div className="flex justify-between items-start">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">TOPLAM BANKA</span>
            <div className="flex items-center gap-1.5"><div className="p-1 bg-indigo-500/10 text-indigo-400 rounded-md"><Landmark size={14} /></div>{openSections.bank ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}</div>
          </div>
          <div className="my-2 font-mono flex items-baseline">
            <span className="text-xl font-black text-emerald-400">{loading ? '...' : formatMoney(totalBankTry, 'TRY').integerPart}</span>
            <span className="text-xs font-bold text-emerald-400/80">{loading ? '' : `,${formatMoney(totalBankTry, 'TRY').decimalPart}₺`}</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium flex justify-between items-center"><span>Aktif bankalar</span><span className="text-indigo-400 text-[10px]">({filteredBanks.length})</span></div>
          {openSections.bank && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-800 space-y-1 text-xs animate-in fade-in slide-in-from-top-2 duration-200" onClick={(e) => e.stopPropagation()}>
              {filteredBanks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-4 border border-dashed border-slate-700/60 rounded-lg bg-slate-800/10 text-slate-500 shadow-inner mt-2 mb-1">
                  <Landmark size={20} className="mb-2 opacity-70 text-indigo-400 animate-bounce" />
                  <p className="text-[9px] font-bold text-slate-400">Banka kaydı yok.</p>
                </div>
              ) : filteredBanks.map(b => (
                  <div key={b.id} className="py-1 flex justify-between items-center font-mono border-b border-slate-800/50 last:border-0"><span className="text-slate-300 font-sans font-medium truncate pr-2">{b.bank_name}</span><span className={`font-bold shrink-0 ${b.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatMoney(b.balance, b.currency).formatted}</span></div>
              ))}
            </div>
          )}
        </div>

        {/* Kasa */}
        <div style={{ animation: 'fadeInUp 0.5s both 0.35s' }} onClick={() => toggleSection('cash')} className={`bg-[#0d1322] border rounded-xl p-3.5 shadow-md cursor-pointer transition-all hover:border-emerald-500/60 hover:-translate-y-0.5 ${openSections.cash ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-800/80'}`}>
          <div className="flex justify-between items-start">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">NAKİT KASALAR</span>
            <div className="flex items-center gap-1.5"><div className="p-1 bg-emerald-500/10 text-emerald-400 rounded-md"><Wallet size={14} /></div>{openSections.cash ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}</div>
          </div>
          <div className="my-2 font-mono flex items-baseline">
            <span className="text-xl font-black text-emerald-400">{loading ? '...' : formatMoney(totalCashTry, 'TRY').integerPart}</span>
            <span className="text-xs font-bold text-emerald-400/80">{loading ? '' : `,${formatMoney(totalCashTry, 'TRY').decimalPart}₺`}</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium flex justify-between items-center"><span>Nakit kasalar</span><span className="text-emerald-400 text-[10px]">({filteredCashes.length})</span></div>
          {openSections.cash && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-800 space-y-1 text-xs animate-in fade-in slide-in-from-top-2 duration-200" onClick={(e) => e.stopPropagation()}>
              {filteredCashes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-4 border border-dashed border-slate-700/60 rounded-lg bg-slate-800/10 text-slate-500 shadow-inner mt-2 mb-1">
                  <Wallet size={20} className="mb-2 opacity-70 text-emerald-400 animate-bounce" />
                  <p className="text-[9px] font-bold text-slate-400">Kasa kaydı yok.</p>
                </div>
              ) : filteredCashes.map(cs => (
                  <div key={cs.id} className="py-1 flex justify-between items-center font-mono border-b border-slate-800/50 last:border-0"><span className="text-slate-300 font-sans font-medium truncate pr-2">{cs.name}</span><span className={`font-bold shrink-0 ${cs.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatMoney(cs.balance, cs.currency).formatted}</span></div>
              ))}
            </div>
          )}
        </div>

        {/* Müşteri */}
        <div style={{ animation: 'fadeInUp 0.5s both 0.4s' }} onClick={() => toggleSection('customer')} className={`bg-[#0d1322] border rounded-xl p-3.5 shadow-md cursor-pointer transition-all hover:border-blue-500/60 hover:-translate-y-0.5 ${openSections.customer ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-800/80'}`}>
          <div className="flex justify-between items-start mb-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">MÜŞTERİ ALACAKLARI</span>
            <div className="flex items-center gap-1.5"><div className="p-1 bg-blue-500/10 text-blue-400 rounded-md"><ArrowUpRight size={14} /></div>{openSections.customer ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}</div>
          </div>
          <div className="flex flex-col gap-0 z-10 font-mono mt-1 mb-0">
            <div className="flex items-baseline">
              <span className="text-xl font-black text-blue-400">{loading ? '...' : formatMoney(totalCustomerTry, 'TRY').integerPart}</span>
              <span className="text-xs font-bold text-blue-400/80">{loading ? '' : `,${formatMoney(totalCustomerTry, 'TRY').decimalPart}₺`}</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 font-medium flex justify-between items-center mt-1.5"><span>Cariler</span><span className="text-blue-400 text-[10px]">({activeCustomers.length})</span></div>
          {openSections.customer && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-800 space-y-1 text-xs animate-in fade-in slide-in-from-top-2 duration-200" onClick={(e) => e.stopPropagation()}>
              {activeCustomers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-4 border border-dashed border-slate-700/60 rounded-lg bg-slate-800/10 text-slate-500 shadow-inner mt-2 mb-1">
                  <ArrowUpRight size={20} className="mb-2 opacity-70 text-blue-400 animate-bounce" />
                  <p className="text-[9px] font-bold text-slate-400">Aktif alacak yok.</p>
                </div>
              ) : activeCustomers.map(cust => {
                  const tryVal = getTryEquivalent(Number(cust.balance || 0), cust.currency || 'TRY')
                  return (
                    <div key={cust.id} className="py-1 flex justify-between items-center font-mono border-b border-slate-800/50 last:border-0">
                      <span className="text-slate-300 font-sans font-medium truncate pr-2 flex items-center gap-1.5">
                        {cust.name}
                        {cust.currency && cust.currency !== 'TRY' && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {formatMoney(cust.balance, (cust.currency as any) || 'TRY').formatted}
                          </span>
                        )}
                      </span>
                      <span className={`font-bold shrink-0 ${tryVal > 0 ? 'text-blue-400' : 'text-rose-400'}`}>{formatMoney(tryVal, 'TRY').formatted}</span>
                    </div>
                  )
              })}
            </div>
          )}
        </div>

        {/* STOK / DEPO */}
        <div style={{ animation: 'fadeInUp 0.5s both 0.45s' }} onClick={() => toggleSection('stock')} className={`bg-[#0d1322] border rounded-xl p-3.5 shadow-md cursor-pointer transition-all hover:border-teal-500/60 hover:-translate-y-0.5 ${openSections.stock ? 'border-teal-500 ring-1 ring-teal-500' : 'border-slate-800/80'}`}>
          <div className="flex justify-between items-start mb-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">TOPLAM DEPO / STOK</span>
            <div className="flex items-center gap-1.5"><div className="p-1 bg-teal-500/10 text-teal-400 rounded-md"><Package size={14} /></div>{openSections.stock ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}</div>
          </div>
          <div className="flex flex-col gap-0 z-10 font-mono mt-1 mb-0">
            <div className="flex items-baseline">
              <span className="text-xl font-black text-teal-400">{loading ? '...' : formatMoney(totalStockTry, 'TRY').integerPart}</span>
              <span className="text-xs font-bold text-teal-400/80">{loading ? '' : `,${formatMoney(totalStockTry, 'TRY').decimalPart}₺`}</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 font-medium flex justify-between items-center mt-1.5"><span>Aktif depolar</span><span className="text-teal-400 text-[10px]">({filteredWarehouses.length})</span></div>
          {openSections.stock && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-800 space-y-1 text-xs animate-in fade-in slide-in-from-top-2 duration-200" onClick={(e) => e.stopPropagation()}>
              {warehouseTotals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-4 border border-dashed border-slate-700/60 rounded-lg bg-slate-800/10 text-slate-500 shadow-inner mt-2 mb-1">
                  <Package size={20} className="mb-2 opacity-70 text-teal-400 animate-bounce" />
                  <p className="text-[9px] font-bold text-slate-400">Aktif depo yok.</p>
                </div>
              ) : warehouseTotals.map(w => (
                  <div key={w.id} className="py-1 flex justify-between items-center font-mono border-b border-slate-800/50 last:border-0"><span className="text-slate-300 font-sans font-medium truncate pr-2">{w.name}</span><span className={`font-bold shrink-0 text-teal-400`}>{formatMoney(w.totalValue, 'TRY').formatted}</span></div>
              ))}
            </div>
          )}
        </div>

        {/* Kredi Kartı */}
        <div style={{ animation: 'fadeInUp 0.5s both 0.5s' }} onClick={() => toggleSection('card')} className={`bg-[#0d1322] border rounded-xl p-3.5 shadow-md cursor-pointer transition-all hover:border-rose-500/60 hover:-translate-y-0.5 ${openSections.card ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800/80'}`}>
          <div className="flex justify-between items-start">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">KREDİ KARTLARI BORÇ</span>
            <div className="flex items-center gap-1.5"><div className="p-1 bg-rose-500/10 text-rose-400 rounded-md"><CreditCard size={14} /></div>{openSections.card ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}</div>
          </div>
          <div className="my-2 font-mono flex items-baseline">
            <span className="text-xl font-black text-rose-400">{loading ? '...' : formatMoney(totalCreditTry, 'TRY').integerPart}</span>
            <span className="text-xs font-bold text-rose-400/80">{loading ? '' : `,${formatMoney(totalCreditTry, 'TRY').decimalPart}₺`}</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium flex justify-between items-center"><span>Kart ekstreleri</span><span className="text-rose-400 text-[10px]">({filteredCards.length})</span></div>
          {openSections.card && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-800 space-y-1 text-xs animate-in fade-in slide-in-from-top-2 duration-200" onClick={(e) => e.stopPropagation()}>
              {filteredCards.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-4 border border-dashed border-slate-700/60 rounded-lg bg-slate-800/10 text-slate-500 shadow-inner mt-2 mb-1">
                  <CreditCard size={20} className="mb-2 opacity-70 text-rose-400 animate-bounce" />
                  <p className="text-[9px] font-bold text-slate-400">Kart kaydı yok.</p>
                </div>
              ) : filteredCards.map(c => (
                  <div key={c.id} className="py-1 flex justify-between items-center font-mono border-b border-slate-800/50 last:border-0"><span className="text-slate-300 font-sans font-medium truncate pr-2">{c.name}</span><span className="font-bold text-rose-400 shrink-0">{formatMoney(c.current_debt, 'TRY').formatted}</span></div>
              ))}
            </div>
          )}
        </div>

        {/* Tedarikçi */}
        <div style={{ animation: 'fadeInUp 0.5s both 0.55s' }} onClick={() => toggleSection('supplier')} className={`bg-[#0d1322] border rounded-xl p-3.5 shadow-md cursor-pointer transition-all hover:border-amber-500/60 hover:-translate-y-0.5 ${openSections.supplier ? 'border-amber-500 ring-1 ring-amber-500' : 'border-slate-800/80'}`}>
          <div className="flex justify-between items-start mb-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">TEDARİKÇİ BORÇLARI</span>
            <div className="flex items-center gap-1.5"><div className="p-1 bg-amber-500/10 text-amber-400 rounded-md"><ArrowDownLeft size={14} /></div>{openSections.supplier ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}</div>
          </div>
          <div className="flex flex-col gap-0 z-10 font-mono mt-1 mb-0">
            <div className="flex items-baseline">
              <span className="text-xl font-black text-amber-400">{loading ? '...' : formatMoney(totalSupplierTry, 'TRY').integerPart}</span>
              <span className="text-xs font-bold text-amber-400/80">{loading ? '' : `,${formatMoney(totalSupplierTry, 'TRY').decimalPart}₺`}</span>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 font-medium flex justify-between items-center mt-1.5"><span>Tedarikçiler</span><span className="text-amber-400 text-[10px]">({activeSuppliers.length})</span></div>
          {openSections.supplier && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-800 space-y-1 text-xs animate-in fade-in slide-in-from-top-2 duration-200" onClick={(e) => e.stopPropagation()}>
              {activeSuppliers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-4 border border-dashed border-slate-700/60 rounded-lg bg-slate-800/10 text-slate-500 shadow-inner mt-2 mb-1">
                  <ArrowDownLeft size={20} className="mb-2 opacity-70 text-amber-400 animate-bounce" />
                  <p className="text-[9px] font-bold text-slate-400">Aktif borç yok.</p>
                </div>
              ) : activeSuppliers.map(sup => {
                  const tryVal = getTryEquivalent(Number(sup.balance || 0), sup.currency || 'TRY')
                  return (
                    <div key={sup.id} className="py-1 flex justify-between items-center font-mono border-b border-slate-800/50 last:border-0">
                      <span className="text-slate-300 font-sans font-medium truncate pr-2 flex items-center gap-1.5">
                        {sup.company_name}
                        {sup.currency && sup.currency !== 'TRY' && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {formatMoney(sup.balance, (sup.currency as any) || 'TRY').formatted}
                          </span>
                        )}
                      </span>
                      <span className="font-bold text-amber-400 shrink-0">{formatMoney(tryVal, 'TRY').formatted}</span>
                    </div>
                  )
              })}
            </div>
          )}
        </div>

        {/* TİCARİ GİDERLER */}
        <div style={{ animation: 'fadeInUp 0.5s both 0.6s' }} onClick={() => toggleSection('comm')} className={`bg-[#0d1322] border rounded-xl p-3.5 shadow-md cursor-pointer transition-all hover:border-purple-500/60 hover:-translate-y-0.5 ${openSections.comm ? 'border-purple-500 ring-1 ring-purple-500' : 'border-slate-800/80'}`}>
          <div className="flex justify-between items-start mb-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">TİCARİ GİDERLER</span>
            <div className="flex items-center gap-1.5"><div className="p-1 bg-purple-500/10 text-purple-400 rounded-md"><Building size={14} /></div>{openSections.comm ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}</div>
          </div>
          <div className="my-2 font-mono flex items-baseline">
            <span className="text-xl font-black text-purple-400">{loading ? '...' : formatMoney(totalCommExpTry, 'TRY').integerPart}</span>
            <span className="text-xs font-bold text-purple-400/80">{loading ? '' : `,${formatMoney(totalCommExpTry, 'TRY').decimalPart}₺`}</span>
          </div>
          <div className="text-[10px] text-slate-500 font-medium flex justify-between items-center"><span>Şirket Bazlı (Tüm Zamanlar)</span></div>
          {openSections.comm && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-800 space-y-1 text-xs animate-in fade-in slide-in-from-top-2 duration-200" onClick={(e) => e.stopPropagation()}>
              {commExpBreakdown.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-4 border border-dashed border-slate-700/60 rounded-lg bg-slate-800/10 text-slate-500 shadow-inner mt-2 mb-1">
                  <Building size={20} className="mb-2 opacity-70 text-purple-400 animate-bounce" />
                  <p className="text-[9px] font-bold text-slate-400">Gider kaydı yok.</p>
                </div>
              ) : commExpBreakdown.map(c => (
                  <div key={c.id} className="py-1 flex justify-between items-center font-mono border-b border-slate-800/50 last:border-0"><span className="text-slate-300 font-sans font-medium truncate pr-2">{c.name}</span><span className="font-bold shrink-0 text-purple-400">{formatMoney(c.total, 'TRY').formatted}</span></div>
              ))}
            </div>
          )}
        </div>

        {/* ŞAHSİ GİDERLER (Yalnızca Yönetici Görür) */}
        {isAdmin && (
          <div style={{ animation: 'fadeInUp 0.5s both 0.65s' }} onClick={() => toggleSection('pers')} className={`bg-[#0d1322] border rounded-xl p-3.5 shadow-md cursor-pointer transition-all hover:border-slate-400/60 hover:-translate-y-0.5 ${openSections.pers ? 'border-slate-500 ring-1 ring-slate-500' : 'border-slate-800/80'}`}>
            <div className="flex justify-between items-start mb-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">ŞAHSİ GİDERLER</span>
              <div className="flex items-center gap-1.5"><div className="p-1 bg-slate-500/10 text-slate-300 rounded-md"><HomeIcon size={14} /></div>{openSections.pers ? <ChevronUp size={13} className="text-slate-400" /> : <ChevronDown size={13} className="text-slate-400" />}</div>
            </div>
            <div className="my-2 font-mono flex items-baseline">
              <span className="text-xl font-black text-slate-300">{loading ? '...' : formatMoney(totalPersExpTry, 'TRY').integerPart}</span>
              <span className="text-xs font-bold text-slate-300/80">{loading ? '' : `,${formatMoney(totalPersExpTry, 'TRY').decimalPart}₺`}</span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium flex justify-between items-center"><span>Kategori Bazlı (Tüm Zamanlar)</span></div>
            {openSections.pers && (
              <div className="mt-2.5 pt-2.5 border-t border-slate-800 space-y-1 text-xs animate-in fade-in slide-in-from-top-2 duration-200" onClick={(e) => e.stopPropagation()}>
                {persExpBreakdown.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-4 border border-dashed border-slate-700/60 rounded-lg bg-slate-800/10 text-slate-500 shadow-inner mt-2 mb-1">
                    <HomeIcon size={20} className="mb-2 opacity-70 text-slate-400 animate-bounce" />
                    <p className="text-[9px] font-bold text-slate-400">Gider kaydı yok.</p>
                  </div>
                ) : persExpBreakdown.map(c => (
                    <div key={c.id} className="py-1 flex justify-between items-center font-mono border-b border-slate-800/50 last:border-0"><span className="text-slate-300 font-sans font-medium truncate pr-2">{c.name}</span><span className="font-bold shrink-0 text-slate-300">{formatMoney(c.total, 'TRY').formatted}</span></div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* --- ALT ALANIN ALTINA ALINAN: SON İŞLEM AKIŞI (GENİŞ TABLO & AKIŞ) --- */}
      {/* ========================================================================= */}
      <div style={{ animation: 'fadeInUp 0.5s both 0.3s' }} className="bg-[#0d1322] border border-slate-800/80 rounded-xl shadow-xl overflow-hidden flex flex-col">
        {/* Üst Başlık, Filtre Sekmeleri ve Arama */}
        <div className="p-3 bg-[#0a0f1d] border-b border-slate-800/80 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <Activity size={16} />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm tracking-wide flex items-center gap-2">
                Son İşlem Akışı
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono font-normal">
                  {filteredRecentTransactions.length} Hareket
                </span>
              </h3>
              <p className="text-[10px] text-slate-400">Müşteri, tedarikçi, masraf ve teknik servis son hareket dökümü</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Modül Filtre Hapları */}
            <div className="flex items-center bg-[#070b14] border border-slate-800 rounded-lg p-0.5 text-[10px] font-bold">
              <button
                onClick={() => setRecentModuleFilter('all')}
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${recentModuleFilter === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}`}
              >
                Tümü
              </button>
              <button
                onClick={() => setRecentModuleFilter('customer')}
                className={`px-2 py-1 rounded transition-colors cursor-pointer flex items-center gap-1 ${recentModuleFilter === 'customer' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-blue-300'}`}
              >
                <Users size={11} /> Müşteri
              </button>
              <button
                onClick={() => setRecentModuleFilter('supplier')}
                className={`px-2 py-1 rounded transition-colors cursor-pointer flex items-center gap-1 ${recentModuleFilter === 'supplier' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-400 hover:text-amber-300'}`}
              >
                <Building2 size={11} /> Tedarikçi
              </button>
              <button
                onClick={() => setRecentModuleFilter('expense')}
                className={`px-2 py-1 rounded transition-colors cursor-pointer flex items-center gap-1 ${recentModuleFilter === 'expense' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-400 hover:text-purple-300'}`}
              >
                <CreditCard size={11} /> Gider
              </button>
              <button
                onClick={() => setRecentModuleFilter('technical-service')}
                className={`px-2 py-1 rounded transition-colors cursor-pointer flex items-center gap-1 ${recentModuleFilter === 'technical-service' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-400 hover:text-teal-300'}`}
              >
                <Wrench size={11} /> Servis
              </button>
            </div>

            {/* Arama Input'u */}
            <div className="relative flex-1 sm:w-56">
              <Search size={12} className="absolute left-2.5 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="İşlem veya cari ara..."
                value={recentSearch}
                onChange={(e) => setRecentSearch(e.target.value)}
                className="w-full bg-[#070b14] border border-slate-800 text-white text-[11px] pl-7 pr-7 py-1.5 rounded-lg focus:outline-none focus:border-indigo-500"
              />
              {recentSearch && (
                <button onClick={() => setRecentSearch('')} className="absolute right-2 top-2 text-slate-500 hover:text-white cursor-pointer">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tablo Görünümü */}
        <div className="max-h-[380px] overflow-y-auto custom-scrollbar">
          {filteredRecentTransactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-slate-500 text-center">
              <Activity size={28} className="mb-2 opacity-50 text-slate-400" />
              <p className="text-xs font-bold text-slate-300">İşlem Hareketi Bulunamadı</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Seçilen filtre ve arama kriterlerine uygun kayıt bulunmuyor.</p>
            </div>
          ) : (
            <table className="w-full text-left text-[11px] border-collapse">
              <thead className="sticky top-0 bg-[#0a0f1d] z-10 text-[10px] text-slate-400 border-b border-slate-800/80 shadow-xs">
                <tr>
                  <th className="py-2.5 px-3 font-semibold w-28">Tarih</th>
                  <th className="py-2.5 px-3 font-semibold w-36">İşlem Türü</th>
                  <th className="py-2.5 px-3 font-semibold">Açıklama</th>
                  <th className="py-2.5 px-3 font-semibold w-40">Merkez</th>
                  <th className="py-2.5 px-3 font-semibold text-right w-36">Tutar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredRecentTransactions.map((tx, idx) => {
                  let icon, colorClass, sign, typeName, typeBadge
                  if (tx.module === 'expense') {
                    icon = <ArrowDownRightFromSquare size={12} />
                    colorClass = 'text-purple-400'
                    sign = '-'
                    typeName = 'Gider / Masraf'
                    typeBadge = 'bg-purple-950/60 text-purple-300 border-purple-800/50'
                  } else if (tx.module === 'customer') {
                    if (tx.type === 'in') {
                      icon = <ArrowUpRightFromSquare size={12} />
                      colorClass = 'text-blue-400'
                      sign = '+'
                      typeName = 'Müşteri Fatura'
                      typeBadge = 'bg-blue-950/60 text-blue-300 border-blue-800/50'
                    } else {
                      icon = <Wallet size={12} />
                      colorClass = 'text-emerald-400'
                      sign = '+'
                      typeName = 'Müşteri Tahsilat'
                      typeBadge = 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50'
                    }
                  } else if (tx.module === 'supplier') {
                    if (tx.type === 'debt') {
                      icon = <ArrowDownRightFromSquare size={12} />
                      colorClass = 'text-amber-400'
                      sign = '-'
                      typeName = 'Tedarikçi Alış'
                      typeBadge = 'bg-amber-950/60 text-amber-300 border-amber-800/50'
                    } else {
                      icon = <Wallet size={12} />
                      colorClass = 'text-rose-400'
                      sign = '-'
                      typeName = 'Tedarikçi Ödeme'
                      typeBadge = 'bg-rose-950/60 text-rose-300 border-rose-800/50'
                    }
                  } else if (tx.module === 'technical-service') {
                    icon = <Wrench size={12} />
                    colorClass = 'text-teal-400'
                    sign = '+'
                    typeName = 'Servis Teslimat'
                    typeBadge = 'bg-teal-950/60 text-teal-300 border-teal-800/50'
                  }

                  const comp = companies.find(c => c.id === tx.companyId)

                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap">
                        {formatDateTR(tx.date)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1.5 text-[9px] px-2 py-0.5 rounded-md border font-bold ${typeBadge}`}>
                          {icon} {typeName}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-200 truncate max-w-[450px]" title={tx.description}>
                          {tx.description}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-[10px] text-slate-400 font-medium truncate block max-w-[140px]">
                          {comp?.name || 'Holding / Ortak'}
                        </span>
                      </td>
                      <td className={`py-2.5 px-3 text-right font-mono font-bold text-xs ${colorClass}`}>
                        {sign}{formatMoney(tx.amountTry, 'TRY').formatted}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideRight {
          from { opacity: 0; transform: translateX(-15px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
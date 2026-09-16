'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/lib/utils'
import { LayoutDashboard, CreditCard, Landmark, Wallet, ArrowUpRight, ArrowDownLeft, Package, TrendingUp, ChevronDown, ChevronUp, Building, Home as HomeIcon, Filter, BarChart4, ArrowUpRightFromSquare, ArrowDownRightFromSquare, Sparkles, Activity, FileText } from 'lucide-react'

type ExchangeRates = { USD: number | null, EUR: number | null }

type BankDetail = { id: string; bank_name: string; account_name: string; balance: number; currency: any; company_id: string | null }
type CashDetail = { id: string; name: string; balance: number; currency: any; company_id: string | null }
type CardDetail = { id: string; name: string; current_debt: number; card_limit: number; company_id: string | null }
type CustomerDetail = { id: string; name: string; balance: number; currency: string }
type SupplierDetail = { id: string; company_name: string; balance: number; currency: string }
type RawStock = { quantity: number; unit_price: number; vat_rate: number; currency: string; warehouse_id: string }
type Warehouse = { id: string; name: string; company_id: string | null }
type ExpenseTransaction = { id: string; amount: number; exchange_rate: number; company_id: string | null; date?: string; tx_date?: string; description?: string; created_at: string; category?: { name: string } }
type Company = { id: string; name: string; is_personal: boolean }

type CustTx = { id: string; tx_date: string; description: string; customer_id: string; tx_type: string; amount: number; exchange_rate: number; company_id: string | null; invoice_lines?: any[]; created_at: string }
type SuppTx = { id: string; tx_date: string; description: string; supplier_id: string; tx_type: string; amount: number; exchange_rate: number; company_id: string | null; created_at: string }
type StockTx = { tx_date: string; tx_type: string; quantity: number; unit_price: number; currency: string; company_id: string | null }
type SubTx = { start_date: string; cost_price: number; sale_price: number; currency: string; company_id: string | null }
type PosTx = { id: string; date: string; category_id: string; cash: number; card: number; cost: number; stock_id: string | null; company_id: string | null }

type TimelineItem = {
  id: string
  date: string
  sortDate: Date
  module: 'customer' | 'supplier' | 'expense'
  description: string
  amountTry: number
  type: 'in' | 'out' | 'expense' | 'debt'
  companyId: string | null
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
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all')

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

  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
    bank: false, cash: false, card: false, customer: false, supplier: false, stock: false, comm: false, pers: false
  })

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

  const isMatch = (compId: string | null) => {
    if (selectedCompanyId === 'all') return true;
    if (selectedCompanyId === 'common') return compId === null;
    return compId === selectedCompanyId;
  }

  const filteredBanks = banks.filter(b => isMatch(b.company_id))
  const filteredCashes = cashes.filter(c => isMatch(c.company_id))
  const filteredCards = cards.filter(c => isMatch(c.company_id))
  const filteredWarehouses = warehouses.filter(w => isMatch(w.company_id))
  const validWhIds = filteredWarehouses.map(w => w.id)
  const filteredStocks = rawStocks.filter(s => validWhIds.includes(s.warehouse_id))
  const filteredExpenses = expenses.filter(e => isMatch(e.company_id))

  const activeCustomers = selectedCompanyId === 'all' 
    ? customers.filter(c => Math.abs(c.balance) > 0.01)
    : customers.map(c => {
        const bal = customerTxs.filter(t => t.customer_id === c.id && isMatch(t.company_id))
          .reduce((acc, t) => t.tx_type === 'debt' ? acc + (t.amount * (t.exchange_rate||1)) : acc - (t.amount * (t.exchange_rate||1)), 0)
        return { ...c, balance: bal }
      }).filter(c => Math.abs(c.balance) > 0.01)

  const activeSuppliers = selectedCompanyId === 'all'
    ? suppliers.filter(s => Math.abs(s.balance) > 0.01)
    : suppliers.map(s => {
        const bal = supplierTxs.filter(t => t.supplier_id === s.id && isMatch(t.company_id))
          .reduce((acc, t) => t.tx_type === 'debt' ? acc + (t.amount * (t.exchange_rate||1)) : acc - (t.amount * (t.exchange_rate||1)), 0)
        return { ...s, balance: bal }
      }).filter(s => Math.abs(s.balance) > 0.01)

  const totalBankTry = filteredBanks.reduce((acc, b) => acc + getTryEquivalent(Number(b.balance || 0), b.currency || 'TRY'), 0)
  const totalCashTry = filteredCashes.reduce((acc, c) => acc + getTryEquivalent(Number(c.balance || 0), c.currency || 'TRY'), 0)
  const totalCreditTry = filteredCards.reduce((acc, c) => acc + Number(c.current_debt || 0), 0)
  const totalStockTry = filteredStocks.reduce((acc, s) => acc + getTryEquivalent(s.quantity * s.unit_price * (1 + (s.vat_rate || 0)/100), s.currency || 'TRY'), 0)
  const totalCustomerTry = activeCustomers.reduce((acc, c) => acc + Number(c.balance || 0), 0)
  const totalSupplierTry = activeSuppliers.reduce((acc, s) => acc + Number(s.balance || 0), 0)

  const warehouseTotals = filteredWarehouses.map(wh => {
    const whStocks = filteredStocks.filter(s => s.warehouse_id === wh.id)
    const val = whStocks.reduce((acc, s) => acc + getTryEquivalent(s.quantity * s.unit_price * (1 + (s.vat_rate || 0)/100), s.currency || 'TRY'), 0)
    return { ...wh, totalValue: val }
  }).filter(wh => wh.totalValue > 0)

  const commercialExpensesList = filteredExpenses.filter(e => e.company_id && !companies.find(c => c.id === e.company_id)?.is_personal)
  const personalExpensesList = filteredExpenses.filter(e => !e.company_id || companies.find(c => c.id === e.company_id)?.is_personal)
  
  // POS (Mağaza) Nakit Giderlerinin Hesaplanması
  const posExpTotalComm = posTxs.filter(t => t.category_id === 'gider' && (!t.company_id || !companies.find(c => c.id === t.company_id)?.is_personal)).reduce((acc, t) => acc + Number(t.cash) + Number(t.card), 0)
  const posExpTotalPers = posTxs.filter(t => t.category_id === 'gider' && (t.company_id && companies.find(c => c.id === t.company_id)?.is_personal)).reduce((acc, t) => acc + Number(t.cash) + Number(t.card), 0)

  const totalCommExpTry = commercialExpensesList.reduce((acc, e) => acc + (e.amount * (e.exchange_rate || 1)), 0) + posExpTotalComm
  const totalPersExpTry = personalExpensesList.reduce((acc, e) => acc + (e.amount * (e.exchange_rate || 1)), 0) + posExpTotalPers

  const commExpBreakdown = companies.filter(c => !c.is_personal).map(c => {
    const expTxsTotal = commercialExpensesList.filter(e => e.company_id === c.id).reduce((acc, e) => acc + (e.amount * (e.exchange_rate || 1)), 0)
    const posTxsTotal = posTxs.filter(t => t.category_id === 'gider' && t.company_id === c.id).reduce((acc, t) => acc + Number(t.cash) + Number(t.card), 0)
    return { id: c.id, name: c.name, total: expTxsTotal + posTxsTotal }
  }).filter(c => c.total > 0).sort((a, b) => b.total - a.total)

  const persExpBreakdown = Array.from(new Set(personalExpensesList.map(e => e.category?.name || 'Diğer'))).map(catName => {
    const total = personalExpensesList.filter(e => (e.category?.name || 'Diğer') === catName).reduce((acc, e) => acc + (e.amount * (e.exchange_rate || 1)), 0)
    return { id: catName, name: catName, total }
  }).filter(c => c.total > 0).sort((a, b) => b.total - a.total)

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

  allTimelineItems.sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime())
  const recentTransactions = allTimelineItems.slice(0, 30)

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
            <select value={selectedCompanyId} onChange={(e) => setSelectedCompanyId(e.target.value)} className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer pr-2">
              <option value="all" className="bg-[#0f172a] text-white">🌍 Holding (Tüm Sistem Özeti)</option>
              <option value="common" className="bg-[#0f172a] text-white">🌐 Ortak / Bağımsız Varlıklar</option>
              {companies.filter(c => !c.is_personal).length > 0 && <optgroup label="Ticari Şirketler" className="bg-[#070b14] text-slate-400 font-bold">{companies.filter(c => !c.is_personal).map(c => <option key={c.id} value={c.id} className="text-slate-200 font-medium">{c.name}</option>)}</optgroup>}
              {companies.filter(c => c.is_personal).length > 0 && <optgroup label="Şahsi Merkezler" className="bg-[#070b14] text-slate-400 font-bold">{companies.filter(c => c.is_personal).map(c => <option key={c.id} value={c.id} className="text-slate-200 font-medium">{c.name}</option>)}</optgroup>}
            </select>
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
          <div style={{ animation: 'fadeInUp 0.5s both 0.15s' }} className="lg:col-span-2 bg-[#0d1322] border border-slate-800/80 rounded-xl p-4 shadow-xl relative overflow-hidden flex flex-col h-[340px]">
            <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
            
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
                  <p className="text-[9px] text-cyan-400/90 font-bold uppercase tracking-wider mb-0.5">Mağaza POS Kârı</p>
                  <div className="text-sm font-black font-mono text-cyan-400">{formatMoney(currPosProfit, 'TRY').formatted}</div>
                  <div className={`flex items-center gap-1 text-[9px] font-bold mt-1.5 ${posProfitTrend.isUp ? 'text-emerald-400' : 'text-rose-400'}`}>{posProfitTrend.isUp ? <ArrowUpRightFromSquare size={9}/> : <ArrowDownRightFromSquare size={9}/>} % {posProfitTrend.percent.toFixed(1)} {posProfitTrend.isUp ? 'Artış' : 'Düşüş'}</div>
              </div>

              <div className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-lg shadow-inner transition-transform hover:-translate-y-0.5">
                  <p className="text-[9px] text-emerald-400/90 font-bold uppercase tracking-wider mb-0.5">Net Ticari Kâr</p>
                  <div className={`text-sm font-black font-mono ${currData.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatMoney(currData.profit, 'TRY').formatted}</div>
                  <div className={`flex items-center gap-1 text-[9px] font-bold mt-1.5 ${profitTrend.isUp ? 'text-emerald-400' : 'text-rose-400'}`}>{profitTrend.isUp ? <ArrowUpRightFromSquare size={9}/> : <ArrowDownRightFromSquare size={9}/>} % {profitTrend.percent.toFixed(1)} {profitTrend.isUp ? 'Artış' : 'Düşüş'}</div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/60 flex-1 flex items-end min-h-0">
              <div className="flex items-end gap-2 h-full w-full">
                {last6MonthKeys.map((key) => {
                  const m = monthsData[key]
                  const totalOut = m.cost + m.expense
                  const revHeight = Math.max((m.revenue / maxChartValue) * 100, 2)
                  const outHeight = Math.max((totalOut / maxChartValue) * 100, 2)
                  return (
                    <div key={key} className="flex-1 flex flex-col justify-end items-center gap-1 group relative h-full">
                        <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#070b14] border border-slate-700 rounded-lg p-2 text-[10px] font-mono shadow-2xl z-20 w-32 pointer-events-none">
                          <div className="text-blue-400">Ciro: {formatMoney(m.revenue, 'TRY').formatted}</div>
                          <div className="text-orange-400 border-b border-slate-700/50 pb-1 mb-1">Gider: {formatMoney(totalOut, 'TRY').formatted}</div>
                          <div className={m.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}>Net: {formatMoney(m.profit, 'TRY').formatted}</div>
                        </div>
                        <div className="w-full flex justify-center gap-1 items-end h-full relative">
                          <div className="w-1/3 max-w-[20px] bg-blue-500 rounded-t-sm transition-all duration-1000 ease-out shadow-sm" style={{ height: `${revHeight}%` }} />
                          <div className="w-1/3 max-w-[20px] bg-orange-500 rounded-t-sm transition-all duration-1000 ease-out delay-100 shadow-sm" style={{ height: `${outHeight}%` }} />
                        </div>
                        <div className="text-[9px] text-slate-500 font-bold mt-1 text-center truncate w-full shrink-0 group-hover:text-slate-300 transition-colors">{m.monthLabel}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* SAĞ TARAFTA SON İŞLEMLER AKIŞI */}
          <div style={{ animation: 'fadeInUp 0.5s both 0.25s' }} className="bg-[#0d1322] border border-slate-800/80 rounded-xl shadow-xl overflow-hidden flex flex-col h-[340px]">
             <div className="p-3 bg-[#0a0f1d] border-b border-slate-800/80 flex items-center justify-between shrink-0">
                <h3 className="text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                  <Activity size={15} className="text-emerald-400" /> Son İşlem Akışı
                </h3>
             </div>
             <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
                {recentTransactions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-6 border border-dashed border-slate-700/60 rounded-xl bg-slate-800/10 text-slate-500 shadow-inner m-2">
                     <FileText size={28} className="mb-3 opacity-70 text-emerald-400 animate-bounce" />
                     <span className="text-[11px] font-bold text-slate-400">Son İşlem Yok</span>
                     <span className="text-[9px] mt-1 text-slate-500">Sistemde henüz bir hareket bulunmuyor.</span>
                  </div>
                ) : recentTransactions.map((tx, idx) => {
                   let icon, colorClass, sign
                   if (tx.module === 'expense') { icon = <ArrowDownRightFromSquare size={12}/>; colorClass = 'text-purple-400'; sign = '-' }
                   else if (tx.module === 'customer') {
                      if (tx.type === 'in') { icon = <ArrowUpRightFromSquare size={12}/>; colorClass = 'text-blue-400'; sign = '+' }
                      else { icon = <Wallet size={12}/>; colorClass = 'text-emerald-400'; sign = '+' }
                   }
                   else if (tx.module === 'supplier') {
                      if (tx.type === 'debt') { icon = <ArrowDownRightFromSquare size={12}/>; colorClass = 'text-amber-400'; sign = '-' }
                      else { icon = <Wallet size={12}/>; colorClass = 'text-rose-400'; sign = '-' }
                   }

                   return (
                     <div 
                        key={tx.id} 
                        style={{ animation: 'fadeSlideRight 0.4s both', animationDelay: `${0.3 + (idx * 0.05)}s` }}
                        className="flex justify-between items-center p-2 rounded-lg bg-[#070b14] border border-slate-800/50 hover:border-slate-600 transition-colors cursor-default"
                     >
                        <div className="flex items-start gap-2 min-w-0 pr-2">
                           <div className={`p-1.5 rounded-md bg-slate-800/50 shrink-0 ${colorClass}`}>{icon}</div>
                           <div className="flex flex-col min-w-0">
                              <span className="text-[10px] font-bold text-slate-200 truncate">{tx.description}</span>
                              <span className="text-[8px] text-slate-500 font-mono">{formatDateTR(tx.date)}</span>
                           </div>
                        </div>
                        <div className={`text-[11px] font-mono font-bold shrink-0 ${colorClass}`}>
                           {sign}{formatMoney(tx.amountTry, 'TRY').formatted}
                        </div>
                     </div>
                   )
                })}
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
              ) : activeCustomers.map(cust => (
                  <div key={cust.id} className="py-1 flex justify-between items-center font-mono border-b border-slate-800/50 last:border-0"><span className="text-slate-300 font-sans font-medium truncate pr-2">{cust.name}</span><span className={`font-bold shrink-0 ${cust.balance > 0 ? 'text-blue-400' : 'text-rose-400'}`}>{formatMoney(cust.balance, 'TRY').formatted}</span></div>
              ))}
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
              ) : activeSuppliers.map(sup => (
                  <div key={sup.id} className="py-1 flex justify-between items-center font-mono border-b border-slate-800/50 last:border-0"><span className="text-slate-300 font-sans font-medium truncate pr-2">{sup.company_name}</span><span className="font-bold text-amber-400 shrink-0">{formatMoney(sup.balance, 'TRY').formatted}</span></div>
              ))}
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

        {/* ŞAHSİ GİDERLER */}
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
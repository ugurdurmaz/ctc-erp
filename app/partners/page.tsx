'use client'

import React, { useEffect, useState, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { formatMoney, formatPhoneNumber } from '@/lib/utils'
import { logActivity } from '@/lib/audit'
import toast, { Toaster } from 'react-hot-toast'
import { recalculateAbsoluteStock as recalculateStockLedger } from '@/lib/stock-ledger'
import { 
  Handshake, Plus, Search, Calendar, DollarSign, CheckCircle2, Clock, 
  AlertTriangle, Printer, Share2, Trash2, Edit3, Wallet, Landmark, 
  Building2, User, FileText, Check, X, ChevronRight, Copy, ExternalLink, 
  Layers, ArrowDownRight, Sparkles, Calculator, ShieldAlert, Phone,
  Mail, MessageSquare, ArrowRight, RefreshCw, Eye, ArrowUpRight, Package,
  ArrowDownLeft
} from 'lucide-react'

// ==============================================================================
// TİPLER
// ==============================================================================
export interface SettlementItem {
  stock_id?: string
  name: string
  quantity: number
  unit_price: number
  cost_price?: number
  total: number
}

export interface StockItem {
  id: string
  name: string
  sku?: string
  category?: string
  quantity: number
  unit_price: number
  currency?: string
  warehouse_id?: string
}

export interface Partner {
  id: string
  name: string
  phone?: string | null
  email?: string | null
  company_id?: string | null
  default_tax_rate: number
  default_commission_rate: number
  balance: number
  notes?: string | null
  created_at?: string
  company?: { name: string; is_personal: boolean }
}

export interface PartnerSettlement {
  id: string
  partner_id: string
  company_id?: string | null
  job_title: string
  job_date: string
  job_type: 'project' | 'service'
  customer_name?: string | null
  invoice_no?: string | null
  invoice_amount: number
  collection_status: 'collected' | 'pending'
  collection_source_type?: 'bank' | 'cash' | 'none'
  collection_source_id?: string | null
  material_cost_shop: number
  material_cost_external: number
  tax_rate: number
  tax_amount: number
  shop_profit_share: number
  other_expenses: number
  partner_payout: number
  payout_status: 'unpaid' | 'partial' | 'paid'
  paid_amount: number
  remaining_payout: number
  items_breakdown?: SettlementItem[]
  notes?: string | null
  created_at?: string
  partner?: { name: string }
  company?: { name: string; is_personal: boolean }
}


export interface PartnerTransaction {
  id: string
  partner_id: string
  settlement_id?: string | null
  tx_type: 'payment' | 'earning'
  amount: number
  tx_date: string
  payment_source_type?: 'bank' | 'cash'
  payment_source_id?: string
  transfer_id?: string
  description?: string
  created_at?: string
}

interface Company { id: string; name: string; is_personal: boolean }
interface BankAccount { id: string; bank_name: string; account_name: string; balance: number; currency: string; company_id?: string | null }
interface CashRegister { id: string; name: string; balance: number; currency: string; company_id?: string | null }

function getLocalTodayISO() { 
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` 
}

function formatDateTR(dateStr?: string) { 
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`
  return dateStr 
}

export default function PartnersPage() {
  const { profile, isAdmin } = useAuth()
  const isRestricted = !isAdmin && !!profile?.allowed_companies && profile.allowed_companies.length > 0

  // Ana State'ler
  const [partners, setPartners] = useState<Partner[]>([])
  const [settlements, setSettlements] = useState<PartnerSettlement[]>([])
  const [transactions, setTransactions] = useState<PartnerTransaction[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [banks, setBanks] = useState<BankAccount[]>([])
  const [cashes, setCashes] = useState<CashRegister[]>([])

  // Filtreler & Seçimler
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('')
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'settlements' | 'transactions'>('settlements')
  const [isLoading, setIsLoading] = useState(true)
  const [isTableMissing, setIsTableMissing] = useState(false)
  const [isRlsRestricted, setIsRlsRestricted] = useState(false)

  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false)
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null)
  const [partnerName, setPartnerName] = useState('')
  const [partnerPhone, setPartnerPhone] = useState('')
  const [partnerEmail, setPartnerEmail] = useState('')
  const [partnerCompanyId, setPartnerCompanyId] = useState('common')
  const [partnerTaxRate, setPartnerTaxRate] = useState('20')
  const [partnerCommissionRate, setPartnerCommissionRate] = useState('0')
  const [partnerNotes, setPartnerNotes] = useState('')

  // Hakediş (İş) Modalı State'leri
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false)
  const [editingSettlement, setEditingSettlement] = useState<PartnerSettlement | null>(null)
  const [settlePartnerId, setSettlePartnerId] = useState('')
  const [settleCompanyId, setSettleCompanyId] = useState('common')
  const [settleJobTitle, setSettleJobTitle] = useState('')
  const [settleJobDate, setSettleJobDate] = useState(getLocalTodayISO())
  const [settleJobType, setSettleJobType] = useState<'project' | 'service'>('project')
  const [settleCustomerName, setSettleCustomerName] = useState('')
  const [settleInvoiceNo, setSettleInvoiceNo] = useState('')
  const [settleInvoiceAmount, setSettleInvoiceAmount] = useState('')
  const [settleCollectionStatus, setSettleCollectionStatus] = useState<'collected' | 'pending'>('collected')
  const [settleCollectionSource, setSettleCollectionSource] = useState('')
  const [settleMaterialShop, setSettleMaterialShop] = useState('')
  const [settleMaterialExternal, setSettleMaterialExternal] = useState('')
  const [settleTaxRate, setSettleTaxRate] = useState('20')
  const [settleTaxAmount, setSettleTaxAmount] = useState('')
  const [settleShopProfit, setSettleShopProfit] = useState('')
  const [settleOtherExpenses, setSettleOtherExpenses] = useState('')
  const [settleNotes, setSettleNotes] = useState('')

  // Depo Malzeme Seçimi & Otomatik Stok Düşümü State'leri
  const [stocks, setStocks] = useState<StockItem[]>([])
  const [rates, setRates] = useState<{ USD: number; EUR: number }>({ USD: 34.25, EUR: 37.80 })
  const [settleItems, setSettleItems] = useState<SettlementItem[]>([])
  const [selectedStockId, setSelectedStockId] = useState('')
  const [selectedStockQty, setSelectedStockQty] = useState('1')
  const [selectedStockPrice, setSelectedStockPrice] = useState('')
  const [stockSearchQuery, setStockSearchQuery] = useState('')
  const [isStockDropdownOpen, setIsStockDropdownOpen] = useState(false)
  const [deductFromInventory, setDeductFromInventory] = useState(true)
  const stockDropdownRef = useRef<HTMLDivElement>(null)

  // Dropdown dışına tıklandığında menüyü kapat
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (stockDropdownRef.current && !stockDropdownRef.current.contains(e.target as Node)) {
        setIsStockDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Hakediş Ödeme Modalı
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false)
  const [payoutPartnerId, setPayoutPartnerId] = useState('')
  const [payoutSettlementId, setPayoutSettlementId] = useState<string>('')
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payoutDate, setPayoutDate] = useState(getLocalTodayISO())
  const [payoutSource, setPayoutSource] = useState('') // 'bank|<id>' veya 'cash|<id>'
  const [payoutDescription, setPayoutDescription] = useState('')

  // Müşteri Fatura Tahsilat Modalı (Banka / Kasa Girişi)
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false)
  const [collectionSettlement, setCollectionSettlement] = useState<PartnerSettlement | null>(null)
  const [collectionSource, setCollectionSource] = useState('none') // 'none' | 'bank|<id>' | 'cash|<id>'
  const [collectionDate, setCollectionDate] = useState(getLocalTodayISO())

  // Makbuz / Pusula Modal
  const [printSettlement, setPrintSettlement] = useState<PartnerSettlement | null>(null)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  // Onay Dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string; confirmText: string; cancelText: string; isDanger: boolean; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', confirmText: '', cancelText: '', isDanger: false, onConfirm: () => {} })

  // ==============================================================================
  // VERİ YÜKLEME
  // ==============================================================================
  useEffect(() => {
    fetchInitialData()
  }, [])

  async function fetchInitialData() {
    setIsLoading(true)
    await Promise.all([
      fetchCompanies(),
      fetchPaymentSources(),
      fetchPartners(),
      fetchSettlements(),
      fetchTransactions(),
      fetchStocks(),
      fetchExchangeRates()
    ])
    setIsLoading(false)
  }

  async function fetchStocks() {
    const { data } = await supabase.from('stocks').select('id, name, sku, category, quantity, unit_price, currency, warehouse_id').order('name')
    setStocks(data || [])
  }

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
    } catch {}
  }

  const getTryPrice = (price: number, curr?: string) => {
    if (curr === 'USD') return Number((price * (rates.USD || 34.25)).toFixed(2))
    if (curr === 'EUR') return Number((price * (rates.EUR || 37.80)).toFixed(2))
    return price
  }

  async function recalculateAbsoluteStock(stockId: string) {
    try {
      await recalculateStockLedger(supabase, stockId, rates)
    } catch (err) {
      console.error('Stok mutlak hesaplama hatası:', err)
    }
  }

  // Arama Sorgusuna Göre Filtrelenmiş Depo Ürünleri
  const filteredStocks = useMemo(() => {
    const q = stockSearchQuery.toLocaleLowerCase('tr-TR').trim()
    if (!q) return stocks.slice(0, 60)
    return stocks.filter(s => {
      const nameMatch = s.name.toLocaleLowerCase('tr-TR').includes(q)
      const skuMatch = s.sku ? s.sku.toLocaleLowerCase('tr-TR').includes(q) : false
      const catMatch = s.category ? s.category.toLocaleLowerCase('tr-TR').includes(q) : false
      return nameMatch || skuMatch || catMatch
    }).sort((a, b) => {
      if (b.quantity > 0 && a.quantity <= 0) return 1
      if (a.quantity > 0 && b.quantity <= 0) return -1
      return a.name.localeCompare(b.name, 'tr-TR')
    }).slice(0, 60)
  }, [stocks, stockSearchQuery])


  async function fetchCompanies() {
    const { data } = await supabase.from('companies').select('*').order('name', { ascending: true })
    let comps = data || []
    if (isRestricted) {
      comps = comps.filter(c => !c.is_personal && profile?.allowed_companies?.includes(c.id))
    }
    setCompanies(comps)
    if (isRestricted && comps.length > 0) {
      setCompanyFilter(comps[0].id)
      setPartnerCompanyId(comps[0].id)
      setSettleCompanyId(comps[0].id)
    }
  }

  async function fetchPaymentSources() {
    const { data: bData } = await supabase.from('bank_accounts').select('id, bank_name, account_name, balance, currency, company_id')
    const { data: cData } = await supabase.from('cash_registers').select('id, name, balance, currency, company_id')
    let bList = bData || []
    let cList = cData || []
    if (isRestricted) {
      bList = bList.filter(b => b.company_id && profile?.allowed_companies?.includes(b.company_id))
      cList = cList.filter(c => c.company_id && profile?.allowed_companies?.includes(c.company_id))
    }
    setBanks(bList)
    setCashes(cList)
  }

  async function fetchPartners() {
    const { data, error } = await supabase
      .from('partners')
      .select('*, company:companies(name, is_personal)')
      .order('name', { ascending: true })

    if (error) {
      if (error.code === '42501' || error.message?.toLowerCase().includes('row-level security') || error.message?.toLowerCase().includes('violates')) {
        setIsRlsRestricted(true)
      }
      if (error.code === 'PGRST205' || error.message?.includes('partners')) {
        setIsTableMissing(true)
      }
      const cached = localStorage.getItem('ctc_partners_cache')
      if (cached) {
        try { setPartners(JSON.parse(cached)) } catch {}
      }
      return
    }

    if (data && data.length > 0) {
      setPartners(data)
      localStorage.setItem('ctc_partners_cache', JSON.stringify(data))
      if (!selectedPartnerId) {
        setSelectedPartnerId(data[0].id)
      }
    } else {
      // Supabase 0 kayıt döndüyse ama yerel önbellekte (ör: RLS nedeniyle veritabanına henüz yazılamamış) kayıt varsa koru:
      const cached = localStorage.getItem('ctc_partners_cache')
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPartners(parsed)
            if (!selectedPartnerId) {
              setSelectedPartnerId(parsed[0].id)
            }
            return
          }
        } catch {}
      }
      setPartners([])
    }
  }

  async function fetchSettlements() {
    const { data, error } = await supabase
      .from('partner_settlements')
      .select('*, company:companies(name, is_personal), partner:partners(name)')
      .order('job_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      if (error.code === '42501' || error.message?.toLowerCase().includes('row-level security') || error.message?.toLowerCase().includes('violates')) {
        setIsRlsRestricted(true)
      }
      if (error.code === 'PGRST205' || error.message?.includes('partner_settlements')) {
        setIsTableMissing(true)
      }
      const cached = localStorage.getItem('ctc_partner_settlements_cache')
      if (cached) {
        try { setSettlements(JSON.parse(cached)) } catch {}
      }
      return
    }

    if (data && data.length > 0) {
      setSettlements(data)
      localStorage.setItem('ctc_partner_settlements_cache', JSON.stringify(data))
    } else {
      const cached = localStorage.getItem('ctc_partner_settlements_cache')
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSettlements(parsed)
            return
          }
        } catch {}
      }
      setSettlements([])
    }
  }

  async function fetchTransactions() {
    const { data, error } = await supabase
      .from('partner_transactions')
      .select('*')
      .order('tx_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      if (error.code === '42501' || error.message?.toLowerCase().includes('row-level security') || error.message?.toLowerCase().includes('violates')) {
        setIsRlsRestricted(true)
      }
      if (error.code === 'PGRST205' || error.message?.includes('partner_transactions')) {
        const cached = localStorage.getItem('ctc_partner_txs_cache')
        if (cached) {
          try { setTransactions(JSON.parse(cached)) } catch {}
        }
      }
      return
    }

    if (data && data.length > 0) {
      setTransactions(data)
      localStorage.setItem('ctc_partner_txs_cache', JSON.stringify(data))
    } else {
      const cached = localStorage.getItem('ctc_partner_txs_cache')
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setTransactions(parsed)
            return
          }
        } catch {}
      }
      setTransactions([])
    }
  }


  // ==============================================================================
  // MUTLAK HESAPLAMA YARDIMCILARI
  // ==============================================================================
  async function recalculateAbsolutePartnerBalance(partnerId: string) {
    try {
      const { data: sData } = await supabase.from('partner_settlements').select('partner_payout').eq('partner_id', partnerId)
      const { data: tData } = await supabase.from('partner_transactions').select('amount, tx_type').eq('partner_id', partnerId)

      let totalEarned = 0
      sData?.forEach(s => { totalEarned += Number(s.partner_payout) || 0 })

      let totalPaid = 0
      tData?.forEach(t => {
        if (t.tx_type === 'payment') totalPaid += Number(t.amount) || 0
      })

      const netBalance = totalEarned - totalPaid

      await supabase.from('partners').update({ balance: netBalance }).eq('id', partnerId)
      setPartners(prev => prev.map(p => p.id === partnerId ? { ...p, balance: netBalance } : p))
      return netBalance
    } catch (e) {
      console.error('Error recalculating partner balance:', e)
      return 0
    }
  }

  async function recalculateAbsoluteCashBalance(cashId: string) {
    const { data: txs } = await supabase.from('cash_transactions').select('amount, tx_type').eq('cash_register_id', cashId)
    let absoluteBal = 0
    txs?.forEach(t => { absoluteBal += t.tx_type === 'in' ? Number(t.amount) : -Number(t.amount) })
    await supabase.from('cash_registers').update({ balance: absoluteBal }).eq('id', cashId)
    setCashes(prev => prev.map(c => c.id === cashId ? { ...c, balance: absoluteBal } : c))
  }

  async function recalculateAbsoluteBankBalance(bankId: string) {
    const { data: txs } = await supabase.from('bank_transactions').select('amount, tx_type, status').eq('bank_account_id', bankId)
    let absoluteBal = 0
    txs?.forEach(t => {
      if (t.status !== 'pending') absoluteBal += t.tx_type === 'in' ? Number(t.amount) : -Number(t.amount)
    })
    await supabase.from('bank_accounts').update({ balance: absoluteBal }).eq('id', bankId)
    setBanks(prev => prev.map(b => b.id === bankId ? { ...b, balance: absoluteBal } : b))
  }

  // ==============================================================================
  // CANLI HESAPLAMA (MODAL FORMÜLÜ)
  // ==============================================================================
  const liveSettlementCalc = useMemo(() => {
    const invAmt = parseFloat(settleInvoiceAmount) || 0
    const matShop = parseFloat(settleMaterialShop) || 0
    const matExt = 0
    const taxAmt = parseFloat(settleTaxAmount) || 0
    const taxPct = invAmt > 0 ? Number(((taxAmt / invAmt) * 100).toFixed(1)) : 0
    const shopProfit = parseFloat(settleShopProfit) || 0
    const otherExp = parseFloat(settleOtherExpenses) || 0

    const totalDeductions = matShop + matExt + taxAmt + shopProfit + otherExp
    const partnerPayout = Math.max(0, Number((invAmt - totalDeductions).toFixed(2)))
    const shopRetained = matShop + taxAmt + shopProfit

    return {
      invAmt,
      matShop,
      matExt,
      taxAmt,
      taxPct,
      shopProfit,
      otherExp,
      totalDeductions,
      partnerPayout,
      shopRetained
    }
  }, [settleInvoiceAmount, settleMaterialShop, settleTaxAmount, settleShopProfit, settleOtherExpenses])

  // ==============================================================================
  // PARTNER İŞLEMLERİ (EKLE / DÜZENLE / SİL)
  // ==============================================================================
  function openAddPartnerModal() {
    setEditingPartner(null)
    setPartnerName('')
    setPartnerPhone('')
    setPartnerEmail('')
    setPartnerCompanyId(isRestricted && companies.length > 0 ? companies[0].id : 'common')
    setPartnerTaxRate('20')
    setPartnerCommissionRate('0')
    setPartnerNotes('')
    setIsPartnerModalOpen(true)
  }

  function openEditPartnerModal(p: Partner) {
    setEditingPartner(p)
    setPartnerName(p.name)
    setPartnerPhone(p.phone || '')
    setPartnerEmail(p.email || '')
    setPartnerCompanyId(p.company_id || 'common')
    setPartnerTaxRate(p.default_tax_rate?.toString() || '20')
    setPartnerCommissionRate(p.default_commission_rate?.toString() || '0')
    setPartnerNotes(p.notes || '')
    setIsPartnerModalOpen(true)
  }

  async function handleSavePartner(e: React.FormEvent) {
    e.preventDefault()
    if (!partnerName.trim()) {
      toast.error('Lütfen çözüm ortağının adını girin.')
      return
    }

    const finalCompId = partnerCompanyId === 'common' ? null : partnerCompanyId
    const payload = {
      name: partnerName.trim(),
      phone: partnerPhone.trim() || null,
      email: partnerEmail.trim() || null,
      company_id: finalCompId,
      default_tax_rate: parseFloat(partnerTaxRate) || 20,
      default_commission_rate: parseFloat(partnerCommissionRate) || 0,
      notes: partnerNotes.trim() || null,
      updated_at: new Date().toISOString()
    }

    try {
      if (editingPartner) {
        const { error } = await supabase.from('partners').update(payload).eq('id', editingPartner.id)
        if (error) {
          console.error('Partner update error:', error)
          if (error.code === '42501' || error.message?.toLowerCase().includes('row-level security') || error.message?.toLowerCase().includes('violates')) {
            setIsRlsRestricted(true)
            toast.error('Supabase RLS kuralı nedeniyle veritabanına kaydedilemedi! İzin kodunu çalıştırmanız gerekiyor.', { duration: 7000 })
          } else {
            toast.error('Veritabanına kaydedilemedi: ' + error.message)
          }
          const updated = partners.map(p => p.id === editingPartner.id ? { ...p, ...payload } : p)
          setPartners(updated)
          localStorage.setItem('ctc_partners_cache', JSON.stringify(updated))
          setIsPartnerModalOpen(false)
          return
        }
        await logActivity('partner', 'UPDATE', `Çözüm ortağı güncellendi: ${payload.name}`, editingPartner.id, 0, 'TRY', editingPartner, payload, finalCompId)
        toast.success('Çözüm ortağı güncellendi.')
      } else {
        const newId = crypto.randomUUID()
        const newPartner: Partner = {
          id: newId,
          ...payload,
          balance: 0,
          created_at: new Date().toISOString()
        }
        const { error } = await supabase.from('partners').insert([newPartner])
        if (error) {
          console.error('Partner insert error:', error)
          if (error.code === '42501' || error.message?.toLowerCase().includes('row-level security') || error.message?.toLowerCase().includes('violates')) {
            setIsRlsRestricted(true)
            toast.error('Supabase RLS kuralı nedeniyle ortak veritabanına yazılamadı! Lütfen sarı başlıktaki izin kodunu çalıştırın.', { duration: 8000 })
          } else {
            toast.error('Veritabanına kaydedilemedi: ' + error.message)
          }
          // Yerel state ve önbelleğe alıp sayfada anında göster (fetchPartners çağırıp silinmesini engelle)
          const updated = [...partners, newPartner]
          setPartners(updated)
          setSelectedPartnerId(newId)
          localStorage.setItem('ctc_partners_cache', JSON.stringify(updated))
          setIsPartnerModalOpen(false)
          return
        }
        await logActivity('partner', 'INSERT', `Yeni çözüm ortağı eklendi: ${payload.name}`, newId, 0, 'TRY', null, newPartner, finalCompId)
        setSelectedPartnerId(newId)
        toast.success('Yeni çözüm ortağı başarıyla eklendi.')
      }
      setIsPartnerModalOpen(false)
      fetchPartners()
    } catch (err: any) {
      toast.error('Kayıt sırasında hata oluştu: ' + err.message)
    }
  }

  function handleDeletePartner(partnerId: string) {
    const p = partners.find(item => item.id === partnerId)
    if (!p) return

    setConfirmDialog({
      isOpen: true,
      title: 'Çözüm Ortağını Sil',
      message: `"${p.name}" adlı çözüm ortağını ve buna bağlı tüm hakediş kayıtlarını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        const { error } = await supabase.from('partners').delete().eq('id', partnerId)
        if (error) {
          const updated = partners.filter(item => item.id !== partnerId)
          setPartners(updated)
          localStorage.setItem('ctc_partners_cache', JSON.stringify(updated))
        }
        await logActivity('partner', 'DELETE', `Çözüm ortağı silindi: ${p.name}`, partnerId, p.balance, 'TRY', p, null, p.company_id)
        toast.success('Çözüm ortağı silindi.')
        if (selectedPartnerId === partnerId) {
          const rem = partners.filter(item => item.id !== partnerId)
          setSelectedPartnerId(rem.length > 0 ? rem[0].id : '')
        }
        fetchPartners()
        fetchSettlements()
      }
    })
  }

  // ==============================================================================
  // HAKEDİŞ / İŞ HESAPLAŞMA İŞLEMLERİ
  // ==============================================================================
  function openAddSettlementModal(targetPartnerId?: string) {
    setEditingSettlement(null)
    const pId = targetPartnerId || selectedPartnerId || (partners[0]?.id || '')
    const selectedP = partners.find(p => p.id === pId)
    setSettlePartnerId(pId)
    setSettleCompanyId(selectedP?.company_id || (isRestricted && companies.length > 0 ? companies[0].id : 'common'))
    setSettleJobTitle('')
    setSettleJobDate(getLocalTodayISO())
    setSettleJobType('project')
    setSettleCustomerName('')
    setSettleInvoiceNo('')
    setSettleInvoiceAmount('')
    setSettleCollectionStatus('collected')
    setSettleCollectionSource('')
    setSettleMaterialShop('')
    setSettleMaterialExternal('')
    setSettleTaxRate(selectedP?.default_tax_rate?.toString() || '20')
    setSettleTaxAmount('')
    setSettleShopProfit('')
    setSettleOtherExpenses('')
    setSettleNotes('')
    setSettleItems([])
    setSelectedStockId('')
    setSelectedStockQty('1')
    setSelectedStockPrice('')
    setStockSearchQuery('')
    setIsStockDropdownOpen(false)
    setDeductFromInventory(true)
    setIsSettlementModalOpen(true)
  }

  function openEditSettlementModal(s: PartnerSettlement) {
    setEditingSettlement(s)
    setSettlePartnerId(s.partner_id)
    setSettleCompanyId(s.company_id || 'common')
    setSettleJobTitle(s.job_title)
    setSettleJobDate(s.job_date)
    setSettleJobType(s.job_type)
    setSettleCustomerName(s.customer_name || '')
    setSettleInvoiceNo(s.invoice_no || '')
    setSettleInvoiceAmount(s.invoice_amount?.toString() || '')
    setSettleCollectionStatus(s.collection_status)
    setSettleCollectionSource(
      s.collection_source_type && s.collection_source_id ? `${s.collection_source_type}|${s.collection_source_id}` : ''
    )
    setSettleMaterialShop(s.material_cost_shop?.toString() || '')
    setSettleMaterialExternal(s.material_cost_external?.toString() || '')
    setSettleTaxRate(s.tax_rate?.toString() || '20')
    setSettleTaxAmount(s.tax_amount != null ? s.tax_amount.toString() : (s.invoice_amount && s.tax_rate ? ((s.invoice_amount * s.tax_rate) / 100).toFixed(2) : ''))
    setSettleShopProfit(s.shop_profit_share?.toString() || '')
    setSettleOtherExpenses(s.other_expenses?.toString() || '')
    setSettleNotes(s.notes || '')
    setSettleItems(Array.isArray(s.items_breakdown) ? s.items_breakdown : [])
    setSelectedStockId('')
    setSelectedStockQty('1')
    setSelectedStockPrice('')
    setStockSearchQuery('')
    setIsStockDropdownOpen(false)
    setDeductFromInventory(true)
    setIsSettlementModalOpen(true)
  }

  function handleAddStockItem() {
    if (!selectedStockId) return
    const stock = stocks.find(s => s.id === selectedStockId)
    if (!stock) return

    const qty = parseInt(selectedStockQty) || 1
    const costPriceTry = getTryPrice(stock.unit_price, stock.currency)
    const unitPriceTry = selectedStockPrice !== '' ? (parseFloat(selectedStockPrice) || 0) : costPriceTry
    const total = Number((qty * unitPriceTry).toFixed(2))

    const newItem: SettlementItem = {
      stock_id: stock.id,
      name: stock.name,
      quantity: qty,
      unit_price: unitPriceTry,
      cost_price: costPriceTry,
      total
    }

    const updated = [...settleItems, newItem]
    setSettleItems(updated)
    const sum = updated.reduce((s, it) => s + it.total, 0)
    setSettleMaterialShop(sum.toString())

    setSelectedStockId('')
    setSelectedStockPrice('')
    setSelectedStockQty('1')
    setStockSearchQuery('')
    setIsStockDropdownOpen(false)
  }

  function handleRemoveStockItem(index: number) {
    const updated = settleItems.filter((_, i) => i !== index)
    setSettleItems(updated)
    const sum = updated.reduce((s, it) => s + it.total, 0)
    setSettleMaterialShop(sum > 0 ? sum.toString() : '')
  }

  async function handleSaveSettlement(e: React.FormEvent) {
    e.preventDefault()
    if (!settlePartnerId) {
      toast.error('Lütfen bir çözüm ortağı seçin.')
      return
    }
    if (!settleJobTitle.trim()) {
      toast.error('Lütfen iş / proje başlığını girin.')
      return
    }

    const calc = liveSettlementCalc
    const finalCompId = settleCompanyId === 'common' ? null : settleCompanyId

    let colSourceType: 'bank' | 'cash' | 'none' = 'none'
    let colSourceId: string | null = null
    if (settleCollectionSource) {
      const parts = settleCollectionSource.split('|')
      colSourceType = parts[0] as any
      colSourceId = parts[1]
    }

    const paidAmt = editingSettlement ? editingSettlement.paid_amount : 0
    const remPayout = Math.max(0, calc.partnerPayout - paidAmt)
    const payoutStatus: 'unpaid' | 'partial' | 'paid' = 
      remPayout === 0 && calc.partnerPayout > 0 ? 'paid' : paidAmt > 0 ? 'partial' : 'unpaid'

    const payload = {
      partner_id: settlePartnerId,
      company_id: finalCompId,
      job_title: settleJobTitle.trim(),
      job_date: settleJobDate,
      job_type: settleJobType,
      customer_name: settleCustomerName.trim() || null,
      invoice_no: settleInvoiceNo.trim() || null,
      invoice_amount: calc.invAmt,
      collection_status: settleCollectionStatus,
      collection_source_type: colSourceType,
      collection_source_id: colSourceId,
      material_cost_shop: calc.matShop,
      material_cost_external: 0,
      tax_rate: calc.taxPct,
      tax_amount: calc.taxAmt,
      shop_profit_share: calc.shopProfit,
      other_expenses: calc.otherExp,
      partner_payout: calc.partnerPayout,
      payout_status: payoutStatus,
      paid_amount: paidAmt,
      remaining_payout: remPayout,
      items_breakdown: settleItems,
      notes: settleNotes.trim() || null,
      updated_at: new Date().toISOString()
    }

    try {
      if (editingSettlement) {
        // 1. Önceki stok çıkışlarını temizle ve eski stokları geri yükle
        const { data: oldStockTxs } = await supabase
          .from('stock_transactions')
          .select('id, stock_id')
          .like('description', `%[PARTNER-SETTLE:${editingSettlement.id}]%`)

        if (oldStockTxs && oldStockTxs.length > 0) {
          const affected = new Set(oldStockTxs.map(t => t.stock_id))
          await supabase.from('stock_transactions').delete().in('id', oldStockTxs.map(t => t.id))
          for (const sId of Array.from(affected)) {
            await recalculateAbsoluteStock(sId)
          }
        }

        // 2. Yeni stok çıkışlarını yap
        if (deductFromInventory && settleItems.length > 0) {
          const stockInserts = settleItems.filter(it => it.stock_id).map(it => ({
            stock_id: it.stock_id,
            company_id: finalCompId,
            tx_date: settleJobDate,
            description: `[PARTNER-SETTLE:${editingSettlement.id}] 🤝 Çözüm Ortağı Malzemesi (${settleJobTitle.trim()}) - ${it.name}`,
            tx_type: 'out',
            quantity: it.quantity,
            unit_price: it.unit_price,
            currency: 'TRY',
            vat_rate: 0
          }))
          if (stockInserts.length > 0) {
            await supabase.from('stock_transactions').insert(stockInserts)
            for (const it of settleItems) {
              if (it.stock_id) {
                await recalculateAbsoluteStock(it.stock_id)
              }
            }
          }
        }

        let { error } = await supabase.from('partner_settlements').update(payload).eq('id', editingSettlement.id)
        if (error && (error.code === 'PGRST204' || error.message?.includes('items_breakdown'))) {
          // Veritabanında items_breakdown kolonu henüz eklenmemişse kolonsuz kaydetmeyi dene:
          const { items_breakdown, ...withoutItems } = payload as any
          const retry = await supabase.from('partner_settlements').update(withoutItems).eq('id', editingSettlement.id)
          if (!retry.error) {
            error = null
          }
        }
        if (error) {
          console.error('Settlement update error:', error)
          if (error.code === '42501' || error.message?.toLowerCase().includes('row-level security') || error.message?.toLowerCase().includes('violates')) {
            setIsRlsRestricted(true)
            toast.error('Supabase RLS kuralı nedeniyle hakediş güncellenemedi! İzin kodunu çalıştırmanız gerekiyor.', { duration: 7000 })
          } else {
            toast.error('Veritabanı hatası: ' + error.message)
          }
          const updated = settlements.map(s => s.id === editingSettlement.id ? { ...s, ...payload } : s)
          setSettlements(updated)
          localStorage.setItem('ctc_partner_settlements_cache', JSON.stringify(updated))
          setIsSettlementModalOpen(false)
          return
        }

        // Tahsilat durumuna göre hesap hareketlerini senkronize et
        const colTransferKey = `PARTNER-COL-${editingSettlement.id}`
        const { data: oldBTxs } = await supabase.from('bank_transactions').select('bank_account_id').eq('transfer_id', colTransferKey)
        const { data: oldCTxs } = await supabase.from('cash_transactions').select('cash_register_id').eq('transfer_id', colTransferKey)
        
        await supabase.from('bank_transactions').delete().eq('transfer_id', colTransferKey)
        await supabase.from('cash_transactions').delete().eq('transfer_id', colTransferKey)

        if (oldBTxs) {
          for (const b of oldBTxs) {
            if (b.bank_account_id && b.bank_account_id !== colSourceId) await recalculateAbsoluteBankBalance(b.bank_account_id)
          }
        }
        if (oldCTxs) {
          for (const c of oldCTxs) {
            if (c.cash_register_id && c.cash_register_id !== colSourceId) await recalculateAbsoluteCashBalance(c.cash_register_id)
          }
        }

        if (settleCollectionStatus === 'collected' && colSourceType !== 'none' && colSourceId) {
          const colTxDesc = `🤝 Müşteri Fatura Tahsilatı: ${settleJobTitle.trim()}${settleCustomerName ? ` (${settleCustomerName.trim()})` : ''}${settleInvoiceNo ? ` [Fat: #${settleInvoiceNo.trim()}]` : ''}`.trim()
          if (colSourceType === 'bank') {
            const bankRec = banks.find(b => b.id === colSourceId)
            await supabase.from('bank_transactions').insert([{
              bank_account_id: colSourceId,
              company_id: finalCompId,
              tx_date: settleJobDate,
              description: colTxDesc,
              tx_type: 'in',
              amount: calc.invAmt,
              currency: bankRec?.currency || 'TRY',
              exchange_rate: 1,
              is_transfer: true,
              status: 'completed',
              transfer_id: colTransferKey
            }])
            await recalculateAbsoluteBankBalance(colSourceId)
          } else if (colSourceType === 'cash') {
            const cashRec = cashes.find(c => c.id === colSourceId)
            await supabase.from('cash_transactions').insert([{
              cash_register_id: colSourceId,
              company_id: finalCompId,
              tx_date: settleJobDate,
              description: colTxDesc,
              tx_type: 'in',
              amount: calc.invAmt,
              currency: cashRec?.currency || 'TRY',
              exchange_rate: 1,
              is_transfer: true,
              transfer_id: colTransferKey
            }])
            await recalculateAbsoluteCashBalance(colSourceId)
          }
        }

        await logActivity('partner_settlement', 'UPDATE', `Hakediş hesaplaşması güncellendi: ${payload.job_title}`, editingSettlement.id, calc.partnerPayout, 'TRY', editingSettlement, payload, finalCompId)
        toast.success('Hakediş kaydı güncellendi.')
      } else {
        const newId = crypto.randomUUID()
        const newRecord: PartnerSettlement = {
          id: newId,
          ...payload,
          created_at: new Date().toISOString()
        }

        // Stok Çıkışlarını Yap
        if (deductFromInventory && settleItems.length > 0) {
          const stockInserts = settleItems.filter(it => it.stock_id).map(it => ({
            stock_id: it.stock_id,
            company_id: finalCompId,
            tx_date: settleJobDate,
            description: `[PARTNER-SETTLE:${newId}] 🤝 Çözüm Ortağı Malzemesi (${settleJobTitle.trim()}) - ${it.name}`,
            tx_type: 'out',
            quantity: it.quantity,
            unit_price: it.unit_price,
            currency: 'TRY',
            vat_rate: 0
          }))
          if (stockInserts.length > 0) {
            await supabase.from('stock_transactions').insert(stockInserts)
            for (const it of settleItems) {
              if (it.stock_id) {
                await recalculateAbsoluteStock(it.stock_id)
              }
            }
          }
        }

        let { error } = await supabase.from('partner_settlements').insert([newRecord])
        if (error && (error.code === 'PGRST204' || error.message?.includes('items_breakdown'))) {
          // Veritabanında items_breakdown kolonu henüz eklenmemişse kolonsuz kaydetmeyi dene:
          const { items_breakdown, ...withoutItems } = newRecord as any
          const retry = await supabase.from('partner_settlements').insert([withoutItems])
          if (!retry.error) {
            error = null
          }
        }
        if (error) {
          console.error('Settlement insert error:', error)
          if (error.code === '42501' || error.message?.toLowerCase().includes('row-level security') || error.message?.toLowerCase().includes('violates')) {
            setIsRlsRestricted(true)
            toast.error('Supabase RLS kuralı nedeniyle hakediş veritabanına yazılamadı! Lütfen sarı başlıktaki izin kodunu çalıştırın.', { duration: 8000 })
          } else {
            toast.error('Veritabanı hatası: ' + error.message)
          }
          const updated = [newRecord, ...settlements]
          setSettlements(updated)
          localStorage.setItem('ctc_partner_settlements_cache', JSON.stringify(updated))
          setIsSettlementModalOpen(false)
          return
        }

        // Eğer tahsilat durumu 'collected' ve bir banka/kasa hesabı seçilmişse, para girişini oluştur
        if (settleCollectionStatus === 'collected' && colSourceType !== 'none' && colSourceId) {
          const colTransferKey = `PARTNER-COL-${newId}`
          const colTxDesc = `🤝 Müşteri Fatura Tahsilatı: ${settleJobTitle.trim()}${settleCustomerName ? ` (${settleCustomerName.trim()})` : ''}${settleInvoiceNo ? ` [Fat: #${settleInvoiceNo.trim()}]` : ''}`.trim()
          if (colSourceType === 'bank') {
            const bankRec = banks.find(b => b.id === colSourceId)
            await supabase.from('bank_transactions').insert([{
              bank_account_id: colSourceId,
              company_id: finalCompId,
              tx_date: settleJobDate,
              description: colTxDesc,
              tx_type: 'in',
              amount: calc.invAmt,
              currency: bankRec?.currency || 'TRY',
              exchange_rate: 1,
              is_transfer: true,
              status: 'completed',
              transfer_id: colTransferKey
            }])
            await recalculateAbsoluteBankBalance(colSourceId)
          } else if (colSourceType === 'cash') {
            const cashRec = cashes.find(c => c.id === colSourceId)
            await supabase.from('cash_transactions').insert([{
              cash_register_id: colSourceId,
              company_id: finalCompId,
              tx_date: settleJobDate,
              description: colTxDesc,
              tx_type: 'in',
              amount: calc.invAmt,
              currency: cashRec?.currency || 'TRY',
              exchange_rate: 1,
              is_transfer: true,
              transfer_id: colTransferKey
            }])
            await recalculateAbsoluteCashBalance(colSourceId)
          }
        }

        await logActivity('partner_settlement', 'INSERT', `Yeni hakediş hesaplaşması: ${payload.job_title} (Net: ${calc.partnerPayout} ₺)`, newId, calc.partnerPayout, 'TRY', null, newRecord, finalCompId)
        toast.success('Hakediş hesaplaşması başarıyla kaydedildi.')
      }

      await recalculateAbsolutePartnerBalance(settlePartnerId)
      await fetchStocks()
      await fetchPaymentSources()
      setIsSettlementModalOpen(false)
      fetchSettlements()
      fetchPartners()
    } catch (err: any) {
      toast.error('Hata oluştu: ' + err.message)
    }
  }

  function handleCollectionButtonClick(s: PartnerSettlement) {
    if (s.collection_status === 'pending') {
      handleOpenCollectionModal(s)
    } else {
      setConfirmDialog({
        isOpen: true,
        title: 'Tahsilat Durumunu Geri Al',
        message: `"${s.job_title}" işinin tahsilat durumunu 'Tahsilat Bekliyor' olarak değiştirmek istiyor musunuz? Varsa bu faturaya bağlı banka/kasa para girişi de hesaptan kaldırılacaktır.`,
        confirmText: 'Evet, Geri Al',
        cancelText: 'Vazgeç',
        isDanger: false,
        onConfirm: async () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }))
          await handleRevertCollection(s)
        }
      })
    }
  }

  function handleOpenCollectionModal(s: PartnerSettlement) {
    setCollectionSettlement(s)
    setCollectionDate(getLocalTodayISO())
    setCollectionSource(
      s.collection_source_type && s.collection_source_id && s.collection_source_type !== 'none'
        ? `${s.collection_source_type}|${s.collection_source_id}`
        : 'none'
    )
    setIsCollectionModalOpen(true)
  }

  async function handleRevertCollection(s: PartnerSettlement) {
    const colTransferKey = `PARTNER-COL-${s.id}`
    const { data: bTxs } = await supabase.from('bank_transactions').select('bank_account_id').eq('transfer_id', colTransferKey)
    const { data: cTxs } = await supabase.from('cash_transactions').select('cash_register_id').eq('transfer_id', colTransferKey)

    await supabase.from('bank_transactions').delete().eq('transfer_id', colTransferKey)
    await supabase.from('cash_transactions').delete().eq('transfer_id', colTransferKey)

    if (bTxs) {
      for (const b of bTxs) {
        if (b.bank_account_id) await recalculateAbsoluteBankBalance(b.bank_account_id)
      }
    }
    if (cTxs) {
      for (const c of cTxs) {
        if (c.cash_register_id) await recalculateAbsoluteCashBalance(c.cash_register_id)
      }
    }

    const updatePayload = {
      collection_status: 'pending' as const,
      collection_source_type: 'none' as const,
      collection_source_id: null,
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase.from('partner_settlements').update(updatePayload).eq('id', s.id)
    if (error) {
      console.warn('Revert collection status warning:', error)
    }

    const updated = settlements.map(item => item.id === s.id ? { ...item, ...updatePayload } : item)
    setSettlements(updated)
    localStorage.setItem('ctc_partner_settlements_cache', JSON.stringify(updated))

    await logActivity('partner_settlement', 'UPDATE', `Müşteri tahsilat durumu geri alındı: ${s.job_title}`, s.id, s.invoice_amount, 'TRY', s, updatePayload, s.company_id)

    toast('Tahsilat durumu bekliyor olarak güncellendi ve hesap hareketi kaldırıldı.', { icon: '⏳' })
    fetchSettlements()
    fetchPaymentSources()
  }

  async function handleExecuteCollection(e: React.FormEvent) {
    e.preventDefault()
    if (!collectionSettlement) return

    const s = collectionSettlement
    const invAmt = Number(s.invoice_amount) || 0
    const finalCompId = s.company_id || (isRestricted && companies.length > 0 ? companies[0].id : null)
    const colTransferKey = `PARTNER-COL-${s.id}`

    let sourceType: 'bank' | 'cash' | 'none' = 'none'
    let sourceId: string | null = null

    if (collectionSource && collectionSource !== 'none') {
      const parts = collectionSource.split('|')
      sourceType = parts[0] as 'bank' | 'cash'
      sourceId = parts[1]
    }

    try {
      // Önceki transfer hareketlerini temizle (mükerrerliği önlemek için)
      const { data: oldBTxs } = await supabase.from('bank_transactions').select('bank_account_id').eq('transfer_id', colTransferKey)
      const { data: oldCTxs } = await supabase.from('cash_transactions').select('cash_register_id').eq('transfer_id', colTransferKey)
      await supabase.from('bank_transactions').delete().eq('transfer_id', colTransferKey)
      await supabase.from('cash_transactions').delete().eq('transfer_id', colTransferKey)

      if (oldBTxs) {
        for (const b of oldBTxs) {
          if (b.bank_account_id && b.bank_account_id !== sourceId) await recalculateAbsoluteBankBalance(b.bank_account_id)
        }
      }
      if (oldCTxs) {
        for (const c of oldCTxs) {
          if (c.cash_register_id && c.cash_register_id !== sourceId) await recalculateAbsoluteCashBalance(c.cash_register_id)
        }
      }

      const colTxDesc = `🤝 Müşteri Fatura Tahsilatı: ${s.job_title}${s.customer_name ? ` (${s.customer_name})` : ''}${s.invoice_no ? ` [Fat: #${s.invoice_no}]` : ''}`.trim()

      if (sourceType === 'bank' && sourceId) {
        const bankRec = banks.find(b => b.id === sourceId)
        await supabase.from('bank_transactions').insert([{
          bank_account_id: sourceId,
          company_id: finalCompId,
          tx_date: collectionDate,
          description: colTxDesc,
          tx_type: 'in',
          amount: invAmt,
          currency: bankRec?.currency || 'TRY',
          exchange_rate: 1,
          is_transfer: true,
          status: 'completed',
          transfer_id: colTransferKey
        }])
        await recalculateAbsoluteBankBalance(sourceId)
      } else if (sourceType === 'cash' && sourceId) {
        const cashRec = cashes.find(c => c.id === sourceId)
        await supabase.from('cash_transactions').insert([{
          cash_register_id: sourceId,
          company_id: finalCompId,
          tx_date: collectionDate,
          description: colTxDesc,
          tx_type: 'in',
          amount: invAmt,
          currency: cashRec?.currency || 'TRY',
          exchange_rate: 1,
          is_transfer: true,
          transfer_id: colTransferKey
        }])
        await recalculateAbsoluteCashBalance(sourceId)
      }

      // Hakediş kaydını güncelle
      const updatePayload = {
        collection_status: 'collected' as const,
        collection_source_type: sourceType,
        collection_source_id: sourceId,
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase.from('partner_settlements').update(updatePayload).eq('id', s.id)
      if (error) {
        console.warn('Settlement collection update error:', error)
      }

      const updated = settlements.map(item => item.id === s.id ? { ...item, ...updatePayload } : item)
      setSettlements(updated)
      localStorage.setItem('ctc_partner_settlements_cache', JSON.stringify(updated))

      await logActivity('partner_settlement', 'UPDATE', `Müşteri faturası tahsil edildi: ${s.job_title} (${formatMoney(invAmt, 'TRY').formatted})`, s.id, invAmt, 'TRY', s, updatePayload, finalCompId)

      toast.success(
        sourceType !== 'none'
          ? 'Müşteri faturası tahsil edildi ve seçilen hesaba para girişi kaydedildi! 💰'
          : 'Müşteri faturası tahsil edildi olarak işaretlendi! ✅'
      )

      setIsCollectionModalOpen(false)
      fetchSettlements()
      fetchPaymentSources()
    } catch (err: any) {
      toast.error('Tahsilat işlemi sırasında hata oluştu: ' + err.message)
    }
  }

  function handleDeleteSettlement(s: PartnerSettlement) {
    setConfirmDialog({
      isOpen: true,
      title: 'Hakediş Kaydını Sil',
      message: `"${s.job_title}" işine ait hakediş kaydını silmek istediğinize emin misiniz? Ortağın bakiyesi bu tutar kadar azalacak, depodan düşülen malzemeler stoğa iade edilecek ve varsa banka/kasaya işlenmiş fatura tahsilatı kaldırılacaktır.`,
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))

        // 1. Varsa bu faturaya bağlı banka / kasa tahsilat hareketlerini temizle
        const colTransferId = `PARTNER-COL-${s.id}`
        const { data: bTxs } = await supabase.from('bank_transactions').select('id, bank_account_id').eq('transfer_id', colTransferId)
        if (bTxs && bTxs.length > 0) {
          await supabase.from('bank_transactions').delete().eq('transfer_id', colTransferId)
          for (const bt of bTxs) {
            if (bt.bank_account_id) await recalculateAbsoluteBankBalance(bt.bank_account_id)
          }
        }
        const { data: cTxs } = await supabase.from('cash_transactions').select('id, cash_register_id').eq('transfer_id', colTransferId)
        if (cTxs && cTxs.length > 0) {
          await supabase.from('cash_transactions').delete().eq('transfer_id', colTransferId)
          for (const ct of cTxs) {
            if (ct.cash_register_id) await recalculateAbsoluteCashBalance(ct.cash_register_id)
          }
        }

        // 2. İlgili stock_transactions temizliği ve stok mutlak iadesi
        const { data: oldStockTxs } = await supabase
          .from('stock_transactions')
          .select('id, stock_id')
          .like('description', `%[PARTNER-SETTLE:${s.id}]%`)

        if (oldStockTxs && oldStockTxs.length > 0) {
          const affected = new Set(oldStockTxs.map(t => t.stock_id))
          await supabase.from('stock_transactions').delete().in('id', oldStockTxs.map(t => t.id))
          for (const sId of Array.from(affected)) {
            await recalculateAbsoluteStock(sId)
          }
          await fetchStocks()
        }

        const { error } = await supabase.from('partner_settlements').delete().eq('id', s.id)
        if (error) {
          const updated = settlements.filter(item => item.id !== s.id)
          setSettlements(updated)
          localStorage.setItem('ctc_partner_settlements_cache', JSON.stringify(updated))
        }
        await logActivity('partner_settlement', 'DELETE', `Hakediş silindi: ${s.job_title}`, s.id, s.partner_payout, 'TRY', s, null, s.company_id)
        await recalculateAbsolutePartnerBalance(s.partner_id)
        toast.success('Hakediş kaydı ve kullanılan stoklar iade edilerek silindi.')
        fetchSettlements()
        fetchPartners()
        fetchPaymentSources()
      }
    })
  }


  // ==============================================================================
  // HAKEDİŞ ÖDEMESİ YAPMA (KASA / BANKA ÇIKIŞI)
  // ==============================================================================
  function openPayoutModal(partnerId?: string, settlement?: PartnerSettlement) {
    const targetPid = partnerId || selectedPartnerId || (partners[0]?.id || '')
    const targetPartner = partners.find(p => p.id === targetPid)
    if (!targetPartner) {
      toast.error('Lütfen bir çözüm ortağı seçin.')
      return
    }

    setPayoutPartnerId(targetPid)
    if (settlement) {
      setPayoutSettlementId(settlement.id)
      setPayoutAmount(settlement.remaining_payout > 0 ? settlement.remaining_payout.toString() : settlement.partner_payout.toString())
      setPayoutDescription(`Hakediş Ödemesi: ${settlement.job_title}`)
    } else {
      setPayoutSettlementId('')
      setPayoutAmount(targetPartner.balance > 0 ? targetPartner.balance.toString() : '')
      setPayoutDescription(`Çözüm Ortağı Hakediş Ödemesi - ${targetPartner.name}`)
    }
    setPayoutDate(getLocalTodayISO())
    setPayoutSource('')
    setIsPayoutModalOpen(true)
  }

  async function handleExecutePayout(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(payoutAmount)
    if (!amt || amt <= 0) {
      toast.error('Lütfen geçerli bir ödeme tutarı girin.')
      return
    }
    if (!payoutSource) {
      toast.error('Lütfen ödemenin çıkacağı Kasa veya Banka Hesabını seçin.')
      return
    }

    const partner = partners.find(p => p.id === payoutPartnerId)
    if (!partner) return

    const parts = payoutSource.split('|')
    const sourceType = parts[0] as 'bank' | 'cash'
    const sourceId = parts[1]
    const payoutTxId = crypto.randomUUID()
    const transferKey = `PARTNER-PAY-${payoutTxId}`
    const finalCompId = partner.company_id || (isRestricted && companies.length > 0 ? companies[0].id : null)

    try {
      // 1. Partner Transaction tablosuna yaz
      const partnerTx: PartnerTransaction = {
        id: payoutTxId,
        partner_id: payoutPartnerId,
        settlement_id: payoutSettlementId || null,
        tx_type: 'payment',
        amount: amt,
        tx_date: payoutDate,
        payment_source_type: sourceType,
        payment_source_id: sourceId,
        transfer_id: transferKey,
        description: payoutDescription.trim() || `Hakediş Ödemesi: ${partner.name}`,
        created_at: new Date().toISOString()
      }

      const { error: txErr } = await supabase.from('partner_transactions').insert([partnerTx])
      if (txErr) {
        console.error('Partner transaction error:', txErr)
        if (txErr.code === '42501' || txErr.message?.toLowerCase().includes('row-level security') || txErr.message?.toLowerCase().includes('violates')) {
          setIsRlsRestricted(true)
          toast.error('Supabase RLS kuralı nedeniyle ödeme hareketi veritabanına yazılamadı! Lütfen izin kodunu çalıştırın.', { duration: 8000 })
        }
        const updatedTxs = [partnerTx, ...transactions]
        setTransactions(updatedTxs)
        localStorage.setItem('ctc_partner_txs_cache', JSON.stringify(updatedTxs))
      }

      // 2. Kasa veya Banka Hesabından Parayı Düş
      if (sourceType === 'cash') {
        const cashRec = cashes.find(c => c.id === sourceId)
        await supabase.from('cash_transactions').insert([{
          cash_register_id: sourceId,
          company_id: finalCompId,
          tx_date: payoutDate,
          description: `🤝 Çözüm Ortağı Hakedişi: ${partner.name} (${partnerTx.description})`,
          tx_type: 'out',
          amount: amt,
          currency: cashRec?.currency || 'TRY',
          exchange_rate: 1,
          is_transfer: true,
          transfer_id: transferKey
        }])
        await recalculateAbsoluteCashBalance(sourceId)
      } else if (sourceType === 'bank') {
        const bankRec = banks.find(b => b.id === sourceId)
        await supabase.from('bank_transactions').insert([{
          bank_account_id: sourceId,
          company_id: finalCompId,
          tx_date: payoutDate,
          description: `🤝 Çözüm Ortağı Hakedişi: ${partner.name} (${partnerTx.description})`,
          tx_type: 'out',
          amount: amt,
          currency: bankRec?.currency || 'TRY',
          exchange_rate: 1,
          is_transfer: true,
          status: 'completed',
          transfer_id: transferKey
        }])
        await recalculateAbsoluteBankBalance(sourceId)
      }

      // 3. Varsa ilgili hakediş kaydındaki paid_amount güncelle
      if (payoutSettlementId) {
        const st = settlements.find(s => s.id === payoutSettlementId)
        if (st) {
          const newPaid = (st.paid_amount || 0) + amt
          const newRem = Math.max(0, st.partner_payout - newPaid)
          const newStatus: 'unpaid' | 'partial' | 'paid' = newRem === 0 ? 'paid' : 'partial'
          await supabase.from('partner_settlements').update({
            paid_amount: newPaid,
            remaining_payout: newRem,
            payout_status: newStatus
          }).eq('id', st.id)
        }
      }

      // 4. Partner Bakiyesini Mutlak Olarak Yeniden Hesapla
      await recalculateAbsolutePartnerBalance(payoutPartnerId)
      await logActivity('partner_tx', 'INSERT', `Hakediş ödendi: ${partner.name} - ${formatMoney(amt, 'TRY').formatted}`, payoutTxId, amt, 'TRY', null, partnerTx, finalCompId)

      toast.success('Ödeme başarıyla gerçekleştirildi ve hesap bakiyesi güncellendi.')
      setIsPayoutModalOpen(false)
      fetchPartners()
      fetchSettlements()
      fetchTransactions()
      fetchPaymentSources()
    } catch (err: any) {
      toast.error('Ödeme işlemi sırasında hata: ' + err.message)
    }
  }

  // ==============================================================================
  // HESAPLAŞMA PUSULASI & WHATSAPP METNİ
  // ==============================================================================
  function openPrintModal(s: PartnerSettlement) {
    setPrintSettlement(s)
    setIsPrintModalOpen(true)
  }

  function copyWhatsAppText(s: PartnerSettlement) {
    const partner = partners.find(p => p.id === s.partner_id)
    const itemsText = s.items_breakdown && s.items_breakdown.length > 0
      ? `\n📦 *Kullanılan Mağaza Malzemeleri:*\n` + s.items_breakdown.map(it => `  • ${it.quantity}x ${it.name} (${formatMoney(it.total, 'TRY').formatted})`).join('\n') + `\n`
      : ''

    const text = `🤝 *İŞ HESAPLAŞMA PUSULASI*
----------------------------------------
📌 *İş:* ${s.job_title}
📅 *Tarih:* ${formatDateTR(s.job_date)}
👤 *Çözüm Ortağı:* ${partner?.name || '-'}
🏢 *Müşteri:* ${s.customer_name || '-'}
📄 *Fatura No:* ${s.invoice_no || '-'}

💰 *Fatura / Tahsilat Tutarı:* ${formatMoney(s.invoice_amount, 'TRY').formatted}
(-) Mağaza Malzemeleri: ${formatMoney(s.material_cost_shop, 'TRY').formatted}${itemsText}
(-) Dış Alış Malzemeleri: ${formatMoney(s.material_cost_external, 'TRY').formatted}
(-) KDV / Vergi Payı (%${s.tax_rate}): ${formatMoney(s.tax_amount, 'TRY').formatted}
(-) Servis / Şirket Payı: ${formatMoney(s.shop_profit_share, 'TRY').formatted}
${s.other_expenses > 0 ? `(-) Diğer Masraflar: ${formatMoney(s.other_expenses, 'TRY').formatted}\n` : ''}----------------------------------------
👉 *NET HAKEDİŞİNİZ:* *${formatMoney(s.partner_payout, 'TRY').formatted}*
💵 *Ödenen Tutar:* ${formatMoney(s.paid_amount, 'TRY').formatted}
⏳ *Kalan Hakediş:* *${formatMoney(s.remaining_payout, 'TRY').formatted}*
----------------------------------------
CTC Master Ledger Mutabakat Bilgisidir.`

    navigator.clipboard.writeText(text)
    toast.success('Pusula metni panoya kopyalandı! WhatsApp\'a yapıştırabilirsiniz.')
  }

  function handlePrint() {
    window.print()
  }

  function copyMigrationSql() {
    const sql = `-- CTC Master Ledger - Çözüm Ortakları Tabloları
CREATE TABLE IF NOT EXISTS public.partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    default_tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
    default_commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.partner_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    job_title TEXT NOT NULL,
    job_date DATE NOT NULL,
    job_type TEXT NOT NULL DEFAULT 'project',
    customer_name TEXT,
    invoice_no TEXT,
    invoice_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    collection_status TEXT NOT NULL DEFAULT 'collected',
    collection_source_type TEXT,
    collection_source_id UUID,
    material_cost_shop NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    material_cost_external NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
    tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    shop_profit_share NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    other_expenses NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    partner_payout NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    payout_status TEXT NOT NULL DEFAULT 'unpaid',
    paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    remaining_payout NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    items_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.partner_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
    settlement_id UUID REFERENCES public.partner_settlements(id) ON DELETE SET NULL,
    tx_type TEXT NOT NULL DEFAULT 'payment',
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    tx_date DATE NOT NULL,
    payment_source_type TEXT,
    payment_source_id UUID,
    transfer_id TEXT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partners_all_access" ON public.partners;
CREATE POLICY "partners_all_access" ON public.partners FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.partner_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_settlements_all_access" ON public.partner_settlements;
CREATE POLICY "partner_settlements_all_access" ON public.partner_settlements FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.partner_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_transactions_all_access" ON public.partner_transactions;
CREATE POLICY "partner_transactions_all_access" ON public.partner_transactions FOR ALL USING (true) WITH CHECK (true);`

    navigator.clipboard.writeText(sql)
    toast.success('SQL panoya kopyalandı! Supabase SQL Editor alanında çalıştırabilirsiniz.')
  }

  function copyRlsSql() {
    const sql = `-- CTC Master Ledger - Çözüm Ortakları RLS Güvenlik İzinleri
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partners_all_access" ON public.partners;
CREATE POLICY "partners_all_access" ON public.partners FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.partner_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_settlements_all_access" ON public.partner_settlements;
CREATE POLICY "partner_settlements_all_access" ON public.partner_settlements FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.partner_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_transactions_all_access" ON public.partner_transactions;
CREATE POLICY "partner_transactions_all_access" ON public.partner_transactions FOR ALL USING (true) WITH CHECK (true);`

    navigator.clipboard.writeText(sql)
    toast.success('RLS izin kodu panoya kopyalandı! Supabase SQL Editor alanında çalıştırabilirsiniz.')
  }


  // ==============================================================================
  // HESAPLANAN ÖZETLER
  // ==============================================================================
  const filteredPartners = useMemo(() => {
    return partners.filter(p => {
      const matchComp = companyFilter === 'all' || p.company_id === companyFilter
      const matchSearch = p.name.toLocaleLowerCase('tr-TR').includes(searchTerm.toLocaleLowerCase('tr-TR')) ||
                          (p.phone && p.phone.includes(searchTerm))
      return matchComp && matchSearch
    })
  }, [partners, companyFilter, searchTerm])

  const selectedPartner = useMemo(() => {
    return partners.find(p => p.id === selectedPartnerId) || filteredPartners[0] || null
  }, [partners, selectedPartnerId, filteredPartners])

  const partnerSettlements = useMemo(() => {
    if (!selectedPartner) return []
    return settlements.filter(s => s.partner_id === selectedPartner.id)
  }, [settlements, selectedPartner])

  const partnerTransactions = useMemo(() => {
    if (!selectedPartner) return []
    return transactions.filter(t => t.partner_id === selectedPartner.id)
  }, [transactions, selectedPartner])

  // Genel İstatistikler
  const totalVolume = useMemo(() => settlements.reduce((sum, s) => sum + (Number(s.invoice_amount) || 0), 0), [settlements])
  const totalPartnerPayout = useMemo(() => settlements.reduce((sum, s) => sum + (Number(s.partner_payout) || 0), 0), [settlements])
  const totalShopEarnings = useMemo(() => {
    return settlements.reduce((sum, s) => {
      return sum + (Number(s.material_cost_shop) || 0) + (Number(s.shop_profit_share) || 0) + (Number(s.tax_amount) || 0)
    }, 0)
  }, [settlements])
  const totalPendingDebt = useMemo(() => partners.reduce((sum, p) => sum + (Number(p.balance) || 0), 0), [partners])

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] bg-[#070b14] text-slate-100 overflow-hidden font-sans">
      <Toaster position="top-right" />

      {/* VERİTABANI TABLOSU EKSİK UYARISI BANNERI */}
      {isTableMissing && (
        <div className="bg-amber-950/60 border-b border-amber-500/50 px-4 py-2.5 flex items-center justify-between text-xs text-amber-300 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-400 shrink-0 animate-pulse" />
            <span>
              <strong>Veritabanı Tablosu Hazır:</strong> Supabase SQL Editor&apos;da <code className="bg-amber-900/60 px-1 py-0.5 rounded font-mono text-amber-200">supabase/partners.sql</code> dosyasını bir defa çalıştırarak kalıcı hale getirebilirsiniz. (Geçici olarak veriler tarayıcıda çalışır).
            </span>
          </div>
          <button 
            onClick={copyMigrationSql}
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors shadow text-xs cursor-pointer active:scale-95 shrink-0"
          >
            <Copy size={12} /> SQL&apos;i Kopyala
          </button>
        </div>
      )}

      {/* RLS GÜVENLİK İZNİ EKSİK UYARISI BANNERI */}
      {isRlsRestricted && !isTableMissing && (
        <div className="bg-amber-950/70 border-b border-amber-500/60 px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-200 shrink-0 shadow-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400 shrink-0 animate-bounce" />
            <span>
              <strong>Veritabanı İzni (RLS) Gerekli:</strong> Supabase güvenlik kuralları (Row Level Security) gereği ortak kayıtları doğrudan veritabanına yazılamadı (geçici olarak tarayıcıda tutuluyor). Kalıcı olması için izin kodunu Supabase SQL Editor&apos;de çalıştırınız.
            </span>
          </div>
          <button 
            onClick={copyRlsSql}
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-all shadow text-xs cursor-pointer active:scale-95 shrink-0 self-start sm:self-auto"
          >
            <Copy size={13} /> İzin Kodunu Kopyala
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* --- ÜST BAŞLIK VE GENEL KPI KARTLARI --- */}
      {/* ========================================================================= */}
      <div className="p-3 sm:p-4 border-b border-slate-800 bg-[#0a0f1d] shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 rounded-xl shadow-inner">
              <Handshake size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-white tracking-wide">Çözüm Ortakları & Hakediş</h1>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-indigo-950 text-indigo-300 border border-indigo-800/60">
                  {partners.length} Ortak
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Dış işler, taşeronluk, fatura kesimi, malzeme düşümü ve net hakediş hesaplaşma yönetimi
              </p>
            </div>
          </div>

          {/* KPI İstatistik Şeridi */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="bg-[#060a12] border border-slate-800/80 px-3 py-1.5 rounded-xl">
              <span className="text-[9px] text-slate-500 uppercase font-bold block">Toplam Fatura Hacmi</span>
              <span className="text-xs sm:text-sm font-mono font-bold text-slate-200">
                {formatMoney(totalVolume, 'TRY').formatted}
              </span>
            </div>

            <div className="bg-[#060a12] border border-emerald-900/40 px-3 py-1.5 rounded-xl">
              <span className="text-[9px] text-emerald-400/80 uppercase font-bold block">Mağaza Kazancı / Malzeme</span>
              <span className="text-xs sm:text-sm font-mono font-bold text-emerald-400">
                {formatMoney(totalShopEarnings, 'TRY').formatted}
              </span>
            </div>

            <div className="bg-[#060a12] border border-rose-900/40 px-3 py-1.5 rounded-xl">
              <span className="text-[9px] text-rose-400/80 uppercase font-bold block">Toplam Hakediş Borcumuz</span>
              <span className="text-xs sm:text-sm font-mono font-black text-rose-400">
                {formatMoney(totalPendingDebt, 'TRY').formatted}
              </span>
            </div>

            <button
              onClick={openAddPartnerModal}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-950/50 flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Plus size={15} /> Yeni Ortak Ekle
            </button>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* --- ANA GÖVDE: SOLDA ORTAKLAR LİSTESİ, SAĞDA HAKEDİŞ DETAYLARI --- */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden p-3 gap-3">
        
        {/* SOL PANEL: ÇÖZÜM ORTAKLARI LİSTESİ */}
        <div className="w-full md:w-80 lg:w-96 flex flex-col bg-[#0d1322] border border-slate-800/80 rounded-xl overflow-hidden shrink-0 shadow-lg">
          
          {/* Arama ve Şirket Filtresi */}
          <div className="p-2.5 border-b border-slate-800/80 bg-[#0a0f1d] space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Çözüm ortağı ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#070b14] border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                  <X size={12} />
                </button>
              )}
            </div>

            {companies.length > 1 && !isRestricted && (
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 focus:outline-none"
              >
                <option value="all">Tüm Merkezler</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>

          {/* Ortaklar Listesi */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
            {filteredPartners.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 text-xs">
                <Handshake size={32} className="mb-2 opacity-30 text-indigo-400" />
                <p className="font-semibold">Kayıtlı ortak bulunamadı.</p>
                <p className="text-[10px] text-slate-600 mt-1">Yukarıdaki butondan yeni ortak ekleyebilirsiniz.</p>
              </div>
            ) : (
              filteredPartners.map((p) => {
                const isSelected = selectedPartner?.id === p.id
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPartnerId(p.id)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500 shadow-md ring-1 ring-indigo-500/30'
                        : 'bg-[#070b14] border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-white truncate">{p.name}</span>
                        {p.company && (
                          <span className="text-[8px] px-1 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/40 shrink-0">
                            {p.company.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                        {p.phone && <span className="flex items-center gap-0.5"><Phone size={9} /> {formatPhoneNumber(p.phone)}</span>}
                        {p.email && <span>• {p.email}</span>}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className={`text-xs font-mono font-black ${p.balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {formatMoney(p.balance, 'TRY').formatted}
                      </div>
                      <span className="text-[8px] uppercase tracking-wider text-slate-500">
                        {p.balance > 0 ? 'Ödenecek' : 'Bakiye Sıfır'}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

        </div>

        {/* SAĞ PANEL: SEÇİLİ ORTAK DETAYI & HAKEDİŞ İŞLEMLERİ */}
        <div className="flex-1 flex flex-col bg-[#0d1322] border border-slate-800/80 rounded-xl overflow-hidden min-w-0 shadow-lg">
          
          {selectedPartner ? (
            <>
              {/* Ortak Profil Başlık Bandı */}
              <div className="p-3 bg-[#0a0f1d] border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-900 text-white flex items-center justify-center font-black text-sm shadow-md">
                    {selectedPartner.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm sm:text-base font-bold text-white">{selectedPartner.name}</h2>
                      <button 
                        onClick={() => openEditPartnerModal(selectedPartner)}
                        className="text-slate-400 hover:text-amber-400 transition-colors p-1"
                        title="Ortağı Düzenle"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button 
                        onClick={() => handleDeletePartner(selectedPartner.id)}
                        className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                        title="Ortağı Sil"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                      {selectedPartner.phone && <span>📞 {formatPhoneNumber(selectedPartner.phone)}</span>}
                      {selectedPartner.email && <span>✉️ {selectedPartner.email}</span>}
                      {selectedPartner.company && <span>🏢 {selectedPartner.company.name}</span>}
                    </div>
                  </div>
                </div>

                {/* Sağ: Bakiye Kartı ve Hızlı İşlem Butonları */}
                <div className="flex items-center gap-2.5 self-end sm:self-auto">
                  <div className="bg-[#070b14] border border-slate-800 px-3 py-1.5 rounded-xl text-right">
                    <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">Güncel Hakediş Alacağı</span>
                    <span className={`text-base font-mono font-black ${selectedPartner.balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {formatMoney(selectedPartner.balance, 'TRY').formatted}
                    </span>
                  </div>

                  <button
                    onClick={() => openAddSettlementModal(selectedPartner.id)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-950/40 flex items-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <Plus size={14} /> Yeni Hakediş Ekle
                  </button>

                  <button
                    onClick={() => openPayoutModal(selectedPartner.id)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-950/40 flex items-center gap-1.5 active:scale-95 cursor-pointer"
                  >
                    <DollarSign size={14} /> Hakediş Öde
                  </button>
                </div>
              </div>

              {/* Sekmeler: Hakediş Kayıtları | Ödeme Geçmişi */}
              <div className="flex items-center gap-1 p-2 bg-[#080d19] border-b border-slate-800/80 text-xs font-semibold shrink-0">
                <button
                  onClick={() => setActiveTab('settlements')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'settlements'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <FileText size={13} />
                  <span>Hakediş & İş Hesaplaşmaları ({partnerSettlements.length})</span>
                </button>

                <button
                  onClick={() => setActiveTab('transactions')}
                  className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeTab === 'transactions'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Wallet size={13} />
                  <span>Kasa / Banka Ödemeleri ({partnerTransactions.length})</span>
                </button>
              </div>

              {/* SEKME 1: HAKEDİŞ KAYITLARI TABLOSU */}
              {activeTab === 'settlements' && (
                <div className="flex-1 overflow-auto custom-scrollbar p-2">
                  {partnerSettlements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
                      <FileText size={36} className="mb-2 opacity-30 text-indigo-400" />
                      <p className="text-xs font-semibold">Bu ortağa ait henüz kayıtlı iş / hakediş bulunmuyor.</p>
                      <button
                        onClick={() => openAddSettlementModal(selectedPartner.id)}
                        className="mt-3 text-xs bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-3 py-1.5 rounded-lg hover:bg-indigo-600/30 transition-colors"
                      >
                        + İlk Hakedişi Ekle
                      </button>
                    </div>
                  ) : (
                    <table className="w-full text-left text-[11px] relative">
                      <thead className="sticky top-0 bg-[#0a0f1d] z-10 border-b border-slate-800 text-slate-400 font-medium">
                        <tr>
                          <th className="p-2.5">Tarih</th>
                          <th className="p-2.5">İş / Proje & Müşteri</th>
                          <th className="p-2.5 text-right">Fatura Tutarı</th>
                          <th className="p-2.5 text-right text-amber-400">Düşülen Maliyetler</th>
                          <th className="p-2.5 text-right text-indigo-300 font-bold bg-indigo-950/20">Net Hakediş</th>
                          <th className="p-2.5 text-right text-emerald-400">Ödenen</th>
                          <th className="p-2.5 text-right text-rose-400">Kalan Borç</th>
                          <th className="p-2.5 text-center">Durum</th>
                          <th className="p-2.5 text-center w-28">İşlem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {partnerSettlements.map((s) => {
                          const totalDeducted = s.material_cost_shop + s.material_cost_external + s.tax_amount + s.shop_profit_share + s.other_expenses
                          return (
                            <tr key={s.id} className="hover:bg-slate-800/30 transition-colors font-mono">
                              <td className="p-2.5 text-slate-400 align-top">{formatDateTR(s.job_date)}</td>
                              
                              <td className="p-2.5 text-slate-200 font-sans align-top">
                                <div className="font-bold text-white">
                                  {s.job_title}
                                </div>
                                <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-2 mt-1">
                                  {s.customer_name && <span>Müşteri: <strong>{s.customer_name}</strong></span>}
                                  {s.invoice_no && <span>Fatura: #{s.invoice_no}</span>}
                                  
                                  {/* Müşteri Tahsilat Durumu & Hızlı Değiştirme Butonu */}
                                  <button
                                    type="button"
                                    onClick={() => handleCollectionButtonClick(s)}
                                    className={`inline-flex items-center gap-1.5 text-[9px] font-semibold px-2 py-0.5 rounded-md cursor-pointer transition select-none ${
                                      s.collection_status === 'collected'
                                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-700/50 hover:bg-emerald-900/60'
                                        : 'bg-amber-950/60 text-amber-300 border border-amber-600/60 hover:bg-amber-900/60 hover:border-amber-500 animate-pulse hover:animate-none'
                                    }`}
                                    title={s.collection_status === 'collected' ? "Fatura tahsil edildi (Durumu geri almak için tıklayın)" : "Müşteri ödediyse tıklayarak Banka/Kasaya para girişini kaydedin"}
                                  >
                                    {s.collection_status === 'collected' ? (
                                      <>
                                        <CheckCircle2 size={10} className="text-emerald-400 shrink-0" />
                                        <span>Fatura Tahsil Edildi</span>
                                        {s.collection_source_type === 'bank' && (
                                          <span className="text-[8px] bg-emerald-900/80 px-1 py-0.2 rounded text-emerald-200 font-mono">
                                            🏦 Banka
                                          </span>
                                        )}
                                        {s.collection_source_type === 'cash' && (
                                          <span className="text-[8px] bg-emerald-900/80 px-1 py-0.2 rounded text-emerald-200 font-mono">
                                            💵 Kasa
                                          </span>
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        <Clock size={10} className="text-amber-400 shrink-0" />
                                        <span>Tahsilat Bekliyor (Ödendi Yap ✓)</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </td>

                              <td className="p-2.5 text-right font-bold text-slate-200 align-top">
                                {formatMoney(s.invoice_amount, 'TRY').formatted}
                              </td>

                              <td className="p-2.5 text-right text-amber-400/90 align-top font-medium" title={`Mağaza: ${s.material_cost_shop}₺ | Dış: ${s.material_cost_external}₺ | Vergi (%${s.tax_rate}): ${s.tax_amount}₺ | Servis Payı: ${s.shop_profit_share}₺`}>
                                -{formatMoney(totalDeducted, 'TRY').formatted}
                              </td>

                              <td className="p-2.5 text-right font-black text-indigo-300 align-top bg-indigo-950/20">
                                {formatMoney(s.partner_payout, 'TRY').formatted}
                              </td>

                              <td className="p-2.5 text-right font-semibold text-emerald-400 align-top">
                                {formatMoney(s.paid_amount, 'TRY').formatted}
                              </td>

                              <td className="p-2.5 text-right font-bold text-rose-400 align-top">
                                {formatMoney(s.remaining_payout, 'TRY').formatted}
                              </td>

                              <td className="p-2.5 text-center align-top font-sans">
                                <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                  s.payout_status === 'paid'
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                    : s.payout_status === 'partial'
                                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                }`}>
                                  {s.payout_status === 'paid' ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                                  {s.payout_status === 'paid' ? 'Ödendi' : s.payout_status === 'partial' ? 'Kısmi Ödendi' : 'Ödenmedi'}
                                </span>
                              </td>

                              <td className="p-2.5 text-center align-top font-sans">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => openPrintModal(s)}
                                    className="p-1 text-slate-400 hover:text-indigo-400 transition-colors"
                                    title="Pusula / Makbuz Görüntüle & Yazdır"
                                  >
                                    <Printer size={13} />
                                  </button>
                                  <button
                                    onClick={() => copyWhatsAppText(s)}
                                    className="p-1 text-slate-400 hover:text-emerald-400 transition-colors"
                                    title="WhatsApp Metni Kopyala"
                                  >
                                    <Share2 size={13} />
                                  </button>
                                  {s.remaining_payout > 0 && (
                                    <button
                                      onClick={() => openPayoutModal(s.partner_id, s)}
                                      className="p-1 text-slate-400 hover:text-amber-400 transition-colors"
                                      title="Bu İşe Mahsuben Hızlı Öde"
                                    >
                                      <DollarSign size={13} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => openEditSettlementModal(s)}
                                    className="p-1 text-slate-400 hover:text-indigo-400 transition-colors"
                                    title="Düzenle"
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSettlement(s)}
                                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                                    title="Sil"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* SEKME 2: ÖDEME GEÇMİŞİ TABLOSU */}
              {activeTab === 'transactions' && (
                <div className="flex-1 overflow-auto custom-scrollbar p-2">
                  {partnerTransactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500">
                      <Wallet size={36} className="mb-2 opacity-30 text-emerald-400" />
                      <p className="text-xs font-semibold">Bu ortağa ait henüz bir ödeme çıkışı yapılmamış.</p>
                      <button
                        onClick={() => openPayoutModal(selectedPartner.id)}
                        className="mt-3 text-xs bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg hover:bg-emerald-600/30 transition-colors"
                      >
                        💸 Hakediş Ödemesi Yap
                      </button>
                    </div>
                  ) : (
                    <table className="w-full text-left text-[11px] relative">
                      <thead className="sticky top-0 bg-[#0a0f1d] z-10 border-b border-slate-800 text-slate-400 font-medium">
                        <tr>
                          <th className="p-2.5">Tarih</th>
                          <th className="p-2.5">Açıklama</th>
                          <th className="p-2.5">Ödeme Kaynağı (Kasa / Banka)</th>
                          <th className="p-2.5 text-right text-rose-400">Çıkan Tutar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {partnerTransactions.map((t) => {
                          const bankName = t.payment_source_type === 'bank' ? banks.find(b => b.id === t.payment_source_id)?.bank_name : null
                          const cashName = t.payment_source_type === 'cash' ? cashes.find(c => c.id === t.payment_source_id)?.name : null
                          return (
                            <tr key={t.id} className="hover:bg-slate-800/30 transition-colors font-mono">
                              <td className="p-2.5 text-slate-400 align-top">{formatDateTR(t.tx_date)}</td>
                              <td className="p-2.5 text-slate-200 font-sans align-top">
                                <div className="font-medium text-white">{t.description}</div>
                                {t.transfer_id && <span className="text-[9px] text-slate-500 font-mono">{t.transfer_id}</span>}
                              </td>
                              <td className="p-2.5 text-slate-300 font-sans align-top">
                                {t.payment_source_type === 'bank' ? (
                                  <span className="flex items-center gap-1 text-blue-400">
                                    <Landmark size={12} /> {bankName || 'Banka Hesabı'}
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-emerald-400">
                                    <Wallet size={12} /> {cashName || 'Nakit Kasa'}
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-right font-black text-rose-400 align-top">
                                -{formatMoney(t.amount, 'TRY').formatted}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500">
              <Handshake size={48} className="mb-3 opacity-20 text-indigo-400 animate-pulse" />
              <p className="text-sm font-bold text-slate-400">Lütfen soldan bir çözüm ortağı seçin</p>
              <p className="text-xs text-slate-500 mt-1">veya yeni bir ortak kartı oluşturarak başlayın.</p>
            </div>
          )}

        </div>

      </div>

      {/* ========================================================================= */}
      {/* --- MODAL 1: YENİ ORTAK EKLE / DÜZENLE --- */}
      {/* ========================================================================= */}
      {isPartnerModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 99999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
            
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                  <Handshake size={18} />
                </div>
                <h3 className="text-sm font-bold text-white">
                  {editingPartner ? 'Çözüm Ortağını Düzenle' : 'Yeni Çözüm Ortağı Tanımla'}
                </h3>
              </div>
              <button onClick={() => setIsPartnerModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSavePartner} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Ortak / Usta Adı Soyadı *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Ahmet Durmaz, Usta Mehmet..."
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Telefon</label>
                  <input
                    type="text"
                    placeholder="0532..."
                    value={partnerPhone}
                    onChange={(e) => setPartnerPhone(e.target.value)}
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">E-posta</label>
                  <input
                    type="email"
                    placeholder="ornek@mail.com"
                    value={partnerEmail}
                    onChange={(e) => setPartnerEmail(e.target.value)}
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">İlgili Şirket / Merkez</label>
                <select
                  value={partnerCompanyId}
                  onChange={(e) => setPartnerCompanyId(e.target.value)}
                  className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  {!isRestricted && <option value="common">Ortak / Bağımsız (Tüm Şirketler)</option>}
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Notlar / Özel Anlaşma</label>
                <textarea
                  rows={2}
                  placeholder="Anlaşma şartları, IBAN vb..."
                  value={partnerNotes}
                  onChange={(e) => setPartnerNotes(e.target.value)}
                  className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPartnerModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-950/40"
                >
                  {editingPartner ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* --- MODAL 2: YENİ HAKEDİŞ / İŞ HESAPLAŞMA FORMU (CANLI FORMÜL) --- */}
      {/* ========================================================================= */}
      {isSettlementModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200" style={{ zIndex: 99999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-2xl p-5 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] overflow-y-auto custom-scrollbar">
            
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                  <Calculator size={20} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    {editingSettlement ? 'Hakediş Hesaplaşmasını Düzenle' : 'Yeni İş & Hakediş Hesaplaşması'}
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Müşteri faturasından mağaza malzemeleri, dış maliyetler ve vergi payı düşülerek net hakediş hesaplanır.
                  </p>
                </div>
              </div>
              <button onClick={() => setIsSettlementModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSettlement} className="space-y-3.5 text-xs">
              
              {/* Üst Satır: Ortak Seçimi ve Tarih */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#070b14] p-3 rounded-xl border border-slate-800/80">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Çözüm Ortağı *</label>
                  <select
                    required
                    value={settlePartnerId}
                    onChange={(e) => {
                      setSettlePartnerId(e.target.value)
                      const p = partners.find(item => item.id === e.target.value)
                      if (p) {
                        setSettleTaxRate((p.default_tax_rate ?? 20).toString())
                        if (p.company_id) setSettleCompanyId(p.company_id)
                      }
                    }}
                    className="w-full bg-[#0d1322] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Ortak Seç...</option>
                    {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">İş Tarihi *</label>
                  <input
                    type="date"
                    required
                    value={settleJobDate}
                    onChange={(e) => setSettleJobDate(e.target.value)}
                    className="w-full bg-[#0d1322] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              </div>

              {/* İş Başlığı & Müşteri Bilgileri */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-slate-400 mb-1 font-medium">İş / Proje Başlığı *</label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Ali Bey Villa Kamera & Network Kurulumu, MacBook Anakart Tamiri..."
                    value={settleJobTitle}
                    onChange={(e) => setSettleJobTitle(e.target.value)}
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Müşteri Adı / Ünvanı</label>
                  <input
                    type="text"
                    placeholder="Müşteri Adı..."
                    value={settleCustomerName}
                    onChange={(e) => setSettleCustomerName(e.target.value)}
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Fatura & Tahsilat Bilgisi */}
              <div className="bg-indigo-950/20 p-3 rounded-xl border border-indigo-900/40 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-indigo-300 mb-1 font-bold">Müşteri Fatura Tutarı (₺) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={settleInvoiceAmount}
                      onChange={(e) => setSettleInvoiceAmount(e.target.value)}
                      className="w-full bg-[#070b14] border border-indigo-500/50 rounded-lg px-3 py-2 text-indigo-300 font-black font-mono focus:outline-none focus:border-indigo-400 text-sm"
                    />
                    <span className="text-[9px] text-slate-400 block mt-0.5">Müşteriye kesilen KDV dahil ciro</span>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Fatura No</label>
                    <input
                      type="text"
                      placeholder="GİB2026000001"
                      value={settleInvoiceNo}
                      onChange={(e) => setSettleInvoiceNo(e.target.value)}
                      className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Tahsilat Durumu</label>
                    <select
                      value={settleCollectionStatus}
                      onChange={(e) => setSettleCollectionStatus(e.target.value as any)}
                      className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-2.5 py-2 text-white focus:outline-none"
                    >
                      <option value="collected">✅ Tahsil Edildi (Hesapta/Kasada)</option>
                      <option value="pending">⏳ Müşteri Ödemesi Bekleniyor</option>
                    </select>
                  </div>
                </div>

                {/* Eğer Tahsil Edildi seçildiyse: Giriş Yapılan Kasa / Banka */}
                {settleCollectionStatus === 'collected' && (
                  <div className="pt-2 border-t border-indigo-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#070b14]/50 p-2.5 rounded-lg border border-slate-800">
                    <div className="flex-1">
                      <label className="block text-indigo-300 font-medium text-[11px] mb-1">
                        Tahsilatın Giriş Yapıldığı Hesap / Kasa
                      </label>
                      <select
                        value={settleCollectionSource}
                        onChange={(e) => setSettleCollectionSource(e.target.value)}
                        className="w-full bg-[#0a0f1d] border border-indigo-500/40 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-400 transition-colors"
                      >
                        <option value="">⚡ Sadece Durumu Belirt (Hesap Hareketi Ekleme)</option>
                        {banks.length > 0 && (
                          <optgroup label="🏦 Banka Hesapları">
                            {banks.map(b => (
                              <option key={`bank|${b.id}`} value={`bank|${b.id}`}>
                                {b.bank_name} - {b.account_name} ({formatMoney(b.balance, b.currency).formatted})
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {cashes.length > 0 && (
                          <optgroup label="💵 Kasalar">
                            {cashes.map(c => (
                              <option key={`cash|${c.id}`} value={`cash|${c.id}`}>
                                {c.name} ({formatMoney(c.balance, c.currency).formatted})
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                    {settleCollectionSource ? (
                      <span className="text-[10px] text-emerald-400 font-medium sm:max-w-[220px] self-center">
                        ✓ Kaydedildiğinde bu hesaba {formatMoney(liveSettlementCalc.invAmt, 'TRY').formatted} gelir işlenecektir.
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 sm:max-w-[220px] self-center">
                        (Ekstre ile içeri aktarma yapıyorsanız hesap hareketi eklenmez)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* DEPODAN KULLANILAN MALZEMELER (STOKTAN DÜŞÜM) */}
              <div className="bg-gradient-to-r from-purple-950/30 via-slate-900/60 to-purple-950/30 p-3.5 rounded-xl border border-purple-500/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/30">
                      <Package size={15} />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-purple-300 uppercase tracking-wider block">
                        Depodan Malzeme Seçimi (Stoktan Düşüm)
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Mağaza deposundan verilen parçaları seçin; adetler stoktan otomatik düşülür ve tutarı faturadan kesilir.
                      </span>
                    </div>
                  </div>
                  
                  <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-purple-200 bg-purple-900/40 px-2.5 py-1 rounded-lg border border-purple-500/40 self-start sm:self-auto">
                    <input
                      type="checkbox"
                      checked={deductFromInventory}
                      onChange={(e) => setDeductFromInventory(e.target.checked)}
                      className="rounded text-purple-600 focus:ring-0 focus:ring-offset-0 bg-slate-900 border-slate-700 w-3.5 h-3.5"
                    />
                    <span>Stoktan Otomatik Düş</span>
                  </label>
                </div>

                {/* Parça Arama ve Ekleme Satırı */}
                <div className="bg-[#070b14] p-2.5 rounded-xl border border-slate-800 space-y-2">
                  {selectedStockId ? (
                    (() => {
                      const st = stocks.find(s => s.id === selectedStockId)
                      const costTry = st ? getTryPrice(st.unit_price, st.currency) : 0
                      return (
                        <div className="flex items-center justify-between p-2 bg-purple-950/40 border border-purple-500/40 rounded-xl">
                          <div className="flex items-center gap-2 min-w-0">
                            <Package size={14} className="text-purple-400 shrink-0" />
                            <div className="truncate">
                              <div className="flex items-center gap-1.5 truncate">
                                {st?.sku && (
                                  <span className="font-mono text-purple-300 font-bold bg-purple-900/70 px-1.5 py-0.5 rounded border border-purple-500/50 text-[10px] shrink-0">
                                    {st.sku}
                                  </span>
                                )}
                                <span className="font-bold text-white text-xs truncate">{st?.name}</span>
                              </div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                                <span>Mevcut Stok: <b className={(st?.quantity || 0) > 0 ? "text-emerald-400" : "text-rose-400"}>{st?.quantity || 0} Adet</b></span>
                                <span className="text-slate-600">•</span>
                                <span className="text-slate-300">Geliş Fiyatı: <b className="text-amber-300 font-mono">{formatMoney(costTry, 'TRY').formatted}</b></span>
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStockId('')
                              setSelectedStockPrice('')
                              setStockSearchQuery('')
                            }}
                            className="p-1 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition cursor-pointer shrink-0"
                            title="Farklı ürün seç"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )
                    })()
                  ) : (
                    <div className="relative" ref={stockDropdownRef}>
                      <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="🔍 Depodan Ürün / Malzeme Ara (İsim, Ürün Kodu / Barkod)..."
                          value={stockSearchQuery}
                          onChange={(e) => {
                            setStockSearchQuery(e.target.value)
                            setIsStockDropdownOpen(true)
                          }}
                          onFocus={() => setIsStockDropdownOpen(true)}
                          className="w-full pl-8 pr-7 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-[11px] placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
                        />
                        {stockSearchQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setStockSearchQuery('')
                              setIsStockDropdownOpen(false)
                            }}
                            className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>

                      {/* Dropdown Sonuçları */}
                      {isStockDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-[#0f172a] border border-purple-500/40 rounded-xl shadow-2xl overflow-hidden max-h-56 flex flex-col animate-in fade-in duration-100">
                          <div className="p-1.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-[10px] text-purple-300 font-medium">
                            <span>Depodaki Ürünler ({filteredStocks.length})</span>
                            <span className="text-slate-500">Seçmek için tıklayın</span>
                          </div>
                          <div className="overflow-y-auto custom-scrollbar divide-y divide-slate-800/50">
                            {filteredStocks.length === 0 ? (
                              <div className="p-3 text-center text-slate-500 text-[11px]">
                                Aramanıza uygun ürün bulunamadı.
                              </div>
                            ) : (
                              filteredStocks.map((st) => {
                                const tryVal = getTryPrice(st.unit_price, st.currency)
                                return (
                                  <button
                                    key={st.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedStockId(st.id)
                                      setSelectedStockPrice(tryVal.toString())
                                      setIsStockDropdownOpen(false)
                                      setStockSearchQuery('')
                                    }}
                                    className="w-full p-2 text-left hover:bg-purple-950/40 flex items-center justify-between gap-2 transition cursor-pointer group"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 truncate">
                                        {st.sku ? (
                                          <span className="font-mono text-purple-300 font-bold bg-purple-900/60 px-1.5 py-0.5 rounded border border-purple-500/40 text-[10px] shrink-0 tracking-wide">
                                            {st.sku}
                                          </span>
                                        ) : (
                                          <span className="font-mono text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded text-[9px] shrink-0">
                                            KODSUZ
                                          </span>
                                        )}
                                        <span className="font-medium text-slate-200 text-[11px] truncate group-hover:text-purple-300">
                                          {st.name}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 text-[9px] text-slate-400 mt-1">
                                        {st.category && <span>{st.category} •</span>}
                                        <span className={st.quantity > 0 ? "text-emerald-400 font-bold" : "text-rose-400"}>
                                          {st.quantity > 0 ? `Stok: ${st.quantity} ad.` : 'Tükendi (0)'}
                                        </span>
                                        <span className="text-slate-500 font-mono">| Geliş: {formatMoney(tryVal, 'TRY').formatted}</span>
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <span className="font-mono font-bold text-white text-[11px] block">
                                        {formatMoney(tryVal, 'TRY').formatted}
                                      </span>
                                      {st.currency && st.currency !== 'TRY' && (
                                        <span className="font-mono text-[9px] text-slate-500 block">
                                          {formatMoney(st.unit_price, st.currency).formatted}
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                )
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Adet, Geliş Fiyatı, Satış Fiyatı ve Ekle Butonu */}
                  {(() => {
                    const st = stocks.find(s => s.id === selectedStockId)
                    const costTry = st ? getTryPrice(st.unit_price, st.currency) : 0
                    const saleVal = selectedStockPrice !== '' ? (parseFloat(selectedStockPrice) || 0) : costTry
                    const profitPerUnit = saleVal - costTry

                    return (
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-1 border-t border-slate-800/60">
                        {/* Adet */}
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-slate-400">Adet:</span>
                          <input
                            type="number"
                            min="1"
                            value={selectedStockQty}
                            onChange={(e) => setSelectedStockQty(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleAddStockItem()
                              }
                            }}
                            className="w-14 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-white text-[11px] font-mono text-center focus:outline-none focus:border-purple-500"
                          />
                        </div>

                        {/* Geliş Fiyatı (Sabit / Bilgilendirme) */}
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] text-slate-400 shrink-0">Geliş:</span>
                          <div 
                            className="px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-300 font-mono text-[11px] select-none"
                            title="Depodaki geliş maliyet fiyatı"
                          >
                            {selectedStockId ? formatMoney(costTry, 'TRY').formatted : '0,00 ₺'}
                          </div>
                        </div>

                        {/* Satış Fiyatı (Ortağa Yansıtılacak Tutar) */}
                        <div className="flex items-center gap-1 flex-1 min-w-[130px]">
                          <span className="text-[10px] text-purple-300 font-semibold shrink-0">Satış ₺:</span>
                          <input
                            type="number"
                            step="0.01"
                            placeholder={costTry > 0 ? costTry.toString() : "0.00"}
                            value={selectedStockPrice}
                            onChange={(e) => setSelectedStockPrice(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleAddStockItem()
                              }
                            }}
                            disabled={!selectedStockId}
                            className="w-full px-2.5 py-1 bg-slate-900 border border-purple-500/50 rounded-lg text-white font-bold text-[11px] font-mono text-right focus:outline-none focus:border-purple-400 disabled:opacity-40"
                            title="Ortağa yansıtılacak kârlı birim satış fiyatı"
                          />
                        </div>

                        {/* Kâr Payı Göstergesi */}
                        {selectedStockId && profitPerUnit !== 0 && (
                          <span className={`text-[10px] font-mono shrink-0 hidden md:inline-block px-1.5 py-0.5 rounded ${profitPerUnit > 0 ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/40' : 'text-rose-400 bg-rose-950/40 border border-rose-800/40'}`}>
                            {profitPerUnit > 0 ? `+${formatMoney(profitPerUnit, 'TRY').formatted} kâr` : `${formatMoney(profitPerUnit, 'TRY').formatted}`}
                          </span>
                        )}

                        {/* Ekle Butonu */}
                        <button
                          type="button"
                          onClick={handleAddStockItem}
                          disabled={!selectedStockId}
                          className="px-3.5 py-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-[11px] rounded-lg transition shrink-0 cursor-pointer flex items-center gap-1 shadow-sm shadow-purple-600/30 active:scale-95"
                        >
                          <Plus size={12} />
                          <span>Listeye Ekle</span>
                        </button>
                      </div>
                    )
                  })()}
                </div>

                {/* Eklenen Malzemeler Tablosu / Listesi */}
                {settleItems.length > 0 && (
                  <div className="space-y-1.5 bg-[#070b14]/70 p-2.5 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 px-1 border-b border-slate-800 pb-1">
                      <span>Eklenen Ürünler ({settleItems.length})</span>
                      <span>Toplam: <b className="text-purple-300 font-mono text-xs">{formatMoney(settleItems.reduce((s, it) => s + it.total, 0), 'TRY').formatted}</b></span>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                      {settleItems.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-1.5 bg-slate-900/60 border border-slate-800 rounded-lg text-[11px]">
                          <div className="flex items-center gap-2 truncate pr-2">
                            <span className="text-slate-300 font-medium truncate">{item.name}</span>
                            <span className="text-[10px] text-purple-400 font-mono">
                              ({item.quantity} ad. × {formatMoney(item.unit_price, 'TRY').formatted}
                              {item.cost_price && item.cost_price !== item.unit_price ? (
                                <span className="text-slate-400 font-normal"> • Geliş: {formatMoney(item.cost_price, 'TRY').formatted}</span>
                              ) : null})
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold text-amber-300 text-xs">{formatMoney(item.total, 'TRY').formatted}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveStockItem(idx)}
                              className="text-slate-500 hover:text-rose-400 p-0.5 rounded cursor-pointer transition"
                              title="Listeden Kaldır"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Düşülecek Kalemler & Maliyetler */}
              <div className="bg-[#070b14] p-3 rounded-xl border border-slate-800 space-y-3">
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                  ✂️ Faturadan Düşülecek Maliyet ve Kesintiler
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Mağaza Malzemeleri (₺)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={settleMaterialShop}
                      onChange={(e) => setSettleMaterialShop(e.target.value)}
                      className="w-full bg-[#0d1322] border border-slate-700 rounded-lg px-2.5 py-1.5 text-amber-300 font-mono focus:outline-none"
                    />
                    <span className="text-[9px] text-slate-500 block mt-0.5">
                      {settleItems.length > 0 ? "Depo listesinden otomatik hesaplandı" : "Stoktan verilen kârlı bedel"}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-400 font-medium">KDV / Vergi Kesintisi (₺)</label>
                      {liveSettlementCalc.taxPct > 0 && (
                        <span className="text-[9px] text-purple-400 font-mono font-bold">
                          (%{liveSettlementCalc.taxPct})
                        </span>
                      )}
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={settleTaxAmount}
                      onChange={(e) => setSettleTaxAmount(e.target.value)}
                      className="w-full bg-[#0d1322] border border-slate-700 rounded-lg px-2.5 py-1.5 text-amber-300 font-mono focus:outline-none focus:border-purple-500"
                    />
                    <div className="flex items-center justify-between text-[9px] text-slate-500 mt-0.5">
                      <span>Faturadan kesilecek KDV tutarı</span>
                      {liveSettlementCalc.invAmt > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const autoKdv = Number(((liveSettlementCalc.invAmt * 20) / 100).toFixed(2))
                            setSettleTaxAmount(autoKdv.toString())
                          }}
                          className="text-purple-400 hover:text-purple-300 hover:underline cursor-pointer"
                          title="Standart %20 KDV tutarını hesapla"
                        >
                          %20 KDV Hesapla
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Bizim Servis / Kâr Payımız (₺)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={settleShopProfit}
                      onChange={(e) => setSettleShopProfit(e.target.value)}
                      className="w-full bg-[#0d1322] border border-slate-700 rounded-lg px-2.5 py-1.5 text-amber-300 font-mono focus:outline-none focus:border-purple-500"
                    />
                    <span className="text-[9px] text-slate-500 block mt-0.5">Dükkan işçilik / kâr payı</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Diğer Masraflar (Kargo / Ulaşım vb.) (₺)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={settleOtherExpenses}
                      onChange={(e) => setSettleOtherExpenses(e.target.value)}
                      className="w-full bg-[#0d1322] border border-slate-700 rounded-lg px-2.5 py-1.5 text-amber-300 font-mono focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Açıklama & Detaylar</label>
                    <input
                      type="text"
                      placeholder="Kullanılan parçalar, cihaz arızası vb..."
                      value={settleNotes}
                      onChange={(e) => setSettleNotes(e.target.value)}
                      className="w-full bg-[#0d1322] border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* CANLI HESAPLAŞMA PUSULASI ÖZETİ */}
              <div className="bg-gradient-to-r from-[#0d172a] via-[#0b1324] to-[#0d172a] p-3.5 rounded-xl border border-indigo-500/40 shadow-inner flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Müşteri Faturası:</span>
                    <span className="font-mono font-bold text-white">{formatMoney(liveSettlementCalc.invAmt, 'TRY').formatted}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>Toplam Düşümler:</span>
                    <span className="font-mono text-amber-400">-{formatMoney(liveSettlementCalc.totalDeductions, 'TRY').formatted}</span>
                    <span className="text-[10px] text-slate-500">(Malzeme + Vergi + Kâr)</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[9px] uppercase tracking-wider text-emerald-400 font-bold block">Dükkana Kalan Pay</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      +{formatMoney(liveSettlementCalc.shopRetained, 'TRY').formatted}
                    </span>
                  </div>

                  <div className="border-l border-slate-700 pl-4 text-right">
                    <span className="text-[9px] uppercase tracking-wider text-indigo-300 font-bold block">👉 Ortağa Net Hakediş</span>
                    <span className="text-lg font-mono font-black text-indigo-300">
                      {formatMoney(liveSettlementCalc.partnerPayout, 'TRY').formatted}
                    </span>
                  </div>
                </div>
              </div>

              {/* Butonlar */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsSettlementModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-950/40"
                >
                  {editingSettlement ? 'Hakedişi Güncelle' : 'Hakedişi Kaydet'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* --- MODAL 3: HAKEDİŞ ÖDEMESİ YAP (KASA / BANKA ÇIKIŞI) --- */}
      {/* ========================================================================= */}
      {isPayoutModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 99999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
            
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                  <DollarSign size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Çözüm Ortağı Hakediş Ödemesi</h3>
                  <p className="text-[10px] text-slate-400">
                    Ödeme doğrudan seçtiğiniz Kasa veya Banka hesabından düşülecektir.
                  </p>
                </div>
              </div>
              <button onClick={() => setIsPayoutModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleExecutePayout} className="space-y-3.5 text-xs">
              
              <div className="bg-[#070b14] p-3 rounded-xl border border-slate-800">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Ödeme Yapılacak Ortak</span>
                <span className="text-sm font-bold text-white">
                  {partners.find(p => p.id === payoutPartnerId)?.name}
                </span>
                <div className="text-[10px] text-rose-400 font-mono mt-1 font-semibold">
                  Toplam Bekleyen Borç: {formatMoney(partners.find(p => p.id === payoutPartnerId)?.balance || 0, 'TRY').formatted}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Ödeme Kaynağı (Nereden Çıkacak?) *</label>
                <select
                  required
                  value={payoutSource}
                  onChange={(e) => setPayoutSource(e.target.value)}
                  className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="">Kasa veya Banka Seçiniz...</option>
                  {cashes.length > 0 && (
                    <optgroup label="💵 Nakit Kasalar">
                      {cashes.map(c => (
                        <option key={`cash|${c.id}`} value={`cash|${c.id}`}>
                          {c.name} (Bakiye: {formatMoney(c.balance, c.currency).formatted})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {banks.length > 0 && (
                    <optgroup label="🏦 Banka Hesapları">
                      {banks.map(b => (
                        <option key={`bank|${b.id}`} value={`bank|${b.id}`}>
                          {b.bank_name} - {b.account_name} (Bakiye: {formatMoney(b.balance, b.currency).formatted})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Ödenecek Tutar (₺) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-emerald-400 font-mono font-bold text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Ödeme Tarihi *</label>
                  <input
                    type="date"
                    required
                    value={payoutDate}
                    onChange={(e) => setPayoutDate(e.target.value)}
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Açıklama</label>
                <input
                  type="text"
                  placeholder="Banka havalesi, elden nakit ödeme vb..."
                  value={payoutDescription}
                  onChange={(e) => setPayoutDescription(e.target.value)}
                  className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPayoutModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-950/40"
                >
                  Ödemeyi Onayla & Düş
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* --- MODAL: MÜŞTERİ FATURA TAHSİLATI (BANKA / KASA GİRİŞİ) --- */}
      {/* ========================================================================= */}
      {isCollectionModalOpen && collectionSettlement && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 99999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-5 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
            
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                  <ArrowDownLeft size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Müşteri Fatura Tahsilatı</h3>
                  <p className="text-[10px] text-slate-400">
                    Faturanın tahsil edildiğini onaylayın ve seçtiğiniz hesaba tek tıkla işleyin.
                  </p>
                </div>
              </div>
              <button onClick={() => setIsCollectionModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleExecuteCollection} className="space-y-3.5 text-xs">
              
              {/* İş & Fatura Özeti */}
              <div className="bg-[#070b14] p-3 rounded-xl border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">İş / Proje</span>
                  <span className="text-[10px] text-indigo-400 font-mono">
                    {formatDateTR(collectionSettlement.job_date)}
                  </span>
                </div>
                <div className="text-xs font-bold text-white truncate">
                  {collectionSettlement.job_title}
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80 text-[11px]">
                  <span className="text-slate-400 truncate max-w-[200px]">
                    {collectionSettlement.customer_name ? `Müşteri: ${collectionSettlement.customer_name}` : 'Müşteri Belirtilmedi'}
                    {collectionSettlement.invoice_no ? ` (#${collectionSettlement.invoice_no})` : ''}
                  </span>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-500 block uppercase">Fatura Tutarı</span>
                    <span className="text-sm font-black font-mono text-emerald-400">
                      {formatMoney(collectionSettlement.invoice_amount, 'TRY').formatted}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tahsilat Tarihi */}
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Tahsilat Tarihi *</label>
                <input
                  type="date"
                  required
                  value={collectionDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
                  className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              {/* Giriş Yapılacak Hesap / Kasa */}
              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Tahsilat Nereye Giriş Yapıldı? *
                </label>
                <select
                  value={collectionSource}
                  onChange={(e) => setCollectionSource(e.target.value)}
                  className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="none">⚡ Sadece Durumu Değiştir (Banka / Kasa Hareketi Ekleme)</option>
                  {banks.length > 0 && (
                    <optgroup label="🏦 Banka Hesapları">
                      {banks.map(b => (
                        <option key={`bank|${b.id}`} value={`bank|${b.id}`}>
                          {b.bank_name} - {b.account_name} (Bakiye: {formatMoney(b.balance, b.currency).formatted})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {cashes.length > 0 && (
                    <optgroup label="💵 Kasalar">
                      {cashes.map(c => (
                        <option key={`cash|${c.id}`} value={`cash|${c.id}`}>
                          {c.name} (Bakiye: {formatMoney(c.balance, c.currency).formatted})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* Dinamik Bilgi Kutusu */}
              {collectionSource && collectionSource !== 'none' ? (
                <div className="bg-emerald-950/30 border border-emerald-600/30 p-2.5 rounded-xl text-[11px] text-emerald-300 flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span>
                      Bu işlem onaylandığında seçilen hesaba <strong>{formatMoney(collectionSettlement.invoice_amount, 'TRY').formatted}</strong> tutarında para girişi işlenecek ve hesap bakiyesi anında artacaktır.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-[10px] text-slate-400 flex items-start gap-2">
                  <Clock size={15} className="text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    Banka ekstrenizi Excel/CSV ile içeri aktarıyorsanız veya hesaba önceden manuel işlediyseniz mükerrer kayıt oluşmaması için "Sadece Durumu Değiştir" seçebilirsiniz.
                  </span>
                </div>
              )}

              {/* Butonlar */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCollectionModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-950/40 cursor-pointer active:scale-95"
                >
                  Tahsilatı Kaydet ✓
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* --- MODAL 4: HESAPLAŞMA PUSULASI / MAKBUZ GÖRÜNÜMÜ & YAZDIR --- */}
      {/* ========================================================================= */}
      {isPrintModalOpen && printSettlement && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 99999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-lg p-5 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 print:hidden">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Printer size={16} /> Hesaplaşma Pusulası Önizleme
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyWhatsAppText(printSettlement)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                >
                  <Share2 size={12} /> WhatsApp Metni
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                >
                  <Printer size={12} /> Yazdır / PDF
                </button>
                <button onClick={() => setIsPrintModalOpen(false)} className="text-slate-400 hover:text-white p-1">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Yazdırılabilir Pusula Alanı */}
            <div ref={printRef} className="p-4 bg-white text-slate-900 rounded-xl my-3 text-xs overflow-y-auto font-sans leading-relaxed">
              <div className="border-b-2 border-slate-900 pb-3 mb-3 flex justify-between items-start">
                <div>
                  <h1 className="text-base font-black tracking-wider text-slate-900">CTC MASTER LEDGER</h1>
                  <p className="text-[10px] text-slate-600">Dış İş & Hakediş Hesaplaşma Pusulası</p>
                </div>
                <div className="text-right text-[10px] text-slate-600">
                  <p className="font-bold">Tarih: {formatDateTR(printSettlement.job_date)}</p>
                  <p>Fatura: #{printSettlement.invoice_no || '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3 text-[11px]">
                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">Çözüm Ortağı</span>
                  <span className="font-bold text-slate-900">{partners.find(p => p.id === printSettlement.partner_id)?.name}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded border border-slate-200">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">Müşteri</span>
                  <span className="font-bold text-slate-900">{printSettlement.customer_name || 'Belirtilmedi'}</span>
                </div>
              </div>

              <div className="mb-3">
                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">İş / Proje Tanımı</span>
                <p className="font-semibold text-slate-800 bg-slate-100 p-2 rounded">
                  {printSettlement.job_title}
                </p>
              </div>

              {/* Hesap Tablosu */}
              <table className="w-full text-left text-xs mb-3 border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-600 text-[10px]">
                    <th className="py-1">Hesap Kalemi</th>
                    <th className="py-1 text-right">Tutar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  <tr>
                    <td className="py-1.5 font-bold font-sans">Müşteri Fatura / Tahsilat Tutarı</td>
                    <td className="py-1.5 text-right font-bold text-slate-900">
                      {formatMoney(printSettlement.invoice_amount, 'TRY').formatted}
                    </td>
                  </tr>
                  {printSettlement.material_cost_shop > 0 && (
                    <>
                      <tr className="text-slate-600">
                        <td className="py-1.5 font-sans">(-) Mağaza / Stok Malzemeleri</td>
                        <td className="py-1.5 text-right">-{formatMoney(printSettlement.material_cost_shop, 'TRY').formatted}</td>
                      </tr>
                      {printSettlement.items_breakdown && printSettlement.items_breakdown.length > 0 && (
                        <tr>
                          <td colSpan={2} className="pb-2 pt-0.5">
                            <div className="bg-slate-50 border border-slate-200 rounded p-1.5 space-y-0.5 text-[10px] text-slate-500 font-sans">
                              {printSettlement.items_breakdown.map((it, idx) => (
                                <div key={idx} className="flex justify-between">
                                  <span>• {it.quantity}x {it.name} ({formatMoney(it.unit_price, 'TRY').formatted})</span>
                                  <span className="font-mono">{formatMoney(it.total, 'TRY').formatted}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  )}

                  {printSettlement.material_cost_external > 0 && (
                    <tr className="text-slate-600">
                      <td className="py-1.5 font-sans">(-) Dış Alış Malzemeleri</td>
                      <td className="py-1.5 text-right">-{formatMoney(printSettlement.material_cost_external, 'TRY').formatted}</td>
                    </tr>
                  )}
                  {printSettlement.tax_amount > 0 && (
                    <tr className="text-slate-600">
                      <td className="py-1.5 font-sans">(-) KDV & Vergi Kesintisi (%{printSettlement.tax_rate})</td>
                      <td className="py-1.5 text-right">-{formatMoney(printSettlement.tax_amount, 'TRY').formatted}</td>
                    </tr>
                  )}
                  {printSettlement.shop_profit_share > 0 && (
                    <tr className="text-slate-600">
                      <td className="py-1.5 font-sans">(-) Şirket Servis / Komisyon Payı</td>
                      <td className="py-1.5 text-right">-{formatMoney(printSettlement.shop_profit_share, 'TRY').formatted}</td>
                    </tr>
                  )}
                  {printSettlement.other_expenses > 0 && (
                    <tr className="text-slate-600">
                      <td className="py-1.5 font-sans">(-) Diğer Masraflar</td>
                      <td className="py-1.5 text-right">-{formatMoney(printSettlement.other_expenses, 'TRY').formatted}</td>
                    </tr>
                  )}
                  <tr className="border-t-2 border-slate-900 bg-slate-50 font-bold">
                    <td className="py-2 text-indigo-900 font-sans">👉 NET HAKEDİŞ TUTARI</td>
                    <td className="py-2 text-right text-indigo-900 text-sm">
                      {formatMoney(printSettlement.partner_payout, 'TRY').formatted}
                    </td>
                  </tr>
                  <tr className="text-emerald-700">
                    <td className="py-1.5 font-sans">Şu Ana Kadar Ödenen</td>
                    <td className="py-1.5 text-right">{formatMoney(printSettlement.paid_amount, 'TRY').formatted}</td>
                  </tr>
                  <tr className="text-rose-700 font-bold">
                    <td className="py-1.5 font-sans">Kalan Hakediş Bakiyesi</td>
                    <td className="py-1.5 text-right">{formatMoney(printSettlement.remaining_payout, 'TRY').formatted}</td>
                  </tr>
                </tbody>
              </table>

              <div className="border-t border-slate-200 pt-6 mt-6 grid grid-cols-2 gap-4 text-center text-[10px] text-slate-500">
                <div>
                  <p className="font-bold text-slate-700 mb-8">Düzenleyen Firma</p>
                  <p>İmza / Kaşe</p>
                </div>
                <div>
                  <p className="font-bold text-slate-700 mb-8">Çözüm Ortağı</p>
                  <p>İmza / Mutabakat</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* --- ÖZEL ONAY MODALI --- */}
      {/* ========================================================================= */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 999999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className={`mx-auto flex items-center justify-center h-14 w-14 rounded-full mb-5 ${confirmDialog.isDanger ? 'bg-rose-500/10 text-rose-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
              {confirmDialog.isDanger ? <AlertTriangle size={28} /> : <RefreshCw size={28} />}
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{confirmDialog.title}</h3>
            <p className="text-[11px] text-slate-400 mb-6 leading-relaxed px-2">{confirmDialog.message}</p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} className="flex-1 px-4 py-2.5 rounded-xl text-slate-300 bg-slate-800 hover:bg-slate-700 font-medium transition-colors text-xs">
                {confirmDialog.cancelText}
              </button>
              <button onClick={confirmDialog.onConfirm} className={`flex-1 px-4 py-2.5 rounded-xl text-white font-bold transition-all active:scale-95 text-xs shadow-lg ${confirmDialog.isDanger ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-900/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-900/20'}`}>
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

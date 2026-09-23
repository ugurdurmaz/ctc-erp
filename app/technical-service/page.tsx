'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { formatMoney, formatPhoneNumber } from '@/lib/utils'
import toast, { Toaster } from 'react-hot-toast'
import { 
  Wrench, Plus, Search, Filter, RefreshCw, Printer, MessageSquare, 
  Laptop, Monitor, Smartphone, Printer as PrinterIcon, Gamepad2, Gamepad, Cpu, 
  CheckCircle2, Clock, AlertTriangle, ChevronRight, X, User, Phone, 
  Tag, Calendar, CreditCard, Wallet, Landmark, ArrowRight, ShieldCheck, 
  FileText, ExternalLink, SlidersHorizontal, LayoutGrid, List, Sparkles,
  Barcode, Check, Lock, Building2, Package, Truck, Edit3, Trash2
} from 'lucide-react'

// ==============================================================================
// TİPLER
// ==============================================================================
type TicketStatus = 'pending' | 'diagnosing' | 'waiting_approval' | 'waiting_parts' | 'ready' | 'delivered' | 'cancelled'

interface UsedPart {
  stock_id?: string
  name: string
  quantity: number
  unit_price: number
  total: number
}

interface PerformedService {
  service_id?: string
  name: string
  price: number
}

interface TechnicalTicket {
  id: string
  ticket_no: string
  company_id: string | null
  customer_id: string | null
  customer_name: string
  customer_phone: string
  device_type: string
  brand_model: string
  serial_no: string
  device_password: string
  accessories: string
  physical_condition: string
  problem_description: string
  technician_notes: string
  status: TicketStatus
  estimated_cost: number
  labor_cost: number
  parts_cost: number
  total_cost: number
  used_parts: UsedPart[]
  performed_services: PerformedService[]
  payment_status: 'unpaid' | 'paid' | 'debt_added'
  payment_method: string | null
  payment_target_id: string | null
  supplier_id?: string | null
  supplier_cost?: number
  is_external_service?: boolean
  external_service_status?: string | null
  marketing_consent?: boolean
  received_at: string
  completed_at: string | null
  delivered_at: string | null
  created_at: string
  company?: { name: string; is_personal: boolean }
}

interface Company { id: string; name: string; is_personal: boolean }
interface Customer { id: string; name: string; phone: string; balance: number }
interface Supplier { id: string; company_name: string; balance: number; currency?: string }
interface StockItem { id: string; name: string; quantity: number; unit_price: number; currency: string; warehouse_id: string }
interface ServiceItem { id: string; name: string; unit_price: number; currency: string }
interface CashRegister { id: string; name: string; balance: number; currency: string; company_id: string | null }
interface BankAccount { id: string; bank_name: string; balance: number; currency: string; company_id: string | null }

// ==============================================================================
// DURUM YAPILANDIRMASI
// ==============================================================================
const STATUS_CONFIG: Record<TicketStatus, { label: string; bg: string; text: string; border: string; icon: any }> = {
  pending: { label: 'Sırada (Beklemede)', bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30', icon: Clock },
  diagnosing: { label: 'İncelemede / Arıza Tespiti', bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30', icon: Cpu },
  waiting_approval: { label: 'Müşteri Onayı Bekliyor', bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30', icon: AlertTriangle },
  waiting_parts: { label: 'Yedek Parça Bekliyor', bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30', icon: Package },
  ready: { label: 'Hazır (Onarım Tamamlandı)', bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: CheckCircle2 },
  delivered: { label: 'Teslim Edildi (Kapatıldı)', bg: 'bg-slate-500/15', text: 'text-slate-300', border: 'border-slate-700', icon: ShieldCheck },
  cancelled: { label: 'İptal / İade Edildi', bg: 'bg-rose-500/15', text: 'text-rose-400', border: 'border-rose-500/30', icon: X },
}

const DEVICE_TYPES = [
  { label: 'Laptop', icon: Laptop },
  { label: 'Masaüstü PC', icon: Monitor },
  { label: 'All-in-One', icon: Monitor },
  { label: 'Monitör', icon: Monitor },
  { label: 'Game Console', icon: Gamepad2 },
  { label: 'Game Pad', icon: Gamepad },
  { label: 'Tablet / Telefon', icon: Smartphone },
  { label: 'Diğer Donanım', icon: Cpu },
]

const ACCESSORY_PRESETS = [
  'Orijinal Şarj Aleti / Adaptör',
  'Taşıma Çantası',
  'Güç Kablosu',
  'Mouse / Klavye',
  'Yalnızca Cihaz (Aksesuarsız)',
]

function formatDateTR(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function TechnicalServicePage() {
  const { profile, isAdmin } = useAuth()

  // Ana State'ler
  const [tickets, setTickets] = useState<TechnicalTicket[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [stocks, setStocks] = useState<StockItem[]>([])
  const [services, setServices] = useState<ServiceItem[]>([])
  const [cashes, setCashes] = useState<CashRegister[]>([])
  const [banks, setBanks] = useState<BankAccount[]>([])
  const [rates, setRates] = useState<{ USD: number; EUR: number }>({ USD: 34.25, EUR: 37.80 })
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)

  // Filtre State'leri
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')

  // Modallar
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<TechnicalTicket | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [printTicket, setPrintTicket] = useState<TechnicalTicket | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    isDanger: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    cancelText: '',
    isDanger: false,
    onConfirm: () => {}
  })

  // Yeni Kayıt Form State'leri
  const [customerId, setCustomerId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [companyId, setCompanyId] = useState('')
  const [deviceType, setDeviceType] = useState('Laptop')
  const [brandModel, setBrandModel] = useState('')
  const [serialNo, setSerialNo] = useState('')
  const [devicePassword, setDevicePassword] = useState('')
  const [accessories, setAccessories] = useState('')
  const [physicalCondition, setPhysicalCondition] = useState('')
  const [problemDescription, setProblemDescription] = useState('')
  const [estimatedCost, setEstimatedCost] = useState('')
  const [marketingConsent, setMarketingConsent] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Detay & İşlem Form State'leri
  const [detailStatus, setDetailStatus] = useState<TicketStatus>('pending')
  const [detailTechNotes, setDetailTechNotes] = useState('')
  const [usedParts, setUsedParts] = useState<UsedPart[]>([])
  const [performedServices, setPerformedServices] = useState<PerformedService[]>([])
  const [selectedStockId, setSelectedStockId] = useState('')
  const [selectedPartPrice, setSelectedPartPrice] = useState('')
  const [stockQty, setStockQty] = useState('1')
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [selectedServicePrice, setSelectedServicePrice] = useState('')
  const [customLaborName, setCustomLaborName] = useState('')
  const [customLaborPrice, setCustomLaborPrice] = useState('')
  const [quickPriceInput, setQuickPriceInput] = useState('')

  // Dış Servis / Fason Onarım State'leri
  const [isExternalService, setIsExternalService] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [externalServiceCost, setExternalServiceCost] = useState('')
  const [externalServiceStatus, setExternalServiceStatus] = useState('sent_to_supplier')

  // Detay Modalında Kabul Bilgilerini Düzenleme (Intake Edit)
  const [isEditingIntake, setIsEditingIntake] = useState(false)
  const [editCustomerName, setEditCustomerName] = useState('')
  const [editCustomerPhone, setEditCustomerPhone] = useState('')
  const [editDeviceType, setEditDeviceType] = useState('Laptop')
  const [editBrandModel, setEditBrandModel] = useState('')
  const [editSerialNo, setEditSerialNo] = useState('')
  const [editDevicePassword, setEditDevicePassword] = useState('')
  const [editAccessories, setEditAccessories] = useState('')
  const [editPhysicalCondition, setEditPhysicalCondition] = useState('')
  const [editProblemDescription, setEditProblemDescription] = useState('')

  // Teslimat & Tahsilat State'leri
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'customer_debt' | 'free'>('cash')
  const [paymentTargetId, setPaymentTargetId] = useState('')
  const [deductPartsFromStock, setDeductPartsFromStock] = useState(true)

  // Personel İzolasyon Kontrolü
  const isRestricted = !isAdmin && profile?.allowed_companies && profile.allowed_companies.length > 0
  const effectiveCompanyId = isRestricted
    ? (profile.allowed_companies!.includes(companyFilter) ? companyFilter : profile.allowed_companies![0])
    : companyFilter

  const isMatch = (compId: string | null) => {
    if (isRestricted) {
      if (!compId) return false
      if (!profile.allowed_companies!.includes(compId)) return false
      return compId === effectiveCompanyId
    }
    if (effectiveCompanyId === 'all') return true
    return compId === effectiveCompanyId
  }

  // Verileri Yükle
  const loadData = async () => {
    setLoading(true)
    try {
      // 1. Şirketler
      const { data: compData } = await supabase.from('companies').select('*').order('name')
      setCompanies(compData || [])

      // 2. Müşteriler
      const { data: custData } = await supabase.from('customers').select('id, name, phone, balance').order('name')
      setCustomers(custData || [])

      // 3. Stoklar
      const { data: stData } = await supabase.from('stocks').select('id, name, quantity, unit_price, currency, warehouse_id').order('name')
      setStocks(stData || [])

      // 4. Hizmetler
      const { data: srvData } = await supabase.from('services').select('id, name, unit_price, currency').order('name')
      setServices(srvData || [])

      // 5. Kasa ve Bankalar
      const { data: cData } = await supabase.from('cash_registers').select('*').order('name')
      setCashes(cData || [])
      const { data: bData } = await supabase.from('bank_accounts').select('*').order('bank_name')
      setBanks(bData || [])

      // 6. Servis Biletleri
      const { data: tData, error: tErr } = await supabase
        .from('technical_service_tickets')
        .select('*, company:companies(name, is_personal)')
        .order('created_at', { ascending: false })

      if (tErr) {
        if (tErr.message?.includes('technical_service_tickets') && tErr.message?.includes('schema cache')) {
          setTableMissing(true)
        }
        console.warn('technical_service_tickets çekilemedi:', tErr.message)
      } else {
        setTableMissing(false)
        setTickets(tData || [])
      }

      // 7. Tedarikçiler (Dış Servis / Fason Onarım)
      const { data: suppData } = await supabase.from('suppliers').select('id, company_name, balance, currency').order('company_name')
      setSuppliers(suppData || [])
    } catch (err: any) {
      console.error('Servis verileri yüklenirken hata:', err)
      toast.error('Veriler yüklenemedi.')
    } finally {
      setLoading(false)
    }
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
    } catch (err) {
      console.error('Kurlar çekilemedi:', err)
    }
  }

  const getTryPrice = (price: number, curr?: string) => {
    if (curr === 'USD') return Number((price * (rates.USD || 34.25)).toFixed(2))
    if (curr === 'EUR') return Number((price * (rates.EUR || 37.80)).toFixed(2))
    return price
  }

  // Tedarikçi Mutlak Bakiyesini Güncelleme Fonksiyonu
  async function recalculateAbsoluteSupplierBalance(supplierId: string) {
    const { data: txs } = await supabase
      .from('supplier_transactions')
      .select('amount, tx_type, exchange_rate')
      .eq('supplier_id', supplierId)
    let absoluteBal = 0
    txs?.forEach(t => {
      const tryEquivalent = Number(t.amount) * (Number(t.exchange_rate) || 1)
      if (t.tx_type === 'debt') absoluteBal += tryEquivalent
      else absoluteBal -= tryEquivalent
    })
    await supabase.from('suppliers').update({ balance: absoluteBal }).eq('id', supplierId)
    setSuppliers(prev => prev.map(s => s.id === supplierId ? { ...s, balance: absoluteBal } : s))
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

  async function recalculateAbsoluteCustomerBalance(customerId: string) {
    const { data: txs } = await supabase.from('customer_transactions').select('amount, tx_type, exchange_rate').eq('customer_id', customerId)
    let absoluteBal = 0
    txs?.forEach(t => {
      const tryEquivalent = Number(t.amount) * (Number(t.exchange_rate) || 1)
      if (t.tx_type === 'debt') absoluteBal += tryEquivalent
      else absoluteBal -= tryEquivalent
    })
    await supabase.from('customers').update({ balance: absoluteBal }).eq('id', customerId)
    setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, balance: absoluteBal } : c))
  }

  async function recalculateAbsoluteStock(stockId: string) {
    const { data: txs } = await supabase.from('stock_transactions').select('quantity, tx_type').eq('stock_id', stockId)
    let absoluteQty = 0
    txs?.forEach(t => { absoluteQty += t.tx_type === 'in' ? Number(t.quantity) : -Number(t.quantity) })
    await supabase.from('stocks').update({ quantity: absoluteQty }).eq('id', stockId)
    setStocks(prev => prev.map(s => s.id === stockId ? { ...s, quantity: absoluteQty } : s))
  }

  const handleDeleteTicket = (ticket: TechnicalTicket) => {
    const hasFinancials = ticket.payment_status === 'paid' || ticket.payment_status === 'debt_added' || (ticket.supplier_cost && ticket.supplier_cost > 0)
    setConfirmDialog({
      isOpen: true,
      title: 'Servis Fişini Sil',
      message: `${ticket.ticket_no} numaralı servis fişini (${ticket.brand_model}) tamamen silmek istediğinizden emin misiniz?${
        hasFinancials
          ? ' Bu fişe bağlı kasa/banka tahsilatı, müşteri borcu ve tedarikçi hareketleri de otomatik olarak geri alınıp temizlenecektir.'
          : ' Bu işlem geri alınamaz.'
      }`,
      confirmText: 'Evet, Fişi Sil',
      cancelText: 'Vazgeç',
      isDanger: true,
      onConfirm: async () => {
        try {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }))
          const ticketNo = ticket.ticket_no

          // 1. İlgili supplier_transactions temizliği
          const { data: suppTxs } = await supabase
            .from('supplier_transactions')
            .select('id, supplier_id')
            .ilike('description', `%${ticketNo}%`)
          if (suppTxs && suppTxs.length > 0) {
            const suppIds = Array.from(new Set(suppTxs.map(st => st.supplier_id).filter(Boolean)))
            await supabase.from('supplier_transactions').delete().in('id', suppTxs.map(st => st.id))
            for (const sId of suppIds) {
              await recalculateAbsoluteSupplierBalance(sId)
            }
          }

          // 2. İlgili cash_transactions temizliği
          const { data: cashTxs } = await supabase
            .from('cash_transactions')
            .select('id, cash_register_id')
            .ilike('description', `%${ticketNo}%`)
          if (cashTxs && cashTxs.length > 0) {
            const cashIds = Array.from(new Set(cashTxs.map(ct => ct.cash_register_id).filter(Boolean)))
            await supabase.from('cash_transactions').delete().in('id', cashTxs.map(ct => ct.id))
            for (const cId of cashIds) {
              await recalculateAbsoluteCashBalance(cId)
            }
          }

          // 3. İlgili bank_transactions temizliği
          const { data: bankTxs } = await supabase
            .from('bank_transactions')
            .select('id, bank_account_id')
            .ilike('description', `%${ticketNo}%`)
          if (bankTxs && bankTxs.length > 0) {
            const bankIds = Array.from(new Set(bankTxs.map(bt => bt.bank_account_id).filter(Boolean)))
            await supabase.from('bank_transactions').delete().in('id', bankTxs.map(bt => bt.id))
            for (const bId of bankIds) {
              await recalculateAbsoluteBankBalance(bId)
            }
          }

          // 4. İlgili credit_card_transactions temizliği
          await supabase
            .from('credit_card_transactions')
            .delete()
            .ilike('description', `%${ticketNo}%`)

          // 5. İlgili customer_transactions temizliği
          const { data: custTxs } = await supabase
            .from('customer_transactions')
            .select('id, customer_id')
            .ilike('description', `%${ticketNo}%`)
          if (custTxs && custTxs.length > 0) {
            const custIds = Array.from(new Set(custTxs.map(ct => ct.customer_id).filter(Boolean)))
            await supabase.from('customer_transactions').delete().in('id', custTxs.map(ct => ct.id))
            for (const cId of custIds) {
              await recalculateAbsoluteCustomerBalance(cId)
            }
          }

          // 6. İlgili stock_transactions temizliği
          const { data: stockTxs } = await supabase
            .from('stock_transactions')
            .select('id, stock_id')
            .ilike('description', `%${ticketNo}%`)
          if (stockTxs && stockTxs.length > 0) {
            const stockIds = Array.from(new Set(stockTxs.map(st => st.stock_id).filter(Boolean)))
            await supabase.from('stock_transactions').delete().in('id', stockTxs.map(st => st.id))
            for (const sId of stockIds) {
              await recalculateAbsoluteStock(sId)
            }
          }

          // 7. Servis fişini tamamen sil
          const { error: delErr } = await supabase
            .from('technical_service_tickets')
            .delete()
            .eq('id', ticket.id)

          if (delErr) throw delErr

          toast.success(`${ticketNo} numaralı servis fişi silindi.`)
          setIsDetailModalOpen(false)
          setSelectedTicket(null)
          loadData()
        } catch (err: any) {
          console.error("Fiş silinirken hata:", err)
          toast.error("Fiş silinirken hata oluştu: " + err.message)
        }
      }
    })
  }

  // Tekilleştirilmiş Müşteri Listesi (Mükerrer isim/telefonları filtreler)
  const uniqueCustomers = useMemo(() => {
    const seen = new Set<string>()
    return customers.filter(c => {
      const cleanPhone = (c.phone || '').trim().replace(/\D/g, '')
      const cleanName = (c.name || '').trim().toLowerCase()
      const key = cleanPhone ? cleanPhone : cleanName
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [customers])

  useEffect(() => {
    loadData()
    fetchExchangeRates()
  }, [])

  // Otomatik şirket atama
  useEffect(() => {
    if (isRestricted && profile?.allowed_companies?.[0]) {
      setCompanyId(profile.allowed_companies[0])
      setCompanyFilter(profile.allowed_companies[0])
    } else if (companies.length > 0 && !companyId) {
      const bh = companies.find(c => c.name.toLowerCase().includes('hastane')) || companies[0]
      setCompanyId(bh.id)
    }
  }, [isRestricted, profile?.allowed_companies, companies])

  // Filtrelenmiş Biletler
  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      // Şirket İzolasyonu
      if (!isMatch(t.company_id)) return false

      // Durum Filtresi
      if (statusFilter !== 'all' && t.status !== statusFilter) return false

      // Arama Filtresi
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchNo = t.ticket_no?.toLowerCase().includes(q)
        const matchCust = t.customer_name?.toLowerCase().includes(q)
        const matchPhone = t.customer_phone?.toLowerCase().includes(q)
        const matchDevice = `${t.device_type} ${t.brand_model}`.toLowerCase().includes(q)
        const matchSerial = t.serial_no?.toLowerCase().includes(q)
        if (!matchNo && !matchCust && !matchPhone && !matchDevice && !matchSerial) return false
      }

      return true
    })
  }, [tickets, statusFilter, searchQuery, effectiveCompanyId, isRestricted])

  // İstatistik Metrikleri
  const metrics = useMemo(() => {
    const visible = tickets.filter(t => isMatch(t.company_id))
    const pending = visible.filter(t => t.status === 'pending').length
    const diagnosing = visible.filter(t => t.status === 'diagnosing').length
    const waitingAppr = visible.filter(t => t.status === 'waiting_approval').length
    const waitingParts = visible.filter(t => t.status === 'waiting_parts').length
    const ready = visible.filter(t => t.status === 'ready').length
    const delivered = visible.filter(t => t.status === 'delivered').length
    
    // Bu ayki teslim edilen servis cirosu
    const now = new Date()
    const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const monthlyRevenue = visible
      .filter(t => t.status === 'delivered' && t.delivered_at?.startsWith(thisMonthPrefix))
      .reduce((acc, t) => acc + Number(t.total_cost || 0), 0)

    return {
      total: visible.length,
      pending,
      diagnosing,
      waitingAppr,
      waitingParts,
      ready,
      delivered,
      monthlyRevenue
    }
  }, [tickets, effectiveCompanyId, isRestricted])

  // Müşteri Arama / Otomatik Doldurma
  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value
    setCustomerId(cid)
    if (cid === 'new') {
      setCustomerName('')
      setCustomerPhone('')
    } else {
      const c = customers.find(item => item.id === cid)
      if (c) {
        setCustomerName(c.name)
        setCustomerPhone(formatPhoneNumber(c.phone || ''))
      }
    }
  }

  // Yeni Cihaz Kabul Kaydı Oluştur
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerName || !brandModel || !problemDescription) {
      toast.error('Lütfen zorunlu alanları doldurun (Müşteri, Marka/Model, Arıza Şikayeti)')
      return
    }

    setSubmitting(true)
    try {
      let finalCustomerId = customerId && customerId !== 'new' ? customerId : null
      const formattedCustomerPhone = formatPhoneNumber(customerPhone).trim()

      // Eğer yeni müşteri girildiyse ve customers tablosunda yoksa telefon veya isimle kontrol et (mükerrer önleme)
      if (!finalCustomerId && customerName) {
        const cleanPhone = customerPhone.trim().replace(/\D/g, '')
        const existingCust = cleanPhone
          ? customers.find(c => (c.phone || '').trim().replace(/\D/g, '') === cleanPhone)
          : customers.find(c => c.name.toLowerCase().trim() === customerName.toLowerCase().trim())

        if (existingCust) {
          finalCustomerId = existingCust.id
        } else {
          const { data: newCust, error: custErr } = await supabase
            .from('customers')
            .insert([{
              name: customerName.trim(),
              phone: formattedCustomerPhone,
              currency: 'TRY',
              balance: 0
            }])
            .select()
            .single()

          if (!custErr && newCust) {
            finalCustomerId = newCust.id
            setCustomers(prev => [...prev, newCust])
          }
        }
      }

      // Rastgele yedek bilet no (DB trigger zaten set_ticket_no ile ezecek veya kullanacak)
      const yy = new Date().getFullYear().toString().slice(-2)
      const fallbackNo = `SRV-${yy}-${1000 + tickets.length + 1}`

      const payload: any = {
        ticket_no: fallbackNo,
        company_id: companyId || null,
        customer_id: finalCustomerId,
        customer_name: customerName.trim(),
        customer_phone: formattedCustomerPhone,
        device_type: deviceType,
        brand_model: brandModel.trim(),
        serial_no: serialNo.trim(),
        device_password: devicePassword.trim(),
        accessories: accessories.trim(),
        physical_condition: physicalCondition.trim(),
        problem_description: problemDescription.trim(),
        technician_notes: '',
        status: 'pending',
        estimated_cost: parseFloat(estimatedCost) || 0,
        labor_cost: parseFloat(estimatedCost) || 0,
        parts_cost: 0,
        total_cost: parseFloat(estimatedCost) || 0,
        used_parts: [],
        performed_services: (parseFloat(estimatedCost) || 0) > 0 
          ? [{ name: 'Cihaz Onarım & Servis Bedeli', price: parseFloat(estimatedCost) || 0 }] 
          : [],
        payment_status: 'unpaid',
        received_at: new Date().toISOString(),
        marketing_consent: marketingConsent
      }

      let insertRes = await supabase
        .from('technical_service_tickets')
        .insert([payload])
        .select('*, company:companies(name, is_personal)')
        .single()

      if (insertRes.error && insertRes.error.message?.includes('marketing_consent')) {
        delete payload.marketing_consent
        insertRes = await supabase
          .from('technical_service_tickets')
          .insert([payload])
          .select('*, company:companies(name, is_personal)')
          .single()
      }

      if (insertRes.error) throw insertRes.error
      const data = insertRes.data

      toast.success(`Cihaz kabul edildi: ${data.ticket_no}`)
      setTickets(prev => [data, ...prev])
      setIsCreateModalOpen(false)

      // Anında yazdırma öner
      setPrintTicket(data)

      // Formu temizle
      setCustomerId('')
      setCustomerName('')
      setCustomerPhone('')
      setBrandModel('')
      setSerialNo('')
      setDevicePassword('')
      setAccessories('')
      setPhysicalCondition('')
      setProblemDescription('')
      setEstimatedCost('')
    } catch (err: any) {
      console.error('Kayıt oluşturma hatası:', err)
      if (err?.message?.includes('technical_service_tickets') && err?.message?.includes('schema cache')) {
        setTableMissing(true)
        toast.error('Veritabanı tablosu henüz açılmamış! Lütfen Supabase SQL Editor üzerinden technical_service.sql dosyasını çalıştırın.', { duration: 7000 })
      } else {
        toast.error('Kayıt oluşturulamadı: ' + (err.message || 'Bilinmeyen hata'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Detay Modalını Aç
  const openDetailModal = (t: TechnicalTicket) => {
    setSelectedTicket(t)
    setDetailStatus(t.status)
    setDetailTechNotes(t.technician_notes || '')
    setUsedParts(t.used_parts || [])

    // Dış Servis (Tedarikçi) State'leri
    setIsExternalService(Boolean(t.is_external_service))
    setSelectedSupplierId(t.supplier_id || '')
    setExternalServiceCost(t.supplier_cost ? t.supplier_cost.toString() : '')
    setExternalServiceStatus(t.external_service_status || 'sent_to_supplier')

    // Kabul Bilgilerini Düzenleme (Intake Edit) State'leri
    setIsEditingIntake(false)
    setEditCustomerName(t.customer_name || '')
    setEditCustomerPhone(formatPhoneNumber(t.customer_phone || ''))
    setEditDeviceType(t.device_type || 'Laptop')
    setEditBrandModel(t.brand_model || '')
    setEditSerialNo(t.serial_no || '')
    setEditDevicePassword(t.device_password || '')
    setEditAccessories(t.accessories || '')
    setEditPhysicalCondition(t.physical_condition || '')
    setEditProblemDescription(t.problem_description || '')

    // Önceden tanımlanmış işçilikler varsa kullan, yoksa ve ön tahmin varsa otomatik ön tahmini servis bedeli yap
    let currentServices = t.performed_services || []
    if (currentServices.length === 0 && (!t.used_parts || t.used_parts.length === 0) && t.estimated_cost > 0) {
      currentServices = [{ name: 'Cihaz Onarım & Servis Bedeli', price: t.estimated_cost }]
    }
    setPerformedServices(currentServices)

    const initialQuickVal = t.total_cost > 0 ? t.total_cost : (t.estimated_cost > 0 ? t.estimated_cost : 0)
    setQuickPriceInput(initialQuickVal > 0 ? initialQuickVal.toString() : '')

    setPaymentMethod((t.payment_method as any) || 'cash')
    setPaymentTargetId(t.payment_target_id || '')
    setSelectedServiceId('')
    setSelectedServicePrice('')
    setSelectedStockId('')
    setSelectedPartPrice('')
    setStockQty('1')
    setCustomLaborName('')
    setCustomLaborPrice('')
    setIsDetailModalOpen(true)
  }

  // Hızlı Tamir Ücreti Uygula / Güncelle
  const handleApplyQuickPrice = (amount?: number) => {
    const val = amount !== undefined ? amount : (parseFloat(quickPriceInput) || 0)
    if (val < 0) return

    setPerformedServices(prev => {
      const others = prev.filter(s => s.name !== 'Cihaz Onarım & Servis Bedeli' && s.name !== 'Genel Tamir Bedeli')
      if (val > 0) {
        return [{ name: 'Cihaz Onarım & Servis Bedeli', price: val }, ...others]
      }
      return others
    })
    setQuickPriceInput(val > 0 ? val.toString() : '')
    toast.success(`Tamir servis bedeli ${formatMoney(val, 'TRY').formatted} olarak belirlendi!`)
  }

  // Yedek Parça Ekle
  const handleAddPart = () => {
    if (!selectedStockId) return
    const stock = stocks.find(s => s.id === selectedStockId)
    if (!stock) return

    const qty = parseInt(stockQty) || 1
    const unitPriceTry = selectedPartPrice !== '' ? (parseFloat(selectedPartPrice) || 0) : getTryPrice(stock.unit_price, stock.currency)
    const total = Number((qty * unitPriceTry).toFixed(2))

    const newPart: UsedPart = {
      stock_id: stock.id,
      name: stock.name,
      quantity: qty,
      unit_price: unitPriceTry,
      total
    }

    setUsedParts(prev => [...prev, newPart])
    setSelectedStockId('')
    setSelectedPartPrice('')
    setStockQty('1')
  }

  const handleRemovePart = (index: number) => {
    setUsedParts(prev => prev.filter((_, i) => i !== index))
  }

  // Tanımlı Hizmet Ekle
  const handleAddDefinedService = () => {
    if (!selectedServiceId) return
    const srv = services.find(s => s.id === selectedServiceId)
    if (srv) {
      const finalPrice = selectedServicePrice !== '' ? (parseFloat(selectedServicePrice) || 0) : srv.unit_price
      setPerformedServices(prev => [...prev, { service_id: srv.id, name: srv.name, price: Number(finalPrice) }])
      setSelectedServiceId('')
      setSelectedServicePrice('')
      toast.success(`"${srv.name}" fişe eklendi.`)
    }
  }

  // Özel İşçilik Ekle
  const handleAddCustomLabor = () => {
    const price = parseFloat(customLaborPrice) || 0
    if (price <= 0 && (!customLaborPrice || customLaborPrice.trim() === '')) {
      toast.error('Lütfen geçerli bir işçilik tutarı girin.')
      return
    }
    const name = customLaborName.trim() || 'Servis & Onarım İşçiliği'
    setPerformedServices(prev => [...prev, { name, price }])
    setCustomLaborName('')
    setCustomLaborPrice('')
    toast.success(`"${name}" (${formatMoney(price, 'TRY').formatted}) fişe eklendi.`)
  }

  // Geriye dönük uyumluluk fonksiyonu
  const handleAddService = () => {
    if (selectedServiceId) {
      handleAddDefinedService()
    } else if (customLaborPrice) {
      handleAddCustomLabor()
    }
  }

  const handleRemoveService = (index: number) => {
    setPerformedServices(prev => prev.filter((_, i) => i !== index))
  }

  // Toplam Tutar Hesaplama
  const calcPartsCost = usedParts.reduce((acc, p) => acc + (Number(p.total) || 0), 0)
  const calcLaborCost = performedServices.reduce((acc, s) => acc + (Number(s.price) || 0), 0)
  const calcTotalCost = calcPartsCost + calcLaborCost

  // Bilet Detaylarını & Durumunu Kaydet
  const handleSaveTicketDetails = async () => {
    if (!selectedTicket) return
    setSubmitting(true)

    try {
      const isDeliveredNow = detailStatus === 'delivered' && selectedTicket.status !== 'delivered'
      const isCompletedNow = (detailStatus === 'ready' || detailStatus === 'delivered') && !selectedTicket.completed_at
      const shouldProcessPayment = detailStatus === 'delivered' && (isDeliveredNow || selectedTicket.payment_status === 'unpaid')

      const updates: any = {
        status: detailStatus,
        technician_notes: detailTechNotes,
        used_parts: usedParts,
        performed_services: performedServices,
        parts_cost: calcPartsCost,
        labor_cost: calcLaborCost,
        total_cost: calcTotalCost,
        updated_at: new Date().toISOString()
      }

      // Kabul bilgilerinde düzeltme yapıldıysa güncelle
      if (isEditingIntake) {
        updates.customer_name = editCustomerName.trim()
        updates.customer_phone = formatPhoneNumber(editCustomerPhone).trim()
        updates.device_type = editDeviceType
        updates.brand_model = editBrandModel.trim()
        updates.serial_no = editSerialNo.trim()
        updates.device_password = editDevicePassword.trim()
        updates.accessories = editAccessories.trim()
        updates.physical_condition = editPhysicalCondition.trim()
        updates.problem_description = editProblemDescription.trim()
      }

      // Dış Servis / Fason Onarım Bilgileri
      const suppCostNum = parseFloat(externalServiceCost) || 0
      updates.is_external_service = isExternalService
      updates.supplier_id = isExternalService && selectedSupplierId ? selectedSupplierId : null
      updates.supplier_cost = isExternalService ? suppCostNum : 0
      updates.external_service_status = isExternalService ? externalServiceStatus : 'none'

      // Tedarikçi Fason İşlem Kaydı Entegrasyonu
      const descPrefix = `Dış Servis / Fason: ${selectedTicket.ticket_no}`
      if (isExternalService && selectedSupplierId && suppCostNum > 0) {
        const { data: existingSuppTx } = await supabase
          .from('supplier_transactions')
          .select('id, supplier_id')
          .like('description', `${descPrefix}%`)
          .maybeSingle()

        if (existingSuppTx) {
          await supabase.from('supplier_transactions').update({
            supplier_id: selectedSupplierId,
            company_id: selectedTicket.company_id,
            amount: suppCostNum,
            description: `${descPrefix} - ${updates.brand_model || selectedTicket.brand_model}`
          }).eq('id', existingSuppTx.id)

          if (existingSuppTx.supplier_id !== selectedSupplierId) {
            await recalculateAbsoluteSupplierBalance(existingSuppTx.supplier_id)
          }
        } else {
          await supabase.from('supplier_transactions').insert([{
            supplier_id: selectedSupplierId,
            company_id: selectedTicket.company_id,
            tx_date: new Date().toISOString().substring(0, 10),
            description: `${descPrefix} - ${updates.brand_model || selectedTicket.brand_model}`,
            tx_type: 'debt',
            amount: suppCostNum,
            currency: 'TRY',
            exchange_rate: 1
          }])
        }
        await recalculateAbsoluteSupplierBalance(selectedSupplierId)
      } else {
        const { data: existingSuppTx } = await supabase
          .from('supplier_transactions')
          .select('id, supplier_id')
          .like('description', `${descPrefix}%`)
          .maybeSingle()

        if (existingSuppTx) {
          await supabase.from('supplier_transactions').delete().eq('id', existingSuppTx.id)
          await recalculateAbsoluteSupplierBalance(existingSuppTx.supplier_id)
        }
      }

      if (isCompletedNow) {
        updates.completed_at = new Date().toISOString()
      }

      if (detailStatus === 'delivered' && !selectedTicket.delivered_at) {
        updates.delivered_at = new Date().toISOString()
      }

      // Cihaz şimdi teslim ediliyorsa veya teslim edilmişse tahsilat işlemlerini gerçekleştir (mükerrer kayıt engeliyle)
      if (detailStatus === 'delivered') {
        const payDescPrefix = `Teknik Servis Tahsilatı: ${selectedTicket.ticket_no}`
        const debtDescPrefix = `Teknik Servis Borcu: ${selectedTicket.ticket_no}`
        const cardDescPrefix = `Teknik Servis Kart Tahsilatı: ${selectedTicket.ticket_no}`

        const { data: existingCashTx } = await supabase
          .from('cash_transactions')
          .select('id, amount, cash_register_id')
          .like('description', `${payDescPrefix}%`)
          .maybeSingle()

        const { data: existingBankTx } = await supabase
          .from('bank_transactions')
          .select('id, amount, bank_account_id')
          .like('description', `${cardDescPrefix}%`)
          .maybeSingle()

        const { data: existingCustTx } = await supabase
          .from('customer_transactions')
          .select('id, amount, customer_id')
          .like('description', `${debtDescPrefix}%`)
          .maybeSingle()

        const hasAnyExistingPayment = Boolean(existingCashTx || existingBankTx || existingCustTx)

        if (paymentMethod === 'free') {
          updates.payment_status = 'paid'
          updates.payment_method = 'free'
          if (existingCashTx) {
            await supabase.from('cash_transactions').delete().eq('id', existingCashTx.id)
            const c = cashes.find(x => x.id === existingCashTx.cash_register_id)
            if (c) await supabase.from('cash_registers').update({ balance: Number(c.balance || 0) - Number(existingCashTx.amount) }).eq('id', c.id)
          }
        } else if (calcTotalCost > 0) {
          if (paymentMethod === 'cash') {
            const cash = cashes.find(c => c.id === paymentTargetId) || cashes[0]
            if (cash) {
              if (existingCashTx) {
                // Önceden bu bilet için nakit tahsilat varsa ve tutar değiştiyse güncelle, ASLA mükerrer satır ekleme
                const diff = calcTotalCost - Number(existingCashTx.amount)
                if (diff !== 0) {
                  await supabase.from('cash_transactions').update({
                    amount: calcTotalCost,
                    description: `${payDescPrefix} - ${updates.customer_name || selectedTicket.customer_name}`
                  }).eq('id', existingCashTx.id)

                  await supabase.from('cash_registers').update({
                    balance: Number(cash.balance || 0) + diff
                  }).eq('id', cash.id)
                }
              } else if (!hasAnyExistingPayment) {
                await supabase.from('cash_transactions').insert([{
                  cash_register_id: cash.id,
                  company_id: selectedTicket.company_id,
                  tx_date: new Date().toISOString().substring(0, 10),
                  description: `${payDescPrefix} - ${updates.customer_name || selectedTicket.customer_name}`,
                  tx_type: 'in',
                  amount: calcTotalCost,
                  currency: 'TRY',
                  exchange_rate: 1
                }])
                await supabase.from('cash_registers').update({
                  balance: Number(cash.balance || 0) + calcTotalCost
                }).eq('id', cash.id)
              }
              updates.payment_status = 'paid'
              updates.payment_method = 'cash'
              updates.payment_target_id = cash.id
            }
          } else if (paymentMethod === 'card') {
            const bank = banks.find(b => b.id === paymentTargetId) || banks[0]
            if (bank) {
              if (existingBankTx) {
                const diff = calcTotalCost - Number(existingBankTx.amount)
                if (diff !== 0) {
                  await supabase.from('bank_transactions').update({
                    amount: calcTotalCost,
                    description: `${cardDescPrefix} - ${updates.customer_name || selectedTicket.customer_name}`
                  }).eq('id', existingBankTx.id)

                  await supabase.from('bank_accounts').update({
                    balance: Number(bank.balance || 0) + diff
                  }).eq('id', bank.id)
                }
              } else if (!hasAnyExistingPayment) {
                await supabase.from('bank_transactions').insert([{
                  bank_account_id: bank.id,
                  company_id: selectedTicket.company_id,
                  tx_date: new Date().toISOString().substring(0, 10),
                  description: `${cardDescPrefix} - ${updates.customer_name || selectedTicket.customer_name}`,
                  tx_type: 'in',
                  status: 'completed',
                  amount: calcTotalCost,
                  currency: 'TRY',
                  exchange_rate: 1
                }])
                await supabase.from('bank_accounts').update({
                  balance: Number(bank.balance || 0) + calcTotalCost
                }).eq('id', bank.id)
              }
              updates.payment_status = 'paid'
              updates.payment_method = 'card'
              updates.payment_target_id = bank.id
            }
          } else if (paymentMethod === 'customer_debt' && selectedTicket.customer_id) {
            if (existingCustTx) {
              const diff = calcTotalCost - Number(existingCustTx.amount)
              if (diff !== 0) {
                await supabase.from('customer_transactions').update({
                  amount: calcTotalCost,
                  description: `${debtDescPrefix} - ${updates.brand_model || selectedTicket.brand_model}`
                }).eq('id', existingCustTx.id)

                const cust = customers.find(c => c.id === selectedTicket.customer_id)
                if (cust) {
                  await supabase.from('customers').update({
                    balance: Number(cust.balance || 0) + diff
                  }).eq('id', cust.id)
                }
              }
            } else if (!hasAnyExistingPayment) {
              await supabase.from('customer_transactions').insert([{
                customer_id: selectedTicket.customer_id,
                company_id: selectedTicket.company_id,
                tx_date: new Date().toISOString().substring(0, 10),
                description: `${debtDescPrefix} - ${updates.brand_model || selectedTicket.brand_model}`,
                tx_type: 'debt',
                amount: calcTotalCost,
                currency: 'TRY',
                exchange_rate: 1
              }])
              const cust = customers.find(c => c.id === selectedTicket.customer_id)
              if (cust) {
                await supabase.from('customers').update({
                  balance: Number(cust.balance || 0) + calcTotalCost
                }).eq('id', cust.id)
              }
            }
            updates.payment_status = 'debt_added'
            updates.payment_method = 'customer_debt'
          }
        }
      }

      // =========================================================================
      // KULLANILAN YEDEK PARÇALARIN STOK HAREKETİ SENKRONİZASYONU
      // =========================================================================
      const stockDescPrefix = `Servis Parça Çıkışı: ${selectedTicket.ticket_no}`
      const affectedStockIds = new Set<string>()

      // 1. Bu bilet için önceden oluşturulmuş tüm parça çıkış hareketlerini bul
      const { data: oldStockTxs } = await supabase
        .from('stock_transactions')
        .select('id, stock_id')
        .ilike('description', `${stockDescPrefix}%`)

      if (oldStockTxs && oldStockTxs.length > 0) {
        for (const ot of oldStockTxs) {
          if (ot.stock_id) affectedStockIds.add(ot.stock_id)
        }
        await supabase.from('stock_transactions').delete().in('id', oldStockTxs.map(ot => ot.id))
      }

      // 2. Eğer fiş iptal edilmediyse ve parçalar depodan düşülecekse hareketleri ekle
      if (detailStatus !== 'cancelled' && deductPartsFromStock && usedParts && usedParts.length > 0) {
        const stockInserts: any[] = []
        for (const part of usedParts) {
          if (part.stock_id && Number(part.quantity) > 0) {
            affectedStockIds.add(part.stock_id)
            stockInserts.push({
              stock_id: part.stock_id,
              company_id: selectedTicket.company_id || null,
              tx_date: new Date().toISOString().substring(0, 10),
              description: `${stockDescPrefix} (${part.name})`,
              tx_type: 'out',
              quantity: Number(part.quantity),
              unit_price: Number(part.unit_price) || 0,
              currency: 'TRY',
              vat_rate: 0
            })
          }
        }
        if (stockInserts.length > 0) {
          const { error: sInsErr } = await supabase.from('stock_transactions').insert(stockInserts)
          if (sInsErr) console.error("Stok parça çıkış hatası:", sInsErr)
        }
      }

      // 3. Etkilenen tüm stokların mutlak bakiyesini hesapla ve güncelle
      for (const sId of Array.from(affectedStockIds)) {
        await recalculateAbsoluteStock(sId)
      }
      // =========================================================================

      let updateRes = await supabase
        .from('technical_service_tickets')
        .update(updates)
        .eq('id', selectedTicket.id)
        .select('*, company:companies(name, is_personal)')
        .single()

      if (updateRes.error && (updateRes.error.message?.includes('supplier_id') || updateRes.error.message?.includes('is_external_service'))) {
        delete updates.is_external_service
        delete updates.supplier_id
        delete updates.supplier_cost
        delete updates.external_service_status
        updateRes = await supabase
          .from('technical_service_tickets')
          .update(updates)
          .eq('id', selectedTicket.id)
          .select('*, company:companies(name, is_personal)')
          .single()
        toast.error('Dış servis sütunları için Supabase SQL Editöründe migration_technical_service_supplier.sql dosyasını çalıştırmalısınız.', { duration: 6000 })
      }

      if (updateRes.error) throw updateRes.error
      const data = updateRes.data

      toast.success('Servis kaydı güncellendi.')
      setTickets(prev => prev.map(t => t.id === data.id ? data : t))
      setSelectedTicket(data)
      setIsEditingIntake(false)
      setIsDetailModalOpen(false)
    } catch (err: any) {
      console.error('Güncelleme hatası:', err)
      toast.error('Güncellenemedi: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Hızlı Durum Güncelleme (Kanban Sürükle-Bırak veya Hızlı Tık)
  const handleQuickStatusChange = async (t: TechnicalTicket, newStatus: TicketStatus) => {
    try {
      const updates: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      }
      if (newStatus === 'ready' && !t.completed_at) {
        updates.completed_at = new Date().toISOString()
      }

      if (newStatus === 'cancelled') {
        const { data: stockTxs } = await supabase
          .from('stock_transactions')
          .select('id, stock_id')
          .ilike('description', `%${t.ticket_no}%`)
        if (stockTxs && stockTxs.length > 0) {
          const stockIds = Array.from(new Set(stockTxs.map(st => st.stock_id).filter(Boolean)))
          await supabase.from('stock_transactions').delete().in('id', stockTxs.map(st => st.id))
          for (const sId of stockIds) {
            await recalculateAbsoluteStock(sId)
          }
        }
      }

      const { data, error } = await supabase
        .from('technical_service_tickets')
        .update(updates)
        .eq('id', t.id)
        .select('*, company:companies(name, is_personal)')
        .single()

      if (error) throw error

      setTickets(prev => prev.map(item => item.id === t.id ? data : item))
      toast.success(`${t.ticket_no} durumu güncellendi: ${STATUS_CONFIG[newStatus].label}`)
    } catch (err: any) {
      toast.error('Durum değiştirilemedi: ' + err.message)
    }
  }

  // WhatsApp Mesajı Gönder
  const handleSendWhatsApp = (t: TechnicalTicket) => {
    if (!t.customer_phone) {
      toast.error('Müşteriye ait telefon numarası kayıtlı değil.')
      return
    }

    let phone = t.customer_phone.replace(/\D/g, '')
    if (phone.startsWith('0')) phone = '9' + phone
    if (!phone.startsWith('90') && phone.length === 10) phone = '90' + phone

    const companyName = t.company?.name || 'Bilgisayar Hastanesi'
    let message = ''

    if (t.status === 'pending') {
      message = `Sayın ${t.customer_name}, ${companyName}'ne bıraktığınız ${t.brand_model} cihazınız teknik servisimize kabul edilmiştir. Servis Takip Numaranız: ${t.ticket_no}. Cihazınız sıraya alınmış olup arıza tespiti yapılmaktadır.`
    } else if (t.status === 'waiting_approval') {
      message = `Sayın ${t.customer_name}, ${companyName}'ndeki ${t.brand_model} (${t.ticket_no}) cihazınızın arıza tespiti tamamlanmıştır. Tahmini onarım tutarı: ${formatMoney(t.total_cost || t.estimated_cost, 'TRY').formatted}'dir. İşleme devam edebilmemiz için onayınızı rica ederiz.`
    } else if (t.status === 'ready') {
      message = `Sayın ${t.customer_name}, ${companyName}'ne bıraktığınız ${t.brand_model} (${t.ticket_no}) cihazınızın bakım ve onarım işlemleri başarıyla tamamlanmıştır. Toplam tutar: ${formatMoney(t.total_cost, 'TRY').formatted}'dir. Cihazınızı mağazamızdan teslim alabilirsiniz.`
    } else if (t.status === 'delivered') {
      message = `Sayın ${t.customer_name}, ${t.brand_model} (${t.ticket_no}) cihazınız teslim edilmiştir. ${companyName}'ni tercih ettiğiniz için teşekkür eder, iyi günlerde kullanmanızı dileriz.`
    } else {
      message = `Sayın ${t.customer_name}, ${companyName}'ndeki ${t.brand_model} (${t.ticket_no}) cihazınızın durumu güncellenmiştir: ${STATUS_CONFIG[t.status].label}.`
    }

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  return (
    <div className="space-y-4 pb-12 max-w-[1650px] mx-auto">
      <Toaster 
        position="bottom-right" 
        containerStyle={{ zIndex: 99999999 }} 
        toastOptions={{ 
          duration: 4000,
          style: { background: '#0f172a', color: '#fff', border: '1px solid #1e293b', fontSize: '12px' } 
        }} 
      />

      {/* VERİTABANI TABLOSU EKSİKSE BİLGİLENDİRME UYARISI */}
      {tableMissing && (
        <div className="bg-amber-950/40 border border-amber-500/50 p-4 rounded-2xl flex items-start gap-3 text-amber-200 animate-in fade-in duration-200 shadow-xl">
          <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={20} />
          <div className="text-xs space-y-1">
            <span className="font-bold block text-sm text-white flex items-center gap-1.5">
              ⚠️ Veritabanı Tablosu Henüz Açılmadı!
            </span>
            <p className="text-amber-300/90 leading-relaxed">
              Cihaz kabul kayıtlarının veritabanına yazılabilmesi için Supabase üzerinde <strong>technical_service_tickets</strong> tablosunun oluşturulması gerekmektedir.
              Lütfen Supabase Dashboard ➔ <strong>SQL Editor</strong> sayfasına giderek projenizdeki <code>supabase/technical_service.sql</code> dosyasının içeriğini yapıştırıp <strong>RUN</strong> butonuna basınız.
            </p>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 1. ÜST BAŞLIK & ŞİRKET KİLİTLİ SEÇİCİ & AKSİYON BUTONLARI              */}
      {/* ===================================================================== */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-[#0d1322] border border-slate-800/80 px-4 py-3 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-lg shadow-indigo-600/10">
            <Wrench size={22} />
          </div>
          <div>
            <h1 className="text-base lg:text-lg font-black text-white flex items-center gap-2">
              Teknik Servis & Cihaz Takip
            </h1>
            <p className="text-[10px] text-slate-400">
              Cihaz kabul, arıza tespiti, yedek parça ve teslimat yönetimi
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">
          {/* Şirket Filtresi / Rozeti */}
          <div className="flex items-center gap-1.5 bg-[#070b14] border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold">
            <Building2 size={13} className="text-indigo-400" />
            {isRestricted ? (
              <span className="text-white flex items-center gap-1">
                {companies.find(c => c.id === effectiveCompanyId)?.name || 'Bilgisayar Hastanesi'}
                <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/40 flex items-center gap-1 ml-1">
                  <Lock size={8} /> Kilitli
                </span>
              </span>
            ) : (
              <select
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer pr-1"
              >
                <option value="all" className="bg-[#0f172a] text-white">🌍 Tüm Şubeler / Şirketler</option>
                {companies.filter(c => !c.is_personal).map(c => (
                  <option key={c.id} value={c.id} className="bg-[#0f172a] text-slate-200">{c.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Görünüm Değiştirici: Kanban vs Liste */}
          <div className="flex items-center bg-[#070b14] border border-slate-800 rounded-xl p-0.5">
            <button
              onClick={() => setViewMode('kanban')}
              title="Kanban Pano"
              className={`p-1.5 rounded-lg transition cursor-pointer ${viewMode === 'kanban' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              <LayoutGrid size={15} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="Liste Tablosu"
              className={`p-1.5 rounded-lg transition cursor-pointer ${viewMode === 'list' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              <List size={15} />
            </button>
          </div>

          <button
            onClick={loadData}
            title="Yenile"
            className="p-2 bg-[#070b14] border border-slate-800 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* SMS İzinleri Butonu */}
          <a
            href="/customers?sms=open"
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition shadow-sm"
            title="SMS & Ticari İleti İzni Veren Müşteriler Listesi"
          >
            <MessageSquare size={14} />
            <span className="hidden sm:inline">SMS İzinleri</span>
          </a>

          {/* Yeni Cihaz Kabul Butonu */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition cursor-pointer"
          >
            <Plus size={15} strokeWidth={3} />
            <span>Yeni Cihaz Kabul</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. KPI / METRİK ŞERİDİ                                                */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
        <div className="bg-[#0d1322] border border-slate-800/80 p-2.5 rounded-xl flex flex-col justify-between">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Clock size={11} className="text-amber-400" /> Sırada Bekleyen
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg font-black text-amber-400 font-mono">{metrics.pending}</span>
            <span className="text-[9px] text-slate-500">cihaz</span>
          </div>
        </div>

        <div className="bg-[#0d1322] border border-slate-800/80 p-2.5 rounded-xl flex flex-col justify-between">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Cpu size={11} className="text-blue-400" /> İncelemede
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg font-black text-blue-400 font-mono">{metrics.diagnosing}</span>
            <span className="text-[9px] text-slate-500">cihaz</span>
          </div>
        </div>

        <div className="bg-[#0d1322] border border-slate-800/80 p-2.5 rounded-xl flex flex-col justify-between">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle size={11} className="text-orange-400" /> Onay Bekleyen
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg font-black text-orange-400 font-mono">{metrics.waitingAppr}</span>
            <span className="text-[9px] text-slate-500">cihaz</span>
          </div>
        </div>

        <div className="bg-[#0d1322] border border-slate-800/80 p-2.5 rounded-xl flex flex-col justify-between">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Package size={11} className="text-purple-400" /> Parça Bekleyen
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg font-black text-purple-400 font-mono">{metrics.waitingParts}</span>
            <span className="text-[9px] text-slate-500">cihaz</span>
          </div>
        </div>

        <div className="bg-[#0d1322] border border-slate-800/80 p-2.5 rounded-xl flex flex-col justify-between">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 size={11} className="text-emerald-400" /> Teslime Hazır
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg font-black text-emerald-400 font-mono">{metrics.ready}</span>
            <span className="text-[9px] text-emerald-500 font-bold">TAMAM</span>
          </div>
        </div>

        <div className="bg-[#0d1322] border border-slate-800/80 p-2.5 rounded-xl flex flex-col justify-between">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <ShieldCheck size={11} className="text-slate-400" /> Teslim Edilen
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-lg font-black text-slate-200 font-mono">{metrics.delivered}</span>
            <span className="text-[9px] text-slate-500">toplam</span>
          </div>
        </div>

        <div className="bg-[#0d1322] border border-indigo-500/30 bg-gradient-to-br from-indigo-950/30 to-[#0d1322] p-2.5 rounded-xl flex flex-col justify-between shadow-lg shadow-indigo-950/20">
          <span className="text-[9px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1">
            <Sparkles size={11} className="text-indigo-400" /> Bu Ay Servis Cirosu
          </span>
          <div className="mt-1 font-mono">
            <span className="text-sm lg:text-base font-black text-indigo-300">
              {formatMoney(metrics.monthlyRevenue, 'TRY').formatted}
            </span>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. ARAMA VE AŞAMA FİLTRE ÇUBUĞU                                        */}
      {/* ===================================================================== */}
      <div className="bg-[#0d1322] border border-slate-800/80 p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
        {/* Arama Kutusu */}
        <div className="relative w-full sm:w-96">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Fiş no, müşteri, telefon, marka veya seri no..."
            className="w-full pl-9 pr-8 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Aşama Butonları (Hızlı Filtre Çipleri) */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar w-full sm:w-auto pb-1 sm:pb-0 text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl font-bold transition text-[11px] whitespace-nowrap cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-[#070b14] border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Tümü ({tickets.filter(t => isMatch(t.company_id)).length})
          </button>

          {(Object.keys(STATUS_CONFIG) as TicketStatus[]).map((stKey) => {
            const cfg = STATUS_CONFIG[stKey]
            const count = tickets.filter(t => isMatch(t.company_id) && t.status === stKey).length
            const isSelected = statusFilter === stKey

            return (
              <button
                key={stKey}
                onClick={() => setStatusFilter(stKey)}
                className={`px-2.5 py-1.5 rounded-xl font-bold transition text-[11px] whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? `${cfg.bg} ${cfg.text} border ${cfg.border} ring-1 ring-indigo-500/50 shadow-sm`
                    : 'bg-[#070b14] border border-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>{cfg.label.split(' ')[0]}</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded-md ${isSelected ? 'bg-black/30' : 'bg-slate-800'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 4. ANA İÇERİK: KANBAN PANO GÖRÜNÜMÜ                                   */}
      {/* ===================================================================== */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 items-start min-h-[550px]">
          {(['pending', 'diagnosing', 'waiting_approval', 'waiting_parts', 'ready', 'delivered'] as TicketStatus[]).map((columnStatus) => {
            const colCfg = STATUS_CONFIG[columnStatus]
            const colTickets = filteredTickets.filter(t => t.status === columnStatus)
            const ColIcon = colCfg.icon

            return (
              <div key={columnStatus} className="bg-[#0a0f1d] border border-slate-800/80 rounded-2xl flex flex-col max-h-[750px] shadow-xl overflow-hidden">
                {/* Sütun Başlığı */}
                <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`p-1.5 rounded-lg ${colCfg.bg} ${colCfg.text}`}>
                      <ColIcon size={14} />
                    </div>
                    <span className="font-bold text-xs text-slate-200 truncate">{colCfg.label.split('(')[0].trim()}</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-slate-800 px-2 py-0.5 rounded-md text-slate-300">
                    {colTickets.length}
                  </span>
                </div>

                {/* Sütun Kartları (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 custom-scrollbar min-h-[150px]">
                  {colTickets.length === 0 ? (
                    <div className="h-28 border border-dashed border-slate-800/80 rounded-xl flex items-center justify-center text-center p-3 text-slate-600 text-[10px]">
                      Bu aşamada cihaz yok
                    </div>
                  ) : (
                    colTickets.map((ticket) => {
                      return (
                        <div
                          key={ticket.id}
                          onClick={() => openDetailModal(ticket)}
                          className="bg-[#0d1322] border border-slate-800/90 hover:border-indigo-500/60 p-3 rounded-xl shadow-md transition-all hover:-translate-y-0.5 cursor-pointer group space-y-2"
                        >
                          {/* Üst Satır: Fiş No & Cihaz Türü */}
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-black text-indigo-400 text-xs flex items-center gap-1">
                              <Barcode size={12} className="opacity-70" />
                              {ticket.ticket_no}
                            </span>
                            <div className="flex items-center gap-1">
                              {ticket.is_external_service && (
                                <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                                  <Truck size={9} /> Dış Servis
                                </span>
                              )}
                              <span className="text-[9px] bg-slate-800/90 text-slate-400 px-1.5 py-0.5 rounded font-medium">
                                {ticket.device_type}
                              </span>
                            </div>
                          </div>

                          {/* Cihaz Marka Model */}
                          <div>
                            <h4 className="text-white font-bold text-xs truncate group-hover:text-indigo-300 transition-colors">
                              {ticket.brand_model}
                            </h4>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5 flex items-center gap-1">
                              <User size={10} className="text-slate-500" />
                              {ticket.customer_name}
                            </p>
                          </div>

                          {/* Şikayet Özeti */}
                          <div className="bg-[#070b14] p-1.5 rounded-lg border border-slate-800/50 text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
                            {ticket.problem_description}
                          </div>

                          {/* Alt Satır: Tutar & Hızlı Butonlar */}
                          <div className="pt-1.5 border-t border-slate-800/70 flex items-center justify-between text-[10px]">
                            <div className="font-mono font-bold text-emerald-400">
                              {ticket.total_cost > 0 ? (
                                formatMoney(ticket.total_cost, 'TRY').formatted
                              ) : ticket.estimated_cost > 0 ? (
                                <span className="text-slate-500 text-[9px]">Tah: {formatMoney(ticket.estimated_cost, 'TRY').formatted}</span>
                              ) : (
                                <span className="text-slate-600 text-[9px]">Fiyat yok</span>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); setPrintTicket(ticket); }}
                                title="Kabul Fişi Yazdır"
                                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
                              >
                                <Printer size={12} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleSendWhatsApp(ticket); }}
                                title="WhatsApp Bilgilendirmesi Gönder"
                                className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition cursor-pointer"
                              >
                                <MessageSquare size={12} />
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteTicket(ticket); }}
                                title="Servis Fişini Sil"
                                className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition cursor-pointer"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ===================================================================== */
        /* 5. TABLO / LİSTE GÖRÜNÜMÜ                                             */
        /* ===================================================================== */
        <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900/70 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                  <th className="py-3 px-4">Fiş No</th>
                  <th className="py-3 px-4">Müşteri</th>
                  <th className="py-3 px-4">Cihaz</th>
                  <th className="py-3 px-4">Arıza / Şikayet</th>
                  <th className="py-3 px-4">Durum</th>
                  <th className="py-3 px-4">Tutar</th>
                  <th className="py-3 px-4">Tarih</th>
                  <th className="py-3 px-4 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      Servis kayıtları yükleniyor...
                    </td>
                  </tr>
                ) : filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      {searchQuery ? 'Aramanıza uygun cihaz kaydı bulunamadı.' : 'Henüz servis kaydı bulunmuyor.'}
                    </td>
                  </tr>
                ) : (
                  filteredTickets.map((t) => {
                    const stCfg = STATUS_CONFIG[t.status]
                    return (
                      <tr
                        key={t.id}
                        onClick={() => openDetailModal(t)}
                        className="hover:bg-slate-900/40 transition-colors cursor-pointer group"
                      >
                        <td className="py-3 px-4 font-mono font-bold text-indigo-400 whitespace-nowrap">
                          {t.ticket_no}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{t.customer_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{t.customer_phone || '-'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-200">{t.brand_model}</span>
                            {t.is_external_service && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 py-0.2 rounded font-bold">
                                Dış Servis
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500">{t.device_type}</div>
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-slate-300">
                          {t.problem_description}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${stCfg.bg} ${stCfg.text} ${stCfg.border}`}>
                            {stCfg.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400 whitespace-nowrap">
                          {formatMoney(t.total_cost || t.estimated_cost, 'TRY').formatted}
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[10px] whitespace-nowrap">
                          {formatDateTR(t.received_at)}
                        </td>
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setPrintTicket(t)}
                              title="Kabul Fişi Yazdır"
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition"
                            >
                              <Printer size={13} />
                            </button>
                            <button
                              onClick={() => handleSendWhatsApp(t)}
                              title="WhatsApp Bildir"
                              className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition cursor-pointer"
                            >
                              <MessageSquare size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteTicket(t)}
                              title="Servis Fişini Sil"
                              className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. YENİ CİHAZ KABUL MODALI                                            */}
      {/* ===================================================================== */}
      {isCreateModalOpen && (
        <div 
          className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
          style={{ zIndex: 999999 }}
        >
          <div className="bg-[#0b1222] border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[85vh] my-auto flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Başlığı */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <Wrench size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Yeni Cihaz Kabul Formu</h3>
                  <p className="text-[10px] text-slate-400">Teknik servis takip fişi oluşturun</p>
                </div>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Modal Formu */}
            <form onSubmit={handleCreateTicket} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-xs">
              
              {/* MÜŞTERİ BİLGİLERİ */}
              <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl space-y-3">
                <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block">
                  1. Müşteri Bilgileri
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Mevcut Müşteri Seç</label>
                    <select
                      value={customerId}
                      onChange={handleCustomerSelect}
                      className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">-- Listeden Seçin --</option>
                      <option value="new">+ Yeni Müşteri Gir</option>
                      {uniqueCustomers.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.phone || 'Tel yok'})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Müşteri Adı Soyadı *</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Örn: Ahmet Yılmaz"
                      required
                      className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Telefon Numarası</label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(formatPhoneNumber(e.target.value))}
                      placeholder="05XX XXX XX XX"
                      maxLength={14}
                      className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* CİHAZ BİLGİLERİ */}
              <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl space-y-3">
                <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block">
                  2. Cihaz Bilgileri
                </span>

                {/* Cihaz Türü Butonları */}
                <div>
                  <label className="block text-slate-400 text-[10px] mb-1.5 font-bold">Cihaz Türü</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {DEVICE_TYPES.map((dt) => {
                      const Icon = dt.icon
                      const isSelected = deviceType === dt.label
                      return (
                        <button
                          key={dt.label}
                          type="button"
                          onClick={() => setDeviceType(dt.label)}
                          className={`p-2 rounded-xl border flex items-center gap-2 transition cursor-pointer text-left ${
                            isSelected
                              ? 'bg-indigo-600/20 border-indigo-500 text-white shadow'
                              : 'bg-[#070b14] border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <Icon size={14} className={isSelected ? 'text-indigo-400' : 'text-slate-500'} />
                          <span className="font-bold text-[11px] truncate">{dt.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Marka & Model *</label>
                    <input
                      type="text"
                      value={brandModel}
                      onChange={(e) => setBrandModel(e.target.value)}
                      placeholder="Örn: Asus ROG G14"
                      required
                      className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Seri No / IMEI</label>
                    <input
                      type="text"
                      value={serialNo}
                      onChange={(e) => setSerialNo(e.target.value)}
                      placeholder="SN..."
                      className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Oturum Şifresi / PIN</label>
                    <input
                      type="text"
                      value={devicePassword}
                      onChange={(e) => setDevicePassword(e.target.value)}
                      placeholder="1234, vb."
                      className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                {/* Teslim Alınan Aksesuarlar */}
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Teslim Alınan Aksesuarlar</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {ACCESSORY_PRESETS.map((acc) => (
                      <button
                        key={acc}
                        type="button"
                        onClick={() => {
                          if (!accessories.includes(acc)) {
                            setAccessories(prev => prev ? `${prev}, ${acc}` : acc)
                          }
                        }}
                        className="px-2 py-1 bg-[#070b14] border border-slate-800 hover:border-indigo-500/50 text-slate-400 hover:text-white rounded-lg text-[10px] transition cursor-pointer"
                      >
                        + {acc}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={accessories}
                    onChange={(e) => setAccessories(e.target.value)}
                    placeholder="Örn: Orijinal Adaptör, Taşıma Çantası"
                    className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Fiziksel Durum / Kırık Çizik Notu */}
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Fiziksel Durum & Hasar Notları</label>
                  <input
                    type="text"
                    value={physicalCondition}
                    onChange={(e) => setPhysicalCondition(e.target.value)}
                    placeholder="Örn: Sağ menteşe çatlak, alt vidalardan 2 tanesi eksik, ekranda çizik var"
                    className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* ARIZA VE ŞİKAYET TANIMI */}
              <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl space-y-3">
                <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block">
                  3. Arıza & Şikayet
                </span>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">Müşterinin Şikayeti & Arıza Tanımı *</label>
                  <textarea
                    rows={3}
                    value={problemDescription}
                    onChange={(e) => setProblemDescription(e.target.value)}
                    placeholder="Örn: Cihaz açılmıyor, güç düğmesine basınca ışık yanıp sönüyor, sıvı teması olmuş..."
                    required
                    className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Ön Tahmini Ücret (₺)</label>
                    <input
                      type="number"
                      value={estimatedCost}
                      onChange={(e) => setEstimatedCost(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-1">Bağlı Şirket / Şube</label>
                    {isRestricted ? (
                      <div className="px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-slate-300 font-bold">
                        {companies.find(c => c.id === companyId)?.name || 'Bilgisayar Hastanesi'}
                      </div>
                    ) : (
                      <select
                        value={companyId}
                        onChange={(e) => setCompanyId(e.target.value)}
                        className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                      >
                        {companies.filter(c => !c.is_personal).map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* KAMPANYA & İLETİŞİM İZNİ (KVKK) */}
              <div className="bg-slate-900/40 border border-slate-800/80 p-3 rounded-xl">
                <label className="flex items-center gap-2.5 cursor-pointer text-slate-300 select-none">
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={(e) => setMarketingConsent(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-0 bg-slate-900 border-slate-700 cursor-pointer"
                  />
                  <span className="text-[11px] font-medium text-slate-300">
                    Müşteri, kampanya, indirim ve periyodik servis/bakım SMS & WhatsApp bildirimlerini almayı onaylıyor. (İletişim İzni)
                  </span>
                </label>
              </div>

              {/* BUTONLAR */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition cursor-pointer flex items-center gap-2"
                >
                  {submitting ? 'Kaydediliyor...' : 'Cihazı Kabul Et & Fiş Aç'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 7. CİHAZ DETAY, İŞLEM / PARÇA EKLEME & TESLİMAT MODALI                  */}
      {/* ===================================================================== */}
      {isDetailModalOpen && selectedTicket && (
        <div 
          className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
          style={{ zIndex: 999999 }}
        >
          <div className="bg-[#0b1222] border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[85vh] my-auto flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Üst Başlık */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <Wrench size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-indigo-400 text-sm">{selectedTicket.ticket_no}</span>
                    <span className="text-white font-bold text-sm">| {selectedTicket.brand_model}</span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    {selectedTicket.customer_name} • {selectedTicket.customer_phone || 'Tel yok'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPrintTicket(selectedTicket)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <Printer size={13} />
                  <span>Fiş Yazdır</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSendWhatsApp(selectedTicket)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  <MessageSquare size={13} />
                  <span>WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTicket(selectedTicket)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition cursor-pointer"
                  title="Bu servis fişini tamamen sil"
                >
                  <Trash2 size={13} />
                  <span>Sil</span>
                </button>
                <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-white transition cursor-pointer ml-1">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal İçerik */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar text-xs">
              
              {/* DURUM GÜNCELLEME ŞERİDİ */}
              <div className="bg-slate-900/70 border border-slate-800 p-3 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Cihaz Aşaması</span>
                  <span className="text-xs font-bold text-white mt-0.5 block">
                    Mevcut: <span className={STATUS_CONFIG[selectedTicket.status].text}>{STATUS_CONFIG[selectedTicket.status].label}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={detailStatus}
                    onChange={(e) => setDetailStatus(e.target.value as TicketStatus)}
                    className="flex-1 sm:flex-none px-3 py-2 bg-[#070b14] border border-indigo-500/40 rounded-xl text-white font-bold focus:outline-none cursor-pointer"
                  >
                    {(Object.keys(STATUS_CONFIG) as TicketStatus[]).map(st => (
                      <option key={st} value={st}>{STATUS_CONFIG[st].label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* CİHAZ KABUL BİLGİLERİ VE DÜZENLEME BUTONU */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span>Cihaz Kabul Bilgileri & Hikayesi</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingIntake(!isEditingIntake)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isEditingIntake
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                  }`}
                >
                  <Edit3 size={13} />
                  <span>{isEditingIntake ? 'Düzenlemeyi İptal Et' : 'Kabul Bilgilerini Düzenle'}</span>
                </button>
              </div>

              {isEditingIntake ? (
                /* DÜZENLEME MODU (INTAKE EDIT FORM) */
                <div className="bg-amber-950/10 border border-amber-500/30 p-4 rounded-2xl space-y-3 animate-in fade-in duration-150">
                  <div className="text-[11px] font-bold text-amber-400 flex items-center justify-between">
                    <span>⚠️ Kabul anındaki hatalı bilgileri düzeltiyorsunuz. Değişiklikler en alttaki "Değişiklikleri Kaydet" butonuna basıldığında sisteme işlenecektir.</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-400 text-[10px] font-bold mb-1">Müşteri Adı Soyadı</label>
                      <input
                        type="text"
                        value={editCustomerName}
                        onChange={(e) => setEditCustomerName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#070b14] border border-slate-800 rounded-xl text-white text-xs focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[10px] font-bold mb-1">Telefon Numarası</label>
                      <input
                        type="tel"
                        value={editCustomerPhone}
                        onChange={(e) => setEditCustomerPhone(formatPhoneNumber(e.target.value))}
                        placeholder="05XX XXX XX XX"
                        maxLength={14}
                        className="w-full px-2.5 py-1.5 bg-[#070b14] border border-slate-800 rounded-xl text-white text-xs font-mono focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[10px] font-bold mb-1">Cihaz Türü</label>
                      <select
                        value={editDeviceType}
                        onChange={(e) => setEditDeviceType(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#070b14] border border-slate-800 rounded-xl text-white text-xs focus:border-amber-500"
                      >
                        {DEVICE_TYPES.map(dt => (
                          <option key={dt.label} value={dt.label}>{dt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-400 text-[10px] font-bold mb-1">Marka & Model</label>
                      <input
                        type="text"
                        value={editBrandModel}
                        onChange={(e) => setEditBrandModel(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#070b14] border border-slate-800 rounded-xl text-white text-xs focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[10px] font-bold mb-1">Seri No / IMEI</label>
                      <input
                        type="text"
                        value={editSerialNo}
                        onChange={(e) => setEditSerialNo(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#070b14] border border-slate-800 rounded-xl text-white text-xs font-mono focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[10px] font-bold mb-1">Oturum Şifresi / PIN</label>
                      <input
                        type="text"
                        value={editDevicePassword}
                        onChange={(e) => setEditDevicePassword(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#070b14] border border-slate-800 rounded-xl text-white text-xs font-mono focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 text-[10px] font-bold mb-1">Teslim Alınan Aksesuarlar</label>
                      <input
                        type="text"
                        value={editAccessories}
                        onChange={(e) => setEditAccessories(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#070b14] border border-slate-800 rounded-xl text-white text-xs focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[10px] font-bold mb-1">Fiziksel Durum / Çizik-Kırık Notları</label>
                      <input
                        type="text"
                        value={editPhysicalCondition}
                        onChange={(e) => setEditPhysicalCondition(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-[#070b14] border border-slate-800 rounded-xl text-white text-xs focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[10px] font-bold mb-1">Müşteri Şikayeti & Arıza Tanımı</label>
                    <textarea
                      rows={2}
                      value={editProblemDescription}
                      onChange={(e) => setEditProblemDescription(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#070b14] border border-slate-800 rounded-xl text-white text-xs focus:border-amber-500"
                    />
                  </div>
                </div>
              ) : (
                /* NORMAL GÖRÜNÜM KARTI */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-slate-900/50 border border-slate-800/80 p-3.5 rounded-2xl space-y-1.5">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Cihaz Bilgileri</span>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div><span className="text-slate-500 block text-[9px]">Tür:</span> <span className="text-white font-medium">{selectedTicket.device_type}</span></div>
                      <div><span className="text-slate-500 block text-[9px]">Şifre:</span> <span className="text-amber-400 font-mono font-bold">{selectedTicket.device_password || 'Yok'}</span></div>
                      <div><span className="text-slate-500 block text-[9px]">Seri No:</span> <span className="text-slate-300 font-mono">{selectedTicket.serial_no || '-'}</span></div>
                      <div><span className="text-slate-500 block text-[9px]">Kabul Tarihi:</span> <span className="text-slate-300 font-mono">{formatDateTR(selectedTicket.received_at)}</span></div>
                    </div>
                    {selectedTicket.accessories && (
                      <div className="pt-1 border-t border-slate-800/60 text-[10px]">
                        <span className="text-slate-500 font-bold">Aksesuarlar:</span> <span className="text-slate-300">{selectedTicket.accessories}</span>
                      </div>
                    )}
                    {selectedTicket.physical_condition && (
                      <div className="text-[10px]">
                        <span className="text-slate-500 font-bold">Fiziksel Durum:</span> <span className="text-slate-400">{selectedTicket.physical_condition}</span>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-900/50 border border-slate-800/80 p-3.5 rounded-2xl flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">Müşteri Arıza Şikayeti</span>
                      <p className="text-[11px] text-slate-300 mt-1 leading-relaxed bg-[#070b14] p-2 rounded-xl border border-slate-800/60">
                        {selectedTicket.problem_description}
                      </p>
                    </div>
                    {selectedTicket.estimated_cost > 0 && (
                      <div className="text-[10px] text-slate-400 mt-2 text-right">
                        Ön Tahmin: <span className="font-mono font-bold text-slate-300">{formatMoney(selectedTicket.estimated_cost, 'TRY').formatted}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TEKNİSYEN NOTLARI & TEŞHİS */}
              <div className="bg-slate-900/50 border border-slate-800/80 p-3.5 rounded-2xl space-y-2">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                  Teknisyen Teşhis & İşlem Notları
                </span>
                <textarea
                  rows={2}
                  value={detailTechNotes}
                  onChange={(e) => setDetailTechNotes(e.target.value)}
                  placeholder="Arıza sebebi, yapılan testler, değişen devre elemanları veya müşteriye iletilecek teknik detaylar..."
                  className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* DIŞ SERVİS / TEDARİKÇİDE FASON ONARIM PANELİ */}
              <div className={`p-3.5 rounded-2xl border transition-all ${
                isExternalService 
                  ? 'bg-amber-950/20 border-amber-500/40 shadow-lg' 
                  : 'bg-slate-900/40 border-slate-800'
              }`}>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isExternalService}
                      onChange={(e) => setIsExternalService(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-0 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                    <div className="flex items-center gap-2">
                      <Truck size={16} className={isExternalService ? 'text-amber-400' : 'text-slate-500'} />
                      <span className={`text-xs font-bold ${isExternalService ? 'text-amber-300' : 'text-slate-400'}`}>
                        Dış Servis / Anlaşmalı Tedarikçide Fason Onarım
                      </span>
                    </div>
                  </label>
                  {isExternalService && (
                    <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-md font-bold">
                      Tedarikçi Borcuna Otomatik İşlenir
                    </span>
                  )}
                </div>

                {isExternalService && (
                  <div className="mt-3 pt-3 border-t border-amber-500/20 space-y-3 animate-in fade-in duration-150">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-300 text-[10px] font-bold mb-1">Anlaşmalı Tedarikçi *</label>
                        <select
                          value={selectedSupplierId}
                          onChange={(e) => setSelectedSupplierId(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-[#070b14] border border-slate-800 rounded-xl text-white text-xs font-medium focus:outline-none focus:border-amber-500"
                        >
                          <option value="">-- Tedarikçi Seçin --</option>
                          {suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.company_name} (Bakiye: {formatMoney(s.balance, 'TRY').formatted})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-300 text-[10px] font-bold mb-1">Fason Maliyet (₺) *</label>
                        <div className="relative">
                          <input
                            type="number"
                            value={externalServiceCost}
                            onChange={(e) => setExternalServiceCost(e.target.value)}
                            placeholder="0.00"
                            className="w-full px-2.5 py-1.5 bg-[#070b14] border border-slate-800 rounded-xl text-white text-xs font-mono font-bold focus:outline-none focus:border-amber-500"
                          />
                          <span className="absolute right-3 top-1.5 text-slate-400 text-xs">₺</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-300 text-[10px] font-bold mb-1">Dış Servis Takip Aşaması</label>
                        <select
                          value={externalServiceStatus}
                          onChange={(e) => setExternalServiceStatus(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-[#070b14] border border-slate-800 rounded-xl text-white text-xs font-medium focus:outline-none focus:border-amber-500"
                        >
                          <option value="sent_to_supplier">Tedarikçiye Gönderildi</option>
                          <option value="at_supplier">Tedarikçide İşlem Görüyor</option>
                          <option value="returned_from_supplier">Tedarikçiden Teslim Alındı</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 bg-[#070b14]/70 p-2 rounded-xl border border-slate-800/80">
                      <span>Bu fason bedeli kaydettiğinizde tedarikçinin carisine borç olarak yansır ve kâr/zarar maliyetine dahil edilir.</span>
                      {parseFloat(externalServiceCost) > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const cost = parseFloat(externalServiceCost) || 0
                            const supp = suppliers.find(s => s.id === selectedSupplierId)
                            const laborName = `Fason Onarım Bedeli (${supp?.company_name || 'Dış Servis'})`
                            setPerformedServices(prev => {
                              const filtered = prev.filter(p => !p.name.startsWith('Fason Onarım Bedeli'))
                              return [...filtered, { name: laborName, price: cost }]
                            })
                            toast.success('Fason bedeli servis işçilik listesine eklendi!')
                          }}
                          className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-[10px] font-bold border border-amber-500/40 transition shrink-0 ml-2"
                        >
                          + Müşteri Tamir Fiyatına Ekle
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* KESİNLEŞEN TAMİR ÜCRETİ & HIZLI BELİRLEME ÇUBUĞU */}
              <div className="bg-gradient-to-r from-indigo-950/50 via-slate-900/80 to-indigo-950/50 border border-indigo-500/30 p-3.5 rounded-2xl space-y-2.5 shadow-lg">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                      <Sparkles size={14} />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider block">
                        Tamir Ücreti Belirleme (Fiyatın Yansıması)
                      </span>
                      <p className="text-[10px] text-slate-400">
                        Aşağıdaki işçilik ve parça listesinden toplanır veya buradan doğrudan tek tutar olarak belirlenir.
                      </p>
                    </div>
                  </div>

                  {selectedTicket.estimated_cost > 0 && (
                    <button
                      type="button"
                      onClick={() => handleApplyQuickPrice(selectedTicket.estimated_cost)}
                      className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-[11px] rounded-xl transition flex items-center gap-1.5 cursor-pointer shrink-0"
                      title="Kabuldeki ön tahmin tutarını tamir fiyatına aktar"
                    >
                      <span>⚡ Ön Tahmini ({formatMoney(selectedTicket.estimated_cost, 'TRY').formatted}) Uygula</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                  <div className="relative flex-1 sm:max-w-xs">
                    <input
                      type="number"
                      value={quickPriceInput}
                      onChange={(e) => setQuickPriceInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleApplyQuickPrice()
                        }
                      }}
                      placeholder="Sabit Tamir Tutarı Gir..."
                      className="w-full px-3 py-1.5 bg-[#070b14] border border-indigo-500/40 rounded-xl text-white font-mono font-bold text-xs focus:outline-none focus:border-indigo-400"
                    />
                    <span className="absolute right-3 top-1.5 text-slate-400 text-xs font-bold">₺</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyQuickPrice()}
                    disabled={!quickPriceInput || parseFloat(quickPriceInput) < 0}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-[11px] rounded-xl transition cursor-pointer active:scale-95"
                  >
                    Fiyatı Uygula
                  </button>

                  <div className="ml-auto hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                    <span>Mevcut Toplam:</span>
                    <span className="text-emerald-400 font-bold text-xs">
                      {formatMoney(calcTotalCost, 'TRY').formatted}
                    </span>
                  </div>
                </div>
              </div>

              {/* İŞÇİLİK & YEDEK PARÇA HESAPLAMA PANELİ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* SOL: YAPILAN HİZMETLER & İŞÇİLİK */}
                <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">
                      İşçilik & Hizmetler ({performedServices.length})
                    </span>
                    <span className="font-mono font-bold text-blue-400 text-xs">
                      {formatMoney(calcLaborCost, 'TRY').formatted}
                    </span>
                  </div>

                  {/* Hizmet Ekleme Formu */}
                  <div className="space-y-2 bg-[#070b14] p-2.5 rounded-xl border border-slate-800/80">
                    <div className="flex items-center gap-1.5">
                      <select
                        value={selectedServiceId}
                        onChange={(e) => {
                          const id = e.target.value
                          setSelectedServiceId(id)
                          const srv = services.find(s => s.id === id)
                          if (srv) {
                            setSelectedServicePrice(srv.unit_price.toString())
                          } else {
                            setSelectedServicePrice('')
                          }
                        }}
                        className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-[11px] focus:outline-none focus:border-blue-500"
                      >
                        <option value="">-- Tanımlı Hizmetten Seç --</option>
                        {services.map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({formatMoney(s.unit_price, 'TRY').formatted})</option>
                        ))}
                      </select>
                      {selectedServiceId && (
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Fiyat ₺"
                            value={selectedServicePrice}
                            onChange={(e) => setSelectedServicePrice(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                handleAddDefinedService()
                              }
                            }}
                            className="w-20 px-2 py-1.5 bg-slate-900 border border-blue-500/60 rounded-lg text-white text-[11px] font-mono text-right focus:outline-none focus:border-blue-400 ring-1 ring-blue-500/30"
                            title="Hizmet fiyatını manuel olarak değiştirebilirsiniz (Enter ile fişe ekler)"
                          />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={handleAddDefinedService}
                        disabled={!selectedServiceId}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-[11px] rounded-lg transition shrink-0 cursor-pointer flex items-center gap-1 shadow-sm shadow-blue-600/30 active:scale-95"
                        title="Seçili hizmeti servis fişine ekle"
                      >
                        <Plus size={12} />
                        <span>Ekle</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800/50">
                      <input
                        type="text"
                        placeholder="Özel İşçilik Adı..."
                        value={customLaborName}
                        onChange={(e) => setCustomLaborName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddCustomLabor()
                          }
                        }}
                        className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-[11px] focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="number"
                        placeholder="Tutar ₺"
                        value={customLaborPrice}
                        onChange={(e) => setCustomLaborPrice(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleAddCustomLabor()
                          }
                        }}
                        className="w-20 px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-[11px] font-mono text-right focus:outline-none focus:border-blue-500"
                        title="İşçilik tutarı (Enter ile fişe ekler)"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomLabor}
                        disabled={!customLaborPrice || parseFloat(customLaborPrice) <= 0}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-[11px] rounded-lg transition shrink-0 cursor-pointer flex items-center gap-1 shadow-sm shadow-blue-600/30 active:scale-95"
                        title="Özel işçilik tutarını servis fişine ekle"
                      >
                        <Plus size={12} />
                        <span>Ekle</span>
                      </button>
                    </div>
                  </div>

                  {/* Hizmet Listesi */}
                  <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
                    {performedServices.length === 0 ? (
                      <p className="text-[10px] text-slate-500 text-center py-2">Henüz işçilik eklenmedi.</p>
                    ) : (
                      performedServices.map((srv, idx) => (
                        <div key={idx} className="flex items-center justify-between p-1.5 bg-[#070b14] border border-slate-800/60 rounded-lg text-[11px]">
                          <span className="text-slate-300 font-medium truncate pr-2">{srv.name}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded px-1.5 py-0.5 focus-within:border-blue-500">
                              <input
                                type="number"
                                step="0.01"
                                value={srv.price}
                                onChange={(e) => {
                                  const newPrice = parseFloat(e.target.value) || 0
                                  setPerformedServices(prev => prev.map((item, i) => i === idx ? { ...item, price: newPrice } : item))
                                }}
                                className="w-16 bg-transparent text-right font-mono font-bold text-blue-400 text-[11px] focus:outline-none"
                                title="Hizmet fiyatını doğrudan düzenleyin"
                              />
                              <span className="text-[10px] text-slate-500 font-mono ml-0.5">₺</span>
                            </div>
                            <button onClick={() => handleRemoveService(idx)} className="text-slate-500 hover:text-rose-400 cursor-pointer p-0.5" title="Hizmeti Çıkar"><X size={12} /></button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* SAĞ: KULLANILAN YEDEK PARÇALAR (STOKTAN SEÇİM) */}
                <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">
                      Yedek Parçalar ({usedParts.length})
                    </span>
                    <span className="font-mono font-bold text-purple-400 text-xs">
                      {formatMoney(calcPartsCost, 'TRY').formatted}
                    </span>
                  </div>

                  {/* Parça Ekleme Formu */}
                  <div className="bg-[#070b14] p-2.5 rounded-xl border border-slate-800/80 space-y-2">
                    <div className="w-full">
                      <select
                        value={selectedStockId}
                        onChange={(e) => {
                          const sid = e.target.value
                          setSelectedStockId(sid)
                          const st = stocks.find(s => s.id === sid)
                          if (st) {
                            setSelectedPartPrice(getTryPrice(st.unit_price, st.currency).toString())
                          } else {
                            setSelectedPartPrice('')
                          }
                        }}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-[11px] focus:outline-none focus:border-purple-500 truncate"
                      >
                        <option value="">-- Depodan Parça Seç --</option>
                        {stocks.map(s => {
                          const tryVal = getTryPrice(s.unit_price, s.currency)
                          return (
                            <option key={s.id} value={s.id}>
                              {s.name} (Stok: {s.quantity} - {s.currency && s.currency !== 'TRY' ? `${formatMoney(s.unit_price, s.currency).formatted} ≈ ` : ''}{formatMoney(tryVal, 'TRY').formatted})
                            </option>
                          )
                        })}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-slate-800/50">
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] text-slate-400">Adet:</span>
                        <input
                          type="number"
                          min="1"
                          value={stockQty}
                          onChange={(e) => setStockQty(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleAddPart()
                            }
                          }}
                          className="w-12 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-white text-[11px] font-mono text-center focus:outline-none focus:border-purple-500"
                          title="Kullanılan Parça Adedi"
                        />
                      </div>

                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <span className="text-[10px] text-slate-400 shrink-0">Birim ₺:</span>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={selectedPartPrice}
                          onChange={(e) => setSelectedPartPrice(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleAddPart()
                            }
                          }}
                          disabled={!selectedStockId}
                          className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-white text-[11px] font-mono text-right focus:outline-none focus:border-purple-500 disabled:opacity-40"
                          title="Parça birim satış fiyatı (TL)"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleAddPart}
                        disabled={!selectedStockId}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-[11px] rounded-lg transition shrink-0 cursor-pointer flex items-center gap-1 shadow-sm shadow-purple-600/30 active:scale-95"
                        title="Seçili parçayı servis fişine ekle"
                      >
                        <Plus size={12} />
                        <span>Ekle</span>
                      </button>
                    </div>
                  </div>

                  {/* Parça Listesi */}
                  <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
                    {usedParts.length === 0 ? (
                      <p className="text-[10px] text-slate-500 text-center py-2">Yedek parça kullanılmadı.</p>
                    ) : (
                      usedParts.map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between p-1.5 bg-[#070b14] border border-slate-800/60 rounded-lg text-[11px]">
                          <div className="flex items-center gap-1.5 truncate pr-2">
                            <span className="text-slate-300 font-medium truncate">{p.name}</span>
                            <span className="text-[9px] text-slate-500 font-mono">({p.quantity} ad.)</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded px-1.5 py-0.5 focus-within:border-purple-500">
                              <input
                                type="number"
                                step="0.01"
                                value={p.total}
                                onChange={(e) => {
                                  const newTotal = parseFloat(e.target.value) || 0
                                  setUsedParts(prev => prev.map((item, i) => i === idx ? { ...item, total: newTotal, unit_price: p.quantity > 0 ? Number((newTotal / p.quantity).toFixed(2)) : newTotal } : item))
                                }}
                                className="w-16 bg-transparent text-right font-mono font-bold text-purple-400 text-[11px] focus:outline-none"
                                title="Parça tutarını doğrudan düzenleyin"
                              />
                              <span className="text-[10px] text-slate-500 font-mono ml-0.5">₺</span>
                            </div>
                            <button onClick={() => handleRemovePart(idx)} className="text-slate-500 hover:text-rose-400 cursor-pointer p-0.5" title="Parçayı Çıkar"><X size={12} /></button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* TESLİMAT VE ÖDEME ALMA ŞERİDİ (Eğer Teslim Edildi seçildiyse) */}
              {detailStatus === 'delivered' && (
                <div className="bg-emerald-950/20 border border-emerald-500/40 p-4 rounded-2xl space-y-3 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                      <ShieldCheck size={16} /> Teslimat & Tahsilat Bilgileri
                    </span>
                    <span className="text-xs font-mono font-bold text-white">
                      Toplam: {formatMoney(calcTotalCost, 'TRY').formatted}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-300 font-bold mb-1">Tahsilat Yöntemi</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                        className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white font-bold"
                      >
                        <option value="cash">Nakit Kasa ile Tahsil Et</option>
                        <option value="card">Kredi Kartı / POS (Banka Hesabı)</option>
                        <option value="customer_debt">Müşterinin Cari Hesabına Borç Yaz</option>
                        <option value="free">Ücretsiz / Garanti Kapsamı (0 ₺)</option>
                      </select>
                    </div>

                    {paymentMethod === 'cash' && (
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">Giriş Yapılacak Kasa</label>
                        <select
                          value={paymentTargetId}
                          onChange={(e) => setPaymentTargetId(e.target.value)}
                          className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white font-medium"
                        >
                          <option value="">-- Varsayılan Kasa --</option>
                          {cashes.map(c => <option key={c.id} value={c.id}>{c.name} ({formatMoney(c.balance, (c.currency as any) || 'TRY').formatted})</option>)}
                        </select>
                      </div>
                    )}

                    {paymentMethod === 'card' && (
                      <div>
                        <label className="block text-slate-300 font-bold mb-1">POS / Banka Hesabı</label>
                        <select
                          value={paymentTargetId}
                          onChange={(e) => setPaymentTargetId(e.target.value)}
                          className="w-full px-3 py-2 bg-[#070b14] border border-slate-800 rounded-xl text-white font-medium"
                        >
                          <option value="">-- Varsayılan Hesap --</option>
                          {banks.map(b => <option key={b.id} value={b.id}>{b.bank_name}</option>)}
                        </select>
                      </div>
                    )}

                    <div className="flex items-center sm:mt-5">
                      <label className="flex items-center gap-2 cursor-pointer text-slate-300 font-medium">
                        <input
                          type="checkbox"
                          checked={deductPartsFromStock}
                          onChange={(e) => setDeductPartsFromStock(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-0 bg-slate-900 border-slate-700"
                        />
                        <span>Parçaları depodan otomatik düş</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* BEKLEYEN / EKLENMEMİŞ KALEM UYARISI */}
              {(selectedServiceId || (customLaborPrice && parseFloat(customLaborPrice) > 0) || selectedStockId) && (
                <div className="bg-amber-500/10 border border-amber-500/30 px-3.5 py-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2.5 text-[11px] text-amber-300 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={15} className="shrink-0 text-amber-400" />
                    <span>
                      {selectedServiceId 
                        ? 'Seçtiğiniz tanımlı hizmet henüz fişe eklenmedi.' 
                        : selectedStockId
                        ? 'Seçtiğiniz yedek parça henüz fişe eklenmedi.'
                        : 'Yazdığınız işçilik tutarı henüz fişe eklenmedi.'}
                      {' '}Toplama dahil etmek için ilgili kutudaki <strong className="text-white underline">"Ekle"</strong> butonuna veya <strong className="text-white">Enter</strong> tuşuna basınız.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedServiceId) handleAddDefinedService()
                      else if (selectedStockId) handleAddPart()
                      else if (customLaborPrice) handleAddCustomLabor()
                    }}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[10px] rounded-lg transition shrink-0 cursor-pointer active:scale-95 shadow"
                  >
                    Şimdi Ekle
                  </button>
                </div>
              )}

              {/* GENEL TOPLAM BARI */}
              <div className="bg-[#070b14] border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">GENEL TOPLAM</span>
                  <span className="text-xs text-slate-500">İşçilik ({calcLaborCost} ₺) + Yedek Parça ({calcPartsCost} ₺)</span>
                </div>
                <div className="text-right font-mono">
                  <span className="text-xl font-black text-emerald-400">
                    {formatMoney(calcTotalCost, 'TRY').formatted}
                  </span>
                </div>
              </div>

              {/* AKSİYON BUTONLARI */}
              <div className="pt-2 flex items-center justify-between gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => handleDeleteTicket(selectedTicket)}
                  className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer text-xs active:scale-95"
                  title="Bu servis fişini tamamen sil"
                >
                  <Trash2 size={15} />
                  <span>Fişi Sil</span>
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsDetailModalOpen(false)}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition cursor-pointer text-xs"
                  >
                    Kapat
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTicketDetails}
                    disabled={submitting}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition cursor-pointer text-xs"
                  >
                    {submitting ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 8. YAZDIRMA PENCERESİ (TERMAL VE A5/A4 CİHAZ KABUL FİŞİ)             */}
      {/* ===================================================================== */}
      {printTicket && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-150"
          style={{ zIndex: 999999 }}
        >
          <div className="bg-white text-slate-900 rounded-3xl w-full max-w-md p-6 shadow-2xl flex flex-col max-h-[88vh] my-auto overflow-y-auto print:p-0 print:m-0 print:max-w-none print:shadow-none print:rounded-none">
            
            {/* Ekranda Görünür Kontrol Çubuğu */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4 print:hidden">
              <span className="font-bold text-xs text-slate-600">Baskı Önizleme (Kabul Fişi)</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow hover:bg-indigo-500 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Printer size={14} />
                  <span>Yazdır</span>
                </button>
                <button
                  onClick={() => setPrintTicket(null)}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* FİŞ BASKI İÇERİĞİ (Termal 80mm & Kurumsal Standart) */}
            <div id="service-slip" className="text-xs space-y-3 font-sans">
              
              {/* Şirket Başlığı */}
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <h2 className="text-base font-black tracking-wider text-slate-900 uppercase">
                  {printTicket.company?.name || 'BİLGİSAYAR HASTANESİ'}
                </h2>
                <p className="text-[10px] text-slate-600">Teknik Servis & Bilişim Hizmetleri</p>
                <div className="mt-2 inline-block bg-slate-100 px-3 py-1 rounded border border-slate-300 font-mono font-black text-sm">
                  {printTicket.ticket_no}
                </div>
              </div>

              {/* Müşteri & Tarih */}
              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Tarih:</span>
                  <span className="font-mono font-bold">{formatDateTR(printTicket.received_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Müşteri:</span>
                  <span className="font-bold">{printTicket.customer_name}</span>
                </div>
                {printTicket.customer_phone && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Telefon:</span>
                    <span className="font-mono">{printTicket.customer_phone}</span>
                  </div>
                )}
              </div>

              {/* Cihaz Detayları */}
              <div className="space-y-1 text-[11px] border-b border-dashed border-slate-300 pb-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Cihaz:</span>
                  <span className="font-bold">{printTicket.device_type} - {printTicket.brand_model}</span>
                </div>
                {printTicket.serial_no && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Seri No:</span>
                    <span className="font-mono">{printTicket.serial_no}</span>
                  </div>
                )}
                {printTicket.device_password && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Cihaz Şifresi:</span>
                    <span className="font-mono font-bold bg-slate-100 px-1 rounded">{printTicket.device_password}</span>
                  </div>
                )}
                {printTicket.accessories && (
                  <div className="text-[10px] text-slate-600 mt-1">
                    <span className="font-bold">Aksesuarlar:</span> {printTicket.accessories}
                  </div>
                )}
                {printTicket.physical_condition && (
                  <div className="text-[10px] text-slate-600">
                    <span className="font-bold">Fiziksel Durum:</span> {printTicket.physical_condition}
                  </div>
                )}
              </div>

              {/* Arıza & Şikayet */}
              <div className="text-[11px] border-b border-dashed border-slate-300 pb-2">
                <span className="text-slate-500 font-bold block mb-0.5">Bildirilen Şikayet:</span>
                <p className="text-slate-800 italic bg-slate-50 p-2 rounded border border-slate-200">
                  "{printTicket.problem_description}"
                </p>
                {printTicket.estimated_cost > 0 && (
                  <div className="mt-1 text-right text-[10px] text-slate-600">
                    Ön Tahmin: <span className="font-bold">{formatMoney(printTicket.estimated_cost, 'TRY').formatted}</span>
                  </div>
                )}
              </div>

              {/* Yasal Uyarı & Şartlar */}
              <div className="text-[8px] text-slate-500 space-y-1 leading-normal pt-1">
                <p>1. 90 gün içinde teslim alınmayan cihazlardan işletmemiz sorumlu değildir.</p>
                <p>2. Cihaz teslimi esnasında bu fişin ibraz edilmesi zorunludur.</p>
                <p>3. Veri kaybından servisimiz sorumlu tutulamaz; yedekleme müşteri sorumluluğundadır.</p>
              </div>

              {/* İmza Alanları */}
              <div className="pt-6 grid grid-cols-2 text-center text-[10px] text-slate-600">
                <div>
                  <div className="border-t border-slate-300 pt-1">Teslim Eden (Müşteri)</div>
                </div>
                <div>
                  <div className="border-t border-slate-300 pt-1">Teslim Alan (Servis)</div>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ONAY / SİLME DİYALOĞU (CONFIRM MODAL) */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150" style={{ zIndex: 9999999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center animate-in zoom-in-95 duration-200">
            <div className={`mx-auto flex items-center justify-center h-14 w-14 rounded-full mb-5 ${confirmDialog.isDanger ? 'bg-rose-500/10 text-rose-400' : 'bg-blue-500/10 text-blue-400'}`}>
              {confirmDialog.isDanger ? <AlertTriangle size={28} /> : <RefreshCw size={28} />}
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{confirmDialog.title}</h3>
            <p className="text-[11px] text-slate-400 mb-6 leading-relaxed px-2">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button 
                type="button"
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} 
                className="flex-1 px-4 py-2.5 rounded-xl text-slate-300 bg-slate-800 hover:bg-slate-700 font-medium transition-colors text-xs cursor-pointer"
              >
                {confirmDialog.cancelText}
              </button>
              <button 
                type="button"
                onClick={confirmDialog.onConfirm} 
                className={`flex-1 px-4 py-2.5 rounded-xl text-white font-bold transition-all active:scale-95 text-xs shadow-lg cursor-pointer ${confirmDialog.isDanger ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-900/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-900/20'}`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Baskı CSS Stili */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #service-slip, #service-slip * {
            visibility: visible;
          }
          #service-slip {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 10px;
          }
        }
      `}</style>
    </div>
  )
}

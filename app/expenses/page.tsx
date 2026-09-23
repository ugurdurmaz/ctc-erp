'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/lib/utils'
import toast, { Toaster } from 'react-hot-toast'
import { 
  Receipt, Plus, Trash2, Edit3, Search, Tags, Landmark, Wallet, CreditCard, 
  PieChart, Building, Home, AlertTriangle, RefreshCw, Calendar, CheckCircle2, 
  Clock, Zap, ArrowRight, X, ChevronRight, Filter, Sparkles, Layers, DollarSign,
  AlertCircle, Check, ArrowUpRight, List, LayoutGrid
} from 'lucide-react'
import { logActivity } from '@/lib/audit'
import { useAuth } from '@/lib/auth-context'

export type CategoryType = 'fixed' | 'variable'

export type Category = { 
  id: string
  name: string
  type: CategoryType 
}

export type RecurringTemplate = {
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
}

type Company = { id: string; name: string; is_personal: boolean }
type BankAccount = { id: string; bank_name: string; account_name: string; balance: number; currency: string; company_id?: string | null }
type CashRegister = { id: string; name: string; balance: number; currency: string; company_id?: string | null }
type CreditCardItem = { id: string; name: string; current_debt: number; company_id?: string | null }

type ExpenseTransaction = {
  id: string
  category_id: string
  company_id: string
  tx_date: string
  description: string
  amount: number
  currency: string
  exchange_rate: number
  payment_source_type: string
  payment_source_id: string
  transfer_id?: string
  category?: { name: string }
  company?: { name: string; is_personal: boolean }
}

function getLocalTodayISO() { 
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` 
}

function formatDateTR(dateStr: string) { 
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`
  return dateStr 
}

function parseCategoryRow(id: string, rawName: string): { category: Category | null; template: RecurringTemplate | null } {
  if (rawName.startsWith('REC_TEMPLATE::')) {
    try {
      const jsonStr = rawName.slice('REC_TEMPLATE::'.length)
      const parsed = JSON.parse(jsonStr)
      return {
        category: null,
        template: {
          id,
          title: parsed.title || 'Sabit Gider',
          company_id: parsed.company_id || '',
          category_id: parsed.category_id || '',
          amount: Number(parsed.amount) || 0,
          currency: parsed.currency || 'TRY',
          due_day: Number(parsed.due_day) || 1,
          default_source_type: parsed.default_source_type || undefined,
          default_source_id: parsed.default_source_id || undefined,
          note: parsed.note || ''
        }
      }
    } catch (e) {
      console.error('Error parsing recurring template:', e)
      return { category: null, template: null }
    }
  }

  let type: CategoryType = 'variable'
  let cleanName = rawName
  if (rawName.startsWith('fixed::')) {
    type = 'fixed'
    cleanName = rawName.slice('fixed::'.length)
  } else if (rawName.startsWith('variable::')) {
    type = 'variable'
    cleanName = rawName.slice('variable::'.length)
  } else {
    // Akıllı varsayılan
    const lower = rawName.toLowerCase()
    if (lower.includes('kira') || lower.includes('fatura') || lower.includes('elektrik') || lower.includes('su') || lower.includes('doğalgaz') || lower.includes('maaş') || lower.includes('vergi') || lower.includes('aidat') || lower.includes('sgk') || lower.includes('muhasebe') || lower.includes('abonelik') || lower.includes('internet')) {
      type = 'fixed'
    } else {
      type = 'variable'
    }
  }

  return {
    category: { id, name: cleanName, type },
    template: null
  }
}

export default function ExpensesPage() {
  const { profile, isAdmin } = useAuth()
  const isRestricted = !isAdmin && !!profile?.allowed_companies && profile.allowed_companies.length > 0

  const [categories, setCategories] = useState<Category[]>([])
  const [recurringTemplates, setRecurringTemplates] = useState<RecurringTemplate[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [expenses, setExpenses] = useState<ExpenseTransaction[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all')

  const [banks, setBanks] = useState<BankAccount[]>([])
  const [cashes, setCashes] = useState<CashRegister[]>([])
  const [cards, setCards] = useState<CreditCardItem[]>([])
  const [rates, setRates] = useState<{ USD: number; EUR: number }>({ USD: 34.25, EUR: 37.80 })

  // Sol Panel Sekmesi: 'templates' (Sabit Şablonlar) veya 'categories' (Gider Kategorileri)
  const [activeLeftTab, setActiveLeftTab] = useState<'templates' | 'categories'>('templates')
  const [categoryTypeFilter, setCategoryTypeFilter] = useState<'all' | 'fixed' | 'variable'>('all')

  // Kategori Modalı State
  const [isCatModalOpen, setIsCatModalOpen] = useState(false)
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [newCatName, setNewCatName] = useState('')
  const [newCatType, setNewCatType] = useState<CategoryType>('fixed')

  // Sabit Gider Şablon Modalı State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [tmplTitle, setTmplTitle] = useState('')
  const [tmplCompanyId, setTmplCompanyId] = useState('')
  const [tmplCategoryId, setTmplCategoryId] = useState('')
  const [tmplAmount, setTmplAmount] = useState('')
  const [tmplCurrency, setTmplCurrency] = useState<'TRY' | 'USD' | 'EUR'>('TRY')
  const [tmplDueDay, setTmplDueDay] = useState('1')
  const [tmplSourceType, setTmplSourceType] = useState<'' | 'card' | 'bank' | 'cash'>('card')
  const [tmplSourceId, setTmplSourceId] = useState('')
  const [tmplNote, setTmplNote] = useState('')

  // Hızlı Öde Modalı State (Kredi Kartı Destekli)
  const [isQuickPayModalOpen, setIsQuickPayModalOpen] = useState(false)
  const [quickPayTemplate, setQuickPayTemplate] = useState<RecurringTemplate | null>(null)
  const todayISO = getLocalTodayISO()
  const [quickPayDate, setQuickPayDate] = useState(todayISO)
  const [quickPayAmount, setQuickPayAmount] = useState('')
  const [quickPayCurrency, setQuickPayCurrency] = useState<'TRY' | 'USD' | 'EUR'>('TRY')
  const [quickPayExchangeRate, setQuickPayExchangeRate] = useState('1')
  const [quickPaySourceType, setQuickPaySourceType] = useState<'card' | 'bank' | 'cash'>('card')
  const [quickPaySourceId, setQuickPaySourceId] = useState('')
  const [quickPayDesc, setQuickPayDesc] = useState('')
  const [quickPayCompanyId, setQuickPayCompanyId] = useState('')
  const [quickPayCategoryId, setQuickPayCategoryId] = useState('')

  // Takip Şeridi Filtresi & Görünüm Düzeni: 'list' (Varsayılan Yoğun Liste) | 'grid' (Kart)
  const [trackerFilter, setTrackerFilter] = useState<'all' | 'pending' | 'paid'>('all')
  const [trackerLayout, setTrackerLayout] = useState<'list' | 'grid'>('list')

  // Normal Form State
  const [txDate, setTxDate] = useState(todayISO)
  const [txCategoryId, setTxCategoryId] = useState('')
  const [txCompanyId, setTxCompanyId] = useState('')
  const [txDesc, setTxDesc] = useState('')
  const [txAmount, setTxAmount] = useState('')
  const [txCurrency, setTxCurrency] = useState<'TRY' | 'USD' | 'EUR'>('TRY')
  const [txExchangeRate, setTxExchangeRate] = useState('1')
  const [paymentSource, setPaymentSource] = useState('')

  // Özel Onay Modalı State'i
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string; confirmText: string; cancelText: string; isDanger: boolean; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', confirmText: '', cancelText: '', isDanger: false, onConfirm: () => {} })

  useEffect(() => { 
    fetchExchangeRates()
    fetchCategories()
    fetchCompanies()
    fetchPaymentSources()
    fetchExpenses() 
  }, [isRestricted, profile?.allowed_companies])

  useEffect(() => {
    if (txCurrency === 'USD') setTxExchangeRate(rates.USD.toString())
    else if (txCurrency === 'EUR') setTxExchangeRate(rates.EUR.toString())
    else setTxExchangeRate('1')
  }, [txCurrency, rates])

  useEffect(() => {
    if (quickPayCurrency === 'USD') setQuickPayExchangeRate(rates.USD.toString())
    else if (quickPayCurrency === 'EUR') setQuickPayExchangeRate(rates.EUR.toString())
    else setQuickPayExchangeRate('1')
  }, [quickPayCurrency, rates])

  async function fetchExchangeRates() {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' })
      const data = await res.json()
      if (data && data.rates) setRates({ USD: Number(data.rates.TRY.toFixed(4)), EUR: Number((data.rates.TRY / data.rates.EUR).toFixed(4)) })
    } catch (err) { console.error(err) }
  }

  async function fetchCategories() {
    const { data } = await supabase.from('expense_categories').select('*').order('name', { ascending: true })
    if (!data) {
      setCategories([])
      setRecurringTemplates([])
      return
    }

    const parsedCats: Category[] = []
    const parsedTmpls: RecurringTemplate[] = []

    for (const item of data) {
      const res = parseCategoryRow(item.id, item.name)
      if (res.template) {
        parsedTmpls.push(res.template)
      } else if (res.category) {
        parsedCats.push(res.category)
      }
    }

    setCategories(parsedCats)
    setRecurringTemplates(parsedTmpls)
  }

  async function fetchCompanies() {
    const { data } = await supabase.from('companies').select('*').order('name', { ascending: true })
    let comps = data || []
    if (isRestricted) {
      comps = comps.filter(c => profile?.allowed_companies?.includes(c.id))
    }
    setCompanies(comps)
  }

  async function fetchPaymentSources() {
    const { data: bData } = await supabase.from('bank_accounts').select('id, bank_name, account_name, balance, currency, company_id')
    const { data: cData } = await supabase.from('cash_registers').select('id, name, balance, currency, company_id')
    const { data: cdData } = await supabase.from('credit_cards').select('id, name, current_debt, company_id')

    let bList = bData || []
    let cList = cData || []
    let cdList = cdData || []

    if (isRestricted) {
      bList = bList.filter(b => !b.company_id || profile?.allowed_companies?.includes(b.company_id))
      cList = cList.filter(c => !c.company_id || profile?.allowed_companies?.includes(c.company_id))
      cdList = cdList.filter(cd => !cd.company_id || profile?.allowed_companies?.includes(cd.company_id))
    }

    setBanks(bList)
    setCashes(cList)
    setCards(cdList)
  }

  async function fetchExpenses() {
    const { data } = await supabase.from('expense_transactions')
      .select('*, category:expense_categories(name), company:companies(name, is_personal)')
      .order('tx_date', { ascending: false })
      .order('created_at', { ascending: false })
    
    let exps = data || []
    if (isRestricted) {
      exps = exps.filter(e => !e.company_id || profile?.allowed_companies?.includes(e.company_id))
    }
    setExpenses(exps)
  }

  // =========================================================================================
  // --- MUTLAK HESAPLAMA MOTORLARI (ABSOLUTE LEDGER RECALCULATORS) ---
  // =========================================================================================
  async function recalculateAbsoluteBankBalance(bankId: string) {
    const { data: txs } = await supabase.from('bank_transactions').select('amount, tx_type, status').eq('bank_account_id', bankId)
    let absoluteBal = 0
    txs?.forEach(t => { 
      if (t.status !== 'pending') absoluteBal += t.tx_type === 'in' ? Number(t.amount) : -Number(t.amount) 
    })
    await supabase.from('bank_accounts').update({ balance: absoluteBal }).eq('id', bankId)
  }

  async function recalculateAbsoluteCashBalance(cashId: string) {
    const { data: txs } = await supabase.from('cash_transactions').select('amount, tx_type').eq('cash_register_id', cashId)
    let absoluteBal = 0
    txs?.forEach(t => { absoluteBal += t.tx_type === 'in' ? Number(t.amount) : -Number(t.amount) })
    await supabase.from('cash_registers').update({ balance: absoluteBal }).eq('id', cashId)
  }

  async function recalculateAbsoluteCardDebt(cardId: string) {
    const { data: txs } = await supabase.from('card_transactions').select('amount, tx_type').eq('card_id', cardId)
    let absoluteDebt = 0
    txs?.forEach(t => { 
      if (t.tx_type === 'expense') absoluteDebt += Number(t.amount)
      else absoluteDebt -= Number(t.amount)
    })
    await supabase.from('credit_cards').update({ current_debt: absoluteDebt }).eq('id', cardId)
  }

  // Ödeme kaynağı hareket ve bakiye senkronizasyonu (Kredi Kartı dahil)
  async function modifyPaymentSourceBalance(
    sourceType: string, 
    sourceId: string, 
    amount: number, 
    txCurr: string, 
    customRate: number, 
    action: 'payment' | 'reverse', 
    relatedTxId: string, 
    dateStr: string, 
    expDesc: string, 
    compName: string, 
    compId: string | null
  ) {
    let table = ''; let txTable = ''; let txIdField = ''
    if (sourceType === 'cash') { table = 'cash_registers'; txTable = 'cash_transactions'; txIdField = 'cash_register_id' }
    else if (sourceType === 'bank') { table = 'bank_accounts'; txTable = 'bank_transactions'; txIdField = 'bank_account_id' }
    else if (sourceType === 'card') { table = 'credit_cards'; txTable = 'card_transactions'; txIdField = 'card_id' }
    else return

    let accCurr = 'TRY'
    if (sourceType !== 'card') {
      const { data } = await supabase.from(table).select('currency').eq('id', sourceId).single()
      if (!data) return
      accCurr = data.currency || 'TRY'
    }

    let convertedAmount = amount
    if (txCurr !== accCurr) {
      let amountInTry = txCurr === 'TRY' ? amount : amount * customRate
      if (accCurr === 'TRY') convertedAmount = amountInTry
      else if (accCurr === 'USD') convertedAmount = amountInTry / rates.USD
      else if (accCurr === 'EUR') convertedAmount = amountInTry / rates.EUR
    }

    if (txTable && relatedTxId) {
      if (action === 'payment') {
        if (sourceType === 'card') {
          const cardPayload = {
            card_id: sourceId,
            company_id: compId,
            tx_date: dateStr,
            description: `Gider Ödemesi [${compName || 'Ortak İşlem'}] - ${expDesc} [EXP-${relatedTxId}]`,
            amount: convertedAmount,
            tx_type: 'expense'
          }
          await supabase.from('card_transactions').insert([cardPayload])
        } else {
          const payload: any = {
            [txIdField]: sourceId,
            company_id: compId,
            tx_date: dateStr,
            description: `Gider Ödemesi [${compName || 'Ortak İşlem'}] - ${expDesc}`,
            amount: convertedAmount,
            currency: accCurr,
            exchange_rate: 1,
            is_transfer: false,
            transfer_id: `EXP-${relatedTxId}`,
            tx_type: 'out'
          }
          if (sourceType === 'bank') payload.status = 'completed'
          await supabase.from(txTable).insert([payload])
        }
      } else if (action === 'reverse') {
        if (sourceType === 'card') {
          await supabase.from('card_transactions').delete().like('description', `%[EXP-${relatedTxId}]%`)
        } else {
          await supabase.from(txTable).delete().eq('transfer_id', `EXP-${relatedTxId}`)
        }
      }
    }

    // İlgili modülün mutlak hesabını tetikleyelim
    if (sourceType === 'cash') await recalculateAbsoluteCashBalance(sourceId)
    if (sourceType === 'bank') await recalculateAbsoluteBankBalance(sourceId)
    if (sourceType === 'card') await recalculateAbsoluteCardDebt(sourceId)
  }

  // =========================================================================================
  // --- KATEGORİ YÖNETİMİ ---
  // =========================================================================================
  function openAddCategoryModal() {
    setEditingCatId(null)
    setNewCatName('')
    setNewCatType('fixed')
    setIsCatModalOpen(true)
  }

  function openEditCategoryModal(cat: Category) {
    setEditingCatId(cat.id)
    setNewCatName(cat.name)
    setNewCatType(cat.type)
    setIsCatModalOpen(true)
  }

  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCatName.trim()) return

    const rawName = `${newCatType}::${newCatName.trim()}`
    try {
      if (editingCatId) {
        const oldCat = categories.find(c => c.id === editingCatId)
        const payload = { name: rawName }
        await supabase.from('expense_categories').update(payload).eq('id', editingCatId)
        
        await logActivity('expense_category', 'UPDATE', `Gider kategorisi güncellendi: ${newCatName.trim()} (${newCatType === 'fixed' ? 'Sabit' : 'Değişken'})`, editingCatId, 0, '', oldCat, payload, null)
        toast.success('Kategori başarıyla güncellendi.')
      } else {
        const payload = { name: rawName }
        const { data, error } = await supabase.from('expense_categories').insert([payload]).select().single()
        if (error) throw error
        
        await logActivity('expense_category', 'INSERT', `Yeni gider kategorisi oluşturuldu: ${newCatName.trim()} (${newCatType === 'fixed' ? 'Sabit' : 'Değişken'})`, data.id, 0, '', null, data, null)
        toast.success('Yeni kategori oluşturuldu.')
      }
      setIsCatModalOpen(false)
      setNewCatName('')
      setEditingCatId(null)
      fetchCategories()
    } catch (err: any) { 
      toast.error("Kategori kaydedilemedi: " + err.message) 
    }
  }

  function handleDeleteCategory(id: string) {
    const catToDelete = categories.find(c => c.id === id)
    setConfirmDialog({
      isOpen: true,
      title: 'Kategoriyi Sil',
      message: `"${catToDelete?.name}" kategorisini silmek istediğinize emin misiniz? Bu kategoriye bağlı geçmiş giderler varsa silme işlemi engellenecektir.`,
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        try { 
          const { error } = await supabase.from('expense_categories').delete().eq('id', id)
          if (error) throw error
          
          await logActivity('expense_category', 'DELETE', `Gider kategorisi silindi: ${catToDelete?.name}`, id, 0, '', catToDelete, null, null)
          toast.success('Kategori başarıyla silindi.')
          fetchCategories() 
        } catch(err:any) { 
          toast.error("Silinemedi! Bu kategoriye ait kayıtlı giderler veya şablonlar bulunuyor.") 
        }
      }
    })
  }

  // =========================================================================================
  // --- SABİT GİDER ŞABLONLARI YÖNETİMİ ---
  // =========================================================================================
  function openAddTemplateModal() {
    setEditingTemplateId(null)
    setTmplTitle('')
    setTmplCompanyId(companies[0]?.id || '')
    setTmplCategoryId(categories[0]?.id || '')
    setTmplAmount('')
    setTmplCurrency('TRY')
    setTmplDueDay('1')
    setTmplSourceType('card')
    setTmplSourceId(cards[0]?.id || '')
    setTmplNote('')
    setIsTemplateModalOpen(true)
  }

  function openEditTemplateModal(tmpl: RecurringTemplate) {
    setEditingTemplateId(tmpl.id)
    setTmplTitle(tmpl.title)
    setTmplCompanyId(tmpl.company_id || '')
    setTmplCategoryId(tmpl.category_id || '')
    setTmplAmount(tmpl.amount ? tmpl.amount.toString() : '')
    setTmplCurrency(tmpl.currency || 'TRY')
    setTmplDueDay(tmpl.due_day ? tmpl.due_day.toString() : '1')
    setTmplSourceType(tmpl.default_source_type || 'card')
    setTmplSourceId(tmpl.default_source_id || '')
    setTmplNote(tmpl.note || '')
    setIsTemplateModalOpen(true)
  }

  async function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!tmplTitle.trim() || !tmplCompanyId) {
      return toast.error("Lütfen şablon başlığını ve ait olduğu merkezi seçin.")
    }

    const amountNum = parseFloat(tmplAmount) || 0
    const dueDayNum = Math.min(31, Math.max(1, parseInt(tmplDueDay, 10) || 1))

    const tmplObj = {
      title: tmplTitle.trim(),
      company_id: tmplCompanyId,
      category_id: tmplCategoryId || null,
      amount: amountNum,
      currency: tmplCurrency,
      due_day: dueDayNum,
      default_source_type: tmplSourceType || null,
      default_source_id: tmplSourceId || null,
      note: tmplNote.trim()
    }

    const rawName = `REC_TEMPLATE::${JSON.stringify(tmplObj)}`

    try {
      if (editingTemplateId) {
        await supabase.from('expense_categories').update({ name: rawName }).eq('id', editingTemplateId)
        await logActivity('expense_category', 'UPDATE', `Sabit gider şablonu güncellendi: ${tmplObj.title}`, editingTemplateId, amountNum, tmplCurrency, null, tmplObj, tmplCompanyId)
        toast.success('Sabit gider şablonu güncellendi.')
      } else {
        const { data, error } = await supabase.from('expense_categories').insert([{ name: rawName }]).select().single()
        if (error) throw error
        await logActivity('expense_category', 'INSERT', `Yeni sabit gider şablonu oluşturuldu: ${tmplObj.title}`, data.id, amountNum, tmplCurrency, null, tmplObj, tmplCompanyId)
        toast.success('Yeni sabit gider şablonu kaydedildi.')
      }
      setIsTemplateModalOpen(false)
      fetchCategories()
    } catch (err: any) {
      toast.error("Şablon kaydedilemedi: " + err.message)
    }
  }

  function handleDeleteTemplate(id: string) {
    const tmplToDelete = recurringTemplates.find(t => t.id === id)
    setConfirmDialog({
      isOpen: true,
      title: 'Sabit Gider Şablonunu Sil',
      message: `"${tmplToDelete?.title}" şablonunu silmek istediğinize emin misiniz? (Daha önce kaydedilmiş geçmiş gider kayıtlarınız etkilenmez.)`,
      confirmText: 'Evet, Şablonu Sil',
      cancelText: 'Vazgeç',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        try {
          const { error } = await supabase.from('expense_categories').delete().eq('id', id)
          if (error) throw error
          await logActivity('expense_category', 'DELETE', `Sabit gider şablonu silindi: ${tmplToDelete?.title}`, id, 0, '', tmplToDelete, null, tmplToDelete?.company_id || null)
          toast.success('Şablon başarıyla silindi.')
          fetchCategories()
        } catch (err: any) {
          toast.error("Silme hatası: " + err.message)
        }
      }
    })
  }

  // =========================================================================================
  // --- HIZLI ÖDE (QUICK PAY) İŞLEMLERİ (KREDİ KARTI SEÇENEKLİ) ---
  // =========================================================================================
  const currentMonthDate = useMemo(() => new Date(), [])
  const currentYearMonth = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`
  const currentMonthName = currentMonthDate.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })
  const currentDay = currentMonthDate.getDate()

  function openQuickPayModal(tmpl: RecurringTemplate) {
    setQuickPayTemplate(tmpl)
    setQuickPayDate(todayISO)
    setQuickPayAmount(tmpl.amount > 0 ? tmpl.amount.toString() : '')
    setQuickPayCurrency(tmpl.currency)
    if (tmpl.currency === 'USD') setQuickPayExchangeRate(rates.USD.toString())
    else if (tmpl.currency === 'EUR') setQuickPayExchangeRate(rates.EUR.toString())
    else setQuickPayExchangeRate('1')

    setQuickPayCompanyId(tmpl.company_id)
    setQuickPayCategoryId(tmpl.category_id || (categories[0]?.id || ''))
    setQuickPayDesc(`${tmpl.title} - ${currentMonthName}`)

    // Kullanıcının özellikle belirttiği Kredi Kartı veya varsayılan kaynak kontrolü
    const prefType = tmpl.default_source_type || 'card'
    setQuickPaySourceType(prefType)

    if (tmpl.default_source_id) {
      setQuickPaySourceId(tmpl.default_source_id)
    } else {
      if (prefType === 'card' && cards.length > 0) setQuickPaySourceId(cards[0].id)
      else if (prefType === 'bank' && banks.length > 0) setQuickPaySourceId(banks[0].id)
      else if (prefType === 'cash' && cashes.length > 0) setQuickPaySourceId(cashes[0].id)
      else setQuickPaySourceId('')
    }

    setIsQuickPayModalOpen(true)
  }

  async function handleExecuteQuickPay(e: React.FormEvent) {
    e.preventDefault()
    const amountNum = parseFloat(quickPayAmount)
    const rateNum = quickPayCurrency === 'TRY' ? 1 : (parseFloat(quickPayExchangeRate) || 1)

    if (!amountNum || !quickPayCompanyId || !quickPaySourceId || !quickPaySourceType) {
      return toast.error("Lütfen tutar, merkez ve ödeme kaynağını eksiksiz seçin.")
    }

    try {
      const trfId = `EXP-REC-${quickPayTemplate?.id || Date.now()}-${Date.now()}`
      const compName = companies.find(c => c.id === quickPayCompanyId)?.name || ''
      const finalCompId = quickPayCompanyId === 'common' ? null : quickPayCompanyId

      const payload = {
        category_id: quickPayCategoryId || null,
        company_id: finalCompId,
        tx_date: quickPayDate,
        description: quickPayDesc.trim() || `${quickPayTemplate?.title || 'Sabit Gider'} - ${currentMonthName}`,
        amount: amountNum,
        currency: quickPayCurrency,
        exchange_rate: rateNum,
        payment_source_type: quickPaySourceType,
        payment_source_id: quickPaySourceId,
        transfer_id: trfId
      }

      const { data: newTxData, error: txErr } = await supabase.from('expense_transactions').insert([payload]).select().single()
      if (txErr) throw txErr

      const newTxId = newTxData?.id

      if (quickPaySourceType && quickPaySourceId && newTxId) {
        await modifyPaymentSourceBalance(
          quickPaySourceType,
          quickPaySourceId,
          amountNum,
          quickPayCurrency,
          rateNum,
          'payment',
          newTxId,
          quickPayDate,
          payload.description,
          compName,
          finalCompId
        )
      }

      const sourceName = getPaymentSourceName(quickPaySourceType, quickPaySourceId)
      await logActivity(
        'expense',
        'INSERT',
        `Sabit Gider Hızlı Ödendi: ${payload.description} (${sourceName})`,
        newTxId,
        amountNum,
        quickPayCurrency,
        null,
        newTxData,
        finalCompId
      )

      toast.success(`${quickPayTemplate?.title || 'Sabit Gider'} ödendi olarak kaydedildi! (${sourceName})`)
      setIsQuickPayModalOpen(false)
      fetchExpenses()
      fetchPaymentSources()
    } catch (err: any) {
      toast.error('Hızlı Ödeme Hatası: ' + err.message)
    }
  }

  // =========================================================================================
  // --- MANUEL GİDER EKLEME / SİLME ---
  // =========================================================================================
  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault()
    const amountNum = parseFloat(txAmount)
    const rateNum = txCurrency === 'TRY' ? 1 : (parseFloat(txExchangeRate) || 1)
    if (!amountNum || !txCategoryId || !txCompanyId || !paymentSource) {
      return toast.error("Lütfen Tutar, Şirket/Ev, Kategori ve Ödeme Kaynağını eksiksiz girin.")
    }

    try {
      const parts = paymentSource.split('|')
      const pType = parts[0]
      const pId = parts[1]
      const trfId = `EXP-${Date.now()}`
      const compName = companies.find(c => c.id === txCompanyId)?.name || ''
      const finalCompId = txCompanyId === 'common' ? null : txCompanyId

      const payload = {
        category_id: txCategoryId,
        company_id: finalCompId,
        tx_date: txDate,
        description: txDesc,
        amount: amountNum,
        currency: txCurrency,
        exchange_rate: rateNum,
        payment_source_type: pType,
        payment_source_id: pId,
        transfer_id: trfId
      }

      const { data: newTxData, error: txErr } = await supabase.from('expense_transactions').insert([payload]).select().single()
      if (txErr) throw txErr

      const newTxId = newTxData?.id

      if (pType && pId && newTxId) {
        await modifyPaymentSourceBalance(pType, pId, amountNum, txCurrency, rateNum, 'payment', newTxId, txDate, txDesc, compName, finalCompId)
      }

      // LOG KAYDI
      await logActivity('expense', 'INSERT', `Yeni Gider İşlendi: ${txDesc}`, newTxId, amountNum, txCurrency, null, newTxData, finalCompId)

      toast.success('Gider başarıyla kaydedildi ve tutar hesaptan düşüldü.')
      setTxDesc('')
      setTxAmount('')
      fetchExpenses()
      fetchPaymentSources()
    } catch (err: any) { 
      toast.error('Kayıt Hatası: ' + err.message) 
    }
  }

  function handleDeleteExpense(txId: string) {
    setConfirmDialog({
      isOpen: true,
      title: 'Gideri Sil',
      message: 'Bu gideri silmek ve harcanan tutarı ilgili hesaba geri iade etmek istediğinize emin misiniz?',
      confirmText: 'Evet, Sil ve İade Et',
      cancelText: 'Vazgeç',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        try {
          const oldTx = expenses.find(t => t.id === txId)
          if (!oldTx) return
          const oldRate = oldTx.exchange_rate || 1

          if (oldTx.payment_source_type && oldTx.payment_source_id) {
            const compName = oldTx.company?.name || ''
            await modifyPaymentSourceBalance(
              oldTx.payment_source_type, 
              oldTx.payment_source_id, 
              oldTx.amount, 
              oldTx.currency || 'TRY', 
              oldRate, 
              'reverse', 
              oldTx.id, 
              oldTx.tx_date, 
              oldTx.description, 
              compName, 
              oldTx.company_id || null
            )
          }

          await supabase.from('expense_transactions').delete().eq('id', txId)
          
          await logActivity('expense', 'DELETE', `Gider silindi ve iade edildi: ${oldTx.description}`, txId, oldTx.amount, oldTx.currency || 'TRY', oldTx, null, oldTx.company_id)

          toast.success('Gider silindi ve tutar hesaba iade edildi.')
          fetchExpenses()
          fetchPaymentSources()
        } catch (err: any) { 
          toast.error("Silme Hatası: " + err.message) 
        }
      }
    })
  }

  // Şablondan Formu Hızlı Doldurma
  function handleFillFromTemplate(tmpl: RecurringTemplate) {
    setTxCompanyId(tmpl.company_id)
    if (tmpl.category_id) setTxCategoryId(tmpl.category_id)
    if (tmpl.amount > 0) setTxAmount(tmpl.amount.toString())
    setTxCurrency(tmpl.currency)
    setTxDesc(`${tmpl.title} - ${currentMonthName}`)
    if (tmpl.default_source_type && tmpl.default_source_id) {
      setPaymentSource(`${tmpl.default_source_type}|${tmpl.default_source_id}`)
    }
    toast.success(`"${tmpl.title}" bilgileri forma yüklendi.`)
  }

  const getPaymentSourceName = (type: string, id: string) => {
    if (type === 'cash') return cashes.find(c => c.id === id)?.name || 'Kasa'
    if (type === 'bank') return banks.find(b => b.id === id)?.bank_name || 'Banka'
    if (type === 'card') return cards.find(c => c.id === id)?.name || 'Kredi Kartı'
    return ''
  }

  const getCompanyName = (id?: string | null) => {
    if (!id || id === 'common') return 'Ortak / Bağımsız'
    return companies.find(c => c.id === id)?.name || 'Merkez'
  }

  const getCategoryName = (id?: string) => {
    return categories.find(c => c.id === id)?.name || 'Genel'
  }

  // Filtreleme
  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = 
      e.description?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      e.category?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      e.company?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCompany = selectedCompanyFilter === 'all' || e.company_id === selectedCompanyFilter
    return matchesSearch && matchesCompany
  })

  const totalCommercialTry = expenses
    .filter(e => e.company && !e.company.is_personal && (selectedCompanyFilter === 'all' || e.company_id === selectedCompanyFilter))
    .reduce((acc, e) => acc + (e.amount * (e.exchange_rate || 1)), 0)

  const totalPersonalTry = expenses
    .filter(e => e.company && e.company.is_personal && (selectedCompanyFilter === 'all' || e.company_id === selectedCompanyFilter))
    .reduce((acc, e) => acc + (e.amount * (e.exchange_rate || 1)), 0)

  // =========================================================================================
  // --- BU AYIN SABİT GİDERLERİ TAKİP ŞERİDİ VERİLERİ ---
  // =========================================================================================
  const recurringStatusList = useMemo(() => {
    const targetTemplates = recurringTemplates.filter(t => 
      selectedCompanyFilter === 'all' || t.company_id === selectedCompanyFilter
    )

    return targetTemplates.map(tmpl => {
      // Bu ay için eşleşen bir gider var mı?
      const matchedExpense = expenses.find(e => {
        if (!e.tx_date.startsWith(currentYearMonth)) return false
        if (e.transfer_id && e.transfer_id.includes(tmpl.id)) return true
        if (e.description?.toLowerCase().includes(tmpl.title.toLowerCase())) return true
        if (e.company_id === tmpl.company_id && e.category_id === tmpl.category_id && Math.abs(e.amount - tmpl.amount) < 0.01) return true
        return false
      })

      const isPaid = !!matchedExpense
      const diffDays = tmpl.due_day - currentDay

      return {
        template: tmpl,
        isPaid,
        matchedExpense,
        diffDays
      }
    })
  }, [recurringTemplates, expenses, currentYearMonth, currentDay, selectedCompanyFilter])

  const totalRecurringCount = recurringStatusList.length
  const paidRecurringCount = recurringStatusList.filter(r => r.isPaid).length
  const pendingRecurringCount = totalRecurringCount - paidRecurringCount

  const totalRecurringBudgetTRY = recurringStatusList.reduce((acc, r) => {
    const rate = r.template.currency === 'USD' ? rates.USD : r.template.currency === 'EUR' ? rates.EUR : 1
    return acc + (r.template.amount * rate)
  }, 0)

  const paidRecurringTotalTRY = recurringStatusList.filter(r => r.isPaid).reduce((acc, r) => {
    const exp = r.matchedExpense!
    return acc + (exp.amount * (exp.exchange_rate || 1))
  }, 0)

  const pendingRecurringTotalTRY = Math.max(0, totalRecurringBudgetTRY - paidRecurringTotalTRY)

  const filteredTrackerList = recurringStatusList.filter(r => {
    if (trackerFilter === 'paid') return r.isPaid
    if (trackerFilter === 'pending') return !r.isPaid
    return true
  })

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] relative">
      <Toaster position="bottom-right" containerStyle={{ zIndex: 99999999 }} toastOptions={{ style: { background: '#0f172a', color: '#fff', border: '1px solid #1e293b', fontSize: '12px' } }} />

      {/* ÜST BİLGİ VE ÖZET KARTLARI */}
      <div style={{ animation: 'fadeInDown 0.4s both' }} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0d1322] border border-slate-800/80 p-4 rounded-xl shadow-md shrink-0 mb-3 transition-colors">
        <div className="flex items-center gap-3 text-white">
          <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20"><Receipt size={24} /></div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-lg leading-none">Genel Giderler & Masraflar</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300">
                {selectedCompanyFilter === 'all' ? 'Tüm Merkezler' : getCompanyName(selectedCompanyFilter)}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Sabit (kira, fatura, maaş) ve operasyonel değişken masraf yönetimi</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-xs font-mono">
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-slate-400 font-sans tracking-wide">TİCARİ ŞİRKET GİDERLERİ</span>
            <div className="flex gap-3 mt-0.5 font-bold">
              <span className="text-rose-400 text-xl">{formatMoney(totalCommercialTry, 'TRY').formatted}</span>
            </div>
          </div>
          <div className="w-px h-8 bg-slate-800"></div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-slate-500 font-sans tracking-wide">ŞAHSİ / EV GİDERLERİ</span>
            <div className="flex gap-3 mt-0.5 font-bold">
              <span className="text-slate-300 text-lg">{formatMoney(totalPersonalTry, 'TRY').formatted}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================================= */}
      {/* --- BU AYIN SABİT GİDERLERİ TAKİP ŞERİDİ (CURRENT MONTH RECURRING TRACKER) --- */}
      {/* ========================================================================================= */}
      <div style={{ animation: 'fadeInDown 0.4s both 0.1s' }} className="bg-gradient-to-r from-[#0d1322] via-[#0a1020] to-[#0d1322] border border-indigo-500/20 rounded-xl p-3 mb-3 shadow-lg shrink-0">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-2.5 mb-2.5 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/30">
              <Calendar size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200 capitalize">{currentMonthName} Sabit Gider Takibi</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${paidRecurringCount === totalRecurringCount && totalRecurringCount > 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'}`}>
                  {paidRecurringCount} / {totalRecurringCount} Ödendi
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Aylık düzenli kira, aidat, fatura ve taahhütlerin güncel ödeme durumu
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Filtre Butonları */}
            <div className="flex items-center gap-1 bg-[#070b14] border border-slate-800 p-0.5 rounded-lg text-[10px]">
              <button 
                onClick={() => setTrackerFilter('all')} 
                className={`px-2 py-1 rounded transition-colors font-medium ${trackerFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Tümü ({totalRecurringCount})
              </button>
              <button 
                onClick={() => setTrackerFilter('pending')} 
                className={`px-2 py-1 rounded transition-colors font-medium flex items-center gap-1 ${trackerFilter === 'pending' ? 'bg-amber-900/40 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-amber-400'}`}
              >
                <Clock size={10} /> Bekleyenler ({pendingRecurringCount})
              </button>
              <button 
                onClick={() => setTrackerFilter('paid')} 
                className={`px-2 py-1 rounded transition-colors font-medium flex items-center gap-1 ${trackerFilter === 'paid' ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-emerald-400'}`}
              >
                <CheckCircle2 size={10} /> Ödenenler ({paidRecurringCount})
              </button>
            </div>

            {/* Görünüm Geçişi: Liste / Kart */}
            <div className="flex items-center gap-0.5 bg-[#070b14] border border-slate-800 p-0.5 rounded-lg">
              <button
                onClick={() => setTrackerLayout('list')}
                className={`p-1 rounded transition-colors ${trackerLayout === 'list' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                title="Yoğun Liste Görünümü (Çoklu Ürün)"
              >
                <List size={13} />
              </button>
              <button
                onClick={() => setTrackerLayout('grid')}
                className={`p-1 rounded transition-colors ${trackerLayout === 'grid' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                title="Kart / Izgara Görünümü"
              >
                <LayoutGrid size={13} />
              </button>
            </div>

            {totalRecurringCount > 0 && (
              <div className="hidden xl:flex items-center gap-4 text-xs font-mono bg-[#070b14] px-3 py-1 rounded-lg border border-slate-800">
                <div>
                  <span className="text-[9px] text-slate-500 block font-sans">Kalan Bekleyen:</span>
                  <span className="font-bold text-amber-400">{formatMoney(pendingRecurringTotalTRY, 'TRY').formatted}</span>
                </div>
                <div className="w-px h-6 bg-slate-800"></div>
                <div>
                  <span className="text-[9px] text-slate-500 block font-sans">Ödenen:</span>
                  <span className="font-bold text-emerald-400">{formatMoney(paidRecurringTotalTRY, 'TRY').formatted}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Çoklu Ürün Sığması İçin Liste / Kart Görünümü */}
        {totalRecurringCount === 0 ? (
          <div className="flex items-center justify-between py-2 px-3 bg-[#070b14]/70 border border-dashed border-slate-800 rounded-lg">
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <Sparkles size={14} className="text-indigo-400" />
              <span>Henüz tanımlı sabit gider şablonunuz bulunmuyor. Sol paneldeki <strong>Sabit Şablonlar</strong> sekmesinden Kira, Fatura vb. ekleyebilirsiniz.</span>
            </div>
            <button 
              onClick={openAddTemplateModal}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold px-3 py-1 rounded-md transition-all active:scale-95 flex items-center gap-1 shrink-0"
            >
              <Plus size={12} /> Şablon Ekle
            </button>
          </div>
        ) : trackerLayout === 'list' ? (
          /* ========================================================================= */
          /* --- YOĞUN LİSTE GÖRÜNÜMÜ (COMPACT HIGH-DENSITY TABLE) --- */
          /* ========================================================================= */
          <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-[#070b14]/80 max-h-56 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead className="sticky top-0 bg-[#0a0f1d] z-10 text-[10px] text-slate-400 border-b border-slate-800/80 shadow-sm">
                <tr>
                  <th className="py-2 px-3 font-semibold w-48">Durum / Vade</th>
                  <th className="py-2 px-3 font-semibold">Sabit Gider Tanımı</th>
                  <th className="py-2 px-3 font-semibold w-40">Merkez</th>
                  <th className="py-2 px-3 font-semibold w-32">Kategori</th>
                  <th className="py-2 px-3 font-semibold w-44">Ödeme Kaynağı</th>
                  <th className="py-2 px-3 font-semibold text-right w-32">Tutar</th>
                  <th className="py-2 px-3 font-semibold text-center w-28">Hızlı İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredTrackerList.map(({ template: tmpl, isPaid, matchedExpense, diffDays }) => {
                  const comp = companies.find(c => c.id === tmpl.company_id)
                  const isPersonal = comp?.is_personal
                  const catName = getCategoryName(tmpl.category_id)

                  let dueBadge = null
                  if (isPaid) {
                    dueBadge = (
                      <span className="inline-flex items-center gap-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 size={11} className="shrink-0" /> Ödendi ({formatDateTR(matchedExpense!.tx_date)})
                      </span>
                    )
                  } else if (diffDays < 0) {
                    dueBadge = (
                      <span className="inline-flex items-center gap-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        <AlertTriangle size={11} className="shrink-0" /> {Math.abs(diffDays)} gün gecikti (Ayın {tmpl.due_day}'i)
                      </span>
                    )
                  } else if (diffDays === 0) {
                    dueBadge = (
                      <span className="inline-flex items-center gap-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 animate-pulse">
                        <Clock size={11} className="shrink-0" /> Bugün son gün!
                      </span>
                    )
                  } else {
                    dueBadge = (
                      <span className="inline-flex items-center gap-1.5 text-[9px] font-medium px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-300 border border-slate-700">
                        <Calendar size={11} className="text-slate-400 shrink-0" /> {diffDays} gün kaldı (Ayın {tmpl.due_day}'i)
                      </span>
                    )
                  }

                  return (
                    <tr 
                      key={tmpl.id} 
                      className={`hover:bg-slate-800/30 transition-colors ${isPaid ? 'opacity-85' : ''}`}
                    >
                      <td className="py-2 px-3 align-middle">{dueBadge}</td>
                      <td className="py-2 px-3 align-middle">
                        <div className="font-bold text-slate-200 truncate max-w-[280px]" title={tmpl.title}>
                          {tmpl.title}
                        </div>
                        {tmpl.note && (
                          <div className="text-[9px] text-slate-500 truncate max-w-[280px]">
                            {tmpl.note}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 align-middle">
                        <span className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded font-bold truncate max-w-[140px] ${isPersonal ? 'bg-slate-800 text-slate-300' : 'bg-indigo-950/70 text-indigo-300 border border-indigo-800/50'}`}>
                          {isPersonal ? <Home size={9} /> : <Building size={9} />}
                          {comp?.name || 'Ortak'}
                        </span>
                      </td>
                      <td className="py-2 px-3 align-middle text-slate-400 text-[10px] truncate max-w-[120px]">
                        {catName}
                      </td>
                      <td className="py-2 px-3 align-middle text-[10px]">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 text-slate-400 truncate max-w-[170px]">
                            {matchedExpense?.payment_source_type === 'card' ? <CreditCard size={11} className="text-amber-400 shrink-0" /> : matchedExpense?.payment_source_type === 'bank' ? <Landmark size={11} className="text-blue-400 shrink-0" /> : <Wallet size={11} className="text-emerald-400 shrink-0" />}
                            <span className="truncate">{getPaymentSourceName(matchedExpense!.payment_source_type, matchedExpense!.payment_source_id)}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400 truncate max-w-[170px]">
                            {tmpl.default_source_type === 'card' && <CreditCard size={11} className="text-amber-400 shrink-0" />}
                            {tmpl.default_source_type === 'bank' && <Landmark size={11} className="text-blue-400 shrink-0" />}
                            {tmpl.default_source_type === 'cash' && <Wallet size={11} className="text-emerald-400 shrink-0" />}
                            <span className="truncate">{tmpl.default_source_id ? getPaymentSourceName(tmpl.default_source_type || '', tmpl.default_source_id) : 'Ödeme Kaynağı Seç'}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 align-middle text-right font-mono font-bold text-[12px]">
                        <span className={isPaid ? 'text-emerald-400' : 'text-rose-400'}>
                          {formatMoney(tmpl.amount, tmpl.currency).formatted}
                        </span>
                      </td>
                      <td className="py-2 px-3 align-middle text-center">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <Check size={11} /> Ödendi
                          </span>
                        ) : (
                          <button
                            onClick={() => openQuickPayModal(tmpl)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-md transition-all active:scale-95 inline-flex items-center gap-1 shadow-sm shadow-indigo-950/40"
                            title="Kredi Kartı veya Bankadan Hızlı Öde"
                          >
                            <Zap size={10} className="text-amber-300" /> Hızlı Öde
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* ========================================================================= */
          /* --- ALTERNATİF KART / IZGARA GÖRÜNÜMÜ --- */
          /* ========================================================================= */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 max-h-48 overflow-y-auto custom-scrollbar p-0.5">
            {filteredTrackerList.map(({ template: tmpl, isPaid, matchedExpense, diffDays }) => {
              const comp = companies.find(c => c.id === tmpl.company_id)
              const isPersonal = comp?.is_personal
              const catName = getCategoryName(tmpl.category_id)

              let dueStatusBadge = null
              if (isPaid) {
                dueStatusBadge = (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 size={10} /> Ödendi ({formatDateTR(matchedExpense!.tx_date)})
                  </span>
                )
              } else if (diffDays < 0) {
                dueStatusBadge = (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
                    <AlertTriangle size={10} /> {Math.abs(diffDays)} gün gecikti
                  </span>
                )
              } else if (diffDays === 0) {
                dueStatusBadge = (
                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 animate-pulse">
                    <Clock size={10} /> Bugün son gün!
                  </span>
                )
              } else {
                dueStatusBadge = (
                  <span className="inline-flex items-center gap-1 text-[9px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    <Calendar size={10} /> {diffDays} gün kaldı (Ayın {tmpl.due_day}'i)
                  </span>
                )
              }

              return (
                <div 
                  key={tmpl.id}
                  className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between ${isPaid ? 'bg-[#070b14]/90 border-slate-800/80 hover:border-slate-700' : 'bg-[#0a0f1e] border-indigo-500/30 hover:border-indigo-400 shadow-md'}`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold truncate max-w-[120px] flex items-center gap-1 ${isPersonal ? 'bg-slate-800 text-slate-300' : 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/50'}`}>
                        {isPersonal ? <Home size={9} /> : <Building size={9} />}
                        {comp?.name || 'Ortak'}
                      </span>
                      <span className="text-[9px] text-slate-500 truncate">{catName}</span>
                    </div>

                    <h4 className="text-[12px] font-bold text-slate-200 truncate mt-1" title={tmpl.title}>
                      {tmpl.title}
                    </h4>

                    <div className="text-[13px] font-mono font-bold text-rose-400 mt-0.5">
                      {formatMoney(tmpl.amount, tmpl.currency).formatted}
                    </div>

                    <div className="mt-1.5">{dueStatusBadge}</div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2">
                    {isPaid ? (
                      <div className="text-[9px] text-slate-500 truncate flex items-center gap-1">
                        {matchedExpense?.payment_source_type === 'card' ? <CreditCard size={10} className="text-amber-400" /> : matchedExpense?.payment_source_type === 'bank' ? <Landmark size={10} className="text-blue-400" /> : <Wallet size={10} className="text-emerald-400" />}
                        <span className="truncate">{getPaymentSourceName(matchedExpense!.payment_source_type, matchedExpense!.payment_source_id)}</span>
                      </div>
                    ) : (
                      <>
                        <div className="text-[9px] text-slate-400 flex items-center gap-1 truncate">
                          {tmpl.default_source_type === 'card' && <CreditCard size={10} className="text-amber-400" />}
                          {tmpl.default_source_type === 'bank' && <Landmark size={10} className="text-blue-400" />}
                          {tmpl.default_source_type === 'cash' && <Wallet size={10} className="text-emerald-400" />}
                          <span className="truncate">{tmpl.default_source_id ? getPaymentSourceName(tmpl.default_source_type || '', tmpl.default_source_id) : 'Ödeme Seç'}</span>
                        </div>
                        <button
                          onClick={() => openQuickPayModal(tmpl)}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-2 py-1 rounded-md transition-all active:scale-95 flex items-center gap-1 shadow-md shadow-indigo-950/40 shrink-0"
                          title="Kredi Kartı veya Bankadan Hızlı Öde"
                        >
                          <Zap size={10} className="text-amber-300" /> Hızlı Öde
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ========================================================================================= */}
      {/* --- ANA ÇALIŞMA ALANI: SOL PANEL & SAĞ LİSTE --- */}
      {/* ========================================================================================= */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        
        {/* SOL PANEL (MERKEZLER, SABİT ŞABLONLAR & KATEGORİLER) */}
        <div className="w-full lg:w-[360px] flex flex-col gap-3 shrink-0">
          
          {/* Şirket / Şahsi Dağılımları Paneli */}
          <div style={{ animation: 'fadeInUp 0.4s both 0.1s' }} className="bg-[#0d1322] border border-slate-800/80 rounded-xl flex flex-col shrink-0 max-h-[38%] shadow-lg">
            <div className="p-3 border-b border-slate-800/80 bg-[#0a0f1d] rounded-t-xl flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Building size={14} className="text-indigo-400" /> Merkez Bazlı Dağılım
              </span>
              {selectedCompanyFilter !== 'all' && (
                <button 
                  onClick={() => setSelectedCompanyFilter('all')} 
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 underline font-medium"
                >
                  Filtreyi Temizle
                </button>
              )}
            </div>

            <div className="overflow-y-auto custom-scrollbar p-2 space-y-2">
              <div>
                <div className="text-[9px] font-bold text-slate-500 uppercase px-2 mb-1">Ticari Şirketler</div>
                <div className="space-y-1">
                  {companies.filter(c => !c.is_personal).map((c) => {
                    const compTotal = expenses.filter(e => e.company_id === c.id).reduce((acc, e) => acc + (e.amount * (e.exchange_rate || 1)), 0)
                    const isSelected = selectedCompanyFilter === c.id
                    return (
                      <div 
                        key={c.id} 
                        onClick={() => setSelectedCompanyFilter(isSelected ? 'all' : c.id)}
                        className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg border cursor-pointer transition-all ${isSelected ? 'bg-indigo-950/60 border-indigo-500 text-white' : 'bg-[#070b14] border-slate-800/50 hover:border-slate-700'}`}
                      >
                        <div className="flex-1 min-w-0 pr-2 flex items-center gap-2">
                          <Building size={12} className={isSelected ? 'text-indigo-300 shrink-0' : 'text-indigo-400 shrink-0'} />
                          <h4 className="text-[11px] font-bold truncate">{c.name}</h4>
                        </div>
                        <div className="text-right shrink-0">
                          {compTotal > 0 ? <div className="text-[11px] font-mono font-bold text-rose-400">{formatMoney(compTotal, 'TRY').formatted}</div> : <span className="text-[10px] text-slate-600">-</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="text-[9px] font-bold text-slate-500 uppercase px-2 mb-1">Şahsi / Ev Merkezleri</div>
                <div className="space-y-1">
                  {companies.filter(c => c.is_personal).map((c) => {
                    const compTotal = expenses.filter(e => e.company_id === c.id).reduce((acc, e) => acc + (e.amount * (e.exchange_rate || 1)), 0)
                    const isSelected = selectedCompanyFilter === c.id
                    return (
                      <div 
                        key={c.id} 
                        onClick={() => setSelectedCompanyFilter(isSelected ? 'all' : c.id)}
                        className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg border cursor-pointer transition-all ${isSelected ? 'bg-slate-800 border-indigo-400 text-white' : 'bg-[#0f172a] border-slate-700/50 hover:border-slate-600'}`}
                      >
                        <div className="flex-1 min-w-0 pr-2 flex items-center gap-2">
                          <Home size={12} className="text-slate-400 shrink-0" />
                          <h4 className="text-[11px] font-bold truncate">{c.name}</h4>
                        </div>
                        <div className="text-right shrink-0">
                          {compTotal > 0 ? <div className="text-[11px] font-mono font-bold text-slate-300">{formatMoney(compTotal, 'TRY').formatted}</div> : <span className="text-[10px] text-slate-600">-</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* SEKME KONTROLÜ: Sabit Şablonlar vs Gider Kategorileri */}
          <div style={{ animation: 'fadeInUp 0.4s both 0.2s' }} className="bg-[#0d1322] border border-slate-800/80 rounded-xl flex flex-col flex-1 min-h-0 shadow-lg">
            
            {/* Sekme Butonları */}
            <div className="p-2 border-b border-slate-800/80 bg-[#0a0f1d] rounded-t-xl flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1 bg-[#070b14] p-1 rounded-lg border border-slate-800 flex-1">
                <button
                  onClick={() => setActiveLeftTab('templates')}
                  className={`flex-1 py-1 px-2 rounded text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${activeLeftTab === 'templates' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <RefreshCw size={11} /> Sabit Şablonlar ({recurringTemplates.length})
                </button>
                <button
                  onClick={() => setActiveLeftTab('categories')}
                  className={`flex-1 py-1 px-2 rounded text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${activeLeftTab === 'categories' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <Tags size={11} /> Kategoriler ({categories.length})
                </button>
              </div>

              {activeLeftTab === 'templates' ? (
                <button 
                  onClick={openAddTemplateModal} 
                  className="bg-slate-700 hover:bg-slate-600 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1 shrink-0"
                  title="Yeni Sabit Gider Şablonu Ekle"
                >
                  <Plus size={12}/> Yeni
                </button>
              ) : (
                <button 
                  onClick={openAddCategoryModal} 
                  className="bg-slate-700 hover:bg-slate-600 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1 shrink-0"
                  title="Yeni Gider Kategorisi Ekle"
                >
                  <Plus size={12}/> Yeni
                </button>
              )}
            </div>

            {/* TAB 1: SABİT GİDER ŞABLONLARI LİSTESİ */}
            {activeLeftTab === 'templates' && (
              <div className="overflow-y-auto flex-1 custom-scrollbar p-2 space-y-1.5">
                {recurringTemplates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-slate-500 text-[11px] py-8 opacity-70">
                    <RefreshCw size={24} className="mb-2 opacity-50" />
                    <p className="font-semibold">Henüz sabit gider tanımlanmadı.</p>
                    <p className="text-[10px] text-slate-500 mt-1 text-center max-w-[200px]">Merkeze ait kira, fatura, aidat vb. şablonları ekleyin.</p>
                  </div>
                ) : (
                  recurringTemplates
                    .filter(t => selectedCompanyFilter === 'all' || t.company_id === selectedCompanyFilter)
                    .map((tmpl) => {
                      const comp = companies.find(c => c.id === tmpl.company_id)
                      const isPersonal = comp?.is_personal

                      return (
                        <div 
                          key={tmpl.id}
                          className="p-2.5 rounded-lg border bg-[#070b14] border-slate-800/60 hover:border-slate-700 transition-all flex flex-col gap-1.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold truncate max-w-[120px] flex items-center gap-1 ${isPersonal ? 'bg-slate-800 text-slate-300' : 'bg-indigo-950/70 text-indigo-300'}`}>
                                  {isPersonal ? <Home size={9} /> : <Building size={9} />}
                                  {comp?.name || 'Merkez'}
                                </span>
                                <span className="text-[9px] text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded">
                                  Her ayın {tmpl.due_day}. günü
                                </span>
                              </div>
                              <h4 className="text-[11px] font-bold text-slate-200 truncate">{tmpl.title}</h4>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="text-[11px] font-mono font-bold text-rose-400">
                                {formatMoney(tmpl.amount, tmpl.currency).formatted}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[9px] text-slate-500 pt-1 border-t border-slate-800/40">
                            <div className="flex items-center gap-1 truncate max-w-[170px]">
                              {tmpl.default_source_type === 'card' && <CreditCard size={10} className="text-amber-400 shrink-0" />}
                              {tmpl.default_source_type === 'bank' && <Landmark size={10} className="text-blue-400 shrink-0" />}
                              {tmpl.default_source_type === 'cash' && <Wallet size={10} className="text-emerald-400 shrink-0" />}
                              <span className="truncate text-slate-400">{tmpl.default_source_id ? getPaymentSourceName(tmpl.default_source_type || '', tmpl.default_source_id) : 'Ödeme Kaynağı Belirtilmemiş'}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => openQuickPayModal(tmpl)}
                                className="text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-0.5"
                                title="Bu Şablonla Hızlı Öde"
                              >
                                <Zap size={10} /> Öde
                              </button>
                              <button onClick={() => openEditTemplateModal(tmpl)} className="text-slate-500 hover:text-amber-400 transition-colors" title="Düzenle">
                                <Edit3 size={11} />
                              </button>
                              <button onClick={() => handleDeleteTemplate(tmpl.id)} className="text-slate-600 hover:text-rose-400 transition-colors" title="Sil">
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })
                )}
              </div>
            )}

            {/* TAB 2: KATEGORİLER LİSTESİ */}
            {activeLeftTab === 'categories' && (
              <div className="overflow-y-auto flex-1 custom-scrollbar p-2 space-y-1.5 flex flex-col">
                <div className="flex items-center gap-1 mb-1.5 pb-1.5 border-b border-slate-800/60 text-[10px]">
                  <span className="text-slate-500 mr-1">Tür:</span>
                  <button 
                    onClick={() => setCategoryTypeFilter('all')} 
                    className={`px-1.5 py-0.5 rounded ${categoryTypeFilter === 'all' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
                  >
                    Tümü
                  </button>
                  <button 
                    onClick={() => setCategoryTypeFilter('fixed')} 
                    className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${categoryTypeFilter === 'fixed' ? 'bg-indigo-900/60 text-indigo-300 font-bold border border-indigo-500/30' : 'text-slate-400 hover:text-indigo-300'}`}
                  >
                    🔄 Sabit
                  </button>
                  <button 
                    onClick={() => setCategoryTypeFilter('variable')} 
                    className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${categoryTypeFilter === 'variable' ? 'bg-amber-900/60 text-amber-300 font-bold border border-amber-500/30' : 'text-slate-400 hover:text-amber-300'}`}
                  >
                    ⚡ Değişken
                  </button>
                </div>

                <div className="space-y-1.5 flex-1">
                  {categories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-slate-500 text-[11px] py-8 opacity-60">
                      <Tags size={24} className="mb-2" />
                      <p>Kategori bulunamadı.</p>
                    </div>
                  ) : (
                    categories
                      .filter(c => categoryTypeFilter === 'all' || c.type === categoryTypeFilter)
                      .map((c) => {
                        const catTotal = expenses.filter(e => e.category_id === c.id).reduce((acc, e) => acc + (e.amount * (e.exchange_rate || 1)), 0)
                        return (
                          <div 
                            key={c.id} 
                            className="flex items-center justify-between py-2 px-3 rounded-lg border bg-[#070b14] border-slate-800/50 hover:border-slate-700 transition-colors"
                          >
                            <div className="flex-1 min-w-0 pr-2 flex items-center gap-2">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${c.type === 'fixed' ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/50' : 'bg-amber-950/60 text-amber-400 border border-amber-800/50'}`}>
                                {c.type === 'fixed' ? 'Sabit' : 'Değişken'}
                              </span>
                              <h4 className={`text-[11px] truncate ${catTotal > 0 ? 'font-bold text-slate-200' : 'font-medium text-slate-400'}`}>
                                {c.name}
                              </h4>
                            </div>

                            <div className="text-right shrink-0 flex items-center gap-2">
                              {catTotal > 0 && (
                                <div className="text-[11px] font-mono font-bold text-rose-400">
                                  {formatMoney(catTotal, 'TRY').formatted}
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2">
                                <button onClick={() => openEditCategoryModal(c)} className="text-slate-500 hover:text-amber-400 transition-colors" title="Düzenle">
                                  <Edit3 size={11} />
                                </button>
                                <button onClick={() => handleDeleteCategory(c.id)} className="text-slate-600 hover:text-rose-400 transition-colors" title="Sil">
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* SAĞ PANEL: GİDER EKLEME FORMU & GİDERLER TABLOSU */}
        <div style={{ animation: 'fadeInUp 0.4s both 0.3s' }} className="flex-1 bg-[#0d1322] border border-slate-800/80 rounded-xl flex flex-col min-w-0 shadow-lg">
          <div className="p-4 overflow-y-auto custom-scrollbar flex-1 flex flex-col">
            
            {/* Gider Ekleme Formu */}
            <div className="mb-4 bg-[#070b14] p-3 rounded-xl border border-slate-800 shrink-0 hover:border-slate-700 transition-colors">
              
              {/* Şablondan Hızlı Doldurma Seçeneği */}
              {recurringTemplates.length > 0 && (
                <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-800/60">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                    <Sparkles size={14} className="text-indigo-400" />
                    <span>Şablondan Hızlı Doldur:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select 
                      onChange={(e) => {
                        const tmpl = recurringTemplates.find(t => t.id === e.target.value)
                        if (tmpl) handleFillFromTemplate(tmpl)
                        e.target.value = ''
                      }}
                      className="bg-[#0d1322] border border-slate-700 rounded px-2.5 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                      defaultValue=""
                    >
                      <option value="" disabled>⚡ Sabit Şablon Seç...</option>
                      {recurringTemplates.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.title} ({getCompanyName(t.company_id)} - {formatMoney(t.amount, t.currency).formatted})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <form onSubmit={handleAddExpense} className="flex flex-wrap items-end gap-2.5">
                <div className="w-28">
                  <label className="block text-[9px] text-slate-400 mb-0.5">Tarih</label>
                  <input type="date" required value={txDate} onChange={(e) => setTxDate(e.target.value)} className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors" />
                </div>
                
                <div className="w-36">
                  <label className="block text-[9px] text-slate-400 mb-0.5">İlgili Merkez *</label>
                  <select value={txCompanyId} onChange={(e) => setTxCompanyId(e.target.value)} required className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors">
                    <option value="" className="bg-[#0d1322]">Merkez Seç...</option>
                    <optgroup label="Ticari Şirketler" className="bg-[#0d1322] text-slate-400 font-bold">
                      {companies.filter(c => !c.is_personal).map(c => <option key={c.id} value={c.id} className="text-slate-200 font-normal">{c.name}</option>)}
                    </optgroup>
                    <optgroup label="Şahsi / Ev Merkezleri" className="bg-[#0d1322] text-slate-400 font-bold">
                      {companies.filter(c => c.is_personal).map(c => <option key={c.id} value={c.id} className="text-slate-200 font-normal">{c.name}</option>)}
                    </optgroup>
                  </select>
                </div>

                <div className="w-32">
                  <label className="block text-[9px] text-slate-400 mb-0.5">Kategori *</label>
                  <select value={txCategoryId} onChange={(e) => setTxCategoryId(e.target.value)} required className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors">
                    <option value="">Kategori Seç...</option>
                    <optgroup label="🔄 Sabit Giderler">
                      {categories.filter(c => c.type === 'fixed').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                    <optgroup label="⚡ Değişken Giderler">
                      {categories.filter(c => c.type === 'variable').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                  </select>
                </div>

                <div className="w-40">
                  <label className="block text-[9px] text-slate-400 mb-0.5">Ödeme Kaynağı *</label>
                  <select value={paymentSource} onChange={(e) => setPaymentSource(e.target.value)} required className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors">
                    <option value="">Seçiniz...</option>
                    {cards.length > 0 && (
                      <optgroup label="💳 Kredi Kartları">
                        {cards.map(c => <option key={`card|${c.id}`} value={`card|${c.id}`}>{c.name} (Borç: {formatMoney(c.current_debt, 'TRY').formatted})</option>)}
                      </optgroup>
                    )}
                    {banks.length > 0 && (
                      <optgroup label="🏦 Bankalar">
                        {banks.map(b => <option key={`bank|${b.id}`} value={`bank|${b.id}`}>{b.bank_name} - {b.account_name}</option>)}
                      </optgroup>
                    )}
                    {cashes.length > 0 && (
                      <optgroup label="💵 Nakit Kasalar">
                        {cashes.map(c => <option key={`cash|${c.id}`} value={`cash|${c.id}`}>{c.name}</option>)}
                      </optgroup>
                    )}
                  </select>
                </div>

                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[9px] text-slate-400 mb-0.5">Açıklama</label>
                  <input type="text" required placeholder="Harcama detayı nedir?" value={txDesc} onChange={(e) => setTxDesc(e.target.value)} className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors" />
                </div>

                <div className="w-16">
                  <label className="block text-[9px] text-slate-400 mb-0.5">Döviz</label>
                  <select value={txCurrency} onChange={(e) => setTxCurrency(e.target.value as any)} className="w-full bg-[#0d1322] border border-slate-700 rounded px-1.5 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors">
                    <option value="TRY">₺</option>
                    <option value="USD">$</option>
                    <option value="EUR">€</option>
                  </select>
                </div>

                {txCurrency !== 'TRY' && (
                  <div className="w-16">
                    <label className="block text-[9px] text-slate-400 mb-0.5">Kur</label>
                    <input type="number" step="0.0001" required value={txExchangeRate} onChange={(e) => setTxExchangeRate(e.target.value)} className="w-full bg-rose-900/20 text-rose-300 border border-rose-500/30 rounded px-2 py-1.5 text-[11px] focus:outline-none font-mono transition-colors" />
                  </div>
                )}

                <div className="w-24">
                  <label className="block text-[9px] text-slate-400 mb-0.5">Tutar</label>
                  <input type="number" step="0.01" required placeholder="0.00" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-rose-400 font-bold focus:outline-none font-mono transition-colors" />
                </div>

                <button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95 h-[30px] flex items-center gap-1 shadow-md shadow-rose-950/40">
                  <Plus size={14} /> Ekle
                </button>
              </form>
            </div>

            {/* Arama Barı ve Filtre */}
            <div className="flex items-center gap-2 mb-3 bg-[#0a0f1d] p-2 rounded-lg border border-slate-800/80 shrink-0">
               <Search size={14} className="text-slate-500 ml-2" />
               <input 
                 type="text" 
                 placeholder="Giderler, merkezler veya kategoriler arasında ara..." 
                 value={searchTerm} 
                 onChange={(e) => setSearchTerm(e.target.value)} 
                 className="bg-transparent border-none text-xs text-white focus:outline-none w-full" 
               />
               {selectedCompanyFilter !== 'all' && (
                 <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                   {getCompanyName(selectedCompanyFilter)}
                   <button onClick={() => setSelectedCompanyFilter('all')} className="hover:text-white"><X size={10} /></button>
                 </span>
               )}
            </div>

            {/* Gider Tablosu */}
            <div className="border border-slate-800/80 rounded-lg overflow-hidden flex-1 flex flex-col">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-[#0a0f1d] z-10">
                  <tr className="border-b border-slate-800/80 text-slate-400">
                    <th className="p-2.5 font-medium">Tarih</th>
                    <th className="p-2.5 font-medium">Kategori & Merkez</th>
                    <th className="p-2.5 font-medium">Açıklama & Kaynak</th>
                    <th className="p-2.5 font-medium text-right text-rose-400 bg-slate-800/20">Çıkan Tutar</th>
                    <th className="p-2.5 font-medium text-center w-12">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-10 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-500 gap-2 opacity-60 animate-in fade-in duration-500">
                           <RefreshCw size={24} className="opacity-40" />
                           <p className="font-bold">Kayıtlı gider bulunmuyor.</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredExpenses.map((t, index) => {
                      const rateStr = t.exchange_rate && t.exchange_rate !== 1 ? `Kur: ${t.exchange_rate} ➔ ` : ''
                      const tryEquivalent = t.amount * (t.exchange_rate || 1)
                      const isPersonal = t.company?.is_personal
                      const catName = t.category?.name ? parseCategoryRow('', t.category.name).category?.name || t.category.name : 'Genel'

                      return (
                      <tr 
                        key={t.id} 
                        style={{ animation: 'fadeSlideRight 0.4s both', animationDelay: `${0.2 + (index * 0.03)}s` }}
                        className="hover:bg-slate-800/30 font-mono transition-colors"
                      >
                        <td className="p-2.5 text-slate-400 align-top">{formatDateTR(t.tx_date)}</td>
                        <td className="p-2.5 text-slate-300 font-sans font-medium align-top flex flex-col items-start gap-1">
                          <span className="bg-slate-800 px-2 py-0.5 rounded-full text-[10px]">{catName}</span>
                          <span className={`text-[9px] flex items-center gap-1 ${isPersonal ? 'text-slate-400' : 'text-indigo-400'}`}>
                            {isPersonal ? <Home size={10}/> : <Building size={10}/>}
                            {t.company?.name || 'Ortak / Bağımsız'}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-200 font-sans align-top">
                          <div className="mb-1 font-medium">{t.description}</div>
                          {t.payment_source_type && t.payment_source_id && (
                            <div className="text-[9px] text-slate-500 flex items-center gap-1">
                              {t.payment_source_type === 'cash' ? <Wallet size={10} className="text-emerald-400"/> : t.payment_source_type === 'bank' ? <Landmark size={10} className="text-blue-400"/> : <CreditCard size={10} className="text-amber-400"/>} 
                              Çıkış: <strong className="text-slate-400">{getPaymentSourceName(t.payment_source_type, t.payment_source_id)}</strong>
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-right text-rose-400 font-bold align-top leading-tight bg-slate-800/10">
                          <div className="flex flex-col">
                            <span>{formatMoney(t.amount, t.currency || 'TRY').formatted}</span>
                            {t.currency !== 'TRY' && (
                              <span className="text-[9px] text-rose-400/50 mt-0.5">
                                {rateStr}{formatMoney(tryEquivalent, 'TRY').formatted}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5 text-center align-top">
                          <button onClick={() => handleDeleteExpense(t.id)} className="text-slate-600 hover:text-rose-400 transition-colors p-1" title="Gideri İptal Et ve Parayı Geri Al">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                  )})}
                </tbody>
              </table>
            </div>

          </div>
        </div>

      </div>

      {/* ========================================================================================= */}
      {/* --- HIZLI ÖDE MODALI (KREDİ KARTI SEÇENEKLİ) --- */}
      {/* ========================================================================================= */}
      {isQuickPayModalOpen && quickPayTemplate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 99999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar">
            
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/30">
                  <Zap size={20} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Sabit Gider Hızlı Öde
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {quickPayTemplate.title} • {getCompanyName(quickPayTemplate.company_id)}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsQuickPayModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleExecuteQuickPay} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">İşlem Tarihi *</label>
                  <input 
                    type="date" 
                    required 
                    value={quickPayDate} 
                    onChange={(e) => setQuickPayDate(e.target.value)} 
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">İlgili Merkez *</label>
                  <select 
                    value={quickPayCompanyId} 
                    onChange={(e) => setQuickPayCompanyId(e.target.value)} 
                    required 
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Açıklama *</label>
                <input 
                  type="text" 
                  required 
                  value={quickPayDesc} 
                  onChange={(e) => setQuickPayDesc(e.target.value)} 
                  className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors" 
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] text-slate-400 mb-1">Ödenecek Tutar *</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    placeholder="0.00" 
                    value={quickPayAmount} 
                    onChange={(e) => setQuickPayAmount(e.target.value)} 
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-rose-400 font-mono font-bold text-base focus:outline-none focus:border-indigo-500 transition-colors" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Para Birimi</label>
                  <select 
                    value={quickPayCurrency} 
                    onChange={(e) => setQuickPayCurrency(e.target.value as any)} 
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="TRY">TRY (₺)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              {quickPayCurrency !== 'TRY' && (
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Döviz Kuru</label>
                  <input 
                    type="number" 
                    step="0.0001" 
                    required 
                    value={quickPayExchangeRate} 
                    onChange={(e) => setQuickPayExchangeRate(e.target.value)} 
                    className="w-full bg-rose-950/20 text-rose-300 border border-rose-500/30 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none transition-colors" 
                  />
                </div>
              )}

              {/* ÖDEME KAYNAĞI SEÇİMİ (KREDİ KARTI SEÇENEKLİ) */}
              <div className="pt-2 border-t border-slate-800">
                <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wide mb-2 flex items-center justify-between">
                  <span>Ödeme Kaynağı Türü:</span>
                  <span className="text-[10px] font-normal text-amber-400">Kredi Kartı / Banka / Kasa</span>
                </label>

                {/* 3'lü Segment Seçici */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setQuickPaySourceType('card')
                      if (cards.length > 0 && !cards.some(c => c.id === quickPaySourceId)) {
                        setQuickPaySourceId(cards[0].id)
                      }
                    }}
                    className={`py-2 px-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${quickPaySourceType === 'card' ? 'bg-amber-950/40 border-amber-500/60 text-amber-300 shadow-md shadow-amber-950/30' : 'bg-[#070b14] border-slate-800 text-slate-400 hover:border-slate-700'}`}
                  >
                    <CreditCard size={18} className={quickPaySourceType === 'card' ? 'text-amber-400' : 'text-slate-500'} />
                    <span className="text-[11px] font-bold">Kredi Kartı</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQuickPaySourceType('bank')
                      if (banks.length > 0 && !banks.some(b => b.id === quickPaySourceId)) {
                        setQuickPaySourceId(banks[0].id)
                      }
                    }}
                    className={`py-2 px-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${quickPaySourceType === 'bank' ? 'bg-blue-950/40 border-blue-500/60 text-blue-300 shadow-md shadow-blue-950/30' : 'bg-[#070b14] border-slate-800 text-slate-400 hover:border-slate-700'}`}
                  >
                    <Landmark size={18} className={quickPaySourceType === 'bank' ? 'text-blue-400' : 'text-slate-500'} />
                    <span className="text-[11px] font-bold">Banka Hesabı</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setQuickPaySourceType('cash')
                      if (cashes.length > 0 && !cashes.some(c => c.id === quickPaySourceId)) {
                        setQuickPaySourceId(cashes[0].id)
                      }
                    }}
                    className={`py-2 px-3 rounded-xl border flex flex-col items-center gap-1 transition-all ${quickPaySourceType === 'cash' ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300 shadow-md shadow-emerald-950/30' : 'bg-[#070b14] border-slate-800 text-slate-400 hover:border-slate-700'}`}
                  >
                    <Wallet size={18} className={quickPaySourceType === 'cash' ? 'text-emerald-400' : 'text-slate-500'} />
                    <span className="text-[11px] font-bold">Nakit Kasa</span>
                  </button>
                </div>

                {/* Seçili Türe Göre Hesap / Kart Listesi */}
                <div>
                  {quickPaySourceType === 'card' && (
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Ödemenin Çekileceği Kredi Kartı *</label>
                      {cards.length === 0 ? (
                        <div className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-lg text-rose-300 text-[11px]">
                          Kayıtlı kredi kartı bulunamadı. Lütfen önce Kredi Kartları menüsünden kart ekleyin.
                        </div>
                      ) : (
                        <select
                          required
                          value={quickPaySourceId}
                          onChange={(e) => setQuickPaySourceId(e.target.value)}
                          className="w-full bg-[#070b14] border border-amber-500/40 rounded-lg px-3 py-2 text-white font-medium focus:outline-none focus:border-amber-400 transition-colors"
                        >
                          {cards.map(c => (
                            <option key={c.id} value={c.id}>
                              💳 {c.name} — Güncel Borç: {formatMoney(c.current_debt, 'TRY').formatted}
                            </option>
                          ))}
                        </select>
                      )}
                      <p className="text-[10px] text-amber-400/80 mt-1.5 flex items-center gap-1">
                        <AlertCircle size={12} /> Kart ekstresine "Gider Ödemesi" olarak işlenecek ve kart borcu artırılacaktır.
                      </p>
                    </div>
                  )}

                  {quickPaySourceType === 'bank' && (
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Ödemenin Yapılacağı Banka Hesabı *</label>
                      {banks.length === 0 ? (
                        <div className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-lg text-rose-300 text-[11px]">
                          Kayıtlı banka hesabı bulunamadı.
                        </div>
                      ) : (
                        <select
                          required
                          value={quickPaySourceId}
                          onChange={(e) => setQuickPaySourceId(e.target.value)}
                          className="w-full bg-[#070b14] border border-blue-500/40 rounded-lg px-3 py-2 text-white font-medium focus:outline-none focus:border-blue-400 transition-colors"
                        >
                          {banks.map(b => (
                            <option key={b.id} value={b.id}>
                              🏦 {b.bank_name} ({b.account_name}) — Bakiye: {formatMoney(b.balance, b.currency).formatted}
                            </option>
                          ))}
                        </select>
                      )}
                      <p className="text-[10px] text-blue-400/80 mt-1.5 flex items-center gap-1">
                        <AlertCircle size={12} /> Banka hareketlerine çıkış olarak işlenecek ve hesap bakiyesi düşülecektir.
                      </p>
                    </div>
                  )}

                  {quickPaySourceType === 'cash' && (
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Ödemenin Yapılacağı Kasa *</label>
                      {cashes.length === 0 ? (
                        <div className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-lg text-rose-300 text-[11px]">
                          Kayıtlı nakit kasa bulunamadı.
                        </div>
                      ) : (
                        <select
                          required
                          value={quickPaySourceId}
                          onChange={(e) => setQuickPaySourceId(e.target.value)}
                          className="w-full bg-[#070b14] border border-emerald-500/40 rounded-lg px-3 py-2 text-white font-medium focus:outline-none focus:border-emerald-400 transition-colors"
                        >
                          {cashes.map(c => (
                            <option key={c.id} value={c.id}>
                              💵 {c.name} — Bakiye: {formatMoney(c.balance, c.currency).formatted}
                            </option>
                          ))}
                        </select>
                      )}
                      <p className="text-[10px] text-emerald-400/80 mt-1.5 flex items-center gap-1">
                        <AlertCircle size={12} /> Kasa hareketlerine çıkış olarak işlenecek ve nakit düşülecektir.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2.5 mt-5 pt-4 border-t border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setIsQuickPayModalOpen(false)} 
                  className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800 transition-colors"
                >
                  Vazgeç
                </button>
                <button 
                  type="submit" 
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2 rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-900/30 flex items-center gap-1.5"
                >
                  <Check size={16} /> Ödemeyi Tamamla ve Düş
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* --- SABİT GİDER ŞABLON EKLEME / DÜZENLEME MODALI --- */}
      {/* ========================================================================================= */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 99999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] overflow-y-auto custom-scrollbar">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <RefreshCw size={16} className="text-indigo-400" /> 
              {editingTemplateId ? 'Sabit Gider Şablonunu Düzenle' : 'Yeni Sabit Gider Şablonu Tanımla'}
            </h3>

            <form onSubmit={handleSaveTemplate} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Şablon Başlığı *</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Örn: Merkez Ofis Kirası, Superonline Fiber, Muhasebeci" 
                  value={tmplTitle} 
                  onChange={(e) => setTmplTitle(e.target.value)} 
                  className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors" 
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Ait Olduğu Merkez / Şirket *</label>
                <select 
                  value={tmplCompanyId} 
                  onChange={(e) => setTmplCompanyId(e.target.value)} 
                  required 
                  className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="">Merkez Seçin...</option>
                  <optgroup label="Ticari Şirketler">
                    {companies.filter(c => !c.is_personal).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                  <optgroup label="Şahsi / Ev Merkezleri">
                    {companies.filter(c => c.is_personal).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Kategori</label>
                  <select 
                    value={tmplCategoryId} 
                    onChange={(e) => setTmplCategoryId(e.target.value)} 
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="">Kategori Seçin...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type === 'fixed' ? 'Sabit' : 'Değişken'})</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Vade / Ödeme Günü (Ayın)</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="31" 
                    required 
                    value={tmplDueDay} 
                    onChange={(e) => setTmplDueDay(e.target.value)} 
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500 transition-colors" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] text-slate-400 mb-1">Aylık Standart Tutar</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    value={tmplAmount} 
                    onChange={(e) => setTmplAmount(e.target.value)} 
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-rose-400 font-mono font-bold focus:outline-none focus:border-indigo-500 transition-colors" 
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Para Birimi</label>
                  <select 
                    value={tmplCurrency} 
                    onChange={(e) => setTmplCurrency(e.target.value as any)} 
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="TRY">TRY (₺)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              {/* Varsayılan Ödeme Kaynağı */}
              <div className="pt-2 border-t border-slate-800">
                <label className="block text-[10px] text-slate-400 mb-1.5">Varsayılan Ödeme Kaynağı (Otomatik Seçim İçin)</label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => { setTmplSourceType('card'); setTmplSourceId(cards[0]?.id || '') }}
                    className={`py-1.5 px-2 rounded-lg border text-center transition-all ${tmplSourceType === 'card' ? 'bg-amber-950/40 border-amber-500 text-amber-300 font-bold' : 'bg-[#070b14] border-slate-800 text-slate-400'}`}
                  >
                    💳 Kredi Kartı
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTmplSourceType('bank'); setTmplSourceId(banks[0]?.id || '') }}
                    className={`py-1.5 px-2 rounded-lg border text-center transition-all ${tmplSourceType === 'bank' ? 'bg-blue-950/40 border-blue-500 text-blue-300 font-bold' : 'bg-[#070b14] border-slate-800 text-slate-400'}`}
                  >
                    🏦 Banka
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTmplSourceType('cash'); setTmplSourceId(cashes[0]?.id || '') }}
                    className={`py-1.5 px-2 rounded-lg border text-center transition-all ${tmplSourceType === 'cash' ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300 font-bold' : 'bg-[#070b14] border-slate-800 text-slate-400'}`}
                  >
                    💵 Kasa
                  </button>
                </div>

                {tmplSourceType === 'card' && (
                  <select 
                    value={tmplSourceId} 
                    onChange={(e) => setTmplSourceId(e.target.value)} 
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs"
                  >
                    <option value="">Kart Seçiniz...</option>
                    {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}

                {tmplSourceType === 'bank' && (
                  <select 
                    value={tmplSourceId} 
                    onChange={(e) => setTmplSourceId(e.target.value)} 
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs"
                  >
                    <option value="">Banka Seçiniz...</option>
                    {banks.map(b => <option key={b.id} value={b.id}>{b.bank_name} - {b.account_name}</option>)}
                  </select>
                )}

                {tmplSourceType === 'cash' && (
                  <select 
                    value={tmplSourceId} 
                    onChange={(e) => setTmplSourceId(e.target.value)} 
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs"
                  >
                    <option value="">Kasa Seçiniz...</option>
                    {cashes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Not / İban / Abone No (İsteğe Bağlı)</label>
                <input 
                  type="text" 
                  placeholder="Örn: Hizmet No: 1029384, İban son 4 hane..." 
                  value={tmplNote} 
                  onChange={(e) => setTmplNote(e.target.value)} 
                  className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500 transition-colors" 
                />
              </div>

              <div className="flex justify-end gap-2.5 mt-4 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsTemplateModalOpen(false)} className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800 transition-colors">İptal</button>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2 rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-900/30">
                  {editingTemplateId ? 'Güncelle' : 'Şablonu Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================================= */}
      {/* --- KATEGORİ EKLEME/DÜZENLEME MODALI --- */}
      {/* ========================================================================================= */}
      {isCatModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 99999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <Tags size={16} className="text-rose-500" /> 
              {editingCatId ? 'Kategoriyi Düzenle' : 'Yeni Gider Kategorisi'}
            </h3>
            <form onSubmit={handleSaveCategory} className="space-y-3.5 text-[11px]">
              <div>
                <label className="block text-slate-400 mb-1">Kategori Türü *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCatType('fixed')}
                    className={`py-2 px-3 rounded-lg border text-left flex flex-col gap-0.5 transition-all ${newCatType === 'fixed' ? 'bg-indigo-950/70 border-indigo-500 text-white' : 'bg-[#070b14] border-slate-800 text-slate-400 hover:border-slate-700'}`}
                  >
                    <span className="font-bold flex items-center gap-1 text-indigo-300"><RefreshCw size={11} /> Sabit Gider</span>
                    <span className="text-[9px] text-slate-500">Kira, aidat, fatura vb.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCatType('variable')}
                    className={`py-2 px-3 rounded-lg border text-left flex flex-col gap-0.5 transition-all ${newCatType === 'variable' ? 'bg-amber-950/70 border-amber-500 text-white' : 'bg-[#070b14] border-slate-800 text-slate-400 hover:border-slate-700'}`}
                  >
                    <span className="font-bold flex items-center gap-1 text-amber-300"><Zap size={11} /> Değişken</span>
                    <span className="text-[9px] text-slate-500">Yemek, kargo, sarf vb.</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Kategori Adı *</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Örn: Araç Bakım & Akaryakıt" 
                  value={newCatName} 
                  onChange={(e) => setNewCatName(e.target.value)} 
                  className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-rose-500 transition-colors" 
                />
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsCatModalOpen(false)} className="px-4 py-1.5 rounded-lg text-slate-400 hover:bg-slate-800 transition-colors">İptal</button>
                <button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-1.5 rounded-lg font-medium transition-all active:scale-95 shadow-lg shadow-rose-900/20">
                  {editingCatId ? 'Güncelle' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ÖZEL ONAY MODALI --- */}
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

      {/* Global CSS Animasyon Desteği */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeInDown {
          from {
            opacity: 0;
            transform: translateY(-15px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes fadeSlideRight {
          from {
            opacity: 0;
            transform: translateX(-15px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  )
}
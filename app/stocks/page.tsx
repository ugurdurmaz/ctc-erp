'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/lib/utils'
import toast, { Toaster } from 'react-hot-toast'
import { Package, Plus, Trash2, X, Edit3, Layers, Search, Building, Home, Globe, AlertTriangle, RefreshCw, Filter, Settings, Tags, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, ChevronsUpDown, Tag, ArrowUpDown, Check, Folder, FolderPlus } from 'lucide-react'

type Company = { id: string; name: string; is_personal: boolean }
type Warehouse = { id: string; name: string; color: string; company_id?: string | null; company?: { name: string; is_personal: boolean } }
type StockCategory = { id: string; name: string; warehouse_id: string }

type StockItem = {
  id: string
  warehouse_id: string
  name: string
  sku: string
  category: string
  sub_category: string
  currency: 'TRY' | 'USD' | 'EUR'
  unit: string
  quantity: number
  unit_price: number
  vat_rate: number
  stock_color: string
}

type StockTransaction = {
  id: string
  stock_id: string
  company_id?: string | null
  tx_date: string
  description: string
  tx_type: 'in' | 'out'
  quantity: number
  unit_price: number
  currency: 'TRY' | 'USD' | 'EUR'
  vat_rate: number
  company?: { name: string; is_personal: boolean }
}

type ExchangeRates = { USD: number; EUR: number }

const THEME_COLORS = [
  { label: 'Gece Mavisi', value: 'from-[#1b253b] to-[#121a2a]' },
  { label: 'Koyu Grafit', value: 'from-[#27272a] to-[#18181b]' },
  { label: 'Derin Mor', value: 'from-[#3b1f48] to-[#1a0f24]' },
  { label: 'Zümrüt Yeşili', value: 'from-[#133e30] to-[#0a221b]' },
]

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

import { logActivity } from '@/lib/audit'
import { useAuth } from '@/lib/auth-context'

export default function StocksPage() {
  const { profile, isAdmin } = useAuth()
  const [companies, setCompanies] = useState<Company[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null)
  
  const [categories, setCategories] = useState<StockCategory[]>([])
  const [subCategories, setSubCategories] = useState<{ id: string; category: string; name: string }[]>([])
  const [manageCatExpanded, setManageCatExpanded] = useState<Record<string, boolean>>({})
  const [newCatNameInput, setNewCatNameInput] = useState('')
  const [newSubCatInputs, setNewSubCatInputs] = useState<Record<string, string>>({})
  const [inlineEditingCatId, setInlineEditingCatId] = useState<string | null>(null)
  const [inlineEditingCatName, setInlineEditingCatName] = useState('')
  const [inlineEditingSubKey, setInlineEditingSubKey] = useState<string | null>(null)
  const [inlineEditingSubName, setInlineEditingSubName] = useState('')
  const [selectedFilterCategories, setSelectedFilterCategories] = useState<string[]>([])
  const [selectedFilterSubCategories, setSelectedFilterSubCategories] = useState<string[]>([])
  const [isCustomSubCat, setIsCustomSubCat] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const categoryScrollRef = useRef<HTMLDivElement>(null)
  const subCategoryScrollRef = useRef<HTMLDivElement>(null)
  const categoryRowRef = useRef<HTMLDivElement>(null)
  const subCategoryRowRef = useRef<HTMLDivElement>(null)

  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'critical' | 'out_of_stock'>('all')
  const [sortBy, setSortBy] = useState<'capacity' | 'name_asc' | 'qty_desc' | 'qty_asc' | 'price_desc' | 'price_asc'>('capacity')
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({})
  const [collapsedSubCategories, setCollapsedSubCategories] = useState<Record<string, boolean>>({})

  const [allStocks, setAllStocks] = useState<StockItem[]>([])
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<StockTransaction[]>([])
  
  const [rates, setRates] = useState<ExchangeRates>({ USD: 34.25, EUR: 37.80 })

  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false)
  const [editingWhId, setEditingWhId] = useState<string | null>(null)
  const [whName, setWhName] = useState('')
  const [whColor, setWhColor] = useState(THEME_COLORS[0].value)
  const [whCompanyId, setWhCompanyId] = useState('common')

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [isCategoryManageModalOpen, setIsCategoryManageModalOpen] = useState(false)
  const [editingStockCatId, setEditingStockCatId] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')

  const [isStockModalOpen, setIsStockModalOpen] = useState(false)
  const [editingStockId, setEditingStockId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [category, setCategory] = useState('')
  const [subCategory, setSubCategory] = useState('')
  const [currency, setCurrency] = useState<'TRY' | 'USD' | 'EUR'>('TRY')
  const [unit, setUnit] = useState('Adet')
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [vatRate, setVatRate] = useState('20')
  const [stockColor, setStockColor] = useState(THEME_COLORS[0].value)

  const [editingTxId, setEditingTxId] = useState<string | null>(null)
  const todayISO = getLocalTodayISO()
  const [txDate, setTxDate] = useState(todayISO)
  const [txCompanyId, setTxCompanyId] = useState('common')
  const [txDesc, setTxDesc] = useState('')
  const [txType, setTxType] = useState<'in' | 'out'>('in')
  const [txQty, setTxQty] = useState('')
  const [txPrice, setTxPrice] = useState('')
  const [txCurrency, setTxCurrency] = useState<'TRY' | 'USD' | 'EUR'>('TRY')
  const [txVatRate, setTxVatRate] = useState('20')

  const [quickSearchTerm, setQuickSearchTerm] = useState('')
  const [isQuickActionActive, setIsQuickActionActive] = useState(false)

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string; confirmText: string; cancelText: string; isDanger: boolean; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', confirmText: '', cancelText: '', isDanger: false, onConfirm: () => {} })

  useEffect(() => {
    fetchExchangeRates()
    fetchCompanies()
    fetchWarehouses()
    fetchAllStocks()
  }, [profile?.id, profile?.allowed_companies])

  useEffect(() => {
    if (selectedWarehouseId) {
      fetchCategories(selectedWarehouseId)
      setSelectedStockId(null)
      setSelectedFilterCategories([])
      setSelectedFilterSubCategories([])
      setSearchTerm('')

      // Depoya ait kayıtlı akordeon açık/kapalı durumlarını yükle (varsayılan: hepsi kapalı)
      try {
        const saved = localStorage.getItem('ctc_stock_accordion_state')
        if (saved) {
          const parsed = JSON.parse(saved)
          const whData = parsed?.warehouses?.[selectedWarehouseId] || (parsed?.categories ? parsed : null)
          if (whData) {
            setOpenCategories(whData.categories || {})
            setCollapsedSubCategories(whData.subCategories || {})
            return
          }
        }
      } catch (e) {
        console.error('Error loading accordion state:', e)
      }
      setOpenCategories({})
      setCollapsedSubCategories({})
    } else {
      setCategories([])
      setOpenCategories({})
      setCollapsedSubCategories({})
    }
  }, [selectedWarehouseId])

  useEffect(() => {
    if (selectedStockId) {
      fetchTransactions(selectedStockId)
      cancelEditTx()
    }
  }, [selectedStockId, allStocks])

  async function fetchExchangeRates() {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD')
      const data = await res.json()
      if (data && data.rates) {
        setRates({ USD: Number(data.rates.TRY.toFixed(4)), EUR: Number((data.rates.TRY / data.rates.EUR).toFixed(4)) })
      }
    } catch (err) { console.error(err) }
  }

  async function fetchCompanies() { 
    try {
      const { data } = await supabase.from('companies').select('*').order('name', { ascending: true })
      let comps = data || []
      if (!isAdmin && profile?.allowed_companies && profile.allowed_companies.length > 0) {
        comps = comps.filter(c => profile.allowed_companies!.includes(c.id))
      }
      setCompanies(comps) 
    } catch (err) { console.error(err) }
  }

  async function fetchWarehouses() {
    try {
      const { data, error } = await supabase.from('warehouses').select('*, company:companies(name, is_personal)').order('created_at', { ascending: true })
      if (error) throw error

      let whList = data || []
      // Yetkili şirket kısıtlaması varsa sadece o şirketin depoları gösterilir
      if (!isAdmin && profile?.allowed_companies && profile.allowed_companies.length > 0) {
        whList = whList.filter(w => !w.company_id || profile.allowed_companies!.includes(w.company_id))
      }

      setWarehouses(whList)
      if (whList && whList.length > 0 && !selectedWarehouseId) {
        let initialWhId = whList[0].id
        try {
          const savedWhId = localStorage.getItem('ctc_stock_selected_warehouse')
          if (savedWhId && whList.some(w => w.id === savedWhId)) {
            initialWhId = savedWhId
          }
        } catch (e) {
          console.error(e)
        }
        setSelectedWarehouseId(initialWhId)
      }
    } catch (err) { console.error(err) }
  }

  async function fetchAllStocks() {
    try {
      const { data, error } = await supabase.from('stocks').select('*').order('name', { ascending: true })
      if (error) throw error
      setAllStocks(data || [])
    } catch (err) { console.error(err) }
  }

  async function fetchCategories(whId: string) {
    try {
      const { data, error } = await supabase.from('stock_categories').select('*').eq('warehouse_id', whId).order('name', { ascending: true })
      if (error) throw error
      const main: StockCategory[] = []
      const subs: { id: string; category: string; name: string }[] = []
      ;(data || []).forEach(item => {
        if (item.name && item.name.startsWith('SUB::')) {
          const parts = item.name.split('::')
          if (parts.length >= 3) {
            subs.push({
              id: item.id,
              category: parts[1],
              name: parts.slice(2).join('::')
            })
          }
        } else {
          main.push(item)
        }
      })
      setCategories(main)
      setSubCategories(subs)
    } catch (err) { console.error(err) }
  }

  const warehouseStocks = allStocks.filter(s => s.warehouse_id === selectedWarehouseId)

  const getSubCategoriesForCategory = (catName: string) => {
    if (!catName) return []
    const map = new Map<string, { name: string; count: number; id?: string }>()

    // 1. Tanımlı alt kategoriler
    subCategories
      .filter(s => s.category.trim().toLowerCase() === catName.trim().toLowerCase())
      .forEach(s => {
        map.set(s.name, { name: s.name, count: 0, id: s.id })
      })

    // 2. Bu depoda mevcut ürünlerde fiilen kullanılan alt kategoriler
    warehouseStocks
      .filter(st => (st.category || '').trim().toLowerCase() === catName.trim().toLowerCase() && st.sub_category && st.sub_category.trim())
      .forEach(st => {
        const subName = st.sub_category.trim()
        const existing = map.get(subName)
        if (existing) {
          existing.count += 1
        } else {
          map.set(subName, { name: subName, count: 1 })
        }
      })

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'))
  }

  // Filtreleme için kullanılabilir alt kategoriler (kategori seçimine duyarlı)
  const availableFilterSubCategories = useMemo(() => {
    const list: { name: string; category: string; count: number }[] = []
    const targetCategories = selectedFilterCategories.length > 0 
      ? categories.filter(c => selectedFilterCategories.includes(c.name))
      : categories

    targetCategories.forEach(c => {
      const subs = getSubCategoriesForCategory(c.name)
      subs.forEach(s => {
        const existing = list.find(it => it.name === s.name)
        if (!existing) {
          list.push({ name: s.name, category: c.name, count: s.count })
        }
      })
    })

    return list.sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'))
  }, [selectedFilterCategories, categories, subCategories, warehouseStocks])

  // Kategoriler ve Alt Kategoriler barında mouse tekerleği döndürüldüğünde sayfanın aşağı-yukarı kaymasını önleyip sadece yatay kaydırma
  useEffect(() => {
    const catRow = categoryRowRef.current
    const subCatRow = subCategoryRowRef.current

    const handleWheelScroll = (targetRef: React.RefObject<HTMLDivElement | null>, e: WheelEvent) => {
      const el = targetRef.current
      if (!el) return

      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX) && e.deltaY !== 0) {
        e.preventDefault()
        e.stopPropagation()
        const delta = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY
        el.scrollLeft += delta
      }
    }

    const onCatWheel = (e: WheelEvent) => handleWheelScroll(categoryScrollRef, e)
    const onSubCatWheel = (e: WheelEvent) => handleWheelScroll(subCategoryScrollRef, e)

    if (catRow) {
      catRow.addEventListener('wheel', onCatWheel, { passive: false, capture: true })
    }
    if (subCatRow) {
      subCatRow.addEventListener('wheel', onSubCatWheel, { passive: false, capture: true })
    }

    return () => {
      if (catRow) catRow.removeEventListener('wheel', onCatWheel, { capture: true })
      if (subCatRow) subCatRow.removeEventListener('wheel', onSubCatWheel, { capture: true })
    }
  }, [categories, availableFilterSubCategories])

  async function fetchTransactions(stockId: string) {
    try {
      const { data, error } = await supabase.from('stock_transactions').select('*, company:companies(name, is_personal)').eq('stock_id', stockId).order('tx_date', { ascending: false })
      if (error) throw error
      setTransactions(data || [])
    } catch (err) { console.error(err) }
  }

  const getTryEquivalent = (amount: number, curr: string) => {
    if (curr === 'USD') return amount * rates.USD
    if (curr === 'EUR') return amount * rates.EUR
    return amount
  }
  const getUsdEquivalent = (amountTry: number) => amountTry / rates.USD

  const getWarehouseTotals = (whId: string) => {
    const whStocks = allStocks.filter(s => s.warehouse_id === whId)
    const totalTry = whStocks.reduce((acc, s) => {
      const vatRate = s.vat_rate || 0
      const priceWithVat = s.unit_price * (1 + vatRate / 100)
      return acc + getTryEquivalent(s.quantity * priceWithVat, s.currency)
    }, 0)
    const totalUsd = getUsdEquivalent(totalTry)
    return { totalTry, totalUsd }
  }

  // =========================================================================================
  // --- MUTLAK HESAPLAMA MOTORU (ABSOLUTE LEDGER RECALCULATOR) ---
  // =========================================================================================
  async function recalculateAbsoluteStock(stockId: string) {
    const { data: txs } = await supabase.from('stock_transactions').select('quantity, tx_type').eq('stock_id', stockId)
    let absoluteQty = 0
    txs?.forEach(t => { absoluteQty += t.tx_type === 'in' ? Number(t.quantity) : -Number(t.quantity) })
    await supabase.from('stocks').update({ quantity: absoluteQty }).eq('id', stockId)
  }
  // =========================================================================================

  async function handleSaveWarehouse(e: React.FormEvent) {
    e.preventDefault()
    const finalCompId = whCompanyId === 'common' ? null : whCompanyId
    const payload = { name: whName, color: whColor, company_id: finalCompId }
    try {
      if (editingWhId) {
        const oldWh = warehouses.find(w => w.id === editingWhId)
        const { error } = await supabase.from('warehouses').update(payload).eq('id', editingWhId)
        if (error) throw error
        await logActivity('warehouse', 'UPDATE', `Depo güncellendi: ${whName}`, editingWhId, 0, '', oldWh, payload, finalCompId)
        toast.success('Depo başarıyla güncellendi.')
      } else {
        const { data, error } = await supabase.from('warehouses').insert([payload]).select().single()
        if (error) throw error
        await logActivity('warehouse', 'INSERT', `Yeni depo oluşturuldu: ${whName}`, data.id, 0, '', null, data, finalCompId)
        toast.success('Yeni depo oluşturuldu.')
      }
      setIsWarehouseModalOpen(false); fetchWarehouses()
    } catch (err: any) { toast.error('İşlem başarısız: ' + err.message) }
  }

  function handleDeleteWarehouse(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setConfirmDialog({
      isOpen: true,
      title: 'Depoyu Sil',
      message: 'Bu depoyu silmek istediğinize emin misiniz? İçindeki tüm stok kartları da silinecektir.',
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        try {
          const whToDelete = warehouses.find(w => w.id === id)
          await supabase.from('warehouses').delete().eq('id', id)
          await logActivity('warehouse', 'DELETE', `Depo silindi: ${whToDelete?.name}`, id, 0, '', whToDelete, null, whToDelete?.company_id)
          toast.success('Depo başarıyla silindi.')
          if (selectedWarehouseId === id) setSelectedWarehouseId(null)
          fetchWarehouses(); fetchAllStocks()
        } catch (err: any) { toast.error('Silme başarısız: ' + err.message) }
      }
    })
  }

  async function handleCreateCategory(e?: React.FormEvent) {
    if (e) e.preventDefault()
    const trimmed = newCatNameInput.trim()
    if (!trimmed || !selectedWarehouseId) return

    if (categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Bu isimde bir kategori zaten mevcut.')
      return
    }

    try {
      const { data, error } = await supabase.from('stock_categories').insert([{ name: trimmed, warehouse_id: selectedWarehouseId }]).select().single()
      if (error) throw error
      await logActivity('stock_category', 'INSERT', `Yeni stok kategorisi eklendi: ${trimmed}`, data.id, 0, '', null, data, null)
      toast.success(`"${trimmed}" kategorisi eklendi.`)
      setNewCatNameInput('')
      fetchCategories(selectedWarehouseId)
      setManageCatExpanded(prev => ({ ...prev, [data.id]: true }))
    } catch (err: any) {
      toast.error('Kategori eklenemedi: ' + err.message)
    }
  }

  async function handleSaveInlineCategory(id: string) {
    const trimmed = inlineEditingCatName.trim()
    const oldCat = categories.find(c => c.id === id)
    if (!oldCat) return
    if (!trimmed || trimmed === oldCat.name) {
      setInlineEditingCatId(null)
      return
    }

    if (categories.some(c => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Bu isimde bir kategori zaten var.')
      return
    }

    try {
      const { error } = await supabase.from('stock_categories').update({ name: trimmed }).eq('id', id)
      if (error) throw error

      // Alt kategorilerin SUB:: prefixlerini güncelle
      const subsToUpdate = subCategories.filter(s => s.category === oldCat.name)
      for (const s of subsToUpdate) {
        await supabase.from('stock_categories').update({ name: `SUB::${trimmed}::${s.name}` }).eq('id', s.id)
      }

      // Ürünlerdeki kategori ismini güncelle
      await supabase.from('stocks').update({ category: trimmed }).eq('category', oldCat.name).eq('warehouse_id', selectedWarehouseId)

      await logActivity('stock_category', 'UPDATE', `Kategori güncellendi: ${trimmed}`, id, 0, '', oldCat, { name: trimmed }, null)
      toast.success('Kategori güncellendi.')
      setInlineEditingCatId(null)
      fetchCategories(selectedWarehouseId!)
      fetchAllStocks()
    } catch (err: any) {
      toast.error('Güncelleme başarısız: ' + err.message)
    }
  }

  function handleDeleteCategory(id: string, catName: string) {
    const catStocksCount = warehouseStocks.filter(s => s.category === catName).length
    setConfirmDialog({
      isOpen: true,
      title: 'Kategoriyi Sil',
      message: `"${catName}" kategorisini ve altındaki tüm alt kategorileri silmek istediğinize emin misiniz? ${catStocksCount > 0 ? `Bu kategoriye ait ${catStocksCount} adet ürünün kategorisi "Kategorisiz" yapılacaktır.` : ''}`,
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        try {
          const catToDelete = categories.find(c => c.id === id)
          await supabase.from('stocks').update({ category: null, sub_category: null }).eq('category', catName).eq('warehouse_id', selectedWarehouseId)
          
          const subsToDelete = subCategories.filter(s => s.category === catName)
          for (const s of subsToDelete) {
            await supabase.from('stock_categories').delete().eq('id', s.id)
          }

          await supabase.from('stock_categories').delete().eq('id', id)
          await logActivity('stock_category', 'DELETE', `Stok kategorisi silindi: ${catToDelete?.name}`, id, 0, '', catToDelete, null, null)
          
          toast.success('Kategori silindi.')
          setSelectedFilterCategories([])
          fetchCategories(selectedWarehouseId!)
          fetchAllStocks()
        } catch (err: any) { toast.error('Silme başarısız: ' + err.message) }
      }
    })
  }

  async function handleCreateSubCategory(catName: string, catId: string) {
    const subInput = (newSubCatInputs[catId] || '').trim()
    if (!subInput || !selectedWarehouseId) return

    const existingSubs = getSubCategoriesForCategory(catName)
    if (existingSubs.some(s => s.name.toLowerCase() === subInput.toLowerCase())) {
      toast.error('Bu alt kategori zaten mevcut.')
      return
    }

    try {
      const dbName = `SUB::${catName}::${subInput}`
      const { data, error } = await supabase.from('stock_categories').insert([{ name: dbName, warehouse_id: selectedWarehouseId }]).select().single()
      if (error) throw error
      await logActivity('stock_category', 'INSERT', `Yeni alt kategori eklendi: ${catName} > ${subInput}`, data.id, 0, '', null, data, null)
      toast.success(`"${subInput}" alt kategorisi eklendi.`)
      setNewSubCatInputs(prev => ({ ...prev, [catId]: '' }))
      fetchCategories(selectedWarehouseId)
    } catch (err: any) {
      toast.error('Alt kategori eklenemedi: ' + err.message)
    }
  }

  async function handleSaveInlineSubCategory(catName: string, oldSubName: string, subId?: string) {
    const trimmed = inlineEditingSubName.trim()
    if (!trimmed || trimmed === oldSubName) {
      setInlineEditingSubKey(null)
      return
    }

    try {
      if (subId) {
        await supabase.from('stock_categories').update({ name: `SUB::${catName}::${trimmed}` }).eq('id', subId)
      } else {
        await supabase.from('stock_categories').insert([{ name: `SUB::${catName}::${trimmed}`, warehouse_id: selectedWarehouseId }])
      }

      await supabase.from('stocks').update({ sub_category: trimmed }).eq('category', catName).eq('sub_category', oldSubName).eq('warehouse_id', selectedWarehouseId)

      await logActivity('stock_category', 'UPDATE', `Alt kategori güncellendi: ${catName} > ${trimmed}`, subId || null, 0, '', { name: oldSubName }, { name: trimmed }, null)
      toast.success('Alt kategori güncellendi.')
      setInlineEditingSubKey(null)
      fetchCategories(selectedWarehouseId!)
      fetchAllStocks()
    } catch (err: any) {
      toast.error('Güncelleme başarısız: ' + err.message)
    }
  }

  function handleDeleteSubCategory(catName: string, subName: string, subId?: string, count: number = 0) {
    setConfirmDialog({
      isOpen: true,
      title: 'Alt Kategoriyi Sil',
      message: `"${subName}" alt kategorisini silmek istediğinize emin misiniz? ${count > 0 ? `Bu alt kategoriye ait ${count} adet ürünün alt kategorisi kaldırılacaktır.` : ''}`,
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        try {
          if (subId) {
            await supabase.from('stock_categories').delete().eq('id', subId)
          }
          await supabase.from('stock_categories').delete().eq('name', `SUB::${catName}::${subName}`).eq('warehouse_id', selectedWarehouseId)

          await supabase.from('stocks').update({ sub_category: null }).eq('category', catName).eq('sub_category', subName).eq('warehouse_id', selectedWarehouseId)

          await logActivity('stock_category', 'DELETE', `Alt kategori silindi: ${catName} > ${subName}`, subId || null, 0, '', { name: subName }, null, null)
          toast.success('Alt kategori silindi.')
          fetchCategories(selectedWarehouseId!)
          fetchAllStocks()
        } catch (err: any) {
          toast.error('Silme başarısız: ' + err.message)
        }
      }
    })
  }

  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCategoryName || !selectedWarehouseId) return
    try {
      if (editingStockCatId) {
        const oldCat = categories.find(c => c.id === editingStockCatId)
        const { error } = await supabase.from('stock_categories').update({ name: newCategoryName }).eq('id', editingStockCatId)
        if (error) throw error
        
        if (oldCat && oldCat.name !== newCategoryName) {
          await supabase.from('stocks').update({ category: newCategoryName }).eq('category', oldCat.name).eq('warehouse_id', selectedWarehouseId)
        }

        await logActivity('stock_category', 'UPDATE', `Kategori güncellendi: ${newCategoryName}`, editingStockCatId, 0, '', oldCat, { name: newCategoryName }, null)
        toast.success('Kategori güncellendi.')
      } else {
        const { data, error } = await supabase.from('stock_categories').insert([{ name: newCategoryName, warehouse_id: selectedWarehouseId }]).select().single()
        if (error) throw error
        await logActivity('stock_category', 'INSERT', `Yeni stok kategorisi eklendi: ${newCategoryName}`, data.id, 0, '', null, data, null)
        toast.success('Yeni kategori eklendi.')
      }
      setCategory(newCategoryName)
      setIsCategoryModalOpen(false)
      setNewCategoryName('')
      setEditingStockCatId(null)
      setSelectedFilterCategories([]) 
      fetchCategories(selectedWarehouseId)
      fetchAllStocks()
    } catch (err: any) { toast.error('Kategori işlemi başarısız: ' + err.message) }
  }

  async function handleSaveStock(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !selectedWarehouseId) return
    const qtyNum = parseFloat(quantity) || 0
    const priceNum = parseFloat(unitPrice) || 0
    const vatNum = parseFloat(vatRate) || 0

    try {
      if (editingStockId) {
        const payload = { warehouse_id: selectedWarehouseId, name, sku: sku || null, category: category || null, sub_category: subCategory || null, currency, unit, unit_price: priceNum, vat_rate: vatNum, stock_color: stockColor }
        const oldStock = allStocks.find(s => s.id === editingStockId)
        
        const { error } = await supabase.from('stocks').update(payload).eq('id', editingStockId)
        if (error) throw error

        // Açılış Stoğu hareketini kontrol et ve senkronize et
        const { data: oldTxs } = await supabase
          .from('stock_transactions')
          .select('*')
          .eq('stock_id', editingStockId)
          .eq('description', 'Açılış Stoğu')
          .limit(1)

        const oldTx = oldTxs && oldTxs.length > 0 ? oldTxs[0] : null

        if (oldTx) {
          if (qtyNum === 0) {
            await supabase.from('stock_transactions').delete().eq('id', oldTx.id)
            await logActivity('stock_tx', 'DELETE', `Açılış Stoğu Silindi: ${name}`, oldTx.id, oldTx.unit_price, currency, oldTx, null, null)
          } else {
            const updatePayload = {
              quantity: qtyNum,
              unit_price: priceNum,
              currency,
              vat_rate: vatNum
            }
            await supabase.from('stock_transactions').update(updatePayload).eq('id', oldTx.id)
            await logActivity('stock_tx', 'UPDATE', `Açılış Stoğu Güncellendi: ${name} (${qtyNum} ${unit})`, oldTx.id, priceNum, currency, oldTx, updatePayload, null)
          }
        } else if (qtyNum > 0) {
          const txPayload = {
            stock_id: editingStockId,
            tx_date: todayISO,
            description: 'Açılış Stoğu',
            tx_type: 'in',
            quantity: qtyNum,
            unit_price: priceNum,
            currency,
            vat_rate: vatNum,
            company_id: null
          }
          const { data: txData, error: txError } = await supabase.from('stock_transactions').insert([txPayload]).select().single()
          if (!txError && txData) {
            await logActivity('stock_tx', 'INSERT', `Açılış Stoğu: ${name} (${qtyNum} ${unit})`, txData.id, priceNum, currency, null, txData, null)
          }
        }

        await recalculateAbsoluteStock(editingStockId)
        if (selectedStockId === editingStockId) {
          fetchTransactions(editingStockId)
        }
        
        await logActivity('stock', 'UPDATE', `Stok kartı güncellendi: ${name}`, editingStockId, priceNum, currency, oldStock, payload, null)
        toast.success('Stok kartı ve açılış stoğu güncellendi.')
      } else {
        const payload = { warehouse_id: selectedWarehouseId, name, sku: sku || null, category: category || null, sub_category: subCategory || null, currency, unit, quantity: 0, unit_price: priceNum, vat_rate: vatNum, stock_color: stockColor }
        const { data, error } = await supabase.from('stocks').insert([payload]).select().single()
        if (error) throw error
        await logActivity('stock', 'INSERT', `Yeni stok kartı oluşturuldu: ${name}`, data.id, priceNum, currency, null, data, null)

        if (data && qtyNum > 0) {
          const txPayload = { stock_id: data.id, tx_date: todayISO, description: 'Açılış Stoğu', tx_type: 'in', quantity: qtyNum, unit_price: priceNum, currency, vat_rate: vatNum, company_id: null }
          const { data: txData, error: txError } = await supabase.from('stock_transactions').insert([txPayload]).select().single()
          if (!txError && txData) {
             await logActivity('stock_tx', 'INSERT', `Açılış Stoğu: ${name}`, txData.id, priceNum, currency, null, txData, null)
          }
        }
        
        await recalculateAbsoluteStock(data.id)
        toast.success('Yeni stok kartı oluşturuldu.')
      }
      setIsStockModalOpen(false); fetchAllStocks()
    } catch (err: any) { toast.error('İşlem başarısız: ' + err.message) }
  }

  function handleDeleteStock(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setConfirmDialog({
      isOpen: true,
      title: 'Stok Kartını Sil',
      message: 'Bu stok kartını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        try {
          const stockToDelete = allStocks.find(s => s.id === id)
          await supabase.from('stocks').delete().eq('id', id)
          await logActivity('stock', 'DELETE', `Stok kartı silindi: ${stockToDelete?.name}`, id, stockToDelete?.unit_price, stockToDelete?.currency || 'TRY', stockToDelete, null, null)
          toast.success('Stok kartı başarıyla silindi.')
          if (selectedStockId === id) setSelectedStockId(null)
          fetchAllStocks()
        } catch (err: any) { toast.error('Silme başarısız: ' + err.message) }
      }
    })
  }

  function cancelEditTx() {
    setEditingTxId(null)
    setTxDesc('')
    setTxQty('')
    setTxPrice('')
    setTxDate(getLocalTodayISO())
    setTxCompanyId('common')
    setQuickSearchTerm('')
    setIsQuickActionActive(false)
    const s = allStocks.find(x => x.id === selectedStockId)
    if (s) {
      setTxCurrency(s.currency || 'TRY')
      setTxVatRate(s.vat_rate?.toString() || '20')
    }
  }

  function handleEditTx(t: StockTransaction) {
    setEditingTxId(t.id)
    setTxDate(t.tx_date)
    setTxType(t.tx_type)
    setTxDesc(t.description)
    setTxQty(t.quantity.toString())
    setTxPrice(t.unit_price.toString())
    setTxCurrency(t.currency || 'TRY')
    setTxVatRate(t.vat_rate?.toString() || '0')
    setTxCompanyId(t.company_id || 'common')
  }

  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault()
    const qtyNum = parseFloat(txQty); const priceNum = parseFloat(txPrice); const vatNum = parseFloat(txVatRate);
    const currentItem = allStocks.find(s => s.id === selectedStockId)
    if (!currentItem || !selectedStockId) return
    const finalCompId = txCompanyId === 'common' ? null : txCompanyId

    const payload = {
      company_id: finalCompId, tx_date: txDate || todayISO, description: txDesc, 
      tx_type: txType, quantity: qtyNum, unit_price: priceNum, currency: txCurrency, vat_rate: vatNum
    }

    try {
      if (editingTxId) {
        const oldTx = transactions.find(t => t.id === editingTxId)
        if (!oldTx) return
        
        const { error: updErr } = await supabase.from('stock_transactions').update(payload).eq('id', editingTxId)
        if (updErr) throw updErr
        
        await logActivity('stock_tx', 'UPDATE', `Stok hareketi güncellendi: ${txDesc}`, editingTxId, priceNum, txCurrency, oldTx, payload, finalCompId)
        toast.success('İşlem güncellendi.')
      } else {
        const { data: newTx, error: insErr } = await supabase.from('stock_transactions').insert([{ stock_id: selectedStockId, ...payload }]).select().single()
        if (insErr) throw insErr
        
        await logActivity('stock_tx', 'INSERT', `Stok ${txType === 'in' ? 'Girişi' : 'Çıkışı'}: ${txDesc}`, newTx.id, priceNum, txCurrency, null, newTx, finalCompId)
        toast.success(txType === 'in' ? 'Stok girişi eklendi.' : 'Stok çıkışı yapıldı.')
      }
      
      await recalculateAbsoluteStock(selectedStockId)

      if (txType === 'in') {
        let basePrice = priceNum
        if (txCurrency !== currentItem.currency) {
          let tryValue = priceNum
          if (txCurrency === 'USD') tryValue = priceNum * rates.USD
          if (txCurrency === 'EUR') tryValue = priceNum * rates.EUR
          if (currentItem.currency === 'USD') basePrice = tryValue / rates.USD
          else if (currentItem.currency === 'EUR') basePrice = tryValue / rates.EUR
          else basePrice = tryValue
        }
        await supabase.from('stocks').update({ unit_price: basePrice }).eq('id', selectedStockId)
      }

      cancelEditTx()
      fetchTransactions(selectedStockId); fetchAllStocks()
    } catch (err: any) { toast.error('İşlem kaydedilemedi: ' + err.message) }
  }

  function handleDeleteTransaction(txId: string, qty: number, type: 'in' | 'out') {
    setConfirmDialog({
      isOpen: true,
      title: 'İşlemi Sil',
      message: 'Bu stok hareketini silmek istediğinize emin misiniz? İşlem miktarı stoka iade edilecektir.',
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        try {
          const oldTx = transactions.find(t => t.id === txId)
          await supabase.from('stock_transactions').delete().eq('id', txId)
          
          if (selectedStockId) {
             await recalculateAbsoluteStock(selectedStockId)
          }
          
          await logActivity('stock_tx', 'DELETE', `Stok hareketi iptal edildi: ${oldTx?.description}`, txId, oldTx?.unit_price, oldTx?.currency || '', { ...oldTx }, null, oldTx?.company_id)

          toast.success('İşlem silindi ve stok güncellendi.')
          fetchTransactions(selectedStockId!); fetchAllStocks()
        } catch (err: any) { toast.error('Silme başarısız: ' + err.message) }
      }
    })
  }

  function openAddWh() { setEditingWhId(null); setWhName(''); setWhColor(THEME_COLORS[0].value); setWhCompanyId('common'); setIsWarehouseModalOpen(true) }
  
  function openEditWh(wh: Warehouse, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingWhId(wh.id); setWhName(wh.name); setWhColor(wh.color); setWhCompanyId(wh.company_id || 'common'); setIsWarehouseModalOpen(true)
  }

  function openAddStock() {
    if (!selectedWarehouseId) { toast.error('Lütfen önce bir depo seçin.'); return }
    setEditingStockId(null); setName(''); setSku(''); setCategory(''); setSubCategory(''); setIsCustomSubCat(false); setQuantity(''); setUnitPrice(''); setVatRate('20'); setIsStockModalOpen(true)
  }
  
  async function openEditStock(item: StockItem, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingStockId(item.id)
    if (item.warehouse_id) setSelectedWarehouseId(item.warehouse_id)
    setName(item.name)
    setSku(item.sku || '')
    setCategory(item.category || '')
    setSubCategory(item.sub_category || '')
    setIsCustomSubCat(false)
    setCurrency(item.currency || 'TRY')
    setUnit(item.unit || 'Adet')
    setUnitPrice(item.unit_price.toString())
    setVatRate(item.vat_rate?.toString() || '0')
    setStockColor(item.stock_color || THEME_COLORS[0].value)

    const { data: openTxs } = await supabase
      .from('stock_transactions')
      .select('quantity')
      .eq('stock_id', item.id)
      .eq('description', 'Açılış Stoğu')
      .limit(1)

    if (openTxs && openTxs.length > 0) {
      setQuantity(openTxs[0].quantity.toString())
    } else {
      setQuantity('0')
    }
    setIsStockModalOpen(true)
  }

  // Doğal kapasite algılama (TB, GB, MB, KB)
  function parseCapacity(name: string): number | null {
    const match = name.match(/(\d+(?:[.,]\d+)?)\s*(tb|gb|mb|kb)/i);
    if (!match) return null;
    const num = parseFloat(match[1].replace(',', '.'));
    const unit = match[2].toLowerCase();
    if (unit === 'tb') return num * 1024 * 1024;
    if (unit === 'gb') return num * 1024;
    if (unit === 'mb') return num;
    if (unit === 'kb') return num / 1024;
    return null;
  }

  function sortStockItems(items: StockItem[], sortOption: typeof sortBy): StockItem[] {
    return [...items].sort((a, b) => {
      // Tükenen ürünleri en alta alma kuralı (stok miktarına göre sıralama hariç)
      if (sortOption !== 'qty_asc' && sortOption !== 'qty_desc') {
        if (a.quantity > 0 && b.quantity <= 0) return -1;
        if (a.quantity <= 0 && b.quantity > 0) return 1;
      }
      if (sortOption === 'capacity') {
        const capA = parseCapacity(a.name);
        const capB = parseCapacity(b.name);
        if (capA !== null && capB !== null && capA !== capB) return capA - capB;
        return a.name.localeCompare(b.name, 'tr-TR', { numeric: true, sensitivity: 'base' });
      }
      if (sortOption === 'name_asc') {
        return a.name.localeCompare(b.name, 'tr-TR', { numeric: true, sensitivity: 'base' });
      }
      if (sortOption === 'qty_desc') {
        return b.quantity - a.quantity;
      }
      if (sortOption === 'qty_asc') {
        return a.quantity - b.quantity;
      }
      if (sortOption === 'price_desc') {
        return b.unit_price - a.unit_price;
      }
      if (sortOption === 'price_asc') {
        return a.unit_price - b.unit_price;
      }
      return 0;
    });
  }

  const statusFilteredStocks = warehouseStocks.filter(s => {
    if (statusFilter === 'in_stock') return s.quantity > 0;
    if (statusFilter === 'critical') return s.quantity > 0 && s.quantity <= 2;
    if (statusFilter === 'out_of_stock') return s.quantity <= 0;
    return true;
  });

  const filteredStocks = statusFilteredStocks.filter(s => {
    const catMatch = selectedFilterCategories.length === 0 || selectedFilterCategories.includes(s.category || 'Kategorisiz')
    const subCatMatch = selectedFilterSubCategories.length === 0 || selectedFilterSubCategories.includes(s.sub_category || '')
    const searchStr = searchTerm.toLowerCase().trim()
    const searchMatch = !searchStr || 
      s.name.toLowerCase().includes(searchStr) || 
      (s.sku && s.sku.toLowerCase().includes(searchStr)) ||
      (s.sub_category && s.sub_category.toLowerCase().includes(searchStr))
    return catMatch && subCatMatch && searchMatch
  })

  const quickSearchStocks = warehouseStocks.filter(s => 
    quickSearchTerm.length > 1 && 
    (s.name.toLowerCase().includes(quickSearchTerm.toLowerCase()) || (s.sku && s.sku.toLowerCase().includes(quickSearchTerm.toLowerCase())))
  )

  type SubGroup = { name: string; items: StockItem[] }
  type CatGroup = { name: string; totalCount: number; totalQuantity: number; subGroups: SubGroup[] }

  const groupedHierarchy: CatGroup[] = useMemo(() => {
    const catMap = new Map<string, Map<string, StockItem[]>>();

    filteredStocks.forEach(item => {
      const cat = (item.category || 'Kategorisiz').trim();
      const subCat = (item.sub_category || '').trim();

      if (!catMap.has(cat)) catMap.set(cat, new Map());
      const subMap = catMap.get(cat)!;
      const subKey = subCat || '__NONE__';
      if (!subMap.has(subKey)) subMap.set(subKey, []);
      subMap.get(subKey)!.push(item);
    });

    const result: CatGroup[] = [];

    catMap.forEach((subMap, catName) => {
      let catTotalCount = 0;
      let catTotalQty = 0;
      const subGroups: SubGroup[] = [];

      subMap.forEach((items, subKey) => {
        const sorted = sortStockItems(items, sortBy);
        catTotalCount += items.length;
        catTotalQty += items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
        subGroups.push({
          name: subKey === '__NONE__' ? (subMap.size > 1 ? 'Diğer / Genel' : '') : subKey,
          items: sorted
        });
      });

      subGroups.sort((a, b) => {
        if (!a.name || a.name.includes('Diğer')) return 1;
        if (!b.name || b.name.includes('Diğer')) return -1;
        return a.name.localeCompare(b.name, 'tr-TR');
      });

      result.push({
        name: catName,
        totalCount: catTotalCount,
        totalQuantity: catTotalQty,
        subGroups
      });
    });

    result.sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'));
    return result;
  }, [filteredStocks, sortBy]);

  const saveAccordionState = (
    whId: string | null,
    cats: Record<string, boolean>,
    subs: Record<string, boolean>
  ) => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('ctc_stock_accordion_state');
      const parsed = saved ? JSON.parse(saved) : {};
      const warehouses = parsed.warehouses || {};
      if (whId) {
        warehouses[whId] = {
          categories: cats,
          subCategories: subs
        };
      }
      const updated = {
        ...parsed,
        warehouses,
        categories: cats,
        subCategories: subs
      };
      localStorage.setItem('ctc_stock_accordion_state', JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving accordion state to localStorage:', e);
    }
  };

  const toggleCategory = (catName: string) => {
    setOpenCategories(prev => {
      const currentState = searchTerm.trim().length > 0
        ? (prev[catName] !== undefined ? prev[catName] : true)
        : !!prev[catName];
      const next = { ...prev, [catName]: !currentState };
      saveAccordionState(selectedWarehouseId, next, collapsedSubCategories);
      return next;
    });
  };

  const toggleSubCategory = (subKey: string) => {
    setCollapsedSubCategories(prev => {
      const next = { ...prev, [subKey]: !prev[subKey] };
      saveAccordionState(selectedWarehouseId, openCategories, next);
      return next;
    });
  };

  const isAllOpen = groupedHierarchy.length > 0 && groupedHierarchy.every(g => !!openCategories[g.name]);

  const toggleAll = () => {
    if (isAllOpen) {
      setOpenCategories({});
      setCollapsedSubCategories({});
      saveAccordionState(selectedWarehouseId, {}, {});
    } else {
      const allOpen: Record<string, boolean> = {};
      groupedHierarchy.forEach(g => { allOpen[g.name] = true; });
      setOpenCategories(allOpen);
      saveAccordionState(selectedWarehouseId, allOpen, collapsedSubCategories);
    }
  };

  const selectedStock = allStocks.find(s => s.id === selectedStockId)
  const activeWarehouse = warehouses.find(w => w.id === selectedWarehouseId)

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] relative">
      {/* TOASTER KONTEYNER Z-INDEX DEĞERİ MAX VE POZİSYONU BOTTOM-RIGHT YAPILDI */}
      <Toaster position="bottom-right" containerStyle={{ zIndex: 99999999 }} toastOptions={{ style: { background: '#0f172a', color: '#fff', border: '1px solid #1e293b', fontSize: '12px' } }} />
      
      {/* Üst Bar */}
      <div style={{ animation: 'fadeInDown 0.4s both' }} className="flex items-center justify-between gap-4 bg-[#0d1322] border border-slate-800/80 p-3 rounded-xl shadow-md shrink-0 mb-4 transition-colors">
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar flex-1">
          <Package className="text-indigo-400 mr-2 shrink-0" size={20} />
          {warehouses.map((wh, index) => {
            const totals = getWarehouseTotals(wh.id)
            const isSelected = selectedWarehouseId === wh.id
            return (
              <div 
                key={wh.id} 
                onClick={() => {
                  setSelectedWarehouseId(wh.id);
                  try { localStorage.setItem('ctc_stock_selected_warehouse', wh.id); } catch {}
                }} 
                style={{ animation: 'fadeInUp 0.3s both', animationDelay: `${0.1 + (index * 0.05)}s` }}
                className={`flex flex-col px-3 py-1.5 rounded-lg cursor-pointer transition-all border whitespace-nowrap bg-gradient-to-r group ${wh.color} ${isSelected ? 'border-indigo-400 ring-1 ring-indigo-400/50 shadow-inner -translate-y-0.5' : 'border-slate-800/80 opacity-60 hover:opacity-100 hover:-translate-y-0.5'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-white">{wh.name}</span>
                  {isSelected && (
                    <div className="flex items-center gap-1 bg-black/30 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => openEditWh(wh, e)} className="text-slate-300 hover:text-indigo-400"><Edit3 size={10} /></button>
                      <button onClick={(e) => handleDeleteWarehouse(wh.id, e)} className="text-slate-300 hover:text-rose-400"><Trash2 size={10} /></button>
                    </div>
                  )}
                </div>
                <div className="flex flex-col mt-1">
                  <span className="text-xs font-mono font-semibold text-slate-200 opacity-90 tracking-tight">
                    {formatMoney(totals.totalUsd, 'USD').formatted} / {formatMoney(totals.totalTry, 'TRY').formatted}
                  </span>
                  <span className="text-[8px] text-slate-300/70 font-sans uppercase tracking-wider mt-0.5">KDV Dahil Değer</span>
                </div>
              </div>
            )
          })}
          <button style={{ animation: 'fadeInUp 0.3s both 0.3s' }} onClick={openAddWh} className="p-2 rounded-lg border border-dashed border-slate-700 text-slate-400 hover:text-white hover:border-slate-500 hover:bg-slate-800/50 shrink-0 transition-all active:scale-95"><Plus size={16} /></button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* SOL SÜTUN */}
        <div style={{ animation: 'fadeInUp 0.4s both 0.1s' }} className="w-full lg:w-[480px] xl:w-[560px] 2xl:w-[620px] bg-[#0d1322] border border-slate-800/80 rounded-xl flex flex-col shrink-0 shadow-lg">
          <div className="p-3 border-b border-slate-800/80 bg-[#0a0f1d] rounded-t-xl flex flex-col gap-3 shrink-0">
            <div className="flex justify-between items-start">
              <div>
                 <span className="text-xs font-bold text-slate-300">Stok Kartları</span>
                 <div className="text-[9px] text-slate-500 mt-1 flex items-center gap-1">
                    {activeWarehouse?.company ? (activeWarehouse.company.is_personal ? <Home size={10} className="text-slate-400"/> : <Building size={10} className="text-indigo-400"/>) : <Globe size={10} className="text-emerald-500/70"/>}
                    Sahiplik: {activeWarehouse?.company ? activeWarehouse.company.name : 'Ortak / Bağımsız Depo'}
                 </div>
              </div>
              <button onClick={openAddStock} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95"><Plus size={14} /> Ürün Ekle</button>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" placeholder="Stoklarda ürün, alt kategori veya SKU ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors" />
            </div>

            {/* Durum & Sıralama Kontrolleri */}
            <div className="flex items-center justify-between gap-1 pt-0.5 text-[10px]">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                <button 
                  type="button"
                  onClick={() => setStatusFilter('all')} 
                  className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition-colors border select-none cursor-pointer ${statusFilter === 'all' ? 'bg-indigo-600 border-indigo-500 text-white font-bold' : 'bg-slate-800/50 hover:bg-slate-700/50 border-slate-700 text-slate-400'}`}
                >
                  Tümü ({warehouseStocks.length})
                </button>
                <button 
                  type="button"
                  onClick={() => setStatusFilter('in_stock')} 
                  className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition-colors border select-none cursor-pointer ${statusFilter === 'in_stock' ? 'bg-emerald-600 border-emerald-500 text-white font-bold' : 'bg-slate-800/50 hover:bg-slate-700/50 border-slate-700 text-emerald-400/80 hover:text-emerald-300'}`}
                >
                  Stokta ({warehouseStocks.filter(s => s.quantity > 0).length})
                </button>
                <button 
                  type="button"
                  onClick={() => setStatusFilter('critical')} 
                  className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition-colors border select-none cursor-pointer ${statusFilter === 'critical' ? 'bg-amber-600 border-amber-500 text-white font-bold' : 'bg-slate-800/50 hover:bg-slate-700/50 border-slate-700 text-amber-400/80 hover:text-amber-300'}`}
                >
                  Kritik ({warehouseStocks.filter(s => s.quantity > 0 && s.quantity <= 2).length})
                </button>
                <button 
                  type="button"
                  onClick={() => setStatusFilter('out_of_stock')} 
                  className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition-colors border select-none cursor-pointer ${statusFilter === 'out_of_stock' ? 'bg-rose-600 border-rose-500 text-white font-bold' : 'bg-slate-800/50 hover:bg-slate-700/50 border-slate-700 text-rose-400/80 hover:text-rose-300'}`}
                >
                  Tükenen ({warehouseStocks.filter(s => s.quantity <= 0).length})
                </button>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-[#070b14] border border-slate-700 text-indigo-300 text-[10px] rounded px-1.5 py-0.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  title="Sıralama Ölçütü"
                >
                  <option value="capacity">⚡ Boyut / Kapasite</option>
                  <option value="name_asc">🔤 İsim (A-Z)</option>
                  <option value="qty_desc">📦 Stok (Çoktan Aza)</option>
                  <option value="qty_asc">⚠️ Stok (Azdan Çoğa)</option>
                  <option value="price_desc">💰 Fiyat (Pahalı-Ucuz)</option>
                  <option value="price_asc">🏷️ Fiyat (Ucuz-Pahalı)</option>
                </select>

                <button
                  type="button"
                  onClick={toggleAll}
                  className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-indigo-300 transition-colors cursor-pointer"
                  title={isAllOpen ? "Tümünü Daralt" : "Tümünü Genişlet"}
                >
                  <ChevronsUpDown size={13} />
                </button>
              </div>
            </div>
          </div>

          {categories.length > 0 && (
            <div className="px-2 py-1.5 border-b border-slate-800/50 bg-[#070b14] flex flex-col gap-1.5 shrink-0">
              {/* KATEGORİLER SATIRI */}
              <div ref={categoryRowRef} className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 min-w-0 flex-1">
                  <Filter size={12} className="text-slate-500 shrink-0 ml-0.5 mr-0.5" />
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">Kat:</span>
                  <div 
                    ref={categoryScrollRef}
                    className="flex items-center gap-1.5 overflow-x-auto no-scrollbar overscroll-contain flex-1 py-0.5"
                  >
                    {categories.map(c => {
                      const isActive = selectedFilterCategories.includes(c.name)
                      return (
                        <button 
                          key={c.id} 
                          onClick={() => setSelectedFilterCategories(p => p.includes(c.name) ? p.filter(n => n !== c.name) : [...p, c.name])} 
                          className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition-colors border select-none shrink-0 cursor-pointer ${isActive ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm shadow-indigo-600/30 font-bold' : 'bg-slate-800/50 hover:bg-slate-700/50 border-slate-700 text-slate-400 hover:text-slate-200'}`}
                        >
                          {c.name}
                        </button>
                      )
                    })}
                    {selectedFilterCategories.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedFilterCategories([])}
                        className="text-[9px] text-slate-500 hover:text-rose-400 px-1 py-0.5 rounded transition-colors whitespace-nowrap"
                        title="Kategori filtrelerini temizle"
                      >
                        Temizle
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-0.5 shrink-0 pl-1 border-l border-slate-800/80">
                  <button 
                    type="button" 
                    onClick={() => categoryScrollRef.current?.scrollBy({ left: -100, behavior: 'smooth' })} 
                    className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800/80 rounded transition-colors cursor-pointer" 
                    title="Sola kaydır"
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <button 
                    type="button" 
                    onClick={() => categoryScrollRef.current?.scrollBy({ left: 100, behavior: 'smooth' })} 
                    className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800/80 rounded transition-colors cursor-pointer" 
                    title="Sağa kaydır"
                  >
                    <ChevronRight size={12} />
                  </button>
                  <button 
                    onClick={() => setIsCategoryManageModalOpen(true)} 
                    className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-1 rounded transition-colors shrink-0 ml-1 cursor-pointer"
                  >
                    <Settings size={12} /> Yönet
                  </button>
                </div>
              </div>

              {/* ALT KATEGORİLER SATIRI (Kategoriler gibi seçilebilir!) */}
              {availableFilterSubCategories.length > 0 && (
                <div ref={subCategoryRowRef} className="flex items-center justify-between gap-1 pt-1 border-t border-slate-800/40">
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    <Tag size={11} className="text-teal-500/80 shrink-0 ml-0.5 mr-0.5" />
                    <span className="text-[9px] font-bold text-teal-400/80 uppercase tracking-wider shrink-0 mr-1">Alt Kat:</span>
                    <div 
                      ref={subCategoryScrollRef}
                      className="flex items-center gap-1.5 overflow-x-auto no-scrollbar overscroll-contain flex-1 py-0.5"
                    >
                      {availableFilterSubCategories.map(sub => {
                        const isActive = selectedFilterSubCategories.includes(sub.name)
                        return (
                          <button 
                            key={sub.name} 
                            onClick={() => setSelectedFilterSubCategories(p => p.includes(sub.name) ? p.filter(n => n !== sub.name) : [...p, sub.name])} 
                            className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition-colors border select-none shrink-0 cursor-pointer ${isActive ? 'bg-teal-600 border-teal-500 text-white shadow-sm shadow-teal-600/30 font-bold' : 'bg-slate-800/40 hover:bg-slate-700/40 border-slate-700/80 text-teal-400/80 hover:text-teal-200'}`}
                            title={`${sub.category} > ${sub.name}`}
                          >
                            {sub.name} {sub.count > 0 ? `(${sub.count})` : ''}
                          </button>
                        )
                      })}
                      {selectedFilterSubCategories.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedFilterSubCategories([])}
                          className="text-[9px] text-slate-500 hover:text-rose-400 px-1 py-0.5 rounded transition-colors whitespace-nowrap"
                          title="Alt kategori filtrelerini temizle"
                        >
                          Temizle
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0 pl-1 border-l border-slate-800/80">
                    <button 
                      type="button" 
                      onClick={() => subCategoryScrollRef.current?.scrollBy({ left: -100, behavior: 'smooth' })} 
                      className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800/80 rounded transition-colors cursor-pointer" 
                      title="Alt kategorileri sola kaydır"
                    >
                      <ChevronLeft size={11} />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => subCategoryScrollRef.current?.scrollBy({ left: 100, behavior: 'smooth' })} 
                      className="p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800/80 rounded transition-colors cursor-pointer" 
                      title="Alt kategorileri sağa kaydır"
                    >
                      <ChevronRight size={11} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="overflow-y-auto flex-1 custom-scrollbar">
            {groupedHierarchy.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-700/60 rounded-xl bg-slate-800/10 text-slate-500 shadow-inner mt-4 mx-2">
                <Package size={32} className="mb-3 opacity-70 text-indigo-400 animate-bounce" />
                <p className="text-[11px] font-bold text-slate-400">Kriterlere uygun ürün yok</p>
                <p className="text-[9px] mt-1 text-slate-500">Lütfen arama kelimenizi veya filtrelerinizi değiştirin.</p>
              </div>
            ) : (
              groupedHierarchy.map((catGroup) => {
                const isSearchActive = searchTerm.trim().length > 0;
                const isCatOpen = isSearchActive 
                  ? true 
                  : (selectedFilterCategories.length > 0 || selectedFilterSubCategories.length > 0)
                    ? (
                        selectedFilterCategories.includes(catGroup.name) || 
                        catGroup.subGroups.some(sg => selectedFilterSubCategories.includes(sg.name))
                          ? (openCategories[catGroup.name] !== false)
                          : false
                      )
                    : !!openCategories[catGroup.name];

                return (
                  <div key={catGroup.name} className="border-b border-slate-800/80 last:border-b-0">
                    {/* KATEGORİ BAŞLIĞI (Akordeon) */}
                    <div 
                      onClick={() => toggleCategory(catGroup.name)}
                      className="sticky top-0 bg-[#0a0f1d]/95 backdrop-blur-md px-3 py-2 border-b border-slate-800/80 z-10 flex items-center justify-between cursor-pointer hover:bg-slate-800/60 transition-colors select-none group"
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="text-slate-500 group-hover:text-indigo-400 transition-transform">
                          {isCatOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </span>
                        <Layers size={13} className="text-indigo-400 shrink-0" />
                        <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wide truncate">
                          {catGroup.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono">
                        <span className="px-1.5 py-0.2 rounded bg-indigo-950/80 border border-indigo-500/30 text-indigo-300">
                          {catGroup.totalCount} ürün
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-800/90 text-emerald-400 font-medium border border-slate-700">
                          {catGroup.totalQuantity} ad.
                        </span>
                      </div>
                    </div>

                    {/* KATEGORİ İÇERİĞİ */}
                    {isCatOpen && (
                      <div className="bg-[#070b14]/50">
                        {catGroup.subGroups.map((subGroup) => {
                          const subKey = `${catGroup.name}__${subGroup.name}`;
                          const isSubFiltered = selectedFilterSubCategories.includes(subGroup.name);
                          const isSubCollapsed = isSubFiltered ? false : !!collapsedSubCategories[subKey];
                          const hasSubHeader = !!subGroup.name;

                          return (
                            <div key={subKey} className="border-b border-slate-800/40 last:border-b-0">
                              {/* ALT KATEGORİ BAŞLIĞI (Eğer tanımlıysa) */}
                              {hasSubHeader && (
                                <div 
                                  onClick={() => toggleSubCategory(subKey)}
                                  className="bg-[#080d19] px-3 py-1.5 border-b border-slate-800/30 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition-colors select-none group/sub"
                                >
                                  <div className="flex items-center gap-1.5 pl-3 min-w-0 pr-2">
                                    <span className="text-slate-500 group-hover/sub:text-teal-400 transition-transform">
                                      {isSubCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                                    </span>
                                    <Tag size={11} className="text-teal-400/80 shrink-0" />
                                    <span className="text-[10px] font-semibold text-teal-300 truncate">
                                      {subGroup.name}
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-slate-400 font-mono pr-1">
                                    {subGroup.items.length} ürün
                                  </span>
                                </div>
                              )}

                              {/* ÜRÜN LİSTESİ */}
                              {!isSubCollapsed && (
                                <div className="divide-y divide-slate-800/40">
                                  {subGroup.items.map((item, idx) => {
                                    const isSelected = item.id === selectedStockId
                                    const unitTry = getTryEquivalent(item.unit_price, item.currency)
                                    const unitUsd = getUsdEquivalent(unitTry)
                                    const displayUnit = item.unit === 'Adet' ? 'ad.' : item.unit

                                    return (
                                      <div 
                                        key={item.id} 
                                        onClick={() => setSelectedStockId(item.id)} 
                                        style={{ animation: 'fadeSlideRight 0.25s both', animationDelay: `${Math.min(idx * 0.02, 0.3)}s` }}
                                        className={`flex items-center justify-between text-[11px] py-2 px-3 ${hasSubHeader ? 'pl-7' : 'pl-4'} cursor-pointer transition-colors ${isSelected ? 'bg-indigo-900/30 border-l-2 border-l-indigo-400' : 'hover:bg-slate-800/30'} ${item.quantity <= 0 ? 'opacity-60 bg-rose-950/5' : ''}`}
                                      >
                                        <div className="flex items-center gap-1.5 min-w-0 pr-2 flex-1">
                                          <span className={`font-normal truncate ${item.quantity <= 0 ? 'text-slate-400 line-through decoration-slate-600' : 'text-slate-200'}`}>
                                            {item.name}
                                          </span>
                                          {item.sku && (
                                            <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 font-mono shrink-0">
                                              {item.sku}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0 font-mono text-[10px]">
                                          <div className="text-slate-400 flex items-center">
                                            <span className={item.currency === 'USD' ? 'text-indigo-300 font-semibold' : ''}>{formatMoney(unitUsd, 'USD').formatted}</span>
                                            <span className="mx-1 text-slate-600">/</span>
                                            <span className={item.currency === 'TRY' ? 'text-indigo-300 font-semibold' : ''}>{formatMoney(unitTry, 'TRY').formatted}</span>
                                          </div>
                                          <div className="w-16 text-right">
                                            {item.quantity <= 0 ? (
                                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                                                0 {displayUnit}
                                              </span>
                                            ) : item.quantity <= 2 ? (
                                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                                                {item.quantity} {displayUnit}
                                              </span>
                                            ) : (
                                              <span className="text-emerald-400 font-medium">
                                                {item.quantity} <span className="text-[9px] text-emerald-400/70">{displayUnit}</span>
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SAĞ SÜTUN */}
        <div style={{ animation: 'fadeInUp 0.4s both 0.2s' }} className="flex-1 bg-[#0d1322] border border-slate-800/80 rounded-xl flex flex-col min-w-0 shadow-lg relative">
          
          {/* HIZLI ARAMA & FATURA İŞLEMİ (Her Zaman Üstte) */}
          <div className="p-4 border-b border-slate-800/80 bg-[#0a0f1d] rounded-t-xl shrink-0 z-20">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5"><Search size={12}/> Hızlı Arama & İşlem Ekleme</label>
              <div className="relative z-20">
                <input 
                  type="text" 
                  placeholder="Seçili depoda ürün adı veya SKU ara (örn: ekran kartı)..." 
                  value={quickSearchTerm} 
                  onChange={(e) => {
                    setQuickSearchTerm(e.target.value);
                    if (e.target.value.length < 2) setIsQuickActionActive(false);
                  }} 
                  className="w-full bg-[#070b14] border border-indigo-500/30 rounded-lg pl-4 pr-10 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 shadow-inner transition-colors"
                />
                <button 
                  onClick={() => setQuickSearchTerm('')}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-opacity ${quickSearchTerm ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                ><X size={14}/></button>

                {/* Arama Sonuçları Dropdown */}
                {quickSearchTerm.length > 1 && !isQuickActionActive && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#1b253b] border border-indigo-500/50 rounded-lg shadow-2xl overflow-hidden max-h-60 overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2 duration-200">
                    {quickSearchStocks.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400">Ürün bulunamadı.</div>
                    ) : (
                      quickSearchStocks.map(stock => (
                        <div 
                          key={`quick-${stock.id}`} 
                          onClick={() => {
                            setSelectedStockId(stock.id);
                            setIsQuickActionActive(true);
                            setQuickSearchTerm(stock.name);
                            setTxDate(getLocalTodayISO());
                            setTxDesc(''); setTxQty(''); setTxPrice(stock.unit_price.toString());
                            setTxCurrency(stock.currency as any); setTxVatRate(stock.vat_rate.toString());
                          }}
                          className="px-3 py-2.5 hover:bg-indigo-600 hover:text-white cursor-pointer transition-colors border-b border-slate-700/50 flex justify-between items-center group"
                        >
                          <div className="flex flex-col">
                            <span className="font-bold text-xs">{stock.name}</span>
                            <span className="text-[9px] text-slate-400 group-hover:text-indigo-200">{stock.sku || 'SKU Yok'}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-mono group-hover:text-indigo-100">{formatMoney(stock.unit_price, stock.currency).formatted}</span>
                            <span className="bg-slate-900/50 px-2 py-0.5 rounded text-[10px] text-emerald-400 border border-slate-700">Stok: {stock.quantity}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* EĞER BİR ÜRÜN SEÇİLİYSE DETAYLAR VE FORM GÖSTERİLİR */}
          {selectedStock ? (
            <div className="flex flex-col flex-1 overflow-hidden z-10">
              <div className="p-4 border-b border-slate-800/80 bg-gradient-to-r from-[#0a0f1d] to-[#0d1322] flex justify-between items-center shrink-0">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold text-white truncate">{selectedStock.name}</h2>
                    <span className="bg-slate-800/50 px-1.5 py-0.5 rounded text-[10px] text-slate-400 border border-slate-700 font-mono shrink-0">{selectedStock.sku || 'SKU-YOK'}</span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400 mt-2">
                    <div className="bg-emerald-900/20 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded">
                      Mevcut: <strong className="text-sm">{selectedStock.quantity}</strong> {selectedStock.unit === 'Adet' ? 'ad.' : selectedStock.unit}
                    </div>
                    <div>
                      <div>Stok Kartı Maliyeti (Net): <strong className="text-white">{formatMoney(selectedStock.unit_price, selectedStock.currency).formatted}</strong></div>
                      {selectedStock.vat_rate > 0 && (
                        <div className="text-[10px] text-indigo-300 mt-0.5">
                          KDV Dahil: {formatMoney(selectedStock.unit_price * (1 + selectedStock.vat_rate / 100), selectedStock.currency).formatted} <span className="text-slate-500">(%{selectedStock.vat_rate})</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-slate-800 shrink-0">
                  <button onClick={(e) => openEditStock(selectedStock, e)} className="text-slate-400 hover:text-indigo-400 p-1.5 transition" title="Stok Kartını Düzenle"><Edit3 size={14} /></button>
                  <button onClick={(e) => handleDeleteStock(selectedStock.id, e)} className="text-slate-400 hover:text-rose-400 p-1.5 transition" title="Stok Kartını Sil"><Trash2 size={14} /></button>
                </div>
              </div>

              <div className="p-4 overflow-y-auto custom-scrollbar flex-1 flex flex-col relative z-0">
                <form onSubmit={handleAddTransaction} style={{ animation: 'fadeInUp 0.4s both 0.3s' }} className={`grid grid-cols-1 md:grid-cols-11 gap-2 mb-4 p-3 rounded-lg border shrink-0 transition-colors ${isQuickActionActive ? 'bg-indigo-900/10 border-indigo-500/40 shadow-inner shadow-indigo-500/10' : 'bg-[#070b14] border-slate-800'}`}>
                  <div className="md:col-span-1"><label className="block text-[9px] text-slate-400 mb-0.5">Tarih</label><input type="date" required value={txDate} onChange={(e) => setTxDate(e.target.value)} className="w-full bg-[#0d1322] border border-slate-800 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors" /></div>
                  
                  <div className="md:col-span-2">
                     <label className="block text-[9px] text-slate-400 mb-0.5">İlgili Şirket/Merkez *</label>
                     <select value={txCompanyId} onChange={(e) => setTxCompanyId(e.target.value)} required className="w-full bg-[#0d1322] border border-slate-800 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors">
                       <option value="common">🌍 Ortak İşlem</option>
                       <optgroup label="Ticari Şirketler">{companies.filter(c => !c.is_personal).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                       <optgroup label="Şahsi Merkezler">{companies.filter(c => c.is_personal).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                     </select>
                  </div>

                  <div className="md:col-span-1"><label className="block text-[9px] text-slate-400 mb-0.5">İşlem</label><select value={txType} onChange={(e) => setTxType(e.target.value as any)} className="w-full bg-[#0d1322] border border-slate-800 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"><option value="in">Giriş (+)</option><option value="out">Çıkış (-)</option></select></div>
                  <div className="md:col-span-2"><label className="block text-[9px] text-slate-400 mb-0.5">Açıklama</label><input type="text" required placeholder="Fatura No / Açıklama" value={txDesc} onChange={(e) => setTxDesc(e.target.value)} className="w-full bg-[#0d1322] border border-slate-800 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors" /></div>
                  <div className="md:col-span-1"><label className="block text-[9px] text-slate-400 mb-0.5">Miktar</label><input type="number" step="0.01" required placeholder="0" value={txQty} onChange={(e) => setTxQty(e.target.value)} className="w-full bg-[#0d1322] border border-slate-800 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors" /></div>
                  
                  <div className="md:col-span-3 flex flex-col gap-0.5">
                    <div className="flex gap-1">
                      <div className="flex-1"><label className="block text-[9px] text-slate-400 mb-0.5">Net B.Fiyat</label><input type="number" step="0.01" required placeholder="0.00" value={txPrice} onChange={(e) => setTxPrice(e.target.value)} className="w-full bg-[#0d1322] border border-slate-800 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors" /></div>
                      <div className="w-12"><label className="block text-[9px] text-slate-400 mb-0.5">Kur</label><select value={txCurrency} onChange={(e) => setTxCurrency(e.target.value as any)} className="w-full bg-[#0d1322] border border-slate-800 rounded px-1 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"><option value="TRY">₺</option><option value="USD">$</option><option value="EUR">€</option></select></div>
                      <div className="w-12"><label className="block text-[9px] text-slate-400 mb-0.5">KDV(%)</label><select value={txVatRate} onChange={(e) => setTxVatRate(e.target.value)} className="w-full bg-[#0d1322] border border-slate-800 rounded px-1 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"><option value="20">20</option><option value="10">10</option><option value="1">1</option><option value="0">0</option></select></div>
                    </div>
                    {txPrice && parseFloat(txVatRate) > 0 && (
                      <span className="text-[9px] text-indigo-400 pl-1">KDV Dahil: {formatMoney((parseFloat(txPrice) || 0) * (1 + (parseFloat(txVatRate) || 0) / 100), txCurrency).formatted}</span>
                    )}
                  </div>

                  <div className="md:col-span-1 flex items-start gap-1 pt-3.5">
                    {editingTxId && (
                      <button type="button" onClick={cancelEditTx} className="bg-slate-700 hover:bg-slate-600 text-white px-2 py-1.5 rounded text-[11px] font-bold transition h-[26px]">X</button>
                    )}
                    <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1.5 rounded text-[11px] font-bold transition-all active:scale-95 h-[26px]">{editingTxId ? 'Güncelle' : 'Kaydet'}</button>
                  </div>
                </form>

                <div className="border border-slate-800/80 rounded-lg overflow-hidden flex-1 flex flex-col">
                  <table className="w-full text-left text-[11px]">
                    <thead className="sticky top-0 bg-[#0a0f1d] z-10">
                      <tr className="border-b border-slate-800/80 text-slate-400">
                        <th className="p-2.5 font-medium">Tarih</th>
                        <th className="p-2.5 font-medium">Açıklama & Merkez</th>
                        <th className="p-2.5 font-medium text-right text-emerald-400">Giriş</th>
                        <th className="p-2.5 font-medium text-right text-rose-400">Çıkış</th>
                        <th className="p-2.5 font-medium text-right">Net B.Fiyat</th>
                        <th className="p-2.5 font-medium text-right">KDV'li B.Fiyat</th>
                        <th className="p-2.5 font-medium text-right">Toplam Değer (KDV'li)</th>
                        <th className="p-2.5 font-medium text-center w-12">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {transactions.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-6 text-center">
                            <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-700/60 rounded-xl bg-slate-800/10 text-slate-500 shadow-inner my-2 mx-2">
                               <RefreshCw size={32} className="mb-3 opacity-70 text-indigo-400 animate-bounce" />
                               <p className="text-[11px] font-bold text-slate-400">Henüz hareket bulunmuyor.</p>
                            </div>
                          </td>
                        </tr>
                      ) : transactions.map((t, index) => {
                          const txCurrency = t.currency || 'TRY'
                          const kdvliBirim = t.unit_price * (1 + (t.vat_rate || 0) / 100)
                          const toplamKdvli = t.quantity * kdvliBirim
                          
                          const tryUnitPrice = getTryEquivalent(t.unit_price, txCurrency)
                          const tryKdvliBirim = getTryEquivalent(kdvliBirim, txCurrency)
                          const tryToplamKdvli = getTryEquivalent(toplamKdvli, txCurrency)

                          return (
                            <tr 
                              key={t.id} 
                              style={{ animation: 'fadeSlideRight 0.4s both', animationDelay: `${0.35 + (index * 0.05)}s` }}
                              className="hover:bg-slate-800/30 font-mono transition-colors"
                            >
                              <td className="p-2.5 text-slate-400 align-top">{formatDateTR(t.tx_date)}</td>
                              <td className="p-2.5 text-slate-200 font-sans align-top" title={t.description}>
                                 <div className="mb-1">{t.description}</div>
                                 <div className="flex items-center gap-1 text-[9px] text-slate-500">
                                   {t.company ? (t.company.is_personal ? <Home size={10} className="text-slate-400"/> : <Building size={10} className="text-indigo-400"/>) : <Globe size={10} className="text-emerald-500/70"/>}
                                   {t.company ? t.company.name : 'Ortak İşlem'}
                                 </div>
                              </td>
                              <td className="p-2.5 text-right text-emerald-400 align-top">{t.tx_type === 'in' ? t.quantity : '-'}</td>
                              <td className="p-2.5 text-right text-rose-400 align-top">{t.tx_type === 'out' ? t.quantity : '-'}</td>
                              
                              <td className="p-2.5 text-right text-slate-300 leading-tight align-top">
                                <div>{formatMoney(t.unit_price, txCurrency).formatted}</div>
                                {txCurrency !== 'TRY' && (
                                  <div className="text-[9px] text-slate-500 mt-0.5">{formatMoney(tryUnitPrice, 'TRY').formatted}</div>
                                )}
                              </td>
                              
                              <td className="p-2.5 text-right text-indigo-300 leading-tight align-top">
                                {t.vat_rate > 0 ? (
                                  <>
                                    <div>{formatMoney(kdvliBirim, txCurrency).formatted}</div>
                                    {txCurrency !== 'TRY' && (
                                      <div className="text-[9px] text-indigo-500/70 mt-0.5">{formatMoney(tryKdvliBirim, 'TRY').formatted}</div>
                                    )}
                                  </>
                                ) : '-'}
                              </td>
                              
                              <td className="p-2.5 text-right font-bold text-white leading-tight align-top">
                                <div>{formatMoney(toplamKdvli, txCurrency).formatted}</div>
                                {txCurrency !== 'TRY' && (
                                  <div className="text-[9px] text-slate-400 font-normal mt-0.5">{formatMoney(tryToplamKdvli, 'TRY').formatted}</div>
                                )}
                              </td>

                              <td className="p-2.5 text-center align-top">
                                <div className="flex items-center justify-center gap-2">
                                  <button onClick={() => handleEditTx(t)} className="text-slate-500 hover:text-indigo-400 transition" title="Düzenle"><Edit3 size={12} /></button>
                                  <button onClick={() => handleDeleteTransaction(t.id, t.quantity, t.tx_type)} className="text-slate-600 hover:text-rose-400 transition" title="Sil"><Trash2 size={12} /></button>
                                </div>
                              </td>
                            </tr>
                          )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 m-4 border border-dashed border-slate-700/60 rounded-xl bg-slate-800/10 text-slate-500 shadow-inner z-0">
              <Package size={48} className="mb-4 opacity-70 text-indigo-400 animate-bounce" />
              <p className="text-sm font-bold text-slate-400">Lütfen bir ürün seçin veya hızlı arama yapın.</p>
            </div>
          )}
        </div>
      </div>

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

      {/* --- MODALLAR --- */}
      
      {/* KATEGORİ & ALT KATEGORİ YÖNETİM MODALI */}
      {isCategoryManageModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 10000 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] overflow-hidden">
            {/* Modal Başlığı */}
            <div className="p-4 border-b border-slate-800 bg-[#0a0f1d] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <Layers size={17} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">Kategori & Alt Kategori Yönetimi</h3>
                  <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                    <span>Depo:</span>
                    <span className="text-indigo-400 font-semibold">{warehouses.find(w => w.id === selectedWarehouseId)?.name || 'Seçili Depo'}</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsCategoryManageModalOpen(false)
                  setInlineEditingCatId(null)
                  setInlineEditingSubKey(null)
                }} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/80 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            {/* Yeni Kategori Yaratma Bölümü */}
            <div className="p-3.5 bg-[#090d18] border-b border-slate-800/80 shrink-0">
              <form onSubmit={handleCreateCategory} className="flex gap-2">
                <div className="relative flex-1">
                  <FolderPlus size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="text" 
                    placeholder="Yeni ana kategori adı (örn: Monitör, Yazıcı)..." 
                    value={newCatNameInput} 
                    onChange={(e) => setNewCatNameInput(e.target.value)} 
                    className="w-full bg-[#070b14] border border-slate-700/80 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={!newCatNameInput.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 shadow-md shadow-indigo-950/40 shrink-0 cursor-pointer"
                >
                  <Plus size={14} /> Kategori Ekle
                </button>
              </form>
            </div>

            {/* Liste Kontrol Başlığı */}
            <div className="px-4 py-2 bg-[#0c1222] border-b border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 shrink-0">
              <span className="font-semibold text-slate-300">Kategoriler ({categories.length})</span>
              {categories.length > 0 && (
                <button 
                  type="button"
                  onClick={() => {
                    const allOpen = categories.every(c => manageCatExpanded[c.id])
                    const nextState: Record<string, boolean> = {}
                    categories.forEach(c => { nextState[c.id] = !allOpen })
                    setManageCatExpanded(nextState)
                  }}
                  className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer select-none"
                >
                  <ChevronsUpDown size={12} /> Tümünü {categories.every(c => manageCatExpanded[c.id]) ? 'Daralt' : 'Genişlet'}
                </button>
              )}
            </div>

            {/* Akordeon Kategori & Alt Kategori Listesi */}
            <div className="overflow-y-auto custom-scrollbar flex-1 p-3.5 space-y-2.5">
              {categories.length === 0 ? (
                <div className="text-center text-slate-500 text-xs py-8 border border-dashed border-slate-800 rounded-xl">
                  Bu depoda henüz kategori bulunmuyor. Yukarıdaki kutudan ilk kategorinizi ekleyebilirsiniz.
                </div>
              ) : categories.map(c => {
                const isExpanded = !!manageCatExpanded[c.id]
                const subs = getSubCategoriesForCategory(c.name)
                const catProductCount = warehouseStocks.filter(s => s.category === c.name).length
                const isEditingThisCat = inlineEditingCatId === c.id

                return (
                  <div key={c.id} className="border border-slate-800/90 rounded-xl overflow-hidden bg-[#070b14] transition-all">
                    {/* Kategori Başlığı / Satırı */}
                    <div className={`p-2.5 flex items-center justify-between gap-2 transition-colors ${isExpanded ? 'bg-slate-800/40 border-b border-slate-800/60' : 'hover:bg-slate-800/20'}`}>
                      {isEditingThisCat ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input 
                            type="text" 
                            autoFocus
                            value={inlineEditingCatName} 
                            onChange={(e) => setInlineEditingCatName(e.target.value)} 
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveInlineCategory(c.id)
                              if (e.key === 'Escape') setInlineEditingCatId(null)
                            }}
                            className="flex-1 bg-[#050811] border border-indigo-500 rounded px-2.5 py-1 text-xs text-white focus:outline-none"
                          />
                          <button 
                            type="button" 
                            onClick={() => handleSaveInlineCategory(c.id)} 
                            className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
                            title="Kaydet"
                          >
                            <Check size={13} />
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setInlineEditingCatId(null)} 
                            className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                            title="İptal"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div 
                            onClick={() => setManageCatExpanded(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                            className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer select-none"
                          >
                            <span className="text-slate-500 hover:text-indigo-400 transition-colors">
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </span>
                            <Folder size={14} className="text-indigo-400 shrink-0" />
                            <span className="text-xs font-semibold text-slate-200 truncate">{c.name}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono shrink-0">
                              {catProductCount} ürün
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-950/60 text-teal-400 border border-teal-800/40 font-mono shrink-0">
                              {subs.length} alt kat.
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button 
                              type="button"
                              onClick={() => { 
                                setInlineEditingCatId(c.id); 
                                setInlineEditingCatName(c.name); 
                              }} 
                              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-indigo-300 transition-colors cursor-pointer" 
                              title="Kategori Adını Düzenle"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleDeleteCategory(c.id, c.name)} 
                              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer" 
                              title="Kategoriyi Sil"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Akordeon: Alt Kategoriler İçeriği */}
                    {isExpanded && (
                      <div className="bg-[#050811] p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-wider">
                            <Tag size={11} className="text-teal-400" /> Alt Kategoriler ({subs.length})
                          </span>
                        </div>

                        {subs.length === 0 ? (
                          <div className="text-[11px] text-slate-500 italic py-1 pl-1">
                            Henüz alt kategori eklenmemiş. Aşağıdan ekleyebilirsiniz.
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {subs.map(sub => {
                              const subKey = `${c.name}__${sub.name}`
                              const isEditingThisSub = inlineEditingSubKey === subKey

                              return (
                                <div key={subKey} className="flex items-center justify-between bg-[#0a0f1d] border border-slate-800/80 rounded-lg px-2.5 py-1.5 text-xs group/sub">
                                  {isEditingThisSub ? (
                                    <div className="flex items-center gap-2 flex-1">
                                      <input 
                                        type="text" 
                                        autoFocus
                                        value={inlineEditingSubName} 
                                        onChange={(e) => setInlineEditingSubName(e.target.value)} 
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSaveInlineSubCategory(c.name, sub.name, sub.id)
                                          if (e.key === 'Escape') setInlineEditingSubKey(null)
                                        }}
                                        className="flex-1 bg-[#070b14] border border-teal-500 rounded px-2 py-0.5 text-xs text-white focus:outline-none"
                                      />
                                      <button 
                                        type="button" 
                                        onClick={() => handleSaveInlineSubCategory(c.name, sub.name, sub.id)} 
                                        className="p-1 rounded bg-teal-600 hover:bg-teal-500 text-white transition-colors"
                                        title="Kaydet"
                                      >
                                        <Check size={12} />
                                      </button>
                                      <button 
                                        type="button" 
                                        onClick={() => setInlineEditingSubKey(null)} 
                                        className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                                        title="İptal"
                                      >
                                        <X size={12} />
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                                        <span className="text-slate-300 font-medium truncate">{sub.name}</span>
                                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                                          {sub.count} ürün
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover/sub:opacity-100 transition-opacity">
                                        <button 
                                          type="button"
                                          onClick={() => {
                                            setInlineEditingSubKey(subKey)
                                            setInlineEditingSubName(sub.name)
                                          }}
                                          className="p-1 text-slate-400 hover:text-teal-300 hover:bg-slate-800 rounded transition-colors"
                                          title="Alt Kategoriyi Düzenle"
                                        >
                                          <Edit3 size={12} />
                                        </button>
                                        <button 
                                          type="button"
                                          onClick={() => handleDeleteSubCategory(c.name, sub.name, sub.id, sub.count)}
                                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
                                          title="Alt Kategoriyi Sil"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Yeni Alt Kategori Ekleme Formu */}
                        <form 
                          onSubmit={(e) => {
                            e.preventDefault()
                            handleCreateSubCategory(c.name, c.id)
                          }}
                          className="flex gap-2 pt-1 border-t border-slate-800/60"
                        >
                          <input 
                            type="text" 
                            placeholder={`${c.name} için yeni alt kategori adı (örn: USB 3.0)...`}
                            value={newSubCatInputs[c.id] || ''}
                            onChange={(e) => setNewSubCatInputs(prev => ({ ...prev, [c.id]: e.target.value }))}
                            className="flex-1 bg-[#080d19] border border-slate-700/60 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
                          />
                          <button 
                            type="submit" 
                            disabled={!(newSubCatInputs[c.id] || '').trim()}
                            className="bg-teal-600/80 hover:bg-teal-600 disabled:opacity-40 text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 shrink-0 cursor-pointer"
                          >
                            <Plus size={13} /> Ekle
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}


      {/* KATEGORİ EKLE/DÜZENLE MODALI */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 10000 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-white mb-3">{editingStockCatId ? 'Kategoriyi Düzenle' : `Kategori Ekle (${warehouses.find(w=>w.id===selectedWarehouseId)?.name})`}</h3>
            <form onSubmit={handleSaveCategory} className="space-y-3 text-xs">
              <input type="text" required placeholder="Kategori Adı" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors" />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setIsCategoryModalOpen(false); setEditingStockCatId(null); setNewCategoryName(''); }} className="px-3 py-1.5 rounded text-slate-400 hover:bg-slate-800 transition-colors">İptal</button>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded font-medium transition-all active:scale-95 shadow-lg shadow-indigo-900/20">{editingStockCatId ? 'Güncelle' : 'Ekle'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEPO EKLE/DÜZENLE MODALI */}
      {isWarehouseModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 9999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2"><Package size={16} className="text-indigo-400"/> {editingWhId ? 'Depoyu Düzenle' : 'Yeni Depo Ekle'}</h3>
              <button onClick={() => setIsWarehouseModalOpen(false)} className="text-slate-400 hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveWarehouse} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-bold">Depo Sahibi / Merkez</label>
                <select value={whCompanyId} onChange={(e) => setWhCompanyId(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors">
                   <option value="common">🌍 Ortak / Bağımsız Depo</option>
                   <optgroup label="Ticari Şirketler">{companies.filter(c => !c.is_personal).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                   <optgroup label="Şahsi Merkezler">{companies.filter(c => c.is_personal).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Depo Adı *</label>
                <input type="text" required placeholder="Örn: Ana Depo, Şube" value={whName} onChange={(e) => setWhName(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Tema Rengi</label>
                <select value={whColor} onChange={(e) => setWhColor(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors">
                  {THEME_COLORS.map((col) => <option key={col.value} value={col.value}>{col.label}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsWarehouseModalOpen(false)} className="px-4 py-1.5 rounded text-slate-400 hover:bg-slate-800 transition-colors">İptal</button>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-1.5 rounded font-medium transition-all active:scale-95 shadow-lg shadow-indigo-900/20">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STOK KARTI EKLE/DÜZENLE MODALI */}
      {isStockModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 9999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl w-full max-w-md p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Package size={16} className="text-indigo-400"/> {editingStockId ? 'Stok Kartını Düzenle' : 'Yeni Stok Kartı Ekle'}</h3>
            <form onSubmit={handleSaveStock} className="grid grid-cols-2 gap-3 text-[11px]">
              <div className="col-span-2">
                <label className="block text-slate-400 mb-1">Ürün Adı *</label>
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-2.5 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              
              <div className="flex items-end gap-1">
                <div className="flex-1">
                  <label className="block text-slate-400 mb-1">Kategori</label>
                  <select 
                    value={category} 
                    onChange={(e) => { 
                      setCategory(e.target.value); 
                      setSubCategory(''); 
                      setIsCustomSubCat(false); 
                    }} 
                    className="w-full bg-[#070b14] border border-slate-700 rounded px-2.5 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors text-xs"
                  >
                    <option value="">Seçiniz</option>
                    {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <button 
                  type="button" 
                  onClick={() => setIsCategoryManageModalOpen(true)} 
                  className="bg-slate-800 hover:bg-slate-700 p-2 rounded text-indigo-400 hover:text-indigo-300 transition-colors active:scale-95 shrink-0"
                  title="Kategorileri ve Alt Kategorileri Yönet"
                >
                  <Settings size={14}/>
                </button>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400">Alt Kategori</label>
                  <div className="flex items-center gap-1.5">
                    {category && getSubCategoriesForCategory(category).length > 0 && (
                      <span className="text-[9px] text-teal-400 font-mono">
                        {getSubCategoriesForCategory(category).length} seçenek
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsCustomSubCat(!isCustomSubCat)}
                      className="text-[9px] text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer underline"
                      title={isCustomSubCat ? "Listeden seç" : "Yeni alt kategori yaz"}
                    >
                      {isCustomSubCat ? 'Listeden Seç' : '+ Yeni Yaz'}
                    </button>
                  </div>
                </div>

                {isCustomSubCat ? (
                  <input 
                    type="text" 
                    placeholder="Yeni alt kategori adı yazın..."
                    value={subCategory} 
                    onChange={(e) => setSubCategory(e.target.value)} 
                    className="w-full bg-[#070b14] border border-slate-700 rounded px-2.5 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors text-xs" 
                  />
                ) : (
                  <select 
                    value={subCategory} 
                    onChange={(e) => {
                      if (e.target.value === '__NEW__') {
                        setIsCustomSubCat(true);
                        setSubCategory('');
                      } else {
                        setSubCategory(e.target.value);
                      }
                    }} 
                    disabled={!category}
                    className="w-full bg-[#070b14] border border-slate-700 rounded px-2.5 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <option value="">{category ? 'Seçiniz (Opsiyonel)' : 'Önce Kategori Seçin'}</option>
                    {category && getSubCategoriesForCategory(category).map(sub => (
                      <option key={sub.name} value={sub.name}>
                        {sub.name} {sub.count > 0 ? `(${sub.count} ürün)` : ''}
                      </option>
                    ))}
                    {subCategory && category && !getSubCategoriesForCategory(category).some(s => s.name === subCategory) && (
                      <option value={subCategory}>{subCategory}</option>
                    )}
                    {category && (
                      <option value="__NEW__" className="text-indigo-400 font-semibold">✍️ + Yeni Alt Kategori Yaz...</option>
                    )}
                  </select>
                )}
              </div>
              
              <div>
                <label className="block text-slate-400 mb-1">SKU / Barkod</label>
                <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-2.5 py-2 text-white font-mono focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              
              <div>
                <label className="block text-slate-400 mb-1">Birim</label>
                <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-2.5 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors">
                  <option>Adet</option><option>Kg</option><option>Metre</option><option>Lt</option><option>Paket</option><option>Kutu</option>
                </select>
              </div>
              
              <div className="col-span-2 mt-2 pt-3 border-t border-slate-800">
                <label className="block text-slate-400 font-bold mb-2">Açılış Stoğu & Maliyet Tanımlaması</label>
                <div className="flex flex-col gap-2 bg-[#0a0f1d] p-3 rounded border border-slate-800/80">
                  <div className="flex gap-2">
                    <div className="w-24">
                      <label className="block text-slate-400 mb-1">Miktar</label>
                      <input type="number" step="0.01" placeholder="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                    </div>
                    <div className="flex-1">
                      <label className="block text-slate-400 mb-1">Net B.Fiyat</label>
                      <input type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                    </div>
                    <div className="w-16">
                      <label className="block text-slate-400 mb-1">Kur</label>
                      <select value={currency} onChange={(e) => setCurrency(e.target.value as any)} className="w-full bg-[#070b14] border border-slate-700 rounded px-1.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 transition-colors">
                        <option value="TRY">₺</option><option value="USD">$</option><option value="EUR">€</option>
                      </select>
                    </div>
                    <div className="w-20">
                      <label className="block text-slate-400 mb-1">KDV (%)</label>
                      <select value={vatRate} onChange={(e) => setVatRate(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-1.5 py-1.5 text-white focus:outline-none focus:border-indigo-500 transition-colors">
                        <option value="20">20</option><option value="10">10</option><option value="1">1</option><option value="0">0</option>
                      </select>
                    </div>
                  </div>
                  
                  {unitPrice && parseFloat(vatRate) >= 0 && (
                    <div className="flex justify-between items-center bg-indigo-900/20 border border-indigo-500/30 rounded px-3 py-2 mt-1">
                      <span className="text-indigo-200">KDV Dahil Satış / Maliyet Fiyatı:</span>
                      <span className="text-indigo-400 font-bold font-mono text-sm">
                        {formatMoney((parseFloat(unitPrice) || 0) * (1 + (parseFloat(vatRate) || 0) / 100), currency).formatted}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="col-span-2 flex justify-end gap-2 mt-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsStockModalOpen(false)} className="px-4 py-1.5 rounded text-slate-400 hover:bg-slate-800 transition-colors">İptal</button>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-1.5 rounded font-medium transition-all active:scale-95 shadow-lg shadow-indigo-900/20">Kaydet</button>
              </div>
            </form>
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
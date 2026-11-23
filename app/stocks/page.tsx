'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useCompany } from '@/lib/company-context'
import { formatMoney } from '@/lib/utils'
import { recalculateAbsoluteStock as recalculateStockLedger } from '@/lib/stock-ledger'
import toast, { Toaster } from 'react-hot-toast'
import {
  Package, Plus, Trash2, X, Edit3, Layers, Search, Building, Home, Globe,
  AlertTriangle, RefreshCw, Filter, Settings, Tags, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, ChevronsUpDown, Tag, ArrowUpDown, Check, Folder, FolderPlus,
  BarChart3, PieChart, Clock, Zap, CheckCircle2, TrendingDown, ExternalLink,
  ShieldAlert, Moon, Eye, ArrowRight, AlertCircle, ShoppingCart, Lock, ArrowRightLeft
} from 'lucide-react'

type Company = { id: string; name: string; is_personal: boolean }
type Warehouse = { id: string; name: string; color: string; company_id?: string | null; company?: { name: string; is_personal: boolean } }
type StockCategory = { id: string; name: string; warehouse_id: string }

export interface RecipeComponent {
  stock_id: string
  name: string
  sku?: string
  quantity: number
  unit?: string
}

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
  web_visible?: boolean
  web_category?: string | null
  web_sub_category?: string | null
  web_price?: number | null
  web_currency?: 'TRY' | 'USD' | 'EUR' | null
  web_updated_at?: string | null
  // Reçeteli / Montaj Ürünü Alanları (Model C)
  is_composite?: boolean
  recipe_components?: RecipeComponent[] | null
  recipe_additional_cost?: number | null
}

type WebCategory = {
  slug: string
  name: string
  parent_slug: string | null
  sort: number
}

type StockTransaction = {
  id: string
  created_at?: string
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
  sale_price?: number | null
  sale_currency?: string | null
  sale_source?: string | null
  profit_percent?: number | null
}

type ExchangeRates = { USD: number; EUR: number }

export interface WarehouseTheme {
  label: string
  value: string
  hex: string
  border: string
  ring: string
  text: string
  dot: string
  glow: string
}

export const WAREHOUSE_THEMES: WarehouseTheme[] = [
  {
    label: 'Gece Mavisi',
    value: 'from-[#1b253b] to-[#121a2a]',
    hex: '#3b82f6',
    border: 'border-blue-500/80',
    ring: 'ring-blue-500/40',
    text: 'text-blue-400',
    dot: 'bg-blue-400',
    glow: 'shadow-blue-950/60',
  },
  {
    label: 'Koyu Grafit',
    value: 'from-[#27272a] to-[#18181b]',
    hex: '#a1a1aa',
    border: 'border-zinc-400/80',
    ring: 'ring-zinc-400/40',
    text: 'text-zinc-300',
    dot: 'bg-zinc-400',
    glow: 'shadow-zinc-950/60',
  },
  {
    label: 'Derin Mor',
    value: 'from-[#3b1f48] to-[#1a0f24]',
    hex: '#a855f7',
    border: 'border-purple-500/80',
    ring: 'ring-purple-500/40',
    text: 'text-purple-400',
    dot: 'bg-purple-400',
    glow: 'shadow-purple-950/60',
  },
  {
    label: 'Zümrüt Yeşili',
    value: 'from-[#133e30] to-[#0a221b]',
    hex: '#10b981',
    border: 'border-emerald-500/80',
    ring: 'ring-emerald-500/40',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
    glow: 'shadow-emerald-950/60',
  },
  {
    label: 'Koyu Bordo',
    value: 'from-[#4a1c1c] to-[#240d0d]',
    hex: '#f43f5e',
    border: 'border-rose-500/80',
    ring: 'ring-rose-500/40',
    text: 'text-rose-400',
    dot: 'bg-rose-400',
    glow: 'shadow-rose-950/60',
  },
  {
    label: 'Okyanus Laciverti',
    value: 'from-[#1e3a8a] to-[#0f172a]',
    hex: '#0284c7',
    border: 'border-sky-500/80',
    ring: 'ring-sky-500/40',
    text: 'text-sky-400',
    dot: 'bg-sky-400',
    glow: 'shadow-sky-950/60',
  },
  {
    label: 'Metalik Titanyum',
    value: 'from-[#334155] to-[#0f172a]',
    hex: '#94a3b8',
    border: 'border-slate-400/80',
    ring: 'ring-slate-400/40',
    text: 'text-slate-300',
    dot: 'bg-slate-400',
    glow: 'shadow-slate-900/60',
  },
  {
    label: 'Bronz Kehribar',
    value: 'from-[#451a03] to-[#1c0a00]',
    hex: '#d97706',
    border: 'border-amber-600/80',
    ring: 'ring-amber-600/40',
    text: 'text-amber-400',
    dot: 'bg-amber-500',
    glow: 'shadow-amber-950/60',
  },
  {
    label: 'Neon Gece',
    value: 'from-[#0f172a] to-[#312e81]',
    hex: '#6366f1',
    border: 'border-indigo-500/80',
    ring: 'ring-indigo-500/40',
    text: 'text-indigo-400',
    dot: 'bg-indigo-400',
    glow: 'shadow-indigo-950/60',
  },
  {
    label: 'Kömür Siyahı',
    value: 'from-[#18181b] to-[#09090b]',
    hex: '#71717a',
    border: 'border-zinc-500/80',
    ring: 'ring-zinc-500/40',
    text: 'text-zinc-400',
    dot: 'bg-zinc-400',
    glow: 'shadow-zinc-950/60',
  },
  {
    label: 'Turkuaz / Cyan',
    value: 'from-[#0e4348] to-[#062427]',
    hex: '#06b6d4',
    border: 'border-cyan-500/80',
    ring: 'ring-cyan-500/40',
    text: 'text-cyan-400',
    dot: 'bg-cyan-400',
    glow: 'shadow-cyan-950/60',
  },
  {
    label: 'Ateş Turuncusu',
    value: 'from-[#4d230f] to-[#251006]',
    hex: '#f97316',
    border: 'border-orange-500/80',
    ring: 'ring-orange-500/40',
    text: 'text-orange-400',
    dot: 'bg-orange-400',
    glow: 'shadow-orange-950/60',
  },
  {
    label: 'Fuşya Pembe',
    value: 'from-[#4a044e] to-[#240226]',
    hex: '#d946ef',
    border: 'border-fuchsia-500/80',
    ring: 'ring-fuchsia-500/40',
    text: 'text-fuchsia-400',
    dot: 'bg-fuchsia-400',
    glow: 'shadow-fuchsia-950/60',
  },
  {
    label: 'Deniz Yeşili (Teal)',
    value: 'from-[#0f3d3e] to-[#072021]',
    hex: '#14b8a6',
    border: 'border-teal-500/80',
    ring: 'ring-teal-500/40',
    text: 'text-teal-400',
    dot: 'bg-teal-400',
    glow: 'shadow-teal-950/60',
  },
  {
    label: 'Koyu Yakut',
    value: 'from-[#5c0e0e] to-[#2b0505]',
    hex: '#ef4444',
    border: 'border-red-500/80',
    ring: 'ring-red-500/40',
    text: 'text-red-400',
    dot: 'bg-red-400',
    glow: 'shadow-red-950/60',
  },
  {
    label: 'Fıstık Yeşili (Lime)',
    value: 'from-[#253900] to-[#121c00]',
    hex: '#84cc16',
    border: 'border-lime-500/80',
    ring: 'ring-lime-500/40',
    text: 'text-lime-400',
    dot: 'bg-lime-400',
    glow: 'shadow-lime-950/60',
  },
]

export const THEME_COLORS = WAREHOUSE_THEMES

export function getWarehouseTheme(colorValue?: string | null): WarehouseTheme {
  if (!colorValue) return WAREHOUSE_THEMES[0]
  const exact = WAREHOUSE_THEMES.find(t => t.value === colorValue)
  if (exact) return exact
  const trimmed = colorValue.trim()
  const partial = WAREHOUSE_THEMES.find(t => t.value.includes(trimmed) || trimmed.includes(t.value))
  if (partial) return partial
  if (trimmed.includes('#1e3a8a')) return WAREHOUSE_THEMES[5] // Okyanus Laciverti
  if (trimmed.includes('#334155')) return WAREHOUSE_THEMES[6] // Metalik Titanyum
  if (trimmed.includes('#451a03')) return WAREHOUSE_THEMES[7] // Bronz Kehribar
  if (trimmed.includes('#312e81')) return WAREHOUSE_THEMES[8] // Neon Gece
  if (trimmed.includes('#18181b')) return WAREHOUSE_THEMES[9] // Kömür Siyahı
  if (trimmed.includes('#064e3b')) return WAREHOUSE_THEMES[3] // Zümrüt Yeşili
  if (trimmed.includes('#581c87')) return WAREHOUSE_THEMES[2] // Derin Mor
  if (trimmed.includes('#881337')) return WAREHOUSE_THEMES[4] // Koyu Bordo
  return WAREHOUSE_THEMES[0]
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

import { logActivity } from '@/lib/audit'
import { useAuth } from '@/lib/auth-context'

export function convertCurrency(
  amount: number,
  fromCurr: string,
  toCurr: string,
  rates: { USD: number; EUR: number }
): number {
  if (!amount || fromCurr === toCurr) return amount
  const usdRate = rates.USD || 34.25
  const eurRate = rates.EUR || 37.80

  let inTry = amount
  if (fromCurr === 'USD') inTry = amount * usdRate
  else if (fromCurr === 'EUR') inTry = amount * eurRate

  let result = inTry
  if (toCurr === 'USD') result = inTry / usdRate
  else if (toCurr === 'EUR') result = inTry / eurRate

  return Math.round(result * 100) / 100
}

export function calculateCompositeCost(
  components: RecipeComponent[],
  additionalCost: number,
  stockPool: StockItem[],
  targetCurrency: string,
  rates: { USD: number; EUR: number }
) {
  let componentsCost = 0
  const itemsDetail = (components || []).map(comp => {
    const stock = stockPool.find(s => s.id === comp.stock_id)
    const stockUnitPrice = Number(stock?.unit_price) || 0
    const stockCurrency = stock?.currency || 'TRY'
    const convertedUnitCost = convertCurrency(stockUnitPrice, stockCurrency, targetCurrency, rates)
    const lineCost = (Number(comp.quantity) || 0) * convertedUnitCost
    componentsCost += lineCost

    return {
      component: comp,
      stock,
      unitCost: convertedUnitCost,
      totalCost: Math.round(lineCost * 100) / 100,
      inStockQty: Number(stock?.quantity) || 0
    }
  })

  const addCost = Number(additionalCost) || 0
  const totalCost = Math.round((componentsCost + addCost) * 100) / 100
  return {
    totalCost,
    componentsCost: Math.round(componentsCost * 100) / 100,
    itemsDetail
  }
}

export default function StocksPage() {
  const { profile, isAdmin } = useAuth()
  const { matchesCompany, selectedCompanyId } = useCompany()
  const [companies, setCompanies] = useState<Company[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null)

  const companyMatchedWarehouses = useMemo(() => {
    return warehouses.filter(w => matchesCompany(w.company_id))
  }, [warehouses, matchesCompany])

  useEffect(() => {
    if (companyMatchedWarehouses.length > 0) {
      if (!selectedWarehouseId || !companyMatchedWarehouses.some(w => w.id === selectedWarehouseId)) {
        setSelectedWarehouseId(companyMatchedWarehouses[0].id)
      }
    }
  }, [companyMatchedWarehouses, selectedWarehouseId])

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
  const [webFilter, setWebFilter] = useState<'all' | 'visible' | 'hidden' | 'missing_cat' | 'missing_price'>('all')
  const [sortBy, setSortBy] = useState<'capacity' | 'name_asc' | 'qty_desc' | 'qty_asc' | 'price_desc' | 'price_asc'>('capacity')
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({})
  const [collapsedSubCategories, setCollapsedSubCategories] = useState<Record<string, boolean>>({})

  // ctcmarket.com Web E-Ticaret Kategorileri ve Toplu İşlem Durumları
  const [webCategories, setWebCategories] = useState<WebCategory[]>([])
  const [selectedStockIds, setSelectedStockIds] = useState<string[]>([])
  const [isBatchCategoryModalOpen, setIsBatchCategoryModalOpen] = useState(false)
  const [batchSelectedWebCategory, setBatchSelectedWebCategory] = useState('')
  const [batchSelectedWebSubCategory, setBatchSelectedWebSubCategory] = useState('')
  const [isBatchPriceModalOpen, setIsBatchPriceModalOpen] = useState(false)
  const [batchProfitPercent, setBatchProfitPercent] = useState('30')
  const [batchLoading, setBatchLoading] = useState(false)

  // Model 3: Depolar Arası Transfer Modal Durumları
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [trfSourceWarehouseId, setTrfSourceWarehouseId] = useState<string>('')
  const [trfTargetWarehouseId, setTrfTargetWarehouseId] = useState<string>('')
  const [trfStockId, setTrfStockId] = useState<string>('')
  const [trfQuantity, setTrfQuantity] = useState<string>('')
  const [trfUnitPrice, setTrfUnitPrice] = useState<string>('')
  const [trfCurrency, setTrfCurrency] = useState<'TRY' | 'USD' | 'EUR'>('TRY')
  const [trfDate, setTrfDate] = useState<string>(getLocalTodayISO())
  const [trfNote, setTrfNote] = useState<string>('')
  const [trfRecordProfit, setTrfRecordProfit] = useState<boolean>(true)
  const [trfLoading, setTrfLoading] = useState<boolean>(false)
  const [trfSearchTerm, setTrfSearchTerm] = useState<string>('')
  const [isTrfDropdownOpen, setIsTrfDropdownOpen] = useState<boolean>(false)

  // Reçeteli / Montaj Ürünleri ve Dinamik Maliyet (Model C)
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false)
  const [recipeStock, setRecipeStock] = useState<StockItem | null>(null)
  const [recipeProductName, setRecipeProductName] = useState<string>('')
  const [recipeProductWarehouseId, setRecipeProductWarehouseId] = useState<string>('')
  const [recipeProductCategory, setRecipeProductCategory] = useState<string>('Tabela & Montaj')
  const [recipeProductSubCategory, setRecipeProductSubCategory] = useState<string>('')
  const [recipeProductSku, setRecipeProductSku] = useState<string>('')
  const [recipeProductCurrency, setRecipeProductCurrency] = useState<'TRY' | 'USD' | 'EUR'>('TRY')
  const [recipeProductUnit, setRecipeProductUnit] = useState<string>('Adet')
  const [recipeIsComposite, setRecipeIsComposite] = useState(true)
  const [recipeComponents, setRecipeComponents] = useState<RecipeComponent[]>([])
  const [recipeAdditionalCost, setRecipeAdditionalCost] = useState<string>('0')
  const [recipeSearchTerm, setRecipeSearchTerm] = useState<string>('')
  const [isRecipeDropdownOpen, setIsRecipeDropdownOpen] = useState<boolean>(false)
  const [recipeOpenCategories, setRecipeOpenCategories] = useState<Record<string, boolean>>({})
  const [recipeCollapsedSubCategories, setRecipeCollapsedSubCategories] = useState<Record<string, boolean>>({})

  const [isAssemblyModalOpen, setIsAssemblyModalOpen] = useState(false)
  const [assemblyStock, setAssemblyStock] = useState<StockItem | null>(null)
  const [assemblyCustomName, setAssemblyCustomName] = useState<string>('')
  const [assemblyQuantity, setAssemblyQuantity] = useState<string>('1')
  const [assemblyDate, setAssemblyDate] = useState<string>(getLocalTodayISO())
  const [isSubmittingAssembly, setIsSubmittingAssembly] = useState(false)

  const [allStocks, setAllStocks] = useState<StockItem[]>([])
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null)
  const [hoveredStockId, setHoveredStockId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<StockTransaction[]>([])
  const [allStockTxs, setAllStockTxs] = useState<{ id: string; stock_id: string; tx_date: string; tx_type: 'in' | 'out'; quantity: number; unit_price: number; currency: string }[]>([])
  const [rates, setRates] = useState<ExchangeRates>({ USD: 34.25, EUR: 37.80 })

  // Sağ Panel Görünüm Modu ve Analiz Sekmeleri
  const [rightPanelMode, setRightPanelMode] = useState<'analytics' | 'product'>('analytics')
  const [analyticsTab, setAnalyticsTab] = useState<'summary' | 'critical' | 'dead'>('summary')
  const [deadStockDays, setDeadStockDays] = useState<number>(30)
  const [criticalSubFilter, setCriticalSubFilter] = useState<'all' | 'critical' | 'out_of_stock'>('all')
  const [analyticsSearch, setAnalyticsSearch] = useState('')
  const [expandedAnalyticsCats, setExpandedAnalyticsCats] = useState<Record<string, boolean>>({})

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

  // ctcmarket.com Form Alanları
  const [webVisible, setWebVisible] = useState(false)
  const [webCategory, setWebCategory] = useState('')
  const [webSubCategory, setWebSubCategory] = useState('')
  const [webPrice, setWebPrice] = useState('')
  const [webCurrency, setWebCurrency] = useState<'TRY' | 'USD' | 'EUR'>('TRY')

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
  }>({ isOpen: false, title: '', message: '', confirmText: '', cancelText: '', isDanger: false, onConfirm: () => { } })

  useEffect(() => {
    fetchExchangeRates()
    fetchCompanies()
    fetchWarehouses()
    fetchAllStocks()
    fetchAllTransactions()
    fetchWebCategories()
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

  const hoveredStockIdRef = useRef<string | null>(null)
  hoveredStockIdRef.current = hoveredStockId

  const selectedStockIdRef = useRef<string | null>(null)
  selectedStockIdRef.current = selectedStockId

  const allStocksRef = useRef<StockItem[]>(allStocks)
  allStocksRef.current = allStocks

  const isAnyModalOpenRef = useRef<boolean>(false)
  isAnyModalOpenRef.current = isStockModalOpen || isWarehouseModalOpen || isCategoryModalOpen || isCategoryManageModalOpen || isTransferModalOpen || isRecipeModalOpen || isAssemblyModalOpen

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        if (isAnyModalOpenRef.current) return

        const targetId = hoveredStockIdRef.current || selectedStockIdRef.current
        if (!targetId) return

        const targetStock = allStocksRef.current.find(s => s.id === targetId)
        if (targetStock) {
          e.preventDefault()
          openEditStock(targetStock)
        }
      } else if (e.key === 'Escape') {
        if (isAssemblyModalOpen) setIsAssemblyModalOpen(false)
        else if (isRecipeModalOpen) setIsRecipeModalOpen(false)
        else if (isTransferModalOpen) setIsTransferModalOpen(false)
        else if (isStockModalOpen) setIsStockModalOpen(false)
        else if (isCategoryManageModalOpen) setIsCategoryManageModalOpen(false)
        else if (isCategoryModalOpen) setIsCategoryModalOpen(false)
        else if (isWarehouseModalOpen) setIsWarehouseModalOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isStockModalOpen, isCategoryManageModalOpen, isCategoryModalOpen, isWarehouseModalOpen, isTransferModalOpen, isRecipeModalOpen, isAssemblyModalOpen])

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

  async function fetchAllTransactions() {
    try {
      const { data, error } = await supabase
        .from('stock_transactions')
        .select('id, stock_id, tx_date, tx_type, quantity, unit_price, currency')
        .order('tx_date', { ascending: false })
      if (error) throw error
      setAllStockTxs(data || [])
    } catch (err) { console.error('Error fetching all stock txs:', err) }
  }

  async function fetchWebCategories() {
    try {
      const { data, error } = await supabase
        .from('web_categories')
        .select('*')
        .order('sort', { ascending: true })
      if (!error && data) {
        setWebCategories(data as WebCategory[])
      }
    } catch (err) {
      console.error('Error fetching web categories:', err)
    }
  }

  const webMainCategories = useMemo(() => {
    return webCategories.filter(c => !c.parent_slug).sort((a, b) => a.sort - b.sort)
  }, [webCategories])

  const getWebSubCategories = (parentSlug: string) => {
    if (!parentSlug) return []
    return webCategories.filter(c => c.parent_slug === parentSlug).sort((a, b) => a.sort - b.sort)
  }

  const getWebCategoryName = (slug?: string | null) => {
    if (!slug) return ''
    return webCategories.find(c => c.slug === slug)?.name || slug
  }

  async function fetchCategories(whId: string) {
    try {
      const { data, error } = await supabase.from('stock_categories').select('*').eq('warehouse_id', whId).order('name', { ascending: true })
      if (error) throw error
      const main: StockCategory[] = []
      const subs: { id: string; category: string; name: string }[] = []
        ; (data || []).forEach(item => {
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
      const { data, error } = await supabase
        .from('stock_transactions')
        .select('*, company:companies(name, is_personal)')
        .eq('stock_id', stockId)
        .order('tx_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error

      const rawTxs = data || []
      const hasOutTxs = rawTxs.some(t => t.tx_type === 'out')

      let custInvoices: any[] = []
      let posTxs: any[] = []
      let techTickets: any[] = []

      if (hasOutTxs) {
        // Çıkış hareketlerinin gerçek satış fiyatlarını bulmak için ilgili kaynak modülleri paralel sorgula
        const [custRes, posRes, techRes] = await Promise.all([
          supabase
            .from('customer_transactions')
            .select('id, description, tx_date, invoice_lines')
            .eq('is_detailed', true),
          supabase
            .from('pos_transactions')
            .select('id, date, stock_id, quantity, cost, cash, card, description')
            .eq('stock_id', stockId),
          supabase
            .from('technical_service_tickets')
            .select('id, ticket_no, total_cost, parts_cost, used_parts')
        ])

        custInvoices = custRes.data || []
        posTxs = posRes.data || []
        techTickets = techRes.data || []
      }

      // Her hareketi satış fiyatı, kâr oranı ve satış kaynağı ile zenginleştir
      const enriched: StockTransaction[] = rawTxs.map(t => {
        let salePrice: number | null = null
        let saleCurrency: 'TRY' | 'USD' | 'EUR' = (t.currency as any) || 'TRY'
        let saleSource: string | null = null

        if (t.tx_type === 'out') {
          const desc = t.description || ''

          // 1. Müşteri Satış Faturası Eşleşmesi
          if (custInvoices.length > 0) {
            for (const inv of custInvoices) {
              if (Array.isArray(inv.invoice_lines)) {
                const line = inv.invoice_lines.find((l: any) =>
                  l.stockTxId === t.id ||
                  (l.targetStockId === stockId && inv.tx_date === t.tx_date && Math.abs(parseFloat(l.quantity || '0') - t.quantity) < 0.001)
                )
                if (line) {
                  salePrice = parseFloat(line.unitPrice) || null
                  saleCurrency = (line.currency || t.currency || 'TRY') as any
                  saleSource = `Müşteri Faturası (${inv.description || ''})`
                  break
                }
              }
            }
          }

          // 2. Mağaza POS Satışı (Z-Raporu) Eşleşmesi
          if (salePrice === null && (desc.includes('POS-') || desc.includes('Mağaza Satışı') || desc.includes('Z-Raporu'))) {
            const matchPos = posTxs.find(p => p.date === t.tx_date)
            if (matchPos) {
              const rev = Number(matchPos.cash || 0) + Number(matchPos.card || 0)
              const q = Number(matchPos.quantity || t.quantity || 1)
              salePrice = q > 0 ? (rev / q) : rev
              saleCurrency = 'TRY'
              saleSource = `Mağaza Satışı (POS${matchPos.description ? `: ${matchPos.description}` : ''})`
            }
          }

          // 3. Depolar Arası Transfer (Model 3) Eşleşmesi
          if (salePrice === null && desc.includes('[TRF-')) {
            const m = desc.match(/(?:B\.Transfer|Transfer B\.Fiyat):\s*([0-9.,]+)\s*([A-Z]+)/)
            if (m) {
              salePrice = parseFloat(m[1].replace(',', '.'))
              saleCurrency = (m[2] || t.currency || 'TRY') as any
              saleSource = 'Depo Transfer Çıkışı'
            }
          }

          // 4. Teknik Servis Parça Çıkışı Eşleşmesi
          if (salePrice === null && (desc.includes('SRV-') || desc.includes('Servis Parça Çıkışı'))) {
            const srvMatch = desc.match(/SRV-\d{2}-\d+/)
            const ticketNo = srvMatch ? srvMatch[0] : null
            if (ticketNo) {
              const matchedTicket = techTickets.find(tk => tk.ticket_no === ticketNo)
              if (matchedTicket && Array.isArray(matchedTicket.used_parts)) {
                const part = matchedTicket.used_parts.find((p: any) => p.stock_id === stockId)
                if (part && part.unit_price) {
                  salePrice = Number(part.unit_price)
                  saleCurrency = 'TRY'
                  saleSource = `Teknik Servis (${ticketNo})`
                }
              }
            }
          }
        }

        const profitPercent = (salePrice !== null && t.unit_price > 0)
          ? ((salePrice - t.unit_price) / t.unit_price) * 100
          : null

        return {
          ...t,
          sale_price: salePrice,
          sale_currency: saleCurrency,
          sale_source: saleSource,
          profit_percent: profitPercent
        }
      })

      // Kronolojik sıralama: Aynı günde açılış stoğu daima tabanda (en eski) yer almalıdır
      const sorted = enriched.sort((a, b) => {
        if (a.tx_date !== b.tx_date) {
          return b.tx_date.localeCompare(a.tx_date)
        }
        if (a.description === 'Açılış Stoğu') return 1
        if (b.description === 'Açılış Stoğu') return -1
        return (b.created_at || '').localeCompare(a.created_at || '')
      })

      setTransactions(sorted)
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
  // --- KATEGORİ & ALT KATEGORİ BAZLI ANALİZ VE DEĞERLENDİRME MOTORU ---
  // =========================================================================================
  const CATEGORY_ACCENT_COLORS = [
    { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', bar: 'bg-indigo-500', hex: '#6366f1' },
    { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', bar: 'bg-emerald-500', hex: '#10b981' },
    { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', bar: 'bg-amber-500', hex: '#f59e0b' },
    { text: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/30', bar: 'bg-purple-500', hex: '#a855f7' },
    { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30', bar: 'bg-rose-500', hex: '#f43f5e' },
    { text: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/30', bar: 'bg-sky-500', hex: '#0284c7' },
    { text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', bar: 'bg-orange-500', hex: '#f97316' },
    { text: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30', bar: 'bg-teal-500', hex: '#14b8a6' },
    { text: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/30', bar: 'bg-fuchsia-500', hex: '#d946ef' },
  ]

  const getDaysDiff = (dateStr: string | null) => {
    if (!dateStr) return null
    const target = new Date(dateStr)
    const today = new Date()
    const diffTime = today.getTime() - target.getTime()
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)))
  }

  const stockTxStatsMap = useMemo(() => {
    const map = new Map<string, {
      inCount: number
      outCount: number
      lastInDate: string | null
      lastOutDate: string | null
      lastTxDate: string | null
      totalInQty: number
      totalOutQty: number
    }>()

    allStockTxs.forEach(tx => {
      if (!map.has(tx.stock_id)) {
        map.set(tx.stock_id, {
          inCount: 0,
          outCount: 0,
          lastInDate: null,
          lastOutDate: null,
          lastTxDate: null,
          totalInQty: 0,
          totalOutQty: 0,
        })
      }
      const stat = map.get(tx.stock_id)!
      if (tx.tx_type === 'in') {
        stat.inCount++
        stat.totalInQty += tx.quantity
        if (!stat.lastInDate || tx.tx_date > stat.lastInDate) stat.lastInDate = tx.tx_date
      } else {
        stat.outCount++
        stat.totalOutQty += tx.quantity
        if (!stat.lastOutDate || tx.tx_date > stat.lastOutDate) stat.lastOutDate = tx.tx_date
      }
      if (!stat.lastTxDate || tx.tx_date > stat.lastTxDate) stat.lastTxDate = tx.tx_date
    })

    return map
  }, [allStockTxs])

  const categoryAnalytics = useMemo(() => {
    const totalWarehouseTry = warehouseStocks.reduce((acc, s) => {
      const vatRate = s.vat_rate || 0
      const priceWithVat = s.unit_price * (1 + vatRate / 100)
      return acc + getTryEquivalent(s.quantity * priceWithVat, s.currency)
    }, 0)
    const totalWarehouseUsd = getUsdEquivalent(totalWarehouseTry)
    const totalWarehouseQty = warehouseStocks.reduce((acc, s) => acc + s.quantity, 0)
    const totalWarehouseSkus = warehouseStocks.length

    type ItemAnalysis = {
      stock: StockItem
      valueTry: number
      valueUsd: number
      unitPriceWithVat: number
      isCritical: boolean
      isOutOfStock: boolean
      isDead: boolean
      daysSinceLastOut: number | null
      daysSinceLastTx: number | null
      lastOutDate: string | null
      lastTxDate: string | null
      outCount: number
    }

    type SubCatAnalysis = {
      name: string
      skuCount: number
      totalQty: number
      totalValueTry: number
      totalValueUsd: number
      criticalCount: number
      outOfStockCount: number
      deadCount: number
      deadValueTry: number
      deadValueUsd: number
      items: ItemAnalysis[]
    }

    type CatAnalysis = {
      name: string
      color: typeof CATEGORY_ACCENT_COLORS[0]
      skuCount: number
      totalQty: number
      totalValueTry: number
      totalValueUsd: number
      percentOfTotal: number
      criticalCount: number
      outOfStockCount: number
      deadCount: number
      deadValueTry: number
      deadValueUsd: number
      subCategories: SubCatAnalysis[]
      items: ItemAnalysis[]
    }

    const catMap = new Map<string, {
      subMap: Map<string, ItemAnalysis[]>
      items: ItemAnalysis[]
    }>()

    let totalCriticalCount = 0
    let totalOutOfStockCount = 0
    let totalDeadCount = 0
    let totalDeadValTry = 0
    const allDeadItems: ItemAnalysis[] = []
    const allCriticalItems: ItemAnalysis[] = []

    warehouseStocks.forEach(item => {
      const cat = (item.category || 'Kategorisiz').trim()
      const subCat = (item.sub_category || 'Genel').trim()

      const vatRate = item.vat_rate || 0
      const unitPriceWithVat = item.unit_price * (1 + vatRate / 100)
      const valTry = getTryEquivalent(item.quantity * unitPriceWithVat, item.currency)
      const valUsd = getUsdEquivalent(valTry)

      const isCritical = item.quantity > 0 && item.quantity <= 2
      const isOutOfStock = item.quantity <= 0

      const stat = stockTxStatsMap.get(item.id)
      const outCount = stat ? stat.outCount : 0
      const lastOutDate = stat ? stat.lastOutDate : null
      const lastTxDate = stat ? stat.lastTxDate : null
      const daysSinceLastOut = getDaysDiff(lastOutDate)
      const daysSinceLastTx = getDaysDiff(lastTxDate)

      let isDead = false
      if (item.quantity > 0) {
        if (deadStockDays === -1) {
          isDead = outCount === 0
        } else if (outCount === 0) {
          isDead = true
        } else if (daysSinceLastOut !== null && daysSinceLastOut >= deadStockDays) {
          isDead = true
        }
      }

      if (isCritical) totalCriticalCount++
      if (isOutOfStock) totalOutOfStockCount++
      if (isDead) {
        totalDeadCount++
        totalDeadValTry += valTry
      }

      const itemAnalysis: ItemAnalysis = {
        stock: item,
        valueTry: valTry,
        valueUsd: valUsd,
        unitPriceWithVat,
        isCritical,
        isOutOfStock,
        isDead,
        daysSinceLastOut,
        daysSinceLastTx,
        lastOutDate,
        lastTxDate,
        outCount
      }

      if (isDead) allDeadItems.push(itemAnalysis)
      if (isCritical || isOutOfStock) allCriticalItems.push(itemAnalysis)

      if (!catMap.has(cat)) catMap.set(cat, { subMap: new Map(), items: [] })
      const catObj = catMap.get(cat)!
      catObj.items.push(itemAnalysis)

      if (!catObj.subMap.has(subCat)) catObj.subMap.set(subCat, [])
      catObj.subMap.get(subCat)!.push(itemAnalysis)
    })

    const categoriesList: CatAnalysis[] = []

    let colorIdx = 0
    catMap.forEach((catObj, catName) => {
      const color = CATEGORY_ACCENT_COLORS[colorIdx % CATEGORY_ACCENT_COLORS.length]
      colorIdx++

      const subCategories: SubCatAnalysis[] = []
      let catValueTry = 0
      let catValueUsd = 0
      let catQty = 0
      let catCritical = 0
      let catOutOfStock = 0
      let catDead = 0
      let catDeadValTry = 0

      catObj.subMap.forEach((subItems, subName) => {
        let subValTry = 0
        let subValUsd = 0
        let subQty = 0
        let subCritical = 0
        let subOutOfStock = 0
        let subDead = 0
        let subDeadValTry = 0

        subItems.forEach(it => {
          subValTry += it.valueTry
          subValUsd += it.valueUsd
          subQty += it.stock.quantity
          if (it.isCritical) subCritical++
          if (it.isOutOfStock) subOutOfStock++
          if (it.isDead) {
            subDead++
            subDeadValTry += it.valueTry
          }
        })

        catValueTry += subValTry
        catValueUsd += subValUsd
        catQty += subQty
        catCritical += subCritical
        catOutOfStock += subOutOfStock
        catDead += subDead
        catDeadValTry += subDeadValTry

        subCategories.push({
          name: subName,
          skuCount: subItems.length,
          totalQty: subQty,
          totalValueTry: subValTry,
          totalValueUsd: subValUsd,
          criticalCount: subCritical,
          outOfStockCount: subOutOfStock,
          deadCount: subDead,
          deadValueTry: subDeadValTry,
          deadValueUsd: getUsdEquivalent(subDeadValTry),
          items: subItems.sort((a, b) => b.valueTry - a.valueTry)
        })
      })

      subCategories.sort((a, b) => b.totalValueTry - a.totalValueTry)
      const percent = totalWarehouseTry > 0 ? (catValueTry / totalWarehouseTry) * 100 : 0

      categoriesList.push({
        name: catName,
        color,
        skuCount: catObj.items.length,
        totalQty: catQty,
        totalValueTry: catValueTry,
        totalValueUsd: catValueUsd,
        percentOfTotal: percent,
        criticalCount: catCritical,
        outOfStockCount: catOutOfStock,
        deadCount: catDead,
        deadValueTry: catDeadValTry,
        deadValueUsd: getUsdEquivalent(catDeadValTry),
        subCategories,
        items: catObj.items.sort((a, b) => b.valueTry - a.valueTry)
      })
    })

    categoriesList.sort((a, b) => b.totalValueTry - a.totalValueTry)
    allDeadItems.sort((a, b) => b.valueTry - a.valueTry)
    allCriticalItems.sort((a, b) => {
      if (a.isOutOfStock && !b.isOutOfStock) return -1
      if (!a.isOutOfStock && b.isOutOfStock) return 1
      return b.valueTry - a.valueTry
    })

    return {
      totalWarehouseTry,
      totalWarehouseUsd,
      totalWarehouseQty,
      totalWarehouseSkus,
      totalCriticalCount,
      totalOutOfStockCount,
      totalDeadCount,
      totalDeadValTry,
      totalDeadValUsd: getUsdEquivalent(totalDeadValTry),
      deadPercentage: totalWarehouseTry > 0 ? (totalDeadValTry / totalWarehouseTry) * 100 : 0,
      categoriesList,
      allDeadItems,
      allCriticalItems
    }
  }, [warehouseStocks, stockTxStatsMap, deadStockDays, rates])

  function openStockFromAnalytics(stockId: string) {
    setSelectedStockId(stockId)
    setRightPanelMode('product')
  }

  function filterLeftListFromAnalytics(catName?: string, subCatName?: string) {
    if (catName) setSelectedFilterCategories([catName])
    if (subCatName) setSelectedFilterSubCategories([subCatName])
    else setSelectedFilterSubCategories([])
    toast.success(`Sol liste "${subCatName || catName}" olarak filtrelendi.`)
  }

  function toggleAnalyticsCat(catName: string) {
    setExpandedAnalyticsCats(prev => ({ ...prev, [catName]: !prev[catName] }))
  }

  // =========================================================================================
  // --- MUTLAK HESAPLAMA MOTORU (ABSOLUTE LEDGER RECALCULATOR) ---
  // =========================================================================================
  async function recalculateAbsoluteStock(stockId: string) {
    const res = await recalculateStockLedger(supabase, stockId, rates)
    await syncCompositeStockPrices(stockId)
    return res
  }

  // Reçeteli Ürün Maliyet Senkronizasyonu (Dinamik Canlı Maliyet)
  async function syncCompositeStockPrices(updatedStockId?: string, stockPool?: StockItem[]) {
    try {
      const pool = stockPool || allStocks
      if (!pool || pool.length === 0) return

      // Reçetesi olan tüm kompozit ürünleri bul
      const composites = pool.filter(s => s.is_composite && Array.isArray(s.recipe_components) && s.recipe_components.length > 0)
      if (composites.length === 0) return

      for (const compProd of composites) {
        // Eğer belirli bir bileşen parçası güncellendiyse, sadece bu parçayı kullanan reçeteleri güncelle
        if (updatedStockId && !compProd.recipe_components!.some(c => c.stock_id === updatedStockId)) {
          continue
        }

        const calc = calculateCompositeCost(
          compProd.recipe_components!,
          compProd.recipe_additional_cost || 0,
          pool,
          compProd.currency || 'TRY',
          rates
        )

        const diff = Math.abs((compProd.unit_price || 0) - calc.totalCost)
        if (diff > 0.01) {
          // Supabase'de güncelle
          await supabase
            .from('stocks')
            .update({ unit_price: calc.totalCost })
            .eq('id', compProd.id)

          // State'i güncelle
          setAllStocks(prev => prev.map(s => s.id === compProd.id ? { ...s, unit_price: calc.totalCost } : s))
        }
      }
    } catch (err) {
      console.error('syncCompositeStockPrices hatası:', err)
    }
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

    // ctcmarket.com Web Validasyonu
    if (webVisible) {
      const pWebPrice = parseFloat(webPrice)
      if (!webPrice || isNaN(pWebPrice) || pWebPrice <= 0) {
        toast.error('Webte gösterilen ürünlerin web satış fiyatı 0\'dan büyük olmalıdır.')
        return
      }
      if (!webCategory) {
        toast.error('Webte gösterilen ürünler için Web Ana Kategorisi seçilmesi zorunludur.')
        return
      }
    }

    const parsedWebPrice = webPrice && !isNaN(parseFloat(webPrice)) ? parseFloat(webPrice) : null
    const webFields = {
      web_visible: webVisible,
      web_category: webCategory || null,
      web_sub_category: webSubCategory || null,
      web_price: parsedWebPrice,
      web_currency: webCurrency || 'TRY',
      web_updated_at: new Date().toISOString()
    }

    try {
      if (editingStockId) {
        const payload = {
          warehouse_id: selectedWarehouseId,
          name,
          sku: sku || null,
          category: category || null,
          sub_category: subCategory || null,
          currency,
          unit,
          unit_price: priceNum,
          vat_rate: vatNum,
          stock_color: stockColor,
          ...webFields
        }
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
        const payload = {
          warehouse_id: selectedWarehouseId,
          name,
          sku: sku || null,
          category: category || null,
          sub_category: subCategory || null,
          currency,
          unit,
          quantity: 0,
          unit_price: priceNum,
          vat_rate: vatNum,
          stock_color: stockColor,
          ...webFields
        }
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

  // --- TOPLU İŞLEM YÖNETİMİ (ctcmarket.com & Stoklar) ---
  function toggleSelectStock(id: string) {
    setSelectedStockIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function handleSelectAllCurrent(items: StockItem[]) {
    const ids = items.map(it => it.id)
    const isAllSelected = ids.every(id => selectedStockIds.includes(id))
    if (isAllSelected) {
      setSelectedStockIds(prev => prev.filter(id => !ids.includes(id)))
    } else {
      setSelectedStockIds(prev => Array.from(new Set([...prev, ...ids])))
    }
  }

  async function handleBatchSetWebVisible() {
    if (selectedStockIds.length === 0) return
    const targetStocks = allStocks.filter(s => selectedStockIds.includes(s.id))
    const missingRequirement = targetStocks.filter(s => !s.web_category || !s.web_price || s.web_price <= 0)

    if (missingRequirement.length > 0) {
      toast.error(`Seçilen ${selectedStockIds.length} üründen ${missingRequirement.length} tanesinde Web Kategorisi veya Web Fiyatı tanımlı değil. Webte gösterilmek için her ikisi de zorunludur.`)
      return
    }

    setBatchLoading(true)
    try {
      const nowIso = new Date().toISOString()
      const { error } = await supabase
        .from('stocks')
        .update({ web_visible: true, web_updated_at: nowIso })
        .in('id', selectedStockIds)

      if (error) throw error
      toast.success(`${selectedStockIds.length} ürün ctcmarket.com'da yayına alındı.`)
      setSelectedStockIds([])
      fetchAllStocks()
    } catch (err: any) {
      toast.error('Toplu güncelleme başarısız: ' + err.message)
    } finally {
      setBatchLoading(false)
    }
  }

  async function handleBatchSetWebHidden() {
    if (selectedStockIds.length === 0) return
    setBatchLoading(true)
    try {
      const nowIso = new Date().toISOString()
      const { error } = await supabase
        .from('stocks')
        .update({ web_visible: false, web_updated_at: nowIso })
        .in('id', selectedStockIds)

      if (error) throw error
      toast.success(`${selectedStockIds.length} ürün ctcmarket.com'da gizlendi.`)
      setSelectedStockIds([])
      fetchAllStocks()
    } catch (err: any) {
      toast.error('Toplu gizleme başarısız: ' + err.message)
    } finally {
      setBatchLoading(false)
    }
  }

  async function handleApplyBatchCategory() {
    if (!batchSelectedWebCategory) {
      toast.error('Lütfen bir Web Ana Kategorisi seçin.')
      return
    }
    setBatchLoading(true)
    try {
      const nowIso = new Date().toISOString()
      const { error } = await supabase
        .from('stocks')
        .update({
          web_category: batchSelectedWebCategory,
          web_sub_category: batchSelectedWebSubCategory || null,
          web_updated_at: nowIso
        })
        .in('id', selectedStockIds)

      if (error) throw error
      toast.success(`${selectedStockIds.length} ürüne web kategorisi atandı.`)
      setIsBatchCategoryModalOpen(false)
      setSelectedStockIds([])
      fetchAllStocks()
    } catch (err: any) {
      toast.error('Toplu kategori atama başarısız: ' + err.message)
    } finally {
      setBatchLoading(false)
    }
  }

  async function handleApplyBatchPrice() {
    const pct = parseFloat(batchProfitPercent)
    if (isNaN(pct) || pct < 0) {
      toast.error('Geçerli bir kâr yüzdesi girin.')
      return
    }
    setBatchLoading(true)
    try {
      const nowIso = new Date().toISOString()
      const targetStocks = allStocks.filter(s => selectedStockIds.includes(s.id))
      for (const s of targetStocks) {
        const uPrice = Number(s.unit_price || 0)
        const newPrice = Math.round((uPrice * (1 + pct / 100)) * 100) / 100
        await supabase
          .from('stocks')
          .update({
            web_price: newPrice,
            web_currency: s.currency || 'TRY',
            web_updated_at: nowIso
          })
          .eq('id', s.id)
      }
      toast.success(`${targetStocks.length} ürünün web satış fiyatı güncellendi (%${pct} kâr).`)
      setIsBatchPriceModalOpen(false)
      setSelectedStockIds([])
      fetchAllStocks()
    } catch (err: any) {
      toast.error('Toplu fiyat belirleme başarısız: ' + err.message)
    } finally {
      setBatchLoading(false)
    }
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
    const desc = t.description || ''
    if (desc.includes('/ Alım') || desc.includes('Fatura / Alım')) {
      toast.error('Bu hareket Satıcı Alım Faturası kaynaklıdır. Miktar veya birim fiyat düzenlemesini Satıcılar sayfasındaki faturadan yapınız.')
      return
    }
    if (desc.includes('/ Satış') || desc.includes('Fatura / Satış')) {
      toast.error('Bu hareket Müşteri Satış Faturası kaynaklıdır. Düzenlemeyi Müşteriler sayfasındaki faturadan yapınız.')
      return
    }
    if (desc.includes('POS-') || desc.includes('Z-Raporu') || desc.includes('Mağaza Satışı') || desc.includes('Müşteri Ürün İadesi')) {
      toast.error('Bu hareket Mağaza POS Z-Raporu kaynaklıdır. Düzenlemeyi Mağaza Satış sayfasından yapınız.')
      return
    }
    if (desc.includes('Servis Parça Çıkışı') || desc.includes('SRV-')) {
      toast.error('Bu hareket Teknik Servis fişi kaynaklıdır. Düzenlemeyi Teknik Servis sayfasından ilgili fiş üzerinden yapınız.')
      return
    }
    if (desc.includes('[TRF-')) {
      toast.error('Bu hareket depolar arası transfere bağlıdır. Tek taraflı düzenlenemez; gerekirse hareketi silip transferi yeniden oluşturabilirsiniz.')
      return
    }

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

      // Mutlak miktar ve son alış fiyatını otomatik senkronize et
      await recalculateAbsoluteStock(selectedStockId)

      cancelEditTx()
      fetchTransactions(selectedStockId); fetchAllStocks()
    } catch (err: any) { toast.error('İşlem kaydedilemedi: ' + err.message) }
  }

  async function executeDeleteTransaction(txId: string) {
    try {
      const oldTx = transactions.find(t => t.id === txId)
      await supabase.from('stock_transactions').delete().eq('id', txId)

      if (selectedStockId) {
        await recalculateAbsoluteStock(selectedStockId)
      }

      await logActivity('stock_tx', 'DELETE', `Stok hareketi iptal edildi: ${oldTx?.description}`, txId, oldTx?.unit_price, oldTx?.currency || '', { ...oldTx }, null, oldTx?.company_id)

      toast.success('İşlem silindi ve stok başarıyla güncellendi.')
      if (selectedStockId) fetchTransactions(selectedStockId)
      fetchAllStocks()
    } catch (err: any) { toast.error('Silme başarısız: ' + err.message) }
  }

  async function handleDeleteTransaction(txId: string, qty: number, type: 'in' | 'out', desc?: string) {
    const txToDelete = transactions.find(t => t.id === txId)
    const txDesc = desc || txToDelete?.description || ''

    // Çapraz modül kontrolü
    let isExternal = false
    let externalModule = ''
    let isOrphan = false

    // 1. Satıcı / Alım Faturası Kontrolü
    if (txDesc.includes('/ Alım') || txDesc.includes('Fatura / Alım')) {
      isExternal = true
      externalModule = 'Satıcı Alım Faturası'
      const { data: suppInvoices } = await supabase
        .from('supplier_transactions')
        .select('id, description, tx_date, invoice_lines')
        .eq('is_detailed', true)

      const linked = suppInvoices?.find(inv =>
        Array.isArray(inv.invoice_lines) && inv.invoice_lines.some((l: any) => l.stockTxId === txId)
      )
      if (linked) {
        toast.error(`Bu stok hareketi Satıcı Alım Faturasına (${linked.description || 'Fatura'} - ${linked.tx_date}) bağlıdır. Faturayı Satıcılar sayfasından düzenleyebilir veya silebilirsiniz.`)
        return
      } else {
        isOrphan = true
      }
    }
    // 2. Müşteri / Satış Faturası Kontrolü
    else if (txDesc.includes('/ Satış') || txDesc.includes('Fatura / Satış')) {
      isExternal = true
      externalModule = 'Müşteri Satış Faturası'
      const { data: custInvoices } = await supabase
        .from('customer_transactions')
        .select('id, description, tx_date, invoice_lines')
        .eq('is_detailed', true)

      const linked = custInvoices?.find(inv =>
        Array.isArray(inv.invoice_lines) && inv.invoice_lines.some((l: any) => l.stockTxId === txId)
      )
      if (linked) {
        toast.error(`Bu stok hareketi Müşteri Satış Faturasına (${linked.description || 'Fatura'} - ${linked.tx_date}) bağlıdır. Faturayı Müşteriler sayfasından düzenleyebilir veya silebilirsiniz.`)
        return
      } else {
        isOrphan = true
      }
    }
    // 3. Mağaza POS Z-Raporu / İade Kontrolü
    else if (txDesc.includes('POS-') || txDesc.includes('Z-Raporu') || txDesc.includes('Mağaza Satışı') || txDesc.includes('Müşteri Ürün İadesi')) {
      toast.error('Bu stok hareketi Mağaza POS modülünden otomatik yansımıştır. Lütfen işlemi Mağaza sayfasındaki Z-Raporu veya İade ekranından yönetin.')
      return
    }
    // 4. Teknik Servis Parça Çıkışı Kontrolü
    else if (txDesc.includes('Servis Parça Çıkışı') || txDesc.includes('SRV-')) {
      isExternal = true
      externalModule = 'Teknik Servis Fişi'
      const match = txDesc.match(/SRV-\d{2}-\d+/)
      const ticketNo = match ? match[0] : null
      if (ticketNo) {
        const { data: srvTicket } = await supabase
          .from('technical_service_tickets')
          .select('id, ticket_no, brand_model')
          .eq('ticket_no', ticketNo)
          .maybeSingle()
        if (srvTicket) {
          toast.error(`Bu stok hareketi ${srvTicket.ticket_no} numaralı Teknik Servis fişine bağlıdır. Lütfen işlemi Teknik Servis sayfasından ilgili fişi düzenleyerek yönetin.`)
          return
        } else {
          isOrphan = true
        }
      }
    }
    // 5. Depolar Arası Transfer Kontrolü
    const trfMatch = txDesc.match(/\[(TRF-[A-Z0-9]+)\]/)
    if (trfMatch) {
      const trfTag = trfMatch[1]
      setConfirmDialog({
        isOpen: true,
        title: 'Depolar Arası Transferi İptal Et',
        message: `Bu hareket [${trfTag}] transferine aittir. Silindiğinde hem kaynak depodaki çıkış hem de hedef depodaki giriş hareketi silinecek ve her iki depodaki stok miktarları eski haline getirilecektir. Devam etmek istiyor musunuz?`,
        confirmText: 'Evet, Transferi İptal Et',
        cancelText: 'Vazgeç',
        isDanger: true,
        onConfirm: async () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }))
          try {
            const { data: matchedTxs, error: findErr } = await supabase
              .from('stock_transactions')
              .select('id, stock_id, description, unit_price, currency, company_id')
              .ilike('description', `%[${trfTag}]%`)

            if (findErr) throw findErr

            if (matchedTxs && matchedTxs.length > 0) {
              const stockIdsToRecalc = Array.from(new Set(matchedTxs.map(t => t.stock_id)))

              const { error: delErr } = await supabase
                .from('stock_transactions')
                .delete()
                .in('id', matchedTxs.map(t => t.id))

              if (delErr) throw delErr

              for (const sId of stockIdsToRecalc) {
                await recalculateAbsoluteStock(sId)
              }

              await logActivity(
                'stock_tx',
                'DELETE',
                `Depolar arası transfer iptal edildi: [${trfTag}]`,
                txId,
                undefined,
                undefined,
                { deletedTxs: matchedTxs },
                null
              )

              toast.success(`Transfer [${trfTag}] başarıyla iptal edildi ve stoklar eski haline getirildi.`)
              if (selectedStockId) fetchTransactions(selectedStockId)
              fetchAllStocks()
              fetchAllTransactions()
            }
          } catch (err: any) {
            toast.error('Transfer silme başarısız: ' + (err.message || 'Bilinmeyen hata'))
          }
        }
      })
      return
    }

    // 6. Montaj / Reçeteli Üretim Hareketi Kontrolü ([ASM-XXXXXX])
    const asmMatch = txDesc.match(/\[(ASM-[A-Z0-9]+)\]/)
    if (asmMatch) {
      const asmTag = asmMatch[1]
      setConfirmDialog({
        isOpen: true,
        title: 'Montaj / Üretimi İptal Et',
        message: `Bu hareket [${asmTag}] montaj kaydına aittir. Silindiğinde hem üretilen ürünün giriş hareketi hem de kullanılan bileşenlerin çıkış hareketleri silinecek ve parçalar depoya geri iade edilecektir. Devam etmek istiyor musunuz?`,
        confirmText: 'Evet, Montajı İptal Et ve Parçaları İade Al',
        cancelText: 'Vazgeç',
        isDanger: true,
        onConfirm: async () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }))
          try {
            const { data: matchedTxs, error: findErr } = await supabase
              .from('stock_transactions')
              .select('id, stock_id, description, quantity, tx_type')
              .ilike('description', `%[${asmTag}]%`)

            if (findErr) throw findErr

            if (matchedTxs && matchedTxs.length > 0) {
              const stockIdsToRecalc = Array.from(new Set(matchedTxs.map(t => t.stock_id)))

              const { error: delErr } = await supabase
                .from('stock_transactions')
                .delete()
                .in('id', matchedTxs.map(t => t.id))

              if (delErr) throw delErr

              for (const sId of stockIdsToRecalc) {
                await recalculateStockLedger(supabase, sId, rates)
              }

              await logActivity(
                'stock_tx',
                'DELETE',
                `Montaj üretimi iptal edildi: [${asmTag}]`,
                txId,
                undefined,
                undefined,
                { deletedTxs: matchedTxs },
                null
              )

              toast.success(`[${asmTag}] montajı başarıyla iptal edildi ve parçalar depoya geri iade edildi.`)
              if (selectedStockId) fetchTransactions(selectedStockId)
              fetchAllStocks()
              fetchAllTransactions()
            }
          } catch (err: any) {
            toast.error('Montaj iptali başarısız: ' + (err.message || 'Bilinmeyen hata'))
          }
        }
      })
      return
    }

    if (isExternal && isOrphan) {
      setConfirmDialog({
        isOpen: true,
        title: 'Yetim Stok Hareketini Sil',
        message: `DİKKAT: Bu stok hareketinin bağlı olduğu kaynak (${externalModule}) sistemde bulunamadı (Yetim Kayıt). Bu kaydı silip stoğu düzeltmek istiyor musunuz?`,
        confirmText: 'Evet, Yetim Kaydı Sil',
        cancelText: 'Vazgeç',
        isDanger: true,
        onConfirm: () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }))
          executeDeleteTransaction(txId)
        }
      })
      return
    }

    setConfirmDialog({
      isOpen: true,
      title: 'İşlemi Sil',
      message: 'Bu stok hareketini silmek istediğinize emin misiniz? İşlem miktarı stoka iade edilecek ve son alış maliyeti otomatik güncellenecektir.',
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      isDanger: true,
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        executeDeleteTransaction(txId)
      }
    })
  }

  function openAddWh() { 
    setEditingWhId(null); 
    setWhName(''); 
    setWhColor(WAREHOUSE_THEMES[0].value); 
    const defaultComp = (selectedCompanyId !== 'all' && selectedCompanyId !== 'multiple') ? selectedCompanyId : 'common';
    setWhCompanyId(defaultComp); 
    setIsWarehouseModalOpen(true);
  }

  function openEditWh(wh: Warehouse, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingWhId(wh.id); setWhName(wh.name); setWhColor(wh.color ? getWarehouseTheme(wh.color).value : WAREHOUSE_THEMES[0].value); setWhCompanyId(wh.company_id || 'common'); setIsWarehouseModalOpen(true)
  }

  // Model 3: Depolar Arası Transfer Yardımcı Değerleri
  const sourceStock = useMemo(() => allStocks.find(s => s.id === trfStockId), [allStocks, trfStockId])
  const sourceWarehouse = useMemo(() => warehouses.find(w => w.id === trfSourceWarehouseId), [warehouses, trfSourceWarehouseId])
  const targetWarehouse = useMemo(() => warehouses.find(w => w.id === trfTargetWarehouseId), [warehouses, trfTargetWarehouseId])
  const sourceCost = sourceStock?.unit_price || 0
  const inputTransferPrice = parseFloat(trfUnitPrice.replace(',', '.')) || 0
  const priceDiff = inputTransferPrice - sourceCost
  const profitMarginPercent = sourceCost > 0 ? ((inputTransferPrice - sourceCost) / sourceCost) * 100 : 0

  const sourceWarehouseStocks = useMemo(() => {
    return allStocks.filter(s => s.warehouse_id === trfSourceWarehouseId)
  }, [allStocks, trfSourceWarehouseId])

  const filteredTransferStocks = useMemo(() => {
    if (!trfSearchTerm.trim()) return sourceWarehouseStocks
    const term = trfSearchTerm.toLocaleLowerCase('tr-TR').trim()
    return sourceWarehouseStocks.filter(s =>
      s.name.toLocaleLowerCase('tr-TR').includes(term) ||
      (s.sku && s.sku.toLocaleLowerCase('tr-TR').includes(term)) ||
      (s.category && s.category.toLocaleLowerCase('tr-TR').includes(term))
    )
  }, [sourceWarehouseStocks, trfSearchTerm])

  function openTransferModal(preselectedStock?: StockItem) {
    const srcWhId = preselectedStock?.warehouse_id || selectedWarehouseId || (warehouses[0]?.id || '')
    setTrfSourceWarehouseId(srcWhId)

    const targetCandidate = warehouses.find(w => w.id !== srcWhId)?.id || ''
    setTrfTargetWarehouseId(targetCandidate)

    if (preselectedStock) {
      setTrfStockId(preselectedStock.id)
      setTrfQuantity('1')
      setTrfUnitPrice(preselectedStock.unit_price?.toString() || '0')
      setTrfCurrency(preselectedStock.currency || 'TRY')
      setTrfSearchTerm(preselectedStock.name)
    } else {
      const availableStocksInWh = allStocks.filter(s => s.warehouse_id === srcWhId && s.quantity > 0)
      const firstStk = availableStocksInWh[0] || allStocks.find(s => s.warehouse_id === srcWhId)
      if (firstStk) {
        setTrfStockId(firstStk.id)
        setTrfQuantity('1')
        setTrfUnitPrice(firstStk.unit_price?.toString() || '0')
        setTrfCurrency(firstStk.currency || 'TRY')
        setTrfSearchTerm(firstStk.name)
      } else {
        setTrfStockId('')
        setTrfQuantity('')
        setTrfUnitPrice('')
        setTrfCurrency('TRY')
        setTrfSearchTerm('')
      }
    }

    setTrfDate(getLocalTodayISO())
    setTrfNote('')
    setTrfRecordProfit(true)
    setIsTrfDropdownOpen(false)
    setIsTransferModalOpen(true)
  }

  function handleTrfSourceWarehouseChange(newWhId: string) {
    setTrfSourceWarehouseId(newWhId)
    if (trfTargetWarehouseId === newWhId) {
      const otherWh = warehouses.find(w => w.id !== newWhId)?.id || ''
      setTrfTargetWarehouseId(otherWh)
    }
    const firstStk = allStocks.find(s => s.warehouse_id === newWhId && s.quantity > 0) || allStocks.find(s => s.warehouse_id === newWhId)
    if (firstStk) {
      setTrfStockId(firstStk.id)
      setTrfUnitPrice(firstStk.unit_price?.toString() || '0')
      setTrfCurrency(firstStk.currency || 'TRY')
      setTrfSearchTerm(firstStk.name)
    } else {
      setTrfStockId('')
      setTrfUnitPrice('')
      setTrfSearchTerm('')
    }
    setIsTrfDropdownOpen(false)
  }

  function handleTrfStockChange(stockId: string) {
    setTrfStockId(stockId)
    const stk = allStocks.find(s => s.id === stockId)
    if (stk) {
      setTrfUnitPrice(stk.unit_price?.toString() || '0')
      setTrfCurrency(stk.currency || 'TRY')
      setTrfSearchTerm(stk.name)
    }
  }

  async function handleExecuteTransfer(e: React.FormEvent) {
    e.preventDefault()
    if (!trfSourceWarehouseId || !trfTargetWarehouseId) {
      toast.error('Lütfen kaynak ve hedef depoyu seçin.')
      return
    }
    if (trfSourceWarehouseId === trfTargetWarehouseId) {
      toast.error('Kaynak ve hedef depo aynı olamaz.')
      return
    }
    if (!sourceStock) {
      toast.error('Lütfen transfer edilecek ürünü seçin.')
      return
    }
    const transferQty = parseFloat(trfQuantity.replace(',', '.'))
    if (isNaN(transferQty) || transferQty <= 0) {
      toast.error('Geçerli bir transfer miktarı girin.')
      return
    }
    if (transferQty > (sourceStock.quantity || 0)) {
      toast.error(`Yetersiz stok! Kaynak depoda mevcut: ${sourceStock.quantity} ${sourceStock.unit || 'Adet'}`)
      return
    }
    const unitPriceNum = parseFloat(trfUnitPrice.replace(',', '.'))
    if (isNaN(unitPriceNum) || unitPriceNum < 0) {
      toast.error('Geçerli bir birim fiyat girin.')
      return
    }

    setTrfLoading(true)
    try {
      const transferTag = `TRF-${Date.now().toString().slice(-6)}`
      const srcWhName = sourceWarehouse?.name || 'Kaynak Depo'
      const tgtWhName = targetWarehouse?.name || 'Hedef Depo'

      // Hedef depoda aynı ürün var mı kontrol et (SKU veya İsim eşleşmesi)
      let targetStockId: string | null = null
      const targetExisting = allStocks.find(s =>
        s.warehouse_id === trfTargetWarehouseId && (
          (sourceStock.sku && s.sku && s.sku.trim().toLowerCase() === sourceStock.sku.trim().toLowerCase()) ||
          (s.name.trim().toLowerCase() === sourceStock.name.trim().toLowerCase())
        )
      )

      if (targetExisting) {
        targetStockId = targetExisting.id
      } else {
        const newStockPayload = {
          warehouse_id: trfTargetWarehouseId,
          name: sourceStock.name,
          sku: sourceStock.sku || '',
          category: sourceStock.category || '',
          sub_category: sourceStock.sub_category || '',
          unit: sourceStock.unit || 'Adet',
          currency: trfCurrency,
          unit_price: unitPriceNum,
          vat_rate: sourceStock.vat_rate || 0,
          stock_color: sourceStock.stock_color || THEME_COLORS[0].value,
          quantity: 0,
          web_visible: false,
          web_price: null,
          web_currency: 'TRY'
        }
        const { data: createdStk, error: createStkErr } = await supabase
          .from('stocks')
          .insert(newStockPayload)
          .select('id')
          .single()

        if (createStkErr) throw createStkErr
        targetStockId = createdStk.id
      }

      if (!targetStockId) {
        throw new Error('Hedef stok kartı oluşturulamadı veya bulunamadı.')
      }

      const userNoteStr = trfNote.trim() ? ` - Not: ${trfNote.trim()}` : ''
      const hasMarkup = unitPriceNum !== sourceCost
      const profitPercentFormatted = profitMarginPercent.toFixed(1)

      let srcDescription = ''
      if (hasMarkup && trfRecordProfit) {
        srcDescription = `[${transferTag}] Depo Transfer Satışı -> ${tgtWhName} (B.Mlyt: ${sourceCost} ${sourceStock.currency || 'TRY'}, B.Transfer: ${unitPriceNum} ${trfCurrency}, Kâr: %${profitPercentFormatted})${userNoteStr}`
      } else {
        srcDescription = `[${transferTag}] Depo Transferi -> ${tgtWhName}${userNoteStr}`
      }

      const tgtDescription = `[${transferTag}] Depo Transfer Girişi <- ${srcWhName} (Transfer B.Fiyat: ${unitPriceNum} ${trfCurrency})${userNoteStr}`

      // Kaynak depodan OUT çıkışı (kaynak birim maliyetiyle)
      const { error: outTxErr } = await supabase
        .from('stock_transactions')
        .insert({
          stock_id: sourceStock.id,
          tx_date: trfDate,
          description: srcDescription,
          tx_type: 'out',
          quantity: transferQty,
          unit_price: sourceCost,
          currency: sourceStock.currency || 'TRY',
          vat_rate: sourceStock.vat_rate || 0,
          company_id: sourceWarehouse?.company_id || null
        })

      if (outTxErr) throw outTxErr

      // Hedef depoya IN girişi (yeni transfer birim fiyatıyla)
      const { error: inTxErr } = await supabase
        .from('stock_transactions')
        .insert({
          stock_id: targetStockId,
          tx_date: trfDate,
          description: tgtDescription,
          tx_type: 'in',
          quantity: transferQty,
          unit_price: unitPriceNum,
          currency: trfCurrency,
          vat_rate: sourceStock.vat_rate || 0,
          company_id: targetWarehouse?.company_id || null
        })

      if (inTxErr) throw inTxErr

      // Her iki depodaki stok kartının mutlak stoğunu yeniden hesapla
      await recalculateAbsoluteStock(sourceStock.id)
      await recalculateAbsoluteStock(targetStockId)

      // Audit Log
      await logActivity(
        'stock_tx',
        'INSERT',
        `Depolar arası ürün transferi yapıldı: [${transferTag}] ${sourceStock.name} (${transferQty} ${sourceStock.unit || 'Adet'}) | ${srcWhName} -> ${tgtWhName}`,
        undefined,
        unitPriceNum * transferQty,
        trfCurrency,
        null,
        {
          transferTag,
          sourceWarehouse: srcWhName,
          targetWarehouse: tgtWhName,
          stockName: sourceStock.name,
          quantity: transferQty,
          sourceCost,
          transferUnitPrice: unitPriceNum,
          recordProfit: trfRecordProfit
        },
        sourceWarehouse?.company_id || null
      )

      toast.success(`Transfer [${transferTag}] başarıyla gerçekleştirildi!`)
      setIsTransferModalOpen(false)

      await fetchAllStocks()
      await fetchAllTransactions()
      if (selectedStockId) {
        await fetchTransactions(selectedStockId)
      }
    } catch (err: any) {
      console.error('Transfer hatası:', err)
      toast.error('Transfer gerçekleştirilemedi: ' + (err.message || 'Bilinmeyen hata'))
    } finally {
      setTrfLoading(false)
    }
  }

  // =========================================================================
  // --- REÇETELİ ÜRÜN & MONTAJ İŞLEMLERİ (MODEL C) ---
  // =========================================================================
  function openRecipeModal(stock?: StockItem) {
    if (stock) {
      setRecipeStock(stock)
      setRecipeProductName(stock.name)
      setRecipeProductWarehouseId(stock.warehouse_id)
      setRecipeProductCategory(stock.category || 'Tabela & Montaj')
      setRecipeProductSubCategory(stock.sub_category || '')
      setRecipeProductSku(stock.sku || '')
      setRecipeProductCurrency((stock.currency as any) || 'TRY')
      setRecipeProductUnit(stock.unit || 'Adet')
      setRecipeIsComposite(stock.is_composite ?? true)
      setRecipeComponents(Array.isArray(stock.recipe_components) ? [...stock.recipe_components] : [])
      setRecipeAdditionalCost((stock.recipe_additional_cost ?? 0).toString())
    } else {
      setRecipeStock(null)
      setRecipeProductName('')
      setRecipeProductWarehouseId(selectedWarehouseId || warehouses[0]?.id || '')
      setRecipeProductCategory('Tabela & Montaj')
      setRecipeProductSubCategory('')
      setRecipeProductSku('')
      setRecipeProductCurrency('TRY')
      setRecipeProductUnit('Adet')
      setRecipeIsComposite(true)
      setRecipeComponents([])
      setRecipeAdditionalCost('0')
    }
    setRecipeSearchTerm('')
    setRecipeOpenCategories({})
    setRecipeCollapsedSubCategories({})
    setIsRecipeDropdownOpen(false)
    setIsRecipeModalOpen(true)
  }

  function addComponentToRecipe(stockItem: StockItem) {
    if (recipeComponents.some(c => c.stock_id === stockItem.id)) {
      toast.error('Bu parça reçetede zaten ekli.')
      return
    }
    const newComponent: RecipeComponent = {
      stock_id: stockItem.id,
      name: stockItem.name,
      sku: stockItem.sku || undefined,
      quantity: 1,
      unit: stockItem.unit || 'Adet'
    }
    setRecipeComponents(prev => [...prev, newComponent])
    setRecipeSearchTerm('')
    setIsRecipeDropdownOpen(false)
  }

  function updateComponentQuantity(stockId: string, qty: number) {
    setRecipeComponents(prev => prev.map(c => c.stock_id === stockId ? { ...c, quantity: Math.max(0.001, qty) } : c))
  }

  function removeComponentFromRecipe(stockId: string) {
    setRecipeComponents(prev => prev.filter(c => c.stock_id !== stockId))
  }

  const recipeCandidateStocks = useMemo(() => {
    const targetWhId = recipeStock ? recipeStock.warehouse_id : (recipeProductWarehouseId || selectedWarehouseId)
    // Ürünün kendisini hariç tut (varsa), seçili depodaki stokları listele
    const pool = allStocks.filter(s => (!recipeStock || s.id !== recipeStock.id) && s.warehouse_id === targetWhId)
    if (!recipeSearchTerm.trim()) return pool
    const term = recipeSearchTerm.toLocaleLowerCase('tr-TR').trim()
    return pool.filter(s =>
      s.name.toLocaleLowerCase('tr-TR').includes(term) ||
      (s.sku && s.sku.toLocaleLowerCase('tr-TR').includes(term)) ||
      (s.category && s.category.toLocaleLowerCase('tr-TR').includes(term)) ||
      (s.sub_category && s.sub_category.toLocaleLowerCase('tr-TR').includes(term))
    )
  }, [allStocks, recipeStock, recipeProductWarehouseId, selectedWarehouseId, recipeSearchTerm])

  // Reçete Parça Seçiminde Açılır Kategorili Hiyerarşi (Stok Yönetimi ile Birebir Aynı)
  const recipeGroupedHierarchy = useMemo(() => {
    const catMap = new Map<string, Map<string, StockItem[]>>()

    recipeCandidateStocks.forEach(item => {
      const cat = (item.category || 'Kategorisiz').trim()
      const subCat = (item.sub_category || '').trim()

      if (!catMap.has(cat)) catMap.set(cat, new Map())
      const subMap = catMap.get(cat)!
      const subKey = subCat || '__NONE__'
      if (!subMap.has(subKey)) subMap.set(subKey, [])
      subMap.get(subKey)!.push(item)
    })

    const result: {
      name: string
      totalCount: number
      totalQuantity: number
      subGroups: { name: string; items: StockItem[] }[]
    }[] = []

    catMap.forEach((subMap, catName) => {
      let catTotalCount = 0
      let catTotalQty = 0
      const subGroups: { name: string; items: StockItem[] }[] = []

      subMap.forEach((items, subKey) => {
        catTotalCount += items.length
        catTotalQty += items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0)
        subGroups.push({
          name: subKey === '__NONE__' ? (subMap.size > 1 ? 'Diğer / Genel' : '') : subKey,
          items: items.sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'))
        })
      })

      subGroups.sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'))

      result.push({
        name: catName,
        totalCount: catTotalCount,
        totalQuantity: catTotalQty,
        subGroups
      })
    })

    return result.sort((a, b) => a.name.localeCompare(b.name, 'tr-TR'))
  }, [recipeCandidateStocks])

  const toggleRecipeCategory = (catName: string) => {
    setRecipeOpenCategories(prev => {
      const currentState = prev[catName] !== undefined ? prev[catName] : true
      return { ...prev, [catName]: !currentState }
    })
  }

  const toggleRecipeSubCategory = (subKey: string) => {
    setRecipeCollapsedSubCategories(prev => ({
      ...prev,
      [subKey]: !prev[subKey]
    }))
  }

  const toggleAllRecipeCategories = () => {
    const isAllOpen = recipeGroupedHierarchy.length > 0 && recipeGroupedHierarchy.every(g => recipeOpenCategories[g.name] !== false)
    if (isAllOpen) {
      const closed: Record<string, boolean> = {}
      recipeGroupedHierarchy.forEach(g => { closed[g.name] = false })
      setRecipeOpenCategories(closed)
    } else {
      const opened: Record<string, boolean> = {}
      recipeGroupedHierarchy.forEach(g => { opened[g.name] = true })
      setRecipeOpenCategories(opened)
    }
  }

  const currentRecipeCalculation = useMemo(() => {
    const curr = recipeStock ? (recipeStock.currency || 'TRY') : (recipeProductCurrency || 'TRY')
    return calculateCompositeCost(
      recipeComponents,
      parseFloat(recipeAdditionalCost) || 0,
      allStocks,
      curr,
      rates
    )
  }, [recipeStock, recipeProductCurrency, recipeComponents, recipeAdditionalCost, allStocks, rates])

  async function handleSaveRecipe() {
    const trimmedName = recipeProductName.trim()
    if (!trimmedName) {
      toast.error('Lütfen reçeteden oluşacak ürünün ismini girin.')
      return
    }
    if (recipeComponents.length === 0) {
      toast.error('Lütfen reçeteye en az bir parça ekleyin.')
      return
    }

    const addCost = parseFloat(recipeAdditionalCost) || 0
    const calculatedUnitPrice = currentRecipeCalculation.totalCost
    const effectiveCurr = recipeStock ? (recipeStock.currency || 'TRY') : (recipeProductCurrency || 'TRY')
    const targetWhId = recipeStock ? recipeStock.warehouse_id : (recipeProductWarehouseId || selectedWarehouseId || warehouses[0]?.id)

    if (!targetWhId) {
      toast.error('Lütfen geçerli bir depo seçin.')
      return
    }

    try {
      if (recipeStock) {
        // Mevcut stok kartını güncelle (ismi de güncellenebilir)
        const payload: any = {
          name: trimmedName,
          category: recipeProductCategory.trim() || recipeStock.category || 'Tabela & Montaj',
          sub_category: recipeProductSubCategory.trim() || recipeStock.sub_category || null,
          sku: recipeProductSku.trim() || recipeStock.sku || null,
          unit: recipeProductUnit || recipeStock.unit || 'Adet',
          is_composite: recipeIsComposite,
          recipe_components: recipeComponents,
          recipe_additional_cost: addCost,
          unit_price: calculatedUnitPrice
        }

        let { error } = await supabase.from('stocks').update(payload).eq('id', recipeStock.id)
        if (error) {
          if (error.code === '42703' || error.message?.includes('is_composite')) {
            toast.error("Veritabanında reçete kolonları eksik. Lütfen Supabase SQL Editor'da 'supabase/migration_composite_stock_recipes.sql' dosyasını çalıştırın.")
            return
          }
          throw error
        }

        await logActivity(
          'stock',
          'UPDATE',
          `Reçete güncellendi: ${trimmedName} (Bileşen: ${recipeComponents.length} adet, Maliyet: ${formatMoney(calculatedUnitPrice, effectiveCurr).formatted})`,
          recipeStock.id,
          calculatedUnitPrice,
          effectiveCurr,
          { is_composite: recipeStock.is_composite, recipe_components: recipeStock.recipe_components, recipe_additional_cost: recipeStock.recipe_additional_cost },
          payload,
          null
        )

        toast.success(`Reçete başarıyla kaydedildi! Birim maliyet: ${formatMoney(calculatedUnitPrice, effectiveCurr).formatted}`)
        setIsRecipeModalOpen(false)
        await fetchAllStocks()
        if (selectedStockId === recipeStock.id) {
          fetchTransactions(recipeStock.id)
        }
      } else {
        // Yeni Reçeteli Stok Kartı Oluştur
        const insertPayload: any = {
          warehouse_id: targetWhId,
          name: trimmedName,
          sku: recipeProductSku.trim() || null,
          category: recipeProductCategory.trim() || 'Tabela & Montaj',
          sub_category: recipeProductSubCategory.trim() || null,
          unit: recipeProductUnit || 'Adet',
          unit_price: calculatedUnitPrice,
          currency: effectiveCurr,
          quantity: 0,
          vat_rate: 20,
          is_composite: recipeIsComposite,
          recipe_components: recipeComponents,
          recipe_additional_cost: addCost
        }

        let { data: newStock, error } = await supabase.from('stocks').insert([insertPayload]).select().single()
        if (error) {
          if (error.code === '42703' || error.message?.includes('is_composite')) {
            toast.error("Veritabanında reçete kolonları eksik. Lütfen Supabase SQL Editor'da 'supabase/migration_composite_stock_recipes.sql' dosyasını çalıştırın.")
            return
          }
          throw error
        }

        await logActivity(
          'stock',
          'INSERT',
          `Yeni Reçeteli Ürün Oluşturuldu: ${trimmedName} (Bileşen: ${recipeComponents.length} adet, Maliyet: ${formatMoney(calculatedUnitPrice, effectiveCurr).formatted})`,
          newStock.id,
          calculatedUnitPrice,
          effectiveCurr,
          null,
          insertPayload,
          null
        )

        toast.success(`"${trimmedName}" reçeteli ürünü başarıyla oluşturuldu! Birim maliyet: ${formatMoney(calculatedUnitPrice, effectiveCurr).formatted}`)
        setIsRecipeModalOpen(false)
        await fetchAllStocks()
        if (newStock) {
          setSelectedStockId(newStock.id)
          setRightPanelMode('product')
        }
      }
    } catch (err: any) {
      toast.error('Reçete kaydedilemedi: ' + (err.message || err))
    }
  }

  function openAssemblyModal(stock?: StockItem) {
    if (stock) {
      if (!stock.recipe_components || stock.recipe_components.length === 0) {
        toast.error('Bu ürünün tanımlı reçete bileşeni bulunmuyor. Önce reçeteyi düzenleyin.')
        return
      }
      setAssemblyStock(stock)
      setAssemblyCustomName(stock.name)
    } else {
      const targetWhId = selectedWarehouseId || (warehouses.length > 0 ? warehouses[0].id : null)
      if (!targetWhId) {
        toast.error('Lütfen önce bir depo seçin.')
        return
      }
      const targetWh = warehouses.find(w => w.id === targetWhId)
      const inCurrentWh = allStocks.filter(
        s => s.is_composite && s.recipe_components && s.recipe_components.length > 0 && s.warehouse_id === targetWhId
      )
      if (inCurrentWh.length === 0) {
        toast.error(`"${targetWh?.name || 'Seçili Depo'}" deposunda henüz tanımlı bir reçeteli ürün bulunmuyor. Önce "Reçete Oluştur" butonu ile bu depoya ait bir reçete tanımlayın.`)
        return
      }
      setAssemblyStock(inCurrentWh[0])
      setAssemblyCustomName(inCurrentWh[0].name)
    }
    setAssemblyQuantity('1')
    setAssemblyDate(getLocalTodayISO())
    setIsAssemblyModalOpen(true)
  }

  async function handleExecuteAssembly(e: React.FormEvent) {
    e.preventDefault()
    if (!assemblyStock || !assemblyStock.recipe_components || assemblyStock.recipe_components.length === 0) return
    const qty = parseFloat(assemblyQuantity)
    if (!qty || qty <= 0) {
      toast.error('Lütfen geçerli bir montaj miktarı girin.')
      return
    }

    const finalProductName = assemblyCustomName.trim() || assemblyStock.name

    setIsSubmittingAssembly(true)
    const asmId = 'ASM-' + Math.floor(100000 + Math.random() * 900000)

    try {
      // Eğer kullanıcı montaj ekranında ürün ismini değiştirdiyse stok kartını da senkronize güncelle
      if (finalProductName !== assemblyStock.name) {
        await supabase.from('stocks').update({ name: finalProductName }).eq('id', assemblyStock.id)
      }

      // 1. Her bir bileşen için çıkış hareketi ekle
      const componentTxPayloads = assemblyStock.recipe_components.map(comp => {
        const partStock = allStocks.find(s => s.id === comp.stock_id)
        const reqQty = Number(comp.quantity || 0) * qty
        return {
          stock_id: comp.stock_id,
          tx_date: assemblyDate,
          description: `[${asmId}] Montaj Çıkışı: ${finalProductName} (${qty} ${assemblyStock.unit || 'Adet'} montajı)`,
          tx_type: 'out',
          quantity: reqQty,
          unit_price: partStock?.unit_price || 0,
          currency: partStock?.currency || 'TRY',
          vat_rate: 0,
          company_id: null
        }
      })

      // 2. Üretilen reçeteli ürün için giriş hareketi ekle
      const finishedTxPayload = {
        stock_id: assemblyStock.id,
        tx_date: assemblyDate,
        description: `[${asmId}] Montaj Girişi: ${finalProductName} (${qty} ${assemblyStock.unit || 'Adet'})`,
        tx_type: 'in',
        quantity: qty,
        unit_price: assemblyStock.unit_price || 0,
        currency: assemblyStock.currency || 'TRY',
        vat_rate: 0,
        company_id: null
      }

      // Supabase'e ekle
      const { error: compErr } = await supabase.from('stock_transactions').insert(componentTxPayloads)
      if (compErr) throw compErr

      const { error: finErr } = await supabase.from('stock_transactions').insert([finishedTxPayload])
      if (finErr) throw finErr

      // 3. Mutlak stokları yeniden hesapla
      for (const comp of assemblyStock.recipe_components) {
        await recalculateAbsoluteStock(comp.stock_id)
      }
      await recalculateAbsoluteStock(assemblyStock.id)

      await logActivity(
        'stock',
        'INSERT',
        `[${asmId}] Montaj Üretimi Yapıldı: ${qty} ${assemblyStock.unit || 'Adet'} ${finalProductName}`,
        assemblyStock.id,
        assemblyStock.unit_price,
        assemblyStock.currency || 'TRY',
        null,
        { asmId, qty, finalProductName, components: componentTxPayloads },
        null
      )

      toast.success(`[${asmId}] Montaj tamamlandı! ${qty} ${assemblyStock.unit || 'Adet'} "${finalProductName}" stoğa eklendi, parçalar stoktan düşüldü.`)
      setIsAssemblyModalOpen(false)
      await fetchAllStocks()
      if (selectedStockId === assemblyStock.id) {
        fetchTransactions(assemblyStock.id)
      }
    } catch (err: any) {
      toast.error('Montaj işlemi başarısız: ' + (err.message || err))
    } finally {
      setIsSubmittingAssembly(false)
    }
  }

  function openAddStock() {
    if (!selectedWarehouseId) { toast.error('Lütfen önce bir depo seçin.'); return }
    setEditingStockId(null); setName(''); setSku(''); setCategory(''); setSubCategory(''); setIsCustomSubCat(false); setQuantity(''); setUnitPrice(''); setVatRate('20')
    setWebVisible(false); setWebCategory(''); setWebSubCategory(''); setWebPrice(''); setWebCurrency('TRY')
    setIsStockModalOpen(true)
  }

  async function openEditStock(item: StockItem, e?: React.MouseEvent) {
    if (e) e.stopPropagation()
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

    // ctcmarket.com Web Alanları
    setWebVisible(Boolean(item.web_visible))
    setWebCategory(item.web_category || '')
    setWebSubCategory(item.web_sub_category || '')
    setWebPrice(item.web_price !== null && item.web_price !== undefined ? item.web_price.toString() : '')
    setWebCurrency(item.web_currency || item.currency || 'TRY')

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

  // ctcmarket.com Sayaçları ve Web Filtresi
  const webVisibleCount = useMemo(() => warehouseStocks.filter(s => s.web_visible === true).length, [warehouseStocks])
  const webHiddenCount = useMemo(() => warehouseStocks.filter(s => s.web_visible !== true).length, [warehouseStocks])
  const webMissingCatCount = useMemo(() => warehouseStocks.filter(s => s.web_visible === true && !s.web_category).length, [warehouseStocks])
  const webMissingPriceCount = useMemo(() => warehouseStocks.filter(s => s.web_visible === true && (!s.web_price || s.web_price <= 0)).length, [warehouseStocks])

  const webFilteredStocks = useMemo(() => {
    return warehouseStocks.filter(s => {
      if (webFilter === 'visible') return s.web_visible === true
      if (webFilter === 'hidden') return s.web_visible !== true
      if (webFilter === 'missing_cat') return s.web_visible === true && !s.web_category
      if (webFilter === 'missing_price') return s.web_visible === true && (!s.web_price || s.web_price <= 0)
      return true
    })
  }, [warehouseStocks, webFilter])

  const statusFilteredStocks = webFilteredStocks.filter(s => {
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

      {/* Üst Bar: Depo Seçici & Canlı Envanter Metrikleri */}
      <div
        style={{ animation: 'fadeInDown 0.4s both' }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#0d1322] border border-slate-800/80 px-3.5 py-2 rounded-xl shadow-md shrink-0 mb-3 transition-colors"
      >
        {/* SOL: DEPO SEÇİM SEKMELERİ (Birden fazla depo için yatay kaydırma ve hızlı geçiş) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-indigo-400 shrink-0 mr-1 select-none">
            <Package size={17} />
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">Depolar:</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar flex-1">
            {companyMatchedWarehouses.length === 0 ? (
              <span className="text-[11px] text-slate-500 italic py-1 px-1">Bu merkeze tanımlı depo bulunmuyor</span>
            ) : companyMatchedWarehouses.map((wh, index) => {
              const totals = getWarehouseTotals(wh.id)
              const isSelected = selectedWarehouseId === wh.id
              const theme = getWarehouseTheme(wh.color)
              return (
                <div
                  key={wh.id}
                  onClick={() => {
                    setSelectedWarehouseId(wh.id);
                    try { localStorage.setItem('ctc_stock_selected_warehouse', wh.id); } catch { }
                  }}
                  style={{
                    animation: 'fadeInUp 0.3s both',
                    animationDelay: `${0.05 + (index * 0.04)}s`,
                    borderLeftColor: !isSelected ? theme.hex : undefined,
                  }}
                  className={`flex flex-col px-3 py-1.5 rounded-lg cursor-pointer transition-all border whitespace-nowrap group select-none shrink-0 ${isSelected
                    ? `bg-gradient-to-r ${theme.value} ${theme.border} shadow-md ${theme.glow} ring-1 ${theme.ring}`
                    : `bg-slate-900/50 border-slate-800/80 border-l-[3px] opacity-70 hover:opacity-100 hover:border-slate-700 hover:bg-slate-800/50`
                    }`}
                  title={`${wh.name} deposunu seç (${formatMoney(totals.totalTry, 'TRY').formatted})`}
                >
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? 'animate-pulse' : ''}`}
                        style={{ backgroundColor: theme.hex }}
                      />
                      {wh.company ? (
                        wh.company.is_personal
                          ? <Home size={11} className={isSelected ? theme.text : 'text-slate-400'} />
                          : <Building size={11} className={isSelected ? theme.text : 'text-slate-400'} />
                      ) : (
                        <Globe size={11} className={isSelected ? theme.text : 'text-slate-400'} />
                      )}
                      <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                        {wh.name}
                      </span>
                      {wh.company && (
                        <span className="text-[9px] text-slate-400 font-normal">({wh.company.name})</span>
                      )}
                    </div>
                    {isSelected && (
                      <div className="flex items-center gap-1 bg-black/40 px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => openEditWh(wh, e)} className="text-slate-300 hover:text-white p-0.5" title="Depoyu Düzenle"><Edit3 size={10} /></button>
                        <button onClick={(e) => handleDeleteWarehouse(wh.id, e)} className="text-slate-300 hover:text-rose-400 p-0.5" title="Depoyu Sil"><Trash2 size={10} /></button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono mt-0.5">
                    <span className={`${isSelected ? 'text-white font-bold' : 'text-slate-300'}`}>
                      {formatMoney(totals.totalTry, 'TRY').formatted}
                    </span>
                    <span className="text-slate-600 font-sans">/</span>
                    <span className={isSelected ? theme.text : 'text-slate-400'}>
                      {formatMoney(totals.totalUsd, 'USD').formatted}
                    </span>
                  </div>
                </div>
              )
            })}

            <button
              style={{ animation: 'fadeInUp 0.3s both 0.2s' }}
              onClick={openAddWh}
              className="p-1.5 px-2 rounded-lg border border-dashed border-slate-700 text-slate-400 hover:text-white hover:border-indigo-500 hover:bg-indigo-950/20 shrink-0 transition-all active:scale-95 flex items-center gap-1 text-[11px] font-medium"
              title="Yeni Depo Oluştur"
            >
              <Plus size={13} />
              <span className="text-[10px]">Depo Ekle</span>
            </button>

            {/* MODEL 3: DEPOLAR ARASI TRANSFER BUTONU */}
            <button
              type="button"
              style={{ animation: 'fadeInUp 0.3s both 0.25s' }}
              onClick={() => openTransferModal()}
              className="p-1.5 px-2.5 rounded-lg border border-cyan-500/50 text-cyan-400 bg-cyan-950/20 hover:text-white hover:border-cyan-400 hover:bg-cyan-900/30 shrink-0 transition-all active:scale-95 flex items-center gap-1.5 text-[11px] font-medium shadow-sm shadow-cyan-950/30"
              title="Depolar Arası Ürün Transferi Yap (Model 3)"
            >
              <ArrowRightLeft size={13} className="text-cyan-400" />
              <span className="text-[10px] font-semibold">⇄ Transfer Yap</span>
            </button>

            {/* MODEL C: REÇETE OLUŞTUR BUTONU (ANA SAYFADAN DOĞRUDAN ERİŞİM) */}
            <button
              type="button"
              style={{ animation: 'fadeInUp 0.3s both 0.28s' }}
              onClick={() => openRecipeModal()}
              className="p-1.5 px-2.5 rounded-lg border border-amber-500/50 text-amber-400 bg-amber-950/20 hover:text-white hover:border-amber-400 hover:bg-amber-900/30 shrink-0 transition-all active:scale-95 flex items-center gap-1.5 text-[11px] font-medium shadow-sm shadow-amber-950/30"
              title="Yeni Reçeteli Ürün Oluştur / Reçete Yönetimi (Model C)"
            >
              <Layers size={13} className="text-amber-400" />
              <span className="text-[10px] font-semibold">🧩 Reçete Oluştur</span>
            </button>

            {/* MODEL C: MONTAJ / ÜRETİM YAP BUTONU (ANA SAYFADAN DOĞRUDAN ERİŞİM) */}
            <button
              type="button"
              style={{ animation: 'fadeInUp 0.3s both 0.31s' }}
              onClick={() => openAssemblyModal()}
              className="p-1.5 px-2.5 rounded-lg border border-emerald-500/50 text-emerald-400 bg-emerald-950/20 hover:text-white hover:border-emerald-400 hover:bg-emerald-900/30 shrink-0 transition-all active:scale-95 flex items-center gap-1.5 text-[11px] font-medium shadow-sm shadow-emerald-950/30"
              title="Reçeteli Üründen Montaj / Üretim Yap ve Stoğa Al (Model C)"
            >
              <Package size={13} className="text-emerald-400" />
              <span className="text-[10px] font-semibold">🛠️ Montaj Yap</span>
            </button>
          </div>
        </div>

        {/* SAĞ: SEÇİLİ DEPO CANLI ENVANTER & SAĞLIK ÖZETİ (Tek Satır Kompakt Metrik Şeridi) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 py-0.5 border-t lg:border-t-0 lg:border-l border-slate-800/80 pt-2 lg:pt-0 lg:pl-3">
          {/* Bağlı Sermaye */}
          <div
            onClick={() => {
              setRightPanelMode('analytics')
              setAnalyticsTab('summary')
            }}
            className="flex items-center gap-2 bg-[#070b14] hover:bg-slate-800/60 border border-slate-800/90 hover:border-indigo-500/40 px-2.5 py-1 rounded-lg transition-colors cursor-pointer group select-none shrink-0"
            title="Sermaye ve Kategori Matrisini Aç"
          >
            <div className="p-1 rounded bg-indigo-500/10 text-indigo-400 group-hover:text-indigo-300">
              <Package size={13} />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[9px] text-slate-400 uppercase font-semibold leading-none">Bağlı Sermaye</span>
              <div className="text-[11px] font-bold font-mono text-white mt-0.5 leading-none">
                {formatMoney(categoryAnalytics.totalWarehouseTry, 'TRY').formatted}
                <span className="text-[9px] text-slate-400 font-normal ml-1">({formatMoney(categoryAnalytics.totalWarehouseUsd, 'USD').formatted})</span>
              </div>
            </div>
          </div>

          {/* Çeşitlilik & Miktar */}
          <div className="flex items-center gap-2 bg-[#070b14] border border-slate-800/90 px-2.5 py-1 rounded-lg select-none shrink-0">
            <div className="p-1 rounded bg-emerald-500/10 text-emerald-400">
              <Tags size={13} />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[9px] text-slate-400 uppercase font-semibold leading-none">Çeşit & Stok</span>
              <div className="text-[11px] font-bold font-mono text-slate-200 mt-0.5 leading-none">
                {categoryAnalytics.totalWarehouseSkus} <span className="text-[9px] font-normal text-slate-400">SKU</span>
                <span className="text-slate-600 mx-1">•</span>
                {categoryAnalytics.totalWarehouseQty} <span className="text-[9px] font-normal text-slate-400">ad.</span>
              </div>
            </div>
          </div>

          {/* Kritik & Tükenen */}
          <div
            onClick={() => {
              setRightPanelMode('analytics')
              setAnalyticsTab('critical')
            }}
            className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-colors cursor-pointer group select-none shrink-0 ${categoryAnalytics.totalCriticalCount + categoryAnalytics.totalOutOfStockCount > 0
              ? 'bg-amber-950/20 hover:bg-amber-950/30 border-amber-500/30'
              : 'bg-[#070b14] border-slate-800/90 text-slate-400'
              }`}
            title="Kritik ve Tükenen Ürünleri Görüntüle"
          >
            <div className="p-1 rounded bg-amber-500/15 text-amber-400">
              <AlertTriangle size={13} />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[9px] text-amber-400/90 uppercase font-semibold leading-none">Kritik & Tükenen</span>
              <div className="text-[11px] font-bold font-mono text-amber-300 mt-0.5 leading-none">
                {categoryAnalytics.totalCriticalCount} <span className="text-[9px] font-normal text-slate-400">Kritik</span>
                {categoryAnalytics.totalOutOfStockCount > 0 && (
                  <span className="text-rose-400 ml-1.5 font-bold">
                    • {categoryAnalytics.totalOutOfStockCount} Tükendi
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Ölü / Uyuyan Stok */}
          <div
            onClick={() => {
              setRightPanelMode('analytics')
              setAnalyticsTab('dead')
            }}
            className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border transition-colors cursor-pointer group select-none shrink-0 ${categoryAnalytics.totalDeadCount > 0
              ? 'bg-purple-950/20 hover:bg-purple-950/30 border-purple-500/30'
              : 'bg-[#070b14] border-slate-800/90 text-slate-400'
              }`}
            title="Hareketsiz / Ölü Stokları Görüntüle"
          >
            <div className="p-1 rounded bg-purple-500/15 text-purple-400">
              <Moon size={13} />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[9px] text-purple-400/90 uppercase font-semibold leading-none">Ölü / Uyuyan</span>
              <div className="text-[11px] font-bold font-mono text-purple-300 mt-0.5 leading-none">
                {formatMoney(categoryAnalytics.totalDeadValTry, 'TRY').formatted}
                <span className="text-[9px] px-1 py-0.2 ml-1 rounded bg-purple-500/20 text-purple-300 font-mono">
                  %{categoryAnalytics.deadPercentage.toFixed(0)}
                </span>
              </div>
            </div>
          </div>
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
                  {activeWarehouse?.company ? (activeWarehouse.company.is_personal ? <Home size={10} className="text-slate-400" /> : <Building size={10} className="text-indigo-400" />) : <Globe size={10} className="text-emerald-500/70" />}
                  Sahiplik: {activeWarehouse?.company ? activeWarehouse.company.name : 'Ortak / Bağımsız Depo'}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openRecipeModal()}
                  className="bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-500/40 px-2 py-1.5 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-all active:scale-95 shadow-sm shadow-amber-950/30"
                  title="Yeni Reçete Oluştur / Reçete Yönetimi"
                >
                  <Layers size={12} className="text-amber-400" />
                  <span>Reçete</span>
                </button>
                <button
                  type="button"
                  onClick={() => openAssemblyModal()}
                  className="bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 px-2 py-1.5 rounded-md text-[10px] font-semibold flex items-center gap-1 transition-all active:scale-95 shadow-sm shadow-emerald-950/30"
                  title="Reçeteden Montaj / Üretim Yap"
                >
                  <Package size={12} className="text-emerald-400" />
                  <span>Montaj</span>
                </button>
                <button
                  onClick={openAddStock}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 shadow-sm shadow-indigo-950/40"
                >
                  <Plus size={13} />
                  <span>Ürün Ekle</span>
                </button>
              </div>
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

            {/* ctcmarket.com E-Ticaret / Web Filtreleri */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1 border-t border-slate-800/60 text-[9.5px]">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1 mr-0.5">
                <Globe size={11} className="text-indigo-400" /> Web:
              </span>
              <button
                type="button"
                onClick={() => setWebFilter('all')}
                className={`px-2 py-0.5 rounded transition-colors border select-none cursor-pointer whitespace-nowrap ${webFilter === 'all'
                  ? 'bg-indigo-600 border-indigo-500 text-white font-bold'
                  : 'bg-slate-800/40 hover:bg-slate-700/40 border-slate-700/70 text-slate-400'
                  }`}
              >
                Tümü
              </button>
              <button
                type="button"
                onClick={() => setWebFilter('visible')}
                className={`px-2 py-0.5 rounded transition-colors border select-none cursor-pointer whitespace-nowrap ${webFilter === 'visible'
                  ? 'bg-emerald-600 border-emerald-500 text-white font-bold'
                  : 'bg-slate-800/40 hover:bg-slate-700/40 border-slate-700/70 text-emerald-400 hover:text-emerald-300'
                  }`}
              >
                🌐 Yayında ({webVisibleCount})
              </button>
              <button
                type="button"
                onClick={() => setWebFilter('hidden')}
                className={`px-2 py-0.5 rounded transition-colors border select-none cursor-pointer whitespace-nowrap ${webFilter === 'hidden'
                  ? 'bg-slate-600 border-slate-500 text-white font-bold'
                  : 'bg-slate-800/40 hover:bg-slate-700/40 border-slate-700/70 text-slate-400'
                  }`}
              >
                🔒 Gizli ({webHiddenCount})
              </button>
              {webMissingCatCount > 0 && (
                <button
                  type="button"
                  onClick={() => setWebFilter('missing_cat')}
                  className={`px-2 py-0.5 rounded transition-colors border select-none cursor-pointer whitespace-nowrap ${webFilter === 'missing_cat'
                    ? 'bg-amber-600 border-amber-500 text-white font-bold'
                    : 'bg-slate-800/40 hover:bg-slate-700/40 border-slate-700/70 text-amber-400'
                    }`}
                >
                  ⚠️ Kategori Boş ({webMissingCatCount})
                </button>
              )}
              {webMissingPriceCount > 0 && (
                <button
                  type="button"
                  onClick={() => setWebFilter('missing_price')}
                  className={`px-2 py-0.5 rounded transition-colors border select-none cursor-pointer whitespace-nowrap ${webFilter === 'missing_price'
                    ? 'bg-rose-600 border-rose-500 text-white font-bold'
                    : 'bg-slate-800/40 hover:bg-slate-700/40 border-slate-700/70 text-rose-400'
                    }`}
                >
                  ⚠️ Fiyat Boş ({webMissingPriceCount})
                </button>
              )}
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
                                        onClick={() => {
                                          setSelectedStockId(item.id)
                                          setRightPanelMode('product')
                                        }}
                                        onMouseEnter={() => setHoveredStockId(item.id)}
                                        onMouseLeave={() => setHoveredStockId(prev => (prev === item.id ? null : prev))}
                                        title={`${item.name} - Stok Kartını Düzenlemek için F2'ye basın`}
                                        style={{ animation: 'fadeSlideRight 0.25s both', animationDelay: `${Math.min(idx * 0.02, 0.3)}s` }}
                                        className={`group/item flex items-center justify-between text-[11px] py-2 px-3 ${hasSubHeader ? 'pl-7' : 'pl-4'} cursor-pointer transition-colors ${isSelected ? 'bg-indigo-900/30 border-l-2 border-l-indigo-400' : 'hover:bg-slate-800/30'} ${item.quantity <= 0 ? 'opacity-60 bg-rose-950/5' : ''}`}
                                      >
                                        <div className="flex items-center gap-1.5 min-w-0 pr-2 flex-1">
                                          <input
                                            type="checkbox"
                                            checked={selectedStockIds.includes(item.id)}
                                            onChange={(e) => {
                                              e.stopPropagation()
                                              toggleSelectStock(item.id)
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer shrink-0 mr-1"
                                          />
                                          <span className={`font-normal truncate ${item.quantity <= 0 ? 'text-slate-400 line-through decoration-slate-600' : 'text-slate-200'}`}>
                                            {item.name}
                                          </span>
                                          {item.sku && (
                                            <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 font-mono shrink-0">
                                              {item.sku}
                                            </span>
                                          )}
                                          {/* ctcmarket.com Web Rozeti */}
                                          {item.web_visible ? (
                                            <span
                                              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[8px] font-bold shrink-0 font-sans"
                                              title={`ctcmarket.com'da Yayında • Kategori: ${getWebCategoryName(item.web_category)}${item.web_sub_category ? ` / ${getWebCategoryName(item.web_sub_category)}` : ''} • Web Fiyatı: ${formatMoney(item.web_price || 0, item.web_currency || 'TRY').formatted}`}
                                            >
                                              <Globe size={9} />
                                              <span>Web</span>
                                              {item.web_price !== null && item.web_price !== undefined && item.web_price > 0 && (
                                                <span className="font-mono text-emerald-400 font-bold">
                                                  {formatMoney(item.web_price, item.web_currency || 'TRY').formatted}
                                                </span>
                                              )}
                                            </span>
                                          ) : (
                                            <span
                                              className="hidden group-hover/item:inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-slate-800/80 text-slate-500 text-[8px] font-mono shrink-0"
                                              title="ctcmarket.com'da Gizli"
                                            >
                                              <Lock size={8} /> Gizli
                                            </span>
                                          )}

                                          {/* Reçeteli Ürün Rozeti (Model C) */}
                                          {item.is_composite && (
                                            <span
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                openRecipeModal(item)
                                              }}
                                              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[8px] font-bold shrink-0 font-sans cursor-pointer hover:bg-amber-500/25 transition-colors"
                                              title={`Reçeteli / Montaj Ürünü (${(item.recipe_components || []).length} parça) - Reçeteyi düzenlemek için tıklayın`}
                                            >
                                              <Layers size={9} />
                                              <span>Reçete ({(item.recipe_components || []).length})</span>
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0 font-mono text-[10px]">
                                          <button
                                            type="button"
                                            onClick={(e) => openEditStock(item, e)}
                                            className="hidden group-hover/item:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-950/90 text-indigo-300 border border-indigo-500/30 text-[9px] font-sans hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                            title="Stok Kartını Düzenle (F2)"
                                          >
                                            <Edit3 size={10} />
                                            <span className="font-bold">F2</span>
                                          </button>
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

          {/* TOPLU İŞLEM BARI (ctcmarket.com & Stoklar) */}
          {selectedStockIds.length > 0 && (
            <div className="sticky bottom-0 bg-[#0a0f1d]/95 backdrop-blur-md border-t border-indigo-500/40 p-2.5 z-20 flex flex-col gap-2 shadow-2xl animate-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-indigo-300 font-mono">
                    {selectedStockIds.length} ürün seçildi
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedStockIds([])}
                    className="text-[10px] text-slate-400 hover:text-rose-400 underline cursor-pointer"
                  >
                    Seçimi Kaldır
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectAllCurrent(filteredStocks)}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                >
                  Tümünü ({filteredStocks.length}) Seç
                </button>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  disabled={batchLoading}
                  onClick={handleBatchSetWebVisible}
                  className="flex-1 min-w-[100px] px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded flex items-center justify-center gap-1 transition shadow-sm cursor-pointer disabled:opacity-50"
                  title="Seçili ürünleri ctcmarket.com'da yayına alır"
                >
                  <Globe size={11} /> Webte Göster
                </button>
                <button
                  type="button"
                  disabled={batchLoading}
                  onClick={handleBatchSetWebHidden}
                  className="flex-1 min-w-[90px] px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold rounded flex items-center justify-center gap-1 transition shadow-sm cursor-pointer disabled:opacity-50"
                  title="Seçili ürünleri ctcmarket.com'da gizler"
                >
                  <Lock size={11} /> Webte Gizle
                </button>
                <button
                  type="button"
                  disabled={batchLoading}
                  onClick={() => {
                    setBatchSelectedWebCategory('')
                    setBatchSelectedWebSubCategory('')
                    setIsBatchCategoryModalOpen(true)
                  }}
                  className="flex-1 min-w-[100px] px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded flex items-center justify-center gap-1 transition shadow-sm cursor-pointer disabled:opacity-50"
                  title="Seçili ürünlere toplu web kategorisi atar"
                >
                  <Tag size={11} /> Kategori Ata
                </button>
                <button
                  type="button"
                  disabled={batchLoading}
                  onClick={() => setIsBatchPriceModalOpen(true)}
                  className="flex-1 min-w-[105px] px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold rounded flex items-center justify-center gap-1 transition shadow-sm cursor-pointer disabled:opacity-50"
                  title="Alış fiyatı üzerinden yüzde kâr marjı ile web satış fiyatı belirler"
                >
                  💰 Fiyat Belirle
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SAĞ SÜTUN */}
        <div style={{ animation: 'fadeInUp 0.4s both 0.2s' }} className="flex-1 bg-[#0d1322] border border-slate-800/80 rounded-xl flex flex-col min-w-0 shadow-lg relative overflow-hidden">

          {/* SAĞ PANEL MOD SEÇİCİ TAB BARI */}
          <div className="px-3 py-2 border-b border-slate-800/80 bg-[#070b14] flex items-center justify-between gap-2 shrink-0 z-30">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setRightPanelMode('analytics')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${rightPanelMode === 'analytics' || !selectedStock
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50'
                  : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-700/60'
                  }`}
              >
                <BarChart3 size={13} className={rightPanelMode === 'analytics' || !selectedStock ? 'text-white' : 'text-indigo-400'} />
                <span>📊 Kategori & Envanter Analizi</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (selectedStock) setRightPanelMode('product')
                }}
                disabled={!selectedStock}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${!selectedStock
                  ? 'opacity-40 cursor-not-allowed bg-slate-900 border border-slate-800 text-slate-500'
                  : rightPanelMode === 'product'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/50'
                    : 'bg-slate-800/60 text-slate-300 hover:text-white hover:bg-slate-700/60'
                  }`}
              >
                <Package size={13} className={rightPanelMode === 'product' && selectedStock ? 'text-white' : 'text-amber-400'} />
                <span className="truncate max-w-[180px] sm:max-w-[240px]">
                  {selectedStock ? selectedStock.name : 'Ürün Detay & Hareketler'}
                </span>
                {selectedStock && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedStockId(null)
                      setRightPanelMode('analytics')
                    }}
                    className="ml-1 p-0.5 hover:bg-black/40 rounded text-slate-400 hover:text-rose-400 transition-colors"
                    title="Ürün seçimini kapat ve analize dön"
                  >
                    <X size={11} />
                  </span>
                )}
              </button>
            </div>

            {rightPanelMode === 'product' && selectedStock && (
              <button
                type="button"
                onClick={() => setRightPanelMode('analytics')}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold px-2 py-1 rounded bg-indigo-950/40 border border-indigo-800/40 flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
              >
                <BarChart3 size={11} />
                <span>Analiz Paneline Dön</span>
              </button>
            )}
          </div>

          {/* İÇERİK: EĞER ÜRÜN MODU VE SEÇİLİ ÜRÜN VARSA -> ÜRÜN DETAYI VE HAREKETLER */}
          {rightPanelMode === 'product' && selectedStock ? (
            <div className="flex flex-col flex-1 overflow-hidden z-10">
              {/* HIZLI ARAMA & FATURA İŞLEMİ (Her Zaman Üstte) */}
              <div className="p-3 border-b border-slate-800/80 bg-[#0a0f1d] shrink-0 z-20">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5"><Search size={12} /> Hızlı Arama & İşlem Ekleme</label>
                  <div className="relative z-20">
                    <input
                      type="text"
                      placeholder="Seçili depoda ürün adı veya SKU ara (örn: ekran kartı)..."
                      value={quickSearchTerm}
                      onChange={(e) => {
                        setQuickSearchTerm(e.target.value);
                        if (e.target.value.length < 2) setIsQuickActionActive(false);
                      }}
                      className="w-full bg-[#070b14] border border-indigo-500/30 rounded-lg pl-4 pr-10 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 shadow-inner transition-colors"
                    />
                    <button
                      onClick={() => setQuickSearchTerm('')}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-opacity ${quickSearchTerm ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    ><X size={14} /></button>

                    {/* Arama Sonuçları Dropdown */}
                    {quickSearchTerm.length > 1 && !isQuickActionActive && (
                      <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#1b253b] border border-indigo-500/50 rounded-lg shadow-2xl overflow-hidden max-h-60 overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2 duration-200">
                        {quickSearchStocks.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-400">Ürün bulunamadı.</div>
                        ) : (
                          quickSearchStocks.map(stock => (
                            <div
                              key={`quick-${stock.id}`}
                              onMouseEnter={() => setHoveredStockId(stock.id)}
                              onMouseLeave={() => setHoveredStockId(prev => (prev === stock.id ? null : prev))}
                              onClick={() => {
                                setSelectedStockId(stock.id);
                                setRightPanelMode('product');
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

              {/* ÜRÜN DETAYI VE İŞLEMLER */}
              <div
                onMouseEnter={() => setHoveredStockId(selectedStock.id)}
                onMouseLeave={() => setHoveredStockId(prev => (prev === selectedStock.id ? null : prev))}
                className="p-4 border-b border-slate-800/80 bg-gradient-to-r from-[#0a0f1d] to-[#0d1322] flex justify-between items-center shrink-0"
              >
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

                    {/* ctcmarket.com Web Durumu */}
                    <div className="flex items-center gap-1.5 pl-3 border-l border-slate-800">
                      {selectedStock.web_visible ? (
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1">
                            <Globe size={11} /> ctcmarket.com'da Yayında
                          </span>
                          <span className="text-white font-bold">
                            Web: {formatMoney(selectedStock.web_price || 0, selectedStock.web_currency || 'TRY').formatted}
                          </span>
                          <span className="text-[9px] text-slate-400 truncate max-w-[200px]">
                            {getWebCategoryName(selectedStock.web_category)}{selectedStock.web_sub_category ? ` / ${getWebCategoryName(selectedStock.web_sub_category)}` : ''}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
                            <Lock size={10} /> Webte Gizli
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Sitede listelenmiyor
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-slate-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => openTransferModal(selectedStock)}
                    className="text-slate-400 hover:text-cyan-400 p-1.5 transition flex items-center gap-1 rounded hover:bg-cyan-950/30"
                    title="Bu Ürünü Başka Depoya Transfer Et (Model 3)"
                  >
                    <ArrowRightLeft size={13} className="text-cyan-400" />
                    <span className="text-[10px] font-semibold text-cyan-300">Transfer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openRecipeModal(selectedStock)}
                    className={`p-1.5 transition flex items-center gap-1 rounded ${
                      selectedStock.is_composite
                        ? 'text-amber-300 bg-amber-950/50 hover:bg-amber-900/60 border border-amber-600/40 shadow-sm'
                        : 'text-slate-400 hover:text-amber-400 hover:bg-amber-950/20'
                    }`}
                    title={selectedStock.is_composite ? "Ürün Reçetesini Görüntüle ve Düzenle" : "Bu Ürüne Reçete Tanımla"}
                  >
                    <Layers size={13} className={selectedStock.is_composite ? "text-amber-400" : "text-slate-400"} />
                    <span className="text-[10px] font-semibold">{selectedStock.is_composite ? 'Reçete' : '+ Reçete'}</span>
                  </button>
                  {selectedStock.is_composite && (
                    <button
                      type="button"
                      onClick={() => openAssemblyModal(selectedStock)}
                      className="text-emerald-300 bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-600/40 p-1.5 transition flex items-center gap-1 rounded shadow-sm"
                      title="Bu Reçeteli Üründen Montaj / Üretim Yap ve Stoğa Al"
                    >
                      <Package size={13} className="text-emerald-400" />
                      <span className="text-[10px] font-semibold">Montaj Yap</span>
                    </button>
                  )}
                  <button onClick={(e) => openEditStock(selectedStock, e)} className="text-slate-400 hover:text-indigo-400 p-1.5 transition flex items-center gap-1" title="Stok Kartını Düzenle (F2)">
                    <Edit3 size={14} />
                    <span className="text-[10px] font-mono font-bold bg-indigo-950/80 px-1 py-0.2 rounded border border-indigo-500/30 text-indigo-300">F2</span>
                  </button>
                  <button onClick={(e) => handleDeleteStock(selectedStock.id, e)} className="text-slate-400 hover:text-rose-400 p-1.5 transition" title="Stok Kartını Sil"><Trash2 size={14} /></button>
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col min-h-0 relative z-0 overflow-y-auto lg:overflow-hidden custom-scrollbar">
                {/* REÇETE BİLEŞENLERİ VE DİNAMİK MALİYET KARTI (MODEL C) */}
                {selectedStock.is_composite ? (
                  <div className="mb-4 bg-gradient-to-br from-[#0c1427] to-[#070b14] border border-amber-500/30 rounded-xl p-3.5 shadow-lg shadow-amber-950/20 shrink-0">
                    <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-amber-500/20">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Layers size={14} />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-xs font-bold text-amber-200">Reçete Bileşenleri & Dinamik Canlı Maliyet</h3>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-mono font-medium">
                              {(selectedStock.recipe_components || []).length} Parça
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            Parça maliyeti güncellendiğinde tabela maliyeti otomatik güncellenir.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openRecipeModal(selectedStock)}
                          className="px-2 py-1 rounded bg-amber-950/60 hover:bg-amber-900/70 text-amber-300 hover:text-white border border-amber-500/40 text-[10px] font-semibold flex items-center gap-1 transition-all"
                        >
                          <Edit3 size={11} /> Reçeteyi Düzenle
                        </button>
                        <button
                          type="button"
                          onClick={() => openAssemblyModal(selectedStock)}
                          className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1 transition-all shadow-sm shadow-emerald-900/40"
                        >
                          <Package size={11} /> Montaj / Üretim Yap
                        </button>
                      </div>
                    </div>

                    {/* Bileşenler Listesi */}
                    {(!selectedStock.recipe_components || selectedStock.recipe_components.length === 0) ? (
                      <div className="text-center py-3 text-slate-400 text-xs italic bg-slate-900/40 rounded-lg border border-dashed border-slate-800">
                        Bu ürün için henüz bileşen parça eklenmedi. &quot;Reçeteyi Düzenle&quot; butonuna tıklayarak stoktan parça ekleyebilirsiniz.
                      </div>
                    ) : (
                      (() => {
                        const costDetail = calculateCompositeCost(
                          selectedStock.recipe_components,
                          selectedStock.recipe_additional_cost || 0,
                          allStocks,
                          selectedStock.currency || 'TRY',
                          rates
                        )
                        return (
                          <div className="space-y-2">
                            <div className="divide-y divide-slate-800/60 max-h-48 overflow-y-auto custom-scrollbar border border-slate-800/60 rounded-lg bg-slate-950/40">
                              {costDetail.itemsDetail.map((item, idx) => {
                                const isShort = item.inStockQty < (Number(item.component.quantity) || 0)
                                return (
                                  <div key={idx} className="flex items-center justify-between p-2 text-xs hover:bg-slate-900/40 transition-colors">
                                    <div className="flex-1 min-w-0 pr-2">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-medium text-slate-200 truncate">{item.component.name}</span>
                                        {item.component.sku && (
                                          <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400 font-mono">{item.component.sku}</span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                                        <span>Birim Maliyet: <strong className="text-slate-300">{formatMoney(item.unitCost, selectedStock.currency).formatted}</strong></span>
                                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono ${isShort ? 'bg-rose-950/60 text-rose-300 border border-rose-800/40' : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'}`}>
                                          Depoda: {item.inStockQty} {item.component.unit || 'ad.'}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <div className="text-xs font-bold text-amber-300 font-mono">
                                        {item.component.quantity} {item.component.unit || 'ad.'} × {formatMoney(item.unitCost, selectedStock.currency).formatted}
                                      </div>
                                      <div className="text-[11px] font-bold text-slate-200 font-mono mt-0.5">
                                        = {formatMoney(item.totalCost, selectedStock.currency).formatted}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>

                            {/* Maliyet Özeti & Ek Masraf */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 px-1 text-xs">
                              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                <span>Parçalar: <strong className="text-slate-200 font-mono">{formatMoney(costDetail.componentsCost, selectedStock.currency).formatted}</strong></span>
                                <span>+</span>
                                <span>Ek Masraf (vida, kablo vb.): <strong className="text-slate-200 font-mono">{formatMoney(selectedStock.recipe_additional_cost || 0, selectedStock.currency).formatted}</strong></span>
                              </div>
                              <div className="flex items-center gap-1.5 bg-amber-950/50 border border-amber-500/40 px-2.5 py-1 rounded-lg">
                                <span className="text-[10px] text-amber-300 uppercase tracking-wide font-bold">Toplam Birim Maliyet:</span>
                                <strong className="text-sm text-amber-200 font-mono font-bold">
                                  {formatMoney(costDetail.totalCost, selectedStock.currency).formatted}
                                </strong>
                              </div>
                            </div>
                          </div>
                        )
                      })()
                    )}
                  </div>
                ) : (
                  <div className="mb-4 bg-slate-900/30 border border-slate-800/70 rounded-xl p-2.5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <Layers size={13} className="text-slate-500" />
                      <span className="text-[11px] text-slate-400">Bu ürün tekil bir stok kartıdır.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openRecipeModal(selectedStock)}
                      className="text-[10px] text-amber-400 hover:text-amber-300 bg-amber-950/30 hover:bg-amber-950/50 border border-amber-600/30 px-2 py-1 rounded font-semibold transition flex items-center gap-1"
                    >
                      <Plus size={11} /> Reçeteli Ürüne Dönüştür (Tabela / Montaj)
                    </button>
                  </div>
                )}
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

                <div className="border border-slate-800/80 rounded-lg overflow-auto custom-scrollbar flex-1 min-h-0">
                  <table className="w-full text-left text-[11px] relative">
                    <thead className="sticky top-0 bg-[#0a0f1d] z-10 border-b border-slate-800 shadow-sm">
                      <tr className="border-b border-slate-800/80 text-slate-400">
                        <th className="p-2.5 font-medium bg-[#0a0f1d]">Tarih</th>
                        <th className="p-2.5 font-medium bg-[#0a0f1d]">Açıklama & Merkez</th>
                        <th className="p-2.5 font-medium text-right text-emerald-400 bg-[#0a0f1d]">Giriş</th>
                        <th className="p-2.5 font-medium text-right text-rose-400 bg-[#0a0f1d]">Çıkış</th>
                        <th className="p-2.5 font-medium text-right bg-[#0a0f1d]" title="Girişlerde alış maliyeti, satış çıkışlarında satılan birim fiyat ve kâr marjı gösterilir">Birim Fiyat / Satış</th>
                        <th className="p-2.5 font-medium text-right bg-[#0a0f1d]">KDV'li B.Fiyat</th>
                        <th className="p-2.5 font-medium text-right bg-[#0a0f1d]">Toplam Tutar</th>
                        <th className="p-2.5 font-medium text-center w-12 bg-[#0a0f1d]">İşlem</th>
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
                        const isOut = t.tx_type === 'out'
                        const hasSalePrice = isOut && t.sale_price !== null && t.sale_price !== undefined

                        // Maliyet / Baz değerler
                        const kdvliBirim = t.unit_price * (1 + (t.vat_rate || 0) / 100)
                        const toplamKdvli = t.quantity * kdvliBirim
                        const tryUnitPrice = getTryEquivalent(t.unit_price, txCurrency)
                        const tryKdvliBirim = getTryEquivalent(kdvliBirim, txCurrency)
                        const tryToplamKdvli = getTryEquivalent(toplamKdvli, txCurrency)

                        // Satış değerleri (Çıkış ve satış fiyatı biliniyorsa)
                        const saleUnitPrice = hasSalePrice ? t.sale_price! : null
                        const saleCurrency = t.sale_currency || txCurrency
                        const saleKdvliBirim = saleUnitPrice !== null ? saleUnitPrice * (1 + (t.vat_rate || 0) / 100) : null
                        const toplamSaleKdvli = (saleUnitPrice !== null && t.quantity) ? t.quantity * saleKdvliBirim! : null
                        const trySaleUnitPrice = saleUnitPrice !== null ? getTryEquivalent(saleUnitPrice, saleCurrency) : null
                        const trySaleKdvliBirim = saleKdvliBirim !== null ? getTryEquivalent(saleKdvliBirim, saleCurrency) : null
                        const tryToplamSaleKdvli = toplamSaleKdvli !== null ? getTryEquivalent(toplamSaleKdvli, saleCurrency) : null

                        return (
                          <tr
                            key={t.id}
                            style={{ animation: 'fadeSlideRight 0.4s both', animationDelay: `${0.35 + (index * 0.05)}s` }}
                            className="hover:bg-slate-800/30 font-mono transition-colors"
                          >
                            <td className="p-2.5 text-slate-400 align-top">{formatDateTR(t.tx_date)}</td>
                            <td className="p-2.5 text-slate-200 font-sans align-top" title={t.description}>
                              <div className="mb-1 flex items-center gap-1.5 flex-wrap">
                                <span>{t.description}</span>
                                {(() => {
                                  const desc = t.description || ''
                                  if (desc.includes('/ Alım') || desc.includes('Fatura / Alım')) {
                                    return <span className="text-[8px] font-sans px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold">Alım Faturası</span>
                                  }
                                  if (desc.includes('/ Satış') || desc.includes('Fatura / Satış')) {
                                    return <span className="text-[8px] font-sans px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30 font-bold">Satış Faturası</span>
                                  }
                                  if (desc.includes('POS-') || desc.includes('Z-Raporu') || desc.includes('Mağaza Satışı') || desc.includes('Müşteri Ürün İadesi')) {
                                    return <span className="text-[8px] font-sans px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30 font-bold">Mağaza POS</span>
                                  }
                                  if (desc.includes('Servis Parça Çıkışı') || desc.includes('SRV-')) {
                                    return <span className="text-[8px] font-sans px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-bold">Teknik Servis</span>
                                  }
                                  if (desc.includes('[TRF-')) {
                                    return <span className="text-[8px] font-sans px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/40 font-bold">⇄ Transfer</span>
                                  }
                                  if (desc === 'Açılış Stoğu') {
                                    return <span className="text-[8px] font-sans px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-300 border border-slate-600/40 font-bold">Açılış Stoğu</span>
                                  }
                                  return null
                                })()}
                              </div>
                              <div className="flex items-center gap-1 text-[9px] text-slate-500">
                                {t.company ? (t.company.is_personal ? <Home size={10} className="text-slate-400" /> : <Building size={10} className="text-indigo-400" />) : <Globe size={10} className="text-emerald-500/70" />}
                                {t.company ? t.company.name : 'Ortak İşlem'}
                              </div>
                              {t.sale_source && (
                                <div className="text-[9px] text-emerald-400/90 flex items-center gap-1 font-sans mt-0.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                                  <span className="truncate">{t.sale_source}</span>
                                </div>
                              )}
                            </td>
                            <td className="p-2.5 text-right text-emerald-400 align-top">{t.tx_type === 'in' ? t.quantity : '-'}</td>
                            <td className="p-2.5 text-right text-rose-400 align-top">{t.tx_type === 'out' ? t.quantity : '-'}</td>

                            {/* BİRİM FİYAT / SATIŞ SÜTUNU */}
                            <td className="p-2.5 text-right leading-tight align-top">
                              {hasSalePrice ? (
                                <div className="flex flex-col items-end">
                                  <div className="text-emerald-400 font-bold flex items-center gap-1">
                                    <span className="text-[8px] font-sans px-1 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 font-medium">Satış</span>
                                    <span>{formatMoney(saleUnitPrice!, saleCurrency).formatted}</span>
                                  </div>
                                  {saleCurrency !== 'TRY' && (
                                    <div className="text-[9px] text-emerald-500/70 mt-0.5">{formatMoney(trySaleUnitPrice!, 'TRY').formatted}</div>
                                  )}
                                  <div className="text-[9px] text-slate-400 mt-1 flex items-center gap-1 font-sans">
                                    <span>Mlyt: {formatMoney(t.unit_price, txCurrency).formatted}</span>
                                    {t.profit_percent !== null && t.profit_percent !== undefined && (
                                      <span className={`font-mono text-[9px] font-semibold ${t.profit_percent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        ({t.profit_percent >= 0 ? '+' : ''}%{t.profit_percent.toFixed(0)})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="text-slate-300">{formatMoney(t.unit_price, txCurrency).formatted}</div>
                                  {txCurrency !== 'TRY' && (
                                    <div className="text-[9px] text-slate-500 mt-0.5">{formatMoney(tryUnitPrice, 'TRY').formatted}</div>
                                  )}
                                  <span className="text-[8px] text-slate-500 font-sans block mt-0.5">{isOut ? 'Çıkış Maliyeti' : 'Alış Maliyeti'}</span>
                                </div>
                              )}
                            </td>

                            {/* KDV'Lİ BİRİM FİYAT SÜTUNU */}
                            <td className="p-2.5 text-right leading-tight align-top">
                              {hasSalePrice ? (
                                <div className="flex flex-col items-end">
                                  <div className="text-indigo-300 font-medium">
                                    {formatMoney(saleKdvliBirim!, saleCurrency).formatted}
                                  </div>
                                  {saleCurrency !== 'TRY' && (
                                    <div className="text-[9px] text-indigo-500/70 mt-0.5">{formatMoney(trySaleKdvliBirim!, 'TRY').formatted}</div>
                                  )}
                                  <div className="text-[9px] text-slate-500 mt-1 font-sans">
                                    Mlyt KDV: {formatMoney(kdvliBirim, txCurrency).formatted}
                                  </div>
                                </div>
                              ) : (
                                t.vat_rate > 0 ? (
                                  <>
                                    <div className="text-indigo-300">{formatMoney(kdvliBirim, txCurrency).formatted}</div>
                                    {txCurrency !== 'TRY' && (
                                      <div className="text-[9px] text-indigo-500/70 mt-0.5">{formatMoney(tryKdvliBirim, 'TRY').formatted}</div>
                                    )}
                                  </>
                                ) : '-'
                              )}
                            </td>

                            {/* TOPLAM TUTAR SÜTUNU */}
                            <td className="p-2.5 text-right font-bold leading-tight align-top">
                              {hasSalePrice ? (
                                <div className="flex flex-col items-end">
                                  <div className="text-emerald-300 font-bold">
                                    {formatMoney(toplamSaleKdvli!, saleCurrency).formatted}
                                  </div>
                                  {saleCurrency !== 'TRY' && (
                                    <div className="text-[9px] text-slate-400 font-normal mt-0.5">{formatMoney(tryToplamSaleKdvli!, 'TRY').formatted}</div>
                                  )}
                                  <div className="text-[9px] text-slate-400 font-normal mt-1 font-sans">
                                    Mlyt: {formatMoney(toplamKdvli, txCurrency).formatted}
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="text-white">{formatMoney(toplamKdvli, txCurrency).formatted}</div>
                                  {txCurrency !== 'TRY' && (
                                    <div className="text-[9px] text-slate-400 font-normal mt-0.5">{formatMoney(tryToplamKdvli, 'TRY').formatted}</div>
                                  )}
                                </div>
                              )}
                            </td>

                            <td className="p-2.5 text-center align-top">
                              {(() => {
                                const desc = t.description || ''
                                const isExternal = desc.includes('/ Alım') || desc.includes('/ Satış') || desc.includes('POS-') || desc.includes('Z-Raporu') || desc.includes('Servis Parça Çıkışı') || desc.includes('SRV-') || desc.includes('[TRF-')
                                return (
                                  <div className="flex items-center justify-center gap-2">
                                    {isExternal ? (
                                      <button onClick={() => handleEditTx(t)} className="text-slate-600 hover:text-amber-400 transition" title="Harici modülden yönetilir (Kilitli)"><Lock size={12} /></button>
                                    ) : (
                                      <button onClick={() => handleEditTx(t)} className="text-slate-500 hover:text-indigo-400 transition" title="Düzenle"><Edit3 size={12} /></button>
                                    )}
                                    <button onClick={() => handleDeleteTransaction(t.id, t.quantity, t.tx_type, t.description)} className="text-slate-600 hover:text-rose-400 transition" title={isExternal ? "Kaynağa Bağlı / Yetim Sil" : "Sil"}><Trash2 size={12} /></button>
                                  </div>
                                )
                              })()}
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
            /* ========================================================================= */
            /* --- KATEGORİ & ALT KATEGORİ ENTEGRE ANALİZ VE DEĞERLENDİRME PANELİ --- */
            /* ========================================================================= */
            <div className="flex flex-col flex-1 overflow-hidden z-10 animate-in fade-in duration-200">
              {/* ANALİZ ÜST SEÇİCİ BARI */}
              <div className="p-3 border-b border-slate-800/80 bg-[#0a0f1d] flex flex-col md:flex-row md:items-center justify-between gap-2.5 shrink-0 z-20">
                <div className="flex items-center gap-1 bg-[#070b14] p-1 rounded-xl border border-slate-800/90 text-[11px] overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setAnalyticsTab('summary')}
                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${analyticsTab === 'summary'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/40'
                      : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    <PieChart size={13} className={analyticsTab === 'summary' ? 'text-white' : 'text-indigo-400'} />
                    <span>Sermaye & Dağılım</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAnalyticsTab('critical')}
                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${analyticsTab === 'critical'
                      ? 'bg-amber-600 text-white shadow-sm shadow-amber-900/40'
                      : 'text-slate-400 hover:text-amber-300'
                      }`}
                  >
                    <AlertTriangle size={13} className={analyticsTab === 'critical' ? 'text-white' : 'text-amber-400'} />
                    <span>Kritik & Tükenen</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${analyticsTab === 'critical' ? 'bg-amber-950/60 text-amber-200' : 'bg-slate-800 text-amber-400'
                      }`}>
                      {categoryAnalytics.totalCriticalCount + categoryAnalytics.totalOutOfStockCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAnalyticsTab('dead')}
                    className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 whitespace-nowrap transition-all ${analyticsTab === 'dead'
                      ? 'bg-purple-600 text-white shadow-sm shadow-purple-900/40'
                      : 'text-slate-400 hover:text-purple-300'
                      }`}
                  >
                    <Moon size={13} className={analyticsTab === 'dead' ? 'text-white' : 'text-purple-400'} />
                    <span>Hareketsiz / Ölü Stok</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${analyticsTab === 'dead' ? 'bg-purple-950/60 text-purple-200' : 'bg-slate-800 text-purple-400'
                      }`}>
                      {categoryAnalytics.totalDeadCount}
                    </span>
                  </button>
                </div>

                {/* Hızlı Arama Kutusu */}
                <div className="relative min-w-[200px]">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Analizde ara (kategori, alt kat, SKU)..."
                    value={analyticsSearch}
                    onChange={(e) => setAnalyticsSearch(e.target.value)}
                    className="w-full bg-[#070b14] border border-slate-700/80 rounded-lg pl-7 pr-7 py-1 text-[11px] text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  {analyticsSearch && (
                    <button onClick={() => setAnalyticsSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* ANALİZ İÇERİK ALANI (Scrollable) */}
              <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-3.5">

                {/* 4'LÜ KPI ÖZET KARTLARI */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  {/* Kart 1: Toplam Bağlı Sermaye */}
                  <div className="p-3 rounded-xl bg-gradient-to-br from-[#111827] to-[#0b101b] border border-slate-800 flex flex-col justify-between shadow-sm">
                    <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
                      <span className="font-semibold uppercase tracking-wider text-slate-400">Bağlı Sermaye</span>
                      <Package size={13} className="text-indigo-400" />
                    </div>
                    <div className="text-base font-bold font-mono text-white tracking-tight">
                      {formatMoney(categoryAnalytics.totalWarehouseTry, 'TRY').formatted}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1">
                      <span className="text-indigo-300 font-medium">{formatMoney(categoryAnalytics.totalWarehouseUsd, 'USD').formatted}</span>
                      <span>{categoryAnalytics.totalWarehouseQty} adet</span>
                    </div>
                  </div>

                  {/* Kart 2: Hareketsiz / Uyuyan Sermaye */}
                  <div className={`p-3 rounded-xl border flex flex-col justify-between shadow-sm transition-all ${categoryAnalytics.totalDeadValTry > 0 ? 'bg-gradient-to-br from-purple-950/20 to-[#0b101b] border-purple-500/30' : 'bg-[#0f172a]/50 border-slate-800'
                    }`}>
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1">
                        <Moon size={11} /> Ölü / Uyuyan Stok
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono font-bold">
                        %{categoryAnalytics.deadPercentage.toFixed(1)}
                      </span>
                    </div>
                    <div className="text-base font-bold font-mono text-purple-300 tracking-tight">
                      {formatMoney(categoryAnalytics.totalDeadValTry, 'TRY').formatted}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-1 flex items-center justify-between">
                      <span>{categoryAnalytics.totalDeadCount} çeşit ürün hareketsiz</span>
                      <span className="text-purple-400/80 font-normal">({deadStockDays === -1 ? 'Hiç satılmayan' : `${deadStockDays}+ gün`})</span>
                    </div>
                  </div>

                  {/* Kart 3: Kritik & Tükenen Ürünler */}
                  <div className={`p-3 rounded-xl border flex flex-col justify-between shadow-sm transition-all ${categoryAnalytics.totalCriticalCount + categoryAnalytics.totalOutOfStockCount > 0 ? 'bg-gradient-to-br from-amber-950/20 to-[#0b101b] border-amber-500/30' : 'bg-[#0f172a]/50 border-slate-800'
                    }`}>
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                        <AlertTriangle size={11} /> Kritik Seviyeler
                      </span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">
                        {categoryAnalytics.totalCriticalCount + categoryAnalytics.totalOutOfStockCount} SKU
                      </span>
                    </div>
                    <div className="text-base font-bold font-mono text-amber-300 tracking-tight">
                      {categoryAnalytics.totalCriticalCount} Kritik <span className="text-xs font-normal text-slate-400">(1-2 ad.)</span>
                    </div>
                    <div className="text-[10px] text-rose-400 font-mono mt-1 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500 inline-block animate-pulse"></span>
                      {categoryAnalytics.totalOutOfStockCount} ürün tamamen tükendi (0)
                    </div>
                  </div>

                  {/* Kart 4: Kategori ve Çeşitlilik */}
                  <div className="p-3 rounded-xl bg-gradient-to-br from-[#111827] to-[#0b101b] border border-slate-800 flex flex-col justify-between shadow-sm">
                    <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
                      <span className="font-semibold uppercase tracking-wider text-slate-400">Çeşitlilik (SKU)</span>
                      <Tags size={13} className="text-emerald-400" />
                    </div>
                    <div className="text-base font-bold font-mono text-white tracking-tight">
                      {categoryAnalytics.totalWarehouseSkus} <span className="text-xs font-normal text-slate-400">Çeşit</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-1">
                      {categoryAnalytics.categoriesList.length} Kategori • {categoryAnalytics.categoriesList.reduce((acc, c) => acc + c.subCategories.length, 0)} Alt Kat.
                    </div>
                  </div>
                </div>

                {/* GÖRSEL SERMAYE DAĞILIM ÇUBUĞU */}
                <div className="bg-[#0a0f1d] border border-slate-800/80 p-3 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                      <PieChart size={13} className="text-indigo-400" />
                      Kategori Bazlı Sermaye Payı Dağılımı
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">Toplam {formatMoney(categoryAnalytics.totalWarehouseTry, 'TRY').formatted}</span>
                  </div>

                  <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden flex shadow-inner">
                    {categoryAnalytics.categoriesList.map((cat) => {
                      if (cat.percentOfTotal <= 0) return null
                      return (
                        <div
                          key={cat.name}
                          style={{ width: `${cat.percentOfTotal}%` }}
                          className={`${cat.color.bar} h-full transition-all hover:opacity-80 cursor-pointer`}
                          title={`${cat.name}: %${cat.percentOfTotal.toFixed(1)} (${formatMoney(cat.totalValueTry, 'TRY').formatted})`}
                        />
                      )
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2.5 pt-2 border-t border-slate-800/50">
                    {categoryAnalytics.categoriesList.slice(0, 6).map(cat => (
                      <div key={cat.name} className="flex items-center gap-1 text-[10px]">
                        <span className={`h-2 w-2 rounded-full ${cat.color.bar}`} />
                        <span className="text-slate-300 font-medium">{cat.name}</span>
                        <span className="text-slate-500 font-mono">(%{cat.percentOfTotal.toFixed(1)})</span>
                      </div>
                    ))}
                    {categoryAnalytics.categoriesList.length > 6 && (
                      <span className="text-[10px] text-slate-500">+{categoryAnalytics.categoriesList.length - 6} diğer kategori</span>
                    )}
                  </div>
                </div>

                {/* ========================================================================= */}
                {/* --- SEKME 1: TÜMÜ & SERMAYE DAĞILIMI (HİYERARŞİK TABLO) --- */}
                {/* ========================================================================= */}
                {analyticsTab === 'summary' && (
                  <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-[#070b14]">
                    <div className="p-3 border-b border-slate-800 bg-[#0a0f1d] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers size={14} className="text-indigo-400" />
                        <span className="text-xs font-bold text-white">Kategori ve Alt Kategori Dağılım Matrisi</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {categoryAnalytics.categoriesList.length} kategori listeleniyor
                      </span>
                    </div>

                    <div className="divide-y divide-slate-800/80">
                      {categoryAnalytics.categoriesList
                        .filter(cat => {
                          if (!analyticsSearch) return true
                          const q = analyticsSearch.toLowerCase()
                          return (
                            cat.name.toLowerCase().includes(q) ||
                            cat.subCategories.some(sub => sub.name.toLowerCase().includes(q)) ||
                            cat.items.some(it => it.stock.name.toLowerCase().includes(q) || (it.stock.sku && it.stock.sku.toLowerCase().includes(q)))
                          )
                        })
                        .map(cat => {
                          const isExpanded = !!expandedAnalyticsCats[cat.name]
                          return (
                            <div key={cat.name} className="flex flex-col transition-colors">
                              {/* Kategori Satırı */}
                              <div className="p-3 hover:bg-slate-800/30 flex items-center justify-between gap-3 group">
                                <div
                                  onClick={() => toggleAnalyticsCat(cat.name)}
                                  className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer select-none"
                                >
                                  <span className="text-slate-500 group-hover:text-indigo-400 transition-transform">
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  </span>
                                  <span className={`h-2.5 w-2.5 rounded-full ${cat.color.bar}`} />
                                  <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
                                        {cat.name}
                                      </span>
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                                        {cat.skuCount} SKU • {cat.totalQty} ad.
                                      </span>
                                    </div>
                                    <span className="text-[9px] text-slate-500">
                                      {cat.subCategories.length} Alt Kategori ({cat.subCategories.map(s => s.name).slice(0, 3).join(', ')}{cat.subCategories.length > 3 ? '...' : ''})
                                    </span>
                                  </div>
                                </div>

                                {/* Değerler & Rozetler */}
                                <div className="flex items-center gap-4 shrink-0 font-mono text-right">
                                  {/* Durum Göstergeleri */}
                                  <div className="hidden sm:flex items-center gap-1.5 text-[10px]">
                                    {cat.outOfStockCount > 0 && (
                                      <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold" title="Tükenen Stok">
                                        🔴 {cat.outOfStockCount}
                                      </span>
                                    )}
                                    {cat.criticalCount > 0 && (
                                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold" title="Kritik Stok (1-2 ad.)">
                                        🟡 {cat.criticalCount}
                                      </span>
                                    )}
                                    {cat.deadCount > 0 && (
                                      <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold" title="Hareketsiz Stok">
                                        💤 {cat.deadCount}
                                      </span>
                                    )}
                                    {cat.outOfStockCount === 0 && cat.criticalCount === 0 && cat.deadCount === 0 && (
                                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px]">
                                        🟢 Dengeli
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex flex-col items-end">
                                    <span className="text-xs font-bold text-white">
                                      {formatMoney(cat.totalValueTry, 'TRY').formatted}
                                    </span>
                                    <span className="text-[9px] text-indigo-300">
                                      %{cat.percentOfTotal.toFixed(1)} Sermaye Payı
                                    </span>
                                  </div>

                                  {/* Hızlı Filtre Butonu */}
                                  <button
                                    type="button"
                                    onClick={() => filterLeftListFromAnalytics(cat.name)}
                                    className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-indigo-600 hover:text-white text-slate-400 border border-slate-700/60 transition-colors"
                                    title="Sol listeyi bu kategoriye göre süz"
                                  >
                                    <Filter size={12} />
                                  </button>
                                </div>
                              </div>

                              {/* Alt Kategoriler (Açılır Kısım) */}
                              {isExpanded && (
                                <div className="bg-[#050811] border-t border-slate-800/60 divide-y divide-slate-800/40 pl-6 pr-3 py-1">
                                  {cat.subCategories.map(sub => (
                                    <div key={sub.name} className="py-2 flex items-center justify-between text-[11px] hover:bg-slate-800/20 px-2 rounded-lg transition-colors">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <Tag size={11} className="text-teal-400/80 shrink-0" />
                                        <span className="text-slate-200 font-medium truncate">{sub.name}</span>
                                        <span className="text-[9px] text-slate-500 font-mono">
                                          ({sub.skuCount} SKU, {sub.totalQty} ad.)
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-3 shrink-0 font-mono text-right text-[10px]">
                                        <div className="flex items-center gap-1">
                                          {sub.outOfStockCount > 0 && <span className="text-rose-400" title="Tükenen">🔴 {sub.outOfStockCount}</span>}
                                          {sub.criticalCount > 0 && <span className="text-amber-400" title="Kritik">🟡 {sub.criticalCount}</span>}
                                          {sub.deadCount > 0 && <span className="text-purple-400" title="Hareketsiz">💤 {sub.deadCount}</span>}
                                        </div>

                                        <div className="flex flex-col items-end min-w-[90px]">
                                          <span className="font-bold text-slate-200">{formatMoney(sub.totalValueTry, 'TRY').formatted}</span>
                                          {sub.deadValueTry > 0 && (
                                            <span className="text-[9px] text-purple-400">Ölü: {formatMoney(sub.deadValueTry, 'TRY').formatted}</span>
                                          )}
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => filterLeftListFromAnalytics(cat.name, sub.name)}
                                          className="p-1 rounded text-slate-500 hover:text-teal-300 hover:bg-teal-950/40 transition-colors"
                                          title="Sol listeyi bu alt kategoriye süz"
                                        >
                                          <Filter size={11} />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  </div>
                )}

                {/* ========================================================================= */}
                {/* --- SEKME 2: KRİTİK & TÜKENEN SEVİYELER --- */}
                {/* ========================================================================= */}
                {analyticsTab === 'critical' && (
                  <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-[#070b14]">
                    <div className="p-3 border-b border-slate-800 bg-[#0a0f1d] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={14} className="text-amber-400" />
                        <span className="text-xs font-bold text-white">Acil Tedarik & Kritik Stok Seviyeleri</span>
                      </div>

                      {/* Alt Filtre Butonları */}
                      <div className="flex items-center gap-1 bg-[#070b14] p-0.5 rounded-lg border border-slate-800 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setCriticalSubFilter('all')}
                          className={`px-2 py-0.5 rounded font-bold transition-all ${criticalSubFilter === 'all' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                          Tümü ({categoryAnalytics.totalCriticalCount + categoryAnalytics.totalOutOfStockCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCriticalSubFilter('out_of_stock')}
                          className={`px-2 py-0.5 rounded font-bold transition-all ${criticalSubFilter === 'out_of_stock' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-rose-400'
                            }`}
                        >
                          🔴 Tükendi ({categoryAnalytics.totalOutOfStockCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setCriticalSubFilter('critical')}
                          className={`px-2 py-0.5 rounded font-bold transition-all ${criticalSubFilter === 'critical' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-amber-300'
                            }`}
                        >
                          🟡 Kritik 1-2 ({categoryAnalytics.totalCriticalCount})
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-[#0a0f1d] text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="p-2.5 font-medium">Ürün Adı & SKU</th>
                            <th className="p-2.5 font-medium">Kategori / Alt Kategori</th>
                            <th className="p-2.5 font-medium text-center">Durum / Miktar</th>
                            <th className="p-2.5 font-medium text-right">B.Fiyat (KDV Dahil)</th>
                            <th className="p-2.5 font-medium text-right">Bağlı Değer</th>
                            <th className="p-2.5 font-medium text-center w-24">İşlem</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {categoryAnalytics.allCriticalItems
                            .filter(it => {
                              if (criticalSubFilter === 'out_of_stock') return it.isOutOfStock
                              if (criticalSubFilter === 'critical') return it.isCritical
                              return true
                            })
                            .filter(it => {
                              if (!analyticsSearch) return true
                              const q = analyticsSearch.toLowerCase()
                              return (
                                it.stock.name.toLowerCase().includes(q) ||
                                (it.stock.sku && it.stock.sku.toLowerCase().includes(q)) ||
                                (it.stock.category && it.stock.category.toLowerCase().includes(q)) ||
                                (it.stock.sub_category && it.stock.sub_category.toLowerCase().includes(q))
                              )
                            })
                            .map((it) => (
                              <tr
                                key={it.stock.id}
                                onMouseEnter={() => setHoveredStockId(it.stock.id)}
                                onMouseLeave={() => setHoveredStockId(prev => (prev === it.stock.id ? null : prev))}
                                className="hover:bg-slate-800/30 transition-colors"
                              >
                                <td className="p-2.5 font-sans">
                                  <div className="font-semibold text-slate-200">{it.stock.name}</div>
                                  <div className="text-[9px] text-slate-500 font-mono">{it.stock.sku || 'SKU Yok'}</div>
                                </td>
                                <td className="p-2.5 font-sans text-slate-300">
                                  <div>{it.stock.category || 'Kategorisiz'}</div>
                                  <div className="text-[9px] text-teal-400">{it.stock.sub_category || 'Genel'}</div>
                                </td>
                                <td className="p-2.5 text-center">
                                  {it.isOutOfStock ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 animate-pulse">
                                      🔴 0 {it.stock.unit} (Tükendi)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                                      🟡 {it.stock.quantity} {it.stock.unit}
                                    </span>
                                  )}
                                </td>
                                <td className="p-2.5 text-right text-slate-300">
                                  {formatMoney(it.unitPriceWithVat, it.stock.currency).formatted}
                                </td>
                                <td className="p-2.5 text-right font-bold text-white">
                                  {formatMoney(it.valueTry, 'TRY').formatted}
                                </td>
                                <td className="p-2.5 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => openStockFromAnalytics(it.stock.id)}
                                      className="px-2 py-1 rounded bg-indigo-600/80 hover:bg-indigo-600 text-white font-sans text-[10px] font-bold transition-all shadow-sm"
                                      title="Bu ürünün hareket kartını ve giriş formunu aç"
                                    >
                                      Detay
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => filterLeftListFromAnalytics(it.stock.category, it.stock.sub_category)}
                                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                                      title="Sol listede filtrele"
                                    >
                                      <Filter size={11} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ========================================================================= */}
                {/* --- SEKME 3: HAREKETSİZ / ÖLÜ STOK ANALİZİ --- */}
                {/* ========================================================================= */}
                {analyticsTab === 'dead' && (
                  <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-[#070b14]">
                    <div className="p-3 border-b border-slate-800 bg-[#0a0f1d] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Moon size={14} className="text-purple-400" />
                        <div>
                          <span className="text-xs font-bold text-white">Hareketsiz / Uyuyan Stok Raporu</span>
                          <p className="text-[9px] text-slate-400">Çıkış hareketi gerçekleşmemiş veya uzun süredir bekleyen stoklar</p>
                        </div>
                      </div>

                      {/* Eşik Seçimi */}
                      <div className="flex items-center gap-1 bg-[#070b14] p-1 rounded-lg border border-slate-800 text-[10px]">
                        <span className="text-[9px] text-slate-500 mr-1 pl-1">Eşik:</span>
                        <button
                          type="button"
                          onClick={() => setDeadStockDays(30)}
                          className={`px-2 py-0.5 rounded font-bold transition-all ${deadStockDays === 30 ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                          30+ Gün
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeadStockDays(60)}
                          className={`px-2 py-0.5 rounded font-bold transition-all ${deadStockDays === 60 ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                          60+ Gün
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeadStockDays(90)}
                          className={`px-2 py-0.5 rounded font-bold transition-all ${deadStockDays === 90 ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                            }`}
                        >
                          90+ Gün
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeadStockDays(-1)}
                          className={`px-2 py-0.5 rounded font-bold transition-all ${deadStockDays === -1 ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                            }`}
                          title="Yalnızca açılış stoğundan beri hiç satış/çıkış yapılmamış ürünler"
                        >
                          Hiç Çıkış Yok
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-[#0a0f1d] text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="p-2.5 font-medium">Ürün Adı & SKU</th>
                            <th className="p-2.5 font-medium">Kategori / Alt Kategori</th>
                            <th className="p-2.5 font-medium text-center">Stok Miktarı</th>
                            <th className="p-2.5 font-medium text-right">Bağlı Sermaye (KDV Dahil)</th>
                            <th className="p-2.5 font-medium text-center">Hareketsizlik Durumu</th>
                            <th className="p-2.5 font-medium text-center w-24">İşlem</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {categoryAnalytics.allDeadItems
                            .filter(it => {
                              if (!analyticsSearch) return true
                              const q = analyticsSearch.toLowerCase()
                              return (
                                it.stock.name.toLowerCase().includes(q) ||
                                (it.stock.sku && it.stock.sku.toLowerCase().includes(q)) ||
                                (it.stock.category && it.stock.category.toLowerCase().includes(q)) ||
                                (it.stock.sub_category && it.stock.sub_category.toLowerCase().includes(q))
                              )
                            })
                            .map((it) => (
                              <tr
                                key={it.stock.id}
                                onMouseEnter={() => setHoveredStockId(it.stock.id)}
                                onMouseLeave={() => setHoveredStockId(prev => (prev === it.stock.id ? null : prev))}
                                className="hover:bg-slate-800/30 transition-colors"
                              >
                                <td className="p-2.5 font-sans">
                                  <div className="font-semibold text-slate-200">{it.stock.name}</div>
                                  <div className="text-[9px] text-slate-500 font-mono">{it.stock.sku || 'SKU Yok'}</div>
                                </td>
                                <td className="p-2.5 font-sans text-slate-300">
                                  <div>{it.stock.category || 'Kategorisiz'}</div>
                                  <div className="text-[9px] text-teal-400">{it.stock.sub_category || 'Genel'}</div>
                                </td>
                                <td className="p-2.5 text-center font-bold text-purple-300">
                                  {it.stock.quantity} {it.stock.unit}
                                </td>
                                <td className="p-2.5 text-right font-bold text-white">
                                  <div>{formatMoney(it.valueTry, 'TRY').formatted}</div>
                                  <div className="text-[9px] text-slate-400 font-normal">{formatMoney(it.valueUsd, 'USD').formatted}</div>
                                </td>
                                <td className="p-2.5 text-center">
                                  {it.outCount === 0 ? (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30 font-sans">
                                      💤 Hiç Çıkış Yapılmamış
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[9px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-sans">
                                      <Clock size={10} className="text-purple-400" /> {it.daysSinceLastOut} gündür çıkış yok ({formatDateTR(it.lastOutDate || '')})
                                    </span>
                                  )}
                                </td>
                                <td className="p-2.5 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => openStockFromAnalytics(it.stock.id)}
                                      className="px-2 py-1 rounded bg-indigo-600/80 hover:bg-indigo-600 text-white font-sans text-[10px] font-bold transition-all shadow-sm"
                                      title="Bu ürünün kartını ve hareketlerini aç"
                                    >
                                      Detay
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => filterLeftListFromAnalytics(it.stock.category, it.stock.sub_category)}
                                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                                      title="Sol listede filtrele"
                                    >
                                      <Filter size={11} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
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
            <h3 className="text-sm font-bold text-white mb-3">{editingStockCatId ? 'Kategoriyi Düzenle' : `Kategori Ekle (${warehouses.find(w => w.id === selectedWarehouseId)?.name})`}</h3>
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
              <h3 className="text-sm font-bold text-white flex items-center gap-2"><Package size={16} className="text-indigo-400" /> {editingWhId ? 'Depoyu Düzenle' : 'Yeni Depo Ekle'}</h3>
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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-400 font-medium">Tema Rengi ({WAREHOUSE_THEMES.length} Renk)</label>
                  {(() => {
                    const currentTheme = getWarehouseTheme(whColor)
                    return (
                      <span className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: currentTheme.hex }} />
                        {currentTheme.label}
                      </span>
                    )
                  })()}
                </div>

                {/* 16 Renkli Görsel Swatch Grid */}
                <div className="grid grid-cols-8 gap-2 p-2.5 bg-[#070b14] border border-slate-800 rounded-lg">
                  {WAREHOUSE_THEMES.map((col) => {
                    const isColSelected = whColor === col.value
                    return (
                      <button
                        key={col.value}
                        type="button"
                        onClick={() => setWhColor(col.value)}
                        title={col.label}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all relative ${isColSelected
                          ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#070b14] shadow-lg shadow-black/50 z-10'
                          : 'hover:scale-105 opacity-75 hover:opacity-100'
                          }`}
                        style={{ backgroundColor: col.hex }}
                      >
                        {isColSelected && <Check size={13} className="text-white drop-shadow stroke-[3]" />}
                      </button>
                    )
                  })}
                </div>

                {/* Canlı Önizleme */}
                {(() => {
                  const currentTheme = getWarehouseTheme(whColor)
                  return (
                    <div className="mt-2.5 p-2 rounded-lg bg-black/40 border border-slate-800/80 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider">Sekme Önizlemesi:</span>
                      <div className={`px-2.5 py-1 rounded-lg border bg-gradient-to-r ${currentTheme.value} ${currentTheme.border} shadow-sm ${currentTheme.glow} flex items-center gap-2`}>
                        <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: currentTheme.hex }} />
                        <Package size={12} className={currentTheme.text} />
                        <span className="text-xs font-bold text-white max-w-[140px] truncate">{whName || 'Örnek Depo'}</span>
                        <span className={`text-[10px] font-mono font-bold ${currentTheme.text}`}>125.000 ₺</span>
                      </div>
                    </div>
                  )
                })()}
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
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Package size={16} className="text-indigo-400" /> {editingStockId ? 'Stok Kartını Düzenle' : 'Yeni Stok Kartı Ekle'}</h3>
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
                  <Settings size={14} />
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

              {/* ctcmarket.com E-Ticaret & Web Ayarları */}
              <div className="col-span-2 mt-2 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Globe size={16} className="text-sky-400" />
                    <span className="text-white font-semibold text-xs flex items-center gap-1.5">
                      ctcmarket.com Web Ayarları
                    </span>
                    <span className="text-[10px] bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded border border-sky-500/20">
                      E-Ticaret
                    </span>
                  </div>

                  {/* Web Visible Toggle Switch */}
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className={`text-xs font-medium ${webVisible ? 'text-sky-400 font-bold' : 'text-slate-400'}`}>
                      {webVisible ? "Web'de Yayında" : "Web'de Gizli"}
                    </span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={webVisible}
                        onChange={(e) => setWebVisible(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-9 h-5 rounded-full transition-colors ${webVisible ? 'bg-sky-500' : 'bg-slate-700'}`}></div>
                      <div className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${webVisible ? 'transform translate-x-4' : ''}`}></div>
                    </div>
                  </label>
                </div>

                <div className={`p-3 rounded border transition-colors ${webVisible ? 'bg-sky-950/20 border-sky-500/30' : 'bg-[#0a0f1d] border-slate-800/80 opacity-90'}`}>
                  <div className="flex flex-col gap-2.5">
                    {/* Kategori Seçimleri */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-slate-400 mb-1 text-xs">
                          Web Ana Kategori {webVisible && <span className="text-rose-400">*</span>}
                        </label>
                        <select
                          value={webCategory}
                          onChange={(e) => {
                            setWebCategory(e.target.value)
                            setWebSubCategory('')
                          }}
                          className="w-full bg-[#070b14] border border-slate-700 rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-sky-500 transition-colors"
                        >
                          <option value="">Seçiniz...</option>
                          {webMainCategories.map(cat => (
                            <option key={cat.slug} value={cat.slug}>{cat.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1 text-xs">Web Alt Kategori</label>
                        <select
                          value={webSubCategory}
                          onChange={(e) => setWebSubCategory(e.target.value)}
                          disabled={!webCategory}
                          className="w-full bg-[#070b14] border border-slate-700 rounded px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-sky-500 transition-colors disabled:opacity-40"
                        >
                          <option value="">{webCategory ? 'Seçiniz (Opsiyonel)' : 'Önce Ana Kategori Seçin'}</option>
                          {getWebSubCategories(webCategory).map(sub => (
                            <option key={sub.slug} value={sub.slug}>{sub.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Web Fiyat Girişi & Kur */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-slate-400 mb-1 text-xs">
                          Web Satış Fiyatı (KDV Dahil) {webVisible && <span className="text-rose-400">*</span>}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={webPrice}
                          onChange={(e) => setWebPrice(e.target.value)}
                          className="w-full bg-[#070b14] border border-slate-700 rounded px-2.5 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-sky-500 transition-colors"
                        />
                      </div>
                      <div className="w-20">
                        <label className="block text-slate-400 mb-1 text-xs">Kur</label>
                        <select
                          value={webCurrency}
                          onChange={(e) => setWebCurrency(e.target.value as any)}
                          className="w-full bg-[#070b14] border border-slate-700 rounded px-1.5 py-1.5 text-white text-xs focus:outline-none focus:border-sky-500 transition-colors"
                        >
                          <option value="TRY">₺ TRY</option>
                          <option value="USD">$ USD</option>
                          <option value="EUR">€ EUR</option>
                        </select>
                      </div>
                    </div>

                    {/* Kâr Marjı Karşılaştırma Şeridi */}
                    {unitPrice && parseFloat(unitPrice) > 0 && webPrice && parseFloat(webPrice) > 0 ? (
                      <div className="flex items-center justify-between bg-sky-950/40 border border-sky-500/30 rounded px-3 py-2 text-xs">
                        <div className="flex items-center gap-2 text-slate-300">
                          <span>Alış: <strong className="text-white font-mono">{parseFloat(unitPrice).toFixed(2)} {currency}</strong></span>
                          <span className="text-slate-500">→</span>
                          <span>Web: <strong className="text-sky-300 font-mono">{parseFloat(webPrice).toFixed(2)} {webCurrency}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 font-medium">
                          <span className="text-slate-400 text-[11px]">Tahmini Kâr:</span>
                          <span className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${parseFloat(webPrice) >= parseFloat(unitPrice) ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                            %{(((parseFloat(webPrice) - parseFloat(unitPrice)) / parseFloat(unitPrice)) * 100).toFixed(1)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      webVisible && (
                        <div className="text-[11px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded px-2.5 py-1.5">
                          ⚠️ Ürünün ctcmarket.com'da yayında olması için web kategorisi ve satış fiyatı zorunludur.
                        </div>
                      )
                    )}
                  </div>
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

      {/* Toplu Kategori Atama Modalı */}
      {isBatchCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1329] border border-slate-700/80 rounded-xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Globe size={18} className="text-sky-400" />
                <h3 className="text-white font-bold text-sm">Toplu Web Kategorisi Ata</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchCategoryModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 mt-3 mb-4">
              Seçilen <span className="font-bold text-sky-400">{selectedStockIds.length}</span> ürüne toplu olarak web kategorisi ve alt kategorisi atanacaktır.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 mb-1 text-xs font-medium">Web Ana Kategori *</label>
                <select
                  value={batchSelectedWebCategory}
                  onChange={(e) => {
                    setBatchSelectedWebCategory(e.target.value)
                    setBatchSelectedWebSubCategory('')
                  }}
                  className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-sky-500"
                >
                  <option value="">Kategori Seçin...</option>
                  {webMainCategories.map(cat => (
                    <option key={cat.slug} value={cat.slug}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 text-xs font-medium">Web Alt Kategori (Opsiyonel)</label>
                <select
                  value={batchSelectedWebSubCategory}
                  onChange={(e) => setBatchSelectedWebSubCategory(e.target.value)}
                  disabled={!batchSelectedWebCategory}
                  className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-sky-500 disabled:opacity-40"
                >
                  <option value="">{batchSelectedWebCategory ? 'Alt Kategori Seçin (Opsiyonel)' : 'Önce Ana Kategori Seçin'}</option>
                  {getWebSubCategories(batchSelectedWebCategory).map(sub => (
                    <option key={sub.slug} value={sub.slug}>{sub.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsBatchCategoryModalOpen(false)}
                className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800 text-xs transition-colors"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleApplyBatchCategory}
                disabled={!batchSelectedWebCategory || batchLoading}
                className="bg-sky-600 hover:bg-sky-500 text-white font-medium px-4 py-2 rounded-lg text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {batchLoading ? 'Uygulanıyor...' : 'Kategorileri Uygula'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toplu Fiyat Güncelleme Modalı */}
      {isBatchPriceModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1329] border border-slate-700/80 rounded-xl p-6 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Globe size={18} className="text-emerald-400" />
                <h3 className="text-white font-bold text-sm">Toplu Web Fiyatı Güncelle (% Kâr Marjı)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchPriceModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 mt-3 mb-4">
              Seçilen <span className="font-bold text-emerald-400">{selectedStockIds.length}</span> ürünün web satış fiyatı, ERP alış maliyeti üzerine belirlediğiniz kâr marjı eklenerek otomatik hesaplanacaktır:
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1 text-xs font-medium">Hedef Kâr Marjı (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={batchProfitPercent}
                    onChange={(e) => setBatchProfitPercent(e.target.value)}
                    placeholder="30"
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-bold">%</span>
                </div>
              </div>

              {/* Hızlı Yüzde Butonları */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Hızlı Seçim:</span>
                {['20', '30', '40', '50', '75', '100'].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setBatchProfitPercent(pct)}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${batchProfitPercent === pct ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-slate-800/60 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
                  >
                    %{pct}
                  </button>
                ))}
              </div>

              <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-lg p-3 text-xs text-emerald-300">
                <p className="font-semibold mb-1">Formül:</p>
                <p className="text-[11px] font-mono text-emerald-200">
                  Web Satış Fiyatı = Alış Fiyatı × (1 + %{batchProfitPercent || '0'} / 100)
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  * Alış fiyatı 0 olan veya para birimi farklı olan ürünler de orantılı hesaplanır.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsBatchPriceModalOpen(false)}
                className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800 text-xs transition-colors"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleApplyBatchPrice}
                disabled={batchLoading || !batchProfitPercent}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-lg text-xs transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {batchLoading ? 'Hesaplanıyor...' : 'Fiyatları Güncelle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODEL 3: DEPOLAR ARASI TRANSFER MODALI */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 9999 }}>
          <div className="bg-[#0f172a] border border-cyan-500/30 rounded-2xl w-full max-w-xl p-6 shadow-2xl shadow-cyan-950/40 animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400">
                  <ArrowRightLeft size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Depolar Arası Ürün Transferi
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 font-mono font-medium">Model 3</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">Depolar arasında ürün aktarın, transfer maliyeti ve kâr farkını yönetin.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleExecuteTransfer} className="space-y-4 pt-4 overflow-y-auto pr-1 text-xs flex-1">
              {/* Kaynak ve Hedef Depo Seçimi */}
              <div className="grid grid-cols-2 gap-3 bg-[#070b14] p-3 rounded-xl border border-slate-800/80">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold text-[11px]">
                    Kaynak Depo (Çıkış) *
                  </label>
                  <select
                    value={trfSourceWarehouseId}
                    onChange={(e) => handleTrfSourceWarehouseChange(e.target.value)}
                    required
                    className="w-full bg-[#0a0f1d] border border-slate-700 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors"
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id} disabled={w.id === trfTargetWarehouseId}>
                        {w.name} {w.company?.name ? `(${w.company.name})` : '(Ortak)'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-cyan-400 mb-1 font-semibold text-[11px]">
                    Hedef Depo (Giriş) *
                  </label>
                  <select
                    value={trfTargetWarehouseId}
                    onChange={(e) => setTrfTargetWarehouseId(e.target.value)}
                    required
                    className="w-full bg-[#0a0f1d] border border-cyan-700/60 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none focus:border-cyan-400 transition-colors"
                  >
                    {warehouses.filter(w => w.id !== trfSourceWarehouseId).map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} {w.company?.name ? `(${w.company.name})` : '(Ortak)'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ürün Seçimi & Arama */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400 font-semibold text-[11px] flex items-center gap-1.5">
                    <span>Transfer Edilecek Ürün (Kaynak Depodan) *</span>
                    {filteredTransferStocks.length > 0 && trfSearchTerm && (
                      <span className="text-[10px] text-cyan-400 font-mono">({filteredTransferStocks.length} ürün bulundu)</span>
                    )}
                  </label>
                  {sourceStock && (
                    <span className="text-[10px] text-emerald-400 font-medium font-mono">
                      Mevcut Stok: {sourceStock.quantity} {sourceStock.unit || 'Adet'}
                    </span>
                  )}
                </div>

                {/* Canlı Arama Inputu ve Dropdown Tetikleyici */}
                <div className="relative">
                  <div className="relative flex items-center">
                    <Search size={14} className="absolute left-3 text-cyan-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Kaynak depoda ürün adı, barkod / SKU veya kategori ara..."
                      value={trfSearchTerm}
                      onChange={(e) => {
                        setTrfSearchTerm(e.target.value)
                        setIsTrfDropdownOpen(true)
                      }}
                      onFocus={() => setIsTrfDropdownOpen(true)}
                      className="w-full bg-[#070b14] border border-slate-700 focus:border-cyan-500 rounded-lg pl-9 pr-16 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none transition-colors"
                    />
                    <div className="absolute right-2 flex items-center gap-1">
                      {trfSearchTerm && (
                        <button
                          type="button"
                          onClick={() => {
                            setTrfSearchTerm('')
                            setIsTrfDropdownOpen(true)
                          }}
                          className="text-slate-500 hover:text-white p-1 transition"
                          title="Aramayı Temizle"
                        >
                          <X size={12} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsTrfDropdownOpen(!isTrfDropdownOpen)}
                        className="text-slate-400 hover:text-cyan-400 p-1 transition"
                        title={isTrfDropdownOpen ? "Listeyi Kapat" : "Tüm Listeyi Göster"}
                      >
                        <ChevronDown size={14} className={`transition-transform duration-200 ${isTrfDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Arama Sonuçları Açılır Menüsü */}
                  {isTrfDropdownOpen && (
                    <>
                      {/* Dışarı tıklama kapatıcı */}
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setIsTrfDropdownOpen(false)}
                      />
                      <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#0b1222] border border-cyan-500/40 rounded-xl shadow-2xl z-40 max-h-52 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-1 duration-150 divide-y divide-slate-800/60">
                        {filteredTransferStocks.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-400">
                            Eşleşen ürün bulunamadı.
                          </div>
                        ) : (
                          filteredTransferStocks.map(s => {
                            const isSelected = s.id === trfStockId
                            const isOutOfStock = (s.quantity || 0) <= 0
                            return (
                              <div
                                key={s.id}
                                onClick={() => {
                                  handleTrfStockChange(s.id)
                                  setTrfSearchTerm(s.name)
                                  setIsTrfDropdownOpen(false)
                                }}
                                className={`p-2 px-3 cursor-pointer transition-colors text-xs ${isSelected
                                  ? 'bg-cyan-950/70 text-cyan-200'
                                  : 'hover:bg-cyan-900/30 text-slate-200'
                                  } ${isOutOfStock ? 'opacity-60' : ''}`}
                              >
                                {/* 1. Satır: Ürün İsmi (Normal Ağırlıkta, Geniş Alan) ve Stok Adedi */}
                                <div className="flex items-center justify-between gap-3">
                                  <span
                                    className="font-normal text-slate-100 text-[12px] leading-tight truncate flex-1 tracking-tight"
                                    title={s.name}
                                  >
                                    {s.name}
                                  </span>
                                  <div className="text-right shrink-0 flex items-center gap-1.5 font-mono">
                                    <span className={`text-[11px] font-medium ${(s.quantity || 0) > 0 ? 'text-emerald-400' : 'text-rose-400'
                                      }`}>
                                      {s.quantity} {s.unit || 'Adet'}
                                    </span>
                                    {isOutOfStock && (
                                      <span className="text-[9px] px-1 py-0.2 rounded bg-rose-950/60 text-rose-400 border border-rose-800/60 font-sans">
                                        Tükendi
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* 2. Satır: SKU, Kategori ve Birim Maliyet */}
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1 flex-wrap">
                                  {s.sku && (
                                    <span className="font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700/80">
                                      {s.sku}
                                    </span>
                                  )}
                                  {s.category && (
                                    <span className="px-1.5 py-0.2 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/40">
                                      {s.category}
                                    </span>
                                  )}
                                  <span className="text-slate-600">•</span>
                                  <span>
                                    Birim Maliyet: <strong className="text-slate-300 font-normal">{formatMoney(s.unit_price, s.currency || 'TRY').formatted}</strong>
                                  </span>
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Seçili Ürün Kartı */}
                {sourceStock ? (
                  <div className="mt-2 p-2 px-3 rounded-lg bg-cyan-950/20 border border-cyan-500/30 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 animate-pulse" />
                      <span className="font-normal text-slate-100 truncate text-[12px] tracking-tight" title={sourceStock.name}>
                        {sourceStock.name}
                      </span>
                      {sourceStock.sku && (
                        <span className="text-[10px] font-mono text-cyan-300 shrink-0">[{sourceStock.sku}]</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-mono text-emerald-400 font-medium">
                        Stok: {sourceStock.quantity} {sourceStock.unit || 'Adet'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setTrfSearchTerm('')
                          setIsTrfDropdownOpen(true)
                        }}
                        className="text-[10px] text-cyan-300 hover:text-white underline ml-1"
                      >
                        Değiştir
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-500 mt-1">
                    * Yukarıdaki arama kutusuna yazarak veya listeyi açarak kaynak depodan aktarılacak ürünü seçin.
                  </p>
                )}

                {allStocks.filter(s => s.warehouse_id === trfSourceWarehouseId).length === 0 && (
                  <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
                    <AlertTriangle size={12} /> Bu kaynak depoda kayıtlı ürün bulunamadı.
                  </p>
                )}
              </div>

              {/* Miktar ve Tarih */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold text-[11px]">
                    Transfer Miktarı ({sourceStock?.unit || 'Adet'}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    max={sourceStock?.quantity || undefined}
                    required
                    placeholder="1"
                    value={trfQuantity}
                    onChange={(e) => setTrfQuantity(e.target.value)}
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold text-[11px]">
                    Transfer Tarihi *
                  </label>
                  <input
                    type="date"
                    required
                    value={trfDate}
                    onChange={(e) => setTrfDate(e.target.value)}
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                </div>
              </div>

              {/* Fiyatlandırma ve Model 3 Kâr Ayarı */}
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-300">Fiyatlandırma & Kâr Ayarı</span>
                  {sourceStock && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      Kaynak Maliyeti: <strong className="text-white">{formatMoney(sourceCost, sourceStock.currency || 'TRY').formatted}</strong>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[10px] text-slate-400 mb-1">
                      Transfer Birim Fiyatı (Hedef Giriş Maliyeti) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      value={trfUnitPrice}
                      onChange={(e) => setTrfUnitPrice(e.target.value)}
                      className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono font-bold focus:outline-none focus:border-cyan-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Para Birimi</label>
                    <select
                      value={trfCurrency}
                      onChange={(e) => setTrfCurrency(e.target.value as any)}
                      className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 font-mono focus:outline-none focus:border-cyan-500 transition-colors"
                    >
                      <option value="TRY">TRY (₺)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>
                </div>

                {/* Fark / Kâr Bilgilendirme Rozeti */}
                {sourceStock && (
                  <div className={`p-2.5 rounded-lg border text-[11px] flex items-center justify-between gap-2 ${priceDiff > 0
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                    : priceDiff < 0
                      ? 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                      : 'bg-slate-800/40 border-slate-700/60 text-slate-400'
                    }`}>
                    <span>
                      {priceDiff > 0 ? (
                        <>Birim Fark: <strong className="font-mono text-emerald-400">+{formatMoney(priceDiff, trfCurrency).formatted}</strong> (+%{profitMarginPercent.toFixed(1)} Kâr)</>
                      ) : priceDiff < 0 ? (
                        <>Birim Fark: <strong className="font-mono text-rose-400">{formatMoney(priceDiff, trfCurrency).formatted}</strong> (%{profitMarginPercent.toFixed(1)} İndirimli/Zararlı)</>
                      ) : (
                        <>Birebir Maliyetten Transfer (Fiyat Farkı Yok)</>
                      )}
                    </span>
                    {priceDiff !== 0 && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 border border-current">
                        Toplam Fark: {formatMoney(priceDiff * (parseFloat(trfQuantity) || 1), trfCurrency).formatted}
                      </span>
                    )}
                  </div>
                )}

                {/* Model 3: Kâr Kaydı Onay Kutusu */}
                {priceDiff > 0 && (
                  <label className="flex items-start gap-2.5 p-2 rounded-lg bg-cyan-950/20 border border-cyan-500/30 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={trfRecordProfit}
                      onChange={(e) => setTrfRecordProfit(e.target.checked)}
                      className="mt-0.5 rounded border-slate-700 text-cyan-600 focus:ring-cyan-500 w-4 h-4 bg-[#070b14]"
                    />
                    <div className="text-[11px] leading-tight text-slate-300">
                      <span className="font-semibold text-cyan-300">Fiyat farkını kaynak merkeze kâr / iç satış hasılatı olarak kaydet (Model 3)</span>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        İşaretlendiğinde, kaynak merkez için iç satış kârı tahakkuk eder; hedef depo ise yeni fiyattan envanterine alır.
                      </p>
                    </div>
                  </label>
                )}
              </div>

              {/* Transfer Notu */}
              <div>
                <label className="block text-slate-400 mb-1 font-semibold text-[11px]">
                  Transfer Notu / Açıklama (İsteğe Bağlı)
                </label>
                <input
                  type="text"
                  placeholder="Örn: Şube açılış sevkiyatı, acil parça ihtiyacı..."
                  value={trfNote}
                  onChange={(e) => setTrfNote(e.target.value)}
                  className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800 text-xs transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={trfLoading || !trfStockId || !trfQuantity}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-5 py-2 rounded-lg text-xs transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-cyan-950/50"
                >
                  <ArrowRightLeft size={14} />
                  {trfLoading ? 'Transfer Ediliyor...' : 'Transferi Tamamla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* --- REÇETE DÜZENLEME & BİLEŞEN YÖNETİMİ MODALI (MODEL C) --- */}
      {/* ========================================================================= */}
      {isRecipeModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 9999 }}>
          <div className="bg-[#0f172a] border border-amber-500/40 rounded-2xl w-full max-w-2xl p-6 shadow-2xl shadow-amber-950/40 animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-400">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Ürün Reçetesi & Bileşen Yönetimi
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/40 font-mono font-medium">Model C</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {recipeStock ? (
                      <>Reçeteli ürünü (<strong className="text-amber-300">{recipeProductName || recipeStock.name}</strong>), parçaları ve ek sarf masraflarını belirleyin.</>
                    ) : (
                      <>Yeni bir reçeteli ürün oluşturun, parçaları ve ek sarf masraflarını belirleyin.</>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRecipeModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 pt-4 overflow-y-auto pr-1 text-xs flex-1 custom-scrollbar">
              {/* ÜRÜN TANIMLAMA KARTI: İsim, Depo, Para Birimi, Kategori */}
              <div className="bg-[#070b14] p-3.5 rounded-xl border border-slate-800 space-y-3">
                {/* 1. Satır: Reçeteden Oluşacak Ürün İsmi */}
                <div>
                  <label className="block text-amber-300 font-semibold text-[11px] mb-1 flex items-center justify-between">
                    <span>Reçeteden Oluşacak Ürün İsmi *</span>
                    <span className="text-[10px] text-slate-400 font-normal">Montajda üretilecek nihai ürünün adı</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={recipeProductName}
                    onChange={(e) => setRecipeProductName(e.target.value)}
                    placeholder="Örn: P1.53 192x64 LED Tabela, Özel Kasa..."
                    className="w-full bg-[#0a0f1d] border border-amber-500/40 rounded-lg px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:border-amber-400 transition-colors"
                  />
                </div>

                {/* 2. Satır: Depo, Para Birimi, Ölçü Birimi */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1 font-semibold">Hedef Depo *</label>
                    <select
                      value={recipeStock ? recipeStock.warehouse_id : recipeProductWarehouseId}
                      onChange={(e) => setRecipeProductWarehouseId(e.target.value)}
                      disabled={!!recipeStock}
                      className="w-full bg-[#0a0f1d] border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-amber-500 disabled:opacity-60"
                    >
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1 font-semibold">Maliyet Para Birimi *</label>
                    <select
                      value={recipeStock ? (recipeStock.currency || 'TRY') : recipeProductCurrency}
                      onChange={(e) => setRecipeProductCurrency(e.target.value as any)}
                      disabled={!!recipeStock}
                      className="w-full bg-[#0a0f1d] border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-amber-500 disabled:opacity-60 font-mono"
                    >
                      <option value="TRY">TRY (₺)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1 font-semibold">Ölçü Birimi</label>
                    <input
                      type="text"
                      value={recipeProductUnit}
                      onChange={(e) => setRecipeProductUnit(e.target.value)}
                      placeholder="Adet, m², Set..."
                      className="w-full bg-[#0a0f1d] border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* 3. Satır: Kategori & SKU */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1 font-semibold">Kategori</label>
                    <input
                      type="text"
                      value={recipeProductCategory}
                      onChange={(e) => setRecipeProductCategory(e.target.value)}
                      placeholder="Örn: Tabela & Montaj"
                      className="w-full bg-[#0a0f1d] border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-[10px] mb-1 font-semibold">SKU / Barkod (İsteğe Bağlı)</label>
                    <input
                      type="text"
                      value={recipeProductSku}
                      onChange={(e) => setRecipeProductSku(e.target.value)}
                      placeholder="Örn: TBL-P153-01"
                      className="w-full bg-[#0a0f1d] border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Reçeteli Ürün Durum Seçimi */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#070b14] border border-slate-800">
                <div>
                  <span className="font-semibold text-slate-200 block text-[11px]">Reçeteli / Montaj Ürünü Durumu</span>
                  <span className="text-[10px] text-slate-400">Bu ürün birden fazla parçanın montajı ile mi oluşturuluyor?</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recipeIsComposite}
                    onChange={(e) => setRecipeIsComposite(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              {/* Bileşen Parça Arama ve Ekleme Combobox */}
              <div className="bg-[#070b14] p-3 rounded-xl border border-slate-800 space-y-2">
                <label className="block text-slate-300 font-semibold text-[11px] flex items-center justify-between">
                  <span>Reçeteye Parça Ekle (Seçili Depodan)</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    Depo: {warehouses.find(w => w.id === (recipeStock?.warehouse_id || recipeProductWarehouseId || selectedWarehouseId))?.name || 'Seçili Depo'}
                  </span>
                </label>
                <div className="relative">
                  <div className="relative flex items-center">
                    <Search size={13} className="absolute left-3 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Parça adı veya SKU ara (örn: LED panel, trafo, kart)..."
                      value={recipeSearchTerm}
                      onFocus={() => setIsRecipeDropdownOpen(true)}
                      onChange={(e) => {
                        setRecipeSearchTerm(e.target.value)
                        setIsRecipeDropdownOpen(true)
                      }}
                      className="w-full bg-[#0a0f1d] border border-slate-700 rounded-lg pl-8 pr-8 py-2 text-slate-200 text-xs focus:outline-none focus:border-amber-500 transition-colors"
                    />
                    {recipeSearchTerm && (
                      <button
                        type="button"
                        onClick={() => {
                          setRecipeSearchTerm('')
                          setIsRecipeDropdownOpen(false)
                        }}
                        className="absolute right-2.5 text-slate-400 hover:text-white p-0.5"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Dropdown Sonuçları - Açılır Kategorili Görünüm */}
                  {isRecipeDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setIsRecipeDropdownOpen(false)} />
                      <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#0b1222] border border-amber-500/50 rounded-xl shadow-2xl z-40 max-h-72 overflow-y-auto custom-scrollbar flex flex-col divide-y divide-slate-800/60">
                        {/* Üst Bar: Bilgi & Tümünü Genişlet/Daralt */}
                        <div className="sticky top-0 z-30 bg-[#080d19] px-3 py-1.5 border-b border-slate-800 flex items-center justify-between text-[10px] shrink-0">
                          <span className="text-slate-400 font-medium">
                            Kategorili Depo Stoğu ({recipeCandidateStocks.length} parça)
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleAllRecipeCategories()
                            }}
                            className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <ChevronsUpDown size={11} />
                            <span>Tümünü Aç / Kapat</span>
                          </button>
                        </div>

                        {recipeGroupedHierarchy.length === 0 ? (
                          <div className="p-4 text-center text-slate-400 text-xs">Aramaya uygun parça bulunamadı.</div>
                        ) : (
                          <div>
                            {recipeGroupedHierarchy.map(catGroup => {
                              const isSearchActive = recipeSearchTerm.trim().length > 0
                              const isCatOpen = isSearchActive ? true : (recipeOpenCategories[catGroup.name] !== false)

                              return (
                                <div key={catGroup.name} className="border-b border-slate-800/60 last:border-b-0">
                                  {/* Kategori Başlığı (Akordeon) */}
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleRecipeCategory(catGroup.name)
                                    }}
                                    className="sticky top-[29px] z-20 bg-[#0a0f1d]/95 backdrop-blur-md px-3 py-1.5 border-b border-amber-500/20 flex items-center justify-between cursor-pointer hover:bg-amber-950/40 transition-colors select-none group"
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                      <span className="text-amber-400/80 group-hover:text-amber-300 transition-transform">
                                        {isCatOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                      </span>
                                      <Layers size={11} className="text-amber-400 shrink-0" />
                                      <span className="text-[11px] font-bold text-amber-200 uppercase tracking-wide truncate">
                                        {catGroup.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0 text-[10px] font-mono">
                                      <span className="px-1.5 py-0.2 rounded bg-amber-950/80 border border-amber-500/30 text-amber-300">
                                        {catGroup.totalCount} ürün
                                      </span>
                                      <span className="px-1.5 py-0.2 rounded bg-slate-800/90 text-emerald-400 font-medium border border-slate-700">
                                        {catGroup.totalQuantity} ad.
                                      </span>
                                    </div>
                                  </div>

                                  {/* Kategori İçeriği */}
                                  {isCatOpen && (
                                    <div className="bg-[#070b14]/50">
                                      {catGroup.subGroups.map(subGroup => {
                                        const subKey = `${catGroup.name}__${subGroup.name}`
                                        const isSubCollapsed = isSearchActive ? false : !!recipeCollapsedSubCategories[subKey]
                                        const hasSubHeader = !!subGroup.name

                                        return (
                                          <div key={subKey} className="border-b border-slate-800/40 last:border-b-0">
                                            {/* Alt Kategori Başlığı (Tanımlıysa) */}
                                            {hasSubHeader && (
                                              <div
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  toggleRecipeSubCategory(subKey)
                                                }}
                                                className="bg-[#090f1d] px-3 py-1 border-b border-slate-800/30 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition-colors select-none group/sub"
                                              >
                                                <div className="flex items-center gap-1.5 pl-3 min-w-0 pr-2">
                                                  <span className="text-slate-500 group-hover/sub:text-teal-400 transition-transform">
                                                    {isSubCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                                                  </span>
                                                  <Tag size={10} className="text-teal-400/80 shrink-0" />
                                                  <span className="text-[10px] font-semibold text-teal-300 truncate">
                                                    {subGroup.name}
                                                  </span>
                                                </div>
                                                <span className="text-[9px] text-slate-400 font-mono pr-1">
                                                  {subGroup.items.length} ürün
                                                </span>
                                              </div>
                                            )}

                                            {/* Ürün Satırları */}
                                            {!isSubCollapsed && (
                                              <div className="divide-y divide-slate-800/40">
                                                {subGroup.items.map(stock => {
                                                  const isAlreadyInRecipe = recipeComponents.some(c => c.stock_id === stock.id)
                                                  return (
                                                    <div
                                                      key={stock.id}
                                                      onClick={() => {
                                                        if (!isAlreadyInRecipe) addComponentToRecipe(stock)
                                                      }}
                                                      className={`p-2 ${hasSubHeader ? 'pl-7' : 'pl-4'} pr-3 text-xs flex items-center justify-between transition-colors ${
                                                        isAlreadyInRecipe
                                                          ? 'opacity-40 cursor-not-allowed bg-slate-900/40'
                                                          : 'hover:bg-amber-950/40 text-slate-200 cursor-pointer'
                                                      } ${stock.quantity <= 0 ? 'opacity-60 bg-rose-950/5' : ''}`}
                                                    >
                                                      <div className="flex-1 min-w-0 pr-3">
                                                        <div className="flex items-center gap-1.5">
                                                          <span className={`font-normal text-[12px] leading-tight truncate ${stock.quantity <= 0 ? 'text-slate-400 line-through decoration-slate-600' : 'text-slate-100'}`} title={stock.name}>
                                                            {stock.name}
                                                          </span>
                                                          {stock.sku && (
                                                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700/80 font-mono shrink-0">
                                                              {stock.sku}
                                                            </span>
                                                          )}
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1 flex-wrap">
                                                          {stock.category && (
                                                            <span className="px-1.5 py-0.2 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40">
                                                              {stock.category}
                                                            </span>
                                                          )}
                                                          <span className="text-slate-600">•</span>
                                                          <span>
                                                            Birim Maliyet: <strong className="text-slate-300 font-normal">{formatMoney(stock.unit_price, stock.currency || 'TRY').formatted}</strong>
                                                          </span>
                                                        </div>
                                                      </div>
                                                      <div className="text-right shrink-0">
                                                        <span className={`text-[11px] font-mono font-medium ${stock.quantity > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                          {stock.quantity} {stock.unit || 'Adet'}
                                                        </span>
                                                        {isAlreadyInRecipe && (
                                                          <span className="block text-[9px] text-amber-400 font-medium">✓ Ekli</span>
                                                        )}
                                                      </div>
                                                    </div>
                                                  )
                                                })}
                                              </div>
                                            )}
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Ekli Bileşenler Tablosu */}
              <div className="bg-[#070b14] p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 text-[11px] flex items-center gap-1.5">
                    <Layers size={13} className="text-amber-400" />
                    Reçetedeki Bileşenler ({recipeComponents.length})
                  </span>
                  <span className="text-[10px] text-slate-400">
                    1 {recipeProductUnit || recipeStock?.unit || 'Adet'} ürün için gereken miktarlar
                  </span>
                </div>

                {recipeComponents.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 italic border border-dashed border-slate-800 rounded-lg text-xs">
                    Henüz bileşen eklenmedi. Yukarıdaki arama kutusundan depodaki parçaları seçin.
                  </div>
                ) : (
                  <div className="border border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-800/80">
                    {currentRecipeCalculation.itemsDetail.map((item, idx) => {
                      const effectiveCurr = recipeStock?.currency || recipeProductCurrency
                      return (
                        <div key={idx} className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-900/30 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-200 text-xs truncate">{item.component.name}</span>
                              {item.component.sku && (
                                <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400 font-mono">{item.component.sku}</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                              <span>Güncel Alış: <strong className="text-slate-300">{formatMoney(item.unitCost, effectiveCurr).formatted}</strong></span>
                              <span className="text-slate-500">•</span>
                              <span>Mevcut Depo Stoğu: <strong className={item.inStockQty > 0 ? 'text-emerald-400' : 'text-rose-400'}>{item.inStockQty} {item.component.unit || 'ad.'}</strong></span>
                            </div>
                          </div>

                          {/* Miktar Girişi ve Tutar */}
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0.001"
                                step="any"
                                value={item.component.quantity}
                                onChange={(e) => updateComponentQuantity(item.component.stock_id, parseFloat(e.target.value) || 0)}
                                className="w-16 bg-[#0a0f1d] border border-slate-700 rounded px-2 py-1 text-center font-mono text-xs text-white focus:outline-none focus:border-amber-500"
                              />
                              <span className="text-[10px] text-slate-400 w-8">{item.component.unit || 'ad.'}</span>
                            </div>

                            <div className="text-right w-24">
                              <span className="text-xs font-mono font-bold text-amber-300 block">
                                {formatMoney(item.totalCost, effectiveCurr).formatted}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeComponentFromRecipe(item.component.stock_id)}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition-colors"
                              title="Bileşeni Kaldır"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Stok Dışı İlave Masraflar */}
              <div className="bg-[#070b14] p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <label className="block text-slate-300 font-semibold text-[11px] mb-0.5">
                    Stok Dışı İlave Masraflar ({recipeStock?.currency || recipeProductCurrency || 'TRY'})
                  </label>
                  <p className="text-[10px] text-slate-400">
                    Vida, kablo, lehim teli, işçilik vb. stokta tutulmayan sarf giderleri.
                  </p>
                </div>
                <div className="w-36 shrink-0">
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={recipeAdditionalCost}
                      onChange={(e) => setRecipeAdditionalCost(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-[#0a0f1d] border border-slate-700 rounded-lg px-3 py-1.5 text-right font-mono text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 pointer-events-none">
                      {(recipeStock?.currency || recipeProductCurrency) === 'USD' ? '$' : (recipeStock?.currency || recipeProductCurrency) === 'EUR' ? '€' : '₺'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dinamik Canlı Maliyet Kartı */}
              <div className="bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-slate-900 border border-amber-500/40 p-3.5 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider block">Otomatik Hesaplanan Birim Maliyet</span>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Parçalar ({formatMoney(currentRecipeCalculation.componentsCost, recipeStock?.currency || recipeProductCurrency).formatted}) + Ek Masraf ({formatMoney(parseFloat(recipeAdditionalCost) || 0, recipeStock?.currency || recipeProductCurrency).formatted})
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-amber-200 font-mono">
                    {formatMoney(currentRecipeCalculation.totalCost, recipeStock?.currency || recipeProductCurrency).formatted}
                  </div>
                  <span className="text-[9px] text-slate-400">/ 1 {recipeProductUnit || recipeStock?.unit || 'Adet'}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800 shrink-0 mt-2">
              <button
                type="button"
                onClick={() => setIsRecipeModalOpen(false)}
                className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800 text-xs transition-colors"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleSaveRecipe}
                className="bg-amber-600 hover:bg-amber-500 text-white font-semibold px-5 py-2 rounded-lg text-xs transition-all active:scale-95 flex items-center gap-1.5 shadow-lg shadow-amber-950/50"
              >
                <Check size={14} />
                Reçeteyi Kaydet ve Maliyeti Güncelle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* --- FİZİKSEL MONTAJ / ÜRETİM MODALI (MODEL C) --- */}
      {/* ========================================================================= */}
      {isAssemblyModalOpen && assemblyStock && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 9999 }}>
          <div className="bg-[#0f172a] border border-emerald-500/40 rounded-2xl w-full max-w-xl p-6 shadow-2xl shadow-emerald-950/40 animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-400">
                  <Package size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    🛠️ Montaj / Üretim Yap
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-mono font-medium">Fiziksel Montaj</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Bileşenler depodan düşülecek, üretilen ürün stoğa giriş yapılacaktır.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAssemblyModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleExecuteAssembly} className="space-y-4 pt-4 overflow-y-auto pr-1 text-xs flex-1 custom-scrollbar">
              {/* Reçeteli Ürün Şablonu & İsim Özelleştirme Kartı */}
              <div className="bg-[#070b14] p-3.5 rounded-xl border border-slate-800 space-y-3">
                {/* Reçeteli Ürün Şablonu Seçici */}
                <div>
                  <label className="block text-slate-400 text-[10px] font-semibold mb-1 uppercase tracking-wide">
                    Reçeteli Ürün Şablonu
                  </label>
                  <select
                    value={assemblyStock.id}
                    onChange={(e) => {
                      const found = allStocks.find(s => s.id === e.target.value)
                      if (found) {
                        setAssemblyStock(found)
                        setAssemblyCustomName(found.name)
                      }
                    }}
                    className="w-full bg-[#0a0f1d] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:border-emerald-500 transition-colors"
                  >
                    {allStocks
                      .filter(s => s.is_composite && s.recipe_components && s.recipe_components.length > 0 && s.warehouse_id === assemblyStock.warehouse_id)
                      .map(cs => (
                        <option key={cs.id} value={cs.id}>
                          {cs.name} - Maliyet: {formatMoney(cs.unit_price, cs.currency).formatted}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Üretilecek Ürünün İsmi (Kullanıcı Talebi: Montaj ekranında ürüne yeni bir isim vermek istiyorum) */}
                <div>
                  <label className="block text-emerald-300 font-semibold text-[11px] mb-1 flex items-center justify-between">
                    <span>Üretilen / Stoğa Alınacak Ürün İsmi *</span>
                    <span className="text-[10px] text-slate-400 font-normal">Bu montaj için özel ürün ismi belirleyebilirsiniz</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={assemblyCustomName}
                    onChange={(e) => setAssemblyCustomName(e.target.value)}
                    placeholder="Örn: P1.53 LED Panel GOB - Özel Kasa 192x64"
                    className="w-full bg-[#0a0f1d] border border-emerald-500/40 rounded-lg px-3 py-2 text-emerald-200 text-xs font-semibold focus:outline-none focus:border-emerald-400 transition-colors"
                  />
                </div>

                {/* Depo ve Mevcut Stok Bilgisi */}
                <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400 border-t border-slate-800/80">
                  <span>İlgili Depo: <strong className="text-emerald-400">{warehouses.find(w => w.id === assemblyStock.warehouse_id)?.name}</strong></span>
                  <span>Mevcut Stok: <strong className="text-white font-mono">{assemblyStock.quantity} {assemblyStock.unit || 'Adet'}</strong></span>
                </div>
              </div>

              {/* Miktar ve Tarih */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold text-[11px] mb-1">
                    Üretim / Montaj Miktarı ({assemblyStock.unit || 'Adet'}) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={assemblyQuantity}
                    onChange={(e) => setAssemblyQuantity(e.target.value)}
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold text-[11px] mb-1">
                    Montaj Tarihi *
                  </label>
                  <input
                    type="date"
                    required
                    value={assemblyDate}
                    onChange={(e) => setAssemblyDate(e.target.value)}
                    className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              {/* Bileşen Yeterlilik Kontrol Tablosu */}
              <div className="bg-[#070b14] p-3 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300 text-[11px]">Bileşen Stok Kontrolü</span>
                  <span className="text-[10px] text-slate-400">Montaj için gerekli miktarlar</span>
                </div>

                <div className="border border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-800/80">
                  {assemblyStock.recipe_components?.map((comp, idx) => {
                    const partStock = allStocks.find(s => s.id === comp.stock_id)
                    const reqQty = Number(comp.quantity || 0) * (parseFloat(assemblyQuantity) || 1)
                    const availableQty = Number(partStock?.quantity || 0)
                    const hasEnough = availableQty >= reqQty

                    return (
                      <div key={idx} className="p-2.5 flex items-center justify-between gap-2 text-xs">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-200 truncate">{comp.name}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Birim Başına: {comp.quantity} {comp.unit || 'ad.'} • Gerekli: <strong className="text-white font-mono">{reqQty} {comp.unit || 'ad.'}</strong>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                            hasEnough
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-950/80 text-rose-300 border border-rose-500/30'
                          }`}>
                            {hasEnough ? `Yeterli (${availableQty} mevcut)` : `YETERSİZ (${availableQty} mevcut)`}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Maliyet ve Parti Özeti */}
              <div className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wide block">Tahmini Parti Üretim Maliyeti</span>
                  <span className="text-[10px] text-slate-400">
                    Birim: {formatMoney(assemblyStock.unit_price, assemblyStock.currency).formatted} × {parseFloat(assemblyQuantity) || 1}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold text-emerald-300 font-mono">
                    {formatMoney((assemblyStock.unit_price || 0) * (parseFloat(assemblyQuantity) || 1), assemblyStock.currency).formatted}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAssemblyModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800 text-xs transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAssembly}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-5 py-2 rounded-lg text-xs transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-emerald-950/50"
                >
                  <Package size={14} />
                  {isSubmittingAssembly ? 'Montaj Yapılıyor...' : '🛠️ Montajı Tamamla ve Stoğa Al'}
                </button>
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
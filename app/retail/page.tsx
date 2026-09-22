'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Save, Wallet, CreditCard, Eye, EyeOff, Landmark, X, Trash2, StickyNote, Loader2, AlertTriangle, Settings, ArrowRightLeft, Package, Search, Wrench, ExternalLink } from 'lucide-react'
import { formatMoney } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import toast, { Toaster } from 'react-hot-toast'

const CATEGORIES = [
  { id: 'aksesuar', name: 'Aksesuar & Sarf Malzeme', color: 'bg-emerald-600' },
  { id: 'oyun_prog', name: 'Oyun & Prog Yükleme', color: 'bg-teal-600' },
  { id: 'dvd_harici', name: 'DVD & Hariciye (Film, müzik, oyun, prg vs.)', color: 'bg-emerald-600' },
  { id: 'orjinal', name: 'Orjinal Film & Oyun', color: 'bg-teal-600' },
  { id: 'diger', name: 'Diğer', color: 'bg-emerald-600' },
  { id: 'servis', name: 'Servis', color: 'bg-teal-600' }
]

const EXPENSE_CATEGORY_ID = 'gider'
const INITIAL_ROWS_PER_CATEGORY = 7

type Company = { id: string; name: string; is_personal: boolean }

type RetailRow = {
  id: string;
  categoryId: string;
  description: string;
  stockId?: string | null;
  supplierId?: string | null;
  quantity: string;
  cost: string;
  cash: string;
  card: string;
}

type Supplier = {
  id: string;
  company_name: string;
}

type BankTransfer = {
  id: string;
  type: 'to_bank' | 'from_bank';
  bankId: string;
  amount: number;
  description: string;
  isNew?: boolean; 
}

type BankAccount = { id: string; bank_name: string; account_name: string; currency: string }
type CashRegister = { id: string; name: string; currency: string }
type Warehouse = { id: string; name: string; company_id?: string | null }
type RawStock = { id: string; name: string; sku: string; quantity: number; unit_price: number; vat_rate: number; currency: string; warehouse_id: string }
type CardDetail = { id: string; name: string; current_debt: number; card_limit: number; company_id: string | null }

type DeliveredTicketSummary = {
  id: string;
  ticket_no: string;
  customer_name: string;
  brand_model: string;
  total_cost: number;
  payment_method: string | null;
  payment_status: string;
  delivered_at: string | null;
}

type PosSettings = {
  targetCashId: string;
  targetBankId: string;
  companyId: string;
  targetWarehouseId: string;
  targetCreditCardId: string; 
}

const parseValue = (value: string | number | undefined | null) => {
  if (!value) return 0
  if (typeof value === 'number') return value
  
  let parsedValue = 0
  if (value.includes('.') && !value.includes(',')) {
    const dotIndex = value.lastIndexOf('.')
    const rightPartLength = value.length - 1 - dotIndex
    if (rightPartLength === 3 && (value.match(/\./g) || []).length === 1) {
      parsedValue = parseFloat(value.replace(/\./g, ''))
    } else {
      parsedValue = parseFloat(value)
    }
  } else {
    parsedValue = parseFloat(value.replace(/\./g, '').replace(',', '.'))
  }
  return isNaN(parsedValue) ? 0 : parsedValue
}

const formatValue = (num: number) => {
  if (!num || num === 0) return ''
  return num.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function RetailPOSPage() {
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0])
  const dateInputRef = useRef<HTMLInputElement>(null)
  const dataDateRef = useRef<string>(currentDate)
  
  const [isFetching, setIsFetching] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false) 
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  
  const [isDataLoaded, setIsDataLoaded] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isDraftRestored, setIsDraftRestored] = useState(false)

  const [rows, setRows] = useState<RetailRow[]>([])
  const [openingCash, setOpeningCash] = useState<string>('')
  const [isFirstDayOfSystem, setIsFirstDayOfSystem] = useState(false) 

  const [photoCash, setPhotoCash] = useState<string>('')
  const [photoCard, setPhotoCard] = useState<string>('')
  const [dailyNotes, setDailyNotes] = useState<string>('')
  const [showCost, setShowCost] = useState<Record<string, boolean>>({})

  const [companies, setCompanies] = useState<Company[]>([])
  const [activeBanks, setActiveBanks] = useState<BankAccount[]>([])
  const [activeCashes, setActiveCashes] = useState<CashRegister[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [stocks, setStocks] = useState<RawStock[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [activeCards, setActiveCards] = useState<CardDetail[]>([]) 
  
  const [rates, setRates] = useState<{ USD: number; EUR: number }>({ USD: 34.25, EUR: 37.80 })
  const [posSettings, setPosSettings] = useState<PosSettings>({ targetCashId: '', targetBankId: '', companyId: '', targetWarehouseId: '', targetCreditCardId: '' })
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)

  const [transfers, setTransfers] = useState<BankTransfer[]>([])
  const [deliveredTickets, setDeliveredTickets] = useState<DeliveredTicketSummary[]>([])
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [transferForm, setTransferForm] = useState({ type: 'to_bank' as 'to_bank' | 'from_bank', bankId: '', amountStr: '', description: '' })

  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null)

  // Mağazaya tanımlı aktif hedef depo (seçili olan, veya POS şirketinin deposu, veya 'Mağaza' adlı depo)
  const activeWarehouse = useMemo(() => {
    if (posSettings.targetWarehouseId) {
      return warehouses.find(w => w.id === posSettings.targetWarehouseId) || null
    }
    if (posSettings.companyId) {
      return warehouses.find(w => w.company_id === posSettings.companyId) || null
    }
    return warehouses.find(w => w.name.toLocaleLowerCase('tr-TR').includes('mağaza')) || warehouses[0] || null
  }, [posSettings.targetWarehouseId, posSettings.companyId, warehouses])

  // Mağazaya tanımlı depolardaki ürünler
  const storeStocks = useMemo(() => {
    if (activeWarehouse) {
      return stocks.filter(s => s.warehouse_id === activeWarehouse.id)
    }
    if (posSettings.companyId) {
      const compWhIds = warehouses.filter(w => w.company_id === posSettings.companyId).map(w => w.id)
      if (compWhIds.length > 0) return stocks.filter(s => compWhIds.includes(s.warehouse_id))
    }
    return stocks
  }, [activeWarehouse, posSettings.companyId, warehouses, stocks])

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' }); 
        const data = await res.json()
        if (data && data.rates) {
          setRates({ USD: Number(data.rates.TRY.toFixed(4)), EUR: Number((data.rates.TRY / data.rates.EUR).toFixed(4)) })
        }
      } catch (err) { console.error("Kur çekilemedi, varsayılan kurlar kullanılacak."); }

      const { data: bData } = await supabase.from('bank_accounts').select('*').order('bank_name')
      if (bData) setActiveBanks(bData)

      const { data: cData } = await supabase.from('cash_registers').select('*').order('name')
      if (cData) setActiveCashes(cData)

      const { data: compData } = await supabase.from('companies').select('*').order('name')
      if (compData) setCompanies(compData)

      const { data: wData } = await supabase.from('warehouses').select('*').order('name')
      if (wData) setWarehouses(wData)

      const { data: sData } = await supabase.from('stocks').select('id, name, sku, quantity, unit_price, vat_rate, currency, warehouse_id')
      if (sData) setStocks(sData)

      const { data: cdData } = await supabase.from('credit_cards').select('*').order('name')
      if (cdData) setActiveCards(cdData)

      const { data: supData } = await supabase.from('suppliers').select('id, company_name').order('company_name')
      if (supData) setSuppliers(supData)

      let initialWhId = ''
      const savedSettings = localStorage.getItem('ctc_pos_config')
      let parsedSettings: any = null
      if (savedSettings) {
        try {
          parsedSettings = JSON.parse(savedSettings)
          initialWhId = parsedSettings.targetWarehouseId || ''
        } catch (e) {}
      }

      if (!initialWhId && wData && wData.length > 0) {
        const found = wData.find(w => w.name.toLocaleLowerCase('tr-TR').includes('mağaza')) || wData[0]
        if (found) initialWhId = found.id
      }

      setPosSettings({
         targetCashId: parsedSettings?.targetCashId || '',
         targetBankId: parsedSettings?.targetBankId || '',
         companyId: parsedSettings?.companyId || '',
         targetWarehouseId: initialWhId,
         targetCreditCardId: parsedSettings?.targetCreditCardId || ''
      })
      
      if (bData && bData.length > 0) setTransferForm(prev => ({ ...prev, bankId: bData[0].id }))
    }
    fetchAccounts()
  }, [])

  useEffect(() => {
    fetchDayData(currentDate)
  }, [currentDate])

  useEffect(() => {
    if (!isDataLoaded || !hasUnsavedChanges || currentDate !== dataDateRef.current) return
    
    const hasFilledRows = rows.some(r => r.description || parseValue(r.cost) > 0 || parseValue(r.cash) > 0 || parseValue(r.card) > 0)
    const hasData = hasFilledRows || parseValue(photoCash) > 0 || parseValue(photoCard) > 0 || dailyNotes.trim() !== '' || transfers.length > 0

    if (hasData) {
      const draftKey = `ctc_pos_draft_${currentDate}`
      const draftData = { photoCash, photoCard, dailyNotes, transfers, rows }
      localStorage.setItem(draftKey, JSON.stringify(draftData))
    }
  }, [rows, photoCash, photoCard, dailyNotes, transfers, currentDate, isDataLoaded, hasUnsavedChanges])

  useEffect(() => {
    const handleClickOutside = () => setActiveDropdownId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const saveSettings = (e: React.FormEvent) => {
    e.preventDefault()
    localStorage.setItem('ctc_pos_config', JSON.stringify(posSettings))
    setIsSettingsModalOpen(false)
    toast.success('Mağaza ayarları başarıyla kaydedildi.')
    fetchDayData(currentDate)
  }

  async function recalculateAbsoluteSupplierBalance(supplierId: string) {
    const { data: txs } = await supabase.from('supplier_transactions').select('amount, tx_type, exchange_rate').eq('supplier_id', supplierId)
    let absoluteBal = 0
    txs?.forEach(t => {
      const tryEquivalent = Number(t.amount) * (Number(t.exchange_rate) || 1)
      if (t.tx_type === 'debt') absoluteBal += tryEquivalent
      else absoluteBal -= tryEquivalent
    })
    await supabase.from('suppliers').update({ balance: absoluteBal }).eq('id', supplierId)
  }

  async function recalculateAbsoluteStock(stockId: string) {
    const { data: txs } = await supabase.from('stock_transactions').select('quantity, tx_type').eq('stock_id', stockId)
    let absoluteQty = 0
    txs?.forEach(t => { absoluteQty += t.tx_type === 'in' ? Number(t.quantity) : -Number(t.quantity) })
    await supabase.from('stocks').update({ quantity: absoluteQty }).eq('id', stockId)
  }

  const getClosingCashForDate = async (dateStr: string) => {
    const { data: summary } = await supabase.from('pos_daily_summaries').select('*').eq('date', dateStr).single()
    const { data: txs } = await supabase.from('pos_transactions').select('*').eq('date', dateStr)
    const { data: trs } = await supabase.from('pos_bank_transfers').select('*').eq('date', dateStr)

    let cashIn = Number(summary?.photo_cash || 0)
    let cashOut = 0
    const validCategoryIds = CATEGORIES.map(c => c.id)

    txs?.forEach(tx => {
      if (tx.category_id === EXPENSE_CATEGORY_ID) {
        cashOut += Number(tx.cash || 0)
      } else if (validCategoryIds.includes(tx.category_id)) {
        cashIn += Number(tx.cash || 0)
      }
    })

    trs?.forEach(tr => {
      if (tr.transfer_type === 'to_bank') cashOut += Number(tr.amount || 0)
      else if (tr.transfer_type === 'from_bank') cashIn += Number(tr.amount || 0)
    })

    return Number(summary?.opening_cash || 0) + cashIn - cashOut
  }

  const syncForwardBalances = async () => {
    const { data: days } = await supabase.from('pos_daily_summaries').select('date').order('date', { ascending: true })
    if (!days || days.length === 0) return

    let firstDayOpening = 0;
    const savedSettings = localStorage.getItem('ctc_pos_config');
    const parsedSettings = savedSettings ? JSON.parse(savedSettings) : {};
    
    if (parsedSettings.targetCashId) {
      const { data: initTx } = await supabase.from('cash_transactions')
        .select('amount')
        .eq('cash_register_id', parsedSettings.targetCashId)
        .eq('description', 'Açılış Bakiyesi / Devir')
        .limit(1).single();
      if (initTx) firstDayOpening = Number(initTx.amount);
    }

    await supabase.from('pos_daily_summaries').update({ opening_cash: firstDayOpening }).eq('date', days[0].date)

    let currentCarryOver = firstDayOpening;
    const validCategoryIds = CATEGORIES.map(c => c.id)

    for (let i = 0; i < days.length; i++) {
      const targetDate = days[i].date;
      
      if (i > 0) {
        await supabase.from('pos_daily_summaries').update({ opening_cash: currentCarryOver }).eq('date', targetDate)
      }

      const { data: summary } = await supabase.from('pos_daily_summaries').select('*').eq('date', targetDate).single()
      const { data: txs } = await supabase.from('pos_transactions').select('*').eq('date', targetDate)
      const { data: trs } = await supabase.from('pos_bank_transfers').select('*').eq('date', targetDate)

      let cashIn = Number(summary?.photo_cash || 0)
      let cashOut = 0
      
      txs?.forEach(tx => {
        if (tx.category_id === EXPENSE_CATEGORY_ID) cashOut += Number(tx.cash || 0)
        else if (validCategoryIds.includes(tx.category_id)) cashIn += Number(tx.cash || 0)
      })
      trs?.forEach(tr => {
        if (tr.transfer_type === 'to_bank') cashOut += Number(tr.amount || 0)
        else if (tr.transfer_type === 'from_bank') cashIn += Number(tr.amount || 0)
      })

      currentCarryOver = currentCarryOver + cashIn - cashOut
    }
  }

  const fetchDayData = async (dateStr: string) => {
    setIsFetching(true)
    setIsDataLoaded(false)
    setSaveStatus('idle')
    setIsDraftRestored(false)
    setHasUnsavedChanges(false)
    setIsFirstDayOfSystem(false)
    
    try {
      let expectedOpening = 0;
      const { data: summary } = await supabase.from('pos_daily_summaries').select('*').eq('date', dateStr).single()
      
      if (summary) {
        expectedOpening = Number(summary.opening_cash);
      } else {
        const { data: lastSummary } = await supabase.from('pos_daily_summaries').select('date').lt('date', dateStr).order('date', { ascending: false }).limit(1).single()
        if (lastSummary) {
          expectedOpening = await getClosingCashForDate(lastSummary.date);
        } else {
          let initialCash = 0;
          const savedSettings = localStorage.getItem('ctc_pos_config');
          const parsedSettings = savedSettings ? JSON.parse(savedSettings) : {};
          
          if (parsedSettings.targetCashId) {
            const { data: tCash } = await supabase.from('cash_registers').select('balance').eq('id', parsedSettings.targetCashId).single();
            if (tCash) {
              initialCash = tCash.balance;
            }
          }
          expectedOpening = initialCash;
          setIsFirstDayOfSystem(true)
        }
      }
      
      setOpeningCash(formatValue(expectedOpening));

      // Günün Teslim Edilen Teknik Servis Fişlerini Çek (Bilgi amaçlı - Z-Raporuna dahil edilmez)
      try {
        const targetDateObj = new Date(dateStr);
        const prevDate = new Date(targetDateObj.getTime() - 86400000).toISOString().split('T')[0];
        const nextDate = new Date(targetDateObj.getTime() + 86400000).toISOString().split('T')[0];

        const { data: ticketsData } = await supabase
          .from('technical_service_tickets')
          .select('id, ticket_no, customer_name, brand_model, total_cost, payment_method, payment_status, delivered_at')
          .eq('status', 'delivered')
          .gte('delivered_at', `${prevDate}T00:00:00Z`)
          .lte('delivered_at', `${nextDate}T23:59:59Z`)
          .order('delivered_at', { ascending: false });

        const dayTickets = (ticketsData || []).filter(t => {
          if (!t.delivered_at) return false;
          return new Date(t.delivered_at).toLocaleDateString('en-CA') === dateStr;
        });
        setDeliveredTickets(dayTickets);
      } catch (err) {
        console.error('Teslim edilen servis fişleri yüklenemedi:', err);
        setDeliveredTickets([]);
      }

      const draftKey = `ctc_pos_draft_${dateStr}`
      const draftStr = localStorage.getItem(draftKey)

      if (draftStr) {
        const draft = JSON.parse(draftStr)
        const hasFilledRows = draft.rows?.some((r: any) => r.description || parseValue(r.cost) > 0 || parseValue(r.cash) > 0 || parseValue(r.card) > 0)
        const hasNotes = !!draft.dailyNotes
        const hasPhotos = parseValue(draft.photoCash) > 0 || parseValue(draft.photoCard) > 0
        const hasTrans = draft.transfers?.length > 0

        if (hasFilledRows || hasNotes || hasPhotos || hasTrans) {
          setPhotoCash(draft.photoCash || '')
          setPhotoCard(draft.photoCard || '')
          setDailyNotes(draft.dailyNotes || '')
          setTransfers(draft.transfers || [])
          setRows(draft.rows || [])
          
          setIsDraftRestored(true)
          setHasUnsavedChanges(true)
          dataDateRef.current = dateStr
          setIsDataLoaded(true)
          setIsFetching(false)
          return 
        } else {
          localStorage.removeItem(draftKey)
        }
      }

      if (summary) {
        setPhotoCash(formatValue(summary.photo_cash))
        setPhotoCard(formatValue(summary.photo_card))
        setDailyNotes(summary.daily_notes || '')
      } else {
        setPhotoCash('')
        setPhotoCard('')
        setDailyNotes('')
      }

      const { data: dbRows } = await supabase.from('pos_transactions').select('*').eq('date', dateStr)
      const { data: dbTransfers } = await supabase.from('pos_bank_transfers').select('*').eq('date', dateStr)
      const { data: daySuppTxs } = await supabase.from('supplier_transactions').select('id, supplier_id, description, amount, invoice_lines').like('description', `Mağaza Hizmet Alımı (POS-${dateStr})%`)

      if (dbTransfers) {
        setTransfers(dbTransfers.map(t => ({
          id: t.id, type: t.transfer_type, bankId: t.bank_id, amount: Number(t.amount), description: t.description || '', isNew: false
        })))
      } else {
        setTransfers([])
      }

      const allCategoryIds = [...CATEGORIES.map(c => c.id), EXPENSE_CATEGORY_ID]
      let newRows: RetailRow[] = []
      const remainingSuppTxs = daySuppTxs ? [...daySuppTxs] : []

      allCategoryIds.forEach(catId => {
        if (catId === 'fotokopi') return;

        const catDbRows = (dbRows || []).filter(r => r.category_id === catId)
        catDbRows.forEach(r => {
          let matchedSupplierId: string | null = null
          if (remainingSuppTxs.length > 0) {
            const matchIndex = remainingSuppTxs.findIndex(st => {
              const line = Array.isArray(st.invoice_lines) && (st.invoice_lines[0] as any)
              if (line && line.category_id === catId && line.description === r.description && Number(line.cost) === Number(r.cost)) {
                return true
              }
              if (st.description === `Mağaza Hizmet Alımı (POS-${dateStr}): ${r.description}` && Number(st.amount) === Number(r.cost)) {
                return true
              }
              return false
            })
            if (matchIndex !== -1) {
              matchedSupplierId = remainingSuppTxs[matchIndex].supplier_id
              remainingSuppTxs.splice(matchIndex, 1)
            }
          }

          newRows.push({
            id: r.id, categoryId: r.category_id, description: r.description || '', 
            stockId: r.stock_id || null, supplierId: matchedSupplierId, quantity: r.quantity ? String(r.quantity) : '', 
            cost: formatValue(r.cost), cash: formatValue(r.cash), card: formatValue(r.card)
          })
        })

        const rowsToAdd = INITIAL_ROWS_PER_CATEGORY - catDbRows.length
        for (let i = 0; i < rowsToAdd; i++) {
          newRows.push({ 
            id: `${catId}-init-${Date.now()}-${i}-${Math.random()}`, categoryId: catId, description: '', stockId: null, supplierId: null, quantity: '', cost: '', cash: '', card: '' 
          })
        }
      })

      setRows(newRows)
      dataDateRef.current = dateStr
    } catch (error) {
      console.error("Veri çekme hatası:", error)
    } finally {
      setIsDataLoaded(true)
      setIsFetching(false)
    }
  }

  const syncPosToMainSystem = async (currentDateStr: string, filledRows: RetailRow[]) => {
    const finalCompId = posSettings.companyId === '' ? null : posSettings.companyId;
    
    const affectedBanks = new Set<string>();
    const affectedCashes = new Set<string>();
    const affectedStocks = new Set<string>();
    const affectedCards = new Set<string>(); // Kredi kartlarını takip etmek için eklendi
    const affectedSuppliers = new Set<string>();

    const { data: oldBankTxs } = await supabase.from('bank_transactions').select('id, bank_account_id').like('transfer_id', `POS-%-${currentDateStr}`)
    if (oldBankTxs && oldBankTxs.length > 0) {
      for (const ot of oldBankTxs) { affectedBanks.add(ot.bank_account_id); await supabase.from('bank_transactions').delete().eq('id', ot.id) }
    }

    const { data: oldCashTxs } = await supabase.from('cash_transactions').select('id, cash_register_id').like('transfer_id', `POS-%-${currentDateStr}`)
    if (oldCashTxs && oldCashTxs.length > 0) {
      for (const ot of oldCashTxs) { affectedCashes.add(ot.cash_register_id); await supabase.from('cash_transactions').delete().eq('id', ot.id) }
    }

    const { data: oldStockTxs } = await supabase.from('stock_transactions').select('id, stock_id').like('description', `Mağaza Satışı: Z-Raporu (POS-${currentDateStr})%`)
    if (oldStockTxs && oldStockTxs.length > 0) {
      for (const ot of oldStockTxs) { affectedStocks.add(ot.stock_id); await supabase.from('stock_transactions').delete().eq('id', ot.id) }
    }

    // YENİ: Kredi Kartı Eski Ekstre Kayıtlarını Sil
    const { data: oldCardTxs } = await supabase.from('credit_card_transactions').select('id, credit_card_id').like('description', `Mağaza Z-Raporu: Kartlı Giderler (POS-${currentDateStr})%`)
    if (oldCardTxs && oldCardTxs.length > 0) {
      for (const ot of oldCardTxs) { affectedCards.add(ot.credit_card_id); await supabase.from('credit_card_transactions').delete().eq('id', ot.id) }
    }

    // YENİ: Eski Tedarikçi İşlemlerini Sil
    const { data: oldSuppTxs } = await supabase.from('supplier_transactions').select('id, supplier_id').like('description', `Mağaza Hizmet Alımı (POS-${currentDateStr})%`)
    if (oldSuppTxs && oldSuppTxs.length > 0) {
       for (const ot of oldSuppTxs) { affectedSuppliers.add(ot.supplier_id); await supabase.from('supplier_transactions').delete().eq('id', ot.id) }
    }

    if (posSettings.targetCashId) {
      affectedCashes.add(posSettings.targetCashId);
      let targetCurrency = 'TRY';
      const { data: tCash } = await supabase.from('cash_registers').select('currency').eq('id', posSettings.targetCashId).single();
      if (tCash) targetCurrency = tCash.currency || 'TRY';

      const cashInserts = [];
      if (grandTotalCash > 0) {
        cashInserts.push({ cash_register_id: posSettings.targetCashId, company_id: finalCompId, tx_date: currentDateStr, description: `Mağaza Z-Raporu: Nakit Satışlar (Ciro)`, tx_type: 'in', amount: grandTotalCash, currency: targetCurrency, exchange_rate: 1, is_transfer: false, transfer_id: `POS-Z-CASH-IN-${currentDateStr}` });
      }
      if (expenseCash > 0) {
        cashInserts.push({ cash_register_id: posSettings.targetCashId, company_id: finalCompId, tx_date: currentDateStr, description: `Mağaza Z-Raporu: Nakit Giderler`, tx_type: 'out', amount: expenseCash, currency: targetCurrency, exchange_rate: 1, is_transfer: false, transfer_id: `POS-Z-CASH-OUT-${currentDateStr}` });
      }

      transfers.forEach((trf, idx) => {
        if (trf.type === 'to_bank' || trf.type === 'from_bank') {
          cashInserts.push({ 
            cash_register_id: posSettings.targetCashId, 
            company_id: finalCompId, 
            tx_date: currentDateStr, 
            description: trf.type === 'to_bank' ? `Kasadan Bankaya Yatırılan: ${trf.description || 'Gün Sonu'}` : `Bankadan Kasaya Çekilen: ${trf.description || 'Nakit İhtiyacı'}`, 
            tx_type: trf.type === 'to_bank' ? 'out' : 'in', 
            amount: trf.amount, 
            currency: targetCurrency, 
            exchange_rate: 1, 
            is_transfer: true, 
            transfer_id: `POS-TRF-CASH-${idx}-${currentDateStr}` 
          });
        }
      });

      if (cashInserts.length > 0) await supabase.from('cash_transactions').insert(cashInserts)
    }

    if (posSettings.targetBankId && grandTotalCard > 0) {
      affectedBanks.add(posSettings.targetBankId);
      let targetCurrency = 'TRY';
      const { data: tBank } = await supabase.from('bank_accounts').select('currency').eq('id', posSettings.targetBankId).single();
      if (tBank) targetCurrency = tBank.currency || 'TRY';

      await supabase.from('bank_transactions').insert([{ bank_account_id: posSettings.targetBankId, company_id: finalCompId, tx_date: currentDateStr, description: `Mağaza Z-Raporu: Kredi Kartı Satışları (Provizyon)`, tx_type: 'in', amount: grandTotalCard, currency: targetCurrency, exchange_rate: 1, is_transfer: false, transfer_id: `POS-Z-CARD-IN-${currentDateStr}`, status: 'pending' }]);
    }

    for (let i = 0; i < transfers.length; i++) {
      const trf = transfers[i];
      if (!trf.bankId) continue;
      affectedBanks.add(trf.bankId);
      let targetCurrency = 'TRY';
      const { data: tBank } = await supabase.from('bank_accounts').select('currency').eq('id', trf.bankId).single();
      if (tBank) targetCurrency = tBank.currency || 'TRY';

      const isToBank = trf.type === 'to_bank';
      await supabase.from('bank_transactions').insert([{ bank_account_id: trf.bankId, company_id: finalCompId, tx_date: currentDateStr, description: `Mağaza Kasa İşlemi: ${trf.description || (isToBank ? 'Gün Sonu Yatırma' : 'Kasaya Çekim')}`, tx_type: isToBank ? 'in' : 'out', amount: trf.amount, currency: targetCurrency, exchange_rate: 1, is_transfer: true, transfer_id: `POS-TRF-BANK-${i}-${currentDateStr}`, status: 'completed' }]);
    }

    if (posSettings.targetWarehouseId || filledRows.some(r => r.stockId)) {
       const stockInserts: any[] = [];
       filledRows.forEach(r => {
          if (r.stockId && parseValue(r.quantity) > 0) {
             affectedStocks.add(r.stockId);
             
             const totalCost = parseValue(r.cost); 
             const qty = parseValue(r.quantity) || 1;
             const unitCost = totalCost > 0 ? (totalCost / qty) : 0; 

             stockInserts.push({
                stock_id: r.stockId,
                company_id: finalCompId,
                tx_date: currentDateStr,
                description: `Mağaza Satışı: Z-Raporu (POS-${currentDateStr})`,
                tx_type: 'out',
                quantity: qty,
                unit_price: unitCost,
                currency: 'TRY', 
                vat_rate: 0
             })
          }
       })
       if (stockInserts.length > 0) {
         const { error: stockErr } = await supabase.from('stock_transactions').insert(stockInserts)
         if (stockErr) console.error("Stok Düşme Hatası:", stockErr)
       }
    }

    // YENİ: Tedarikçi Borcunu Ekle
    const suppInserts: any[] = [];
    filledRows.forEach((r, rIdx) => {
        if (r.supplierId && parseValue(r.cost) > 0) {
            affectedSuppliers.add(r.supplierId);
            suppInserts.push({
                supplier_id: r.supplierId,
                company_id: finalCompId,
                tx_date: currentDateStr,
                description: `Mağaza Hizmet Alımı (POS-${currentDateStr}): ${r.description}`,
                tx_type: 'debt',
                amount: parseValue(r.cost),
                currency: 'TRY',
                exchange_rate: 1,
                invoice_lines: [{
                  pos_row_id: r.id,
                  category_id: r.categoryId,
                  description: r.description,
                  quantity: parseValue(r.quantity) || 1,
                  cost: parseValue(r.cost),
                  row_index: rIdx
                }]
            });
        }
    });
    if (suppInserts.length > 0) {
      const { error: suppErr } = await supabase.from('supplier_transactions').insert(suppInserts);
      if (suppErr) {
        console.error("Tedarikçi Borcu Ekleme Hatası:", suppErr);
        toast.error("Tedarikçi borç kaydı oluşturulurken hata: " + suppErr.message);
      }
    }

    // YENİ: KREDİ KARTI GİDERİ EKLENMESİ VE EKSTREYE İŞLENMESİ
    if (posSettings.targetCreditCardId && expenseCard > 0) {
      affectedCards.add(posSettings.targetCreditCardId);
      
      await supabase.from('credit_card_transactions').insert([{ 
        credit_card_id: posSettings.targetCreditCardId, 
        company_id: finalCompId, 
        tx_date: currentDateStr, 
        description: `Mağaza Z-Raporu: Kartlı Giderler (POS-${currentDateStr})`, 
        tx_type: 'out', // 'out' veya 'debt' (Harcama olduğu için borcu artırır)
        amount: expenseCard 
      }]);
    }

    for (const bId of Array.from(affectedBanks)) {
      const { data: txs } = await supabase.from('bank_transactions').select('amount, tx_type, status').eq('bank_account_id', bId)
      let absoluteBal = 0
      txs?.forEach(t => { if (t.status !== 'pending') absoluteBal += t.tx_type === 'in' ? Number(t.amount) : -Number(t.amount) })
      await supabase.from('bank_accounts').update({ balance: absoluteBal }).eq('id', bId)
    }

    for (const cId of Array.from(affectedCashes)) {
      const { data: txs } = await supabase.from('cash_transactions').select('amount, tx_type').eq('cash_register_id', cId)
      let absoluteBal = 0
      txs?.forEach(t => { absoluteBal += t.tx_type === 'in' ? Number(t.amount) : -Number(t.amount) })
      await supabase.from('cash_registers').update({ balance: absoluteBal }).eq('id', cId)
    }

    for (const sId of Array.from(affectedStocks)) {
      await recalculateAbsoluteStock(sId)
    }

    // YENİ: TEDARİKÇİ BAKİYE HESAPLAMASI
    for (const sId of Array.from(affectedSuppliers)) {
       await recalculateAbsoluteSupplierBalance(sId)
    }

    // YENİ: KREDİ KARTI MUTLAK BORÇ HESAPLAMASI
    for (const cId of Array.from(affectedCards)) {
      const { data: txs } = await supabase.from('credit_card_transactions').select('amount, tx_type').eq('credit_card_id', cId)
      let absoluteDebt = 0
      txs?.forEach(t => { 
         // 'in', 'payment', veya 'refund' (Ödeme) kart borcunu düşürür.
         // 'out', 'debt', veya 'expense' (Harcama) kart borcunu yükseltir.
         if (t.tx_type === 'in' || t.tx_type === 'payment' || t.tx_type === 'refund') {
            absoluteDebt -= Number(t.amount);
         } else {
            absoluteDebt += Number(t.amount);
         }
      })
      await supabase.from('credit_cards').update({ current_debt: absoluteDebt }).eq('id', cId)
    }
  }

  const retailRows = rows.filter(r => r.categoryId !== EXPENSE_CATEGORY_ID)
  const retailCash = retailRows.reduce((acc, row) => acc + parseValue(row.cash), 0)
  const retailCard = retailRows.reduce((acc, row) => acc + parseValue(row.card), 0)

  const deliveredTicketsTotal = deliveredTickets.reduce((acc, t) => acc + (Number(t.total_cost) || 0), 0)
  const deliveredTicketsCash = deliveredTickets
    .filter(t => t.payment_method === 'cash')
    .reduce((acc, t) => acc + (Number(t.total_cost) || 0), 0)
  const deliveredTicketsCard = deliveredTickets
    .filter(t => t.payment_method === 'card')
    .reduce((acc, t) => acc + (Number(t.total_cost) || 0), 0)

  const expenseRows = rows.filter(r => r.categoryId === EXPENSE_CATEGORY_ID)
  const expenseCash = expenseRows.reduce((acc, row) => acc + parseValue(row.cash), 0)
  const expenseCard = expenseRows.reduce((acc, row) => acc + parseValue(row.card), 0)
  const expenseGrandTotal = expenseCash + expenseCard

  const totalToBank = transfers.filter(t => t.type === 'to_bank').reduce((sum, t) => sum + t.amount, 0)
  const totalFromBank = transfers.filter(t => t.type === 'from_bank').reduce((sum, t) => sum + t.amount, 0)

  const fotoCashAmount = parseValue(photoCash)
  const fotoCardAmount = parseValue(photoCard)

  const grandTotalCash = retailCash + fotoCashAmount
  const grandTotalCard = retailCard + fotoCardAmount

  const calculatedKasa = parseValue(openingCash) + grandTotalCash - expenseCash - totalToBank + totalFromBank

  const saveDayData = async () => {
    if (expenseCard > 0 && !posSettings.targetCreditCardId) {
      toast.error(
        'HATA: Kredi kartı ile masraf girdiniz ancak Ayarlar\'dan masrafın yansıyacağı bir Kredi Kartı seçmediniz!',
        { duration: 6000, icon: '💳' }
      );
      return; 
    }

    const invalidRows = rows.filter(r => {
      if (r.categoryId === EXPENSE_CATEGORY_ID) return false;
      const hasSale = parseValue(r.cash) > 0 || parseValue(r.card) > 0;
      const hasCost = parseValue(r.cost) > 0;
      return hasSale && !hasCost;
    });

    if (invalidRows.length > 0) {
      toast.error(
        'HATA: Günü kaydedemezsiniz! Satış girdiğiniz ürünlerin Maliyet kutucukları boş bırakılamaz.',
        { duration: 6000, icon: '⚠️' }
      );
      return; 
    }

    // YENİ: Açıklama zorunluluğu doğrulaması
    const missingDescRows = rows.filter(r => {
      const hasValue = parseValue(r.cost) > 0 || parseValue(r.cash) > 0 || parseValue(r.card) > 0;
      return hasValue && !r.description.trim();
    });

    if (missingDescRows.length > 0) {
      toast.error(
        'HATA: Değer girdiğiniz satırların Açıklama alanını boş bırakamazsınız!',
        { duration: 5000, icon: '📝' }
      );
      return;
    }

    setIsSaving(true)
    setSaveStatus('idle')

    try {
      const { error: summaryError } = await supabase
        .from('pos_daily_summaries')
        .upsert({
          date: currentDate,
          opening_cash: parseValue(openingCash),
          photo_cash: parseValue(photoCash),
          photo_card: parseValue(photoCard),
          daily_notes: dailyNotes
        }, { onConflict: 'date' })

      if (summaryError) throw summaryError

      await supabase.from('pos_transactions').delete().eq('date', currentDate)
      await supabase.from('pos_bank_transfers').delete().eq('date', currentDate)

      const finalCompId = posSettings.companyId === '' ? null : posSettings.companyId; 
      
      // GÜNCELLENDİ: Sadece açıklaması olan ve bir değeri olan satırları işle
      const filledRows = rows.filter(r => r.description.trim() !== '' && (parseValue(r.cost) > 0 || parseValue(r.cash) > 0 || parseValue(r.card) > 0))
      
      let transactionsToInsert: any[] = [];
      
      if (filledRows.length > 0) {
        transactionsToInsert = filledRows.map(r => ({
          date: currentDate, 
          category_id: r.categoryId, 
          description: r.description, 
          cost: parseValue(r.cost), 
          cash: parseValue(r.cash), 
          card: parseValue(r.card),
          stock_id: r.stockId || null, 
          quantity: parseValue(r.quantity) || 1,
          company_id: finalCompId 
        }))
      }

      const fCash = parseValue(photoCash);
      const fCard = parseValue(photoCard);
      
      if (fCash > 0 || fCard > 0) {
        transactionsToInsert.push({
          date: currentDate,
          category_id: 'fotokopi',
          description: 'Günlük Fotokopi Satışı',
          cost: (fCash + fCard) * 0.5, 
          cash: fCash,
          card: fCard,
          stock_id: null,
          quantity: 1,
          company_id: finalCompId
        });
      }

      if (transactionsToInsert.length > 0) {
        const { error: transError } = await supabase.from('pos_transactions').insert(transactionsToInsert)
        if (transError) {
           console.error(transError);
           toast.error("Kayıt hatası! Lütfen Supabase'den pos_transactions tablosuna gerekli kolonları eklediğinizden emin olun.", {duration: 8000});
           throw transError;
        }
      }

      if (transfers.length > 0) {
        const transfersToInsert = transfers.map(t => ({
          date: currentDate, transfer_type: t.type, bank_id: t.bankId, amount: t.amount, description: t.description
        }))
        const { error: bankError } = await supabase.from('pos_bank_transfers').insert(transfersToInsert)
        if (bankError) throw bankError
      }

      await syncPosToMainSystem(currentDate, filledRows)

      const draftKey = `ctc_pos_draft_${currentDate}`
      localStorage.removeItem(draftKey)

      setIsSaving(false)
      setIsSyncing(true)
      
      await syncForwardBalances()
      await fetchDayData(currentDate)
      
      setSaveStatus('success')
      setHasUnsavedChanges(false)
      setIsDraftRestored(false)

      toast.success('Gün başarıyla kaydedildi, Ciro, Stoklar ve Bakiyeler güncellendi.')

      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (error) {
      console.error("Kaydetme hatası:", error)
      setSaveStatus('error')
    } finally {
      setIsSaving(false)
      setIsSyncing(false)
    }
  }

  const toggleCostColumn = (categoryId: string) => {
    setShowCost(prev => ({ ...prev, [categoryId]: !prev[categoryId] }))
  }

  const handleInputChange = (id: string, field: keyof RetailRow, value: string) => {
    setHasUnsavedChanges(true)
    if (saveStatus !== 'idle') setSaveStatus('idle')
    
    setRows(prev => {
      const newRows = prev.map(row => row.id === id ? { ...row, [field]: value } : row)
      const changedRow = newRows.find(r => r.id === id)
      if (changedRow) {
        const catId = changedRow.categoryId
        const catRows = newRows.filter(r => r.categoryId === catId)
        
        let lastDataIndex = -1
        for (let i = catRows.length - 1; i >= 0; i--) {
          const r = catRows[i]
          if (r.description !== '' || r.cost !== '' || r.cash !== '' || r.card !== '') {
            lastDataIndex = i
            break
          }
        }
        
        const desiredRowCount = Math.max(INITIAL_ROWS_PER_CATEGORY, lastDataIndex + 2)
        let updatedCatRows = [...catRows]
        
        if (updatedCatRows.length < desiredRowCount) {
          const rowsToAdd = desiredRowCount - updatedCatRows.length
          for (let i = 0; i < rowsToAdd; i++) {
            updatedCatRows.push({
              id: `${catId}-${Date.now()}-${Math.random()}`, categoryId: catId, description: '', stockId: null, quantity: '', cost: '', cash: '', card: ''
            })
          }
        } else if (updatedCatRows.length > desiredRowCount) {
          updatedCatRows = updatedCatRows.slice(0, desiredRowCount)
        }
        return [...newRows.filter(r => r.categoryId !== catId), ...updatedCatRows]
      }
      return newRows
    })
  }

  const selectStockForRow = (rowId: string, stock: RawStock) => {
    setHasUnsavedChanges(true)
    if (saveStatus !== 'idle') setSaveStatus('idle')
    
    setRows(prev => prev.map(r => {
      if (r.id === rowId) {
        const newQty = (r.quantity === '' || r.quantity === '0') ? '1' : r.quantity;
        const qtyNum = parseValue(newQty) || 1;
        
        let unitPriceInTry = stock.unit_price;
        if (stock.currency === 'USD') unitPriceInTry = stock.unit_price * (rates.USD || 34.25);
        else if (stock.currency === 'EUR') unitPriceInTry = stock.unit_price * (rates.EUR || 37.80);
        
        const totalCostInTry = unitPriceInTry * qtyNum
        
        return { 
          ...r, 
          description: stock.name, 
          stockId: stock.id, 
          quantity: newQty,
          cost: formatValue(totalCostInTry) 
        }
      }
      return r
    }))
    setActiveDropdownId(null)
  }

  const handleInputBlur = (id: string, field: 'cost' | 'cash' | 'card', value: string) => {
    if (!value || value.trim() === '') return
    const parsedValue = parseValue(value)
    if (!isNaN(parsedValue) && parsedValue > 0) {
      const formattedStr = parsedValue.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      setRows(prev => prev.map(row => row.id === id ? { ...row, [field]: formattedStr } : row))
    }
  }

  const handleOpeningCashBlur = (value: string) => {
    if (!value || value.trim() === '') return
    const parsed = parseValue(value)
    if (!isNaN(parsed)) {
      setOpeningCash(parsed.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
    }
  }

  const handlePhotoBlur = (type: 'cash' | 'card', value: string) => {
    if (!value || value.trim() === '') return
    const parsed = parseValue(value)
    if (!isNaN(parsed)) {
      const formatted = parsed.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      if (type === 'cash') setPhotoCash(formatted)
      else setPhotoCard(formatted)
    }
  }

  const handleAddTransfer = () => {
    const amount = parseValue(transferForm.amountStr)
    if (amount <= 0 || !transferForm.bankId) {
      toast.error('Lütfen geçerli bir tutar ve banka hesabı seçin.')
      return
    }

    setTransfers(prev => [...prev, {
      id: Date.now().toString(), type: transferForm.type, bankId: transferForm.bankId, amount: amount, description: transferForm.description, isNew: true
    }])
    
    setTransferForm(prev => ({ ...prev, amountStr: '', description: '' }))
    setHasUnsavedChanges(true)
    setSaveStatus('idle')
    setIsTransferModalOpen(false)
    toast.success("Listeye eklendi. İşlemi tamamlamak için 'Günü Kaydet' butonuna basınız!", { duration: 4000 })
  }

  const handleDeleteTransfer = (transferId: string) => {
    setTransfers(prev => prev.filter(t => t.id !== transferId))
    setHasUnsavedChanges(true)
    setSaveStatus('idle')
  }

  const calculateCategoryTotal = (catId: string, type: 'cost' | 'cash' | 'card') => {
    return rows.filter(r => r.categoryId === catId).reduce((acc, row) => acc + parseValue(row[type]), 0)
  }

  const changeDate = (days: number) => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + days)
    setCurrentDate(d.toISOString().split('T')[0])
  }

  const renderCategoryBox = (category: typeof CATEGORIES[0], index: number = 0) => {
    if (!category) return null;
    const catRows = rows.filter(r => r.categoryId === category.id)
    const catCost = calculateCategoryTotal(category.id, 'cost')
    const catCash = calculateCategoryTotal(category.id, 'cash')
    const catCard = calculateCategoryTotal(category.id, 'card')
    const isCostVisible = showCost[category.id]
    const isExpenseCat = category.id === EXPENSE_CATEGORY_ID

    return (
      <div 
        key={category.id} 
        style={{ animation: 'fadeInUp 0.4s both', animationDelay: `${0.1 + (index * 0.08)}s` }}
        className="bg-[#070b14] border border-slate-700 rounded-lg flex flex-col overflow-hidden shadow-lg w-full break-inside-avoid hover:border-slate-500/50 transition-colors"
      >
        <div className={`${category.color} px-2.5 py-1.5 flex justify-between items-center text-white text-[11px] font-normal`}>
          <div className="flex items-center gap-1.5 overflow-hidden pr-2 flex-1 min-w-0">
            {!isExpenseCat && (
               <button onClick={() => toggleCostColumn(category.id)} className="p-1 bg-black/20 hover:bg-black/40 rounded transition-colors shrink-0">
                 {isCostVisible ? <EyeOff size={12} /> : <Eye size={12} />}
               </button>
            )}
            <span className="truncate">{category.name}</span>
            {category.id === 'servis' && deliveredTickets.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-teal-950/80 border border-teal-300/40 text-teal-200 text-[9px] rounded font-mono shrink-0" title="Bugün teslim edilen servis fişi sayısı">
                {deliveredTickets.length} Fiş Teslim
              </span>
            )}
          </div>
          <div className="flex items-center shrink-0 text-[10px] font-mono font-normal">
            <div className="w-[55px] flex flex-col items-end pr-1 justify-center">
              <span className="text-white/80 leading-none mb-0.5 text-[8px] font-sans font-normal">NAKİT</span>
              <span>{catCash > 0 ? catCash.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}</span>
            </div>
            <div className="w-[55px] flex flex-col items-end pr-1 justify-center border-l border-white/20">
              <span className="text-white/80 leading-none mb-0.5 text-[8px] font-sans font-normal">K.KARTI</span>
              <span>{catCard > 0 ? catCard.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}</span>
            </div>
            {isCostVisible && !isExpenseCat && (
              <div className="w-[55px] flex flex-col items-end pr-1 justify-center border-l border-white/20">
                <span className="text-white/80 leading-none mb-0.5 text-[8px] font-sans font-normal">MALİYET</span>
                <span>{catCost > 0 ? catCost.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col divide-y divide-slate-700 pb-1 transition-all duration-300 relative">
          {isFetching && (
            <div className="absolute inset-0 bg-[#070b14]/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
              <Loader2 className="animate-spin text-slate-400" size={16} />
            </div>
          )}
          {catRows.map((row, index) => {
            const isFirst = index === 0;
            const searchQ = (row.description || '').trim().toLocaleLowerCase('tr-TR');
            
            // Açıklama girerken veya alana tıklandığında mağaza deposundaki ürünleri listele ve filtrele
            const rowFilteredStocks = (activeDropdownId === row.id && !isExpenseCat)
              ? storeStocks.filter(s => {
                  if (!searchQ) return true; // Boşken depodaki tüm ürünler listelensin
                  return s.name.toLocaleLowerCase('tr-TR').includes(searchQ) || (s.sku && s.sku.toLocaleLowerCase('tr-TR').includes(searchQ));
                }).sort((a, b) => {
                  if (b.quantity > 0 && a.quantity <= 0) return 1;
                  if (a.quantity > 0 && b.quantity <= 0) return -1;
                  return a.name.localeCompare(b.name, 'tr-TR');
                })
              : [];

            return (
            <div key={row.id} className="flex text-[11px] hover:bg-slate-800/50 transition-colors group">
              
              <div className="flex-1 min-w-[50px] relative flex">
                <div className={`flex items-center w-full bg-transparent border-r border-slate-700 focus-within:bg-indigo-900/20 transition-colors ${row.stockId ? 'bg-emerald-900/10' : ''}`}>
                   {!isExpenseCat && (
                     <button
                       type="button"
                       tabIndex={-1}
                       onClick={(e) => {
                         e.stopPropagation();
                         setActiveDropdownId(activeDropdownId === row.id ? null : row.id);
                       }}
                       className="ml-1.5 shrink-0 text-slate-500 hover:text-indigo-400 cursor-pointer"
                       title={row.stockId ? "Stoktan düşülecek ürün seçili" : "Depodaki ürünleri listele"}
                     >
                       {row.stockId ? <Package size={12} className="text-emerald-400" /> : <Search size={10} className="text-slate-500" />}
                     </button>
                   )}
                   <input 
                     type="text" 
                     placeholder={isFirst ? "Açıklama veya Ürün Seç..." : ""} 
                     value={row.description} 
                     onChange={(e) => {
                        handleInputChange(row.id, 'description', e.target.value);
                        if(row.stockId) handleInputChange(row.id, 'stockId', '');
                        if(!isExpenseCat) setActiveDropdownId(row.id);
                     }} 
                     onFocus={() => !isExpenseCat && setActiveDropdownId(row.id)}
                     className="w-full bg-transparent px-2 py-1.5 text-slate-200 focus:outline-none placeholder:text-slate-600 font-sans font-normal transition-colors" 
                   />
                   {row.stockId && (
                     <button
                       type="button"
                       onClick={(e) => {
                         e.stopPropagation();
                         handleInputChange(row.id, 'stockId', '');
                       }}
                       className="pr-1.5 text-slate-500 hover:text-rose-400 cursor-pointer"
                       title="Stok bağlantısını kaldır"
                     >
                       <X size={11} />
                     </button>
                   )}
                </div>
                
                {activeDropdownId === row.id && !isExpenseCat && (
                   <div 
                     onMouseDown={(e) => e.stopPropagation()}
                     className="absolute top-full left-0 z-50 mt-0.5 bg-[#0f172a] border border-indigo-500/50 rounded-xl shadow-2xl overflow-hidden max-h-52 w-full min-w-[240px] sm:min-w-[280px] flex flex-col animate-in fade-in duration-150"
                   >
                      <div className="px-2.5 py-1.5 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between text-[10px] text-indigo-300 font-normal shrink-0">
                         <div className="flex items-center gap-1.5">
                            <Package size={12} className="text-indigo-400" />
                            <span>{activeWarehouse?.name || 'Mağaza'} Deposu</span>
                         </div>
                         <span className="text-slate-400 text-[9px] font-mono font-normal">
                            {rowFilteredStocks.length} ürün
                         </span>
                      </div>

                      <div className="overflow-y-auto custom-scrollbar divide-y divide-slate-800/60">
                         {rowFilteredStocks.length === 0 ? (
                            <div className="p-3 text-center text-slate-400 text-[10px]">
                               {searchQ ? `"${row.description}" ile eşleşen ürün bulunamadı.` : 'Seçili depoda henüz kayıtlı ürün bulunmuyor.'}
                            </div>
                         ) : (
                            rowFilteredStocks.map(stock => {
                               const isSelected = row.stockId === stock.id;
                               return (
                               <div 
                                 key={stock.id} 
                                 onMouseDown={(e) => { 
                                    e.preventDefault(); 
                                    e.stopPropagation(); 
                                    selectStockForRow(row.id, stock); 
                                 }}
                                 className={`px-2.5 py-2 hover:bg-indigo-600 hover:text-white cursor-pointer transition-colors flex justify-between items-center ${isSelected ? 'bg-indigo-950/60 text-indigo-200' : ''}`}
                               >
                                  <div className="flex flex-col min-w-0 pr-2">
                                     <span className="font-normal text-[11px] truncate text-slate-200">{stock.name}</span>
                                     {stock.sku && <span className="text-[9px] text-slate-400 font-mono font-normal truncate">{stock.sku}</span>}
                                  </div>
                                  <div className="flex gap-2 items-center shrink-0">
                                     {stock.quantity > 0 ? (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono font-normal">
                                           Stk: {stock.quantity}
                                        </span>
                                     ) : (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono font-normal">
                                           Stk: 0
                                        </span>
                                     )}
                                     <span className="text-[10px] text-indigo-300 font-mono font-normal">
                                        {formatMoney(stock.unit_price, stock.currency).formatted}
                                     </span>
                                  </div>
                               </div>
                               );
                            })
                         )}
                      </div>
                   </div>
                )}
              </div>

              {!isExpenseCat && (
                 <input 
                   type="text" 
                   inputMode="numeric"
                   placeholder={isFirst ? "1" : ""} 
                   value={row.quantity} 
                   onChange={(e) => {
                     handleInputChange(row.id, 'quantity', e.target.value);
                     if (row.stockId) {
                        const stock = stocks.find(s => s.id === row.stockId);
                        if (stock) {
                           const qty = parseValue(e.target.value) || 1;
                           let unitPriceInTry = stock.unit_price;
                           if (stock.currency === 'USD') unitPriceInTry = stock.unit_price * (rates.USD || 34.25);
                           else if (stock.currency === 'EUR') unitPriceInTry = stock.unit_price * (rates.EUR || 37.80);
                           handleInputChange(row.id, 'cost', formatValue(unitPriceInTry * qty));
                        }
                     }
                   }} 
                   className="w-[34px] shrink-0 bg-transparent text-center px-0.5 py-1 text-slate-300 focus:outline-none focus:bg-indigo-900/20 border-r border-slate-700 font-mono font-normal transition-colors" 
                   title="Adet"
                 />
              )}

              <input 
                type="text" 
                inputMode="decimal" 
                placeholder={isFirst ? "0,00" : ""} 
                value={row.cash} 
                onChange={(e) => handleInputChange(row.id, 'cash', e.target.value)} 
                onBlur={(e) => handleInputBlur(row.id, 'cash', e.target.value)} 
                className={`w-[55px] shrink-0 bg-transparent pr-1 pl-0.5 py-1 text-emerald-400 text-right focus:outline-none focus:bg-indigo-900/20 border-r border-slate-700 font-mono font-normal placeholder:text-emerald-900/40 transition-colors ${isExpenseCat ? 'text-amber-400 focus:bg-amber-900/20 placeholder:text-amber-900/40' : ''}`} 
              />
              <input 
                type="text" 
                inputMode="decimal" 
                placeholder={isFirst ? "0,00" : ""} 
                value={row.card} 
                onChange={(e) => handleInputChange(row.id, 'card', e.target.value)} 
                onBlur={(e) => handleInputBlur(row.id, 'card', e.target.value)} 
                className={`w-[55px] shrink-0 bg-transparent pr-1 pl-0.5 py-1 text-purple-400 text-right focus:outline-none focus:bg-indigo-900/20 font-mono font-normal placeholder:text-purple-900/40 transition-colors ${(isCostVisible && !isExpenseCat) ? 'border-r border-slate-700' : ''} ${isExpenseCat ? 'focus:bg-amber-900/20' : ''}`} 
              />
              {(isCostVisible && !isExpenseCat) && (
                <input 
                  type="text" 
                  inputMode="decimal" 
                  placeholder={isFirst ? "0,00" : ""} 
                  value={row.cost} 
                  onChange={(e) => handleInputChange(row.id, 'cost', e.target.value)} 
                  onBlur={(e) => handleInputBlur(row.id, 'cost', e.target.value)} 
                  className="w-[55px] shrink-0 bg-transparent pr-1 pl-0.5 py-1 text-rose-400 text-right focus:outline-none focus:bg-indigo-900/20 font-mono font-normal placeholder:text-rose-900/40 transition-colors" 
                />
              )}
            </div>
            )
          })}
        </div>

        {category.id === 'servis' && (
          <div className="border-t border-teal-500/20 bg-[#08101d] p-2 flex flex-col">
            <div className="flex items-center justify-between pb-1 border-b border-slate-800">
              <div className="flex items-center gap-1.5 text-teal-400 font-bold text-[10px]">
                <Wrench size={11} className="text-teal-400" />
                <span>Günün Teslim Edilen Servis Fişleri ({deliveredTickets.length})</span>
              </div>
              <span className="text-[9px] text-slate-400 italic">
                {deliveredTickets.length > 0 ? '* Fişten tahsil edildi' : ''}
              </span>
            </div>

            {deliveredTickets.length > 0 ? (
              <>
                <div className="divide-y divide-slate-800/60 max-h-40 overflow-y-auto custom-scrollbar my-1">
                  {deliveredTickets.map(t => (
                    <div key={t.id} className="py-1.5 flex items-center justify-between text-[10px] hover:bg-slate-800/40 px-1 rounded transition-colors">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-2">
                        <a
                          href={`/technical-service?search=${t.ticket_no}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono font-bold text-teal-300 hover:text-teal-200 flex items-center gap-0.5 shrink-0 hover:underline"
                          title="Teknik Servis sayfasına git"
                        >
                          {t.ticket_no}
                          <ExternalLink size={9} />
                        </a>
                        <span className="text-slate-300 truncate font-sans">
                          {t.brand_model} • <span className="text-slate-400">{t.customer_name}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 font-mono">
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-sans font-medium border ${
                          t.payment_method === 'cash' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' :
                          t.payment_method === 'card' ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' :
                          t.payment_method === 'customer_account' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' :
                          'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {t.payment_method === 'cash' ? 'Nakit' :
                           t.payment_method === 'card' ? 'K.Kartı' :
                           t.payment_method === 'customer_account' ? 'Veresiye' : 'Ücretsiz'}
                        </span>
                        <span className="text-slate-100 font-bold text-[10px]">
                          {formatMoney(t.total_cost, 'TRY').formatted}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[9px] font-mono">
                  <span className="text-slate-400">Fişli Servis Cirosu:</span>
                  <span className="text-teal-300 font-bold">{formatMoney(deliveredTicketsTotal, 'TRY').formatted}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-200 mt-0.5">
                  <span className="text-slate-400 font-sans text-[9px]">Günün Toplam Servis Hacmi:</span>
                  <span className="text-emerald-400">{formatMoney(catCash + catCard + deliveredTicketsTotal, 'TRY').formatted}</span>
                </div>
              </>
            ) : (
              <div className="py-2 text-center text-slate-400 text-[10px] italic">
                Bugün teknik servisten teslim edilen fişli cihaz bulunmuyor.
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] bg-[#0d1322] relative overflow-hidden">
      <Toaster position="bottom-right" containerStyle={{ zIndex: 99999999 }} toastOptions={{ style: { background: '#0f172a', color: '#fff', border: '1px solid #1e293b', fontSize: '12px' } }} />
      
      {/* ÇÖKME UYARISI */}
      {isDraftRestored && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-400 px-4 py-2 text-[11px] font-bold flex items-center justify-between shrink-0 animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-amber-500 shrink-0" />
            <span>Sistem kapanması algılandı! Ekrana girdiğiniz ama kaydetmediğiniz güncel veriler tarayıcı hafızasından kurtarıldı. Lütfen kontrol edip sağ üstten "Günü Kaydet" butonuna basın.</span>
          </div>
          <button onClick={() => setIsDraftRestored(false)} className="text-amber-500 hover:text-amber-400 p-1"><X size={14}/></button>
        </div>
      )}

      {/* ÜST BİLGİ BARI */}
      <div style={{ animation: 'fadeInDown 0.4s both' }} className="flex flex-wrap justify-between items-center gap-2 px-1.5 py-2 bg-[#0a0f1d] border-b border-slate-800 shrink-0 select-none shadow-sm z-10">
        
        {/* SOL GRUP */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {/* KASA */}
          <div className="flex items-center gap-2 bg-indigo-950/30 border border-indigo-500/30 px-3 py-1.5 rounded-lg" title={`Dünden Devir: ${openingCash || '0,00'} ₺`}>
            <span className="text-slate-400 font-sans font-bold text-[10px] uppercase">Kasa:</span>
            <span className="text-indigo-400 font-black text-sm">{formatMoney(calculatedKasa, 'TRY').formatted}</span>
            <button onClick={() => setIsTransferModalOpen(true)} className="ml-1 bg-indigo-600/20 hover:bg-indigo-600/50 text-indigo-300 p-1 rounded transition-colors" title="Bankaya Para Yatır / Çek">
              <Landmark size={14} />
            </button>
          </div>
          
          <div className="hidden md:block w-px h-5 bg-slate-800 mx-0.5"></div>
          
          {/* NAKİT SATIŞ & TAHSİLAT */}
          <div className="flex items-center gap-2 bg-emerald-950/30 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg" title={`Toplam Nakit: ${formatMoney(grandTotalCash + deliveredTicketsCash, 'TRY').formatted} (Mağaza: ${formatMoney(grandTotalCash, 'TRY').formatted}, Servis: ${formatMoney(deliveredTicketsCash, 'TRY').formatted})`}>
            <Wallet size={14} className="text-emerald-500 shrink-0"/>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-sans font-bold text-[9px] uppercase">Nakit:</span>
                <span className="text-emerald-400 font-bold">{formatMoney(grandTotalCash + deliveredTicketsCash, 'TRY').formatted}</span>
              </div>
              <div className="flex items-center gap-1 text-[8px] font-sans text-slate-400 leading-none mt-0.5">
                <span>Mğz: <b className="text-emerald-300 font-normal font-mono">{formatMoney(grandTotalCash, 'TRY').formatted}</b></span>
                {deliveredTicketsCash > 0 && (
                  <>
                    <span>•</span>
                    <span>Srv: <b className="text-teal-300 font-normal font-mono">{formatMoney(deliveredTicketsCash, 'TRY').formatted}</b></span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* KREDİ KARTI SATIŞ & TAHSİLAT */}
          <div className="flex items-center gap-2 bg-purple-950/30 border border-purple-500/30 px-2.5 py-1.5 rounded-lg" title={`Toplam Kredi Kartı: ${formatMoney(grandTotalCard + deliveredTicketsCard, 'TRY').formatted} (Mağaza: ${formatMoney(grandTotalCard, 'TRY').formatted}, Servis: ${formatMoney(deliveredTicketsCard, 'TRY').formatted})`}>
            <CreditCard size={14} className="text-purple-500 shrink-0"/>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-sans font-bold text-[9px] uppercase">K.Kartı:</span>
                <span className="text-purple-400 font-bold">{formatMoney(grandTotalCard + deliveredTicketsCard, 'TRY').formatted}</span>
              </div>
              <div className="flex items-center gap-1 text-[8px] font-sans text-slate-400 leading-none mt-0.5">
                <span>Mğz: <b className="text-purple-300 font-normal font-mono">{formatMoney(grandTotalCard, 'TRY').formatted}</b></span>
                {deliveredTicketsCard > 0 && (
                  <>
                    <span>•</span>
                    <span>Srv: <b className="text-teal-300 font-normal font-mono">{formatMoney(deliveredTicketsCard, 'TRY').formatted}</b></span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* SERVİS FİŞLERİ TAHSİLAT KUTUSU */}
          <div className="flex items-center gap-2 bg-teal-950/30 border border-teal-500/30 px-2.5 py-1.5 rounded-lg" title={`Bugün teslim edilen ${deliveredTickets.length} servis fişinden tahsil edilen toplam tutar`}>
            <Wrench size={14} className="text-teal-400 shrink-0"/>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-teal-300 font-sans font-bold text-[9px] uppercase">Servis Fişleri:</span>
                <span className="text-teal-300 font-bold">{formatMoney(deliveredTicketsTotal, 'TRY').formatted}</span>
              </div>
              <div className="flex items-center gap-1 text-[8px] font-mono text-slate-400 leading-none mt-0.5">
                <span className="text-emerald-400">N: {formatMoney(deliveredTicketsCash, 'TRY').formatted}</span>
                <span>•</span>
                <span className="text-purple-400">K: {formatMoney(deliveredTicketsCard, 'TRY').formatted}</span>
              </div>
            </div>
          </div>
          
          <div className="hidden lg:block w-px h-5 bg-slate-800 mx-0.5"></div>
          
          {/* TOPLAM GİDER */}
          <div className="flex items-center gap-2 bg-amber-950/30 border border-amber-500/30 px-3 py-1.5 rounded-lg">
            <span className="text-slate-400 font-sans font-bold text-[10px] uppercase">Toplam Gider:</span>
            <span className="text-amber-400 font-bold">{formatMoney(expenseGrandTotal, 'TRY').formatted}</span>
          </div>
        </div>

        {/* SAĞ GRUP */}
        <div className="flex items-center gap-3 mt-2 md:mt-0">
          
          <div className="flex items-center gap-2 bg-blue-950/30 border border-blue-500/30 px-2.5 py-1 rounded-lg">
            <span className="text-blue-400 font-sans font-bold text-[10px] uppercase tracking-wide">🖨️ Fotokopi:</span>
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-[10px] font-bold">N</span>
              <input 
                type="text" 
                inputMode="decimal" 
                placeholder="0,00" 
                value={photoCash} 
                onChange={(e) => { setPhotoCash(e.target.value); setHasUnsavedChanges(true); setSaveStatus('idle'); }} 
                onBlur={(e) => handlePhotoBlur('cash', e.target.value)} 
                className="w-16 bg-[#070b14] border border-slate-700 text-emerald-400 text-right focus:outline-none focus:border-blue-500 font-mono font-bold text-xs rounded px-1.5 py-0.5 placeholder:text-slate-600 transition-colors" 
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-slate-400 text-[10px] font-bold">K</span>
              <input 
                type="text" 
                inputMode="decimal" 
                placeholder="0,00" 
                value={photoCard} 
                onChange={(e) => { setPhotoCard(e.target.value); setHasUnsavedChanges(true); setSaveStatus('idle'); }} 
                onBlur={(e) => handlePhotoBlur('card', e.target.value)} 
                className="w-16 bg-[#070b14] border border-slate-700 text-purple-400 text-right focus:outline-none focus:border-blue-500 font-mono font-bold text-xs rounded px-1.5 py-0.5 placeholder:text-slate-600 transition-colors" 
              />
            </div>
          </div>

          <button onClick={() => setIsSettingsModalOpen(true)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors" title="Mağaza Hesap Ayarları">
            <Settings size={18} />
          </button>

          <div className="flex items-center gap-1 bg-[#070b14] border border-slate-700 rounded p-1 relative">
            <button onClick={() => changeDate(-1)} disabled={isFetching || isSaving || isSyncing} className="p-1 hover:bg-slate-800 rounded text-slate-400 transition-colors disabled:opacity-50">
              <ChevronLeft size={16} />
            </button>
            <div onClick={() => !isFetching && !isSaving && !isSyncing && dateInputRef.current?.showPicker()} className="flex items-center gap-2 px-2 py-0.5 text-xs font-bold text-white min-w-[120px] justify-center cursor-pointer hover:bg-slate-800/80 rounded transition-colors group">
              <Calendar size={14} className="text-indigo-400 group-hover:text-indigo-300 transition-colors"/>
              {currentDate.split('-').reverse().join('.')}
            </div>
            <input 
              ref={dateInputRef} 
              type="date" 
              value={currentDate} 
              onChange={(e) => { if (e.target.value) setCurrentDate(e.target.value); }} 
              className="sr-only" 
              style={{ colorScheme: 'dark' }} 
            />
            <button onClick={() => changeDate(1)} disabled={isFetching || isSaving || isSyncing} className="p-1 hover:bg-slate-800 rounded text-slate-400 transition-colors disabled:opacity-50">
              <ChevronRight size={16} />
            </button>
          </div>
          
          <button 
            onClick={saveDayData}
            disabled={isSaving || isSyncing || isFetching || saveStatus === 'success' || !hasUnsavedChanges}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-lg min-w-[150px] justify-center
              ${saveStatus === 'success' ? 'bg-emerald-600 text-white shadow-emerald-900/20' : 
                saveStatus === 'error' ? 'bg-rose-600 text-white shadow-rose-900/20' : 
                'bg-blue-600 hover:bg-blue-700 text-white active:scale-95 shadow-blue-900/20 disabled:opacity-30 disabled:active:scale-100 disabled:cursor-not-allowed'}`}
          >
            {isSaving ? (
              <><Loader2 size={16} className="animate-spin" /> Kaydediliyor...</>
            ) : isSyncing ? (
              <><Loader2 size={16} className="animate-spin text-amber-300" /> Hesaplar İşleniyor...</>
            ) : saveStatus === 'success' ? (
              <>Kaydedildi ✅</>
            ) : saveStatus === 'error' ? (
              <>Hata! Tekrar Dene</>
            ) : (
              <><Save size={16} /> Günü Kaydet</>
            )}
          </button>
        </div>
      </div>

      {/* GRID ALANI */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-1.5 py-2.5">
        <div className="flex flex-col xl:flex-row gap-3 items-start h-full">
          
          {/* SOL BÖLÜM */}
          <div className="flex-1 min-w-0 w-full">
            <div className="hidden xl:grid grid-cols-3 gap-3 items-start">
              <div className="flex flex-col gap-3">
                {renderCategoryBox(CATEGORIES[0], 0)}
                {renderCategoryBox(CATEGORIES[3], 3)}
              </div>
              <div className="flex flex-col gap-3">
                {renderCategoryBox(CATEGORIES[1], 1)}
                {renderCategoryBox(CATEGORIES[4], 4)}
              </div>
              <div className="flex flex-col gap-3">
                {renderCategoryBox(CATEGORIES[2], 2)}
                {renderCategoryBox(CATEGORIES[5], 5)}
              </div>
            </div>
            
            <div className="hidden md:grid xl:hidden grid-cols-2 gap-3 items-start">
              <div className="flex flex-col gap-3">
                {renderCategoryBox(CATEGORIES[0], 0)}
                {renderCategoryBox(CATEGORIES[2], 2)}
                {renderCategoryBox(CATEGORIES[4], 4)}
              </div>
              <div className="flex flex-col gap-3">
                {renderCategoryBox(CATEGORIES[1], 1)}
                {renderCategoryBox(CATEGORIES[3], 3)}
                {renderCategoryBox(CATEGORIES[5], 5)}
              </div>
            </div>
            
            <div className="grid md:hidden grid-cols-1 gap-3 items-start">
              {CATEGORIES.map((cat, idx) => renderCategoryBox(cat, idx))}
            </div>
          </div>

          {/* SAĞ BÖLÜM */}
          <div className="w-full xl:w-[340px] 2xl:w-[380px] shrink-0 xl:pl-1 sticky top-0 flex flex-col gap-3 pb-4">
            
            {/* GİDER & MASRAF */}
            <div style={{ animation: 'fadeInUp 0.4s both 0.6s' }} className="bg-[#070b14] border border-slate-700 rounded-lg flex flex-col overflow-hidden h-fit shadow-lg w-full hover:border-slate-500/50 transition-colors shrink-0">
              <div className="bg-amber-600 px-2.5 py-1.5 flex justify-between items-center text-white text-[11px] font-normal">
                <span className="truncate pr-2 flex-1 min-w-0">Gider & Masraf</span>
                <div className="flex items-center shrink-0 text-[10px] font-mono font-normal">
                  <div className="w-[55px] flex flex-col items-end pr-1 justify-center">
                    <span className="text-white/80 leading-none mb-0.5 text-[8px] font-sans font-normal">NAKİT</span>
                    <span>{expenseCash > 0 ? expenseCash.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}</span>
                  </div>
                  <div className="w-[55px] flex flex-col items-end pr-1 justify-center border-l border-white/20">
                    <span className="text-white/80 leading-none mb-0.5 text-[8px] font-sans font-normal">K.KARTI</span>
                    <span>{expenseCard > 0 ? expenseCard.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00'}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col divide-y divide-slate-700 pb-1 transition-all duration-300 relative">
                {isFetching && (
                  <div className="absolute inset-0 bg-[#070b14]/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                    <Loader2 className="animate-spin text-slate-400" size={16} />
                  </div>
                )}
                {expenseRows.map((row, index) => (
                  <div key={row.id} className="flex text-[11px] hover:bg-slate-800/50 transition-colors group">
                    <input 
                      type="text" 
                      placeholder={index === 0 ? "Açıklama / Masraf Kalemi..." : ""} 
                      value={row.description} 
                      onChange={(e) => handleInputChange(row.id, 'description', e.target.value)} 
                      className="flex-1 min-w-[50px] bg-transparent px-2 py-1.5 text-slate-200 focus:outline-none focus:bg-amber-900/20 border-r border-slate-700 placeholder:text-slate-600 font-sans font-normal transition-colors" 
                    />
                    <input 
                      type="text" 
                      inputMode="decimal" 
                      placeholder={index === 0 ? "0,00" : ""} 
                      value={row.cash} 
                      onChange={(e) => handleInputChange(row.id, 'cash', e.target.value)} 
                      onBlur={(e) => handleInputBlur(row.id, 'cash', e.target.value)} 
                      className="w-[55px] shrink-0 bg-transparent pr-1 pl-0.5 py-1 text-amber-400 text-right focus:outline-none focus:bg-amber-900/20 border-r border-slate-700 font-mono font-normal placeholder:text-amber-900/40 transition-colors" 
                    />
                    <input 
                      type="text" 
                      inputMode="decimal" 
                      placeholder={index === 0 ? "0,00" : ""} 
                      value={row.card} 
                      onChange={(e) => handleInputChange(row.id, 'card', e.target.value)} 
                      onBlur={(e) => handleInputBlur(row.id, 'card', e.target.value)} 
                      className="w-[55px] shrink-0 bg-transparent pr-1 pl-0.5 py-1 text-purple-400 text-right focus:outline-none focus:bg-amber-900/20 font-mono font-normal placeholder:text-purple-900/40 transition-colors" 
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* GÜNLÜK NOTLAR */}
            <div style={{ animation: 'fadeInUp 0.4s both 0.7s' }} className="bg-[#070b14] border border-slate-700 rounded-lg flex flex-col overflow-hidden shadow-lg w-full relative hover:border-slate-500/50 transition-colors shrink-0">
              <div className="bg-slate-800/80 px-2.5 py-1.5 flex items-center gap-1.5 text-white text-[11px] font-bold border-b border-slate-700">
                <StickyNote size={12} className="text-amber-400" />
                <span className="truncate pr-2 flex-1 min-w-0">Günün Notları</span>
              </div>
              <textarea 
                value={dailyNotes} 
                onChange={(e) => { setDailyNotes(e.target.value); setHasUnsavedChanges(true); setSaveStatus('idle'); }} 
                disabled={isFetching} 
                placeholder="Bugüne dair hatırlatmalar, alacaklar, emanetler veya önemli notlar..." 
                className="w-full bg-transparent p-3 text-slate-300 text-[11px] focus:outline-none resize-y min-h-[140px] custom-scrollbar placeholder:text-slate-600/70 font-sans leading-relaxed disabled:opacity-50 transition-colors focus:bg-slate-900/30" 
              />
            </div>

            {/* GÜNLÜK BANKA TRANSFERLERİ LİSTESİ */}
            <div style={{ animation: 'fadeInUp 0.4s both 0.8s' }} className="bg-[#070b14] border border-slate-700 rounded-lg flex flex-col overflow-hidden shadow-lg w-full relative hover:border-slate-500/50 transition-colors flex-1 min-h-[150px]">
              <div className="bg-slate-800/80 px-2.5 py-1.5 flex items-center justify-between gap-1.5 text-white text-[11px] font-bold border-b border-slate-700 shrink-0">
                <div className="flex items-center gap-1.5">
                  <ArrowRightLeft size={12} className="text-indigo-400" />
                  <span className="truncate">Günün Banka Hareketleri</span>
                </div>
                <span className="bg-slate-900 px-1.5 py-0.5 rounded text-[9px] text-slate-400 border border-slate-700">{transfers.length} İşlem</span>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 flex flex-col relative">
                {transfers.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-4 border border-dashed border-slate-700/60 rounded-lg bg-slate-800/10 text-slate-500 shadow-inner m-1">
                     <ArrowRightLeft size={24} className="mb-2 opacity-50 animate-bounce text-slate-400" />
                     <p className="text-[10px] font-bold text-slate-400 text-center">Bugün banka/kasa<br/>işlemi bulunmuyor.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {transfers.map((t, index) => {
                      const bank = activeBanks.find(b => b.id === t.bankId)
                      const isToBank = t.type === 'to_bank'
                      return (
                        <div key={t.id} style={{ animation: 'fadeInUp 0.3s both', animationDelay: `${0.1 + (index * 0.05)}s` }} className="flex justify-between items-center bg-[#0a0f1d] border border-slate-700/50 p-2 rounded-md hover:border-slate-500 transition-colors group">
                          <div className="flex flex-col flex-1 min-w-0 pr-2">
                            <span className="text-[10px] text-slate-200 font-bold truncate flex items-center gap-1.5">
                              {bank?.bank_name}
                              {t.isNew && <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-[1px] rounded text-[8px] font-bold uppercase tracking-wider animate-pulse shrink-0">Bekleyen</span>}
                            </span>
                            <span className="text-[9px] text-slate-500 truncate mt-0.5 flex items-center gap-1">
                              {isToBank ? <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span> : <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>}
                              {t.description || 'Açıklama yok'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="flex flex-col items-end">
                              <span className={`text-[9px] font-bold font-mono ${isToBank ? 'text-indigo-400' : 'text-amber-400'}`}>
                                {isToBank ? 'Bankaya' : 'Kasaya'}
                              </span>
                              <span className={`text-[11px] font-mono font-black ${isToBank ? 'text-indigo-400' : 'text-amber-400'}`}>
                                {formatMoney(t.amount, 'TRY').formatted}
                              </span>
                            </div>
                            <button onClick={() => handleDeleteTransfer(t.id)} className="text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 p-1.5 rounded transition-colors" title="İptal Et">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* AYARLAR MODALI */}
      {isSettingsModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-[#0a0f1d] border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900/50 px-4 py-3 flex justify-between items-center border-b border-slate-700">
              <h2 className="text-slate-200 font-bold flex items-center gap-2">
                <Settings size={18} className="text-slate-400" /> Mağaza Z-Raporu Ayarları
              </h2>
              <button onClick={() => setIsSettingsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={saveSettings} className="p-4 flex flex-col gap-4 text-xs">
              
              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-400 uppercase">Mağazanın Bağlı Olduğu Merkez</label>
                <select 
                  value={posSettings.companyId || ''} 
                  onChange={(e) => setPosSettings({ ...posSettings, companyId: e.target.value })} 
                  className="bg-[#070b14] border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">🌍 Ortak / Bağımsız İşlem</option>
                  <optgroup label="Ticari Şirketler">
                    {companies.filter(c => !c.is_personal).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                  <optgroup label="Şahsi Merkezler">
                    {companies.filter(c => c.is_personal).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </optgroup>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-400 uppercase">Mağaza Satışlarının Düşüleceği Depo</label>
                <select 
                  value={posSettings.targetWarehouseId || ''} 
                  onChange={(e) => setPosSettings({ ...posSettings, targetWarehouseId: e.target.value })} 
                  className="bg-[#070b14] border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Depodan Düşme Kapalı --</option>
                  {warehouses.map(w => (<option key={w.id} value={w.id}>{w.name}</option>))}
                </select>
                <p className="text-[10px] text-slate-500 leading-tight">Bu depo seçildiğinde, POS ekranında açıklama girerken stoğunuzdaki ürünler aranabilir hale gelir.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-400 uppercase">Nakit Satışların Aktarılacağı Kasa</label>
                <select 
                  value={posSettings.targetCashId} 
                  onChange={(e) => setPosSettings({ ...posSettings, targetCashId: e.target.value })} 
                  className="bg-[#070b14] border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Nakit Aktarımı Kapalı --</option>
                  {activeCashes.map(cash => (<option key={cash.id} value={cash.id}>{cash.name}</option>))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-400 uppercase">K.Kartı Satışların Aktarılacağı Hesap</label>
                <select 
                  value={posSettings.targetBankId} 
                  onChange={(e) => setPosSettings({ ...posSettings, targetBankId: e.target.value })} 
                  className="bg-[#070b14] border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- K.Kartı Aktarımı Kapalı --</option>
                  {activeBanks.map(bank => (<option key={bank.id} value={bank.id}>{bank.bank_name} - {bank.account_name}</option>))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-bold text-slate-400 uppercase">Kartlı Giderlerin Düşüleceği Kredi Kartı</label>
                <select 
                  value={posSettings.targetCreditCardId || ''} 
                  onChange={(e) => setPosSettings({ ...posSettings, targetCreditCardId: e.target.value })} 
                  className="bg-[#070b14] border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- K.Kartı Masraf Aktarımı Kapalı --</option>
                  {activeCards.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
              </div>

              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg transition-colors mt-2 active:scale-95 shadow-lg shadow-emerald-900/20">
                Ayarları Kaydet
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TRANSFER MODAL */}
      {isTransferModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" style={{ zIndex: 99999 }}>
          <div className="bg-[#0a0f1d] border border-slate-700 rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="bg-slate-900/50 px-4 py-3 flex justify-between items-center border-b border-slate-700">
              <h2 className="text-slate-200 font-bold flex items-center gap-2">
                <Landmark size={18} className="text-indigo-400" /> Kasa - Banka İşlemleri
              </h2>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-4">
              <div className="flex bg-slate-800/50 p-1 rounded-lg border border-slate-700">
                <button 
                  onClick={() => setTransferForm({ ...transferForm, type: 'to_bank' })} 
                  className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${transferForm.type === 'to_bank' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Kasadan Bankaya
                </button>
                <button 
                  onClick={() => setTransferForm({ ...transferForm, type: 'from_bank' })} 
                  className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${transferForm.type === 'from_bank' ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Bankadan Kasaya
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-400 uppercase">İşlem Yapılacak Hesap</label>
                {activeBanks.length === 0 ? (
                  <div className="bg-[#070b14] border border-dashed border-slate-700 text-slate-500 text-xs rounded-lg px-3 py-3 text-center flex flex-col items-center gap-2">
                     <Landmark size={20} className="opacity-50 animate-bounce text-indigo-400" />
                     Sistemde yetkili bir banka hesabı bulunmuyor.
                  </div>
                ) : (
                  <select 
                    value={transferForm.bankId} 
                    onChange={(e) => setTransferForm({ ...transferForm, bankId: e.target.value })} 
                    className="bg-[#070b14] border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500"
                  >
                    {activeBanks.map(bank => (<option key={bank.id} value={bank.id}>{bank.bank_name} - {bank.account_name}</option>))}
                  </select>
                )}
              </div>

              <div className="flex gap-3">
                <div className="flex flex-col gap-1.5 flex-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Tutar (TL)</label>
                  <input 
                    type="text" 
                    inputMode="decimal" 
                    placeholder="0,00" 
                    value={transferForm.amountStr} 
                    onChange={(e) => setTransferForm({ ...transferForm, amountStr: e.target.value })} 
                    onBlur={(e) => { const p = parseValue(e.target.value); if (p > 0) setTransferForm({ ...transferForm, amountStr: p.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) }) }} 
                    className="bg-[#070b14] border border-slate-700 text-emerald-400 font-mono text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500 text-right transition-colors" 
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-[2]">
                  <label className="text-xs font-bold text-slate-400 uppercase">Açıklama</label>
                  <input 
                    type="text" 
                    placeholder="Örn: Gün sonu yatırma..." 
                    value={transferForm.description} 
                    onChange={(e) => setTransferForm({ ...transferForm, description: e.target.value })} 
                    className="bg-[#070b14] border border-slate-700 text-slate-200 font-sans text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-indigo-500 transition-colors" 
                  />
                </div>
              </div>

              <button 
                onClick={handleAddTransfer} 
                disabled={!transferForm.amountStr || parseValue(transferForm.amountStr) <= 0 || activeBanks.length === 0} 
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-lg transition-colors mt-2 active:scale-95"
              >
                Geçici Listeye Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS Animasyon Desteği */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-15px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
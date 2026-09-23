'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { formatMoney, formatPhoneNumber } from '@/lib/utils'
import toast, { Toaster } from 'react-hot-toast'
import { Building2, Plus, Trash2, X, Edit3, Search, Phone, Mail, FileText, MapPin, ListPlus, CheckSquare, Square, ScrollText, Landmark, Wallet, CreditCard, Building, Home, Globe, AlertTriangle, RefreshCw, ArrowUpRight, Store } from 'lucide-react'

type Company = { id: string; name: string; is_personal: boolean }
type Warehouse = { id: string; name: string }

type Supplier = {
  id: string; company_name: string; contact_name: string; phone: string;
  email: string; tax_office: string; tax_id: string; address: string;
  balance: number; currency: string;
  company_id?: string | null;
  tax_number?: string | null;
  company?: { id: string; name: string; is_personal: boolean };
}

type InvoiceLine = {
  id: string; name: string; quantity: string; unitPrice: string;
  vatRate: string; addToStock: boolean; warehouseId: string;
  targetStockId?: string; stockTxId?: string;
  selectedStockId?: string; 
}

type SupplierTransaction = {
  id: string; supplier_id: string; company_id?: string | null; tx_date: string; description: string;
  tx_type: 'debt' | 'payment'; amount: number; is_detailed?: boolean;
  invoice_lines?: InvoiceLine[] | any; payment_source_type?: string; 
  payment_source_id?: string; currency?: string; exchange_rate?: number;
  running_balance?: number; company?: { name: string; is_personal: boolean }
}

type BankAccount = { id: string; bank_name: string; balance: number; currency: string }
type CashRegister = { id: string; name: string; balance: number; currency: string }
type CreditCardItem = { id: string; name: string; current_debt: number; company_id?: string | null }
type StockItem = { id: string; name: string; unit_price: number; vat_rate: number; warehouse_id: string; currency: string; quantity: number }

function getLocalTodayISO() {
  const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
function formatDateTR(dateStr: string) {
  if (!dateStr) return ''; const parts = dateStr.split('-'); if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`; return dateStr
}

import { logActivity } from '@/lib/audit'

export default function SuppliersPage() {
  const { profile, isAdmin, hasCompanyAccess } = useAuth()
  const isRestricted = !isAdmin && profile?.allowed_companies && profile.allowed_companies.length > 0
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all')

  const [companies, setCompanies] = useState<Company[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [stocks, setStocks] = useState<StockItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  const [banks, setBanks] = useState<BankAccount[]>([])
  const [cashes, setCashes] = useState<CashRegister[]>([])
  const [cards, setCards] = useState<CreditCardItem[]>([])
  const [rates, setRates] = useState<{ USD: number; EUR: number }>({ USD: 34.25, EUR: 37.80 })

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [suppCompanyId, setSuppCompanyId] = useState('common')
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState(''); const [email, setEmail] = useState('')
  const [taxOffice, setTaxOffice] = useState(''); const [taxId, setTaxId] = useState(''); const [address, setAddress] = useState('')
  const [openingBalance, setOpeningBalance] = useState('')
  const [openingCompanyId, setOpeningCompanyId] = useState('common') 
  const [openingCurrency, setOpeningCurrency] = useState<'TRY' | 'USD' | 'EUR'>('TRY')
  const [openingExchangeRate, setOpeningExchangeRate] = useState('1')

  const [editingTxId, setEditingTxId] = useState<string | null>(null)
  const todayISO = getLocalTodayISO()
  const [txDate, setTxDate] = useState(todayISO)
  const [txCompanyId, setTxCompanyId] = useState('common')
  const [txDesc, setTxDesc] = useState('')
  const [txType, setTxType] = useState<'debt' | 'payment'>('debt')
  const [txAmount, setTxAmount] = useState('')
  const [txCurrency, setTxCurrency] = useState<'TRY' | 'USD' | 'EUR'>('TRY')
  const [txExchangeRate, setTxExchangeRate] = useState('1')
  const [paymentSource, setPaymentSource] = useState('') 

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)
  const [invCompanyId, setInvCompanyId] = useState('common')
  const [invDate, setInvDate] = useState(todayISO)
  const [invDesc, setInvDesc] = useState('')
  const [invCurrency, setInvCurrency] = useState<'TRY' | 'USD' | 'EUR'>('TRY')
  const [invExchangeRate, setInvExchangeRate] = useState('1')
  const [invLines, setInvLines] = useState<InvoiceLine[]>([])
  const [activeStockDropdown, setActiveStockDropdown] = useState<string | null>(null) 

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string; confirmText: string; cancelText: string; isDanger: boolean; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', confirmText: '', cancelText: '', isDanger: false, onConfirm: () => {} })

  useEffect(() => {
    fetchExchangeRates(); fetchCompanies(); fetchWarehouses(); fetchPaymentSources(); fetchStocks()
  }, [])

  useEffect(() => {
    fetchSuppliers()
  }, [companies])

  useEffect(() => {
    if (selectedSupplierId) { 
      fetchTransactions(selectedSupplierId); 
      cancelEditTx()
      const s = suppliers.find(item => item.id === selectedSupplierId)
      if (s?.currency) {
        setTxCurrency((s.currency as 'TRY' | 'USD' | 'EUR') || 'TRY')
        setInvCurrency((s.currency as 'TRY' | 'USD' | 'EUR') || 'TRY')
      }
      const suppComp = s?.company_id || (s?.tax_number && s.tax_number.includes('-') ? s.tax_number : null)
      if (suppComp) {
        setTxCompanyId(suppComp)
        setInvCompanyId(suppComp)
      } else if (isRestricted && profile?.allowed_companies?.[0]) {
        setTxCompanyId(profile.allowed_companies[0])
        setInvCompanyId(profile.allowed_companies[0])
      } else {
        setTxCompanyId('common')
        setInvCompanyId('common')
      }
    } else {
      setTransactions([])
    }
  }, [selectedSupplierId, suppliers, isRestricted, profile])


  useEffect(() => {
    if (txCurrency === 'USD') setTxExchangeRate(rates.USD.toString())
    else if (txCurrency === 'EUR') setTxExchangeRate(rates.EUR.toString())
    else setTxExchangeRate('1')
  }, [txCurrency, rates])

  useEffect(() => {
    if (invCurrency === 'USD') setInvExchangeRate(rates.USD.toString())
    else if (invCurrency === 'EUR') setInvExchangeRate(rates.EUR.toString())
    else setInvExchangeRate('1')
  }, [invCurrency, rates])

  async function fetchExchangeRates() {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' }); 
      const data = await res.json()
      if (data && data.rates) setRates({ USD: Number(data.rates.TRY.toFixed(4)), EUR: Number((data.rates.TRY / data.rates.EUR).toFixed(4)) })
    } catch (err) { console.error(err) }
  }

  async function fetchCompanies() { const { data } = await supabase.from('companies').select('*').order('name', { ascending: true }); setCompanies(data || []) }
  async function fetchPaymentSources() {
    const { data: bData } = await supabase.from('bank_accounts').select('id, bank_name, balance, currency')
    const { data: cData } = await supabase.from('cash_registers').select('id, name, balance, currency')
    const { data: cdData } = await supabase.from('credit_cards').select('id, name, current_debt, company_id')
    setBanks(bData || []); setCashes(cData || [])
    const filteredCards = (cdData || []).filter((c: any) => {
      if (!isRestricted) return true
      if (!c.company_id) return false
      return profile?.allowed_companies?.includes(c.company_id)
    })
    setCards(filteredCards)
  }

  async function fetchSuppliers() {
    const { data, error } = await supabase.from('suppliers').select('*').order('company_name', { ascending: true })
    if (error) {
      console.error('Tedarikçiler yüklenemedi:', error)
      return
    }
    const comps = companies.length > 0 ? companies : ((await supabase.from('companies').select('*')).data || [])
    const mapped: Supplier[] = (data || []).map((s: any) => {
      const compId = s.company_id || (s.tax_number && s.tax_number.includes('-') ? s.tax_number : null)
      const comp = comps.find(c => c.id === compId)
      return { ...s, company_id: compId, company: comp }
    })
    setSuppliers(mapped)
    if (mapped.length > 0 && !selectedSupplierId) setSelectedSupplierId(mapped[0].id)
  }

  async function fetchWarehouses() {
    const { data } = await supabase.from('warehouses').select('id, name').order('created_at', { ascending: true }); setWarehouses(data || [])
  }

  async function fetchStocks() {
    const { data } = await supabase.from('stocks').select('id, name, unit_price, vat_rate, warehouse_id, currency, quantity').order('name', { ascending: true }); setStocks(data || [])
  }

  async function fetchTransactions(suppId: string) {
    const { data } = await supabase.from('supplier_transactions').select('*, company:companies(name, is_personal)').eq('supplier_id', suppId).order('tx_date', { ascending: false }).order('created_at', { ascending: false })
    setTransactions(data || [])
  }

  // =========================================================================================
  // --- MUTLAK HESAPLAMA MOTORLARI (ABSOLUTE LEDGER RECALCULATORS) ---
  // =========================================================================================
  async function recalculateAbsoluteSupplierBalance(supplierId: string) {
    const { data: supp } = await supabase.from('suppliers').select('currency').eq('id', supplierId).single()
    const suppCurr = supp?.currency || 'TRY'

    const { data: txs } = await supabase.from('supplier_transactions').select('amount, tx_type, currency, exchange_rate').eq('supplier_id', supplierId)
    let absoluteBal = 0
    txs?.forEach(t => {
      let val = Number(t.amount || 0)
      const txCurr = t.currency || 'TRY'
      const rate = Number(t.exchange_rate) || 1

      if (suppCurr === 'USD') {
        if (txCurr === 'TRY') val = val / (rate || rates.USD || 1)
        else if (txCurr === 'EUR') val = (val * (rate || rates.EUR || 1)) / (rates.USD || 1)
      } else if (suppCurr === 'EUR') {
        if (txCurr === 'TRY') val = val / (rate || rates.EUR || 1)
        else if (txCurr === 'USD') val = (val * (rate || rates.USD || 1)) / (rates.EUR || 1)
      } else {
        if (txCurr !== 'TRY') val = val * rate
      }

      if (t.tx_type === 'debt') absoluteBal += val
      else absoluteBal -= val
    })
    await supabase.from('suppliers').update({ balance: absoluteBal }).eq('id', supplierId)
  }

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

  async function recalculateAbsoluteStock(stockId: string) {
    const { data: txs } = await supabase.from('stock_transactions').select('quantity, tx_type').eq('stock_id', stockId)
    let absoluteQty = 0
    txs?.forEach(t => { absoluteQty += t.tx_type === 'in' ? Number(t.quantity) : -Number(t.quantity) })
    await supabase.from('stocks').update({ quantity: absoluteQty }).eq('id', stockId)
  }
  // =========================================================================================

  function openAddModal() {
    setEditingId(null)
    setCompanyName('')
    setContactName('')
    setPhone('')
    setEmail('')
    setTaxOffice('')
    setTaxId('')
    setAddress('')
    setOpeningBalance('')
    const defaultComp = isRestricted && profile?.allowed_companies?.[0] ? profile.allowed_companies[0] : 'common'
    setSuppCompanyId(defaultComp)
    setOpeningCompanyId(defaultComp)
    setOpeningCurrency('TRY')
    setOpeningExchangeRate('1')
    setIsModalOpen(true)
  }

  async function openEditModal(supp: Supplier, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingId(supp.id); setCompanyName(supp.company_name); setContactName(supp.contact_name || ''); setPhone(formatPhoneNumber(supp.phone || '')); setEmail(supp.email || ''); setTaxOffice(supp.tax_office || ''); setTaxId(supp.tax_id || ''); setAddress(supp.address || ''); setIsModalOpen(true)

    const currentCompId = supp.company_id || (supp.tax_number && supp.tax_number.includes('-') ? supp.tax_number : null) || 'common'
    setSuppCompanyId(currentCompId)
    setOpeningCompanyId(currentCompId)

    const { data: txs } = await supabase.from('supplier_transactions')
       .select('amount, company_id, currency, exchange_rate').eq('supplier_id', supp.id).eq('description', 'Açılış Bakiyesi / Devir').limit(1);
    
    if (txs && txs.length > 0) {
      setOpeningBalance(txs[0].amount.toString());
      const cur = (txs[0].currency as 'TRY' | 'USD' | 'EUR') || (supp.currency as 'TRY' | 'USD' | 'EUR') || 'TRY';
      setOpeningCurrency(cur);
      setOpeningExchangeRate(txs[0].exchange_rate ? txs[0].exchange_rate.toString() : (cur === 'USD' ? rates.USD.toString() : cur === 'EUR' ? rates.EUR.toString() : '1'));
    } else {
      setOpeningBalance('0');
      const cur = (supp.currency as 'TRY' | 'USD' | 'EUR') || 'TRY';
      setOpeningCurrency(cur);
      setOpeningExchangeRate(cur === 'USD' ? rates.USD.toString() : cur === 'EUR' ? rates.EUR.toString() : '1');
    }
  }

  async function handleSaveSupplier(e: React.FormEvent) {
    e.preventDefault(); if (!companyName) return
    const initialBalance = parseFloat(openingBalance) || 0
    const initialCompId = suppCompanyId === 'common' || !suppCompanyId ? null : suppCompanyId
    const rateVal = openingCurrency === 'TRY' ? 1 : (parseFloat(openingExchangeRate) || 1)
    const formattedPhone = formatPhoneNumber(phone).trim()
    const payload: any = { 
      company_name: companyName, 
      contact_name: contactName, 
      phone: formattedPhone, 
      email, 
      tax_office: taxOffice, 
      tax_id: taxId, 
      address, 
      currency: openingCurrency,
      tax_number: initialCompId // stores company UUID safely in existing column
    }
    
    try {
      if (editingId) {
        const oldSupp = suppliers.find(s => s.id === editingId)
        
        const { data: oldTxs } = await supabase.from('supplier_transactions')
           .select('*').eq('supplier_id', editingId).eq('description', 'Açılış Bakiyesi / Devir').limit(1);
        
        const oldTx = oldTxs && oldTxs.length > 0 ? oldTxs[0] : null;

        if (oldTx) {
           const compChanged = oldTx.company_id !== initialCompId;
           const amountChanged = (initialBalance - oldTx.amount) !== 0;
           const curChanged = (oldTx.currency || 'TRY') !== openingCurrency;
           const rateChanged = Number(oldTx.exchange_rate || 1) !== rateVal;
           if (amountChanged || compChanged || curChanged || rateChanged) {
              if (initialBalance === 0) await supabase.from('supplier_transactions').delete().eq('id', oldTx.id);
              else await supabase.from('supplier_transactions').update({
                amount: initialBalance,
                company_id: initialCompId,
                currency: openingCurrency,
                exchange_rate: rateVal
              }).eq('id', oldTx.id);
           }
        } else if (initialBalance > 0) {
           const txPayload = { supplier_id: editingId, company_id: initialCompId, tx_date: todayISO, description: 'Açılış Bakiyesi / Devir', tx_type: 'debt', amount: initialBalance, currency: openingCurrency, exchange_rate: rateVal }
           await supabase.from('supplier_transactions').insert([txPayload]);
        }

        const fullPayload = { ...payload, company_id: initialCompId }
        let { error } = await supabase.from('suppliers').update(fullPayload).eq('id', editingId)
        if (error && error.message?.includes('company_id')) {
          delete fullPayload.company_id
          const retry = await supabase.from('suppliers').update(payload).eq('id', editingId)
          if (retry.error) throw retry.error
        } else if (error) {
          throw error
        }
        
        await recalculateAbsoluteSupplierBalance(editingId);

        await logActivity('supplier', 'UPDATE', `Tedarikçi güncellendi: ${companyName}`, editingId, 0, openingCurrency, oldSupp, fullPayload, initialCompId)
        toast.success('Tedarikçi başarıyla güncellendi.')

        if (selectedSupplierId === editingId) fetchTransactions(editingId);

      } else {
        const fullPayload = { ...payload, company_id: initialCompId, balance: 0 }
        let { data, error } = await supabase.from('suppliers').insert([fullPayload]).select().single()
        if (error && error.message?.includes('company_id')) {
          delete fullPayload.company_id
          const retry = await supabase.from('suppliers').insert([{ ...payload, balance: 0 }]).select().single()
          if (retry.error) throw retry.error
          data = retry.data
        } else if (error) {
          throw error
        }
        
        await logActivity('supplier', 'INSERT', `Yeni tedarikçi eklendi: ${companyName}`, data.id, 0, openingCurrency, null, data, initialCompId)
        
        if (initialBalance > 0) {
           const txPayload = { supplier_id: data.id, company_id: initialCompId, tx_date: todayISO, description: 'Açılış Bakiyesi / Devir', tx_type: 'debt', amount: initialBalance, currency: openingCurrency, exchange_rate: rateVal }
           const { data: txData, error: txErr } = await supabase.from('supplier_transactions').insert([txPayload]).select().single()
           if (!txErr && txData) {
             await logActivity('supplier_tx', 'INSERT', `Açılış Bakiyesi (Tedarikçi): ${companyName}`, txData.id, initialBalance, openingCurrency, null, txData, initialCompId)
           }
        }

        await recalculateAbsoluteSupplierBalance(data.id);
        toast.success('Yeni tedarikçi eklendi.')
      }
      setIsModalOpen(false); fetchSuppliers()
    } catch (err: any) { toast.error('Tedarikçi kaydedilemedi: ' + err.message) }
  }

  function handleDeleteSupplier(id: string, e: React.MouseEvent) {
    e.stopPropagation(); 
    setConfirmDialog({
      isOpen: true,
      title: 'Tedarikçiyi Sil',
      message: 'Bu tedarikçiyi silmek istediğinize emin misiniz? Bütün cari hesap hareketleri kalıcı olarak silinecektir.',
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        try {
          const suppToDelete = suppliers.find(s => s.id === id)
          await supabase.from('suppliers').delete().eq('id', id)
          
          await logActivity('supplier', 'DELETE', `Tedarikçi silindi: ${suppToDelete?.company_name}`, id, suppToDelete?.balance, 'TRY', suppToDelete, null)
          
          toast.success('Tedarikçi silindi.')
          if (selectedSupplierId === id) setSelectedSupplierId(null)
          fetchSuppliers()
        } catch(err:any) { toast.error('Silme başarısız: ' + err.message) }
      }
    })
  }

  function convertCurrency(amount: number, fromCurr: string, toCurr: string) {
    if (fromCurr === toCurr) return amount
    let tryVal = amount
    if (fromCurr === 'USD') tryVal = amount * rates.USD
    if (fromCurr === 'EUR') tryVal = amount * rates.EUR
    if (toCurr === 'TRY') return tryVal
    if (toCurr === 'USD') return tryVal / rates.USD
    if (toCurr === 'EUR') return tryVal / rates.EUR
    return amount
  }

  async function modifyPaymentSourceBalance(sourceType: string, sourceId: string, amount: number, txCurr: string, customRate: number, action: 'payment' | 'reverse', relatedTxId: string, dateStr: string, suppName: string, desc: string, compId: string | null) {
    let table = ''; let txTable = ''; let txIdField = ''
    if (sourceType === 'cash') { table = 'cash_registers'; txTable = 'cash_transactions'; txIdField = 'cash_register_id' }
    else if (sourceType === 'bank') { table = 'bank_accounts'; txTable = 'bank_transactions'; txIdField = 'bank_account_id' }
    else if (sourceType === 'card') { table = 'credit_cards'; txTable = 'card_transactions'; txIdField = 'card_id' }
    else return

    const { data } = await supabase.from(table).select('currency').eq('id', sourceId).single(); if (!data) return
    const accCurr = data.currency || 'TRY'

    let convertedAmount = amount
    if (txCurr !== accCurr) {
      let amountInTry = txCurr === 'TRY' ? amount : amount * customRate
      if (accCurr === 'TRY') convertedAmount = amountInTry
      else if (accCurr === 'USD') convertedAmount = amountInTry / rates.USD
      else if (accCurr === 'EUR') convertedAmount = amountInTry / rates.EUR
    }

    if (txTable && relatedTxId) {
      if (action === 'payment') {
        const payload: any = {
          [txIdField]: sourceId, company_id: compId, tx_date: dateStr, description: `Tedarikçi Ödemesi (${suppName}) - ${desc}`,
          amount: convertedAmount, is_transfer: false, transfer_id: `SUPP-${relatedTxId}`
        }

        if (sourceType === 'card') {
          payload.tx_type = 'expense' // Kartlar için ödeme çıkışı expense'tir.
        } else {
          payload.tx_type = 'out'
          payload.currency = accCurr
          payload.exchange_rate = 1
        }
        if (sourceType === 'bank') payload.status = 'completed'

        await supabase.from(txTable).insert([payload])
      } else if (action === 'reverse') {
        await supabase.from(txTable).delete().eq('transfer_id', `SUPP-${relatedTxId}`)
      }
    }

    if (sourceType === 'cash') await recalculateAbsoluteCashBalance(sourceId)
    if (sourceType === 'bank') await recalculateAbsoluteBankBalance(sourceId)
    if (sourceType === 'card') await recalculateAbsoluteCardDebt(sourceId)
  }

  function cancelEditTx() {
    setEditingTxId(null); setTxDesc(''); setTxAmount(''); setTxDate(getLocalTodayISO()); setTxType('debt'); setPaymentSource(''); setTxCurrency('TRY'); setTxExchangeRate('1'); setTxCompanyId('common')
  }

  function handleEditTx(t: SupplierTransaction) {
    if (t.description?.startsWith('Mağaza Hizmet Alımı (POS-')) {
      toast.error('Bu hareket Mağaza modülünden otomatik yansımıştır. Değişiklik yapmak için lütfen Mağaza sayfasından ilgili günü güncelleyin.');
      return;
    }
    if (t.invoice_lines?.is_wallet_credit || (t.description && /Kredi Alımı\s*\(\d+\s*adet\)/i.test(t.description))) {
      toast.error('Bu hareket Abonelik Cüzdanı kredi alımıdır. Doğrudan düzenlenemez; miktarı değiştirmek için hareketi silebilir veya Abonelik sayfasından yeni kredi yükleyebilirsiniz.');
      return;
    }
    setEditingTxId(t.id)
    if (t.is_detailed) {
      setInvDate(t.tx_date); setInvDesc(t.description); setInvLines(t.invoice_lines || []); setInvCurrency(t.currency as any || 'TRY'); setInvExchangeRate(t.exchange_rate?.toString() || '1'); setInvCompanyId(t.company_id || 'common'); setIsInvoiceModalOpen(true)
    } else {
      setTxDate(t.tx_date); setTxType(t.tx_type); setTxDesc(t.description); setTxAmount(t.amount.toString()); setTxCurrency(t.currency as any || 'TRY'); setTxExchangeRate(t.exchange_rate?.toString() || '1'); setTxCompanyId(t.company_id || 'common')
      if (t.payment_source_type && t.payment_source_id) setPaymentSource(`${t.payment_source_type}|${t.payment_source_id}`)
      else setPaymentSource('')
    }
  }

  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault()
    const amountNum = parseFloat(txAmount); const rateNum = txCurrency === 'TRY' ? 1 : (parseFloat(txExchangeRate) || 1)
    if (!amountNum || !selectedSupplierId || !txCompanyId) return
    const currentSupplier = suppliers.find(s => s.id === selectedSupplierId); if (!currentSupplier) return
    const finalCompId = txCompanyId === 'common' ? null : txCompanyId

    if (txType === 'payment' && !paymentSource) return toast.error("Lütfen ödeme kaynağı seçin.")

    try {
      let pType = null; let pId = null
      if (txType === 'payment' && paymentSource) { const parts = paymentSource.split('|'); pType = parts[0]; pId = parts[1] }

      if (editingTxId) {
        const oldTx = transactions.find(t => t.id === editingTxId); if (!oldTx) return
        const oldRate = oldTx.exchange_rate || 1
        
        if (oldTx.tx_type === 'payment' && oldTx.payment_source_type && oldTx.payment_source_id) {
          await modifyPaymentSourceBalance(oldTx.payment_source_type, oldTx.payment_source_id, oldTx.amount, oldTx.currency || 'TRY', oldRate, 'reverse', oldTx.id, oldTx.tx_date, currentSupplier.company_name, oldTx.description, oldTx.company_id ?? null)
        }

        const payload = {
          company_id: finalCompId, tx_date: txDate, description: txDesc, tx_type: txType, amount: amountNum, currency: txCurrency, exchange_rate: rateNum, payment_source_type: pType, payment_source_id: pId
        }
        
        const { error: txErr } = await supabase.from('supplier_transactions').update(payload).eq('id', editingTxId)
        if (txErr) throw txErr

        if (txType === 'payment' && pType && pId) {
          await modifyPaymentSourceBalance(pType, pId, amountNum, txCurrency, rateNum, 'payment', editingTxId, txDate, currentSupplier.company_name, txDesc, finalCompId)
        }
        
        await logActivity('supplier_tx', 'UPDATE', `Cari Hareket Güncellendi: ${txDesc}`, editingTxId, amountNum, txCurrency, oldTx, payload, finalCompId)
        toast.success('Cari hareket güncellendi.')

      } else {
        const payload = {
          supplier_id: selectedSupplierId, company_id: finalCompId, tx_date: txDate, description: txDesc, tx_type: txType, amount: amountNum, is_detailed: false, currency: txCurrency, exchange_rate: rateNum, payment_source_type: pType, payment_source_id: pId
        }
        
        const { data: newTxData, error: txErr } = await supabase.from('supplier_transactions').insert([payload]).select().single()
        if (txErr) throw txErr

        const newTxId = newTxData?.id
        if (txType === 'payment' && pType && pId && newTxId) {
          await modifyPaymentSourceBalance(pType, pId, amountNum, txCurrency, rateNum, 'payment', newTxId, txDate, currentSupplier.company_name, txDesc, finalCompId)
        }
        
        await logActivity('supplier_tx', 'INSERT', `Cari Hareket: ${txDesc} (${txType === 'debt' ? 'Borç / Fatura' : 'Ödeme'})`, newTxId, amountNum, txCurrency, null, newTxData, finalCompId)
        toast.success(txType === 'debt' ? 'Borç / Fatura eklendi.' : 'Ödeme başarıyla işlendi.')
      }

      await recalculateAbsoluteSupplierBalance(selectedSupplierId)
      cancelEditTx(); fetchTransactions(selectedSupplierId); fetchSuppliers(); fetchPaymentSources() 
    } catch (err: any) { toast.error('İşlem kaydedilemedi: ' + err.message) }
  }

  function handleDeleteTransaction(txId: string) {
    const txToDelete = transactions.find(t => t.id === txId)
    if (txToDelete?.description?.startsWith('Mağaza Hizmet Alımı (POS-')) {
      toast.error('Bu hareket Mağaza modülünden otomatik yansımıştır. Değişiklik yapmak için lütfen Mağaza sayfasından ilgili günü güncelleyin.');
      return;
    }

    const isWalletCredit = !!(
      txToDelete?.invoice_lines?.is_wallet_credit || 
      (txToDelete?.description && /Kredi Alımı\s*\(\d+\s*adet\)/i.test(txToDelete.description))
    )

    let dialogMessage = 'Bu cari hareketi silmek istediğinize emin misiniz? Bakiyeler ve varsa ilgili stok işlemleri geri alınacaktır.'
    if (isWalletCredit) {
      dialogMessage = 'Bu hareket Abonelik Cüzdanı kredi alımıdır. Silindiğinde ilgili cüzdandaki krediler de otomatik olarak düşülecektir. Onaylıyor musunuz?'
    }

    setConfirmDialog({
      isOpen: true,
      title: isWalletCredit ? 'Kredi Alım Hareketini Sil' : 'Hareketi Sil',
      message: dialogMessage,
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        try {
          const oldTx = transactions.find(t => t.id === txId); if (!oldTx) return
          const currentSupplier = suppliers.find(s => s.id === selectedSupplierId)
          let oldDataPayload: any = { deleted_tx: oldTx, related_stock_txs: [] }

          const affectedStocks = new Set<string>();

          if (oldTx.is_detailed && oldTx.invoice_lines) {
            for (const line of oldTx.invoice_lines) {
              if (line.addToStock && line.stockTxId && line.targetStockId) {
                await supabase.from('stock_transactions').delete().eq('id', line.stockTxId);
                affectedStocks.add(line.targetStockId);
                oldDataPayload.related_stock_txs.push({ stockId: line.targetStockId, qty_restored: parseFloat(line.quantity) })
              }
            }
          }

          // Cüzdan Kredi Alımı Senkronizasyonu
          if (isWalletCredit) {
            let targetWalletId = oldTx.invoice_lines?.wallet_id
            let qtyToRemove = parseInt(oldTx.invoice_lines?.qty || '0')

            if (!qtyToRemove && oldTx.description) {
              const match = oldTx.description.match(/Kredi Alımı\s*\((\d+)\s*adet\)/i)
              if (match) qtyToRemove = parseInt(match[1])
            }

            let targetWallet: any = null
            if (targetWalletId) {
              const { data } = await supabase.from('credit_wallets').select('*').eq('id', targetWalletId).maybeSingle()
              targetWallet = data
            }

            if (!targetWallet && oldTx.description) {
              const nameMatch = oldTx.description.match(/^(.*?)\s+Kredi Alımı/i)
              const walletName = nameMatch ? nameMatch[1].trim() : ''
              if (walletName) {
                const { data } = await supabase.from('credit_wallets').select('*').ilike('name', walletName).maybeSingle()
                targetWallet = data
              }
            }

            if (!targetWallet && oldTx.supplier_id) {
              const { data } = await supabase.from('credit_wallets').select('*').eq('supplier_id', oldTx.supplier_id).maybeSingle()
              targetWallet = data
            }

            if (targetWallet) {
              if (targetWallet.balance < qtyToRemove) {
                toast.error(`Bu alımdan yüklenen kredilerin bir kısmı veya tamamı aboneliklerde kullanılmıştır! (Cüzdan Bakiyesi: ${targetWallet.balance}, Silinmek İstenen: ${qtyToRemove}). Lütfen önce ilgili abonelikleri iptal edin.`)
                return
              }

              let newLots = [...(targetWallet.fifo_lots || [])]
              const lotIndexByTx = newLots.findIndex((l: any) => l.supp_tx_id === txId || l.id === txId)
              if (lotIndexByTx >= 0) {
                newLots.splice(lotIndexByTx, 1)
              } else {
                const lotIndexByQty = newLots.findIndex((l: any) => !l.is_opening && Number(l.qty) === qtyToRemove)
                if (lotIndexByQty >= 0) {
                  newLots.splice(lotIndexByQty, 1)
                } else {
                  let remainingToDeduct = qtyToRemove
                  for (let i = newLots.length - 1; i >= 0 && remainingToDeduct > 0; i--) {
                    if (newLots[i].is_opening) continue
                    if (newLots[i].qty <= remainingToDeduct) {
                      remainingToDeduct -= newLots[i].qty
                      newLots.splice(i, 1)
                    } else {
                      newLots[i].qty -= remainingToDeduct
                      remainingToDeduct = 0
                    }
                  }
                }
              }

              const recalculatedBalance = newLots.reduce((acc: number, l: any) => acc + (Number(l.qty) || 0), 0)
              let newUnitCost = 0
              if (newLots.length > 0) {
                let pTry = newLots[0].price * (newLots[0].exRate || 1)
                if (targetWallet.currency === 'TRY') newUnitCost = pTry
                else if (targetWallet.currency === 'USD') newUnitCost = pTry / (rates.USD || 1)
                else if (targetWallet.currency === 'EUR') newUnitCost = pTry / (rates.EUR || 1)
              }

              await supabase.from('credit_wallets').update({
                balance: recalculatedBalance,
                unit_cost: newUnitCost,
                fifo_lots: newLots
              }).eq('id', targetWallet.id)

              oldDataPayload.related_wallet = {
                wallet_id: targetWallet.id,
                wallet_name: targetWallet.name,
                deducted_credits: qtyToRemove,
                new_balance: recalculatedBalance
              }
            }
          }

          const oldRate = oldTx.exchange_rate || 1

          if (oldTx.tx_type === 'payment' && oldTx.payment_source_type && oldTx.payment_source_id) {
            await modifyPaymentSourceBalance(oldTx.payment_source_type, oldTx.payment_source_id, oldTx.amount, oldTx.currency || 'TRY', oldRate, 'reverse', oldTx.id, oldTx.tx_date, currentSupplier?.company_name || '', oldTx.description, oldTx.company_id ?? null)
          }

          await supabase.from('supplier_transactions').delete().eq('id', txId)
          
          for (const sId of Array.from(affectedStocks)) { await recalculateAbsoluteStock(sId) }
          if (selectedSupplierId) await recalculateAbsoluteSupplierBalance(selectedSupplierId)
          
          await logActivity(
            oldTx.is_detailed ? 'supplier_invoice' : 'supplier_tx', 
            'DELETE', 
            oldTx.is_detailed ? `Alım Faturası İptali: ${oldTx.description}` : `Cari Hareket İptali: ${oldTx.description}`, 
            txId, 
            oldTx.amount, 
            oldTx.currency || 'TRY', 
            { ...oldDataPayload }, 
            null, 
            oldTx.company_id
          )

          toast.success(isWalletCredit ? 'Kredi alım hareketi silindi ve cüzdan bakiyesi güncellendi.' : 'Hareket silindi ve bakiyeler güncellendi.')
          fetchTransactions(selectedSupplierId!); fetchSuppliers(); fetchPaymentSources(); fetchStocks()
        } catch (err: any) { toast.error("Silme işleminde hata oluştu: " + err.message) }
      }
    })
  }

  function openInvoiceModal() { setEditingTxId(null); setInvDate(getLocalTodayISO()); setInvDesc(''); setInvCurrency('TRY'); setInvExchangeRate('1'); setInvCompanyId('common'); setInvLines([{ id: Date.now().toString(), name: '', quantity: '1', unitPrice: '', vatRate: '20', addToStock: false, warehouseId: warehouses[0]?.id || '', selectedStockId: undefined }]); setActiveStockDropdown(null); setIsInvoiceModalOpen(true) }
  function closeInvoiceModal() { setIsInvoiceModalOpen(false); setActiveStockDropdown(null); if (editingTxId && transactions.find(t => t.id === editingTxId)?.is_detailed) cancelEditTx() }
  function addInvoiceLine() { setInvLines([...invLines, { id: Date.now().toString(), name: '', quantity: '1', unitPrice: '', vatRate: '20', addToStock: false, warehouseId: warehouses[0]?.id || '', selectedStockId: undefined }]) }
  function removeInvoiceLine(id: string) { setInvLines(invLines.filter(l => l.id !== id)) }
  function updateInvoiceLine(id: string, field: keyof InvoiceLine, value: any) { setInvLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l)) }

  function selectStockForLine(lineId: string, stock: StockItem) {
    const convertedPrice = convertCurrency(stock.unit_price, stock.currency, invCurrency)
    setInvLines(prev => prev.map(l => {
      if (l.id === lineId) { return { ...l, name: stock.name, unitPrice: convertedPrice.toFixed(2), vatRate: stock.vat_rate?.toString() || '0', warehouseId: stock.warehouse_id, addToStock: true, selectedStockId: stock.id } }
      return l
    }))
    setActiveStockDropdown(null) 
  }

  const calculateInvoiceTotal = () => { return invLines.reduce((acc, line) => { const q = parseFloat(line.quantity) || 0; const p = parseFloat(line.unitPrice) || 0; const v = parseFloat(line.vatRate) || 0; return acc + (q * p * (1 + v / 100)) }, 0) }

  async function handleSaveDetailedInvoice(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSupplierId || invLines.length === 0 || !invCompanyId) return
    const currentSupplier = suppliers.find(s => s.id === selectedSupplierId); if (!currentSupplier) return
    const finalCompId = invCompanyId === 'common' ? null : invCompanyId

    const totalGross = calculateInvoiceTotal(); if (totalGross <= 0) return toast.error('Fatura toplamı 0 olamaz.')
    const rateNum = invCurrency === 'TRY' ? 1 : (parseFloat(invExchangeRate) || 1)

    try {
      const affectedStocks = new Set<string>();

      if (editingTxId) {
        const oldTx = transactions.find(t => t.id === editingTxId); if (!oldTx) return
        
        if (oldTx.is_detailed && oldTx.invoice_lines) {
          for (const line of oldTx.invoice_lines) {
            if (line.addToStock && line.stockTxId && line.targetStockId) {
              await supabase.from('stock_transactions').delete().eq('id', line.stockTxId)
              affectedStocks.add(line.targetStockId)
            }
          }
        }
      }

      const processedLines = [...invLines]
      for (let i = 0; i < processedLines.length; i++) {
        const line = processedLines[i]
        if (line.addToStock && line.name) {
          const q = parseFloat(line.quantity) || 0; const p = parseFloat(line.unitPrice) || 0; const v = parseFloat(line.vatRate) || 0
          
          let targetStockId = line.selectedStockId || null

          if (targetStockId) {
             affectedStocks.add(targetStockId)
          } else if (line.warehouseId) {
            const { data: existingStock } = await supabase.from('stocks').select('*').eq('warehouse_id', line.warehouseId).ilike('name', line.name).limit(1)

            if (existingStock && existingStock.length > 0) {
              targetStockId = existingStock[0].id
              if (targetStockId) affectedStocks.add(targetStockId)
            } else {
              const { data: newStock } = await supabase.from('stocks').insert([{ warehouse_id: line.warehouseId, name: line.name, currency: invCurrency, quantity: 0, unit_price: p, vat_rate: v, unit: 'Adet', stock_color: 'from-[#1b253b] to-[#121a2a]' }]).select()
              if (newStock && newStock.length > 0) {
                 targetStockId = newStock[0].id
                 if (targetStockId) affectedStocks.add(targetStockId)
              }
            }
          }

          if (targetStockId) {
            const { data: stTx } = await supabase.from('stock_transactions').insert([{ stock_id: targetStockId, company_id: finalCompId, tx_date: invDate, description: `${invDesc || 'Fatura'} / Alım`, tx_type: 'in', quantity: q, unit_price: p, currency: invCurrency, vat_rate: v }]).select()
            processedLines[i].targetStockId = targetStockId
            if (stTx && stTx.length > 0) processedLines[i].stockTxId = stTx[0].id
          }
        }
      }

      let finalTxId = editingTxId
      if (editingTxId) {
        const payload = { company_id: finalCompId, tx_date: invDate, description: invDesc || 'Detaylı Alım Faturası', amount: totalGross, currency: invCurrency, exchange_rate: rateNum, invoice_lines: processedLines }
        const { error: updErr } = await supabase.from('supplier_transactions').update(payload).eq('id', editingTxId)
        if (updErr) throw updErr
        
        await logActivity('supplier_invoice', 'UPDATE', `Detaylı Alım Faturası Güncellendi: ${invDesc}`, editingTxId, totalGross, invCurrency, transactions.find(t => t.id === editingTxId), payload, finalCompId)
      } else {
        const payload = { supplier_id: selectedSupplierId, company_id: finalCompId, tx_date: invDate, description: invDesc || 'Detaylı Alım Faturası', tx_type: 'debt', amount: totalGross, currency: invCurrency, exchange_rate: rateNum, is_detailed: true, invoice_lines: processedLines }
        const { data: insData, error: insErr } = await supabase.from('supplier_transactions').insert([payload]).select().single()
        if (insErr) throw insErr
        finalTxId = insData.id
        
        await logActivity('supplier_invoice', 'INSERT', `Yeni Alım Faturası: ${invDesc}`, finalTxId, totalGross, invCurrency, null, insData, finalCompId)
      }

      for (const sId of Array.from(affectedStocks)) { await recalculateAbsoluteStock(sId) }
      await recalculateAbsoluteSupplierBalance(selectedSupplierId)

      toast.success(editingTxId ? 'Detaylı fatura başarıyla güncellendi.' : 'Detaylı fatura kaydedildi ve stoklar güncellendi.')
      closeInvoiceModal(); fetchTransactions(selectedSupplierId); fetchSuppliers(); fetchStocks()
    } catch (err: any) { toast.error("Fatura kaydedilirken bir hata oluştu: " + err.message) }
  }

  const getPaymentSourceName = (type: string, id: string) => {
    if (type === 'cash') return cashes.find(c => c.id === id)?.name || 'Kasa'
    if (type === 'bank') return banks.find(b => b.id === id)?.bank_name || 'Banka'
    if (type === 'card') return cards.find(c => c.id === id)?.name || 'Kredi Kartı'
    return ''
  }

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      // 1. Yetki kontrolü (Multi-tenant company isolation)
      const suppCompId = s.company_id || (s.tax_number && s.tax_number.includes('-') ? s.tax_number : null)
      if (isRestricted && suppCompId && !hasCompanyAccess(suppCompId)) {
        return false
      }

      // 2. Seçili şirket filtresi
      if (selectedCompanyFilter !== 'all') {
        if (selectedCompanyFilter === 'common') {
          if (suppCompId) return false
        } else {
          if (suppCompId !== selectedCompanyFilter) return false
        }
      }

      // 3. Arama kelimesi
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const nameMatch = s.company_name?.toLowerCase().includes(term)
        const contactMatch = s.contact_name && s.contact_name.toLowerCase().includes(term)
        return nameMatch || contactMatch
      }

      return true
    })
  }, [suppliers, isRestricted, hasCompanyAccess, selectedCompanyFilter, searchTerm])

  useEffect(() => {
    if (filteredSuppliers.length > 0) {
      if (!selectedSupplierId || !filteredSuppliers.some(s => s.id === selectedSupplierId)) {
        setSelectedSupplierId(filteredSuppliers[0].id)
      }
    } else {
      setSelectedSupplierId(null)
    }
  }, [filteredSuppliers, selectedSupplierId])

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId)
  const isEditingDetailedTx = editingTxId && transactions.find(t => t.id === editingTxId)?.is_detailed

  const suppCurr = selectedSupplier?.currency || 'TRY'
  let currentRunningBalance = selectedSupplier ? selectedSupplier.balance : 0
  const displayTransactions = transactions.map((t) => {
    const rowBalance = currentRunningBalance
    let valInSuppCurr = Number(t.amount || 0)
    const txCurr = t.currency || 'TRY'
    const rate = Number(t.exchange_rate) || 1

    if (suppCurr === 'USD') {
      if (txCurr === 'TRY') valInSuppCurr = valInSuppCurr / (rate || rates.USD || 1)
      else if (txCurr === 'EUR') valInSuppCurr = (valInSuppCurr * (rate || rates.EUR || 1)) / (rates.USD || 1)
    } else if (suppCurr === 'EUR') {
      if (txCurr === 'TRY') valInSuppCurr = valInSuppCurr / (rate || rates.EUR || 1)
      else if (txCurr === 'USD') valInSuppCurr = (valInSuppCurr * (rate || rates.USD || 1)) / (rates.EUR || 1)
    } else {
      if (txCurr !== 'TRY') valInSuppCurr = valInSuppCurr * rate
    }

    if (t.tx_type === 'debt') currentRunningBalance -= valInSuppCurr
    else currentRunningBalance += valInSuppCurr
    return { ...t, running_balance: rowBalance }
  })

  const totalDebtTry = filteredSuppliers.reduce((acc, s) => {
    const rate = s.currency === 'USD' ? rates.USD : s.currency === 'EUR' ? rates.EUR : 1
    return acc + (s.balance * rate)
  }, 0)
  const totalDebtUsd = totalDebtTry / (rates.USD || 1)
  const totalDebtEur = totalDebtTry / (rates.EUR || 1)

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] relative">
      {/* TOASTER KONTEYNER Z-INDEX DEĞERİ MAX VE POZİSYONU BOTTOM-RIGHT YAPILDI */}
      <Toaster position="bottom-right" containerStyle={{ zIndex: 99999999 }} toastOptions={{ style: { background: '#0f172a', color: '#fff', border: '1px solid #1e293b', fontSize: '12px' } }} />
      
      <div style={{ animation: 'fadeInDown 0.4s both' }} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0d1322] border border-slate-800/80 p-4 rounded-xl shadow-md shrink-0 mb-4 transition-colors">
        <div className="flex items-center gap-3 text-white">
          <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg"><Building2 size={24} /></div>
          <div><h2 className="font-bold text-lg leading-none">Satıcılar / Tedarikçiler</h2><p className="text-[10px] text-slate-400 mt-1">Mal alımı yaptığınız firmalar ve cari bakiye</p></div>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-slate-400 font-sans tracking-wide">TOPLAM TEDARİKÇİ BORCU (₺)</span>
            <div className="flex gap-3 mt-0.5 font-bold">
              {totalDebtTry > 0 && <span className="text-amber-400">{formatMoney(totalDebtTry, 'TRY').formatted}</span>}
              {totalDebtTry > 0 && <span className="text-emerald-400 font-normal">~ {formatMoney(totalDebtUsd, 'USD').formatted}</span>}
              {totalDebtTry > 0 && <span className="text-blue-400 font-normal">~ {formatMoney(totalDebtEur, 'EUR').formatted}</span>}
              {totalDebtTry <= 0 && <span className="text-slate-500">0,00₺</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        <div style={{ animation: 'fadeInUp 0.4s both 0.1s' }} className="w-full lg:w-[420px] bg-[#0d1322] border border-slate-800/80 rounded-xl flex flex-col shrink-0 shadow-lg">
          <div className="p-3 border-b border-slate-800/80 bg-[#0a0f1d] rounded-t-xl flex flex-col gap-2.5 shrink-0">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-300">Tedarikçi Listesi ({filteredSuppliers.length})</span>
              <button onClick={openAddModal} className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 shadow-md shadow-amber-900/20">
                <Plus size={14} /> Yeni Tedarikçi
              </button>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Firma veya kişi ara..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="w-full bg-[#070b14] border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-amber-500/50 transition-colors" 
                />
              </div>
              <select 
                value={selectedCompanyFilter} 
                onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                className="bg-[#070b14] border border-slate-700 rounded-lg px-2 py-1.5 text-[10px] text-slate-300 focus:outline-none focus:border-amber-500/50 transition-colors max-w-[130px] shrink-0"
              >
                <option value="all">Tüm Merkezler</option>
                <option value="common">🌍 Ortak / Bağımsız</option>
                {companies
                  .filter(c => !isRestricted || hasCompanyAccess(c.id))
                  .map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
            </div>
          </div>
          <div className="overflow-y-auto flex-1 custom-scrollbar p-2 space-y-1.5">
            {filteredSuppliers.length === 0 ? (
               <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-700/60 rounded-xl bg-slate-800/10 text-slate-500 shadow-inner mt-4 mx-2">
                 <Building2 size={32} className="mb-3 opacity-70 text-amber-400 animate-bounce" />
                 <p className="text-[11px] font-bold text-slate-400">Kayıtlı tedarikçi bulunamadı</p>
                 <p className="text-[9px] mt-1 text-slate-500">Sağ üstten yeni bir tedarikçi ekleyebilirsiniz.</p>
               </div>
            ) : filteredSuppliers.map((item, index) => (
                <div 
                  key={item.id} 
                  onClick={() => setSelectedSupplierId(item.id)} 
                  style={{ animation: 'fadeInUp 0.3s both', animationDelay: `${0.15 + (index * 0.05)}s` }}
                  className={`flex items-center justify-between py-2.5 px-3 rounded-lg cursor-pointer transition-all border hover:-translate-y-0.5 ${item.id === selectedSupplierId ? 'bg-amber-900/10 border-amber-500/30 shadow-inner' : 'bg-[#070b14] border-slate-800/50 hover:border-slate-700'}`}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-[11px] font-bold text-slate-200 truncate">{item.company_name}</h4>
                      {item.currency && item.currency !== 'TRY' && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                          {item.currency === 'USD' ? '$ USD' : '€ EUR'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-[9px] text-slate-500 truncate">{item.contact_name || '-'}</p>
                      <span className="text-slate-700 text-[9px]">•</span>
                      {item.company ? (
                        <span className="text-[9px] text-indigo-400/90 flex items-center gap-1 truncate font-medium">
                          {item.company.is_personal ? <Home size={10} className="shrink-0 text-slate-400" /> : <Building size={10} className="shrink-0 text-indigo-400" />}
                          <span className="truncate">{item.company.name}</span>
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-500 flex items-center gap-1 truncate font-medium">
                          <Globe size={10} className="shrink-0 text-slate-400" />
                          <span>Ortak</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-[11px] font-mono font-bold ${item.balance > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                      {formatMoney(item.balance, (item.currency as any) || 'TRY').formatted}
                    </div>
                    {item.currency && item.currency !== 'TRY' && item.balance !== 0 && (
                      <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                        ≈ {formatMoney(item.balance * (item.currency === 'USD' ? rates.USD : rates.EUR), 'TRY').formatted}
                      </div>
                    )}
                    <div className="text-[8px] text-slate-500 uppercase tracking-wider mt-0.5">{item.balance > 0 ? 'BORCUMUZ' : 'BAKİYE YOK'}</div>
                  </div>
                </div>
            ))}
          </div>
        </div>

        <div style={{ animation: 'fadeInUp 0.4s both 0.2s' }} className="flex-1 bg-[#0d1322] border border-slate-800/80 rounded-xl flex flex-col min-w-0 shadow-lg relative overflow-hidden">
          {selectedSupplier ? (
            <>
              <div className="p-4 border-b border-slate-800/80 bg-gradient-to-r from-[#0a0f1d] to-[#0d1322] rounded-t-xl shrink-0 flex flex-col md:flex-row justify-between gap-4 relative z-10">
                <div className="flex-1 w-full">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">{selectedSupplier.company_name}</h2>
                      {selectedSupplier.company ? (
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                          {selectedSupplier.company.is_personal ? <Home size={11} className="text-slate-400" /> : <Building size={11} />}
                          {selectedSupplier.company.name}
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-full flex items-center gap-1 font-medium">
                          <Globe size={11} className="text-emerald-400" />
                          Ortak / Bağımsız
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded border border-slate-800"><button onClick={(e) => openEditModal(selectedSupplier, e)} className="text-slate-400 hover:text-amber-400 p-1 transition"><Edit3 size={14} /></button><button onClick={(e) => handleDeleteSupplier(selectedSupplier.id, e)} className="text-slate-400 hover:text-rose-400 p-1 transition"><Trash2 size={14} /></button></div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] text-slate-400 bg-[#070b14] p-3 rounded-lg border border-slate-800/50">
                    <div><span className="flex items-center gap-1 text-slate-500 mb-0.5"><Phone size={10} /> Telefon</span><span className="text-slate-300">{selectedSupplier.phone || '-'}</span></div>
                    <div><span className="flex items-center gap-1 text-slate-500 mb-0.5"><Mail size={10} /> E-Posta</span><span className="text-slate-300 truncate block">{selectedSupplier.email || '-'}</span></div>
                    <div><span className="flex items-center gap-1 text-slate-500 mb-0.5"><FileText size={10} /> V. Dairesi/No</span><span className="text-slate-300">{selectedSupplier.tax_office || '-'} {selectedSupplier.tax_id ? `/ ${selectedSupplier.tax_id}` : ''}</span></div>
                    <div><span className="flex items-center gap-1 text-slate-500 mb-0.5"><MapPin size={10} /> Adres</span><span className="text-slate-300 truncate block">{selectedSupplier.address || '-'}</span></div>
                  </div>
                </div>
                <div className="flex flex-col justify-center items-end bg-[#070b14] px-5 py-3 rounded-lg border border-slate-800/50 min-w-[180px] w-full md:w-auto">
                  <span className="text-[10px] font-bold text-slate-500 mb-1 tracking-widest">
                    GÜNCEL BAKİYE {selectedSupplier.currency !== 'TRY' ? `(${selectedSupplier.currency})` : '(₺)'}
                  </span>
                  <span className={`text-2xl font-black font-mono ${selectedSupplier.balance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {formatMoney(selectedSupplier.balance, (selectedSupplier.currency as any) || 'TRY').formatted}
                  </span>
                  {selectedSupplier.currency && selectedSupplier.currency !== 'TRY' && (
                    <div className="flex items-center gap-1 mt-1 text-[11px] font-mono text-indigo-300 bg-indigo-950/40 border border-indigo-500/30 px-2 py-0.5 rounded">
                      <span className="text-slate-400">Canlı ₺:</span>
                      <span className="font-bold text-amber-300">
                        {formatMoney(selectedSupplier.balance * (selectedSupplier.currency === 'USD' ? rates.USD : rates.EUR), 'TRY').formatted}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 overflow-y-auto custom-scrollbar flex-1 flex flex-col relative z-0">
                {!isEditingDetailedTx && (
                  <form style={{ animation: 'fadeInUp 0.4s both 0.3s' }} onSubmit={handleAddTransaction} className="flex flex-wrap items-end gap-2.5 mb-5 bg-[#070b14] p-3 rounded-lg border border-slate-800 shrink-0 transition-colors hover:border-slate-700">
                    <div className="w-28"><label className="block text-[9px] text-slate-400 mb-0.5">Tarih</label><input type="date" required value={txDate} onChange={(e) => setTxDate(e.target.value)} className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors" /></div>
                    
                    <div className="w-36">
                       <label className="block text-[9px] text-slate-400 mb-0.5">İlgili Merkez *</label>
                       <select value={txCompanyId} onChange={(e) => setTxCompanyId(e.target.value)} required className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors">
                         {!isRestricted && <option value="common">🌍 Ortak / Bağımsız İşlem</option>}
                         <optgroup label="Ticari Şirketler">{companies.filter(c => !c.is_personal && (!isRestricted || hasCompanyAccess(c.id))).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                         <optgroup label="Şahsi Merkezler">{companies.filter(c => c.is_personal && (!isRestricted || hasCompanyAccess(c.id))).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                       </select>
                    </div>

                    <div className="w-36"><label className="block text-[9px] text-slate-400 mb-0.5">İşlem Yönü</label><select value={txType} onChange={(e) => setTxType(e.target.value as any)} className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors"><option value="debt">Borç / Fatura Geldi (+)</option><option value="payment">Ödeme Yapıldı (-)</option></select></div>
                    {txType === 'payment' && (
                      <div className="w-40"><label className="block text-[9px] text-slate-400 mb-0.5">Ödeme Kaynağı *</label><select value={paymentSource} onChange={(e) => setPaymentSource(e.target.value)} required className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors"><option value="">Seçiniz</option>{cashes.length > 0 && <optgroup label="Kasalar">{cashes.map(c => <option key={`cash|${c.id}`} value={`cash|${c.id}`}>{c.name}</option>)}</optgroup>}{banks.length > 0 && <optgroup label="Bankalar">{banks.map(b => <option key={`bank|${b.id}`} value={`bank|${b.id}`}>{b.bank_name}</option>)}</optgroup>}{cards.length > 0 && <optgroup label="Kredi Kartları">{cards.map(c => <option key={`card|${c.id}`} value={`card|${c.id}`}>{c.name}</option>)}</optgroup>}</select></div>
                    )}
                    <div className="flex-1 min-w-[120px]"><label className="block text-[9px] text-slate-400 mb-0.5">Açıklama</label><input type="text" required placeholder="Fatura / Tahsilat Açıklaması" value={txDesc} onChange={(e) => setTxDesc(e.target.value)} className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors" /></div>
                    <div className="w-20"><label className="block text-[9px] text-slate-400 mb-0.5">Döviz</label><select value={txCurrency} onChange={(e) => setTxCurrency(e.target.value as any)} className="w-full bg-[#0d1322] border border-slate-700 rounded px-1.5 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors"><option value="TRY">₺</option><option value="USD">$</option><option value="EUR">€</option></select></div>
                    {txCurrency !== 'TRY' && (
                      <div className="w-20"><label className="block text-[9px] text-slate-400 mb-0.5">M. Kur</label><input type="number" step="0.0001" required value={txExchangeRate} onChange={(e) => setTxExchangeRate(e.target.value)} className="w-full bg-indigo-900/20 text-indigo-300 border border-indigo-500/30 rounded px-2 py-1.5 text-[11px] focus:outline-none font-mono transition-colors" title="Mutabakat Kuru (Değiştirebilirsiniz)" /></div>
                    )}
                    <div className="w-24"><label className="block text-[9px] text-slate-400 mb-0.5">Tutar</label><input type="number" step="0.01" required placeholder="0.00" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none font-mono transition-colors" /></div>
                    <div className="flex items-center gap-1">
                      {editingTxId && <button type="button" onClick={cancelEditTx} className="bg-slate-700 hover:bg-slate-600 text-white px-2 py-1.5 rounded text-[11px] font-bold transition h-[26px]">X</button>}
                      <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded text-[11px] font-bold transition-all active:scale-95 h-[26px]">{editingTxId ? 'Güncelle' : 'Ekle'}</button>
                    </div>
                    {!editingTxId && (<><div className="w-px h-6 bg-slate-700 mx-1"></div><button type="button" onClick={openInvoiceModal} className="bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/50 text-indigo-300 hover:text-white px-3 py-1.5 rounded text-[11px] font-bold transition-all active:scale-95 h-[26px] flex items-center gap-1.5"><ListPlus size={14} /> Detaylı Fatura Gir</button></>)}
                  </form>
                )}

                <div className="border border-slate-800/80 rounded-lg overflow-hidden flex-1 flex flex-col">
                  <table className="w-full text-left text-[11px]">
                    <thead className="sticky top-0 bg-[#0a0f1d] z-10">
                      <tr className="border-b border-slate-800/80 text-slate-400"><th className="p-2.5 font-medium">Tarih</th><th className="p-2.5 font-medium">Açıklama & Merkez</th><th className="p-2.5 font-medium text-right text-rose-400">Borçlanma (+)</th><th className="p-2.5 font-medium text-right text-emerald-400">Ödenen (-)</th><th className="p-2.5 font-medium text-right text-slate-300 bg-slate-800/20">Bakiye {suppCurr !== 'TRY' ? `(${suppCurr === 'USD' ? '$' : '€'})` : '(₺)'}</th><th className="p-2.5 font-medium text-center w-12">İşlem</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {displayTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center">
                            <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-700/60 rounded-xl bg-slate-800/10 text-slate-500 shadow-inner my-2 mx-2">
                               <RefreshCw size={32} className="mb-3 opacity-70 text-amber-400 animate-bounce" />
                               <p className="text-[11px] font-bold text-slate-400">Bu tedarikçiye ait henüz hareket bulunmuyor.</p>
                            </div>
                          </td>
                        </tr>
                      ) : displayTransactions.map((t, index) => {
                          const rateStr = t.exchange_rate && t.exchange_rate !== 1 ? `Kur: ${t.exchange_rate} ➔ ` : ''
                          const tryEquivalent = t.amount * (t.exchange_rate || 1)
                          const isPersonal = t.company?.is_personal
                          return (
                          <tr 
                            key={t.id} 
                            style={{ animation: 'fadeSlideRight 0.4s both', animationDelay: `${0.35 + (index * 0.05)}s` }}
                            className="hover:bg-slate-800/30 font-mono transition-colors"
                          >
                            <td className="p-2.5 text-slate-400 align-top">{formatDateTR(t.tx_date)}</td>
                            <td className="p-2.5 text-slate-200 font-sans align-top">
                              <div className="flex items-center gap-2 mb-1">
                                {t.is_detailed && <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/30 flex items-center gap-1"><ScrollText size={10}/> Detaylı</span>}
                                {t.description?.startsWith('Mağaza Hizmet Alımı (POS-') && <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-1"><Store size={10}/> Mağaza</span>}
                                {t.description}
                              </div>
                              {t.tx_type === 'payment' && t.payment_source_type && t.payment_source_id && (<div className="text-[9px] text-emerald-500/70 mt-0.5 mb-1 flex items-center gap-1">{t.payment_source_type === 'cash' ? <Wallet size={10}/> : t.payment_source_type === 'bank' ? <Landmark size={10}/> : <CreditCard size={10}/>} Kaynak: {getPaymentSourceName(t.payment_source_type, t.payment_source_id)}</div>)}
                              <div className="flex items-center gap-1 text-[9px] text-slate-500">
                                {t.company ? (isPersonal ? <Home size={10} className="text-slate-400"/> : <Building size={10} className="text-indigo-400"/>) : <Globe size={10} className="text-emerald-500/70"/>}
                                {t.company ? t.company.name : 'Ortak İşlem'}
                              </div>
                            </td>
                            <td className="p-2.5 text-right text-rose-400 font-medium align-top leading-tight">
                              {t.tx_type === 'debt' ? (<div className="flex flex-col"><span>{formatMoney(t.amount, (t.currency as any) || 'TRY').formatted}</span>{t.currency !== 'TRY' && <span className="text-[9px] text-rose-400/50 mt-0.5">{rateStr}{formatMoney(tryEquivalent, 'TRY').formatted}</span>}</div>) : '-'}
                            </td>
                            <td className="p-2.5 text-right text-emerald-400 font-medium align-top leading-tight">
                              {t.tx_type === 'payment' ? (<div className="flex flex-col"><span>{formatMoney(t.amount, (t.currency as any) || 'TRY').formatted}</span>{t.currency !== 'TRY' && <span className="text-[9px] text-emerald-400/50 mt-0.5">{rateStr}{formatMoney(tryEquivalent, 'TRY').formatted}</span>}</div>) : '-'}
                            </td>
                            <td className="p-2.5 text-right text-slate-300 font-medium align-top bg-slate-800/10">
                              <div className="flex flex-col">
                                <span>{formatMoney(t.running_balance, (suppCurr as any) || 'TRY').formatted}</span>
                                {suppCurr !== 'TRY' && (
                                  <span className="text-[9px] text-slate-500 mt-0.5">
                                    ≈ {formatMoney(t.running_balance * (suppCurr === 'USD' ? rates.USD : rates.EUR), 'TRY').formatted}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-2.5 text-center align-top"><div className="flex items-center justify-center gap-2"><button onClick={() => handleEditTx(t)} className="text-slate-500 hover:text-amber-400 transition"><Edit3 size={12} /></button><button onClick={() => handleDeleteTransaction(t.id)} className="text-slate-600 hover:text-rose-400 transition"><Trash2 size={12} /></button></div></td>
                          </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 m-4 border border-dashed border-slate-700/60 rounded-xl bg-slate-800/10 text-slate-500 shadow-inner z-0">
              <Building2 size={48} className="mb-4 opacity-70 text-amber-400 animate-bounce" />
              <p className="text-sm font-bold text-slate-400">Lütfen soldan bir firma seçin</p>
            </div>
          )}
        </div>
      </div>

      {/* --- ÖZEL ONAY MODALI --- */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 999999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className={`mx-auto flex items-center justify-center h-14 w-14 rounded-full mb-5 ${confirmDialog.isDanger ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>
              {confirmDialog.isDanger ? <AlertTriangle size={28} /> : <RefreshCw size={28} />}
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{confirmDialog.title}</h3>
            <p className="text-[11px] text-slate-400 mb-6 leading-relaxed px-2">{confirmDialog.message}</p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} className="flex-1 px-4 py-2.5 rounded-xl text-slate-300 bg-slate-800 hover:bg-slate-700 font-medium transition-colors text-xs">
                {confirmDialog.cancelText}
              </button>
              <button onClick={confirmDialog.onConfirm} className={`flex-1 px-4 py-2.5 rounded-xl text-white font-bold transition-all active:scale-95 text-xs shadow-lg ${confirmDialog.isDanger ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-900/20' : 'bg-amber-600 hover:bg-amber-700 shadow-amber-900/20'}`}>
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DETAYLI FATURA MODALI --- */}
      {isInvoiceModalOpen && selectedSupplier && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 9999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl w-full max-w-[1400px] flex flex-col max-h-[90vh] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={() => setActiveStockDropdown(null)}>
            <div className="p-4 border-b border-slate-800 bg-[#0a0f1d] flex justify-between items-center shrink-0">
              <div><h3 className="text-base font-bold text-white flex items-center gap-2"><ListPlus className="text-indigo-400" size={18} />{editingTxId ? 'Faturayı Düzenle' : 'Yeni Alım Faturası'}</h3><p className="text-[10px] text-slate-400 mt-0.5">Tedarikçi: <strong className="text-amber-400">{selectedSupplier.company_name}</strong></p></div><button onClick={closeInvoiceModal} className="text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="p-4 bg-[#0d1322] flex flex-wrap gap-4 shrink-0 border-b border-slate-800 items-end">
              <div className="w-36">
                 <label className="block text-[10px] text-slate-400 mb-1">İlgili Merkez *</label>
                 <select value={invCompanyId} onChange={(e) => setInvCompanyId(e.target.value)} required className="w-full bg-[#070b14] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none transition-colors">
                   {!isRestricted && <option value="common">🌍 Ortak İşlem</option>}
                   <optgroup label="Ticari Şirketler">{companies.filter(c => !c.is_personal && (!isRestricted || hasCompanyAccess(c.id))).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                   <optgroup label="Şahsi Merkezler">{companies.filter(c => c.is_personal && (!isRestricted || hasCompanyAccess(c.id))).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                 </select>
              </div>
              <div className="w-36"><label className="block text-[10px] text-slate-400 mb-1">Fatura Tarihi</label><input type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none transition-colors" /></div>
              <div className="flex-1"><label className="block text-[10px] text-slate-400 mb-1">Fatura / Belge No (Açıklama)</label><input type="text" placeholder="Örn: FAT-2026-0012" value={invDesc} onChange={(e) => setInvDesc(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none transition-colors" /></div>
              <div className="w-24"><label className="block text-[10px] text-slate-400 mb-1">Fatura Dövizi</label><select value={invCurrency} onChange={(e) => setInvCurrency(e.target.value as any)} className="w-full bg-[#070b14] border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none transition-colors"><option value="TRY">₺ TRY</option><option value="USD">$ USD</option><option value="EUR">€ EUR</option></select></div>
              {invCurrency !== 'TRY' && (
                <div className="w-24"><label className="block text-[10px] text-slate-400 mb-1">Mutabakat Kuru</label><input type="number" step="0.0001" value={invExchangeRate} onChange={(e) => setInvExchangeRate(e.target.value)} className="w-full bg-indigo-900/20 text-indigo-300 border border-indigo-500/50 rounded px-2 py-1.5 text-xs focus:outline-none font-mono transition-colors" /></div>
              )}
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1 bg-[#0a0f1d]">
              <div className="space-y-2">
                <div className="flex gap-2 text-[10px] font-bold text-slate-500 uppercase px-1"><div className="flex-1">Ürün / Hizmet Adı</div><div className="w-20 text-right">Miktar</div><div className="w-24 text-right">Net B.Fiyat ({invCurrency})</div><div className="w-16 text-center">KDV(%)</div><div className="w-24 text-right pr-2">KDV'li Toplam</div><div className="w-20 text-center">Stoğa Ekle</div><div className="w-32">Depo Seçimi</div><div className="w-8"></div></div>
                {invLines.map((line) => {
                  const q = parseFloat(line.quantity) || 0; const p = parseFloat(line.unitPrice) || 0; const v = parseFloat(line.vatRate) || 0
                  const filteredStocks = line.name.trim() ? stocks.filter(s => s.name.toLowerCase().includes(line.name.toLowerCase())) : []
                  return (
                    <div key={line.id} className="flex gap-2 items-start bg-[#0d1322] border border-slate-700/50 p-2 rounded-lg group transition-colors hover:border-slate-600">
                      <div className="flex-1 relative">
                        <div className="flex items-center bg-[#070b14] border border-slate-700 rounded overflow-hidden transition-colors focus-within:border-indigo-500/50"><Search size={12} className="text-slate-500 ml-2 shrink-0" /><input type="text" placeholder="Ürün ara veya yeni yaz..." value={line.name} onChange={(e) => { updateInvoiceLine(line.id, 'name', e.target.value); updateInvoiceLine(line.id, 'selectedStockId', undefined); setActiveStockDropdown(line.id) }} onFocus={() => setActiveStockDropdown(line.id)} onClick={(e) => e.stopPropagation()} className="w-full bg-transparent px-2 py-1.5 text-xs text-white focus:outline-none" /></div>
                        {activeStockDropdown === line.id && filteredStocks.length > 0 && (<div className="absolute top-full left-0 right-0 mt-1 bg-[#1b253b] border border-indigo-500/50 rounded-lg shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar animate-in fade-in duration-200">{filteredStocks.map(s => (<div key={s.id} onClick={(e) => { e.stopPropagation(); selectStockForLine(line.id, s) }} className="px-3 py-2 text-xs border-b border-slate-700/50 hover:bg-indigo-600 hover:text-white cursor-pointer transition-colors flex justify-between items-center"><span className="font-medium truncate pr-2">{s.name}</span><span className="text-[10px] bg-slate-900/50 px-1.5 py-0.5 rounded text-emerald-400 border border-slate-700 shrink-0">Stok: {s.quantity}</span></div>))}</div>)}
                      </div>
                      <div className="w-20"><input type="number" step="0.01" placeholder="0" value={line.quantity} onChange={(e) => updateInvoiceLine(line.id, 'quantity', e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-2 py-1.5 text-xs text-white text-right focus:outline-none focus:border-indigo-500/50 transition-colors font-mono" /></div>
                      <div className="w-24"><input type="number" step="0.01" placeholder="0.00" value={line.unitPrice} onChange={(e) => updateInvoiceLine(line.id, 'unitPrice', e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-2 py-1.5 text-xs text-white text-right focus:outline-none focus:border-indigo-500/50 transition-colors font-mono" /></div>
                      <div className="w-16"><select value={line.vatRate} onChange={(e) => updateInvoiceLine(line.id, 'vatRate', e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-1 py-1.5 text-xs text-white text-center focus:outline-none transition-colors"><option value="20">%20</option><option value="10">%10</option><option value="1">%1</option><option value="0">%0</option></select></div>
                      <div className="w-24 text-right pr-2 font-mono text-xs font-bold text-slate-300 flex items-center justify-end">{formatMoney(q * p * (1 + v / 100), invCurrency).formatted}</div>
                      <div className="w-20 flex justify-center"><button type="button" onClick={() => updateInvoiceLine(line.id, 'addToStock', !line.addToStock)} className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold transition-colors ${line.addToStock ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>{line.addToStock ? <CheckSquare size={14}/> : <Square size={14}/>} Stok</button></div>
                      <div className="w-32">{line.addToStock ? <select disabled={!!line.selectedStockId} title={line.selectedStockId ? "Kayıtlı ürün seçildiği için depo değiştirilemez." : ""} value={line.warehouseId} onChange={(e) => updateInvoiceLine(line.id, 'warehouseId', e.target.value)} className="w-full bg-indigo-900/30 border border-indigo-500/50 rounded px-1 py-1.5 text-[11px] text-indigo-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><option value="" disabled>Depo Seç...</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select> : <div className="w-full text-center text-[10px] text-slate-600 py-1.5">-</div>}</div>
                      <div className="w-8 flex justify-center pt-1.5">{invLines.length > 1 && <button onClick={() => removeInvoiceLine(line.id)} className="text-slate-500 hover:text-rose-400 transition-colors"><Trash2 size={14} /></button>}</div>
                    </div>
                  )
                })}
              </div>
              <button type="button" onClick={addInvoiceLine} className="mt-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all active:scale-95"><Plus size={14} /> Yeni Satır Ekle</button>
            </div>
            <div className="p-4 border-t border-slate-800 bg-[#0d1322] flex justify-between items-center shrink-0">
              <div className="flex gap-6 text-xs bg-[#070b14] border border-slate-800 rounded-lg px-4 py-2">
                <div className="flex flex-col"><span className="text-slate-500 text-[9px] uppercase font-bold">Fatura Genel Toplamı (KDV Dahil)</span><span className="text-amber-400 font-bold font-mono text-lg">{formatMoney(calculateInvoiceTotal(), invCurrency).formatted}</span></div>
                {invCurrency !== 'TRY' && (
                   <div className="flex flex-col border-l border-slate-800 pl-6"><span className="text-slate-500 text-[9px] uppercase font-bold">Cariye İşlenecek Bakiye (₺)</span><span className="text-slate-300 font-bold font-mono text-lg">{formatMoney(calculateInvoiceTotal() * (parseFloat(invExchangeRate) || 1), 'TRY').formatted}</span></div>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={closeInvoiceModal} className="px-5 py-2 rounded-lg text-slate-400 hover:bg-slate-800 text-xs font-bold transition-colors">İptal</button>
                <button type="button" onClick={handleSaveDetailedInvoice} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-lg shadow-indigo-900/20">{editingTxId ? 'Faturayı Güncelle' : 'Faturayı Kaydet'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TEDARİKÇİ EKLEME/DÜZENLEME MODALI --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 9999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl w-full max-w-lg p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Building2 size={16} className="text-amber-500" /> {editingId ? 'Tedarikçi Kartını Düzenle' : 'Yeni Tedarikçi Kartı Oluştur'}</h3>
            <form onSubmit={handleSaveSupplier} className="grid grid-cols-2 gap-3 text-[11px]">
              
              <div className="col-span-2">
                <label className="block text-slate-400 mb-1">Firma / Tedarikçi Adı *</label>
                <input type="text" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-amber-500 transition-colors" />
              </div>

              <div className="col-span-2">
                <label className="block text-slate-400 mb-1">Ait Olduğu Ticari İşletme / Merkez *</label>
                <select 
                  value={suppCompanyId} 
                  onChange={(e) => {
                    setSuppCompanyId(e.target.value)
                    setOpeningCompanyId(e.target.value)
                  }} 
                  className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="common">🌍 Ortak / Bağımsız (Tüm Merkezler)</option>
                  <optgroup label="Ticari Şirketler">
                    {companies.filter(c => !c.is_personal && (!isRestricted || hasCompanyAccess(c.id))).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Şahsi Merkezler">
                    {companies.filter(c => c.is_personal && (!isRestricted || hasCompanyAccess(c.id))).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">Bu tedarikçinin bağlı olduğu merkezi belirleyin. Ortak seçilirse tüm merkezler görebilir.</p>
              </div>
              
              <div className="col-span-2">
                <label className="block text-slate-400 mb-1">Yetkili Kişi</label>
                <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none transition-colors" />
              </div>

              <div><label className="block text-slate-400 mb-1">Telefon</label><input type="tel" placeholder="05XX XXX XX XX" maxLength={14} value={phone} onChange={(e) => setPhone(formatPhoneNumber(e.target.value))} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-amber-500 font-mono transition-colors" /></div>
              <div><label className="block text-slate-400 mb-1">E-Posta</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none transition-colors" /></div>
              <div><label className="block text-slate-400 mb-1">Vergi Dairesi</label><input type="text" value={taxOffice} onChange={(e) => setTaxOffice(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none transition-colors" /></div>
              <div><label className="block text-slate-400 mb-1">Vergi / TCKN</label><input type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none font-mono transition-colors" /></div>
              
              <div className="col-span-2"><label className="block text-slate-400 mb-1">Açık Adres</label><textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none resize-none transition-colors" /></div>
              
              <div className="col-span-2 mt-2 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Wallet size={13} className="text-amber-400" />
                    {editingId ? 'Devir / Açılış Bakiyesini Düzenle' : 'Devir / Açılış Bakiyesi (Bizim borcumuz)'}
                  </label>
                  {openingCurrency !== 'TRY' && (
                    <span className="text-[10px] text-indigo-400 font-mono bg-indigo-950/50 border border-indigo-500/30 px-1.5 py-0.5 rounded">
                      TCMB: 1 {openingCurrency} = {openingCurrency === 'USD' ? rates.USD : rates.EUR} ₺
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-12 gap-2">
                  {/* Para Birimi */}
                  <div className={openingCurrency === 'TRY' ? "col-span-6 sm:col-span-4" : "col-span-4 sm:col-span-3"}>
                    <label className="block text-slate-400 mb-1 text-[10px]">Para Birimi</label>
                    <select 
                      value={openingCurrency} 
                      onChange={(e) => {
                        const c = e.target.value as 'TRY' | 'USD' | 'EUR';
                        setOpeningCurrency(c);
                        if (c === 'USD') setOpeningExchangeRate(rates.USD.toString());
                        else if (c === 'EUR') setOpeningExchangeRate(rates.EUR.toString());
                        else setOpeningExchangeRate('1');
                      }} 
                      className="w-full bg-[#070b14] border border-slate-700 rounded px-2 py-1.5 text-white focus:outline-none focus:border-amber-500 font-medium transition-colors"
                    >
                      <option value="TRY">₺ TRY</option>
                      <option value="USD">$ USD</option>
                      <option value="EUR">€ EUR</option>
                    </select>
                  </div>

                  {/* Mutabakat Kuru (Döviz Seçiliyse) */}
                  {openingCurrency !== 'TRY' && (
                    <div className="col-span-4 sm:col-span-3">
                      <label className="block text-indigo-300 mb-1 text-[10px] font-medium">Mutabakat Kuru</label>
                      <input 
                        type="number" 
                        step="0.0001" 
                        required 
                        value={openingExchangeRate} 
                        onChange={(e) => setOpeningExchangeRate(e.target.value)} 
                        className="w-full bg-indigo-950/30 border border-indigo-500/40 rounded px-2 py-1.5 text-indigo-200 focus:outline-none font-mono text-right transition-colors" 
                        title="Mutabakat Kuru"
                      />
                    </div>
                  )}

                  {/* Tutar */}
                  <div className={openingCurrency === 'TRY' ? "col-span-6 sm:col-span-8" : "col-span-4 sm:col-span-6"}>
                    <label className="block text-slate-400 mb-1 text-[10px]">
                      {openingCurrency === 'TRY' ? 'Tutar (₺)' : `Tutar (${openingCurrency === 'USD' ? '$' : '€'})`}
                    </label>
                    <input 
                      type="number" 
                      step="0.01" 
                      placeholder="0.00" 
                      value={openingBalance} 
                      onChange={(e) => setOpeningBalance(e.target.value)} 
                      className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-1.5 text-white focus:outline-none focus:border-amber-500 font-mono text-right transition-colors" 
                    />
                  </div>
                </div>

                {/* Döviz Çevrim Özeti / Bilgi Kartı */}
                {openingCurrency !== 'TRY' && parseFloat(openingBalance) > 0 && (
                  <div className="mt-2 py-1.5 px-3 rounded bg-indigo-950/20 border border-indigo-500/20 flex items-center justify-between text-[11px] text-indigo-300">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                      <span>Döviz: <strong>{openingCurrency === 'USD' ? '$' : '€'}{Number(openingBalance).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> × Kur: <strong>{openingExchangeRate}</strong></span>
                    </span>
                    <span className="font-mono font-bold text-amber-400">
                      ≈ {(Number(openingBalance) * (parseFloat(openingExchangeRate) || 1)).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ Borç
                    </span>
                  </div>
                )}
              </div>

              <div className="col-span-2 flex justify-end gap-2 mt-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-1.5 rounded text-slate-400 hover:bg-slate-800 transition-colors">İptal</button>
                <button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white px-5 py-1.5 rounded font-medium transition-all active:scale-95 shadow-lg shadow-amber-900/20">Kaydet</button>
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
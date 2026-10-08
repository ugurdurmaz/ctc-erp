'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { formatMoney, formatPhoneNumber } from '@/lib/utils'
import { recalculateAbsoluteStock as recalculateStockLedger } from '@/lib/stock-ledger'
import toast, { Toaster } from 'react-hot-toast'
import { Building2, Plus, Trash2, X, Edit3, Search, Phone, Mail, FileText, MapPin, ListPlus, CheckSquare, Square, ScrollText, Landmark, Wallet, CreditCard, Building, Home, Globe, AlertTriangle, RefreshCw, ArrowUpRight, Store, Check, ChevronDown } from 'lucide-react'

type Company = { id: string; name: string; is_personal: boolean }
type Warehouse = { id: string; name: string; company_id?: string | null }

type Supplier = {
  id: string; company_name: string; contact_name: string; phone: string;
  email: string; tax_office: string; tax_id: string; address: string;
  balance: number; currency: string;
  company_id?: string | null;
  tax_number?: string | null;
  company?: { id: string; name: string; is_personal: boolean };
}

type InvoiceLine = {
  id: string; name: string; sku?: string; quantity: string; unitPrice: string;
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

type BankAccount = { id: string; bank_name: string; account_name?: string | null; balance: number; currency: string; company_id?: string | null }
type CashRegister = { id: string; name: string; balance: number; currency: string; company_id?: string | null }
type CreditCardItem = { id: string; name: string; current_debt: number; company_id?: string | null }
type StockItem = { id: string; name: string; sku?: string | null; unit_price: number; vat_rate: number; warehouse_id: string; currency: string; quantity: number }

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
  const [invRoundingAdjustment, setInvRoundingAdjustment] = useState('') 
  const [invTargetTry, setInvTargetTry] = useState('')

  const invoiceWarehouses = useMemo(() => {
    if (invCompanyId === 'common') {
      return warehouses
    }
    const filtered = warehouses.filter(w => w.company_id === invCompanyId)
    if (filtered.length > 0) return filtered
    return warehouses.filter(w => !w.company_id)
  }, [warehouses, invCompanyId])

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
    const { data: bData } = await supabase.from('bank_accounts').select('id, bank_name, account_name, balance, currency, company_id').order('bank_name')
    const { data: cData } = await supabase.from('cash_registers').select('id, name, balance, currency, company_id').order('name')
    const { data: cdData } = await supabase.from('credit_cards').select('id, name, current_debt, company_id')
    
    let bList = bData || []
    let cList = cData || []
    if (isRestricted) {
      bList = bList.filter(b => !b.company_id || hasCompanyAccess(b.company_id))
      cList = cList.filter(c => !c.company_id || hasCompanyAccess(c.company_id))
    }
    setBanks(bList); setCashes(cList)
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
    const { data } = await supabase.from('warehouses').select('id, name, company_id').order('created_at', { ascending: true }); setWarehouses(data || [])
  }

  async function fetchStocks() {
    const { data } = await supabase.from('stocks').select('id, name, sku, unit_price, vat_rate, warehouse_id, currency, quantity').order('name', { ascending: true }); setStocks(data || [])
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
        if (txCurr === 'TRY') val = Number((val / (rate || rates.USD || 1)).toFixed(2))
        else if (txCurr === 'EUR') val = Number(((val * (rate || rates.EUR || 1)) / (rates.USD || 1)).toFixed(2))
      } else if (suppCurr === 'EUR') {
        if (txCurr === 'TRY') val = Number((val / (rate || rates.EUR || 1)).toFixed(2))
        else if (txCurr === 'USD') val = Number(((val * (rate || rates.USD || 1)) / (rates.EUR || 1)).toFixed(2))
      } else {
        if (txCurr !== 'TRY') val = Number((val * rate).toFixed(2))
      }

      if (t.tx_type === 'debt') absoluteBal += val
      else absoluteBal -= val
    })
    await supabase.from('suppliers').update({ balance: Number(absoluteBal.toFixed(2)) }).eq('id', supplierId)
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
    return await recalculateStockLedger(supabase, stockId, rates)
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
       .select('amount, tx_type, company_id, currency, exchange_rate').eq('supplier_id', supp.id).ilike('description', 'Açılış Bakiyesi / Devir%').limit(1);
    
    if (txs && txs.length > 0) {
      const tx = txs[0];
      const sign = tx.tx_type === 'payment' ? -1 : 1;
      setOpeningBalance((Number(tx.amount) * sign).toString());
      const cur = (tx.currency as 'TRY' | 'USD' | 'EUR') || (supp.currency as 'TRY' | 'USD' | 'EUR') || 'TRY';
      setOpeningCurrency(cur);
      setOpeningExchangeRate(tx.exchange_rate ? tx.exchange_rate.toString() : (cur === 'USD' ? rates.USD.toString() : cur === 'EUR' ? rates.EUR.toString() : '1'));
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
           .select('*').eq('supplier_id', editingId).ilike('description', 'Açılış Bakiyesi / Devir%').limit(1);
        
        const oldTx = oldTxs && oldTxs.length > 0 ? oldTxs[0] : null;

        if (oldTx) {
           const targetTxType = initialBalance < 0 ? 'payment' : 'debt';
           const targetAmount = Math.abs(initialBalance);
           const targetDesc = initialBalance < 0 ? 'Açılış Bakiyesi / Devir (Fazla Ödeme / Avans)' : 'Açılış Bakiyesi / Devir';
           const compChanged = oldTx.company_id !== initialCompId;
           const amountChanged = Math.abs(targetAmount - Number(oldTx.amount)) > 0.001;
           const typeChanged = oldTx.tx_type !== targetTxType;
           const curChanged = (oldTx.currency || 'TRY') !== openingCurrency;
           const rateChanged = Math.abs(Number(oldTx.exchange_rate || 1) - rateVal) > 0.0001;

           if (initialBalance === 0) {
              await supabase.from('supplier_transactions').delete().eq('id', oldTx.id);
           } else if (amountChanged || compChanged || curChanged || rateChanged || typeChanged) {
              await supabase.from('supplier_transactions').update({
                amount: targetAmount,
                tx_type: targetTxType,
                description: targetDesc,
                company_id: initialCompId,
                currency: openingCurrency,
                exchange_rate: rateVal
              }).eq('id', oldTx.id);
           }
        } else if (initialBalance !== 0) {
           const targetTxType = initialBalance < 0 ? 'payment' : 'debt';
           const targetAmount = Math.abs(initialBalance);
           const targetDesc = initialBalance < 0 ? 'Açılış Bakiyesi / Devir (Fazla Ödeme / Avans)' : 'Açılış Bakiyesi / Devir';
           const txPayload = { 
             supplier_id: editingId, 
             company_id: initialCompId, 
             tx_date: todayISO, 
             description: targetDesc, 
             tx_type: targetTxType, 
             amount: targetAmount, 
             currency: openingCurrency, 
             exchange_rate: rateVal 
           };
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
        
        if (initialBalance !== 0) {
           const targetTxType = initialBalance < 0 ? 'payment' : 'debt';
           const targetAmount = Math.abs(initialBalance);
           const targetDesc = initialBalance < 0 ? 'Açılış Bakiyesi / Devir (Fazla Ödeme / Avans)' : 'Açılış Bakiyesi / Devir';
           const txPayload = { 
             supplier_id: data.id, 
             company_id: initialCompId, 
             tx_date: todayISO, 
             description: targetDesc, 
             tx_type: targetTxType, 
             amount: targetAmount, 
             currency: openingCurrency, 
             exchange_rate: rateVal 
           };
           const { data: txData, error: txErr } = await supabase.from('supplier_transactions').insert([txPayload]).select().single();
           if (!txErr && txData) {
             await logActivity('supplier_tx', 'INSERT', `Açılış Bakiyesi (Tedarikçi): ${companyName} (${initialBalance < 0 ? 'Fazla Ödeme / Avans' : 'Borç'})`, txData.id, targetAmount, openingCurrency, null, txData, initialCompId);
           }
        }

        await recalculateAbsoluteSupplierBalance(data.id);
        toast.success('Yeni tedarikçi eklendi.');
        setSelectedSupplierId(data.id);
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

          // Tedarikçiye ait ödemelerin karşı bacaklarını (kasa, banka, kredi kartı) temizle
          const { data: relatedTxs } = await supabase.from('supplier_transactions').select('*').eq('supplier_id', id)
          if (relatedTxs && relatedTxs.length > 0) {
            for (const rTx of relatedTxs) {
              if (rTx.tx_type === 'payment' && rTx.payment_source_type && rTx.payment_source_id) {
                await modifyPaymentSourceBalance(
                  rTx.payment_source_type,
                  rTx.payment_source_id,
                  rTx.amount,
                  rTx.currency || 'TRY',
                  rTx.exchange_rate || 1,
                  'reverse',
                  rTx.id,
                  rTx.tx_date,
                  suppToDelete?.company_name || '',
                  rTx.description,
                  rTx.company_id ?? null
                )
              }
            }
          }

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
            description: `Tedarikçi Ödemesi (${suppName}) - ${desc} [SUPP-${relatedTxId}]`,
            amount: convertedAmount,
            tx_type: 'expense'
          }
          await supabase.from('card_transactions').insert([cardPayload])
        } else {
          const payload: any = {
            [txIdField]: sourceId, company_id: compId, tx_date: dateStr, description: `Tedarikçi Ödemesi (${suppName}) - ${desc}`,
            amount: convertedAmount, is_transfer: false, transfer_id: `SUPP-${relatedTxId}`,
            tx_type: 'out', currency: accCurr, exchange_rate: 1
          }
          if (sourceType === 'bank') payload.status = 'completed'
          await supabase.from(txTable).insert([payload])
        }
      } else if (action === 'reverse') {
        if (sourceType === 'card') {
          await supabase.from('card_transactions').delete().like('description', `%[SUPP-${relatedTxId}]%`)
        } else {
          await supabase.from(txTable).delete().eq('transfer_id', `SUPP-${relatedTxId}`)
        }
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
      fetchStocks()
      fetchWarehouses()
      const rawLines = Array.isArray(t.invoice_lines) ? t.invoice_lines : []
      const linesSum = rawLines.reduce((acc: number, l: any) => {
        const q = parseFloat(l.quantity) || 0
        const p = parseFloat(l.unitPrice) || 0
        const v = parseFloat(l.vatRate) || 0
        return acc + (q * p * (1 + v / 100))
      }, 0)
      const diff = Number(((t.amount || 0) - linesSum).toFixed(2))
      if (Math.abs(diff) >= 0.01) setInvRoundingAdjustment(diff.toString())
      else setInvRoundingAdjustment('')
      setInvTargetTry('')

      setInvDate(t.tx_date); setInvDesc(t.description); setInvLines(rawLines.map((l: any) => ({ ...l, sku: l.sku || '' }))); setInvCurrency(t.currency as any || 'TRY'); setInvExchangeRate(t.exchange_rate?.toString() || '1'); setInvCompanyId(t.company_id || 'common'); setIsInvoiceModalOpen(true)
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

  function openInvoiceModal() { 
    fetchStocks()
    fetchWarehouses()
    setEditingTxId(null); setInvDate(getLocalTodayISO()); setInvDesc(''); setInvCurrency('TRY'); setInvExchangeRate('1')
    setInvRoundingAdjustment('')
    setInvTargetTry('')
    
    const currSupp = suppliers.find(s => s.id === selectedSupplierId)
    const targetCompId = currSupp?.company_id || 'common'
    setInvCompanyId(targetCompId)

    const targetWhs = targetCompId === 'common' 
      ? warehouses 
      : warehouses.filter(w => w.company_id === targetCompId)
    const validWhs = targetWhs.length > 0 ? targetWhs : warehouses.filter(w => !w.company_id)
    const initialWhId = validWhs[0]?.id || warehouses[0]?.id || ''

    setInvLines([{ id: Date.now().toString(), name: '', sku: '', quantity: '1', unitPrice: '', vatRate: '20', addToStock: true, warehouseId: initialWhId, selectedStockId: undefined }])
    setActiveStockDropdown(null); setIsInvoiceModalOpen(true) 
  }
  function closeInvoiceModal() { setIsInvoiceModalOpen(false); setActiveStockDropdown(null); if (editingTxId && transactions.find(t => t.id === editingTxId)?.is_detailed) cancelEditTx() }
  function addInvoiceLine() { 
    const defaultWhId = invoiceWarehouses[0]?.id || ''
    setInvLines(prev => [...prev, { id: Date.now().toString(), name: '', sku: '', quantity: '1', unitPrice: '', vatRate: '20', addToStock: true, warehouseId: defaultWhId, selectedStockId: undefined }]) 
  }
  function removeInvoiceLine(id: string) { setInvLines(invLines.filter(l => l.id !== id)) }
  function updateInvoiceLine(id: string, field: keyof InvoiceLine, value: any) { setInvLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l)) }

  function selectStockForLine(lineId: string, stock: StockItem) {
    const convertedPrice = convertCurrency(stock.unit_price, stock.currency, invCurrency)
    setInvLines(prev => prev.map(l => {
      if (l.id === lineId) { 
        return { 
          ...l, 
          name: stock.name, 
          sku: stock.sku || '', 
          unitPrice: convertedPrice > 0 ? convertedPrice.toFixed(2) : l.unitPrice, 
          vatRate: (stock.vat_rate !== undefined && stock.vat_rate !== null) ? stock.vat_rate.toString() : (l.vatRate || '20'), 
          warehouseId: stock.warehouse_id || l.warehouseId, 
          addToStock: true, 
          selectedStockId: stock.id 
        } 
      }
      return l
    }))
    setActiveStockDropdown(null) 
  }

  const calculateInvoiceLinesTotal = () => { 
    return invLines.reduce((acc, line) => { 
      const q = parseFloat(line.quantity) || 0; 
      const p = parseFloat(line.unitPrice) || 0; 
      const v = parseFloat(line.vatRate) || 0; 
      return acc + (q * p * (1 + v / 100)) 
    }, 0) 
  }

  const calculateFinalInvoiceTotal = () => {
    const linesTotal = calculateInvoiceLinesTotal()
    const roundVal = parseFloat(invRoundingAdjustment) || 0
    return Math.max(0, Number((linesTotal + roundVal).toFixed(2)))
  }

  const applyTargetTryRate = () => {
    const targetNum = parseFloat(invTargetTry.replace(',', '.'))
    const finalSum = calculateFinalInvoiceTotal()
    if (!targetNum || targetNum <= 0) {
      toast.error('Lütfen geçerli bir hedef TL tutarı girin.')
      return
    }
    if (finalSum <= 0) {
      toast.error('Önce fatura kalemlerini giriniz.')
      return
    }
    // Hedef net TL'ye tam oturacak kuru 6 hane hassasiyetle hesapla
    const newRate = (targetNum / finalSum).toFixed(6)
    setInvExchangeRate(newRate)
    toast.success(`Mutabakat kuru ${newRate} olarak ayarlandı. Cariye işlenecek bakiye: ${targetNum.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`)
  }

  const calculateInvoiceTotal = calculateFinalInvoiceTotal

  async function handleSaveDetailedInvoice(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSupplierId || invLines.length === 0 || !invCompanyId) return
    const currentSupplier = suppliers.find(s => s.id === selectedSupplierId); if (!currentSupplier) return
    const finalCompId = invCompanyId === 'common' ? null : invCompanyId

    const totalGross = calculateFinalInvoiceTotal(); if (totalGross <= 0) return toast.error('Fatura toplamı 0 olamaz.')
    for (const line of invLines) {
      if (line.addToStock && line.name?.trim() && !line.warehouseId) {
        return toast.error(`"${line.name}" için depo seçimi zorunludur.`)
      }
    }
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
        if (line.addToStock && line.name?.trim()) {
          const q = parseFloat(line.quantity) || 0; const p = parseFloat(line.unitPrice) || 0; const v = parseFloat(line.vatRate) || 0
          
          let targetStockId = line.selectedStockId || null

          if (targetStockId) {
             affectedStocks.add(targetStockId)
             if (line.sku?.trim()) {
               const ex = stocks.find(s => s.id === targetStockId)
               if (ex && !ex.sku) {
                 await supabase.from('stocks').update({ sku: line.sku.trim() }).eq('id', targetStockId)
               }
             }
          } else if (line.warehouseId) {
            const { data: existingStock } = await supabase.from('stocks').select('*').eq('warehouse_id', line.warehouseId).ilike('name', line.name.trim()).limit(1)

            if (existingStock && existingStock.length > 0) {
              targetStockId = existingStock[0].id
              if (targetStockId) {
                affectedStocks.add(targetStockId)
                if (!existingStock[0].sku && line.sku?.trim()) {
                  await supabase.from('stocks').update({ sku: line.sku.trim() }).eq('id', targetStockId)
                }
              }
            } else {
              const { data: newStock, error: newStockErr } = await supabase.from('stocks').insert([{ 
                warehouse_id: line.warehouseId, 
                name: line.name.trim(), 
                sku: line.sku?.trim() || null, 
                currency: invCurrency, 
                quantity: 0, 
                unit_price: p, 
                vat_rate: v, 
                unit: 'Adet', 
                stock_color: 'from-[#1b253b] to-[#121a2a]' 
              }]).select()
              if (newStockErr) {
                console.error("Yeni stok oluşturma hatası:", newStockErr)
                throw new Error(`Yeni stok (${line.name}) oluşturulamadı: ${newStockErr.message}`)
              }
              if (newStock && newStock.length > 0) {
                 targetStockId = newStock[0].id
                 if (targetStockId) affectedStocks.add(targetStockId)
              }
            }
          }

          if (targetStockId) {
            const { data: stTx } = await supabase.from('stock_transactions').insert([{ stock_id: targetStockId, company_id: finalCompId, tx_date: invDate, description: `${invDesc || 'Fatura'} / Alım (${currentSupplier?.company_name || 'Satıcı'})`, tx_type: 'in', quantity: q, unit_price: p, currency: invCurrency, vat_rate: v }]).select()
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
    if (type === 'bank') {
      const b = banks.find(b => b.id === id)
      if (!b) return 'Banka'
      return b.account_name ? `${b.bank_name} - ${b.account_name} (${b.currency})` : `${b.bank_name} (${b.currency})`
    }
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
      if (txCurr === 'TRY') valInSuppCurr = Number((valInSuppCurr / (rate || rates.USD || 1)).toFixed(2))
      else if (txCurr === 'EUR') valInSuppCurr = Number(((valInSuppCurr * (rate || rates.EUR || 1)) / (rates.USD || 1)).toFixed(2))
    } else if (suppCurr === 'EUR') {
      if (txCurr === 'TRY') valInSuppCurr = Number((valInSuppCurr / (rate || rates.EUR || 1)).toFixed(2))
      else if (txCurr === 'USD') valInSuppCurr = Number(((valInSuppCurr * (rate || rates.USD || 1)) / (rates.EUR || 1)).toFixed(2))
    } else {
      if (txCurr !== 'TRY') valInSuppCurr = Number((valInSuppCurr * rate).toFixed(2))
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
                    <div className={`text-[11px] font-mono font-bold ${
                      item.balance > 0.01 
                        ? 'text-amber-400' 
                        : item.balance < -0.01 
                        ? 'text-emerald-400' 
                        : 'text-slate-400'
                    }`}>
                      {formatMoney(Math.abs(item.balance), (item.currency as any) || 'TRY').formatted}
                    </div>
                    {item.currency && item.currency !== 'TRY' && item.balance !== 0 && (
                      <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                        ≈ {formatMoney(Math.abs(item.balance) * (item.currency === 'USD' ? rates.USD : rates.EUR), 'TRY').formatted}
                      </div>
                    )}
                    <div className={`text-[8px] uppercase tracking-wider mt-0.5 font-bold ${
                      item.balance > 0.01 
                        ? 'text-amber-500/80' 
                        : item.balance < -0.01 
                        ? 'text-emerald-500/80' 
                        : 'text-slate-500'
                    }`}>
                      {item.balance > 0.01 ? 'BORCUMUZ' : item.balance < -0.01 ? 'ALACAĞIMIZ (AVANS)' : 'BAKİYE YOK'}
                    </div>
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
                  <span className={`text-2xl font-black font-mono ${
                    selectedSupplier.balance > 0.01 
                      ? 'text-amber-400' 
                      : selectedSupplier.balance < -0.01 
                      ? 'text-emerald-400' 
                      : 'text-slate-400'
                  }`}>
                    {formatMoney(selectedSupplier.balance, (selectedSupplier.currency as any) || 'TRY').formatted}
                  </span>
                  <span className={`text-[9px] uppercase tracking-wider font-bold mt-0.5 ${
                    selectedSupplier.balance > 0.01 
                      ? 'text-amber-500/80' 
                      : selectedSupplier.balance < -0.01 
                      ? 'text-emerald-400' 
                      : 'text-slate-500'
                  }`}>
                    {selectedSupplier.balance > 0.01 
                      ? 'BORCUMUZ (Ödenecek)' 
                      : selectedSupplier.balance < -0.01 
                      ? 'ALACAĞIMIZ (Fazla Ödeme / Avans)' 
                      : 'BAKİYE SIFIR'}
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
                      <div className="w-40"><label className="block text-[9px] text-slate-400 mb-0.5">Ödeme Kaynağı *</label><select value={paymentSource} onChange={(e) => setPaymentSource(e.target.value)} required className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors"><option value="">Seçiniz</option>{cashes.length > 0 && <optgroup label="Kasalar">{cashes.map(c => <option key={`cash|${c.id}`} value={`cash|${c.id}`}>{c.name} ({c.currency})</option>)}</optgroup>}{banks.length > 0 && <optgroup label="Bankalar">{banks.map(b => <option key={`bank|${b.id}`} value={`bank|${b.id}`}>{b.bank_name}{b.account_name ? ` - ${b.account_name}` : ''} ({b.currency})</option>)}</optgroup>}{cards.length > 0 && <optgroup label="Kredi Kartları">{cards.map(c => <option key={`card|${c.id}`} value={`card|${c.id}`}>{c.name}</option>)}</optgroup>}</select></div>
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
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl w-full max-w-[1440px] flex flex-col h-[85vh] min-h-[580px] max-h-[900px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={() => setActiveStockDropdown(null)}>
            <div className="p-4 border-b border-slate-800 bg-[#0a0f1d] flex justify-between items-center shrink-0">
              <div><h3 className="text-base font-bold text-white flex items-center gap-2"><ListPlus className="text-indigo-400" size={18} />{editingTxId ? 'Faturayı Düzenle' : 'Yeni Alım Faturası'}</h3><p className="text-[10px] text-slate-400 mt-0.5">Tedarikçi: <strong className="text-amber-400">{selectedSupplier.company_name}</strong></p></div><button onClick={closeInvoiceModal} className="text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="p-4 bg-[#0d1322] flex flex-wrap gap-4 shrink-0 border-b border-slate-800 items-end">
              <div className="w-36">
                 <label className="block text-[10px] text-slate-400 mb-1">İlgili Merkez *</label>
                 <select 
                   value={invCompanyId} 
                   onChange={(e) => {
                     const newCompId = e.target.value
                     setInvCompanyId(newCompId)
                     const newWhs = newCompId === 'common' 
                       ? warehouses 
                       : (warehouses.filter(w => w.company_id === newCompId).length > 0
                           ? warehouses.filter(w => w.company_id === newCompId)
                           : warehouses.filter(w => !w.company_id))
                     const fallbackWhId = newWhs[0]?.id || ''

                     setInvLines(prev => prev.map(l => {
                       if (!l.selectedStockId) {
                         const isCurrentValid = newWhs.some(w => w.id === l.warehouseId)
                         return isCurrentValid ? l : { ...l, warehouseId: fallbackWhId }
                       } else {
                         const stock = stocks.find(s => s.id === l.selectedStockId)
                         const isStockValid = stock ? newWhs.some(w => w.id === stock.warehouse_id) : true
                         if (!isStockValid) {
                           return { ...l, selectedStockId: undefined, warehouseId: fallbackWhId }
                         }
                         return l
                       }
                     }))
                   }} 
                   required 
                   className="w-full bg-[#070b14] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none transition-colors"
                 >
                   {!isRestricted && <option value="common">🌍 Ortak İşlem</option>}
                   <optgroup label="Ticari Şirketler">{companies.filter(c => !c.is_personal && (!isRestricted || hasCompanyAccess(c.id))).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                   <optgroup label="Şahsi Merkezler">{companies.filter(c => c.is_personal && (!isRestricted || hasCompanyAccess(c.id))).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                 </select>
              </div>
              <div className="w-36"><label className="block text-[10px] text-slate-400 mb-1">Fatura Tarihi</label><input type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none transition-colors" /></div>
              <div className="flex-1"><label className="block text-[10px] text-slate-400 mb-1">Fatura / Belge No (Açıklama)</label><input type="text" placeholder="Örn: FAT-2026-0012" value={invDesc} onChange={(e) => setInvDesc(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none transition-colors" /></div>
              <div className="w-24"><label className="block text-[10px] text-slate-400 mb-1">Fatura Dövizi</label><select value={invCurrency} onChange={(e) => setInvCurrency(e.target.value as any)} className="w-full bg-[#070b14] border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none transition-colors"><option value="TRY">₺ TRY</option><option value="USD">$ USD</option><option value="EUR">€ EUR</option></select></div>
              {invCurrency !== 'TRY' && (
                <div className="w-24"><label className="block text-[10px] text-slate-400 mb-1">Mutabakat Kuru</label><input type="number" step="any" value={invExchangeRate} onChange={(e) => setInvExchangeRate(e.target.value)} className="w-full bg-indigo-900/20 text-indigo-300 border border-indigo-500/50 rounded px-2 py-1.5 text-xs focus:outline-none font-mono transition-colors" /></div>
              )}
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1 bg-[#0a0f1d] min-h-[360px] pb-52">
              <div className="space-y-2">
                <div className="flex gap-2 text-[10px] font-bold text-slate-500 uppercase px-1">
                  <div className="flex-1 min-w-[220px]">Ürün / Hizmet Adı</div>
                  <div className="w-28 text-left">Ürün Kodu (SKU)</div>
                  <div className="w-20 text-right">Miktar</div>
                  <div className="w-24 text-right">Net B.Fiyat ({invCurrency})</div>
                  <div className="w-16 text-center">KDV(%)</div>
                  <div className="w-24 text-right pr-2">KDV'li Toplam</div>
                  <div className="w-20 text-center">Stoğa Ekle</div>
                  <div className="w-32">Depo Seçimi</div>
                  <div className="w-8"></div>
                </div>
                {invLines.map((line) => {
                  const q = parseFloat(line.quantity) || 0; const p = parseFloat(line.unitPrice) || 0; const v = parseFloat(line.vatRate) || 0
                  const query = line.name.trim().toLocaleLowerCase('tr-TR')
                  const invoiceWarehouseIds = new Set(invoiceWarehouses.map(w => w.id))
                  const filteredStocks = stocks.filter(s => {
                    if (invCompanyId !== 'common' && !invoiceWarehouseIds.has(s.warehouse_id)) {
                      return false
                    }
                    if (!query) return true
                    const matchName = s.name.toLocaleLowerCase('tr-TR').includes(query)
                    const matchSku = s.sku ? s.sku.toLocaleLowerCase('tr-TR').includes(query) : false
                    return matchName || matchSku
                  })
                  const exactMatch = stocks.find(s => s.name.trim().toLocaleLowerCase('tr-TR') === query)
                  const selectedStock = line.selectedStockId ? stocks.find(s => s.id === line.selectedStockId) : null

                  return (
                    <div key={line.id} className="flex gap-2 items-start bg-[#0d1322] border border-slate-700/50 p-2 rounded-lg group transition-colors hover:border-slate-600">
                      {/* ÜRÜN ADI VE AÇILIR LİSTE */}
                      <div className="flex-1 min-w-[220px] relative">
                        <div className="flex items-center bg-[#070b14] border border-slate-700 rounded overflow-hidden transition-colors focus-within:border-indigo-500/50">
                          <Search size={12} className="text-slate-500 ml-2 shrink-0" />
                          <input 
                            type="text" 
                            placeholder="Ürün ara veya yeni yaz..." 
                            value={line.name} 
                            onChange={(e) => { 
                              updateInvoiceLine(line.id, 'name', e.target.value)
                              updateInvoiceLine(line.id, 'selectedStockId', undefined)
                              setActiveStockDropdown(line.id) 
                            }} 
                            onFocus={() => setActiveStockDropdown(line.id)} 
                            onClick={(e) => {
                              e.stopPropagation()
                              setActiveStockDropdown(line.id)
                            }} 
                            className="w-full bg-transparent px-2 py-1.5 text-xs text-white focus:outline-none" 
                          />
                          {line.name && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                updateInvoiceLine(line.id, 'name', '')
                                updateInvoiceLine(line.id, 'sku', '')
                                updateInvoiceLine(line.id, 'selectedStockId', undefined)
                                setActiveStockDropdown(line.id)
                              }}
                              className="text-slate-500 hover:text-slate-300 p-1 mr-0.5 transition-colors"
                              title="Temizle"
                            >
                              <X size={12} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setActiveStockDropdown(activeStockDropdown === line.id ? null : line.id)
                            }}
                            className="text-slate-500 hover:text-indigo-400 p-1 mr-1 transition-colors"
                            title="Stok Ürünlerini Listele"
                          >
                            <ChevronDown size={14} className={`transition-transform duration-200 ${activeStockDropdown === line.id ? 'rotate-180 text-indigo-400' : ''}`} />
                          </button>
                        </div>

                        {/* Bilgi Rozeti */}
                        {selectedStock ? (
                          <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px]">
                            <span className="text-emerald-400 font-mono font-semibold">✓ Stokta: {selectedStock.quantity} adet</span>
                            {selectedStock.sku && (
                              <>
                                <span className="text-slate-500">•</span>
                                <span className="text-slate-300 font-mono bg-slate-800/80 px-1 py-0.2 rounded border border-slate-700/80">Kod: {selectedStock.sku}</span>
                              </>
                            )}
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-400">{warehouses.find(w => w.id === selectedStock.warehouse_id)?.name || 'Depo'}</span>
                          </div>
                        ) : line.name.trim() ? (
                          <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px]">
                            <span className="text-amber-400 font-medium">✨ Yeni Ürün</span>
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-400">{line.addToStock ? 'Fatura kaydedildiğinde depoya yeni stok olarak eklenecek' : 'Sadece faturaya yazılacak'}</span>
                          </div>
                        ) : null}

                        {/* DROPDOWN LİSTE */}
                        {activeStockDropdown === line.id && (
                          <div 
                            onClick={(e) => e.stopPropagation()} 
                            className="absolute top-full left-0 right-0 mt-1 bg-[#1b253b] border border-indigo-500/50 rounded-lg shadow-2xl z-50 max-h-64 overflow-y-auto custom-scrollbar animate-in fade-in duration-200"
                          >
                            <div className="px-3 py-1.5 bg-[#141c2e] border-b border-slate-700/60 flex justify-between items-center text-[10px] text-slate-400 font-medium sticky top-0 z-10 backdrop-blur-sm">
                              <span>{query ? `Arama Sonuçları (${filteredStocks.length})` : `Kayıtlı Stok Ürünleri (${filteredStocks.length})`}</span>
                              <span className="text-indigo-400 font-mono text-[9px]">Ürün Adı veya SKU</span>
                            </div>

                            {/* Yeni Stok Ekleme Hızlı Seçeneği */}
                            {query && !exactMatch && (
                              <div 
                                onClick={(e) => {
                                  e.stopPropagation()
                                  updateInvoiceLine(line.id, 'addToStock', true)
                                  if (!line.warehouseId || !invoiceWarehouses.some(w => w.id === line.warehouseId)) {
                                    updateInvoiceLine(line.id, 'warehouseId', invoiceWarehouses[0]?.id || '')
                                  }
                                  setActiveStockDropdown(null)
                                }} 
                                className="px-3 py-2 text-xs bg-indigo-950/50 hover:bg-indigo-900/80 border-b border-indigo-500/40 text-indigo-200 cursor-pointer flex items-center justify-between transition-colors group/new"
                              >
                                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                  <Plus size={13} className="text-emerald-400 shrink-0 group-hover/new:scale-110 transition-transform" />
                                  <span className="truncate">Yeni Stok Olarak Ekle: <strong className="text-white font-semibold">"{line.name.trim()}"</strong></span>
                                </div>
                                <span className="text-[10px] bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 px-1.5 py-0.5 rounded shrink-0 font-medium">
                                  + Yeni Stok
                                </span>
                              </div>
                            )}

                            {/* Stok Öğeleri */}
                            {filteredStocks.length > 0 ? (
                              filteredStocks.map(s => {
                                const isSelected = line.selectedStockId === s.id
                                const whName = warehouses.find(w => w.id === s.warehouse_id)?.name
                                return (
                                  <div 
                                    key={s.id} 
                                    onClick={(e) => { 
                                      e.stopPropagation()
                                      selectStockForLine(line.id, s) 
                                    }} 
                                    className={`px-3 py-2 text-xs border-b border-slate-700/50 hover:bg-indigo-600 hover:text-white cursor-pointer transition-colors flex justify-between items-center group ${isSelected ? 'bg-indigo-950/60 border-l-2 border-l-indigo-500' : ''}`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0 pr-2 flex-1">
                                      {isSelected && <Check size={12} className="text-indigo-400 group-hover:text-white shrink-0" />}
                                      <span className="font-medium truncate text-slate-200 group-hover:text-white">{s.name}</span>
                                      {s.sku ? (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-400 font-mono shrink-0 border border-slate-700/80 group-hover:bg-indigo-700 group-hover:text-indigo-100 group-hover:border-indigo-400/50">
                                          {s.sku}
                                        </span>
                                      ) : (
                                        <span className="text-[9px] px-1 py-0.2 rounded text-slate-600 font-mono shrink-0">
                                          SKU Yok
                                        </span>
                                      )}
                                      {whName && (
                                        <span className="text-[9px] text-slate-500 group-hover:text-indigo-200 shrink-0">
                                          • {whName}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 font-mono">
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border shrink-0 ${s.quantity > 0 ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40' : 'bg-slate-900/60 text-slate-400 border-slate-700'}`}>
                                        Stok: {s.quantity}
                                      </span>
                                    </div>
                                  </div>
                                )
                              })
                            ) : (
                              <div className="p-4 text-center text-xs text-slate-400">
                                <div className="mb-2">"{line.name}" için kayıtlı ürün bulunamadı.</div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    updateInvoiceLine(line.id, 'addToStock', true)
                                    if (!line.warehouseId || !invoiceWarehouses.some(w => w.id === line.warehouseId)) {
                                      updateInvoiceLine(line.id, 'warehouseId', invoiceWarehouses[0]?.id || '')
                                    }
                                    setActiveStockDropdown(null)
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 transition-all active:scale-95"
                                >
                                  <Plus size={14} /> Bu Ürünü Yeni Stok Olarak Ekle
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ÜRÜN KODU (SKU) SÜTUNU */}
                      <div className="w-28">
                        <input 
                          type="text" 
                          placeholder="Örn: SKU-101" 
                          value={line.sku || ''} 
                          onChange={(e) => updateInvoiceLine(line.id, 'sku', e.target.value)} 
                          disabled={!!line.selectedStockId} 
                          title={line.selectedStockId ? "Kayıtlı ürün kodu (stok kartından gelir)" : "Yeni ürün stok kodu (opsiyonel)"} 
                          className="w-full bg-[#070b14] border border-slate-700 rounded px-2 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 disabled:opacity-60 disabled:cursor-not-allowed font-mono transition-colors" 
                        />
                      </div>

                      <div className="w-20"><input type="number" step="0.01" placeholder="0" value={line.quantity} onChange={(e) => updateInvoiceLine(line.id, 'quantity', e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-2 py-1.5 text-xs text-white text-right focus:outline-none focus:border-indigo-500/50 transition-colors font-mono" /></div>
                      <div className="w-24"><input type="number" step="0.01" placeholder="0.00" value={line.unitPrice} onChange={(e) => updateInvoiceLine(line.id, 'unitPrice', e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-2 py-1.5 text-xs text-white text-right focus:outline-none focus:border-indigo-500/50 transition-colors font-mono" /></div>
                      <div className="w-16"><select value={line.vatRate} onChange={(e) => updateInvoiceLine(line.id, 'vatRate', e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-1 py-1.5 text-xs text-white text-center focus:outline-none transition-colors"><option value="20">%20</option><option value="10">%10</option><option value="1">%1</option><option value="0">%0</option></select></div>
                      <div className="w-24 text-right pr-2 font-mono text-xs font-bold text-slate-300 flex items-center justify-end">{formatMoney(q * p * (1 + v / 100), invCurrency).formatted}</div>
                      <div className="w-20 flex justify-center"><button type="button" onClick={() => updateInvoiceLine(line.id, 'addToStock', !line.addToStock)} className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold transition-colors ${line.addToStock ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>{line.addToStock ? <CheckSquare size={14}/> : <Square size={14}/>} Stok</button></div>
                      <div className="w-32">
                        {line.addToStock ? (
                          <select 
                            disabled={!!line.selectedStockId || invoiceWarehouses.length === 0} 
                            title={line.selectedStockId ? "Kayıtlı ürün seçildiği için depo değiştirilemez." : (invoiceWarehouses.length === 0 ? "Bu merkeze ait depo bulunamadı." : "Ürünün ekleneceği depo")} 
                            value={line.warehouseId} 
                            onChange={(e) => updateInvoiceLine(line.id, 'warehouseId', e.target.value)} 
                            className="w-full bg-indigo-900/30 border border-indigo-500/50 rounded px-1 py-1.5 text-[11px] text-indigo-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {invoiceWarehouses.length === 0 ? (
                              <option value="" disabled>Depo Yok</option>
                            ) : (
                              <>
                                <option value="" disabled>Depo Seç...</option>
                                {invoiceWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                              </>
                            )}
                          </select>
                        ) : (
                          <div className="w-full text-center text-[10px] text-slate-600 py-1.5">-</div>
                        )}
                      </div>
                      <div className="w-8 flex justify-center pt-1.5">{invLines.length > 1 && <button onClick={() => removeInvoiceLine(line.id)} className="text-slate-500 hover:text-rose-400 transition-colors"><Trash2 size={14} /></button>}</div>
                    </div>
                  )
                })}
              </div>
              <button type="button" onClick={addInvoiceLine} className="mt-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all active:scale-95"><Plus size={14} /> Yeni Satır Ekle</button>
            </div>
            {(() => {
              const linesSum = calculateInvoiceLinesTotal()
              const roundNum = parseFloat(invRoundingAdjustment) || 0
              const finalSum = calculateFinalInvoiceTotal()
              return (
                <div className="p-4 border-t border-slate-800 bg-[#0d1322] flex flex-wrap justify-between items-center gap-4 shrink-0">
                  <div className="flex flex-wrap items-center gap-4 text-xs bg-[#070b14] border border-slate-800 rounded-lg p-2.5">
                    {/* 1. Kalemler Toplamı */}
                    <div className="flex flex-col px-2">
                      <span className="text-slate-500 text-[9px] uppercase font-bold tracking-wider">Kalemler Toplamı</span>
                      <span className="text-slate-300 font-semibold font-mono text-sm">{formatMoney(linesSum, invCurrency).formatted}</span>
                    </div>

                    {/* 2. Yuvarlama / İskonto Input */}
                    <div className="flex flex-col border-l border-slate-800 pl-4 pr-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-slate-400 text-[9px] uppercase font-bold tracking-wider">Yuvarlama / İskonto (±)</span>
                        <span className="text-[10px] text-slate-500 cursor-help" title="Faturadaki küsurat farkı veya yuvarlama için: Artı (+) veya eksi (-) tutar girebilirsiniz. Örn: -1.45 veya +2.00">ⓘ</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="relative flex items-center">
                          <input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00" 
                            value={invRoundingAdjustment} 
                            onChange={(e) => setInvRoundingAdjustment(e.target.value)} 
                            className={`w-24 bg-[#0a0f1d] border rounded px-2 py-1 text-xs font-mono text-right focus:outline-none transition-colors ${
                              roundNum < 0 
                                ? 'text-rose-400 border-rose-500/50 focus:border-rose-400' 
                                : roundNum > 0 
                                ? 'text-emerald-400 border-emerald-500/50 focus:border-emerald-400' 
                                : 'text-slate-200 border-slate-700 focus:border-indigo-500'
                            }`}
                          />
                          {invRoundingAdjustment && (
                            <button
                              type="button"
                              onClick={() => setInvRoundingAdjustment('')}
                              className="ml-1 text-slate-500 hover:text-rose-400 text-xs px-1"
                              title="Sıfırla"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        {roundNum !== 0 && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                            roundNum < 0 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {roundNum > 0 ? `+${roundNum.toFixed(2)}` : roundNum.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 3. Fatura Genel Toplamı (KDV Dahil) */}
                    <div className="flex flex-col border-l border-slate-800 pl-4 px-2">
                      <span className="text-slate-500 text-[9px] uppercase font-bold tracking-wider">Fatura Genel Toplamı</span>
                      <span className="text-amber-400 font-bold font-mono text-lg">{formatMoney(finalSum, invCurrency).formatted}</span>
                    </div>

                    {/* 4. Cariye İşlenecek Bakiye (₺) */}
                    {invCurrency !== 'TRY' && (
                      <div className="flex flex-col border-l border-slate-800 pl-4 px-2">
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span className="text-slate-500 text-[9px] uppercase font-bold tracking-wider">Cariye İşlenecek Bakiye (₺)</span>
                          <span className="text-[9px] text-indigo-400 font-semibold" title="Tedarikçiye ödediğiniz net tutarı yazıp kuru tam denk getirebilirsiniz">🎯 Hedef Net ₺</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-200 font-bold font-mono text-lg">
                            {formatMoney(finalSum * (parseFloat(invExchangeRate) || 1), 'TRY').formatted}
                          </span>
                          <div className="flex items-center gap-1 bg-[#0a0f1d] border border-indigo-500/40 rounded px-1.5 py-0.5">
                            <input
                              type="text"
                              placeholder="Örn: 2230"
                              value={invTargetTry}
                              onChange={(e) => setInvTargetTry(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault()
                                  applyTargetTryRate()
                                }
                              }}
                              className="w-20 bg-transparent text-xs font-mono text-indigo-300 placeholder:text-slate-600 focus:outline-none text-right"
                              title="Tedarikçiye ödediğiniz net TL tutarını girin (Örn: 2230)"
                            />
                            <button
                              type="button"
                              onClick={applyTargetTryRate}
                              className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-2 py-0.5 rounded transition-colors active:scale-95"
                              title="Bu TL tutarını tam tutturacak kuru otomatik hesaplar"
                            >
                              Kuru Ayarla
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={closeInvoiceModal} className="px-5 py-2 rounded-lg text-slate-400 hover:bg-slate-800 text-xs font-bold transition-colors">İptal</button>
                    <button type="button" onClick={handleSaveDetailedInvoice} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-lg shadow-indigo-900/20">{editingTxId ? 'Faturayı Güncelle' : 'Faturayı Kaydet'}</button>
                  </div>
                </div>
              )
            })()}
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
                    {editingId ? 'Devir / Açılış Bakiyesini Düzenle' : 'Devir / Açılış Bakiyesi'}
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
                      placeholder="0.00 (Fazla ödeme için: -5000)" 
                      value={openingBalance} 
                      onChange={(e) => setOpeningBalance(e.target.value)} 
                      className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-1.5 text-white focus:outline-none focus:border-amber-500 font-mono text-right transition-colors" 
                    />
                  </div>
                </div>

                {/* Dinamik Bilgilendirme Rozeti (Pozitif vs Negatif) */}
                {openingBalance && !isNaN(parseFloat(openingBalance)) && parseFloat(openingBalance) !== 0 && (
                  <div className={`mt-2 py-1.5 px-3 rounded border text-[10.5px] flex items-center justify-between ${
                    parseFloat(openingBalance) < 0 
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' 
                      : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                  }`}>
                    <span className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${parseFloat(openingBalance) < 0 ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`}></span>
                      <span>
                        {parseFloat(openingBalance) < 0 ? (
                          <>Fazla Peşin Ödeme / Avans: <strong>{formatMoney(Math.abs(parseFloat(openingBalance)), openingCurrency).formatted}</strong> alacaklı olarak başlanacak.</>
                        ) : (
                          <>Tedarikçiye Devir Borcu: <strong>{formatMoney(parseFloat(openingBalance), openingCurrency).formatted}</strong> borçlu olarak başlanacak.</>
                        )}
                      </span>
                    </span>
                    <span className="font-mono text-[9px] opacity-80 px-1.5 py-0.5 rounded bg-black/40">
                      {parseFloat(openingBalance) < 0 ? 'Ödeme (-)' : 'Borç (+)'}
                    </span>
                  </div>
                )}

                {/* Döviz Çevrim Özeti / Bilgi Kartı */}
                {openingCurrency !== 'TRY' && openingBalance && !isNaN(parseFloat(openingBalance)) && parseFloat(openingBalance) !== 0 && (
                  <div className="mt-1.5 py-1.5 px-3 rounded bg-indigo-950/20 border border-indigo-500/20 flex items-center justify-between text-[11px] text-indigo-300">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                      <span>Döviz: <strong>{openingCurrency === 'USD' ? '$' : '€'}{Math.abs(Number(openingBalance)).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> × Kur: <strong>{openingExchangeRate}</strong></span>
                    </span>
                    <span className="font-mono font-bold text-amber-400">
                      ≈ {(Math.abs(Number(openingBalance)) * (parseFloat(openingExchangeRate) || 1)).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺ {parseFloat(openingBalance) < 0 ? 'Alacak' : 'Borç'}
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
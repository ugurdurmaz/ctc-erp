'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/lib/utils'
import toast, { Toaster } from 'react-hot-toast'
import { Users, Plus, Trash2, X, Edit3, Search, Phone, Mail, FileText, MapPin, ListPlus, CheckSquare, Square, ScrollText, Landmark, Wallet, CreditCard, Building, Home, Globe, AlertTriangle, RefreshCw, ArrowUpRight, MessageSquare, Copy, Download, ExternalLink, Check } from 'lucide-react'

type Company = { id: string; name: string; is_personal: boolean }
type Warehouse = { id: string; name: string }

type Customer = {
  id: string; name: string; contact_name: string; phone: string;
  email: string; tax_office: string; tax_id: string; address: string;
  balance: number; currency: string;
}

type ConsentCustomer = {
  id: string;
  name: string;
  phone: string;
  ticketNo: string;
  brandModel?: string;
  date: string;
}

type InvoiceLine = {
  id: string; 
  itemType: 'product' | 'service'; 
  name: string; quantity: string; unitPrice: string;
  vatRate: string; addToStock: boolean; warehouseId: string;
  targetStockId?: string; stockTxId?: string;
  selectedStockId?: string; 
  selectedServiceId?: string; 
}

type CustomerTransaction = {
  id: string; customer_id: string; company_id?: string | null; tx_date: string; description: string;
  tx_type: 'debt' | 'payment'; amount: number; is_detailed?: boolean;
  invoice_lines?: InvoiceLine[]; payment_source_type?: string;
  payment_source_id?: string; currency?: string; exchange_rate?: number;
  running_balance?: number; company?: { name: string; is_personal: boolean }
}

type BankAccount = { id: string; bank_name: string; balance: number; currency: string }
type CashRegister = { id: string; name: string; balance: number; currency: string }
type StockItem = { id: string; name: string; unit_price: number; vat_rate: number; warehouse_id: string; currency: string; quantity: number }
type ServiceItem = { id: string; name: string; unit_price: number; vat_rate: number; currency: string; company_id: string | null } 

function getLocalTodayISO() {
  const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
function formatDateTR(dateStr: string) {
  if (!dateStr) return ''; const parts = dateStr.split('-'); if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`; return dateStr
}

async function logActivity(module: string, action: string, description: string, recordId: string | null = null, amount: number = 0, currency: string = '', oldData: any = null, newData: any = null, companyId: string | null = null) {
  try {
    await supabase.from('audit_logs').insert([{
      module, action, description, record_id: recordId, amount, currency, old_data: oldData, new_data: newData, company_id: companyId
    }])
  } catch (err) {
    console.error("Log kaydı atılamadı:", err)
  }
}

export default function CustomersPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<CustomerTransaction[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [stocks, setStocks] = useState<StockItem[]>([]) 
  const [services, setServices] = useState<ServiceItem[]>([]) 
  const [searchTerm, setSearchTerm] = useState('')

  const [banks, setBanks] = useState<BankAccount[]>([])
  const [cashes, setCashes] = useState<CashRegister[]>([])
  const [rates, setRates] = useState<{ USD: number; EUR: number }>({ USD: 34.25, EUR: 37.80 })

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState(''); const [email, setEmail] = useState('')
  const [taxOffice, setTaxOffice] = useState(''); const [taxId, setTaxId] = useState(''); const [address, setAddress] = useState('')
  const [openingBalance, setOpeningBalance] = useState('') 
  const [openingCompanyId, setOpeningCompanyId] = useState('common') 

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
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null) 

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string; confirmText: string; cancelText: string; isDanger: boolean; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', confirmText: '', cancelText: '', isDanger: false, onConfirm: () => {} })

  const [consentCustomers, setConsentCustomers] = useState<ConsentCustomer[]>([])
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false)
  const [consentSearchTerm, setConsentSearchTerm] = useState('')
  const [hasCopiedNumbers, setHasCopiedNumbers] = useState(false)

  useEffect(() => {
    fetchExchangeRates(); fetchCompanies(); fetchCustomers(); fetchWarehouses(); fetchPaymentSources(); fetchStocks(); fetchServices(); fetchConsentCustomers()
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('sms') === 'open') {
        setIsConsentModalOpen(true)
      }
    }
  }, [])

  useEffect(() => {
    if (selectedCustomerId) { fetchTransactions(selectedCustomerId); cancelEditTx() } 
    else setTransactions([])
  }, [selectedCustomerId])

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
    setBanks(bData || []); setCashes(cData || [])
  }

  async function fetchCustomers() {
    const { data } = await supabase.from('customers').select('*').order('name', { ascending: true })
    setCustomers(data || [])
    if (data && data.length > 0 && !selectedCustomerId) setSelectedCustomerId(data[0].id)
  }

  async function fetchWarehouses() {
    const { data } = await supabase.from('warehouses').select('id, name').order('created_at', { ascending: true }); setWarehouses(data || [])
  }

  async function fetchStocks() {
    const { data } = await supabase.from('stocks').select('id, name, unit_price, vat_rate, warehouse_id, currency, quantity').order('name', { ascending: true }); setStocks(data || [])
  }
  
  async function fetchServices() {
    const { data } = await supabase.from('services').select('*').order('name', { ascending: true }); setServices(data || [])
  }

  async function fetchTransactions(custId: string) {
    const { data } = await supabase.from('customer_transactions').select('*, company:companies(name, is_personal)').eq('customer_id', custId).order('tx_date', { ascending: false }).order('created_at', { ascending: false })
    setTransactions(data || [])
  }

  async function fetchConsentCustomers() {
    try {
      const { data, error } = await supabase
        .from('technical_service_tickets')
        .select('id, ticket_no, customer_name, customer_phone, marketing_consent, brand_model, received_at, created_at')
        .eq('marketing_consent', true)
        .order('created_at', { ascending: false })

      if (error) {
        console.warn("SMS izinli müşteriler alınamadı:", error.message)
        return
      }

      if (data) {
        const seenPhones = new Set<string>()
        const uniqueList: ConsentCustomer[] = []

        for (const t of data) {
          const rawPhone = (t.customer_phone || '').trim()
          const digits = rawPhone.replace(/\D/g, '')
          const key = digits.length >= 10 ? digits.slice(-10) : (digits || (t.customer_name || '').toLowerCase().trim())
          if (key && !seenPhones.has(key)) {
            seenPhones.add(key)
            uniqueList.push({
              id: t.id,
              name: t.customer_name?.trim() || 'İsimsiz Müşteri',
              phone: rawPhone,
              ticketNo: t.ticket_no || '',
              brandModel: t.brand_model || '',
              date: t.received_at || t.created_at || ''
            })
          }
        }
        setConsentCustomers(uniqueList)
      }
    } catch (err) {
      console.error("fetchConsentCustomers error:", err)
    }
  }

  function isCustomerConsent(phoneStr?: string): boolean {
    if (!phoneStr) return false
    const cleanDigits = phoneStr.replace(/\D/g, '')
    if (cleanDigits.length < 7) return false
    const suffix = cleanDigits.slice(-10)
    return consentCustomers.some(c => {
      const cDigits = c.phone.replace(/\D/g, '')
      return cDigits.endsWith(suffix) || suffix.endsWith(cDigits.slice(-10))
    })
  }

  function handleCopyConsentNumbers() {
    const listToCopy = filteredConsentCustomers.length > 0 ? filteredConsentCustomers : consentCustomers
    const numbers = listToCopy
      .map(c => c.phone)
      .filter(Boolean)
      .join(', ')

    if (!numbers) {
      toast.error('Kopyalanacak telefon numarası bulunamadı.')
      return
    }

    navigator.clipboard.writeText(numbers)
    setHasCopiedNumbers(true)
    toast.success(`${listToCopy.length} adet telefon numarası panoya kopyalandı!`)
    setTimeout(() => setHasCopiedNumbers(false), 2500)
  }

  function handleDownloadConsentCSV() {
    const listToExport = filteredConsentCustomers.length > 0 ? filteredConsentCustomers : consentCustomers
    if (listToExport.length === 0) {
      toast.error('Dışa aktarılacak kayıt bulunamadı.')
      return
    }

    const headers = ['Müşteri Adı', 'Telefon', 'Son Fiş No', 'Cihaz Modeli', 'İzin Tarihi']
    const rows = listToExport.map(c => [
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${(c.phone || '').replace(/"/g, '""')}"`,
      `"${(c.ticketNo || '').replace(/"/g, '""')}"`,
      `"${(c.brandModel || '').replace(/"/g, '""')}"`,
      `"${formatDateTR(c.date?.split('T')[0] || '')}"`
    ])

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `sms_izinli_musteriler_${getLocalTodayISO()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Excel / CSV dosyası başarıyla indirildi.')
  }

  // =========================================================================================
  // --- MUTLAK HESAPLAMA MOTORLARI (ABSOLUTE LEDGER RECALCULATORS) ---
  // =========================================================================================
  async function recalculateAbsoluteCustomerBalance(customerId: string) {
    const { data: txs } = await supabase.from('customer_transactions').select('amount, tx_type, exchange_rate').eq('customer_id', customerId)
    let absoluteBal = 0
    txs?.forEach(t => {
      const tryEquivalent = Number(t.amount) * (Number(t.exchange_rate) || 1)
      if (t.tx_type === 'debt') absoluteBal += tryEquivalent
      else absoluteBal -= tryEquivalent
    })
    await supabase.from('customers').update({ balance: absoluteBal }).eq('id', customerId)
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

  async function recalculateAbsoluteStock(stockId: string) {
    const { data: txs } = await supabase.from('stock_transactions').select('quantity, tx_type').eq('stock_id', stockId)
    let absoluteQty = 0
    txs?.forEach(t => { absoluteQty += t.tx_type === 'in' ? Number(t.quantity) : -Number(t.quantity) })
    await supabase.from('stocks').update({ quantity: absoluteQty }).eq('id', stockId)
  }
  // =========================================================================================


  function openAddModal() {
    setEditingId(null); setCustomerName(''); setContactName(''); setPhone(''); setEmail(''); setTaxOffice(''); setTaxId(''); setAddress(''); setOpeningBalance(''); setOpeningCompanyId('common'); setIsModalOpen(true)
  }

  async function openEditModal(cust: Customer, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingId(cust.id); setCustomerName(cust.name); setContactName(cust.contact_name || ''); setPhone(cust.phone || ''); setEmail(cust.email || ''); setTaxOffice(cust.tax_office || ''); setTaxId(cust.tax_id || ''); setAddress(cust.address || ''); setIsModalOpen(true)

    const { data: txs } = await supabase.from('customer_transactions')
       .select('amount, company_id').eq('customer_id', cust.id).eq('description', 'Açılış Bakiyesi / Devir').limit(1);
    
    if (txs && txs.length > 0) {
      setOpeningBalance(txs[0].amount.toString());
      setOpeningCompanyId(txs[0].company_id || 'common');
    } else {
      setOpeningBalance('0');
      setOpeningCompanyId('common');
    }
  }

  async function handleSaveCustomer(e: React.FormEvent) {
    e.preventDefault(); if (!customerName) return
    const initialBalance = parseFloat(openingBalance) || 0
    const initialCompId = openingCompanyId === 'common' ? null : openingCompanyId
    const payload = { name: customerName, contact_name: contactName, phone, email, tax_office: taxOffice, tax_id: taxId, address, currency: 'TRY' }
    
    try {
      if (editingId) {
        const oldCustomer = customers.find(c => c.id === editingId)
        
        const { data: oldTxs } = await supabase.from('customer_transactions')
           .select('*').eq('customer_id', editingId).eq('description', 'Açılış Bakiyesi / Devir').limit(1);
        
        const oldTx = oldTxs && oldTxs.length > 0 ? oldTxs[0] : null;

        if (oldTx) {
           const compChanged = oldTx.company_id !== initialCompId;
           if ((initialBalance - oldTx.amount) !== 0 || compChanged) {
              if (initialBalance === 0) await supabase.from('customer_transactions').delete().eq('id', oldTx.id);
              else await supabase.from('customer_transactions').update({ amount: initialBalance, company_id: initialCompId }).eq('id', oldTx.id);
           }
        } else if (initialBalance > 0) {
           const txPayload = { customer_id: editingId, company_id: initialCompId, tx_date: todayISO, description: 'Açılış Bakiyesi / Devir', tx_type: 'debt', amount: initialBalance, currency: 'TRY', exchange_rate: 1 }
           await supabase.from('customer_transactions').insert([txPayload]);
        }

        const { error } = await supabase.from('customers').update(payload).eq('id', editingId)
        if (error) throw error
        
        await recalculateAbsoluteCustomerBalance(editingId); // Mutlak hesaplama

        await logActivity('customer', 'UPDATE', `Müşteri kartı güncellendi: ${customerName}`, editingId, 0, 'TRY', oldCustomer, payload)
        toast.success('Müşteri kartı güncellendi.')

        if (selectedCustomerId === editingId) fetchTransactions(editingId);

      } else {
        const { data, error } = await supabase.from('customers').insert([{ ...payload, balance: 0 }]).select().single()
        if (error) throw error
        
        await logActivity('customer', 'INSERT', `Yeni müşteri açıldı: ${customerName}`, data.id, 0, 'TRY', null, data)
        
        if (initialBalance > 0) {
           const txPayload = { customer_id: data.id, company_id: initialCompId, tx_date: todayISO, description: 'Açılış Bakiyesi / Devir', tx_type: 'debt', amount: initialBalance, currency: 'TRY', exchange_rate: 1 }
           const { data: txData, error: txErr } = await supabase.from('customer_transactions').insert([txPayload]).select().single()
           if (!txErr && txData) {
             await logActivity('customer_tx', 'INSERT', `Açılış Bakiyesi (Müşteri): ${customerName}`, txData.id, initialBalance, 'TRY', null, txData, initialCompId)
           }
        }

        await recalculateAbsoluteCustomerBalance(data.id); // Mutlak hesaplama
        toast.success('Yeni müşteri eklendi.')
      }
      setIsModalOpen(false); fetchCustomers()
    } catch (err: any) { toast.error('Müşteri kaydedilemedi: ' + err.message) }
  }

  function handleDeleteCustomer(id: string, e: React.MouseEvent) {
    e.stopPropagation(); 
    setConfirmDialog({
      isOpen: true, title: 'Müşteriyi Sil',
      message: 'Bu müşteriyi silmek istediğinize emin misiniz? Bütün hesap hareketleri kalıcı olarak silinecektir.',
      confirmText: 'Evet, Sil', cancelText: 'Vazgeç', isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        try {
          const custToDelete = customers.find(c => c.id === id)
          await supabase.from('customers').delete().eq('id', id); 
          await logActivity('customer', 'DELETE', `Müşteri silindi: ${custToDelete?.name}`, id, custToDelete?.balance, 'TRY', custToDelete, null)
          toast.success('Müşteri başarıyla silindi.')
          if (selectedCustomerId === id) setSelectedCustomerId(null); 
          fetchCustomers()
        } catch (err: any) { toast.error('Silme başarısız: ' + err.message) }
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

  // --- ARTIK BAKİYE DÜŞMEK YERİNE SADECE HAREKET İNSERT/DELETE YAPAN YARDIMCI ---
  async function modifyPaymentSourceBalance(sourceType: string, sourceId: string, amount: number, txCurr: string, customRate: number, action: 'payment' | 'reverse', relatedTxId: string, dateStr: string, custName: string, desc: string, compId?: string | null) {
    let table = ''; let txTable = ''; let txIdField = ''
    if (sourceType === 'cash') { table = 'cash_registers'; txTable = 'cash_transactions'; txIdField = 'cash_register_id' }
    else if (sourceType === 'bank') { table = 'bank_accounts'; txTable = 'bank_transactions'; txIdField = 'bank_account_id' }
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
          [txIdField]: sourceId, company_id: compId, tx_date: dateStr, description: `Müşteri Tahsilatı (${custName}) - ${desc}`,
          tx_type: 'in', amount: convertedAmount, currency: accCurr, exchange_rate: 1, is_transfer: false, transfer_id: `CUST-${relatedTxId}`
        }
        if (sourceType === 'bank') payload.status = 'completed' // Banka için anında tamamlandı etiketi vurulmalı
        await supabase.from(txTable).insert([payload])
      } else if (action === 'reverse') {
        await supabase.from(txTable).delete().eq('transfer_id', `CUST-${relatedTxId}`)
      }
    }

    // İlgili modülün mutlak hesabını tetikleyelim
    if (sourceType === 'cash') await recalculateAbsoluteCashBalance(sourceId)
    if (sourceType === 'bank') await recalculateAbsoluteBankBalance(sourceId)
  }

  function cancelEditTx() {
    setEditingTxId(null); setTxDesc(''); setTxAmount(''); setTxDate(getLocalTodayISO()); setTxType('debt'); setPaymentSource(''); setTxCurrency('TRY'); setTxExchangeRate('1'); setTxCompanyId('common')
  }

  function handleEditTx(t: CustomerTransaction) {
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
    if (!amountNum || !selectedCustomerId || !txCompanyId) return
    const currentCustomer = customers.find(c => c.id === selectedCustomerId); if (!currentCustomer) return
    const finalCompId = txCompanyId === 'common' ? null : txCompanyId

    if (txType === 'payment' && !paymentSource) return toast.error("Lütfen tahsilatın gireceği kaynağı seçin.")

    try {
      let pType = null; let pId = null
      if (txType === 'payment' && paymentSource) { const parts = paymentSource.split('|'); pType = parts[0]; pId = parts[1] }

      if (editingTxId) {
        const oldTx = transactions.find(t => t.id === editingTxId); if (!oldTx) return
        const oldRate = oldTx.exchange_rate || 1
        
        if (oldTx.tx_type === 'payment' && oldTx.payment_source_type && oldTx.payment_source_id) {
          await modifyPaymentSourceBalance(oldTx.payment_source_type, oldTx.payment_source_id, oldTx.amount, oldTx.currency || 'TRY', oldRate, 'reverse', oldTx.id, oldTx.tx_date, currentCustomer.name, oldTx.description, oldTx.company_id)
        }

        const payload = { company_id: finalCompId, tx_date: txDate, description: txDesc, tx_type: txType, amount: amountNum, currency: txCurrency, exchange_rate: rateNum, payment_source_type: pType, payment_source_id: pId }
        const { error: txErr } = await supabase.from('customer_transactions').update(payload).eq('id', editingTxId)
        if (txErr) throw txErr

        if (txType === 'payment' && pType && pId) {
          await modifyPaymentSourceBalance(pType, pId, amountNum, txCurrency, rateNum, 'payment', editingTxId, txDate, currentCustomer.name, txDesc, finalCompId)
        }
        
        await logActivity('customer_tx', 'UPDATE', `Cari Hareket Güncellendi: ${txDesc}`, editingTxId, amountNum, txCurrency, oldTx, payload, finalCompId)
        toast.success('Cari hareket güncellendi.')

      } else {
        const payload = { customer_id: selectedCustomerId, company_id: finalCompId, tx_date: txDate, description: txDesc, tx_type: txType, amount: amountNum, is_detailed: false, currency: txCurrency, exchange_rate: rateNum, payment_source_type: pType, payment_source_id: pId }
        const { data: newTxData, error: txErr } = await supabase.from('customer_transactions').insert([payload]).select().single()
        if (txErr) throw txErr

        const newTxId = newTxData.id
        if (txType === 'payment' && pType && pId && newTxId) {
          await modifyPaymentSourceBalance(pType, pId, amountNum, txCurrency, rateNum, 'payment', newTxId, txDate, currentCustomer.name, txDesc, finalCompId)
        }
        
        await logActivity('customer_tx', 'INSERT', `Cari Hareket: ${txDesc} (${txType === 'debt' ? 'Satış' : 'Tahsilat'})`, newTxId, amountNum, txCurrency, null, newTxData, finalCompId)
        toast.success(txType === 'debt' ? 'Satış / Borçlandırma kaydedildi.' : 'Tahsilat başarıyla eklendi.')
      }

      await recalculateAbsoluteCustomerBalance(selectedCustomerId); // Cariyi temize çek
      cancelEditTx(); fetchTransactions(selectedCustomerId); fetchCustomers(); fetchPaymentSources() 
    } catch (err: any) { toast.error('İşlem kaydedilemedi: ' + err.message) }
  }

  function handleDeleteTransaction(txId: string) {
    setConfirmDialog({
      isOpen: true, title: 'Hareketi Sil',
      message: 'Bu cari hareketi silmek istediğinize emin misiniz? Bakiyeler ve varsa ilgili stok işlemleri geri alınacaktır.',
      confirmText: 'Evet, Sil', cancelText: 'Vazgeç', isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        try {
          const oldTx = transactions.find(t => t.id === txId); if (!oldTx) return
          const currentCustomer = customers.find(c => c.id === selectedCustomerId)
          let oldDataPayload: any = { deleted_tx: oldTx, related_stock_txs: [] }
          
          const affectedStocks = new Set<string>();

          if (oldTx.is_detailed && oldTx.invoice_lines) {
            for (const line of oldTx.invoice_lines) {
              if (line.itemType === 'product' && line.addToStock && line.stockTxId && line.targetStockId) {
                await supabase.from('stock_transactions').delete().eq('id', line.stockTxId);
                affectedStocks.add(line.targetStockId);
                oldDataPayload.related_stock_txs.push({ stockId: line.targetStockId, qty_restored: parseFloat(line.quantity) })
              }
            }
          }

          const oldRate = oldTx.exchange_rate || 1

          if (oldTx.tx_type === 'payment' && oldTx.payment_source_type && oldTx.payment_source_id) {
            await modifyPaymentSourceBalance(oldTx.payment_source_type, oldTx.payment_source_id, oldTx.amount, oldTx.currency || 'TRY', oldRate, 'reverse', oldTx.id, oldTx.tx_date, currentCustomer?.name || '', oldTx.description, oldTx.company_id)
          }

          await supabase.from('customer_transactions').delete().eq('id', txId)
          
          // Etkilenen Stokları Temize Çek
          for (const sId of Array.from(affectedStocks)) { await recalculateAbsoluteStock(sId) }
          
          // Müşteriyi Temize Çek
          if (selectedCustomerId) await recalculateAbsoluteCustomerBalance(selectedCustomerId);
          
          await logActivity(
            oldTx.is_detailed ? 'invoice' : 'customer_tx', 
            'DELETE', 
            oldTx.is_detailed ? `Fatura İptali: ${oldTx.description}` : `Cari Hareket İptali: ${oldTx.description}`, 
            txId, oldTx.amount, oldTx.currency || 'TRY', 
            { ...oldDataPayload }, 
            null, oldTx.company_id
          )

          toast.success('Hareket silindi ve bakiyeler güncellendi.')
          fetchTransactions(selectedCustomerId!); fetchCustomers(); fetchPaymentSources(); fetchStocks()
        } catch (err: any) { toast.error("Silme işleminde hata oluştu: " + err.message) }
      }
    })
  }

  function openInvoiceModal() { 
    setEditingTxId(null); setInvDate(getLocalTodayISO()); setInvDesc(''); setInvCurrency('TRY'); setInvExchangeRate('1'); setInvCompanyId('common'); 
    setInvLines([{ id: Date.now().toString(), itemType: 'product', name: '', quantity: '1', unitPrice: '', vatRate: '20', addToStock: false, warehouseId: warehouses[0]?.id || '', selectedStockId: undefined }]); 
    setActiveDropdown(null); setIsInvoiceModalOpen(true) 
  }
  
  function closeInvoiceModal() { setIsInvoiceModalOpen(false); setActiveDropdown(null); if (editingTxId && transactions.find(t => t.id === editingTxId)?.is_detailed) cancelEditTx() }
  
  function addInvoiceLine() { 
    setInvLines([...invLines, { id: Date.now().toString(), itemType: 'product', name: '', quantity: '1', unitPrice: '', vatRate: '20', addToStock: false, warehouseId: warehouses[0]?.id || '', selectedStockId: undefined }]) 
  }
  
  function removeInvoiceLine(id: string) { setInvLines(invLines.filter(l => l.id !== id)) }
  
  function updateInvoiceLine(id: string, field: keyof InvoiceLine, value: any) { 
    setInvLines(prev => prev.map(l => {
      if (l.id === id) {
        if (field === 'itemType' && value === 'service') {
          return { ...l, [field]: value, addToStock: false, warehouseId: '', selectedStockId: undefined, selectedServiceId: undefined }
        }
        return { ...l, [field]: value }
      }
      return l
    })) 
  }

  function selectItemForLine(lineId: string, item: any, type: 'product'|'service') {
    const convertedPrice = convertCurrency(item.unit_price, item.currency, invCurrency)
    setInvLines(prev => prev.map(l => {
      if (l.id === lineId) { 
        if (type === 'product') {
          return { ...l, itemType: 'product', name: item.name, unitPrice: convertedPrice.toFixed(2), vatRate: item.vat_rate?.toString() || '0', warehouseId: item.warehouse_id, addToStock: true, selectedStockId: item.id } 
        } else {
          return { ...l, itemType: 'service', name: item.name, unitPrice: convertedPrice.toFixed(2), vatRate: item.vat_rate?.toString() || '0', addToStock: false, selectedServiceId: item.id } 
        }
      }
      return l
    }))
    setActiveDropdown(null) 
  }

  const calculateInvoiceTotal = () => { return invLines.reduce((acc, line) => { const q = parseFloat(line.quantity) || 0; const p = parseFloat(line.unitPrice) || 0; const v = parseFloat(line.vatRate) || 0; return acc + (q * p * (1 + v / 100)) }, 0) }

  async function handleSaveDetailedInvoice(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCustomerId || invLines.length === 0 || !invCompanyId) return
    const currentCustomer = customers.find(c => c.id === selectedCustomerId); if (!currentCustomer) return
    const finalCompId = invCompanyId === 'common' ? null : invCompanyId

    const totalGross = calculateInvoiceTotal(); if (totalGross <= 0) return toast.error('Fatura toplamı 0 olamaz.')
    const rateNum = invCurrency === 'TRY' ? 1 : (parseFloat(invExchangeRate) || 1)

    try {
      const affectedStocks = new Set<string>();

      if (editingTxId) {
        const oldTx = transactions.find(t => t.id === editingTxId); if (!oldTx) return
        
        if (oldTx.is_detailed && oldTx.invoice_lines) {
          for (const line of oldTx.invoice_lines) {
            if (line.itemType === 'product' && line.addToStock && line.stockTxId && line.targetStockId) {
              await supabase.from('stock_transactions').delete().eq('id', line.stockTxId)
              affectedStocks.add(line.targetStockId)
            }
          }
        }
      }

      const processedLines = [...invLines]
      for (let i = 0; i < processedLines.length; i++) {
        const line = processedLines[i]
        
        if (line.itemType === 'product' && line.addToStock && line.name) {
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
            const { data: stTx } = await supabase.from('stock_transactions').insert([{ stock_id: targetStockId, company_id: finalCompId, tx_date: invDate, description: `${invDesc || 'Fatura'} / Satış`, tx_type: 'out', quantity: q, unit_price: p, currency: invCurrency, vat_rate: v }]).select()
            processedLines[i].targetStockId = targetStockId
            if (stTx && stTx.length > 0) processedLines[i].stockTxId = stTx[0].id
          }
        }
      }

      let finalTxId = editingTxId
      if (editingTxId) {
        const payload = { company_id: finalCompId, tx_date: invDate, description: invDesc || 'Detaylı Satış Faturası', amount: totalGross, currency: invCurrency, exchange_rate: rateNum, invoice_lines: processedLines }
        const { error: updErr } = await supabase.from('customer_transactions').update(payload).eq('id', editingTxId)
        if (updErr) throw updErr
        
        await logActivity('invoice', 'UPDATE', `Detaylı Fatura Güncellendi: ${invDesc}`, editingTxId, totalGross, invCurrency, transactions.find(t => t.id === editingTxId), payload, finalCompId)
      } else {
        const payload = { customer_id: selectedCustomerId, company_id: finalCompId, tx_date: invDate, description: invDesc || 'Detaylı Satış Faturası', tx_type: 'debt', amount: totalGross, currency: invCurrency, exchange_rate: rateNum, is_detailed: true, invoice_lines: processedLines }
        const { data: insData, error: insErr } = await supabase.from('customer_transactions').insert([payload]).select().single()
        if (insErr) throw insErr
        finalTxId = insData.id
        
        await logActivity('invoice', 'INSERT', `Yeni Detaylı Fatura: ${invDesc}`, finalTxId, totalGross, invCurrency, null, insData, finalCompId)
      }

      // Stokları Mutlak Olarak Temize Çek
      for (const sId of Array.from(affectedStocks)) { await recalculateAbsoluteStock(sId) }
      // Cariyi Mutlak Olarak Temize Çek
      await recalculateAbsoluteCustomerBalance(selectedCustomerId)

      toast.success(editingTxId ? 'Detaylı fatura başarıyla güncellendi.' : 'Detaylı satış faturası kaydedildi ve stoklar güncellendi.')
      closeInvoiceModal(); fetchTransactions(selectedCustomerId); fetchCustomers(); fetchStocks()
    } catch (err: any) { toast.error("Hata oluştu: " + err.message) }
  }

  const getPaymentSourceName = (type: string, id: string) => {
    if (type === 'cash') return cashes.find(c => c.id === id)?.name || 'Kasa'
    if (type === 'bank') return banks.find(b => b.id === id)?.bank_name || 'Banka'
    return ''
  }

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.contact_name && c.contact_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (c.phone && c.phone.includes(searchTerm))
  )

  const filteredConsentCustomers = consentCustomers.filter(c => {
    if (!consentSearchTerm) return true
    const term = consentSearchTerm.toLowerCase().trim()
    return (
      c.name.toLowerCase().includes(term) ||
      c.phone.toLowerCase().includes(term) ||
      c.ticketNo.toLowerCase().includes(term) ||
      (c.brandModel && c.brandModel.toLowerCase().includes(term))
    )
  })

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId)
  const isEditingDetailedTx = editingTxId && transactions.find(t => t.id === editingTxId)?.is_detailed

  let currentRunningBalance = selectedCustomer ? selectedCustomer.balance : 0
  const displayTransactions = transactions.map((t) => {
    const rowBalance = currentRunningBalance
    const tryEquivalent = t.amount * (t.exchange_rate || 1)
    if (t.tx_type === 'debt') currentRunningBalance -= tryEquivalent
    else currentRunningBalance += tryEquivalent
    return { ...t, running_balance: rowBalance }
  })

  const totalDebtTry = customers.reduce((acc, c) => acc + c.balance, 0)
  const totalDebtUsd = totalDebtTry / (rates.USD || 1)
  const totalDebtEur = totalDebtTry / (rates.EUR || 1)

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] relative">
      {/* TOASTER KONTEYNER Z-INDEX DEĞERİ MAX VE POZİSYONU BOTTOM-RIGHT YAPILDI */}
      <Toaster position="bottom-right" containerStyle={{ zIndex: 99999999 }} toastOptions={{ style: { background: '#0f172a', color: '#fff', border: '1px solid #1e293b', fontSize: '12px' } }} />
      
      <div style={{ animation: 'fadeInDown 0.4s both' }} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0d1322] border border-slate-800/80 p-4 rounded-xl shadow-md shrink-0 mb-4 transition-colors">
        <div className="flex items-center gap-3 text-white">
          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg"><Users size={24} /></div>
          <div><h2 className="font-bold text-lg leading-none">Müşteriler / Alacaklar</h2><p className="text-[10px] text-slate-400 mt-1">Satış yaptığınız kişi/kurumlar ve tahsilat takibi</p></div>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <button
            type="button"
            onClick={() => setIsConsentModalOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-sans font-bold transition-all active:scale-95 shadow-sm hover:shadow-emerald-500/10 cursor-pointer"
            title="Teknik serviste SMS ve pazarlama onayı veren müşteriler"
          >
            <MessageSquare size={15} className="text-emerald-400" />
            <span>SMS İzinleri</span>
            <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold">
              {consentCustomers.length}
            </span>
          </button>

          <div className="flex flex-col items-end">
            <span className="text-[9px] text-slate-400 font-sans tracking-wide">TOPLAM MÜŞTERİ ALACAĞI (₺)</span>
            <div className="flex gap-3 mt-0.5 font-bold">
              {totalDebtTry > 0 && <span className="text-blue-400">{formatMoney(totalDebtTry, 'TRY').formatted}</span>}
              {totalDebtTry > 0 && <span className="text-emerald-400 font-normal">~ {formatMoney(totalDebtUsd, 'USD').formatted}</span>}
              {totalDebtTry > 0 && <span className="text-indigo-400 font-normal">~ {formatMoney(totalDebtEur, 'EUR').formatted}</span>}
              {totalDebtTry <= 0 && <span className="text-slate-500">0,00₺</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        <div style={{ animation: 'fadeInUp 0.4s both 0.1s' }} className="w-full lg:w-[400px] bg-[#0d1322] border border-slate-800/80 rounded-xl flex flex-col shrink-0 shadow-lg">
          <div className="p-3 border-b border-slate-800/80 bg-[#0a0f1d] rounded-t-xl flex flex-col gap-3 shrink-0">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-300">Müşteri Listesi ({filteredCustomers.length})</span>
              <div className="flex items-center gap-1.5">
                <button 
                  type="button"
                  onClick={() => setIsConsentModalOpen(true)}
                  className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
                  title="SMS ve Kampanya İzni Veren Müşteriler Listesi"
                >
                  <MessageSquare size={13} /> SMS ({consentCustomers.length})
                </button>
                <button onClick={openAddModal} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95">
                  <Plus size={14} /> Yeni Müşteri
                </button>
              </div>
            </div>
            <div className="relative"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" /><input type="text" placeholder="Firma, kişi veya yetkili ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors" /></div>
          </div>
          <div className="overflow-y-auto flex-1 custom-scrollbar p-2 space-y-1.5">
            {filteredCustomers.length === 0 ? (
               <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-700/60 rounded-xl bg-slate-800/10 text-slate-500 m-2 shadow-inner">
                 <Users size={32} className="mb-3 opacity-70 text-blue-400 animate-bounce" />
                 <p className="text-[11px] font-bold text-slate-400">Kayıtlı müşteri bulunamadı.</p>
                 <p className="text-[9px] mt-1 text-slate-500">Sağ üstten yeni bir müşteri ekleyebilirsiniz.</p>
               </div>
            ) : filteredCustomers.map((item, index) => (
                <div 
                  key={item.id} 
                  onClick={() => setSelectedCustomerId(item.id)} 
                  style={{ animation: 'fadeInUp 0.3s both', animationDelay: `${0.15 + (index * 0.05)}s` }}
                  className={`flex items-center justify-between py-2.5 px-3 rounded-lg cursor-pointer transition-all border hover:-translate-y-0.5 group ${item.id === selectedCustomerId ? 'bg-blue-900/10 border-blue-500/50 shadow-inner' : 'bg-[#070b14] border-slate-800/50 hover:border-slate-600'}`}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-[11px] font-bold text-slate-200 truncate">{item.name}</h4>
                      {isCustomerConsent(item.phone) && (
                        <span className="shrink-0 inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[8px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" title="SMS ve Ticari İleti Onayı Var">
                          📢 SMS
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] text-slate-500 truncate mt-0.5">{item.contact_name || '-'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-[11px] font-mono font-bold ${item.balance > 0 ? 'text-blue-400' : 'text-slate-400'}`}>{formatMoney(item.balance, 'TRY').formatted}</div>
                    <div className="text-[8px] text-slate-500 uppercase tracking-wider mt-0.5">{item.balance > 0 ? 'ALACAĞIMIZ' : 'BAKİYE YOK'}</div>
                  </div>
                </div>
            ))}
          </div>
        </div>

        <div style={{ animation: 'fadeInUp 0.4s both 0.2s' }} className="flex-1 bg-[#0d1322] border border-slate-800/80 rounded-xl flex flex-col min-w-0 shadow-lg relative overflow-hidden">
          {selectedCustomer ? (
            <>
              <div className="p-4 border-b border-slate-800/80 bg-gradient-to-r from-[#0a0f1d] to-[#0d1322] rounded-t-xl shrink-0 flex flex-col md:flex-row justify-between gap-4 relative z-10">
                <div className="flex-1 w-full">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-bold text-white flex items-center gap-2">{selectedCustomer.name}</h2>
                      {isCustomerConsent(selectedCustomer.phone) && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm">
                          <MessageSquare size={11} /> SMS & Kampanya İzinli
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded border border-slate-800"><button onClick={(e) => openEditModal(selectedCustomer, e)} className="text-slate-400 hover:text-blue-400 p-1 transition"><Edit3 size={14} /></button><button onClick={(e) => handleDeleteCustomer(selectedCustomer.id, e)} className="text-slate-400 hover:text-rose-400 p-1 transition"><Trash2 size={14} /></button></div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px] text-slate-400 bg-[#070b14] p-3 rounded-lg border border-slate-800/50">
                    <div>
                      <span className="flex items-center gap-1 text-slate-500 mb-0.5"><Phone size={10} /> Telefon</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-slate-300">{selectedCustomer.phone || '-'}</span>
                        {isCustomerConsent(selectedCustomer.phone) && (
                          <span className="text-[8px] text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20 font-bold tracking-wider">SMS İZİNLİ</span>
                        )}
                      </div>
                    </div>
                    <div><span className="flex items-center gap-1 text-slate-500 mb-0.5"><Mail size={10} /> E-Posta</span><span className="text-slate-300 truncate block">{selectedCustomer.email || '-'}</span></div>
                    <div><span className="flex items-center gap-1 text-slate-500 mb-0.5"><FileText size={10} /> V. Dairesi/No</span><span className="text-slate-300">{selectedCustomer.tax_office || '-'} {selectedCustomer.tax_id ? `/ ${selectedCustomer.tax_id}` : ''}</span></div>
                    <div><span className="flex items-center gap-1 text-slate-500 mb-0.5"><MapPin size={10} /> Adres</span><span className="text-slate-300 truncate block">{selectedCustomer.address || '-'}</span></div>
                  </div>
                </div>
                <div className="flex flex-col justify-center items-end bg-[#070b14] px-5 py-3 rounded-lg border border-slate-800/50 min-w-[160px] w-full md:w-auto">
                  <span className="text-[10px] font-bold text-slate-500 mb-1 tracking-widest">GÜNCEL BAKİYE (₺)</span>
                  <span className={`text-2xl font-black font-mono ${selectedCustomer.balance > 0 ? 'text-blue-400' : 'text-emerald-400'}`}>{formatMoney(selectedCustomer.balance, 'TRY').formatted}</span>
                </div>
              </div>

              <div className="p-4 overflow-y-auto custom-scrollbar flex-1 flex flex-col relative z-0">
                {!isEditingDetailedTx && (
                  <form style={{ animation: 'fadeInUp 0.4s both 0.3s' }} onSubmit={handleAddTransaction} className="flex flex-wrap items-end gap-2.5 mb-5 bg-[#070b14] p-3 rounded-lg border border-slate-800 shrink-0 transition-colors hover:border-slate-700">
                    <div className="w-28"><label className="block text-[9px] text-slate-400 mb-0.5">Tarih</label><input type="date" required value={txDate} onChange={(e) => setTxDate(e.target.value)} className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors" /></div>
                    
                    <div className="w-36">
                       <label className="block text-[9px] text-slate-400 mb-0.5">İlgili Merkez *</label>
                       <select value={txCompanyId} onChange={(e) => setTxCompanyId(e.target.value)} required className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors">
                         <option value="common">🌍 Ortak / Bağımsız İşlem</option>
                         <optgroup label="Ticari Şirketler">{companies.filter(c => !c.is_personal).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                         <optgroup label="Şahsi Merkezler">{companies.filter(c => c.is_personal).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                       </select>
                    </div>

                    <div className="w-36"><label className="block text-[9px] text-slate-400 mb-0.5">İşlem Yönü</label><select value={txType} onChange={(e) => setTxType(e.target.value as any)} className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors"><option value="debt">Satış / Borçlandır (+)</option><option value="payment">Tahsilat / Ödeme Al (-)</option></select></div>
                    {txType === 'payment' && (
                      <div className="w-40"><label className="block text-[9px] text-slate-400 mb-0.5">Tahsilatın Gireceği Yer *</label><select value={paymentSource} onChange={(e) => setPaymentSource(e.target.value)} required className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors"><option value="">Seçiniz</option>{cashes.length > 0 && <optgroup label="Nakit Kasalar">{cashes.map(c => <option key={`cash|${c.id}`} value={`cash|${c.id}`}>{c.name}</option>)}</optgroup>}{banks.length > 0 && <optgroup label="Bankalar">{banks.map(b => <option key={`bank|${b.id}`} value={`bank|${b.id}`}>{b.bank_name}</option>)}</optgroup>}</select></div>
                    )}
                    <div className="flex-1 min-w-[120px]"><label className="block text-[9px] text-slate-400 mb-0.5">Açıklama</label><input type="text" required placeholder="Fatura / Tahsilat Açıklaması" value={txDesc} onChange={(e) => setTxDesc(e.target.value)} className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors" /></div>
                    <div className="w-16"><label className="block text-[9px] text-slate-400 mb-0.5">Döviz</label><select value={txCurrency} onChange={(e) => setTxCurrency(e.target.value as any)} className="w-full bg-[#0d1322] border border-slate-700 rounded px-1.5 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors"><option value="TRY">₺</option><option value="USD">$</option><option value="EUR">€</option></select></div>
                    {txCurrency !== 'TRY' && (
                      <div className="w-16"><label className="block text-[9px] text-slate-400 mb-0.5">M. Kur</label><input type="number" step="0.0001" required value={txExchangeRate} onChange={(e) => setTxExchangeRate(e.target.value)} className="w-full bg-indigo-900/20 text-indigo-300 border border-indigo-500/30 rounded px-2 py-1.5 text-[11px] focus:outline-none font-mono transition-colors" title="Mutabakat Kuru" /></div>
                    )}
                    <div className="w-24"><label className="block text-[9px] text-slate-400 mb-0.5">Tutar</label><input type="number" step="0.01" required placeholder="0.00" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none font-mono transition-colors" /></div>
                    <div className="flex items-center gap-1">
                      {editingTxId && <button type="button" onClick={cancelEditTx} className="bg-slate-700 hover:bg-slate-600 text-white px-2 py-1.5 rounded text-[11px] font-bold transition h-[26px]">X</button>}
                      <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded text-[11px] font-bold transition-all active:scale-95 h-[26px]">{editingTxId ? 'Güncelle' : 'Ekle'}</button>
                    </div>
                    {!editingTxId && (<><div className="w-px h-6 bg-slate-700 mx-1"></div><button type="button" onClick={openInvoiceModal} className="bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/50 text-indigo-300 hover:text-white px-3 py-1.5 rounded text-[11px] font-bold transition-all active:scale-95 h-[26px] flex items-center gap-1.5"><ListPlus size={14} /> Detaylı Satış Faturası</button></>)}
                  </form>
                )}

                <div className="border border-slate-800/80 rounded-lg overflow-hidden flex-1 flex flex-col">
                  <table className="w-full text-left text-[11px]">
                    <thead className="sticky top-0 bg-[#0a0f1d] z-10">
                      <tr className="border-b border-slate-800/80 text-slate-400"><th className="p-2.5 font-medium">Tarih</th><th className="p-2.5 font-medium">Açıklama & Merkez</th><th className="p-2.5 font-medium text-right text-blue-400">Satış (+)</th><th className="p-2.5 font-medium text-right text-emerald-400">Tahsilat (-)</th><th className="p-2.5 font-medium text-right text-slate-300 bg-slate-800/20">Bakiye (₺)</th><th className="p-2.5 font-medium text-center w-12">İşlem</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {displayTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center">
                            <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-700/60 rounded-xl bg-slate-800/10 text-slate-500 shadow-inner my-2 mx-2">
                               <RefreshCw size={32} className="mb-3 opacity-70 text-blue-400 animate-bounce" />
                               <p className="text-[11px] font-bold text-slate-400">Bu müşteriye ait henüz hareket bulunmuyor.</p>
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
                              <div className="flex items-center gap-2 mb-1">{t.is_detailed && <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/30 flex items-center gap-1"><ScrollText size={10}/> Detaylı</span>}{t.description}</div>
                              {t.tx_type === 'payment' && t.payment_source_type && t.payment_source_id && (<div className="text-[9px] text-emerald-500/70 mt-0.5 mb-1 flex items-center gap-1">{t.payment_source_type === 'cash' ? <Wallet size={10}/> : t.payment_source_type === 'bank' ? <Landmark size={10}/> : <CreditCard size={10}/>} Kaynak: {getPaymentSourceName(t.payment_source_type, t.payment_source_id)}</div>)}
                              <div className="flex items-center gap-1 text-[9px] text-slate-500">
                                {t.company ? (isPersonal ? <Home size={10} className="text-slate-400"/> : <Building size={10} className="text-indigo-400"/>) : <Globe size={10} className="text-emerald-500/70"/>}
                                {t.company ? t.company.name : 'Ortak İşlem'}
                              </div>
                            </td>
                            <td className="p-2.5 text-right text-blue-400 font-medium align-top leading-tight">
                              {t.tx_type === 'debt' ? (<div className="flex flex-col"><span>{formatMoney(t.amount, t.currency || 'TRY').formatted}</span>{t.currency !== 'TRY' && <span className="text-[9px] text-blue-400/50 mt-0.5">{rateStr}{formatMoney(tryEquivalent, 'TRY').formatted}</span>}</div>) : '-'}
                            </td>
                            <td className="p-2.5 text-right text-emerald-400 font-medium align-top leading-tight">
                              {t.tx_type === 'payment' ? (<div className="flex flex-col"><span>{formatMoney(t.amount, t.currency || 'TRY').formatted}</span>{t.currency !== 'TRY' && <span className="text-[9px] text-emerald-400/50 mt-0.5">{rateStr}{formatMoney(tryEquivalent, 'TRY').formatted}</span>}</div>) : '-'}
                            </td>
                            <td className="p-2.5 text-right text-slate-300 font-medium align-top bg-slate-800/10">
                              {formatMoney(t.running_balance, 'TRY').formatted}
                            </td>
                            <td className="p-2.5 text-center align-top"><div className="flex items-center justify-center gap-2"><button onClick={() => handleEditTx(t)} className="text-slate-500 hover:text-blue-400 transition"><Edit3 size={12} /></button><button onClick={() => handleDeleteTransaction(t.id)} className="text-slate-600 hover:text-rose-400 transition"><Trash2 size={12} /></button></div></td>
                          </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 m-4 border border-dashed border-slate-700/60 rounded-xl bg-slate-800/10 text-slate-500 shadow-inner z-0">
              <Users size={48} className="mb-4 opacity-70 text-blue-400 animate-bounce" />
              <p className="text-sm font-bold text-slate-400">Lütfen soldan bir müşteri seçin</p>
            </div>
          )}
        </div>
      </div>

      {/* --- ÖZEL ONAY MODALI --- */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 999999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className={`mx-auto flex items-center justify-center h-14 w-14 rounded-full mb-5 ${confirmDialog.isDanger ? 'bg-rose-500/10 text-rose-400' : 'bg-blue-500/10 text-blue-400'}`}>
              {confirmDialog.isDanger ? <AlertTriangle size={28} /> : <RefreshCw size={28} />}
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{confirmDialog.title}</h3>
            <p className="text-[11px] text-slate-400 mb-6 leading-relaxed px-2">{confirmDialog.message}</p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} className="flex-1 px-4 py-2.5 rounded-xl text-slate-300 bg-slate-800 hover:bg-slate-700 font-medium transition-colors text-xs">
                {confirmDialog.cancelText}
              </button>
              <button onClick={confirmDialog.onConfirm} className={`flex-1 px-4 py-2.5 rounded-xl text-white font-bold transition-all active:scale-95 text-xs shadow-lg ${confirmDialog.isDanger ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-900/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-900/20'}`}>
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DETAYLI FATURA MODALI --- */}
      {isInvoiceModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 9999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl w-full max-w-[1400px] flex flex-col max-h-[90vh] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={() => setActiveDropdown(null)}>
            <div className="p-4 border-b border-slate-800 bg-[#0a0f1d] flex justify-between items-center shrink-0">
              <div><h3 className="text-base font-bold text-white flex items-center gap-2"><ArrowUpRight className="text-blue-400" size={18} />{editingTxId ? 'Satış Faturasını Düzenle' : 'Yeni Satış Faturası'}</h3><p className="text-[10px] text-slate-400 mt-0.5">Müşteri: <strong className="text-blue-400">{selectedCustomer.name}</strong></p></div><button onClick={closeInvoiceModal} className="text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
            </div>
            <div className="p-4 bg-[#0d1322] flex flex-wrap gap-4 shrink-0 border-b border-slate-800 items-end">
              <div className="w-36">
                 <label className="block text-[10px] text-slate-400 mb-1">İlgili Merkez *</label>
                 <select value={invCompanyId} onChange={(e) => setInvCompanyId(e.target.value)} required className="w-full bg-[#070b14] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none transition-colors">
                   <option value="common">🌍 Ortak İşlem</option>
                   <optgroup label="Ticari Şirketler">{companies.filter(c => !c.is_personal).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                   <optgroup label="Şahsi Merkezler">{companies.filter(c => c.is_personal).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                 </select>
              </div>
              <div className="w-36"><label className="block text-[10px] text-slate-400 mb-1">Fatura Tarihi</label><input type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none transition-colors" /></div>
              <div className="flex-1"><label className="block text-[10px] text-slate-400 mb-1">Fatura / Belge No (Açıklama)</label><input type="text" placeholder="Örn: SFAT-2026-0001" value={invDesc} onChange={(e) => setInvDesc(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none transition-colors" /></div>
              <div className="w-24"><label className="block text-[10px] text-slate-400 mb-1">Fatura Dövizi</label><select value={invCurrency} onChange={(e) => setInvCurrency(e.target.value as any)} className="w-full bg-[#070b14] border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none transition-colors"><option value="TRY">₺ TRY</option><option value="USD">$ USD</option><option value="EUR">€ EUR</option></select></div>
              {invCurrency !== 'TRY' && (
                <div className="w-24"><label className="block text-[10px] text-slate-400 mb-1">Mutabakat Kuru</label><input type="number" step="0.0001" value={invExchangeRate} onChange={(e) => setInvExchangeRate(e.target.value)} className="w-full bg-indigo-900/20 text-indigo-300 border border-indigo-500/50 rounded px-2 py-1.5 text-xs focus:outline-none font-mono transition-colors" /></div>
              )}
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1 bg-[#0a0f1d]">
              <div className="space-y-2">
                <div className="flex gap-2 text-[10px] font-bold text-slate-500 uppercase px-1">
                  <div className="w-24">Satış Türü</div>
                  <div className="flex-1">Ürün / Hizmet Adı</div>
                  <div className="w-20 text-right">Miktar</div>
                  <div className="w-24 text-right">Net B.Fiyat ({invCurrency})</div>
                  <div className="w-16 text-center">KDV(%)</div>
                  <div className="w-24 text-right pr-2">KDV'li Toplam</div>
                  <div className="w-24 text-center text-rose-400">Stoktan Düş</div>
                  <div className="w-32">Depo Seçimi</div>
                  <div className="w-8"></div>
                </div>
                {invLines.map((line) => {
                  const q = parseFloat(line.quantity) || 0; const p = parseFloat(line.unitPrice) || 0; const v = parseFloat(line.vatRate) || 0
                  
                  const filteredItems = line.name.trim() ? (line.itemType === 'product' 
                    ? stocks.filter(s => s.name.toLowerCase().includes(line.name.toLowerCase()) && s.quantity > 0)
                    : services.filter(s => s.name.toLowerCase().includes(line.name.toLowerCase()))
                  ) : []

                  return (
                    <div key={line.id} className="flex gap-2 items-start bg-[#0d1322] border border-slate-700/50 p-2 rounded-lg group transition-colors hover:border-slate-600">
                      <div className="w-24">
                         <select value={line.itemType} onChange={(e) => updateInvoiceLine(line.id, 'itemType', e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none transition-colors">
                            <option value="product">📦 Ürün</option>
                            <option value="service">💼 Hizmet</option>
                         </select>
                      </div>
                      
                      <div className="flex-1 relative">
                        <div className="flex items-center bg-[#070b14] border border-slate-700 rounded overflow-hidden transition-colors focus-within:border-indigo-500/50">
                           <Search size={12} className="text-slate-500 ml-2 shrink-0" />
                           <input type="text" placeholder={line.itemType === 'product' ? "Ürün ara..." : "Hizmet ara..."} value={line.name} onChange={(e) => { updateInvoiceLine(line.id, 'name', e.target.value); updateInvoiceLine(line.id, 'selectedStockId', undefined); updateInvoiceLine(line.id, 'selectedServiceId', undefined); setActiveDropdown(line.id) }} onFocus={() => setActiveDropdown(line.id)} onClick={(e) => e.stopPropagation()} className="w-full bg-transparent px-2 py-1.5 text-xs text-white focus:outline-none" />
                        </div>
                        {activeDropdown === line.id && filteredItems.length > 0 && (
                           <div className="absolute top-full left-0 right-0 mt-1 bg-[#1b253b] border border-indigo-500/50 rounded-lg shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar animate-in fade-in duration-200">
                              {filteredItems.map((item: any) => (
                                 <div key={item.id} onClick={(e) => { e.stopPropagation(); selectItemForLine(line.id, item, line.itemType) }} className="px-3 py-2 text-xs border-b border-slate-700/50 hover:bg-indigo-600 hover:text-white cursor-pointer transition-colors flex justify-between items-center">
                                    <span className="font-medium truncate pr-2">{item.name}</span>
                                    {line.itemType === 'product' && <span className="text-[10px] bg-slate-900/50 px-1.5 py-0.5 rounded text-emerald-400 border border-slate-700 shrink-0">Stok: {item.quantity}</span>}
                                 </div>
                              ))}
                           </div>
                        )}
                      </div>
                      <div className="w-20"><input type="number" step="0.01" placeholder="0" value={line.quantity} onChange={(e) => updateInvoiceLine(line.id, 'quantity', e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-2 py-1.5 text-xs text-white text-right focus:outline-none focus:border-indigo-500/50 transition-colors font-mono" /></div>
                      <div className="w-24"><input type="number" step="0.01" placeholder="0.00" value={line.unitPrice} onChange={(e) => updateInvoiceLine(line.id, 'unitPrice', e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-2 py-1.5 text-xs text-white text-right focus:outline-none focus:border-indigo-500/50 transition-colors font-mono" /></div>
                      <div className="w-16"><select value={line.vatRate} onChange={(e) => updateInvoiceLine(line.id, 'vatRate', e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-1 py-1.5 text-xs text-white text-center focus:outline-none transition-colors"><option value="20">%20</option><option value="10">%10</option><option value="1">%1</option><option value="0">%0</option></select></div>
                      <div className="w-24 text-right pr-2 font-mono text-xs font-bold text-slate-300 flex items-center justify-end">{formatMoney(q * p * (1 + v / 100), invCurrency).formatted}</div>
                      
                      {line.itemType === 'product' ? (
                        <>
                          <div className="w-24 flex justify-center"><button type="button" onClick={() => updateInvoiceLine(line.id, 'addToStock', !line.addToStock)} className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold transition-colors ${line.addToStock ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>{line.addToStock ? <CheckSquare size={14}/> : <Square size={14}/>} Düş (- )</button></div>
                          <div className="w-32">{line.addToStock ? <select disabled={!!line.selectedStockId} title={line.selectedStockId ? "Kayıtlı ürün seçildiği için depo değiştirilemez." : ""} value={line.warehouseId} onChange={(e) => updateInvoiceLine(line.id, 'warehouseId', e.target.value)} className="w-full bg-rose-900/30 border border-rose-500/50 rounded px-1 py-1.5 text-[11px] text-rose-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><option value="" disabled>Depo Seç...</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select> : <div className="w-full text-center text-[10px] text-slate-600 py-1.5">-</div>}</div>
                        </>
                      ) : (
                        <>
                           <div className="w-24 flex justify-center py-1.5"><span className="text-[10px] text-slate-600 font-bold bg-slate-800/30 px-2 py-1 rounded line-through">Stok Yok</span></div>
                           <div className="w-32 flex justify-center py-1.5"><span className="text-[10px] text-slate-600 font-bold bg-slate-800/30 px-2 py-1 rounded w-full text-center">Hizmet Bedeli</span></div>
                        </>
                      )}

                      <div className="w-8 flex justify-center pt-1.5">{invLines.length > 1 && <button onClick={() => removeInvoiceLine(line.id)} className="text-slate-500 hover:text-rose-400 transition-colors"><Trash2 size={14} /></button>}</div>
                    </div>
                  )
                })}
              </div>
              <button type="button" onClick={addInvoiceLine} className="mt-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all active:scale-95"><Plus size={14} /> Yeni Satır Ekle</button>
            </div>
            <div className="p-4 border-t border-slate-800 bg-[#0d1322] flex justify-between items-center shrink-0">
              <div className="flex gap-6 text-xs bg-[#070b14] border border-slate-800 rounded-lg px-4 py-2">
                <div className="flex flex-col"><span className="text-slate-500 text-[9px] uppercase font-bold">Fatura Genel Toplamı (KDV Dahil)</span><span className="text-blue-400 font-bold font-mono text-lg">{formatMoney(calculateInvoiceTotal(), invCurrency).formatted}</span></div>
                {invCurrency !== 'TRY' && (
                   <div className="flex flex-col border-l border-slate-800 pl-6"><span className="text-slate-500 text-[9px] uppercase font-bold">Cariye İşlenecek Bakiye (₺)</span><span className="text-slate-300 font-bold font-mono text-lg">{formatMoney(calculateInvoiceTotal() * (parseFloat(invExchangeRate) || 1), 'TRY').formatted}</span></div>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={closeInvoiceModal} className="px-5 py-2 rounded-lg text-slate-400 hover:bg-slate-800 text-xs font-bold transition-colors">İptal</button>
                <button type="button" onClick={handleSaveDetailedInvoice} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-lg shadow-blue-900/20">{editingTxId ? 'Faturayı Güncelle' : 'Satışı Kaydet'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MÜŞTERİ EKLEME/DÜZENLEME MODALI --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 9999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl w-full max-w-lg p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Users size={16} className="text-blue-500" /> {editingId ? 'Müşteri Kartını Düzenle' : 'Yeni Müşteri Kartı Oluştur'}</h3>
            <form onSubmit={handleSaveCustomer} className="grid grid-cols-2 gap-3 text-[11px]">
              <div className="col-span-2"><label className="block text-slate-400 mb-1">Müşteri / Firma Adı *</label><input type="text" required value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 transition-colors" /></div>
              <div className="col-span-2"><label className="block text-slate-400 mb-1">Yetkili Kişi</label><input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none transition-colors" /></div>
              <div><label className="block text-slate-400 mb-1">Telefon</label><input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none font-mono transition-colors" /></div>
              <div><label className="block text-slate-400 mb-1">E-Posta</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none transition-colors" /></div>
              <div><label className="block text-slate-400 mb-1">Vergi Dairesi</label><input type="text" value={taxOffice} onChange={(e) => setTaxOffice(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none transition-colors" /></div>
              <div><label className="block text-slate-400 mb-1">Vergi / TCKN</label><input type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none font-mono transition-colors" /></div>
              <div className="col-span-2"><label className="block text-slate-400 mb-1">Açık Adres</label><textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none resize-none transition-colors" /></div>
              
              <div className="col-span-2 mt-2 pt-3 border-t border-slate-800">
                <label className="block text-slate-400 font-bold mb-2">
                  {editingId ? 'Devir / Açılış Bakiyesini Düzenle' : 'Devir / Açılış Bakiyesi (Bize olan borçları)'}
                </label>
                <div className="flex gap-2">
                  <div className="w-1/2">
                    <select value={openingCompanyId} onChange={(e) => setOpeningCompanyId(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-2 py-1.5 text-white focus:outline-none focus:border-blue-500 transition-colors">
                      <option value="common">🌍 Ortak / Bağımsız</option>
                      <optgroup label="Ticari Şirketler">{companies.filter(c => !c.is_personal).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                      <optgroup label="Şahsi Merkezler">{companies.filter(c => c.is_personal).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                    </select>
                  </div>
                  <div className="flex-1">
                    <input type="number" step="0.01" placeholder="0.00" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-1.5 text-white focus:outline-none focus:border-blue-500 font-mono transition-colors" />
                  </div>
                </div>
              </div>

              <div className="col-span-2 flex justify-end gap-2 mt-3 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-1.5 rounded text-slate-400 hover:bg-slate-800 transition-colors">İptal</button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-1.5 rounded font-medium transition-all active:scale-95 shadow-lg shadow-blue-900/20">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- SMS / PAZARLAMA İZİNLİ MÜŞTERİLER MODALI --- */}
      {isConsentModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 9999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 bg-gradient-to-r from-[#0a0f1d] via-[#0d1322] to-[#0a0f1d] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl">
                  <MessageSquare size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">SMS & Ticari İleti İzni Veren Müşteriler</h3>
                    <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-xs font-mono font-bold">
                      {filteredConsentCustomers.length} Müşteri
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Teknik servis fişi oluşturulurken reklam ve bilgilendirme SMS'i almayı onaylayan müşteriler
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConsentModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Action Toolbar */}
            <div className="p-3 bg-[#0a0f1d] border-b border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="relative w-full sm:w-80">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="İsim, telefon, fiş no veya model ara..."
                  value={consentSearchTerm}
                  onChange={(e) => setConsentSearchTerm(e.target.value)}
                  className="w-full bg-[#070b14] border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleCopyConsentNumbers}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                    hasCopiedNumbers
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/30'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600'
                  }`}
                  title="Tüm telefon numaralarını virgülle ayrılmış kopyalar (Toplu SMS panelleri için)"
                >
                  {hasCopiedNumbers ? <Check size={14} /> : <Copy size={14} />}
                  <span>{hasCopiedNumbers ? 'Kopyalandı!' : 'Numaraları Kopyala'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadConsentCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-md shadow-emerald-900/20 cursor-pointer"
                  title="Excel uyumlu CSV listesi indir"
                >
                  <Download size={14} />
                  <span>Excel / CSV İndir</span>
                </button>
              </div>
            </div>

            {/* Customer List Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
              {filteredConsentCustomers.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-slate-500">
                  <MessageSquare size={40} className="mb-3 opacity-40 text-emerald-400" />
                  <p className="text-sm font-bold text-slate-300">
                    {consentSearchTerm ? 'Aramanıza uygun izinli müşteri bulunamadı.' : 'Henüz SMS izni veren müşteri kaydı yok.'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 text-center max-w-sm">
                    Teknik servis fişi oluşturulurken "Müşteri bilgilendirme & reklam SMS onayı verdi" seçeneği işaretlendiğinde burada listelenir.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-[#0a0f1d] border-b border-slate-800 text-slate-400 font-medium">
                      <tr>
                        <th className="p-3">Müşteri</th>
                        <th className="p-3">Telefon</th>
                        <th className="p-3">Son Fiş / Cihaz</th>
                        <th className="p-3">İzin Tarihi</th>
                        <th className="p-3 text-right">İletişim</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {filteredConsentCustomers.map((cust) => {
                        const cleanDigits = cust.phone.replace(/\D/g, '')
                        const waNumber = cleanDigits.startsWith('0') ? `9${cleanDigits}` : cleanDigits.startsWith('90') ? cleanDigits : `90${cleanDigits}`
                        return (
                          <tr key={cust.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="p-3 font-sans">
                              <div className="font-bold text-slate-200">{cust.name}</div>
                            </td>
                            <td className="p-3 text-slate-300">
                              <span className="font-mono">{cust.phone || '-'}</span>
                            </td>
                            <td className="p-3 font-sans">
                              <div className="text-slate-300 font-medium flex items-center gap-1.5 flex-wrap">
                                {cust.ticketNo && (
                                  <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
                                    {cust.ticketNo}
                                  </span>
                                )}
                                {cust.brandModel && (
                                  <span className="text-slate-400 text-xs truncate max-w-[200px]">
                                    {cust.brandModel}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-slate-400 text-[11px] font-sans">
                              {cust.date ? formatDateTR(cust.date.split('T')[0]) : '-'}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {cleanDigits && (
                                  <>
                                    <a
                                      href={`https://wa.me/${waNumber}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[10px] font-sans font-bold flex items-center gap-1 transition-colors"
                                      title="WhatsApp'tan Mesaj Gönder"
                                    >
                                      <span>WP</span>
                                      <ExternalLink size={10} />
                                    </a>
                                    <a
                                      href={`tel:${cust.phone}`}
                                      className="p-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded transition-colors"
                                      title="Doğrudan Ara"
                                    >
                                      <Phone size={12} />
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(cust.phone)
                                        toast.success(`${cust.phone} kopyalandı!`)
                                      }}
                                      className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
                                      title="Numarayı Kopyala"
                                    >
                                      <Copy size={12} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer info */}
            <div className="p-3 bg-[#0a0f1d] border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 shrink-0">
              <span className="text-[11px]">💡 Toplu SMS atarken numaraları doğrudan kopyalayıp SMS paneline yapıştırabilirsiniz.</span>
              <button
                type="button"
                onClick={() => setIsConsentModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors cursor-pointer"
              >
                Kapat
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
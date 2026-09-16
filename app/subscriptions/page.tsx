'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/lib/utils'
import toast, { Toaster } from 'react-hot-toast'
import { Key, Plus, Trash2, X, Edit3, Search, Building, Globe, CheckCircle2, AlertCircle, RefreshCw, Wallet, Download, Landmark, Check, ChevronDown, ChevronUp, Clock, CreditCard, Inbox, AlertTriangle, Home } from 'lucide-react'

type Company = { id: string; name: string; is_personal: boolean }
type Supplier = { id: string; company_name: string; balance: number; currency: string }
type CreditWallet = { id: string; supplier_id: string; name: string; balance: number; unit_cost: number; currency: string; supplier?: { company_name: string }; fifo_lots?: any[] }
type BankAccount = { id: string; bank_name: string; balance: number; currency: string }
type CashRegister = { id: string; name: string; balance: number; currency: string }

type Subscription = {
  id: string; company_id: string | null; wallet_id: string | null;
  username: string; full_name: string; phone: string; reference_note: string;
  start_date: string; end_date: string;
  cost_price: number; sale_price: number; currency: 'TRY' | 'USD' | 'EUR';
  is_active: boolean; is_paid: boolean; payment_source_type: string | null; payment_source_id: string | null;
  company?: { name: string; is_personal: boolean }; wallet?: { name: string };
}

function getLocalTodayISO() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` }
function formatDateTR(dateStr: string) { if (!dateStr) return ''; const parts = dateStr.split('-'); if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`; return dateStr }
function addOneYear(dateStr: string) { const d = new Date(dateStr); d.setFullYear(d.getFullYear() + 1); return d.toISOString().split('T')[0]; }
function getDaysRemaining(endDateStr: string) { const end = new Date(endDateStr).getTime(); const now = new Date().getTime(); return Math.ceil((end - now) / (1000 * 3600 * 24)); }

async function logActivity(module: string, action: string, description: string, recordId: string | null = null, amount: number = 0, currency: string = '', oldData: any = null, newData: any = null, companyId: string | null = null) {
  try {
    await supabase.from('audit_logs').insert([{
      module, action, description, record_id: recordId, amount, currency, old_data: oldData, new_data: newData, company_id: companyId
    }])
  } catch (err) {
    console.error("Log kaydı atılamadı:", err)
  }
}

export default function SubscriptionsPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [wallets, setWallets] = useState<CreditWallet[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [banks, setBanks] = useState<BankAccount[]>([])
  const [cashes, setCashes] = useState<CashRegister[]>([])
  
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState('all')

  const [rates, setRates] = useState<{ USD: number; EUR: number }>({ USD: 34.25, EUR: 37.80 })

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState('common')
  const [subWalletId, setSubWalletId] = useState('')
  const [username, setUsername] = useState(''); const [fullName, setFullName] = useState(''); const [phone, setPhone] = useState(''); const [referenceNote, setReferenceNote] = useState('')
  const [startDate, setStartDate] = useState(getLocalTodayISO())
  const [salePrice, setSalePrice] = useState('')
  const [currency, setCurrency] = useState<'TRY' | 'USD' | 'EUR'>('TRY')

  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)
  const [editingWalletId, setEditingWalletId] = useState<string | null>(null)
  const [walletName, setWalletName] = useState('')
  const [walletSupplierId, setWalletSupplierId] = useState('')
  const [walletCurrency, setWalletCurrency] = useState('USD')
  const [walletOpeningBalance, setWalletOpeningBalance] = useState('') 
  const [walletOpeningCost, setWalletOpeningCost] = useState('') 

  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false)
  const [loadWalletId, setLoadWalletId] = useState('')
  const [loadQty, setLoadQty] = useState('')
  const [loadPrice, setLoadPrice] = useState('')
  const [loadCurrency, setLoadCurrency] = useState<'TRY' | 'USD' | 'EUR'>('USD')
  const [loadExRate, setLoadExRate] = useState('1')

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [paymentSubId, setPaymentSubId] = useState('')
  const [paymentSource, setPaymentSource] = useState('')

  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; message: string; confirmText: string; cancelText: string; isDanger: boolean; onConfirm: () => void; }>({ isOpen: false, title: '', message: '', confirmText: '', cancelText: '', isDanger: false, onConfirm: () => {} })

  const [openSections, setOpenSections] = useState({ active: false, renewing: false, pending: false })
  const toggleSection = (section: 'active' | 'renewing' | 'pending') => { setOpenSections(prev => ({ ...prev, [section]: !prev[section] })) }

  useEffect(() => { fetchExchangeRates(); fetchCompanies(); fetchSuppliers(); fetchWallets(); fetchSubscriptions(); fetchPaymentSources() }, [])
  useEffect(() => {
    if (loadCurrency === 'USD') setLoadExRate(rates.USD.toString())
    else if (loadCurrency === 'EUR') setLoadExRate(rates.EUR.toString())
    else setLoadExRate('1')
  }, [loadCurrency, rates])

  async function fetchExchangeRates() { try { const res = await fetch('https://open.er-api.com/v6/latest/USD'); const data = await res.json(); if (data && data.rates) setRates({ USD: Number(data.rates.TRY.toFixed(4)), EUR: Number((data.rates.TRY / data.rates.EUR).toFixed(4)) }) } catch (err) {} }
  async function fetchCompanies() { const { data } = await supabase.from('companies').select('*').order('name'); setCompanies(data || []) }
  async function fetchSuppliers() { const { data } = await supabase.from('suppliers').select('id, company_name, balance, currency').order('company_name'); setSuppliers(data || []) }
  async function fetchWallets() { const { data } = await supabase.from('credit_wallets').select('*, supplier:suppliers(company_name)').order('created_at'); setWallets(data || []) }
  async function fetchSubscriptions() { const { data } = await supabase.from('credit_subscriptions').select('*, company:companies(name, is_personal), wallet:credit_wallets(name)').order('end_date'); setSubscriptions(data || []) }
  async function fetchPaymentSources() {
    const { data: bData } = await supabase.from('bank_accounts').select('id, bank_name, balance, currency')
    const { data: cData } = await supabase.from('cash_registers').select('id, name, balance, currency')
    setBanks(bData || []); setCashes(cData || [])
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

  async function recalculateAbsoluteWalletBalance(walletId: string) {
    const { data: walletData } = await supabase.from('credit_wallets').select('fifo_lots').eq('id', walletId).single()
    if (walletData && walletData.fifo_lots) {
      const recalculatedBalance = walletData.fifo_lots.reduce((acc: number, lot: any) => acc + (Number(lot.qty) || 0), 0)
      await supabase.from('credit_wallets').update({ balance: recalculatedBalance }).eq('id', walletId)
    }
  }
  // =========================================================================================


  function openNewWalletModal() { 
    setEditingWalletId(null); setWalletName(''); setWalletSupplierId(''); setWalletCurrency('USD'); 
    setWalletOpeningBalance(''); setWalletOpeningCost('');
    setIsWalletModalOpen(true) 
  }
  
  function openEditWalletModal(w: CreditWallet) { 
    setEditingWalletId(w.id); setWalletName(w.name); setWalletSupplierId(w.supplier_id); setWalletCurrency(w.currency); 
    const openingLot = (w.fifo_lots || []).find((l: any) => l.is_opening)
    if (openingLot) {
       setWalletOpeningBalance(openingLot.original_qty?.toString() || openingLot.qty.toString())
       setWalletOpeningCost(openingLot.price.toString())
    } else {
       setWalletOpeningBalance('')
       setWalletOpeningCost('')
    }
    setIsWalletModalOpen(true) 
  }

  async function handleSaveWallet(e: React.FormEvent) {
    e.preventDefault()
    if(!walletName || !walletSupplierId) return

    const payload = { name: walletName, supplier_id: walletSupplierId, currency: walletCurrency }
    const initialQty = parseInt(walletOpeningBalance) || 0
    const initialCost = parseFloat(walletOpeningCost) || 0

    try {
      if (editingWalletId) {
        const oldWallet = wallets.find(w => w.id === editingWalletId)
        if (!oldWallet) return
        
        let newLots = [...(oldWallet.fifo_lots || [])]
        const openingLotIndex = newLots.findIndex((l: any) => l.is_opening)
        
        if (openingLotIndex >= 0) {
            const oldOriginalQty = newLots[openingLotIndex].original_qty || newLots[openingLotIndex].qty
            const delta = initialQty - oldOriginalQty
            
            if (delta !== 0 || newLots[openingLotIndex].price !== initialCost) {
                newLots[openingLotIndex].qty += delta
                newLots[openingLotIndex].original_qty = initialQty
                newLots[openingLotIndex].price = initialCost
                
                if (newLots[openingLotIndex].qty <= 0 && initialQty === 0) {
                    newLots.splice(openingLotIndex, 1)
                }
            }
        } else if (initialQty > 0) {
            newLots.unshift({ qty: initialQty, original_qty: initialQty, price: initialCost, currency: walletCurrency, exRate: 1, is_opening: true })
        }
        
        const recalculatedBalance = newLots.reduce((acc, lot) => acc + (Number(lot.qty) || 0), 0)
        
        let newUnitCost = oldWallet.unit_cost
        if (newLots.length > 0) {
           let pTry = newLots[0].price * (newLots[0].exRate || 1)
           if (walletCurrency === 'TRY') newUnitCost = pTry
           else if (walletCurrency === 'USD') newUnitCost = pTry / rates.USD
           else if (walletCurrency === 'EUR') newUnitCost = pTry / rates.EUR
        } else {
           newUnitCost = 0
        }

        const fullPayload = { ...payload, balance: recalculatedBalance, fifo_lots: newLots, unit_cost: newUnitCost }
        await supabase.from('credit_wallets').update(fullPayload).eq('id', editingWalletId)
        
        await logActivity('subscription_wallet', 'UPDATE', `Cüzdan güncellendi: ${walletName}`, editingWalletId, 0, walletCurrency, oldWallet, fullPayload)
        toast.success('Cüzdan başarıyla güncellendi.')
      } else {
        const initialLots = initialQty > 0 ? [{ qty: initialQty, original_qty: initialQty, price: initialCost, currency: walletCurrency, exRate: 1, is_opening: true }] : []
        const fullPayload = { ...payload, balance: initialQty, unit_cost: initialQty > 0 ? initialCost : 0, fifo_lots: initialLots }
        
        const { data } = await supabase.from('credit_wallets').insert([fullPayload]).select().single()
        await logActivity('subscription_wallet', 'INSERT', `Yeni cüzdan açıldı: ${walletName}`, data?.id, 0, walletCurrency, null, data)
        toast.success('Yeni kredi cüzdanı oluşturuldu.')
      }
      setIsWalletModalOpen(false)
      fetchWallets()
    } catch(err:any) { toast.error('İşlem başarısız: ' + err.message) }
  }

  function confirmDeleteWallet(wallet: CreditWallet) {
    const hasActiveSubs = subscriptions.some(s => s.wallet_id === wallet.id)
    let title = 'Cüzdanı Sil'
    let message = `"${wallet.name}" cüzdanını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`

    if (hasActiveSubs || wallet.balance > 0) {
      title = 'Cüzdanı Zorla Sil (Hayalet Bakiye Temizliği)'
      message = `DİKKAT: Bu cüzdanda sistem üzerinde hala ${wallet.balance} kredi veya bağlı abonelik görünüyor. Senkronizasyon hatası ("hayalet bakiye") yaşıyorsanız bu işlemi ZORLA gerçekleştirebilirsiniz. Tamamen çöpe atmak istediğinize emin misiniz?`
    }

    setConfirmDialog({
      isOpen: true,
      title,
      message,
      confirmText: hasActiveSubs || wallet.balance > 0 ? 'Evet, Tamamen Sil' : 'Evet, Sil',
      cancelText: 'Vazgeç',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        try {
          await supabase.from('credit_wallets').delete().eq('id', wallet.id)
          await logActivity('subscription_wallet', 'DELETE', `Cüzdan silindi: ${wallet.name}`, wallet.id, 0, wallet.currency, wallet, null)
          toast.success('Cüzdan başarıyla silindi.')
          fetchWallets()
        } catch (err: any) {
          toast.error('Silme başarısız: ' + err.message)
        }
      }
    })
  }

  function openLoadModal(wId: string) {
    setLoadWalletId(wId); setLoadQty(''); setLoadPrice('');
    const w = wallets.find(x => x.id === wId)
    setLoadCurrency(w?.currency as any || 'TRY')
    setIsLoadModalOpen(true)
  }

  async function handleLoadCredit(e: React.FormEvent) {
    e.preventDefault()
    const wallet = wallets.find(w => w.id === loadWalletId); if(!wallet) return;
    const qty = parseInt(loadQty); const price = parseFloat(loadPrice); const exRate = parseFloat(loadExRate);
    
    const amountInCurrency = qty * price

    const { data: suppTx } = await supabase.from('supplier_transactions').insert([{
      supplier_id: wallet.supplier_id, tx_date: getLocalTodayISO(), description: `${wallet.name} Kredi Alımı (${qty} adet)`,
      tx_type: 'debt', amount: amountInCurrency, currency: loadCurrency, exchange_rate: exRate
    }]).select().single()

    // MUTLAK HESAPLAMA TETİKLENDİ
    await recalculateAbsoluteSupplierBalance(wallet.supplier_id)

    const currentLots = wallet.fifo_lots || []
    const newLot = { qty, price, currency: loadCurrency, exRate }
    const updatedLots = [...currentLots, newLot]

    let nextCostToDisplay = price
    if (updatedLots.length > 0) {
      nextCostToDisplay = updatedLots[0].price
      if (updatedLots[0].currency !== wallet.currency) {
         let pTry = updatedLots[0].price * (updatedLots[0].exRate || 1)
         if (wallet.currency === 'TRY') nextCostToDisplay = pTry
         else if (wallet.currency === 'USD') nextCostToDisplay = pTry / rates.USD
         else if (wallet.currency === 'EUR') nextCostToDisplay = pTry / rates.EUR
      }
    }

    await supabase.from('credit_wallets').update({ balance: wallet.balance + qty, unit_cost: nextCostToDisplay, fifo_lots: updatedLots }).eq('id', wallet.id)
    await logActivity('subscription_wallet', 'INSERT', `Cüzdana Kredi Yüklendi (${qty} Adet): ${wallet.name}`, wallet.id, amountInCurrency, loadCurrency, wallet.fifo_lots, updatedLots)

    toast.success(`${qty} adet kredi FIFO kuyruğuna eklendi ve tedarikçi borçlandırıldı.`)
    setIsLoadModalOpen(false); fetchWallets(); fetchSuppliers()
  }

  function openAddModal() { setEditingId(null); setCompanyId('common'); setSubWalletId(''); setUsername(''); setFullName(''); setPhone(''); setReferenceNote(''); setStartDate(getLocalTodayISO()); setSalePrice(''); setCurrency('TRY'); setIsModalOpen(true) }
  function openEditModal(sub: Subscription) { setEditingId(sub.id); setCompanyId(sub.company_id || 'common'); setSubWalletId(sub.wallet_id || ''); setUsername(sub.username); setFullName(sub.full_name); setPhone(sub.phone || ''); setReferenceNote(sub.reference_note || ''); setStartDate(sub.start_date); setSalePrice(sub.sale_price.toString()); setCurrency(sub.currency); setIsModalOpen(true) }

  async function handleSaveSub(e: React.FormEvent) {
    e.preventDefault()
    if (!username || !fullName) return
    const finalCompId = companyId === 'common' ? null : companyId
    const endDate = addOneYear(startDate)
    
    let finalCost = 0
    let walletToDeduct = null
    let newFifoLots = []
    let newUnitCost = 0

    if (!editingId && subWalletId) {
      const wallet = wallets.find(w => w.id === subWalletId)
      if (!wallet || wallet.balance < 1) { toast.error("Cüzdanda yeterli kredi yok! Lütfen kredi yükleyin."); return }
      walletToDeduct = wallet

      let baseCost = wallet.unit_cost
      let baseCurrency = wallet.currency
      newFifoLots = [...(wallet.fifo_lots || [])]

      if (newFifoLots.length > 0) {
        baseCost = newFifoLots[0].price
        baseCurrency = newFifoLots[0].currency
        newFifoLots[0].qty -= 1
        if (newFifoLots[0].qty <= 0) {
           newFifoLots.shift()
        }
      }

      finalCost = baseCost
      if (baseCurrency !== currency) {
        let costInTry = baseCost;
        if (baseCurrency === 'USD') costInTry = baseCost * rates.USD
        if (baseCurrency === 'EUR') costInTry = baseCost * rates.EUR
        if (currency === 'TRY') finalCost = costInTry
        else if (currency === 'USD') finalCost = costInTry / rates.USD
        else if (currency === 'EUR') finalCost = costInTry / rates.EUR
      }

      if (newFifoLots.length > 0) {
         newUnitCost = newFifoLots[0].price
         if (newFifoLots[0].currency !== wallet.currency) {
           let pTry = newFifoLots[0].price * (newFifoLots[0].exRate || 1)
           if (wallet.currency === 'TRY') newUnitCost = pTry
           else if (wallet.currency === 'USD') newUnitCost = pTry / rates.USD
           else if (wallet.currency === 'EUR') newUnitCost = pTry / rates.EUR
         }
      }
    }

    const payload: any = { company_id: finalCompId, username, full_name: fullName, phone, reference_note: referenceNote, start_date: startDate, end_date: endDate, sale_price: parseFloat(salePrice) || 0, currency, is_active: true }
    if (!editingId) { payload.wallet_id = subWalletId || null; payload.cost_price = finalCost; payload.is_paid = false }

    try {
      if (editingId) {
        const oldSub = subscriptions.find(s => s.id === editingId)
        await supabase.from('credit_subscriptions').update(payload).eq('id', editingId)
        
        await logActivity('subscription', 'UPDATE', `Abonelik güncellendi: ${username}`, editingId, payload.sale_price, currency, oldSub, payload, finalCompId)
        toast.success('Abonelik kaydı başarıyla güncellendi.')
      } else {
        const { data } = await supabase.from('credit_subscriptions').insert([payload]).select().single()
        if (walletToDeduct) {
            await supabase.from('credit_wallets').update({ balance: walletToDeduct.balance - 1, fifo_lots: newFifoLots, unit_cost: newUnitCost }).eq('id', walletToDeduct.id)
            await recalculateAbsoluteWalletBalance(walletToDeduct.id)
        }
        
        await logActivity('subscription', 'INSERT', `Yeni abonelik oluşturuldu: ${username}`, data?.id, payload.sale_price, currency, null, data, finalCompId)
        toast.success('Yeni abonelik satışı oluşturuldu ve cüzdandan düşüldü.')
      }
      setIsModalOpen(false); fetchSubscriptions(); fetchWallets()
    } catch (err: any) { toast.error('İşlem başarısız: ' + err.message) }
  }

  function confirmDeleteSub(sub: Subscription) {
    setConfirmDialog({
      isOpen: true, title: 'Aboneliği Sil',
      message: 'Aboneliği silmek istediğinize emin misiniz? Kredi, FIFO kuyruğunun en önüne o anki maliyetiyle iade edilecek ve tahsilat geri alınacaktır.',
      confirmText: 'Evet, Sil ve İade Et', cancelText: 'İptal', isDanger: true,
      onConfirm: () => executeDeleteSub(sub)
    })
  }

  async function executeDeleteSub(sub: Subscription) {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }))
    
    let relatedPaymentTx = null
    const affectedBanks = new Set<string>();
    const affectedCashes = new Set<string>();

    if (sub.is_paid && sub.payment_source_type && sub.payment_source_id) {
      const txTable = sub.payment_source_type === 'cash' ? 'cash_transactions' : 'bank_transactions'
      const fkField = sub.payment_source_type === 'cash' ? 'cash_register_id' : 'bank_account_id'

      try {
        const { data: txList } = await supabase.from(txTable).select('id, amount').eq(fkField, sub.payment_source_id).eq('description', `Abonelik Tahsilatı: ${sub.username} (${sub.full_name})`).order('created_at', { ascending: false }).limit(1)
        if (txList && txList.length > 0) {
          await supabase.from(txTable).delete().eq('id', txList[0].id)
          relatedPaymentTx = txList[0]

          if (sub.payment_source_type === 'cash') affectedCashes.add(sub.payment_source_id)
          if (sub.payment_source_type === 'bank') affectedBanks.add(sub.payment_source_id)
        }
      } catch (e) { console.error(e) }
    }

    await supabase.from('credit_subscriptions').delete().eq('id', sub.id)
    
    // Tahsilat iade edildikten sonra bakiyeleri mutlak olarak topla
    for (const bId of Array.from(affectedBanks)) await recalculateAbsoluteBankBalance(bId)
    for (const cId of Array.from(affectedCashes)) await recalculateAbsoluteCashBalance(cId)

    if (sub.wallet_id) {
      const wallet = wallets.find(w => w.id === sub.wallet_id)
      if (wallet) {
        const refundedLot = { qty: 1, price: sub.cost_price, currency: sub.currency, exRate: 1 }
        const newFifoLots = [refundedLot, ...(wallet.fifo_lots || [])]
        
        let newUnitCost = refundedLot.price
        if (refundedLot.currency !== wallet.currency) {
           let pTry = refundedLot.price
           if (wallet.currency === 'TRY') newUnitCost = pTry
           else if (wallet.currency === 'USD') newUnitCost = pTry / rates.USD
           else if (wallet.currency === 'EUR') newUnitCost = pTry / rates.EUR
        }

        await supabase.from('credit_wallets').update({ balance: wallet.balance + 1, fifo_lots: newFifoLots, unit_cost: newUnitCost }).eq('id', sub.wallet_id)
        await recalculateAbsoluteWalletBalance(sub.wallet_id)
      }
    }

    await logActivity('subscription', 'DELETE', `Abonelik iptal edildi: ${sub.username}`, sub.id, sub.sale_price, sub.currency, { deleted_sub: sub, refunded_payment: relatedPaymentTx }, null, sub.company_id)

    toast.success('Abonelik silindi ve kredi cüzdana iade edildi.')
    fetchSubscriptions(); fetchWallets(); fetchPaymentSources();
  }

  function confirmRenewSub(oldSub: Subscription) {
    setConfirmDialog({
      isOpen: true, title: 'Aboneliği 1 Yıl Uzat',
      message: 'Aboneliği 1 YIL uzatmak istediğinize emin misiniz? FIFO kuyruğundaki ilk kredi kullanılacak ve "Ödenmedi" statüsünde yeni bir kayıt açılacaktır.',
      confirmText: 'Evet, Uzat', cancelText: 'İptal', isDanger: false,
      onConfirm: () => executeRenew(oldSub)
    })
  }

  async function executeRenew(oldSub: Subscription) {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }))
    
    let finalCost = 0
    let walletToDeduct = null
    let newFifoLots = []
    let newUnitCost = 0

    if (oldSub.wallet_id) {
       walletToDeduct = wallets.find(w => w.id === oldSub.wallet_id)
       if (!walletToDeduct || walletToDeduct.balance < 1) { toast.error("İlgili cüzdanda yeterli kredi yok!"); return }
       
       let baseCost = walletToDeduct.unit_cost
       let baseCurrency = walletToDeduct.currency
       newFifoLots = [...(walletToDeduct.fifo_lots || [])]

       if (newFifoLots.length > 0) {
         baseCost = newFifoLots[0].price
         baseCurrency = newFifoLots[0].currency
         newFifoLots[0].qty -= 1
         if (newFifoLots[0].qty <= 0) newFifoLots.shift()
       }

       finalCost = baseCost
       if (baseCurrency !== oldSub.currency) {
         let costInTry = baseCost;
         if (baseCurrency === 'USD') costInTry = baseCost * rates.USD
         if (baseCurrency === 'EUR') costInTry = baseCost * rates.EUR
         if (oldSub.currency === 'TRY') finalCost = costInTry
         else if (oldSub.currency === 'USD') finalCost = costInTry / rates.USD
         else if (oldSub.currency === 'EUR') finalCost = costInTry / rates.EUR
       }

       if (newFifoLots.length > 0) {
          newUnitCost = newFifoLots[0].price
          if (newFifoLots[0].currency !== walletToDeduct.currency) {
            let pTry = newFifoLots[0].price * (newFifoLots[0].exRate || 1)
            if (walletToDeduct.currency === 'TRY') newUnitCost = pTry
            else if (walletToDeduct.currency === 'USD') newUnitCost = pTry / rates.USD
            else if (walletToDeduct.currency === 'EUR') newUnitCost = pTry / rates.EUR
          }
       }
    }

    const newStartDate = oldSub.end_date 
    const newEndDate = addOneYear(newStartDate)

    const payload = {
      company_id: oldSub.company_id, wallet_id: oldSub.wallet_id,
      username: oldSub.username, full_name: oldSub.full_name, phone: oldSub.phone, reference_note: oldSub.reference_note,
      start_date: newStartDate, end_date: newEndDate,
      cost_price: finalCost, sale_price: oldSub.sale_price, currency: oldSub.currency,
      is_active: true, is_paid: false
    }

    try {
      const { data } = await supabase.from('credit_subscriptions').insert([payload]).select().single()
      if (walletToDeduct) {
          await supabase.from('credit_wallets').update({ balance: walletToDeduct.balance - 1, fifo_lots: newFifoLots, unit_cost: newUnitCost }).eq('id', walletToDeduct.id)
          await recalculateAbsoluteWalletBalance(walletToDeduct.id)
      }
      
      await logActivity('subscription', 'INSERT', `Abonelik yenilendi (1 Yıl): ${oldSub.username}`, data?.id, payload.sale_price, oldSub.currency, null, data, oldSub.company_id)
      
      toast.success('Abonelik başarıyla 1 yıl uzatıldı.')
      fetchSubscriptions(); fetchWallets()
    } catch(err:any) { toast.error('Yenileme başarısız: ' + err.message) }
  }

  function openPaymentModal(subId: string) { setPaymentSubId(subId); setPaymentSource(''); setIsPaymentModalOpen(true) }

  async function handleReceivePayment(e: React.FormEvent) {
    e.preventDefault()
    if(!paymentSource) return
    const sub = subscriptions.find(s => s.id === paymentSubId)
    if(!sub) return

    const [sourceType, sourceId] = paymentSource.split('|')
    const account = (sourceType === 'cash' ? cashes : banks).find(a => a.id === sourceId) as any
    if(!account) return

    let amountToAdd = sub.sale_price
    if (sub.currency !== account.currency) {
      let amountInTry = sub.currency === 'TRY' ? sub.sale_price : (sub.currency === 'USD' ? sub.sale_price * rates.USD : sub.sale_price * rates.EUR)
      if (account.currency === 'TRY') amountToAdd = amountInTry
      else if (account.currency === 'USD') amountToAdd = amountInTry / rates.USD
      else if (account.currency === 'EUR') amountToAdd = amountInTry / rates.EUR
    }

    try {
      const txTable = sourceType === 'cash' ? 'cash_transactions' : 'bank_transactions'
      const txIdField = sourceType === 'cash' ? 'cash_register_id' : 'bank_account_id'
      
      const payload: any = { 
        [txIdField]: sourceId, company_id: sub.company_id, tx_date: getLocalTodayISO(), description: `Abonelik Tahsilatı: ${sub.username} (${sub.full_name})`, tx_type: 'in', amount: amountToAdd, currency: account.currency, exchange_rate: 1 
      }
      if (sourceType === 'bank') payload.status = 'completed'

      const { data: txData } = await supabase.from(txTable).insert([payload]).select().single()
      
      await supabase.from('credit_subscriptions').update({ is_paid: true, payment_source_type: sourceType, payment_source_id: sourceId }).eq('id', sub.id)
      
      if (sourceType === 'cash') await recalculateAbsoluteCashBalance(sourceId)
      if (sourceType === 'bank') await recalculateAbsoluteBankBalance(sourceId)
      
      await logActivity('subscription_payment', 'UPDATE', `Abonelik tahsil edildi: ${sub.username}`, sub.id, sub.sale_price, sub.currency, { previous_state: 'Unpaid' }, { new_state: 'Paid', payment_tx: txData }, sub.company_id)

      toast.success('Tahsilat başarıyla alındı ve kasaya/bankaya işlendi.')
      setIsPaymentModalOpen(false); fetchSubscriptions(); fetchPaymentSources()
    } catch (err: any) { toast.error("Tahsilat başarısız: " + err.message) }
  }

  const filteredSubs = subscriptions.filter(s => {
    const matchCompany = selectedCompanyFilter === 'all' || (selectedCompanyFilter === 'common' ? !s.company_id : s.company_id === selectedCompanyFilter)
    const matchSearch = s.username.toLowerCase().includes(searchTerm.toLowerCase()) || s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.reference_note && s.reference_note.toLowerCase().includes(searchTerm.toLowerCase()))
    return matchCompany && matchSearch
  })

  const latestSubsMap = new Map<string, Subscription>();
  filteredSubs.forEach(s => {
    const key = `${s.username}|${s.wallet_id || ''}|${s.reference_note || ''}`;
    if (!latestSubsMap.has(key)) { latestSubsMap.set(key, s); } else {
      const existing = latestSubsMap.get(key)!;
      if (new Date(s.end_date) > new Date(existing.end_date)) latestSubsMap.set(key, s);
    }
  });
  const latestSubs = Array.from(latestSubsMap.values());
  const activeSubs = latestSubs.filter(s => getDaysRemaining(s.end_date) > 15)
  const renewingSubs = latestSubs.filter(s => getDaysRemaining(s.end_date) <= 15)
  const pendingPaymentSubs = filteredSubs.filter(s => !s.is_paid)

  let totalCostTry = 0; let totalSaleTry = 0; let pendingCollectionTry = 0;
  filteredSubs.forEach(s => {
    let rate = 1; if (s.currency === 'USD') rate = rates.USD; else if (s.currency === 'EUR') rate = rates.EUR;
    totalCostTry += s.cost_price * rate; totalSaleTry += s.sale_price * rate;
    if (!s.is_paid) pendingCollectionTry += s.sale_price * rate;
  })

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] relative">
      <Toaster position="top-right" toastOptions={{ style: { background: '#0f172a', color: '#fff', border: '1px solid #1e293b', fontSize: '12px', zIndex: 999999 } }} />
      
      {/* KREDİ CÜZDANLARI */}
      <div style={{ animation: 'fadeInDown 0.4s both' }} className="flex gap-3 mb-4 overflow-x-auto custom-scrollbar pb-2 shrink-0">
        {wallets.length === 0 ? (
          <div className="w-full flex flex-col items-center justify-center p-6 border border-dashed border-slate-700/80 rounded-xl text-slate-500 min-h-[120px] bg-slate-800/10">
            <Key size={24} className="mb-3 opacity-40 text-indigo-400" />
            <p className="text-[11px] mb-3">Henüz bir kredi cüzdanı oluşturulmamış.</p>
            <button onClick={openNewWalletModal} className="bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/50 text-indigo-400 hover:text-white px-4 py-2 rounded-lg text-[11px] font-bold flex items-center gap-2 transition-all active:scale-95">
              <Plus size={14} /> Kredi Cüzdanı Oluştur
            </button>
          </div>
        ) : wallets.map((w, index) => (
          <div 
            key={w.id} 
            style={{ animation: 'fadeInUp 0.3s both', animationDelay: `${0.1 + (index * 0.05)}s` }}
            className="min-w-[220px] bg-[#0d1322] border border-slate-800/80 p-3.5 rounded-xl flex flex-col gap-2 shrink-0 shadow-lg group relative hover:border-slate-500/50 transition-colors hover:-translate-y-0.5"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-1.5 overflow-hidden pr-2">
                <span className="font-bold text-white text-xs truncate">{w.name}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditWalletModal(w)} className="text-slate-500 hover:text-blue-400 p-0.5 transition-colors" title="Düzenle"><Edit3 size={11} /></button>
                  <button onClick={() => confirmDeleteWallet(w)} className="text-slate-500 hover:text-rose-400 p-0.5 transition-colors" title="Sil"><Trash2 size={11} /></button>
                </div>
              </div>
              <span className="bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded text-[10px] border border-indigo-500/30 font-mono font-bold shrink-0">{w.balance} Kredi</span>
            </div>
            <div className="text-[10px] text-slate-500 truncate">Tedarikçi: <span className="text-slate-400">{w.supplier?.company_name}</span></div>
            <div className="flex items-center justify-between mt-1 pt-2 border-t border-slate-800/50">
              <span className="text-[10px] font-mono text-slate-400">Sıradaki Maliyet: <span className="text-rose-300 font-bold">{formatMoney(w.unit_cost, w.currency).formatted}</span></span>
              <button onClick={() => openLoadModal(w.id)} className="text-[10px] bg-slate-800 hover:bg-indigo-600 text-white px-2.5 py-1 rounded transition flex items-center gap-1 font-bold active:scale-95"><Download size={10}/> Yükle</button>
            </div>
          </div>
        ))}
        {wallets.length > 0 && (
          <button style={{ animation: 'fadeInUp 0.3s both 0.3s' }} onClick={openNewWalletModal} className="min-w-[160px] border border-dashed border-slate-700/80 rounded-xl flex flex-col items-center justify-center text-slate-500 hover:text-white hover:border-slate-500 hover:bg-slate-800/20 transition shrink-0 gap-1.5 min-h-[90px] active:scale-95">
            <Plus size={18} />
            <span className="text-[10px] font-bold">Yeni Cüzdan Aç</span>
          </button>
        )}
      </div>

      <div style={{ animation: 'fadeInUp 0.4s both 0.1s' }} className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-[#0d1322] border border-slate-800/80 p-4 rounded-xl shadow-md shrink-0 mb-4 transition-colors">
        <div className="flex items-center gap-3 text-white"><div className="p-2 bg-pink-500/10 text-pink-400 rounded-lg"><Key size={24} /></div><div><h2 className="font-bold text-lg leading-none">Abonelik & Lisans Satışları</h2><p className="text-[10px] text-slate-400 mt-1">Yıllık yenilenen dijital aboneliklerin kâr ve tahsilat takibi</p></div></div>
        <div className="flex items-center gap-6 text-xs font-mono">
          <div className="flex flex-col items-end"><span className="text-[9px] text-slate-500 font-sans tracking-wide">TOPLAM MALİYET</span><span className="text-rose-400 font-bold mt-0.5">{formatMoney(totalCostTry, 'TRY').formatted}</span></div>
          <div className="w-px h-6 bg-slate-800"></div>
          <div className="flex flex-col items-end"><span className="text-[9px] text-slate-500 font-sans tracking-wide">TOPLAM CİRO</span><span className="text-blue-400 font-bold mt-0.5">{formatMoney(totalSaleTry, 'TRY').formatted}</span></div>
          <div className="w-px h-6 bg-slate-800"></div>
          <div className="flex flex-col items-end"><span className="text-[9px] text-orange-400/70 font-sans tracking-wide">BEKLEYEN TAHSİLAT</span><span className="text-orange-400 font-bold mt-0.5">{formatMoney(pendingCollectionTry, 'TRY').formatted}</span></div>
          <div className="w-px h-6 bg-slate-800"></div>
          <div className="flex flex-col items-end"><span className="text-[9px] text-pink-400/70 font-sans tracking-wide">NET KÂR</span><span className="text-pink-400 font-black text-lg mt-0.5">{formatMoney(totalSaleTry - totalCostTry, 'TRY').formatted}</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 shrink-0">
        <div style={{ animation: 'fadeInUp 0.4s both 0.15s' }} onClick={() => toggleSection('active')} className={`bg-[#0d1322] border rounded-xl p-3 shadow-lg cursor-pointer transition-all hover:border-emerald-500/60 hover:-translate-y-0.5 ${openSections.active ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-800/80'}`}>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">AKTİF ABONELİKLER</span>
            <div className="flex items-center gap-1.5"><div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg"><CheckCircle2 size={14} /></div>{openSections.active ? <ChevronUp size={12} className="text-slate-400" /> : <ChevronDown size={12} className="text-slate-400" />}</div>
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-emerald-400">{activeSubs.length} <span className="text-sm font-normal text-emerald-400/70 font-sans">Kişi</span></div>
          {openSections.active && (
            <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5 text-xs animate-in fade-in slide-in-from-top-2 duration-300 h-32 overflow-y-auto custom-scrollbar" onClick={e=>e.stopPropagation()}>
              {activeSubs.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-slate-500 h-full opacity-60">
                  <Inbox size={20} className="mb-1" />
                  <p className="text-[10px]">Aktif abone yok</p>
                </div>
              ) : activeSubs.map(s => (
                <div key={s.id} className="flex justify-between items-center border-b border-slate-800/50 pb-1.5"><span className="text-slate-300 font-medium">{s.username}</span><span className="text-[10px] text-emerald-400/80 font-mono">{getDaysRemaining(s.end_date)} Gün</span></div>
              ))}
            </div>
          )}
        </div>

        <div style={{ animation: 'fadeInUp 0.4s both 0.2s' }} onClick={() => toggleSection('renewing')} className={`bg-[#0d1322] border rounded-xl p-3 shadow-lg cursor-pointer transition-all hover:border-orange-500/60 hover:-translate-y-0.5 ${openSections.renewing ? 'border-orange-500 ring-1 ring-orange-500' : 'border-slate-800/80'}`}>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">YAKLAŞAN / BİTEN (15 GÜN)</span>
            <div className="flex items-center gap-1.5"><div className="p-1.5 bg-orange-500/10 text-orange-400 rounded-lg"><Clock size={14} /></div>{openSections.renewing ? <ChevronUp size={12} className="text-slate-400" /> : <ChevronDown size={12} className="text-slate-400" />}</div>
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-orange-400">{renewingSubs.length} <span className="text-sm font-normal text-orange-400/70 font-sans">Kişi</span></div>
          {openSections.renewing && (
            <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5 text-xs animate-in fade-in slide-in-from-top-2 duration-300 h-32 overflow-y-auto custom-scrollbar" onClick={e=>e.stopPropagation()}>
              {renewingSubs.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-slate-500 h-full opacity-60">
                  <CheckCircle2 size={20} className="mb-1" />
                  <p className="text-[10px]">Tüm aboneler güvende</p>
                </div>
              ) : renewingSubs.map(s => {
                const days = getDaysRemaining(s.end_date);
                return (
                  <div key={s.id} className="flex justify-between items-center border-b border-slate-800/50 pb-1.5"><span className="text-slate-300 font-medium">{s.username}</span><span className={`text-[10px] font-bold font-mono ${days <= 0 ? 'text-rose-400' : 'text-orange-400'}`}>{days <= 0 ? 'Süresi Doldu' : `${days} Gün Kaldı`}</span></div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ animation: 'fadeInUp 0.4s both 0.25s' }} onClick={() => toggleSection('pending')} className={`bg-[#0d1322] border rounded-xl p-3 shadow-lg cursor-pointer transition-all hover:border-rose-500/60 hover:-translate-y-0.5 ${openSections.pending ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800/80'}`}>
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ÖDEME BEKLEYEN FİŞLER</span>
            <div className="flex items-center gap-1.5"><div className="p-1.5 bg-rose-500/10 text-rose-400 rounded-lg"><CreditCard size={14} /></div>{openSections.pending ? <ChevronUp size={12} className="text-slate-400" /> : <ChevronDown size={12} className="text-slate-400" />}</div>
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-rose-400">{pendingPaymentSubs.length} <span className="text-sm font-normal text-rose-400/70 font-sans">Kayıt</span></div>
          {openSections.pending && (
            <div className="mt-3 pt-3 border-t border-slate-800 space-y-1.5 text-xs animate-in fade-in slide-in-from-top-2 duration-300 h-32 overflow-y-auto custom-scrollbar" onClick={e=>e.stopPropagation()}>
              {pendingPaymentSubs.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-slate-500 h-full opacity-60">
                  <CheckCircle2 size={20} className="mb-1" />
                  <p className="text-[10px]">Tüm ödemeler tahsil edilmiş</p>
                </div>
              ) : pendingPaymentSubs.map(s => (
                <div key={s.id} className="flex justify-between items-center border-b border-slate-800/50 pb-1.5"><span className="text-slate-300 font-medium truncate pr-2">{s.username}</span><span className="text-[10px] text-rose-400 font-mono font-bold shrink-0">{formatMoney(s.sale_price, s.currency).formatted}</span></div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ animation: 'fadeInUp 0.4s both 0.3s' }} className="flex-1 bg-[#0d1322] border border-slate-800/80 rounded-xl flex flex-col min-w-0 overflow-hidden shadow-lg">
        <div className="p-3 border-b border-slate-800/80 bg-[#0a0f1d] flex flex-wrap justify-between items-center gap-3 shrink-0">
          <div className="flex gap-2 items-center flex-1">
            <div className="relative w-full max-w-xs"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input type="text" placeholder="Kullanıcı, ad soyad veya referans..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-[11px] text-slate-200 focus:outline-none focus:border-pink-500/50 transition-all" /></div>
            <select value={selectedCompanyFilter} onChange={(e) => setSelectedCompanyFilter(e.target.value)} className="bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-[11px] text-slate-300 focus:outline-none focus:border-pink-500/50 transition-colors"><option value="all">Tüm Şirketler</option><option value="common">Ortak İşlemler</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </div>
          <button onClick={openAddModal} className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-pink-900/20"><Plus size={14} /> Yeni Abonelik Satışı</button>
        </div>

        <div className="overflow-y-auto flex-1 custom-scrollbar">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-[#0a0f1d] border-b border-slate-800/80 shadow-sm z-10 text-slate-400">
              <tr>
                <th className="p-3 font-medium">Kullanıcı & Referans</th>
                <th className="p-3 font-medium text-center">Şirket / Merkez</th>
                <th className="p-3 font-medium text-center">Başlangıç / Bitiş</th>
                <th className="p-3 font-medium text-center">Kalan Süre</th>
                <th className="p-3 font-medium text-right">Maliyet & Cüzdan</th>
                <th className="p-3 font-medium text-right text-blue-400">Satış Fiyatı</th>
                <th className="p-3 font-medium text-center">Tahsilat Durumu</th>
                <th className="p-3 font-medium text-center w-24">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredSubs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-500 gap-2 opacity-60 animate-in fade-in duration-500">
                      <div className="p-4 bg-slate-800/30 rounded-full mb-2">
                        <Key size={32} className="opacity-40" />
                      </div>
                      <p className="text-sm font-bold text-slate-400">Henüz hiçbir abonelik kaydı yok</p>
                      <p className="text-[11px] max-w-sm">Dijital lisans veya abonelik satışı yaptığınızda burada listelenecektir.</p>
                    </div>
                  </td>
                </tr>
              ) : filteredSubs.map((sub, index) => {
                const daysRem = getDaysRemaining(sub.end_date)
                
                let statusColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'; let statusIcon = <CheckCircle2 size={12} />; let statusText = `${daysRem} Gün Kaldı`
                if (daysRem <= 0) { statusColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20'; statusIcon = <AlertCircle size={12} />; statusText = 'Süresi Doldu' } 
                else if (daysRem <= 15) { statusColor = 'text-orange-400 bg-orange-500/10 border-orange-500/20'; statusIcon = <AlertCircle size={12} />; statusText = `${daysRem} Gün - Yaklaştı` }

                return (
                  <tr 
                    key={sub.id} 
                    style={{ animation: 'fadeSlideRight 0.3s both', animationDelay: `${0.35 + (index * 0.05)}s` }}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="p-3 align-top">
                      <div className="font-bold text-slate-200 text-xs mb-0.5">{sub.username}</div>
                      <div className="text-slate-400">{sub.full_name} {sub.phone && <span className="opacity-60 ml-1">({sub.phone})</span>}</div>
                      {sub.reference_note && <div className="text-[9px] text-slate-500 mt-1 italic">Ref: {sub.reference_note}</div>}
                    </td>
                    <td className="p-3 align-top text-center"><div className="inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-900/50 px-2 py-1 rounded border border-slate-800">{sub.company ? (sub.company.is_personal ? <Home size={10} className="text-slate-500"/> : <Building size={10} className="text-pink-400/70"/>) : <Globe size={10} className="text-emerald-500/50"/>}{sub.company ? sub.company.name : 'Ortak İşlem'}</div></td>
                    <td className="p-3 align-top text-center font-mono"><div className="text-slate-400">{formatDateTR(sub.start_date)}</div><div className="text-slate-500 text-[9px] my-0.5">↓ 1 Yıl ↓</div><div className={`font-bold ${daysRem <= 15 ? 'text-orange-400' : 'text-slate-300'}`}>{formatDateTR(sub.end_date)}</div></td>
                    <td className="p-3 align-top text-center"><div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${statusColor}`}>{statusIcon} {statusText}</div></td>
                    <td className="p-3 align-top text-right font-mono">
                      {sub.wallet?.name && <div className="text-[9px] text-slate-500 mb-0.5 truncate max-w-[100px] ml-auto">{sub.wallet.name}</div>}
                      <span className="text-rose-300/80">{formatMoney(sub.cost_price, sub.currency).formatted}</span>
                    </td>
                    <td className="p-3 align-top text-right text-blue-400 font-bold font-mono">{formatMoney(sub.sale_price, sub.currency).formatted}</td>
                    
                    <td className="p-3 align-top text-center">
                      {sub.is_paid ? (
                        <div className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded border border-emerald-500/30 text-[10px] font-bold">
                          <Check size={12} /> Ödendi
                        </div>
                      ) : (
                        <button onClick={() => openPaymentModal(sub.id)} className="inline-flex items-center gap-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 px-2.5 py-1 rounded border border-rose-500/30 text-[10px] font-bold transition-all active:scale-95">
                          Tahsil Et
                        </button>
                      )}
                    </td>

                    <td className="p-3 align-top text-center">
                      <div className="flex flex-col gap-1.5 items-center">
                        <button onClick={() => confirmRenewSub(sub)} className="w-full bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/50 text-emerald-400 hover:text-white px-2 py-1 rounded text-[9px] font-bold transition-all active:scale-95 flex items-center justify-center gap-1"><RefreshCw size={10} /> +1 Yıl Uzat</button>
                        <div className="flex items-center justify-center gap-2 w-full mt-1">
                          <button onClick={() => openEditModal(sub)} className="text-slate-500 hover:text-blue-400 transition-colors" title="Düzenle"><Edit3 size={12} /></button>
                          <button onClick={() => confirmDeleteSub(sub)} className="text-slate-600 hover:text-rose-400 transition-colors" title="Sil"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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

      {/* --- DİĞER MODALLAR --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 99999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl w-full max-w-lg p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Key size={16} className="text-pink-500" /> {editingId ? 'Abonelik Düzenle' : 'Yeni Lisans / Abonelik Satışı'}</h3>
            <form onSubmit={handleSaveSub} className="grid grid-cols-2 gap-3 text-[11px]">
              <div className="col-span-2">
                <label className="block text-slate-400 mb-1 font-bold">Aboneliği Yapan Şirket/Merkez *</label>
                <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-pink-500 transition-colors"><option value="common">🌍 Ortak / Bağımsız İşlem</option><optgroup label="Ticari Şirketler">{companies.filter(c => !c.is_personal).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup><optgroup label="Şahsi Merkezler">{companies.filter(c => c.is_personal).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup></select>
              </div>
              <div><label className="block text-slate-400 mb-1">Kullanıcı Adı (Username) *</label><input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-pink-500 transition-colors" /></div>
              <div><label className="block text-slate-400 mb-1">Ad Soyad / Firma Adı *</label><input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-pink-500 transition-colors" /></div>
              <div><label className="block text-slate-400 mb-1">Telefon</label><input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-pink-500 transition-colors" /></div>
              <div><label className="block text-slate-400 mb-1">Başlangıç Tarihi</label><input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-pink-500 transition-colors" /></div>
              <div className="col-span-2"><label className="block text-slate-400 mb-1">Referans / Satın Alınan Paket Notu</label><input type="text" value={referenceNote} onChange={(e) => setReferenceNote(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-pink-500 transition-colors" /></div>
              <div className="col-span-2 mt-2 pt-3 border-t border-slate-800">
                <label className="block text-slate-400 font-bold mb-2 text-xs">Finans & Kredi Yönetimi</label>
                <div className="flex items-end gap-2">
                  <div className="flex-1"><label className="block text-slate-400 mb-1">Kullanılacak Cüzdan {editingId?'':'*'}</label><select disabled={!!editingId} value={subWalletId} onChange={(e) => setSubWalletId(e.target.value)} required={!editingId} className="w-full bg-[#070b14] border border-slate-700 rounded px-2 py-2 text-white focus:outline-none disabled:opacity-50 transition-colors"><option value="">{editingId ? 'Değiştirilemez' : 'Seçiniz...'}</option>{wallets.map(w => <option key={w.id} value={w.id} disabled={w.balance <= 0}>{w.name} (Kalan: {w.balance})</option>)}</select></div>
                  <div className="flex-1"><label className="block text-slate-400 mb-1">Müşteriye Satış Fiyatı *</label><input type="number" step="0.01" required value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-blue-300 focus:outline-none focus:border-pink-500 font-mono transition-colors" /></div>
                  <div className="w-20"><label className="block text-slate-400 mb-1">Döviz</label><select value={currency} onChange={(e) => setCurrency(e.target.value as any)} className="w-full bg-[#070b14] border border-slate-700 rounded px-2 py-2 text-white focus:outline-none focus:border-pink-500 transition-colors"><option value="TRY">₺</option><option value="USD">$</option><option value="EUR">€</option></select></div>
                </div>
              </div>
              <div className="col-span-2 flex justify-end gap-2 mt-4 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-1.5 rounded text-slate-400 hover:bg-slate-800 transition-colors">İptal</button>
                <button type="submit" className="bg-pink-600 hover:bg-pink-700 text-white px-5 py-1.5 rounded font-medium transition-all active:scale-95 shadow-lg shadow-pink-900/20">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 99999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-white mb-4">Tahsilat Al</h3>
            <form onSubmit={handleReceivePayment} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Tahsilatın Gireceği Kasa / Banka *</label>
                <select required value={paymentSource} onChange={(e) => setPaymentSource(e.target.value)} className="w-full bg-[#070b14] border border-slate-800 rounded px-3 py-2.5 text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors">
                  <option value="">Seçiniz...</option>
                  {cashes.length > 0 && <optgroup label="Nakit Kasalar">{cashes.map(c => <option key={`cash|${c.id}`} value={`cash|${c.id}`}>{c.name}</option>)}</optgroup>}
                  {banks.length > 0 && <optgroup label="Bankalar">{banks.map(b => <option key={`bank|${b.id}`} value={`bank|${b.id}`}>{b.bank_name}</option>)}</optgroup>}
                </select>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded text-[10px] text-emerald-400 leading-relaxed">
                Tutar abonelik bedeli üzerinden hesaplanacak ve seçili kasaya/bankaya aktarılacaktır.
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="px-3 py-1.5 rounded text-slate-400 hover:bg-slate-800 transition-colors">İptal</button>
                <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded font-bold transition-all active:scale-95 shadow-lg shadow-emerald-900/20">Tahsil Et</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isWalletModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 99999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2"><Key size={16} className="text-indigo-500"/> {editingWalletId ? 'Cüzdanı Düzenle' : 'Yeni Kredi Cüzdanı'}</h3>
            <form onSubmit={handleSaveWallet} className="space-y-3 text-xs">
              <div><label className="block text-slate-400 mb-1">Cüzdan Adı *</label><input type="text" required placeholder="Örn: Pixverse Yıllık Krediler" value={walletName} onChange={(e) => setWalletName(e.target.value)} className="w-full bg-[#070b14] border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors" /></div>
              <div><label className="block text-slate-400 mb-1">Alım Yapılacak Tedarikçi *</label><select required value={walletSupplierId} onChange={(e) => setWalletSupplierId(e.target.value)} className="w-full bg-[#070b14] border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"><option value="">Tedarikçi Seçin...</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}</select></div>
              <div><label className="block text-slate-400 mb-1">Standart Döviz Cinsi</label><select disabled={!!editingWalletId} value={walletCurrency} onChange={(e) => setWalletCurrency(e.target.value)} className="w-full bg-[#070b14] border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50 transition-colors"><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option><option value="TRY">TRY (₺)</option></select></div>
              
              <div className="flex gap-2 mt-2 pt-3 border-t border-slate-800">
                 <div className="w-1/2">
                    <label className="block text-slate-400 mb-1">Açılış Kredisi (Adet)</label>
                    <input type="number" placeholder="0" value={walletOpeningBalance} onChange={(e) => setWalletOpeningBalance(e.target.value)} className="w-full bg-[#070b14] border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors" />
                 </div>
                 <div className="w-1/2">
                    <label className="block text-slate-400 mb-1">Birim Maliyeti</label>
                    <input type="number" step="0.01" placeholder="0.00" value={walletOpeningCost} onChange={(e) => setWalletOpeningCost(e.target.value)} className="w-full bg-[#070b14] border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors" />
                 </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsWalletModalOpen(false)} className="px-3 py-1.5 rounded text-slate-400 hover:bg-slate-800 transition-colors">İptal</button>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded font-medium transition-all active:scale-95 shadow-lg shadow-indigo-900/20">{editingWalletId ? 'Güncelle' : 'Oluştur'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLoadModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 99999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-white mb-4">Cüzdana Kredi Yükle</h3>
            <form onSubmit={handleLoadCredit} className="space-y-3 text-xs">
              <div className="flex gap-2">
                <div className="flex-1"><label className="block text-slate-400 mb-1">Alınan Miktar (Kredi/Adet)</label><input type="number" required placeholder="Örn: 10" value={loadQty} onChange={(e) => setLoadQty(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500 transition-colors" /></div>
                <div className="flex-1"><label className="block text-slate-400 mb-1">Birim Fiyat (Maliyet)</label><input type="number" step="0.01" required placeholder="0.00" value={loadPrice} onChange={(e) => setLoadPrice(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500 transition-colors" /></div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1"><label className="block text-slate-400 mb-1">Alım Dövizi</label><select value={loadCurrency} onChange={(e) => setLoadCurrency(e.target.value as any)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"><option value="TRY">₺ TRY</option><option value="USD">$ USD</option><option value="EUR">€ EUR</option></select></div>
                {loadCurrency !== 'TRY' && <div className="flex-1"><label className="block text-slate-400 mb-1">Mütabakat Kuru</label><input type="number" step="0.0001" required value={loadExRate} onChange={(e) => setLoadExRate(e.target.value)} className="w-full bg-indigo-900/20 text-indigo-300 border border-indigo-500/30 rounded px-3 py-2 focus:outline-none font-mono transition-colors" /></div>}
              </div>
              <div className="bg-rose-500/10 border border-rose-500/20 p-2.5 rounded text-[10px] text-rose-300 mt-2 leading-relaxed">
                <strong>Dikkat:</strong> Kaydedildiğinde seçili tedarikçinin cari hesabına borç eklenecek ve FIFO maliyetiniz güncellenecektir.
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsLoadModalOpen(false)} className="px-3 py-1.5 rounded text-slate-400 hover:bg-slate-800 transition-colors">İptal</button>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded font-bold transition-all active:scale-95 shadow-lg shadow-indigo-900/20">Satın Al & Yükle</button>
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
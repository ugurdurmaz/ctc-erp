'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/lib/utils'
import toast, { Toaster } from 'react-hot-toast'
import { Receipt, Plus, Trash2, Edit3, Search, Tags, Landmark, Wallet, CreditCard, PieChart, Building, Home, AlertTriangle, RefreshCw } from 'lucide-react'

type Category = { id: string; name: string }
type Company = { id: string; name: string; is_personal: boolean }
type BankAccount = { id: string; bank_name: string; account_name: string; balance: number; currency: string }
type CashRegister = { id: string; name: string; balance: number; currency: string }
type CreditCardItem = { id: string; name: string; current_debt: number }

type ExpenseTransaction = {
  id: string; category_id: string; company_id: string; tx_date: string; description: string;
  amount: number; currency: string; exchange_rate: number;
  payment_source_type: string; payment_source_id: string; transfer_id?: string;
  category?: { name: string };
  company?: { name: string; is_personal: boolean };
}

function getLocalTodayISO() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` }
function formatDateTR(dateStr: string) { if (!dateStr) return ''; const parts = dateStr.split('-'); if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`; return dateStr }

// Ortak Log Atma Fonksiyonu
async function logActivity(module: string, action: string, description: string, recordId: string | null = null, amount: number = 0, currency: string = '', oldData: any = null, newData: any = null, companyId: string | null = null) {
  try {
    await supabase.from('audit_logs').insert([{
      module, action, description, record_id: recordId, amount, currency, old_data: oldData, new_data: newData, company_id: companyId
    }])
  } catch (err) {
    console.error("Log kaydı atılamadı:", err)
  }
}

export default function ExpensesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [expenses, setExpenses] = useState<ExpenseTransaction[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  const [banks, setBanks] = useState<BankAccount[]>([])
  const [cashes, setCashes] = useState<CashRegister[]>([])
  const [cards, setCards] = useState<CreditCardItem[]>([])
  const [rates, setRates] = useState<{ USD: number; EUR: number }>({ USD: 34.25, EUR: 37.80 })

  const [isCatModalOpen, setIsCatModalOpen] = useState(false)
  const [editingCatId, setEditingCatId] = useState<string | null>(null)
  const [newCatName, setNewCatName] = useState('')

  const todayISO = getLocalTodayISO()
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

  useEffect(() => { fetchExchangeRates(); fetchCategories(); fetchCompanies(); fetchPaymentSources(); fetchExpenses() }, [])

  useEffect(() => {
    if (txCurrency === 'USD') setTxExchangeRate(rates.USD.toString())
    else if (txCurrency === 'EUR') setTxExchangeRate(rates.EUR.toString())
    else setTxExchangeRate('1')
  }, [txCurrency, rates])

  async function fetchExchangeRates() {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' }); const data = await res.json()
      if (data && data.rates) setRates({ USD: Number(data.rates.TRY.toFixed(4)), EUR: Number((data.rates.TRY / data.rates.EUR).toFixed(4)) })
    } catch (err) { console.error(err) }
  }

  async function fetchCategories() {
    const { data } = await supabase.from('expense_categories').select('*').order('name', { ascending: true })
    setCategories(data || [])
  }

  async function fetchCompanies() {
    const { data } = await supabase.from('companies').select('*').order('name', { ascending: true })
    setCompanies(data || [])
  }

  async function fetchPaymentSources() {
    const { data: bData } = await supabase.from('bank_accounts').select('id, bank_name, account_name, balance, currency')
    const { data: cData } = await supabase.from('cash_registers').select('id, name, balance, currency')
    const { data: cdData } = await supabase.from('credit_cards').select('id, name, current_debt')
    setBanks(bData || []); setCashes(cData || []); setCards(cdData || [])
  }

  async function fetchExpenses() {
    const { data } = await supabase.from('expense_transactions').select('*, category:expense_categories(name), company:companies(name, is_personal)').order('tx_date', { ascending: false }).order('created_at', { ascending: false })
    setExpenses(data || [])
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
  // =========================================================================================

  function openAddCategoryModal() { setEditingCatId(null); setNewCatName(''); setIsCatModalOpen(true) }
  function openEditCategoryModal(cat: Category) { setEditingCatId(cat.id); setNewCatName(cat.name); setIsCatModalOpen(true) }

  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault(); if (!newCatName.trim()) return
    try {
      if (editingCatId) {
        const oldCat = categories.find(c => c.id === editingCatId)
        const payload = { name: newCatName.trim() }
        await supabase.from('expense_categories').update(payload).eq('id', editingCatId)
        
        await logActivity('expense_category', 'UPDATE', `Gider kategorisi güncellendi: ${payload.name}`, editingCatId, 0, '', oldCat, payload, null)
        toast.success('Kategori başarıyla güncellendi.')
      } else {
        const payload = { name: newCatName.trim() }
        const { data, error } = await supabase.from('expense_categories').insert([payload]).select().single()
        if (error) throw error
        
        await logActivity('expense_category', 'INSERT', `Yeni gider kategorisi oluşturuldu: ${payload.name}`, data.id, 0, '', null, data, null)
        toast.success('Yeni kategori oluşturuldu.')
      }
      setIsCatModalOpen(false); setNewCatName(''); setEditingCatId(null); fetchCategories()
    } catch (err: any) { toast.error("Kategori kaydedilemedi: " + err.message) }
  }

  function handleDeleteCategory(id: string) {
    setConfirmDialog({
      isOpen: true,
      title: 'Kategoriyi Sil',
      message: 'Bu gider kategorisini silmek istediğinize emin misiniz? Eğer bu kategoriye bağlı geçmiş giderler varsa, silme işlemi iptal edilecektir.',
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        try { 
          const catToDelete = categories.find(c => c.id === id)
          const { error } = await supabase.from('expense_categories').delete().eq('id', id); 
          if (error) throw error; 
          
          await logActivity('expense_category', 'DELETE', `Gider kategorisi silindi: ${catToDelete?.name}`, id, 0, '', catToDelete, null, null)
          toast.success('Kategori başarıyla silindi.')
          fetchCategories() 
        } 
        catch(err:any) { toast.error("Silinemedi! Bu kategoriye ait kayıtlı giderler var.") }
      }
    })
  }

  async function modifyPaymentSourceBalance(sourceType: string, sourceId: string, amount: number, txCurr: string, customRate: number, action: 'payment' | 'reverse', relatedTxId: string, dateStr: string, expDesc: string, compName: string, compId: string | null) {
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
          [txIdField]: sourceId,
          company_id: compId,
          tx_date: dateStr,
          description: `Gider Ödemesi [${compName || 'Ortak İşlem'}] - ${expDesc}`,
          amount: convertedAmount,
          currency: accCurr,
          exchange_rate: 1,
          is_transfer: false,
          transfer_id: `EXP-${relatedTxId}`
        }

        if (sourceType === 'card') {
          payload.tx_type = 'expense' // Kredi kartı için expense olarak işaretlendi
        } else {
          payload.tx_type = 'out'
        }
        
        if (sourceType === 'bank') payload.status = 'completed'

        await supabase.from(txTable).insert([payload])
      } else if (action === 'reverse') {
        await supabase.from(txTable).delete().eq('transfer_id', `EXP-${relatedTxId}`)
      }
    }

    // İlgili modülün mutlak hesabını tetikleyelim
    if (sourceType === 'cash') await recalculateAbsoluteCashBalance(sourceId)
    if (sourceType === 'bank') await recalculateAbsoluteBankBalance(sourceId)
    if (sourceType === 'card') await recalculateAbsoluteCardDebt(sourceId)
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault()
    const amountNum = parseFloat(txAmount); const rateNum = txCurrency === 'TRY' ? 1 : (parseFloat(txExchangeRate) || 1)
    if (!amountNum || !txCategoryId || !txCompanyId || !paymentSource) return toast.error("Lütfen Tutar, Şirket/Ev, Kategori ve Ödeme Kaynağını eksiksiz girin.")

    try {
      const parts = paymentSource.split('|'); const pType = parts[0]; const pId = parts[1]
      const trfId = `EXP-${Date.now()}`
      const compName = companies.find(c => c.id === txCompanyId)?.name || '';
      const finalCompId = txCompanyId === 'common' ? null : txCompanyId

      const payload = {
        category_id: txCategoryId, company_id: finalCompId, tx_date: txDate, description: txDesc, amount: amountNum, currency: txCurrency, exchange_rate: rateNum, payment_source_type: pType, payment_source_id: pId, transfer_id: trfId
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
      setTxDesc(''); setTxAmount(''); fetchExpenses(); fetchPaymentSources()
    } catch (err: any) { toast.error('Kayıt Hatası: ' + err.message) }
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
          const oldTx = expenses.find(t => t.id === txId); if (!oldTx) return
          const oldRate = oldTx.exchange_rate || 1

          if (oldTx.payment_source_type && oldTx.payment_source_id) {
            const compName = oldTx.company?.name || '';
            await modifyPaymentSourceBalance(oldTx.payment_source_type, oldTx.payment_source_id, oldTx.amount, oldTx.currency || 'TRY', oldRate, 'reverse', oldTx.id, oldTx.tx_date, oldTx.description, compName, oldTx.company_id || null)
          }

          await supabase.from('expense_transactions').delete().eq('id', txId)
          
          // LOG KAYDI
          await logActivity('expense', 'DELETE', `Gider silindi ve iade edildi: ${oldTx.description}`, txId, oldTx.amount, oldTx.currency || 'TRY', oldTx, null, oldTx.company_id)

          toast.success('Gider silindi ve tutar hesaba iade edildi.')
          fetchExpenses(); fetchPaymentSources()
        } catch (err: any) { toast.error("Silme Hatası: " + err.message) }
      }
    })
  }

  const getPaymentSourceName = (type: string, id: string) => {
    if (type === 'cash') return cashes.find(c => c.id === id)?.name || 'Kasa'
    if (type === 'bank') return banks.find(b => b.id === id)?.bank_name || 'Banka'
    if (type === 'card') return cards.find(c => c.id === id)?.name || 'Kredi Kartı'
    return ''
  }

  const filteredExpenses = expenses.filter(e => 
    e.description?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.category?.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.company?.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalCommercialTry = expenses.filter(e => e.company && !e.company.is_personal).reduce((acc, e) => acc + (e.amount * (e.exchange_rate || 1)), 0)
  const totalPersonalTry = expenses.filter(e => e.company && e.company.is_personal).reduce((acc, e) => acc + (e.amount * (e.exchange_rate || 1)), 0)

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] relative">
      {/* TOASTER KONTEYNER Z-INDEX DEĞERİ MAX VE POZİSYONU BOTTOM-RIGHT YAPILDI */}
      <Toaster position="bottom-right" containerStyle={{ zIndex: 99999999 }} toastOptions={{ style: { background: '#0f172a', color: '#fff', border: '1px solid #1e293b', fontSize: '12px' } }} />

      <div style={{ animation: 'fadeInDown 0.4s both' }} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0d1322] border border-slate-800/80 p-4 rounded-xl shadow-md shrink-0 mb-4 transition-colors">
        <div className="flex items-center gap-3 text-white">
          <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg"><Receipt size={24} /></div>
          <div><h2 className="font-bold text-lg leading-none">Genel Giderler & Masraflar</h2><p className="text-[10px] text-slate-400 mt-1">Holding, iştirak ve şahsi masraf takibi</p></div>
        </div>
        <div className="flex items-center gap-6 text-xs font-mono">
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-slate-400 font-sans tracking-wide">TİCARİ (ŞİRKET) GİDERLERİ</span>
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

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        <div className="w-full lg:w-[350px] flex flex-col gap-4 shrink-0">
          
          {/* Şirket / Şahsi Dağılımları Paneli */}
          <div style={{ animation: 'fadeInUp 0.4s both 0.1s' }} className="bg-[#0d1322] border border-slate-800/80 rounded-xl flex flex-col shrink-0 max-h-[50%] shadow-lg">
            <div className="p-3 border-b border-slate-800/80 bg-[#0a0f1d] rounded-t-xl shrink-0">
              <span className="text-xs font-bold text-slate-300">Merkez Bazlı Dağılım</span>
            </div>
            <div className="overflow-y-auto custom-scrollbar p-2 space-y-3">
              <div>
                <div className="text-[9px] font-bold text-slate-500 uppercase px-2 mb-1.5">Ticari Şirketler</div>
                <div className="space-y-1.5">
                  {companies.filter(c => !c.is_personal).map((c, index) => {
                    const compTotal = expenses.filter(e => e.company_id === c.id).reduce((acc, e) => acc + (e.amount * (e.exchange_rate || 1)), 0)
                    return (
                      <div 
                        key={c.id} 
                        style={{ animation: 'fadeInUp 0.3s both', animationDelay: `${0.15 + (index * 0.05)}s` }}
                        className="flex items-center justify-between py-2 px-3 rounded-lg border bg-[#070b14] border-slate-800/50 hover:border-slate-700 transition-colors hover:-translate-y-0.5"
                      >
                        <div className="flex-1 min-w-0 pr-2 flex items-center gap-2"><Building size={12} className="text-indigo-400 shrink-0"/><h4 className="text-[11px] font-bold text-slate-200 truncate">{c.name}</h4></div>
                        <div className="text-right shrink-0">
                          {compTotal > 0 ? <div className="text-[11px] font-mono font-bold text-rose-400">{formatMoney(compTotal, 'TRY').formatted}</div> : <span className="text-[10px] text-slate-600">-</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="text-[9px] font-bold text-slate-500 uppercase px-2 mb-1.5">Şahsi / Ev Merkezleri</div>
                <div className="space-y-1.5">
                  {companies.filter(c => c.is_personal).map((c, index) => {
                    const compTotal = expenses.filter(e => e.company_id === c.id).reduce((acc, e) => acc + (e.amount * (e.exchange_rate || 1)), 0)
                    return (
                      <div 
                        key={c.id} 
                        style={{ animation: 'fadeInUp 0.3s both', animationDelay: `${0.2 + (index * 0.05)}s` }}
                        className="flex items-center justify-between py-2 px-3 rounded-lg border bg-[#0f172a] border-slate-700/50 hover:border-slate-600 transition-colors hover:-translate-y-0.5"
                      >
                        <div className="flex-1 min-w-0 pr-2 flex items-center gap-2"><Home size={12} className="text-slate-400 shrink-0"/><h4 className="text-[11px] font-bold text-slate-300 truncate">{c.name}</h4></div>
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

          {/* Kategori Dağılımları */}
          <div style={{ animation: 'fadeInUp 0.4s both 0.2s' }} className="bg-[#0d1322] border border-slate-800/80 rounded-xl flex flex-col flex-1 min-h-0 shadow-lg">
            <div className="p-3 border-b border-slate-800/80 bg-[#0a0f1d] rounded-t-xl flex justify-between items-center shrink-0">
              <span className="text-xs font-bold text-slate-300">Gider Kategorileri</span>
              <button onClick={openAddCategoryModal} className="bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded text-[10px] font-bold transition-all active:scale-95 flex items-center gap-1"><Plus size={12}/> Yeni</button>
            </div>
            <div className="overflow-y-auto flex-1 custom-scrollbar p-2 space-y-1.5">
              {categories.length === 0 ? (
                 <div className="flex flex-col items-center justify-center text-slate-500 text-[11px] mt-10 opacity-60 animate-in fade-in duration-500">
                   <Tags size={24} className="mb-2" />
                   <p>Kategori bulunamadı.</p>
                 </div>
              ) : categories.map((c, index) => {
                 const catTotal = expenses.filter(e => e.category_id === c.id).reduce((acc, e) => acc + (e.amount * (e.exchange_rate || 1)), 0)
                 return (
                   <div 
                     key={c.id} 
                     style={{ animation: 'fadeInUp 0.3s both', animationDelay: `${0.25 + (index * 0.05)}s` }}
                     className="flex items-center justify-between py-2 px-3 rounded-lg border bg-[#070b14] border-slate-800/50 hover:border-slate-700 transition-colors hover:-translate-y-0.5"
                   >
                      <div className="flex-1 min-w-0 pr-2 flex items-center gap-2">
                        {catTotal > 0 ? <PieChart size={12} className="text-slate-500 shrink-0"/> : <Tags size={12} className="text-slate-600 shrink-0"/>}
                        <h4 className={`text-[11px] truncate ${catTotal > 0 ? 'font-bold text-slate-200' : 'font-medium text-slate-400'}`}>{c.name}</h4>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-3">
                        {catTotal > 0 && <div className="text-[11px] font-mono font-bold text-rose-400">{formatMoney(catTotal, 'TRY').formatted}</div>}
                        <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
                           <button onClick={() => openEditCategoryModal(c)} className="text-slate-500 hover:text-amber-400 transition-colors" title="Düzenle"><Edit3 size={12} /></button>
                           <button onClick={() => handleDeleteCategory(c.id)} className="text-slate-600 hover:text-rose-400 transition-colors" title="Sil"><Trash2 size={12} /></button>
                        </div>
                      </div>
                   </div>
                 )
              })}
            </div>
          </div>
        </div>

        <div style={{ animation: 'fadeInUp 0.4s both 0.3s' }} className="flex-1 bg-[#0d1322] border border-slate-800/80 rounded-xl flex flex-col min-w-0 shadow-lg">
          <div className="p-4 overflow-y-auto custom-scrollbar flex-1 flex flex-col">
            
            {/* Gider Ekleme Formu */}
            <form onSubmit={handleAddExpense} style={{ animation: 'fadeInUp 0.4s both 0.4s' }} className="flex flex-wrap items-end gap-2.5 mb-5 bg-[#070b14] p-3 rounded-lg border border-slate-800 shrink-0 hover:border-slate-700 transition-colors">
              <div className="w-28"><label className="block text-[9px] text-slate-400 mb-0.5">Tarih</label><input type="date" required value={txDate} onChange={(e) => setTxDate(e.target.value)} className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors" /></div>
              
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

              <div className="w-32"><label className="block text-[9px] text-slate-400 mb-0.5">Kategori *</label><select value={txCategoryId} onChange={(e) => setTxCategoryId(e.target.value)} required className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors"><option value="">Kategori Seç...</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="w-36"><label className="block text-[9px] text-slate-400 mb-0.5">Ödeme Kaynağı *</label><select value={paymentSource} onChange={(e) => setPaymentSource(e.target.value)} required className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors"><option value="">Seçiniz</option>{cashes.length > 0 && <optgroup label="Nakit Kasalar">{cashes.map(c => <option key={`cash|${c.id}`} value={`cash|${c.id}`}>{c.name}</option>)}</optgroup>}{banks.length > 0 && <optgroup label="Bankalar">{banks.map(b => <option key={`bank|${b.id}`} value={`bank|${b.id}`}>{b.bank_name}</option>)}</optgroup>}{cards.length > 0 && <optgroup label="Kredi Kartları">{cards.map(c => <option key={`card|${c.id}`} value={`card|${c.id}`}>{c.name}</option>)}</optgroup>}</select></div>
              <div className="flex-1 min-w-[120px]"><label className="block text-[9px] text-slate-400 mb-0.5">Açıklama</label><input type="text" required placeholder="Nereye harcandı?" value={txDesc} onChange={(e) => setTxDesc(e.target.value)} className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors" /></div>
              <div className="w-16"><label className="block text-[9px] text-slate-400 mb-0.5">Döviz</label><select value={txCurrency} onChange={(e) => setTxCurrency(e.target.value as any)} className="w-full bg-[#0d1322] border border-slate-700 rounded px-1.5 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors"><option value="TRY">₺</option><option value="USD">$</option><option value="EUR">€</option></select></div>
              {txCurrency !== 'TRY' && (<div className="w-16"><label className="block text-[9px] text-slate-400 mb-0.5">Kur</label><input type="number" step="0.0001" required value={txExchangeRate} onChange={(e) => setTxExchangeRate(e.target.value)} className="w-full bg-rose-900/20 text-rose-300 border border-rose-500/30 rounded px-2 py-1.5 text-[11px] focus:outline-none font-mono transition-colors" /></div>)}
              <div className="w-24"><label className="block text-[9px] text-slate-400 mb-0.5">Tutar</label><input type="number" step="0.01" required placeholder="0.00" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-rose-400 font-bold focus:outline-none font-mono transition-colors" /></div>
              <button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 rounded text-[11px] font-bold transition-all active:scale-95 h-[26px]">Ekle</button>
            </form>

            <div className="flex items-center gap-2 mb-3 bg-[#0a0f1d] p-2 rounded-lg border border-slate-800/80 shrink-0">
               <Search size={14} className="text-slate-500 ml-2" />
               <input type="text" placeholder="Giderler, merkezler veya kategoriler arasında ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent border-none text-xs text-white focus:outline-none w-full" />
            </div>

            <div className="border border-slate-800/80 rounded-lg overflow-hidden flex-1 flex flex-col">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-[#0a0f1d] z-10">
                  <tr className="border-b border-slate-800/80 text-slate-400"><th className="p-2.5 font-medium">Tarih</th><th className="p-2.5 font-medium">Kategori & Merkez</th><th className="p-2.5 font-medium">Açıklama & Kaynak</th><th className="p-2.5 font-medium text-right text-rose-400 bg-slate-800/20">Çıkan Tutar</th><th className="p-2.5 font-medium text-center w-12">İşlem</th></tr>
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
                      return (
                      <tr 
                        key={t.id} 
                        style={{ animation: 'fadeSlideRight 0.4s both', animationDelay: `${0.45 + (index * 0.05)}s` }}
                        className="hover:bg-slate-800/30 font-mono transition-colors"
                      >
                        <td className="p-2.5 text-slate-400 align-top">{formatDateTR(t.tx_date)}</td>
                        <td className="p-2.5 text-slate-300 font-sans font-medium align-top flex flex-col items-start gap-1">
                          <span className="bg-slate-800 px-2 py-0.5 rounded-full text-[10px]">{t.category?.name}</span>
                          <span className={`text-[9px] flex items-center gap-1 ${isPersonal ? 'text-slate-400' : 'text-indigo-400'}`}>
                            {isPersonal ? <Home size={10}/> : <Building size={10}/>}
                            {t.company?.name}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-200 font-sans align-top">
                          <div className="mb-1">{t.description}</div>
                          {t.payment_source_type && t.payment_source_id && (<div className="text-[9px] text-slate-500 flex items-center gap-1">{t.payment_source_type === 'cash' ? <Wallet size={10}/> : t.payment_source_type === 'bank' ? <Landmark size={10}/> : <CreditCard size={10}/>} Çıkış: <strong className="text-slate-400">{getPaymentSourceName(t.payment_source_type, t.payment_source_id)}</strong></div>)}
                        </td>
                        <td className="p-2.5 text-right text-rose-400 font-bold align-top leading-tight bg-slate-800/10">
                          <div className="flex flex-col"><span>{formatMoney(t.amount, t.currency || 'TRY').formatted}</span>{t.currency !== 'TRY' && <span className="text-[9px] text-rose-400/50 mt-0.5">{rateStr}{formatMoney(tryEquivalent, 'TRY').formatted}</span>}</div>
                        </td>
                        <td className="p-2.5 text-center align-top"><button onClick={() => handleDeleteExpense(t.id)} className="text-slate-600 hover:text-rose-400 transition-colors" title="Gideri İptal Et ve Parayı Geri Al"><Trash2 size={12} /></button></td>
                      </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>
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

      {/* --- KATEGORİ EKLEME/DÜZENLEME MODALI --- */}
      {isCatModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 9999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Tags size={16} className="text-rose-500" /> {editingCatId ? 'Kategoriyi Düzenle' : 'Yeni Gider Kategorisi'}</h3>
            <form onSubmit={handleSaveCategory} className="space-y-3 text-[11px]">
              <div><label className="block text-slate-400 mb-1">Kategori Adı *</label><input type="text" required placeholder="Örn: Araç Masrafları" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-rose-500 transition-colors" /></div>
              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-800">
                <button type="button" onClick={() => setIsCatModalOpen(false)} className="px-4 py-1.5 rounded text-slate-400 hover:bg-slate-800 transition-colors">İptal</button>
                <button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-1.5 rounded font-medium transition-all active:scale-95 shadow-lg shadow-rose-900/20">{editingCatId ? 'Güncelle' : 'Oluştur'}</button>
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
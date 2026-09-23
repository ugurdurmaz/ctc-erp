'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/lib/utils'
import toast, { Toaster } from 'react-hot-toast'
import { CreditCard, Plus, Trash2, X, Edit3, Building, Home, Globe, AlertTriangle, RefreshCw } from 'lucide-react'

type Company = { id: string; name: string; is_personal: boolean }

type Card = {
  id: string
  name: string
  card_limit: number
  cutoff_day: number
  current_debt: number
  card_color: string
  company_id?: string | null
  company?: { name: string; is_personal: boolean }
}

type Transaction = {
  id: string
  card_id: string
  company_id?: string | null
  tx_date: string
  description: string
  tx_type: 'expense' | 'payment'
  amount: number
  company?: { name: string; is_personal: boolean }
}

const CARD_COLORS = [
  { label: 'Gece Mavisi (Varsayılan)', value: 'from-[#1b253b] to-[#121a2a]' },
  { label: 'Koyu Grafit', value: 'from-[#27272a] to-[#18181b]' },
  { label: 'Derin Mor', value: 'from-[#3b1f48] to-[#1a0f24]' },
  { label: 'Zümrüt Yeşili', value: 'from-[#133e30] to-[#0a221b]' },
  { label: 'Koyu Bordo', value: 'from-[#4a1c1c] to-[#240d0d]' },
  { label: 'Okyanus Laciverti', value: 'from-[#1e3a8a] to-[#0f172a]' },
  { label: 'Metalik Titanyum', value: 'from-[#334155] to-[#0f172a]' },
  { label: 'Bronz Kahve', value: 'from-[#451a03] to-[#1c0a00]' },
  { label: 'Neon Gece', value: 'from-[#0f172a] to-[#312e81]' },
  { label: 'Kömür Siyahı', value: 'from-[#18181b] to-[#09090b]' },
  { label: 'Koyu Safir', value: 'from-[#172554] to-[#020617]' },
  { label: 'Koyu Gece Yeşili', value: 'from-[#064e3b] to-[#022c22]' },
  { label: 'Koyu Erik Moru', value: 'from-[#581c87] to-[#3b0764]' },
  { label: 'Koyu Yakut Kırmızısı', value: 'from-[#881337] to-[#4c0519]' },
]

function getLocalTodayISO() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function formatDateTR(dateStr: string) {
  if (!dateStr) return ''
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-')
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`
  }
  return dateStr
}

import { logActivity } from '@/lib/audit'
import { useAuth } from '@/lib/auth-context'

export default function CreditCardsPage() {
  const { profile, isAdmin } = useAuth()
  const isRestricted = !isAdmin && !!profile?.allowed_companies && profile.allowed_companies.length > 0

  const [companies, setCompanies] = useState<Company[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const [isCardModalOpen, setIsCardModalOpen] = useState(false)
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [cardName, setCardName] = useState('')
  const [cardLimit, setCardLimit] = useState('')
  const [cutoffDay, setCutoffDay] = useState('15')
  const [openingDebt, setOpeningDebt] = useState('')
  const [cardColor, setCardColor] = useState(CARD_COLORS[0].value)
  const [cardCompanyId, setCardCompanyId] = useState('common')

  const todayISO = getLocalTodayISO()
  const [txDate, setTxDate] = useState(todayISO)
  const [txCompanyId, setTxCompanyId] = useState('common')
  const [txDesc, setTxDesc] = useState('')
  const [txType, setTxType] = useState<'expense' | 'payment'>('expense')
  const [txAmount, setTxAmount] = useState('')

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string; confirmText: string; cancelText: string; isDanger: boolean; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', confirmText: '', cancelText: '', isDanger: false, onConfirm: () => {} })

  useEffect(() => { 
    fetchCompanies()
    fetchCards() 
  }, [isRestricted, profile?.allowed_companies])

  useEffect(() => { 
    if (selectedCardId) fetchTransactions(selectedCardId) 
  }, [selectedCardId])

  async function fetchCompanies() { 
    const { data } = await supabase.from('companies').select('*').order('name', { ascending: true })
    let comps = data || []
    if (isRestricted) {
      comps = comps.filter(c => profile?.allowed_companies?.includes(c.id))
    }
    setCompanies(comps) 
  }

  async function fetchCards() {
    try {
      const { data, error } = await supabase.from('credit_cards').select('*, company:companies(name, is_personal)').order('created_at', { ascending: true })
      if (error) throw error
      
      // Kısıtlı kullanıcı (örn. İbrahim) Ortak / Bağımsız kartları ve yetkisiz şirket kartlarını göremez
      const filtered = (data || []).filter(c => {
        if (!isRestricted) return true
        if (!c.company_id) return false
        return profile?.allowed_companies?.includes(c.company_id)
      })

      setCards(filtered)
      if (filtered.length > 0) {
        setSelectedCardId(prev => {
          if (prev && filtered.some(c => c.id === prev)) return prev
          return filtered[0].id
        })
      } else { 
        setSelectedCardId(null) 
      }
    } catch (err) { 
      console.error(err) 
    } finally { 
      setLoading(false) 
    }
  }

  async function fetchTransactions(cardId: string) {
    const targetCard = cards.find(c => c.id === cardId)
    if (isRestricted && targetCard) {
      if (!targetCard.company_id || !profile?.allowed_companies?.includes(targetCard.company_id)) {
        setTransactions([])
        return
      }
    }
    try {
      const { data, error } = await supabase.from('card_transactions').select('*, company:companies(name, is_personal)').eq('card_id', cardId).order('tx_date', { ascending: false }).order('created_at', { ascending: false })
      if (error) throw error
      setTransactions(data || [])
    } catch (err) { console.error(err) }
  }

  // --- MUTLAK BORÇ HESAPLAMA YARDIMCISI ---
  async function recalculateAbsoluteCardDebt(cardId: string) {
    const { data: txs } = await supabase.from('card_transactions').select('amount, tx_type').eq('card_id', cardId)
    let absoluteDebt = 0
    txs?.forEach(t => { 
      // Harcama borcu artırır (+), Ödeme borcu azaltır (-)
      if (t.tx_type === 'expense') {
        absoluteDebt += Number(t.amount)
      } else {
        absoluteDebt -= Number(t.amount)
      }
    })
    await supabase.from('credit_cards').update({ current_debt: absoluteDebt }).eq('id', cardId)
  }

  function openAddModal() {
    setEditingCardId(null)
    setCardName(''); setCardLimit(''); setCutoffDay('15'); setOpeningDebt(''); setCardColor(CARD_COLORS[0].value)
    const defaultComp = isRestricted && profile?.allowed_companies?.[0] ? profile.allowed_companies[0] : 'common'
    setCardCompanyId(defaultComp)
    setIsCardModalOpen(true)
  }

  async function openEditModal(card: Card, e: React.MouseEvent) {
    e.stopPropagation()
    if (isRestricted && (!card.company_id || !profile?.allowed_companies?.includes(card.company_id))) {
      toast.error('Bu kredi kartını düzenleme yetkiniz bulunmuyor.')
      return
    }
    setEditingCardId(card.id)
    setCardName(card.name); 
    setCardLimit(card.card_limit.toString()); 
    setCutoffDay(card.cutoff_day.toString()); 
    setCardColor(card.card_color || CARD_COLORS[0].value); 
    setCardCompanyId(card.company_id || (isRestricted && profile?.allowed_companies?.[0] ? profile.allowed_companies[0] : 'common'));
    setOpeningDebt('');
    setIsCardModalOpen(true);

    const { data: txs } = await supabase.from('card_transactions')
       .select('amount').eq('card_id', card.id).eq('description', 'Dönem Başı Devir Borcu').limit(1);
    
    if (txs && txs.length > 0) {
      setOpeningDebt(txs[0].amount.toString());
    } else {
      setOpeningDebt('0');
    }
  }

  async function handleSaveCard(e: React.FormEvent) {
    e.preventDefault()
    if (!cardName) return
    const limitNum = parseFloat(cardLimit) || 0
    const cutoffNum = parseInt(cutoffDay) || 1
    const debtNum = openingDebt ? parseFloat(openingDebt) : 0
    const finalCompId = cardCompanyId === 'common' ? null : cardCompanyId

    if (isRestricted) {
      if (cardCompanyId === 'common' || !profile?.allowed_companies?.includes(cardCompanyId)) {
        toast.error('Sadece kendi yetkili şirketiniz adına kredi kartı oluşturabilir veya güncelleyebilirsiniz.')
        return
      }
    }

    try {
      if (editingCardId) {
        const oldCard = cards.find(c => c.id === editingCardId)
        
        const { data: oldTxs } = await supabase.from('card_transactions')
           .select('*').eq('card_id', editingCardId).eq('description', 'Dönem Başı Devir Borcu').limit(1);
        
        const oldTx = oldTxs && oldTxs.length > 0 ? oldTxs[0] : null;

        if (oldTx) {
           if (debtNum === 0) {
              await supabase.from('card_transactions').delete().eq('id', oldTx.id);
           } else {
              await supabase.from('card_transactions').update({ amount: debtNum }).eq('id', oldTx.id);
           }
        } else if (debtNum > 0) {
           const txPayload = { card_id: editingCardId, company_id: finalCompId, tx_date: todayISO, description: 'Dönem Başı Devir Borcu', tx_type: 'expense', amount: debtNum }
           await supabase.from('card_transactions').insert([txPayload]);
        }

        const payload = { name: cardName, card_limit: limitNum, cutoff_day: cutoffNum, card_color: cardColor, company_id: finalCompId }

        const { error } = await supabase.from('credit_cards').update(payload).eq('id', editingCardId)
        if (error) throw error

        // Mutlak borç hesaplaması ile güncel borç senkronize edilir
        await recalculateAbsoluteCardDebt(editingCardId)
        
        await logActivity('credit_card', 'UPDATE', `Kredi kartı güncellendi: ${cardName}`, editingCardId, 0, 'TRY', oldCard, payload, finalCompId)
        toast.success('Kredi kartı başarıyla güncellendi.')

        if (selectedCardId === editingCardId) {
          fetchTransactions(editingCardId);
        }

      } else {
        const payload = { name: cardName, card_limit: limitNum, cutoff_day: cutoffNum, current_debt: 0, card_color: cardColor, company_id: finalCompId }
        const { data, error } = await supabase.from('credit_cards').insert([payload]).select().single()
        if (error) throw error
        
        await logActivity('credit_card', 'INSERT', `Yeni kredi kartı oluşturuldu: ${cardName}`, data.id, 0, 'TRY', null, data, finalCompId)
        
        if (data && debtNum > 0) {
          const txPayload = { card_id: data.id, tx_date: todayISO, description: 'Dönem Başı Devir Borcu', tx_type: 'expense', amount: debtNum, company_id: finalCompId }
          const { data: txData, error: txError } = await supabase.from('card_transactions').insert([txPayload]).select().single()
          if (!txError && txData) {
            await logActivity('card_tx', 'INSERT', `Kart işlemi (Harcama): Dönem Başı Devir Borcu`, txData.id, debtNum, 'TRY', null, txData, finalCompId)
          }
        }

        await recalculateAbsoluteCardDebt(data.id)
        toast.success('Yeni kredi kartı başarıyla oluşturuldu.')
      }
      setIsCardModalOpen(false)
      fetchCards()
    } catch (err: any) { toast.error('İşlem başarısız: ' + err.message) }
  }

  function handleDeleteCard(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    const cardToDelete = cards.find(c => c.id === id)
    if (isRestricted && (!cardToDelete?.company_id || !profile?.allowed_companies?.includes(cardToDelete.company_id))) {
      toast.error('Bu kredi kartını silme yetkiniz bulunmuyor.')
      return
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Kartı Sil',
      message: 'Bu kredi kartını silmek istediğinize emin misiniz? Karta ait tüm harcama ve ödeme geçmişi kalıcı olarak silinecektir.',
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        try {
          const cardToDelete = cards.find(c => c.id === id)
          await supabase.from('credit_cards').delete().eq('id', id)
          
          await logActivity('credit_card', 'DELETE', `Kredi kartı silindi: ${cardToDelete?.name}`, id, cardToDelete?.current_debt, 'TRY', cardToDelete, null, cardToDelete?.company_id)
          
          toast.success('Kredi kartı başarıyla silindi.')
          if (selectedCardId === id) setSelectedCardId(null)
          fetchCards()
        } catch (err: any) { toast.error('Silme işlemi başarısız: ' + err.message) }
      }
    })
  }

  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCardId || !txAmount || !txDesc || !txCompanyId) return
    const amountNum = parseFloat(txAmount)
    const finalCompId = txCompanyId === 'common' ? null : txCompanyId
    const currentCard = cards.find((c) => c.id === selectedCardId)
    if (!currentCard) return

    if (isRestricted) {
      if (!currentCard.company_id || !profile?.allowed_companies?.includes(currentCard.company_id)) {
        toast.error('Bu kart üzerinde işlem yapma yetkiniz bulunmuyor.')
        return
      }
      if (txCompanyId === 'common' || !profile?.allowed_companies?.includes(txCompanyId)) {
        toast.error('Bu işlem için sadece kendi yetkili şirketinizi seçebilirsiniz.')
        return
      }
    }

    try {
      const payload = { card_id: selectedCardId, company_id: finalCompId, tx_date: txDate || todayISO, description: txDesc, tx_type: txType, amount: amountNum }
      const { data, error } = await supabase.from('card_transactions').insert([payload]).select().single()
      if (error) throw error
      
      // Mutlak hesaplama tetiklenir
      await recalculateAbsoluteCardDebt(selectedCardId)
      
      await logActivity('card_tx', 'INSERT', `Kart işlemi (${txType === 'expense' ? 'Harcama' : 'Ödeme'}): ${txDesc}`, data.id, amountNum, 'TRY', null, data, finalCompId)

      toast.success(txType === 'expense' ? 'Harcama kaydedildi.' : 'Ödeme başarıyla işlendi.')
      setTxDesc(''); setTxAmount(''); setTxDate(todayISO)
      fetchTransactions(selectedCardId); fetchCards()
    } catch (err: any) { toast.error('İşlem kaydedilemedi: ' + err.message) }
  }

  function handleDeleteTransaction(txId: string, amount: number, type: 'expense' | 'payment') {
    if (isRestricted && (!selectedCard?.company_id || !profile?.allowed_companies?.includes(selectedCard.company_id))) {
      toast.error('Bu kart hareketini silme yetkiniz bulunmuyor.')
      return
    }

    const txToDelete = transactions.find(t => t.id === txId)
    if (txToDelete?.description?.includes('[SUPP-')) {
      toast.error('Bu hareket Tedarikçiler / Satıcılar modülünden otomatik yansıtılmıştır. Silme işlemini Satıcılar sayfasındaki ilgili hareket üzerinden yapmalısınız.')
      return
    }
    if (txToDelete?.description?.includes('[EXP-')) {
      toast.error('Bu hareket Giderler modülünden otomatik yansıtılmıştır. Silme işlemini Giderler sayfasından yapmalısınız.')
      return
    }

    setConfirmDialog({
      isOpen: true,
      title: 'İşlemi Sil',
      message: 'Bu işlemi silmek istediğinize emin misiniz? İşlem tutarı kart bakiyenize geri yansıtılacaktır.',
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        try {
          const txToDelete = transactions.find(t => t.id === txId)
          await supabase.from('card_transactions').delete().eq('id', txId)
          
          if (selectedCardId) {
            await recalculateAbsoluteCardDebt(selectedCardId)
          }

          await logActivity('card_tx', 'DELETE', `Kart işlemi silindi: ${txToDelete?.description}`, txId, amount, 'TRY', { deleted_tx: txToDelete }, null, txToDelete?.company_id)

          toast.success('İşlem silindi ve bakiye güncellendi.')
          fetchTransactions(selectedCardId!); fetchCards()
        } catch (err: any) { toast.error('Silme başarısız: ' + err.message) }
      }
    })
  }

  const selectedCard = cards.find((c) => c.id === selectedCardId)

  useEffect(() => {
    if (selectedCard?.company_id) {
      setTxCompanyId(selectedCard.company_id)
    } else if (isRestricted && profile?.allowed_companies?.[0]) {
      setTxCompanyId(profile.allowed_companies[0])
    } else {
      setTxCompanyId('common')
    }
  }, [selectedCardId, selectedCard?.company_id, isRestricted, profile?.allowed_companies])

  return (
    <div className="space-y-8 relative animate-in fade-in duration-300">
      {/* TOASTER KONTEYNER Z-INDEX DEĞERİ MAX VE POZİSYONU BOTTOM-RIGHT YAPILDI */}
      <Toaster position="bottom-right" containerStyle={{ zIndex: 99999999 }} toastOptions={{ style: { background: '#0f172a', color: '#fff', border: '1px solid #1e293b', fontSize: '12px' } }} />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 text-white font-bold text-xl">
          <CreditCard className="text-indigo-400" size={24} />
          <h2>Kredi Kartlarım</h2>
          {isRestricted && (
            <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              🏢 {companies.map(c => c.name).join(', ') || 'Tanımlı Şirket'}
            </span>
          )}
        </div>
        <button onClick={openAddModal} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-lg shrink-0">
          <Plus size={16} /><span>Yeni Kart Ekle</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-4">
        {cards.length === 0 && !loading && (
           <div className="w-full flex flex-col items-center justify-center p-12 border border-dashed border-slate-700/50 rounded-2xl bg-[#0d1322]/50 text-slate-500 animate-in fade-in">
             <CreditCard size={48} className="mb-4 opacity-20 animate-bounce" />
             <p className="text-sm font-bold text-slate-400">
               {isRestricted ? 'Tanımlı şirketinize ait kredi kartı bulunmuyor' : 'Henüz hiç kredi kartı eklenmemiş'}
             </p>
             <p className="text-[11px] mt-1">Sağ üstteki butondan yeni bir kredi kartı oluşturabilirsiniz.</p>
           </div>
        )}

        {cards.map((card, idx) => {
          const isSelected = card.id === selectedCardId
          const availableLimit = card.card_limit - card.current_debt
          const debtMoney = formatMoney(card.current_debt)
          const limitMoney = formatMoney(card.card_limit)
          const availMoney = formatMoney(availableLimit)

          return (
            <div
              key={card.id}
              onClick={() => setSelectedCardId(card.id)}
              style={{ 
                aspectRatio: '1.586',
                animationName: 'fadeInUp',
                animationDuration: '0.4s',
                animationFillMode: 'both',
                animationDelay: `${idx * 0.06}s`
              }} 
              className={`relative w-full sm:w-[280px] shrink-0 rounded-xl p-4 cursor-pointer transition-all duration-300 border flex flex-col justify-between select-none shadow-lg bg-gradient-to-br group hover:-translate-y-1 ${card.card_color || CARD_COLORS[0].value} ${
                isSelected ? 'border-indigo-500 shadow-indigo-950/60 ring-2 ring-indigo-500/80 scale-[1.02] z-10' : 'border-slate-800/80 hover:border-slate-600'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="w-8 h-6 rounded bg-gradient-to-tr from-amber-600 via-amber-300 to-amber-500 border border-amber-400/60 p-0.5 flex flex-col justify-between shadow-inner">
                  <div className="w-full h-px bg-amber-800/40" /><div className="w-full h-px bg-amber-800/40" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-300 font-mono">Ekstre: {card.cutoff_day}</span>
                  <div className="flex items-center gap-1 bg-black/40 p-1 rounded backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => openEditModal(card, e)} title="Düzenle" className="text-slate-300 hover:text-indigo-400 p-0.5 transition"><Edit3 size={12} /></button>
                    <button onClick={(e) => handleDeleteCard(card.id, e)} title="Sil" className="text-slate-300 hover:text-rose-400 p-0.5 transition"><Trash2 size={12} /></button>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">GÜNCEL BORÇ</p>
                <div className="font-mono tracking-tight truncate flex items-baseline">
                  <span className="text-xl font-black text-white">{debtMoney.integerPart},</span>
                  <span className="text-sm font-bold text-white/80">{debtMoney.decimalPart}{debtMoney.symbol}</span>
                </div>
                <div className="flex justify-between items-center text-[9px] mt-1.5 text-slate-300 font-mono gap-1">
                  <span className="truncate">Lim: {limitMoney.formatted}</span>
                  <span className="text-emerald-400 font-medium truncate">Mev: {availMoney.formatted}</span>
                </div>
              </div>

              <div className="border-t border-white/10 pt-2 flex items-center justify-between">
                <span className="text-xs font-bold text-white truncate tracking-widest uppercase pr-2">{card.name}</span>
                <span className="bg-black/30 px-1.5 py-0.5 rounded text-[8px] text-white/70 border border-white/10 shrink-0">
                   {card.company ? card.company.name : 'Ortak Kart'}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {selectedCard && (
        <div className="bg-[#0d1322] border border-slate-800/80 rounded-2xl p-6 space-y-6 shadow-xl relative animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className="flex items-center justify-between">
             <h3 className="text-indigo-400 font-bold text-base">{selectedCard.name} Hesap Ekstresi</h3>
             <span className="text-xs text-slate-400 flex items-center gap-1.5">Kart Sahibi: <strong className="text-slate-200">{selectedCard.company ? selectedCard.company.name : 'Ortak / Bağımsız Kart'}</strong></span>
          </div>
          
          <form onSubmit={handleAddTransaction} className="grid grid-cols-1 md:grid-cols-7 gap-3 bg-[#070b14] p-3 rounded-lg border border-slate-800/80">
            <div className="md:col-span-1">
              <label className="block text-[11px] text-slate-400 mb-1">Tarih</label>
              <input type="date" required value={txDate} onChange={(e) => setTxDate(e.target.value)} className="w-full bg-[#0d1322] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none transition-colors" />
            </div>

            <div className="md:col-span-2">
               <label className="block text-[11px] text-slate-400 mb-1">Harcama Kime Ait? *</label>
               <select value={txCompanyId} onChange={(e) => setTxCompanyId(e.target.value)} required className="w-full bg-[#0d1322] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none transition-colors">
                 {!isRestricted && <option value="common">🌍 Ortak / Bağımsız İşlem</option>}
                 <optgroup label="Ticari Şirketler">{companies.filter(c => !c.is_personal && (!isRestricted || profile?.allowed_companies?.includes(c.id))).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                 <optgroup label="Şahsi Merkezler">{companies.filter(c => c.is_personal && (!isRestricted || profile?.allowed_companies?.includes(c.id))).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
               </select>
            </div>

            <div className="md:col-span-1">
              <label className="block text-[11px] text-slate-400 mb-1">İşlem</label>
              <select value={txType} onChange={(e) => setTxType(e.target.value as 'expense' | 'payment')} className="w-full bg-[#0d1322] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none transition-colors">
                <option value="expense">Harcama (-)</option>
                <option value="payment">Ödeme (+)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] text-slate-400 mb-1">Açıklama</label>
              <input type="text" required placeholder="Nereye harcandı?" value={txDesc} onChange={(e) => setTxDesc(e.target.value)} className="w-full bg-[#0d1322] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none transition-colors" />
            </div>

            <div className="md:col-span-1 flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-[11px] text-slate-400 mb-1">Tutar (₺)</label>
                <input type="number" step="0.01" required placeholder="0.00" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} className="w-full bg-[#0d1322] border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none font-mono transition-colors" />
              </div>
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold h-[34px] transition-all active:scale-95 shrink-0">Ekle</button>
            </div>
          </form>

          <div className="overflow-x-auto border border-slate-800/80 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 text-slate-400 bg-[#0a0f1d]">
                  <th className="p-3 font-semibold">Tarih</th>
                  <th className="p-3 font-semibold">Açıklama & Merkez</th>
                  <th className="p-3 font-semibold text-right text-rose-400">Harcama</th>
                  <th className="p-3 font-semibold text-right text-emerald-400">Ödeme</th>
                  <th className="p-3 font-semibold text-right">Bakiye (Borç)</th>
                  <th className="p-3 font-semibold text-center w-12">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-500 gap-2 animate-in fade-in duration-300">
                         <RefreshCw size={32} className="opacity-40 animate-spin" />
                         <p className="text-sm font-bold text-slate-400">Bu karta ait hareket bulunmuyor.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => {
                    const amtMoney = formatMoney(t.amount)
                    const balMoney = formatMoney(selectedCard.current_debt)
                    const isPersonal = t.company?.is_personal
                    return (
                      <tr key={t.id} className="hover:bg-slate-800/30 font-mono transition-colors animate-in fade-in duration-200">
                        <td className="p-3 text-slate-400 align-top">{formatDateTR(t.tx_date)}</td>
                        <td className="p-3 text-slate-200 font-sans align-top">
                           <div className="mb-1 flex items-center gap-1.5 flex-wrap">
                             <span>{t.description.replace(/\s*\[(SUPP|EXP|POS)-[^\]]+\]/g, '')}</span>
                             {t.description.includes('[SUPP-') && (
                               <span className="text-[9px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.5 rounded font-sans">
                                 Tedarikçi Ödemesi
                               </span>
                             )}
                             {t.description.includes('[EXP-') && (
                               <span className="text-[9px] bg-rose-500/10 text-rose-300 border border-rose-500/20 px-1.5 py-0.5 rounded font-sans">
                                 Genel Gider
                               </span>
                             )}
                           </div>
                           <div className="flex items-center gap-1 text-[9px] text-slate-500">
                             {t.company ? (isPersonal ? <Home size={10} className="text-slate-400"/> : <Building size={10} className="text-indigo-400"/>) : <Globe size={10} className="text-emerald-500/70"/>}
                             {t.company ? t.company.name : 'Ortak İşlem'}
                           </div>
                        </td>
                        <td className="p-3 text-right text-rose-400 align-top font-medium">{t.tx_type === 'expense' ? amtMoney.formatted : '-'}</td>
                        <td className="p-3 text-right text-emerald-400 align-top font-medium">{t.tx_type === 'payment' ? amtMoney.formatted : '-'}</td>
                        <td className="p-3 text-right font-bold text-white align-top">{balMoney.formatted}</td>
                        <td className="p-3 text-center align-top"><button onClick={() => handleDeleteTransaction(t.id, t.amount, t.tx_type)} className="text-slate-600 hover:text-rose-400 transition" title="Sil"><Trash2 size={14} /></button></td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 99999 }}>
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

      {isCardModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 9999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-800 bg-[#0a0f1d]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2"><CreditCard size={16} className="text-indigo-500"/> {editingCardId ? 'Kredi Kartını Düzenle' : 'Yeni Kredi Kartı Ekle'}</h3>
              <button onClick={() => setIsCardModalOpen(false)} className="text-slate-400 hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveCard} className="p-5 space-y-4 text-[11px]">
              
              <div>
                <label className="block text-slate-400 mb-1 font-bold">Kart Sahibi / Merkez *</label>
                <select value={cardCompanyId} onChange={(e) => setCardCompanyId(e.target.value)} required className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors">
                   {!isRestricted && <option value="common">🌍 Ortak / Bağımsız Kart</option>}
                   <optgroup label="Ticari Şirketler">{companies.filter(c => !c.is_personal && (!isRestricted || profile?.allowed_companies?.includes(c.id))).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                   <optgroup label="Şahsi Merkezler">{companies.filter(c => c.is_personal && (!isRestricted || profile?.allowed_companies?.includes(c.id))).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-medium">Kart / Banka Adı *</label>
                <input type="text" required placeholder="Örn: Garanti Bonus, Enpara Kredi Kartı" value={cardName} onChange={(e) => setCardName(e.target.value)} className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Kart Limiti (TL) *</label>
                  <input type="number" step="0.01" required value={cardLimit} onChange={(e) => setCardLimit(e.target.value)} className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Ekstre Günü (1-31)</label>
                  <input type="number" min="1" max="31" required value={cutoffDay} onChange={(e) => setCutoffDay(e.target.value)} className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
              </div>
              
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Dönem Başı Devir Borcu (TL)</label>
                <input type="number" step="0.01" placeholder="Yoksa boş bırakın" value={openingDebt} onChange={(e) => setOpeningDebt(e.target.value)} className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors" />
              </div>
              
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Kart Teması / Rengi</label>
                <select value={cardColor} onChange={(e) => setCardColor(e.target.value)} className="w-full bg-[#070b14] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors">
                  {CARD_COLORS.map((col) => <option key={col.value} value={col.value}>{col.label}</option>)}
                </select>
              </div>
              
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button type="button" onClick={() => setIsCardModalOpen(false)} className="px-4 py-2 rounded-lg text-slate-400 hover:bg-slate-800 transition-colors font-bold">İptal</button>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg font-bold transition-all active:scale-95 shadow-lg shadow-indigo-900/20">Kaydet</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
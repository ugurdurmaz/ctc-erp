'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/lib/utils'
import toast, { Toaster } from 'react-hot-toast'
import { Landmark, Plus, Trash2, X, Edit3, Search, Hash, ArrowRightLeft, Wallet, Building, Home, Globe, AlertTriangle, RefreshCw, CheckCircle, Percent, Calendar as CalendarIcon, Clock } from 'lucide-react'

type Company = { id: string; name: string; is_personal: boolean }
type BankAccount = { id: string; bank_name: string; account_name: string; iban: string; balance: number; currency: 'TRY' | 'USD' | 'EUR'; company_id?: string | null; company?: { name: string; is_personal: boolean } }
type BankTransaction = { id: string; bank_account_id: string; company_id?: string | null; tx_date: string; description: string; tx_type: 'in' | 'out'; amount: number; currency: string; exchange_rate: number; is_transfer: boolean; running_balance?: number; transfer_id?: string; status?: string; company?: { name: string; is_personal: boolean } }
type CashRegister = { id: string; name: string; balance: number; currency: string }

function getLocalTodayISO() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` }
function formatDateTR(dateStr: string) { if (!dateStr) return ''; const parts = dateStr.split('-'); if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`; return dateStr }

import { logActivity } from '@/lib/audit'

export default function BankAccountsPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [banks, setBanks] = useState<BankAccount[]>([])
  const [cashes, setCashes] = useState<CashRegister[]>([])
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [bankName, setBankName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [iban, setIban] = useState('')
  const [currency, setCurrency] = useState<'TRY' | 'USD' | 'EUR'>('TRY')
  const [bankCompanyId, setBankCompanyId] = useState('common')
  const [openingBalance, setOpeningBalance] = useState('')

  const todayISO = getLocalTodayISO()
  const [txDate, setTxDate] = useState(todayISO)
  const [txCompanyId, setTxCompanyId] = useState('common')
  const [txDesc, setTxDesc] = useState('')
  const [txType, setTxType] = useState<'in' | 'out'>('in')
  const [txAmount, setTxAmount] = useState('')

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [transferCompanyId, setTransferCompanyId] = useState('common')
  const [transferTarget, setTransferTarget] = useState('') 
  const [transferAmount, setTransferAmount] = useState('')
  const [transferRate, setTransferRate] = useState('1')
  const [transferTargetAmount, setTransferTargetAmount] = useState('')
  const [targetCurrency, setTargetCurrency] = useState('TRY')

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string; confirmText: string; cancelText: string; isDanger: boolean; onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', confirmText: '', cancelText: '', isDanger: false, onConfirm: () => {} })

  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false)
  const [collectingTx, setCollectingTx] = useState<BankTransaction | null>(null)
  const [commissionAmount, setCommissionAmount] = useState('')
  const [collectDate, setCollectDate] = useState(todayISO) 

  useEffect(() => { fetchCompanies(); fetchBanks(); fetchCashes() }, [])
  useEffect(() => { if (selectedBankId) fetchTransactions(selectedBankId); else setTransactions([]) }, [selectedBankId])

  async function fetchCompanies() { const { data } = await supabase.from('companies').select('*').order('name', { ascending: true }); setCompanies(data || []) }
  async function fetchBanks() { const { data } = await supabase.from('bank_accounts').select('*, company:companies(name, is_personal)').order('bank_name', { ascending: true }); setBanks(data || []); if (data && data.length > 0 && !selectedBankId) setSelectedBankId(data[0].id) }
  async function fetchCashes() { const { data } = await supabase.from('cash_registers').select('*'); setCashes(data || []) }
  async function fetchTransactions(bankId: string) { const { data } = await supabase.from('bank_transactions').select('*, company:companies(name, is_personal)').eq('bank_account_id', bankId).order('tx_date', { ascending: false }).order('created_at', { ascending: false }); setTransactions(data || []) }

  function openAddModal() { 
    setEditingId(null); setBankName(''); setAccountName(''); setIban('TR'); setCurrency('TRY'); 
    setBankCompanyId('common'); setOpeningBalance(''); setIsModalOpen(true) 
  }

  async function openEditModal(bank: BankAccount, e: React.MouseEvent) { 
    e.stopPropagation(); 
    setEditingId(bank.id); 
    setBankName(bank.bank_name); 
    setAccountName(bank.account_name); 
    setIban(bank.iban || 'TR'); 
    setCurrency(bank.currency as any); 
    setBankCompanyId(bank.company_id || 'common'); 
    setOpeningBalance(''); 
    setIsModalOpen(true);

    const { data: txs } = await supabase.from('bank_transactions')
       .select('amount').eq('bank_account_id', bank.id).eq('description', 'Açılış Bakiyesi / Devir').limit(1);
    
    if (txs && txs.length > 0) {
      setOpeningBalance(txs[0].amount.toString());
    } else {
      setOpeningBalance('0');
    }
  }

  async function recalculateAbsoluteBankBalance(bankId: string) {
    const { data: txs } = await supabase.from('bank_transactions').select('amount, tx_type, status').eq('bank_account_id', bankId)
    let absoluteBal = 0
    txs?.forEach(t => { 
      if (t.status !== 'pending') {
        absoluteBal += t.tx_type === 'in' ? Number(t.amount) : -Number(t.amount) 
      }
    })
    await supabase.from('bank_accounts').update({ balance: absoluteBal }).eq('id', bankId)
  }

  async function recalculateAbsoluteCashBalance(cashId: string) {
    const { data: txs } = await supabase.from('cash_transactions').select('amount, tx_type').eq('cash_register_id', cashId)
    let absoluteBal = 0
    txs?.forEach(t => { absoluteBal += t.tx_type === 'in' ? Number(t.amount) : -Number(t.amount) })
    await supabase.from('cash_registers').update({ balance: absoluteBal }).eq('id', cashId)
  }

  async function handleSaveBank(e: React.FormEvent) {
    e.preventDefault(); if (!bankName || !accountName) return
    const finalCompId = bankCompanyId === 'common' ? null : bankCompanyId
    const initialBalance = parseFloat(openingBalance) || 0
    
    try {
      if (editingId) { 
        const oldBank = banks.find(b => b.id === editingId)
        
        const { data: oldTxs } = await supabase.from('bank_transactions')
           .select('*').eq('bank_account_id', editingId).eq('description', 'Açılış Bakiyesi / Devir').limit(1);
        
        const oldTx = oldTxs && oldTxs.length > 0 ? oldTxs[0] : null;

        if (oldTx) {
           if (initialBalance === 0) {
              await supabase.from('bank_transactions').delete().eq('id', oldTx.id);
           } else {
              await supabase.from('bank_transactions').update({ amount: initialBalance }).eq('id', oldTx.id);
           }
        } else if (initialBalance > 0) {
           const txPayload = { bank_account_id: editingId, company_id: finalCompId, tx_date: todayISO, description: 'Açılış Bakiyesi / Devir', tx_type: 'in', amount: initialBalance, currency: currency, exchange_rate: 1, is_transfer: false, status: 'completed' }
           await supabase.from('bank_transactions').insert([txPayload]);
        }

        const payload = { bank_name: bankName, account_name: accountName, iban, currency, company_id: finalCompId }
        await supabase.from('bank_accounts').update(payload).eq('id', editingId); 
        await recalculateAbsoluteBankBalance(editingId); 
        
        await logActivity('bank', 'UPDATE', `Banka hesabı güncellendi: ${bankName}`, editingId, 0, currency, oldBank, payload, finalCompId)
        toast.success('Hesap başarıyla güncellendi.')

        if (selectedBankId === editingId) fetchTransactions(editingId);
      } 
      else { 
        const payload = { bank_name: bankName, account_name: accountName, iban, currency, company_id: finalCompId, balance: 0 } 
        const { data, error } = await supabase.from('bank_accounts').insert([payload]).select().single(); 
        if (error) throw error;
        await logActivity('bank', 'INSERT', `Yeni banka hesabı açıldı: ${bankName}`, data.id, 0, currency, null, data, finalCompId)
        
        if (initialBalance > 0) {
           const txPayload = { bank_account_id: data.id, company_id: finalCompId, tx_date: todayISO, description: 'Açılış Bakiyesi / Devir', tx_type: 'in', amount: initialBalance, currency: currency, exchange_rate: 1, is_transfer: false, status: 'completed' }
           const { data: txData, error: txErr } = await supabase.from('bank_transactions').insert([txPayload]).select().single()
           if (!txErr && txData) {
             await logActivity('bank_tx', 'INSERT', `Açılış Bakiyesi: ${bankName}`, txData.id, initialBalance, currency, null, txData, finalCompId)
           }
        }

        await recalculateAbsoluteBankBalance(data.id); 
        toast.success('Yeni banka hesabı oluşturuldu.')
      }
      setIsModalOpen(false); fetchBanks()
    } catch (err: any) { toast.error('Kaydedilemedi: ' + err.message) }
  }

  function handleDeleteBank(id: string, e: React.MouseEvent) { 
    e.stopPropagation(); 
    setConfirmDialog({
      isOpen: true,
      title: 'Hesabı Sil',
      message: 'Bu banka hesabını silmek istediğinize emin misiniz? Hesap silindiğinde içindeki tüm işlem geçmişi de kaybolacaktır!',
      confirmText: 'Evet, Sil',
      cancelText: 'Vazgeç',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        try {
          const bankToDelete = banks.find(b => b.id === id)
          await supabase.from('bank_accounts').delete().eq('id', id); 
          await logActivity('bank', 'DELETE', `Banka hesabı silindi: ${bankToDelete?.bank_name}`, id, bankToDelete?.balance, bankToDelete?.currency, bankToDelete, null, bankToDelete?.company_id)
          toast.success('Banka hesabı başarıyla silindi.')
          if (selectedBankId === id) setSelectedBankId(null); 
          fetchBanks()
        } catch (err: any) { toast.error('Silme başarısız: ' + err.message) }
      }
    })
  }

  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault(); const amountNum = parseFloat(txAmount); if (!amountNum || !selectedBankId || !txCompanyId) return
    const currentBank = banks.find(b => b.id === selectedBankId); if (!currentBank) return
    const finalCompId = txCompanyId === 'common' ? null : txCompanyId
    const desc = txDesc || (txType === 'in' ? 'Para Girişi' : 'Para Çıkışı')

    try {
      const payload = { 
        bank_account_id: selectedBankId, company_id: finalCompId, tx_date: txDate, description: desc, tx_type: txType, amount: amountNum, currency: currentBank.currency, exchange_rate: 1, is_transfer: false, status: 'completed'
      }
      
      const { data, error: txErr } = await supabase.from('bank_transactions').insert([payload]).select().single()
      if (txErr) throw txErr
      
      await recalculateAbsoluteBankBalance(selectedBankId);

      await logActivity('bank_tx', 'INSERT', `Banka hareketi (${txType === 'in' ? 'Giriş' : 'Çıkış'}): ${desc}`, data.id, amountNum, currentBank.currency, { previous_balance: currentBank.balance }, { ...data }, finalCompId)

      toast.success(txType === 'in' ? 'Para girişi eklendi.' : 'Para çıkışı işlendi.')
      setTxDesc(''); setTxAmount(''); fetchTransactions(selectedBankId); fetchBanks()
    } catch (err: any) { toast.error('İşlem kaydedilemedi: ' + err.message) }
  }

  const handleTransferTargetSelect = (val: string) => {
    setTransferTarget(val); const currentBank = banks.find(b => b.id === selectedBankId); if (!currentBank) return
    let newTargetCurr = 'TRY'
    if (val) { const [tType, tId] = val.split('|'); if (tType === 'bank') newTargetCurr = banks.find(x => x.id === tId)?.currency || 'TRY'; else if (tType === 'cash') newTargetCurr = cashes.find(x => x.id === tId)?.currency || 'TRY' }
    setTargetCurrency(newTargetCurr)
    const s = parseFloat(transferAmount) || 0; const r = parseFloat(transferRate) || 1
    if (currentBank.currency !== newTargetCurr) { if (currentBank.currency === 'TRY') setTransferTargetAmount((s / r).toFixed(2)); else setTransferTargetAmount((s * r).toFixed(2)) } else setTransferTargetAmount(transferAmount)
  }

  const handleTransferAmountChange = (val: string) => {
    setTransferAmount(val); const currentBank = banks.find(b => b.id === selectedBankId); if (!currentBank) return
    const s = parseFloat(val) || 0; const r = parseFloat(transferRate) || 1
    if (currentBank.currency !== targetCurrency) { if (currentBank.currency === 'TRY') setTransferTargetAmount((s / r).toFixed(2)); else setTransferTargetAmount((s * r).toFixed(2)) } else setTransferTargetAmount(val)
  }

  const handleTransferRateChange = (val: string) => {
    setTransferRate(val); const currentBank = banks.find(b => b.id === selectedBankId); if (!currentBank) return
    const s = parseFloat(transferAmount) || 0; const r = parseFloat(val) || 1
    if (currentBank.currency !== targetCurrency) { if (currentBank.currency === 'TRY') setTransferTargetAmount((s / r).toFixed(2)); else setTransferTargetAmount((s * r).toFixed(2)) }
  }

  const handleTransferTargetAmountChange = (val: string) => {
    setTransferTargetAmount(val); const currentBank = banks.find(b => b.id === selectedBankId); if (!currentBank) return
    const s = parseFloat(transferAmount) || 0; const t = parseFloat(val) || 0
    if (s > 0 && t > 0 && currentBank.currency !== targetCurrency) { if (currentBank.currency === 'TRY') setTransferRate((s / t).toFixed(4)); else setTransferRate((t / s).toFixed(4)) }
  }

  async function handleSaveTransfer(e: React.FormEvent) {
    e.preventDefault()
    const amountOut = parseFloat(transferAmount); const rate = parseFloat(transferRate) || 1; const amountIn = parseFloat(transferTargetAmount) || amountOut
    if (!amountOut || !selectedBankId || !transferTarget || !transferCompanyId) return
    const currentBank = banks.find(b => b.id === selectedBankId); if (!currentBank) return
    const [tType, tId] = transferTarget.split('|')
    const trfId = `TRF-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const finalCompId = transferCompanyId === 'common' ? null : transferCompanyId

    try {
      const outPayload = { bank_account_id: selectedBankId, company_id: finalCompId, tx_date: todayISO, description: 'Hesaplar Arası Transfer Çıkışı', tx_type: 'out', amount: amountOut, currency: currentBank.currency, exchange_rate: rate, is_transfer: true, transfer_id: trfId, status: 'completed' }
      const { data: outTxData, error: txErr1 } = await supabase.from('bank_transactions').insert([outPayload]).select().single()
      if (txErr1) throw txErr1
      
      await recalculateAbsoluteBankBalance(selectedBankId)

      let targetName = ''
      let targetEntityData = null

      if (tType === 'bank') {
        const targetBank = banks.find(b => b.id === tId); if (!targetBank) throw new Error('Hedef banka bulunamadı')
        targetName = targetBank.bank_name
        
        const inPayload = { bank_account_id: tId, company_id: finalCompId, tx_date: todayISO, description: `${currentBank.bank_name} Hesabından Transfer Geldi`, tx_type: 'in', amount: amountIn, currency: targetBank.currency, exchange_rate: rate, is_transfer: true, transfer_id: trfId, status: 'completed' }
        const { data: inTxData, error: txErr2 } = await supabase.from('bank_transactions').insert([inPayload]).select().single()
        if (txErr2) throw txErr2
        
        await recalculateAbsoluteBankBalance(tId)
        targetEntityData = { target_id: tId, type: 'bank', transaction_data: inTxData }

      } else if (tType === 'cash') {
        const targetCash = cashes.find(c => c.id === tId); if (!targetCash) throw new Error('Hedef kasa bulunamadı')
        targetName = targetCash.name
        
        const inPayload = { cash_register_id: tId, company_id: finalCompId, tx_date: todayISO, description: `${currentBank.bank_name} Hesabından Çekilen Nakit`, tx_type: 'in', amount: amountIn, currency: targetCash.currency, exchange_rate: rate, is_transfer: true, transfer_id: trfId }
        const { data: inTxData, error: txErr3 } = await supabase.from('cash_transactions').insert([inPayload]).select().single()
        if (txErr3) throw txErr3
        
        await recalculateAbsoluteCashBalance(tId)
        targetEntityData = { target_id: tId, type: 'cash', transaction_data: inTxData }
      }

      await logActivity('bank_transfer', 'INSERT', `Transfer: ${currentBank.bank_name} -> ${targetName}`, outTxData.id, amountOut, currentBank.currency, null, { source_tx: outTxData, target_tx: targetEntityData, rate }, finalCompId)

      setIsTransferModalOpen(false); setTransferAmount(''); setTransferRate('1'); setTransferTarget(''); setTransferTargetAmount(''); setTransferCompanyId('common')
      fetchTransactions(selectedBankId); fetchBanks(); fetchCashes()
      toast.success(`${targetName} hesabına başarıyla transfer yapıldı.`)
    } catch (err: any) { toast.error("Transfer Hatası: " + err.message) }
  }

  function handleDeleteTransaction(txId: string, amount: number, type: 'in' | 'out', isTransfer: boolean, transferId?: string, status?: string) {
    if (transferId && (transferId.startsWith('SUPP-') || transferId.startsWith('CUST-') || transferId.startsWith('EXP-') || transferId.startsWith('POS-'))) {
      toast.error('Bu işlem harici bir modülden (Mağaza, Cari veya Gider) otomatik yansımıştır. Lütfen işlemi ait olduğu modülden iptal edin.');
      return;
    }

    const messageAdd = status === 'pending' ? 'Bu henüz bekleyen bir provizyondur, banka bakiyenizi etkilememiştir.' : 'İşlem tutarı banka bakiyenize iade edilecektir.'

    if (isTransfer) {
      setConfirmDialog({
        isOpen: true,
        title: 'Transferi İptal Et',
        message: 'DİKKAT: Bu bir transfer işlemidir. Sildiğinizde paranın gittiği/geldiği KARŞI HESAPTAKİ İŞLEM DE OTOMATİK SİLİNECEK ve bakiyeler geri alınacaktır. Onaylıyor musunuz?',
        confirmText: 'Evet, İptal Et',
        cancelText: 'Vazgeç',
        isDanger: true,
        onConfirm: () => executeDeleteTransaction(txId, amount, type, isTransfer, transferId)
      })
    } else {
      setConfirmDialog({
        isOpen: true,
        title: 'Hareketi Sil',
        message: `Hareketi silmek istediğinize emin misiniz? ${messageAdd}`,
        confirmText: 'Evet, Sil',
        cancelText: 'Vazgeç',
        isDanger: true,
        onConfirm: () => executeDeleteTransaction(txId, amount, type, isTransfer, transferId)
      })
    }
  }

  async function executeDeleteTransaction(txId: string, amount: number, type: 'in' | 'out', isTransfer: boolean, transferId?: string) {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }))
    
    try {
      const txToDelete = transactions.find(t => t.id === txId)
      let oldDataPayload: any = { deleted_tx: txToDelete, related_txs: [] }
      
      const affectedBanks = new Set<string>();
      const affectedCashes = new Set<string>();

      if (isTransfer && transferId) {
        const { data: bTxs } = await supabase.from('bank_transactions').select('*').eq('transfer_id', transferId)
        if (bTxs) {
          for (const bTx of bTxs) {
            affectedBanks.add(bTx.bank_account_id)
            await supabase.from('bank_transactions').delete().eq('id', bTx.id)
            oldDataPayload.related_txs.push({ type: 'bank', data: bTx })
          }
        }
        const { data: cTxs } = await supabase.from('cash_transactions').select('*').eq('transfer_id', transferId)
        if (cTxs) {
          for (const cTx of cTxs) {
            affectedCashes.add(cTx.cash_register_id)
            await supabase.from('cash_transactions').delete().eq('id', cTx.id)
            oldDataPayload.related_txs.push({ type: 'cash', data: cTx })
          }
        }
      } else {
        if (selectedBankId) affectedBanks.add(selectedBankId);
        await supabase.from('bank_transactions').delete().eq('id', txId)
      }

      for (const bId of Array.from(affectedBanks)) await recalculateAbsoluteBankBalance(bId)
      for (const cId of Array.from(affectedCashes)) await recalculateAbsoluteCashBalance(cId)

      await logActivity(
        isTransfer ? 'bank_transfer' : 'bank_tx', 
        'DELETE', 
        isTransfer ? `Transfer İptal Edildi (Ref: ${transferId})` : `Banka hareketi silindi: ${txToDelete?.description}`, 
        txId, 
        amount, 
        txToDelete?.currency || '', 
        oldDataPayload, 
        null, 
        txToDelete?.company_id
      )

      toast.success('İşlem silindi ve bakiyeler güncellendi.')
    } catch(err:any) { toast.error("Silme işleminde hata oluştu: " + err.message) }
    
    fetchTransactions(selectedBankId!); fetchBanks(); fetchCashes()
  }

  function openCollectModal(tx: BankTransaction) {
    setCollectingTx(tx)
    setCommissionAmount('')
    
    // Güvenli tarih hesabı: Valör için tx_date'in bir sonraki gününü yerel saat dilimine göre ayarla
    try {
      const parts = tx.tx_date.split('-').map(Number)
      if (parts.length === 3) {
        const nextDay = new Date(parts[0], parts[1] - 1, parts[2] + 1)
        const y = nextDay.getFullYear()
        const m = String(nextDay.getMonth() + 1).padStart(2, '0')
        const d = String(nextDay.getDate()).padStart(2, '0')
        setCollectDate(`${y}-${m}-${d}`)
      } else {
        setCollectDate(todayISO)
      }
    } catch {
      setCollectDate(todayISO)
    }
    
    setIsCollectModalOpen(true)
  }

  async function handleCollectSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!collectingTx || !selectedBankId) return

    const commission = parseFloat(commissionAmount) || 0
    if (commission < 0 || commission >= collectingTx.amount) {
      toast.error('Geçersiz komisyon tutarı. Tutar 0 ile işlemin ana tutarı arasında olmalıdır.')
      return
    }

    try {
      const { error: updErr } = await supabase.from('bank_transactions')
        .update({ status: 'completed', tx_date: collectDate }) 
        .eq('id', collectingTx.id)
      
      if (updErr) throw updErr

      if (commission > 0) {
        // --- SİHİRLİ BAĞLANTI (TRANSFER ID) BURADA ---
        // Eğer POS'tan gelen ID "POS-Z-CARD-IN-2026-09-14" ise komisyon "POS-Z-CARD-COMM-2026-09-14" olur.
        // Böylece POS modülü eski günleri temizlerken bu komisyonu da kendi çöplüğünden bilir ve siler!
        const commTransferId = collectingTx.transfer_id ? collectingTx.transfer_id.replace('-IN-', '-COMM-') : `POS-COMM-${Date.now()}`

        const commPayload = {
          bank_account_id: selectedBankId,
          company_id: collectingTx.company_id,
          tx_date: collectDate, 
          description: `POS Komisyon Kesintisi (Ref: ${collectingTx.description})`,
          tx_type: 'out',
          amount: commission,
          currency: collectingTx.currency,
          exchange_rate: collectingTx.exchange_rate,
          is_transfer: false,
          status: 'completed',
          transfer_id: commTransferId 
        }
        const { error: commErr } = await supabase.from('bank_transactions').insert([commPayload])
        if (commErr) throw commErr
      }

      await recalculateAbsoluteBankBalance(selectedBankId)

      await logActivity('bank_tx', 'UPDATE', `POS Provizyonu Tahsil Edildi. Kesinti: ${commission}`, collectingTx.id, collectingTx.amount, collectingTx.currency, null, { new_status: 'completed', commission_deducted: commission, new_date: collectDate }, collectingTx.company_id)

      toast.success('Tahsilat işlemi banka ekstrenizle aynı güne işlendi!')
      setIsCollectModalOpen(false)
      fetchTransactions(selectedBankId); fetchBanks()

    } catch (err: any) {
      toast.error("Tahsilat sırasında bir hata oluştu: " + err.message)
    }
  }

  const filteredBanks = banks.filter(b => b.bank_name.toLowerCase().includes(searchTerm.toLowerCase()) || b.account_name.toLowerCase().includes(searchTerm.toLowerCase()))
  const selectedBank = banks.find(b => b.id === selectedBankId)

  let currentRunningBalance = selectedBank ? selectedBank.balance : 0
  const displayTransactions = transactions.map((t) => {
    const rowBalance = currentRunningBalance; 
    if (t.status !== 'pending') {
      if (t.tx_type === 'in') currentRunningBalance -= t.amount; 
      else currentRunningBalance += t.amount; 
    }
    return { ...t, running_balance: rowBalance }
  })

  const totalTry = banks.filter(b => b.currency === 'TRY').reduce((acc, b) => acc + b.balance, 0)
  const totalUsd = banks.filter(b => b.currency === 'USD').reduce((acc, b) => acc + b.balance, 0)
  const totalEur = banks.filter(b => b.currency === 'EUR').reduce((acc, b) => acc + b.balance, 0)

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] relative">
      <Toaster position="bottom-right" containerStyle={{ zIndex: 99999999 }} toastOptions={{ style: { background: '#0f172a', color: '#fff', border: '1px solid #1e293b', fontSize: '12px' } }} />
      
      <div style={{ animation: 'fadeInDown 0.4s both' }} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0d1322] border border-slate-800/80 p-4 rounded-xl shadow-md shrink-0 mb-4 transition-colors">
        <div className="flex items-center gap-3 text-white">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg"><Landmark size={24} /></div>
          <div><h2 className="font-bold text-lg leading-none">Banka Hesapları</h2><p className="text-[10px] text-slate-400 mt-1">Banka bakiyeleriniz ve hesaplar arası virman işlemleri</p></div>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex flex-col items-end"><span className="text-[9px] text-slate-400 font-sans tracking-wide">BANKALARDAKİ TOPLAM VARLIK</span>
            <div className="flex gap-3 mt-0.5 font-bold">
              {totalTry !== 0 && <span className="text-emerald-400">{formatMoney(totalTry, 'TRY').formatted}</span>}
              {totalUsd !== 0 && <span className="text-indigo-400">{formatMoney(totalUsd, 'USD').formatted}</span>}
              {totalEur !== 0 && <span className="text-blue-400">{formatMoney(totalEur, 'EUR').formatted}</span>}
              {totalTry === 0 && totalUsd === 0 && totalEur === 0 && <span className="text-slate-500">0,00₺</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        
        <div style={{ animation: 'fadeInUp 0.4s both 0.1s' }} className="w-full lg:w-[350px] bg-[#0d1322] border border-slate-800/80 rounded-xl flex flex-col shrink-0 shadow-lg">
          <div className="p-3 border-b border-slate-800/80 bg-[#0a0f1d] rounded-t-xl flex flex-col gap-3 shrink-0">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-300">Hesap Listesi ({filteredBanks.length})</span>
              <button onClick={openAddModal} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all active:scale-95"><Plus size={14} /> Yeni Hesap</button>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" placeholder="Banka veya hesap adı ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-all" />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 custom-scrollbar p-2 space-y-1.5">
            {filteredBanks.length === 0 ? (
               <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-700/60 rounded-xl bg-slate-800/10 text-slate-500 m-2 shadow-inner">
                 <Landmark size={32} className="mb-3 opacity-70 text-indigo-400 animate-bounce" />
                 <p className="text-[11px] font-bold text-slate-400">Henüz bir banka hesabı eklenmemiş.</p>
                 <p className="text-[9px] mt-1 text-slate-500">Sağ üstten yeni bir hesap oluşturabilirsiniz.</p>
               </div>
            ) : filteredBanks.map((item, index) => (
             <div 
               key={item.id} 
               onClick={() => setSelectedBankId(item.id)} 
               style={{ animation: 'fadeInUp 0.3s both', animationDelay: `${0.15 + (index * 0.05)}s` }}
               className={`flex items-center justify-between py-2.5 px-3 rounded-lg cursor-pointer transition-all border hover:-translate-y-0.5 group ${item.id === selectedBankId ? 'bg-indigo-900/10 border-indigo-500/30 shadow-inner' : 'bg-[#070b14] border-slate-800/50 hover:border-slate-600'}`}
             >
                <div className="flex-1 min-w-0 pr-2 flex flex-col gap-0.5">
                   <h4 className="text-[11px] font-bold text-slate-200 truncate">{item.bank_name}</h4>
                   <p className="text-[9px] text-slate-500 truncate">{item.account_name}</p>
                   <span className="text-[9px] text-slate-500 flex items-center gap-1 mt-1">
                      {item.company ? (item.company.is_personal ? <Home size={10} className="text-slate-400"/> : <Building size={10} className="text-indigo-400"/>) : <Globe size={10} className="text-indigo-500/70"/>}
                      {item.company ? item.company.name : 'Ortak Havuz Hesap'}
                   </span>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-[11px] font-mono font-bold ${item.balance < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{formatMoney(item.balance, item.currency).formatted}</div>
                  <div className="text-[8px] text-slate-500 uppercase tracking-wider mt-0.5">BAKİYE</div>
                </div>
             </div>
          ))}</div>
        </div>

        <div style={{ animation: 'fadeInUp 0.4s both 0.2s' }} className="flex-1 bg-[#0d1322] border border-slate-800/80 rounded-xl flex flex-col min-w-0 shadow-lg relative overflow-hidden">
          {selectedBank ? (
            <>
              <div className="p-4 border-b border-slate-800/80 bg-gradient-to-r from-[#0a0f1d] to-[#0d1322] rounded-t-xl shrink-0 flex flex-col md:flex-row justify-between gap-4 relative z-10">
                <div className="flex-1 w-full">
                   <div className="flex items-center justify-between mb-2">
                     <h2 className="text-lg font-bold text-white flex items-center gap-2">{selectedBank.bank_name} <span className="text-sm font-normal text-slate-400">- {selectedBank.account_name}</span></h2>
                     <div className="flex items-center gap-1 bg-black/40 p-1 rounded border border-slate-800">
                       <button onClick={(e) => openEditModal(selectedBank, e)} className="text-slate-400 hover:text-indigo-400 p-1 transition"><Edit3 size={14} /></button>
                       <button onClick={(e) => handleDeleteBank(selectedBank.id, e)} className="text-slate-400 hover:text-rose-400 p-1 transition"><Trash2 size={14} /></button>
                     </div>
                   </div>
                   <div className="flex flex-wrap items-center gap-2">
                     <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-[#070b14] p-1.5 px-2 rounded border border-slate-800/50 w-fit">
                       <Hash size={12} className="text-slate-500" /> <span className="font-mono tracking-widest">{selectedBank.iban || 'IBAN GİRİLMEMİŞ'}</span>
                     </div>
                     <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-1.5 rounded border border-slate-700 flex items-center gap-1">Hesap Sahibi: {selectedBank.company ? selectedBank.company.name : 'Ortak Bağımsız Hesap'}</span>
                   </div>
                </div>
                <div className="flex flex-col justify-center items-end bg-[#070b14] px-5 py-3 rounded-lg border border-slate-800/50 min-w-[160px] w-full md:w-auto relative overflow-hidden group">
                  <span className="text-[10px] font-bold text-slate-500 mb-1 tracking-widest">GÜNCEL BAKİYE</span>
                  <span className={`text-2xl font-black font-mono ${selectedBank.balance < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{formatMoney(selectedBank.balance, selectedBank.currency).formatted}</span>
                </div>
              </div>

              <div className="p-4 overflow-y-auto custom-scrollbar flex-1 flex flex-col relative z-10">
                <div style={{ animation: 'fadeInUp 0.4s both 0.3s' }} className="flex flex-wrap xl:flex-nowrap gap-4 mb-5 shrink-0">
                  <form onSubmit={handleAddTransaction} className="flex-1 flex flex-wrap items-end gap-2.5 bg-[#070b14] p-3 rounded-lg border border-slate-800">
                    <div className="w-28"><label className="block text-[9px] text-slate-400 mb-0.5">Tarih</label><input type="date" required value={txDate} onChange={(e) => setTxDate(e.target.value)} className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors" /></div>
                    
                    <div className="w-32">
                       <label className="block text-[9px] text-slate-400 mb-0.5">İlgili Merkez *</label>
                       <select value={txCompanyId} onChange={(e) => setTxCompanyId(e.target.value)} required className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors">
                         <option value="common">🌍 Ortak / Bağımsız İşlem</option>
                         <optgroup label="Ticari Şirketler">{companies.filter(c => !c.is_personal).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                         <optgroup label="Şahsi Merkezler">{companies.filter(c => c.is_personal).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                       </select>
                    </div>

                    <div className="w-28"><label className="block text-[9px] text-slate-400 mb-0.5">İşlem Yönü</label><select value={txType} onChange={(e) => setTxType(e.target.value as any)} className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors"><option value="in">Giriş / Gelir (+)</option><option value="out">Çıkış / Gider (-)</option></select></div>
                    <div className="flex-1 min-w-[120px]"><label className="block text-[9px] text-slate-400 mb-0.5">Açıklama</label><input type="text" placeholder="Örn: Kira Ödemesi" value={txDesc} onChange={(e) => setTxDesc(e.target.value)} className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none transition-colors" /></div>
                    <div className="w-28"><label className="block text-[9px] text-slate-400 mb-0.5">Tutar ({selectedBank.currency})</label><input type="number" step="0.01" required placeholder="0.00" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} className="w-full bg-[#0d1322] border border-slate-700 rounded px-2 py-1.5 text-[11px] text-slate-200 focus:outline-none font-mono transition-colors" /></div>
                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded text-[11px] font-bold transition-all active:scale-95 h-[26px]">Ekle</button>
                  </form>
                  <button onClick={() => { setIsTransferModalOpen(true); setTransferTarget(''); setTransferAmount(''); setTransferRate('1'); setTargetCurrency('TRY'); setTransferTargetAmount(''); setTransferCompanyId('common') }} className="shrink-0 bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/50 text-indigo-300 hover:text-white px-4 py-3 rounded-lg text-xs font-bold transition-all active:scale-95 flex flex-col items-center justify-center gap-1.5 min-w-[120px]"><ArrowRightLeft size={18} /> Virman / Transfer</button>
                </div>

                {/* BEKLEYEN PROVİZYON BİLGİLENDİRME & HIZLI İŞLEM BARI */}
                {displayTransactions.some(t => t.status === 'pending') && (
                  <div className="mb-3 p-3 bg-gradient-to-r from-amber-950/30 via-slate-900 to-[#0d1322] border border-amber-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                        <Clock size={16} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-amber-300 flex items-center gap-2">
                          <span>Bekleyen POS Provizyonu ({displayTransactions.filter(t => t.status === 'pending').length} Adet)</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-200 font-mono font-bold">
                            Toplam {formatMoney(displayTransactions.filter(t => t.status === 'pending').reduce((sum, t) => sum + t.amount, 0), selectedBank.currency).formatted}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Mağaza kredi kartı satışından gelen provizyonlar henüz banka bakiyesini etkilemez. Ertesi gün banka ekstrenize yansıdığında komisyon kesintisini girerek hesaba aktarabilirsiniz.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {displayTransactions.filter(t => t.status === 'pending').slice(0, 1).map((pTx) => (
                        <button
                          key={pTx.id}
                          type="button"
                          onClick={() => openCollectModal(pTx)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg shadow-sm shadow-emerald-950/40 flex items-center gap-1.5 transition-all active:scale-95 whitespace-nowrap cursor-pointer"
                          title="Komisyon girerek hesaba geçir"
                        >
                          <CheckCircle size={13} />
                          <span>Komisyon Gir & Hesaba Geçir</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border border-slate-800/80 rounded-lg overflow-hidden flex-1 flex flex-col">
                  <table className="w-full text-left text-[11px]">
                    <thead className="sticky top-0 bg-[#0a0f1d] z-10"><tr className="border-b border-slate-800/80 text-slate-400"><th className="p-2.5 font-medium">Tarih</th><th className="p-2.5 font-medium">Açıklama & Merkez</th><th className="p-2.5 font-medium text-right text-emerald-400">Giriş (+)</th><th className="p-2.5 font-medium text-right text-rose-400">Çıkış (-)</th><th className="p-2.5 font-medium text-right text-slate-300 bg-slate-800/20">Bakiye</th><th className="p-2.5 font-medium text-center w-[130px]">İşlem</th></tr></thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {displayTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center">
                            <div className="flex flex-col items-center justify-center p-8 border border-dashed border-slate-700/60 rounded-xl bg-slate-800/10 text-slate-500 shadow-inner my-2 mx-2">
                               <RefreshCw size={32} className="mb-3 opacity-70 text-indigo-400 animate-bounce" />
                               <p className="text-[11px] font-bold text-slate-400">Bu hesaba ait henüz hareket bulunmuyor.</p>
                            </div>
                          </td>
                        </tr>
                      ) : displayTransactions.map((t, index) => (
                          <tr 
                            key={t.id} 
                            style={{ animation: 'fadeSlideRight 0.4s both', animationDelay: `${0.35 + (index * 0.05)}s` }}
                            className={`hover:bg-slate-800/30 font-mono transition-colors ${t.status === 'pending' ? 'bg-amber-900/10' : ''}`}
                          >
                            <td className="p-2.5 text-slate-400 align-top">{formatDateTR(t.tx_date)}</td>
                            <td className="p-2.5 text-slate-200 font-sans align-top">
                               <div className="flex items-center gap-2 mb-1">
                                 {t.transfer_id?.startsWith('POS') ? <span className="text-[9px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded border border-purple-500/30 flex items-center gap-1">Mağaza</span> 
                                 : t.transfer_id?.startsWith('SUPP') ? <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">Tedarikçi Ödemesi</span> 
                                 : t.transfer_id?.startsWith('CUST') ? <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30 flex items-center gap-1">Müşteri Tahsilatı</span> 
                                 : t.transfer_id?.startsWith('EXP') ? <span className="text-[9px] bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/30 flex items-center gap-1">Gider Ödemesi</span> 
                                 : t.is_transfer ? <span className="text-[9px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/30 flex items-center gap-1"><ArrowRightLeft size={10}/> Kasa/Banka Transferi</span> 
                                 : ''} 
                                 
                                 {t.status === 'pending' && (
                                    <button
                                      type="button"
                                      onClick={() => openCollectModal(t)}
                                      className="text-[9px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/40 flex items-center gap-1 animate-pulse transition cursor-pointer"
                                      title="Komisyon girerek hesaba geçirmek için tıklayın"
                                    >
                                      <Clock size={10} />
                                      <span>⏱ Bekleyen Provizyon</span>
                                    </button>
                                 )}
                                 
                                 {t.description}
                               </div>
                               <div className="flex items-center gap-1 text-[9px] text-slate-500">
                                  {t.company ? (t.company.is_personal ? <Home size={10} className="text-slate-400"/> : <Building size={10} className="text-indigo-400"/>) : <Globe size={10} className="text-indigo-500/70"/>}
                                  {t.company ? t.company.name : 'Ortak / Bağımsız İşlem'}
                               </div>
                            </td>
                            <td className="p-2.5 text-right text-emerald-400 font-medium align-top">
                               {t.tx_type === 'in' ? formatMoney(t.amount, t.currency).formatted : '-'}
                            </td>
                            <td className="p-2.5 text-right text-rose-400 font-medium align-top">
                               {t.tx_type === 'out' ? formatMoney(t.amount, t.currency).formatted : '-'}
                            </td>
                            <td className={`p-2.5 text-right font-medium align-top bg-slate-800/10 ${t.status === 'pending' ? 'text-slate-500 italic' : 'text-slate-300'}`}>
                               {t.status === 'pending' ? 'Bakiye Etkilenmedi' : formatMoney(t.running_balance, t.currency).formatted}
                            </td>
                            <td className="p-2.5 text-center align-top">
                              <div className="flex items-center justify-center gap-1.5">
                                {t.status === 'pending' && (
                                  <button 
                                    type="button"
                                    onClick={() => openCollectModal(t)} 
                                    className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-2 py-1 rounded shadow-sm shadow-emerald-950/40 transition-all active:scale-95 whitespace-nowrap cursor-pointer" 
                                    title="Banka komisyonunu manuel girerek hesaba geçir"
                                  >
                                    <CheckCircle size={12} />
                                    <span>Hesaba Geçir</span>
                                  </button>
                                )}
                                <button 
                                  type="button"
                                  onClick={() => handleDeleteTransaction(t.id, t.amount, t.tx_type, t.is_transfer, t.transfer_id, t.status)} 
                                  className="text-slate-500 hover:text-rose-400 p-1.5 hover:bg-slate-800 rounded transition cursor-pointer" 
                                  title="Sil"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (<div className="flex-1 flex flex-col items-center justify-center p-8 m-4 border border-dashed border-slate-700/60 rounded-xl bg-slate-800/10 text-slate-500 shadow-inner z-0"><Landmark size={48} className="mb-4 opacity-70 text-indigo-400 animate-bounce" /><p className="text-sm font-bold text-slate-400">Lütfen soldan bir banka hesabı seçin</p></div>)}
        </div>
      </div>

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

      {isCollectModalOpen && collectingTx && selectedBank && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 99999 }}>
          <div className="bg-[#0f172a] border border-emerald-900/50 rounded-xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-4 bg-emerald-900/20 border-b border-emerald-900/30 flex justify-between items-center">
              <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                <CheckCircle size={18} /> Bekleyen POS Tahsilatı
              </h3>
              <button onClick={() => setIsCollectModalOpen(false)} className="text-slate-400 hover:text-white transition">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCollectSubmit} className="p-5 space-y-4">
              <div className="bg-[#070b14] border border-slate-800 p-3 rounded-lg text-center flex flex-col items-center justify-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Bekleyen Tutar</span>
                <span className="text-xl font-bold font-mono text-white">{formatMoney(collectingTx.amount, collectingTx.currency).formatted}</span>
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-300 mb-1.5">
                  <CalendarIcon size={14} className="text-blue-400" /> Ekstreye Yansıma Tarihi (Valör)
                </label>
                <input 
                  type="date" 
                  required
                  value={collectDate} 
                  onChange={(e) => setCollectDate(e.target.value)} 
                  className="w-full bg-[#070b14] border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500 text-sm transition-colors" 
                  style={{ colorScheme: 'dark' }}
                />
                <p className="text-[9px] text-slate-500 mt-1.5">Paranın banka hesabınıza fiilen geçtiği tarih.</p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-300 mb-1.5">
                  <Percent size={14} className="text-rose-400" /> Banka POS Komisyon Kesintisi
                </label>
                <input 
                  type="number" 
                  step="0.01" 
                  placeholder="Ekstreden bakarak girin (Örn: 35.50)" 
                  value={commissionAmount} 
                  onChange={(e) => setCommissionAmount(e.target.value)} 
                  className="w-full bg-[#070b14] border border-rose-900/50 rounded-lg px-3 py-2.5 text-rose-400 focus:outline-none focus:border-rose-500 font-mono text-sm transition-colors placeholder:text-slate-600" 
                />
                <p className="text-[9px] text-slate-500 mt-1.5">Eğer komisyon kesilmediyse boş bırakabilirsiniz. Girdiğiniz tutar banka hesabınızdan "Gider (-)" olarak otomatik düşülecektir.</p>
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <div className="flex justify-between items-end mb-4">
                  <span className="text-xs font-bold text-emerald-400">Hesaba Geçecek Net Tutar:</span>
                  <span className="text-lg font-bold font-mono text-emerald-400">
                    {formatMoney(collectingTx.amount - (parseFloat(commissionAmount) || 0), collectingTx.currency).formatted}
                  </span>
                </div>
                
                <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg transition-all active:scale-95 shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2">
                  <CheckCircle size={16} /> Tahsilatı Onayla ve İşle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- TRANSFER MODALI --- */}
      {isTransferModalOpen && selectedBank && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 99999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl w-full max-w-md p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><ArrowRightLeft size={16} className="text-indigo-500" /> Hesaplar Arası Transfer (Virman)</h3>
            <form onSubmit={handleSaveTransfer} className="space-y-4 text-[11px]">
              <div className="bg-[#070b14] p-3 rounded-lg border border-slate-800/80"><span className="block text-[9px] text-slate-500 uppercase font-bold mb-1">Çıkış Yapılacak Kaynak Hesap</span><div className="flex items-center justify-between text-slate-300 font-medium"><span>{selectedBank.bank_name} - {selectedBank.account_name}</span><span className="font-mono text-indigo-400">{selectedBank.currency}</span></div></div>
              
              <div>
                <label className="block text-slate-400 mb-1">Bu Transfer Hangi Merkeze Ait? *</label>
                <select value={transferCompanyId} onChange={(e) => setTransferCompanyId(e.target.value)} required className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors">
                   <option value="common">🌍 Ortak / Bağımsız İşlem</option>
                   <optgroup label="Ticari Şirketler">{companies.filter(c => !c.is_personal).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                   <optgroup label="Şahsi Merkezler">{companies.filter(c => c.is_personal).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                </select>
              </div>

              <div><label className="block text-slate-400 mb-1">Hedef Hesap (Paranın Gideceği Yer) *</label><select value={transferTarget} onChange={(e) => handleTransferTargetSelect(e.target.value)} required className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors"><option value="">Seçiniz</option>{banks.filter(b => b.id !== selectedBank.id).length > 0 && <optgroup label="Diğer Banka Hesapları">{banks.filter(b => b.id !== selectedBank.id).map(b => <option key={`bank|${b.id}`} value={`bank|${b.id}`}>{b.bank_name} - {b.account_name} ({b.currency})</option>)}</optgroup>}{cashes.length > 0 && <optgroup label="Nakit Kasalar">{cashes.map(c => <option key={`cash|${c.id}`} value={`cash|${c.id}`}>{c.name} ({c.currency})</option>)}</optgroup>}</select></div>
              <div className="flex gap-3 items-end">
                <div className="flex-1"><label className="block text-slate-400 mb-1">Çıkış Tutarı ({selectedBank.currency}) *</label><input type="number" step="0.01" required placeholder="0.00" value={transferAmount} onChange={(e) => handleTransferAmountChange(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none font-mono text-lg transition-colors" /></div>
                {transferTarget && selectedBank.currency !== targetCurrency && (
                  <><div className="w-24"><label className="block text-slate-400 mb-1">Döviz Kuru</label><input type="number" step="0.0001" required value={transferRate} onChange={(e) => handleTransferRateChange(e.target.value)} className="w-full bg-indigo-900/20 border border-indigo-500/50 rounded px-2 py-2 text-indigo-300 focus:outline-none font-mono text-lg text-center transition-colors" /></div>
                  <div className="flex-1"><label className="block text-emerald-400/80 mb-1">Giriş Tutarı ({targetCurrency}) *</label><input type="number" step="0.01" required placeholder="0.00" value={transferTargetAmount} onChange={(e) => handleTransferTargetAmountChange(e.target.value)} className="w-full bg-emerald-900/10 border border-emerald-500/30 rounded px-3 py-2 text-emerald-400 focus:outline-none font-mono text-lg transition-colors" /></div></>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800"><button type="button" onClick={() => setIsTransferModalOpen(false)} className="px-4 py-1.5 rounded text-slate-400 hover:bg-slate-800 transition-colors">İptal</button><button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-1.5 rounded font-medium transition-all active:scale-95 shadow-lg shadow-indigo-900/20 flex items-center gap-1.5"><ArrowRightLeft size={14}/> Transferi Gerçekleştir</button></div>
            </form>
          </div>
        </div>
      )}

      {/* --- HESAP EKLEME / DÜZENLEME MODALI --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 99999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl w-full max-w-sm p-5 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2"><Landmark size={16} className="text-indigo-500" /> {editingId ? 'Hesabı Düzenle' : 'Yeni Banka Hesabı Oluştur'}</h3>
            <form onSubmit={handleSaveBank} className="space-y-3 text-[11px]">
              
              <div>
                <label className="block text-slate-400 mb-1 font-bold">Hesap Sahibi / Merkez</label>
                <select value={bankCompanyId} onChange={(e) => setBankCompanyId(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors">
                   <option value="common">🌍 Ortak / Bağımsız Hesap</option>
                   <optgroup label="Ticari Şirketler">{companies.filter(c => !c.is_personal).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                   <optgroup label="Şahsi Merkezler">{companies.filter(c => c.is_personal).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>
                </select>
              </div>

              <div><label className="block text-slate-400 mb-1">Banka Adı *</label><input type="text" required placeholder="Örn: Garanti BBVA" value={bankName} onChange={(e) => setBankName(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors" /></div>
              <div><label className="block text-slate-400 mb-1">Hesap Adı / Türü *</label><input type="text" required placeholder="Örn: Şirket Vadesiz, Döviz Hesabı" value={accountName} onChange={(e) => setAccountName(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none transition-colors" /></div>
              
              <div className="flex gap-2">
                <div className="w-1/2">
                  <label className="block text-slate-400 mb-1">Para Birimi</label>
                  <select disabled={!!editingId} value={currency} onChange={(e) => setCurrency(e.target.value as any)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none disabled:opacity-50 transition-colors"><option value="TRY">TRY (₺)</option><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option></select>
                </div>
                <div className="w-1/2">
                  <label className="block text-slate-400 mb-1">Açılış Bakiyesi</label>
                  <input type="number" step="0.01" placeholder="0.00" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500 transition-colors" />
                </div>
              </div>

              <div><label className="block text-slate-400 mb-1">IBAN No</label><input type="text" value={iban} onChange={(e) => setIban(e.target.value.toUpperCase())} placeholder="TR..." className="w-full bg-[#070b14] border border-slate-700 rounded px-3 py-2 text-white focus:outline-none font-mono tracking-wider uppercase transition-colors" /></div>
              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-800"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-1.5 rounded text-slate-400 hover:bg-slate-800 transition-colors">İptal</button><button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-1.5 rounded font-medium transition-all active:scale-95 shadow-lg shadow-indigo-900/20">Kaydet</button></div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeSlideRight {
          from { opacity: 0; transform: translateX(-15px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
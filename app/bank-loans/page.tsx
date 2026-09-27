'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { formatMoney } from '@/lib/utils'
import { logActivity } from '@/lib/audit'
import toast, { Toaster } from 'react-hot-toast'
import { BankLoan, LoanInstallment, LoanType } from '@/types/loans'
import { 
  BadgePercent, Plus, Trash2, Edit3, X, Check, CheckCircle2, Clock, 
  AlertTriangle, ChevronRight, ChevronDown, Landmark, Building2, Calendar, 
  Wallet, ArrowUpRight, RefreshCw, FileText, Info, ShieldCheck, Copy,
  CheckCircle, ArrowDownLeft, AlertCircle, Percent, Shield, ReceiptText
} from 'lucide-react'

interface Company {
  id: string
  name: string
  is_personal: boolean
}

interface BankAccount {
  id: string
  bank_name: string
  account_name?: string
  balance: number
  currency: string
  company_id?: string | null
}

const LOAN_TYPE_LABELS: Record<LoanType, string> = {
  commercial: 'Ticari Kredi',
  consumer: 'İhtiyaç / Tüketici Kredisi',
  vehicle: 'Taşıt Kredisi',
  housing: 'Konut Kredisi',
  other: 'Diğer Kredi'
}

type TaxRateType = 'commercial_bsmv' | 'consumer_tax' | 'none'

const TAX_RATE_CONFIG: Record<TaxRateType, { label: string; rate: number; desc: string }> = {
  commercial_bsmv: { label: 'Ticari Kredi (%5 BSMV)', rate: 5, desc: 'Yalnızca %5 BSMV uygulanır (KKDF %0)' },
  consumer_tax: { label: 'Bireysel Kredi (%5 BSMV + %15 KKDF)', rate: 20, desc: 'Toplam %20 yasal vergi uygulanır' },
  none: { label: 'Vergisiz / Muaf (%0)', rate: 0, desc: 'Vergi eklenmez' }
}

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

function addMonthsToDate(dateStr: string, monthsToAdd: number): string {
  if (!dateStr) return getLocalTodayISO()
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1 + monthsToAdd, d)
  const year = dt.getFullYear()
  const month = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(Math.min(d, new Date(year, dt.getMonth() + 1, 0).getDate())).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Bankacılık Standartlarında (BSMV ve KKDF Dahil) Eşit Taksitli Amortisman Planı
function generateInstallmentsPlan(
  principal: number,
  monthlyRatePercent: number,
  totalInstallments: number,
  firstDueDateStr: string,
  taxRatePercent: number = 5,
  manualMonthlyInstallment?: number
): LoanInstallment[] {
  const plan: LoanInstallment[] = []
  if (principal <= 0 || totalInstallments <= 0) return plan

  const r = monthlyRatePercent / 100
  const taxRate = taxRatePercent / 100
  const rBrut = r * (1 + taxRate)

  let monthlyInstallment = manualMonthlyInstallment || 0

  if (!monthlyInstallment) {
    if (rBrut > 0) {
      const factor = Math.pow(1 + rBrut, totalInstallments)
      monthlyInstallment = Math.round((principal * (rBrut * factor) / (factor - 1)) * 100) / 100
    } else {
      monthlyInstallment = Math.round((principal / totalInstallments) * 100) / 100
    }
  }

  let currentPrincipal = principal

  for (let i = 1; i <= totalInstallments; i++) {
    const dueDate = addMonthsToDate(firstDueDateStr, i - 1)
    const interestPart = r > 0 ? Math.round(currentPrincipal * r * 100) / 100 : 0
    const taxPart = taxRate > 0 ? Math.round(interestPart * taxRate * 100) / 100 : 0
    let principalPart = Math.round((monthlyInstallment - interestPart - taxPart) * 100) / 100
    let instTotal = monthlyInstallment

    // Son taksit veya anapara taşması durumunda kuruş dengelemesi
    if (i === totalInstallments || principalPart > currentPrincipal) {
      principalPart = currentPrincipal
      instTotal = Math.round((principalPart + interestPart + taxPart) * 100) / 100
    }

    currentPrincipal = Math.max(0, Math.round((currentPrincipal - principalPart) * 100) / 100)

    plan.push({
      installment_no: i,
      due_date: dueDate,
      total_amount: instTotal,
      principal_amount: principalPart,
      interest_amount: interestPart,
      tax_amount: taxPart,
      remaining_principal_after: currentPrincipal,
      status: 'pending'
    })
  }

  return plan
}

export default function BankLoansPage() {
  const { profile, isAdmin } = useAuth()
  const isRestricted = !isAdmin && !!profile?.allowed_companies && profile.allowed_companies.length > 0

  const [loans, setLoans] = useState<BankLoan[]>([])
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [banks, setBanks] = useState<BankAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [isTableMissing, setIsTableMissing] = useState(false)

  // Şirket Filtresi
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<'all' | 'common' | string>('all')

  // Kredi Ekle / Düzenle Modal State
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false)
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null)
  const [formLoanName, setFormLoanName] = useState('')
  const [formReferenceNo, setFormReferenceNo] = useState('')
  const [formBankName, setFormBankName] = useState('')
  const [formBankAccountId, setFormBankAccountId] = useState('')
  const [formCompanyId, setFormCompanyId] = useState('common')
  const [formLoanType, setFormLoanType] = useState<LoanType>('commercial')
  const [formTaxType, setFormTaxType] = useState<TaxRateType>('commercial_bsmv')
  const [formPrincipal, setFormPrincipal] = useState('250000')
  const [formInterestRate, setFormInterestRate] = useState('3.59')
  const [formTotalInstallments, setFormTotalInstallments] = useState('12')
  const [formMonthlyInstallment, setFormMonthlyInstallment] = useState('')
  const [formStartDate, setFormStartDate] = useState(getLocalTodayISO())
  const [formFirstDueDate, setFormFirstDueDate] = useState(addMonthsToDate(getLocalTodayISO(), 1))
  const [formInsuranceAmount, setFormInsuranceAmount] = useState('')
  const [formNetDisbursed, setFormNetDisbursed] = useState('')
  const [formNotes, setFormNotes] = useState('')
  
  // Aktif Kredi Devir Alanları (Önceden ödenmiş taksitler)
  const [isExistingLoan, setIsExistingLoan] = useState(false)
  const [formPrepaidCount, setFormPrepaidCount] = useState('0')
  const [formDisburseToBank, setFormDisburseToBank] = useState(false)

  // Taksit Ödeme Modalı State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false)
  const [payingLoan, setPayingLoan] = useState<BankLoan | null>(null)
  const [payingInstallment, setPayingInstallment] = useState<LoanInstallment | null>(null)
  const [payDate, setPayDate] = useState(getLocalTodayISO())
  const [payBankAccountId, setPayBankAccountId] = useState('')
  const [payTotalAmount, setPayTotalAmount] = useState('')
  const [payPrincipalAmount, setPayPrincipalAmount] = useState('')
  const [payInterestAmount, setPayInterestAmount] = useState('')
  const [payTaxAmount, setPayTaxAmount] = useState('')
  const [isSubmittingPay, setIsSubmittingPay] = useState(false)

  // Taksit Düzenle Modalı State
  const [isEditInstallmentModalOpen, setIsEditInstallmentModalOpen] = useState(false)
  const [editingInstallment, setEditingInstallment] = useState<LoanInstallment | null>(null)
  const [editInstDueDate, setEditInstDueDate] = useState('')
  const [editInstTotal, setEditInstTotal] = useState('')
  const [editInstPrincipal, setEditInstPrincipal] = useState('')
  const [editInstInterest, setEditInstInterest] = useState('')
  const [editInstTax, setEditInstTax] = useState('')

  // Onay Modalı State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    confirmText: string
    cancelText: string
    isDanger: boolean
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    cancelText: '',
    isDanger: false,
    onConfirm: () => {}
  })

  useEffect(() => {
    fetchInitialData()
  }, [isRestricted, profile?.allowed_companies])

  async function fetchInitialData() {
    setLoading(true)
    try {
      await Promise.all([fetchCompanies(), fetchBanks(), fetchLoans()])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchCompanies() {
    const { data } = await supabase.from('companies').select('*').order('name', { ascending: true })
    let comps = data || []
    if (isRestricted) {
      comps = comps.filter(c => profile?.allowed_companies?.includes(c.id))
    }
    setCompanies(comps)
  }

  async function fetchBanks() {
    const { data } = await supabase.from('bank_accounts').select('id, bank_name, account_name, balance, currency, company_id').order('bank_name', { ascending: true })
    let bankList = data || []
    if (isRestricted) {
      bankList = bankList.filter(b => !b.company_id || profile?.allowed_companies?.includes(b.company_id))
    }
    setBanks(bankList)
  }

  async function fetchLoans() {
    try {
      const { data, error } = await supabase
        .from('bank_loans')
        .select('*, company:companies(name, is_personal), bank_account:bank_accounts(bank_name, account_name, currency)')
        .order('created_at', { ascending: false })

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('bank_loans')) {
          setIsTableMissing(true)
          const cached = localStorage.getItem('ctc_bank_loans_cache')
          if (cached) {
            try {
              const parsed = JSON.parse(cached)
              setLoans(parsed)
              if (parsed.length > 0 && !selectedLoanId) setSelectedLoanId(parsed[0].id)
            } catch (e) {
              setLoans([])
            }
          }
          return
        }
        throw error
      }

      setIsTableMissing(false)
      const list = (data || []).filter(l => {
        if (!isRestricted) return true
        if (!l.company_id) return false
        return profile?.allowed_companies?.includes(l.company_id)
      })

      setLoans(list)
      if (list.length > 0) {
        setSelectedLoanId(prev => (prev && list.some(l => l.id === prev) ? prev : list[0].id))
      } else {
        setSelectedLoanId(null)
      }
    } catch (err: any) {
      console.error('Krediler yüklenirken hata:', err)
      toast.error('Kredi verileri yüklenemedi.')
    }
  }

  // Mutlak banka bakiyesi yeniden hesaplama
  async function recalculateAbsoluteBankBalance(bankId: string) {
    if (!bankId) return
    const { data: txs, error } = await supabase
      .from('bank_transactions')
      .select('amount, tx_type, status')
      .eq('bank_account_id', bankId)
    if (error) return
    const balance = (txs || []).reduce((acc, tx) => {
      if (tx.status === 'pending') return acc
      return tx.tx_type === 'in' ? acc + Number(tx.amount) : acc - Number(tx.amount)
    }, 0)
    await supabase.from('bank_accounts').update({ balance }).eq('id', bankId)
  }

  // Filtrelenmiş Krediler
  const filteredLoans = useMemo(() => {
    return loans.filter(loan => {
      if (selectedCompanyFilter === 'all') return true
      if (selectedCompanyFilter === 'common') return !loan.company_id
      return loan.company_id === selectedCompanyFilter
    })
  }, [loans, selectedCompanyFilter])

  const selectedLoan = useMemo(() => {
    return loans.find(l => l.id === selectedLoanId) || null
  }, [loans, selectedLoanId])

  // Canlı Form Önizleme Amortisman Tablosu
  const previewPlan = useMemo(() => {
    const p = parseFloat(formPrincipal) || 0
    const r = parseFloat(formInterestRate) || 0
    const n = parseInt(formTotalInstallments) || 12
    const m = parseFloat(formMonthlyInstallment) || undefined
    const taxRate = TAX_RATE_CONFIG[formTaxType].rate

    return generateInstallmentsPlan(p, r, n, formFirstDueDate, taxRate, m)
  }, [formPrincipal, formInterestRate, formTotalInstallments, formFirstDueDate, formTaxType, formMonthlyInstallment])

  const previewSummary = useMemo(() => {
    const totalPayment = previewPlan.reduce((acc, i) => acc + i.total_amount, 0)
    const totalInterest = previewPlan.reduce((acc, i) => acc + i.interest_amount, 0)
    const totalTax = previewPlan.reduce((acc, i) => acc + (i.tax_amount || 0), 0)
    const monthlyInstallment = previewPlan[0]?.total_amount || 0
    return { totalPayment, totalInterest, totalTax, monthlyInstallment }
  }, [previewPlan])

  // KPI Hesaplamaları
  const kpiStats = useMemo(() => {
    const active = filteredLoans.filter(l => l.status === 'active')
    const totalPrincipal = active.reduce((acc, l) => acc + Number(l.principal_amount || 0), 0)
    const remainingPrincipal = active.reduce((acc, l) => acc + Number(l.remaining_principal || 0), 0)
    const totalPaid = active.reduce((acc, l) => acc + (Number(l.principal_amount || 0) - Number(l.remaining_principal || 0)), 0)

    const today = new Date()
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    
    let thisMonthDueTotal = 0
    let thisMonthDueCount = 0

    active.forEach(l => {
      l.installments_plan?.forEach(inst => {
        if (inst.status === 'pending' && inst.due_date?.startsWith(currentMonthKey)) {
          thisMonthDueTotal += Number(inst.total_amount || 0)
          thisMonthDueCount += 1
        }
      })
    })

    return {
      activeCount: active.length,
      totalPrincipal,
      remainingPrincipal,
      totalPaid,
      thisMonthDueTotal,
      thisMonthDueCount
    }
  }, [filteredLoans])

  // ==============================================================================
  // KREDİ OLUŞTURMA & DÜZENLEME MODALI FONKSİYONLARI
  // ==============================================================================
  function openNewLoanModal() {
    setEditingLoanId(null)
    setFormLoanName('')
    setFormReferenceNo('')
    setFormBankName(banks[0]?.bank_name || '')
    setFormBankAccountId(banks[0]?.id || '')
    setFormCompanyId(isRestricted && profile?.allowed_companies?.[0] ? profile.allowed_companies[0] : 'common')
    setFormLoanType('commercial')
    setFormTaxType('commercial_bsmv')
    setFormPrincipal('250000')
    setFormInterestRate('3.59')
    setFormTotalInstallments('12')
    setFormMonthlyInstallment('')
    setFormStartDate(getLocalTodayISO())
    setFormFirstDueDate(addMonthsToDate(getLocalTodayISO(), 1))
    setFormInsuranceAmount('')
    setFormNetDisbursed('')
    setFormNotes('')
    setIsExistingLoan(false)
    setFormPrepaidCount('0')
    setFormDisburseToBank(false)
    setIsLoanModalOpen(true)
  }

  function openEditLoanModal(loan: BankLoan) {
    setEditingLoanId(loan.id)
    setFormLoanName(loan.loan_name)
    setFormReferenceNo(loan.loan_reference_no || '')
    setFormBankName(loan.bank_name)
    setFormBankAccountId(loan.bank_account_id || '')
    setFormCompanyId(loan.company_id || 'common')
    setFormLoanType(loan.loan_type)
    setFormTaxType(loan.tax_rate_type || 'commercial_bsmv')
    setFormPrincipal(loan.principal_amount.toString())
    setFormInterestRate(loan.interest_rate.toString())
    setFormTotalInstallments(loan.total_installments.toString())
    setFormMonthlyInstallment(loan.monthly_installment.toString())
    setFormStartDate(loan.start_date)
    setFormFirstDueDate(loan.first_due_date)
    setFormInsuranceAmount(loan.insurance_amount ? loan.insurance_amount.toString() : '')
    setFormNetDisbursed(loan.net_disbursed_amount ? loan.net_disbursed_amount.toString() : '')
    setFormNotes(loan.notes || '')
    setIsExistingLoan(false)
    setFormPrepaidCount('0')
    setFormDisburseToBank(false)
    setIsLoanModalOpen(true)
  }

  async function handleSaveLoan(e: React.FormEvent) {
    e.preventDefault()
    const principal = parseFloat(formPrincipal)
    const rate = parseFloat(formInterestRate) || 0
    const totalInst = parseInt(formTotalInstallments) || 12
    const manualMonthly = parseFloat(formMonthlyInstallment) || undefined
    const prepaid = isExistingLoan ? Math.min(parseInt(formPrepaidCount) || 0, totalInst) : 0
    const taxRate = TAX_RATE_CONFIG[formTaxType].rate

    if (!formLoanName.trim() || !formBankName.trim() || isNaN(principal) || principal <= 0) {
      toast.error('Lütfen kredi adı, banka ve geçerli bir anapara tutarı giriniz.')
      return
    }

    // Amortisman planını üret
    let plan = generateInstallmentsPlan(principal, rate, totalInst, formFirstDueDate, taxRate, manualMonthly)
    
    // Eğer önceden ödenmiş devir taksitleri varsa işaretle
    if (prepaid > 0) {
      plan = plan.map((inst, idx) => {
        if (idx < prepaid) {
          return {
            ...inst,
            status: 'paid' as const,
            is_opening_settled: true,
            payment_date: inst.due_date,
            notes: 'Sistem öncesi devir taksiti (Ödendi)'
          }
        }
        return inst
      })
    }

    const totalPayment = plan.reduce((acc, i) => acc + i.total_amount, 0)
    const totalInterest = plan.reduce((acc, i) => acc + i.interest_amount, 0)
    const totalTax = plan.reduce((acc, i) => acc + (i.tax_amount || 0), 0)
    const monthlyInst = plan[0]?.total_amount || 0

    // Kalan borç hesabı
    const remainingPrincipal = plan
      .filter(i => i.status === 'pending')
      .reduce((acc, i) => acc + i.principal_amount, 0)
    const remainingTotal = plan
      .filter(i => i.status === 'pending')
      .reduce((acc, i) => acc + i.total_amount, 0)

    const payload: Partial<BankLoan> = {
      loan_name: formLoanName.trim(),
      loan_reference_no: formReferenceNo.trim() || null,
      bank_name: formBankName.trim(),
      bank_account_id: formBankAccountId || null,
      company_id: formCompanyId === 'common' ? null : formCompanyId,
      loan_type: formLoanType,
      tax_rate_type: formTaxType,
      principal_amount: principal,
      interest_rate: rate,
      total_installments: totalInst,
      paid_installments: prepaid,
      monthly_installment: monthlyInst,
      total_payment: totalPayment,
      total_interest: totalInterest,
      total_tax: totalTax,
      remaining_principal: remainingPrincipal,
      remaining_total: remainingTotal,
      currency: 'TRY',
      start_date: formStartDate,
      first_due_date: formFirstDueDate,
      insurance_amount: parseFloat(formInsuranceAmount) || 0,
      net_disbursed_amount: parseFloat(formNetDisbursed) || 0,
      status: remainingPrincipal <= 0 ? 'completed' : 'active',
      notes: formNotes.trim() || null,
      installments_plan: plan
    }

    try {
      if (isTableMissing) {
        const existingCached = localStorage.getItem('ctc_bank_loans_cache')
        let cachedList: BankLoan[] = existingCached ? JSON.parse(existingCached) : []
        if (editingLoanId) {
          cachedList = cachedList.map(l => l.id === editingLoanId ? { ...l, ...payload } as BankLoan : l)
        } else {
          const newLoan = { id: `local-${Date.now()}`, ...payload, created_at: new Date().toISOString() } as BankLoan
          cachedList.unshift(newLoan)
        }
        localStorage.setItem('ctc_bank_loans_cache', JSON.stringify(cachedList))
        setLoans(cachedList)
        if (cachedList.length > 0 && !selectedLoanId) setSelectedLoanId(cachedList[0].id)
        toast.success(editingLoanId ? 'Kredi güncellendi (Yerel).' : 'Yeni kredi kaydedildi (Yerel). Lütfen Supabase SQL scriptini çalıştırınız.')
        setIsLoanModalOpen(false)
        return
      }

      if (editingLoanId) {
        const { error } = await supabase.from('bank_loans').update(payload).eq('id', editingLoanId)
        if (error) throw error
        await logActivity('bank', 'UPDATE', `Banka kredisi güncellendi: ${payload.loan_name}`, editingLoanId, principal, 'TRY', null, payload, payload.company_id)
        toast.success('Kredi başarıyla güncellendi.')
      } else {
        const { data, error } = await supabase.from('bank_loans').insert([payload]).select().single()
        if (error) throw error

        if (formDisburseToBank && formBankAccountId) {
          const disburseAmount = parseFloat(formNetDisbursed) > 0 ? parseFloat(formNetDisbursed) : principal
          const bankTxPayload = {
            bank_account_id: formBankAccountId,
            company_id: payload.company_id,
            tx_date: formStartDate,
            description: `Kredi Kullandırımı: ${payload.loan_name} (Net Giriş)`,
            tx_type: 'in',
            amount: disburseAmount,
            currency: 'TRY',
            exchange_rate: 1,
            is_transfer: false,
            transfer_id: `LOAN-DISBURSE-${data.id}`,
            status: 'completed'
          }
          await supabase.from('bank_transactions').insert([bankTxPayload])
          await recalculateAbsoluteBankBalance(formBankAccountId)
        }

        await logActivity('bank', 'INSERT', `Yeni banka kredisi eklendi: ${payload.loan_name}`, data.id, principal, 'TRY', null, payload, payload.company_id)
        toast.success('Yeni kredi başarıyla kaydedildi.')
      }

      setIsLoanModalOpen(false)
      fetchLoans()
    } catch (err: any) {
      console.error('Kredi kaydedilirken hata:', err)
      toast.error(err.message || 'Kredi kaydedilemedi.')
    }
  }

  // ==============================================================================
  // TAKSİT ÖDEME İŞLEMLERİ (ÇAPRAZ MODÜL ENTEGRASYONU)
  // ==============================================================================
  function openPayModal(loan: BankLoan, inst: LoanInstallment) {
    setPayingLoan(loan)
    setPayingInstallment(inst)
    setPayDate(getLocalTodayISO())
    setPayBankAccountId(loan.bank_account_id || banks[0]?.id || '')
    setPayTotalAmount(inst.total_amount.toString())
    setPayPrincipalAmount(inst.principal_amount.toString())
    setPayInterestAmount(inst.interest_amount.toString())
    setPayTaxAmount((inst.tax_amount || 0).toString())
    setIsPayModalOpen(true)
  }

  async function handleConfirmPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!payingLoan || !payingInstallment) return

    const totalAmt = parseFloat(payTotalAmount)
    const principalAmt = parseFloat(payPrincipalAmount)
    const interestAmt = parseFloat(payInterestAmount) || 0
    const taxAmt = parseFloat(payTaxAmount) || 0
    const totalFinancingCost = Math.round((interestAmt + taxAmt) * 100) / 100

    if (!payBankAccountId) {
      toast.error('Lütfen ödemenin çıkacağı banka hesabını seçiniz.')
      return
    }
    if (isNaN(totalAmt) || totalAmt <= 0) {
      toast.error('Geçerli bir taksit ödeme tutarı giriniz.')
      return
    }

    setIsSubmittingPay(true)

    try {
      const selectedBank = banks.find(b => b.id === payBankAccountId)
      const bankName = selectedBank ? `${selectedBank.bank_name} (${selectedBank.account_name || ''})` : 'Banka Hesabı'

      let bankTxId: string | null = null
      let expenseTxId: string | null = null

      // 1. Banka Hesabından Toplam Taksit Tutarı Çıkışı (LOAN-INST)
      const bankTxPayload = {
        bank_account_id: payBankAccountId,
        company_id: payingLoan.company_id,
        tx_date: payDate,
        description: `Kredi Taksiti: ${payingLoan.bank_name} - ${payingLoan.loan_name} (Taksit ${payingInstallment.installment_no}/${payingLoan.total_installments} - Anapara: ${formatMoney(principalAmt).formatted}, Faiz: ${formatMoney(interestAmt).formatted}, BSMV: ${formatMoney(taxAmt).formatted})`,
        tx_type: 'out',
        amount: totalAmt,
        currency: 'TRY',
        exchange_rate: 1,
        is_transfer: false,
        transfer_id: `LOAN-INST-${payingLoan.id}-${payingInstallment.installment_no}`,
        status: 'completed'
      }

      const { data: bTxData, error: bErr } = await supabase.from('bank_transactions').insert([bankTxPayload]).select().single()
      if (bErr) throw bErr
      bankTxId = bTxData.id

      // 2. Faiz + BSMV Toplam Finansman Maliyeti İçin Gider Kaydı (LOAN-EXP)
      if (totalFinancingCost > 0) {
        const { data: catList } = await supabase.from('expense_categories').select('id, name')
        const matchedCat = catList?.find(c => c.name.toLowerCase().includes('faiz') || c.name.toLowerCase().includes('finansman') || c.name.toLowerCase().includes('kredi'))
        
        const expPayload = {
          category_id: matchedCat?.id || catList?.[0]?.id || null,
          company_id: payingLoan.company_id,
          tx_date: payDate,
          description: `Finansman Gideri & BSMV: ${payingLoan.bank_name} - ${payingLoan.loan_name} (Taksit ${payingInstallment.installment_no} Net Faiz: ${formatMoney(interestAmt).formatted} + BSMV: ${formatMoney(taxAmt).formatted})`,
          amount: totalFinancingCost,
          currency: 'TRY',
          exchange_rate: 1,
          payment_source_type: 'bank',
          payment_source_id: payBankAccountId,
          transfer_id: `LOAN-EXP-${payingLoan.id}-${payingInstallment.installment_no}`
        }

        const { data: expData, error: expErr } = await supabase.from('expense_transactions').insert([expPayload]).select().single()
        if (!expErr && expData) {
          expenseTxId = expData.id
        }
      }

      // 3. Kredinin Amortisman Planını ve Bakiyesini Güncelle
      const updatedPlan = payingLoan.installments_plan.map(inst => {
        if (inst.installment_no === payingInstallment.installment_no) {
          return {
            ...inst,
            total_amount: totalAmt,
            principal_amount: principalAmt,
            interest_amount: interestAmt,
            tax_amount: taxAmt,
            status: 'paid' as const,
            payment_date: payDate,
            bank_account_id: payBankAccountId,
            bank_tx_id: bankTxId,
            expense_tx_id: expenseTxId
          }
        }
        return inst
      })

      const paidCount = updatedPlan.filter(i => i.status === 'paid').length
      const remainingPrincipal = Math.max(0, Math.round(updatedPlan.filter(i => i.status === 'pending').reduce((acc, i) => acc + i.principal_amount, 0) * 100) / 100)
      const remainingTotal = Math.max(0, Math.round(updatedPlan.filter(i => i.status === 'pending').reduce((acc, i) => acc + i.total_amount, 0) * 100) / 100)

      const updateLoanPayload = {
        installments_plan: updatedPlan,
        paid_installments: paidCount,
        remaining_principal: remainingPrincipal,
        remaining_total: remainingTotal,
        status: remainingPrincipal <= 0 ? 'completed' : 'active'
      }

      if (!isTableMissing) {
        await supabase.from('bank_loans').update(updateLoanPayload).eq('id', payingLoan.id)
      } else {
        const cached = localStorage.getItem('ctc_bank_loans_cache')
        let cachedList: BankLoan[] = cached ? JSON.parse(cached) : []
        cachedList = cachedList.map(l => l.id === payingLoan.id ? { ...l, ...updateLoanPayload } as BankLoan : l)
        localStorage.setItem('ctc_bank_loans_cache', JSON.stringify(cachedList))
      }

      // 4. Banka Bakiyesini Yeniden Hesapla
      await recalculateAbsoluteBankBalance(payBankAccountId)

      // 5. Audit Log
      await logActivity(
        'bank',
        'INSERT',
        `Kredi taksiti ödendi: ${payingLoan.loan_name} (Taksit ${payingInstallment.installment_no}/${payingLoan.total_installments} - ${bankName})`,
        payingLoan.id,
        totalAmt,
        'TRY',
        null,
        { bankTxId, expenseTxId, principalAmt, interestAmt, taxAmt },
        payingLoan.company_id
      )

      toast.success(`Taksit ${payingInstallment.installment_no} ödendi ve bankadan düşüldü!`)
      setIsPayModalOpen(false)
      fetchLoans()
    } catch (err: any) {
      console.error('Taksit ödenirken hata:', err)
      toast.error(err.message || 'Ödeme işlemi gerçekleştirilemedi.')
    } finally {
      setIsSubmittingPay(false)
    }
  }

  // Taksit Ödemesini Geri Al (İptal Et)
  function handleReverseInstallmentPayment(loan: BankLoan, inst: LoanInstallment) {
    setConfirmDialog({
      isOpen: true,
      title: 'Taksit Ödemesini İptal Et',
      message: `Taksit ${inst.installment_no} için yapılan banka çıkışı ve faiz gider kaydı sistemden silinecektir. Kredi kalan borcu tekrar artacaktır. Onaylıyor musunuz?`,
      confirmText: 'Evet, Ödemeyi Geri Al',
      cancelText: 'Vazgeç',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        try {
          if (!inst.is_opening_settled) {
            await supabase
              .from('bank_transactions')
              .delete()
              .eq('transfer_id', `LOAN-INST-${loan.id}-${inst.installment_no}`)

            await supabase
              .from('expense_transactions')
              .delete()
              .eq('transfer_id', `LOAN-EXP-${loan.id}-${inst.installment_no}`)

            if (inst.bank_account_id) {
              await recalculateAbsoluteBankBalance(inst.bank_account_id)
            }
          }

          const updatedPlan = loan.installments_plan.map(i => {
            if (i.installment_no === inst.installment_no) {
              return {
                ...i,
                status: 'pending' as const,
                payment_date: null,
                bank_account_id: null,
                bank_tx_id: null,
                expense_tx_id: null,
                is_opening_settled: false,
                notes: null
              }
            }
            return i
          })

          const paidCount = updatedPlan.filter(i => i.status === 'paid').length
          const remainingPrincipal = Math.max(0, Math.round(updatedPlan.filter(i => i.status === 'pending').reduce((acc, i) => acc + i.principal_amount, 0) * 100) / 100)
          const remainingTotal = Math.max(0, Math.round(updatedPlan.filter(i => i.status === 'pending').reduce((acc, i) => acc + i.total_amount, 0) * 100) / 100)

          const updateLoanPayload = {
            installments_plan: updatedPlan,
            paid_installments: paidCount,
            remaining_principal: remainingPrincipal,
            remaining_total: remainingTotal,
            status: 'active' as const
          }

          if (!isTableMissing) {
            await supabase.from('bank_loans').update(updateLoanPayload).eq('id', loan.id)
          } else {
            const cached = localStorage.getItem('ctc_bank_loans_cache')
            let cachedList: BankLoan[] = cached ? JSON.parse(cached) : []
            cachedList = cachedList.map(l => l.id === loan.id ? { ...l, ...updateLoanPayload } as BankLoan : l)
            localStorage.setItem('ctc_bank_loans_cache', JSON.stringify(cachedList))
          }

          toast.success(`Taksit ${inst.installment_no} ödemesi geri alındı.`)
          fetchLoans()
        } catch (err: any) {
          console.error('Ödeme geri alınırken hata:', err)
          toast.error(err.message || 'İptal işlemi başarısız.')
        }
      }
    })
  }

  // Taksit Manuel Düzenleme
  function openEditInstallmentModal(inst: LoanInstallment) {
    setEditingInstallment(inst)
    setEditInstDueDate(inst.due_date)
    setEditInstTotal(inst.total_amount.toString())
    setEditInstPrincipal(inst.principal_amount.toString())
    setEditInstInterest(inst.interest_amount.toString())
    setEditInstTax((inst.tax_amount || 0).toString())
    setIsEditInstallmentModalOpen(true)
  }

  async function handleSaveInstallmentEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedLoan || !editingInstallment) return

    const total = parseFloat(editInstTotal)
    const principal = parseFloat(editInstPrincipal)
    const interest = parseFloat(editInstInterest) || 0
    const tax = parseFloat(editInstTax) || 0

    if (isNaN(total) || total <= 0 || isNaN(principal) || principal <= 0) {
      toast.error('Geçerli taksit ve anapara tutarları giriniz.')
      return
    }

    const updatedPlan = selectedLoan.installments_plan.map(i => {
      if (i.installment_no === editingInstallment.installment_no) {
        return {
          ...i,
          due_date: editInstDueDate,
          total_amount: total,
          principal_amount: principal,
          interest_amount: interest,
          tax_amount: tax
        }
      }
      return i
    })

    const remainingPrincipal = Math.max(0, Math.round(updatedPlan.filter(i => i.status === 'pending').reduce((acc, i) => acc + i.principal_amount, 0) * 100) / 100)
    const remainingTotal = Math.max(0, Math.round(updatedPlan.filter(i => i.status === 'pending').reduce((acc, i) => acc + i.total_amount, 0) * 100) / 100)

    try {
      const payload = {
        installments_plan: updatedPlan,
        remaining_principal: remainingPrincipal,
        remaining_total: remainingTotal
      }

      if (!isTableMissing) {
        await supabase.from('bank_loans').update(payload).eq('id', selectedLoan.id)
      } else {
        const cached = localStorage.getItem('ctc_bank_loans_cache')
        let cachedList: BankLoan[] = cached ? JSON.parse(cached) : []
        cachedList = cachedList.map(l => l.id === selectedLoan.id ? { ...l, ...payload } as BankLoan : l)
        localStorage.setItem('ctc_bank_loans_cache', JSON.stringify(cachedList))
      }

      toast.success(`Taksit ${editingInstallment.installment_no} güncellendi.`)
      setIsEditInstallmentModalOpen(false)
      fetchLoans()
    } catch (err: any) {
      toast.error('Taksit güncellenemedi.')
    }
  }

  // Kredi Silme
  function handleDeleteLoan(loan: BankLoan) {
    setConfirmDialog({
      isOpen: true,
      title: 'Krediyi Sil',
      message: `"${loan.loan_name}" kredisini silmek istediğinize emin misiniz? Yapılmış taksit ödemeleri varsa banka hareket kayıtları korunacaktır.`,
      confirmText: 'Evet, Krediyi Sil',
      cancelText: 'Vazgeç',
      isDanger: true,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        try {
          if (!isTableMissing) {
            const { error } = await supabase.from('bank_loans').delete().eq('id', loan.id)
            if (error) throw error
          } else {
            const cached = localStorage.getItem('ctc_bank_loans_cache')
            let cachedList: BankLoan[] = cached ? JSON.parse(cached) : []
            cachedList = cachedList.filter(l => l.id !== loan.id)
            localStorage.setItem('ctc_bank_loans_cache', JSON.stringify(cachedList))
          }

          await logActivity('bank', 'DELETE', `Banka kredisi silindi: ${loan.loan_name}`, loan.id, loan.principal_amount, 'TRY', loan, null, loan.company_id)
          toast.success('Kredi silindi.')
          fetchLoans()
        } catch (err: any) {
          toast.error(err.message || 'Kredi silinemedi.')
        }
      }
    })
  }

  function copyMigrationSql() {
    const sql = `-- CTC Master Ledger - Banka Kredileri Tablosu
CREATE TABLE IF NOT EXISTS public.bank_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_name TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    loan_reference_no TEXT,
    bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    loan_type TEXT NOT NULL DEFAULT 'commercial',
    principal_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    interest_rate NUMERIC(8, 4) NOT NULL DEFAULT 0,
    tax_rate_type TEXT NOT NULL DEFAULT 'commercial_bsmv',
    total_installments INTEGER NOT NULL DEFAULT 12,
    paid_installments INTEGER NOT NULL DEFAULT 0,
    monthly_installment NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_payment NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_interest NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_tax NUMERIC(15, 2) NOT NULL DEFAULT 0,
    remaining_principal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    remaining_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'TRY',
    start_date DATE NOT NULL,
    first_due_date DATE NOT NULL,
    insurance_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    net_disbursed_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    installments_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`
    navigator.clipboard.writeText(sql)
    toast.success('SQL panoya kopyalandı! Supabase SQL Editor alanında çalıştırabilirsiniz.')
  }

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] bg-[#070b14] text-slate-100 overflow-hidden font-sans">
      <Toaster position="top-right" />

      {/* VERİTABANI TABLOSU EKSİK UYARISI BANNERI */}
      {isTableMissing && (
        <div className="bg-amber-950/40 border-b border-amber-500/40 px-4 py-2 flex items-center justify-between text-xs text-amber-300 shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-400 shrink-0 animate-pulse" />
            <span>
              <strong>Veritabanı Tablosu Hazır:</strong> Supabase SQL Editor'da <code className="bg-amber-900/60 px-1 py-0.5 rounded font-mono text-amber-200">supabase/bank_loans.sql</code> dosyasını bir defa çalıştırarak kalıcı hale getirebilirsiniz.
            </span>
          </div>
          <button 
            onClick={copyMigrationSql}
            className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition-colors shadow text-xs cursor-pointer active:scale-95"
          >
            <Copy size={12} /> SQL'i Kopyala
          </button>
        </div>
      )}

      {/* ÜST BAŞLIK VE AKSİYON ŞERİDİ */}
      <div className="p-4 border-b border-slate-800/80 bg-[#0a0f1d] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
            <BadgePercent size={24} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-wide text-white flex items-center gap-2">
              BANKA KREDİLERİ & TAKSİT TAKİBİ
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono font-normal">
                {filteredLoans.length} Kredi
              </span>
            </h1>
            <p className="text-xs text-slate-400">Aktif krediler, BSMV/KKDF amortisman planları ve faiz gideri ayrımı</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Şirket Filtresi */}
          <div className="flex items-center gap-1.5 bg-[#0d1322] border border-slate-700/80 rounded-xl px-2.5 py-1 text-xs">
            <Building2 size={13} className="text-slate-400" />
            <select
              value={selectedCompanyFilter}
              onChange={(e) => setSelectedCompanyFilter(e.target.value)}
              className="bg-transparent text-slate-200 outline-none cursor-pointer pr-2 font-medium"
            >
              <option value="all" className="bg-slate-900 text-white">Tüm Merkezler</option>
              {!isRestricted && <option value="common" className="bg-slate-900 text-white">Ortak / Bağımsız</option>}
              {companies.map(c => (
                <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                  {c.is_personal ? '🏠 ' : '🏢 '} {c.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={openNewLoanModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-indigo-600/30 cursor-pointer active:scale-95"
          >
            <Plus size={15} /> Yeni Kredi Ekle
          </button>
        </div>
      </div>

      {/* KPI KARTLARI ŞERİDİ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-[#0a0f1d]/50 border-b border-slate-800/60 shrink-0">
        <div className="bg-[#0d1322] border border-slate-800/80 rounded-xl p-3 shadow">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">KALAN ANAPARA BORCU</span>
          <div className="text-lg font-black font-mono text-rose-400 mt-0.5">
            {formatMoney(kpiStats.remainingPrincipal).formatted}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">Net finansal durumu düşüren borç</span>
        </div>

        <div className="bg-[#0d1322] border border-slate-800/80 rounded-xl p-3 shadow">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">BU AY ÖDENECEK TAKSİTLER</span>
          <div className="text-lg font-black font-mono text-amber-400 mt-0.5">
            {formatMoney(kpiStats.thisMonthDueTotal).formatted}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">{kpiStats.thisMonthDueCount} adet vadesi gelen taksit</span>
        </div>

        <div className="bg-[#0d1322] border border-slate-800/80 rounded-xl p-3 shadow">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ÖDENEN ANAPARA</span>
          <div className="text-lg font-black font-mono text-emerald-400 mt-0.5">
            {formatMoney(kpiStats.totalPaid).formatted}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">Toplam kapanan borç payı</span>
        </div>

        <div className="bg-[#0d1322] border border-slate-800/80 rounded-xl p-3 shadow">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ÇEKİLEN TOPLAM KREDİ</span>
          <div className="text-lg font-black font-mono text-indigo-300 mt-0.5">
            {formatMoney(kpiStats.totalPrincipal).formatted}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">{kpiStats.activeCount} adet aktif kredi</span>
        </div>
      </div>

      {/* ANA İÇERİK: SOL KREDİLER LİSTESİ + SAĞ AMORTİSMAN TABLOSU */}
      <div className="flex-1 flex overflow-hidden">
        {/* SOL: Kredi Listesi Panel */}
        <div className="w-80 md:w-96 border-r border-slate-800/80 flex flex-col bg-[#080d1a] shrink-0">
          <div className="p-3 border-b border-slate-800/80 bg-[#0a0f1d] flex items-center justify-between text-xs font-bold text-slate-300">
            <span>KREDİLERİM ({filteredLoans.length})</span>
            <span className="text-[10px] text-slate-500">Seçmek için tıklayın</span>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
            {filteredLoans.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <BadgePercent size={32} className="mx-auto mb-2 opacity-40 text-slate-400" />
                <p className="font-semibold text-xs text-slate-400">Tanımlı kredi bulunamadı.</p>
                <p className="text-[10px] mt-1 text-slate-500">Sağ üstteki "Yeni Kredi Ekle" butonu ile aktif kredinizi ekleyebilirsiniz.</p>
              </div>
            ) : (
              filteredLoans.map(loan => {
                const isSelected = loan.id === selectedLoanId
                const pct = loan.total_installments > 0 ? Math.round((loan.paid_installments / loan.total_installments) * 100) : 0
                const nextPending = loan.installments_plan?.find(i => i.status === 'pending')

                return (
                  <div
                    key={loan.id}
                    onClick={() => setSelectedLoanId(loan.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'bg-gradient-to-br from-[#131d33] to-[#0c1424] border-indigo-500 shadow-lg shadow-indigo-950/40 ring-1 ring-indigo-500/50'
                        : 'bg-[#0d1322] border-slate-800/80 hover:border-slate-700 hover:bg-[#101728]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-black text-white">{loan.bank_name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                            {LOAN_TYPE_LABELS[loan.loan_type]}
                          </span>
                          {loan.loan_reference_no && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                              #{loan.loan_reference_no}
                            </span>
                          )}
                        </div>
                        <h3 className="text-xs text-slate-300 font-semibold mt-0.5 line-clamp-1" title={loan.loan_name}>
                          {loan.loan_name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditLoanModal(loan) }}
                          className="p-1 text-slate-400 hover:text-white transition rounded hover:bg-slate-800"
                          title="Krediyi Düzenle"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteLoan(loan) }}
                          className="p-1 text-slate-400 hover:text-rose-400 transition rounded hover:bg-slate-800"
                          title="Krediyi Sil"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between font-mono">
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase block font-sans">Kalan Anapara</span>
                        <span className="text-sm font-black text-rose-400">
                          {formatMoney(loan.remaining_principal).formatted}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-500 uppercase block font-sans">Aylık Taksit</span>
                        <span className="text-xs font-bold text-amber-300">
                          {formatMoney(loan.monthly_installment).formatted}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2.5">
                      <div className="flex justify-between text-[9px] text-slate-400 mb-1">
                        <span>{loan.paid_installments} / {loan.total_installments} Taksit</span>
                        <span className="font-bold text-indigo-400">%{pct} Tamamlandı</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${pct}%` }}
                          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full"
                        />
                      </div>
                    </div>

                    {nextPending && (
                      <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} className="text-indigo-400" /> Vade: {formatDateTR(nextPending.due_date)}
                        </span>
                        <span className="font-mono font-bold text-slate-200">
                          Taksit #{nextPending.installment_no}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* SAĞ: Seçili Kredinin Amortisman Planı Tablosu */}
        <div className="flex-1 flex flex-col bg-[#070b14] overflow-hidden">
          {selectedLoan ? (
            <>
              {/* Seçili Kredi Detay Üst Başlığı */}
              <div className="p-3.5 border-b border-slate-800/80 bg-[#0a0f1d] flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
                    <Landmark size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm font-black text-white">{selectedLoan.loan_name}</h2>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-500/30 font-bold">
                        {selectedLoan.bank_name}
                      </span>
                      {selectedLoan.loan_reference_no && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                          Ref: {selectedLoan.loan_reference_no}
                        </span>
                      )}
                      {selectedLoan.company?.name && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {selectedLoan.company.name}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-1 flex-wrap font-mono">
                      <span>Kredi Tutarı: <strong className="text-slate-200">{formatMoney(selectedLoan.principal_amount).formatted}</strong></span>
                      <span>Aylık Faiz: <strong className="text-slate-200">%{selectedLoan.interest_rate}</strong></span>
                      <span>Vergi: <strong className="text-slate-200">%{TAX_RATE_CONFIG[selectedLoan.tax_rate_type || 'commercial_bsmv'].rate} BSMV</strong></span>
                      <span>Geri Ödeme: <strong className="text-slate-200">{formatMoney(selectedLoan.total_payment).formatted}</strong></span>
                      <span>Toplam Faiz: <strong className="text-amber-400">{formatMoney(selectedLoan.total_interest).formatted}</strong></span>
                      {selectedLoan.total_tax ? (
                        <span>Toplam BSMV: <strong className="text-sky-400">{formatMoney(selectedLoan.total_tax).formatted}</strong></span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditLoanModal(selectedLoan)}
                    className="flex items-center gap-1 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                  >
                    <Edit3 size={12} /> Düzenle
                  </button>
                </div>
              </div>

              {/* Taksit Tablosu */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-[#0a0f1d]/60 shadow-lg">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#0a0f1d] text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="p-2.5 font-bold font-sans uppercase w-14 text-center">Sıra</th>
                        <th className="p-2.5 font-bold font-sans uppercase">Taksit Tarihi</th>
                        <th className="p-2.5 font-bold font-sans uppercase text-right">Kalan Anapara</th>
                        <th className="p-2.5 font-bold font-sans uppercase text-right text-amber-300">Taksit Tutarı</th>
                        <th className="p-2.5 font-bold font-sans uppercase text-right text-emerald-400">Anapara</th>
                        <th className="p-2.5 font-bold font-sans uppercase text-right text-rose-400">Net Faiz</th>
                        <th className="p-2.5 font-bold font-sans uppercase text-right text-sky-400">BSMV</th>
                        <th className="p-2.5 font-bold font-sans uppercase text-center w-28">Durum</th>
                        <th className="p-2.5 font-bold font-sans uppercase text-center w-36">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 font-mono">
                      {selectedLoan.installments_plan?.map((inst) => {
                        const isPaid = inst.status === 'paid'
                        const isOverdue = !isPaid && inst.due_date < getLocalTodayISO()
                        const isThisMonth = !isPaid && inst.due_date.startsWith(getLocalTodayISO().slice(0, 7))

                        return (
                          <tr 
                            key={inst.installment_no}
                            className={`hover:bg-slate-800/20 transition-colors ${
                              isPaid ? 'bg-emerald-950/5 text-slate-300' : isOverdue ? 'bg-rose-950/10' : ''
                            }`}
                          >
                            <td className="p-2.5 text-center font-bold text-slate-400 font-sans">
                              {inst.installment_no}
                            </td>
                            <td className="p-2.5 font-medium text-slate-200">
                              {formatDateTR(inst.due_date)}
                            </td>
                            <td className="p-2.5 text-right text-slate-400">
                              {formatMoney(inst.remaining_principal_after).formatted}
                            </td>
                            <td className="p-2.5 text-right font-bold text-amber-300">
                              {formatMoney(inst.total_amount).formatted}
                            </td>
                            <td className="p-2.5 text-right font-bold text-emerald-400">
                              {formatMoney(inst.principal_amount).formatted}
                            </td>
                            <td className="p-2.5 text-right font-bold text-rose-400">
                              {formatMoney(inst.interest_amount).formatted}
                            </td>
                            <td className="p-2.5 text-right font-bold text-sky-400">
                              {formatMoney(inst.tax_amount || 0).formatted}
                            </td>
                            <td className="p-2.5 text-center font-sans">
                              {isPaid ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                  <CheckCircle2 size={10} /> {inst.is_opening_settled ? 'Devir (Ödendi)' : 'Ödendi'}
                                </span>
                              ) : isOverdue ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse">
                                  <AlertCircle size={10} /> Vadesi Geçti
                                </span>
                              ) : isThisMonth ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  <Clock size={10} /> Bu Ay
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                                  Bekliyor
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-center font-sans">
                              {isPaid ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <span className="text-[10px] text-slate-500" title={`Ödeme Tarihi: ${formatDateTR(inst.payment_date || '')}`}>
                                    {formatDateTR(inst.payment_date || '')}
                                  </span>
                                  <button
                                    onClick={() => handleReverseInstallmentPayment(selectedLoan, inst)}
                                    className="p-1 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                                    title="Ödemeyi İptal Et / Geri Al"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => openPayModal(selectedLoan, inst)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition shadow shadow-emerald-700/30 cursor-pointer active:scale-95"
                                  >
                                    Taksit Öde
                                  </button>
                                  <button
                                    onClick={() => openEditInstallmentModal(inst)}
                                    className="p-1 text-slate-500 hover:text-slate-300 transition cursor-pointer"
                                    title="Taksit Tutarlarını Düzenle"
                                  >
                                    <Edit3 size={11} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="bg-[#0a0f1d] border-t-2 border-slate-700 font-bold font-mono">
                      <tr>
                        <td colSpan={3} className="p-2.5 text-right font-sans uppercase text-slate-300">
                          Toplam
                        </td>
                        <td className="p-2.5 text-right text-amber-300">
                          {formatMoney(selectedLoan.total_payment).formatted}
                        </td>
                        <td className="p-2.5 text-right text-emerald-400">
                          {formatMoney(selectedLoan.principal_amount).formatted}
                        </td>
                        <td className="p-2.5 text-right text-rose-400">
                          {formatMoney(selectedLoan.total_interest).formatted}
                        </td>
                        <td className="p-2.5 text-right text-sky-400">
                          {formatMoney(selectedLoan.total_tax || 0).formatted}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
              <div className="text-center">
                <BadgePercent size={40} className="mx-auto mb-2 opacity-30 text-indigo-400" />
                <p>Detaylarını ve ödeme planını görmek için soldan bir kredi seçiniz.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================================== */}
      {/* 1. YENİ / DÜZENLE KREDİ MODALI */}
      {/* ============================================================================== */}
      {isLoanModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-[#0d1322] border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#0a0f1d]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg">
                  <BadgePercent size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    {editingLoanId ? 'Krediyi Düzenle' : 'Yeni Taksitli Kredi Tanımla'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Bankanın verdiği ödeme planı parametrelerini giriniz</p>
                </div>
              </div>
              <button onClick={() => setIsLoanModalOpen(false)} className="text-slate-400 hover:text-white transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveLoan} className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                <div className="md:col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1">Kredi Tanımı / Adı *</label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Garanti BBVA 250.000 ₺ Ticari Kredi"
                    value={formLoanName}
                    onChange={e => setFormLoanName(e.target.value)}
                    className="w-full bg-[#070b14] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Kredi Referans Numarası</label>
                  <input
                    type="text"
                    placeholder="Örn: 03663-TT-000000000483"
                    value={formReferenceNo}
                    onChange={e => setFormReferenceNo(e.target.value)}
                    className="w-full bg-[#070b14] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Banka Adı *</label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Garanti BBVA"
                    value={formBankName}
                    onChange={e => setFormBankName(e.target.value)}
                    className="w-full bg-[#070b14] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Ödemenin Çıkacağı Hesap</label>
                  <select
                    value={formBankAccountId}
                    onChange={e => setFormBankAccountId(e.target.value)}
                    className="w-full bg-[#070b14] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">Seçiniz...</option>
                    {banks.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.bank_name} {b.account_name ? `(${b.account_name})` : ''} - {formatMoney(b.balance, b.currency).formatted}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Bağlı Merkez</label>
                  <select
                    value={formCompanyId}
                    onChange={e => setFormCompanyId(e.target.value)}
                    className="w-full bg-[#070b14] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {!isRestricted && <option value="common">Ortak / Bağımsız</option>}
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.is_personal ? '🏠 ' : '🏢 '} {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Kredi Türü</label>
                  <select
                    value={formLoanType}
                    onChange={e => setFormLoanType(e.target.value as LoanType)}
                    className="w-full bg-[#070b14] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="commercial">Ticari Kredi</option>
                    <option value="consumer">İhtiyaç / Tüketici Kredisi</option>
                    <option value="vehicle">Taşıt Kredisi</option>
                    <option value="housing">Konut Kredisi</option>
                    <option value="other">Diğer</option>
                  </select>
                </div>
              </div>

              {/* FİNANSAL HESAPLAMA VE VERGİ ALANI */}
              <div className="p-4 bg-[#070b14] border border-slate-800 rounded-xl space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                    <Percent size={14} className="text-indigo-400" /> Kredi Tutarları & Vergi Oranı
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Banka ödeme planınızdaki değerleri birebir yansıtır
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Kredi Tutarı (₺) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="250000"
                      value={formPrincipal}
                      onChange={e => setFormPrincipal(e.target.value)}
                      className="w-full bg-[#0a0f1d] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-black text-sm outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Aylık Faiz Oranı (%) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="Örn: 3.59"
                      value={formInterestRate}
                      onChange={e => setFormInterestRate(e.target.value)}
                      className="w-full bg-[#0a0f1d] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Vergi / BSMV Türü *</label>
                    <select
                      value={formTaxType}
                      onChange={e => setFormTaxType(e.target.value as TaxRateType)}
                      className="w-full bg-[#0a0f1d] border border-slate-700 rounded-xl px-3 py-2 text-white font-medium outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="commercial_bsmv">Ticari (%5 BSMV)</option>
                      <option value="consumer_tax">Bireysel (%5 BSMV + %15 KKDF)</option>
                      <option value="none">Vergisiz (%0)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Taksit Sayısı (Ay) *</label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      required
                      value={formTotalInstallments}
                      onChange={e => setFormTotalInstallments(e.target.value)}
                      className="w-full bg-[#0a0f1d] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Aylık Taksit Tutarı (₺)
                      <span className="text-[10px] text-indigo-400 ml-1.5 font-normal">
                        (Hesaplanan: {formatMoney(previewSummary.monthlyInstallment).formatted})
                      </span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder={`Banka taksiti (örn: ${previewSummary.monthlyInstallment})`}
                      value={formMonthlyInstallment}
                      onChange={e => setFormMonthlyInstallment(e.target.value)}
                      className="w-full bg-[#0a0f1d] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Başlangıç Tarihi</label>
                    <input
                      type="date"
                      required
                      value={formStartDate}
                      onChange={e => setFormStartDate(e.target.value)}
                      className="w-full bg-[#0a0f1d] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">İlk Taksit Vade Tarihi</label>
                    <input
                      type="date"
                      required
                      value={formFirstDueDate}
                      onChange={e => setFormFirstDueDate(e.target.value)}
                      className="w-full bg-[#0a0f1d] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                {/* Sigorta ve Net Yatan Tutar */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Sigorta Prim Tutarı (₺)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Örn: 8505.00"
                      value={formInsuranceAmount}
                      onChange={e => setFormInsuranceAmount(e.target.value)}
                      className="w-full bg-[#0a0f1d] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Hesaba Yatacak Net Tutar (₺)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Örn: 238607.50"
                      value={formNetDisbursed}
                      onChange={e => setFormNetDisbursed(e.target.value)}
                      className="w-full bg-[#0a0f1d] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* CANLI AMORTİSMAN ÖNİZLEME TABLOSU & TOPLAMLAR */}
              <div className="p-3.5 bg-[#0a0f1d] border border-indigo-500/30 rounded-xl space-y-2.5">
                <div className="flex flex-wrap items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-4">
                    <span>Toplam Geri Ödeme: <strong className="text-amber-300 text-sm">{formatMoney(previewSummary.totalPayment).formatted}</strong></span>
                    <span>Toplam Faiz: <strong className="text-rose-400">{formatMoney(previewSummary.totalInterest).formatted}</strong></span>
                    <span>Toplam BSMV: <strong className="text-sky-400">{formatMoney(previewSummary.totalTax).formatted}</strong></span>
                  </div>
                  <span className="text-[10px] text-indigo-400 font-sans font-bold">
                    ✓ Banka tablosuyla tam eşleşen kuruş hesabı
                  </span>
                </div>

                <div className="max-h-40 overflow-y-auto custom-scrollbar border border-slate-800 rounded-lg">
                  <table className="w-full text-[11px] font-mono text-left">
                    <thead className="bg-[#070b14] text-slate-400 sticky top-0">
                      <tr>
                        <th className="p-1.5 text-center w-10">No</th>
                        <th className="p-1.5">Vade</th>
                        <th className="p-1.5 text-right">Taksit</th>
                        <th className="p-1.5 text-right text-emerald-400">Anapara</th>
                        <th className="p-1.5 text-right text-rose-400">Net Faiz</th>
                        <th className="p-1.5 text-right text-sky-400">BSMV</th>
                        <th className="p-1.5 text-right text-slate-400">Kalan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {previewPlan.slice(0, 12).map(p => (
                        <tr key={p.installment_no} className="hover:bg-slate-800/30">
                          <td className="p-1.5 text-center text-slate-500">{p.installment_no}</td>
                          <td className="p-1.5 text-slate-300">{formatDateTR(p.due_date)}</td>
                          <td className="p-1.5 text-right text-amber-300 font-bold">{formatMoney(p.total_amount).formatted}</td>
                          <td className="p-1.5 text-right text-emerald-400">{formatMoney(p.principal_amount).formatted}</td>
                          <td className="p-1.5 text-right text-rose-400">{formatMoney(p.interest_amount).formatted}</td>
                          <td className="p-1.5 text-right text-sky-400">{formatMoney(p.tax_amount || 0).formatted}</td>
                          <td className="p-1.5 text-right text-slate-400">{formatMoney(p.remaining_principal_after).formatted}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* HALİHAZIRDA DEVAM EDEN KREDİLER İÇİN ÖZEL DEVİR ALANI */}
              {!editingLoanId && (
                <div className="p-3.5 bg-indigo-950/20 border border-indigo-500/30 rounded-xl space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="cb-existing"
                      checked={isExistingLoan}
                      onChange={e => setIsExistingLoan(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                    <label htmlFor="cb-existing" className="text-indigo-200 font-bold cursor-pointer">
                      Bu kredi daha önceden çekilmiş aktif bir kredidir (Geçmiş taksitleri var)
                    </label>
                  </div>

                  {isExistingLoan && (
                    <div className="pt-2 border-t border-indigo-500/20 flex items-center gap-4 animate-in fade-in">
                      <div className="flex-1">
                        <label className="block text-slate-300 font-semibold mb-1">Şu ana kadar kaç taksit ödendi?</label>
                        <input
                          type="number"
                          min="0"
                          max={formTotalInstallments}
                          value={formPrepaidCount}
                          onChange={e => setFormPrepaidCount(e.target.value)}
                          className="w-32 bg-[#070b14] border border-slate-700 rounded-xl px-3 py-1.5 text-white font-mono font-bold outline-none focus:border-indigo-500"
                        />
                      </div>
                      <p className="text-[11px] text-indigo-300/80 flex-1 leading-relaxed">
                        💡 İlk {formPrepaidCount} taksit otomatik olarak "Devir (Ödendi)" olarak işaretlenir. Bankadan mükerrer para düşmez ve kalan borç tam güncel başlar.
                      </p>
                    </div>
                  )}

                  {!isExistingLoan && (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="cb-disburse"
                        checked={formDisburseToBank}
                        onChange={e => setFormDisburseToBank(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                      <label htmlFor="cb-disburse" className="text-slate-300 cursor-pointer">
                        Kredi tutarını vadesiz banka hesabına <strong>para girişi (+)</strong> olarak kaydet
                      </label>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Notlar / Açıklama</label>
                <textarea
                  rows={2}
                  placeholder="Kredi ile ilgili özel notlar, poliçe numarası vb."
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="w-full bg-[#070b14] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsLoanModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition shadow-lg shadow-indigo-600/30 cursor-pointer active:scale-95"
                >
                  {editingLoanId ? 'Güncelle' : 'Krediyi Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* 2. TAKSİT ÖDEME MODALI */}
      {/* ============================================================================== */}
      {isPayModalOpen && payingLoan && payingInstallment && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-[#0d1322] border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#0a0f1d]">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-lg">
                  <CheckCircle size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Taksit Ödemesi Yap</h3>
                  <p className="text-[11px] text-slate-400">
                    {payingLoan.loan_name} • Taksit #{payingInstallment.installment_no} / {payingLoan.total_installments}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsPayModalOpen(false)} className="text-slate-400 hover:text-white transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="p-5 space-y-4 text-xs">
              <div className="p-3.5 bg-[#070b14] border border-slate-800 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Taksit Vadesi:</span>
                  <span className="font-mono font-bold text-slate-200">{formatDateTR(payingInstallment.due_date)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Toplam Ödenecek Tutar:</span>
                  <span className="font-mono text-sm font-black text-amber-400">{formatMoney(payingInstallment.total_amount).formatted}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] pt-1.5 border-t border-slate-800/80">
                  <span className="text-emerald-400">Anapara Payı (Borcu Düşürür):</span>
                  <span className="font-mono font-bold text-emerald-400">{formatMoney(payingInstallment.principal_amount).formatted}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-rose-400">Net Faiz (Gidere İşlenir):</span>
                  <span className="font-mono font-bold text-rose-400">{formatMoney(payingInstallment.interest_amount).formatted}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-sky-400">BSMV / Vergi (Gidere İşlenir):</span>
                  <span className="font-mono font-bold text-sky-400">{formatMoney(payingInstallment.tax_amount || 0).formatted}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Ödeme Tarihi *</label>
                <input
                  type="date"
                  required
                  value={payDate}
                  onChange={e => setPayDate(e.target.value)}
                  className="w-full bg-[#070b14] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Ödemenin Çıkacağı Banka Hesabı *</label>
                <select
                  required
                  value={payBankAccountId}
                  onChange={e => setPayBankAccountId(e.target.value)}
                  className="w-full bg-[#070b14] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500 cursor-pointer font-medium"
                >
                  <option value="">Hesap Seçiniz...</option>
                  {banks.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.bank_name} {b.account_name ? `(${b.account_name})` : ''} - Güncel Bakiye: {formatMoney(b.balance, b.currency).formatted}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tutar Teyidi / Düzeltmesi */}
              <div className="grid grid-cols-3 gap-2.5 pt-2">
                <div>
                  <label className="block text-slate-400 text-[10px] mb-1">Anapara</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={payPrincipalAmount}
                    onChange={e => {
                      const p = parseFloat(e.target.value) || 0
                      const i = parseFloat(payInterestAmount) || 0
                      const t = parseFloat(payTaxAmount) || 0
                      setPayPrincipalAmount(e.target.value)
                      setPayTotalAmount((p + i + t).toFixed(2))
                    }}
                    className="w-full bg-[#070b14] border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-mono outline-none focus:border-emerald-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[10px] mb-1">Net Faiz</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={payInterestAmount}
                    onChange={e => {
                      const i = parseFloat(e.target.value) || 0
                      const p = parseFloat(payPrincipalAmount) || 0
                      const t = parseFloat(payTaxAmount) || 0
                      setPayInterestAmount(e.target.value)
                      setPayTotalAmount((p + i + t).toFixed(2))
                    }}
                    className="w-full bg-[#070b14] border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-mono outline-none focus:border-emerald-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[10px] mb-1">BSMV</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={payTaxAmount}
                    onChange={e => {
                      const t = parseFloat(e.target.value) || 0
                      const p = parseFloat(payPrincipalAmount) || 0
                      const i = parseFloat(payInterestAmount) || 0
                      setPayTaxAmount(e.target.value)
                      setPayTotalAmount((p + i + t).toFixed(2))
                    }}
                    className="w-full bg-[#070b14] border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-mono outline-none focus:border-emerald-500 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPay}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold transition shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  {isSubmittingPay ? 'İşleniyor...' : 'Ödemeyi Kaydet & Bankadan Düş'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* 3. TAKSİT DÜZENLE MODALI */}
      {/* ============================================================================== */}
      {isEditInstallmentModalOpen && editingInstallment && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-[#0d1322] border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#0a0f1d]">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg">
                  <Edit3 size={16} />
                </div>
                <h3 className="font-bold text-sm text-white">
                  Taksit #{editingInstallment.installment_no} Tutarlarını Düzenle
                </h3>
              </div>
              <button onClick={() => setIsEditInstallmentModalOpen(false)} className="text-slate-400 hover:text-white transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveInstallmentEdit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Vade Tarihi</label>
                <input
                  type="date"
                  required
                  value={editInstDueDate}
                  onChange={e => setEditInstDueDate(e.target.value)}
                  className="w-full bg-[#070b14] border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Anapara Payı (₺)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editInstPrincipal}
                  onChange={e => {
                    const p = parseFloat(e.target.value) || 0
                    const i = parseFloat(editInstInterest) || 0
                    const t = parseFloat(editInstTax) || 0
                    setEditInstPrincipal(e.target.value)
                    setEditInstTotal((p + i + t).toFixed(2))
                  }}
                  className="w-full bg-[#070b14] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Net Faiz (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editInstInterest}
                    onChange={e => {
                      const i = parseFloat(e.target.value) || 0
                      const p = parseFloat(editInstPrincipal) || 0
                      const t = parseFloat(editInstTax) || 0
                      setEditInstInterest(e.target.value)
                      setEditInstTotal((p + i + t).toFixed(2))
                    }}
                    className="w-full bg-[#070b14] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">BSMV (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editInstTax}
                    onChange={e => {
                      const t = parseFloat(e.target.value) || 0
                      const p = parseFloat(editInstPrincipal) || 0
                      const i = parseFloat(editInstInterest) || 0
                      setEditInstTax(e.target.value)
                      setEditInstTotal((p + i + t).toFixed(2))
                    }}
                    className="w-full bg-[#070b14] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Toplam Taksit Tutarı (₺)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editInstTotal}
                  onChange={e => setEditInstTotal(e.target.value)}
                  className="w-full bg-[#070b14] border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-black text-amber-300 outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditInstallmentModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  Güncelle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* ONAY DİYALOG MODALI */}
      {/* ============================================================================== */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-[#0d1322] border border-slate-700 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <h3 className={`font-bold text-sm mb-2 ${confirmDialog.isDanger ? 'text-rose-400' : 'text-white'}`}>
              {confirmDialog.title}
            </h3>
            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                {confirmDialog.cancelText}
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold text-white transition shadow cursor-pointer ${
                  confirmDialog.isDanger ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30' : 'bg-indigo-600 hover:bg-indigo-500'
                }`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

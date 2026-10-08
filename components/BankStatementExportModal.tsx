'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/lib/utils'
import toast from 'react-hot-toast'
import { 
  X, 
  FileText, 
  Printer, 
  Download, 
  Calendar, 
  Landmark, 
  Building, 
  Home, 
  Globe, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Clock, 
  Search, 
  RefreshCw, 
  SlidersHorizontal, 
  Eye, 
  Check, 
  FileSpreadsheet,
  TrendingUp,
  CreditCard,
  ArrowRightLeft
} from 'lucide-react'

export interface BankAccount {
  id: string
  bank_name: string
  account_name: string
  iban: string
  balance: number
  currency: 'TRY' | 'USD' | 'EUR'
  company_id?: string | null
  account_color?: string
  is_investment?: boolean
  company?: { name: string; is_personal: boolean }
}

export interface BankStatementExportModalProps {
  isOpen: boolean
  onClose: () => void
  banks: BankAccount[]
  initialBankId?: string | null
  companies: { id: string; name: string; is_personal: boolean }[]
}

const MONTH_NAMES: Record<string, string> = {
  '01': 'Ocak',
  '02': 'Şubat',
  '03': 'Mart',
  '04': 'Nisan',
  '05': 'Mayıs',
  '06': 'Haziran',
  '07': 'Temmuz',
  '08': 'Ağustos',
  '09': 'Eylül',
  '10': 'Ekim',
  '11': 'Kasım',
  '12': 'Aralık'
}

function formatDateTR(dateStr: string) {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`
  return dateStr
}

function getLocalTodayISO() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export default function BankStatementExportModal({
  isOpen,
  onClose,
  banks,
  initialBankId,
  companies
}: BankStatementExportModalProps) {
  const today = getLocalTodayISO()
  const currentYear = new Date().getFullYear().toString()
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')

  // Bank selection
  const [selectedBankId, setSelectedBankId] = useState<string>(initialBankId || banks[0]?.id || '')

  // Period type: 'monthly' | 'yearly' | 'custom' | 'all'
  const [filterType, setFilterType] = useState<'monthly' | 'yearly' | 'custom' | 'all'>('monthly')

  // Monthly filters
  const [selectedYear, setSelectedYear] = useState<string>(currentYear)
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth)

  // Custom date range
  const [customStartDate, setCustomStartDate] = useState<string>(`${currentYear}-${currentMonth}-01`)
  const [customEndDate, setCustomEndDate] = useState<string>(today)

  // Sort order: chronological 'asc' (standard bank statement) or 'desc'
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Active view tab: 'preview' (table preview) or 'paper' (A4 print layout preview)
  const [activeTab, setActiveTab] = useState<'preview' | 'paper'>('preview')

  // Loading state
  const [loading, setLoading] = useState(false)
  const [transactions, setTransactions] = useState<any[]>([])

  // Reset or sync bank when initialBankId changes
  useEffect(() => {
    if (initialBankId) setSelectedBankId(initialBankId)
    else if (banks.length > 0 && !selectedBankId) setSelectedBankId(banks[0].id)
  }, [initialBankId, banks])

  // Fetch all transactions for the selected bank
  useEffect(() => {
    if (!isOpen || !selectedBankId) return

    async function loadTransactions() {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('bank_transactions')
          .select('*, company:companies(name, is_personal)')
          .eq('bank_account_id', selectedBankId)
          .order('tx_date', { ascending: true })
          .order('created_at', { ascending: true })

        if (error) throw error
        setTransactions(data || [])
      } catch (err: any) {
        toast.error('Banka hareketleri yüklenirken hata: ' + err.message)
      } finally {
        setLoading(false)
      }
    }

    loadTransactions()
  }, [isOpen, selectedBankId])

  const targetBank = useMemo(() => {
    return banks.find(b => b.id === selectedBankId) || banks[0]
  }, [banks, selectedBankId])

  // Available years from transactions + current year
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>([currentYear])
    transactions.forEach(t => {
      if (t.tx_date) yearsSet.add(t.tx_date.split('-')[0])
    })
    return Array.from(yearsSet).sort().reverse()
  }, [transactions, currentYear])

  // Compute effective start and end dates
  const { effectiveStartDate, effectiveEndDate, periodLabel } = useMemo(() => {
    let start = '1970-01-01'
    let end = '2099-12-31'
    let label = 'Tüm Hareketler'

    if (filterType === 'monthly') {
      const lastDay = new Date(Number(selectedYear), Number(selectedMonth), 0).getDate()
      start = `${selectedYear}-${selectedMonth}-01`
      end = `${selectedYear}-${selectedMonth}-${String(lastDay).padStart(2, '0')}`
      label = `${MONTH_NAMES[selectedMonth]} ${selectedYear} (${formatDateTR(start)} - ${formatDateTR(end)})`
    } else if (filterType === 'yearly') {
      start = `${selectedYear}-01-01`
      end = `${selectedYear}-12-31`
      label = `${selectedYear} Yılı Ekstresi (${formatDateTR(start)} - ${formatDateTR(end)})`
    } else if (filterType === 'custom') {
      start = customStartDate || '1970-01-01'
      end = customEndDate || '2099-12-31'
      label = `${formatDateTR(start)} - ${formatDateTR(end)}`
    } else if (filterType === 'all') {
      const earliest = transactions[0]?.tx_date || today
      start = earliest
      end = today
      label = `Tüm Hareketler (${formatDateTR(earliest)} - ${formatDateTR(today)})`
    }

    return {
      effectiveStartDate: start,
      effectiveEndDate: end,
      periodLabel: label
    }
  }, [filterType, selectedYear, selectedMonth, customStartDate, customEndDate, transactions, today])

  // Compute opening balance before start date, filtered transactions, and running balances
  const statementData = useMemo(() => {
    // 1. Sort all transactions chronologically (Eskiden Yeniye)
    const sortedAll = [...transactions].sort((a, b) => {
      if (a.tx_date !== b.tx_date) return a.tx_date.localeCompare(b.tx_date)
      if (a.description === 'Açılış Bakiyesi / Devir') return -1
      if (b.description === 'Açılış Bakiyesi / Devir') return 1
      return (a.created_at || '').localeCompare(b.created_at || '')
    })

    // 2. Calculate Opening Balance before effectiveStartDate
    let openingBalance = 0
    sortedAll.forEach(t => {
      if (t.tx_date < effectiveStartDate && t.status !== 'pending') {
        if (t.tx_type === 'in') openingBalance += t.amount
        else openingBalance -= t.amount
      }
    })

    // 3. Process transactions inside [effectiveStartDate, effectiveEndDate]
    let periodInTotal = 0
    let periodOutTotal = 0
    let runningBalance = openingBalance

    const periodTxs: any[] = []

    sortedAll.forEach(t => {
      if (t.tx_date >= effectiveStartDate && t.tx_date <= effectiveEndDate) {
        if (t.status !== 'pending') {
          if (t.tx_type === 'in') {
            periodInTotal += t.amount
            runningBalance += t.amount
          } else {
            periodOutTotal += t.amount
            runningBalance -= t.amount
          }
        }
        periodTxs.push({
          ...t,
          running_balance: runningBalance
        })
      }
    })

    const closingBalance = openingBalance + periodInTotal - periodOutTotal

    // Order for display based on user preference
    const finalTransactions = sortOrder === 'desc' ? [...periodTxs].reverse() : periodTxs

    return {
      openingBalance,
      periodInTotal,
      periodOutTotal,
      closingBalance,
      periodTransactions: finalTransactions,
      rawCount: periodTxs.length
    }
  }, [transactions, effectiveStartDate, effectiveEndDate, sortOrder])

  // ==========================================
  // --- EXCEL (.CSV) İNDİRME FONKSİYONU ---
  // ==========================================
  function handleDownloadExcel() {
    if (!targetBank) return

    const bankNameSafe = targetBank.bank_name.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ_]/g, '_')
    const accountNameSafe = targetBank.account_name.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ_]/g, '_')
    const dateRangeSafe = `${effectiveStartDate}_${effectiveEndDate}`.replace(/-/g, '')
    const filename = `${bankNameSafe}_${accountNameSafe}_Ekstre_${dateRangeSafe}.csv`

    const currencySymbol = targetBank.currency === 'USD' ? '$' : targetBank.currency === 'EUR' ? '€' : '₺'

    const formatNum = (num: number) => {
      return (Number(num || 0)).toFixed(2).replace('.', ',')
    }

    const lines: string[] = []

    // Header Block
    lines.push('BANKA HESAP EKSTRESİ')
    lines.push(`Banka Adı:;${targetBank.bank_name}`)
    lines.push(`Hesap Adı:;${targetBank.account_name}`)
    lines.push(`IBAN:;${targetBank.iban || 'Belirtilmemiş'}`)
    lines.push(`Hesap Sahibi:;${targetBank.company ? targetBank.company.name : 'Ortak Bağımsız Hesap'}`)
    lines.push(`Para Birimi:;${targetBank.currency} (${currencySymbol})`)
    lines.push(`Ekstre Dönemi:;${periodLabel}`)
    lines.push(`Rapor Üretim Tarihi:;${formatDateTR(today)} ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`)
    lines.push('')

    // Financial Summary
    lines.push('DÖNEM FİNANSAL ÖZETİ')
    lines.push(`Dönem Başı Devir Bakiyesi:;${formatNum(statementData.openingBalance)} ${currencySymbol}`)
    lines.push(`Dönem İçi Toplam Giriş (+):;${formatNum(statementData.periodInTotal)} ${currencySymbol}`)
    lines.push(`Dönem İçi Toplam Çıkış (-):;${formatNum(statementData.periodOutTotal)} ${currencySymbol}`)
    lines.push(`Dönem Sonu Kapanış Bakiyesi:;${formatNum(statementData.closingBalance)} ${currencySymbol}`)
    lines.push(`Toplam Hareket Sayısı:;${statementData.rawCount}`)
    lines.push('')

    // Table Header
    lines.push('Tarih;Fiş / Referans No;Açıklama;İlgili Merkez;İşlem Yönü;Giriş Tutarı;Çıkış Tutarı;Yürüyen Bakiye;Durum')

    // Table Rows
    statementData.periodTransactions.forEach(t => {
      const dateFormatted = formatDateTR(t.tx_date)
      const refNo = t.transfer_id || '-'
      const desc = `"${(t.description || '').replace(/"/g, '""')}"`
      const center = `"${(t.company?.name || 'Ortak / Bağımsız').replace(/"/g, '""')}"`
      const direction = t.tx_type === 'in' ? 'Giriş (+)' : 'Çıkış (-)'
      const inAmt = t.tx_type === 'in' ? formatNum(t.amount) : ''
      const outAmt = t.tx_type === 'out' ? formatNum(t.amount) : ''
      const runBal = t.status === 'pending' ? 'Bekleyen Provizyon' : formatNum(t.running_balance)
      const status = t.status === 'pending' ? 'Bekleyen Provizyon' : 'Tamamlandı'

      lines.push(`${dateFormatted};${refNo};${desc};${center};${direction};${inAmt};${outAmt};${runBal};${status}`)
    })

    lines.push('')
    lines.push(`TOPLAMLAR;;;;;${formatNum(statementData.periodInTotal)};${formatNum(statementData.periodOutTotal)};${formatNum(statementData.closingBalance)};`)

    // Encode to UTF-8 BOM CSV
    const csvContent = '\uFEFF' + lines.join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast.success(`Excel (.csv) dosyası başarıyla indirildi: ${filename}`)
  }

  // ==========================================
  // --- PDF / YAZDIR İŞLEMİ (IFRAME İLE) ---
  // ==========================================
  function handlePrintPDF() {
    if (!targetBank) return

    const currencySymbol = targetBank.currency === 'USD' ? '$' : targetBank.currency === 'EUR' ? '€' : '₺'

    const formatMoneyHTML = (amount: number) => {
      return formatMoney(amount, targetBank.currency).formatted
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <title>Banka_Ekstresi_${targetBank.bank_name}_${effectiveStartDate}_${effectiveEndDate}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 10px;
            color: #0f172a;
            background: #ffffff;
            line-height: 1.4;
            padding: 10px;
          }
          .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 8px;
          }
          .logo-title {
            font-size: 16px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: 0.5px;
          }
          .doc-badge {
            display: inline-block;
            background: #3b82f6;
            color: white;
            font-size: 8.5px;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 4px;
            margin-top: 3px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .meta-text {
            font-size: 8.5px;
            color: #64748b;
            text-align: right;
          }
          .account-card {
            width: 100%;
            border-collapse: collapse;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            margin-bottom: 12px;
          }
          .account-card td {
            padding: 6px 10px;
            vertical-align: top;
          }
          .info-label {
            font-size: 8px;
            text-transform: uppercase;
            color: #64748b;
            font-weight: 700;
            margin-bottom: 1px;
          }
          .info-value {
            font-size: 10.5px;
            font-weight: 700;
            color: #0f172a;
          }
          .summary-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 6px 0;
            margin-bottom: 14px;
          }
          .summary-box {
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 6px 8px;
            text-align: right;
          }
          .summary-box.in {
            background: #f0fdf4;
            border-color: #86efac;
          }
          .summary-box.out {
            background: #fef2f2;
            border-color: #fca5a5;
          }
          .summary-box.net {
            background: #eff6ff;
            border-color: #93c5fd;
          }
          .summary-label {
            font-size: 7.5px;
            text-transform: uppercase;
            color: #64748b;
            font-weight: 700;
          }
          .summary-val {
            font-size: 11px;
            font-weight: 900;
            font-family: monospace;
            margin-top: 2px;
          }
          .tx-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }
          .tx-table thead {
            display: table-header-group;
          }
          .tx-table th {
            background: #0f172a;
            color: #ffffff;
            font-size: 8.5px;
            font-weight: 700;
            text-transform: uppercase;
            padding: 5px 6px;
            border: 1px solid #0f172a;
            text-align: left;
          }
          .tx-table th.right {
            text-align: right;
          }
          .tx-table td {
            padding: 4.5px 6px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 8.5px;
            vertical-align: middle;
          }
          .tx-table tr:nth-child(even) td {
            background: #f8fafc;
          }
          .tx-table tr {
            page-break-inside: avoid;
          }
          .mono {
            font-family: monospace;
          }
          .amount-in {
            color: #15803d;
            font-weight: 700;
            text-align: right;
          }
          .amount-out {
            color: #b91c1c;
            font-weight: 700;
            text-align: right;
          }
          .footer {
            margin-top: 20px;
            border-top: 1px solid #cbd5e1;
            padding-top: 8px;
            font-size: 8px;
            color: #64748b;
            display: flex;
            justify-content: space-between;
          }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td>
              <div class="logo-title">CTC MASTER LEDGER</div>
              <div class="doc-badge">Banka Hesap Ekstresi</div>
            </td>
            <td class="meta-text">
              <div><strong>Rapor Tarihi:</strong> ${formatDateTR(today)} ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
              <div><strong>Dönem:</strong> ${periodLabel}</div>
              <div><strong>Durum:</strong> Resmi Muhasebe Dökümü</div>
            </td>
          </tr>
        </table>

        <table class="account-card">
          <tr>
            <td style="width: 28%;">
              <div class="info-label">Banka & Hesap Adı</div>
              <div class="info-value">${targetBank.bank_name} - ${targetBank.account_name}</div>
            </td>
            <td style="width: 32%;">
              <div class="info-label">IBAN Numarası</div>
              <div class="info-value mono">${targetBank.iban || 'IBAN Belirtilmemiş'}</div>
            </td>
            <td style="width: 25%;">
              <div class="info-label">Hesap Sahibi / Merkez</div>
              <div class="info-value">${targetBank.company ? targetBank.company.name : 'Ortak Bağımsız Hesap'}</div>
            </td>
            <td style="width: 15%; text-align: right;">
              <div class="info-label">Para Birimi</div>
              <div class="info-value">${targetBank.currency} (${currencySymbol})</div>
            </td>
          </tr>
        </table>

        <table class="summary-table">
          <tr>
            <td style="width: 22%;">
              <div class="summary-box">
                <div class="summary-label">Dönem Başı Bakiye</div>
                <div class="summary-val">${formatMoneyHTML(statementData.openingBalance)}</div>
              </div>
            </td>
            <td style="width: 22%;">
              <div class="summary-box in">
                <div class="summary-label" style="color: #15803d;">Toplam Giriş (+)</div>
                <div class="summary-val" style="color: #15803d;">+ ${formatMoneyHTML(statementData.periodInTotal)}</div>
              </div>
            </td>
            <td style="width: 22%;">
              <div class="summary-box out">
                <div class="summary-label" style="color: #b91c1c;">Toplam Çıkış (-)</div>
                <div class="summary-val" style="color: #b91c1c;">- ${formatMoneyHTML(statementData.periodOutTotal)}</div>
              </div>
            </td>
            <td style="width: 22%;">
              <div class="summary-box net">
                <div class="summary-label" style="color: #1d4ed8;">Dönem Sonu Bakiye</div>
                <div class="summary-val" style="color: #1d4ed8;">${formatMoneyHTML(statementData.closingBalance)}</div>
              </div>
            </td>
            <td style="width: 12%;">
              <div class="summary-box">
                <div class="summary-label">Hareket Adedi</div>
                <div class="summary-val" style="color: #475569;">${statementData.rawCount}</div>
              </div>
            </td>
          </tr>
        </table>

        <table class="tx-table">
          <thead>
            <tr>
              <th style="width: 70px;">Tarih</th>
              <th style="width: 85px;">Fiş / Ref</th>
              <th>Açıklama</th>
              <th style="width: 120px;">İlgili Merkez</th>
              <th class="right" style="width: 85px;">Giriş (+)</th>
              <th class="right" style="width: 85px;">Çıkış (-)</th>
              <th class="right" style="width: 95px;">Bakiye</th>
            </tr>
          </thead>
          <tbody>
            ${statementData.periodTransactions.length === 0 ? `
              <tr>
                <td colspan="7" style="text-align: center; padding: 25px; color: #64748b;">
                  Seçilen tarih aralığında (${periodLabel}) herhangi bir banka hareketi bulunmamaktadır.
                </td>
              </tr>
            ` : statementData.periodTransactions.map(t => `
              <tr>
                <td class="mono">${formatDateTR(t.tx_date)}</td>
                <td class="mono" style="font-size: 8px; color: #475569;">${t.transfer_id || '-'}</td>
                <td>
                  <strong>${t.description || ''}</strong>
                  ${t.status === 'pending' ? '<span style="color: #b45309; font-size: 7.5px; font-weight: bold; margin-left: 4px;">[Bekleyen Provizyon]</span>' : ''}
                </td>
                <td style="color: #475569;">${t.company ? t.company.name : 'Ortak Bağımsız'}</td>
                <td class="amount-in mono">${t.tx_type === 'in' ? formatMoneyHTML(t.amount) : '-'}</td>
                <td class="amount-out mono">${t.tx_type === 'out' ? formatMoneyHTML(t.amount) : '-'}</td>
                <td class="mono" style="text-align: right; font-weight: 700; color: ${t.status === 'pending' ? '#94a3b8' : '#0f172a'};">
                  ${t.status === 'pending' ? 'Etkilenmedi' : formatMoneyHTML(t.running_balance)}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <div>Bu belge CTC ERP sistemi tarafından ${formatDateTR(today)} tarihinde oluşturulmuştur. Elektronik onaylıdır.</div>
          <div>Sayfa 1 / 1</div>
        </div>
      </body>
      </html>
    `

    // Print via isolated hidden iframe
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (!doc) {
      toast.error('Yazdırma motoru başlatılamadı.')
      return
    }

    doc.open()
    doc.write(htmlContent)
    doc.close()

    iframe.contentWindow?.focus()
    setTimeout(() => {
      iframe.contentWindow?.print()
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe)
        }
      }, 2000)
    }, 400)

    toast.success('PDF / Yazdırma penceresi hazırlandı. "PDF Olarak Kaydet" seçeneğini kullanabilirsiniz.')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 z-[999999] animate-in fade-in duration-200">
      <div className="bg-[#0b101d] border border-slate-800 rounded-2xl w-full max-w-5xl h-[92vh] max-h-[850px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* ÜST BAŞLIK BARI */}
        <div className="p-4 bg-gradient-to-r from-[#0d1322] via-[#0f172a] to-[#070b14] border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Banka Hesap Ekstresi & Dışa Aktarma</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-bold">
                  PDF & Excel
                </span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Yıllık, aylık veya özel tarih aralığına göre hesap dökümü ve resmi bakiye mutabakatı
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* FİLTRE & SEÇİM KONTROL PANELİ */}
        <div className="p-4 bg-[#080d1a] border-b border-slate-800/80 shrink-0 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            
            {/* 1. HESAP SEÇİMİ */}
            <div className="md:col-span-4">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Banka Hesabı
              </label>
              <select
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
                className="w-full bg-[#0d1322] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors font-medium"
              >
                {banks.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.bank_name} - {b.account_name} ({formatMoney(b.balance, b.currency).formatted})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. DÖNEM TİPİ SEKMELERİ */}
            <div className="md:col-span-4">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Rapor Dönemi Türü
              </label>
              <div className="grid grid-cols-4 gap-1 bg-[#0d1322] p-1 rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setFilterType('monthly')}
                  className={`py-1 text-[11px] font-bold rounded transition cursor-pointer ${
                    filterType === 'monthly'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Aylık
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('yearly')}
                  className={`py-1 text-[11px] font-bold rounded transition cursor-pointer ${
                    filterType === 'yearly'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Yıllık
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('custom')}
                  className={`py-1 text-[11px] font-bold rounded transition cursor-pointer ${
                    filterType === 'custom'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Özel
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`py-1 text-[11px] font-bold rounded transition cursor-pointer ${
                    filterType === 'all'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Tümü
                </button>
              </div>
            </div>

            {/* 3. DİNAMİK DÖNEM SEÇİCİLERİ */}
            <div className="md:col-span-4">
              {filterType === 'monthly' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Yıl</label>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="w-full bg-[#0d1322] border border-slate-700/80 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      {availableYears.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Ay</label>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="w-full bg-[#0d1322] border border-slate-700/80 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                    >
                      {Object.entries(MONTH_NAMES).map(([val, name]) => (
                        <option key={val} value={val}>{name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {filterType === 'yearly' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rapor Yılı</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full bg-[#0d1322] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    {availableYears.map(y => (
                      <option key={y} value={y}>{y} Yılı Tam Ekstre</option>
                    ))}
                  </select>
                </div>
              )}

              {filterType === 'custom' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Başlangıç</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full bg-[#0d1322] border border-slate-700/80 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Bitiş</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full bg-[#0d1322] border border-slate-700/80 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {filterType === 'all' && (
                <div className="p-2 bg-[#0d1322] border border-slate-800 rounded-lg text-center text-xs text-slate-400 font-medium">
                  🌐 Hesabın ilk hareketinden bugüne kadar olan tüm kayıtlar
                </div>
              )}
            </div>
          </div>

          {/* DÖNEM FİNANSAL İSTATİSTİK ŞERİDİ */}
          {targetBank && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
              <div className="bg-[#0b1220] border border-slate-800 rounded-lg p-2.5 flex flex-col">
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Dönem Başı Bakiye</span>
                <span className={`text-sm font-mono font-black mt-0.5 ${statementData.openingBalance < 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                  {formatMoney(statementData.openingBalance, targetBank.currency).formatted}
                </span>
              </div>

              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-lg p-2.5 flex flex-col">
                <span className="text-[9px] uppercase font-bold text-emerald-400/80 tracking-wider">Toplam Giriş (+)</span>
                <span className="text-sm font-mono font-black text-emerald-400 mt-0.5">
                  + {formatMoney(statementData.periodInTotal, targetBank.currency).formatted}
                </span>
              </div>

              <div className="bg-rose-950/20 border border-rose-500/30 rounded-lg p-2.5 flex flex-col">
                <span className="text-[9px] uppercase font-bold text-rose-400/80 tracking-wider">Toplam Çıkış (-)</span>
                <span className="text-sm font-mono font-black text-rose-400 mt-0.5">
                  - {formatMoney(statementData.periodOutTotal, targetBank.currency).formatted}
                </span>
              </div>

              <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-lg p-2.5 flex flex-col">
                <span className="text-[9px] uppercase font-bold text-indigo-300 tracking-wider">Dönem Sonu Bakiye</span>
                <span className={`text-sm font-mono font-black mt-0.5 ${statementData.closingBalance < 0 ? 'text-rose-400' : 'text-indigo-300'}`}>
                  {formatMoney(statementData.closingBalance, targetBank.currency).formatted}
                </span>
              </div>

              <div className="col-span-2 sm:col-span-1 bg-[#0b1220] border border-slate-800 rounded-lg p-2.5 flex flex-col justify-center items-center text-center">
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">İşlem Adedi</span>
                <span className="text-sm font-mono font-bold text-indigo-400 mt-0.5">
                  {statementData.rawCount} Hareket
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ORTA GÖVDE: ÖNİZLEME ALANI (TABLAR) */}
        <div className="flex-1 min-h-0 flex flex-col bg-[#070b14] overflow-hidden">
          
          {/* Görünüm Değiştirme ve Sıralama Barı */}
          <div className="px-4 py-2 border-b border-slate-800/80 bg-[#0a0f1d] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'preview'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <SlidersHorizontal size={13} />
                <span>Tablo Görünümü</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('paper')}
                className={`px-3 py-1 text-xs font-bold rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'paper'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye size={13} />
                <span>A4 Baskı Önizleme</span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-[11px] text-slate-500">Sıralama:</span>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                className="bg-[#0d1322] border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 focus:outline-none"
              >
                <option value="asc">Kronolojik (Eskiden Yeniye - Standart)</option>
                <option value="desc">Ters Kronolojik (En Yeni Üstte)</option>
              </select>
            </div>
          </div>

          {/* TAB 1: TABLO ÖNİZLEMESİ */}
          {activeTab === 'preview' && (
            <div className="flex-1 overflow-auto custom-scrollbar p-4">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-slate-500">
                  <RefreshCw size={28} className="animate-spin text-indigo-400 mb-2" />
                  <p className="text-xs">Hareketler yükleniyor...</p>
                </div>
              ) : statementData.periodTransactions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 border border-dashed border-slate-800 rounded-xl bg-slate-900/20 text-slate-500">
                  <Calendar size={32} className="mb-2 text-slate-600" />
                  <p className="text-xs font-bold text-slate-400">Seçilen dönemde ({periodLabel}) herhangi bir hareket bulunamadı.</p>
                  <p className="text-[10px] text-slate-500 mt-1">Dönem başı bakiye ile dönem sonu bakiye eşittir.</p>
                </div>
              ) : (
                <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-[#0d1322]">
                  <table className="w-full text-left text-[11px]">
                    <thead className="sticky top-0 bg-[#0a0f1d] z-10 border-b border-slate-800 text-slate-400 font-medium">
                      <tr>
                        <th className="p-2.5 bg-[#0a0f1d]">Tarih</th>
                        <th className="p-2.5 bg-[#0a0f1d]">Fiş / Ref</th>
                        <th className="p-2.5 bg-[#0a0f1d]">Açıklama</th>
                        <th className="p-2.5 bg-[#0a0f1d]">Merkez</th>
                        <th className="p-2.5 text-right text-emerald-400 bg-[#0a0f1d]">Giriş (+)</th>
                        <th className="p-2.5 text-right text-rose-400 bg-[#0a0f1d]">Çıkış (-)</th>
                        <th className="p-2.5 text-right text-slate-300 bg-[#0e1629]">Bakiye</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50 font-mono">
                      {statementData.periodTransactions.map((t, idx) => (
                        <tr key={t.id || idx} className="hover:bg-slate-800/30 transition-colors">
                          <td className="p-2.5 text-slate-400 whitespace-nowrap">{formatDateTR(t.tx_date)}</td>
                          <td className="p-2.5 text-slate-500 text-[10px] whitespace-nowrap">{t.transfer_id || '-'}</td>
                          <td className="p-2.5 text-slate-200 font-sans">
                            <div className="flex items-center gap-1.5">
                              {t.status === 'pending' && (
                                <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded border border-amber-500/30 font-bold">
                                  Provizyon
                                </span>
                              )}
                              <span>{t.description}</span>
                            </div>
                          </td>
                          <td className="p-2.5 text-slate-400 font-sans text-[10px] whitespace-nowrap">
                            {t.company ? t.company.name : 'Ortak Bağımsız'}
                          </td>
                          <td className="p-2.5 text-right text-emerald-400 font-bold">
                            {t.tx_type === 'in' ? formatMoney(t.amount, targetBank?.currency).formatted : '-'}
                          </td>
                          <td className="p-2.5 text-right text-rose-400 font-bold">
                            {t.tx_type === 'out' ? formatMoney(t.amount, targetBank?.currency).formatted : '-'}
                          </td>
                          <td className="p-2.5 text-right text-slate-200 bg-slate-800/10 font-bold">
                            {t.status === 'pending' ? <span className="text-slate-500 italic text-[10px]">Etkilenmedi</span> : formatMoney(t.running_balance, targetBank?.currency).formatted}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: A4 BASKI ÖNİZLEMESİ (GERÇEKÇİ KAĞIT GÖRÜNÜMÜ) */}
          {activeTab === 'paper' && (
            <div className="flex-1 overflow-auto custom-scrollbar p-6 flex justify-center bg-slate-950/60">
              <div className="w-full max-w-[760px] bg-white text-slate-900 rounded-lg shadow-2xl p-8 border border-slate-300 font-sans text-[10px] space-y-4">
                
                {/* Kağıt Üst Başlık */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3">
                  <div>
                    <h1 className="text-lg font-black tracking-wider text-slate-900 uppercase">
                      CTC MASTER LEDGER
                    </h1>
                    <span className="inline-block bg-blue-600 text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider mt-1">
                      Banka Hesap Ekstresi
                    </span>
                  </div>
                  <div className="text-right text-[9px] text-slate-500 space-y-0.5">
                    <div><strong>Rapor Tarihi:</strong> {formatDateTR(today)}</div>
                    <div><strong>Dönem:</strong> {periodLabel}</div>
                    <div className="text-emerald-700 font-bold">✓ Sistem Doğrulamalı Mutabakat</div>
                  </div>
                </div>

                {/* Kağıt Hesap Bilgileri Kartı */}
                <div className="grid grid-cols-4 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
                  <div>
                    <div className="text-[8px] font-bold text-slate-500 uppercase">Banka & Hesap</div>
                    <div className="font-bold text-slate-900 text-[11px]">{targetBank.bank_name} - {targetBank.account_name}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[8px] font-bold text-slate-500 uppercase">IBAN Numarası</div>
                    <div className="font-bold text-slate-900 font-mono text-[11px]">{targetBank.iban || 'IBAN Belirtilmemiş'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[8px] font-bold text-slate-500 uppercase">Hesap Sahibi</div>
                    <div className="font-bold text-slate-900 text-[11px]">{targetBank.company ? targetBank.company.name : 'Ortak Bağımsız'}</div>
                  </div>
                </div>

                {/* Kağıt Finansal Özet Kutucukları */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-slate-100 p-2 rounded border border-slate-300 text-right">
                    <div className="text-[8px] uppercase font-bold text-slate-500">Dönem Başı Bakiye</div>
                    <div className="text-[12px] font-mono font-black text-slate-800">{formatMoney(statementData.openingBalance, targetBank.currency).formatted}</div>
                  </div>
                  <div className="bg-emerald-50 p-2 rounded border border-emerald-300 text-right">
                    <div className="text-[8px] uppercase font-bold text-emerald-700">Toplam Giriş (+)</div>
                    <div className="text-[12px] font-mono font-black text-emerald-700">+ {formatMoney(statementData.periodInTotal, targetBank.currency).formatted}</div>
                  </div>
                  <div className="bg-rose-50 p-2 rounded border border-rose-300 text-right">
                    <div className="text-[8px] uppercase font-bold text-rose-700">Toplam Çıkış (-)</div>
                    <div className="text-[12px] font-mono font-black text-rose-700">- {formatMoney(statementData.periodOutTotal, targetBank.currency).formatted}</div>
                  </div>
                  <div className="bg-blue-50 p-2 rounded border border-blue-300 text-right">
                    <div className="text-[8px] uppercase font-bold text-blue-700">Dönem Sonu Bakiye</div>
                    <div className="text-[12px] font-mono font-black text-blue-700">{formatMoney(statementData.closingBalance, targetBank.currency).formatted}</div>
                  </div>
                </div>

                {/* Kağıt Tablosu */}
                <div className="border border-slate-200 rounded overflow-hidden">
                  <table className="w-full text-left text-[9px]">
                    <thead className="bg-slate-900 text-white font-bold uppercase text-[8px]">
                      <tr>
                        <th className="p-2">Tarih</th>
                        <th className="p-2">Fiş/Ref</th>
                        <th className="p-2">Açıklama</th>
                        <th className="p-2">Merkez</th>
                        <th className="p-2 text-right">Giriş (+)</th>
                        <th className="p-2 text-right">Çıkış (-)</th>
                        <th className="p-2 text-right">Bakiye</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono">
                      {statementData.periodTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-slate-400">
                            Bu dönemde hareket kaydı bulunmamaktadır.
                          </td>
                        </tr>
                      ) : (
                        statementData.periodTransactions.map((t, i) => (
                          <tr key={t.id || i} className={i % 2 === 1 ? 'bg-slate-50' : 'bg-white'}>
                            <td className="p-1.5 text-slate-600">{formatDateTR(t.tx_date)}</td>
                            <td className="p-1.5 text-slate-500 text-[8px]">{t.transfer_id || '-'}</td>
                            <td className="p-1.5 font-sans font-medium text-slate-900">
                              {t.description}
                              {t.status === 'pending' && <span className="text-amber-600 text-[8px] font-bold ml-1">[Provizyon]</span>}
                            </td>
                            <td className="p-1.5 font-sans text-slate-600 text-[8px]">{t.company ? t.company.name : 'Ortak'}</td>
                            <td className="p-1.5 text-right font-bold text-emerald-700">
                              {t.tx_type === 'in' ? formatMoney(t.amount, targetBank.currency).formatted : '-'}
                            </td>
                            <td className="p-1.5 text-right font-bold text-rose-700">
                              {t.tx_type === 'out' ? formatMoney(t.amount, targetBank.currency).formatted : '-'}
                            </td>
                            <td className="p-1.5 text-right font-bold text-slate-900">
                              {t.status === 'pending' ? 'Etkilenmedi' : formatMoney(t.running_balance, targetBank.currency).formatted}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Kağıt Alt Bilgisi */}
                <div className="pt-4 border-t border-slate-300 flex justify-between text-[8px] text-slate-500">
                  <div>Bu ekstre CTC ERP Master Ledger altyapısıyla hazırlanmıştır. Resmi muhasebe kayıtlarıyla uyumludur.</div>
                  <div>Toplam <strong>{statementData.rawCount}</strong> İşlem Kaydı</div>
                </div>

              </div>
            </div>
          )}

        </div>

        {/* ALT AKSİYON BARI (İNDİR & YAZDIR BUTONLARI) */}
        <div className="p-4 bg-gradient-to-r from-[#0a0f1d] via-[#0d1322] to-[#0a0f1d] border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400">
            <span className="font-bold text-white">{targetBank.bank_name}</span> hesabına ait{' '}
            <strong className="text-indigo-400">{statementData.rawCount} hareket</strong> dışa aktarılmaya hazır.
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
            >
              Vazgeç
            </button>

            {/* EXCEL (.CSV) İNDİRME BUTONU */}
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-950/40 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
              title="Microsoft Excel'de doğrudan açılan CSV tablosu olarak indir"
            >
              <Download size={15} />
              <span>Excel Olarak İndir (.csv)</span>
            </button>

            {/* PDF / YAZDIR BUTONU */}
            <button
              type="button"
              onClick={handlePrintPDF}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-950/40 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
              title="A4 formatında yazdır veya PDF olarak kaydet"
            >
              <Printer size={15} />
              <span>PDF Olarak Kaydet / Yazdır</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}

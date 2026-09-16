'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/lib/utils'
import toast, { Toaster } from 'react-hot-toast'
import { Printer, Calendar, Filter, Wallet, Landmark, CreditCard, Activity } from 'lucide-react'

type Company = { id: string; name: string; is_personal: boolean }

export default function AdvancedReportsPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompany, setSelectedCompany] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<'thisMonth' | 'lastMonth' | 'thisYear' | 'all'>('thisMonth')
  
  // Veritabanı State'leri
  const [customerTxs, setCustomerTxs] = useState<any[]>([])
  const [supplierTxs, setSupplierTxs] = useState<any[]>([])
  const [expenseTxs, setExpenseTxs] = useState<any[]>([])
  const [stockTxs, setStockTxs] = useState<any[]>([])
  
  const [banks, setBanks] = useState<any[]>([])
  const [cashes, setCashes] = useState<any[]>([])
  const [cards, setCards] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [stocks, setStocks] = useState<any[]>([])

  const [rates, setRates] = useState<{ USD: number; EUR: number }>({ USD: 34.25, EUR: 37.80 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchExchangeRates()
    fetchData()
  }, [])

  async function fetchExchangeRates() {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' })
      const data = await res.json()
      if (data && data.rates) {
        setRates({ USD: Number(data.rates.TRY.toFixed(4)), EUR: Number((data.rates.TRY / data.rates.EUR).toFixed(4)) })
      }
    } catch (err) { console.error(err) }
  }

  async function fetchData() {
    setLoading(true)
    try {
      const { data: comp } = await supabase.from('companies').select('*').order('name')
      setCompanies(comp || [])

      const { data: cTxs } = await supabase.from('customer_transactions').select('tx_date, tx_type, amount, exchange_rate, company_id, payment_source_type, payment_source_id')
      setCustomerTxs(cTxs || [])

      const { data: sTxs } = await supabase.from('supplier_transactions').select('tx_date, tx_type, amount, exchange_rate, company_id, payment_source_type, payment_source_id')
      setSupplierTxs(sTxs || [])

      const { data: exps } = await supabase.from('expense_transactions').select('tx_date, date, amount, exchange_rate, company_id, payment_source_type, payment_source_id, created_at')
      setExpenseTxs(exps || [])

      const { data: stTxs } = await supabase.from('stock_transactions').select('tx_date, tx_type, quantity, unit_price, currency, company_id, stock_id')
      setStockTxs(stTxs || [])

      const { data: bData } = await supabase.from('bank_accounts').select('id, bank_name, balance, currency, company_id')
      setBanks(bData || [])

      const { data: cData } = await supabase.from('cash_registers').select('id, name, balance, currency, company_id')
      setCashes(cData || [])

      const { data: cdData } = await supabase.from('credit_cards').select('id, name, current_debt, company_id')
      setCards(cdData || [])

      const { data: wData } = await supabase.from('warehouses').select('id, name, company_id')
      setWarehouses(wData || [])

      const { data: stkData } = await supabase.from('stocks').select('id, quantity, unit_price, currency, warehouse_id')
      setStocks(stkData || [])

    } catch (err) {
      toast.error('Veriler alınırken hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  const getTryEquivalent = (amount: number, curr: string) => {
    return amount * (curr === 'USD' ? rates.USD : curr === 'EUR' ? rates.EUR : 1)
  }

  const isMatchCompany = (compId: string | null) => {
    if (selectedCompany === 'all') return true
    if (selectedCompany === 'common') return compId === null
    return compId === selectedCompany
  }

  const getDates = () => {
    const now = new Date()
    if (dateFilter === 'thisMonth') {
       return { start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, end: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31` }
    }
    if (dateFilter === 'lastMonth') {
       const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
       return { start: `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, '0')}-01`, end: `${lm.getFullYear()}-${String(lm.getMonth() + 1).padStart(2, '0')}-31` }
    }
    if (dateFilter === 'thisYear') {
       return { start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` }
    }
    return { start: '1900-01-01', end: '2100-12-31' }
  }

  const { start, end } = getDates()

  // 1, 2, 3: İlgili Dönem Kaynak Kullanım Dağılımları
  const getSourceDistribution = (transactions: any[], dateField: string, typeFilter: string | null = null) => {
    let cash = 0, bank = 0, card = 0
    transactions.forEach(t => {
      const d = t[dateField] || t.date || t.created_at?.substring(0,10)
      if (isMatchCompany(t.company_id) && d >= start && d <= end && (!typeFilter || t.tx_type === typeFilter)) {
        const val = t.amount * (t.exchange_rate || 1)
        if (t.payment_source_type === 'cash') cash += val
        if (t.payment_source_type === 'bank') bank += val
        if (t.payment_source_type === 'card') card += val
      }
    })
    const total = cash + bank + card
    return { cash, bank, card, total }
  }

  const expSources = getSourceDistribution(expenseTxs, 'tx_date')
  const suppSources = getSourceDistribution(supplierTxs, 'tx_date', 'payment')
  const custSources = getSourceDistribution(customerTxs, 'tx_date', 'payment')

  // =====================================================================
  // --- MUTLAK GERİYE DÖNÜK HESAPLAMA MOTORU (DÖNEM BAŞI BAKİYESİ) ---
  // =====================================================================

  // 4. Kredi Kartları Dönem Analizi
  const cardAnalysis = cards.filter(c => isMatchCompany(c.company_id)).map(c => {
    let pInc = 0, pDec = 0, fInc = 0, fDec = 0;
    
    supplierTxs.filter(t => t.payment_source_type === 'card' && t.payment_source_id === c.id && isMatchCompany(t.company_id) && t.tx_type === 'payment').forEach(t => {
        const val = t.amount * (t.exchange_rate || 1)
        if (t.tx_date > end) fInc += val // Gelecek (Sonraki Dönem)
        else if (t.tx_date >= start) pInc += val // Dönem İçi Harcama (Gider Çıkışı)
    })
    
    expenseTxs.filter(t => t.payment_source_type === 'card' && t.payment_source_id === c.id && isMatchCompany(t.company_id)).forEach(t => {
        const val = t.amount * (t.exchange_rate || 1)
        const d = t.tx_date || t.date || t.created_at?.substring(0,10)
        if (d > end) fInc += val // Gelecek
        else if (d >= start) pInc += val // Dönem İçi Harcama
    })
    
    customerTxs.filter(t => t.payment_source_type === 'card' && t.payment_source_id === c.id && isMatchCompany(t.company_id) && t.tx_type === 'payment').forEach(t => {
        const val = t.amount * (t.exchange_rate || 1)
        if (t.tx_date > end) fDec += val // Gelecek
        else if (t.tx_date >= start) pDec += val // Dönem İçi Kredi Kartı Ödemesi (Borç Kapanışı)
    })

    const closing = c.current_debt - fInc + fDec // Tüm geleceği sil, dönem sonunu bul
    const opening = closing - pInc + pDec // Dönem içini de sil, dönem başını bul
    return { ...c, opening, increase: pInc, decrease: pDec, closing }
  }).filter(c => c.opening > 0 || c.increase > 0 || c.decrease > 0 || c.closing > 0)

  // 5. Bankalar Dönem Analizi
  const bankAnalysis = banks.filter(b => isMatchCompany(b.company_id)).map(b => {
    let pIn = 0, pOut = 0, fIn = 0, fOut = 0;

    customerTxs.filter(t => t.payment_source_type === 'bank' && t.payment_source_id === b.id && isMatchCompany(t.company_id) && t.tx_type === 'payment').forEach(t => {
        const val = t.amount * (t.exchange_rate || 1)
        if (t.tx_date > end) fIn += val
        else if (t.tx_date >= start) pIn += val
    })

    supplierTxs.filter(t => t.payment_source_type === 'bank' && t.payment_source_id === b.id && isMatchCompany(t.company_id) && t.tx_type === 'payment').forEach(t => {
        const val = t.amount * (t.exchange_rate || 1)
        if (t.tx_date > end) fOut += val
        else if (t.tx_date >= start) pOut += val
    })

    expenseTxs.filter(t => t.payment_source_type === 'bank' && t.payment_source_id === b.id && isMatchCompany(t.company_id)).forEach(t => {
        const val = t.amount * (t.exchange_rate || 1)
        const d = t.tx_date || t.date || t.created_at?.substring(0,10)
        if (d > end) fOut += val
        else if (d >= start) pOut += val
    })

    const cBal = getTryEquivalent(b.balance, b.currency)
    const closing = cBal - fIn + fOut
    const opening = closing - pIn + pOut
    return { ...b, opening, in: pIn, out: pOut, closing }
  }).filter(b => b.opening !== 0 || b.in !== 0 || b.out !== 0 || b.closing !== 0)

  // 6. Depolar Dönem Analizi
  const stockWhMap: Record<string, string> = {}
  stocks.forEach(s => { stockWhMap[s.id] = s.warehouse_id })

  const whAnalysis = warehouses.filter(w => isMatchCompany(w.company_id)).map(w => {
    let pIn = 0, pOut = 0, fIn = 0, fOut = 0;

    stockTxs.filter(t => stockWhMap[t.stock_id] === w.id && isMatchCompany(t.company_id)).forEach(t => {
        const val = getTryEquivalent(t.quantity * t.unit_price, t.currency)
        if (t.tx_date > end) {
            if (t.tx_type === 'in') fIn += val
            if (t.tx_type === 'out') fOut += val
        } else if (t.tx_date >= start) {
            if (t.tx_type === 'in') pIn += val
            if (t.tx_type === 'out') pOut += val
        }
    })

    const cVal = stocks.filter(s => s.warehouse_id === w.id).reduce((acc, s) => acc + getTryEquivalent(s.quantity * s.unit_price, s.currency), 0)
    const closing = cVal - fIn + fOut
    const opening = closing - pIn + pOut
    return { ...w, opening, in: pIn, out: pOut, closing }
  }).filter(w => w.opening !== 0 || w.in !== 0 || w.out !== 0 || w.closing !== 0)

  const handlePrint = () => { window.print() }

  const DistributionCard = ({ title, data, delay }: { title: string, data: any, delay: string }) => {
    const cashPct = data.total > 0 ? (data.cash / data.total) * 100 : 0
    const bankPct = data.total > 0 ? (data.bank / data.total) * 100 : 0
    const cardPct = data.total > 0 ? (data.card / data.total) * 100 : 0

    return (
      <div style={{ animation: `fadeInUp 0.4s both ${delay}` }} className="bg-[#070b14] border border-slate-800 rounded-xl p-3 print-force-transparent flex flex-col hover:border-slate-600 transition-colors group">
        <h3 className="text-[10px] font-bold text-slate-300 print-text-black uppercase tracking-widest mb-2 group-hover:text-indigo-400 transition-colors">{title}</h3>
        <div className="flex h-2 rounded-full overflow-hidden mb-3 bg-slate-800 print:bg-gray-200 print-color-adjust">
          <div style={{ width: `${cashPct}%`, transition: 'width 1s ease-out' }} className="bg-emerald-500 print-color-adjust" />
          <div style={{ width: `${bankPct}%`, transition: 'width 1s ease-out' }} className="bg-blue-500 print-color-adjust" />
          <div style={{ width: `${cardPct}%`, transition: 'width 1s ease-out' }} className="bg-purple-500 print-color-adjust" />
        </div>
        <div className="space-y-1.5 text-[9px] font-mono flex-1">
          <div className="flex justify-between items-center"><span className="flex items-center gap-1 text-slate-400 print:text-slate-600 font-sans"><Wallet size={10} className="text-emerald-500"/> Nakit Kasalar</span><span className="text-emerald-400 font-bold print:text-emerald-700">{formatMoney(data.cash, 'TRY').formatted}</span></div>
          <div className="flex justify-between items-center"><span className="flex items-center gap-1 text-slate-400 print:text-slate-600 font-sans"><Landmark size={10} className="text-blue-500"/> Banka Transferi</span><span className="text-blue-400 font-bold print:text-blue-700">{formatMoney(data.bank, 'TRY').formatted}</span></div>
          <div className="flex justify-between items-center"><span className="flex items-center gap-1 text-slate-400 print:text-slate-600 font-sans"><CreditCard size={10} className="text-purple-500"/> Kredi Kartları</span><span className="text-purple-400 font-bold print:text-purple-700">{formatMoney(data.card, 'TRY').formatted}</span></div>
        </div>
        <div className="border-t border-slate-800/50 mt-2 pt-1.5 flex justify-between items-center print-border-t">
          <span className="text-[9px] text-slate-500 print-text-black font-bold uppercase">Toplam Kaynak Hacmi</span>
          <span className="text-[11px] font-black text-white print-text-black font-mono">{formatMoney(data.total, 'TRY').formatted}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] relative">
      <Toaster position="top-right" toastOptions={{ style: { background: '#0f172a', color: '#fff', border: '1px solid #1e293b', fontSize: '12px', zIndex: 99999 } }} />
      
      {/* SIFIR SİYAH - KUSURSUZ BASKI CSS AYARLARI */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body { background: white !important; }
          
          /* Sistemdeki tüm navigasyonları, barları ve döviz modüllerini gizle */
          body * { visibility: hidden; }
          
          /* Sadece Rapor alanını görünür yap ve ekranın sol üstüne yapıştır */
          #printable-report, #printable-report * { visibility: visible; }
          #printable-report { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 100% !important; 
            background: white !important; 
            border: none !important; 
            padding: 0 !important; 
            margin: 0 !important; 
            box-shadow: none !important; 
          }
          
          /* Siyah arka planları ve çerçeveleri sıfırla */
          .print-force-transparent { background: transparent !important; border: none !important; box-shadow: none !important; }
          .print-text-black { color: #000 !important; }
          .print-border-t { border-top: 1px solid #ccc !important; }
          
          /* Tablo stillerini beyaz kağıda uyarla */
          table { border-collapse: collapse !important; width: 100% !important; border: none !important; }
          th { background: transparent !important; color: #000 !important; border-bottom: 2px solid #000 !important; padding: 4px !important; }
          td { background: transparent !important; color: #000 !important; border-bottom: 1px solid #ddd !important; padding: 4px !important; }
          
          /* Grafikleri (Progress Bar) renkli basmak için zorla */
          .print-color-adjust { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
          
          /* Kaydırma çubuklarını gizle */
          ::-webkit-scrollbar { display: none; }
        }
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
      `}} />

      {/* ÜST KONTROL BAR (Bu alan yazdırmada CSS ile tamamen gizlenecektir) */}
      <div style={{ animation: 'fadeInDown 0.4s both' }} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0d1322] border border-slate-800/80 p-4 rounded-xl shadow-md shrink-0 mb-4 transition-colors">
        <div className="flex items-center gap-3 text-white">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg"><Activity size={24} /></div>
          <div><h2 className="font-bold text-lg leading-none">Dönemsel Hareket Raporu</h2><p className="text-[10px] text-slate-400 mt-1">Kaynak dağılım grafikleri ve durum analizleri</p></div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-[#070b14] border border-slate-700 px-3 py-1.5 rounded-lg hover:border-indigo-500/50 transition-colors">
            <Filter size={13} className="text-indigo-400" />
            <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)} className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer">
              <option value="all" className="bg-[#0f172a]">🌍 Tüm Şirketler / Merkezler</option>
              <option value="common" className="bg-[#0f172a]">🌐 Ortak / Bağımsız İşlemler</option>
              {companies.map(c => <option key={c.id} value={c.id} className="bg-[#0f172a]">{c.name}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-[#070b14] border border-slate-700 px-3 py-1.5 rounded-lg hover:border-indigo-500/50 transition-colors">
            <Calendar size={13} className="text-indigo-400" />
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as any)} className="bg-transparent text-white text-xs font-bold focus:outline-none cursor-pointer">
              <option value="thisMonth" className="bg-[#0f172a]">Bu Ay</option>
              <option value="lastMonth" className="bg-[#0f172a]">Geçen Ay</option>
              <option value="thisYear" className="bg-[#0f172a]">Bu Yıl</option>
              <option value="all" className="bg-[#0f172a]">Tüm Zamanlar</option>
            </select>
          </div>

          <button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-indigo-900/20">
            <Printer size={15} /><span>Raporu Yazdır</span>
          </button>
        </div>
      </div>

      {/* RAPOR GÖVDESİ (PDF Çıktısı Sadece Burayı Alır) */}
      <div id="printable-report" style={{ animation: 'fadeInUp 0.4s both 0.1s' }} className="flex-1 bg-[#0d1322] border border-slate-800/80 rounded-xl p-6 overflow-y-auto custom-scrollbar shadow-xl print-force-transparent">
        
        {/* YAZDIRMA BAŞLIĞI */}
        <div className="text-center border-b border-slate-800 pb-3 mb-4 print-border-b">
          <h1 className="text-base font-black text-white tracking-widest print-text-black uppercase">DÖNEMSEL HAREKET VE DURUM ANALİZ RAPORU</h1>
          <p className="text-[10px] text-slate-400 mt-1 print-text-black font-medium">
            Kapsam: {selectedCompany === 'all' ? 'Tüm Kurumlar (Birleşik Rapor)' : companies.find(c => c.id === selectedCompany)?.name} 
            {' • '} Dönem: {dateFilter === 'thisMonth' ? 'Bu Ay' : dateFilter === 'lastMonth' ? 'Geçen Ay' : dateFilter === 'thisYear' ? 'Bu Yıl' : 'Tüm Zamanlar'}
            {' • '} Çıktı Tarihi: {new Date().toLocaleDateString('tr-TR')}
          </p>
        </div>

        {/* BÖLÜM 1: GRAFİKLİ KAYNAK DAĞILIMLARI */}
        <div className="mb-6">
          <h2 className="text-[10px] font-bold text-slate-500 print-text-black uppercase tracking-widest mb-2">1. İşlem Gören Kaynakların Hacim Dağılımı (Dönem İçi)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <DistributionCard title="Gider & Masraf Dağılımı" data={expSources} delay="0.15s" />
            <DistributionCard title="Tedarikçi Ödemeleri" data={suppSources} delay="0.2s" />
            <DistributionCard title="Müşteri Tahsilatları" data={{...custSources, total: custSources.total}} delay="0.25s" />
          </div>
        </div>

        {/* BÖLÜM 2: MİZAN TABLOLARI */}
        <div className="space-y-6">
          
          {/* KREDİ KARTLARI */}
          <div style={{ animation: 'fadeInUp 0.4s both 0.3s' }}>
            <h2 className="text-[10px] font-bold text-slate-500 print-text-black uppercase tracking-widest mb-1.5">2. Kredi Kartları Hareket Özeti</h2>
            <div className="print-force-transparent border border-slate-800/50 rounded-lg overflow-hidden">
              <table className="w-full text-left text-[9px] font-mono">
                <thead className="bg-[#0a0f1d] border-b border-slate-800/50">
                  <tr>
                    <th className="font-bold font-sans uppercase print-text-black text-left p-2.5">Kredi Kartı Adı</th>
                    <th className="font-bold font-sans uppercase print-text-black text-right p-2.5">Dönem Başı Borç</th>
                    <th className="font-bold font-sans uppercase text-rose-400 print:text-rose-700 text-right p-2.5">Harcama (+)</th>
                    <th className="font-bold font-sans uppercase text-emerald-400 print:text-emerald-700 text-right p-2.5">Ödeme (-)</th>
                    <th className="font-bold font-sans uppercase print-text-black text-right p-2.5 bg-slate-800/30">Dönem Sonu Borç</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30">
                  {cardAnalysis.length === 0 ? <tr><td colSpan={5} className="text-center font-sans text-slate-500 py-3">Bu dönemde hareket yok.</td></tr> : cardAnalysis.map((c, index) => (
                    <tr key={c.id} style={{ animation: 'fadeSlideRight 0.3s both', animationDelay: `${0.35 + (index * 0.05)}s` }} className="hover:bg-slate-800/20 transition-colors">
                      <td className="text-slate-200 print-text-black font-sans font-medium p-2.5">{c.name}</td>
                      <td className="text-slate-400 print-text-black text-right p-2.5">{formatMoney(c.opening, 'TRY').formatted}</td>
                      <td className="text-rose-400 print:text-rose-700 text-right font-bold p-2.5">{formatMoney(c.increase, 'TRY').formatted}</td>
                      <td className="text-emerald-400 print:text-emerald-700 text-right font-bold p-2.5">{formatMoney(c.decrease, 'TRY').formatted}</td>
                      <td className="text-slate-200 print-text-black text-right font-bold p-2.5 bg-slate-800/10">{formatMoney(c.closing, 'TRY').formatted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* BANKALAR */}
          <div style={{ animation: 'fadeInUp 0.4s both 0.4s' }}>
            <h2 className="text-[10px] font-bold text-slate-500 print-text-black uppercase tracking-widest mb-1.5">3. Banka Hesapları Hareket Özeti</h2>
            <div className="print-force-transparent border border-slate-800/50 rounded-lg overflow-hidden">
              <table className="w-full text-left text-[9px] font-mono">
                <thead className="bg-[#0a0f1d] border-b border-slate-800/50">
                  <tr>
                    <th className="font-bold font-sans uppercase print-text-black text-left p-2.5">Banka Hesap Adı</th>
                    <th className="font-bold font-sans uppercase print-text-black text-right p-2.5">Dönem Başı Bakiye</th>
                    <th className="font-bold font-sans uppercase text-emerald-400 print:text-emerald-700 text-right p-2.5">Giren Nakit (+)</th>
                    <th className="font-bold font-sans uppercase text-rose-400 print:text-rose-700 text-right p-2.5">Çıkan Nakit (-)</th>
                    <th className="font-bold font-sans uppercase print-text-black text-right p-2.5 bg-slate-800/30">Dönem Sonu Bakiye</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30">
                  {bankAnalysis.length === 0 ? <tr><td colSpan={5} className="text-center font-sans text-slate-500 py-3">Bu dönemde hareket yok.</td></tr> : bankAnalysis.map((b, index) => (
                    <tr key={b.id} style={{ animation: 'fadeSlideRight 0.3s both', animationDelay: `${0.45 + (index * 0.05)}s` }} className="hover:bg-slate-800/20 transition-colors">
                      <td className="text-slate-200 print-text-black font-sans font-medium p-2.5">{b.bank_name}</td>
                      <td className="text-slate-400 print-text-black text-right p-2.5">{formatMoney(b.opening, 'TRY').formatted}</td>
                      <td className="text-emerald-400 print:text-emerald-700 text-right font-bold p-2.5">{formatMoney(b.in, 'TRY').formatted}</td>
                      <td className="text-rose-400 print:text-rose-700 text-right font-bold p-2.5">{formatMoney(b.out, 'TRY').formatted}</td>
                      <td className="text-slate-200 print-text-black text-right font-bold p-2.5 bg-slate-800/10">{formatMoney(b.closing, 'TRY').formatted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* DEPOLAR */}
          <div style={{ animation: 'fadeInUp 0.4s both 0.5s' }}>
            <h2 className="text-[10px] font-bold text-slate-500 print-text-black uppercase tracking-widest mb-1.5">4. Depo ve Sermaye Durum Özeti</h2>
            <div className="print-force-transparent border border-slate-800/50 rounded-lg overflow-hidden">
              <table className="w-full text-left text-[9px] font-mono">
                <thead className="bg-[#0a0f1d] border-b border-slate-800/50">
                  <tr>
                    <th className="font-bold font-sans uppercase print-text-black text-left p-2.5">Depo Adı</th>
                    <th className="font-bold font-sans uppercase print-text-black text-right p-2.5">Dönem Başı Değer</th>
                    <th className="font-bold font-sans uppercase text-emerald-400 print:text-emerald-700 text-right p-2.5">Giren Değer (+)</th>
                    <th className="font-bold font-sans uppercase text-rose-400 print:text-rose-700 text-right p-2.5">Çıkan Değer (-)</th>
                    <th className="font-bold font-sans uppercase print-text-black text-right p-2.5 bg-slate-800/30">Dönem Sonu Değer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30">
                  {whAnalysis.length === 0 ? <tr><td colSpan={5} className="text-center font-sans text-slate-500 py-3">Bu dönemde hareket yok.</td></tr> : whAnalysis.map((w, index) => (
                    <tr key={w.id} style={{ animation: 'fadeSlideRight 0.3s both', animationDelay: `${0.55 + (index * 0.05)}s` }} className="hover:bg-slate-800/20 transition-colors">
                      <td className="text-slate-200 print-text-black font-sans font-medium p-2.5">{w.name}</td>
                      <td className="text-slate-400 print-text-black text-right p-2.5">{formatMoney(w.opening, 'TRY').formatted}</td>
                      <td className="text-emerald-400 print:text-emerald-700 text-right font-bold p-2.5">{formatMoney(w.in, 'TRY').formatted}</td>
                      <td className="text-rose-400 print:text-rose-700 text-right font-bold p-2.5">{formatMoney(w.out, 'TRY').formatted}</td>
                      <td className="text-slate-200 print-text-black text-right font-bold p-2.5 bg-slate-800/10">{formatMoney(w.closing, 'TRY').formatted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
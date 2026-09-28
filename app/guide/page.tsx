'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import { 
  BookOpen, Search, Printer, Lightbulb, AlertTriangle, 
  CheckCircle2, ArrowRight, Store, Wrench, Package, 
  ArrowUpRight, ArrowDownLeft, Wallet, Receipt, LayoutDashboard,
  Layers, Sparkles, Check, ChevronDown, ChevronUp, FileText,
  Clock, ShieldAlert, ArrowRightLeft, HelpCircle
} from 'lucide-react'
import { GUIDE_TOPICS, GuideTopic } from '@/lib/guide-data'

const ICON_MAP: Record<string, any> = {
  LayoutDashboard,
  Store,
  Wrench,
  Package,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Receipt
}

export default function GuidePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [expandedTopicId, setExpandedTopicId] = useState<string | null>(null)
  
  // Gün sonu checklist durumu
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    'count-cash': false,
    'compare-system': false,
    'check-unpaid': false,
    'close-services': false,
    'settle-cards': false
  })

  const toggleChecklist = (id: string) => {
    setChecklist(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Filtrelenmiş konular
  const filteredTopics = useMemo(() => {
    return GUIDE_TOPICS.filter(topic => {
      const matchesCategory = selectedCategory === 'all' || topic.category === selectedCategory
      const q = searchQuery.toLowerCase().trim()
      if (!q) return matchesCategory

      const matchesSearch = 
        topic.title.toLowerCase().includes(q) ||
        topic.subtitle.toLowerCase().includes(q) ||
        topic.summary.toLowerCase().includes(q) ||
        topic.steps.some(s => s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)) ||
        (topic.faqs && topic.faqs.some(f => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)))

      return matchesCategory && matchesSearch
    })
  }, [selectedCategory, searchQuery])

  return (
    <div className="space-y-6 pb-20 text-slate-100 max-w-6xl mx-auto print:max-w-none print:p-0 print:space-y-4">
      
      {/* ÜST BAŞLIK VE YAZDIR BUTONU (Baskıda butonlar gizlenir) */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden print:border-b print:border-slate-300 print:rounded-none print:p-4 print:bg-white print:text-black">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 blur-[90px] rounded-full pointer-events-none -z-0 print:hidden"></div>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-500/10 text-amber-300 border border-amber-500/30 print:hidden">
                Resmi El Kitabı & Kılavuz
              </span>
              <span className="text-[11px] text-slate-400 font-mono print:text-slate-600">Bilgisayar Hastanesi Sürümü</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5 print:text-black">
              <BookOpen size={24} className="text-amber-400 print:text-black" />
              Sistem Kullanım Kılavuzu & Günlük İşleyiş Rehberi
            </h1>
            <p className="text-xs text-slate-400 mt-1.5 max-w-2xl leading-relaxed print:text-slate-700">
              Bu kılavuz; dükkan açılışından akşam kasa sayımına, perakende hızlı satıştan teknik servis cihaz kabulüne ve ortak kart mahsup virmanlarına kadar tüm adımları sana öğretmek için hazırlandı.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 print:hidden">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <Printer size={15} className="text-indigo-400" />
              <span>Yazdır / PDF İndir</span>
            </button>
          </div>
        </div>

        {/* ANLIK ARAMA ÇUBUĞU (Baskıda gizlenir) */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center gap-3 print:hidden">
          <div className="relative flex-1 w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Konularda veya sorularda ara (Örn: virman, cihaz kabul, fiş, veresiye, kasa)..."
              className="w-full bg-[#070b14] border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                Temizle
              </button>
            )}
          </div>

          {/* Kategori Filtre Butonları */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto custom-scrollbar">
            {[
              { id: 'all', label: 'Tüm Konular' },
              { id: 'daily', label: 'Günlük Kasa & Satış' },
              { id: 'service', label: 'Teknik Servis' },
              { id: 'stock', label: 'Stok & Parça' },
              { id: 'finance', label: 'Finans & Virman' },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/30'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ÖZEL VURGU KARTI: ORTAK KART MAHSUP VİRMANI (ÖNEMLİ YENİLİK) */}
      <div className="bg-gradient-to-r from-amber-950/30 via-slate-900/50 to-indigo-950/30 border border-amber-500/30 rounded-2xl p-5 shadow-lg relative overflow-hidden print:border print:border-amber-400 print:bg-white print:text-black">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-500/20 text-amber-300 rounded-xl border border-amber-500/40 shrink-0 mt-0.5 print:hidden">
            <ArrowRightLeft size={24} />
          </div>
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Çok Önemli İş Akışı
              </span>
              <h2 className="text-sm font-bold text-white print:text-black">
                Ortak Kredi Kartı ile Ödenen Vergilerin Merkeze Virmanlanması
              </h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed print:text-slate-700">
              Merkez veya patron, Bilgisayar Hastanesi'nin bir vergisini veya faturasını ortak bir kredi kartı ile ödediğinde bu harcama senin dükkanının gideri olarak yazılır. Kartın son ödeme günü geldiğinde senin bu parayı dükkan kasandan merkeze aktarman gerekir:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1 print:border-slate-300 print:bg-slate-50">
                <div className="font-bold text-amber-300 print:text-black">1. Uyarıyı Gör</div>
                <div className="text-[11px] text-slate-400 print:text-slate-600">Ana Sayfa (Vadeler) veya Genel Giderler tablosunda <strong>⚠️ Merkeze Virman Bekliyor</strong> uyarısını gör.</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1 print:border-slate-300 print:bg-slate-50">
                <div className="font-bold text-indigo-300 print:text-black">2. Butona Tıkla</div>
                <div className="text-[11px] text-slate-400 print:text-slate-600"><strong>[Merkeze Virmanla →]</strong> butonuna tıkla. Paranın çıkacağı dükkan kasasını veya bankasını seç.</div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1 print:border-slate-300 print:bg-slate-50">
                <div className="font-bold text-emerald-300 print:text-black">3. Otomatik Kapanış</div>
                <div className="text-[11px] text-slate-400 print:text-slate-600">Onayladığında kasan düşer, kart borcu kapanır ve kâr/zararın ikinci kez etkilenmeden tertemiz kalır!</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KONU LİSTESİ */}
      <div className="space-y-4">
        {filteredTopics.length === 0 ? (
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
            <HelpCircle size={32} className="mx-auto mb-2 opacity-40 text-amber-400" />
            <p className="font-bold text-white text-sm">Aramanıza uygun bir kılavuz konusu bulunamadı.</p>
            <p className="text-xs text-slate-500 mt-1">Farklı bir kelime deneyebilir veya arama çubuğunu temizleyebilirsiniz.</p>
          </div>
        ) : (
          filteredTopics.map((topic, topicIdx) => {
            const Icon = ICON_MAP[topic.iconName] || HelpCircle
            const isExpanded = expandedTopicId === topic.id || searchQuery.length > 0 || true // Varsayılan olarak açık

            return (
              <div 
                key={topic.id}
                className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-lg transition-all hover:border-slate-700/80 print:border-b print:border-slate-300 print:rounded-none print:shadow-none print:bg-white print:text-black"
              >
                {/* MODÜL BAŞLIK KARTI */}
                <div className="p-4 sm:p-5 flex items-start justify-between gap-3 bg-slate-900/40 border-b border-slate-800/80 print:bg-slate-100 print:border-slate-300">
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shrink-0 mt-0.5 print:hidden">
                      <Icon size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-slate-500 print:text-slate-700">BÖLÜM {topicIdx + 1}</span>
                        <h2 className="text-base font-bold text-white print:text-black">{topic.title}</h2>
                      </div>
                      <p className="text-xs text-indigo-300/90 font-medium mt-0.5 print:text-slate-600">{topic.subtitle}</p>
                      <p className="text-[11.5px] text-slate-400 mt-2 leading-relaxed max-w-3xl print:text-slate-700">{topic.summary}</p>
                    </div>
                  </div>

                  {topic.routePath && (
                    <div className="shrink-0 print:hidden">
                      <Link
                        href={topic.routePath}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white text-xs font-semibold border border-slate-700 transition-all"
                      >
                        <span>Sayfaya Git</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  )}
                </div>

                {/* ADIMLAR */}
                <div className="p-4 sm:p-5 space-y-3.5">
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 print:text-black">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    Yapılacak Adımlar & İşleyiş
                  </h3>

                  <div className="grid grid-cols-1 gap-3">
                    {topic.steps.map(step => (
                      <div 
                        key={step.number}
                        className="p-3.5 rounded-xl bg-[#070b14]/70 border border-slate-800 hover:border-slate-700 transition-all space-y-2 print:bg-white print:border-slate-200"
                      >
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-sm print:bg-slate-800">
                            {step.number}
                          </span>
                          <div className="flex-1">
                            <h4 className="font-bold text-white text-xs print:text-black">{step.title}</h4>
                            <p className="text-slate-400 text-xs mt-1 leading-relaxed print:text-slate-700">{step.description}</p>
                          </div>
                        </div>

                        {step.tip && (
                          <div className="ml-9 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2 text-emerald-300 text-[11px] print:text-emerald-800 print:bg-emerald-50">
                            <Lightbulb size={14} className="shrink-0 text-emerald-400 mt-0.5 print:text-emerald-700" />
                            <span><strong>Püf Noktası:</strong> {step.tip}</span>
                          </div>
                        )}

                        {step.warning && (
                          <div className="ml-9 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2 text-amber-300 text-[11px] print:text-amber-800 print:bg-amber-50">
                            <AlertTriangle size={14} className="shrink-0 text-amber-400 mt-0.5 print:text-amber-700" />
                            <span><strong>Dikkat:</strong> {step.warning}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* SIKÇA SORULAN SORULAR */}
                  {topic.faqs && topic.faqs.length > 0 && (
                    <div className="pt-3 border-t border-slate-800/80 space-y-2 print:border-slate-300">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider print:text-slate-700">
                        Sıkça Sorulan Sorular
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {topic.faqs.map((faq, fIdx) => (
                          <div key={fIdx} className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 space-y-1 print:bg-slate-50 print:border-slate-200">
                            <div className="text-xs font-bold text-indigo-300 print:text-indigo-900">
                              ❓ {faq.question}
                            </div>
                            <div className="text-[11px] text-slate-400 leading-relaxed print:text-slate-700">
                              {faq.answer}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )
          })
        )}
      </div>

      {/* GÜN SONU KONTROL LİSTESİ (CHECKLIST) */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 print:border-slate-300 print:bg-white print:text-black">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 print:border-slate-300">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2 print:text-black">
              <CheckCircle2 size={18} className="text-emerald-400" />
              Akşam Kapanış Kontrol Listesi (Gün Sonu Mutabakatı)
            </h2>
            <p className="text-xs text-slate-400 mt-1 print:text-slate-600">
              Dükkandan çıkmadan önce her akşam aşağıdaki 5 adımı tamamla ve kutuları işaretle.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          {[
            { id: 'count-cash', title: '1. Çekmecedeki Nakit Parayı Say', desc: 'Madeni ve kâğıt paraların toplamını tam olarak hesapla.' },
            { id: 'compare-system', title: '2. Nakit Kasa Sayfasıyla Eşle', desc: 'Sistemdeki Bilgisayar Hastanesi Kasası tutarı ile saydığın nakit birbirini tutuyor mu?' },
            { id: 'close-services', title: '3. Teslim Edilen Cihazları Kapat', desc: 'Müşteriye teslim edilen tamir cihazlarının durumu sistemde "Teslim Edildi" olarak kapatıldı mı?' },
            { id: 'settle-cards', title: '4. Bekleyen Virmanları Kontrol Et', desc: 'Ana Sayfada veya Giderlerde bekleyen "Merkeze Virman Bekliyor" kalemi var mı?' },
            { id: 'check-unpaid', title: '5. Veresiye/Açık Hesap Kontrolü', desc: 'Bugün veresiye bırakılan bir işlem varsa doğru müşterinin carisine yazıldı mı?' },
          ].map(item => {
            const isChecked = checklist[item.id]
            return (
              <div 
                key={item.id}
                onClick={() => toggleChecklist(item.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                  isChecked 
                    ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200' 
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                } print:bg-white print:border-slate-200 print:text-black`}
              >
                <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                  isChecked ? 'bg-emerald-600 border-emerald-500 text-white' : 'border-slate-600 bg-slate-800 print:border-slate-400'
                }`}>
                  {isChecked && <Check size={13} strokeWidth={3} />}
                </div>
                <div>
                  <h4 className="font-bold text-xs">{item.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5 print:text-slate-600">{item.desc}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}

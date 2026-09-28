'use client'

import React, { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { 
  HelpCircle, X, ExternalLink, Lightbulb, AlertTriangle, 
  CheckCircle2, ArrowRight, BookOpen, Search, Store, Wrench, 
  Package, ArrowUpRight, ArrowDownLeft, Wallet, Receipt, LayoutDashboard
} from 'lucide-react'
import { GUIDE_TOPICS, ROUTE_TO_GUIDE_MAP, GuideTopic } from '@/lib/guide-data'

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

export default function ContextualHelpDrawer() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [selectedTopicId, setSelectedTopicId] = useState<string>('dashboard')

  // Sayfa değiştikçe otomatik olarak ilgili yardım konusunu seç
  useEffect(() => {
    const topicId = ROUTE_TO_GUIDE_MAP[pathname] || 'dashboard'
    setSelectedTopicId(topicId)
  }, [pathname])

  // ESC tuşu ile kapatma
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) setIsOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const currentTopic = GUIDE_TOPICS.find(t => t.id === selectedTopicId) || GUIDE_TOPICS[0]
  const IconComponent = ICON_MAP[currentTopic.iconName] || HelpCircle

  // Eğer giriş sayfasındaysak veya kılavuz sayfasındaysak çekmece butonunu gösterme
  if (pathname === '/login' || pathname === '/guide') {
    return null
  }

  return (
    <>
      {/* TETİKLEYİCİ BUTON: TopBar veya Ekran Sağ Üstü */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-all shadow-sm active:scale-95 group cursor-pointer"
        title="Bu Sayfa Nasıl Kullanılır? Hızlı Rehber"
      >
        <HelpCircle size={15} className="text-amber-400 group-hover:rotate-12 transition-transform" />
        <span className="hidden sm:inline">Nasıl Kullanılır?</span>
      </button>

      {/* ARKA PLAN KARARTMASI */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999990] animate-in fade-in duration-200"
        />
      )}

      {/* SAĞ KAYAR PANEL (DRAWER) */}
      <div 
        className={`fixed top-0 right-0 bottom-0 w-full sm:w-[480px] bg-[#0c1322] border-l border-slate-800 z-[999999] shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* BAŞLIK VE KAPATMA */}
        <div className="p-4 border-b border-slate-800 bg-[#0a0f1d] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <IconComponent size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                {currentTopic.title}
              </h2>
              <p className="text-[11px] text-slate-400">Hızlı Kullanım Rehberi</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* DİĞER MODÜLLERE HIZLI GEÇİŞ ÇUBUĞU */}
        <div className="px-4 py-2 border-b border-slate-800/80 bg-slate-900/40 flex items-center gap-1.5 overflow-x-auto custom-scrollbar shrink-0">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider shrink-0 mr-1">Konular:</span>
          {GUIDE_TOPICS.map(topic => {
            const isSelected = topic.id === selectedTopicId
            return (
              <button
                key={topic.id}
                onClick={() => setSelectedTopicId(topic.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all ${
                  isSelected 
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/30' 
                    : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {topic.title.split(' ')[0]}
              </button>
            )
          })}
        </div>

        {/* İÇERİK ALANI */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs">
          
          {/* ÖZET KART */}
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-indigo-950/30 to-slate-900/50 border border-indigo-500/20">
            <p className="text-slate-300 leading-relaxed text-[11.5px]">
              {currentTopic.summary}
            </p>
          </div>

          {/* ADIM ADIM İŞLEM REHBERİ */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-emerald-400" /> İşlem Adımları
            </h3>

            {currentTopic.steps.map(step => (
              <div 
                key={step.number}
                className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 transition-colors space-y-2"
              >
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5">
                    {step.number}
                  </span>
                  <div className="flex-1">
                    <h4 className="font-bold text-white text-[12px]">{step.title}</h4>
                    <p className="text-slate-400 mt-1 text-[11px] leading-relaxed">{step.description}</p>
                  </div>
                </div>

                {step.tip && (
                  <div className="ml-7 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2 text-emerald-300 text-[10.5px]">
                    <Lightbulb size={13} className="shrink-0 text-emerald-400 mt-0.5" />
                    <span><strong>İpucu:</strong> {step.tip}</span>
                  </div>
                )}

                {step.warning && (
                  <div className="ml-7 p-2 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-start gap-2 text-amber-300 text-[10.5px]">
                    <AlertTriangle size={13} className="shrink-0 text-amber-400 mt-0.5" />
                    <span><strong>Dikkat:</strong> {step.warning}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* SIKÇA SORULAN SORULAR (VARSA) */}
          {currentTopic.faqs && currentTopic.faqs.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Sıkça Sorulan Sorular
              </h3>
              {currentTopic.faqs.map((faq, i) => (
                <div key={i} className="p-3 rounded-lg bg-slate-900/40 border border-slate-800/60 space-y-1">
                  <div className="font-bold text-indigo-300 text-[11px]">❓ {faq.question}</div>
                  <div className="text-slate-400 text-[11px] leading-relaxed">{faq.answer}</div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* ALT ÇUBUK: TAM KILAVUZA GİT */}
        <div className="p-3.5 border-t border-slate-800 bg-[#0a0f1d] shrink-0 flex items-center justify-between">
          <Link
            href="/guide"
            onClick={() => setIsOpen(false)}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-900/30"
          >
            <BookOpen size={14} />
            <span>Tüm Kılavuzu & Senaryoları Aç</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </>
  )
}

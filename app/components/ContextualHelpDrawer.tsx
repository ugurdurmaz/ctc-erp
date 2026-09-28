'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

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

  // Drawer Portal İçeriği
  const drawerContent = (
    <>
      {/* ARKA PLAN KARARTMASI (TAM OPAK KARARTMA & BLUR) */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[999998] animate-in fade-in duration-200"
        />
      )}

      {/* SAĞ KAYAR PANEL (DRAWER - TAM EKRAN YÜKSEKLİĞİNDE, KESİNLİKLE OPAK) */}
      <div 
        className={`fixed top-0 right-0 bottom-0 h-screen w-full sm:w-[460px] bg-[#090d16] border-l border-slate-700 z-[999999] shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ backgroundColor: '#090d16' }} // Güvence opak zemin
      >
        {/* BAŞLIK VE KAPATMA */}
        <div className="p-4 border-b border-slate-800 bg-[#060911] flex items-center justify-between shrink-0">
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
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Kapat (ESC)"
          >
            <X size={18} />
          </button>
        </div>

        {/* DİĞER MODÜLLERE HIZLI GEÇİŞ ÇUBUĞU */}
        <div className="px-4 py-2 border-b border-slate-800 bg-[#0c1220] flex items-center gap-1.5 overflow-x-auto custom-scrollbar shrink-0">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider shrink-0 mr-1">Konular:</span>
          {GUIDE_TOPICS.map(topic => {
            const isSelected = topic.id === selectedTopicId
            return (
              <button
                key={topic.id}
                onClick={() => setSelectedTopicId(topic.id)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/30' 
                    : 'bg-slate-800/90 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                {topic.title.split(' ')[0]}
              </button>
            )
          })}
        </div>

        {/* İÇERİK ALANI (KAYDIRILABİLİR, TAM OPAK KARTLAR) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs bg-[#090d16]">
          
          {/* ÖZET KART */}
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-md">
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
                className="p-3.5 rounded-xl bg-[#0e1424] border border-slate-800 shadow-sm space-y-2"
              >
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5 shadow">
                    {step.number}
                  </span>
                  <div className="flex-1">
                    <h4 className="font-bold text-white text-[12px]">{step.title}</h4>
                    <p className="text-slate-300 mt-1 text-[11px] leading-relaxed">{step.description}</p>
                  </div>
                </div>

                {step.tip && (
                  <div className="ml-7 p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-2 text-emerald-300 text-[10.5px]">
                    <Lightbulb size={13} className="shrink-0 text-emerald-400 mt-0.5" />
                    <span><strong>İpucu:</strong> {step.tip}</span>
                  </div>
                )}

                {step.warning && (
                  <div className="ml-7 p-2 rounded-lg bg-amber-950/40 border border-amber-500/30 flex items-start gap-2 text-amber-300 text-[10.5px]">
                    <AlertTriangle size={13} className="shrink-0 text-amber-400 mt-0.5" />
                    <span><strong>Dikkat:</strong> {step.warning}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* SIKÇA SORULAN SORULAR */}
          {currentTopic.faqs && currentTopic.faqs.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Sıkça Sorulan Sorular
              </h3>
              {currentTopic.faqs.map((faq, i) => (
                <div key={i} className="p-3 rounded-lg bg-[#0e1424] border border-slate-800 space-y-1">
                  <div className="font-bold text-indigo-300 text-[11px]">❓ {faq.question}</div>
                  <div className="text-slate-300 text-[11px] leading-relaxed">{faq.answer}</div>
                </div>
              ))}
            </div>
          )}

        </div>

        {/* ALT ÇUBUK: TAM KILAVUZA GİT */}
        <div className="p-3.5 border-t border-slate-800 bg-[#060911] shrink-0 flex items-center justify-between">
          <Link
            href="/guide"
            onClick={() => setIsOpen(false)}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-900/30 cursor-pointer"
          >
            <BookOpen size={14} />
            <span>Tüm Kılavuzu & Senaryoları Aç</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* TETİKLEYİCİ BUTON: Bildirim Zili İle Birebir Uyumlu Dairesel Buton */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`relative p-2 transition-colors rounded-full cursor-pointer ${
          isOpen ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800'
        }`}
        title="Bu Sayfa Nasıl Kullanılır? Hızlı Rehber"
      >
        <HelpCircle size={18} />
      </button>

      {/* PORTAL İLE BODY'YE BAĞLANAN OPAK ÇEKMECE */}
      {mounted && typeof document !== 'undefined' && createPortal(drawerContent, document.body)}
    </>
  )
}

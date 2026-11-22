'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useCompany } from '@/lib/company-context'
import { ROLE_LABELS } from '@/types/auth'
import { Bell, Search, User, TrendingUp, DollarSign, Euro, AlertCircle, Clock, CheckCircle2, X, LogOut, Users, Shield, ChevronDown, BookOpen, Building2, Building, Home, Check } from 'lucide-react'
import ContextualHelpDrawer from './ContextualHelpDrawer'
import PersonalStickyNotesPopover from './PersonalStickyNotesPopover'

// Sayfa yollarına göre başlıkları eşleştiriyoruz
const routeNames: Record<string, string> = {
  '/': 'Genel Durum (Dashboard)',
  '/retail': 'Mağaza',
  '/technical-service': 'Teknik Servis & Cihaz Takip',
  '/cash-registers': 'Nakit Kasalar',
  '/bank-accounts': 'Banka Hesapları',
  '/credit-cards': 'Kredi Kartları',
  '/bank-loans': 'Banka Kredileri',
  '/stocks': 'Stok Yönetimi',
  '/services': 'Hizmet Yönetimi',
  '/suppliers': 'Satıcılar (Borç)',
  '/customers': 'Müşteriler (Alacak)',
  '/expenses': 'Genel Giderler',
  '/subscriptions': 'Abonelik & Lisans Satışları',
  '/reports': 'Raporlar (P&L)',
  '/companies': 'Şirketler / Merkezler',
  '/activity': 'İşlem Geçmişi (Log)',
  '/users': 'Kullanıcılar & Yetkiler',
  '/guide': 'Kullanım Kılavuzu & Yardım',
}

type Notification = {
  id: string;
  type: 'warning' | 'danger' | 'info';
  title: string;
  message: string;
  time: string;
  link: string;
}

export default function TopBar() {
  const pathname = usePathname()
  const pageTitle = routeNames[pathname] || 'CTC Master Ledger'
  const { user, profile, signOut, isAdmin } = useAuth()
  
  const [rates, setRates] = useState<{ USD: number; EUR: number }>({ USD: 0, EUR: 0 })
  const [isLoadingRates, setIsLoadingRates] = useState(true)

  // Bildirim State'leri
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  // Profil Menüsü State'leri
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  // Global Merkez / Şirket Seçici State'leri
  const {
    companies,
    selectedCompanyIds,
    selectedCompanyId,
    setSelectedCompanyId,
    toggleCompanyId,
    selectOnlyCompany,
    clearFilter,
    activeCompany
  } = useCompany()
  const [isCompanyMenuOpen, setIsCompanyMenuOpen] = useState(false)
  const companyMenuRef = useRef<HTMLDivElement>(null)

  // Canlı kur çekme işlemi
  useEffect(() => {
    async function fetchRates() {
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/USD')
        const data = await res.json()
        if (data && data.rates) {
          setRates({
            USD: Number(data.rates.TRY.toFixed(4)),
            EUR: Number((data.rates.TRY / data.rates.EUR).toFixed(4))
          })
        }
      } catch (error) {
        console.error("Kur bilgisi çekilemedi", error)
      } finally {
        setIsLoadingRates(false)
      }
    }
    fetchRates()
    const interval = setInterval(fetchRates, 60000)
    return () => clearInterval(interval)
  }, [])

  // Bildirimleri Çekme (Stok ve Kredi Kartı Uyarıları)
  useEffect(() => {
    async function fetchNotifications() {
      try {
        const newNotifs: Notification[] = []

        // 1. Kritik Stok Kontrolü
        const { data: stocks } = await supabase.from('stocks').select('id, name, current_stock, critical_level')
        if (stocks) {
          stocks.forEach(st => {
            if (st.critical_level && st.current_stock <= st.critical_level) {
              newNotifs.push({
                id: `stock-${st.id}`,
                type: 'danger',
                title: 'Kritik Stok Uyarısı',
                message: `${st.name} ürünü kritik eşiğin altına indi (${st.current_stock} adet kaldı).`,
                time: 'Şimdi',
                link: '/stocks'
              })
            }
          })
        }

        // 2. Kredi Kartı Limit ve Hesap Kesim Kontrolü
        const { data: cards } = await supabase.from('credit_cards').select('id, card_name, current_debt, credit_limit, cutoff_day')
        if (cards) {
          const todayDay = new Date().getDate()
          cards.forEach(c => {
            if (c.credit_limit && (c.current_debt / c.credit_limit) >= 0.85) {
              newNotifs.push({
                id: `card-limit-${c.id}`,
                type: 'warning',
                title: 'Yüksek Kart Limiti',
                message: `${c.card_name} kartının limitinin %85'i kullanıldı.`,
                time: 'Şimdi',
                link: '/credit-cards'
              })
            }
            if (c.cutoff_day && Math.abs(c.cutoff_day - todayDay) <= 2) {
              newNotifs.push({
                id: `card-cutoff-${c.id}`,
                type: 'info',
                title: 'Hesap Kesim Yaklaştı',
                message: `${c.card_name} kartının hesap kesim tarihine az kaldı (Gün: ${c.cutoff_day}).`,
                time: 'Bu Hafta',
                link: '/credit-cards'
              })
            }
          })
        }

        setNotifications(newNotifs)
      } catch (err) {
        console.error("Bildirimler yüklenemedi", err)
      }
    }

    fetchNotifications()
  }, [])

  // Dışarı tıklandığında menüleri kapatma
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false)
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false)
      }
      if (companyMenuRef.current && !companyMenuRef.current.contains(event.target as Node)) {
        setIsCompanyMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const fullName = profile?.full_name || user?.email?.split('@')[0] || 'Kullanıcı'
  const userRole = profile?.role || 'admin'
  const roleInfo = ROLE_LABELS[userRole] || ROLE_LABELS.admin
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U'

  return (
    <div className="h-16 border-b border-slate-800/80 bg-[#070b14]/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      
      {/* SOL: SAYFA DİNAMİK BAŞLIĞI */}
      <div className="flex items-center gap-3">
        <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
          {pageTitle}
        </h2>
      </div>

      {/* SAĞ: MERKEZ SEÇİCİ, CANLI DÖVİZ, BİLDİRİM VE PROFİL */}
      <div className="flex items-center gap-3 sm:gap-4">
        
        {/* MERKEZ / ŞİRKET SEÇİCİ (GLOBAL ÇALIŞMA ALANI FİLTRESİ) */}
        <div className="relative" ref={companyMenuRef}>
          <button
            type="button"
            onClick={() => setIsCompanyMenuOpen(!isCompanyMenuOpen)}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-xl border text-xs transition-all cursor-pointer ${
              selectedCompanyIds.length > 0
                ? 'bg-indigo-950/60 border-indigo-500/60 text-indigo-200 shadow-sm shadow-indigo-950/50 hover:bg-indigo-900/60 hover:border-indigo-400'
                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:text-white hover:border-slate-700'
            }`}
            title="Aktif Merkez / Şirket Seçici (Modüller arası kalıcı filtre)"
          >
            <Building2 size={13} className={selectedCompanyIds.length > 0 ? 'text-indigo-400 shrink-0' : 'text-slate-400 shrink-0'} />
            
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold truncate max-w-[120px] sm:max-w-[170px]">
                {selectedCompanyIds.length === 0
                  ? 'Tüm Merkezler'
                  : selectedCompanyIds.length === 1
                  ? (activeCompany?.name || 'Seçili Merkez')
                  : `${selectedCompanyIds.length} Merkez Seçili`}
              </span>
              
              {selectedCompanyIds.length > 0 && (
                <span className="hidden sm:inline-block text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/25 text-indigo-300 border border-indigo-500/40 font-bold shrink-0">
                  Aktif
                </span>
              )}
            </div>

            {selectedCompanyIds.length > 0 ? (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  clearFilter()
                }}
                className="text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 p-0.5 rounded transition-colors ml-0.5"
                title="Filtreyi Temizle (Tüm Merkezler)"
              >
                <X size={12} />
              </span>
            ) : (
              <ChevronDown size={13} className={`text-slate-400 transition-transform ${isCompanyMenuOpen ? 'rotate-180' : ''}`} />
            )}
          </button>

          {/* AÇILIR MERKEZ SEÇİM MENÜSÜ */}
          {isCompanyMenuOpen && (
            <div className="absolute top-11 left-0 sm:left-auto sm:right-0 w-72 bg-[#0f172a] border border-slate-700/90 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col">
              {/* Başlık ve Bilgi */}
              <div className="bg-slate-900/90 px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Building2 size={13} className="text-indigo-400" />
                    Çalışma Alanı (Merkez)
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Seçili merkezin hesap, müşteri, depo ve kartları listelenir.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCompanyMenuOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>

              {/* Menü Seçenekleri */}
              <div className="p-2 space-y-1 max-h-72 overflow-y-auto custom-scrollbar">
                {/* 1. Tüm Merkezler (Konsolide) */}
                <button
                  type="button"
                  onClick={() => {
                    clearFilter()
                    setIsCompanyMenuOpen(false)
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                    selectedCompanyIds.length === 0
                      ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-200 font-bold'
                      : 'hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-lg bg-slate-800 text-slate-300">🌍</span>
                    <span>Tüm Merkezler (Konsolide)</span>
                  </div>
                  {selectedCompanyIds.length === 0 && <Check size={14} className="text-indigo-400" />}
                </button>

                <div className="my-1 border-t border-slate-800/80 px-2 pt-1 pb-0.5">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-400 block">
                    Şirketler & Masraf Merkezleri
                  </span>
                </div>

                {/* Şirket / Merkez Listesi */}
                {companies.map(comp => {
                  const isSelected = selectedCompanyIds.includes(comp.id)
                  return (
                    <div
                      key={comp.id}
                      className={`flex items-center justify-between p-2 rounded-xl text-xs transition-colors group ${
                        isSelected
                          ? 'bg-indigo-950/60 border border-indigo-500/40 text-white'
                          : 'hover:bg-slate-800/50 text-slate-300'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          selectOnlyCompany(comp.id)
                          setIsCompanyMenuOpen(false)
                        }}
                        className="flex items-center gap-2 flex-1 text-left min-w-0 cursor-pointer"
                        title="Yalnızca bu merkezi çalışma alanı olarak seç"
                      >
                        <div className={`p-1 rounded-lg shrink-0 ${comp.is_personal ? 'bg-slate-800 text-slate-400' : 'bg-indigo-950/80 text-indigo-400'}`}>
                          {comp.is_personal ? <Home size={12} /> : <Building size={12} />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold truncate">{comp.name}</span>
                          <span className="text-[9px] text-slate-400">
                            {comp.is_personal ? 'Kişisel / Masraf' : 'Ticari Şirket'}
                          </span>
                        </div>
                      </button>

                      {/* Çoklu Seçim / Filtre Toggle Kutusu */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleCompanyId(comp.id)
                        }}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 ml-2 ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'bg-slate-800 border-slate-700 text-transparent hover:text-slate-400'
                        }`}
                        title={isSelected ? 'Seçimi kaldır' : 'Seçime ekle (Çoklu merkez)'}
                      >
                        <Check size={11} className={isSelected ? 'text-white' : 'opacity-0 hover:opacity-100'} />
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Footer Bilgi */}
              <div className="bg-[#080d19] px-3 py-2 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Modüller arası kalıcı filtre</span>
                {selectedCompanyIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearFilter()
                      setIsCompanyMenuOpen(false)
                    }}
                    className="text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                  >
                    Filtreyi Sıfırla
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* CANLI KURLAR */}
        <div className="hidden md:flex items-center gap-4 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
          <div className="flex items-center gap-1.5">
            <span className="flex items-center text-emerald-400 font-bold">
              <DollarSign size={13} className="-mr-0.5" /> USD:
            </span>
            <span className="font-mono text-slate-200">
              {isLoadingRates ? '...' : rates.USD.toFixed(2)} ₺
            </span>
          </div>

          <div className="w-[1px] h-3.5 bg-slate-700/60"></div>

          <div className="flex items-center gap-1.5">
            <span className="flex items-center text-blue-400 font-bold">
              <Euro size={13} className="-mr-0.5" /> EUR:
            </span>
            <span className="font-mono text-slate-200">
              {isLoadingRates ? '...' : rates.EUR.toFixed(2)} ₺
            </span>
          </div>
        </div>

        {/* BİLDİRİM VE PROFİL */}
        <div className="flex items-center gap-3">
          
          {/* KİŞİSEL POST-IT NOTLAR & YAPILACAKLAR PENCERESİ */}
          <PersonalStickyNotesPopover />

          {/* SAYFAYA ÖZEL AKILLI YARDIM ÇEKMECESİ */}
          <ContextualHelpDrawer />

          {/* BİLDİRİM ZİLİ */}
          <div className="relative" ref={notifRef}>
            <button 
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className={`relative p-2 transition-colors rounded-full cursor-pointer ${isNotifOpen ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
              title="Bildirimler"
            >
              <Bell size={18} />
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-pink-500 rounded-full border border-[#0a0f1d] animate-pulse"></span>
              )}
            </button>

            {/* BİLDİRİM PANELİ */}
            {isNotifOpen && (
              <div className="absolute top-12 right-0 w-80 bg-[#0f172a] border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200 z-50">
                <div className="bg-slate-900/80 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-white flex items-center gap-2">Bildirim Merkezi <span className="bg-pink-600 text-white px-1.5 py-0.5 rounded-md text-[9px]">{notifications.length}</span></h3>
                  <button onClick={() => setIsNotifOpen(false)} className="text-slate-400 hover:text-white transition cursor-pointer"><X size={14}/></button>
                </div>
                
                <div className="max-h-80 overflow-y-auto custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 flex flex-col items-center gap-2">
                      <CheckCircle2 size={24} className="opacity-40 text-emerald-400" />
                      <p className="text-[11px]">Şu an için her şey yolunda, yeni bir uyarı yok.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/50">
                      {notifications.map((notif) => (
                        <Link key={notif.id} href={notif.link} onClick={() => setIsNotifOpen(false)} className="flex items-start gap-3 p-4 hover:bg-slate-800/50 transition-colors group">
                          <div className={`p-2 rounded-lg shrink-0 ${notif.type === 'danger' ? 'bg-rose-500/10 text-rose-400' : 'bg-orange-500/10 text-orange-400'}`}>
                            {notif.type === 'danger' ? <AlertCircle size={16} /> : <Clock size={16} />}
                          </div>
                          <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                              <span className="text-[11px] font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">{notif.title}</span>
                              <span className="text-[9px] font-mono text-slate-500 shrink-0 ml-2">{notif.time}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed">{notif.message}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* KULLANICI PROFİLİ VE AÇILIR MENÜ */}
          <div className="relative ml-2" ref={profileRef}>
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 cursor-pointer group p-1.5 rounded-xl hover:bg-slate-800/60 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-lg group-hover:bg-indigo-500 transition-colors ring-1 ring-indigo-400/30">
                {initials}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs text-white font-bold leading-none mb-1 group-hover:text-indigo-300 transition-colors">
                  {fullName}
                </span>
                <span className="text-[9px] text-slate-400 font-medium leading-none">
                  {roleInfo.title.split(' ')[0]}
                </span>
              </div>
              <ChevronDown size={14} className={`text-slate-500 group-hover:text-slate-300 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* PROFİL AÇILIR MENÜSÜ */}
            {isProfileOpen && (
              <div className="absolute top-12 right-0 w-64 bg-[#0f172a] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-3 duration-200 z-50">
                {/* Kullanıcı Özeti */}
                <div className="bg-slate-900/90 p-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-600/90 flex items-center justify-center text-white font-bold text-sm shadow-md">
                      {initials}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs font-bold text-white truncate">{fullName}</span>
                      <span className="text-[10px] text-slate-400 truncate">{user?.email || profile?.email || ''}</span>
                      <div className="mt-1">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${roleInfo.badgeClass}`}>
                          {roleInfo.title}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Menü Linkleri */}
                <div className="p-2 space-y-1 text-xs">
                  {isAdmin && (
                    <Link
                      href="/users"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
                    >
                      <Users size={15} className="text-indigo-400" />
                      <span>Kullanıcılar & Yetkiler</span>
                    </Link>
                  )}
                  
                  <Link
                    href="/guide"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
                  >
                    <BookOpen size={15} className="text-amber-400" />
                    <span>Kullanım Kılavuzu</span>
                  </Link>

                  <Link
                    href="/activity"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
                  >
                    <Shield size={15} className="text-emerald-400" />
                    <span>Güvenlik & İşlem Kayıtları</span>
                  </Link>
                </div>

                {/* Çıkış Yap */}
                <div className="p-2 border-t border-slate-800">
                  <button
                    onClick={() => {
                      setIsProfileOpen(false)
                      signOut()
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer text-xs font-bold"
                  >
                    <LogOut size={15} />
                    <span>Oturumu Kapat</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}
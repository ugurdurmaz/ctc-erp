'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Bell, Search, User, TrendingUp, DollarSign, Euro, AlertCircle, Clock, CheckCircle2, X } from 'lucide-react'

// Sayfa yollarına göre başlıkları eşleştiriyoruz
const routeNames: Record<string, string> = {
  '/': 'Genel Durum (Dashboard)',
  '/retail': 'Mağaza Satış (POS)',
  '/cash-registers': 'Nakit Kasalar',
  '/bank-accounts': 'Banka Hesapları',
  '/credit-cards': 'Kredi Kartları',
  '/stocks': 'Stok Yönetimi',
  '/services': 'Hizmet Yönetimi',
  '/suppliers': 'Satıcılar (Borç)',
  '/customers': 'Müşteriler (Alacak)',
  '/expenses': 'Genel Giderler',
  '/subscriptions': 'Abonelik & Lisans Satışları',
  '/reports': 'Raporlar (P&L)',
  '/companies': 'Şirketler / Merkezler',
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
  
  const [rates, setRates] = useState<{ USD: number; EUR: number }>({ USD: 0, EUR: 0 })
  const [isLoadingRates, setIsLoadingRates] = useState(true)

  // Bildirim State'leri
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

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
    const interval = setInterval(fetchRates, 3600000)
    return () => clearInterval(interval)
  }, [])

  // Akıllı Bildirimleri Veritabanından Çekme
  useEffect(() => {
    async function fetchAlerts() {
      try {
        let alerts: Notification[] = []
        const now = new Date()
        const todayStr = now.toISOString().split('T')[0]
        
        const in15Days = new Date()
        in15Days.setDate(now.getDate() + 15)
        const in15DaysStr = in15Days.toISOString().split('T')[0]

        // 1. Ödenmemiş Abonelikler
        const { data: unpaidSubs } = await supabase
          .from('credit_subscriptions')
          .select('id, username, sale_price, currency')
          .eq('is_paid', false)

        if (unpaidSubs) {
          unpaidSubs.forEach(sub => {
            alerts.push({
              id: `unpaid-${sub.id}`,
              type: 'danger',
              title: 'Tahsilat Bekliyor',
              message: `${sub.username} kullanıcısının ${sub.sale_price} ${sub.currency} tutarında ödemesi beklemede.`,
              time: 'Kritik',
              link: '/subscriptions'
            })
          })
        }

        // 2. Süresi Yaklaşan veya Biten Abonelikler (Bugün ile +15 gün arası)
        const { data: expiringSubs } = await supabase
          .from('credit_subscriptions')
          .select('id, username, end_date')
          .gte('end_date', todayStr)
          .lte('end_date', in15DaysStr)

        if (expiringSubs) {
          expiringSubs.forEach(sub => {
            const end = new Date(sub.end_date).getTime()
            const diffDays = Math.ceil((end - now.getTime()) / (1000 * 3600 * 24))
            
            alerts.push({
              id: `exp-${sub.id}`,
              type: 'warning',
              title: 'Abonelik Yaklaşıyor',
              message: `${sub.username} kullanıcısının lisans süresinin dolmasına ${diffDays} gün kaldı.`,
              time: `${diffDays} Gün`,
              link: '/subscriptions'
            })
          })
        }

        setNotifications(alerts)
      } catch (error) {
        console.error("Bildirimler çekilemedi", error)
      }
    }
    
    fetchAlerts()
  }, [pathname]) // Sayfa her değiştiğinde bildirimleri tazele

  // Panel dışına tıklayınca kapatma
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const formattedDate = new Intl.DateTimeFormat('tr-TR', { 
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' 
  }).format(new Date())

  return (
    <div className="h-16 bg-[#0a0f1d] border-b border-slate-800/80 flex items-center justify-between px-6 shrink-0 z-40 sticky top-0">
      
      {/* SOL: Sayfa Başlığı ve Tarih */}
      <div className="flex flex-col">
        <h2 className="text-white font-bold text-sm tracking-wide">{pageTitle}</h2>
        <span className="text-[10px] text-slate-500 font-medium">{formattedDate}</span>
      </div>

      {/* SAĞ: Kurlar, Arama, Bildirim ve Profil */}
      <div className="flex items-center gap-5">
        
        {/* CANLI DÖVİZ KURLARI */}
        <div className="hidden md:flex items-center gap-3 bg-[#0d1322] border border-slate-800 px-3 py-1.5 rounded-lg shadow-inner">
          {isLoadingRates ? (
            <span className="text-xs text-slate-500 font-mono animate-pulse">Kurlar yükleniyor...</span>
          ) : (
            <>
              <div className="flex items-center gap-1.5 border-r border-slate-700 pr-3">
                <div className="bg-emerald-500/20 p-1 rounded text-emerald-400">
                  <DollarSign size={12} strokeWidth={3} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-500 font-bold leading-none mb-0.5">USD/TRY</span>
                  <span className="text-xs text-slate-200 font-mono font-bold leading-none">{rates.USD.toFixed(2)} ₺</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="bg-blue-500/20 p-1 rounded text-blue-400">
                  <Euro size={12} strokeWidth={3} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-500 font-bold leading-none mb-0.5">EUR/TRY</span>
                  <span className="text-xs text-slate-200 font-mono font-bold leading-none">{rates.EUR.toFixed(2)} ₺</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="w-px h-6 bg-slate-800 hidden sm:block"></div>

        {/* BİLDİRİM VE PROFİL */}
        <div className="flex items-center gap-3 relative" ref={notifRef}>
          
          {/* BİLDİRİM ZİLİ */}
          <button 
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className={`relative p-2 transition-colors rounded-full ${isNotifOpen ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <Bell size={18} />
            {notifications.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-pink-500 rounded-full border border-[#0a0f1d] animate-pulse"></span>
            )}
          </button>

          {/* BİLDİRİM PANELİ (Açılır Menü) */}
          {isNotifOpen && (
            <div className="absolute top-12 right-0 w-80 bg-[#0f172a] border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200 z-50">
              <div className="bg-slate-900/80 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
                <h3 className="text-xs font-bold text-white flex items-center gap-2">Bildirim Merkezi <span className="bg-pink-600 text-white px-1.5 py-0.5 rounded-md text-[9px]">{notifications.length}</span></h3>
                <button onClick={() => setIsNotifOpen(false)} className="text-slate-400 hover:text-white transition"><X size={14}/></button>
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
          
          {/* KULLANICI PROFİLİ */}
          <div className="flex items-center gap-2 cursor-pointer group ml-2">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-lg group-hover:bg-indigo-500 transition-colors">
              ED
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-xs text-white font-bold leading-none mb-1 group-hover:text-indigo-300 transition-colors">Erdoğan Durmaz</span>
              <span className="text-[9px] text-slate-500 font-medium leading-none">Yönetici</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
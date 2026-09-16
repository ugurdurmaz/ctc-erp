'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CreditCard, Landmark, Wallet, ArrowUpRight, ArrowDownLeft, Package, Receipt, Building2, Briefcase, Key, History, PieChart, Store, ChevronLeft, ChevronRight } from 'lucide-react'

const menuItems = [
  { label: 'Genel Durum', href: '/', icon: LayoutDashboard },
  { label: 'Mağaza Satış (POS)', href: '/retail', icon: Store },
  { label: 'Nakit Kasa', href: '/cash-registers', icon: Wallet },
  { label: 'Banka Hesapları', href: '/bank-accounts', icon: Landmark },
  { label: 'Kredi Kartları', href: '/credit-cards', icon: CreditCard },
  { label: 'Stok Yönetimi', href: '/stocks', icon: Package },
  { label: 'Hizmet Yönetimi', href: '/services', icon: Briefcase },
  { label: 'Satıcılar (Borç)', href: '/suppliers', icon: ArrowDownLeft },
  { label: 'Müşteriler (Alacak)', href: '/customers', icon: ArrowUpRight },
  { label: 'Genel Giderler', href: '/expenses', icon: Receipt },
  { label: 'Abonelik / Kredi', href: '/subscriptions', icon: Key },
  { label: 'Raporlar (P&L)', href: '/reports', icon: PieChart },
  { label: 'Şirketler / Merkezler', href: '/companies', icon: Building2 },
]

export default function Sidebar() {
  const pathname = usePathname()
  // Menü daraltma/genişletme state'i
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    // z-50 eklenerek menünün her zaman diğer sayfa elementlerinin üstünde kalması sağlandı
    <div className={`bg-[#0a0f1d] border-r border-slate-800/80 flex flex-col h-screen shrink-0 print:hidden relative transition-all duration-300 ease-in-out z-50 ${isCollapsed ? 'w-20' : 'w-64'}`}>
      
      {/* DARALT / GENİŞLET BUTONU (Logo ile ilk menü arasına hizalandı: top-[80px]) */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? "Menüyü Genişlet" : "Menüyü Daralt"}
        className="absolute -right-3 top-[80px] bg-[#0a0f1d] border border-slate-700 text-slate-400 hover:text-white hover:border-indigo-500 rounded-full p-1.5 z-50 transition-colors shadow-lg active:scale-95"
      >
        {isCollapsed ? <ChevronRight size={14} strokeWidth={3} /> : <ChevronLeft size={14} strokeWidth={3} />}
      </button>

      {/* LOGO VE BAŞLIK */}
      <div className={`py-6 flex items-center shrink-0 overflow-hidden transition-all duration-300 ${isCollapsed ? 'px-0 justify-center' : 'px-6 gap-3'}`}>
        <div className="bg-indigo-600 text-white p-2 rounded-lg font-black text-xl leading-none shrink-0">CTC</div>
        <div className={`transition-all duration-300 whitespace-nowrap ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
          <h1 className="text-white font-black text-sm tracking-widest">MASTER LEDGER</h1>
          <p className="text-[10px] text-slate-400">Finans & Stok Yönetimi</p>
        </div>
      </div>

      {/* ANA MENÜ LİNKLERİ */}
      <nav className={`flex-1 py-2 space-y-1.5 overflow-y-auto custom-scrollbar ${isCollapsed ? 'px-3' : 'px-4'}`}>
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.label}
              href={item.href}
              title={isCollapsed ? item.label : undefined} // İşletim sistemi yerleşik ipucu baloncukları (Asla kesilmez)
              className={`relative flex items-center py-3 rounded-xl text-xs font-semibold transition-all ${
                isCollapsed ? 'justify-center px-0' : 'gap-3 px-3.5'
              } ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <Icon size={18} className="shrink-0" />
              
              <span className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* SİSTEM DENETİM GÜNLÜĞÜ */}
      <div className={`p-4 border-t border-slate-800/80 shrink-0 ${isCollapsed ? 'px-3' : 'px-4'}`}>
        <Link
          href="/activity"
          title={isCollapsed ? "İşlem Geçmişi (Log)" : undefined}
          className={`relative flex items-center py-3 rounded-xl text-xs font-semibold transition-all ${
            isCollapsed ? 'justify-center px-0' : 'gap-3 px-3.5'
          } ${
            pathname === '/activity'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/20'
              : 'text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 border border-transparent hover:border-rose-500/30'
          }`}
        >
          <History size={18} className="shrink-0" />
          
          <span className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
            İşlem Geçmişi (Log)
          </span>
        </Link>
      </div>
      
    </div>
  )
}
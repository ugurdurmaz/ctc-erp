'use client'

import React, { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { ShieldAlert, ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

// URL yolunu modül anahtarına eşle
function getModuleKeyFromPath(pathname: string): string | null {
  if (pathname === '/') return 'dashboard'
  const segment = pathname.split('/')[1]
  return segment || null
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { session, profile, loading, hasModuleAccess } = useAuth()

  const isLoginPage = pathname === '/login'

  // Oturumu olmayan kullanıcıyı /login'e yönlendir
  useEffect(() => {
    if (!loading && !session && !isLoginPage) {
      router.replace('/login')
    }
  }, [loading, session, isLoginPage, router])

  // Login sayfasında guard koruması işletme, direkt render et
  if (isLoginPage) {
    return <>{children}</>
  }

  // Yüklenme durumu: loading devam ediyorsa veya oturum var ama profil henüz yüklenmediyse bekle
  if (loading || (session && !profile)) {
    return (
      <div className="flex-1 h-screen flex flex-col items-center justify-center bg-[#070b14] text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="text-xs font-medium tracking-wide">Yetkiler Yükleniyor...</span>
      </div>
    )
  }

  // Oturum yoksa boş döner (useEffect /login'e yönlendirene kadar)
  if (!session) {
    return null
  }

  // Modül bazlı erişim denetimi (Admin her zaman tüm modüllere erişir)
  const moduleKey = getModuleKeyFromPath(pathname)
  const isAllowed = profile?.role === 'admin' 
    ? true 
    : (moduleKey ? hasModuleAccess(moduleKey) : true)

  // Yetkisiz erişim ekranı
  if (!isAllowed) {
    // Kullanıcının ilk erişebildiği rota
    const fallbackHref = profile?.role === 'cashier' 
      ? '/retail' 
      : profile?.role === 'warehouse' 
        ? '/stocks' 
        : '/'

    return (
      <div className="flex-1 h-full min-h-[500px] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-[#0b1222] border border-slate-800 rounded-3xl p-8 max-w-md shadow-2xl flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 shadow-lg shadow-rose-500/10">
            <ShieldAlert size={32} />
          </div>
          <h2 className="text-lg font-black text-white mb-2">Yetkisiz Erişim (403)</h2>
          <p className="text-xs text-slate-400 leading-relaxed mb-6">
            Bu modüle erişim yetkiniz bulunmuyor. Erişim talep etmek için lütfen sistem yöneticinize (Admin) başvurunuz.
          </p>
          <Link
            href={fallbackHref}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Yetkili Olduğunuz Sayfaya Dön</span>
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

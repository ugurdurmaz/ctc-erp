'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { AuthProvider } from '@/lib/auth-context'
import AuthGuard from './AuthGuard'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { Toaster } from 'react-hot-toast'

export default function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'

  return (
    <AuthProvider>
      <Toaster 
        position="bottom-right" 
        containerStyle={{ zIndex: 99999999 }} 
        toastOptions={{ 
          duration: 3500, 
          style: { background: '#0f172a', color: '#fff', border: '1px solid #1e293b', fontSize: '12px' } 
        }} 
      />
      {isLoginPage ? (
        <main className="w-full min-h-screen">
          {children}
        </main>
      ) : (
        <div className="flex h-screen overflow-hidden relative selection:bg-indigo-500 selection:text-white print:h-auto print:overflow-visible print:bg-white print:text-black print:block w-full">
          <Sidebar />

          <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden print:h-auto print:overflow-visible print:block print:p-0 print:m-0">
            {/* DENGELİ GLOW EFEKTİ: Baskıda gizlenir */}
            <div className="absolute top-4 left-32 w-[550px] h-[550px] bg-indigo-600/20 blur-[140px] pointer-events-none rounded-full -z-10 print:hidden"></div>
            <div className="absolute top-1/2 right-10 w-[400px] h-[400px] bg-blue-600/10 blur-[150px] pointer-events-none rounded-full -z-10 print:hidden"></div>

            {/* Canlı Kur ve Profil Barı: Baskıda gizlenir */}
            <div className="print:hidden">
              <TopBar />
            </div>

            {/* İçerik Alanı: Baskıda tam boy akar */}
            <main className="flex-1 px-4 py-2 overflow-y-auto relative custom-scrollbar print:h-auto print:overflow-visible print:p-0 print:m-0 print:block">
              <AuthGuard>
                {children}
              </AuthGuard>
            </main>
          </div>
        </div>
      )}
    </AuthProvider>
  )
}

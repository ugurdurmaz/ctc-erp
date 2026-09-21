'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Lock, Mail, Eye, EyeOff, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
  const { session, profile, signIn, loading: authLoading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Kullanıcı zaten oturum açmışsa yetkili olduğu ana sayfaya yönlendir
  useEffect(() => {
    if (!authLoading && session) {
      if (profile?.role === 'cashier') {
        router.replace('/retail')
      } else if (profile?.role === 'warehouse') {
        router.replace('/stocks')
      } else {
        router.replace('/')
      }
    }
  }, [authLoading, session, profile, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email.trim()) {
      setErrorMessage('Lütfen e-posta adresinizi girin.')
      return
    }
    if (!password) {
      setErrorMessage('Lütfen şifrenizi girin.')
      return
    }

    setLoading(true)
    try {
      const res = await signIn(email, password)
      if (!res.success) {
        let msg = res.error || 'Giriş başarısız oldu.'
        if (msg.includes('Invalid login credentials')) {
          msg = 'E-posta veya şifre hatalı. Lütfen kontrol ediniz.'
        } else if (msg.includes('Email not confirmed')) {
          msg = 'E-posta adresi henüz doğrulanmamış.'
        }
        setErrorMessage(msg)
        toast.error(msg)
      } else {
        toast.success('Giriş başarılı! Yönlendiriliyorsunuz...')
        // Yönlendirme useEffect tarafından profile göre yapılacak
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Beklenmeyen bir hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#070b14] flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* ARKA PLAN DENGELİ GLOW IŞIKLARI */}
      <div className="absolute top-1/4 -left-32 w-[550px] h-[550px] bg-indigo-600/20 blur-[150px] pointer-events-none rounded-full"></div>
      <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] bg-blue-600/15 blur-[150px] pointer-events-none rounded-full"></div>

      {/* GİRİŞ KARTI */}
      <div className="w-full max-w-md relative z-10">
        <div className="bg-[#0b1222]/90 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-8 shadow-2xl shadow-black/80">
          
          {/* LOGO VE BAŞLIK */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white font-black text-2xl shadow-lg shadow-indigo-600/30 mb-4 ring-1 ring-indigo-400/30">
              CTC
            </div>
            <h1 className="text-xl font-black tracking-wider text-white">MASTER LEDGER</h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">Finans, Stok & Perakende POS Yönetimi</p>
          </div>

          {/* HATA ROZETİ */}
          {errorMessage && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-0.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 block"></span>
              </div>
              <span className="leading-relaxed font-medium">{errorMessage}</span>
            </div>
          )}

          {/* FORM */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                E-posta Adresi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@ctc-erp.local"
                  required
                  autoFocus
                  disabled={loading}
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                Şifre
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock size={16} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="w-full pl-10 pr-11 py-3 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 py-3.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Giriş Yapılıyor...</span>
                </>
              ) : (
                <>
                  <span>Giriş Yap</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* GÜVENLİK BİLGİSİ */}
          <div className="mt-8 pt-6 border-t border-slate-800/80 flex items-center justify-center gap-2 text-slate-500 text-[11px]">
            <ShieldCheck size={14} className="text-indigo-400" />
            <span>256-Bit SSL Şifreli Güvenli Giriş</span>
          </div>

        </div>

        {/* TELİF VE SÜRÜM */}
        <p className="text-center text-[10px] text-slate-600 mt-6">
          CTC Master Ledger ERP • © 2026 Tüm Hakları Saklıdır
        </p>
      </div>
    </div>
  )
}

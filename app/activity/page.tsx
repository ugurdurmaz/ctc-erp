'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/lib/utils'
import toast, { Toaster } from 'react-hot-toast'
import { History, Undo2, Search, Filter, ShieldAlert, Trash2, Edit3, PlusCircle, ArrowRightLeft, Check, ChevronDown, User, X } from 'lucide-react'

type AuditLog = {
  id: string; module: string; action: string; description: string;
  record_id: string; amount: number; currency: string;
  old_data: any; new_data: any; company_id: string; created_at: string;
}

type UserProfileSummary = {
  id: string; email: string; full_name: string; role: string;
}

const MODULE_OPTIONS = [
  { id: 'retail', label: 'Mağaza / Kasa (POS)' },
  { id: 'technical-service', label: 'Teknik Servis' },
  { id: 'stock', label: 'Stok Kartları' },
  { id: 'stock_category', label: 'Stok Kategorileri' },
  { id: 'stock_tx', label: 'Stok Hareketleri' },
  { id: 'cash', label: 'Nakit Kasalar' },
  { id: 'bank', label: 'Banka Hesapları' },
  { id: 'customer', label: 'Müşteri / Cari' },
  { id: 'supplier', label: 'Tedarikçi' },
  { id: 'subscription', label: 'Abonelik / Kredi' },
  { id: 'expense', label: 'Giderler' },
  { id: 'company', label: 'Şirketler' },
  { id: 'service', label: 'Hizmetler' },
]

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [profiles, setProfiles] = useState<UserProfileSummary[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const userDropdownRef = useRef<HTMLDivElement>(null)

  // Dışarı tıklandığında dropdown'ları kapat
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean; title: string; message: string; logData: AuditLog | null;
  }>({ isOpen: false, title: '', message: '', logData: null })

  useEffect(() => { fetchLogs() }, [])

  async function fetchLogs() {
    try {
      const [logsRes, profRes] = await Promise.all([
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('user_profiles').select('id, email, full_name, role')
      ])
      if (logsRes.error) throw logsRes.error
      setLogs(logsRes.data || [])
      if (profRes.data) setProfiles(profRes.data)
    } catch (err: any) {
      toast.error('Kayıtlar çekilemedi: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function getUserInfo(log: AuditLog): { name: string; email?: string; roleLabel?: string; role?: string } {
    const userObj = log.new_data?._user || log.old_data?._user
    if (userObj?.full_name) {
      const roleLabel = userObj.role === 'admin' ? 'Yönetici' : userObj.role === 'cashier' ? 'Kasiyer' : userObj.role || ''
      return {
        name: userObj.full_name,
        email: userObj.email || '',
        roleLabel,
        role: userObj.role || ''
      }
    }

    const userId = log.new_data?.user_id || log.old_data?.user_id
    if (userId) {
      const matched = profiles.find(p => p.id === userId)
      if (matched) {
        const roleLabel = matched.role === 'admin' ? 'Yönetici' : matched.role === 'cashier' ? 'Kasiyer' : matched.role
        return { name: matched.full_name, email: matched.email, roleLabel, role: matched.role }
      }
    }

    return { name: 'Sistem / Yönetici', email: '', roleLabel: '', role: 'system' }
  }

  function getActionColors(action: string) {
    if (action === 'INSERT') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    if (action === 'UPDATE') return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
    if (action === 'DELETE') return 'bg-rose-500/10 text-rose-400 border-rose-500/30'
    if (action === 'ROLLBACK') return 'bg-purple-500/10 text-purple-400 border-purple-500/30'
    return 'bg-slate-500/10 text-slate-400 border-slate-500/30'
  }

  function getActionIcon(action: string) {
    if (action === 'INSERT') return <PlusCircle size={11} />
    if (action === 'UPDATE') return <Edit3 size={11} />
    if (action === 'DELETE') return <Trash2 size={11} />
    if (action === 'ROLLBACK') return <Undo2 size={11} />
    return <ArrowRightLeft size={11} />
  }

  function confirmRollback(log: AuditLog) {
    if (log.action === 'ROLLBACK') {
      toast.error('Bu işlem zaten bir geri alma işlemi.')
      return
    }
    
    setConfirmDialog({
      isOpen: true,
      title: 'İşlemi Geri Al (Rollback)',
      message: `"${log.description}" işlemi tersine çevrilecek. Kasa, cari ve stok gibi bağlı kayıtlar bu işlemin yapıldığı saniyeden önceki haline döndürülecektir. Onaylıyor musunuz?`,
      logData: log
    })
  }

  async function executeRollback() {
    const log = confirmDialog.logData
    setConfirmDialog({ isOpen: false, title: '', message: '', logData: null })
    if (!log) return

    const toastId = toast.loading('İşlem geri alınıyor, veriler dengeleniyor...')
    
    try {
      await supabase.from('audit_logs').insert([{
        module: log.module,
        action: 'ROLLBACK',
        description: `GERİ ALINDI: ${log.description}`,
        record_id: log.record_id,
        amount: log.amount,
        currency: log.currency,
        old_data: log.new_data,
        new_data: log.old_data
      }])

      toast.success('İşlem başarıyla geri alındı ve hesaplar dengelendi!', { id: toastId })
      fetchLogs()
    } catch (err: any) {
      toast.error('Geri alma başarısız: ' + err.message, { id: toastId })
    }
  }

  function toggleModule(modId: string) {
    setSelectedModules(prev => 
      prev.includes(modId) ? prev.filter(m => m !== modId) : [...prev, modId]
    )
  }

  const filteredLogs = logs.filter(l => {
    const user = getUserInfo(l)
    const searchLower = searchTerm.toLowerCase().trim()
    const matchSearch = !searchLower || 
      l.description.toLowerCase().includes(searchLower) || 
      l.module.toLowerCase().includes(searchLower) ||
      user.name.toLowerCase().includes(searchLower) ||
      (user.email && user.email.toLowerCase().includes(searchLower))

    const matchModule = selectedModules.length === 0 || selectedModules.includes(l.module)

    const matchUser = selectedUser === 'all' || 
      user.name.toLowerCase() === selectedUser.toLowerCase() || 
      user.email?.toLowerCase() === selectedUser.toLowerCase()

    return matchSearch && matchModule && matchUser
  })

  return (
    <div className="flex flex-col h-[calc(100vh-32px)] relative max-w-[1600px] mx-auto">
      <Toaster position="bottom-right" containerStyle={{ zIndex: 99999999 }} toastOptions={{ style: { background: '#0f172a', color: '#fff', border: '1px solid #1e293b', fontSize: '12px' } }} />

      {/* ÜST BAR (Kompakt) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2.5 bg-[#0d1322] border border-slate-800/80 px-4 py-2.5 rounded-xl shadow-md shrink-0 mb-2 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-indigo-500/5 to-transparent pointer-events-none" />
        
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20 shrink-0">
            <History size={18} />
          </div>
          <div>
            <h1 className="text-sm lg:text-base font-bold text-white flex items-center gap-2 leading-none">
              Sistem Denetim Günlüğü
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                {filteredLogs.length} Kayıt
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 mt-1">Sistemdeki tüm hareketlerin kullanıcı, tutar ve zaman kayıtları.</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg text-indigo-300 text-[10px]">
          <ShieldAlert size={13} className="text-indigo-400 shrink-0" />
          <span>Şeffaf denetim ve anlık geri alma (rollback) günlüğü</span>
        </div>
      </div>

      {/* ARAMA VE ÇOKLU SEÇİMLİ FİLTRELEME (Kompakt) */}
      <div className="flex flex-wrap items-center gap-2 mb-2 shrink-0">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text" 
            placeholder="İşlem açıklaması, kullanıcı veya modül ara..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full bg-[#0d1322] border border-slate-800/80 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-all shadow-sm" 
          />
          {searchTerm && (
            <button 
              type="button" 
              onClick={() => setSearchTerm('')} 
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* KULLANICI SEÇİM DROPDOWN */}
        <div className="relative" ref={userDropdownRef}>
          <button 
            type="button"
            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            className="flex items-center gap-1.5 bg-[#0d1322] border border-slate-800/80 hover:border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <User size={13} className="text-emerald-400" />
            <span className="truncate max-w-[130px]">
              {selectedUser === 'all' 
                ? 'Tüm Kullanıcılar' 
                : profiles.find(p => p.full_name === selectedUser || p.email === selectedUser)?.full_name || selectedUser}
            </span>
            <ChevronDown size={13} className="text-slate-500 ml-0.5" />
          </button>

          {isUserDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-[#0f172a] border border-slate-800 rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div 
                onClick={() => { setSelectedUser('all'); setIsUserDropdownOpen(false); }}
                className="flex items-center justify-between px-3 py-1.5 hover:bg-slate-800/50 cursor-pointer text-slate-300 text-xs border-b border-slate-800/80 mb-1"
              >
                <span className="font-bold">Tüm Kullanıcılar</span>
                {selectedUser === 'all' && <Check size={13} className="text-emerald-400" />}
              </div>

              {profiles.map((p) => {
                const isSelected = selectedUser === p.full_name || selectedUser === p.email
                return (
                  <div 
                    key={p.id}
                    onClick={() => { setSelectedUser(p.full_name); setIsUserDropdownOpen(false); }}
                    className="flex items-center justify-between px-3 py-1.5 hover:bg-slate-800/50 cursor-pointer text-slate-300 text-xs transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-200">{p.full_name}</span>
                      <span className="text-[9px] text-slate-500 font-mono">{p.email} • {p.role === 'admin' ? 'Yönetici' : 'Kasiyer'}</span>
                    </div>
                    {isSelected && <Check size={13} className="text-emerald-400 shrink-0" />}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        
        {/* MODÜL MULTI-SELECT DROPDOWN */}
        <div className="relative" ref={dropdownRef}>
          <button 
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1.5 bg-[#0d1322] border border-slate-800/80 hover:border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <Filter size={13} className="text-indigo-400" />
            <span>
              {selectedModules.length === 0 
                ? 'Tüm Modüller' 
                : `${selectedModules.length} Modül`}
            </span>
            <ChevronDown size={13} className="text-slate-500 ml-0.5" />
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full right-0 mt-1 w-56 bg-[#0f172a] border border-slate-800 rounded-xl shadow-2xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 max-h-72 overflow-y-auto custom-scrollbar">
              <div 
                onClick={() => setSelectedModules([])}
                className="flex items-center justify-between px-3 py-1.5 hover:bg-slate-800/50 cursor-pointer text-slate-300 text-xs border-b border-slate-800/80 mb-1"
              >
                <span className="font-bold">Tümünü Göster</span>
                {selectedModules.length === 0 && <Check size={13} className="text-indigo-400" />}
              </div>

              {MODULE_OPTIONS.map((mod) => {
                const isSelected = selectedModules.includes(mod.id)
                return (
                  <div 
                    key={mod.id}
                    onClick={() => toggleModule(mod.id)}
                    className="flex items-center justify-between px-3 py-1.5 hover:bg-slate-800/50 cursor-pointer text-slate-300 text-xs transition-colors"
                  >
                    <span>{mod.label}</span>
                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700 bg-[#070b14]'}`}>
                      {isSelected && <Check size={9} />}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* FİLTRE TEMİZLE BUTONU (Eğer aktif filtre varsa) */}
        {(searchTerm || selectedModules.length > 0 || selectedUser !== 'all') && (
          <button 
            type="button"
            onClick={() => { setSearchTerm(''); setSelectedModules([]); setSelectedUser('all'); }}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-400 px-2.5 py-1.5 rounded-lg bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/50 transition-colors cursor-pointer"
            title="Filtreleri Sıfırla"
          >
            <X size={12} />
            <span>Filtreleri Temizle</span>
          </button>
        )}
      </div>

      {/* LİSTE KONTEYNERİ (Yüksek Yoğunluklu / Kompakt Tablo Tasarımı) */}
      <div className="flex-1 bg-[#0d1322] border border-slate-800/80 rounded-xl flex flex-col min-w-0 overflow-hidden shadow-xl relative">
        
        {/* MASAÜSTÜ TABLO BAŞLIĞI */}
        <div className="hidden lg:flex items-center justify-between gap-2.5 px-3 py-1.5 bg-[#090e1a] border-b border-slate-800/80 text-[10px] font-bold uppercase tracking-wider text-slate-400 select-none shrink-0">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <span className="w-16 shrink-0 text-center">İşlem</span>
            <span className="flex-1">Açıklama</span>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="w-24 text-center">Modül</span>
            <span className="w-36">Kullanıcı</span>
            <span className="w-32">Tarih & Saat</span>
            <span className="w-20 text-right">Tutar</span>
            <span className="w-20 text-right">Aksiyon</span>
          </div>
        </div>

        {/* LİSTE SATIRLARI */}
        <div className="overflow-y-auto flex-1 custom-scrollbar divide-y divide-slate-800/50">
          {loading ? (
             <div className="flex justify-center items-center h-40 text-slate-500 text-xs font-mono animate-pulse">Günlükler yükleniyor...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-slate-500 opacity-60">
              <History size={36} className="mb-2 opacity-30" />
              <p className="text-xs font-bold text-slate-400">Gösterilecek kayıt bulunamadı.</p>
              <p className="text-[10px] mt-1">Henüz bir işlem yapılmamış veya arama/filtre kriterinize uygun sonuç yok.</p>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isRollback = log.action === 'ROLLBACK'
              const user = getUserInfo(log)

              return (
                <div 
                  key={log.id} 
                  className={`group flex flex-col lg:flex-row lg:items-center justify-between gap-1.5 lg:gap-2.5 px-3 py-1.5 transition-colors ${
                    isRollback 
                      ? 'bg-purple-950/15 hover:bg-purple-950/25 text-purple-300' 
                      : 'hover:bg-slate-800/40'
                  }`}
                >
                  
                  {/* SOL: İŞLEM TÜRÜ VE AÇIKLAMA */}
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    {/* AKSİYON ROZETİ */}
                    <div className="w-16 shrink-0">
                      <span className={`inline-flex items-center justify-center gap-1 w-full py-0.5 rounded border text-[9px] font-bold tracking-wider uppercase font-mono ${getActionColors(log.action)}`}>
                        {getActionIcon(log.action)}
                        <span>{log.action}</span>
                      </span>
                    </div>

                    {/* AÇIKLAMA */}
                    <span 
                      className={`text-xs font-semibold truncate ${isRollback ? 'text-purple-300' : 'text-slate-200 group-hover:text-white transition-colors'}`}
                      title={log.description}
                    >
                      {log.description}
                    </span>
                  </div>

                  {/* SAĞ: MODÜL, KULLANICI, TARİH, TUTAR, AKSİYON */}
                  <div className="flex items-center justify-between lg:justify-end gap-2.5 shrink-0 pl-7 lg:pl-0">
                    {/* MODÜL */}
                    <div className="w-24 text-center shrink-0">
                      <span className="inline-block px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-indigo-300 font-semibold truncate max-w-full">
                        {log.module}
                      </span>
                    </div>

                    {/* KULLANICI */}
                    <div className="w-36 shrink-0">
                      <div 
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/70 border border-slate-700/60 text-slate-200 text-[10px] truncate" 
                        title={user.email ? `${user.name} (${user.email})` : user.name}
                      >
                        <User size={10} className={`shrink-0 ${user.role === 'admin' ? 'text-amber-400' : 'text-emerald-400'}`} />
                        <span className="font-medium truncate">{user.name}</span>
                        {user.roleLabel && (
                          <span className="text-[8px] px-1 py-0.2 rounded bg-slate-700/80 text-slate-400 font-mono shrink-0 ml-auto">
                            {user.roleLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* TARİH & SAAT */}
                    <div className="w-32 shrink-0 text-slate-400 font-mono text-[10px]">
                      {new Date(log.created_at).toLocaleString('tr-TR')}
                    </div>

                    {/* TUTAR */}
                    <div className="w-20 text-right shrink-0 font-mono">
                      {log.amount > 0 ? (
                        <span className="text-xs font-bold text-slate-200">
                          {formatMoney(log.amount, log.currency).formatted}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">-</span>
                      )}
                    </div>

                    {/* GERİ AL BUTONU */}
                    <div className="w-20 flex justify-end shrink-0">
                      <button 
                        onClick={() => confirmRollback(log)}
                        disabled={isRollback}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                          isRollback 
                            ? 'bg-slate-800/30 text-slate-600 cursor-not-allowed border border-transparent' 
                            : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 active:scale-95 shadow-sm'
                        }`}
                        title={isRollback ? 'Zaten geri alınmış' : 'İşlemi geri al'}
                      >
                        <Undo2 size={11} /> Geri Al
                      </button>
                    </div>
                  </div>

                </div>
              )
            })
          )}
        </div>
      </div>


      {/* --- ÖZEL ONAY MODALI --- */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" style={{ zIndex: 9999 }}>
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-center">
            <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full mb-5 bg-rose-500/10 text-rose-400">
              <Undo2 size={28} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">{confirmDialog.title}</h3>
            <p className="text-[11px] text-slate-400 mb-6 leading-relaxed px-2">{confirmDialog.message}</p>
            <div className="flex gap-3 w-full">
              <button onClick={() => setConfirmDialog({ isOpen: false, title: '', message: '', logData: null })} className="flex-1 px-4 py-2.5 rounded-xl text-slate-300 bg-slate-800 hover:bg-slate-700 font-medium transition-colors text-xs">
                İptal Et
              </button>
              <button onClick={executeRollback} className="flex-1 px-4 py-2.5 rounded-xl text-white font-bold transition-all active:scale-95 text-xs shadow-lg bg-rose-600 hover:bg-rose-700 shadow-rose-900/20">
                Evet, Geri Al
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
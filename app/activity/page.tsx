'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/lib/utils'
import toast, { Toaster } from 'react-hot-toast'
import { History, Undo2, Search, Filter, ShieldAlert, Trash2, Edit3, PlusCircle, ArrowRightLeft, Check, ChevronDown, User } from 'lucide-react'

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
    if (action === 'INSERT') return <PlusCircle size={14} />
    if (action === 'UPDATE') return <Edit3 size={14} />
    if (action === 'DELETE') return <Trash2 size={14} />
    if (action === 'ROLLBACK') return <Undo2 size={14} />
    return <ArrowRightLeft size={14} />
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

      {/* ÜST BAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0d1322] border border-slate-800/80 p-5 rounded-2xl shadow-xl shrink-0 mb-4 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-indigo-500/5 to-transparent pointer-events-none" />
        
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl shadow-inner border border-indigo-500/20">
            <History size={24} />
          </div>
          <div>
            <h1 className="text-lg lg:text-xl font-black text-white flex items-center gap-2">Sistem Denetim Günlüğü</h1>
            <p className="text-[11px] text-slate-400 mt-1">Sistemdeki tüm hareketlerin, hangi kullanıcı tarafından ne zaman yapıldığının kayıtları.</p>
          </div>
        </div>

        <div className="bg-indigo-500/10 border border-indigo-500/20 px-4 py-2.5 rounded-xl flex items-center gap-2 max-w-sm">
          <ShieldAlert size={16} className="text-indigo-400 shrink-0" />
          <p className="text-[10px] text-indigo-300 leading-relaxed font-medium">Bu ekran sistemin denetim günlüğüdür. Hangi kullanıcının hangi işlemi yaptığı şeffafça izlenir.</p>
        </div>
      </div>

      {/* ARAMA VE ÇOKLU SEÇİMLİ FİLTRELEME */}
      <div className="flex flex-wrap items-center gap-3 mb-4 shrink-0">
        <div className="relative w-full max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text" 
            placeholder="İşlem açıklaması, kullanıcı veya modül ara..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="w-full bg-[#0d1322] border border-slate-800/80 rounded-xl pl-9 pr-3 py-2.5 text-[11px] text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-all shadow-sm" 
          />
        </div>

        {/* KULLANICI SEÇİM DROPDOWN */}
        <div className="relative" ref={userDropdownRef}>
          <button 
            type="button"
            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            className="flex items-center gap-2 bg-[#0d1322] border border-slate-800/80 hover:border-slate-700 text-slate-300 rounded-xl px-4 py-2.5 text-[11px] font-bold shadow-sm transition-all cursor-pointer"
          >
            <User size={14} className="text-emerald-400" />
            <span>
              {selectedUser === 'all' 
                ? 'Tüm Kullanıcılar' 
                : profiles.find(p => p.full_name === selectedUser || p.email === selectedUser)?.full_name || selectedUser}
            </span>
            <ChevronDown size={14} className="text-slate-500 ml-1" />
          </button>

          {isUserDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-[#0f172a] border border-slate-800 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div 
                onClick={() => { setSelectedUser('all'); setIsUserDropdownOpen(false); }}
                className="flex items-center justify-between px-3.5 py-2 hover:bg-slate-800/50 cursor-pointer text-slate-300 text-[11px] border-b border-slate-800/80 mb-1"
              >
                <span className="font-bold">Tüm Kullanıcılar</span>
                {selectedUser === 'all' && <Check size={14} className="text-emerald-400" />}
              </div>

              {profiles.map((p) => {
                const isSelected = selectedUser === p.full_name || selectedUser === p.email
                return (
                  <div 
                    key={p.id}
                    onClick={() => { setSelectedUser(p.full_name); setIsUserDropdownOpen(false); }}
                    className="flex items-center justify-between px-3.5 py-2 hover:bg-slate-800/50 cursor-pointer text-slate-300 text-[11px] transition-colors"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-200">{p.full_name}</span>
                      <span className="text-[9px] text-slate-500 font-mono">{p.email} • {p.role === 'admin' ? 'Yönetici' : 'Kasiyer'}</span>
                    </div>
                    {isSelected && <Check size={14} className="text-emerald-400 shrink-0" />}
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
            className="flex items-center gap-2 bg-[#0d1322] border border-slate-800/80 hover:border-slate-700 text-slate-300 rounded-xl px-4 py-2.5 text-[11px] font-bold shadow-sm transition-all cursor-pointer"
          >
            <Filter size={14} className="text-indigo-400" />
            <span>
              {selectedModules.length === 0 
                ? 'Tüm Modüller' 
                : `${selectedModules.length} Modül Seçildi`}
            </span>
            <ChevronDown size={14} className="text-slate-500 ml-1" />
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full right-0 mt-2 w-60 bg-[#0f172a] border border-slate-800 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150 max-h-72 overflow-y-auto custom-scrollbar">
              <div 
                onClick={() => setSelectedModules([])}
                className="flex items-center justify-between px-3.5 py-2 hover:bg-slate-800/50 cursor-pointer text-slate-300 text-[11px] border-b border-slate-800/80 mb-1"
              >
                <span className="font-bold">Tümünü Göster</span>
                {selectedModules.length === 0 && <Check size={14} className="text-indigo-400" />}
              </div>

              {MODULE_OPTIONS.map((mod) => {
                const isSelected = selectedModules.includes(mod.id)
                return (
                  <div 
                    key={mod.id}
                    onClick={() => toggleModule(mod.id)}
                    className="flex items-center justify-between px-3.5 py-2 hover:bg-slate-800/50 cursor-pointer text-slate-300 text-[11px] transition-colors"
                  >
                    <span>{mod.label}</span>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700 bg-[#070b14]'}`}>
                      {isSelected && <Check size={10} />}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* LİSTE */}
      <div className="flex-1 bg-[#0d1322] border border-slate-800/80 rounded-2xl flex flex-col min-w-0 overflow-hidden shadow-xl relative">
        <div className="overflow-y-auto flex-1 custom-scrollbar p-3">
          {loading ? (
             <div className="flex justify-center items-center h-40 text-slate-500 text-xs font-mono animate-pulse">Günlükler yükleniyor...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-60">
              <History size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-bold text-slate-400">Gösterilecek kayıt bulunamadı.</p>
              <p className="text-[11px] mt-1">Henüz bir işlem yapılmamış veya arama/filtre kriterinize uygun sonuç yok.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => {
                const isRollback = log.action === 'ROLLBACK'
                const user = getUserInfo(log)

                return (
                  <div key={log.id} className={`flex flex-col lg:flex-row justify-between lg:items-center p-3.5 rounded-xl border transition-colors ${isRollback ? 'bg-[#0f172a]/50 border-purple-500/20' : 'bg-[#070b14] border-slate-800/50 hover:border-slate-700'}`}>
                    
                    <div className="flex items-start gap-4 flex-1 min-w-0 pr-4">
                      <div className={`mt-0.5 px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 text-[10px] font-bold tracking-widest shrink-0 ${getActionColors(log.action)}`}>
                        {getActionIcon(log.action)} {log.action}
                      </div>
                      
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className={`text-sm font-bold truncate ${isRollback ? 'text-purple-400' : 'text-slate-200'}`}>{log.description}</span>
                        <div className="flex flex-wrap items-center gap-2.5 mt-2 text-[10px] font-mono">
                          <span className="text-slate-400">{new Date(log.created_at).toLocaleString('tr-TR')}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                          <span className="uppercase tracking-wider text-slate-500">Modül: <span className="text-indigo-400 font-semibold">{log.module}</span></span>
                          <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                          
                          {/* KULLANICI ROZETİ */}
                          <div 
                            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-slate-800/90 border border-slate-700/80 text-slate-200" 
                            title={user.email ? `${user.name} (${user.email})` : user.name}
                          >
                            <User size={11} className={user.role === 'admin' ? 'text-amber-400' : 'text-emerald-400'} />
                            <span className="font-sans font-medium text-slate-200">{user.name}</span>
                            {user.roleLabel && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-slate-700 text-slate-400 font-mono">
                                {user.roleLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between lg:justify-end gap-5 mt-4 lg:mt-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-800 shrink-0">
                      {log.amount > 0 && (
                        <div className="text-right font-mono">
                          <div className="text-xs text-slate-400">İşlem Tutarı</div>
                          <div className="text-sm font-bold text-slate-200">{formatMoney(log.amount, log.currency).formatted}</div>
                        </div>
                      )}
                      
                      <button 
                        onClick={() => confirmRollback(log)}
                        disabled={isRollback}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isRollback ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed border border-transparent' : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 active:scale-95 shadow-sm'}`}
                      >
                        <Undo2 size={14} /> Geri Al
                      </button>
                    </div>

                  </div>
                )
              })}
            </div>
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
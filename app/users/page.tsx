'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { UserProfile, UserRole, SYSTEM_MODULES, ROLE_DEFAULT_MODULES, ROLE_LABELS, ModuleKey } from '@/types/auth'
import { 
  Users, UserPlus, Shield, Key, Edit2, Trash2, CheckCircle2, 
  XCircle, Search, AlertCircle, Info, Lock, Building2, Eye, EyeOff, Loader2, X, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'

export default function UsersPage() {
  const { user: currentUser } = useAuth()

  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // Modal State'leri
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form State'leri
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<UserRole>('cashier')
  const [allowedModules, setAllowedModules] = useState<string[]>(ROLE_DEFAULT_MODULES.cashier)
  const [allCompaniesAccess, setAllCompaniesAccess] = useState(true)
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([])
  const [isActive, setIsActive] = useState(true)

  // 1. Verileri Çek
  const loadData = React.useCallback(async () => {
    setLoading(true)
    try {
      // Profilleri çek
      const { data: profData, error: profErr } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (profErr) {
        console.error('Profiller yüklenemedi:', profErr)
        toast.error('Kullanıcı listesi yüklenemedi.')
      } else {
        setProfiles((profData as UserProfile[]) || [])
      }

      // Şirketleri çek
      const { data: compData } = await supabase.from('companies').select('id, name')
      if (compData) {
        setCompanies(compData)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Rol değiştiğinde varsayılan modülleri ata
  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole)
    if (newRole !== 'custom') {
      setAllowedModules(ROLE_DEFAULT_MODULES[newRole] || [])
    }
  }

  // Modül seçim toggle
  const toggleModule = (modKey: string) => {
    if (allowedModules.includes(modKey)) {
      setAllowedModules(allowedModules.filter(k => k !== modKey))
    } else {
      setAllowedModules([...allowedModules, modKey])
    }
  }

  // Şirket seçim toggle
  const toggleCompany = (compId: string) => {
    if (selectedCompanyIds.includes(compId)) {
      setSelectedCompanyIds(selectedCompanyIds.filter(id => id !== compId))
    } else {
      setSelectedCompanyIds([...selectedCompanyIds, compId])
    }
  }

  // Modal Açma Yardımcıları
  const openCreateModal = () => {
    setFullName('')
    setEmail('')
    setPassword('')
    setRole('cashier')
    setAllowedModules(ROLE_DEFAULT_MODULES.cashier)
    setAllCompaniesAccess(true)
    setSelectedCompanyIds([])
    setIsActive(true)
    setIsCreateModalOpen(true)
  }

  const openEditModal = (user: UserProfile) => {
    setSelectedUser(user)
    setFullName(user.full_name)
    setEmail(user.email)
    setRole(user.role)
    setAllowedModules(user.allowed_modules || [])
    setAllCompaniesAccess(!user.allowed_companies || user.allowed_companies.length === 0)
    setSelectedCompanyIds(user.allowed_companies || [])
    setIsActive(user.is_active)
    setIsEditModalOpen(true)
  }

  const openPasswordModal = (user: UserProfile) => {
    setSelectedUser(user)
    setPassword('')
    setIsPasswordModalOpen(true)
  }

  // Yeni Kullanıcı Oluştur (POST /api/admin/users)
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      toast.error('Lütfen tüm zorunlu alanları doldurunuz.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          password: password.trim(),
          role,
          allowed_modules: allowedModules,
          allowed_companies: allCompaniesAccess ? null : selectedCompanyIds,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Kullanıcı oluşturulamadı.')
      } else {
        toast.success(`${fullName} başarıyla eklendi!`)
        setIsCreateModalOpen(false)
        loadData()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bir hata oluştu.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Kullanıcı Güncelle (PATCH /api/admin/users)
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          full_name: fullName.trim(),
          role,
          allowed_modules: allowedModules,
          allowed_companies: allCompaniesAccess ? null : selectedCompanyIds,
          is_active: isActive,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Güncelleme başarısız oldu.')
      } else {
        toast.success('Kullanıcı yetkileri güncellendi!')
        setIsEditModalOpen(false)
        loadData()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bir hata oluştu.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Şifre Güncelle (PATCH /api/admin/users)
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser || !password.trim()) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          password: password.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Şifre güncellenemedi.')
      } else {
        toast.success(`${selectedUser.full_name} için şifre güncellendi!`)
        setIsPasswordModalOpen(false)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bir hata oluştu.'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Aktif / Pasif Toggle
  const toggleUserActive = async (user: UserProfile) => {
    if (user.id === currentUser?.id) {
      toast.error('Kendi hesabınızı pasife alamazsınız.')
      return
    }

    try {
      const newStatus = !user.is_active
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          is_active: newStatus,
        }),
      })

      if (res.ok) {
        toast.success(newStatus ? 'Kullanıcı aktif edildi.' : 'Kullanıcı pasife alındı.')
        setProfiles(profiles.map(p => p.id === user.id ? { ...p, is_active: newStatus } : p))
      } else {
        const data = await res.json()
        toast.error(data.error || 'Durum değiştirilemedi.')
      }
    } catch {
      toast.error('İşlem başarısız oldu.')
    }
  }

  // Kullanıcı Sil
  const handleDeleteUser = async (user: UserProfile) => {
    if (user.id === currentUser?.id) {
      toast.error('Kendi yönetici hesabınızı silemezsiniz.')
      return
    }

    if (!confirm(`${user.full_name} kullanıcısını sistemden tamamen silmek istediğinize emin misiniz?`)) {
      return
    }

    try {
      const res = await fetch(`/api/admin/users?userId=${user.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success('Kullanıcı silindi.')
        setProfiles(profiles.filter(p => p.id !== user.id))
      } else {
        const data = await res.json()
        toast.error(data.error || 'Silme işlemi başarısız.')
      }
    } catch {
      toast.error('Silme sırasında hata oluştu.')
    }
  }

  // Filtreleme
  const filteredProfiles = profiles.filter(p => {
    const q = searchQuery.toLocaleLowerCase('tr-TR')
    return (
      p.full_name.toLocaleLowerCase('tr-TR').includes(q) ||
      p.email.toLocaleLowerCase('tr-TR').includes(q) ||
      p.role.toLocaleLowerCase('tr-TR').includes(q)
    )
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* ÜST BİLGİ KARTLARI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl p-5 flex items-center gap-4 shadow-lg">
          <div className="p-3 bg-indigo-600/10 text-indigo-400 rounded-xl border border-indigo-500/20">
            <Users size={22} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Toplam Kullanıcı</span>
            <span className="text-2xl font-black text-white">{profiles.length}</span>
          </div>
        </div>

        <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl p-5 flex items-center gap-4 shadow-lg">
          <div className="p-3 bg-emerald-600/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Aktif Personel</span>
            <span className="text-2xl font-black text-emerald-400">
              {profiles.filter(p => p.is_active).length}
            </span>
          </div>
        </div>

        <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl p-5 flex items-center gap-4 shadow-lg">
          <div className="p-3 bg-amber-600/10 text-amber-400 rounded-xl border border-amber-500/20">
            <Shield size={22} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Yöneticiler</span>
            <span className="text-2xl font-black text-amber-400">
              {profiles.filter(p => p.role === 'admin').length}
            </span>
          </div>
        </div>

        <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl p-5 flex items-center gap-4 shadow-lg">
          <div className="p-3 bg-sky-600/10 text-sky-400 rounded-xl border border-sky-500/20">
            <Building2 size={22} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Masraf Merkezleri</span>
            <span className="text-2xl font-black text-sky-400">{companies.length}</span>
          </div>
        </div>
      </div>

      {/* ARAÇ ÇUBUĞU: ARAMA & EKLEME BUTONU */}
      <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="İsim, e-posta veya rol ara..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={loadData}
            title="Yenile"
            className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition cursor-pointer"
          >
            <UserPlus size={16} />
            <span>Yeni Kullanıcı Ekle</span>
          </button>
        </div>
      </div>

      {/* KULLANICI LİSTESİ TABLOSU */}
      <div className="bg-[#0a0f1d] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900/70 border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                <th className="py-3 px-4">Kullanıcı</th>
                <th className="py-3 px-4">Rol</th>
                <th className="py-3 px-4">Modül İzinleri</th>
                <th className="py-3 px-4">Masraf Merkezleri</th>
                <th className="py-3 px-4">Durum</th>
                <th className="py-3 px-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Kullanıcılar listeleniyor...
                  </td>
                </tr>
              ) : filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    {searchQuery ? 'Aramanıza uygun kullanıcı bulunamadı.' : 'Henüz tanımlı kullanıcı yok.'}
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((p) => {
                  const roleConfig = ROLE_LABELS[p.role] || ROLE_LABELS.custom
                  const isCurrent = p.id === currentUser?.id
                  const initials = p.full_name
                    .split(' ')
                    .filter(Boolean)
                    .map(n => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || 'U'

                  return (
                    <tr key={p.id} className="hover:bg-slate-900/40 transition-colors group">
                      {/* Kullanıcı Adı ve E-posta */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-700 flex items-center justify-center font-bold text-xs text-white border border-slate-700 shrink-0">
                            {initials}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-white flex items-center gap-1.5">
                              {p.full_name}
                              {isCurrent && (
                                <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded border border-indigo-500/30">
                                  Siz
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono truncate">{p.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Rol */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${roleConfig.badgeClass}`}>
                          {roleConfig.title}
                        </span>
                      </td>

                      {/* Modül İzinleri */}
                      <td className="py-3.5 px-4">
                        {p.role === 'admin' ? (
                          <span className="text-emerald-400 font-bold text-[11px]">Tüm Modüllere Tam Yetki (14/14)</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700">
                              {p.allowed_modules?.length || 0} Modül
                            </span>
                            <span className="text-[10px] text-slate-500 truncate max-w-[160px]" title={p.allowed_modules?.join(', ')}>
                              {p.allowed_modules?.slice(0, 3).join(', ')}{p.allowed_modules?.length > 3 ? '...' : ''}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Masraf Merkezleri */}
                      <td className="py-3.5 px-4">
                        {!p.allowed_companies || p.allowed_companies.length === 0 ? (
                          <span className="text-slate-300 text-[11px]">Tüm Şirketler & Masraflar</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 font-mono text-[10px] border border-sky-500/20">
                            {p.allowed_companies.length} Şirket Kısıtlı
                          </span>
                        )}
                      </td>

                      {/* Durum */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => toggleUserActive(p)}
                          disabled={isCurrent}
                          title={isCurrent ? 'Kendi durumunuzu değiştiremezsiniz' : (p.is_active ? 'Pasife Al' : 'Aktif Et')}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                            p.is_active 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' 
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${p.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
                          {p.is_active ? 'Aktif' : 'Pasif'}
                        </button>
                      </td>

                      {/* İşlemler */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(p)}
                            title="Yetkileri Düzenle"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                          >
                            <Edit2 size={15} />
                          </button>

                          <button
                            onClick={() => openPasswordModal(p)}
                            title="Şifre Değiştir"
                            className="p-1.5 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition cursor-pointer"
                          >
                            <Key size={15} />
                          </button>

                          {!isCurrent && (
                            <button
                              onClick={() => handleDeleteUser(p)}
                              title="Kullanıcıyı Sil"
                              className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition cursor-pointer"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. YENİ KULLANICI EKLEME MODALI                                           */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#0b1222] border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Modal Başlığı */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Yeni Personel / Kullanıcı Ekle</h3>
                  <p className="text-[10px] text-slate-400">Giriş hesabı oluşturun ve modül izinlerini belirleyin</p>
                </div>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-white transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Modal Form İçeriği */}
            <form onSubmit={handleCreateUser} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar text-xs">
              
              {/* Ad Soyad & E-posta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-bold mb-1.5">Ad Soyad *</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Örn: Ahmet Yılmaz"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1.5">E-posta Adresi *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ahmet@sirket.com"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Başlangıç Şifresi */}
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">Giriş Şifresi * (En az 6 karakter)</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Rol Seçimi */}
              <div>
                <label className="block text-slate-300 font-bold mb-2">Rol Şablonu Seçin</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map((rKey) => {
                    const r = ROLE_LABELS[rKey]
                    const isSelected = role === rKey
                    return (
                      <button
                        key={rKey}
                        type="button"
                        onClick={() => handleRoleChange(rKey)}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                          isSelected
                            ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                        }`}
                      >
                        <span className="font-bold text-[11px]">{r.title}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Modül İzinleri Seçimi */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-slate-300 font-bold">Modül Erişim İzinleri</label>
                  <span className="text-[10px] text-slate-500">Seçilen: {allowedModules.length} modül</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-900/80 p-3 rounded-2xl border border-slate-800 max-h-48 overflow-y-auto custom-scrollbar">
                  {SYSTEM_MODULES.map((m) => {
                    const isChecked = allowedModules.includes(m.key)
                    return (
                      <label
                        key={m.key}
                        className={`flex items-start gap-2 p-2 rounded-xl border transition cursor-pointer ${
                          isChecked
                            ? 'bg-indigo-600/10 border-indigo-500/30 text-white'
                            : 'bg-slate-950/40 border-slate-800/60 text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleModule(m.key)}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-0 focus:ring-offset-0 bg-slate-900 border-slate-700"
                        />
                        <div className="flex flex-col">
                          <span className="font-bold text-[11px]">{m.label}</span>
                          <span className="text-[9px] text-slate-500">{m.description}</span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Şirket / Masraf Merkezi Kısıtlaması */}
              <div>
                <label className="block text-slate-300 font-bold mb-2">Masraf Merkezi & Şirket Erişimi</label>
                <div className="space-y-2 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="compAccess"
                      checked={allCompaniesAccess}
                      onChange={() => setAllCompaniesAccess(true)}
                      className="text-indigo-600 focus:ring-0 bg-slate-900"
                    />
                    <span className="text-white font-bold text-[11px]">Tüm Masraf Merkezleri ve Şirketleri Görsün (Serbest)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="compAccess"
                      checked={!allCompaniesAccess}
                      onChange={() => setAllCompaniesAccess(false)}
                      className="text-indigo-600 focus:ring-0 bg-slate-900"
                    />
                    <span className="text-slate-300 font-medium text-[11px]">Yalnızca Seçili Şirketleri Görsün</span>
                  </label>

                  {!allCompaniesAccess && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 mt-2">
                      {companies.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 text-slate-300 text-[11px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedCompanyIds.includes(c.id)}
                            onChange={() => toggleCompany(c.id)}
                            className="rounded text-indigo-600 bg-slate-900 border-slate-700"
                          />
                          <span>{c.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Butonları */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  <span>Kullanıcıyı Oluştur</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. KULLANICI DÜZENLEME MODALI                                             */}
      {/* ========================================================================= */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#0b1222] border border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30">
                  <Edit2 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Yetki ve Profil Düzenle: {selectedUser.full_name}</h3>
                  <p className="text-[10px] text-slate-400">{selectedUser.email}</p>
                </div>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-white transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar text-xs">
              
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">Ad Soyad</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Rol Seçimi */}
              <div>
                <label className="block text-slate-300 font-bold mb-2">Rol</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.keys(ROLE_LABELS) as UserRole[]).map((rKey) => {
                    const r = ROLE_LABELS[rKey]
                    const isSelected = role === rKey
                    return (
                      <button
                        key={rKey}
                        type="button"
                        onClick={() => handleRoleChange(rKey)}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1 ${
                          isSelected
                            ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/60'
                        }`}
                      >
                        <span className="font-bold text-[11px]">{r.title}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Modül İzinleri Seçimi */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-slate-300 font-bold">Modül Erişim İzinleri</label>
                  <span className="text-[10px] text-slate-500">Seçilen: {allowedModules.length} modül</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-900/80 p-3 rounded-2xl border border-slate-800 max-h-48 overflow-y-auto custom-scrollbar">
                  {SYSTEM_MODULES.map((m) => {
                    const isChecked = allowedModules.includes(m.key)
                    return (
                      <label
                        key={m.key}
                        className={`flex items-start gap-2 p-2 rounded-xl border transition cursor-pointer ${
                          isChecked
                            ? 'bg-indigo-600/10 border-indigo-500/30 text-white'
                            : 'bg-slate-950/40 border-slate-800/60 text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleModule(m.key)}
                          className="mt-0.5 rounded text-indigo-600 bg-slate-900 border-slate-700"
                        />
                        <div className="flex flex-col">
                          <span className="font-bold text-[11px]">{m.label}</span>
                          <span className="text-[9px] text-slate-500">{m.description}</span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Şirket / Masraf Merkezi Kısıtlaması */}
              <div>
                <label className="block text-slate-300 font-bold mb-2">Masraf Merkezi & Şirket Erişimi</label>
                <div className="space-y-2 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editCompAccess"
                      checked={allCompaniesAccess}
                      onChange={() => setAllCompaniesAccess(true)}
                      className="text-indigo-600 focus:ring-0 bg-slate-900"
                    />
                    <span className="text-white font-bold text-[11px]">Tüm Masraf Merkezlerini Görsün</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editCompAccess"
                      checked={!allCompaniesAccess}
                      onChange={() => setAllCompaniesAccess(false)}
                      className="text-indigo-600 focus:ring-0 bg-slate-900"
                    />
                    <span className="text-slate-300 font-medium text-[11px]">Yalnızca Seçili Şirketleri Görsün</span>
                  </label>

                  {!allCompaniesAccess && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 mt-2">
                      {companies.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 text-slate-300 text-[11px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedCompanyIds.includes(c.id)}
                            onChange={() => toggleCompany(c.id)}
                            className="rounded text-indigo-600 bg-slate-900 border-slate-700"
                          />
                          <span>{c.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Hesap Durumu (Aktif/Pasif) */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded text-indigo-600 bg-slate-900 border-slate-700"
                  />
                  <span className="text-slate-200 font-bold text-xs">Hesap Aktif</span>
                </label>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  <span>Değişiklikleri Kaydet</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. ŞİFRE DEĞİŞTİRME MODALI                                                */}
      {/* ========================================================================= */}
      {isPasswordModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#0b1222] border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30">
                  <Key size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Şifre Belirle</h3>
                  <p className="text-[10px] text-slate-400">{selectedUser.full_name}</p>
                </div>
              </div>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-slate-400 hover:text-white transition cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1.5">Yeni Şifre (En az 6 karakter)</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-amber-600/30 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  <span>Şifreyi Güncelle</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  )
}

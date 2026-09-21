'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { UserProfile, ROLE_DEFAULT_MODULES } from '../types/auth'
import toast from 'react-hot-toast'

interface AuthContextType {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  loading: boolean
  isAdmin: boolean
  hasModuleAccess: (moduleKey: string) => boolean
  hasCompanyAccess: (companyId: string | null) => boolean
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Profil verisini veritabanından çek (yoksa veritabanına ilk admin olarak kaydet)
  const fetchProfile = useCallback(async (userId: string, userEmail?: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (!error && data) {
        setProfile(data as UserProfile)
        return data as UserProfile
      }

      // Veritabanında profil yoksa otomatik olarak oluştur (ilk kullanıcı veya trigger gecikmesi)
      const initialProfile: UserProfile = {
        id: userId,
        email: userEmail || '',
        full_name: userEmail?.split('@')[0] || 'Yönetici',
        role: 'admin',
        allowed_modules: ROLE_DEFAULT_MODULES.admin,
        allowed_companies: null,
        is_active: true,
      }

      // Tabloya da yazmayı dene
      try {
        await supabase.from('user_profiles').upsert({
          id: initialProfile.id,
          email: initialProfile.email,
          full_name: initialProfile.full_name,
          role: initialProfile.role,
          allowed_modules: initialProfile.allowed_modules,
          allowed_companies: initialProfile.allowed_companies,
          is_active: initialProfile.is_active,
          updated_at: new Date().toISOString()
        })
      } catch (saveErr) {
        console.warn('Profil kaydedilemedi, yerel profil kullanılıyor:', saveErr)
      }

      setProfile(initialProfile)
      return initialProfile
    } catch (err) {
      console.error('Profil çekilirken beklenmedik hata:', err)
      const fallback: UserProfile = {
        id: userId,
        email: userEmail || '',
        full_name: userEmail?.split('@')[0] || 'Yönetici',
        role: 'admin',
        allowed_modules: ROLE_DEFAULT_MODULES.admin,
        allowed_companies: null,
        is_active: true,
      }
      setProfile(fallback)
      return fallback
    }
  }, [])

  useEffect(() => {
    let mounted = true

    let profileChannel: any = null

    const setupProfileSubscription = (userId: string) => {
      if (profileChannel) supabase.removeChannel(profileChannel)
      profileChannel = supabase
        .channel(`profile_changes_${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_profiles',
            filter: `id=eq.${userId}`
          },
          (payload) => {
            if (payload.new) {
              setProfile(payload.new as UserProfile)
            }
          }
        )
        .subscribe()
    }

    // 1. Mevcut aktif oturumu kontrol et
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        await fetchProfile(session.user.id, session.user.email)
        setupProfileSubscription(session.user.id)
      }
      if (mounted) setLoading(false)
    })

    // 2. Oturum değişikliklerini dinle
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        await fetchProfile(session.user.id, session.user.email)
        setupProfileSubscription(session.user.id)
      } else {
        setProfile(null)
        if (profileChannel) supabase.removeChannel(profileChannel)
      }
      if (mounted) setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
      if (profileChannel) supabase.removeChannel(profileChannel)
    }
  }, [fetchProfile])

  // Giriş yapma fonksiyonu
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (data?.user) {
        const userProfile = await fetchProfile(data.user.id, data.user.email)
        
        // Pasif kullanıcı engeli
        if (userProfile && !userProfile.is_active) {
          await supabase.auth.signOut()
          return { success: false, error: 'Hesabınız yönetici tarafından pasife alınmıştır.' }
        }
      }

      return { success: true }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Giriş yapılırken bir hata oluştu.'
      return { success: false, error: msg }
    }
  }

  // Çıkış yapma fonksiyonu
  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      setSession(null)
      setUser(null)
      setProfile(null)
      toast.success('Oturum kapatıldı')
      router.push('/login')
    } catch (err) {
      console.error('Çıkış hatası:', err)
      router.push('/login')
    }
  }

  // Profili manuel tazele
  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id, user.email)
    }
  }

  // Modül yetki kontrolü
  const hasModuleAccess = (moduleKey: string): boolean => {
    if (!profile) return false
    // Süper Admin her yere girebilir
    if (profile.role === 'admin') return true
    // Hesabı pasifse erişemez
    if (!profile.is_active) return false
    return profile.allowed_modules?.includes(moduleKey) ?? false
  }

  // Şirket / Masraf Merkezi yetki kontrolü
  const hasCompanyAccess = (companyId: string | null): boolean => {
    if (!profile) return false
    if (profile.role === 'admin') return true
    // allowed_companies null ise veya boşsa tüm şirketleri görebilir
    if (!profile.allowed_companies || profile.allowed_companies.length === 0) return true
    // Ortak kayıtlar (companyId === null) her zaman görülebilir
    if (companyId === null) return true
    return profile.allowed_companies.includes(companyId)
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        isAdmin,
        hasModuleAccess,
        hasCompanyAccess,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

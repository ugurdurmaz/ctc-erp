'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth-context'

export interface Company {
  id: string
  name: string
  is_personal: boolean
  created_at?: string
}

interface CompanyContextType {
  companies: Company[]
  loading: boolean
  selectedCompanyIds: string[]
  selectedCompanyId: string // 'all' if empty, single ID if length===1, 'multiple' if length>1
  setSelectedCompanyId: (id: string) => void // 'all' or specific company id
  setSelectedCompanyIds: (ids: string[]) => void
  toggleCompanyId: (id: string) => void
  selectOnlyCompany: (id: string) => void
  clearFilter: () => void
  activeCompanies: Company[]
  activeCompany: Company | null
  matchesCompany: (itemCompanyId?: string | null, includeCommon?: boolean) => boolean
  refreshCompanies: () => Promise<void>
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined)

const STORAGE_KEY = 'ctc_global_active_company_filter'

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { profile, isAdmin } = useAuth()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCompanyIds, setSelectedCompanyIdsState] = useState<string[]>([])

  // Şirketleri veritabanından çek
  const fetchCompanies = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('companies').select('*').order('name', { ascending: true })
      if (!error && data) {
        let list: Company[] = data
        if (!isAdmin && profile?.allowed_companies && profile.allowed_companies.length > 0) {
          list = list.filter(c => profile.allowed_companies!.includes(c.id))
        }
        setCompanies(list)
      }
    } catch (err) {
      console.error('Şirketler yüklenirken hata:', err)
    } finally {
      setLoading(false)
    }
  }, [isAdmin, profile?.allowed_companies])

  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

  // Tarayıcı hafızasından (localStorage) kayıtlı tercihi yükle
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setSelectedCompanyIdsState(parsed)
        } else if (typeof parsed === 'string' && parsed !== 'all') {
          setSelectedCompanyIdsState([parsed])
        }
      }
    } catch (e) {
      console.error('Kayıtlı merkez tercihi okunamadı:', e)
    }
  }, [])

  const setSelectedCompanyIds = useCallback((ids: string[]) => {
    setSelectedCompanyIdsState(ids)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
    } catch (e) {
      console.error('Merkez tercihi kaydedilemedi:', e)
    }
  }, [])

  const setSelectedCompanyId = useCallback((id: string) => {
    if (!id || id === 'all') {
      setSelectedCompanyIds([])
    } else {
      setSelectedCompanyIds([id])
    }
  }, [setSelectedCompanyIds])

  const selectOnlyCompany = useCallback((id: string) => {
    if (!id || id === 'all') {
      setSelectedCompanyIds([])
    } else {
      setSelectedCompanyIds([id])
    }
  }, [setSelectedCompanyIds])

  const toggleCompanyId = useCallback((id: string) => {
    setSelectedCompanyIdsState(prev => {
      let updated: string[]
      if (prev.includes(id)) {
        updated = prev.filter(x => x !== id)
      } else {
        updated = [...prev, id]
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      } catch (e) {
        console.error(e)
      }
      return updated
    })
  }, [])

  const clearFilter = useCallback(() => {
    setSelectedCompanyIds([])
  }, [setSelectedCompanyIds])

  const selectedCompanyId = useMemo(() => {
    if (selectedCompanyIds.length === 0) return 'all'
    if (selectedCompanyIds.length === 1) return selectedCompanyIds[0]
    return 'multiple'
  }, [selectedCompanyIds])

  const activeCompanies = useMemo(() => {
    if (selectedCompanyIds.length === 0) return companies
    return companies.filter(c => selectedCompanyIds.includes(c.id))
  }, [companies, selectedCompanyIds])

  const activeCompany = useMemo(() => {
    if (selectedCompanyIds.length === 1) {
      return companies.find(c => c.id === selectedCompanyIds[0]) || null
    }
    return null
  }, [companies, selectedCompanyIds])

  // Veri kartının (hesap, müşteri, depo vb.) aktif filtre ile eşleşip eşleşmediğini kontrol et
  const matchesCompany = useCallback((itemCompanyId?: string | null, includeCommon = true) => {
    if (selectedCompanyIds.length === 0) return true
    if (!itemCompanyId || itemCompanyId === 'common') return includeCommon
    return selectedCompanyIds.includes(itemCompanyId)
  }, [selectedCompanyIds])

  const value = useMemo(() => ({
    companies,
    loading,
    selectedCompanyIds,
    selectedCompanyId,
    setSelectedCompanyId,
    setSelectedCompanyIds,
    toggleCompanyId,
    selectOnlyCompany,
    clearFilter,
    activeCompanies,
    activeCompany,
    matchesCompany,
    refreshCompanies: fetchCompanies
  }), [
    companies,
    loading,
    selectedCompanyIds,
    selectedCompanyId,
    setSelectedCompanyId,
    setSelectedCompanyIds,
    toggleCompanyId,
    selectOnlyCompany,
    clearFilter,
    activeCompanies,
    activeCompany,
    matchesCompany,
    fetchCompanies
  ])

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  )
}

export function useCompany() {
  const context = useContext(CompanyContext)
  if (!context) {
    throw new Error('useCompany must be used within a CompanyProvider')
  }
  return context
}

export type UserRole = 'admin' | 'finance' | 'cashier' | 'warehouse' | 'custom'

export type ModuleKey = 
  | 'dashboard'
  | 'retail'
  | 'technical-service'
  | 'cash-registers'
  | 'bank-accounts'
  | 'credit-cards'
  | 'stocks'
  | 'services'
  | 'suppliers'
  | 'customers'
  | 'expenses'
  | 'subscriptions'
  | 'reports'
  | 'companies'
  | 'activity'
  | 'users'

export interface ModuleDefinition {
  key: ModuleKey
  label: string
  href: string
  description: string
  adminOnly?: boolean
}

export const SYSTEM_MODULES: ModuleDefinition[] = [
  { key: 'dashboard', label: 'Genel Durum', href: '/', description: 'Genel finansal özet, net durum, P&L' },
  { key: 'retail', label: 'Mağaza (POS)', href: '/retail', description: 'Perakende Z-Raporu ve mağaza satışları' },
  { key: 'technical-service', label: 'Teknik Servis', href: '/technical-service', description: 'Cihaz kabul, servis aşamaları ve onarım takibi' },
  { key: 'cash-registers', label: 'Nakit Kasa', href: '/cash-registers', description: 'Kasa hesapları ve nakit hareketleri' },
  { key: 'bank-accounts', label: 'Banka Hesapları', href: '/bank-accounts', description: 'Banka hesapları ve hareketleri' },
  { key: 'credit-cards', label: 'Kredi Kartları', href: '/credit-cards', description: 'Kredi kartları ve harcamalar' },
  { key: 'stocks', label: 'Stok Yönetimi', href: '/stocks', description: 'Stok kartları, depolar ve sayım' },
  { key: 'services', label: 'Hizmet Yönetimi', href: '/services', description: 'Tanımlı hizmet kartları' },
  { key: 'suppliers', label: 'Satıcılar (Borç)', href: '/suppliers', description: 'Tedarikçi cari ve faturalar' },
  { key: 'customers', label: 'Müşteriler (Alacak)', href: '/customers', description: 'Müşteri cari ve faturalar' },
  { key: 'expenses', label: 'Genel Giderler', href: '/expenses', description: 'Gider kayıtları ve fişler' },
  { key: 'subscriptions', label: 'Abonelik / Kredi', href: '/subscriptions', description: 'Kredi cüzdanları ve abonelikler' },
  { key: 'reports', label: 'Raporlar (P&L)', href: '/reports', description: 'Dönemsel mizan ve finansal tablolar' },
  { key: 'companies', label: 'Şirketler / Merkezler', href: '/companies', description: 'Şirket ve şahsi masraf merkezleri' },
  { key: 'activity', label: 'İşlem Geçmişi (Log)', href: '/activity', description: 'Sistem denetim günlüğü (Audit Log)' },
  { key: 'users', label: 'Kullanıcılar & Yetkiler', href: '/users', description: 'Kullanıcı açma ve yetki yönetimi', adminOnly: true },
]

export const ROLE_DEFAULT_MODULES: Record<UserRole, ModuleKey[]> = {
  admin: [
    'dashboard', 'retail', 'technical-service', 'cash-registers', 'bank-accounts', 'credit-cards',
    'stocks', 'services', 'suppliers', 'customers', 'expenses',
    'subscriptions', 'reports', 'companies', 'activity', 'users'
  ],
  finance: [
    'dashboard', 'technical-service', 'cash-registers', 'bank-accounts', 'credit-cards',
    'stocks', 'services', 'suppliers', 'customers', 'expenses',
    'subscriptions', 'reports'
  ],
  cashier: [
    'retail', 'technical-service', 'stocks', 'services'
  ],
  warehouse: [
    'stocks', 'technical-service', 'services'
  ],
  custom: [
    'retail', 'technical-service'
  ]
}

export const ROLE_LABELS: Record<UserRole, { title: string; badgeClass: string }> = {
  admin: { title: 'Yönetici (Admin)', badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' },
  finance: { title: 'Ön Muhasebe / Finans', badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  cashier: { title: 'Kasiyer / Satış', badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  warehouse: { title: 'Depo Sorumlusu', badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
  custom: { title: 'Özel Yetkili', badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40' }
}

export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: UserRole
  allowed_modules: string[]
  allowed_companies: string[] | null // null = tüm şirketler
  allowed_warehouses?: string[] | null // null = tüm depolar
  is_active: boolean
  created_at?: string
  updated_at?: string
}

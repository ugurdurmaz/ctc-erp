-- ==============================================================================
-- CTC MASTER LEDGER - ÇÖZÜM ORTAKLARI (DIŞ İŞ & HAKEDİŞ HESAPLAŞMA) MODÜLÜ
-- ==============================================================================
-- Bu SQL scripti Supabase Dashboard -> SQL Editor alanında çalıştırılabilir.
-- ==============================================================================

-- 1. ÇÖZÜM ORTAKLARI TABLOSU
CREATE TABLE IF NOT EXISTS public.partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    default_tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 20.00,
    default_commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00, -- Ortağın bizden alacağı (Hakediş Bakiyesi)
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. HAKEDİŞ & İŞ HESAPLAŞMA KAYITLARI
CREATE TABLE IF NOT EXISTS public.partner_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    job_title TEXT NOT NULL,
    job_date DATE NOT NULL,
    job_type TEXT NOT NULL DEFAULT 'project', -- 'project' (Dış Satış / Montaj), 'service' (Teknik Servis)
    customer_name TEXT,
    invoice_no TEXT,
    invoice_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00, -- Müşteriye kesilen / alınan fatura tutarı
    collection_status TEXT NOT NULL DEFAULT 'collected', -- 'collected' (Tahsil Edildi), 'pending' (Bekliyor)
    collection_source_type TEXT, -- 'bank', 'cash', 'none'
    collection_source_id UUID,
    material_cost_shop NUMERIC(15, 2) NOT NULL DEFAULT 0.00, -- Bizim mağaza/stoktan verilen kârlı malzeme bedeli
    material_cost_external NUMERIC(15, 2) NOT NULL DEFAULT 0.00, -- Dışarıdan bizim şirketimize faturalanan malzeme bedeli
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 20.00, -- Kesilen KDV / Vergi Payı Yüzdesi
    tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00, -- Kesilen KDV / Vergi Payı Tutarı
    shop_profit_share NUMERIC(15, 2) NOT NULL DEFAULT 0.00, -- Şirketin aldığı servis işçilik veya komisyon payı
    other_expenses NUMERIC(15, 2) NOT NULL DEFAULT 0.00, -- Kargo, nakliye vb. diğer kesintiler
    partner_payout NUMERIC(15, 2) NOT NULL DEFAULT 0.00, -- Ortağın Net Hakedişi (Fatura - Malzemeler - Vergi - Kâr - Diğer)
    payout_status TEXT NOT NULL DEFAULT 'unpaid', -- 'unpaid' (Ödenmedi), 'partial' (Kısmi), 'paid' (Tamamı Ödendi)
    paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00, -- Bu işe mahsuben ödenen tutar
    remaining_payout NUMERIC(15, 2) NOT NULL DEFAULT 0.00, -- Bu işten kalan hakediş alacağı
    items_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb, -- Malzeme ve masraf kalemleri dökümü
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. HAKEDİŞ ÖDEMELERİ & BAKİYE HAREKETLERİ TABLOSU
CREATE TABLE IF NOT EXISTS public.partner_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
    settlement_id UUID REFERENCES public.partner_settlements(id) ON DELETE SET NULL,
    tx_type TEXT NOT NULL DEFAULT 'payment', -- 'payment' (Ortağa Ödeme Yapıldı -), 'earning' (Hakediş Tahakkuku +)
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    tx_date DATE NOT NULL,
    payment_source_type TEXT, -- 'bank', 'cash'
    payment_source_id UUID,
    transfer_id TEXT, -- 'PARTNER-PAY-<uuid>' Kasa/Banka hareketine bağlanan anahtar
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. HIZLI PERFORMANS İNDEKSLERİ
CREATE INDEX IF NOT EXISTS idx_partners_company ON public.partners(company_id);
CREATE INDEX IF NOT EXISTS idx_partner_settlements_partner ON public.partner_settlements(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_settlements_date ON public.partner_settlements(job_date);
CREATE INDEX IF NOT EXISTS idx_partner_transactions_partner ON public.partner_transactions(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_transactions_date ON public.partner_transactions(tx_date);
CREATE INDEX IF NOT EXISTS idx_partner_transactions_transfer_id ON public.partner_transactions(transfer_id);

-- 5. KULLANICI PROFİLİ MODÜL İZİNLERİNE 'partners' EKLE
ALTER TABLE public.user_profiles 
ALTER COLUMN allowed_modules SET DEFAULT array[
  'dashboard', 'retail', 'technical-service', 'partners', 'cash-registers', 'bank-accounts', 'credit-cards', 'bank-loans',
  'stocks', 'services', 'suppliers', 'customers', 'expenses',
  'subscriptions', 'reports', 'companies', 'activity', 'users'
];

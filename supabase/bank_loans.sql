-- ==============================================================================
-- CTC MASTER LEDGER - BANKA KREDİLERİ (TAKSİTLİ KREDİLER) MODÜLÜ
-- ==============================================================================
-- Bu SQL scripti Supabase Dashboard -> SQL Editor alanında çalıştırılabilir.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.bank_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_name TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    loan_type TEXT NOT NULL DEFAULT 'commercial', -- commercial, consumer, vehicle, housing, other
    principal_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    interest_rate NUMERIC(8, 4) NOT NULL DEFAULT 0,
    total_installments INTEGER NOT NULL DEFAULT 12,
    paid_installments INTEGER NOT NULL DEFAULT 0,
    monthly_installment NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_payment NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_interest NUMERIC(15, 2) NOT NULL DEFAULT 0,
    remaining_principal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    remaining_total NUMERIC(15, 2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'TRY',
    start_date DATE NOT NULL,
    first_due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- active, completed, cancelled
    notes TEXT,
    installments_plan JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hızlı sorgulama indeksleri
CREATE INDEX IF NOT EXISTS idx_bank_loans_company ON public.bank_loans(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_loans_bank_account ON public.bank_loans(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_loans_status ON public.bank_loans(status);

-- Kullanıcı profil izinlerinde modülü varsayılanlara ekle
ALTER TABLE public.user_profiles 
ALTER COLUMN allowed_modules SET DEFAULT array[
  'dashboard', 'retail', 'technical-service', 'cash-registers', 'bank-accounts', 'credit-cards', 'bank-loans',
  'stocks', 'services', 'suppliers', 'customers', 'expenses',
  'subscriptions', 'reports', 'companies', 'activity', 'users'
];

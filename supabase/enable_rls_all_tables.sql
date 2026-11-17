-- ==============================================================================
-- CTC MASTER LEDGER - TÜM TABLOLARDA RLS (ROW LEVEL SECURITY) AKTİFLEŞTİRME
-- ==============================================================================
-- Bu SQL scripti, ERP veritabanındaki tüm tablolarda Satır Bazlı Güvenliği (RLS)
-- açar ve herkese açık 'anon' anahtarın yetkilerini iptal eder.
-- Yalnızca sisteme şifresiyle giriş yapmış 'authenticated' kullanıcılara tam yetki verir.
-- ==============================================================================
-- Supabase Dashboard -> SQL Editor alanına yapıştırıp "RUN" butonuna basınız.
-- ==============================================================================

DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'companies',
        'warehouses',
        'cash_registers',
        'cash_transactions',
        'bank_accounts',
        'bank_transactions',
        'credit_cards',
        'card_transactions',
        'bank_loans',
        'stocks',
        'stock_transactions',
        'customers',
        'customer_transactions',
        'suppliers',
        'supplier_transactions',
        'expense_categories',
        'expense_transactions',
        'pos_transactions',
        'technical_service_tickets',
        'services',
        'credit_subscriptions',
        'audit_logs',
        'partners',
        'partner_settlements',
        'partner_transactions',
        'user_profiles',
        'credit_wallets'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        -- 1. Tabloda RLS'yi aktif et
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        
        -- 2. Eski / geçici politikaları temizle (idempotent)
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tbl || '_all_access', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tbl || '_authenticated_all', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tbl || '_select_all', tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', tbl || '_anon_access', tbl);
        
        -- 3. Yalnızca giriş yapmış 'authenticated' kullanıcılara tam CRUD yetkisi ver
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);',
            tbl || '_authenticated_all',
            tbl
        );
    END LOOP;
END $$;

-- Doğrulama: Tüm tabloların RLS durumunu listele
SELECT 
    schemaname, 
    tablename, 
    rowsecurity as rls_enabled 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

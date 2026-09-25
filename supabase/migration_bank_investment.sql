-- ==============================================================================
-- CTC MASTER LEDGER - BANKA VADELİ / YATIRIM HESABI MİGRASYONU
-- ==============================================================================
-- Bu SQL scripti Supabase Dashboard -> SQL Editor alanında çalıştırılabilir.
-- (Uygulama geriye dönük uyumlu olarak mevcut account_color kolonu üzerinden de
-- anında çalışmaktadır).
-- ==============================================================================

ALTER TABLE public.bank_accounts 
ADD COLUMN IF NOT EXISTS is_investment BOOLEAN DEFAULT FALSE;

-- Mevcut vadeli / yatırım hesaplarını güncelle
UPDATE public.bank_accounts 
SET is_investment = TRUE 
WHERE account_color = 'investment' 
   OR account_color ILIKE '%investment%' 
   OR account_color ILIKE '%vadeli%';

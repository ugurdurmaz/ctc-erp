-- Banka hesaplarına KMH (Kredili Mevduat / Ek Hesap) limiti kolonu ekleme (Geriye dönük uyumlu)
ALTER TABLE public.bank_accounts
ADD COLUMN IF NOT EXISTS kmh_limit numeric DEFAULT 0;


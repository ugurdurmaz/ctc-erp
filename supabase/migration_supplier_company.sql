-- ==============================================================================
-- CTC MASTER LEDGER - TEDARÝKÇÝ ÞÝRKET ÝLÝÞKÝSÝ MÝGRASYONU
-- ==============================================================================
-- Bu SQL scriptini Supabase Dashboard -> SQL Editor alanýnda çalýþtýrabilirsiniz.
-- (Uygulama tax_number üzerinden de geriye dönük uyumlu olarak anýnda çalýþmaktadýr).
-- ==============================================================================

ALTER TABLE public.suppliers 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON public.suppliers(company_id);

-- Mevcut atanmýþ þirketleri taþý
UPDATE public.suppliers 
SET company_id = tax_number::uuid 
WHERE tax_number IS NOT NULL 
  AND tax_number ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

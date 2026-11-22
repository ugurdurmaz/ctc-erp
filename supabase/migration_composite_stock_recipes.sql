-- ==============================================================================
-- CTC MASTER LEDGER - HİBRİT REÇETELİ ÜRÜN & MONTAJ SİSTEMİ (OPTION C)
-- ==============================================================================
-- Bu migrasyon, reçeteli / montaj ürünleri (LED tabela, bilgisayar kasası,
-- montajlı setler vb.) için gerekli kolonları stocks tablosuna geriye dönük
-- uyumlu (additive / backwards compatible) olarak ekler.
-- ==============================================================================
-- Çalıştırma: Supabase Dashboard -> SQL Editor alanında çalıştırın.
-- ==============================================================================

-- 1. Reçete kolonlarını stocks tablosuna ekle
ALTER TABLE public.stocks 
ADD COLUMN IF NOT EXISTS is_composite boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS recipe_components jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS recipe_additional_cost numeric(12,2) DEFAULT 0;

-- 2. Hızlı filtreleme için indeks
CREATE INDEX IF NOT EXISTS idx_stocks_is_composite ON public.stocks(is_composite);

-- 3. Yorumlar
COMMENT ON COLUMN public.stocks.is_composite IS 'Ürünün bir veya birden fazla parçanın birleşimiyle üretilen reçeteli ürün olup olmadığını belirtir';
COMMENT ON COLUMN public.stocks.recipe_components IS 'Reçete bileşenleri listesi: [{ stock_id, name, sku, quantity, unit }]';
COMMENT ON COLUMN public.stocks.recipe_additional_cost IS 'Stok harici ilave maliyetler (kablo, vida, lehim, montaj işçiliği vb.)';

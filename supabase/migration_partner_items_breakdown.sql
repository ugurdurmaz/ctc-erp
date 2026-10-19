-- Çözüm Ortakları Hakedişleri - items_breakdown kolonu ekleme
ALTER TABLE public.partner_settlements 
ADD COLUMN IF NOT EXISTS items_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb;

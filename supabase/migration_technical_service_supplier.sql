-- ==============================================================================
-- CTC MASTER LEDGER - TEKNİK SERVİS TEDARİKÇİ & PAZARLAMA GÜNCELLEMESİ
-- ==============================================================================

-- 1. Dış Servis (Fason Tedarikçi) ve İletişim / Pazarlama İzni Sütunları
ALTER TABLE public.technical_service_tickets 
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS supplier_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_external_service BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS external_service_status TEXT DEFAULT 'none', -- 'none', 'sent', 'received'
ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT true;

-- 2. İndeks
CREATE INDEX IF NOT EXISTS idx_technical_service_tickets_supplier ON public.technical_service_tickets(supplier_id);

-- ==============================================================================
-- CTC MASTER LEDGER - TEKNİK SERVİS & CİHAZ TAKİP MODÜLÜ
-- ==============================================================================

-- 1. Tablo Oluşturma
CREATE TABLE IF NOT EXISTS public.technical_service_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_no TEXT UNIQUE NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    device_type TEXT NOT NULL DEFAULT 'Laptop',
    brand_model TEXT NOT NULL,
    serial_no TEXT,
    device_password TEXT,
    accessories TEXT,
    physical_condition TEXT,
    problem_description TEXT NOT NULL,
    technician_notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, diagnosing, waiting_approval, waiting_parts, ready, delivered, cancelled
    estimated_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    labor_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    parts_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    used_parts JSONB NOT NULL DEFAULT '[]'::jsonb,
    performed_services JSONB NOT NULL DEFAULT '[]'::jsonb,
    payment_status TEXT NOT NULL DEFAULT 'unpaid', -- unpaid, paid, debt_added
    payment_method TEXT, -- cash, card, bank, customer_debt
    payment_target_id TEXT,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    supplier_cost NUMERIC(15, 2) NOT NULL DEFAULT 0,
    is_external_service BOOLEAN NOT NULL DEFAULT false,
    external_service_status TEXT DEFAULT 'none', -- none, sent, received
    marketing_consent BOOLEAN NOT NULL DEFAULT true,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. İndeksler (Yüksek Performanslı Arama ve Filtreleme)
CREATE INDEX IF NOT EXISTS idx_technical_service_tickets_company ON public.technical_service_tickets(company_id);
CREATE INDEX IF NOT EXISTS idx_technical_service_tickets_status ON public.technical_service_tickets(status);
CREATE INDEX IF NOT EXISTS idx_technical_service_tickets_customer ON public.technical_service_tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_technical_service_tickets_ticket_no ON public.technical_service_tickets(ticket_no);
CREATE INDEX IF NOT EXISTS idx_technical_service_tickets_created_at ON public.technical_service_tickets(created_at DESC);

-- 3. RLS (Row Level Security)
ALTER TABLE public.technical_service_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "technical_service_tickets_all_auth" ON public.technical_service_tickets;
CREATE POLICY "technical_service_tickets_all_auth"
ON public.technical_service_tickets
FOR ALL
USING (true)
WITH CHECK (true);

-- 4. Otomatik Takip No (Örn: SRV-26-1001) ve Güncelleme Trigger'ı
CREATE SEQUENCE IF NOT EXISTS service_ticket_seq START 1001;

CREATE OR REPLACE FUNCTION set_ticket_no()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ticket_no IS NULL OR NEW.ticket_no = '' THEN
        NEW.ticket_no := 'SRV-' || TO_CHAR(NOW(), 'YY') || '-' || LPAD(NEXTVAL('service_ticket_seq')::TEXT, 4, '0');
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_ticket_no ON public.technical_service_tickets;
CREATE TRIGGER trg_set_ticket_no
BEFORE INSERT OR UPDATE ON public.technical_service_tickets
FOR EACH ROW
EXECUTE FUNCTION set_ticket_no();

-- ==============================================================================
-- CTC MASTER LEDGER - ÇÖZÜM ORTAKLARI RLS (ROW LEVEL SECURITY) İZİN DÜZELTME
-- ==============================================================================
-- Supabase Dashboard -> SQL Editor alanında bu kodu yapıştırıp 'RUN' butonuna basınız.
-- ==============================================================================

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partners_all_access" ON public.partners;
CREATE POLICY "partners_all_access" ON public.partners FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.partner_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_settlements_all_access" ON public.partner_settlements;
CREATE POLICY "partner_settlements_all_access" ON public.partner_settlements FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.partner_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_transactions_all_access" ON public.partner_transactions;
CREATE POLICY "partner_transactions_all_access" ON public.partner_transactions FOR ALL USING (true) WITH CHECK (true);

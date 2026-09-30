-- Migration: Kredi kartı hareketleri için transfer_id kolonu ekleme (opsiyonel / geleceğe yönelik)
-- PostgREST şema uyumluluğu için kod düzeyinde [TRF-...] ve [EXP-...] etiketleri description içine de gömülmektedir.
ALTER TABLE card_transactions ADD COLUMN IF NOT EXISTS transfer_id text;
CREATE INDEX IF NOT EXISTS idx_card_tx_transfer_id ON card_transactions(transfer_id);

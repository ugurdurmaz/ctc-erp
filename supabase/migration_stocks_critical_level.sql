-- ==============================================================================
-- CTC MASTER LEDGER - ÜRÜN BAZINDA KRİTİK STOK EŞİĞİ (2026-11-24)
-- ==============================================================================
-- Additive: yalnız boş (NULL) bir kolon ekler, mevcut veriye dokunmaz. İdempotenttir.
-- NULL = eşik tanımsız → bu ürün için bildirim üretilmez; stok sayfası varsayılan
-- kuralı (0 < miktar <= 2) kullanmaya devam eder.
-- Supabase Dashboard -> SQL Editor alanına yapıştırıp "RUN" ile çalıştırın.
-- ==============================================================================

alter table public.stocks
  add column if not exists critical_level numeric(12, 2) default null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'stocks_critical_level_non_negative'
  ) then
    alter table public.stocks
      add constraint stocks_critical_level_non_negative
      check (critical_level is null or critical_level >= 0);
  end if;
end $$;

-- PostgREST şema önbelleğini yenile (yeni kolon API'de hemen görünsün)
notify pgrst, 'reload schema';

-- Doğrulama
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'stocks' and column_name = 'critical_level';

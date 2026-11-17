-- ==============================================================================
-- CTC MASTER LEDGER & CTCMARKET.COM - STOCKS WEB_UPDATED_AT TRIGGER
-- ==============================================================================
-- Bu trigger, stocks tablosundaki web alanları veya stok adedi değiştiğinde
-- web_updated_at alanını otomatik olarak now() ile günceller.
-- E-ticaret sitesi (ctcmarket.com) değişiklikleri bu alan üzerinden anında yakalar.
-- ==============================================================================
-- Supabase Dashboard -> SQL Editor alanında çalıştırılabilir.
-- ==============================================================================

create or replace function public.stocks_touch_web_updated_at()
returns trigger language plpgsql as $$
begin
  if (new.web_visible, new.web_category, new.web_sub_category, new.web_price, new.web_currency,
      new.name, new.sku, new.quantity)
     is distinct from
     (old.web_visible, old.web_category, old.web_sub_category, old.web_price, old.web_currency,
      old.name, old.sku, old.quantity) then
    new.web_updated_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_stocks_web_updated_at on public.stocks;
create trigger trg_stocks_web_updated_at
  before update on public.stocks
  for each row execute function public.stocks_touch_web_updated_at();

# CTC Master Ledger (ctc-erp) — Runbook

> Bu doküman **"ne yapmalıyım?"** sorusuna adım adım cevap verir: kurulum, dağıtım, günlük/aylık operasyon, arıza giderme ve veri onarımı. Sistemin nasıl çalıştığını anlamak için önce `docs/HANDBOOK.md` okunmalıdır; burada HANDBOOK'a `[HB §x]` şeklinde atıf yapılır.
>
> Uygulamada **geri alma yoktur** (HB KRİTİK-2). Her düzeltme adımından önce ilgili tablonun yedeğini alın (§8.1).
>
> **Güncelleme yükümlülüğü:** Yeni env değişkeni, deploy adımı, operasyon prosedürü, arıza senaryosu veya onarım SQL'i ekleyen her iş bu dokümanı **aynı commit içinde** günceller (kural: `CLAUDE.md › Çalışma kuralları §3`). Son güncelleme: 2026-09-16.

---

## İçindekiler

1. [Hızlı Referans](#1-hızlı-referans)
2. [Ortam ve Kurulum](#2-ortam-ve-kurulum)
3. [Veritabanı Kurulumu (Supabase)](#3-veritabanı-kurulumu-supabase)
4. [Dağıtım (Deploy)](#4-dağıtım-deploy)
5. [İlk Açılış: Sistemi Kullanıma Hazırlama](#5-ilk-açılış-sistemi-kullanıma-hazırlama)
6. [Operasyon Prosedürleri](#6-operasyon-prosedürleri)
7. [Arıza Giderme](#7-arıza-giderme)
8. [Veri Onarımı ve Bakım](#8-veri-onarımı-ve-bakım)
9. [Yedekleme ve Kurtarma](#9-yedekleme-ve-kurtarma)
10. [Kontrol Listeleri](#10-kontrol-listeleri)

---

## 1. Hızlı Referans

| İhtiyaç | Nereye git |
|---|---|
| Uygulamayı yerelde çalıştır | §2.3 |
| Yeni ortam (Supabase + Vercel) kur | §3, §4 |
| Gün sonu POS kapanışı | §6.1 |
| POS kart cirosunu bankaya geçir / komisyon kes | §6.2 |
| Ay sonu rapor + kontrol | §6.7 |
| Bakiye tutmuyor | §7.2, §8.2 |
| POS "Dünden Devir" yanlış | §7.4, §8.4 |
| Kredi kartı borcu aniden değişti | §7.3 (KRİTİK-1) |
| Kayıt silinemiyor | §7.6 |
| Kur bilgisi gelmiyor | §7.7 |
| Yedek al / geri yükle | §9 |

### Ortam değişkenleri

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Evet | Supabase proje URL'si (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Evet | Supabase `anon` public anahtarı |

Her ikisi `NEXT_PUBLIC_` ön ekli olduğu için **tarayıcıya gömülür**. `service_role` anahtarını **asla** bu değişkenlere koymayın.

### Dış bağımlılıklar

| Servis | Kullanım | Kesinti etkisi |
|---|---|---|
| Supabase (PostgREST) | Tüm veri | Uygulama boş listelerle açılır, kayıt yapılamaz |
| `open.er-api.com/v6/latest/USD` | USD/EUR kuru | Sabit yedek kur (34.25 / 37.80) devreye girer; TRY dönüşümleri sapar |

### İstemci tarafı depolama (localStorage)

| Anahtar | İçerik | Kaybolursa |
|---|---|---|
| `ctc_pos_config` | POS ayarları (merkez, depo, kasa, banka, kredi kartı) | POS kaydı kasa/banka/stok'a yansımaz; Ayarlar ⚙ yeniden girilir |
| `ctc_pos_draft_<YYYY-MM-DD>` | Kaydedilmemiş gün taslağı | O günün girilmemiş verisi kaybolur |

---

## 2. Ortam ve Kurulum

### 2.1 Gereksinimler
- Node.js 20+ (`@types/node ^20`), npm 10+
- Supabase projesi (Postgres 15+)
- Modern tarayıcı (Chrome/Edge önerilir; POS tarih seçici `showPicker()` kullanır)

### 2.2 Klonlama ve bağımlılıklar
```bash
git clone <repo-url> ctc-erp
cd ctc-erp
npm install
```

### 2.3 Yerel çalıştırma
```bash
cat > .env.local <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
EOF

npm run dev        # http://localhost:3000
```
`.env*` dosyaları `.gitignore`'dadır; repo'da örnek env dosyası **yoktur**.

> `next dev`, kökteki `AGENTS.md`/`CLAUDE.md` dosyalarını yeniden üretir. Bu diff'i commit'lemek normaldir.

### 2.4 Kalite kontrolleri
```bash
npm run lint       # eslint (core-web-vitals + typescript)
npm run build      # tip hataları ve derleme sorunları burada çıkar
```
Test paketi yoktur; `build` başarılıysa dağıtıma hazırdır.

---

## 3. Veritabanı Kurulumu (Supabase)

Repo'da migration bulunmaz. Aşağıdaki SQL, koddan çıkarılan şemayı **yeni bir ortam** için üretir [HB §5]. Mevcut bir veritabanına uygulamadan önce farkları kontrol edin.

### 3.1 Şema (referans SQL)

```sql
-- Yapısal
-- Kullanıcılar ve Rol Bazlı Yetkilendirme (Bkz. supabase/user_profiles.sql)
create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('admin', 'finance', 'cashier', 'warehouse', 'custom')) default 'admin',
  allowed_modules text[] not null default array[
    'dashboard', 'retail', 'cash-registers', 'bank-accounts', 'credit-cards',
    'stocks', 'services', 'suppliers', 'customers', 'expenses',
    'subscriptions', 'reports', 'companies', 'activity', 'users'
  ],
  allowed_companies text[] default null,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_personal boolean not null default false,
  created_at timestamptz default now()
);

create table if not exists warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text,
  company_id uuid references companies(id) on delete restrict,
  created_at timestamptz default now()
);

create table if not exists stock_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  warehouse_id uuid not null references warehouses(id) on delete cascade
);

create table if not exists stocks (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references warehouses(id) on delete cascade,
  name text not null,
  sku text, category text, sub_category text,
  currency text not null default 'TRY',
  unit text default 'Adet',
  quantity numeric not null default 0,
  unit_price numeric not null default 0,
  vat_rate numeric not null default 0,
  stock_color text,
  created_at timestamptz default now()
);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit_price numeric default 0, vat_rate numeric default 0,
  currency text default 'TRY',
  company_id uuid references companies(id) on delete restrict,
  created_at timestamptz default now()
);

create table if not exists expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  company_name text not null, contact_name text, phone text, email text,
  tax_office text, tax_id text, address text,
  balance numeric not null default 0, currency text default 'TRY',
  created_at timestamptz default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null, contact_name text, phone text, email text,
  tax_office text, tax_id text, address text,
  balance numeric not null default 0, currency text default 'TRY',
  created_at timestamptz default now()
);

-- Hesaplar ve hareketler
create table if not exists cash_registers (
  id uuid primary key default gen_random_uuid(),
  name text not null, balance numeric not null default 0,
  currency text not null default 'TRY',
  company_id uuid references companies(id) on delete restrict,
  created_at timestamptz default now()
);

create table if not exists cash_transactions (
  id uuid primary key default gen_random_uuid(),
  cash_register_id uuid not null references cash_registers(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  tx_date date not null, description text,
  tx_type text not null check (tx_type in ('in','out')),
  amount numeric not null, currency text, exchange_rate numeric default 1,
  is_transfer boolean default false, transfer_id text,
  created_at timestamptz default now()
);

create table if not exists bank_accounts (
  id uuid primary key default gen_random_uuid(),
  bank_name text not null, account_name text not null, iban text,
  balance numeric not null default 0, currency text not null default 'TRY',
  company_id uuid references companies(id) on delete restrict,
  created_at timestamptz default now()
);

create table if not exists bank_transactions (
  id uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references bank_accounts(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  tx_date date not null, description text,
  tx_type text not null check (tx_type in ('in','out')),
  amount numeric not null, currency text, exchange_rate numeric default 1,
  is_transfer boolean default false, transfer_id text,
  status text default 'completed' check (status in ('pending','completed')),
  created_at timestamptz default now()
);

create table if not exists credit_cards (
  id uuid primary key default gen_random_uuid(),
  name text not null, card_limit numeric default 0, cutoff_day int default 1,
  current_debt numeric not null default 0, card_color text,
  company_id uuid references companies(id) on delete restrict,
  created_at timestamptz default now()
);

create table if not exists card_transactions (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references credit_cards(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  tx_date date not null, description text,
  tx_type text not null check (tx_type in ('expense','payment')),
  amount numeric not null, transfer_id text,
  created_at timestamptz default now()
);

create table if not exists stock_transactions (
  id uuid primary key default gen_random_uuid(),
  stock_id uuid not null references stocks(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  tx_date date not null, description text,
  tx_type text not null check (tx_type in ('in','out')),
  quantity numeric not null, unit_price numeric default 0,
  currency text default 'TRY', vat_rate numeric default 0,
  created_at timestamptz default now()
);

-- Cari hareketler
create table if not exists supplier_transactions (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references suppliers(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  tx_date date not null, description text,
  tx_type text not null check (tx_type in ('debt','payment')),
  amount numeric not null, currency text default 'TRY', exchange_rate numeric default 1,
  is_detailed boolean default false, invoice_lines jsonb,
  payment_source_type text, payment_source_id uuid,
  created_at timestamptz default now()
);

create table if not exists customer_transactions (like supplier_transactions including all);
alter table customer_transactions drop column supplier_id;
alter table customer_transactions add column customer_id uuid not null references customers(id) on delete cascade;

-- Gider
create table if not exists expense_transactions (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references expense_categories(id) on delete restrict,
  company_id uuid references companies(id) on delete restrict,
  tx_date date not null, description text,
  amount numeric not null, currency text default 'TRY', exchange_rate numeric default 1,
  payment_source_type text, payment_source_id uuid, transfer_id text,
  created_at timestamptz default now()
);

-- Abonelik
create table if not exists credit_wallets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete set null,
  supplier_id uuid not null references suppliers(id) on delete restrict,
  name text not null, balance int not null default 0,
  unit_cost numeric default 0, currency text default 'USD',
  fifo_lots jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists credit_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete set null,
  wallet_id uuid references credit_wallets(id) on delete set null,
  username text not null, full_name text not null, phone text, reference_note text,
  start_date date not null, end_date date not null,
  cost_price numeric default 0, sale_price numeric default 0, currency text default 'TRY',
  is_active boolean default true, is_paid boolean default false,
  payment_source_type text, payment_source_id uuid,
  created_at timestamptz default now()
);

-- POS
create table if not exists pos_daily_summaries (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  opening_cash numeric default 0, photo_cash numeric default 0, photo_card numeric default 0,
  daily_notes text,
  created_at timestamptz default now()
);

create table if not exists pos_transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null, category_id text not null, description text,
  cost numeric default 0, cash numeric default 0, card numeric default 0,
  stock_id uuid references stocks(id) on delete set null,
  quantity numeric default 1,
  company_id uuid references companies(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists pos_bank_transfers (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  transfer_type text not null check (transfer_type in ('to_bank','from_bank')),
  bank_id uuid references bank_accounts(id) on delete cascade,
  amount numeric not null, description text,
  created_at timestamptz default now()
);

-- Denetim
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  module text not null, action text not null, description text,
  record_id text, amount numeric default 0, currency text,
  old_data jsonb, new_data jsonb, company_id uuid,
  created_at timestamptz default now()
);

-- Performans için önerilen indeksler
create index if not exists idx_cash_tx_reg on cash_transactions(cash_register_id);
create index if not exists idx_cash_tx_trf on cash_transactions(transfer_id);
create index if not exists idx_bank_tx_acc on bank_transactions(bank_account_id);
create index if not exists idx_bank_tx_trf on bank_transactions(transfer_id);
create index if not exists idx_card_tx_card on card_transactions(card_id);
create index if not exists idx_stock_tx_stock on stock_transactions(stock_id);
create index if not exists idx_supp_tx_supp on supplier_transactions(supplier_id);
create index if not exists idx_cust_tx_cust on customer_transactions(customer_id);
create index if not exists idx_pos_tx_date on pos_transactions(date);
create index if not exists idx_audit_created on audit_logs(created_at desc);
```

> **`credit_card_transactions` hakkında:** POS modülü bu tabloya yazar [HB KRİTİK-1]. Yeni ortamda bu tabloyu **oluşturmayın**; bunun yerine kod düzeltmesi yapılmalıdır (§7.3). Tablo yoksa POS kartlı gider insert'i sessizce başarısız olur ve mevcut kart borcuna zarar vermez.

### 3.2 Cascade kararları
Yukarıdaki SQL şu politikayı uygular:
- Hesap silinince (kasa/banka/kart/stok/cari) **kendi hareketleri** silinir (`cascade`). Uygulama UI'daki uyarılarla uyumludur.
- `companies` silinince bağlı hesap varsa **engellenir** (`restrict`); hareketlerdeki `company_id` `NULL` olur. Uygulama "bağlı kayıt varsa sistem izin vermez" der; uyumludur.
- `expense_categories` ve `services` kullanımdaysa silme engellenir; uygulama bu hatayı yakalar.

### 3.3 Row Level Security (RLS)
Uygulama `anon` anahtarla yazar. Seçenekler:

**Seçenek A — Tek kullanıcılı, özel ağ (mevcut durum):** RLS kapalı veya `anon` için tam izin. **Yalnız** uygulama URL'si dışa açık değilse kabul edilebilir.

**Seçenek B — Önerilen:** Supabase Auth ekleyip tüm tablolarda `authenticated` rolüne izin, `anon`'a hiç izin vermemek. Bu, `lib/supabase.ts` ve bir login sayfası gerektirir (kod değişikliği).

Geçici sertleştirme (kod değişikliği olmadan): Vercel/Cloudflare önünde Basic Auth veya IP allowlist.

### 3.4 PostgREST satır limiti
Varsayılan `max_rows = 1000`. Uygulama `.limit()` kullanmaz; herhangi bir hesabın hareket sayısı 1000'i aşınca **bakiye eksik hesaplanır** [HB Y-4]. Supabase Dashboard → Settings → API → "Max rows" değerini beklenen hacme göre yükseltin (örn. 10000) ve §8.2 kontrolünü aylık çalıştırın.

---

## 4. Dağıtım (Deploy) ve Canlı Üretim Protokolü

### 4.0 Canlı Üretim (Production) ve Sıfır Veri Kaybı Protokolü (ZORUNLU)
> 🔴 **Sistem canlıda kullanılmaktadır (GitHub → Vercel CI/CD).**
> `main` dalına atılan her commit doğrudan Vercel üzerinden anında canlıya dağıtılır. Gerçek stok, cari, kasa ve fiş verileri girilmektedir. **Geri dönüşü olmayan veri kaybına sebep olacak hiçbir işlem yapılamaz.**

- **Kesin Veri Kaybı Yasağı (Zero Data Loss):**
  - Tabloları sıfırlamak, `DROP TABLE`, `TRUNCATE` veya veri düşüren `ALTER TABLE` çalıştırmak kesinlikle **YASAKTIR**.
  - Canlı stokları, cari bakiyeleri veya geçmiş hareketleri sıfırlayan veya bozan hiçbir işlem yapılamaz.
- **Migration & Veri İnceleme Önceliği:**
  - Veritabanına herhangi bir müdahale öncesinde **MUTLAKA mevcut veriler incelenir** (`SELECT ...`, satır sayıları ve mevcut kolon tipleri kontrol edilir).
  - Şema güncellemeleri yalnızca geriye dönük uyumlu (additive / backwards compatible) migration dosyaları (`supabase/*.sql`) olarak yazılır (`ADD COLUMN IF NOT EXISTS` vb.).
- **Supabase Doğrudan Bağlantı & Ajan Özerkliği:**
  - Ajan, yerel `.env.local` dosyasındaki `SUPABASE_SERVICE_ROLE_KEY` ile veritabanına doğrudan bağlanarak veri doğrulama, okuma, senkronizasyon ve analizleri kendi araçlarıyla yürütür. Kullanıcıya gereksiz yere SQL çalıştırma veya manuel script kopyalama yükü verilmez.
- **Pre-Push Kapısı (`npm run build`):**
  - `origin main`'e push yapmadan önce yerelde `npm run build` MUTLAKA çalıştırılmalı ve 0 hata ile derlendiği teyit edilmelidir. Vercel derlemesini bozacak hiçbir commit canlıya atılamaz.

### 4.1 Vercel (Canlı CI/CD)
1. Repo Vercel'e bağlıdır; `main` branch'ine push yapıldığında otomatik build ve deploy tetiklenir.
2. Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (Production + Preview).
3. Build command `next build`, output varsayılan.
4. Deploy sonrası `/` açılarak dashboard kartlarının değerleri doğru gösterdiği teyit edilir.

### 4.2 Kendi sunucusu
```bash
npm ci
npm run build
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... npm start   # :3000
```
Ters proxy (nginx/Caddy) ile HTTPS ve **Basic Auth** ekleyin (§3.3).

### 4.3 Sürüm güncelleme ve Migration Sırası
```bash
git pull
npm ci
npm run build && npm start   # veya Vercel otomatik deploy
```
Şema değişikliği varsa **önce SQL migration (geriye dönük uyumlu), sonra deploy** sırası izlenir; kod eski kolonları `undefined` okur, yeni kolon eksikse toplamlar `NaN` olur.

---

## 5. İlk Açılış: Sistemi Kullanıma Hazırlama

Sıra önemlidir; sonraki adımlar öncekilere referans verir.

1. **Şirketler / Merkezler** → ticari şirketleri ve şahsi merkezleri ekle.
2. **Nakit Kasalar** → her fiziksel kasa için kasa oluştur; **açılış bakiyesini** gir. Para birimi sonradan değiştirilemez.
3. **Banka Hesapları** → hesapları IBAN ve açılış bakiyesiyle ekle.
4. **Kredi Kartları** → limit, ekstre günü, dönem başı devir borcu.
5. **Stok Yönetimi** → depo(lar) → kategoriler → stok kartları (açılış stoğu ve net maliyet).
6. **Hizmet Yönetimi** → faturada kullanılacak hizmet kartları.
7. **Genel Giderler** → gider kategorileri.
8. **Satıcılar / Müşteriler** → cari kartlar ve devir bakiyeleri (hangi merkeze ait olduğu ile).
9. **Abonelik** → tedarikçi seçerek kredi cüzdanı; varsa açılış kredisi ve birim maliyeti.
10. **POS Ayarları ⚙** (`/retail`) → merkez, depo, nakit kasa, kart bankası, kartlı gider kredi kartı. **Bu ayar tarayıcıya kaydedilir**; POS kullanılacak her cihazda tekrar yapılmalıdır.
11. **Doğrulama** → Dashboard'da Net Finansal Durum ve kart toplamlarının açılış değerleriyle uyuştuğunu kontrol et.

---

## 6. Operasyon Prosedürleri

### 6.1 Gün Sonu: POS Z-Raporu Kapanışı
**Ne zaman:** Her mağaza günü sonunda, tek cihazdan.

1. `/retail` aç; tarihin bugün olduğunu doğrula (sağ üst). Gerekirse ◀ ▶ ile değiştir.
2. Amber "Sistem kapanması algılandı" şeridi varsa taslak geri yüklenmiştir; içeriği kontrol et.
3. Her kategori kutusuna satırları gir:
   - Ürün stoktan düşecekse açıklamaya yazmaya başla → açılan listeden seç (yeşil 📦 simgesi belirir, maliyet otomatik dolar). Adet değişince maliyet yeniden hesaplanır.
   - Serbest satışta maliyeti **elle** gir; Servis ve Gider hariç maliyetsiz satış kaydı engellenir.
   - 👁 ile Maliyet sütununu göster/gizle.
4. Fotokopi N/K alanlarını doldur (maliyet otomatik %50).
5. Gider & Masraf kutusuna nakit/kartlı giderleri gir. Kartlı gider varsa ⚙'de kredi kartı seçili olmalı.
6. Bankaya yatırılan / bankadan çekilen varsa 🏦 → "Geçici Listeye Ekle".
7. Üst şeritteki **Kasa** değerini fiziksel kasayla karşılaştır.
8. **Günü Kaydet** → "Kaydediliyor…" → "Hesaplar İşleniyor…" → "Kaydedildi ✅".
9. Doğrulama: `/cash-registers` seçili kasada `Mağaza POS/Z-Raporu` etiketli giriş/çıkış; `/bank-accounts` ilgili hesapta `⏱ Bekleyen Provizyon`; `/stocks` düşen miktarlar.

**Geçmiş bir günü düzeltmek:** Tarihi seç, değiştir, Günü Kaydet. O günün tüm POS yansımaları silinip yeniden yazılır; sonraki günlerin "Dünden Devir" değerleri zincirleme güncellenir. **Uyarı:** o gün bankada girilen POS komisyonu (`POS-Z-CARD-COMM-<tarih>`) da silinir; §6.2'yi tekrar yapın.

### 6.2 POS Kart Cirosunu Hesaba Geçirme (Provizyon Onayı)
**Ne zaman:** Banka ekstresinde POS tutarı göründüğünde (genelde +1 iş günü).

1. `/bank-accounts` → POS bankasını seç.
2. `⏱ Bekleyen Provizyon` satırında yeşil ✔ butonuna bas.
3. **Valör tarihi:** ekstrede paranın geçtiği gün. **Komisyon:** ekstredeki kesinti (yoksa boş).
4. "Tahsilatı Onayla ve İşle". Satır `completed` olur, bakiyeye girer; komisyon ayrı `out` satırı olarak düşer.

### 6.3 Gider Girişi
1. `/expenses` → form: tarih, **merkez (zorunlu)**, kategori, ödeme kaynağı (kasa/banka/kart), açıklama, döviz (+kur), tutar → Ekle.
2. Kaynağa otomatik `Gider Ödemesi [Merkez] - Açıklama` hareketi yazılır.
3. **Düzenleme yoktur.** Hata varsa 🗑 ile sil (kaynak iade edilir) ve yeniden gir.
4. Kasa/banka ekranından bu hareket **silinemez**; yalnız Giderler'den silinir.

### 6.4 Tedarikçi Alımı ve Ödemesi
**Basit borç:** `/suppliers` → tedarikçi → yön "Borç / Fatura Geldi (+)" → tutar/döviz/kur → Ekle.
**Detaylı alım faturası (stok girişli):** "Detaylı Fatura Gir" → merkez, tarih, belge no, döviz → satırlar:
- Ürün adı yazınca mevcut stoklar listelenir; seçince "Stok" işaretlenir, depo kilitlenir.
- Yeni ürün için adı yaz, "Stok" işaretle, depo seç → kayıtta **yeni stok kartı açılır**.
- "Faturayı Kaydet" → cari borç + stok `in` hareketleri.
**Ödeme:** yön "Ödeme Yapıldı (−)", kaynak seç (kasa/banka/kart) → Ekle. Kaynağa `Tedarikçi Ödemesi (…)` hareketi yazılır.
**Düzenleme/Silme:** satırdaki ✏ / 🗑. Silme, bağlı stok hareketlerini ve kaynak ödemesini geri alır.

### 6.5 Müşteri Satışı ve Tahsilatı
Tedarikçiyle aynı akış; farklar:
- Detaylı faturada satır türü **Ürün / Hizmet**; ürünlerde "Düş (−)" ile stoktan çıkış. Yalnız `quantity > 0` ürünler listelenir.
- Tahsilat kaynağı yalnız kasa veya banka.

### 6.6 Abonelik Yaşam Döngüsü
1. **Cüzdan aç:** `/subscriptions` → Yeni Cüzdan → ad, tedarikçi, para birimi (kilitlenir), açılış kredisi/maliyet.
2. **Kredi yükle:** cüzdan kartında "Yükle" → adet, birim fiyat, döviz, kur → "Satın Al & Yükle". Tedarikçi cari borcu artar.
3. **Satış:** "Yeni Abonelik Satışı" → merkez, kullanıcı adı, ad soyad, başlangıç, cüzdan, satış fiyatı/döviz → Kaydet. Cüzdandan 1 kredi düşer, `Ödenmedi` açılır, TopBar'da "Tahsilat Bekliyor" bildirimi çıkar.
4. **Tahsilat:** satırda "Tahsil Et" → kasa/banka seç. Tutar hesap para birimine anlık kurla çevrilir.
5. **Yenileme:** bitişe ≤15 gün kala turuncu uyarı; "+1 Yıl Uzat" → yeni kayıt (`Ödenmedi`), 1 kredi düşer. Eski kayıt listede kalır.
6. **İptal:** 🗑 → kredi cüzdana **başa** iade edilir, tahsilat varsa kasa/banka girişi silinir.

### 6.7 Ay Sonu Kontrol ve Rapor
1. Tüm POS günlerinin kaydedildiğini doğrula (`/retail` ile son günleri gez; "Günü Kaydet" pasifse kayıtlıdır).
2. Bekleyen provizyonları kapat (§6.2).
3. `/reports` → merkez + "Geçen Ay" → tabloları banka ekstreleriyle karşılaştır. **Raporu Yazdır** → PDF olarak kaydet.
4. §8.2 tutarlılık sorgusunu çalıştır; fark varsa §8.3 ile düzelt.
5. `/` Dashboard'da P&L ve trend değerlerini not al.
6. Yedek al (§9.1).

### 6.8 Yeni Hesap / Kart / Depo Açma
İlgili modülde "Yeni …" → merkez seç → kaydet. Açılış bakiyesi her zaman **hareket olarak** oluşturulur; sonradan düzenlemek için kartı düzenle → açılış alanını değiştir (0 yazılırsa hareket silinir).

### 6.9 Hesap Kapatma / Silme
1. Önce hareket tablosunu gözden geçir; çapraz modül hareketleri (`Gider Ödemesi`, `Tedarikçi Ödemesi`, `Müşteri Tahsilatı`, `Mağaza POS`) varsa **kaynak modülden** sil veya başka hesaba taşı (uygulamada taşıma yok; §8.5).
2. Sonra hesabı sil. Hareketler cascade ile gider; `audit_logs`'ta `DELETE` kaydı kalır.
3. POS ayarları bu hesabı gösteriyorsa ⚙'den güncelle.

---

## 7. Arıza Giderme

### 7.1 Uygulama açılıyor ama tüm listeler boş / dashboard "…" gösteriyor
- Tarayıcı konsolunda `Failed to fetch` veya `401/403` → env değişkenleri yanlış ya da RLS `anon`'u engelliyor.
- Kontrol: `curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/companies?select=id" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"` → `[]` veya satır dönmeli.
- Vercel'de env değişkeni sonradan eklendiyse **yeniden deploy** gerekir (`NEXT_PUBLIC_` derleme zamanında gömülür).

### 7.2 Kasa / banka / kart / cari bakiyesi hareket toplamıyla tutmuyor
Olası nedenler: yarım kalmış çok adımlı işlem [HB KRİTİK-4], 1000 satır limiti [HB Y-4], doğrudan SQL ile yapılan değişiklik.
1. §8.2 sorgusuyla farkı ölç.
2. Fark tek hesapta ve küçükse: o hesapta **herhangi bir** hareket ekle-sil (uygulama yeniden hesaplar) veya §8.3 SQL'ini çalıştır.
3. Fark 1000 hareketten fazla hesaplarda görünüyorsa §3.4.

### 7.3 Kredi kartı borcu POS gün kaydından sonra sıfırlandı / yanlış
Neden: [HB KRİTİK-1] — POS, `credit_card_transactions` tablosundan hesapladığı borcu `credit_cards.current_debt` üzerine yazar.
**Anlık çözüm:** `/credit-cards` → ilgili kartta herhangi bir hareket ekle ve sil; borç `card_transactions`'tan yeniden hesaplanır. POS kartlı gideri bu toplamda **yer almaz**; gideri ayrıca `/credit-cards` → "Harcama" olarak elle gir.
**Kalıcı çözüm (kod):** `app/retail/page.tsx` içinde
- `credit_card_transactions` → `card_transactions`, `credit_card_id` → `card_id`, `tx_type: 'out'` → `'expense'`, `transfer_id: 'POS-Z-CARD-EXP-<tarih>'` ekle;
- eski kayıt temizliğini `transfer_id LIKE 'POS-%-<tarih>'` ile yap;
- kart yeniden hesaplamasını diğer modüllerdeki `recalculateAbsoluteCardDebt` ile aynı formüle getir.
Sonra `credit_card_transactions` tablosu boşaltılıp kaldırılabilir.

### 7.4 POS "Dünden Devir" yanlış
- İlk gün devri, ⚙'de seçili kasanın `Açılış Bakiyesi / Devir` hareketinden alınır; yoksa **0** olur. Kasayı düzenle → açılış bakiyesi gir → herhangi bir POS gününü yeniden kaydet (zincir yeniden hesaplanır).
- Ara bir gün kaydedilmemişse zincir o günü atlar; eksik günü aç ve (boş olsa da) **Günü Kaydet**.
- Manuel düzeltme: §8.4.

### 7.5 POS "Günü Kaydet" pasif
- Değişiklik yapılmadı (`hasUnsavedChanges=false`) veya veri hâlâ yükleniyor.
- "Kaydedildi ✅" 3 sn sonra idle olur. Hâlâ pasifse sayfayı yenile.

### 7.6 Kayıt silinemiyor
| Mesaj | Anlamı | Çözüm |
|---|---|---|
| "Bu işlem harici bir modülden … otomatik yansımıştır" | `SUPP-/CUST-/EXP-/POS-` ön ekli hareket | Kaynak modülden sil (Kaynak kayıt silinmişse kart/kasa/banka ekranı otomatik olarak "Yetim Hareketi Sil" onayı sunar) |
| "Silinemedi! Bu merkeze bağlı hareketler/hesaplar bulunuyor" | FK restrict | Önce bağlı kasa/banka/depo/gideri taşı veya sil |
| "Silinemedi! Bu kategoriye ait kayıtlı giderler var" | FK restrict | Giderleri başka kategoriye al (SQL: §8.5) |
| "Silme başarısız! … faturada kullanılmış" | Hizmet FK | Faturayı düzenle |

### 7.7 Kurlar "…" veya çok eski görünüyor
- `open.er-api.com` erişimi engelli (kurumsal ağ/adblock) → sabit yedek 34.25/37.80 devreye girer. Dashboard TRY toplamları ve döviz hesap dönüşümleri **yanlış** olur.
- Kontrol: tarayıcıda `https://open.er-api.com/v6/latest/USD` aç.
- Geçici: döviz işlemlerinde kuru **elle** gir (form kur alanı düzenlenebilir). Kalıcı: yedek kurları güncel değere çek veya kur kaynağını sunucu tarafına taşı.

### 7.8 Aynı gün iki cihazdan POS girildi
Son kaydeden kazanır (`pos_transactions` o gün için silinip yeniden yazılır). Kaybolan cihazdaki `ctc_pos_draft_<tarih>` taslağı sayfa açılınca geri yüklenir; iki taslağı birleştirip tek cihazdan kaydedin.

### 7.9 "Geri Al" bastım ama hiçbir şey değişmedi
Beklenen davranış [HB KRİTİK-2]. Geri alma yalnız log satırı ekler. Gerçek düzeltme için ilgili modülden sil/yeniden gir veya §8'deki SQL prosedürlerini uygulayın.

### 7.10 Konsolda `Received true for a non-boolean attribute jsx`
`<style jsx global>` kullanımından kaynaklanır [HB O-9]; işlevsel etkisi yoktur.

---

## 8. Veri Onarımı ve Bakım

> Tüm SQL'ler Supabase → SQL Editor'da çalıştırılır. Önce §8.1 ile yedek alın. Uygulama önbelleği yoktur; sayfa yenilenince yeni değer görünür.

### 8.1 Hızlı tablo yedeği
```sql
create table backup_cash_transactions_20260916 as table cash_transactions;
create table backup_bank_transactions_20260916 as table bank_transactions;
-- gerekli diğer tablolar için tekrarla
```

### 8.2 Bakiye tutarlılık kontrolü (salt okunur)
```sql
-- Kasalar
select c.id, c.name, c.balance as stored,
       coalesce(sum(case when t.tx_type='in' then t.amount else -t.amount end),0) as computed
from cash_registers c left join cash_transactions t on t.cash_register_id=c.id
group by c.id having c.balance <> coalesce(sum(case when t.tx_type='in' then t.amount else -t.amount end),0);

-- Bankalar (pending hariç)
select b.id, b.bank_name, b.balance as stored,
       coalesce(sum(case when t.tx_type='in' then t.amount else -t.amount end),0) as computed
from bank_accounts b left join bank_transactions t on t.bank_account_id=b.id and t.status is distinct from 'pending'
group by b.id having b.balance <> coalesce(sum(case when t.tx_type='in' then t.amount else -t.amount end),0);

-- Kredi kartları
select k.id, k.name, k.current_debt as stored,
       coalesce(sum(case when t.tx_type='expense' then t.amount else -t.amount end),0) as computed
from credit_cards k left join card_transactions t on t.card_id=k.id
group by k.id having k.current_debt <> coalesce(sum(case when t.tx_type='expense' then t.amount else -t.amount end),0);

-- Stoklar
select s.id, s.name, s.quantity as stored,
       coalesce(sum(case when t.tx_type='in' then t.quantity else -t.quantity end),0) as computed
from stocks s left join stock_transactions t on t.stock_id=s.id
group by s.id having s.quantity <> coalesce(sum(case when t.tx_type='in' then t.quantity else -t.quantity end),0);

-- Tedarikçiler / Müşteriler (TRY)
select s.id, s.company_name, s.balance as stored,
       coalesce(sum(case when t.tx_type='debt' then 1 else -1 end * t.amount * coalesce(t.exchange_rate,1)),0) as computed
from suppliers s left join supplier_transactions t on t.supplier_id=s.id
group by s.id having abs(s.balance - coalesce(sum(case when t.tx_type='debt' then 1 else -1 end * t.amount * coalesce(t.exchange_rate,1)),0)) > 0.01;

select c.id, c.name, c.balance as stored,
       coalesce(sum(case when t.tx_type='debt' then 1 else -1 end * t.amount * coalesce(t.exchange_rate,1)),0) as computed
from customers c left join customer_transactions t on t.customer_id=c.id
group by c.id having abs(c.balance - coalesce(sum(case when t.tx_type='debt' then 1 else -1 end * t.amount * coalesce(t.exchange_rate,1)),0)) > 0.01;

-- Cüzdanlar
select w.id, w.name, w.balance as stored,
       coalesce((select sum((l->>'qty')::numeric) from jsonb_array_elements(w.fifo_lots) l),0) as computed
from credit_wallets w
where w.balance <> coalesce((select sum((l->>'qty')::numeric) from jsonb_array_elements(w.fifo_lots) l),0);
```

### 8.3 Tüm bakiyeleri yeniden hesapla (onarım)
```sql
update cash_registers c set balance = coalesce((select sum(case when tx_type='in' then amount else -amount end) from cash_transactions where cash_register_id=c.id),0);
update bank_accounts b set balance = coalesce((select sum(case when tx_type='in' then amount else -amount end) from bank_transactions where bank_account_id=b.id and status is distinct from 'pending'),0);
update credit_cards k set current_debt = coalesce((select sum(case when tx_type='expense' then amount else -amount end) from card_transactions where card_id=k.id),0);
update stocks s set quantity = coalesce((select sum(case when tx_type='in' then quantity else -quantity end) from stock_transactions where stock_id=s.id),0);
update suppliers s set balance = coalesce((select sum(case when tx_type='debt' then 1 else -1 end * amount * coalesce(exchange_rate,1)) from supplier_transactions where supplier_id=s.id),0);
update customers c set balance = coalesce((select sum(case when tx_type='debt' then 1 else -1 end * amount * coalesce(exchange_rate,1)) from customer_transactions where customer_id=c.id),0);
update credit_wallets w set balance = coalesce((select sum((l->>'qty')::numeric) from jsonb_array_elements(w.fifo_lots) l),0);
```

### 8.4 POS devir zincirini yeniden kur
Uygulama içinden: herhangi bir POS gününü aç → küçük bir değişiklik yap → Günü Kaydet → `syncForwardBalances` tüm günleri yeniden yazar. Bu, ⚙'deki kasanın `Açılış Bakiyesi / Devir` hareketini ilk gün devri olarak kullanır.

Yalnız kontrol için:
```sql
select d.date, d.opening_cash,
  d.opening_cash + d.photo_cash
  + coalesce((select sum(cash) from pos_transactions t where t.date=d.date and t.category_id not in ('gider','fotokopi')),0)
  - coalesce((select sum(cash) from pos_transactions t where t.date=d.date and t.category_id='gider'),0)
  - coalesce((select sum(amount) from pos_bank_transfers b where b.date=d.date and b.transfer_type='to_bank'),0)
  + coalesce((select sum(amount) from pos_bank_transfers b where b.date=d.date and b.transfer_type='from_bank'),0) as closing
from pos_daily_summaries d order by d.date;
```
Her satırın `closing` değeri bir sonraki satırın `opening_cash` değerine eşit olmalıdır.

### 8.5 Yetim / çapraz kayıt temizliği
```sql
-- Kaynağı silinmiş gider yansımaları (EXP-<id> ama expense yok)
select * from cash_transactions t where t.transfer_id like 'EXP-%'
  and not exists (select 1 from expense_transactions e where 'EXP-'||e.id::text = t.transfer_id);
-- aynı sorguyu bank_transactions / card_transactions ve SUPP-/CUST- ön ekleri için tekrarla

-- Tek bacağı kalmış virmanlar (TRF- id'si yalnız bir tabloda bir kez geçiyor)
select transfer_id, count(*) from (
  select transfer_id from cash_transactions where transfer_id like 'TRF-%'
  union all select transfer_id from bank_transactions where transfer_id like 'TRF-%'
) x group by transfer_id having count(*) <> 2;

-- Gider kategorisini taşı (silmeden önce)
update expense_transactions set category_id = '<yeni-kategori-id>' where category_id = '<eski-kategori-id>';

-- Silinmiş ödeme kaynağına işaret eden giderler
select e.* from expense_transactions e
where (e.payment_source_type='cash' and not exists (select 1 from cash_registers where id=e.payment_source_id))
   or (e.payment_source_type='bank' and not exists (select 1 from bank_accounts where id=e.payment_source_id))
   or (e.payment_source_type='card' and not exists (select 1 from credit_cards where id=e.payment_source_id));
```
Temizlik sonrası **§8.3** çalıştırın.

### 8.6 `audit_logs` büyümesi
Uygulama yalnız son 200 kaydı gösterir; tablo sınırsız büyür. Yıllık arşiv:
```sql
create table audit_logs_2025 as select * from audit_logs where created_at < '2026-01-01';
delete from audit_logs where created_at < '2026-01-01';
```

### 8.7 Eski `date` kolonu → `tx_date` (expense_transactions)
```sql
update expense_transactions set tx_date = date where tx_date is null and date is not null;
-- doğruladıktan sonra: alter table expense_transactions drop column date;
```
Kod `tx_date || date || created_at` okuduğu için kolon kalsa da zarar vermez.

### 8.8 Yedek kurları güncelleme (kod)
`34.25` / `37.80` sabitleri şu dosyalarda geçer: `app/page.tsx`, `app/reports/page.tsx`, `app/expenses/page.tsx`, `app/suppliers/page.tsx`, `app/customers/page.tsx`, `app/subscriptions/page.tsx`, `app/stocks/page.tsx`, `app/retail/page.tsx`, `app/components/TopBarRates.tsx`. Tek bir `lib/rates.ts` sabitine taşınması önerilir.

---

## 9. Yedekleme ve Kurtarma

### 9.1 Yedek alma
- **Supabase otomatik yedek:** Pro planda günlük; Dashboard → Database → Backups.
- **Manuel dump:**
  ```bash
  pg_dump "postgresql://postgres:<pwd>@db.<ref>.supabase.co:5432/postgres" \
    --schema=public --no-owner --format=custom -f ctc_$(date +%F).dump
  ```
- **Ay sonu PDF:** §6.7 adım 3 çıktısı, muhasebe için bağımsız kanıt.
- **POS ayarları:** `ctc_pos_config` localStorage değerini (DevTools → Application) not edin; cihaz değişiminde gerekir.

### 9.2 Geri yükleme
```bash
pg_restore --clean --if-exists --no-owner \
  -d "postgresql://postgres:<pwd>@db.<ref>.supabase.co:5432/postgres" ctc_2026-09-16.dump
```
Sonra §8.3 ve §8.2 ile tutarlılığı doğrula; POS günlerinden birini yeniden kaydederek devir zincirini tazele (§8.4).

### 9.3 Tekil kayıt kurtarma
`audit_logs.old_data` silinen kaydın JSON kopyasını tutar (`DELETE` satırları). Örnek:
```sql
select created_at, module, description, old_data from audit_logs
where action='DELETE' and module='cash_tx' order by created_at desc limit 20;
```
JSON'daki alanlarla ilgili tabloya `insert` yapılır, ardından §8.3.

---

## 10. Kontrol Listeleri

### Günlük
- [ ] POS günü kaydedildi (§6.1); "Kaydedildi ✅" görüldü.
- [ ] Ekrandaki Kasa değeri fiziksel kasayla eşleşti.
- [ ] TopBar bildirimlerinde "Tahsilat Bekliyor" kalemleri gözden geçirildi.

### Haftalık
- [ ] Bekleyen provizyonlar kapatıldı (§6.2).
- [ ] Yaklaşan abonelikler (≤15 gün) müşteriyle görüşüldü.
- [ ] Gider girişleri kategorileriyle kontrol edildi.

### Aylık
- [ ] §6.7 ay sonu prosedürü tamamlandı; PDF arşivlendi.
- [ ] §8.2 tutarlılık sorguları temiz.
- [ ] Yedek alındı (§9.1).
- [ ] 1000 satır limitine yaklaşan hesap var mı: `select cash_register_id, count(*) from cash_transactions group by 1 order by 2 desc limit 5;`

### Dağıtım öncesi
- [ ] `npm run lint` ve `npm run build` temiz.
- [ ] Şema değişikliği varsa SQL önce uygulandı ve HANDBOOK §5 güncellendi.
- [ ] Env değişkenleri hedef ortamda mevcut.
- [ ] Deploy sonrası `/` ve `/retail` açılıp veri geldiği görüldü.

# CTC Master Ledger (ctc-erp) — Handbook

> Bu doküman projenin **ne olduğunu, nasıl çalıştığını ve hangi kurallara göre para/stok hareketi ürettiğini** anlatır. Operasyonel adımlar (kurulum, dağıtım, arıza giderme, veri onarımı) için `docs/RUNBOOK.md` dosyasına bakın.
>
> Kaynak: `781c870 ERP Guncel Ana Omurga ve POS` commit'i üzerinden kodun tamamı okunarak hazırlandı. Repo'da veritabanı şeması (SQL/migration) bulunmadığı için tablo ve kolon bilgileri **koddan tümevarımla** çıkarılmıştır.
>
> **Güncelleme yükümlülüğü:** Bu doküman kodla birlikte yaşar. Tablo, kolon, formül, iş kuralı, ekran veya yan etki değiştiren her commit ilgili bölümü **aynı commit içinde** günceller (kural: `CLAUDE.md › Çalışma kuralları §3`). Son güncelleme: 2026-09-16.

---

## İçindekiler

1. [Proje Özeti](#1-proje-özeti)
2. [Teknoloji Yığını ve Repo Yapısı](#2-teknoloji-yığını-ve-repo-yapısı)
3. [Mimari](#3-mimari)
4. [Temel Kavramlar](#4-temel-kavramlar)
5. [Veri Modeli (Supabase Tabloları)](#5-veri-modeli-supabase-tabloları)
6. [Çekirdek İş Kuralları](#6-çekirdek-iş-kuralları)
7. [Modül Rehberi](#7-modül-rehberi)
8. [Modüller Arası Veri Akışları](#8-modüller-arası-veri-akışları)
9. [Ortak UI Bileşenleri ve Kodlama Kalıpları](#9-ortak-ui-bileşenleri-ve-kodlama-kalıpları)
10. [Bilinen Sorunlar ve Teknik Borç](#10-bilinen-sorunlar-ve-teknik-borç)
11. [Geliştirme Kılavuzu](#11-geliştirme-kılavuzu)
12. [Sözlük](#12-sözlük)

---

## 1. Proje Özeti

**CTC Master Ledger**, tek kullanıcılı (yönetici odaklı) bir **finans + stok + perakende (POS) defter** uygulamasıdır. Bir "holding" yapısındaki birden fazla ticari şirketin ve şahsi masraf merkezlerinin şu kalemlerini tek ekrandan takip eder:

| Alan | Kapsam |
|---|---|
| Nakit | Kasalar, kasa hareketleri, kasa↔banka virman |
| Banka | Hesaplar, hareketler, bekleyen POS provizyonları, komisyon |
| Kredi kartı | Kartlar, harcama/ödeme ekstresi, limit takibi |
| Stok | Depolar, kategoriler, stok kartları, giriş/çıkış hareketleri |
| Hizmet | Stok dışı hizmet kartları (fatura satırı olarak kullanılır) |
| Cari | Tedarikçi (borç) ve müşteri (alacak) hesapları, detaylı faturalar |
| Gider | Kategorili genel giderler, ödeme kaynağına otomatik yansıma |
| Abonelik | Kredi cüzdanları (FIFO maliyet), yıllık lisans satışları, tahsilat |
| POS | Günlük mağaza Z-raporu girişi; kasa/banka/stok/kart modüllerine senkron |
| Rapor | Dönemsel kaynak dağılımı ve dönem başı/sonu mizan tabloları, yazdırma |
| Denetim | Tüm yazma işlemlerinin `audit_logs` tablosuna kaydı |

Arayüz dili **Türkçe**, para birimleri **TRY / USD / EUR**, raporlama para birimi **TRY**'dir.

---

## 2. Teknoloji Yığını ve Repo Yapısı

### 2.1 Yığın

| Katman | Teknoloji | Sürüm |
|---|---|---|
| Framework | Next.js (App Router) | 16.3.4 |
| UI | React | 19.2.8 |
| Stil | Tailwind CSS v4 (`@tailwindcss/postcss`) | 4.x |
| İkon | lucide-react | 1.43 |
| Bildirim | react-hot-toast | 2.6 |
| Veri | Supabase (PostgREST üzerinden doğrudan istemci erişimi) | supabase-js 2.116 |
| Dil | TypeScript (strict) | 5.x |
| Lint | eslint-config-next (core-web-vitals + typescript) | 9.x |

`framer-motion` `package.json`'da bağımlılık olarak listelenmiştir ancak **hiçbir yerde import edilmez** (kaldırılabilir).

> **Dikkat:** Proje kökündeki `AGENTS.md`, Next.js 16'nın eğitim verilerinden farklı, kırıcı değişiklikler içerdiğini belirtir. Kod yazmadan önce `node_modules/next/dist/docs/` altındaki kılavuzlara bakılmalıdır.

### 2.2 Dizin Yapısı

```
ctc-erp/
├── app/
│   ├── layout.tsx              # Kök layout: Sidebar + TopBar + <main>
│   ├── globals.css             # Tailwind import + tema değişkenleri
│   ├── page.tsx                # "/" Genel Durum (Dashboard)
│   ├── components/
│   │   ├── Sidebar.tsx         # Daraltılabilir sol menü
│   │   ├── TopBar.tsx          # Sayfa başlığı, canlı kur, bildirim merkezi, profil
│   │   └── TopBarRates.tsx     # KULLANILMIYOR (TopBar içine gömülü)
│   ├── retail/page.tsx         # Mağaza Satış (POS / Z-Raporu)
│   ├── cash-registers/page.tsx # Nakit Kasalar
│   ├── bank-accounts/page.tsx  # Banka Hesapları
│   ├── credit-cards/page.tsx   # Kredi Kartları
│   ├── stocks/page.tsx         # Stok Yönetimi (depo, kategori, stok kartı, hareket)
│   ├── services/page.tsx       # Hizmet Kartları
│   ├── suppliers/page.tsx      # Satıcılar / Tedarikçiler (borç)
│   ├── customers/page.tsx      # Müşteriler (alacak)
│   ├── expenses/page.tsx       # Genel Giderler
│   ├── subscriptions/page.tsx  # Abonelik / Kredi Cüzdanları
│   ├── reports/page.tsx        # Dönemsel Hareket Raporu (yazdırılabilir)
│   ├── companies/page.tsx      # Şirketler / Masraf Merkezleri
│   └── activity/page.tsx       # Sistem Denetim Günlüğü (audit_logs)
├── lib/
│   ├── supabase.ts             # createClient(NEXT_PUBLIC_SUPABASE_URL, ANON_KEY)
│   └── utils.ts                # formatMoney()
├── public/                     # create-next-app varsayılan SVG'leri (kullanılmıyor)
├── docs/                       # Bu dokümanlar
├── AGENTS.md / CLAUDE.md       # Ajan talimatları (next dev tarafından yeniden üretilir)
├── next.config.ts              # Boş
├── eslint.config.mjs, postcss.config.mjs, tsconfig.json
└── package.json
```

Toplam ~10.700 satır TypeScript/TSX; **tüm iş mantığı 14 sayfa dosyasında** yaşar. Ortak modül, servis katmanı, API route, test veya migration yoktur.

---

## 3. Mimari

### 3.1 Genel Şema

```
┌────────────────────────── Tarayıcı ──────────────────────────┐
│  Next.js App Router (tamamı 'use client' sayfalar)           │
│                                                              │
│  Sidebar ── TopBar (kur + bildirim) ── <main>{page}</main>   │
│                          │                                   │
│   her sayfa kendi useState/useEffect ile:                    │
│   • supabase-js ile doğrudan SELECT/INSERT/UPDATE/DELETE     │
│   • "Mutlak Hesaplama" ile bakiye/stok yeniden toplama       │
│   • logActivity() ile audit_logs'a yazma                     │
│   • open.er-api.com'dan USD/EUR kuru çekme                   │
└──────────────┬───────────────────────────────┬───────────────┘
               │ anon key (RLS?)               │ HTTPS
        ┌──────▼──────┐                 ┌──────▼──────────┐
        │  Supabase   │                 │ open.er-api.com │
        │  Postgres   │                 │ /v6/latest/USD  │
        └─────────────┘                 └─────────────────┘
```

**Önemli mimari özellikler:**

1. **Canlı Üretim & Vercel CI/CD:** Sistem GitHub `main` branch'i üzerinden Vercel canlı ortamına bağlıdır. Gerçek stok, cari ve kasa verileri tutulmaktadır. **Sıfır veri kaybı (Zero Data Loss)** zorunludur; `DROP TABLE`, `TRUNCATE` veya veri düşüren yıkıcı işlemler kesinlikle yasaktır.
2. **Kimlik Doğrulama & Rol Bazlı Yetkilendirme:** Supabase Auth ve `user_profiles` tablosu devrededir (`AuthGuard` ve `lib/auth-context.tsx`). Admin, Ön Muhasebe, Kasiyer ve Depo rolleri ile şirket kısıtlamaları uygulanır. Kullanıcı yönetimi `/users` ve sunucu admin API `/api/admin/users` üzerinden `SUPABASE_SERVICE_ROLE_KEY` ile yürütülür.
3. **Transaction yok.** Çok adımlı işlemler (örn. gider ekle → kasa hareketi ekle → kasa bakiyesi yeniden hesapla → log yaz) ardışık, bağımsız HTTP çağrılarıdır. Ortada hata olursa kısmi kayıt kalır.
4. **"Mutlak Hesaplama" (Absolute Ledger Recalculator) deseni.** Bakiyeler artımlı (`+=`) güncellenmez; her yazma işleminden sonra ilgili varlığın **tüm hareketleri çekilip toplanır** ve `balance`/`quantity`/`current_debt` alanı üzerine yazılır. Bu, kısmi hata durumunda kendini onaran ancak N hareket için O(N) ağ trafiği üreten bir yaklaşımdır.
5. **Denormalize bakiye alanları.** `bank_accounts.balance`, `cash_registers.balance`, `credit_cards.current_debt`, `stocks.quantity`, `suppliers.balance`, `customers.balance`, `credit_wallets.balance` alanları hareket tablolarının türevidir; dashboard ve listeler bunları okur.
6. **Kod tekrarı ile modülerlik.** `logActivity`, `getLocalTodayISO`, `formatDateTR`, `recalculateAbsolute*` fonksiyonları ve onay modalı JSX'i her sayfada kopya olarak bulunur. Ortak `lib/` altında `supabase.ts`, `auth-context.tsx`, `supabase-admin.ts` ve `utils.ts` vardır.
7. **İstemci tarafı durum.** POS ayarları (`ctc_pos_config`) ve kaydedilmemiş gün taslakları (`ctc_pos_draft_<tarih>`) `localStorage`'da tutulur; tarayıcı/cihaz değişince kaybolur.

### 3.2 Render Modeli

- `app/layout.tsx` sunucu bileşenidir; `Sidebar` ve `TopBar` `'use client'`'tır.
- Tüm `page.tsx` dosyaları `'use client'`; veri çekme `useEffect` içinde yapılır, SSR/RSC veri akışı kullanılmaz. İlk render boş liste ile gelir, sonra dolar.
- Tüm sayfalar `h-[calc(100vh-32px)]` yüksekliğinde sabit çerçeve + iç kaydırma kullanır (dashboard ve kredi kartları hariç).

### 3.3 Döviz Kuru Stratejisi

- Kaynak: `https://open.er-api.com/v6/latest/USD` (ücretsiz, anahtarsız).
- `USD/TRY = rates.TRY`, `EUR/TRY = rates.TRY / rates.EUR`.
- Her sayfa kendi başına çeker (TopBar ayrıca saatte bir yeniler).
- **Hata durumunda sabit yedek:** `USD 34.25`, `EUR 37.80` (koda gömülü, güncel değil).
- Kur, **kayıt anında** `exchange_rate` kolonuna yazılır (cari, gider, stok); sonraki raporlar bu sabitlenmiş kuru kullanır. Bakiye alanları (banka/kasa) ise hesabın kendi para birimindedir ve dashboard **anlık kurla** TRY'ye çevirir.

---

## 4. Temel Kavramlar

### 4.1 Şirket / Masraf Merkezi (`companies`)

Sistemin omurgasıdır. Her varlık ve hareket **isteğe bağlı** olarak bir merkeze bağlanır:

| Değer | Anlamı | UI etiketi |
|---|---|---|
| `company_id = <uuid>`, `is_personal = false` | Ticari şirket / departman. Kâr-zarar raporlarına dahil. | 🏢 Ticari Şirketler |
| `company_id = <uuid>`, `is_personal = true` | Şahsi / ev masraf merkezi. Ticari kârı etkilemez. | 🏠 Şahsi Merkezler |
| `company_id = NULL` | Ortak / bağımsız varlık veya işlem. | 🌍 Ortak / Bağımsız |

Formlarda `'common'` string değeri seçildiğinde veritabanına `NULL` yazılır. Dashboard ve raporlardaki filtre `'all' | 'common' | <uuid>` değerlerini alır.

### 4.2 Hareket Yönleri

| Tablo | `tx_type` değerleri | Bakiye etkisi |
|---|---|---|
| `cash_transactions`, `bank_transactions`, `stock_transactions` | `in` / `out` | in: +, out: − |
| `card_transactions` | `expense` / `payment` | expense: borç +, payment: borç − |
| `supplier_transactions`, `customer_transactions` | `debt` / `payment` | debt: bakiye +, payment: bakiye − |
| `credit_card_transactions` (yalnız POS) | `out`/`debt`/`expense` vs `in`/`payment`/`refund` | ilk grup borç +, ikinci grup borç − |

Tedarikçi bakiyesi **bizim borcumuz**, müşteri bakiyesi **bizim alacağımız** anlamındadır; ikisi de pozitifken "açık" demektir.

### 4.3 `transfer_id` Ön Ekleri (Çapraz Modül Bağlantısı)

Kasa/banka/kart hareket tablolarındaki `transfer_id` alanı, hareketin **hangi modülden otomatik yansıdığını** kodlar. Kasa ve banka ekranları bu ön eke göre etiket gösterir ve **silmeyi engeller**:

| Ön ek | Üreten modül | Silinebileceği yer |
|---|---|---|
| `TRF-<ts>-<rnd>` | Kasa/Banka virman (iki bacak aynı id) | Kasa veya Banka ekranı (karşı bacak da silinir) |
| `EXP-<expense_tx_id>` | Genel Giderler | Yalnız Giderler ekranı |
| `SUPP-<supplier_tx_id>` | Tedarikçi ödemesi | Yalnız Tedarikçi ekranı |
| `CUST-<customer_tx_id>` | Müşteri tahsilatı | Yalnız Müşteri ekranı |
| `POS-Z-CASH-IN-<tarih>` | POS nakit ciro | POS günü yeniden kaydedilince otomatik |
| `POS-Z-CASH-OUT-<tarih>` | POS nakit giderler | " |
| `POS-Z-CARD-IN-<tarih>` | POS kart cirosu (banka, `pending`) | " |
| `POS-Z-CARD-COMM-<tarih>` | Bankada provizyon onayında girilen komisyon | " |
| `POS-TRF-CASH-<i>-<tarih>` / `POS-TRF-BANK-<i>-<tarih>` | POS gün içi kasa↔banka | " |

Abonelik tahsilatları `transfer_id` **kullanmaz**; açıklama metni (`Abonelik Tahsilatı: <kullanıcı> (<ad>)`) ile eşleştirilir.

### 4.4 "Sihirli" Açıklama Metinleri

Bazı kayıtlar **açıklama string'i ile** tanınır. Bu metinler değiştirilirse ilgili özellik bozulur:

| Metin | Kullanım |
|---|---|
| `Açılış Bakiyesi / Devir` | Kasa, banka, tedarikçi, müşteri açılış bakiyesi. Düzenleme modalında geri okunur; POS ilk gün devri buradan alınır. |
| `Dönem Başı Devir Borcu` | Kredi kartı açılış borcu. |
| `Açılış Stoğu` | Stok kartı ilk giriş hareketi. |
| `Mağaza Satışı: Z-Raporu (POS-<tarih>)` | POS'un ürettiği stok çıkışları; gün yeniden kaydedilince `LIKE` ile silinir. |
| `Mağaza Z-Raporu: Kartlı Giderler (POS-<tarih>)` | POS kartlı gider ekstresi; aynı şekilde silinir. |
| `Mağaza Hizmet Alımı (POS-<tarih>): <açıklama>` | POS servis/maliyet satırlarının tedarikçi borcu; `supplier_transactions` tablosuna `debt` yazılır; gün yeniden kaydedilince `LIKE` ile silinip güncellenir. |
| `Abonelik Tahsilatı: <username> (<full_name>)` | Abonelik silinince ilgili kasa/banka girişini bulup siler. |

### 4.5 Bekleyen Provizyon (`bank_transactions.status`)

- POS kart cirosu bankaya `status = 'pending'` olarak yazılır. **Bakiyeye dahil edilmez** (tüm `recalculateAbsoluteBankBalance` fonksiyonları `status !== 'pending'` filtreler).
- Banka ekranında "Hesaba Geçir & Komisyon Kes" ile `completed` yapılır, valör tarihi güncellenir ve isteğe bağlı komisyon `out` hareketi eklenir.
- Diğer tüm banka hareketleri `status = 'completed'` ile yazılır.

---

## 5. Veri Modeli (Supabase Tabloları)

> Kolonlar kodda okunan/yazılan alanlardan çıkarılmıştır. `id` (uuid) ve `created_at` her tabloda varsayılmıştır. FK/cascade davranışı repo'dan doğrulanamaz; silme akışları cascade'e güvenir (bkz. §10).

### 5.1 Yapısal Tablolar

**`user_profiles`** — `id (uuid, references auth.users)`, `email`, `full_name`, `role (admin|finance|cashier|warehouse|custom)`, `allowed_modules (text[])`, `allowed_companies (text[]?)`, `is_active (bool)`

**`companies`** — `name`, `is_personal (bool)`

**`warehouses`** — `name`, `color` (Tailwind gradient string), `company_id?`

**`stock_categories`** — `name`, `warehouse_id` (kategori depoya özeldir; stoklarda isim olarak saklanır, FK değil)

**`stocks`** — `warehouse_id`, `name`, `sku?`, `category?` (string), `sub_category?`, `currency`, `unit` (Adet/Kg/Metre/Lt/Paket/Kutu), `quantity` (türev), `unit_price` (net, son giriş fiyatıyla güncellenir), `vat_rate`, `stock_color`

**`services`** — `name`, `unit_price`, `vat_rate`, `currency`, `company_id?`

**`expense_categories`** — `name`

**`suppliers`** — `company_name`, `contact_name`, `phone`, `email`, `tax_office`, `tax_id`, `address`, `balance` (türev, TRY), `currency` (her zaman `'TRY'` yazılır)

**`customers`** — `name`, `contact_name`, `phone`, `email`, `tax_office`, `tax_id`, `address`, `balance` (türev, TRY), `currency` (`'TRY'`)

**`credit_wallets`** — `supplier_id`, `company_id?` (ticari işletme), `name`, `balance` (adet, türev), `unit_cost` (sıradaki FIFO lot maliyeti, cüzdan para biriminde), `currency`, `fifo_lots (jsonb[])`
- Lot şekli: `{ qty, original_qty?, price, currency, exRate, is_opening? }`

### 5.2 Hesap ve Hareket Tabloları

**`cash_registers`** — `name`, `balance` (türev), `currency`, `company_id?`
**`cash_transactions`** — `cash_register_id`, `company_id?`, `tx_date`, `description`, `tx_type (in|out)`, `amount`, `currency`, `exchange_rate`, `is_transfer (bool)`, `transfer_id?`

**`bank_accounts`** — `bank_name`, `account_name`, `iban`, `balance` (türev), `currency`, `company_id?`
**`bank_transactions`** — `cash_transactions` ile aynı + `bank_account_id`, `status (pending|completed)`

**`credit_cards`** — `name`, `card_limit`, `cutoff_day (1-31)`, `current_debt` (türev), `card_color`, `company_id?`
**`card_transactions`** — `card_id`, `company_id?`, `tx_date`, `description`, `tx_type (expense|payment)`, `amount`, `transfer_id?`
**`credit_card_transactions`** — ⚠️ **Yalnızca `retail/page.tsx` kullanır.** `credit_card_id`, `company_id`, `tx_date`, `description`, `tx_type ('out')`, `amount`. Diğer tüm modüller `card_transactions` kullanır (bkz. §10 KRİTİK-1).

**`stock_transactions`** — `stock_id`, `company_id?`, `tx_date`, `description`, `tx_type (in|out)`, `quantity`, `unit_price`, `currency`, `vat_rate`

### 5.3 Cari Hareketler

**`supplier_transactions`** / **`customer_transactions`** — `supplier_id|customer_id`, `company_id?`, `tx_date`, `description`, `tx_type (debt|payment)`, `amount`, `currency`, `exchange_rate`, `is_detailed (bool)`, `invoice_lines (jsonb[])`, `payment_source_type (cash|bank|card)?`, `payment_source_id?`

`invoice_lines` satır şekli:
```json
{ "id": "…", "itemType": "product|service", "name": "…", "quantity": "1", "unitPrice": "100",
  "vatRate": "20", "addToStock": true, "warehouseId": "…",
  "selectedStockId": "…", "selectedServiceId": "…",
  "targetStockId": "…", "stockTxId": "…" }
```
`targetStockId` ve `stockTxId` kaydetme sırasında doldurulur; fatura silinirken/düzenlenirken ilgili `stock_transactions` satırı bunlarla bulunur. `itemType` yalnızca müşteri faturasında vardır.

### 5.4 Gider

**`expense_transactions`** — `category_id`, `company_id?`, `tx_date`, `description`, `amount`, `currency`, `exchange_rate`, `payment_source_type`, `payment_source_id`, `transfer_id` (`EXP-<ts>` — kasa/banka tarafına yazılan `EXP-<tx_id>` ile **aynı değildir**)
- Dashboard ve raporlar ayrıca eski bir `date` kolonunu da okur (`tx_date || date || created_at`), şema geçişi izi.

### 5.5 Abonelik

**`credit_subscriptions`** — `company_id?`, `wallet_id?`, `username`, `full_name`, `phone`, `reference_note`, `start_date`, `end_date` (= start + 1 yıl), `cost_price`, `sale_price`, `currency`, `is_active`, `is_paid`, `payment_source_type?`, `payment_source_id?`

### 5.6 POS

**`pos_daily_summaries`** — `date (UNIQUE)`, `opening_cash`, `photo_cash`, `photo_card`, `daily_notes`
**`pos_transactions`** — `date`, `category_id` (aksesuar|oyun_prog|dvd_harici|orjinal|servis|diger|gider|fotokopi), `description`, `cost` (satır toplam maliyeti, TRY), `cash`, `card`, `stock_id?`, `quantity`, `company_id?`
**`pos_bank_transfers`** — `date`, `transfer_type (to_bank|from_bank)`, `bank_id`, `amount`, `description`

### 5.7 Denetim

**`audit_logs`** — `module`, `action (INSERT|UPDATE|DELETE|ROLLBACK)`, `description`, `record_id?`, `amount`, `currency`, `old_data (jsonb)`, `new_data (jsonb)`, `company_id?`

Kullanılan `module` değerleri: `company, service, cash, cash_tx, cash_transfer, bank, bank_tx, bank_transfer, credit_card, card_tx, warehouse, stock, stock_category, stock_tx, supplier, supplier_tx, supplier_invoice, customer, customer_tx, invoice, expense, expense_category, subscription, subscription_wallet, subscription_payment, technical_service`.

### 5.8 Teknik Servis & Cihaz Takip

**`technical_service_tickets`** — `ticket_no (UNIQUE, SRV-YY-xxxx)`, `company_id?`, `customer_id?`, `customer_name`, `customer_phone`, `device_type`, `brand_model`, `serial_no`, `device_password`, `accessories`, `physical_condition`, `problem_description`, `technician_notes`, `status (pending|diagnosing|waiting_approval|waiting_parts|ready|delivered|cancelled)`, `estimated_cost`, `labor_cost`, `parts_cost`, `total_cost`, `used_parts (jsonb[])`, `performed_services (jsonb[])`, `payment_status (unpaid|paid|debt_added)`, `payment_method (cash|card|customer_debt|free)?`, `payment_target_id?`, `received_at`, `completed_at?`, `delivered_at?`

---

## 6. Çekirdek İş Kuralları

### 6.1 Bakiye Hesaplama Formülleri

```
cash_registers.balance   = Σ in.amount − Σ out.amount                    (cash_transactions)
bank_accounts.balance    = Σ in.amount − Σ out.amount  WHERE status≠pending (bank_transactions)
credit_cards.current_debt= Σ expense.amount − Σ payment.amount           (card_transactions)
stocks.quantity          = Σ in.quantity − Σ out.quantity                (stock_transactions)
suppliers.balance (TRY)  = Σ debt.amount×rate − Σ payment.amount×rate    (supplier_transactions)
customers.balance (TRY)  = Σ debt.amount×rate − Σ payment.amount×rate    (customer_transactions)
credit_wallets.balance   = Σ fifo_lots[].qty
```
`rate = exchange_rate || 1`. Kasa/banka bakiyesi **hesabın kendi para birimindedir**; cari bakiyeler **her zaman TRY**'dir.

### 6.2 Çapraz Para Birimi Dönüşümü (ödeme kaynağına yansıtma)

Gider/tedarikçi/müşteri modüllerinde `modifyPaymentSourceBalance`:
```
amountInTry = txCurr==='TRY' ? amount : amount × customRate      (formdaki mutabakat kuru)
converted   = accCurr==='TRY' ? amountInTry
            : accCurr==='USD' ? amountInTry / rates.USD          (anlık API kuru!)
            : amountInTry / rates.EUR
```
Yani TRY→döviz hesaba yansıtmada **formdaki kur değil anlık kur** kullanılır; iki kur farklıysa küçük sapma oluşur.

### 6.3 Stok Değerlemesi

- Depo/stok toplam değeri: `quantity × unit_price × (1 + vat_rate/100)` → TRY'ye anlık kurla.
- `stocks.unit_price`, **her `in` hareketinde** hareketin birim fiyatına (stok para birimine çevrilmiş) **üzerine yazılır** (son alış fiyatı yöntemi, ortalama değil).
- Stok kartı düzenlenirken `quantity` alanı formda gösterilir ama **kaydedilmez**; miktar yalnız hareketlerden gelir.

### 6.4 Detaylı Fatura Kuralları

- Satır toplamı: `qty × unitPrice × (1 + vat/100)`; fatura toplamı KDV dahil brüt; cariye `toplam × exchange_rate` TRY işlenir.
- **Tedarikçi faturası** (`suppliers`): `addToStock` işaretli satır için
  1. `selectedStockId` varsa o stok,
  2. yoksa aynı depoda `ilike name` ile eşleşen ilk stok,
  3. yoksa **yeni stok kartı oluşturulur** (`unit:'Adet'`, `quantity:0`, fatura para biriminde),
  ardından `stock_transactions` `in` hareketi eklenir.
- **Müşteri faturası** (`customers`): aynı mantık, hareket `out`. Ürün arama dropdown'u yalnız `quantity > 0` stokları listeler. `itemType: 'service'` satırlar stok etkilemez, `services` tablosundan seçilebilir.
- Fatura düzenlenince eski satırların `stockTxId` hareketleri silinir, yeni hareketler yazılır.
- Fatura silinince `stockTxId` hareketleri silinir ve etkilenen stoklar yeniden hesaplanır.

### 6.5 Abonelik FIFO Maliyeti

- Cüzdana kredi yükleme: tedarikçiye `debt` (qty × price, alım dövizi, mutabakat kuru) yazılır; lot listeye **sona** eklenir.
- Yeni abonelik / yenileme: `fifo_lots[0].qty -= 1`; sıfırlanırsa lot çıkarılır. `cost_price` = lot fiyatı, satış para birimine anlık kurla çevrilir.
- Abonelik silme: `{qty:1, price: cost_price, currency: sub.currency, exRate:1}` lotu **başa** eklenir (kredi iade), tahsilat varsa kasa/banka girişi silinir.
- `unit_cost` = sıradaki lotun cüzdan para birimine çevrilmiş fiyatı (UI'da "Sıradaki Maliyet").
- Süre: `end_date = start_date + 1 yıl`; yenileme yeni kayıt açar (`start = eski end`), eski kayıt kalır. Liste, aynı `username|wallet_id|reference_note` grubunun **en son bitiş tarihli** kaydını "güncel" sayar.
- Uyarı eşiği: `end_date` bugüne 15 gün veya daha yakınsa "Yaklaşan"; TopBar bildirimi de aynı 15 gün penceresini ve `is_paid=false` kayıtları kullanır.

### 6.6 POS Gün Kapanışı (Z-Raporu)

Gün kaydedilirken sırasıyla:
1. `pos_daily_summaries` upsert (`date` çakışması).
2. O günün `pos_transactions` ve `pos_bank_transfers` **tamamı silinir, yeniden yazılır** (idempotent).
3. Fotokopi N/K girildiyse `category_id='fotokopi'`, `cost = (N+K) × 0.5` satırı eklenir (**%50 maliyet sabiti**).
4. `syncPosToMainSystem`: `POS-%-<tarih>` ön ekli tüm kasa/banka hareketleri, `Mağaza Satışı: Z-Raporu (POS-<tarih>)` stok çıkışları, `Mağaza Hizmet Alımı (POS-<tarih>)` tedarikçi borçları ve kartlı gider ekstresi silinir, sonra:
   - Kasa: `POS-Z-CASH-IN` (nakit ciro = satış nakit + fotokopi nakit), `POS-Z-CASH-OUT` (nakit gider), her transfer için `POS-TRF-CASH-<i>`.
   - Banka: `POS-Z-CARD-IN` **pending** (kart ciro), her transfer için `POS-TRF-BANK-<i>` completed.
   - Stok: `stock_id`'li satırlar için `out` (birim maliyet = cost/qty, TRY, KDV 0).
   - Tedarikçi: Tedarikçi seçilen satırlar için `supplier_transactions`'a `debt` (TRY, exchange_rate 1, `invoice_lines` JSON metadata) yazılır.
   - Kredi kartı: kartlı gider toplamı `credit_card_transactions`'a `out`.
   - Etkilenen tüm kasa/banka/stok/tedarikçi/kart bakiyeleri yeniden hesaplanır (`recalculateAbsoluteSupplierBalance`).
5. `syncForwardBalances`: **tüm** `pos_daily_summaries` günleri kronolojik gezilir; ilk günün `opening_cash`'i bağlı kasanın `Açılış Bakiyesi / Devir` hareketinden alınır, sonraki her günün `opening_cash`'i önceki günün kapanışından yazılır.
6. `localStorage` taslağı silinir.

Kayıt öncesi doğrulamalar: kartlı gider varsa ayarlarda kredi kartı seçili olmalı; `servis` ve `gider` dışındaki kategorilerde satış girilen satırın **maliyeti boş olamaz**.

Günlük kasa formülü (ekranda): `Dünden Devir + Nakit Satış (ciro+fotokopi) − Nakit Gider − Bankaya Yatan + Bankadan Çekilen`.

### 6.7 Dashboard P&L Hesabı (son 6 ay)

```
Ciro    = Σ customer_transactions(debt)×rate + Σ subscriptions.sale_price(TRY)
        + Σ pos_transactions(≠gider).cash+card
SMM     = Σ stock_transactions(out) qty×price(TRY) + Σ subscriptions.cost_price(TRY)
        + Σ pos_transactions(≠gider, stock_id IS NULL).cost        ← çift sayım koruması
Gider   = Σ expense_transactions (ticari merkez)×rate + Σ pos_transactions(gider).cash+card
Net Kâr = Ciro − SMM − Gider
```
"Mağaza POS Kârı" kartı ise **stok durumuna bakmadan** tüm POS maliyetini düşer. Şahsi merkez giderleri P&L'e girmez, ayrı kartta gösterilir.

### 6.8 Raporlar (Dönem Başı / Sonu Mizanı)

Geriye dönük hesaplama: `closing = current − future_in + future_out`, `opening = closing − period_in + period_out`. Yani mevcut bakiyeden dönem sonrası hareketler geri alınır, sonra dönem içi hareketler geri alınır. Tarih aralıkları string karşılaştırmasıyla (`'YYYY-MM-01'`–`'YYYY-MM-31'`) yapılır.

---

## 7. Modül Rehberi

Her modül için: **amaç → ekran düzeni → yapılabilen işlemler → tetiklediği yan etkiler**.

### 7.1 Genel Durum `/`
- **Üst:** Şirket filtresi (Holding / Ortak / şirketler), Net Finansal Durum = banka + kasa + müşteri alacağı − tedarikçi borcu − kart borcu.
- **Orta (Sol 2 Kolon):** 6 aylık P&L bar grafiği + 5 KPI kartı (Ciro, SMM, Gider, POS Kârı, Net Kâr, aylık trend %) + altta **6 Aylık Finansal Özet Tablosu** (aylık ciro, maliyet/gider, net kâr ve kâr marjı).
- **Sağ (1 Kolon):**
  1. **Son İşlem Akışı:** Son 30 işlem (müşteri, tedarikçi, gider birleşik akış, tarih ve tutar göstergeli).
  2. **Cari Borç & Alacak Kıyaslama Widget'ı (Yeni):**
     - **Sekmeler:** `Müşteri Alacakları` ve `Tedarikçi Borçları` geçişi.
     - **Dönem Kıyaslama Seçicisi:** "Geçen Ay Sonu" veya "Son 30 Gün" eşiklerine göre anlık geriye dönük hesaplama.
     - **Mini KPI Strip:** Toplam açık bakiye, geçmiş döneme göre değişim tutarı ve yüzde artış/azalış/ödendi göstergesi.
     - **Dinamik Liste:** Carilerin güncel bakiyesi, önceki dönem bakiyesi, fark tutarı, yüzdesi ve toplam içindeki pay çubuğu (progress bar), isimle canlı arama.
- **Alt:** Açılır özet kartları (Banka, Kasa, Müşteri, Stok/Depo, Kredi Kartı, Tedarikçi, Ticari Gider; Yönetici için ayrıca Şahsi Gider).
- **Rol ve Şirket Bazlı İzolasyon (Multi-Tenant Koruma):**
  - Kısıtlı personel (`allowed_companies` tanımlı kullanıcı, örn. İbrahim Evgilli / Bilgisayar Hastanesi) oturum açtığında:
    - Üst şirket seçici dropdown gizlenir; yerine "🏢 [Şirket Adı] 🔒 Kilitli" rozeti gelir. Filtre personelin şirketine zorunlu kilitlenir.
    - P&L Grafiği, Ciro, SMM, Ticari Gider ve Net Kâr yalnızca personelin şirket hareketlerini (`isMatch`) baz alır.
    - Müşteri Alacakları ve Tedarikçi Borçları: Diğer şirketlerle olan bakiyeler izole edilir; yalnız personelin şirketiyle yapılan `customer_transactions` ve `supplier_transactions` bakiyesi toplanır ve kıyaslanır.
    - Kasa, Banka, Kredi Kartı ve Depo kartlarında yalnızca yetkili şirketin varlıkları listelenir.
    - Şahsi Giderler kartı admin olmayan personele tamamen gizlenir.
- Yan etki yok (salt okunur). 14 tabloyu çeker ve oturum yetkilerine göre süzerek hesaplar.

### 7.2 Mağaza Satış (POS) `/retail`
- Tarih gezgini (◀ ▶ / takvim). Her gün ayrı Z-raporu.
- 6 satış kategorisi kutusu × 7 satır (otomatik genişler): Açıklama/ürün arama, Adet, Nakit, K.Kartı, (gizli) Maliyet.
- Sağ panel: Gider & Masraf kutusu, Günün Notları, Günün Banka Hareketleri.
- Üst şerit: Dünden Devir (salt okunur), Kasa (hesaplanan), Nakit Satış, Kredi Kartı, Toplam Gider, Fotokopi N/K, Ayarlar ⚙, Günü Kaydet.
- **Ayarlar** (`localStorage: ctc_pos_config`): bağlı merkez, satışların düşüleceği depo, nakit kasa, kart cirosu bankası, kartlı gider kredi kartı.
- Ürün arama yalnız depo seçiliyse ve `quantity > 0` stoklarda çalışır; seçim maliyeti `unit_price × adet` (TRY) olarak doldurur.
- Taslak: her değişiklik `ctc_pos_draft_<tarih>`'e yazılır; sayfa açılışında taslak varsa "Sistem kapanması algılandı" uyarısı ile geri yüklenir.
- Yan etkiler: §6.6.

### 7.3 Nakit Kasalar `/cash-registers`
- Sol: kasa listesi (arama), Yeni Kasa. Sağ: seçili kasa başlığı, hareket formu, Virman/Bankaya butonu, hareket tablosu (yürüyen bakiye).
- Kasa oluştur/düzenle: ad, para birimi (**oluşturulduktan sonra kilitli**), merkez, açılış bakiyesi (`Açılış Bakiyesi / Devir` hareketi olarak yönetilir; 0 girilirse silinir).
- Hareket ekle: tarih, merkez, yön, açıklama, tutar (kasa para biriminde).
- Virman: hedef banka veya başka kasa; farklı para biriminde kur ve hedef tutar alanları çift yönlü hesaplanır. İki bacak aynı `TRF-` id'siyle yazılır.
- Silme: `SUPP-/CUST-/EXP-/POS-` ön ekli hareketler engellenir; `TRF-` silinirse karşı bacak da silinir.

### 7.4 Banka Hesapları `/bank-accounts`
- Kasa ile aynı düzen + IBAN alanı, "Bekleyen Provizyon" etiketi ve ✔ **Hesaba Geçir & Komisyon Kes** butonu (yalnız `pending` satırlarda).
- Provizyon onayı: valör tarihi (varsayılan işlem tarihi + 1 gün), komisyon (0 ≤ k < tutar). Komisyon `POS-Z-CARD-COMM-<tarih>` id'siyle `out` yazılır; böylece o POS günü yeniden kaydedilince komisyon da temizlenir.

### 7.5 Kredi Kartları `/credit-cards`
- Üst: kart görselleri (1.586 oran, 14 renk teması), Güncel Borç / Limit / Mevcut.
- Alt: seçili kart ekstresi; hareket formu (tarih, merkez, Harcama/Ödeme, açıklama, tutar ₺).
- Kart oluştur/düzenle: ad, limit, ekstre günü, dönem başı devir borcu (`Dönem Başı Devir Borcu` hareketi), renk, merkez.
- Bakiye sütunu her satırda **kartın güncel borcunu** gösterir (yürüyen bakiye değil).
- Gider/tedarikçi modüllerinden gelen `expense` hareketleri burada listelenir ve **silinebilir** (kasa/bankadaki gibi ön ek koruması yoktur).

### 7.6 Stok Yönetimi `/stocks`
- Üst şerit: depo kartları (KDV dahil USD/TRY toplam), + yeni depo.
- Sol: seçili deponun stok kartları, kategori filtre çipleri, "Yönet" (kategori CRUD), arama, Ürün Ekle.
- Sağ: Hızlı Arama & İşlem (ürün seçince form otomatik dolar), seçili ürün başlığı, hareket formu (tarih, merkez, Giriş/Çıkış, açıklama, miktar, net fiyat, döviz, KDV), hareket tablosu.
- Depo silme: "içindeki stok kartları da silinir" (cascade'e bağlı). Kategori silme: stokların `category` alanı `NULL` yapılır.
- Kategori adı değişince aynı depodaki stokların `category` string'i toplu güncellenir.
- **Rol ve Depo Yetkilendirmesi:** Kasiyer / Satış personeli sol menüden Stok Yönetimi modülüne erişebilir. Personelin yetkili olduğu şirket kısıtlaması (`allowed_companies`) varsa, ekranda **yalnızca o mağazaya ait depolar** listelenir; başka mağaza veya şirketlerin depoları gizlenir. Personel yalnızca kendi mağazasının deposuna yeni stok kartı açabilir ve **Stok Girişi (`tx_type = 'in'`) / Sayım** yapabilir.

### 7.7 Hizmet Yönetimi `/services`
- Kart ızgarası: ad, sahip merkez, net fiyat, KDV, KDV dahil fiyat. Arama, ekle/düzenle/sil.
- Yalnız müşteri detaylı faturasında "Hizmet" satırı olarak kullanılır. Silme, faturada kullanılmışsa DB tarafından reddedilebilir (FK varsa).

### 7.8 Satıcılar (Borç) `/suppliers`
- Sol: tedarikçi listesi (ad/yetkili arama), bakiye "BORCUMUZ". Sağ: kart bilgileri (tel, e-posta, VD/VN, adres), hareket formu, **Detaylı Fatura Gir**, hareket tablosu (TRY yürüyen bakiye, döviz satırlarında kur ve TRY karşılığı).
- Hareket: Borç/Fatura (+) veya Ödeme (−). Ödemede kaynak zorunlu: kasa, banka **veya kredi kartı**. Kaynağa `SUPP-<tx_id>` hareketi yazılır.
- Hareket düzenleme: eski kaynak hareketi silinir, yeni yazılır.
- Detaylı fatura: §6.4.
- Tedarikçi kartı: açılış bakiyesi + hangi merkeze ait olduğu.
- Abonelik modülü kredi yüklemelerini bu carilere `debt` olarak yazar.

### 7.9 Müşteriler (Alacak) `/customers`
- Tedarikçinin aynası. Tahsilat kaynağı yalnız **kasa veya banka** (kart yok). Kaynağa `CUST-<tx_id>` `in` hareketi yazılır.
- Detaylı satış faturası: satır türü Ürün/Hizmet; ürünlerde "Stoktan Düş" ve depo seçimi.

### 7.10 Genel Giderler `/expenses`
- Üst: Ticari ve Şahsi gider toplamları (tüm zamanlar).
- Sol: merkez bazlı dağılım, kategori listesi (CRUD, toplamlı).
- Sağ: gider formu (tarih, merkez **zorunlu**, kategori, ödeme kaynağı kasa/banka/kart, açıklama, döviz, kur, tutar), arama, tablo.
- Gider ekle: `expense_transactions` + kaynağa `EXP-<tx_id>` hareketi (kartta `expense`, diğerlerinde `out`). Silme her ikisini geri alır. **Düzenleme yok.**

### 7.11 Abonelik / Kredi `/subscriptions`
- Üst: kredi cüzdanı kartları (bakiye adet, tedarikçi, sıradaki maliyet, Yükle), Yeni Cüzdan.
- KPI: Toplam Maliyet, Toplam Ciro, Bekleyen Tahsilat, Net Kâr (filtreye göre, TRY).
- 3 açılır kart: Aktif (>15 gün), Yaklaşan/Biten (≤15 gün), Ödeme Bekleyen.
- Tablo: kullanıcı/referans, merkez, başlangıç/bitiş, kalan süre, maliyet & cüzdan, satış fiyatı, tahsilat durumu (Ödendi / **Tahsil Et**), işlemler (**+1 Yıl Uzat**, düzenle, sil).
- Cüzdan düzenlemede açılış lotu (`is_opening`) miktar/maliyeti değiştirilebilir; "hayalet bakiye" için zorla silme uyarısı vardır.
- Kurallar: §6.5.

### 7.12 Raporlar (P&L / Nakit Akışı / Mizan) `/reports`
- **Filtreler:** Merkez seçimi, dönem hapları (Son 7 Gün / Son 30 Gün / Bu Ay / Geçen Ay / Bu Yıl / Tüm Zamanlar / Özel İki Tarih Aralığı), **Raporu Yazdır** (A4 dikey tek sayfa optimizasyonu, `#printable-report` dışındaki her şey gizlenir, sıfır siyah ekonomik baskı CSS'i).
- **Yönetici Özet KPI Kartları:** Toplam Nakit Girişi, Toplam Çıkış & Masraf, Net Nakit Akışı, Günlük Ortalama Hacim, En Yüksek Girişli Zirve Gün.
- **Cari Mutabakat & Açık Bakiye Dengesi Kartları:** Müşteri Alacakları (Açık bakiye, dönem satış/tahsilat), Tedarikçi Borçları (Açık borç, dönem alış/ödeme), Net Cari Denge (Alacak − Borç).
- **Günlük İnteraktif Trend Grafiği (Saf SVG):** Seçilen aralıktaki her gün için Yeşil (Giriş) ve Kırmızı (Çıkış) çubukları; Net Nakit Akış eğrisi; canlı hover popover ve tıklanabilir gün drill-down seçimi (varsayılan olarak baskıda gizlidir, üst bardaki "Grafikleri Yazdır" kutusuyla açılabilir).
- **Kategori & Kanal Analizleri:** Masraf kategorileri dağılımı (yüzdeli barlar) ve Mağaza (POS) Nakit vs. Kredi Kartı satış hasılat oranı.
- **Günlük İşlem Detay Dökümü (Drill-Down):** Tıklanan güne veya tüm döneme ait tüm fatura, tahsilat, masraf, kasa ve banka hareketlerinin kronolojik listesi ve anlık araması (baskıda gizli).
- **Bölüm 1 (İşlem Gören Kaynakların Dağılımı):** Ekranda Gider, Tedarikçi Ödemesi, Müşteri Tahsilatı için 3'lü renkli kartlar; baskıda ise dikey alanı koruyan 4 satırlık kompakt mizan matrisi (`Gider/Tedarikçi/Müşteri × Kasa/Banka/Kart/Toplam`).
- **Maksimum Ekonomik Tek Sayfa A4 Baskı Düzeni:**
  - `@page { size: A4 portrait; margin: 4mm 5mm; }`
  - Baskıda 6'lı üst KPI/Cari strip tek satırda toplanır.
  - Finansal mizan tabloları **dengeli 2 sütunlu ızgara** halinde dizilir (`print:grid print:grid-cols-2 print:gap-2`):
    - **Sol Sütun:** 1. Kaynak Dağılımı Matrisi, 2. Nakit Kasalar, 3. Banka Hesapları, 4. Kredi Kartları, 7. Depo ve Sermaye Durumu (yükseklik dengelemesi için sol sütunda).
    - **Sağ Sütun:** 5. Müşteriler (Alacaklarımız) Mizanı, 6. Tedarikçiler (Borçlarımız) Mizanı.
  - Kompakt yazı boyutu (`6.8px`–`7px`) ve hücre dolguları (`1.2px 2.5px`) ile kesilme veya taşma olmadan tek A4 sayfasına sığar.



### 7.13 Şirketler / Merkezler `/companies`
- İki sütun: Ticari Şirketler & Departmanlar, Şahsi / Ev Masraf Merkezleri. Ekle/düzenle/sil (radyo ile tür seçimi).
- Silme, bağlı kayıt varsa DB hatasıyla reddedilir (FK'ya bağlı).

### 7.14 İşlem Geçmişi (Log) `/activity`
- Son 200 `audit_logs` kaydı; açıklama/modül araması; çoklu modül filtresi.
- Her satırda **Geri Al** butonu → yalnızca `action='ROLLBACK'` etiketli **yeni bir log satırı ekler**; kayıtları **geri almaz** (bkz. §10 KRİTİK-2).
- Modül filtresi seçenekleri (`cash, bank, customer, supplier, stock, subscription, expense`) gerçek `module` değerleriyle **tam eşleşme** arar; `cash_tx`, `bank_tx`, `customer_tx` gibi kayıtlar filtrelenince görünmez.

### 7.15 Ortak Kabuk: Sidebar ve TopBar
- Sidebar: 14 menü + altta "İşlem Geçmişi (Log)". Daralt/genişlet (state, kalıcı değil). `print:hidden`.
- TopBar: rota → başlık eşlemesi (`/activity` için eşleme yok, varsayılan başlık çıkar), tarih, USD/EUR (saatlik yenileme), Bildirim Merkezi (ödenmemiş abonelikler = "Kritik", 15 gün içinde bitenler = "Uyarı"; her rota değişiminde yenilenir), dinamik profil ve çıkış menüsü.

### 7.16 Teknik Servis & Cihaz Takip `/technical-service`
- **Amaç:** Cihaz kabul (laptop, PC, telefon vb.), arıza teşhisi, aşama takibi, parça & işçilik maliyeti hesaplama, kabul fişi basımı ve teslimat/tahsilat yönetimi.
- **Ekran Düzeni:**
  - Üstte 7 KPI metrik kartı: Sırada Bekleyen, İncelemede, Onay Bekleyen, Parça Bekleyen, Teslime Hazır, Toplam Teslim Edilen, Bu Ayki Servis Cirosu.
  - Arama (fiş no, müşteri, telefon, marka/model, seri no) ve Aşama filtre çipleri.
  - Görünüm Değiştirici: **Kanban Pano (6 aşamalı sütunlar)** veya **Detaylı Liste Tablosu**.
- **İşlemler:**
  - **Yeni Cihaz Kabul:** Müşteri seçimi veya anında yeni müşteri açma, cihaz türü, marka/model, seri no, kilit açma şifresi, teslim alınan aksesuarlar, hasar notu, arıza şikayeti ve ön tahmin.
  - **Detay & İşlem Ekleme:** Aşama güncelleme, teknisyen teşhis notları, `services` kataloğundan işçilik ekleme, `stocks` deposundan yedek parça seçme ve maliyet hesaplama.
  - **Teslimat & Tahsilat:** Cihaz `delivered` durumuna çekilirken nakit kasaya (`cash_transactions`), bankaya (`bank_transactions`) tahsilat yazma veya müşteri carisine (`customer_transactions`) borç kaydetme; kullanılan parçaların depodan otomatik düşülmesi (`stock_transactions (out)`).
  - **Yazdırma & WhatsApp:** 80mm termal ve A4/A5 kurumsal cihaz kabul fişi baskısı (`window.print`); tek tıkla müşterinin telefonuna durum güncelleme WhatsApp mesajı iletme.
- **Yetki & İzolasyon:** Kasiyer (İbrahim Bey) ve Ön Muhasebe rollerine açıktır. Personelin bağlı olduğu şirket kısıtlaması varsa yalnızca o şubenin cihazlarını görür.

---

## 8. Modüller Arası Veri Akışları

```
                 ┌──────────────┐  kredi yükle (debt)  ┌────────────┐
                 │ subscriptions├─────────────────────►│ suppliers  │
                 └──────┬───────┘                      └─────┬──────┘
          tahsilat (in) │                    ödeme (SUPP-)   │ fatura satırı (in)
                        ▼                                    ▼
┌──────────┐  EXP-  ┌──────────────┐  CUST- ┌───────────┐  ┌────────┐
│ expenses ├───────►│ cash / bank  │◄───────┤ customers ├─►│ stocks │ (out)
└────┬─────┘        │ transactions │        └───────────┘  └───▲────┘
     │ EXP-(card)   └──────▲───────┘                           │ out (Z-raporu)
     ▼                     │ POS-Z-*, POS-TRF-*                │
┌──────────────────┐       │                             ┌─────┴─────┐
│ card_transactions│◄──────┼── SUPP-(card) ── suppliers  │  retail   │
└──────────────────┘       │                             │   (POS)   │
┌────────────────────────┐ │                             └─────┬─────┘
│credit_card_transactions│◄┼───────────────────────────────────┘ kartlı gider (⚠ farklı tablo)
└────────────────────────┘ │
                           └── retail (POS) nakit/kart ciro, transferler
```

**Tek yönlü yansıma kuralı:** Kaynak modül (gider, cari, POS, abonelik) hedef hesaba hareket yazar ve siler; hedef ekran (kasa, banka) bu hareketleri **salt okunur** gösterir. İstisna: kredi kartı ekranı ön ek kontrolü yapmaz.

---

## 9. Ortak UI Bileşenleri ve Kodlama Kalıpları

### 9.1 Tasarım Sistemi (koda gömülü)
- Arka plan katmanları: `#070b14` (body) → `#0a0f1d` (sidebar/başlıklar) → `#0d1322` (kartlar) → `#0f172a` (modallar).
- Kenarlık: `border-slate-800/80`; vurgu renkleri modül başına: indigo (banka/genel), emerald (kasa), rose (gider/kart), amber (tedarikçi), blue (müşteri), teal (stok), cyan (hizmet), pink (abonelik), purple (POS).
- Tipografi: 9–12 px yoğun bilgi; para `font-mono`; `formatMoney()` → `{integerPart, decimalPart, symbol, formatted}` (`tr-TR`, `1.234,56₺`).
- Animasyon: her sayfada `<style jsx global>` ile tanımlanan `fadeInUp / fadeInDown / fadeSlideRight` keyframe'leri + Tailwind `animate-in` sınıfları. (`custom-scrollbar` sınıfı hiçbir yerde tanımlı değildir.)

### 9.2 Tekrarlayan Kalıplar
- **Onay modalı:** `confirmDialog` state'i `{isOpen, title, message, confirmText, cancelText, isDanger, onConfirm}`; tarayıcı `confirm()` kullanılmaz.
- **Toaster:** her sayfa kendi `<Toaster>` render eder (TopBar çakışmasını önlemek için sabit `bottom-right` pozisyonunda ve `containerStyle={{ zIndex: 99999999 }}` ile render edilir).
- **Merkez seçici:** `<select>` içinde `common` + iki `optgroup` (Ticari / Şahsi).
- **Ödeme kaynağı değeri:** `"cash|<id>"`, `"bank|<id>"`, `"card|<id>"` string'i `split('|')` ile ayrıştırılır.
- **Tarih:** `getLocalTodayISO()` yerel tarih (`YYYY-MM-DD`), `formatDateTR()` → `GG.AA.YYYY`. POS ve abonelik bazı yerlerde `toISOString().split('T')[0]` (UTC) kullanır — gece yarısı civarı gün kayması riski.
- **Yürüyen bakiye:** hareketler tarih desc sıralı gelir; güncel bakiyeden geriye doğru satır bakiyesi hesaplanır.

### 9.3 Veri Çekme
- Her ekran `useEffect(() => {...}, [])` ile paralel değil **ardışık** `await` zinciriyle yükler; ilk seçili kayıt otomatik seçilir (`data[0].id`).
- Her yazma sonrası ilgili `fetch*()` fonksiyonları tekrar çağrılır (optimistic update yok).

---

## 10. Bilinen Sorunlar ve Teknik Borç

### KRİTİK

**KRİTİK-1 — POS kartlı giderler yanlış tabloya yazılıyor ve kart borcunu siliyor.**
`retail/page.tsx` kartlı gider ekstresini `credit_card_transactions` tablosuna `credit_card_id` kolonuyla yazar; diğer tüm modüller `card_transactions` / `card_id` kullanır. Ardından yalnızca `credit_card_transactions` toplamını `credit_cards.current_debt` alanına yazar. Sonuç: POS'ta kartlı gider girilip gün kaydedildiğinde, (a) tablo yoksa insert sessizce başarısız olur, (b) tablo varsa o kartın `card_transactions`'tan gelen gerçek borcu **sıfırlanıp yalnız POS giderine eşitlenir**; kredi kartı ekranındaki bir sonraki işlem ise POS giderini görmeden borcu tekrar üzerine yazar. İki tablo birbirini ezer.

**KRİTİK-2 — "Geri Al (Rollback)" hiçbir şeyi geri almaz.**
`activity/page.tsx › executeRollback` sadece `audit_logs`'a `ROLLBACK` satırı ekler ve "hesaplar dengelendi" mesajı gösterir. Veritabanı tetikleyicisi olmadığı sürece kasa/cari/stok değişmez. UI metni yanıltıcıdır.

**KRİTİK-3 — Kimlik doğrulama ve yetkilendirme yok.**
`anon` anahtar tarayıcıya gömülüdür; RLS politikası repo'da yok. URL'yi bilen herkes tüm finansal veriyi okuyup silebilir.

**KRİTİK-4 — Atomik olmayan çok adımlı yazma.**
Örn. gider ekle → kasa hareketi → bakiye → log: ağ hatası ortada kesilirse gider kaydı var ama kasadan düşmemiş kalır. Hiçbir adım geri alınmaz.

### YÜKSEK

- **Y-1** Kredi kartı ekranı, `EXP-`/`SUPP-` ön ekli hareketleri silmeye izin verir; gider/tedarikçi kaydı ise yerinde kalır → tutarsızlık.
- **Y-2** Varlık silme (kasa, banka, kart, depo, tedarikçi, müşteri) yalnız ana satırı siler; alt hareketlerin temizliği DB cascade'ine bağlı. Cascade yoksa yetim hareket, varsa çapraz modül hareketleri (örn. gider kaydının `EXP-` bacağı) kaybolur ve gider ekranı hâlâ kaynağı gösterir.
- **Y-3** Silinen kasa/banka/kart, `expense_transactions.payment_source_id` gibi alanlarda referans olarak kalır; yeniden "iade" denenince `modifyPaymentSourceBalance` sessizce `return` eder.
- **Y-4** Bank/kasa `recalculate*` fonksiyonları tüm hareketleri çeker; PostgREST varsayılan **1000 satır limiti** aşılırsa bakiye eksik hesaplanır. Aynı limit dashboard/rapor sorgularında da geçerli (`.limit()` yok).
- **Y-5** Abonelik tahsilatı silinirken hareket **açıklama metniyle** aranır (`limit(1)`, en yeni). Aynı kullanıcı için iki tahsilat varsa yanlış kayıt silinebilir.
- **Y-6** POS `syncForwardBalances` her kayıtta tüm günleri gezer (gün sayısı × 4 sorgu). Bir yıl sonra kayıt süresi ciddi uzar.
- **Y-7** Sabit yedek kur (34.25 / 37.80) güncel değil; API erişilemezse dashboard değerleri fark edilmeden sapar.

### ORTA

- **O-1** `activity` modül filtresi tam eşleşme yapar; `*_tx`, `*_transfer`, `invoice`, `card_tx`, `credit_card`, `warehouse`, `company`, `service` kayıtları hiçbir filtreye düşmez.
- **O-2** TopBar `routeNames` içinde `/activity` yok → başlık "CTC Master Ledger" görünür.
- **O-3** POS `date` alanları `new Date().toISOString()` (UTC) ile üretilir; TR saatiyle 00:00–03:00 arasında bir önceki gün seçilir.
- **O-4** `expense_transactions` için hem `tx_date` hem eski `date` kolonu okunur; şema temizliği gerekiyor.
- **O-5** Rapor tarih aralığı `'-31'` gibi geçersiz gün string'iyle karşılaştırır (string compare çalışır ama kırılgandır).
- **O-6** `stocks.unit_price` her girişte son fiyatla **ezilir**; ortalama maliyet yoktur, KDV dahil değerleme raporları dalgalanır.
- **O-7** Cüzdan `unit_cost`, lot para birimi cüzdanla farklıysa `handleLoadCredit` içinde `exRate` ile, `handleSaveWallet` içinde `exRate || 1` ile hesaplanır; küçük tutarsızlık.
- **O-8** `expenses` formunda `txCompanyId === 'common'` kontrolü var ama seçenek yok; ortak gider girilemez (Dashboard "Ortak" filtresinde gider her zaman boş).
- **O-9** `<style jsx global>` styled-jsx sözdizimi; App Router'da düz `<style>` olarak basılır, `jsx`/`global` boolean attribute uyarıları üretir. 12 sayfada tekrar eden aynı keyframe'ler `globals.css`'e taşınmalı.
- **O-10** `custom-scrollbar` sınıfı tanımsız (görsel etkisi yok, ölü sınıf).
- **O-11** `TopBarRates.tsx` ve `framer-motion` kullanılmıyor; `public/*.svg` şablon artığı.
- **O-12** `README.md` create-next-app şablonu; proje bilgisi içermiyor.

### DÜŞÜK / İYİLEŞTİRME

- Tüm sayfalar `'use client'`; ilk yükte boş ekran + N ardışık istek. Server Component + tek RPC/SQL view ile hız kazanılabilir.
- Tip güvenliği zayıf: `any` yaygın, `invoice_lines` şeması TS ile bağlı değil, Supabase tip üretimi (`supabase gen types`) kullanılmıyor.
- Test yok (unit/e2e), CI yok, lint dışında kalite kapısı yok.
- Erişilebilirlik: 8–10 px yazı, ikon butonlarda `aria-label` yok.

---

## 11. Geliştirme Kılavuzu

### 11.1 Yeni Bir Hareket Türü Eklerken Kontrol Listesi
1. Hareketi ilgili `*_transactions` tablosuna yaz; çapraz modülse hedef tabloya `transfer_id` ön ekiyle ikinci hareketi yaz.
2. Etkilenen her varlık için ilgili `recalculateAbsolute*` fonksiyonunu çağır (bakiye asla elle `+=` yapılmaz).
3. `logActivity(module, action, description, recordId, amount, currency, oldData, newData, companyId)` çağır. `module` adını `activity/page.tsx › MODULE_OPTIONS` ile uyumlu seç.
4. Silme yolunu da yaz: kaynak hareket + `transfer_id` ile hedef hareketler + yeniden hesaplama + log.
5. Kasa/banka ekranlarındaki ön ek etiketleme ve silme koruması listesine yeni ön eki ekle.
6. Dashboard/rapor hesaplarına dahil edilmesi gerekiyorsa `page.tsx` ve `reports/page.tsx` toplamlarını güncelle (çift sayım kontrolü).

### 11.2 Yeni Modül/Sayfa Eklerken
- `app/<route>/page.tsx` oluştur, `'use client'`.
- `Sidebar.tsx › menuItems` ve `TopBar.tsx › routeNames` listelerine ekle.
- Sayfa iskeleti: üst bilgi kartı → içerik → `confirmDialog` modalı → form modalları → keyframe stili. (Uzun vadede ortak bileşene çıkarılması önerilir.)

### 11.3 Veritabanı Değişikliği
- Repo'da migration yok; Supabase SQL Editor'da yapılan değişiklikler **bu dokümana ve `docs/RUNBOOK.md` › Şema bölümüne** işlenmeli.
- Yeni kolon eklenirken kodun `select('*')` kullandığı yerlere dikkat: fazla kolon zararsız, eksik kolon `undefined` üretir ve toplamlarda `NaN` yayar.

### 11.4 Komutlar
```bash
npm install          # bağımlılıklar
npm run dev          # http://localhost:3000
npm run lint         # eslint
npm run build        # üretim derlemesi (tip hataları burada çıkar)
npm start            # derlenmiş uygulamayı çalıştır
```

---

## 12. Sözlük

| Terim | Anlamı |
|---|---|
| Merkez / Masraf Merkezi | `companies` satırı; ticari şirket veya şahsi/ev birimi |
| Ortak / Bağımsız | `company_id = NULL` |
| Cari | Tedarikçi veya müşteri hesabı |
| Borç / Fatura (+) | Cari bakiyeyi artıran hareket (`debt`) |
| Ödeme / Tahsilat (−) | Cari bakiyeyi azaltan ve bir kasa/banka/kart hareketi üreten hareket (`payment`) |
| Detaylı Fatura | `is_detailed = true`, `invoice_lines` içeren cari hareket |
| Virman | Kasa↔kasa, kasa↔banka, banka↔banka transferi (`TRF-`) |
| Provizyon | POS kart cirosunun bankada `pending` beklemesi |
| Valör | Provizyonun fiilen hesaba geçtiği tarih |
| Z-Raporu | POS'ta bir günün kapanış kaydı |
| Fotokopi N/K | POS'ta nakit/kart fotokopi geliri; %50 sabit maliyetle kaydedilir |
| Kredi Cüzdanı | Tedarikçiden toptan alınan lisans kredilerinin FIFO deposu |
| Lot | Cüzdana tek seferde yüklenen kredi partisi (`fifo_lots[i]`) |
| Mutlak Hesaplama | Bakiyenin tüm hareketlerden yeniden toplanması |
| SMM | Satılan Malın Maliyeti (dashboard "SMM & Direkt Mlyt.") |
| Hayalet Bakiye | Cüzdan `balance` ile `fifo_lots` toplamının uyuşmaması |

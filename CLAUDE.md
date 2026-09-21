@AGENTS.md

## Project — CTC Master Ledger (ctc-erp)

**CTC Master Ledger** tek kullanıcılı (yönetici) bir **finans + stok + perakende POS defteri**dir: birden fazla ticari şirket ve şahsi masraf merkezinin kasa, banka, kredi kartı, stok, cari (tedarikçi/müşteri), gider, abonelik ve günlük mağaza Z-raporu takibini tek ekranda toplar. Arayüz Türkçe; para birimleri TRY/USD/EUR; raporlama para birimi TRY.

**Çekirdek vaat:** Her para ve stok hareketi tek bir hareket tablosuna yazılır, ilgili varlığın bakiyesi **hareketlerden yeniden toplanır** (asla artımlı `+=` yapılmaz) ve her yazma `audit_logs`'a düşer. Bir hareket başka modülden yansıdıysa (`transfer_id` ön eki) yalnız kaynağından silinir.

### Hard constraints

- **Framework**: Next.js 16 App Router + React 19 + TypeScript strict — `AGENTS.md`'nin uyarısı geçerli: kod yazmadan önce `node_modules/next/dist/docs/` oku, eğitim verisindeki API'lere güvenme.
- **Stil**: Tailwind v4 (`@tailwindcss/postcss`), koyu tema sabit; ikon `lucide-react`; bildirim `react-hot-toast`. Başka UI kütüphanesi ekleme.
- **Veri**: Supabase Postgres, **doğrudan tarayıcıdan** `supabase-js` ile (`lib/supabase.ts`). Sunucu katmanı, API route, ORM yok. Şema repo'da değil — koddan çıkarılmış referans `docs/HANDBOOK.md §5`, kurulum SQL'i `docs/RUNBOOK.md §3`.
- **Kur**: `open.er-api.com/v6/latest/USD`, yedek sabitler `34.25 / 37.80`. Kayıt anında `exchange_rate` sabitlenir.
- **Kimlik**: Yok. Anon anahtar tarayıcıya gömülü; güvenlik RLS + ağ katmanına bağlı (`docs/AUDIT-2026-09-16.md` S-1/S-2).
- **Dil**: İletişim, açıklamalar, kod içi yorumlar, UI metinleri ve commit gövdeleri her zaman Türkçe; kod tanımlayıcıları İngilizce; tablo/kolon adları `snake_case`.
- **Ekip**: solo dev + Claude. Kod ilk sürümünde başka bir yapay zeka ile yazıldı; bilinen yapısal sorunlar denetim raporunda sınıflandırıldı.

## Docs — pointer map

Detay `docs/` altında. En yakın konuyu bul, o dosyayı oku; burada tekrar etme.

| İhtiyaç | Oku |
|---|---|
| Mimari, temel kavramlar (merkez, `transfer_id` ön ekleri, sihirli açıklamalar, provizyon) | `docs/HANDBOOK.md §3–4` |
| Tablo/kolon listesi, `invoice_lines` ve `fifo_lots` JSON şekilleri | `docs/HANDBOOK.md §5` |
| Bakiye formülleri, kur dönüşümü, stok değerleme, fatura/FIFO/POS/P&L kuralları | `docs/HANDBOOK.md §6` |
| Modül modül ekran ve yan etki rehberi | `docs/HANDBOOK.md §7–8` |
| Bilinen sorunlar ve teknik borç listesi | `docs/HANDBOOK.md §10` |
| Yeni hareket türü / yeni sayfa ekleme kontrol listesi | `docs/HANDBOOK.md §11` |
| Kurulum, env, Supabase şema SQL, RLS seçenekleri, deploy | `docs/RUNBOOK.md §2–4` |
| Gün sonu POS kapanışı, provizyon onayı, ay sonu prosedürü | `docs/RUNBOOK.md §6` |
| Arıza giderme ve onarım SQL'leri (bakiye tutarlılık, yetim kayıt, POS devir zinciri) | `docs/RUNBOOK.md §7–8` |
| Mimari + güvenlik denetimi, önceliklendirilmiş düzeltme planı | `docs/AUDIT-2026-09-16.md` |

### Always-on cross-cutting truths

- **Çapraz modül hareketleri `transfer_id` ön ekiyle işaretlenir** (`EXP-`, `SUPP-`, `CUST-`, `POS-*`, `TRF-`). Kasa/banka ekranları bu ön ekleri silmeyi reddeder; yeni ön ek eklersen etiket + koruma listesini de güncelle (`app/cash-registers/page.tsx`, `app/bank-accounts/page.tsx`). Not: `supplier_transactions` tablosunda `transfer_id` kolonu yoktur; POS tedarikçi maliyetleri sihirli açıklama (`Mağaza Hizmet Alımı (POS-<tarih>)`) ve `invoice_lines` ile bağlanır, cari ekranından silme engellenir.
- **Kredi kartı hareketleri `card_transactions` / `card_id` / `expense|payment`'tır.** `credit_card_transactions` tablosu POS'ta kalmış bir hatadır (AUDIT C-1); yeni kod ona yazmaz.
- **Açılış bakiyeleri hareket olarak yaşar** ve açıklama metniyle tanınır (`Açılış Bakiyesi / Devir`, `Dönem Başı Devir Borcu`, `Açılış Stoğu`). Bu string'leri değiştirme.
- **POS kart cirosu bankaya `status='pending'` yazılır**, bakiyeye girmez; onay bankadan yapılır. Tüm banka toplamları `status !== 'pending'` filtresi taşır.
- **`company_id = NULL` = Ortak.** Formda `'common'` seçeneği → DB'ye `null`. Dashboard/rapor filtresi `'all' | 'common' | uuid`.
- **PostgREST 1000 satır limiti** `.limit()` kullanılmayan tüm toplamları etkiler; büyük hesaplarda `max_rows` yükseltilmeli (RUNBOOK §3.4).
- **"Geri Al" gerçek geri alma değildir**; yalnız log satırı ekler. Kullanıcıya böyle sunulmalı veya kaldırılmalı.
- **Türkçe küçük harf:** aramalarda `toLocaleLowerCase('tr-TR')` tercih et (mevcut kod bare `.toLowerCase()` kullanıyor; dokunduğun yerde düzelt).
- **Tarih:** yerel tarih için `getLocalTodayISO()`; `new Date().toISOString().split('T')[0]` UTC kaydırır, yeni kodda kullanma.

## 🚨 CANLI ÜRETİM (PRODUCTION) VE VERİ KORUMA PROTOKOLÜ (ZORUNLU)

> 🔴 **DİKKAT: Sistem GitHub → Vercel CI/CD entegrasyonu ile CANLI KULLANIMA geçmiştir.**
> `main` dalına atılan her commit/push anında Vercel üzerinden prodüksiyona deploy edilir. Kullanıcı gerçek verilerini (stoklar, kasalar, cariler, servis kayıtları, faturalar vb.) girmeye başlamıştır. **ASLA GERİ DÖNÜŞÜ OLMAYAN VERİ KAYBINA YOL AÇILAMAZ.**

1. **Kesin Veri Kaybı Yasağı (Zero Data Loss):**
   - Tabloları sıfırlamak, `DROP TABLE`, `TRUNCATE` veya veri düşüren `ALTER TABLE` çalıştırmak kesinlikle **YASAKTIR**.
   - Stok, bakiye, müşteri veya işlem geçmişini yok eden temizleme scriptleri ASLA yazılamaz veya çalıştırılamaz.
   - Hiçbir stok, cari veya finansal kayıt test amaçlı bile olsa silinemez/ezilemez.

2. **Veritabanı Ön Kontrolü & Migration Disiplini:**
   - Veritabanında herhangi bir işlem veya şema değişikliği yapılmadan önce **MUTLAKA mevcut veriler incelenir** (`SELECT ...`, satır sayısı, mevcut kolonlar ve veri durumları).
   - Şema değişiklikleri yalnızca **geriye dönük uyumlu (additive / backwards compatible)** migration dosyaları (`supabase/*.sql`) olarak yazılır (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS` vb.).

3. **Supabase'e Doğrudan Bağlantı & Ajan Özerkliği:**
   - Ajan, yerel `.env.local` dosyasındaki `SUPABASE_SERVICE_ROLE_KEY` ve Supabase API/Node istemcisini doğrudan kullanarak veri okuma, veri doğrulama, bakiye senkronizasyonu ve kontrolleri **kendi araçlarıyla arka planda doğrudan gerçekleştirir**.
   - Kullanıcıya gereksiz yere "şu scripti çalıştırın", "konsoldan bunu yapın" şeklinde manuel görevler yüklenmez. Ajan tüm kontrolleri ve veri işlemlerini kendisi yürütür.

4. **Pre-Push Güvenlik Kapısı (`npm run build`):**
   - Canlı ortama (`origin main`) push yapmadan önce yerelde `npm run build` **MUTLAKA 0 hata ile tamamlanmalıdır**. Vercel derlemesini bozacak hiçbir commit canlıya gönderilemez.

## Çalışma kuralları (ZORUNLU — insan ve ajan için)

1. **Koda dokunmadan önce bu dosya okunur.** Projeye yeni katılan herkes (geliştirici veya yapay zeka ajanı) sırayla `CLAUDE.md` → `docs/HANDBOOK.md §3–6` → ilgili modülün `docs/HANDBOOK.md §7` bölümünü okur. "Şemayı koddan çıkarırım" yaklaşımı yasak; şema ve kurallar dokümanda.
2. **Her iş başında** `docs/AUDIT-2026-09-16.md`'deki ilgili bulgular kontrol edilir; dokunulan dosyada açık bir bulgu varsa aynı değişiklikte düzeltilir veya bilinçli olarak ertelendiği commit mesajında yazılır.
3. **Her iş sonunda doküman güncellenir — kod merge edilmeden önce, aynı commit/PR içinde:**
   - Yeni tablo/kolon, `transfer_id` ön eki, sihirli açıklama metni, formül veya iş kuralı → `docs/HANDBOOK.md` ilgili bölüm (§4–6).
   - Yeni ekran, buton, modal veya yan etki → `docs/HANDBOOK.md §7–8`.
   - Yeni operasyon adımı, env değişkeni, deploy adımı, arıza senaryosu veya onarım SQL'i → `docs/RUNBOOK.md`.
   - Bir denetim bulgusu kapandıysa → `docs/AUDIT-2026-09-16.md`'de satırın başına `✅ (commit sha)` işareti.
   - Bu dosyadaki *Always-on truths* veya *Architecture map* değiştiyse → burası.
   "Dokümanı sonra yazarım" kabul edilmez; dokümansız değişiklik **bitmemiş** sayılır.
4. **Dokümanla kod çelişirse kod kazanır, ama çelişki aynı gün giderilir:** yanlış olan taraf düzeltilir ve HANDBOOK'un ilgili bölümüne tarih notu düşülür.
5. **Bulgu bulunca kaydet:** kod okurken yeni bir hata, güvenlik açığı veya tutarsızlık görülürse (düzeltilmese bile) `docs/AUDIT-2026-09-16.md`'ye şiddet + konum ile eklenir.
6. **Yıkıcı veri işlemi YASAKTIR.** Bakım veya onarım gerekiyorsa önce `docs/RUNBOOK.md §8.1` yedeği alınır ve kullanıcı onayı beklenir.
7. **Trivial olmayan her değişiklik önce plan:** etkilenen tablolar, `recalculate*` çağrıları, silme yolu ve dokümanda güncellenecek bölümler listelenir; onaydan sonra kod yazılır.

## Conventions

- **Dosya boyutu**: sayfalar şu an 600–1500 satır; yeni kod bu dosyaları büyütmez. Ortak mantık `lib/` altına (`lib/ledger.ts`, `lib/audit.ts`, `lib/dates.ts`), ortak JSX `app/components/` altına çıkarılır. Hedef 200–400 satır/dosya.
- **Fonksiyonlar** <50 satır, iç içe <4 seviye. Tek işlemde birden çok tabloya yazan akışlar önce ayrı adım fonksiyonlarına bölünür.
- **Tip güvenliği**: `any` yeni kodda yok. Supabase tipleri `supabase gen types typescript` ile üretilip `lib/database.types.ts`'e alınmalı; `invoice_lines`/`fifo_lots` için açık TS tipleri.
- **Hata yönetimi**: `try/catch` içinde `toast.error` + `console.error`; hatayı yutma. Çok adımlı yazmalarda kısmi başarı durumunu kullanıcıya söyle.
- **Sabitler**: yedek kurlar, POS kategori listesi, renk temaları, sihirli açıklama string'leri tek bir `lib/constants.ts`'e toplanır; kopyalama.
- **Commit**: conventional type (`feat, fix, refactor, docs, chore, perf, test`), subject küçük harf, gövde Türkçe olabilir. Push kullanıcı istemeden yapılmaz.
- **Yıkıcı işlem**: tablo `delete`/`truncate`, kolon düşürme, toplu `update` önce kullanıcı onayı; önce `docs/RUNBOOK.md §8.1` yedeği.
- **Analiz disiplini**: düzeltme önerisini Next.js 16 / Supabase resmi dokümanına dayandır; büyük yapısal değişiklik (auth ekleme, sunucu katmanı, RPC'ye taşıma) önce tartışılır, sessizce yapılmaz.
- **Yorum**: varsayılan yok; yalnız "neden" açık değilse (gizli kısıt, çift sayım koruması, workaround).

## Architecture map

- `app/layout.tsx` — kök layout (server), `Sidebar` + `TopBar` + `<main>`
- `app/page.tsx` — dashboard: 14 tablo çeker, P&L, net durum, son işlemler
- `app/retail/` — POS Z-raporu; `syncPosToMainSystem` tüm modüllere yansıtır
- `app/cash-registers/`, `app/bank-accounts/`, `app/credit-cards/` — hesap + hareket + virman
- `app/stocks/`, `app/services/` — depo/kategori/stok kartı/hareket; hizmet kartları
- `app/suppliers/`, `app/customers/` — cari + detaylı fatura (stok bağlantılı)
- `app/expenses/` — gider + kaynağa yansıma
- `app/subscriptions/` — kredi cüzdanı (FIFO) + abonelik + tahsilat
- `app/reports/` — dönemsel mizan, yazdırma CSS'i
- `app/companies/` — masraf merkezleri
- `app/activity/` — `audit_logs` görüntüleyici
- `app/components/` — `Sidebar`, `TopBar` (`TopBarRates` kullanılmıyor)
- `lib/supabase.ts`, `lib/utils.ts` (`formatMoney`)
- `docs/` — HANDBOOK, RUNBOOK, AUDIT

## Local env

```bash
npm install
cat > .env.local <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
EOF
npm run dev      # :3000
npm run lint && npm run build   # tek kalite kapısı; test yok
```

`next dev` kökteki `AGENTS.md`/`CLAUDE.md`'yi yeniden üretir; bu dosyanın ilk satırı `@AGENTS.md` importu olmalı, kalanı elle yazılır.

---

> **Maintenance note** (2026-09-16): Bu dosya kısa tutulur; detay `docs/`'a gider. Şema değişince `docs/HANDBOOK.md §5` ve `docs/RUNBOOK.md §3` güncellenir, buraya kolon listesi yazılmaz.

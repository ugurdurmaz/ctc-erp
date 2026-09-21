# Canlı Üretim (Production) ve Sıfır Veri Kaybı Kuralları

> 🔴 **Sistem canlıda kullanılmaktadır (GitHub → Vercel CI/CD).**
> `main` dalına atılan her commit doğrudan Vercel üzerinden anında canlıya dağıtılır. Gerçek stok, cari, kasa ve fiş verileri girilmektedir. **Geri dönüşü olmayan veri kaybına sebep olacak hiçbir işlem yapılamaz.**

## 1. Kesin Veri Kaybı Yasağı (Zero Data Loss)
- Tabloları sıfırlamak, `DROP TABLE`, `TRUNCATE` veya veri düşüren `ALTER TABLE` çalıştırmak kesinlikle **YASAKTIR**.
- Canlı stokları, cari bakiyeleri, müşteri listelerini veya geçmiş hareketleri sıfırlayan veya bozan hiçbir işlem yapılamaz.
- Test amaçlı dahi olsa canlı veritabanında sahte kayıt girip topluca silme veya mevcut kayıtları ezme işlemi yapılamaz.

## 2. Veritabanı Ön Kontrolü & Migration Disiplini
- Veritabanına herhangi bir müdahale öncesinde **MUTLAKA mevcut veriler incelenir** (`SELECT ...`, satır sayıları ve mevcut kolon tipleri kontrol edilir).
- Şema güncellemeleri yalnızca geriye dönük uyumlu (additive / backwards compatible) migration dosyaları (`supabase/*.sql`) olarak yazılır (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS` vb.).

## 3. Supabase'e Doğrudan Bağlantı & Ajan Özerkliği
- Ajan, yerel `.env.local` dosyasındaki `SUPABASE_SERVICE_ROLE_KEY` ile veritabanına doğrudan bağlanarak veri doğrulama, okuma, senkronizasyon ve analizleri kendi araçlarıyla yürütür.
- Kullanıcıya gereksiz yere "şu SQL'i çalıştırın", "konsoldan bunu yapın" şeklinde manuel görevler yüklenmez. Ajan tüm kontrolleri ve veri işlemlerini kendisi yürütür.

## 4. Pre-Push Kapısı (`npm run build`)
- `origin main`'e push yapmadan önce yerelde `npm run build` MUTLAKA çalıştırılmalı ve 0 hata ile derlendiği teyit edilmelidir. Vercel derlemesini bozacak hiçbir commit canlıya atılamaz.

# BİLGİSAYAR HASTANESİ — CTC MASTER LEDGER KULLANIM KILAVUZU
**Hazırlayan:** Sistem Yönetimi  
**Kullanıcı:** İbrahim (Mağaza & Teknik Servis Sorumlusu)  
**Kapsam:** Bilgisayar Hastanesi Günlük Dükkan, Kasa, Servis ve Finans İşleyişi  

---

## 1. GİRİŞ VE SİSTEMİN TEMEL ÇALIŞMA MANTIĞI

Hoş geldin İbrahim! Bu kılavuz, Bilgisayar Hastanesi'ndeki günlük satışları, teknik servis süreçlerini, parça girişlerini, kasa hareketlerini ve dükkan giderlerini hatasız bir şekilde takip edebilmen için adım adım hazırlanmıştır.

### Sistemin Temel İlkesi: "Her Gerçek İşlem, Sistemde de Yapılır"
* Dükkana giren **her 1 TL nakit** veya **her 1 adet yedek parça**, sistemde de karşılık bulmalıdır.
* Müşteriden para aldığında sisteme girmezsen akşam kasan tutmaz.
* Raftan bir parça alıp cihaza taktığında sisteme işlemezsen sayım yaptığında stoğun eksik çıkar.
* **Yetkin ve Güvenliğin:** Sistemde sadece Bilgisayar Hastanesi'ne ait verileri, kasayı, bankayı ve stokları görürsün. Merkezin veya ortakların şahsi hesapları senin ekranında görünmez ve senin yaptığın işlemler sadece Bilgisayar Hastanesi'nin kâr/zararını etkiler.

---

## 2. GÜNE BAŞLARKEN: SABAH AÇILIŞ KONTROLÜ

1. **Giriş Yap:** Kullanıcı adın ve şifrenle sisteme giriş yap.
2. **Kasa Bakiyeni Kontrol Et:**
   * Sol menüden **Nakit Kasa** sekmesine tıkla.
   * "Bilgisayar Hastanesi Ana Kasası"nda gözüken bakiye ile çekmecendeki fiziki nakit parayı karşılaştır.
   * Eğer akşamdan devreden para ile sistemdeki para aynıysa güne hazırsın.

---

## 3. GÜNLÜK İŞ SENARYOLARI (ADIM ADIM)

---

### SENARYO 1: GÜNLÜK MAĞAZA KASASI (PERAKENDE SATIŞ DEFTERİ)
> **Örnek Olay:** Dükkana gelen bir müşteri flash bellek satın aldı (250 TL nakit), başka bir müşteri ise oyun yükletti ve kredi kartıyla ödedi (400 TL POS).

1. Sol menüden **Mağaza** sekmesine tıkla. Bu ekran senin günlük perakende satış defterindir.
2. **Üst Finans Şeridini Kontrol Et:**
   * Sayfanın tepesinde **KASA**, **NAKİT**, **K.KARTI**, **SERVİS** ve **GİDER** kutucuklarını göreceksin. Burada gün boyu yapılan tüm tahsilatların anlık canlı toplamı tutulur.
3. **Satışı İlgili Kategori Kutusuna Yaz:**
   * Ekrandaki kategori kutularından uygun olanına gel:
     * **Aksesuar & Sarf Malzeme:** Flash bellek, kablo, adaptör, mouse, klavye vb.
     * **Oyun & Prog Yükleme:** Yazılım ve oyun yükleme işlemleri.
     * **DVD & Hariciye:** Medya, film, müzik satışları.
     * **Orjinal Film & Oyun:** Orijinal kutulu ürünler.
     * **Diğer:** Muhtelif perakende satışlar.
4. **Satır Doldurma (Açıklama, Adet, Tahsilat):**
   * Boş satırdaki *"Açıklama veya Ürün Seç..."* alanına tıkla. İstersen klavyeyle doğrudan yaz (örn: "Kingston 32GB USB"), istersen açılan listeden depodaki stok kartını seç (stok kartından seçtiğin ürün dükkan deposundan otomatik düşer).
   * **Adet:** Satılan miktarı yaz (örn: 1).
   * **Nakit / K.Kartı Ayrımı:** Müşteri elden nakit ödediyse tutarı **NAKİT** sütununa (örn: 250), dükkanın POS cihazından kart çektirdiysen **K.KARTI** sütununa (örn: 400) yaz!
   * *Not:* Müşteri parçalı ödeme yaptıysa aynı satırda her iki sütuna bölerek yazabilirsin.
5. **Günün Ufak Masraflarını Yaz (Gider & Masraf):**
   * Dükkana su, çay/şeker aldıysan veya ufak bir kargo ödediysen sağ üstteki turuncu **Gider & Masraf** tablosuna satır açıp tutarı gir. Bu tutar anında dükkan kasandan düşülür.
6. **Banka & Servis Takibi:**
   * Sağ taraftaki **"Günün Teslim Edilen Servis Fişleri"** tablosunda Teknik Servis'ten o gün teslim edilen cihazların gelirleri otomatik olarak listelenir ve kasana eklenir.

---

### SENARYO 2: TEKNİK SERVİS & CİHAZ KABULÜ (EN ÇOK KULLANACAĞIN EKRAN)
> **Örnek Olay:** Ahmet Bey arızalı bir laptop getirdi: "Ekrana görüntü gelmiyor, format atılacak ve SSD takılacak."

#### Adım 1: Cihazı Teslim Alma (Kabul Fişi)
1. Sol menüden **Teknik Servis** sayfasına gir.
2. Sağ üstteki **`+ Yeni Servis Kaydı`** butonuna bas.
3. Bilgileri doldur:
   * **Müşteri:** Ahmet Bey kayıtlıysa seç, yoksa hemen oradan adını ve telefonunu girip kaydet.
   * **Cihaz Türü & Marka/Model:** Örn. Laptop - Asus TUF A15.
   * **Seri No / Şifre:** Cihazın Windows şifresini ve seri numarasını mutlaka yaz.
   * **Fiziksel Durum:** Cihazın yanında şarj aleti alındı mı? Çizik/kırık var mı? (Gereksiz tartışmaları önler).
   * **Müşteri Şikayeti:** "Görüntü gelmiyor, format + SSD talebi."
4. `Cihazı Kaydet` de.
5. **Servis Kabul Fişi Yazdır:** Çıkan formun çıktısını al, bir nüshasını Ahmet Bey'e ver, bir nüshasını cihazın üzerine bantla.

#### Adım 2: Onarım Süreci (Parça ve İşçilik Ekleme)
1. Cihazı masaya aldın ve arızayı tespit ettin.
2. Teknik Servis listesinden Ahmet Bey'in kaydını bulup üzerine tıkla.
3. Durumu **"İşlemde"** olarak güncelle.
4. **Yedek Parça Ekle:**
   * "Kullanılan Yedek Parça" bölümünden raftan aldığın SSD'yi seç (Örn. Kingston 500GB SSD).
   * Bu işlem SSD'yi dükkan stoğundan otomatik olarak düşer.
5. **Hizmet / İşçilik Ekle:**
   * "Hizmet / İşçilik" bölümünden "Format & Kurulum Hizmeti" veya "Termal Macun Bakımı" seç veya tutarı kendin yaz (Örn. 500 TL).
6. Sistem toplam ücreti otomatik hesaplar (Örn. 1.200 TL SSD + 500 TL İşçilik = 1.700 TL).

#### Adım 3: Cihazı Teslim Etme ve Tahsilat
1. İş bittiğinde durumu **"Hazır (Müşteri Bekleniyor)"** yap. Müşteriyi ara.
2. Ahmet Bey dükkana geldiğinde:
   * Kaydın içindeki **`Cihazı Teslim Et & Kapat`** butonuna tıkla.
   * Tahsilat penceresi açılır: Parayı **Nakit** mi aldın, **POS ile Kredi Kartı** mı çektin, yoksa **Veresiye (Cari Borç)** mi bıraktı?
   * Seçimini yap ve onayla.
   * Cihaz durumu **"Teslim Edildi"**ye geçer, tahsilat anında kasana/bankana girer ve dükkanın net kârı yükselir.

---

### SENARYO 3: MÜŞTERİDEN CARİ / VERESİYE TAHSİLATI ALMA
> **Örnek Olay:** Geçen hafta 1.000 TL veresiye bırakan Mehmet Bey dükkana geldi: "Kardeşim borcumu ödemeye geldim."

1. Sol menüden **Müşteriler (Alacak)** sekmesine gir.
2. Arama kutusuna "Mehmet" yaz.
3. Mehmet Bey'in cari kartında kırmızı renkte **1.000 TL Borç** gözükür.
4. Sağındaki **`Tahsilat Al`** butonuna tıkla.
5. Açılan ekranda:
   * **Tutar:** 1000 TL (Kısmi ödüyorsa örn. 500 TL).
   * **Tahsilat Yeri:** Nakit Kasa mı, Banka Havalesi mi?
   * **Tarih:** Bugünün tarihi.
6. `Tahsilatı Kaydet` de.
7. Mehmet Bey'in borcu 0 TL'ye düşer, dükkan kasan 1.000 TL artar.

---

### SENARYO 4: TOPTANCIDAN / TEDARİKÇİDEN YEDEK PARÇA ALIMI
> **Örnek Olay:** Toptancıdan 5 adet klavye ve 10 adet mouse geldi. Toplam 3.000 TL.

1. Sol menüden **Satıcılar (Borç)** veya **Stok Yönetimi** sekmesine gir.
2. Toptancının kartını bul veya yeni tedarikçi ekle.
3. **Alış Faturasını / Mal Girişini İşle:**
   * Hangi depoya gireceğini seç: **"Bilgisayar Hastanesi Ana Deposu"**.
   * Ürünleri ve alış fiyatlarını seçerek stoğa ekle.
4. **Ödeme Durumu:**
   * Toptancıya parayı hemen kasadan verdiysen: `Ödeme Türü: Nakit Kasa (Ödendi)`.
   * Toptancı faturayı açık hesap bıraktıysa: `Ödeme Türü: Açık Hesap / Vadeli`. (Bu durumda tedarikçiye olan borcun artar, kasandan para çıkmaz).

---

### SENARYO 5: DÜKKAN GİDERLERİ (ÇAY, KARGO, TEMİZLİK VB.)
> **Örnek Olay:** Dükkana 150 TL kargo ücreti ödedin veya 100 TL çay/şeker aldın.

1. Sol menüden **Genel Giderler** sayfasına git.
2. Sayfanın ortasındaki **Hızlı Gider Ekle** formuna gel.
3. **Kategori Seç:** "Kargo Gideri" veya "Mutfak / İkram".
4. **Şirket:** "Bilgisayar Hastanesi" seçili olsun.
5. **Ödeme Kaynağı:** "Nakit Kasa -> Bilgisayar Hastanesi Kasası".
6. **Tutar & Açıklama:** "150 TL - Arızalı ekran kargosu".
7. `Gideri Kaydet` butonuna bas.
8. Kasandan 150 TL düşer, gider tablosuna yazılır.

---

### SENARYO 6 (ÇOK ÖNEMLİ): ORTAK KARTLA ÖDENEN GİDERLER VE MERKEZE VİRMANLAMA
> **Örnek Olay:** Merkez veya şirket ortağı (şahsi / ortak kart), Bilgisayar Hastanesi'nin 2 adet vergisini veya dükkan internet faturasını merkezdeki **Ortak Kredi Kartı** ile ödedi. 
> Bu vergi gideri senin dükkanının gideridir; ancak para senin kasan yerine merkez kredi kartından çıkmıştır. 
> Bu durumda kartın son ödeme günü geldiğinde senin bu parayı dükkan kasandan merkeze aktarman (virmanlaman) gerekir.

#### Bunu Nasıl Görecek ve Yapacaksın?
Sistem senin yerine bunu otomatik olarak takip eder ve önüne getirir:

1. **Ana Sayfada (Genel Durum):**
   * Ana sayfadaki **"Yaklaşan ve Ay Sonu Vadeleri"** bölümüne bak.
   * Orada sarı renkte **`⚠️ Merkeze Virman Bekliyor`** uyarısını ve **`[Merkeze Virmanla →]`** butonunu göreceksin.
   * İstersen üstteki filtrelerden **"Kart Mahsubu"** sekmesine tıklayarak sadece bu virmanları listeleyebilirsin.
2. **Genel Giderler Sayfasında:**
   * Giderler tablosunda da bu vergi ödemesinin yanında turuncu **`⚠️ Merkeze Virman Bekliyor`** rozetini ve **`[Virmanla →]`** butonunu görürsün.
3. **Virmanlama Adımı:**
   * **`[Merkeze Virmanla →]`** butonuna tıkla.
   * Karşına bir pencere açılır.
   * **Çıkış Hesabı:** Dükkanındaki nakit paradan vereceksen `Mağaza / Şirket Kasası`, dükkanın şirket hesabından göndereceksen `Şirket Banka Hesabı`nı seç.
   * **`Virmanı Onayla ve Kapat`** butonuna bas!
4. **Sonuç:**
   * Dükkan kasandan ilgili tutar düşer ve merkez karta mahsup aktarımı yapılır.
   * Rozet anında yeşil renkte **`✓ Mahsup Kapatıldı`**ya dönüşür.
   * Böylece hem dükkanının hesabı kapanır, hem de kâr/zararın ikinci kez düşmeden tertemiz kalır!

---

### SENARYO 7: AKŞAM DÜKKAN KAPANIŞI (GÜN SONU KASA MUTABAKATI)

Dükkanın kapısını kilitlemeden önce şu 3 dakikalık işlemi mutlaka yap:

1. **Nakit Parayı Say:** Çekmecedeki kâğıt ve demir paraları say (Örn: 4.850 TL çıktı).
2. **Sistem Kasasına Bak:** Sol menüden **Nakit Kasa** sekmesine tıkla.
   * Sistemdeki Bilgisayar Hastanesi Kasası da **4.850 TL** gösteriyorsa: **Tebrikler, günün 0 hata ile kapanmıştır!**
3. **Eğer Fark Varsa:**
   * Sistem 5.000 TL diyorsa ama çekmecede 4.850 TL varsa: 150 TL'lik bir gideri (örn. kargo veya yemek) sisteme işlemeyi unutmuş olabilirsin. Hemen Genel Giderler'den işle.
   * Çekmecede fazla para varsa: Bir perakende satışı veya servis tahsilatını sisteme girmeyi unutmuşsundur. Kontrol edip kaydet.
4. **Ana Sayfaya Bak:**
   * Ana sayfada bugünkü cironu ve dükkanın bugünkü net kârını görerek günü huzurla tamamla.

---

## 4. ALTIN KURALLAR & "ASLA YAPMAMAN GEREKENLER"

1. **"Sonra Yazarım" Deme:** Bir müşteri ürün aldığında veya para verdiğinde anında sisteme gir. Akşama bırakılan işlemler mutlaka unutulur.
2. **Kafana Göre Kayıt Silme:** Bir faturayı veya gideri yanlış girdiysen rastgele silmek yerine nedenini kontrol et. Sistem her silinen işlemin arkasında log (denetim izi) bırakır.
3. **Açık Hesap (Veresiye) Verirken Müşteriyi Doğru Seç:** Müşteri seçmeden veresiye verirsen kime borç yazıldığı belli olmaz. Telefon numarasını mutlaka teyit et.
4. **Teknik Servis Cihazını Fişsiz Teslim Etme:** Cihazı teslim ederken müşteriye teslim fişi imzalat ve sistemden "Teslim Edildi" olarak kapatmayı unutma.
5. **Kasa Açığı Varsa Şirket Yetkilisiyle Paylaş:** Kasada açıklanamayan bir fark olduğunda durumu merkez yönetimine bildir.

---

*İyi çalışmalar dileriz! Sistemle ilgili takıldığın her an ekranın sağ üst köşesindeki **`[?] Bu Sayfa Nasıl Kullanılır?`** butonuna basabilirsin.*

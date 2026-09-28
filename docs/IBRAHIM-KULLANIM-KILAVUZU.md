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
   * "Bilgisayar Hastanesi Ana Kasası"nda gözüken bakiye ile çekmecendeki fiziki nakit parayı sayıp karşılaştır.
   * Akşamdan devreden nakit ile sistemdeki para kuruşu kuruşuna aynıysa güne hazırsın!
3. **Genel Durum (Dashboard) Vadelerini İncele:**
   * Sol menüden **Genel Durum** sayfasına tıkla.
   * Sayfanın altındaki "Yaklaşan ve Ay Sonu Vadeleri" tablosuna bak. Bugün ödenmesi gereken bir dükkan faturası, tedarikçi borcu veya merkeze yapılacak virman var mı kontrol et.

---

## 3. GÜNLÜK İŞ SENARYOLARI (ADIM ADIM)

---

### SENARYO 1: GÜNLÜK MAĞAZA KASASI (PERAKENDE SATIŞ DEFTERİ)
> **Örnek Olay:** Dükkana gelen bir müşteri flash bellek satın aldı (250 TL nakit), başka bir müşteri ise oyun yükletti ve kredi kartıyla ödedi (400 TL POS).

1. Sol menüden **Mağaza** sekmesine tıkla. Bu ekran senin günlük perakende satış defterindir.
2. **Üst Finans Şeridini Kontrol Et:**
   * Sayfanın tepesinde **KASA**, **NAKİT**, **K.KARTI**, **SERVİS** ve **GİDER** kutucuklarını göreceksin.
   * **KASA:** Sabah açılış devri + gün içindeki nakit girişler - anlık harcamalar.
   * **NAKİT:** Gün içinde müşterilerden elden alınan toplam nakit para.
   * **K.KARTI:** Dükkandaki POS cihazından çekilen toplam kredi kartı tutarı.
   * **SERVİS:** Teknik Servis'ten o gün teslim edilen cihazların otomatik gelen geliri.
   * **GİDER:** Dükkandan o gün yapılan anlık harcamaların toplamı.
3. **Satışı İlgili Kategori Kutusuna Yaz:**
   * Ekrandaki 6 kategori kutusundan uygun olanına gel:
     * **Aksesuar & Sarf Malzeme:** Flash bellek, kablo, adaptör, mouse, klavye vb.
     * **Oyun & Prog Yükleme:** Format, yazılım, lisans ve oyun yükleme işlemleri.
     * **DVD & Hariciye:** Medya, film, müzik satışları.
     * **Orjinal Film & Oyun:** Orijinal kutulu ürünler.
     * **Diğer:** Muhtelif perakende satışlar.
     * **Servis:** Günlük hızlı servis işçilikleri.
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

### SENARYO 2: TEKNİK SERVİS & CİHAZ KABULÜ (EN ÇOK KULLANILAN MODÜL)
> **Örnek Olay:** Ahmet Bey arızalı bir laptop getirdi: "Ekrana görüntü gelmiyor, format atılacak ve SSD takılacak."

#### Adım 1: Cihazı Teslim Alma (Kabul Fişi)
1. Sol menüden **Teknik Servis** sayfasına gir.
2. Sağ üstteki **`+ Yeni Servis Kaydı`** butonuna bas.
3. Form Bilgilerini Doldur:
   * **Müşteri Bilgisi:** Ahmet Bey listede kayıtlıysa seç; yoksa adını ve telefon numarasını girip kaydet.
   * **Cihaz Türü:** Laptop, Masaüstü PC, All-in-One, Monitör, Game Console, Game Pad, Tablet/Telefon veya Diğer.
   * **Marka & Model:** Örn: Asus TUF A15.
   * **Seri No & Cihaz Şifresi:** Cihazın seri numarasını ve Windows açılış şifresini mutlaka yaz.
   * **Aksesuarlar (Hazır Butonlar):** Orijinal Şarj Aleti / Adaptör, Taşıma Çantası, Güç Kablosu vb. aldıklarını tek tıkla işaretle.
   * **Fiziksel Durum:** Kasadaki mevcut kırık/çizikleri, eksik vidaları mutlaka nota yaz (Sonradan müşteri tartışmalarını önler).
   * **Müşteri Şikayeti:** "Görüntü gelmiyor, format + SSD talebi."
4. `Cihazı Kaydet` butonuna tıkla.
5. **Servis Kabul Fişi Yazdır:** Açılan kabul fişini termal veya normal yazıcıdan çıkar. Bir nüshasını müşteriye ver, ikinci nüshayı cihazın üzerine iliştir.

#### Adım 2: Onarım Süreci (Parça ve İşçilik Ekleme)
1. Cihazı tamir masasına aldığında durumunu **"İncelemede / Arıza Tespiti"** olarak güncelle.
2. Arıza kesinleştiğinde veya onay beklerken durumu **"Müşteri Onayı Bekliyor"** yap.
3. **Yedek Parça Ekle:**
   * "Kullanılan Yedek Parçalar" alanından raftan aldığın parçayı seç (Örn: Kingston 500GB SSD).
   * Bu işlem SSD'yi dükkan deposundaki stoğundan otomatik olarak düşer.
4. **Hizmet / İşçilik Ekle:**
   * "Yapılan Hizmet / İşçilik" alanından "Format & Standart Kurulum" veya "Termal Macun Bakımı" seç ve tutarı belirle (Örn: 500 TL).
5. Sistem parça maliyetini ve toplam servis tutarını otomatik olarak hesaplar (Örn: 1.200 TL SSD + 500 TL İşçilik = 1.700 TL).
6. İşlem tamamlandığında durumu **"Hazır (Onarım Tamamlandı)"** yap.

#### Adım 3: Müşteriye WhatsApp İle Bilgilendirme
* Cihaz "Hazır" olduğunda kartın üzerindeki yeşil **WhatsApp** simgesine bas. Hazır şablon mesaj (Cihazınız hazır, toplam tutar: X TL) müşterinin telefonuna tek tıkla gönderilir.

#### Adım 4: Cihazı Teslim Etme ve Tahsilat
1. Ahmet Bey dükkana geldiğinde kaydın içindeki **`Cihazı Teslim Et`** butonuna tıkla.
2. Tahsilat penceresinde ödeme yöntemini seç:
   * **Nakit:** Para dükkan kasana girer.
   * **Banka / POS Kredi Kartı:** Dükkan POS cihazından çekildiyse şirket banka hesabına girer.
   * **Müşteri Carisine Borç Ekle (Veresiye):** Müşteri "Sonra vereceğim" dediyse bu seçeneği işaretle. Tutar müşterinin carisine borç yazılır, kasana para girmez.
3. Onayladığında cihaz durumu **"Teslim Edildi (Kapatıldı)"**ya geçer, gelir kasana işlenir ve dükkanın kârı artar.

---

### SENARYO 3: MÜŞTERİDEN CARİ / VERESİYE TAHSİLATI ALMA
> **Örnek Olay:** Geçen hafta 1.000 TL veresiye bırakan Mehmet Bey dükkana geldi: "Kardeşim borcumu ödemeye geldim."

1. Sol menüden **Müşteriler (Alacak)** sekmesine gir.
2. Arama kutusuna "Mehmet" yaz.
3. Mehmet Bey'in cari kartında kırmızı renkte **1.000 TL Borç** gözükür.
4. Sağındaki **`[Tahsilat Al]`** butonuna tıkla.
5. Açılan ekranda:
   * **Tutar:** 1.000 TL (Kısmi ödüyorsa örn. 500 TL).
   * **Tahsilat Yeri:** "Bilgisayar Hastanesi Kasası" mı, "Şirket Banka Hesabı" mı?
   * **Tarih:** Bugünün tarihi.
6. `Tahsilatı Kaydet` de.
7. Mehmet Bey'in borcu 0 TL'ye düşer, dükkan kasan 1.000 TL artar. İstersen kartındaki "WhatsApp" butonuna basarak güncel ekstre mesajını gönderebilirsin.

---

### SENARYO 4: TOPTANCIDAN YEDEK PARÇA ALIMI & ALIŞ FATURASI İŞLEME
> **Örnek Olay:** Toptancıdan 5 adet klavye ve 10 adet mouse geldi. Toplam 3.000 TL fatura kesildi.

1. Sol menüden **Satıcılar (Borç)** sayfasına gir.
2. Toptancının kartını bul (veya "+ Yeni Satıcı"dan ekle).
3. Kartın üzerindeki **`[Fatura Ekle]`** butonuna bas.
4. Gelen irsaliye/fatura satırlarını kalem kalem ekle:
   * Ürün Adı, Adet, Birim Alış Fiyatı, KDV Oranı.
   * **Stoğa Ekle:** "Evet" olarak işaretle.
   * **Depo:** "Bilgisayar Hastanesi Ana Depo"yu seç.
5. `Faturayı Kaydet` dediğinde:
   * Ürünler dükkan deposundaki stoğuna anında eklenir.
   * Toptancıya olan borcun 3.000 TL artar.
6. **Ödeme Yapıldıysa:**
   * Toptancıya parayı hemen kasadan verdiysen satıcı kartındaki **`[Ödeme Yap]`** butonuna bas, ödeme kaynağını "Bilgisayar Hastanesi Kasası" seçerek işlemi kapat.

---

### SENARYO 5: STOK KARTI AÇMA, KRİTİK SEVİYELER VE SAYIM
> **Örnek Olay:** Dükkana ilk defa gelen yeni bir model ekran kartı veya kulaklık için stok kartı açılması.

1. Sol menüden **Stok Yönetimi** sayfasına git.
2. Depo filtresinden **"Bilgisayar Hastanesi Ana Depo"**yu seç.
3. Sağ üstteki **`+ Yeni Stok Kartı`** butonuna tıkla.
4. Bilgileri Doldur:
   * Ürün Adı (Örn: "Logitech G102 Mouse").
   * Barkod / SKU (Barkod okuyucuyla okut).
   * Kategori & Alt Kategori.
   * Başlangıç Adedi, Alış Fiyatı, KDV Oranı, Para Birimi (TRY/USD/EUR).
   * **Kritik Stok Seviyesi:** Örn: 2 adet (Stok 2 adede indiğinde sistem üst bildirim ziliyle seni uyarır).
5. `Kaydet` de. Ürün artık Mağaza ekranında ve Teknik Servis parça listesinde kullanıma hazırdır.
6. **Manuel Sayım:** Rafta sayım yaparken adet eksik veya fazla çıkarsa karttaki `+/- Hızlı Stok` butonundan açıklamayla düzeltme yapabilirsin.

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

### SENARYO 7: DÜKKAN GİDERLERİ (KİRA, KARGO, ÇAY VB.)
> **Örnek Olay:** Dükkana 150 TL kargo ücreti ödedin veya aylık kira ödemesi yapacaksın.

1. Sol menüden **Genel Giderler** sayfasına git.
2. **Hızlı Gider Girişi:** Sayfanın ortasındaki formdan:
   * **Kategori:** Kargo, Mutfak/İkram, Temizlik vb.
   * **Şirket:** "Bilgisayar Hastanesi" seçili olsun.
   * **Ödeme Kaynağı:** "Nakit Kasa -> Bilgisayar Hastanesi Kasası".
   * **Tutar & Açıklama:** "150 TL - Arızalı ekran kargosu".
   * `Gideri Kaydet` butonuna bas. Kasandan 150 TL düşer.
3. **Sabit Gider Takibi:** Her ay ödenen kira, internet, muhasebe gibi giderlerin ödeme günü geldiğinde takip şeridindeki `[Hızlı Öde]` butonuna basarak tek tıkla kapatabilirsin.

---

### SENARYO 8: AKŞAM DÜKKAN KAPANIŞI (GÜN SONU KASA MUTABAKATI)

Dükkanın kapısını kilitlemeden önce şu 5 adımlık kontrolü mutlaka yap:

1. **Çekmecedeki Nakit Parayı Say:** Madeni ve kâğıt paraların toplamını tam olarak hesapla (Örn: 4.850 TL çıktı).
2. **Nakit Kasa Sayfasıyla Karşılaştır:** Sol menüden **Nakit Kasa** sekmesine tıkla.
   * Sistemdeki Bilgisayar Hastanesi Kasası da **4.850 TL** gösteriyorsa: **Tebrikler, günün 0 hata ile kapanmıştır!**
3. **Eğer Fark Varsa:**
   * Sistem 5.000 TL diyorsa ama çekmecede 4.850 TL varsa: 150 TL'lik bir gideri (örn. kargo veya yemek) sisteme işlemeyi unutmuş olabilirsin. Hemen Genel Giderler'den işle.
   * Çekmecede fazla para varsa: Bir perakende satışı veya servis tahsilatını sisteme girmeyi unutmuşsundur. Kontrol edip kaydet.
4. **Teslim Edilen Cihazları Kapat:** Gün içinde müşteriye teslim ettiğin tamir cihazlarının durumu sistemde "Teslim Edildi" olarak kapatıldı mı kontrol et.
5. **Bekleyen Virmanları Kontrol Et:** Ana Sayfada veya Giderlerde bekleyen "Merkeze Virman Bekliyor" kalemi var mı bak.

---

## 4. EKRANDA GÖRDÜĞÜNÜZ DEĞERLER VE VERİLER NE ANLAMA GELİR?
### (Muhasebe Bilgisi Olmayanlar İçin Esnaf Karar ve Yönetim Rehberi)

Ekranda gördüğün hiçbir sayı rastgele değildir. Her kutucuk, her renkli rozet ve her bakiye, dükkanı yönetirken sana **"ne yapman gerektiğini"** söyler. Aşağıda sayfa sayfa ekrandaki verilerin anlamları ve bu verilere bakarak alman gereken dükkan kararları izah edilmiştir:

---

### A. GENEL DURUM (DASHBOARD) EKRANINDAKİ VERİLER

* **Net Nakit Varlık (Kasa + Banka - Kredi Kartı Borcu):**
  * **Nedir:** Çekmecendeki nakit para ile bankadaki paranı toplar, varsa dükkanın kredi kartı borçlarını bundan düşer.
  * **Ne İşine Yarar / Esnaf Kararı:** Kasada 20.000 TL nakit görebilirsin; ama 15.000 TL kredi kartı borcun varsa aslında harcayabileceğin net para sadece 5.000 TL'dir. "Param var" deyip toptancıya gereksiz sipariş vermeni engeller, dükkanın gerçek can suyunu gösterir.

* **Toplam Müşteri Alacağı (Dışarıdaki Veresiyeler):**
  * **Nedir:** Müşterilere yaptığın tamir veya verdiğin mallardan henüz tahsil edemediğin, piyasadan toplayacağın toplam para.
  * **Ne İşine Yarar / Esnaf Kararı:** Bu rakam çok büyüdüyse dükkanın parası sokakta kalmış demektir. Hemen "Müşteriler" sekmesine gidip borcunu geciktirenleri araman veya yeni gelen müşterilere veresiye vermeyi kısıtlaman gerekir.

* **Tedarikçilere Borçlar (Ödenecek Faturalar):**
  * **Nedir:** Toptancılardan aldığın parça, ekran, kablo vb. ürünler için henüz ödemediğin toplam fatura borcu.
  * **Ne İşine Yarar / Esnaf Kararı:** Önümüzdeki günlerde kasandan ya da bankandan ne kadar para çıkacağını önceden bilmeni sağlar. Kasanı toptancı gününe hazırlarsın.

* **Yaklaşan ve Ay Sonu Vadeleri (Sarı & Kırmızı Uyarılar):**
  * **Nedir:** Günü bugün gelmiş veya yaklaşan dükkan kirası, elektrik, internet faturası, toptancı senedi ya da merkeze virmanlanacak kart borçları.
  * **Ne İşine Yarar / Esnaf Kararı:** Günlük yapılacaklar listendir. Sabah işe geldiğinde buraya bakar, "Bugün hangi ödemeler var?" diye görür ve ona göre hazırlık yaparsın.

* **⚠️ Merkeze Virman Bekliyor Rozeti:**
  * **Nedir:** Şirket ortağı veya merkezin ortak kredi kartıyla senin dükkanının bir vergisini/faturasını ödediğini ve kart kesiminde senin bu parayı dükkan kasasından merkeze aktarman gerektiğini belirtir.
  * **Ne İşine Yarar / Esnaf Kararı:** Rozetin yanındaki **[Merkeze Virmanla →]** butonuna basıp ödemeyi kapatırsın. Dükkanın borcu kalmaz ve kâr/zararın çift düşmeden tertemiz kalır.

---

### B. MAĞAZA (GÜNLÜK PERAKENDE DEFTERİ) EKRANINDAKİ VERİLER

* **KASA Kutucuğu:**
  * **Nedir:** Sabah açılışta devreden para + gün boyu elden giren nakit - gün içinde yapılan ufak harcamalar.
  * **Ne İşine Yarar / Esnaf Kararı:** O an çekmecede fiziksel olarak kaç TL kâğıt/madeni para olması gerektiğini söyler. Akşam çekmeceyi saydığında bu kutudaki tutarla birebir tutmalıdır.

* **NAKİT Sütunu:**
  * **Nedir:** Müşterinin elden kâğıt para ile ödediği tutardır.
  * **Ne İşine Yarar / Esnaf Kararı:** Kasandaki fiziksel nakit artışını temsil eder. Gün sonu çekmecesinde sayacağın paranın kaynağıdır.

* **K.KARTI (POS) Sütunu:**
  * **Nedir:** Müşterinin dükkandaki POS cihazından kart çektirerek ödediği tutardır.
  * **Ne İşine Yarar / Esnaf Kararı:** Bu para çekmeceye girmez, banka hesabına yansır. Çekmecede nakit arayıp "para nerede" paniği yaşamamanı ve banka POS slipleriyle mutabakat yapmanı sağlar.

* **SERVİS Kutusu & Günün Servis Fişleri:**
  * **Nedir:** Teknik serviste tamiri bitip o gün müşteriye teslim edilen cihazların toplam geliridir.
  * **Ne İşine Yarar / Esnaf Kararı:** Günlük kazancının ne kadarının hazır ürün satışından (aksesuar vb.), ne kadarının el emeği ve teknik servisten geldiğini ayrıştırmanı sağlar.

* **GİDER & MASRAF Kutusu:**
  * **Nedir:** Dükkan için o gün anlık olarak harcanan nakit (çay, yemek, kargo, ampul vb.).
  * **Ne İşine Yarar / Esnaf Kararı:** Kasandaki eksilmenin nereye gittiğini belgeler. Akşam kasayı sayarken "150 TL eksik çıktı, nereye gitti bu para?" demeni önler.

---

### C. TEKNİK SERVİS EKRANINDAKİ VERİLER

* **"Müşteri Onayı Bekliyor" Durumu (Sarı Rozet):**
  * **Nedir:** Arıza tespiti yapılmış, fiyat çıkarılmış ama müşteri henüz "Tamam yapın" dememiş cihazları gösterir.
  * **Ne İşine Yarar / Esnaf Kararı:** **Dükkanın emniyet kilididir!** Onay almadan cihaza pahalı parça takıp sonradan müşterinin "Ben bu fiyata yaptırmam, sökün parçamı" demesini ve dükkanın zarara uğramasını engeller.

* **Parça Maliyeti vs İşçilik Tutarı:**
  * **Nedir:** Cihaza taktığın parçanın toptancı alış fiyatı ile senin talep ettiğin tamir işçiliğini ayrı ayrı gösterir.
  * **Ne İşine Yarar / Esnaf Kararı:** Yaptığın işten net ne kazandığını gösterir. Parçayı zararına satmadığından ve dükkana yeterli işçilik kârı bıraktığından emin olursun.

* **"Hazır (Onarım Tamamlandı)" Durumu (Yeşil Rozet):**
  * **Nedir:** Tamiri bitmiş, testleri yapılmış, rafta müşterisini bekleyen cihazları gösterir.
  * **Ne İşine Yarar / Esnaf Kararı:** Hemen yanındaki yeşil **WhatsApp** butonuna basarak müşteriye "Cihazınız hazır, teslim alabilirsiniz" mesajını tek tıkla atarsın. Dükkanda gereksiz cihaz kalabalığını önler, paranın hızlı tahsil edilmesini sağlar.

* **Garanti Süresi (30 Gün / 90 Gün / 6 Ay):**
  * **Nedir:** Yapılan tamire veya takılan parçaya verilen servis garanti süresidir.
  * **Ne İşine Yarar / Esnaf Kararı:** Müşteri 2 hafta sonra "Yine bozuldu" diye geldiğinde ücretsiz mi bakılacağını yoksa kullanıcı hatası mı olduğunu takip etmeni sağlar.

---

### D. STOK YÖNETİMİ EKRANINDAKİ VERİLER

* **Ölü / Uyuyan Stok (Hareketsiz Ürünler):**
  * **Nedir:** Rafta veya depoda **son 60, 90 veya 180 gündür hiç satılmamış**, hareketsiz bekleyen ürünlerin listesi ve toplam maliyetidir.
  * **Ne İşine Yarar / Esnaf Kararı:** 
    * Rafta duran mal aslında senin **bağlanmış ve paslanan parandır**.
    * Bu ürünleri gördüğünde: İndirim kampanyası yapıp elden çıkartabilirsin, vitrinin ön tarafına koyup satabilirsin veya toptancıyla anlaşıp hızlı giden ürünlerle (flash bellek, mouse vb.) takas edebilirsin. Böylece dükkanın sermayesi rafta çürümez!

* **Kritik Seviyedeki Stoklar (Kırmızı Alarm):**
  * **Nedir:** Belirlediğin emniyet sınırının (örn: 2 adedin) altına düşmüş parçalardır (SSD, RAM, şarj aleti vb.).
  * **Ne İşine Yarar / Esnaf Kararı:** Müşteri geldiğinde "Elimizde kalmadı, yarın gelin" deyip müşteriyi kaçırmamanı sağlar. Rakam kırmızıya döndüğü an toptancıya hemen sipariş geçersin.

* **Envanter Değeri (Alış ve Satış Fiyatıyla):**
  * **Nedir:** Dükkanın rafındaki ve deposundaki tüm malların sana maliyeti ve satıldığında getireceği toplam ciro.
  * **Ne İşine Yarar / Esnaf Kararı:** Dükkanda ne kadarlık mal yattığını bilirsin. Sigorta veya güvenlik tedbirleri alırken dükkanın mal varlığını net görürsün.

---

### E. MÜŞTERİLER (ALACAK TAKİBİ) EKRANINDAKİ VERİLER

* **Toplam Bakiye (Kırmızı Borçlu Tutarlar):**
  * **Nedir:** Müşterilerin dükkana olan toplam borç miktarıdır.
  * **Ne İşine Yarar / Esnaf Kararı:** Kimin dükkana ne kadar borcu olduğunu kuruşu kuruşuna bilirsin. Dükkana gelip yeni cihaz bırakan birinin eski borcu varsa, yeni işe başlamadan önce eski borcunu kapatmasını istersin.

* **Vadesi Geçmiş Alacak (Gecikmiş Veresiyeler):**
  * **Nedir:** Ödeme sözü verdiği tarihi aşmış, borcunu gününde getirmeyen müşterilerdir.
  * **Ne İşine Yarar / Esnaf Kararı:** İlk aranacak müşterilerdir. Kartındaki **WhatsApp** butonuna basarak nazikçe borç ekstresi gönderir ve paranı tahsil edersin.

---

### F. SATICILAR (TOPTANCILAR) EKRANINDAKİ VERİLER

* **Toplam Tedarikçi Borcu:**
  * **Nedir:** Toptancılara (parçacılara) olan toplam borcun.
  * **Ne İşine Yarar / Esnaf Kararı:** Toptancı dükkana mal getirdiğinde veya hesap kestiğinde aranızda anlaşmazlık çıkmasını önler. Sistemdeki borç ile toptancının kestiği hesap ekstresini karşılaştırıp teyit edersin.

* **Vadesi Gelen / Geciken Toptancı Ödemeleri:**
  * **Nedir:** Ödeme vadesi gelmiş toptancı faturalarıdır.
  * **Ne İşine Yarar / Esnaf Kararı:** Toptancıya mahcup olmamak ve parça sevkiyatının durmasını engellemek için parayı hazırlamanı sağlar.

---

### G. NAKİT KASA EKRANINDAKİ VERİLER

* **Kasa Bakiyesi:**
  * **Nedir:** Dükkanın para çekmecesinde o an bulunması gereken fiziki net nakit tutarıdır.
  * **Ne İşine Yarar / Esnaf Kararı:** Dükkanın kalbidir. Akşam çekmecedeki parayı saydığında bu sayıyla eşit olmak zorundadır. Eşit değilse gün içinde bir işlem unutulmuş demektir.

* **Günlük Giriş / Çıkış:**
  * **Nedir:** O gün kasaya kaç TL elden para girdiği ve dükkan ihtiyaçları için kaç TL çıktığıdır.
  * **Ne İşine Yarar / Esnaf Kararı:** Dükkanın o günkü nakit akış hızını gösterir.

---

### H. BANKA HESAPLARI VE POS EKRANINDAKİ VERİLER

* **Banka Bakiyesi:**
  * **Nedir:** Şirketin banka hesabındaki güncel paradır.
  * **Ne İşine Yarar / Esnaf Kararı:** Toptancıya havale/EFT yaparken veya kira/vergi öderken bankada yeterli bakiye olup olmadığını gösterir.

* **POS Bloke / Valör Süresi:**
  * **Nedir:** Müşterinin kredi kartıyla ödediği paranın banka tarafından kaç gün sonra hesaba yatırılacağıdır (Örn: Ertesi gün veya 28 gün).
  * **Ne İşine Yarar / Esnaf Kararı:** Kredi kartı sliplerinin hemen nakde dönüşmediğini, paranın ne zaman hesaba geçeceğini bilerek nakit planı yapmanı sağlar.

---

### I. GENEL GİDERLER EKRANINDAKİ VERİLER

* **Sabit Giderler (Kira, İnternet, Aidat, Muhasebe):**
  * **Nedir:** Dükkan hiç satış yapmasa bile her ay tıkır tıkır ödenmesi gereken zorunlu dükkan masrafları.
  * **Ne İşine Yarar / Esnaf Kararı:** Dükkanın her ay sadece kapısını açık tutabilmek için kaç TL para kazanması gerektiğini (başabaş noktasını) gösterir.

* **Değişken Giderler (Kargo, Çay/Şeker, Temizlik, Tamir Malzemesi):**
  * **Nedir:** İş hacmine göre değişen günlük ufak dükkan harcamaları.
  * **Ne İşine Yarar / Esnaf Kararı:** Gereksiz masrafları kısmanı ve dükkanın parasının nereye gittiğini denetlemeni sağlar.

---

## 5. ALTIN KURALLAR & "ASLA YAPMAMAN GEREKENLER"

1. **"Sonra Yazarım" Deme:** Bir müşteri ürün aldığında veya para verdiğinde anında sisteme gir. Akşama bırakılan işlemler mutlaka unutulur.
2. **Kafana Göre Kayıt Silme:** Bir faturayı veya gideri yanlış girdiysen rastgele silmek yerine nedenini kontrol et. Sistem her silinen işlemin arkasında log (denetim izi) bırakır.
3. **Açık Hesap (Veresiye) Verirken Müşteriyi Doğru Seç:** Müşteri seçmeden veresiye verirsen kime borç yazıldığı belli olmaz. Telefon numarasını mutlaka teyit et.
4. **Teknik Servis Cihazını Fişsiz Teslim Etme:** Cihazı teslim ederken müşteriye teslim fişi imzalat ve sistemden "Teslim Edildi" olarak kapatmayı unutma.
5. **Kasa Açığı Varsa Şirket Yetkilisiyle Paylaş:** Kasada açıklanamayan bir fark olduğunda durumu merkez yönetimine bildir.

---

*İyi çalışmalar dileriz! Sistemle ilgili takıldığın her an ekranın sağ üst köşesindeki **`[?]`** butonuna basabilirsin.*


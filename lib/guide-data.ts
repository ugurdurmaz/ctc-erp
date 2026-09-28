export type GuideMetric = {
  term: string
  meaning: string
  whyItMatters: string
}

export type GuideTopic = {
  id: string
  title: string
  subtitle: string
  iconName: string
  category: 'daily' | 'service' | 'stock' | 'finance' | 'core'
  routePath?: string
  summary: string
  metrics?: GuideMetric[]
  steps: {
    number: number
    title: string
    description: string
    tip?: string
    warning?: string
  }[]
  faqs?: {
    question: string
    answer: string
  }[]
}

export const GUIDE_TOPICS: GuideTopic[] = [
  {
    id: 'dashboard',
    title: 'Genel Durum (Dashboard & Vadeler)',
    subtitle: 'Canlı kasa/banka varlıkları, kâr durumu ve yaklaşan ödemeler',
    iconName: 'LayoutDashboard',
    category: 'daily',
    routePath: '/',
    summary: 'Sisteme girdiğinde seni karşılayan ana kontrol merkezidir. Bilgisayar Hastanesi\'nin anlık net nakit varlığı, bugünkü ciro ve net kârı ile en önemlisi yaklaşan vadeler ve ortak kart mahsup virmanları bu ekranda toplanır.',
    metrics: [
      {
        term: 'Net Nakit Varlık (Kasa + Banka - Kart Borcu)',
        meaning: 'Dükkan kasasındaki nakit para ile banka hesabındaki paranın toplamından, kredi kartlarının o anki borçları düşüldükten sonra kalan temiz paradır.',
        whyItMatters: 'Kasa dolu gözükebilir ama kredi kartının borcu yüksekse kendini zengin sanıp fazla para harcamanı engeller. "Tüm borçlarımı bugün ödesem cebimde net kaç para kalır?" gerçeğini söyler.'
      },
      {
        term: 'Bugünkü Net Kâr',
        meaning: 'Bugün satılan ürünlerin kâr marjı + teknik servis işçilikleri - dükkandan çıkan harcamalar (giderler).',
        whyItMatters: 'Ciro (kasaya giren para) yüksek olsa bile dükkan o gün kâr mı etti zarar mı etti net olarak gösterir. Eksiye düşerse gereksiz harcama yapıldığını haber verir.'
      },
      {
        term: 'Vadeler (Gecikmeli / Bugün / Yaklaşıyor)',
        meaning: 'Ödeme günü geçmiş (kırmızı), günü bugün olan (sarı) veya bu hafta ödenecek kira, fatura, kredi taksiti ve tedarikçi borçlarıdır.',
        whyItMatters: 'Gecikme faizi yememek, elektriğin/internetin kesilmesini önlemek ve toptancının mal vermeyi durdurmaması için ilk hangi parayı çıkarman gerektiğini önceliklendirir.'
      },
      {
        term: 'Merkeze Virman Bekliyor (Kart Mahsubu)',
        meaning: 'Merkez veya şirket ortağı (şahsi / ortak kart), Bilgisayar Hastanesi adına vergi veya fatura ödediğinde oluşan transfer borcudur.',
        whyItMatters: 'Kartın son ödeme gününe kadar bu parayı dükkan kasasından merkeze aktarman gerektiğini hatırlatır. Kâr/zararını ikinci kez düşürmez.'
      }
    ],
    steps: [
      {
        number: 1,
        title: 'Üst Finans Kartlarını Kontrol Et',
        description: 'Net Nakit Durumu (Kasa + Banka - Kart Borcu), Bugünkü Gelir/Gider/Net Kâr kutularını incele. Bu rakamlar tamamen dükkanın o günkü performansını yansıtır.',
        tip: 'Kısıtlı yetkin sayesinde bu ekranda sadece Bilgisayar Hastanesi\'nin rakamları yer alır; merkezin şahsi hesapları filtrelenir.'
      },
      {
        number: 2,
        title: 'Kasa & Banka Dağılımını İncele',
        description: 'Sayfanın ortasındaki kartlardan dükkan kasasındaki nakit para ile şirket banka hesabındaki güncel bakiyeyi ayrı ayrı görürsün.',
        tip: 'Çekmecedeki fiziksel parayla ekrandaki kasa rakamının kuruşu kuruşuna tutması gerekir.'
      },
      {
        number: 3,
        title: 'Yaklaşan ve Ay Sonu Vadelerini Takip Et',
        description: 'Ekranın altındaki tabloda dükkanın yaklaşan sabit giderleri, kredi taksitleri ve tedarikçi ödemeleri listelenir. Vadeleri "Tümü", "Kredi Taksitleri", "Sabit Giderler" veya "Kart Mahsubu" butonlarıyla filtreleyebilirsin.',
        warning: 'Kırmızı renkli "Gecikmeli" veya sarı renkli "Bugün" rozetli kalemler acil ödeme bekleyen işlemlerdir.'
      },
      {
        number: 4,
        title: 'Ortak Kart Mahsup Virmanlarını Kapat (Çok Önemli!)',
        description: 'Merkez veya şirket ortağı (şahsi / ortak kart), Bilgisayar Hastanesi\'nin vergisini veya faturasını ödediyse vadeler listesinde sarı "⚠️ Merkeze Virman Bekliyor" uyarısı çıkar. Hemen yanındaki "[Merkeze Virmanla →]" butonuna basarak dükkan kasasından veya bankasından virmanı onaylayıp borcu kapatabilirsin.',
        tip: 'İşlem tamamlandığında rozet yeşil "✓ Mahsup Kapatıldı"ya dönüşür ve kâr/zararın ikinci kez düşmeden tertemiz kalır.'
      }
    ],
    faqs: [
      {
        question: 'Bugünkü net kârım neden eksiye düştü?',
        answer: 'Dükkan için bir gider (kargo, fatura vb.) işlendiğinde veya iade alındığında net kâr harcanan tutar kadar azalır. Satış ve servis tahsilatları yapıldıkça kâr tekrar artıya geçer.'
      },
      {
        question: 'Vadeler tablosundaki [Öde] butonu ne işe yarar?',
        answer: 'Günü gelen bir sabit gideri (örn: kira veya internet faturası) tek tıkla doğrudan dükkan kasasından veya bankasından ödeyip listeyi güncellemeni sağlar.'
      }
    ]
  },
  {
    id: 'retail',
    title: 'Mağaza (Günlük Kasa & Perakende Defteri)',
    subtitle: 'Kategori bazlı günlük satış, nakit/pos ayrımı ve kasa takibi',
    iconName: 'Store',
    category: 'daily',
    routePath: '/retail',
    summary: 'Bilgisayar Hastanesi\'nin günlük çalışma ve Z-defteri ekranıdır. Gün boyunca yapılan aksesuar, yazılım, medya satışları ve anlık dükkan masrafları kategorilerine göre doğrudan bu tablolara işlenir.',
    metrics: [
      {
        term: 'KASA (Anlık Çekmece Tutarı)',
        meaning: 'Dükkandaki para çekmecesinde o an kuruşu kuruşuna bulunması gereken fiziksel nakit paradır.',
        whyItMatters: 'Akşam dükkanı kapatırken çekmecedeki parayı saydığında bu rakamla birebir tutmalıdır. Tutmuyorsa eksik fiş veya işlenmemiş harcama vardır.'
      },
      {
        term: 'NAKİT vs K.KARTI (POS) Ayrımı',
        meaning: 'Müşterilerden elden alınan fiziki kâğıt paralar ile dükkan POS cihazından çekilip bankaya geçen paraların ayrımıdır.',
        whyItMatters: 'Hangi paranın çekmecede, hangi paranın banka hesabında olduğunu gösterir. Bankaya borç öderken çekmecedeki parayı banka zannetmeni önler.'
      },
      {
        term: 'SERVİS (Günlük Servis Gelir Payı)',
        meaning: 'Teknik Servis modülünden gün içinde müşteriye teslim edilip tahsilatı yapılan cihazların toplam tutarıdır.',
        whyItMatters: 'Parça maliyeti çok düşük olan ve dükkana doğrudan net kâr bırakan işçilik kazancını ayrı görmeni sağlar. Dükkanın ana lokomotifidir.'
      },
      {
        term: 'GİDER & MASRAF (Günün Dükkan Masrafları)',
        meaning: 'Gün içinde kasadan elden ödenen kargo, su, yemek, sarf malzeme gibi küçük harcamalardır.',
        whyItMatters: 'Hemen yazıldığında çekmecedeki nakit para düşer ve akşam kasasında "100 TL nerede?" sorusunu ortadan kaldırır.'
      }
    ],
    steps: [
      {
        number: 1,
        title: 'Üst Finans Şeridini Takip Et',
        description: 'Ekranın en üstünde KASA (çekmecedeki toplam nakit), NAKİT (günün nakit satışları), K.KARTI (günün POS çekimleri), SERVİS (teknik servisten gelen tahsilatlar) ve GİDER (dükkan harcamaları) anlık olarak toplanır.',
        tip: 'Bu şerit gün boyunca dükkanın canlı finansal nabzını gösterir.'
      },
      {
        number: 2,
        title: 'Satışı İlgili Kategori Kutusuna Yaz',
        description: 'Satılan ürün veya hizmet hangi gruba giriyorsa o kutudaki boş satıra tıkla: Aksesuar & Sarf Malzeme, Oyun & Prog Yükleme, DVD & Hariciye, Orjinal Film & Oyun veya Diğer.',
        tip: 'Her kategorinin kendi tablosu vardır; böylece gün sonunda hangi alandan ne kadar kazandığını net görürsün.'
      },
      {
        number: 3,
        title: 'Ürün Seçimi / Açıklama ve Adet Gir',
        description: '"Açıklama veya Ürün Seç..." alanına klavyeyle serbestçe yazabilir veya depodaki tanımlı stok kartlarından birini seçebilirsin.',
        tip: 'Stok kartından seçtiğin ürünler otomatik olarak dükkan deposundaki stok miktarından düşülür.'
      },
      {
        number: 4,
        title: 'Tahsilat Türünü Belirle (Nakit mi, Kredi Kartı mı?)',
        description: 'Müşteri elden nakit verdiyse tutarı NAKİT sütununa yaz. Dükkandaki POS cihazından kart çektiysen tutarı K.KARTI sütununa yaz.',
        warning: 'Müşteri kısmi ödeme yaptıysa (örn: 200 TL nakit, 300 TL kart) aynı satırda her iki sütuna bölerek yazabilirsin.'
      },
      {
        number: 5,
        title: 'Günün Masraflarını (Gider & Masraf) Ekle',
        description: 'Sağ üstteki turuncu "Gider & Masraf" tablosuna gün içinde dükkan için yapılan ufak harcamaları (kargo, su, yemek vb.) yaz. Bu tutarlar anlık olarak çekmecedeki nakit paradan düşülür.'
      },
      {
        number: 6,
        title: 'Sağ Paneller (Banka Hareketleri & Servis Fişleri)',
        description: '"Günün Banka Hareketleri" alanından kasadan bankaya yatırılan veya çekilen paraları takip edebilir, "Günün Teslim Edilen Servis Fişleri" bölümünden o gün teslim edilen cihazların özetini görebilirsin.'
      }
    ],
    faqs: [
      {
        question: 'Müşteri hem nakit hem kartla ödedi, nasıl girmeliyim?',
        answer: 'Aynı satırda nakit alınan kısmı NAKİT sütununa, POS ile çekilen kısmı K.KARTI sütununa yazabilirsin. Sistem her iki toplamı ayrı ayrı hesaplar.'
      },
      {
        question: 'Satışı girdim ama depodaki stoktan düşmedi?',
        answer: 'Sadece açıklama yazmak yerine arama listesinde çıkan depodaki ürün kartına tıklayarak seçmelisin. Seçilen stok kartlarının yanında depo simgesi görünür ve stoktan düşer.'
      },
      {
        question: 'Teknik servis gelirleri buraya nasıl yansıyor?',
        answer: 'Teknik Servis sayfasında teslim edilen ve kapatılan cihazların tahsilatları üst şeritteki "SERVİS" alanına ve dükkan kasasına otomatik olarak eklenir.'
      }
    ]
  },
  {
    id: 'technical-service',
    title: 'Teknik Servis & Cihaz Takip',
    subtitle: 'Cihaz kabul, parça/işçilik ekleme, servis fişi, WhatsApp ve teslimat',
    iconName: 'Wrench',
    category: 'service',
    routePath: '/technical-service',
    summary: 'Bilgisayar Hastanesi\'nin en yoğun çalıştığı modüldür. Arızalı laptop, masaüstü, konsol veya monitör kabulünden başlayıp; arıza tespiti, yedek parça ve format/bakım işçiliği ekleme, servis fişi yazdırma ve teslimata kadar tüm süreç buradan yönetilir.',
    metrics: [
      {
        term: 'Müşteri Onayı Bekliyor',
        meaning: 'Arıza tespiti yapılmış, gereken parça ve işçilik fiyatı belirlenmiş fakat müşteri henüz "yapın" dememiş durumdur.',
        whyItMatters: 'Müşteriden teyit almadan pahalı bir çip veya ekran takıp müşterinin "ben bu fiyatı kabul etmiyorum" demesini önler. Riski sıfırlayan emniyet kilididir.'
      },
      {
        term: 'Yedek Parça Bekliyor',
        meaning: 'Cihaz için gereken SSD, ekran paneli veya klavye dükkanda kalmamış; toptancıdan sipariş edilmiş ve kargosu bekleniyordur.',
        whyItMatters: 'Cihazın neden masada beklediğini teknik personele ve arayan müşteriye hemen açıklar. "Unuttuk mu?" şüphesini yok eder.'
      },
      {
        term: 'Dış Servis / Konsinye Maliyeti',
        meaning: 'Dükkanda yapılamayan ileri düzey BGA çip tamiri veya anakart onarımı için cihazın dışarıdaki uzman servise gönderilme maliyetidir.',
        whyItMatters: 'Dış tamirciye ödenecek para ile müşteriden istenecek fiyat arasındaki farkı net görmeni sağlar; dükkanın zarar etmesini engeller.'
      },
      {
        term: 'Kabul Fişi & Fiziksel Durum Notu',
        meaning: 'Cihaz teslim alınırken kasadaki çizik, kırık, eksik vida ve teslim alınan şarj aletinin yazılı kaydıdır.',
        whyItMatters: 'Teslim alırken var olan bir kırığı müşterinin "siz kırdınız" demesini veya "ben çantamı da vermiştim" iddialarını resmi fişle engeller.'
      }
    ],
    steps: [
      {
        number: 1,
        title: '+ Yeni Servis Kaydı Aç (Cihaz Kabulü)',
        description: 'Müşteri cihaz getirdiğinde "+ Yeni Servis Kaydı" butonuna bas. Müşteri adını ve telefonunu gir (kayıtlıysa seç, değilse hemen yeni müşteri açılır).',
        tip: 'Cihaz Türünü seç: Laptop, Masaüstü PC, All-in-One, Monitör, Game Console, Game Pad, Tablet/Telefon veya Diğer.'
      },
      {
        number: 2,
        title: 'Cihaz Bilgilerini ve Aksesuarları Eksiksiz Doldur',
        description: 'Marka/Model, Seri No ve en önemlisi Cihaz Şifresini yaz. Aksesuarlar alanındaki hazır butonlardan (Şarj Aleti, Çanta, Güç Kablosu vb.) teslim aldıklarını işaretle. Kasa üzerindeki çizik/kırıkları fiziksel duruma not et.',
        warning: 'Fiziksel durumu ve aksesuarları eksiksiz yazmak sonradan yaşanabilecek müşteri anlaşmazlıklarını tamamen önler!'
      },
      {
        number: 3,
        title: 'Servis Kabul Fişi Çıktısı Al ve Müşteriye Ver',
        description: 'Cihazı kaydettikten sonra açılan kabul fişini termal veya normal yazıcıdan çıkar. Bir nüshasını müşteriye teslim et, ikinci nüshayı cihazın üzerine iliştir.',
        tip: 'Fiş üzerinde servis numarası (örn: BH-2026-001) ve işlem detayları yer alır.'
      },
      {
        number: 4,
        title: 'Aşama Takibi ve Durum Güncelleme',
        description: 'Cihaz tamir masasındayken durumunu güncelle: "İncelemede / Arıza Tespiti" ➔ "Müşteri Onayı Bekliyor" ➔ "Yedek Parça Bekliyor" ➔ "Hazır (Onarım Tamamlandı)".',
        tip: 'İster Kanban pano görünümünde kartları sürükleyebilir, ister liste görünümünden detayına tıklayabilirsin.'
      },
      {
        number: 5,
        title: 'Kullanılan Yedek Parça ve Yapılan İşçiliği Ekle',
        description: 'Cihaz detayında "Kullanılan Yedek Parçalar" alanından depodaki SSD, RAM veya ekranı seç (stoktan otomatik düşer). "Yapılan Hizmet / İşçilik" alanından Format, Bakım vb. hizmeti ekle.',
        tip: 'Sistem parçaların maliyetini ve toplam servis tutarını otomatik olarak hesaplar.'
      },
      {
        number: 6,
        title: 'Dış Servis / Konsinye Takibi (Gerekiyorsa)',
        description: 'Cihaz anakart tamiri veya çip değişimi için anlaşmalı bir dış servise gönderildiyse "Dış Servis / Tedarikçi" seçeneğini işaretleyip tedarikçiyi ve dış servis maliyetini gir.'
      },
      {
        number: 7,
        title: 'Müşteriye WhatsApp İle Bilgi Ver',
        description: 'Cihaz "Hazır" olduğunda kartın üzerindeki yeşil WhatsApp simgesine tıkla. Hazır şablon mesaj (Cihazınız hazır, toplam tutar: X TL) müşterinin telefonuna tek tıkla gönderilir.'
      },
      {
        number: 8,
        title: 'Cihazı Teslim Et ve Tahsilatı Kapat',
        description: 'Müşteri cihazı almaya geldiğinde "Cihazı Teslim Et" butonuna bas. Ödeme türünü belirle: Nakit Kasa mı, Banka / POS Kredi Kartı mı, yoksa Müşteri Carisine Veresiye Borç mu? Onayladığında para kasana girer ve cihaz "Teslim Edildi" olarak kapanır.',
        warning: 'Tahsilatı yapmadan ve teslim formunu almadan cihazı dükkandan çıkarma.'
      }
    ],
    faqs: [
      {
        question: 'Müşteri tamirden vazgeçti, cihazı iade edeceğim?',
        answer: 'Servis kaydının durumunu "İptal / İade Edildi" yap. Eğer cihaza bir yedek parça bağladıysan sistem o parçayı depodaki stoğuna otomatik olarak geri yükler.'
      },
      {
        question: 'Müşteri sonra ödeyeceğini söyledi, nasıl teslim edeceğim?',
        answer: 'Teslimat penceresinde ödeme yöntemi olarak "Müşteri Carisine Borç Ekle (Veresiye)" seçeneğini işaretle. Tutar müşterinin carisine borç yazılır, cihaz teslim edilmiş sayılır.'
      },
      {
        question: 'Sadece format attım, parça kullanmadım?',
        answer: 'Parça eklemene gerek yoktur. "Yapılan Hizmetler" kısmından "Format & İşletim Sistemi Kurulumu" seçip tutarı belirlemen yeterlidir.'
      }
    ]
  },
  {
    id: 'stocks',
    title: 'Stok & Depo Yönetimi',
    subtitle: 'Depo bazlı stok kartları, kritik seviyeler, sayım ve transfer',
    iconName: 'Package',
    category: 'stock',
    routePath: '/stocks',
    summary: 'Bilgisayar Hastanesi deposundaki tüm yedek parçaların (SSD, RAM, ekran, fan, adaptör), çevre birimlerinin ve sarf malzemelerin adet, maliyet ve satış fiyatlarının takip edildiği ekrandır.',
    metrics: [
      {
        term: 'Ölü / Uyuyan Stok (Hareketsiz Ürünler)',
        meaning: 'Rafta aylardır duran, hiç satılmayan veya çok uzun süredir sorulmayan ürünlerdir (Örn: 6 aydır satılmayan eski bir adaptör veya ekran kartı).',
        whyItMatters: 'Dükkanın parası o rafa gömülüdür ve paslanıyordur. Mağaza sorumlusu bu veriye bakarak: "Bu ürünler satılmıyor, rafta tozlanacağına indirimli satayım ya da toptancıya iade edip yerine hızlı satan flash bellek, mouse alayım" kararı verir.'
      },
      {
        term: 'Kritik Stok Uyarısı',
        meaning: 'Stok adedi belirlenen emniyet sınırının (örn: 2 adet) altına inmiş ürünlerdir.',
        whyItMatters: 'Müşteri dükkana gelip acil kablo veya SSD istediğinde "kalmadı" deyip müşteriyi geri çevirmemek için toptancıya erkenden sipariş vermeni sağlar.'
      },
      {
        term: 'Toplam Stok Maliyet Değeri',
        meaning: 'Depodaki tüm ürünlerin dükkana geliş (maliyet) fiyatlarının toplam tutarıdır.',
        whyItMatters: '"Şu an dükkanımın rafında kaç liralık mal yatıyor?" sorusunun kesin cevabıdır. Dükkanın sermaye büyüklüğünü gösterir.'
      },
      {
        term: 'Dövizli Stok (USD / EUR)',
        meaning: 'Dolar veya Euro üzerinden satın alınan işlemci, RAM, ekran kartı gibi ürünlerin güncel kurla TL maliyetidir.',
        whyItMatters: 'Dolar kuru arttığında zararına satış yapmanı önler; ürünün güncel TL satış fiyatını piyasaya göre otomatik korur.'
      }
    ],
    steps: [
      {
        number: 1,
        title: 'Dükkan Deposunu Seç ve Filtrele',
        description: 'Depo filtresinden "Bilgisayar Hastanesi Ana Depo"yu seç. Dükkanındaki mevcut ürünlerin adetlerini ve toplam stok değerini incele.',
        tip: 'Arama çubuğuna barkod okutarak veya ürün adı yazarak anında raftaki adedi bulabilirsin.'
      },
      {
        number: 2,
        title: '+ Yeni Stok Kartı Aç',
        description: 'Dükkana ilk defa gelen bir ürün için "+ Yeni Stok Kartı" butonuna bas. Ürün Adı, Barkod/SKU, Kategori & Alt Kategori, Başlangıç Adedi, Alış Fiyatı, KDV Oranı ve Para Birimini (TRY/USD/EUR) gir.',
        warning: 'Depo olarak mutlaka "Bilgisayar Hastanesi Ana Depo" seçili olmalıdır.'
      },
      {
        number: 3,
        title: 'Kritik Stok Uyarısı Tanımla',
        description: 'Her ürün için "Kritik Stok Eşiği" belirle (Örn: 2 adet). Stok bu sayının altına düştüğünde sistem seni kırmızı rozetle ve üst bardaki bildirim ziliyle uyarır.'
      },
      {
        number: 4,
        title: 'Hızlı Stok Hareketi ve Manuel Sayım',
        description: 'Ürün kartındaki "+/- Hızlı Stok" butonuna basarak raf sayımında fazla çıkan ürünü Giriş (+), eksik çıkan veya hasar gören ürünü Çıkış (-) olarak açıklamayla kaydedebilirsin.'
      },
      {
        number: 5,
        title: 'Depolar Arası Virman / Transfer',
        description: 'Merkez depodan dükkana parça geldiğinde veya dükkandan merkeze ürün gönderildiğinde "Depo Transferi" butonunu kullanarak stoğu resmi olarak aktar.'
      }
    ],
    faqs: [
      {
        question: 'Teknik serviste veya mağazada satılan ürün stoktan otomatik düşer mi?',
        answer: 'Evet! Teknik serviste cihaza takılan yedek parçalar ve Mağaza ekranında listeden seçilen ürünler depodan anında düşer.'
      },
      {
        question: 'Dolar veya Euro ile aldığım parçayı nasıl gireceğim?',
        answer: 'Para birimini USD veya EUR olarak seçtiğinde sistem TCMB canlı kurundan TL maliyetini otomatik hesaplar.'
      }
    ]
  },
  {
    id: 'services',
    title: 'Hizmet & İşçilik Yönetimi',
    subtitle: 'Standart servis ve tamir şablonları, işçilik fiyat tarifeleri',
    iconName: 'Briefcase',
    category: 'service',
    routePath: '/services',
    summary: 'Dükkanda verilen format, termal macun bakımı, kasa toplama, virüs temizliği, ekran montajı gibi standart işçilik kalemlerinin birim fiyat ve KDV oranlarıyla tanımlandığı şablon ekranıdır.',
    metrics: [
      {
        term: 'Hizmet / İşçilik Birim Fiyatı',
        meaning: 'Bir parça maliyeti olmadan, tamamen teknisyenin emeği ve bilgisi için müşteriden talep edilen standart tutardır.',
        whyItMatters: 'Her müşteriye farklı fiyat çekmeyi engeller; dükkanda kurumsal ve şeffaf bir servis fiyat politikası oluşturur.'
      }
    ],
    steps: [
      {
        number: 1,
        title: '+ Yeni Hizmet Kartı Tanımla',
        description: 'Dükkanda sık yaptığın işçilikler için kart oluştur: Hizmet Adı (Örn: "Format & Standart Kurulum"), Birim Fiyat (Örn: 500 TL), KDV Oranı (%20) ve Şirket olarak "Bilgisayar Hastanesi"ni seç.',
        tip: 'Burada tanımladığın hizmetler Teknik Servis ekranında ve Fatura keserken tek tıkla önüne gelir.'
      },
      {
        number: 2,
        title: 'Fiyat Tarifesini Güncelle',
        description: 'İşçilik ücretlerine zam geldiğinde hizmet kartının üzerindeki "Düzenle" simgesine basıp yeni fiyatı yaz. Eski kayıtlar etkilenmez, yeni işler güncel fiyattan açılır.'
      }
    ]
  },
  {
    id: 'customers',
    title: 'Müşteriler & Cari Hesaplar (Alacak)',
    subtitle: 'Müşteri rehberi, açık hesap borçları, cari ekstre ve tahsilat alma',
    iconName: 'ArrowUpRight',
    category: 'core',
    routePath: '/customers',
    summary: 'Dükkanın müşterilerini, telefonlarını, geçmiş servis/satış hareketlerini ve en önemlisi veresiye borçlarını takip ettiğin ekrandır.',
    metrics: [
      {
        term: 'Kırmızı Bakiye (Müşteri Borcu)',
        meaning: 'Müşterinin dükkana olan açık hesap / veresiye borcudur. Mal veya hizmet verilmiş ama para henüz tahsil edilmemiştir.',
        whyItMatters: 'Dükkanın parasının dışarıda kimlerde kaldığını gösterir. Kırmızı rakam ne kadar yüksekse dükkan o kadar alacaklıdır.'
      },
      {
        term: 'Yeşil Bakiye (Müşteri Alacağı / Avans)',
        meaning: 'Müşterinin henüz yapılmamış bir tamir veya sipariş için dükkana önceden bıraktığı kapora / fazla paradır.',
        whyItMatters: 'İş bittiğinde müşteriden bu tutar kadar daha az tahsilat yapılacağını hatırlatır.'
      },
      {
        term: 'Cari Ekstre',
        meaning: 'Müşterinin tarih tarih aldığı ürünler, getirdiği cihazlar ve yaptığı ödemelerin resmi dökümüdür.',
        whyItMatters: '"Ben ne zaman borçlandım?" diyen müşteriye tek tıkla WhatsApp veya çıktı olarak gösterip tartışmayı bitirir.'
      }
    ],
    steps: [
      {
        number: 1,
        title: '+ Yeni Müşteri Kartı Oluştur',
        description: 'Müşteri Adı, Yetkili Kişi, Telefon Numarası, Adres ve varsa Vergi Dairesi/No bilgilerini gir. Varsa devir bakiyesini "Açılış Bakiyesi"ne yaz.',
        warning: 'Telefon numarasını başında sıfır olmadan (5XXXXXXXXX) formatında hatasız gir; WhatsApp bilgilendirmeleri bu numaraya gider.'
      },
      {
        number: 2,
        title: 'Borçlu Müşterileri Filtrele',
        description: 'Üstteki filtrelerden "Borçlu Müşteriler" butonuna basarak dükkana açık hesap borcu olan kişileri ve toplam alacağını tek listede gör.',
        tip: 'Kırmızı bakiye müşterinin dükkana borçlu olduğunu, yeşil bakiye ise müşterinin avans verdiğini gösterir.'
      },
      {
        number: 3,
        title: 'Borç Tahsilatı Al (Veresiye Kapatma)',
        description: 'Müşteri borcunu ödemeye geldiğinde kartındaki "[Tahsilat Al]" butonuna tıkla. Alınan tutarı gir, paranın girdiği "Bilgisayar Hastanesi Kasası"nı veya "Şirket Banka Hesabı"nı seçip kaydet.',
        tip: 'Tahsilat girildiği anda müşterinin borcu düşer, dükkan kasan anında artar.'
      },
      {
        number: 4,
        title: 'Cari Ekstre İncele & WhatsApp ile Gönder',
        description: 'Müşteri kartına tıkladığında tarih tarih tüm servis ve alışveriş dökümü açılır. "WhatsApp ile Gönder" butonuna basarak müşterinin telefonuna güncel hesap özetini atabilirsin.'
      }
    ],
    faqs: [
      {
        question: 'Müşteri kısmi ödeme yaptı, sistem kabul eder mi?',
        answer: 'Evet. 2.000 TL borcu olan müşteri 800 TL ödediyse tahsilat tutarına 800 TL yaz. Kalan borç otomatik 1.200 TL olarak güncellenir.'
      }
    ]
  },
  {
    id: 'suppliers',
    title: 'Satıcılar & Tedarikçiler (Borç)',
    subtitle: 'Toptancılar, parça alış faturaları ve tedarikçi ödemeleri',
    iconName: 'ArrowDownLeft',
    category: 'core',
    routePath: '/suppliers',
    summary: 'Yedek parça, bilgisayar bileşeni ve aksesuar aldığın toptancıların (Arena, Penta, yerel toptancılar vb.) cari hesapları, alış faturaları ve borç takibidir.',
    metrics: [
      {
        term: 'Tedarikçi Borç Bakiyesi',
        meaning: 'Parça aldığın toptancıya olan toplam açık hesap borcundur.',
        whyItMatters: 'Toptancı limitini aşıp sana mal vermeyi kesmeden önce ne kadar ödeme yapman gerektiğini hatırlatır.'
      },
      {
        term: 'Stoğa Otomatik Giriş (Alış Faturası)',
        meaning: 'Toptancı faturasını girerken "Stoğa Ekle" işaretlendiğinde ürünlerin depoya adet adet otomatik eklenmesidir.',
        whyItMatters: 'Faturadaki 50 parça ürünü tek tek stoktan elinle girip saatlerce uğraşmanı engeller; tek tuşla hem faturayı hem stoğu işler.'
      }
    ],
    steps: [
      {
        number: 1,
        title: 'Toptancı Kartı Tanımla',
        description: 'Toptancının firma adını, telefonunu ve başlangıç borç bakiyesini "+ Yeni Satıcı" butonundan ekle.',
        tip: 'Şirket seçimi olarak "Bilgisayar Hastanesi"ni seç.'
      },
      {
        number: 2,
        title: 'Alış Faturası Ekle (Stoğa Otomatik Giriş)',
        description: 'Toptancıdan gelen irsaliye/faturayı işlemek için satıcı kartındaki "[Fatura Ekle]" butonuna bas. Alınan ürünleri, adetleri ve birim alış fiyatlarını gir.',
        tip: '"Stoğa Ekle: Evet" ve "Depo: Bilgisayar Hastanesi Deposu" seçildiğinde ürünler depodaki stoğuna anında eklenir!'
      },
      {
        number: 3,
        title: 'Toptancıya Ödeme Yap',
        description: 'Toptancıya elden nakit veya banka havalesiyle ödeme yaptığında "[Ödeme Yap]" butonuna bas. Paranın çıktığı kasayı/bankayı seç. Toptancıya olan borcun düşer, kasandan para düşer.'
      }
    ],
    faqs: [
      {
        question: 'Toptancıya peşin ödedim, borç yazmasın istiyorum?',
        answer: 'Ödeme Yap butonuna basıp ödeme türünü Nakit Kasa olarak hemen gir; böylece toptancı bakiyesi sıfır kalır ve kasandan para düşüşü gerçekleşir.'
      }
    ]
  },
  {
    id: 'cash-registers',
    title: 'Nakit Kasa Yönetimi',
    subtitle: 'Çekmecedeki nakit para, giriş-çıkışlar ve gün sonu sayımı',
    iconName: 'Wallet',
    category: 'finance',
    routePath: '/cash-registers',
    summary: 'Bilgisayar Hastanesi\'nin fiziksel para çekmecesinin sistemdeki tam karşılığıdır. Mağazadan yapılan nakit satışlar, teknik servis peşin tahsilatları ve dükkan masrafları saniyesine kadar bu ekranda toplanır.',
    metrics: [
      {
        term: 'Kasa Bakiyesi (Sistem Kasası)',
        meaning: 'Sisteme girilen tüm nakit tahsilatlar ile nakit harcamaların matematiksel net sonucudur.',
        whyItMatters: 'Çekmecedeki fiziki paranın sağlamasıdır. İkisi eşit değilse aradaki fark ya unutulmuş bir gider ya da fişsiz satıştır.'
      },
      {
        term: 'Kasadan Bankaya Virman (Transfer)',
        meaning: 'Kasada hırsızlık veya kaybolma riskine karşı fazla nakit parayı alıp dükkanın şirket banka hesabına yatırma hareketidir.',
        whyItMatters: 'Dükkanın nakit parasını bankaya aktarırken gider veya kâr/zarar gibi görünmesini önler; varlıklar arası yer değiştirme olarak işler.'
      }
    ],
    steps: [
      {
        number: 1,
        title: 'Kasa Bakiyesini Karşılaştır',
        description: 'Ekranda "Bilgisayar Hastanesi Ana Kasası"nda yazan tutar ile çekmecendeki fiziki nakit parayı sayıp karşılaştır.',
        warning: 'İkisi birbirine eşit değilse gün içinde fişsiz veya kayıtsız bir işlem yapılmış demektir.'
      },
      {
        number: 2,
        title: 'Elden Nakit Para Girişi / Çıkışı',
        description: 'Özel bir durum için kasaya elden para konduysa "+ Para Girişi", elden para alındıysa "- Para Çıkışı" butonuna basarak açıklama ve tutar gir.',
        tip: 'Her giriş kasayı artırır, her çıkış kasayı azaltır.'
      },
      {
        number: 3,
        title: 'Kasadan Bankaya Transfer (Virman)',
        description: 'Kasada biriken nakit parayı dükkanın şirket banka hesabına veya ATM\'den yatırdığında "[Bankaya Transfer]" butonunu kullan. Kasandan düşer, banka hesabına geçer.'
      },
      {
        number: 4,
        title: 'Kasa Hareket Dökümünü İncele',
        description: 'Aşağıdaki tabloda gün içinde giren tüm paralar yeşil (+), çıkan paralar kırmızı (-) olarak işlem açıklaması ve saat bilgisiyle listelenir.'
      }
    ]
  },
  {
    id: 'bank-accounts',
    title: 'Banka Hesapları & POS',
    subtitle: 'Şirket banka hesapları, gelen/giden havaleler ve POS tahsilatları',
    iconName: 'Landmark',
    category: 'finance',
    routePath: '/bank-accounts',
    summary: 'Bilgisayar Hastanesi\'ne ait ticari banka hesaplarının ve kredi kartı POS tahsilatlarının takip edildiği ekrandır.',
    metrics: [
      {
        term: 'Banka Mevduat Bakiyesi',
        meaning: 'Dükkanın banka hesabındaki hazır paradır. POS cihazından çekilen kart ödemeleri ve müşterilerin gönderdiği havaleler burada toplanır.',
        whyItMatters: 'Kira veya vergi öderken bankada yeterli para olup olmadığını kontrol etmeni sağlar.'
      }
    ],
    steps: [
      {
        number: 1,
        title: 'Banka Bakiyesini Kontrol Et',
        description: 'Bilgisayar Hastanesi adına açılmış ticari hesapların güncel bakiyesini gör.',
        tip: 'POS cihazından çekilen kredi kartı ödemeleri ve banka havaleleri burada birikir.'
      },
      {
        number: 2,
        title: 'Gelen Havale / EFT Girişi',
        description: 'Bir müşteri IBAN\'a tamir veya ürün parası gönderdiğinde banka hareketlerinden gelen tutarı ilgili müşteriyle eşle.'
      }
    ]
  },
  {
    id: 'expenses',
    title: 'Genel Giderler & Ortak Kart Virmanı',
    subtitle: 'Dükkan harcamaları, sabit giderler ve merkeze virmanlama',
    iconName: 'Receipt',
    category: 'finance',
    routePath: '/expenses',
    summary: 'Dükkanın kira, elektrik, kargo, sarf malzeme harcamalarının işlendiği ve merkez ortak kartla ödenen dükkan vergilerinin mahsup virmanının yapıldığı kritik finans ekranıdır.',
    metrics: [
      {
        term: 'Sabit Gider vs Değişken Gider',
        meaning: 'Kira, internet, aidat, muhasebe gibi her ay kaçınılmaz olarak çıkan giderler SABİTTİR. Çay, şeker, kargo, sarf malzeme gibi dükkan iş yaptıkça çıkan giderler DEĞİŞKENDİR.',
        whyItMatters: 'Dükkan kapalı olsa bile her ay mutlaka ödenmesi gereken asgari tutarı bilmeni sağlar; işlerin az olduğu aylarda değişken giderleri kısma imkanı verir.'
      },
      {
        term: 'Ortak Kart Mahsup Virmanı (Çok Önemli)',
        meaning: 'Merkez veya şirket ortağı (şahsi / ortak kart), Bilgisayar Hastanesi adına vergi ödediğinde oluşan transfer hareketidir.',
        whyItMatters: 'Vergi zaten dükkan gideri olarak işlenmiştir; dükkan kasasından karta virman yapıldığında bu işlem TRANSFER (is_transfer: true) sayılır ve dükkan kârını ikinci kez asla düşürmez!'
      }
    ],
    steps: [
      {
        number: 1,
        title: 'Hızlı Gider Girişi',
        description: 'Sayfanın ortasındaki formdan Kategori (Kargo, Mutfak, Fatura vb.), Tutar, Açıklama ve Ödeme Kaynağı olarak "Bilgisayar Hastanesi Kasası"nı seçip kaydet.',
        tip: 'Gider işlendiği anda dükkan kasasından düşer ve net kârı günceller.'
      },
      {
        number: 2,
        title: 'Ortak Kart Mahsup Virmanını Yap (En Kritik Adım!)',
        description: 'Merkez veya şirket ortağı (şahsi / ortak kart), Bilgisayar Hastanesi\'nin vergisini veya faturasını ortak kredi kartıyla ödediğinde gider tablosunda turuncu renkli "⚠️ Merkeze Virman Bekliyor" rozeti belirir.',
        warning: 'Bu harcama dükkanın gideridir ama para merkez kartından çıkmıştır. Kartın vadesinde dükkan kasasından merkeze aktarılmalıdır!'
      },
      {
        number: 3,
        title: '[Virmanla →] Butonuna Tıkla',
        description: 'Gider satırındaki "[Virmanla →]" butonuna tıkla. Açılan pencerede paranın çıkacağı "Bilgisayar Hastanesi Kasası"nı veya "Şirket Banka Hesabı"nı seçip "Virmanı Onayla ve Kapat" de.',
        tip: 'Dükkan kasandan para düşer, ortak kart borcu kapanır, yeşil "✓ Mahsup Kapatıldı" rozeti çıkar ve kâr/zararın ikinci kez etkilenmez!'
      },
      {
        number: 4,
        title: 'Sabit Gider Takip Şeridini İncele',
        description: 'Kira, muhasebe, internet gibi her ay tekrarlayan giderlerin vadesini ve bu ay ödenip ödenmediğini takip şeridinden renkli rozetlerle takip et.'
      }
    ],
    faqs: [
      {
        question: 'Yanlış girdiğim bir gideri nasıl silerim?',
        answer: 'Gider satırındaki çöp kutusu simgesine tıkla. Sistem gideri iptal eder ve harcanan tutarı ilgili kasaya/hesaba kuruşu kuruşuna geri iade eder.'
      },
      {
        question: 'Ortak kart mahsup virmanı kârımı iki defa düşürür mü?',
        answer: 'HAYIR! Virman işlemi sistemde transfer (mahsup) olarak işlenir; dükkan kârını ikinci kez asla düşürmez.'
      }
    ]
  }
]

export const ROUTE_TO_GUIDE_MAP: Record<string, string> = {
  '/': 'dashboard',
  '/retail': 'retail',
  '/technical-service': 'technical-service',
  '/stocks': 'stocks',
  '/services': 'services',
  '/customers': 'customers',
  '/suppliers': 'suppliers',
  '/cash-registers': 'cash-registers',
  '/bank-accounts': 'bank-accounts',
  '/expenses': 'expenses',
  '/reports': 'dashboard'
}

export type GuideTopic = {
  id: string
  title: string
  subtitle: string
  iconName: string
  category: 'daily' | 'service' | 'stock' | 'finance' | 'core'
  routePath?: string
  summary: string
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
    title: 'Genel Durum (Dashboard)',
    subtitle: 'Dükkanın anlık kârı, kasaları ve yaklaşan vadeleri',
    iconName: 'LayoutDashboard',
    category: 'daily',
    routePath: '/',
    summary: 'Sisteme girdiğinde seni karşılayan ana ekrandır. Bilgisayar Hastanesi\'nin bugünkü cirosu, net kârı ve en önemlisi ödenmesi gereken vadeleri burada toplanır.',
    steps: [
      {
        number: 1,
        title: 'Günlük Kâr ve Kasa Toplamını İncele',
        description: 'Üst kartlarda dükkanın bugünkü net kârını, kasadaki nakit miktarını ve bankadaki toplam paranı görürsün.',
        tip: 'Bu rakamlar sadece Bilgisayar Hastanesi\'ne aittir; diğer şirketlerin rakamları burada yer almaz.'
      },
      {
        number: 2,
        title: 'Yaklaşan ve Ay Sonu Vadelerini Kontrol Et',
        description: 'Ekranın alt kısmındaki vadeler tablosunda dükkanın ödemesi gereken sabit giderler, tedarikçi vadeleri ve kart mahsupları listelenir.',
        warning: 'Günü geçmiş kırmızı kalemler varsa bunları öncelikli olarak kapatmalısın.'
      },
      {
        number: 3,
        title: 'Ortak Kart Mahsup Virmanlarını Gör ve Kapat',
        description: 'Merkez ortak kartla dükkanın vergi veya faturasını ödediyse, vadeler listesinde "⚠️ Merkeze Virman Bekliyor" uyarısı çıkar. "[Merkeze Virmanla →]" butonuna basarak dükkan kasandan ödemesini yapabilirsin.',
        tip: 'Virman filtresi için "Kart Mahsubu" butonuna basarak sadece bu işlemleri listeleyebilirsin.'
      }
    ],
    faqs: [
      {
        question: 'Bugünkü net kârım neden düştü?',
        answer: 'Dükkan için bir gider (fatura, kargo vb.) kaydedildiğinde net kâr harcanan tutar kadar azalır.'
      },
      {
        question: 'Kasa toplamı çekmecedeki para ile uyuşmuyor, ne yapmalıyım?',
        answer: 'Gün içinde fişsiz yapılan perakende satışları veya kaydedilmeyen harcamaları kontrol etmelisin.'
      }
    ]
  },
  {
    id: 'retail',
    title: 'Mağaza (Hızlı Perakende Satış)',
    subtitle: 'Barkod okutma, peşin/kart satış ve anında fiş kesme',
    iconName: 'Store',
    category: 'daily',
    routePath: '/retail',
    summary: 'Dükkana gelen müşterilere raf ürünlerinin (flash bellek, kablo, mouse vb.) hızlıca satıldığı ve tahsilatının yapıldığı ekrandır.',
    steps: [
      {
        number: 1,
        title: 'Ürünleri Sepete Ekle',
        description: 'Barkod okuyucuyla ürünün barkodunu okut veya ekrandaki arama kutusuna ürün adını yazıp tıkla. Miktar değiştirmek için sepet üzerindeki butonları kullan.',
        tip: 'Barkodlu ürünler doğrudan sepete eklenir ve satır adetleri otomatik artar.'
      },
      {
        number: 2,
        title: 'Müşteri Türünü Belirle',
        description: 'Ayaküstü perakende müşteri için bir şey seçmene gerek yoktur (varsayılan Perakende Müşteri kalır). Tanıdık bir cari ise listeden müşteriyi seç.',
        warning: 'Eğer satış veresiye olacaksa mutlaka müşteri seçilmelidir!'
      },
      {
        number: 3,
        title: 'Ödeme Türünü Seç',
        description: 'Nakit, Kredi Kartı (POS) veya Açık Hesap (Veresiye) seçeneklerinden uygun olanına tıkla.',
        tip: 'Nakit seçilirse para anında dükkan kasana girer. Kart seçilirse banka hesabına yansır.'
      },
      {
        number: 4,
        title: 'Satışı Tamamla ve Fiş Çıkar',
        description: '"Satışı Tamamla" butonuna bas. Ürünler dükkan stoğundan anında düşer ve istersen termal satış fişi yazdırılır.'
      }
    ],
    faqs: [
      {
        question: 'Müşteri sonra ödeyeceğini söyledi, nasıl yapmalıyım?',
        answer: 'Önce müşteriyi seç, ardından ödeme türü olarak "Açık Hesap (Veresiye)" butonuna bas. Bu işlem müşterinin cari hesabına borç olarak yansır.'
      },
      {
        question: 'Yanlış ürünü sepete ekledim, nasıl silerim?',
        answer: 'Sepet listesinde ürünün yanındaki çöp kutusu simgesine tıklayarak kaldırabilirsin.'
      }
    ]
  },
  {
    id: 'technical-service',
    title: 'Teknik Servis & Cihaz Takip',
    subtitle: 'Cihaz kabul, parça/işçilik ekleme, servis fişi ve teslimat',
    iconName: 'Wrench',
    category: 'service',
    routePath: '/technical-service',
    summary: 'Bilgisayar Hastanesi\'nin ana damarıdır. Müşteriden arızalı laptop/kasa kabulünden başlayıp, arıza tespiti, yedek parça + format/işçilik ekleme ve teslimata kadar tüm süreç buradan yönetilir.',
    steps: [
      {
        number: 1,
        title: '+ Yeni Servis Kaydı Aç (Cihaz Kabul)',
        description: 'Müşteri cihaz getirdiğinde "+ Yeni Servis Kaydı" butonuna tıkla. Müşteri adı, telefon, cihaz türü (Laptop, Kasa, Monitör), seri no, şifre ve şikayetini gir.',
        warning: 'Cihazın yanında şarj aleti, çanta alınıp alınmadığını ve kasadaki mevcut kırık/çizikleri mutlaka nota yaz.',
        tip: 'Kaydettikten sonra çıkan Servis Kabul Fişi çıktısını alıp müşteriye ver, ikinci kopyayı cihaza iliştir.'
      },
      {
        number: 2,
        title: 'Durumu "İşlemde" Yap ve Parça/İşçilik Ekle',
        description: 'Cihazı tamir masasına aldığında durumunu "İşlemde" yap. Kullanılan SSD, RAM veya fanı depodan seç (stoktan düşer). Yapılan format veya bakım hizmetini de işçilik olarak ekle.',
        tip: 'Sistem parça maliyetini ve toplam satış fiyatını otomatik hesaplar.'
      },
      {
        number: 3,
        title: 'Cihazı "Hazır" Konumuna Getir',
        description: 'Testleri tamamlanan cihazın durumunu "Hazır (Müşteri Bekleniyor)" yap ve müşteriye haber ver.'
      },
      {
        number: 4,
        title: 'Cihazı Teslim Et ve Tahsilat Al',
        description: 'Müşteri geldiğinde "Cihazı Teslim Et" butonuna tıkla. Ücreti Nakit mi, POS Kredi Kartı mı aldığını seç ve onayla. Cihaz kapatılır, para kasana işlenir.',
        warning: 'Teslim edilmeden cihazı müşteriye verme; teslim formu imzalatmayı unutma.'
      }
    ],
    faqs: [
      {
        question: 'Müşteri tamiri kabul etmedi (İptal/İade), ne yapacağım?',
        answer: 'Servis kaydının durumunu "İptal Edildi / İade" olarak değiştir. Takılan bir parça varsa stoğa geri iade edilir.'
      },
      {
        question: 'Format attım ama parça takmadım, nasıl girmeliyim?',
        answer: 'Parça seçmene gerek yoktur; sadece "Hizmet / İşçilik" alanından "Format & Sistem Kurulumu" seçip tutarı belirlemen yeterlidir.'
      }
    ]
  },
  {
    id: 'stocks',
    title: 'Stok & Depo Yönetimi',
    subtitle: 'Ürün listesi, depo adetleri ve kritik stok takibi',
    iconName: 'Package',
    category: 'stock',
    routePath: '/stocks',
    summary: 'Dükkandaki tüm sıfır ve ikinci el ürünlerin, yedek parçaların (SSD, RAM, ekran kartı, adaptör vb.) anlık adetlerini gösterir.',
    steps: [
      {
        number: 1,
        title: 'Stok Listesini İncele ve Ara',
        description: 'Arama çubuğuna ürün adı veya barkod yazarak rafta kaç adet kaldığını gör.',
        tip: 'Kritik seviyenin altına düşen ürünler kırmızı uyarı rozetiyle öne çıkar.'
      },
      {
        number: 2,
        title: 'Yeni Ürün Kartı Aç',
        description: 'Dükkana ilk defa gelen yeni bir ürün için "+ Yeni Stok Kartı" butonuna bas. Ürün adı, barkod, kategori, alış ve satış fiyatını gir.',
        warning: 'Depo olarak mutlaka "Bilgisayar Hastanesi Ana Depo"yu seç.'
      },
      {
        number: 3,
        title: 'Depolar Arası Transfer',
        description: 'Eğer merkez depodan dükkana parça geldiyse veya başka bir şubeye gönderildiyse "Depo Transferi" ile stoğu aktar.'
      }
    ]
  },
  {
    id: 'customers',
    title: 'Müşteriler & Cari Hesaplar',
    subtitle: 'Müşteri listesi, açık hesap borçları ve tahsilat alma',
    iconName: 'ArrowUpRight',
    category: 'core',
    routePath: '/customers',
    summary: 'Dükkanın müşterilerini, telefon numaralarını ve en önemlisi kimin ne kadar veresiye borcu olduğunu takip ettiğin ekrandır.',
    steps: [
      {
        number: 1,
        title: 'Borçlu Müşterileri Filtrele',
        description: 'Üstteki filtrelerden "Borçlu Müşteriler" butonuna basarak dükkana borcu olan kişileri ve toplam alacağını tek ekranda gör.'
      },
      {
        number: 2,
        title: 'Tahsilat Al (Borç Kapatma)',
        description: 'Müşteri gelip borcunu ödediğinde kartındaki "[Tahsilat Al]" butonuna tıkla. Tutarı gir, Nakit mi yoksa Banka Havalesi mi aldığını seç ve kaydet.',
        tip: 'Tahsilat yapıldığında müşterinin borcu düşer, dükkan kasan anında artar.'
      },
      {
        number: 3,
        title: 'Müşteri Ekstresi İnceleme',
        description: 'Müşteri "Ben ne zaman ne almıştım?" derse, kartına tıklayarak tüm alışveriş ve servis geçmişini tarih tarih görebilirsin.'
      }
    ]
  },
  {
    id: 'suppliers',
    title: 'Satıcılar & Tedarikçiler (Borç)',
    subtitle: 'Toptancılar, parça alımları ve tedarikçi ödemeleri',
    iconName: 'ArrowDownLeft',
    category: 'core',
    routePath: '/suppliers',
    summary: 'Dükkana yedek parça ve malzeme aldığın toptancıların (örneğin Arena, Penta, Index vb.) cari hesapları ve borç takibidir.',
    steps: [
      {
        number: 1,
        title: 'Toptancıya Olan Borçları Gör',
        description: 'Hangi toptancıya ne kadar borcun olduğunu ve yaklaşan ödeme tarihlerini liste üzerinden incele.'
      },
      {
        number: 2,
        title: 'Ödeme Yap',
        description: 'Toptancıya ödeme yaptığında "[Ödeme Yap]" butonuna bas. Dükkan kasasından mı yoksa şirket bankasından mı çıktığını belirle.',
        warning: 'Kasadan ödeme yapıldığında dükkan nakit bakiyesi düşer; fiili parayla tutarlı olması için mutlaka girilmelidir.'
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
    summary: 'Bilgisayar Hastanesi\'nin fiziksel para çekmecesinin dijital ikizidir. Yapılan her nakit satış, servis tahsilatı veya nakit harcama burayı etkiler.',
    steps: [
      {
        number: 1,
        title: 'Kasa Bakiyesini Kontrol Et',
        description: 'Ekranda yazan bakiye, dükkandaki çekmecede kuruşu kuruşuna bulunan nakit para ile aynı olmalıdır.'
      },
      {
        number: 2,
        title: 'Elden Nakit Giriş/Çıkış Yap',
        description: 'Özel bir durum için kasaya para konduysa "+ Para Girişi", elden para alındıysa "- Para Çıkışı" yaparak açıklamasını yaz.'
      },
      {
        number: 3,
        title: 'Kasa Hareketlerini İncele',
        description: 'Aşağıdaki hareket tablosunda gün içinde yapılan tüm satışlar yeşil (+), harcamalar kırmızı (-) olarak saniyesine kadar listelenir.'
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
    summary: 'Dükkanın kira, elektrik, kargo, çay-şeker gibi harcamalarının işlendiği ve merkez ortak kartla ödenen vergilerin dükkan kasasından mahsup virmanı yapıldığı ekrandır.',
    steps: [
      {
        number: 1,
        title: 'Hızlı Gider Kaydet',
        description: 'Kargo veya sarf malzeme aldığında tutarı, kategoriyi ve ödemenin çıktığı "Bilgisayar Hastanesi Kasası"nı seçip kaydet.',
        tip: 'Gider işlendiğinde dükkan kârından düşer ve kasan azalır.'
      },
      {
        number: 2,
        title: 'Ortak Kart Mahsup Virmanı Yap (Çok Önemli!)',
        description: 'Eğer merkez yönetici ortak bir kredi kartı ile Bilgisayar Hastanesi\'nin vergisini veya faturasını ödediyse, gider tablosunda "⚠️ Merkeze Virman Bekliyor" rozeti çıkar.',
        tip: 'Hemen yanındaki "[Virmanla →]" butonuna tıkla. Açılan pencerede ödemenin çıkacağı dükkan kasasını veya bankasını seçip "Virmanı Onayla ve Kapat" de.',
        warning: 'Bu işlem dükkan kasandan parayı düşürür, merkez kart borcunu kapatır ve kâr/zararı ikinci kez etkilemeden tertemiz muhasebeleştirir!'
      },
      {
        number: 3,
        title: 'Sabit Şablonları İncele',
        description: 'Her ay düzenli ödenen kira, muhasebe veya internet giderlerini sabit şablonlar sekmesinden takip edebilirsin.'
      }
    ]
  }
]

export const ROUTE_TO_GUIDE_MAP: Record<string, string> = {
  '/': 'dashboard',
  '/retail': 'retail',
  '/technical-service': 'technical-service',
  '/stocks': 'stocks',
  '/services': 'technical-service',
  '/customers': 'customers',
  '/suppliers': 'suppliers',
  '/cash-registers': 'cash-registers',
  '/bank-accounts': 'dashboard',
  '/expenses': 'expenses',
  '/reports': 'dashboard'
}
